// Which `frappe.*` paths and desk globals does a source file actually USE?
//
// audit-consumer.mjs used to answer that with a regex over each file after
// stripping comments, plus two narrow rules for server-method strings. That
// counted any `frappe.x` written inside string text as a use, so carbon_frappe's
// test fixtures and error messages showed up as "undeclared" frappe API:
//
//   "frappe.exceptions.ValidationError: Boom"          a Python traceback line
//   `frappe.major "${major}" is missing or not numeric` a message about package.json
//   ["*/api/method/frappe.client.get"]                 a URL glob
//   it("deleteSession sends frappe.client.delete", …)  a test title
//
// It cannot simply ignore every string either: carbon's CDP harnesses ship
// real browser code as template literals
// (`page.eval(\`frappe.query_report.datatable.sortColumn(${std}, 'none')\`)`),
// and those ARE member expressions the typeset must cover.
//
// So this splits a file into code, comments and string literals with a small
// lexer, scans the code, and scans a string's content only when that content
// is itself JavaScript. "Is it JavaScript?" is answered by V8, not by a
// heuristic: `new vm.Script(text)` compiles the text without running it, and
// prose does not compile. A template's `${…}` substitutions are code and are
// scanned as such; inside the template's text each one is replaced by the
// identifier `$0` before the compile check, which is valid both where a value
// goes and before a member access (`${A}.deepText(…)`).
//
// Two kinds of string are skipped outright, as before:
//   - one whose whole content is a dotted `frappe.…` path: the
//     `frappe.call({ method: "frappe.client.get_list" })` idiom names a Python
//     function, not a JS object (see the `Frappe` interface in src/index.d.ts);
//   - anything nested more than MAX_DEPTH strings deep.
//
// What it does not do: parse TypeScript or Vue templates. The lexer only needs
// to know where strings, comments and regular expressions start and end, which
// is the same in TS and JS. In a `.vue` file the `<script>` blocks are lexed
// and the rest (the template) is scanned as code, as it always was.
//
// BARE GLOBALS. Besides `frappe.*`, frappe puts plain functions and slots on
// `window` — `format_currency`, `open_url_post`, `in_list`, `cur_frm` — which
// a desk script calls without a prefix. Which names to look for is not a guess
// either: `frappeWindowGlobals` reads them off frappe's own `window.x = …` and
// `Object.assign(window, { … })` sites, and audit-consumer.mjs uses that when
// it has a frappe checkout. Without one it falls back to WINDOW_GLOBALS, the
// same list as read from the pinned tree, which test/scan-source.test.mjs
// re-derives from FRAPPE_PATH so the two cannot drift apart. Libraries frappe
// vendors onto `window` (moment, Sortable, …) are left out: they are not
// frappe's API and this package does not type them (NOT_FRAPPE_GLOBALS).
//
// A bare name is common enough to collide with an app's own: `precision`,
// `strip`, `saving`. So a global is not counted in a file that declares a
// binding of that name itself (`const precision = …`, `function strip(…)`,
// `import moment from …`), nor where it is an object key (`{ precision: 2 }`)
// or a member (`frm.precision`).

import { glob, readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const IDENT = "[A-Za-z_$][A-Za-z0-9_$]*";

/**
 * Desk globals that are not window helpers: the translator, the document cache,
 * the `cur_*` slots and ERPNext's root. Probed as bare identifiers.
 */
export const OTHER_GLOBALS = ["__", "locals", "cur_frm", "cur_list", "cur_dialog", "cur_page", "erpnext"];

/**
 * The names frappe v16.54.0 assigns to `window` (`window.x = …` and
 * `Object.assign(window, { … })` under frappe/public/js), less
 * NOT_FRAPPE_GLOBALS. The fallback when no frappe checkout is at hand; when
 * one is, `frappeWindowGlobals` reads the same list off it. Where each is set:
 *
 *   frappe/public/js/frappe/utils/datatype.js:4-75     cstr cint toTitle is_null copy_dict validate_email
 *                                                      validate_phone validate_name validate_url nth has_words has_common
 *   frappe/public/js/frappe/utils/number_format.js:90  format_number
 *   frappe/public/js/frappe/utils/number_format.js:324-340
 *                                                      flt cint strip_number_groups convert_old_to_new_number_format
 *                                                      format_currency fmt_money get_currency_symbol get_number_format
 *                                                      get_number_format_info _round roundNumber precision remainder
 *                                                      round_based_on_smallest_currency_fraction in_list
 *   frappe/public/js/frappe/utils/common.js:194-229    repl replace_all strip_html strip lstrip rstrip
 *   frappe/public/js/frappe/utils/pretty_date.js:81    comment_when
 *   frappe/public/js/frappe/utils/urllib.js:48,76-77   open_url_post get_url_arg get_url_dict
 *   frappe/public/js/frappe/form/script_helpers.js:4-58
 *                                                      refresh_many refresh_field set_field_options toggle_field
 *                                                      hide_field unhide_field
 *   frappe/public/js/frappe/form/script_manager.js:6   extend_cscript
 *   frappe/public/js/libs.bundle.js:4                  SetVueGlobals
 *   frappe/public/js/frappe/model/perm.js:9-17         READ WRITE CREATE DELETE SUBMIT CANCEL AMEND
 *   frappe/public/js/frappe/translate.js:26            __
 *   frappe/public/js/frappe/ui/messages.js:329         msgprint
 *   frappe/public/js/frappe/provide.js:42-50           NEWLINE TAB UP_ARROW DOWN_ARROW cur_frm
 *   frappe/public/js/frappe/list/list_factory.js:6     cur_list
 *   frappe/public/js/frappe/ui/dialog.js:6             cur_dialog
 *   frappe/public/js/frappe/views/container.js:8       cur_page
 *   frappe/public/js/frappe/views/treeview.js:6        cur_tree
 *   frappe/public/js/frappe/ui/filters/filter_list.js:5  fltr
 *   frappe/public/js/frappe/views/reports/report_view.js:6, query_report.js:6  DataTable
 *   frappe/public/js/frappe/web_form/web_form.js:414   saving
 *   frappe/public/js/print.bundle.js:17                render_barcode
 */
export const WINDOW_GLOBALS = [
	"AMEND",
	"CANCEL",
	"CREATE",
	"DELETE",
	"DOWN_ARROW",
	"DataTable",
	"NEWLINE",
	"READ",
	"SUBMIT",
	"SetVueGlobals",
	"TAB",
	"UP_ARROW",
	"WRITE",
	"__",
	"_round",
	"cint",
	"comment_when",
	"convert_old_to_new_number_format",
	"copy_dict",
	"cstr",
	"cur_dialog",
	"cur_frm",
	"cur_list",
	"cur_page",
	"cur_tree",
	"extend_cscript",
	"flt",
	"fltr",
	"fmt_money",
	"format_currency",
	"format_number",
	"get_currency_symbol",
	"get_number_format",
	"get_number_format_info",
	"get_url_arg",
	"get_url_dict",
	"has_common",
	"has_words",
	"hide_field",
	"in_list",
	"is_null",
	"lstrip",
	"msgprint",
	"nth",
	"open_url_post",
	"precision",
	"refresh_field",
	"refresh_many",
	"remainder",
	"render_barcode",
	"repl",
	"replace_all",
	"roundNumber",
	"round_based_on_smallest_currency_fraction",
	"rstrip",
	"saving",
	"set_field_options",
	"strip",
	"strip_html",
	"strip_number_groups",
	"toTitle",
	"toggle_field",
	"unhide_field",
	"validate_email",
	"validate_name",
	"validate_phone",
	"validate_url",
];

/**
 * Names frappe assigns to `window` that are not its API: `frappe` itself (its
 * paths are scanned as `frappe.*`), jQuery (`@types/jquery` types `$` and
 * `jQuery`) and the libraries frappe vendors onto the page, whose types are
 * their own packages'. A use of one of these says nothing about this package.
 *
 *   frappe/public/js/jquery-bootstrap.js:15-16              $ jQuery
 *   frappe/public/js/lib/moment.js:5                        moment
 *   frappe/public/js/libs.bundle.js:8                       Sortable
 *   frappe/public/js/lib/leaflet/leaflet.js:5               L
 *   frappe/public/js/syntax_highlighting.bundle.js:12       hljs
 *   frappe/public/js/frappe/ui/awesomplete.js:35            Awesomplete
 *   frappe/public/js/billing.bundle.js:116                  chatwootSDK
 *   frappe/public/js/frappe/file_uploader/ImageCropper.vue:92  cropper
 */
export const NOT_FRAPPE_GLOBALS = new Set([
	"frappe",
	"$",
	"jQuery",
	"moment",
	"Sortable",
	"L",
	"hljs",
	"Awesomplete",
	"chatwootSDK",
	"cropper",
]);

/** The default list of bare globals to scan for: OTHER_GLOBALS and WINDOW_GLOBALS. */
export const DEFAULT_GLOBALS = globalsToProbe(WINDOW_GLOBALS);

const RE_FRAPPE = new RegExp(`(?:^|[^\\w.$])(frappe(?:\\.${IDENT})+)`, "g");
const RE_DOTTED_ONLY = new RegExp(`^\\s*frappe(?:\\.${IDENT})+\\s*$`);

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The regular expressions for one list of globals, built once per list.
 * @type {WeakMap<readonly string[], { other: RegExp, mentions: RegExp }>}
 */
const PATTERNS = new WeakMap();

/** @param {readonly string[]} globals */
function patternsFor(globals) {
	let p = PATTERNS.get(globals);
	if (!p) {
		const alt = globals.map(escapeRe).join("|");
		p = {
			// A bare use: not after a `.` (a member) or an identifier character,
			// and not an object key (`name:`, but `name::` never occurs in JS).
			other: new RegExp(`(?:^|[^\\w.$])(${alt})(?![\\w$])(?!\\s*:(?!:))`, "g"),
			mentions: new RegExp(`(?:^|[^\\w.$])(?:frappe\\.|(?:${alt})(?![\\w$]))`),
		};
		PATTERNS.set(globals, p);
	}
	return p;
}

/**
 * The union of OTHER_GLOBALS and `windowGlobals`, without NOT_FRAPPE_GLOBALS,
 * sorted.
 * @param {Iterable<string>} windowGlobals names frappe assigns to `window`
 * @returns {string[]}
 */
export function globalsToProbe(windowGlobals) {
	const out = new Set(OTHER_GLOBALS);
	for (const g of windowGlobals) if (!NOT_FRAPPE_GLOBALS.has(g)) out.add(g);
	return [...out].sort();
}

/** How many string literals deep a scan follows code inside strings. */
const MAX_DEPTH = 4;

/** Words after which a `/` starts a regular expression rather than a division. */
const KEYWORDS_BEFORE_EXPRESSION = new Set([
	"return",
	"typeof",
	"instanceof",
	"in",
	"of",
	"new",
	"delete",
	"void",
	"throw",
	"case",
	"do",
	"else",
	"yield",
	"await",
]);

/** Punctuation after which a `/` starts a regular expression. */
const PUNCT_BEFORE_EXPRESSION = new Set([..."(,=:[!&|?{};+-*%<>~^"]);

const SIMPLE_ESCAPES = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", v: "\v", 0: "\0" };

/**
 * Split JavaScript or TypeScript source into the code (with every string,
 * comment and regular expression removed) and the content of each string
 * literal. A template literal's text is returned with each `${…}` replaced by
 * `$0`; the substitutions themselves are lexed as code.
 *
 * @param {string} src
 * @returns {{ code: string, strings: string[] }}
 */
export function lex(src) {
	const code = [];
	const strings = [];
	const n = src.length;
	let i = 0;
	// The last significant token emitted to `code`: "" at the start, otherwise
	// a punctuation character, a word, or ")" standing in for a value.
	let last = "";

	const regexAllowed = () => {
		if (last === "") return true;
		if (PUNCT_BEFORE_EXPRESSION.has(last)) return true;
		if (/^[A-Za-z_$]/.test(last)) return KEYWORDS_BEFORE_EXPRESSION.has(last);
		return false;
	};

	const readEscape = () => {
		// src[i] is the backslash.
		const e = src[i + 1];
		i += 2;
		if (e === undefined) return "";
		if (e === "\n") return "";
		return SIMPLE_ESCAPES[e] ?? e;
	};

	const readQuoted = (quote) => {
		i++;
		let text = "";
		while (i < n) {
			const c = src[i];
			if (c === "\\") {
				text += readEscape();
				continue;
			}
			if (c === quote) {
				i++;
				return text;
			}
			// An unterminated string ends at the line break, as it does for the parser.
			if (c === "\n") return text;
			text += c;
			i++;
		}
		return text;
	};

	const skipRegex = () => {
		i++;
		let inClass = false;
		while (i < n) {
			const c = src[i];
			if (c === "\\") {
				i += 2;
				continue;
			}
			if (c === "\n") return;
			if (inClass) {
				if (c === "]") inClass = false;
			} else if (c === "[") {
				inClass = true;
			} else if (c === "/") {
				i++;
				while (i < n && /[A-Za-z]/.test(src[i])) i++;
				return;
			}
			i++;
		}
	};

	const readTemplate = () => {
		i++;
		let text = "";
		while (i < n) {
			const c = src[i];
			if (c === "\\") {
				text += readEscape();
				continue;
			}
			if (c === "`") {
				i++;
				return text;
			}
			if (c === "$" && src[i + 1] === "{") {
				i += 2;
				const saved = last;
				code.push(" ");
				last = "(";
				lexCode(true);
				code.push(" ");
				last = saved;
				text += "$0";
				continue;
			}
			text += c;
			i++;
		}
		return text;
	};

	function lexCode(stopAtBrace) {
		let depth = 0;
		while (i < n) {
			const c = src[i];
			const d = src[i + 1];
			if (c === "/" && d === "/") {
				while (i < n && src[i] !== "\n") i++;
				continue;
			}
			if (c === "/" && d === "*") {
				const end = src.indexOf("*/", i + 2);
				i = end === -1 ? n : end + 2;
				code.push(" ");
				continue;
			}
			if (c === "'" || c === '"') {
				strings.push(readQuoted(c));
				code.push('""');
				last = ")";
				continue;
			}
			if (c === "`") {
				strings.push(readTemplate());
				code.push('""');
				last = ")";
				continue;
			}
			if (c === "/" && regexAllowed()) {
				skipRegex();
				code.push(" /r/ ");
				last = ")";
				continue;
			}
			if (/[A-Za-z_$]/.test(c)) {
				let j = i + 1;
				while (j < n && /[\w$]/.test(src[j])) j++;
				const word = src.slice(i, j);
				code.push(word);
				last = word;
				i = j;
				continue;
			}
			if (/[0-9]/.test(c)) {
				let j = i + 1;
				while (j < n && /[\w$.]/.test(src[j])) j++;
				code.push(src.slice(i, j));
				last = ")";
				i = j;
				continue;
			}
			if (c === "{") depth++;
			if (c === "}") {
				if (stopAtBrace && depth === 0) {
					i++;
					return;
				}
				depth--;
			}
			code.push(c);
			if (!/\s/.test(c)) last = c === ")" || c === "]" ? ")" : c;
			i++;
		}
	}

	lexCode(false);
	return { code: code.join(""), strings };
}

/**
 * Whether `text` compiles as JavaScript: as a script, or as the body of an
 * async function (so a snippet using top-level `await` or `return`, as code
 * sent to a browser often does, counts). Compiling does not run anything.
 */
export function isJavaScript(text) {
	for (const wrapped of [text, `(async function () {\n${text}\n})`]) {
		try {
			new vm.Script(wrapped);
			return true;
		} catch {
			// not this shape
		}
	}
	return false;
}

const RE_BINDINGS = [
	// const x / let x / var x, and each name of `const a = 1, b = 2` is not
	// needed: one is enough to show the file has its own.
	new RegExp(`\\b(?:const|let|var)\\s+(${IDENT})`, "g"),
	new RegExp(`\\bfunction\\s*\\*?\\s*(${IDENT})`, "g"),
	new RegExp(`\\bclass\\s+(${IDENT})`, "g"),
	// import x from, import * as x from, import { a as x }
	new RegExp(`\\bimport\\s+(${IDENT})\\s*(?:,|\\bfrom\\b)`, "g"),
	new RegExp(`\\bas\\s+(${IDENT})`, "g"),
];
const RE_IMPORT_NAMED = /\bimport\s*(?:[A-Za-z_$][\w$]*\s*,\s*)?\{([^}]*)\}/g;
// `import … from ""` / `export … from ""` once `lex` has emptied the specifier.
const RE_IMPORT_CLAUSE = /\b(?:import|export)\b[^;]*?\bfrom\s*""/g;

/**
 * Names a piece of code binds itself. Deliberately simple: the common ways a
 * file gets its own `precision` or `moment`, not a scope analysis.
 * @param {string} code
 * @returns {Set<string>}
 */
export function declaredNames(code) {
	const out = new Set();
	for (const re of RE_BINDINGS) for (const m of code.matchAll(re)) out.add(m[1]);
	for (const m of code.matchAll(RE_IMPORT_NAMED)) {
		for (const part of m[1].split(",")) {
			const name = part.trim().split(/\s+as\s+/).pop()?.trim();
			if (name) out.add(name);
		}
	}
	return out;
}

function scanCode(code, acc, globals) {
	for (const m of code.matchAll(RE_FRAPPE)) {
		if (/\.\d/.test(m[1])) continue;
		acc.paths.add(m[1]);
	}
	const own = declaredNames(code);
	// An import clause names a module's exports, not globals: `import { nth } from "./x"`.
	const body = code.replace(RE_IMPORT_CLAUSE, " ");
	for (const m of body.matchAll(patternsFor(globals).other)) {
		if (!own.has(m[1])) acc.globals.add(m[1]);
	}
}

function scanScript(src, acc, depth, globals) {
	const { code, strings } = lex(src);
	scanCode(code, acc, globals);
	if (depth >= MAX_DEPTH) return;
	const { mentions } = patternsFor(globals);
	for (const s of strings) {
		if (!mentions.test(s)) continue;
		if (RE_DOTTED_ONLY.test(s)) continue;
		if (!isJavaScript(s)) continue;
		scanScript(s, acc, depth + 1, globals);
	}
}

/**
 * The `frappe.*` paths and other desk globals a file uses.
 *
 * @param {string} src file contents
 * @param {{ vue?: boolean, globals?: readonly string[] }} [opts] `vue: true` for
 *   a single-file component; `globals`, the bare names to look for (default
 *   DEFAULT_GLOBALS; audit-consumer.mjs passes the list read off a frappe
 *   checkout when it has one)
 * @returns {{ paths: Set<string>, globals: Set<string> }}
 */
export function scanSource(src, { vue = false, globals = DEFAULT_GLOBALS } = {}) {
	const acc = { paths: new Set(), globals: new Set() };
	if (!vue) {
		scanScript(src, acc, 0, globals);
		return acc;
	}
	const rest = src.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (_, body) => {
		scanScript(body, acc, 0, globals);
		return "";
	});
	scanCode(rest.replace(/<!--[\s\S]*?-->/g, ""), acc, globals);
	return acc;
}

// ------------------------------------------------------------ frappe's window

const RE_WINDOW_ASSIGN = new RegExp(`(?:^|[^\\w.$])window\\.(${IDENT})\\s*=(?![=>])`, "g");
const RE_WINDOW_OBJECT_ASSIGN = /\bObject\.assign\(\s*window\s*,\s*\{/g;

/**
 * The names a piece of frappe source assigns to `window`: `window.x = …` and
 * the keys of `Object.assign(window, { … })`. Comments and strings are
 * ignored (`lex`), so a commented-out assignment does not count.
 *
 * @param {string} src
 * @returns {Set<string>}
 */
export function windowGlobalsIn(src) {
	const { code } = lex(src);
	const out = new Set();
	for (const m of code.matchAll(RE_WINDOW_ASSIGN)) out.add(m[1]);
	for (const m of code.matchAll(RE_WINDOW_OBJECT_ASSIGN)) {
		// Walk to the matching `}` and read the top-level keys of the literal.
		let depth = 1;
		let i = m.index + m[0].length;
		let key = "";
		let expectKey = true;
		for (; i < code.length && depth > 0; i++) {
			const c = code[i];
			if (c === "{" || c === "(" || c === "[") {
				depth++;
				expectKey = false;
				continue;
			}
			if (c === "}" || c === ")" || c === "]") {
				depth--;
				continue;
			}
			if (depth !== 1) continue;
			if (c === ",") {
				if (key) out.add(key);
				key = "";
				expectKey = true;
				continue;
			}
			if (!expectKey) continue;
			if (/[\w$]/.test(c)) {
				key += c;
				continue;
			}
			if (/\s/.test(c)) continue;
			// `:` or `(` ends the key: `a: 1` and `a() {}` still name `a`.
			if (key) out.add(key);
			key = "";
			expectKey = false;
		}
		if (key) out.add(key);
	}
	return out;
}

/**
 * Every name frappe assigns to `window`, read from its source: each
 * `.js` / `.vue` file under `frappe/public/js` outside `node_modules`.
 *
 * @param {string} frappePath a frappe checkout (the repo root, holding frappe/public/js)
 * @returns {Promise<Map<string, string[]>>} name → the files that assign it, sorted by name
 */
export async function frappeWindowGlobals(frappePath) {
	const root = path.join(frappePath, "frappe", "public", "js");
	/** @type {Map<string, string[]>} */
	const found = new Map();
	for await (const entry of glob("**/*.{js,vue}", { cwd: root, exclude: (name) => name === "node_modules" })) {
		let src;
		try {
			src = await readFile(path.join(root, entry), "utf8");
		} catch {
			continue;
		}
		if (!src.includes("window")) continue;
		const rel = path.posix.join("frappe/public/js", entry.split(path.sep).join("/"));
		for (const name of windowGlobalsIn(src)) {
			const list = found.get(name) ?? [];
			if (!list.includes(rel)) list.push(rel);
			found.set(name, list);
		}
	}
	return new Map([...found.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

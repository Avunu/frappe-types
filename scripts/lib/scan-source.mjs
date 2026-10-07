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

import vm from "node:vm";

const IDENT = "[A-Za-z_$][A-Za-z0-9_$]*";

/** Desk globals other than `frappe`, probed as bare identifiers. */
export const OTHER_GLOBALS = ["__", "locals", "cur_frm", "cur_list", "cur_dialog", "cur_page", "erpnext"];

const RE_FRAPPE = new RegExp(`(?:^|[^\\w.$])(frappe(?:\\.${IDENT})+)`, "g");
const RE_OTHER = new RegExp(`(?:^|[^\\w.$])(${OTHER_GLOBALS.join("|")})(?![\\w$])`, "g");
const RE_DOTTED_ONLY = new RegExp(`^\\s*frappe(?:\\.${IDENT})+\\s*$`);
const RE_MENTIONS = new RegExp(`(?:^|[^\\w.$])(?:frappe\\.|(?:${OTHER_GLOBALS.join("|")})(?![\\w$]))`);

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

function scanCode(code, acc) {
	for (const m of code.matchAll(RE_FRAPPE)) {
		if (/\.\d/.test(m[1])) continue;
		acc.paths.add(m[1]);
	}
	for (const m of code.matchAll(RE_OTHER)) acc.globals.add(m[1]);
}

function scanScript(src, acc, depth) {
	const { code, strings } = lex(src);
	scanCode(code, acc);
	if (depth >= MAX_DEPTH) return;
	for (const s of strings) {
		if (!RE_MENTIONS.test(s)) continue;
		if (RE_DOTTED_ONLY.test(s)) continue;
		if (!isJavaScript(s)) continue;
		scanScript(s, acc, depth + 1);
	}
}

/**
 * The `frappe.*` paths and other desk globals a file uses.
 *
 * @param {string} src file contents
 * @param {{ vue?: boolean }} [opts] `vue: true` for a single-file component
 * @returns {{ paths: Set<string>, globals: Set<string> }}
 */
export function scanSource(src, { vue = false } = {}) {
	const acc = { paths: new Set(), globals: new Set() };
	if (!vue) {
		scanScript(src, acc, 0);
		return acc;
	}
	const rest = src.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (_, body) => {
		scanScript(body, acc, 0);
		return "";
	});
	scanCode(rest.replace(/<!--[\s\S]*?-->/g, ""), acc);
	return acc;
}

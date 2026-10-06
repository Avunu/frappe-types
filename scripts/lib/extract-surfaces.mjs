// A deterministic JSON "surface snapshot" of a frappe tree, and the diff between two.
//
// WHY THIS EXISTS. The typeset is verified against ONE frappe tag
// (package.json `frappe.verifiedAgainst`), and frappe's version-16 branch keeps moving.
// The only drift trigger used to be the weekly dependabot bump of flake input `frappe`,
// and the only check on it compared two version strings. Neither can see a change like
// the one between v16.33.1 and v16.50.0, where `desk.bundle.scss` stopped importing the
// octicons, FontAwesome and leaflet stylesheets (this audit's own report for that span
// lists them): an app that mirrors a bundle's import list has nothing telling it so,
// and no declaration in src/ changes either way.
//
// So this records the handful of places where frappe's contract with an app is
// STRUCTURAL rather than a function signature — which stylesheets a bundle imports,
// what the include hooks ship, which icon ids a sprite defines, which asset keys
// exist, which boot keys are assigned — by parsing the files, never by guessing.
// Everything here is derived from the tree it is handed; nothing is remembered.
//
// WHAT IT DOES NOT SEE. Direct `@import`s of the entry files only (not what
// `./desk/index` pulls in); `bootinfo` keys assigned in frappe/boot.py only (not by
// `boot_session` hooks, and not the dynamic ones — those are counted); and nothing at
// all about the shape of the desk JS API. It cannot tell you a declaration is still
// right. That is what re-reading the source is for.

import { createHash } from "node:crypto";
import { cmp } from "./frappe-reader.mjs";

/** Bumped when the snapshot's shape changes, so an old baseline is recognised as old. */
export const SNAPSHOT_SCHEMA = 1;

const HOOKS_FILE = "frappe/hooks.py";
const BOOT_FILE = "frappe/boot.py";
const INIT_FILE = "frappe/__init__.py";
const UTILS_FILE = "frappe/public/js/frappe/utils/utils.js";

/**
 * The hooks that decide what a desk or website page loads. Fixed order: it is the
 * order they appear in the snapshot and in reports.
 */
export const INCLUDE_HOOKS = [
	"app_include_js",
	"app_include_css",
	"app_include_icons",
	"web_include_js",
	"web_include_css",
	"web_include_icons",
	"email_css",
];

/** Directories whose presence says whether frappe still ships the old icon fonts. */
const ICON_FONT_DIRS = ["frappe/public/css/octicons", "frappe/public/css/fonts/fontawesome"];

/** An `@import` target that is an icon-font stylesheet. */
const ICON_FONT_STYLESHEET = /font-?awesome|octicons/i;

// --------------------------------------------------------------------------- lists

/**
 * Added and removed members, each in the order they appear in the list they came from.
 * @param {readonly string[]} before
 * @param {readonly string[]} after
 * @returns {{ added: string[], removed: string[] }}
 */
export function diffSets(before, after) {
	const was = new Set(before);
	const is = new Set(after);
	return {
		added: [...new Set(after)].filter((x) => !was.has(x)),
		removed: [...new Set(before)].filter((x) => !is.has(x)),
	};
}

/**
 * `diffSets` plus whether the members both lists share changed ORDER. For a stylesheet
 * list that is a real change — cascade order is source order — even when nothing was
 * added or removed.
 * @param {readonly string[]} before
 * @param {readonly string[]} after
 * @returns {{ added: string[], removed: string[], reordered: boolean }}
 */
export function diffLists(before, after) {
	const { added, removed } = diffSets(before, after);
	const was = new Set(before);
	const is = new Set(after);
	const keptBefore = before.filter((x) => is.has(x));
	const keptAfter = after.filter((x) => was.has(x));
	const reordered = keptBefore.length !== keptAfter.length || keptBefore.some((x, i) => x !== keptAfter[i]);
	return { added, removed, reordered };
}

// --------------------------------------------------------------------------- scss

/**
 * Remove `/* *\/` and `//` comments, leaving string literals and unquoted `url()`s
 * alone — `//` inside `"https://…"` or `url(https://…)` is not a comment, and Sass
 * agrees.
 * @param {string} src
 * @returns {string}
 */
export function stripScssComments(src) {
	const unquotedUrl = /url\(\s*[^"'\s)][^)]*\)/iy;
	let out = "";
	let i = 0;
	while (i < src.length) {
		const c = src.charAt(i);
		const next = src.charAt(i + 1);
		if (c === '"' || c === "'") {
			let j = i + 1;
			while (j < src.length && src.charAt(j) !== c && src.charAt(j) !== "\n") j += src.charAt(j) === "\\" ? 2 : 1;
			out += src.slice(i, j + 1);
			i = j + 1;
		} else if ((c === "u" || c === "U") && ((unquotedUrl.lastIndex = i), unquotedUrl.test(src))) {
			out += src.slice(i, unquotedUrl.lastIndex);
			i = unquotedUrl.lastIndex;
		} else if (c === "/" && next === "*") {
			const end = src.indexOf("*/", i + 2);
			out += " ";
			i = end === -1 ? src.length : end + 2;
		} else if (c === "/" && next === "/") {
			while (i < src.length && src.charAt(i) !== "\n") i++;
		} else {
			out += c;
			i++;
		}
	}
	return out;
}

/**
 * The ordered `@import` targets of a Sass/SCSS file. `@import "a", "b";` yields both;
 * `url(x.css)` yields `x.css`. `@use` / `@forward` are not `@import`s, but a bundle
 * migrating to them would otherwise read as "all imports removed" — so they are kept
 * in the same list, spelled `@use <target>` / `@forward <target>`.
 * @param {string} src
 * @returns {string[]}
 */
export function parseScssImports(src) {
	const clean = stripScssComments(src);
	/** @type {string[]} */
	const out = [];
	// Only at the start of a statement: `content: "@import 'x'"` is a string, not an import.
	for (const statement of clean.matchAll(/(?:^|[;{}])\s*@(import|use|forward)\b([^;{}]*)/gm)) {
		const directive = statement[1];
		const targets = [...(statement[2] ?? "").matchAll(/(["'])((?:\\.|(?!\1)[^\\])*)\1|url\(\s*([^)\s]+)\s*\)/gi)].map(
			(m) => m[2] ?? (m[3] ?? "").replace(/^["']|["']$/g, ""),
		);
		if (directive === "import") out.push(...targets);
		else if (targets[0] !== undefined) out.push(`@${directive} ${targets[0]}`);
	}
	return out;
}

// --------------------------------------------------------------------------- python

/**
 * @typedef {object} PyToken
 * @property {"name" | "string" | "number" | "op"} kind
 * @property {string} value identifier / operator text; for a string, its decoded contents
 * @property {string} prefix a string's prefix letters, lowercased ("" otherwise)
 * @property {number} line 1-based
 * @property {number} col 0-based column of the token's first character
 * @property {number} depth bracket depth BEFORE this token
 * @property {boolean} bol first token of a logical line (so: a statement start)
 */

const PY_OPERATORS = [
	"**=", "//=", ">>=", "<<=", "...",
	"==", "!=", "<=", ">=", "+=", "-=", "*=", "/=", "%=", "|=", "&=", "^=", "@=", ":=", "->", "**", "//", "<<", ">>",
];
const PY_ESCAPES = new Map([
	["n", "\n"],
	["t", "\t"],
	["r", "\r"],
	["\\", "\\"],
	["'", "'"],
	['"', '"'],
]);

/**
 * A just-enough lexer for frappe's `hooks.py` and `boot.py`: names, strings (all quote
 * forms and string prefixes), numbers, operators, comments. It exists because the
 * alternatives are both wrong in ways that matter here — a regex over the whole file
 * reads a `# app_include_js = …` comment or a docstring as an assignment, and shelling
 * out to python is not available in nix's node-only checks.
 *
 * Limits, all irrelevant to these two files: no f-string interpolation (an `f"…"` is
 * one string token), and `\x`, `\u` and octal escapes are left verbatim.
 * @param {string} src
 * @returns {PyToken[]}
 */
export function tokenizePython(src) {
	/** @type {PyToken[]} */
	const tokens = [];
	let i = 0;
	let line = 1;
	let lineStart = 0;
	let depth = 0;
	let atLineStart = true;

	/** @param {PyToken["kind"]} kind @param {string} value @param {number} start @param {string} [prefix] */
	const push = (kind, value, start, prefix = "") => {
		tokens.push({ kind, value, prefix, line, col: start - lineStart, depth, bol: atLineStart });
		atLineStart = false;
	};

	while (i < src.length) {
		const c = src.charAt(i);
		if (c === "\n") {
			line++;
			i++;
			lineStart = i;
			if (depth === 0) atLineStart = true;
		} else if (c === " " || c === "\t" || c === "\r" || c === "\f") {
			i++;
		} else if (c === "#") {
			while (i < src.length && src.charAt(i) !== "\n") i++;
		} else if (c === "\\" && src.charAt(i + 1) === "\n") {
			// An explicit line continuation: the next physical line is the same statement.
			i += 2;
			line++;
			lineStart = i;
		} else if (/[A-Za-z_\u0080-￿]/.test(c)) {
			let j = i;
			while (j < src.length && /[\w\u0080-￿]/.test(src.charAt(j))) j++;
			const word = src.slice(i, j);
			const quote = src.charAt(j);
			if ((quote === '"' || quote === "'") && /^(?:[rbuf]|rb|br|rf|fr)$/i.test(word)) {
				i = readString(j, word.toLowerCase(), i);
			} else {
				push("name", word, i);
				i = j;
			}
		} else if (c === '"' || c === "'") {
			i = readString(i, "", i);
		} else if (/[0-9]/.test(c)) {
			let j = i;
			while (j < src.length && /[\w.]/.test(src.charAt(j))) j++;
			push("number", src.slice(i, j), i);
			i = j;
		} else {
			const op = PY_OPERATORS.find((o) => src.startsWith(o, i)) ?? c;
			push("op", op, i);
			if (op === "(" || op === "[" || op === "{") depth++;
			else if ((op === ")" || op === "]" || op === "}") && depth > 0) depth--;
			i += op.length;
		}
	}

	/**
	 * Consume the string literal whose opening quote is at `at`; returns the index just
	 * past it. `start` is where its prefix began (the token's column).
	 * @param {number} at @param {string} prefix @param {number} start
	 */
	function readString(at, prefix, start) {
		const quote = src.charAt(at);
		const triple = src.startsWith(quote.repeat(3), at);
		const open = triple ? 3 : 1;
		const startLine = line;
		let j = at + open;
		let body = "";
		for (;;) {
			if (j >= src.length) throw new Error(`unterminated string starting at line ${startLine}`);
			const ch = src.charAt(j);
			if (ch === "\\") {
				body += ch + src.charAt(j + 1);
				j += 2;
			} else if (triple ? src.startsWith(quote.repeat(3), j) : ch === quote) {
				break;
			} else if (ch === "\n" && !triple) {
				throw new Error(`unterminated string starting at line ${startLine}`);
			} else {
				body += ch;
				j++;
			}
		}
		const value = prefix.includes("r") ? body : body.replace(/\\(.)/gs, (m, e) => PY_ESCAPES.get(e) ?? m);
		// Position the token where it STARTED; then account for the newlines it spans.
		push("string", value, start, prefix);
		for (const ch of src.slice(at, j + open)) {
			if (ch === "\n") line++;
		}
		const lastNewline = src.lastIndexOf("\n", j + open - 1);
		if (lastNewline >= at) lineStart = lastNewline + 1;
		return j + open;
	}

	return tokens;
}

/**
 * Group tokens into logical lines: each starts at a `bol` token. Does not split on
 * `;` — neither file uses it to join statements.
 * @param {PyToken[]} tokens
 * @returns {PyToken[][]}
 */
export function splitStatements(tokens) {
	/** @type {PyToken[][]} */
	const out = [];
	for (const token of tokens) {
		const current = out[out.length - 1];
		if (token.bol || !current) out.push([token]);
		else current.push(token);
	}
	return out;
}

/**
 * The string-literal values of the named top-level list assignments in a python file.
 *
 * Reads exactly what frappe writes — `name = [ "a", "b", ]`, tab-indented and
 * multi-line, or a one-line list, or a bare string (which `frappe.get_hooks` treats as a
 * one-element list) — and THROWS on anything else, rather than skipping it. A hook
 * that is `+=`-extended or built from a variable would otherwise leave the snapshot
 * quietly short, which is the failure this audit exists to prevent.
 * Names that are not assigned are simply absent from the result; the last assignment
 * wins, as in python.
 * @param {string} src
 * @param {readonly string[]} names
 * @returns {Record<string, string[]>}
 */
export function parseHookLists(src, names) {
	const wanted = new Set(names);
	/** @type {Record<string, string[]>} */
	const found = {};
	for (const statement of splitStatements(tokenizePython(src))) {
		const [head, assign, ...value] = statement;
		if (!head || head.kind !== "name" || head.col !== 0 || !wanted.has(head.value)) continue;
		const where = `${head.value} (line ${head.line})`;
		if (assign?.kind !== "op" || assign.value !== "=") {
			throw new Error(`${where} is modified with "${assign?.value ?? "?"}", not assigned; parseHookLists reads plain assignments only`);
		}
		found[head.value] = stringList(value, where);
	}
	return found;
}

/**
 * @param {PyToken[]} tokens the right-hand side
 * @param {string} where for the error message
 * @returns {string[]}
 */
function stringList(tokens, where) {
	/** @param {PyToken | undefined} t */
	const isPlainString = (t) => t?.kind === "string" && !/[bf]/.test(t.prefix);
	/**
	 * One list element: one or more ADJACENT string literals, which python concatenates.
	 * @param {number} at
	 * @returns {{ value: string, next: number }}
	 */
	const element = (at) => {
		let value = "";
		let next = at;
		for (let t = tokens[next]; isPlainString(t); t = tokens[next]) {
			value += t?.value ?? "";
			next++;
		}
		if (next === at) {
			const t = tokens[at];
			throw new Error(`${where}: expected a string literal, found ${t ? `${t.kind} \`${t.value}\` at line ${t.line}` : "end of statement"}`);
		}
		return { value, next };
	};

	const first = tokens[0];
	if (first?.kind === "string") {
		const { value, next } = element(0);
		if (next !== tokens.length) throw new Error(`${where}: trailing tokens after the string`);
		return [value];
	}
	if (first?.kind !== "op" || first.value !== "[") {
		throw new Error(`${where}: expected a list or string literal, found ${first ? `${first.kind} \`${first.value}\`` : "nothing"}`);
	}
	/** @type {string[]} */
	const out = [];
	let at = 1;
	while (tokens[at]?.value !== "]" || tokens[at]?.kind !== "op") {
		const { value, next } = element(at);
		out.push(value);
		at = next;
		if (tokens[at]?.kind === "op" && tokens[at]?.value === ",") at++;
		else if (!(tokens[at]?.kind === "op" && tokens[at]?.value === "]")) {
			throw new Error(`${where}: expected "," or "]" after \`${value}\``);
		}
	}
	if (at + 1 !== tokens.length) throw new Error(`${where}: tokens after the closing "]" (list arithmetic is not supported)`);
	return out;
}

/**
 * The keys frappe/boot.py assigns on the boot payload, plus a count of the assignments
 * and bulk updates whose key it cannot know.
 *
 *   bootinfo.sitename = …             -> "sitename"
 *   bootinfo["lang"] = …              -> "lang"
 *   bootinfo.a, bootinfo.b = f(…)     -> "a" and "b"   (tuple unpacking)
 *   bootinfo[key] = …                 -> counted in `dynamic`
 *   bootinfo.update(…)                -> counted in `bulk`
 *
 * Not a key: `bootinfo.sysdefaults["x"] = …` (assigns inside `sysdefaults`),
 * comparisons, augmented assignment, and anything in a comment or string. Parenthesised
 * unpacking targets, `(bootinfo.a, bootinfo.b) = …`, are not recognised.
 * @param {string} src
 * @param {string} [receiver]
 * @returns {{ keys: string[], dynamic: number, bulk: number }}
 */
export function parseBootKeys(src, receiver = "bootinfo") {
	/** @type {Set<string>} */
	const keys = new Set();
	let dynamic = 0;
	let bulk = 0;
	for (const statement of splitStatements(tokenizePython(src))) {
		/** @param {number} i @param {string} kind @param {string} [value] */
		const is = (i, kind, value) => statement[i]?.kind === kind && (value === undefined || statement[i]?.value === value);
		/**
		 * True where `receiver` starts an expression rather than being an attribute of something else.
		 * @param {number} i
		 */
		const isReceiver = (i) => is(i, "name", receiver) && !is(i - 1, "op", ".");

		for (let i = 0; i < statement.length; i++) {
			if (isReceiver(i) && is(i + 1, "op", ".") && is(i + 2, "name", "update") && is(i + 3, "op", "(")) bulk++;
		}

		// Everything left of the LAST depth-0 `=` is an assignment target (`a = b = v`).
		let lastEquals = -1;
		statement.forEach((t, i) => {
			if (t.kind === "op" && t.value === "=" && t.depth === 0) lastEquals = i;
		});
		const targets = statement.slice(0, Math.max(lastEquals, 0));
		const end = targets.length;
		/** @param {number} i */
		const endsTarget = (i) => i >= end || (targets[i]?.kind === "op" && (targets[i]?.value === "," || targets[i]?.value === "="));

		for (let i = 0; i < end; i++) {
			const t = targets[i];
			if (!t || t.kind !== "name" || t.value !== receiver || (targets[i - 1]?.kind === "op" && targets[i - 1]?.value === ".")) continue;
			const next = targets[i + 1];
			if (next?.kind === "op" && next.value === "." && targets[i + 2]?.kind === "name" && endsTarget(i + 3)) {
				keys.add(targets[i + 2]?.value ?? "");
			} else if (next?.kind === "op" && next.value === "[") {
				// The matching `]` is the first one at the depth just inside this `[`.
				const close = targets.findIndex((x, j) => j > i + 1 && x.kind === "op" && x.value === "]" && x.depth === next.depth + 1);
				if (close === -1 || !endsTarget(close + 1)) continue;
				const inner = targets.slice(i + 2, close);
				const only = inner[0];
				if (inner.length === 1 && only?.kind === "string") keys.add(only.value);
				else dynamic++;
			}
		}
	}
	return { keys: [...keys].sort(cmp), dynamic, bulk };
}

// --------------------------------------------------------------------------- sprites

/**
 * The ids of the `<symbol>` elements in an SVG sprite, in document order. A symbol is
 * what `<use href="#id">` can reference, so one with no id is not part of the sprite's
 * contract and is skipped. Comments and `<style>` blocks are removed first — the
 * module-icons sprite carries a stylesheet, and a commented-out symbol is not one.
 * @param {string} svg
 * @returns {string[]}
 */
export function parseSpriteIds(svg) {
	const markup = svg.replace(/<!--[\s\S]*?-->/g, "").replace(/<style\b[\s\S]*?<\/style>/gi, "");
	/** @type {string[]} */
	const ids = [];
	for (const tag of markup.matchAll(/<symbol\b((?:[^>"']|"[^"]*"|'[^']*')*)>/g)) {
		const id = /(?:^|\s)id\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(tag[1] ?? "");
		const value = id?.[1] ?? id?.[2];
		if (value !== undefined) ids.push(value);
	}
	return ids;
}

/**
 * Id families seen in frappe's sprites. Longest-first matching is not needed (none is a
 * prefix of another); anything else falls back to its first segment in `idPrefix`, so a
 * NEW family shows up in the histogram under its own key instead of vanishing into a
 * catch-all.
 * Observed at v16.33.1 and v16.50.0: lucide/timeless use `icon-`; espresso uses
 * `es-line-`, `es-solid-`, `es-small-` plus a few irregular ids (`es-lock`,
 * `icon/at-sign`, …); desktop_icons/alphabets.svg uses bare single letters.
 */
const ID_FAMILIES = ["es-line-", "es-solid-", "es-small-", "icon-"];

/**
 * @param {string} id
 * @returns {string} the family prefix, or `(bare)` for an id with no `-` or `/`
 */
export function idPrefix(id) {
	for (const family of ID_FAMILIES) if (id.startsWith(family)) return family;
	const separator = id.search(/[-/]/);
	return separator === -1 ? "(bare)" : id.slice(0, separator + 1);
}

/**
 * @typedef {object} SpriteSummary
 * @property {number} symbols `<symbol>` elements that have an id
 * @property {number} distinct how many of those ids are distinct (fewer: duplicates)
 * @property {Record<string, number>} prefixes histogram of `idPrefix` over the distinct ids
 * @property {string} idsSha256 sha256 of the sorted distinct ids joined by "\n"
 * @property {string[]} [ids] the sorted distinct ids — only when asked for, it is large
 */

/**
 * @param {readonly string[]} ids as returned by `parseSpriteIds`
 * @param {{ withIds?: boolean }} [options]
 * @returns {SpriteSummary}
 */
export function summarizeSprite(ids, { withIds = false } = {}) {
	const distinct = [...new Set(ids)].sort(cmp);
	/** @type {Map<string, number>} */
	const counts = new Map();
	for (const id of distinct) counts.set(idPrefix(id), (counts.get(idPrefix(id)) ?? 0) + 1);
	/** @type {SpriteSummary} */
	const summary = {
		symbols: ids.length,
		distinct: distinct.length,
		prefixes: Object.fromEntries([...counts].sort(([a], [b]) => cmp(a, b))),
		idsSha256: createHash("sha256").update(distinct.join("\n")).digest("hex"),
	};
	if (withIds) summary.ids = distinct;
	return summary;
}

/**
 * `/assets/frappe/icons/lucide/icons.svg` -> `frappe/public/icons/lucide/icons.svg`.
 * Frappe serves `frappe/public/` at `/assets/frappe/`; an entry for another app (or an
 * absolute URL) has no file in this tree and returns null.
 * @param {string} url
 * @returns {string | null}
 */
export function spriteUrlToPath(url) {
	const m = /^\/?assets\/frappe\/(.+)$/.exec(url);
	return m?.[1] === undefined ? null : `frappe/public/${m[1]}`;
}

// --------------------------------------------------------------------------- js

/**
 * The signature of a method DEFINED as `name(…) {` (or `name: function(…) {`) in a JS
 * file, whitespace-collapsed to one line, found by scanning for its head — never by
 * line number, which moves whenever anything above it does. A call such as `icon(x);`
 * is not a definition (no `{` after the parens) and is skipped.
 *
 * The first definition wins. `frappe.utils` defines `icon` and `desktop_icon` once each
 * (checked at v16.33.1 and v16.50.0); a second definition elsewhere in the file would
 * be silently ignored.
 *
 * Collapsing is the one liberty taken with "verbatim": `icon(` is declared over several
 * lines, one parameter each (at v16.33.1 and at v16.50.0), and a snapshot value has to
 * be diffable as a single string.
 * @param {string} src
 * @param {string} name a plain identifier
 * @returns {string | null}
 */
export function findMethodSignature(src, name) {
	if (!/^[A-Za-z_$][\w$]*$/.test(name)) throw new Error(`not an identifier: ${name}`);
	const head = new RegExp(`^[ \\t]*(${name}[ \\t]*(?::[ \\t]*(?:async[ \\t]+)?function[ \\t]*)?)\\(`, "gm");
	for (const match of src.matchAll(head)) {
		const start = match.index + match[0].length - match[0].trimStart().length;
		const open = match.index + match[0].length - 1;
		let depth = 0;
		let quote = "";
		let close = -1;
		for (let i = open; i < src.length; i++) {
			const c = src.charAt(i);
			if (quote) {
				if (c === "\\") i++;
				else if (c === quote) quote = "";
			} else if (c === '"' || c === "'" || c === "`") quote = c;
			else if (c === "(") depth++;
			else if (c === ")" && --depth === 0) {
				close = i;
				break;
			}
		}
		if (close === -1) continue;
		const brace = /^\s*\{/.exec(src.slice(close + 1));
		if (!brace) continue;
		return src
			.slice(start, close + 1 + brace[0].length)
			.replace(/\s+/g, " ")
			.replace(/\( /g, "(")
			.replace(/ \)/g, ")");
	}
	return null;
}

// --------------------------------------------------------------------------- snapshot

/**
 * @typedef {object} Snapshot
 * @property {number} schema
 * @property {string | null} version `__version__` from frappe/__init__.py
 * @property {{ bundles: Record<string, string[]> }} scss `frappe/public/scss/*.bundle.scss` -> its ordered imports
 * @property {{ includes: Record<string, string[]> }} hooks the include hooks that frappe/hooks.py assigns
 * @property {IconSurface} icons
 * @property {string[]} bundles every `*.bundle.{js,ts,scss,css}` entry file under frappe/public
 * @property {{ keys: string[], dynamic: number, bulk: number }} boot
 */

/**
 * @typedef {object} IconSurface
 * @property {Record<string, SpriteSummary | null>} sprites each sprite the icon hooks list (null: listed but absent)
 * @property {string[]} unresolved icon hook entries that do not point into frappe/public
 * @property {Record<string, boolean>} directories whether the icon-font directories exist
 * @property {string[]} fontStylesheetImports `<bundle>: <target>` for each bundle still importing one
 * @property {{ icon: string | null, desktop_icon: string | null }} helpers frappe.utils signatures
 */

/**
 * @param {import("./frappe-reader.mjs").FrappeReader} reader
 * @param {string} rel
 * @returns {Promise<string>}
 */
async function requireText(reader, rel) {
	const text = await reader.readText(rel);
	if (text === null) throw new Error(`${rel} not found in ${reader.label} — is this a frappe checkout?`);
	return text;
}

/**
 * Snapshot a frappe tree. Everything is read through `reader`, so the same code
 * serves a plain directory and any git ref.
 * @param {import("./frappe-reader.mjs").FrappeReader} reader
 * @param {{ ids?: boolean }} [options] `ids`: include every sprite's id list
 * @returns {Promise<Snapshot>}
 */
export async function takeSnapshot(reader, { ids = false } = {}) {
	const publicFiles = await reader.listFiles("frappe/public");

	/** @type {Record<string, string[]>} */
	const bundles = {};
	for (const file of publicFiles.filter((f) => /^frappe\/public\/scss\/[^/]+\.bundle\.scss$/.test(f))) {
		bundles[file] = parseScssImports(await requireText(reader, file));
	}

	const hookLists = parseHookLists(await requireText(reader, HOOKS_FILE), INCLUDE_HOOKS);
	/** @type {Record<string, string[]>} */
	const includes = {};
	for (const name of INCLUDE_HOOKS) {
		const list = hookLists[name];
		if (list) includes[name] = list;
	}

	// Sprites are whatever the icon hooks LIST, resolved to files — not a directory scan,
	// so a stray .svg under icons/ is not mistaken for something frappe loads.
	const spriteUrls = [...new Set([...(includes.app_include_icons ?? []), ...(includes.web_include_icons ?? [])])];
	/** @type {Record<string, SpriteSummary | null>} */
	const sprites = {};
	/** @type {string[]} */
	const unresolved = [];
	for (const url of spriteUrls) {
		const file = spriteUrlToPath(url);
		if (file === null) {
			unresolved.push(url);
			continue;
		}
		const svg = await reader.readText(file);
		sprites[file] = svg === null ? null : summarizeSprite(parseSpriteIds(svg), { withIds: ids });
	}

	/** @type {Record<string, boolean>} */
	const directories = {};
	for (const dir of ICON_FONT_DIRS) directories[dir] = (await reader.kindOf(dir)) === "dir";

	const fontStylesheetImports = Object.entries(bundles)
		.flatMap(([bundle, imports]) => imports.filter((t) => ICON_FONT_STYLESHEET.test(t)).map((t) => `${bundle}: ${t}`))
		.sort(cmp);

	const utils = (await reader.readText(UTILS_FILE)) ?? "";
	const init = await reader.readText(INIT_FILE);

	return {
		schema: SNAPSHOT_SCHEMA,
		version: init?.match(/__version__\s*=\s*["']([^"']+)["']/)?.[1] ?? null,
		scss: { bundles },
		hooks: { includes },
		icons: {
			sprites,
			unresolved: unresolved.sort(cmp),
			directories,
			fontStylesheetImports,
			helpers: { icon: findMethodSignature(utils, "icon"), desktop_icon: findMethodSignature(utils, "desktop_icon") },
		},
		bundles: publicFiles.filter((f) => /\.bundle\.(?:js|ts|scss|css)$/.test(f)).sort(cmp),
		boot: parseBootKeys(await requireText(reader, BOOT_FILE)),
	};
}

// --------------------------------------------------------------------------- diff

/**
 * One thing that changed between two snapshots. Either a list (members added/removed,
 * possibly reordered) or a set of scalar fields (before -> after).
 * @typedef {{ surface: string, subject: string, kind: "list", added: string[], removed: string[], reordered: boolean }
 *   | { surface: string, subject: string, kind: "fields", fields: { name: string, before: string | number | boolean | null, after: string | number | boolean | null }[] }
 * } Change
 */

/**
 * @param {Change[]} out
 * @param {string} surface
 * @param {string} subject
 * @param {readonly string[]} before
 * @param {readonly string[]} after
 */
function pushListChange(out, surface, subject, before, after) {
	const { added, removed, reordered } = diffLists(before, after);
	if (added.length || removed.length || reordered) out.push({ surface, subject, kind: "list", added, removed, reordered });
}

/**
 * @param {Change[]} out
 * @param {string} surface
 * @param {string} subject
 * @param {Record<string, string | number | boolean | null | undefined>} before
 * @param {Record<string, string | number | boolean | null | undefined>} after
 */
function pushFieldChange(out, surface, subject, before, after) {
	const names = [...new Set([...Object.keys(before), ...Object.keys(after)])];
	const fields = names
		.filter((name) => before[name] !== after[name])
		.map((name) => ({ name, before: before[name] ?? null, after: after[name] ?? null }));
	if (fields.length) out.push({ surface, subject, kind: "fields", fields });
}

/**
 * @param {Snapshot} snapshot
 * @param {string} sprite
 * @returns {"present" | "missing" | null} null: the icon hooks do not list it
 */
function spriteStatus(snapshot, sprite) {
	if (!(sprite in snapshot.icons.sprites)) return null;
	return snapshot.icons.sprites[sprite] ? "present" : "missing";
}

/**
 * A sprite summary as flat scalar fields, ready for `pushFieldChange`.
 * @param {SpriteSummary | null | undefined} s
 * @returns {Record<string, string | number | null>}
 */
function spriteFields(s) {
	if (!s) return {};
	return {
		symbols: s.symbols,
		distinct: s.distinct,
		idsSha256: s.idsSha256,
		...Object.fromEntries(Object.entries(s.prefixes).map(([prefix, n]) => [`prefix ${prefix}`, n])),
	};
}

/**
 * Everything that differs between two snapshots, in a fixed order. `version` is
 * deliberately NOT a change: it is what the two snapshots are labelled with, and a
 * release that moves only the version string is not drift in any surface.
 * @param {Snapshot} base
 * @param {Snapshot} head
 * @returns {Change[]}
 */
export function diffSnapshots(base, head) {
	/** @type {Change[]} */
	const out = [];

	// scss.bundles: the set of entry files, then each bundle's import list (a bundle that
	// exists on only one side counts as having no imports on the other).
	pushListChange(out, "scss", "frappe/public/scss/*.bundle.scss", Object.keys(base.scss.bundles), Object.keys(head.scss.bundles));
	for (const bundle of [...new Set([...Object.keys(base.scss.bundles), ...Object.keys(head.scss.bundles)])].sort(cmp)) {
		pushListChange(out, "scss", bundle, base.scss.bundles[bundle] ?? [], head.scss.bundles[bundle] ?? []);
	}

	// hooks.includes
	for (const name of INCLUDE_HOOKS) {
		pushListChange(out, "hooks", name, base.hooks.includes[name] ?? [], head.hooks.includes[name] ?? []);
	}

	// icons
	const sprites = [...new Set([...Object.keys(base.icons.sprites), ...Object.keys(head.icons.sprites)])].sort(cmp);
	for (const sprite of sprites) {
		const was = base.icons.sprites[sprite];
		const is = head.icons.sprites[sprite];
		pushFieldChange(
			out,
			"icons",
			sprite,
			{ listed: spriteStatus(base, sprite), ...spriteFields(was) },
			{ listed: spriteStatus(head, sprite), ...spriteFields(is) },
		);
		if (was?.ids && is?.ids) pushListChange(out, "icons", `${sprite} ids`, was.ids, is.ids);
	}
	pushListChange(out, "icons", "icon hook entries not under /assets/frappe/", base.icons.unresolved, head.icons.unresolved);
	for (const dir of ICON_FONT_DIRS) {
		pushFieldChange(out, "icons", dir, { exists: base.icons.directories[dir] ?? null }, { exists: head.icons.directories[dir] ?? null });
	}
	pushListChange(out, "icons", "@import of an icon-font stylesheet, as bundle: target", base.icons.fontStylesheetImports, head.icons.fontStylesheetImports);
	pushFieldChange(out, "icons", UTILS_FILE, base.icons.helpers, head.icons.helpers);

	// bundles
	pushListChange(out, "bundles", "frappe/public/**/*.bundle.{js,ts,scss,css}", base.bundles, head.bundles);

	// boot
	pushListChange(out, "boot", "frappe/boot.py: bootinfo.<key> =", base.boot.keys, head.boot.keys);
	pushFieldChange(out, "boot", "frappe/boot.py: bootinfo[<expr>] = and bootinfo.update(", { dynamic: base.boot.dynamic, bulk: base.boot.bulk }, { dynamic: head.boot.dynamic, bulk: head.boot.bulk });

	return out;
}

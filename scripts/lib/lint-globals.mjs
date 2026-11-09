// The bare globals each ambient entry declares, as a lint config's `globals`.
//
// An app that type-checks its desk scripts against `frappe-types/global` still
// lints them with oxlint or ESLint, and `no-undef` knows nothing of tsc's
// program: every app used to keep its own list of `frappe`, `__`, `cur_frm`, …
// in its lint config, each a different subset. `lint/desk-globals.json` and
// `lint/web-globals.json` ship that list, and this module derives it from the
// declarations themselves so it cannot drift from them:
//
//   - every `var` / `let` / `const` / `function` directly inside a
//     `declare global { … }` block of the entry file or of a file it pulls in
//     with `/// <reference path="…" />` (types such as `interface Window` and
//     the type-space `namespace frappe` are not runtime names and are skipped);
//   - the jQuery globals behind the entry's `/// <reference types="jquery" />`:
//     the `declare const … : JQueryStatic` of `@types/jquery` (`$`, `jQuery`).
//     Only those: the rest of that package's top-level values are its own
//     ES5 forward declarations (`Symbol`), not frappe's.
//
// Every name is `"readonly"`. Desk code reads these; the reassignable ones
// (`window.DataTable = …`) are reassigned through `window`, which `no-undef`
// does not look at.
//
//   node scripts/gen-lint-globals.mjs           (also: npm run gen:lint-globals)
//   node scripts/gen-lint-globals.mjs --check   exit 1 if lint/*.json is stale
//
// test/lint-globals.test.mjs runs the --check comparison, so `npm run test:unit`
// (and the flake's `unit` check) fails when a declaration changes and the JSON
// does not.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { lex } from "./scan-source.mjs";

const IDENT = "[A-Za-z_$][A-Za-z0-9_$]*";
const RE_REF_PATH = /^\/\/\/\s*<reference\s+path="([^"]+)"\s*\/>/gm;
const RE_REF_TYPES = /^\/\/\/\s*<reference\s+types="([^"]+)"\s*\/>/gm;
const RE_DECLARE_GLOBAL = /\bdeclare\s+global\s*\{/g;
const RE_VALUE = new RegExp(`^(?:var|let|const|function)\\s+(${IDENT})`);
const RE_JQUERY_STATIC = new RegExp(`\\bdeclare\\s+const\\s+(${IDENT})\\s*:\\s*JQueryStatic\\s*;`, "g");

/**
 * The ambient entries and the lint file each one becomes, relative to the
 * package root. Each entry's `exports` subpath is `frappe-types/<entry>`.
 */
export const LINT_GLOBALS_FILES = [
	{ entry: "src/global.d.ts", out: "lint/desk-globals.json" },
	{ entry: "src/web.d.ts", out: "lint/web-globals.json" },
];

/**
 * The value names declared directly inside the `declare global { … }` blocks
 * of a `.d.ts` source.
 * @param {string} src
 * @returns {Set<string>}
 */
export function declareGlobalValues(src) {
	const { code } = lex(src);
	const out = new Set();
	for (const m of code.matchAll(RE_DECLARE_GLOBAL)) {
		let depth = 1;
		let stmt = "";
		for (let i = m.index + m[0].length; i < code.length && depth > 0; i++) {
			const c = code[i];
			if (c === "{" || c === "(" || c === "[") depth++;
			else if (c === "}" || c === ")" || c === "]") depth--;
			if (depth === 1 && (c === ";" || c === "}" || c === "\n")) {
				const hit = RE_VALUE.exec(stmt.trim());
				if (hit) out.add(hit[1]);
				stmt = "";
			} else if (depth === 1) {
				stmt += c;
			}
		}
	}
	return out;
}

/**
 * The `/// <reference path>` and `/// <reference types>` directives of a source.
 * @param {string} src
 * @returns {{ paths: string[], types: string[] }}
 */
export function references(src) {
	return {
		paths: [...src.matchAll(RE_REF_PATH)].map((m) => m[1]),
		types: [...src.matchAll(RE_REF_TYPES)].map((m) => m[1]),
	};
}

/**
 * The `declare const X: JQueryStatic` names of a source.
 * @param {string} src
 * @returns {Set<string>}
 */
export function jqueryStaticValues(src) {
	return new Set([...lex(src).code.matchAll(RE_JQUERY_STATIC)].map((m) => m[1]));
}

/**
 * Every bare global the entry declares, following its reference paths.
 * @param {string} root the package root
 * @param {string} entry the entry file, relative to `root`
 * @returns {Promise<string[]>} sorted
 */
export async function entryGlobals(root, entry) {
	const names = new Set();
	const seen = new Set();
	const types = new Set();
	const walk = async (file) => {
		if (seen.has(file)) return;
		seen.add(file);
		const src = await readFile(file, "utf8");
		for (const n of declareGlobalValues(src)) names.add(n);
		const refs = references(src);
		for (const t of refs.types) types.add(t);
		for (const p of refs.paths) await walk(path.resolve(path.dirname(file), p));
	};
	await walk(path.resolve(root, entry));
	if (types.has("jquery")) {
		const dir = path.join(root, "node_modules", "@types", "jquery");
		const index = await readFile(path.join(dir, "index.d.ts"), "utf8");
		for (const p of references(index).paths) {
			for (const n of jqueryStaticValues(await readFile(path.join(dir, p), "utf8"))) names.add(n);
		}
	}
	return [...names].sort();
}

/**
 * The JSON text of one lint file: `{ "globals": { name: "readonly" } }`.
 * @param {string[]} names
 * @returns {string}
 */
export function lintGlobalsJson(names) {
	return `${JSON.stringify({ globals: Object.fromEntries(names.map((n) => [n, "readonly"])) }, null, "\t")}\n`;
}

// Unit tests for scripts/lib/lint-globals.mjs, and the check that keeps the
// shipped lint/*.json in step with the declarations.
//
//   npm run test:unit        (= node --test "test/*.test.mjs")

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	LINT_GLOBALS_FILES,
	declareGlobalValues,
	entryGlobals,
	jqueryStaticValues,
	lintGlobalsJson,
	references,
} from "../scripts/lib/lint-globals.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

test("declare global: values only, top level only, comments and strings ignored", () => {
	const src = `
import type { Frappe } from "./index";
declare var outside: number;
declare global {
	/** var commented: string; */
	// const alsoCommented: string;
	var frappe: Frappe;
	var multi:
		| string
		| null;
	const KONST: "declare global { var inString: 1 }";
	let mutable: number;
	function helper(a: { var nested: 1 }): void;
	interface Window { notAGlobal?: string }
	namespace frappe { type DocType = string }
	type Alias = string;
}
export {};
`;
	assert.deepEqual([...declareGlobalValues(src)].sort(), ["KONST", "frappe", "helper", "multi", "mutable"]);
});

test("references: path and types directives", () => {
	const src = `/// <reference types="jquery" />\n/// <reference path="./modules.d.ts" />\n// /// <reference path="./no.d.ts" />\n`;
	assert.deepEqual(references(src), { paths: ["./modules.d.ts"], types: ["jquery"] });
});

test("jquery: only the JQueryStatic constants", () => {
	const src = "declare const jQuery: JQueryStatic;\ndeclare const $: JQueryStatic;\ndeclare var Symbol: SymbolConstructor;\n";
	assert.deepEqual([...jqueryStaticValues(src)].sort(), ["$", "jQuery"]);
});

test("the desk list holds the names the ambient entry documents", async () => {
	const desk = await entryGlobals(root, "src/global.d.ts");
	for (const n of ["frappe", "__", "locals", "cur_frm", "cur_list", "cur_dialog", "cur_page", "erpnext", "$", "jQuery", "flt", "AMEND"]) {
		assert.ok(desk.includes(n), n);
	}
	assert.ok(!desk.includes("valid_email"), "web-only helper leaked into the desk list");
	assert.ok(!desk.includes("Symbol"));
});

test("the web list is the desk list plus the website helpers", async () => {
	const desk = await entryGlobals(root, "src/global.d.ts");
	const web = await entryGlobals(root, "src/web.d.ts");
	assert.deepEqual(
		web.filter((n) => !desk.includes(n)),
		["ask_to_login", "is_html", "valid_email"],
	);
});

for (const { entry, out } of LINT_GLOBALS_FILES) {
	test(`${out} matches ${entry} (npm run gen:lint-globals)`, async () => {
		const have = readFileSync(path.join(root, out), "utf8");
		assert.equal(have, lintGlobalsJson(await entryGlobals(root, entry)));
	});
}

test("lint/*.json is published and exported", () => {
	assert.ok(pkg.files.includes("lint"));
	assert.equal(pkg.exports["./lint/*"], "./lint/*");
});

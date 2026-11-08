// Unit tests for scripts/lib/scan-source.mjs, the scanner behind
// scripts/audit-consumer.mjs.
//
//   npm run test:unit        (= node --test "test/*.test.mjs")
//
// The fixtures are the shapes that produced false positives in carbon_frappe
// (exception text, messages about package.json, URL globs, test titles) next
// to the shapes that must still count (code, and browser code shipped as a
// template literal).

import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveFrappe } from "../scripts/lib/resolve-frappe.mjs";
import {
	DEFAULT_GLOBALS,
	NOT_FRAPPE_GLOBALS,
	OTHER_GLOBALS,
	WINDOW_GLOBALS,
	declaredNames,
	frappeWindowGlobals,
	globalsToProbe,
	isJavaScript,
	lex,
	scanSource,
	windowGlobalsIn,
} from "../scripts/lib/scan-source.mjs";

const paths = (src, opts) => [...scanSource(src, opts).paths].sort();

test("lex: strings, comments and regexes are removed from the code", () => {
	const { code, strings } = lex(
		[
			`const a = "frappe.x"; // frappe.y`,
			`/* frappe.z */ const r = /frappe\\.q"/g;`,
			"const t = `frappe.t ${frappe.call()} end`;",
		].join("\n"),
	);
	assert.ok(!code.includes("frappe.x"));
	assert.ok(!code.includes("frappe.y"));
	assert.ok(!code.includes("frappe.z"));
	assert.ok(!code.includes("frappe\\.q"));
	assert.ok(code.includes("frappe.call()"), "a template substitution is code");
	assert.deepEqual(strings, ["frappe.x", "frappe.t $0 end"]);
});

test("lex: a slash after a value is division, after an operator a regex", () => {
	const { strings } = lex(`const a = b / 2 / c; const s = "kept"; const r = x(/'/);`);
	assert.deepEqual(strings, ["kept"]);
});

test("lex: escapes in strings are decoded", () => {
	assert.deepEqual(lex(`"a\\"b\\nc"`).strings, ['a"b\nc']);
	assert.deepEqual(lex("`a\\`b`").strings, ["a`b"]);
});

test("isJavaScript: code compiles, prose does not", () => {
	assert.equal(isJavaScript("frappe.query_report.datatable.sortColumn($0, 'none')"), true);
	assert.equal(isJavaScript("return await fetch('/x')"), true, "async function body");
	assert.equal(isJavaScript("frappe.exceptions.ValidationError: Boom"), false);
	assert.equal(isJavaScript('frappe.major "$0" is missing or not numeric'), false);
	assert.equal(isJavaScript("*/api/method/frappe.client.get"), false);
	assert.equal(isJavaScript("frappe.ui.handle_link_cell_click (the link-preview click)"), false);
});

test("scanSource: paths in code count", () => {
	assert.deepEqual(paths(`frappe.ui.form.on("ToDo", {}); frappe.call({});`), ["frappe.call", "frappe.ui.form.on"]);
});

test("scanSource: prose that mentions frappe does not count", () => {
	const src = [
		`assert.equal(serverMessage({ exception: "frappe.exceptions.ValidationError: Boom" }), null);`,
		"problems.push(`frappe.major \"${major}\" is missing or not numeric`);",
		`await intercept(page, ["*/api/method/frappe.client.get"]);`,
		`await page.send("Network.setBlockedURLs", { urls: ["*frappe.client.set_value*"] });`,
		`it("deleteSession sends frappe.client.delete", async () => {});`,
		`const label = "frappe.form.formatters.Date (wrapped for mono dates)";`,
	].join("\n");
	assert.deepEqual(paths(src), []);
});

test("scanSource: a whole-string server method path does not count", () => {
	assert.deepEqual(paths(`frappe.xcall("frappe.client.get_list", {}); frappe.provide("frappe.views");`), [
		"frappe.provide",
		"frappe.xcall",
	]);
});

test("scanSource: browser code in a template literal counts, with its substitutions", () => {
	const src = [
		"await page.eval(`(frappe.query_report.datatable.sortColumn(${std}, 'none'), true)`);",
		"await page.eval(`({ g: ${A}.deepText(document.body), first: (frappe.boot.user && frappe.boot.user.first_name) || '' })`);",
		"await page.eval(`(async () => (await (await fetch('/api/method/frappe.auth.get_logged_user')).json()).message)()`);",
	].join("\n");
	assert.deepEqual(paths(src), [
		"frappe.boot.user",
		"frappe.boot.user.first_name",
		"frappe.query_report.datatable.sortColumn",
	]);
});

test("scanSource: other desk globals are collected", () => {
	const { globals } = scanSource(`cur_frm.refresh(); const s = __("Save"); const t = "__ in prose";`);
	assert.deepEqual([...globals].sort(), ["__", "cur_frm"]);
});

test("scanSource: a .vue file scans its script blocks and its template", () => {
	const src = [
		`<template><button @click="frappe.set_route('x')">{{ __("Go") }}</button><!-- frappe.nope --></template>`,
		`<script setup lang="ts">`,
		`const label = "frappe.views.prose only";`,
		`frappe.call({ method: "x" });`,
		`</script>`,
	].join("\n");
	assert.deepEqual(paths(src, { vue: true }), ["frappe.call", "frappe.set_route"]);
});

// ------------------------------------------------------------- bare window globals

test("scanSource: frappe's window helpers are collected as bare globals", () => {
	const src = [
		`const amount = format_currency(frm.doc.grand_total, frm.doc.currency);`,
		`open_url_post("/api/method/app.export", { name: frm.doc.name });`,
		`if (in_list(["Draft", "Open"], frm.doc.status)) refresh_field("items");`,
		`const r = flt(row.qty, precision("qty", row));`,
	].join("\n");
	assert.deepEqual([...scanSource(src).globals].sort(), [
		"flt",
		"format_currency",
		"in_list",
		"open_url_post",
		"precision",
		"refresh_field",
	]);
});

test("scanSource: a member, an object key or a name the file binds itself is not a global", () => {
	const src = [
		`const p = frm.precision("qty"); this.strip(x); obj?.in_list;`,
		`frappe.call({ method: "x", args: { precision: 2, saving: true } });`,
		`const saving = false; let strip = (s) => s.trim();`,
		`function remainder(a, b) { return a % b; }`,
		`import { format_currency as fc, nth } from "./money";`,
		`fc(1); nth(2); saving; strip(" a "); remainder(5, 2);`,
	].join("\n");
	assert.deepEqual([...scanSource(src).globals], []);
});

test("scanSource: vendored libraries on window are not frappe's API", () => {
	const { globals } = scanSource(`moment().format(); new Sortable(el); L.map(el); $(el).hide();`);
	assert.deepEqual([...globals], []);
});

test("scanSource: an explicit globals list replaces the default", () => {
	const src = `format_currency(1); cur_frm.refresh(); my_helper();`;
	assert.deepEqual([...scanSource(src, { globals: ["my_helper"] }).globals], ["my_helper"]);
});

test("declaredNames: the bindings a file makes itself", () => {
	const names = declaredNames(
		[
			"const a = 1; let b; var c;",
			"function d() {} function* e() {} class F {}",
			`import g from "g"; import * as h from "h"; import i, { j, k as l } from "m";`,
		].join("\n"),
	);
	for (const n of ["a", "b", "c", "d", "e", "F", "g", "h", "i", "j", "l"]) assert.ok(names.has(n), n);
	assert.ok(!names.has("k"), "an import renamed away is not bound");
});

test("windowGlobalsIn: window.x = … and Object.assign(window, { … })", () => {
	const src = [
		`window.cstr = function (s) { return s + ""; };`,
		`window.cur_frm = null;`,
		`if (window.frappe == null) {}`,
		`const same = window.saving === true;`,
		`// window.msg_dialog = frappe.msgprint({});`,
		`const s = "window.in_string = 1";`,
		`Object.assign(window, {`,
		`	flt,`,
		`	READ: "read",`,
		`	nested: { inner: 1 },`,
		`	helper() { return [1, 2]; },`,
		`	in_list`,
		`});`,
	].join("\n");
	assert.deepEqual([...windowGlobalsIn(src)].sort(), ["READ", "cstr", "cur_frm", "flt", "helper", "in_list", "nested"]);
});

test("globalsToProbe: OTHER_GLOBALS plus frappe's names, without vendored libraries", () => {
	const out = globalsToProbe(["format_currency", "moment", "Sortable", "$", "frappe", "cstr"]);
	assert.deepEqual(out, [...new Set([...OTHER_GLOBALS, "cstr", "format_currency"])].sort());
	for (const g of NOT_FRAPPE_GLOBALS) assert.ok(!DEFAULT_GLOBALS.includes(g), g);
});

/**
 * The frappe tree to derive the list from: FRAPPE_PATH when set (nix flake check
 * sets it to the pin), and then a tree that is not a frappe checkout is a failure;
 * otherwise the first checkout resolveFrappe finds, or a skip.
 */
function frappeTree() {
	const explicit = process.env.FRAPPE_PATH;
	if (explicit) return { path: explicit };
	const found = resolveFrappe(undefined);
	return found ? { path: found } : { skip: "no frappe checkout (set FRAPPE_PATH; nix flake check does)" };
}

test("frappeWindowGlobals: reads frappe/public/js and frappe/website/js", async () => {
	const root = mkdtempSync(path.join(os.tmpdir(), "scan-window-"));
	try {
		const write = (rel, src) => {
			const file = path.join(root, ...rel.split("/"));
			mkdirSync(path.dirname(file), { recursive: true });
			writeFileSync(file, src);
		};
		write("frappe/public/js/frappe/utils/urllib.js", "window.open_url_post = function () {};\n");
		write("frappe/website/js/website.js", "window.valid_email = function (id) {};\nwindow.cstr = (s) => s;\n");
		write("frappe/public/js/node_modules/lib/index.js", "window.vendored = 1;\n");
		const found = await frappeWindowGlobals(root);
		assert.deepEqual([...found.keys()], ["cstr", "open_url_post", "valid_email"]);
		assert.deepEqual(found.get("valid_email"), ["frappe/website/js/website.js"]);
		assert.deepEqual(found.get("open_url_post"), ["frappe/public/js/frappe/utils/urllib.js"]);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("WINDOW_GLOBALS is what frappe's own window assignments say", async (t) => {
	const tree = frappeTree();
	if ("skip" in tree) return t.skip(tree.skip);
	assert.ok(existsSync(path.join(tree.path, "frappe", "public", "js")), `${tree.path} is not a frappe checkout`);
	const pkg = JSON.parse(readFileSync(path.join(import.meta.dirname, "..", "package.json"), "utf8"));
	const init = readFileSync(path.join(tree.path, "frappe", "__init__.py"), "utf8");
	const version = /^__version__ = "([^"]+)"/m.exec(init)?.[1] ?? "";
	if (!process.env.FRAPPE_PATH && version.split(".")[0] !== pkg.frappe.major) {
		return t.skip(`${tree.path} is frappe ${version}, not ${pkg.frappe.major}.x`);
	}
	const derived = await frappeWindowGlobals(tree.path);
	const recorded = [...WINDOW_GLOBALS].sort();
	const read = [...derived.keys()].filter((g) => !NOT_FRAPPE_GLOBALS.has(g)).sort();
	assert.deepEqual(
		recorded,
		read,
		"frappe's window assignments changed: update WINDOW_GLOBALS in scripts/lib/scan-source.mjs (and declare the new names)",
	);
	for (const [name, files] of derived) {
		for (const f of files) assert.ok(existsSync(path.join(tree.path, f)), `${name}: ${f}`);
	}
});

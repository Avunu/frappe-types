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
import { isJavaScript, lex, scanSource } from "../scripts/lib/scan-source.mjs";

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

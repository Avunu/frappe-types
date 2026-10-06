// Unit tests for scripts/lib/citations.mjs.

import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeCitations, compareAnchors, parseLineSpec, resolveCitation, scanCitations, scanMentions } from "../scripts/lib/citations.mjs";

/**
 * An in-memory tree, for the code that only needs the reader interface.
 * @param {Record<string, string>} files
 * @returns {import("../scripts/lib/frappe-reader.mjs").FrappeReader}
 */
function memoryReader(files) {
	return {
		kind: "fs",
		label: "memory",
		async readText(rel) {
			return files[rel] ?? null;
		},
		async kindOf(rel) {
			if (rel in files) return "file";
			return Object.keys(files).some((f) => f.startsWith(`${rel}/`)) ? "dir" : null;
		},
		async listFiles(dir) {
			return Object.keys(files).filter((f) => f.startsWith(`${dir}/`)).sort();
		},
	};
}

test("line specs: single lines, ranges (both endpoints), comma lists, mixed", () => {
	assert.deepEqual(parseLineSpec(":412"), [412]);
	assert.deepEqual(parseLineSpec(":12-26"), [12, 26]);
	assert.deepEqual(parseLineSpec(":44,61,70"), [44, 61, 70]);
	assert.deepEqual(parseLineSpec(":1-3,7"), [1, 3, 7]);
	assert.deepEqual(parseLineSpec(":9,9"), [9]);
});

test("scan: full-path citations in every spelling prose uses", () => {
	const text = [
		"// frappe/public/js/frappe/form/grid.js:412",
		" * (`frappe/public/js/frappe/db.js:44,61,70`) and frappe/public/js/frappe/ui/messages.js:117-315.",
		" * see frappe/public/js/frappe/model/model.js for the rest",
		" * `apps/frappe/frappe/public/js/frappe/form/grid.js`, the doubled one",
		" * (frappe/esbuild/esbuild.js:92-97, 327)",
		" * frappe/core/doctype/docfield/docfield.json:3 and frappe/www/desk.html:50",
		" * font-awesome: frappe/public/css/fonts/fontawesome/font-awesome.min.css:1",
	].join("\n");
	const { full, unresolvable } = scanCitations(text, "src/x.d.ts");
	assert.deepEqual(
		full.map((c) => [c.text, c.line, c.anchors, c.candidates]),
		[
			["frappe/public/js/frappe/form/grid.js:412", 1, [412], ["frappe/public/js/frappe/form/grid.js", "public/js/frappe/form/grid.js"]],
			["frappe/public/js/frappe/db.js:44,61,70", 2, [44, 61, 70], ["frappe/public/js/frappe/db.js", "public/js/frappe/db.js"]],
			["frappe/public/js/frappe/ui/messages.js:117-315", 2, [117, 315], ["frappe/public/js/frappe/ui/messages.js", "public/js/frappe/ui/messages.js"]],
			["frappe/public/js/frappe/model/model.js", 3, [], ["frappe/public/js/frappe/model/model.js", "public/js/frappe/model/model.js"]],
			// `apps/frappe/` names the repo root, so what follows is already the full path.
			["apps/frappe/frappe/public/js/frappe/form/grid.js", 4, [], ["frappe/public/js/frappe/form/grid.js"]],
			["frappe/esbuild/esbuild.js:92-97", 5, [92, 97], ["frappe/esbuild/esbuild.js", "esbuild/esbuild.js"]],
			["frappe/core/doctype/docfield/docfield.json:3", 6, [3], ["frappe/core/doctype/docfield/docfield.json", "core/doctype/docfield/docfield.json"]],
			["frappe/www/desk.html:50", 6, [50], ["frappe/www/desk.html", "www/desk.html"]],
			["frappe/public/css/fonts/fontawesome/font-awesome.min.css:1", 7, [1], ["frappe/public/css/fonts/fontawesome/font-awesome.min.css", "public/css/fonts/fontawesome/font-awesome.min.css"]],
		],
	);
	assert.deepEqual(unresolvable, []);
});

test("scan: relative and other-repo citations are counted as unresolvable, never resolved", () => {
	const text = [
		"grid.js:412 and `model/model.js:12-20`",
		"carbon_frappe/public/js/tables/grid/grid.js:356 and apps/carbon_frappe/carbon_frappe/x.js:9",
		"frappe/.../grid_row.js:241 is elided",
		"a bare mention of grid.js with no line is not a citation",
		"https://github.com/frappe/frappe/blob/develop/frappe/public/js/x.js:12 is a URL",
		"frappe/public/js/frappe/provide.js:21 is the one real one",
	].join("\n");
	const { full, unresolvable } = scanCitations(text, "src/x.d.ts");
	assert.deepEqual(full.map((c) => c.text), ["frappe/public/js/frappe/provide.js:21"]);
	assert.deepEqual(
		unresolvable.map((u) => [u.text, u.root]),
		[
			["grid.js:412", "(bare)"],
			["model/model.js:12-20", "model"],
			["carbon_frappe/public/js/tables/grid/grid.js:356", "carbon_frappe"],
			["apps/carbon_frappe/carbon_frappe/x.js:9", "apps"],
			["frappe/.../grid_row.js:241", "frappe"],
		],
	);
});

test("resolve: the frappe/ package path wins; the repo-root reading is only a fallback", async () => {
	const reader = memoryReader({
		"frappe/public/js/a.js": "",
		"package.json": "",
		"esbuild/esbuild.js": "",
	});
	/** @param {string} text */
	const cite = (text) => {
		const found = scanCitations(text, "src/x.d.ts").full[0];
		if (!found) throw new Error(`no citation in ${text}`);
		return found;
	};
	assert.equal(await resolveCitation(cite("frappe/public/js/a.js:1"), [reader]), "frappe/public/js/a.js");
	assert.equal(await resolveCitation(cite("frappe/package.json:60"), [reader]), "package.json");
	assert.equal(await resolveCitation(cite("frappe/esbuild/esbuild.js:92"), [reader]), "esbuild/esbuild.js");
	assert.equal(await resolveCitation(cite("apps/frappe/frappe/public/js/a.js"), [reader]), "frappe/public/js/a.js");
	assert.equal(await resolveCitation(cite("frappe/public/js/gone.js:1"), [reader]), null);
	// A file that exists only in the earlier reader still resolves — that is how a DELETED file is found.
	const later = memoryReader({});
	assert.equal(await resolveCitation(cite("frappe/public/js/a.js:1"), [reader, later]), "frappe/public/js/a.js");
});

test("anchors: compared by line number, trimmed; a missing line is changed, or invalid at the baseline", () => {
	const before = "one\n\ttwo\nthree\nfour\n";
	const after = "one\ntwo  \nTHREE\n";
	assert.deepEqual([...compareAnchors(before, after, [1, 2, 3, 4, 9])], [
		[1, "same"],
		[2, "same"], // re-indented: still the same text
		[3, "changed"],
		[4, "changed"], // the file no longer has a line 4
		[9, "invalid"], // it never had a line 9
	]);
	assert.deepEqual([...compareAnchors("a\r\nb\r\n", "a\nb\n", [1, 2])], [[1, "same"], [2, "same"]]);
});

test("analyze: statuses, tallies and the never-resolved list", async () => {
	const base = memoryReader({
		"frappe/a.js": "one\ntwo\nthree\n",
		"frappe/gone.js": "x\n",
		"frappe/same.js": "s\n",
	});
	const head = memoryReader({
		"frappe/a.js": "one\nTWO\nthree\n",
		"frappe/same.js": "s\n",
	});
	const declarations = [
		{
			file: "src/x.d.ts",
			text: [
				"frappe/a.js:1,2 frappe/a.js:2-3",
				"frappe/gone.js:1",
				"frappe/same.js:1",
				"frappe/never.js:1",
				"grid.js:5",
			].join("\n"),
		},
	];
	const report = await analyzeCitations({ declarations, base, head, git: null });
	assert.equal(report.citations, 5);
	assert.deepEqual(report.files.map((f) => [f.path, f.status, f.citations]), [
		["frappe/a.js", "present", 2],
		["frappe/gone.js", "deleted", 1],
		["frappe/same.js", "present", 1],
	]);
	assert.deepEqual(report.files.find((f) => f.path === "frappe/a.js")?.lines, { total: 3, changed: 1, invalid: 0 });
	assert.deepEqual(report.neverResolved, ["frappe/never.js"]);
	assert.deepEqual(report.unresolvable, { total: 1, byRoot: { "(bare)": 1 } });
	// Distinct anchors: a.js 1,2,3 (one changed) + same.js 1. Occurrences repeat a.js:2.
	assert.deepEqual(report.anchors?.distinct, { total: 4, changed: 1, invalid: 0 });
	assert.deepEqual(report.anchors?.occurrences, { total: 5, changed: 2, invalid: 0 });
	assert.deepEqual(report.anchors?.following, { citations: 0, anchors: 0 });
});

test("analyze: citations that already follow the audited tree are left out of the comparison, not counted as changed", async () => {
	const base = memoryReader({ "frappe/a.js": "one\ntwo\nthree\n" });
	// two lines were inserted at the top: `three` is now line 5, and line 3 reads `two`
	const head = memoryReader({ "frappe/a.js": "x\ny\none\ntwo\nthree\n" });
	const text = "frappe/a.js:3 frappe/a.js:1";
	// without the information: both are compared by number against the baseline
	const naive = await analyzeCitations({ declarations: [{ file: "src/x.d.ts", text }], base, head, git: null });
	assert.deepEqual(naive.anchors?.occurrences, { total: 2, changed: 2, invalid: 0 });
	// `frappe/a.js:3` was moved to follow the new tree (it IS the new line of `one`); `:1` was not
	const report = await analyzeCitations({
		declarations: [{ file: "src/x.d.ts", text }],
		base,
		head,
		git: null,
		following: (citation) => citation.index === 0,
	});
	assert.deepEqual(report.anchors?.occurrences, { total: 1, changed: 1, invalid: 0 });
	assert.deepEqual(report.anchors?.following, { citations: 1, anchors: 1 });
	// the file still counts both citations; only the comparison skipped one
	assert.equal(report.files[0]?.citations, 2);
});

test("scan: every match carries its offset, so a rewriter can edit it in place", () => {
	const text = "ab grid.js:12 and frappe/public/js/frappe/db.js:3";
	const { full, unresolvable } = scanCitations(text, "src/x.d.ts");
	assert.equal(text.slice(unresolvable[0]?.index, (unresolvable[0]?.index ?? 0) + (unresolvable[0]?.text.length ?? 0)), "grid.js:12");
	assert.equal(text.slice(full[0]?.index, (full[0]?.index ?? 0) + (full[0]?.text.length ?? 0)), "frappe/public/js/frappe/db.js:3");
});

test("analyze: without a baseline a missing file is simply not found", async () => {
	const head = memoryReader({ "frappe/a.js": "x\n" });
	const report = await analyzeCitations({
		declarations: [{ file: "src/x.d.ts", text: "frappe/a.js:1 frappe/b.js:1" }],
		base: null,
		head,
		git: null,
	});
	assert.deepEqual(report.neverResolved, ["frappe/b.js"]);
	assert.equal(report.anchors, null);
	assert.deepEqual(report.files.map((f) => [f.path, f.status, f.lines]), [["frappe/a.js", "present", null]]);
});

test("mentions: directory-qualified paths with no line number, and nothing else", () => {
	const text = [
		"see form/sidebar/document_follow.js and `ui/dialog.js` (not ui/dialog.js:10, which is a citation)",
		"a bare grid.js, a version v16.50.0, http://example.com/x/y.js, ../frappe/x/y.js, @scope/pkg/y.js and src/ui/form.d.ts",
		"frappe/public/js/frappe/db.js is a mention too, and so is carbon_frappe/public/js/x.js",
	].join("\n");
	assert.deepEqual(scanMentions(text).map((m) => m.text), ["form/sidebar/document_follow.js", "ui/dialog.js", "frappe/public/js/frappe/db.js", "carbon_frappe/public/js/x.js"]);
	assert.equal(text.slice(scanMentions(text)[0]?.index, (scanMentions(text)[0]?.index ?? 0) + 5), "form/");
});

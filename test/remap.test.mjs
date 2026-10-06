// Unit tests for scripts/lib/remap.mjs — the citation remapper.
//
// The properties that matter, in the order they are tested:
//   * the grammar: what is a citation, what only looks like one (versions, ratios, ports);
//   * line mapping is EXACT: a moved line keeps its text, a touched line is never given a number;
//   * only digits are ever rewritten, and a second run finds nothing to do;
//   * a bare name is never guessed: ambiguous means unresolved;
//   * stamps change only when asked.
//
// Everything but the last block runs on memory. The last builds a throwaway git repository
// (and skips itself where there is no `git` on PATH) to check that what `git diff -U0` and
// `--name-status` actually print is what the parser expects, renames included.

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import {
	applyEdits,
	applyStamp,
	checkConfig,
	citedNumbers,
	createGitSource,
	editsFor,
	extractReferences,
	findCandidates,
	flaggedRecords,
	headerBlock,
	hunkReplacements,
	indexTree,
	interiorChanges,
	judgeItem,
	mapLine,
	parseDiff,
	parseSpec,
	planRemap,
	readStamp,
	referenceTags,
	resolveReference,
	splitLines,
	tally,
	tokenizeLines,
	unchanged,
} from "../scripts/lib/remap.mjs";

const hasGit = spawnSync("git", ["--version"]).status === 0;

// ---------------------------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------------------------

/**
 * `git diff -U0` hunks between two line arrays, by plain LCS: enough to drive the planner
 * from memory. Follows git's convention for pure insertions (old start = the line before)
 * and pure deletions (new start = the line before).
 * @param {string[]} a
 * @param {string[]} b
 * @returns {import("../scripts/lib/remap.mjs").Hunk[]}
 */
function hunksBetween(a, b) {
	const n = a.length;
	const m = b.length;
	/** @type {number[]} */
	const lcs = new Array((n + 1) * (m + 1)).fill(0);
	const at = (/** @type {number} */ i, /** @type {number} */ j) => lcs[i * (m + 1) + j] ?? 0;
	for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) lcs[i * (m + 1) + j] = a[i] === b[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
	/** @type {[number, number][]} */
	const pairs = [];
	for (let i = 0, j = 0; i < n && j < m; ) {
		if (a[i] === b[j]) {
			pairs.push([i, j]);
			i++;
			j++;
		} else if (at(i + 1, j) >= at(i, j + 1)) i++;
		else j++;
	}
	pairs.push([n, m]);
	/** @type {import("../scripts/lib/remap.mjs").Hunk[]} */
	const hunks = [];
	let pi = -1;
	let pj = -1;
	for (const [i, j] of pairs) {
		const oldCount = i - pi - 1;
		const newCount = j - pj - 1;
		if (oldCount > 0 || newCount > 0) {
			hunks.push({ oldStart: oldCount > 0 ? pi + 2 : pi + 1, oldCount, newStart: newCount > 0 ? pj + 2 : pj + 1, newCount });
		}
		pi = i;
		pj = j;
	}
	return hunks;
}

/**
 * A `Source` over two in-memory trees.
 * @param {Record<string, Record<string, string>>} tags tag -> path -> text
 * @param {Record<string, string>} [renames] old path -> new path (same content assumed similar)
 * @returns {import("../scripts/lib/remap.mjs").Source}
 */
function memorySource(tags, renames = {}) {
	return {
		async files(tag) {
			return Object.keys(tags[tag] ?? {}).sort();
		},
		async text(tag, p) {
			return tags[tag]?.[p] ?? null;
		},
		async changes(from, to, paths) {
			/** @type {Map<string, import("../scripts/lib/remap.mjs").FileChange>} */
			const out = new Map();
			for (const p of paths) {
				const before = tags[from]?.[p];
				const target = renames[p] ?? p;
				const after = tags[to]?.[target];
				if (before === undefined) throw new Error(`no ${p} at ${from}`);
				if (after === undefined) out.set(p, { kind: "deleted", oldPath: p, newPath: null, similarity: null, hunks: [], binary: false });
				else if (target !== p) out.set(p, { kind: "renamed", oldPath: p, newPath: target, similarity: 90, hunks: hunksBetween(splitLines(before), splitLines(after)), binary: false });
				else if (before === after) out.set(p, unchanged(p));
				else out.set(p, { kind: "modified", oldPath: p, newPath: p, similarity: null, hunks: hunksBetween(splitLines(before), splitLines(after)), binary: false });
			}
			return out;
		},
	};
}

/** @param {string[]} lines */
const file = (lines) => `${lines.join("\n")}\n`;

const CONFIG = checkConfig({
	schema: 1,
	outOfScope: [
		{ prefix: "carbon_frappe/", owner: "carbon_frappe" },
		{ prefix: "tables/", owner: "carbon_frappe" },
		{ prefix: "node_modules/", owner: "third-party" },
	],
	files: {
		"src/a.d.ts": { declared: "relative to frappe/public/js/frappe/", bases: ["frappe/public/js/frappe/"], basis: "header" },
	},
});

// ---------------------------------------------------------------------------------------------
// the grammar
// ---------------------------------------------------------------------------------------------

test("line specs keep their structure and their offsets", () => {
	assert.deepEqual(parseSpec(":412"), [{ kind: "line", n: 412, at: 1 }]);
	assert.deepEqual(parseSpec(":22-296"), [{ kind: "range", a: 22, b: 296, atA: 1, atB: 4 }]);
	assert.deepEqual((parseSpec(":44,61,70") ?? []).map((i) => (i.kind === "line" ? i.n : null)), [44, 61, 70]);
	assert.deepEqual(parseSpec(":1-3,7"), [
		{ kind: "range", a: 1, b: 3, atA: 1, atB: 3 },
		{ kind: "line", n: 7, at: 5 },
	]);
	// what is not a spec at all is refused rather than half-read
	for (const bad of [":1-2-3", ":30-20", ":0", ":", ":1,", "12"]) assert.equal(parseSpec(bad), null, bad);
});

test("references: full paths, bare names and every spelling of a list", () => {
	const text = [
		"// frappe/public/js/frappe/form/grid.js:412 and grid_row.js:12-20",
		" * notifications.js:5, :127 and `grid.js:1068 and :1075`, then desk.js:332 / :364 and formatters.js:412 + :416-419",
		" * `model.js:155, :453, :523, :608` and `db.js:44,61,70`",
		" * mention only: frappe/public/js/frappe/provide.js",
	].join("\n");
	const refs = extractReferences(text, "src/x.d.ts");
	assert.deepEqual(
		refs.map((r) => [r.form, r.text, citedNumbers(r)]),
		[
			["full", "frappe/public/js/frappe/form/grid.js:412", [412]],
			["relative", "grid_row.js:12-20", [12, 20]],
			["relative", "notifications.js:5, :127", [5, 127]],
			["relative", "grid.js:1068 and :1075", [1068, 1075]],
			["relative", "desk.js:332 / :364", [332, 364]],
			["relative", "formatters.js:412 + :416-419", [412, 416, 419]],
			["relative", "model.js:155, :453, :523, :608", [155, 453, 523, 608]],
			["relative", "db.js:44,61,70", [44, 61, 70]],
			["full", "frappe/public/js/frappe/provide.js", []],
		],
	);
});

test("references: a continuation never crosses a line, and needs a citation to continue", () => {
	const refs = extractReferences("see grid.js:12,\n * :14 and foo.js, :9", "src/x.d.ts");
	// the `:14` on the next line and the `:9` after a file with no spec are not part of anything...
	assert.deepEqual(refs.filter((r) => r.form !== "implicit").map((r) => r.text), ["grid.js:12"]);
	// ...they are file-less references, which only a config can give a file
	assert.deepEqual(refs.filter((r) => r.form === "implicit").map((r) => [r.text, r.line]), [[":14", 2], [":9", 2]]);
});

test("references: what merely looks like one is not one", () => {
	const text = [
		"verified against v16.50.0 and frappe v16.33.1",
		"a 3:4 ratio, 10:30 in the morning, localhost:8080, ::1, a:12 and `key:12`, (1:2)",
		"on port :80? no: http://example.com:80/x and \"label\":3",
		"also 16.50.0:1 and `x.d.ts:216` which is this package, not frappe",
	].join("\n");
	const refs = extractReferences(text, "src/x.d.ts");
	assert.deepEqual(refs.map((r) => r.text), [":80"]); // a bare `:80` is a file-less reference by the grammar: reported, never edited
	assert.equal(refs[0]?.form, "implicit");
});

test("references: malformed specs are marked, not guessed at", () => {
	const [ref] = extractReferences("grid.js:30-20", "src/x.d.ts");
	assert.equal(ref?.malformed, true);
	assert.deepEqual(ref?.items, []);
});

// ---------------------------------------------------------------------------------------------
// diffs and line mapping
// ---------------------------------------------------------------------------------------------

test("parseDiff: modified, deleted, renamed (with and without hunks), mode-only, short hunk headers", () => {
	const patch = [
		"diff --git a/f/a.js b/f/a.js",
		"index 111..222 100644",
		"--- a/f/a.js",
		"+++ b/f/a.js",
		"@@ -6,0 +7,31 @@ import x",
		"+added",
		"@@ -12 +43 @@ ctx",
		"-old",
		"+new",
		"@@ -62,5 +92 @@",
		"diff --git a/f/gone.js b/f/gone.js",
		"deleted file mode 100644",
		"--- a/f/gone.js",
		"+++ /dev/null",
		"@@ -1,3 +0,0 @@",
		"diff --git a/f/old.js b/f/new.js",
		"similarity index 93%",
		"rename from f/old.js",
		"rename to f/new.js",
		"--- a/f/old.js",
		"+++ b/f/new.js",
		"@@ -2 +2,2 @@",
		"diff --git a/f/same.js b/f/moved.js",
		"similarity index 100%",
		"rename from f/same.js",
		"rename to f/moved.js",
		"diff --git a/f/mode.js b/f/mode.js",
		"old mode 100644",
		"new mode 100755",
	].join("\n");
	const out = parseDiff(patch);
	assert.deepEqual(out.get("f/a.js")?.hunks, [
		{ oldStart: 6, oldCount: 0, newStart: 7, newCount: 31 },
		{ oldStart: 12, oldCount: 1, newStart: 43, newCount: 1 },
		{ oldStart: 62, oldCount: 5, newStart: 92, newCount: 1 },
	]);
	assert.equal(out.get("f/gone.js")?.kind, "deleted");
	assert.equal(out.get("f/gone.js")?.newPath, null);
	assert.deepEqual([out.get("f/old.js")?.kind, out.get("f/old.js")?.newPath, out.get("f/old.js")?.similarity, out.get("f/old.js")?.hunks.length], ["renamed", "f/new.js", 93, 1]);
	assert.deepEqual([out.get("f/same.js")?.kind, out.get("f/same.js")?.newPath, out.get("f/same.js")?.hunks.length], ["renamed", "f/moved.js", 0]);
	assert.deepEqual([out.get("f/mode.js")?.kind, out.get("f/mode.js")?.hunks.length], ["modified", 0]);
});

/**
 * @param {string[]} before
 * @param {string[]} after
 */
function change(before, after) {
	return { kind: /** @type {const} */ ("modified"), oldPath: "f.js", newPath: "f.js", similarity: null, hunks: hunksBetween(before, after), binary: false };
}

test("mapLine: lines outside every hunk move by the net change above them, exactly", () => {
	const before = ["a", "b", "c", "d", "e", "f"];
	const after = ["a", "NEW1", "NEW2", "b", "c", "e", "f"]; // 2 inserted after a, d deleted
	const c = change(before, after);
	const at = (/** @type {number} */ n) => mapLine(c, before, after, n);
	assert.deepEqual([at(1).status, at(1).to], ["same", 1]); // before the insertion: untouched
	assert.deepEqual([at(2).status, at(2).to], ["moved", 4]); // b: +2
	assert.deepEqual([at(3).status, at(3).to], ["moved", 5]); // c: +2
	assert.deepEqual([at(4).status, at(4).to], ["deleted", null]); // d: removed
	assert.deepEqual([at(5).status, at(5).to], ["moved", 6]); // e: +2 -1
	assert.deepEqual([at(6).status, at(6).to], ["moved", 7]);
	assert.equal(at(7).status, "invalid"); // past the end of the old file
	assert.equal(at(0).status, "invalid");
});

test("mapLine: the line an insertion follows is not touched; the line it precedes moves", () => {
	const before = ["a", "b"];
	const after = ["a", "X", "b"];
	const c = change(before, after);
	assert.equal(mapLine(c, before, after, 1).to, 1);
	assert.equal(mapLine(c, before, after, 2).to, 3);
});

test("mapLine: a replaced line is modified, never mapped", () => {
	const before = ["a", "return 1;", "c"];
	const after = ["a", "return 2;", "c"];
	const v = mapLine(change(before, after), before, after, 2);
	assert.equal(v.status, "modified");
	assert.equal(v.to, null);
	assert.deepEqual(v.hunk, { oldStart: 2, oldCount: 1, newStart: 2, newCount: 1 });
});

test("mapLine: re-indentation and blank lines are not changes — the text is the same and is found", () => {
	const before = ["function f() {", "\treturn 1;", "}", "", "x();"];
	const after = ["function f() {", "    return 1;", "", "}", "", "", "x();"];
	const c = change(before, after);
	// `return 1;` is in a hunk (indentation), but what it removed and added are the same text
	const ret = mapLine(c, before, after, 2);
	assert.deepEqual([ret.status, ret.to], ["same", 2]);
	assert.deepEqual([mapLine(c, before, after, 3).status, mapLine(c, before, after, 3).to], ["moved", 4]);
	assert.equal(mapLine(c, before, after, 5).to, 7);
	// every exact mapping really lands on the same text
	for (const n of [1, 2, 3, 5]) {
		const v = mapLine(c, before, after, n);
		assert.equal(before[n - 1]?.trim(), after[(v.to ?? 0) - 1]?.trim(), `line ${n}`);
	}
});

test("mapLine: a mapping whose text does not match is reported as unverified, not applied", () => {
	// a hand-made hunk that lies: it says nothing changed but the text differs
	const bad = { kind: /** @type {const} */ ("modified"), oldPath: "f.js", newPath: "f.js", similarity: null, hunks: [], binary: false };
	const v = mapLine(bad, ["one", "two"], ["one", "TWO"], 2);
	assert.equal(v.status, "unverified");
});

test("ranges: ends exact and nothing material inside = exact; a hunk inside, or an end touched, is not", () => {
	const before = ["head", "a", "b", "c", "d", "tail", "z"];
	const grown = ["new", "head", "a", "b", "c", "d", "tail", "z"];
	const inner = ["head", "a", "b", "EDITED", "c", "d", "tail", "z"];
	const endHit = ["head", "a", "b", "c", "d", "TAIL", "z"];
	const item = { kind: /** @type {const} */ ("range"), a: 1, b: 6, atA: 0, atB: 0 };
	const verdict = (/** @type {string[]} */ after) => judgeItem(item, change(before, after), before, after);
	const moved = verdict(grown);
	assert.equal(moved.exact, true);
	assert.deepEqual([moved.start.to, moved.end?.to], [2, 7]);
	const interior = verdict(inner);
	assert.equal(interior.exact, false);
	assert.equal(interior.interior.length, 1);
	assert.deepEqual([interior.start.status, interior.end?.status], ["same", "moved"]); // ends are fine (the end just moved down); the inside is what changed
	const ends = verdict(endHit);
	assert.equal(ends.exact, false);
	assert.equal(ends.end?.status, "modified");
	// blank-line churn inside a range is not a material change
	const blanks = verdict(["head", "a", "", "b", "c", "d", "tail", "z"]);
	assert.equal(blanks.exact, true);
	assert.equal(blanks.end?.to, 7);
	// the interior is only the lines BETWEEN the ends
	assert.equal(interiorChanges(change(before, ["head", "a", "b", "c", "d", "tail", "z", "more"]), before, [...before, "more"], 1, 6).length, 0);
});

test("candidates: identical text first, then similar text; short lines offer none", () => {
	const lines = ["foo();", "const total = compute_total(items, tax);", "}", "const total = compute_total(rows, tax);", "unrelated line here"];
	const tk = tokenizeLines(lines);
	const exact = findCandidates("const total = compute_total(items, tax);", lines, tk, 2);
	assert.deepEqual(exact.map((c) => [c.line, c.basis, c.score]), [[2, "identical-text", 1], [4, "similar-text", 0.8]]);
	assert.deepEqual(findCandidates("});", lines, tk, 1), []);
	assert.deepEqual(findCandidates("}", lines, tk, 1), []);
	// the diff's own replacement lines are offered even when they are nothing like the old one
	const rep = hunkReplacements("old text here", { oldStart: 1, oldCount: 1, newStart: 4, newCount: 2 }, lines, tk);
	// ranked by closeness in text (line 5 shares a word with the old line), whatever their order in the file
	assert.deepEqual(rep.map((c) => c.line), [5, 4]);
});

// ---------------------------------------------------------------------------------------------
// rewriting
// ---------------------------------------------------------------------------------------------

test("edits replace digits and nothing else", () => {
	const text = "x grid.js:9-20, :31 and 12 grid.js:9 y\n";
	const [ref] = extractReferences(text, "src/x.d.ts");
	assert.ok(ref);
	const verdicts = ref.items.map((item) => ({
		item,
		start: { n: 0, status: /** @type {const} */ ("moved"), to: item.kind === "line" ? item.n + 100 : item.a + 1, expected: 0, hunk: null },
		end: item.kind === "range" ? { n: 0, status: /** @type {const} */ ("moved"), to: item.b + 1000, expected: 0, hunk: null } : null,
		interior: [],
		exact: true,
	}));
	assert.equal(applyEdits(text, editsFor(ref, verdicts)), "x grid.js:10-1020, :131 and 12 grid.js:9 y\n");
});

test("stamps: the header only, a sentence's full stop is not part of a tag, sha at its own length", () => {
	const text = [
		"/**",
		" * Frappe v16.33.0. Companion to `x.d.ts`.",
		" * Source of truth: apps/frappe @ 33bf510b17 (tag v16.33.0, branch version-16), frappe-charts@2.0.0.",
		" */",
		"export type A = 1;",
		"/** at v16.33.0 a grep found nothing; apps/frappe @ 33bf510b17 */",
	].join("\n");
	assert.deepEqual(readStamp(text), { tags: ["v16.33.0"], shas: ["33bf510b17"] });
	assert.equal(headerBlock(text).text.includes("export"), false);
	const out = applyStamp(text, { from: "v16.33.0", to: "v16.50.0", fromSha: "33bf510b17afcaaa857ed38b921d8e9e50dcd232", toSha: "f20f92d29706510551b4438cc196b0323a7f1a92" });
	assert.equal(out.split("\n").slice(0, 4).join("\n").match(/v16\.50\.0/g)?.length, 2);
	assert.ok(out.includes("@ f20f92d297 (tag"));
	// below the header nothing moves: that sentence is about one grep, not about line numbers
	assert.equal(out.split("\n").slice(4).join("\n"), text.split("\n").slice(4).join("\n"));
	assert.equal(readStamp("/** no stamp here */\nexport {};").tags.length, 0);
});

// ---------------------------------------------------------------------------------------------
// which file does a bare name mean
// ---------------------------------------------------------------------------------------------

describe("resolveReference", () => {
	const FJ = "frappe/public/js/frappe/";
	const tree = indexTree([
		`${FJ}form/grid.js`,
		`${FJ}form/toolbar.js`,
		`${FJ}ui/toolbar/toolbar.js`,
		`${FJ}form/layout.js`,
		`${FJ}utils/utils.js`,
		"frappe/public/js/form_builder/utils.js",
		`${FJ}ui/page.js`,
		"frappe/core/doctype/page/page.js",
		"frappe/boot.py",
		"node_utils.js",
	]);
	/**
	 * @param {string} text
	 * @param {Partial<import("../scripts/lib/remap.mjs").FileConfig>} [cfg]
	 * @param {string[]} [mentioned]
	 */
	const resolve = (text, cfg = {}, mentioned = []) => {
		const [ref] = extractReferences(text, "src/a.d.ts");
		if (!ref) throw new Error(`no citation in ${text}`);
		const file = { declared: "d", bases: [FJ], basis: "header", ...cfg };
		return resolveReference(ref, { config: CONFIG, file, tree, mentioned: new Set(mentioned) });
	};

	test("a unique file under the declared base", () => {
		assert.deepEqual(resolve("grid.js:412"), { scope: "core", path: `${FJ}form/grid.js`, basis: "base" });
		assert.deepEqual(resolve("form/layout.js:9"), { scope: "core", path: `${FJ}form/layout.js`, basis: "base" });
	});

	test("an ambiguous name is unresolved and lists what it could be — never the first", () => {
		const r = resolve("toolbar.js:9");
		assert.equal(r.scope, "unresolved");
		assert.deepEqual(r.scope === "unresolved" && r.candidates, [`${FJ}form/toolbar.js`, `${FJ}ui/toolbar/toolbar.js`]);
		assert.equal(resolve("utils.js:3", { bases: ["frappe/"] }).scope, "unresolved");
	});

	test("the file's own full-path citations break a tie, but only when exactly one candidate is named", () => {
		assert.deepEqual(resolve("toolbar.js:9", {}, [`${FJ}ui/toolbar/toolbar.js`]), { scope: "core", path: `${FJ}ui/toolbar/toolbar.js`, basis: "in-file-mention" });
		assert.equal(resolve("toolbar.js:9", {}, [`${FJ}ui/toolbar/toolbar.js`, `${FJ}form/toolbar.js`]).scope, "unresolved");
	});

	test("bases are tried in order and a narrower one wins", () => {
		assert.deepEqual(resolve("page.js:1", { bases: [FJ, "frappe/"] }), { scope: "core", path: `${FJ}ui/page.js`, basis: "base" });
		assert.equal(resolve("page.js:1", { bases: ["frappe/"] }).scope, "unresolved");
		assert.deepEqual(resolve("boot.py:5", { bases: [FJ, "frappe/"] }), { scope: "core", path: "frappe/boot.py", basis: "base" });
		assert.equal(resolve("nothing.js:1").scope, "unresolved");
	});

	test("prefixes that are never frappe core, and names the file says belong to someone else", () => {
		assert.deepEqual(resolve("carbon_frappe/public/js/x.js:5"), { scope: "not-core", owner: "carbon_frappe" });
		assert.deepEqual(resolve("tables/grid/grid.js:5"), { scope: "not-core", owner: "carbon_frappe" });
		assert.deepEqual(resolve("node_modules/bootstrap/js/dist/modal.js:5"), { scope: "not-core", owner: "third-party" });
		// a name with exactly one frappe candidate is still the consumer's if the file says so
		assert.deepEqual(resolve("grid.js:5", { notCore: { "grid.js": "carbon_frappe" } }), { scope: "not-core", owner: "carbon_frappe" });
		// ...and a file whose bare names are another library's says so once
		assert.deepEqual(resolve("BaseChart.js:34", { default: "frappe-charts" }), { scope: "not-core", owner: "frappe-charts" });
		assert.deepEqual(resolve("utils.js:34", { default: "frappe-charts", core: { "utils.js": `${FJ}utils/utils.js` } }), { scope: "core", path: `${FJ}utils/utils.js`, basis: "alias" });
	});

	test("a pinned name must exist at the old tag; a name the file admits is ambiguous is never resolved", () => {
		assert.deepEqual(resolve("node_utils.js:20", { core: { "node_utils.js": "node_utils.js" } }), { scope: "core", path: "node_utils.js", basis: "alias" });
		assert.equal(resolve("x.js:1", { core: { "x.js": "frappe/gone.js" } }).scope, "unresolved");
		const r = resolve("grid.js:5", { ambiguous: { "grid.js": "two files in this section" } });
		assert.equal(r.scope === "unresolved" && r.reason.startsWith("ambiguous-in-file"), true);
	});

	test("full paths resolve against the old tree; a missing one is unresolved, not out of scope", () => {
		assert.deepEqual(resolve(`${FJ}form/grid.js:9`), { scope: "core", path: `${FJ}form/grid.js`, basis: "full-path" });
		assert.deepEqual(resolve("apps/frappe/frappe/public/js/frappe/form/grid.js:9"), { scope: "core", path: `${FJ}form/grid.js`, basis: "full-path" });
		const gone = resolve(`${FJ}form/gone.js:9`);
		assert.equal(gone.scope === "unresolved" && gone.reason, "no-file-at-old-tag");
	});

	test("elided paths are never guessed", () => {
		const r = resolve("frappe/.../grid_row.js:241");
		assert.equal(r.scope === "unresolved" && r.reason, "elided-path");
	});

	test("a file-less :N means a file only where the config says the header does", () => {
		const [ref] = extractReferences("(:9)", "src/a.d.ts");
		assert.ok(ref);
		const ctx = { config: CONFIG, tree, mentioned: new Set() };
		const none = resolveReference(ref, { ...ctx, file: { declared: "d", bases: [FJ], basis: "header" } });
		assert.equal(none.scope === "unresolved" && none.reason, "no-file-named");
		const named = resolveReference(ref, { ...ctx, file: { declared: "d", bases: [FJ], basis: "header", implicit: `${FJ}form/grid.js` } });
		assert.deepEqual(named, { scope: "core", path: `${FJ}form/grid.js`, basis: "implicit-file" });
	});
});

// ---------------------------------------------------------------------------------------------
// the plan, end to end, on memory
// ---------------------------------------------------------------------------------------------

describe("planRemap", () => {
	const P = "frappe/public/js/frappe/";
	const GRID_OLD = ["// grid", "class Grid {", "\tmake() {", "\t\treturn 1;", "\t}", "\tremove() {", "\t\tdelete this.x;", "\t}", "}"];
	const GRID_NEW = ["// grid", "// added", "// lines", "class Grid {", "\tmake() {", "\t\treturn 2;", "\t}", "\tremove() {", "\t\tdelete this.x;", "\t}", "}"];
	const LIST_OLD = ["a", "b", "c"];
	const LIST_NEW = ["z", "a", "b", "c"];
	const tags = {
		"v16.33.0": { [`${P}form/grid.js`]: file(GRID_OLD), [`${P}list/list_view.js`]: file(LIST_OLD), [`${P}ui/gone.js`]: file(["x", "y"]) },
		"v16.50.0": { [`${P}form/grid.js`]: file(GRID_NEW), [`${P}list/list_view.js`]: file(LIST_NEW) },
	};
	const DTS = [
		"/**",
		" * Verified against **frappe v16.33.0**. Citations are `file.js:line` relative to `frappe/public/js/frappe/`.",
		" */",
		"/** make() at grid.js:3 and its body grid.js:4, remove() grid.js:6-8, class grid.js:2-9 */",
		"/** list_view.js:2 and list_view.js:3, :1 and gone.js:1 and carbon_frappe/public/js/x.js:9 */",
		"/** past the end: list_view.js:40, no line: frappe/public/js/frappe/list/list_view.js */",
	].join("\n");
	const plan = (/** @type {Parameters<typeof planRemap>[0]["ledger"]} */ ledger, text = DTS) =>
		planRemap({
			declarations: [{ file: "src/a.d.ts", text }],
			config: CONFIG,
			packageTag: "v16.33.1",
			ledger,
			newTag: "v16.50.0",
			source: memorySource(tags),
		});

	test("moved exactly, flagged when touched, left alone when not frappe's", async () => {
		const { files } = await plan(null);
		const decisions = files[0]?.decisions ?? [];
		const by = (/** @type {string} */ t) => decisions.find((d) => d.ref.text === t);
		assert.equal(by("grid.js:3")?.outcome, "moved"); // `make() {` shifted by the 2 added lines... and the hunk is above it
		assert.equal(by("grid.js:4")?.outcome, "modified"); // `return 1;` became `return 2;`
		assert.equal(by("grid.js:6-8")?.outcome, "moved");
		assert.equal(by("grid.js:2-9")?.status, "range-interior-modified");
		assert.equal(by("list_view.js:2")?.outcome, "moved");
		assert.equal(by("list_view.js:3, :1")?.outcome, "moved");
		assert.equal(by("list_view.js:40")?.outcome, "invalid");
		assert.equal(by("carbon_frappe/public/js/x.js:9")?.outcome, "out-of-scope");
		assert.equal(by("frappe/public/js/frappe/list/list_view.js")?.outcome, "no-line");
		// gone.js was not resolvable under the base at all? it is: it exists at the old tag and not the new one
		assert.equal(by("gone.js:1")?.outcome, "deleted");
		assert.equal(by("gone.js:1")?.status, "file-deleted");
	});

	test("nothing is written for a citation that was not exact, and each number lands on the same text", async () => {
		const { files } = await plan(null);
		const out = applyEdits(DTS, files[0]?.edits ?? []);
		assert.equal(
			out,
			DTS.replace("grid.js:3 ", "grid.js:5 ").replace("grid.js:6-8", "grid.js:8-10").replace("list_view.js:2 ", "list_view.js:3 ").replace("list_view.js:3, :1", "list_view.js:4, :2"),
		);
		// check by reading: every number that changed points at identical text
		for (const [from = 0, to = 0] of [[3, 5], [6, 8], [7, 9], [8, 10]]) assert.equal(GRID_OLD[from - 1]?.trim(), GRID_NEW[to - 1]?.trim());
	});

	test("idempotent: the ledger makes a second run find nothing to do, and the flagged list is unchanged", async () => {
		const first = await plan(null);
		const text1 = applyEdits(DTS, first.files[0]?.edits ?? []);
		const second = await plan(first.ledger, text1);
		assert.deepEqual(second.files[0]?.edits, []);
		const counts = tally(second.files[0] ?? /** @type {never} */ ({}));
		assert.equal(counts.moved, 0);
		assert.ok(counts.current > 0);
		// the citations that were left alone are still flagged, from the tag their numbers follow
		const was = flaggedRecords(first, new Map([["src/a.d.ts", DTS]])).flagged.map((f) => [f.citation, f.status]);
		const now = flaggedRecords(second, new Map([["src/a.d.ts", text1]])).flagged.map((f) => [f.citation, f.status]);
		assert.deepEqual(now, was);
		// and a third run is the same as the second
		const third = await plan(second.ledger, text1);
		assert.deepEqual(third.files[0]?.edits, []);
		assert.deepEqual(third.ledger, second.ledger);
	});

	test("without the ledger the same text WOULD be moved again — which is why it exists", async () => {
		const first = await plan(null);
		const text1 = applyEdits(DTS, first.files[0]?.edits ?? []);
		const naive = await plan(null, text1);
		assert.ok((naive.files[0]?.edits.length ?? 0) > 0);
	});

	test("a person editing a flagged citation takes it out of the ledger; re-stamping the file retires the ledger", async () => {
		const first = await plan(null);
		const text1 = applyEdits(DTS, first.files[0]?.edits ?? []);
		// the reviewer fixes `grid.js:4` by hand to the new number
		const fixed = text1.replace("grid.js:4,", "grid.js:6,");
		assert.notEqual(fixed, text1);
		const after = await plan(first.ledger, fixed);
		const d = after.files[0]?.decisions.find((x) => x.ref.text === "grid.js:6");
		assert.equal(d?.outcome, "current"); // no longer pending: its numbers are the new tag's
		// someone re-stamps the header by hand: the ledger no longer describes the file
		const restamped = text1.replace("frappe v16.33.0", "frappe v16.50.0");
		const r = await plan(first.ledger, restamped);
		assert.equal(r.files[0]?.tag.from, "header");
		assert.equal(r.files[0]?.tag.tag, "v16.50.0");
	});

	test("a later remap starts from the tag each citation follows: the ledger's for those moved, their own for those left behind", async () => {
		const v3 = ["z", "z", ...GRID_NEW]; // two more lines at the top again
		const three = { ...tags, "v16.60.0": { [`${P}form/grid.js`]: file(v3), [`${P}list/list_view.js`]: file(["q", ...LIST_NEW]) } };
		const second = (/** @type {Parameters<typeof planRemap>[0]["ledger"]} */ ledger, /** @type {string} */ text) =>
			planRemap({ declarations: [{ file: "src/a.d.ts", text }], config: CONFIG, packageTag: null, ledger, newTag: "v16.60.0", source: memorySource(three) });
		const first = await plan(null);
		const text1 = applyEdits(DTS, first.files[0]?.edits ?? []);
		const next = await second(first.ledger, text1);
		const by = (/** @type {string} */ t) => next.files[0]?.decisions.find((d) => d.ref.text === t);
		// `grid.js:5` was moved to follow v16.50.0, so it moves again from there ...
		assert.equal(by("grid.js:5")?.oldTag, "v16.50.0");
		assert.equal(by("grid.js:5")?.outcome, "moved");
		assert.equal(by("grid.js:5")?.edits[0]?.text, "7");
		// ... while `grid.js:4`, flagged and left on v16.33.0's numbering, is judged from v16.33.0
		assert.equal(by("grid.js:4")?.oldTag, "v16.33.0");
		assert.equal(by("grid.js:4")?.outcome, "modified");
		assert.deepEqual(Object.keys(next.ledger.files["src/a.d.ts"]?.pending ?? {}).sort(), ["v16.33.0"]);
	});

	test("a file with no stamp in its header still has a live ledger entry", async () => {
		const bare = "/** grid.js:3 */";
		const stampless = (/** @type {Parameters<typeof planRemap>[0]["ledger"]} */ ledger, /** @type {string} */ text) =>
			planRemap({ declarations: [{ file: "src/a.d.ts", text }], config: CONFIG, packageTag: "v16.33.0", ledger, newTag: "v16.50.0", source: memorySource(tags) });
		const first = await stampless(null, bare);
		assert.equal(first.files[0]?.tag.from, "package.json");
		const text1 = applyEdits(bare, first.files[0]?.edits ?? []);
		assert.notEqual(text1, bare);
		const again = await stampless(first.ledger, text1);
		assert.deepEqual(again.files[0]?.edits, []);
		assert.equal(again.files[0]?.tag.from, "ledger");
	});

	test("referenceTags says which tag each citation follows (what the audit asks)", async () => {
		const first = await plan(null);
		const text1 = applyEdits(DTS, first.files[0]?.edits ?? []);
		const tagsByIndex = referenceTags(text1, "src/a.d.ts", first.ledger);
		assert.ok(tagsByIndex);
		const refs = extractReferences(text1, "src/a.d.ts");
		const tagOf = (/** @type {string} */ t) => tagsByIndex.get(refs.find((r) => r.text === t)?.index ?? -1);
		assert.equal(tagOf("grid.js:5"), "v16.50.0"); // was `grid.js:3`: moved
		assert.equal(tagOf("grid.js:4"), "v16.33.0"); // flagged: still the old numbering
		assert.equal(referenceTags(text1, "src/other.d.ts", first.ledger), null);
		// a ledger that no longer matches the header is not consulted
		assert.equal(referenceTags(text1.replace("frappe v16.33.0", "frappe v16.50.0"), "src/a.d.ts", first.ledger), null);
	});

	test("a path mentioned without a number is checked for deletion, and never edited or recorded as pending", async () => {
		const text = [
			"/** Verified against frappe v16.33.0 */",
			"/** see ui/gone.js, form/grid.js:3 and form/grid.js, nowhere/else.js and carbon_frappe/public/js/x.js, grid.js */",
		].join("\n");
		const p = await plan(null, text);
		const decisions = p.files[0]?.decisions ?? [];
		const by = (/** @type {string} */ t) => decisions.find((d) => d.ref.text === t);
		assert.equal(by("ui/gone.js")?.outcome, "deleted");
		assert.equal(by("ui/gone.js")?.status, "mention-file-deleted");
		assert.deepEqual(by("ui/gone.js")?.edits, []);
		assert.equal(by("form/grid.js")?.outcome, "no-line"); // there, so nothing to say
		assert.equal(by("nowhere/else.js")?.outcome, "no-line"); // cannot be placed: a mention is not worth a complaint
		assert.equal(by("carbon_frappe/public/js/x.js")?.outcome, "out-of-scope");
		assert.equal(by("grid.js"), undefined); // without a directory it is a word, not a path
		assert.deepEqual(p.ledger.files["src/a.d.ts"]?.pending["v16.33.0"]?.map(([, t]) => t) ?? [], []); // nothing to record: it has no numbers
		const rec = flaggedRecords(p, new Map([["src/a.d.ts", text]])).flagged.find((f) => f.citation === "ui/gone.js");
		assert.deepEqual([rec?.oldLines, rec?.status], [[], "mention-file-deleted"]);
		// a mention is judged against the header's tag on EVERY run, so it keeps being reported until someone acts on it
		const again = await plan(p.ledger, text);
		assert.equal(again.files[0]?.decisions.find((d) => d.ref.text === "ui/gone.js")?.outcome, "deleted");
		// ...and stops once the header names the new tag (a person has re-read the file)
		const stamped = await plan(null, text.replace("v16.33.0", "v16.50.0"));
		assert.equal(stamped.files[0]?.decisions.find((d) => d.ref.text === "ui/gone.js")?.outcome, "no-line");
	});

	test("the file's tag comes from its header, else package.json", async () => {
		const p = await plan(null, "/** grid.js:3 */");
		assert.deepEqual(p.files[0]?.tag, { tag: "v16.33.1", from: "package.json" });
	});

	test("a file git calls renamed is followed when it is similar enough, and flagged when the citation no longer names it", async () => {
		const t = {
			"v16.33.0": { [`${P}form/old_name.js`]: file(["a", "b", "c"]), [`${P}ui/foo.js`]: file(["x", "y", "z"]) },
			"v16.50.0": { [`${P}form/new_name.js`]: file(["new", "a", "b", "c"]), [`${P}ui/sub/foo.js`]: file(["x", "y", "z"]) },
		};
		const text = "/** frappe v16.33.0 */\n/** frappe/public/js/frappe/form/old_name.js:2 and foo.js:2 */";
		const run = (/** @type {number} */ minRenameSimilarity) =>
			planRemap({
				declarations: [{ file: "src/a.d.ts", text }],
				config: CONFIG,
				packageTag: null,
				ledger: null,
				newTag: "v16.50.0",
				source: memorySource(t, { [`${P}form/old_name.js`]: `${P}form/new_name.js`, [`${P}ui/foo.js`]: `${P}ui/sub/foo.js` }),
				minRenameSimilarity,
			});
		const ok = (await run(70)).files[0]?.decisions ?? [];
		// the full path names the OLD file: only numbers are ever edited, so it is flagged, with the mapping shown
		assert.equal(ok[0]?.outcome, "renamed");
		assert.match(ok[0]?.summary ?? "", /renamed to frappe\/public\/js\/frappe\/form\/new_name\.js/);
		assert.deepEqual(ok[0]?.edits, []);
		// a bare name that the new directory still satisfies is simply moved
		assert.equal(ok[1]?.outcome, "unchanged");
		// below the threshold the file is treated as gone
		const gone = (await run(95)).files[0]?.decisions ?? [];
		assert.equal(gone[0]?.outcome, "deleted");
		assert.equal(gone[0]?.status, "file-deleted");
	});

	test("flagged records say what, where, and offer candidates as candidates", async () => {
		const p = await plan(null);
		const { flagged, uncovered } = flaggedRecords(p, new Map([["src/a.d.ts", DTS]]));
		const rec = flagged.find((f) => f.citation === "grid.js:4");
		assert.ok(rec);
		assert.equal(rec.dts, "src/a.d.ts");
		assert.equal(rec.dtsLine, 4);
		assert.equal(rec.citedPath, `${P}form/grid.js`);
		assert.equal(rec.oldTag, "v16.33.0");
		assert.deepEqual(rec.oldLines, [4]);
		assert.deepEqual(rec.oldText, ["return 1;"]);
		assert.equal(rec.status, "line-modified");
		assert.match(String(rec.hunkSummary), /@@ -4 \+6 @@/);
		const candidates = /** @type {{ line: number, basis: string }[]} */ (rec.newCandidateLines);
		assert.deepEqual(candidates.map((c) => [c.line, c.basis]), [[6, "same-hunk-replacement"]]);
		assert.deepEqual(uncovered, []);
	});
});

// ---------------------------------------------------------------------------------------------
// the checked-in config
// ---------------------------------------------------------------------------------------------

test("citation-bases.json is valid, and every declaration file has an entry that quotes what it declares", () => {
	const root = path.resolve(import.meta.dirname, "..");
	const config = checkConfig(JSON.parse(readFileSync(path.join(root, "scripts", "lib", "citation-bases.json"), "utf8")));
	const dts = readdirSync(path.join(root, "src"), { recursive: true })
		.map(String)
		.filter((n) => n.endsWith(".d.ts"))
		.map((n) => `src/${n.split(path.sep).join("/")}`)
		.sort();
	for (const f of dts) assert.ok(config.files[f], `${f} has no entry in scripts/lib/citation-bases.json: add one before its bare citations can be remapped`);
	for (const f of Object.keys(config.files)) assert.ok(dts.includes(f), `${f} is in the config but is not a declaration file`);
	// every pinned path is a repo path, not prose
	for (const [f, cfg] of Object.entries(config.files)) {
		for (const target of [...Object.values(cfg.core ?? {}), cfg.implicit ?? "frappe/x.js"]) assert.match(target, /^[\w./-]+\.\w+$/, `${f}: ${target}`);
	}
});

// ---------------------------------------------------------------------------------------------
// real git
// ---------------------------------------------------------------------------------------------

describe("createGitSource against a throwaway repository", { skip: !hasGit && "git is not installed" }, () => {
	/** @type {string} */
	let root;
	/** @type {string} */
	let cache;
	/**
	 * @param {string[]} args
	 */
	const git = (args) =>
		execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false", ...args], {
			cwd: root,
			encoding: "utf8",
			env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
		}).trim();
	/** @param {Record<string, string | null>} files */
	const write = (files) => {
		for (const [rel, text] of Object.entries(files)) {
			if (text === null) {
				rmSync(path.join(root, rel));
				continue;
			}
			mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
			writeFileSync(path.join(root, rel), text);
		}
	};
	const body = Array.from({ length: 40 }, (_, i) => `line ${i + 1} of the original body`);

	before(() => {
		root = mkdtempSync(path.join(tmpdir(), "frappe-types-remap-"));
		cache = mkdtempSync(path.join(tmpdir(), "frappe-types-remap-cache-"));
		git(["init", "--quiet"]);
		write({
			"frappe/public/js/frappe/form/grid.js": file(body),
			"frappe/public/js/frappe/ui/old_place.js": file(body.map((l) => `old ${l}`)),
			"frappe/public/js/frappe/ui/doomed.js": file(["only", "lines"]),
			"frappe/public/js/frappe/ui/same.js": file(["x", "y"]),
		});
		git(["add", "-A"]);
		git(["commit", "--quiet", "-m", "one"]);
		git(["tag", "v16.1.0"]);
		write({
			// 3 lines added at the top, line 10 edited, line 20 deleted, indentation of 30 changed
			"frappe/public/js/frappe/form/grid.js": file(["// a", "// b", "// c", ...body.map((l, i) => (i === 9 ? "line 10 EDITED" : i === 29 ? `    ${l}` : l)).filter((_, i) => i !== 19)]),
			"frappe/public/js/frappe/ui/old_place.js": null,
			"frappe/public/js/frappe/ui/new_place.js": file(["// moved", ...body.map((l) => `old ${l}`)]),
			"frappe/public/js/frappe/ui/doomed.js": null,
		});
		git(["add", "-A"]);
		git(["commit", "--quiet", "-m", "two"]);
		git(["tag", "v16.2.0"]);
	});
	after(() => {
		rmSync(root, { recursive: true, force: true });
		rmSync(cache, { recursive: true, force: true });
	});

	test("changes(): hunks, deletions and renames, as git prints them", async () => {
		const source = createGitSource({ repo: root, cacheDir: cache });
		const paths = ["form/grid.js", "ui/old_place.js", "ui/doomed.js", "ui/same.js"].map((p) => `frappe/public/js/frappe/${p}`);
		const got = await source.changes("v16.1.0", "v16.2.0", paths);
		const [grid, moved, doomed, same] = paths.map((p) => got.get(p));
		assert.equal(grid?.kind, "modified");
		assert.ok((grid?.hunks.length ?? 0) >= 3);
		assert.equal(moved?.kind, "renamed");
		assert.equal(moved?.newPath, "frappe/public/js/frappe/ui/new_place.js");
		assert.ok((moved?.similarity ?? 0) >= 90);
		assert.equal(doomed?.kind, "deleted");
		assert.equal(same?.kind, "unchanged");
		// served from the cache the second time, and identical
		const again = await createGitSource({ repo: root, cacheDir: cache }).changes("v16.1.0", "v16.2.0", paths);
		assert.deepEqual([...again], [...got]);
	});

	test("a plan over real diffs: exact numbers re-verified against both blobs, flagged lines left alone", async () => {
		const source = createGitSource({ repo: root, cacheDir: cache });
		const text = [
			"/** Verified against frappe v16.1.0 */",
			"/** grid.js:5 grid.js:10 grid.js:15 grid.js:20 grid.js:30 grid.js:40 grid.js:5-8 grid.js:5-12 */",
			"/** old_place.js:3 doomed.js:1 */",
		].join("\n");
		const p = await planRemap({
			declarations: [{ file: "src/a.d.ts", text }],
			config: CONFIG,
			packageTag: null,
			ledger: null,
			newTag: "v16.2.0",
			source,
		});
		const out = (/** @type {string} */ t) => p.files[0]?.decisions.find((d) => d.ref.text === t);
		assert.equal(out("grid.js:5")?.outcome, "moved");
		assert.equal(out("grid.js:10")?.outcome, "modified");
		assert.equal(out("grid.js:15")?.outcome, "moved");
		assert.equal(out("grid.js:20")?.outcome, "deleted");
		assert.equal(out("grid.js:30")?.outcome, "moved"); // re-indented only: same text, found
		assert.equal(out("grid.js:40")?.outcome, "moved");
		assert.equal(out("grid.js:5-8")?.outcome, "moved");
		assert.equal(out("grid.js:5-12")?.status, "range-interior-modified");
		// old_place.js was renamed, and the bare name no longer matches its new spelling
		assert.equal(out("old_place.js:3")?.outcome, "renamed");
		assert.equal(out("doomed.js:1")?.outcome, "deleted");
		// every exact mapping lands on the same text
		const old = splitLines(readGit("v16.1.0:frappe/public/js/frappe/form/grid.js"));
		const now = splitLines(readGit("v16.2.0:frappe/public/js/frappe/form/grid.js"));
		for (const [n, to] of [[5, 8], [15, 18], [30, 32], [40, 42]]) assert.equal(old[(n ?? 0) - 1]?.trim(), now[(to ?? 0) - 1]?.trim(), `line ${n}`);
	});

	/** @param {string} spec */
	function readGit(spec) {
		return git(["show", spec]);
	}
});

// ---------------------------------------------------------------------------------------------
// the command, end to end
// ---------------------------------------------------------------------------------------------

describe("scripts/remap-citations.mjs against a throwaway frappe and a throwaway copy of this repo", { skip: !hasGit && "git is not installed" }, () => {
	/** @type {string} */
	let frappe;
	/** @type {string} */
	let work;
	/** @type {string} */
	let sha1;
	/** @type {string} */
	let sha2;
	/** @param {string[]} args */
	const git = (args) =>
		execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false", ...args], {
			cwd: frappe,
			encoding: "utf8",
			env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
		}).trim();
	const GRID = "frappe/public/js/frappe/form/grid.js";
	const old = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`);
	/** @param {string[]} args */
	const run = (args) => {
		const r = spawnSync(process.execPath, [path.join(work, "scripts", "remap-citations.mjs"), "--frappe", frappe, "--new-tag", "v16.2.0", ...args], { encoding: "utf8" });
		return { status: r.status, out: r.stdout, err: r.stderr };
	};
	const dtsFile = () => path.join(work, "src", "a.d.ts");
	const DTS = [
		"/**",
		` * Verified against **frappe v16.1.0** (apps/frappe @ ${"X"}). Citations are \`file.js:line\` relative to \`frappe/public/js/frappe/\`.`,
		" */",
		"/** moved: grid.js:5 and grid.js:12-14 and grid.js:20, :25. touched: grid.js:10. file-less (:7) is left alone. */",
		"/** not ours: carbon_frappe/public/js/x.js:5, and a version v16.2.0 and a 3:4 ratio and :80 */",
		"",
	].join("\n");

	before(() => {
		frappe = mkdtempSync(path.join(tmpdir(), "frappe-types-remap-cli-frappe-"));
		work = mkdtempSync(path.join(tmpdir(), "frappe-types-remap-cli-work-"));
		git(["init", "--quiet"]);
		mkdirSync(path.join(frappe, path.dirname(GRID)), { recursive: true });
		writeFileSync(path.join(frappe, GRID), file(old));
		// the few files audit-drift insists on, so it can be run against this tree too
		writeFileSync(path.join(frappe, "frappe", "__init__.py"), '__version__ = "16.1.0"\n');
		writeFileSync(path.join(frappe, "frappe", "hooks.py"), "app_include_js = []\napp_include_css = []\napp_include_icons = []\n");
		writeFileSync(path.join(frappe, "frappe", "boot.py"), "def get_bootinfo():\n\tbootinfo.sitename = 1\n");
		git(["add", "-A"]);
		git(["commit", "--quiet", "-m", "one"]);
		git(["tag", "v16.1.0"]);
		sha1 = git(["rev-parse", "HEAD"]);
		writeFileSync(path.join(frappe, GRID), file(["// one", "// two", ...old.map((l, i) => (i === 9 ? "line 10 EDITED" : l))]));
		git(["commit", "--quiet", "-am", "two"]);
		git(["tag", "v16.2.0"]);
		sha2 = git(["rev-parse", "HEAD"]);

		cpSync(path.resolve(import.meta.dirname, "..", "scripts"), path.join(work, "scripts"), { recursive: true });
		writeFileSync(path.join(work, "scripts", "lib", "citation-bases.json"), JSON.stringify(CONFIG_JSON));
		writeFileSync(path.join(work, "package.json"), JSON.stringify({ frappe: { verifiedAgainst: "v16.1.0" } }));
		mkdirSync(path.join(work, "src"), { recursive: true });
		writeFileSync(dtsFile(), DTS.replace("X", sha1.slice(0, 10)));
	});
	after(() => {
		rmSync(frappe, { recursive: true, force: true });
		rmSync(work, { recursive: true, force: true });
	});

	const CONFIG_JSON = {
		schema: 1,
		outOfScope: [{ prefix: "carbon_frappe/", owner: "carbon_frappe" }],
		files: { "src/a.d.ts": { declared: "relative to frappe/public/js/frappe/", bases: ["frappe/public/js/frappe/"], basis: "header" } },
	};

	test("a dry run reads everything and writes nothing", () => {
		const before = readFileSync(dtsFile(), "utf8");
		const r = run(["--flagged-json", path.join(work, "flagged.json")]);
		assert.equal(r.status, 0, r.err);
		assert.match(r.out, /dry run: nothing written/);
		assert.match(r.out, /would change 5 line number/);
		assert.equal(readFileSync(dtsFile(), "utf8"), before);
		assert.equal(existsSync(path.join(work, "citation-anchors.json")), false);
		const flagged = JSON.parse(readFileSync(path.join(work, "flagged.json"), "utf8"));
		assert.deepEqual(flagged.flagged.map((/** @type {{ citation: string }} */ f) => f.citation), ["grid.js:10"]);
		assert.deepEqual(flagged.uncovered.map((/** @type {{ citation: string }} */ u) => u.citation), [":7", ":80"]);
		assert.equal(flagged.flagged[0].oldText[0], "line 10");
	});

	test("--apply rewrites digits and only digits; a second run, and a third, change nothing", () => {
		const before = readFileSync(dtsFile(), "utf8");
		assert.equal(run(["--apply"]).status, 0);
		const after = readFileSync(dtsFile(), "utf8");
		assert.notEqual(after, before);
		// same text with every run of digits blanked: nothing but numbers moved
		assert.equal(after.replace(/\d+/g, "#"), before.replace(/\d+/g, "#"));
		assert.match(after, /grid\.js:7 and grid\.js:14-16 and grid\.js:22, :27\./);
		assert.match(after, /touched: grid\.js:10\./); // not exact: untouched
		assert.match(after, /file-less \(:7\)/); // never edited
		assert.match(after, /carbon_frappe\/public\/js\/x\.js:5, and a version v16\.2\.0 and a 3:4 ratio and :80/);
		assert.match(after, /frappe v16\.1\.0/); // not stamped
		const ledger = readFileSync(path.join(work, "citation-anchors.json"), "utf8");

		const again = run(["--apply"]);
		assert.match(again.out, /writing 0 line number/);
		assert.equal(readFileSync(dtsFile(), "utf8"), after);
		assert.equal(readFileSync(path.join(work, "citation-anchors.json"), "utf8"), ledger);
		assert.match(again.out, /src\/a\.d\.ts\s+v16\.2\.0/); // the tag now in force is the ledger's
		assert.equal(run(["--apply"]).status, 0);
		assert.equal(readFileSync(dtsFile(), "utf8"), after);
	});

	test("audit-drift stops counting a moved number as a changed one once the ledger says it was moved", () => {
		const audit = () => {
			const r = spawnSync(process.execPath, [path.join(work, "scripts", "audit-drift.mjs"), "--frappe", frappe, "--from", "v16.1.0", "--at", "v16.2.0"], { encoding: "utf8" });
			assert.equal(r.status, 0, r.stderr);
			return r.stdout;
		};
		const ledgerFile = path.join(work, "citation-anchors.json");
		const savedText = readFileSync(dtsFile(), "utf8");
		const savedLedger = readFileSync(ledgerFile, "utf8");
		try {
			// the audit measures full-path citations only: cite grid.js that way, from the old tag's numbering
			writeFileSync(dtsFile(), `${DTS.replace("X", sha1.slice(0, 10))}/** frappe/public/js/frappe/form/grid.js:15 and frappe/public/js/frappe/form/grid.js:10 */\n`);
			rmSync(ledgerFile);
			const naive = audit();
			assert.match(naive, /text differs between the two trees: 2 of 2/);
			assert.doesNotMatch(naive, /left out of that comparison/);
			assert.equal(run(["--apply"]).status, 0);
			const aware = audit();
			// `:15` was moved (it follows v16.2.0 and is not compared); `:10` was edited, so it is still on v16.1.0's numbering and still differs
			assert.match(aware, /text differs between the two trees: 1 of 1/);
			assert.match(aware, /1 citation\(s\) \(1 anchors\) were left out of that comparison/);
		} finally {
			writeFileSync(dtsFile(), savedText);
			writeFileSync(ledgerFile, savedLedger);
		}
	});

	test("--stamp without --apply previews; --apply --stamp changes the header and nothing below it", () => {
		const before = readFileSync(dtsFile(), "utf8");
		run(["--stamp"]);
		assert.equal(readFileSync(dtsFile(), "utf8"), before);
		assert.equal(run(["--apply", "--stamp"]).status, 0);
		const after = readFileSync(dtsFile(), "utf8");
		const [head, ...rest] = after.split("*/\n");
		assert.match(head ?? "", /frappe v16\.2\.0/);
		assert.ok((head ?? "").includes(`@ ${sha2.slice(0, 10)}`), "the sha is re-stamped at its own length");
		assert.equal(rest.join("*/\n"), before.split("*/\n").slice(1).join("*/\n"));
		// a stamped file has no ledger entry any more, and the next run sees every number as current
		const next = run([]);
		assert.match(next.out, /would change 0 line number/);
		assert.doesNotMatch(readFileSync(path.join(work, "citation-anchors.json"), "utf8"), /a\.d\.ts/);
	});

	test("usage errors exit 2 and name the problem", () => {
		const r = spawnSync(process.execPath, [path.join(work, "scripts", "remap-citations.mjs"), "--frappe", "/nonexistent/frappe"], { encoding: "utf8" });
		assert.equal(r.status, 2);
		assert.match(r.stderr, /frappe checkout/);
		const bad = run(["--min-rename-similarity", "10"]);
		assert.equal(bad.status, 2);
	});
});

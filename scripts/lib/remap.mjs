// Move the `file:line` citations in src/**/*.d.ts to where the text they cited now is.
//
// citations.mjs MEASURES how much of the evidence went stale ("55% of the line anchors
// now read differently"). Most of that is not rot: frappe inserted lines above the
// cited ones and the text merely moved down. Re-reading 3,900 citations to find the few
// hundred whose text really changed is not a good use of a human, and not something to
// do by eye, so this separates the two mechanically:
//
//   * a cited line that no diff hunk touches is the SAME text at a computable position —
//     its new number is the old one plus the net lines added or removed above it. That
//     is not an estimate; every such mapping is re-checked against both blobs (`trim()`
//     equal, the notion of "same text" citations.mjs already uses) before it is reported
//     as exact, and a mapping that fails the check is reported as a failure, not applied;
//   * a cited line inside a hunk was modified or deleted. No number is chosen for it.
//     It goes to a human with the old text and, clearly labelled as CANDIDATES rather
//     than facts, the nearest lines of the new file by text similarity.
//
// WHAT THIS DOES NOT DO. It never decides that a changed line "still means the same
// thing", it never edits prose, and it never claims a file was re-verified: the
// `Verified against vX` stamps change only under an explicit `--stamp`, because
// stamping asserts a human read the source. See remap-citations.mjs for the CLI.
//
// WHAT COUNTS AS A CITATION is exactly what citations.mjs's grammar says (this module
// calls its `scanCitations` and so cannot drift from it), plus ONE extension: a spaced
// continuation of a list that is already a citation — `notifications.js:5, :127`,
// `grid.js:1068 and :1075`, `desk.js:332 / :364`, `formatters.js:412 + :416-419`.
// `:44,61,70` is one citation to the grammar; the same list with a space in it is the
// same list to a reader, and remapping only its first number would leave half of it
// stale. A file-less `:127` with NO citation next to it (`(:9)`, `at :69`) names its
// file only by context. Where a file's header declares that context outright
// (notifications.d.ts: "Citations are `notifications.js:line`") the config says so and
// they are remapped; everywhere else they are reported as "uncovered" and never edited.

import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { scanCitations, scanMentions } from "./citations.mjs";
import { cmp, diffZero, gitReader, nameStatus } from "./frappe-reader.mjs";

// ---------------------------------------------------------------------------------------------
// Line specs: `:22`, `:22-296`, `:44,61,70`, `:1-3,7`
// ---------------------------------------------------------------------------------------------

const SPEC = /^:\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/;
// What may join a further `:N` to a citation that already ends in a line spec. Spaces and
// tabs only: a newline means a different comment line, and a different sentence.
const CONTINUATION = /(?:,[ \t]+(?:and[ \t]+)?|[ \t]+and[ \t]+|[ \t]+[/+][ \t]+)(:\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*)(?!\w)/y;
const TRAILING_SPEC = /:\d+(?:[-,]\d+)*$/;

/**
 * @typedef {{ kind: "line", n: number, at: number } | { kind: "range", a: number, b: number, atA: number, atB: number }} SpecItem
 *   `at*` are offsets of the digits within the spec string, so a rewrite can touch the
 *   digits and nothing around them.
 */

/**
 * @param {string} spec `:12`, `:12-26`, `:44,61,70`
 * @returns {SpecItem[] | null} null when it is not a well-formed spec (`:1-2-3`, `:30-20`, `:0`)
 */
export function parseSpec(spec) {
	if (!SPEC.test(spec)) return null;
	/** @type {SpecItem[]} */
	const items = [];
	for (const m of spec.matchAll(/(\d+)(?:-(\d+))?/g)) {
		const a = Number(m[1]);
		const atA = m.index;
		if (m[2] === undefined) {
			if (a < 1) return null;
			items.push({ kind: "line", n: a, at: atA });
		} else {
			const b = Number(m[2]);
			if (a < 1 || b < a) return null;
			items.push({ kind: "range", a, b, atA, atB: atA + (m[1] ?? "").length + 1 });
		}
	}
	return items;
}

/**
 * @typedef {object} Reference one citation as written in a declaration file
 * @property {"full" | "relative" | "implicit"} form `frappe/<path>` (carries its own base), a bare/relative path,
 *   or a file-less `:N` whose file is whatever its context says
 * @property {string} text everything that was matched, first spec and continuations included
 * @property {number} index offset of `text` in the file
 * @property {number} line 1-based line in the .d.ts
 * @property {string} written the path exactly as written, without any line spec
 * @property {string[]} candidates for `full`: the repo paths it can mean, in order of preference
 * @property {boolean} malformed a line spec that is not a well-formed one
 * @property {{ at: number, text: string }[]} segments each line spec in it, `at` being the absolute offset
 * @property {SpecItem[]} items every line or range cited, in order, across all segments
 */

/**
 * Every citation in one declaration file, in text order: full paths, bare paths, and
 * file-less `:N`s (form `implicit`), which only resolve where the config says what file a
 * header's citations mean.
 * @param {string} text
 * @param {string} file
 * @returns {Reference[]}
 */
export function extractReferences(text, file) {
	const { full, unresolvable } = scanCitations(text, file);
	const starts = [0];
	for (let i = text.indexOf("\n"); i !== -1; i = text.indexOf("\n", i + 1)) starts.push(i + 1);
	/** @type {Reference[]} */
	const refs = [];
	for (const c of full) refs.push(buildReference(text, "full", c.text, c.index, c.line, c.candidates));
	for (const u of unresolvable) refs.push(buildReference(text, "relative", u.text, u.index, u.line, []));
	// A path written with no line number (`form/sidebar/document_follow.js`) is a reference with nothing to move:
	// kept so that the file it names being deleted is not missed. A full path with no line already is one.
	const taken = refs.map((r) => [r.index, r.index + r.text.length]);
	for (const m of scanMentions(text)) {
		if (taken.some(([from, to]) => m.index < (to ?? 0) && m.index + m.text.length > (from ?? 0))) continue;
		refs.push(buildReference(text, "relative", m.text, m.index, lineAt(starts, m.index), []));
	}
	/** @type {number[][]} */
	const covered = refs.flatMap((r) => r.segments.map((s) => [s.at, s.at + s.text.length]));
	for (const m of text.matchAll(FILELESS)) {
		if (covered.some(([from, to]) => m.index >= (from ?? 0) && m.index < (to ?? 0))) continue;
		const ref = buildReference(text, "implicit", m[0], m.index, lineAt(starts, m.index), []);
		// A chain (`:69, :75, :81`) is one reference: the matches inside it are not separate ones.
		for (const s of ref.segments) covered.push([s.at, s.at + s.text.length]);
		refs.push(ref);
	}
	return refs.sort((x, y) => x.index - y.index);
}

/**
 * @param {readonly number[]} starts offset of the start of every line
 * @param {number} offset
 * @returns {number} 1-based line
 */
function lineAt(starts, offset) {
	let lo = 0;
	let hi = starts.length - 1;
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		if ((starts[mid] ?? 0) <= offset) lo = mid;
		else hi = mid - 1;
	}
	return lo + 1;
}

/**
 * @param {string} text
 * @param {"full" | "relative" | "implicit"} form
 * @param {string} matched
 * @param {number} index
 * @param {number} line
 * @param {string[]} candidates
 * @returns {Reference}
 */
function buildReference(text, form, matched, index, line, candidates) {
	const spec = TRAILING_SPEC.exec(matched)?.[0] ?? "";
	const written = matched.slice(0, matched.length - spec.length);
	/** @type {{ at: number, text: string }[]} */
	const segments = [];
	if (spec !== "") {
		segments.push({ at: index + written.length, text: spec });
		// Only after a spec: `foo.js, :12` is not a continuation of anything.
		let end = index + matched.length;
		for (;;) {
			CONTINUATION.lastIndex = end;
			const m = CONTINUATION.exec(text);
			if (!m) break;
			const more = m[1] ?? "";
			segments.push({ at: end + m[0].length - more.length, text: more });
			end += m[0].length;
		}
	}
	/** @type {SpecItem[]} */
	const items = [];
	let malformed = false;
	for (const segment of segments) {
		const parsed = parseSpec(segment.text);
		if (!parsed) malformed = true;
		else for (const item of parsed) items.push(shift(item, segment.at));
	}
	const last = segments.at(-1);
	return {
		form,
		text: last ? text.slice(index, last.at + last.text.length) : matched,
		index,
		line,
		written,
		candidates,
		malformed,
		segments,
		items,
	};
}

/**
 * @param {SpecItem} item
 * @param {number} by
 * @returns {SpecItem}
 */
function shift(item, by) {
	return item.kind === "line" ? { ...item, at: item.at + by } : { ...item, atA: item.atA + by, atB: item.atB + by };
}

/**
 * Line numbers a reference cites, flat, in order (a range contributes both ends).
 * @param {Reference} ref
 * @returns {number[]}
 */
export function citedNumbers(ref) {
	return ref.items.flatMap((item) => (item.kind === "line" ? [item.n] : [item.a, item.b]));
}

// ---------------------------------------------------------------------------------------------
// File-less `:N`
// ---------------------------------------------------------------------------------------------

// A `:N` / `:a-b` with no file in front of it: `(:9)`, `at :69`, `, :127`. The lookbehinds
// keep out anything that has a left-hand side — `a:12` (a path or a label), `3:4` (a
// ratio), `10:30` (a time), `::1`, `v16.50.0:`, `localhost:8080`.
const FILELESS = /(?<![\w.\])"'`/:-])(?<![0-9]):\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*(?![\w:])/g;

// ---------------------------------------------------------------------------------------------
// Header stamps
// ---------------------------------------------------------------------------------------------

/**
 * The header of a declaration file: everything above its first line of code. That is
 * where each file says which frappe tag it was read from; a version mentioned further
 * down ("`frappe/public/js` at v16.33.0 finds `frappe.client` only as a string") is a
 * claim about one grep, not about the file's line numbers.
 * @param {string} text
 * @returns {{ text: string, end: number }} `end` is the offset of the first code line
 */
export function headerBlock(text) {
	let offset = 0;
	for (const line of text.split("\n")) {
		if (line.trim() !== "" && !/^\s*(\/\/|\/\*|\*)/.test(line)) break;
		offset += line.length + 1;
	}
	const end = Math.min(offset, text.length);
	return { text: text.slice(0, end), end };
}

/**
 * The frappe tags the header names (`v16.33.0`) and any commit shas written beside them
 * (`apps/frappe @ 33bf510b17`). Not `frappe-charts@2.0.0` or `datatable 1.20.7`: a tag
 * is written with its `v`.
 * @param {string} text
 * @returns {{ tags: string[], shas: string[] }}
 */
export function readStamp(text) {
	const header = headerBlock(text).text;
	return {
		tags: [...new Set([...header.matchAll(/(?<![\w@.-])v(\d+\.\d+\.\d+)(?![\w-]|\.\d)/g)].map((m) => `v${m[1]}`))],
		shas: [...new Set([...header.matchAll(/@ ([0-9a-f]{7,40})\b/g)].map((m) => m[1] ?? ""))],
	};
}

/**
 * Re-stamp a header: every `from` tag becomes `to`, and a sha that is a prefix of
 * `fromSha` becomes `toSha` at the same length. Nothing below the header is touched.
 * @param {string} text
 * @param {{ from: string, to: string, fromSha?: string | null, toSha?: string | null }} stamp
 * @returns {string}
 */
export function applyStamp(text, { from, to, fromSha, toSha }) {
	const { text: header, end } = headerBlock(text);
	let next = header.replace(new RegExp(`(?<![\\w@.-])${escapeRegExp(from)}(?![\\w-]|\\.\\d)`, "g"), to);
	if (fromSha && toSha) {
		next = next.replace(/@ ([0-9a-f]{7,40})\b/g, (whole, sha) => (fromSha.startsWith(sha) ? `@ ${toSha.slice(0, sha.length)}` : whole));
	}
	return next + text.slice(end);
}

/** @param {string} s */
function escapeRegExp(s) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------------------------
// Diffs and line mapping
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {object} Hunk `@@ -oldStart,oldCount +newStart,newCount @@` from `git diff -U0`.
 *   With `oldCount` 0 it is a pure insertion AFTER old line `oldStart`; with `newCount` 0
 *   a pure deletion, and `newStart` is then the new line before the gap.
 * @property {number} oldStart
 * @property {number} oldCount
 * @property {number} newStart
 * @property {number} newCount
 */

/**
 * @typedef {object} FileChange what became of a cited file between two tags
 * @property {"unchanged" | "modified" | "deleted" | "renamed"} kind
 * @property {string} oldPath
 * @property {string | null} newPath null when it no longer exists under any name git recognises
 * @property {number | null} similarity percent, for a rename
 * @property {Hunk[]} hunks
 * @property {boolean} binary
 */

/**
 * Parse `git diff -U0` output into one record per file, keyed by its path at the old tag.
 * @param {string} patch
 * @returns {Map<string, FileChange>}
 */
export function parseDiff(patch) {
	/** @type {Map<string, FileChange>} */
	const out = new Map();
	/** @type {FileChange | null} */
	let cur = null;
	const commit = () => {
		if (cur?.oldPath) out.set(cur.oldPath, cur);
		cur = null;
	};
	for (const line of patch.split("\n")) {
		if (line.startsWith("diff --git ")) {
			commit();
			const both = samePath(line.slice("diff --git ".length));
			cur = { kind: "modified", oldPath: both ?? "", newPath: both, similarity: null, hunks: [], binary: false };
		} else if (!cur) {
			continue;
		} else if (line.startsWith("rename from ")) {
			cur.oldPath = line.slice("rename from ".length);
			cur.kind = "renamed";
		} else if (line.startsWith("rename to ")) {
			cur.newPath = line.slice("rename to ".length);
		} else if (line.startsWith("similarity index ")) {
			cur.similarity = Number.parseInt(line.slice("similarity index ".length), 10);
		} else if (line.startsWith("deleted file mode")) {
			cur.kind = "deleted";
			cur.newPath = null;
		} else if (line.startsWith("--- ")) {
			if (line !== "--- /dev/null") cur.oldPath = stripSide(line.slice(4), "a/");
		} else if (line.startsWith("+++ ")) {
			if (line === "+++ /dev/null") cur.newPath = null;
			else cur.newPath = stripSide(line.slice(4), "b/");
		} else if (line.startsWith("Binary files ")) {
			cur.binary = true;
		} else if (line.startsWith("@@ ")) {
			const m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
			if (!m) throw new Error(`unparseable hunk header: ${line}`);
			cur.hunks.push({
				oldStart: Number(m[1]),
				oldCount: m[2] === undefined ? 1 : Number(m[2]),
				newStart: Number(m[3]),
				newCount: m[4] === undefined ? 1 : Number(m[4]),
			});
		}
	}
	commit();
	return out;
}

/**
 * `a/p b/p` -> `p`, for a header whose two sides are the same path; null otherwise
 * (a rename, whose `rename from`/`to` lines say it better).
 * @param {string} header
 * @returns {string | null}
 */
function samePath(header) {
	if (!header.startsWith("a/")) return null;
	const half = (header.length - 5) / 2;
	if (!Number.isInteger(half)) return null;
	const left = header.slice(2, 2 + half);
	return header.slice(2 + half) === ` b/${left}` ? left : null;
}

/**
 * @param {string} p
 * @param {string} side
 */
function stripSide(p, side) {
	return (p.startsWith(side) ? p.slice(side.length) : p).replace(/\t.*$/, "");
}

/**
 * A change nothing happened to.
 * @param {string} oldPath
 * @returns {FileChange}
 */
export function unchanged(oldPath) {
	return { kind: "unchanged", oldPath, newPath: oldPath, similarity: null, hunks: [], binary: false };
}

/** @param {readonly string[]} lines */
const nonBlank = (lines) => lines.map((l) => l.trim()).filter((l) => l !== "");

/**
 * Lines of a file as `git diff` counts them: a final newline does not start a new line.
 * @param {string} text
 * @returns {string[]}
 */
export function splitLines(text) {
	const lines = text.split(/\r?\n/);
	if (lines.at(-1) === "") lines.pop();
	return lines;
}

/**
 * Did this hunk change anything a reader would call a change? Not if, ignoring blank
 * lines and leading/trailing whitespace, what it removed is exactly what it added —
 * re-indentation, a blank line gained or lost. Same notion of "same text" as
 * citations.mjs (`trim()`), extended to blank lines because their count is the one
 * thing an insertion above a citation changes without touching its text.
 * @param {Hunk} h
 * @param {readonly string[]} oldLines
 * @param {readonly string[]} newLines
 */
function isImmaterial(h, oldLines, newLines) {
	const removed = nonBlank(oldLines.slice(h.oldStart - 1, h.oldStart - 1 + h.oldCount));
	const added = h.newCount > 0 ? nonBlank(newLines.slice(h.newStart - 1, h.newStart - 1 + h.newCount)) : [];
	return removed.length === added.length && removed.every((t, i) => t === added[i]);
}

/**
 * @typedef {object} LineVerdict
 * @property {number} n the cited old line
 * @property {"same" | "moved" | "modified" | "deleted" | "invalid" | "unverified"} status
 *   same: reads identically at the same number; moved: identically at `to`;
 *   modified / deleted: inside a hunk that replaced / removed it; invalid: the old file has no such line;
 *   unverified: the mapping came out and the text did not match — a bug, never applied
 * @property {number | null} to its line in the new file, for same / moved
 * @property {number} expected where it would be if nothing in its own hunk had happened (the position candidates are searched around)
 * @property {Hunk | null} hunk the hunk it sits in, for modified / deleted
 */

/**
 * Where did old line `n` go?
 * @param {FileChange} change
 * @param {readonly string[]} oldLines
 * @param {readonly string[]} newLines
 * @param {number} n 1-based
 * @returns {LineVerdict}
 */
export function mapLine(change, oldLines, newLines, n) {
	if (n < 1 || n > oldLines.length) return { n, status: "invalid", to: null, expected: n, hunk: null };
	let offset = 0;
	for (const h of change.hunks) {
		if (h.oldCount === 0) {
			// An insertion after old line `oldStart` does not touch it, nor anything before it.
			if (n <= h.oldStart) break;
			offset += h.newCount;
			continue;
		}
		if (n < h.oldStart) break;
		if (n < h.oldStart + h.oldCount) {
			if (isImmaterial(h, oldLines, newLines) && (oldLines[n - 1] ?? "").trim() !== "") {
				// Same text, re-indented or with blank lines around it: find it by its rank among the
				// non-blank lines the hunk removed.
				let rank = 0;
				for (let i = h.oldStart; i < n; i++) if ((oldLines[i - 1] ?? "").trim() !== "") rank++;
				let seen = -1;
				for (let j = 0; j < h.newCount; j++) {
					if ((newLines[h.newStart - 1 + j] ?? "").trim() === "") continue;
					if (++seen === rank) return verify(oldLines, newLines, n, h.newStart + j, n + offset);
				}
			}
			return { n, status: h.newCount === 0 ? "deleted" : "modified", to: null, expected: n + offset, hunk: h };
		}
		offset += h.newCount - h.oldCount;
	}
	return verify(oldLines, newLines, n, n + offset, n + offset);
}

/**
 * The invariant every "exact" mapping rests on: the two lines read the same.
 * @param {readonly string[]} oldLines
 * @param {readonly string[]} newLines
 * @param {number} n
 * @param {number} to
 * @param {number} expected
 * @returns {LineVerdict}
 */
function verify(oldLines, newLines, n, to, expected) {
	const same = (oldLines[n - 1] ?? "").trim() === (newLines[to - 1] ?? "").trim() && newLines[to - 1] !== undefined;
	if (!same) return { n, status: "unverified", to, expected, hunk: null };
	return { n, status: to === n ? "same" : "moved", to, expected, hunk: null };
}

/**
 * Hunks that changed something between old lines `a` and `b` exclusive — the interior
 * of a range.
 * @param {FileChange} change
 * @param {readonly string[]} oldLines
 * @param {readonly string[]} newLines
 * @param {number} a
 * @param {number} b
 * @returns {Hunk[]}
 */
export function interiorChanges(change, oldLines, newLines, a, b) {
	return change.hunks.filter((h) => {
		const inside = h.oldCount === 0 ? a <= h.oldStart && h.oldStart + 1 <= b : h.oldStart <= b - 1 && h.oldStart + h.oldCount - 1 >= a + 1;
		return inside && !isImmaterial(h, oldLines, newLines);
	});
}

/** @param {Hunk} h */
export function hunkLabel(h) {
	const part = (/** @type {number} */ start, /** @type {number} */ count) => (count === 1 ? `${start}` : `${start},${count}`);
	return `@@ -${part(h.oldStart, h.oldCount)} +${part(h.newStart, h.newCount)} @@`;
}

// ---------------------------------------------------------------------------------------------
// Judging a whole citation
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {object} ItemVerdict one number or range of a citation
 * @property {SpecItem} item
 * @property {LineVerdict} start the line, or a range's first line
 * @property {LineVerdict | null} end a range's last line
 * @property {Hunk[]} interior material hunks strictly inside a range
 * @property {boolean} exact it can be rewritten with certainty
 */

/**
 * @param {SpecItem} item
 * @param {FileChange} change
 * @param {readonly string[]} oldLines
 * @param {readonly string[]} newLines
 * @returns {ItemVerdict}
 */
export function judgeItem(item, change, oldLines, newLines) {
	const ok = (/** @type {LineVerdict} */ v) => v.status === "same" || v.status === "moved";
	if (item.kind === "line") {
		const start = mapLine(change, oldLines, newLines, item.n);
		return { item, start, end: null, interior: [], exact: ok(start) };
	}
	const start = mapLine(change, oldLines, newLines, item.a);
	const end = mapLine(change, oldLines, newLines, item.b);
	const interior = interiorChanges(change, oldLines, newLines, item.a, item.b);
	return { item, start, end, interior, exact: ok(start) && ok(end) && interior.length === 0 };
}

/**
 * Words of a line, for comparing lines that are not identical.
 * @param {string} line
 * @returns {string[]}
 */
function tokens(line) {
	return line.toLowerCase().match(/[a-z0-9_$]+/g) ?? [];
}

/**
 * Dice coefficient of two token multisets.
 * @param {readonly string[]} a
 * @param {readonly string[]} b
 */
function dice(a, b) {
	if (a.length === 0 || b.length === 0) return 0;
	/** @type {Map<string, number>} */
	const seen = new Map();
	for (const t of b) seen.set(t, (seen.get(t) ?? 0) + 1);
	let shared = 0;
	for (const t of a) {
		const left = seen.get(t) ?? 0;
		if (left > 0) {
			shared++;
			seen.set(t, left - 1);
		}
	}
	return (2 * shared) / (a.length + b.length);
}

/**
 * @typedef {object} Candidate a guess, not a fact
 * @property {number} line
 * @property {string} text trimmed
 * @property {number} score 1 for identical text, else token similarity 0..1 (two decimals)
 * @property {"identical-text" | "similar-text" | "same-hunk-replacement"} basis
 */

/**
 * Where might a modified or deleted line have gone? Lines of the new file that read the
 * same as it did (it was moved, or its neighbours were edited around it), else the most
 * similar lines. Offered to a reviewer to look at, never applied: a line this close in
 * text can still be a different statement.
 * @param {string} oldText
 * @param {readonly string[]} newLines
 * @param {readonly string[][]} newTokens `tokens()` of each of `newLines`, precomputed once per file
 * @param {number} expected
 * @param {number} [max]
 * @returns {Candidate[]}
 */
export function findCandidates(oldText, newLines, newTokens, expected, max = 3) {
	const target = oldText.trim();
	const words = tokens(target);
	// `}` and `});` are the same text everywhere, which is no evidence of anything.
	if (target.length < 8 || words.length < 2) return [];
	/** @type {Candidate[]} */
	const all = [];
	newLines.forEach((line, i) => {
		const text = line.trim();
		if (text === target) {
			all.push({ line: i + 1, text, score: 1, basis: "identical-text" });
			return;
		}
		const score = dice(words, newTokens[i] ?? []);
		if (score >= 0.6) all.push({ line: i + 1, text, score: Math.round(score * 100) / 100, basis: "similar-text" });
	});
	return all
		.sort((x, y) => y.score - x.score || Math.abs(x.line - expected) - Math.abs(y.line - expected) || x.line - y.line)
		.slice(0, max);
}

/**
 * @param {readonly string[]} lines
 * @returns {string[][]}
 */
export function tokenizeLines(lines) {
	return lines.map(tokens);
}

/**
 * For a line git says was REPLACED (not removed), the lines that replaced it: what the
 * diff itself paired it with, offered because a similarity threshold would discard
 * exactly the rewritten line a reviewer most wants to see. The two closest in text.
 * @param {string} oldText
 * @param {Hunk} hunk
 * @param {readonly string[]} newLines
 * @param {readonly string[][]} newTokens
 * @param {number} [max]
 * @returns {Candidate[]}
 */
export function hunkReplacements(oldText, hunk, newLines, newTokens, max = 2) {
	const words = tokens(oldText.trim());
	/** @type {Candidate[]} */
	const out = [];
	for (let i = hunk.newStart - 1; i < hunk.newStart - 1 + hunk.newCount; i++) {
		const text = (newLines[i] ?? "").trim();
		if (text === "") continue;
		out.push({ line: i + 1, text, score: Math.round(dice(words, newTokens[i] ?? []) * 100) / 100, basis: "similar-text" });
	}
	return out.sort((x, y) => y.score - x.score || x.line - y.line).slice(0, max);
}

// ---------------------------------------------------------------------------------------------
// Where a bare citation lives: the checked-in config
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {object} OutOfScopeRule
 * @property {string} prefix a path prefix as written (`carbon_frappe/`)
 * @property {string} owner what it is instead of frappe core
 * @property {string} [why]
 */

/**
 * @typedef {object} FileConfig
 * @property {string} declared what the file's header says its citations are relative to, quoted
 * @property {string[]} bases directories bare names are looked for under, in order of preference. `""` is the repo root.
 * @property {string} [basis] `header` when `declared` is the file's own statement; otherwise what the choice rests on
 * @property {string} [default] owner of bare names not listed in `core`; `frappe` (the default) means "look in the bases"
 * @property {Record<string, string>} [notCore] bare name -> owner (`carbon_frappe`, `frappe-datatable`, ...)
 * @property {Record<string, string>} [core] bare name -> repo path, where the name alone cannot say
 * @property {Record<string, string>} [ambiguous] bare name -> why it cannot be resolved in this file
 * @property {string} [implicit] repo path of the file a file-less `:N` means, for a file whose header says so outright
 * @property {string[]} [notes] why the entries above are what they are, for the next person to read
 */

/**
 * @typedef {object} CitationConfig
 * @property {number} schema
 * @property {OutOfScopeRule[]} outOfScope
 * @property {Record<string, FileConfig>} files
 */

/**
 * @param {unknown} value
 * @returns {CitationConfig}
 */
export function checkConfig(value) {
	/** @param {string} why @returns {never} */
	const fail = (why) => {
		throw new Error(`citation-bases.json: ${why}`);
	};
	if (typeof value !== "object" || value === null) return fail("not an object");
	const config = /** @type {CitationConfig} */ (value);
	if (config.schema !== 1) fail(`schema is ${config.schema}, this tool reads 1`);
	if (!Array.isArray(config.outOfScope)) fail("outOfScope must be a list");
	for (const rule of config.outOfScope) {
		if (typeof rule.prefix !== "string" || typeof rule.owner !== "string") fail(`bad outOfScope rule ${JSON.stringify(rule)}`);
	}
	for (const [file, cfg] of Object.entries(config.files ?? {})) {
		if (typeof cfg.declared !== "string" || cfg.declared === "") fail(`${file}: say what its header declares (quote it, or say there is none)`);
		if (!Array.isArray(cfg.bases) || cfg.bases.some((b) => typeof b !== "string" || (b !== "" && !b.endsWith("/")))) {
			fail(`${file}: bases must be directories ending in "/" ("" is the repo root)`);
		}
	}
	return config;
}

/**
 * @typedef {{ scope: "core", path: string, basis: "full-path" | "alias" | "base" | "in-file-mention" | "implicit-file" }
 *   | { scope: "not-core", owner: string }
 *   | { scope: "unresolved", reason: string, candidates: string[] }} Resolution
 */

/**
 * An index over one tag's file list, for finding a bare name by its tail.
 * @typedef {object} TreeIndex
 * @property {Set<string>} files
 * @property {Map<string, string[]>} byName files by last path segment
 */

/**
 * @param {readonly string[]} files
 * @returns {TreeIndex}
 */
export function indexTree(files) {
	/** @type {Map<string, string[]>} */
	const byName = new Map();
	for (const f of files) {
		const name = f.slice(f.lastIndexOf("/") + 1);
		const list = byName.get(name);
		if (list) list.push(f);
		else byName.set(name, [f]);
	}
	return { files: new Set(files), byName };
}

/**
 * @param {TreeIndex} tree
 * @param {string} base
 * @param {string} name a path as written, possibly with directories
 * @returns {string[]} the files under `base` whose path ends with `name`
 */
function findUnder(tree, base, name) {
	const last = name.slice(name.lastIndexOf("/") + 1);
	return (tree.byName.get(last) ?? []).filter((f) => f.startsWith(base) && (f === base + name || f.endsWith(`/${name}`)));
}

/**
 * What a citation points at. Order matters:
 *   0. a file-less `:N` means the file the config says the header declares, else nothing;
 *   1. a prefix that is never frappe core (`carbon_frappe/`, `tables/`, `node_modules/`);
 *   2. a full `frappe/<path>` resolves against the old tree;
 *   3. the file's own notes, which are statements from the config, each quoting the
 *      header or the prose they rest on: names it admits it uses for two files
 *      (unresolved), names it pins to a path, names that belong to another owner, and
 *      the owner of every name it does not pin (`default`);
 *   4. a bare name is looked for under the file's declared bases, in order. One file ->
 *      that file. Several -> the file the declaration itself names in full somewhere
 *      (`frappe/public/js/frappe/ui/page.js`, written out in its header) if exactly one
 *      of them is; else UNRESOLVED. Never the first, never the nearest.
 * @param {Reference} ref
 * @param {object} context
 * @param {CitationConfig} context.config
 * @param {FileConfig | undefined} context.file
 * @param {TreeIndex} context.tree the tree at the tag these numbers were valid for
 * @param {ReadonlySet<string>} context.mentioned repo paths the declaration file writes out in full
 * @returns {Resolution}
 */
export function resolveReference(ref, { config, file, tree, mentioned }) {
	const written = ref.written;
	if (ref.form === "implicit") {
		const pinned = file?.implicit;
		if (!pinned) return { scope: "unresolved", reason: "no-file-named", candidates: [] };
		return tree.files.has(pinned)
			? { scope: "core", path: pinned, basis: "implicit-file" }
			: { scope: "unresolved", reason: "implicit-file-missing-at-old-tag", candidates: [pinned] };
	}
	for (const rule of config.outOfScope) {
		if (written.startsWith(rule.prefix) || ref.candidates.some((c) => c.startsWith(rule.prefix) || c.startsWith(`frappe/${rule.prefix}`))) {
			return { scope: "not-core", owner: rule.owner };
		}
	}
	if (ref.form === "full") {
		for (const candidate of ref.candidates) if (tree.files.has(candidate)) return { scope: "core", path: candidate, basis: "full-path" };
		return { scope: "unresolved", reason: "no-file-at-old-tag", candidates: [...ref.candidates] };
	}
	if (/(^|\/)\.\.\.(\/|$)/.test(written)) return { scope: "unresolved", reason: "elided-path", candidates: [] };
	if (!file) return { scope: "unresolved", reason: "file-not-in-config", candidates: [] };

	const notes = { default: file.default ?? "frappe", notCore: file.notCore ?? {}, core: file.core ?? {}, ambiguous: file.ambiguous ?? {} };
	if (notes.ambiguous[written]) return { scope: "unresolved", reason: `ambiguous-in-file: ${notes.ambiguous[written]}`, candidates: [] };
	const pinned = notes.core[written];
	if (pinned) {
		return tree.files.has(pinned)
			? { scope: "core", path: pinned, basis: "alias" }
			: { scope: "unresolved", reason: "alias-missing-at-old-tag", candidates: [pinned] };
	}
	const owner = notes.notCore[written];
	if (owner) return { scope: "not-core", owner };
	if (notes.default !== "frappe") return { scope: "not-core", owner: notes.default };

	for (const base of file.bases) {
		const found = findUnder(tree, base, written);
		if (found.length === 1) return { scope: "core", path: found[0] ?? "", basis: "base" };
		if (found.length > 1) {
			const named = found.filter((f) => mentioned.has(f));
			if (named.length === 1) return { scope: "core", path: named[0] ?? "", basis: "in-file-mention" };
			return { scope: "unresolved", reason: "ambiguous", candidates: found.sort(cmp) };
		}
	}
	return { scope: "unresolved", reason: "no-file-under-bases", candidates: [] };
}

// ---------------------------------------------------------------------------------------------
// The ledger: what a remap has and has not touched
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {object} LedgerEntry
 * @property {string} anchoredAt the tag the line numbers in the file now follow
 * @property {string} headerAtApply the tag the header named when this was recorded; a different one now means a person re-stamped the file
 * @property {Record<string, [number, string][]>} pending the citations that were NOT rewritten and still carry the numbers of the tag they are listed under, as [line in the .d.ts, citation as written]
 */

/**
 * @typedef {object} Ledger
 * @property {number} schema
 * @property {Record<string, LedgerEntry>} files
 */

/**
 * Why a ledger exists at all. A remap rewrites only the numbers it can prove, so
 * afterwards a file holds numbers for TWO tags — the new one, and the old one on every
 * citation that was flagged — while its header (rightly: nobody re-verified anything)
 * still names the old tag. Run again and the tool could not tell which is which: it
 * would read the freshly moved numbers as old ones and move them a second time. The
 * ledger records, per file, which citations still await a human, so that a second run
 * finds nothing to do and a flagged citation stays flagged until someone changes its text.
 * A pending citation is identified by its line in the .d.ts and what it says; rewriting
 * digits moves neither, and the moment a person edits it, it stops matching and counts
 * as following the new tag. (After lines are added above it, it is matched by its text
 * alone, in order.)
 */

/**
 * Which tag the line numbers of each citation in a declaration file follow, by the ledger.
 * For the audit, which must not compare a number that was moved to the new tag against the
 * old one. Null when the ledger has nothing live to say about the file.
 * @param {string} text
 * @param {string} dts
 * @param {Ledger | null} ledger
 * @returns {Map<number, string> | null} offset of each citation -> the tag its numbers follow
 */
export function referenceTags(text, dts, ledger) {
	const entry = liveEntry(ledger, dts, readStamp(text).tags[0] ?? null);
	if (!entry) return null;
	const refs = extractReferences(text, dts);
	const pending = pendingTags(refs, entry);
	return new Map(refs.map((r, i) => [r.index, pending[i] ?? entry.anchoredAt]));
}

/**
 * @param {unknown} value
 * @returns {Ledger}
 */
export function checkLedger(value) {
	if (typeof value !== "object" || value === null) throw new Error("citation-anchors.json: not an object");
	const ledger = /** @type {Ledger} */ (value);
	if (ledger.schema !== 1) throw new Error(`citation-anchors.json: schema is ${ledger.schema}, this tool reads 1`);
	return ledger;
}

/** @returns {Ledger} */
export function emptyLedger() {
	return { schema: 1, files: {} };
}

// ---------------------------------------------------------------------------------------------
// Rewriting
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {object} Edit
 * @property {number} index
 * @property {number} length
 * @property {string} text
 */

/**
 * Apply non-overlapping edits. Only digits are ever replaced, so the file keeps its
 * line structure and every offset outside an edit stays meaningful.
 * @param {string} text
 * @param {readonly Edit[]} edits
 * @returns {string}
 */
export function applyEdits(text, edits) {
	let out = text;
	for (const e of [...edits].sort((x, y) => y.index - x.index)) out = out.slice(0, e.index) + e.text + out.slice(e.index + e.length);
	return out;
}

/**
 * The edits that rewrite a reference's numbers from `verdicts` (all exact).
 * @param {Reference} ref
 * @param {readonly ItemVerdict[]} verdicts
 * @returns {Edit[]}
 */
export function editsFor(ref, verdicts) {
	/** @type {Edit[]} */
	const edits = [];
	for (const v of verdicts) {
		const { item } = v;
		if (item.kind === "line") {
			const to = v.start.to ?? item.n;
			if (to !== item.n) edits.push({ index: item.at, length: String(item.n).length, text: String(to) });
		} else {
			const a = v.start.to ?? item.a;
			const b = v.end?.to ?? item.b;
			if (a !== item.a) edits.push({ index: item.atA, length: String(item.a).length, text: String(a) });
			if (b !== item.b) edits.push({ index: item.atB, length: String(item.b).length, text: String(b) });
		}
	}
	return edits;
}

// ---------------------------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {object} Source what the planner reads from frappe. The CLI backs it with git
 *   (createGitSource); the tests with memory.
 * @property {(tag: string) => Promise<string[]>} files every tracked path at the tag
 * @property {(tag: string, path: string) => Promise<string | null>} text a file's contents at the tag
 * @property {(from: string, to: string, paths: readonly string[]) => Promise<Map<string, FileChange>>} changes
 *   what became of each path between the tags; a path that did not change is `unchanged`
 */

/**
 * @typedef {"no-line" | "current" | "unchanged" | "moved" | "modified" | "deleted" | "renamed" | "invalid" | "unresolved" | "uncovered" | "failed" | "out-of-scope"} Outcome
 *   no-line: a path with no number to move. current: already follows the new tag.
 *   unchanged: valid as written. moved: rewritten, exactly. modified / deleted: flagged.
 *   renamed: the numbers map exactly, but into a file the citation does not name any more,
 *   and only numbers are ever edited: flagged.
 *   invalid: the old file never had that line. unresolved: the path is not known.
 *   failed: a mapping that did not re-verify (a bug; nothing is written for it).
 *   uncovered: a file-less `:N` whose file is not named anywhere the config can read: left alone.
 *   out-of-scope: not frappe core.
 */

/**
 * @typedef {object} Decision
 * @property {Reference} ref
 * @property {string} oldTag the tag this reference's numbers follow
 * @property {Outcome} outcome
 * @property {Resolution} resolution
 * @property {string | null} newPath where the cited file is now
 * @property {ItemVerdict[]} verdicts
 * @property {string} status finer than `outcome`: `line-modified`, `range-interior-modified`, `file-deleted`, ...
 * @property {string} summary which hunks, in words
 * @property {Edit[]} edits
 * @property {{ forOldLine: number, line: number, text: string, score: number, basis: string }[]} candidates
 * @property {string[]} oldText trimmed text of each cited old line, aligned with `citedNumbers(ref)`
 * @property {{ path: string, basis: string }[]} candidatePaths for a deleted file: files at the new tag with the same name, or added to the same directory (guesses, labelled as such)
 */

/**
 * @typedef {object} FilePlan
 * @property {string} dts
 * @property {{ tag: string, from: "ledger" | "header" | "package.json" }} tag the tag its numbers were taken to follow, and why
 * @property {string | null} headerTag
 * @property {Decision[]} decisions
 * @property {Edit[]} edits
 * @property {string[]} problems things the tool refuses to guess about this file
 */

/**
 * @typedef {object} Plan
 * @property {string} newTag
 * @property {FilePlan[]} files
 * @property {Ledger} ledger what the ledger will say once this is applied
 */

/**
 * @param {Ledger | null} ledger
 * @param {string} dts
 * @param {string | null} headerTag
 * @returns {LedgerEntry | null} the entry, when it still describes this file
 */
function liveEntry(ledger, dts, headerTag) {
	const entry = ledger?.files[dts];
	// A header that no longer names the tag it named when the ledger was written has been
	// re-stamped by a person, who has thereby claimed the whole file: the ledger is moot.
	return entry && entry.headerAtApply === (headerTag ?? "") ? entry : null;
}

/**
 * Which references are still waiting for a human, as recorded. Exact (line, text) first;
 * then identical text in order, which is what survives someone adding a line above.
 * @param {readonly Reference[]} refs
 * @param {LedgerEntry | null} entry
 * @returns {(string | null)[]} for each reference the tag its numbers follow, or null if it is not pending
 */
function pendingTags(refs, entry) {
	/** @type {(string | null)[]} */
	const out = refs.map(() => null);
	if (!entry) return out;
	/** @type {{ tag: string, line: number, text: string, used: boolean }[]} */
	const records = [];
	for (const [tag, list] of Object.entries(entry.pending)) for (const [line, text] of /** @type {[number, string][]} */ (list)) records.push({ tag, line, text, used: false });
	refs.forEach((ref, i) => {
		const hit = records.find((r) => !r.used && r.line === ref.line && r.text === ref.text);
		if (hit) {
			hit.used = true;
			out[i] = hit.tag;
		}
	});
	refs.forEach((ref, i) => {
		if (out[i] !== null) return;
		const hit = records.find((r) => !r.used && r.text === ref.text);
		if (hit) {
			hit.used = true;
			out[i] = hit.tag;
		}
	});
	return out;
}

/**
 * Work out, for every citation in the declaration files, whether it can be moved
 * exactly, must be reviewed, or is not this tool's to touch.
 * @param {object} input
 * @param {{ file: string, text: string }[]} input.declarations
 * @param {CitationConfig} input.config
 * @param {string | null} input.packageTag `frappe.verifiedAgainst`, for a file whose header names no tag
 * @param {Ledger | null} input.ledger
 * @param {string} input.newTag
 * @param {Source} input.source
 * @param {number} [input.minRenameSimilarity] percent; a file git calls renamed below this is treated as gone
 * @returns {Promise<Plan>}
 */
export async function planRemap({ declarations, config, packageTag, ledger, newTag, source, minRenameSimilarity = 70 }) {
	/** @type {Map<string, Promise<TreeIndex>>} */
	const trees = new Map();
	const treeAt = (/** @type {string} */ tag) => {
		let t = trees.get(tag);
		if (!t) {
			t = source.files(tag).then(indexTree);
			trees.set(tag, t);
		}
		return t;
	};
	/** @type {Map<string, Promise<string | null>>} */
	const texts = new Map();
	const textAt = (/** @type {string} */ tag, /** @type {string} */ path) => {
		const k = `${tag}\0${path}`;
		let t = texts.get(k);
		if (!t) {
			t = source.text(tag, path);
			texts.set(k, t);
		}
		return t;
	};

	// ---- phase 1: what does each citation point at, and which tag do its numbers follow?
	/** @type {FilePlan[]} */
	const files = [];
	/** @type {Map<string, Set<string>>} oldTag -> paths whose change is needed */
	const wanted = new Map();
	for (const { file: dts, text } of declarations) {
		const stamp = readStamp(text);
		/** @type {string[]} */
		const problems = [];
		if (stamp.tags.length > 1) problems.push(`header names more than one tag (${stamp.tags.join(", ")}); the first is used`);
		const headerTag = stamp.tags[0] ?? null;
		const entry = liveEntry(ledger, dts, headerTag);
		/** @type {FilePlan["tag"]} */
		let fileTag;
		if (entry) fileTag = { tag: entry.anchoredAt, from: "ledger" };
		else if (headerTag) fileTag = { tag: headerTag, from: "header" };
		else if (packageTag) fileTag = { tag: packageTag, from: "package.json" };
		else throw new Error(`${dts}: no frappe tag in its header, and package.json has no frappe.verifiedAgainst`);

		const refs = extractReferences(text, dts);
		const pending = pendingTags(refs, entry);
		const mentionedBy = new Map();
		const cfg = config.files[dts];
		/** @type {Decision[]} */
		const decisions = [];
		for (const [i, ref] of refs.entries()) {
			// A path with no number has no numbering to follow: it was true at the tag the file says it was
			// read at, whatever has since been done to the numbers beside it.
			const oldTag = ref.items.length === 0 ? (headerTag ?? packageTag ?? fileTag.tag) : (pending[i] ?? fileTag.tag);
			const tree = await treeAt(oldTag);
			let mentioned = mentionedBy.get(oldTag);
			if (!mentioned) {
				mentioned = new Set();
				for (const other of refs) {
					if (other.form !== "full") continue;
					const hit = other.candidates.find((c) => tree.files.has(c));
					if (hit) mentioned.add(hit);
				}
				mentionedBy.set(oldTag, mentioned);
			}
			const resolution = ref.malformed
				? /** @type {Resolution} */ ({ scope: "unresolved", reason: "malformed-line-spec", candidates: [] })
				: resolveReference(ref, { config, file: cfg, tree, mentioned });
			/** @type {Decision} */
			const decision = {
				ref,
				oldTag,
				outcome: "unresolved",
				resolution,
				newPath: null,
				verdicts: [],
				status: "",
				summary: "",
				edits: [],
				candidates: [],
				oldText: [],
				candidatePaths: [],
			};
			if (resolution.scope === "not-core") {
				decision.outcome = "out-of-scope";
			} else if (resolution.scope === "unresolved") {
				// A path that is merely mentioned and cannot be placed is not worth reporting: it is not a citation.
				decision.outcome = ref.items.length === 0 ? "no-line" : ref.form === "implicit" && resolution.reason === "no-file-named" ? "uncovered" : "unresolved";
				decision.status = `${decision.outcome}: ${resolution.reason}`;
			} else if (ref.items.length === 0) {
				decision.outcome = "no-line";
				if (oldTag !== newTag) {
					// ...but the file it names may be gone: ask what became of it.
					let set = wanted.get(oldTag);
					if (!set) wanted.set(oldTag, (set = new Set()));
					set.add(resolution.path);
				}
			} else if (oldTag === newTag) {
				decision.outcome = "current";
			} else {
				decision.outcome = "unchanged"; // provisional: judged in phase 3
				let set = wanted.get(oldTag);
				if (!set) wanted.set(oldTag, (set = new Set()));
				set.add(resolution.path);
			}
			decisions.push(decision);
		}
		files.push({ dts, tag: fileTag, headerTag, decisions, edits: [], problems });
	}

	// ---- phase 2: what became of every cited file
	/** @type {Map<string, Map<string, FileChange>>} */
	const changes = new Map();
	for (const [oldTag, paths] of wanted) changes.set(oldTag, await source.changes(oldTag, newTag, [...paths].sort(cmp)));

	// ---- phase 3: judge each citation against what changed
	const newTree = await treeAt(newTag);
	/** @type {Map<string, string[][]>} */
	const tokenCache = new Map();
	/**
	 * Where a gone file might have gone: same name elsewhere, or new in its directory. Guesses.
	 * @param {string} path
	 * @param {string} oldTag
	 */
	const goneCandidates = async (path, oldTag) => {
		const base = path.slice(path.lastIndexOf("/") + 1);
		const dir = path.slice(0, path.lastIndexOf("/") + 1);
		const oldTree = await treeAt(oldTag);
		return [
			...(newTree.byName.get(base) ?? []).map((p) => ({ path: p, basis: "same-basename" })),
			...[...newTree.files]
				.filter((f) => f.startsWith(dir) && !f.slice(dir.length).includes("/") && !oldTree.files.has(f))
				.sort(cmp)
				.map((p) => ({ path: p, basis: "added-in-same-directory" })),
		].slice(0, 6);
	};
	for (const plan of files) {
		for (const d of plan.decisions) {
			const mention = d.ref.items.length === 0 && d.outcome === "no-line" && d.resolution.scope === "core" && d.oldTag !== newTag;
			if ((d.outcome !== "unchanged" && !mention) || d.resolution.scope !== "core") continue;
			const path = d.resolution.path;
			const found = changes.get(d.oldTag)?.get(path) ?? unchanged(path);
			const change =
				found.kind === "renamed" && (found.similarity ?? 0) < minRenameSimilarity
					? /** @type {FileChange} */ ({ ...found, kind: "deleted", newPath: null })
					: found;
			d.newPath = change.newPath;
			if (mention) {
				// Nothing to move: only whether the file it names is still there, under that name.
				if (change.kind === "deleted") {
					d.outcome = "deleted";
					d.status = "mention-file-deleted";
					d.summary =
						found.kind === "renamed"
							? `${path} was renamed to ${found.newPath ?? "?"} at ${found.similarity}% similarity, below the ${minRenameSimilarity}% needed to follow it`
							: `${path} does not exist at ${newTag}`;
					d.candidatePaths = await goneCandidates(path, d.oldTag);
				} else if (change.newPath !== null && change.newPath !== path && !stillNames(d.ref, change.newPath)) {
					d.outcome = "renamed";
					d.status = "mention-file-renamed";
					d.summary = `${path} was renamed to ${change.newPath} (${change.similarity}% similar)`;
				}
				continue;
			}
			const oldText = await textAt(d.oldTag, path);
			const newText = change.newPath ? await textAt(newTag, change.newPath) : null;
			if (oldText === null) {
				d.outcome = "unresolved";
				d.status = "unresolved: no-file-at-old-tag";
				continue;
			}
			const oldLines = splitLines(oldText);
			const cited = citedNumbers(d.ref);
			d.oldText = cited.map((n) => (oldLines[n - 1] ?? "").trim());
			if (change.kind === "deleted" || newText === null || change.binary) {
				d.outcome = "deleted";
				d.status = change.binary ? "binary-file" : "file-deleted";
				d.summary =
					found.kind === "renamed"
						? `${path} was renamed to ${found.newPath ?? "?"} at ${found.similarity}% similarity, below the ${minRenameSimilarity}% needed to follow it`
						: `${path} does not exist at ${newTag}`;
				d.candidatePaths = await goneCandidates(path, d.oldTag);
				continue;
			}
			const newLines = splitLines(newText);
			d.verdicts = d.ref.items.map((item) => judgeItem(item, change, oldLines, newLines));
			const outcome = describe(d, change);
			if (outcome === "modified" || outcome === "deleted") {
				const key = `${d.newPath}@${newTag}`;
				let tk = tokenCache.get(key);
				if (!tk) tokenCache.set(key, (tk = tokenizeLines(newLines)));
				for (const v of d.verdicts) {
					for (const side of [v.start, v.end]) {
						if (!side || side.status === "same" || side.status === "moved") continue;
						const oldLine = oldLines[side.n - 1] ?? "";
						const found = findCandidates(oldLine, newLines, tk, side.expected);
						if (side.status === "modified" && side.hunk) {
							for (const c of hunkReplacements(oldLine, side.hunk, newLines, tk)) {
								if (!found.some((f) => f.line === c.line)) found.push({ ...c, basis: "same-hunk-replacement" });
							}
						}
						for (const c of found) d.candidates.push({ forOldLine: side.n, line: c.line, text: c.text, score: c.score, basis: c.basis });
					}
				}
			}
			if (outcome === "moved") d.edits = d.verdicts.flatMap((v) => editsFor(d.ref, [v]));
		}
		plan.edits = plan.decisions.flatMap((d) => d.edits);
	}

	// ---- the ledger as it will stand after this plan is applied
	/** @type {Ledger} */
	const next = { schema: 1, files: {} };
	for (const plan of files) {
		/** @type {Record<string, [number, string][]>} */
		const pending = {};
		for (const d of plan.decisions) {
			// A mention has no numbers, so nothing to record: it is judged against the header's tag on every run.
			if (d.ref.items.length === 0) continue;
			if (!["modified", "deleted", "renamed", "invalid", "unresolved", "uncovered", "failed"].includes(d.outcome)) continue;
			(pending[d.oldTag] ??= []).push([d.ref.line, d.ref.text]);
		}
		next.files[plan.dts] = { anchoredAt: newTag, headerAtApply: plan.headerTag ?? "", pending: Object.fromEntries(Object.entries(pending).sort(([a], [b]) => cmp(a, b))) };
	}
	return { newTag, files, ledger: next };
}

/**
 * Does the citation, as written, still name `newPath`? A full path must be that path; a
 * bare `grid.js` is satisfied by any directory it now sits in.
 * @param {Reference} ref
 * @param {string} newPath
 */
function stillNames(ref, newPath) {
	if (ref.form === "full") return ref.candidates.includes(newPath);
	return newPath === ref.written || newPath.endsWith(`/${ref.written}`);
}

/**
 * Settle a judged citation's outcome and say why in words.
 * @param {Decision} d
 * @param {FileChange} change
 * @returns {Outcome} what it was settled as (also written to `d.outcome`)
 */
function describe(d, change) {
	const verdicts = d.verdicts;
	const at = d.resolution.scope === "core" ? d.resolution.path : "the file";
	if (verdicts.some((v) => v.start.status === "invalid" || v.end?.status === "invalid")) {
		d.outcome = "invalid";
		d.status = "invalid-at-old-tag";
		d.summary = `the cited line is past the end of ${at} at ${d.oldTag}`;
		return d.outcome;
	}
	if (verdicts.some((v) => v.start.status === "unverified" || v.end?.status === "unverified")) {
		d.outcome = "failed";
		d.status = "mapping-did-not-verify";
		d.summary = "the computed position did not hold the same text: not applied";
		return d.outcome;
	}
	/** @param {LineVerdict} s */
	const where = (s) => {
		if (s.status === "same") return `${s.n} unchanged`;
		if (s.status === "moved") return `${s.n} -> ${s.to}`;
		if (!s.hunk) return `${s.n} ${s.status}`;
		const h = s.hunk;
		return `${s.n} is in ${hunkLabel(h)} (${h.oldCount} old line(s) ${s.status === "deleted" ? "removed" : `replaced by ${h.newCount}`})`;
	};
	/** @type {string[]} */
	const parts = [];
	/** @type {string[]} */
	const kinds = [];
	let moved = false;
	for (const v of verdicts) {
		if (v.item.kind === "line") {
			parts.push(where(v.start));
			if (v.exact) moved ||= v.start.status === "moved";
			else kinds.push(v.start.status === "deleted" ? "line-deleted" : "line-modified");
			continue;
		}
		const interior = v.interior.length > 0 ? `; interior modified by ${v.interior.map(hunkLabel).join(", ")}` : "";
		parts.push(`${v.item.a}-${v.item.b}: ends: ${where(v.start)}; ${v.end ? where(v.end) : ""}${interior}`);
		const endsOk = (v.start.status === "same" || v.start.status === "moved") && (v.end?.status === "same" || v.end?.status === "moved");
		if (v.exact) moved ||= v.start.status === "moved" || v.end?.status === "moved";
		else kinds.push(endsOk ? "range-interior-modified" : "range-ends-modified");
	}
	const renamed = change.kind === "renamed" && change.newPath !== null && change.newPath !== (d.resolution.scope === "core" ? d.resolution.path : null);
	d.summary = `${renamed ? `file renamed to ${change.newPath} (${change.similarity}% similar); ` : ""}${parts.join("; ")}`;
	if (kinds.length > 0) {
		d.status = kinds[0] ?? "";
		d.outcome = kinds.every((k) => k === "line-deleted") ? "deleted" : "modified";
	} else if (renamed && change.newPath !== null && !stillNames(d.ref, change.newPath)) {
		d.outcome = "renamed";
		d.status = "file-renamed";
	} else {
		d.outcome = moved ? "moved" : "unchanged";
		d.status = d.outcome;
	}
	return d.outcome;
}

// ---------------------------------------------------------------------------------------------
// frappe, read from git
// ---------------------------------------------------------------------------------------------

/**
 * A directory of memoised results, for work that is slow and cannot change. Everything
 * cached here is keyed by commit sha, never by tag name, so a moved tag cannot serve a
 * stale answer. With no directory it only de-duplicates calls within one run.
 * @param {string | null} dir
 */
export function diskCache(dir) {
	/** @type {Map<string, Promise<string | null>>} */
	const memory = new Map();
	return {
		/**
		 * @param {string} key
		 * @param {() => Promise<string | null>} compute null is never stored
		 * @returns {Promise<string | null>}
		 */
		wrap(key, compute) {
			const hit = memory.get(key);
			if (hit) return hit;
			const run = (async () => {
				const file = dir ? path.join(dir, `${createHash("sha256").update(key).digest("hex")}.txt`) : null;
				if (file) {
					try {
						return await readFile(file, "utf8");
					} catch {
						/* not cached yet */
					}
				}
				const value = await compute();
				if (file && value !== null) {
					await mkdir(dir ?? ".", { recursive: true });
					// Temp + rename: a run killed mid-write must not leave a truncated entry that reads as a hit.
					const tmp = `${file}.${process.pid}.tmp`;
					await writeFile(tmp, value);
					await rename(tmp, file);
				}
				return value;
			})();
			memory.set(key, run);
			return run;
		},
	};
}

/**
 * The planner's `Source`, answered by `git` against a clone that has the tags.
 * @param {object} input
 * @param {string} input.repo path to the frappe clone
 * @param {string | null} [input.cacheDir]
 * @param {number} [input.similarity] rename threshold handed to git, percent
 * @returns {Source & { commit(tag: string): Promise<string>, date(tag: string): Promise<string> }}
 */
export function createGitSource({ repo, cacheDir = null, similarity = 50 }) {
	const cache = diskCache(cacheDir);
	/** @type {Map<string, Promise<import("./frappe-reader.mjs").GitReader>>} */
	const readers = new Map();
	const reader = (/** @type {string} */ tag) => {
		let r = readers.get(tag);
		if (!r) readers.set(tag, (r = gitReader(repo, tag)));
		return r;
	};
	return {
		async commit(tag) {
			return (await reader(tag)).commit;
		},
		async date(tag) {
			return (await reader(tag)).date;
		},
		async files(tag) {
			const r = await reader(tag);
			const listing = await cache.wrap(`tree\0${r.commit}`, async () => (await r.allFiles()).join("\n"));
			return (listing ?? "").split("\n").filter((f) => f !== "");
		},
		async text(tag, file) {
			const r = await reader(tag);
			return cache.wrap(`blob\0${r.commit}\0${file}`, () => r.readText(file));
		},
		async changes(from, to, paths) {
			const a = await reader(from);
			const b = await reader(to);
			const statusJson = await cache.wrap(`status\0${a.commit}\0${b.commit}\0${similarity}`, async () =>
				JSON.stringify([...(await nameStatus(repo, a.commit, b.commit, similarity))]),
			);
			/** @type {Map<string, { status: string, to: string, similarity: number | null }>} */
			const status = new Map(JSON.parse(statusJson ?? "[]"));
			/** @type {string[][]} */
			const groups = [];
			for (const p of paths) {
				const s = status.get(p);
				if (s && s.status !== "D") groups.push(s.status === "R" ? [p, s.to] : [p]);
			}
			const patch = await cache.wrap(`diff\0${a.commit}\0${b.commit}\0${similarity}\0${createHash("sha256").update(JSON.stringify(groups)).digest("hex")}`, () =>
				diffZero(repo, a.commit, b.commit, groups, similarity),
			);
			const parsed = parseDiff(patch ?? "");
			/** @type {Map<string, FileChange>} */
			const out = new Map();
			for (const p of paths) {
				const s = status.get(p);
				if (!s) {
					out.set(p, unchanged(p));
				} else if (s.status === "D") {
					out.set(p, { kind: "deleted", oldPath: p, newPath: null, similarity: null, hunks: [], binary: false });
				} else {
					const got = parsed.get(p);
					// An empty diff for a mode-only change is fine; a rename that git, shown the pair,
					// did not pair up is not — mapping through it would be a guess.
					if (s.status === "R" && got?.kind !== "renamed") throw new Error(`git reports ${p} renamed to ${s.to} but its diff does not (is the rename threshold ${similarity}% consistent?)`);
					out.set(p, got ?? unchanged(p));
				}
			}
			return out;
		},
	};
}

// ---------------------------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------------------------

/** @type {readonly Outcome[]} */
export const OUTCOMES = ["no-line", "current", "unchanged", "moved", "modified", "deleted", "renamed", "invalid", "unresolved", "uncovered", "failed", "out-of-scope"];

/**
 * @param {FilePlan} plan
 * @returns {Record<Outcome, number> & { total: number }}
 */
export function tally(plan) {
	const counts = /** @type {Record<Outcome, number> & { total: number }} */ (Object.fromEntries([...OUTCOMES.map((o) => [o, 0]), ["total", 0]]));
	for (const d of plan.decisions) {
		counts[d.outcome]++;
		counts.total++;
	}
	return counts;
}

/**
 * Everything a reviewer needs for one flagged citation. The candidates are guesses by
 * text similarity and are labelled as such wherever they appear.
 * @param {Plan} plan
 * @param {ReadonlyMap<string, string>} texts declaration text by file, for context
 */
export function flaggedRecords(plan, texts) {
	/** @type {Record<string, unknown>[]} */
	const flagged = [];
	/** @type {Record<string, unknown>[]} */
	const unresolved = [];
	/** @type {Record<string, unknown>[]} */
	const uncovered = [];
	for (const file of plan.files) {
		const text = texts.get(file.dts) ?? "";
		const lines = text.split("\n");
		for (const d of file.decisions) {
			const column = d.ref.index - (text.lastIndexOf("\n", d.ref.index - 1) + 1) + 1;
			const where = { dts: file.dts, dtsLine: d.ref.line, dtsColumn: column, citation: d.ref.text, citedAs: d.ref.written };
			if (d.outcome === "unresolved") {
				unresolved.push({
					...where,
					oldTag: d.oldTag,
					reason: d.resolution.scope === "unresolved" ? d.resolution.reason : d.status,
					candidatePaths: d.resolution.scope === "unresolved" ? d.resolution.candidates.map((p) => ({ path: p, basis: "name-matches" })) : [],
					dtsContext: (lines[d.ref.line - 1] ?? "").trim(),
				});
				continue;
			}
			if (d.outcome === "uncovered") {
				uncovered.push({ ...where, oldTag: d.oldTag, dtsContext: (lines[d.ref.line - 1] ?? "").trim() });
				continue;
			}
			if (!["modified", "deleted", "renamed", "invalid", "failed"].includes(d.outcome)) continue;
			flagged.push({
				...where,
				citedPath: d.resolution.scope === "core" ? d.resolution.path : null,
				newPath: d.newPath,
				oldTag: d.oldTag,
				newTag: plan.newTag,
				oldLines: citedNumbers(d.ref),
				oldText: d.oldText,
				status: d.status,
				outcome: d.outcome,
				hunkSummary: d.summary,
				newCandidateLines: d.candidates,
				candidatePaths: d.candidatePaths,
				items: d.verdicts.map((v) => ({
					cited: v.item.kind === "line" ? `${v.item.n}` : `${v.item.a}-${v.item.b}`,
					start: { line: v.start.n, status: v.start.status, newLine: v.start.to },
					end: v.end ? { line: v.end.n, status: v.end.status, newLine: v.end.to } : null,
					interiorHunks: v.interior.map(hunkLabel),
				})),
				resolutionBasis: d.resolution.scope === "core" ? d.resolution.basis : null,
				dtsContext: (lines[d.ref.line - 1] ?? "").trim(),
			});
		}

	}
	return { flagged, unresolved, uncovered };
}

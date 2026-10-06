// Do the `file:line` citations in src/**/*.d.ts still point at what they cited?
//
// Every declaration in this package carries a citation back to the frappe source it
// was read from — that is the package's entire claim to being "source-verified". A
// citation is only worth anything while it still lands on the same text, and frappe's
// version-16 branch moves fast (1,160 commits between v16.33.1 and v16.50.0), so this
// measures, rather than assumes, how much of the evidence has gone stale.
//
// WHAT COUNTS AS A CITATION HERE: a FULL path — `frappe/<path>.<ext>` — optionally
// followed by `:<line>`, `:<a>-<b>` or `:<a>,<b>,…`. That is the one form that carries
// its own base. The other form, a bare `grid.js:412`, is only meaningful against a
// base each file declares in prose in its header, and guessing that base would turn
// "unknown" into a confident wrong answer. Those are counted and reported as
// unresolvable so the gap stays visible, never resolved.

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { cmp, numstat } from "./frappe-reader.mjs";

const EXTENSIONS = "json|js|py|html|scss|css|vue";
const SEGMENT = String.raw`[\w-]+(?:\.[\w-]+)*`;
const LINES = String.raw`:\d+(?:[-,]\d+)*`;
const LINES_SUFFIX = new RegExp(`${LINES}$`);
// Not in the middle of something longer: `carbon_frappe/…` (a consumer app, not frappe),
// `github.com/frappe/…` (a URL), `../frappe/…`, `@scope/frappe/…`.
const LEFT = String.raw`(?<![\w./@~-])`;

// `apps/frappe/<rest>` and `frappe/<rest>` are both written in prose. The first names
// the REPO ROOT explicitly (so `apps/frappe/frappe/public/…` is the doubled form
// deep-modules.d.ts explains); the second is `frappe/<rest>` as it appears in the
// tree — but it is also how prose spells "the frappe repo" (`frappe/package.json`,
// `frappe/esbuild/esbuild.js`, which live at the repo root, not under `frappe/`).
const FULL = new RegExp(`${LEFT}(apps/)?frappe/((?:${SEGMENT}/)*${SEGMENT}\\.(?:${EXTENSIONS}))(?!\\w)(${LINES})?`, "g");
// Any other path that carries a line number. A bare filename without one is a mention,
// not a citation, so the line spec is required here.
const OTHER = new RegExp(`${LEFT}((?:[\\w.-]+/)*${SEGMENT}\\.(?:${EXTENSIONS}))(?!\\w)(${LINES})`, "g");

/**
 * @typedef {object} Citation
 * @property {string} text the citation as written
 * @property {string} file the .d.ts it appears in
 * @property {number} line its 1-based line within that file
 * @property {string[]} candidates repo-root-relative paths it can mean, in order of preference
 * @property {number[]} anchors cited lines, ascending; a range contributes both endpoints
 */

/**
 * @typedef {object} Unresolvable
 * @property {string} text
 * @property {string} file
 * @property {number} line
 * @property {string} root first path segment (`carbon_frappe`), or `(bare)` for `grid.js:412`
 */

/**
 * The cited lines of a `:12`, `:12-26` or `:44,61,70` suffix. A range is represented by
 * its two endpoints, not every line in it: a range is one claim about a region, and
 * counting all its lines would let one long range outweigh a dozen precise citations.
 * @param {string} spec
 * @returns {number[]}
 */
export function parseLineSpec(spec) {
	const numbers = spec
		.replace(/^:/, "")
		.split(/[-,]/)
		.map(Number)
		.filter((n) => Number.isInteger(n) && n > 0);
	return [...new Set(numbers)].sort((a, b) => a - b);
}

/**
 * @param {string} text
 * @returns {number[]} offset of the start of every line
 */
function lineStarts(text) {
	const starts = [0];
	for (let i = text.indexOf("\n"); i !== -1; i = text.indexOf("\n", i + 1)) starts.push(i + 1);
	return starts;
}

/**
 * @param {number[]} starts
 * @param {number} offset
 * @returns {number} 1-based
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
 * Every citation in one file's text.
 * @param {string} text
 * @param {string} file label to record on each hit
 * @returns {{ full: Citation[], unresolvable: Unresolvable[] }}
 */
export function scanCitations(text, file) {
	const starts = lineStarts(text);
	/** @type {Citation[]} */
	const full = [];
	/** @type {Set<number>} */
	const fullAt = new Set();
	for (const m of text.matchAll(FULL)) {
		const rest = m[2] ?? "";
		fullAt.add(m.index);
		full.push({
			text: m[0],
			file,
			line: lineAt(starts, m.index),
			candidates: m[1] ? [rest] : [`frappe/${rest}`, rest],
			anchors: m[3] ? parseLineSpec(m[3]) : [],
		});
	}
	/** @type {Unresolvable[]} */
	const unresolvable = [];
	for (const m of text.matchAll(OTHER)) {
		if (fullAt.has(m.index)) continue;
		const target = m[1] ?? "";
		unresolvable.push({
			text: m[0],
			file,
			line: lineAt(starts, m.index),
			root: target.includes("/") ? (target.split("/")[0] ?? "") : "(bare)",
		});
	}
	return { full, unresolvable };
}

/**
 * Which path a citation means in the first of `readers` that has one of its
 * candidates. Candidates are the OUTER loop: the preferred spelling wins wherever it
 * exists, and the repo-root reading is only a fallback for a path that exists nowhere
 * under `frappe/`.
 * @param {Citation} citation
 * @param {readonly import("./frappe-reader.mjs").FrappeReader[]} readers
 * @returns {Promise<string | null>}
 */
export async function resolveCitation(citation, readers) {
	for (const candidate of citation.candidates) {
		for (const reader of readers) {
			if ((await reader.kindOf(candidate)) === "file") return candidate;
		}
	}
	return null;
}

/**
 * Lines of a file as `git diff` counts them: a final newline does not start a new line.
 * @param {string} text
 * @returns {string[]}
 */
function linesOf(text) {
	const lines = text.split(/\r?\n/);
	if (lines.at(-1) === "") lines.pop();
	return lines;
}

/**
 * For each cited line, is its text (ignoring surrounding whitespace) the same in both
 * versions of the file? The SAME line number is compared on both sides — the question
 * is "does the citation, as written, still land on what it cited", not "did that text
 * move somewhere else".
 *   same     the line reads the same in `after`
 *   changed  it reads differently, or `after` has no such line
 *   invalid  `before` has no such line either: the citation was already wrong there
 * @param {string} before
 * @param {string} after
 * @param {readonly number[]} anchors
 * @returns {Map<number, "same" | "changed" | "invalid">}
 */
export function compareAnchors(before, after, anchors) {
	const was = linesOf(before);
	const is = linesOf(after);
	/** @type {Map<number, "same" | "changed" | "invalid">} */
	const out = new Map();
	for (const n of anchors) {
		const a = was[n - 1];
		const b = is[n - 1];
		out.set(n, a === undefined ? "invalid" : b === undefined || a.trim() !== b.trim() ? "changed" : "same");
	}
	return out;
}

/**
 * Every `.d.ts` under `srcDir`, sorted, as `{ file, text }` with `file` relative to the
 * repo root (`src/core.d.ts`).
 * @param {string} root repo root
 * @param {string} [dir]
 * @returns {Promise<{ file: string, text: string }[]>}
 */
export async function readDeclarationFiles(root, dir = "src") {
	const names = (await readdir(path.join(root, dir), { recursive: true })).filter((n) => n.endsWith(".d.ts"));
	const files = names.map((n) => `${dir}/${n.split(path.sep).join("/")}`).sort(cmp);
	return Promise.all(files.map(async (file) => ({ file, text: await readFile(path.join(root, file), "utf8") })));
}

/**
 * @typedef {object} AnchorTally
 * @property {number} total anchors that were comparable (present at the baseline)
 * @property {number} changed of those, how many now read differently
 * @property {number} invalid anchors the baseline file did not even have that line for
 */

/**
 * @typedef {object} CitedFile
 * @property {string} path repo-root-relative
 * @property {number} citations how many citations point at it
 * @property {string[]} sites `src/x.d.ts:line` of each
 * @property {number[]} anchors distinct cited lines
 * @property {"present" | "deleted"} status `deleted`: it existed at the baseline and is gone now
 * @property {{ added: number, deleted: number } | null} churn lines changed since the baseline (null: not measured, or unchanged)
 * @property {AnchorTally | null} lines null when there is no baseline or the file is gone
 */

/**
 * @typedef {object} CitationReport
 * @property {number} declarationFiles
 * @property {number} citations full-path citations found
 * @property {number} withLines how many of them name a line
 * @property {CitedFile[]} files one per distinct file, sorted by path
 * @property {string[]} neverResolved cited paths that exist in none of the trees consulted: with a baseline, in neither; without one, not in the checkout
 * @property {{ total: number, byRoot: Record<string, number> }} unresolvable
 * @property {{ distinct: AnchorTally, occurrences: AnchorTally } | null} anchors null without a baseline
 */

/**
 * Scan the declarations and measure their citations against `head`, and — when a
 * baseline `base` reader is given — against what they cited.
 * @param {object} input
 * @param {{ file: string, text: string }[]} input.declarations
 * @param {import("./frappe-reader.mjs").FrappeReader | null} input.base
 * @param {import("./frappe-reader.mjs").FrappeReader} input.head
 * @param {{ repo: string, baseCommit: string, headCommit: string | null } | null} input.git
 *   how to ask git for churn; null when no baseline is available
 * @returns {Promise<CitationReport>}
 */
export async function analyzeCitations({ declarations, base, head, git }) {
	/** @type {Citation[]} */
	const citations = [];
	/** @type {Unresolvable[]} */
	const bare = [];
	for (const { file, text } of declarations) {
		const found = scanCitations(text, file);
		citations.push(...found.full);
		bare.push(...found.unresolvable);
	}

	/** @type {Map<string, { citations: Citation[] }>} */
	const byPath = new Map();
	/** @type {Set<string>} */
	const neverResolved = new Set();
	const readers = base ? [base, head] : [head];
	for (const citation of citations) {
		const resolved = await resolveCitation(citation, readers);
		if (resolved === null) {
			neverResolved.add(citation.text.replace(LINES_SUFFIX, ""));
			continue;
		}
		const entry = byPath.get(resolved);
		if (entry) entry.citations.push(citation);
		else byPath.set(resolved, { citations: [citation] });
	}

	const paths = [...byPath.keys()].sort(cmp);
	const churn = base && git ? await numstat(git.repo, git.baseCommit, git.headCommit, paths) : new Map();

	/** @type {CitedFile[]} */
	const files = [];
	/** @type {AnchorTally} */
	const distinct = { total: 0, changed: 0, invalid: 0 };
	/** @type {AnchorTally} */
	const occurrences = { total: 0, changed: 0, invalid: 0 };

	for (const file of paths) {
		const cites = byPath.get(file)?.citations ?? [];
		const anchors = [...new Set(cites.flatMap((c) => c.anchors))].sort((a, b) => a - b);
		const nowThere = (await head.kindOf(file)) === "file";
		const wasThere = base !== null && (await base.kindOf(file)) === "file";
		/** @type {CitedFile["status"]} */
		const status = nowThere ? "present" : "deleted";

		/** @type {AnchorTally | null} */
		let lines = null;
		if (base && nowThere && wasThere) {
			const before = (await base.readText(file)) ?? "";
			const after = (await head.readText(file)) ?? "";
			const compared = compareAnchors(before, after, anchors);
			lines = { total: 0, changed: 0, invalid: 0 };
			for (const verdict of compared.values()) tally(lines, verdict);
			for (const verdict of compared.values()) tally(distinct, verdict);
			for (const cite of cites) for (const n of cite.anchors) tally(occurrences, compared.get(n));
		}

		files.push({
			path: file,
			citations: cites.length,
			sites: cites.map((c) => `${c.file}:${c.line}`),
			anchors,
			status,
			churn: churn.get(file) ?? null,
			lines,
		});
	}

	/** @type {Record<string, number>} */
	const byRoot = {};
	for (const u of bare) byRoot[u.root] = (byRoot[u.root] ?? 0) + 1;

	return {
		declarationFiles: declarations.length,
		citations: citations.length,
		withLines: citations.filter((c) => c.anchors.length > 0).length,
		files,
		neverResolved: [...neverResolved].sort(cmp),
		unresolvable: { total: bare.length, byRoot: Object.fromEntries(Object.entries(byRoot).sort(([a], [b]) => cmp(a, b))) },
		anchors: base ? { distinct, occurrences } : null,
	};
}

/**
 * Add one anchor verdict to a tally. `total` counts only comparable anchors.
 * @param {AnchorTally} into
 * @param {"same" | "changed" | "invalid" | undefined} verdict
 */
function tally(into, verdict) {
	if (verdict === "invalid") into.invalid++;
	else if (verdict) {
		into.total++;
		if (verdict === "changed") into.changed++;
	}
}

#!/usr/bin/env node
// Has frappe moved under the declarations since they were verified?
//
//   node scripts/audit-drift.mjs [--frappe <path>] [--baseline <file> | --from <git-ref>]
//                                [--at <git-ref>] [--json | --report md] [--ids] [--top <n>]
//                                [--update-baseline] [--strict]
//
// `package.json` says which frappe tag the declarations were verified against, and the
// `verified-against` check proves that string equals the tag the flake pins. It says
// nothing about whether anything under that tag matters. THIS answers the other
// question: what did frappe change in the places an app depends on, and how much of
// the evidence cited in src/**/*.d.ts no longer says what it said?
//
//   default          the checkout's surface snapshot  vs  drift-baseline.json
//                    (works anywhere: nix and CI have a source tree but no git history)
//   --from <ref>     vs the snapshot of that git ref instead, read with `git show` — so
//                    any two releases of a clone can be compared, and the citation
//                    report can say which cited lines changed and by how much
//   --at <ref>       audit that git ref rather than the working tree (also how the
//                    committed baseline was generated: `--at v16.33.1 --update-baseline`)
//
// A snapshot covers five structural surfaces and the version (see lib/extract-surfaces.mjs);
// the citation report (lib/citations.mjs) covers `frappe/<path>:<line>` references in src/.
//
// EXIT CODE. 0, unless --strict AND there is drift: a surface differs from the baseline,
// or a cited file is gone. Line anchors that now read differently are reported but never
// fail a run — after a handful of frappe commits most of them will, and that is what
// the report is for, not a gate. Usage errors exit 2.
//
// WHAT IT DOES NOT DO: it does not re-verify a single declaration. A clean report means
// frappe's structure did not move, not that the types are right; a dirty one means a
// human should re-read the changed files, then --update-baseline and bump
// `frappe.verifiedAgainst` together.

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { analyzeCitations, readDeclarationFiles } from "./lib/citations.mjs";
import { diffSnapshots, SNAPSHOT_SCHEMA, takeSnapshot } from "./lib/extract-surfaces.mjs";
import { countCommits, fsReader, gitReader, inspectCheckout } from "./lib/frappe-reader.mjs";
import { resolveFrappe } from "./lib/resolve-frappe.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

/** @typedef {import("./lib/frappe-reader.mjs").GitReader} GitReader */
/** @typedef {import("./lib/extract-surfaces.mjs").Snapshot} Snapshot */
/** @typedef {import("./lib/extract-surfaces.mjs").Change} Change */
/** @typedef {import("./lib/citations.mjs").CitationReport} CitationReport */

class UsageError extends Error {}

const USAGE = `usage: node scripts/audit-drift.mjs [--frappe PATH] [--baseline FILE | --from REF] [--at REF]
                                    [--json | --report md] [--ids] [--top N] [--update-baseline] [--strict]`;

function parseOptions() {
	try {
		return parseArgs({
			options: {
				frappe: { type: "string" },
				baseline: { type: "string" },
				from: { type: "string" },
				at: { type: "string" },
				json: { type: "boolean", default: false },
				report: { type: "string" },
				ids: { type: "boolean", default: false },
				top: { type: "string", default: "25" },
				"update-baseline": { type: "boolean", default: false },
				strict: { type: "boolean", default: false },
				help: { type: "boolean", short: "h", default: false },
			},
		}).values;
	} catch (error) {
		throw new UsageError(error instanceof Error ? error.message : String(error));
	}
}

/**
 * A path as the person running this would type it: relative when that is shorter than
 * climbing out of the current directory, absolute otherwise.
 * @param {string} file
 */
function display(file) {
	const relative = path.relative(process.cwd(), file);
	return relative === "" || relative.startsWith("..") ? file : relative;
}

/** @returns {Promise<number>} the exit code */
async function main() {
	const values = parseOptions();
	if (values.help) {
		console.log(USAGE);
		return 0;
	}
	if (values.baseline !== undefined && values.from !== undefined) throw new UsageError("--baseline and --from both name what to compare against; pass one");
	if (values["update-baseline"] && values.from !== undefined) throw new UsageError("--update-baseline records the tree being audited (see --at); --from does not apply");
	if (values.report !== undefined && values.report !== "md") throw new UsageError(`--report takes "md", not "${values.report}"`);
	if (values.json && values.report !== undefined) throw new UsageError("--json and --report are alternatives");
	const top = Number(values.top);
	if (!Number.isInteger(top) || top < 0) throw new UsageError(`--top takes a non-negative integer, not "${values.top}"`);
	const strict = values.strict === true;
	const format = values.json ? "json" : values.report === "md" ? "md" : "text";

	const frappePath = resolveFrappe(typeof values.frappe === "string" ? values.frappe : undefined);
	if (!frappePath) {
		console.error(
			"Could not find a frappe checkout. Pass --frappe <path> or set FRAPPE_PATH.\n" +
				"The drift audit reads frappe's own source, so it cannot run without it.",
		);
		// Not a failure: CI without a frappe checkout should still be able to run `tsc`.
		return strict ? 1 : 0;
	}
	// resolveFrappe skips a candidate that does not exist and moves on, so a mistyped
	// --frappe would quietly audit some OTHER checkout. For a tool whose whole point is
	// naming the tree it measured, that is worse than an error.
	if (typeof values.frappe === "string" && path.resolve(values.frappe) !== frappePath) {
		throw new UsageError(`--frappe ${values.frappe} is not a frappe checkout (no frappe/public/js); refusing to audit ${frappePath} instead`);
	}

	const BASELINE = path.resolve(typeof values.baseline === "string" ? values.baseline : path.join(ROOT, "drift-baseline.json"));
	/** @type {{ frappe?: { major?: string, verifiedAgainst?: string } }} */
	const pkg = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8"));

	// ------------------------------------------------------------------ the tree under audit
	const headGit = typeof values.at === "string" ? await gitReader(frappePath, values.at) : null;
	const head = headGit ?? fsReader(frappePath);
	const headSnapshot = await takeSnapshot(head, { ids: values.ids === true });
	const headInfo = headGit
		? { ref: values.at ?? null, tag: null, commit: headGit.commit, date: headGit.date }
		: { ref: null, ...(await inspectCheckout(frappePath)) };

	// ------------------------------------------------------------------ what to compare it with
	/** @type {string[]} */
	const notes = [];
	/** @type {GitReader | null} */
	let baseReader = null;
	/** @type {Snapshot | null} */
	let baseSnapshot = null;
	let baseLabel = "";
	/** @type {{ ref: string | null, tag: string | null, commit: string | null, date: string | null }} */
	let baseInfo = { ref: null, tag: null, commit: null, date: null };
	if (typeof values.from === "string") {
		baseReader = await gitReader(frappePath, values.from);
		baseSnapshot = await takeSnapshot(baseReader, { ids: values.ids === true });
		baseInfo = { ref: values.from, tag: null, commit: baseReader.commit, date: baseReader.date };
		baseLabel = `git ref ${values.from}`;
	} else if (existsSync(BASELINE)) {
		/** @type {Snapshot & { source?: { ref?: string | null, commit?: string | null, date?: string | null } }} */
		const recorded = JSON.parse(await readFile(BASELINE, "utf8"));
		if (recorded.schema !== SNAPSHOT_SCHEMA) {
			// A baseline in an older shape cannot be diffed, but it CAN be replaced — which is
			// the very remedy this message names, so it must not be blocked by the check.
			if (!values["update-baseline"]) {
				throw new Error(
					`${display(BASELINE)} is schema ${recorded.schema}, this tool writes ${SNAPSHOT_SCHEMA}: ` +
						"re-record it with --update-baseline against the tag it was recorded from.",
				);
			}
		} else {
			baseSnapshot = recorded;
			const source = recorded.source ?? {};
			baseInfo = { ref: source.ref ?? null, tag: null, commit: source.commit ?? null, date: source.date ?? null };
			baseLabel = display(BASELINE);
			if (values.ids) notes.push("--ids: the baseline file carries no id lists, so sprite ids are not diffed; use --from <ref> for that.");
			const claimed = pkg.frappe?.verifiedAgainst;
			if (recorded.version && claimed && claimed !== `v${recorded.version}`) {
				notes.push(
					`package.json frappe.verifiedAgainst is ${claimed}, but the baseline was recorded at v${recorded.version}. ` +
						"They are meant to move together, once the declarations have been re-verified.",
				);
			}
		}
	}

	const targetMajor = String(pkg.frappe?.major ?? "");
	const headMajor = (headSnapshot.version ?? "").split(".")[0];
	if (targetMajor && headMajor && headMajor !== targetMajor) {
		notes.push(`the audited tree is v${headSnapshot.version}, this typeset targets v${targetMajor}: a cross-major comparison, not a drift report.`);
	}

	const changes = baseSnapshot ? diffSnapshots(baseSnapshot, headSnapshot) : null;
	if (!baseSnapshot) {
		notes.push(
			`no baseline: ${display(BASELINE)} does not exist. Surfaces are not compared; ` +
				"record one with --update-baseline, or compare a git ref with --from.",
		);
	}

	// ------------------------------------------------------------------ the citations
	const citations = await analyzeCitations({
		declarations: await readDeclarationFiles(ROOT),
		base: baseReader,
		head,
		git: baseReader
			? { repo: frappePath, baseCommit: baseReader.commit, headCommit: headGit?.commit ?? null }
			: null,
	});

	const headCommit = headGit?.commit ?? headInfo.commit;
	const commits = baseReader && headCommit ? await countCommits(frappePath, baseReader.commit, headCommit) : null;

	const missing = citations.files.filter((f) => f.status === "deleted");
	// With a baseline, a path that exists in NEITHER tree was already wrong when it was
	// written, which is not frappe's doing. Without one, "not in this tree" is all that
	// is known, and it is the signal.
	const unfound = baseReader ? 0 : citations.neverResolved.length;
	const drift = (changes?.length ?? 0) + missing.length + unfound;

	/** @type {Report} */
	const report = {
		base: { label: baseLabel, version: baseSnapshot?.version ?? null, ...baseInfo, from: baseReader ? "git" : "baseline-file" },
		head: { label: head.label, version: headSnapshot.version, ...headInfo, reader: head.kind },
		commits,
		notes,
		changes,
		// What the audited tree looks like, changed or not: a report that only listed
		// differences could not say that FontAwesome's directory is still there.
		icons: {
			sprites: Object.fromEntries(
				Object.entries(headSnapshot.icons.sprites).map(([file, sprite]) => [file, sprite && { symbols: sprite.symbols, distinct: sprite.distinct }]),
			),
			directories: headSnapshot.icons.directories,
			fontStylesheetImports: headSnapshot.icons.fontStylesheetImports,
		},
		citations,
		drift,
	};

	// Recording a baseline with nothing to compare it to has no report worth printing.
	const recordingFresh = values["update-baseline"] === true && !baseSnapshot;
	if (!recordingFresh) {
		if (format === "json") {
			console.log(JSON.stringify(report, null, 2));
		} else {
			// Notes are about THIS run, not about the span, so a pasted-into-DRIFT.md report keeps them out.
			if (format === "md") for (const n of notes) console.error(`note: ${n}`);
			console.log(renderReport(report, format, top, frappePath));
		}
	}

	if (values["update-baseline"]) {
		const { schema, version, ...surfaces } = stripIds(headSnapshot);
		const next = {
			schema,
			// Where the tree came from, so a baseline names its tag rather than only a version.
			source: Object.fromEntries(
				Object.entries({ ref: headInfo.ref ?? headInfo.tag ?? null, commit: headInfo.commit, date: headInfo.date }).filter(([, v]) => v !== null),
			),
			version,
			...surfaces,
		};
		await writeFile(BASELINE, `${JSON.stringify(next, null, 2)}\n`);
		console.error(`\nbaseline updated: v${headSnapshot.version} -> ${display(BASELINE)}`);
		return 0;
	}

	if (strict && (!baseSnapshot || drift > 0)) {
		if (!baseSnapshot) {
			console.error("\n--strict with no baseline. Run with --update-baseline first.");
		} else {
			console.error(
				`\ndrift: ${changes?.length ?? 0} surface change(s), ${missing.length + unfound} cited file(s) missing.\n` +
					"Re-read the changed frappe files against the declarations that cite them; when they hold,\n" +
					"bump frappe.verifiedAgainst and run --update-baseline in the same commit.",
			);
		}
		return 1;
	}
	return 0;
}

/**
 * The committed baseline stays small: no id lists, however they were obtained.
 * @param {Snapshot} snapshot
 * @returns {Snapshot}
 */
function stripIds(snapshot) {
	const sprites = Object.fromEntries(
		Object.entries(snapshot.icons.sprites).map(([file, s]) => {
			if (!s) return [file, s];
			const { ids: _ids, ...rest } = s;
			return [file, rest];
		}),
	);
	return { ...snapshot, icons: { ...snapshot.icons, sprites } };
}

// --------------------------------------------------------------------------- rendering

/**
 * @typedef {object} Side
 * @property {string} label
 * @property {string | null} version
 * @property {string | null} ref the git ref it was read from, if it was read from one
 * @property {string | null} tag an exact tag on the checked-out commit
 * @property {string | null} commit
 * @property {string | null} date
 *
 * @typedef {object} Report
 * @property {Side & { from: "git" | "baseline-file" }} base
 * @property {Side & { reader: "fs" | "git" }} head
 * @property {number | null} commits
 * @property {string[]} notes
 * @property {Change[] | null} changes null when there was nothing to compare against
 * @property {{ sprites: Record<string, { symbols: number, distinct: number } | null>, directories: Record<string, boolean>, fontStylesheetImports: string[] }} icons the audited tree's icon state
 * @property {CitationReport} citations
 * @property {number} drift surface changes + cited files that are gone
 */

/** @type {[string, string][]} */
const SURFACES = [
	["scss", "scss.bundles: each `*.bundle.scss` entry file and its `@import`s"],
	["hooks", "hooks.includes: the include lists `frappe/hooks.py` assigns"],
	["icons", "icons: sprites, icon-font leftovers, `frappe.utils` helpers"],
	["bundles", "bundles: `*.bundle.*` entry files under `frappe/public`"],
	["boot", "boot: `bootinfo` keys assigned in `frappe/boot.py`"],
];

/**
 * @param {Report} report
 * @param {"md" | "text"} format
 * @param {number} top
 * @param {string} frappePath only printed in text mode: a ledger must not carry a local path
 * @returns {string}
 */
function renderReport(report, format, top, frappePath) {
	const md = format === "md";
	/** @param {string} s */
	const code = (s) => (md ? `\`${s}\`` : s);
	/** @param {string} s */
	const strip = (s) => (md ? s : s.replace(/`/g, ""));
	/** @param {number} level @param {string} s */
	const heading = (level, s) => (md ? `${"#".repeat(level)} ${s}` : level <= 2 ? `${strip(s)}\n${"=".repeat(strip(s).length)}` : `${strip(s)}:`);
	/** @param {number} n @param {number} of */
	const pct = (n, of) => (of ? `${((n / of) * 100).toFixed(1)}%` : "n/a");
	/** @param {string | null} version */
	const v = (version) => (version ? `v${version}` : "unknown version");

	const { base, head, citations: c } = report;
	/** @type {string[]} */
	const out = [];

	out.push(heading(2, report.changes ? `${v(base.version)} -> ${v(head.version)}` : v(head.version)), "");

	/** @param {Side} s @param {string} what */
	const describe = (s, what) => {
		// The ref/tag is only worth saying when it is not just the version again.
		const named = [s.ref, s.tag].find((n) => n && n !== v(s.version)) ?? null;
		const parts = [named, s.commit ? `commit ${s.commit.slice(0, 10)}` : null, s.date].filter((p) => p !== null);
		return `${what}: ${code(v(s.version))}${parts.length ? ` (${parts.join(", ")})` : ""}`;
	};
	if (report.changes) out.push(`- ${describe(base, "Baseline")}, ${base.from === "git" ? "read from git" : `from ${code(base.label)}`}.`);
	out.push(
		`- ${describe(head, "Audited")}, read from ${head.reader === "git" ? "git" : md ? "a working tree" : `the working tree ${frappePath}`}.`,
	);
	if (report.commits !== null) out.push(`- ${report.commits} commits in ${code(`${base.ref}..${head.ref ?? head.tag ?? "HEAD"}`)}.`);
	if (md) {
		const flags = [head.reader === "git" ? `--at ${head.ref}` : "", base.from === "git" ? `--from ${base.ref}` : "", "--report md"];
		out.push(`- Produced by ${code(`node scripts/audit-drift.mjs ${flags.filter(Boolean).join(" ")}`)}.`);
	} else {
		for (const n of report.notes) out.push(`- NOTE: ${n}`);
	}
	out.push("");

	// ---------------------------------------------------------------- surfaces
	out.push(heading(3, "Surface changes"), "");
	if (!report.changes) {
		out.push("Not compared: there is no baseline.", "");
	} else if (report.changes.length === 0) {
		out.push("None. Every surface below is identical between the two trees.", "");
	}
	for (const [surface, title] of SURFACES) {
		out.push(heading(4, title), "");
		const mine = (report.changes ?? []).filter((x) => x.surface === surface);
		if (!report.changes) out.push("(not compared)");
		else if (mine.length === 0) out.push("No change.");
		for (const change of mine) {
			out.push(`- ${code(change.subject)}`);
			if (change.kind === "list") {
				for (const x of change.removed) out.push(`  - removed ${code(x)}`);
				for (const x of change.added) out.push(`  - added ${code(x)}`);
				if (change.reordered) out.push("  - same members, different order");
			} else {
				for (const f of change.fields) out.push(`  - ${f.name}: ${show(f.before)} -> ${show(f.after)}`);
			}
		}
		if (surface === "icons") {
			out.push("", "In the audited tree, changed or not:", "");
			for (const [file, sprite] of Object.entries(report.icons.sprites)) {
				out.push(`- ${code(file)}: ${sprite ? `${sprite.symbols} symbols, ${sprite.distinct} distinct ids` : "listed by the icon hooks but missing"}`);
			}
			for (const [dir, present] of Object.entries(report.icons.directories)) out.push(`- ${code(dir)}: ${present ? "present" : "absent"}`);
			const imports = report.icons.fontStylesheetImports;
			out.push(`- bundles importing an icon-font stylesheet: ${imports.length ? imports.map(code).join(", ") : "none"}`);
		}
		out.push("");
	}

	// ---------------------------------------------------------------- citations
	out.push(heading(3, "Citation integrity"), "");
	const files = c.files;
	const present = files.filter((f) => f.status === "present");
	const deleted = files.filter((f) => f.status === "deleted");
	const changed = present.filter((f) => f.churn);
	out.push(
		`- ${c.citations} full-path citations (${c.withLines} name a line) in ${c.declarationFiles} declaration files, ` +
			`covering ${files.length} distinct frappe files.`,
	);
	if (c.anchors) {
		out.push(
			`- Of those files: ${changed.length} changed since ${code(base.ref ?? "the baseline")}, ` +
				`${deleted.length} deleted, ${present.length - changed.length} unchanged.`,
		);
		const d = c.anchors.distinct;
		const o = c.anchors.occurrences;
		out.push(
			`- Cited line anchors whose text differs between the two trees: ${d.changed} of ${d.total} (${pct(d.changed, d.total)}) ` +
				`counting each line once; ${o.changed} of ${o.total} (${pct(o.changed, o.total)}) counting every citation.`,
		);
		out.push(
			`  A line is compared by number, trimmed. A range contributes its two endpoints. ` +
				`${d.invalid} anchor(s) were past the end of the file at ${code(base.ref ?? "the baseline")} already and are left out.`,
		);
	} else {
		out.push(`- No baseline ref, so line anchors are not compared; pass ${code("--from <ref>")} to measure them.`);
	}
	const u = c.unresolvable;
	const roots = Object.entries(u.byRoot).sort(([a, x], [b, y]) => y - x || (a < b ? -1 : a > b ? 1 : 0));
	const shown = roots.slice(0, 8).map(([root, n]) => `${root}: ${n}`);
	if (roots.length > shown.length) shown.push(`${roots.length - shown.length} more`);
	out.push(
		`- Not checked: ${u.total} citation(s) with a line number whose path is relative or belongs to another repo ` +
			`(by first path segment, ${shown.join(", ") || "none"}). A relative citation such as ${code("grid.js:412")} means what ` +
			"its file's header says it means, and that is prose, so a file cited ONLY that way is neither resolved nor reported as deleted.",
	);
	out.push("");

	if (deleted.length) {
		out.push(heading(4, `Cited files that no longer exist (${deleted.length})`), "");
		for (const f of deleted) out.push(`- ${code(f.path)}: cited ${f.citations}x, at ${f.sites.map(code).join(", ")}`);
		out.push("");
	}
	if (c.neverResolved.length) {
		out.push(
			heading(4, base.from === "git" ? `Cited paths found in neither tree (${c.neverResolved.length})` : `Cited paths not found in the checkout (${c.neverResolved.length})`),
			"",
		);
		for (const p of c.neverResolved) out.push(`- ${code(p)}`);
		out.push("");
	}

	if (c.anchors) {
		const ranked = changed
			.map((f) => ({ f, churn: (f.churn?.added ?? 0) + (f.churn?.deleted ?? 0) }))
			.sort((a, b) => b.churn - a.churn || (a.f.path < b.f.path ? -1 : a.f.path > b.f.path ? 1 : 0))
			.slice(0, top);
		out.push(heading(4, ranked.length ? `Top ${ranked.length} changed cited files by churn (lines added + deleted)` : "Changed cited files"), "");
		if (ranked.length === 0) out.push(top === 0 ? "(--top 0)" : "None of the cited files changed.");
		const rows = ranked.map(({ f, churn }) => ({
			churn: `+${f.churn?.added ?? 0}/-${f.churn?.deleted ?? 0} (${churn})`,
			file: f.path,
			cites: String(f.citations),
			lines: f.lines?.total ? `${f.lines.changed}/${f.lines.total}` : "-",
		}));
		if (ranked.length === 0) {
			/* nothing to tabulate */
		} else if (md) {
			out.push("| churn | file | citations | cited lines changed |", "| --- | --- | ---: | ---: |");
			for (const r of rows) out.push(`| ${r.churn} | \`${r.file}\` | ${r.cites} | ${r.lines} |`);
		} else {
			for (const r of rows) out.push(`  ${r.churn.padEnd(18)} ${r.file}  (cited ${r.cites}x, lines changed ${r.lines})`);
		}
		out.push("");
	}
	return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
}

/** @param {string | number | boolean | null} value */
function show(value) {
	if (value === null) return "(none)";
	// A sha256 is 64 hex characters; the first twelve identify it in a report, and the
	// whole value is in --json and in the baseline.
	if (typeof value === "string" && /^[0-9a-f]{64}$/.test(value)) return `${value.slice(0, 12)}...`;
	return String(value);
}

// Last, so that every `const` above is initialised before `main` can read it.
try {
	process.exitCode = await main();
} catch (error) {
	console.error(`${error instanceof UsageError ? "" : "error: "}${error instanceof Error ? error.message : String(error)}`);
	if (error instanceof UsageError) console.error(`\n${USAGE}`);
	process.exitCode = 2;
}

#!/usr/bin/env node
// Move the `file:line` citations in src/**/*.d.ts to where the cited text is now.
//
//   node scripts/remap-citations.mjs [--frappe <path>] [--new-tag <tag>] [--apply] [--stamp]
//                                    [--flagged-json <file>] [--cache-dir <dir>] [--resolutions]
//                                    [--min-rename-similarity <pct>] [--config <file>] [--ledger <file>]
//
// Each declaration file names, in its header, the frappe tag its line numbers were
// read at. For every citation this asks `git diff -U0 <that tag> <new tag>` what became
// of the cited lines:
//
//   not in any hunk   the text is identical, only its number moved: the new number is exact
//   in a hunk         modified or deleted: flagged for a human, with candidates, never guessed
//   file deleted      flagged (a rename git can follow is followed)
//
// A path written with no number (`form/sidebar/document_follow.js`) has nothing to move
// but can still be deleted: those are resolved the same way and flagged when the file is gone.
//
// DEFAULT IS A DRY RUN. `--apply` rewrites the digits of the citations that mapped
// exactly — nothing else in the file, and never a citation whose lines were touched.
// Stamps ("Verified against frappe vX") change ONLY under `--stamp`, because stamping
// is a claim that a person re-read the source; run it after the flagged citations have
// been reviewed, not before.
//
// IDEMPOTENT. After `--apply` a file holds numbers for two tags (the new one, and the old
// on each flagged citation), while its header still names the old tag. `citation-anchors.json`
// records which is which, so a second run finds nothing to do. See lib/remap.mjs.
//
// Which frappe file does a bare `grid.js:412` mean? That is `lib/citation-bases.json`: per
// declaration file, the base its header declares, the names it uses for something other
// than frappe core, and the few it must pin. A name that is still ambiguous is reported as
// unresolved and left alone.
//
// EXIT STATUS. 0, or 1 if a computed mapping failed its own check (a bug: nothing is
// written for it). Usage errors exit 2.

import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { readDeclarationFiles } from "./lib/citations.mjs";
import { cmp } from "./lib/frappe-reader.mjs";
import {
	applyEdits,
	applyStamp,
	checkConfig,
	checkLedger,
	createGitSource,
	emptyLedger,
	flaggedRecords,
	planRemap,
	readStamp,
	tally,
} from "./lib/remap.mjs";
import { resolveFrappe } from "./lib/resolve-frappe.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const DEFAULT_NEW_TAG = "v16.50.0";

class UsageError extends Error {}

const USAGE = `usage: node scripts/remap-citations.mjs [--frappe PATH] [--new-tag TAG] [--apply] [--stamp]
                                  [--flagged-json FILE] [--cache-dir DIR] [--resolutions]
                                  [--min-rename-similarity PCT] [--config FILE] [--ledger FILE]`;

function parseOptions() {
	try {
		return parseArgs({
			options: {
				frappe: { type: "string" },
				"new-tag": { type: "string", default: DEFAULT_NEW_TAG },
				apply: { type: "boolean", default: false },
				stamp: { type: "boolean", default: false },
				"flagged-json": { type: "string" },
				"cache-dir": { type: "string" },
				resolutions: { type: "boolean", default: false },
				"min-rename-similarity": { type: "string", default: "70" },
				config: { type: "string", default: path.join(ROOT, "scripts", "lib", "citation-bases.json") },
				ledger: { type: "string", default: path.join(ROOT, "citation-anchors.json") },
				help: { type: "boolean", short: "h", default: false },
			},
		}).values;
	} catch (error) {
		throw new UsageError(error instanceof Error ? error.message : String(error));
	}
}

/** @param {string} file */
function display(file) {
	const relative = path.relative(process.cwd(), file);
	return relative === "" || relative.startsWith("..") ? file : relative;
}

/**
 * Write a file so a killed run never leaves half of it.
 * @param {string} file
 * @param {string} text
 */
async function writeAtomic(file, text) {
	await mkdir(path.dirname(file), { recursive: true });
	const tmp = `${file}.${process.pid}.tmp`;
	await writeFile(tmp, text);
	await rename(tmp, file);
}

/** @returns {Promise<number>} the exit code */
async function main() {
	const values = parseOptions();
	if (values.help) {
		console.log(USAGE);
		return 0;
	}
	const newTag = String(values["new-tag"]);
	const minRename = Number(values["min-rename-similarity"]);
	if (!Number.isFinite(minRename) || minRename < 50 || minRename > 100) {
		throw new UsageError(`--min-rename-similarity takes a percentage from 50 (git's own floor) to 100, not "${values["min-rename-similarity"]}"`);
	}
	if (values.stamp && !values.apply) {
		console.error("note: --stamp without --apply only previews which headers would change.");
	}

	const frappePath = resolveFrappe(typeof values.frappe === "string" ? values.frappe : undefined);
	if (!frappePath) throw new UsageError("Could not find a frappe checkout. Pass --frappe <path> or set FRAPPE_PATH: the remapper asks git what changed between two tags.");
	// Same guard as audit-drift: a mistyped --frappe must not quietly remap against some other tree.
	if (typeof values.frappe === "string" && path.resolve(values.frappe) !== frappePath) {
		throw new UsageError(`--frappe ${values.frappe} is not a frappe checkout (no frappe/public/js); refusing to use ${frappePath} instead`);
	}

	const config = checkConfig(JSON.parse(await readFile(String(values.config), "utf8")));
	const ledgerFile = path.resolve(String(values.ledger));
	const ledger = existsSync(ledgerFile) ? checkLedger(JSON.parse(await readFile(ledgerFile, "utf8"))) : null;
	/** @type {{ frappe?: { verifiedAgainst?: string } }} */
	const pkg = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8"));
	const declarations = await readDeclarationFiles(ROOT);
	const texts = new Map(declarations.map((d) => [d.file, d.text]));

	const source = createGitSource({
		repo: frappePath,
		cacheDir: typeof values["cache-dir"] === "string" ? path.resolve(values["cache-dir"]) : null,
		similarity: 50,
	});
	const plan = await planRemap({
		declarations,
		config,
		packageTag: pkg.frappe?.verifiedAgainst ?? null,
		ledger,
		newTag,
		source,
		minRenameSimilarity: minRename,
	});

	// ------------------------------------------------------------------ the report
	const tags = [...new Set(plan.files.flatMap((f) => [f.tag.tag, ...f.decisions.map((d) => d.oldTag)]))].sort(cmp);
	console.log(`frappe citation remap  ${tags.join(", ")} -> ${newTag}   (${display(frappePath)}, ${values.apply ? "APPLY" : "dry run"})`);
	console.log("");
	const cols = /** @type {const} */ ([
		["total", "total"],
		["no-line", "no line"],
		["current", "current"],
		["unchanged", "unchanged"],
		["moved", "moved"],
		["modified", "modified"],
		["deleted", "deleted"],
		["renamed", "renamed"],
		["unresolved", "unresolved"],
		["invalid", "invalid"],
		["failed", "failed"],
		["uncovered", "file-less"],
		["out-of-scope", "not core"],
	]);
	const nameWidth = Math.max(...plan.files.map((f) => f.dts.length), "TOTAL".length);
	const widths = cols.map(([, label]) => Math.max(label.length, 5));
	const row = (/** @type {string} */ name, /** @type {string} */ tag, /** @type {(number | string)[]} */ cells) =>
		`${name.padEnd(nameWidth)}  ${tag.padEnd(9)}  ${cells.map((c, i) => String(c).padStart(widths[i] ?? 5)).join("  ")}`;
	console.log(row("", "tag", cols.map(([, label]) => label)));
	/** @type {Record<string, number>} */
	const total = Object.fromEntries(cols.map(([k]) => [k, 0]));
	for (const f of plan.files) {
		const t = tally(f);
		for (const [k] of cols) total[k] = (total[k] ?? 0) + (t[k] ?? 0);
		console.log(row(f.dts, f.tag.tag, cols.map(([k]) => t[k] ?? 0)));
	}
	console.log(row("TOTAL", "", cols.map(([k]) => total[k] ?? 0)));
	console.log("");
	console.log("tag used per file, and why:");
	for (const f of plan.files) console.log(`  ${f.dts.padEnd(nameWidth)}  ${f.tag.tag}  (${f.tag.from}${f.headerTag && f.headerTag !== f.tag.tag ? `; header says ${f.headerTag}` : ""})`);
	for (const f of plan.files) for (const p of f.problems) console.log(`  ! ${f.dts}: ${p}`);

	const counts = (/** @type {(d: import("./lib/remap.mjs").Decision) => string | null} */ key) => {
		/** @type {Map<string, number>} */
		const m = new Map();
		for (const f of plan.files) {
			for (const d of f.decisions) {
				const k = key(d);
				if (k) m.set(k, (m.get(k) ?? 0) + 1);
			}
		}
		return [...m.entries()].sort(([a], [b]) => cmp(a, b)).map(([k, n]) => `${k} ${n}`).join(", ");
	};
	console.log("");
	console.log(`not frappe core: ${counts((d) => (d.resolution.scope === "not-core" ? d.resolution.owner : null)) || "none"}`);
	console.log(`resolved bare names by basis: ${counts((d) => (d.resolution.scope === "core" && d.ref.form === "relative" ? d.resolution.basis : null)) || "none"}`);
	console.log(`flagged by status: ${counts((d) => (["modified", "deleted", "renamed", "invalid", "failed"].includes(d.outcome) ? d.status : null)) || "none"}`);
	console.log(`unresolved by reason: ${counts((d) => (d.outcome === "unresolved" ? d.status : null)) || "none"}`);
	const exact = plan.files.flatMap((f) => f.decisions).filter((d) => d.outcome === "moved" || d.outcome === "unchanged");
	const verified = exact.reduce((n, d) => n + d.verdicts.reduce((m, v) => m + (v.end ? 2 : 1), 0), 0);
	console.log(
		exact.length === 0
			? `verification: no citation needed mapping this run (${total.current ?? 0} already follow ${newTag}); ${total.failed ?? 0} mapping(s) failed their check`
			: `verification: ${verified} cited lines in ${exact.length} exactly-mapped citations were re-read at both tags and are identical (trimmed); ${total.failed ?? 0} mapping(s) failed that check`,
	);

	if (values.resolutions) {
		console.log("\nresolutions (dts | as written -> path [basis] x count)");
		for (const f of plan.files) {
			/** @type {Map<string, number>} */
			const m = new Map();
			for (const d of f.decisions) {
				if (d.ref.form !== "relative") continue;
				const r = d.resolution;
				const to = r.scope === "core" ? `${r.path} [${r.basis}]` : r.scope === "not-core" ? `(not core: ${r.owner})` : `UNRESOLVED ${r.reason}${r.candidates.length ? ` ${r.candidates.join(" | ")}` : ""}`;
				const k = `${f.dts} | ${d.ref.written} -> ${to}`;
				m.set(k, (m.get(k) ?? 0) + 1);
			}
			for (const [k, n] of [...m.entries()].sort(([a], [b]) => cmp(a, b))) console.log(`  ${k} x${n}`);
		}
	}

	// ------------------------------------------------------------------ the flagged list
	const records = flaggedRecords(plan, texts);
	if (typeof values["flagged-json"] === "string") {
		const out = path.resolve(values["flagged-json"]);
		const payload = {
			tool: "scripts/remap-citations.mjs",
			newTag,
			frappe: { checkout: frappePath },
			candidateNote:
				"newCandidateLines are guesses by text similarity (identical text elsewhere in the new file, else token similarity >= 0.6). They are candidates for a reviewer to look at, not facts.",
			tags: Object.fromEntries(plan.files.map((f) => [f.dts, { tag: f.tag.tag, from: f.tag.from, header: f.headerTag }])),
			summary: Object.fromEntries(plan.files.map((f) => [f.dts, tally(f)])),
			flagged: records.flagged,
			unresolved: records.unresolved,
			uncovered: records.uncovered,
		};
		await writeAtomic(out, `${JSON.stringify(payload, null, 2)}\n`);
		console.log(`\nflagged list: ${records.flagged.length} flagged, ${records.unresolved.length} unresolved, ${records.uncovered.length} file-less -> ${out}`);
	}

	// ------------------------------------------------------------------ apply / stamp
	const wantStamp = values.stamp === true;
	/** @type {Map<string, string>} */
	const next = new Map();
	let edits = 0;
	for (const f of plan.files) {
		let text = texts.get(f.dts) ?? "";
		if (f.edits.length > 0) {
			edits += f.edits.length;
			text = applyEdits(text, f.edits);
		}
		if (wantStamp && f.headerTag && f.headerTag !== newTag) {
			const fromSha = readStamp(text).shas.length > 0 ? await source.commit(f.headerTag) : null;
			text = applyStamp(text, { from: f.headerTag, to: newTag, fromSha, toSha: fromSha ? await source.commit(newTag) : null });
		}
		if (text !== texts.get(f.dts)) next.set(f.dts, text);
	}
	console.log("");
	console.log(`${values.apply ? "writing" : "would change"} ${edits} line number(s) in ${plan.files.filter((f) => f.edits.length > 0).length} file(s)${wantStamp ? `; ${values.apply ? "stamping" : "would stamp"} ${plan.files.filter((f) => f.headerTag && f.headerTag !== newTag).length} header(s) as ${newTag}` : "; stamps untouched"}`);

	if (values.apply) {
		for (const [file, text] of next) await writeAtomic(path.join(ROOT, file), text);
		const merged = ledger ?? emptyLedger();
		for (const f of plan.files) {
			if (wantStamp) delete merged.files[f.dts];
			else {
				const entry = plan.ledger.files[f.dts];
				if (entry) merged.files[f.dts] = entry;
			}
		}
		// Sorted, so the file is the same however the files were visited.
		merged.files = Object.fromEntries(Object.entries(merged.files).sort(([a], [b]) => cmp(a, b)));
		await writeAtomic(ledgerFile, `${JSON.stringify(merged, null, "\t")}\n`);
		console.log(`wrote ${next.size} declaration file(s) and ${display(ledgerFile)}`);
	} else {
		console.log("dry run: nothing written. Pass --apply to write.");
	}
	return (total.failed ?? 0) > 0 ? 1 : 0;
}

try {
	process.exitCode = await main();
} catch (error) {
	if (error instanceof UsageError) {
		console.error(`${error.message}\n${USAGE}`);
		process.exitCode = 2;
	} else {
		throw error;
	}
}

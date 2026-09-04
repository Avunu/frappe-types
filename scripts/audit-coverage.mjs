#!/usr/bin/env node
// Coverage of this typeset against a real frappe checkout.
//
//   node scripts/audit-coverage.mjs [--frappe <path>] [--strict] [--update-baseline]
//                                   [--cross-major] [--top <n>] [--json]
//                                   [--top <n>] [--json]
//
// Frappe's desk API is far larger than any hand-maintained typeset will cover on
// day one, so raw coverage % is not a pass/fail signal — a RATCHET is. `--strict`
// fails only when coverage falls below coverage-baseline.json, which is what CI
// wants: new declarations are always welcome, silent regressions never are.
//
// Bump the baseline with --update-baseline after adding declarations, and note in
// the commit which frappe tag it was measured against.

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { byImportance, extractFrappeSurface, withAncestors } from "./lib/extract-frappe.mjs";
import { probePaths } from "./lib/probe.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const BASELINE = path.join(ROOT, "coverage-baseline.json");

/** This package's own manifest — `frappe.major` says which frappe this typeset is for. */
const pkg = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8"));

const { values } = parseArgs({
	options: {
		frappe: { type: "string" },
		strict: { type: "boolean", default: false },
		"update-baseline": { type: "boolean", default: false },
		// Measure against a frappe major this typeset does not target. Reports only:
		// incompatible with --strict and --update-baseline. See the note further down.
		"cross-major": { type: "boolean", default: false },
		top: { type: "string", default: "40" },
		json: { type: "boolean", default: false },
	},
});

function resolveFrappe() {
	const candidates = [
		values.frappe,
		process.env.FRAPPE_PATH,
		path.resolve(ROOT, "..", "frappe"),
		path.resolve(ROOT, "..", "frappe-carbon-dev", "apps", "frappe"),
		path.resolve(ROOT, "..", "..", "apps", "frappe"),
	].filter(Boolean);
	for (const c of candidates) {
		if (existsSync(path.join(c, "frappe", "public", "js"))) return path.resolve(c);
	}
	return null;
}

const frappePath = resolveFrappe();
if (!frappePath) {
	console.error(
		"Could not find a frappe checkout. Pass --frappe <path> or set FRAPPE_PATH.\n" +
			"Coverage is measured against frappe's own source, so this audit cannot run without it.",
	);
	// Not a failure: CI without a frappe checkout should still be able to run `tsc`.
	process.exit(values.strict ? 1 : 0);
}

let frappeVersion = "unknown";
try {
	const init = await readFile(path.join(frappePath, "frappe", "__init__.py"), "utf8");
	frappeVersion = init.match(/__version__\s*=\s*["']([^"']+)["']/)?.[1] ?? "unknown";
} catch {
	/* version is informational only */
}

console.log(`frappe checkout: ${frappePath} (v${frappeVersion})`);

// The checkout must be the frappe major this typeset targets, and that has to be
// CHECKED rather than assumed: `resolveFrappe` takes the first candidate that exists,
// and `../frappe` — a sibling clone, very often on `develop` — is tried before the
// bench. Measuring the v16 typeset against a v17 checkout produces a number that looks
// exactly like a regression and is nothing of the kind: the surface grows (2063 -> 2214
// paths at 17.0.0-dev), so the percentage falls with identical declarations, and every
// path v17 renamed or dropped leaves `covered` too. That reads as "N previously-declared
// paths no longer resolve", i.e. it blames the typeset for frappe moving.
//
// Cross-major IS a legitimate thing to ask for — README's frappe-major upgrade procedure
// runs exactly this to get a breaking-change report — so it is a flag, not a refusal.
// What it can never be is the BASELINE comparison: a ratchet against a different major
// is meaningless, so --strict and --update-baseline are refused outright below.
const targetMajor = String(pkg?.frappe?.major ?? "").trim();
const checkoutMajor = frappeVersion.split(".")[0];
const crossMajor = Boolean(targetMajor) && checkoutMajor !== targetMajor;

if (crossMajor && !values["cross-major"]) {
	console.error(
		`\nThis is the Frappe v${targetMajor} typeset (package.json frappe.major), but the checkout\n` +
			`above is v${checkoutMajor}. Coverage measured across majors is not comparable with the\n` +
			`baseline and is not a regression signal.\n\n` +
			`  measure the right checkout:  --frappe <path to a v${targetMajor} checkout>   (or set FRAPPE_PATH)\n` +
			`  deliberately look ahead:     --cross-major   (reports only; no baseline, no ratchet)`,
	);
	process.exit(1);
}

if (crossMajor) {
	if (values.strict || values["update-baseline"]) {
		console.error(
			`\n--cross-major cannot be combined with ${values.strict ? "--strict" : "--update-baseline"}: ` +
				`this typeset targets v${targetMajor} and the checkout is v${checkoutMajor}.`,
		);
		process.exit(1);
	}
	console.log(
		`NOTE: v${checkoutMajor} checkout against the v${targetMajor} typeset — a look-ahead report.\n` +
			`      The numbers below are NOT comparable with coverage-baseline.json.\n`,
	);
}

const { definitions, reads, prototypes, files } = await extractFrappeSurface(frappePath);
console.log(`scanned ${files} js files — ${definitions.size} definitions, ${reads.size} read paths, ${prototypes.size} prototype/subclass sites\n`);

// The coverage target is every path frappe DEFINES plus every path frappe READS,
// expanded through ancestors. Prototype paths are reported separately: they matter
// for patchability but `frappe.x.Y.prototype.z` is not a distinct declaration.
const target = withAncestors([...definitions.keys(), ...reads.keys()]);
const { covered, missing } = await probePaths(target);

const pct = target.length ? (covered.length / target.length) * 100 : 0;
const missingSet = new Set(missing.map((m) => m.path));

// Rank what is missing by how much of frappe's own source depends on it.
const importance = new Map([...byImportance(reads), ...byImportance(definitions)].map(([k, v]) => [k, v.length]));
const rankedMissing = [...missingSet]
	.map((p) => ({ path: p, weight: importance.get(p) ?? 0 }))
	.sort((a, b) => b.weight - a.weight || a.path.localeCompare(b.path));

if (values.json) {
	console.log(JSON.stringify({ frappeVersion, target: target.length, covered: covered.length, pct, missing: rankedMissing }, null, 2));
} else {
	console.log(`coverage: ${covered.length}/${target.length} paths (${pct.toFixed(2)}%)\n`);
	const top = Number(values.top);
	console.log(`top ${Math.min(top, rankedMissing.length)} undeclared paths, by how many frappe source files use them:`);
	for (const m of rankedMissing.slice(0, top)) {
		console.log(`  ${String(m.weight).padStart(4)}  ${m.path}`);
	}
	if (rankedMissing.length > top) console.log(`  ... and ${rankedMissing.length - top} more`);
}

let baseline = null;
if (existsSync(BASELINE)) baseline = JSON.parse(await readFile(BASELINE, "utf8"));

if (values["update-baseline"]) {
	const next = { frappeVersion, target: target.length, covered: covered.length, pct: Number(pct.toFixed(4)) };
	await writeFile(BASELINE, JSON.stringify(next, null, 2) + "\n");
	console.log(`\nbaseline updated: ${next.covered}/${next.target} (${next.pct}%) against frappe v${frappeVersion}`);
	process.exit(0);
}

if (values.strict) {
	if (!baseline) {
		console.error("\n--strict with no coverage-baseline.json. Run with --update-baseline first.");
		process.exit(1);
	}
	// Compare absolute covered count as well as percentage: a frappe upgrade that
	// grows the surface would otherwise let real regressions hide behind a
	// shrinking denominator.
	const lostPaths = baseline.covered - covered.length;
	if (pct + 1e-9 < baseline.pct && lostPaths > 0) {
		// `covered` counts paths in the TARGET set that resolve, and the target set is
		// derived from frappe's source — so it moves when frappe does. A path frappe
		// DELETED leaves the target set and takes its own coverage with it, which looks
		// identical here to a declaration this repo broke. Saying "previously-declared
		// paths no longer resolve" for that case blames the typeset for someone else's
		// rename, so when the frappe version has moved the message says which of the two
		// it cannot distinguish, rather than asserting the alarming one.
		const drifted = baseline.frappeVersion && baseline.frappeVersion !== frappeVersion;
		console.error(
			`\nCoverage regressed: ${pct.toFixed(2)}% (${covered.length} paths) vs baseline ${baseline.pct}% (${baseline.covered} paths).`,
		);
		if (drifted) {
			console.error(
				`\nThe baseline was recorded against frappe v${baseline.frappeVersion} and this run measured\n` +
					`v${frappeVersion}, so ${lostPaths} path(s) went missing for one of two reasons this check cannot\n` +
					`tell apart:\n` +
					`  * frappe removed or renamed them — not a regression here; re-record with --update-baseline\n` +
					`  * a declaration in src/ stopped resolving — a real regression\n\n` +
					`To tell which: re-run against a v${baseline.frappeVersion} checkout. If it is clean, it was frappe.`,
			);
		} else {
			console.error(`${lostPaths} previously-declared path(s) no longer resolve.`);
		}
		process.exit(1);
	}
	console.log(`\nOK — ${pct.toFixed(2)}% vs baseline ${baseline.pct}%`);
}

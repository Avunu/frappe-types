#!/usr/bin/env node
// Coverage of this typeset against a real frappe checkout.
//
//   node scripts/audit-coverage.mjs [--frappe <path>] [--strict] [--update-baseline]
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

const { values } = parseArgs({
	options: {
		frappe: { type: "string" },
		strict: { type: "boolean", default: false },
		"update-baseline": { type: "boolean", default: false },
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
		console.error(
			`\nCoverage regressed: ${pct.toFixed(2)}% (${covered.length} paths) vs baseline ${baseline.pct}% (${baseline.covered} paths).\n` +
				`${lostPaths} previously-declared path(s) no longer resolve.`,
		);
		process.exit(1);
	}
	console.log(`\nOK — ${pct.toFixed(2)}% vs baseline ${baseline.pct}%`);
}

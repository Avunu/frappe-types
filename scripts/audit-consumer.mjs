#!/usr/bin/env node
// What would block a consumer app from compiling under `strict` with no escape hatches?
//
//   node scripts/audit-consumer.mjs <app-path> [<app-path>...] [--strict] [--fail-on-untyped]
//                                   [--types <file-or-glob>]... [--json]
//
// Coverage against frappe's whole surface (audit-coverage.mjs) measures ambition.
// This measures the thing that actually matters day to day: does the typeset cover
// everything MY app touches? Every path reported here is a compile error waiting
// to happen in a consumer that cannot `as any` its way out — which is the whole
// premise of this package.
//
// Three outcomes per path:
//   - undeclared: the checker cannot resolve it. `--strict` exits 1 on any.
//   - untyped: it resolves, but to `unknown` (or `any`). It compiles as a bare
//     read, and the first call or member access on it does not. Listed always;
//     `--fail-on-untyped` exits 1 on any.
//   - declared-but-optional: resolves through a member that is optional on
//     purpose (a lazily loaded namespace). Covered; the app must narrow first.
//
// `--types` adds an app's own declaration files to the program, so that names
// the app defines for itself (its controls, its views, its `frappe.*` helpers)
// count as declared once the app has declared them. Repeat it, or pass a glob.
// Inside those files `frappe-types` resolves to this checkout.
//
// Which paths a file uses is decided by scripts/lib/scan-source.mjs: code, plus
// the content of any string that is itself JavaScript, never prose that merely
// mentions a frappe name.
//
// Run it from a consumer's CI, or here against the apps you maintain.

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { glob } from "node:fs/promises";
import { parseArgs } from "node:util";
import { withAncestors } from "./lib/extract-frappe.mjs";
import { probePaths } from "./lib/probe.mjs";
import { scanSource } from "./lib/scan-source.mjs";

const { values, positionals } = parseArgs({
	allowPositionals: true,
	options: {
		strict: { type: "boolean", default: false },
		"fail-on-untyped": { type: "boolean", default: false },
		types: { type: "string", multiple: true, default: [] },
		json: { type: "boolean", default: false },
	},
});

if (!positionals.length) {
	console.error(
		"usage: node scripts/audit-consumer.mjs <app-path> [<app-path>...] [--strict] [--fail-on-untyped] [--types <file-or-glob>]... [--json]",
	);
	process.exit(2);
}

const extraTypes = [];
for (const pattern of values.types) {
	const before = extraTypes.length;
	if (existsSync(pattern)) {
		extraTypes.push(path.resolve(pattern));
	} else {
		for await (const entry of glob(pattern, { exclude: (name) => name === "node_modules" })) {
			extraTypes.push(path.resolve(entry));
		}
	}
	if (extraTypes.length === before) {
		console.error(`--types ${pattern}: matched no files`);
		process.exit(2);
	}
}

const usage = new Map();
const globalsSeen = new Set();
let scanned = 0;

for (const app of positionals) {
	const root = path.resolve(app);
	if (!existsSync(root)) {
		console.error(`no such path: ${root}`);
		process.exit(2);
	}
	for await (const entry of glob("**/*.{js,mjs,ts,mts,vue}", {
		cwd: root,
		exclude: (name) => name === "node_modules" || name === "dist" || name === ".git" || name === "__pycache__",
	})) {
		const abs = path.join(root, entry);
		let src;
		try {
			src = await readFile(abs, "utf8");
		} catch {
			continue;
		}
		scanned++;
		const found = scanSource(src, { vue: entry.endsWith(".vue") });
		const rel = path.relative(process.cwd(), abs);
		for (const p of found.paths) {
			const list = usage.get(p) ?? [];
			if (!list.includes(rel)) list.push(rel);
			usage.set(p, list);
		}
		for (const g of found.globals) globalsSeen.add(g);
	}
}

const target = [...withAncestors(usage.keys()), ...globalsSeen];
console.log(
	`scanned ${scanned} files across ${positionals.length} app(s) — ${usage.size} distinct frappe paths, ${globalsSeen.size} other globals${extraTypes.length ? `, with ${extraTypes.length} app type file(s)` : ""}\n`,
);

const { covered, guarded, missing, untyped } = await probePaths(target, { untyped: true, extraTypes });
const pct = target.length ? (covered.length / target.length) * 100 : 100;

const rows = missing
	.map((m) => ({ ...m, files: usage.get(m.path) ?? [] }))
	.sort((a, b) => b.files.length - a.files.length || a.path.localeCompare(b.path));

// Only the paths the app itself names. An ancestor that is `unknown` makes its
// child undeclared, which is reported above; listing the ancestor too says the
// same thing twice.
const untypedRows = untyped
	.filter((p) => usage.has(p) || globalsSeen.has(p))
	.map((p) => ({ path: p, files: usage.get(p) ?? [] }))
	.sort((a, b) => b.files.length - a.files.length || a.path.localeCompare(b.path));

const guardRows = guarded
	.map((m) => ({ ...m, files: usage.get(m.path) ?? [] }))
	.sort((a, b) => a.path.localeCompare(b.path));

if (values.json) {
	console.log(
		JSON.stringify(
			{ target: target.length, covered: covered.length, pct, missing: rows, untyped: untypedRows, guarded: guardRows },
			null,
			2,
		),
	);
} else {
	console.log(`consumer coverage: ${covered.length}/${target.length} (${pct.toFixed(2)}%)`);
	if (guardRows.length) {
		// Declared, resolvable, and deliberately optional — see NULLABLE_CODES in
		// scripts/lib/probe.mjs. Listed so the number is not silently swallowed,
		// but these are not gaps and must not be "fixed" by dropping the `?`.
		console.log(
			`\n${guardRows.length} declared-but-optional path(s) — covered; the consumer must narrow before use:\n`,
		);
		for (const r of guardRows) {
			console.log(`  ${r.path}   (TS${r.code} unguarded)`);
		}
	}
	if (untypedRows.length) {
		console.log(
			`\n${untypedRows.length} declared-but-untyped path(s) — they resolve to \`unknown\`, so a strict build fails at the first use:\n`,
		);
		for (const r of untypedRows) {
			console.log(`  ${r.path}`);
			if (r.files.length) console.log(`      used in: ${r.files.slice(0, 6).join(", ")}${r.files.length > 6 ? ` (+${r.files.length - 6} more)` : ""}`);
		}
	}
	if (!rows.length) {
		console.log(
			untypedRows.length
				? "\nEvery symbol these apps touch is declared, but the untyped ones above still need a type before a strict build passes."
				: "\nEvery symbol these apps touch is declared. A strict, no-escape-hatch build is possible.",
		);
	} else {
		console.log(`\n${rows.length} undeclared symbol(s) — each one blocks a strict build:\n`);
		for (const r of rows) {
			console.log(`  ${r.path}`);
			console.log(`      TS${r.code}: ${r.message}`);
			if (r.files.length) console.log(`      used in: ${r.files.slice(0, 6).join(", ")}${r.files.length > 6 ? ` (+${r.files.length - 6} more)` : ""}`);
		}
	}
}

if (values.strict && rows.length) process.exit(1);
if (values["fail-on-untyped"] && untypedRows.length) process.exit(1);

#!/usr/bin/env node
// What would block a consumer app from compiling under `strict` with no escape hatches?
//
//   node scripts/audit-consumer.mjs <app-path> [<app-path>...] [--strict] [--json]
//
// Coverage against frappe's whole surface (audit-coverage.mjs) measures ambition.
// This measures the thing that actually matters day to day: does the typeset cover
// everything MY app touches? Every path reported here is a compile error waiting
// to happen in a consumer that cannot `as any` its way out — which is the whole
// premise of this package.
//
// Run it from a consumer's CI, or here against the apps you maintain.

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { glob } from "node:fs/promises";
import { parseArgs } from "node:util";
import { withAncestors } from "./lib/extract-frappe.mjs";
import { probePaths } from "./lib/probe.mjs";

const { values, positionals } = parseArgs({
	allowPositionals: true,
	options: {
		strict: { type: "boolean", default: false },
		json: { type: "boolean", default: false },
	},
});

if (!positionals.length) {
	console.error("usage: node scripts/audit-consumer.mjs <app-path> [<app-path>...] [--strict]");
	process.exit(2);
}

const IDENT = "[A-Za-z_$][A-Za-z0-9_$]*";
const re_frappe = new RegExp(`(?:^|[^\\w.$])(frappe(?:\\.${IDENT})+)`, "g");
// Other desk globals a consumer leans on. These are single identifiers, so they
// are probed as-is rather than as dotted paths.
const OTHER_GLOBALS = ["__", "locals", "cur_frm", "cur_list", "cur_dialog", "cur_page", "erpnext"];
const re_other = new RegExp(`(?:^|[^\\w.$])(${OTHER_GLOBALS.join("|")})(?![\\w$])`, "g");

/** Comments hold prose about frappe APIs, not calls to them. */
function stripComments(src) {
	return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

/**
 * Remove PYTHON dotted paths that only ever appear inside string literals.
 *
 * `frappe.auth.get_logged_user` and `frappe.client.get_list` look exactly like
 * member expressions to a regex, but a grep of `frappe/public/js` at v16.33.0
 * finds neither as a JS object: `frappe.client` appears only as the `method:` of
 * a server call (`frappe/public/js/frappe/db.js:44,61,70,86,98,102`) and
 * `frappe.auth` only as a REST path. Declaring them on the `frappe` global to
 * make this audit go green would be a fabrication — see the `Frappe` interface's
 * own note in `src/index.d.ts`.
 *
 * Two forms are stripped, and ONLY these two, both of which are unambiguous:
 *
 *  1. `/api/method/<dotted.path>` — a URL, wherever it occurs.
 *  2. A quoted string whose ENTIRE content is a dotted `frappe.…` path — the
 *     `frappe.call({method})` / `frappe.xcall(…)` / `frappe.db.*` idiom.
 *
 * Everything else in a string survives on purpose: the CDP harnesses in
 * `carbon_frappe/scripts/tables/*.ts` ship real browser code as template
 * literals (`frappe.query_report.datatable.destroy()`), and those ARE member
 * expressions that the typeset must cover. A whole-file string strip would hide
 * them.
 */
function stripServerMethodPaths(code) {
	const DOTTED = "[A-Za-z_$][A-Za-z0-9_$]*(?:\\.[A-Za-z_$][A-Za-z0-9_$]*)+";
	return code
		.replace(new RegExp(`/api/method/${DOTTED}`, "g"), "/api/method/")
		.replace(new RegExp(`(['"\`])\\s*(frappe\\.${DOTTED})\\s*\\1`, "g"), "$1$1");
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
		const code = stripComments(src);
		const scannable = stripServerMethodPaths(code);
		for (const m of scannable.matchAll(re_frappe)) {
			if (/\.\d/.test(m[1])) continue;
			const list = usage.get(m[1]) ?? [];
			const rel = path.relative(process.cwd(), abs);
			if (!list.includes(rel)) list.push(rel);
			usage.set(m[1], list);
		}
		for (const m of scannable.matchAll(re_other)) globalsSeen.add(m[1]);
	}
}

const target = [...withAncestors(usage.keys()), ...globalsSeen];
console.log(`scanned ${scanned} files across ${positionals.length} app(s) — ${usage.size} distinct frappe paths, ${globalsSeen.size} other globals\n`);

const { covered, guarded, missing } = await probePaths(target);
const pct = target.length ? (covered.length / target.length) * 100 : 100;

const rows = missing
	.map((m) => ({ ...m, files: usage.get(m.path) ?? [] }))
	.sort((a, b) => b.files.length - a.files.length || a.path.localeCompare(b.path));

const guardRows = guarded
	.map((m) => ({ ...m, files: usage.get(m.path) ?? [] }))
	.sort((a, b) => a.path.localeCompare(b.path));

if (values.json) {
	console.log(JSON.stringify({ target: target.length, covered: covered.length, pct, missing: rows, guarded: guardRows }, null, 2));
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
	if (!rows.length) {
		console.log("\nEvery symbol these apps touch is declared. A strict, no-escape-hatch build is possible.");
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

// Type-checker-backed API probe.
//
// Coverage of a hand-maintained typeset is easy to fake with a regex over the
// .d.ts files: you end up measuring how the declarations are *written* rather
// than what they actually admit. So this asks the real compiler instead.
//
// Given a list of dotted API paths (`frappe.ui.form.Grid`), it emits one probe
// statement per path — one per LINE, so a diagnostic's line number maps straight
// back to the path — type-checks the file against src/*.d.ts, and reports every
// path the checker rejected. A path is "covered" iff tsc accepts reading it.

import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const PROBE_DIR = path.join(ROOT, ".probe");

/** Paths tsc will reject for reasons that are not "undeclared". */
const IGNORABLE_CODES = new Set([
	6133, // declared but never read
	6196, // declared but never used
]);

/**
 * Nullability diagnostics. These mean the OPPOSITE of "undeclared": the checker
 * walked the whole dotted path and resolved every segment, then objected that an
 * intermediate one is optional.
 *
 * Optionality is frequently the CORRECT declaration, not a gap —
 * `frappe.views.ListView` really is absent until the list bundle lazy-loads
 * (`frappe/public/js/frappe/views/list/list_factory.js`), which is why consumers
 * write `frappe.views && frappe.views.ListView && …` before touching it. The
 * bare `void (frappe.views.ListView.prototype)` this probe emits deliberately
 * omits that guard, so it trips a diagnostic that the app's real, guarded call
 * site never sees.
 *
 * Counting these as "undeclared" would report a coverage hole that does not
 * exist and — worse — invite someone to "fix" it by making a lazily-loaded
 * namespace member non-optional, which is a lie about the runtime. They are
 * counted as covered and surfaced separately as `guarded`.
 */
const NULLABLE_CODES = new Set([
	18047, // 'x' is possibly 'null'
	18048, // 'x' is possibly 'undefined'
	18049, // 'x' is possibly 'null' or 'undefined'
	2531, // Object is possibly 'null'
	2532, // Object is possibly 'undefined'
	2533, // Object is possibly 'null' or 'undefined'
]);

/**
 * @param {string[]} paths dotted API paths, e.g. ["frappe.call", "frappe.ui.form.Grid"]
 * @returns {Promise<{covered: string[], guarded: {path: string, code: number, message: string}[], missing: {path: string, code: number, message: string}[]}>}
 */
export async function probePaths(paths) {
	if (!paths.length) return { covered: [], guarded: [], missing: [] };

	await mkdir(PROBE_DIR, { recursive: true });

	// One statement per line. `void (expr)` reads the path without calling it and
	// without caring about its type, so the ONLY thing that can fail is resolution.
	const header = "// AUTO-GENERATED probe — see scripts/lib/probe.mjs. Safe to delete.\nexport {};\n";
	const headerLines = header.split("\n").length - 1;
	const body = paths.map((p) => `void (${p});`).join("\n");
	await writeFile(path.join(PROBE_DIR, "probe.ts"), header + body + "\n");

	await writeFile(
		path.join(PROBE_DIR, "tsconfig.json"),
		JSON.stringify(
			{
				extends: "../tsconfig.json",
				compilerOptions: { noUnusedLocals: false, noUnusedParameters: false },
				include: ["../src/**/*.d.ts", "probe.ts"],
			},
			null,
			2,
		),
	);

	let stdout = "";
	try {
		const res = await execFileAsync(
			process.execPath,
			[path.join(ROOT, "node_modules", "typescript", "lib", "tsc.js"), "--noEmit", "--pretty", "false", "-p", PROBE_DIR],
			{ cwd: ROOT, maxBuffer: 64 * 1024 * 1024 },
		);
		stdout = res.stdout;
	} catch (err) {
		// tsc exits non-zero when it reports diagnostics — that is the normal path.
		stdout = (err.stdout ?? "") + (err.stderr ?? "");
	}

	const failures = new Map();
	const nullable = new Map();
	const line_re = /^(?:.*[/\\])?probe\.ts\((\d+),\d+\): error TS(\d+): (.*)$/;
	for (const line of stdout.split("\n")) {
		const m = line_re.exec(line.trim());
		if (!m) continue;
		const code = Number(m[2]);
		if (IGNORABLE_CODES.has(code)) continue;
		const idx = Number(m[1]) - 1 - headerLines;
		if (idx < 0 || idx >= paths.length) continue;
		const bucket = NULLABLE_CODES.has(code) ? nullable : failures;
		if (!bucket.has(paths[idx])) bucket.set(paths[idx], { path: paths[idx], code, message: m[3] });
	}
	// A path that failed for BOTH reasons on different probe lines is genuinely
	// missing; "undeclared" outranks "needs a guard".
	for (const p of failures.keys()) nullable.delete(p);

	// Diagnostics NOT anchored to probe.ts mean the declarations themselves are
	// broken. Surfacing them as "everything is missing" would be a lie, so raise.
	const foreign = stdout
		.split("\n")
		.filter((l) => /error TS/.test(l) && !/probe\.ts\(/.test(l))
		.filter((l) => !/^\s*$/.test(l));
	if (foreign.length) {
		throw new Error(
			`The declarations under src/ do not type-check on their own; fix these before trusting coverage:\n${foreign.join("\n")}`,
		);
	}

	await rm(PROBE_DIR, { recursive: true, force: true });

	return {
		covered: paths.filter((p) => !failures.has(p)),
		guarded: [...nullable.values()],
		missing: [...failures.values()],
	};
}

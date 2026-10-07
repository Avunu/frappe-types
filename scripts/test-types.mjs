#!/usr/bin/env node
// Type tests: checks each project under test/types/ against the package AS IT
// WOULD BE PUBLISHED.
//
// The obvious setup — a tsconfig under test/ that points `types` at ../src —
// would test the declarations and nothing else. The presets are reached
// through the `exports` map (`frappe-types/tsconfig/desk-js.json`), the web
// entry through another export, and all of it only exists for a consumer if
// `files` ships it. So this script asks npm which files a pack would contain
// (`npm pack --dry-run --json`, which runs no scripts and writes nothing),
// copies exactly those into a scratch `node_modules/frappe-types`, and runs
// `tsc -p` on each fixture project from there. A preset left out of `files`,
// or an export that points nowhere, fails here the way it would for a user.
//
// `@types/jquery` (and its `@types/sizzle`) are this package's dependencies;
// the scratch tree links the repo's own `node_modules/@types` so they resolve
// the way an install would place them. Nothing is fetched.
//
// A project with a `gen-doctypes.json` first runs the PACKED `frappe-types` command —
// the `bin` entry of the copied package.json, from the copied files — to write its
// doctypes file (one run per entry, when the file holds an array), so the generator
// is tested as a consumer runs it: shipped by `files`, started through `bin`, and its
// output compiled against `frappe-types` resolved through `node_modules` and the
// `exports` map, with no path alias.
//
// Every project must exit 0. Negative cases live inside the fixtures as
// `// @ts-expect-error`, which tsc reports when the expected error does not
// occur — so this one exit code covers both directions.
//
// Each project runs under EVERY compiler in `COMPILERS`: the repo's own
// TypeScript, and the oldest release the README promises to support (5.8, the
// `erasableSyntaxOnly` floor of the presets), installed as the aliased
// devDependency `typescript-5.8` so it resolves offline from package-lock.json
// like everything else. The two disagree in ways that matter to consumers —
// TypeScript 5.x measures generic variance differently from 7 — so a fixture
// that only passes on one of them is a failure.
//
//   node scripts/test-types.mjs            # every project
//   node scripts/test-types.mjs desk-js    # just the named ones
//   node scripts/test-types.mjs --keep     # leave the scratch tree for inspection
//   node scripts/test-types.mjs --tsc=5.8  # just one compiler (by COMPILERS key)

import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const FIXTURES = path.join(ROOT, "test", "types");
/** Every compiler the fixtures must pass under, keyed by a short label. */
const COMPILERS = {
	current: path.join(ROOT, "node_modules", "typescript", "bin", "tsc"),
	"5.8": path.join(ROOT, "node_modules", "typescript-5.8", "bin", "tsc"),
};

const args = process.argv.slice(2);
const keep = args.includes("--keep");
const only = args.filter((a) => !a.startsWith("--"));
const tscFlag = args.find((a) => a.startsWith("--tsc="))?.slice("--tsc=".length);
if (tscFlag !== undefined && !(tscFlag in COMPILERS)) {
	console.error(`unknown --tsc=${tscFlag}; expected one of ${Object.keys(COMPILERS).join(", ")}`);
	process.exit(2);
}
const compilers = Object.entries(COMPILERS).filter(([label]) => tscFlag === undefined || label === tscFlag);
for (const [label, tsc] of compilers) {
	if (!existsSync(tsc)) {
		console.error(`compiler "${label}" is not installed at ${tsc}; run npm ci`);
		process.exit(2);
	}
}

const projects = readdirSync(FIXTURES, { withFileTypes: true })
	.filter((d) => d.isDirectory() && existsSync(path.join(FIXTURES, d.name, "tsconfig.json")))
	.map((d) => d.name)
	.filter((name) => only.length === 0 || only.includes(name))
	.sort();

if (projects.length === 0) {
	console.error(`no fixture projects matched ${only.join(", ") || "(all)"} under ${FIXTURES}`);
	process.exit(2);
}

/** The file list `npm publish` would ship, relative to the package root. */
function packedFiles() {
	const scratchCache = mkdtempSync(path.join(os.tmpdir(), "frappe-types-npm-cache-"));
	try {
		const out = execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
			cwd: ROOT,
			encoding: "utf8",
			// A sandboxed build has no writable HOME; npm still wants a cache dir.
			env: { ...process.env, npm_config_cache: scratchCache },
			stdio: ["ignore", "pipe", "inherit"],
		});
		const [pack] = JSON.parse(out);
		return pack.files.map((f) => f.path);
	} finally {
		rmSync(scratchCache, { recursive: true, force: true });
	}
}

const scratch = mkdtempSync(path.join(os.tmpdir(), "frappe-types-typetest-"));
let failed = 0;
try {
	const nodeModules = path.join(scratch, "node_modules");
	const pkgDir = path.join(nodeModules, "frappe-types");
	const files = packedFiles();
	for (const rel of files) {
		const dest = path.join(pkgDir, rel);
		mkdirSync(path.dirname(dest), { recursive: true });
		cpSync(path.join(ROOT, rel), dest);
	}
	for (const required of ["tsconfig/base.json", "tsconfig/desk-js.json", "src/web.d.ts", "bin/frappe-types.mjs", "bin/gen-doctypes.mjs"]) {
		if (!files.includes(required)) {
			console.error(`npm pack would not ship ${required}; check "files" in package.json`);
			failed++;
		}
	}
	symlinkSync(path.join(ROOT, "node_modules", "@types"), path.join(nodeModules, "@types"), "dir");

	for (const name of projects) {
		const dir = path.join(scratch, name);
		cpSync(path.join(FIXTURES, name), dir, { recursive: true });
		const gen = path.join(dir, "gen-doctypes.json");
		if (existsSync(gen)) {
			// One run, or an array of runs (several generated files in one program).
			const parsed = JSON.parse(readFileSync(gen, "utf8"));
			const bin = JSON.parse(readFileSync(path.join(pkgDir, "package.json"), "utf8")).bin?.["frappe-types"];
			let ran = true;
			for (const spec of Array.isArray(parsed) ? parsed : [parsed]) {
				const res = typeof bin === "string" && existsSync(path.join(pkgDir, bin))
					? spawnSync(
							process.execPath,
							[path.join(pkgDir, bin), "gen-doctypes", "--bench", path.resolve(ROOT, spec.bench), "--app", spec.app, "--out", path.join(dir, spec.out), "--quiet"],
							{ cwd: dir, encoding: "utf8" },
						)
					: null;
				if (!res || res.status !== 0) {
					console.log(`FAIL ${name}: the packed \`frappe-types gen-doctypes\` did not run (--app ${spec.app})`);
					console.log(`${res ? `${res.stdout}${res.stderr}` : `package.json bin "frappe-types" is ${JSON.stringify(bin)}, which the pack does not ship`}`.trim().replace(/^/gm, "     "));
					ran = false;
					break;
				}
			}
			if (!ran) {
				failed++;
				continue;
			}
		}
		for (const [label, tsc] of compilers) {
			const version = execFileSync(process.execPath, [tsc, "-v"], { encoding: "utf8" }).trim().replace(/^Version /, "");
			const res = spawnSync(process.execPath, [tsc, "-p", path.join(dir, "tsconfig.json"), "--pretty", "false"], {
				cwd: dir,
				encoding: "utf8",
			});
			const output = `${res.stdout ?? ""}${res.stderr ?? ""}`.trim();
			const tag = `${name} (tsc ${version})`;
			if (res.status === 0) {
				console.log(`ok   ${tag}`);
			} else {
				failed++;
				console.log(`FAIL ${tag}`);
				// Paths in the scratch tree read better relative to the fixture source.
				console.log(output.split(dir + path.sep).join(`test/types/${name}/`).replace(/^/gm, "     "));
			}
		}
	}
} finally {
	if (keep) console.log(`scratch tree kept at ${scratch}`);
	else rmSync(scratch, { recursive: true, force: true });
}

if (failed) {
	console.error(`\n${failed} type test run(s) failed`);
	process.exit(1);
}
console.log(
	`\n${projects.length} type test project(s) passed under ${compilers.length} compiler(s) against the packed file list`
);

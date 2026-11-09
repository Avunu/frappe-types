#!/usr/bin/env node
// Writes lint/desk-globals.json and lint/web-globals.json from the ambient
// entries' declarations. See scripts/lib/lint-globals.mjs.
//
//   node scripts/gen-lint-globals.mjs           (also: npm run gen:lint-globals)
//   node scripts/gen-lint-globals.mjs --check   exit 1 if a file is stale

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LINT_GLOBALS_FILES, entryGlobals, lintGlobalsJson } from "./lib/lint-globals.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
let stale = 0;

for (const { entry, out } of LINT_GLOBALS_FILES) {
	const want = lintGlobalsJson(await entryGlobals(root, entry));
	const file = path.join(root, out);
	const have = await readFile(file, "utf8").catch(() => "");
	if (have === want) continue;
	if (check) {
		console.error(`${out} is stale: run npm run gen:lint-globals`);
		stale++;
		continue;
	}
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, want);
	console.log(`wrote ${out}`);
}

if (stale) process.exit(1);

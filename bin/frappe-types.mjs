#!/usr/bin/env node
// The `frappe-types` command. One subcommand today:
//
//   frappe-types gen-doctypes --bench <bench> --app <app> [...]   see bin/gen-doctypes.mjs
//
// Plain ESM JavaScript with no dependencies, so `npx frappe-types` runs from an installed
// package with nothing but node (see the header of gen-doctypes.mjs for why not .ts).

import { readFileSync } from "node:fs";

const USAGE = `usage: frappe-types <command> [options]

commands:
  gen-doctypes   TypeScript interfaces for an app's DocTypes (frappe-types gen-doctypes --help)

  --version      print the package version`;

/** @type {{ stdout: (s: string) => void, stderr: (s: string) => void }} */
const io = {
	stdout: (s) => void process.stdout.write(s),
	stderr: (s) => void process.stderr.write(s),
};

const [command, ...rest] = process.argv.slice(2);
if (command === "gen-doctypes") {
	const { main } = await import("./gen-doctypes.mjs");
	process.exitCode = await main(rest, io);
} else if (command === "--version" || command === "-v") {
	/** @type {{ version: string }} */
	const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
	io.stdout(`${pkg.version}\n`);
} else if (command === undefined || command === "--help" || command === "-h" || command === "help") {
	io.stdout(`${USAGE}\n`);
} else {
	io.stderr(`unknown command "${command}"\n${USAGE}\n`);
	process.exitCode = 2;
}

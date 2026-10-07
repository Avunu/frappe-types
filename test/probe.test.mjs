// Unit tests for scripts/lib/probe.mjs, the type-checker probe behind
// scripts/audit-consumer.mjs and scripts/audit-coverage.mjs.
//
//   npm run test:unit        (= node --test "test/*.test.mjs")
//
// Each probePaths call runs tsc over src/, so the cases are batched: one call
// sorts a path of each kind into its bucket, and one more adds an app's type
// files from outside the checkout, the way `audit-consumer --types` does.
//
// The app type files are written to a temporary directory rather than kept
// under test/: the root tsconfig includes test/**/*.ts, and an augmentation of
// "frappe-types" there would leak into `npm run check`.

import assert from "node:assert/strict";
import { cp, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { probePaths } from "../scripts/lib/probe.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

test("probePaths: sorts typed, untyped, optional and undeclared paths", async () => {
	const typed = "frappe.call";
	// FrappeBoot ends in `[key: string]: unknown`, so an unknown key resolves to unknown.
	const untyped = "frappe.boot.some_unknown_key";
	// frappe.views.FileView is optional, so reading through it needs a guard.
	const optional = "frappe.views.FileView.grid_view";
	const undeclared = "frappe.no_such_member_anywhere";

	const res = await probePaths([typed, untyped, optional, undeclared], { untyped: true });

	assert.deepEqual(res.covered.sort(), [optional, typed, untyped].sort());
	assert.deepEqual(
		res.missing.map((m) => m.path),
		[undeclared],
	);
	assert.deepEqual(
		res.guarded.map((g) => g.path),
		[optional],
	);
	// The untyped block is line-mapped separately from the first one; a typed
	// path and an optional-but-typed one must not land in it.
	assert.deepEqual(res.untyped, [untyped]);
});

test("probePaths: without { untyped }, nothing is reported untyped", async () => {
	const res = await probePaths(["frappe.boot.some_unknown_key", "frappe.call"]);
	assert.deepEqual(res.untyped, []);
	assert.deepEqual(res.missing, []);
});

test("probePaths: an app's type files resolve frappe-types to this checkout", async (t) => {
	const app = await mkdtemp(path.join(os.tmpdir(), "ft-probe-app-"));
	t.after(() => rm(app, { recursive: true, force: true }));

	// The usual setup: the app has its own copy of frappe-types installed (a
	// copy, not a link, so tsc cannot realpath it back to src/). Neither the
	// import nor the reference below may reach it, or the declarations load
	// twice and every one is a duplicate.
	const installed = path.join(app, "node_modules", "frappe-types");
	await mkdir(installed, { recursive: true });
	await cp(path.join(ROOT, "src"), path.join(installed, "src"), { recursive: true });
	await cp(path.join(ROOT, "package.json"), path.join(installed, "package.json"));

	const imported = path.join(app, "imported.d.ts");
	await writeFile(
		imported,
		[
			`import type { BaseControl } from "frappe-types";`,
			`declare module "frappe-types" {`,
			`	interface FrappeUiFormNamespace {`,
			`		ProbeTestControl: typeof BaseControl;`,
			`	}`,
			`}`,
			``,
		].join("\n"),
	);
	const referenced = path.join(app, "referenced.d.ts");
	await writeFile(
		referenced,
		[
			`/// <reference types="frappe-types/global" />`,
			`import type {} from "frappe-types/global";`,
			`declare module "frappe-types" {`,
			`	interface Frappe {`,
			`		probe_test_context?: { token: string };`,
			`	}`,
			`}`,
			``,
		].join("\n"),
	);

	const paths = ["frappe.ui.form.ProbeTestControl", "frappe.probe_test_context", "frappe.ui.form.NotDeclaredByTheApp"];
	const res = await probePaths(paths, { untyped: true, extraTypes: [imported, referenced] });

	assert.deepEqual(res.covered.sort(), ["frappe.probe_test_context", "frappe.ui.form.ProbeTestControl"]);
	assert.deepEqual(
		res.missing.map((m) => m.path),
		["frappe.ui.form.NotDeclaredByTheApp"],
	);
	assert.deepEqual(res.untyped, []);
});

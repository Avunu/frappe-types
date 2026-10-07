// Unit tests for bin/gen-doctypes.mjs (`frappe-types gen-doctypes`).
//
// Three layers:
//   - the fixture bench in test/fixtures/gen-doctypes/apps against a golden file
//     (regenerate with `UPDATE_GOLDEN=1 npm run test:unit` and review the diff);
//   - the golden file compiled with tsc under the options consumers use, together with
//     consumer code whose `@ts-expect-error`s assert what must NOT compile;
//   - the generator's fieldtype rules against a frappe source tree — the pinned one in
//     `nix flake check`, where FRAPPE_PATH is set — so a frappe release that adds or
//     reclassifies a fieldtype fails here instead of being typed wrong.
// The last layer skips itself when no frappe checkout of this branch's major is found.

import assert from "node:assert/strict";
import { execFile, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";
import { promisify } from "node:util";
import { FIELDTYPES, fieldType, generate, interfaceName, ruleOf, scrub, selectUnion } from "../bin/gen-doctypes.mjs";
import { resolveFrappe } from "../scripts/lib/resolve-frappe.mjs";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, "..");
const FIXTURES = path.join(ROOT, "test", "fixtures", "gen-doctypes");
const APPS = path.join(FIXTURES, "apps");
const GOLDEN = path.join(FIXTURES, "expected", "my_app.d.ts");
const CLI = path.join(ROOT, "bin", "frappe-types.mjs");
const TSC = path.join(ROOT, "node_modules", "typescript", "bin", "tsc");

/** The compiler options a consumer extends (strict, and nothing skipped). */
const CONSUMER_OPTIONS = {
	target: "ES2022",
	lib: ["ES2022", "DOM"],
	module: "ESNext",
	moduleResolution: "Bundler",
	noEmit: true,
	strict: true,
	noUncheckedIndexedAccess: true,
	exactOptionalPropertyTypes: true,
	verbatimModuleSyntax: true,
	erasableSyntaxOnly: true,
	skipLibCheck: false,
	types: [],
	paths: { "frappe-types": [path.join(ROOT, "src", "index.d.ts")] },
};

/**
 * Compile `files` in a throwaway project; resolve with tsc's diagnostics ("" when clean).
 * @param {string[]} files absolute paths
 * @param {Record<string, unknown>} [extra] more compiler options
 */
async function tsc(files, extra = {}) {
	const dir = mkdtempSync(path.join(tmpdir(), "ft-gen-tsc-"));
	try {
		writeFileSync(path.join(dir, "tsconfig.json"), JSON.stringify({ compilerOptions: { ...CONSUMER_OPTIONS, ...extra }, files }));
		try {
			await execFileAsync(process.execPath, [TSC, "-p", dir, "--pretty", "false"], { maxBuffer: 64 * 1024 * 1024 });
			return "";
		} catch (error) {
			const e = /** @type {{ stdout?: string, stderr?: string }} */ (error);
			return `${e.stdout ?? ""}${e.stderr ?? ""}`.trim() || String(error);
		}
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

/** @param {string[]} args */
function cli(args) {
	return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
}

describe("fixture bench", () => {
	const result = generate({ appsDir: APPS, app: "my_app" });

	test("matches the golden file", () => {
		if (process.env.UPDATE_GOLDEN === "1") writeFileSync(GOLDEN, result.text);
		assert.equal(result.text, readFileSync(GOLDEN, "utf8"), "output changed; if intended, re-run with UPDATE_GOLDEN=1 and review the diff");
	});

	test("is deterministic", () => {
		assert.equal(generate({ appsDir: APPS, app: "my_app" }).text, result.text);
	});

	test("emits the app's DocTypes and only what they reference or customise", () => {
		const registered = [...result.text.matchAll(/^\t\t("[^"]+"): /gm)].map((m) => JSON.parse(m[1] ?? '""'));
		assert.deepEqual(registered, [
			"Delivery Run", // my_app
			"Delivery Stop", // my_app, istable
			"Payment Terminal", // customised by a fixture, defined nowhere
			"Sales Order", // customised by my_app/custom/sales_order.json
			"Sales Order Item", // a child table of Delivery Run and of Sales Order
			"Sales Order Tag", // a Table MultiSelect child of Sales Order
			"Selling Settings", // customised by fixtures/custom_field.json
		]);
		// other_app is on the bench, but neither requested nor referenced — and its
		// customisations are not installed on the site this app runs on.
		assert.doesNotMatch(result.text, /Unrelated|custom_from_other_app/);
		// a module folder modules.txt does not list is never synced by frappe
		assert.doesNotMatch(result.text, /Ghost/);
	});

	test("reports what it had to type loosely", () => {
		assert.deepEqual(result.warnings, [
			'my_app/my_app/fixtures/custom_field.json: Custom Field custom_terminal_id targets DocType "Payment Terminal", which no app on this bench defines',
			'my_app/my_app/my_app/doctype/delivery_stop/delivery_stop.json: Delivery Stop.parcels is a table of "Parcel Line", which no app on this bench defines; typed $ft.ChildDoc[]',
			'my_app/my_app/my_app/doctype/delivery_run/delivery_run.json: unknown fieldtype "Fancy Widget" for widget; typed unknown',
		]);
	});

	test("--include-siblings types a sibling app in full", () => {
		const both = generate({ appsDir: APPS, app: "my_app", siblings: ["base_app"] });
		assert.match(both.text, /"Sales Order": SalesOrder;/);
		// Pulled in as a sibling, not "because" of anything.
		assert.doesNotMatch(both.text, /Included because it is customised by my_app\/my_app\/my_app\/custom\/sales_order\.json/);
		assert.doesNotMatch(both.text, /Ghost|Unrelated/);
		// Customisations still apply.
		assert.match(both.text, /custom_priority\?: "Low" \| "High" \| "" \| null;/);
	});

	test("an app that is not on the bench is an error", () => {
		assert.throws(() => generate({ appsDir: APPS, app: "nope" }), /no app "nope"/);
	});

	test("the golden file compiles under strict consumer options, and rejects what it should", async () => {
		const diagnostics = await tsc([GOLDEN, path.join(FIXTURES, "consumer", "usage.ts")]);
		assert.equal(diagnostics, "");
	});

	test("the registry is reachable from JSDoc in checked desk JS", async () => {
		const diagnostics = await tsc([GOLDEN, path.join(FIXTURES, "consumer", "desk.js")], { allowJs: true, checkJs: true });
		assert.equal(diagnostics, "");
	});
});

describe("field typing", () => {
	/** @type {string[]} */
	const warnings = [];
	/** @param {Partial<import("../bin/gen-doctypes.mjs").FieldSpec>} f */
	const type = (f) =>
		fieldType({ fieldname: "f", fieldtype: "Data", options: undefined, label: undefined, notNullable: false, customFrom: null, ...f }, (c) => interfaceName(c), warnings, "test");

	test("no-value fieldtypes are not emitted", () => {
		for (const ft of ["Section Break", "Column Break", "Tab Break", "HTML", "Button", "Image", "Fold", "Heading", "Attachment Gallery"]) {
			assert.equal(type({ fieldtype: ft }), null, ft);
		}
	});

	test("tables are required arrays of the child interface", () => {
		assert.deepEqual(type({ fieldtype: "Table", options: "Sales Invoice Item" }), { type: "SalesInvoiceItem[]", optional: false });
		assert.deepEqual(type({ fieldtype: "Table MultiSelect", options: "Has Role" }), { type: "HasRole[]", optional: false });
	});

	test("NOT NULL columns drop null, the rest keep it", () => {
		assert.deepEqual(type({ fieldtype: "Check" }), { type: "0 | 1", optional: true });
		assert.deepEqual(type({ fieldtype: "Int" }), { type: "number", optional: true });
		assert.deepEqual(type({ fieldtype: "Long Int" }), { type: "number | null", optional: true });
		assert.deepEqual(type({ fieldtype: "Rating" }), { type: "number | null", optional: true });
		assert.deepEqual(type({ fieldtype: "Data" }), { type: "string | null", optional: true });
		assert.deepEqual(type({ fieldtype: "Data", notNullable: true }), { type: "string", optional: true });
		assert.deepEqual(type({ fieldtype: "JSON" }), { type: "unknown", optional: true });
	});

	test("Select: option literals, naming_series and option-less Selects are strings", () => {
		assert.equal(selectUnion("\nOpen\n Closed \nOpen"), '"Open" | "Closed" | ""');
		assert.equal(type({ fieldtype: "Select", options: "A\nB" })?.type, '"A" | "B" | "" | null');
		assert.equal(type({ fieldtype: "Select", options: 'say "hi"\nback\\slash' })?.type, '"say \\"hi\\"" | "back\\\\slash" | "" | null');
		assert.equal(type({ fieldtype: "Select", fieldname: "naming_series", options: "SO-.###" })?.type, "string | null");
		assert.equal(type({ fieldtype: "Select", options: "" })?.type, "string | null");
	});

	test("fieldtype lookups do not see Object.prototype", () => {
		assert.equal(ruleOf("constructor"), undefined);
		assert.equal(ruleOf("toString"), undefined);
	});

	test("interface names follow frappe's controller class names", () => {
		assert.equal(interfaceName("Sales Invoice Item"), "SalesInvoiceItem");
		assert.equal(interfaceName("Bank-Statement Import"), "BankStatementImport");
		assert.equal(interfaceName("ToDo"), "ToDo");
		assert.equal(interfaceName("9 Lives"), "_9Lives");
		assert.equal(interfaceName("A & B"), "A_B");
		assert.equal(interfaceName("package"), "package_");
		assert.equal(scrub("Sales Order-Item"), "sales_order_item");
	});
});

describe("CLI", () => {
	test("writes to stdout without --out", () => {
		const r = cli(["gen-doctypes", "--bench", APPS, "--app", "my_app", "--quiet"]);
		assert.equal(r.status, 0, r.stderr);
		assert.equal(r.stdout, readFileSync(GOLDEN, "utf8"));
		assert.equal(r.stderr, "");
	});

	test("--bench accepts a bench root as well as an apps directory", () => {
		const bench = mkdtempSync(path.join(tmpdir(), "ft-gen-bench-"));
		try {
			symlinkSync(APPS, path.join(bench, "apps"), "dir");
			const r = cli(["gen-doctypes", "--bench", bench, "--app", "my_app", "--quiet"]);
			assert.equal(r.status, 0, r.stderr);
			assert.equal(r.stdout, readFileSync(GOLDEN, "utf8"));
		} finally {
			rmSync(bench, { recursive: true, force: true });
		}
	});

	test("--out writes, --check compares, --strict fails on warnings", () => {
		const dir = mkdtempSync(path.join(tmpdir(), "ft-gen-out-"));
		const out = path.join(dir, "types", "doctypes.d.ts");
		try {
			let r = cli(["gen-doctypes", "--bench", APPS, "--app", "my_app", "--check", "--out", out]);
			assert.equal(r.status, 1, "a missing file is out of date");
			assert.match(r.stderr, /is missing/);

			r = cli(["gen-doctypes", "--bench", APPS, "--app", "my_app", "--out", out]);
			assert.equal(r.status, 0, r.stderr);
			assert.equal(readFileSync(out, "utf8"), readFileSync(GOLDEN, "utf8"));
			assert.match(r.stderr, /warning: .*Fancy Widget/);
			assert.match(r.stderr, /wrote .* \(7 DocTypes\)/);

			r = cli(["gen-doctypes", "--bench", APPS, "--app", "my_app", "--check", "--out", out, "--quiet"]);
			assert.equal(r.status, 0, r.stderr);

			writeFileSync(out, "// stale\n");
			r = cli(["gen-doctypes", "--bench", APPS, "--app", "my_app", "--check", "--out", out, "--quiet"]);
			assert.equal(r.status, 1);
			assert.match(r.stderr, /out of date/);

			r = cli(["gen-doctypes", "--bench", APPS, "--app", "my_app", "--out", out, "--strict"]);
			assert.equal(r.status, 1);
			assert.match(r.stderr, /--strict: 3 warning\(s\)/);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	test("usage errors exit 2", () => {
		assert.equal(cli(["gen-doctypes", "--app", "my_app"]).status, 2);
		assert.equal(cli(["gen-doctypes", "--bench", APPS, "--app", "my_app", "--bogus"]).status, 2);
		assert.equal(cli(["gen-doctypes", "--bench", APPS, "--app", "my_app", "--check"]).status, 2);
		assert.equal(cli(["gen-doctypes", "--bench", APPS, "--app", "nope"]).status, 2);
		assert.equal(cli(["no-such-command"]).status, 2);
	});

	test("--help and --version", () => {
		assert.match(cli(["--help"]).stdout, /gen-doctypes/);
		assert.match(cli(["gen-doctypes", "--help"]).stdout, /--include-siblings/);
		const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
		assert.equal(cli(["--version"]).stdout.trim(), pkg.version);
	});
});

// ------------------------------------------------------------------ against frappe itself

/** @returns {{ path: string } | { skip: string }} */
function frappeOfThisMajor() {
	const found = resolveFrappe(undefined);
	if (!found) return { skip: "no frappe checkout (set FRAPPE_PATH; nix flake check does)" };
	const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
	const init = readFileSync(path.join(found, "frappe", "__init__.py"), "utf8");
	const version = /^__version__ = "([^"]+)"/m.exec(init)?.[1] ?? "";
	if (version.split(".")[0] !== pkg.frappe.major) return { skip: `${found} is frappe ${version}, not ${pkg.frappe.major}.x` };
	return { path: found };
}

/**
 * The string members of a Python tuple assignment, e.g. `data_fieldtypes = ( "Currency", ... )`.
 * @param {string} source
 * @param {string} name
 */
function pythonTuple(source, name) {
	const body = new RegExp(`^${name} = \\(([\\s\\S]*?)\\)`, "m").exec(source)?.[1];
	assert.ok(body !== undefined, `${name} not found`);
	return [...body.matchAll(/"([^"]+)"/g)].map((m) => m[1] ?? "");
}

const frappe = frappeOfThisMajor();

describe("against frappe", { skip: "skip" in frappe ? frappe.skip : false }, () => {
	const root = "path" in frappe ? frappe.path : "";
	/** @param {string} rel */
	const read = (rel) => readFileSync(path.join(root, rel), "utf8");

	test("classification agrees with frappe", () => {
		const model = read("frappe/model/__init__.py");
		const data = pythonTuple(model, "data_fieldtypes");
		const noValue = pythonTuple(model, "no_value_fields");
		const tables = pythonTuple(model, "table_fields");
		const notNull = pythonTuple(read("frappe/database/schema.py"), "NOT_NULL_TYPES");

		// Every fieldtype frappe knows, and no other.
		assert.deepEqual(Object.keys(FIELDTYPES).sort(), [...new Set([...data, ...noValue, ...tables])].sort());
		// Including every option DocField offers in its fieldtype Select.
		const docfield = JSON.parse(read("frappe/core/doctype/docfield/docfield.json"));
		const offered = String(docfield.fields.find((/** @type {{ fieldname: string }} */ f) => f.fieldname === "fieldtype").options).split("\n");
		for (const ft of offered) assert.ok(ruleOf(ft), `DocField offers "${ft}", which the generator does not know`);

		for (const [ft, rule] of Object.entries(FIELDTYPES)) {
			if (tables.includes(ft)) assert.equal(rule.kind, "table", ft);
			else if (noValue.includes(ft)) assert.equal(rule.kind, "none", ft);
			else assert.equal(rule.kind, "value", ft);
			if (rule.kind === "value") assert.equal(rule.notNull, notNull.includes(ft), `${ft}: NOT_NULL_TYPES`);
		}
	});

	test("value types agree with the MariaDB column types", () => {
		const db = read("frappe/database/mariadb/database.py");
		const map = /self\.type_map = \{([\s\S]*?)\n\t\t\}/.exec(db)?.[1];
		assert.ok(map, "type_map not found in frappe/database/mariadb/database.py");
		/** @type {Record<string, string>} */
		const column = {};
		for (const m of map.matchAll(/"([^"]+)": \("(\w+)"/g)) column[m[1] ?? ""] = m[2] ?? "";
		for (const [ft, rule] of Object.entries(FIELDTYPES)) {
			if (rule.kind !== "value") continue;
			const col = column[ft];
			assert.ok(col, `${ft} has no column type`);
			const expected = col === "tinyint" ? "0 | 1" : ["int", "bigint", "decimal"].includes(col) ? "number" : col === "json" ? "unknown" : "string";
			assert.equal(rule.ts, expected, `${ft} is a ${col} column`);
		}
	});

	test("frappe's own DocTypes generate cleanly and compile under strict consumer options", async () => {
		const dir = mkdtempSync(path.join(tmpdir(), "ft-gen-frappe-"));
		try {
			symlinkSync(root, path.join(dir, "frappe"), "dir");
			const result = generate({ appsDir: dir, app: "frappe" });
			assert.deepEqual(result.warnings, []);
			assert.ok(result.doctypes > 250, `only ${result.doctypes} DocTypes found`);
			assert.match(result.text, /"ToDo": ToDo;/);
			assert.match(result.text, /status\?: "Open" \| "Closed" \| "Cancelled" \| "" \| null;/);
			const out = path.join(dir, "doctypes.d.ts");
			writeFileSync(out, result.text);
			assert.equal(await tsc([out]), "");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

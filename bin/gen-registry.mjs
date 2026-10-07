// `frappe-types gen-registry` — the global `FrappeDocTypes` registry for an app's DocTypes:
// one interface per DocType, read offline from the same JSON files `bench migrate` reads.
//
//   frappe-types gen-registry --bench <bench | apps dir> --app <app>
//                             [--include-siblings erpnext,hrms] [--out types/doctypes.d.ts]
//                             [--check] [--strict]
//
// This file ships in the package and runs under plain `node` from `node_modules`, so it is
// JavaScript with JSDoc types (checked by `tsconfig.bin.json`) rather than TypeScript:
// node refuses to strip types from anything under `node_modules`
// (ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING), which would make a `.ts` bin unrunnable
// exactly where it is installed. No runtime dependencies, for the same reason.
//
// WHAT IS READ — the files frappe itself syncs, found the way frappe finds them:
//
//   DocTypes     For each module in `<app>/modules.txt` (frappe/__init__.py:902-904, read
//                with blank lines and `#` lines dropped, :1087-1101), scrubbed to a folder
//                name (frappe/__init__.py:843-845, :1063-1064), every
//                `<module>/doctype/<dir>/<dir>.json` — the walk
//                frappe/model/sync.py:135-137 and :187-193 perform.
//   Customs      `<app>/<module>/custom/*.json`, the folder frappe/modules/utils.py:133-144
//                syncs: `custom_fields` (keyed by `dt`) and `property_setters`.
//                Plus records of doctype "Custom Field" / "Property Setter" in
//                `<app>/fixtures/*.json`, the folder frappe/utils/fixtures.py:32-43 imports.
//
// Customisations are read from the target app and the `--include-siblings` apps only —
// they are what the site that runs this app has installed. The DocTypes they customise,
// and any child DocType a `Table` field names, are looked up across every app in the
// bench when they are not among those, so `--app myapp` alone types `frm.doc.custom_x`
// on erpnext's Customer. Customisations made in the database (Customize Form) are not in
// any file and cannot be seen; a registered document is closed, so code that reads one
// has to add it (see the README, "Generating the registry").
//
// WHICH CUSTOMISATION WINS when two set the same thing: the one frappe syncs last. Apps
// are taken in install order — the `--include-siblings` apps as listed, then the target
// app, which depends on them — and within that, frappe's own sequence:
//   1. `custom/*.json` WITHOUT `sync_on_migrate`: synced only when its app is installed
//      (frappe/installer.py:381-382; frappe/modules/utils.py:125-145, :143-144);
//   2. `fixtures/*.json`: re-imported for every installed app on every migrate
//      (frappe/migrate.py:177-179; frappe/utils/fixtures.py:16-28, sorted by file name
//      at :37);
//   3. `custom/*.json` WITH `sync_on_migrate`: re-synced for every installed app after
//      the fixtures (frappe/migrate.py:187-188; frappe/modules/utils.py:141-142).
// A later Property Setter replaces an earlier one for the same DocType, field and
// property (frappe/custom/doctype/property_setter/property_setter.py:42-43), and a later
// Custom Field updates the earlier one with the same name
// (frappe/modules/utils.py:168-178).
//
// HOW A FIELD IS TYPED — every rule below is checked against the pinned frappe source by
// test/gen-registry.test.mjs ("against frappe"), so a frappe release that adds or
// reclassifies a fieldtype fails CI instead of silently typing it wrong.
//
//   no value     `no_value_fields` minus `table_fields` (frappe/model/__init__.py:53-65,
//                :101) have no column and no value; they are not emitted.
//   tables       `Table` / `Table MultiSelect` (:101) are `FrappeChildRow<Child>[]`, and
//                REQUIRED: the client initialises every table field to `[]` on a new doc
//                (frappe/public/js/frappe/model/create_new.js:227-229) and the server
//                does the same on load (frappe/model/base_document.py:588-601).
//   values       everything in `data_fieldtypes` (frappe/model/__init__.py:8-43), OPTIONAL
//                (`?:`): a doc created in the browser has only the fields that had a
//                default (create_new.js:82-116).
//   null         These types describe `frm.doc` in the browser as well as a row read
//                from the database, so a field drops `| null` only when NEITHER can hold
//                null. The database: a column is NOT NULL only for `NOT_NULL_TYPES`
//                (frappe/database/schema.py:182, :226-227) or a field with
//                `not_nullable` (:242-247). The browser: the numeric controls write null
//                into the doc when the input is cleared — ControlInt.parse is
//                `cint(..., null)` (frappe/public/js/frappe/form/controls/int.js:23-24,
//                Long Int is the same class at :28), ControlFloat.parse returns null for
//                NaN (form/controls/float.js:3-5), and Currency, Percent and Rating
//                extend ControlFloat without overriding it (currency.js:1, percent.js:1,
//                rating.js:1) — and frappe.model.set_value stores the value as is
//                (frappe/public/js/frappe/model/model.js:561) until the server
//                coerces it on save (frappe/model/base_document.py:551-561). So Int,
//                Long Int, Float, Currency, Percent and Rating keep `| null` although
//                most of their columns are NOT NULL. Check does not: its control always
//                runs `cint(value)` with no null default (form/controls/check.js:32-33).
//                This is stricter than frappe's own Python exporter
//                (frappe/types/exporter.py:175-184), which also drops `None` for `reqd`
//                fields and for Select/Rating/Long Int (:41-52). `reqd` is enforced on
//                save, not by the column, so rows that predate it — or were written with
//                `ignore_mandatory` — still read back NULL; Select, Rating and Long Int
//                columns are nullable (frappe/database/mariadb/database.py:178, :196-197).
//
//   Check                       0 | 1     tinyint (mariadb/database.py:181), coerced with
//                                         `1 if cint(value) else 0` (base_document.py:552)
//   Int Long Int Float Currency number    int/bigint/decimal (mariadb/database.py:176-180,
//   Percent Rating Duration               :197, :205); decimals arrive as float
//                                         (mariadb/database.py:165-166)
//   Select                      union     the options, split on "\n" and stripped as
//                                         frappe/types/exporter.py:201 does, plus "": an
//                                         empty value skips validation
//                                         (frappe/model/base_document.py:1106). `string`
//                                         for `naming_series` (also skipped there) and for
//                                         a Select with no options (exporter.py:198-200).
//                                         The union is what a SAVE accepts, not what the
//                                         column can hold: `_validate_selects` returns
//                                         early under `frappe.flags.in_import`
//                                         (base_document.py:1102-1103), which the Data
//                                         Import tool sets for every row
//                                         (frappe/core/doctype/data_import/importer.py:122),
//                                         `db_set` and `frappe.db.set_value` do not
//                                         validate at all, and rows saved before an
//                                         options change keep their old value. Kept as a
//                                         closed union anyway — it is what every value
//                                         the app writes must be — and documented as such.
//   JSON                        unknown   a string from MariaDB (mariadb/database.py:209),
//                                         a parsed value from Postgres, whose `json`
//                                         column (postgres/database.py:167) psycopg2 decodes
//   everything else             string    Data, Link, Date, Datetime, Time, Text, ... —
//                                         varchar/text/date columns, all strings on the wire
//
// WHAT IS EMITTED: one module, written against the `FrappeDocTypes` registry contract
// (src/registry.d.ts). Each DocType is an interface in the GLOBAL namespace
// `FrappeDocTypeFields`, named the way frappe names its controller class — spaces and
// hyphens removed (frappe/model/base_document.py:113) — that lists the DocType's DATA
// fields and nothing else: no index signature and no standard fields, which `DocOf` /
// `RegisteredDoc` (src/model.d.ts) add, so a registered document is closed and a
// misspelt fieldname is a compile error. A child DocType's interface declares
// `parenttype` as the literal names of every DocType on the bench with a Table of it,
// which is how `FormEvents<"Child">` finds the parent form. A
// `declare global { interface FrappeDocTypes { ... } }` block registers each one under
// its DocType name, and the module re-exports each as a type alias of the same name.
//
// WHY A GLOBAL NAMESPACE: so that several generated files can share one program (an app
// that ships its file, and the app that uses it, say). Every file registers
// `"Customer": FrappeDocTypeFields.Customer` — the same type — so the registry entries do
// not conflict, and the interfaces themselves MERGE: each file's fields add up, and a
// field both files declare must be declared the same way. A field the files disagree on
// (a Property Setter one app applies and the other's generation did not see) is a
// TS2717/TS2687 on that field, which is a real disagreement about the site. Had the
// entries been module-local interfaces, any difference at all, one app's Custom Field,
// would have been a TS2717 on the whole DocType.
//
// Output is byte-for-byte deterministic: no timestamps, no absolute paths, everything
// sorted.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/* -------------------------------------------------------------------------- */
/* Fieldtype classification                                                    */
/* -------------------------------------------------------------------------- */

/**
 * How each frappe fieldtype is typed. The keys are the union of `data_fieldtypes`,
 * `no_value_fields` and `table_fields` (frappe/model/__init__.py:8-43, :53-65, :101) —
 * which also covers every option of DocField's `fieldtype` Select
 * (frappe/core/doctype/docfield/docfield.json). The test suite asserts that equality
 * against the pinned frappe tree.
 *
 * `notNull`: the column is NOT NULL (`NOT_NULL_TYPES`). `clientNull`: the desk control
 * writes `null` into `frm.doc` when its input is cleared (see "null" in the header).
 *
 * @typedef {{ kind: "none" } | { kind: "table" } | { kind: "value", ts: string, notNull: boolean, clientNull: boolean }} FieldtypeRule
 * @type {Readonly<Record<string, FieldtypeRule>>}
 */
export const FIELDTYPES = Object.freeze({
	// no_value_fields minus table_fields — frappe/model/__init__.py:53-65
	"Section Break": { kind: "none" },
	"Column Break": { kind: "none" },
	"Tab Break": { kind: "none" },
	"Attachment Gallery": { kind: "none" },
	HTML: { kind: "none" },
	Button: { kind: "none" },
	Image: { kind: "none" },
	Fold: { kind: "none" },
	Heading: { kind: "none" },

	// table_fields — frappe/model/__init__.py:101
	Table: { kind: "table" },
	"Table MultiSelect": { kind: "table" },

	// data_fieldtypes — frappe/model/__init__.py:8-43. `notNull` is NOT_NULL_TYPES,
	// frappe/database/schema.py:182. `clientNull` is ControlInt / ControlFloat's
	// null-returning parse (frappe/public/js/frappe/form/controls/int.js:23-24, :28,
	// float.js:3-5) and the controls that inherit it unchanged (currency.js:1,
	// percent.js:1, rating.js:1).
	Currency: { kind: "value", ts: "number", notNull: true, clientNull: true },
	Int: { kind: "value", ts: "number", notNull: true, clientNull: true },
	"Long Int": { kind: "value", ts: "number", notNull: false, clientNull: true },
	Float: { kind: "value", ts: "number", notNull: true, clientNull: true },
	Percent: { kind: "value", ts: "number", notNull: true, clientNull: true },
	Check: { kind: "value", ts: "0 | 1", notNull: true, clientNull: false },
	"Small Text": { kind: "value", ts: "string", notNull: false, clientNull: false },
	"Long Text": { kind: "value", ts: "string", notNull: false, clientNull: false },
	Code: { kind: "value", ts: "string", notNull: false, clientNull: false },
	"Text Editor": { kind: "value", ts: "string", notNull: false, clientNull: false },
	"Markdown Editor": { kind: "value", ts: "string", notNull: false, clientNull: false },
	"HTML Editor": { kind: "value", ts: "string", notNull: false, clientNull: false },
	Date: { kind: "value", ts: "string", notNull: false, clientNull: false },
	Datetime: { kind: "value", ts: "string", notNull: false, clientNull: false },
	Time: { kind: "value", ts: "string", notNull: false, clientNull: false },
	Text: { kind: "value", ts: "string", notNull: false, clientNull: false },
	Data: { kind: "value", ts: "string", notNull: false, clientNull: false },
	Link: { kind: "value", ts: "string", notNull: false, clientNull: false },
	"Dynamic Link": { kind: "value", ts: "string", notNull: false, clientNull: false },
	Password: { kind: "value", ts: "string", notNull: false, clientNull: false },
	// `ts` is the fallback; a Select with options is typed as their union.
	Select: { kind: "value", ts: "string", notNull: false, clientNull: false },
	Rating: { kind: "value", ts: "number", notNull: false, clientNull: true },
	"Read Only": { kind: "value", ts: "string", notNull: false, clientNull: false },
	Attach: { kind: "value", ts: "string", notNull: false, clientNull: false },
	"Attach Image": { kind: "value", ts: "string", notNull: false, clientNull: false },
	Signature: { kind: "value", ts: "string", notNull: false, clientNull: false },
	Color: { kind: "value", ts: "string", notNull: false, clientNull: false },
	Barcode: { kind: "value", ts: "string", notNull: false, clientNull: false },
	Geolocation: { kind: "value", ts: "string", notNull: false, clientNull: false },
	Duration: { kind: "value", ts: "number", notNull: false, clientNull: false },
	Icon: { kind: "value", ts: "string", notNull: false, clientNull: false },
	Phone: { kind: "value", ts: "string", notNull: false, clientNull: false },
	Autocomplete: { kind: "value", ts: "string", notNull: false, clientNull: false },
	// `unknown` already admits null.
	JSON: { kind: "value", ts: "unknown", notNull: false, clientNull: false },
});

/**
 * The standard fields: `name` and the named members of `FrappeDocFields`
 * (src/model.d.ts), which `RegisteredDoc` adds to every registered document. A DocType
 * field with one of these names (frappe's own Communication declares `_user_tags`, Web
 * Page `idx`) is left to that declaration rather than redeclared with `| null`; they are
 * never settable through `frm.set_value` either (`FormFieldName` excludes them).
 * `__*` client flags are skipped by prefix. A child entry's `parenttype` and a Single's
 * `name` are emitted on purpose, as literals.
 */
const BASE_MEMBERS = new Set([
	"doctype",
	"name",
	"owner",
	"creation",
	"modified",
	"modified_by",
	"docstatus",
	"idx",
	"parent",
	"parenttype",
	"parentfield",
	"_user_tags",
	"_comments",
	"_assign",
	"_liked_by",
	"localname",
]);

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The parts of a DocField this generator reads.
 * @typedef {object} RawField
 * @property {string} fieldname
 * @property {string} fieldtype
 * @property {string} [options]
 * @property {string} [label]
 * @property {number} [reqd]
 * @property {number} [not_nullable]
 */

/**
 * @typedef {object} FieldSpec
 * @property {string} fieldname
 * @property {string} fieldtype
 * @property {string | undefined} options
 * @property {string | undefined} label
 * @property {boolean} notNullable
 * @property {string | null} customFrom app-relative path of the Custom Field's file, or null for a standard field
 */

/**
 * @typedef {object} DocTypeSpec
 * @property {string} name
 * @property {string} app
 * @property {string} module
 * @property {string} file path relative to the apps directory
 * @property {boolean} istable
 * @property {boolean} issingle
 * @property {string | undefined} autoname
 * @property {FieldSpec[]} fields
 */

/**
 * @typedef {object} PropertySetter
 * @property {string} doc_type
 * @property {string} field_name
 * @property {string} property
 * @property {string} value
 * @property {string} from
 * @property {SyncPhase} phase
 */

/**
 * When frappe syncs a customisation file, in the order it does (see "WHICH CUSTOMISATION
 * WINS" in the header): 0 = a `custom/` file without `sync_on_migrate`, applied only at
 * install; 1 = `fixtures/`; 2 = a `custom/` file with `sync_on_migrate`.
 * @typedef {0 | 1 | 2} SyncPhase
 */

/**
 * @typedef {object} CustomField
 * @property {string} dt
 * @property {RawField} field
 * @property {string} from
 * @property {SyncPhase} phase
 */

/**
 * @typedef {object} GenerateOptions
 * @property {string} appsDir directory holding one folder per app (a bench's `apps/`)
 * @property {string} app the app whose DocTypes are emitted
 * @property {string[]} [siblings] further apps whose DocTypes and customisations are
 *   emitted, in the order they are installed (the target app is taken as installed last)
 */

/**
 * @typedef {object} GenerateResult
 * @property {string} text the .d.ts source
 * @property {string[]} warnings things that were typed loosely or skipped
 * @property {number} doctypes how many interfaces were emitted
 */

/* -------------------------------------------------------------------------- */
/* Reading apps                                                                */
/* -------------------------------------------------------------------------- */

/** frappe/__init__.py:843-845 — `Sales Order` -> `sales_order`. @param {string} text */
export function scrub(text) {
	return text.replaceAll(" ", "_").replaceAll("-", "_").toLowerCase();
}

/** Code-point order: stable across locales and machines. @param {string} a @param {string} b */
function cmp(a, b) {
	return a < b ? -1 : a > b ? 1 : 0;
}

/** @param {string} p */
function isDir(p) {
	try {
		return statSync(p).isDirectory();
	} catch {
		return false;
	}
}

/** @param {string} file @returns {unknown} */
function readJson(file) {
	return JSON.parse(readFileSync(file, "utf8"));
}

/** @param {unknown} v @returns {v is Record<string, unknown>} */
function isRecord(v) {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** @param {unknown} v */
function str(v) {
	return typeof v === "string" ? v : undefined;
}

/** @param {unknown} v */
function flag(v) {
	return v === 1 || v === true || v === "1";
}

/**
 * A bench root (it has `apps/`) or an apps directory itself.
 * @param {string} bench
 */
export function resolveAppsDir(bench) {
	const apps = path.join(bench, "apps");
	return isDir(apps) ? path.resolve(apps) : path.resolve(bench);
}

/**
 * The apps in an apps directory: folders `<name>` holding a python package `<name>/<name>`
 * with a `modules.txt`.
 * @param {string} appsDir
 */
export function listApps(appsDir) {
	return readdirSync(appsDir)
		.filter((name) => existsSync(path.join(appsDir, name, name, "modules.txt")))
		.sort(cmp);
}

/**
 * Module folder names, from `modules.txt` (frappe/__init__.py:902-904, :1087-1101),
 * scrubbed (:1063-1064).
 * @param {string} appsDir
 * @param {string} app
 */
function moduleDirs(appsDir, app) {
	const file = path.join(appsDir, app, app, "modules.txt");
	if (!existsSync(file)) return [];
	return readFileSync(file, "utf8")
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line !== "" && !line.startsWith("#"))
		.map((module) => ({ module, dir: scrub(module) }));
}

class AppReader {
	/** @param {string} appsDir */
	constructor(appsDir) {
		this.appsDir = appsDir;
		/** @type {Map<string, Map<string, DocTypeSpec>>} */
		this.cache = new Map();
		/** @type {string[]} */
		this.warnings = [];
	}

	/** @param {string} abs */
	rel(abs) {
		return path.relative(this.appsDir, abs).split(path.sep).join("/");
	}

	/**
	 * Every DocType an app ships, keyed by name — frappe/model/sync.py:135-137, :187-193.
	 * @param {string} app
	 * @returns {Map<string, DocTypeSpec>}
	 */
	doctypes(app) {
		const cached = this.cache.get(app);
		if (cached) return cached;
		/** @type {Map<string, DocTypeSpec>} */
		const out = new Map();
		for (const { module, dir } of moduleDirs(this.appsDir, app)) {
			const root = path.join(this.appsDir, app, app, dir, "doctype");
			if (!isDir(root)) continue;
			for (const docname of readdirSync(root).sort(cmp)) {
				const file = path.join(root, docname, `${docname}.json`);
				if (!existsSync(file)) continue;
				let raw;
				try {
					raw = readJson(file);
				} catch (error) {
					this.warnings.push(`${this.rel(file)}: not valid JSON (${error instanceof Error ? error.message : String(error)}); skipped`);
					continue;
				}
				if (!isRecord(raw) || raw.doctype !== "DocType" || typeof raw.name !== "string") continue;
				const spec = toDocTypeSpec(raw, { app, module: str(raw.module) ?? module, file: this.rel(file) });
				if (out.has(spec.name)) {
					this.warnings.push(`${spec.file}: DocType "${spec.name}" is also defined at ${out.get(spec.name)?.file}; keeping the first`);
					continue;
				}
				out.set(spec.name, spec);
			}
		}
		this.cache.set(app, out);
		return out;
	}

	/**
	 * Custom Fields and Property Setters an app ships: `<module>/custom/*.json`
	 * (frappe/modules/utils.py:133-144) and `fixtures/*.json` (frappe/utils/fixtures.py:32-43).
	 * @param {string} app
	 */
	customisations(app) {
		/** @type {CustomField[]} */
		const fields = [];
		/** @type {PropertySetter[]} */
		const setters = [];
		/**
		 * @param {unknown} record
		 * @param {string} from
		 * @param {SyncPhase} phase
		 * @param {string | undefined} [kind]
		 */
		const take = (record, from, phase, kind = str(isRecord(record) ? record.doctype : undefined)) => {
			if (!isRecord(record)) return;
			if (kind === "Custom Field") {
				const dt = str(record.dt);
				const field = toRawField(record);
				if (dt && field) fields.push({ dt, field, from, phase });
			} else if (kind === "Property Setter") {
				const doc_type = str(record.doc_type);
				const field_name = str(record.field_name);
				const property = str(record.property);
				const value = record.value == null ? "" : String(record.value);
				if (doc_type && field_name && property) setters.push({ doc_type, field_name, property, value, from, phase });
			}
		};
		/** @param {string} dir @param {(file: string, data: unknown) => void} each */
		const readFolder = (dir, each) => {
			if (!isDir(dir)) return;
			for (const name of readdirSync(dir).sort(cmp)) {
				if (!name.endsWith(".json")) continue;
				const file = path.join(dir, name);
				try {
					each(this.rel(file), readJson(file));
				} catch (error) {
					this.warnings.push(`${this.rel(file)}: not valid JSON (${error instanceof Error ? error.message : String(error)}); skipped`);
				}
			}
		};
		for (const { dir } of moduleDirs(this.appsDir, app)) {
			readFolder(path.join(this.appsDir, app, app, dir, "custom"), (from, data) => {
				if (!isRecord(data)) return;
				// frappe/modules/utils.py:141-144
				const phase = flag(data.sync_on_migrate) ? 2 : 0;
				for (const r of Array.isArray(data.custom_fields) ? data.custom_fields : []) take(r, from, phase, "Custom Field");
				for (const r of Array.isArray(data.property_setters) ? data.property_setters : []) take(r, from, phase, "Property Setter");
			});
		}
		readFolder(path.join(this.appsDir, app, app, "fixtures"), (from, data) => {
			for (const r of Array.isArray(data) ? data : []) take(r, from, 1);
		});
		return { fields, setters };
	}
}

/** @param {Record<string, unknown>} raw @returns {RawField | null} */
function toRawField(raw) {
	const fieldname = str(raw.fieldname);
	const fieldtype = str(raw.fieldtype);
	if (!fieldname || !fieldtype) return null;
	/** @type {RawField} */
	const field = { fieldname, fieldtype };
	const options = str(raw.options);
	const label = str(raw.label);
	if (options !== undefined) field.options = options;
	if (label !== undefined) field.label = label;
	if (flag(raw.reqd)) field.reqd = 1;
	if (flag(raw.not_nullable)) field.not_nullable = 1;
	return field;
}

/**
 * @param {RawField} field
 * @param {string | null} customFrom
 * @returns {FieldSpec}
 */
function toFieldSpec(field, customFrom) {
	return {
		fieldname: field.fieldname,
		fieldtype: field.fieldtype,
		options: field.options,
		label: field.label,
		notNullable: field.not_nullable === 1,
		customFrom,
	};
}

/**
 * @param {Record<string, unknown>} raw
 * @param {{ app: string, module: string, file: string }} where
 * @returns {DocTypeSpec}
 */
function toDocTypeSpec(raw, where) {
	/** @type {FieldSpec[]} */
	const fields = [];
	for (const r of Array.isArray(raw.fields) ? raw.fields : []) {
		const field = isRecord(r) ? toRawField(r) : null;
		if (field) fields.push(toFieldSpec(field, null));
	}
	return {
		name: String(raw.name),
		...where,
		istable: flag(raw.istable),
		issingle: flag(raw.issingle),
		autoname: str(raw.autoname),
		fields,
	};
}

/* -------------------------------------------------------------------------- */
/* Emitting                                                                    */
/* -------------------------------------------------------------------------- */

/** @param {string} fieldtype @returns {FieldtypeRule | undefined} */
export function ruleOf(fieldtype) {
	return Object.hasOwn(FIELDTYPES, fieldtype) ? FIELDTYPES[fieldtype] : undefined;
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

// Words that cannot name an interface. Doctype names start with a letter
// (frappe/core/doctype/doctype/doctype.py:45), but only lowercase ones can hit these.
const RESERVED = new Set(
	"break case catch class const continue debugger default delete do else enum export extends false finally for function if import in instanceof new null return super switch this throw true try typeof var void while with implements interface let package private protected public static yield any boolean never number object string symbol undefined unknown bigint".split(
		" ",
	),
);

/**
 * frappe's controller class name for a DocType (frappe/model/base_document.py:113), made
 * a safe TypeScript identifier for names that predate the doctype-name validation.
 * @param {string} doctype
 */
export function interfaceName(doctype) {
	let id = doctype.replaceAll(" ", "").replaceAll("-", "").replace(/[^\w$]/g, "_");
	if (!IDENTIFIER.test(id)) id = `_${id}`;
	if (RESERVED.has(id)) id = `${id}_`;
	return id;
}

/** @param {string} name */
function propertyKey(name) {
	return IDENTIFIER.test(name) ? name : JSON.stringify(name);
}

/** Text safe inside a `/** ... *\/` comment, on one line. @param {string} text */
function commentText(text) {
	return text.replace(/\s+/g, " ").trim().replaceAll("*/", "*\\/");
}

/**
 * The union a Select's options allow: split on "\n" and stripped as
 * frappe/types/exporter.py:201 does, deduplicated, plus "" (an empty value skips
 * validation, frappe/model/base_document.py:1106).
 * @param {string} options
 */
export function selectUnion(options) {
	/** @type {string[]} */
	const values = [];
	for (const o of options.split("\n").map((s) => s.trim())) if (o !== "" && !values.includes(o)) values.push(o);
	return [...values.map((v) => JSON.stringify(v)), '""'].join(" | ");
}

/**
 * @param {FieldSpec} field
 * @param {(child: string) => string} rowType the type of one row of a child DocType
 * @param {string[]} warnings
 * @param {string} where
 * @returns {{ type: string, optional: boolean } | null} null: the fieldtype has no value
 */
export function fieldType(field, rowType, warnings, where) {
	const rule = ruleOf(field.fieldtype);
	if (!rule) {
		warnings.push(`${where}: unknown fieldtype "${field.fieldtype}" for ${field.fieldname}; typed unknown`);
		return { type: "unknown", optional: true };
	}
	if (rule.kind === "none") return null;
	if (rule.kind === "table") {
		const child = (field.options ?? "").trim();
		if (child === "") {
			warnings.push(`${where}: ${field.fieldtype} field ${field.fieldname} names no child DocType; typed ${UNKNOWN_ROW}[]`);
			return { type: `${UNKNOWN_ROW}[]`, optional: false };
		}
		return { type: `${rowType(child)}[]`, optional: false };
	}
	let type = rule.ts;
	if (field.fieldtype === "Select" && field.fieldname !== "naming_series" && (field.options ?? "").trim() !== "") {
		type = selectUnion(field.options ?? "");
	}
	const nullable = rule.clientNull || (!rule.notNull && !field.notNullable);
	if (nullable && type !== "unknown") type += " | null";
	return { type, optional: true };
}

/** The row type of a table whose child DocType is on no app of the bench. */
const UNKNOWN_ROW = "$ft.ChildDoc";

/**
 * The global namespace that holds the entries. Shared by every generated file, so its
 * interfaces merge across files (see "WHY A GLOBAL NAMESPACE" above).
 */
export const NAMESPACE = "FrappeDocTypeFields";

/**
 * Read the apps and render the module.
 * @param {GenerateOptions} options
 * @returns {GenerateResult}
 */
export function generate({ appsDir, app, siblings = [] }) {
	const reader = new AppReader(appsDir);
	const warnings = reader.warnings;
	const allApps = listApps(appsDir);
	const others = siblings.filter((s, i) => s !== app && siblings.indexOf(s) === i);
	for (const a of [app, ...others]) {
		if (!allApps.includes(a)) throw new Error(`no app "${a}" in ${appsDir} (looked for ${a}/${a}/modules.txt)`);
	}
	// Install order, which decides which customisation frappe applies last: the siblings
	// as listed, then the target app, which is installed on top of them.
	const installed = [...others, app];
	// Lookup order for a DocType that is referenced but not emitted by name: the target
	// app, the siblings, then the rest of the bench alphabetically.
	const searchOrder = [app, ...others, ...allApps.filter((a) => a !== app && !others.includes(a))];

	/** @type {Map<string, DocTypeSpec>} */
	const emitted = new Map();
	/** @type {Map<string, string>} doctype -> why it was pulled in */
	const pulledIn = new Map();
	/** @type {string[]} */
	const missing = [];

	/** @param {string} doctype */
	const find = (doctype) => {
		for (const a of searchOrder) {
			const spec = reader.doctypes(a).get(doctype);
			if (spec) return spec;
		}
		return undefined;
	};
	/** @param {DocTypeSpec} spec */
	const emit = (spec) => {
		if (!emitted.has(spec.name)) emitted.set(spec.name, { ...spec, fields: spec.fields.map((f) => ({ ...f })) });
	};
	/** @param {string} doctype @param {string} why */
	const ensure = (doctype, why) => {
		if (emitted.has(doctype)) return true;
		const spec = find(doctype);
		if (!spec) return false;
		emit(spec);
		pulledIn.set(doctype, why);
		return true;
	};

	for (const a of [app, ...others]) for (const spec of reader.doctypes(a).values()) emit(spec);

	// Every customisation, in the order frappe syncs them; the last one to touch a thing wins.
	/** @type {CustomField[]} */
	const customFields = [];
	/** @type {PropertySetter[]} */
	const setters = [];
	/** @type {Set<string>} */
	const customisedBy = new Set();
	for (const phase of [0, 1, 2]) {
		for (const a of installed) {
			const c = reader.customisations(a);
			customFields.push(...c.fields.filter((f) => f.phase === phase));
			setters.push(...c.setters.filter((ps) => ps.phase === phase));
			if (c.fields.length > 0 || c.setters.length > 0) customisedBy.add(a);
		}
	}

	// Custom Fields are appended to their DocType, pulling it in from wherever it lives.
	for (const { dt, field, from } of customFields) {
		if (!ensure(dt, `customised by ${from}`)) {
			// The DocType itself is nowhere on this bench; keep its custom fields anyway.
			emitted.set(dt, { name: dt, app: "", module: "", file: "", istable: false, issingle: false, autoname: undefined, fields: [] });
			pulledIn.set(dt, `customised by ${from}; its DocType JSON is not on this bench, so only its custom fields are typed`);
			warnings.push(`${from}: Custom Field ${field.fieldname} targets DocType "${dt}", which no app on this bench defines`);
		}
		const spec = emitted.get(dt);
		if (!spec) continue;
		const at = spec.fields.findIndex((f) => f.fieldname === field.fieldname);
		if (at === -1) spec.fields.push(toFieldSpec(field, from));
		// A later Custom Field of the same name updates the earlier one (frappe/modules/utils.py:168-178).
		else if (spec.fields[at]?.customFrom) spec.fields[at] = toFieldSpec(field, from);
		else warnings.push(`${from}: Custom Field ${dt}.${field.fieldname} duplicates a standard field; keeping the standard one`);
	}

	// Property Setters on `options`, `fieldtype` and `not_nullable` change the field they
	// name; then child DocTypes are pulled in, transitively. Alternated until nothing new
	// arrives, because a setter can retarget a table and a new child can be customised.
	for (let grew = true; grew; ) {
		grew = false;
		for (const ps of setters) {
			const field = emitted.get(ps.doc_type)?.fields.find((f) => f.fieldname === ps.field_name);
			if (!field) continue;
			if (ps.property === "options") field.options = ps.value;
			else if (ps.property === "fieldtype") field.fieldtype = ps.value;
			else if (ps.property === "not_nullable") field.notNullable = flag(ps.value);
		}
		for (const spec of [...emitted.values()]) {
			for (const f of spec.fields) {
				if (ruleOf(f.fieldtype)?.kind !== "table") continue;
				const child = (f.options ?? "").trim();
				if (child === "" || emitted.has(child) || missing.includes(child)) continue;
				if (ensure(child, `a child table of ${spec.name}.${f.fieldname}`)) grew = true;
				else {
					missing.push(child);
					warnings.push(`${spec.file || spec.name}: ${spec.name}.${f.fieldname} is a table of "${child}", which no app on this bench defines; typed ${UNKNOWN_ROW}[]`);
				}
			}
		}
	}

	// The parents of each child DocType: every DocType on the bench with a Table of it — the
	// emitted ones as customised, the rest as their JSON declares them. The whole bench, not
	// just what is emitted: a handler registered on a child DocType runs on the form of ANY
	// parent (frappe/public/js/frappe/form/script_manager.js:109), so a parent left out
	// would be a wrong type, while one that is not installed only widens the union.
	// Reading apps that are not otherwise needed must not add warnings, so theirs are dropped.
	/** @type {Map<string, Set<string>>} */
	const parents = new Map();
	{
		const before = warnings.length;
		/** @type {Set<string>} */
		const seen = new Set();
		/** @param {DocTypeSpec} spec */
		const scan = (spec) => {
			if (seen.has(spec.name)) return;
			seen.add(spec.name);
			for (const f of spec.fields) {
				const child = (f.options ?? "").trim();
				if (ruleOf(f.fieldtype)?.kind !== "table" || child === "") continue;
				const set = parents.get(child) ?? new Set();
				set.add(spec.name);
				parents.set(child, set);
			}
		};
		for (const spec of emitted.values()) scan(spec);
		for (const a of searchOrder) for (const spec of reader.doctypes(a).values()) scan(spec);
		warnings.length = before;
	}

	// Interfaces merge across generated files BY NAME, so a DocType's name must not depend
	// on what else is in the file. It does only when two DocTypes share a class name
	// ("Sales Order" and "SalesOrder"): the later one, in name order, gets a numeric
	// suffix, so two files that disagree on which of them they hold can disagree on it.
	/** @type {Map<string, string>} */
	const names = new Map();
	const used = new Set();
	/** @param {string} doctype */
	const nameOf = (doctype) => {
		let id = names.get(doctype);
		if (id) return id;
		const base = interfaceName(doctype);
		id = base;
		for (let n = 2; used.has(id); n++) id = `${base}_${n}`;
		used.add(id);
		names.set(doctype, id);
		return id;
	};

	const ordered = [...emitted.values()].sort((a, b) => cmp(a.name, b.name));
	for (const spec of ordered) nameOf(spec.name);
	/** @param {string} child */
	const rowType = (child) => (emitted.has(child) ? `FrappeChildRow<${JSON.stringify(child)}>` : UNKNOWN_ROW);
	const sources = [...new Set(ordered.map((spec) => spec.app).filter((a) => a !== ""))].sort(cmp);

	const lines = [
		"// Generated by `frappe-types gen-registry`. Do not edit; re-run the generator.",
		`//   --app ${app}${others.length ? ` --include-siblings ${others.join(",")}` : ""}`,
		`//   DocType JSON read from: ${sources.join(", ") || "(none)"}`,
		`//   customisations read from: ${installed.filter((a) => customisedBy.has(a)).join(", ") || "(none)"}`,
		"//",
		"// Each interface lists one DocType's data fields as its JSON files declare them, plus",
		"// the Custom Fields and Property Setters of the apps above. `DocOf<DocType>` adds the",
		"// standard fields. Fields added in the database (Customize Form) are in no file and",
		"// so are not here: a registered document is closed, so add any your code reads by",
		"// augmenting `FrappeDocTypeFields`. Other generated files (other apps') can share the",
		'// program: see the frappe-types README, "Generating the registry".',
		"",
		// Also puts frappe-types, and with it the registry and FrappeChildRow, in the program.
		'import type * as $ft from "frappe-types";',
		"",
		"declare global {",
		"\t/**",
		"\t * DocType name -> its data fields. Every entry is an interface of the global",
		"\t * `FrappeDocTypeFields` namespace, so a second generated file that registers the same",
		"\t * DocType declares the same entry, and its fields merge into the same interface.",
		"\t */",
		"\tinterface FrappeDocTypes {",
		...ordered.map((spec) => `\t\t${JSON.stringify(spec.name)}: ${NAMESPACE}.${nameOf(spec.name)};`),
		"\t}",
		"",
		"\t/** The data fields of each registered DocType, by frappe's controller class name. */",
		`\tnamespace ${NAMESPACE} {`,
	];

	ordered.forEach((spec, i) => {
		if (i > 0) lines.push("");
		const doc = [`DocType ${JSON.stringify(spec.name)}${spec.app ? ` — ${spec.app}, module ${spec.module}` : ""}.`];
		if (spec.file) doc.push(`\`${spec.file}\``);
		const why = pulledIn.get(spec.name);
		if (why) doc.push(`Included because it is ${why}.`);
		if (spec.issingle) doc.push("Single: its one document is named after the DocType.");
		if (spec.autoname === "autoincrement") {
			doc.push("`autoname: autoincrement`: the server sends `name` as a number (frappe/model/naming.py:161-162), though the registry types it string.");
		}
		lines.push("\t\t/**", ...doc.map((d) => `\t\t * ${commentText(d)}`), "\t\t */");
		lines.push(`\t\tinterface ${nameOf(spec.name)} {`);
		if (spec.issingle) lines.push(`\t\t\tname: ${JSON.stringify(spec.name)};`);
		if (spec.istable) {
			const of = [...(parents.get(spec.name) ?? [])].sort(cmp);
			lines.push(
				of.length > 0
					? `\t\t\t/** The DocTypes on this bench with a Table of ${commentText(spec.name)}: the forms its events run on. */`
					: `\t\t\t/** No DocType on this bench has a Table of ${commentText(spec.name)}. */`,
			);
			lines.push(`\t\t\tparenttype: ${of.length > 0 ? of.map((p) => JSON.stringify(p)).join(" | ") : "string"};`);
		}
		const seen = new Set();
		for (const f of spec.fields) {
			if (seen.has(f.fieldname)) continue;
			seen.add(f.fieldname);
			const where = f.customFrom ?? (spec.file || spec.name);
			const t = fieldType(f, rowType, warnings, where);
			if (!t) continue;
			if (BASE_MEMBERS.has(f.fieldname) || f.fieldname.startsWith("__")) {
				lines.push(`\t\t\t// ${f.fieldname} (${commentText(f.fieldtype)}) — a standard field, typed by frappe-types`);
				continue;
			}
			const label = f.label ? `${commentText(f.label)} · ` : "";
			const target = (f.fieldtype === "Link" || ruleOf(f.fieldtype)?.kind === "table") && f.options ? ` → ${commentText(f.options)}` : "";
			const custom = f.customFrom ? ` · Custom Field, ${f.customFrom}` : "";
			lines.push(`\t\t\t/** ${label}${commentText(f.fieldtype)}${target}${custom} */`);
			lines.push(`\t\t\t${propertyKey(f.fieldname)}${t.optional ? "?" : ""}: ${t.type};`);
		}
		lines.push("\t\t}");
	});
	lines.push("\t}", "}");
	// The entries under their own names too, for `import type { SalesOrder } from "./doctypes"`.
	if (ordered.length > 0) lines.push("");
	for (const spec of ordered) lines.push(`export type ${nameOf(spec.name)} = ${NAMESPACE}.${nameOf(spec.name)};`);
	lines.push("");
	return { text: lines.join("\n"), warnings: [...new Set(warnings)], doctypes: ordered.length };
}

/* -------------------------------------------------------------------------- */
/* CLI                                                                         */
/* -------------------------------------------------------------------------- */

export const USAGE = `usage: frappe-types gen-registry --bench <bench or apps dir> --app <app>
                               [--include-siblings app1,app2] [--out <file.d.ts>]
                               [--check] [--strict] [--quiet]

Writes a .d.ts that augments the global FrappeDocTypes / FrappeDocTypeFields registry
for desk scripts (TypeScript or JSDoc + checkJs), read offline from the bench's apps/
tree. No site or database is needed, so Customize Form changes made only in a site's
database are not seen. Typing a frappe-ui / Vue SPA? Use frappe-ui's frappeTypes Vite
plugin or the frappe_types bench app (github.com/frappe/frappe-types) instead.

  --bench             a bench (the folder holding apps/) or an apps directory
  --app               the app whose DocTypes and customisations are typed
  --include-siblings  more apps to type in full, comma-separated (e.g. erpnext,hrms)
  --out               write here instead of stdout
  --check             do not write; exit 1 if --out is missing or out of date
  --strict            exit 1 if anything had to be typed loosely (unknown fieldtype,
                      a table or customised DocType no app on the bench defines)
  --quiet             do not print warnings`;

/**
 * @param {string[]} argv the arguments after `gen-registry`
 * @param {{ stdout: (s: string) => void, stderr: (s: string) => void }} io
 * @returns {Promise<number>} exit code
 */
export async function main(argv, io) {
	const { parseArgs } = await import("node:util");
	const { writeFileSync, mkdirSync } = await import("node:fs");
	let values;
	try {
		values = parseArgs({
			args: argv,
			options: {
				bench: { type: "string" },
				app: { type: "string" },
				"include-siblings": { type: "string" },
				out: { type: "string" },
				check: { type: "boolean", default: false },
				strict: { type: "boolean", default: false },
				quiet: { type: "boolean", default: false },
				help: { type: "boolean", short: "h", default: false },
			},
			strict: true,
			allowPositionals: false,
		}).values;
	} catch (error) {
		io.stderr(`${error instanceof Error ? error.message : String(error)}\n${USAGE}\n`);
		return 2;
	}
	if (values.help) {
		io.stdout(`${USAGE}\n`);
		return 0;
	}
	if (!values.bench || !values.app) {
		io.stderr(`--bench and --app are required\n${USAGE}\n`);
		return 2;
	}
	if (values.check && !values.out) {
		io.stderr(`--check compares with --out; pass both\n${USAGE}\n`);
		return 2;
	}
	const siblings = (values["include-siblings"] ?? "")
		.split(",")
		.map((s) => s.trim())
		.filter((s) => s !== "");
	const appsDir = resolveAppsDir(values.bench);

	let result;
	try {
		result = generate({ appsDir, app: values.app, siblings });
	} catch (error) {
		io.stderr(`gen-registry: ${error instanceof Error ? error.message : String(error)}\n`);
		return 2;
	}
	if (!values.quiet) for (const w of result.warnings) io.stderr(`warning: ${w}\n`);

	if (values.check && values.out) {
		const current = existsSync(values.out) ? readFileSync(values.out, "utf8") : null;
		if (current !== result.text) {
			io.stderr(`${values.out} is ${current === null ? "missing" : "out of date"}; re-run without --check to regenerate\n`);
			return 1;
		}
		io.stderr(`${values.out} is up to date (${result.doctypes} DocTypes)\n`);
	} else if (values.out) {
		mkdirSync(path.dirname(path.resolve(values.out)), { recursive: true });
		writeFileSync(values.out, result.text);
		io.stderr(`wrote ${values.out} (${result.doctypes} DocTypes)\n`);
	} else {
		io.stdout(result.text);
	}
	if (values.strict && result.warnings.length > 0) {
		io.stderr(`--strict: ${result.warnings.length} warning(s)\n`);
		return 1;
	}
	return 0;
}

// `frappe-types gen-doctypes` — TypeScript interfaces for an app's DocTypes, read from the
// same JSON files `bench migrate` reads, registered in the global `FrappeDocTypes` map.
//
//   frappe-types gen-doctypes --bench <bench | apps dir> --app <app>
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
// any file and cannot be seen; the open index signature every interface inherits from
// `FrappeDoc` is where they land, typed `unknown`.
//
// HOW A FIELD IS TYPED — every rule below is checked against the pinned frappe source by
// test/gen-doctypes.test.mjs ("classification agrees with frappe"), so a frappe release
// that adds or reclassifies a fieldtype fails CI instead of silently typing it wrong.
//
//   no value     `no_value_fields` minus `table_fields` (frappe/model/__init__.py:53-65,
//                :101) have no column and no value; they are not emitted.
//   tables       `Table` / `Table MultiSelect` (:101) are `Child[]`, and REQUIRED: the
//                client initialises every table field to `[]` on a new doc
//                (frappe/public/js/frappe/model/create_new.js:227-229) and the server
//                does the same on load (frappe/model/base_document.py:588-601).
//   values       everything in `data_fieldtypes` (frappe/model/__init__.py:8-43), OPTIONAL
//                (`?:`): a doc created in the browser has only the fields that had a
//                default (create_new.js:82-116).
//   null         a column is NOT NULL only for `NOT_NULL_TYPES`
//                (frappe/database/schema.py:182, :226-227) or a field with `not_nullable`
//                (:242-247); everything else can read back `null` and is typed `| null`.
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
//   JSON                        unknown   a string from MariaDB (mariadb/database.py:209),
//                                         a parsed value from Postgres, whose `json`
//                                         column (postgres/database.py:167) psycopg2 decodes
//   everything else             string    Data, Link, Date, Datetime, Time, Text, ... —
//                                         varchar/text/date columns, all strings on the wire
//
// WHAT IS EMITTED: one module. Each DocType is an `export interface` named the way frappe
// names its controller class — spaces and hyphens removed (frappe/model/base_document.py:113)
// — extending `FrappeDoc` (or `ChildDoc` for `istable`), so the standard fields (name,
// owner, creation, modified, modified_by, docstatus, idx, and parent/parenttype/
// parentfield on child rows; frappe/model/__init__.py:84-96) come from frappe-types rather
// than being re-declared. A `declare global { interface FrappeDocTypes { ... } }` block
// registers each one under its DocType name. Output is byte-for-byte deterministic: no
// timestamps, no absolute paths, everything sorted.

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
 * @typedef {{ kind: "none" } | { kind: "table" } | { kind: "value", ts: string, notNull: boolean }} FieldtypeRule
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
	// frappe/database/schema.py:182.
	Currency: { kind: "value", ts: "number", notNull: true },
	Int: { kind: "value", ts: "number", notNull: true },
	"Long Int": { kind: "value", ts: "number", notNull: false },
	Float: { kind: "value", ts: "number", notNull: true },
	Percent: { kind: "value", ts: "number", notNull: true },
	Check: { kind: "value", ts: "0 | 1", notNull: true },
	"Small Text": { kind: "value", ts: "string", notNull: false },
	"Long Text": { kind: "value", ts: "string", notNull: false },
	Code: { kind: "value", ts: "string", notNull: false },
	"Text Editor": { kind: "value", ts: "string", notNull: false },
	"Markdown Editor": { kind: "value", ts: "string", notNull: false },
	"HTML Editor": { kind: "value", ts: "string", notNull: false },
	Date: { kind: "value", ts: "string", notNull: false },
	Datetime: { kind: "value", ts: "string", notNull: false },
	Time: { kind: "value", ts: "string", notNull: false },
	Text: { kind: "value", ts: "string", notNull: false },
	Data: { kind: "value", ts: "string", notNull: false },
	Link: { kind: "value", ts: "string", notNull: false },
	"Dynamic Link": { kind: "value", ts: "string", notNull: false },
	Password: { kind: "value", ts: "string", notNull: false },
	// `ts` is the fallback; a Select with options is typed as their union.
	Select: { kind: "value", ts: "string", notNull: false },
	Rating: { kind: "value", ts: "number", notNull: false },
	"Read Only": { kind: "value", ts: "string", notNull: false },
	Attach: { kind: "value", ts: "string", notNull: false },
	"Attach Image": { kind: "value", ts: "string", notNull: false },
	Signature: { kind: "value", ts: "string", notNull: false },
	Color: { kind: "value", ts: "string", notNull: false },
	Barcode: { kind: "value", ts: "string", notNull: false },
	Geolocation: { kind: "value", ts: "string", notNull: false },
	Duration: { kind: "value", ts: "number", notNull: false },
	Icon: { kind: "value", ts: "string", notNull: false },
	Phone: { kind: "value", ts: "string", notNull: false },
	Autocomplete: { kind: "value", ts: "string", notNull: false },
	// `unknown` already admits null.
	JSON: { kind: "value", ts: "unknown", notNull: false },
});

/**
 * Members `FrappeDocBase` / `ChildDoc` (src/model.d.ts) already declare. A DocType field
 * with one of these names (frappe's own Communication declares `_user_tags`, Web Page
 * `idx`) is left to the base type: re-declaring it with `| null` would conflict with it.
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
	"_sortable",
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
 */

/**
 * @typedef {object} GenerateOptions
 * @property {string} appsDir directory holding one folder per app (a bench's `apps/`)
 * @property {string} app the app whose DocTypes are emitted
 * @property {string[]} [siblings] further apps whose DocTypes and customisations are emitted
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
		/** @type {{ dt: string, field: RawField, from: string }[]} */
		const fields = [];
		/** @type {PropertySetter[]} */
		const setters = [];
		/** @param {unknown} record @param {string} from */
		const take = (record, from, kind = str(isRecord(record) ? record.doctype : undefined)) => {
			if (!isRecord(record)) return;
			if (kind === "Custom Field") {
				const dt = str(record.dt);
				const field = toRawField(record);
				if (dt && field) fields.push({ dt, field, from });
			} else if (kind === "Property Setter") {
				const doc_type = str(record.doc_type);
				const field_name = str(record.field_name);
				const property = str(record.property);
				const value = record.value == null ? "" : String(record.value);
				if (doc_type && field_name && property) setters.push({ doc_type, field_name, property, value, from });
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
				for (const r of Array.isArray(data.custom_fields) ? data.custom_fields : []) take(r, from, "Custom Field");
				for (const r of Array.isArray(data.property_setters) ? data.property_setters : []) take(r, from, "Property Setter");
			});
		}
		readFolder(path.join(this.appsDir, app, app, "fixtures"), (from, data) => {
			for (const r of Array.isArray(data) ? data : []) take(r, from);
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
 * @param {(child: string) => string} childType
 * @param {string[]} warnings
 * @param {string} where
 * @returns {{ type: string, optional: boolean } | null} null: the fieldtype has no value
 */
export function fieldType(field, childType, warnings, where) {
	const rule = ruleOf(field.fieldtype);
	if (!rule) {
		warnings.push(`${where}: unknown fieldtype "${field.fieldtype}" for ${field.fieldname}; typed unknown`);
		return { type: "unknown", optional: true };
	}
	if (rule.kind === "none") return null;
	if (rule.kind === "table") {
		const child = (field.options ?? "").trim();
		if (child === "") {
			warnings.push(`${where}: ${field.fieldtype} field ${field.fieldname} names no child DocType; typed $ft.ChildDoc[]`);
			return { type: "$ft.ChildDoc[]", optional: false };
		}
		return { type: `${childType(child)}[]`, optional: false };
	}
	let type = rule.ts;
	if (field.fieldtype === "Select" && field.fieldname !== "naming_series" && (field.options ?? "").trim() !== "") {
		type = selectUnion(field.options ?? "");
	}
	if (!rule.notNull && !field.notNullable && type !== "unknown") type += " | null";
	return { type, optional: true };
}

/**
 * Read the apps and render the module.
 * @param {GenerateOptions} options
 * @returns {GenerateResult}
 */
export function generate({ appsDir, app, siblings = [] }) {
	const reader = new AppReader(appsDir);
	const warnings = reader.warnings;
	const allApps = listApps(appsDir);
	const primary = [app, ...siblings.filter((s) => s !== app)];
	for (const a of primary) {
		if (!allApps.includes(a)) throw new Error(`no app "${a}" in ${appsDir} (looked for ${a}/${a}/modules.txt)`);
	}
	// Lookup order for a DocType that is referenced but not emitted by name: the requested
	// apps first, then the rest of the bench alphabetically.
	const searchOrder = [...primary, ...allApps.filter((a) => !primary.includes(a))];

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

	for (const a of primary) for (const spec of reader.doctypes(a).values()) emit(spec);

	/** @type {{ dt: string, field: RawField, from: string }[]} */
	const customFields = [];
	/** @type {PropertySetter[]} */
	const setters = [];
	for (const a of primary) {
		const c = reader.customisations(a);
		customFields.push(...c.fields);
		setters.push(...c.setters);
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
		if (spec.fields.some((f) => f.fieldname === field.fieldname)) {
			warnings.push(`${from}: Custom Field ${dt}.${field.fieldname} duplicates an existing field; keeping the first`);
			continue;
		}
		spec.fields.push(toFieldSpec(field, from));
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
					warnings.push(`${spec.file || spec.name}: ${spec.name}.${f.fieldname} is a table of "${child}", which no app on this bench defines; typed $ft.ChildDoc[]`);
				}
			}
		}
	}

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
	const childType = (child) => (emitted.has(child) ? nameOf(child) : "$ft.ChildDoc");

	const lines = [
		"// Generated by `frappe-types gen-doctypes`. Do not edit; re-run the generator.",
		`//   --app ${app}${siblings.length ? ` --include-siblings ${siblings.join(",")}` : ""}`,
		"//",
		"// Each interface is one DocType as its JSON files declare it, plus the Custom Fields",
		"// and Property Setters the apps above ship. Fields added in the database (Customize",
		"// Form) are not in any file; they fall through to FrappeDoc's index signature as",
		"// `unknown`. See the frappe-types README, \"Typing your DocTypes\".",
		"",
		'import type * as $ft from "frappe-types";',
		"",
		"declare global {",
		"\t/** DocType name -> document shape. Augmented by every generated doctypes file. */",
		"\tinterface FrappeDocTypes {",
		...ordered.map((spec) => `\t\t${JSON.stringify(spec.name)}: ${nameOf(spec.name)};`),
		"\t}",
		"}",
	];

	for (const spec of ordered) {
		lines.push("");
		const doc = [`DocType ${JSON.stringify(spec.name)}${spec.app ? ` — ${spec.app}, module ${spec.module}` : ""}.`];
		if (spec.file) doc.push(`\`${spec.file}\``);
		const why = pulledIn.get(spec.name);
		if (why) doc.push(`Included because it is ${why}.`);
		if (spec.issingle) doc.push("Single: its one document is named after the DocType.");
		if (spec.autoname === "autoincrement") {
			doc.push("`autoname: autoincrement`: the server sends `name` as a number (frappe/model/naming.py:161-162), though `FrappeDoc` types it string.");
		}
		lines.push("/**", ...doc.map((d) => ` * ${commentText(d)}`), " */");
		const base = spec.istable ? "$ft.ChildDoc" : "$ft.FrappeDoc";
		lines.push(`export interface ${nameOf(spec.name)} extends ${base} {`);
		lines.push(`\tdoctype: ${JSON.stringify(spec.name)};`);
		if (spec.issingle) lines.push(`\tname: ${JSON.stringify(spec.name)};`);
		const seen = new Set();
		for (const f of spec.fields) {
			if (seen.has(f.fieldname)) continue;
			seen.add(f.fieldname);
			const where = f.customFrom ?? (spec.file || spec.name);
			const t = fieldType(f, childType, warnings, where);
			if (!t) continue;
			if (BASE_MEMBERS.has(f.fieldname) || f.fieldname.startsWith("__")) {
				lines.push(`\t// ${f.fieldname} (${commentText(f.fieldtype)}) — typed by ${base}`);
				continue;
			}
			const label = f.label ? `${commentText(f.label)} · ` : "";
			const target = (f.fieldtype === "Link" || ruleOf(f.fieldtype)?.kind === "table") && f.options ? ` → ${commentText(f.options)}` : "";
			const custom = f.customFrom ? ` · Custom Field, ${f.customFrom}` : "";
			lines.push(`\t/** ${label}${commentText(f.fieldtype)}${target}${custom} */`);
			lines.push(`\t${propertyKey(f.fieldname)}${t.optional ? "?" : ""}: ${t.type};`);
		}
		lines.push("}");
	}
	lines.push("");
	return { text: lines.join("\n"), warnings: [...new Set(warnings)], doctypes: ordered.length };
}

/* -------------------------------------------------------------------------- */
/* CLI                                                                         */
/* -------------------------------------------------------------------------- */

export const USAGE = `usage: frappe-types gen-doctypes --bench <bench or apps dir> --app <app>
                               [--include-siblings app1,app2] [--out <file.d.ts>]
                               [--check] [--strict] [--quiet]

  --bench             a bench (the folder holding apps/) or an apps directory
  --app               the app whose DocTypes and customisations are typed
  --include-siblings  more apps to type in full, comma-separated (e.g. erpnext,hrms)
  --out               write here instead of stdout
  --check             do not write; exit 1 if --out is missing or out of date
  --strict            exit 1 if anything had to be typed loosely (unknown fieldtype,
                      a table or customised DocType no app on the bench defines)
  --quiet             do not print warnings`;

/**
 * @param {string[]} argv the arguments after `gen-doctypes`
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
		io.stderr(`gen-doctypes: ${error instanceof Error ? error.message : String(error)}\n`);
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

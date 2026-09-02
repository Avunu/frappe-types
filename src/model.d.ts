/**
 * `frappe-types` — group: **frappe-model-meta**
 *
 * Declarations for `frappe.model.*`, `frappe.meta.*`, the global `locals` doc
 * cache, and the core data shapes (`FrappeDoc`, `DocField`, `DocTypeMeta`).
 *
 * Verified against **Frappe v16.33.0** (`git tag v16.33.0`, branch `version-16`)
 * at `apps/frappe`. Every non-obvious declaration cites the file and line it was
 * read from. Line numbers are only valid for v16.33.0 — re-verify on bump.
 *
 * Primary sources:
 * - `frappe/public/js/frappe/model/model.js`        (frappe.model core)
 * - `frappe/public/js/frappe/model/meta.js`         (frappe.meta + frappe.get_meta)
 * - `frappe/public/js/frappe/model/sync.js`         (locals population, docinfo)
 * - `frappe/public/js/frappe/model/create_new.js`   (new doc / child rows)
 * - `frappe/public/js/frappe/model/user_settings.js`
 * - `frappe/public/js/frappe/provide.js`            (`locals` bootstrap)
 * - `frappe/core/doctype/docfield/docfield.json`    (authoritative DocField list)
 * - `frappe/core/doctype/doctype/doctype.json`      (authoritative DocType list)
 * - `frappe/desk/form/meta.py`                      (the `__*` sugar keys)
 *
 * Design note on index signatures: `DocField`, `FrappeDoc` and `DocTypeMeta` all
 * carry `[key: string]: unknown`. Frappe documents are open bags — Custom Fields,
 * app-specific `df` flags and server-injected `__*` keys all land on these objects
 * at runtime. `unknown` (never `any`) keeps every unlisted read honest: the
 * consumer must narrow before using it, which is the correct outcome.
 */

// ---------------------------------------------------------------------------
// Cross-fragment imports
//
// SEAM NOTE — `FrappeIndicator` (the `$indicator-colors` union) is owned by
// `core.d.ts`. `IndicatorTuple` below is declared HERE because it is produced by
// `frappe/public/js/frappe/model/indicator.js`, which is this fragment's
// territory, and because `views.d.ts` already imports the name from `./model`.
// The import is type-only and `core.d.ts` imports from `./model` in turn; a
// type-only cycle between two `.d.ts` modules is legal and has no emit.
// ---------------------------------------------------------------------------
import type { FrappeIndicator } from "./core";

/* -------------------------------------------------------------------------- */
/* Fieldtypes                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Every value of the DocField `fieldtype` Select.
 *
 * Source: `frappe/core/doctype/docfield/docfield.json` → the `fieldtype` field's
 * `options` (44 entries). Cross-checked against
 * `frappe/public/js/frappe/model/model.js:7-48` (`frappe.model.all_fieldtypes`),
 * which is the same list MINUS the four layout types and `Fold`/`Section Break`/
 * `Column Break`/`Tab Break` — `all_fieldtypes` is the "pickable in a control"
 * list, not the full enum.
 */
export type FieldTypeName =
	| "Autocomplete"
	| "Attach"
	| "Attach Image"
	| "Attachment Gallery"
	| "Barcode"
	| "Button"
	| "Check"
	| "Code"
	| "Color"
	| "Column Break"
	| "Currency"
	| "Data"
	| "Date"
	| "Datetime"
	| "Duration"
	| "Dynamic Link"
	| "Float"
	| "Fold"
	| "Geolocation"
	| "Heading"
	| "HTML"
	| "HTML Editor"
	| "Icon"
	| "Image"
	| "Int"
	| "JSON"
	| "Link"
	| "Long Text"
	| "Markdown Editor"
	| "Password"
	| "Percent"
	| "Phone"
	| "Read Only"
	| "Rating"
	| "Section Break"
	| "Select"
	| "Signature"
	| "Small Text"
	| "Tab Break"
	| "Table"
	| "Table MultiSelect"
	| "Text"
	| "Text Editor"
	| "Time";

/**
 * The type actually stored on a `df.fieldtype`.
 *
 * Deliberately NOT a closed union: frappe itself synthesises pseudo-fieldtypes at
 * runtime that are absent from the DocType. `frappe/public/js/frappe/form/formatters.js:435`
 * rewrites `_user_tags` to `df = { ...df, fieldtype: "Tag" }`, and
 * `formatters.js:432` substitutes `{ fieldtype: "Data" }` for masked fields.
 * `FieldTypeName | (string & {})` keeps editor completion for the 44 real types
 * while still accepting the runtime-only ones.
 */
export type FieldType = FieldTypeName | (string & {});

/**
 * Frappe stores booleans as `0 | 1` in the database, but its own desk JS
 * sometimes assigns real booleans over the top of a loaded docfield — e.g.
 * `frappe/public/js/frappe/form/grid.js:919` `column.df.hidden = false;` and
 * `:948` `column.df.hidden = true;`, against `grid.js:879` which writes
 * `hidden = show ? 0 : 1`. Any `df` flag frappe mutates client-side therefore has
 * to accept both.
 */
export type FrappeCheck = 0 | 1;

/** A check field that frappe's own client code may overwrite with a boolean. */
export type FrappeCheckLoose = 0 | 1 | boolean;

/** `frappe/public/js/frappe/model/model.js:142` */
export type NumericFieldType = "Int" | "Float" | "Currency" | "Percent" | "Duration";

/** `frappe/public/js/frappe/model/model.js:64` */
export type LayoutFieldType = "Section Break" | "Column Break" | "Tab Break" | "Fold";

/** `frappe/public/js/frappe/model/model.js:146` */
export type TableFieldType = "Table" | "Table MultiSelect";

/* -------------------------------------------------------------------------- */
/* DocField                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * One entry of a Select control's option list.
 *
 * `df.options` is normally the newline-joined string straight out of the DB, but
 * `frappe/public/js/frappe/form/controls/select.js:61-68` accepts an array too
 * (`if (typeof this.df.options === "string") options = this.df.options.split("\n")`),
 * and `frappe/public/js/frappe/form/controls/select.js:158-177` (`parse_option`)
 * accepts each entry as either a bare string or a `{value,label,disabled,selected}`
 * object. `frappe/public/js/frappe/model/model.js:863`
 * (`frm.set_df_property("default_view", "options", default_views)`) is frappe
 * assigning a `string[]` in-tree.
 */
export type SelectOption =
	| string
	| {
			value?: string;
			label?: string;
			disabled?: boolean;
			selected?: boolean;
	  };

/**
 * Extra arguments `frappe.format` threads into a formatter.
 * `frappe/public/js/frappe/form/formatters.js:11-17` reads `inline` / `only_value`;
 * `:96` reads `always_show_decimals`. The bag is open — apps pass their own keys.
 *
 * COLLISION RESOLVED — `ui/form.d.ts` declared a second, longer `FormatterOptions`
 * for the same runtime bag. `model.d.ts` wins ownership because it is the lower
 * module (`ui/form.d.ts` already imports from here, not the reverse) and because
 * {@link DocFieldFormatter} — the type of `DocField.formatter` — has to name it.
 * The three keys the `ui/form` copy documented and this one did not
 * (`for_print`, `label`, `no_icon`) were folded in below, citations intact;
 * `ui/form.d.ts` now re-exports this declaration.
 */
export interface FormatterOptions {
	/** formatters.js:12 — suppresses `_right`'s right-aligned wrapper div. */
	inline?: boolean | 1 | 0;
	/** formatters.js:12, :159, :182 — return the bare value, no markup. */
	only_value?: boolean | 1 | 0;
	/** formatters.js:182 — Link renders as plain text rather than an anchor. */
	for_print?: boolean | 1 | 0;
	/** formatters.js:71/:96 — Float keeps trailing zeros. */
	always_show_decimals?: boolean | 1 | 0;
	/** formatters.js:213 — overrides the Link's anchor text. */
	label?: string;
	/** Passed by `frm.get_formatted` / `set_disp_area`; no formatter reads it. */
	no_icon?: boolean | 1 | 0;
	[key: string]: unknown;
}

/**
 * A custom `df.formatter`.
 *
 * Called as `formatter(value, df, options, doc)` —
 * `frappe/public/js/frappe/form/formatters.js:443-445`
 * (`var formatter = df.formatter || frappe.form.get_formatter(fieldtype);
 *   var formatted = formatter(value, df, options, doc);`).
 *
 * The return type is deliberately `unknown`, NOT `string`. Frappe's own built-in
 * formatters return non-strings on common paths: `formatters.Int`
 * (`formatters.js:83-92`) returns `_right(cint(value), options)` and `_right`
 * (`formatters.js:11-17`) returns the raw `value` when `options.inline` is set —
 * i.e. a `number`. `frappe.format` itself guards with
 * `if (typeof formatted == "string") formatted = frappe.dom.remove_script_and_style(formatted)`
 * (`formatters.js:447`), which only makes sense because non-strings occur.
 * Narrow the result before inserting it into the DOM.
 */
export type DocFieldFormatter = (
	value: unknown,
	df?: DocField,
	options?: FormatterOptions,
	doc?: FrappeDoc,
) => unknown;

/**
 * A DocField — the metadata row describing one field of a DocType.
 *
 * Property list taken from `frappe/core/doctype/docfield/docfield.json` (the
 * complete DB schema, layout breaks excluded) plus every runtime-only property
 * frappe's desk JS reads or writes onto a `df`. Runtime-only properties are
 * marked with the source line that creates them.
 *
 * `fieldname` and `fieldtype` are required here because every docfield that came
 * from the server has both. Frappe also builds *synthetic* partial descriptors
 * with neither — see {@link PartialDocField}.
 */
export interface DocField {
	/* -- identity ---------------------------------------------------------- */

	fieldname: string;
	fieldtype: FieldType;
	label?: string;

	/**
	 * The DocType this field belongs to. Absent on synthetic descriptors.
	 * Used as the translation *context* argument of `__()` throughout the desk,
	 * and as the first key of {@link FrappeMetaNamespace.docfield_map}.
	 */
	parent?: string;

	/** DocField rows are themselves child rows of a DocType doc. */
	parenttype?: string;
	parentfield?: string;
	/** The DocField row's own docname (a hash). */
	name?: string;
	/** Field order within the DocType. `frappe/public/js/frappe/model/meta.js:120-126` sorts on it. */
	idx?: number;
	owner?: string;
	creation?: string;
	modified?: string;
	modified_by?: string;
	docstatus?: 0 | 1 | 2;

	/* -- type / value ------------------------------------------------------ */

	/**
	 * Meaning depends on `fieldtype`: target DocType for Link/Table/Table
	 * MultiSelect, newline-joined choices for Select, a currency-field pointer
	 * for Currency, `"URL"`/`"IBAN"` for Data, star count for Rating.
	 * May be an array — see {@link SelectOption}.
	 */
	options?: string | SelectOption[];
	/** The DB column default. Read via `df["default"]` in `create_new.js:189-221`. */
	default?: unknown;
	/**
	 * DB type is a Select of `"" | "0".."9"`, so it arrives as a **string**, and
	 * frappe `cint()`s it (`meta.js:353`). But `formatters.js:99`
	 * (`docfield.precision = precision`) writes a **number** back. Both occur.
	 */
	precision?: string | number;
	length?: number;
	/** `frappe/public/js/frappe/model/meta.js:158`, `create_new.js` skip virtual fields. */
	is_virtual?: FrappeCheck;
	not_nullable?: FrappeCheck;
	non_negative?: FrappeCheck;
	fetch_from?: string;
	fetch_if_empty?: FrappeCheck;
	/** JSON string of link query filters. */
	link_filters?: string;
	sort_options?: FrappeCheck;

	/* -- validation / permissions ------------------------------------------ */

	reqd?: FrappeCheckLoose;
	unique?: FrappeCheck;
	set_only_once?: FrappeCheck;
	read_only?: FrappeCheckLoose;
	/** `frappe/public/js/frappe/form/grid.js:1331` → `frm.get_perm(df.permlevel, "read")`. */
	permlevel?: number;
	ignore_user_permissions?: FrappeCheck;
	ignore_xss_filter?: FrappeCheck;
	allow_on_submit?: FrappeCheck;
	allow_bulk_edit?: FrappeCheck;
	no_copy?: FrappeCheck;
	mandatory_depends_on?: string;
	read_only_depends_on?: string;
	search_index?: FrappeCheck;
	mask?: FrappeCheck;
	make_attachment_public?: FrappeCheck;

	/* -- display ----------------------------------------------------------- */

	/**
	 * See {@link FrappeCheckLoose} — frappe's grid writes real booleans here
	 * (`form/grid.js:919`, `:948`) as well as `0 | 1` (`form/grid.js:879`).
	 */
	hidden?: FrappeCheckLoose;
	/** Set by `frappe/public/js/frappe/form/layout.js:728-729` from `depends_on`. */
	hidden_due_to_dependency?: boolean;
	depends_on?: string;
	collapsible?: FrappeCheck;
	collapsible_depends_on?: string;
	bold?: FrappeCheck;
	translatable?: FrappeCheck;
	description?: string;
	show_description_on_click?: FrappeCheck;
	documentation_url?: string;
	placeholder?: string;
	hide_border?: FrappeCheck;
	hide_days?: FrappeCheck;
	hide_seconds?: FrappeCheck;
	alignment?: "" | "Left" | "Center" | "Right";
	button_color?: "" | "Default" | "Primary" | "Info" | "Success" | "Warning" | "Danger";
	/** Both are DB `Data`, i.e. strings like `"120px"` — not numbers. */
	print_width?: string;
	width?: string;
	max_height?: string;
	/**
	 * Grid column span. A value of 1..12 is a legacy Bootstrap span; the grid
	 * translates it through its own px table (`form/grid.js:1334`
	 * `df.colsize = df.columns`).
	 */
	columns?: number;

	/* -- list / search / report -------------------------------------------- */

	in_list_view?: FrappeCheck;
	in_standard_filter?: FrappeCheck;
	in_global_search?: FrappeCheck;
	in_preview?: FrappeCheck;
	in_filter?: FrappeCheck;
	allow_in_quick_entry?: FrappeCheck;
	report_hide?: FrappeCheck;
	print_hide?: FrappeCheck;
	print_hide_if_no_value?: FrappeCheck;
	show_dashboard?: FrappeCheck;
	show_on_timeline?: FrappeCheck;
	remember_last_selected_value?: FrappeCheck;
	/**
	 * Pin the grid column. DB `Check`, but `form/grid_row.js:643` writes
	 * `sticky: $(...).is(":checked") ? 1 : 0` and `:680` writes `cint(...)`.
	 */
	sticky?: FrappeCheckLoose;

	/* -- legacy ------------------------------------------------------------ */

	oldfieldname?: string;
	oldfieldtype?: string;

	/* -- runtime-only (never in the DB) ------------------------------------ */

	/**
	 * Grid column size in Bootstrap spans, computed and CACHED ON THE DF by
	 * `Grid#update_default_colsize` (`form/grid.js:1383-1395`
	 * `df.colsize = colsize;`) and by `Grid#setup_visible_columns`
	 * (`form/grid.js:1334` `df.colsize = df.columns;`).
	 *
	 * Optional on purpose — it really is absent until the grid computes it. TS
	 * cannot see that `update_default_colsize(df)` fills it in, so the frappe
	 * idiom
	 * ```js
	 * let value = df.columns || df.colsize;
	 * if (!value) { this.update_default_colsize(df); value = df.colsize; }
	 * return value <= 12 ? SPAN_PX[value] || 140 : value;   // TS18048
	 * ```
	 * needs one rewrite to compile: read it back with a default —
	 * `const value = df.columns || df.colsize || 140;`.
	 */
	colsize?: number;

	/**
	 * Per-field render override. Assigned by
	 * `frappe.meta.set_formatter` (`model/meta.js:76-78`),
	 * `frappe.meta.set_indicator_formatter` (`model/meta.js:80-92`) and copied
	 * onto grid column dfs by `Grid#setup_visible_columns`
	 * (`form/grid.js:1347-1350`).
	 */
	formatter?: DocFieldFormatter;

	/** Set by `frappe.format` for Dynamic Link resolution (`form/formatters.js:440`). */
	_options?: string | null;

	/** Stamped by `frappe.model.get_default_value` (`model/create_new.js:232`). */
	__default_value?: unknown;

	/**
	 * Child docfields, on a Table/Table MultiSelect df used OUTSIDE a form
	 * (dialogs, standalone grids). `Grid#setup_fields` reads
	 * `this.docfields = this.df.fields` (`form/grid.js:710`).
	 */
	fields?: DocField[];

	/**
	 * Rows for a frm-less grid. `Grid#get_data` (`form/grid.js:789-798`) falls
	 * back to `this.df.data` when `this.frm` is absent, and `form/grid.js:1058`
	 * pushes bare `{ idx, __islocal: true, ...defaults }` objects into it — which
	 * is why {@link GridDataRow} has an optional `name`.
	 */
	data?: GridDataRow[];

	/**
	 * Lazy row/option supplier. Grid calls it with no argument
	 * (`form/grid.js:863-864`, `form/grid_row.js:125-126`); MultiSelect calls it
	 * with the typed text (`form/controls/multiselect_pills.js:142-144`).
	 * May return a promise (multiselect awaits it).
	 */
	get_data?: (txt?: string) => unknown[] | PromiseLike<unknown[]>;

	/**
	 * Grid behaviour switches set by app code onto the TABLE df, never in the DB.
	 * `form/grid.js:246`, `:363`, `:406`, `:658`, `:1027`;
	 * `form/grid_row.js:332`, `:374`.
	 */
	cannot_add_rows?: boolean | FrappeCheck;
	cannot_delete_rows?: boolean | FrappeCheck;
	in_place_edit?: boolean | FrappeCheck;

	/** Grid perm fallback: `form/grid.js:54` `this.control?.perm || this.frm?.perm || this.df.perm`. */
	perm?: DocPerm[];

	/**
	 * Frappe documents are open bags: Custom Fields, Property Setters and app
	 * code all add keys here. `unknown` forces a narrow at the read site.
	 */
	[key: string]: unknown;
}

/**
 * A *partial* docfield descriptor, as frappe synthesises for pseudo-columns.
 *
 * `frappe/public/js/frappe/list/list_view.js:424-429` and `:488-494` push
 * `df: { label: __("ID"), fieldname: "name" }` — no `fieldtype`, no `parent`.
 * `model/model.js:210` returns `{ fieldname: fieldname }` from `get_std_field`
 * when the field is unknown and `ignore` is set.
 *
 * Anything that consumes a docfield defensively (notably
 * {@link FrappeModelNamespace.is_numeric_field}) must accept this shape.
 */
export type PartialDocField = Partial<DocField> & { fieldname: string };

/* -------------------------------------------------------------------------- */
/* Documents                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Every frappe document property, all optional.
 *
 * Split out as an all-optional base so {@link FrappeDoc} can require
 * `name`/`doctype` while {@link GridDataRow} — whose rows may be bare literals —
 * can leave them optional.
 *
 * (`Omit<FrappeDoc, "name">` will not do the job: `keyof` an interface with a
 * string index signature is `string | number`, so `Omit`/`Partial` collapse it to
 * the bare index signature and throw away every named property.)
 *
 * Standard fields from `frappe/public/js/frappe/model/model.js:66-78`
 * (`std_fields_list`) and `:80` (`child_table_field_list`). The `__*` flags are
 * client-side bookkeeping, set by `model/sync.js` and `model/create_new.js`.
 */
export interface FrappeDocBase {
	doctype?: string;

	owner?: string;
	creation?: string;
	modified?: string;
	modified_by?: string;
	/** 0 = draft, 1 = submitted, 2 = cancelled. */
	docstatus?: 0 | 1 | 2;
	idx?: number;

	/* child-row linkage — `model/model.js:80` */
	parent?: string;
	parenttype?: string;
	parentfield?: string;

	/* std "underscore" fields — `model/model.js:66-78` */
	_user_tags?: string;
	_comments?: string;
	_assign?: string;
	_liked_by?: string;

	/* client-side flags */
	/** `model/create_new.js:15` — doc exists only in the browser. */
	__islocal?: FrappeCheckLoose;
	/** `model/create_new.js:16` — dirty. */
	__unsaved?: FrappeCheckLoose;
	/** `model/model.js:535-538` — a virgin child row nobody has touched. */
	__unedited?: boolean;
	/** `model/sync.js:28` — `d.__last_sync_on = new Date();` (a `Date`, not a string). */
	__last_sync_on?: Date;
	/** `model/model.js:168`, `:178` — set when another session changed the doc. */
	__needs_refresh?: boolean;
	/** `model/create_new.js:41`. */
	__run_link_triggers?: FrappeCheckLoose;
	/** `model/create_new.js:51` — the name to save under, for `autoname: prompt`. */
	__newname?: string;
	/** `model/sync.js:38`, `:61-64` — the pre-save local name, echoed back by the server. */
	localname?: string;

	/** See the note on {@link DocField} — documents are open bags. */
	[fieldname: string]: unknown;
}

/**
 * A document as it lives in the global `locals` cache.
 */
export interface FrappeDoc extends FrappeDocBase {
	/**
	 * Always present once the doc is in `locals` —
	 * `model/sync.js:120-133` (`add_to_locals`) assigns
	 * `doc.name = frappe.model.get_new_name(doc.doctype)` before keying it, and
	 * `model/create_new.js:14` sets it at construction.
	 */
	name: string;
	doctype: string;
}

/**
 * A row of a child table, i.e. an element of `parent_doc[parentfield]`.
 *
 * `frappe.model.get_new_doc` (`model/create_new.js:21-29`) always sets
 * `parent`, `parentfield`, `parenttype` and `idx` on a row it creates.
 */
export interface ChildDoc extends FrappeDoc {
	parentfield: string;
	parenttype: string;
	idx: number;

	/**
	 * Grid selection state. Written as the **number** `0 | 1`, never a boolean —
	 * `frappe/public/js/frappe/form/grid_row.js:83`
	 * `this.doc.__checked = checked ? 1 : 0;`. Read as a truthy test in
	 * `form/grid.js:422` and `:428`.
	 */
	__checked?: FrappeCheck;

	/**
	 * Opt a row out of drag-reordering. Compared with strict `=== false`
	 * (`form/grid.js:767`, `form/grid_row.js:166`), so only the literal `false`
	 * has any effect.
	 */
	_sortable?: false;
}

/**
 * An element of `Grid#data` / the `doc` of a `GridRow`.
 *
 * **`name` and `idx` are optional on purpose.** For a grid bound to a form the
 * rows are real {@link ChildDoc}s and both are set, but for a frm-less grid the
 * rows come from `df.data`, and `frappe/public/js/frappe/form/grid.js:1058`
 * pushes `{ idx: row_idx, __islocal: true, ...defaults }` — no `name` at all.
 * That is exactly why both frappe and its consumers backfill with
 * `if (d.name === undefined) d.name = ...`. Declaring `name: string` here would
 * make that guard a TS2367 "no overlap" error while still being wrong at runtime.
 *
 * Once backfilled, narrow with {@link NamedGridDataRow}.
 */
export interface GridDataRow extends FrappeDocBase {
	name?: string;
	/**
	 * Also optional: only a form-bound grid guarantees a `doctype` on its rows.
	 * `form/grid.js:1058` pushes `{ idx, __islocal: true, ...defaults }`.
	 */
	doctype?: string;
	idx?: number;
	__checked?: FrappeCheck;
	_sortable?: false;
}

/**
 * A {@link GridDataRow} after `name`/`idx` have been backfilled — the shape you
 * can safely use as a `Map`/`Record` key or hand to a `getRowId`.
 */
export type NamedGridDataRow = GridDataRow & { name: string; idx: number };

/* -------------------------------------------------------------------------- */
/* DocPerm / DocType child rows                                                */
/* -------------------------------------------------------------------------- */

/** `frappe/core/doctype/docperm/docperm.json`. */
export interface DocPerm {
	role?: string;
	if_owner?: FrappeCheck;
	permlevel?: number;
	read?: FrappeCheck;
	write?: FrappeCheck;
	create?: FrappeCheck;
	delete?: FrappeCheck;
	submit?: FrappeCheck;
	cancel?: FrappeCheck;
	amend?: FrappeCheck;
	report?: FrappeCheck;
	export?: FrappeCheck;
	import?: FrappeCheck;
	share?: FrappeCheck;
	print?: FrappeCheck;
	email?: FrappeCheck;
	select?: FrappeCheck;
	mask?: FrappeCheck;
	[key: string]: unknown;
}

/**
 * One entry of the **evaluated, per-permlevel** permission array that
 * `frappe.perm.get_perm()` returns — NOT a stored DocPerm row (for that see
 * {@link DocPerm}). It is what `frm.perm`, `BaseControl#perm` and `Grid#perm`
 * hold.
 *
 * Source: `frappe/public/js/frappe/model/perm.js:64-127` (`_get_perm`) and
 * `perm.js:130-188` (`get_role_permissions`). The array is indexed by
 * permlevel; `_get_perm` seeds it with `[{ read: 0, permlevel: 0 }]`
 * (perm.js:68) and `get_role_permissions` fills gaps with `{}` (perm.js:165),
 * so **every property except `permlevel` can be missing** and
 * `noUncheckedIndexedAccess` will (correctly) make an indexed read optional.
 *
 * The right names come from `frappe.perm.get_rights(doctype)`
 * (perm.js:41-46) = the 14 fixed rights at perm.js:18-33 PLUS any custom
 * ptypes from `frappe.boot.doctype_ptype_map` (the Permission Type doctype).
 * That extensibility is why the index signature is open rather than a closed
 * union of keys.
 *
 * `rights_without_if_owner` is the odd one out: it is a real `Set<string>`
 * (perm.js:138, 159), present only at permlevel 0, and read at perm.js:95 and
 * perm.js:197. It is included in the index signature's value union so the two
 * declarations stay compatible.
 *
 * SEAM NOTE — this type is imported by `ui/form.d.ts` (`Form#perm`,
 * `BaseControl#perm`) and by `deep-modules.d.ts` (`Grid#perm`), which both used
 * to spell it locally.
 */
export interface Permission {
	/** perm.js:68, 144 — always present; the array index this entry sits at. */
	permlevel: number;
	/** perm.js:68 — the one right `_get_perm` guarantees a slot for. */
	read?: FrappeCheck;
	write?: FrappeCheck;
	create?: FrappeCheck;
	delete?: FrappeCheck;
	submit?: FrappeCheck;
	cancel?: FrappeCheck;
	amend?: FrappeCheck;
	report?: FrappeCheck;
	import?: FrappeCheck;
	export?: FrappeCheck;
	print?: FrappeCheck;
	email?: FrappeCheck;
	share?: FrappeCheck;
	select?: FrappeCheck;
	/**
	 * Permlevel 0 only (perm.js:137-139). The rights granted by a role whose
	 * DocPerm row does NOT have `if_owner` set; consulted at perm.js:95 and
	 * perm.js:197 to decide whether ownership narrows the permission.
	 */
	rights_without_if_owner?: Set<string>;
	/** Custom permission types from the Permission Type doctype (perm.js:42-45). */
	[right: string]: FrappeCheck | number | Set<string> | undefined;
}

/**
 * What `frappe.get_indicator(doc, doctype, show_workflow_state)` returns:
 * `[label, colour]` or `[label, colour, filter]`, where `filter` is a
 * `"fieldname,operator,value"` triple string the list view turns into a filter.
 *
 * Source: `frappe/public/js/frappe/model/indicator.js:26-121` — every `return`
 * in that function is one of these two shapes (`:28` two-element for the unsaved
 * case, `:66`, `:72`, `:76`, and the settings-driven `:37`/`:118` paths
 * three-element). `null` when no indicator applies, which is why callers type it
 * `IndicatorTuple | null | undefined`.
 *
 * SEAM NOTE — `core.d.ts` had this inline on
 * `FrappeListViewSettings.get_indicator` and `views.d.ts` imported the name from
 * here; declared once, here, and imported by both.
 */
export type IndicatorTuple =
	| [label: string, color: FrappeIndicator]
	| [label: string, color: FrappeIndicator, filter: string];

/** `frappe/core/doctype/doctype_link/doctype_link.json`. */
export interface DocTypeLink {
	link_doctype?: string;
	link_fieldname?: string;
	group?: string;
	hidden?: FrappeCheck;
	custom?: FrappeCheck;
	parent_doctype?: string;
	is_child_table?: FrappeCheck;
	table_fieldname?: string;
	[key: string]: unknown;
}

/** `frappe/core/doctype/doctype_action/doctype_action.json`. */
export interface DocTypeAction {
	label?: string;
	group?: string;
	action_type?: "Server Action" | "Route" | (string & {});
	action?: string;
	hidden?: FrappeCheck;
	custom?: FrappeCheck;
	[key: string]: unknown;
}

/** `frappe/core/doctype/doctype_state/doctype_state.json`. */
export interface DocTypeState {
	title?: string;
	color?: string;
	custom?: FrappeCheck;
	[key: string]: unknown;
}

/* -------------------------------------------------------------------------- */
/* DocType meta                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The `__dashboard` payload (`frappe/desk/form/meta.py:234` →
 * `Meta.get_dashboard_data()`), consumed by
 * `frappe/public/js/frappe/form/dashboard.js:249`.
 * The server builds it from each DocType's `<doctype>_dashboard.py`, so the
 * shape is app-defined; only the keys frappe's own dashboard reads are named.
 */
export interface DocTypeDashboardData {
	fieldname?: string;
	non_standard_fieldnames?: Record<string, string>;
	internal_links?: Record<string, string | string[]>;
	transactions?: Array<{ label?: string; items?: string[]; [key: string]: unknown }>;
	[key: string]: unknown;
}

/**
 * A DocType's meta — the DocType document itself, plus the `__*` "sugar" the
 * desk endpoint bolts on.
 *
 * This is what `frappe.get_meta(doctype)` and `locals.DocType[doctype]` return.
 * DB properties are from `frappe/core/doctype/doctype/doctype.json`; the `__*`
 * properties are `ASSET_KEYS` in `frappe/desk/form/meta.py:14-29`, populated by
 * `FormMeta.load_assets()` (`meta.py:56-70`) and serialised by
 * `FormMeta.as_dict()` (`meta.py:72-82`).
 */
export interface DocTypeMeta extends FrappeDoc {
	name: string;
	doctype: string;

	module?: string;
	/** The DocType's own fields. Frappe reads it defensively (`model/model.js:686`
	 * `frappe.get_meta(doctype).fields || []`), so treat an absent value as `[]`. */
	fields: DocField[];
	permissions?: DocPerm[];
	links?: DocTypeLink[];
	actions?: DocTypeAction[];
	states?: DocTypeState[];

	/* -- behaviour flags --------------------------------------------------- */
	is_submittable?: FrappeCheck;
	/** `model/model.js:374` — this DocType is a child table. */
	istable?: FrappeCheck;
	/** `model/model.js:429` — single doctype. */
	issingle?: FrappeCheck;
	/**
	 * Whether rows are editable inline in the grid.
	 * `frappe/public/js/frappe/form/grid.js:62`
	 * `if ((this.meta && this.meta.editable_grid) || !this.meta) return true;`
	 */
	editable_grid?: FrappeCheck;
	quick_entry?: FrappeCheck;
	track_changes?: FrappeCheck;
	track_seen?: FrappeCheck;
	track_views?: FrappeCheck;
	custom?: FrappeCheck;
	beta?: FrappeCheck;
	read_only?: FrappeCheck;
	in_create?: FrappeCheck;
	/** `model/model.js:384`. */
	is_tree?: FrappeCheck;
	is_virtual?: FrappeCheck;
	/** `model/model.js:836` — enables the Calendar and Gantt default views. */
	is_calendar_and_gantt?: FrappeCheck;
	allow_copy?: FrappeCheck;
	allow_rename?: FrappeCheck;
	/** `model/model.js:393` — gates `frappe.model.can_import`. */
	allow_import?: FrappeCheck;
	allow_events_in_timeline?: FrappeCheck;
	allow_auto_repeat?: FrappeCheck;
	allow_guest_to_view?: FrappeCheck;
	has_web_view?: FrappeCheck;
	hide_toolbar?: FrappeCheck;
	index_web_pages_for_search?: FrappeCheck;
	show_preview_popup?: FrappeCheck;
	show_name_in_global_search?: FrappeCheck;
	show_title_field_in_link?: FrappeCheck;
	translated_doctype?: FrappeCheck;
	make_attachments_public?: FrappeCheck;
	protect_attached_files?: FrappeCheck;
	queue_in_background?: FrappeCheck;
	force_re_route_to_default_view?: FrappeCheck;
	email_append_to?: FrappeCheck;
	/** DocType-level bulk-edit switch (distinct from the DocField one). */
	allow_bulk_edit?: FrappeCheck;

	/* -- naming / titles --------------------------------------------------- */
	/** `model/create_new.js:48-50` parses `"field:<fieldname>"` and `"prompt"`. */
	autoname?: string;
	naming_rule?:
		| ""
		| "Set by user"
		| "Autoincrement"
		| "By fieldname"
		| 'By "Naming Series" field'
		| "Expression"
		| (string & {});
	/** `model/model.js:636` — `frappe.model.get_doc_title` prefers this field. */
	title_field?: string;
	image_field?: string;
	timeline_field?: string;
	subject_field?: string;
	sender_field?: string;
	sender_name_field?: string;
	recipient_account_field?: string;
	is_published_field?: string;
	website_search_field?: string;
	search_fields?: string;
	sort_field?: string;
	sort_order?: "ASC" | "DESC";
	default_view?: string;
	default_print_format?: string;
	default_email_template?: string;
	restrict_to_domain?: string;

	/* -- grid / list sizing ------------------------------------------------ */
	/** DocType-level page size for grids; `DocField` itself ships `grid_page_length: 50`. */
	grid_page_length?: number;
	/** Row count above which the grid shows its search row. */
	rows_threshold_for_grid_search?: number;
	max_attachments?: number;

	/* -- misc DB ----------------------------------------------------------- */
	description?: string;
	document_type?: "" | "Document" | "Setup" | "System" | "Other" | (string & {});
	engine?: "InnoDB" | "MyISAM";
	row_format?: "Dynamic" | "Compressed";
	icon?: string;
	color?: string;
	route?: string;
	nsm_parent_field?: string;
	documentation?: string;
	migration_hash?: string;
	field_order?: string[];

	/* -- server-injected sugar (frappe/desk/form/meta.py:14-29) ------------ */

	/** Form client script; `new Function(...)`'d by `form/script_manager.js:182`. */
	__js?: string | null;
	__css?: string | null;
	/** List client script; `new Function(...)`'d by `model/model.js:255-259`. */
	__list_js?: string | null;
	__calendar_js?: string | null;
	__tree_js?: string | null;
	/** Client Script doctype content, `meta.py:178-179`. */
	__custom_js?: string | null;
	__custom_list_js?: string | null;
	/** `Print Format` docs, synced into `locals[":Print Format"]` by `model/sync.js:48-59`. */
	__print_formats?: FrappeDoc[] | null;
	/** Workflow + Workflow State docs; `model/meta.js:24` feeds them to `frappe.model.sync`. */
	__workflow_docs?: FrappeDoc[] | null;
	/**
	 * `fieldname -> HTML template` for grid row templates, from a module's
	 * `form_grid_templates` (`meta.py:222-231`). Read by the Grid constructor:
	 * `form/grid.js:42-46`.
	 */
	__form_grid_templates?: Record<string, string> | null;
	__listview_template?: string | null;
	__dashboard?: DocTypeDashboardData | null;
	__kanban_column_fields?: string[] | null;
	/** `name -> HTML`, merged into `frappe.templates` by `model/model.js:261-263`. */
	__templates?: Record<string, string> | null;
	__workspaces?: string[] | null;
	/** `meta.py:70`. */
	__assets_loaded?: boolean;
	/**
	 * Fieldnames the current user may not see, computed per-user
	 * (`frappe/desk/form/meta.py:80`). `frappe.format` substitutes a plain Data
	 * formatter for these (`form/formatters.js:427-432`).
	 */
	masked_fields?: string[];

	[key: string]: unknown;
}

/* -------------------------------------------------------------------------- */
/* locals                                                                      */
/* -------------------------------------------------------------------------- */

/** One doctype's slice of `locals`: `docname -> doc`. */
export type LocalsDocStore = Record<string, FrappeDoc>;

/**
 * The global `locals` document cache.
 *
 * Bootstrapped by `frappe/public/js/frappe/provide.js:21` (`frappe.provide("locals")`)
 * and `:34` (`frappe.provide("locals.DocType")`), populated by
 * `frappe.model.add_to_locals` (`model/sync.js:120-154`).
 *
 * Two key conventions:
 * - `locals["Task"]["TASK-0001"]` — a real document.
 * - `locals[":Print Settings"]`, `locals[":Print Format"]`, `locals[":User"]` — the
 *   leading colon marks partial docs shipped in `frappe.boot`
 *   (`model/sync.js:48-59`, `model/model.js:472`, `model/create_new.js:239`).
 *
 * The inner records are typed WITHOUT `| undefined`: with `strict` (but not
 * `noUncheckedIndexedAccess`) that matches how frappe's own code reads them after
 * its `locals[dt] && locals[dt][dn]` guard. Missing keys really are `undefined` at
 * runtime — guard before dereferencing, exactly as `model/model.js:453` does.
 */
export interface Locals {
	/** Always provided at boot; holds every loaded {@link DocTypeMeta}. */
	DocType: Record<string, DocTypeMeta>;
	[doctype: string]: LocalsDocStore | undefined;
}

/* -------------------------------------------------------------------------- */
/* docinfo                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The sidebar/timeline payload that rides alongside a `getdoc` response.
 *
 * Keys from `frappe/desk/form/load.py` `get_docinfo()`. Every list element is an
 * app/DB row whose columns vary by installed app, so they are left `unknown`-ish
 * records rather than invented shapes.
 */
export interface DocInfo {
	doctype: string;
	name: string;
	attachments?: FrappeDoc[];
	comments?: FrappeDoc[];
	communications?: FrappeDoc[];
	automated_messages?: FrappeDoc[];
	versions?: FrappeDoc[];
	assignments?: string[];
	permissions?: Record<string, unknown>;
	shared?: FrappeDoc[];
	views?: FrappeDoc[];
	additional_timeline_content?: unknown[];
	milestones?: FrappeDoc[];
	is_document_followed?: boolean;
	tags?: string;
	document_email?: string | null;
	/** Merged into `frappe.boot.user_info` by `model/sync.js:114`. */
	user_info?: Record<string, unknown>;
	[key: string]: unknown;
}

/* -------------------------------------------------------------------------- */
/* frappe.model                                                                */
/* -------------------------------------------------------------------------- */

/** Argument accepted wherever frappe takes "a fieldtype or a docfield". */
export type FieldTypeLike = string | { fieldtype?: string | null } | null | undefined;

/** Filters accepted by `frappe.utils.filter_dict` (`model/model.js:474`). */
export type ModelFilters = Record<string, unknown> | Array<[string, string, unknown]>;

/** Signature of a `frappe.model.on` trigger (`model/model.js:570-599`). */
export type ModelTrigger = (
	fieldname: string,
	value: unknown,
	doc: FrappeDoc,
	skip_dirty_trigger?: boolean,
) => void | PromiseLike<unknown>;

/**
 * `frappe.model.user_settings` — a doctype-keyed cache that ALSO carries methods.
 *
 * `frappe/public/js/frappe/model/user_settings.js:1-49`. The doctype entries are
 * whatever `frappe.model.utils.user_settings.get` returned (`:45`
 * `frappe.model.user_settings[doctype] = r.message;`) plus an `updated_on`
 * timestamp stamped by `model/model.js:241`. The value shape is app-defined —
 * `GridView`, `last_view`, `List`, `Report`, … — so it stays `unknown`.
 */
export interface FrappeModelUserSettings {
	/** Fetches (does not cache) the settings for a doctype. */
	get(doctype: string): Promise<Record<string, unknown>>;
	/** Merges `value` under `key`, PUTs only if it actually changed. */
	save(doctype: string, key: string, value: unknown): Promise<unknown>;
	remove(doctype: string, key: string): Promise<unknown>;
	update(doctype: string, user_settings: Record<string, unknown>): Promise<unknown>;
	/** `frappe.model.user_settings[doctype]` — see the interface note. */
	[doctype: string]: unknown;
}

/**
 * Options for `frappe.model.open_mapped_doc` (`model/create_new.js:325-360`).
 * `frm` is a `frappe.ui.form.Form`, declared in the `frappe-ui-form` group.
 */
export interface OpenMappedDocOptions {
	method: string;
	/** Anything with `.doc` and `.get_selected()`; typed loosely to avoid a cycle. */
	frm?: { doc: FrappeDoc; get_selected(): unknown } | null;
	source_name?: string | null;
	args?: Record<string, unknown> | null;
	freeze_message?: string;
	run_link_triggers?: boolean;
	[key: string]: unknown;
}

/**
 * `frappe.model` — the document/metadata layer.
 *
 * Assembled from four files that all `$.extend`/`Object.assign` onto the same
 * namespace: `model/model.js`, `model/sync.js`, `model/create_new.js`,
 * `model/user_settings.js`.
 *
 * ### On the return type of the ajax-backed methods
 * `with_doctype`, `with_doc`, `set_value` and friends return either a real
 * `Promise` or the jqXHR that `frappe.call` returns (`frappe/public/js/frappe/request.js:31`
 * → `$.ajax`). jQuery 3's jqXHR is Promises/A+ compatible (`.then`, `.catch`,
 * `await`), so they are declared as `Promise<…>`; do not rely on `Promise`-only
 * statics such as `Promise.resolve(x) === x`.
 */
export interface FrappeModelNamespace {
	/* -- fieldtype tables (model/model.js:7-146) --------------------------- */

	/**
	 * Fieldtypes a user can pick in the DocType form. NOT the full enum — the
	 * layout breaks and `Fold` are absent. `model/model.js:7-48`.
	 */
	all_fieldtypes: string[];
	/** Fieldtypes that hold no scalar value. `model/model.js:50-62`. */
	no_value_type: string[];
	/**
	 * `["Section Break", "Column Break", "Tab Break", "Fold"]` —
	 * `model/model.js:64`.
	 *
	 * Declared as a mutable `string[]`, NOT a tuple of literals: every consumer
	 * calls `frappe.model.layout_fields.includes(df.fieldtype)` with a plain
	 * `string`, which a `readonly ["Section Break", …]` tuple would reject.
	 */
	layout_fields: string[];
	/** `model/model.js:66-78`. */
	std_fields_list: string[];
	/** `["parent", "parenttype", "parentfield"]` — `model/model.js:80`. */
	child_table_field_list: string[];
	/** `model/model.js:82-98`. */
	core_doctypes_list: string[];
	/** `model/model.js:100-111`. */
	restricted_fields: string[];
	/** `model/model.js:113-121`. */
	html_fieldtypes: string[];
	/**
	 * Synthetic docfields for the standard columns. `model/model.js:123-140`.
	 * Each has `fieldname`, `fieldtype` and a translated `label` (and `options`
	 * on the two User links) — nothing else, so no `parent`.
	 */
	std_fields: DocField[];
	/** `["Int", "Float", "Currency", "Percent", "Duration"]` — `model/model.js:142`. */
	numeric_fieldtypes: string[];
	/** `[{ fieldname: "parent", fieldtype: "Data", label: __("Parent") }]` — `model/model.js:144`. */
	std_fields_table: DocField[];
	/** `["Table", "Table MultiSelect"]` — `model/model.js:146`. */
	table_fields: string[];

	/* -- caches ------------------------------------------------------------ */

	/** `localname -> server name`, filled after save. `model/sync.js:62`. */
	new_names: Record<string, string>;
	/** `doctype -> fieldname|"*" -> handlers`. `model/model.js:563-567`. */
	events: Record<string, Record<string, ModelTrigger[]>>;
	/** `doctype -> docname -> DocInfo`. `model/sync.js:5`, `:104-118`. */
	docinfo: Record<string, Record<string, DocInfo>>;
	/** See {@link FrappeModelUserSettings}. */
	user_settings: FrappeModelUserSettings;

	/* -- predicates -------------------------------------------------------- */

	/** Subscribes to realtime `doc_update`. `model/model.js:152-183`. */
	init(): void;

	/** `!no_value_type.includes(fieldtype)`. Accepts a df too. `model/model.js:185-191`. */
	is_value_type(fieldtype: FieldTypeLike): boolean;
	/** `model/model.js:193-197`. */
	is_non_std_field(fieldname: string): boolean;

	/**
	 * `model/model.js:823-829`:
	 * ```js
	 * if (!fieldtype) return;                                    // -> undefined
	 * if (typeof fieldtype === "object") fieldtype = fieldtype.fieldtype;
	 * return frappe.model.numeric_fieldtypes.includes(fieldtype);
	 * ```
	 * The bare `return` is why `undefined` is in the return type: passing a
	 * column with no `df` (a Status or Tag list column) yields `undefined`, not
	 * `false`. Both are falsy, so `? :` and `if` sites are unaffected — but a
	 * `=== false` comparison would be wrong.
	 */
	is_numeric_field(fieldtype?: FieldTypeLike): boolean | undefined;

	/* -- doctype loading --------------------------------------------------- */

	/**
	 * Ensures `locals.DocType[doctype]` exists, fetching
	 * `frappe.desk.form.load.getdoctype` if not. `model/model.js:217-247`.
	 *
	 * `async` is passed straight to jQuery's `async` ajax option; passing `false`
	 * makes the request synchronous (deprecated in browsers).
	 */
	with_doctype(
		doctype: string,
		callback?: (r?: { docs: DocTypeMeta[]; user_settings?: string; exc?: string }) => void,
		async?: boolean,
	): Promise<unknown>;

	/** Runs the `__list_js`/`__custom_list_js`/`__calendar_js`/`__tree_js` assets and
	 * merges `__templates`. `model/model.js:249-264`. */
	init_doctype(meta: DocTypeMeta): void;

	/**
	 * Ensures a document (and its docinfo) is loaded. `model/model.js:266-291`.
	 *
	 * Resolves with `frappe.get_doc(doctype, name)`, which returns `null` when
	 * the doctype slice is missing and `undefined` when the docname is. When
	 * `name` is omitted the doctype is treated as a Single (`if (!name) name = doctype;`).
	 */
	with_doc(
		doctype: string,
		name?: string,
		callback?: (name: string, r?: unknown) => void,
	): Promise<FrappeDoc | null | undefined>;

	/* -- docinfo ----------------------------------------------------------- */

	/** `model/model.js:293-295` — returns `null` when absent. */
	get_docinfo(doctype: string, name: string): DocInfo | null;
	/** No-op when the docinfo slot does not exist. `model/model.js:297-301`. */
	set_docinfo(doctype: string, name: string, key: string, value: unknown): void;
	/**
	 * `model/model.js:303-305` — `get_docinfo(...).shared`. **Throws** if there is
	 * no docinfo for the doc, because the source does not guard the `null`.
	 */
	get_shared(doctype: string, name: string): FrappeDoc[] | undefined;

	/* -- naming helpers ---------------------------------------------------- */

	/** `model/model.js:307-312`. */
	get_server_module_name(doctype: string): string;
	/** Slugify: spaces to underscores, lowercased. `model/model.js:314-316`. */
	scrub(txt: string): string;
	/** Inverse-ish of `scrub`: `-`/`_` to spaces, Title Cased. `model/model.js:318-322`. */
	unscrub(txt: string): string;

	/* -- permissions (model/model.js:324-449) ------------------------------ */

	can_create(doctype: string): boolean;
	/** Returns `undefined` when `frappe.boot.user` is not loaded yet (`:328-332`). */
	can_select(doctype: string): boolean | undefined;
	/** Returns `undefined` when `frappe.boot.user` is not loaded yet (`:334-338`). */
	can_read(doctype: string): boolean | undefined;
	can_write(doctype: string): boolean;
	can_get_report(doctype: string): boolean;
	can_delete(doctype?: string): boolean;
	can_submit(doctype?: string): boolean;
	can_cancel(doctype?: string): boolean;
	/** `frm` short-circuits to `frm.perm[0].import === 1` (`:392-400`). */
	can_import(doctype: string, frm?: unknown, meta?: DocTypeMeta | null): boolean;
	can_export(doctype: string, frm?: unknown): boolean;
	can_print(doctype: string | null, frm?: unknown): boolean;
	can_print_doc(frm: unknown): boolean;
	can_email(doctype: string, frm?: unknown): boolean;
	can_share(doctype: string, frm?: unknown): boolean;

	/* -- doctype predicates ------------------------------------------------ */

	/** Truthy row count of active Workflows. `model/model.js:363-365`. */
	has_workflow(doctype: string): number;
	/** Reads `locals.DocType[doctype].is_submittable` — so `0 | 1 | false | undefined`. */
	is_submittable(doctype?: string): FrappeCheck | false | undefined;
	is_table(doctype?: string): FrappeCheck | false | undefined;
	/** Checks `frappe.boot.single_types`. `model/model.js:377-380`. */
	is_single(doctype?: string): boolean;
	is_tree(doctype?: string): FrappeCheck | false | undefined;
	/** True when `__last_sync_on` is under 5s old. `model/model.js:387-390`. */
	is_fresh(doc?: FrappeDoc | null): boolean;

	/* -- values ------------------------------------------------------------ */

	/** `model/model.js:451-469` — for table fields, true iff a child row exists. */
	has_value(dt: string, dn: string, fn: string): boolean;

	/** Filters `locals[doctype]` (falling back to `locals[":"+doctype]`). `model/model.js:471-475`. */
	get_list(doctype: string, filters?: ModelFilters): FrappeDoc[];

	/**
	 * Read one field. `model/model.js:477-504`.
	 *
	 * With a `callback` it goes to the server (`frappe.client.get_value`, which
	 * returns a `{fieldname: value}` **dict** — `frappe/client.py` `get_value`
	 * with `as_dict=True`, `{}` when nothing matched) and returns `undefined`
	 * synchronously. Without one it reads `locals` and returns the value, or
	 * `null` when no row matched.
	 */
	get_value(
		doctype: string,
		filters: string | number | Record<string, unknown>,
		fieldname: string,
	): unknown;
	get_value(
		doctype: string,
		filters: string | number | Record<string, unknown>,
		fieldname: string | string[],
		callback: (message: Record<string, unknown>) => void,
	): void;

	/**
	 * Set one or more values locally and run the field triggers.
	 * `model/model.js:506-551`.
	 *
	 * Two supported shapes: `(doctype, docname, fieldname, value)` and
	 * `(doctype, docname, updates)` where `updates` is a plain object.
	 *
	 * There is a THIRD, doc-first shape in the source that is **broken** — see
	 * `model/model.js:517-521`:
	 * ```js
	 * if ($.isPlainObject(doctype)) { doc = doctype; fieldname = docname; value = fieldname; }
	 * ```
	 * `value = fieldname` runs AFTER `fieldname = docname`, so `value` ends up
	 * equal to `fieldname` rather than the caller's third argument. It only
	 * happens to work when the second argument is an updates object (the `value`
	 * variable is then unused). No in-tree caller uses the doc-first 3-arg form,
	 * and it is not declared here so consumers cannot reach the bug.
	 */
	set_value(
		doctype: string,
		docname: string,
		fieldname: string,
		value: unknown,
		fieldtype?: string,
		skip_dirty_trigger?: boolean,
	): Promise<unknown>;
	set_value(
		doctype: string,
		docname: string,
		updates: Record<string, unknown>,
		value?: undefined,
		fieldtype?: string,
		skip_dirty_trigger?: boolean,
	): Promise<unknown>;
	/** Doc-first form, updates-object only. `model/model.js:517-521`. */
	set_value(doc: FrappeDoc, updates: Record<string, unknown>): Promise<unknown>;

	/** Register a field trigger; `fieldname` may be `"*"`. `model/model.js:553-568`. */
	on(doctype: string, fieldname: string, fn: ModelTrigger): void;
	/** Run the registered triggers serially. `model/model.js:570-599`. */
	trigger(
		fieldname: string,
		value: unknown,
		doc: FrappeDoc,
		skip_dirty_trigger?: boolean,
	): Promise<unknown>;

	/* -- doc access -------------------------------------------------------- */

	/**
	 * `model/model.js:601-609`. `name` may be a filter object, in which case the
	 * first match (or `null`) comes back. Returns `null` when the doctype slice
	 * is missing, `undefined` when only the docname is.
	 * Also aliased as the global `frappe.get_doc` (`model/model.js:869`).
	 */
	get_doc(
		doctype: string,
		name?: string | Record<string, unknown>,
	): FrappeDoc | null | undefined;

	/**
	 * `model/model.js:611-627`. Two shapes:
	 * `(doctype, parent, parentfield, filters?)` and `(doc, parentfield, filters?)`.
	 * Aliased as `frappe.get_children` (`model/model.js:870`).
	 */
	get_children(
		doctype: string,
		parent: string,
		parentfield: string,
		filters?: ModelFilters,
	): ChildDoc[];
	get_children(doc: FrappeDoc, parentfield: string, filters?: ModelFilters): ChildDoc[];

	/** `__("New {0}")` for unsaved docs, else `title_field` or `name`. `model/model.js:629-641`. */
	get_doc_title(doc: FrappeDoc): string;

	/** Deletes every child row from `locals` and empties the array. `model/model.js:643-648`. */
	clear_table(doc: FrappeDoc, parentfield: string): void;
	/** `model/model.js:650-655`. */
	remove_from_locals(doctype: string, name: string): void;
	/** Removes a doc and renumbers its siblings' `idx`. `model/model.js:657-681`. */
	clear_doc(doctype: string, name?: string): void;
	/** Also clears `locals[":"+doctype]`. `model/sync.js:73-78`. */
	delete_from_locals(doctype: string, name: string): void;

	/** `["name","amended_from","amendment_date","cancel_reason"]` plus `no_copy` fields. `model/model.js:683-693`. */
	get_no_copy_list(doctype: string): string[];

	/** Confirms, then calls `frappe.client.delete`. `model/model.js:695-722`. */
	delete_doc(doctype: string, docname: string, callback?: (r: unknown, rt?: unknown) => void): void;
	/** Opens the Rename dialog. `model/model.js:724-778`. */
	rename_doc(doctype: string, docname: string, callback?: (new_name: string) => void): void;
	/** `model/sync.js:80-102`. */
	rename_doc_in_locals(
		doctype: string,
		old_name: string,
		new_name: string,
		merge?: boolean,
	): void;

	/** In-place `flt(..., precision(...))` over Currency/Float fields. `model/model.js:780-793`. */
	round_floats_in(doc: FrappeDoc | null | undefined, fieldnames?: string[]): void;
	/** `frappe.throw`s when the field is falsy. `model/model.js:795-803`. */
	validate_missing(doc: FrappeDoc, fieldname: string): void;

	/**
	 * Flatten a doc and every child row into one array. `model/model.js:805-816`.
	 * Walks own enumerable keys, taking every `Array` whose key does not start
	 * with `_` — so `_comments`-style arrays are skipped but `__islocal` is not
	 * an array anyway. The parent is element 0.
	 */
	get_all_docs(doc: FrappeDoc): FrappeDoc[];

	/** `` `tabDocType`.`fieldname` ``, passthrough if already qualified. `model/model.js:818-821`. */
	get_full_column_name(fieldname: string, doctype: string): string;

	/** Recomputes the DocType form's `default_view` options. `model/model.js:831-865`. */
	set_default_views_for_doctype(doctype: string, frm: unknown): void;

	/* -- std fields -------------------------------------------------------- */

	/**
	 * Look up one of `std_fields` / `std_fields_table`. `model/model.js:199-215`.
	 * When not found: with `ignore` returns `{ fieldname }`; without it
	 * `msgprint`s "Unknown Column" and returns `undefined`.
	 */
	get_std_field(fieldname: string, ignore?: boolean): PartialDocField | undefined;

	/* -- sync (model/sync.js) ---------------------------------------------- */

	/**
	 * Ingest a server response into `locals` + `frappe.model.docinfo`.
	 * `model/sync.js:6-46`. Accepts `{docs, docinfo}`, a bare doc, or an array of
	 * docs (`if (!r.docs && !r.docinfo) r = { docs: r };`). Returns the doc list.
	 */
	sync(
		r: FrappeDoc | FrappeDoc[] | { docs?: FrappeDoc | FrappeDoc[]; docinfo?: DocInfo },
	): FrappeDoc[] | undefined;
	/** Mirrors a Print Format doc into `locals[":Print Format"]`. `model/sync.js:48-59`. */
	sync_print_format_for_meta(doc: FrappeDoc): void;
	/** `model/sync.js:61-71`. */
	rename_after_save(d: FrappeDoc, i: number): void;
	/** `model/sync.js:104-118`. */
	sync_docinfo(r: { docinfo?: DocInfo; docs?: FrappeDoc[] }): FrappeDoc[] | undefined;
	/** Registers a doc and its child rows in `locals`. `model/sync.js:120-154`. */
	add_to_locals(doc: FrappeDoc): void;
	/** Merges server values into the existing local doc rather than replacing it. `model/sync.js:156-241`. */
	update_in_locals(doc: FrappeDoc): void;

	/* -- creation (model/create_new.js) ------------------------------------ */

	/**
	 * Build a new local doc (and push it onto the parent's child table when
	 * `parent_doc` is given). `model/create_new.js:9-71`.
	 */
	get_new_doc(
		doctype: string,
		parent_doc?: FrappeDoc | null,
		parentfield?: string | null,
		with_mandatory_children?: boolean,
	): FrappeDoc;
	/** `model/create_new.js:73-75`. */
	make_new_doc_and_get_name(doctype: string, with_mandatory_children?: boolean): string;
	/** `new-<slugified doctype>-<10 random chars>`. `model/create_new.js:77-80`. */
	get_new_name(doctype: string): string;
	/** Applies docfield/user/session defaults; returns the fieldnames it touched. `model/create_new.js:82-117`. */
	set_default_values(doc: FrappeDoc, parent_doc?: FrappeDoc | null): string[];
	/** Adds one empty row per mandatory Table field. `model/create_new.js:119-129`. */
	create_mandatory_children(doc: FrappeDoc): void;
	/** `model/create_new.js:131-235`. Also stamps `df.__default_value`. */
	get_default_value(df: DocField, doc: FrappeDoc, parent_doc?: FrappeDoc | null): unknown;
	/** `model/create_new.js:237-250`. */
	get_default_from_boot_docs(
		df: DocField,
		doc: FrappeDoc,
		parent_doc?: FrappeDoc | null,
	): unknown;

	/**
	 * Append a child row. `model/create_new.js:252-279`.
	 * Two shapes: `(parent_doc, parentfield)` — the doctype is looked up from the
	 * parent's meta — and `(parent_doc, doctype, parentfield, idx?)`.
	 * A supplied `idx` is inserted as `idx - 0.1` then the table is renumbered.
	 */
	add_child(parent_doc: FrappeDoc, parentfield: string): ChildDoc;
	add_child(
		parent_doc: FrappeDoc,
		doctype: string,
		parentfield: string,
		idx?: number,
	): ChildDoc;

	/** Deep-copy a doc, honouring `no_copy` and skipping Password fields. `model/create_new.js:281-323`. */
	copy_doc(
		doc: FrappeDoc,
		from_amend?: boolean,
		parent_doc?: FrappeDoc | null,
		parentfield?: string | null,
	): FrappeDoc;

	/** Server-side mapper, then routes to the new doc. `model/create_new.js:325-360`. */
	open_mapped_doc(opts: OpenMappedDocOptions): Promise<unknown>;
}

/* -------------------------------------------------------------------------- */
/* frappe.meta                                                                 */
/* -------------------------------------------------------------------------- */

/** `fieldname -> DocField` for one doctype (or one doc's private copy). */
export type DocFieldMap = Record<string, DocField>;

/**
 * `frappe.meta` — the docfield index.
 *
 * Source: `frappe/public/js/frappe/model/meta.js`. All five caches are created by
 * `frappe.provide` at `meta.js:4-8`, so the namespace objects themselves always
 * exist; their per-doctype entries do not.
 */
export interface FrappeMetaNamespace {
	/**
	 * `doctype -> fieldname -> DocField`. `meta.js:4`, populated by
	 * `frappe.meta.add_field` (`meta.js:28-40`):
	 * ```js
	 * frappe.provide("frappe.meta.docfield_map." + df.parent);
	 * frappe.meta.docfield_map[df.parent][df.fieldname || df.label] = df;
	 * ```
	 * Two things to know:
	 * 1. **Both levels can be absent** until the doctype's meta has been synced.
	 *    They are typed without `| undefined` so that the standard
	 *    `if (frappe.meta.docfield_map[dt]) { …[dt][fn]… }` guard compiles under
	 *    `strict` (TS cannot narrow an element access keyed by a non-literal), but
	 *    a missing key really is `undefined` at runtime — always guard, as frappe
	 *    does in `form/grid.js:1341-1350` and `form/formatters.js:28-33`.
	 * 2. The inner key falls back to **`df.label`** when a field has no
	 *    `fieldname` (layout breaks, HTML fields) — `meta.js:30`.
	 */
	docfield_map: Record<string, DocFieldMap>;

	/**
	 * `doctype -> docname -> fieldname -> DocField` — a per-DOCUMENT deep copy so
	 * `set_df_property` on one open form does not leak into another.
	 * `meta.js:5`, built by `make_docfield_copy_for` (`meta.js:42-52`).
	 */
	docfield_copy: Record<string, Record<string, DocFieldMap>>;

	/** `doctype -> DocField[]`, in insertion order, de-duplicated by fieldname. `meta.js:6`, `:32-39`. */
	docfield_list: Record<string, DocField[]>;

	/** Declared by `meta.js:7` but never written anywhere in v16.33.0 — always `{}`. */
	doctypes: Record<string, unknown>;

	/** Declared by `meta.js:8` but never written anywhere in v16.33.0 — always `{}`. */
	precision_map: Record<string, unknown>;

	/**
	 * A frozen deep copy of the DocType doctype's own meta, kept because the
	 * "DocType" entry in `locals.DocType` gets overwritten by the DocType *doc*
	 * when you open the DocType form. `model/model.js:250-254`;
	 * `frappe.get_meta("DocType")` prefers it (`meta.js:11-13`).
	 */
	__doctype_meta?: DocTypeMeta;

	/** Index every field of a DocType meta and sync its print formats / workflows. `meta.js:18-25`. */
	sync(doc: DocTypeMeta): void;

	/** Add one docfield to `docfield_map` + `docfield_list`. `meta.js:28-40`. */
	add_field(df: DocField): void;

	/** Populate `docfield_copy[doctype][docname]`. `meta.js:42-52`. */
	make_docfield_copy_for(doctype: string, docname: string, docfield_list?: DocField[] | null): void;

	/**
	 * `get_docfield`, falling back to `frappe.model.std_fields`. `meta.js:54-69`.
	 * Returns `undefined` (not `null`) when the fallback also misses, because the
	 * `out` variable is left at its `get_docfield` result.
	 */
	get_field(doctype: string, fieldname: string, name?: string): DocField | null | undefined;

	/**
	 * The docfield for `fieldname`, from the per-document copy when `name` is
	 * given, else the shared `docfield_map`. `meta.js:71-74`:
	 * ```js
	 * var fields_dict = frappe.meta.get_docfield_copy(doctype, name);
	 * return fields_dict ? fields_dict[fieldname] : null;
	 * ```
	 * `null` when the doctype is not loaded at all; `undefined` when the doctype
	 * is loaded but has no such field. Callers must handle both — frappe's own
	 * `get_label` does (`meta.js:223-224` `(df ? df.label : "") || fn`).
	 */
	get_docfield(doctype: string, fieldname: string, name?: string): DocField | null | undefined;

	/**
	 * `get_docfield(...).formatter = formatter`. `meta.js:76-78`.
	 * **Throws** if the docfield does not exist — the source does not guard.
	 */
	set_formatter(
		doctype: string,
		fieldname: string,
		name: string | undefined,
		formatter: DocFieldFormatter,
	): void;

	/** Installs a `<span class="indicator ...">` formatter. `meta.js:80-92`. */
	set_indicator_formatter(
		doctype: string,
		fieldname: string,
		name: string | undefined,
		get_text: () => string,
		get_color: () => string,
	): void;

	/** All docfields, `idx`-sorted, optionally filtered. `meta.js:94-104`. */
	get_docfields(
		doctype: string,
		name?: string,
		filters?: ModelFilters,
		docfield_list?: DocField[] | null,
	): DocField[];

	/**
	 * The `options` of every Link field. `meta.js:106-110`.
	 * `$.map` drops the `null`s, so no holes.
	 */
	get_linked_fields(doctype: string): string[];

	/**
	 * Link fields that respect user permissions, plus a synthetic ID entry.
	 * `meta.js:112-118`. NOTE: the body reads the bare global `name`
	 * (`window.name`), not a parameter — a long-standing upstream bug; the
	 * function takes no arguments beyond `doctype`.
	 */
	get_fields_to_check_permissions(doctype: string): PartialDocField[];

	/** `$.map` a docfield dict to an `idx`-sorted array. `meta.js:120-126`. */
	sort_docfields(docs: DocFieldMap | DocField[]): DocField[];

	/**
	 * The docfield dict to read from. `meta.js:128-136`.
	 * With no `name` this is the SHARED `docfield_map[doctype]` (mutating it
	 * affects every open form) and may be `undefined`; with a `name` it is the
	 * per-document copy, created on demand.
	 */
	get_docfield_copy(
		doctype: string,
		name?: string,
		docfield_list?: DocField[] | null,
	): DocFieldMap | undefined;

	/**
	 * Fieldnames matching `filters`. `meta.js:138-145`.
	 * The `name` parameter is accepted but IGNORED — the body reads
	 * `frappe.meta.docfield_map[doctype]` directly.
	 */
	get_fieldnames(doctype: string, name?: string | null, filters?: ModelFilters): string[];

	/**
	 * `meta.js:147-150` — returns the DocField itself (truthy) or `undefined`,
	 * NOT a boolean. `model/create_new.js:62-63` relies on that
	 * (`var df = frappe.meta.has_field(...); if (df && !df.no_copy)`).
	 */
	has_field(dt: string, fn: string): DocField | undefined;

	/**
	 * Table / Table MultiSelect docfields. `meta.js:152-164`.
	 * Virtual tables are skipped unless `include_computed` is set.
	 * `$.map` returns `[]` when `docfield_list[dt]` is missing.
	 */
	get_table_fields(dt: string, include_computed?: boolean): DocField[];

	/** Which doctype (parent or a child table) owns `key`. `null` when nothing matches. `meta.js:166-196`. */
	get_doctype_for_field(doctype: string, key: string): string | null;

	/** The parent's fieldname for a child doctype. **Throws** a string when not found. `meta.js:198-204`. */
	get_parentfield(parent_dt: string, child_dt: string): string;

	/** Translated standard labels, else `df.label`, else the fieldname. `meta.js:206-226`. */
	get_label(dt: string, fn: string, dn?: string): string;

	/** `get_label` run through `__(label, null, dt)` for non-standard fields. `meta.js:228-248`. */
	get_translated_label(dt: string, fn: string, dn?: string): string;

	/** The fixed paper-size list. `meta.js:250-284`. */
	get_print_sizes(): string[];

	/** Print Format names for a doctype, default first. `meta.js:286-315`. */
	get_print_formats(doctype: string): string[];

	/**
	 * Resolve a Currency field's currency. `meta.js:317-348`.
	 * Handles the `Doctype:fieldname:currency_fieldname` triple form of
	 * `df.options`, falls back to `frappe.boot.sysdefaults.currency || "USD"`.
	 */
	get_field_currency(df: DocField | PartialDocField, doc?: FrappeDoc | null): string;

	/** `df.precision`, else the currency/float default. `meta.js:350-366`. */
	get_field_precision(df: DocField | PartialDocField, doc?: FrappeDoc | null): number;
}

/* -------------------------------------------------------------------------- */
/* Grid meta contract                                                          */
/* -------------------------------------------------------------------------- */

/**
 * The two `Grid` members that belong to this group's data model.
 *
 * The `Grid` class itself is declared in the **frappe-ui-form** group; it should
 * `extends`/spread this interface rather than redeclaring these members, so the
 * `DocTypeMeta` type stays single-sourced.
 *
 * Source: the `Grid` constructor, `frappe/public/js/frappe/form/grid.js:22-51`.
 */
export interface GridMetaContract {
	/**
	 * `form/grid.js:25` `this.doctype = this.df.options;` then `:30-32`
	 * ```js
	 * if (this.doctype) {
	 *     this.meta = frappe.get_meta(this.doctype);
	 * }
	 * ```
	 * Genuinely optional on two counts: the assignment is guarded by
	 * `this.doctype`, AND `frappe.get_meta` returns `null` when the doctype has
	 * not been loaded (`model/meta.js:14`
	 * `return locals["DocType"] ? locals["DocType"][doctype] : null;`).
	 *
	 * Frappe's own `allow_on_grid_editing` (`form/grid.js:62`) guards it:
	 * `if ((this.meta && this.meta.editable_grid) || !this.meta)`. Consumers that
	 * dereference it bare — e.g. `this.grid.meta.editable_grid` — need `?.`.
	 */
	meta?: DocTypeMeta | null;

	/**
	 * The grid-row HTML template, or `null`. `form/grid.js:38` initialises it to
	 * `null` unconditionally, then `:40-46` overwrites it from
	 * `this.frm.meta.__form_grid_templates[this.df.fieldname]` when the form's
	 * meta carries one. So it is always PRESENT, and `null` is the normal value —
	 * `string | null`, not optional.
	 */
	template: string | null;
}

/* -------------------------------------------------------------------------- */
/* Namespace roots                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The slice of the `frappe` global this group owns. The package author merges it
 * into the assembled global `frappe` object.
 *
 * `frappe.get_doc` / `get_children` / `get_list` are legacy aliases installed by
 * `model/model.js:869-871`; `frappe.get_meta` is defined at `model/meta.js:10-15`
 * and `frappe.get_user_settings` at `model/user_settings.js:51-57`.
 */
export interface FrappeModelMetaGlobals {
	model: FrappeModelNamespace;
	meta: FrappeMetaNamespace;

	/**
	 * `model/meta.js:10-15`. Returns `null` when `locals.DocType` itself is
	 * missing, and `undefined` when the doctype is simply not loaded — frappe
	 * guards both (`form/formatters.js:429` uses `frappe.get_meta(df.parent)?.…`).
	 * `"DocType"` is special-cased to `frappe.meta.__doctype_meta`.
	 */
	get_meta(doctype: string): DocTypeMeta | null | undefined;

	/**
	 * Alias of {@link FrappeModelNamespace.get_doc} — `model/model.js:869`.
	 *
	 * COLLISION RESOLVED — `FrappeCore` declared `get_doc`/`get_list`/`get_children`
	 * too, with different signatures, which made a composite
	 * `interface Frappe extends FrappeCore, FrappeModelMetaGlobals` a hard TS2320.
	 * This file wins ownership: all three are defined in
	 * `frappe/public/js/frappe/model/model.js` and merely *aliased* onto the root
	 * at `model.js:869-871`, so the model group is where they live. The type
	 * parameter and the notes below were carried over from the `core.d.ts` copy so
	 * nothing was lost in the merge.
	 *
	 * Synchronous `locals` lookup — **no network**; `model.js:601-610`. Three
	 * shapes: `get_doc(doctype, name)`, `get_doc(name)` for single doctypes
	 * (`if (!name) name = doctype`, model.js:602), and `get_doc(doctype, filters)`
	 * which delegates to `frappe.get_list` and returns the **first** match
	 * (model.js:603-607).
	 *
	 * Returns `null` when the doctype bucket is missing and `undefined` when the
	 * bucket exists but the name is not in it — `locals[doctype][name]`
	 * (model.js:608) is an unchecked index. For a server round-trip use
	 * {@link FrappeDb.get_doc} instead.
	 */
	get_doc<T extends FrappeDoc = FrappeDoc>(
		doctype: string,
		name?: string | Record<string, unknown>,
	): T | null | undefined;

	/**
	 * Alias of {@link FrappeModelNamespace.get_children} — `model/model.js:870`.
	 *
	 * Either `(doctype, parent, parentfield, filters?)` or
	 * `(doc, parentfield, filters?)` — the overload is selected at runtime by
	 * `$.isPlainObject(doctype)` (model.js:613). Returns `doc[parentfield] || []`,
	 * so `[]` when the parentfield is empty.
	 */
	get_children<T extends ChildDoc = ChildDoc>(
		doctype: string,
		parent: string,
		parentfield: string,
		filters?: ModelFilters,
	): T[];
	get_children<T extends ChildDoc = ChildDoc>(
		doc: FrappeDoc,
		parentfield: string,
		filters?: ModelFilters,
	): T[];

	/**
	 * Alias of {@link FrappeModelNamespace.get_list} — `model/model.js:871`.
	 *
	 * Filters `locals[doctype]` (falling back to `locals[":" + doctype]` for
	 * singles) in memory — `model.js:471-475`. Returns `[]` when nothing is cached.
	 */
	get_list<T extends FrappeDoc = FrappeDoc>(
		doctype: string,
		filters?: ModelFilters,
	): T[];

	/**
	 * `model/user_settings.js:51-57`. Always returns an object — `{}` when the
	 * doctype (or `key`) has nothing cached. The value shape is view-specific
	 * (`"GridView"`, `"List"`, `"Report"`, …), so it stays open.
	 */
	get_user_settings(doctype: string, key?: string): Record<string, unknown>;
}

/**
 * frappe-types — group `deep-module-imports`
 *
 * Frappe v16.33.0 (`git tag v16.33.0`, branch `version-16`).
 * Source of truth: `apps/frappe/frappe/public/js/frappe/form/`.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS GROUP IS
 * ---------------------------------------------------------------------------
 * Almost the whole desk API is reached through the `frappe` global. Three
 * classes are not: `Grid`, `GridRow` and `GridRowForm` are ES-module DEFAULT
 * exports with no global alias at all, so the only way to subclass them is a
 * deep import of the module file:
 *
 * ```ts
 * import Grid       from "frappe/public/js/frappe/form/grid";
 * import GridRow    from "frappe/public/js/frappe/form/grid_row";
 * import GridRowForm from "frappe/public/js/frappe/form/grid_row_form";
 * ```
 *
 * Verified defaults (nothing else is exported from any of the three):
 *   - grid.js:21          `export default class Grid {`
 *   - grid_row.js:9       `export default class GridRow {`
 *   - grid_row_form.js:1  `export default class GridRowForm {`
 *   - grid_pagination.js:1 `export default class GridPagination {`  (not imported
 *     directly by any consumer, but it is the type of `Grid#grid_pagination`, so
 *     it has to be declared here.)
 *
 * grid.js additionally has TOP-LEVEL SIDE EFFECTS: importing it defines
 * `frappe.ui.form.get_open_grid_form` (grid.js:7) and
 * `frappe.ui.form.close_grid_form` (grid.js:11), and the module reads/writes
 * `frappe.ui.form.editable_row` (grid.js:16). Those three live in the
 * `frappe-ui-form` group; they are named here only so the coupling is on record.
 *
 * ---------------------------------------------------------------------------
 * HOW THE SPECIFIER RESOLVES
 * ---------------------------------------------------------------------------
 * esbuild (frappe/esbuild/esbuild.js:92-97, 327) sets
 *
 *   nodePaths: [ ...<apps>/<app>/node_modules, ...<apps>/<app> ]
 *
 * i.e. every app's REPO ROOT is a NODE_PATH root. So the bare specifier
 * `frappe/public/js/frappe/form/grid` is looked up as
 * `<apps>/frappe` + `/frappe/public/js/frappe/form/grid` →
 * `apps/frappe/frappe/public/js/frappe/form/grid.js`. (The doubled `frappe/` is
 * real: the repo root is `apps/frappe`, the python package is `apps/frappe/frappe`.)
 *
 * TypeScript has no `nodePaths`. It sees a bare, non-package specifier and
 * fails with TS2307 unless the typeset supplies an AMBIENT module declaration:
 *
 *   declare module "frappe/public/js/frappe/form/grid" { … }
 *
 * That declaration CANNOT live in this file. Two hard TypeScript constraints,
 * both verified against tsc 7.0.2:
 *
 *   1. `declare module "x"` inside a file that is itself a module (this file has
 *      top-level `import`/`export`) is parsed as a module AUGMENTATION, not as a
 *      new ambient module. The consumer still gets TS2307.
 *   2. Inside an ambient module declaration, `import ... from "./relative"` is
 *      TS2439 ("Import or export declaration in an ambient module declaration
 *      cannot reference module through relative module name"). The re-export has
 *      to use a NON-relative specifier — i.e. the package's own name.
 *
 * The wiring therefore ships as a sibling SCRIPT-context `.d.ts` (no top-level
 * import/export), reproduced verbatim in the design notes and written alongside
 * this file as `deep-module-imports.ambient.d.ts`:
 *
 * ```ts
 * declare module "frappe/public/js/frappe/form/grid" {
 *     import { Grid } from "frappe-types/deep-modules";
 *     export default Grid;
 *     export { Grid };
 * }
 * ```
 *
 * ---------------------------------------------------------------------------
 * HOW LAZY INITIALISATION IS MODELLED  (read this before filing a bug)
 * ---------------------------------------------------------------------------
 * frappe assigns most instance fields lazily — in `make()`, `refresh()`,
 * `setup_fields()` or `make_head()` — not in the constructor. Between
 * `new Grid(...)` and the first `refresh()` many of them really are `undefined`.
 *
 * Rule used here: a field is declared NON-OPTIONAL when it is guaranteed to
 * exist once `refresh()` has completed once, and every documented entry point
 * (an overridden method, an event handler, an engine callback) runs after that.
 * A field carries `| undefined` only when it can still be missing AFTER a full
 * refresh. Every field's TSDoc names the line that assigns it, so the phase is
 * always visible. This is a deliberate, documented trade — not an oversight.
 *
 * ---------------------------------------------------------------------------
 * `JQuery`
 * ---------------------------------------------------------------------------
 * Used unqualified as the AMBIENT GLOBAL type. It is not imported from
 * `./globals-jquery` because a `declare global` interface cannot be imported by
 * name, and carbon_frappe's tsconfig pins `"types": ["frappe-types/global"]`,
 * which means frappe-types is the only thing that can put `JQuery` in scope at
 * all. If the package instead EXPORTS the type, change the reference to
 * `import type { JQuery } from "./globals";` — see design notes.
 *
 * @packageDocumentation
 */

// IMPORT-NAME FIXES — five of these six names were guesses that no module ever
// exported (TS2305/TS2724). Corrected against the owning fragments' export
// lists: `ChildDoc` lives in `./model`, not `./core`; `ui/form.d.ts` names its
// classes `BaseControl` (guessed as "FormControl"), `Form` (guessed as
// "FrappeForm") and `Layout` (guessed as "FrappeLayout"); `Dialog` is now
// genuinely declared there. No declaration changed — only the names used to
// reach them.
import type {
	ChildDoc,
	DocField,
	DocFieldFormatter,
	DocPerm,
	DocTypeMeta,
	FrappeCheckLoose,
	Permission,
} from "./model";
// §6.12 — the non-empty-region alias; `globals.d.ts` owns the jQuery surface.
import type { JQueryRegion } from "./globals";
import type {
	BaseControl,
	ControlTable,
	Dialog,
	Form,
	Layout,
} from "./ui/form";

/* ===========================================================================
 * Shared shapes
 * =========================================================================*/

/**
 * The value `frappe.utils.debounce` returns (utils.js:893-919).
 *
 * The wrapper forwards `this` and every argument, returns `undefined`, and
 * carries a `cancel()` that reports whether a pending call was actually dropped
 * (utils.js:910-916).
 *
 * If the `frappe-utils-dom-router` group ends up exporting a `Debounced<T>`,
 * delete this and import that one instead.
 */
export interface Debounced<TArgs extends readonly unknown[] = []> {
	(...args: TArgs): void;
	/** `false` when there was no pending call to cancel (utils.js:911). */
	cancel(): boolean;
}

/**
 * A handler passed to jQuery's `.on("click", …)`.
 *
 * The event object is jQuery's normalised event, NOT a DOM `Event`. It is typed
 * `unknown` so this fragment depends only on the `JQuery` object type and not on
 * the `JQuery.*` event namespace; narrow it at the call site if you need it.
 */
export type JQueryClickHandler = (event: unknown) => unknown;

/**
 * The sortablejs instance stored on `Grid#grid_sortable` (grid.js:753).
 *
 * `Sortable` is a bare GLOBAL in frappe (no import in grid.js or grid_row.js —
 * it comes from the libs bundle). sortablejs is not part of the desk API, so only
 * the surface frappe's grid code touches is declared.
 */
export interface GridSortable {
	/** grid_row.js:296, 962 — `option("disabled", …)` freezes dragging while a column filter is active. */
	option(name: string, value?: unknown): unknown;
	destroy(): void;
}

/**
 * A docfield as the grid sees it: the stored DocField plus the properties the
 * grid itself reads or writes at runtime.
 *
 * All of these are verified assignments/reads in grid.js or grid_row.js. They are
 * declared here rather than on `DocField` because they are grid-local behaviour,
 * not schema.
 */
export interface GridDocField extends DocField {
	/** grid.js:152-154 — called once at the end of `Grid#make()` with the grid. */
	on_setup?: (grid: Grid) => void;
	/** grid.js:245-246, 373, 406, 1027 — suppresses "Add row"/"Duplicate". */
	cannot_add_rows?: boolean | 0 | 1;
	/** grid.js:363; grid_row.js:1497 — suppresses "Delete". */
	cannot_delete_rows?: boolean | 0 | 1;
	/** grid_row.js:332, 374 — no open-form button and no Configure-Columns gear. */
	in_place_edit?: boolean | 0 | 1;
	/**
	 * grid.js:513 — grid rendered inside a Web Form; `display_status` then comes
	 * from `control.get_status()` (grid.js:514). Also read by
	 * `controls/base_control.js:56`.
	 *
	 * §2b UNION FIX — this copy had `0 | 1`, `ui/form.d.ts` had `boolean | 0 | 1`.
	 * `ui/form.d.ts` was right and is kept: `web_form/webform_script.js:61` and
	 * `:76` assign a real `true`, never `1`. Spelled with
	 * {@link FrappeCheckLoose}, which `model.d.ts` declares for exactly this —
	 * a checkbox slot that JS also writes as a boolean.
	 */
	is_web_form?: FrappeCheckLoose;
	/** grid.js:187, 194 — renders a `?` link next to the label. */
	documentation_url?: string;
	/**
	 * The row array for a grid with NO `frm` (dialogs, web forms):
	 * grid.js:796, 1049-1058, 302-303, 314. Mutated in place by `Grid#delete_rows`
	 * and `GridRow#remove` (grid_row.js:128-141), so never replace it with a copy.
	 */
	data?: ChildDoc[];
	/** grid.js:863; grid_row.js:125-126 — alternative row source, filtered by `Grid#deleted_docs`. */
	get_data?: () => ChildDoc[];
	/** grid.js:1059 — called with the 1-based idx of a row appended to `df.data`. */
	on_add_row?: (idx: number) => void;
	/**
	 * Bootstrap column span (1-12) computed by `Grid#update_default_colsize`
	 * (grid.js:1394) and written back onto the docfield. `df.columns` wins when set
	 * (grid.js:1333-1334).
	 */
	colsize?: number;
	/**
	 * Pin the column to the left. NOT a stored DocField property — it arrives from
	 * the per-user GridView setting (grid.js:1411) and is read at grid_row.js:1008.
	 */
	sticky?: 0 | 1;
	/**
	 * Inherited from the parent doctype's docfield for Link fields
	 * (grid.js:1340-1350) so a custom formatter survives into the child table.
	 */
	formatter?: DocFieldFormatter;
}

/**
 * One active column filter, keyed by fieldname in `Grid#filter`.
 *
 * Built at grid_row.js:952-955 (a column's search input) and grid_row.js:286-289
 * (the row-index input, whose `df` is the synthetic `{ fieldtype: "Sr No" }` at
 * grid_row.js:282-284 — a fieldtype that exists nowhere else in frappe).
 * Consumed at grid.js:806-811.
 */
export interface GridFilter {
	df: GridDocField;
	/** Raw input value; `Grid#get_filtered_data` lowercases it before matching (grid.js:809). */
	value: string;
}

/**
 * A bag of control properties merged onto the real control later.
 *
 * `Grid#get_field(fieldname)` lazily creates one (grid.js:1004) purely so app code
 * has somewhere to hang `get_query` before the control exists; it is then copied
 * onto the on-grid control (grid_row.js:1252) and `$.extend`-ed onto the grid form's
 * control (grid_row_form.js:31-33). Genuinely open — the source only ever names
 * `get_query`, but nothing restricts it.
 */
export interface GridFieldInfo {
	/**
	 * The only key frappe itself ever names. Copied onto the on-grid control at
	 * grid_row.js:1252 (`field.get_query = this.grid.get_field(df.fieldname).get_query`),
	 * onto the bulk-edit dialog's docfield at grid.js:1259-1260
	 * (`if (grid_field?.get_query) new_df.get_query = grid_field.get_query`), and
	 * `$.extend`-ed onto the grid form's control at grid_row_form.js:30-33.
	 *
	 * `unknown`, not a call signature: frappe only ever forwards this value, it
	 * never invokes it here, and the Link-control contract it eventually reaches
	 * accepts several arities (`get_query(cb, doc, cdt, cdn)` — grid.js:1177).
	 * Narrow at the call site.
	 *
	 * §2b UNION FIX — restored from `ui/form.d.ts`'s copy, which named it; this
	 * copy had only the index signature. No type widened (the index signature
	 * already resolved `get_query` to `unknown`) — what was lost was the
	 * documentation that this is the one member the source knows about.
	 */
	get_query?: unknown;
	[property: string]: unknown;
}

/**
 * A rendered grid cell: the `div.col.grid-static-col` jQuery object from
 * `GridRow#make_column` (grid_row.js:1075-1163) with the expandos frappe stamps
 * onto it. This is what `GridRow#columns` and `GridRow#columns_list` hold.
 *
 * NOTE the cells built by `make_search_column` (grid_row.js:933-935) are plain
 * `JQuery` — they carry none of these expandos and are stored separately in
 * `GridRow#search_columns`.
 */
export interface GridColumn extends JQuery {
	/** grid_row.js:1147 — the docfield this cell renders. */
	df: GridDocField;
	/** grid_row.js:1148 — index into `Grid#visible_columns`. */
	column_index: number;
	/** grid_row.js:1138 — holds the live control while the row is editable; hidden otherwise. */
	field_area: JQuery;
	/** grid_row.js:1139 — holds the formatted read-only text. */
	static_area: JQuery;
	/** grid_row.js:1286 — set by `make_control`; absent until the row is first activated. */
	field?: BaseControl;
	/** base_input.js:284 sets this from control validation; read at grid_row.js:773. */
	is_invalid?: boolean;
}

/**
 * One row of the Configure Columns dialog / the stored GridView user setting.
 * Built at grid_row.js:431-435 and 508-512, saved at grid_row.js:710-712.
 */
export interface GridColumnSetting {
	fieldname: string;
	/** Column width. Legacy values are Bootstrap spans 1-12 (grid_row.js:642). */
	columns: number;
	sticky?: 0 | 1;
}

/**
 * An option for the MultiCheck field in the "Add / Remove Columns" dialog
 * (grid_row.js:549-553, 564-568).
 */
export interface GridFieldChoice {
	label: string;
	value: string;
	checked: boolean;
}

/**
 * A child-table row as the grid annotates it.
 *
 * These four flags are added by grid code at runtime and are not part of the
 * stored document.
 */
export interface GridChildDoc extends ChildDoc {
	/** Selection state. Written 0/1 by `GridRow#select` (grid_row.js:83); read by `Grid#get_selected*` (grid.js:422, 428). */
	__checked?: 0 | 1;
	/** grid.js:1045 — set on a freshly appended row. */
	__unedited?: boolean;
	/** Explicitly `false` disables drag-reorder for this row (grid.js:767; grid_row.js:166). */
	_sortable?: false;
}

/* ===========================================================================
 * "frappe/public/js/frappe/form/grid" — default export
 * =========================================================================*/

/**
 * Constructor options for {@link Grid}.
 *
 * The constructor is `constructor(opts) { $.extend(this, opts); … }`
 * (grid.js:22-23), so EVERY key of `opts` lands on the instance verbatim. The
 * index signature records that; keys beyond the four named ones are untyped.
 *
 * The canonical call site is `frappe.ui.form.ControlTable#make`
 * (controls/table.js:8-13).
 */
export interface GridOptions {
	/** The Table docfield. `df.options` names the child DocType and becomes `Grid#doctype` (grid.js:25). */
	df: GridDocField;
	/** Where `make()` appends the grid markup (grid.js:129-130). jQuery in every in-tree call site. */
	parent: JQuery | HTMLElement;
	/** Absent for grids outside a form — dialogs, web forms, `MultiSelectDialog`. Most of `Grid` branches on it. */
	frm?: Form;
	/** The owning `frappe.ui.form.ControlTable`; supplies `perm` (grid.js:54) and `get_status()` (grid.js:514). */
	control?: ControlTable;
	/** `$.extend(this, opts)` (grid.js:23) copies any other key straight onto the instance. */
	[key: string]: unknown;
}

/**
 * frappe's child-table grid — `frappe/public/js/frappe/form/grid.js`, default export.
 *
 * Designed to be SUBCLASSED: `frappe.ui.form.ControlTable#make` is the only place
 * that constructs it (controls/table.js:8), so replacing the grid means patching
 * that one method and constructing your subclass instead.
 *
 * @see grid.js:21
 */
export declare class Grid {
	constructor(opts: GridOptions);

	// ---------------------------------------------------------------- from opts

	/** The Table docfield. REASSIGNED on every `refresh()` by `setup_fields()` (grid.js:691-703) — do not cache it. */
	df: GridDocField;
	/** grid.js:129-130, and the target of most `$(this.parent).find(...)` lookups. */
	parent: JQuery | HTMLElement;
	/** Absent outside a form. */
	frm?: Form;
	/** Absent unless constructed by `ControlTable`. */
	control?: ControlTable;

	// -------------------------------------------------------- set in constructor

	/** grid.js:24 — see {@link GridFieldInfo}. */
	fieldinfo: Record<string, GridFieldInfo>;
	/** `this.df.options` (grid.js:25) — the child DocType. `undefined` when the docfield names none. */
	doctype: string | undefined;
	/** grid.js:27 — running left offset (px) used when laying out sticky columns. */
	sticky_row_sum: number;
	/**
	 * Left offset (px) per pinned column, keyed by fieldname.
	 *
	 * DISCREPANCY: initialised as an ARRAY (`this.sticky_rows = []`, grid.js:28) but
	 * used only as a string-keyed map — grid_row.js:1010 (`df.fieldname in …`),
	 * 1011 (assignment), 1012 (`Object.keys`), 1016 (read). Typed as the map it is.
	 */
	sticky_rows: Record<string, number>;
	/** `frappe.get_meta(this.doctype)` (grid.js:31); absent when `doctype` is. */
	meta?: DocTypeMeta;
	/** fieldname → docfield, rebuilt on every `setup_fields()` (grid.js:33, 716-718). */
	fields_map: Record<string, GridDocField>;
	/**
	 * Grid-LOCAL `hidden` overrides set by `set_column_disp_in_list_view`
	 * (grid.js:37, 895). Deliberately not written back onto the shared
	 * `frappe.meta` docfield, so two grids of the same child doctype on one form
	 * stay independent (grid.js:34-36, 738-745).
	 */
	column_disp_overrides: Record<string, 0 | 1>;
	/** The custom render template from `frm.meta.__form_grid_templates[df.fieldname]` (grid.js:38, 45); rendered at grid_row.js:226. */
	template: string | null;
	/** grid.js:39, 1456 — guards `set_multiple_add` against double-binding. */
	multiple_set: boolean;
	/** Active column filters, keyed by fieldname plus the literal key `"row-index"` (grid_row.js:286). grid.js:47. */
	filter: Record<string, GridFilter>;
	/** grid.js:48 — the duck-type marker other desk code checks for. */
	readonly is_grid: true;
	/** `refresh` debounced by 100ms (grid.js:49-50). Every `toggle_*`/`set_column_disp` path ends here. */
	debounced_refresh: Debounced;
	/** Class field, grid.js:400-403. NOTE it is NOT bound — it is `frappe.utils.debounce(this.refresh_remove_rows_button, 100)`, and `debounce` forwards `this` from the call site (utils.js:902), so it only works when invoked as `grid.debounced_refresh_remove_rows_button()`. Called that way at grid_row.js:89. */
	debounced_refresh_remove_rows_button: Debounced;
	/** Class field, grid.js:416-419. Same `this`-forwarding caveat as above. */
	debounced_duplicate_rows_button: Debounced;

	// -------------------------------------------------------------- set in make()

	/**
	 * The `.grid-field` root — `$(template).appendTo(this.parent)` (grid.js:129).
	 *
	 * A {@link JQueryRegion}, not a plain `JQuery`: it is built from a literal
	 * template string, so `wrapper[0]` / `wrapper.get(0)` never need a `!`.
	 * Also REQUIRED, not optional (gaps.md §5.3): `refresh()` guards with
	 * `!this.wrapper && this.make()` (grid.js:502), so by the time any caller
	 * holds a rendered grid it is set. `.find(...)` off it is still a plain
	 * possibly-empty `JQuery`.
	 */
	wrapper: JQueryRegion;
	/** `.form-grid` — the element a replacement renderer takes over (grid.js:136). */
	form_grid: JQuery;
	/** label → button, for `add_custom_button` (grid.js:142, 1591-1597). */
	custom_buttons: Record<string, JQuery>;
	/** `.grid-buttons` (grid.js:143). */
	grid_buttons: JQuery;
	/** `.grid-custom-buttons` — the `position: "top"` slot (grid.js:144). */
	grid_custom_buttons: JQuery;
	/** `.grid-remove-rows` (grid.js:145). */
	remove_rows_button: JQuery;
	/** `.grid-edit-rows` (grid.js:146). */
	edit_rows_button: JQuery;
	/** `.grid-duplicate-rows` (grid.js:147). */
	duplicate_rows_button: JQuery;
	/** `.grid-remove-all-rows` (grid.js:148). */
	remove_all_rows_button: JQuery;
	/** grid.js:200. */
	grid_pagination: GridPagination;

	// ------------------------------------------------- set in refresh()/make_head()

	/** `Object.keys(this.filter).length !== 0` (grid.js:499). */
	filter_applied: boolean;
	/**
	 * The rows currently being rendered (grid.js:500).
	 *
	 * DISCREPANCY: `get_filtered_data()` returns `undefined` when the underlying
	 * array is missing (grid.js:804), so `this.data` CAN be `undefined` for one
	 * refresh on a filtered, dataless grid — after which grid.js:536, 552, 644
	 * would throw. That is a latent upstream bug; the field is declared as an array
	 * because every other path guarantees one and typing it nullable would force
	 * guards on code that upstream itself does not guard.
	 */
	data: GridChildDoc[];
	/** grid.js:508-518. `"None"` short-circuits the rest of `refresh()` (grid.js:520). */
	display_status: "Write" | "Read" | "None";
	/** The previous `display_status` (grid.js:548). */
	last_display_status: "Write" | "Read" | "None";
	/** grid.js:549. */
	last_docname: string | undefined;
	/** All child docfields, after the mask and column-disp overrides (grid.js:707-714). */
	docfields: GridDocField[];
	/**
	 * Rows for the CURRENT page, indexed by ABSOLUTE row index.
	 *
	 * SPARSE by design: `delete this.grid_rows[i]` clears every slot outside the
	 * page (grid.js:638-642), which is why upstream itself writes
	 * `if (!row) continue` (grid.js:1616) and `this.grid_rows[i]?.` (grid.js:1642).
	 */
	grid_rows: Array<GridRow | undefined>;
	/** docname → row, rebuilt from scratch on every refresh (grid.js:531, 611). */
	grid_rows_by_docname: Record<string, GridRow>;
	/** The header GridRow — `configure_columns: true, header_row: true` (grid.js:450-458). */
	header_row: GridRow;
	/** The filter GridRow — `show_search: true` (grid.js:460-467). */
	header_search: GridRow;
	/** `[docfield, colspan]` pairs; the colspan is a Bootstrap 1-12 span (grid.js:1353, redistributed at 1358-1380). */
	visible_columns: Array<[GridDocField, number]>;
	/** Column order/width from the per-user GridView setting; empty when none (grid.js:1307, 1402-1415). */
	user_defined_columns: GridDocField[];
	/** grid.js:545. */
	sortable_setup_done: boolean;
	/** grid.js:753 — only created when `is_sortable()` and not already set up. */
	grid_sortable: GridSortable;

	// ------------------------------------------------------ set by callers, not here

	/**
	 * Set by app code to render an explicit column list and bypass the
	 * `in_list_view` filter (grid.js:1313, 1329). Never assigned inside grid.js.
	 */
	editable_fields?: GridDocField[];
	/** Suppresses header rebuilds while a search keystroke re-renders (grid.js:444; set at grid_row.js:302-304). */
	prevent_build?: boolean;
	/** Anchor for shift-click range selection (grid.js:230-234). */
	last_checked_docname?: string;
	/** docnames to exclude from `get_modal_data()` (grid.js:865). Set by `MultiSelectDialog`-style callers. */
	deleted_docs?: string[];
	/** Grid-level (rather than docfield-level) "Add row" suppression (grid.js:245, 373, 657, 1027). */
	cannot_add_rows?: boolean;
	/** Set by `only_sortable()` (grid.js:1430) — rows may be reordered but not edited. */
	static_rows?: boolean;
	/** Set by `only_sortable()` (grid.js:1429). */
	sortable_status?: boolean;
	/** The open row's form, set by `GridRowForm#render` (grid_row_form.js:38). */
	open_grid_row?: GridRowForm;

	// ---------------------------------------------------------------- accessors

	/**
	 * `this.control?.perm || this.frm?.perm || this.df.perm` (grid.js:53-55).
	 *
	 * One entry per permlevel, each a map of right → 0|1 plus `permlevel`
	 * (perm.js:68 shows the shape: `[{ read: 0, permlevel: 0 }]`; the right names
	 * come from `frappe.perm.get_rights`, perm.js:18-46, and are extensible via
	 * the Permission Type doctype — hence {@link Permission}'s open index
	 * signature).
	 *
	 * SEAM RESOLUTION (§2b `perm` divergence) — the two `Grid` copies disagreed:
	 * this one spelled the element type inline as
	 * `Record<string, 0 | 1 | number>`; `ui/form.d.ts` used
	 * `readonly perm: Permission[]`. The MERGE of what each got right is kept:
	 * - the ACCESSOR form from HERE, because grid.js:53-58 really is a getter
	 *   WITH a setter (the setter console.errors and discards), so `readonly`
	 *   was wrong;
	 * - the ELEMENT TYPE from THERE, because `model.d.ts`'s {@link Permission} is
	 *   the single source for this shape — its own SEAM NOTE names `Grid#perm`
	 *   as one of the three holders, alongside `Form#perm` and
	 *   `BaseControl#perm`. The inline `Record` was not assignable FROM
	 *   `Permission[]` (whose `rights_without_if_owner?: Set<string>` is outside
	 *   the `0 | 1 | number` value union), so `grid.perm = frm.perm` did not
	 *   type-check against the old spelling.
	 *
	 * `DocPerm[]` is in the union because the third fallback branch reads
	 * `this.df.perm`, which `model.d.ts:427` types `DocPerm[]` with that exact
	 * `grid.js:54` citation. `undefined` is in the union because all three
	 * branches are optional — a grid with no `control`, no `frm` and no
	 * `df.perm` (the dialog and Web Form case) genuinely has none.
	 */
	get perm(): Permission[] | DocPerm[] | undefined;
	/** Assigning only logs an error; the value is discarded (grid.js:57-59). */
	set perm(value: Permission[] | DocPerm[] | undefined);

	// ------------------------------------------------------------------ methods

	/** `true` when the child doctype has `editable_grid`, or when there is no meta at all (grid.js:61-67). */
	allow_on_grid_editing(): boolean;
	/** Builds the whole `.grid-field` scaffold and caches every button handle (grid.js:69-155). Idempotent only via `refresh()`'s `!this.wrapper && this.make()` guard (grid.js:502). */
	make(): void;
	set_grid_description(): void;
	/** Fills in missing `idx`/`name` on `this.data` (grid.js:165-174). */
	update_idx_and_name(): void;
	/** An 8-char base-36 id for rows that have no `name` yet (grid.js:176-178). */
	get_random_name(): string;
	set_doc_url(): void;
	setup_grid_pagination(): void;
	setup_check(): void;
	/**
	 * (Un)check every row between two docnames inclusive. No-ops when either
	 * docname is not on the current page (grid.js:277).
	 * @see grid.js:272
	 */
	check_range(docname1: string, docname2: string, checked?: boolean): void;
	duplicate_rows(): void;
	delete_rows(): void;
	delete_all_rows(): void;
	scroll_to_top(): void;
	/** `this.grid_rows_by_docname[name].select()` — throws if `name` is not on the current page (grid.js:353). */
	select_row(name: string): void;
	remove_all(): void;
	/** Shows/hides Delete, Duplicate and "Delete all N rows" from the checkbox state (grid.js:362-386). */
	refresh_remove_rows_button(): void;
	refresh_edit_rows_button(): void;
	refresh_duplicate_rows_button(): void;
	/** Docnames of checked rows (grid.js:421-423). */
	get_selected(): string[];
	/** The checked rows themselves (grid.js:425-433). */
	get_selected_children(): GridChildDoc[];
	/** Drops `visible_columns` and `grid_rows`, removes the row DOM, then refreshes (grid.js:435-441). */
	reset_grid(): void;
	/** Rebuilds `header_row` and `header_search` (grid.js:443-476). Early-returns on `prevent_build`. */
	make_head(): void;
	update_search_columns(): void;
	/** The full render cycle (grid.js:496-559). Ends by triggering `"change"` on `wrapper`. */
	refresh(): void;
	/**
	 * Reconciles GridRow instances against `this.data` by DOC OBJECT IDENTITY and
	 * reorders the DOM from the first mismatch (grid.js:561-647).
	 *
	 * `$rows` is optional: `refresh()` passes it (grid.js:534) but
	 * `GridPagination#go_to_page` calls it with NO argument (grid_pagination.js:153),
	 * in which case the base implementation re-finds `.rows` itself (grid.js:562-564).
	 * An override that forwards `$rows` on to `new GridRow({ parent: $rows })` must
	 * handle the `undefined` case.
	 */
	render_result_rows($rows?: JQuery | undefined): void;
	setup_toolbar(): void;
	/** Re-resolves `df` and `docfields` from `frappe.meta`, then applies the column-disp and masked-field overrides (grid.js:687-719). */
	setup_fields(): void;
	/** Renders `meta.masked_fields` as read-only Data on a COPY of each docfield (grid.js:721-732). */
	_apply_mask_overrides(): void;
	/** Applies `column_disp_overrides` onto a COPY of each docfield (grid.js:734-746). */
	_apply_column_disp_overrides(): void;
	refresh_row(docname: string): void;
	/** Binds sortablejs to `$rows`; `$rows.get(0)` must exist (grid.js:752-787). */
	make_sortable($rows: JQuery): void;
	/** Unfiltered: `frm.doc[df.fieldname]`, else `df.data`, else `get_modal_data()` (grid.js:794-796). */
	get_data(): GridChildDoc[];
	/** Filtered: delegates to `get_filtered_data()`, which returns `undefined` when there is no source array (grid.js:804). */
	get_data(filter_field: boolean | undefined): GridChildDoc[] | undefined;
	/** `undefined` when neither `frm.doc[df.fieldname]` nor `df.data` exists (grid.js:801-814). */
	get_filtered_data(): GridChildDoc[] | undefined;
	/**
	 * The per-fieldtype filter predicate (grid.js:816-860).
	 *
	 * Returns the row itself on a match, `undefined` on a miss, and — for `Check`
	 * only — the boolean `Boolean(fieldvalue) === value && data` (grid.js:823).
	 * Used as an `Array#filter` callback, so only truthiness is ever consumed.
	 */
	get_data_based_on_fieldtype(
		df: GridDocField,
		data: GridChildDoc,
		value: string | boolean
	): GridChildDoc | boolean | undefined;
	/** `df.get_data()` minus `deleted_docs`; `[]` when `df.get_data` is absent (grid.js:862-870). */
	get_modal_data(): GridChildDoc[];
	/** Mutates the SHARED `frappe.meta` docfield (grid.js:879) — see `set_column_disp_in_list_view` for the grid-local variant. */
	set_column_disp(fieldname: string | string[], show: boolean): void;
	/** Grid-local column hiding; never touches the shared docfield (grid.js:886-909). */
	set_column_disp_in_list_view(fieldname: string | string[], show: boolean): void;
	set_editable_grid_column_disp(fieldname: string, show: boolean): void;
	toggle_reqd(fieldname: string, reqd: boolean | 0 | 1): void;
	toggle_enable(fieldname: string, enable: boolean | 0 | 1): void;
	toggle_display(fieldname: string, show: boolean | 0 | 1): void;
	toggle_checkboxes(enable: boolean): void;
	/** `frappe.meta.get_docfield(...)` — `undefined` for a fieldname the child doctype does not have (grid.js:978-984). */
	get_docfield(fieldname: string): GridDocField | undefined;
	/** A number indexes `grid_rows` (negative counts from the end); a string indexes `grid_rows_by_docname` (grid.js:986-996). */
	get_row(key: number | string): GridRow | undefined;
	/** Alias for {@link Grid.get_row} (grid.js:998-1000). */
	get_grid_row(key: number | string): GridRow | undefined;
	/** Lazily creates and returns the `fieldinfo` bag — never `undefined` (grid.js:1002-1006). */
	get_field(fieldname: string): GridFieldInfo;
	set_value(fieldname: string, value: unknown, doc?: GridChildDoc | undefined): void;
	setup_add_row(): void;
	/**
	 * Appends (or inserts at `idx`) a child row (grid.js:1026-1083).
	 *
	 * Returns the new doc ONLY on the `frm` path — the non-form branch pushes a
	 * plain object onto `df.data` and falls out with `d` still `undefined`
	 * (grid.js:1049-1061, 1081). Also returns `undefined` when the grid is not
	 * editable or rows cannot be added (grid.js:1028).
	 */
	add_new_row(
		idx?: number | null,
		callback?: (() => void) | null | undefined,
		show?: boolean,
		copy_doc?: GridChildDoc | false | null,
		go_to_last_page?: boolean,
		go_to_first_page?: boolean
	): GridChildDoc | undefined;
	/** Re-derives `idx` from DOM order after a drag (grid.js:1085-1101). */
	renumber_based_on_dom(): void;
	/** Copies every field of `copy_doc` onto `d` except the 9 identity/audit fields (grid.js:1103-1123). */
	duplicate_row(d: GridChildDoc, copy_doc: GridChildDoc): GridChildDoc;
	/** Opens the bulk-edit dialog; no-ops unless `meta.allow_bulk_edit` (grid.js:1125-1288). */
	bulk_edit_rows(): void;
	/** Defaults to the LAST row when `idx` is omitted (grid.js:1290-1293). */
	set_focus_on_row(idx?: number | undefined): void;
	/** Populates `visible_columns`; returns immediately if it is already non-empty (grid.js:1304-1305). */
	setup_visible_columns(): void;
	/** Writes `df.colsize` — 3 for Small Text, 1 for Check, 2 otherwise (grid.js:1383-1395). */
	update_default_colsize(df: GridDocField): void;
	setup_user_defined_columns(): void;
	is_editable(): boolean;
	is_sortable(): boolean;
	/** No argument means `true` (grid.js:1428). */
	only_sortable(status?: boolean | undefined): void;
	/** @param link fieldname of the Link field the selector picks; @param qty fieldname the quantity is written to. */
	set_multiple_add(link: string, qty: string): void;
	setup_allow_bulk_edit(): void;
	setup_download(): void;
	/** Creates the button on first call, un-hides it afterwards; keyed by `label` (grid.js:1588-1602). */
	add_custom_button(
		label: string,
		click: JQueryClickHandler,
		position?: "top" | "bottom"
	): JQuery;
	clear_custom_buttons(): void;
	/** THROWS a string (not an Error) if any rendered row lacks the fieldname (grid.js:1622). */
	update_docfield_property(fieldname: string, property: string, value: unknown): void;
	/** Index into `grid_rows` of the row containing `target`, or `null` (grid.js:1639-1647). */
	get_current_row(target: Node): number | null;
}

/* ===========================================================================
 * "frappe/public/js/frappe/form/grid_row" — default export
 * =========================================================================*/

/**
 * Constructor options for {@link GridRow}.
 *
 * `$.extend(this, opts)` again (grid_row.js:13), and the constructor calls
 * `this.make()` before it returns (grid_row.js:19) — so a subclass's `make()`
 * runs before any of the subclass's own field initialisers do.
 *
 * The three in-tree call shapes are grid.js:450-458 (header), grid.js:460-467
 * (filter row) and grid.js:601-608 (a data row).
 */
export interface GridRowOptions {
	/** Where `make()` appends the row (grid_row.js:53). Required — the base `make()` dereferences it unconditionally. */
	parent: JQuery;
	/** The parent Table docfield; `parent_df.options` is the child DocType (grid_row.js:57-59). */
	parent_df: GridDocField;
	/** Column docfields. Replaced by a doc-specific set in `set_docfields()` when `doc` is present (grid_row.js:56-65). */
	docfields: GridDocField[];
	/** The grid that owns this row. */
	grid: Grid;
	/** Absent on the header and filter rows. */
	doc?: GridChildDoc;
	frm?: Form;
	/** Header row only — adds the Configure Columns gear (grid_row.js:375). */
	configure_columns?: boolean;
	/** Header row only — makes `row_check` non-tabbable (grid_row.js:245-247). */
	header_row?: boolean;
	/** Filter row only — builds search inputs instead of data cells (grid_row.js:234, 266). */
	show_search?: boolean;
	/** `$.extend(this, opts)` (grid_row.js:13) copies any other key onto the instance. */
	[key: string]: unknown;
}

/**
 * One row of a child-table grid — `frappe/public/js/frappe/form/grid_row.js`,
 * default export. Also used, without a `doc`, as the header row and the filter row.
 *
 * @see grid_row.js:9
 */
export declare class GridRow {
	/** Calls `this.make()` before returning (grid_row.js:19). */
	constructor(opts: GridRowOptions);

	// ---------------------------------------------------------------- from opts

	parent: JQuery;
	parent_df: GridDocField;
	/** Doc-specific docfields once `set_docfields()` has run (grid_row.js:58-63). */
	docfields: GridDocField[];
	grid: Grid;
	/** Absent on the header and filter rows; re-read from `locals` on every `refresh()` (grid_row.js:191). */
	doc?: GridChildDoc;
	frm?: Form;
	/** Header row flag. NOTE: on {@link Grid}, `header_row` is a GridRow; here it is a boolean. */
	header_row?: boolean;
	configure_columns?: boolean;
	/**
	 * Filter-row flag. `show_search_row()` OVERWRITES it with the result of its own
	 * threshold test (grid_row.js:909-911), so after that call it can also be
	 * `undefined`.
	 */
	show_search?: boolean;

	// -------------------------------------------------------- set in constructor

	/** fieldname → live control, filled by `make_control` (grid_row.js:11, 1287). */
	on_grid_fields_dict: Record<string, BaseControl>;
	/** grid_row.js:12, 1288 — same controls in creation order. */
	on_grid_fields: BaseControl[];
	/** fieldname → rendered cell (grid_row.js:15, 1150). Stays EMPTY on the filter row. */
	columns: Record<string, GridColumn>;
	/** grid_row.js:16, 1151 — same cells in column order. */
	columns_list: GridColumn[];
	/** The checkbox markup; rewritten with `tabindex="-1"` for the header row (grid_row.js:17, 246). */
	row_check_html: string;
	/** 20 — the fallback for `meta.rows_threshold_for_grid_search` (grid_row.js:18, 905-908). */
	default_rows_threshold_for_grid_search: number;

	// ------------------------------------------------------------ set in make()

	/**
	 * `div.grid-row` — `$('<div class="grid-row"></div>')` (grid_row.js:25).
	 * Carries `.data("grid_row", this)` (grid_row.js:68-71).
	 *
	 * A {@link JQueryRegion} (literal template), so `wrapper[0]` is an element.
	 */
	wrapper: JQueryRegion;
	/**
	 * `div.data-row.row.m-0` inside `wrapper` —
	 * `$('<div class="data-row row m-0"></div>').appendTo(this.wrapper)`
	 * (grid_row.js:26). `.appendTo` returns the same set, so this is a
	 * {@link JQueryRegion} too.
	 */
	row: JQueryRegion;

	// ------------------------------------------------ set in render_row/render_template

	/** `.row-check` gutter cell (grid_row.js:249, 267). */
	row_check: JQuery;
	/** `.row-index` gutter cell — the row number, or the index search input (grid_row.js:255, 272). */
	row_index: JQuery;
	/** Template-rendered body; only for grids with `grid.template` (grid_row.js:223). */
	row_display?: JQuery;
	/**
	 * The open-form button.
	 *
	 * REASSIGNED mid-method: created as the outer `div.col` (grid_row.js:335), then
	 * overwritten with the inner `.btn-open-row` (grid_row.js:343) unless
	 * `configure_columns` is set. The outer cell is then reachable only via
	 * `.parent()` — which is what grid_row.js:1533 and the global `escape` handler
	 * (grid_row.js:366-368) rely on.
	 */
	open_form_button?: JQuery;
	/** The Configure Columns gear cell; header row only (grid_row.js:376, 386). */
	configure_columns_button?: JQuery;

	// ------------------------------------------------------ set in setup_columns()

	/** grid_row.js:726. */
	focus_set: boolean;
	/** fieldname → search cell. Plain `JQuery`, NOT {@link GridColumn} (grid_row.js:727, 947). */
	search_columns: Record<string, JQuery>;

	// --------------------------------------------- set by the Configure Columns dialog

	/** grid_row.js:393. */
	grid_settings_dialog?: Dialog;
	/** grid_row.js:429, 496, 636, 700 — the dialog's working copy of the column list. */
	selected_columns_for_grid?: GridColumnSetting[];
	/** The dialog's HTML-field wrapper ELEMENT (not a jQuery object) — grid_row.js:440. */
	fields_html_wrapper?: HTMLElement;

	// ------------------------------------------------------------- set in show_form()

	/** grid_row.js:1478. Persists after `hide_form()` — only its wrapper is hidden (grid_row.js:1528). */
	grid_form?: GridRowForm;

	/**
	 * NEVER ASSIGNED. `evaluate_depends_on_value` passes `this.doctype` and
	 * `this.docname` to `script_manager.trigger` for `fn:` expressions
	 * (grid_row.js:886-890), but nothing in grid.js or grid_row.js ever sets either.
	 * Declared so the read type-checks; both are `undefined` at runtime unless an
	 * app puts them in `opts`.
	 */
	doctype?: string;
	/** See {@link GridRow.doctype}. */
	docname?: string;

	// ------------------------------------------------------------------ methods

	/** Builds `wrapper`/`row`, renders, and appends to `parent` (grid_row.js:21-54). Called BY THE CONSTRUCTOR. */
	make(): void;
	/** Re-reads `docfields` for this specific doc; no-ops without `doc` (grid_row.js:56-65). */
	set_docfields(): void;
	/** Stashes `{ grid_row: this, doc }` on `wrapper` via `.data()` (grid_row.js:67-72) — this is what `$(".grid-row-open").data("grid_row")` reads. */
	set_data(): void;
	/** Writes `data-name`, `data-idx` and the visible row number (grid_row.js:73-81). */
	set_row_index(): void;
	/** Writes `doc.__checked` as 0/1 (grid_row.js:82-84). Called with no argument by `Grid#select_row`. */
	select(checked?: boolean | 0 | 1 | undefined): void;
	refresh_check(): void;
	/** Removes the row from the model and refreshes the grid; no-ops when the grid is read-only (grid_row.js:91-146). */
	remove(): void;
	/** @param below insert AFTER this row rather than before it; @param duplicate copy this row's values. */
	insert(show?: boolean | undefined, below?: boolean | undefined, duplicate?: boolean | undefined): void;
	/** Prompts for a target row number and reorders (grid_row.js:154-188). */
	move(): void;
	/** Re-reads `doc` from `locals` and re-renders (grid_row.js:189-204). */
	refresh(): void;
	render_template(): void;
	/**
	 * Builds the gutters and cells (grid_row.js:233-320).
	 *
	 * Returns `true`, or `undefined` when a filter row decides not to render
	 * (grid_row.js:234). DISCREPANCY: the `refresh` parameter is declared
	 * (grid_row.js:233) and passed by `refresh()` (grid_row.js:197) but never read
	 * in the body.
	 */
	render_row(refresh?: boolean | undefined): true | undefined;
	make_editable(): void;
	/** `row.width() < 300` (grid_row.js:326-328). */
	is_too_small(): boolean;
	/** Creates the trailing open-form cell; no-ops without `doc`, or when `df.in_place_edit` (grid_row.js:330-371). */
	add_open_form_button(): void;
	add_column_configure_button(): void;
	configure_dialog_for_columns_selector(): void;
	setup_columns_for_dialog(): void;
	prepare_wrapper_for_columns(): void;
	column_selector_for_dialog(): void;
	select_all_columns(docfields: GridFieldChoice[]): void;
	prepare_columns_for_dialog(selected_fields: string[]): GridFieldChoice[];
	render_selected_columns(): void;
	prepare_handler_for_sort(): void;
	sort_columns(): void;
	select_on_focus(): void;
	update_column_width(): void;
	update_sticky_column(): void;
	remove_selected_column(): void;
	update_user_settings_for_grid(): void;
	reset_user_settings_for_grid(): void;
	/**
	 * Builds every cell for this row (grid_row.js:725-810).
	 *
	 * Ends by latching `.column-limit-reached` on `.form-grid-container` whenever
	 * the column spans total more than 10 (grid_row.js:782-783) — the horizontal
	 * scroll hack. An override that hands out real pixel widths must undo it.
	 */
	setup_columns(): void;
	/**
	 * Button columns show their control even in an idle row (grid_row.js:816-824).
	 *
	 * Returns `undefined` rather than `false` when `this.doc` is absent, because
	 * `this.doc` is the second-to-last operand of the `&&` chain (grid_row.js:821).
	 */
	should_show_button_in_idle_grid_cell(column: GridColumn): boolean | undefined;
	/** Prefers the row's own docfield, copying `sticky`/`in_list_view` across (grid_row.js:826-836). */
	get_column_docfield(fields: GridDocField[], fieldname: string): GridDocField | undefined;
	/** Evaluates `depends_on`/`mandatory_depends_on`/`read_only_depends_on` onto `df`; returns whether anything changed (grid_row.js:838-851). */
	set_dependant_property(df: GridDocField): boolean;
	refresh_dependency(): void;
	/**
	 * Evaluates one depends-on expression (grid_row.js:867-901).
	 *
	 * Accepts a boolean, a function, an `eval:` string, a `fn:` string, or a bare
	 * fieldname. The result is whatever the expression produced — coerced to
	 * boolean only for the bare-fieldname branch — hence `unknown`. Returns
	 * `undefined` immediately when the row has no `doc` (grid_row.js:871).
	 */
	evaluate_depends_on_value(
		expression: string | boolean | ((doc: GridChildDoc) => unknown)
	): unknown;
	/**
	 * Decides whether the filter row is shown, and REMOVES `this.wrapper` when it
	 * is not (grid_row.js:912) — which is why `search_columns` is empty on a small
	 * grid. Also OVERWRITES `this.show_search` (grid_row.js:909).
	 */
	show_search_row(): boolean | undefined;
	/** A plain `div.col.grid-static-col.search` holding one input — no `df`/`static_area` expandos (grid_row.js:916-979). */
	make_search_column(df: GridDocField, colsize: number): JQuery;
	/** The real data cell, with all the expandos (grid_row.js:981-1164). */
	make_column(df: GridDocField, colsize: number, txt: string, ci: number): GridColumn;
	activate(): this;
	/**
	 * Swaps static areas for live controls (grid_row.js:1171-1230).
	 *
	 * Returns the literal `false` from the "made editable" branch (grid_row.js:1196)
	 * so a jQuery click handler can cancel the event; the other branch returns
	 * nothing.
	 */
	toggle_editable_row(show?: boolean | undefined): false | undefined;
	/** Instantiates the cell's control; no-ops if one already exists (grid_row.js:1232-1289). Requires `this.doc`. */
	make_control(column: GridColumn): void;
	set_arrow_keys(field: BaseControl): void;
	duplicate_row_using_keys(): void;
	/** Reads `metaKey`/`ctrlKey`/`which` (grid_row.js:1403-1404). */
	add_new_row_using_keys(e: KeyboardEvent): void;
	/** `$(".grid-row-open").data("grid_row")` via `frappe.ui.form.get_open_grid_form` (grid.js:7-9). */
	get_open_form(): GridRow | undefined;
	/**
	 * Open or close this row's detail form (grid_row.js:1435-1471).
	 *
	 * Returns `this` when there is no `doc` (grid_row.js:1437) or after
	 * showing/hiding (grid_row.js:1470), and `undefined` on the "already open"
	 * short-circuit (grid_row.js:1457). `show` defaults to "open unless some other
	 * row is open" (grid_row.js:1448).
	 *
	 * EXACTLY TWO PARAMETERS, deliberately (gaps.md §4.4). The verify phase
	 * suggested adding an optional third, `opts?: { modal?: boolean }`, because
	 * carbon_frappe's `CarbonGridRow` overrides this with a 3-arg signature
	 * (`tables/grid/grid_row.js:188`) and calls it 3-arg from
	 * `tables/grid/row_menu.js:80`. It is NOT added here: `grid_row.js:1435` is
	 * `toggle_view(show, callback)` and the body never reads an `arguments[2]`,
	 * so declaring the parameter would claim frappe honours an option it
	 * silently discards — the kind of compiling lie this package exists to
	 * prevent. Note also that frappe RE-ENTERS this method 2-arg when closing a
	 * different row (`grid_row.js:1460` `open_row.toggle_view(false)`), so a
	 * subclass must not depend on a third argument arriving.
	 *
	 * The override needs no declaration change: TypeScript lets an override ADD
	 * optional parameters, so a subclass declaring
	 * `override toggle_view(show?: boolean, callback?: (() => void) | null, opts?: { modal?: boolean }): this | undefined`
	 * stays assignable to this base, and 3-arg calls through the SUBCLASS type
	 * check. That is where the option belongs — it is the subclass's, not
	 * frappe's.
	 */
	toggle_view(show?: boolean | undefined, callback?: (() => void) | null | undefined): this | undefined;
	/** Builds {@link GridRowForm} on first use, freezes the desk, scrolls the row into view (grid_row.js:1472-1514). */
	show_form(): void;
	/** UNCONDITIONALLY calls `frappe.dom.unfreeze()` (grid_row.js:1520) — balance it if you suppressed the matching freeze. */
	hide_form(): void;
	has_prev(): boolean;
	open_prev(): void;
	has_next(): boolean;
	open_next(): void;
	/** `undefined` when the index is out of range (grid_row.js:1552). */
	open_row_at_index(row_index: number): true | undefined;
	change_page_if_reqd(row_index: number): void;
	/** HTML-escapes the six plain-text fieldtypes before `frappe.format` (grid_row.js:1576-1589); passes anything else through. */
	_escape_for_format(value: unknown, df: GridDocField | undefined): unknown;
	/** Reformats one cell and refreshes its control (grid_row.js:1591-1640). `txt` is recomputed when there is a doc. */
	refresh_field(fieldname: string, txt?: string | undefined): void;
	/** THROWS a string when the fieldname is in neither the on-grid controls nor the grid form (grid_row.js:1648). */
	get_field(fieldname: string): BaseControl;
	/** Requires `grid.frm` — dereferences `me.grid.frm.get_perm` unguarded (grid_row.js:1658). */
	get_visible_columns(blacklist?: string[]): GridDocField[];
	set_field_property(fieldname: string, property: string, value: unknown): void;
	toggle_reqd(fieldname: string, reqd: boolean | 0 | 1): void;
	toggle_display(fieldname: string, show: boolean | 0 | 1): void;
	toggle_editable(fieldname: string, editable: boolean | 0 | 1): void;
}

/* ===========================================================================
 * "frappe/public/js/frappe/form/grid_row_form" — default export
 * =========================================================================*/

/** Constructor options for {@link GridRowForm} — `$.extend(this, opts)`, grid_row_form.js:3. */
export interface GridRowFormOptions {
	row: GridRow;
	/** `$.extend(this, opts)` copies any other key onto the instance. */
	[key: string]: unknown;
}

/**
 * The expanded detail form for one grid row —
 * `frappe/public/js/frappe/form/grid_row_form.js`, default export.
 *
 * CONSTRUCTOR SIDE EFFECT: it immediately appends `div.form-in-grid` to
 * `opts.row.wrapper` (grid_row_form.js:4). Anything that wants the form somewhere
 * else must construct it first and relocate `wrapper` before calling
 * `GridRow#show_form()`, because `show_form()` only builds one if `grid_form` is
 * still unset (grid_row.js:1477).
 *
 * @see grid_row_form.js:1
 */
export declare class GridRowForm {
	constructor(opts: GridRowFormOptions);

	/** From opts. */
	row: GridRow;
	/** `div.form-in-grid`, appended to `row.wrapper` by the constructor (grid_row_form.js:4). */
	wrapper: JQuery;
	/** Built on the first `render()` (grid_row_form.js:12-23). */
	layout?: Layout;
	/** `layout.fields` (grid_row_form.js:25). */
	fields?: GridDocField[];
	/** `layout.fields_dict` (grid_row_form.js:26). */
	fields_dict?: Record<string, BaseControl>;
	/** `.form-area`, created by `make_form()` (grid_row_form.js:83). */
	form_area?: JQuery;
	/** Set by `set_active_tab` (grid_row_form.js:133). */
	active_tab?: unknown;

	/** Builds the form (if needed), rebuilds the Layout, and copies `grid.fieldinfo` onto the controls (grid_row_form.js:6-41). */
	render(): void;
	/** Idempotent — only builds when `form_area` is unset (grid_row_form.js:43). */
	make_form(): void;
	set_form_events(): void;
	/** Shows/hides the row-action buttons under `$parent` from `grid.is_editable()` (grid_row_form.js:120-122). */
	toggle_add_delete_button_display($parent: JQuery): void;
	/** No-ops for an unknown fieldname (grid_row_form.js:125). */
	refresh_field(fieldname: string): void;
	/**
	 * Called by `frappe.ui.form.Tab` as `layout.grid_row_form.set_active_tab?.(this)`
	 * (tab.js:113). Only `tab.df` is read (grid_row_form.js:141), so the parameter is
	 * typed structurally rather than pulling the Tab class in.
	 */
	set_active_tab(tab: { df?: DocField | undefined } | null | undefined): void;
	/** Focuses the first non-date input, 500ms later (grid_row_form.js:147-165). */
	set_focus(): void;
}

/* ===========================================================================
 * "frappe/public/js/frappe/form/grid_pagination" — default export
 * =========================================================================*/

/** Constructor options for {@link GridPagination} — `$.extend(this, opts)`, grid_pagination.js:3. */
export interface GridPaginationOptions {
	grid: Grid;
	/** The grid's `.grid-field` root; the pager is rendered into its `.grid-pagination` (grid_pagination.js:17). */
	wrapper: JQuery;
	[key: string]: unknown;
}

/**
 * The grid's pager — `frappe/public/js/frappe/form/grid_pagination.js`,
 * default export. Constructed by `Grid#setup_grid_pagination` (grid.js:200).
 *
 * Not deep-imported by any consumer, but it is the type of
 * `Grid#grid_pagination`, whose `page_index`, `page_length` and
 * `get_result_length()` drive every row-windowing override.
 *
 * @see grid_pagination.js:1
 */
export declare class GridPagination {
	/** Calls `setup_pagination()` before returning (grid_pagination.js:4). */
	constructor(opts: GridPaginationOptions);

	grid: Grid;
	wrapper: JQuery;

	/** `meta.grid_page_length` or 50 (grid_pagination.js:8). */
	page_length: number;
	/**
	 * 1-based page number (grid_pagination.js:9).
	 *
	 * DISCREPANCY: the `focusout` handler assigns the input's raw STRING value
	 * (grid_pagination.js:80) before the numeric comparisons on the next two lines,
	 * so at runtime this is briefly a string. Declared `number` because that is the
	 * contract every reader assumes (grid.js:224, 569; grid_row.js:1559).
	 */
	page_index: number;
	/** `ceil(grid.data.length / page_length)` (grid_pagination.js:10, 102). */
	total_pages: number;

	/** Only assigned when the pager is actually rendered — i.e. when `data.length > page_length` (grid_pagination.js:16-26). */
	prev_page_button?: JQuery;
	/** See {@link GridPagination.prev_page_button}. */
	next_page_button?: JQuery;
	/** See {@link GridPagination.prev_page_button}. */
	first_page_button?: JQuery;
	/** See {@link GridPagination.prev_page_button}. */
	last_page_button?: JQuery;
	/** The editable page-number input (grid_pagination.js:23). */
	$page_number?: JQuery;
	/** See {@link GridPagination.prev_page_button}. */
	$total_pages?: JQuery;

	setup_pagination(): void;
	/** Empties `.grid-pagination` entirely when there is only one page (grid_pagination.js:16-17). */
	render_pagination(): void;
	bind_pagination_events(): void;
	inc_dec_number(increment: boolean): void;
	update_page_numbers(): void;
	check_page_number(): void;
	get_pagination_html(): JQuery;
	render_next_page(): void;
	render_prev_page(): void;
	/**
	 * Re-renders the current page. Omitting `index` keeps `page_index` as-is
	 * (grid_pagination.js:148-152); `from_refresh` suppresses the scroll-to-top.
	 *
	 * Calls `grid.render_result_rows()` with NO arguments (grid_pagination.js:153).
	 */
	go_to_page(index?: number | undefined, from_refresh?: boolean | undefined): void;
	go_to_last_page_to_add_row(): void;
	/** `min(data.length, page_index * page_length)` — the exclusive end of the current page (grid_pagination.js:178-182). */
	get_result_length(): number;
}

/* ===========================================================================
 * frappe/node_utils.js — the ONE deep import on the Node side
 * =========================================================================*/

/**
 * The minimum of a `@redis/client` v4 client that frappe's `get_redis_subscriber`
 * hands back.
 *
 * frappe pins `@redis/client: ^1.5.8` (frappe/package.json), i.e. node-redis v4,
 * where every command returns a promise. Declared structurally so frappe-types
 * does not take a dependency on `@redis/client`; if you have those types, prefer
 * `RedisClientType`.
 */
export interface RedisClientLike {
	connect(): Promise<unknown>;
	quit(): Promise<unknown>;
	del(key: string | string[]): Promise<number>;
	[command: string]: unknown;
}

/**
 * The bench configuration merged from `config.json`, `sites/common_site_config.json`
 * and the `FRAPPE_*` environment overrides (node_utils.js:17-57).
 *
 * Only `socketio_port` is guaranteed — it is the sole default (node_utils.js:20).
 * The named keys below are the ones the function itself can set; everything else
 * comes straight out of the JSON, hence the index signature.
 */
export interface FrappeBenchConf {
	socketio_port: number | string;
	default_site?: string;
	redis_cache?: string;
	redis_queue?: string;
	socketio_uds?: string;
	[key: string]: unknown;
}

/**
 * `apps/frappe/node_utils.js` — a COMMONJS module
 * (`module.exports = { get_conf, get_redis_subscriber }`, node_utils.js:76-79;
 * frappe/package.json has no `"type"` field, so `.js` there is CJS).
 *
 * There is no useful ambient `declare module` for it: the only known consumer
 * loads it through `createRequire(<frappe>/package.json)("./node_utils.js")`, a
 * runtime specifier TypeScript never sees. Annotate the require instead:
 *
 * ```ts
 * const req = createRequire(path.join(benchRoot, "apps", "frappe", "package.json"));
 * const { get_redis_subscriber } = req("./node_utils.js") as FrappeNodeUtils;
 * ```
 */
export interface FrappeNodeUtils {
	/** node_utils.js:17-57. Reads the bench config from disk on every call — not cached. */
	get_conf(): FrappeBenchConf;
	/**
	 * A redis client for `conf[kind]` (node_utils.js:59-74).
	 *
	 * `kind` is a CONFIG KEY, not a redis role: it indexes `get_conf()`, so
	 * `"redis_cache"` and `"redis_queue"` are the two that exist in a stock bench.
	 * A `unix://` connection string becomes `{ socket: { path } }`; anything else is
	 * passed as `url` — INCLUDING `undefined` when the key is missing, in which case
	 * node-redis silently falls back to `localhost:6379`.
	 *
	 * The client is returned DISCONNECTED; call `connect()` first.
	 */
	get_redis_subscriber(
		kind?: "redis_cache" | "redis_queue" | (string & {}),
		options?: Record<string, unknown>
	): RedisClientLike;
}

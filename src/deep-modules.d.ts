/**
 * frappe-types — group `deep-module-imports`
 *
 * Frappe v16.50.0 (`git tag v16.50.0`, branch `version-16`).
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
 * Verified defaults:
 *   - frappe/public/js/frappe/form/grid.js:52           `export default class Grid {`
 *   - frappe/public/js/frappe/form/grid_row.js:9        `export default class GridRow {`
 *   - frappe/public/js/frappe/form/grid_row_form.js:1   `export default class GridRowForm {`
 *   - frappe/public/js/frappe/form/grid_pagination.js:1 `export default class GridPagination {`
 *     (not imported directly by any consumer, but it is the type of
 *     `Grid#grid_pagination`, so it has to be declared here.)
 *
 * Nothing else is exported from grid_row.js, grid_row_form.js or
 * grid_pagination.js. grid.js is the exception: since v16.50 it also has four
 * NAMED exports, all pixel-width tables (frappe/public/js/frappe/form/grid.js:10-36):
 * {@link GRID_MIN_COLUMN_WIDTH}, {@link GRID_MAX_COLUMN_WIDTH},
 * {@link DEFAULT_COLUMN_WIDTHS} and {@link LEGACY_COLSIZE_TO_PX}. They are
 * declared below and re-exported from the `frappe/public/js/frappe/form/grid`
 * specifier by `modules.d.ts`. `Grid` itself is NOT a named export of that
 * module — only the default is.
 *
 * grid.js additionally has TOP-LEVEL SIDE EFFECTS: importing it defines
 * `frappe.ui.form.get_open_grid_form` (frappe/public/js/frappe/form/grid.js:38) and
 * `frappe.ui.form.close_grid_form` (frappe/public/js/frappe/form/grid.js:42), and
 * the module reads/writes `frappe.ui.form.editable_row`
 * (frappe/public/js/frappe/form/grid.js:47). Those three live in the
 * `frappe-ui-form` group; they are named here only so the coupling is on record.
 *
 * ---------------------------------------------------------------------------
 * COLUMN WIDTHS ARE PIXELS  (the v16.50 layout model)
 * ---------------------------------------------------------------------------
 * Through v16.33 the grid laid its columns out on Bootstrap's 12-column grid:
 * every visible column carried a 1-12 `colsize` span (`df.columns`, else
 * `Grid#update_default_colsize`), a redistribution loop padded short grids out
 * to 11 spans, and `GridRow#setup_columns` latched `.column-limit-reached` on
 * `.form-grid-container` once the spans passed 10. v16.50 removed all of it.
 * `Grid#visible_columns` now holds `[docfield, width in px]` pairs
 * (frappe/public/js/frappe/form/grid.js:1510), `GridRow#make_column` and
 * `make_search_column` write the width inline as `flex: 1 0 Npx; width: Npx`
 * (frappe/public/js/frappe/form/grid_row.js:910, 970), pinned columns get their
 * `left` from {@link Grid.sticky_offsets}, and the header grows a drag handle
 * that persists the width to the per-user `GridView` setting
 * ({@link Grid.setup_column_resize}). A legacy `columns` value (a 1-12 span) is
 * still READ — through {@link LEGACY_COLSIZE_TO_PX} — but never written.
 * Removed outright, so absent from the declarations below: `Grid#sticky_row_sum`,
 * `Grid#sticky_rows`, `Grid#update_default_colsize` and `GridDocField#colsize`.
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
	FrappeDoc,
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
 * The value `frappe.utils.debounce` returns
 * (frappe/public/js/frappe/utils/utils.js:928-963).
 *
 * The wrapper forwards `this` and every argument, returns `undefined`, and
 * carries a `cancel()` that reports whether a pending call was actually dropped
 * (frappe/public/js/frappe/utils/utils.js:945-951) and a `flush()` that runs the
 * pending call right now (frappe/public/js/frappe/utils/utils.js:953-960).
 *
 * If the `frappe-utils-dom-router` group ends up exporting a `Debounced<T>`,
 * delete this and import that one instead.
 */
export interface Debounced<TArgs extends readonly unknown[] = []> {
	(...args: TArgs): void;
	/** `false` when there was no pending call to cancel (frappe/public/js/frappe/utils/utils.js:946). */
	cancel(): boolean;
	/** `false` when there was no pending call to run; otherwise cancels the timer, runs the call with the last-seen `this` and arguments, and returns `true` (frappe/public/js/frappe/utils/utils.js:953-960). */
	flush(): boolean;
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
 * The sortablejs instance stored on `Grid#grid_sortable`
 * (frappe/public/js/frappe/form/grid.js:910).
 *
 * `Sortable` is a bare GLOBAL in frappe (no import in grid.js or grid_row.js —
 * it comes from the libs bundle, `frappe/public/js/libs.bundle.js:3`). sortablejs
 * is not part of the desk API, so only `option` (the one method frappe's grid
 * code calls) and `destroy` (a plain sortablejs instance method frappe never
 * calls on it, read from `sortablejs@1.15.7/Sortable.js:2154`) are declared.
 */
export interface GridSortable {
	/** frappe/public/js/frappe/form/grid_row.js:295, 947 — `option("disabled", …)` freezes dragging while a column filter is active. */
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
	/** frappe/public/js/frappe/form/grid.js:209-211 — called once at the end of `Grid#make()` with the grid. */
	on_setup?: (grid: Grid) => void;
	/**
	 * Suppresses "Add row"/"Duplicate". Read at
	 * frappe/public/js/frappe/form/grid.js:298, 442, 480, 815, 1180 and
	 * frappe/public/js/frappe/form/grid_row.js:1395. The grid-level
	 * {@link Grid.cannot_add_rows} is checked beside it everywhere except `:480`,
	 * which looks at the docfield only.
	 */
	cannot_add_rows?: boolean | 0 | 1;
	/** frappe/public/js/frappe/form/grid.js:434; frappe/public/js/frappe/form/grid_row.js:1402 — suppresses "Delete". */
	cannot_delete_rows?: boolean | 0 | 1;
	/** frappe/public/js/frappe/form/grid_row.js:330, 369 — no open-form button and no Configure-Columns gear. */
	in_place_edit?: boolean | 0 | 1;
	/**
	 * frappe/public/js/frappe/form/grid.js:670 — grid rendered inside a Web Form;
	 * `display_status` then comes from `control.get_status()`
	 * (frappe/public/js/frappe/form/grid.js:671). Also read by
	 * `controls/base_control.js:56`.
	 *
	 * §2b UNION FIX — this copy had `0 | 1`, `ui/form.d.ts` had `boolean | 0 | 1`.
	 * `ui/form.d.ts` was right and is kept: `web_form/webform_script.js:61` and
	 * `:77` assign a real `true`, never `1`. Spelled with
	 * {@link FrappeCheckLoose}, which `model.d.ts` declares for exactly this —
	 * a checkbox slot that JS also writes as a boolean.
	 */
	is_web_form?: FrappeCheckLoose;
	/** frappe/public/js/frappe/form/grid.js:244, 251 — renders a `?` link next to the label. */
	documentation_url?: string;
	/**
	 * The row array for a grid with NO `frm` (dialogs, web forms). Read at
	 * frappe/public/js/frappe/form/grid.js:958 and :964 (`get_filtered_data`);
	 * `Grid#add_new_row` creates it from `get_data()` when absent and pushes onto
	 * it in place (frappe/public/js/frappe/form/grid.js:1202-1211).
	 * `GridRow#remove` splices it in place for the reason its own comment gives —
	 * "else the object reference will be lost"
	 * (frappe/public/js/frappe/form/grid_row.js:130-136) — but `Grid#delete_rows`
	 * first REASSIGNS it to a filtered copy
	 * (frappe/public/js/frappe/form/grid.js:368-371), so a reference held across a
	 * multi-row delete goes stale.
	 */
	data?: ChildDoc[];
	/** frappe/public/js/frappe/form/grid.js:1025; frappe/public/js/frappe/form/grid_row.js:124-125 — alternative row source, filtered by `Grid#deleted_docs`. */
	get_data?: () => ChildDoc[];
	/** frappe/public/js/frappe/form/grid.js:1212 — called with the 1-based idx of a row appended to `df.data`. */
	on_add_row?: (idx: number) => void;
	/**
	 * Pin the column to the left. NOT a stored DocField property — it arrives from
	 * the per-user GridView setting (frappe/public/js/frappe/form/grid.js:1559) and
	 * is read at frappe/public/js/frappe/form/grid_row.js:971. The pinned column's
	 * `left` comes from `Grid#get_sticky_offset`, which sums the widths of the
	 * pinned columns before it (frappe/public/js/frappe/form/grid.js:1514-1523).
	 */
	sticky?: 0 | 1;
	/**
	 * Inherited from the parent doctype's docfield for Link fields
	 * (frappe/public/js/frappe/form/grid.js:1498-1508) so a custom formatter
	 * survives into the child table.
	 */
	formatter?: DocFieldFormatter;
	/*
	 * NOT DECLARED HERE, deliberately:
	 *   - `colsize`. v16.33 computed it onto the docfield (Grid#update_default_colsize);
	 *     v16.50 removed both. Nothing in grid.js or grid_row.js reads or writes it.
	 *   - `width`. Inherited unchanged from `DocField#width` (`string | number`,
	 *     see model.d.ts): since v16.50 the grid takes a column's pixel width from
	 *     `df.width` first (frappe/public/js/frappe/form/grid.js:1533), through
	 *     `clamp_column_width`, and WRITES a number there — from the per-user
	 *     setting (frappe/public/js/frappe/form/grid.js:1558) and from a header
	 *     drag (frappe/public/js/frappe/form/grid.js:603). `columns`, the legacy
	 *     1-12 span, is likewise `DocField#columns`.
	 */
}

/**
 * One active column filter, keyed by fieldname in `Grid#filter`.
 *
 * Built at frappe/public/js/frappe/form/grid_row.js:937-940 (a column's search
 * input) and frappe/public/js/frappe/form/grid_row.js:285-288 (the row-index
 * input, whose `df` is the synthetic `{ fieldtype: "Sr No" }` at
 * frappe/public/js/frappe/form/grid_row.js:281-283 — a fieldtype that exists
 * nowhere else in frappe). Consumed at frappe/public/js/frappe/form/grid.js:968-973.
 */
export interface GridFilter {
	df: GridDocField;
	/** Raw input value; `Grid#get_filtered_data` lowercases it before matching (frappe/public/js/frappe/form/grid.js:971). */
	value: string;
}

/**
 * A bag of control properties merged onto the real control later.
 *
 * `Grid#get_field(fieldname)` lazily creates one (grid.js:1157) purely so app code
 * has somewhere to hang `get_query` before the control exists; it is then copied
 * onto the on-grid control (grid_row.js:1168) and `$.extend`-ed onto the grid form's
 * control (grid_row_form.js:31-33). Genuinely open — the source only ever names
 * `get_query`, but nothing restricts it.
 */
export interface GridFieldInfo {
	/**
	 * The only key frappe itself ever names. Copied onto the on-grid control at
	 * grid_row.js:1168 (`field.get_query = this.grid.get_field(df.fieldname).get_query`),
	 * onto the bulk-edit dialog's docfield at grid.js:1419-1420
	 * (`if (grid_field?.get_query) new_df.get_query = grid_field.get_query`), and
	 * `$.extend`-ed onto the grid form's control at grid_row_form.js:30-33.
	 *
	 * `unknown`, not a call signature: frappe only ever forwards this value, it
	 * never invokes it here, and the Link-control contract it eventually reaches
	 * accepts several arities (`get_query(cb, doc, cdt, cdn)` —
	 * frappe/public/js/frappe/form/grid.js:1283-1284).
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
 * `GridRow#make_column` (frappe/public/js/frappe/form/grid_row.js:966-1090) with
 * the expandos frappe stamps onto it. This is what `GridRow#columns` and
 * `GridRow#columns_list` hold.
 *
 * NOTE the cells built by `make_search_column`
 * (frappe/public/js/frappe/form/grid_row.js:916-920) are plain `JQuery` — they
 * carry none of these expandos and are stored separately in
 * `GridRow#search_columns`. Both kinds are pixel-sized inline
 * (`flex: 1 0 Npx; width: Npx`) and carry `data-fieldname`.
 */
export interface GridColumn extends JQuery {
	/** grid_row.js:1073 — the docfield this cell renders. */
	df: GridDocField;
	/** grid_row.js:1074 — index into `Grid#visible_columns`. */
	column_index: number;
	/** grid_row.js:1058 — holds the live control while the row is editable; hidden otherwise. */
	field_area: JQuery;
	/** grid_row.js:1059 — holds the formatted read-only text. */
	static_area: JQuery;
	/** grid_row.js:1208 — set by `make_control`; absent until the row is first activated. */
	field?: BaseControl;
	/** base_input.js:282 sets this from control validation; read at grid_row.js:758. */
	is_invalid?: boolean;
}

/**
 * One row of the Configure Columns dialog's working copy
 * (`GridRow#selected_columns_for_grid`), which is also what gets saved as the
 * stored `GridView` user setting.
 *
 * Built from the live columns at frappe/public/js/frappe/form/grid_row.js:426-430,
 * from a newly added field at frappe/public/js/frappe/form/grid_row.js:502-506,
 * and re-read from the dialog's inputs at
 * frappe/public/js/frappe/form/grid_row.js:634-638; saved at
 * frappe/public/js/frappe/form/grid_row.js:703-705. A header drag saves the same
 * shape (frappe/public/js/frappe/form/grid.js:600-612).
 *
 * v16.50 renamed the width slot: through v16.33 it was `columns`, a 1-12
 * Bootstrap span; it is now `width`, in PIXELS. Settings saved by an older
 * release still hold `columns` and are migrated on READ by
 * `Grid#setup_user_defined_columns`
 * (frappe/public/js/frappe/form/grid.js:1558); nothing writes `columns` any more.
 */
export interface GridColumnSetting {
	fieldname: string;
	/** Column width in pixels, kept within 60-600 by `Grid#clamp_column_width`. */
	width: number;
	sticky?: 0 | 1;
}

/**
 * An option for the MultiCheck field in the "Add / Remove Columns" dialog
 * (frappe/public/js/frappe/form/grid_row.js:543-547, 558-562).
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
	/** Selection state. Written 0/1 by `GridRow#select` (frappe/public/js/frappe/form/grid_row.js:83); read by `Grid#get_selected*` (frappe/public/js/frappe/form/grid.js:493, 497). */
	__checked?: 0 | 1;
	/** frappe/public/js/frappe/form/grid.js:1198 — set on a freshly appended row. */
	__unedited?: boolean;
	/** Explicitly `false` disables drag-reorder for this row (frappe/public/js/frappe/form/grid.js:929; frappe/public/js/frappe/form/grid_row.js:165). */
	_sortable?: false;
}

/* ===========================================================================
 * "frappe/public/js/frappe/form/grid" — default export
 * =========================================================================*/

/**
 * Smallest column width, in px, the grid will lay out
 * (frappe/public/js/frappe/form/grid.js:10). Named export of the
 * `frappe/public/js/frappe/form/grid` module — not a `Grid` static.
 */
export declare const GRID_MIN_COLUMN_WIDTH: 60;

/**
 * Largest column width, in px, the grid will lay out
 * (frappe/public/js/frappe/form/grid.js:11). Named export of the
 * `frappe/public/js/frappe/form/grid` module.
 */
export declare const GRID_MAX_COLUMN_WIDTH: 600;

/**
 * Default column width in px by fieldtype, for a column with no per-user width
 * and no legacy `columns` span (frappe/public/js/frappe/form/grid.js:12-21).
 *
 * Only eight fieldtypes have an entry — Text, Small Text, Long Text, Check,
 * Int, Float, Currency and Percent — and every other fieldtype misses
 * (`Grid#get_column_width` then falls back to 140,
 * frappe/public/js/frappe/form/grid.js:1531-1536). The value type is therefore
 * `number | undefined` under `noUncheckedIndexedAccess`, which is the truth.
 * Named export of the `frappe/public/js/frappe/form/grid` module.
 */
export declare const DEFAULT_COLUMN_WIDTHS: Readonly<Record<string, number>>;

/**
 * The v16.33 Bootstrap-span -> pixel table, kept so a docfield's `columns: N`
 * (N in 1-12) and old `GridView` user settings still resolve to a width
 * (frappe/public/js/frappe/form/grid.js:23-36). Keys are exactly 1 to 12
 * (60, 100, 140, 200, 250, 300, 350, 400, 450, 500, 550, 600); any other key
 * misses, which `Grid#get_column_width` and `Grid#setup_user_defined_columns`
 * rely on (frappe/public/js/frappe/form/grid.js:1534, 1558). Named export of
 * the `frappe/public/js/frappe/form/grid` module.
 */
export declare const LEGACY_COLSIZE_TO_PX: Readonly<Record<number, number>>;

/**
 * Constructor options for {@link Grid}.
 *
 * The constructor is `constructor(opts) { $.extend(this, opts); … }`
 * (grid.js:53-54), so EVERY key of `opts` lands on the instance verbatim. The
 * index signature records that; keys beyond the four named ones are untyped.
 *
 * The canonical call site is `frappe.ui.form.ControlTable#make`
 * (controls/table.js:8-13).
 */
export interface GridOptions {
	/** The Table docfield. `df.options` names the child DocType and becomes `Grid#doctype` (grid.js:56). */
	df: GridDocField;
	/** Where `make()` appends the grid markup (grid.js:173-174). jQuery in every in-tree call site. */
	parent: JQuery | HTMLElement;
	/** Absent for grids outside a form — dialogs, web forms, `MultiSelectDialog`. Most of `Grid` branches on it. */
	frm?: Form;
	/** The owning `frappe.ui.form.ControlTable`; supplies `perm` (grid.js:84) and `get_status()` (grid.js:671). */
	control?: ControlTable;
	/** `$.extend(this, opts)` (grid.js:54) copies any other key straight onto the instance. */
	[key: string]: unknown;
}

/**
 * frappe's child-table grid — `frappe/public/js/frappe/form/grid.js`, default export.
 *
 * Designed to be SUBCLASSED: `frappe.ui.form.ControlTable#make` is the only place
 * that constructs it (controls/table.js:8), so replacing the grid means patching
 * that one method and constructing your subclass instead.
 *
 * @see grid.js:52
 */
export declare class Grid {
	constructor(opts: GridOptions);

	// ---------------------------------------------------------------- from opts

	/** The Table docfield. REASSIGNED on every `refresh()` by `setup_fields()` (grid.js:848-860) — do not cache it. */
	df: GridDocField;
	/** grid.js:173-174, and the target of most `$(this.parent).find(...)` lookups. */
	parent: JQuery | HTMLElement;
	/** Absent outside a form. */
	frm?: Form;
	/** Absent unless constructed by `ControlTable`. */
	control?: ControlTable;

	// -------------------------------------------------------- set in constructor

	/** grid.js:55 — see {@link GridFieldInfo}. */
	fieldinfo: Record<string, GridFieldInfo>;
	/** `this.df.options` (grid.js:56) — the child DocType. `undefined` when the docfield names none. */
	doctype: string | undefined;
	/**
	 * Left offset (px) per pinned column, keyed by fieldname. Starts as `{}`
	 * (frappe/public/js/frappe/form/grid.js:58) and is REBUILT from scratch — never
	 * patched — by `setup_visible_columns` (frappe/public/js/frappe/form/grid.js:1516-1523)
	 * and `save_column_width` (frappe/public/js/frappe/form/grid.js:616-626). The
	 * first pinned column sits at 71 (the row-check and row-index gutters); each
	 * further one is offset by the widths of the pinned columns before it. Read
	 * through {@link Grid.get_sticky_offset}, which supplies the 71 for a column
	 * that is not in the map.
	 *
	 * Replaces `sticky_row_sum` and `sticky_rows`, which v16.50 removed.
	 */
	sticky_offsets: Record<string, number>;
	/** `frappe.get_meta(this.doctype)` (grid.js:61); absent when `doctype` is. */
	meta?: DocTypeMeta;
	/** fieldname → docfield, rebuilt on every `setup_fields()` (frappe/public/js/frappe/form/grid.js:63, 873-875). */
	fields_map: Record<string, GridDocField>;
	/**
	 * Grid-LOCAL `hidden` overrides set by `set_column_disp_in_list_view`
	 * (frappe/public/js/frappe/form/grid.js:67, 1057). Deliberately not written
	 * back onto the shared `frappe.meta` docfield, so two grids of the same child
	 * doctype on one form stay independent
	 * (frappe/public/js/frappe/form/grid.js:64-66, 891-903).
	 */
	column_disp_overrides: Record<string, 0 | 1>;
	/** The custom render template from `frm.meta.__form_grid_templates[df.fieldname]` (frappe/public/js/frappe/form/grid.js:68, 75); rendered at frappe/public/js/frappe/form/grid_row.js:225. */
	template: string | null;
	/**
	 * `set_multiple_add` has run (frappe/public/js/frappe/form/grid.js:69, 1583,
	 * 1604) — it guards that method against double-binding. Since v16.50 it also
	 * gates the "Add multiple" button: `setup_check` and `setup_toolbar` keep
	 * `.grid-add-multiple-rows` hidden unless this is set
	 * (frappe/public/js/frappe/form/grid.js:305, 826-828).
	 */
	multiple_set: boolean;
	/** Active column filters, keyed by fieldname plus the literal key `"row-index"` (frappe/public/js/frappe/form/grid_row.js:285). frappe/public/js/frappe/form/grid.js:77. */
	filter: Record<string, GridFilter>;
	/** grid.js:78 — the duck-type marker other desk code checks for. */
	readonly is_grid: true;
	/** `refresh` debounced by 100ms (grid.js:79-80). Every `toggle_*`/`set_column_disp` path ends here. */
	debounced_refresh: Debounced;
	/** Class field, grid.js:474-477. NOTE it is NOT bound — it is `frappe.utils.debounce(this.refresh_remove_rows_button, 100)`, and `debounce` forwards `this` from the call site (utils.js:937), so it only works when invoked as `grid.debounced_refresh_remove_rows_button()`. Called that way at grid_row.js:89. */
	debounced_refresh_remove_rows_button: Debounced;
	/** Class field, grid.js:487-490. Same `this`-forwarding caveat as above. */
	debounced_duplicate_rows_button: Debounced;

	// -------------------------------------------------------------- set in make()

	/**
	 * The `.grid-field` root — `$(template).appendTo(this.parent)` (grid.js:173).
	 *
	 * A {@link JQueryRegion}, not a plain `JQuery`: it is built from a literal
	 * template string, so `wrapper[0]` / `wrapper.get(0)` never need a `!`.
	 * Also REQUIRED, not optional (gaps.md §5.3): `refresh()` guards with
	 * `!this.wrapper && this.make()` (grid.js:659), so by the time any caller
	 * holds a rendered grid it is set. `.find(...)` off it is still a plain
	 * possibly-empty `JQuery`.
	 */
	wrapper: JQueryRegion;
	/** `.form-grid` — the element a replacement renderer takes over (grid.js:180). */
	form_grid: JQuery;
	/** label → button, for `add_custom_button` (frappe/public/js/frappe/form/grid.js:199, 1717-1723). */
	custom_buttons: Record<string, JQuery>;
	/**
	 * `.grid-buttons` (frappe/public/js/frappe/form/grid.js:200). Since v16.50 every
	 * button in it is an `.es-button` built by `frappe.ui.button.html`
	 * (frappe/public/js/frappe/form/grid.js:116-152) whose label lives in a
	 * `.es-button__label` span — see {@link Grid.set_button_label}.
	 */
	grid_buttons: JQuery;
	/** `.grid-custom-buttons` — the `position: "top"` slot (frappe/public/js/frappe/form/grid.js:201). */
	grid_custom_buttons: JQuery;
	/** `.grid-remove-rows`, an `.es-button` (frappe/public/js/frappe/form/grid.js:202). */
	remove_rows_button: JQuery;
	/** `.grid-edit-rows`, an `.es-button` (frappe/public/js/frappe/form/grid.js:203). */
	edit_rows_button: JQuery;
	/** `.grid-duplicate-rows`, an `.es-button` (frappe/public/js/frappe/form/grid.js:204). */
	duplicate_rows_button: JQuery;
	/** `.grid-remove-all-rows`, an `.es-button` (frappe/public/js/frappe/form/grid.js:205). */
	remove_all_rows_button: JQuery;
	/** grid.js:257. */
	grid_pagination: GridPagination;

	// ------------------------------------------------- set in refresh()/make_head()

	/** `Object.keys(this.filter).length !== 0` (grid.js:656). */
	filter_applied: boolean;
	/**
	 * The rows currently being rendered (frappe/public/js/frappe/form/grid.js:657).
	 *
	 * DISCREPANCY: `get_filtered_data()` returns `undefined` when the underlying
	 * array is missing (frappe/public/js/frappe/form/grid.js:966), so `this.data`
	 * CAN be `undefined` for one refresh on a filtered, dataless grid — after
	 * which `GridPagination#update_page_numbers`
	 * (frappe/public/js/frappe/form/grid_pagination.js:102) and
	 * frappe/public/js/frappe/form/grid.js:693, 801 would throw. That is a latent
	 * upstream bug; the field is declared as an array because every other path
	 * guarantees one and typing it nullable would force guards on code that
	 * upstream itself does not guard.
	 */
	data: GridChildDoc[];
	/** grid.js:665-675. `"None"` short-circuits the rest of `refresh()` (grid.js:677). */
	display_status: "Write" | "Read" | "None";
	/** The previous `display_status` (grid.js:705). */
	last_display_status: "Write" | "Read" | "None";
	/** grid.js:706. */
	last_docname: string | undefined;
	/** All child docfields, after the mask and column-disp overrides (frappe/public/js/frappe/form/grid.js:864-871). */
	docfields: GridDocField[];
	/**
	 * Rows for the CURRENT page, indexed by ABSOLUTE row index.
	 *
	 * SPARSE by design: `delete this.grid_rows[i]` clears every slot outside the
	 * page (frappe/public/js/frappe/form/grid.js:795-799), which is why upstream
	 * itself writes `if (!row) continue` (frappe/public/js/frappe/form/grid.js:1742)
	 * and `this.grid_rows[i]?.` (frappe/public/js/frappe/form/grid.js:1768).
	 */
	grid_rows: Array<GridRow | undefined>;
	/** docname → row, rebuilt from scratch on every refresh (frappe/public/js/frappe/form/grid.js:688, 768). */
	grid_rows_by_docname: Record<string, GridRow>;
	/** The header GridRow — `configure_columns: true, header_row: true` (grid.js:518-526). */
	header_row: GridRow;
	/** The filter GridRow — `show_search: true` (grid.js:528-535). */
	header_search: GridRow;
	/**
	 * `[docfield, width]` pairs; the width is in PIXELS, from
	 * {@link Grid.get_column_width}, so always an integer within 60-600
	 * (frappe/public/js/frappe/form/grid.js:1510). Through v16.33 the second slot
	 * was a Bootstrap 1-12 span, redistributed to fill 11 spans; v16.50 removed
	 * the span and the redistribution (see the header). `save_column_width`
	 * updates a pair's width in place on a header drag
	 * (frappe/public/js/frappe/form/grid.js:605).
	 *
	 * `null` AFTER a full refresh, not just before the first one:
	 * `FrappeForm#switch_doc` writes `grid.visible_columns = null` on every grid
	 * (frappe/public/js/frappe/form/form.js:583) and immediately calls
	 * `grid_pagination.go_to_page(1, true)` → `render_result_rows()`
	 * (frappe/public/js/frappe/form/form.js:585) — before `refresh()` gets to
	 * rebuild it. Upstream survives that because its rows rebuild the columns
	 * lazily through `GridRow#setup_columns` → `setup_visible_columns`, and a
	 * grid with no rows never reads the field on that path. Anything that reads
	 * it directly from `render_result_rows` must call `setup_visible_columns()`
	 * first, which rebuilds when it is `null` or empty
	 * (frappe/public/js/frappe/form/grid.js:1475). `reset_grid` and
	 * `set_column_disp_in_list_view` reset it to `[]` through
	 * `_teardown_column_layout` (frappe/public/js/frappe/form/grid.js:500-504).
	 */
	visible_columns: Array<[GridDocField, number]> | null;
	/** Column order/width from the per-user GridView setting; empty when none (frappe/public/js/frappe/form/grid.js:1477, 1544-1565). */
	user_defined_columns: GridDocField[];
	/** grid.js:702. */
	sortable_setup_done: boolean;
	/** grid.js:910 — only created when `is_sortable()` and not already set up. */
	grid_sortable: GridSortable;

	// ------------------------------------------------------ set by callers, not here

	/**
	 * Set by app code to render an explicit column list and bypass the
	 * `in_list_view` filter (frappe/public/js/frappe/form/grid.js:1482, 1493).
	 * Never assigned inside grid.js.
	 */
	editable_fields?: GridDocField[];
	/** Suppresses header rebuilds while a search keystroke re-renders (grid.js:512; set at grid_row.js:301-303). */
	prevent_build?: boolean;
	/** Anchor for shift-click range selection (grid.js:287-291). */
	last_checked_docname?: string;
	/** docnames to exclude from `get_modal_data()` (grid.js:1027). Set by `MultiSelectDialog`-style callers. */
	deleted_docs?: string[];
	/** Grid-level (rather than docfield-level) "Add row" suppression (frappe/public/js/frappe/form/grid.js:297, 442, 814, 1180; frappe/public/js/frappe/form/grid_row.js:1395). */
	cannot_add_rows?: boolean;
	/** Set by `only_sortable()` (grid.js:1578) — rows may be reordered but not edited. */
	static_rows?: boolean;
	/** Set by `only_sortable()` (grid.js:1577). */
	sortable_status?: boolean;
	/** The open row's form, set by `GridRowForm#render` (grid_row_form.js:38). */
	open_grid_row?: GridRowForm;

	// ---------------------------------------------------------------- accessors

	/**
	 * `this.control?.perm || this.frm?.perm || this.df.perm` (grid.js:83-85).
	 *
	 * One entry per permlevel, each a map of right → 0|1 plus `permlevel`
	 * (frappe/public/js/frappe/model/perm.js:82 builds
	 * `[{ read: 0, permlevel: 0, rights_without_if_owner: new Set() }]`; the right
	 * names come from `frappe.perm.get_rights`,
	 * frappe/public/js/frappe/model/perm.js:20-48, and are extensible via
	 * the Permission Type doctype — hence {@link Permission}'s open index
	 * signature).
	 *
	 * SEAM RESOLUTION (§2b `perm` divergence) — the two `Grid` copies disagreed:
	 * this one spelled the element type inline as
	 * `Record<string, 0 | 1 | number>`; `ui/form.d.ts` used
	 * `readonly perm: Permission[]`. The MERGE of what each got right is kept:
	 * - the ACCESSOR form from HERE, because grid.js:83-88 really is a getter
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
	 * `grid.js:84` citation. `undefined` is in the union because all three
	 * branches are optional — a grid with no `control`, no `frm` and no
	 * `df.perm` (the dialog and Web Form case) genuinely has none.
	 */
	get perm(): Permission[] | DocPerm[] | undefined;
	/** Assigning only logs an error; the value is discarded (grid.js:87-89). */
	set perm(value: Permission[] | DocPerm[] | undefined);

	// ------------------------------------------------------------------ methods

	/** `true` when the child doctype has `editable_grid`, or when there is no meta at all (frappe/public/js/frappe/form/grid.js:91-93). */
	allow_on_grid_editing(): boolean;
	/** Builds the whole `.grid-field` scaffold and caches every button handle (frappe/public/js/frappe/form/grid.js:95-212). Idempotent only via `refresh()`'s `!this.wrapper && this.make()` guard (frappe/public/js/frappe/form/grid.js:659). */
	make(): void;
	set_grid_description(): void;
	/** Fills in missing `idx`/`name` on `this.data` (grid.js:222-231). */
	update_idx_and_name(): void;
	/** An 8-char base-36 id for rows that have no `name` yet (grid.js:233-235). */
	get_random_name(): string;
	set_doc_url(): void;
	setup_grid_pagination(): void;
	/**
	 * Binds the row-checkbox click handler on `wrapper`
	 * (frappe/public/js/frappe/form/grid.js:263-331): select-all from the header
	 * box, shift-click range selection, then the Add row / Add multiple visibility
	 * and the Delete / Edit / Duplicate labels (through
	 * {@link Grid.set_button_label}) from the selection count.
	 */
	setup_check(): void;
	/**
	 * (Un)check every row between two docnames inclusive. No-ops when either
	 * docname is not on the current page (frappe/public/js/frappe/form/grid.js:344).
	 * @see frappe/public/js/frappe/form/grid.js:339
	 */
	check_range(docname1: string, docname2: string, checked?: boolean): void;
	duplicate_rows(): void;
	delete_rows(): void;
	delete_all_rows(): void;
	scroll_to_top(): void;
	/** `this.grid_rows_by_docname[name].select()` — throws if `name` is not on the current page (grid.js:420). */
	select_row(name: string): void;
	remove_all(): void;
	/**
	 * Whether any row checkbox in the BODY is checked — the header's select-all box
	 * does not count (frappe/public/js/frappe/form/grid.js:429-431). Private helper
	 * behind the three `refresh_*_button` methods.
	 */
	_any_rows_checked(): boolean;
	/** Shows/hides Delete, Duplicate and "Delete all N rows" from the checkbox state (frappe/public/js/frappe/form/grid.js:433-457). */
	refresh_remove_rows_button(): void;
	/**
	 * Writes `label` into `$btn`'s `.es-button__label` span (frappe/public/js/frappe/form/grid.js:459-463).
	 *
	 * The grid's buttons are `.es-button`s since v16.50, whose label sits in a
	 * span beside a spinner and a loading label. `$btn.text(label)` — what
	 * `setup_check` and `refresh_remove_rows_button` did through v16.33 — would
	 * wipe that structure, and code that rewrites a button's `innerHTML` (say, to
	 * re-skin it as an icon-only action) leaves this a silent no-op, because the
	 * span it targets is gone. `$btn` with no `.es-button__label` is not an error:
	 * `.find()` matches nothing.
	 */
	set_button_label($btn: JQuery, label: string): void;
	refresh_edit_rows_button(): void;
	refresh_duplicate_rows_button(): void;
	/** Docnames of checked rows (frappe/public/js/frappe/form/grid.js:492-494). */
	get_selected(): string[];
	/** The checked rows themselves (frappe/public/js/frappe/form/grid.js:496-498). */
	get_selected_children(): GridChildDoc[];
	/**
	 * Throws away the cached column layout: `visible_columns = []`,
	 * `grid_rows = []`, and every rendered `.grid-body .grid-row` removed from the
	 * DOM (frappe/public/js/frappe/form/grid.js:500-504). Does NOT refresh — the
	 * caller does. Factored out of `reset_grid` and `set_column_disp_in_list_view`
	 * in v16.50 so both rebuild with consistent widths; an override of
	 * `reset_grid` that calls `super` gets this for free, one that does not has to
	 * clear its own row DOM.
	 */
	_teardown_column_layout(): void;
	/** `_teardown_column_layout()`, then `refresh()` (frappe/public/js/frappe/form/grid.js:506-509). */
	reset_grid(): void;
	/**
	 * Rebuilds `header_row` and `header_search` (frappe/public/js/frappe/form/grid.js:511-546).
	 * Early-returns on `prevent_build`. Ends by calling {@link Grid.setup_column_resize}
	 * (frappe/public/js/frappe/form/grid.js:545), so an override that rebuilds the
	 * header itself and does not call `super` gets no drag-resize.
	 */
	make_head(): void;
	/**
	 * Binds the header drag-resize (frappe/public/js/frappe/form/grid.js:548-595).
	 *
	 * No-ops on mobile (`frappe.is_mobile()`) or before `make()`. Delegates a
	 * `mousedown` on `.grid-heading-row .grid-col-resize-handle` — the handle
	 * `GridRow#make_column` appends to each header cell
	 * (frappe/public/js/frappe/form/grid_row.js:1067-1071) — from `wrapper`,
	 * under a per-grid event namespace (`_resize_ns`, assigned on first call).
	 * While dragging it restyles every `.grid-static-col[data-fieldname=…]` cell in
	 * the grid; on `mouseup` it calls {@link Grid.save_column_width}.
	 * RTL inverts the drag direction. Safe to call again: it unbinds its own
	 * namespace first.
	 */
	setup_column_resize(): void;
	/**
	 * Persists one column's new width (frappe/public/js/frappe/form/grid.js:597-633).
	 *
	 * Returns without doing anything when the grid has no `frm`. Otherwise it
	 * writes `width` onto the docfield and onto that column's slot in
	 * `visible_columns` (so rows created later get it), recomputes
	 * {@link Grid.sticky_offsets} and patches `left` on the pinned cells already in
	 * the DOM, and saves the whole column list — `{ fieldname, width, sticky }`
	 * per column, see {@link GridColumnSetting} — as the `GridView` user setting
	 * for this child doctype. The save is not awaited; the cached
	 * `frappe.model.user_settings[doctype]` is refreshed from its response.
	 * The docfield and the `visible_columns` slot take `width` as given, but the
	 * SAVED width goes back through `get_column_width`, which clamps it; the drag
	 * handler clamps before calling.
	 */
	save_column_width(fieldname: string, width: number): void;
	/**
	 * Re-applies each active column filter's value to its search input after the
	 * header is rebuilt (frappe/public/js/frappe/form/grid.js:635-651). A filter
	 * whose column no longer has a search cell is DROPPED instead, `data` is
	 * re-read, and the loop stops (frappe/public/js/frappe/form/grid.js:637-641).
	 */
	update_search_columns(): void;
	/** The full render cycle (frappe/public/js/frappe/form/grid.js:653-716). Ends by triggering `"change"` on `wrapper`. */
	refresh(): void;
	/**
	 * Reconciles GridRow instances against `this.data` by DOC OBJECT IDENTITY and
	 * reorders the DOM from the first mismatch (frappe/public/js/frappe/form/grid.js:718-804).
	 *
	 * `$rows` is optional: `refresh()` passes it (frappe/public/js/frappe/form/grid.js:691) but
	 * `GridPagination#go_to_page` calls it with NO argument
	 * (frappe/public/js/frappe/form/grid_pagination.js:167), in which case the base
	 * implementation re-finds `.rows` itself (frappe/public/js/frappe/form/grid.js:719-721).
	 * An override that forwards `$rows` on to `new GridRow({ parent: $rows })` must
	 * handle the `undefined` case.
	 */
	render_result_rows($rows?: JQuery | undefined): void;
	/**
	 * Shows/hides the footer and the Add row / Add multiple / Duplicate buttons
	 * from editability, `cannot_add_rows` and the checkbox selection
	 * (frappe/public/js/frappe/form/grid.js:806-842). "Add multiple" is revealed
	 * only when {@link Grid.multiple_set} is (frappe/public/js/frappe/form/grid.js:826-828).
	 * Writes `d-none` rather than `hidden` for the editability case on purpose
	 * (frappe/public/js/frappe/form/grid.js:837-841), because `hidden` is toggled
	 * by the selection logic on the same buttons.
	 */
	setup_toolbar(): void;
	/** Re-resolves `df` and `docfields` from `frappe.meta`, then applies the column-disp and masked-field overrides (frappe/public/js/frappe/form/grid.js:844-876). */
	setup_fields(): void;
	/** Renders `meta.masked_fields` as read-only Data on a COPY of each docfield (frappe/public/js/frappe/form/grid.js:878-889). */
	_apply_mask_overrides(): void;
	/** Applies `column_disp_overrides` onto a COPY of each docfield (frappe/public/js/frappe/form/grid.js:891-903). */
	_apply_column_disp_overrides(): void;
	refresh_row(docname: string): void;
	/**
	 * Binds sortablejs to `$rows`; `$rows.get(0)` must exist
	 * (frappe/public/js/frappe/form/grid.js:909-949). The `filter` that keeps a
	 * drag from starting on a link or list item is, since v16.50, a function that
	 * exempts anything inside a Text Editor's `.ql-editor`
	 * (frappe/public/js/frappe/form/grid.js:915-920); through v16.33 it was the
	 * bare selector `"li, a"`.
	 */
	make_sortable($rows: JQuery): void;
	make_sortable($rows: JQuery): void;
	/** Unfiltered: `frm.doc[df.fieldname]`, else `df.data`, else `get_modal_data()` (grid.js:956-958). */
	get_data(): GridChildDoc[];
	/** Filtered: delegates to `get_filtered_data()`, which returns `undefined` when there is no source array (grid.js:966). */
	get_data(filter_field: boolean | undefined): GridChildDoc[] | undefined;
	/** `undefined` when neither `frm.doc[df.fieldname]` nor `df.data` exists (grid.js:963-976). */
	get_filtered_data(): GridChildDoc[] | undefined;
	/**
	 * The per-fieldtype filter predicate (frappe/public/js/frappe/form/grid.js:978-1022).
	 *
	 * Returns the row itself on a match, `undefined` on a miss, and — for `Check`
	 * only — the boolean `Boolean(fieldvalue) === value && data` (grid.js:985).
	 * Used as an `Array#filter` callback, so only truthiness is ever consumed.
	 */
	get_data_based_on_fieldtype(
		df: GridDocField,
		data: GridChildDoc,
		value: string | boolean
	): GridChildDoc | boolean | undefined;
	/** `df.get_data()` minus `deleted_docs`; `[]` when `df.get_data` is absent (grid.js:1024-1032). */
	get_modal_data(): GridChildDoc[];
	/** Mutates the SHARED `frappe.meta` docfield (grid.js:1041) — see `set_column_disp_in_list_view` for the grid-local variant. */
	set_column_disp(fieldname: string | string[], show: boolean): void;
	/**
	 * Grid-local column hiding; never touches the shared docfield
	 * (frappe/public/js/frappe/form/grid.js:1048-1062). Records the override, tears
	 * the column layout down with {@link Grid._teardown_column_layout} so the new
	 * column set is rebuilt with consistent widths, then schedules a debounced
	 * refresh.
	 */
	set_column_disp_in_list_view(fieldname: string | string[], show: boolean): void;
	set_editable_grid_column_disp(fieldname: string, show: boolean): void;
	toggle_reqd(fieldname: string, reqd: boolean | 0 | 1): void;
	toggle_enable(fieldname: string, enable: boolean | 0 | 1): void;
	toggle_display(fieldname: string, show: boolean | 0 | 1): void;
	toggle_checkboxes(enable: boolean): void;
	/** `frappe.meta.get_docfield(...)` — `undefined` for a fieldname the child doctype does not have (grid.js:1131-1137). */
	get_docfield(fieldname: string): GridDocField | undefined;
	/** A number indexes `grid_rows` (negative counts from the end); a string indexes `grid_rows_by_docname` (grid.js:1139-1149). */
	get_row(key: number | string): GridRow | undefined;
	/** Alias for {@link Grid.get_row} (grid.js:1151-1153). */
	get_grid_row(key: number | string): GridRow | undefined;
	/** Lazily creates and returns the `fieldinfo` bag — never `undefined` (grid.js:1155-1159). */
	get_field(fieldname: string): GridFieldInfo;
	set_value(fieldname: string, value: unknown, doc?: GridChildDoc | undefined): void;
	setup_add_row(): void;
	/**
	 * Appends (or inserts at `idx`) a child row (grid.js:1179-1236).
	 *
	 * Returns the new doc ONLY on the `frm` path — the non-form branch pushes a
	 * plain object onto `df.data` and falls out with `d` still `undefined`
	 * (frappe/public/js/frappe/form/grid.js:1202-1214, 1189, 1234). Also returns
	 * `undefined` when the grid is not editable or rows cannot be added
	 * (frappe/public/js/frappe/form/grid.js:1181).
	 */
	add_new_row(
		idx?: number | null,
		callback?: (() => void) | null | undefined,
		show?: boolean,
		copy_doc?: GridChildDoc | false | null,
		go_to_last_page?: boolean,
		go_to_first_page?: boolean
	): GridChildDoc | undefined;
	/** Re-derives `idx` from DOM order after a drag (grid.js:1238-1254). */
	renumber_based_on_dom(): void;
	/** Copies every field of `copy_doc` onto `d` except the 9 identity/audit fields (frappe/public/js/frappe/form/grid.js:1256-1272). */
	duplicate_row(d: GridChildDoc, copy_doc: GridChildDoc): GridChildDoc;
	/**
	 * Opens the bulk-edit dialog (frappe/public/js/frappe/form/grid.js:1274-1458);
	 * no-ops unless `meta.allow_bulk_edit` (frappe/public/js/frappe/form/grid.js:1275).
	 * Shows an alert and returns when no row is checked, and a message when none
	 * of the docfields is editable
	 * (frappe/public/js/frappe/form/grid.js:1278-1281, 1321-1324). Which fields are
	 * offered follows the grid's own display status for the FIRST selected row
	 * (frappe/public/js/frappe/form/grid.js:1285-1316), so allow-on-submit fields
	 * stay editable after the parent is submitted.
	 */
	bulk_edit_rows(): void;
	/** Defaults to the LAST row when `idx` is omitted (grid.js:1460-1463). */
	set_focus_on_row(idx?: number | undefined): void;
	/**
	 * Populates `visible_columns` with `[docfield, width in px]` pairs; returns
	 * immediately if it is already non-empty
	 * (frappe/public/js/frappe/form/grid.js:1474-1524).
	 *
	 * Rebuilds `user_defined_columns` first (`setup_user_defined_columns`), takes
	 * the columns from that, else {@link Grid.editable_fields}, else `docfields`,
	 * keeps the ones that pass the inclusion test — not hidden, `in_list_view`
	 * (unless `editable_fields` is set), readable, not a layout field
	 * (frappe/public/js/frappe/form/grid.js:1490-1496) — lets a Link column inherit
	 * its parent doctype's `formatter`
	 * (frappe/public/js/frappe/form/grid.js:1498-1508), pushes
	 * `[df, this.get_column_width(df)]`
	 * (frappe/public/js/frappe/form/grid.js:1510), and finally recomputes
	 * {@link Grid.sticky_offsets} from the final list
	 * (frappe/public/js/frappe/form/grid.js:1514-1523). Gone since v16.33: the
	 * `df.colsize` write and the redistribution loop that padded the spans.
	 */
	setup_visible_columns(): void;
	/**
	 * Clamps `width` to {@link GRID_MIN_COLUMN_WIDTH}..{@link GRID_MAX_COLUMN_WIDTH}
	 * after `cint()` (frappe/public/js/frappe/form/grid.js:1526-1528). Takes
	 * whatever the caller has — the Configure Columns dialog passes the input's
	 * string value (frappe/public/js/frappe/form/grid_row.js:655) — and always
	 * returns a number, `60` for something `cint` reads as 0.
	 */
	clamp_column_width(width: number | string): number;
	/**
	 * The column's width in px (frappe/public/js/frappe/form/grid.js:1530-1538).
	 *
	 * Precedence: the per-user `df.width`, else the docfield's legacy `columns`
	 * span translated through {@link LEGACY_COLSIZE_TO_PX}, else
	 * {@link DEFAULT_COLUMN_WIDTHS} for the fieldtype, else 140 — then clamped
	 * with {@link Grid.clamp_column_width}. Pure: unlike the removed
	 * `update_default_colsize`, it writes nothing onto the docfield.
	 */
	get_column_width(df: GridDocField): number;
	/**
	 * `left` offset in px for a pinned column
	 * (frappe/public/js/frappe/form/grid.js:1540-1542): its entry in
	 * {@link Grid.sticky_offsets}, or 71 — the width of the row-check and
	 * row-index gutters — when it has none.
	 */
	get_sticky_offset(fieldname: string): number;
	/**
	 * Fills `user_defined_columns` from the per-user `GridView` setting for this
	 * child doctype (frappe/public/js/frappe/form/grid.js:1544-1565). Returns
	 * immediately without a `frm`, leaving it empty.
	 *
	 * Each stored row is resolved to its docfield and STAMPED ONTO IT:
	 * `in_list_view = 1`, `width` (the row's px `width`, else a legacy `columns`
	 * span translated through {@link LEGACY_COLSIZE_TO_PX}) and `sticky`
	 * (frappe/public/js/frappe/form/grid.js:1556-1559). The docfield comes from
	 * `docfields` or, failing that, `frappe.meta.get_docfield`
	 * (frappe/public/js/frappe/form/grid.js:1551-1553), so the stamp is not
	 * guaranteed to be grid-local. Rows whose fieldname no longer exists are
	 * dropped.
	 */
	setup_user_defined_columns(): void;
	is_editable(): boolean;
	is_sortable(): boolean;
	/** No argument means `true` (grid.js:1576). */
	only_sortable(status?: boolean | undefined): void;
	/**
	 * Un-hides `.grid-add-multiple-rows`, binds it to a `LinkSelector`, and sets
	 * {@link Grid.multiple_set} (frappe/public/js/frappe/form/grid.js:1582-1605);
	 * a second call returns at once.
	 * @param link fieldname of the Link field the selector picks; @param qty fieldname the quantity is written to.
	 */
	set_multiple_add(link: string, qty: string): void;
	setup_allow_bulk_edit(): void;
	setup_download(): void;
	/**
	 * Creates the button on first call, un-hides it afterwards; keyed by `label`
	 * (frappe/public/js/frappe/form/grid.js:1714-1728). The button is an
	 * `.es-button` with the extra class `btn-custom`, built by `frappe.ui.button`
	 * (frappe/public/js/frappe/form/grid.js:1719-1722) and prepended to
	 * `grid_custom_buttons` (`position: "top"`) or `grid_buttons`.
	 */
	add_custom_button(
		label: string,
		click: JQueryClickHandler,
		position?: "top" | "bottom"
	): JQuery;
	clear_custom_buttons(): void;
	/** THROWS a string (not an Error) if any rendered row lacks the fieldname (grid.js:1748). */
	update_docfield_property(fieldname: string, property: string, value: unknown): void;
	/** Index into `grid_rows` of the row containing `target`, or `null` (grid.js:1765-1773). */
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
 * The three in-tree call shapes are grid.js:518-526 (header), grid.js:528-535
 * (filter row) and grid.js:758-765 (a data row).
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
	/** Header row only — adds the Configure Columns gear (grid_row.js:370). */
	configure_columns?: boolean;
	/** Header row only — makes `row_check` non-tabbable (grid_row.js:244-246). */
	header_row?: boolean;
	/** Filter row only — builds search inputs instead of data cells (grid_row.js:233, 266). */
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
	/** Absent on the header and filter rows; re-read from `locals` on every `refresh()` (grid_row.js:190). */
	doc?: GridChildDoc;
	frm?: Form;
	/** Header row flag. NOTE: on {@link Grid}, `header_row` is a GridRow; here it is a boolean. */
	header_row?: boolean;
	configure_columns?: boolean;
	/**
	 * Filter-row flag. `show_search_row()` OVERWRITES it with the result of its own
	 * threshold test (grid_row.js:883-885), so after that call it can also be
	 * `undefined`.
	 */
	show_search?: boolean;

	// -------------------------------------------------------- set in constructor

	/** fieldname → live control, filled by `make_control` (frappe/public/js/frappe/form/grid_row.js:11, 1209). */
	on_grid_fields_dict: Record<string, BaseControl>;
	/** frappe/public/js/frappe/form/grid_row.js:12, 1210 — same controls in creation order. */
	on_grid_fields: BaseControl[];
	/** fieldname → rendered cell (frappe/public/js/frappe/form/grid_row.js:15, 1076). Stays EMPTY on the filter row. */
	columns: Record<string, GridColumn>;
	/**
	 * frappe/public/js/frappe/form/grid_row.js:16, 1077 — same cells in column
	 * order. The LAST one carries `.grid-data-last` after `setup_columns`
	 * (frappe/public/js/frappe/form/grid_row.js:767-768).
	 */
	columns_list: GridColumn[];
	/** The checkbox markup; rewritten with `tabindex="-1"` for the header row (frappe/public/js/frappe/form/grid_row.js:17, 245). */
	row_check_html: string;
	/** 20 — the fallback for `meta.rows_threshold_for_grid_search` (frappe/public/js/frappe/form/grid_row.js:18, 879-882). */
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

	/** `.row-check` gutter cell (grid_row.js:248, 267). */
	row_check: JQuery;
	/** `.row-index` gutter cell — the row number, or the index search input (frappe/public/js/frappe/form/grid_row.js:254, 271). */
	row_index: JQuery;
	/** Template-rendered body; only for grids with `grid.template` (grid_row.js:222). */
	row_display?: JQuery;
	/**
	 * The open-form button.
	 *
	 * REASSIGNED mid-method: created as the outer `div.col`
	 * (frappe/public/js/frappe/form/grid_row.js:332), then overwritten with the
	 * inner `.btn-open-row` (frappe/public/js/frappe/form/grid_row.js:340) unless
	 * `configure_columns` is set. The outer cell is then reachable only via
	 * `.parent()` — which is what frappe/public/js/frappe/form/grid_row.js:1438
	 * and the global `escape` handler
	 * (frappe/public/js/frappe/form/grid_row.js:361-363) rely on.
	 */
	open_form_button?: JQuery;
	/** The Configure Columns gear cell; header row only (frappe/public/js/frappe/form/grid_row.js:371, 381). */
	configure_columns_button?: JQuery;

	// ------------------------------------------------------ set in setup_columns()

	/** grid_row.js:719. */
	focus_set: boolean;
	/** fieldname → search cell. Plain `JQuery`, NOT {@link GridColumn} (frappe/public/js/frappe/form/grid_row.js:720, 932). */
	search_columns: Record<string, JQuery>;

	// --------------------------------------------- set by the Configure Columns dialog

	/** grid_row.js:388. */
	grid_settings_dialog?: Dialog;
	/** frappe/public/js/frappe/form/grid_row.js:424, 491, 630, 693 — the dialog's working copy of the column list. */
	selected_columns_for_grid?: GridColumnSetting[];
	/** The dialog's HTML-field wrapper ELEMENT (not a jQuery object) — frappe/public/js/frappe/form/grid_row.js:435. */
	fields_html_wrapper?: HTMLElement;

	// ------------------------------------------------------------- set in show_form()

	/** frappe/public/js/frappe/form/grid_row.js:1385. Persists after `hide_form()` — only its wrapper is hidden (frappe/public/js/frappe/form/grid_row.js:1433). */
	grid_form?: GridRowForm;

	/**
	 * NEVER ASSIGNED. `evaluate_depends_on_value` passes `this.doctype` and
	 * `this.docname` to `script_manager.trigger` for `fn:` expressions
	 * (grid_row.js:860-864), but nothing in grid.js or grid_row.js ever sets either.
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
	/** Removes the row from the model and refreshes the grid; no-ops when the grid is read-only (frappe/public/js/frappe/form/grid_row.js:91-145). */
	remove(): void;
	/** @param below insert AFTER this row rather than before it; @param duplicate copy this row's values. */
	insert(show?: boolean | undefined, below?: boolean | undefined, duplicate?: boolean | undefined): void;
	/** Prompts for a target row number and reorders (grid_row.js:153-187). */
	move(): void;
	/** Re-reads `doc` from `locals` and re-renders (grid_row.js:188-203). */
	refresh(): void;
	render_template(): void;
	/**
	 * Builds the gutters and cells (grid_row.js:232-319).
	 *
	 * Returns `true`, or `undefined` when a filter row decides not to render
	 * (grid_row.js:233). DISCREPANCY: the `refresh` parameter is declared
	 * (grid_row.js:232) and passed by `refresh()` (grid_row.js:196) but never read
	 * in the body.
	 */
	render_row(refresh?: boolean | undefined): true | undefined;
	make_editable(): void;
	/** `row.width() < 300` (grid_row.js:325-327). */
	is_too_small(): boolean;
	/** Creates the trailing open-form cell; no-ops without `doc`, or when `df.in_place_edit` (frappe/public/js/frappe/form/grid_row.js:329-366). */
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
	 * Builds every cell for this row (frappe/public/js/frappe/form/grid_row.js:718-784).
	 *
	 * Calls `grid.setup_visible_columns()` first, then makes (or refreshes) one
	 * cell per `visible_columns` entry, handing `make_column` /
	 * `make_search_column` the entry's PIXEL width
	 * (frappe/public/js/frappe/form/grid_row.js:728-751). It ends by moving
	 * `.grid-data-last` to the last cell, so that column can grow into spare
	 * width (frappe/public/js/frappe/form/grid_row.js:766-768), and by realising
	 * the control of any Button column
	 * (frappe/public/js/frappe/form/grid_row.js:777-783).
	 *
	 * Through v16.33 this ended by latching `.column-limit-reached` on
	 * `.form-grid-container` whenever the column spans totalled more than 10 —
	 * the horizontal-scroll hack. v16.50 removed it, along with the span
	 * arithmetic; an override written to undo it no longer has anything to undo.
	 */
	setup_columns(): void;
	/**
	 * Button columns show their control even in an idle row
	 * (frappe/public/js/frappe/form/grid_row.js:790-798).
	 *
	 * Returns `undefined` rather than `false` when `this.doc` is absent, because
	 * `this.doc` is the second-to-last operand of the `&&` chain
	 * (frappe/public/js/frappe/form/grid_row.js:795).
	 */
	should_show_button_in_idle_grid_cell(column: GridColumn): boolean | undefined;
	/** Prefers the row's own docfield, copying `sticky`/`in_list_view` across (grid_row.js:800-810). */
	get_column_docfield(fields: GridDocField[], fieldname: string): GridDocField | undefined;
	/** Evaluates `depends_on`/`mandatory_depends_on`/`read_only_depends_on` onto `df`; returns whether anything changed (grid_row.js:812-825). */
	set_dependant_property(df: GridDocField): boolean;
	refresh_dependency(): void;
	/**
	 * Evaluates one depends-on expression (grid_row.js:841-875).
	 *
	 * Accepts a boolean, a function, an `eval:` string, a `fn:` string, or a bare
	 * fieldname. The result is whatever the expression produced — coerced to
	 * boolean only for the bare-fieldname branch — hence `unknown`. Returns
	 * `undefined` immediately when the row has no `doc` (grid_row.js:845).
	 */
	evaluate_depends_on_value(
		expression: string | boolean | ((doc: GridChildDoc) => unknown)
	): unknown;
	/**
	 * Decides whether the filter row is shown, and REMOVES `this.wrapper` when it
	 * is not (grid_row.js:886) — which is why `search_columns` is empty on a small
	 * grid. Also OVERWRITES `this.show_search` (grid_row.js:883).
	 */
	show_search_row(): boolean | undefined;
	/**
	 * Maps a fieldtype to the alignment/overflow class its cell and search input
	 * share: `grid-overflow-no-ellipsis` for Text and Small Text, `text-right` for
	 * Int, Currency, Float and Percent, `text-center` for Check, otherwise `""`
	 * (frappe/public/js/frappe/form/grid_row.js:890-895). New in v16.50, when
	 * `make_column` and `make_search_column` stopped each keeping their own copy.
	 */
	_get_fieldtype_class(fieldtype: string): string;
	/**
	 * A plain `div.col.grid-static-col.search` holding one input — no
	 * `df`/`static_area` expandos (frappe/public/js/frappe/form/grid_row.js:897-964).
	 *
	 * `width` is PIXELS (through v16.33 the second parameter was a Bootstrap
	 * `colsize` span). It is written inline as `flex: 1 0 Npx; width: Npx`,
	 * followed by `left: <grid.get_sticky_offset(fieldname)>px` for a pinned
	 * column (frappe/public/js/frappe/form/grid_row.js:910-914). The cell carries
	 * `data-fieldname` (new in v16.50, so the resize handler and the sticky patch
	 * can find it) and is stored in `search_columns[df.fieldname]`
	 * (frappe/public/js/frappe/form/grid_row.js:919, 932).
	 */
	make_search_column(df: GridDocField, width: number): JQuery;
	/**
	 * The real data cell, with all the expandos
	 * (frappe/public/js/frappe/form/grid_row.js:966-1090).
	 *
	 * `width` is PIXELS (through v16.33 the second parameter was a Bootstrap
	 * `colsize` span); it is written inline as `flex: 1 0 Npx; width: Npx`, plus
	 * `left: <grid.get_sticky_offset(fieldname)>px` for a pinned column
	 * (frappe/public/js/frappe/form/grid_row.js:970-974). `txt` is the cell's
	 * initial static HTML. On the HEADER row, a data column also gets a
	 * `.grid-col-resize-handle` child — the target of
	 * {@link Grid.setup_column_resize} — except on mobile
	 * (frappe/public/js/frappe/form/grid_row.js:1067-1071).
	 */
	make_column(df: GridDocField, width: number, txt: string, ci: number): GridColumn;
	activate(): this;
	/**
	 * Swaps static areas for live controls (frappe/public/js/frappe/form/grid_row.js:1097-1146).
	 *
	 * Returns the literal `false` from the "made editable" branch (frappe/public/js/frappe/form/grid_row.js:1117)
	 * so a jQuery click handler can cancel the event; the other branch returns
	 * nothing.
	 */
	toggle_editable_row(show?: boolean | undefined): false | undefined;
	/**
	 * Instantiates the cell's control; no-ops if one already exists
	 * (frappe/public/js/frappe/form/grid_row.js:1148-1211). Requires `this.doc`.
	 * A Currency control also gets its symbol drawn into the cell
	 * ({@link GridRow.update_currency_symbol_in_grid_input},
	 * frappe/public/js/frappe/form/grid_row.js:1199-1204).
	 */
	make_control(column: GridColumn): void;
	set_arrow_keys(field: BaseControl): void;
	duplicate_row_using_keys(): void;
	/** Reads `metaKey`/`ctrlKey`/`which` (frappe/public/js/frappe/form/grid_row.js:1310-1311). */
	add_new_row_using_keys(e: KeyboardEvent): void;
	/** `$(".grid-row-open").data("grid_row")` via `frappe.ui.form.get_open_grid_form` (frappe/public/js/frappe/form/grid.js:38-40). */
	get_open_form(): GridRow | undefined;
	/**
	 * Open or close this row's detail form (grid_row.js:1342-1378).
	 *
	 * Returns `this` when there is no `doc` (grid_row.js:1344) or after
	 * showing/hiding (grid_row.js:1377), and `undefined` on the "already open"
	 * short-circuit (grid_row.js:1364). `show` defaults to "open unless some other
	 * row is open" (grid_row.js:1355).
	 *
	 * EXACTLY TWO PARAMETERS, deliberately (gaps.md §4.4). The verify phase
	 * suggested adding an optional third, `opts?: { modal?: boolean }`, because
	 * carbon_frappe's `CarbonGridRow` overrides this with a 3-arg signature
	 * (`tables/grid/grid_row.ts:301`) and calls it 3-arg from
	 * `tables/grid/row_menu.ts:101`. It is NOT added here: `grid_row.js:1342` is
	 * `toggle_view(show, callback)` and the body never reads an `arguments[2]`,
	 * so declaring the parameter would claim frappe honours an option it
	 * silently discards — the kind of compiling lie this package exists to
	 * prevent. Note also that frappe RE-ENTERS this method 2-arg when closing a
	 * different row (`grid_row.js:1367` `open_row.toggle_view(false)`), so a
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
	/**
	 * Builds {@link GridRowForm} on first use, freezes the desk, scrolls the row
	 * into view (frappe/public/js/frappe/form/grid_row.js:1379-1419).
	 *
	 * The freeze is `frappe.dom.freeze("", "grid-form")`
	 * (frappe/public/js/frappe/form/grid_row.js:1404) — through v16.33 the class
	 * argument was `"dark grid-form"`. The grid-form buttons it toggles are
	 * `.grid-insert-row-below, .grid-insert-row, .grid-duplicate-row` and
	 * `.grid-delete-row` (frappe/public/js/frappe/form/grid_row.js:1396-1402); the
	 * footer `.grid-append-row` button was removed from the form in v16.50.
	 */
	show_form(): void;
	/** UNCONDITIONALLY calls `frappe.dom.unfreeze()` (frappe/public/js/frappe/form/grid_row.js:1425) — balance it if you suppressed the matching freeze. */
	hide_form(): void;
	has_prev(): boolean;
	open_prev(): void;
	has_next(): boolean;
	open_next(): void;
	/** `undefined` when the index is out of range (frappe/public/js/frappe/form/grid_row.js:1457). */
	open_row_at_index(row_index: number): true | undefined;
	change_page_if_reqd(row_index: number): void;
	/** HTML-escapes the six plain-text fieldtypes before `frappe.format` (frappe/public/js/frappe/form/grid_row.js:1481-1494); passes anything else through. */
	_escape_for_format(value: unknown, df: GridDocField | undefined): unknown;
	/**
	 * The HTML a static (read-only) cell shows
	 * (frappe/public/js/frappe/form/grid_row.js:1496-1504). Text Editor, HTML
	 * Editor and Markdown Editor values are reduced to stripped text — a static
	 * cell clips to one line, so the rich markup would be wasted work — and every
	 * other value goes through `_escape_for_format` and `frappe.format`. New in
	 * v16.50; `setup_columns`, `toggle_editable_row` and `refresh_field` all
	 * build cell text through it now instead of calling `frappe.format` directly.
	 * `doc` is the document the formatter sees (the row's, or `frm.doc`). The
	 * return type is `frappe.format`'s own — `string | number` — because the
	 * stripped-text branch is the only one that is always a string.
	 */
	_format_static_value(value: unknown, df: GridDocField | undefined, doc: FrappeDoc | undefined): string | number;
	/**
	 * Reformats one cell and refreshes its control
	 * (frappe/public/js/frappe/form/grid_row.js:1506-1548). `txt` is recomputed
	 * through `_format_static_value` when there is a doc.
	 */
	refresh_field(fieldname: string, txt?: string | undefined): void;
	/**
	 * Draws the currency symbol inside a Currency cell's input, as a prefix or a
	 * suffix by the currency's `symbol_on_right`
	 * (frappe/public/js/frappe/form/grid_row.js:1550-1597). New in v16.50. Returns
	 * early when the control has no `$input`, when the grid is not editable, and
	 * for a compound symbol (one containing " or ", or longer than 3 characters).
	 * Called from `make_control` and `refresh_field`, and again on every `input`
	 * event of the control.
	 */
	update_currency_symbol_in_grid_input(field: BaseControl, df: GridDocField): void;
	/** THROWS a string when the fieldname is in neither the on-grid controls nor the grid form (frappe/public/js/frappe/form/grid_row.js:1605). */
	get_field(fieldname: string): BaseControl;
	/** Requires `grid.frm` — dereferences `this.grid.frm.get_perm` unguarded (frappe/public/js/frappe/form/grid_row.js:1614). */
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
 * still unset (grid_row.js:1384).
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
	/** `.form-area`, created by `make_form()` (grid_row_form.js:91). */
	form_area?: JQuery;
	/** Set by `set_active_tab` (grid_row_form.js:136). */
	active_tab?: unknown;

	/** Builds the form (if needed), rebuilds the Layout, and copies `grid.fieldinfo` onto the controls (grid_row_form.js:6-41). */
	render(): void;
	/** Idempotent — only builds when `form_area` is unset (grid_row_form.js:43). */
	make_form(): void;
	set_form_events(): void;
	/**
	 * Shows/hides the `.row-actions` buttons under `$parent` from `grid.is_editable()`
	 * (frappe/public/js/frappe/form/grid_row_form.js:123-125). Through v16.33 it
	 * also toggled the footer `.grid-append-row` button; v16.50 removed that
	 * button, its click handler and the footer's own `.row-actions` span.
	 */
	toggle_add_delete_button_display($parent: JQuery): void;
	/** No-ops for an unknown fieldname (grid_row_form.js:128). */
	refresh_field(fieldname: string): void;
	/**
	 * Called by `frappe.ui.form.Tab` as `layout.grid_row_form.set_active_tab?.(this)`
	 * (tab.js:114). Only `tab.df` is read (grid_row_form.js:144), so the parameter is
	 * typed structurally rather than pulling the Tab class in.
	 */
	set_active_tab(tab: { df?: DocField | undefined } | null | undefined): void;
	/** Focuses the first non-date input, 500ms later (grid_row_form.js:150-168). */
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
 * default export. Constructed by `Grid#setup_grid_pagination` (grid.js:257).
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
	 * contract every reader assumes (frappe/public/js/frappe/form/grid.js:281, 724;
	 * frappe/public/js/frappe/form/grid_row.js:1464).
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
	 * (frappe/public/js/frappe/form/grid_pagination.js:161-166); `from_refresh`
	 * suppresses both the select-all sync and the scroll-to-top
	 * (frappe/public/js/frappe/form/grid_pagination.js:174-177).
	 *
	 * Calls `grid.render_result_rows()` with NO arguments
	 * (frappe/public/js/frappe/form/grid_pagination.js:167).
	 */
	go_to_page(index?: number | undefined, from_refresh?: boolean | undefined): void;
	/**
	 * Sets the header's select-all checkbox to "every row on this page is
	 * checked" (frappe/public/js/frappe/form/grid_pagination.js:180-188). New in
	 * v16.50; through v16.33 `go_to_page` left the box as it was. `false` for an
	 * empty page. `go_to_page` calls it unless `from_refresh` is set.
	 */
	update_select_all_checkbox(): void;
	go_to_last_page_to_add_row(): void;
	/** `min(data.length, page_index * page_length)` — the exclusive end of the current page (grid_pagination.js:203-207). */
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

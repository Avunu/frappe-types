/**
 * `frappe.views` — List view, Report view, Query Report and their shared base.
 *
 * Source of truth: frappe **v16.50.0** (git tag `v16.50.0`, branch `version-16`).
 * Re-verified against v16.50.0: the line counts and every citation below are that
 * tag's (the stamp above is moved by `scripts/remap-citations.mjs --stamp`).
 * Every declaration below was read out of:
 *
 *   frappe/public/js/frappe/list/base_list.js          (1488 lines)
 *   frappe/public/js/frappe/list/list_view.js          (3394 lines)
 *   frappe/public/js/frappe/list/list_view_virtualization.js (422 lines, lazy bundle)
 *   frappe/public/js/frappe/list/list_settings.js      ( 487 lines)
 *   frappe/public/js/frappe/list/list_factory.js       ( 121 lines)
 *   frappe/public/js/frappe/list/list_filter/*.js      (saved layouts, lazy bundle)
 *   frappe/public/js/frappe/views/reports/report_view.js  (1936 lines)
 *   frappe/public/js/frappe/views/reports/query_report.js (2535 lines)
 *   frappe/public/js/frappe/views/reports/report_utils.js ( 354 lines)
 *   frappe/public/js/frappe/views/container.js         ( 118 lines)
 *   frappe/public/js/frappe/views/factory.js           (  53 lines)
 *   frappe/public/js/frappe/views/breadcrumbs.js       ( 270 lines, legacy shim)
 *
 * Citations in comments are full paths from the frappe repo root
 * (`frappe/public/js/frappe/<path>.js:line`); an older bare `file.js:line` is
 * relative to `frappe/public/js/frappe/`.
 *
 * DESIGN CONSTRAINT — the first consumer (`carbon_frappe`) monkey-patches these
 * prototypes and writes its own properties onto instances, under `strict: true`
 * with no `as any` / `@ts-ignore`. So:
 *
 *  - classes are `declare class` (so `extends` + `super()` work and `this`
 *    inside a prototype patch is typed);
 *  - each class is paired with an EMPTY same-named `interface` so consumers can
 *    declaration-merge extra members (`carbon_table`, …) via module
 *    augmentation instead of casting. See {@link ListView} for the recipe;
 *  - anything frappe genuinely leaves open is `unknown` or a named index
 *    signature, never `any`.
 */

import type {
	DataTable,
	DataTableCell,
	DataTableCellValue,
	DataTableColumn,
	DataTableDataRow,
	DataTableEditor,
	DataTableGetEditor,
	DataTableOptions,
	DataTableRow,
	DataTableRowIndex,
} from "./datatable";
import type { DocField, DocTypeMeta, IndicatorTuple, PartialDocField } from "./model";
// IMPORT-NAME FIXES — `Page` is `frappe.ui.Page`, declared in `utils.d.ts` (the
// fragment that owns `FrappePageRegions`), never in `core.d.ts`.
import type { Page } from "./utils";
// `charts.d.ts` exports no `Chart`. `ReportView#chart` holds the RESULT of
// `new frappe.Chart(...)` (frappe/public/js/frappe/views/reports/report_view.js:630), and `FrappeChartConstructor`'s
// construct signature returns `FrappeBaseChart` — so the instance type is what
// belongs here. (`FrappeChartConstructor` is the type of the `frappe.Chart`
// property itself; it is reachable as `Frappe["Chart"]`.)
import type { FrappeBaseChart } from "./charts";
import type { JQueryRegion } from "./globals";

/* ------------------------------------------------------------------ *
 * 1. Primitives shared by every view
 * ------------------------------------------------------------------ */

/**
 * The ten routable view modes.
 *
 * `frappe/public/js/frappe/list/base_list.js:1476-1487` — `frappe.views.view_modes = [...]`, and
 * `frappe/public/js/frappe/list/base_list.js:1488` `frappe.views.is_valid = (m) => view_modes.includes(m)`.
 * `frappe/public/js/frappe/list/list_factory.js:42` builds the class name as `frappe.views[view_name + "View"]`
 * (Kanban is the exception, `frappe/public/js/frappe/list/list_factory.js:21-40`: it picks the classic or the v2 engine
 * per board).
 */
export type FrappeViewName =
	| "List"
	| "Report"
	| "Dashboard"
	| "Gantt"
	| "Kanban"
	| "Calendar"
	| "Image"
	| "Inbox"
	| "Tree"
	| "Map";

/**
 * A frappe filter, in the 4-tuple wire form.
 *
 * `frappe/public/js/frappe/list/base_list.js:497-501` — `get_filters_for_args()` slices every filter to 4
 * because "filters might have a fifth param called hidden, we don't want to
 * pass that server side". So a filter in memory may carry a 5th element.
 */
export type ListFilterTuple = [
	doctype: string,
	fieldname: string,
	operator: string,
	value: unknown,
	hidden?: boolean
];

/**
 * A document as it arrives in a list/report view — i.e. the projection returned
 * by `frappe.desk.reportview.get`, NOT a full doc.
 *
 * `frappe/public/js/frappe/list/base_list.js:575-591` (`prepare_data`) assembles it via
 * `frappe.utils.dict(data.keys, data.values)`, so the concrete keys are the
 * requested `fields` and are only known at runtime — hence the index signature.
 *
 * STRICT NOTE: `name` is declared before the index signature on purpose. Adding
 * `[fieldname: string]: unknown` first would widen `doc.name` to `unknown` and
 * break `getRowId: (doc) => doc.name`.
 */
export interface FrappeListDoc {
	/** Always requested — `frappe/public/js/frappe/list/base_list.js:91` puts `frappe.model.std_fields_list` in every query (`frappe/public/js/frappe/list/list_view.js:271` for ListView). */
	name: string;
	/** `frappe/public/js/frappe/list/list_view.js:1894` `doc.docstatus || 0`; `frappe/public/js/frappe/views/reports/report_view.js:822-824`. */
	docstatus?: 0 | 1 | 2;
	/** `frappe/public/js/frappe/list/list_view.js:1666` `comment_when(doc.modified, true)`. */
	modified?: string;
	/** JSON-encoded array of user ids. `frappe/public/js/frappe/list/list_view.js:1670`, `frappe/public/js/frappe/list/list_view.js:1117`. */
	_assign?: string | null;
	/** JSON-encoded array of user ids. `frappe/public/js/frappe/list/list_view.js:1831` `JSON.parse(doc._liked_by)`. */
	_liked_by?: string | null;
	/** JSON-encoded array of user ids. `frappe/public/js/frappe/list/list_view.js:1826` `JSON.parse(doc._seen)`. */
	_seen?: string | null;
	/** Comma-joined tag names. `frappe/public/js/frappe/list/list_view.js:1424-1425` → `get_tags_html(doc._user_tags, 2, true)`. */
	_user_tags?: string | null;
	/** `frappe/public/js/frappe/list/list_view.js:1685` `doc._comment_count > 99 ? "99+" : doc._comment_count || 0`. */
	_comment_count?: number;
	/**
	 * Row ordinal, WRITTEN onto the doc during render.
	 * `frappe/public/js/frappe/list/list_view.js:1068` `doc._idx = idx++;` (`frappe/public/js/frappe/list/list_view_virtualization.js:399` `doc._idx = i;` in virtual mode) —
	 * consumed as `data-idx` by `generate_button_html` (`frappe/public/js/frappe/list/list_view.js:1714`) /
	 * `generate_dropdown_html` (`frappe/public/js/frappe/list/list_view.js:1738`) and read back in `setup_action_handler`
	 * (`frappe/public/js/frappe/list/list_view.js:2160` `this.data[$button.attr("data-idx")]`).
	 */
	_idx?: number;
	[fieldname: string]: unknown;
}

/**
 * `this.parent` on every view.
 *
 * `frappe/public/js/frappe/list/base_list.js:7` `Object.assign(this, opts)` — `parent` comes straight from
 * the constructor options, and `frappe/public/js/frappe/list/list_factory.js:54-57` passes
 * `me.make_page(...)` → `frappe.make_page` (`frappe/public/js/frappe/views/factory.js:37-53`) → a raw
 * `<div class="content page-container">` from `frappe/public/js/frappe/views/container.js:38-49`, onto
 * which `frappe.ui.make_app_page` (`frappe/public/js/frappe/ui/page.js:22-32`) assigns `.page`.
 *
 * So it really is a DOM element that also carries a `frappe.ui.Page`; hence the
 * intersection rather than a plain object type.
 */
export interface PageContainerElement extends HTMLElement {
	/** `frappe/public/js/frappe/ui/page.js:23` `opts.parent.page = new frappe.ui.Page(opts)`. */
	page: Page;
	/** `frappe/public/js/frappe/views/container.js:45` `page.label = label`. */
	label?: string;
	/** `frappe/public/js/frappe/views/container.js:87` `this.page._route = frappe.router.get_sub_path()`. */
	_route?: string;
	/** `frappe/public/js/frappe/list/list_view.js:73` `this.parent.disable_scroll_to_top = true` (read at `frappe/public/js/frappe/views/container.js:89`). */
	disable_scroll_to_top?: boolean;
	/** `frappe/public/js/frappe/list/list_view.js:184` `this.parent.list_view = this`. */
	list_view?: ListView;
}

/**
 * Constructor options. `frappe/public/js/frappe/list/base_list.js:6-8` is literally
 * `constructor(opts) { Object.assign(this, opts); }`, so ANY property is
 * accepted and lands on the instance verbatim; the two below are the ones every
 * caller passes (`frappe/public/js/frappe/list/list_factory.js:54-57`, `frappe/public/js/frappe/views/reports/query_report.js:21-23`).
 */
export interface BaseListOptions {
	doctype?: string;
	parent: PageContainerElement;
	[option: string]: unknown;
}

/* ------------------------------------------------------------------ *
 * 2. listview_settings — the per-doctype JS customisation hook
 * ------------------------------------------------------------------ */

/** `frappe/public/js/frappe/list/list_view.js:1709-1727` `this.settings.button.get_label(doc)` etc. */
export interface ListViewSettingsButton {
	/** `frappe/public/js/frappe/list/list_view.js:1715` — rendered into `title="…"`. */
	get_description(doc: FrappeListDoc): string;
	/** `frappe/public/js/frappe/list/list_view.js:1716` — rendered as the button's inner HTML. */
	get_label(doc: FrappeListDoc): string;
	/** `frappe/public/js/frappe/list/list_view.js:1721` — falsy renders `<span></span>` instead of the button. */
	show(doc: FrappeListDoc): boolean;
}

/**
 * One entry of `settings.dropdown_button.buttons`.
 *
 * ASYMMETRY WORTH KNOWING: unlike {@link ListViewSettingsButton}, `get_label`
 * here is a **string property, not a function** — `frappe/public/js/frappe/list/list_view.js:1739`
 * interpolates `${button.get_label}` with no call, and so do `frappe/public/js/frappe/list/list_view.js:1749` /
 * `frappe/public/js/frappe/list/list_view.js:1757` for the parent dropdown's own `get_label`.
 */
export interface ListViewSettingsDropdownItem {
	/** A STRING, despite the `get_` prefix. `frappe/public/js/frappe/list/list_view.js:1739`. */
	get_label: string;
	/** `frappe/public/js/frappe/list/list_view.js:1735` — omitted means "always show". */
	show?(doc: FrappeListDoc): boolean;
	/** `frappe/public/js/frappe/list/list_view.js:1736`. */
	get_description?(doc: FrappeListDoc): string;
	/** `frappe/public/js/frappe/list/list_view.js:2172-2174` `button.action(doc)`. */
	action?(doc: FrappeListDoc): void;
}

/** `frappe/public/js/frappe/list/list_view.js:1729-1763`. */
export interface ListViewSettingsDropdownButton {
	/** A STRING. `frappe/public/js/frappe/list/list_view.js:1749`, `frappe/public/js/frappe/list/list_view.js:1757`. */
	get_label: string;
	buttons: ListViewSettingsDropdownItem[];
}

/**
 * `frappe.listview_settings[doctype]`, i.e. `this.settings` on every view.
 *
 * `frappe/public/js/frappe/list/base_list.js:47` — `this.settings = frappe.listview_settings[this.doctype] || {}`.
 * The `|| {}` is why **every member is optional**: the object is frequently
 * absent entirely, and app-supplied ones set only a couple of keys.
 *
 * Members below are exactly those frappe itself reads
 * (`grep -o 'this\.settings\.[a-z_]*'` over base_list/list_view/report_view).
 */
export interface ListViewSettings {
	/** `frappe/public/js/frappe/list/list_view.js:274` — extra fieldnames pulled into the query. */
	add_fields?: (string | DocField)[];
	/** `frappe/public/js/frappe/list/list_view.js:972` `this.settings.before_render && this.settings.before_render()` — NO arguments. */
	before_render?(): void;
	/** `frappe/public/js/frappe/list/list_view.js:1711`, `frappe/public/js/frappe/list/list_view.js:1713-1721`. */
	button?: ListViewSettingsButton;
	/** `frappe/public/js/frappe/list/list_view.js:1732`. */
	dropdown_button?: ListViewSettingsDropdownButton;
	/** `frappe/public/js/frappe/list/list_view.js:138-143` / `frappe/public/js/frappe/list/list_view.js:816-821` — 3-tuples are expanded to 4 with `this.doctype` in front. */
	filters?: (ListFilterTuple | [fieldname: string, operator: string, value: unknown])[];
	/**
	 * Per-fieldname cell renderer, returning HTML.
	 * `frappe/public/js/frappe/list/list_view.js:1545-1547` `this.settings.formatters[fieldname](value, df, doc)`
	 * (never for the Subject column) and `frappe/public/js/frappe/list/list_view.js:1869-1871` for the Subject text.
	 */
	formatters?: Record<string, (value: unknown, df: DocField, doc: FrappeListDoc) => string>;
	/** `frappe/public/js/frappe/list/list_view.js:1816-1818` — overrides the row's link href. */
	get_form_link?(doc: FrappeListDoc): string;
	/**
	 * `frappe/public/js/frappe/model/indicator.js:8` (existence check in `frappe.has_indicator`) and
	 * `frappe/public/js/frappe/model/indicator.js:37` — consulted by `frappe.get_indicator`.
	 */
	get_indicator?(doc: FrappeListDoc): IndicatorTuple | null | undefined;
	/** `frappe/public/js/frappe/list/list_view.js:561` — suppresses the trailing synthetic "ID" column. */
	hide_name_column?: boolean;
	/** `frappe/public/js/frappe/list/list_view.js:420` (ListView) and `frappe/public/js/frappe/views/reports/report_view.js:96` (ReportView) — both pass the view. */
	onload?(view: BaseList): void;
	/** `frappe/public/js/frappe/list/list_view.js:345-346`, `frappe/public/js/frappe/list/list_view.js:2281-2282` — replaces "Add {doctype}". Takes NO arguments. */
	primary_action?(): void;
	/** `frappe/public/js/frappe/list/base_list.js:556-558` `this.settings.refresh(this)` — fired after every refresh. */
	refresh?(view: BaseList): void;
	/**
	 * Extra bundles to `frappe.require` before the first render.
	 * `frappe/public/js/frappe/list/list_view.js:323-329` reads `this.required_libs` (an instance property that
	 * subclasses such as GanttView set), not `settings.required_libs`.
	 */
	[extra: string]: unknown;
}

/**
 * The **"List View Settings"** DOCTYPE document — `this.list_view_settings`.
 * Fetched by `frappe/public/js/frappe/list/base_list.js:77-83` (`frappe.desk.listview.get_list_settings`),
 * defaulting to `{}`.
 *
 * Field list verified against
 * `frappe/desk/doctype/list_view_settings/list_view_settings.json` at v16.50.0
 * (unchanged from v16.33.0).
 * All Check fields, so `0 | 1` (never JS booleans) when the doc exists.
 */
export interface ListViewDBSettings {
	/** `frappe/public/js/frappe/list/list_view.js:768`, `frappe/public/js/frappe/list/list_view.js:1208`. */
	disable_count?: 0 | 1;
	/** A doctype field (`frappe/desk/doctype/list_view_settings/list_view_settings.py:25`); no desk JS reads it at v16.50.0. */
	disable_sidebar_stats?: 0 | 1;
	/** `frappe/public/js/frappe/list/list_view.js:2297`, `frappe/public/js/frappe/views/reports/report_view.js:79`. */
	disable_auto_refresh?: 0 | 1;
	/** `frappe/public/js/frappe/list/list_view.js:778`, `frappe/public/js/frappe/list/list_view.js:1682`. */
	disable_comment_count?: 0 | 1;
	/** `frappe/public/js/frappe/list/list_view.js:2798` — bulk edit on a workflow doctype. */
	allow_edit?: 0 | 1;
	/** `frappe/public/js/frappe/list/list_view.js:150`. */
	disable_automatic_recency_filters?: 0 | 1;
	/** `frappe/public/js/frappe/list/list_view.js:1578`, `frappe/public/js/frappe/list/list_view.js:1609`. */
	disable_scrolling?: 0 | 1;
	/** `frappe/public/js/frappe/list/list_view.js:426`, `frappe/public/js/frappe/list/list_view.js:2291` — feeds `tags_shown`. */
	show_tags?: 0 | 1;
	/**
	 * A JSON-encoded {@link ListSettingsField}`[]` (`{fieldname, label, width?}`).
	 * `frappe/public/js/frappe/list/list_view.js:549`, `frappe/public/js/frappe/list/list_view.js:676-677`, `frappe/public/js/frappe/list/list_view.js:935-936`, `frappe/public/js/frappe/list/list_settings.js:13`.
	 */
	fields?: string;
}

/**
 * `this.view_user_settings` — `frappe.get_user_settings(doctype)[view_name]`.
 * `frappe/public/js/frappe/list/base_list.js:48`, `frappe/public/js/frappe/list/list_view.js:116-118`.
 */
export interface ListViewUserSettings {
	filters?: ListFilterTuple[];
	sort_by?: string;
	sort_order?: "asc" | "desc";
	last_view?: string;
	/** ReportView only — `frappe/public/js/frappe/views/reports/report_view.js:853-856`. */
	fields?: [fieldname: string, doctype: string][];
	/** ReportView only — `frappe/public/js/frappe/views/reports/report_view.js:65`. */
	add_totals_row?: 0 | 1;
	/** ReportView only — `frappe/public/js/frappe/views/reports/report_view.js:123-124`. */
	group_by?: unknown;
	/** ReportView only — `frappe/public/js/frappe/views/reports/report_view.js:66`. */
	chart_args?: ReportChartArgs | null;
	[key: string]: unknown;
}

/* ------------------------------------------------------------------ *
 * 3. ListView column descriptors
 * ------------------------------------------------------------------ */

export type ListColumnType = "Subject" | "Status" | "Tag" | "Field";

/**
 * One column of a saved list layout or of the List View Settings `fields`
 * JSON: the ordered `{fieldname, label, width}` rows that `setup_columns`
 * turns back into {@link ListColumn}s (`frappe/public/js/frappe/list/list_view.js:645-671`).
 *
 * `width` is a pixel number written by a column drag (`frappe/public/js/frappe/list/list_view.js:919-969`) or the
 * settings dialog (`frappe/public/js/frappe/list/list_settings.js:290-296`); `get_current_columns_state` can also pass a
 * DocField's own `width` string through (`frappe/public/js/frappe/list/list_filter/list_filter_menu.js:362-387`), and every reader goes
 * through `cint(...)`, so it is declared as either.
 */
export interface ListLayoutField {
	fieldname: string;
	label?: string;
	width?: number | string | null;
}

/**
 * A ListView column descriptor, as built by `setup_columns()`
 * (`frappe/public/js/frappe/list/list_view.js:486-576`) or, when a saved layout / the settings `fields` apply,
 * by `build_columns_from_fields()` (`frappe/public/js/frappe/list/list_view.js:645-671`).
 *
 * This is a DISCRIMINATED UNION on purpose: `Tag` (`frappe/public/js/frappe/list/list_view.js:502`, `frappe/public/js/frappe/list/list_view.js:556-558`)
 * is pushed with **no `df` at all**, while `Subject`, `Field` and `Status`
 * can carry one. Flattening it to `{ type: string; df?: DocField }` forces
 * non-null assertions at every `col.df.fieldname` in the Subject branch of a
 * consumer's header renderer.
 *
 * Every `df` is a {@link PartialDocField}, not a full DocField, because frappe
 * builds SYNTHETIC ones: `frappe/public/js/frappe/list/list_view.js:513-519` and `frappe/public/js/frappe/list/list_view.js:565-571` push
 * `{ label: __("ID"), fieldname: "name" }`, and `frappe/public/js/frappe/list/list_view.js:659-662` does the same for
 * a layout field that is not a real docfield — no `fieldtype`, no `parent`, no
 * `options`.
 *
 * `Status` is where v16.50.0 changed the shape. The default build still pushes
 * a bare `{ type: "Status" }` (`frappe/public/js/frappe/list/list_view.js:525-527`), but a column built from a
 * layout carries `df: { fieldname: "status_field" }` plus the saved `width`
 * (`frappe/public/js/frappe/list/list_view.js:653-655`, `frappe/public/js/frappe/list/list_view.js:694-695`). The header and the cell both write
 * `status_field` as their `data-fieldname` whether or not there is a `df`
 * (`frappe/public/js/frappe/list/list_view.js:1282`, `frappe/public/js/frappe/list/list_view.js:1410`), so the `df` is only ever `{ fieldname, width }`.
 *
 * The `Tag` member carries `df?: undefined` rather than omitting the key.
 * Omitting it makes the whole union lack a common `df`, and TypeScript then
 * rejects the ubiquitous `col.df && col.df.fieldname` guard with TS2339 before
 * it ever narrows. With `df?: undefined` the guard compiles, and `col.df` is
 * `PartialDocField | undefined` on an unnarrowed column. Same reason frappe's
 * own `get_header_html` can write `col.df?.fieldname` unconditionally
 * (`frappe/public/js/frappe/list/list_view.js:1275`, `frappe/public/js/frappe/list/list_view.js:1282`).
 */
export type ListColumn =
	/** `frappe/public/js/frappe/list/list_view.js:507-520` — title_field, or the synthetic ID df. Always first; `frappe/public/js/frappe/list/list_view.js:666` when built from a layout. */
	| { type: "Subject"; df: PartialDocField }
	/** `frappe/public/js/frappe/list/list_view.js:523-528` — pushed only when `frappe.has_indicator(doctype)`; `df` only on a layout-built column (see above). */
	| { type: "Status"; df?: PartialDocField }
	/** `frappe/public/js/frappe/list/list_view.js:556-558` (and `frappe/public/js/frappe/list/list_view.js:502` for a layout) — spliced in at index 1, after the slice. NO `df`. */
	| { type: "Tag"; df?: undefined }
	/** `frappe/public/js/frappe/list/list_view.js:543-546` (in_list_view fields), `frappe/public/js/frappe/list/list_view.js:565-571` (trailing ID) and `frappe/public/js/frappe/list/list_view.js:666-667` (layout). */
	| { type: "Field"; df: PartialDocField };

/* ------------------------------------------------------------------ *
 * 4. BaseList
 * ------------------------------------------------------------------ */

/**
 * `frappe.views.BaseList` — `frappe/public/js/frappe/list/base_list.js:5`.
 *
 * A class EXPRESSION assigned onto a `frappe.provide("frappe.views")` namespace,
 * so at runtime the only handle is `frappe.views.BaseList`.
 */
export declare class BaseList {
	/** `frappe/public/js/frappe/list/base_list.js:6-8` — `Object.assign(this, opts)`; nothing is validated. */
	constructor(opts: BaseListOptions);

	/* ---- identity ---- */
	doctype: string;
	/** `frappe/public/js/frappe/list/base_list.js:174` — `this.page = this.parent.page`. */
	parent: PageContainerElement;
	page: Page;
	/** `frappe/public/js/frappe/list/base_list.js:175` `this.$page = $(this.parent)`. */
	$page: JQuery<HTMLElement>;
	/** `frappe/public/js/frappe/list/base_list.js:44` `frappe.get_route_str()`. */
	page_name: string;
	/** `frappe/public/js/frappe/list/base_list.js:45`. */
	page_title: string;
	/** `frappe/public/js/frappe/list/base_list.js:46` `frappe.get_meta(this.doctype)`. */
	meta: DocTypeMeta;
	/** `frappe/public/js/frappe/list/base_list.js:47` — `frappe.listview_settings[doctype] || {}`. */
	settings: ListViewSettings;
	/** `frappe/public/js/frappe/list/base_list.js:48`. */
	user_settings: Record<string, ListViewUserSettings>;
	/** `frappe/public/js/frappe/list/base_list.js:82` — resolved from the server; `{}` when unset. */
	list_view_settings?: ListViewDBSettings;
	/**
	 * `"List"` / `"Report"` / … — the `view` sent in `get_args()`.
	 * Set by the subclass (`frappe/public/js/frappe/list/list_view.js:123`, `frappe/public/js/frappe/views/reports/report_view.js:37`), never by BaseList.
	 */
	view?: FrappeViewName;
	/**
	 * Whether this view offers the saved-layout menu. A GETTER on the subclasses:
	 * `true` on ListView (`frappe/public/js/frappe/list/list_view.js:112-114`), `false` on ReportView (`frappe/public/js/frappe/views/reports/report_view.js:24-26`), and
	 * absent on BaseList itself and on QueryReport — which is why it is optional.
	 * `setup_list_filter_by` reads it to decide whether to load the lazy
	 * `list_filter.bundle.js` at all (`frappe/public/js/frappe/list/base_list.js:642-644`).
	 */
	readonly show_saved_layout_menu?: boolean;
	/**
	 * The saved-layout controller, created by `setup_list_filter_by` once
	 * `list_filter.bundle.js` has loaded (`frappe/public/js/frappe/list/base_list.js:646-651`). UNDEFINED on a view
	 * with `show_saved_layout_menu` false, and until `show()` has run
	 * `setup_list_filter_by` — which is why every frappe read of it is `?.`
	 * (`frappe/public/js/frappe/list/list_view.js:491`, `frappe/public/js/frappe/list/list_view.js:803`, `frappe/public/js/frappe/list/list_view.js:921`).
	 */
	list_filter?: ListFilter;

	/* ---- query state ---- */
	/** `frappe/public/js/frappe/list/base_list.js:50` `this.start = 0`; advanced by "Load More" (`frappe/public/js/frappe/list/base_list.js:417-421`). */
	start: number;
	/** `frappe/public/js/frappe/list/base_list.js:51` — `frappe.is_large_screen() ? 100 : 20`. */
	page_length: number;
	/** `frappe/public/js/frappe/list/base_list.js:52`. */
	selected_page_count: number;
	/** `frappe/public/js/frappe/list/base_list.js:53` `this.data = []`; replaced wholesale in `prepare_data` (`frappe/public/js/frappe/list/base_list.js:584-590`). */
	data: FrappeListDoc[];
	/** `frappe/public/js/frappe/list/base_list.js:54` — `"frappe.desk.reportview.get"`. */
	method: string;
	/**
	 * `[fieldname, doctype]` pairs. `frappe/public/js/frappe/list/base_list.js:59` `this.fields = []`, normalised
	 * by `build_fields()` (`frappe/public/js/frappe/list/base_list.js:108-120`) which turns bare strings into pairs.
	 */
	fields: [fieldname: string, doctype: string][];
	/**
	 * `frappe/public/js/frappe/list/base_list.js:60` `this.filters = []`.
	 *
	 * DECLARED AS A UNION because `QueryReport` reuses the same slot for a
	 * completely different thing: `frappe/public/js/frappe/views/reports/query_report.js:611-653` fills it with the
	 * built filter *controls* (`page.add_field(df, …)` merged with their
	 * DocField via `Object.assign(f, df)`), not with filter tuples. `ListView`
	 * narrows it back to `ListFilterTuple[]`; see the notes file.
	 */
	filters: ListFilterTuple[] | QueryReportFilterControl[];
	sort_by: string;
	sort_order: string;
	/** `frappe/public/js/frappe/list/base_list.js:149-159` — `["_user_tags", …workflow_state_fieldname]`. */
	stats?: string[];
	workflow_state_fieldname?: string | null;
	can_create: boolean;
	can_write: boolean;
	/** `frappe/public/js/frappe/list/base_list.js:565-568` — `JSON.stringify` of the last call args, or null. */
	last_args?: string | null;

	/* ---- DOM handles (created in setup_main_section) ---- */
	/** `frappe/public/js/frappe/list/base_list.js:310` `$('<div class="frappe-list">')`. */
	$frappe_list: JQuery<HTMLElement>;
	/**
	 * `frappe/public/js/frappe/list/base_list.js:352` `$('<div class="result">')`.
	 *
	 * A {@link JQueryRegion} (gaps.md §6.12): built from a literal template, so
	 * `$result[0]` / `$result.get(0)` are elements without a `!`. The
	 * `$result.find(...)` handles below stay plain `JQuery` — those really can
	 * miss, which is why `list_view.js` guards them with the
	 * `x = x || this.$result.find(...)` idiom.
	 */
	$result: JQueryRegion;
	/** `frappe/public/js/frappe/list/base_list.js:361-366` — hidden `.no-result`. */
	$no_result: JQuery<HTMLElement>;
	/** `frappe/public/js/frappe/list/base_list.js:370` — hidden `.freeze`. */
	$freeze: JQuery<HTMLElement>;
	/** `frappe/public/js/frappe/list/base_list.js:380-385` `.list-paging-area.level`. */
	$paging_area: JQuery<HTMLElement>;
	/** `frappe/public/js/frappe/list/base_list.js:664` — created by `FilterArea`'s constructor (`frappe/public/js/frappe/list/base_list.js:315`). */
	$filter_section?: JQuery<HTMLElement>;

	/* ---- collaborators ---- */
	/** `frappe/public/js/frappe/list/base_list.js:315`. `FilterArea` is a MODULE-LOCAL class (`frappe/public/js/frappe/list/base_list.js:655`), not exported. */
	filter_area?: FilterArea;
	/** `frappe/public/js/frappe/list/base_list.js:326-334` — `new frappe.ui.SortSelector({...})`. */
	sort_selector?: SortSelector;
	/**
	 * `frappe/public/js/frappe/list/base_list.js:214-220` — `new frappe.views.ListViewSelect({...})`, the view switcher
	 * (only when `desk_settings.view_switcher` is on and the doctype does not
	 * force its default view). It replaced the old `views_menu` button group,
	 * which no longer exists anywhere in frappe.
	 */
	views_list?: unknown;
	/**
	 * `frappe/public/js/frappe/list/base_list.js:391-411` — the page-size radio group (20 / 100 / 500 / 2500), a
	 * `frappe.ui.TabButtons`. It replaced the `.btn-paging` buttons, which are gone.
	 */
	paging_button_group?: ListPagingButtonGroup;

	/* ---- menu / actions ---- */
	primary_action: unknown;
	secondary_action: { label?: string; action?: () => void; icon?: string } | null;
	menu_items: ListViewMenuItem[];
	refresh_button?: JQuery<HTMLElement>;
	/** `frappe/public/js/frappe/list/base_list.js:25-40` — memoised init chain. */
	init_promise?: Promise<unknown>;

	/* ---- lifecycle ---- */
	/**
	 * `frappe/public/js/frappe/list/base_list.js:10-22`.
	 *
	 * DECLARED `void | Promise<unknown>` because `ListView.show()`
	 * (`frappe/public/js/frappe/list/list_view.js:72-75`) calls `super.show()` but does NOT return it, and
	 * `QueryReport.show()` (`frappe/public/js/frappe/views/reports/query_report.js:31-33`) returns undefined too.
	 * BaseList's own implementation returns the `frappe.run_serially` promise —
	 * skeleton, `fetch_meta`, permissions, `init`, `filter_area.place_id_filter`,
	 * `setup_list_filter_by`, `before_refresh`, then `refresh`.
	 */
	show(): void | Promise<unknown>;
	/** `frappe/public/js/frappe/list/base_list.js:24-41` — memoised via `init_promise`. */
	init(): Promise<unknown>;
	/**
	 * `frappe/public/js/frappe/list/base_list.js:43-75`.
	 *
	 * `void | Promise<unknown>` because subclasses widen it: `frappe/public/js/frappe/list/list_view.js:120-147`
	 * returns `this.get_list_view_settings().then(...)`, `frappe/public/js/frappe/views/reports/report_view.js:32-69`
	 * returns either a Promise or `undefined` depending on `this.report_name`.
	 */
	setup_defaults(): void | Promise<unknown>;
	/** `frappe/public/js/frappe/list/base_list.js:77-83` — resolves `list_view_settings`. */
	get_list_view_settings(): Promise<ListViewDBSettings>;
	/** `frappe/public/js/frappe/list/base_list.js:85-88`. */
	setup_fields(): Promise<void>;
	/**
	 * `frappe/public/js/frappe/list/base_list.js:90-94` (async), `frappe/public/js/frappe/list/list_view.js:268-317` (async),
	 * `frappe/public/js/frappe/views/reports/report_view.js:845-861` (**synchronous**).
	 * The union is the price of that inconsistency; see the notes file.
	 */
	set_fields(): void | Promise<void>;
	/** `frappe/public/js/frappe/list/base_list.js:96-106` — the `in_list_view` / Currency / `status` docfields. */
	get_fields_in_list_view(): DocField[];
	/** `frappe/public/js/frappe/list/base_list.js:108-120` — normalises `fields` to `[fieldname, doctype]` and de-dupes. */
	build_fields(): void;
	/** `frappe/public/js/frappe/list/base_list.js:122-147`. Accepts a fieldname OR a whole DocField. */
	_add_field(fieldname: string | DocField | null | undefined, doctype?: string): void;
	/** `frappe/public/js/frappe/list/base_list.js:149-159`. */
	set_stats(): void;
	/** `frappe/public/js/frappe/list/base_list.js:161-163` — `frappe.model.with_doctype(this.doctype)`. */
	fetch_meta(): Promise<unknown>;
	/** `frappe/public/js/frappe/list/base_list.js:165` / `frappe/public/js/frappe/list/base_list.js:167` — no-ops on BaseList, overridden by ListView. */
	show_skeleton(): void;
	hide_skeleton(): void;
	/** `frappe/public/js/frappe/list/base_list.js:169-171` — returns `true`; ListView throws instead (`frappe/public/js/frappe/list/list_view.js:77-82`). */
	check_permissions(): boolean | void;
	setup_page(): void;
	setup_page_head(): void;
	/**
	 * `frappe/public/js/frappe/list/base_list.js:188-194` — names the browser tab only. The title text itself is the
	 * last crumb, which `set_breadcrumbs` has already written, so there is no
	 * `page.set_title(...)` call any more.
	 */
	set_title(): void;
	/** `frappe/public/js/frappe/list/base_list.js:196-208` — adds a `.deprecated-badge` to the page title when `meta.deprecated`. */
	set_deprecated_badge(): void;
	setup_view_menu(): void;
	set_default_secondary_action(): void;
	set_menu_items(): void;
	/** `frappe/public/js/frappe/list/base_list.js:280-282` — `this.page.set_breadcrumbs(this.get_breadcrumbs())`; QueryReport no longer overrides it. */
	set_breadcrumbs(): void;
	/** `frappe/public/js/frappe/list/base_list.js:284-287` — the list is the page, so its one crumb is the title and carries no link. */
	get_breadcrumbs(): { label: string; title?: string | undefined }[];
	hide_sidebar(): void;
	setup_main_section(): Promise<unknown>;
	setup_list_wrapper(): void;
	setup_filter_area(): Promise<unknown> | void;
	setup_sort_selector(): void;
	on_sort_change(...args: unknown[]): void;
	setup_result_container_area(): void;
	setup_result_area(): void;
	setup_no_result_area(): void;
	setup_freeze_area(): void;
	get_no_result_message(): string;
	setup_paging_area(): void;
	setup_resize_handler(): void;
	/**
	 * `frappe/public/js/frappe/list/base_list.js:440-470` — no-ops unless `this.view === "List"` (`frappe/public/js/frappe/list/base_list.js:441`). On mobile
	 * it drops the fixed container height instead, unless virtualization is on
	 * (`frappe/public/js/frappe/list/base_list.js:451-454`).
	 */
	set_result_height(): void;
	/** `frappe/public/js/frappe/list/base_list.js:472-475` — `[fieldname, doctype]` → `` `tabDoctype`.`fieldname` ``. */
	get_fields(): string[];
	get_group_by(): string | null;
	/**
	 * `frappe/public/js/frappe/list/base_list.js:485-487` — extension point, empty on BaseList.
	 *
	 * `void | Promise<void>` because `ListView.setup_view` is `async`
	 * (`frappe/public/js/frappe/list/list_view.js:415-422`) while ReportView overrides it synchronously
	 * (`frappe/public/js/frappe/views/reports/report_view.js:71-76`); `init()` runs it through `frappe.run_serially`, which
	 * awaits a returned promise (`frappe/public/js/frappe/list/base_list.js:34`, `frappe/public/js/frappe/list/base_list.js:39`).
	 */
	setup_view(): void | Promise<void>;
	get_filter_value(fieldname: string): unknown;
	/** `frappe/public/js/frappe/list/base_list.js:497-501` — always sliced to 4 elements. */
	get_filters_for_args(): ListFilterTuple[];
	get_args(): ListViewArgs;
	get_call_args(): {
		method: string;
		args: ListViewArgs;
		freeze: boolean;
		freeze_message: string;
	};
	/** `frappe/public/js/frappe/list/base_list.js:533-536` — hook, empty on BaseList. */
	before_refresh(): Promise<unknown> | void;
	/**
	 * `frappe/public/js/frappe/list/base_list.js:538-560`.
	 *
	 * `| undefined` IS LOAD-BEARING: `frappe/public/js/frappe/list/list_view.js:319-322` and
	 * `frappe/public/js/frappe/views/reports/query_report.js:58-59` both rebind the instance property to
	 * `frappe.utils.throttle(this.refresh, …)`, and frappe's throttle
	 * (`frappe/public/js/frappe/utils/utils.js:895-927`, underscore-style) returns the *last* result —
	 * `undefined` until the leading call lands. Never chain `.then()` off
	 * `someView.refresh()`; use `BaseList.prototype.refresh.call(view)` if you
	 * need the promise.
	 */
	refresh(): Promise<void> | undefined;
	/** `frappe/public/js/frappe/list/base_list.js:562-573` — 3-second arg-identity throttle. */
	no_change(args: ListViewArgs): boolean;
	/**
	 * `frappe/public/js/frappe/list/base_list.js:575-591`.
	 *
	 * Parameter is `unknown`, NOT the response envelope, because
	 * `QueryReport.prepare_data` (`frappe/public/js/frappe/views/reports/query_report.js:1540-1552`) overrides it with
	 * an incompatible parameter — an already-unwrapped result array. Widening
	 * the base parameter is the only way both overrides type-check; see notes.
	 */
	prepare_data(r: unknown): void;
	reset_defaults(): void;
	/**
	 * `frappe/public/js/frappe/list/base_list.js:598` — declared with NO parameters but CALLED as
	 * `this.freeze(true)` / `this.freeze(false)` (`frappe/public/js/frappe/list/base_list.js:544`, `frappe/public/js/frappe/list/base_list.js:554`).
	 * Both implementations ignore the argument.
	 */
	freeze(state?: boolean): void;
	before_render(): void;
	after_render(): void;
	/** `frappe/public/js/frappe/list/base_list.js:606-608` — extension point, empty on BaseList. */
	render(...args: unknown[]): void;
	on_filter_change(): void;
	toggle_result_area(): void;
	call_for_selected_items(method: string, args?: Record<string, unknown>): void;
	/**
	 * `frappe/public/js/frappe/list/base_list.js:641-652` — loads `list_filter.bundle.js` on demand and builds
	 * {@link BaseList.list_filter}; resolves immediately when
	 * `show_saved_layout_menu` is falsy.
	 */
	setup_list_filter_by(): Promise<unknown>;
}
/** Augmentation seam — see {@link ListView}. */
export interface BaseList {}

/**
 * `this.paging_button_group` — a `frappe.ui.TabButtons` instance
 * (`frappe/public/js/frappe/ui/components/tab_buttons.js:53`). Only the two members the list code reaches are declared.
 */
export interface ListPagingButtonGroup {
	/** `frappe/public/js/frappe/ui/components/tab_buttons.js:113` — the radio group's root element. */
	$el: JQuery<HTMLElement>;
	/** `frappe/public/js/frappe/ui/components/tab_buttons.js:212-214` — the selected pill's `value` (a page size, here), or `null` when none is selected. */
	get_value(): unknown;
}

/** One entry of `this.menu_items` — `frappe/public/js/frappe/list/base_list.js:68-74`, consumed at `frappe/public/js/frappe/list/base_list.js:251-265`. */
export interface ListViewMenuItem {
	label: string;
	action: () => void;
	standard?: boolean;
	shortcut?: string;
	/** Added to the rendered `<a>`, e.g. `"visible-xs"`. `frappe/public/js/frappe/list/base_list.js:262-264`. */
	class?: string;
	condition?: () => boolean;
	/** `frappe/public/js/frappe/list/list_view.js:229-232` — workflow actions are looked up by this. */
	name?: string;
	is_workflow_action?: boolean;
}

/** The server call payload — `frappe/public/js/frappe/list/base_list.js:503-521`, extended at `frappe/public/js/frappe/list/list_view.js:775-785`. */
export interface ListViewArgs {
	doctype: string;
	fields: string[];
	filters: ListFilterTuple[];
	order_by?: string;
	start: number;
	page_length: number;
	view?: FrappeViewName;
	group_by?: string | null;
	/** ListView only — `frappe/public/js/frappe/list/list_view.js:778-782`, `0 | 1`. */
	with_comment_count?: 0 | 1;
	/** ReportView only — `frappe/public/js/frappe/views/reports/report_view.js:132`; asks the server for the linked docs' titles. */
	with_link_titles?: 0 | 1;
	[extra: string]: unknown;
}

/**
 * `frappe/public/js/frappe/list/base_list.js:655` — `class FilterArea`, **module-local**: not exported and
 * not on `frappe`. Only the members frappe itself reaches from a view are
 * declared; add more here as consumers need them.
 */
export interface FilterArea {
	/** `frappe/public/js/frappe/list/base_list.js:668`. */
	$filter_list_wrapper: JQuery<HTMLElement>;
	/**
	 * `frappe/public/js/frappe/list/base_list.js:690-692` — the `.mobile-id-filter` slot the ID filter field moves
	 * into on a narrow screen. Only present when the page form is shown
	 * (`frappe/public/js/frappe/list/base_list.js:676`).
	 */
	$mobile_id_filter?: JQuery<HTMLElement>;
	/** `frappe/public/js/frappe/list/base_list.js:726-731` — current filters, de-duplicated. */
	get(): ListFilterTuple[];
	/** `frappe/public/js/frappe/list/base_list.js:733-740` — sets without triggering a refresh. */
	set(filters: ListFilterTuple[]): Promise<unknown>;
	/** `frappe/public/js/frappe/list/base_list.js:742-767`; also accepts the 4 loose args form (`frappe/public/js/frappe/list/base_list.js:745-749`). */
	add(filters: ListFilterTuple[] | string, ...rest: unknown[]): Promise<unknown>;
	/** `frappe/public/js/frappe/list/base_list.js:1123-1134` — always resolves. */
	remove(fieldname: string): Promise<void>;
	clear(refresh?: boolean): Promise<unknown>;
	exists(f: ListFilterTuple): boolean;
	/**
	 * `frappe/public/js/frappe/list/base_list.js:699-713` — parks the standard `name` (ID) filter field in the mobile
	 * slot below 768px and in the desktop standard-filters wrapper above it.
	 * `BaseList.show` runs it after `init` (`frappe/public/js/frappe/list/base_list.js:17`) and the resize handler
	 * re-runs it (`frappe/public/js/frappe/list/base_list.js:435`).
	 */
	place_id_filter(): void;
	/** `frappe/public/js/frappe/list/base_list.js:727`, `frappe/public/js/frappe/list/list_view.js:847` — the `_liked_by` lookup lives here (built at `frappe/public/js/frappe/list/base_list.js:1406-1436`). */
	filter_list: {
		get_filters(): ListFilterTuple[];
		get_filter_value(fieldname: string): unknown;
		filter_exists(f: ListFilterTuple): boolean;
		add_filters(filters: ListFilterTuple[]): Promise<unknown>;
		update_filter_button(): void;
	};
}

/**
 * The saved-layout controller, `this.list_filter` — `frappe.views.ListFilter`
 * (`frappe/public/js/frappe/list/list_filter/list_filter.js:7-21`), loaded lazily from `list_filter.bundle.js`. Its prototype is a
 * mixin of two object literals (`frappe/public/js/frappe/list/list_filter/list_filter.js:23`), so only the members the list code
 * itself reaches are declared: those `ListView.setup_columns`,
 * `save_column_width`, `before_refresh` and `ListSettings` read.
 */
export interface ListFilter {
	/** `frappe/public/js/frappe/list/list_filter/list_filter.js:14`. */
	list_view: BaseList;
	/** `frappe/public/js/frappe/list/list_filter/list_filter.js:17` — `"default_layout"` until a saved layout is selected. */
	active_layout_name: string;
	/** `frappe/public/js/frappe/list/list_filter/list_filter.js:19` — resolves once the first layout fetch has run. */
	setup_promise: Promise<unknown>;
	/** `frappe/public/js/frappe/list/list_filter/list_filter_api.js:51-56` — the selected layout record; `null` for the default layout. */
	get_active_layout(): ListLayout | null;
	/** `frappe/public/js/frappe/list/list_filter/list_filter_api.js:59-63` — the layout's parsed `columns` JSON; `[]` for none or unparseable. */
	get_layout_columns(layout: ListLayout | null | undefined): ListLayoutField[];
	/**
	 * `frappe/public/js/frappe/list/list_filter/list_filter_api.js:80-88` — `undefined`, not `false`, for a user without the role:
	 * `frappe.user.has_role` falls off the end of its loop (`frappe/public/js/frappe/utils/user.js:84-90`).
	 */
	can_edit_layout(layout: ListLayout | null | undefined): boolean | undefined;
	/** `frappe/public/js/frappe/list/list_filter/list_filter_api.js:188-203` — debounced by default (the column drag saves through it). */
	update_layout_columns(
		layout: ListLayout | null | undefined,
		columns: ListLayoutField[],
		options?: { debounce?: boolean }
	): Promise<unknown>;
	/** `frappe/public/js/frappe/list/list_filter/list_filter_menu.js:362-387` — the visible columns as `{fieldname, label, width}` rows, Tag column excluded. */
	get_current_columns_state(): ListLayoutField[];
	/** `frappe/public/js/frappe/list/list_filter/list_filter_menu.js:171-209`. */
	restore_layout_from_route_signature(options?: { refresh?: boolean }): Promise<unknown>;
}

/**
 * One `List Filter` record — a saved list layout (`frappe/public/js/frappe/list/list_filter/list_filter_api.js:4-32` lists the fields
 * fetched). Only `name` is relied on here: `get_active_layout` finds the
 * active one by it (`frappe/public/js/frappe/list/list_filter/list_filter_api.js:54`).
 */
export interface ListLayout {
	name: string;
	[field: string]: unknown;
}

/** `frappe.ui.SortSelector` — minimal, only the members the views read. */
export interface SortSelector {
	sort_by: string;
	sort_order: string;
	/** `frappe/public/js/frappe/list/base_list.js:515`, `frappe/public/js/frappe/views/reports/report_view.js:161`. */
	get_sql_string(): string;
}

/* ------------------------------------------------------------------ *
 * 5. ListView
 * ------------------------------------------------------------------ */

/**
 * `frappe.views.ListView` — `frappe/public/js/frappe/list/list_view.js:6`
 * (`frappe.views.ListView = class ListView extends frappe.views.BaseList { … }`).
 *
 * ### Generic parameter
 * `TColumn` exists ONLY so `ReportView` can narrow `columns` to
 * `DataTableColumn[]`. `ReportView.setup_columns()` (`frappe/public/js/frappe/views/reports/report_view.js:1144-1176`)
 * fully replaces `ListView.setup_columns()` (`frappe/public/js/frappe/list/list_view.js:486-576`) and emits a
 * completely different object; without the parameter the two declarations are
 * an outright TS2416 ("not assignable to the same property in base type").
 * Plain `ListView` still means `ListView<ListColumn>`.
 *
 * ### Augmenting from a consumer
 * `carbon_frappe` stores its table engine on the instance. Do NOT cast — merge:
 *
 * ```ts
 * declare module "frappe-types/views" {
 *   interface ListView { carbon_table?: CarbonTable }
 * }
 * ```
 *
 * The empty `export interface ListView {}` below is what makes that legal
 * (class + interface declaration merging).
 */
export declare class ListView<TColumn = ListColumn> extends BaseList {
	/**
	 * `frappe/public/js/frappe/list/list_view.js:7-22`. Called by `frappe/public/js/frappe/list/list_factory.js:45` BEFORE construction:
	 * returning `true` means "I re-routed, don't build me". ReportView overrides
	 * it (`frappe/public/js/frappe/views/reports/report_view.js:10-18`) to bounce a user who cannot read reports back to the List view.
	 */
	static load_last_view(): boolean;

	/** `frappe/public/js/frappe/list/list_view.js:24-66` — note it calls `this.show()` from inside the constructor (`frappe/public/js/frappe/list/list_view.js:26`). */
	constructor(opts: BaseListOptions);

	/**
	 * `frappe/public/js/frappe/list/list_view.js:108-110` — a GETTER returning `"List"`.
	 *
	 * Typed as the full union, not the literal `"List"`, so `ReportView`'s
	 * `"Report"` (`frappe/public/js/frappe/views/reports/report_view.js:20-22`) remains an assignable override.
	 */
	readonly view_name: FrappeViewName;
	/** `frappe/public/js/frappe/list/list_view.js:112-114` — a GETTER returning `true`; ReportView returns `false` (`frappe/public/js/frappe/views/reports/report_view.js:24-26`). */
	readonly show_saved_layout_menu: boolean;
	/** `frappe/public/js/frappe/list/list_view.js:116-118` — `this.user_settings[this.view_name] || {}`. */
	readonly view_user_settings: ListViewUserSettings;

	/** `frappe/public/js/frappe/list/list_view.js:28` — `frappe.get_meta(doctype)?.is_large_table`. */
	is_large_table?: 0 | 1;
	/** `frappe/public/js/frappe/list/list_view.js:30-33` — `process_document_refreshes`, debounced 15s / 2s. */
	debounced_refresh: () => void;
	/** `frappe/public/js/frappe/list/list_view.js:34` — `1001`; zeroed by the count tooltip click (`frappe/public/js/frappe/list/list_view.js:1232`). */
	count_upper_bound: number;
	/**
	 * `frappe/public/js/frappe/list/list_view.js:36` `this.column_max_widths = {}`; `fieldname → pixel width`.
	 *
	 * v16.50.0 REMOVED the text-length estimator that used to fill this from
	 * `get_column_html` (`textLength * 10 / 1.3`). Now it is only ever written
	 * from a width somebody chose: a column's `df.width` (a saved layout or the
	 * settings `fields` JSON) in `get_column_html` (`frappe/public/js/frappe/list/list_view.js:1411-1412`,
	 * `frappe/public/js/frappe/list/list_view.js:1559-1563`), a header drag in `setup_column_resize` (`frappe/public/js/frappe/list/list_view.js:912`), and
	 * the rendered header's real widths in `capture_column_widths_from_dom`
	 * (`frappe/public/js/frappe/list/list_view.js:1087-1109`). So it is EMPTY for a list that has no saved widths, however
	 * many rows have rendered. Consumed by `apply_column_widths` (`frappe/public/js/frappe/list/list_view.js:1577-1588`),
	 * which clamps to 50..400px.
	 *
	 * STRICT HAZARD at the call site, not here: indexing it with the natural
	 * `column_max_widths[col.df && col.df.fieldname]` is TS2538 — the index
	 * expression is `string | undefined`. Use `col.df?.fieldname ?? ""` (or a
	 * guard) rather than reaching for an assertion. A Status column is keyed
	 * `status_field`, not by a docfield name (`frappe/public/js/frappe/list/list_view.js:1410`).
	 */
	column_max_widths: Record<string, number>;
	/** `frappe/public/js/frappe/list/list_view.js:37` — `3`. */
	max_number_of_avatars: number;
	/** `frappe/public/js/frappe/list/list_view.js:38` — `50`; the real column cap (`frappe/public/js/frappe/list/list_view.js:501`, `frappe/public/js/frappe/list/list_view.js:553`). */
	max_number_of_fields: number;
	/** `frappe/public/js/frappe/list/list_view.js:35` — the pre-built `<input>/<a>/<span>` templates. Module-local class, `frappe/public/js/frappe/list/list_view.js:3285`. */
	_element_factory: ListViewElementFactory;

	/* ---- virtualization (2000+ rows on one page) ---- */
	/** `frappe/public/js/frappe/list/list_view.js:46` — `2000`: at this many loaded rows `should_use_virtualization()` turns on. */
	virtualization_threshold: number;
	/** `frappe/public/js/frappe/list/list_view.js:47` — `20`: rows rendered above and below the viewport on desktop (mobile uses 40, `frappe/public/js/frappe/list/list_view_virtualization.js:141-145`). */
	virtualization_row_buffer: number;
	/** `frappe/public/js/frappe/list/list_view.js:48` — `44`: the desktop row height guess until a real row is measured. */
	virtualization_row_height: number;
	/** `frappe/public/js/frappe/list/list_view.js:51-65` — the window bookkeeping the lazy bundle reads and writes. */
	virtualization_state: ListViewVirtualizationState;
	/**
	 * The selected row names — the source of truth for selection since v16.50.0
	 * (`frappe/public/js/frappe/list/list_view.js:50`). Off-screen rows are not in the DOM in virtual mode, so a
	 * `.list-row-checkbox:checked` query can no longer answer "what is selected".
	 * Every selection path writes through it: `sync_checked_docname`
	 * (`frappe/public/js/frappe/list/list_view.js:1180-1192`), `set_select_all_checked` (`frappe/public/js/frappe/list/list_view.js:1198-1205`), shift-select
	 * (`frappe/public/js/frappe/list/list_view.js:2227`), `remove_list_items` (`frappe/public/js/frappe/list/list_view.js:2422`) and `clear_checked_items`
	 * (`frappe/public/js/frappe/list/list_view.js:2485`); `render_list` prunes it against the new data
	 * (`prune_checked_docnames`, `frappe/public/js/frappe/list/list_view.js:1031`). `get_checked_items`, `on_row_checked`
	 * and the realtime guard all read it (`frappe/public/js/frappe/list/list_view.js:2477`, `frappe/public/js/frappe/list/list_view.js:2453`, `frappe/public/js/frappe/list/list_view.js:2308`).
	 *
	 * ReportView inherits an EMPTY set and never touches it: its selection lives
	 * in `datatable.rowmanager` (`frappe/public/js/frappe/views/reports/report_view.js:1389-1402`).
	 */
	checked_docnames: Set<string>;

	/** Column model. See the class-level note on `TColumn`. */
	columns: TColumn[];
	/** `frappe/public/js/frappe/list/list_view.js:132-144` — always real filter tuples here. */
	filters: ListFilterTuple[];
	/** `frappe/public/js/frappe/list/list_view.js:269` — `{ [fieldname]: title_fieldname_of_linked_doctype }`; rebuilt per layout at `frappe/public/js/frappe/list/list_view.js:590-593`. */
	link_field_title_fields: Record<string, string>;
	/** `frappe/public/js/frappe/list/list_view.js:426` / `frappe/public/js/frappe/list/list_view.js:2291` — a Check field, so `0 | 1`, and UNSET until `refresh_columns`/`setup_tag_visibility` runs. */
	tags_shown?: 0 | 1;
	/** `frappe/public/js/frappe/list/list_view.js:219`. */
	actions_menu_items?: ListViewMenuItem[];
	/** `frappe/public/js/frappe/list/list_view.js:220`. */
	workflow_action_menu_items?: ListViewMenuItem[];
	/** `frappe/public/js/frappe/list/list_view.js:221`, filled at `frappe/public/js/frappe/list/list_view.js:231`. */
	workflow_action_items?: Record<string, JQuery<HTMLElement>>;
	/** `frappe/public/js/frappe/list/list_view.js:1788`, `frappe/public/js/frappe/list/list_view.js:1797` — the server-side count; `null` when the estimate is unavailable. */
	total_count?: number | null;
	/** `frappe/public/js/frappe/list/list_view.js:1789-1790`. */
	count_without_children?: number;
	/** `frappe/public/js/frappe/list/list_view.js:2295`, `frappe/public/js/frappe/list/list_view.js:2334`. */
	pending_document_refreshes?: unknown[];
	/** `frappe/public/js/frappe/list/list_view.js:2297`, `frappe/public/js/frappe/list/list_view.js:2325`. */
	realtime_events_setup?: boolean;
	/**
	 * `frappe/public/js/frappe/list/list_view.js:2414` — read by `avoid_realtime_update`. Set by ListView's own bulk
	 * actions (`frappe/public/js/frappe/list/list_view.js:2725`, `frappe/public/js/frappe/list/list_view.js:2808`) and by the Kanban board
	 * (`frappe/public/js/frappe/views/kanban/kanban_board.bundle.js:1210`) to suppress realtime churn.
	 */
	disable_list_update?: boolean;
	/** `frappe/public/js/frappe/list/list_view.js:84-101`. */
	$list_skeleton?: JQuery<HTMLElement>;
	/** `frappe/public/js/frappe/list/list_view.js:239-245`. */
	restricted_list?: JQuery<HTMLElement>;
	/** `frappe/public/js/frappe/list/list_view.js:323-329` — resolves once `required_libs` are loaded. */
	load_lib?: Promise<void>;
	required_libs?: string | string[];

	/* ---- lazily-resolved check handles ---- *
	 * All three are created inside `on_row_checked` (`frappe/public/js/frappe/list/list_view.js:2446-2454`)
	 * with the `x = x || this.$result.find(...)` idiom — they are UNDEFINED
	 * until the first checkbox interaction, and their undefined-ness is
	 * load-bearing: `update_checkbox` (`frappe/public/js/frappe/list/list_view.js:463`) uses
	 * `if (!this.$checkbox_actions) return` as its guard for `$checks` not
	 * existing yet. Pre-assigning `$checkbox_actions` turns the first click into
	 * a TypeError on `this.$checks.length`. Declare them OPTIONAL. */

	/** `frappe/public/js/frappe/list/list_view.js:2447-2448` — `$result.find("header .list-header-subject")`. */
	$list_head_subject?: JQuery<HTMLElement>;
	/** `frappe/public/js/frappe/list/list_view.js:2449-2450` — `$result.find("header .checkbox-actions")`. */
	$checkbox_actions?: JQuery<HTMLElement>;
	/**
	 * `frappe/public/js/frappe/list/list_view.js:2454` — `$result.find(".list-row-checkbox:checked")`. Only what is IN
	 * THE DOM right now: with virtualization this is a window, not the selection
	 * (that is {@link ListView.checked_docnames}).
	 */
	$checks?: JQuery<HTMLInputElement>;
	/** `frappe/public/js/frappe/list/list_view.js:2215`, `frappe/public/js/frappe/list/list_view.js:2233` — the shift-select anchor. */
	$checkbox_cursor?: JQuery<HTMLInputElement>;

	/* ---- methods ---- */
	/** `frappe/public/js/frappe/list/list_view.js:68-70`. */
	has_permissions(): boolean;
	/** `frappe/public/js/frappe/list/list_view.js:72-75` — sets `parent.disable_scroll_to_top` then `super.show()`; returns undefined. */
	show(): void;
	/** `frappe/public/js/frappe/list/list_view.js:77-82` — routes away and throws instead of returning false. */
	check_permissions(): void;
	/** `frappe/public/js/frappe/list/list_view.js:177-181`. */
	validate_filters(filters: ListFilterTuple[]): ListFilterTuple[];
	/** `frappe/public/js/frappe/list/list_view.js:218-234`. */
	set_actions_menu_items(): void;
	/** `frappe/public/js/frappe/list/list_view.js:236-247`. */
	show_restricted_list_indicator_if_applicable(): void;
	/** `frappe/public/js/frappe/list/list_view.js:249-256`. */
	show_restrictions(match_rules_list?: unknown[]): void;
	/** `frappe/public/js/frappe/list/list_view.js:319-338` — REBINDS `this.refresh` to a 1s throttle and starts a 5-minute poll. */
	patch_refresh_and_load_lib(): void;
	/** `frappe/public/js/frappe/list/list_view.js:340-376`. */
	set_primary_action(): void;
	/** `frappe/public/js/frappe/list/list_view.js:395-413`. */
	make_new_doc(): void;
	/**
	 * `frappe/public/js/frappe/list/list_view.js:209-216` — loads `data_import_tools.bundle.js` then opens the import
	 * dialog for this doctype. Backs the "Import" menu item (`frappe/public/js/frappe/list/list_view.js:2538`) and the
	 * empty state's import button (`frappe/public/js/frappe/list/list_view.js:2287`); it replaced a route to the Data
	 * Import list.
	 */
	open_import_dialog(): void;
	/**
	 * `frappe/public/js/frappe/list/list_view.js:415-422` — `async` since v16.50.0: it `await`s `setup_columns()`, and no
	 * longer renders the header (the first `refresh` does, once a saved layout has
	 * been restored — `frappe/public/js/frappe/list/list_view.js:417`). ReportView overrides it SYNCHRONOUSLY
	 * (`frappe/public/js/frappe/views/reports/report_view.js:71-76`), so the union is the price of the shared base; see
	 * {@link BaseList.setup_view}.
	 */
	setup_view(): void | Promise<void>;
	/**
	 * `frappe/public/js/frappe/list/list_view.js:424-431` — `async` since v16.50.0: it awaits `setup_columns()` before
	 * `refresh()`. Called by `ListSettings`' save callback (`frappe/public/js/frappe/list/list_settings.js:87`).
	 */
	refresh_columns(meta: DocTypeMeta, list_view_settings: ListViewDBSettings): Promise<void>;
	/**
	 * `frappe/public/js/frappe/list/list_view.js:433-460`. See {@link BaseList.refresh} for why this can be `undefined`.
	 * It also loads the virtualization bundle in parallel with the fetch when the
	 * chosen page size is at or above `virtualization_threshold` (`frappe/public/js/frappe/list/list_view.js:438-441`),
	 * and re-renders the header after the fetch when asked to
	 * (`frappe/public/js/frappe/list/list_view.js:448-451`).
	 */
	refresh(refresh_header?: boolean): Promise<void> | undefined;
	/**
	 * `frappe/public/js/frappe/list/list_view.js:462-475`. Called with no args from `on_row_checked` (`frappe/public/js/frappe/list/list_view.js:2468`). The
	 * "select all" box is ticked when `checked_docnames` covers every loaded row
	 * (`frappe/public/js/frappe/list/list_view.js:471-474`), not when the DOM checkboxes do.
	 */
	update_checkbox(target?: JQuery<HTMLInputElement>): void;
	/**
	 * `frappe/public/js/frappe/list/list_view.js:486-576` — `async` since v16.50.0 (it ends in
	 * `await this.ensure_column_fields_fetched()`, `frappe/public/js/frappe/list/list_view.js:575`).
	 *
	 * `fields_override` is a saved layout's columns (or the settings dialog's
	 * `me.fields`, `frappe/public/js/frappe/list/list_settings.js:70`); when it is omitted and a non-default layout is
	 * active, the layout's own columns are used (`frappe/public/js/frappe/list/list_view.js:489-497`). A non-empty
	 * override builds the columns through `build_columns_from_fields`
	 * (`frappe/public/js/frappe/list/list_view.js:499-502`).
	 *
	 * `void | Promise<void>` because ReportView replaces it with a synchronous
	 * `setup_columns()` (`frappe/public/js/frappe/views/reports/report_view.js:1144-1176`) — see {@link ReportView.setup_columns}.
	 */
	setup_columns(fields_override?: ListLayoutField[] | null): void | Promise<void>;
	/**
	 * `frappe/public/js/frappe/list/list_view.js:583-642` — adds every displayed column's field (and a Currency column's
	 * options field, and a Link column's title field) to the fetch set `this.fields`,
	 * so a layout column that is not `in_list_view` does not render blank.
	 */
	ensure_column_fields_fetched(): Promise<void>;
	/** `frappe/public/js/frappe/list/list_view.js:645-671` — columns straight from a layout's field list, order preserved. */
	build_columns_from_fields(fields: ListLayoutField[]): ListColumn[];
	/** `frappe/public/js/frappe/list/list_view.js:673-708` — `fields_override` defaults to the settings `fields` JSON; honours saved widths. */
	reorder_listview_fields(fields_override?: ListLayoutField[] | null): TColumn[];
	/**
	 * `frappe/public/js/frappe/list/list_view.js:829-837` — DEFINED HERE, not on ReportView, even though
	 * ReportView's datatable `onCheckRow` handler is its busiest caller
	 * (`frappe/public/js/frappe/views/reports/report_view.js:323-331`). A `ReportView` declaration without a `ListView`
	 * base loses it.
	 */
	toggle_actions_menu_button(toggle: boolean): void;
	/**
	 * `frappe/public/js/frappe/list/list_view.js:839-853`. Note the DEFAULT PARAMETER — callers may pass nothing.
	 * `true` drops the existing `.list-row-head` first (`frappe/public/js/frappe/list/list_view.js:840-842`); it ends by
	 * calling `setup_column_resize()` (`frappe/public/js/frappe/list/list_view.js:852`).
	 */
	render_header(refresh_header?: boolean): void;
	render_skeleton(): void;
	/**
	 * `frappe/public/js/frappe/list/list_view.js:862-917` — wires the header drag-to-resize: delegated `mousedown` on
	 * `.list-row-head .list-col-resize-handle` (`frappe/public/js/frappe/list/list_view.js:877-891`) plus document-level
	 * `mousemove` / `mouseup` (`frappe/public/js/frappe/list/list_view.js:893-916`), all under the `.list-col-resize`
	 * event namespace and torn down first each call (`frappe/public/js/frappe/list/list_view.js:866-867`). A no-op on
	 * mobile (`frappe/public/js/frappe/list/list_view.js:863`). Reads `data-fieldname` off the dragged
	 * `.list-row-col` (`frappe/public/js/frappe/list/list_view.js:883`), so the header must keep emitting it.
	 */
	setup_column_resize(): void;
	/**
	 * `frappe/public/js/frappe/list/list_view.js:919-969` — persists one column's dragged width, 50..400px. Under a
	 * saved layout it writes through `list_filter.update_layout_columns`
	 * (`frappe/public/js/frappe/list/list_view.js:920-931`); otherwise it POSTs the whole `fields` JSON to
	 * `save_listview_settings` (`frappe/public/js/frappe/list/list_view.js:955-968`) and replaces `list_view_settings`
	 * with the reply.
	 */
	save_column_width(fieldname: string, width: number): void;
	/**
	 * `frappe/public/js/frappe/list/list_view.js:1003-1084`.
	 *
	 * When virtualization is wanted but the lazy bundle has not loaded yet it
	 * loads it and RETURNS EARLY, re-running itself afterwards — or, if the load
	 * fails, falls back to rendering every row (`frappe/public/js/frappe/list/list_view.js:1005-1029`). Otherwise:
	 * `prune_checked_docnames()` and `capture_column_widths_from_dom()`
	 * (`frappe/public/js/frappe/list/list_view.js:1031-1032`), remove the old `.list-row-container` and
	 * `.list-virtual-spacer` nodes (`frappe/public/js/frappe/list/list_view.js:1035-1036`), `render_header(...)`
	 * (`frappe/public/js/frappe/list/list_view.js:1039`), then EITHER the virtual branch — `set_result_height()` and
	 * `render_virtual_rows(true)` (`frappe/public/js/frappe/list/list_view.js:1048-1055`) — OR every row built into one
	 * string and appended once (`frappe/public/js/frappe/list/list_view.js:1056-1074`). It ends with `apply_column_widths()`
	 * on desktop and `update_listview_classes(...)`, and restores the selection
	 * with `set_rows_as_checked()` itself only on the non-virtual path
	 * (`frappe/public/js/frappe/list/list_view.js:1081-1083`; the virtual one does it in `finalize_virtual_rows`).
	 *
	 * Called from `render()` (`frappe/public/js/frappe/list/list_view.js:999`) and `process_document_refreshes`
	 * (`frappe/public/js/frappe/list/list_view.js:2403`).
	 */
	render_list(): void;
	/** `frappe/public/js/frappe/list/list_view.js:1087-1109` — folds the header's rendered widths into `column_max_widths` before the rows are torn down; desktop only. */
	capture_column_widths_from_dom(): void;
	/** `frappe/public/js/frappe/list/list_view.js:1111-1128` — what `render_list` hands `update_listview_classes`. */
	get_assignment_stats(): { has_assignto: boolean; assign_to_count: number };
	/**
	 * `frappe/public/js/frappe/list/list_view.js:1133-1143` — `true` only on the List view (`this.view === "List"`),
	 * once the bundle has not failed to load, and when `data.length >=
	 * virtualization_threshold`. ReportView and every other subclass answer
	 * `false` through the `view` test.
	 */
	should_use_virtualization(): boolean;
	/** `frappe/public/js/frappe/list/list_view.js:1146-1157` — drops names from `checked_docnames` that are no longer in `this.data`. */
	prune_checked_docnames(): void;
	/**
	 * `frappe/public/js/frappe/list/list_view.js:1160-1171` — a checkbox's docname: `data-name` (`attr` first, `data()`
	 * second), URI-decoded when that parses and raw when it does not, so a name
	 * with a bare `%` still resolves. `""` for a checkbox with none.
	 */
	get_checkbox_docname($checkbox: JQuery<HTMLElement>): string;
	/** `frappe/public/js/frappe/list/list_view.js:1173-1178` — the `.list-row-checkbox` for a docname (a DOM scan; used by shift-select). */
	find_checkbox_by_docname(docname: string): JQuery<HTMLElement>;
	/**
	 * `frappe/public/js/frappe/list/list_view.js:1180-1192` — mirrors one checkbox's `:checked` state into
	 * `checked_docnames`. Frappe calls it from every handler that flips a
	 * checkbox (`frappe/public/js/frappe/list/list_view.js:2090`, `frappe/public/js/frappe/list/list_view.js:2153`, `frappe/public/js/frappe/list/list_view.js:2196`, `frappe/public/js/frappe/list/list_view.js:2204`); a replacement
	 * renderer that ticks its own checkboxes must call it too or the selection
	 * is lost.
	 */
	sync_checked_docname($checkbox: JQuery<HTMLElement>): void;
	/** `frappe/public/js/frappe/list/list_view.js:1198-1205` — header select-all: every loaded row when `true`, empties the set when `false`. */
	set_select_all_checked(checked: boolean): void;
	render_count(): void;
	/** `frappe/public/js/frappe/list/list_view.js:1243-1245` — `this.$result?.find(".list-count")`, so possibly undefined. */
	get_count_element(): JQuery<HTMLElement> | undefined;
	/**
	 * `frappe/public/js/frappe/list/list_view.js:1247-1312` — returns `undefined` early if `this.columns` is unset (`frappe/public/js/frappe/list/list_view.js:1248-1250`).
	 *
	 * Every header cell now carries `data-fieldname` (`frappe/public/js/frappe/list/list_view.js:1282`, `frappe/public/js/frappe/list/list_view.js:1287`) —
	 * `status_field` for the Status column, the literal string `"undefined"` for
	 * the Tag column, which has no `df` — and, except on Tag, a
	 * `.list-col-resize-handle` child (`frappe/public/js/frappe/list/list_view.js:1283-1286`). The drag handler and
	 * `capture_column_widths_from_dom` both skip a `data-fieldname` of `"undefined"`
	 * (`frappe/public/js/frappe/list/list_view.js:884`, `frappe/public/js/frappe/list/list_view.js:1096`).
	 */
	get_header_html(): string | undefined;
	get_header_html_skeleton(left?: string, right?: string): string;
	get_left_html(doc: FrappeListDoc): string;
	get_right_html(doc: FrappeListDoc): string;
	/** `frappe/public/js/frappe/list/list_view.js:1386-1390` — `virtual: true` stamps the row `data-virtual-row="1"` (`frappe/public/js/frappe/list/list_view.js:1393`) so the window can find and replace it. */
	get_list_row_html(doc: FrappeListDoc, options?: { virtual?: boolean }): string;
	/** `frappe/public/js/frappe/list/list_view.js:1392-1406`. */
	get_list_row_html_skeleton(left?: string, right?: string, options?: { virtual?: boolean }): string;
	/**
	 * `frappe/public/js/frappe/list/list_view.js:1408-1570` — the per-cell renderer, returning a
	 * `<div class="list-row-col …" data-fieldname="…">…</div>` string.
	 *
	 * SIDE EFFECT, much smaller than it was: when the column's `df.width` is set
	 * (desktop only) it raises `this.column_max_widths[fieldname]` to that width
	 * (`frappe/public/js/frappe/list/list_view.js:1411-1413` for Status, `frappe/public/js/frappe/list/list_view.js:1559-1563` for the rest). The text-length
	 * estimator that used to fill `column_max_widths` from every rendered cell is
	 * gone — a call to this method no longer tells you how wide a column wants
	 * to be.
	 *
	 * `show_in_mobile` is NOT optional in the source (3 declared params) but
	 * every internal caller passes it explicitly (`frappe/public/js/frappe/list/list_view.js:1358`, `frappe/public/js/frappe/list/list_view.js:1361`).
	 */
	get_column_html(col: ListColumn, doc: FrappeListDoc, show_in_mobile: boolean): string;
	/**
	 * `frappe/public/js/frappe/list/list_view.js:1577-1588`. Guarded by `list_view_settings?.disable_scrolling`. Pins
	 * each `column_max_widths` entry, clamped to 50..400px, as an inline
	 * `width` and `flex: 0 0 <w>px` on the matching `.list-row-col` — now
	 * scoped to `this.$result`, not the whole document (`frappe/public/js/frappe/list/list_view.js:1583`).
	 */
	apply_column_widths(): void;
	/**
	 * `frappe/public/js/frappe/list/list_view.js:1590-1625`.
	 *
	 * Adds `has-assign-to` / `assign-to-length-N` / `no-assign-to` to `$result`
	 * (it clears a stale `assign-to-length-N` first, `frappe/public/js/frappe/list/list_view.js:1599`), writes the widest
	 * comment count to `$result`'s `data-comment-count-length` (`frappe/public/js/frappe/list/list_view.js:1592-1596`),
	 * may add `disable-scrolling` to `parent.page.main.parent()`, and MEASURES
	 * `.list-row-container .list-row` plus its `.level-left` / `.level-right`
	 * widths (`frappe/public/js/frappe/list/list_view.js:1614-1621`) — a DOM contract any replacement renderer must
	 * still satisfy. It finishes with `sync_right_width()` (`frappe/public/js/frappe/list/list_view.js:1624`).
	 */
	update_listview_classes(has_assignto: boolean, assign_to_count: number): void;
	/**
	 * `frappe/public/js/frappe/list/list_view.js:1630-1640` — sets `--list-right-width` on `$result` to the widest
	 * `.level-right` among the header and the rows, so the columns to their left
	 * line up; removes it on mobile. Re-run when the count arrives (`frappe/public/js/frappe/list/list_view.js:1218`).
	 */
	sync_right_width(): void;
	/** `frappe/public/js/frappe/list/list_view.js:1642-1661` — `limit === null` means "no limit". */
	get_tags_html(user_tags: string | null | undefined, limit?: number | null, colored?: boolean): string;
	/** `frappe/public/js/frappe/list/list_view.js:1663-1707` — the right-hand meta rail (avatars, comment count, like, modified). */
	get_meta_html(doc: FrappeListDoc): string;
	/** `frappe/public/js/frappe/list/list_view.js:1709-1727` — `""` unless `settings.button` is set. */
	generate_button_html(doc: FrappeListDoc): string;
	/** `frappe/public/js/frappe/list/list_view.js:1729-1763` — `""` unless `settings.dropdown_button` is set. */
	generate_dropdown_html(doc: FrappeListDoc): string;
	apply_styles_basedon_dropdown(): void;
	get_count_str(): Promise<string>;
	get_form_link(doc: FrappeListDoc): string;
	get_seen_class(doc: FrappeListDoc): "" | "bold";
	get_like_html(doc: FrappeListDoc): string;
	/** `frappe/public/js/frappe/list/list_view.js:1843-1864` — returns a detached `<div>`; callers read `.innerHTML`. */
	get_subject_element(doc: FrappeListDoc, title: string): HTMLDivElement;
	get_subject_text(doc: FrappeListDoc, title: string): string;
	/**
	 * `frappe/public/js/frappe/list/list_view.js:1886-1907` — the status pill is `frappe.ui.badge.html(...)`
	 * (`frappe/public/js/frappe/list/list_view.js:1896-1904`): an `.es-badge` with the extra classes `filterable
	 * ellipsis` and a `data-filter` attribute. It is no longer the old
	 * `.indicator-pill` span.
	 */
	get_indicator_html(doc: FrappeListDoc, show_workflow_state?: boolean): string;
	get_indicator_dot(doc: FrappeListDoc): string;
	get_image_url(doc: FrappeListDoc): string | null;
	setup_events(): void;
	setup_keyboard_navigation(): void;
	setup_filterable(): void;
	setup_sort_by(): void;
	setup_list_click(): void;
	setup_drag_click(): void;
	check_row_on_drag(event: Event, check?: boolean): void;
	setup_action_handler(): void;
	setup_check_events(): void;
	/**
	 * `frappe/public/js/frappe/list/list_view.js:2243-2251` — a 300ms debounced `toggle_workflow_actions`, built on first
	 * call and cached on the instance. Workflow action items now refresh when the
	 * SELECTION changes — `on_row_checked` (`frappe/public/js/frappe/list/list_view.js:2470-2472`) and ReportView's
	 * `onCheckRow` (`frappe/public/js/frappe/views/reports/report_view.js:328-330`) call this whenever something is selected — instead
	 * of from a `show.bs.dropdown` hook on the actions menu, which is gone from
	 * both views. A replacement selection UI has to call it itself.
	 */
	debounced_toggle_workflow_actions(): void;
	setup_like(): void;
	setup_new_doc_event(): void;
	/** `frappe/public/js/frappe/list/list_view.js:2290-2292`. */
	setup_tag_visibility(): void;
	setup_realtime_updates(): void;
	disable_realtime_updates(): void;
	process_document_refreshes(): void;
	avoid_realtime_update(): boolean;
	remove_list_items(names: string[]): void;
	/** `frappe/public/js/frappe/list/list_view.js:2430-2444` — re-ticks the rendered rows from `checked_docnames`, then runs `on_row_checked`. */
	set_rows_as_checked(): void;
	/** `frappe/public/js/frappe/list/list_view.js:2446-2473` — resolves `$list_head_subject` / `$checkbox_actions` lazily; counts from `checked_docnames`. */
	on_row_checked(): void;
	/**
	 * `frappe/public/js/frappe/list/list_view.js:2475-2482` — reads `checked_docnames`, NOT the DOM (selected rows can
	 * be off-screen in virtual mode); `only_docnames` gives the names, otherwise
	 * the matching docs from `this.data`.
	 */
	get_checked_items(only_docnames: true): string[];
	get_checked_items(only_docnames?: false | 0 | null | undefined): FrappeListDoc[];
	get_checked_items(only_docnames?: boolean): string[] | FrappeListDoc[];
	/** `frappe/public/js/frappe/list/list_view.js:2484-2488` — empties `checked_docnames`, unticks the rendered boxes, runs `on_row_checked`. */
	clear_checked_items(): void;
	save_view_user_settings(obj: Partial<ListViewUserSettings>): Promise<unknown>;
	/** `frappe/public/js/frappe/list/list_view.js:2494` — empty hook; ReportView overrides it (`frappe/public/js/frappe/views/reports/report_view.js:241`). */
	on_update(...args: unknown[]): void;
	update_url_with_filters(): void;
	get_url_with_filters(): string;
	get_search_params(): URLSearchParams;
	get_menu_items(): ListViewMenuItem[];
	make_group_by_fields_modal(): void;
	get_group_by_dropdown_fields(): unknown[];
	get_view_settings(): ListViewMenuItem;
	/** `frappe/public/js/frappe/list/list_view.js:2703-2712` — opens the {@link ListSettings} dialog. */
	show_list_settings(): void;
	get_workflow_action_menu_items(): ListViewMenuItem[];
	/** `frappe/public/js/frappe/list/list_view.js:2743-2767` — returns early when nothing is selected (`frappe/public/js/frappe/list/list_view.js:2751`), since the debounced call can land after a deselect. */
	toggle_workflow_actions(): void;
	get_actions_menu_items(): ListViewMenuItem[];
	parse_filters_from_route_options(): ListFilterTuple[];
	parse_filters_from_settings(): ListFilterTuple[];

	/* ---- methods mixed in by the LAZY virtualization bundle ----
	 * `Object.assign(frappe.views.ListView.prototype, list_view_virtualization)`
	 * (`frappe/public/js/list_view_virtualization.bundle.js:4`) runs only when a page first needs it. Frappe itself tests
	 * `frappe.views.ListView.prototype.render_virtual_rows` for existence
	 * (`frappe/public/js/frappe/list/list_view.js:1007`, `frappe/public/js/frappe/list/list_view.js:1058`, `frappe/public/js/frappe/list/list_view.js:3371`), so they are declared OPTIONAL: a list
	 * that never reached `virtualization_threshold` has none of them. Only the
	 * lifecycle entry points are declared. */

	/** `frappe/public/js/frappe/list/list_view_virtualization.js:14-81` — binds `scroll.virtualization` on `.result-container` and a debounced window resize; idempotent for the same container. */
	setup_virtualization_scroll_handler?(): void;
	/** `frappe/public/js/frappe/list/list_view_virtualization.js:83-117` — unbinds both and resets `virtualization_state`. */
	teardown_virtualization_scroll_handler?(): void;
	/** `frappe/public/js/frappe/list/list_view_virtualization.js:151-159` — drops the cached row heights when the viewport flips between desktop and mobile. */
	sync_virtualization_viewport_mode?(): void;
	/**
	 * `frappe/public/js/frappe/list/list_view_virtualization.js:345-421` — renders the window of rows around the scroll position
	 * between two `.list-virtual-spacer` divs, each row `data-virtual-row="1"`
	 * (`frappe/public/js/frappe/list/list_view_virtualization.js:385-405`), measures it and, if the height guess was wrong, redoes the
	 * window up to twice (`frappe/public/js/frappe/list/list_view_virtualization.js:412-417`).
	 */
	render_virtual_rows?(force?: boolean, remeasure_attempt?: number): void;
	/** `frappe/public/js/frappe/list/list_view_virtualization.js:287-292` — applies column widths (desktop) and restores the selection. */
	finalize_virtual_rows?(): void;
}
/**
 * Declaration-merging seam. Keep it empty here; consumers add members via
 * module augmentation (see the class doc). `carbon_frappe` uses it for
 * `carbon_table?: CarbonTable` (`tables/list/list_view.ts`).
 */
export interface ListView<TColumn = ListColumn> {}

/**
 * `this.virtualization_state` — the scroll-window bookkeeping
 * (`frappe/public/js/frappe/list/list_view.js:51-65`). The lazy bundle owns every write
 * (`frappe/public/js/frappe/list/list_view_virtualization.js:14-117`, `frappe/public/js/frappe/list/list_view_virtualization.js:294-421`); declared so a replacement renderer can read
 * `enabled` and tell whether the window is active.
 */
export interface ListViewVirtualizationState {
	/** When true, the scroll handler calls `render_virtual_rows`. */
	enabled: boolean;
	/** Scroll / resize listeners are attached to the `.result-container`. */
	bound: boolean;
	/** First row index currently in the DOM window; `-1` before the first render. */
	start: number;
	/** One past the last row index in the DOM window; `-1` before the first render. */
	end: number;
	/** Pending `requestAnimationFrame` id, so scrolling renders at most once per frame. */
	raf: number | null;
	/** The real row height read from the DOM (desktop uses one value for all rows). */
	measured_row_height: number | null;
	/** Per-row heights by row index — mobile card rows differ in size. */
	row_heights: Record<number, number>;
	/** Prefix sums over the row heights, for mobile spacer / index maths. */
	row_height_prefix_sums: number[];
	/** The row count the cached prefix sums were built for. */
	row_height_prefix_total_rows: number;
	/** Tracks a desktop ↔ mobile switch. */
	last_is_mobile: boolean | null;
	/** The `.result-container` element being listened to. */
	container: HTMLElement | null;
	scroll_handler: (() => void) | null;
	resize_handler: (() => void) | null;
}

/**
 * `frappe/public/js/frappe/list/list_view.js:3285-3361` — `class ElementFactory`, module-local (NOT exported,
 * NOT on `frappe`). Reachable only as `listView._element_factory`.
 */
export interface ListViewElementFactory {
	templates: {
		checkbox: HTMLInputElement;
		checkboxspan: HTMLSpanElement;
		link: HTMLAnchorElement;
		like: HTMLSpanElement;
	};
	/** `frappe/public/js/frappe/list/list_view.js:3329-3333` — clone with `data-name`; the `.list-row-checkbox[data-name]` contract. */
	get_checkbox_element(name: string): HTMLInputElement;
	get_checkboxspan_element(): HTMLSpanElement;
	get_link_element(name: string, href: string, text: string): HTMLAnchorElement;
	get_like_element(
		name: string,
		liked: boolean,
		liked_by: string[],
		title: string
	): HTMLSpanElement;
}

/* ------------------------------------------------------------------ *
 * 6. ReportView
 * ------------------------------------------------------------------ */

/** `frappe/public/js/frappe/views/reports/report_view.js:45-63` — `report_doc.json`, the saved Report's settings blob. */
export interface ReportViewJSON {
	filters?: ListFilterTuple[];
	fields?: [fieldname: string, doctype: string][];
	order_by?: string;
	add_totals_row?: 0 | 1;
	page_length?: number;
	column_widths?: Record<string, number>;
	group_by?: unknown;
	chart_args?: ReportChartArgs | null;
}

/** `frappe/public/js/frappe/views/reports/report_view.js:590-605` / `frappe/public/js/frappe/views/reports/report_view.js:617-663`. */
export interface ReportChartArgs {
	x_axis: string;
	y_axes: string[];
	chart_type: string;
	labels?: unknown[];
	datasets?: unknown[];
}

/**
 * What `ReportView.get_editing_object` returns — `frappe/public/js/frappe/views/reports/report_view.js:688-738`.
 *
 * frappe's own lambdas take **one** argument each, but the datatable calls them
 * with more (`initValue(value, rowIndex, column)` /
 * `setValue(value, rowIndex, column)` in frappe-datatable's
 * `cellmanager.js`). The trailing parameters are therefore OPTIONAL here — make
 * them required and frappe's own return value stops being assignable.
 *
 * SEAM RESOLUTION (gaps.md §2e / §6.9) — this used to be a free-standing shape,
 * which made `ReportView#get_editing_object` UNASSIGNABLE to
 * {@link DataTableGetEditor}, breaking the wiring frappe itself performs at
 * `frappe/public/js/frappe/views/reports/report_view.js:308` and that carbon_frappe repeats at
 * `tables/datatable/install.ts:55`:
 *
 * ```ts
 * getEditor: this.get_editing_object.bind(this)
 * // -> TS2322: 'ReportViewCellEditor' is not assignable to 'DataTableEditor'
 * ```
 *
 * It now `extends` {@link DataTableEditor}, the contract frappe-datatable
 * actually enforces, so conformance is structural and cannot drift again. The
 * three members are still redeclared here rather than merely inherited, so each
 * keeps its own `report_view.js` citation and so the two places where
 * ReportView is genuinely LOOSER than the base survive in the type:
 *
 * - `initValue` / `setValue` keep `value: unknown`. A parameter may be WIDER
 *   than the base's, so nothing is claimed that the source does not support.
 * - `initValue` keeps a real return type. The base declares `void`; the source
 *   returns `control.set_value(value)`, which is a promise. A `void`-returning
 *   target accepts any source return, so `void | Promise<unknown>` extends
 *   cleanly and callers can still await it.
 *
 * The ONE narrowing is `getValue()`, from `unknown` to the base's
 * `DataTableCellValue | Promise<DataTableCellValue>`. Justification, since this
 * package does not narrow on taste: the runtime expression is
 * `control.get_value()` (`frappe/public/js/frappe/views/reports/report_view.js:735-737`), which `ui/form.d.ts:513`
 * types `unknown` because a control CAN return a non-scalar (ControlTable
 * returns `ChildDoc[]`). But this particular value is consumed only as a
 * datatable CELL CONTENT — `node_modules/frappe-datatable/src/cellmanager.js:561`
 * `this.updateCell(colIndex, rowIndex, value, true)` — and
 * `DataTableCell#content` is `DataTableCellValue` (datatable.d.ts:216, :317).
 * A non-scalar here is not a value this type should permit; it is a bug.
 * Report View never produces one: its columns are list-view fields, and
 * `is_editable` (`frappe/public/js/frappe/views/reports/report_view.js:817-839`) additionally rejects `read_only`,
 * `is_virtual`, `hidden` and standard fields.
 */
export interface ReportViewCellEditor extends DataTableEditor {
	/**
	 * `frappe/public/js/frappe/views/reports/report_view.js:689-691` — `control.set_value(value)`, whose promise is
	 * returned (and which `node_modules/frappe-datatable/src/cellmanager.js:474` ignores).
	 */
	initValue(
		value: unknown,
		rowIndex?: DataTableRowIndex,
		column?: DataTableColumn
	): void | Promise<unknown>;
	/**
	 * `frappe/public/js/frappe/views/reports/report_view.js:692-734` — persists via `frappe.db.set_value`, then
	 * refreshes the charts.
	 *
	 * REQUIRED, not optional as this declaration previously had it: the object
	 * literal at `frappe/public/js/frappe/views/reports/report_view.js:688-738` has an unconditional `setValue` key,
	 * and `node_modules/frappe-datatable/src/cellmanager.js:558` calls it unguarded.
	 */
	setValue(
		value: unknown,
		rowIndex?: DataTableRowIndex,
		column?: DataTableColumn
	): void | Promise<unknown>;
	/** `frappe/public/js/frappe/views/reports/report_view.js:735-737` — `control.get_value()`. See the note above. */
	getValue(): DataTableCellValue | Promise<DataTableCellValue>;
}

/**
 * `frappe.views.ReportView` — `frappe/public/js/frappe/views/reports/report_view.js:9`
 * (`class ReportView extends frappe.views.ListView`).
 *
 * It is `ListView<DataTableColumn>`: `setup_columns()` (`frappe/public/js/frappe/views/reports/report_view.js:1144`)
 * replaces the ListColumn model with datatable columns built by `build_column`
 * (`frappe/public/js/frappe/views/reports/report_view.js:1178-1288`).
 *
 * `carbon_frappe` never constructs or subclasses it — it replaces
 * `ReportView.prototype.setup_datatable` outright, because `frappe/public/js/frappe/views/reports/report_view.js:305`
 * calls a MODULE-LOCAL `new DataTable(...)` (imported at `frappe/public/js/frappe/views/reports/report_view.js:4`) that no
 * global can reach.
 */
export declare class ReportView extends ListView<DataTableColumn> {
	/**
	 * `frappe/public/js/frappe/views/reports/report_view.js:10-18` — a user who cannot read reports on this doctype is re-routed to
	 * its List view and `true` is returned; otherwise it defers to
	 * {@link ListView.load_last_view}.
	 */
	static load_last_view(): boolean;

	/** `frappe/public/js/frappe/views/reports/report_view.js:20-22` — a getter returning `"Report"`. */
	readonly view_name: "Report";
	/** `frappe/public/js/frappe/views/reports/report_view.js:24-26` — a getter returning `false`: Report View has no saved-layout menu. */
	readonly show_saved_layout_menu: false;

	/**
	 * `frappe/public/js/frappe/views/reports/report_view.js:94` `$('<div class="datatable-wrapper">')`.
	 *
	 * A {@link JQueryRegion} (gaps.md §6.12) — a literal template, so the mount
	 * point `this.$datatable_wrapper[0]` that every replacement `setup_datatable`
	 * passes to a DataTable constructor needs no `!` and no guard.
	 */
	$datatable_wrapper: JQueryRegion;
	/** `frappe/public/js/frappe/views/reports/report_view.js:99-105`. */
	$charts_wrapper: JQuery<HTMLElement>;

	/**
	 * `frappe/public/js/frappe/views/reports/report_view.js:305`.
	 *
	 * NULLABLE and initially UNSET: never assigned in a constructor, read
	 * defensively at `frappe/public/js/frappe/views/reports/report_view.js:224` (`if (this.datatable && !force)`) and
	 * explicitly cleared at `frappe/public/js/frappe/views/reports/report_view.js:961-962`
	 * (`this.datatable.destroy(); this.datatable = null;`).
	 */
	datatable?: DataTable | null;
	/** `frappe/public/js/frappe/views/reports/report_view.js:1152`, `frappe/public/js/frappe/views/reports/report_view.js:1173` — `column.id` → column. */
	columns_map: Record<string, DataTableColumn>;
	/** `frappe/public/js/frappe/views/reports/report_view.js:41`, from `frappe.get_route()[3]` — set only for saved reports. */
	report_name?: string;
	/** `frappe/public/js/frappe/views/reports/report_view.js:46-47` — the `Report` doc, with `json` already parsed. */
	report_doc?: { json: ReportViewJSON; [field: string]: unknown };
	order_by?: string;
	add_totals_row?: 0 | 1;
	group_by?: string | null;
	/** `frappe/public/js/frappe/views/reports/report_view.js:120` — `new frappe.ui.GroupBy(this)`. */
	group_by_control?: {
		set_args(args: ListViewArgs): void;
		get_settings(): unknown;
		apply_settings(settings: unknown): void;
		get_group_by_docfield(): DocField;
	};
	/** `frappe/public/js/frappe/views/reports/report_view.js:630` — `new frappe.Chart(...)`; nulled at `frappe/public/js/frappe/views/reports/report_view.js:671`. */
	chart?: FrappeBaseChart | null;
	chart_args?: ReportChartArgs | null;
	last_chart_type?: string;
	/** `frappe/public/js/frappe/views/reports/report_view.js:742` — the docname of the last inline edit. */
	last_updated_doc?: string;

	/**
	 * `frappe/public/js/frappe/views/reports/report_view.js:71-76` — SYNCHRONOUS (`ListView.setup_view` is `async`): it calls
	 * `setup_columns()`, `setup_new_doc_event()`, `setup_events()` and tags the
	 * page `report-view`.
	 */
	setup_view(): void;
	/**
	 * `frappe/public/js/frappe/views/reports/report_view.js:1144-1176` — SYNCHRONOUS, and a different model from ListView's: it
	 * rebuilds `columns` / `columns_map` from `fields`, keeping the previous
	 * widths (`frappe/public/js/frappe/views/reports/report_view.js:1146-1149`, `frappe/public/js/frappe/views/reports/report_view.js:1169-1171`).
	 */
	setup_columns(): void;
	/** `frappe/public/js/frappe/views/reports/report_view.js:28-30` — deliberately EMPTY: ReportView has no list header. */
	render_header(): void;
	setup_charts_area(): void;
	set_dirty_state_for_custom_report(): void;
	save_report_settings(): void;
	/** `frappe/public/js/frappe/views/reports/report_view.js:213-229` — `force` bypasses the `datatable.refresh()` fast path. */
	render(force?: boolean): void;
	/** `frappe/public/js/frappe/views/reports/report_view.js:231-239` — always returns a jQuery (creates the span if missing). */
	get_count_element(): JQuery<HTMLElement>;
	/** `frappe/public/js/frappe/views/reports/report_view.js:241-255` — realtime `list_update` payload. */
	on_update(data: { doctype: string; name: string; user?: string }): void;
	update_row(doc: FrappeListDoc, flash_row: boolean): void;
	/**
	 * `frappe/public/js/frappe/views/reports/report_view.js:303-412` — THE prototype-patch target.
	 *
	 * `values` is `this.data` at the only internal call site
	 * (`frappe/public/js/frappe/views/reports/report_view.js:228` `this.setup_datatable(this.data)`), and is passed
	 * straight to `this.get_data(values)`.
	 *
	 * It ends by calling `setup_inline_filter_observer()` and — new in v16.50.0 —
	 * `setup_link_side_panel()` (`frappe/public/js/frappe/views/reports/report_view.js:410-411`); a replacement that builds its own
	 * table has to do both, or inline-filter help icons and the Link-cell side
	 * panel are lost. Its `onCheckRow` handler also gained a call to
	 * `debounced_toggle_workflow_actions()` (`frappe/public/js/frappe/views/reports/report_view.js:323-331`).
	 *
	 * When patching, annotate `this` explicitly:
	 * `function (this: ReportView, values: FrappeListDoc[]) { … }`.
	 */
	setup_datatable(values: FrappeListDoc[]): void;
	/**
	 * `frappe/public/js/frappe/views/reports/report_view.js:415-421` — delegated `click.side-panel` on `$datatable_wrapper` for
	 * `a[data-doctype][data-name]`, which opens the linked doc in the side panel
	 * through `frappe.ui.handle_link_cell_click(e, this.datatable)`
	 * (`frappe/public/js/frappe/views/reports/link_side_panel.js:16-40`) instead of navigating away. It `.off`s the namespace first,
	 * so it is safe to call again after a rebuild.
	 *
	 * The handler only acts when the split view is on (`frappe/public/js/frappe/views/reports/link_side_panel.js:17`), on an
	 * unmodified left click (`frappe/public/js/frappe/views/reports/link_side_panel.js:18`), and on a Link or Dynamic Link column
	 * (`frappe/public/js/frappe/views/reports/link_side_panel.js:28-29`); it finds the column from the nearest `.dt-cell`'s
	 * `data-col-index` and `datatable.getColumn(index)` (`frappe/public/js/frappe/views/reports/link_side_panel.js:24-26`). A
	 * replacement renderer must therefore keep emitting `data-doctype` /
	 * `data-name` on Link anchors, `.dt-cell[data-col-index]`, and `getColumn`.
	 */
	setup_link_side_panel(): void;
	/**
	 * `frappe/public/js/frappe/views/reports/report_view.js:423-433` — adds the comparison help icons, then a debounced (350ms)
	 * `keyup` handler on `.dt-filter` inside `$datatable_wrapper` that keeps the
	 * count in step with the inline filters.
	 */
	setup_inline_filter_observer(): void;
	/** `frappe/public/js/frappe/views/reports/report_view.js:435-456` — one `.comparison-help-icon` after each `.dt-filter` input. */
	setup_inline_filter_help_icons(): void;
	/** `frappe/public/js/frappe/views/reports/report_view.js:458-481`. */
	update_count_for_inline_filter(): void;
	toggle_charts(): void;
	init_chart(): void;
	setup_charts(): void;
	build_chart_args(x_axis: string, y_axes: string[], chart_type: string): void;
	get_chart_settings(): ReportChartArgs | undefined;
	make_chart(): void;
	refresh_charts(): void;
	chart_axes_valid(chart_args: ReportChartArgs): boolean;
	reset_chart_state(): void;
	/**
	 * `frappe/public/js/frappe/views/reports/report_view.js:677-739` — the datatable's `getEditor`.
	 *
	 * DECLARED with 4 parameters (matching the source) but INVOKED with SEVEN by
	 * frappe-datatable's cellmanager (`colIndex, rowIndex, value, parent, column,
	 * row, data`). The extra three are declared optional so a replacement editor
	 * can read them without breaking assignability to frappe's own 4-arg method.
	 *
	 * Returns literal `false` when no control could be made (`frappe/public/js/frappe/views/reports/report_view.js:679`).
	 */
	get_editing_object(
		colIndex: number,
		rowIndex: number,
		value: unknown,
		parent: HTMLElement,
		column?: DataTableColumn,
		row?: DataTableRow,
		data?: DataTableDataRow
	): ReportViewCellEditor | false;
	set_control_value(
		doctype: string,
		docname: string,
		fieldname: string,
		value: unknown
	): Promise<Record<string, unknown>>;
	/** `frappe/public/js/frappe/views/reports/report_view.js:757-788` — returns a `frappe.ui.form` control, or null. */
	render_editing_input(colIndex: number, value: unknown, parent: HTMLElement): unknown;
	evaluate_read_only_depends_on(expression: string | boolean, data: FrappeListDoc): boolean | null;
	is_editable(df: DocField, data: FrappeListDoc): boolean;
	/** `frappe/public/js/frappe/views/reports/report_view.js:841-843` — `return this.build_rows(values)`. */
	get_data(values: FrappeListDoc[]): DataTableCell[][];
	/** `frappe/public/js/frappe/views/reports/report_view.js:845-861` — SYNCHRONOUS, unlike the async base/ListView versions. */
	set_fields(): void;
	set_default_fields(): void;
	reorder_fields(): void;
	get_unique_cdt_in_view(): string[];
	add_column_to_datatable(fieldname: string, doctype: string, col_index?: number): void;
	add_currency_column(fieldname: string, doctype: string, col_index?: number): void;
	add_status_dependency_column(col: string | undefined, doctype: string): void;
	/** `frappe/public/js/frappe/views/reports/report_view.js:1002-1016` — reads only `column.field`. */
	remove_column_from_datatable(column: DataTableColumn): void;
	/** `frappe/public/js/frappe/views/reports/report_view.js:1018-1031` — reads only `col1.field` / `col2.field`. */
	switch_column(col1: DataTableColumn, col2: DataTableColumn): void;
	get_columns_for_picker(): Record<string, DocField[]>;
	get_dialog_fields(): unknown[];
	is_column_added(df: DocField): boolean;
	/** `frappe/public/js/frappe/views/reports/report_view.js:1178-1288` — returns `undefined` for hidden/unknown fields (`frappe/public/js/frappe/views/reports/report_view.js:1217`). */
	build_column(c: [fieldname: string, doctype: string]): DataTableColumn | undefined;
	/** `frappe/public/js/frappe/views/reports/report_view.js:1290-1319` — appends a totals row when `add_totals_row`. */
	build_rows(data: FrappeListDoc[]): DataTableCell[][];
	format_total_cell(formatted_value: string, df: DataTableColumn): string;
	build_row(d: FrappeListDoc): DataTableCell[];
	/**
	 * `frappe/public/js/frappe/views/reports/report_view.js:1389-1398` — MODEL-driven, unlike ListView's Set-driven version:
	 * `this.datatable.rowmanager.getCheckedRows()` indexes into `this.data`.
	 */
	get_checked_items(only_docnames: true): string[];
	get_checked_items(only_docnames?: false | 0 | null | undefined): FrappeListDoc[];
	get_checked_items(only_docnames?: boolean): string[] | FrappeListDoc[];
	/** `frappe/public/js/frappe/views/reports/report_view.js:1400-1402` — `this.datatable.rowmanager.checkAll(false)`. */
	clear_checked_items(): void;
	save_report(save_type?: string): void;
	delete_report(): void;
	/** `frappe/public/js/frappe/views/reports/report_view.js:1474-1483` — `{}` when there is no datatable yet. */
	get_column_widths(): Record<string, number>;
	get_report_doc(): Promise<Record<string, unknown>>;
	get_filters_html_for_print(): string;
	/**
	 * `frappe/public/js/frappe/views/reports/report_view.js:1573-1592` — note the early `return []` when `add_totals_row` is off
	 * (`frappe/public/js/frappe/views/reports/report_view.js:1574-1576`): an empty ARRAY standing in for an empty record.
	 */
	get_columns_totals(data: FrappeListDoc[]): Record<string, unknown>;
	/**
	 * `frappe/public/js/frappe/views/reports/report_view.js:1594-1905`. The Print action reads the live datatable's
	 * `datamanager.rowViewOrder` and `bodyRenderer.visibleRowIndices`
	 * (`frappe/public/js/frappe/views/reports/report_view.js:1611-1614`). The Export action (`frappe/public/js/frappe/views/reports/report_view.js:1768-1809`) reads
	 * `datamanager.rowViewOrder` to send the rows' display order as `visible_names`
	 * (`frappe/public/js/frappe/views/reports/report_view.js:1772-1781`), and — when exporting all rows — turns the first sorted
	 * column of `datamanager.getColumns()` (`.sortOrder`, `.docfield`) into an
	 * `order_by` (`frappe/public/js/frappe/views/reports/report_view.js:1796-1814`). A replacement datatable has to provide those
	 * members, or a sorted / filtered export silently loses its order.
	 */
	report_menu_items(): ListViewMenuItem[];
}
/** Augmentation seam — see {@link ListView}. */
export interface ReportView {}

/* ------------------------------------------------------------------ *
 * 7. QueryReport  (frappe.query_report / frappe.query_reports)
 * ------------------------------------------------------------------ */

/**
 * A prepared Query Report column — `frappe/public/js/frappe/views/reports/report_utils.js:93-119`
 * (`prepare_field_from_column`) then `frappe/public/js/frappe/views/reports/query_report.js:1513-1536`.
 *
 * It is a DocField-shaped object with the datatable's column keys layered on
 * top by `Object.assign`, which is why it is declared as an extension rather
 * than a separate shape.
 */
export interface QueryReportColumn extends DataTableColumn {
	fieldname: string;
	label?: string;
	fieldtype?: string;
	options?: string | string[];
	/** `frappe/public/js/frappe/views/reports/query_report.js:1159` — set by report scripts; filtered out of the render. */
	hidden?: boolean;
}

/** `frappe/public/js/frappe/views/reports/query_report.js:1148-1155` — the raw `frappe.desk.query_report.run` payload. */
export interface QueryReportRawData {
	columns: (string | QueryReportColumn)[];
	result: (Record<string, unknown> | unknown[])[];
	add_total_row?: 0 | 1 | boolean;
	message?: string;
	report_summary?: unknown;
	skip_total_row?: 0 | 1;
	execution_time?: number;
	[extra: string]: unknown;
}

/**
 * `frappe.query_reports[report_name]` — the JS customisation object a report's
 * `<report>.js` assigns, and `this.report_settings` on {@link QueryReport}.
 *
 * `frappe/public/js/frappe/views/reports/query_report.js:10` `frappe.provide("frappe.query_reports")`;
 * `frappe/public/js/frappe/views/reports/query_report.js:499-501` reads it, `frappe/public/js/frappe/views/reports/query_report.js:515` writes it back after eval'ing the
 * fetched script. Every member is optional: `get_local_report_settings`
 * (`frappe/public/js/frappe/views/reports/query_report.js:530-538`) falls back to `{}`.
 */
export interface QueryReportSettings {
	/** `frappe/public/js/frappe/views/reports/query_report.js:517-519` — filter definitions (DocField-like). */
	filters?: DocField[];
	/** `frappe/public/js/frappe/views/reports/query_report.js:478` — fired once, after the first load. */
	onload?(report: QueryReport): void;
	/** `frappe/public/js/frappe/views/reports/query_report.js:954` — `this.report_settings.after_refresh?.(this)`. */
	after_refresh?(report: QueryReport): void;
	/**
	 * Per-cell renderer. `frappe/public/js/frappe/views/reports/query_report.js:1524-1532`.
	 *
	 * SIX parameters, not five: frappe passes `(value, row, column, data,
	 * format_cell, filter)`, where `format_cell` is the default formatter and
	 * `filter` is the datatable's inline-filter term. Most report scripts declare
	 * only the first five, which is why the 6th is optional here.
	 */
	formatter?(
		value: unknown,
		row: unknown,
		column: QueryReportColumn,
		data: Record<string, unknown> | undefined,
		default_formatter: (
			value: unknown,
			row: unknown,
			column: QueryReportColumn,
			data: Record<string, unknown> | undefined
		) => string,
		filter?: unknown
	): string;
	/**
	 * `frappe/public/js/frappe/views/reports/query_report.js:1210-1211` — called with the assembled options and must
	 * RETURN them (the return value replaces the object).
	 *
	 * Called on CONSTRUCTION ONLY: `render_datatable` takes the
	 * `datatable.refresh(data, columns)` reuse path (`frappe/public/js/frappe/views/reports/query_report.js:1186-1192`) whenever the
	 * existing datatable's `showTotalRow` still matches. It is ALSO called
	 * speculatively with `{}` from `prepare_columns` (`frappe/public/js/frappe/views/reports/query_report.js:1480-1483`)
	 * purely to discover whether `checkboxColumn` is on — so it must tolerate an
	 * empty object.
	 */
	get_datatable_options?(options: Partial<DataTableOptions>): DataTableOptions;
	/** `frappe/public/js/frappe/views/reports/query_report.js:1219-1221` — receives the live datatable, typically to poke styles. */
	after_datatable_render?(datatable: DataTable): void;
	/** `frappe/public/js/frappe/views/reports/query_report.js:1216-1218` — only applied when `typeof … == "number"`. */
	initial_depth?: number;
	/** `frappe/public/js/frappe/views/reports/query_report.js:822`, `frappe/public/js/frappe/views/reports/query_report.js:1180`, `frappe/public/js/frappe/views/reports/query_report.js:1203` — tree-mode switch. */
	tree?: boolean;
	/** `frappe/public/js/frappe/views/reports/query_report.js:823`. */
	parent_field?: string;
	/** `frappe/public/js/frappe/views/reports/query_report.js:1268-1270`. */
	get_chart_data?(columns: QueryReportColumn[], result: unknown[]): unknown;
	/** `frappe/public/js/frappe/views/reports/query_report.js:610`, `frappe/public/js/frappe/views/reports/query_report.js:654`. */
	separate_check_filters?: boolean;
	/** `frappe/public/js/frappe/views/reports/query_report.js:655`. */
	collapsible_filters?: boolean;
	/** `frappe/public/js/frappe/views/reports/query_report.js:1847`. */
	export_hidden_cols?: boolean;
	/** `frappe/public/js/frappe/views/reports/query_report.js:1749-1751` — async, may rewrite the print format. */
	get_pdf_format?(report: QueryReport, custom_format: string | null): Promise<string | null>;
	/** Injected by frappe itself at `frappe/public/js/frappe/views/reports/query_report.js:513-514`, not by the report script. */
	html_format?: string | null;
	execution_time?: number;
	[extra: string]: unknown;
}

/**
 * One entry of `QueryReport#filters` — `frappe/public/js/frappe/views/reports/query_report.js:611-653`.
 *
 * It is a `frappe.ui.form` control returned by `page.add_field(df, area)` onto
 * which the filter's own DocField has been merged
 * (`frappe/public/js/frappe/views/reports/query_report.js:649` `f = Object.assign(f, df)`), so it carries BOTH the
 * control API and every DocField key at the top level, plus `df` pointing at
 * the control's own docfield.
 */
export interface QueryReportFilterControl {
	/** The control's docfield — `frappe/public/js/frappe/views/reports/query_report.js:1600` `f.df.fieldname === fieldname`. */
	df: DocField;
	/** Merged in from the filter definition — `frappe/public/js/frappe/views/reports/query_report.js:788-794`. */
	default?: unknown;
	value?: unknown;
	fieldname?: string;
	fieldtype?: string;
	get_value(): unknown;
	set_value(value: unknown): unknown;
	set_input(value: unknown): void;
	/** `frappe/public/js/frappe/views/reports/query_report.js:624` — a Link-field query builder copied off the definition. */
	get_query?: unknown;
	/** `frappe/public/js/frappe/views/reports/query_report.js:625`, `frappe/public/js/frappe/views/reports/query_report.js:642-643` — takes precedence over the auto-refresh. */
	on_change?(report: QueryReport): void;
	[extra: string]: unknown;
}

/**
 * `frappe.views.QueryReport` — `frappe/public/js/frappe/views/reports/query_report.js:30`
 * (`class QueryReport extends frappe.views.BaseList`).
 *
 * NOTE it extends **BaseList**, not ListView: it has no `columns` of
 * {@link ListColumn} type, no `view_name`, and no row checkboxes of its own.
 *
 * The singleton lives at `frappe.query_report`, assigned once by the page
 * factory (`frappe/public/js/frappe/views/reports/query_report.js:21-23`) — so it is `undefined` until the
 * `query-report` route has been visited.
 */
export declare class QueryReport extends BaseList {
	/** `frappe/public/js/frappe/views/reports/query_report.js:31-33` — fire-and-forget; returns undefined. */
	show(): void;
	init(): Promise<unknown>;

	/** `frappe/public/js/frappe/views/reports/query_report.js:52` — `frappe.get_route()`. */
	route: string[];
	/** `frappe/public/js/frappe/views/reports/query_report.js:166` — `this.route[1]`. */
	report_name: string;
	/** `frappe/public/js/frappe/views/reports/query_report.js:488-495` — the `Report` doc (NOT json-parsed, unlike ReportView's). */
	report_doc?: Record<string, unknown>;
	/** `frappe/public/js/frappe/views/reports/query_report.js:499-500` / `frappe/public/js/frappe/views/reports/query_report.js:515` — `frappe.query_reports[report_name]`. */
	report_settings: QueryReportSettings;
	/** `frappe/public/js/frappe/views/reports/query_report.js:1149` — the untouched server payload. */
	raw_data: QueryReportRawData;
	/** `frappe/public/js/frappe/views/reports/query_report.js:1150` — prepared via `prepare_columns`. */
	columns: QueryReportColumn[];
	/** `frappe/public/js/frappe/views/reports/query_report.js:1151` — reset by every `prepare_report_data`; the "Add Column" dialog appends (`frappe/public/js/frappe/views/reports/query_report.js:2176`). */
	custom_columns: QueryReportColumn[];
	/** `frappe/public/js/frappe/views/reports/query_report.js:1152` — array-rows normalised to objects keyed by `column.id`. */
	data: FrappeListDoc[];
	linked_doctypes?: unknown;
	/** `frappe/public/js/frappe/views/reports/query_report.js:1154` — true when any row has an `indent`. */
	tree_report: boolean;
	/**
	 * `frappe/public/js/frappe/views/reports/query_report.js:1213` `new window.DataTable(this.$report[0], datatable_options)`.
	 *
	 * WRITABLE and NULLABLE — never set in a constructor, guarded at `frappe/public/js/frappe/views/reports/query_report.js:1187`,
	 * and nulled by frappe itself when a new report loads (`frappe/public/js/frappe/views/reports/query_report.js:170`) or the
	 * result is too big to show (`frappe/public/js/frappe/views/reports/query_report.js:1171-1174`); consumers legitimately null it
	 * to force a rebuild.
	 */
	datatable?: DataTable | null;
	/** `frappe/public/js/frappe/views/reports/query_report.js:47` — `{ 1: __("Yes"), 0: __("No") }`. */
	boolean_labels: Record<0 | 1, string>;
	/** `frappe/public/js/frappe/views/reports/query_report.js:61`, `frappe/public/js/frappe/views/reports/query_report.js:768` — set from `route_options.ignore_prepared_report`. */
	ignore_prepared_report: boolean;
	/** `frappe/public/js/frappe/views/reports/query_report.js:469`, `frappe/public/js/frappe/views/reports/query_report.js:752`, `frappe/public/js/frappe/views/reports/query_report.js:1002` — `null` unless a prepared report was explicitly requested. */
	prepared_report_name?: string | null;
	prepared_report?: boolean;
	prepared_report_document?: Record<string, unknown>;
	snapshot_report?: unknown;
	snapshot_at?: string;
	refreshed_at?: string;
	execution_time?: number;
	/**
	 * `frappe/public/js/frappe/views/reports/query_report.js:611-653` — the built filter CONTROLS, not tuples.
	 * `get_filter` (`frappe/public/js/frappe/views/reports/query_report.js:1599-1605`) searches them by `f.df.fieldname`
	 * and `refresh` (`frappe/public/js/frappe/views/reports/query_report.js:788-794`) compares `filter.default === filter.value`.
	 */
	filters: QueryReportFilterControl[];
	last_ajax?: { abort(): void };
	interval?: ReturnType<typeof setInterval>;
	stale_report_interval?: ReturnType<typeof setInterval>;
	_no_refresh?: boolean;
	/**
	 * `frappe/public/js/frappe/views/reports/query_report.js:185-253` — the "Related Reports" button, prepended to
	 * `page.custom_actions`; `null` when the report has no siblings or variants.
	 * Rebuilt after every `refresh_report` because `clear_custom_actions()` wipes it
	 * (`frappe/public/js/frappe/views/reports/query_report.js:481-484`).
	 */
	related_reports_dropdown?: JQuery<HTMLElement> | null;

	/* ---- DOM handles: frappe/public/js/frappe/views/reports/query_report.js:2349-2370 ---- */
	/** `frappe/public/js/frappe/views/reports/query_report.js:2367` `$('<div class="report-wrapper">')` — the datatable mount. */
	$report: JQuery<HTMLElement>;
	$status: JQuery<HTMLElement>;
	$report_message: JQuery<HTMLElement>;
	$summary: JQuery<HTMLElement>;
	$chart: JQuery<HTMLElement>;
	$loading: JQuery<HTMLElement>;
	$message: JQuery<HTMLElement>;
	$report_footer?: JQuery<HTMLElement>;
	$tree_footer?: JQuery<HTMLElement>;

	/* ---- methods ---- */
	/** `frappe/public/js/frappe/views/reports/query_report.js:134-159` — the "same report" branch now re-fetches `report_doc` and rebuilds the menu (`frappe/public/js/frappe/views/reports/query_report.js:150-158`). */
	load(): void;
	load_report(route_options?: Record<string, unknown>): void;
	refresh_report(route_options?: Record<string, unknown>): Promise<unknown>;
	get_report_doc(): Promise<unknown>;
	get_report_settings(): Promise<void>;
	get_local_report_settings(custom_report_name?: string): QueryReportSettings;
	setup_progress_bar(): void;
	refresh_filters_dependency(): void;
	evaluate_depends_on_value(expression: string, filter_label?: string): unknown;
	setup_filters(): void;
	/**
	 * `frappe/public/js/frappe/views/reports/query_report.js:735-743` — `filters` is a MAP of fieldname → value, not a list: each
	 * filter control is set from `filters[f.fieldname]`.
	 */
	set_filters(filters: Record<string, unknown>): void;
	set_route_filters(route_options?: Record<string, unknown>): Promise<unknown> | void;
	clear_filters(): void;
	/**
	 * `frappe/public/js/frappe/views/reports/query_report.js:778-956`. See {@link BaseList.refresh} — the instance
	 * property is throttled (`frappe/public/js/frappe/views/reports/query_report.js:58-59`), so the return may be `undefined`.
	 */
	refresh(have_filters_changed?: boolean): Promise<void> | undefined;
	render_summary(data: unknown): void;
	/**
	 * `frappe/public/js/frappe/views/reports/query_report.js:185-253` — builds the "Related Reports" dropdown (siblings saved from the
	 * same base report, plus the base itself). Returns `undefined` when there is no
	 * report loaded yet.
	 */
	set_related_reports_dropdown(): Promise<void> | undefined;
	/** `frappe/public/js/frappe/views/reports/query_report.js:1148-1155`. */
	prepare_report_data(data: QueryReportRawData): void;
	/**
	 * `frappe/public/js/frappe/views/reports/query_report.js:1157-1224` — constructs OR refreshes `this.datatable`, and ends by
	 * calling `setup_link_side_panel()` (`frappe/public/js/frappe/views/reports/query_report.js:1223`). Above `max_report_rows` it
	 * destroys the datatable instead and shows a message (`frappe/public/js/frappe/views/reports/query_report.js:1165-1178`).
	 */
	render_datatable(): void;
	/**
	 * `frappe/public/js/frappe/views/reports/query_report.js:1226-1233` — delegated `click.side-panel` on `$report` for
	 * `a[data-doctype][data-name]`, opening the linked doc in the side panel via
	 * `frappe.ui.handle_link_cell_click(e, this.datatable)` (`frappe/public/js/frappe/views/reports/link_side_panel.js:16-40`; see
	 * {@link ReportView.setup_link_side_panel} for its preconditions). It `.off`s
	 * the namespace first, so repeated calls are safe. A replacement datatable
	 * renderer must keep emitting `data-doctype` / `data-name` on Link cells,
	 * `.dt-cell[data-col-index]`, and `getColumn`. Query-report columns carry
	 * `fieldtype` directly rather than a `docfield` (`frappe/public/js/frappe/views/reports/link_side_panel.js:27-28`).
	 */
	setup_link_side_panel(): void;
	update_masked_fields_in_columns(columns: QueryReportColumn[]): QueryReportColumn[];
	show_loading_screen(): void;
	hide_loading_screen(): void;
	get_chart_options(data: QueryReportRawData): unknown;
	render_chart(options: unknown): void;
	/** `frappe/public/js/frappe/views/reports/query_report.js:1464-1538`. */
	prepare_columns(columns: (string | QueryReportColumn)[]): QueryReportColumn[];
	/**
	 * `frappe/public/js/frappe/views/reports/query_report.js:1540-1552`.
	 *
	 * DISCREPANCY: this overrides `BaseList.prepare_data(r)` (the call response)
	 * with a completely different parameter (the already-unwrapped result rows)
	 * and a non-void return. See the notes file.
	 */
	prepare_data(data: (Record<string, unknown> | unknown[])[]): FrappeListDoc[];
	get_visible_columns(): QueryReportColumn[];
	/** `frappe/public/js/frappe/views/reports/query_report.js:1564-1597` — `raise` makes missing mandatory filters throw. */
	get_filter_values(raise?: boolean): Record<string, unknown>;
	get_filter(fieldname: string, warn?: boolean): unknown;
	get_filter_value(fieldname: string, warn?: boolean): unknown;
	set_filter_value(
		fieldname: string | Record<string, unknown>,
		value?: unknown
	): void;
	make_access_log(method: string, file_format: string): void;
	get_validated_visible_indexes(): number[];
	print_report(print_settings: Record<string, unknown>): Promise<void>;
	pdf_report(print_settings: Record<string, unknown>): Promise<void>;
	export_report(): void;
	get_data_for_csv(include_indentation?: boolean): unknown[][];
	get_data_for_print(): unknown[];
	setup_report_wrapper(): void;
	show_status(status_message: string): void;
	show_report_message(message: string): void;
	hide_status(): void;
	show_footer_message(): void;
	expand_all_rows(): void;
	collapse_all_rows(): void;
	set_tree_level(): void;
	message_div(message: string): string;
	toggle_nothing_to_show(flag: boolean): void;
	toggle_message(flag: boolean, message?: string): void;
	toggle_filter_display(fieldname: string, flag: boolean): void;
	toggle_report(flag: boolean): void;
	toggle_print_buttons(show: boolean): void;
	toggle_primary_button_disabled(disable: boolean): void;
	/**
	 * `frappe/public/js/frappe/views/reports/query_report.js:2273-2289`, called from the "Add Column" dialog (`frappe/public/js/frappe/views/reports/query_report.js:2150-2195`).
	 * `custom_column` is an ARRAY of one column (it goes straight into
	 * `prepare_columns`, which maps over it); `custom_data` is the server's
	 * `get_data_for_custom_field` reply, a map of linked docname → value; and
	 * `new_column_data` is the dialog's values (`field`, plus the `doctype` and
	 * `fieldname` it parsed out of the "From Document Type" choice).
	 */
	add_custom_column(
		custom_column: (string | QueryReportColumn)[],
		custom_data: Record<string, unknown>,
		new_column_data: { field: string; doctype: string; fieldname: string; [extra: string]: unknown },
		insert_after_index: number
	): void;
	get_linked_doctypes(): unknown;
	add_translate_data_checkbox(): void;
	/**
	 * `frappe/public/js/frappe/views/reports/query_report.js:2508-2519` — datatable-driven, like ReportView's:
	 * `this.datatable.rowmanager.getCheckedRows()` indexes into `this.data`.
	 */
	get_checked_items(only_docnames: true): string[];
	get_checked_items(only_docnames?: false | 0 | null | undefined): FrappeListDoc[];
	get_checked_items(only_docnames?: boolean): string[] | FrappeListDoc[];
	/** `frappe/public/js/frappe/views/reports/query_report.js:2521-2523` — a getter aliasing `get_filter_values`, kept for back-compat. */
	readonly get_values: (raise?: boolean) => Record<string, unknown>;
}
/** Augmentation seam — see {@link ListView}. */
export interface QueryReport {}

/* ------------------------------------------------------------------ *
 * 8. ListSettings (the "List View Settings" dialog)
 * ------------------------------------------------------------------ */

/** One row of the field-order editor — `frappe/public/js/frappe/list/list_settings.js:291-296`, `frappe/public/js/frappe/list/list_settings.js:349-352`, `frappe/public/js/frappe/list/list_settings.js:405-408`, `frappe/public/js/frappe/list/list_settings.js:416-427`. */
export interface ListSettingsField {
	fieldname: string;
	label: string;
	/** Only the synthetic status row carries it (`frappe/public/js/frappe/list/list_settings.js:438`). */
	type?: "Status";
	/** A pixel width typed into the dialog's "Width (px)" box; absent when zero (`frappe/public/js/frappe/list/list_settings.js:290-295`). */
	width?: number;
}

/**
 * `frappe/public/js/frappe/list/list_settings.js:1` —
 * `export default class ListSettings`.
 *
 * NOT on the `frappe` global: it is an ES-module default export, reachable only
 * via a deep import or indirectly through
 * {@link ListView.show_list_settings} (`frappe/public/js/frappe/list/list_view.js:2703-2712`).
 */
export declare class ListSettings {
	/** `frappe/public/js/frappe/list/list_settings.js:2-25` — throws when `doctype` is missing (`frappe/public/js/frappe/list/list_settings.js:3-5`). */
	constructor(opts: {
		listview: ListView;
		doctype: string;
		meta: DocTypeMeta;
		settings?: ListViewDBSettings;
	});

	listview: ListView;
	doctype: string;
	meta: DocTypeMeta;
	settings?: ListViewDBSettings;
	/** `frappe/public/js/frappe/list/list_settings.js:11` — `null` until `make()` runs inside `with_doctype`. */
	dialog: unknown | null;
	/** `frappe/public/js/frappe/list/list_settings.js:12-13` — `JSON.parse(settings.fields)`, else `[]`. */
	fields: ListSettingsField[];
	subject_field: ListSettingsField | null;
	/** `frappe/public/js/frappe/list/list_settings.js:15` — 50. */
	max_number_of_fields: number;
	removed_fields?: string[];

	/**
	 * `frappe/public/js/frappe/list/list_settings.js:27-92` — the save callback either writes the fields to the active saved
	 * layout (`frappe/public/js/frappe/list/list_settings.js:59-77`, which then awaits `listview.setup_columns(me.fields)`) or
	 * calls `save_listview_settings` and then `listview.refresh_columns(...)`
	 * (`frappe/public/js/frappe/list/list_settings.js:79-90`).
	 */
	make(): void;
	refresh(): void;
	show_dialog(): void;
	/**
	 * `frappe/public/js/frappe/list/list_settings.js:127-231` — REMOVES the Tag column from the live `listview.columns`
	 * (`frappe/public/js/frappe/list/list_settings.js:138`) as a side effect, in addition to drawing the dialog rows
	 * (now with a width input each, `frappe/public/js/frappe/list/list_settings.js:168-181`).
	 */
	setup_fields(): void;
	add_new_fields(): void;
	setup_remove_fields(): void;
	remove_fields(fieldname: string): void;
	update_fields(): void;
	column_selector(): void;
	reset_listview_fields(dialog: unknown): void;
	get_listview_fields(meta: DocTypeMeta): void;
	set_list_view_fields(meta: DocTypeMeta): void;
	set_subject_field(meta: DocTypeMeta): void;
	set_status_field(): void;
	get_doctype_fields(
		meta: DocTypeMeta,
		fields: string[]
	): { label: string; value: string; checked: boolean }[];
	get_removed_listview_fields(new_fields: string[], existing_fields: string[]): string[];
	set_removed_fields(fields: string[]): void;
}

/* ------------------------------------------------------------------ *
 * 9. Page container / factories
 * ------------------------------------------------------------------ */

/**
 * `frappe.views.Container` — `frappe/public/js/frappe/views/container.js:17`. One instance, at
 * `frappe.container`.
 */
export declare class Container {
	/** `frappe/public/js/frappe/views/container.js:20` — `$("#body").get(0)`. */
	container: HTMLElement;
	/** The currently shown `.page-container` element, or null. */
	page: PageContainerElement | null;
	pagewidth: number;
	pagemargin: number;
	/**
	 * `frappe/public/js/frappe/views/container.js:38-49` — creates
	 * `<div class="content page-container" id="page-<label>" data-page-route="<label>">`,
	 * hidden, appended to `#body`, and registers it in `frappe.pages[label]`.
	 *
	 * This is the origin of the `.page-container` selector contract: MANY of
	 * these coexist (one per routed page) and only one is visible.
	 */
	add_page(label: string): PageContainerElement;
	/** `frappe/public/js/frappe/views/container.js:50-93` — also repaints the breadcrumbs (`frappe/public/js/frappe/views/container.js:90`) and re-resolves sidebar visibility (`frappe/public/js/frappe/views/container.js:91`). */
	change_to(label: string | PageContainerElement): PageContainerElement | undefined;
	/** `frappe/public/js/frappe/views/container.js:94-99` — asks `frappe.app.sidebar.apply_page_visibility()`; the sidebar owns the decision. */
	toggle_sidebar(): void;
	/** `frappe/public/js/frappe/views/container.js:100-117`. */
	has_sidebar(): 0 | 1 | boolean;
}

/** `frappe/public/js/frappe/views/factory.js:7`. */
export declare class Factory {
	constructor(opts?: Record<string, unknown>);
	route: string[];
	page_name: string;
	show(): void;
	make_page(
		double_column: boolean,
		page_name?: string,
		sidebar_position?: string | null
	): PageContainerElement;
	/** Subclass hooks — `frappe/public/js/frappe/views/factory.js:16`, `frappe/public/js/frappe/views/factory.js:20-22`, `frappe/public/js/frappe/views/factory.js:25`. */
	before_show?(): boolean | void;
	on_show?(): void;
	make?(route: string[]): void;
}

/** `frappe/public/js/frappe/list/list_factory.js:7`. */
export declare class ListFactory extends Factory {
	/**
	 * `frappe/public/js/frappe/list/list_factory.js:8-60` — picks the view class from the route (`frappe/public/js/frappe/list/list_factory.js:42`). A Kanban route is
	 * handled first: it resolves the board's engine through
	 * `frappe.views.get_kanban_engine` and builds `KanbanV2View` (loading
	 * `kanban.bundle.js`) or the classic `KanbanView` (`frappe/public/js/frappe/list/list_factory.js:21-40`).
	 */
	make(route: string[]): void;
	before_show(): boolean | void;
	on_show(): void;
	re_route_to_view(): boolean | undefined;
	/** `frappe/public/js/frappe/list/list_factory.js:98-104` — assigns `window.cur_list`. */
	set_cur_list(): void;
}

/* ------------------------------------------------------------------ *
 * 10. The `frappe.views` namespace object
 * ------------------------------------------------------------------ */

/**
 * `frappe.views` — created by `frappe.provide("frappe.views")` in at least
 * `frappe/public/js/frappe/list/base_list.js:3`, `frappe/public/js/frappe/list/list_view.js:4`, `frappe/public/js/frappe/views/reports/report_view.js:7`, `frappe/public/js/frappe/views/reports/query_report.js:9`,
 * `frappe/public/js/frappe/views/container.js:6`, `frappe/public/js/frappe/views/factory.js:5`.
 *
 * EVERY member is optional. `frappe.provide` creates a bare `{}` and each
 * bundle assigns its own class when it loads, so bundle order decides what
 * exists. `carbon_frappe` relies on that: `tables/datatable/install.ts:38` is
 * `frappe.views && frappe.views.ReportView && frappe.views.ReportView.prototype`
 * and `tables/list/list_view.ts:167` is
 * `if (!window.frappe || !frappe.views || !frappe.views.ListView) return;` —
 * both are flagged as always-truthy comparisons if these are declared required.
 */
export interface FrappeViewsNamespace {
	BaseList?: typeof BaseList;
	ListView?: typeof ListView;
	ReportView?: typeof ReportView;
	QueryReport?: typeof QueryReport;
	Container?: typeof Container;
	Factory?: typeof Factory;
	ListFactory?: typeof ListFactory;
	/**
	 * `frappe/public/js/frappe/list/list_factory.js:4` `frappe.provide("frappe.views.list_view")`, keyed by
	 * `frappe.get_route_str()` (`frappe/public/js/frappe/list/list_factory.js:54`, and `frappe/public/js/frappe/list/list_factory.js:27` for Kanban) AND,
	 * separately, by bare doctype (`frappe/public/js/frappe/list/list_factory.js:50`
	 * `frappe.provide("frappe.views.list_view." + doctype)` creates an EMPTY
	 * OBJECT under the doctype key). So a lookup can return a view, a `{}`
	 * placeholder, or nothing — hence the union.
	 */
	list_view?: Record<string, ListView | ReportView | Record<string, never> | undefined>;
	/** `frappe/public/js/frappe/list/base_list.js:1476-1487`. */
	view_modes?: FrappeViewName[];
	/** `frappe/public/js/frappe/list/base_list.js:1488`. */
	is_valid?(view_mode: string): boolean;
	/**
	 * `frappe/public/js/frappe/list/base_list.js:1450-1460` — the icon (a Lucide icon name) each view's switcher row
	 * uses. Has no `Inbox` entry. Shared by the list-family and tree switchers.
	 */
	view_icon_map?: Partial<Record<FrappeViewName, string>>;
	/** `frappe/public/js/frappe/list/base_list.js:1462-1473` — the translated label of every view, one entry per {@link FrappeViewName}. */
	get_view_label_map?(): Record<FrappeViewName, string>;
	/**
	 * `frappe/public/js/frappe/list/list_factory.js:111-121` — whether a Kanban board uses the v2 engine: `false` for no
	 * board, the cached answer if there is one (`frappe/public/js/frappe/list/list_factory.js:113-115`), otherwise a
	 * `Kanban Board` lookup of `use_kanban_v2`.
	 */
	get_kanban_engine?(board: string | undefined): Promise<boolean>;
	/**
	 * `frappe/public/js/frappe/list/list_factory.js:108` — board name → uses Kanban v2. Primed by `KanbanView.get_kanbans`
	 * (`frappe/public/js/frappe/views/kanban/kanban_view.js:587-595`).
	 */
	_kanban_engine_cache?: Record<string, boolean>;
	/**
	 * `frappe/public/js/list_filter.bundle.js:4` — the saved-layout controller,
	 * assigned only once that LAZY bundle has loaded (`frappe/public/js/frappe/list/base_list.js:647-648`), so it is
	 * optional like every other member here. The constructor stores the view
	 * (`frappe/public/js/frappe/list/list_filter/list_filter.js:14`) and then copies the view's own properties onto itself
	 * (`frappe/public/js/frappe/list/list_filter/list_filter.js:15`).
	 */
	ListFilter?: new (list_view: BaseList) => ListFilter;
	/* -- The lazily-loaded views and view helpers. -------------------------
	 *
	 * NO INDEX SIGNATURE (gaps.md §5.4 / §6.14). This interface used to end in
	 * `[view: string]: unknown`, which typed `frappe.views.KanbanVeiw` as
	 * `unknown` instead of erroring — the same typo hole gaps.md §1e flags on
	 * `frappe.ui.form`, and the thing `core.d.ts`'s own stated rule forbids.
	 * Every name below comes from an exhaustive grep of
	 * `frappe/public/js/**` at v16.50.0 for `frappe.views.<name> =`.
	 *
	 * The NAMES are source-verified. The SHAPES are `unknown` because this
	 * package does not declare these classes — that is no worse than the index
	 * signature they replace (which typed them `unknown` too) and strictly
	 * better for every name NOT on the list. Narrow at the use site, or merge a
	 * real type in:
	 *
	 * ```ts
	 * declare module "frappe-types" {
	 *   interface FrappeViewsNamespace { KanbanView: typeof MyKanban }
	 * }
	 * ```
	 *
	 * All optional, like `ListView` / `ReportView` above: each ships in its own
	 * route bundle, so a given desk page has only the ones it has loaded. The
	 * `frappe.views && frappe.views.X && frappe.views.X.prototype` guard that
	 * `carbon_frappe/.../install.ts` already uses narrows these correctly.
	 * ------------------------------------------------------------------- */

	/** `views/calendar/calendar.js` */
	Calendar?: unknown;
	/** `views/calendar/calendar.js` */
	CalendarView?: unknown;
	/** `views/communication.js` */
	CommunicationComposer?: unknown;
	/** `views/dashboard/dashboard_view.js` */
	DashboardView?: unknown;
	/** `views/file/file_view.js` */
	FileView?: unknown;
	/** `views/formview.js` */
	FormFactory?: unknown;
	/** `views/image/image_view.js` */
	GalleryView?: unknown;
	/** `views/gantt/gantt_view.js` */
	GanttView?: unknown;
	/** `views/image/image_view.js` */
	ImageView?: unknown;
	/** `views/inbox/inbox_view.js` */
	InboxView?: unknown;
	/** `views/interaction.js` */
	InteractionComposer?: unknown;
	/** `views/kanban/kanban_board.bundle.js` */
	KanbanBoard?: unknown;
	/** `views/kanban/kanban_board.bundle.js` */
	KanbanBoardCard?: unknown;
	/** `views/kanban/kanban_board.bundle.js` */
	KanbanBoardColumn?: unknown;
	/** `views/kanban/kanban_view.js` */
	KanbanView?: unknown;
	/** `views/kanban_v2/kanban_page.js` — the grouped board (`frappe/public/js/frappe/views/kanban_v2/kanban_page.js:2011`). */
	KanbanV2GroupedBoard?: unknown;
	/** `views/kanban_v2/kanban_page.js` — the page controller (`frappe/public/js/frappe/views/kanban_v2/kanban_page.js:72`). */
	KanbanV2Page?: unknown;
	/** `views/kanban_v2/kanban_page.js` — the view `ListFactory` builds for a v2 board (`frappe/public/js/frappe/views/kanban_v2/kanban_page.js:2196`, `frappe/public/js/frappe/list/list_factory.js:34`). */
	KanbanV2View?: unknown;
	/** `views/kanban_v2/kanban_settings.bundle.js` — `async (page) => …` (`frappe/public/js/frappe/views/kanban_v2/kanban_settings.bundle.js:4`). */
	open_kanban_settings?: unknown;
	/** `list/list_sidebar_group_by.js` */
	ListGroupBy?: unknown;
	/** `list/list_view_select.js` */
	ListViewSelect?: unknown;
	/** `views/map/map_view.js` */
	MapView?: unknown;
	/**
	 * `views/pageview.js` — the desk PAGE-ROUTE view class. NOT `frappe.ui.Page`
	 * (which `utils.d.ts` declares as {@link Page}); the two are unrelated
	 * despite the name.
	 */
	Page?: unknown;
	/** `views/render_preview.js` */
	RenderPreviewer?: unknown;
	/** `views/reports/report_factory.js` */
	ReportFactory?: unknown;
	/** `views/translation_manager.js` */
	TranslationManager?: unknown;
	/** `views/treeview.js` */
	TreeFactory?: unknown;
	/** `views/treeview.js` */
	TreeView?: unknown;
	/** `views/treeview.js` — the Tree view's switcher, a `ListViewSelect` subclass (`frappe/public/js/frappe/views/treeview.js:55`). */
	TreeViewSelect?: unknown;
	/** `views/workspace/workspace.js` */
	Workspace?: unknown;
	/** `views/pageview.js` — `frappe.provide`d registry of page-route views. */
	pageview?: unknown;
}

/**
 * `frappe.get_list_view(doctype)` — `frappe/public/js/frappe/list/list_view.js:3280-3283`.
 *
 * Looks up `frappe.views.list_view["List/<doctype>/List"]`, so it only ever
 * finds the *List* view of a doctype, never its Report view.
 */
export type GetListView = (doctype: string) => ListView | undefined;

/**
 * `frappe.get_current_page()` — `frappe/public/js/frappe/views/container.js:16`: the `frappe.ui.Page` on screen, or
 * `null` before one has rendered. It is `frappe.container?.page?.page || null`,
 * i.e. the page held by the current {@link PageContainerElement}. New in
 * v16.50.0 (the breadcrumbs shim and `Container#change_to` use it); not yet
 * wired onto {@link Frappe} by any fragment.
 */
export type GetCurrentPage = () => Page | null;

/**
 * `window.cur_list` — `frappe/public/js/frappe/list/list_factory.js:6` `window.cur_list = null`, assigned in
 * `set_cur_list` (`frappe/public/js/frappe/list/list_factory.js:99`) and nulled again when the doctype
 * changes (`frappe/public/js/frappe/list/list_factory.js:102`).
 *
 * Holds a ListView **or any subclass**, ReportView included; the harness routes
 * to `/app/todo/view/report` and reads `cur_list.datatable` off it.
 */
export type CurrentListView = ListView | ReportView | null;

/**
 * `window.cur_page` — `frappe/public/js/frappe/views/container.js:8` `window.cur_page = null`.
 *
 * GOTCHA: `change_to` sets `cur_page = this` (`frappe/public/js/frappe/views/container.js:51`), where `this`
 * is the **Container**, not the page. Despite the name it never holds a page.
 */
export type CurrentPage = Container | null;

/* ------------------------------------------------------------------ *
 * 11. DOM / CSS contracts
 *
 * These are string contracts, not values: frappe writes the markup and reads it
 * back with selectors, and any replacement renderer must re-emit the same
 * names. They are exported as string-literal unions (type-level only, no
 * runtime payload) so a consumer can write
 *   const c: FrappeListClassName = "list-row-col";
 * and get a compile error on a typo or an upstream rename.
 * ------------------------------------------------------------------ */

/**
 * Class names emitted by `ListView.get_header_html` / `get_header_html_skeleton`
 * / `get_list_row_html_skeleton` / `get_column_html` / `get_meta_html`
 * (`frappe/public/js/frappe/list/list_view.js:1247-1707`) and read back by frappe's own handlers.
 *
 * Load-bearing read sites:
 *  - `list-row-checkbox`      `frappe/public/js/frappe/list/list_view.js:2211-2236` (shift-select), `frappe/public/js/frappe/list/list_view.js:1175`
 *                             (`find_checkbox_by_docname`), `frappe/public/js/frappe/list/list_view.js:2438`
 *                             (`set_rows_as_checked`), `frappe/public/js/frappe/list/list_view.js:2454` (the `:checked`
 *                             query). The SELECTION is `checked_docnames`, not this DOM.
 *  - `list-header-subject`    `frappe/public/js/frappe/list/list_view.js:2185`, `frappe/public/js/frappe/list/list_view.js:2190`, `frappe/public/js/frappe/list/list_view.js:2448`
 *  - `checkbox-actions`       `frappe/public/js/frappe/list/list_view.js:2186`, `frappe/public/js/frappe/list/list_view.js:2189`, `frappe/public/js/frappe/list/list_view.js:2450`
 *  - `list-check-all`         `frappe/public/js/frappe/list/list_view.js:465`, `frappe/public/js/frappe/list/list_view.js:2185-2194`, `frappe/public/js/frappe/list/list_view.js:2460`
 *  - `list-header-meta`       `frappe/public/js/frappe/list/list_view.js:2463-2464` (`"{0} items selected"`)
 *  - `list-count`             `frappe/public/js/frappe/list/list_view.js:1244` (`get_count_element`)
 *  - `list-liked-by-me`       `frappe/public/js/frappe/list/list_view.js:849` (adds `liked`), `frappe/public/js/frappe/list/list_view.js:2262` (click)
 *  - `list-row-container` / `list-row` / `level-left` / `level-right`
 *                             `frappe/public/js/frappe/list/list_view.js:1614-1621` (`update_listview_classes` MEASURES them),
 *                             `frappe/public/js/frappe/list/list_view.js:1635` (`sync_right_width`)
 *  - `list-row-col[data-fieldname]`  `frappe/public/js/frappe/list/list_view.js:1583` (`apply_column_widths`)
 *  - `list-col-resize-handle` the header drag handle: emitted at `frappe/public/js/frappe/list/list_view.js:1285`,
 *                             matched by `setup_column_resize` at `frappe/public/js/frappe/list/list_view.js:879`
 *  - `list-virtual-spacer`    emitted and cleared by the virtualization bundle
 *                             (`frappe/public/js/frappe/list/list_view_virtualization.js:385-405`), also cleared in `render_list` (`frappe/public/js/frappe/list/list_view.js:1036`)
 *  - `result-container`       the scroll box virtualization listens on (`frappe/public/js/frappe/list/base_list.js:347`,
 *                             `frappe/public/js/frappe/list/list_view_virtualization.js:15`)
 *  - `no-result`              `frappe/public/js/frappe/list/base_list.js:362`, toggled at `frappe/public/js/frappe/list/base_list.js:618`
 *
 * `es-badge` is the status pill (and a Select cell's pill): both come from
 * `frappe.ui.badge.html` (`frappe/public/js/frappe/list/list_view.js:1499`, `frappe/public/js/frappe/list/list_view.js:1896`; markup `frappe/public/js/frappe/ui/components/badge.js:60`, `frappe/public/js/frappe/ui/components/badge.js:77`). It
 * REPLACES `indicator-pill`, which ListView no longer emits.
 */
export type FrappeListClassName =
	| "frappe-list"
	| "result"
	| "result-container"
	| "list-row-container"
	| "list-row"
	| "list-row-head"
	| "list-row-col"
	| "list-row-activity"
	| "list-row-like"
	| "list-row-checkbox"
	| "list-header-subject"
	| "list-header-checkbox"
	| "list-header-meta"
	| "list-check-all"
	| "checkbox-actions"
	| "list-subject"
	| "list-count"
	| "list-liked-by-me"
	| "like-icon"
	| "like-action"
	| "liked"
	| "list-assignments"
	| "list-assignments-container"
	| "comment-count"
	| "tag-col"
	| "tags-empty"
	| "tag-pill"
	| "level"
	| "level-left"
	| "level-right"
	| "level-item"
	| "select-like"
	| "ellipsis"
	| "text-right"
	| "hidden-xs"
	| "hide"
	| "bold"
	| "filterable"
	| "es-badge"
	| "no-result"
	| "no-assign-to"
	| "has-assign-to"
	| "disable-scrolling"
	| "list-view"
	| "layout-main-list"
	| "mobile-layout"
	| "mobile-layout-seperator"
	| "no-seperator"
	| "inner-group-button"
	| "btn-action"
	| "list-col-resize-handle"
	| "list-virtual-spacer";

/**
 * Attribute contracts on list markup.
 *
 *  - `data-sort-by`   written by `get_header_html` (`frappe/public/js/frappe/list/list_view.js:1257`, `frappe/public/js/frappe/list/list_view.js:1278`),
 *                     read by `setup_sort_by` (`frappe/public/js/frappe/list/list_view.js:2070`)
 *  - `data-name`      written by `ElementFactory` (`frappe/public/js/frappe/list/list_view.js:3331`, `frappe/public/js/frappe/list/list_view.js:3341`,
 *                     `frappe/public/js/frappe/list/list_view.js:3351`), read by `get_checkbox_docname` as
 *                     `attr("data-name")` then `data().name` (`frappe/public/js/frappe/list/list_view.js:1161`) and
 *                     URI-decoded only if that parses (`frappe/public/js/frappe/list/list_view.js:1166-1170`)
 *  - `data-fieldname` header cells (`frappe/public/js/frappe/list/list_view.js:1287`; the literal `"undefined"` for
 *                     the Tag column) and row cells (`frappe/public/js/frappe/list/list_view.js:1416`, `frappe/public/js/frappe/list/list_view.js:1566`);
 *                     consumed by `apply_column_widths` (`frappe/public/js/frappe/list/list_view.js:1583`),
 *                     `capture_column_widths_from_dom` (`frappe/public/js/frappe/list/list_view.js:1092`) and the
 *                     column drag (`frappe/public/js/frappe/list/list_view.js:883`)
 *  - `data-filter`    `frappe/public/js/frappe/list/list_view.js:1504`, `frappe/public/js/frappe/list/list_view.js:1509`, `frappe/public/js/frappe/list/list_view.js:1523`, `frappe/public/js/frappe/list/list_view.js:1902`; read by
 *                     `setup_filterable` (`frappe/public/js/frappe/list/list_view.js:2053`)
 *  - `data-idx`       `frappe/public/js/frappe/list/list_view.js:1714`, `frappe/public/js/frappe/list/list_view.js:1738`; read at `frappe/public/js/frappe/list/list_view.js:2160`, `frappe/public/js/frappe/list/list_view.js:2168`
 *  - `data-parent`    `frappe/public/js/frappe/list/list_view.js:2197` — group-by child checkboxes
 *  - `data-doctype` / `data-liked-by` — `frappe/public/js/frappe/list/list_view.js:3301`, `frappe/public/js/frappe/list/list_view.js:3356`
 *  - `data-virtual-row` `frappe/public/js/frappe/list/list_view.js:1393` — stamps a row the virtualization window owns;
 *                     read by the bundle (`frappe/public/js/frappe/list/list_view_virtualization.js:295`, `frappe/public/js/frappe/list/list_view_virtualization.js:358`, `frappe/public/js/frappe/list/list_view_virtualization.js:386`)
 *  - `data-row-index` — the datatable's, read by `ReportView.update_row` (`frappe/public/js/frappe/views/reports/report_view.js:291`)
 *
 * STRICT NOTE: `$(el).data()` is typed `any` by `@types/jquery`. Wrap it in one
 * narrowing helper rather than sprinkling assertions.
 */
export type FrappeListDataAttribute =
	| "data-sort-by"
	| "data-name"
	| "data-fieldname"
	| "data-filter"
	| "data-idx"
	| "data-parent"
	| "data-doctype"
	| "data-liked-by"
	| "data-label"
	| "data-row-index"
	| "data-virtual-row"
	| "button-idx"
	| "tabindex";

/**
 * frappe-datatable class names re-emitted by a replacement report renderer, so
 * existing app CSS and frappe's own code keep matching.
 *
 * `dt-row` is read by `ReportView.update_row` (`frappe/public/js/frappe/views/reports/report_view.js:291`
 * `.dt-row[data-row-index="…"]` + the `row-update` flash class);
 * `dt-filter` by `setup_inline_filter_observer` (`frappe/public/js/frappe/views/reports/report_view.js:428`) and
 * `setup_inline_filter_help_icons` (`frappe/public/js/frappe/views/reports/report_view.js:440`). `dt-cell` is what
 * `frappe.ui.handle_link_cell_click` climbs to for `data-col-index`
 * (`frappe/public/js/frappe/views/reports/link_side_panel.js:24`). `dt-cell__content` is frappe-datatable's own; ReportView no longer
 * touches it (the title back-fill that did is gone), but frappe's data-import
 * preview still styles it (`frappe/public/js/frappe/data_import/import_preview.js:365`).
 * Layout for all of them comes from `public/scss/desk/frappe_datatable.scss`,
 * which lays `.dt-row` out as `display: flex` — a real conflict if the
 * replacement emits them on a genuine `<table>`.
 */
export type FrappeDatatableClassName =
	| "datatable-wrapper"
	| "dt-row"
	| "dt-cell"
	| "dt-cell__content"
	| "dt-filter"
	| "dt-scrollable"
	| "dt-input"
	| "row-update"
	| "charts-wrapper"
	| "charts-inner-wrapper"
	| "btn-chart-configure"
	| "report-wrapper"
	| "report-view";

/**
 * Desk shell selectors that live OUTSIDE the view classes but are part of the
 * same contract surface, because replacing the shell moves or deletes them.
 * Every member below was grepped against v16.50.0's `.html` / `.js` / `.scss`;
 * the ones v16.33.0 had and v16.50.0 does not (`.standard-items-sections`,
 * `.dropdown-notifications`, `.sidebar-notification-count`,
 * `.collapse-sidebar-link`, and the `.navbar-breadcrumbs > li:last-child > a`
 * path) are gone from the union.
 *
 *  - `.page-container`               `frappe/public/js/frappe/views/container.js:39`. Many coexist, one
 *                                    visible — hence `.page-container:visible`.
 *                                    Also carries `data-page-route` (`frappe/public/js/frappe/views/container.js:41`).
 *  - `.navbar-breadcrumbs`           `frappe/public/js/frappe/ui/page.html:17` — the `<nav>` around the trail.
 *                                    Its `<ol><li>` children are built by
 *                                    `frappe.ui.breadcrumbs` (`frappe/public/js/frappe/ui/components/breadcrumbs.js:76-81`) and the
 *                                    list is refilled by `Page#render_breadcrumbs`
 *                                    (`frappe/public/js/frappe/ui/page.js:1019-1035`) on EVERY `set_breadcrumbs()`
 *                                    and `frappe.breadcrumbs.update()` (`frappe/public/js/frappe/views/breadcrumbs.js:41-43`,
 *                                    called from `Container#change_to`, `frappe/public/js/frappe/views/container.js:90`) —
 *                                    anything injected into a crumb must be
 *                                    re-applied idempotently.
 *  - `.navbar-breadcrumbs > ol > li:last-child > .es-breadcrumbs__item`
 *                                    the last crumb, the document / list title. It is
 *                                    an `<a>`, a `<button>` or — the usual case for a
 *                                    crumb with no link — a `<span>`, so select by
 *                                    the class, not by `a` (`frappe/public/js/frappe/ui/components/breadcrumbs.js:76-80`). The
 *                                    `ul > li > a` shape this replaces is gone.
 *  - `header`                        `frappe/www/desk.html:51`, inside `.main-section` (`frappe/www/desk.html:50`).
 *                                    EMPTY on a normal desktop load; frappe fills it
 *                                    only for read-only / impersonation /
 *                                    announcement / mobile (`frappe/public/js/frappe/ui/toolbar/toolbar.js:9-21`).
 *  - `.body-sidebar`                 `frappe/public/js/frappe/ui/sidebar/sidebar.html:2`; cached as `this.$sidebar` (`frappe/public/js/frappe/ui/sidebar/sidebar.js:68`)
 *                                    and the default wrapper of
 *                                    `frappe.ui.Notifications` (`frappe/public/js/frappe/ui/notifications/notifications.js:12`).
 *  - `.standard-items-band`          `frappe/public/js/frappe/ui/sidebar/sidebar.html:8` — the band of Search / Notification
 *                                    rows under the header, filled by
 *                                    `Sidebar#add_standard_items` (`frappe/public/js/frappe/ui/sidebar/sidebar.js:640-668`).
 *                                    It sits OUTSIDE `.body-sidebar-top`, the box
 *                                    that scrolls (`frappe/public/js/frappe/ui/sidebar/sidebar.html:3-9`). It replaces
 *                                    `.standard-items-sections`: the JS property
 *                                    `$standard_items_sections` survives (`frappe/public/js/frappe/ui/sidebar/sidebar.js:67`)
 *                                    but now holds `.body-sidebar` itself, and no
 *                                    element carries that class.
 *  - `.dropdown-navbar-user`         `frappe/public/js/frappe/ui/sidebar/sidebar.html:16` — the user button's wrapper. The user
 *                                    menu is a `frappe.ui.Dropdown` mounted on it
 *                                    (`frappe/public/js/frappe/ui/sidebar/sidebar.js:409-412`). Its `<a>` no longer has an
 *                                    inline `onclick`, so moving it needs only the
 *                                    dropdown re-bound.
 *  - `.sidebar-notification`         the bell row, generated at `frappe/public/js/frappe/ui/sidebar/sidebar.js:652-660` with
 *                                    the literal classes
 *                                    `"sidebar-notification hidden"`;
 *                                    `frappe.ui.Notifications` un-hides it (`frappe/public/js/frappe/ui/notifications/notifications.js:17`)
 *                                    and uses it as the panel's `trigger_selector`
 *                                    (`frappe/public/js/frappe/ui/notifications/notifications.js:39`).
 *  - `.notification-count`           the unread badge — inside that bell row
 *                                    (`frappe/public/js/frappe/ui/sidebar/sidebar.js:658`, `.notification-count.hidden`) and in
 *                                    the desktop bell (`frappe/desk/page/desktop/desktop.html:44`, `frappe/desk/page/desktop/desktop_icons.html:34`). It
 *                                    replaces `.sidebar-notification-count`.
 *  - `.sidebar-toggle-btn`           `frappe/public/js/frappe/ui/page.html:5` — ONE per page head: every cached
 *                                    `.page-container` carries its own copy, and
 *                                    only the visible page's is live
 *                                    (`.sidebar-toggle-btn.navbar-brand`, handler at
 *                                    `frappe/public/js/frappe/ui/page.js:288`). The sidebar also excludes it from its
 *                                    click-away close (`frappe/public/js/frappe/ui/sidebar/sidebar.js:701`). The second match
 *                                    v16.33.0 had inside the sidebar is gone.
 *  - `.desktop-*`                    the desktop page, rendered from
 *                                    `desktop.html` or — in "Desktop Icons" mode — from
 *                                    `desktop_icons.html`. `.desktop-wrapper`
 *                                    (`frappe/desk/page/desktop/desktop.html:2`, `frappe/desk/page/desktop/desktop_icons.html:2`), `.desktop-navbar`
 *                                    (`frappe/desk/page/desktop/desktop.html:3`, `frappe/desk/page/desktop/desktop_icons.html:3`), `.desktop-notifications`
 *                                    (`frappe/desk/page/desktop/desktop.html:37`, `frappe/desk/page/desktop/desktop_icons.html:27`) and `.desktop-avatar`
 *                                    (`frappe/desk/page/desktop/desktop.html:47`, `frappe/desk/page/desktop/desktop_icons.html:37`) are in both;
 *                                    `.desktop-search-wrapper` only in
 *                                    `desktop_icons.html` (`frappe/desk/page/desktop/desktop_icons.html:11`).
 *                                    Handlers bind by selector at `frappe/desk/page/desktop/desktop.js:234` (the
 *                                    notifications wrapper), `frappe/desk/page/desktop/desktop.js:239` (fills the
 *                                    avatar) and `frappe/desk/page/desktop/desktop.js:286` (the avatar's dropdown),
 *                                    and `frappe/public/js/desktop_icons.bundle.js:163`, `frappe/public/js/desktop_icons.bundle.js:288`, `frappe/public/js/desktop_icons.bundle.js:304` toggle
 *                                    `data-mode` on the wrapper, so MOVING these nodes
 *                                    preserves behaviour while CLONING them would not.
 *
 * STRICT NOTE: `document.querySelector(sel)` is `Element | null`, and `Element`
 * has neither `.dataset` nor `.click()`. Use the generic form
 * (`querySelector<HTMLElement>(…)`) at every one of these sites.
 */
export type FrappeDeskSelector =
	| ".page-container"
	| ".page-container:visible"
	| ".navbar-breadcrumbs"
	| ".navbar-breadcrumbs > ol > li:last-child > .es-breadcrumbs__item"
	| "header"
	| ".main-section"
	| ".body-sidebar"
	| ".standard-items-band"
	| ".dropdown-navbar-user"
	| ".sidebar-notification"
	| ".notification-count"
	| ".sidebar-toggle-btn"
	| ".desktop-wrapper"
	| ".desktop-navbar"
	| ".desktop-search-wrapper"
	| ".desktop-notifications"
	| ".desktop-avatar"
	| ".page-head-content"
	| ".layout-main"
	| ".list-skeleton";

/**
 * SVG sprite ids referenced by list/report markup. Each is defined in the Lucide
 * sprite the desk loads (`frappe/hooks.py:39-45` `app_include_icons`):
 * `#icon-heart` — the like button, emitted at `frappe/public/js/frappe/list/list_view.js:1305` and `frappe/public/js/frappe/list/list_view.js:3323`, styled by
 * `frappe/public/scss/common/icons.scss:18,41` (`frappe/public/icons/lucide/icons.svg:5181`); `#icon-table` — the
 * query report's loading state (`frappe/public/js/frappe/views/reports/query_report.js:1253`, `frappe/public/icons/lucide/icons.svg:9803`); `#icon-menu` — the page
 * head's sidebar toggle (`frappe/public/js/frappe/ui/page.html:7`, `frappe/public/icons/lucide/icons.svg:6314`).
 *
 * `#icon-small-file` is gone from the union: it is defined only in the timeless
 * sprite (`frappe/public/icons/timeless/icons.svg:578`), and the list's empty
 * state that used it is now `frappe.ui.empty_state.html({ icon })` (`frappe/public/js/frappe/list/list_view.js:759-764`).
 */
export type FrappeIconSpriteId = "#icon-heart" | "#icon-table" | "#icon-menu";

/* ------------------------------------------------------------------ *
 * 12. The two report singletons that hang off `frappe` itself
 * ------------------------------------------------------------------ */

/**
 * The report members of the `frappe` root — mixed into {@link Frappe}.
 *
 * These live here rather than in `core.d.ts` because both are typed by
 * {@link QueryReport} / {@link QueryReportSettings}, which this file owns.
 *
 * Both are OPTIONAL, and for two different reasons:
 *
 * - `frappe.query_reports` is created by `frappe.provide("frappe.query_reports")`
 *   at `frappe/public/js/frappe/views/reports/query_report.js:10` — module scope
 *   of `frappe/public/js/report.bundle.js:4`, which the desk loads lazily per route. Absent on a
 *   desk page that has never opened a report.
 * - `frappe.query_report` is assigned even later: `frappe/public/js/frappe/views/reports/query_report.js:21`, inside
 *   the `frappe.standard_pages["query-report"]` factory, so it only exists once
 *   that page has been *constructed*. `frappe/public/js/frappe/widgets/chart_widget.js:472` also
 *   reassigns it to a throwaway instance for the chart-filter dialog, which is
 *   why it is writable rather than `readonly`.
 *
 * Guard with `window.frappe && frappe.query_report && …`, exactly as
 * `frappe/public/js/frappe/views/reports/report_utils.js:135-143` does for
 * `query_reports`.
 */
export interface FrappeQueryReportGlobals {
	/**
	 * The live Query Report page controller.
	 *
	 * `frappe/public/js/frappe/views/reports/query_report.js:21` — `frappe.query_report = new frappe.views.QueryReport({parent: wrapper})`;
	 * `frappe/public/js/frappe/widgets/chart_widget.js:472` reassigns it.
	 *
	 * Its `datatable` member is itself `DataTable | null | undefined`
	 * ({@link QueryReport.datatable}) — `frappe/public/js/frappe/views/reports/query_report.js:1157-1224` builds it on
	 * first render and callers null it to force a rebuild.
	 */
	query_report?: QueryReport;

	/**
	 * Per-report JS customisation objects, keyed by report name.
	 *
	 * `frappe/public/js/frappe/views/reports/query_report.js:10` `frappe.provide("frappe.query_reports")` creates the
	 * bare object; a report's own `<report>.js` assigns into it
	 * (`frappe/public/js/frappe/views/reports/query_report.js:515`), and `get_local_report_settings`
	 * (`frappe/public/js/frappe/views/reports/query_report.js:530-538`) reads it back with a `|| {}` fallback.
	 *
	 * The value is `| undefined` independently of `noUncheckedIndexedAccess`:
	 * `frappe/public/js/frappe/views/reports/report_utils.js:122` and `frappe/public/js/frappe/views/reports/query_report.js:499` both test
	 * `if (frappe.query_reports[report_name])` before dereferencing, because a
	 * report whose script has not been eval'd yet has no entry.
	 */
	query_reports?: Record<string, QueryReportSettings | undefined>;
}

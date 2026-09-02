/**
 * `frappe.views` — List view, Report view, Query Report and their shared base.
 *
 * Source of truth: frappe **v16.33.0** (git tag `v16.33.0`, branch `version-16`).
 * Every declaration below was read out of:
 *
 *   frappe/public/js/frappe/list/base_list.js          (1451 lines)
 *   frappe/public/js/frappe/list/list_view.js          (2776 lines)
 *   frappe/public/js/frappe/list/list_settings.js      ( 413 lines)
 *   frappe/public/js/frappe/list/list_factory.js       (  99 lines)
 *   frappe/public/js/frappe/views/reports/report_view.js  (1914 lines)
 *   frappe/public/js/frappe/views/reports/query_report.js (2432 lines)
 *   frappe/public/js/frappe/views/reports/report_utils.js ( 354 lines)
 *   frappe/public/js/frappe/views/container.js         ( 112 lines)
 *   frappe/public/js/frappe/views/factory.js
 *   frappe/public/js/frappe/views/breadcrumbs.js
 *
 * Citations in comments are `file.js:line` relative to `frappe/public/js/frappe/`.
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
import type { DocField, DocTypeMeta, IndicatorTuple } from "./model";
// IMPORT-NAME FIXES — `Page` is `frappe.ui.Page`, declared in `utils.d.ts` (the
// fragment that owns `FrappePageRegions`), never in `core.d.ts`.
import type { Page } from "./utils";
// `charts.d.ts` exports no `Chart`. `ReportView#chart` holds the RESULT of
// `new frappe.Chart(...)` (report_view.js:650), and `FrappeChartConstructor`'s
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
 * `base_list.js:1439-1450` — `frappe.views.view_modes = [...]`, and
 * `base_list.js:1451` `frappe.views.is_valid = (m) => view_modes.includes(m)`.
 * `list_factory.js:14-21` builds the class name as `frappe.views[view_name + "View"]`.
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
 * `base_list.js:635-637` — `get_filters_for_args()` slices every filter to 4
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
 * `base_list.js:571-587` (`prepare_data`) assembles it via
 * `frappe.utils.dict(data.keys, data.values)`, so the concrete keys are the
 * requested `fields` and are only known at runtime — hence the index signature.
 *
 * STRICT NOTE: `name` is declared before the index signature on purpose. Adding
 * `[fieldname: string]: unknown` first would widen `doc.name` to `unknown` and
 * break `getRowId: (doc) => doc.name`.
 */
export interface FrappeListDoc {
	/** Always requested — `base_list.js:88` puts `frappe.model.std_fields_list` in every query. */
	name: string;
	/** `list_view.js:1377` `doc.docstatus || 0`; `report_view.js:840-845`. */
	docstatus?: 0 | 1 | 2;
	/** `list_view.js:1145` `comment_when(doc.modified, true)`. */
	modified?: string;
	/** JSON-encoded array of user ids. `list_view.js:1149`, `list_view.js:691-693`. */
	_assign?: string | null;
	/** JSON-encoded array of user ids. `list_view.js:1311` `JSON.parse(doc._liked_by)`. */
	_liked_by?: string | null;
	/** JSON-encoded array of user ids. `list_view.js:1306` `JSON.parse(doc._seen)`. */
	_seen?: string | null;
	/** Comma-joined tag names. `list_view.js:918` → `get_tags_html(doc._user_tags, 2, true)`. */
	_user_tags?: string | null;
	/** `list_view.js:1161-1165` `doc._comment_count > 99 ? "99+" : doc._comment_count || 0`. */
	_comment_count?: number;
	/**
	 * Row ordinal, WRITTEN onto the doc during render.
	 * `list_view.js:691` `doc._idx = idx++;` — consumed as `data-idx` by
	 * `generate_button_html` (`:1193`) / `generate_dropdown_html` (`:1220`) and
	 * read back in `setup_action_handler` (`:1640` `this.data[$button.attr("data-idx")]`).
	 */
	_idx?: number;
	[fieldname: string]: unknown;
}

/**
 * `this.parent` on every view.
 *
 * `base_list.js:6` `Object.assign(this, opts)` — `parent` comes straight from
 * the constructor options, and `list_factory.js:32-35` passes
 * `me.make_page(...)` → `frappe.make_page` (`views/factory.js:36-51`) → a raw
 * `<div class="content page-container">` from `views/container.js:30-39`, onto
 * which `frappe.ui.make_app_page` (`ui/page.js:22-25`) assigns `.page`.
 *
 * So it really is a DOM element that also carries a `frappe.ui.Page`; hence the
 * intersection rather than a plain object type.
 */
export interface PageContainerElement extends HTMLElement {
	/** `ui/page.js:23` `opts.parent.page = new frappe.ui.Page(opts)`. */
	page: Page;
	/** `views/container.js:37` `page.label = label`. */
	label?: string;
	/** `views/container.js:78` `this.page._route = frappe.router.get_sub_path()`. */
	_route?: string;
	/** `list_view.js:46` `this.parent.disable_scroll_to_top = true` (read at `container.js:80`). */
	disable_scroll_to_top?: boolean;
	/** `list_view.js:153` `this.parent.list_view = this`. */
	list_view?: ListView;
}

/**
 * Constructor options. `base_list.js:5-7` is literally
 * `constructor(opts) { Object.assign(this, opts); }`, so ANY property is
 * accepted and lands on the instance verbatim; the two below are the ones every
 * caller passes (`list_factory.js:32-35`, `query_report.js:21-23`).
 */
export interface BaseListOptions {
	doctype?: string;
	parent: PageContainerElement;
	[option: string]: unknown;
}

/* ------------------------------------------------------------------ *
 * 2. listview_settings — the per-doctype JS customisation hook
 * ------------------------------------------------------------------ */

/** `list_view.js:1195` `this.settings.button.get_label(doc)` etc. */
export interface ListViewSettingsButton {
	/** `list_view.js:1194` — rendered into `title="…"`. */
	get_description(doc: FrappeListDoc): string;
	/** `list_view.js:1195` — rendered as the button's inner HTML. */
	get_label(doc: FrappeListDoc): string;
	/** `list_view.js:1199` — falsy renders `<span></span>` instead of the button. */
	show(doc: FrappeListDoc): boolean;
}

/**
 * One entry of `settings.dropdown_button.buttons`.
 *
 * ASYMMETRY WORTH KNOWING: unlike {@link ListViewSettingsButton}, `get_label`
 * here is a **string property, not a function** — `list_view.js:1224`
 * interpolates `${button.get_label}` with no call, and so do `:1229` / `:1236`
 * for the parent dropdown's own `get_label`.
 */
export interface ListViewSettingsDropdownItem {
	/** A STRING, despite the `get_` prefix. `list_view.js:1224`. */
	get_label: string;
	/** `list_view.js:1216` — omitted means "always show". */
	show?(doc: FrappeListDoc): boolean;
	/** `list_view.js:1217`. */
	get_description?(doc: FrappeListDoc): string;
	/** `list_view.js:1644-1646` `button.action(doc)`. */
	action?(doc: FrappeListDoc): void;
}

/** `list_view.js:1209-1243`. */
export interface ListViewSettingsDropdownButton {
	/** A STRING. `list_view.js:1229`, `:1236`. */
	get_label: string;
	buttons: ListViewSettingsDropdownItem[];
}

/**
 * `frappe.listview_settings[doctype]`, i.e. `this.settings` on every view.
 *
 * `base_list.js:45` — `this.settings = frappe.listview_settings[this.doctype] || {}`.
 * The `|| {}` is why **every member is optional**: the object is frequently
 * absent entirely, and app-supplied ones set only a couple of keys.
 *
 * Members below are exactly those frappe itself reads
 * (`grep -o 'this\.settings\.[a-z_]*'` over base_list/list_view/report_view).
 */
export interface ListViewSettings {
	/** `list_view.js:219` — extra fieldnames pulled into the query. */
	add_fields?: (string | DocField)[];
	/** `list_view.js:658` `this.settings.before_render && this.settings.before_render()` — NO arguments. */
	before_render?(): void;
	/** `list_view.js:1191`, `:1197-1200`. */
	button?: ListViewSettingsButton;
	/** `list_view.js:1211`. */
	dropdown_button?: ListViewSettingsDropdownButton;
	/** `list_view.js:107-112` / `:610-616` — 3-tuples are expanded to 4 with `this.doctype` in front. */
	filters?: (ListFilterTuple | [fieldname: string, operator: string, value: unknown])[];
	/**
	 * Per-fieldname cell renderer, returning HTML.
	 * `list_view.js:1035-1041` `this.settings.formatters[fieldname](value, df, doc)`
	 * and `list_view.js:1350-1352` for the Subject column.
	 */
	formatters?: Record<string, (value: unknown, df: DocField, doc: FrappeListDoc) => string>;
	/** `list_view.js:1296-1298` — overrides the row's link href. */
	get_form_link?(doc: FrappeListDoc): string;
	/**
	 * `model/indicator.js:8` (existence check in `frappe.has_indicator`) and
	 * `model/indicator.js:37` — consulted by `frappe.get_indicator`.
	 */
	get_indicator?(doc: FrappeListDoc): IndicatorTuple | null | undefined;
	/** `list_view.js:483` — suppresses the trailing synthetic "ID" column. */
	hide_name_column?: boolean;
	/** `list_view.js:365` (ListView) and `report_view.js:88` (ReportView) — both pass the view. */
	onload?(view: BaseList): void;
	/** `list_view.js:290-292`, `:302-304`, `:1739-1741` — replaces "Add {doctype}". Takes NO arguments. */
	primary_action?(): void;
	/** `base_list.js:557-559` `this.settings.refresh(this)` — fired after every refresh. */
	refresh?(view: BaseList): void;
	/**
	 * Extra bundles to `frappe.require` before the first render.
	 * `list_view.js:268-274` reads `this.required_libs` (an instance property that
	 * subclasses such as GanttView set), not `settings.required_libs`.
	 */
	[extra: string]: unknown;
}

/**
 * The **"List View Settings"** DOCTYPE document — `this.list_view_settings`.
 * Fetched by `base_list.js:73-79` (`frappe.desk.listview.get_list_settings`),
 * defaulting to `{}`.
 *
 * Field list verified against
 * `frappe/desk/doctype/list_view_settings/list_view_settings.json` at v16.33.0.
 * All Check fields, so `0 | 1` (never JS booleans) when the doc exists.
 */
export interface ListViewDBSettings {
	/** `list_view.js:575`, `:714`. */
	disable_count?: 0 | 1;
	disable_sidebar_stats?: 0 | 1;
	/** `list_view.js:1752`, `report_view.js:67`. */
	disable_auto_refresh?: 0 | 1;
	/** `list_view.js:585`, `:1163`. */
	disable_comment_count?: 0 | 1;
	allow_edit?: 0 | 1;
	/** `list_view.js:119`. */
	disable_automatic_recency_filters?: 0 | 1;
	/** `list_view.js:1084`, `:1107`. */
	disable_scrolling?: 0 | 1;
	/** `list_view.js:372`, `:1746` — feeds `tags_shown`. */
	show_tags?: 0 | 1;
	/** A JSON-encoded `{fieldname, label}[]`. `list_view.js:475`, `:500`, `list_settings.js:11`. */
	fields?: string;
}

/**
 * `this.view_user_settings` — `frappe.get_user_settings(doctype)[view_name]`.
 * `base_list.js:46`, `list_view.js:85-87`.
 */
export interface ListViewUserSettings {
	filters?: ListFilterTuple[];
	sort_by?: string;
	sort_order?: "asc" | "desc";
	last_view?: string;
	/** ReportView only — `report_view.js:52-53`, `:876-880`. */
	fields?: [fieldname: string, doctype: string][];
	add_totals_row?: 0 | 1;
	group_by?: unknown;
	chart_args?: ReportChartArgs | null;
	[key: string]: unknown;
}

/* ------------------------------------------------------------------ *
 * 3. ListView column descriptors
 * ------------------------------------------------------------------ */

export type ListColumnType = "Subject" | "Status" | "Tag" | "Field";

/**
 * A ListView column descriptor, as built by `setup_columns()`
 * (`list_view.js:411-496`).
 *
 * This is a DISCRIMINATED UNION on purpose: `Status` (`:436-438`) and `Tag`
 * (`:479-481`) are pushed with **no `df` at all**, while `Subject` (`:419-431`)
 * and `Field` (`:453-456`, `:485-491`) always carry one. Flattening it to
 * `{ type: string; df?: DocField }` forces non-null assertions at every
 * `col.df.fieldname` in the Subject branch of a consumer's header renderer.
 *
 * Note the two SYNTHETIC dfs: `:425-428` and `:487-490` push
 * `{ label: __("ID"), fieldname: "name" }` — a DocField with no `fieldtype`,
 * no `parent`, no `options`. That is why `DocField` must have those optional.
 *
 * The `Status` / `Tag` members carry `df?: undefined` rather than omitting the
 * key. Omitting it makes the whole union lack a common `df`, and TypeScript
 * then rejects the ubiquitous `col.df && col.df.fieldname` guard with TS2339
 * before it ever narrows. With `df?: undefined` the guard compiles, `col.df` is
 * `DocField | undefined` on an unnarrowed column, and `DocField` (no
 * assertion) inside a `col.type === "Subject"` branch. Same reason frappe's own
 * `get_header_html` can write `col.df?.fieldname` unconditionally
 * (`list_view.js:781`, `:791`).
 */
export type ListColumn =
	/** `list_view.js:419-431` — title_field, or the synthetic ID df. Always first. */
	| { type: "Subject"; df: DocField }
	/** `list_view.js:436-438` — pushed only when `frappe.has_indicator(doctype)`. NO `df`. */
	| { type: "Status"; df?: undefined }
	/** `list_view.js:479-481` — spliced in at index 1, after the slice. NO `df`. */
	| { type: "Tag"; df?: undefined }
	/** `list_view.js:453-456` (in_list_view fields) and `:485-491` (trailing ID). */
	| { type: "Field"; df: DocField };

/* ------------------------------------------------------------------ *
 * 4. BaseList
 * ------------------------------------------------------------------ */

/**
 * `frappe.views.BaseList` — `base_list.js:4`.
 *
 * A class EXPRESSION assigned onto a `frappe.provide("frappe.views")` namespace,
 * so at runtime the only handle is `frappe.views.BaseList`.
 */
export declare class BaseList {
	/** `base_list.js:5-7` — `Object.assign(this, opts)`; nothing is validated. */
	constructor(opts: BaseListOptions);

	/* ---- identity ---- */
	doctype: string;
	/** `base_list.js:172-173` — `this.page = this.parent.page`. */
	parent: PageContainerElement;
	page: Page;
	/** `base_list.js:173` `this.$page = $(this.parent)`. */
	$page: JQuery<HTMLElement>;
	/** `base_list.js:40` `frappe.get_route_str()`. */
	page_name: string;
	/** `base_list.js:41`. */
	page_title: string;
	/** `base_list.js:42` `frappe.get_meta(this.doctype)`. */
	meta: DocTypeMeta;
	/** `base_list.js:45` — `frappe.listview_settings[doctype] || {}`. */
	settings: ListViewSettings;
	/** `base_list.js:46`. */
	user_settings: Record<string, ListViewUserSettings>;
	/** `base_list.js:76-78` — resolved from the server; `{}` when unset. */
	list_view_settings?: ListViewDBSettings;
	/**
	 * `"List"` / `"Report"` / … — the `view` sent in `get_args()`.
	 * Set by the subclass (`list_view.js:91`, `report_view.js:23`), never by BaseList.
	 */
	view?: FrappeViewName;

	/* ---- query state ---- */
	/** `base_list.js:48` `this.start = 0`; advanced by "Load More" (`base_list.js:436`). */
	start: number;
	/** `base_list.js:49` — `frappe.is_large_screen() ? 100 : 20`. */
	page_length: number;
	/** `base_list.js:50`. */
	selected_page_count: number;
	/** `base_list.js:51` `this.data = []`; replaced wholesale in `prepare_data`. */
	data: FrappeListDoc[];
	/** `base_list.js:52` — `"frappe.desk.reportview.get"`. */
	method: string;
	/**
	 * `[fieldname, doctype]` pairs. `base_list.js:57` `this.fields = []`, normalised
	 * by `build_fields()` (`base_list.js:102-113`) which turns bare strings into pairs.
	 */
	fields: [fieldname: string, doctype: string][];
	/**
	 * `base_list.js:58` `this.filters = []`.
	 *
	 * DECLARED AS A UNION because `QueryReport` reuses the same slot for a
	 * completely different thing: `query_report.js:537-578` fills it with the
	 * built filter *controls* (`page.add_field(df, …)` merged with their
	 * DocField via `Object.assign(f, df)`), not with filter tuples. `ListView`
	 * narrows it back to `ListFilterTuple[]`; see the notes file.
	 */
	filters: ListFilterTuple[] | QueryReportFilterControl[];
	sort_by: string;
	sort_order: string;
	/** `base_list.js:143-149` — `["_user_tags", …workflow_state_fieldname]`. */
	stats?: string[];
	workflow_state_fieldname?: string | null;
	can_create: boolean;
	can_write: boolean;
	/** `base_list.js:561` — `JSON.stringify` of the last call args, or null. */
	last_args?: string | null;

	/* ---- DOM handles (created in setup_main_section) ---- */
	/** `base_list.js:297` `$('<div class="frappe-list">')`. */
	$frappe_list: JQuery<HTMLElement>;
	/**
	 * `base_list.js:342` `$('<div class="result">')`.
	 *
	 * A {@link JQueryRegion} (gaps.md §6.12): built from a literal template, so
	 * `$result[0]` / `$result.get(0)` are elements without a `!`. The
	 * `$result.find(...)` handles below stay plain `JQuery` — those really can
	 * miss, which is why `list_view.js` guards them with the
	 * `x = x || this.$result.find(...)` idiom.
	 */
	$result: JQueryRegion;
	/** `base_list.js:352-357` — hidden `.no-result`. */
	$no_result: JQuery<HTMLElement>;
	/** `base_list.js:362` — hidden `.freeze`. */
	$freeze: JQuery<HTMLElement>;
	/** `base_list.js:394` `.list-paging-area.level`. */
	$paging_area: JQuery<HTMLElement>;
	/** `base_list.js:304` — created by `FilterArea`'s constructor (`base_list.js:650`). */
	$filter_section?: JQuery<HTMLElement>;

	/* ---- collaborators ---- */
	/** `base_list.js:302`. `FilterArea` is a MODULE-LOCAL class (`base_list.js:642`), not exported. */
	filter_area?: FilterArea;
	/** `base_list.js:317-325` — `new frappe.ui.SortSelector({...})`. */
	sort_selector?: SortSelector;
	/** `base_list.js:224-231`. */
	views_list?: unknown;
	views_menu?: JQuery<HTMLElement>;

	/* ---- menu / actions ---- */
	primary_action: unknown;
	secondary_action: { label?: string; action?: () => void; icon?: string } | null;
	menu_items: ListViewMenuItem[];
	refresh_button?: JQuery<HTMLElement>;
	/** `base_list.js:20-37` — memoised init chain. */
	init_promise?: Promise<unknown>;

	/* ---- lifecycle ---- */
	/**
	 * `base_list.js:9-19`.
	 *
	 * DECLARED `void | Promise<unknown>` because `ListView.show()`
	 * (`list_view.js:45-48`) calls `super.show()` but does NOT return it, and
	 * `QueryReport.show()` (`query_report.js:31-33`) returns undefined too.
	 * BaseList's own implementation returns the `frappe.run_serially` promise.
	 */
	show(): void | Promise<unknown>;
	/** `base_list.js:21-37` — memoised via `init_promise`. */
	init(): Promise<unknown>;
	/**
	 * `base_list.js:39-70`.
	 *
	 * `void | Promise<unknown>` because subclasses widen it: `list_view.js:89-116`
	 * returns `this.get_list_view_settings().then(...)`, `report_view.js:18-57`
	 * returns either a Promise or `undefined` depending on `this.report_name`.
	 */
	setup_defaults(): void | Promise<unknown>;
	/** `base_list.js:72-79` — resolves `list_view_settings`. */
	get_list_view_settings(): Promise<ListViewDBSettings>;
	/** `base_list.js:81-84`. */
	setup_fields(): Promise<void>;
	/**
	 * `base_list.js:86-90` (async), `list_view.js:213-262` (async),
	 * `report_view.js:865-881` (**synchronous**).
	 * The union is the price of that inconsistency; see the notes file.
	 */
	set_fields(): void | Promise<void>;
	/** `base_list.js:92-102` — the `in_list_view` / Currency / `status` docfields. */
	get_fields_in_list_view(): DocField[];
	/** `base_list.js:104-113` — normalises `fields` to `[fieldname, doctype]` and de-dupes. */
	build_fields(): void;
	/** `base_list.js:115-140`. Accepts a fieldname OR a whole DocField. */
	_add_field(fieldname: string | DocField | null | undefined, doctype?: string): void;
	/** `base_list.js:142-152`. */
	set_stats(): void;
	/** `base_list.js:154-156` — `frappe.model.with_doctype(this.doctype)`. */
	fetch_meta(): Promise<unknown>;
	/** `base_list.js:158` / `:160` — no-ops on BaseList, overridden by ListView. */
	show_skeleton(): void;
	hide_skeleton(): void;
	/** `base_list.js:162-164` — returns `true`; ListView throws instead (`list_view.js:50-55`). */
	check_permissions(): boolean | void;
	setup_page(): void;
	setup_page_head(): void;
	set_title(): void;
	setup_view_menu(): void;
	set_default_secondary_action(): void;
	set_menu_items(): void;
	set_breadcrumbs(): void;
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
	/** `base_list.js:497-518` — no-ops unless `this.view === "List"`. */
	set_result_height(): void;
	/** `base_list.js:520-523` — `[fieldname, doctype]` → `` `tabDoctype`.`fieldname` ``. */
	get_fields(): string[];
	get_group_by(): string | null;
	/** `base_list.js:533` — extension point, empty on BaseList. */
	setup_view(): void;
	get_filter_value(fieldname: string): unknown;
	/** `base_list.js:635-637` — always sliced to 4 elements. */
	get_filters_for_args(): ListFilterTuple[];
	get_args(): ListViewArgs;
	get_call_args(): {
		method: string;
		args: ListViewArgs;
		freeze: boolean;
		freeze_message: string;
	};
	/** `base_list.js:527` — hook, empty on BaseList. */
	before_refresh(): Promise<unknown> | void;
	/**
	 * `base_list.js:534-558`.
	 *
	 * `| undefined` IS LOAD-BEARING: `list_view.js:265-267` and
	 * `query_report.js:58` both rebind the instance property to
	 * `frappe.utils.throttle(this.refresh, …)`, and frappe's throttle
	 * (`utils/utils.js:860-890`, underscore-style) returns the *last* result —
	 * `undefined` until the leading call lands. Never chain `.then()` off
	 * `someView.refresh()`; use `BaseList.prototype.refresh.call(view)` if you
	 * need the promise.
	 */
	refresh(): Promise<void> | undefined;
	/** `base_list.js:560-571` — 3-second arg-identity throttle. */
	no_change(args: ListViewArgs): boolean;
	/**
	 * `base_list.js:573-587`.
	 *
	 * Parameter is `unknown`, NOT the response envelope, because
	 * `QueryReport.prepare_data` (`query_report.js:1450-1462`) overrides it with
	 * an incompatible parameter — an already-unwrapped result array. Widening
	 * the base parameter is the only way both overrides type-check; see notes.
	 */
	prepare_data(r: unknown): void;
	reset_defaults(): void;
	/**
	 * `base_list.js:594` — declared with NO parameters but CALLED as
	 * `this.freeze(true)` / `this.freeze(false)` (`base_list.js:539`, `:553`).
	 * Both implementations ignore the argument.
	 */
	freeze(state?: boolean): void;
	before_render(): void;
	after_render(): void;
	/** `base_list.js:600` — extension point, empty on BaseList. */
	render(...args: unknown[]): void;
	on_filter_change(): void;
	toggle_result_area(): void;
	call_for_selected_items(method: string, args?: Record<string, unknown>): void;
	setup_list_filter_by(): void;
}
/** Augmentation seam — see {@link ListView}. */
export interface BaseList {}

/** One entry of `this.menu_items` — `base_list.js:62-68`, consumed at `base_list.js:257-274`. */
export interface ListViewMenuItem {
	label: string;
	action: () => void;
	standard?: boolean;
	shortcut?: string;
	/** Added to the rendered `<a>`, e.g. `"visible-xs"`. `base_list.js:271-273`. */
	class?: string;
	condition?: () => boolean;
	/** `list_view.js:176-179` — workflow actions are looked up by this. */
	name?: string;
	is_workflow_action?: boolean;
}

/** The server call payload — `base_list.js:604-621`, extended at `list_view.js:582-592`. */
export interface ListViewArgs {
	doctype: string;
	fields: string[];
	filters: ListFilterTuple[];
	order_by?: string;
	start: number;
	page_length: number;
	view?: FrappeViewName;
	group_by?: string | null;
	/** ListView only — `list_view.js:585-589`, `0 | 1`. */
	with_comment_count?: 0 | 1;
	[extra: string]: unknown;
}

/**
 * `base_list.js:642` — `class FilterArea`, **module-local**: not exported and
 * not on `frappe`. Only the members frappe itself reaches from a view are
 * declared; add more here as consumers need them.
 */
export interface FilterArea {
	/** `base_list.js:657`. */
	$filter_list_wrapper: JQuery<HTMLElement>;
	/** `base_list.js:723-728` — current filters, de-duplicated. */
	get(): ListFilterTuple[];
	/** `base_list.js:730-737` — sets without triggering a refresh. */
	set(filters: ListFilterTuple[]): Promise<unknown>;
	/** `base_list.js:739-762`; also accepts the 4 loose args form (`base_list.js:745-748`). */
	add(filters: ListFilterTuple[] | string, ...rest: unknown[]): Promise<unknown>;
	remove(fieldname: string): Promise<unknown> | void;
	clear(refresh?: boolean): Promise<unknown>;
	exists(f: ListFilterTuple): boolean;
	/** `base_list.js:637`, `list_view.js:643` — the `_liked_by` lookup lives here. */
	filter_list: {
		get_filters(): ListFilterTuple[];
		get_filter_value(fieldname: string): unknown;
		filter_exists(f: ListFilterTuple): boolean;
		add_filters(filters: ListFilterTuple[]): Promise<unknown>;
		update_filter_button(): void;
	};
}

/** `frappe.ui.SortSelector` — minimal, only the members the views read. */
export interface SortSelector {
	sort_by: string;
	sort_order: string;
	/** `base_list.js:614`, `report_view.js:227`. */
	get_sql_string(): string;
}

/* ------------------------------------------------------------------ *
 * 5. ListView
 * ------------------------------------------------------------------ */

/**
 * `frappe.views.ListView` — `list_view.js:6`
 * (`frappe.views.ListView = class ListView extends frappe.views.BaseList { … }`).
 *
 * ### Generic parameter
 * `TColumn` exists ONLY so `ReportView` can narrow `columns` to
 * `DataTableColumn[]`. `ReportView.setup_columns()` (`report_view.js:1164-1196`)
 * fully replaces `ListView.setup_columns()` (`list_view.js:411-496`) and emits a
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
	 * `list_view.js:7-22`. Called by `list_factory.js:22` BEFORE construction:
	 * returning `true` means "I re-routed, don't build me".
	 */
	static load_last_view(): boolean;

	/** `list_view.js:24-39` — note it calls `this.show()` from inside the constructor (`:26`). */
	constructor(opts: BaseListOptions);

	/**
	 * `list_view.js:81-83` — a GETTER returning `"List"`.
	 *
	 * Typed as the full union, not the literal `"List"`, so `ReportView`'s
	 * `"Report"` (`report_view.js:10-12`) remains an assignable override.
	 */
	readonly view_name: FrappeViewName;
	/** `list_view.js:85-87` — `this.user_settings[this.view_name] || {}`. */
	readonly view_user_settings: ListViewUserSettings;

	/** `list_view.js:28` — `frappe.get_meta(doctype)?.is_large_table`. */
	is_large_table?: 0 | 1;
	/** `list_view.js:31-34` — `process_document_refreshes`, debounced 15s / 2s. */
	debounced_refresh: () => void;
	/** `list_view.js:35` — `1001`; zeroed by the count tooltip click (`list_view.js:738`). */
	count_upper_bound: number;
	/**
	 * `list_view.js:36` `this.column_max_widths = {}`; the ONLY thing that ever
	 * fills it is the side effect at the tail of `get_column_html`
	 * (`list_view.js:1055-1069`, `textLength * 10 / 1.3 + (Subject ? 30 : 0)`),
	 * so it is empty until a render pass has run. Consumed by
	 * `apply_column_widths` (`:1083-1092`).
	 *
	 * STRICT HAZARD at the call site, not here: indexing it with the natural
	 * `column_max_widths[col.df && col.df.fieldname]` is TS2538 — the index
	 * expression is `string | undefined`. Use `col.df?.fieldname ?? ""` (or a
	 * guard) rather than reaching for an assertion.
	 */
	column_max_widths: Record<string, number>;
	/** `list_view.js:37` — `3`. */
	max_number_of_avatars: number;
	/** `list_view.js:38` — `50`; the real column cap (`:474`). */
	max_number_of_fields: number;
	/** `list_view.js:34` — the pre-built `<input>/<a>/<span>` templates. Module-local class, `list_view.js:2701`. */
	_element_factory: ListViewElementFactory;

	/** Column model. See the class-level note on `TColumn`. */
	columns: TColumn[];
	/** `list_view.js:103`, `:107-112`, `:126` — always real filter tuples here. */
	filters: ListFilterTuple[];
	/** `list_view.js:214` — `{ [fieldname]: title_fieldname_of_linked_doctype }`. */
	link_field_title_fields: Record<string, string>;
	/** `list_view.js:372` / `:1746` — a Check field, so `0 | 1`, and UNSET until `refresh_columns`/`setup_tag_visibility` runs. */
	tags_shown?: 0 | 1;
	/** `list_view.js:164`. */
	actions_menu_items?: ListViewMenuItem[];
	workflow_action_menu_items?: ListViewMenuItem[];
	workflow_action_items?: Record<string, JQuery<HTMLElement>>;
	/** `list_view.js:722-724` — the server-side count; `null` when the estimate is unavailable. */
	total_count?: number | null;
	count_without_children?: number;
	/** `list_view.js:1783`. */
	pending_document_refreshes?: unknown[];
	realtime_events_setup?: boolean;
	/** `list_view.js:2124` — set by BulkOperations to suppress realtime churn. */
	disable_list_update?: boolean;
	/** `list_view.js:57-74`. */
	$list_skeleton?: JQuery<HTMLElement>;
	/** `list_view.js:184-190`. */
	restricted_list?: JQuery<HTMLElement>;
	/** `list_view.js:268-274` — resolves once `required_libs` are loaded. */
	load_lib?: Promise<void>;
	required_libs?: string | string[];

	/* ---- lazily-resolved check handles ---- *
	 * All three are created inside `on_row_checked` (`list_view.js:1890-1895`)
	 * with the `x = x || this.$result.find(...)` idiom — they are UNDEFINED
	 * until the first checkbox interaction, and their undefined-ness is
	 * load-bearing: `update_checkbox` (`list_view.js:391`) uses
	 * `if (!this.$checkbox_actions) return` as its guard for `$checks` not
	 * existing yet. Pre-assigning `$checkbox_actions` turns the first click into
	 * a TypeError on `this.$checks.length`. Declare them OPTIONAL. */

	/** `list_view.js:1890-1891` — `$result.find("header .list-header-subject")`. */
	$list_head_subject?: JQuery<HTMLElement>;
	/** `list_view.js:1892-1893` — `$result.find("header .checkbox-actions")`. */
	$checkbox_actions?: JQuery<HTMLElement>;
	/** `list_view.js:1895` — `$result.find(".list-row-checkbox:checked")`. */
	$checks?: JQuery<HTMLInputElement>;
	/** `list_view.js:1682`, `:1697` — the shift-select anchor. */
	$checkbox_cursor?: JQuery<HTMLInputElement>;

	/* ---- methods ---- */
	has_permissions(): boolean;
	/** `list_view.js:45-48` — sets `parent.disable_scroll_to_top` then `super.show()`; returns undefined. */
	show(): void;
	/** `list_view.js:50-55` — routes away and throws instead of returning false. */
	check_permissions(): void;
	validate_filters(filters: ListFilterTuple[]): ListFilterTuple[];
	set_actions_menu_items(): void;
	show_restricted_list_indicator_if_applicable(): void;
	show_restrictions(match_rules_list?: unknown[]): void;
	/** `list_view.js:264-283` — REBINDS `this.refresh` to a 1s throttle and starts a 5-minute poll. */
	patch_refresh_and_load_lib(): void;
	set_primary_action(): void;
	make_new_doc(): void;
	/** `list_view.js:370-377` — called by `ListSettings`' save callback (`list_settings.js:56`). */
	refresh_columns(meta: DocTypeMeta, list_view_settings: ListViewDBSettings): void;
	/** See {@link BaseList.refresh} for why this can be `undefined`. */
	refresh(refresh_header?: boolean): Promise<void> | undefined;
	/** `list_view.js:390-399`. Called with no args from `on_row_checked` (`:1910`). */
	update_checkbox(target?: JQuery<HTMLInputElement>): void;
	/** `list_view.js:411-496`. */
	setup_columns(): void;
	reorder_listview_fields(): TColumn[];
	get_documentation_link(): string;
	/**
	 * `list_view.js:625-633` — DEFINED HERE, not on ReportView, even though
	 * ReportView's datatable `onCheckRow` handler is its busiest caller
	 * (`report_view.js:359-362`). A `ReportView` declaration without a `ListView`
	 * base loses it.
	 */
	toggle_actions_menu_button(toggle: boolean): void;
	/** `list_view.js:635-648`. Note the DEFAULT PARAMETER — callers may pass nothing. */
	render_header(refresh_header?: boolean): void;
	render_skeleton(): void;
	/** `list_view.js:677-711`. Called from `render()` (`:673`) and `process_document_refreshes` (`:1852`). */
	render_list(): void;
	render_count(): void;
	/** `list_view.js:748` — `this.$result?.find(".list-count")`, so possibly undefined. */
	get_count_element(): JQuery<HTMLElement> | undefined;
	/** `list_view.js:752-815` — returns `undefined` early if `this.columns` is unset (`:753-755`). */
	get_header_html(): string | undefined;
	get_header_html_skeleton(left?: string, right?: string): string;
	get_left_html(doc: FrappeListDoc): string;
	get_right_html(doc: FrappeListDoc): string;
	get_list_row_html(doc: FrappeListDoc): string;
	get_list_row_html_skeleton(left?: string, right?: string): string;
	/**
	 * `list_view.js:908-1077` — the per-cell renderer, returning a
	 * `<div class="list-row-col …">…</div>` string.
	 *
	 * SIDE EFFECT: it also accumulates `this.column_max_widths[fieldname]`
	 * (`list_view.js:1055-1069`, `textLength * 10 / 1.3 + (Subject ? 30 : 0)`),
	 * which is the only way that map is ever populated.
	 *
	 * `show_in_mobile` is NOT optional in the source (3 declared params) but
	 * every internal caller passes it explicitly (`:868`, `:872`).
	 */
	get_column_html(col: ListColumn, doc: FrappeListDoc, show_in_mobile: boolean): string;
	/** `list_view.js:1083-1092`. Guarded by `list_view_settings?.disable_scrolling`. */
	apply_column_widths(): void;
	/**
	 * `list_view.js:1095-1121`.
	 *
	 * Adds `has-assign-to` / `assign-to-length-N` / `no-assign-to` to `$result`,
	 * may add `disable-scrolling` to `parent.page.main.parent()`, and MEASURES
	 * `.list-row-container .list-row` plus its `.level-left` / `.level-right`
	 * widths — a DOM contract any replacement renderer must still satisfy.
	 */
	update_listview_classes(has_assignto: boolean, assign_to_count: number): void;
	/** `list_view.js:1122-1141` — `limit === null` means "no limit". */
	get_tags_html(user_tags: string | null | undefined, limit?: number | null, colored?: boolean): string;
	/** `list_view.js:1143-1187` — the right-hand meta rail (avatars, comment count, like, modified). */
	get_meta_html(doc: FrappeListDoc): string;
	/** `list_view.js:1189-1207` — `""` unless `settings.button` is set. */
	generate_button_html(doc: FrappeListDoc): string;
	/** `list_view.js:1209-1243` — `""` unless `settings.dropdown_button` is set. */
	generate_dropdown_html(doc: FrappeListDoc): string;
	apply_styles_basedon_dropdown(): void;
	get_count_str(): Promise<string>;
	get_form_link(doc: FrappeListDoc): string;
	get_seen_class(doc: FrappeListDoc): "" | "bold";
	get_like_html(doc: FrappeListDoc): string;
	/** `list_view.js:1323-1344` — returns a detached `<div>`; callers read `.innerHTML`. */
	get_subject_element(doc: FrappeListDoc, title: string): HTMLDivElement;
	get_subject_text(doc: FrappeListDoc, title: string): string;
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
	setup_like(): void;
	setup_new_doc_event(): void;
	/** `list_view.js:1745-1747`. */
	setup_tag_visibility(): void;
	setup_realtime_updates(): void;
	disable_realtime_updates(): void;
	process_document_refreshes(): void;
	avoid_realtime_update(): boolean;
	remove_list_items(names: string[]): void;
	set_rows_as_checked(): void;
	/** `list_view.js:1890-1912` — resolves `$list_head_subject` / `$checkbox_actions` lazily. */
	on_row_checked(): void;
	/**
	 * `list_view.js:1914-1922` — reads `data-name` off `.list-row-checkbox:checked`,
	 * i.e. it is DOM-driven, not model-driven.
	 */
	get_checked_items(only_docnames: true): string[];
	get_checked_items(only_docnames?: false | 0 | null | undefined): FrappeListDoc[];
	get_checked_items(only_docnames?: boolean): string[] | FrappeListDoc[];
	clear_checked_items(): void;
	save_view_user_settings(obj: Partial<ListViewUserSettings>): Promise<unknown>;
	/** `list_view.js:1933` — empty hook; ReportView overrides it (`report_view.js:276`). */
	on_update(...args: unknown[]): void;
	update_url_with_filters(): void;
	get_url_with_filters(): string;
	get_search_params(): URLSearchParams;
	get_menu_items(): ListViewMenuItem[];
	make_group_by_fields_modal(): void;
	get_group_by_dropdown_fields(): unknown[];
	get_view_settings(): ListViewMenuItem;
	/** `list_view.js:2136-2145` — opens the {@link ListSettings} dialog. */
	show_list_settings(): void;
	get_workflow_action_menu_items(): ListViewMenuItem[];
	toggle_workflow_actions(): void;
	get_actions_menu_items(): ListViewMenuItem[];
	parse_filters_from_route_options(): ListFilterTuple[];
	parse_filters_from_settings(): ListFilterTuple[];
	/** `list_view.js:2130` — BulkOperations instance, created lazily in the actions menu. */
	bulk_operations?: unknown;
}
/**
 * Declaration-merging seam. Keep it empty here; consumers add members via
 * module augmentation (see the class doc). `carbon_frappe` uses it for
 * `carbon_table?: CarbonTable` (`tables/list/list_view.js:229`).
 */
export interface ListView<TColumn = ListColumn> {}

/**
 * `list_view.js:2701-2775` — `class ElementFactory`, module-local (NOT exported,
 * NOT on `frappe`). Reachable only as `listView._element_factory`.
 */
export interface ListViewElementFactory {
	templates: {
		checkbox: HTMLInputElement;
		checkboxspan: HTMLSpanElement;
		link: HTMLAnchorElement;
		like: HTMLSpanElement;
	};
	/** `list_view.js:2744-2748` — clone with `data-name`; the `.list-row-checkbox[data-name]` contract. */
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

/** `report_view.js:33-52` — `report_doc.json`, the saved Report's settings blob. */
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

/** `report_view.js:610-625` / `:637-669`. */
export interface ReportChartArgs {
	x_axis: string;
	y_axes: string[];
	chart_type: string;
	labels?: unknown[];
	datasets?: unknown[];
}

/**
 * What `ReportView.get_editing_object` returns — `report_view.js:708-757`.
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
 * `report_view.js:343` and that carbon_frappe repeats at
 * `tables/datatable/install.js:41`:
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
 * `control.get_value()` (`report_view.js:754-756`), which `ui/form.d.ts:513`
 * types `unknown` because a control CAN return a non-scalar (ControlTable
 * returns `ChildDoc[]`). But this particular value is consumed only as a
 * datatable CELL CONTENT — `cellmanager.js:560`
 * `this.updateCell(colIndex, rowIndex, value, true)` — and
 * `DataTableCell#content` is `DataTableCellValue` (datatable.d.ts:216, :317).
 * A non-scalar here is not a value this type should permit; it is a bug.
 * Report View never produces one: its columns are list-view fields, and
 * `is_editable` (`report_view.js:837-857`) additionally rejects `read_only`,
 * `is_virtual`, `hidden` and standard fields.
 */
export interface ReportViewCellEditor extends DataTableEditor {
	/**
	 * `report_view.js:709-711` — `control.set_value(value)`, whose promise is
	 * returned (and which `cellmanager.js:474` ignores).
	 */
	initValue(
		value: unknown,
		rowIndex?: DataTableRowIndex,
		column?: DataTableColumn
	): void | Promise<unknown>;
	/**
	 * `report_view.js:712-753` — persists via `frappe.db.set_value`, then
	 * refreshes the charts.
	 *
	 * REQUIRED, not optional as this declaration previously had it: the object
	 * literal at `report_view.js:708-757` has an unconditional `setValue` key,
	 * and `cellmanager.js:556` calls it unguarded.
	 */
	setValue(
		value: unknown,
		rowIndex?: DataTableRowIndex,
		column?: DataTableColumn
	): void | Promise<unknown>;
	/** `report_view.js:754-756` — `control.get_value()`. See the note above. */
	getValue(): DataTableCellValue | Promise<DataTableCellValue>;
}

/**
 * `frappe.views.ReportView` — `report_view.js:9`
 * (`class ReportView extends frappe.views.ListView`).
 *
 * It is `ListView<DataTableColumn>`: `setup_columns()` (`report_view.js:1164`)
 * replaces the ListColumn model with datatable columns built by `build_column`
 * (`report_view.js:1198-1317`).
 *
 * `carbon_frappe` never constructs or subclasses it — it replaces
 * `ReportView.prototype.setup_datatable` outright, because `report_view.js:339`
 * calls a MODULE-LOCAL `new DataTable(...)` that no global can reach.
 */
export declare class ReportView extends ListView<DataTableColumn> {
	/** `report_view.js:10-12` — a getter returning `"Report"`. */
	readonly view_name: "Report";

	/**
	 * `report_view.js:86` `$('<div class="datatable-wrapper">')`.
	 *
	 * A {@link JQueryRegion} (gaps.md §6.12) — a literal template, so the mount
	 * point `this.$datatable_wrapper[0]` that every replacement `setup_datatable`
	 * passes to a DataTable constructor needs no `!` and no guard.
	 */
	$datatable_wrapper: JQueryRegion;
	/** `report_view.js:91-95`. */
	$charts_wrapper: JQuery<HTMLElement>;

	/**
	 * `report_view.js:339`.
	 *
	 * NULLABLE and initially UNSET: never assigned in a constructor, read
	 * defensively at `report_view.js:260` (`if (this.datatable && !force)`) and
	 * explicitly cleared at `report_view.js:981-982`
	 * (`this.datatable.destroy(); this.datatable = null;`).
	 */
	datatable?: DataTable | null;
	/** `report_view.js:1174`, `:1194` — `column.id` → column. */
	columns_map: Record<string, DataTableColumn>;
	/** `report_view.js:24`, `:1305-1309` — `{ [cell content]: link doctype }`. */
	link_title_doctype_fields: Record<string, string>;
	/** `report_view.js:29`, from `frappe.get_route()[3]` — set only for saved reports. */
	report_name?: string;
	/** `report_view.js:34-35` — the `Report` doc, with `json` already parsed. */
	report_doc?: { json: ReportViewJSON; [field: string]: unknown };
	order_by?: string;
	add_totals_row?: 0 | 1;
	group_by?: string | null;
	/** `report_view.js:113` — `new frappe.ui.GroupBy(this)`. */
	group_by_control?: {
		set_args(args: ListViewArgs): void;
		get_settings(): unknown;
		apply_settings(settings: unknown): void;
		get_group_by_docfield(): DocField;
	};
	/** `report_view.js:650` — `new frappe.Chart(...)`; nulled at `report_view.js:691`. */
	chart?: FrappeBaseChart | null;
	chart_args?: ReportChartArgs | null;
	last_chart_type?: string;
	/** `report_view.js:769` — the docname of the last inline edit. */
	last_updated_doc?: string;

	/** `report_view.js:14-16` — deliberately EMPTY: ReportView has no list header. */
	render_header(): void;
	setup_charts_area(): void;
	set_link_title_field_value(): void;
	get_link_title_field_value(doctype: string, value: string): Promise<string | undefined>;
	set_dirty_state_for_custom_report(): void;
	save_report_settings(): void;
	/** `report_view.js:248-265` — `force` bypasses the `datatable.refresh()` fast path. */
	render(force?: boolean): void;
	/** `report_view.js:266-274` — always returns a jQuery (creates the span if missing). */
	get_count_element(): JQuery<HTMLElement>;
	/** `report_view.js:276-290` — realtime `list_update` payload. */
	on_update(data: { doctype: string; name: string; user?: string }): void;
	update_row(doc: FrappeListDoc, flash_row: boolean): void;
	/**
	 * `report_view.js:338-441` — THE prototype-patch target.
	 *
	 * `values` is `this.data` at the only internal call site
	 * (`report_view.js:263` `this.setup_datatable(this.data)`), and is passed
	 * straight to `this.get_data(values)`.
	 *
	 * When patching, annotate `this` explicitly:
	 * `function (this: ReportView, values: FrappeListDoc[]) { … }`.
	 */
	setup_datatable(values: FrappeListDoc[]): void;
	setup_inline_filter_observer(): void;
	setup_inline_filter_help_icons(): void;
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
	 * `report_view.js:697-758` — the datatable's `getEditor`.
	 *
	 * DECLARED with 4 parameters (matching the source) but INVOKED with SEVEN by
	 * frappe-datatable's cellmanager (`colIndex, rowIndex, value, parent, column,
	 * row, data`). The extra three are declared optional so a replacement editor
	 * can read them without breaking assignability to frappe's own 4-arg method.
	 *
	 * Returns literal `false` when no control could be made (`report_view.js:699`).
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
	/** `report_view.js:777-808` — returns a `frappe.ui.form` control, or null. */
	render_editing_input(colIndex: number, value: unknown, parent: HTMLElement): unknown;
	evaluate_read_only_depends_on(expression: string | boolean, data: FrappeListDoc): boolean | null;
	is_editable(df: DocField, data: FrappeListDoc): boolean;
	/** `report_view.js:861-863` — `return this.build_rows(values)`. */
	get_data(values: FrappeListDoc[]): DataTableCell[][];
	/** `report_view.js:865-881` — SYNCHRONOUS, unlike the async base/ListView versions. */
	set_fields(): void;
	set_default_fields(): void;
	reorder_fields(): void;
	get_unique_cdt_in_view(): string[];
	add_column_to_datatable(fieldname: string, doctype: string, col_index?: number): void;
	add_currency_column(fieldname: string, doctype: string, col_index?: number): void;
	add_status_dependency_column(col: string | undefined, doctype: string): void;
	/** `report_view.js:1022-1036` — reads only `column.field`. */
	remove_column_from_datatable(column: DataTableColumn): void;
	/** `report_view.js:1038-1051` — reads only `col1.field` / `col2.field`. */
	switch_column(col1: DataTableColumn, col2: DataTableColumn): void;
	get_columns_for_picker(): Record<string, DocField[]>;
	get_dialog_fields(): unknown[];
	is_column_added(df: DocField): boolean;
	/** `report_view.js:1198-1317` — returns `undefined` for hidden/unknown fields (`:1237`). */
	build_column(c: [fieldname: string, doctype: string]): DataTableColumn | undefined;
	/** `report_view.js:1319-1348` — appends a totals row when `add_totals_row`. */
	build_rows(data: FrappeListDoc[]): DataTableCell[][];
	format_total_cell(formatted_value: string, df: DataTableColumn): string;
	build_row(d: FrappeListDoc): DataTableCell[];
	/**
	 * `report_view.js:1414-1423` — MODEL-driven, unlike ListView's DOM-driven
	 * version: `this.datatable.rowmanager.getCheckedRows()` indexes into
	 * `this.data`.
	 */
	get_checked_items(only_docnames: true): string[];
	get_checked_items(only_docnames?: false | 0 | null | undefined): FrappeListDoc[];
	get_checked_items(only_docnames?: boolean): string[] | FrappeListDoc[];
	/** `report_view.js:1425-1427` — `this.datatable.rowmanager.checkAll(false)`. */
	clear_checked_items(): void;
	save_report(save_type?: string): void;
	delete_report(): void;
	/** `report_view.js:1499-1508` — `{}` when there is no datatable yet. */
	get_column_widths(): Record<string, number>;
	get_report_doc(): Promise<Record<string, unknown>>;
	get_filters_html_for_print(): string;
	get_columns_totals(data: FrappeListDoc[]): Record<string, unknown>;
	report_menu_items(): ListViewMenuItem[];
}
/** Augmentation seam — see {@link ListView}. */
export interface ReportView {}

/* ------------------------------------------------------------------ *
 * 7. QueryReport  (frappe.query_report / frappe.query_reports)
 * ------------------------------------------------------------------ */

/**
 * A prepared Query Report column — `report_utils.js:93-119`
 * (`prepare_field_from_column`) then `query_report.js:1422-1444`.
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
	/** `query_report.js:1108-1109` — set by report scripts; filtered out of the render. */
	hidden?: boolean;
}

/** `query_report.js:1074-1081` — the raw `frappe.desk.query_report.run` payload. */
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
 * `query_report.js:10` `frappe.provide("frappe.query_reports")`;
 * `query_report.js:425-427` reads it, `:447` writes it back after eval'ing the
 * fetched script. Every member is optional: `get_local_report_settings`
 * (`query_report.js:456-464`) falls back to `{}`.
 */
export interface QueryReportSettings {
	/** `query_report.js:443-445` — filter definitions (DocField-like). */
	filters?: DocField[];
	/** `query_report.js:408` — fired once, after the first load. */
	onload?(report: QueryReport): void;
	/** `query_report.js:880` — `this.report_settings.after_refresh?.(this)`. */
	after_refresh?(report: QueryReport): void;
	/**
	 * Per-cell renderer. `query_report.js:1434-1441`.
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
	 * `query_report.js:1131-1132` — called with the assembled options and must
	 * RETURN them (the return value replaces the object).
	 *
	 * Called on CONSTRUCTION ONLY: `render_datatable` takes the
	 * `datatable.refresh(data, columns)` reuse path (`:1113-1116`) whenever the
	 * existing datatable's `showTotalRow` still matches. It is ALSO called
	 * speculatively with `{}` from `prepare_columns` (`query_report.js:1390-1393`)
	 * purely to discover whether `checkboxColumn` is on — so it must tolerate an
	 * empty object.
	 */
	get_datatable_options?(options: Partial<DataTableOptions>): DataTableOptions;
	/** `query_report.js:1140-1142` — receives the live datatable, typically to poke styles. */
	after_datatable_render?(datatable: DataTable): void;
	/** `query_report.js:1137-1139` — only applied when `typeof … == "number"`. */
	initial_depth?: number;
	/** `query_report.js:748`, `:1101`, `:1124` — tree-mode switch. */
	tree?: boolean;
	/** `query_report.js:749`. */
	parent_field?: string;
	/** `query_report.js:1178-1180`. */
	get_chart_data?(columns: QueryReportColumn[], result: unknown[]): unknown;
	/** `query_report.js:536`, `:580`. */
	separate_check_filters?: boolean;
	/** `query_report.js:581`. */
	collapsible_filters?: boolean;
	/** `query_report.js:1765`. */
	export_hidden_cols?: boolean;
	/** `query_report.js:1665-1667` — async, may rewrite the print format. */
	get_pdf_format?(report: QueryReport, custom_format: string | null): Promise<string | null>;
	/** Injected by frappe itself at `query_report.js:439-440`, not by the report script. */
	html_format?: string | null;
	execution_time?: number;
	[extra: string]: unknown;
}

/**
 * One entry of `QueryReport#filters` — `query_report.js:537-578`.
 *
 * It is a `frappe.ui.form` control returned by `page.add_field(df, area)` onto
 * which the filter's own DocField has been merged
 * (`query_report.js:576` `f = Object.assign(f, df)`), so it carries BOTH the
 * control API and every DocField key at the top level, plus `df` pointing at
 * the control's own docfield.
 */
export interface QueryReportFilterControl {
	/** The control's docfield — `query_report.js:1510` `f.df.fieldname === fieldname`. */
	df: DocField;
	/** Merged in from the filter definition — `query_report.js:713-717`. */
	default?: unknown;
	value?: unknown;
	fieldname?: string;
	fieldtype?: string;
	get_value(): unknown;
	set_value(value: unknown): unknown;
	set_input(value: unknown): void;
	/** `query_report.js:551` — a Link-field query builder copied off the definition. */
	get_query?: unknown;
	/** `query_report.js:552`, `:568-570` — takes precedence over the auto-refresh. */
	on_change?(report: QueryReport): void;
	[extra: string]: unknown;
}

/**
 * `frappe.views.QueryReport` — `query_report.js:30`
 * (`class QueryReport extends frappe.views.BaseList`).
 *
 * NOTE it extends **BaseList**, not ListView: it has no `columns` of
 * {@link ListColumn} type, no `view_name`, and no row checkboxes of its own.
 *
 * The singleton lives at `frappe.query_report`, assigned once by the page
 * factory (`query_report.js:21-23`) — so it is `undefined` until the
 * `query-report` route has been visited.
 */
export declare class QueryReport extends BaseList {
	/** `query_report.js:31-33` — fire-and-forget; returns undefined. */
	show(): void;
	init(): Promise<unknown>;

	/** `query_report.js:52` — `frappe.get_route()`. */
	route: string[];
	report_name: string;
	/** `query_report.js:414-421` — the `Report` doc (NOT json-parsed, unlike ReportView's). */
	report_doc?: Record<string, unknown>;
	/** `query_report.js:425` / `:437-447` — `frappe.query_reports[report_name]`. */
	report_settings: QueryReportSettings;
	/** `query_report.js:1075` — the untouched server payload. */
	raw_data: QueryReportRawData;
	/** `query_report.js:1076` — prepared via `prepare_columns`. */
	columns: QueryReportColumn[];
	custom_columns: QueryReportColumn[];
	/** `query_report.js:1077` — array-rows normalised to objects keyed by `column.id`. */
	data: FrappeListDoc[];
	linked_doctypes?: unknown;
	/** `query_report.js:1080` — true when any row has an `indent`. */
	tree_report: boolean;
	/**
	 * `query_report.js:1134` `new window.DataTable(this.$report[0], datatable_options)`.
	 *
	 * WRITABLE and NULLABLE — never set in a constructor, guarded at `:1114`,
	 * and consumers legitimately null it to force a rebuild.
	 */
	datatable?: DataTable | null;
	/** `query_report.js:44-49` — `{ 1: __("Yes"), 0: __("No") }`. */
	boolean_labels: Record<0 | 1, string>;
	/** `query_report.js:57` — a throttled rebind of `refresh` (300 ms). */
	ignore_prepared_report: boolean;
	prepared_report_name?: string;
	prepared_report?: boolean;
	prepared_report_document?: Record<string, unknown>;
	snapshot_report?: unknown;
	snapshot_at?: string;
	refreshed_at?: string;
	execution_time?: number;
	/**
	 * `query_report.js:536-578` — the built filter CONTROLS, not tuples.
	 * `get_filter` (`query_report.js:1509-1515`) searches them by `f.df.fieldname`
	 * and `refresh` (`:713-717`) compares `filter.default === filter.value`.
	 */
	filters: QueryReportFilterControl[];
	last_ajax?: { abort(): void };
	interval?: ReturnType<typeof setInterval>;
	stale_report_interval?: ReturnType<typeof setInterval>;
	_no_refresh?: boolean;

	/* ---- DOM handles: query_report.js:2246-2266 ---- */
	/** `query_report.js:2264` `$('<div class="report-wrapper">')` — the datatable mount. */
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
	set_filters(filters: unknown[]): void;
	set_route_filters(route_options?: Record<string, unknown>): Promise<unknown> | void;
	clear_filters(): void;
	/**
	 * `query_report.js:704-883`. See {@link BaseList.refresh} — the instance
	 * property is throttled (`query_report.js:58`), so the return may be `undefined`.
	 */
	refresh(have_filters_changed?: boolean): Promise<void> | undefined;
	render_summary(data: unknown): void;
	/** `query_report.js:1074-1081`. */
	prepare_report_data(data: QueryReportRawData): void;
	/** `query_report.js:1083-1143` — constructs OR refreshes `this.datatable`. */
	render_datatable(): void;
	update_masked_fields_in_columns(columns: QueryReportColumn[]): QueryReportColumn[];
	show_loading_screen(): void;
	hide_loading_screen(): void;
	get_chart_options(data: QueryReportRawData): unknown;
	render_chart(options: unknown): void;
	/** `query_report.js:1374-1446`. */
	prepare_columns(columns: (string | QueryReportColumn)[]): QueryReportColumn[];
	/**
	 * `query_report.js:1450-1462`.
	 *
	 * DISCREPANCY: this overrides `BaseList.prepare_data(r)` (the call response)
	 * with a completely different parameter (the already-unwrapped result rows)
	 * and a non-void return. See the notes file.
	 */
	prepare_data(data: (Record<string, unknown> | unknown[])[]): FrappeListDoc[];
	get_visible_columns(): QueryReportColumn[];
	/** `query_report.js:1474-1507` — `raise` makes missing mandatory filters throw. */
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
	add_custom_column(
		custom_column: QueryReportColumn,
		custom_data: unknown,
		new_column_data: unknown,
		insert_after_index: number
	): void;
	get_linked_doctypes(): unknown;
	add_translate_data_checkbox(): void;
	/**
	 * `query_report.js:2405-2416` — datatable-driven, like ReportView's:
	 * `this.datatable.rowmanager.getCheckedRows()` indexes into `this.data`.
	 */
	get_checked_items(only_docnames: true): string[];
	get_checked_items(only_docnames?: false | 0 | null | undefined): FrappeListDoc[];
	get_checked_items(only_docnames?: boolean): string[] | FrappeListDoc[];
	/** `query_report.js:2418-2420` — a getter aliasing `get_filter_values`, kept for back-compat. */
	readonly get_values: (raise?: boolean) => Record<string, unknown>;
}
/** Augmentation seam — see {@link ListView}. */
export interface QueryReport {}

/* ------------------------------------------------------------------ *
 * 8. ListSettings (the "List View Settings" dialog)
 * ------------------------------------------------------------------ */

/** One row of the field-order editor — `list_settings.js:219-222`, `:345-348`, `:363-367`. */
export interface ListSettingsField {
	fieldname: string;
	label: string;
	/** Only the synthetic status row carries it (`list_settings.js:365`). */
	type?: "Status";
}

/**
 * `frappe/public/js/frappe/list/list_settings.js:1` —
 * `export default class ListSettings`.
 *
 * NOT on the `frappe` global: it is an ES-module default export, reachable only
 * via a deep import or indirectly through
 * {@link ListView.show_list_settings} (`list_view.js:2136-2145`).
 */
export declare class ListSettings {
	/** `list_settings.js:2-25` — throws when `doctype` is missing (`:3-5`). */
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
	/** `list_settings.js:12` — `null` until `make()` runs inside `with_doctype`. */
	dialog: unknown | null;
	/** `list_settings.js:13-14` — `JSON.parse(settings.fields)`, else `[]`. */
	fields: ListSettingsField[];
	subject_field: ListSettingsField | null;
	/** `list_settings.js:15` — 50. */
	max_number_of_fields: number;
	removed_fields?: string[];

	/** `list_settings.js:27-61` — the save callback calls `listview.refresh_columns(...)`. */
	make(): void;
	refresh(): void;
	show_dialog(): void;
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
 * `frappe.views.Container` — `views/container.js:9`. One instance, at
 * `frappe.container`.
 */
export declare class Container {
	/** `views/container.js:12` — `$("#body").get(0)`. */
	container: HTMLElement;
	/** The currently shown `.page-container` element, or null. */
	page: PageContainerElement | null;
	pagewidth: number;
	pagemargin: number;
	/**
	 * `views/container.js:30-39` — creates
	 * `<div class="content page-container" id="page-<label>" data-page-route="<label>">`,
	 * hidden, appended to `#body`, and registers it in `frappe.pages[label]`.
	 *
	 * This is the origin of the `.page-container` selector contract: MANY of
	 * these coexist (one per routed page) and only one is visible.
	 */
	add_page(label: string): PageContainerElement;
	change_to(label: string | PageContainerElement): PageContainerElement | undefined;
	toggle_sidebar(): void;
	/** `views/container.js:89-107`. */
	has_sidebar(): 0 | 1 | boolean;
}

/** `views/factory.js:7`. */
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
	/** Subclass hooks — `views/factory.js:17`, `:22`, `:26`. */
	before_show?(): boolean | void;
	on_show?(): void;
	make?(route: string[]): void;
}

/** `list_factory.js:6`. */
export declare class ListFactory extends Factory {
	make(route: string[]): void;
	before_show(): boolean | void;
	on_show(): void;
	re_route_to_view(): boolean | undefined;
	set_module_breadcrumb(): void;
	/** `list_factory.js:92-98` — assigns `window.cur_list`. */
	set_cur_list(): void;
}

/* ------------------------------------------------------------------ *
 * 10. The `frappe.views` namespace object
 * ------------------------------------------------------------------ */

/**
 * `frappe.views` — created by `frappe.provide("frappe.views")` in at least
 * `base_list.js:2`, `list_view.js:4`, `report_view.js:7`, `query_report.js:9`,
 * `container.js:6`, `factory.js:5`.
 *
 * EVERY member is optional. `frappe.provide` creates a bare `{}` and each
 * bundle assigns its own class when it loads, so bundle order decides what
 * exists. `carbon_frappe` relies on that: `tables/datatable/install.js:37` is
 * `frappe.views && frappe.views.ReportView && frappe.views.ReportView.prototype`
 * and `tables/list/list_view.js:142` is
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
	 * `list_factory.js:4` `frappe.provide("frappe.views.list_view")`, keyed by
	 * `frappe.get_route_str()` (`list_factory.js:32`) AND, separately, by bare
	 * doctype (`list_factory.js:28` `frappe.provide("frappe.views.list_view." + doctype)`
	 * creates an EMPTY OBJECT under the doctype key). So a lookup can return a
	 * view, a `{}` placeholder, or nothing — hence the union.
	 */
	list_view?: Record<string, ListView | ReportView | Record<string, never> | undefined>;
	/** `base_list.js:1439-1450`. */
	view_modes?: FrappeViewName[];
	/** `base_list.js:1451`. */
	is_valid?(view_mode: string): boolean;
	/* -- The lazily-loaded views and view helpers. -------------------------
	 *
	 * NO INDEX SIGNATURE (gaps.md §5.4 / §6.14). This interface used to end in
	 * `[view: string]: unknown`, which typed `frappe.views.KanbanVeiw` as
	 * `unknown` instead of erroring — the same typo hole gaps.md §1e flags on
	 * `frappe.ui.form`, and the thing `core.d.ts`'s own stated rule forbids.
	 * Every name below comes from an exhaustive grep of
	 * `frappe/public/js/**` at v16.33.0 for `frappe.views.<name> =`.
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
	 * `carbon_frappe/.../install.js` already uses narrows these correctly.
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
	/** `views/workspace/workspace.js` */
	Workspace?: unknown;
	/** `views/pageview.js` — `frappe.provide`d registry of page-route views. */
	pageview?: unknown;
}

/**
 * `frappe.get_list_view(doctype)` — `list_view.js:2695-2698`.
 *
 * Looks up `frappe.views.list_view["List/<doctype>/List"]`, so it only ever
 * finds the *List* view of a doctype, never its Report view.
 */
export type GetListView = (doctype: string) => ListView | undefined;

/**
 * `window.cur_list` — `list_factory.js:5` `window.cur_list = null`, assigned in
 * `set_cur_list` (`list_factory.js:93`) and nulled again when the doctype
 * changes (`list_factory.js:96`).
 *
 * Holds a ListView **or any subclass**, ReportView included; the harness routes
 * to `/app/todo/view/report` and reads `cur_list.datatable` off it.
 */
export type CurrentListView = ListView | ReportView | null;

/**
 * `window.cur_page` — `views/container.js:8` `window.cur_page = null`.
 *
 * GOTCHA: `change_to` sets `cur_page = this` (`container.js:41`), where `this`
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
 * (`list_view.js:752-1187`) and read back by frappe's own handlers.
 *
 * Load-bearing read sites:
 *  - `list-row-checkbox`      `list_view.js:1676-1693` (shift-select), `:1915` (`get_checked_items`)
 *  - `list-header-subject`    `list_view.js:1660`, `:1891`
 *  - `checkbox-actions`       `list_view.js:1664`, `:1892`
 *  - `list-check-all`         `list_view.js:393`, `:1660-1668`, `:1899`
 *  - `list-header-meta`       `list_view.js:1903` (`"{0} items selected"`)
 *  - `list-count`             `list_view.js:748` (`get_count_element`)
 *  - `list-liked-by-me`       `list_view.js:645` (adds `liked`), `:1718` (click)
 *  - `list-row-container` / `list-row` / `level-left` / `level-right`
 *                             `list_view.js:1113-1121` (`update_listview_classes` MEASURES them)
 *  - `list-row-col[data-fieldname]`  `list_view.js:1086-1088` (`apply_column_widths`)
 *  - `no-result`              `base_list.js:352`, toggled at `base_list.js:614`
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
	| "indicator-pill"
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
	| "btn-action";

/**
 * Attribute contracts on list markup.
 *
 *  - `data-sort-by`   written by `get_header_html` (`list_view.js:757`, `:783`),
 *                     read by `setup_sort_by` (`list_view.js:1543`)
 *  - `data-name`      written by `ElementFactory` (`list_view.js:2746`, `:2756`,
 *                     `:2766`), read via `$(el).data().name` at
 *                     `list_view.js:1684-1687` and `:1915`
 *  - `data-fieldname` `list_view.js:791-793`, consumed by `apply_column_widths`
 *  - `data-filter`    `list_view.js:996`, `:1001`, `:1013`, `:1379`; read by
 *                     `setup_filterable` (`list_view.js:1522`)
 *  - `data-idx`       `list_view.js:1193`, `:1220`; read at `:1640`
 *  - `data-parent`    `list_view.js:1667` — group-by child checkboxes
 *  - `data-doctype` / `data-liked-by` — `list_view.js:2716`, `:2769`
 *  - `data-row-index` — the datatable's, read by `ReportView.update_row` (`report_view.js:326`)
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
	| "button-idx"
	| "tabindex";

/**
 * frappe-datatable class names re-emitted by a replacement report renderer, so
 * existing app CSS and frappe's own code keep matching.
 *
 * `dt-row` is read by `ReportView.update_row` (`report_view.js:326`
 * `.dt-row[data-row-index="…"]` + the `row-update` flash class);
 * `dt-cell__content` by `set_link_title_field_value` (`report_view.js:198`);
 * `dt-filter` by `setup_inline_filter_observer` (`report_view.js:446`).
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
 *
 *  - `.page-container`               `views/container.js:31`. Many coexist, one
 *                                    visible — hence `.page-container:visible`.
 *                                    Also carries `data-page-route` (`container.js:33`).
 *  - `.navbar-breadcrumbs`           `ui/page.html:17` (the `<ul>`); its `<li><a>`
 *                                    children are built imperatively by
 *                                    `views/breadcrumbs.js:100-112`, and
 *                                    `breadcrumbs.js:281` does
 *                                    `$(".navbar-breadcrumbs").empty()` on EVERY
 *                                    route change — anything injected into the
 *                                    last `<a>` must be re-applied idempotently.
 *  - `header`                        `www/desk.html:39`, inside `.main-section`.
 *                                    EMPTY on a normal desktop load; frappe fills
 *                                    it only for read-only / impersonation /
 *                                    announcement / mobile
 *                                    (`ui/toolbar/toolbar.js`).
 *  - `.body-sidebar`,
 *    `.standard-items-sections`      `ui/sidebar/sidebar.html:3-4`; cached as
 *                                    `this.$standard_items_sections`
 *                                    (`ui/sidebar/sidebar.js:19`) and looked up
 *                                    globally by
 *                                    `ui/notifications/notifications.js:9`.
 *  - `.dropdown-navbar-user`         `ui/sidebar/sidebar.html:50`. Its `<a>` has an
 *                                    inline `onclick="return frappe.ui.toolbar.route_to_user()"`,
 *                                    so that global must survive any DOM move.
 *  - `.sidebar-notification`         generated at `ui/sidebar/sidebar.js:519-526`
 *                                    with the literal classes
 *                                    `"sidebar-notification hidden"`.
 *  - `.dropdown-notifications`       `ui/sidebar/sidebar.html:5` and
 *                                    `desk/page/desktop/desktop.html:37`. frappe's
 *                                    own toggle (`sidebar.js:527-531`) resolves it
 *                                    through `this.wrapper.find(...)`, which returns
 *                                    an EMPTY set once the node is moved out of the
 *                                    sidebar.
 *  - `.sidebar-toggle-btn`           TWO elements match: `ui/page.html:5`
 *                                    (`.sidebar-toggle-btn.navbar-brand`, handler at
 *                                    `ui/page.js:250`) and
 *                                    `ui/sidebar/sidebar.html:71`
 *                                    (`.collapse-sidebar-link.sidebar-toggle-btn`).
 *                                    `querySelector` takes whichever is first in the
 *                                    document.
 *  - `.desktop-*`                    `desk/page/desktop/desktop.html:2` (wrapper),
 *                                    `:3` (navbar), `:12`, `:36`, `:62`. Handlers
 *                                    bind by selector at `desktop.js:527`, `:537`,
 *                                    `:591`, `:621`, so MOVING these nodes preserves
 *                                    behaviour while CLONING them would not.
 *
 * STRICT NOTE: `document.querySelector(sel)` is `Element | null`, and `Element`
 * has neither `.dataset` nor `.click()`. Use the generic form
 * (`querySelector<HTMLElement>(…)`) at every one of these sites.
 */
export type FrappeDeskSelector =
	| ".page-container"
	| ".page-container:visible"
	| ".navbar-breadcrumbs"
	| ".navbar-breadcrumbs > li:last-child > a"
	| "header"
	| ".main-section"
	| ".body-sidebar"
	| ".standard-items-sections"
	| ".dropdown-navbar-user"
	| ".sidebar-notification"
	| ".sidebar-notification-count"
	| ".dropdown-notifications"
	| ".sidebar-toggle-btn"
	| ".collapse-sidebar-link"
	| ".desktop-wrapper"
	| ".desktop-navbar"
	| ".desktop-search-wrapper"
	| ".desktop-notifications"
	| ".desktop-avatar"
	| ".page-head-content"
	| ".layout-main"
	| ".list-skeleton";

/** SVG sprite ids referenced by list/report markup (`public/scss/common/icons.scss:25,48`). */
export type FrappeIconSpriteId = "#icon-heart" | "#icon-small-file" | "#icon-table" | "#icon-menu";

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
 *   of `report.bundle.js:3`, which the desk loads lazily per route. Absent on a
 *   desk page that has never opened a report.
 * - `frappe.query_report` is assigned even later: `query_report.js:21`, inside
 *   the `frappe.standard_pages["query-report"]` factory, so it only exists once
 *   that page has been *constructed*. `widgets/chart_widget.js:459` also
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
	 * `query_report.js:21` — `frappe.query_report = new frappe.views.QueryReport({parent: wrapper})`;
	 * `chart_widget.js:459` reassigns it.
	 *
	 * Its `datatable` member is itself `DataTable | null | undefined`
	 * ({@link QueryReport.datatable}) — `query_report.js:1083-1143` builds it on
	 * first render and callers null it to force a rebuild.
	 */
	query_report?: QueryReport;

	/**
	 * Per-report JS customisation objects, keyed by report name.
	 *
	 * `query_report.js:10` `frappe.provide("frappe.query_reports")` creates the
	 * bare object; a report's own `<report>.js` assigns into it
	 * (`query_report.js:441`), and `get_local_report_settings`
	 * (`query_report.js:456-464`) reads it back with a `|| {}` fallback.
	 *
	 * The value is `| undefined` independently of `noUncheckedIndexedAccess`:
	 * `report_utils.js:122` and `query_report.js:425` both test
	 * `if (frappe.query_reports[report_name])` before dereferencing, because a
	 * report whose script has not been eval'd yet has no entry.
	 */
	query_reports?: Record<string, QueryReportSettings | undefined>;
}

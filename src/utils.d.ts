/**
 * `frappe-types` — group **frappe-utils-dom-router**
 *
 * Hand-maintained declarations for the `frappe.utils`, `frappe.dom` and
 * `frappe.router` slice of the Frappe desk JS API, plus the `frappe.ui.Page`
 * class and the theme switcher's `frappe.ui` members.
 *
 * Target: **Frappe v16.50.0** (`git tag v16.50.0`, branch `version-16`).
 *
 * Every signature below was read out of the shipped source; the citations are
 * `path/to/file.js:line` relative to `apps/frappe/`. When frappe's own code is
 * genuinely dynamic the declaration says so with `unknown` plus a doc comment
 * rather than guessing — consumers of this package compile with
 * `strict: true` and no `as any`, so an optimistic type is worse than an open
 * one.
 *
 * Sources read in full for this fragment:
 * - `frappe/public/js/frappe/utils/utils.js`      (2337 lines)
 * - `frappe/public/js/frappe/utils/datatable.js`  (22 lines)
 * - `frappe/public/js/frappe/utils/common.js`     (frappe.utils.* additions)
 * - `frappe/public/js/frappe/query_string.js`     (frappe.utils.* additions)
 * - `frappe/public/js/frappe/event_emitter.js`    (36 lines)
 * - `frappe/public/js/frappe/logtypes.js`, `frappe/public/js/frappe/meta_tag.js`
 * - `frappe/public/js/frappe/dom.js`              (462 lines)
 * - `frappe/public/js/frappe/router.js`           (1052 lines; the URL now carries a
 *   shell segment, `/desk/<shell-slug>/<route>`)
 * - `frappe/public/js/frappe/ui/theme_switcher.js`
 * - `frappe/public/js/frappe/ui/page.js`          (1271 lines) and its template
 *   `frappe/public/js/frappe/ui/page.html` (the page head is built from the espresso
 *   components: `es-breadcrumbs`, `es-badge`, `es-button`)
 *
 * Citations written or re-checked against that source use the full
 * `frappe/public/js/frappe/...` path; older bare-filename forms (`utils.js:NNN`) resolve
 * against the same base.
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Cross-group imports
// ---------------------------------------------------------------------------

/**
 * jQuery is pervasive in this slice — `frappe.dom` and half of `frappe.utils`
 * take or return jQuery objects.
 *
 * SEAM — this fragment used to `import type { JQuery } from "./globals"`, which
 * `globals.d.ts` does not (and must not) export: `JQuery` is an AMBIENT global
 * interface from `@types/jquery` (a real dependency of this package, listed in
 * `tsconfig.json`'s `types`), and an ambient global cannot be re-exported by
 * name from a module. The import is gone; every `JQuery<TElement>` below now
 * resolves to the ambient interface, which is what it always meant.
 *
 * The fragment still never writes `JQuery.SomeType` (the @types/jquery
 * *namespace*), only `JQuery<TElement>` (the interface). jQuery *event* objects
 * stay modelled locally as {@link JQueryEventLike}.
 */

/**
 * `frappe.utils.make_chart()` returns `new frappe.Chart(...)`
 * (`utils/utils.js:1599`). The chart class belongs to `charts.d.ts`.
 *
 * SEAM — imported as `FrappeChart`, a name `charts.d.ts` does not export. The
 * value of `new frappe.Chart(...)` is typed {@link FrappeBaseChart} by that
 * fragment's own {@link FrappeChartConstructor} construct signature, so that is
 * the name used here. It is deliberately NOT `FrappeChartInstance` (the union
 * of the five concrete classes): the dispatching constructor really does return
 * one of those at runtime, but TypeScript cannot express "a class whose
 * constructor returns something else", and typing the result as the union would
 * make `chart = frappe.utils.make_chart(...)` disagree with
 * `chart = new frappe.Chart(...)` inside the same package.
 */
import type { FrappeBaseChart } from "./charts";

/**
 * `frappe.ui.Page` (declared in this fragment) reaches two names owned by other
 * fragments:
 *
 * - {@link BaseControl} — what `frappe.ui.form.make_control` returns
 *   (`ui/page.js:1183`), used for `Page#fields_dict` and `Page#add_field`.
 *   This makes `utils.d.ts` ↔ `ui/form.d.ts` a type-only import cycle, which is
 *   legal in `.d.ts` and produces no emit.
 * - {@link FrappeIndicator} — the indicator-colour union `Page#set_indicator`
 *   writes verbatim into the pill's `data-theme` attribute
 *   (`frappe/public/js/frappe/ui/page.js:259`), owned by `core.d.ts`.
 */
import type { BaseControl } from "./ui/form";
import type { FrappeIndicator } from "./core";
import type { FrappeCheck } from "./model";
import type { JQueryRegion } from "./globals";
// Single-sourced: `report_column_total`'s cell parameter IS frappe-datatable's
// total-row cell. See the note on `FrappeReportColumnTotalCell` below, and the
// reciprocal `DataTableTranslations` import in `datatable.d.ts:56`. The two
// files import types from each other; `import type` cycles between ambient
// declaration files are resolved by the checker and emit nothing.
import type { DataTableColumnTotalCell, DataTableTotalCell } from "./datatable";

// ===========================================================================
// SECTION 0 — shared helper shapes
// ===========================================================================

/**
 * The event object a jQuery handler receives.
 *
 * Declared structurally rather than as `JQuery.Event` so this fragment does
 * not depend on how `globals-jquery` exposes the jQuery *namespace*. Any
 * `JQuery.TriggeredEvent` is assignable to it.
 */
export interface JQueryEventLike<TTarget extends EventTarget = EventTarget> {
	type: string;
	target: TTarget;
	currentTarget: TTarget;
	/** The native event jQuery wrapped, when there is one. */
	originalEvent?: Event;
	which?: number;
	key?: string;
	preventDefault(): void;
	stopPropagation(): void;
}

/**
 * A `frappe.utils.debounce()` result — a callable carrying `cancel`/`flush`
 * expandos.
 *
 * `utils/utils.js:928-963`: `debounced.cancel` and `debounced.flush` are
 * attached to the returned function and both return `false` when no timer is
 * pending, `true` otherwise.
 */
export interface FrappeDebouncedFunction<TArgs extends unknown[] = unknown[]> {
	(...args: TArgs): void;
	/** `frappe/public/js/frappe/utils/utils.js:945-951`. `false` when there was nothing pending. */
	cancel(): boolean;
	/** `frappe/public/js/frappe/utils/utils.js:953-960`. Runs the pending call immediately. */
	flush(): boolean;
}

// ===========================================================================
// SECTION 1 — frappe.utils
// ===========================================================================

/**
 * Duration-field display options.
 *
 * Read at `utils/utils.js:1221-1249` (`get_formatted_duration`) and produced by
 * `get_duration_options` (`utils/utils.js:1298-1303`) straight off a
 * `Duration` DocField, so the flags arrive as frappe's 0/1 booleans. The
 * `!== 1` comparisons in `get_formatted_duration` mean a JS `true` is NOT
 * equivalent to `1` there — pass `1`.
 */
export interface FrappeDurationOptions {
	hide_days?: 0 | 1;
	hide_seconds?: 0 | 1;
}

/** `utils/utils.js:1259-1279` — the decomposed duration. */
export interface FrappeDurationParts {
	days: number;
	hours: number;
	minutes: number;
	seconds: number;
}

/**
 * One step of an abbreviation ladder.
 * `utils/number_systems.js` — `{ divisor, symbol }`, largest divisor first.
 */
export interface FrappeNumberSystemUnit {
	divisor: number;
	symbol: string;
}

/** `utils/utils.js:1196-1219` — coarse UA sniff. */
export interface FrappeBrowserInfo {
	name: string;
	version: string;
}

/**
 * The values `frappe.utils.validate_type` knows.
 * `utils/utils.js:481-519` — anything else returns `false` unconditionally.
 */
export type FrappeValidationType =
	| "phone"
	| "name"
	| "number"
	| "digits"
	| "alphanum"
	| "email"
	| "url"
	| "dateIso";

/**
 * `frappe.utils.icon()`'s `size` argument.
 *
 * `utils/utils.js:1521-1526`: a string becomes the class `icon-${size}`
 * (frappe ships `icon-xs` … `icon-xl`); an object is inlined as
 * `width: ${size.width}; height: ${size.height}` in the `style` attribute, so
 * the two members are raw CSS lengths, not numbers-as-px.
 */
export type FrappeIconSize =
	| "xs"
	| "sm"
	| "md"
	| "lg"
	| "xl"
	// eslint-disable-next-line @typescript-eslint/ban-types
	| (string & {})
	| { width: string | number; height: string | number };

/**
 * A `frappe.utils.map_defaults.tiles.*` entry (`utils/utils.js:1318-1346`).
 * Shapes match Leaflet's `L.tileLayer(url, options)`.
 */
export interface FrappeMapTile {
	url: string;
	options: { attribution: string };
}

/** `utils/utils.js:1315-1348`. */
export interface FrappeMapDefaults {
	center: [number, number];
	zoom: number;
	tiles: {
		default_tile: FrappeMapTile;
		satellite_tile: FrappeMapTile;
		labels_tail: FrappeMapTile;
		terrain_lines_tail: FrappeMapTile;
		[name: string]: FrappeMapTile;
	};
	image_path: string;
}

/**
 * The argument `frappe.utils.generate_route()` reads.
 * `frappe/public/js/frappe/utils/utils.js:1620-1717`. Only `type` is required;
 * every other member is consulted per `type`, and unknown members are ignored.
 */
export interface FrappeGenerateRouteItem {
	/** Lower-cased before dispatch: doctype | report | page | dashboard | workspace. */
	type: string;
	name?: string;
	/** Set by the function itself when `type === "doctype"` (`frappe/public/js/frappe/utils/utils.js:1622-1624`). */
	doctype?: string;
	/** Short-circuits every branch when present (`frappe/public/js/frappe/utils/utils.js:1626,1695-1697`). */
	route?: string;
	link?: string;
	doc_view?: "List" | "Tree" | "Report Builder" | "Dashboard" | "New" | "Calendar" | "Kanban" | "Image";
	kanban_board?: string;
	filters?: Record<string, unknown>;
	tab?: string;
	is_query_report?: boolean;
	report_ref_doctype?: string;
	/**
	 * Workspaces only (`frappe/public/js/frappe/utils/utils.js:1686-1693`): a public
	 * workspace is routed by `name`, anything else as `private/<title>`.
	 */
	public?: boolean;
	/**
	 * Workspaces only, and only read for a non-public one
	 * (`frappe/public/js/frappe/utils/utils.js:1692`): a private page is spelled by
	 * its title, because its `name` carries the owner's email. Falls back to `name`.
	 */
	title?: string;
	/**
	 * Serialised onto the URL as a query string
	 * (`frappe/public/js/frappe/utils/utils.js:1699-1710`). An **array** value is
	 * `JSON.stringify`'d (it is a `[operator, value]` filter that the list view
	 * parses back out); anything else is `encodeURIComponent`'d as-is.
	 */
	route_options?: Record<string, unknown>;
}

/**
 * A row of `frappe.boot.desktop_icons` — the shape `get_desktop_icon_by_label`
 * (`frappe/public/js/frappe/utils/utils.js:1488-1499`) and `get_route_for_icon`
 * (`frappe/public/js/frappe/utils/utils.js:1409-1470`) read.
 *
 * Server shape: `frappe/desk/doctype/desktop_icon/desktop_icon.py:252-267`
 * selects sixteen columns off `Desktop Icon` (`frappe.get_all`), and
 * `desktop_icon.py:302` adds a seventeenth, `module`, to every icon that
 * survives the permission pass (all of them, whenever `frappe.boot.desktop_icons`
 * exists at all). The record is closed. Option lists are from
 * `desktop_icon.json`; unset Data / Link / Select columns come back `null`,
 * Checks as `0 | 1`.
 *
 * `frappe.boot.desktop_icons` is **only put in the boot payload when the site's
 * Desktop Settings page is "Desktop Icons"** (`frappe/boot.py:265-270`,
 * `is_desktop_icons_page()` in `desktop_settings.py:93-95`); on the default
 * Apps screen it is absent, and the `get_desktop_icon*` helpers below throw
 * on it. The `Desktop Icon` DocType itself is flagged `deprecated` in
 * `desktop_icon.json:7`.
 */
export interface FrappeDesktopIconRecord {
	label: string;
	/** `gray` / `blue` (json options). */
	bg_color: "gray" | "blue" | null;
	/** External URL — read at `frappe/public/js/frappe/utils/utils.js:1413-1414` when `link_type === "External"`. */
	link: string | null;
	link_type: "Workspace Sidebar" | "External" | null;
	/**
	 * The owning app's `app_name`. `get_desktop_icon` keys
	 * `frappe.boot.desktop_icon_urls[app]` with it to find the app's own
	 * `icons/desktop_icons/<variant>/<scrub(label)>.svg`
	 * (`frappe/public/js/frappe/utils/utils.js:1472-1486`).
	 */
	app: string | null;
	icon_type: "Link" | "Folder" | "App" | null;
	/** Label of the folder icon this one sits in (`Link` → Desktop Icon). */
	parent_icon: string | null;
	icon: string | null;
	link_to: string | null;
	idx: number;
	standard: FrappeCheck;
	logo_url: string | null;
	hidden: FrappeCheck;
	/** The docname. */
	name: string;
	restrict_removal: FrappeCheck;
	icon_image: string | null;
	/**
	 * The module whose sidebar the icon's linked workspace belongs to
	 * (`frappe/desk/doctype/desktop_icon/desktop_icon.py:302`, "carried into the
	 * payload so the client resolves the icon's route through the module-keyed
	 * sidebar payload"). `get_route_for_icon` resolves the icon's shell with
	 * `sidebar_for_module(module || label)`
	 * (`frappe/public/js/frappe/utils/utils.js:1416-1418`).
	 */
	module: string | null;
}

/** `frappe/public/js/frappe/utils/utils.js:1773-1799` — the argument to `build_summary_item`. */
export interface FrappeSummaryItem {
	type?: "separator" | (string & {});
	label?: string;
	value?: unknown;
	datatype?: string;
	currency?: string;
	color?: string;
	indicator?: string;
}

/** `frappe/public/js/frappe/utils/utils.js:1845-1904` — one entry of `add_select_group_button`. */
export interface FrappeSelectGroupAction {
	label: string;
	description?: string;
	action?: (event: JQueryEventLike) => void;
}

/**
 * What `frappe.utils.app_logo()` reads off an app
 * (`frappe/public/js/frappe/utils/utils.js:1379-1391`): `app_title` (falling back
 * to `app_name`) and `app_logo_url`. A `frappe.boot.app_data` entry fits.
 *
 * `app_logo_url` may be a list — an app that ships a light and a dark mark
 * (`:1382-1384`); the first entry is the one the desk uses — or empty/`null` for
 * an app that declares no logo, which makes `app_logo` draw a letter icon.
 */
export interface FrappeAppLogoSource {
	app_name: string;
	app_title?: string | null;
	app_logo_url?: string | readonly string[] | null;
}

/**
 * An entry of `frappe.boot.module_sidebars`, as far as `frappe.utils` reads it:
 * the map is keyed by shell (a `Sidebar` document's name, or the module's name
 * where the base was computed), and every entry carries the `module` it belongs
 * to (`frappe/public/js/frappe/utils/utils.js:1393-1404`); `get_route_for_icon`
 * reads its `items` (`:1420`). The entry is assembled by `as_boot_entry()` in
 * `frappe/desk/doctype/sidebar/sidebar.py:1538-1559` (`name`, `module`, `label`,
 * `app`, `header_icon`, `module_onboarding`, `customized`, `computed`,
 * `workspaces`, `items`) inside `get_module_sidebars()` (`frappe/boot.py:609-647`);
 * only the two members `frappe.utils` reads are declared, so `items` stays
 * `unknown` and the rest rides on the index signature.
 */
export interface FrappeModuleSidebarShell {
	module: string | null;
	items: readonly unknown[];
	[key: string]: unknown;
}

/** `utils/utils.js:2260-2300` — a navbar Help dropdown entry. */
export interface FrappeHelpDropdownItem {
	name?: string;
	label?: string;
	url?: string;
	onClick?: () => void;
	is_divider?: boolean;
}

/**
 * The "cell" `frappe.utils.report_column_total()` is handed.
 *
 * `utils/utils.js:1004-1020` reads exactly two things off it:
 * `column.column.disable_total` and `column.column.fieldtype`. The parameter
 * name upstream is `column`, but the object is a frappe-datatable **cell**
 * whose `.column` is the column definition — see
 * `carbon_frappe/public/js/tables/datatable/datatable.js:398`, which builds
 * `{ column: col, colIndex: dtColIndex }` for exactly this call.
 *
 * SEAM RESOLUTION (gaps.md §2d / §4.5) — this file used to declare that shape
 * INLINE, under this name. `datatable.d.ts` already declared the very same
 * frappe-datatable object as {@link DataTableTotalCell} (built by
 * `body-renderer.js:97-108`), and having two names for one object made the
 * project's own wiring fail to type-check:
 *
 * ```ts
 * // carbon_frappe/public/js/tables/datatable/install.js:61
 * hooks: { columnTotal: frappe.utils.report_column_total }
 * // -> TS2322: 'DataTableTotalCell' is not assignable to
 * //            'FrappeReportColumnTotalCell'
 * ```
 *
 * `datatable.d.ts` keeps the declaration, because it owns every other
 * frappe-datatable shape and because `DataTableHooks.columnTotal` — the slot
 * this value has to fit — is declared there against that exact type. Nothing
 * was lost in the move: `DataTableTotalCell extends DataTableCell` and its
 * `column: DataTableColumn` carries both members `utils.js:1005-1010` reads
 * (`fieldtype?: string` at datatable.d.ts:351, `disable_total?: boolean | 0 | 1`
 * at datatable.d.ts:354, each with the same citation the inline shape had), plus
 * the `colIndex` and the open cell members the index signature stood in for.
 *
 * This name survives as an ALIAS rather than being deleted, so any consumer
 * that already imports it keeps compiling and lands on the single owning type.
 *
 * SINCE THEN the parameter has moved once more, to
 * `DataTableColumnTotalCell` — the cell shape BOTH datatable implementations
 * actually pass. `DataTableTotalCell` (which adds `isTotalRow: 1`) is what
 * stock's `body-renderer.js:97-108` builds; carbon_frappe's `renderTotalCell`
 * passes `{ column, colIndex }` and nothing else, and `report_column_total`
 * reads only `column.column`, so requiring the stock-only member here would
 * have made `hooks: { columnTotal: frappe.utils.report_column_total }` a type
 * error against a live carbon_frappe bench. This alias still points at the
 * stock shape, which is the shape it always named.
 *
 * @deprecated Import {@link DataTableTotalCell} from `frappe-types` instead.
 * This alias is kept only for source compatibility.
 */
export type FrappeReportColumnTotalCell = DataTableTotalCell;

/**
 * A pluralised frappe-datatable translation.
 * `frappe/public/js/frappe/utils/datatable.js:11-18` — keyed by count, with a
 * `default` fallback.
 */
export interface DataTablePluralTranslation {
	1: string;
	default: string;
}

/**
 * One language's frappe-datatable string table.
 * `frappe/public/js/frappe/utils/datatable.js:5-19`. Note the **mixed value type**: five keys are
 * plain strings and two are {@link DataTablePluralTranslation}. Typing this as
 * `Record<string, string>` would be wrong, and consumers that assume a string
 * silently fall through to the untranslated key.
 */
export interface DataTableTranslationTable {
	"Sort Ascending": string;
	"Sort Descending": string;
	"Reset sorting": string;
	"Remove column": string;
	"No Data": string;
	"{count} cells copied": DataTablePluralTranslation;
	"{count} rows selected": DataTablePluralTranslation;
	[key: string]: string | DataTablePluralTranslation;
}

/**
 * `frappe.utils.datatable.get_translations()`'s return value: a single-entry
 * map keyed by `frappe.boot.lang` (`frappe/public/js/frappe/utils/datatable.js:4-5,21`).
 */
export type DataTableTranslations = Record<string, DataTableTranslationTable>;

/**
 * `frappe.utils.datatable` — created by
 * `frappe.provide("frappe.utils.datatable")` at `utils/datatable.js:1`, so it
 * only exists once that bundle has loaded (it is part of `desk.bundle.js`).
 */
export interface FrappeUtilsDataTable {
	/**
	 * Builds the frappe-datatable `translations` option for the current
	 * language. Takes no arguments.
	 *
	 * `frappe/public/js/frappe/utils/datatable.js:3-22`.
	 */
	get_translations(): DataTableTranslations;
}

/**
 * `frappe.utils.logtypes` — `logtypes.js:6`.
 */
export interface FrappeUtilsLogTypes {
	/**
	 * `frappe/public/js/frappe/logtypes.js:8-35`. Renders a retention notice into
	 * `cur_list.page.sidebar`; a no-op unless the user can write `Log Settings`.
	 */
	show_log_retention_message(doctype: string): void;
}

/**
 * The `frappe.utils` namespace.
 *
 * Created by `frappe.provide("frappe.utils")` (`provide.js:24`), then filled by
 * `Object.assign(frappe.utils, {...})` at `utils/utils.js:136` and
 * `query_string.js:74`, plus individual assignments in `common.js`,
 * `event_emitter.js`, `meta_tag.js`, `logtypes.js` and `utils/datatable.js`.
 *
 * Declared **non-optional** on the `frappe` global: it exists from
 * `provide.js`, i.e. before any app code runs.
 *
 * ### Defensive probes are safe against these non-optional members
 * carbon_frappe guards some calls with a truthiness probe on the *method*:
 * `frappe.utils && frappe.utils.icon` (`tables/engine/icons.js:32`) and
 * `frappe.utils?.icon` (`anatomy/editable_title.js:53`). Verified against
 * TypeScript 5.9.3 under `strict`: **neither raises TS2774** ("this condition
 * will always return true since this function is always defined") — that check
 * only fires for locally declared functions, not for property accesses on an
 * ambient interface. So the members can stay honest (non-optional) without
 * forcing the consumer to rewrite its guards. `typeof x === "function"` is
 * also accepted, and narrows identically.
 */
export interface FrappeUtils {
	// ---------------------------------------------------------------- strings

	/** `utils.js:137-145`. Random alphanumeric string of length `len`. */
	get_random(len: number): string;

	/** `utils.js:146-155`. Prefixes bare filenames with `files/`. */
	get_file_link(filename: string): string;

	/** `utils.js:156-158`. `\n` → `<br>`; `""` for a falsy input. */
	replace_newlines(t: string | null | undefined): string;

	/** `utils.js:159-168`. Parses and looks for element nodes. */
	is_html(txt: string | null | undefined): boolean;

	/** `utils.js:169-171`. `navigator.platform === "MacIntel"`. */
	is_mac(): boolean;

	/** `utils.js:172-174`. `$(document).width() < 768`. */
	is_xs(): boolean;

	/** `utils.js:175-177`. 768 ≤ width < 991. */
	is_sm(): boolean;

	/** `utils.js:178-180`. 991 ≤ width < 1199. */
	is_md(): boolean;

	/** `utils.js:181-188`. */
	is_json(str: string): boolean;

	/**
	 * `utils.js:189-197`. Returns the parsed value, or **the original string**
	 * when parsing fails — hence `unknown` rather than a parsed shape.
	 */
	parse_json(str: string): unknown;

	/** `utils.js:198-200`. Collapses empty `<p>` and repeated `<br>`. */
	strip_whitespace(html: string | null | undefined): string;

	/** `utils.js:201-213`. Escapes only `& < >`. */
	encode_tags(html: string): string;

	/** `utils.js:214-230`. Drops quoted reply text from an email body. */
	strip_original_content(txt: string): string;

	/**
	 * `utils.js:232-245`. Escapes `& < > " ' \` =`.
	 *
	 * Accepts anything: `null`/`undefined` return `""` while `0` and `false`
	 * are stringified (the guard is `txt == null`, deliberately not `!txt`).
	 */
	escape_html(txt: unknown): string;

	/** `utils.js:249-251`. `escape_html` + `<strong>` wrapper. */
	bold(txt: unknown): string;

	/** `utils.js:253-268`. Inverse of {@link FrappeUtils.escape_html}. */
	unescape_html(txt: unknown): string;

	/**
	 * `utils.js:270-274`. Parses `html` and returns `dom.body.textContent`.
	 * A parsed `text/html` document always has a body, so the result is a
	 * string at runtime even though `Node.textContent` is nullable in lib.dom.
	 */
	html2text(html: string): string;

	/** `utils.js:276-281`. Prefix test for `http://` / `https://` only. */
	is_url(txt: string): boolean;

	/** `utils.js:282-290`. Title-cases and strips `-`/`_` (or replaces with a space). */
	to_title_case(string: string, with_space?: boolean): string;

	/** `utils.js:291-305`. Collapses nested blockquotes behind a "• • •" toggle. */
	toggle_blockquote(txt: string): string;

	// ------------------------------------------------------------- scrolling

	/**
	 * `frappe/public/js/frappe/utils/utils.js:306-319`. Animates `.main-section`'s
	 * `scrollTop` to 0 over 300 ms (jQuery `swing`) and pins it to 0 when the
	 * animation completes. Returns nothing; there is no way to await it.
	 */
	scroll_page_to_top(): void;

	/**
	 * `frappe/public/js/frappe/utils/utils.js:320-375`. `element` is a scroll offset
	 * in px (a `number`), or an element to scroll to. No-ops when
	 * `frappe.flags.disable_auto_scroll`. `element_to_be_scrolled` defaults to
	 * `$("html, body")`.
	 *
	 * **`element` is an `HTMLElement` or a jQuery set, not a selector.** A
	 * non-number `element` goes to {@link FrappeUtils.get_scroll_position}, which
	 * since the 3-argument rewrite reads `element instanceof HTMLElement ? element
	 * : element[0]` (`:380`); a selector string (or an SVG element) therefore
	 * resolves to nothing and the scroll silently targets the top of the container.
	 * An `Element` is accepted by `$(element).addClass("highlight")` (`:347`), but
	 * not by the position calculation, so it is left out of the type.
	 *
	 * `callback` runs only after an **animated** scroll that actually moved
	 * (`:362-371`): not when `animate` is `false` and not when the container is
	 * already at the target (`:357-360`, which returns before reaching it).
	 */
	scroll_to(
		element?: number | HTMLElement | JQuery<HTMLElement> | null,
		animate?: boolean,
		additional_offset?: number | string | null,
		element_to_be_scrolled?: JQuery<HTMLElement> | null,
		callback?: (() => void) | null,
		highlight_element?: boolean
	): void;

	/**
	 * `frappe/public/js/frappe/utils/utils.js:376-403`. Where `scrollTop` has to be
	 * for `element` to sit just under the sticky header: the sum of `offsetTop` up
	 * the `offsetParent` chain until it reaches `element_to_be_scrolled[0]` (or the
	 * end of the chain, when that is omitted), minus the heights of `.navbar`, the visible
	 * `.page-head` and the visible `.form-tabs-list` (`:391-397`), minus
	 * `cint(additional_offset)`. **Not clamped** — can be negative; `scroll_to`
	 * clamps it.
	 *
	 * The third parameter is new: it bounds the `offsetParent` walk so an element
	 * inside a nested scroll container is measured against that container.
	 * `element` must be an `HTMLElement` or a jQuery set (`:380`); a string
	 * selector measures as `0`.
	 */
	get_scroll_position(
		element: HTMLElement | JQuery<HTMLElement>,
		additional_offset?: number | string,
		element_to_be_scrolled?: JQuery<HTMLElement> | null
	): number;

	// ------------------------------------------------------------ collections

	/**
	 * `utils.js:404-432`. `filters` as a string returns `[dict[filters]]`;
	 * as an object it is an `{ key: value }` / `{ key: [op, value] }` matcher
	 * supporting `in`, `not in`, `<`, `<=`, `>`, `>=`.
	 *
	 * ⚠ The four comparison operators are broken upstream: they compare the row's
	 * value against the whole `[op, value]` array (`d[key] < filters[key]`,
	 * `frappe/public/js/frappe/utils/utils.js:416-423`), not against `value`, so only
	 * `in` / `not in` and plain equality behave as the shape suggests.
	 */
	filter_dict(
		dict: Record<string, unknown> | readonly unknown[],
		filters: string | Record<string, unknown>
	): unknown[];

	/** `utils.js:433-435`. Oxford-less "a, b or c". */
	comma_or<T>(list: readonly T[] | T): string | T;

	/** `utils.js:436-438`. Oxford-less "a, b and c". */
	comma_and<T>(list: readonly T[] | T): string | T;

	/**
	 * `utils.js:439-451`. Joins with `", "` and `sep` before the last item.
	 * A non-array is returned unchanged, and a 1-element array returns
	 * `list[0]` **unchanged** (not stringified) — hence the `| T`.
	 */
	comma_sep<T>(list: readonly T[] | T, sep: string): string | T;

	/**
	 * `utils.js:586-607`. Sorts `list` **in place** by `list[i][key]` and
	 * returns it. `compare_type` defaults to `"string"` when
	 * `typeof list[0][key] === "string"`, else `"number"`.
	 */
	sort<T>(list: T[], key: string, compare_type?: "string" | "number", reverse?: boolean): T[];

	/** `utils.js:609-619`. Order-preserving de-duplication (uses `in`, so keys are stringified). */
	unique<T>(list: readonly T[]): T[];

	/**
	 * `utils.js:621-629`. Drops entries for which frappe's global `is_null()`
	 * is true (`frappe/public/js/frappe/utils/datatype.js:31-33`): `null`,
	 * `undefined` and anything whose `String()` is blank — `""`, whitespace-only
	 * strings and an empty array. Typed as `T[]` because the predicate is not
	 * expressible: `""` is removed while `0` is kept.
	 */
	remove_nulls<T>(list: readonly T[]): T[];

	/** `utils.js:631-638`. Python's `all()`. */
	all(lst: readonly unknown[]): boolean;

	/** `utils.js:640-651`. Zips a key list against rows of positional values. */
	dict(keys: readonly string[], values: readonly (readonly unknown[])[]): Record<string, unknown>[];

	/** `utils.js:653-657`. `flt()`-coerced sum. */
	sum(list: readonly unknown[]): number;

	/** `utils.js:659-676`. Deep for nested arrays, `!==` otherwise. */
	arrays_equal(arr1: readonly unknown[] | null | undefined, arr2: readonly unknown[] | null | undefined): boolean;

	/** `utils.js:678-714`. Sorted-merge intersection; sorts copies first. */
	intersection<T>(a: readonly T[], b: readonly T[]): T[];

	/** `frappe/public/js/frappe/utils/utils.js:1910-1915`. `undefined` for an empty/absent array, else the array. */
	parse_array<T>(array: readonly T[] | null | undefined): readonly T[] | undefined;

	/** `utils.js:1918-1928`. Python's `range`; a lone argument is the *end*. */
	range(start: number, end?: number): number[];

	/** `utils.js:2330-2336`. Subsequence (not contiguous-subarray) test. */
	is_sub_array(big: readonly unknown[], small: readonly unknown[]): boolean;

	/** `utils.js:1090-1092`. Delegates to the `fast-deep-equal` package. */
	deep_equal(a: unknown, b: unknown): boolean;

	// ------------------------------------------------------------------ files

	/**
	 * `utils.js:716-747`. Down-scales `reader.result` (a data URI) and calls
	 * back with a JPEG data URI. `max_width`/`max_height` default to 600/400.
	 */
	resize_image(
		reader: { result: string | ArrayBuffer | null },
		callback: (dataURL: string) => void,
		max_width?: number,
		max_height?: number
	): void;

	/** `utils.js:749-814`. RFC-4180-ish CSV split; rows of raw string cells. */
	csv_to_array(strData: string, strDelimiter?: string): string[][];

	/** `utils.js:839-844`. Extension test, query string tolerated. */
	is_image_file(filename?: string | null): boolean;

	/** `utils.js:846-851`. */
	is_video_file(filename?: string | null): boolean;

	/** `utils.js:1094-1106`. Middle-ellipsis that keeps the extension. */
	file_name_ellipsis(filename: string, length: number): string;

	/** `utils.js:1108-1120`. base64 data URI → decoded string. */
	get_decoded_string(dataURI: string): string;

	// -------------------------------------------------------------- documents

	/** `utils.js:816-818`. */
	warn_page_name_change(): void;

	/**
	 * `utils.js:820-830`. Sets `document.title`, applies
	 * `frappe._title_prefix`, and records the title against the current
	 * sub-path in `frappe.route_titles` so re-routing can restore it.
	 */
	set_title(title: string): void;

	/** `utils.js:832-837`. Re-applies `set_title` with a prefix. */
	set_title_prefix(prefix: string): void;

	/**
	 * `utils.js:964-982`. Desk form URL. **v16 routes are `/desk/...`, not
	 * `/app/...`** — see the note in the companion markdown.
	 */
	get_form_link(
		doctype: string,
		name: string,
		html?: boolean,
		display_text?: string | null,
		query_params_obj?: Record<string, unknown> | null
	): string;

	/** `utils.js:984-1002`. Human label for a `/`-joined route string. */
	get_route_label(route_str: string): string;

	/** `meta_tag.js:8-18`. Opens/creates the `Website Route Meta` for `route`. */
	set_meta_tag(route: string): void;

	// ----------------------------------------------------------------- reports

	/**
	 * Column total for a report/datatable column.
	 *
	 * `utils.js:1004-1020`. Returns:
	 * - `""` when `column.column.disable_total` is truthy,
	 * - the arithmetic **mean** for `Percent` columns or when `type === "mean"`,
	 * - a `cint` sum for `Int`, a `flt` sum for any other numeric fieldtype,
	 * - `null` for non-numeric columns and for an empty `values` array.
	 *
	 * Deliberately declared **without a `this` parameter**: carbon_frappe
	 * invokes it as `hook.call(this, values, cell)` with the datatable as the
	 * receiver (`tables/datatable/datatable.js:401`), which a `this: void`
	 * annotation would reject. frappe's implementation ignores `this`.
	 *
	 * Note the third parameter is **not** passed by that call site, so the
	 * `"mean"` behaviour is unreachable from carbon_frappe.
	 */
	report_column_total(
		values: readonly unknown[],
		column: DataTableColumnTotalCell,
		type?: "mean"
	): number | "" | null;

	// ------------------------------------------------------------------- misc

	/** `utils.js:452-463`. Creates/updates/removes a `.footnote-area`. */
	set_footnote(
		footnote_area: JQuery<HTMLElement> | null | undefined,
		wrapper: JQuery<HTMLElement> | HTMLElement | string,
		txt: string | null | undefined
	): JQuery<HTMLElement> | null;

	/**
	 * `utils.js:465-471`. `a=1&b=2` → `{a: "1", b: "2"}`. The whole string is
	 * `decodeURIComponent`'d **before** it is split, and each pair is split on every
	 * `=`, so a value containing `=` is cut short and a bare `a` (no `=`) maps to
	 * `undefined`.
	 */
	get_args_dict_from_url(txt: string): Record<string, string | undefined>;

	/** `utils.js:473-479`. Inverse of the above; drops `null` values. */
	get_url_from_dict(args: Record<string, unknown>): string;

	/**
	 * `utils.js:481-519`. Regex validation. An unrecognised `type` returns
	 * `false`, and an empty `val` always returns `false`.
	 */
	validate_type(val: string, type: FrappeValidationType | (string & {})): boolean;

	/**
	 * `frappe/public/js/frappe/utils/utils.js:520-560`. Maps a status word onto a
	 * bootstrap style (`default`/`warning`/`danger`/`success`/`info`) or, with
	 * `_colour`, onto a colour name (`gray`/`amber`/`red`/`green`/`blue`). The
	 * warning colour is **`amber`** now (`:527`); it was `orange`.
	 */
	guess_style(text: string | null | undefined, default_style?: string | null, _colour?: boolean): string;

	/** `frappe/public/js/frappe/utils/utils.js:562-564`. `guess_style(text, null, true)`. */
	guess_colour(text: string | null | undefined): string;

	/**
	 * `frappe/public/js/frappe/utils/utils.js:566-584`. Async — reads the `Workflow
	 * State`'s `style` and maps it to a colour: Success → `green`, Warning →
	 * **`amber`** (it was `orange`), Danger → `red`, Primary → `blue`
	 * (`:575-580`). A state with no `style` is guessed from its name with
	 * {@link FrappeUtils.guess_colour}; any other style yields `undefined`.
	 */
	get_indicator_color(state: string): Promise<string | undefined>;

	/** `utils.js:853-868`. Plays `#sound-<name>`; silent for muted users. */
	play_sound(name: string): void;

	/** `utils.js:870-885`. Splits on commas/newlines outside quotes. */
	split_emails(txt: string | null | undefined): string[];

	/** `utils.js:887-894`. Evaluated once at module load, not a function. */
	supportsES6: boolean;

	/**
	 * `utils.js:895-927`. Underscore-style throttle. The wrapper returns the
	 * last result, which is `undefined` until `func` has run at least once.
	 */
	throttle<TArgs extends unknown[], TResult>(
		func: (...args: TArgs) => TResult,
		wait: number,
		options?: { leading?: boolean; trailing?: boolean }
	): (...args: TArgs) => TResult | undefined;

	/** `utils.js:928-963`. Underscore-style debounce plus `cancel`/`flush`. */
	debounce<TArgs extends unknown[]>(
		func: (...args: TArgs) => void,
		wait: number,
		immediate?: boolean
	): FrappeDebouncedFunction<TArgs>;

	/** `utils.js:1021-1074`. Wires a `[data-element="search"]` box over `el_class` rows. */
	setup_search(
		$wrapper: JQuery<HTMLElement>,
		el_class: string,
		text_class: string,
		data_attr?: string
	): void;

	/** `utils.js:1076-1088`. Counts `start`→`end` into `$element`, 1 Hz. */
	setup_timer(start: number, end: number, $element: JQuery<HTMLElement>): void;

	/** `utils.js:1122-1139`. Uses the async clipboard API when available. */
	copy_to_clipboard(string: string, message?: string): void;

	/**
	 * `utils.js:1141-1143`. `["ar","he","fa","ps"]` membership test.
	 * Falls back to `frappe.boot.lang` when `lang` is omitted or `null`.
	 */
	is_rtl(lang?: string | null): boolean;

	/**
	 * `utils.js:1144-1156`. Delegates `click.class_actions` on `$el` so that
	 * `[data-action="method_name"]` invokes `object.method_name(event, $target)`.
	 * Unbinds the previous namespaced handler first, and returns `$el`
	 * unchanged.
	 *
	 * Used by frappe's own Grid at `frappe/public/js/frappe/form/grid.js:178`
	 * as `frappe.utils.bind_actions_with_object(this.wrapper, this)`.
	 */
	bind_actions_with_object<TEl extends JQuery<HTMLElement> | HTMLElement | string>(
		$el: TEl,
		object: object
	): TEl;

	/**
	 * `utils.js:1158-1194`. Compiles `code` (an `eval:`-prefixed expression is
	 * accepted) into `new Function(...names, "let out = <code>; return out")`
	 * with `context`'s keys as parameters, caching expressions under 500 chars.
	 * Rethrows both compile and run errors.
	 */
	eval(code: string, context?: Record<string, unknown>): unknown;

	/** `utils.js:1196-1219`. */
	get_browser(): FrappeBrowserInfo;

	/** `utils.js:1221-1249`. e.g. `"2d 3h 5m"`; `""` for a falsy value. */
	get_formatted_duration(value: number | null | undefined, duration_options?: FrappeDurationOptions | null): string;

	/** `utils.js:1251-1257`. Groups an IBAN in fours (skipped for BI/SV/EG/LY). */
	get_formatted_iban(value: string): string;

	/** `utils.js:1259-1279`. Truncates toward zero for negative inputs. */
	seconds_to_duration(seconds: number, duration_options?: FrappeDurationOptions | null): FrappeDurationParts;

	/** `utils.js:1281-1296`. */
	duration_to_seconds(days?: number, hours?: number, minutes?: number, seconds?: number): number;

	/**
	 * `utils.js:1298-1303`. Projects a Duration DocField's flags. Typed
	 * structurally so a full `DocField` (from `frappe-model-meta`) is
	 * assignable without this fragment depending on it.
	 */
	get_duration_options(docfield: { hide_days?: 0 | 1; hide_seconds?: 0 | 1 }): FrappeDurationOptions;

	/**
	 * `utils.js:1305-1313`. Indian ladder for BD/IN/MM/PK, Nepalese for Nepal,
	 * T/B/M/K otherwise.
	 */
	get_number_system(country?: string): FrappeNumberSystemUnit[];

	/** `utils.js:1315-1348`. Leaflet defaults; a data bag, not a function. */
	map_defaults: FrappeMapDefaults;

	/**
	 * `frappe/public/js/frappe/utils/utils.js:1409-1470`. Resolves a Desktop Icon
	 * row to a desk route: `link` for `External`, else the route of the first
	 * `type === "Link"` item of the module sidebar found by
	 * `sidebar_for_module(icon.module || icon.label)` (`:1416-1420`; it used to
	 * look `label.toLowerCase()` up in `frappe.boot.workspace_sidebar_item`).
	 * `undefined` for a missing icon, a folder icon or a sidebar with no Link
	 * item. A Report link whose report was deleted (no `report` payload) is now
	 * routed without the `is_query_report` / `report_ref_doctype` arguments
	 * (`:1428-1435`).
	 */
	get_route_for_icon(desktop_icon: FrappeDesktopIconRecord | null | undefined): string | undefined;

	/**
	 * `frappe/public/js/frappe/utils/utils.js:1349-1372`. Letter-avatar HTML for a
	 * workspace/app tile: an `.icon-container` div wrapping the `#<LETTER>`
	 * alphabet sprite, tinted from {@link FrappeUtils.desktop_pallete}.
	 *
	 * `style` (new, fourth parameter) overrides `frappe.boot.desktop_icon_style` for
	 * callers that always want one look; only `"Solid"` changes anything
	 * (`:1363-1368` — `(style || frappe.boot.desktop_icon_style) == "Solid"`).
	 * `color` indexes the palette (`blue` when omitted); a name the palette does
	 * not have yields a background of `"undefined1A"`.
	 */
	desktop_icon(label: string, color?: string | null, size?: string, style?: "Subtle" | "Solid"): string;

	/**
	 * `frappe/public/js/frappe/utils/utils.js:1379-1391`. An app's mark and name,
	 * or `null` when `app` is falsy. The icon is the app's logo as an `<img>`
	 * (`app_logo_url` may be a list; the first entry is used) or, when the app
	 * declares none, the letter icon `desktop_icon(title, "gray", "sm")`. `title`
	 * is `app.app_title || app.app_name`.
	 */
	app_logo(app: FrappeAppLogoSource | null | undefined): { icon: string; title: string } | null;

	/**
	 * `frappe/public/js/frappe/utils/utils.js:1400-1404`. The boot entry for a
	 * module's own shell: `frappe.boot.module_sidebars[module]`, else the entry
	 * whose `module` equals it (a renamed `Sidebar`). `undefined` when `module` is
	 * falsy or nothing matches.
	 */
	sidebar_for_module(module: string | null | undefined): FrappeModuleSidebarShell | undefined;

	/** `frappe/public/js/frappe/utils/utils.js:1501-1504`. Only `blue` and `gray` ship; indexed by colour name. */
	desktop_pallete: { blue: string; gray: string; [color: string]: string | undefined };

	/**
	 * Renders one of frappe's sprite icons as an HTML **string**.
	 *
	 * `frappe/public/js/frappe/utils/utils.js:1505-1543`. Behaviour:
	 * - an emoji `icon_name` returns `<span>${icon_name}</span>` (`:1514-1516`);
	 * - a name starting with `es-` resolves to the espresso sprite (`href="#<name>"`)
	 *   with the class `es-icon es-line`; anything else resolves to the
	 *   `#icon-<name>` sprite with the class `icon` (`:1518-1520,1526-1532`).
	 *   The sprite names are the desk's own, so `icon_name` stays an open `string`;
	 * - the `es-icon es-solid` class in the source is **unreachable**: it is
	 *   chosen by `icon_name.startsWith("es-solid")` (`:1528`), but `icon_name`
	 *   has already been rewritten to `"#es-..."` (`:1520`), so every espresso
	 *   icon, solid or not, gets `es-icon es-line`;
	 * - an **object** `size` is inlined as `width`/`height` appended to `style`
	 *   instead of adding an `icon-<size>` class (`:1521-1525`);
	 * - `current_color` adds `stroke="currentColor"` to the `<svg>`, and
	 *   `stroke_color` a `stroke` attribute on both the `<svg>` and the `<use>`
	 *   (`:1533-1537`).
	 *
	 * Always returns a string, so it is safe to interpolate into a template
	 * literal or assign to `innerHTML`. Never returns a Node.
	 */
	icon(
		icon_name: string,
		size?: FrappeIconSize,
		icon_class?: string,
		icon_style?: string,
		svg_class?: string,
		current_color?: boolean,
		stroke_color?: string | null
	): string;

	/** `frappe/public/js/frappe/utils/utils.js:1545-1547`. `<img>` from flagcdn.com for an ISO country code. */
	flag(country_code: string): string;

	/** `utils.js:1549-1551`. `\p{Extended_Pictographic}` test (with ZWJ sequences). */
	is_emoji(str: string): boolean;

	/** `utils.js:1553-1567`. Every code point in eight emoji blocks. */
	get_emojis(): string[];

	/**
	 * `frappe/public/js/frappe/utils/utils.js:1472-1486`. Path to an app-supplied
	 * desktop icon SVG, or `false` when the app has none for that variant (or the
	 * icon has no `app`). **The falsy branch is `false`, not `null`.** Throws when
	 * `frappe.boot.desktop_icons` is absent (see {@link FrappeDesktopIconRecord}).
	 */
	get_desktop_icon(icon_name: string, variant: string): string | false;

	/** `frappe/public/js/frappe/utils/utils.js:1569-1573`. */
	desktop_icon_exists(app_name: string, url: string): boolean;

	/**
	 * `frappe/public/js/frappe/utils/utils.js:1488-1499`. Searches
	 * `frappe.boot.desktop_icons` (only present on the Desktop Icons page mode —
	 * see {@link FrappeDesktopIconRecord}).
	 */
	get_desktop_icon_by_label(title: string, filters?: Record<string, unknown>): FrappeDesktopIconRecord | undefined;

	/**
	 * `frappe/public/js/frappe/utils/utils.js:1575-1600`. Merges `custom_options`
	 * over frappe's defaults (`type: "bar"`, `axisOptions.xIsSeries` …) and
	 * constructs a `frappe.Chart`.
	 *
	 * **`colors`:** frappe no longer hard-codes `["light-blue"]`. When
	 * `custom_options.colors` is absent or empty the chart is given
	 * {@link FrappeUtils.get_chart_palette} instead (`:1576-1579`), i.e. the
	 * Espresso palette resolved against the current theme.
	 *
	 * Options are typed as an open record because the merge is a
	 * `for...in` over arbitrary keys with a one-level `Object.assign` for
	 * object-valued keys — there is no closed option set at this layer.
	 */
	make_chart(
		wrapper: string | HTMLElement | JQuery<HTMLElement>,
		custom_options?: Record<string, unknown>
	): FrappeBaseChart;

	/**
	 * `frappe/public/js/frappe/utils/utils.js:1604-1609`. Espresso's chart colours
	 * (`CHART_PALETTE`, `frappe/public/js/frappe/ui/components/utils.js:97`) as the
	 * **current theme** defines them: each `var(--x)` entry is replaced by
	 * `getComputedStyle(document.documentElement).getPropertyValue("--x")`, because
	 * frappe-charts lightens and blends colours from their literal values, which a
	 * CSS variable does not give it. An entry whose property is unset keeps its
	 * `var(--x)` text. Read at call time, so it does not follow a later theme flip.
	 */
	get_chart_palette(): string[];

	/** `frappe/public/js/frappe/utils/utils.js:1611-1614`. `shorten_number(label, country, 3)`. */
	format_chart_axis_number(label: number | string, country?: string): string;

	/**
	 * `frappe/public/js/frappe/utils/utils.js:1615-1619`. **Mutates** `chart_args`, setting
	 * `axisOptions.seriesLabelSpaceRatio = 0.9` for >10 labels. Throws if
	 * `chart_args.data.labels` is absent.
	 */
	set_space_label_ratio(chart_args: {
		data: { labels: readonly unknown[] };
		axisOptions: Record<string, unknown>;
		[key: string]: unknown;
	}): void;

	/**
	 * `frappe/public/js/frappe/utils/utils.js:1620-1718`. Builds a `/desk/...` route
	 * from a sidebar/shortcut item. It writes **no shell segment**: the result is
	 * always `/desk/<route>`, and `frappe.router` adds the shell when it routes
	 * there (see {@link FrappeRouterBase.write_shell_into_url}).
	 */
	generate_route(item: FrappeGenerateRouteItem): string;

	/**
	 * `frappe/public/js/frappe/utils/utils.js:1720-1766`. `"1.2 M"`-style
	 * abbreviation. Returns `""` for `null`, `undefined`, blank or NaN input
	 * (`is_null(number) || isNaN(number)`, `:1730`; `0` is therefore **not**
	 * blanked any more and comes back as `"0"`), and the plain number string when
	 * it is shorter than `min_length` digits.
	 */
	shorten_number(
		number: number | string | null | undefined,
		country?: string,
		min_length?: number,
		max_no_of_decimals?: number
	): string;

	/** `frappe/public/js/frappe/utils/utils.js:1768-1771`. */
	get_number_of_decimals(number: number): number;

	/** `frappe/public/js/frappe/utils/utils.js:1773-1799`. Renders a report/dashboard summary chip. */
	build_summary_item(summary: FrappeSummaryItem): JQuery<HTMLElement>;

	/** `utils.js:1801-1823`. Opens `/printview` in a popup. */
	print(doctype: string, docname: string, print_format?: string, letterhead?: string, lang_code?: string): void;

	/** `utils.js:1825-1830`. Plain-text payload of a paste event. */
	get_clipboard_data(
		clipboard_paste_event: ClipboardEvent | { clipboardData?: DataTransfer | null; originalEvent?: ClipboardEvent }
	): string;

	/** `utils.js:1832-1843`. Appends (or prepends) a `<button>` into `wrapper`. */
	add_custom_button(
		html: string,
		action: ((event: JQueryEventLike) => void) | null,
		class_name?: string,
		title?: string,
		btn_type?: string,
		wrapper?: JQuery<HTMLElement>,
		prepend?: boolean
	): void;

	/**
	 * `frappe/public/js/frappe/utils/utils.js:1845-1904`. Split button whose primary
	 * action follows the selection. `btn_type` is spliced into the class list
	 * (`btn ${btn_type} btn-sm`), so it is a bootstrap class such as `"btn-primary"`.
	 */
	add_select_group_button(
		wrapper: JQuery<HTMLElement>,
		actions: readonly FrappeSelectGroupAction[],
		btn_type?: string,
		icon?: string,
		prepend?: boolean
	): JQuery<HTMLElement>;

	/** `utils.js:1906-1908`. `setTimeout` as a promise. */
	sleep(time: number): Promise<void>;

	/** `utils.js:1930-1936`. Reads frappe's `_link_titles` cache. */
	get_link_title(doctype: string, name: string): string | undefined;

	/** `utils.js:1938-1949`. Writes the cache. */
	add_link_title(doctype: string, name: string, value: string): void;

	/**
	 * `utils.js:1951-1965`. Server round-trip that populates the cache.
	 * Returns `undefined` (not a rejected promise) for a missing argument.
	 */
	fetch_link_title(doctype: string, name: string): Promise<string> | undefined;

	/** `utils.js:1967-1978`. Restricts an `<input>` to digits, `.` and `-`. */
	only_allow_num_decimal(input: JQuery<HTMLElement>): void;

	/**
	 * `utils.js:1980-1998`. `t/true/y/yes/1` → `true`, `f/false/n/no/0` →
	 * `false`, **anything else returns the original string**.
	 */
	string_to_boolean(string: string): boolean | string;

	/** `utils.js:2000-2011`. `[[dt, field, op, value], …]` → JSON `{field: [op, value]}`. */
	get_filter_as_json(filters: readonly (readonly unknown[])[]): string | null;

	/**
	 * `utils.js:2013-2016`. Evaluates `filter` with `new Function` — a filter
	 * expression string is executed, not parsed.
	 */
	process_filter_expression(filter: string | null | undefined): unknown[];

	/** `utils.js:2018-2024`. Drops a trailing 5-element legacy filter row. */
	cleanup_filters(filters: unknown[]): unknown[];

	/**
	 * `utils.js:2025-2074`. Two shapes, selected by `doctype`:
	 * with a `doctype` it returns `[doctype, field, op, value, false][]`;
	 * without one it returns a `{ field: [op, value][] }` map. Returns
	 * `undefined` for a falsy `filter_json`.
	 */
	get_filter_from_json(
		filter_json: string | null | undefined,
		doctype?: string
	): unknown[] | Record<string, unknown> | undefined;

	/** `utils.js:2076-2078`. `frappe.require("video_player.bundle.js")`. */
	load_video_player(): Promise<unknown>;

	/** `utils.js:2080-2082`. `user === frappe.session.user`. */
	is_current_user(user: string): boolean;

	/** `utils.js:2084-2103`. Development aid — installs a property setter trap. */
	debug: {
		/** `utils.js:2085-2102`. Shadows `prop` behind `$_<prop>_$`; not reversible. */
		watch_property(obj: Record<string, unknown>, prop: string, callback?: () => void): void;
	};

	/** `utils.js:2105-2198`. Opens the UTM tracking-URL prompt. */
	generate_tracking_url(): void;

	/**
	 * `frappe/public/js/frappe/utils/utils.js:2200-2207`. `true` for `""`, `null`, `undefined`, `{}`, `[]`;
	 * `false` for `0`, `1`, `"hello"`, `{a:1}`, `[1]`.
	 */
	is_empty(value: unknown): boolean;

	/** `frappe/public/js/frappe/utils/utils.js:2215-2222`. **Mutates** `obj`, replacing password-ish values with `*****`. */
	mask_passwords(obj: Record<string, unknown>): void;

	/** `frappe/public/js/frappe/utils/utils.js:2241-2247`. Lazily loads highlight.js and marks up every `<pre>`. */
	highlight_pre($wrapper: JQuery<HTMLElement>): void;

	/**
	 * `frappe/public/js/frappe/utils/utils.js:2253-2258`. `true` unless the
	 * `only_allow_system_managers_to_upload_public_files` default is enabled
	 * (`frappe.defaults.is_enabled(...)`, `:2254`), in which case only
	 * `System Manager` / `Administrator` may.
	 */
	can_upload_public_files(): boolean;

	/** `utils.js:2260-2284`. Navbar Help dropdown entries. */
	get_help_siblings(): FrappeHelpDropdownItem[];

	/** `utils.js:2286-2300`. Route-scoped help links from `frappe.help.help_links`. */
	get_custom_help_links(): unknown[];

	/**
	 * `utils.js:2302-2323`. If `value` is a string of digits and arithmetic
	 * operators it is `eval`'d; otherwise `value` is returned unchanged.
	 */
	eval_expression(value: unknown, number_format?: string): unknown;

	/** `utils.js:2325-2329`. `frappe.boot.app_data.map(a => a.app_name)`. */
	get_installed_apps(): string[];

	// ------------------------------------------------ query_string.js

	/** `query_string.js:3-5`. Named param of the current URL, `""` when absent. */
	get_url_arg(name: string): string;

	/** `query_string.js:7-13`. Everything after the first `?`. */
	get_query_string(url: string): string;

	/**
	 * `query_string.js:15-51`. Defaults to `location.search`. A key that
	 * repeats collapses into an array, so the value type is a union.
	 */
	get_query_params(query_string?: string): Record<string, string | string[] | undefined>;

	/**
	 * `query_string.js:53-71`. Serialises to `?a=1&b=2`, JSON-encoding object
	 * values and skipping `undefined`/`""`/`null`. Always starts with `?`,
	 * even for an empty object.
	 */
	make_query_string(obj: Record<string, unknown>, encode?: boolean): string;

	// ---------------------------------------------------------- common.js

	/** `utils/common.js:291-325`. Strips `<script>`/alert-ish calls and escapes HTML. */
	xss_sanitise(string: string, options?: { strategies?: ReadonlyArray<"html" | "js"> }): string;

	/**
	 * `utils/common.js:327-346`. `""` for a cross-origin or unparseable URL;
	 * a falsy input is **passed through unchanged** so callers' fallbacks work.
	 */
	sanitise_redirect(url: string): string;

	/** `utils/common.js:348-353`. Trims junk before a protocol, `//` or `#`. */
	strip_url(url: string): string;

	/**
	 * `utils/common.js:355-410`. Opens the Auto Repeat prompt for a form.
	 * `frm` is a `frappe.ui.form.Form` (declared by `frappe-ui-form`); left
	 * open here so this fragment does not fix that group's export name.
	 */
	new_auto_repeat_prompt(frm: object): void;

	/**
	 * `utils/common.js:412-416`. `frappe.call` wrapper; resolves with the
	 * standard `{ message }` envelope.
	 */
	get_page_view_count(route: string): Promise<{ message?: number }>;

	// ------------------------------------------------------- event_emitter.js

	/**
	 * Mixes the jQuery-backed event emitter into `object` **in place** and
	 * returns the same object (`event_emitter.js:31-34`).
	 *
	 * This is how `frappe.router` acquires `on`/`off`/`once`/`trigger`
	 * (`router.js:1052`), so a static declaration has to model the router as
	 * already carrying them — see {@link FrappeRouter}.
	 *
	 * The mixin's members are `init`, `trigger`, `once`, `on`, `off` — there is
	 * **no** `one`.
	 */
	make_event_emitter<T extends object>(object: T): T & FrappeEventEmitter;

	// ------------------------------------------------------- sub-namespaces

	/** `utils/datatable.js:1`. */
	datatable: FrappeUtilsDataTable;

	/** `logtypes.js:6`. */
	logtypes: FrappeUtilsLogTypes;
}

// ===========================================================================
// SECTION 2 — the jQuery-backed event emitter mixin
// ===========================================================================

/**
 * `EventEmitterMixin` from `frappe/public/js/frappe/event_emitter.js:5-29`.
 *
 * Backed by a detached jQuery object (`jQuery({})`), so events are jQuery
 * events, not `EventTarget` events, and `trigger` carries exactly **one**
 * payload argument.
 *
 * The module also `export default`s the raw mixin object, which the
 * `deep-module-imports` group covers.
 */
export interface FrappeEventEmitter {
	/**
	 * The detached jQuery object every handler is bound to.
	 * `event_emitter.js:6-8` — created lazily by {@link FrappeEventEmitter.init},
	 * so it is absent until the first `on`/`off`/`once`/`trigger`.
	 */
	jq?: JQuery<object>;

	/** `event_emitter.js:6-8`. Called implicitly by the other four members. */
	init(): void;

	/**
	 * `event_emitter.js:10-13`. Fires `evt` with a single payload argument.
	 * `frappe.router` fires `trigger("change", this)` (`router.js:182`), i.e.
	 * the payload is the router itself.
	 */
	trigger(evt: string, data?: unknown): void;

	/**
	 * `event_emitter.js:15-18`. One-shot subscription. Note the name is
	 * `once`, not jQuery's `one`.
	 */
	once(evt: string, handler: (data?: unknown) => void): void;

	/**
	 * `event_emitter.js:20-23`.
	 *
	 * `this.jq.bind(evt, (e, data) => handler(data))` — the handler receives
	 * **one** argument, the payload passed to `trigger`, never the jQuery
	 * event. Handlers that declare no parameters are fine.
	 */
	on(evt: string, handler: (data?: unknown) => void): void;

	/**
	 * `event_emitter.js:25-28`.
	 *
	 * ⚠ Upstream bug: this calls
	 * `this.jq.unbind(evt, (e, data) => handler(data))` — a **freshly
	 * allocated** closure that was never bound — so it removes nothing and
	 * silently no-ops. Do not rely on it to detach a subscription; there is no
	 * working unsubscribe on this mixin (`event_emitter.js` is byte-identical
	 * between v16.33.0 and v16.50.0).
	 */
	off(evt: string, handler: (data?: unknown) => void): void;
}

// ===========================================================================
// SECTION 3 — frappe.dom
// ===========================================================================

/**
 * The `frappe.dom` namespace — `frappe/public/js/frappe/dom.js:7-258`.
 *
 * A plain object literal assigned onto `frappe` after
 * `frappe.provide("frappe.dom")` (`dom.js:5`), so every member exists as soon
 * as `desk.bundle.js` has run.
 */
export interface FrappeDom {
	/** `dom.js:8`. Monotonic counter behind `get_unique_id`/`set_unique_id`. */
	id_count: number;

	/**
	 * Reference count for {@link FrappeDom.freeze}/{@link FrappeDom.unfreeze}.
	 *
	 * `dom.js:9` initialises it to `0`; `freeze()` increments it (`dom.js:172`)
	 * and `unfreeze()` early-returns when it is already `0`, decrements it, and
	 * removes the `#freeze` backdrop only on reaching `0`
	 * (`dom.js:175-179`).
	 *
	 * **Mutable and public**: callers that suppress a backdrop must balance the
	 * count rather than skip the call. carbon_frappe's inline grid form does
	 * exactly this — `frappe.dom.unfreeze()` in `show_form()` and
	 * `frappe.dom.freeze("", "dark grid-form")` in `hide_form()`
	 * (`carbon_frappe/public/js/tables/grid/grid_row.js:236,268`).
	 */
	freeze_count: number;

	/** `dom.js:10-12`. `document.getElementById`. */
	by_id(id: string): HTMLElement | null;

	/** `dom.js:13-17`. `"unique-<n>"`; does not touch the DOM. */
	get_unique_id(): string;

	/** `dom.js:18-27`. Returns the existing `id` if the element already has one. */
	set_unique_id(ele: Element | JQuery<HTMLElement> | string): string;

	/**
	 * `dom.js:28-31`. Runs `txt` through `new Function(txt)()` — a real eval of
	 * server-supplied client script. No-ops on a falsy `txt`, returns nothing.
	 */
	eval(txt: string | null | undefined): void;

	/**
	 * Lazily cached regex, memoised **onto the namespace object itself** at
	 * `dom.js:37-41`. Declared so that reading or clearing it is type-safe;
	 * it is absent until `remove_script_and_style` has run once.
	 */
	unsafe_tags_regex?: RegExp;

	/**
	 * `dom.js:33-74`. Strips `script/style/noscript/title/meta/base/head` and
	 * stylesheet `<link>`s. Returns the input **unchanged** (same reference)
	 * when no unsafe tag is present, which is the common case.
	 */
	remove_script_and_style(txt: string): string;

	/** `dom.js:75-89`. Accepts an element or a jQuery object (`el[0]` is used). */
	is_element_in_viewport(el: Element | JQuery<HTMLElement>, tolerance?: number): boolean;

	/** `dom.js:91-93`. `$(element).parents(".modal").length > 0`. */
	is_element_in_modal(element: Element | JQuery<HTMLElement> | string): boolean;

	/**
	 * `dom.js:95-116`. Appends a `<style>` to `<head>`, replacing an existing
	 * element with the same `id`. Returns `undefined` for a falsy `txt`.
	 */
	set_style(txt: string, id?: string): HTMLStyleElement | undefined;

	/**
	 * `dom.js:117-131`. Low-level element factory.
	 * `parent` may be an element id string. For `newtag === "img"` the third
	 * argument is used as the **src**, not as a class (`dom.js:124`).
	 */
	add(
		parent: string | HTMLElement | null | undefined,
		newtag: string,
		className?: string | null,
		cs?: Partial<CSSStyleDeclaration> | null,
		innerHTML?: string | null,
		onclick?: ((this: GlobalEventHandlers, ev: MouseEvent) => unknown) | null
	): HTMLElement;

	/** `dom.js:132-137`. `$.extend(ele.style, s)`; returns `ele`. */
	css<T extends HTMLElement | null | undefined>(ele: T, s: Partial<CSSStyleDeclaration>): T;

	/** `dom.js:138-141`. Moves `active_class` from siblings onto `$child`. */
	activate(
		$parent: JQuery<HTMLElement>,
		$child: JQuery<HTMLElement>,
		common_class: string,
		active_class?: string
	): void;

	/**
	 * Raises the `#freeze` modal backdrop and **increments**
	 * {@link FrappeDom.freeze_count}.
	 *
	 * `dom.js:142-173`. `msg` is interpolated into
	 * `<p class="lead">` unescaped; `css_class` is a space-separated class list
	 * added to `#freeze` (frappe itself passes e.g. `"dark grid-form"`). Both
	 * are optional — `freeze()` with no arguments renders an empty message.
	 *
	 * Clicking the backdrop toggles `cur_frm.cur_grid` when one is open
	 * (`dom.js:146-151`).
	 */
	freeze(msg?: string, css_class?: string): void;

	/**
	 * Decrements {@link FrappeDom.freeze_count} and removes `#freeze` when it
	 * reaches zero. `dom.js:174-180`.
	 *
	 * Takes no arguments, and **returns early without decrementing** when the
	 * count is already `0`, so an unmatched `unfreeze()` is a silent no-op
	 * rather than an underflow.
	 */
	unfreeze(): void;

	/** `dom.js:181-196`. Snapshot of the current selection, `null` when there is none. */
	save_selection(): Range[] | null;

	/** `dom.js:197-209`. Restores a snapshot from {@link FrappeDom.save_selection}. */
	restore_selection(savedSel: Range[] | null | undefined): void;

	/** `dom.js:210-212`. `"ontouchstart" in window`. */
	is_touchscreen(): boolean;

	/** `dom.js:213-220`. Adds `.no-image` to `<img>`s that fail to load. */
	handle_broken_images(container: Element | JQuery<HTMLElement> | string): void;

	/** `dom.js:221-224`. */
	scroll_to_bottom(container: Element | JQuery<HTMLElement> | string): void;

	/**
	 * `dom.js:225-233`. `FileReader.readAsDataURL` as a promise. The promise
	 * never rejects — a read error simply never resolves. Resolves with the
	 * data-URI string (`FileReader.result` for `readAsDataURL` is always a
	 * string, though lib.dom types it as `string | ArrayBuffer | null`).
	 */
	file_to_base64(file_obj: Blob): Promise<string>;

	/** `dom.js:234-245`. Opens and scrolls to a form section by visible label. */
	scroll_to_section(section_name: string): void;

	/** `dom.js:246-257`. Measures device DPI via a temporary 1in probe div. */
	pixel_to_inches(pixels: number): number;
}

// ===========================================================================
// SECTION 4 — frappe.router
// ===========================================================================

/**
 * The desk view slugs `frappe.router.list_views` ships with
 * (`frappe/public/js/frappe/router.js:81-92`).
 */
export type FrappeListViewSlug =
	| "list"
	| "kanban"
	| "report"
	| "calendar"
	| "tree"
	| "gantt"
	| "dashboard"
	| "image"
	| "inbox"
	| "map";

/**
 * The route "factories" — the first element of a standard route
 * (`frappe/public/js/frappe/router.js:80`). `frappe.views[<TitleCase>Factory]`
 * must exist for the router to dispatch to it
 * (`frappe/public/js/frappe/router.js:450`).
 */
export type FrappeFactoryView = "form" | "list" | "report" | "tree" | "print" | "dashboard";

/**
 * What the first segment of a route names, as decided by
 * {@link FrappeRouterBase.segment_kind}
 * (`frappe/public/js/frappe/router.js:259-284`), in the order the desk tries them:
 *
 * - `"workspace"` — a key of `frappe.workspaces`;
 * - `"private"` — the literal segment `private`;
 * - `"doctype"` — a key of {@link FrappeRouterBase.routes};
 * - `"page"` — a `Page` document in `frappe.boot.page_info`, or one the desk
 *   registers itself in `frappe.standard_pages` (`query-report`);
 * - `"view"` — a standard-route spelling (`List`, `Form`, …) for which
 *   `frappe.views[<TitleCase>Factory]` exists.
 */
export type FrappeRouteSegmentKind = "workspace" | "private" | "doctype" | "page" | "view";

/**
 * An entry of `frappe.router.routes` — built in `setup()` from
 * `frappe.boot.user.can_read` and `frappe.boot.doctype_layouts`
 * (`frappe/public/js/frappe/router.js:119-131`).
 */
export interface FrappeDoctypeRoute {
	doctype: string;
	/** Present only for routes created from a `DocType Layout`. */
	doctype_layout?: string;
}

/**
 * A standard route: the array form frappe passes around internally, e.g.
 * `["Form", "User", "user-001"]` or `["List", "ToDo", "Report"]`.
 * `frappe/public/js/frappe/router.js:194-203` documents the mapping from URL
 * paths. It never carries the shell segment: `parse` takes that off first.
 */
export type FrappeStandardRoute = string[];

/**
 * One of the user's own private workspaces, as `private_workspace()` finds it in
 * `frappe.boot.allowed_workspaces` (`frappe/public/js/frappe/router.js:295-306`).
 * Only the four members that function reads are declared; the rest of the boot
 * row rides on the index signature.
 */
export interface FrappeRouterPrivateWorkspace {
	/** The Workspace docname, `<title>-<user>` for a private page. */
	name: string;
	title: string;
	/** Always falsy here: the lookup filters on `!page.public`. */
	public?: 0 | 1 | boolean;
	/** Always `frappe.session.user` here. */
	for_user?: string;
	[key: string]: unknown;
}

/**
 * The `frappe.router` object literal —
 * `frappe/public/js/frappe/router.js:73-1025`.
 *
 * Everything below is a member of that literal **except** the three
 * runtime-assigned fields (`current_sub_path`, `meta`, `doctype_layout`),
 * which are set during routing and therefore declared optional.
 *
 * The emitter half (`on`/`off`/`once`/`trigger`/`init`/`jq`) is mixed in at
 * `frappe/public/js/frappe/router.js:1052` via
 * `frappe.utils.make_event_emitter(frappe.router)`; see {@link FrappeRouter}.
 *
 * ### The shell segment
 *
 * A desk URL is `/desk/<shell-slug>/<route>`: the first segment may name the
 * **shell** (a key of `frappe.boot.module_sidebars`, i.e. the sidebar the page
 * is shown in). It is part of the address, not of the route: `parse()` takes it
 * off before building the standard route, so {@link FrappeRouterBase.current_route}
 * never contains it, and `route()` writes it back into the address bar with
 * `history.replaceState` when it is missing
 * ({@link FrappeRouterBase.write_shell_into_url}). {@link FrappeRouterBase.current_sub_path}
 * and `window.location` do contain it.
 */
export interface FrappeRouterBase {
	/**
	 * The current standard route, e.g. `["Form", "ToDo", "abc"]`.
	 * `frappe/public/js/frappe/router.js:74` initialises it to `null`; `route()`
	 * assigns it (`frappe/public/js/frappe/router.js:175`) before the first
	 * `"change"` event fires, so any `"change"` handler sees an array.
	 */
	current_route: FrappeStandardRoute | null;

	/** `frappe/public/js/frappe/router.js:75`, populated by {@link FrappeRouterBase.setup}. Keyed by doctype slug. */
	routes: Record<string, FrappeDoctypeRoute | undefined>;

	/**
	 * Shell slug → shell, over the shells this user has
	 * (`frappe/public/js/frappe/router.js:76-78`, filled by
	 * {@link FrappeRouterBase.setup_shell_routes}). The slug is
	 * {@link FrappeRouterBase.shell_slug}, **not** {@link FrappeRouterBase.slug}.
	 * The `private` slug is deliberately removed from it
	 * (`frappe/public/js/frappe/router.js:155`).
	 */
	shell_routes: Record<string, string | undefined>;

	/**
	 * The shell the URL on screen names, or `null` when it names none
	 * (`frappe/public/js/frappe/router.js:79`). Set by
	 * {@link FrappeRouterBase.take_shell_from} while parsing, by
	 * {@link FrappeRouterBase.write_shell_into_url} when it writes one, and to
	 * `frappe.ui.PRIVATE_SHELL` (`"Private"`,
	 * `frappe/public/js/frappe/ui/sidebar/sidebar.js:25`) when `/desk/private/<route>`
	 * is read as the Private shell (`frappe/public/js/frappe/router.js:226`). A shell
	 * is a string key of `frappe.boot.module_sidebars`.
	 */
	current_shell: string | null;

	/** `frappe/public/js/frappe/router.js:80`. See {@link FrappeFactoryView}. */
	factory_views: string[];

	/** `frappe/public/js/frappe/router.js:81-92`. See {@link FrappeListViewSlug}. */
	list_views: string[];

	/**
	 * `frappe/public/js/frappe/router.js:93-106`. Slug → title-cased view name. Note
	 * it carries two keys that are **not** in `list_views`: `file` and `home` (both
	 * → `"Home"`). Lookups are unchecked
	 * (`frappe/public/js/frappe/router.js:372,391,420`), so an unknown slug yields
	 * `undefined` and lands in the route array as such.
	 */
	list_views_route: Record<string, string | undefined>;

	/**
	 * `frappe/public/js/frappe/router.js:107`. Reserved: always `{}`, and nothing
	 * under `frappe/public/js` reads it.
	 */
	layout_mapped: Record<string, unknown>;

	/**
	 * Assigned by `route()` at `frappe/public/js/frappe/router.js:174`: the URL path
	 * after `/desk/` as it stood when the route started (query string excluded,
	 * segments decoded), **shell segment included** when the URL carried one — so
	 * `""` is the desk landing. It is read before `write_shell_into_url` may
	 * rewrite the address bar, so it can lag the URL by one shell segment. Absent
	 * before the first route.
	 */
	current_sub_path?: string;

	/**
	 * Assigned by `set_doctype_route()` at `frappe/public/js/frappe/router.js:346`
	 * from `frappe.get_meta(doctype)`.
	 *
	 * Left `unknown` on purpose: the DocType meta shape is owned by the
	 * `frappe-model-meta` group, and nothing in this slice reads it. Re-point
	 * this at that group's meta type when assembling the package.
	 */
	meta?: unknown;

	/**
	 * Assigned by `set_doctype_route()` at `frappe/public/js/frappe/router.js:379`
	 * (`undefined` for plain doctypes) and **reset to `null`** by
	 * `convert_to_standard_route` for every route that is not a doctype route
	 * (`frappe/public/js/frappe/router.js:245`), so stale layouts do not leak into
	 * workspace and page routes.
	 */
	doctype_layout?: string | null;

	/**
	 * `frappe/public/js/frappe/router.js:109-117`. `true` when the path's first segment is `desk`.
	 * Returns **`undefined`** for an empty path and for a path whose first
	 * segment is empty — it is not a total predicate.
	 */
	is_app_route(path: string | null | undefined): boolean | undefined;

	/**
	 * `frappe/public/js/frappe/router.js:119-133`. Builds `routes` from boot info,
	 * then calls {@link FrappeRouterBase.setup_shell_routes}.
	 */
	setup(): void;

	/**
	 * `frappe/public/js/frappe/router.js:138-156`. Rebuilds {@link FrappeRouterBase.shell_routes}
	 * from the keys of `frappe.boot.module_sidebars` (`{}` when the boot carries
	 * none) and removes the `private` slug from it, because `private` is also the
	 * word that marks one of the user's own pages and the two meanings are told
	 * apart by position.
	 */
	setup_shell_routes(): void;

	/**
	 * `frappe/public/js/frappe/router.js:158-183`. Resolves the URL, renders the
	 * page, sets the title and finally fires `trigger("change", this)`. In order:
	 * parse (which sets `current_route` and `current_shell`),
	 * {@link FrappeRouterBase.respell_private_workspace},
	 * {@link FrappeRouterBase.write_shell_into_url}, `set_history`, `render`,
	 * `set_title`, then `"change"`. Resolves to `undefined` without doing anything
	 * when `frappe.app` does not exist yet, or after a `re_route`.
	 */
	route(): Promise<void>;

	/**
	 * `frappe/public/js/frappe/router.js:185-192`. URL (or `route`) → standard
	 * route. Takes the shell off the front
	 * ({@link FrappeRouterBase.take_shell_from}) and loads
	 * `frappe.route_options` from the query string before converting.
	 */
	parse(route?: string): Promise<FrappeStandardRoute>;

	/**
	 * `frappe/public/js/frappe/router.js:194-248`. Dispatches on
	 * {@link FrappeRouterBase.segment_kind} of the first segment: a workspace
	 * becomes `["Workspaces", <name>]`; `private` becomes `["Workspaces", "private"]`
	 * or `["Workspaces", "private", <name>]` (or, when the second segment is not one
	 * of the user's private pages but names something routable, is re-read as the
	 * Private shell and converted again without its first segment); a doctype goes
	 * to {@link FrappeRouterBase.set_doctype_route}; anything else (a page, a
	 * standard-route spelling, an unknown word) is returned **as given** and left
	 * for `render_page`.
	 */
	convert_to_standard_route(route: string[]): Promise<FrappeStandardRoute>;

	/**
	 * `frappe/public/js/frappe/router.js:259-284`. What the first segment of a route
	 * names, or `null` when the desk has never heard of it (also `null` for a falsy
	 * segment). One list, in the order the desk resolves — workspace first, because
	 * a workspace slug and a doctype slug collide and the workspace has always won.
	 * Shared by {@link FrappeRouterBase.convert_to_standard_route} and
	 * {@link FrappeRouterBase.begins_with_shell} so the two cannot drift.
	 */
	segment_kind(segment: string | null | undefined): FrappeRouteSegmentKind | null;

	/**
	 * `frappe/public/js/frappe/router.js:295-306`. One of this user's own private
	 * pages named by the segment that follows `private` in a URL: matched by title
	 * slug first, then by the full `<title>-<user>` name slug (the old spelling).
	 * `null` when there is none. Slugs here are {@link FrappeRouterBase.slug}.
	 */
	private_workspace(segment: string): FrappeRouterPrivateWorkspace | null;

	/**
	 * `frappe/public/js/frappe/router.js:313-333`. When the route is a private
	 * workspace and the address bar spells its page by the old full name, replaces
	 * that segment with the title slug via `history.replaceState`. Touches only the
	 * page segment, never a shell in front of it.
	 */
	respell_private_workspace(): void;

	/** `frappe/public/js/frappe/router.js:335-338`. */
	doctype_route_exist(route: string): FrappeDoctypeRoute | undefined;

	/** `frappe/public/js/frappe/router.js:340-382`. Loads the doctype meta, then picks Form/List/Tree. */
	set_doctype_route(route: string[]): Promise<FrappeStandardRoute>;

	/**
	 * `frappe/public/js/frappe/router.js:384-428`. May **re-route** as a side effect when
	 * `force_re_route_to_default_view` disagrees with the URL
	 * (`frappe/public/js/frappe/router.js:411-415`).
	 */
	get_standard_route_for_list(
		route: string[],
		doctype_route: FrappeDoctypeRoute,
		default_view: string | null
	): FrappeStandardRoute;

	/**
	 * `frappe/public/js/frappe/router.js:430-433`. Pushes `current_route` onto
	 * `frappe.route_history` and closes any open dialog. Declared with no parameters:
	 * `route()` calls it as `this.set_history(sub_path)`
	 * (`frappe/public/js/frappe/router.js:179`) but the implementation ignores the argument.
	 */
	set_history(): void;

	/** `frappe/public/js/frappe/router.js:435-442`. */
	render(): void;

	/** `frappe/public/js/frappe/router.js:444-465`. Instantiates `frappe.views.<X>Factory` and shows it. */
	render_page(): void;

	/** `frappe/public/js/frappe/router.js:467-484`. `true` when a re-route was performed, else `undefined`. */
	re_route(sub_path: string): true | undefined;

	/** `frappe/public/js/frappe/router.js:486-490`. Restores a remembered title for `sub_path`. */
	set_title(sub_path: string): void;

	/**
	 * `frappe/public/js/frappe/router.js:492-536`. Push-state navigation. Accepts
	 * `set_route("a","b","c")`, `set_route(["a","b","c"])` or
	 * `set_route("a/b/c")` (`frappe/public/js/frappe/router.js:494-497,555-570`); a
	 * plain-object argument becomes `frappe.route_options`
	 * (`frappe/public/js/frappe/router.js:659-667`). A leading `desk`/`app`
	 * segment is dropped, and so is a leading **shell** segment — except that a
	 * route naming a shell other than the one on screen is a move into that shell and
	 * keeps it ({@link FrappeRouterBase.keep_shell_moved_into}). `frappe.route_hash`
	 * is appended once and cleared. `frappe.open_in_new_tab` opens the URL in a tab
	 * instead (with the route options stashed in `localStorage["route_options"]`).
	 *
	 * Resolves ~100 ms later, after `frappe.after_ajax` drains
	 * (`frappe/public/js/frappe/router.js:529-535`); `frappe.route_flags` is reset to
	 * `{}` when it settles.
	 */
	set_route(route: readonly (string | number | Record<string, unknown>)[]): Promise<void>;
	set_route(route: string): Promise<void>;
	set_route(...route: (string | number | Record<string, unknown>)[]): Promise<void>;

	/**
	 * `frappe/public/js/frappe/router.js:543-548`. For a route that named a shell
	 * (taken off by {@link FrappeRouterBase.read_route_arguments}): `path` unchanged
	 * when there is no shell, when it is the shell on screen
	 * ({@link FrappeRouterBase.current_shell}) or when it is the sidebar's
	 * `current_module`; otherwise `path` with the shell slug written back after
	 * `/desk`. `path` is a `/desk/...` path.
	 */
	keep_shell_moved_into(path: string, shell: string | null | undefined): string;

	/**
	 * `frappe/public/js/frappe/router.js:550-552`. The route part of
	 * {@link FrappeRouterBase.read_route_arguments}: normalises the `arguments` array of
	 * `set_route` and drops a leading shell. Elements may be plain objects (route options).
	 */
	get_route_from_arguments(route: unknown[]): (string | Record<string, unknown>)[];

	/**
	 * `frappe/public/js/frappe/router.js:555-609`. Normalises the `arguments` of
	 * `set_route` (`[[...]]`, `["a/b?x=1"]` — whose query string is merged into
	 * `frappe.route_options` — or a flat list), drops a leading `""`, `desk` or `app`,
	 * and takes a leading shell off the route **without adopting it**, handing it back
	 * in `shell` (`null` when there was none). A `Form` route with more than three
	 * entries has its tail re-joined as the docname.
	 */
	read_route_arguments(route: unknown[]): {
		route: (string | Record<string, unknown>)[];
		shell: string | null;
	};

	/** `frappe/public/js/frappe/router.js:611-641`. Standard route → URL segments. */
	convert_from_standard_route(route: readonly (string | Record<string, unknown>)[]): string[];

	/** `frappe/public/js/frappe/router.js:643-652`. Lower-cases a factory view and slugs the doctype. */
	slug_parts(route: string[]): string[];

	/**
	 * `frappe/public/js/frappe/router.js:659-684`. Joins encoded segments into
	 * `/desk/<path>`. A plain-object member is consumed as `frappe.route_options` and
	 * dropped from the path. Always returns `"/desk"` when nothing is left. It
	 * writes **no shell**: `write_shell_into_url` adds it once the route is parsed,
	 * because `set_route` is also handed ready-made paths and `make_url` cannot tell
	 * which segment of one is the entity.
	 */
	make_url(params: readonly (string | number | Record<string, unknown>)[]): string;

	/**
	 * `frappe/public/js/frappe/router.js:694-703`. `history.pushState`/`replaceState`
	 * (chosen by `frappe.route_flags.replace_route`) followed by `route()`. No-ops
	 * when {@link FrappeRouterBase.path_on_screen} equals `path` and
	 * `window.location.search` equals `query_params`.
	 */
	push_state(path: string, query_params?: string): void;

	/**
	 * `frappe/public/js/frappe/router.js:720-727`. The path on screen spelled the way
	 * `make_url` would have spelled it: `window.location.pathname`, minus the shell
	 * segment when {@link FrappeRouterBase.current_shell} is set. Lets `push_state`
	 * tell "somewhere else" from "here, with the shell the router wrote".
	 */
	path_on_screen(): string;

	/** `frappe/public/js/frappe/router.js:729-736`. Defaults to `window.location.pathname`. */
	get_sub_path_string(route?: string): string;

	/** `frappe/public/js/frappe/router.js:738-746`. Removes a leading `/`, `desk/`, `#` or `!`. */
	strip_prefix(route: string): string;

	/** `frappe/public/js/frappe/router.js:748-753`. `strip_prefix` + per-segment `decodeURIComponent`. */
	get_sub_path(route?: string): string;

	/**
	 * `frappe/public/js/frappe/router.js:755-772`. Merges `location.search` (and a stashed
	 * `localStorage["route_options"]`, which it consumes) into
	 * `frappe.route_options`.
	 */
	set_route_options_from_url(): void;

	/** `frappe/public/js/frappe/router.js:774-785`. `decodeURIComponent` that swallows `URIError`. */
	decode_component(r: string): string;

	/** `frappe/public/js/frappe/router.js:787-789`. `name.toLowerCase().replace(/ /g, "-")`. Throws on a nullish name. */
	slug(name: string): string;

	/**
	 * `frappe/public/js/frappe/router.js:800-802`. How a **shell** reaches a URL:
	 * lower-cased, `&` spelled `" and "`, trimmed, whitespace runs → `-` — so
	 * `Shift & Attendance` is `shift-and-attendance`. Deliberately not reversible: a
	 * segment is turned back into a shell by looking it up in
	 * {@link FrappeRouterBase.shell_routes}, never by transforming it. Throws on a
	 * nullish name.
	 */
	shell_slug(name: string): string;

	/**
	 * `frappe/public/js/frappe/router.js:824-832`. Takes a leading shell off a route
	 * and remembers it in {@link FrappeRouterBase.current_shell}; with no leading
	 * shell it sets `current_shell` to `null` and returns `route` itself. The rule is
	 * {@link FrappeRouterBase.begins_with_shell}: `/desk/stock/item` is the Item list
	 * in the Stock shell, `/desk/item/ITEM-0001` is a form.
	 */
	take_shell_from(route: string[]): string[];

	/**
	 * `frappe/public/js/frappe/router.js:837-841`. Whether `route` begins with a
	 * shell segment that may be taken off its front: more than one segment, the
	 * first is a key of {@link FrappeRouterBase.shell_routes}, its own
	 * {@link FrappeRouterBase.segment_kind} is not `"doctype"` (a shell whose slug is
	 * also a doctype slug is never taken off; a workspace of that slug does not
	 * block it), and the second segment names something routable
	 * ({@link FrappeRouterBase.route_names_something}). A one-segment route never
	 * carries a shell.
	 */
	begins_with_shell(route: readonly string[]): boolean;

	/**
	 * `frappe/public/js/frappe/router.js:848-850`. The shell a URL for `route` should
	 * name: delegates to `frappe.app.sidebar.shell_for_route(route)`
	 * (`frappe/public/js/frappe/ui/sidebar/sidebar.js:863`), and answers `null`
	 * before there is a sidebar to ask — the first route of a cold load, or a site
	 * whose setup is not complete.
	 */
	shell_for_route(route: readonly string[]): string | null;

	/**
	 * `frappe/public/js/frappe/router.js:868-914`. Puts the shell into the address
	 * bar when it is missing or names one that cannot show the route:
	 * `/desk/item` becomes `/desk/stock/item`. `history.replaceState`, never
	 * `set_route`, so it pushes no history entry and cannot loop. No segment is
	 * added when the route already begins with its own shell's slug
	 * (`/desk/build` is the Build workspace in the Build shell) or when the shell's
	 * slug is also a doctype slug (the URL would be read back as the doctype)
	 * (`:895-902`); a stale shell already in the URL is still removed, and
	 * `current_shell` becomes `null` (`:875-877,908`). The URL's query string and
	 * hash are kept.
	 */
	write_shell_into_url(): void;

	/**
	 * `frappe/public/js/frappe/router.js:918-920`. `!!segment_kind(segment)`: whether a
	 * segment names something the desk can route to on its own.
	 */
	route_names_something(segment: string | null | undefined): boolean;

	/**
	 * `frappe/public/js/frappe/router.js:922-1024`. Shows the "external link" confirmation dialog when
	 * `frappe.boot.show_external_link_warning` is `"Ask"`/`"Always"`.
	 * Returns `true` when the click should be cancelled. Never throws — the
	 * whole body is wrapped in a try/catch that returns `false`.
	 */
	show_external_link_warning_if_needed(aElement: HTMLAnchorElement | null | undefined): boolean;
}

/**
 * `frappe.router` as it actually exists at runtime: the literal plus the
 * event-emitter mixin applied at `frappe/public/js/frappe/router.js:1052`.
 *
 * The only event frappe itself fires is `"change"`, from `route()`
 * (`frappe/public/js/frappe/router.js:182`), with the router as the payload.
 *
 * Declared with **non-optional** `on`, deliberately: carbon_frappe guards its
 * subscriptions with `typeof frappe.router.on === "function"`
 * (`anatomy/editable_title.ts:80`, `anatomy/ui_shell.ts:287`), and a `typeof`
 * comparison compiles cleanly against an always-defined method. Making `on`
 * optional to satisfy the guard would make that guard load-bearing and force
 * `?.` on every honest caller.
 */
export type FrappeRouter = FrappeRouterBase & FrappeEventEmitter;

// ===========================================================================
// SECTION 5 — the `frappe.ui` members this slice touches
// ===========================================================================
//
// These two belong to a UI group by rights, but the inventory assigned them
// here because `frappe.dom`/`frappe.router` consumers reach them. They are
// declared as narrow, mergeable slices rather than as the whole `frappe.ui`
// namespace, so that whichever group owns `frappe.ui.Page` in full can
// `extends` these instead of colliding with them.

/** A concrete desk theme. `frappe/public/js/frappe/ui/theme_switcher.js:178-181`. */
export type DeskTheme = "light" | "dark";

/**
 * The value of `data-theme-mode` on `<html>`.
 * `frappe/public/js/frappe/ui/theme_switcher.js:49,149,176` — `"automatic"` resolves
 * to light/dark via `prefers-color-scheme` at `set_theme` time.
 */
export type DeskThemeMode = "light" | "dark" | "automatic";

/**
 * The theme slice of `frappe.ui` — `frappe/public/js/frappe/ui/theme_switcher.js:166-187`.
 */
export interface FrappeUiThemeSlice {
	/** `frappe/public/js/frappe/ui/theme_switcher.js:172`. `window.matchMedia("(prefers-color-scheme: dark)")`. */
	dark_theme_media_query: MediaQueryList;

	/** `frappe/public/js/frappe/ui/theme_switcher.js:166-170`. Re-runs `set_theme()` when the OS theme flips. */
	add_system_theme_switch_listener(): void;

	/**
	 * Writes `data-theme` on `document.documentElement`.
	 *
	 * `frappe/public/js/frappe/ui/theme_switcher.js:174-183`. **It emits no event and
	 * publishes nothing over realtime** — an attribute write is the entire notification
	 * mechanism, which is why carbon_frappe observes the attribute with a
	 * `MutationObserver` (`public/js/carbon_charts.bundle.js:152-158`).
	 *
	 * Calling it with no argument resolves the theme from `data-theme-mode`;
	 * if that attribute is absent the value written is the string `"null"`
	 * (`root.setAttribute("data-theme", theme || theme_mode)` with both
	 * nullish), so readers must tolerate a non-theme string.
	 */
	set_theme(theme?: DeskTheme | (string & {}) | null): void;

	/** `frappe/public/js/frappe/ui/theme_switcher.js:185-187`. Reads the attribute back; `null` before any write. */
	get_current_theme(): DeskTheme | (string & {}) | null;
}

/**
 * The jQuery regions a `frappe.ui.Page` exposes, assigned in one block in
 * `setup_page()` at `frappe/public/js/frappe/ui/page.js:150-183` (the template they
 * are found in is `frappe/public/js/frappe/ui/page.html`).
 *
 * Declared as a standalone interface so the group that owns the full
 * `frappe.ui.Page` class can write `declare class Page implements
 * FrappePageRegions` (or `interface Page extends FrappePageRegions`) rather
 * than this fragment re-declaring a ~1,270-line class it does not own.
 *
 * Every member is a jQuery object, **not** an element: consumers call jQuery
 * methods straight on them, e.g.
 * `this.parent.page.main.parent().addClass("list-view")`
 * (`carbon_frappe/public/js/tables/list/list_view.js:204`).
 */
export interface FrappePageRegions {
	/** `frappe/public/js/frappe/ui/page.js:70`. `$(this.parent)` — the page's outermost node. */
	wrapper: JQuery<HTMLElement>;

	/**
	 * `frappe/public/js/frappe/ui/page.js:159`. `.layout-main-section`.
	 * `body` and {@link FrappePageRegions.main} are assigned in the same
	 * statement and are the **same jQuery object**, not two views of it.
	 */
	body: JQueryRegion;

	/**
	 * `frappe/public/js/frappe/ui/page.js:159`. Alias of {@link FrappePageRegions.body} — literally the same
	 * jQuery object.
	 *
	 * Both are a {@link JQueryRegion} (gaps.md §6.12). This one is a `find()`,
	 * not a literal template, so it earns the guarantee differently:
	 * `add_main_section()` inserts a `.layout-main-section` div on BOTH of its
	 * branches (`frappe/public/js/frappe/ui/page.js:114-137`) and `setup_page()`
	 * reads it back immediately after (`frappe/public/js/frappe/ui/page.js:147,159`),
	 * so the selector cannot miss. It is the mount point a replacement list/report
	 * renderer attaches to.
	 */
	main: JQueryRegion;

	/** `frappe/public/js/frappe/ui/page.js:160`. `.page-body`. */
	container: JQuery<HTMLElement>;

	/** `frappe/public/js/frappe/ui/page.js:161`. `.layout-side-section`. */
	sidebar: JQuery<HTMLElement>;

	/** `frappe/public/js/frappe/ui/page.js:162`. `.layout-footer`. */
	footer: JQuery<HTMLElement>;

	/**
	 * `frappe/public/js/frappe/ui/page.js:163`. `.title-area .page-indicator-pill` —
	 * the status pill, an `es-badge` (`span.es-badge.page-indicator-pill.hide`,
	 * `frappe/public/js/frappe/ui/page.html:24`), **not** the legacy
	 * `.indicator-pill`. Written by {@link Page.set_indicator} /
	 * {@link Page.clear_indicator}.
	 */
	indicator: JQuery<HTMLElement>;

	/** `frappe/public/js/frappe/ui/page.js:151`. `.title-area`, the flex row holding the breadcrumb `nav` and the pill. */
	$title_area: JQuery<HTMLElement>;

	/**
	 * `frappe/public/js/frappe/ui/page.js:153`. `this.wrapper.find("h6")`. The page
	 * template (`frappe/public/js/frappe/ui/page.html`) no longer contains an
	 * `<h6>`, so this is an **empty jQuery set** unless the page's own content
	 * supplies one; {@link Page.set_title_sub} writes into it and is therefore a no-op.
	 */
	$sub_title_area: JQuery<HTMLElement>;

	/** `frappe/public/js/frappe/ui/page.js:165`. `.page-actions`. */
	page_actions: JQuery<HTMLElement>;

	/** `frappe/public/js/frappe/ui/page.js:166`. `.filters`. */
	filters: JQuery<HTMLElement>;

	/** `frappe/public/js/frappe/ui/page.js:167`. `.page-head`. */
	page_head: JQuery<HTMLElement>;

	/** `frappe/public/js/frappe/ui/page.js:168`. `.primary-action`, an `es-button` (`frappe/public/js/frappe/ui/page.html:61`). */
	btn_primary: JQuery<HTMLElement>;

	/** `frappe/public/js/frappe/ui/page.js:169`. `.secondary-action`, an `es-button` (`frappe/public/js/frappe/ui/page.html:51`). */
	btn_secondary: JQuery<HTMLElement>;

	/**
	 * `frappe/public/js/frappe/ui/page.js:171`. `.menu-btn-group .dropdown-menu` —
	 * a **hidden item store**, not the visible menu: `add_dropdown_item` keeps writing
	 * `<li><a>` rows here and {@link Page.menu_dropdown} snapshots them into an
	 * espresso menu on every open (`frappe/public/js/frappe/ui/page.html:46-49`).
	 */
	menu: JQuery<HTMLElement>;

	/** `frappe/public/js/frappe/ui/page.js:172`. */
	menu_btn_group: JQuery<HTMLElement>;

	/**
	 * `frappe/public/js/frappe/ui/page.js:174`. `.actions-btn-group .dropdown-menu` —
	 * the hidden item store behind {@link Page.actions_dropdown}, like {@link FrappePageRegions.menu}.
	 */
	actions: JQuery<HTMLElement>;

	/** `frappe/public/js/frappe/ui/page.js:175`. */
	actions_btn_group: JQuery<HTMLElement>;

	/** `frappe/public/js/frappe/ui/page.js:177`. */
	standard_actions: JQuery<HTMLElement>;

	/** `frappe/public/js/frappe/ui/page.js:178`. */
	custom_actions: JQuery<HTMLElement>;

	/** `frappe/public/js/frappe/ui/page.js:179`. */
	custom_mobile_actions: JQuery<HTMLElement>;

	/** `frappe/public/js/frappe/ui/page.js:181`. `.page-form.row.hide`, prepended into `main`. */
	page_form: JQuery<HTMLElement>;

	/** `frappe/public/js/frappe/ui/page.js:182`. Alias of {@link FrappePageRegions.custom_actions}. */
	inner_toolbar: JQuery<HTMLElement>;

	/** `frappe/public/js/frappe/ui/page.js:183`. `.page-icon-group`. */
	icon_group: JQuery<HTMLElement>;
}

/**
 * Constructor options for {@link Page}.
 *
 * `frappe/public/js/frappe/ui/page.js:53` is `$.extend(this, opts)`, so every key
 * lands on the instance verbatim — hence the open index signature. The named
 * members are the ones `page.js` itself reads.
 */
export interface PageOptions {
	/** `frappe/public/js/frappe/ui/page.js:70` — `this.wrapper = $(this.parent)`. Required. */
	parent: HTMLElement | JQuery;
	/** Applied by `setup_page()` via `set_title` (`frappe/public/js/frappe/ui/page.js:155`). */
	title?: string;
	/** `frappe/public/js/frappe/ui/page.js:157` — passed to `get_main_icon()`. */
	icon?: string;
	/** `frappe/public/js/frappe/ui/page.js:114` — picks the single- vs two-column `layout-main` markup. */
	single_column?: boolean;
	/** `frappe/public/js/frappe/ui/page.js:139` — `"Right"` moves `.layout-side-section` after the main section. */
	sidebar_position?: "Left" | "Right";
	/**
	 * `frappe/public/js/frappe/ui/page.js:61` — the constructor only defaults it to
	 * `false` when the key is ABSENT from `opts` (`Object.keys(opts).includes("hide_sidebar")`),
	 * so passing it explicitly (even as `undefined`) is meaningful. On a desktop it
	 * takes the sidebar panel away; on a narrow screen it merely closes the drawer
	 * (`frappe/public/js/frappe/ui/page.js:62-64`).
	 */
	hide_sidebar?: boolean;
	/**
	 * `frappe/public/js/frappe/ui/page.js:65` — hides just the dock while keeping the
	 * body sidebar; independent of `hide_sidebar`. Defaulted to `false` the same way
	 * (only when the key is absent from `opts`).
	 */
	hide_dock?: boolean;
	/**
	 * `frappe/public/js/frappe/ui/page.js:1031` — `false` makes
	 * {@link Page.render_breadcrumbs} draw no trail ("a page inside a dialog has a
	 * head of its own but no business drawing a trail in it"). Not defaulted by the
	 * constructor: absent is treated as "show".
	 */
	show_breadcrumbs?: boolean;
	/** `frappe/public/js/frappe/ui/page.js:109` — handed straight to `frappe.require`. */
	required_libs?: string | string[];
	/** `frappe/public/js/frappe/ui/page.js:185-187` — called at the end of `setup_page()` if present. */
	make_page?(): void;
	/** `$.extend(this, opts)` (`frappe/public/js/frappe/ui/page.js:53`) copies anything else onto the instance. */
	[option: string]: unknown;
}

/**
 * One crumb of a page's breadcrumb trail — the espresso `BreadcrumbItem`
 * (`frappe/public/js/frappe/ui/components/breadcrumbs.js:6-12`), which
 * {@link Page.set_breadcrumbs} hands to `frappe.ui.breadcrumbs`.
 *
 * Which element a crumb renders as depends on its members
 * (`frappe/public/js/frappe/ui/components/breadcrumbs.js:76-80`): `href` → an `<a>`,
 * `onclick` → a `<button>`, neither → a `<span>` (plain text). All three are
 * `.es-breadcrumbs__item`. The last crumb is the current page.
 */
export interface PageBreadcrumbItem {
	/** HTML-escaped text of the crumb. */
	label?: string;
	/** Renders the crumb as a link. */
	href?: string;
	/**
	 * Click handler (`frappe/public/js/frappe/ui/components/breadcrumbs.js:96-104`,
	 * bound with jQuery `.on("click", …)`). Only wired on the element form, which is
	 * what the page uses.
	 */
	onclick?: (event: JQueryEventLike) => unknown;
	/** A sprite icon name shown before the label. */
	prefix?: string;
	/** A sprite icon name shown after the label. */
	suffix?: string;
	/** Tooltip; becomes the `aria-label` of a crumb that has no label. */
	title?: string;
}

/**
 * The part of an espresso `frappe.ui.Dropdown`
 * (`frappe/public/js/frappe/ui/components/dropdown.js:39-164`) that
 * {@link Page} itself calls on the instances it holds: `menu_dropdown`,
 * `actions_dropdown` and the per-group dropdowns it closes on page switch.
 * The class has more (`open`, `toggle`, `set_options`, `$trigger`, …); it is not
 * declared in full because nothing this package targets constructs one.
 */
export interface PageEsDropdown {
	/** `frappe/public/js/frappe/ui/components/dropdown.js:110-112`. Whether the menu is open. */
	readonly is_open: boolean;
	/**
	 * `frappe/public/js/frappe/ui/components/dropdown.js:144-146`. Closes the menu;
	 * `reason` defaults to `"owner"` and is what `on_close` receives.
	 */
	close(reason?: "activate" | "escape" | "outside" | "tab" | "navigate" | "owner"): void;
	/** `frappe/public/js/frappe/ui/components/dropdown.js:157-163`. Closes the menu and unbinds the trigger. */
	destroy(): void;
}

/**
 * `frappe.ui.Page` — `frappe/public/js/frappe/ui/page.js:51`
 * (`frappe.ui.Page = class Page { … }`, a class EXPRESSION, so this declaration
 * is the only way to name the type).
 *
 * SEAM NOTE — `Page` was imported by `views.d.ts` and `ui/form.d.ts` from
 * `./core`, and by the draft `global.d.ts` from `./utils`, but declared by NO
 * fragment (TS2305 x3). This fragment won ownership because it already owns
 * {@link FrappePageRegions} — the 24 jQuery regions `setup_page()` assigns —
 * and its doc comment explicitly reserved the class for whoever owns them
 * ("the group that owns the full `frappe.ui.Page` class can write
 * `declare class Page implements FrappePageRegions`"). The regions are attached
 * by the merged interface below rather than by `implements`, so this
 * declaration does not have to restate all 24.
 *
 * Everything here is read out of `page.js`; citations are
 * `frappe/public/js/frappe/ui/page.js:line`.
 *
 * ### What the page head is built from
 *
 * The head is no longer bootstrap markup. `page.html` renders the trail as
 * `nav.es-breadcrumbs.navbar-breadcrumbs > ol > li > (a|button|span).es-breadcrumbs__item`,
 * the status pill as `span.es-badge.page-indicator-pill.hide[data-theme=<colour>]`
 * inside `.title-area`, and the primary / secondary / "Actions" / "Menu" controls
 * as `es-button`s. The Menu and Actions dropdowns are `frappe.ui.Dropdown`s whose
 * rows are snapshotted from hidden `<ul>` item stores on every open — see
 * {@link FrappePageRegions.menu} — so the old jQuery contract (hold the returned
 * `<a>`, mutate it later) keeps working.
 */
export declare class Page {
	constructor(opts: PageOptions);

	// ---- merged from opts (page.js:53) ----

	/** `frappe/public/js/frappe/ui/page.js:70` — the element the page template is appended to. */
	parent: HTMLElement | JQuery;
	/** See {@link PageOptions.single_column}. */
	single_column?: boolean;
	/** See {@link PageOptions.sidebar_position}. */
	sidebar_position?: "Left" | "Right";
	/** See {@link PageOptions.required_libs}. */
	required_libs?: string | string[];
	/** `frappe/public/js/frappe/ui/page.js:185-187`. App-supplied; called once from `setup_page()`. */
	make_page?(): void;
	/** See {@link PageOptions.show_breadcrumbs}. */
	show_breadcrumbs?: boolean;

	// ---- set in the constructor (page.js:55-66) ----

	/** `frappe/public/js/frappe/ui/page.js:55`. Always `true`; consulted by `frappe.utils.set_title` callers. */
	set_document_title: boolean;
	/** `frappe/public/js/frappe/ui/page.js:56`. Reserved by the constructor; `page.js` itself never writes to it. */
	buttons: Record<string, JQuery<HTMLElement> | undefined>;
	/**
	 * `frappe/public/js/frappe/ui/page.js:57`, populated by `add_field`
	 * (`frappe/public/js/frappe/ui/page.js:1220`) keyed by
	 * `df.fieldname || df.label`. The values are `frappe.ui.form.make_control`
	 * results.
	 */
	fields_dict: Record<string, PageControl | undefined>;
	/** `frappe/public/js/frappe/ui/page.js:58`, populated by `add_view` (`frappe/public/js/frappe/ui/page.js:1251`). */
	views: Record<string, JQuery<HTMLElement> | undefined>;
	/**
	 * `frappe/public/js/frappe/ui/page.js:61` — `false` unless `opts` carried the key.
	 * Not optional: the constructor always ends up assigning it one way or the other.
	 */
	hide_sidebar: boolean;
	/**
	 * `frappe/public/js/frappe/ui/page.js:65` — `false` unless `opts` carried the key;
	 * see {@link PageOptions.hide_dock}. Not optional, for the same reason as
	 * {@link Page.hide_sidebar}.
	 */
	hide_dock: boolean;

	// ---- set later ----

	/** The stripped title, written by `set_title` (`frappe/public/js/frappe/ui/page.js:1042`). */
	title?: string;
	/** `frappe/public/js/frappe/ui/page.js:233-250` — the "Navigate to main content" skip link, appended to `sidebar`. */
	skip_link_to_main: JQuery<HTMLElement>;
	/** The `.dropdown-divider.user-action` lazily created by `add_dropdown_item` (`frappe/public/js/frappe/ui/page.js:600-606`). */
	divider?: JQuery<HTMLElement>;
	/**
	 * `frappe/public/js/frappe/ui/page.js:1252-1253` — the first view added wins;
	 * `set_view` reassigns it (`frappe/public/js/frappe/ui/page.js:1262`).
	 */
	current_view?: JQuery<HTMLElement>;
	/** `frappe/public/js/frappe/ui/page.js:1265`. `undefined` until the first `set_view`. */
	current_view_name?: string;
	/** `frappe/public/js/frappe/ui/page.js:1264`. */
	previous_view_name?: string;
	/**
	 * `frappe/public/js/frappe/ui/page.js:204-208` — the espresso dropdown behind the
	 * Menu button, whose rows are snapshotted from {@link FrappePageRegions.menu}.
	 * Assigned in `setup_page()`, so it exists once the constructor returns.
	 */
	menu_dropdown: PageEsDropdown;
	/**
	 * `frappe/public/js/frappe/ui/page.js:209-213` — the espresso dropdown behind the
	 * Actions button, whose rows are snapshotted from {@link FrappePageRegions.actions}.
	 */
	actions_dropdown: PageEsDropdown;
	/**
	 * `frappe/public/js/frappe/ui/page.js:1005` — the explicit trail written by
	 * {@link Page.set_breadcrumbs}; `set_title` rewrites its last item. Absent until
	 * one of those has run. Read it through {@link Page.get_breadcrumbs}, which also
	 * honours the legacy payload.
	 */
	breadcrumbs?: readonly PageBreadcrumbItem[];
	/**
	 * `frappe/public/js/frappe/ui/page.js:1007` — a payload left by the deprecated
	 * `frappe.breadcrumbs.add()` (`frappe/public/js/frappe/views/breadcrumbs.js:236-238`),
	 * kept **unresolved** and turned into items on every read. `set_breadcrumbs`
	 * clears it, so explicit items win. `frappe.breadcrumbs` is a compatibility
	 * shim, marked for removal in v17.
	 */
	legacy_breadcrumbs?: Record<string, unknown> | null;
	/**
	 * `frappe/public/js/frappe/ui/page.js:1026-1029` — the `<ol>` inside
	 * `.navbar-breadcrumbs`, set by {@link Page.render_breadcrumbs}. The list is
	 * refilled rather than replaced, so a held reference stays good across paints.
	 */
	$breadcrumbs?: JQuery<HTMLElement>;

	// ---- lifecycle ----

	/** `frappe/public/js/frappe/ui/page.js:69-74`. Called by the constructor (`frappe/public/js/frappe/ui/page.js:60`). */
	make(): void;
	/**
	 * `frappe/public/js/frappe/ui/page.js:76-91`. Formerly `setup_mobile_awesomebar`,
	 * and no longer mobile-only: when `frappe.boot.desk_settings.search_bar` is on and
	 * `frappe.app.awesome_bar` does not exist yet, creates a `frappe.search.AwesomeBar`
	 * on `.navbar-modal-search-mobile`, stores it as `frappe.app.awesome_bar`, and
	 * registers "Generate Tracking URL" (and "Background Jobs" for users who can read
	 * `RQ Job`) as searchable functions. Runs once per desk, not once per page.
	 */
	setup_awesomebar(): void;
	/** `frappe/public/js/frappe/ui/page.js:112-148`. Renders the `page` template and the `main` view. */
	add_main_section(): void;
	/**
	 * `frappe/public/js/frappe/ui/page.js:150-251`. Assigns every region in
	 * {@link FrappePageRegions}, builds the Menu and Actions dropdowns, and
	 * registers a page-wrapper `"hide"` handler that closes every dropdown the page
	 * owns (the menus portal to `<body>`, so one left open would float over the next
	 * page).
	 */
	setup_page(): void;
	/** `frappe/public/js/frappe/ui/page.js:287-293`. */
	setup_main_sidebar_toggle(): void;
	/** `frappe/public/js/frappe/ui/page.js:108-110`. `frappe.require(this.required_libs, callback)`. */
	load_lib(callback: () => void): void;
	/** `frappe/public/js/frappe/ui/page.js:93-105`. Returns a detached `.page-card-container`; the caller appends it. */
	get_empty_state(title: string, message: string, primary_action: string): JQuery<HTMLElement>;

	// ---- title / breadcrumbs / indicator ----

	/** `frappe/public/js/frappe/ui/page.js:991-993`. */
	get_title_area(): JQuery<HTMLElement>;
	/**
	 * `frappe/public/js/frappe/ui/page.js:1037-1059`. `strip` runs the title through
	 * `strip_html`; `tab_title` overrides what goes to `frappe.utils.set_title`
	 * (only when `set_document_title`).
	 *
	 * **The title is the last breadcrumb.** There is no separate title node any more:
	 * the method copies the last item of {@link Page.breadcrumbs} (or an empty one),
	 * sets its `label` to the title and its `title` tooltip to `tooltip_label` (else
	 * the title), drops its `href`/`onclick` (a link to the page you are on is noise),
	 * makes `icon` its `prefix` — so `icon` is now an icon NAME for the sprite — and
	 * re-renders through {@link Page.set_breadcrumbs} (which also discards any
	 * {@link Page.legacy_breadcrumbs}). In the DOM that last crumb is the
	 * `span.es-breadcrumbs__item` of the final `<li>`.
	 */
	set_title(
		title: string,
		icon?: string | null,
		strip?: boolean,
		tab_title?: string,
		tooltip_label?: string
	): void;
	/**
	 * `frappe/public/js/frappe/ui/page.js:1004-1009`. The trail in this page's head;
	 * the last item is the page itself, so it carries no `href`. Each page owns its
	 * own items and markup, so a view can only change the trail of the page it was
	 * handed. Writing explicit items discards any {@link Page.legacy_breadcrumbs}
	 * and repaints. A falsy `items` empties the trail.
	 */
	set_breadcrumbs(items: readonly PageBreadcrumbItem[] | null | undefined): void;
	/**
	 * `frappe/public/js/frappe/ui/page.js:1012-1017`. The trail this page holds,
	 * whichever API set it: a legacy `frappe.breadcrumbs.add()` payload is resolved
	 * on every read (`frappe.breadcrumbs.resolve`), otherwise {@link Page.breadcrumbs},
	 * otherwise `[]`.
	 */
	get_breadcrumbs(): readonly PageBreadcrumbItem[];
	/**
	 * `frappe/public/js/frappe/ui/page.js:1019-1035`. Repaints the trail: refills the
	 * `<ol>` of `.title-area .navbar-breadcrumbs` (storing it as
	 * {@link Page.$breadcrumbs}) from `frappe.ui.breadcrumbs({ items })`, and
	 * toggles `mobile-no-divider` on the `nav`. Draws nothing when
	 * {@link Page.show_breadcrumbs} is `false`, and returns without doing anything
	 * when the head has no `.navbar-breadcrumbs`.
	 */
	render_breadcrumbs(): void;
	/**
	 * `frappe/public/js/frappe/ui/page.js:1061-1064`. Writes `txt` into
	 * {@link FrappePageRegions.$sub_title_area} and hides it when `txt` is falsy.
	 * **Effectively a no-op**: that region is `wrapper.find("h6")` and the page
	 * template has no `<h6>`.
	 */
	set_title_sub(txt: string): void;
	/**
	 * `frappe/public/js/frappe/ui/page.js:1066-1068`. Writes `frappe.utils.icon(icon)`
	 * into `.title-icon` under the title area and shows it. The page template has no
	 * `.title-icon` any more, so this matches nothing and returns an **empty** jQuery set.
	 */
	get_main_icon(icon: string): JQuery<HTMLElement>;
	/**
	 * `frappe/public/js/frappe/ui/page.js:253-265`. Shows the status pill with `label`
	 * as its text and writes `color` **verbatim** into its `data-theme` attribute
	 * (`frappe/public/js/frappe/ui/page.js:259`). The espresso badge themes are
	 * `gray`, `blue`, `green`, `amber`, `red`, `violet`, plus the legacy indicator
	 * names (`frappe/public/js/frappe/ui/components/badge.js:21-27`); it is not validated.
	 * On a mobile viewport the label is replaced by a coloured dot
	 * (`background-color: var(--<color>-400)`) and moved into the pill's `title`.
	 */
	set_indicator(label: string, color: FrappeIndicator): void;
	/**
	 * `frappe/public/js/frappe/ui/page.js:295-300`. Strips every class and the
	 * `data-theme` attribute off the pill, restores `es-badge page-indicator-pill hide`
	 * (so it is hidden) and returns it.
	 */
	clear_indicator(): JQuery<HTMLElement>;

	// ---- primary / secondary / icon actions ----

	/**
	 * `frappe/public/js/frappe/ui/page.js:302-312`. `icon` may be a bare name or
	 * `{ icon, size }`; the result is the button's inner HTML.
	 */
	get_icon_label(icon: string | PageIconSpec | null | undefined, label: string): string;
	/**
	 * `frappe/public/js/frappe/ui/page.js:314-369`. Rebinds `btn`'s click, dresses it
	 * as an `es-button` (`frappe.ui.button.dress`), un-hides it and registers its
	 * alt-shortcut. A click while the button is `aria-busy` is ignored
	 * (`frappe/public/js/frappe/ui/page.js:341`); otherwise the return value of
	 * `opts.click` goes to {@link Page.btn_disable_enable}.
	 */
	set_action(btn: JQuery<HTMLElement>, opts: PageActionOptions): void;
	/**
	 * `frappe/public/js/frappe/ui/page.js:373-382`. Returns `btn_primary`. `label` may
	 * be `{ label, short_label }` to show a shorter text below the `md` breakpoint.
	 * The variant is always `"solid"`.
	 */
	set_primary_action(
		label: PageActionLabel,
		click: PageActionClick,
		icon?: string | PageIconSpec,
		working_label?: string
	): JQuery<HTMLElement>;
	/**
	 * `frappe/public/js/frappe/ui/page.js:384-394`. Returns `btn_secondary`. Same
	 * `label` forms as {@link Page.set_primary_action}; the variant is always `"subtle"`.
	 */
	set_secondary_action(
		label: PageActionLabel,
		click: PageActionClick,
		icon?: string | PageIconSpec,
		working_label?: string
	): JQuery<HTMLElement>;
	/** `frappe/public/js/frappe/ui/page.js:396-398`. */
	clear_action_of(btn: JQuery<HTMLElement>): void;
	/** `frappe/public/js/frappe/ui/page.js:400-402`. */
	clear_primary_action(): void;
	/** `frappe/public/js/frappe/ui/page.js:404-406`. */
	clear_secondary_action(): void;
	/** `frappe/public/js/frappe/ui/page.js:408-411`. Both of the above. */
	clear_actions(): void;
	/**
	 * `frappe/public/js/frappe/ui/page.js:426-430`. Tears down the espresso dropdowns of
	 * the inner button groups first ({@link Page.destroy_group_dropdowns}), then hides
	 * and empties `custom_actions` and clears the mobile groups
	 * ({@link Page.clear_mobile_custom_groups}).
	 */
	clear_custom_actions(): void;
	/**
	 * `frappe/public/js/frappe/ui/page.js:431-437`. Removes the `.custom-btn-group`s
	 * (other than the `.view-switcher`) from `custom_mobile_actions`, destroying their
	 * dropdowns first.
	 */
	clear_mobile_custom_groups(): void;
	/**
	 * `frappe/public/js/frappe/ui/page.js:417-424`. Closes and destroys the espresso
	 * dropdown stored under the `es_dropdown` data key of every `.inner-group-button`
	 * / `.custom-btn-group` in (and including) `$scope`. Needed before discarding such
	 * a group: an open menu portals to `<body>` and would otherwise outlive it.
	 */
	destroy_group_dropdowns($scope: JQuery<HTMLElement>): void;
	/** `frappe/public/js/frappe/ui/page.js:439-441`. Empties `icon_group`. */
	clear_icons(): void;
	/**
	 * `frappe/public/js/frappe/ui/page.js:267-285`. Appends a tooltipped icon button
	 * to `icon_group` (a plain `btn btn-default icon-btn`, not an `es-button`).
	 */
	add_action_icon(
		icon: string,
		click: PageActionClick,
		css_class?: string,
		tooltip_label?: string
	): JQuery<HTMLElement>;
	/**
	 * `frappe/public/js/frappe/ui/page.js:844-857`. Marks `btn` busy while `response`
	 * is pending — it duck-types BOTH a `Promise` (`.finally`) and a jqXHR (`.always`),
	 * which is why the parameter is `unknown` rather than `Promise<unknown>`. Busy is
	 * `aria-busy="true"`, **not** `disabled` (disabling would eject keyboard focus):
	 * the `es-button` shows its spinner and ignores clicks.
	 */
	btn_disable_enable(btn: JQuery<HTMLElement>, response: unknown): void;

	// ---- menu / actions dropdowns ----

	/** `frappe/public/js/frappe/ui/page.js:445-454`. */
	add_menu_item(
		label: string,
		click: PageActionClick,
		standard?: boolean,
		shortcut?: string | PageShortcut,
		show_parent?: boolean
	): JQuery<HTMLElement>;
	/** `frappe/public/js/frappe/ui/page.js:456-465`. */
	add_custom_menu_item(
		parent: JQuery<HTMLElement>,
		label: string,
		click: PageActionClick,
		standard?: boolean,
		shortcut?: string | PageShortcut,
		icon?: string | null
	): JQuery<HTMLElement>;
	/** `frappe/public/js/frappe/ui/page.js:497-504`. */
	add_action_item(
		label: string,
		click: PageActionClick,
		standard?: boolean
	): JQuery<HTMLElement>;
	/** `frappe/public/js/frappe/ui/page.js:506-515`. */
	add_actions_menu_item(
		label: string,
		click: PageActionClick,
		standard?: boolean,
		shortcut?: string | PageShortcut
	): JQuery<HTMLElement>;
	/**
	 * `frappe/public/js/frappe/ui/page.js:533-610`. The one primitive the four helpers above delegate to.
	 * Writes an `<li><a class="grey-link dropdown-item">` into the (hidden) `parent`
	 * store, stashing the click handler, icon and shortcut on the `<li>` with
	 * `.data(...)` so {@link Page.build_dropdown_options} can render it.
	 *
	 * When a same-labelled item is already present it returns the EXISTING match
	 * **without adding anything** (`frappe/public/js/frappe/ui/page.js:547-548`) — and
	 * that match is the `span.menu-item-label` carrying the `data-label`, not the `<a>`
	 * a fresh call returns, so it is safe to call twice but the two return values
	 * are not the same element.
	 */
	add_dropdown_item(opts: PageDropdownItemOptions): JQuery<HTMLElement>;
	/**
	 * `frappe/public/js/frappe/ui/page.js:616-700`. Snapshots a hidden item store
	 * (`menu` / `actions` / an inner group's `<ul>`) into the rows an espresso
	 * `frappe.ui.Dropdown` renders: dividers split groups, rows hidden by `display:none`
	 * or by a responsive utility class are skipped, and mobile-mirrored inner buttons
	 * (`"Group > Label"`) are folded into one submenu row. Returns the flat row list,
	 * or a list of `{ group: "", hide_label: true, options }` sections when a divider
	 * split it. The row shape is espresso's `MenuItem` (`ui/components/menu.js`), which
	 * this package does not declare.
	 */
	build_dropdown_options($parent: JQuery<HTMLElement>): unknown[];
	/** `frappe/public/js/frappe/ui/page.js:467-469`. */
	clear_menu(): void;
	/** `frappe/public/js/frappe/ui/page.js:471-473`. */
	show_menu(): void;
	/** `frappe/public/js/frappe/ui/page.js:475-477`. */
	hide_menu(): void;
	/** `frappe/public/js/frappe/ui/page.js:479-481`. */
	show_icon_group(): void;
	/** `frappe/public/js/frappe/ui/page.js:483-485`. */
	hide_icon_group(): void;
	/** `frappe/public/js/frappe/ui/page.js:489-491`. */
	show_actions_menu(): void;
	/** `frappe/public/js/frappe/ui/page.js:493-495`. */
	hide_actions_menu(): void;
	/** `frappe/public/js/frappe/ui/page.js:517-519`. */
	clear_actions_menu(): void;
	/** `frappe/public/js/frappe/ui/page.js:986-988`. Removes only the `.user-action` items from `menu`. */
	clear_user_actions(): void;
	/**
	 * `frappe/public/js/frappe/ui/page.js:744-751`. Empties `parent` and hides its
	 * wrapper; when `parent` is `menu` / `actions` it first closes the matching
	 * dropdown so a portaled panel does not float on with stale rows.
	 */
	clear_btn_group(parent: JQuery<HTMLElement>): void;
	/** `frappe/public/js/frappe/ui/page.js:753-755`. Appends an `<li class="dropdown-divider">` to `menu`. */
	add_divider(): JQuery<HTMLElement>;
	/**
	 * `frappe/public/js/frappe/ui/page.js:702-724`. **Mutates** the `shortcut` object it is given (or wraps a
	 * string in a fresh one) and stamps `page` onto it.
	 */
	prepare_shortcut_obj(
		shortcut: string | PageShortcut,
		click: PageActionClick,
		label: string
	): PageShortcut;
	/**
	 * `frappe/public/js/frappe/ui/page.js:733-742`. Returns the matching jQuery set, or `false` when nothing
	 * matches or when `label`/`parent` is missing — the falsy union is load-bearing
	 * at `frappe/public/js/frappe/ui/page.js:547-548` and `frappe/public/js/frappe/ui/page.js:897`.
	 */
	is_in_group_button_dropdown(
		parent: JQuery<HTMLElement> | HTMLElement | null | undefined,
		selector: string | null | undefined,
		label: string | null | undefined
	): JQuery<HTMLElement> | false;

	// ---- inner toolbar (the `.custom-actions` strip) ----

	/**
	 * `frappe/public/js/frappe/ui/page.js:757-789`. Creates the group on first call;
	 * keyed by `label`. The group is a `.inner-group-button` holding an `es-button`
	 * trigger and a hidden `.dropdown-menu` item store; its espresso dropdown is kept
	 * under the `es_dropdown` data key.
	 */
	get_or_add_inner_group_button(label: string, align_right?: boolean): JQuery<HTMLElement>;
	/**
	 * `frappe/public/js/frappe/ui/page.js:794-825`. {@link Page.build_dropdown_options}
	 * for an inner group's store (bare `<a.dropdown-item>` children plus divider
	 * `<li>`s); a `btn-danger` / `text-danger` item becomes a red-themed row.
	 */
	build_inner_group_options($store: JQuery<HTMLElement>): unknown[];
	/** `frappe/public/js/frappe/ui/page.js:827-831`. May be an EMPTY jQuery set — check `.length`. */
	get_inner_group_button(label: string): JQuery<HTMLElement>;
	/** `frappe/public/js/frappe/ui/page.js:833-842`. */
	set_inner_btn_group_as_primary(label: string): void;
	/** `frappe/public/js/frappe/ui/page.js:858-861`. */
	add_divider_to_button_group(group: string): void;
	/**
	 * `frappe/public/js/frappe/ui/page.js:871-922`. Returns the `es-button` (no group)
	 * or the dropdown `<a>` (grouped) — and **`undefined`** when a same-labelled item
	 * already exists in the group (`frappe/public/js/frappe/ui/page.js:897-905` falls
	 * through with no `return`). `type` is a bootstrap button type mapped onto the
	 * espresso contract (`default`/`secondary`/`light` → subtle, `primary` → solid,
	 * `danger` → solid red, `ghost` → ghost); an unknown type falls back to subtle
	 * (`frappe/public/js/frappe/ui/page.js:36-49`). It is always also mirrored into
	 * the Menu dropdown for narrow screens.
	 */
	add_inner_button(
		label: string,
		action: () => unknown,
		group?: string,
		type?: string,
		align_right?: boolean
	): JQuery<HTMLElement> | undefined;
	/** `frappe/public/js/frappe/ui/page.js:924-943`. Accepts one label or a list; translates each. */
	remove_inner_button(label: string | string[], group?: string): void;
	/**
	 * `frappe/public/js/frappe/ui/page.js:945-970`. Ungrouped: re-expresses the type as
	 * `data-variant` / `data-theme` on the `es-button` (the classes survive). Grouped:
	 * rewrites the store item's class to `btn btn-${type} ellipsis`, which the dropdown
	 * snapshot maps to a red row for `danger`.
	 */
	change_inner_button_type(label: string, group: string | undefined, type: string): void;
	/** `frappe/public/js/frappe/ui/page.js:972-978`. Replaces any existing `.inner-page-message`. */
	add_inner_message(message: string): JQuery<HTMLElement>;
	/**
	 * `frappe/public/js/frappe/ui/page.js:980-984`. Delegates to
	 * {@link Page.clear_custom_actions} (`inner_toolbar` IS `custom_actions`).
	 */
	clear_inner_toolbar(): void;

	// ---- custom buttons ----

	/** `frappe/public/js/frappe/ui/page.js:1070-1072`. **A no-op in v16** — the body is empty. */
	add_help_button(txt: string): void;
	/**
	 * `frappe/public/js/frappe/ui/page.js:1074-1098`. Appends an `es-button` to
	 * `custom_actions` and mirrors it into the Menu dropdown for narrow screens.
	 * Returns the button.
	 */
	add_button(
		label: string,
		click: PageActionClick,
		opts?: PageButtonOptions
	): JQuery<HTMLElement>;
	/**
	 * `frappe/public/js/frappe/ui/page.js:1100-1140`. Returns the group's hidden
	 * `.dropdown-menu` item store — the thing you pass to {@link Page.add_custom_menu_item}
	 * — not the group itself. `parent` defaults to `custom_mobile_actions` on a mobile
	 * viewport and `custom_actions` otherwise.
	 */
	add_custom_button_group(
		label: string,
		icon?: string | null,
		parent?: JQuery<HTMLElement>
	): JQuery<HTMLElement>;
	/** `frappe/public/js/frappe/ui/page.js:1142-1144`. Delegates to `frappe.ui.toolbar.add_dropdown_button`. */
	add_dropdown_button(
		parent: JQuery<HTMLElement>,
		label: string,
		click: PageActionClick,
		icon?: string
	): void;

	// ---- the `.page-form` filter row ----

	/** `frappe/public/js/frappe/ui/page.js:1147-1152`. */
	add_label(label: string): JQuery<HTMLElement>;
	/** `frappe/public/js/frappe/ui/page.js:1153-1156`. Returns the `<select>`, already populated. */
	add_select(label: string, options: unknown): JQuery<HTMLElement>;
	/** `frappe/public/js/frappe/ui/page.js:1157-1160`. Returns the `<input>`. */
	add_data(label: string): JQuery<HTMLElement>;
	/** `frappe/public/js/frappe/ui/page.js:1161-1164`. Returns the `<input>`. */
	add_date(label: string, date?: string): JQuery<HTMLElement>;
	/** `frappe/public/js/frappe/ui/page.js:1165-1169`. Returns the checkbox `<input>`. */
	add_check(label: string): JQuery<HTMLElement>;
	/** `frappe/public/js/frappe/ui/page.js:1170-1173`. */
	add_break(): void;
	/**
	 * `frappe/public/js/frappe/ui/page.js:1174-1222`. **Mutates `df`** (`placeholder`, `input_class`) and
	 * returns `undefined` for `fieldtype: "HTML"` (`frappe/public/js/frappe/ui/page.js:1200-1203`).
	 */
	add_field(df: PageFieldDef, parent?: JQuery<HTMLElement>): PageControl | undefined;
	/** `frappe/public/js/frappe/ui/page.js:1223-1228`. */
	restyle_field(f: PageControl): void;
	/** `frappe/public/js/frappe/ui/page.js:1229-1231`. Empties `page_form`; does NOT clear `fields_dict`. */
	clear_fields(): void;
	/** `frappe/public/js/frappe/ui/page.js:1232-1234`. */
	show_form(): void;
	/** `frappe/public/js/frappe/ui/page.js:1235-1237`. */
	hide_form(): void;
	/** `frappe/public/js/frappe/ui/page.js:1238-1245`. One entry per `fields_dict` key. */
	get_form_values(): Record<string, unknown>;

	// ---- views ----

	/** `frappe/public/js/frappe/ui/page.js:1246-1258`. Appends into `.page-content`; the first view added is shown. */
	add_view(name: string, html: string | JQuery<HTMLElement>): JQuery<HTMLElement>;
	/** `frappe/public/js/frappe/ui/page.js:1259-1270`. No-op when `name` is already current. Triggers `"view-change"`. */
	set_view(name: string): void;
}

/**
 * `frappe.ui.Page`'s regions, merged in by declaration merging.
 *
 * This is also the extension point for consumers: a module augmentation
 * (`declare module "frappe-types" { interface Page { my_widget?: … } }`) adds
 * members without casting.
 */
export interface Page extends FrappePageRegions {}

/**
 * The two shapes `frappe.utils.icon` accepts through a Page API — a bare icon
 * name, or `{ icon, size }` (`frappe/public/js/frappe/ui/page.js:305-307`).
 *
 * Only {@link Page.get_icon_label} still honours `size`: {@link Page.set_action}
 * reads `.icon` and drops the size, "the es contract sizes icons from the button
 * itself" (`frappe/public/js/frappe/ui/page.js:319-322`).
 */
export interface PageIconSpec {
	icon: string;
	/** Defaults to `"xs"` (`frappe/public/js/frappe/ui/page.js:304,307`). */
	size?: FrappeIconSize;
}

/**
 * The `label` argument of {@link Page.set_primary_action} /
 * {@link Page.set_secondary_action}: a string, or `{ label, short_label }` to show a
 * shorter text below the `md` breakpoint (e.g. "Add" for "Add Sales Order") —
 * `frappe/public/js/frappe/ui/page.js:371-375,384-387`. The object is spread into the
 * {@link PageActionOptions}, so it may carry anything those do; `click`, `icon`,
 * `working_label` and `variant` are overwritten by the method's own arguments.
 */
export type PageActionLabel = string | { label: string; short_label?: string };

/**
 * A Page action callback. `frappe/public/js/frappe/ui/page.js:342` calls it as
 * `opts.click.apply(this, [btn])` with `this` bound to the raw button element,
 * and `frappe/public/js/frappe/ui/page.js:343` feeds the return value to
 * {@link Page.btn_disable_enable} — so returning a Promise or a jqXHR is
 * meaningful, and returning nothing is fine.
 */
export type PageActionClick = (button?: JQuery<HTMLElement>) => unknown;

/** Options for {@link Page.set_action} — `frappe/public/js/frappe/ui/page.js:314-369`. */
export interface PageActionOptions {
	label: string;
	click: PageActionClick;
	/**
	 * `frappe/public/js/frappe/ui/page.js:322` — a bare name or `{ icon, size }`;
	 * only the name is used. `null` is accepted and means "no icon".
	 */
	icon?: string | PageIconSpec | null;
	/**
	 * `frappe/public/js/frappe/ui/page.js:326` — the `es-button` variant
	 * (`frappe/public/js/frappe/ui/components/button.js:6-12`).
	 */
	variant?: "solid" | "subtle" | "outline" | "ghost";
	/**
	 * `frappe/public/js/frappe/ui/page.js:346-358` — a shorter label shown below
	 * the `md` breakpoint; the full `label` is hidden there.
	 */
	short_label?: string;
	/**
	 * `frappe/public/js/frappe/ui/page.js:330-332,360-362` — shown while the button is
	 * busy and written to `data-working-label`.
	 */
	working_label?: string;
}

/** Options for {@link Page.add_dropdown_item} — `frappe/public/js/frappe/ui/page.js:533-542`. */
export interface PageDropdownItemOptions {
	label: string;
	click: PageActionClick;
	/** `frappe/public/js/frappe/ui/page.js:597-607` — `true` appends to `parent`, `false` inserts above the user-action divider. */
	standard?: boolean;
	/** The `<ul>` the item goes into. */
	parent: JQuery<HTMLElement>;
	shortcut?: string | PageShortcut;
	/** Defaults to `true` (`frappe/public/js/frappe/ui/page.js:539`) — un-hides the dropdown's button. */
	show_parent?: boolean;
	/** Defaults to `null` (`frappe/public/js/frappe/ui/page.js:540`). A sprite icon name shown before the label. */
	icon?: string | null;
	/**
	 * Defaults to `null` (`frappe/public/js/frappe/ui/page.js:541`). Stashed on the
	 * `<li>` and rendered by the dropdown snapshot as the row's right-hand icon
	 * (`frappe/public/js/frappe/ui/page.js:588,689`). New: `icon_right` did not exist
	 * on this method before.
	 */
	icon_right?: string | null;
}

/**
 * A `frappe.ui.keys` shortcut descriptor as {@link Page.prepare_shortcut_obj}
 * leaves it (`frappe/public/js/frappe/ui/page.js:702-724`). The method fills in every optional member, so a
 * caller only has to supply `shortcut`.
 */
export interface PageShortcut {
	/** e.g. `"ctrl+s"`. Lowercased in place at `frappe/public/js/frappe/ui/page.js:713`. */
	shortcut: string;
	/** Added at `frappe/public/js/frappe/ui/page.js:710` from `frappe.ui.keys.get_shortcut_label`. */
	shortcut_label?: string;
	/** Defaults to the item's `click` (`frappe/public/js/frappe/ui/page.js:715-717`). */
	action?: PageActionClick;
	/** Defaults to the item's `label` (`frappe/public/js/frappe/ui/page.js:719-721`). */
	description?: string;
	/** Stamped at `frappe/public/js/frappe/ui/page.js:723`. */
	page?: Page;
	[key: string]: unknown;
}

/** Options for {@link Page.add_button} — `frappe/public/js/frappe/ui/page.js:1074-1088`. */
export interface PageButtonOptions {
	/**
	 * Defaults to `"btn-default"` (`frappe/public/js/frappe/ui/page.js:1079`). The
	 * bootstrap vocabulary is mapped onto the `es-button` contract
	 * (`frappe/public/js/frappe/ui/page.js:36-49`): `default`/`secondary`/`light` →
	 * subtle, `primary` → solid, `danger` → solid red, `ghost` → ghost. A class
	 * outside that table is passed through as an extra CSS class on a subtle button.
	 */
	btn_class?: string;
	/**
	 * Only `"btn-xs"` has an effect (an `xs` button, `frappe/public/js/frappe/ui/page.js:1085`);
	 * anything else gives the default size.
	 */
	btn_size?: string;
	/** A sprite icon name shown before the label. */
	icon?: string;
}

/**
 * The docfield-ish object {@link Page.add_field} takes. It is a partial DocField
 * — `frappe/public/js/frappe/ui/page.js:1177-1181` only requires `fieldtype`, and mutates `placeholder` and
 * `input_class` — so it is declared open rather than as a full `DocField`.
 */
export interface PageFieldDef {
	fieldtype: string;
	label?: string;
	fieldname?: string;
	/** Set to `df.label` when absent (`frappe/public/js/frappe/ui/page.js:1177-1179`). */
	placeholder?: string;
	/** Forced to `"input-xs"` (`frappe/public/js/frappe/ui/page.js:1181`). */
	input_class?: string;
	default?: unknown;
	parent?: string;
	[property: string]: unknown;
}

/**
 * What `frappe.ui.form.make_control` hands back to a Page (`frappe/public/js/frappe/ui/page.js:1183-1187`).
 *
 * SEAM NOTE — typed as `ui/form.d.ts`'s {@link BaseControl}, imported at the
 * head of this file. That makes `utils.d.ts` ↔ `ui/form.d.ts` a type-only
 * import cycle, which is legal in `.d.ts` and has no emit; the alternative was
 * `unknown`, which would have made `page.add_field(...)!.get_value()` — the
 * whole point of the return value — impossible without a cast.
 */
export type PageControl = BaseControl;

/**
 * The `frappe.ui` members that belong to this fragment's Page slice.
 *
 * Composed into the root `frappe.ui` object by `global.d.ts` alongside
 * {@link FrappeUiThemeSlice} and `ui/form.d.ts`'s dialog slice.
 */
export interface FrappeUiPageSlice {
	/** `frappe/public/js/frappe/ui/page.js:51`. */
	Page: typeof Page;
	/**
	 * `frappe/public/js/frappe/ui/page.js:34` — `frappe.ui.pages = {}`, keyed by `frappe.get_route_str()`
	 * (`frappe/public/js/frappe/ui/page.js:66`). A route with no page yet reads back `undefined`.
	 */
	pages: Record<string, Page | undefined>;
	/**
	 * `frappe/public/js/frappe/ui/page.js:22-32`. Constructs a `Page`, stamps it onto
	 * `opts.parent.page`, and returns it. When the container is already showing
	 * `opts.parent` (a form builds its page inside the first `frm.refresh()`, after
	 * `change_to()` has pointed the container at it) it also calls
	 * `frappe.app.sidebar.apply_page_visibility()` so the sidebar is resolved against a
	 * page that now carries its options (`frappe/public/js/frappe/ui/page.js:28-30`).
	 */
	make_app_page(opts: PageOptions): Page;
}

// ===========================================================================
// SECTION 6 — DOM-side contracts
// ===========================================================================
//
// Everything below is a *contract* rather than a frappe API: attributes,
// classes and expando keys that cross the boundary between frappe's DOM and
// carbon_frappe's. They live here because the inventory assigned them to this
// group; none of them is implemented by frappe's JS, and none of them should
// be confused with one that is.

/**
 * The theme attributes frappe writes on `<html>`.
 *
 * Both are first rendered by the server on `<html>`
 * (`frappe/www/desk.html:2`, both set to the user's `desk_theme` lower-cased, so
 * `data-theme` can start out as `"automatic"` until the desk bundle runs);
 * afterwards `data-theme` is written **only** by `frappe.ui.set_theme`
 * (`frappe/public/js/frappe/ui/theme_switcher.js:182`), and `data-theme-mode` by the
 * theme switcher dialog (`frappe/public/js/frappe/ui/theme_switcher.js:149`) and read
 * back by `set_theme` (`frappe/public/js/frappe/ui/theme_switcher.js:176`). A
 * `MutationObserver` on `data-theme-mode` re-runs `set_theme()`
 * (`frappe/public/js/frappe/desk.js:111-118`).
 *
 * Reading either returns `string | null` from `Element.getAttribute` — the
 * union below documents the values frappe actually writes, and callers must
 * still handle `null` (no attribute yet) and arbitrary strings (a theme name
 * supplied by a third-party app, or the literal `"null"` — see
 * {@link FrappeUiThemeSlice.set_theme}).
 */
export interface DeskThemeAttributes {
	"data-theme": DeskTheme | (string & {});
	"data-theme-mode": DeskThemeMode;
}

/*
 * RESTORED — `DeskDomGlobals` was present in the verified fragment
 * `frappe-utils-dom-router.d.ts` and lost during assembly (see the completeness
 * report, §1d). Copied back verbatim from that fragment; nothing edited.
 */
/**
 * The browser globals this slice's consumers touch that are **supplied by
 * TypeScript's `lib.dom`**, not by this package.
 *
 * This interface exists as a single, compile-checked assertion of that
 * requirement: it only typechecks when the program's `lib` includes `DOM`, so
 * a misconfigured `tsconfig.json` fails here with a clear name rather than
 * scattering "cannot find name 'document'" across the consumer.
 *
 * Required `lib` setting:
 * `"lib": ["ES2020", "DOM", "DOM.Iterable"]`.
 *
 * `DOM.Iterable` is not optional — `for (const node of record.addedNodes)`
 * (`anatomy/ui_shell.js:199`) iterates a `NodeList`, which needs either that
 * lib or `downlevelIteration`.
 *
 * ### Narrowing hazards these globals impose under `strict`
 *
 * 1. **`MutationRecord.addedNodes` yields `Node`, and `Node` has no
 *    `.matches()`.** The runtime guard `node.nodeType !== 1`
 *    (`ui_shell.js:200`) does **not** narrow `Node` to `Element` in
 *    TypeScript — `nodeType` is `number`, not a literal discriminant. Use
 *    `node instanceof Element` instead, which narrows and is equivalent at
 *    runtime.
 * 2. **`document.querySelector()` returns `Element | null`, and `Element` has
 *    no `.dataset`.** `dataset` lives on `HTMLElement` / `HTMLOrSVGElement`,
 *    so a node read back from the desk must be narrowed with
 *    `instanceof HTMLElement` before {@link CarbonDatasetKeys} applies — which
 *    is what `tables/engine/table.js:76-78` and
 *    `tables/datatable/datatable.js:80-83` already do for their containers.
 * 3. **`document.createElement(tag)` with a `string` tag returns the broad
 *    `HTMLElement`**, not a specific subtype. The engine's `el()` helper
 *    (`tables/engine/dom.js:9-23`) takes a plain `string`, so its callers get
 *    `HTMLElement` and must assert or generic-ise where a
 *    `HTMLTableRowElement` / `HTMLTableCellElement` / `HTMLInputElement` is
 *    needed (see {@link CarbonTableAdapterSeams}, whose seams are typed with
 *    the specific elements the engine actually requires of them).
 */
export interface DeskDomGlobals {
	/** `tables/engine/dom.js:10`, `table.js:75`, `render.js:299`, and passim. */
	document: Document;
	/** Used as a **value** in `instanceof` narrowing — `table.js:76`, `datatable.js:81`. */
	HTMLElement: typeof HTMLElement;
	/** `ui_shell.js:196-209` (childList/subtree) and `carbon_charts.bundle.js:155-158` (attributeFilter). */
	MutationObserver: typeof MutationObserver;
	/** Only `console.error` is used, at `classes.js:125`, `table.js:225` and `table.js:318`. */
	console: Console;
	setTimeout: typeof setTimeout;
	clearTimeout: typeof clearTimeout;
	setInterval: typeof setInterval;
	clearInterval: typeof clearInterval;
	requestAnimationFrame: typeof requestAnimationFrame;
	cancelAnimationFrame: typeof cancelAnimationFrame;
}

/**
 * Timer handle aliases.
 *
 * `setTimeout`/`setInterval` come from `lib.dom` and return `number`, but if
 * `@types/node` is anywhere in the program's type graph the ambient
 * declarations return `NodeJS.Timeout` instead. Consumers that store a handle
 * must therefore write `ReturnType<typeof setTimeout>` rather than `number`:
 *
 * ```ts
 * let timer: TimerHandle | null = null;   // NOT `let timer = null`
 * ```
 *
 * (`let timer = null` infers the type `null` under `strict`, so the later
 * assignment is an error regardless of which lib supplies the timer.)
 */
export type TimerHandle = ReturnType<typeof setTimeout>;

/** Companion to {@link TimerHandle} for `setInterval`. */
export type IntervalHandle = ReturnType<typeof setInterval>;

/** `requestAnimationFrame`'s handle. Always a `number` in `lib.dom`. */
export type AnimationFrameHandle = ReturnType<typeof requestAnimationFrame>;

/**
 * The shape of carbon_frappe's `raf()` helper
 * (`public/js/tables/engine/dom.js:76-90`): a callable that coalesces to one
 * `requestAnimationFrame`, carrying a `cancel` expando.
 *
 * A function with an attached property cannot be expressed by an arrow-function
 * type, so the callable-plus-member form below is required for
 * `this.scheduleRender = raf(...)` / `this.scheduleRender.cancel()`
 * (`tables/engine/table.js:94,343`) to typecheck.
 */
export interface RafScheduler {
	(): void;
	/** Cancels a pending frame. Safe to call when nothing is scheduled. */
	cancel(): void;
}

/**
 * Expando keys carbon_frappe's table renderer writes onto DOM elements.
 *
 * `tables/engine/render.js:21,24` define the key names; they are written at
 * `render.js:149,226,404,444` (`__carbon_table_node`) and read/written at
 * `render.js:481-483` (`__carbon_child_hover`).
 *
 * `render.js:20` documents `__carbon_table_node` as a *published* marker —
 * adapters use it to tell engine-built DOM from their own — so it is a
 * contract, not a private field.
 *
 * The package author should surface this via a global augmentation:
 *
 * ```ts
 * declare global {
 *   interface Element extends CarbonTableElementExpandos {}
 * }
 * ```
 */
export interface CarbonTableElementExpandos {
	/** `true` on every node the engine created itself. `render.js:21`. */
	__carbon_table_node?: boolean;
	/** `true` once a child row's hover mirroring is bound. `render.js:24`. */
	__carbon_child_hover?: boolean;
}

/**
 * Custom `dataset` keys carbon_frappe writes onto frappe-rendered nodes.
 *
 * `anatomy/ui_shell.js:116-117` sets `bell.dataset.cfBell = "1"`
 * (attribute `data-cf-bell`) so the harvest pass, which re-runs on every route
 * change, does not stack a second click listener.
 *
 * Two strict-mode notes for consumers:
 * - `dataset` lives on `HTMLElement`/`HTMLOrSVGElement`, **not** on `Element`,
 *   so a `querySelector` result must be narrowed
 *   (`instanceof HTMLElement`) before it is read;
 * - `DOMStringMap` index access yields `string | undefined`, which the
 *   truthiness check at `ui_shell.js:116` already handles.
 */
export interface CarbonDatasetKeys {
	/** `"1"` once the notification bell's click handler has been bound. */
	cfBell?: string;
}

/**
 * The Carbon Design System class names carbon_frappe's table engine emits.
 *
 * Owned by `@carbon/styles@1.114.0` (a styles-only dependency — there is no JS
 * import), mirrored in `tables/engine/classes.js:19-60`.
 *
 * `cds--data-table--sticky-header` is deliberately **absent**
 * (`classes.js:37-38`, `table.js:364-371`): Carbon implements it with
 * `display: block`/`flex`, which abandons the table layout model, so sticky is
 * done with `position: sticky` on the `<th>`s instead.
 */
export type CarbonTableClassKey =
	| "container"
	| "content"
	| "table"
	| "toolbar"
	| "toolbarContent"
	| "batchActions"
	| "batchActionsActive"
	| "batchSummary"
	| "sortHeader"
	| "sortActive"
	| "sortDescending"
	| "sortFlex"
	| "sortIcon"
	| "sortIconUnsorted"
	| "sortHeaderCell"
	| "headerLabel"
	| "sortableTable"
	| "expandableRow"
	| "expandableRowHover"
	| "parentRow"
	| "childRow"
	| "childRowInner"
	| "expandCell"
	| "expandRow"
	| "expandSvg"
	| "columnMenu"
	| "overflowMenuDataTable"
	| "selectedRow"
	| "actionList"
	| "toolbarAction"
	| "searchExpandable"
	| "searchActive"
	| "pagination"
	| "skeleton";

/** `tables/engine/classes.js:19-60`. */
export type CarbonTableClassMap = Readonly<Record<CarbonTableClassKey, string>>;

/**
 * Carbon's five data-table row heights in px — `tables/engine/classes.js:63`.
 * Declared with literal types so `keyof typeof` gives the size union and the
 * `for (const name in ROW_SIZES)` sweep in `nearestRowSize`
 * (`classes.js:79-80`) can be indexed with `keyof CarbonRowSizes`.
 */
export interface CarbonRowSizes {
	xs: 24;
	sm: 32;
	md: 40;
	lg: 48;
	xl: 64;
}

/** `xs | sm | md | lg | xl`. Feeds `sizeClass()` (`classes.js:66-68`). */
export type CarbonRowSize = keyof CarbonRowSizes;

/**
 * Attribute names carbon_frappe's engine emits and that frappe / ERPNext /
 * third-party code reads back.
 *
 * Emission sites (`tables/engine/render.js`): `data-col-id`/`data-col-index`/
 * `scope` on `<th>` (`:231-233`), the same pair on filter `<td>`s (`:294-295`),
 * `data-row-id`/`data-row-index`/`data-depth` on `<tr>` (`:410-412`),
 * `data-parent-row` on an expandable parent row (`:423`),
 * `data-col-id`/`data-col-index`/`data-row-index` on body `<td>`s (`:450-452`),
 * and `dir` on the container (`:46`). `aria-sort` is written (and removed with
 * `null`) on sort headers at `tables/engine/table.js:492,497`.
 *
 * `data-child-row` is part of Carbon's own selector contract:
 * `tr.cds--parent-row… + tr[data-child-row]` requires the addendum row to be
 * the immediate next sibling, which is why the engine owns addendum placement
 * *and* removal (`render.js:339-348`).
 */
export type CarbonTableDataAttribute =
	| "data-col-id"
	| "data-col-index"
	| "data-row-id"
	| "data-row-index"
	| "data-depth"
	| "data-parent-row"
	| "data-child-row"
	| "aria-sort"
	| "scope"
	| "dir";

/**
 * The signature of the engine's `attr()` helper
 * (`tables/engine/dom.js:26-32`).
 *
 * `null`, `undefined` and `false` **remove** the attribute; everything else is
 * stringified and written only when it differs from the current value. Numbers
 * are accepted directly (row/column indices are passed as numbers).
 */
export type CarbonAttrSetter = (
	node: Element,
	name: CarbonTableDataAttribute | (string & {}),
	value: string | number | boolean | null | undefined
) => void;

/**
 * The context a class-profile hook receives. `Host`, `Row`, `Column` and
 * `Header` are left as type parameters because they are carbon_frappe's own
 * `CarbonTable` and TanStack `Row`/`Column`/`Header` types — this package does
 * not own them and must not invent them.
 */
export interface CarbonProfileContext<Host = unknown> {
	host: Host;
}

/** `render.js:241-247`. */
export interface CarbonHeaderCellContext<Host = unknown, Column = unknown, Header = unknown>
	extends CarbonProfileContext<Host> {
	column: Column;
	header: Header;
	/** The `.cf-table__cell-content` div inside the `<th>`. */
	content: Element;
	colIndex: number;
}

/** `render.js:305` (filter cells) and `render.js:524` (total cells). */
export interface CarbonColumnContext<Host = unknown, Column = unknown> extends CarbonProfileContext<Host> {
	column: Column;
	colIndex: number;
}

/** `render.js:460-466`. */
export interface CarbonCellContext<Host = unknown, Row = unknown, Column = unknown>
	extends CarbonProfileContext<Host> {
	row: Row;
	column: Column;
	colIndex: number;
	/** The content node — the same node as the `<td>` for adapter-owned cells. */
	content: Element;
}

/** `render.js:471`. */
export interface CarbonRowContext<Host = unknown, Row = unknown> extends CarbonProfileContext<Host> {
	row: Row;
}

/** One class-profile hook: `(node, ctx) => void`. `classes.js:117-127`. */
export type CarbonProfileHook<Ctx> = (node: Element, ctx: Ctx) => void;

/**
 * The 14-slot class-profile surface an adapter implements
 * (`tables/engine/classes.js:94-109`; `NOOP_PROFILE` sets every slot to
 * `null`, and `makeProfile()` at `:112-114` merges an adapter's partial over
 * it).
 *
 * `applyProfile(profile, hook, node, ctx)` (`classes.js:117-127`) indexes the
 * profile with a **dynamic string** — under `strict` that index must be typed
 * `keyof CarbonTableClassProfile`, or the lookup is a TS7053 error. A failing
 * hook is caught and logged, never rethrown (`classes.js:120-126`).
 *
 * Note: `classes.js:92` says "every hook is optional"; the literal declares all
 * fourteen with a `null` value, so the honest type is *optional or `null`*.
 */
export interface CarbonTableClassProfile<Host = unknown, Row = unknown, Column = unknown, Header = unknown> {
	/** The container element. `render.js:47`. */
	root?: CarbonProfileHook<CarbonProfileContext<Host>> | null;
	/** The scroll viewport. `render.js:51`. */
	scroll?: CarbonProfileHook<CarbonProfileContext<Host>> | null;
	/** `<thead>`. `render.js:58`. */
	head?: CarbonProfileHook<CarbonProfileContext<Host>> | null;
	/** `<tbody>`. `render.js:59`. */
	body?: CarbonProfileHook<CarbonProfileContext<Host>> | null;
	/** `<tfoot>`. `render.js:60`. */
	foot?: CarbonProfileHook<CarbonProfileContext<Host>> | null;
	/** The header `<tr>`. `render.js:204`. */
	headerRow?: CarbonProfileHook<CarbonProfileContext<Host>> | null;
	/** Each header `<th>`. `render.js:241-247`. */
	headerCell?: CarbonProfileHook<CarbonHeaderCellContext<Host, Column, Header>> | null;
	/** The inline-filter `<tr>`. `render.js:266`. */
	filterRow?: CarbonProfileHook<CarbonProfileContext<Host>> | null;
	/** Each filter `<td>`. `render.js:305`. */
	filterCell?: CarbonProfileHook<CarbonColumnContext<Host, Column>> | null;
	/** Each body `<tr>`. `render.js:471`. */
	row?: CarbonProfileHook<CarbonRowContext<Host, Row>> | null;
	/** Each body `<td>`. `render.js:460-466`. */
	cell?: CarbonProfileHook<CarbonCellContext<Host, Row, Column>> | null;
	/** The totals `<tr>`. `render.js:501`. */
	totalRow?: CarbonProfileHook<CarbonProfileContext<Host>> | null;
	/** Each totals `<td>`. `render.js:524`. */
	totalCell?: CarbonProfileHook<CarbonColumnContext<Host, Column>> | null;
	/** The empty-state node. `render.js:72`. */
	empty?: CarbonProfileHook<CarbonProfileContext<Host>> | null;
}

/** The slot names of {@link CarbonTableClassProfile}, for `applyProfile`'s dynamic index. */
export type CarbonTableClassProfileHook = keyof CarbonTableClassProfile;

/**
 * A filter-cell entry as handed to {@link CarbonTableAdapterSeams.createFilterCell}
 * (`render.js:277-292`). `input` is `null` until either the adapter declines
 * the seam or the engine builds its own `<input>`.
 */
export interface CarbonFilterCellEntry {
	td: HTMLTableCellElement;
	input: HTMLInputElement | null;
}

/**
 * A row entry as handed to the adopt/release hooks
 * (`render.js:404,407,364,395`).
 */
export interface CarbonRowEntry<Cell = unknown> {
	tr: HTMLTableRowElement;
	cells: Map<string, Cell>;
	adapterOwned: boolean;
}

/**
 * The node-supplying seams an adapter may implement.
 *
 * These return DOM built **outside** the engine (frappe's `GridRow` markup),
 * and the engine then calls raw DOM methods on them — `classList.add`,
 * `setAttribute`, `remove()`, `previousElementSibling` — so they must be real
 * elements, never jQuery objects. Unwrap with `.get(0)` at the boundary, as
 * `tables/grid/grid.js:105-108` does.
 *
 * Declared in `tables/engine/table.js:60-70` (the defaults, all `null`) and
 * invoked at `table.js:581-619`.
 *
 * ⚠ Correction to the inventory: `onRowRelease` receives the **row id**, not
 * the row — `table.js:616-619` is
 * `this.options.onRowRelease(rowId, entry, this)`, called from
 * `render.js:364,395`.
 */
export interface CarbonTableAdapterSeams<Host = unknown, Row = unknown, Column = unknown, Cell = unknown> {
	/**
	 * `table.js:592-596`. A truthy return replaces the engine's `<tr>`;
	 * returning a *different* node for a row id the engine already rendered
	 * releases and discards the old one (`render.js:387-399`).
	 */
	createRowNode?: ((row: Row, host: Host) => HTMLTableRowElement | null) | null;

	/**
	 * `table.js:606-610`. A truthy return replaces the engine's `<td>` **and**
	 * becomes its own content node, with `adapterOwned: true` suppressing
	 * `renderCellContent` (`render.js:437-441,458`).
	 */
	createCellNode?: ((row: Row, column: Column, colIndex: number, host: Host) => HTMLTableCellElement | null) | null;

	/**
	 * `table.js:599-603`. A **truthy** return suppresses the engine's own
	 * `<input>` (`render.js:290`); the adapter appends into `entry.td` itself.
	 */
	createFilterCell?:
		| ((entry: CarbonFilterCellEntry, column: Column, colIndex: number, host: Host) => boolean | null)
		| null;

	/**
	 * `table.js:581-586`. The adapter-owned, **engine-placed** child row.
	 * The engine owns its placement *and* its removal (`render.js:339-348`),
	 * because Carbon's expandable CSS depends on immediate-sibling adjacency.
	 */
	renderRowAddendum?: ((row: Row, leaf: Column[], host: Host) => HTMLTableRowElement | null) | null;

	/** `table.js:612-614`, from `render.js:407`. */
	onRowAdopt?: ((row: Row, entry: CarbonRowEntry<Cell>, host: Host) => void) | null;

	/** `table.js:616-619`, from `render.js:364,395`. First argument is the row **id**. */
	onRowRelease?: ((rowId: string, entry: CarbonRowEntry<Cell>, host: Host) => void) | null;

	/** `table.js:66-70,107`. Called once after mount with the (empty) toolbar region. */
	renderToolbar?: ((node: HTMLElement, host: Host) => void) | null;

	/** `table.js:66-70,108`. Called once after mount with the (empty) footer region. */
	renderFooter?: ((node: HTMLElement, host: Host) => void) | null;
}

/**
 * Selectors in frappe's own desk markup that carbon_frappe's browser harness
 * reads back or suppresses. Documented as a union because there is no runtime
 * API behind them — they are a rendering contract that breaks silently when
 * upstream markup changes.
 *
 * - `#freeze` — the backdrop {@link FrappeDom.freeze} appends to `#body`
 *   (`frappe/public/js/frappe/dom.js:145,152`). The harness counts these nodes
 *   to assert freeze/unfreeze balance
 *   (`scripts/tables/grid.ts:524,633,662,666`).
 * - `#login_email`, `#login_password` — the desk login form's inputs
 *   (`frappe/www/login.html:15,26`). The harness no longer reads them: it logs in
 *   through `/api/method/login` (`scripts/tables/cdp.ts:495-514`). They are kept
 *   because they are still frappe's markup. `.btn-login` is **gone**: the login
 *   submit button is a plain `es-button` of `type="submit"`
 *   (`frappe/www/login.html:45-46`) and no element carries a `btn-login` class.
 * - `link[rel=stylesheet]` — filtered on `desk.bundle` + `.css` and
 *   `/assets/carbon_frappe/` for the assets.json shadowing guard
 *   (`scripts/tables/cdp.ts:466-472`).
 * - `.onboarding-widget-box` (`frappe/public/js/frappe/widgets/onboarding_widget.js:466`),
 *   `.widget-group` (`frappe/public/js/frappe/widgets/widget_group.js:53`),
 *   `[data-widget-name]` (`frappe/public/js/frappe/widgets/base_widget.js:77`) — ERPNext
 *   onboarding panels, hidden so they cannot intercept `elementFromPoint`
 *   (`scripts/tables/grid.ts:424-428`).
 * - `.dt-cell__edit .frappe-control` — a mounted control inside a datatable
 *   editor (`frappe/public/js/frappe/form/controls/base_control.js:27` makes the
 *   `.frappe-control`; the harness probes it at `scripts/tables/report.ts:625`).
 * - `.awesomplete` — the Link control's dropdown wrapper (the awesomplete library's
 *   own class, created for `frappe/public/js/frappe/form/controls/link.js:225`),
 *   synthesised by the harness (`scripts/tables/report.ts:1043-1045`).
 */
export type DeskMarkupSelector =
	| "#freeze"
	| "#login_email"
	| "#login_password"
	| "link[rel=stylesheet]"
	| ".onboarding-widget-box"
	| ".widget-group"
	| "[data-widget-name]"
	| ".dt-cell__edit .frappe-control"
	| ".awesomplete";

// ===========================================================================
// SECTION 7 — assembly surface
// ===========================================================================

/**
 * The members this group contributes to the `frappe` global.
 *
 * The package author merges this into the top-level `Frappe` interface owned
 * by `frappe-core`:
 *
 * ```ts
 * declare global {
 *   const frappe: Frappe;            // from frappe-core
 *   interface Frappe extends FrappeUtilsDomRouterGlobals {}
 * }
 * ```
 *
 * All three are **non-optional**: `frappe.utils` exists from `provide.js:24`,
 * and `frappe.dom` / `frappe.router` from the module bodies of `dom.js:7` and
 * `router.js:73`, i.e. before any app bundle runs. Declaring them optional
 * would force `?.` on every honest call site while buying nothing — the
 * defensive `frappe.utils?.icon` at
 * `carbon_frappe/public/js/anatomy/editable_title.js:53` stays a harmless
 * no-op against a non-optional declaration.
 */
export interface FrappeUtilsDomRouterGlobals {
	utils: FrappeUtils;
	dom: FrappeDom;
	router: FrappeRouter;

	// -- the router's "global functions for backward compatibility" (`frappe/public/js/frappe/router.js:1027-1040`)

	/** `frappe/public/js/frappe/router.js:1028` — `frappe.router.current_route`. */
	get_route(): FrappeStandardRoute | null;
	/** `frappe/public/js/frappe/router.js:1029` — `current_route.join("/")`. Throws before the first route, when `current_route` is still `null`. */
	get_route_str(): string;
	/**
	 * `frappe/public/js/frappe/router.js:1030-1032` — `frappe.router.set_route`, with `arguments` passed
	 * through untouched; see {@link FrappeRouterBase.set_route} for the forms.
	 */
	set_route: FrappeRouterBase["set_route"];
	/** `frappe/public/js/frappe/router.js:1034-1040` — the route before the current one, or `[]`. */
	get_prev_route(): FrappeStandardRoute | [];
}

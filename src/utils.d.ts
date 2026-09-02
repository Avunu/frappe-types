/**
 * `frappe-types` — group **frappe-utils-dom-router**
 *
 * Hand-maintained declarations for the `frappe.utils`, `frappe.dom` and
 * `frappe.router` slice of the Frappe desk JS API.
 *
 * Target: **Frappe v16.33.0** (`git tag v16.33.0`, branch `version-16`).
 *
 * Every signature below was read out of the shipped source; the citations are
 * `path/to/file.js:line` relative to `apps/frappe/`. When frappe's own code is
 * genuinely dynamic the declaration says so with `unknown` plus a doc comment
 * rather than guessing — consumers of this package compile with
 * `strict: true` and no `as any`, so an optimistic type is worse than an open
 * one.
 *
 * Sources read in full for this fragment:
 * - `frappe/public/js/frappe/utils/utils.js`      (2243 lines)
 * - `frappe/public/js/frappe/utils/datatable.js`  (22 lines)
 * - `frappe/public/js/frappe/utils/common.js`     (frappe.utils.* additions)
 * - `frappe/public/js/frappe/query_string.js`     (frappe.utils.* additions)
 * - `frappe/public/js/frappe/event_emitter.js`    (36 lines)
 * - `frappe/public/js/frappe/logtypes.js`, `frappe/public/js/frappe/meta_tag.js`
 * - `frappe/public/js/frappe/dom.js`              (445 lines)
 * - `frappe/public/js/frappe/router.js`           (698 lines)
 * - `frappe/public/js/frappe/ui/theme_switcher.js`, `frappe/public/js/frappe/ui/page.js`
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
 * (`utils/utils.js:1519`). The chart class belongs to `charts.d.ts`.
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
 *   (`ui/page.js:852`), used for `Page#fields_dict` and `Page#add_field`.
 *   This makes `utils.d.ts` ↔ `ui/form.d.ts` a type-only import cycle, which is
 *   legal in `.d.ts` and produces no emit.
 * - {@link FrappeIndicator} — the `$indicator-colors` union `Page#set_indicator`
 *   writes as a class (`ui/page.js:210-222`), owned by `core.d.ts`.
 */
import type { BaseControl } from "./ui/form";
import type { FrappeIndicator } from "./core";
import type { JQueryRegion } from "./globals";
// Single-sourced: `report_column_total`'s cell parameter IS frappe-datatable's
// total-row cell. See the note on `FrappeReportColumnTotalCell` below, and the
// reciprocal `DataTableTranslations` import in `datatable.d.ts:56`. The two
// files import types from each other; `import type` cycles between ambient
// declaration files are resolved by the checker and emit nothing.
import type { DataTableTotalCell } from "./datatable";

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
 * `utils/utils.js:893-928`: `debounced.cancel` and `debounced.flush` are
 * attached to the returned function and both return `false` when no timer is
 * pending, `true` otherwise.
 */
export interface FrappeDebouncedFunction<TArgs extends unknown[] = unknown[]> {
	(...args: TArgs): void;
	/** `utils/utils.js:912-918`. `false` when there was nothing pending. */
	cancel(): boolean;
	/** `utils/utils.js:920-927`. Runs the pending call immediately. */
	flush(): boolean;
}

// ===========================================================================
// SECTION 1 — frappe.utils
// ===========================================================================

/**
 * Duration-field display options.
 *
 * Read at `utils/utils.js:1186-1214` (`get_formatted_duration`) and produced by
 * `get_duration_options` (`utils/utils.js:1263-1268`) straight off a
 * `Duration` DocField, so the flags arrive as frappe's 0/1 booleans. The
 * `!== 1` comparisons in `get_formatted_duration` mean a JS `true` is NOT
 * equivalent to `1` there — pass `1`.
 */
export interface FrappeDurationOptions {
	hide_days?: 0 | 1;
	hide_seconds?: 0 | 1;
}

/** `utils/utils.js:1224-1244` — the decomposed duration. */
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

/** `utils/utils.js:1161-1184` — coarse UA sniff. */
export interface FrappeBrowserInfo {
	name: string;
	version: string;
}

/**
 * The values `frappe.utils.validate_type` knows.
 * `utils/utils.js:446-484` — anything else returns `false` unconditionally.
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
 * `utils/utils.js:1414-1419`: a string becomes the class `icon-${size}`
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
 * A `frappe.utils.map_defaults.tiles.*` entry (`utils/utils.js:1283-1311`).
 * Shapes match Leaflet's `L.tileLayer(url, options)`.
 */
export interface FrappeMapTile {
	url: string;
	options: { attribution: string };
}

/** `utils/utils.js:1280-1313`. */
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
 * `utils/utils.js:1531-1621`. Only `type` is required; every other member is
 * consulted per `type`, and unknown members are ignored.
 */
export interface FrappeGenerateRouteItem {
	/** Lower-cased before dispatch: doctype | report | page | dashboard | workspace. */
	type: string;
	name?: string;
	/** Set by the function itself when `type === "doctype"` (`utils.js:1533`). */
	doctype?: string;
	/** Short-circuits every branch when present (`utils.js:1603`). */
	route?: string;
	link?: string;
	doc_view?: "List" | "Tree" | "Report Builder" | "Dashboard" | "New" | "Calendar" | "Kanban" | "Image";
	kanban_board?: string;
	filters?: Record<string, unknown>;
	tab?: string;
	is_query_report?: boolean;
	report_ref_doctype?: string;
	public?: boolean;
	/** Serialised onto the URL as a query string (`utils.js:1606-1612`). */
	route_options?: Record<string, unknown>;
}

/**
 * A row of `frappe.boot.desktop_icons` as returned by
 * `get_desktop_icon_by_label` (`utils/utils.js:1486-1497`).
 * Only `label` and `app` are read by this module; the doctype carries more.
 */
export interface FrappeDesktopIconRecord {
	label: string;
	app?: string;
	[field: string]: unknown;
}

/** `utils/utils.js:1676-1702` — the argument to `build_summary_item`. */
export interface FrappeSummaryItem {
	type?: "separator" | (string & {});
	label?: string;
	value?: unknown;
	datatype?: string;
	currency?: string;
	color?: string;
	indicator?: string;
}

/** `utils/utils.js:1748-1807` — one entry of `add_select_group_button`. */
export interface FrappeSelectGroupAction {
	label: string;
	description?: string;
	action?: (event: JQueryEventLike) => void;
}

/** `utils/utils.js:2166-2206` — a navbar Help dropdown entry. */
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
 * `utils/utils.js:969-985` reads exactly two things off it:
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
 * `column: DataTableColumn` carries both members `utils.js:970-975` reads
 * (`fieldtype?: string` at datatable.d.ts:351, `disable_total?: boolean | 0 | 1`
 * at datatable.d.ts:354, each with the same citation the inline shape had), plus
 * the `colIndex` and the open cell members the index signature stood in for.
 *
 * This name survives as an ALIAS rather than being deleted, so any consumer
 * that already imports it keeps compiling and lands on the single owning type.
 *
 * @deprecated Import {@link DataTableTotalCell} from `frappe-types` instead.
 * This alias is kept only for source compatibility.
 */
export type FrappeReportColumnTotalCell = DataTableTotalCell;

/**
 * A pluralised frappe-datatable translation.
 * `utils/datatable.js:47-54` — keyed by count, with a `default` fallback.
 */
export interface DataTablePluralTranslation {
	1: string;
	default: string;
}

/**
 * One language's frappe-datatable string table.
 * `utils/datatable.js:4-55`. Note the **mixed value type**: five keys are
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
 * map keyed by `frappe.boot.lang` (`utils/datatable.js:5,41`).
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
	 * `utils/datatable.js:3-22`.
	 */
	get_translations(): DataTableTranslations;
}

/**
 * `frappe.utils.logtypes` — `logtypes.js:6`.
 */
export interface FrappeUtilsLogTypes {
	/** `logtypes.js:8-40`. Renders a retention notice into `cur_list.page.sidebar`. */
	show_log_retention_message(doctype: string): void;
}

/**
 * The `frappe.utils` namespace.
 *
 * Created by `frappe.provide("frappe.utils")` (`provide.js:24`), then filled by
 * `Object.assign(frappe.utils, {...})` at `utils/utils.js:135` and
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

	/** `utils.js:136-144`. Random alphanumeric string of length `len`. */
	get_random(len: number): string;

	/** `utils.js:145-154`. Prefixes bare filenames with `files/`. */
	get_file_link(filename: string): string;

	/** `utils.js:155-157`. `\n` → `<br>`; `""` for a falsy input. */
	replace_newlines(t: string | null | undefined): string;

	/** `utils.js:158-167`. Parses and looks for element nodes. */
	is_html(txt: string | null | undefined): boolean;

	/** `utils.js:168-170`. `navigator.platform === "MacIntel"`. */
	is_mac(): boolean;

	/** `utils.js:171-173`. `$(document).width() < 768`. */
	is_xs(): boolean;

	/** `utils.js:174-176`. 768 ≤ width < 991. */
	is_sm(): boolean;

	/** `utils.js:177-179`. 991 ≤ width < 1199. */
	is_md(): boolean;

	/** `utils.js:180-187`. */
	is_json(str: string): boolean;

	/**
	 * `utils.js:188-196`. Returns the parsed value, or **the original string**
	 * when parsing fails — hence `unknown` rather than a parsed shape.
	 */
	parse_json(str: string): unknown;

	/** `utils.js:197-199`. Collapses empty `<p>` and repeated `<br>`. */
	strip_whitespace(html: string | null | undefined): string;

	/** `utils.js:200-212`. Escapes only `& < >`. */
	encode_tags(html: string): string;

	/** `utils.js:213-229`. Drops quoted reply text from an email body. */
	strip_original_content(txt: string): string;

	/**
	 * `utils.js:231-244`. Escapes `& < > " ' \` =`.
	 *
	 * Accepts anything: `null`/`undefined` return `""` while `0` and `false`
	 * are stringified (the guard is `txt == null`, deliberately not `!txt`).
	 */
	escape_html(txt: unknown): string;

	/** `utils.js:248-250`. `escape_html` + `<strong>` wrapper. */
	bold(txt: unknown): string;

	/** `utils.js:252-267`. Inverse of {@link FrappeUtils.escape_html}. */
	unescape_html(txt: unknown): string;

	/**
	 * `utils.js:269-273`. Parses `html` and returns `dom.body.textContent`.
	 * A parsed `text/html` document always has a body, so the result is a
	 * string at runtime even though `Node.textContent` is nullable in lib.dom.
	 */
	html2text(html: string): string;

	/** `utils.js:275-280`. Prefix test for `http://` / `https://` only. */
	is_url(txt: string): boolean;

	/** `utils.js:281-289`. Title-cases and strips `-`/`_` (or replaces with a space). */
	to_title_case(string: string, with_space?: boolean): string;

	/** `utils.js:290-304`. Collapses nested blockquotes behind a "• • •" toggle. */
	toggle_blockquote(txt: string): string;

	// ------------------------------------------------------------- scrolling

	/** `utils.js:305-307`. */
	scroll_page_to_top(): void;

	/**
	 * `utils.js:308-363`. `element` may be a scroll offset in px (a `number`),
	 * or anything jQuery accepts. No-ops when `frappe.flags.disable_auto_scroll`.
	 */
	scroll_to(
		element?: number | string | Element | JQuery<HTMLElement> | null,
		animate?: boolean,
		additional_offset?: number | string | null,
		element_to_be_scrolled?: JQuery<HTMLElement> | null,
		callback?: (() => void) | null,
		highlight_element?: boolean
	): void;

	/** `utils.js:364-368`. Offset of `element` minus navbar/page-head height. */
	get_scroll_position(element: string | Element | JQuery<HTMLElement>, additional_offset?: number | string): number;

	// ------------------------------------------------------------ collections

	/**
	 * `utils.js:369-397`. `filters` as a string returns `[dict[filters]]`;
	 * as an object it is an `{ key: value }` / `{ key: [op, value] }` matcher
	 * supporting `in`, `not in`, `<`, `<=`, `>`, `>=`.
	 */
	filter_dict(
		dict: Record<string, unknown> | readonly unknown[],
		filters: string | Record<string, unknown>
	): unknown[];

	/** `utils.js:398-400`. Oxford-less "a, b or c". */
	comma_or<T>(list: readonly T[] | T): string | T;

	/** `utils.js:401-403`. Oxford-less "a, b and c". */
	comma_and<T>(list: readonly T[] | T): string | T;

	/**
	 * `utils.js:404-416`. Joins with `", "` and `sep` before the last item.
	 * A non-array is returned unchanged, and a 1-element array returns
	 * `list[0]` **unchanged** (not stringified) — hence the `| T`.
	 */
	comma_sep<T>(list: readonly T[] | T, sep: string): string | T;

	/**
	 * `utils.js:551-572`. Sorts `list` **in place** by `list[i][key]` and
	 * returns it. `compare_type` defaults to `"string"` when
	 * `typeof list[0][key] === "string"`, else `"number"`.
	 */
	sort<T>(list: T[], key: string, compare_type?: "string" | "number", reverse?: boolean): T[];

	/** `utils.js:574-584`. Order-preserving de-duplication (uses `in`, so keys are stringified). */
	unique<T>(list: readonly T[]): T[];

	/**
	 * `utils.js:586-594`. Drops entries for which frappe's global `is_null()`
	 * is true (`null`, `undefined` and `""`). Typed as `T[]` because the
	 * predicate is not expressible: `""` is removed while `0` is kept.
	 */
	remove_nulls<T>(list: readonly T[]): T[];

	/** `utils.js:596-603`. Python's `all()`. */
	all(lst: readonly unknown[]): boolean;

	/** `utils.js:605-616`. Zips a key list against rows of positional values. */
	dict(keys: readonly string[], values: readonly (readonly unknown[])[]): Record<string, unknown>[];

	/** `utils.js:618-622`. `flt()`-coerced sum. */
	sum(list: readonly unknown[]): number;

	/** `utils.js:624-641`. Deep for nested arrays, `!==` otherwise. */
	arrays_equal(arr1: readonly unknown[] | null | undefined, arr2: readonly unknown[] | null | undefined): boolean;

	/** `utils.js:643-679`. Sorted-merge intersection; sorts copies first. */
	intersection<T>(a: readonly T[], b: readonly T[]): T[];

	/** `utils.js:1813-1819`. `undefined` for an empty/absent array, else the array. */
	parse_array<T>(array: readonly T[] | null | undefined): readonly T[] | undefined;

	/** `utils.js:1821-1831`. Python's `range`; a lone argument is the *end*. */
	range(start: number, end?: number): number[];

	/** `utils.js:2236-2242`. Subsequence (not contiguous-subarray) test. */
	is_sub_array(big: readonly unknown[], small: readonly unknown[]): boolean;

	/** `utils.js:1055-1057`. Delegates to the `fast-deep-equal` package. */
	deep_equal(a: unknown, b: unknown): boolean;

	// ------------------------------------------------------------------ files

	/**
	 * `utils.js:681-712`. Down-scales `reader.result` (a data URI) and calls
	 * back with a JPEG data URI. `max_width`/`max_height` default to 600/400.
	 */
	resize_image(
		reader: { result: string | ArrayBuffer | null },
		callback: (dataURL: string) => void,
		max_width?: number,
		max_height?: number
	): void;

	/** `utils.js:714-779`. RFC-4180-ish CSV split; rows of raw string cells. */
	csv_to_array(strData: string, strDelimiter?: string): string[][];

	/** `utils.js:804-809`. Extension test, query string tolerated. */
	is_image_file(filename?: string | null): boolean;

	/** `utils.js:811-816`. */
	is_video_file(filename?: string | null): boolean;

	/** `utils.js:1059-1071`. Middle-ellipsis that keeps the extension. */
	file_name_ellipsis(filename: string, length: number): string;

	/** `utils.js:1073-1085`. base64 data URI → decoded string. */
	get_decoded_string(dataURI: string): string;

	// -------------------------------------------------------------- documents

	/** `utils.js:781-783`. */
	warn_page_name_change(): void;

	/**
	 * `utils.js:785-795`. Sets `document.title`, applies
	 * `frappe._title_prefix`, and records the title against the current
	 * sub-path in `frappe.route_titles` so re-routing can restore it.
	 */
	set_title(title: string): void;

	/** `utils.js:797-802`. Re-applies `set_title` with a prefix. */
	set_title_prefix(prefix: string): void;

	/**
	 * `utils.js:929-947`. Desk form URL. **v16 routes are `/desk/...`, not
	 * `/app/...`** — see the note in the companion markdown.
	 */
	get_form_link(
		doctype: string,
		name: string,
		html?: boolean,
		display_text?: string | null,
		query_params_obj?: Record<string, unknown> | null
	): string;

	/** `utils.js:949-967`. Human label for a `/`-joined route string. */
	get_route_label(route_str: string): string;

	/** `meta_tag.js:8-18`. Opens/creates the `Website Route Meta` for `route`. */
	set_meta_tag(route: string): void;

	// ----------------------------------------------------------------- reports

	/**
	 * Column total for a report/datatable column.
	 *
	 * `utils.js:969-985`. Returns:
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
		column: DataTableTotalCell,
		type?: "mean"
	): number | "" | null;

	// ------------------------------------------------------------------- misc

	/** `utils.js:417-428`. Creates/updates/removes a `.footnote-area`. */
	set_footnote(
		footnote_area: JQuery<HTMLElement> | null | undefined,
		wrapper: JQuery<HTMLElement> | HTMLElement | string,
		txt: string | null | undefined
	): JQuery<HTMLElement> | null;

	/** `utils.js:430-436`. `a=1&b=2` → `{a: "1", b: "2"}` (single decode pass). */
	get_args_dict_from_url(txt: string): Record<string, string>;

	/** `utils.js:438-444`. Inverse of the above; drops `null` values. */
	get_url_from_dict(args: Record<string, unknown>): string;

	/**
	 * `utils.js:446-484`. Regex validation. An unrecognised `type` returns
	 * `false`, and an empty `val` always returns `false`.
	 */
	validate_type(val: string, type: FrappeValidationType | (string & {})): boolean;

	/**
	 * `utils.js:485-525`. Maps a status word onto a bootstrap style
	 * (`default`/`warning`/`danger`/`success`/`info`) or, with `_colour`, onto
	 * a colour name (`gray`/`orange`/`red`/`green`/`blue`).
	 */
	guess_style(text: string | null | undefined, default_style?: string | null, _colour?: boolean): string;

	/** `utils.js:527-529`. `guess_style(text, null, true)`. */
	guess_colour(text: string | null | undefined): string;

	/**
	 * `utils.js:531-549`. Async — reads the `Workflow State`'s `style` and maps
	 * it to a colour. `undefined` when the style is not one of
	 * Success/Warning/Danger/Primary.
	 */
	get_indicator_color(state: string): Promise<string | undefined>;

	/** `utils.js:818-833`. Plays `#sound-<name>`; silent for muted users. */
	play_sound(name: string): void;

	/** `utils.js:835-850`. Splits on commas/newlines outside quotes. */
	split_emails(txt: string | null | undefined): string[];

	/** `utils.js:852-859`. Evaluated once at module load, not a function. */
	supportsES6: boolean;

	/**
	 * `utils.js:860-892`. Underscore-style throttle. The wrapper returns the
	 * last result, which is `undefined` until `func` has run at least once.
	 */
	throttle<TArgs extends unknown[], TResult>(
		func: (...args: TArgs) => TResult,
		wait: number,
		options?: { leading?: boolean; trailing?: boolean }
	): (...args: TArgs) => TResult | undefined;

	/** `utils.js:893-928`. Underscore-style debounce plus `cancel`/`flush`. */
	debounce<TArgs extends unknown[]>(
		func: (...args: TArgs) => void,
		wait: number,
		immediate?: boolean
	): FrappeDebouncedFunction<TArgs>;

	/** `utils.js:986-1039`. Wires a `[data-element="search"]` box over `el_class` rows. */
	setup_search(
		$wrapper: JQuery<HTMLElement>,
		el_class: string,
		text_class: string,
		data_attr?: string
	): void;

	/** `utils.js:1041-1053`. Counts `start`→`end` into `$element`, 1 Hz. */
	setup_timer(start: number, end: number, $element: JQuery<HTMLElement>): void;

	/** `utils.js:1087-1104`. Uses the async clipboard API when available. */
	copy_to_clipboard(string: string, message?: string): void;

	/**
	 * `utils.js:1106-1108`. `["ar","he","fa","ps"]` membership test.
	 * Falls back to `frappe.boot.lang` when `lang` is omitted or `null`.
	 */
	is_rtl(lang?: string | null): boolean;

	/**
	 * `utils.js:1109-1121`. Delegates `click.class_actions` on `$el` so that
	 * `[data-action="method_name"]` invokes `object.method_name(event, $target)`.
	 * Unbinds the previous namespaced handler first, and returns `$el`
	 * unchanged.
	 *
	 * Used by frappe's own Grid at `frappe/public/js/frappe/form/grid.js:134`
	 * as `frappe.utils.bind_actions_with_object(this.wrapper, this)`.
	 */
	bind_actions_with_object<TEl extends JQuery<HTMLElement> | HTMLElement | string>(
		$el: TEl,
		object: object
	): TEl;

	/**
	 * `utils.js:1123-1159`. Compiles `code` (an `eval:`-prefixed expression is
	 * accepted) into `new Function(...names, "let out = <code>; return out")`
	 * with `context`'s keys as parameters, caching expressions under 500 chars.
	 * Rethrows both compile and run errors.
	 */
	eval(code: string, context?: Record<string, unknown>): unknown;

	/** `utils.js:1161-1184`. */
	get_browser(): FrappeBrowserInfo;

	/** `utils.js:1186-1214`. e.g. `"2d 3h 5m"`; `""` for a falsy value. */
	get_formatted_duration(value: number | null | undefined, duration_options?: FrappeDurationOptions | null): string;

	/** `utils.js:1216-1222`. Groups an IBAN in fours (skipped for BI/SV/EG/LY). */
	get_formatted_iban(value: string): string;

	/** `utils.js:1224-1244`. Truncates toward zero for negative inputs. */
	seconds_to_duration(seconds: number, duration_options?: FrappeDurationOptions | null): FrappeDurationParts;

	/** `utils.js:1246-1261`. */
	duration_to_seconds(days?: number, hours?: number, minutes?: number, seconds?: number): number;

	/**
	 * `utils.js:1263-1268`. Projects a Duration DocField's flags. Typed
	 * structurally so a full `DocField` (from `frappe-model-meta`) is
	 * assignable without this fragment depending on it.
	 */
	get_duration_options(docfield: { hide_days?: 0 | 1; hide_seconds?: 0 | 1 }): FrappeDurationOptions;

	/**
	 * `utils.js:1270-1278`. Indian ladder for BD/IN/MM/PK, Nepalese for Nepal,
	 * T/B/M/K otherwise.
	 */
	get_number_system(country?: string): FrappeNumberSystemUnit[];

	/** `utils.js:1280-1313`. Leaflet defaults; a data bag, not a function. */
	map_defaults: FrappeMapDefaults;

	/** `utils.js:1314-1370`. Resolves a Desktop Icon doc to a desk route. */
	get_route_for_icon(desktop_icon: Record<string, unknown> | null | undefined): string | undefined;

	/** `utils.js:1372-1392`. Letter-avatar HTML for a workspace/app tile. */
	desktop_icon(label: string, color?: string | null, size?: string): string;

	/** `utils.js:1394-1397`. Only `blue` and `gray` ship; indexed by colour name. */
	desktop_pallete: { blue: string; gray: string; [color: string]: string | undefined };

	/**
	 * Renders one of frappe's sprite icons as an HTML **string**.
	 *
	 * `utils.js:1398-1436`. Behaviour:
	 * - an emoji `icon_name` returns `<span>${icon_name}</span>` (`:1409-1411`);
	 * - a name starting with `es-` resolves to the espresso sprite (`#<name>`,
	 *   classes `es-icon es-line` or `es-icon es-solid`), anything else to the
	 *   timeless sprite (`#icon-<name>`, class `icon`) (`:1413,1420-1426`);
	 * - an **object** `size` is inlined as `width`/`height` in `style` instead
	 *   of adding an `icon-<size>` class (`:1414-1419`).
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

	/** `utils.js:1438-1440`. `<img>` from flagcdn.com for an ISO country code. */
	flag(country_code: string): string;

	/** `utils.js:1442-1444`. `\p{Extended_Pictographic}` test (with ZWJ sequences). */
	is_emoji(str: string): boolean;

	/** `utils.js:1446-1460`. Every code point in eight emoji blocks. */
	get_emojis(): string[];

	/**
	 * `utils.js:1462-1479`. Path to an app-supplied desktop icon SVG, or
	 * `false` when the app has none for that variant. **The falsy branch is
	 * `false`, not `null`.**
	 */
	get_desktop_icon(icon_name: string, variant: string): string | false;

	/** `utils.js:1481-1485`. */
	desktop_icon_exists(app_name: string, url: string): boolean;

	/** `utils.js:1486-1497`. Searches `frappe.boot.desktop_icons`. */
	get_desktop_icon_by_label(title: string, filters?: Record<string, unknown>): FrappeDesktopIconRecord | undefined;

	/**
	 * `utils.js:1499-1520`. Merges `custom_options` over frappe's defaults
	 * (`type: "bar"`, `colors: ["light-blue"]`, `axisOptions.xIsSeries` …) and
	 * constructs a `frappe.Chart`.
	 *
	 * Options are typed as an open record because the merge is a
	 * `for...in` over arbitrary keys with a one-level `Object.assign` for
	 * object-valued keys — there is no closed option set at this layer.
	 */
	make_chart(
		wrapper: string | HTMLElement | JQuery<HTMLElement>,
		custom_options?: Record<string, unknown>
	): FrappeBaseChart;

	/** `utils.js:1522-1525`. `shorten_number(label, country, 3)`. */
	format_chart_axis_number(label: number | string, country?: string): string;

	/**
	 * `utils.js:1526-1530`. **Mutates** `chart_args`, setting
	 * `axisOptions.seriesLabelSpaceRatio = 0.9` for >10 labels. Throws if
	 * `chart_args.data.labels` is absent.
	 */
	set_space_label_ratio(chart_args: {
		data: { labels: readonly unknown[] };
		axisOptions: Record<string, unknown>;
		[key: string]: unknown;
	}): void;

	/** `utils.js:1531-1621`. Builds a `/desk/...` route from a sidebar/shortcut item. */
	generate_route(item: FrappeGenerateRouteItem): string;

	/**
	 * `utils.js:1623-1669`. `"1.2 M"`-style abbreviation. Returns `""` for
	 * falsy/NaN input and the plain number string when it is shorter than
	 * `min_length` digits.
	 */
	shorten_number(
		number: number | string | null | undefined,
		country?: string,
		min_length?: number,
		max_no_of_decimals?: number
	): string;

	/** `utils.js:1671-1674`. */
	get_number_of_decimals(number: number): number;

	/** `utils.js:1676-1702`. Renders a report/dashboard summary chip. */
	build_summary_item(summary: FrappeSummaryItem): JQuery<HTMLElement>;

	/** `utils.js:1704-1726`. Opens `/printview` in a popup. */
	print(doctype: string, docname: string, print_format?: string, letterhead?: string, lang_code?: string): void;

	/** `utils.js:1728-1733`. Plain-text payload of a paste event. */
	get_clipboard_data(
		clipboard_paste_event: ClipboardEvent | { clipboardData?: DataTransfer | null; originalEvent?: ClipboardEvent }
	): string;

	/** `utils.js:1735-1746`. Appends (or prepends) a `<button>` into `wrapper`. */
	add_custom_button(
		html: string,
		action: ((event: JQueryEventLike) => void) | null,
		class_name?: string,
		title?: string,
		btn_type?: string,
		wrapper?: JQuery<HTMLElement>,
		prepend?: boolean
	): void;

	/** `utils.js:1748-1807`. Split button whose primary action follows the selection. */
	add_select_group_button(
		wrapper: JQuery<HTMLElement>,
		actions: readonly FrappeSelectGroupAction[],
		btn_type?: string,
		icon?: string,
		prepend?: boolean
	): JQuery<HTMLElement>;

	/** `utils.js:1809-1811`. `setTimeout` as a promise. */
	sleep(time: number): Promise<void>;

	/** `utils.js:1833-1839`. Reads frappe's `_link_titles` cache. */
	get_link_title(doctype: string, name: string): string | undefined;

	/** `utils.js:1841-1852`. Writes the cache. */
	add_link_title(doctype: string, name: string, value: string): void;

	/**
	 * `utils.js:1854-1868`. Server round-trip that populates the cache.
	 * Returns `undefined` (not a rejected promise) for a missing argument.
	 */
	fetch_link_title(doctype: string, name: string): Promise<string> | undefined;

	/** `utils.js:1870-1881`. Restricts an `<input>` to digits, `.` and `-`. */
	only_allow_num_decimal(input: JQuery<HTMLElement>): void;

	/**
	 * `utils.js:1883-1901`. `t/true/y/yes/1` → `true`, `f/false/n/no/0` →
	 * `false`, **anything else returns the original string**.
	 */
	string_to_boolean(string: string): boolean | string;

	/** `utils.js:1903-1914`. `[[dt, field, op, value], …]` → JSON `{field: [op, value]}`. */
	get_filter_as_json(filters: readonly (readonly unknown[])[]): string | null;

	/**
	 * `utils.js:1916-1919`. Evaluates `filter` with `new Function` — a filter
	 * expression string is executed, not parsed.
	 */
	process_filter_expression(filter: string | null | undefined): unknown[];

	/** `utils.js:1921-1927`. Drops a trailing 5-element legacy filter row. */
	cleanup_filters(filters: unknown[]): unknown[];

	/**
	 * `utils.js:1928-1977`. Two shapes, selected by `doctype`:
	 * with a `doctype` it returns `[doctype, field, op, value, false][]`;
	 * without one it returns a `{ field: [op, value][] }` map. Returns
	 * `undefined` for a falsy `filter_json`.
	 */
	get_filter_from_json(
		filter_json: string | null | undefined,
		doctype?: string
	): unknown[] | Record<string, unknown> | undefined;

	/** `utils.js:1979-1981`. `frappe.require("video_player.bundle.js")`. */
	load_video_player(): Promise<unknown>;

	/** `utils.js:1983-1985`. `user === frappe.session.user`. */
	is_current_user(user: string): boolean;

	/** `utils.js:1987-2006`. Development aid — installs a property setter trap. */
	debug: {
		/** `utils.js:1988-2005`. Shadows `prop` behind `$_<prop>_$`; not reversible. */
		watch_property(obj: Record<string, unknown>, prop: string, callback?: () => void): void;
	};

	/** `utils.js:2008-2101`. Opens the UTM tracking-URL prompt. */
	generate_tracking_url(): void;

	/**
	 * `utils.js:2103-2116`. `true` for `""`, `null`, `undefined`, `{}`, `[]`;
	 * `false` for `0`, `1`, `"hello"`, `{a:1}`, `[1]`.
	 */
	is_empty(value: unknown): boolean;

	/** `utils.js:2118-2142`. **Mutates** `obj`, replacing password-ish values with `*****`. */
	mask_passwords(obj: Record<string, unknown>): void;

	/** `utils.js:2144-2154`. Lazily loads highlight.js and marks up every `<pre>`. */
	highlight_pre($wrapper: JQuery<HTMLElement>): void;

	/** `utils.js:2156-2164`. */
	can_upload_public_files(): boolean;

	/** `utils.js:2166-2190`. Navbar Help dropdown entries. */
	get_help_siblings(): FrappeHelpDropdownItem[];

	/** `utils.js:2192-2206`. Route-scoped help links from `frappe.help.help_links`. */
	get_custom_help_links(): unknown[];

	/**
	 * `utils.js:2208-2229`. If `value` is a string of digits and arithmetic
	 * operators it is `eval`'d; otherwise `value` is returned unchanged.
	 */
	eval_expression(value: unknown, number_format?: string): unknown;

	/** `utils.js:2231-2235`. `frappe.boot.app_data.map(a => a.app_name)`. */
	get_installed_apps(): string[];

	// ------------------------------------------------ query_string.js (v16.33)

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

	/** `utils/common.js:281-315`. Strips `<script>`/alert-ish calls and escapes HTML. */
	xss_sanitise(string: string, options?: { strategies?: ReadonlyArray<"html" | "js"> }): string;

	/**
	 * `utils/common.js:317-336`. `""` for a cross-origin or unparseable URL;
	 * a falsy input is **passed through unchanged** so callers' fallbacks work.
	 */
	sanitise_redirect(url: string): string;

	/** `utils/common.js:338-343`. Trims junk before a protocol, `//` or `#`. */
	strip_url(url: string): string;

	/**
	 * `utils/common.js:345-400`. Opens the Auto Repeat prompt for a form.
	 * `frm` is a `frappe.ui.form.Form` (declared by `frappe-ui-form`); left
	 * open here so this fragment does not fix that group's export name.
	 */
	new_auto_repeat_prompt(frm: object): void;

	/**
	 * `utils/common.js:402-406`. `frappe.call` wrapper; resolves with the
	 * standard `{ message }` envelope.
	 */
	get_page_view_count(route: string): Promise<{ message?: number }>;

	// ------------------------------------------------------- event_emitter.js

	/**
	 * Mixes the jQuery-backed event emitter into `object` **in place** and
	 * returns the same object (`event_emitter.js:31-34`).
	 *
	 * This is how `frappe.router` acquires `on`/`off`/`once`/`trigger`
	 * (`router.js:698`), so a static declaration has to model the router as
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
	 * `frappe.router` fires `trigger("change", this)` (`router.js:152`), i.e.
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
	 * working unsubscribe on this mixin as of v16.33.0.
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
 * The desk view slugs `frappe.router.list_views` ships with in v16.33.0
 * (`router.js:77-88`).
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
 * (`router.js:76`). `frappe.views[<TitleCase>Factory]` must exist for the
 * router to dispatch to it (`router.js:308`).
 */
export type FrappeFactoryView = "form" | "list" | "report" | "tree" | "print" | "dashboard";

/**
 * An entry of `frappe.router.routes` — built in `setup()` from
 * `frappe.boot.user.can_read` and `frappe.boot.doctype_layouts`
 * (`router.js:115-128`).
 */
export interface FrappeDoctypeRoute {
	doctype: string;
	/** Present only for routes created from a `DocType Layout`. */
	doctype_layout?: string;
}

/**
 * A standard route: the array form frappe passes around internally, e.g.
 * `["Form", "User", "user-001"]` or `["List", "ToDo", "Report"]`.
 * `router.js:163-193` documents the mapping from URL paths.
 */
export type FrappeStandardRoute = string[];

/**
 * The `frappe.router` object literal — `router.js:73-671`.
 *
 * Everything below is a member of that literal **except** the three
 * runtime-assigned fields (`current_sub_path`, `meta`, `doctype_layout`),
 * which are set during routing and therefore declared optional.
 *
 * The emitter half (`on`/`off`/`once`/`trigger`/`init`/`jq`) is mixed in at
 * `router.js:698` via `frappe.utils.make_event_emitter(frappe.router)`; see
 * {@link FrappeRouter}.
 */
export interface FrappeRouterBase {
	/**
	 * The current standard route, e.g. `["Form", "ToDo", "abc"]`.
	 * `router.js:74` initialises it to `null`; `route()` assigns it
	 * (`router.js:147`) before the first `"change"` event fires, so any
	 * `"change"` handler sees an array.
	 */
	current_route: FrappeStandardRoute | null;

	/** `router.js:75`, populated by {@link FrappeRouterBase.setup}. Keyed by doctype slug. */
	routes: Record<string, FrappeDoctypeRoute | undefined>;

	/** `router.js:76`. See {@link FrappeFactoryView}. */
	factory_views: string[];

	/** `router.js:77-88`. See {@link FrappeListViewSlug}. */
	list_views: string[];

	/**
	 * `router.js:89-102`. Slug → title-cased view name. Note it carries three
	 * keys that are **not** in `list_views`: `file`, `home` (both → `"Home"`)
	 * and the `map` entry. Lookups are unchecked (`router.js:230,249,278`), so
	 * an unknown slug yields `undefined` and lands in the route array as such.
	 */
	list_views_route: Record<string, string | undefined>;

	/** `router.js:103`. Reserved; empty in v16.33.0. */
	layout_mapped: Record<string, unknown>;

	/** Assigned by `route()` at `router.js:146`. Absent before the first route. */
	current_sub_path?: string;

	/**
	 * Assigned by `set_doctype_route()` at `router.js:204` from
	 * `frappe.get_meta(doctype)`.
	 *
	 * Left `unknown` on purpose: the DocType meta shape is owned by the
	 * `frappe-model-meta` group, and nothing in this slice reads it. Re-point
	 * this at that group's meta type when assembling the package.
	 */
	meta?: unknown;

	/** Assigned by `set_doctype_route()` at `router.js:237`; `undefined` for plain doctypes. */
	doctype_layout?: string;

	/**
	 * `router.js:105-113`. `true` when the path's first segment is `desk`.
	 * Returns **`undefined`** for an empty path and for a path whose first
	 * segment is empty — it is not a total predicate.
	 */
	is_app_route(path: string | null | undefined): boolean | undefined;

	/** `router.js:115-128`. Builds `routes` from boot info. */
	setup(): void;

	/**
	 * `router.js:130-153`. Resolves the URL, renders the page, sets the title
	 * and finally fires `trigger("change", this)`.
	 */
	route(): Promise<void>;

	/** `router.js:155-161`. URL (or `route`) → standard route. */
	parse(route?: string): Promise<FrappeStandardRoute>;

	/** `router.js:163-193`. Workspace / private-workspace / doctype dispatch. */
	convert_to_standard_route(route: string[]): Promise<FrappeStandardRoute>;

	/** `router.js:195-198`. */
	doctype_route_exist(route: string): FrappeDoctypeRoute | undefined;

	/** `router.js:200-240`. Loads the doctype meta, then picks Form/List/Tree. */
	set_doctype_route(route: string[]): Promise<FrappeStandardRoute>;

	/**
	 * `router.js:242-286`. May **re-route** as a side effect when
	 * `force_re_route_to_default_view` disagrees with the URL
	 * (`router.js:269-273`).
	 */
	get_standard_route_for_list(
		route: string[],
		doctype_route: FrappeDoctypeRoute,
		default_view: string | null
	): FrappeStandardRoute;

	/**
	 * `router.js:288-291`. Pushes `current_route` onto `frappe.route_history`
	 * and closes any open dialog. Declared with no parameters: `route()` calls
	 * it as `this.set_history(sub_path)` (`router.js:149`) but the
	 * implementation ignores the argument.
	 */
	set_history(): void;

	/** `router.js:293-300`. */
	render(): void;

	/** `router.js:302-323`. Instantiates `frappe.views.<X>Factory` and shows it. */
	render_page(): void;

	/** `router.js:325-342`. `true` when a re-route was performed, else `undefined`. */
	re_route(sub_path: string): true | undefined;

	/** `router.js:344-348`. Restores a remembered title for `sub_path`. */
	set_title(sub_path: string): void;

	/**
	 * `router.js:350-387`. Push-state navigation. Accepts
	 * `set_route("a","b","c")`, `set_route(["a","b","c"])` or
	 * `set_route("a/b/c")` (`router.js:352-355, 389-415`); a plain-object
	 * argument becomes `frappe.route_options` (`router.js:461-464`).
	 *
	 * Resolves ~100 ms later, after `frappe.after_ajax` drains.
	 */
	set_route(route: readonly (string | number | Record<string, unknown>)[]): Promise<void>;
	set_route(route: string): Promise<void>;
	set_route(...route: (string | number | Record<string, unknown>)[]): Promise<void>;

	/** `router.js:389-415`. Normalises the `arguments` array of `set_route`. */
	get_route_from_arguments(route: unknown[]): string[];

	/** `router.js:417-447`. Standard route → URL segments. */
	convert_from_standard_route(route: readonly (string | Record<string, unknown>)[]): string[];

	/** `router.js:449-458`. Lower-cases a factory view and slugs the doctype. */
	slug_parts(route: string[]): string[];

	/**
	 * `router.js:460-485`. Joins encoded segments into `/desk/<path>`.
	 * A plain-object member is consumed as `frappe.route_options` and dropped
	 * from the path. Always returns `"/desk"` when nothing is left.
	 */
	make_url(params: readonly (string | number | Record<string, unknown>)[]): string;

	/**
	 * `router.js:487-504`. `history.pushState`/`replaceState` (chosen by
	 * `frappe.route_flags.replace_route`) followed by `route()`. No-ops when
	 * the location already matches.
	 */
	push_state(path: string, query_params?: string): void;

	/** `router.js:506-513`. Defaults to `window.location.pathname`. */
	get_sub_path_string(route?: string): string;

	/** `router.js:515-523`. Removes a leading `/`, `desk/`, `#` or `!`. */
	strip_prefix(route: string): string;

	/** `router.js:525-530`. `strip_prefix` + per-segment `decodeURIComponent`. */
	get_sub_path(route?: string): string;

	/**
	 * `router.js:532-549`. Merges `location.search` (and a stashed
	 * `localStorage["route_options"]`, which it consumes) into
	 * `frappe.route_options`.
	 */
	set_route_options_from_url(): void;

	/** `router.js:551-562`. `decodeURIComponent` that swallows `URIError`. */
	decode_component(r: string): string;

	/** `router.js:564-566`. `name.toLowerCase().replace(/ /g, "-")`. Throws on a nullish name. */
	slug(name: string): string;

	/**
	 * `router.js:568-670`. Shows the "external link" confirmation dialog when
	 * `frappe.boot.show_external_link_warning` is `"Ask"`/`"Always"`.
	 * Returns `true` when the click should be cancelled. Never throws — the
	 * whole body is wrapped in a try/catch that returns `false`.
	 */
	show_external_link_warning_if_needed(aElement: HTMLAnchorElement | null | undefined): boolean;
}

/**
 * `frappe.router` as it actually exists at runtime: the literal plus the
 * event-emitter mixin applied at `router.js:698`.
 *
 * The only event frappe itself fires is `"change"`, from `route()`
 * (`router.js:152`), with the router as the payload.
 *
 * Declared with **non-optional** `on`, deliberately: carbon_frappe guards its
 * subscriptions with `typeof frappe.router.on === "function"`
 * (`anatomy/editable_title.js:78`, `anatomy/ui_shell.js:182`), and a `typeof`
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

/** A concrete desk theme. `ui/theme_switcher.js:158-162`. */
export type DeskTheme = "light" | "dark";

/**
 * The value of `data-theme-mode` on `<html>`.
 * `ui/theme_switcher.js:48,129,148` — `"automatic"` resolves to light/dark via
 * `prefers-color-scheme` at `set_theme` time.
 */
export type DeskThemeMode = "light" | "dark" | "automatic";

/**
 * The theme slice of `frappe.ui` — `frappe/public/js/frappe/ui/theme_switcher.js:146-167`.
 */
export interface FrappeUiThemeSlice {
	/** `theme_switcher.js:152`. `window.matchMedia("(prefers-color-scheme: dark)")`. */
	dark_theme_media_query: MediaQueryList;

	/** `theme_switcher.js:146-150`. Re-runs `set_theme()` when the OS theme flips. */
	add_system_theme_switch_listener(): void;

	/**
	 * Writes `data-theme` on `document.documentElement`.
	 *
	 * `theme_switcher.js:154-163`. **It emits no event and publishes nothing
	 * over realtime** — an attribute write is the entire notification
	 * mechanism, which is why carbon_frappe observes the attribute with a
	 * `MutationObserver` (`public/js/carbon_charts.bundle.js:152-158`).
	 *
	 * Calling it with no argument resolves the theme from `data-theme-mode`;
	 * if that attribute is absent the value written is the string `"null"`
	 * (`root.setAttribute("data-theme", theme || theme_mode)` with both
	 * nullish), so readers must tolerate a non-theme string.
	 */
	set_theme(theme?: DeskTheme | (string & {}) | null): void;

	/** `theme_switcher.js:165-167`. Reads the attribute back; `null` before any write. */
	get_current_theme(): DeskTheme | (string & {}) | null;
}

/**
 * The jQuery regions a `frappe.ui.Page` exposes, assigned in one block at
 * `frappe/public/js/frappe/ui/page.js:133-168`.
 *
 * Declared as a standalone interface so the group that owns the full
 * `frappe.ui.Page` class can write `declare class Page implements
 * FrappePageRegions` (or `interface Page extends FrappePageRegions`) rather
 * than this fragment re-declaring a 940-line class it does not own.
 *
 * Every member is a jQuery object, **not** an element: consumers call jQuery
 * methods straight on them, e.g.
 * `this.parent.page.main.parent().addClass("list-view")`
 * (`carbon_frappe/public/js/tables/list/list_view.js:204`).
 */
export interface FrappePageRegions {
	/** `page.js:44`. `$(this.parent)` — the page's outermost node. */
	wrapper: JQuery<HTMLElement>;

	/**
	 * `page.js:142`. `.layout-main-section`.
	 * `body` and {@link FrappePageRegions.main} are assigned in the same
	 * statement and are the **same jQuery object**, not two views of it.
	 */
	body: JQueryRegion;

	/**
	 * `page.js:142`. Alias of {@link FrappePageRegions.body} — literally the same
	 * jQuery object.
	 *
	 * Both are a {@link JQueryRegion} (gaps.md §6.12). This one is a `find()`,
	 * not a literal template, so it earns the guarantee differently: `make_view()`
	 * inserts a `.layout-main-section` div on BOTH of its branches
	 * (`page.js:100-120`) and `setup_page()` reads it back immediately after
	 * (`page.js:132-142`), so the selector cannot miss. It is the mount point a
	 * replacement list/report renderer attaches to.
	 */
	main: JQueryRegion;

	/** `page.js:143`. `.page-body`. */
	container: JQuery<HTMLElement>;

	/** `page.js:144`. `.layout-side-section`. */
	sidebar: JQuery<HTMLElement>;

	/** `page.js:145`. `.layout-footer`. */
	footer: JQuery<HTMLElement>;

	/** `page.js:146`. `.title-area .indicator-pill`. */
	indicator: JQuery<HTMLElement>;

	/** `page.js:134`. `.title-area`. */
	$title_area: JQuery<HTMLElement>;

	/** `page.js:136`. The `<h6>` under the title. */
	$sub_title_area: JQuery<HTMLElement>;

	/** `page.js:148`. `.page-actions`. */
	page_actions: JQuery<HTMLElement>;

	/** `page.js:149`. `.filters`. */
	filters: JQuery<HTMLElement>;

	/** `page.js:150`. `.page-head`. */
	page_head: JQuery<HTMLElement>;

	/** `page.js:151`. */
	btn_primary: JQuery<HTMLElement>;

	/** `page.js:152`. */
	btn_secondary: JQuery<HTMLElement>;

	/** `page.js:154`. `.menu-btn-group .dropdown-menu`. */
	menu: JQuery<HTMLElement>;

	/** `page.js:155`. */
	menu_btn_group: JQuery<HTMLElement>;

	/** `page.js:157`. `.actions-btn-group .dropdown-menu`. */
	actions: JQuery<HTMLElement>;

	/** `page.js:158`. */
	actions_btn_group: JQuery<HTMLElement>;

	/** `page.js:160`. */
	standard_actions: JQuery<HTMLElement>;

	/** `page.js:161`. */
	custom_actions: JQuery<HTMLElement>;

	/** `page.js:162`. */
	custom_mobile_actions: JQuery<HTMLElement>;

	/** `page.js:164`. `.page-form.row.hide`, prepended into `main`. */
	page_form: JQuery<HTMLElement>;

	/** `page.js:165`. Alias of {@link FrappePageRegions.custom_actions}. */
	inner_toolbar: JQuery<HTMLElement>;

	/** `page.js:166`. `.page-icon-group`. */
	icon_group: JQuery<HTMLElement>;
}

/**
 * Constructor options for {@link Page}.
 *
 * `page.js:30-31` is `$.extend(this, opts)`, so every key lands on the instance
 * verbatim — hence the open index signature. The named members are the ones
 * `page.js` itself reads.
 */
export interface PageOptions {
	/** `page.js:44` — `this.wrapper = $(this.parent)`. Required. */
	parent: HTMLElement | JQuery;
	/** Applied by `setup_page()` via `set_title` (page.js:137). */
	title?: string;
	/** `page.js:139` — passed to `get_main_icon()`. */
	icon?: string;
	/** `page.js:96` — picks the single- vs two-column `layout-main` markup. */
	single_column?: boolean;
	/** `page.js:120` — `"Right"` moves `.layout-side-section` after the main section. */
	sidebar_position?: "Left" | "Right";
	/**
	 * `page.js:40` — the constructor only defaults it to `false` when the key is
	 * ABSENT from `opts` (`Object.keys(opts).includes("hide_sidebar")`), so
	 * passing it explicitly (even as `undefined`) is meaningful.
	 */
	hide_sidebar?: boolean;
	/** `page.js:92` — handed straight to `frappe.require`. */
	required_libs?: string | string[];
	/** `page.js:168-170` — called at the end of `setup_page()` if present. */
	make_page?(): void;
	/** `$.extend(this, opts)` (page.js:30) copies anything else onto the instance. */
	[option: string]: unknown;
}

/**
 * `frappe.ui.Page` — `frappe/public/js/frappe/ui/page.js:29`
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
 * Everything here is read out of `page.js` at v16.33.0; citations are
 * `page.js:line`.
 */
export declare class Page {
	constructor(opts: PageOptions);

	// ---- merged from opts (page.js:30) ----

	/** `page.js:44` — the element the page template is appended to. */
	parent: HTMLElement | JQuery;
	/** See {@link PageOptions.single_column}. */
	single_column?: boolean;
	/** See {@link PageOptions.sidebar_position}. */
	sidebar_position?: "Left" | "Right";
	/** See {@link PageOptions.required_libs}. */
	required_libs?: string | string[];
	/** `page.js:168-170`. App-supplied; called once from `setup_page()`. */
	make_page?(): void;

	// ---- set in the constructor (page.js:32-41) ----

	/** `page.js:32`. Always `true`; consulted by `frappe.utils.set_title` callers. */
	set_document_title: boolean;
	/** `page.js:33`. Reserved by the constructor; `page.js` itself never writes to it. */
	buttons: Record<string, JQuery<HTMLElement> | undefined>;
	/**
	 * `page.js:34`, populated by `add_field` (page.js:889) keyed by
	 * `df.fieldname || df.label`. The values are `frappe.ui.form.make_control`
	 * results.
	 */
	fields_dict: Record<string, PageControl | undefined>;
	/** `page.js:35`, populated by `add_view` (page.js:918). */
	views: Record<string, JQuery<HTMLElement> | undefined>;
	/**
	 * `page.js:40` — `false` unless `opts` carried the key. Not optional: the
	 * constructor always ends up assigning it one way or the other.
	 */
	hide_sidebar: boolean;

	// ---- set later ----

	/** The stripped title, written by `set_title` (page.js:730). */
	title?: string;
	/** `page.js:190-208` — the "Navigate to main content" skip link, appended to `sidebar`. */
	skip_link_to_main: JQuery<HTMLElement>;
	/** The `.dropdown-divider.user-action` lazily created by `add_dropdown_item` (page.js:497-502). */
	divider?: JQuery<HTMLElement>;
	/** `page.js:920-923` — the first view added wins; `set_view` reassigns it. */
	current_view?: JQuery<HTMLElement>;
	/** `page.js:935`. `undefined` until the first `set_view`. */
	current_view_name?: string;
	/** `page.js:934`. */
	previous_view_name?: string;

	// ---- lifecycle ----

	/** `page.js:43-49`. Called by the constructor (page.js:38). */
	make(): void;
	/** `page.js:51-56`. No-op unless `frappe.boot.desk_settings.search_bar` and mobile. */
	setup_mobile_awesomebar(): void;
	/** `page.js:58-74`. Throttled `.main-section` scroll shadow. */
	setup_scroll_handler(): void;
	/** `page.js:95-131`. Renders the `page` template and the `main` view. */
	add_main_section(): void;
	/** `page.js:133-208`. Assigns every region in {@link FrappePageRegions}. */
	setup_page(): void;
	/** `page.js:249-255`. */
	setup_main_sidebar_toggle(): void;
	/** `page.js:91-93`. `frappe.require(this.required_libs, callback)`. */
	load_lib(callback: () => void): void;
	/** `page.js:76-89`. Returns a detached `.page-card-container`; the caller appends it. */
	get_empty_state(title: string, message: string, primary_action: string): JQuery<HTMLElement>;

	// ---- title / indicator ----

	/** `page.js:720-722`. */
	get_title_area(): JQuery<HTMLElement>;
	/**
	 * `page.js:724-742`. `strip` runs the title through `strip_html`;
	 * `tab_title` overrides what goes to `frappe.utils.set_title`.
	 */
	set_title(
		title: string,
		icon?: string | null,
		strip?: boolean,
		tab_title?: string,
		tooltip_label?: string
	): void;
	/** `page.js:744-747`. Hides `$sub_title_area` when `txt` is falsy. */
	set_title_sub(txt: string): void;
	/** `page.js:749-754`. Sets a Font-Awesome `<i>` in `.title-icon`. */
	get_main_icon(icon: string): JQuery<HTMLElement>;
	/** `page.js:210-222`. `color` is used as `var(--${color}-400)` on mobile. */
	set_indicator(label: string, color: FrappeIndicator): void;
	/** `page.js:257-261`. Resets the pill's classes and returns it. */
	clear_indicator(): JQuery<HTMLElement>;

	// ---- primary / secondary / icon actions ----

	/**
	 * `page.js:263-273`. `icon` may be a bare name or `{ icon, size }`;
	 * the result is the button's inner HTML.
	 */
	get_icon_label(icon: string | PageIconSpec | null | undefined, label: string): string;
	/** `page.js:275-299`. Rebinds `btn`'s click and registers its alt-shortcut. */
	set_action(btn: JQuery<HTMLElement>, opts: PageActionOptions): void;
	/** `page.js:301-309`. Returns `btn_primary`. */
	set_primary_action(
		label: string,
		click: PageActionClick,
		icon?: string | PageIconSpec,
		working_label?: string
	): JQuery<HTMLElement>;
	/** `page.js:311-320`. Returns `btn_secondary`. */
	set_secondary_action(
		label: string,
		click: PageActionClick,
		icon?: string | PageIconSpec,
		working_label?: string
	): JQuery<HTMLElement>;
	/** `page.js:322-324`. */
	clear_action_of(btn: JQuery<HTMLElement>): void;
	/** `page.js:326-328`. */
	clear_primary_action(): void;
	/** `page.js:330-332`. */
	clear_secondary_action(): void;
	/** `page.js:334-337`. Both of the above. */
	clear_actions(): void;
	/** `page.js:339-341`. Empties `custom_actions`. */
	clear_custom_actions(): void;
	/** `page.js:343-346`. Empties `icon_group`. */
	clear_icons(): void;
	/** `page.js:224-247`. Appends a tooltipped icon button to `icon_group`. */
	add_action_icon(
		icon: string,
		click: PageActionClick,
		css_class?: string,
		tooltip_label?: string
	): JQuery<HTMLElement>;
	/**
	 * `page.js:596-608`. Disables `btn` while `response` is pending — it
	 * duck-types BOTH a `Promise` (`.then`/`.finally`) and a jqXHR (`.always`),
	 * which is why the parameter is `unknown` rather than `Promise<unknown>`.
	 */
	btn_disable_enable(btn: JQuery<HTMLElement>, response: unknown): void;

	// ---- menu / actions dropdowns ----

	/** `page.js:349-358`. */
	add_menu_item(
		label: string,
		click: PageActionClick,
		standard?: boolean,
		shortcut?: string | PageShortcut,
		show_parent?: boolean
	): JQuery<HTMLElement>;
	/** `page.js:360-369`. */
	add_custom_menu_item(
		parent: JQuery<HTMLElement>,
		label: string,
		click: PageActionClick,
		standard?: boolean,
		shortcut?: string | PageShortcut,
		icon?: string | null
	): JQuery<HTMLElement>;
	/** `page.js:401-408`. */
	add_action_item(
		label: string,
		click: PageActionClick,
		standard?: boolean
	): JQuery<HTMLElement>;
	/** `page.js:410-419`. */
	add_actions_menu_item(
		label: string,
		click: PageActionClick,
		standard?: boolean,
		shortcut?: string | PageShortcut
	): JQuery<HTMLElement>;
	/**
	 * `page.js:437-511`. The one primitive the four helpers above delegate to.
	 * Returns the EXISTING `<a>` when a same-labelled item is already present
	 * (page.js:451-452), so it is safe to call twice.
	 */
	add_dropdown_item(opts: PageDropdownItemOptions): JQuery<HTMLElement>;
	/** `page.js:371-373`. */
	clear_menu(): void;
	/** `page.js:375-377`. */
	show_menu(): void;
	/** `page.js:379-381`. */
	hide_menu(): void;
	/** `page.js:383-385`. */
	show_icon_group(): void;
	/** `page.js:387-389`. */
	hide_icon_group(): void;
	/** `page.js:393-395`. */
	show_actions_menu(): void;
	/** `page.js:397-399`. */
	hide_actions_menu(): void;
	/** `page.js:421-423`. */
	clear_actions_menu(): void;
	/** `page.js:715-717`. Removes only the `.user-action` items from `menu`. */
	clear_user_actions(): void;
	/** `page.js:556-559`. Empties `parent` and hides its wrapper. */
	clear_btn_group(parent: JQuery<HTMLElement>): void;
	/** `page.js:561-563`. Appends an `<li class="dropdown-divider">` to `menu`. */
	add_divider(): JQuery<HTMLElement>;
	/**
	 * `page.js:514-538`. **Mutates** the `shortcut` object it is given (or wraps a
	 * string in a fresh one) and stamps `page` onto it.
	 */
	prepare_shortcut_obj(
		shortcut: string | PageShortcut,
		click: PageActionClick,
		label: string
	): PageShortcut;
	/**
	 * `page.js:545-554`. Returns the matching jQuery set, or `false` when nothing
	 * matches or when `label`/`parent` is missing — the falsy union is load-bearing
	 * at page.js:451 and page.js:643.
	 */
	is_in_group_button_dropdown(
		parent: JQuery<HTMLElement> | HTMLElement | null | undefined,
		selector: string | null | undefined,
		label: string | null | undefined
	): JQuery<HTMLElement> | false;

	// ---- inner toolbar (the `.custom-actions` strip) ----

	/** `page.js:565-581`. Creates the group on first call; keyed by `label`. */
	get_or_add_inner_group_button(label: string, align_right?: boolean): JQuery<HTMLElement>;
	/** `page.js:583-587`. May be an EMPTY jQuery set — check `.length`. */
	get_inner_group_button(label: string): JQuery<HTMLElement>;
	/** `page.js:589-594`. */
	set_inner_btn_group_as_primary(label: string): void;
	/** `page.js:609-612`. */
	add_divider_to_button_group(group: string): void;
	/**
	 * `page.js:622-666`. Returns the button (no group) or the dropdown `<a>`
	 * (grouped) — and **`undefined`** when a same-labelled item already exists in
	 * the group (page.js:643 falls through with no `return`).
	 */
	add_inner_button(
		label: string,
		action: () => unknown,
		group?: string,
		type?: string,
		align_right?: boolean
	): JQuery<HTMLElement> | undefined;
	/** `page.js:668-684`. Accepts one label or a list; translates each. */
	remove_inner_button(label: string | string[], group?: string): void;
	/** `page.js:686-701`. Rewrites the button's class to `btn btn-${type} ellipsis`. */
	change_inner_button_type(label: string, group: string | undefined, type: string): void;
	/** `page.js:703-709`. Replaces any existing `.inner-page-message`. */
	add_inner_message(message: string): JQuery<HTMLElement>;
	/** `page.js:711-713`. */
	clear_inner_toolbar(): void;

	// ---- custom buttons ----

	/** `page.js:756-758`. **A no-op in v16** — the body is empty. */
	add_help_button(txt: string): void;
	/** `page.js:760-776`. Appends to `custom_actions` and mirrors into the menu. */
	add_button(
		label: string,
		click: PageActionClick,
		opts?: PageButtonOptions
	): JQuery<HTMLElement>;
	/**
	 * `page.js:778-809`. Returns the group's `.dropdown-menu` — the thing you pass
	 * to {@link Page.add_custom_menu_item} — not the group itself.
	 */
	add_custom_button_group(
		label: string,
		icon?: string | null,
		parent?: JQuery<HTMLElement>
	): JQuery<HTMLElement>;
	/** `page.js:811-813`. Delegates to `frappe.ui.toolbar.add_dropdown_button`. */
	add_dropdown_button(
		parent: JQuery<HTMLElement>,
		label: string,
		click: PageActionClick,
		icon?: string
	): void;

	// ---- the `.page-form` filter row ----

	/** `page.js:816-821`. */
	add_label(label: string): JQuery<HTMLElement>;
	/** `page.js:822-825`. Returns the `<select>`, already populated. */
	add_select(label: string, options: unknown): JQuery<HTMLElement>;
	/** `page.js:826-829`. Returns the `<input>`. */
	add_data(label: string): JQuery<HTMLElement>;
	/** `page.js:830-833`. Returns the `<input>`. */
	add_date(label: string, date?: string): JQuery<HTMLElement>;
	/** `page.js:834-838`. Returns the checkbox `<input>`. */
	add_check(label: string): JQuery<HTMLElement>;
	/** `page.js:839-842`. */
	add_break(): void;
	/**
	 * `page.js:843-891`. **Mutates `df`** (`placeholder`, `input_class`) and
	 * returns `undefined` for `fieldtype: "HTML"` (page.js:874-876).
	 */
	add_field(df: PageFieldDef, parent?: JQuery<HTMLElement>): PageControl | undefined;
	/** `page.js:892-897`. */
	restyle_field(f: PageControl): void;
	/** `page.js:898-900`. Empties `page_form`; does NOT clear `fields_dict`. */
	clear_fields(): void;
	/** `page.js:901-903`. */
	show_form(): void;
	/** `page.js:904-906`. */
	hide_form(): void;
	/** `page.js:907-914`. One entry per `fields_dict` key. */
	get_form_values(): Record<string, unknown>;

	// ---- views ----

	/** `page.js:915-927`. Appends into `.page-content`; the first view added is shown. */
	add_view(name: string, html: string | JQuery<HTMLElement>): JQuery<HTMLElement>;
	/** `page.js:928-939`. No-op when `name` is already current. Triggers `"view-change"`. */
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
 * name, or `{ icon, size }` (page.js:266-269).
 */
export interface PageIconSpec {
	icon: string;
	/** Defaults to `"xs"` (page.js:269). */
	size?: FrappeIconSize;
}

/**
 * A Page action callback. `page.js:290` calls it as
 * `opts.click.apply(this, [btn])` with `this` bound to the raw button element,
 * and `page.js:291` feeds the return value to
 * {@link Page.btn_disable_enable} — so returning a Promise or a jqXHR is
 * meaningful, and returning nothing is fine.
 */
export type PageActionClick = (button?: JQuery<HTMLElement>) => unknown;

/** Options for {@link Page.set_action} — `page.js:275-299`. */
export interface PageActionOptions {
	label: string;
	click: PageActionClick;
	/** `page.js:277-279` — replaced by `iconHTML` when present. */
	icon?: string | PageIconSpec;
	/** `page.js:278` writes this back onto the options object. */
	iconHTML?: string;
	/** `page.js:293-295` — written to `data-working-label`. */
	working_label?: string;
}

/** Options for {@link Page.add_dropdown_item} — `page.js:437-445`. */
export interface PageDropdownItemOptions {
	label: string;
	click: PageActionClick;
	/** `page.js:493-503` — `true` appends to `parent`, `false` inserts above the user-action divider. */
	standard?: boolean;
	/** The `<ul>` the item goes into. */
	parent: JQuery<HTMLElement>;
	shortcut?: string | PageShortcut;
	/** Defaults to `true` (page.js:444) — un-hides the dropdown's button. */
	show_parent?: boolean;
	/** Defaults to `null` (page.js:445). */
	icon?: string | null;
}

/**
 * A `frappe.ui.keys` shortcut descriptor as {@link Page.prepare_shortcut_obj}
 * leaves it (page.js:514-538). The method fills in every optional member, so a
 * caller only has to supply `shortcut`.
 */
export interface PageShortcut {
	/** e.g. `"ctrl+s"`. Lowercased in place at page.js:526. */
	shortcut: string;
	/** Added at page.js:523 from `frappe.ui.keys.get_shortcut_label`. */
	shortcut_label?: string;
	/** Defaults to the item's `click` (page.js:528-530). */
	action?: PageActionClick;
	/** Defaults to the item's `label` (page.js:532-534). */
	description?: string;
	/** Stamped at page.js:536. */
	page?: Page;
	[key: string]: unknown;
}

/** Options for {@link Page.add_button} — `page.js:760-763`. */
export interface PageButtonOptions {
	/** Defaults to `"btn-default"`. */
	btn_class?: string;
	/** Defaults to `"btn-sm"`. */
	btn_size?: string;
	icon?: string;
}

/**
 * The docfield-ish object {@link Page.add_field} takes. It is a partial DocField
 * — `page.js:846-851` only requires `fieldtype`, and mutates `placeholder` and
 * `input_class` — so it is declared open rather than as a full `DocField`.
 */
export interface PageFieldDef {
	fieldtype: string;
	label?: string;
	fieldname?: string;
	/** Set to `df.label` when absent (page.js:846-848). */
	placeholder?: string;
	/** Forced to `"input-xs"` (page.js:850). */
	input_class?: string;
	default?: unknown;
	parent?: string;
	[property: string]: unknown;
}

/**
 * What `frappe.ui.form.make_control` hands back to a Page (page.js:852-856).
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
	/** `page.js:29`. */
	Page: typeof Page;
	/**
	 * `page.js:27` — `frappe.ui.pages = {}`, keyed by `frappe.get_route_str()`
	 * (page.js:41). A route with no page yet reads back `undefined`.
	 */
	pages: Record<string, Page | undefined>;
	/**
	 * `page.js:22-25`. Constructs a `Page`, stamps it onto `opts.parent.page`,
	 * and returns it.
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
 * `data-theme` is written **only** by `frappe.ui.set_theme`
 * (`ui/theme_switcher.js:162`); `data-theme-mode` is written by the theme
 * switcher dialog (`theme_switcher.js:148`) and read back by `set_theme`.
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
 *   (`scripts/tables/grid.mjs:239,302,322,326`).
 * - `#login_email`, `#login_password`, `.btn-login` — the desk login form
 *   (`scripts/tables/cdp.mjs:289-296`).
 * - `link[rel=stylesheet]` — filtered on `desk.bundle` + `.css` and
 *   `/assets/carbon_frappe/` for the assets.json shadowing guard
 *   (`cdp.mjs:247-251`).
 * - `.onboarding-widget-box`, `.widget-group`, `[data-widget-name]` — ERPNext
 *   onboarding panels, hidden so they cannot intercept `elementFromPoint`
 *   (`grid.mjs:150-151`).
 * - `.dt-cell__edit .frappe-control` — a mounted control inside a datatable
 *   editor (`scripts/tables/report.mjs:206`).
 * - `.awesomplete` — the Link control's dropdown, synthesised by the harness
 *   (`report.mjs:281-286`).
 */
export type DeskMarkupSelector =
	| "#freeze"
	| "#login_email"
	| "#login_password"
	| ".btn-login"
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
}

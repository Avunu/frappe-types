/// <reference types="jquery" />

/**
 * frappe-types — the package's **module** entry point.
 *
 * ```ts
 * import type { Frappe, DocField, ListView } from "frappe-types";
 * ```
 *
 * This file installs **no globals**. It is a plain ES module of named
 * re-exports plus the two composite interfaces the fragments could not declare
 * on their own ({@link FrappeUiNamespace} and {@link Frappe}). For the ambient
 * `frappe` / `__` / `locals` / `cur_frm` globals a desk page really has, add
 * `"frappe-types/global"` to your tsconfig's `types` array instead — see
 * `src/global.d.ts`.
 *
 * `/// <reference types="jquery" />` above is load-bearing, not decorative.
 * Frappe ships jQuery 3.7 and hundreds of these declarations are typed in terms
 * of `JQuery` / `JQueryStatic` / `JQueryXHR`. A consumer that pins
 * `"types": ["frappe-types"]` has an explicit allowlist that excludes
 * `@types/jquery`, and without this reference every one of those becomes
 * `TS2304 Cannot find name 'JQuery'` — 175 of them in the first real consumer.
 * The reference makes `@types/jquery` (a hard dependency of this package) ride
 * along, so no second `types` entry is needed.
 *
 * Verified against **frappe v16.33.0**. Every declaration cites `file.js:line`.
 *
 * ## Name collisions, and who owns each name
 *
 * Eight names were declared by two fragments each. Each is now declared once and
 * re-exported (or aliased) from the other side, so both import paths yield
 * **one type identity** — a `frappe-types` consumer can never be handed two
 * incompatible `DataTableTranslations`. The owners:
 *
 * | name | owner | why |
 * | --- | --- | --- |
 * | `FrappeCheck` | `./model` | the `0 \| 1` wire format is a DocField fact; `FrappeCheckLoose` lives there too |
 * | `FormatterOptions` | `./model` | `DocField.formatter`'s type has to name it; `./ui/form`'s extra keys were folded in |
 * | `FrappeFormNamespace` | `./core` | `frappe.form` is a member of `FrappeCore`, and core's copy is the stricter one |
 * | `CurrentListView` | `./views` | only `views` can name `ReportView`, which the route really produces |
 * | `DataTableTranslations` | `./utils` | utils' shape matches `utils/datatable.js:1-22`; datatable's lost the required `1` key |
 * | `DataTableTotalCell` | `./datatable` | it owns every other frappe-datatable shape, and `DataTableHooks.columnTotal` — the slot the value must fit — is declared there. `./utils`'s `FrappeReportColumnTotalCell` was the same `body-renderer.js:97-108` cell under a second name; it survives there as a deprecated alias |
 * | the `Grid` family | `./deep-modules` | `Grid`/`GridRow`/`GridRowForm`/`GridPagination` are ES-module DEFAULT exports with no `frappe.ui.form.Grid` alias, so only the deep-import fragment can hold them. `./ui/form` re-exports. Two copies made `new CarbonGrid(...)` a `TS2375` at the project's most important call site |
 * | `Permission` | `./model` | `Form#perm`, `BaseControl#perm` and `Grid#perm` are the same evaluated `perm.js:64-127` array; `deep-modules` had spelled it inline as a `Record` that `Permission[]` was not assignable to |
 *
 * `get_doc` / `get_list` / `get_children` were a sixth collision, at the member
 * rather than the module level: `FrappeCore` and `FrappeModelMetaGlobals` both
 * declared them with different signatures, which made {@link Frappe}'s `extends`
 * clause a hard `TS2320` and meant no composite `Frappe` type could be formed at
 * all. `./model` owns them now (`model/model.js:869-871` only *aliases* them
 * onto the root); the generic parameter and every note from the `core.d.ts`
 * copy were folded into {@link FrappeModelMetaGlobals}.
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// ./model — Documents, DocFields, DocType meta and the `frappe.model` / `frappe.meta` namespaces.
// ---------------------------------------------------------------------------
export type {
	ChildDoc,
	DocField,
	DocFieldFormatter,
	DocFieldMap,
	DocInfo,
	DocPerm,
	DocTypeAction,
	DocTypeDashboardData,
	DocTypeLink,
	DocTypeMeta,
	DocTypeState,
	FieldType,
	FieldTypeLike,
	FieldTypeName,
	FormatterOptions,
	FrappeCheck,
	FrappeCheckLoose,
	FrappeDoc,
	FrappeDocBase,
	FrappeMetaNamespace,
	FrappeModelMetaGlobals,
	FrappeModelNamespace,
	FrappeModelUserSettings,
	GridDataRow,
	GridMetaContract,
	IndicatorTuple,
	LayoutFieldType,
	Locals,
	LocalsDocStore,
	ModelFilters,
	ModelTrigger,
	NamedGridDataRow,
	NumericFieldType,
	OpenMappedDocOptions,
	PartialDocField,
	Permission,
	SelectOption,
	TableFieldType,
} from "./model";

// ---------------------------------------------------------------------------
// ./core — The `frappe` root: requests, messages, boot, session, db, formatters.
// ---------------------------------------------------------------------------
/** Classes and functions (runtime values as well as types). */
export {
	FrappeThemeSwitcher,
	FrappeToolbar,
} from "./core";

export type {
	CarbonFrappeBrand,
	CarbonFrappeBranded,
	CarbonTableDemoGlobal,
	CarbonTableDemoSurface,
	FrappeAjaxResult,
	FrappeAnyFunction,
	FrappeArrayPolyfills,
	FrappeAssetsJson,
	FrappeBoot,
	FrappeBootAppEntry,
	FrappeBootPartial,
	FrappeBootSysDefaults,
	FrappeBootUser,
	FrappeCallOptions,
	FrappeClientGetListArgs,
	FrappeClientInsertArgs,
	FrappeCore,
	FrappeCoreGlobalWiring,
	FrappeDb,
	FrappeDbGetListArgs,
	FrappeDevServer,
	FrappeDialog,
	FrappeFilters,
	FrappeFormNamespace,
	FrappeFormatter,
	FrappeFormatterOptions,
	FrappeFormatters,
	FrappeGetLoggedUserResponse,
	FrappeIndicator,
	FrappeJQuery,
	FrappeLinkFormatter,
	FrappeListViewSettings,
	FrappeListViewSettingsButton,
	FrappeListViewSettingsDropdown,
	FrappeListViewSettingsDropdownItem,
	FrappeMsgprintOptions,
	FrappeMsgprintPrimaryAction,
	FrappeMsgprintSecondaryAction,
	FrappeRequest,
	FrappeRequestCallOptions,
	FrappeResponse,
	FrappeSession,
	FrappeShowAlertActions,
	FrappeShowAlertOptions,
	FrappeThrowOptions,
	FrappeTranslate,
	FrappeTranslateReplace,
	PatchRegistryEntry,
	SafePatch,
} from "./core";

// ---------------------------------------------------------------------------
// ./ui/form — `frappe.ui.form` — Form, Layout, FieldGroup, Dialog and the Control hierarchy.
// ---------------------------------------------------------------------------
/** Classes and functions (runtime values as well as types). */
export {
	BaseControl,
	Column,
	ControlInput,
	ControlTable,
	Dialog,
	FieldGroup,
	Form,
	FormController,
	Layout,
	Section,
	Tab,
	Toolbar,
	get_formatter,
	make_control,
} from "./ui/form";

export type {
	ControlElementClass,
	ControlHostElement,
	ControlOptions,
	CurFrm,
	Dashboard,
	DependsOnExpression,
	DialogActions,
	DialogOptions,
	DialogSize,
	DisplayStatus,
	EditableTitleClass,
	FormatterFn,
	Formatters,
	FrappeUiFormNamespace,
	GridElementClass,
	GridRowElementClass,
	GridRowFormElementClass,
	GridRowJQueryData,
	GridViewColumn,
	LayoutFieldObject,
	LayoutOptions,
	LinkFormatters,
	ScriptManager,
	SortableInstance,
	ToolbarActionStatus,
	UndoManager,
} from "./ui/form";

// ---------------------------------------------------------------------------
// ./deep-modules — The grid classes reached by deep ES-module import (`frappe/public/js/frappe/form/grid`).
// ---------------------------------------------------------------------------
/** Classes and functions (runtime values as well as types). */
export {
	Grid,
	GridPagination,
	GridRow,
	GridRowForm,
} from "./deep-modules";

export type {
	Debounced,
	FrappeBenchConf,
	FrappeNodeUtils,
	GridChildDoc,
	GridColumn,
	GridColumnSetting,
	GridDocField,
	GridFieldChoice,
	GridFieldInfo,
	GridFilter,
	GridOptions,
	GridPaginationOptions,
	GridRowFormOptions,
	GridRowOptions,
	GridSortable,
	JQueryClickHandler,
	RedisClientLike,
} from "./deep-modules";

// ---------------------------------------------------------------------------
// ./utils — `frappe.utils`, `frappe.dom`, `frappe.router`, `frappe.ui.Page` and the theme slice.
// ---------------------------------------------------------------------------
/** Classes and functions (runtime values as well as types). */
export {
	Page,
} from "./utils";

export type {
	AnimationFrameHandle,
	CarbonAttrSetter,
	CarbonCellContext,
	CarbonColumnContext,
	CarbonDatasetKeys,
	CarbonFilterCellEntry,
	CarbonHeaderCellContext,
	CarbonProfileContext,
	CarbonProfileHook,
	CarbonRowContext,
	CarbonRowEntry,
	CarbonRowSize,
	CarbonRowSizes,
	CarbonTableAdapterSeams,
	CarbonTableClassKey,
	CarbonTableClassMap,
	CarbonTableClassProfile,
	CarbonTableClassProfileHook,
	CarbonTableDataAttribute,
	CarbonTableElementExpandos,
	DataTablePluralTranslation,
	DataTableTranslationTable,
	DataTableTranslations,
	DeskDomGlobals,
	DeskMarkupSelector,
	DeskTheme,
	DeskThemeAttributes,
	DeskThemeMode,
	FrappeBrowserInfo,
	FrappeDebouncedFunction,
	FrappeDesktopIconRecord,
	FrappeDoctypeRoute,
	FrappeDom,
	FrappeDurationOptions,
	FrappeDurationParts,
	FrappeEventEmitter,
	FrappeFactoryView,
	FrappeGenerateRouteItem,
	FrappeHelpDropdownItem,
	FrappeIconSize,
	FrappeListViewSlug,
	FrappeMapDefaults,
	FrappeMapTile,
	FrappeNumberSystemUnit,
	FrappePageRegions,
	FrappeReportColumnTotalCell,
	FrappeRouter,
	FrappeRouterBase,
	FrappeSelectGroupAction,
	FrappeStandardRoute,
	FrappeSummaryItem,
	FrappeUiPageSlice,
	FrappeUiThemeSlice,
	FrappeUtils,
	FrappeUtilsDataTable,
	FrappeUtilsDomRouterGlobals,
	FrappeUtilsLogTypes,
	FrappeValidationType,
	IntervalHandle,
	JQueryEventLike,
	PageActionClick,
	PageActionOptions,
	PageButtonOptions,
	PageControl,
	PageDropdownItemOptions,
	PageFieldDef,
	PageIconSpec,
	PageOptions,
	PageShortcut,
	RafScheduler,
	TimerHandle,
} from "./utils";

// ---------------------------------------------------------------------------
// ./views — `frappe.views` — BaseList, ListView, ReportView, QueryReport, Container, factories.
// ---------------------------------------------------------------------------
/** Classes and functions (runtime values as well as types). */
export {
	BaseList,
	Container,
	Factory,
	ListFactory,
	ListSettings,
	ListView,
	QueryReport,
	ReportView,
} from "./views";

export type {
	BaseListOptions,
	CurrentListView,
	CurrentPage,
	FilterArea,
	FrappeDatatableClassName,
	FrappeDeskSelector,
	FrappeIconSpriteId,
	FrappeListClassName,
	FrappeListDataAttribute,
	FrappeListDoc,
	FrappeQueryReportGlobals,
	FrappeViewName,
	FrappeViewsNamespace,
	GetListView,
	ListColumn,
	ListColumnType,
	ListFilterTuple,
	ListSettingsField,
	ListViewArgs,
	ListViewDBSettings,
	ListViewElementFactory,
	ListViewMenuItem,
	ListViewSettings,
	ListViewSettingsButton,
	ListViewSettingsDropdownButton,
	ListViewSettingsDropdownItem,
	ListViewUserSettings,
	PageContainerElement,
	QueryReportColumn,
	QueryReportFilterControl,
	QueryReportRawData,
	QueryReportSettings,
	ReportChartArgs,
	ReportViewCellEditor,
	ReportViewJSON,
	SortSelector,
} from "./views";

// ---------------------------------------------------------------------------
// ./datatable — `frappe.DataTable` — the vendored frappe-datatable engine.
// ---------------------------------------------------------------------------
/** Classes and functions (runtime values as well as types). */
export {
	BodyRenderer,
	CellEditing,
	CellManager,
	CellNavigation,
	ColumnManager,
	DataManager,
	DataTable,
	Keyboard,
	RowManager,
	Style,
} from "./datatable";

export type {
	CarbonDataTableDomClass,
	CarbonEngineDataset,
	CarbonEngineDomClass,
	DataTableAfterRender,
	DataTableAlign,
	DataTableAppliedFilters,
	DataTableCell,
	DataTableCellBase,
	DataTableCellClass,
	DataTableCellContentClass,
	DataTableCellFormatter,
	DataTableCellInput,
	DataTableCellRowClass,
	DataTableCellValue,
	DataTableColIndex,
	DataTableColumn,
	DataTableColumnClass,
	DataTableColumnInput,
	DataTableColumnTotalCell,
	DataTableCompareValue,
	DataTableComponentOverrides,
	DataTableConstructor,
	DataTableCurrentSort,
	DataTableData,
	DataTableDataRow,
	DataTableDataset,
	DataTableDirection,
	DataTableDomClass,
	DataTableEditCellClass,
	DataTableEditor,
	DataTableEngine,
	DataTableEngineRenderer,
	DataTableEngineState,
	DataTableEngineTable,
	DataTableEvents,
	DataTableFilterResult,
	DataTableFilterRows,
	DataTableFocusedCell,
	DataTableGetDatatableOptions,
	DataTableGetEditor,
	DataTableGlobals,
	DataTableGuessedFilter,
	DataTableHeaderCellClass,
	DataTableHeaderDropdownItem,
	DataTableHooks,
	DataTableInstance,
	DataTableInstanceClass,
	DataTableKeyListener,
	DataTableLayout,
	DataTableOptions,
	DataTableRow,
	DataTableRowClass,
	DataTableRowIndex,
	DataTableRowIndexKey,
	DataTableRowMeta,
	DataTableRowRenderProps,
	DataTableSelectionBounds,
	DataTableSortOrder,
	DataTableStaticClass,
	DataTableStyleObject,
	DataTableTotalCell,
	DocumentThemeDataset,
	FrappeDataTableNamespace,
	HTMLElementNodeIdentityExpando,
} from "./datatable";

// ---------------------------------------------------------------------------
// ./charts — `frappe.Chart` — the vendored frappe-charts wrapper.
// ---------------------------------------------------------------------------
/** Classes and functions (runtime values as well as types). */
export {
	FrappeAggregationChart,
	FrappeAxisChart,
	FrappeBaseChart,
	FrappeDonutChart,
	FrappeHeatmap,
	FrappePercentageChart,
	FrappePieChart,
	FrappeRealtimeChart,
	SvgTip,
} from "./charts";

export type {
	CarbonChartsColorPaletteScssPath,
	ChartPalettesModule,
	FrappeAxisChartData,
	FrappeAxisDataset,
	FrappeChartAxisOptions,
	FrappeChartBarOptions,
	FrappeChartColor,
	FrappeChartComponent,
	FrappeChartConfig,
	FrappeChartConstructor,
	FrappeChartData,
	FrappeChartDataPoint,
	FrappeChartDataSelectEvent,
	FrappeChartInstance,
	FrappeChartLineOptions,
	FrappeChartMeasures,
	FrappeChartOptions,
	FrappeChartPresetColor,
	FrappeChartRequestedType,
	FrappeChartState,
	FrappeChartTooltipOptions,
	FrappeChartTooltipValue,
	FrappeChartType,
	FrappeChartYMarker,
	FrappeChartYRegion,
	FrappeChartsCssVariable,
	FrappeChartsDistCssPath,
	FrappeHeatmapData,
} from "./charts";

// ---------------------------------------------------------------------------
// ./globals — The bare desk globals (`__`, `locals`, `cur_*`) and the jQuery plugin surface.
// ---------------------------------------------------------------------------
export type {
	AsElement,
	BootstrapCarouselOptions,
	BootstrapCollapseOptions,
	BootstrapDropdownOptions,
	BootstrapModalOptions,
	BootstrapPluginCommand,
	BootstrapPopoverOptions,
	BootstrapScrollSpyOptions,
	BootstrapToastOptions,
	BootstrapTooltipOptions,
	CurrentDialog,
	CurrentForm,
	CurrentPageContainer,
	DeskGlobals,
	DeskTemplateGlobals,
	DeskWindow,
	DevServerFlag,
	ErpNextGlobal,
	FrappeCustomJQueryEvent,
	HarnessProbe,
	HarnessWindowGlobals,
	JQueryDatepickerPlugin,
	JQueryFrappeOverloads,
	JQueryFrappePlugins,
	JQueryRegion,
	JQueryStaticFrappeExtensions,
	JQueryValPatchNote,
	LocalsStore,
	MaybeJQuery,
	SelectOptionInput,
	TranslateFunction,
	TranslationArgs,
} from "./globals";

// ===========================================================================
// The composites the per-namespace fragments could not declare on their own
//
// Nine of `frappe`'s twelve members had a SHAPE declared somewhere and nothing
// that attached them to the root: `FrappeUtilsDomRouterGlobals`,
// `FrappeModelMetaGlobals`, `FrappeViewsNamespace`, `FrappeDataTableNamespace`,
// `FrappeChartConstructor`, `FrappeUiThemeSlice`, `FrappeUiPageSlice`,
// `FrappeUiFormNamespace` and `FrappeToolbar` were all orphans — nothing in the
// package imported or extended any of them, so `frappe.utils`, `frappe.dom`,
// `frappe.router`, `frappe.model`, `frappe.meta`, `frappe.views`,
// `frappe.DataTable`, `frappe.Chart` and `frappe.ui` were unreachable. The two
// interfaces below are the joins that make them reachable.
//
// They are declared HERE, in the package entry point, rather than in a fragment,
// for two reasons: no fragment can name all nine without a nine-way import
// cycle, and a consumer that needs to add a member frappe-types has not declared
// can then reach them with an ordinary augmentation:
//
//   declare module "frappe-types" {
//     interface FrappeUiNamespace { Slides: typeof MySlides }
//     interface Frappe { my_app: MyAppNamespace }
//   }
// ===========================================================================

import type {
	FrappeCore,
	FrappeThemeSwitcher,
	FrappeToolbar,
} from "./core";
import type { FrappeChartConstructor, FrappeRealtimeChart } from "./charts";
import type { FrappeDataTableNamespace } from "./datatable";
import type { FrappeModelMetaGlobals } from "./model";
import type { Dialog, FieldGroup, FrappeUiFormNamespace } from "./ui/form";
import type {
	FrappeUiPageSlice,
	FrappeUiThemeSlice,
	FrappeUtilsDomRouterGlobals,
	Page,
} from "./utils";
import type { FrappeQueryReportGlobals, FrappeViewsNamespace } from "./views";

/**
 * `frappe.ui.toolbar` — a namespace OBJECT, not the class.
 * `frappe/public/js/frappe/ui/toolbar/toolbar.js:4` creates it with
 * `frappe.provide("frappe.ui.toolbar")`, `:7` hangs the `Toolbar` class off it,
 * `:194-247` `$.extend`s the helpers on, and `:249` adds the throttled
 * `clear_cache`.
 */
export interface FrappeUiToolbarNamespace {
	/** toolbar.js:7. */
	Toolbar: typeof FrappeToolbar;
	/**
	 * toolbar.js:195-208. Inserts a `<li class="custom-menu">` before the menu's
	 * divider and returns the `<a>` it bound the handler to. `label` and `icon`
	 * are injected as raw HTML.
	 */
	add_dropdown_button(
		parent: string,
		label: string,
		click: () => void,
		icon: string
	): JQuery<HTMLElement>;
	/** toolbar.js:209-211 — `$("#navbar-" + label.toLowerCase())`. */
	get_menu(label: string): JQuery<HTMLElement>;
	/** toolbar.js:212-216. A `string` is resolved through {@link FrappeUiToolbarNamespace.get_menu}. */
	add_menu_divider(menu: string | JQuery<HTMLElement>): void;
	/**
	 * toolbar.js:217-230. **Throws** when `.navbar-right` is absent — it calls
	 * `parent_element.insertBefore(...)` on the result of `.get(0)` unguarded.
	 */
	add_icon_link(route: string, icon: string, index: number, class_name: string): void;
	/** toolbar.js:231-237. Flips `localStorage.container_fullwidth` and fires `toggleFullWidth` on `<body>`. */
	toggle_full_width(): void;
	/** toolbar.js:238-241. */
	set_fullwidth_if_enabled(): void;
	/** toolbar.js:242-246 — always returns `false` to cancel the event. */
	show_shortcuts(e: JQuery.TriggeredEvent): false;
	/** toolbar.js:249-259 — `frappe.utils.throttle(…, 10000)`; clears assets, then reloads the page. */
	clear_cache(): void;
}

/**
 * One entry of `frappe.ui.keys.standard_shortcuts` — keyboard.js:76.
 * Note it stores `condition` but NOT `target` or `ignore_inputs`, which are
 * consumed while building the handler.
 */
export interface FrappeStandardShortcut {
	shortcut: string;
	action?: (e: JQuery.KeyDownEvent) => boolean | void;
	description?: string;
	page?: Page;
	condition?: () => boolean;
}

/**
 * A raw handler registered with {@link FrappeUiKeysNamespace.on}.
 *
 * `add_shortcut` monkey-patches the page onto the function object
 * (keyboard.js:68 `handler.page = page`) so that
 * {@link FrappeUiKeysNamespace.off} can filter by page (keyboard.js:196-200) —
 * hence the callable-plus-property form.
 */
export interface FrappeKeyHandler {
	(e: JQuery.KeyDownEvent): boolean | void;
	/** keyboard.js:68. Absent on handlers registered through `on()` directly. */
	page?: Page;
}

/** Argument of `frappe.ui.keys.add_shortcut` — keyboard.js:32-40. */
export interface FrappeShortcutOptions {
	shortcut: string;
	/** Returning anything other than `false` calls `preventDefault()` (keyboard.js:59-63). */
	action?: (e: JQuery.KeyDownEvent) => boolean | void;
	description?: string;
	/** The handler only fires while this page's wrapper is visible (keyboard.js:58). */
	page?: Page;
	/** keyboard.js:41-46 — a jQuery target REPLACES `action` with a click on `target[0]`. */
	target?: JQuery<HTMLElement>;
	/** Defaults to `() => true` (keyboard.js:47-49). */
	condition?: () => boolean;
	/** Defaults to `false` — the shortcut is skipped while an input has focus (keyboard.js:55). */
	ignore_inputs?: boolean;
}

/**
 * `frappe.ui.keys.AltShortcutGroup` — alt_keyboard_shortcuts.js:95. One group of
 * alt-underlined labels, keyed by the letter it claimed.
 */
export interface AltShortcutGroup {
	/** alt_keyboard_shortcuts.js:97, keyed by lowercase letter. */
	shortcuts_dict: Record<
		string,
		| {
				$target: JQuery<HTMLElement>;
				$text_el: JQuery<HTMLElement>;
				letter: string;
				text: string;
		  }
		| undefined
	>;
	/** alt_keyboard_shortcuts.js:100-113 — locale-dependent; `[]` outside German. */
	blacklisted_letters: string[];
	/** alt_keyboard_shortcuts.js:121-132. */
	bind_events(): void;
	/** alt_keyboard_shortcuts.js:134-169. `$text_el` defaults to `$target`. */
	add($target: JQuery<HTMLElement>, $text_el?: JQuery<HTMLElement>): void;
	/** alt_keyboard_shortcuts.js:171-192. */
	underline_text(shortcut: { $text_el: JQuery<HTMLElement>; letter: string; text: string }): void;
	/** alt_keyboard_shortcuts.js:194-204. */
	is_taken(letter: string): boolean;
}

/**
 * `frappe.ui.keys` — `frappe.provide("frappe.ui.keys.handlers")`,
 * keyboard.js:4 and alt_keyboard_shortcuts.js:1.
 */
export interface FrappeUiKeysNamespace {
	/** keyboard.js:4, :187-190. A key with no registered handler reads back `undefined`. */
	handlers: Record<string, FrappeKeyHandler[] | undefined>;
	/** keyboard.js:284-310 — keyCode → key name, with A-Z filled in at :309. */
	key_map: Record<number, string | undefined>;
	/** keyboard.js:23-24, appended to by `add_shortcut` (keyboard.js:75-80). */
	standard_shortcuts: FrappeStandardShortcut[];
	/** keyboard.js:85, :146, :160 — guards the shortcut-help dialog against double opens. */
	is_dialog_shown?: boolean;
	/** alt_keyboard_shortcuts.js:3-5. Keyed by an arbitrary owner object. */
	shortcut_groups: WeakMap<object, AltShortcutGroup>;
	/** alt_keyboard_shortcuts.js:95. */
	AltShortcutGroup: new () => AltShortcutGroup;
	/** keyboard.js:6-20. Binds the single `keydown` listener on `window`. */
	setup(): void;
	/** keyboard.js:163-184 — normalises an event into `"ctrl+shift+k"` form, lowercased. */
	get_key(e: JQuery.KeyDownEvent | KeyboardEvent): string;
	/** keyboard.js:25-31 — title-cased, with `⌘` / `⌥` / `⇧` substitutions. */
	get_shortcut_label(shortcut: string): string;
	/** keyboard.js:32-81. Replaces any handler already registered for the same page. */
	add_shortcut(opts?: FrappeShortcutOptions): void;
	/** keyboard.js:186-191. */
	on(key: string, handler: FrappeKeyHandler): void;
	/**
	 * keyboard.js:193-200. **Calling it without a `page` removes every handler
	 * for that key** — the filter predicate returns `false` for all of them.
	 */
	off(key: string, page?: Page): void;
	/** keyboard.js:84-161. */
	show_keyboard_shortcut_dialog(): void;
	/** alt_keyboard_shortcuts.js:7-13. Creates the group on first use. */
	get_shortcut_group(parent: object): AltShortcutGroup;
	/** alt_keyboard_shortcuts.js:19-93. Idempotent; installs the alt-key listeners once. */
	bind_shortcut_group_event(): void;
}

/**
 * `frappe.ui` — created by `frappe.provide("frappe.ui")` in half a dozen
 * bundles (dialog.js:4, field_group.js:3, toolbar.js:4, …).
 *
 * ### Deliberately NOT an open `[key: string]: unknown`
 *
 * `frappe.ui` carries ~60 further classes at v16.33.0 (`Slides`, `Tree`,
 * `FileUploader`, `FilterGroup`, `Notifications`, …), none of which this package
 * has verified. Adding an index signature would type every one of them —
 * **and every typo** — as `unknown`, which is worse than a missing member: it
 * turns `frappe.ui.Dailog` from a compile error into silent `unknown`. That is
 * the same rule `core.d.ts` states for `frappe.msgprnt`. Reach an undeclared
 * member by augmenting this interface instead:
 *
 * ```ts
 * declare module "frappe-types" {
 *   interface FrappeUiNamespace {
 *     FileUploader: new (opts: { doctype: string }) => { show(): void };
 *   }
 * }
 * ```
 */
export interface FrappeUiNamespace extends FrappeUiThemeSlice, FrappeUiPageSlice {
	/** form.js:1 — `frappe.provide("frappe.ui.form")`. */
	form: FrappeUiFormNamespace;
	/** dialog.js:10. */
	Dialog: typeof Dialog;
	/** field_group.js:5 — `Dialog`'s base class. */
	FieldGroup: typeof FieldGroup;
	/** dialog.js:8 — the modal stack; `window.cur_dialog` is its top (dialog.js:112-119). */
	open_dialogs: Dialog[];
	/** dialog.js:381-390. Hides, or un-minimises, `window.cur_dialog`. */
	hide_open_dialog(): void;
	/** toolbar.js:4. */
	toolbar: FrappeUiToolbarNamespace;
	/** keyboard.js:4. */
	keys: FrappeUiKeysNamespace;
	/** theme_switcher.js:3. */
	ThemeSwitcher: typeof FrappeThemeSwitcher;
	/** ui/chart.js:6 — frappe's only in-tree `frappe.Chart` subclass. */
	RealtimeChart: typeof FrappeRealtimeChart;
}

/**
 * `window.frappe` — the desk global, assembled from every namespace slice.
 *
 * `frappe.provide("…")` (provide.js:7-19) grows these namespaces **lazily**, one
 * bundle at a time, which is why members that a non-desk page can miss
 * (`frappe.views.ListView`, `frappe.utils.datatable`) are declared optional on
 * their own interfaces rather than here.
 *
 * ### `frappe.auth` and `frappe.client` are NOT members, on purpose
 *
 * `core.d.ts` exports {@link FrappeGetLoggedUserResponse},
 * {@link FrappeClientGetListArgs} and {@link FrappeClientInsertArgs}, and it
 * would be easy to read those as evidence of `frappe.auth.get_logged_user()` and
 * `frappe.client.get_list()` JS namespaces. **They do not exist.** A grep of
 * `frappe/public/js` at v16.33.0 finds `frappe.client` only ever as a *string*
 * — the `method:` of a server call (`db.js:44`, `:61`, `:70`, `:86`, `:98`,
 * `:102`) — and `frappe.auth` only as a REST path
 * (`/api/method/frappe.auth.get_logged_user`). Those three interfaces are the
 * argument and response shapes of the **Python** endpoints, and are used as
 * type arguments to `frappe.xcall` / `fetch`, e.g.
 *
 * ```ts
 * frappe.xcall<FrappeDoc[]>("frappe.client.get_list", args satisfies FrappeClientGetListArgs);
 * ```
 *
 * Declaring `frappe.client` as an object here would have been a fabrication.
 */
export interface Frappe
	extends FrappeCore,
		FrappeModelMetaGlobals,
		FrappeUtilsDomRouterGlobals,
		FrappeDataTableNamespace,
		FrappeQueryReportGlobals {
	/** dialog.js:4 and passim. */
	ui: FrappeUiNamespace;
	/** views/views.js — `frappe.provide("frappe.views")`. Members are lazily loaded. */
	views: FrappeViewsNamespace;
	/**
	 * `frappe/public/js/frappe/ui/chart.js:4` — frappe-charts' `Chart`, assigned
	 * as a plain writable property (which is what makes carbon_frappe's
	 * shim-and-patch legal). Note the constructor **returns a different object**;
	 * see {@link FrappeChartConstructor}.
	 */
	Chart: FrappeChartConstructor;
}

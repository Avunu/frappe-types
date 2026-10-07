/// <reference types="jquery" />
/// <reference path="./registry.d.ts" />

/**
 * frappe-types — the package's **module** entry point.
 *
 * ```ts
 * import type { Frappe, DocField, ListView } from "frappe-types";
 * ```
 *
 * This file installs **no globals**. It is a plain ES module of named
 * re-exports plus the two composite interfaces the fragments could not declare
 * on their own ({@link FrappeUiNamespace} and {@link Frappe}) and the two
 * `frappe.ui` sub-namespaces that hang off them ({@link FrappeUiToolbarNamespace}
 * and {@link FrappeUiKeysNamespace}). For the ambient
 * `frappe` / `__` / `locals` / `cur_frm` globals a desk page really has, add
 * `"frappe-types/global"` to your tsconfig's `types` array instead — see
 * `src/global.d.ts`.
 *
 * The one global this entry does bring is a TYPE, not a value: the
 * `FrappeDocTypes` doctype registry (`src/registry.d.ts`, the second reference
 * above). It is global so that this entry and `frappe-types/global` share one
 * registry, which apps fill with `interface FrappeDocTypes { … }`.
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
 * Verified against **frappe v16.50.0**. Every declaration cites `file.js:line`
 * (full-path, `frappe/public/js/frappe/…`, wherever this file was re-read for a
 * later release).
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
 * | `DataTableTranslations` | `./utils` | utils' shape matches `frappe/public/js/frappe/utils/datatable.js:1-22`; datatable's lost the required `1` key |
 * | `DataTableTotalCell` | `./datatable` | it owns every other frappe-datatable shape, and `DataTableHooks.columnTotal` — the slot the value must fit — is declared there. `./utils`'s `FrappeReportColumnTotalCell` was the same `body-renderer.js:97-108` cell under a second name; it survives there as a deprecated alias |
 * | the `Grid` family | `./deep-modules` | `Grid`/`GridRow`/`GridRowForm`/`GridPagination` are ES-module DEFAULT exports with no `frappe.ui.form.Grid` alias, so only the deep-import fragment can hold them. `./ui/form` re-exports. Two copies made `new CarbonGrid(...)` a `TS2375` at the project's most important call site |
 * | `Permission` | `./model` | `Form#perm`, `BaseControl#perm` and `Grid#perm` are the same evaluated `frappe/public/js/frappe/model/perm.js:55-157` array (`get_perm`, which returns `_get_perm`'s result or the per-doctype cache of it); `deep-modules` had spelled it inline as a `Record` that `Permission[]` was not assignable to |
 *
 * `get_doc` / `get_list` / `get_children` were a sixth collision, at the member
 * rather than the module level: `FrappeCore` and `FrappeModelMetaGlobals` both
 * declared them with different signatures, which made {@link Frappe}'s `extends`
 * clause a hard `TS2320` and meant no composite `Frappe` type could be formed at
 * all. `./model` owns them now (`frappe/public/js/frappe/model/model.js:908-910` only *aliases* them
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
	ChildRowOf,
	DocField,
	DocFieldFormatter,
	DocFieldMap,
	DocFieldName,
	DocFieldValue,
	DocInfo,
	DocInfoAssignment,
	DocInfoRow,
	DocOf,
	DocPerm,
	DocTypeAction,
	DocTypeDashboardData,
	DocTypeLink,
	DocTypeMeta,
	DocTypeName,
	DocTypeState,
	FieldType,
	FieldTypeLike,
	FieldTypeName,
	FormDocTypeOf,
	FormFieldName,
	FormSetValueArgs,
	FormatterOptions,
	FrappeCheck,
	FrappeCheckLoose,
	FrappeDoc,
	FrappeDocBase,
	FrappeDocFields,
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
	MappedDocGuard,
	ModelFilters,
	ModelTrigger,
	NamedGridDataRow,
	NumericFieldType,
	OpenMappedDocOptions,
	PartialDocField,
	Permission,
	RegisteredDoc,
	SelectOption,
	TableFieldType,
} from "./model";

// ---------------------------------------------------------------------------
// ./core — The `frappe` root: requests, messages, boot, session, db, formatters.
// ---------------------------------------------------------------------------
/** Classes and functions (runtime values as well as types). */
export {
	FrappeApplication,
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
	FrappeBootAllowedReport,
	FrappeBootAppEntry,
	FrappeBootDeskSettings,
	FrappeBootPartial,
	FrappeBootSysDefaults,
	FrappeBootUser,
	FrappeBootWorkspacePage,
	FrappeBootWorkspaces,
	FrappeCallOptions,
	FrappeClientGetListArgs,
	FrappeClientInsertArgs,
	FrappeCore,
	FrappeCoreGlobalWiring,
	FrappeDateInput,
	FrappeDatetime,
	FrappeDb,
	FrappeDbGetListArgs,
	FrappeDefaults,
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
	FrappeRealtime,
	FrappeRequest,
	FrappeRequestCallOptions,
	FrappeResponse,
	FrappeSession,
	FrappeShowAlertActions,
	FrappeShowAlertOptions,
	FrappeThrowOptions,
	FrappeTranslate,
	FrappeTranslateReplace,
	FrappeUser,
	FrappeUserPermissionValue,
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
	PrintView,
	QuickEntryForm,
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
	FormEventHandler,
	FormEventHandlerRegistry,
	FormEvents,
	FormSetValueInput,
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
	PrintViewTarget,
	QuickEntryAfterInsert,
	ScriptManager,
	SortableInstance,
	StandardFormEvents,
	ToolbarActionStatus,
	UndoManager,
} from "./ui/form";

// ---------------------------------------------------------------------------
// ./deep-modules — The grid classes reached by deep ES-module import (`frappe/public/js/frappe/form/grid`).
// ---------------------------------------------------------------------------
/** Classes and functions (runtime values as well as types). */
export {
	DEFAULT_COLUMN_WIDTHS,
	GRID_MAX_COLUMN_WIDTH,
	GRID_MIN_COLUMN_WIDTH,
	Grid,
	GridPagination,
	GridRow,
	GridRowForm,
	LEGACY_COLSIZE_TO_PX,
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
	FrappeAppLogoSource,
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
	FrappeModuleSidebarShell,
	FrappeNumberSystemUnit,
	FrappePageRegions,
	FrappeReportColumnTotalCell,
	FrappeRouteSegmentKind,
	FrappeRouter,
	FrappeRouterBase,
	FrappeRouterPrivateWorkspace,
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
	PageActionLabel,
	PageActionOptions,
	PageBreadcrumbItem,
	PageButtonOptions,
	PageControl,
	PageDropdownItemOptions,
	PageEsDropdown,
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
	FileView,
	GroupBy,
	ListFactory,
	ListSettings,
	ListView,
	ListViewSelect,
	QueryReport,
	ReportView,
	SidePanel,
	SortSelector,
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
	FrappeListDocFields,
	FrappeQueryReportGlobals,
	FrappeViewName,
	FrappeViewsNamespace,
	GetCurrentPage,
	GetListView,
	GroupBySettings,
	ListColumn,
	ListColumnType,
	ListDocOf,
	ListFilter,
	ListFilterTuple,
	ListLayout,
	ListLayoutField,
	ListPagingButtonGroup,
	ListSettingsField,
	ListViewArgs,
	ListViewDBSettings,
	ListViewElementFactory,
	ListViewMenuItem,
	ListViewSelectView,
	ListViewSettings,
	ListViewSettingsButton,
	ListViewSettingsDropdownButton,
	ListViewSettingsDropdownItem,
	ListViewUserSettings,
	ListViewVirtualizationState,
	PageContainerElement,
	PageWrapper,
	QueryReportColumn,
	QueryReportFilterControl,
	QueryReportRawData,
	QueryReportSettings,
	ReportChartArgs,
	ReportViewCellEditor,
	ReportViewJSON,
	SortSelectorArgs,
	SortSelectorOptions,
	ViewSwitcherMenuGroup,
	ViewSwitcherMenuItem,
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

// ---------------------------------------------------------------------------
// ./ui/sidebar — the v16 module sidebar (`frappe.ui.Sidebar`), its header, the
// dock rail, the sidebar panels, and the `boot.module_sidebars` payload they
// render.
// ---------------------------------------------------------------------------
export { FrappeDock, FrappeSidebar, FrappeSidebarHeader, FrappeSidebarPanel } from "./ui/sidebar";
export type {
	FrappeArrangedDockRow,
	FrappeArrangementEditor,
	FrappeAwesomeBar,
	FrappeDockEntry,
	FrappeDockLinkType,
	FrappeDockRow,
	FrappeModuleSidebar,
	FrappeSidebarEntityKind,
	FrappeSidebarItem,
	FrappeSidebarItemLinkType,
	FrappeSidebarItemNamespace,
	FrappeSidebarItemType,
	FrappeSidebarMenuGroup,
	FrappeSidebarMenuItem,
	FrappeSidebarPanelOpts,
	FrappeSidebarPanelRegistry,
	FrappeSidebarRouteItem,
} from "./ui/sidebar";

// ---------------------------------------------------------------------------
// ./ui/notifications — `frappe.ui.Notifications` and its tab views.
// ---------------------------------------------------------------------------
export { FrappeNotifications } from "./ui/notifications";
export type {
	FrappeNotificationsTab,
	FrappeNotificationsTabId,
	FrappeNotificationsView,
} from "./ui/notifications";

// ---------------------------------------------------------------------------
// ./ui/components — `frappe.ui.badge`, `frappe.ui.button`, `frappe.ui.tab_buttons` (the Espresso helpers).
// ---------------------------------------------------------------------------
export { FrappeTabButtons } from "./ui/components";
export type {
	FrappeBadgeFunction,
	FrappeBadgeLegacyTheme,
	FrappeBadgeOptions,
	FrappeBadgeTheme,
	FrappeButtonDressOptions,
	FrappeButtonFunction,
	FrappeButtonOptions,
	FrappeTabButtonOption,
	FrappeTabButtonPill,
	FrappeTabButtonsFunction,
	FrappeTabButtonsOptions,
	FrappeTooltipOptions,
} from "./ui/components";

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
import type {
	FrappeBadgeFunction,
	FrappeButtonFunction,
	FrappeTabButtons,
	FrappeTabButtonsFunction,
} from "./ui/components";
import type { DataTable, FrappeDataTableNamespace } from "./datatable";
import type { FrappeModelMetaGlobals } from "./model";
import type { Dialog, FieldGroup, FrappeUiFormNamespace } from "./ui/form";
import type { FrappeNotifications } from "./ui/notifications";
import type {
	FrappeArrangementEditor,
	FrappeDock,
	FrappeSidebar,
	FrappeSidebarHeader,
	FrappeSidebarItemNamespace,
	FrappeSidebarPanel,
	FrappeSidebarPanelRegistry,
} from "./ui/sidebar";
import type {
	FrappeUiPageSlice,
	FrappeUiThemeSlice,
	FrappeUtilsDomRouterGlobals,
	Page,
} from "./utils";
import type {
	FrappeQueryReportGlobals,
	FrappeViewsNamespace,
	GroupBy,
	PageContainerElement,
	PageWrapper,
	SidePanel,
	SortSelector,
} from "./views";

/**
 * `frappe.ui.toolbar` — a namespace OBJECT, not the class.
 * `frappe/public/js/frappe/ui/toolbar/toolbar.js:4` creates it with
 * `frappe.provide("frappe.ui.toolbar")`, `:7` hangs the `Toolbar` class off it,
 * `:187-245` `$.extend`s the helpers on, and `:247-256` adds the throttled
 * `clear_cache`. Five more helpers are assigned further down (`show_about`,
 * `route_to_user`, `view_website`, `fetch_session_defaults`,
 * `setup_session_defaults`, `:258-327`) and are not declared here.
 */
export interface FrappeUiToolbarNamespace {
	/** frappe/public/js/frappe/ui/toolbar/toolbar.js:7. */
	Toolbar: typeof FrappeToolbar;
	/**
	 * frappe/public/js/frappe/ui/toolbar/toolbar.js:188-205. Inserts a
	 * `<li class="custom-menu">` before the menu's `.divider` — adding one first
	 * when the menu already holds stock items and none exists (`frappe/public/js/frappe/ui/toolbar/toolbar.js:190-192`) — and
	 * returns the `<a>` it bound the handler to (`click` runs with `this` set to
	 * that `<a>`, `frappe/public/js/frappe/ui/toolbar/toolbar.js:202-204`).
	 *
	 * - `label` is injected as raw HTML (`frappe/public/js/frappe/ui/toolbar/toolbar.js:196-197`).
	 * - `icon` is an icon **name** handed to `frappe.utils.icon` (`frappe/public/js/frappe/ui/toolbar/toolbar.js:196`), not
	 *   a CSS class as it was at v16.33; a falsy `icon` renders no icon.
	 * - On a menu with no `.divider` at all, jQuery's `insertBefore` on the empty
	 *   target set inserts nothing and returns an empty set (jQuery 3.7.1,
	 *   `src/manipulation.js` lines 467-484), so the item is never attached and
	 *   the returned set is **empty** — the click handler is bound to nothing.
	 */
	add_dropdown_button(
		parent: string,
		label: string,
		click: (this: HTMLElement) => void,
		icon?: string
	): JQuery<HTMLElement>;
	/** frappe/public/js/frappe/ui/toolbar/toolbar.js:206-208 — `$("#navbar-" + label.toLowerCase())`. */
	get_menu(label: string): JQuery<HTMLElement>;
	/** frappe/public/js/frappe/ui/toolbar/toolbar.js:209-213. A `string` is resolved through {@link FrappeUiToolbarNamespace.get_menu}; the divider is PREpended. */
	add_menu_divider(menu: string | JQuery<HTMLElement>): void;
	/**
	 * frappe/public/js/frappe/ui/toolbar/toolbar.js:214-228. **Throws** when
	 * `.navbar-right` is absent — it calls `parent_element.insertBefore(...)` on
	 * the result of `.get(0)` unguarded (`frappe/public/js/frappe/ui/toolbar/toolbar.js:215,227`). `icon` is an icon
	 * **name** for `frappe.utils.icon(icon, "sm")` (`frappe/public/js/frappe/ui/toolbar/toolbar.js:222`), not an octicon class
	 * as it was at v16.33; `route` and `class_name` are injected as raw HTML, and
	 * `class_name` is also title-cased into the link's `title` (`frappe/public/js/frappe/ui/toolbar/toolbar.js:217-220`).
	 */
	add_icon_link(route: string, icon: string, index: number, class_name: string): void;
	/** frappe/public/js/frappe/ui/toolbar/toolbar.js:229-235. Flips `localStorage.container_fullwidth` and fires `toggleFullWidth` on `<body>`. */
	toggle_full_width(): void;
	/** frappe/public/js/frappe/ui/toolbar/toolbar.js:236-239. */
	set_fullwidth_if_enabled(): void;
	/** frappe/public/js/frappe/ui/toolbar/toolbar.js:240-244 — always returns `false` to cancel the event. */
	show_shortcuts(e: JQuery.TriggeredEvent): false;
	/** frappe/public/js/frappe/ui/toolbar/toolbar.js:247-256 — `frappe.utils.throttle(…, 10000)`; clears assets, then reloads the page. */
	clear_cache(): void;
}

/**
 * One entry of `frappe.ui.keys.standard_shortcuts` —
 * `frappe/public/js/frappe/ui/keyboard.js:76`.
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
 * One section of the shortcut-help dialog, as built by
 * `frappe.ui.keys.get_shortcut_groups` —
 * `frappe/public/js/frappe/ui/keyboard.js:87-97`.
 */
export interface FrappeShortcutGroup {
	/** Already translated: `__("Global Shortcuts")`, `__("Page Shortcuts")` or `__("Grid Shortcuts")`. */
	heading: string;
	shortcuts: FrappeStandardShortcut[];
}

/**
 * A raw handler registered with {@link FrappeUiKeysNamespace.on}.
 *
 * `add_shortcut` monkey-patches the page onto the function object
 * (`frappe/public/js/frappe/ui/keyboard.js:68` `handler.page = page`) so that
 * {@link FrappeUiKeysNamespace.off} can filter by page
 * (`frappe/public/js/frappe/ui/keyboard.js:198-201`) — hence the
 * callable-plus-property form.
 */
export interface FrappeKeyHandler {
	(e: JQuery.KeyDownEvent): boolean | void;
	/** frappe/public/js/frappe/ui/keyboard.js:68. Absent on handlers registered through `on()` directly. */
	page?: Page;
}

/** Argument of `frappe.ui.keys.add_shortcut` — `frappe/public/js/frappe/ui/keyboard.js:32-40`. */
export interface FrappeShortcutOptions {
	shortcut: string;
	/**
	 * Returning anything other than `false` calls `preventDefault()` — the
	 * condition is `prevent_default || prevent_default === undefined`, so a truthy
	 * return or no return at all prevents, and `false` does not
	 * (`frappe/public/js/frappe/ui/keyboard.js:59-64`).
	 */
	action?: (e: JQuery.KeyDownEvent) => boolean | void;
	description?: string;
	/** The handler only fires while this page's wrapper is visible (`frappe/public/js/frappe/ui/keyboard.js:58`). */
	page?: Page;
	/** `frappe/public/js/frappe/ui/keyboard.js:41-46` — a jQuery target REPLACES `action` with a click on `target[0]`. */
	target?: JQuery<HTMLElement>;
	/** Defaults to `() => true` (`frappe/public/js/frappe/ui/keyboard.js:47-49`). */
	condition?: () => boolean;
	/** Defaults to `false` — the shortcut is skipped while an input has focus (`frappe/public/js/frappe/ui/keyboard.js:39,52-55`). */
	ignore_inputs?: boolean;
}

/**
 * `frappe.ui.keys.AltShortcutGroup` —
 * `frappe/public/js/frappe/ui/alt_keyboard_shortcuts.js:95`. One group of
 * alt-underlined labels, keyed by the letter it claimed.
 */
export interface AltShortcutGroup {
	/** frappe/public/js/frappe/ui/alt_keyboard_shortcuts.js:97, keyed by lowercase letter (`frappe/public/js/frappe/ui/alt_keyboard_shortcuts.js:164`). */
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
	/**
	 * frappe/public/js/frappe/ui/alt_keyboard_shortcuts.js:98-110 — locale-dependent:
	 * `["e", "l"]` on a Mac and `["q"]` elsewhere when `navigator.language` is
	 * German, `[]` for every other language (and when it cannot be parsed, `frappe/public/js/frappe/ui/alt_keyboard_shortcuts.js:101-105`).
	 */
	blacklisted_letters: string[];
	/** frappe/public/js/frappe/ui/alt_keyboard_shortcuts.js:118-130. */
	bind_events(): void;
	/** frappe/public/js/frappe/ui/alt_keyboard_shortcuts.js:132-166. `$text_el` defaults to `$target`. */
	add($target: JQuery<HTMLElement>, $text_el?: JQuery<HTMLElement>): void;
	/** frappe/public/js/frappe/ui/alt_keyboard_shortcuts.js:168-190. */
	underline_text(shortcut: { $text_el: JQuery<HTMLElement>; letter: string; text: string }): void;
	/** frappe/public/js/frappe/ui/alt_keyboard_shortcuts.js:192-201. */
	is_taken(letter: string): boolean;
}

/**
 * `frappe.ui.keys` — `frappe.provide("frappe.ui.keys.handlers")`,
 * `frappe/public/js/frappe/ui/keyboard.js:4` and
 * `frappe/public/js/frappe/ui/alt_keyboard_shortcuts.js:1`.
 */
export interface FrappeUiKeysNamespace {
	/** frappe/public/js/frappe/ui/keyboard.js:4,189-192. A key with no registered handler reads back `undefined`. */
	handlers: Record<string, FrappeKeyHandler[] | undefined>;
	/** frappe/public/js/frappe/ui/keyboard.js:286-312 — keyCode → key name, with A-Z filled in at frappe/public/js/frappe/ui/keyboard.js:310-312. */
	key_map: Record<number, string | undefined>;
	/** frappe/public/js/frappe/ui/keyboard.js:23-24, appended to by `add_shortcut` (frappe/public/js/frappe/ui/keyboard.js:75-81). */
	standard_shortcuts: FrappeStandardShortcut[];
	/**
	 * frappe/public/js/frappe/ui/keyboard.js:143,148,162 — guards the
	 * shortcut-help dialog against double opens. Unset until the dialog has been
	 * shown once.
	 */
	is_dialog_shown?: boolean;
	/** frappe/public/js/frappe/ui/alt_keyboard_shortcuts.js:3-5. Keyed by an arbitrary owner object. */
	shortcut_groups: WeakMap<object, AltShortcutGroup>;
	/** frappe/public/js/frappe/ui/alt_keyboard_shortcuts.js:95. */
	AltShortcutGroup: new () => AltShortcutGroup;
	/** frappe/public/js/frappe/ui/keyboard.js:6-21. Binds the single `keydown` listener on `window`. */
	setup(): void;
	/**
	 * frappe/public/js/frappe/ui/keyboard.js:165-186 — normalises an event into the
	 * lowercased string handlers are registered under. Modifiers are prepended
	 * one after another — `ctrl+` first (for `ctrlKey` **or** `metaKey`), then
	 * `shift+`, then `alt+` (`frappe/public/js/frappe/ui/keyboard.js:169-180`) — so the order in the result is
	 * `alt+shift+ctrl+k`, and `shift+ctrl+r` for the registration at `frappe/public/js/frappe/ui/keyboard.js:279`, NOT
	 * `ctrl+shift+r`. A keyCode with no `key_map` entry falls back to
	 * `String.fromCharCode` (`frappe/public/js/frappe/ui/keyboard.js:167`).
	 */
	get_key(e: JQuery.KeyDownEvent | KeyboardEvent): string;
	/**
	 * frappe/public/js/frappe/ui/keyboard.js:25-31 — each `+`-separated part
	 * title-cased. On macOS only (`frappe.utils.is_mac()`), the leading
	 * `Ctrl+` / `Alt+` / `Shift+` become `⌘` / `⌥` / `⇧` **with the `+` consumed**,
	 * so `"ctrl+shift+k"` reads `⌘⇧K`; elsewhere the label stays `Ctrl+Shift+K`.
	 */
	get_shortcut_label(shortcut: string): string;
	/**
	 * frappe/public/js/frappe/ui/keyboard.js:32-82. Replaces any handler already
	 * registered for the same `page` — and **without a `page` that means every
	 * handler on that key**, because it calls {@link FrappeUiKeysNamespace.off}
	 * (`frappe/public/js/frappe/ui/keyboard.js:70`) and `off` drops all handlers when given no page.
	 */
	add_shortcut(opts?: FrappeShortcutOptions): void;
	/** frappe/public/js/frappe/ui/keyboard.js:188-193. */
	on(key: string, handler: FrappeKeyHandler): void;
	/**
	 * frappe/public/js/frappe/ui/keyboard.js:195-202. **Calling it without a `page`
	 * removes every handler for that key** — the filter predicate returns `false`
	 * for all of them.
	 */
	off(key: string, page?: Page): void;
	/**
	 * frappe/public/js/frappe/ui/keyboard.js:84-98 — always three groups, in the
	 * order Global / Page / Grid. "Page" is the standard shortcuts whose `page`
	 * is `window.cur_page.page.page`, "Grid" those whose `page` is
	 * `window.cur_page.page.frm` (`frappe/public/js/frappe/ui/keyboard.js:85-86,91,95`); both are empty when
	 * there is no current page.
	 */
	get_shortcut_groups(): FrappeShortcutGroup[];
	/**
	 * frappe/public/js/frappe/ui/keyboard.js:100-140 — the `<h5>` + table markup for
	 * one group. Entries failing their `condition` or lacking a `description`
	 * are dropped, and entries sharing a description are merged into one row with
	 * their keys joined by ` / ` (`frappe/public/js/frappe/ui/keyboard.js:103-115`). Returns `""` for an empty list or
	 * when no row survives (`frappe/public/js/frappe/ui/keyboard.js:101,134`). The labels and descriptions are
	 * HTML-escaped (`frappe/public/js/frappe/ui/keyboard.js:122-127`); **`heading` is inserted as-is** (`frappe/public/js/frappe/ui/keyboard.js:136`).
	 */
	generate_shortcuts_html(shortcuts: FrappeStandardShortcut[], heading: string): string;
	/**
	 * frappe/public/js/frappe/ui/keyboard.js:142-163 — opens the "Keyboard
	 * Shortcuts" dialog, one section per {@link FrappeUiKeysNamespace.get_shortcut_groups}
	 * entry. A no-op while one is already open (`is_dialog_shown`, `frappe/public/js/frappe/ui/keyboard.js:143`).
	 */
	show_keyboard_shortcut_dialog(): void;
	/** frappe/public/js/frappe/ui/alt_keyboard_shortcuts.js:7-13. Creates the group on first use. */
	get_shortcut_group(parent: object): AltShortcutGroup;
	/** frappe/public/js/frappe/ui/alt_keyboard_shortcuts.js:19-66. Idempotent; installs the alt-key listeners once (`listener_added`, `frappe/public/js/frappe/ui/alt_keyboard_shortcuts.js:20-21`). */
	bind_shortcut_group_event(): void;
}

/**
 * `frappe.ui` — created by `frappe.provide("frappe.ui")` in half a dozen
 * bundles (`frappe/public/js/frappe/ui/dialog.js:4`,
 * `frappe/public/js/frappe/ui/field_group.js:3`,
 * `frappe/public/js/frappe/ui/toolbar/toolbar.js:4`, …).
 *
 * ### Deliberately NOT an open `[key: string]: unknown`
 *
 * `frappe.ui` carries ~85 further classes and helpers at v16.50.0 (`Slides`,
 * `Tree`, `FileUploader`, `FilterGroup`, `Tags`, the Espresso `tooltip` /
 * `dropdown` / `popover` / `toast`, …), most of which this package has not
 * verified. Adding an index signature would type every one of them —
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
	/** frappe/public/js/frappe/form/form.js:1 — `frappe.provide("frappe.ui.form")` (also `frappe/public/js/frappe/provide.js:25`). */
	form: FrappeUiFormNamespace;
	/** frappe/public/js/frappe/ui/dialog.js:10. */
	Dialog: typeof Dialog;
	/** frappe/public/js/frappe/ui/field_group.js:5 — `Dialog`'s base class. */
	FieldGroup: typeof FieldGroup;
	/**
	 * frappe/public/js/frappe/ui/dialog.js:8 — the modal stack. `show()` pushes onto
	 * it and the hide handler pops it, and `window.cur_dialog` is always its top
	 * (`frappe/public/js/frappe/ui/dialog.js:112-120,127-128`).
	 */
	open_dialogs: Dialog[];
	/**
	 * frappe/public/js/frappe/ui/dialog.js:408-417. Acts on `window.cur_dialog`, and
	 * does nothing without one: a dialog that is not `minimizable` is **hidden**;
	 * a minimizable one is **minimised** (`toggle_minimize()`) unless it already is.
	 * It never un-minimises.
	 */
	hide_open_dialog(): void;
	/** frappe/public/js/frappe/ui/toolbar/toolbar.js:4. */
	toolbar: FrappeUiToolbarNamespace;
	/** frappe/public/js/frappe/ui/keyboard.js:4. */
	keys: FrappeUiKeysNamespace;
	/** frappe/public/js/frappe/ui/theme_switcher.js:3. */
	ThemeSwitcher: typeof FrappeThemeSwitcher;
	/** frappe/public/js/frappe/ui/chart.js:6 — frappe's only in-tree `frappe.Chart` subclass. */
	RealtimeChart: typeof FrappeRealtimeChart;
	/** frappe/public/js/frappe/ui/sidebar/sidebar.js:56 — the v16 module sidebar; instance at `frappe.app.sidebar`. */
	Sidebar: typeof FrappeSidebar;
	/** frappe/public/js/frappe/ui/sidebar/sidebar_header.js:1 — one instance, `frappe.app.sidebar.sidebar_header`. */
	SidebarHeader: typeof FrappeSidebarHeader;
	/** frappe/public/js/frappe/ui/sidebar/dock.js:3 — the app rail; the instance is `frappe.app.sidebar.dock`, created on the first navigation. */
	Dock: typeof FrappeDock;
	/** frappe/public/js/frappe/ui/sidebar/sidebar_panel.js:40 — a drawer beside the sidebar; the notifications panel is one. */
	SidebarPanel: typeof FrappeSidebarPanel;
	/** frappe/public/js/frappe/ui/sidebar/sidebar_panel.js:159 — the registry deciding which {@link FrappeSidebarPanel} is open. */
	sidebar_panels: FrappeSidebarPanelRegistry;
	/** frappe/public/js/frappe/ui/sidebar/sidebar_item.js:1 — `frappe.provide("frappe.ui.sidebar_item")`; see {@link FrappeSidebarItemNamespace}. */
	sidebar_item: FrappeSidebarItemNamespace;
	/** frappe/public/js/frappe/ui/sidebar/sidebar.js:25 — the shell of a user's own workspace pages; matches `PRIVATE_MODULE` on the server. */
	PRIVATE_SHELL: "Private";
	/**
	 * frappe/public/js/frappe/ui/sidebar/dock_manager.js:51 — the "Manage Dock"
	 * dialog. **Absent from the desk bundle**: it exists only after
	 * `frappe.require("arrangement_editor.bundle.js")` resolves
	 * (frappe/public/js/arrangement_editor.bundle.js:6-13). Constructing one opens
	 * the dialog.
	 */
	DockManager?: new () => FrappeArrangementEditor;
	/** frappe/public/js/frappe/ui/sidebar/sidebar_manager.js:73 — the "Edit Sidebar" dialog; lazily loaded like {@link FrappeUiNamespace.DockManager}. */
	SidebarManager?: new () => FrappeArrangementEditor;
	/** frappe/public/js/frappe/ui/notifications/notifications.js:3. */
	Notifications: typeof FrappeNotifications;
	/**
	 * frappe/public/js/frappe/ui/components/badge.js:87-91 — the Espresso badge, as
	 * a jQuery element (`frappe.ui.badge(opts)`) or a markup string
	 * (`frappe.ui.badge.html(opts)`).
	 */
	badge: FrappeBadgeFunction;
	/**
	 * frappe/public/js/frappe/ui/components/button.js:119-209 — the Espresso button:
	 * a wired element, a markup string (`.html`), or an existing `<button>` dressed
	 * in place (`.dress`).
	 */
	button: FrappeButtonFunction;
	/** frappe/public/js/frappe/ui/components/tab_buttons.js:53 — the segmented single-select class behind {@link FrappeUiNamespace.tab_buttons}. */
	TabButtons: typeof FrappeTabButtons;
	/** frappe/public/js/frappe/ui/components/tab_buttons.js:238-242 — builds a {@link FrappeTabButtons} and returns its container. */
	tab_buttons: FrappeTabButtonsFunction;
	/** frappe/public/js/frappe/ui/sort_selector.js:1, in the desk bundle (frappe/public/js/desk.bundle.js:124). See {@link SortSelector}. */
	SortSelector: typeof SortSelector;
	/**
	 * frappe/public/js/frappe/ui/group_by/group_by.js:3. **Lazy**: defined by
	 * `report.bundle.js` (frappe/public/js/report.bundle.js:8), so absent until a
	 * report view has loaded. See {@link GroupBy}.
	 */
	GroupBy?: typeof GroupBy;
	/**
	 * frappe/public/js/frappe/views/reports/link_side_panel.js:16-40 — the click
	 * handler both report views bind to Link cells
	 * (frappe/public/js/frappe/views/reports/report_view.js:416-420). Previews the
	 * linked document in the {@link SidePanel} and returns `true`, or returns
	 * `false` and lets the click route as usual: when split view is off, on a
	 * modified or non-left click, when the anchor has no `data-doctype` /
	 * `data-name`, or when the cell's column is not Link or Dynamic Link.
	 * **Lazy**, like {@link FrappeUiNamespace.GroupBy}: defined by `report.bundle.js`
	 * (frappe/public/js/report.bundle.js:1).
	 */
	handle_link_cell_click?: (e: JQuery.ClickEvent<HTMLElement>, datatable: DataTable) => boolean;
	/**
	 * frappe/public/js/frappe/views/reports/link_side_panel.js:8-12 — whether a
	 * Link cell click previews: never on mobile, otherwise the desk setting
	 * `report_split_view`, on when unset. Lazy, from `report.bundle.js`.
	 */
	split_view_enabled?: () => boolean;
	/** frappe/public/js/frappe/ui/side_panel.js:399. Lazy, from `side_panel.bundle.js`. See {@link SidePanel}. */
	SidePanel?: typeof SidePanel;
	/**
	 * frappe/public/js/frappe/ui/side_panel.js:805-810 — the one {@link SidePanel},
	 * created on the first call. Lazy, from `side_panel.bundle.js`: load it with
	 * `frappe.require("side_panel.bundle.js")` first, as
	 * frappe/public/js/frappe/views/reports/link_side_panel.js:36-38 does.
	 */
	get_side_panel?: () => SidePanel;
}

/**
 * `window.frappe` — the desk global, assembled from every namespace slice.
 *
 * `frappe.provide("…")` (`frappe/public/js/frappe/provide.js:7-19`) grows these
 * namespaces **lazily**, one bundle at a time, which is why members that a
 * non-desk page can miss (`frappe.views.ListView`, `frappe.utils.datatable`) are
 * declared optional on their own interfaces rather than here.
 *
 * ### `frappe.auth` and `frappe.client` are NOT members, on purpose
 *
 * `core.d.ts` exports {@link FrappeGetLoggedUserResponse},
 * {@link FrappeClientGetListArgs} and {@link FrappeClientInsertArgs}, and it
 * would be easy to read those as evidence of `frappe.auth.get_logged_user()` and
 * `frappe.client.get_list()` JS namespaces. **They do not exist.** A grep of
 * `frappe/public/js` at v16.50.0 finds `frappe.client` only ever as a *string*
 * — the `method:` of a server call (`frappe/public/js/frappe/db.js:44,61,70,86,98,102`)
 * — and `frappe.auth` not at all; it is the dotted path of the whitelisted
 * Python function `get_logged_user` (`frappe/auth.py:450-452`). Those three
 * interfaces are the argument and response shapes of the **Python** endpoints,
 * and are used as type arguments to `frappe.xcall` / `fetch`, e.g.
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
	/** frappe/public/js/frappe/ui/dialog.js:4 and passim. */
	ui: FrappeUiNamespace;
	/**
	 * `frappe.provide("frappe.views")` — `frappe/public/js/frappe/views/factory.js:5`,
	 * `frappe/public/js/frappe/views/container.js:6`, `frappe/public/js/frappe/router.js:7`
	 * and the list bundles. There is no single `views.js`; members are lazily loaded.
	 */
	views: FrappeViewsNamespace;
	/**
	 * `frappe/public/js/frappe/ui/chart.js:4` — frappe-charts' `Chart`, assigned
	 * as a plain writable property (which is what makes carbon_frappe's
	 * shim-and-patch legal). Note the constructor **returns a different object**;
	 * see {@link FrappeChartConstructor}.
	 */
	Chart: FrappeChartConstructor;
	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar.js:5-13 — a module's icon: the
	 * dock row's own icon for a `Sidebar` row linking `module`, else the shell's
	 * `header_icon`, else `null`. Defined by the sidebar bundle, so it exists
	 * wherever the desk's sidebar does.
	 */
	get_module_icon(module: string | null | undefined): string | null;
	/**
	 * frappe/public/js/frappe/views/container.js:16 — the `frappe.ui.Page` on
	 * screen (`frappe.container.page.page`), or `null` before one has rendered.
	 */
	get_current_page(): Page | null;
	/**
	 * frappe/public/js/frappe/views/factory.js:37-53 — adds a `.page-container`
	 * for `page_name` (default: the current route, `frappe.get_route_str()`),
	 * builds a `frappe.ui.Page` in it (`single_column` unless `double_column`;
	 * the sidebar toggle is disabled unless `sidebar_position` is given),
	 * switches to it and returns the element. The element is also registered in
	 * {@link Frappe.pages} (frappe/public/js/frappe/views/container.js:46).
	 */
	make_page(
		double_column?: boolean,
		page_name?: string | null,
		sidebar_position?: "Left" | "Right" | null,
	): PageContainerElement;
	/**
	 * frappe/public/js/frappe/views/container.js:5 — every routed page's
	 * element, by route string (frappe/public/js/frappe/views/container.js:46).
	 * A Page doctype's script finds its own entry here and assigns its hooks;
	 * see {@link PageWrapper}. A name that has not been routed to has no entry,
	 * so narrow before use:
	 *
	 * ```js
	 * const wrapper = frappe.pages["my-page"];
	 * if (wrapper) wrapper.on_page_load = (wrapper) => { … };
	 * ```
	 */
	pages: Record<string, PageWrapper | undefined>;
}

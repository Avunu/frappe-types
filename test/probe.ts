/**
 * P1 smoke test — reproduces the exact carbon_frappe call sites gaps.md §2b–§2e
 * compiled and found broken. Not shipped (tsconfig `include`s test/ but
 * package.json `files` does not).
 */
import type { DataTableGetEditor, DataTableOptions, DataTableTotalCell } from "../src/datatable";
import type { DataTableTranslations } from "../src/utils";
import type { ReportView } from "../src/views";
import { Grid, GridRow } from "../src/deep-modules";
import type { GridOptions } from "../src/deep-modules";
import type { Grid as UiFormGrid, ControlTable } from "../src/ui/form";
import type { FrappeReportColumnTotalCell } from "../src/utils";
import type { Frappe } from "../src/index";

declare const frappe: Frappe;

// ---------------------------------------------------------------------------
// §2b — tables/grid/install.js:23-36. `this.grid = new CarbonGrid(...)`.
// The deep-module Grid and the ui/form Grid must be ONE type.
// ---------------------------------------------------------------------------
declare class CarbonGrid extends Grid {
	carbon_marker: string;
}
declare const ct: ControlTable;
declare const gopts: GridOptions;
ct.grid = new CarbonGrid(gopts);
const same_grid: UiFormGrid = new CarbonGrid(gopts);
void same_grid;
// and unguarded `this.wrapper.find(...)` — tables/grid/grid.js:56
const el: HTMLElement | undefined = same_grid.wrapper.find(".x").get(0);
void el;

// ---------------------------------------------------------------------------
// §2c/§2d/§2e — tables/datatable/install.js:37-63, verbatim option bag.
// ---------------------------------------------------------------------------
declare const rv: ReportView;
declare const CarbonDataTable: new (el: HTMLElement, opts: DataTableOptions) => never;
declare function __(s: string): string;

function setup_datatable(this: ReportView, values: Parameters<ReportView["get_data"]>[0]): void {
	this.$datatable_wrapper.empty();
	const root = this.$datatable_wrapper[0];
	if (!root) return;
	void new CarbonDataTable(root, {
		columns: this.columns,
		data: this.get_data(values),
		getEditor: this.get_editing_object.bind(this), // §2e
		language: frappe.boot.lang,
		translations: frappe.utils.datatable.get_translations(), // §2c
		checkboxColumn: true,
		inlineFilters: true,
		noDataMessage: __("No matching entries in the current results"),
		cellHeight: 48,
		direction: frappe.utils.is_rtl() ? "rtl" : "ltr",
		hooks: { columnTotal: frappe.utils.report_column_total }, // §2d
	});
}
void setup_datatable;

// The three single-sourcings, asserted in both directions.
declare const t_utils: DataTableTranslations;
const t_dt: NonNullable<DataTableOptions["translations"]> = t_utils;
void t_dt;
declare const cell_dt: DataTableTotalCell;
const cell_utils: FrappeReportColumnTotalCell = cell_dt; // deprecated alias
void cell_utils;
const ge: DataTableGetEditor = rv.get_editing_object.bind(rv);
void ge;

// ---------------------------------------------------------------------------
// §6.14 — the dropped index signatures. Known names resolve; typos must ERROR.
// (The negative half is asserted by the `tsc` run in the shell script below,
// not here, since this file must compile clean.)
// ---------------------------------------------------------------------------
const ctrl: typeof import("../src/ui/form").BaseControl = frappe.ui.form.ControlLink;
void ctrl;
const kanban: unknown = frappe.views.KanbanView;
void kanban;

// ---------------------------------------------------------------------------
// §4.4 — the 3-arg toggle_view override must stay assignable to the 2-arg base
// WITHOUT the base declaring a parameter frappe discards.
// (tables/grid/grid_row.js:188, called 3-arg from row_menu.js:80.)
// ---------------------------------------------------------------------------
declare class CarbonGridRow extends GridRow {
	override toggle_view(
		show?: boolean,
		callback?: (() => void) | null,
		opts?: { modal?: boolean }
	): this | undefined;
}
declare const cgr: CarbonGridRow;
void cgr.toggle_view(true, null, { modal: true });

// ---------------------------------------------------------------------------
// §6.12 — JQueryRegion. The ~14 consumer mount points lose their `!`.
// ---------------------------------------------------------------------------
import type { JQueryRegion } from "../src/index";
declare const g2: import("../src/ui/form").Grid;
const mount_a: HTMLElement = g2.wrapper[0]; // was: wrapper[0]!
const mount_b: HTMLElement = g2.wrapper.get(0); // was: .get(0)!
const mount_c: HTMLElement = rv.$datatable_wrapper[0]; // install.js:29
void mount_a; void mount_b; void mount_c;
// .find() is NOT narrowed — it can really miss.
const maybe: HTMLElement | undefined = g2.wrapper.find(".grid-body").get(0);
void maybe;
// A region is still an ordinary JQuery.
const asPlain: JQuery<HTMLElement> = g2.wrapper;
void asPlain;
declare const reg: JQueryRegion;
void reg;

// ---------------------------------------------------------------------------
// UI Shell header (carbon_frappe anatomy/ui_shell.ts) — the sidebar-driven
// header name / nav / switcher. Every read below is one the consumer makes.
// ---------------------------------------------------------------------------
import type {
	FrappeArrangedDockRow,
	FrappeDockEntry,
	FrappeModuleSidebar,
	FrappeSidebar,
	FrappeSidebarItem,
} from "../src/ui/sidebar";
import type { FrappeBootAppEntry } from "../src/core";

// prototype patch target — the one place the sidebar DOM is rebuilt
const make_sidebar: (this: FrappeSidebar) => void = frappe.ui.Sidebar.prototype.make_sidebar;
frappe.ui.Sidebar.prototype.make_sidebar = function (this: FrappeSidebar): void {
	make_sidebar.call(this);
};

// mount gate: `frappe.app` is `{}` until the Application constructor returns
const sidebar: FrappeSidebar | undefined = frappe.app && frappe.app.sidebar;
if (sidebar) {
	// constructor-assigned fields are optional (setup_complete early return)
	const wrapper: JQuery<HTMLElement> | undefined = sidebar.wrapper;
	const hidden: boolean = wrapper ? wrapper.is(":hidden") : true;
	void hidden;
	// the shell on screen is a key of module_sidebars; the owning app is derived
	// from it (get_sidebar_app), never stored — frappe.current_app is gone
	const shell: string | undefined = sidebar.current_module;
	const data: FrappeModuleSidebar | undefined = sidebar.sidebar_data;
	const app: FrappeBootAppEntry | null | undefined = sidebar.get_sidebar_app();
	const prefix: string = app ? app.app_title : "";
	void shell;
	void data;
	void prefix;
	// where the app's icon / the shell's tile / a rail entry lead
	const app_route: string | null | undefined = sidebar.app_landing_route(app);
	const shell_route: string | null = sidebar.module_landing_route(shell);
	void app_route;
	void shell_route;
	const rail: FrappeDockEntry[] = sidebar.collect_dock_entries(app);
	const entry: FrappeDockEntry | undefined = rail[0];
	const entry_route: string | null | undefined = sidebar.dock_entry_route(entry);
	const entry_active: boolean = sidebar.is_active_entry(entry);
	void entry_route;
	void entry_active;
	sidebar.toggle_width();
	const expanded: boolean = sidebar.sidebar_expanded === true;
	void expanded;
	// the header is one instance whose menu can be hung on another element
	const header = sidebar.sidebar_header;
	if (header && wrapper) {
		const menu: unknown = header.attach_menu(wrapper.find(".dock-logo"));
		void menu;
		const rows = header.switcher_items();
		void rows;
	}
	// the user menu is shared with the dock's avatar
	if (wrapper) {
		sidebar.create_user_menu({
			parent: wrapper.find(".dropdown-navbar-user"),
			button: wrapper.find(".sidebar-user-button"),
			side: "right",
			align: "end",
		});
	}
	// the unread badge is a document-wide `.notification-count` lookup now
	const view = sidebar.notifications?.tabs.notifications;
	if (view) view.update_count_badge(view.unread_count);
	// the notifications panel and its dismissal
	frappe.ui.sidebar_panels.toggle("notifications");
	frappe.ui.sidebar_panels.close_all();
	// the search modal behind the Search row
	frappe.app?.awesome_bar?.open();
}

// boot payload shapes
const first: FrappeSidebarItem | undefined = frappe.boot.module_sidebars["Accounts"]?.items[0];
const kind: "Link" | "Section Break" | "Spacer" | undefined = first?.type;
void kind;
const nested: FrappeSidebarItem[] = first?.nested_items ?? [];
void nested;
const rail_rows: FrappeArrangedDockRow[] = frappe.boot.dock["erpnext"] ?? [];
void rail_rows;
const owner_shell: string | undefined = frappe.boot.entity_module["Item"];
const canonical: string | undefined = frappe.boot.canonical_shell.DocType["Item"];
const home_shell: string | null = frappe.boot.home_shell;
const heirs: string[] | undefined = frappe.boot.code_only_module_heirs["Core"];
const host: string | undefined = frappe.boot.app_rail_host["india_compliance"];
const desktop_page: "Apps" | "Desktop Icons" = frappe.boot.desktop_page;
void owner_shell;
void canonical;
void home_shell;
void heirs;
void host;
void desktop_page;
const search_on: boolean = frappe.boot.desk_settings.search_bar === 1;
void search_on;
const dock_mode: "Floating" | "Pinned" | null = frappe.boot.desk_settings.dock_mode;
void dock_mode;
// `desktop_icons` exists only when Desktop Settings.desktop_page is "Desktop Icons"
const icon_app: string | null | undefined = frappe.boot.desktop_icons?.[0]?.app;
void icon_app;
const route: string | undefined = frappe.utils.get_route_for_icon(frappe.boot.desktop_icons?.[0]);
void route;
const mobile: boolean = frappe.is_mobile();
void mobile;
// shell routing: the shell the URL names, and how one is spelled in a path
const shell_in_url: string | null = frappe.router.current_shell;
const shell_slug: string = frappe.router.shell_slug("Shift & Attendance");
void shell_in_url;
void shell_slug;
const item_route: string | null | undefined = frappe.ui.sidebar_item.get_route(
	{ type: "Link", link_type: "Workspace", link_to: "Home" },
	false,
	"Accounts"
);
void item_route;
const module_icon: string | null = frappe.get_module_icon("Accounts");
void module_icon;

// datatype / number_format casts and the datetime format helpers — what a
// paste-into-grid coercion needs (carbon_frappe tables/datatable/paste.ts)
const grouped: string = strip_number_groups("1,234.5");
void grouped;
const asInt: number = cint("007", null);
void asInt;
const asFloat: number = flt("1,234.50", 2);
void asFloat;
const asStr: string = cstr(null);
void asStr;
const iso: boolean = frappe.datetime.validate("2026-09-16");
void iso;
const sys: string = frappe.datetime.user_to_str("16-09-2026");
void sys;
const user: string = frappe.datetime.str_to_user("2026-09-16 10:00:00", false, true);
void user;
const fmt: string = frappe.datetime.get_user_date_fmt() + frappe.datetime.get_user_time_fmt();
void fmt;
const defaults: string = frappe.defaultDateFormat + frappe.defaultTimeFormat + frappe.defaultDatetimeFormat;
void defaults;

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

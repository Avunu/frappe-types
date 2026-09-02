/**
 * `frappe-datatable` — the `window.DataTable` / `frappe.DataTable` slice of the
 * Frappe desk JS API.
 *
 * Verified against:
 *   - `apps/frappe/node_modules/frappe-datatable@1.20.7/src/*.js` (the library itself)
 *   - `apps/frappe/frappe/public/js/frappe/ui/datatable.js` (frappe.DataTable — THE only assignment)
 *   - `apps/frappe/frappe/public/js/frappe/views/reports/report_view.js` (window.DataTable + `new DataTable`)
 *   - `apps/frappe/frappe/public/js/frappe/views/reports/query_report.js` (`new window.DataTable`)
 *   - `apps/frappe/frappe/public/js/frappe/data_import/import_preview.js`
 *   - `apps/frappe/frappe/public/js/frappe/form/multi_select_dialog.js`
 *   - `apps/carbon_frappe/carbon_frappe/public/js/tables/datatable/*.js` (the replacement)
 *
 * Frappe v16.33.0 pins frappe-datatable 1.20.7. There are exactly FIVE
 * construction sites in frappe core:
 *
 * | file                                  | line | reaches the constructor via   |
 * |---------------------------------------|------|-------------------------------|
 * | `views/reports/report_view.js`        | 340  | module-local `import DataTable`|
 * | `views/reports/query_report.js`       | 1134 | `new window.DataTable(...)`   |
 * | `data_import/import_preview.js`       | 139  | module-local import           |
 * | `form/multi_select_dialog.js`         | 217  | `new frappe.DataTable(...)`   |
 * | `desk/page/system_console` (indirect) |  —   | module-local import           |
 *
 * ## The dual-implementation problem, and how these types resolve it
 *
 * carbon_frappe REPLACES the library at runtime
 * (`tables/datatable/install.js:27-28` assigns `window.DataTable` and
 * `frappe.DataTable` to its own `CarbonDataTable`), while keeping the public
 * API. The two implementations are NOT identical, and the differences are real:
 * stock has members carbon does not reproduce, carbon has members stock never
 * had, and a handful of methods differ in arity or return type.
 *
 * Every such member is declared here with the divergence spelled out in its
 * TSDoc, and typed so that BOTH implementations satisfy the declaration:
 *
 *   - "stock only" members are `?`-optional (they are `undefined` under carbon_frappe)
 *   - "carbon_frappe only" members are `?`-optional (they are `undefined` on stock)
 *   - divergent return types are honest unions (e.g. `Promise<void> | void`)
 *
 * A consumer that knows which world it is in should narrow; a consumer writing
 * against the global must guard. There is deliberately no `any` anywhere: a
 * confident lie here costs more than a guard at the call site.
 *
 * Assembly notes for the package author:
 *   - `window.DataTable` and `frappe.DataTable` are BOTH mutable and BOTH typed
 *     {@link DataTableConstructor}; see {@link DataTableGlobals} /
 *     {@link FrappeDataTableNamespace}.
 *   - The `dt-*` DOM contract is at the bottom of this file.
 *
 * @packageDocumentation
 */

import type { DocField } from "./model";
// Single-sourced from `utils.d.ts`; see the note on `DataTableTranslations` below.
import type { DataTableTranslations } from "./utils";

// ---------------------------------------------------------------------------
// Scalars and small unions
// ---------------------------------------------------------------------------

/**
 * Sort state of a column.
 * Source: `datamanager.js:41` (`col.sortOrder !== 'none'`), `defaults.js:57-61`.
 */
export type DataTableSortOrder = "asc" | "desc" | "none";

/** Source: `defaults.js:92` / `datatable.js:115` (`dir="${this.options.direction}"`). */
export type DataTableDirection = "ltr" | "rtl";

/**
 * Column width strategy.
 * Source: `defaults.js:78` (`layout: 'fixed', // fixed, fluid, ratio`),
 * `style.js:214-263` (`setupColumnWidth`), `style.js:37` (only `fluid` binds resize).
 */
export type DataTableLayout = "fixed" | "fluid" | "ratio";

/** Source: `datamanager.js:77` (`align: 'center'`), `datamanager.js:139` (`align = 'right'`). */
export type DataTableAlign = "left" | "center" | "right";

/**
 * A column's position in `datamanager.columns`, INCLUDING the auto-injected
 * `_checkbox` and `_rowIndex` columns.
 *
 * Serialised into the `data-col-index` attribute and into the
 * `.dt-cell--col-{colIndex}` / `.dt-cell--{colIndex}-{rowIndex}` class names, so
 * it is read back out of the DOM as a string and re-parsed with `Number(...)`.
 */
export type DataTableColIndex = number;

/**
 * A row's position in the ORIGINAL `options.data` array — stable across sorting
 * and filtering (`datamanager.js:205` keeps the permutation in `rowViewOrder`
 * and never reorders `rows`).
 */
export type DataTableRowIndex = number;

/**
 * A row index as it can actually come back out of the library.
 *
 * `RowManager.getCheckedRows` (`rowmanager.js:80-87`) iterates its `checkMap`
 * array with `for (let rowIndex in this.checkMap)`, so stock frappe-datatable
 * hands back the array's own STRING keys, not numbers. Every consumer
 * (`report_view.js:1415-1416`, `query_report.js:2406-2413`) only uses them to
 * index `this.data`, so the wart is invisible in JS — but it is load-bearing in
 * TypeScript. carbon_frappe's replacement (`tables/datatable/managers.js:190-195`)
 * uses `reduce` and returns real numbers.
 */
export type DataTableRowIndexKey = DataTableRowIndex | `${number}`;

/**
 * A cell's value before formatting.
 *
 * The library never constrains this — `prepareCell` (`datamanager.js:114-130`)
 * stores whatever it is handed, and the default column formatter
 * (`datamanager.js:96-101`) is `value == null ? '' : value + ''`. In practice
 * frappe feeds it doc field values, so scalars and null.
 */
export type DataTableCellValue = string | number | boolean | null | undefined;

// ---------------------------------------------------------------------------
// Formatters and comparators
// ---------------------------------------------------------------------------

/**
 * Custom cell renderer. Resolved as `cell.format || cell.column.format`
 * (`cellmanager.js:971` `CellManager.getCustomCellFormatter`), and the result is
 * memoised on `cell.html` (`cellmanager.js:892`).
 *
 * Called with FOUR arguments when rendering
 * (`cellmanager.js:886` `customFormatter(cell.content, row, cell.column, data)`)
 * and with FIVE when filtering
 * (`filterRows.js:41` `formatter(cell.content, rows[...], cell.column, rowData, filter)`),
 * which is why `filter` is declared and optional.
 *
 * `data` is the ORIGINAL row from `options.data` (`datamanager.js:603` `getData`),
 * NOT the prepared cell array.
 *
 * @remarks `query_report.js:1433-1447` declares its own `format` with the same
 * five parameters and forwards them to `report_settings.formatter`.
 */
export type DataTableCellFormatter = (
	value: DataTableCellValue,
	row: DataTableRow | DataTableDataRow,
	column: DataTableColumn,
	data: DataTableDataRow | undefined,
	filter?: DataTableGuessedFilter
) => string;

/**
 * Per-column comparison override used by the inline filters' `greaterThan` /
 * `lessThan` / `range` methods (`filterRows.js:52-64` `getCompareValues`).
 *
 * Must return a `[cellValue, keywordValue]` pair, or a falsy value to fall back
 * to numeric-then-string comparison. `report_view.js:1272-1281` and
 * `query_report.js:1411-1420` both install one for `Date` columns that returns
 * `[+cellValue, +keywordValue]` or `null`.
 */
export type DataTableCompareValue = (
	cell: DataTableCell,
	keyword: string
) => [number | string, number | string] | null | undefined;

/**
 * The filter descriptor `filterRows` derives from a user's keyword
 * (`filterRows.js:143-208` `guessFilter`). `{}` for an empty keyword.
 */
export interface DataTableGuessedFilter {
	type?: "contains" | "containsNumber" | "greaterThan" | "lessThan" | "equals" | "notEquals" | "range";
	/** `string` for text filters, `number` for `=`/`!=`, `string[]` (length 2) for `a:b` ranges. */
	text?: string | number | string[];
}

/**
 * Inline-filter keywords, keyed by column index.
 *
 * Built in `columnmanager.js:390-399` from `input.dataset.colIndex`, so the KEYS
 * are strings even though they denote {@link DataTableColIndex}s, and the values
 * are the raw `<input>` values.
 */
export type DataTableAppliedFilters = Record<string, string>;

/**
 * Replacement for the built-in row filter (`defaults.js:87` / `filterRows.js`).
 *
 * `DataManager` wraps whatever is supplied in `nextTick`
 * (`datamanager.js:14`, `utils.js:87-97`), so the datatable ALWAYS sees a
 * promise regardless of what the hook returns. Returning nothing means "show
 * everything" (`datamanager.js:438-440`).
 */
export type DataTableFilterRows = (
	this: DataManager,
	rows: DataTableRow[],
	filters: DataTableAppliedFilters,
	datamanager: DataManager
) => DataTableRowIndex[] | Promise<DataTableRowIndex[]> | void;

// ---------------------------------------------------------------------------
// Cell / column / row data shapes
// ---------------------------------------------------------------------------

/**
 * Fields shared by prepared cells and prepared columns.
 *
 * frappe-datatable does not distinguish the two structurally: `prepareHeader`
 * (`datamanager.js:86-112`) runs the column definitions through the very same
 * `prepareCell` the body rows go through, then merges `baseCell` over them. A
 * column IS a cell with `isHeader: 1`.
 */
export interface DataTableCellBase {
	/**
	 * Raw value. For `_rowIndex` this is the 1-based serial number as a string
	 * (`datamanager.js:161`); for `_checkbox` it is the checkbox HTML
	 * (`datamanager.js:623-625`).
	 */
	content?: DataTableCellValue;

	/** Set by `prepareCell` (`datamanager.js:118`). */
	colIndex?: DataTableColIndex;

	/** Set by `prepareCell` (`datamanager.js:117`); reset by `sortRows`. */
	sortOrder?: DataTableSortOrder;

	/**
	 * Memoised formatter output (`cellmanager.js:892` `cell.html = contentHTML`).
	 * Also read back by `filterRows.js:48` for string comparisons.
	 */
	html?: string;

	/** Per-cell formatter; takes precedence over the column's (`cellmanager.js:971`). */
	format?: DataTableCellFormatter;

	/** `false` suppresses inline editing (`cellmanager.js:451-454`). */
	editable?: boolean;

	/** `false` suppresses the focus ring and arrow-key landing (`cellmanager.js:231`). */
	focusable?: boolean;

	/** `false` hides the sort indicator (`cellmanager.js:868`). */
	sortable?: boolean;

	/** `false` hides the drag handle (`cellmanager.js:875`). */
	resizable?: boolean;

	/** `false` hides the per-column dropdown (`cellmanager.js:878`). */
	dropdown?: boolean;

	/** Column pinning; emits `dt-cell--sticky` (`cellmanager.js:829`). */
	sticky?: boolean;

	/** Fixed width in px; `null` means "measure it" (`style.js:183-213`). */
	width?: number | null;

	align?: DataTableAlign;

	/** Tree indent depth, copied down from `row.meta.indent` (`datamanager.js:217-219`). */
	indent?: number;
}

/**
 * One prepared body cell — an element of a {@link DataTableRow}.
 *
 * Produced by `datamanager.prepareRow` (`datamanager.js:208-226`): a scalar in
 * the source data becomes `{ content: <scalar>, ... }`, and an object in the
 * source data is merged wholesale (`datamanager.js:122-127`), which is how
 * `report_view.build_row` (`report_view.js:1360-1380`) attaches `name`,
 * `doctype`, `editable` and a per-cell `format`.
 */
export interface DataTableCell extends DataTableCellBase {
	/** Always present after preparation (`datamanager.js:214-216`). */
	rowIndex?: DataTableRowIndex;

	/** Back-pointer to the owning column (`datamanager.js:119`). */
	column?: DataTableColumn;

	/**
	 * Docname of the record this cell belongs to.
	 * Source: `report_view.js:1367` / `1390`; read back at `report_view.js:705`.
	 */
	name?: string;

	/**
	 * Doctype of the record this cell belongs to (child tables differ from the
	 * list's doctype). Source: `report_view.js:1368`; read at `report_view.js:706`.
	 */
	doctype?: string;

	/** Header cells only; `1` on everything `prepareHeader` produces (`datamanager.js:89`). */
	isHeader?: 0 | 1;

	/** Filter-row cells only (`rowmanager.js:341`). */
	isFilter?: 0 | 1;

	/** Footer total-row cells only (`body-renderer.js:104`). */
	isTotalRow?: 0 | 1;
}

/**
 * One prepared column — an element of `datamanager.columns`.
 *
 * @remarks After `prepareHeader` (`datamanager.js:104-111`) `id` and `content`
 * are guaranteed non-empty: `content` falls back to `name` then `''`, and `id`
 * falls back to `content`. Everything else is `baseCell`-defaulted, so the
 * booleans are always present at runtime even though they are optional in the
 * INPUT shape ({@link DataTableColumnInput}).
 */
export interface DataTableColumn extends DataTableCellBase {
	/**
	 * Stable column key. `_checkbox` and `_rowIndex` for the injected standard
	 * columns (`datamanager.js:58` / `:73`); otherwise the caller's id, e.g. the
	 * fieldname (`report_view.js:1258`) or `"{child_doctype}:{fieldname}"`
	 * (`report_view.js:1261`).
	 */
	id: string;

	/** Header label as HTML (`datamanager.js:108`). */
	content?: DataTableCellValue;

	/** Human label; `content` falls back to it (`datamanager.js:108`). */
	name?: string;

	/** Always `1` on a column (`datamanager.js:89`). */
	isHeader?: 0 | 1;

	/**
	 * The doc field behind the column.
	 * Source: `report_view.js:1288`; read at `report_view.js:704`
	 * (`getColumn(colIndex).docfield.fieldname`) and `report_view.js:555`.
	 * Absent on `_checkbox` / `_rowIndex` and on Query Report columns.
	 */
	docfield?: DocField;

	/** Fieldname the column reads from the row (`report_view.js:1286`). */
	field?: string;

	/** Inline-filter comparator override (`report_view.js:1292`). */
	compareValue?: DataTableCompareValue | null;

	/** Measured width, filled by `style.setupNaturalColumnWidth` (`style.js:183-213`). */
	naturalWidth?: number;

	/** Honoured by `style.js:257` and `columnmanager.getColumnMinWidth` (`columnmanager.js:470`). */
	minWidth?: number;

	/**
	 * Query Report columns carry their raw report-column fields through
	 * untouched — `Object.assign(column, {...})` at `query_report.js:1424`. The
	 * total-row hook reads `column.fieldtype` and `column.disable_total`
	 * (`utils.js:970-977`).
	 */
	fieldtype?: string;
	fieldname?: string;
	label?: string;
	disable_total?: boolean | 0 | 1;
}

/**
 * A column as PASSED IN via `options.columns`.
 *
 * `validateColumns` (`datamanager.js:228-239`) accepts only strings and objects;
 * a string becomes `{ content: <string> }` (`datamanager.js:126`).
 */
export type DataTableColumnInput = string | (Partial<DataTableColumn> & { id?: string });

/** A cell as PASSED IN inside `options.data`. */
export type DataTableCellInput = DataTableCellValue | Partial<DataTableCell>;

/**
 * A row as PASSED IN via `options.data`.
 *
 * `validateData` (`datamanager.js:241-247`) requires an array of arrays or an
 * array of objects; `prepareRows` (`datamanager.js:146-186`) branches on
 * `Array.isArray(d)`. In the object form the keys are column `id`s and `indent`
 * is reserved for tree mode.
 */
export type DataTableDataRow =
	| DataTableCellInput[]
	| ({ indent?: number } & Record<string, DataTableCellInput>);

/** `options.data` (`defaults.js:7`). */
export type DataTableData = DataTableDataRow[];

/**
 * Per-row bookkeeping monkey-patched onto the row array
 * (`datamanager.js:224` `row.meta = meta`).
 */
export interface DataTableRowMeta {
	/** Position in the original data; assigned once and never renumbered. */
	rowIndex: DataTableRowIndex;

	/** Tree depth; only present when rows were objects (`datamanager.js:181`). */
	indent?: number;

	/** `true` when no following row is deeper (`datamanager.js:193-195`). */
	isLeaf?: boolean;

	/** Collapsed state of a tree node (`datamanager.js:196`, `rowmanager.js:216`). */
	isTreeNodeClose?: boolean;
}

/**
 * One prepared row: an ARRAY of cells with a `meta` property bolted on.
 *
 * This shape is asserted by carbon_frappe's own browser suite
 * (`scripts/tables/report.mjs:81` `Array.isArray(dt.datamanager.rows[0])`) and
 * is what `import_preview.js:180` iterates (`.map(row => row.meta.rowIndex)`).
 */
export interface DataTableRow extends Array<DataTableCell> {
	meta: DataTableRowMeta;

	/**
	 * carbon_frappe only. The flat `indent` list is re-nested once at
	 * construction so TanStack can drive tree mode
	 * (`tables/datatable/datatable.js:227-242`); `meta.rowIndex` stays the
	 * canonical address.
	 */
	__children?: DataTableRow[];
}

/**
 * Second argument to `RowManager.getRowHTML` (`rowmanager.js:330-357`).
 *
 * Body rows pass `row.meta`; the header passes `{ isHeader: 1 }`
 * (`columnmanager.js:49`); the filter row passes `{ isFilter: 1 }`
 * (`columnmanager.js:52`); the total row passes
 * `{ isTotalRow: 1, rowIndex: 'totalRow' }` (`body-renderer.js:90`) — which is
 * why the emitted class can be `dt-row-totalRow` and not just `dt-row-{n}`.
 */
export interface DataTableRowRenderProps extends Partial<Omit<DataTableRowMeta, "rowIndex">> {
	rowIndex?: DataTableRowIndex | "totalRow";
	isHeader?: 0 | 1;
	isFilter?: 0 | 1;
	isTotalRow?: 0 | 1;
}

// ---------------------------------------------------------------------------
// The editor protocol
// ---------------------------------------------------------------------------

/**
 * The object `options.getEditor` must return.
 *
 * Lifecycle (`cellmanager.js:434-476` `activateEditing`, `cellmanager.js:531-577`
 * `submitEditing`):
 *   1. `initValue(cell.content, rowIndex, column)` right after the editor mounts;
 *   2. `getValue()` on commit — may return a promise, which is awaited;
 *   3. `setValue(value, rowIndex, column)` only when the value CHANGED
 *      (`cellmanager.js:555` short-circuits on `oldValue === value`);
 *      if it returns a rejected promise the cell is reverted
 *      (`cellmanager.js:566-572`).
 *
 * The write is OPTIMISTIC: `updateCell` runs before `setValue` settles
 * (`cellmanager.js:560`), which is what keeps Report View responsive while
 * `frappe.db.set_value` is in flight.
 */
export interface DataTableEditor {
	/**
	 * Seed the control. Upstream's default editor ignores the 2nd and 3rd
	 * arguments (`cellmanager.js:518-521`); `report_view.js:709-711` does too.
	 */
	initValue(value: DataTableCellValue, rowIndex?: DataTableRowIndex, column?: DataTableColumn): void;

	/** Current value. A promise is awaited before `setValue` (`cellmanager.js:546-551`). */
	getValue(): DataTableCellValue | Promise<DataTableCellValue>;

	/**
	 * Persist. A rejected promise reverts the optimistic cell update
	 * (`cellmanager.js:566-572`); `report_view.js:712-715` returns the
	 * `frappe.db.set_value` promise from here.
	 */
	setValue(
		value: DataTableCellValue,
		rowIndex?: DataTableRowIndex,
		column?: DataTableColumn
	): void | Promise<unknown>;
}

/**
 * `options.getEditor` — the hook that swaps a real frappe control into the cell.
 *
 * Called with SEVEN arguments (`cellmanager.js:492-495`), even though
 * `CellManager.getEditor` itself only names four; `column`, `row` and `data` are
 * looked up from the DataManager immediately before the call.
 *
 * Return values (`cellmanager.js:496-504`):
 *   - an editor object → used;
 *   - `false`          → editing is REFUSED for this cell (no fallback);
 *   - `undefined`      → falls back to a plain `<input class="dt-input">`.
 *
 * `parent` is the `.dt-cell__edit` div INSIDE the cell (`cellmanager.js:470`,
 * markup at `cellmanager.js:944-946`). Callers mount frappe controls into it and
 * walk back up with `parent.closest('.dt-cell')`, so it must stay a descendant
 * of the cell.
 *
 * Installed by `report_view.js:343` (`getEditor: this.get_editing_object.bind(this)`,
 * implementation at `report_view.js:697-730`) and by report scripts through
 * `report_settings.get_datatable_options`.
 */
export type DataTableGetEditor = (
	colIndex: DataTableColIndex,
	rowIndex: DataTableRowIndex,
	value: DataTableCellValue,
	parent: HTMLElement,
	column: DataTableColumn | undefined,
	row: DataTableRow | undefined,
	data: DataTableDataRow | undefined
) => DataTableEditor | false | undefined | void;

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/**
 * A total-row cell handed to `hooks.columnTotal`.
 * Built by `body-renderer.js:97-108`; `column` is the real column, which is what
 * `frappe.utils.report_column_total` reads (`utils.js:970` `column.column.disable_total`).
 */
export interface DataTableTotalCell extends DataTableCell {
	isTotalRow: 1;
	colIndex: DataTableColIndex;
	column: DataTableColumn;
}

/**
 * `options.hooks` (`defaults.js:63-65`).
 *
 * @remarks `columnTotal` is invoked with `this` bound to the DataTable instance
 * (`body-renderer.js:115` `.call(this.instance, columnValues, cell)`) and only
 * two arguments; the third parameter exists because
 * `frappe.utils.report_column_total` declares it (`utils.js:969`) for its other
 * callers. Returning `null`/`undefined` falls through to the built-in numeric
 * sum (`body-renderer.js:116-129`).
 */
export interface DataTableHooks {
	columnTotal?:
		| ((
				this: DataTable,
				values: DataTableCellValue[],
				cell: DataTableTotalCell,
				type?: "mean"
		  ) => string | number | null | undefined)
		| null;
}

/**
 * `options.events` (`defaults.js:50-56`).
 *
 * All handlers are applied with `this` bound to the DataTable instance
 * (`datatable.js:258` `handler.apply(this, args)`), which report scripts rely on.
 */
export interface DataTableEvents {
	/** Fired after `columnmanager.removeColumn` (`columnmanager.js:299-312`). */
	onRemoveColumn(this: DataTable, column: DataTableColumn): void;

	/** Fired after a header drag reorders two columns (`columnmanager.js:327-345`). */
	onSwitchColumn(this: DataTable, column1: DataTableColumn, column2: DataTableColumn): void;

	/** Fired after a sort settles (`columnmanager.js:275`). */
	onSortColumn(this: DataTable, column: DataTableColumn): void;

	/**
	 * Fired per row by `checkRow` (`rowmanager.js:108`) and with NO argument by
	 * `checkAll` (`rowmanager.js:134`) — hence the optional parameter.
	 */
	onCheckRow(this: DataTable, row?: DataTableRow): void;

	/** Fired by `destroy()` (`datatable.js:149`). */
	onDestroy(this: DataTable): void;
}

/**
 * One entry of the per-column header dropdown (`defaults.js:9-49`).
 *
 * `action` is invoked with `this` bound to the DataTable and the clicked column
 * as its only argument (`columnmanager.js:101` `callback.call(this.instance, this.getColumn(colIndex))`).
 */
export interface DataTableHeaderDropdownItem {
	/** Rendered as raw HTML into the list item (`columnmanager.js:503`). */
	label: string;
	action?: (this: DataTable, column: DataTableColumn) => void;
	/**
	 * Any truthy value adds `dt-hidden` to the item at build time
	 * (`columnmanager.js:500`); the built-ins use the string `"hidden"`
	 * (`defaults.js:37`).
	 */
	display?: "hidden" | boolean;
	/**
	 * Marks the Freeze / Unfreeze pair so `updateStickyDropdownItems`
	 * (`columnmanager.js:517-529`) can show exactly one of them.
	 */
	stickyAction?: "stick" | "unstick";
}

/**
 * Per-language message table (`options.translations`).
 *
 * A value is either a plain string or a pluralisation map keyed by count with a
 * `default` fallback (`translationmanager.js:20-27`). frappe builds one at
 * `frappe/public/js/frappe/utils/datatable.js:3-21`.
 *
 * COLLISION RESOLVED - `utils.d.ts` exports a `DataTableTranslations` of the
 * same name for the same object, and the two were mutually unassignable, so
 * frappe's own wiring did not type-check:
 *
 * ```ts
 * // carbon_frappe tables/datatable/install.js:47
 * translations: frappe.utils.datatable.get_translations()
 * // -> TS2322: '(utils).DataTableTranslations' is not assignable to
 * //            '(datatable).DataTableTranslations'
 * ```
 *
 * `utils.d.ts` won ownership: it types the plural entries as
 * `{ 1: string; default: string }`, which is exactly what
 * `frappe/public/js/frappe/utils/datatable.js:1-22` emits, whereas the copy
 * that stood here lost the required `1` key. Its declaration is re-exported
 * below, so `options.translations` and `get_translations()` are now one type.
 * The `frappe-datatable` side of the contract - a value may be a bare string
 * OR a plural map (`translationmanager.js:20-27`) - is preserved by
 * `DataTableTranslationTable`'s index signature over there.
 */
export type { DataTableTranslations };

/**
 * Swap in replacement sub-managers (`datatable.js:93` merges this over the
 * built-ins). Unused by frappe core; the key names are the class names.
 */
export interface DataTableComponentOverrides {
	DataManager?: unknown;
	CellManager?: unknown;
	ColumnManager?: unknown;
	RowManager?: unknown;
	BodyRenderer?: unknown;
	Style?: unknown;
	Keyboard?: unknown;
}

/**
 * Constructor options. Defaults from `defaults.js`, merged
 * `{...DEFAULT_OPTIONS, ...this.options, ...options}` at `datatable.js:67-70`
 * — a SHALLOW merge, so passing `events` or `hooks` replaces the whole object
 * except that `events` gets a second, deeper merge at `datatable.js:79-83`.
 */
export interface DataTableOptions {
	/** Default `[]` (`defaults.js:6`). */
	columns?: DataTableColumnInput[];

	/** Default `[]` (`defaults.js:7`). Falsy skips the initial render (`datatable.js:41`). */
	data?: DataTableData;

	/** Raw HTML for the dropdown toggle; default is a feather chevron (`defaults.js:8`, `icons.js:6`). */
	dropdownButton?: string;

	/**
	 * EXTRA dropdown items. Concatenated after the six built-ins
	 * (`datatable.js:72-76`), so index 0-5 are always Sort Asc/Desc/Reset,
	 * Remove column, Freeze, Unfreeze. `report_view.js:366` appends "Add Column".
	 */
	headerDropdown?: DataTableHeaderDropdownItem[];

	events?: Partial<DataTableEvents>;

	hooks?: DataTableHooks;

	/** Glyphs appended to a sorted header (`defaults.js:57-61`, `cellmanager.js:869-871`). */
	sortIndicator?: Partial<Record<DataTableSortOrder, string>>;

	overrideComponents?: DataTableComponentOverrides;

	/** Default `filterRows` from `filterRows.js` (`defaults.js:87`). */
	filterRows?: DataTableFilterRows;

	/** Text inside the `.dt-freeze` overlay (`defaults.js:88`, `datatable.js:120-122`). */
	freezeMessage?: string;

	/** Default `null` (`defaults.js:89`). See {@link DataTableGetEditor}. */
	getEditor?: DataTableGetEditor | null;

	/** Inject the `_rowIndex` serial-number column. Default `true` (`defaults.js:90`). */
	serialNoColumn?: boolean;

	/** Header text for `_rowIndex`. Default `''` (`defaults.js:91`, `datamanager.js:74`). */
	serialNoColumnLabel?: string;

	/**
	 * Inject the `_checkbox` column. Default `false` (`defaults.js:92`);
	 * `report_view.js:346` and `multi_select_dialog.js:224` set it `true`.
	 * Also what makes `rowmanager.checkMap` exist at all (`rowmanager.js:40-43`).
	 */
	checkboxColumn?: boolean;

	/**
	 * Default `true` (`defaults.js:75`). DEAD: read nowhere outside `defaults.js`
	 * since the body renderer moved from clusterize.js to HyperList
	 * (`body-renderer.js:1`). Accepted and ignored.
	 */
	clusterize?: boolean;

	/** Enables `instance.log()` (`defaults.js:76`, `datatable.js:268-272`). */
	logs?: boolean;

	/** Default `'fixed'` (`defaults.js:78`). */
	layout?: DataTableLayout;

	/** Default `translate('No Data')` (`defaults.js:79`, rendered at `body-renderer.js:157-172`). */
	noDataMessage?: string;

	/**
	 * Row height in px. Default `40` (`defaults.js:80`); frappe passes 35
	 * (`report_view.js:349`, `import_preview.js:143`, `multi_select_dialog.js:225`)
	 * and 33 (`query_report.js:1121`). Drives HyperList's `itemHeight`
	 * (`body-renderer.js:41`) and the `.dt-row` height (`style.js:164-169`).
	 */
	cellHeight?: number;

	/** Default `30` (`defaults.js:81`); floors every measured/dragged width (`style.js:257`). */
	minimumColumnWidth?: number;

	/**
	 * Render the filter row under the header. Default `false` (`defaults.js:82`);
	 * `report_view.js:347`, `query_report.js:1118` and
	 * `multi_select_dialog.js:222` set it `true`.
	 */
	inlineFilters?: boolean;

	/** Indent/toggle rendering from `row.meta.indent` (`defaults.js:83`, `cellmanager.js:894-916`). */
	treeView?: boolean;

	/** Show the "{count} rows selected" toast. Default `true` (`defaults.js:84`, `rowmanager.js:137-149`). */
	checkedRowStatus?: boolean;

	/** Default `false` (`defaults.js:85`). DEAD: read nowhere outside `defaults.js`. */
	dynamicRowHeight?: boolean;

	/** Enables ctrl+V into the grid. Default `false` (`defaults.js:86`, `cellmanager.js:149`). */
	pasteFromClipboard?: boolean;

	/** Render the `<div class="dt-footer">` total row. Default `false` (`defaults.js:87`, `body-renderer.js:86-93`). */
	showTotalRow?: boolean;

	/** Default `'ltr'` (`defaults.js:88`); written to `dir` on `.datatable` (`datatable.js:115`). */
	direction?: DataTableDirection;

	/** Suppress header drag-to-reorder (`defaults.js:89`, honoured in `columnmanager.bindMoveColumn`). */
	disableReorderColumn?: boolean;

	/**
	 * Not in `defaults.js` — read straight off the raw options in
	 * `initializeTranslations` (`datatable.js:52`), defaulting to `'en'`.
	 * frappe passes `frappe.boot.lang`.
	 */
	language?: string;

	/** Merged into the translation manager (`datatable.js:55-57`). */
	translations?: DataTableTranslations;

	/**
	 * Adds a "Save Sorting" dropdown item and restores the saved order from
	 * `localStorage` on construction (`datatable.js:44-47`, `datatable.js:277-295`).
	 * Not used by frappe core.
	 */
	saveSorting?: boolean;

	/** `localStorage` namespace for saved sorting (`columnmanager.js:288`, `:413`). */
	sortingKey?: string | null;

	/**
	 * carbon_frappe only — max height of the scroll viewport, e.g.
	 * `"calc(100vh - 260px)"` (`tables/datatable/datatable.js:292`). Stock
	 * frappe-datatable sizes the body from the wrapper instead (`style.js:322`).
	 */
	scrollHeight?: string;
}

/**
 * `report_settings.get_datatable_options` — a Query Report's chance to rewrite
 * the whole options bag before construction.
 *
 * Called ONCE, on construction only (`query_report.js:1130-1133`); the
 * `datatable.refresh(data, columns)` reuse path at `query_report.js:1112` skips
 * it, which is why a report that changes `checkboxColumn` must destroy the
 * instance to see it take effect. `query_report.js:1391` also calls it with `{}`
 * purely to sniff `checkboxColumn` when placing the "Total" label.
 *
 * The hook is expected to RETURN the options (mutating and returning the same
 * object is the idiom).
 */
export type DataTableGetDatatableOptions = (options: DataTableOptions) => DataTableOptions;

/**
 * `report_settings.after_datatable_render` — run right after construction
 * (`query_report.js:1138-1140`) with the live instance. Report scripts use it
 * for `style.setStyle`, `rowmanager.checkMap = []` and per-cell `editable` flags.
 */
export type DataTableAfterRender = (datatable: DataTableInstance) => void;

// ---------------------------------------------------------------------------
// Sub-managers
// ---------------------------------------------------------------------------

/** Return of `DataManager.currentSort` (`datamanager.js:40-46`). */
export interface DataTableCurrentSort {
	colIndex: DataTableColIndex;
	sortOrder: DataTableSortOrder;
}

/** Return of `DataManager.filterRows` (`datamanager.js:452-455`). */
export interface DataTableFilterResult {
	rowsToShow: DataTableRowIndex[];
	/**
	 * stock only. carbon_frappe's `applyFilters`
	 * (`tables/datatable/datatable.js:664`) resolves with `rowsToShow` alone.
	 */
	rowsToHide?: DataTableRowIndex[];
}

/**
 * `datatable.datamanager` — the data model.
 * Source: `datamanager.js`. carbon_frappe reimplements it as `DataManagerShim`
 * (`tables/datatable/managers.js:49-168`) with `rows`/`columns`/`rowViewOrder`
 * as live getters over the host.
 */
export declare class DataManager {
	constructor(options: DataTableOptions);

	options: DataTableOptions;

	/** The array originally passed as `options.data` (`datamanager.js:25`). */
	data: DataTableData;

	/** Monotonic counter, NOT `rows.length` on stock — see `_getNextRowCount` (`datamanager.js:472-477`). */
	rowCount: number;

	columns: DataTableColumn[];

	rows: DataTableRow[];

	/**
	 * Display order as original row indices. Sorting permutes THIS, never `rows`
	 * (`datamanager.js:201-206`). Read by `report_view.js:1636` and
	 * `query_report.js:1891` to export rows in the order the user sees.
	 */
	rowViewOrder: DataTableRowIndex[];

	/** Last filter result; `undefined` until a filter runs (`datamanager.js:447`). */
	_filteredRows?: DataTableRowIndex[];

	/** `{ colIndex: -1, sortOrder: 'none' }` when nothing is sorted. */
	readonly currentSort: DataTableCurrentSort;

	/** stock only — carbon_frappe's shim has no `init` (its host prepares eagerly). */
	init?(data?: DataTableData, columns?: DataTableColumnInput[]): void;

	getRow(rowIndex: DataTableRowIndex): DataTableRow | undefined;

	/**
	 * The ORIGINAL row object from `options.data` (`datamanager.js:603-605`) —
	 * what report `format` hooks and report scripts read (`data.row_type`).
	 */
	getData(rowIndex: DataTableRowIndex): DataTableDataRow | undefined;

	/**
	 * @remarks stock indexes the row unguarded (`datamanager.js:543`
	 * `this.getRow(rowIndex)[colIndex]`) and THROWS on an out-of-range row;
	 * carbon_frappe returns `undefined` (`managers.js:85-88`).
	 */
	getCell(colIndex: DataTableColIndex, rowIndex: DataTableRowIndex): DataTableCell | undefined;

	getRows(start?: number, end?: number): DataTableRow[];

	/** stock only (`datamanager.js:483-486`); drives the body renderer. */
	getRowsForView?(start?: number, end?: number): DataTableRow[];

	getRowCount(): number;

	getColumn(colIndex: DataTableColIndex): DataTableColumn | undefined;

	getColumnById(id: string): DataTableColumn | undefined;

	getColumnIndexById(id: string): number;

	/** Matches on `content` upstream (`datamanager.js:616`), on `name` in carbon_frappe (`managers.js:105-107`). */
	getColumnIndex(name: string): number;

	hasColumn(name: string): boolean;

	hasColumnById(id: string): boolean;

	/**
	 * `0`, `1` or `2` depending on `checkboxColumn` / `serialNoColumn`
	 * (`datamanager.js:498-508`). Report View gets 2.
	 */
	getStandardColumnCount(): 0 | 1 | 2;

	getColumnCount(skipStandardColumns?: boolean): number;

	/** `report_view.get_column_widths()` calls this with `true` (`report_view.js:1501`). */
	getColumns(skipStandardColumns?: boolean): DataTableColumn[];

	/** Falls back to every row index when no filter has run (`datamanager.js:460-462`). */
	getFilteredRowIndices(): DataTableRowIndex[];

	getAllRowIndices(): DataTableRowIndex[];

	/** All descendants of a tree node (`datamanager.js:546-565`). */
	getChildren(parentRowIndex: DataTableRowIndex): DataTableRowIndex[];

	/** Direct children only (`datamanager.js:567-587`). */
	getImmediateChildren(parentRowIndex: DataTableRowIndex): DataTableRowIndex[];

	get(): { columns: DataTableColumn[]; rows: DataTableRow[] };

	updateRow(row: DataTableCellInput[], rowIndex: DataTableRowIndex): DataTableRow;

	/**
	 * Mutates the cell in place and returns it (`datamanager.js:400-422`).
	 * The single-argument form takes a cell that already carries `colIndex` and
	 * `rowIndex` and merges it over the stored one.
	 */
	updateCell(
		colIndex: DataTableColIndex,
		rowIndex: DataTableRowIndex,
		options: Partial<DataTableCell>
	): DataTableCell;
	updateCell(cell: DataTableCell): DataTableCell;

	updateColumn(colIndex: DataTableColIndex, keyValPairs: Partial<DataTableColumn>): DataTableColumn | void;

	appendRows(rows: DataTableData): void;

	filterRows(filters: DataTableAppliedFilters): Promise<DataTableFilterResult>;

	/**
	 * @remarks stock wraps this in `nextTick` (`datamanager.js:11`), so it
	 * resolves on the next macrotask; carbon_frappe delegates to
	 * `host.sortColumn` synchronously (`managers.js:159-161`).
	 */
	sortRows(colIndex: DataTableColIndex, sortOrder?: DataTableSortOrder): Promise<void> | void;

	/** `nextTick`-wrapped upstream (`datamanager.js:12`); synchronous in carbon_frappe. */
	switchColumn(index1: DataTableColIndex, index2: DataTableColIndex): Promise<void> | void;

	/** `nextTick`-wrapped upstream (`datamanager.js:13`); synchronous in carbon_frappe. */
	removeColumn(index: DataTableColIndex): Promise<void> | void;

	getCheckboxHTML?(): string;

	/**
	 * stock-internal preparation pipeline (`datamanager.js:48-226`). Declared
	 * optional because carbon_frappe's host owns this work instead
	 * (`tables/datatable/datatable.js:130-219`). Not part of the contract;
	 * listed so a prototype patch has something to attach to.
	 */
	prepareColumns?(): void;
	prepareRows?(data: DataTableData): DataTableRow[];
	prepareRow?(row: DataTableCellInput[], meta: DataTableRowMeta): DataTableRow;
	prepareCell?(content: DataTableCellInput, i: number): DataTableCell;
	validateData?(data: DataTableData): boolean;
	validateColumns?(): void;
}

/**
 * `datatable.rowmanager` — row selection, highlighting and tree state.
 * Source: `rowmanager.js`. carbon_frappe: `RowManagerShim`
 * (`tables/datatable/managers.js:172-277`).
 */
export declare class RowManager {
	constructor(instance: DataTable);

	/**
	 * Sparse map of checked rows, indexed by {@link DataTableRowIndex}
	 * (`rowmanager.js:43`, `:99`). `undefined` at every index that was never
	 * touched — real code tests it with `if (checked == 1)`
	 * (`multi_select_dialog.js:417`, `:433`).
	 *
	 * Only exists when `options.checkboxColumn` is set (`rowmanager.js:40-43`);
	 * `getCheckedRows` guards for that (`rowmanager.js:75-77`). It is a plain
	 * own property, not a getter, because callers assign to it directly
	 * (`multi_select_dialog.js:184` `rowmanager.checkMap = []`).
	 */
	checkMap: Array<0 | 1 | undefined>;

	/**
	 * Indices of the checked rows, ascending.
	 *
	 * @remarks 13 call sites across frappe / ERPNext / HRMS. Stock returns the
	 * array's STRING keys (`rowmanager.js:80-87`, a `for...in`); carbon_frappe
	 * returns numbers (`managers.js:190-195`). See {@link DataTableRowIndexKey}.
	 * Consumers only ever use them as indices — `report_view.js:1416`,
	 * `query_report.js:2408-2413`.
	 */
	getCheckedRows(): DataTableRowIndexKey[];

	/** Fires `onCheckRow` with the row (`rowmanager.js:95-109`). */
	checkRow(rowIndex: DataTableRowIndex, toggle: boolean): void;

	/**
	 * Fires `onCheckRow` with NO argument (`rowmanager.js:134`). Passing `false`
	 * empties `checkMap` outright (`rowmanager.js:124`) — this is
	 * `report_view.clear_checked_items()` (`report_view.js:1426`).
	 */
	checkAll(toggle: boolean): void;

	/** Re-applies checked highlighting after the virtual list recycles rows (`rowmanager.js:90-93`). */
	highlightCheckedRows(): void;

	highlightRow(rowIndex: DataTableRowIndex, toggle?: boolean): void;

	highlightAll(toggle?: boolean): void;

	/** `nextTick`-wrapped upstream (`rowmanager.js:24`); synchronous in carbon_frappe. */
	refreshRows(): Promise<void> | void;

	refreshRow(row: DataTableCellInput[], rowIndex: DataTableRowIndex): void;

	/** `ensureArray`d upstream (`rowmanager.js:189`), so a bare index is legal. */
	showRows(rowIndices: DataTableRowIndex | DataTableRowIndex[]): void;

	showAllRows(): void;

	openSingleNode(rowIndex: DataTableRowIndex): void;

	closeSingleNode(rowIndex: DataTableRowIndex): void;

	expandAllNodes(): void;

	collapseAllNodes(): void;

	/** `query_report.js:1136` calls this with `report_settings.initial_depth`. */
	setTreeDepth(depth: number): void;

	/**
	 * @remarks stock returns the raw `.dt-row-{n}` element or `null`
	 * (`rowmanager.js:288-290`); carbon_frappe returns a jQuery object, or a
	 * one-element array when jQuery is absent (`managers.js:34-38`, `:258-261`).
	 * No frappe/ERPNext caller uses it — it exists for prototype patches.
	 */
	getRow$(rowIndex: DataTableRowIndex): HTMLElement | null | HTMLElement[] | { [index: number]: HTMLElement };

	getTotalRows(): number;

	/** Always `0` (`rowmanager.js:296-298`). */
	getFirstRowIndex(): number;

	getLastRowIndex(): number;

	scrollToRow(rowIndex: DataTableRowIndex): void;

	/** `.dt-row-{rowIndex}` (`rowmanager.js:366-368`). */
	selector(rowIndex: DataTableRowIndex): string;

	/** stock only — HTML generation (`rowmanager.js:330-364`). */
	getRowHTML?(row: DataTableCell[], props: DataTableRowRenderProps): string;
	getFilterInput?(props: { colIndex: DataTableColIndex; name?: string }): string;
	getChildrenToShowForNode?(rowIndex: DataTableRowIndex): DataTableRowIndex[];
	getChildrenToHideForNode?(rowIndex: DataTableRowIndex): DataTableRowIndex[];
	showCheckStatus?(): void;
	/** Live map of highlighted row elements (`rowmanager.js:164-172`). */
	_highlightedRows?: Record<string, HTMLElement>;
}

/**
 * `datatable.columnmanager` — header rendering, sorting, resizing, filters.
 * Source: `columnmanager.js`. carbon_frappe: `ColumnManagerShim`
 * (`tables/datatable/managers.js:281-359`).
 */
export declare class ColumnManager {
	constructor(instance: DataTable);

	/** Whether the filter row is visible (`columnmanager.js:363`). */
	isFilterShown?: boolean;

	/**
	 * @remarks stock stores a BOOLEAN (`columnmanager.js:291-297`
	 * `setSortState`), which `cellmanager.js:369` tests for truthiness;
	 * carbon_frappe exposes the current sort OBJECT instead
	 * (`managers.js:287-289`). Truthiness is the only thing anyone relies on.
	 */
	sortState?: boolean | DataTableCurrentSort;

	/** `localStorage` key for saved sorting (`columnmanager.js:288`). */
	sortingKey?: string | null;

	/**
	 * Current inline-filter keywords by column index.
	 * `report_view.js:482` only checks `Object.keys(...).length > 0`.
	 */
	getAppliedFilters(): DataTableAppliedFilters;

	applyFilter(filters: DataTableAppliedFilters): void | Promise<DataTableFilterResult>;

	/** Omit `flag` to toggle (`columnmanager.js:346-364`). */
	toggleFilter(flag?: boolean): void;

	focusFilter(colIndex: DataTableColIndex): void;

	getColumn(colIndex: DataTableColIndex): DataTableColumn | undefined;

	getColumns(): DataTableColumn[];

	/** Omit `width` to re-apply the column's own (`columnmanager.js:436-452`). */
	setColumnWidth(colIndex: DataTableColIndex, width?: number): void;

	getColumnMinWidth(colIndex: DataTableColIndex): number;

	/** The first NON-standard column — i.e. the standard column count (`columnmanager.js:475-477`). */
	getFirstColumnIndex(): number;

	getLastColumnIndex(): number;

	/** See the `getRow$` note; the same jQuery/element divergence applies. */
	getHeaderCell$(colIndex: DataTableColIndex): HTMLElement | null | HTMLElement[] | { [index: number]: HTMLElement };

	sortColumn(colIndex: DataTableColIndex, nextSortOrder?: DataTableSortOrder): void;

	setColumnSticky(colIndex: DataTableColIndex, sticky: boolean): void;

	switchColumn(oldIndex: DataTableColIndex, newIndex: DataTableColIndex): void;

	removeColumn(colIndex: DataTableColIndex): void;

	refreshHeader(): void;

	renderHeader(): void;

	saveSorting?(colIndex: DataTableColIndex): void;

	/** stock only (`columnmanager.js:401-422`). */
	applyDefaultSortOrder?(): void;
	applySavedSortOrder?(): void;
	setSortState?(sortOrder?: DataTableSortOrder): void;
	setColumnHeaderWidth?(colIndex: DataTableColIndex): void;
	bindDropdown?(): void;
	toggleDropdownItem?(index: number): void;
	getDropdownHTML?(): string;
	getDropdownListHTML?(): string;
	/** The `.dt-row-filter` element, or `null` when `inlineFilters` is off (`columnmanager.js:37`). */
	$filterRow?: HTMLElement | null;
	$dropdownList?: HTMLElement;
}

/**
 * `datatable.cellmanager` — focus, selection, editing and copy.
 * Source: `cellmanager.js`. carbon_frappe: `CellManagerShim`
 * (`tables/datatable/managers.js:363-459`), which delegates to its own
 * {@link CellNavigation} and {@link CellEditing}.
 */
export declare class CellManager {
	constructor(instance: DataTable);

	/**
	 * The focused `.dt-cell` element, or `null`.
	 *
	 * @remarks The `$` prefix is a lie inherited from the library: this is a RAW
	 * DOM element, never a jQuery object (`cellmanager.js:248` `this.$focusedCell = $cell`,
	 * compared against a `querySelector` result in carbon_frappe's suite). In
	 * carbon_frappe it is a getter derived from `navigation.focused`
	 * (`managers.js:370-377`).
	 */
	$focusedCell: HTMLElement | null;

	/** The cell with an open editor, or `null` (`cellmanager.js:45`, `:468`). */
	$editingCell: HTMLElement | null;

	/** Far corner of the selection rectangle (`cellmanager.js:341`). */
	$selectionCursor?: HTMLElement | null;

	/** The editor returned by `getEditor`, live for the duration of the edit (`cellmanager.js:472`). */
	currentCellEditor?: DataTableEditor | null;

	/**
	 * Open the editor on a cell. Refuses if the column or the cell is
	 * `editable: false` (`cellmanager.js:441-449`).
	 */
	activateEditing($cell: HTMLElement): void | boolean;

	/**
	 * Close the editor. `submitValue` defaults to `true`
	 * (`cellmanager.js:478-488`); `report_view.js:790` passes `false` to abandon
	 * an edit before opening a dialog.
	 */
	deactivateEditing(submitValue?: boolean): void | boolean;

	/** @remarks stock resolves with the `setValue` result (`cellmanager.js:531-577`); carbon_frappe returns nothing. */
	submitEditing(): Promise<unknown> | void;

	/** @remarks the options bag is stock-only (`cellmanager.js:213-217`). */
	focusCell(
		$cell: HTMLElement | null,
		options?: { skipClearSelection?: 0 | 1; skipDOMFocus?: 0 | 1; skipScrollToCell?: 0 | 1 }
	): void | boolean;

	/** stock takes the cell to unfocus (`cellmanager.js:260`); carbon_frappe takes none. */
	unfocusCell($cell?: HTMLElement | null): void;

	getSelectionCursor(): HTMLElement | null;

	clearSelection(): void;

	/**
	 * `[colIndex, rowIndex]` pairs covering the selection, or `false` when the
	 * range is invalid or touches a standard column (`cellmanager.js:357-421`).
	 *
	 * The four-number form comes from `arguments` (`cellmanager.js:361`);
	 * carbon_frappe's shim takes no arguments and reads its own selection
	 * bounds (`managers.js:421-430`).
	 */
	getCellsInRange(
		$cell1?: HTMLElement | null,
		$cell2?: HTMLElement | null
	): Array<[DataTableColIndex, DataTableRowIndex]> | false;
	getCellsInRange(
		colIndex1: DataTableColIndex,
		rowIndex1: DataTableRowIndex,
		colIndex2: DataTableColIndex,
		rowIndex2: DataTableRowIndex
	): Array<[DataTableColIndex, DataTableRowIndex]> | false;

	/** Copies the selection (or the single focused cell) to the clipboard (`cellmanager.js:580-627`). */
	copyCellContents($cell1?: HTMLElement | null, $cell2?: HTMLElement | null): number | void;

	updateCell(
		colIndex: DataTableColIndex,
		rowIndex: DataTableRowIndex,
		value: DataTableCellValue,
		refreshHtml?: boolean
	): void;

	/** See the `getRow$` note; the same jQuery/element divergence applies. */
	getCell$(
		colIndex: DataTableColIndex,
		rowIndex: DataTableRowIndex
	): HTMLElement | null | HTMLElement[] | { [index: number]: HTMLElement };

	getCell(colIndex: DataTableColIndex, rowIndex: DataTableRowIndex): DataTableCell | undefined;

	/** `true` for the `_checkbox` / `_rowIndex` columns (`cellmanager.js:682-685`). */
	isStandardCell(colIndex: DataTableColIndex): boolean;

	/** `.dt-cell--{colIndex}-{rowIndex}` (`cellmanager.js:948-950`). */
	selector(colIndex: DataTableColIndex, rowIndex: DataTableRowIndex): string;

	getRowHeight(): number;

	scrollToCell($cell: HTMLElement | null): boolean | void;

	/** stock only (`cellmanager.js:490-529`) — carbon_frappe routes editors through {@link CellEditing}. */
	getEditor?(
		colIndex: DataTableColIndex,
		rowIndex: DataTableRowIndex,
		value: DataTableCellValue,
		parent: HTMLElement
	): DataTableEditor | false;
	getDefaultEditor?(parent: HTMLElement): DataTableEditor;
	refreshCell?(cell: DataTableCell, refreshHtml?: boolean): void;
	focusCellInDirection?(direction: "left" | "right" | "up" | "down" | "tab" | "shift+tab"): boolean;
	activateFilter?(colIndex: DataTableColIndex): void;
	toggleTreeButton?(rowIndex: DataTableRowIndex, flag: boolean): void;
	selectArea?($selectionCursor: HTMLElement): void;
	getCellHTML?(cell: DataTableCell): string;
	getCellContent?(cell: DataTableCell, refreshHtml?: boolean): string;
	getEditCellHTML?(colIndex: DataTableColIndex): string;
	getRowCountPerPage?(): number;

	/** stock only, STATIC: `cell.format || cell.column.format || null` (`cellmanager.js:970-972`). */
	static getCustomCellFormatter(cell: DataTableCell): DataTableCellFormatter | null;
}

/**
 * `datatable.bodyRenderer` — the virtualized body.
 * Source: `body-renderer.js`. carbon_frappe: `BodyRendererShim`
 * (`tables/datatable/managers.js:463-492`).
 */
export declare class BodyRenderer {
	constructor(instance: DataTable);

	/**
	 * Row indices currently in the DOM window (`body-renderer.js:17`).
	 * ERPNext tests `.includes(rowIndex)` against it.
	 */
	visibleRowIndices: DataTableRowIndex[];

	/** The row objects behind {@link visibleRowIndices} (`body-renderer.js:16`); read by `query_report.js:1868`. */
	visibleRows: DataTableRow[];

	/**
	 * Computed footer totals as a cell array (`body-renderer.js:95-135`).
	 * `query_report.js:1870` and `:1900` push it into exports.
	 */
	getTotalRow(): DataTableTotalCell[];

	render(): void;

	/** carbon_frappe's shim ignores the argument and re-renders everything (`managers.js:483-485`). */
	renderRows(rows: DataTableRow[]): void;

	/** `hideAfter` is in SECONDS (`body-renderer.js:146-149`). */
	showToastMessage(message: string, hideAfter?: number): void;

	clearToastMessage(): void;

	/** stock only — the HyperList instance (`body-renderer.js:57`), read by `style.js:339`. */
	hyperlist?: unknown;
	/** stock only (`body-renderer.js:73-93`, `:137-141`, `:157-176`). */
	getRowsToRender?(): DataTableRow[];
	renderFooter?(): void;
	restoreState?(): void;
	getNoDataHTML?(): string;
	getToastMessageHTML?(message: string): string;
}

/**
 * A CSS declaration block for `Style.setStyle`.
 *
 * Property names may be camelCase or dashed — `_getRuleString`
 * (`style.js:140-151`) dashes anything without a `-` in it. Every real caller
 * writes camelCase (`import_preview.js:181-190`, ERPNext's `asset.js`).
 * carbon_frappe additionally treats `""` / `null` as "drop this declaration"
 * (`tables/datatable/managers.js:527`), which is how report scripts reset a
 * previously painted cell.
 */
export interface DataTableStyleObject {
	[cssProperty: string]: string;
}

/**
 * `datatable.style` — the per-instance stylesheet.
 * Source: `style.js`. carbon_frappe: `StyleShim`
 * (`tables/datatable/managers.js:496-565`).
 */
export declare class Style {
	constructor(instance: DataTable);

	/**
	 * `dt-instance-{n}`, where `n` is `DataTable.instances` at construction
	 * (`style.js:18`), added to the `.datatable` element (`style.js:19`).
	 *
	 * Every rule this object writes is prefixed with it (`style.js:136-138`), so
	 * two tables on one page cannot bleed into each other — and so ERPNext's
	 * `$(\`.${datatable.style.scopeClass} .dt-scrollable\`)` resolves
	 * (`erpnext/.../bank_reconciliation_tool/data_table_manager.js:136`).
	 */
	scopeClass: string;

	readonly stylesheet: CSSStyleSheet | null;

	/**
	 * Insert (or merge into) a scoped rule.
	 *
	 * A comma-separated selector is split and applied per selector
	 * (`style.js:85-92`); re-setting an existing selector MERGES over the
	 * previous declaration block (`style.js:100-105`).
	 *
	 * 13 call sites across frappe / ERPNext / avunu, e.g.
	 * `import_preview.js:181` `setStyle('.dt-scrollable', { height: 'auto' })`.
	 */
	setStyle(selector: string, styleObject: DataTableStyleObject): void;

	removeStyle(selector: string): void;

	/** Removes the `<style>` element and the window resize listener (`style.js:79-82`). */
	destroy(): void;

	setDimensions(): void;

	/** stock takes no argument (`style.js:164`); carbon_frappe takes a px height (`managers.js:547`). */
	setCellHeight(height?: number): void;

	refreshColumnWidth(): void;

	/** `.dt-cell--col-{colIndex}` inside the header (`style.js:375-379`). */
	getColumnHeaderElement(colIndex: DataTableColIndex): HTMLElement | null;

	/** stock only (`style.js:21-23`, `:152-431`). */
	styleEl?: HTMLStyleElement;
	setBodyStyle?(): void;
	setStickyColumnStyle?(): void;
	updateStickyTopPositions?(scrollLeft: number): void;
	distributeRemainingWidth?(): void;
	setupNaturalColumnWidth?(): void;
	setupColumnWidth?(): void;
	setupMinWidth?(): void;
	getRowIndexColumnWidth?(): number;
	onWindowResize?(): void;
}

/** A `Keyboard` listener; returning `false` lets the event bubble (`keyboard.js:41-45`). */
export type DataTableKeyListener = (e: KeyboardEvent) => boolean | void;

/**
 * `datatable.keyboard` — the keydown dispatcher.
 *
 * Recognised keys come from a KEYCODE table (`keyboard.js:3-18`) and are
 * decorated with `shift+` / `ctrl+` prefixes (`keyboard.js:29-35`), giving
 * `enter`, `esc`, `tab`, `shift+tab`, `left`/`right`/`up`/`down`,
 * `ctrl+c`, `ctrl+v`, `ctrl+f`, and so on.
 *
 * carbon_frappe: `KeyboardShim` (`tables/datatable/managers.js:569-586`) — same
 * `on()` contract, but backed by a `Map` and dispatched from
 * {@link CellNavigation} rather than from a DOM listener of its own.
 */
export declare class Keyboard {
	/** stock binds `keydown` on the wrapper (`keyboard.js:21-24`); carbon_frappe takes the host. */
	constructor(element: HTMLElement | DataTable);

	listeners: Record<string, DataTableKeyListener[]> | Map<string, DataTableKeyListener[]>;

	/** `key` may be a comma-separated list (`keyboard.js:50`). */
	on(key: string, listener: DataTableKeyListener): void;

	/** stock only — the bound DOM handler (`keyboard.js:26-47`). */
	handler?(e: KeyboardEvent): void;

	/** carbon_frappe only (`managers.js:579-585`); `false` from any listener means "not handled". */
	dispatch?(key: string, event: KeyboardEvent): boolean;
}

// ---------------------------------------------------------------------------
// carbon_frappe additions
// ---------------------------------------------------------------------------

/** A focused / cursor cell address (`tables/datatable/navigation.js:65-66`). */
export interface DataTableFocusedCell {
	colIndex: DataTableColIndex;
	rowIndex: DataTableRowIndex;
}

/**
 * The selection rectangle in mixed coordinates
 * (`tables/datatable/navigation.js:148-158`): `c1`/`c2` are COLUMN indices,
 * `p1`/`p2` are POSITIONS in the current view order — not row indices — because
 * the rectangle must stay contiguous on screen after a sort.
 */
export interface DataTableSelectionBounds {
	c1: DataTableColIndex;
	c2: DataTableColIndex;
	p1: number;
	p2: number;
}

/**
 * `datatable.navigation` — carbon_frappe ONLY.
 *
 * Stock frappe-datatable spreads this behaviour across `CellManager` and
 * `Keyboard`; carbon_frappe factors it out
 * (`tables/datatable/navigation.js:62-350`) while reproducing the same keyboard
 * contract (`cellmanager.js:45-160`): arrows move focus skipping non-focusable
 * columns, ctrl+arrow jumps to an edge, shift+arrow extends, enter edits,
 * ctrl+C copies as TSV, ctrl+F focuses the column's inline filter.
 */
export declare class CellNavigation {
	constructor(host: DataTableInstance);

	/** The anchor cell, or `null` when nothing is focused. */
	focused: DataTableFocusedCell | null;

	/** The far corner of the selection; equals {@link focused} for a single cell. */
	cursor: DataTableFocusedCell | null;

	/** `true` between mousedown on a cell and the document-level mouseup (`navigation.js:242`, `:337-341`). */
	dragging?: boolean;

	/** The bound container, set by {@link bind} (`navigation.js:223`). */
	container?: HTMLElement;

	/** Display order as row indices — `datamanager.rowViewOrder` (`navigation.js:73-75`). */
	readonly viewOrder: DataTableRowIndex[];

	/** Position of a row index within {@link viewOrder}, or `-1`. */
	viewPos(rowIndex: DataTableRowIndex): number;

	/** Column indices whose column is not `focusable: false` (`navigation.js:85-91`). */
	focusableColumns(): DataTableColIndex[];

	nextFocusable(colIndex: DataTableColIndex, step: number): DataTableColIndex | null;

	/** `(colIndex, rowIndex)` — COLUMN FIRST, matching the library's own ordering. */
	focus(
		colIndex: DataTableColIndex,
		rowIndex: DataTableRowIndex,
		opts?: { extend?: boolean }
	): boolean;

	/** `toEdge` is ctrl+arrow; `extend` is shift+arrow (`navigation.js:120-145`). */
	move(
		direction: "left" | "right" | "up" | "down",
		opts?: { extend?: boolean; toEdge?: boolean }
	): boolean;

	/** `null` when there is no selection. */
	bounds(): DataTableSelectionBounds | null;

	/** Re-applies `dt-cell--focus` / `dt-cell--highlight` after every engine render. */
	render(): void;

	scrollIntoView(rowIndex: DataTableRowIndex): void;

	/**
	 * Copies the selection to the clipboard as TSV and returns the CELL COUNT
	 * (not the text) — `navigation.js:200-218`.
	 */
	copy(): number;

	/** Opens the editor on the focused cell (`navigation.js:343-349`). */
	activateFocused(): void;

	bind(container: HTMLElement): void;

	onKeyDown(e: KeyboardEvent): void;

	endDrag(): void;
}

/**
 * `datatable.editing` — carbon_frappe ONLY
 * (`tables/datatable/editing.js:25-191`).
 *
 * Implements the same `getEditor` protocol stock implements inside
 * `CellManager`; `cellmanager.$editingCell` on a CarbonDataTable is a getter
 * onto this object's field (`tables/datatable/managers.js:379-381`).
 */
export declare class CellEditing {
	constructor(host: DataTableInstance);

	/** The `.dt-cell` with an open editor, or `null`. */
	$editingCell: HTMLElement | null;

	editor: DataTableEditor | null;

	/** The `.dt-cell__edit` mount point created on demand (`editing.js:36-45`). */
	editParent: HTMLElement | null;

	/** The value the editor opened with; restored if `setValue` rejects. */
	oldValue: DataTableCellValue;

	context: {
		colIndex: DataTableColIndex;
		rowIndex: DataTableRowIndex;
		column: DataTableColumn;
		cell: DataTableCell;
	} | null;

	/** The cell carrying `dt-cell--focus` (`editing.js:145-151`). */
	focused?: HTMLElement | null;

	ensureEditParent(td: HTMLElement, colIndex: DataTableColIndex): HTMLElement;

	/** `false` when the column or the cell refuses editing (`editing.js:57-59`). */
	activate(td: HTMLElement | null): boolean;

	defaultEditor(parent: HTMLElement): DataTableEditor;

	/** `commit` defaults to `true`; `false` abandons the edit (`editing.js:107-118`). */
	deactivate(commit?: boolean): boolean;

	submit(): void;

	focus(td: HTMLElement | null): void;

	unfocus(): void;

	bind(container: HTMLElement): void;
}

/**
 * The DOM handles carbon_frappe's renderer publishes
 * (`tables/engine/render.js:44-75`). `scroll` is the element `datatable.bodyScrollable`
 * points at (`tables/datatable/datatable.js:433`).
 */
export interface DataTableEngineRenderer {
	container: HTMLElement;
	toolbar: HTMLElement;
	scroll: HTMLElement;
	table: HTMLTableElement;
	colgroup: HTMLTableColElement;
	thead: HTMLTableSectionElement;
	tbody: HTMLTableSectionElement;
	tfoot: HTMLTableSectionElement;
	footer: HTMLElement;
	getRowNode(rowId: string): HTMLElement | null;
	getCellNode(rowId: string, colId: string): HTMLElement | null;
	getHeaderNode(colId: string): HTMLElement | null;
}

/**
 * The TanStack Table v9 instance behind carbon_frappe's engine.
 *
 * Deliberately NOT modelled here: TanStack ships its own generic types, and
 * restating them would be a maintenance trap. Only the methods carbon_frappe
 * reaches for are named, with TanStack-owned values left `unknown` so a consumer
 * must narrow or import the real types.
 */
export interface DataTableEngineTable {
	getRowModel(): { rows: unknown[] };
	getVisibleLeafColumns(): Array<{ id: string }>;
	getColumn(id: string): unknown;
	getRow(id: string): unknown;
	setRowSelection(selection: Record<string, boolean>): void;
	setSorting(sorting: Array<{ id: string; desc: boolean }>): void;
	setColumnFilters(filters: Array<{ id: string; value: unknown }>): void;
	setColumnSizing(updater: (prev: Record<string, number>) => Record<string, number>): void;
	setExpanded(expanded: Record<string, boolean> | true): void;
	toggleAllRowsExpanded(expanded?: boolean): void;
	resetColumnFilters(): void;
	setOptions(updater: (prev: unknown) => unknown): void;
	store: { state: DataTableEngineState; subscribe(fn: () => void): unknown };
}

/** TanStack state slices carbon_frappe reads (`tables/engine/table.js:238-241`). */
export interface DataTableEngineState {
	sorting?: Array<{ id: string; desc: boolean }>;
	columnFilters?: Array<{ id: string; value: unknown }>;
	expanded?: Record<string, boolean> | true;
	rowSelection?: Record<string, boolean>;
	columnSizing?: Record<string, number>;
}

/**
 * `datatable.engine` — carbon_frappe ONLY. The `CarbonTable` that actually
 * renders (`tables/engine/table.js:73-641`); stock frappe-datatable has no
 * equivalent, which is why `!!dt.engine` is carbon_frappe's own "am I installed"
 * probe.
 *
 * Declared as the surface reached through a `DataTable`. carbon_frappe's own
 * `CarbonTable` class type is authoritative inside that app.
 */
export interface DataTableEngine {
	renderer: DataTableEngineRenderer;
	table: DataTableEngineTable;
	readonly state: DataTableEngineState;
	options: Record<string, unknown> & { rowHeight?: number; showTotalRow?: boolean };
	/** `cf-table-instance-{n}` (`table.js:82`). */
	scopeClass: string;
	container: HTMLElement;
	readonly wrapper: HTMLElement;
	/** The Carbon size band the requested `rowHeight` snaps to (`table.js:243-246`). */
	readonly rowSize: "xs" | "sm" | "md" | "lg" | "xl";
	readonly rowHeightPx: number;

	render(): void;
	/** Coalesced render, with a `.cancel()` (`table.js:93`, `:342`). */
	scheduleRender(): void;
	setData(data: unknown[]): this;
	setColumns(columns: unknown[]): this;
	setColumnSize(columnId: string, px: number): this;
	getColumnSize(columnId: string): number | null;
	toggleFilters(show?: boolean): boolean;
	getRenderRows(): { rows: unknown[]; paddingTop: number; paddingBottom: number };
	getRowNode(rowId: string): HTMLElement | null;
	getCellNode(rowId: string, colId: string): HTMLElement | null;
	getHeaderNode(colId: string): HTMLElement | null;
	scrollToRowIndex(index: number, opts?: { align?: "start" | "center" | "end" | "auto" }): void;
	on(name: string, handler: (...args: unknown[]) => void): void;
	off(name: string, handler: (...args: unknown[]) => void): void;
	destroy(): void;
}

// ---------------------------------------------------------------------------
// The DataTable itself
// ---------------------------------------------------------------------------

/**
 * `window.DataTable` / `frappe.DataTable`.
 *
 * Source: `datatable.js:22-296`. Everything below is verified against that file;
 * members carbon_frappe does not reproduce are marked `?` and say so.
 *
 * @example
 * ```ts
 * // report_view.js:340
 * const dt = new DataTable(wrapper, {
 *   columns, data,
 *   getEditor: this.get_editing_object.bind(this),
 *   checkboxColumn: true,
 *   inlineFilters: true,
 *   cellHeight: 35,
 * });
 * ```
 */
export declare class DataTable {
	/**
	 * @param wrapper an element, or a CSS selector resolved with
	 * `document.querySelector` (`datatable.js:26-29`). Anything that is not an
	 * `HTMLElement` after that throws
	 * `Error('Invalid argument given for \`wrapper\`')` (`datatable.js:31-33`).
	 */
	constructor(wrapper: HTMLElement | string, options?: DataTableOptions);

	/** Incremented on EVERY construction (`datatable.js:24`); seeds `style.scopeClass`. */
	static instances: number;

	/** Set from `package.json` by the bundle entrypoint (`index.js:3`); `"carbon_frappe"` under carbon_frappe. */
	static __version__?: string;

	// -- resolved options -----------------------------------------------------

	/** Defaults merged with the caller's (`datatable.js:64-70`). Mutated in place by `updateOptions`. */
	options: DataTableOptions;

	/** Event handlers, merged separately from `options` (`datatable.js:79-83`). */
	events: Partial<DataTableEvents>;

	// -- DOM handles ----------------------------------------------------------

	/** The element handed to the constructor (`datatable.js:30`). */
	wrapper: HTMLElement;

	/** `.datatable` — carries `style.scopeClass` (`datatable.js:130`, `style.js:19`). */
	datatableWrapper: HTMLElement;

	/** `.dt-header` (`datatable.js:131`). */
	header: HTMLElement;

	/** `.dt-footer` — the total row lives here (`datatable.js:132`). */
	footer: HTMLElement;

	/** `.dt-scrollable` — the scrolling body (`datatable.js:133`). ERPNext sizes this directly. */
	bodyScrollable: HTMLElement;

	/** `.dt-freeze` overlay (`datatable.js:134`). */
	freezeContainer: HTMLElement;

	/** `.dt-toast` (`datatable.js:135`). */
	toastMessage: HTMLElement;

	/** `.dt-paste-target` textarea (`datatable.js:136`). */
	pasteTarget: HTMLTextAreaElement;

	/**
	 * `.dt-dropdown-container` (`datatable.js:137`).
	 * stock only — carbon_frappe renders column menus through Carbon instead.
	 */
	dropdownContainer?: HTMLElement;

	/** `true` while the body shows the no-data placeholder (`body-renderer.js:18-21`). */
	noData?: boolean;

	// -- sub-managers ---------------------------------------------------------

	style: Style;
	keyboard: Keyboard;
	datamanager: DataManager;
	rowmanager: RowManager;
	columnmanager: ColumnManager;
	cellmanager: CellManager;
	bodyRenderer: BodyRenderer;

	// -- public API -----------------------------------------------------------

	/**
	 * Re-initialise the data model and re-render (`datatable.js:140-144`).
	 * Both arguments are optional; omitting `data` reuses `options.data`
	 * (`datamanager.js:18-20`). `query_report.js:1112` uses this as the fast
	 * path when only the rows changed.
	 */
	refresh(data?: DataTableData, columns?: DataTableColumnInput[]): void;

	/** Empties the wrapper, drops the stylesheet and fires `onDestroy` (`datatable.js:146-150`). */
	destroy(): void;

	appendRows(rows: DataTableData): void;

	/** Replaces one row and re-renders just its cells (`datatable.js:157-159`, `report_view.js:333`). */
	refreshRow(row: DataTableCellInput[], rowIndex: DataTableRowIndex): void;

	render(): void;

	renderHeader(): void;

	renderBody(): void;

	setDimensions(): void;

	/** `hideAfter` in SECONDS (`body-renderer.js:146`). */
	showToastMessage(message: string, hideAfter?: number): void;

	clearToastMessage(): void;

	getColumn(colIndex: DataTableColIndex): DataTableColumn | undefined;

	/** stock takes no argument (`datatable.js:190`); carbon_frappe forwards a `skipStandardColumns` flag. */
	getColumns(skipStandardColumns?: boolean): DataTableColumn[];

	getRows(): DataTableRow[];

	getCell(colIndex: DataTableColIndex, rowIndex: DataTableRowIndex): DataTableCell | undefined;

	getColumnHeaderElement(colIndex: DataTableColIndex): HTMLElement | null;

	/** Memoised on stock (`datatable.js:206-212`). */
	getViewportHeight(): number;

	sortColumn(colIndex: DataTableColIndex, sortOrder?: DataTableSortOrder): void;

	saveSorting(colIndex: DataTableColIndex, nextSortOrder?: DataTableSortOrder): void;

	removeColumn(colIndex: DataTableColIndex): void;

	setColumnSticky(colIndex: DataTableColIndex, sticky: boolean): void;

	scrollToLastColumn(): void;

	/** Shows the `.dt-freeze` overlay (`datatable.js:233-237`). */
	freeze(): void;

	unfreeze(): void;

	/** Re-runs the option merge (`datatable.js:245-247`). */
	updateOptions(options: DataTableOptions): void;

	/**
	 * Invokes internal handlers then the user handler, each with `this` bound to
	 * the instance (`datatable.js:249-260`).
	 */
	fireEvent(eventName: keyof DataTableEvents | string, ...args: unknown[]): void;

	/** Registers an ADDITIONAL handler; does not replace `options.events` (`datatable.js:262-266`). */
	on(event: keyof DataTableEvents | string, handler: (this: DataTable, ...args: never[]) => void): void;

	/** No-op unless `options.logs` (`datatable.js:268-272`). */
	log(...args: unknown[]): void;

	/** `args.count` selects a plural form (`translationmanager.js:15-26`). */
	translate(str: string, args?: { count?: number } & Record<string, unknown>): string;

	// -- lifecycle internals --------------------------------------------------

	/**
	 * @remarks stock takes NO arguments (`datatable.js:87-90`); carbon_frappe's
	 * takes `(columns, data)` (`tables/datatable/datatable.js:214-219`). Declared
	 * with optional parameters so both satisfy it. Not part of the contract.
	 */
	prepare(columns?: DataTableColumnInput[], data?: DataTableData): void;

	/** Writes the `.datatable` skeleton and caches the DOM handles (`datatable.js:113-138`). */
	prepareDom(): void;

	/** stock only (`datatable.js:51-58`, `:60-62`, `:64-85`, `:92-111`). */
	initializeTranslations?(options: DataTableOptions): void;
	setDefaultOptions?(): void;
	buildOptions?(options: DataTableOptions): void;
	initializeComponents?(): void;
	setupSaveSorting?(): void;

	/** stock only — resolved defaults, kept for the re-merge in `buildOptions` (`datatable.js:61`). */
	DEFAULT_OPTIONS?: DataTableOptions;
	/** stock only (`datatable.js:52-53`). */
	language?: string;
	translationManager?: unknown;
	/** stock only — memoised viewport height (`datatable.js:207`). */
	viewportHeight?: number;
	/** stock only — handlers registered via `on()` (`datatable.js:263`). */
	_internalEventHandlers?: Record<string, Array<(...args: never[]) => void>>;
}

/**
 * What you actually hold when you construct through the global.
 *
 * `DataTable` above is the stock class; this adds the members carbon_frappe's
 * drop-in replacement publishes. They are optional because on a stock bench they
 * are genuinely absent — `!!dt.engine` is the documented way to tell the two
 * apart (`carbon_frappe/scripts/tables/report.mjs:25`).
 */
export interface DataTableInstance extends DataTable {
	/**
	 * carbon_frappe only — the rendering engine
	 * (`tables/datatable/datatable.js:277`).
	 */
	engine?: DataTableEngine;

	/** carbon_frappe only (`tables/datatable/datatable.js:105`). */
	navigation?: CellNavigation;

	/** carbon_frappe only (`tables/datatable/datatable.js:104`). */
	editing?: CellEditing;

	/**
	 * carbon_frappe only — how many auto-injected `_checkbox` / `_rowIndex`
	 * columns precede the real ones (`tables/datatable/datatable.js:159`).
	 * On stock, ask `datamanager.getStandardColumnCount()` instead.
	 */
	standardColumnCount?: number;

	/**
	 * carbon_frappe only — the prepared columns, hoisted onto the host
	 * (`tables/datatable/datatable.js:171`). On stock these live only on
	 * `datamanager.columns`.
	 */
	columns?: DataTableColumn[];

	/** carbon_frappe only — the prepared rows (`tables/datatable/datatable.js:217`). */
	rows?: DataTableRow[];

	/** carbon_frappe only — the original data array (`tables/datatable/datatable.js:216`). */
	data?: DataTableData;

	/** carbon_frappe only — mirrors `style.scopeClass` on the host (`tables/datatable/datatable.js:87`). */
	scopeClass?: string;

	/** carbon_frappe only — the wrapper again, under the engine's name (`tables/datatable/datatable.js:90`). */
	container?: HTMLElement;
}

/**
 * The constructor VALUE — what `window.DataTable` and `frappe.DataTable` hold.
 *
 * Declared as an interface rather than `typeof DataTable` because both globals
 * are REASSIGNED at runtime (`report_view.js:6`, `query_report.js:6`,
 * `ui/datatable.js:3`, and carbon_frappe's `install.js:27-28`), so the binding
 * must be mutable and must accept any structurally compatible class — which is
 * exactly what `window.DataTable = CarbonDataTable` needs.
 *
 * It is also the right operand of `instanceof`
 * (`carbon_frappe/scripts/tables/query-report.mjs:23`), which the construct
 * signature plus `prototype` supports.
 */
export interface DataTableConstructor {
	new (wrapper: HTMLElement | string, options?: DataTableOptions): DataTableInstance;

	/** `DataTable.instances = 0` at module scope (`datatable.js:298`). */
	instances: number;

	/** `DataTable.__version__ = packageJson.version` (`index.js:3`). */
	__version__?: string;

	readonly prototype: DataTableInstance;
}

/**
 * `window.DataTable`.
 *
 * Assigned at MODULE SCOPE by two separate report bundles —
 * `report_view.js:6` and `query_report.js:6` — both `window.DataTable = DataTable`.
 * `query_report.js:1134` then constructs from the global, which is why
 * reassigning it is enough to reach every Query Report, but NOT enough to reach
 * `report_view.js:340`, which uses its own module-local binding (carbon_frappe
 * patches `ReportView.prototype.setup_datatable` for that —
 * `tables/datatable/install.js:36-65`).
 *
 * Merge this into the global `Window` when assembling.
 */
export interface DataTableGlobals {
	DataTable: DataTableConstructor;
}

/**
 * The `DataTable` member of the `frappe` namespace.
 *
 * `frappe/public/js/frappe/ui/datatable.js` is the WHOLE module:
 * `import DataTable from "frappe-datatable"; frappe.DataTable = DataTable;` —
 * the single assignment, and therefore the single choke point an app can patch.
 * Consumed by `multi_select_dialog.js:217`, ERPNext (`asset.js`,
 * ledger preview, bank reconciliation) and HRMS.
 *
 * Merge this into the `frappe` namespace when assembling; it must stay WRITABLE.
 */
export interface FrappeDataTableNamespace {
	DataTable: DataTableConstructor;
}

// ---------------------------------------------------------------------------
// The `dt-*` DOM contract
// ---------------------------------------------------------------------------

/**
 * Fixed `dt-*` class names emitted by the table.
 *
 * These are not decoration: frappe core, ERPNext, HRMS and app report scripts
 * reach for them by hand in CSS, in jQuery and through `style.setStyle`, so a
 * replacement renderer must keep emitting every one. carbon_frappe enumerates
 * them rather than generating them, for exactly that reason
 * (`tables/datatable/classes.js:46-129`).
 *
 * Emitted by: `datatable.js:113-128` (skeleton), `rowmanager.js:352-363` (rows
 * and filter inputs), `cellmanager.js:835-853` (cells),
 * `cellmanager.js:918-921` (cell content), `body-renderer.js:157-176` (empty
 * state and toast), `columnmanager.js:487-511` (dropdown).
 *
 * Consumed by: `frappe/public/scss/desk/frappe_datatable.scss`,
 * `desk/report.scss`, `desk/data_import.scss`, `report_view.js:326`/`:448`/`:460`,
 * `import_preview.js:184`, ERPNext `bank_reconciliation_tool/data_table_manager.js:136`.
 */
export type DataTableStaticClass =
	// containers (datatable.js:113-128)
	| "datatable"
	| "dt-header"
	| "dt-scrollable"
	| "dt-scrollable--highlight-all"
	| "dt-scrollable__no-data"
	| "no-data-message"
	| "dt-footer"
	| "dt-freeze"
	| "dt-freeze__message"
	| "dt-toast"
	| "dt-toast__message"
	| "dt-dropdown-container"
	| "dt-paste-target"
	// rows (rowmanager.js:352-356)
	| "dt-row"
	| "dt-row-header"
	| "dt-row-filter"
	| "dt-row-totalRow"
	| "dt-row--highlight"
	| "dt-row--unhighlight"
	| "dt-row--hide"
	// cells (cellmanager.js:835-848)
	| "dt-cell"
	| "dt-cell--header"
	| "dt-cell--filter"
	| "dt-cell--focus"
	| "dt-cell--highlight"
	| "dt-cell--editing"
	| "dt-cell--dragging"
	| "dt-cell--sticky"
	| "dt-cell--sticky-top"
	| "dt-cell--sticky-last"
	| "dt-cell--tree-close"
	| "dt-cell__content"
	| "dt-cell__edit"
	| "dt-cell__resize-handle"
	// filters and inputs (rowmanager.js:362)
	| "dt-filter"
	| "dt-input"
	// header dropdown (columnmanager.js:487-511)
	| "dt-dropdown"
	| "dt-dropdown__toggle"
	| "dt-dropdown__list"
	| "dt-dropdown__list-item"
	| "dt-hidden"
	// tree view (cellmanager.js:900-913)
	| "dt-tree-node"
	| "dt-tree-node__toggle"
	// column resize (columnmanager.bindResizeColumn)
	| "dt-resize";

/**
 * Per-instance scope class, `dt-instance-{n}` (`style.js:18`), added to the
 * `.datatable` element. Every rule `style.setStyle` writes is prefixed with it
 * (`style.js:136-138`).
 */
export type DataTableInstanceClass = `dt-instance-${number}`;

/** Whole-row target, `.dt-row-{rowIndex}` (`rowmanager.js:353`, `:367`). */
export type DataTableRowClass = `dt-row-${number}`;

/** Whole-column target, `.dt-cell--col-{colIndex}` (`cellmanager.js:837`). ERPNext `asset.js` uses this. */
export type DataTableColumnClass = `dt-cell--col-${number}`;

/** Per-cell target, `.dt-cell--{colIndex}-{rowIndex}` (`cellmanager.js:838`, `:949`). */
export type DataTableCellClass = `dt-cell--${number}-${number}`;

/** Whole-row cell target, `.dt-cell--row-{rowIndex}` (`cellmanager.js:839`). */
export type DataTableCellRowClass = `dt-cell--row-${number}`;

/** Per-column header target, `.dt-cell--header-{colIndex}` (`cellmanager.js:841`). */
export type DataTableHeaderCellClass = `dt-cell--header-${number}`;

/** Per-column content wrappers (`cellmanager.js:918-921`). */
export type DataTableCellContentClass =
	| `dt-cell__content--col-${number}`
	| `dt-cell__content--header-${number}`;

/** Per-column edit mount point (`cellmanager.js:945`). */
export type DataTableEditCellClass = `dt-cell__edit--col-${number}`;

/** Every `dt-*` class the renderer may emit. */
export type DataTableDomClass =
	| DataTableStaticClass
	| DataTableInstanceClass
	| DataTableRowClass
	| DataTableColumnClass
	| DataTableCellClass
	| DataTableCellRowClass
	| DataTableHeaderCellClass
	| DataTableCellContentClass
	| DataTableEditCellClass;

/**
 * `data-*` attributes written onto rows, cells and filter inputs.
 *
 * Produced by `makeDataAttributeString` (`utils.js:9-22`), which camelCase→dash
 * converts the key and interpolates the value into the attribute — so EVERY
 * value is a string, and `undefined` omits the attribute entirely. Read back via
 * `$.data(el)` (`dom.js:97-99`), which is just `element.dataset`, hence the
 * `Number(...)` round-trip at every consumer
 * (`carbon_frappe/tables/datatable/editing.js:52-53`,
 * `navigation.js:233-234`, `managers.js:406-407`).
 *
 * The boolean-ish attributes are only ever written as `"1"`, and only when true
 * (`cellmanager.js:817-823` passes them straight through, `undefined` when false).
 */
export interface DataTableDataset extends DOMStringMap {
	/** `data-row-index`. Absent on the header and filter rows. */
	rowIndex?: string;
	/** `data-col-index`. */
	colIndex?: string;
	/** `data-is-header="1"`. */
	isHeader?: "1";
	/** `data-is-filter="1"`. */
	isFilter?: "1";
	/** `data-is-total-row="1"`. */
	isTotalRow?: "1";
	/** `data-index` on a dropdown list item (`columnmanager.js:502`). */
	index?: string;
}

/**
 * The Carbon-side markup carbon_frappe's engine emits ALONGSIDE the `dt-*`
 * contract (`tables/engine/classes.js:19-60`, `tables/engine/render.js`).
 *
 * Dual emission is the whole compatibility strategy: a report written against
 * frappe-datatable keeps matching `.dt-*`, while Carbon's own stylesheet matches
 * `.cds--*` on the same nodes. Neither vocabulary is optional.
 *
 * @remarks `cds--data-table--sticky-header` is deliberately NOT emitted —
 * Carbon's own sticky-header implementation discards `<colgroup>`, so sticky is
 * done with `position: sticky` on the `<th>`s instead
 * (`tables/engine/classes.js:37-38`).
 */
export type CarbonDataTableDomClass =
	| "cds--data-table"
	| "cds--data-table-container"
	| "cds--data-table-content"
	| `cds--data-table--${"xs" | "sm" | "md" | "lg" | "xl"}`
	| "cds--data-table--sort"
	| "cds--data-table--selected"
	| "cds--table-sort"
	| "cds--table-sort--active"
	| "cds--table-sort--descending"
	| "cds--table-sort__flex"
	| "cds--table-sort__icon"
	| "cds--table-sort__icon-unsorted"
	| "cds--table-sort__header"
	| "cds--table-header-label"
	| "cds--table-toolbar"
	| "cds--toolbar-content"
	| "cds--toolbar-action"
	| "cds--action-list"
	| "cds--batch-actions"
	| "cds--batch-actions--active"
	| "cds--batch-summary"
	| "cds--batch-summary__para"
	| "cds--parent-row"
	| "cds--child-row"
	| "cds--child-row-inner-container"
	| "cds--expandable-row"
	| "cds--expandable-row--hover"
	| "cds--table-expand"
	| "cds--table-expand__button"
	| "cds--table-expand__svg"
	| "cds--table-column-menu"
	| "cds--overflow-menu--data-table"
	| "cds--toolbar-search-container-expandable"
	| "cds--toolbar-search-container-active"
	| "cds--pagination"
	| "cds--skeleton";

/**
 * carbon_frappe's own engine markup (`tables/engine/render.js`,
 * `tables/engine/classes.js`). Structural, not compatibility: these are the
 * hooks carbon_frappe's SCSS and its own browser suites target.
 */
export type CarbonEngineDomClass =
	| "cf-table"
	| "cf-table--selecting"
	| "cf-table__table"
	| "cf-table__scroll"
	| "cf-table__scroll--empty"
	| "cf-table__head"
	| "cf-table__head--sticky"
	| "cf-table__body"
	| "cf-table__foot"
	| "cf-table__header-row"
	| "cf-table__filter-row"
	| "cf-table__filter-input"
	| "cf-table__row"
	| "cf-table__row--expanded"
	| "cf-table__total-row"
	| "cf-table__child-cell"
	| "cf-table__cell"
	| "cf-table__cell-content"
	| "cf-table__cell--header"
	| "cf-table__cell--filter"
	| "cf-table__cell--total"
	| "cf-table__cell--grid"
	| "cf-table__cell--center"
	| "cf-table__cell--right"
	| "cf-table__cell--pinned"
	| "cf-table__cell--pinned-start"
	| "cf-table__cell--pinned-end"
	| "cf-table__cell--pinned-first"
	| "cf-table__cell--pinned-last"
	| "cf-table__resize-handle"
	| "cf-table__sort-icon"
	| "cf-table__spacer"
	| "cf-table__empty"
	| "cf-table__meta"
	| "cf-table__toolbar"
	| "cf-table__footer"
	| `cf-table-instance-${number}`;

/**
 * `data-*` attributes carbon_frappe's engine writes (`tables/engine/render.js:231`,
 * `:294`, `:410`, `:450`, `:518`). Read back as `th.dataset.colId` /
 * `tr.dataset.rowId` — the keyed-render identity test.
 *
 * `dataset` already types every key as `string | undefined`; this interface
 * exists to NAME the two keys that are contractual.
 */
export interface CarbonEngineDataset extends DOMStringMap {
	/** `data-col-id` — the engine column id, `c{colIndex}:{column.id}` (`tables/datatable/datatable.js:268`). */
	colId?: string;
	/** `data-row-id` — `String(row.meta.rowIndex)` (`tables/datatable/datatable.js:272`). */
	rowId?: string;
}

/*
 * RESTORED - `DocumentThemeDataset` was present in the verified fragment
 * `frappe-datatable.d.ts` and lost during assembly (see the completeness
 * report, section 1d). Copied back verbatim from that fragment; nothing edited.
 */
/**
 * `document.documentElement.dataset.theme` — the desk's light/dark switch, and
 * the only `dataset` key outside the table itself that the table's styling
 * depends on.
 *
 * Written as `data-theme="dark"` on `<html>`; carbon_frappe's suites set it both
 * ways (`scripts/tables/engine.mjs:212` via `dataset.theme`,
 * `scripts/tables/dark.mjs:10` via `setAttribute("data-theme", "dark")`) and
 * then assert the table's computed colours flipped.
 *
 * `DOMStringMap`'s index signature already types this `string | undefined`, so
 * no augmentation is strictly required — this interface exists to NAME the key
 * and record where it is read.
 */
export interface DocumentThemeDataset extends DOMStringMap {
	/** `"dark"` when the desk is in dark mode; absent or `"light"` otherwise. */
	theme?: string;
}

/**
 * Ad-hoc expando written onto a live `<td>` to prove the keyed renderer REUSES
 * row and cell nodes across a re-render
 * (`carbon_frappe/scripts/tables/engine.mjs:173-177`).
 *
 * Declared so the identity check does not need an escape hatch. Merge into the
 * global `HTMLElement` when assembling; it is a test affordance, not API.
 */
export interface HTMLElementNodeIdentityExpando {
	__probe?: string;
}

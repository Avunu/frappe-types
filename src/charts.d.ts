/**
 * `frappe.Chart` — the frappe-charts slice of the frappe desk API.
 *
 * Frappe v16.33.0 re-exports the `frappe-charts` package verbatim:
 *
 * ```js
 * // frappe/public/js/frappe/ui/chart.js:1-4
 * import { Chart } from "frappe-charts/dist/frappe-charts.esm";
 * frappe.provide("frappe.ui");
 * frappe.Chart = Chart;
 * ```
 *
 * Everything below is verified against `frappe-charts@2.0.0-rc27` as vendored at
 * `apps/frappe/node_modules/frappe-charts`. Citations of the form
 * `BaseChart.js:34` refer to `frappe-charts/src/js/charts/…`; the shipped
 * `dist/frappe-charts.esm.js` (what frappe actually imports) was byte-compared
 * against every `src/js/**` file via its source map, so `src` IS the shipped
 * code — only Babel's ES5 lowering differs.
 *
 * @packageDocumentation
 */

/* -------------------------------------------------------------------------- */
/* Chart types and colors                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The chart type a constructed chart reports on `.type`.
 *
 * `chart.js:9-15` dispatches `options.type` through a fixed map
 * (`bar`/`line` → AxisChart, `percentage`, `heatmap`, `pie`, `donut`), and each
 * concrete constructor then pins `this.type` to its own value
 * (`Heatmap.js:21`, `PercentageChart.js:9`, `PieChart.js:26`,
 * `DonutChart.js:14`, `AxisChart.js:21` `args.type || 'line'`).
 *
 * Consequences worth knowing:
 * - `"axis-mixed"` NEVER survives to `.type` — `chart.js:19-22` rewrites
 *   `options.type = "line"` before constructing an AxisChart.
 * - `BaseChart.js:29` transiently sets `this.type = options.type || ''`, so an
 *   empty string is observable only from inside the base constructor (i.e. from
 *   a `configure()`/`setMeasures()` override), never from a returned instance.
 * - Constructing `AxisChart`/`Heatmap`/… directly (they are also named exports
 *   of frappe-charts, though frappe only re-exports `Chart`) can produce other
 *   values, because only `getChartByType` enforces the map.
 */
export type FrappeChartType = "line" | "bar" | "percentage" | "heatmap" | "pie" | "donut";

/**
 * What may be passed as `options.type`.
 *
 * `chart.js:17` defaults an omitted type to `"line"`; `chart.js:19` accepts the
 * extra alias `"axis-mixed"` (rewritten to `"line"`); `chart.js:24-27` logs
 * `console.error("Undefined chart type: " + chartType)` for anything else — see
 * {@link FrappeChartConstructor} for what `new` then returns.
 */
export type FrappeChartRequestedType = FrappeChartType | "axis-mixed";

/**
 * frappe-charts' named colors — `utils/colors.js:1-22` `PRESET_COLOR_MAP`.
 * `getColor()` (`utils/colors.js:51-59`) resolves these to hex; anything not in
 * the map is passed through unchanged.
 */
export type FrappeChartPresetColor =
	| "pink"
	| "blue"
	| "green"
	| "grey"
	| "red"
	| "yellow"
	| "purple"
	| "teal"
	| "cyan"
	| "orange"
	| "light-pink"
	| "light-blue"
	| "light-green"
	| "light-grey"
	| "light-red"
	| "light-yellow"
	| "light-purple"
	| "light-teal"
	| "light-cyan"
	| "light-orange";

/**
 * A color accepted by frappe-charts.
 *
 * `utils/colors.js:44-49` `isValidColor()` accepts only `#rgb` / `#rrggbb` and
 * `rgb()/rgba()/hsl()/hsla()` function syntax; `getColor()` additionally
 * resolves a {@link FrappeChartPresetColor} name and converts `rgb()` to hex.
 * Anything else is dropped with `console.warn('"x" is not a valid color.')`
 * (`BaseChart.js:78`).
 *
 * Deliberately widened to `string`: the accepted set is a runtime regex, and
 * `frappe.utils.make_chart` (`frappe/public/js/frappe/utils/utils.js:1499-1502`)
 * passes the preset name `"light-blue"` while `report_view.js:654` passes a mix
 * of a raw hex and three preset names in one array.
 */
export type FrappeChartColor = FrappeChartPresetColor | (string & {});

/* -------------------------------------------------------------------------- */
/* Data shapes                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * One series of an axis chart. `utils/axis-chart-utils.js:22-46` `dataPrep()`
 * normalises every dataset in place: missing `values` become a zero array, and
 * `values` are coerced (`!isNaN(val) ? val : 0`), then trimmed or zero-padded to
 * `data.labels.length`. `chartType` defaults to the chart's own type.
 */
export interface FrappeAxisDataset {
	/** Legend/tooltip label. Rendered as HTML with `<`, `>` and `&` escaped (AxisChart.js:120). */
	name?: string;
	/** One value per label. Re-sized to match `labels.length` by `dataPrep()`. */
	values: number[];
	/**
	 * Per-dataset override enabling mixed bar/line charts.
	 * `utils/constants.js:66` `AXIS_DATASET_CHART_TYPES = ['line', 'bar']`.
	 */
	chartType?: "line" | "bar";
	/** Written by `AxisChart.getAllYValues()` (AxisChart.js:174-181) when `barOptions.stacked` is set. */
	cumulativeYs?: number[];
}

/** A horizontal marker line. `AxisChart.js:151-159`, `utils/axis-chart-utils.js:78-85`. */
export interface FrappeChartYMarker {
	value: number;
	label?: string;
	/** Free-form; defaulted to `{}` by `AxisChart.calcYRegions()` (AxisChart.js:155). */
	options?: Record<string, unknown>;
}

/**
 * A shaded band between two y values. `utils/axis-chart-utils.js:52-58` swaps
 * `start`/`end` in place when they arrive reversed.
 */
export interface FrappeChartYRegion {
	start: number;
	end: number;
	label?: string;
	/** Free-form; defaulted to `{}` by `AxisChart.calcYRegions()` (AxisChart.js:165). */
	options?: Record<string, unknown>;
}

/** `options.data` for `bar` / `line` / `axis-mixed` charts, and for the aggregation charts (`pie`, `donut`, `percentage`) which read the same `labels` + `datasets` pair (AggregationChart.js:24-30). */
export interface FrappeAxisChartData {
	/** `dataPrep()` defaults this to `[]` (utils/axis-chart-utils.js:8) and it drives every series' length. */
	labels: Array<string | number>;
	/** Defaulted to a single all-zero dataset when omitted (utils/axis-chart-utils.js:15-20). */
	datasets?: FrappeAxisDataset[];
	yMarkers?: FrappeChartYMarker[];
	yRegions?: FrappeChartYRegion[];
}

/**
 * `options.data` for `type: "heatmap"` — `Heatmap.prepareData()` (Heatmap.js:56-78).
 *
 * All three keys are optional: `start` defaults to one year ago, `end` to now,
 * and `dataPoints` to `{}`. Keys of `dataPoints` are `yyyy-mm-dd` strings, but
 * if the FIRST key parses to a number > 100000 the whole map is re-keyed from
 * unix seconds to `yyyy-mm-dd` (Heatmap.js:68-75).
 */
export interface FrappeHeatmapData {
	start?: Date;
	end?: Date;
	/** `{ "2025-01-31": 4, … }`, or `{ "1738281600": 4, … }` unix seconds. */
	dataPoints?: Record<string, number>;
}

/** Either family of chart data; `BaseChart.prepareData()` is the identity (BaseChart.js:64-66) and each subclass narrows it. */
export type FrappeChartData = FrappeAxisChartData | FrappeHeatmapData;

/* -------------------------------------------------------------------------- */
/* Constructor options                                                         */
/* -------------------------------------------------------------------------- */

/** `options.axisOptions` — read once in `AxisChart.configure()` (AxisChart.js:37-47). Ignored by every non-axis chart. */
export interface FrappeChartAxisOptions {
	/** Default `'span'` (AxisChart.js:40). frappe passes `"tick"` in `make_chart` (utils.js:1506). */
	xAxisMode?: "span" | "tick";
	/** Default `'span'` (AxisChart.js:41). */
	yAxisMode?: "span" | "tick";
	/** Truthy = treat x labels as a continuous series when shortening them (AxisChart.js:42, utils/axis-chart-utils.js:100-110). frappe passes the `0 | 1` Dashboard Chart `timeseries` field (chart_widget.js:648). */
	xIsSeries?: number | boolean;
	/** Truthy = abbreviate y-axis labels; REQUIRED for `numberFormatter` to run (utils/draw.js:327-333). */
	shortenYAxisNumbers?: number | boolean;
	/**
	 * Overrides the built-in `shortenLargeNumber` for y-axis labels.
	 * Only consulted when `shortenYAxisNumbers` is truthy (utils/draw.js:327-332).
	 * frappe passes `frappe.utils.format_chart_axis_number` (utils.js:1508).
	 */
	numberFormatter?: (value: number) => string | number;
	/** Fraction of the per-label slot a series label may occupy; default `SERIES_LABEL_SPACE_RATIO = 0.6` (utils/constants.js:69). frappe raises it to `0.9` past 10 labels (utils.js:1526-1528). */
	seriesLabelSpaceRatio?: number;
	/** Clamps the computed y interval range; `utils/intervals.js:85-91` only ever WIDENS the data-derived extremes. Defaults to `{}`. */
	yAxisRange?: { min?: number; max?: number };
}

/** `options.tooltipOptions` — `AxisChart.configure()` (AxisChart.js:49-50) and `AggregationChart.configure()` (AggregationChart.js:13). */
export interface FrappeChartTooltipOptions {
	/** Formats the tooltip title from the x label (AxisChart.js:391). */
	formatTooltipX?: (label: string | number) => string | number;
	/**
	 * Formats each tooltip value.
	 * AxisChart calls it with a second argument (AxisChart.js:381-385); the
	 * aggregation charts call it with one (AggregationChart.js:68), so the
	 * second parameter must stay optional.
	 */
	formatTooltipY?: (
		value: number,
		dataset?: { name?: string; index?: number; values?: number[] }
	) => string | number;
}

/** `options.barOptions` — read by `AxisChart` (AxisChart.js:18, 135, 249-260) and, for its `height` only, by `PercentageChart.setMeasures()` (PercentageChart.js:15-18). */
export interface FrappeChartBarOptions {
	/** Stack the bar datasets and derive `cumulativeYs` (AxisChart.js:174-181). */
	stacked?: number | boolean;
	/** Gap ratio between bar groups; default `BAR_CHART_SPACE_RATIO = 0.5` (AxisChart.js:260, utils/constants.js:71). */
	spaceRatio?: number;
	/** Percentage-bar thickness; default `PERCENTAGE_BAR_DEFAULT_HEIGHT = 16` (PercentageChart.js:18, utils/constants.js:77). */
	height?: number;
}

/** `options.lineOptions` — `AxisChart.js:19, 306-330`. */
export interface FrappeChartLineOptions {
	heatline?: number | boolean;
	regionFill?: number | boolean;
	spline?: number | boolean;
	showDots?: number | boolean;
	trailingDot?: number | boolean;
	hideDotBorder?: number | boolean;
	hideLine?: number | boolean;
	/** Default `LINE_CHART_DOT_SIZE = 4` (AxisChart.js:330, utils/constants.js:74). */
	dotSize?: number;
}

/**
 * Second argument to `new frappe.Chart(parent, options)`.
 *
 * This object is REQUIRED — `chart.js:33-35` dereferences `options.type`
 * immediately, so `new frappe.Chart(el)` throws a `TypeError`.
 *
 * The index signature is deliberate, not a shrug. Frappe genuinely funnels
 * arbitrary keys through here:
 * - `chart_widget.js:700-708` merges a Dashboard Chart's `custom_options` JSON
 *   blob straight into the args;
 * - `query_report.js:1186-1205` leaves report-only keys (`fieldtype`,
 *   `options`) on the same object it hands to the constructor;
 * - `form/dashboard.js:523-530` passes `start` / `count_label` at the TOP level
 *   even though frappe-charts reads `data.start` and `options.countLabel`
 *   (those two are therefore silently ignored — see the group notes).
 *
 * Only the keys below are actually read by frappe-charts; everything else
 * survives into `chart.rawChartArgs` and is otherwise inert.
 */
export interface FrappeChartOptions {
	/** Defaults to `"line"` (chart.js:17). See {@link FrappeChartRequestedType}. */
	type?: FrappeChartRequestedType;
	/** `BaseChart.js:31` — shape depends on `type`. */
	data?: FrappeChartData;
	/**
	 * Series colors, longest-first. `BaseChart.js:34` appends the per-type
	 * `DEFAULT_COLORS` tail and drops invalid entries — see
	 * {@link FrappeBaseChart.validateColors}.
	 */
	colors?: FrappeChartColor[];
	/** Rendered above the chart; `''` when omitted, and an empty title zeroes `measures.titleHeight` (BaseChart.js:28, 48). */
	title?: string;
	/** Total chart height in px, default `BASE_MEASURES.baseHeight = 240` (BaseChart.js:50, utils/constants.js:33). */
	height?: number;
	/** Default `1`. Falsy zeroes `measures.legendHeight` (BaseChart.js:38, 49). NOTE: `AxisChart.setMeasures()` force-clears it for single-dataset charts (AxisChart.js:28-31). */
	showLegend?: number | boolean;
	/** Default `1` — truncate long legend labels (BaseChart.js:42). */
	truncateLegends?: number | boolean;
	/** Default `0`. Enables arrow-key/enter navigation and the overlay (BaseChart.js:39, 57-59, 300-323). */
	isNavigable?: number | boolean;
	/** Default `1` — animate updates (BaseChart.js:40, 242). */
	animate?: number | boolean;
	/** Default `0` — skip the animation of the initial zero→real data transition (BaseChart.js:41, 242). */
	disableEntryAnimation?: number | boolean;
	/** Draw each value as text above its point instead of on hover; also switches the tooltip binding (AxisChart.js:52, 406-411). */
	valuesOverPoints?: number | boolean;
	axisOptions?: FrappeChartAxisOptions;
	tooltipOptions?: FrappeChartTooltipOptions;
	barOptions?: FrappeChartBarOptions;
	lineOptions?: FrappeChartLineOptions;

	/* --- aggregation charts (pie / donut / percentage) --- */
	/** Default `20`; extra slices collapse into a grey `"Rest"` slice (AggregationChart.js:14, 33-44). */
	maxSlices?: number;
	/** Default `20` (AggregationChart.js:15). */
	maxLegendPoints?: number;

	/* --- pie / donut --- */
	/** Hover pop-out distance as a fraction of the radius; default `0.1` (PieChart.js:23). */
	hoverRadio?: number;
	/** Degrees; default `0` (PieChart.js:24). */
	startAngle?: number;
	/** Default `false` (PieChart.js:32). */
	clockWise?: boolean;
	/** Donut ring thickness; default `30` (DonutChart.js:20). */
	strokeWidth?: number;

	/* --- heatmap --- */
	/** Suffix in the heatmap tooltip, e.g. `"interactions"`; default `''` (Heatmap.js:23, 168). */
	countLabel?: string;
	/** Default `'Sunday'`; anything other than `'Sunday'`/`'Monday'` falls back to `'Sunday'` (Heatmap.js:25-28). */
	startSubDomain?: "Sunday" | "Monday";
	/** Gap between month blocks. Only an explicit `0` disables it (Heatmap.js:35). frappe passes `1` (form/dashboard.js:527). */
	discreteDomains?: number | boolean;
	/** Corner radius of a heatmap square; default `0` (Heatmap.js:105, 182). frappe passes `3` (form/dashboard.js:528). */
	radius?: number;

	/**
	 * Frappe and app code routinely attach keys frappe-charts never reads.
	 * They are deep-cloned into `chart.rawChartArgs` and ignored.
	 */
	[key: string]: unknown;
}

/* -------------------------------------------------------------------------- */
/* Instance sub-objects                                                        */
/* -------------------------------------------------------------------------- */

/** `chart.measures` — a deep copy of `BASE_MEASURES` (BaseChart.js:45, utils/constants.js:19-38), then mutated by each `setMeasures()` override. */
export interface FrappeChartMeasures {
	margins: { top: number; bottom: number; left: number; right: number };
	paddings: { top: number; bottom: number; left: number; right: number };
	baseHeight: number;
	/** Zeroed when the chart has no title (BaseChart.js:48). */
	titleHeight: number;
	/** Zeroed when `config.showLegend` is falsy (BaseChart.js:49). */
	legendHeight: number;
	titleFontSize: number;
}

/**
 * `chart.config` — the resolved option set.
 *
 * The six base keys are always present (BaseChart.js:36-43); everything else is
 * added by whichever `configure()` override ran (`AxisChart.js:34-54`,
 * `AggregationChart.js:10-17`, `PieChart.js:18-33`), so it is optional here.
 */
export interface FrappeChartConfig {
	/** Hard-coded `1` with a `// calculate` TODO (BaseChart.js:37). */
	showTooltip: number | boolean;
	showLegend: number | boolean;
	isNavigable: number | boolean;
	animate: number | boolean;
	disableEntryAnimation: number | boolean;
	truncateLegends: number | boolean;

	/* AxisChart.configure (AxisChart.js:40-53) */
	xAxisMode?: "span" | "tick";
	yAxisMode?: "span" | "tick";
	xIsSeries?: number | boolean;
	shortenYAxisNumbers?: number | boolean;
	numberFormatter?: (value: number) => string | number;
	seriesLabelSpaceRatio?: number;
	yAxisRange?: { min?: number; max?: number };
	formatTooltipX?: FrappeChartTooltipOptions["formatTooltipX"];
	formatTooltipY?: FrappeChartTooltipOptions["formatTooltipY"];
	valuesOverPoints?: number | boolean;
	/** `30` for axis charts (AxisChart.js:53), `60` for aggregation charts (AggregationChart.js:16). */
	legendRowHeight?: number;

	/* AggregationChart.configure (AggregationChart.js:14-15) */
	maxSlices?: number;
	maxLegendPoints?: number;

	/* PieChart.configure (PieChart.js:24) */
	startAngle?: number;
}

/**
 * `chart.state` — per-type scratch space rebuilt on every `calc()`.
 *
 * `BaseChart.js:52` initialises it to `{}` and each subclass writes a disjoint
 * set of keys into it, so the honest model is "a few well-known keys plus an
 * open bag". Nothing outside frappe-charts should depend on this; it is
 * declared only so prototype patches can reach it without an escape hatch.
 */
export interface FrappeChartState {
	/** AxisChart.js:75 — number of x labels. */
	datasetLength?: number;
	/** AxisChart.js:77 / :78 — px per label slot, and the half-slot x offset. */
	unitWidth?: number;
	xOffset?: number;
	/** AxisChart.js:85-90. */
	xAxis?: { labels: Array<string | number>; positions: number[]; calcLabels?: Array<string | number> };
	/** AxisChart.js:99-104. */
	yAxis?: { labels: number[]; positions: number[]; scaleMultiplier: number; zeroLine: number };
	/** AxisChart.js:116-131 — the drawing-space copy of `data.datasets`. */
	datasets?: Array<{
		name?: string;
		index?: number;
		values: number[];
		yPositions?: number[];
		cumulativeYs?: number[];
		cumulativeYPos?: number[];
		chartType?: "line" | "bar";
	}>;
	/** AxisChart.js:136-146 — topmost y position per index, used to place the tooltip. */
	yExtremes?: number[];
	/** AxisChart.js:554-558 — index last selected via keyboard navigation. */
	currentIndex?: number;
	yMarkers?: FrappeChartYMarker[];
	yRegions?: FrappeChartYRegion[];
	/** AggregationChart.js:22-52. */
	sliceTotals?: number[];
	labels?: Array<string | number>;
	grandTotal?: number;
	/** Heatmap.js:83-92. */
	start?: Date;
	end?: Date;
	noOfWeeks?: number;
	distribution?: number[];
	[key: string]: unknown;
}

/**
 * One drawable layer. `objects/ChartComponents.js:10-69` (the class is not
 * exported; instances are produced by `getComponent(name, constants, getData)`
 * at `objects/ChartComponents.js:465-473` and stored in `chart.components`).
 */
export interface FrappeChartComponent {
	/** SVG class name for the layer group; may itself be a function that returns one (ChartComponents.js:31-33). */
	layerClass: string;
	layerTransform: string;
	/** The `constants` bag passed to `getComponent()`; per-component and untyped by frappe-charts. */
	constants: Record<string, unknown>;
	/** Result of the last `getData()` call. */
	data: unknown;
	/** The previous `data`, captured by `make()` (ChartComponents.js:48). */
	oldData?: unknown;
	/** The SVG elements produced by the last `render()` (ChartComponents.js:52). */
	store: SVGElement[];
	labels: SVGElement[];
	/** Set by `setup()` (ChartComponents.js:41-43). */
	layer?: SVGGElement;
	getData(): unknown;
	makeElements(data: unknown): SVGElement[];
	animateElements(data: unknown): unknown[];
	refresh(data?: unknown): void;
	setup(parent: SVGElement): void;
	make(): void;
	render(data: unknown): void;
	/** Returns the elements to hand to the SMIL animator (ChartComponents.js:61-68). */
	update(animate?: boolean): unknown[];
}

/** One row of `SvgTip.listValues` (AxisChart.js:376-386). */
export interface FrappeChartTooltipValue {
	/** The dataset name, shown as the row's label. */
	title?: string;
	value: number;
	yPos?: number;
	color?: string;
	/** `formatTooltipY(value, …)` applied, or the raw value when no formatter is configured. */
	formatted?: string | number;
}

/**
 * The floating HTML tooltip. `objects/SvgTip.js`.
 *
 * Created once per chart in `BaseChart.makeTooltip()` (BaseChart.js:137-141)
 * and never replaced, so re-theming a chart means writing to `tip.colors` as
 * well as `chart.colors`.
 */
export declare class SvgTip {
	/** SvgTip.js:5-23. `parent` is the chart's `.chart-container` div. */
	constructor(args: { parent?: HTMLElement | null; colors?: string[] });

	/** The `.chart-container` div, NOT the chart's own `parent` (BaseChart.js:139). */
	parent: HTMLElement | null;
	/**
	 * Swatch per tooltip row; falls back to `'black'` for a missing index
	 * (SvgTip.js:74). Mutable — this is the only way to re-color an existing
	 * tooltip, since `makeTooltip()` runs once.
	 */
	colors: string[];
	/** The `.graph-svg-tip` div (SvgTip.js:35-41). */
	container: HTMLElement;
	/** The `.title` span inside {@link container} (SvgTip.js:44). */
	title: HTMLElement;
	/** Both point at the same `.data-point-list` `<ul>` (SvgTip.js:45-46). */
	list: HTMLElement;
	dataPointList: HTMLElement;
	titleName: string;
	titleValue: string;
	listValues: FrappeChartTooltipValue[];
	titleValueFirst: number | boolean;
	x: number;
	y: number;
	top: number;
	left: number;
	/** Index written onto the container as `data-point-index` (SvgTip.js:55-57, 119). */
	index?: number;
	/**
	 * Draw-area offset. NOT set by SvgTip's constructor — `BaseChart.makeChartArea()`
	 * assigns it (BaseChart.js:227, 230-235) on every draw, before any tooltip can
	 * be shown.
	 */
	offset?: { x: number; y: number };

	setup(): void;
	makeTooltip(): void;
	fill(): void;
	calcPosition(): void;
	refresh(): void;
	setValues(
		x: number,
		y: number,
		title?: { name?: string; value?: string | number; valueFirst?: number | boolean },
		listValues?: FrappeChartTooltipValue[],
		index?: number
	): void;
	hideTip(): void;
	showTip(): void;
}

/** Return of `AxisChart.getDataPoint()` (AxisChart.js:540-548). */
export interface FrappeChartDataPoint {
	index: number;
	label: string | number;
	/** One value per dataset, at `index`. */
	values: number[];
}

/**
 * The `"data-select"` event fired on `chart.parent` by
 * `AxisChart.setCurrentDataPoint()` (AxisChart.js:558).
 *
 * `utils/dom.js:107-117` `fire()` copies the data point's properties directly
 * ONTO the event object — there is no `detail`. Frappe v16 registers no
 * listener for it.
 */
export type FrappeChartDataSelectEvent = Event & FrappeChartDataPoint;

/* -------------------------------------------------------------------------- */
/* The chart classes                                                           */
/* -------------------------------------------------------------------------- */

/**
 * `frappe-charts`' `BaseChart` — the instance type every `new frappe.Chart()`
 * actually produces (as one of its five concrete subclasses).
 *
 * Declared as a `class` so consumers can `extends` it and call `super()`; that
 * is exactly what `carbon_frappe/public/js/carbon_charts.bundle.js:138-149`
 * does. See {@link FrappeChartConstructor} for the two things that make
 * subclassing this surprising at runtime.
 *
 * Field optionality below is not cosmetic: fields assigned by the BaseChart
 * CONSTRUCTOR are required, fields assigned only by `setup()` / `draw()` are
 * optional. In practice `setup()` runs from every concrete constructor
 * (`AxisChart.js:24`, `Heatmap.js:30`, `PercentageChart.js:10`,
 * `PieChart.js:15`), so the optional ones are populated by the time `new`
 * returns — but they are genuinely absent inside the base constructor, which is
 * where a `configure()` / `setMeasures()` override runs.
 */
export declare class FrappeBaseChart {
	/**
	 * @param parent CSS selector or element. A string goes through
	 * `document.querySelector` (BaseChart.js:18-20); if the result is not an
	 * `HTMLElement` the constructor throws
	 * `Error('No \`parent\` element to render on was provided.')` (BaseChart.js:22-24).
	 * @param options Deep-cloned before use (BaseChart.js:16), so post-construction
	 * mutations of the caller's object have no effect — except on `barOptions` /
	 * `lineOptions`, see {@link FrappeAxisChart}.
	 */
	constructor(parent: string | HTMLElement, options: FrappeChartOptions);

	/** BaseChart.js:18-24. Always an `HTMLElement` on a successfully constructed chart. */
	parent: HTMLElement;
	/** The deep-cloned options (BaseChart.js:16, 26). `Heatmap` reads `radius` back off it (Heatmap.js:105, 182). */
	rawChartArgs: FrappeChartOptions;
	/** `options.title || ''` (BaseChart.js:28). */
	title: string;
	/** See {@link FrappeChartType}. `BaseChart.js:29` sets `options.type || ''`; every concrete subclass then pins it. */
	type: FrappeChartType;
	/** `prepareData(options.data)` (BaseChart.js:31) — the real, full dataset. */
	realData: FrappeChartData;
	/** The dataset currently rendered: starts as the zeroed copy, becomes `realData` after the init animation (BaseChart.js:32, 163). */
	data: FrappeChartData;
	/**
	 * The validated color list. Mutable, and re-read on every `draw()` /
	 * `render()`, which is what makes runtime re-theming possible
	 * (BaseChart.js:34).
	 */
	colors: string[];
	config: FrappeChartConfig;
	measures: FrappeChartMeasures;
	/** `options.height || measures.baseHeight` (BaseChart.js:50). */
	argHeight: number;
	state: FrappeChartState;
	/** `BaseChart.js:53` assigns `{}` and nothing in frappe-charts ever reads or writes it. */
	options: Record<string, unknown>;
	/** `INIT_CHART_UPDATE_TIMEOUT = 700` ms (BaseChart.js:55, utils/constants.js:62); `PieChart` zeroes it (PieChart.js:12). */
	initTimeout: number;
	/** `= argHeight` (BaseChart.js:93). */
	baseHeight: number;
	/** `baseHeight` minus `getExtraHeight(measures)` (BaseChart.js:94). */
	height: number;
	/** `() => this.draw(true)`, bound to resize / orientationchange and to the ResizeObserver (BaseChart.js:97-103). */
	boundDrawFn: () => void;

	/** Only when `config.isNavigable` (BaseChart.js:57-59). */
	overlays?: SVGElement[];
	/** Guarded in `destroy()` (BaseChart.js:107); `ResizeObserver` is assumed to exist at BaseChart.js:98. */
	resizeObserver?: ResizeObserver;
	/** `.chart-container` div; created by `makeContainer()` (BaseChart.js:134). */
	container?: HTMLElement;
	/** Created by `makeTooltip()`, which `setup()` calls (BaseChart.js:113-119, 137-141). */
	tip?: SvgTip;
	/** `updateWidth()` (BaseChart.js:177-178). */
	baseWidth?: number;
	width?: number;
	/** `makeChartArea()` guards on this itself (BaseChart.js:182), so it is genuinely optional. */
	svg?: SVGSVGElement;
	svgDefs?: SVGDefsElement;
	/** Only when `title` is non-empty (BaseChart.js:195-207). */
	titleEL?: SVGTextElement;
	drawArea?: SVGGElement;
	/** Only when `config.showLegend` (BaseChart.js:215-221). */
	legendArea?: SVGGElement;
	/** Keyed by component name; empty `Map` until `setupComponents()` runs (BaseChart.js:237). */
	components?: Map<string, FrappeChartComponent>;
	/** Keycode → handler, only when `config.isNavigable` and `init` (BaseChart.js:306-312). */
	keyActions?: Record<string, () => void>;

	/** Identity on the base; overridden per chart family (BaseChart.js:64-66). */
	prepareData(data: FrappeChartData): FrappeChartData;
	/** Identity on the base; `AxisChart` returns a zeroed copy for the entry animation (BaseChart.js:68-70, AxisChart.js:60-62). */
	prepareFirstData(data: FrappeChartData): FrappeChartData;

	/**
	 * Resolve a color list for a chart type. BaseChart.js:72-84.
	 *
	 * Appends `DEFAULT_COLORS[type]` (utils/constants.js:94-101 — the 10 preset
	 * names, or the 5-step green ramp for `heatmap`), maps every entry through
	 * `getColor()` (preset name → hex, `rgb()` → hex) and keeps only the ones
	 * `isValidColor()` accepts, `console.warn`ing about the rest. Returns a NEW
	 * array; never throws.
	 *
	 * An unknown `type` yields `colors.concat(undefined)`, which merely warns
	 * `'"undefined" is not a valid color.'` — hence `type: string` rather than
	 * {@link FrappeChartType}.
	 *
	 * Not overridden anywhere in frappe-charts 2.0.0-rc27.
	 */
	validateColors(colors: FrappeChartColor[] | undefined, type: string): string[];

	/** No-op on the base; each subclass mutates `this.measures` / `this.config` here. Called from the BaseChart constructor (BaseChart.js:47, 86-89). */
	setMeasures(options: FrappeChartOptions): void;
	/** Computes heights and binds the resize listeners; subclasses call `super.configure()` first (BaseChart.js:91-104). */
	configure(options: FrappeChartOptions): void;

	/**
	 * Disconnect the ResizeObserver and remove the window listeners
	 * (BaseChart.js:106-110). It does NOT remove the chart's DOM, the `keydown`
	 * listener added by `setupNavigation()`, or the tooltip.
	 */
	destroy(): void;

	/** `makeContainer()` → `updateWidth()` → `makeTooltip()` → `draw(false, true)`. "Has to be called manually" per the source comment, but every concrete subclass constructor calls it (BaseChart.js:112-119). */
	setup(): void;

	/** Wipes `parent.innerHTML` and creates the `.chart-container` div (BaseChart.js:121-135). */
	makeContainer(): void;
	/** Constructs {@link tip} and calls `bindTooltip()` (BaseChart.js:137-143). */
	makeTooltip(): void;
	/** No-op on the base (BaseChart.js:145). */
	bindTooltip(): void;

	/**
	 * Re-render the chart. BaseChart.js:147-172.
	 *
	 * @param onlyWidthChange when true, skips the y-axis recalculation and
	 * bails out entirely if the parent is hidden (BaseChart.js:148-151). This is
	 * the resize path.
	 * @param init when true, swaps in `realData` and schedules
	 * `update(this.data, true)` after `initTimeout` ms — the entry animation
	 * (BaseChart.js:162-165). Only `setup()` passes it.
	 *
	 * Calling `draw()` with no arguments is therefore a full redraw that does
	 * NOT re-arm the 700 ms init timer. It can throw if the chart's DOM has been
	 * removed from under it.
	 */
	draw(onlyWidthChange?: boolean, init?: boolean): void;

	/** Builds `this.state`. No-op on the base (BaseChart.js:174). */
	calc(onlyWidthChange?: boolean): void;
	/** Recomputes `baseWidth`/`width` from the parent's content width (BaseChart.js:176-179). */
	updateWidth(): void;
	/** Rebuilds the `<svg>`, title, draw area and legend area (BaseChart.js:181-228). */
	makeChartArea(): void;
	updateTipOffset(x: number, y: number): void;
	/** Base implementation sets `components` to an empty `Map` (BaseChart.js:237). */
	setupComponents(): void;

	/**
	 * Swap in new data and re-render. BaseChart.js:239-247.
	 *
	 * Only `console.error`s on falsy `data` — it does not bail, so a subsequent
	 * `prepareData(undefined)` is what actually throws. `drawing` is an internal
	 * flag: `true` skips the deep clone and uses `disableEntryAnimation` instead
	 * of `animate`.
	 *
	 * NOTE: `Heatmap.update()` takes only `data` and additionally re-runs
	 * `draw()` + `bindTooltip()` (Heatmap.js:141-149).
	 */
	update(data: FrappeChartData, drawing?: boolean): void;

	render(components?: Map<string, FrappeChartComponent>, animate?: boolean): void;
	updateNav(): void;
	/** The base implementation REQUIRES its argument (it calls `dataset.map`); the subclasses call it with their own list (BaseChart.js:279-295). */
	renderLegend(dataset: unknown[]): void;
	/** No-op on the base; returns the legend dot group in the subclasses (BaseChart.js:297, AxisChart.js:445-458, AggregationChart.js:67-81). */
	makeLegend(data: unknown, index: number, xPos: number, yPos: number): SVGElement | undefined;

	/** Binds the arrow/enter keys — only when `config.isNavigable` AND `init` (BaseChart.js:300-323). */
	setupNavigation(init?: boolean): void;
	makeOverlay(): void;
	updateOverlay(): void;
	bindOverlay(): void;
	bindUnits(): void;
	onLeftArrow(): void;
	onRightArrow(): void;
	onUpArrow(): void;
	onDownArrow(): void;
	onEnterKey(): void;

	/**
	 * Public data API. These are no-ops on `BaseChart` (BaseChart.js:336-342)
	 * and implemented only by `AxisChart` (AxisChart.js:563-597) — calling them
	 * on a pie/donut/percentage/heatmap chart silently does nothing.
	 */
	addDataPoint(label: string | number, datasetValues: number[], index?: number): void;
	removeDataPoint(index?: number): void;
	updateDataset(datasetValues: number[], index?: number): void;
	/** Not present on `BaseChart` at all; `AxisChart.js:591-597`. Declared here because `frappe.Chart` hands back an AxisChart for the default `line`/`bar` types. */
	updateDatasets(datasets: number[][]): void;
	/** `undefined` on every non-axis chart (BaseChart.js:339). */
	getDataPoint(index?: number): FrappeChartDataPoint | undefined;
	setCurrentDataPoint(index: number): void;

	/** Serialises the `<svg>` and triggers a download named after `title` or `'Chart'` (BaseChart.js:344-347). */
	export(): void;
}

/**
 * What `type: "bar"`, `"line"` and `"axis-mixed"` actually construct
 * (`chart.js:9-15`, `chart.js:19-22`).
 *
 * WARNING: `AxisChart.js:18-19` reads `barOptions` / `lineOptions` off the
 * caller's ORIGINAL args object, not off the deep clone `BaseChart` made, so
 * those two sub-objects stay aliased to the caller's.
 */
export declare class FrappeAxisChart extends FrappeBaseChart {
	barOptions: FrappeChartBarOptions;
	lineOptions: FrappeChartLineOptions;
	/** `1` from construction onward; consulted by the slice/point animations (AxisChart.js:22). */
	init: number;
	/** Tooltip lookup table, rebuilt by `makeDataByIndex()` (AxisChart.js:365-397). */
	dataByIndex?: Record<
		number,
		{
			label: string | number;
			formattedLabel: string | number;
			xPos: number;
			values: FrappeChartTooltipValue[];
			yExtreme: number;
		}
	>;
	dataUnitComponents?: FrappeChartComponent[];
	overlayGuides?: Array<Record<string, unknown>>;

	calcXPositions(): void;
	calcYAxisParameters(dataValues: number[], withMinimum?: boolean | string): void;
	calcDatasetPoints(): void;
	calcYExtremes(): void;
	calcYRegions(): void;
	getAllYValues(): number[];
	makeDataByIndex(): void;
	mapTooltipXPosition(relX: number, y?: number): void;
	updateOverlayGuides(): void;
	/** Always defined on an axis chart (AxisChart.js:540-548). */
	getDataPoint(index?: number): FrappeChartDataPoint;
}

/** Shared base of `pie`, `donut` and `percentage` (`AggregationChart.js`). Never constructed directly by `frappe.Chart`. */
export declare class FrappeAggregationChart extends FrappeBaseChart {
	/** Chart-area centre, recomputed in `calc()` (AggregationChart.js:54-57). */
	center?: { x: number; y: number };
	/** `state.sliceTotals` truncated to `config.maxLegendPoints` (AggregationChart.js:63). */
	legendTotals?: number[];
}

/** `type: "percentage"` (`PercentageChart.js`). */
export declare class FrappePercentageChart extends FrappeAggregationChart {
	/** Read from the caller's args and given a default `height` (PercentageChart.js:15-18). */
	barOptions: FrappeChartBarOptions;
	/** Deliberately a no-op override (PercentageChart.js:70). */
	makeDataByIndex(): void;
}

/** `type: "pie"` (`PieChart.js`). */
export declare class FrappePieChart extends FrappeAggregationChart {
	/** `0` — pie charts skip the delayed init update (PieChart.js:12). */
	initTimeout: number;
	init: number;
	hoverRadio: number;
	clockWise: boolean;
	/** `'pieSlices'`, or `'donutSlices'` on a donut (PieChart.js:27, DonutChart.js:15). */
	sliceName: string;
	radius?: number;
	curActiveSlice?: SVGElement;
	curActiveSliceIndex?: number;
	/** Path-string builders, swapped by `DonutChart` (PieChart.js:29-30, DonutChart.js:17-18). */
	arcFunc: (...args: never[]) => string;
	shapeFunc: (...args: never[]) => string;
	getRadius(): number;
	calTranslateByAngle(property: { startAngle: number; endAngle: number }): string;
	hoverSlice(path: SVGElement, i: number, flag: boolean, e?: MouseEvent): void;
	resetHover(path: SVGElement, color: string): void;
	mouseMove(e: MouseEvent): void;
	mouseLeave(): void;
}

/**
 * `type: "donut"` (`DonutChart.js`).
 *
 * Reachable only through `frappe.Chart` / the `chartTypes` map — unlike the
 * other four, `DonutChart` is NOT a named export of frappe-charts
 * (`chart.js:38`).
 */
export declare class FrappeDonutChart extends FrappePieChart {
	/** Ring thickness, default `30` (DonutChart.js:20). */
	strokeWidth: number;
}

/** `type: "heatmap"` (`Heatmap.js`). */
export declare class FrappeHeatmap extends FrappeBaseChart {
	data: FrappeHeatmapData;
	realData: FrappeHeatmapData;
	/** `options.countLabel || ''` — the tooltip suffix (Heatmap.js:23). */
	countLabel: string;
	/** `0` for Sunday, `1` for Monday (Heatmap.js:25-28). */
	startSubDomainIndex: number;
	/** `0` only when `options.discreteDomains === 0`, else `1` (Heatmap.js:35). */
	discreteDomains: number;
	/** Heatmaps size themselves from their date range rather than their parent (Heatmap.js:45-46; consumed by `makeContainer()` at BaseChart.js:130-132). */
	independentWidth: number;
	/**
	 * Heatmap's own update path — one argument only, and it calls `draw()` and
	 * `bindTooltip()` itself instead of `calc()` + `render()` (Heatmap.js:141-149).
	 * This is what `frappe.ui.form.Dashboard.update_heatmap` calls
	 * (`frappe/public/js/frappe/form/dashboard.js:515-519`).
	 */
	update(data: FrappeHeatmapData): void;
	getDomains(startDate: Date, endDate: Date): unknown[];
	getDomainConfig(startDate: Date, endDate?: Date | string): Record<string, unknown>;
	getCol(startDate: Date, month: number, empty?: boolean): unknown[];
	getSubDomainConfig(date: Date): Record<string, unknown>;
}

/** Every concrete instance `frappe.Chart` can hand back. */
export type FrappeChartInstance =
	| FrappeAxisChart
	| FrappePercentageChart
	| FrappePieChart
	| FrappeDonutChart
	| FrappeHeatmap;

/* -------------------------------------------------------------------------- */
/* The `frappe.Chart` value                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The type of the (writable) `frappe.Chart` property.
 *
 * `frappe/public/js/frappe/ui/chart.js:4` assigns frappe-charts' `Chart` here.
 * That `Chart` is not a normal class:
 *
 * ```js
 * // frappe-charts/src/js/chart.js:32-36
 * class Chart {
 *   constructor(parent, options) {
 *     return getChartByType(options.type, parent, options);
 *   }
 * }
 * ```
 *
 * 1. **The constructor returns a different object.** `new frappe.Chart(el, o)`
 *    evaluates to an `AxisChart` / `PercentageChart` / `PieChart` /
 *    `DonutChart` / `Heatmap` — NOT to a `Chart`. In a subclass, `this` after
 *    `super()` is likewise that foreign instance, so a subclass's own fields
 *    and prototype are discarded. `carbon_charts.bundle.js:138-148` relies on
 *    exactly this: its `CarbonChart` adds nothing to `this` beyond the
 *    `themed.set(this, source)` bookkeeping.
 *
 * 2. **An unknown `type` does NOT yield `undefined`.** `getChartByType`
 *    (`chart.js:24-27`) returns `undefined` after `console.error`, but a base
 *    constructor returning a non-object yields `this` per [[Construct]] — so
 *    `new frappe.Chart(el, { type: "nope" })` produces an EMPTY, truthy `Chart`
 *    instance with no `parent`, `colors` or `draw`. (Frappe's own falsy guard
 *    at `frappe/public/js/frappe/form/dashboard.js:619-621` is therefore dead
 *    code.) The construct signature below returns {@link FrappeBaseChart}
 *    because TypeScript cannot express "a class whose constructor returns
 *    something else"; treat that as accurate for every valid `type` and as an
 *    over-promise for an invalid one.
 *
 * 3. **`type: "axis-mixed"` mutates the caller's options object** —
 *    `chart.js:20` writes `options.type = "line"` BEFORE `BaseChart` deep-clones
 *    it (`BaseChart.js:16`).
 */
export interface FrappeChartConstructor {
	/** @param options Required — `chart.js:34` dereferences `options.type` immediately. */
	new (parent: string | HTMLElement, options: FrappeChartOptions): FrappeBaseChart;
	/** Present so prototype patches (`frappe.Chart.prototype.draw = …`) type-check. */
	readonly prototype: FrappeBaseChart;
	/**
	 * NOT part of frappe. An idempotency marker set by carbon_frappe's chart
	 * shim (`carbon_charts.bundle.js:136, 150`) so a second `patch()` is a
	 * no-op. Declared here because `frappe.Chart` is a plain writable property
	 * and a strict consumer has no other way to read or write it; other patchers
	 * should merge their own marker into this interface rather than reuse it.
	 */
	__carbon_frappe?: boolean;
}

/**
 * `frappe.ui.RealtimeChart` — frappe's only in-tree `frappe.Chart` subclass
 * (`frappe/public/js/frappe/ui/chart.js:6-38`).
 *
 * Because of quirk (1) on {@link FrappeChartConstructor}, `this` after
 * `super(element, data)` is the underlying chart instance, and the three
 * methods below are assigned as OWN function properties in the constructor
 * rather than living on a prototype.
 *
 * `frappe.throw`s if the initial dataset already exceeds `maxLabelPoints`
 * (chart.js:8-14).
 */
export declare class FrappeRealtimeChart extends FrappeBaseChart {
	/**
	 * @param socketEvent realtime event name subscribed via `frappe.realtime.on`.
	 * @param maxLabelPoints defaults to `8`.
	 * @param data the full `frappe.Chart` options object — note the parameter is
	 * named `data` but is passed straight through as `options`, and
	 * `data.data.datasets[0].values` must exist (chart.js:7-8).
	 */
	constructor(
		element: string | HTMLElement,
		socketEvent: string,
		maxLabelPoints: number | undefined,
		data: FrappeChartOptions
	);
	currentSize: number;
	socketEvent: string;
	maxLabelPoints: number;
	start_updating(): void;
	stop_updating(): void;
	/** Drops the oldest point once `currentSize` reaches `maxLabelPoints` (chart.js:29-37). */
	update_chart(label: string, data: number[]): void;
}

/* -------------------------------------------------------------------------- */
/* carbon_frappe-side contracts                                                */
/* -------------------------------------------------------------------------- */

/**
 * Shape of `carbon_frappe/public/js/generated/chart-palettes.js`.
 *
 * That file is emitted by `carbon_frappe/scripts/generate-chart-palettes.mjs:69-76`
 * and committed with a DO-NOT-EDIT banner, so it needs a hand-written sibling
 * `chart-palettes.d.ts` containing exactly:
 *
 * ```ts
 * export declare const light: string[];
 * export declare const dark: string[];
 * export declare const heatmap: string[];
 * ```
 *
 * `light` and `dark` are @carbon/charts' 14-series categorical palettes for the
 * white and dark themes (14 hex strings each, in source order);  `heatmap` is a
 * 5-step sequential blue ramp (`generate-chart-palettes.mjs:50-53`). Typed as
 * `string[]` rather than a 14-tuple on purpose: the length is whatever the
 * upstream `'14': ('1': …)` SCSS block contains at codegen time.
 */
export interface ChartPalettesModule {
	light: string[];
	dark: string[];
	heatmap: string[];
}

/**
 * Build-time TEXT contract, not a JS symbol.
 *
 * `generate-chart-palettes.mjs:19-30` reads this file as a string and scrapes it
 * with `/'14':\s*\(\s*'1':\s*\(([\s\S]*?)\n\t\t\)/g`, requiring at least two
 * matches (white theme first, then dark). Each block's entries are then resolved
 * with `/getColorValue\((\w+),\s*(\d+)\)|(#[0-9a-fA-F]{3,8})/g` against
 * `@carbon/colors`, trying `colors[name]` then `colors[nameHover]`.
 *
 * The codegen therefore depends on three upstream details staying put: TAB
 * indentation of the SCSS map, the `'14'` / `'1'` key nesting, and the SCSS
 * function name `getColorValue(name, step)`. It `process.exit(1)`s on any of
 * them changing.
 */
export type CarbonChartsColorPaletteScssPath = "@carbon/charts/scss/_color-palette.scss";

/**
 * The CSS custom properties owned by the vendored frappe-charts stylesheet
 * (`frappe-charts/dist/frappe-charts.min.css`, which `desk.bundle.scss` imports).
 *
 * Verified by scanning that file with `/(--[a-z0-9-]+)\s*:/g` — the same census
 * `carbon_frappe/scripts/audit-tokens.mjs:141` performs. Frappe's own SCSS
 * re-declares only the subset it overrides in dark mode, so the dist CSS is the
 * authority for the full list.
 */
export type FrappeChartsCssVariable =
	| "--charts-axis-line-color"
	| "--charts-dataset-circle-stroke"
	| "--charts-dataset-circle-stroke-width"
	| "--charts-label-color"
	| "--charts-legend-label"
	| "--charts-legend-value"
	| "--charts-stroke-width"
	| "--charts-tooltip-bg"
	| "--charts-tooltip-label"
	| "--charts-tooltip-title"
	| "--charts-tooltip-value";

/** Path of the stylesheet {@link FrappeChartsCssVariable} was derived from. */
export type FrappeChartsDistCssPath = "frappe-charts/dist/frappe-charts.min.css";

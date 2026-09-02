/**
 * `frappe.ui.form` — Form, Layout, Grid, GridRow, GridRowForm and the
 * `make_control` / Control class hierarchy.
 *
 * Source of truth: frappe v16.33.0 (`git tag v16.33.0`, branch `version-16`),
 * `frappe/public/js/frappe/form/**`. Every signature below was read out of that
 * tree; citations are `file.js:line` relative to `frappe/public/js/frappe/`.
 *
 * ## Two facts about this slice that shape every declaration here
 *
 * 1. **Almost every class is `$.extend(this, opts)`.** `Grid`, `GridRow`,
 *    `GridRowForm`, `GridPagination`, `Layout`, `Toolbar` and every `Control`
 *    merge their constructor options onto `this` and declare nothing
 *    statically. The instance fields below were recovered from the bodies that
 *    read them, not from an initializer list. The `*Options` interfaces all
 *    carry an open index signature for that reason — `$.extend` copies whatever
 *    you hand it.
 *
 * 2. **These are `declare class`, deliberately.** carbon_frappe subclasses
 *    `Grid`/`GridRow` (`extends` + `super()`) and prototype-patches
 *    `ControlTable.prototype.make`. An interface would not support either.
 *    Subclass-only fields (e.g. a Carbon table handle hung off a `Grid`) belong
 *    in the consumer's own subclass declaration, or — when third-party code
 *    reaches them through a base-typed reference — in a module augmentation:
 *
 *    ```ts
 *    declare module "frappe-types" {
 *      interface Grid { carbon_table?: CarbonTable }
 *      interface GridRow { form_row?: HTMLTableRowElement }
 *    }
 *    ```
 *
 *    Interface/class declaration merging is what makes that work; it is why the
 *    classes here are exported rather than hidden behind an interface alias.
 */

import type {
	ChildDoc,
	DocField,
	DocTypeMeta,
	FormatterOptions,
	FrappeDoc,
	Permission,
} from "../model";

/**
 * SEAM — `Page` used to be imported from `../core`, which never declared it.
 * `frappe.ui.Page` is owned by `utils.d.ts`, the fragment that already owned
 * `FrappePageRegions` (the 24 jQuery regions `ui/page.js:133-168` assigns) and
 * that explicitly reserved the class for itself. That makes `ui/form.d.ts` ↔
 * `utils.d.ts` a type-only import cycle — legal in `.d.ts`, with no emit.
 *
 * `Dialog` used to be imported from `../core` too, while `core.d.ts` imported
 * it from here — a genuine circular alias (TS2303) with no declaration behind
 * it. THIS fragment now declares it: `frappe.ui.Dialog extends
 * frappe.ui.FieldGroup extends frappe.ui.form.Layout` (`ui/dialog.js:10`,
 * `ui/field_group.js:5`), and `Layout` is ours.
 */
import type { Page } from "../utils";

/**
 * SEAM — the Grid family is declared once, in `deep-modules.d.ts`, and
 * re-exported from this file further down. See the "Grid / GridRow /
 * GridRowForm / GridPagination — RE-EXPORTED, not redeclared" block for why
 * that fragment won ownership.
 */
import type {
	Grid,
	GridDocField,
	GridPagination,
	GridRow,
	GridRowForm,
} from "../deep-modules";

/* ========================================================================== *
 * Shared vocabulary
 * ========================================================================== */

/**
 * Field/grid display status. Produced by `frappe.perm.get_field_display_status`
 * and by `BaseControl#get_status`; consumed by `Grid#is_editable`
 * (grid.js:1419) and `BaseControl#can_write` (controls/base_input.js:155).
 */
export type DisplayStatus = "Write" | "Read" | "None";

/**
 * A `depends_on` / `mandatory_depends_on` / `read_only_depends_on` /
 * `collapsible_depends_on` expression.
 *
 * Four accepted shapes, all handled in the same block — grid_row.js:867-901 and
 * layout.js:784-824: a boolean, a `(doc) => unknown` function, an `"eval:…"`
 * string evaluated through `frappe.utils.eval`, an `"fn:…"` string dispatched
 * through `frm.script_manager`, or a bare fieldname whose truthiness is taken
 * (arrays test `.length`).
 */
export type DependsOnExpression =
	| boolean
	| string
	| ((doc: ChildDoc | FrappeDoc) => unknown);

/**
 * One row of the per-DocType `"GridView"` user setting.
 *
 * Written by the Configure Columns dialog (grid_row.js:428-437, :635-647) and
 * read back by `Grid#setup_user_defined_columns` (grid.js:1397-1417).
 * `columns` is a Bootstrap span (1-12) upstream; note that carbon_frappe stores
 * pixel widths in the same slot, which is why `Grid#visible_columns` is
 * declared as `number` rather than a 1-12 union.
 */
export interface GridViewColumn {
	fieldname: string;
	columns: number;
	/** frappe writes `cint(checkbox.checked)` here — grid_row.js:681. */
	sticky?: 0 | 1;
}

/*
 * `GridFilter` — one entry of `Grid#filter` (grid_row.js:281-284, :941-944) —
 * was declared here as `{ df: DocField; value: string }` and, more precisely, in
 * `deep-modules.d.ts` as `{ df: GridDocField; value: string }`. It moved with
 * the rest of the Grid family; this file re-exports it below, so
 * `import type { GridFilter } from "frappe-types"` is unaffected.
 */

/**
 * The SortableJS instance frappe binds to the grid's `.rows` container
 * (grid.js:752-787).
 *
 * SEAM NOTE — `deep-modules.d.ts` declares the same shape as `GridSortable`,
 * and that is the one `Grid#grid_sortable` is typed with. Both names survive
 * (they are structurally identical and neither collides), but new code should
 * prefer `GridSortable`.
 *
 * Only the two members frappe itself calls are declared:
 * `option()` from the grid search handlers (grid_row.js:297-302, :949-954).
 *
 * Not modelled further on purpose — the real type belongs to `sortablejs`, and
 * frappe loads it as a global rather than importing it.
 */
export interface SortableInstance {
	option(name: string, value?: unknown): unknown;
	destroy(): void;
}

/**
 * The `frappe.ui.form.ScriptManager` handle on a `Form` (script_manager.js:89,
 * :179). Only the two entry points reached from this slice are declared.
 */
export interface ScriptManager {
	/** script_manager.js:89 — `trigger(event_name, doctype, name)`. */
	trigger(event_name: string, doctype?: string, name?: string): Promise<unknown>;
	setup(): void;
}

/**
 * The `frappe.ui.form.Dashboard` handle on a `Form` (form.js:265). Only the
 * members `Form` itself calls are declared (form.js:639, :780, :1247-1271,
 * :1526, :2358).
 */
export interface Dashboard {
	refresh(): void;
	after_refresh(): void;
	clear_headline(): void;
	set_headline(html: string, color?: string): void;
	set_headline_alert(text: string, color?: string): void;
	add_comment(text: string, alert_class?: string, permanent?: boolean): void;
}

/** `frm.undo_manager` — form/undo_manager.js, constructed at form.js:41. */
export interface UndoManager {
	record_change(change: {
		fieldname: string;
		old_value: unknown;
		new_value: unknown;
		doctype?: string;
		docname?: string;
		is_child?: boolean;
	}): void;
	erase_history(): void;
	undo(): void;
	redo(): void;
}

/* ========================================================================== *
 * frappe.form.formatters  (form/formatters.js)
 * ========================================================================== */

/**
 * The `options` bag threaded through every formatter. `frappe.format` forwards
 * it verbatim (formatters.js:445), and callers invent keys freely — hence the
 * open index signature. The named keys are the ones formatters.js reads.
 *
 * COLLISION RESOLVED — this file and `model.d.ts` each declared a
 * `FormatterOptions` for the same bag, so one package exported two different
 * types under one name. `model.d.ts` won ownership: it is the lower module (this
 * file already imports from it, not the reverse) and `DocField.formatter`'s type
 * `DocFieldFormatter` (model.d.ts) has to name it. The three keys documented only here
 * (`for_print`, `label`, `no_icon`) were folded into that declaration with their
 * citations, and it is re-exported below, so nothing was lost and both import
 * paths now yield one type identity.
 */
export type { FormatterOptions };

/**
 * The call shape `frappe.format` uses for every formatter:
 * `formatter(value, df, options, doc)` — formatters.js:445.
 *
 * Individual formatters declare fewer parameters (`Date: function (value)` —
 * formatters.js:222) but are always *called* with four, so a uniform signature
 * is the honest description of the dispatch contract.
 */
export type FormatterFn = (
	value: unknown,
	df?: DocField,
	options?: FormatterOptions,
	doc?: FrappeDoc | ChildDoc
) => string;

/**
 * `frappe.form.formatters` — formatters.js:10-414.
 *
 * A **plain object literal**, not a class: every entry is a mutable, writable
 * property, which is what makes the wrap-and-reassign patching that
 * carbon_frappe does legal (`f.Date = function (...args) { … }`).
 *
 * The index signature is not decoration. frappe itself indexes this object with
 * an arbitrary runtime string — `frappe.form.get_formatter` does
 * `frappe.form.formatters[fieldtype.replace(/ /g, "")] || …`
 * (formatters.js:423) — and `_right` / `_apply_custom_formatter` do not share
 * the `FormatterFn` shape, so the index type has to be `unknown` rather than
 * `FormatterFn`. Narrow a dynamic lookup with `typeof f[key] === "function"`
 * before calling it, exactly as frappe and its patchers do.
 */
export interface Formatters {
	/**
	 * Wraps a value in `<div style='text-align: right'>…</div>` unless
	 * `options.inline` or `options.only_value` is set — formatters.js:11-17.
	 *
	 * The return type is genuinely open: the early branch returns the *value*
	 * unchanged (whatever was passed in), the late branch returns a string. It
	 * is called by Currency, Int, Float, Percent and Duration
	 * (formatters.js:80, :91, :103, :162).
	 *
	 * Declared with an explicit `this` because the object literal's other
	 * members reach it as `frappe.form.formatters._right(…)`, and a wrapper
	 * installed over it is written as a plain `function` expression whose `this`
	 * must be contextually typed.
	 */
	_right(
		this: Formatters,
		value: unknown,
		options?: FormatterOptions
	): unknown;

	/**
	 * Applies `frappe.meta.docfield_map[df.parent][df.fieldname].formatter` if
	 * one is defined — formatters.js:18-35. Returns the value untouched
	 * otherwise, so the return type is as open as the input.
	 */
	_apply_custom_formatter(value: unknown, df?: DocField): unknown;

	/** formatters.js:36-48. Handles `options === "URL" | "IBAN"`. */
	Data: FormatterFn;
	/** formatters.js:49-51. */
	Autocomplete: FormatterFn;
	/** formatters.js:52-54. */
	Select: FormatterFn;
	/** formatters.js:55-82. Delegates to `Currency` when `df.options` is set. */
	Float: FormatterFn;
	/** formatters.js:83-92. Delegates to `FileSize` when `options === "File Size"`. */
	Int: FormatterFn;
	/** formatters.js:93-107. */
	Percent: FormatterFn;
	/** formatters.js:108-126. Returns an SVG star row. */
	Rating: FormatterFn;
	/** formatters.js:127-164. */
	Currency: FormatterFn;
	/** formatters.js:165-168. Returns a disabled `<input type=checkbox>`. */
	Check: FormatterFn;
	/** formatters.js:169-221. Honours `frappe.form.link_formatters`. */
	Link: FormatterFn;
	/**
	 * formatters.js:222-235.
	 *
	 * Declared as returning `string`: the tail is `return value || ""` after
	 * `frappe.datetime.str_to_user`. There is one pre-boot escape hatch —
	 * `if (!frappe.datetime.str_to_user) return value;` (formatters.js:223) —
	 * which can return a non-string before `frappe.datetime` is loaded. That
	 * branch is unreachable from any desk render path.
	 */
	Date: FormatterFn;
	/** formatters.js:236-245. Accepts a `[from, to]` array. */
	DateRange: FormatterFn;
	/**
	 * formatters.js:246-256. Formats through the global `moment` using
	 * `frappe.boot.sysdefaults.date_format` / `.time_format`.
	 */
	Datetime: FormatterFn;
	/** formatters.js:257-275. */
	Text: FormatterFn;
	/** formatters.js:276-282. */
	Time: FormatterFn;
	/** formatters.js:283-290. Returns `"0s"` for an empty value. */
	Duration: FormatterFn;
	/** formatters.js:291-297. Parses a JSON array of user ids. */
	LikedBy: FormatterFn;
	/** formatters.js:298-313. Comma-separated `_user_tags`. */
	Tag: FormatterFn;
	/** formatters.js:314-316. Identity. */
	Comment: FormatterFn;
	/** formatters.js:317-326. Parses a JSON array of assignees. */
	Assign: FormatterFn;
	/** formatters.js:327-329. */
	SmallText: FormatterFn;
	/** formatters.js:330-345. Wraps in `.ql-editor.read-mode`. */
	TextEditor: FormatterFn;
	/** formatters.js:346-348. */
	Code: FormatterFn;
	/** formatters.js:349-366. */
	WorkflowState: FormatterFn;
	/** formatters.js:367-369. */
	Email: FormatterFn;
	/** formatters.js:370-378. Returns a number when under 1 KiB. */
	FileSize: FormatterFn;
	/** formatters.js:379-390. Takes the child rows, not a scalar. */
	TableMultiSelect: FormatterFn;
	/** formatters.js:391-398. */
	Color: FormatterFn;
	/** formatters.js:399-411. */
	Icon: FormatterFn;
	/** formatters.js:412 + :416-419 (`format_attachment_url`). */
	Attach: FormatterFn;
	/** formatters.js:413 + :416-419 (`format_attachment_url`). */
	AttachImage: FormatterFn;

	/**
	 * Open by design: `frappe.form.get_formatter` looks the object up with a
	 * runtime fieldtype string (formatters.js:423), and apps add entries for
	 * their own fieldtypes. `unknown` rather than `FormatterFn` because
	 * `_right` and `_apply_custom_formatter` live in the same namespace with
	 * different shapes.
	 */
	[fieldtype: string]: unknown;
}

/**
 * `frappe.form.link_formatters` — formatters.js:8, populated at :466.
 * Keyed by the *linked* DocType; consulted by `formatters.Link`
 * (formatters.js:186-191).
 */
export type LinkFormatters = Record<
	string,
	(value: unknown, doc?: FrappeDoc | ChildDoc, docfield?: DocField) => unknown
>;

/**
 * `frappe.form.get_formatter` — formatters.js:421-424.
 * Strips spaces from the fieldtype and falls back to `formatters.Data`.
 */
export declare function get_formatter(fieldtype?: string): FormatterFn;

/**
 * The shape of the `frappe.form` namespace object itself
 * (`frappe.provide("frappe.form.formatters")` — formatters.js:6).
 *
 * COLLISION RESOLVED — `core.d.ts` declared a second `FrappeFormNamespace` for
 * the same three-member object (`formatters`, `link_formatters`,
 * `get_formatter`). `core.d.ts` won ownership because `frappe.form` is a member
 * of {@link FrappeCore} and the root `frappe` object is that file's to describe;
 * its copy is also the stricter one (`link_formatters` values are
 * `| undefined`, matching `noUncheckedIndexedAccess`). It is re-exported here so
 * either import path resolves to the same type.
 *
 * This file's own, looser views of the same three values remain exported and
 * unchanged as {@link Formatters}, {@link LinkFormatters} and
 * {@link get_formatter} — they are what `frappe.ui.form`'s callers pass around
 * — so no declaration was lost in the merge.
 */
export type { FrappeFormNamespace } from "../core";

/* ========================================================================== *
 * Controls — frappe.ui.form.Control and friends
 * ========================================================================== */

/**
 * Options accepted by `frappe.ui.form.make_control` and by every Control
 * constructor.
 *
 * `BaseControl`'s constructor is `$.extend(this, opts); this.make(); …`
 * (controls/base_control.js:2-8), so *every* key lands on the instance
 * verbatim. The named members below are the ones frappe's own call sites pass
 * (layout.js:259-267, grid_row.js:1238-1250).
 */
export interface ControlOptions {
	df: DocField;
	/** The element the control appends its `.frappe-control` wrapper to. */
	parent: HTMLElement | JQuery;
	doctype?: string;
	docname?: string;
	doc?: FrappeDoc | ChildDoc;
	frm?: Form;
	layout?: Layout;
	/** Set for on-grid-editing controls — grid_row.js:1245. */
	grid?: Grid;
	/** Set for on-grid-editing controls — grid_row.js:1246. */
	grid_row?: GridRow;
	/** When true the constructor calls `refresh()` — base_control.js:5-7. */
	render_input?: boolean;
	/** Suppresses the label/description scaffolding — base_input.js:17-19. */
	only_input?: boolean;
	with_link_btn?: boolean;
	value?: unknown;
	[option: string]: unknown;
}

/**
 * `BaseControl#make()` stores a back-reference on its own wrapper element:
 * `this.wrapper.fieldobj = this` (base_control.js:15). Event handlers read it
 * back off the DOM, so a typed lookup needs this element shape.
 */
export interface ControlHostElement extends HTMLElement {
	fieldobj?: BaseControl;
}

/**
 * `frappe.ui.form.Control` — controls/base_control.js:1.
 *
 * Assigned as a **class expression** (`frappe.ui.form.Control = class BaseControl
 * { … }`), so the only way to name the type is through this declaration or
 * through `typeof frappe.ui.form.Control`.
 */
export declare class BaseControl {
	constructor(opts: ControlOptions);

	// ---- fields merged in by `$.extend(this, opts)` (base_control.js:3) ----
	df: DocField;
	parent: HTMLElement | JQuery;
	doctype?: string;
	docname?: string;
	doc?: FrappeDoc | ChildDoc;
	frm?: Form;
	layout?: Layout;
	grid?: Grid;
	grid_row?: GridRow;
	only_input?: boolean;
	render_input?: boolean;
	with_link_btn?: boolean;
	/** The tab this control's section belongs to — set by `Tab#add_field`. */
	tab?: Tab;

	// ---- fields built by make() ----
	/** `.frappe-control` wrapper — base_control.js:27. */
	$wrapper: JQuery<HTMLElement>;
	/**
	 * The same node as `$wrapper`, **unwrapped**.
	 *
	 * Careful: `make_wrapper()` first aliases it to the jQuery object
	 * (base_control.js:30) and `make()` then overwrites it with
	 * `this.$wrapper.get(0)` (base_control.js:14). Every reader runs after
	 * `make()`, which is why `ControlTable#make` can hand `this.wrapper`
	 * straight to `new Grid({ parent: … })` (controls/table.js:11) as an
	 * element.
	 */
	wrapper: ControlHostElement;
	/** `.tooltip-content` span appended in `make()` — base_control.js:17. */
	tooltip: JQuery<HTMLElement>;

	/** Cached result of the last `get_status()` — base_control.js:139. */
	disp_status?: DisplayStatus;
	/** The control's current (unparsed) value. */
	value?: unknown;
	/** Last value pushed to the model — base_control.js:274. */
	last_value?: unknown;
	/** Re-entrancy guard around the change event — base_control.js:218, :231. */
	inside_change_event?: boolean;

	/**
	 * `get perm()` returns `this.frm?.perm` and the setter only logs an error
	 * (base_control.js:38-44) — assignment is a no-op, hence `readonly`.
	 */
	readonly perm?: Permission[];

	// ---- methods ----
	/** base_control.js:9-24. */
	make(): void;
	/** base_control.js:26-31. Overridden by `ControlInput`. */
	make_wrapper(): void;
	/** base_control.js:33-36. Writes `df.hidden` then refreshes. */
	toggle(show: boolean): void;
	/** base_control.js:48-137. `explain` logs the decision to the console. */
	get_status(explain?: boolean): DisplayStatus;
	/** base_control.js:138-148. */
	refresh(): void;
	/** base_control.js:149-185. */
	show_translatable_button(value: unknown): void;
	/** base_control.js:186-194. Returns `{}` when the doc is not in `locals`. */
	get_doc(): FrappeDoc | ChildDoc | Record<string, never>;
	/** base_control.js:195-199. `undefined` when there is no `doc`. */
	get_model_value(): unknown;
	/** base_control.js:200-205. Runs `this.parse` if the subclass defines one. */
	get_parsed_value(value: unknown): unknown;
	/** base_control.js:207-209. */
	set_value(value: unknown, force_set_value?: boolean): Promise<unknown>;
	/** base_control.js:210-213. */
	parse_validate_and_set_in_model(value: unknown, e?: Event): Promise<unknown>;
	/** base_control.js:214-260. */
	validate_and_set_in_model(
		value: unknown,
		e?: Event | null,
		force_set_value?: boolean
	): Promise<unknown>;
	/** base_control.js:261-271. */
	get_value(): unknown;
	/** base_control.js:272-289. */
	set_model_value(value: unknown): Promise<unknown>;
	/** base_control.js:290-295. Returns `undefined` when there is no `$input`. */
	set_focus(): boolean | undefined;

	// ---- optional subclass hooks the base only calls when present ----
	/** Defined by `ControlInput` (base_input.js:84). */
	refresh_input?(): void;
	/** Defined by input controls (controls/data.js:262). */
	set_input?(value: unknown): void;
	/** Defined by input controls (controls/data.js:272). */
	get_input_value?(): unknown;
	/** Defined by input controls (controls/data.js:7). */
	make_input?(): void;
	/** Defined by numeric/date controls (controls/data.js:281). */
	parse?(value: unknown): unknown;
	/** Defined by input controls (controls/data.js:287). */
	validate?(value: unknown): unknown;
	/** base_input.js:271. */
	set_mandatory?(value: unknown): void;
	/** base_input.js:280. Writes `grid_row.columns[fieldname].is_invalid`. */
	set_invalid?(): void;
	/** base_control.js:249 — `me?.after_set_value?.()`. */
	after_set_value?(): unknown;
	/** Geolocation/Signature hook, called by `GridRowForm#set_active_tab`. */
	on_section_collapse?(hide: boolean): void;

	/** Copied from `Grid#get_field(fieldname).get_query` — grid_row.js:1252. */
	get_query?: unknown;
	/** Rich-text controls expose an editor with its own focus handling. */
	editor?: { set_focus(): void };
	/** `ControlLink`'s Awesomplete instance — controls/link.js:225. */
	awesomplete?: { ul: HTMLElement; list: unknown; [key: string]: unknown };
	/** `ControlLink`'s `.link-btn` handle — controls/link.js:28. */
	$link?: JQuery<HTMLElement>;
}

/**
 * `frappe.ui.form.ControlInput` — controls/base_input.js:2. The base of every
 * control that owns an `<input>`; `ControlTable` notably does **not** extend it.
 */
export declare class ControlInput extends BaseControl {
	/** base_input.js:3 — read back as `this.constructor.horizontal`. */
	static horizontal: boolean;

	/** `.control-input` element — base_input.js:51. */
	input_area: HTMLElement;
	/** The `<label>` element — base_input.js:49. */
	label_area?: HTMLElement;
	/** Same node as `label_area` — base_input.js:49. */
	label_span?: HTMLElement;
	/** `.control-input-wrapper` — base_input.js:52. */
	$input_wrapper?: JQuery<HTMLElement>;
	/** `.control-value` read-only display area — base_input.js:55. */
	disp_area?: HTMLElement;
	/** The `<input>`, once `make_input()` has run — controls/data.js:65. */
	$input?: JQuery<HTMLInputElement>;
	/** `this.$input.get(0)` — controls/data.js:65. */
	input?: HTMLInputElement;
	/** Latched by `make_input()` — controls/data.js:66. */
	has_input?: boolean;

	/** base_input.js:40-42. */
	toggle_label(show: boolean): void;
	/** base_input.js:43-45. */
	toggle_description(show: boolean): void;
	/** base_input.js:46-58. */
	set_input_areas(): void;
	/** base_input.js:59-69. Ctrl/Cmd-K opens the navbar search. */
	setup_shortcut(): void;
	/** base_input.js:70-74. */
	set_max_width(): void;
	/** base_input.js:76-82. */
	read_only_because_of_fetch_from(): unknown;
	/** base_input.js:84-153. */
	refresh_input(): void;
	/** base_input.js:155-157. */
	can_write(): boolean;
	/** base_input.js:159-188. */
	set_disp_area(value: unknown): void;
	/** base_input.js:189-201. */
	set_label(label?: string): void;
	/** base_input.js:202-210. */
	show_description_on_click(): void;
	/** base_input.js:211-229. */
	set_doc_url(): void;
	/** base_input.js:231-259. */
	set_description(description?: string): void;
	/** base_input.js:260-263. */
	set_new_description(description: string): void;
	/** base_input.js:264-267. */
	set_empty_description(): void;
	/** base_input.js:268-277. */
	set_mandatory(value: unknown): void;
	/** base_input.js:278-287. */
	set_invalid(): void;
	/** base_input.js:288-290. */
	set_required(): void;
	/** base_input.js:291-298. */
	set_bold(): void;
}

/**
 * `frappe.ui.form.ControlTable` — controls/table.js:3.
 *
 * The child-table control, and the **only** place in core that constructs a
 * `Grid` (controls/table.js:8). Assigned as a class expression extending
 * `frappe.ui.form.Control`, so it is not otherwise nameable as a type.
 *
 * `ControlTable.prototype.make` is a documented prototype-patch point: the
 * constructor builds no DOM of its own beyond `super.make()`, and `Grid.make()`
 * is lazy (called from `Grid#refresh` via `!this.wrapper && this.make()`,
 * grid.js:502), so a patch that lets the original run and then replaces
 * `this.grid` discards nothing. Inside such a patch `this` is a `ControlTable`:
 *
 * ```ts
 * const orig = frappe.ui.form.ControlTable.prototype.make;
 * frappe.ui.form.ControlTable.prototype.make = function (this: ControlTable) {
 *   orig.call(this);
 *   this.grid = new MyGrid({ frm: this.frm, df: this.df, parent: this.wrapper, control: this });
 * };
 * ```
 */
export declare class ControlTable extends BaseControl {
	/** controls/table.js:8. Reassignable — this is the swap point. */
	grid: Grid;

	/**
	 * controls/table.js:4-110. Calls `super.make()`, constructs the `Grid`,
	 * registers itself in `frm.grids` (:16) and installs the ~90-line
	 * clipboard-paste handler (:19), which reads `this.grid` at event time
	 * rather than closing over it.
	 */
	make(): void;
	/**
	 * controls/table.js:111-133. Resolves a pasted column header (fieldname,
	 * label or translated label) to a fieldname; `undefined` when nothing
	 * matches.
	 */
	get_field(field_name: string): string | undefined;
	/** controls/table.js:134-136. */
	refresh_input(): void;
	/** controls/table.js:137-141. `undefined` before `make()` has run. */
	get_value(): ChildDoc[] | undefined;
	/** controls/table.js:142-144. Deliberately empty. */
	set_input(): void;
	/** controls/table.js:145-147. Returns `get_value()`. */
	validate(): ChildDoc[] | undefined;
	/** controls/table.js:148-150. Clicks the header select-all checkbox. */
	check_all_rows(): void;
}

/**
 * `frappe.ui.form.make_control` — controls/control.js:47-54.
 *
 * Builds `"Control" + df.fieldtype.replace(/ /g, "")` and news it up. Returns
 * `undefined` (after a `console.log`, not a throw) when no such class exists —
 * `Layout#make_field` explicitly handles that case (layout.js:235-236).
 */
export declare function make_control(opts: ControlOptions): BaseControl | undefined;

/* ========================================================================== *
 * Layout (form/layout.js) and its parts
 * ========================================================================== */

/**
 * Anything that can land in `Layout#fields_dict` / `fields_list`.
 *
 * This union is not defensive typing — `make_section` really does put a
 * `Section` into both collections under its (possibly auto-generated
 * `__section_N`) fieldname (layout.js:333-335), and `make_column` pushes a
 * `Column` into `fields_list` (layout.js:348). Narrow with
 * `instanceof ControlTable` / `instanceof Section` when you need a specific one;
 * that works because these are real classes on `frappe.ui.form`.
 */
export type LayoutFieldObject = BaseControl | Section | Column;

/** Constructor options for `frappe.ui.form.Layout` — merged by `$.extend`. */
export interface LayoutOptions {
	/** Where the layout appends `.form-layout`. `body` is used if unset. */
	parent?: HTMLElement | JQuery;
	/** Alternative to `parent` — layout.js:22-24. */
	body?: HTMLElement | JQuery;
	doctype?: string;
	doctype_layout?: DocTypeMeta;
	frm?: Form;
	doc?: FrappeDoc | ChildDoc;
	/** Explicit field list; otherwise taken from the DocType meta. */
	fields?: DocField[];
	/** Set by `GridRowForm#render` — grid_row_form.js:17-20. */
	grid?: Grid;
	grid_row?: GridRow;
	grid_row_form?: GridRowForm;
	/** Grid row forms set this; it changes tab activation — layout.js:445. */
	is_child_table?: boolean;
	/** Dialogs set this; it gates `set_mandatory` — base_input.js:275. */
	is_dialog?: boolean;
	card_layout?: boolean;
	with_dashboard?: boolean;
	no_submit_on_enter?: boolean;
	[option: string]: unknown;
}

/**
 * `frappe.ui.form.Layout` — layout.js:5.
 *
 * Note the constructor does **not** build DOM; callers must call `make()`
 * (form.js:242, grid_row_form.js:23).
 */
export declare class Layout {
	constructor(opts: LayoutOptions);

	// ---- initialised in the constructor (layout.js:7-16) ----
	views: Record<string, unknown>;
	pages: JQuery[];
	tabs: Tab[];
	sections: Section[];
	page_breaks: JQuery[];
	sections_dict: Record<string, Section>;
	fields_list: LayoutFieldObject[];
	/** See {@link LayoutFieldObject} — sections share this map with controls. */
	fields_dict: Record<string, LayoutFieldObject>;
	section_count: number;
	column_count: number;

	// ---- merged from opts ----
	parent?: HTMLElement | JQuery;
	body?: HTMLElement | JQuery;
	doctype?: string;
	doctype_layout?: DocTypeMeta;
	doc?: FrappeDoc | ChildDoc;
	frm?: Form;
	grid?: Grid;
	grid_row?: GridRow;
	grid_row_form?: GridRowForm;
	is_child_table?: boolean;
	is_dialog?: boolean;
	card_layout?: boolean;
	/**
	 * Set by `FieldGroup` — and therefore by `Dialog`;
	 * `evaluate_depends_on_value` falls back to it (layout.js:787).
	 *
	 * Returns **`null`**, not a partial object, when a required field is empty or
	 * a field is flagged invalid (field_group.js:177, :190) — every caller in
	 * frappe guards with `if (!values) return;` (dialog.js:244-245).
	 */
	get_values?: (
		ignore_errors?: boolean,
		check_invalid?: boolean
	) => Record<string, unknown> | null;

	// ---- built by make() ----
	/** `.form-layout` — layout.js:25. */
	wrapper: JQuery<HTMLElement>;
	/** `.form-message-container` — layout.js:26. */
	message: JQuery<HTMLElement>;
	/** The current `.form-page`; replaced by `make_page_break()`. */
	page: JQuery<HTMLElement>;
	fields: DocField[];
	/** `.form-tabs` `<ul>` — layout.js:49, tabbed layouts only. */
	tab_link_container?: JQuery<HTMLElement>;
	/** `.form-tab-content` — layout.js:50, tabbed layouts only. */
	tabs_content?: JQuery<HTMLElement>;
	/** The section/column/tab currently being filled by `render()`. */
	section: Section | null;
	column: Column | null;
	current_tab?: Tab;
	/** `.btn-fold` handle — layout.js:294. */
	fold_btn?: JQuery<HTMLElement>;
	folded?: boolean;

	/** layout.js:21-41. Builds the DOM and calls `render()`. */
	make(): void;
	/** layout.js:43-54. */
	setup_tabbed_layout(): void;
	/** layout.js:56-66. */
	get_doctype_fields(): DocField[];
	/** layout.js:69-89. The synthetic hidden `__newname` Data field. */
	get_new_name_field(): DocField;
	/** layout.js:91-99. */
	get_fields_from_layout(): DocField[];
	/**
	 * layout.js:106-139. `color` is one of yellow/blue/red/green/orange.
	 * Passing a falsy `html` clears the block.
	 */
	show_message(html: string | null, color?: string, permanent?: boolean): void;
	/** layout.js:141-197. */
	render(new_fields?: DocField[]): void;
	/** layout.js:200-204. */
	no_opening_section(): boolean;
	/** layout.js:205. A no-op in core; subclasses override it. */
	add_default_tabs(fields?: DocField[]): void;
	/** layout.js:206-208. */
	no_opening_tab(): boolean;
	/**
	 * layout.js:210-212. Returns the first `Tab Break` **docfield**, not a
	 * boolean — every caller uses it for truthiness only.
	 */
	is_tabbed_layout(): DocField | undefined;
	/** layout.js:214-227. */
	replace_field(fieldname: string, df: DocField, render?: boolean): void;
	/** layout.js:229-248. */
	make_field(df: DocField, colspan?: unknown, render?: boolean): void;
	/** layout.js:250-275. `undefined` when `make_control` rejects the fieldtype. */
	init_field(
		df: DocField,
		parent: HTMLElement,
		render?: boolean
	): BaseControl | undefined;
	/** layout.js:277-279. */
	make_page_break(): void;
	/** layout.js:281-309. The "Show more details" fold. */
	make_page(df: DocField): void;
	/** layout.js:311-313. */
	unfold(): void;
	/** layout.js:315-338. Mutates `df` to add a `__section_N` fieldname. */
	make_section(df?: Partial<DocField>): void;
	/** layout.js:340-351. Mutates `df` to add a `__column_N` fieldname. */
	make_column(df?: Partial<DocField>): void;
	/** layout.js:353-360. */
	make_tab(df: DocField): Tab;
	/** layout.js:362-392. */
	refresh(doc?: FrappeDoc | ChildDoc): void;
	/** layout.js:394-398. */
	is_numeric_field_active(): boolean;
	/** layout.js:400-417. */
	refresh_sections(): void;
	/** layout.js:419-430. */
	refresh_tabs(): void;
	/** layout.js:432-442. Matches on tab label or fieldname, case-insensitively. */
	select_tab(label_or_fieldname: string): void;
	/** layout.js:444-472. */
	set_tab_as_active(): void;
	/** layout.js:474-487. */
	refresh_fields(fields: DocField[]): void;
	/** layout.js:489-492. */
	add_fields(fields: DocField[]): void;
	/** layout.js:494-514. */
	refresh_section_collapse(): void;
	/** layout.js:516-530. */
	attach_doc_and_docfields(refresh?: boolean): void;
	/** layout.js:532-567. */
	setup_events(): void;
	/** layout.js:569-580. */
	setup_tab_events(): void;
	/** layout.js:582-599. */
	setup_tooltip_events(): void;
	/** layout.js:601-660. Tab-key navigation between fields and grid rows. */
	handle_tab(doctype: string, fieldname: string, shift?: boolean): void;
	/** layout.js:662-685. `undefined` when no eligible field follows. */
	focus_on_next_field(
		start_idx: number,
		fields: LayoutFieldObject[]
	): boolean | undefined;
	/** layout.js:687-691. */
	is_visible(field: LayoutFieldObject): boolean;
	/** layout.js:693-709. */
	set_focus(field: LayoutFieldObject): void;
	/**
	 * layout.js:711-713 — `$(".grid-row-open").data("grid_row")`.
	 * Identical to `frappe.ui.form.get_open_grid_form` (grid.js:7-9); both read
	 * the same cross-app `.grid-row-open` class contract.
	 */
	get_open_grid_row(): GridRow | undefined;
	/** layout.js:715-752. */
	refresh_dependency(): void;
	/** layout.js:754-782. */
	set_dependant_property(
		condition: DependsOnExpression,
		fieldname: string,
		property: string
	): void;
	/** layout.js:784-824. Returns `undefined` when there is no doc to evaluate against. */
	evaluate_depends_on_value(expression: DependsOnExpression): unknown;
}

/**
 * `Section` — form/section.js:1. Reachable through `Layout#sections`,
 * `Layout#sections_dict` and (under its fieldname) `Layout#fields_dict`.
 */
export declare class Section {
	constructor(
		parent: JQuery,
		df: Partial<DocField> | undefined,
		card_layout: boolean | undefined,
		layout: Layout
	);

	layout: Layout;
	card_layout?: boolean;
	parent: JQuery;
	df: Partial<DocField>;
	columns: Column[];
	fields_list: BaseControl[];
	fields_dict: Record<string, BaseControl>;
	/** `.form-section` / `.form-dashboard-section` — section.js:30. */
	wrapper: JQuery<HTMLElement>;
	/** `.section-body` — section.js:56. */
	body: JQuery<HTMLElement>;
	/** `.section-head`, only when the section has a visible label — section.js:64. */
	head?: JQuery<HTMLElement>;
	/** `.collapse-indicator` — section.js:72. */
	indicator?: JQuery<HTMLElement>;
	description_wrapper?: JQuery<HTMLElement>;
	/**
	 * A shim so a Section quacks like a GridRow for shared code paths —
	 * section.js:21-23 (`this.row = { wrapper: this.wrapper }`).
	 */
	row: { wrapper: JQuery<HTMLElement> };
	expanded_by_user?: boolean;

	make(): void;
	make_head(): void;
	refresh(hide?: boolean): void;
	collapse(hide?: boolean): void;
	is_collapsed(): boolean;
	has_missing_mandatory(): boolean;
	add_field(fieldobj: BaseControl): void;
	replace_field(fieldname: string, fieldobj: BaseControl): void;
}

/** `Column` — form/column.js:1. Pushed into `Layout#fields_list`. */
export declare class Column {
	constructor(section: Section, df?: Partial<DocField>);

	df: Partial<DocField>;
	section: Section;
	/** `.form-column` — column.js:13. */
	wrapper: JQuery<HTMLElement>;
	/** The inner `<form>`; `Layout#make_field` appends controls to it. */
	form: JQuery<HTMLFormElement>;

	make(): void;
	/** column.js:39-60. Redistributes `col-sm-N` across visible columns. */
	resize_all_columns(): void;
	/** column.js:62. Deliberately empty — Column tracks nothing. */
	add_field(): void;
	refresh(): void;
}

/** `Tab` — form/tab.js:7. */
export declare class Tab {
	constructor(
		layout: Layout,
		df: DocField,
		frm: Form | undefined,
		tab_link_container: JQuery,
		tabs_content: JQuery
	);

	layout: Layout;
	df: DocField;
	frm?: Form;
	doctype?: string;
	label?: string;
	hidden: boolean;
	/** `${scrub(doctype)}-${df.fieldname}` — tab.js:26. */
	id: string;
	/** The `<li class="nav-item">` — tab.js:30. */
	tab_link: JQuery<HTMLElement>;
	/** The `.tab-pane` — tab.js:44. */
	wrapper: JQuery<HTMLElement>;
	fields_list: BaseControl[];
	sections: Section[];

	make(): void;
	refresh(): void;
	setup_listeners(): void;
	set_active(): void;
	is_active(): boolean;
	is_hidden(): boolean;
	add_field(fieldobj: BaseControl): void;
	replace_field(fieldobj: BaseControl): void;
	toggle(show: boolean): void;
}

/* ========================================================================== *
 * Grid / GridRow / GridRowForm / GridPagination — RE-EXPORTED, not redeclared
 * ========================================================================== */

/**
 * SEAM RESOLUTION — the Grid family was declared TWICE, here and in
 * `deep-modules.d.ts`, and the two copies disagreed under
 * `exactOptionalPropertyTypes` (TS2430 on `GridDocField#documentation_url` and
 * `GridDocField#allow_bulk_edit`).
 *
 * **`deep-modules.d.ts` won ownership.** Three reasons, in order of weight:
 *
 * 1. It is the fragment the classes actually belong to. `Grid`, `GridRow`,
 *    `GridRowForm` and `GridPagination` are ES-module DEFAULT exports with no
 *    global alias (`grid.js:21`, `grid_row.js:9`, `grid_row_form.js:1`,
 *    `grid_pagination.js:1`) — there is no `frappe.ui.form.Grid`. The only way
 *    to reach them is the deep import that `deep-modules.d.ts` + `modules.d.ts`
 *    wire up, so that pair has to hold the definitions.
 * 2. A member-by-member diff of the two copies showed `deep-modules.d.ts` to be
 *    a strict SUPERSET: identical member sets for `GridRowForm` (14) and
 *    `GridPagination` (23), one extra member on `GridRow` (`expression`) and
 *    two extra methods on `Grid` (`_apply_mask_overrides`,
 *    `_apply_column_disp_overrides`, grid.js:721-746). NOTHING DECLARED HERE
 *    WAS LOST — every member this copy had that the other lacked was carried
 *    across with its citation before this block replaced them:
 *    - `GridDocField#fields` and `GridDocField#allow_bulk_edit` are now
 *      INHERITED, from `model.d.ts`'s `DocField` (`fields?: DocField[]` at
 *      model.d.ts:399 citing grid.js:710; `allow_bulk_edit?: FrappeCheck` at
 *      model.d.ts:291). Redeclaring them on `GridDocField` is what produced the
 *      TS2430 in the first place — see reason 3.
 *    - `GridFieldInfo#get_query` is declared on the surviving copy.
 *    - `GridColumn`, `GridFilter`, `GridOptions` and `GridRowOptions` diffed
 *      member-for-member identical.
 * 3. The two TS2430s (`GridDocField incorrectly extends DocField`) were a
 *    value-range conflict, not a style one, and the surviving copy resolves
 *    them the way gaps.md §2g requires: `documentation_url` is `?: string` on
 *    both sides, and `allow_bulk_edit` is no longer redeclared at all, so it
 *    keeps `DocField`'s `FrappeCheck` (`0 | 1`) — the wire format frappe
 *    actually sends. The one grid docfield flag that JS really does assign a
 *    boolean to, `is_web_form` (`web_form/webform_script.js:61`, `:76` assign
 *    `true`), uses `FrappeCheckLoose` instead. Optionality is spelled plain
 *    `?: T` throughout, matching the other eight files and the tsconfig's
 *    intent.
 *
 * They are re-exported from here so that both import paths keep working:
 * `import type { Grid } from "frappe-types"` resolves to exactly the same type
 * as `import Grid from "frappe/public/js/frappe/form/grid"`.
 */
export type {
	Grid,
	GridColumn,
	GridDocField,
	GridFieldInfo,
	GridFilter,
	GridOptions,
	GridPagination,
	GridRow,
	GridRowForm,
	GridRowOptions,
} from "../deep-modules";

/**
 * The payload `GridRow#set_data` writes onto its wrapper with `.data()`
 * (grid_row.js:67-71). This is the contract behind
 * `$(".grid-row-open").data("grid_row")` (grid.js:8, layout.js:712,
 * ui/keyboard.js:335) and `$(e.target).closest(".grid-row").data("name")`.
 *
 * Note `doc` is `""` — not `undefined` — for header and search rows.
 *
 * Declared HERE and not in `deep-modules.d.ts`: it is a jQuery `.data()`
 * contract consumed by `frappe.ui.form`'s own DOM code, and it is the type the
 * `JQuery#data("grid_row")` overload described in `globals.d.ts` is written
 * against.
 */
export interface GridRowJQueryData {
	grid_row: GridRow;
	doc: ChildDoc | "";
}

/* ========================================================================== *
 * Toolbar (form/toolbar.js)
 * ========================================================================== */

/** The states `Toolbar#get_action_status` can return — toolbar.js:765-786. */
export type ToolbarActionStatus =
	| "Edit"
	| "Submit"
	| "Save"
	| "Update"
	| "Cancel"
	| "Amend";

/**
 * `frappe.ui.form.Toolbar` — form/toolbar.js:7.
 *
 * Everything on the instance arrives through `$.extend(this, opts)`
 * (toolbar.js:9); the constructor then immediately calls `refresh()`, so a
 * Toolbar is never observed un-refreshed.
 */
export declare class Toolbar {
	constructor(opts: { frm: Form; page: Page; [option: string]: unknown });

	frm: Form;
	page: Page;
	/** Last status handed to `set_page_actions` — toolbar.js:848, cleared to `null` at :762. */
	current_status: ToolbarActionStatus | null;

	/** toolbar.js:13-41. */
	refresh(): void;
	/**
	 * toolbar.js:42-78. Among other things this is what toggles the
	 * `editable-title` class on `page.$title_area` (:72-75) — the class other
	 * code keys "this document can be renamed" off. It runs from
	 * `frm.refresh() → toolbar.refresh()`, i.e. **asynchronously** relative to
	 * the page container becoming visible.
	 */
	set_title(): void;
	/** toolbar.js:80-103. */
	is_title_editable(): boolean;
	/** toolbar.js:105-107. */
	can_rename(): boolean;
	/** toolbar.js:108-113. */
	show_unchanged_document_alert(): void;
	/** toolbar.js:114-199. */
	rename_document_title(
		input_name?: string,
		input_title?: string,
		merge?: boolean
	): Promise<unknown>;
	/**
	 * toolbar.js:201-217. Adds the sidebar pencil icon to `element` (when the
	 * document is renameable) and wires it to
	 * {@link Toolbar.setup_editable_title_click_event}.
	 */
	setup_editable_title(element: JQuery): void;
	/**
	 * toolbar.js:219-301. Binds the rename dialog to `element` with
	 * `element.off("click").on("click", …)` — so re-running it on the same
	 * element is **idempotent**, and it is safe to point a second affordance
	 * (e.g. the page heading) at the same handler.
	 *
	 * The parameter must be a jQuery object: the body calls `.off()` / `.on()`
	 * on it directly.
	 */
	setup_editable_title_click_event(element: JQuery): void;
	/** toolbar.js:303-305. */
	get_dropdown_menu(label: string): JQuery;
	/** toolbar.js:306-322. */
	set_indicator(): void;
	/** toolbar.js:324-333. */
	make_menu(): void;
	/** toolbar.js:335-355. */
	make_navigation(): void;
	/** toolbar.js:357-378. */
	make_menu_items(): void;
	/** toolbar.js:674-676. */
	can_repeat(): boolean;
	/** toolbar.js:677-679. */
	can_save(): boolean;
	/** toolbar.js:680-689. */
	can_submit(): boolean;
	/** toolbar.js:690-697. */
	can_update(): boolean;
	/** toolbar.js:698-700. */
	can_cancel(): boolean;
	/** toolbar.js:701-703. */
	can_amend(): boolean;
	/** toolbar.js:704-708. */
	has_workflow(): boolean;
	/** toolbar.js:709-711. */
	get_docstatus(): number;
	/** toolbar.js:712-719. */
	show_linked_with(): void;
	/** toolbar.js:720-763. */
	set_primary_action(dirty?: boolean): void;
	/** toolbar.js:765-786. `null` when no action applies. */
	get_action_status(): ToolbarActionStatus | null;
	/** toolbar.js:787-849. */
	set_page_actions(status: ToolbarActionStatus): void;
	/** toolbar.js:850-863. */
	add_update_button_on_dirty(): void;
	/** toolbar.js:864-873. */
	show_title_as_dirty(): void;
	/** toolbar.js:874-914. */
	show_jump_to_field_dialog(): void;
	/** toolbar.js:915-958. */
	scroll_to_grid_field(
		grid_form: GridRowForm,
		fieldname: string,
		focus?: boolean
	): void;
	/** toolbar.js:959-967. */
	setup_sidebar_toggle(sidebar_wrapper: JQuery): void;
	/** toolbar.js:968-987. */
	setup_overlay_sidebar(sidebar_wrapper: JQuery): void;
	/** toolbar.js:988-1008. */
	follow(): void;
	/** toolbar.js:1009-1015. */
	get_follow_text(follow: boolean): string;
	/** toolbar.js:1016-1019. */
	refresh_follow(follow?: boolean): void;
}

/* ========================================================================== *
 * FieldGroup and Dialog (ui/field_group.js, ui/dialog.js)
 *
 * OWNERSHIP NOTE — `Dialog` was imported by `core.d.ts`, `globals.d.ts` and
 * `deep-modules.d.ts` and declared by NO fragment (TS2303 circular alias +
 * TS2459). It lives here because `frappe.ui.Dialog extends frappe.ui.FieldGroup
 * extends frappe.ui.form.Layout` (dialog.js:10, field_group.js:5) and `Layout`
 * is this file's; putting it anywhere else would need a second import cycle
 * through the base class.
 * ========================================================================== */

/**
 * `frappe.ui.FieldGroup` — field_group.js:5. A `Layout` that owns its own
 * values, rather than reading them off a `frm.doc`.
 *
 * `$.extend(this, opts)` runs in `Layout`'s constructor (layout.js:18), so every
 * key of {@link LayoutOptions} lands on the instance verbatim here too.
 */
export declare class FieldGroup extends Layout {
	constructor(opts?: LayoutOptions);

	/** field_group.js:8, flipped by the `change`/`input` handlers at :90-99. */
	dirty: boolean;
	/**
	 * field_group.js:9, populated by {@link FieldGroup.add_fetch} at :283-284
	 * as `fetch_dict[target_doctype][link_field][target_field] = source_field`.
	 */
	fetch_dict: Record<string, Record<string, Record<string, string>>>;
	/** From `opts` — applied by `set_values()` in the constructor (field_group.js:16-18). */
	values?: Record<string, unknown>;
	/** From `opts` — field_group.js:82 skips {@link FieldGroup.catch_enter_as_submit}. */
	no_submit_on_enter?: boolean;
	/** From `opts` — field_group.js:104 makes {@link FieldGroup.focus_on_first_input} a no-op. */
	no_focus?: boolean;
	/** Set by `Dialog#set_primary_action` (dialog.js:235); read at field_group.js:119. */
	has_primary_action?: boolean;

	/**
	 * field_group.js:21-40. Resolves the `"Today"` / `"Now"` default keywords for
	 * Date/Datetime/Time. A falsy input is returned unchanged (field_group.js:22).
	 */
	resolve_date_default_keywords(
		def_value: string | null | undefined,
		fieldtype?: string
	): string | null | undefined;

	/**
	 * field_group.js:42-62. Resolves one field's `df.default`, expanding
	 * `"__user"` / `"user"` to `frappe.session.user` and `"user_fullname"` to
	 * `frappe.session.user_fullname`. Returns `undefined` for a nullish or
	 * non-numeric-empty default (field_group.js:45-49).
	 */
	get_field_default_value(field: LayoutFieldObject): unknown;

	/**
	 * field_group.js:64-101.
	 *
	 * **A no-op when `this.fields` is falsy** (field_group.js:66) — it never calls
	 * `super.make()`, so `Layout#wrapper` / `#message` / `#page` are never
	 * assigned on a field-less FieldGroup or Dialog. See the note on
	 * {@link Dialog}.
	 */
	override make(): void;

	/** field_group.js:103-111. Focuses the first non-Date/Datetime/Time/Check control. */
	focus_on_first_input(): void;
	/** field_group.js:113-125. Binds Enter on text inputs to the primary button. */
	catch_enter_as_submit(): void;
	/**
	 * field_group.js:127-131 — the control's `txt` element if it has one, else its
	 * `input`, wrapped in jQuery. Returns the **empty string** `""`, not a jQuery
	 * object, for an unknown fieldname (field_group.js:129).
	 */
	get_input(fieldname: string): JQuery | "";
	/** field_group.js:133-135 — a raw `fields_dict` lookup, so a miss is `undefined`. */
	get_field(fieldname: string): LayoutFieldObject | undefined;
	/**
	 * field_group.js:137-193. Collects every control's `get_value()`.
	 *
	 * Returns **`null`** (after `frappe.msgprint`) when a `reqd` field is empty
	 * and `ignore_errors` is falsy (:167-178), or when a field carries
	 * `df.invalid` and `check_invalid` is set (:180-191). Keys are omitted
	 * entirely for null-ish values (:155), so the result is a partial map.
	 */
	override get_values: (
		ignore_errors?: boolean,
		check_invalid?: boolean
	) => Record<string, unknown> | null;
	/** field_group.js:195-198 — `null` when the field exists but has no `get_value`. */
	get_value(key: string): unknown;
	/** field_group.js:200-213. Resolves immediately when the fieldname is unknown. */
	set_value(key: string, val: unknown): Promise<void>;
	/** field_group.js:215-217. */
	has_field(fieldname: string): boolean;
	/** field_group.js:219-221 — an alias of {@link FieldGroup.set_value}. */
	set_input(key: string, val: unknown): Promise<void>;
	/** field_group.js:223-232. Silently skips keys with no matching field. */
	set_values(dict: Record<string, unknown>): Promise<void[]>;
	/** field_group.js:234-241. Resets every control to its `df.default` or `""`. */
	clear(): void;
	/**
	 * field_group.js:243-250. **Throws** on an unknown fieldname — `get_field`
	 * returns `undefined` and `field.df[prop]` is then a TypeError. A falsy
	 * `fieldname` returns early (:244-246).
	 */
	set_df_property(fieldname: string, prop: string, value: unknown): void;
	/**
	 * field_group.js:252-265. Two arities: `(fieldname, query)` on the parent, or
	 * `(fieldname, parent_fieldname, query)` to reach into a child table's grid.
	 */
	set_query(fieldname: string, query: unknown): void;
	set_query(fieldname: string, parent_fieldname: string, query: unknown): void;
	/** field_group.js:268-285. `target_doctype` defaults to `"*"`. */
	add_fetch(
		link_field: string,
		source_field: string,
		target_field: string,
		target_doctype?: string
	): void;
	/** field_group.js:287-289 — `this.doc.__islocal`; throws when there is no `doc`. */
	is_new(): boolean | undefined;
}

/** The modal width classes `Dialog#set_modal_size` picks from — dialog.js:170-193. */
export type DialogSize = "small" | "large" | "extra-large" | "";

/**
 * The `action` bag an older dialog API passes instead of
 * `primary_action` / `secondary_action` — read at dialog.js:69-90.
 */
export interface DialogActions {
	primary: { label?: string; onsubmit?: (values: Record<string, unknown>) => void };
	secondary: { label?: string };
}

/**
 * Constructor options for `frappe.ui.Dialog`.
 *
 * `Dialog` merges defaults and then `opts` with a single `$.extend`
 * (dialog.js:17-27) and `Layout`'s constructor `$.extend`s again
 * (layout.js:18), so anything else you pass lands on the instance — hence the
 * open index signature, inherited from {@link LayoutOptions}.
 */
export interface DialogOptions extends LayoutOptions {
	/** dialog.js:270 — set as the `.modal-title` HTML, not text. */
	title?: string;
	/**
	 * dialog.js:44 — when omitted, {@link Dialog.set_modal_size} derives it from
	 * the number of Column Breaks between Section Breaks.
	 */
	size?: DialogSize | null;
	/** dialog.js:20 — adds the Bootstrap `fade` class on `show()`. Defaults to `true`. */
	animate?: boolean;
	/** dialog.js:22 — call `make()` from the constructor. Defaults to `true`. */
	auto_make?: boolean;
	/** dialog.js:23 — adds `modal-dialog-centered`. Defaults to `false`. */
	centered?: boolean;
	/**
	 * dialog.js:24, read at dialog.js:107 — when `false` (the default), hiding the
	 * dialog also closes any open grid detail form.
	 */
	keep_grid_form_open?: boolean;
	/** dialog.js:36-42 — `backdrop: "static"`, no keyboard dismiss, close button hidden. */
	static?: boolean;
	/** dialog.js:277-283 — an indicator colour class on `.modal-header .indicator`. */
	indicator?: string;
	/** dialog.js:92-99 — shows the minimize button. */
	minimizable?: boolean;
	/** dialog.js:70-76. Called with the result of `get_values()`, `this` bound to the dialog. */
	primary_action?: (values: Record<string, unknown>) => void;
	/** dialog.js:72 — defaults to `__("Submit")`. */
	primary_action_label?: string;
	/** dialog.js:79-81 — bound directly as the secondary button's click handler. */
	secondary_action?: (event: JQuery.ClickEvent) => void;
	/** dialog.js:83-90. */
	secondary_action_label?: string;
	/** dialog.js:69-90 — the alternative to `primary_action`/`secondary_action`. */
	action?: DialogActions;
	/** dialog.js:121 — fired from `hide.bs.modal`. Both spellings are checked. */
	onhide?: () => void;
	/** dialog.js:122 — fired from `hide.bs.modal`. */
	on_hide?: () => void;
	/** dialog.js:131 — fired from `shown.bs.modal`. */
	on_page_show?: () => void;
	/** dialog.js:357 — fired by {@link Dialog.toggle_minimize}. */
	on_minimize_toggle?: (is_minimized: boolean) => void;
}

/**
 * `frappe.ui.Dialog` — dialog.js:10
 * (`frappe.ui.Dialog = class Dialog extends frappe.ui.FieldGroup`, a class
 * EXPRESSION, so this declaration is the only way to name the type).
 *
 * Holder of `frappe.msg_dialog`, `frappe.error_dialog`, `frappe.cur_progress`
 * and the `window.cur_dialog` slot (dialog.js:115-119, :127).
 *
 * ### `wrapper` hazard — the one member this declaration cannot narrow
 *
 * `dialog.js:46` assigns the raw `.modal-dialog` **element**
 * (`this.$wrapper.find(".modal-dialog").get(0)`) to `this.wrapper`, and
 * `super.make()` (dialog.js:64) then replaces it with `Layout#make`'s jQuery
 * `.form-layout` handle (layout.js:25) — but `FieldGroup#make` is a no-op when
 * the dialog has no `fields` (field_group.js:66), so a field-less Dialog keeps
 * an `HTMLElement` there. The inherited declaration says
 * `JQuery<HTMLElement>`; it is **not** redeclared here because widening an
 * inherited member is not expressible, and narrowing it would be a lie in the
 * other direction. Wrap reads in `$(...)`, which accepts both and is idempotent
 * — exactly what dialog.js:47-50 does. Use {@link Dialog.$wrapper}, the modal
 * root, whenever you can: it is always a jQuery handle.
 *
 * ### `is_visible` is clobbered at runtime, and is therefore NOT declared here
 *
 * `Layout#is_visible(field)` is a **method** (layout.js:687-691). `Dialog#show`
 * and `Dialog#hide` assign a **boolean** to the same name (dialog.js:310, :316),
 * shadowing it with an own property. That is an upstream defect, not a type
 * modelling choice: once a dialog has been shown, `Layout#set_focus`'s
 * `this.is_visible(field)` call (layout.js:706) throws
 * `is_visible is not a function`. A `.d.ts` cannot widen an inherited method to
 * `boolean`, and pretending either half does not exist would be a lie, so this
 * declaration leaves the inherited method visible and says so here.
 * **Read {@link Dialog.display} instead** — dialog.js:13, :104, :126 keep it in
 * sync with `shown.bs.modal` / `hide.bs.modal` and nothing shadows it.
 */
export declare class Dialog extends FieldGroup {
	constructor(opts?: DialogOptions);

	// ---- constructor (dialog.js:13-27) ----
	/** dialog.js:13, :104, :126 — `true` between `shown.bs.modal` and `hide.bs.modal`. */
	display: boolean;
	/** dialog.js:14. Read by `base_input.js:275` to skip mandatory styling. */
	override is_dialog: boolean;
	/** dialog.js:15, :323 — the element focus returns to on close. */
	last_focus: HTMLElement | null;
	/** dialog.js:20. */
	animate: boolean;
	/** dialog.js:21, then computed by {@link Dialog.set_modal_size} (dialog.js:44). */
	size: DialogSize | null;
	/** dialog.js:22. */
	auto_make: boolean;
	/** dialog.js:23. */
	centered: boolean;
	/** dialog.js:24, read at dialog.js:107. */
	keep_grid_form_open: boolean;

	// ---- merged from opts ----
	static?: boolean;
	title?: string;
	indicator?: string;
	minimizable?: boolean;
	primary_action?: (values: Record<string, unknown>) => void;
	primary_action_label?: string;
	secondary_action?: (event: JQuery.ClickEvent) => void;
	secondary_action_label?: string;
	action?: DialogActions;
	onhide?: () => void;
	on_hide?: () => void;
	on_page_show?: () => void;
	on_minimize_toggle?: (is_minimized: boolean) => void;

	// ---- built by make() (dialog.js:33-61) ----
	/** dialog.js:34 — `frappe.get_modal("", "")`; the `.modal` root. */
	$wrapper: JQuery<HTMLElement>;
	/** dialog.js:53 — `.modal-body`. */
	modal_body: JQuery<HTMLElement>;
	/** dialog.js:54 — the `<div>` inside `.modal-body` that holds the form. */
	$body: JQuery<HTMLElement>;
	/** dialog.js:56 — `.modal-message`, shown by {@link Dialog.set_message}. */
	$message: JQuery<HTMLElement>;
	/** dialog.js:57 — `.modal-header`. */
	header: JQuery<HTMLElement>;
	/** dialog.js:58 — `.modal-footer`. */
	footer: JQuery<HTMLElement>;
	/** dialog.js:59 — `.standard-actions` inside the footer. */
	standard_actions: JQuery<HTMLElement>;
	/** dialog.js:60 — `.custom-actions` inside the footer. */
	custom_actions: JQuery<HTMLElement>;
	/** dialog.js:205 — present only between `set_alert` and `clear_alert`. */
	$alert?: JQuery<HTMLElement>;

	// ---- runtime flags ----
	/** dialog.js:105, :303, :354. */
	is_minimized?: boolean;
	/** dialog.js:240, reset at :309 — gates `frappe.confirm`'s reject action. */
	primary_action_fulfilled?: boolean;

	/** dialog.js:33-168. Builds the modal and binds every Bootstrap event. */
	override make(): void;
	/** dialog.js:170-193. Picks `""` / `"large"` / `"extra-large"` from the Column Break count. */
	set_modal_size(): void;
	/** dialog.js:195-197 — `.btn-primary` inside `.standard-actions`. */
	get_primary_btn(): JQuery<HTMLElement>;
	/** dialog.js:199-201 — `.btn-modal-minimize`. */
	get_minimize_btn(): JQuery<HTMLElement>;
	/** dialog.js:334-336 — `.btn-modal-close`. */
	get_close_btn(): JQuery<HTMLElement>;
	/** dialog.js:338-340 — `.btn-modal-secondary`. */
	get_secondary_btn(): JQuery<HTMLElement>;
	/** dialog.js:203-209. `text` is injected as raw HTML into the alert div. */
	set_alert(text: string, alert_class?: string): void;
	/** dialog.js:211-215. */
	clear_alert(): void;
	/** dialog.js:217-221. Hides the form body and shows the message instead. */
	set_message(text: string): void;
	/** dialog.js:223-226. */
	clear_message(): void;
	/** dialog.js:228-231 — `super.clear()` plus {@link Dialog.clear_message}. */
	override clear(): void;
	/**
	 * dialog.js:233-250. Returns the button. `click` is invoked with
	 * `[values]` from `get_values()` and **skipped entirely when that is falsy**
	 * (dialog.js:244-245); `label` is set as HTML.
	 */
	set_primary_action(
		label: string,
		click?: (values: Record<string, unknown>) => void
	): JQuery<HTMLElement>;
	/** dialog.js:252-255. */
	set_secondary_action(click: (event: JQuery.ClickEvent) => void): JQuery<HTMLElement>;
	/** dialog.js:257-259. `label` is set as HTML. */
	set_secondary_action_label(label: string): void;
	/** dialog.js:261-263. */
	disable_primary_action(): void;
	/** dialog.js:265-267. */
	enable_primary_action(): void;
	/** dialog.js:269-271. */
	make_head(): void;
	/** dialog.js:273-275 — sets `.modal-title` as **HTML**, not text. */
	set_title(t: string): void;
	/** dialog.js:277-284. */
	set_indicator(): void;
	/** dialog.js:286-312. Returns `this`, so `new frappe.ui.Dialog(o).show()` chains. */
	show(): this;
	/** dialog.js:314-317. */
	hide(): void;
	/** dialog.js:319-332. Remembers `document.activeElement` on a Form route. */
	handle_focus(): void;
	/** dialog.js:342-344 — hides the close button. */
	no_cancel(): void;
	/** dialog.js:346-348 — clicks the close button. */
	cancel(): void;
	/** dialog.js:350-360. */
	toggle_minimize(): void;
	/** dialog.js:362-364 — toggles `overflow` on `<body>`. */
	hide_scrollbar(bool: boolean): void;
	/** dialog.js:366-376. `label` is injected as raw HTML. */
	add_custom_action(
		label: string,
		action?: (event: JQuery.ClickEvent) => void,
		css_class?: string | null
	): void;
	/** dialog.js:378 — declared and deliberately empty upstream. */
	add_custom_button(): void;
}

/* ========================================================================== *
 * Form (form/form.js)
 * ========================================================================== */

/** `frappe.ui.form.Controller` — form.js:18. The base of every client script. */
export declare class FormController {
	constructor(opts: { frm: Form; [option: string]: unknown });
	frm: Form;
	/** Set while `onload` is running; suppresses mandatory styling (base_input.js:270). */
	is_onload?: boolean;
	[key: string]: unknown;
}

/**
 * `frappe.ui.form.Form` (class name `FrappeForm`) — form.js:24.
 *
 * Unusually for this slice the constructor takes **positional** arguments, not
 * an options bag (form.js:25).
 */
export declare class Form {
	constructor(
		doctype: string,
		parent: HTMLElement,
		in_form?: boolean,
		doctype_layout_name?: string
	);

	// ---- constructor (form.js:26-51) ----
	docname: string;
	doctype: string;
	doctype_layout_name?: string;
	in_form: boolean;
	hidden: boolean;
	refresh_if_stale_for: number;
	opendocs: Record<string, boolean>;
	custom_buttons: Record<string, JQuery<HTMLElement>>;
	sections: Section[];
	/** Every `ControlTable` on the form — form.js:35, filled at controls/table.js:16. */
	grids: ControlTable[];
	/** The client-script controller instance — form.js:36. */
	cscript: FormController;
	events: Record<string, unknown>;
	fetch_dict: Record<string, unknown>;
	parent: HTMLElement;
	doctype_layout?: DocTypeMeta;
	undo_manager: UndoManager;
	debounced_reload_doc: () => void;
	beforeUnloadListener: (event: BeforeUnloadEvent) => string;

	// ---- setup_meta() (form.js:54-72) ----
	meta: DocTypeMeta;
	/** `frappe.perm.get_perm(doctype)`, indexed by permlevel — form.js:60. */
	perm: Permission[];
	action_perm_type_map: Record<string, string>;

	// ---- setup() (form.js:74-137) ----
	fields: LayoutFieldObject[];
	/** Shared with `layout.fields_dict` — form.js:246. See {@link LayoutFieldObject}. */
	fields_dict: Record<string, LayoutFieldObject>;
	state_fieldname?: string;
	wrapper: HTMLElement;
	$wrapper: JQuery<HTMLElement>;
	page: Page;
	layout_main: HTMLElement;
	/**
	 * form.js:97. Read defensively by app code because it does not exist until
	 * `setup()` has run — hence optional.
	 */
	toolbar?: Toolbar;
	viewers?: unknown;
	layout: Layout;
	script_manager: ScriptManager;
	dashboard: Dashboard;
	footer?: unknown;
	tour?: unknown;
	states?: unknown;
	form_wrapper?: JQuery<HTMLElement>;
	/** `.std-form-layout` — form.js:227. */
	body?: JQuery<HTMLElement>;

	// ---- per-document state ----
	/** The document being edited; only present once `refresh()` has run. */
	doc: FrappeDoc;
	save_disabled?: boolean;
	/**
	 * The grid row whose detail form is open, or `null`.
	 * Set at grid_row.js:1499 and cleared at :1526 — both guarded on `cur_frm`.
	 */
	cur_grid?: GridRow | null;
	/**
	 * Set around `Layout#set_dependant_property` (layout.js:766-770) and read by
	 * `Grid#refresh` (grid.js:497) to suppress a re-render mid-dependency-pass.
	 */
	setting_dependency?: boolean;
	footnote_area?: JQuery<HTMLElement>;
	__rename_queue?: string;

	// ---- methods (only the stable public surface) ----
	/** form.js:54-72. */
	setup_meta(): void;
	/** form.js:74-137. Builds the page, layout, toolbar and script manager. */
	setup(): void;
	/** form.js:397-477. `docname` switches document first. Also sets `cur_frm = this` (:406). */
	refresh(docname?: string): void;
	/** form.js:533-546. */
	switch_doc(docname: string): void;
	/** form.js:716-727. */
	refresh_fields(): void;
	/** form.js:1462-1469. Refreshes one control plus layout dependencies/sections. */
	refresh_field(fname: string): void;
	/** form.js:792-801. */
	save_or_update(): void;
	/** form.js:802-816. */
	save(
		save_action?: string,
		callback?: (...args: unknown[]) => void,
		btn?: HTMLElement | JQuery,
		on_error?: (...args: unknown[]) => void
	): Promise<unknown>;
	/** form.js:1122-1128. */
	savetrash(): void;
	/** form.js:1451-1460. */
	reload_doc(): Promise<unknown> | undefined;
	/** form.js:1471-1489. */
	add_fetch(
		link_field: string,
		source_field: string,
		target_field: string,
		target_doctype?: string
	): void;
	/** form.js:1490-1492. */
	has_perm(ptype: string): boolean;
	/** form.js:1494-1500. Marks `doc.__unsaved` and fires the `dirty` event. */
	dirty(): void;
	/** form.js:1502-1504. */
	get_docinfo(): unknown;
	/** form.js:1506-1508. */
	is_dirty(): boolean;
	/** form.js:1510-1512. Returns `doc.__islocal`, which is `1 | undefined`. */
	is_new(): 1 | undefined;
	/**
	 * form.js:1521-1523. `this.perm[permlevel]?.[access_type] ?? null` —
	 * returns `null` (not `false`) for an unknown permlevel.
	 */
	get_perm(permlevel: number, access_type: string): boolean | 0 | 1 | null;
	/** form.js:1525-1527. */
	set_intro(txt: string, color?: string): void;
	/** form.js:1529-1531. */
	set_footnote(txt: string): void;
	/** form.js:1533-1542. `group` creates/uses a dropdown. */
	add_custom_button(
		label: string,
		fn: () => void,
		group?: string
	): JQuery<HTMLElement> | undefined;
	/** form.js:1544-1546. */
	change_custom_button_type(label: string, group: string | null, type: string): void;
	/** form.js:1548-1553. */
	clear_custom_buttons(): void;
	/** form.js:1555-1577. */
	remove_custom_button(label: string, group?: string): void;
	/** form.js:1607-1609. */
	get_doc(): FrappeDoc;
	/** form.js:1678-1694. `"*"` maps every field in `fields_dict`. */
	field_map(fnames: string | string[], fn: (df: DocField) => void): void;
	/**
	 * form.js:1696-1705. One argument reads a parent field; two read a child
	 * field of the Table named by the first.
	 */
	get_docfield(fieldname1: string, fieldname2?: string): DocField;
	/**
	 * form.js:1707-1739. Passing `docname` + `table_field` targets a child
	 * docfield; `table_row_name` narrows it to a single row.
	 */
	set_df_property(
		fieldname: string,
		property: string,
		value: unknown,
		docname?: string,
		table_field?: string,
		table_row_name?: string | null
	): void;
	/** form.js:1741-1745. Writes `read_only` as `0 | 1`. */
	toggle_enable(fnames: string | string[], enable: boolean): void;
	/** form.js:1747-1751. Writes `reqd` as a **boolean**, not `0 | 1`. */
	toggle_reqd(fnames: string | string[], mandatory: boolean): void;
	/** form.js:1753-1757. Writes `hidden` as `0 | 1`. */
	toggle_display(fnames: string | string[], show: boolean): void;
	/** form.js:1765-1777. */
	set_query(fieldname: string, opt1: unknown, opt2?: unknown): void;
	/** form.js:1779-1781. */
	clear_table(fieldname: string): void;
	/**
	 * form.js:1783-1804. Appends a child row and returns it. `values` is merged
	 * with `$.extend` **minus** `idx` and `name`, which are never overridden.
	 */
	add_child(fieldname: string, values?: Record<string, unknown>): ChildDoc;
	/** form.js:1805-1870. */
	set_value(
		field: string | Record<string, unknown>,
		value?: unknown,
		if_missing?: boolean,
		skip_dirty_trigger?: boolean
	): Promise<unknown>;
	/** form.js:1871-1921. */
	call(
		opts: string | Record<string, unknown>,
		args?: Record<string, unknown>,
		callback?: (r: unknown) => void
	): Promise<unknown>;
	/** form.js:1922-1924. Same map as `fields_dict`. */
	get_field(field: string): LayoutFieldObject;
	/** form.js:1941-1943. Delegates to `script_manager.trigger`. */
	trigger(event: string, doctype?: string, docname?: string): Promise<unknown>;
	/** form.js:1945-1952. */
	get_formatted(fieldname: string): string;
	/** form.js:1954-1956. Delegates to `frappe.ui.form.get_open_grid_form`. */
	open_grid_row(): GridRow | undefined;
	/** form.js:1958-1960. */
	get_title(): string;
	/** form.js:1962-1980. `[parentfield, name]` pairs of checked child rows. */
	get_selected(): Record<string, string[]>;
	/** form.js:2091-2104. */
	update_in_all_rows(
		table_fieldname: string,
		fieldname: string,
		value: unknown
	): void;
	/** form.js:2105-2112. */
	get_sum(table_fieldname: string, fieldname: string): number;
	/** form.js:2113-2150. */
	scroll_to_field(fieldname: string, focus?: boolean): void;
	/** form.js:2223-2260. */
	set_active_tab(tab: Tab): void;
	/** form.js:2261-2264. */
	get_active_tab(): Tab | undefined;
	/** form.js:1192-1196. */
	enable_save(): void;
	/** form.js:1197-1205. */
	disable_save(set_dirty?: boolean): void;
	/** form.js:1206-1213. */
	disable_form(): void;
}

/**
 * The desk-global "form currently on screen".
 *
 * `window.cur_frm = null` at provide.js:50, set to the active form at
 * form.js:406 (`cur_frm = this;` — a bare assignment to the global), and reset
 * to `null` when leaving a form route (views/pageview.js:106). frappe uses both
 * `cur_frm` and `window.cur_frm` interchangeably, so the globals module should
 * declare **both** a `var cur_frm` and a `Window["cur_frm"]` member with this
 * type.
 */
export type CurFrm = Form | null;

/* ========================================================================== *
 * The frappe.ui.form namespace object itself
 * ========================================================================== */

/**
 * The runtime shape of `frappe.ui.form` (created by
 * `frappe.provide("frappe.ui.form")`, form.js:1).
 *
 * NO INDEX SIGNATURE (gaps.md §1e / §6.14). This interface used to end in
 * `[key: string]: unknown`, which meant a typo — `frappe.ui.form.Dailog`,
 * `frappe.ui.form.ControlLnik` — silently typed as `unknown` instead of being a
 * compile error, defeating the rule `core.d.ts` states for itself ("a typo like
 * `frappe.msgprnt` must still be a compile error"). Every name is enumerated
 * instead, from an exhaustive grep of `frappe/public/js/**` at v16.33.0 for
 * `frappe.ui.form.<name> =` (98 assignments, all of them under
 * `frappe/public/js/frappe/form/**`).
 *
 * WHAT THE ENUMERATION CLAIMS, AND WHAT IT DOES NOT. The NAME of every member
 * below is source-verified — that assignment exists. The TYPE is only as strong
 * as this package has evidence for:
 *
 * - The 50 `Control*` classes are `typeof BaseControl`. Verified: every one is
 *   `class Control… extends frappe.ui.form.Control…`, and every chain
 *   terminates at `frappe.ui.form.Control` (= {@link BaseControl}) — see
 *   `controls/data.js`, `controls/input.js`, `controls/html.js`,
 *   `controls/table.js`, `controls/multicheck.js`, `controls/image.js`, which
 *   are the six direct subclasses; the other 44 descend through those. This is
 *   also exactly how `make_control` resolves a fieldtype to a class
 *   (`controls/control.js:47`).
 * - The remaining members are `unknown`. Their shapes are NOT declared by this
 *   package, and `unknown` says so rather than guessing. This is no worse than
 *   the index signature it replaces — those names resolved to `unknown` under it
 *   too — and it is strictly better for everything NOT on the list.
 *
 * All members are non-optional, matching `Control` / `Form` / `Layout` above:
 * they are assigned at module scope in files under `frappe/form/**`, which is
 * one bundle. `frappe.ui.form` either has all of them or does not exist.
 *
 * TO ADD YOUR OWN (an app-defined control, or one of the `unknown` members
 * typed properly), merge into this interface rather than casting:
 *
 * ```ts
 * declare module "frappe-types" {
 *   interface FrappeUiFormNamespace {
 *     ControlMyFieldtype: typeof BaseControl;
 *   }
 * }
 * ```
 */
export interface FrappeUiFormNamespace {
	/** controls/base_control.js:1. */
	Control: typeof BaseControl;
	/** controls/base_input.js:2. */
	ControlInput: typeof ControlInput;
	/** controls/table.js:3. The prototype-patch point for swapping the Grid. */
	ControlTable: typeof ControlTable;
	/** layout.js:5. */
	Layout: typeof Layout;
	/** form.js:24. */
	Form: typeof Form;
	/** form.js:18. */
	Controller: typeof FormController;
	/** toolbar.js:7. */
	Toolbar: typeof Toolbar;
	/** controls/control.js:47. */
	make_control: typeof make_control;
	/**
	 * grid.js:7-9 — `$(".grid-row-open").data("grid_row")`.
	 * A DOM query, not a registry: the open row is identified purely by the
	 * `.grid-row-open` class, which makes that class a cross-app contract
	 * (also read at layout.js:712 and ui/keyboard.js:335).
	 */
	get_open_grid_form(): GridRow | undefined;
	/**
	 * grid.js:11-19. Closes the open detail form **and** deactivates
	 * `editable_row`.
	 */
	close_grid_form(): void;
	/**
	 * grid.js:16, grid_row.js:1110/:1182-1195/:1228 — the single row currently in
	 * on-grid-editing mode, desk-wide. `null` when none.
	 */
	editable_row: GridRow | null;
	/* -- Control classes, by fieldtype name (`controls/*.js`). All extend
	 * `frappe.ui.form.Control` = BaseControl; this is the registry
	 * `make_control` reads (controls/control.js:47). -------------------- */
	ControlAttach: typeof BaseControl;
	ControlAttachImage: typeof BaseControl;
	ControlAttachmentGallery: typeof BaseControl;
	ControlAutocomplete: typeof BaseControl;
	ControlBarcode: typeof BaseControl;
	ControlButton: typeof BaseControl;
	ControlCheck: typeof BaseControl;
	ControlCode: typeof BaseControl;
	ControlColor: typeof BaseControl;
	ControlComment: typeof BaseControl;
	ControlCurrency: typeof BaseControl;
	ControlData: typeof BaseControl;
	ControlDate: typeof BaseControl;
	ControlDateRange: typeof BaseControl;
	ControlDatetime: typeof BaseControl;
	ControlDuration: typeof BaseControl;
	ControlDynamicLink: typeof BaseControl;
	ControlFloat: typeof BaseControl;
	ControlGeolocation: typeof BaseControl;
	ControlHTML: typeof BaseControl;
	ControlHTMLEditor: typeof BaseControl;
	ControlHeading: typeof BaseControl;
	ControlIcon: typeof BaseControl;
	ControlImage: typeof BaseControl;
	ControlInt: typeof BaseControl;
	ControlJSON: typeof BaseControl;
	ControlLink: typeof BaseControl;
	ControlLongInt: typeof BaseControl;
	ControlLongText: typeof BaseControl;
	ControlMarkdownEditor: typeof BaseControl;
	ControlMultiCheck: typeof BaseControl;
	ControlMultiSelect: typeof BaseControl;
	ControlMultiSelectList: typeof BaseControl;
	ControlMultiSelectPills: typeof BaseControl;
	ControlPassword: typeof BaseControl;
	ControlPercent: typeof BaseControl;
	ControlPhone: typeof BaseControl;
	ControlRating: typeof BaseControl;
	ControlReadOnly: typeof BaseControl;
	ControlSelect: typeof BaseControl;
	ControlSignature: typeof BaseControl;
	ControlSmallText: typeof BaseControl;
	ControlSwitch: typeof BaseControl;
	ControlTableMultiSelect: typeof BaseControl;
	ControlText: typeof BaseControl;
	ControlTextEditor: typeof BaseControl;
	ControlTime: typeof BaseControl;

	/* -- Everything else frappe assigns onto the namespace. The NAMES are
	 * source-verified; the SHAPES are not declared by this package, so they
	 * are `unknown` rather than guessed. Narrow at the use site, or merge a
	 * real type in (see this interface's TSDoc). ------------------------- */
	/** `form/sidebar/assign_to.js` */
	AssignTo: unknown;
	/** `form/sidebar/assign_to.js` */
	AssignmentClass: unknown;
	/** `form/sidebar/assign_to.js` */
	AssignmentDialog: unknown;
	/** `form/sidebar/attachments.js` */
	Attachments: unknown;
	/** `form/dashboard.js — instance shape is the exported {@link Dashboard} interface` */
	Dashboard: unknown;
	/** `form/sidebar/document_follow.js` */
	DocumentFollow: unknown;
	/** `form/footer/footer.js` */
	Footer: unknown;
	/** `form/form_tour.js` */
	FormTour: unknown;
	/** `form/form_viewers.js` */
	FormViewers: unknown;
	/** `form/link_selector.js` */
	LinkSelector: unknown;
	/** `form/linked_with.js` */
	LinkedWith: unknown;
	/** `form/multi_select_dialog.js` */
	MultiSelectDialog: unknown;
	/** `form/quick_entry.js` */
	QuickEntryForm: unknown;
	/** `form/script_manager.js — instance shape is the exported {@link ScriptManager} interface` */
	ScriptManager: unknown;
	/** `form/sidebar/share.js` */
	Share: unknown;
	/** `form/sidebar/form_sidebar.js` */
	Sidebar: unknown;
	/** `form/sidebar/form_sidebar_users.js` */
	SidebarUsers: unknown;
	/** `form/workflow.js` */
	States: unknown;
	/** `form/success_action.js` */
	SuccessAction: unknown;
	/** `form/controls/select.js` */
	add_options: unknown;
	/** `form/save.js` */
	check_mandatory: unknown;
	/** `form/script_manager.js` */
	get_event_handler_list: unknown;
	/** `form/save.js` */
	is_saving: unknown;
	/** `form/quick_entry.js` */
	make_quick_entry: unknown;
	/** `form/script_manager.js` */
	off: unknown;
	/** `form/script_manager.js` */
	on: unknown;
	/** `form/script_manager.js` */
	on_change: unknown;
	/** `form/print_utils.js` */
	qz_connect: unknown;
	/** `form/print_utils.js` */
	qz_fail: unknown;
	/** `form/print_utils.js` */
	qz_get_printer_list: unknown;
	/** `form/print_utils.js` */
	qz_init: unknown;
	/** `form/print_utils.js` */
	qz_success: unknown;
	/** `form/controls/link.js` */
	recent_link_validations: unknown;
	/** `form/save.js` */
	remove_old_form_route: unknown;
	/** `form/save.js` */
	save: unknown;
	/** `form/sidebar/user_image.js` */
	set_user_image: unknown;
	/** `form/sidebar/user_image.js` */
	setup_user_image_event: unknown;
	/** `form/script_manager.js` */
	trigger: unknown;
	/** `form/save.js` */
	update_calling_link: unknown;
}

/* ========================================================================== *
 * DOM contracts
 * ========================================================================== */

/**
 * Class names emitted by `Grid#make` (grid.js:70-124) that other code selects
 * on. Renaming any of them upstream silently breaks selector-based integrations
 * — which is why they are enumerated rather than left as `string`.
 *
 * The button classes double as `data-action` targets bound by
 * `frappe.utils.bind_actions_with_object(this.wrapper, this)` (grid.js:134).
 * Because that binds handlers to the **elements**, those buttons keep working
 * after being moved elsewhere in the DOM.
 */
export type GridElementClass =
	| "grid-field"
	| "grid-description"
	| "grid-custom-buttons"
	| "form-grid-container"
	| "form-grid"
	| "grid-heading-row"
	| "grid-body"
	| "rows"
	| "grid-empty"
	| "grid-footer"
	| "grid-buttons"
	| "grid-remove-rows"
	| "grid-edit-rows"
	| "grid-remove-all-rows"
	| "grid-duplicate-rows"
	| "grid-add-row"
	| "grid-add-multiple-rows"
	| "grid-pagination"
	| "grid-bulk-actions"
	| "grid-download"
	| "grid-upload"
	/** Latched by `GridRow#setup_columns` past a total span of 10 — grid_row.js:781. */
	| "column-limit-reached";

/**
 * Class names emitted by `GridRow` (grid_row.js:25-26, :252-277, :980-1160)
 * plus the two state classes other code keys off.
 */
export type GridRowElementClass =
	| "grid-row"
	| "data-row"
	| "row-check"
	| "row-index"
	| "sortable-handle"
	| "grid-row-check"
	| "grid-static-col"
	| "static-area"
	| "field-area"
	| "btn-open-row"
	| "template-row-index"
	| "template-row"
	/** Added by `toggle_editable_row(true)` — grid_row.js:1187. */
	| "editable-row"
	/**
	 * Added by `show_form()` (grid_row.js:1500), removed by `hide_form()`
	 * (:1531). The cross-app "this row is open" contract — see
	 * {@link FrappeUiFormNamespace.get_open_grid_form}.
	 */
	| "grid-row-open";

/**
 * Class names emitted by `GridRowForm#make_form` — grid_row_form.js:44-80.
 * The `.grid-*-row` buttons are wired in `set_form_events` (:88-119).
 */
export type GridRowFormElementClass =
	| "form-in-grid"
	| "grid-form-heading"
	| "grid-header-toolbar"
	| "grid-form-row-index"
	| "grid-form-body"
	| "form-area"
	| "grid-footer-toolbar"
	| "grid-shortcuts"
	| "grid-collapse-row"
	| "grid-move-row"
	| "grid-duplicate-row"
	| "grid-insert-row"
	| "grid-insert-row-below"
	| "grid-delete-row"
	| "grid-append-row";

/**
 * Class names emitted by the control layer that identify "an editor is open
 * here" — useful for hit-testing pointer events against live editing UI.
 *
 * `frappe-control` is every control's wrapper (controls/base_control.js:27);
 * `link-btn` is the Link control's open-record button (controls/link.js:17,
 * :28). The Awesomplete dropdown (`.awesomplete`, `[role="listbox"]`) is
 * created by `controls/link.js:225` and — importantly — **re-parented up to
 * `.grid-field`** by the cell `focusin` handler (grid_row.js:1085-1108), so it
 * is *not* a descendant of the cell it belongs to. The datepicker
 * (`.datepicker`, `.datepickers-container`) is appended to `<body>` by
 * air-datepicker for the same reason.
 */
export type ControlElementClass =
	| "frappe-control"
	| "control-label"
	| "control-input"
	| "control-input-wrapper"
	| "control-value"
	| "help-box"
	| "link-btn"
	| "awesomplete";

/**
 * Class the `Toolbar` puts on `page.$title_area` when the document can be
 * renamed — toolbar.js:72-75, inside `set_title()`.
 *
 * Timing matters: it is applied from `frm.refresh() → toolbar.refresh() →
 * set_title()`, which can land **after** the page container becomes visible.
 * Code that waits for it must poll or observe rather than read once.
 */
export type EditableTitleClass = "editable-title";

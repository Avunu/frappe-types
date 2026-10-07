/**
 * `frappe.ui.form` — Form, Layout, Toolbar, the `make_control` / Control class
 * hierarchy, FieldGroup and Dialog, `frappe.form.formatters`, and the DOM
 * contracts of the Grid family. `Grid`, `GridRow`, `GridRowForm` and
 * `GridPagination` themselves are declared in `deep-modules.d.ts` and
 * re-exported from here.
 *
 * Source of truth: frappe v16.50.0 (`git tag v16.50.0`, branch `version-16`),
 * `frappe/public/js/frappe/form/**`. Every signature below was read out of that
 * tree. The 16.50 migration then re-read the declarations against v16.50.0, and
 * the citations are now full paths (`frappe/public/js/frappe/form/layout.js:106-141`)
 * carrying v16.50.0 line numbers. A `:N` that follows one inside the same comment
 * (`…/form.js:684, :809`) continues in the file the citation before it names.
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
	DocFieldName,
	DocFieldValue,
	DocOf,
	DocTypeMeta,
	FormatterOptions,
	FormDocTypeOf,
	FrappeDoc,
	Permission,
} from "../model";

/**
 * SEAM — `Page` used to be imported from `../core`, which never declared it.
 * `frappe.ui.Page` is owned by `utils.d.ts`, the fragment that already owned
 * `FrappePageRegions` (the jQuery regions `Page#setup_page` assigns —
 * `frappe/public/js/frappe/ui/page.js:150-185`) and that explicitly reserved
 * the class for itself. That makes `ui/form.d.ts` ↔ `utils.d.ts` a type-only
 * import cycle — legal in `.d.ts`, with no emit.
 *
 * `Dialog` used to be imported from `../core` too, while `core.d.ts` imported
 * it from here — a genuine circular alias (TS2303) with no declaration behind
 * it. THIS fragment now declares it: `frappe.ui.Dialog extends
 * frappe.ui.FieldGroup extends frappe.ui.form.Layout`
 * (`frappe/public/js/frappe/ui/dialog.js:10`,
 * `frappe/public/js/frappe/ui/field_group.js:5`), and `Layout` is ours.
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
 * (frappe/public/js/frappe/form/grid.js:1567) and `BaseControl#can_write`
 * (frappe/public/js/frappe/form/controls/base_input.js:144-146).
 */
export type DisplayStatus = "Write" | "Read" | "None";

/**
 * A `depends_on` / `mandatory_depends_on` / `read_only_depends_on` /
 * `collapsible_depends_on` expression.
 *
 * Four accepted shapes, all handled in the same block —
 * frappe/public/js/frappe/form/grid_row.js:841-875 and
 * frappe/public/js/frappe/form/layout.js:786-826: a boolean, a
 * `(doc) => unknown` function, an `"eval:…"` string evaluated through
 * `frappe.utils.eval`, an `"fn:…"` string dispatched through
 * `frm.script_manager`, or a bare fieldname whose truthiness is taken (arrays
 * test `.length`).
 */
export type DependsOnExpression =
	| boolean
	| string
	| ((doc: ChildDoc | FrappeDoc) => unknown);

/**
 * One row of the per-DocType `"GridView"` user setting.
 *
 * Written by the Configure Columns dialog
 * (frappe/public/js/frappe/form/grid_row.js:423-432 and :629-640) and by a
 * header drag-resize (frappe/public/js/frappe/form/grid.js:600-612), and read
 * back by `Grid#setup_user_defined_columns`
 * (frappe/public/js/frappe/form/grid.js:1544-1565).
 *
 * Since 16.50 a column's size is a **pixel width**, not a Bootstrap span: every
 * writer stores `width`, and `Grid#visible_columns` pairs each docfield with a
 * pixel number clamped to 60-600
 * (frappe/public/js/frappe/form/grid.js:1526-1538). Rows saved by an older
 * frappe carry a 1-12 `columns` span instead; the reader still accepts them and
 * migrates through `LEGACY_COLSIZE_TO_PX`
 * (frappe/public/js/frappe/form/grid.js:1558). Both keys are therefore optional
 * here — this is the persisted shape, and a stored row may hold either.
 */
export interface GridViewColumn {
	fieldname: string;
	/** Pixel width — frappe/public/js/frappe/form/grid_row.js:428, :636. */
	width?: number;
	/**
	 * Legacy 1-12 Bootstrap span, written by frappe before 16.50 and still read
	 * (frappe/public/js/frappe/form/grid.js:1558). Nothing writes it now.
	 */
	columns?: number;
	/**
	 * `cint(checkbox.checked)` from the dialog
	 * (frappe/public/js/frappe/form/grid_row.js:637) and `df.sticky ? 1 : 0` from
	 * a resize (frappe/public/js/frappe/form/grid.js:610). The dialog's initial
	 * snapshot copies `row[0].sticky` verbatim
	 * (frappe/public/js/frappe/form/grid_row.js:429), so a row that never had the
	 * flag set can read back without the key.
	 */
	sticky?: 0 | 1;
}

/*
 * `GridFilter` — one entry of `Grid#filter` (frappe/public/js/frappe/form/grid_row.js:285-288, :937-940) —
 * was declared here as `{ df: DocField; value: string }` and, more precisely, in
 * `deep-modules.d.ts` as `{ df: GridDocField; value: string }`. It moved with
 * the rest of the Grid family; this file re-exports it below, so
 * `import type { GridFilter } from "frappe-types"` is unaffected.
 */

/**
 * The SortableJS instance frappe binds to the grid's `.rows` container
 * (frappe/public/js/frappe/form/grid.js:909-949).
 *
 * SEAM NOTE — `deep-modules.d.ts` declares the same shape as `GridSortable`,
 * and that is the one `Grid#grid_sortable` is typed with. Both names survive
 * (they are structurally identical and neither collides), but new code should
 * prefer `GridSortable`.
 *
 * Only `option()` is called by frappe itself — from the grid search handlers
 * (frappe/public/js/frappe/form/grid_row.js:294-299, :946-951), to disable
 * drag-sorting while a column filter is active. `destroy()` is declared as well,
 * but that one is read from sortablejs 1.15.7 rather than from frappe: nothing
 * in frappe core calls it (`option` and `destroy` are the `Sortable.prototype`
 * methods at `node_modules/sortablejs/Sortable.js:2135` and `:2154`).
 *
 * Not modelled further on purpose — the real type belongs to `sortablejs`, and
 * frappe loads it as a global rather than importing it.
 */
export interface SortableInstance {
	option(name: string, value?: unknown): unknown;
	destroy(): void;
}

/**
 * The `frappe.ui.form.ScriptManager` handle on a `Form` (frappe/public/js/frappe/form/script_manager.js:89,
 * :179). Only the two entry points reached from this slice are declared.
 */
export interface ScriptManager {
	/** frappe/public/js/frappe/form/script_manager.js:89 — `trigger(event_name, doctype, name)`. */
	trigger(event_name: string, doctype?: string, name?: string): Promise<unknown>;
	setup(): void;
}

/**
 * The `frappe.ui.form.Dashboard` handle on a `Form`
 * (frappe/public/js/frappe/form/form.js:313). Only the members `Form` itself
 * calls are declared (frappe/public/js/frappe/form/form.js:684, :809, :1291-1315, :1582, :2427).
 */
export interface Dashboard {
	refresh(): void;
	after_refresh(): void;
	clear_headline(): void;
	/**
	 * frappe/public/js/frappe/form/dashboard.js:654-656. Returns whatever
	 * `Layout#show_message` returns — the new `.form-message` block, or
	 * `undefined` when `html` is falsy. It returned nothing before 16.50; `Form#set_intro`
	 * now keeps the block so it can remove it again.
	 */
	set_headline(
		html: string,
		color?: string,
		permanent?: boolean
	): JQuery<HTMLElement> | undefined;
	/**
	 * frappe/public/js/frappe/form/dashboard.js:675-681. Wraps `text` in a
	 * `<div>` and returns the `set_headline` block; a falsy `text` clears the
	 * headline instead and returns `undefined`.
	 */
	set_headline_alert(
		text: string,
		color?: string,
		permanent?: boolean
	): JQuery<HTMLElement> | undefined;
	add_comment(text: string, alert_class?: string, permanent?: boolean): void;
}

/** `frm.undo_manager` — form/undo_manager.js, constructed at frappe/public/js/frappe/form/form.js:83. */
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
 * it verbatim (frappe/public/js/frappe/form/formatters.js:456), and callers invent keys freely — hence the
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
 * `formatter(value, df, options, doc)` — frappe/public/js/frappe/form/formatters.js:456.
 *
 * Individual formatters declare fewer parameters (`Date: function (value)` —
 * frappe/public/js/frappe/form/formatters.js:222) but are always *called* with four, so a uniform signature
 * is the honest description of the dispatch contract.
 */
export type FormatterFn = (
	value: unknown,
	df?: DocField,
	options?: FormatterOptions,
	doc?: FrappeDoc | ChildDoc
) => string;

/**
 * `frappe.form.formatters` — frappe/public/js/frappe/form/formatters.js:10-416.
 *
 * A **plain object literal**, not a class: every entry is a mutable, writable
 * property, which is what makes the wrap-and-reassign patching that
 * carbon_frappe does legal (`f.Date = function (...args) { … }`).
 *
 * The index signature is not decoration. frappe itself indexes this object with
 * an arbitrary runtime string — `frappe.form.get_formatter` does
 * `frappe.form.formatters[fieldtype.replace(/ /g, "")] || …`
 * (frappe/public/js/frappe/form/formatters.js:432) — and `_right` / `_apply_custom_formatter` do not share
 * the `FormatterFn` shape, so the index type has to be `unknown` rather than
 * `FormatterFn`. Narrow a dynamic lookup with `typeof f[key] === "function"`
 * before calling it, exactly as frappe and its patchers do.
 */
export interface Formatters {
	/**
	 * Wraps a value in `<div style='text-align: right'>…</div>` unless
	 * `options.inline` or `options.only_value` is set — frappe/public/js/frappe/form/formatters.js:11-17.
	 *
	 * The return type is genuinely open: the early branch returns the *value*
	 * unchanged (whatever was passed in), the late branch returns a string. It
	 * is called by Float, Int, Percent and Currency
	 * (frappe/public/js/frappe/form/formatters.js:77, :88, :102, :161).
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
	 * one is defined — frappe/public/js/frappe/form/formatters.js:18-35. Returns the value untouched
	 * otherwise, so the return type is as open as the input.
	 */
	_apply_custom_formatter(value: unknown, df?: DocField): unknown;

	/** frappe/public/js/frappe/form/formatters.js:36-48. Handles `options === "URL" | "IBAN"`. */
	Data: FormatterFn;
	/** frappe/public/js/frappe/form/formatters.js:49-51. */
	Autocomplete: FormatterFn;
	/** frappe/public/js/frappe/form/formatters.js:52-54. */
	Select: FormatterFn;
	/** frappe/public/js/frappe/form/formatters.js:55-79. Delegates to `Currency` when `df.options` is set. */
	Float: FormatterFn;
	/** frappe/public/js/frappe/form/formatters.js:80-89. Delegates to `FileSize` when `options === "File Size"`. */
	Int: FormatterFn;
	/** frappe/public/js/frappe/form/formatters.js:90-106. */
	Percent: FormatterFn;
	/** frappe/public/js/frappe/form/formatters.js:107-125. Returns an SVG star row. */
	Rating: FormatterFn;
	/** frappe/public/js/frappe/form/formatters.js:126-163. */
	Currency: FormatterFn;
	/** frappe/public/js/frappe/form/formatters.js:164-167. Returns a disabled `<input type=checkbox>`. */
	Check: FormatterFn;
	/**
	 * frappe/public/js/frappe/form/formatters.js:169-221. Honours `frappe.form.link_formatters`. The display
	 * text (the Link title, else the raw value) is passed through `__()` when
	 * the linked DocType is in `frappe.boot.translated_doctypes`
	 * (frappe/public/js/frappe/form/formatters.js:418-424).
	 */
	Link: FormatterFn;
	/**
	 * frappe/public/js/frappe/form/formatters.js:222-235.
	 *
	 * Declared as returning `string`: the tail is `return value || ""` after
	 * `frappe.datetime.str_to_user`. There is one pre-boot escape hatch —
	 * `if (!frappe.datetime.str_to_user) return value;` (frappe/public/js/frappe/form/formatters.js:223) —
	 * which can return a non-string before `frappe.datetime` is loaded. That
	 * branch is unreachable from any desk render path.
	 */
	Date: FormatterFn;
	/** frappe/public/js/frappe/form/formatters.js:236-245. Accepts a `[from, to]` array. */
	DateRange: FormatterFn;
	/**
	 * frappe/public/js/frappe/form/formatters.js:246-256. Formats through the global `moment` using
	 * `frappe.boot.sysdefaults.date_format` / `.time_format`.
	 */
	Datetime: FormatterFn;
	/** frappe/public/js/frappe/form/formatters.js:257-275. */
	Text: FormatterFn;
	/** frappe/public/js/frappe/form/formatters.js:276-282. */
	Time: FormatterFn;
	/** frappe/public/js/frappe/form/formatters.js:283-290. Returns `"0s"` for an empty value. */
	Duration: FormatterFn;
	/** frappe/public/js/frappe/form/formatters.js:291-297. Parses a JSON array of user ids. */
	LikedBy: FormatterFn;
	/** frappe/public/js/frappe/form/formatters.js:298-313. Comma-separated `_user_tags`. */
	Tag: FormatterFn;
	/** frappe/public/js/frappe/form/formatters.js:314-316. Identity. */
	Comment: FormatterFn;
	/** frappe/public/js/frappe/form/formatters.js:317-326. Parses a JSON array of assignees. */
	Assign: FormatterFn;
	/** frappe/public/js/frappe/form/formatters.js:327-329. */
	SmallText: FormatterFn;
	/** frappe/public/js/frappe/form/formatters.js:330-345. Wraps in `.ql-editor.read-mode`. */
	TextEditor: FormatterFn;
	/** frappe/public/js/frappe/form/formatters.js:346-348. */
	Code: FormatterFn;
	/**
	 * frappe/public/js/frappe/form/formatters.js:349-368. The state's icon is rendered through
	 * `frappe.utils.icon` (frappe/public/js/frappe/form/formatters.js:360-362), not as an `fa-*` glyph.
	 */
	WorkflowState: FormatterFn;
	/** frappe/public/js/frappe/form/formatters.js:369-371. */
	Email: FormatterFn;
	/** frappe/public/js/frappe/form/formatters.js:372-380. Returns a number when under 1 KiB. */
	FileSize: FormatterFn;
	/** frappe/public/js/frappe/form/formatters.js:381-392. Takes the child rows, not a scalar. */
	TableMultiSelect: FormatterFn;
	/** frappe/public/js/frappe/form/formatters.js:393-400. */
	Color: FormatterFn;
	/** frappe/public/js/frappe/form/formatters.js:401-413. */
	Icon: FormatterFn;
	/** frappe/public/js/frappe/form/formatters.js:414 + :425-428 (`format_attachment_url`). */
	Attach: FormatterFn;
	/** frappe/public/js/frappe/form/formatters.js:415 + :425-428 (`format_attachment_url`). */
	AttachImage: FormatterFn;

	/**
	 * Open by design: `frappe.form.get_formatter` looks the object up with a
	 * runtime fieldtype string (frappe/public/js/frappe/form/formatters.js:432), and apps add entries for
	 * their own fieldtypes. `unknown` rather than `FormatterFn` because
	 * `_right` and `_apply_custom_formatter` live in the same namespace with
	 * different shapes.
	 */
	[fieldtype: string]: unknown;
}

/**
 * `frappe.form.link_formatters` — frappe/public/js/frappe/form/formatters.js:8, populated at :477.
 * Keyed by the *linked* DocType; consulted by `formatters.Link`
 * (frappe/public/js/frappe/form/formatters.js:186-191).
 */
export type LinkFormatters = Record<
	string,
	(value: unknown, doc?: FrappeDoc | ChildDoc, docfield?: DocField) => unknown
>;

/**
 * `frappe.form.get_formatter` — frappe/public/js/frappe/form/formatters.js:430-433.
 * Strips spaces from the fieldtype and falls back to `formatters.Data`.
 */
export declare function get_formatter(fieldtype?: string): FormatterFn;

/**
 * The shape of the `frappe.form` namespace object itself
 * (`frappe.provide("frappe.form.formatters")` — frappe/public/js/frappe/form/formatters.js:6).
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
 * (frappe/public/js/frappe/form/controls/base_control.js:2-8), so *every* key lands on the instance
 * verbatim. The named members below are the ones frappe's own call sites pass
 * (frappe/public/js/frappe/form/layout.js:261-269, frappe/public/js/frappe/form/grid_row.js:1154-1166).
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
	/** Set for on-grid-editing controls — frappe/public/js/frappe/form/grid_row.js:1163. */
	grid?: Grid;
	/** Set for on-grid-editing controls — frappe/public/js/frappe/form/grid_row.js:1164. */
	grid_row?: GridRow;
	/** When true the constructor calls `refresh()` — frappe/public/js/frappe/form/controls/base_control.js:5-7. */
	render_input?: boolean;
	/** Suppresses the label/description scaffolding — frappe/public/js/frappe/form/controls/base_input.js:17-19. */
	only_input?: boolean;
	with_link_btn?: boolean;
	value?: unknown;
	[option: string]: unknown;
}

/**
 * `BaseControl#make()` stores a back-reference on its own wrapper element:
 * `this.wrapper.fieldobj = this` (frappe/public/js/frappe/form/controls/base_control.js:15). Event handlers read it
 * back off the DOM, so a typed lookup needs this element shape.
 */
export interface ControlHostElement extends HTMLElement {
	fieldobj?: BaseControl;
}

/**
 * `frappe.ui.form.Control` — frappe/public/js/frappe/form/controls/base_control.js:1.
 *
 * Assigned as a **class expression** (`frappe.ui.form.Control = class BaseControl
 * { … }`), so the only way to name the type is through this declaration or
 * through `typeof frappe.ui.form.Control`.
 */
export declare class BaseControl {
	constructor(opts: ControlOptions);

	// ---- fields merged in by `$.extend(this, opts)` (frappe/public/js/frappe/form/controls/base_control.js:3) ----
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
	/** `.frappe-control` wrapper — frappe/public/js/frappe/form/controls/base_control.js:27. */
	$wrapper: JQuery<HTMLElement>;
	/**
	 * The same node as `$wrapper`, **unwrapped**.
	 *
	 * Careful: `make_wrapper()` first aliases it to the jQuery object
	 * (frappe/public/js/frappe/form/controls/base_control.js:30) and `make()` then overwrites it with
	 * `this.$wrapper.get(0)` (frappe/public/js/frappe/form/controls/base_control.js:14). Every reader runs after
	 * `make()`, which is why `ControlTable#make` can hand `this.wrapper`
	 * straight to `new Grid({ parent: … })` (frappe/public/js/frappe/form/controls/table.js:11) as an
	 * element.
	 */
	wrapper: ControlHostElement;
	/** `.tooltip-content` span appended in `make()` — frappe/public/js/frappe/form/controls/base_control.js:17. */
	tooltip: JQuery<HTMLElement>;

	/** Cached result of the last `get_status()` — frappe/public/js/frappe/form/controls/base_control.js:139. */
	disp_status?: DisplayStatus;
	/** The control's current (unparsed) value. */
	value?: unknown;
	/** Last value pushed to the model — frappe/public/js/frappe/form/controls/base_control.js:274. */
	last_value?: unknown;
	/** Re-entrancy guard around the change event — frappe/public/js/frappe/form/controls/base_control.js:217, :231. */
	inside_change_event?: boolean;

	/**
	 * `get perm()` returns `this.frm?.perm` and the setter only logs an error
	 * (frappe/public/js/frappe/form/controls/base_control.js:38-44) — assignment is a no-op, hence `readonly`.
	 */
	readonly perm?: Permission[];

	// ---- methods ----
	/** frappe/public/js/frappe/form/controls/base_control.js:9-24. */
	make(): void;
	/** frappe/public/js/frappe/form/controls/base_control.js:26-31. Overridden by `ControlInput`. */
	make_wrapper(): void;
	/** frappe/public/js/frappe/form/controls/base_control.js:33-36. Writes `df.hidden` then refreshes. */
	toggle(show: boolean): void;
	/** frappe/public/js/frappe/form/controls/base_control.js:48-137. `explain` logs the decision to the console. */
	get_status(explain?: boolean): DisplayStatus;
	/** frappe/public/js/frappe/form/controls/base_control.js:138-148. */
	refresh(): void;
	/** frappe/public/js/frappe/form/controls/base_control.js:149-185. */
	show_translatable_button(value: unknown): void;
	/** frappe/public/js/frappe/form/controls/base_control.js:186-194. Returns `{}` when the doc is not in `locals`. */
	get_doc(): FrappeDoc | ChildDoc | Record<string, never>;
	/** frappe/public/js/frappe/form/controls/base_control.js:195-199. `undefined` when there is no `doc`. */
	get_model_value(): unknown;
	/** frappe/public/js/frappe/form/controls/base_control.js:200-205. Runs `this.parse` if the subclass defines one. */
	get_parsed_value(value: unknown): unknown;
	/** frappe/public/js/frappe/form/controls/base_control.js:207-209. */
	set_value(value: unknown, force_set_value?: boolean): Promise<unknown>;
	/** frappe/public/js/frappe/form/controls/base_control.js:210-213. */
	parse_validate_and_set_in_model(value: unknown, e?: Event): Promise<unknown>;
	/** frappe/public/js/frappe/form/controls/base_control.js:214-260. */
	validate_and_set_in_model(
		value: unknown,
		e?: Event | null,
		force_set_value?: boolean
	): Promise<unknown>;
	/** frappe/public/js/frappe/form/controls/base_control.js:261-271. */
	get_value(): unknown;
	/** frappe/public/js/frappe/form/controls/base_control.js:272-289. */
	set_model_value(value: unknown): Promise<unknown>;
	/** frappe/public/js/frappe/form/controls/base_control.js:290-295. Returns `undefined` when there is no `$input`. */
	set_focus(): boolean | undefined;

	// ---- optional subclass hooks the base only calls when present ----
	/** Defined by `ControlInput` (frappe/public/js/frappe/form/controls/base_input.js:76). */
	refresh_input?(): void;
	/** Defined by input controls (frappe/public/js/frappe/form/controls/data.js:268). */
	set_input?(value: unknown): void;
	/** Defined by input controls (frappe/public/js/frappe/form/controls/data.js:278). */
	get_input_value?(): unknown;
	/** Defined by input controls (frappe/public/js/frappe/form/controls/data.js:7). */
	make_input?(): void;
	/** Defined by numeric/date controls (frappe/public/js/frappe/form/controls/data.js:287). */
	parse?(value: unknown): unknown;
	/** Defined by input controls (frappe/public/js/frappe/form/controls/data.js:293). */
	validate?(value: unknown): unknown;
	/**
	 * Defined by `ControlInput` (frappe/public/js/frappe/form/controls/base_input.js:257);
	 * called at frappe/public/js/frappe/form/controls/base_control.js:239.
	 */
	set_mandatory?(value: unknown): void;
	/**
	 * Defined by `ControlInput` (frappe/public/js/frappe/form/controls/base_input.js:277);
	 * called at frappe/public/js/frappe/form/controls/base_control.js:244 and :247.
	 * In a grid it writes `grid_row.columns[fieldname].is_invalid`.
	 */
	set_invalid?(): void;
	/** frappe/public/js/frappe/form/controls/base_control.js:249 — `me?.after_set_value?.()`. */
	after_set_value?(): unknown;
	/**
	 * frappe/public/js/frappe/form/controls/base_control.js:218 — `me.set_formatted_input?.(value)`, called when
	 * `validate_and_set_in_model` finds nothing to change so the input still
	 * re-renders its formatted text. Defined by `ControlData` (frappe/public/js/frappe/form/controls/data.js:275)
	 * and most of its subclasses; the result type is `unknown` because they
	 * disagree (`ControlMarkdownEditor#set_formatted_input` returns a promise,
	 * frappe/public/js/frappe/form/controls/markdown_editor.js:55).
	 */
	set_formatted_input?(value: unknown): unknown;
	/** Geolocation/Signature hook, called by `GridRowForm#set_active_tab`. */
	on_section_collapse?(hide: boolean): void;

	/** Copied from `Grid#get_field(fieldname).get_query` — frappe/public/js/frappe/form/grid_row.js:1168. */
	get_query?: unknown;
	/** Rich-text controls expose an editor with its own focus handling. */
	editor?: { set_focus(): void };
	/**
	 * `ControlLink`'s Awesomplete instance — frappe/public/js/frappe/form/controls/link.js:225.
	 * `close()` is the one method `Grid#make`'s horizontal-scroll listener calls on it
	 * (frappe/public/js/frappe/form/grid.js:187).
	 */
	awesomplete?: { ul: HTMLElement; list: unknown; close(): void; [key: string]: unknown };
	/** `ControlLink`'s `.link-btn` handle — frappe/public/js/frappe/form/controls/link.js:28. */
	$link?: JQuery<HTMLElement>;
}

/**
 * `frappe.ui.form.ControlInput` — frappe/public/js/frappe/form/controls/base_input.js:2. The base of every
 * control that owns an `<input>`; `ControlTable` notably does **not** extend it.
 */
export declare class ControlInput extends BaseControl {
	/** frappe/public/js/frappe/form/controls/base_input.js:3 — read back as `this.constructor.horizontal`. */
	static horizontal: boolean;

	/**
	 * `.control-input` element — frappe/public/js/frappe/form/controls/base_input.js:52. With `only_input` it is the
	 * control's own `wrapper` instead (frappe/public/js/frappe/form/controls/base_input.js:49).
	 */
	input_area: HTMLElement;
	/** The `<label>` element — frappe/public/js/frappe/form/controls/base_input.js:51. */
	label_area?: HTMLElement;
	/** Same node as `label_area` — frappe/public/js/frappe/form/controls/base_input.js:51. */
	label_span?: HTMLElement;
	/** `.control-input-wrapper` — frappe/public/js/frappe/form/controls/base_input.js:53. */
	$input_wrapper?: JQuery<HTMLElement>;
	/** `.control-value` read-only display area — frappe/public/js/frappe/form/controls/base_input.js:56. */
	disp_area?: HTMLElement;
	/** The `<input>`, once `make_input()` has run — frappe/public/js/frappe/form/controls/data.js:65. */
	$input?: JQuery<HTMLInputElement>;
	/** `this.$input.get(0)` — frappe/public/js/frappe/form/controls/data.js:65. */
	input?: HTMLInputElement;
	/** Latched by `make_input()` — frappe/public/js/frappe/form/controls/data.js:66. */
	has_input?: boolean;

	/** frappe/public/js/frappe/form/controls/base_input.js:41-43. */
	toggle_label(show: boolean): void;
	/** frappe/public/js/frappe/form/controls/base_input.js:44-46. */
	toggle_description(show: boolean): void;
	/** frappe/public/js/frappe/form/controls/base_input.js:47-58. */
	set_input_areas(): void;
	/** frappe/public/js/frappe/form/controls/base_input.js:59-63. */
	set_max_width(): void;
	/** frappe/public/js/frappe/form/controls/base_input.js:65-71. */
	read_only_because_of_fetch_from(): unknown;
	/** frappe/public/js/frappe/form/controls/base_input.js:76-142. */
	refresh_input(): void;
	/** frappe/public/js/frappe/form/controls/base_input.js:144-146. */
	can_write(): boolean;
	/** frappe/public/js/frappe/form/controls/base_input.js:148-178. */
	set_disp_area(value: unknown): void;
	/** frappe/public/js/frappe/form/controls/base_input.js:179-191. */
	set_label(label?: string): void;
	/** frappe/public/js/frappe/form/controls/base_input.js:192-201. */
	show_description_on_click(): void;
	/** frappe/public/js/frappe/form/controls/base_input.js:202-221. */
	set_doc_url(): void;
	/** frappe/public/js/frappe/form/controls/base_input.js:223-248. */
	set_description(description?: string): void;
	/** frappe/public/js/frappe/form/controls/base_input.js:249-252. */
	set_new_description(description: string): void;
	/** frappe/public/js/frappe/form/controls/base_input.js:253-256. */
	set_empty_description(): void;
	/**
	 * frappe/public/js/frappe/form/controls/base_input.js:257-276. Toggles `has-error-mandatory` on the wrapper, and
	 * `has-error` as the OR of that and `has-error-invalid` (:270-275). A no-op
	 * during a form's `onload` (:259) and, in a Dialog or a Web Form, until its
	 * primary action has been attempted (:263-268).
	 */
	set_mandatory(value: unknown): void;
	/**
	 * frappe/public/js/frappe/form/controls/base_input.js:277-288. In a grid it writes
	 * `grid_row.columns[fieldname].is_invalid` (:282); elsewhere it toggles
	 * `has-error-invalid` on the wrapper and re-derives `has-error` (:284-286).
	 */
	set_invalid(): void;
	/** frappe/public/js/frappe/form/controls/base_input.js:289-291. */
	set_required(): void;
	/** frappe/public/js/frappe/form/controls/base_input.js:292-299. */
	set_bold(): void;
}

/**
 * `frappe.ui.form.ControlTable` — frappe/public/js/frappe/form/controls/table.js:3.
 *
 * The child-table control, and the **only** place in core that constructs a
 * `Grid` (frappe/public/js/frappe/form/controls/table.js:8). Assigned as a class expression extending
 * `frappe.ui.form.Control`, so it is not otherwise nameable as a type.
 *
 * `ControlTable.prototype.make` is a documented prototype-patch point: the
 * constructor builds no DOM of its own beyond `super.make()`, and `Grid.make()`
 * is lazy (called from `Grid#refresh` via `!this.wrapper && this.make()`,
 * frappe/public/js/frappe/form/grid.js:659), so a patch that lets the original run and then replaces
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
	/**
	 * NARROWER than `BaseControl#df`, and true of this control specifically:
	 * `ControlTable` is the Table-fieldtype control, and `frappe/public/js/frappe/form/controls/table.js:10`
	 * hands `this.df` STRAIGHT to `new Grid({ df: this.df, … })`, whose
	 * `GridOptions#df` is a {@link GridDocField}. Without the narrowing the
	 * patch shown in this class's doc comment — the documented, and only,
	 * way to swap the grid — does not type-check, because `GridDocField`
	 * re-declares `data` more tightly than `DocField` does.
	 */
	override df: GridDocField;

	/** frappe/public/js/frappe/form/controls/table.js:8. Reassignable — this is the swap point. */
	grid: Grid;

	/**
	 * frappe/public/js/frappe/form/controls/table.js:4-110. Calls `super.make()`, constructs the `Grid`,
	 * registers itself in `frm.grids` (:16) and installs the ~90-line
	 * clipboard-paste handler (:19), which reads `this.grid` at event time
	 * rather than closing over it.
	 */
	make(): void;
	/**
	 * frappe/public/js/frappe/form/controls/table.js:111-133. Resolves a pasted column header (fieldname,
	 * label or translated label) to a fieldname; `undefined` when nothing
	 * matches.
	 */
	get_field(field_name: string): string | undefined;
	/** frappe/public/js/frappe/form/controls/table.js:134-136. */
	refresh_input(): void;
	/** frappe/public/js/frappe/form/controls/table.js:137-141. `undefined` before `make()` has run. */
	get_value(): ChildDoc[] | undefined;
	/** frappe/public/js/frappe/form/controls/table.js:142-144. Deliberately empty. */
	set_input(): void;
	/** frappe/public/js/frappe/form/controls/table.js:145-147. Returns `get_value()`. */
	validate(): ChildDoc[] | undefined;
	/** frappe/public/js/frappe/form/controls/table.js:148-150. Clicks the header select-all checkbox. */
	check_all_rows(): void;
}

/**
 * `frappe.ui.form.make_control` — frappe/public/js/frappe/form/controls/control.js:48-55.
 *
 * Builds `"Control" + df.fieldtype.replace(/ /g, "")` and news it up. Returns
 * `undefined` (after a `console.log`, not a throw) when no such class exists —
 * `Layout#make_field` explicitly handles that case (frappe/public/js/frappe/form/layout.js:238-239).
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
 * `__section_N`) fieldname (frappe/public/js/frappe/form/layout.js:335-337), and `make_column` pushes a
 * `Column` into `fields_list` (frappe/public/js/frappe/form/layout.js:350). Narrow with
 * `instanceof ControlTable` / `instanceof Section` when you need a specific one;
 * that works because these are real classes on `frappe.ui.form`.
 */
export type LayoutFieldObject = BaseControl | Section | Column;

/** Constructor options for `frappe.ui.form.Layout` — merged by `$.extend`. */
export interface LayoutOptions {
	/** Where the layout appends `.form-layout`. `body` is used if unset. */
	parent?: HTMLElement | JQuery;
	/** Alternative to `parent` — frappe/public/js/frappe/form/layout.js:22-24. */
	body?: HTMLElement | JQuery;
	doctype?: string;
	doctype_layout?: DocTypeMeta;
	frm?: Form;
	doc?: FrappeDoc | ChildDoc;
	/** Explicit field list; otherwise taken from the DocType meta. */
	fields?: DocField[];
	/** Set by `GridRowForm#render` — frappe/public/js/frappe/form/grid_row_form.js:17-20. */
	grid?: Grid;
	grid_row?: GridRow;
	grid_row_form?: GridRowForm;
	/** Grid row forms set this; it changes tab activation — frappe/public/js/frappe/form/layout.js:447. */
	is_child_table?: boolean;
	/**
	 * Dialogs set this; with `doctype === "Web Form"` it gates `set_mandatory`
	 * (frappe/public/js/frappe/form/controls/base_input.js:263-268), `FieldGroup#get_values`
	 * (frappe/public/js/frappe/ui/field_group.js:160) and the form-object fallback of
	 * `set_dependant_property` (frappe/public/js/frappe/form/layout.js:763).
	 */
	is_dialog?: boolean;
	card_layout?: boolean;
	with_dashboard?: boolean;
	no_submit_on_enter?: boolean;
	[option: string]: unknown;
}

/**
 * `frappe.ui.form.Layout` — frappe/public/js/frappe/form/layout.js:5.
 *
 * Note the constructor does **not** build DOM; callers must call `make()`
 * (frappe/public/js/frappe/form/form.js:289, frappe/public/js/frappe/form/grid_row_form.js:23).
 */
export declare class Layout {
	constructor(opts: LayoutOptions);

	// ---- initialised in the constructor (frappe/public/js/frappe/form/layout.js:7-16) ----
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
	 * `evaluate_depends_on_value` falls back to it (frappe/public/js/frappe/form/layout.js:790-791).
	 *
	 * Returns **`null`**, not a partial object, when a required field is empty or
	 * a field is flagged invalid (frappe/public/js/frappe/ui/field_group.js:179, :192) — every caller in
	 * frappe guards with `if (!values) return;` (frappe/public/js/frappe/ui/dialog.js:265-266).
	 */
	get_values?: (
		ignore_errors?: boolean,
		check_invalid?: boolean
	) => Record<string, unknown> | null;

	// ---- built by make() ----
	/** `.form-layout` — frappe/public/js/frappe/form/layout.js:25. */
	wrapper: JQuery<HTMLElement>;
	/** `.form-message-container` — frappe/public/js/frappe/form/layout.js:26. */
	message: JQuery<HTMLElement>;
	/** The current `.form-page`; replaced by `make_page_break()`. */
	page: JQuery<HTMLElement>;
	fields: DocField[];
	/** `.form-tabs` `<ul>` — frappe/public/js/frappe/form/layout.js:49, tabbed layouts only. */
	tab_link_container?: JQuery<HTMLElement>;
	/** `.form-tab-content` — frappe/public/js/frappe/form/layout.js:50, tabbed layouts only. */
	tabs_content?: JQuery<HTMLElement>;
	/** The section/column/tab currently being filled by `render()`. */
	section: Section | null;
	column: Column | null;
	current_tab?: Tab;
	/** `.btn-fold` handle — frappe/public/js/frappe/form/layout.js:295. */
	fold_btn?: JQuery<HTMLElement>;
	folded?: boolean;

	/** frappe/public/js/frappe/form/layout.js:21-41. Builds the DOM and calls `render()`. */
	make(): void;
	/** frappe/public/js/frappe/form/layout.js:43-54. */
	setup_tabbed_layout(): void;
	/** frappe/public/js/frappe/form/layout.js:56-67. */
	get_doctype_fields(): DocField[];
	/** frappe/public/js/frappe/form/layout.js:69-89. The synthetic hidden `__newname` Data field. */
	get_new_name_field(): DocField;
	/** frappe/public/js/frappe/form/layout.js:91-99. */
	get_fields_from_layout(): DocField[];
	/**
	 * frappe/public/js/frappe/form/layout.js:106-141. `color` is one of yellow/blue/red/green/orange/white
	 * (:131-134 — anything else, or nothing, becomes blue; its own JSDoc omits
	 * "white"). Passing a falsy `html` empties and hides the container and returns
	 * `undefined` (:107-110); otherwise it returns the new `.form-message` block
	 * (:140), which it did not before 16.50.
	 */
	show_message(
		html: string | null,
		color?: string,
		permanent?: boolean
	): JQuery<HTMLElement> | undefined;
	/** frappe/public/js/frappe/form/layout.js:143-200. */
	render(new_fields?: DocField[]): void;
	/** frappe/public/js/frappe/form/layout.js:202-206. */
	no_opening_section(): boolean;
	/**
	 * frappe/public/js/frappe/form/layout.js:207. A no-op in core, declared there
	 * with no parameters; `render()` still calls it with the field list
	 * (:155), so an override receives `fields`.
	 */
	add_default_tabs(fields?: DocField[]): void;
	/** frappe/public/js/frappe/form/layout.js:208-210. */
	no_opening_tab(): boolean;
	/**
	 * frappe/public/js/frappe/form/layout.js:212-214. Returns the first `Tab Break` **docfield**, not a
	 * boolean — every caller uses it for truthiness only.
	 */
	is_tabbed_layout(): DocField | undefined;
	/** frappe/public/js/frappe/form/layout.js:216-229. */
	replace_field(fieldname: string, df: DocField, render?: boolean): void;
	/** frappe/public/js/frappe/form/layout.js:231-250. */
	make_field(df: DocField, colspan?: unknown, render?: boolean): void;
	/** frappe/public/js/frappe/form/layout.js:252-277. `undefined` when `make_control` rejects the fieldtype. */
	init_field(
		df: DocField,
		parent: HTMLElement,
		render?: boolean
	): BaseControl | undefined;
	/** frappe/public/js/frappe/form/layout.js:279-281. */
	make_page_break(): void;
	/** frappe/public/js/frappe/form/layout.js:283-311. The "Show more details" fold. */
	make_page(df: DocField): void;
	/** frappe/public/js/frappe/form/layout.js:313-315. */
	unfold(): void;
	/** frappe/public/js/frappe/form/layout.js:317-340. Mutates `df` to add a `__section_N` fieldname. */
	make_section(df?: Partial<DocField>): void;
	/** frappe/public/js/frappe/form/layout.js:342-353. Mutates `df` to add a `__column_N` fieldname. */
	make_column(df?: Partial<DocField>): void;
	/** frappe/public/js/frappe/form/layout.js:355-362. */
	make_tab(df: DocField): Tab;
	/** frappe/public/js/frappe/form/layout.js:364-394. */
	refresh(doc?: FrappeDoc | ChildDoc): void;
	/** frappe/public/js/frappe/form/layout.js:396-400. */
	is_numeric_field_active(): boolean;
	/** frappe/public/js/frappe/form/layout.js:402-419. */
	refresh_sections(): void;
	/** frappe/public/js/frappe/form/layout.js:421-432. */
	refresh_tabs(): void;
	/** frappe/public/js/frappe/form/layout.js:434-444. Matches on tab label or fieldname, case-insensitively. */
	select_tab(label_or_fieldname: string): void;
	/**
	 * frappe/public/js/frappe/form/layout.js:446-474. Grid-row forms (`is_child_table`) always open their first
	 * visible tab (:448-456). Otherwise the tab named by `location.hash`, then
	 * `frm.get_active_tab()`, then the first visible one — and since 16.50 a
	 * hidden tab is skipped at each step (`tab.is_hidden()`, :461, :467).
	 */
	set_tab_as_active(): void;
	/** frappe/public/js/frappe/form/layout.js:476-489. */
	refresh_fields(fields: DocField[]): void;
	/** frappe/public/js/frappe/form/layout.js:491-494. */
	add_fields(fields: DocField[]): void;
	/** frappe/public/js/frappe/form/layout.js:496-516. */
	refresh_section_collapse(): void;
	/** frappe/public/js/frappe/form/layout.js:518-532. */
	attach_doc_and_docfields(refresh?: boolean): void;
	/** frappe/public/js/frappe/form/layout.js:534-569. */
	setup_events(): void;
	/** frappe/public/js/frappe/form/layout.js:571-582. */
	setup_tab_events(): void;
	/** frappe/public/js/frappe/form/layout.js:584-601. */
	setup_tooltip_events(): void;
	/** frappe/public/js/frappe/form/layout.js:603-662. Tab-key navigation between fields and grid rows. */
	handle_tab(doctype: string, fieldname: string, shift?: boolean): void;
	/** frappe/public/js/frappe/form/layout.js:664-687. `undefined` when no eligible field follows. */
	focus_on_next_field(
		start_idx: number,
		fields: LayoutFieldObject[]
	): boolean | undefined;
	/** frappe/public/js/frappe/form/layout.js:689-693. */
	is_visible(field: LayoutFieldObject): boolean;
	/** frappe/public/js/frappe/form/layout.js:695-711. */
	set_focus(field: LayoutFieldObject): void;
	/**
	 * frappe/public/js/frappe/form/layout.js:713-715 — `$(".grid-row-open").data("grid_row")`.
	 * Identical to `frappe.ui.form.get_open_grid_form` (frappe/public/js/frappe/form/grid.js:38-40); both read
	 * the same cross-app `.grid-row-open` class contract.
	 */
	get_open_grid_row(): GridRow | undefined;
	/** frappe/public/js/frappe/form/layout.js:717-754. */
	refresh_dependency(): void;
	/** frappe/public/js/frappe/form/layout.js:756-784. */
	set_dependant_property(
		condition: DependsOnExpression,
		fieldname: string,
		property: string
	): void;
	/** frappe/public/js/frappe/form/layout.js:786-826. Returns `undefined` when there is no doc to evaluate against. */
	evaluate_depends_on_value(expression: DependsOnExpression): unknown;
}

/**
 * `Section` — frappe/public/js/frappe/form/section.js:1. Reachable through `Layout#sections`,
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
	/** `.form-section` / `.form-dashboard-section` — frappe/public/js/frappe/form/section.js:30. */
	wrapper: JQuery<HTMLElement>;
	/** `.section-body` — frappe/public/js/frappe/form/section.js:56. */
	body: JQuery<HTMLElement>;
	/** `.section-head`, only when the section has a visible label — frappe/public/js/frappe/form/section.js:64. */
	head?: JQuery<HTMLElement>;
	/** `.collapse-indicator` — frappe/public/js/frappe/form/section.js:72. */
	indicator?: JQuery<HTMLElement>;
	description_wrapper?: JQuery<HTMLElement>;
	/**
	 * A shim so a Section quacks like a GridRow for shared code paths —
	 * frappe/public/js/frappe/form/section.js:21-23 (`this.row = { wrapper: this.wrapper }`).
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

/** `Column` — frappe/public/js/frappe/form/column.js:1. Pushed into `Layout#fields_list`. */
export declare class Column {
	constructor(section: Section, df?: Partial<DocField>);

	df: Partial<DocField>;
	section: Section;
	/** `.form-column` — frappe/public/js/frappe/form/column.js:13. */
	wrapper: JQuery<HTMLElement>;
	/** The inner `<form>`; `Layout#make_field` appends controls to it. */
	form: JQuery<HTMLFormElement>;

	make(): void;
	/** frappe/public/js/frappe/form/column.js:39-60. Redistributes `col-sm-N` across visible columns. */
	resize_all_columns(): void;
	/** frappe/public/js/frappe/form/column.js:62. Deliberately empty — Column tracks nothing. */
	add_field(): void;
	refresh(): void;
}

/** `Tab` — frappe/public/js/frappe/form/tab.js:7. */
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
	/** `${scrub(doctype)}-${df.fieldname}` — frappe/public/js/frappe/form/tab.js:27. */
	id: string;
	/** The `<li class="nav-item">` — frappe/public/js/frappe/form/tab.js:31. */
	tab_link: JQuery<HTMLElement>;
	/** The `.tab-pane` — frappe/public/js/frappe/form/tab.js:45. */
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
 *    global alias (`frappe/public/js/frappe/form/grid.js:52`,
 *    `frappe/public/js/frappe/form/grid_row.js:9`,
 *    `frappe/public/js/frappe/form/grid_row_form.js:1`,
 *    `frappe/public/js/frappe/form/grid_pagination.js:1`) — there is no
 *    `frappe.ui.form.Grid`. The only way
 *    to reach them is the deep import that `deep-modules.d.ts` + `modules.d.ts`
 *    wire up, so that pair has to hold the definitions.
 * 2. A member-by-member diff of the two copies showed `deep-modules.d.ts` to be
 *    a strict SUPERSET: identical member sets for `GridRowForm` (14) and
 *    `GridPagination` (23), one extra member on `GridRow` (`expression`) and
 *    two extra methods on `Grid` (`_apply_mask_overrides`,
 *    `_apply_column_disp_overrides`, frappe/public/js/frappe/form/grid.js:878-903). NOTHING DECLARED HERE
 *    WAS LOST — every member this copy had that the other lacked was carried
 *    across with its citation before this block replaced them:
 *    - `GridDocField#fields` and `GridDocField#allow_bulk_edit` are now
 *      INHERITED, from `model.d.ts`'s `DocField` (`fields?: DocField[]` at
 *      model.d.ts:399 citing frappe/public/js/frappe/form/grid.js:867; `allow_bulk_edit?: FrappeCheck` at
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
 *    boolean to, `is_web_form` (`frappe/public/js/frappe/web_form/webform_script.js:61`, `:77` assign
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
 * (frappe/public/js/frappe/form/grid_row.js:67-71). This is the contract behind
 * `$(".grid-row-open").data("grid_row")` (frappe/public/js/frappe/form/grid.js:39, frappe/public/js/frappe/form/layout.js:714,
 * frappe/public/js/frappe/ui/keyboard.js:337) and `$(e.target).closest(".grid-row").data("name")`.
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

/** The states `Toolbar#get_action_status` can return — frappe/public/js/frappe/form/toolbar.js:794-815. */
export type ToolbarActionStatus =
	| "Edit"
	| "Submit"
	| "Save"
	| "Update"
	| "Cancel"
	| "Amend";

/**
 * `frappe.ui.form.Toolbar` — frappe/public/js/frappe/form/toolbar.js:8.
 *
 * Everything on the instance arrives through `$.extend(this, opts)`
 * (frappe/public/js/frappe/form/toolbar.js:10); the constructor then immediately calls `refresh()`, so a
 * Toolbar is never observed un-refreshed.
 */
export declare class Toolbar {
	constructor(opts: { frm: Form; page: Page; [option: string]: unknown });

	frm: Form;
	page: Page;
	/**
	 * Last status handed to `set_page_actions` — frappe/public/js/frappe/form/toolbar.js:877,
	 * cleared to `null` at :791. Never initialised, so it is `undefined` until the
	 * first status is set, and `Form#refresh_header` sets it back to `undefined`
	 * when the form switches document (frappe/public/js/frappe/form/form.js:803).
	 */
	current_status: ToolbarActionStatus | null | undefined;

	/** frappe/public/js/frappe/form/toolbar.js:14-42. */
	refresh(): void;
	/**
	 * frappe/public/js/frappe/form/toolbar.js:43-81. Among other things this is what toggles the
	 * `editable-title` class on `page.$title_area` (:75-78) — the class other
	 * code keys "this document can be renamed" off. It runs from
	 * `frm.refresh() → toolbar.refresh()`, i.e. **asynchronously** relative to
	 * the page container becoming visible. The document's browser-tab title is
	 * left alone when the form is embedded in a dialog (`frm.in_dialog`, :72).
	 */
	set_title(): void;
	/** frappe/public/js/frappe/form/toolbar.js:82-106. */
	is_title_editable(): boolean;
	/**
	 * frappe/public/js/frappe/form/toolbar.js:107-114. Falsy for a Single (:112) — it has no name to change.
	 * `unknown`, not `boolean`: the body is an `&&` chain over a permission flag
	 * and meta flags, so what comes back is the last operand evaluated (a `0 | 1`
	 * or a boolean). Use it for truthiness only.
	 */
	can_rename(): unknown;
	/** frappe/public/js/frappe/form/toolbar.js:115-120. */
	show_unchanged_document_alert(): void;
	/** frappe/public/js/frappe/form/toolbar.js:121-206. */
	rename_document_title(
		input_name?: string,
		input_title?: string,
		merge?: boolean
	): Promise<unknown>;
	/**
	 * frappe/public/js/frappe/form/toolbar.js:208-224. Adds the sidebar pencil icon to `element` (when the
	 * document is renameable) and wires it to
	 * {@link Toolbar.setup_editable_title_click_event}.
	 */
	setup_editable_title(element: JQuery): void;
	/**
	 * frappe/public/js/frappe/form/toolbar.js:226-308. Binds the rename dialog to `element` with
	 * `element.off("click").on("click", …)` — so re-running it on the same
	 * element is **idempotent**, and it is safe to point a second affordance
	 * (e.g. the page heading) at the same handler.
	 *
	 * The parameter must be a jQuery object: the body calls `.off()` / `.on()`
	 * on it directly.
	 */
	setup_editable_title_click_event(element: JQuery): void;
	/** frappe/public/js/frappe/form/toolbar.js:310-312. */
	get_dropdown_menu(label: string): JQuery;
	/** frappe/public/js/frappe/form/toolbar.js:313-330. */
	set_indicator(): void;
	/** frappe/public/js/frappe/form/toolbar.js:331-340. */
	make_menu(): void;
	/** frappe/public/js/frappe/form/toolbar.js:342-362. */
	make_navigation(): void;
	/** frappe/public/js/frappe/form/toolbar.js:364-385. */
	make_menu_items(): void;
	/** frappe/public/js/frappe/form/toolbar.js:703-705. An `&&` chain — `unknown`, truthiness only (see {@link Toolbar.can_rename}). */
	can_repeat(): unknown;
	/** frappe/public/js/frappe/form/toolbar.js:706-708. A real `=== 0` comparison, so a true boolean. */
	can_save(): boolean;
	/** frappe/public/js/frappe/form/toolbar.js:709-718. An `&&` chain — `unknown`, truthiness only. */
	can_submit(): unknown;
	/** frappe/public/js/frappe/form/toolbar.js:719-726. An `&&` chain — `unknown`, truthiness only. */
	can_update(): unknown;
	/** frappe/public/js/frappe/form/toolbar.js:727-729. An `&&` chain — `unknown`, truthiness only. */
	can_cancel(): unknown;
	/** frappe/public/js/frappe/form/toolbar.js:730-732. An `&&` chain — `unknown`, truthiness only. */
	can_amend(): unknown;
	/**
	 * frappe/public/js/frappe/form/toolbar.js:733-737. The number of active Workflows on the doctype, cached
	 * after the first call — `frappe.model.has_workflow` returns a list length
	 * (frappe/public/js/frappe/model/model.js:385-387), not a boolean.
	 */
	has_workflow(): number;
	/** frappe/public/js/frappe/form/toolbar.js:738-740. */
	get_docstatus(): number;
	/** frappe/public/js/frappe/form/toolbar.js:741-748. */
	show_linked_with(): void;
	/** frappe/public/js/frappe/form/toolbar.js:749-793. */
	set_primary_action(dirty?: boolean): void;
	/** frappe/public/js/frappe/form/toolbar.js:794-815. `null` when no action applies. */
	get_action_status(): ToolbarActionStatus | null;
	/** frappe/public/js/frappe/form/toolbar.js:816-878. */
	set_page_actions(status: ToolbarActionStatus): void;
	/** frappe/public/js/frappe/form/toolbar.js:879-892. */
	add_update_button_on_dirty(): void;
	/** frappe/public/js/frappe/form/toolbar.js:893-901. */
	show_title_as_dirty(): void;
	/**
	 * frappe/public/js/frappe/form/toolbar.js:903-954. A second call while the "Jump to field" dialog is open
	 * closes it instead of stacking another (:905-912); the dialog is tagged
	 * `dialog_type = "jump_to_field"` (:951) so the next call can find it.
	 */
	show_jump_to_field_dialog(): void;
	/** frappe/public/js/frappe/form/toolbar.js:956-998. */
	scroll_to_grid_field(
		grid_form: GridRowForm,
		fieldname: string,
		focus?: boolean
	): void;
	/** frappe/public/js/frappe/form/toolbar.js:1000-1007. */
	setup_sidebar_toggle(sidebar_wrapper: JQuery): void;
	/** frappe/public/js/frappe/form/toolbar.js:1009-1027. */
	setup_overlay_sidebar(sidebar_wrapper: JQuery): void;
	/**
	 * frappe/public/js/frappe/form/toolbar.js:1029-1048. Toggles document-follow
	 * through the `frappe.desk.form.document_follow.update_follow` endpoint. Since
	 * 16.50 this menu item (`add_follow`, :543-553) is the only follow control
	 * left under `form/`: the sidebar's `frappe.ui.form.DocumentFollow` was
	 * removed (`form/sidebar/form_sidebar.js` no longer imports it).
	 */
	follow(): void;
	/** frappe/public/js/frappe/form/toolbar.js:1050-1055. */
	get_follow_text(follow: boolean): string;
	/** frappe/public/js/frappe/form/toolbar.js:1057-1059. */
	refresh_follow(follow?: boolean): void;
}

/* ========================================================================== *
 * FieldGroup and Dialog (ui/field_group.js, ui/dialog.js)
 *
 * OWNERSHIP NOTE — `Dialog` was imported by `core.d.ts`, `globals.d.ts` and
 * `deep-modules.d.ts` and declared by NO fragment (TS2303 circular alias +
 * TS2459). It lives here because `frappe.ui.Dialog extends frappe.ui.FieldGroup
 * extends frappe.ui.form.Layout`
 * (frappe/public/js/frappe/ui/dialog.js:10, frappe/public/js/frappe/ui/field_group.js:5)
 * and `Layout` is this file's; putting it anywhere else would need a second import cycle
 * through the base class.
 * ========================================================================== */

/**
 * `frappe.ui.FieldGroup` — frappe/public/js/frappe/ui/field_group.js:5. A `Layout` that owns its own
 * values, rather than reading them off a `frm.doc`.
 *
 * `$.extend(this, opts)` runs in `Layout`'s constructor (frappe/public/js/frappe/form/layout.js:18), so every
 * key of {@link LayoutOptions} lands on the instance verbatim here too.
 */
export declare class FieldGroup extends Layout {
	constructor(opts?: LayoutOptions);

	/** frappe/public/js/frappe/ui/field_group.js:8, flipped by the `change`/`input` handlers at :88-101. */
	dirty: boolean;
	/**
	 * frappe/public/js/frappe/ui/field_group.js:9, populated by {@link FieldGroup.add_fetch} at :285-286
	 * as `fetch_dict[target_doctype][link_field][target_field] = source_field`.
	 */
	fetch_dict: Record<string, Record<string, Record<string, string>>>;
	/** From `opts` — applied by `set_values()` in the constructor (frappe/public/js/frappe/ui/field_group.js:16-18). */
	values?: Record<string, unknown>;
	/** From `opts` — frappe/public/js/frappe/ui/field_group.js:84 skips {@link FieldGroup.catch_enter_as_submit}. */
	no_submit_on_enter?: boolean;
	/** From `opts` — frappe/public/js/frappe/ui/field_group.js:106 makes {@link FieldGroup.focus_on_first_input} a no-op. */
	no_focus?: boolean;
	/**
	 * Set by `Dialog#set_primary_action` (frappe/public/js/frappe/ui/dialog.js:248);
	 * read at frappe/public/js/frappe/ui/field_group.js:121.
	 */
	has_primary_action?: boolean;

	/**
	 * frappe/public/js/frappe/ui/field_group.js:21-40. Resolves the `"Today"` / `"Now"` default keywords for
	 * Date/Datetime/Time. A falsy input is returned unchanged (frappe/public/js/frappe/ui/field_group.js:22).
	 */
	resolve_date_default_keywords(
		def_value: string | null | undefined,
		fieldtype?: string
	): string | null | undefined;

	/**
	 * frappe/public/js/frappe/ui/field_group.js:42-62. Resolves one field's `df.default`, expanding
	 * `"__user"` / `"user"` to `frappe.session.user` and `"user_fullname"` to
	 * `frappe.session.user_fullname`. Returns `undefined` for a nullish or
	 * non-numeric-empty default (frappe/public/js/frappe/ui/field_group.js:45-49).
	 */
	get_field_default_value(field: LayoutFieldObject): unknown;

	/**
	 * frappe/public/js/frappe/ui/field_group.js:64-103.
	 *
	 * **A no-op when `this.fields` is falsy** (frappe/public/js/frappe/ui/field_group.js:66) — it never calls
	 * `super.make()`, so `Layout#wrapper` / `#message` / `#page` are never
	 * assigned on a field-less FieldGroup or Dialog. See the note on
	 * {@link Dialog}.
	 *
	 * Applies each field's `df.default` through `set_values` — but, since 16.50,
	 * only when `this.doc` is not already a saved document (:70-82), so a
	 * FieldGroup bound to an existing doc no longer has its values overwritten
	 * by defaults.
	 */
	override make(): void;

	/** frappe/public/js/frappe/ui/field_group.js:105-113. Focuses the first non-Date/Datetime/Time/Check control. */
	focus_on_first_input(): void;
	/**
	 * frappe/public/js/frappe/ui/field_group.js:115-127. Binds Enter on the text / password / select inputs
	 * to `frappe.app.trigger_primary_action()` (:123), but only once
	 * `has_primary_action` is set. That desk-wide helper blurs the active element
	 * and, 100ms later, clicks the open dialog's primary button
	 * (frappe/public/js/frappe/desk.js:463-477); it no longer clicks this group's own
	 * `get_primary_btn()` directly.
	 */
	catch_enter_as_submit(): void;
	/**
	 * frappe/public/js/frappe/ui/field_group.js:129-133 — the control's `txt` element if it has one, else its
	 * `input`, wrapped in jQuery. Returns the **empty string** `""`, not a jQuery
	 * object, for an unknown fieldname (frappe/public/js/frappe/ui/field_group.js:131).
	 */
	get_input(fieldname: string): JQuery | "";
	/** frappe/public/js/frappe/ui/field_group.js:135-137 — a raw `fields_dict` lookup, so a miss is `undefined`. */
	get_field(fieldname: string): LayoutFieldObject | undefined;
	/**
	 * frappe/public/js/frappe/ui/field_group.js:139-195. Collects every control's `get_value()`.
	 *
	 * Returns **`null`** (after `frappe.msgprint`) when a `reqd` field is empty
	 * and `ignore_errors` is falsy (:169-180), or when a field carries
	 * `df.invalid` and `check_invalid` is set (:182-193). Keys are omitted
	 * entirely for null-ish values (:157), so the result is a partial map.
	 */
	override get_values: (
		ignore_errors?: boolean,
		check_invalid?: boolean
	) => Record<string, unknown> | null;
	/** frappe/public/js/frappe/ui/field_group.js:197-200 — `null` when the field exists but has no `get_value`. */
	get_value(key: string): unknown;
	/** frappe/public/js/frappe/ui/field_group.js:202-215. Resolves immediately when the fieldname is unknown. */
	set_value(key: string, val: unknown): Promise<void>;
	/** frappe/public/js/frappe/ui/field_group.js:217-219. */
	has_field(fieldname: string): boolean;
	/** frappe/public/js/frappe/ui/field_group.js:221-223 — an alias of {@link FieldGroup.set_value}. */
	set_input(key: string, val: unknown): Promise<void>;
	/** frappe/public/js/frappe/ui/field_group.js:225-234. Silently skips keys with no matching field. */
	set_values(dict: Record<string, unknown>): Promise<void[]>;
	/** frappe/public/js/frappe/ui/field_group.js:236-243. Resets every control to its `df.default` or `""`. */
	clear(): void;
	/**
	 * frappe/public/js/frappe/ui/field_group.js:245-252. **Throws** on an unknown fieldname — `get_field`
	 * returns `undefined` and `field.df[prop]` is then a TypeError. A falsy
	 * `fieldname` returns early (:246-248).
	 */
	set_df_property(fieldname: string, prop: string, value: unknown): void;
	/**
	 * frappe/public/js/frappe/ui/field_group.js:254-267. Two arities: `(fieldname, query)` on the parent, or
	 * `(fieldname, parent_fieldname, query)` to reach into a child table's grid.
	 */
	set_query(fieldname: string, query: unknown): void;
	set_query(fieldname: string, parent_fieldname: string, query: unknown): void;
	/** frappe/public/js/frappe/ui/field_group.js:270-287. `target_doctype` defaults to `"*"`. */
	add_fetch(
		link_field: string,
		source_field: string,
		target_field: string,
		target_doctype?: string
	): void;
	/** frappe/public/js/frappe/ui/field_group.js:289-291 — `this.doc.__islocal`; throws when there is no `doc`. */
	is_new(): boolean | undefined;
}

/** The modal width classes `Dialog#set_modal_size` picks from — frappe/public/js/frappe/ui/dialog.js:170-193. */
export type DialogSize = "small" | "large" | "extra-large" | "";

/**
 * The `action` bag an older dialog API passes instead of
 * `primary_action` / `secondary_action` — read at frappe/public/js/frappe/ui/dialog.js:69-90.
 */
export interface DialogActions {
	primary: { label?: string; onsubmit?: (values: Record<string, unknown>) => void };
	secondary: { label?: string };
}

/**
 * Constructor options for `frappe.ui.Dialog`.
 *
 * `Dialog` merges defaults and then `opts` with a single `$.extend`
 * (frappe/public/js/frappe/ui/dialog.js:17-27) and `Layout`'s constructor `$.extend`s again
 * (frappe/public/js/frappe/form/layout.js:18), so anything else you pass lands on the instance — hence the
 * open index signature, inherited from {@link LayoutOptions}.
 */
export interface DialogOptions extends LayoutOptions {
	/** frappe/public/js/frappe/ui/dialog.js:298 — set as the `.modal-title` HTML, not text. */
	title?: string;
	/**
	 * frappe/public/js/frappe/ui/dialog.js:44 — when omitted, {@link Dialog.set_modal_size} derives it from
	 * the number of Column Breaks between Section Breaks.
	 */
	size?: DialogSize | null;
	/** frappe/public/js/frappe/ui/dialog.js:20 — adds the Bootstrap `fade` class on `show()`. Defaults to `true`. */
	animate?: boolean;
	/** frappe/public/js/frappe/ui/dialog.js:22 — call `make()` from the constructor. Defaults to `true`. */
	auto_make?: boolean;
	/** frappe/public/js/frappe/ui/dialog.js:23 — adds `modal-dialog-centered`. Defaults to `false`. */
	centered?: boolean;
	/**
	 * frappe/public/js/frappe/ui/dialog.js:24, read at frappe/public/js/frappe/ui/dialog.js:107 — when `false` (the default), hiding the
	 * dialog also closes any open grid detail form.
	 */
	keep_grid_form_open?: boolean;
	/** frappe/public/js/frappe/ui/dialog.js:36-42 — `backdrop: "static"`, no keyboard dismiss, close button hidden. */
	static?: boolean;
	/** frappe/public/js/frappe/ui/dialog.js:305-312 — an indicator colour class on `.modal-header .indicator`. */
	indicator?: string;
	/** frappe/public/js/frappe/ui/dialog.js:92-99 — shows the minimize button. */
	minimizable?: boolean;
	/**
	 * frappe/public/js/frappe/ui/dialog.js:70-76. Called with the result of `get_values()`, `this` bound to the
	 * dialog. If it returns a thenable the primary button shows its busy state
	 * until that settles (frappe/public/js/frappe/ui/dialog.js:267-273), hence `unknown` rather than `void`.
	 */
	primary_action?: (values: Record<string, unknown>) => unknown;
	/** frappe/public/js/frappe/ui/dialog.js:72-74 — defaults to `__("Submit", null, "Primary action in dialog")`. */
	primary_action_label?: string;
	/**
	 * frappe/public/js/frappe/ui/dialog.js:256 — the text the primary button shows while it is busy. Left
	 * unset there is none, only the spinner: `set_primary_action` passes the key
	 * explicitly, which switches off `frappe.ui.button`'s per-label defaults
	 * (frappe/public/js/frappe/ui/components/button.js:98-99).
	 */
	primary_action_loading_label?: string;
	/** frappe/public/js/frappe/ui/dialog.js:79-81 — bound directly as the secondary button's click handler. */
	secondary_action?: (event: JQuery.ClickEvent) => void;
	/** frappe/public/js/frappe/ui/dialog.js:83-90. */
	secondary_action_label?: string;
	/** frappe/public/js/frappe/ui/dialog.js:69-90 — the alternative to `primary_action`/`secondary_action`. */
	action?: DialogActions;
	/** frappe/public/js/frappe/ui/dialog.js:121 — fired from `hide.bs.modal`. Both spellings are checked. */
	onhide?: () => void;
	/** frappe/public/js/frappe/ui/dialog.js:122 — fired from `hide.bs.modal`. */
	on_hide?: () => void;
	/** frappe/public/js/frappe/ui/dialog.js:131 — fired from `shown.bs.modal`. */
	on_page_show?: () => void;
	/** frappe/public/js/frappe/ui/dialog.js:385 — fired by {@link Dialog.toggle_minimize}. */
	on_minimize_toggle?: (is_minimized: boolean) => void;
}

/**
 * `frappe.ui.Dialog` — frappe/public/js/frappe/ui/dialog.js:10
 * (`frappe.ui.Dialog = class Dialog extends frappe.ui.FieldGroup`, a class
 * EXPRESSION, so this declaration is the only way to name the type).
 *
 * Holder of `frappe.msg_dialog`, `frappe.error_dialog`, `frappe.cur_progress`
 * and the `window.cur_dialog` slot (frappe/public/js/frappe/ui/dialog.js:115-119, :127).
 *
 * ### `wrapper` hazard — the one member this declaration cannot narrow
 *
 * `frappe/public/js/frappe/ui/dialog.js:46` assigns the raw `.modal-dialog` **element**
 * (`this.$wrapper.find(".modal-dialog").get(0)`) to `this.wrapper`, and
 * `super.make()` (frappe/public/js/frappe/ui/dialog.js:64) then replaces it with `Layout#make`'s jQuery
 * `.form-layout` handle (frappe/public/js/frappe/form/layout.js:25) — but `FieldGroup#make` is a no-op when
 * the dialog has no `fields` (frappe/public/js/frappe/ui/field_group.js:66), so a field-less Dialog keeps
 * an `HTMLElement` there. The inherited declaration says
 * `JQuery<HTMLElement>`; it is **not** redeclared here because widening an
 * inherited member is not expressible, and narrowing it would be a lie in the
 * other direction. Wrap reads in `$(...)`, which accepts both and is idempotent
 * — exactly what frappe/public/js/frappe/ui/dialog.js:47-50 does. Use {@link Dialog.$wrapper}, the modal
 * root, whenever you can: it is always a jQuery handle.
 *
 * ### `is_visible` is clobbered at runtime, and is therefore NOT declared here
 *
 * `Layout#is_visible(field)` is a **method** (frappe/public/js/frappe/form/layout.js:689-693). `Dialog#show`
 * and `Dialog#hide` assign a **boolean** to the same name (frappe/public/js/frappe/ui/dialog.js:338, :344),
 * shadowing it with an own property. That is an upstream defect, not a type
 * modelling choice: once a dialog has been shown, `Layout#handle_tab`
 * (frappe/public/js/frappe/form/layout.js:636) and `Layout#focus_on_next_field` (frappe/public/js/frappe/form/layout.js:668), the two
 * callers of `this.is_visible(field)`, would throw `is_visible is not a
 * function` if run on it. It is latent in core — the only route to them is
 * `Layout#setup_tab_events` (frappe/public/js/frappe/form/layout.js:571-582), which nothing in frappe calls.
 * A `.d.ts` cannot widen an inherited method to `boolean`, and pretending either
 * half does not exist would be a lie, so this declaration leaves the inherited
 * method visible and says so here.
 * **Read {@link Dialog.display} instead** — frappe/public/js/frappe/ui/dialog.js:13, :104, :126 keep it in
 * sync with `shown.bs.modal` / `hide.bs.modal` and nothing shadows it.
 */
export declare class Dialog extends FieldGroup {
	constructor(opts?: DialogOptions);

	// ---- constructor (frappe/public/js/frappe/ui/dialog.js:13-27) ----
	/** frappe/public/js/frappe/ui/dialog.js:13, :104, :126 — `true` between `shown.bs.modal` and `hide.bs.modal`. */
	display: boolean;
	/**
	 * frappe/public/js/frappe/ui/dialog.js:14. Read by
	 * frappe/public/js/frappe/form/controls/base_input.js:263-268 to skip
	 * mandatory styling.
	 */
	override is_dialog: boolean;
	/** frappe/public/js/frappe/ui/dialog.js:15, :351 — the element focus returns to on close. */
	last_focus: HTMLElement | null;
	/** frappe/public/js/frappe/ui/dialog.js:20. */
	animate: boolean;
	/** frappe/public/js/frappe/ui/dialog.js:21, then computed by {@link Dialog.set_modal_size} (frappe/public/js/frappe/ui/dialog.js:44). */
	size: DialogSize | null;
	/** frappe/public/js/frappe/ui/dialog.js:22. */
	auto_make: boolean;
	/** frappe/public/js/frappe/ui/dialog.js:23. */
	centered: boolean;
	/** frappe/public/js/frappe/ui/dialog.js:24, read at frappe/public/js/frappe/ui/dialog.js:107. */
	keep_grid_form_open: boolean;

	// ---- merged from opts ----
	static?: boolean;
	title?: string;
	indicator?: string;
	minimizable?: boolean;
	primary_action?: (values: Record<string, unknown>) => unknown;
	primary_action_label?: string;
	primary_action_loading_label?: string;
	secondary_action?: (event: JQuery.ClickEvent) => void;
	secondary_action_label?: string;
	action?: DialogActions;
	onhide?: () => void;
	on_hide?: () => void;
	on_page_show?: () => void;
	on_minimize_toggle?: (is_minimized: boolean) => void;

	// ---- built by make() (frappe/public/js/frappe/ui/dialog.js:33-61) ----
	/** frappe/public/js/frappe/ui/dialog.js:34 — `frappe.get_modal("", "")`; the `.modal` root. */
	$wrapper: JQuery<HTMLElement>;
	/** frappe/public/js/frappe/ui/dialog.js:53 — `.modal-body`. */
	modal_body: JQuery<HTMLElement>;
	/** frappe/public/js/frappe/ui/dialog.js:54 — the `<div>` inside `.modal-body` that holds the form. */
	$body: JQuery<HTMLElement>;
	/** frappe/public/js/frappe/ui/dialog.js:56 — `.modal-message`, shown by {@link Dialog.set_message}. */
	$message: JQuery<HTMLElement>;
	/** frappe/public/js/frappe/ui/dialog.js:57 — `.modal-header`. */
	header: JQuery<HTMLElement>;
	/** frappe/public/js/frappe/ui/dialog.js:58 — `.modal-footer`. */
	footer: JQuery<HTMLElement>;
	/** frappe/public/js/frappe/ui/dialog.js:59 — `.standard-actions` inside the footer. */
	standard_actions: JQuery<HTMLElement>;
	/** frappe/public/js/frappe/ui/dialog.js:60 — `.custom-actions` inside the footer. */
	custom_actions: JQuery<HTMLElement>;
	/** frappe/public/js/frappe/ui/dialog.js:218 — present only between `set_alert` and `clear_alert`. */
	$alert?: JQuery<HTMLElement>;

	// ---- runtime flags ----
	/** frappe/public/js/frappe/ui/dialog.js:105, :331, :382. */
	is_minimized?: boolean;
	/**
	 * frappe/public/js/frappe/ui/dialog.js:261 (set when the primary button is clicked), reset by `show()` at
	 * :337. Read by `frappe.confirm` / `frappe.warn` to tell "dismissed" from
	 * "confirmed" (frappe/public/js/frappe/ui/messages.js:57, frappe/public/js/frappe/form/form.js:1113) and by
	 * `ControlInput#set_mandatory` (frappe/public/js/frappe/form/controls/base_input.js:266).
	 */
	primary_action_fulfilled?: boolean;

	/** frappe/public/js/frappe/ui/dialog.js:33-168. Builds the modal and binds every Bootstrap event. */
	override make(): void;
	/** frappe/public/js/frappe/ui/dialog.js:170-193. Picks `""` / `"large"` / `"extra-large"` from the Column Break count. */
	set_modal_size(): void;
	/**
	 * frappe/public/js/frappe/ui/dialog.js:195-197 — `.btn-modal-primary` inside
	 * `.standard-actions`. It was `.btn-primary` before 16.50, when the footer
	 * buttons became es-buttons (`frappe.get_modal` builds them,
	 * frappe/public/js/frappe/dom.js:361-377).
	 */
	get_primary_btn(): JQuery<HTMLElement>;
	/**
	 * frappe/public/js/frappe/ui/dialog.js:203-210. Sets the text of a footer es-button's
	 * `.es-button__label` span (as **text**, not HTML), leaving its spinner and
	 * loading-label siblings intact; when the button has no label span it is
	 * rebuilt through `frappe.ui.button.dress`
	 * (frappe/public/js/frappe/ui/components/button.js:180-209).
	 */
	set_btn_label($btn: JQuery<HTMLElement>, label: string): void;
	/** frappe/public/js/frappe/ui/dialog.js:212-214 — `.btn-modal-minimize`. */
	get_minimize_btn(): JQuery<HTMLElement>;
	/** frappe/public/js/frappe/ui/dialog.js:362-364 — `.btn-modal-close`. */
	get_close_btn(): JQuery<HTMLElement>;
	/** frappe/public/js/frappe/ui/dialog.js:366-368 — `.btn-modal-secondary`. */
	get_secondary_btn(): JQuery<HTMLElement>;
	/** frappe/public/js/frappe/ui/dialog.js:216-222. `text` is injected as raw HTML into the alert div. */
	set_alert(text: string, alert_class?: string): void;
	/** frappe/public/js/frappe/ui/dialog.js:224-228. */
	clear_alert(): void;
	/** frappe/public/js/frappe/ui/dialog.js:230-234. Hides the form body and shows the message instead. */
	set_message(text: string): void;
	/** frappe/public/js/frappe/ui/dialog.js:236-239. */
	clear_message(): void;
	/** frappe/public/js/frappe/ui/dialog.js:241-244 — `super.clear()` plus {@link Dialog.clear_message}. */
	override clear(): void;
	/**
	 * frappe/public/js/frappe/ui/dialog.js:246-277. Returns the button. `click` is invoked with
	 * `[values]` from `get_values()` and **skipped entirely when that is falsy**
	 * (frappe/public/js/frappe/ui/dialog.js:265-266). If it returns a thenable the button is `aria-busy`
	 * until that settles (:267-273). Since 16.50 the button's content is rebuilt
	 * with `frappe.ui.button.dress` (:254-258), so `label` is HTML-**escaped**
	 * text — it used to be set as HTML.
	 */
	set_primary_action(
		label: string,
		click?: (values: Record<string, unknown>) => unknown
	): JQuery<HTMLElement>;
	/** frappe/public/js/frappe/ui/dialog.js:279-282. */
	set_secondary_action(click: (event: JQuery.ClickEvent) => void): JQuery<HTMLElement>;
	/** frappe/public/js/frappe/ui/dialog.js:284-286, through {@link Dialog.set_btn_label}. `label` is text, no longer HTML. */
	set_secondary_action_label(label: string): void;
	/** frappe/public/js/frappe/ui/dialog.js:288-291. Sets the `disabled` property as well as the `disabled` class. */
	disable_primary_action(): void;
	/** frappe/public/js/frappe/ui/dialog.js:293-295. Clears both the `disabled` property and the class. */
	enable_primary_action(): void;
	/** frappe/public/js/frappe/ui/dialog.js:297-299. */
	make_head(): void;
	/** frappe/public/js/frappe/ui/dialog.js:301-303 — sets `.modal-title` as **HTML**, not text. */
	set_title(t: string): void;
	/** frappe/public/js/frappe/ui/dialog.js:305-312. */
	set_indicator(): void;
	/** frappe/public/js/frappe/ui/dialog.js:314-340. Returns `this`, so `new frappe.ui.Dialog(o).show()` chains. */
	show(): this;
	/** frappe/public/js/frappe/ui/dialog.js:342-345. */
	hide(): void;
	/** frappe/public/js/frappe/ui/dialog.js:347-360. Remembers `document.activeElement` on a Form route. */
	handle_focus(): void;
	/** frappe/public/js/frappe/ui/dialog.js:370-372 — hides the close button. */
	no_cancel(): void;
	/** frappe/public/js/frappe/ui/dialog.js:374-376 — clicks the close button. */
	cancel(): void;
	/** frappe/public/js/frappe/ui/dialog.js:378-388. */
	toggle_minimize(): void;
	/** frappe/public/js/frappe/ui/dialog.js:390-392 — toggles `overflow` on `<body>`. */
	hide_scrollbar(bool: boolean): void;
	/**
	 * frappe/public/js/frappe/ui/dialog.js:394-403. Appends a `frappe.ui.button` to the footer's custom
	 * actions; `label` is HTML-escaped text (it was interpolated as raw HTML
	 * before 16.50), `css_class` is added to the button's classes.
	 */
	add_custom_action(
		label: string,
		action?: (event: JQuery.ClickEvent) => void,
		css_class?: string | null
	): void;
	/** frappe/public/js/frappe/ui/dialog.js:405 — declared and deliberately empty upstream. */
	add_custom_button(): void;
}

/* ========================================================================== *
 * Form (form/form.js)
 * ========================================================================== */

/** `frappe.ui.form.Controller` — frappe/public/js/frappe/form/form.js:18. The base of every client script. */
export declare class FormController {
	constructor(opts: { frm: Form; [option: string]: unknown });
	frm: Form;
	/** Set while `onload` is running; suppresses mandatory styling (frappe/public/js/frappe/form/controls/base_input.js:259). */
	is_onload?: boolean;
	[key: string]: unknown;
}

/**
 * `frappe.ui.form.Form` (class name `FrappeForm`) — frappe/public/js/frappe/form/form.js:64.
 *
 * Unusually for this slice the constructor takes **positional** arguments, not
 * an options bag (frappe/public/js/frappe/form/form.js:65).
 *
 * ## The `DT` parameter
 *
 * `DT` is the form's doctype name. It defaults to `string`, which is exactly
 * the pre-generic `Form`: `doc` is the open {@link FrappeDoc}. When `DT` is a
 * doctype registered in the global `FrappeDocTypes` interface, `doc` is that
 * doctype's {@link DocOf} — closed, with typed fields — and
 * {@link Form.set_value} checks fieldnames and values against it. A `Form<"ToDo">`
 * is still assignable to `Form`, so every API typed against the plain `Form`
 * accepts it.
 */
export declare class Form<DT extends string = string> {
	constructor(
		doctype: DT,
		parent: HTMLElement,
		in_form?: boolean,
		doctype_layout_name?: string
	);

	// ---- constructor (frappe/public/js/frappe/form/form.js:65-93) ----
	docname: string;
	/** frappe/public/js/frappe/form/form.js:67 — the constructor's first argument. */
	doctype: DT;
	doctype_layout_name?: string;
	in_form: boolean;
	hidden: boolean;
	refresh_if_stale_for: number;
	opendocs: Record<string, boolean>;
	custom_buttons: Record<string, JQuery<HTMLElement>>;
	/**
	 * The block `set_intro` last added to the form — frappe/public/js/frappe/form/form.js:75, assigned at
	 * :1582. `null` until then, and after `set_intro` is called with no text.
	 */
	$intro_message: JQuery<HTMLElement> | null;
	sections: Section[];
	/**
	 * Every `ControlTable` on the form — frappe/public/js/frappe/form/form.js:77,
	 * filled at frappe/public/js/frappe/form/controls/table.js:16.
	 */
	grids: ControlTable[];
	/** The client-script controller instance — frappe/public/js/frappe/form/form.js:78. */
	cscript: FormController;
	events: Record<string, unknown>;
	fetch_dict: Record<string, unknown>;
	parent: HTMLElement;
	doctype_layout?: DocTypeMeta;
	undo_manager: UndoManager;
	debounced_reload_doc: () => void;
	beforeUnloadListener: (event: BeforeUnloadEvent) => string;

	// ---- setup_meta() (frappe/public/js/frappe/form/form.js:95-113) ----
	meta: DocTypeMeta;
	/** `frappe.perm.get_perm(doctype)`, indexed by permlevel — frappe/public/js/frappe/form/form.js:102. */
	perm: Permission[];
	action_perm_type_map: Record<string, string>;

	// ---- setup() (frappe/public/js/frappe/form/form.js:115-184) ----
	fields: LayoutFieldObject[];
	/** Shared with `layout.fields_dict` — frappe/public/js/frappe/form/form.js:291. See {@link LayoutFieldObject}. */
	fields_dict: Record<string, LayoutFieldObject>;
	state_fieldname?: string;
	wrapper: HTMLElement;
	$wrapper: JQuery<HTMLElement>;
	page: Page;
	layout_main: HTMLElement;
	/**
	 * frappe/public/js/frappe/form/form.js:144. Read defensively by app code because it does not exist until
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
	/** `.std-form-layout` — frappe/public/js/frappe/form/form.js:274. */
	body?: JQuery<HTMLElement>;

	// ---- per-document state ----
	/**
	 * The document being edited; only present once `refresh()` has run.
	 * {@link DocOf}`<DT>`: the registered shape for a registered doctype, the
	 * open {@link FrappeDoc} otherwise.
	 */
	doc: DocOf<DT>;
	save_disabled?: boolean;
	/**
	 * Set by whatever embeds a Form in a dialog — the Data Import dialog does
	 * (frappe/public/js/frappe/data_import/data_import_dialog.js:42). The
	 * constructor never initialises it. When truthy, `setup()` stops the page
	 * touching the underlying page's title and breadcrumbs (frappe/public/js/frappe/form/form.js:134-138),
	 * `refresh_header()` skips `frappe.utils.set_title` (frappe/public/js/frappe/form/form.js:796) and
	 * `Toolbar#set_title` does the same (frappe/public/js/frappe/form/toolbar.js:72).
	 */
	in_dialog?: boolean;
	/**
	 * The grid row whose detail form is open, or `null`.
	 * Set at frappe/public/js/frappe/form/grid_row.js:1405 and cleared at :1431 — both guarded on `cur_frm`.
	 */
	cur_grid?: GridRow | null;
	/**
	 * Set around `Layout#set_dependant_property` (frappe/public/js/frappe/form/layout.js:768, :777) and read by
	 * `Grid#refresh` (frappe/public/js/frappe/form/grid.js:654) to suppress a re-render mid-dependency-pass.
	 */
	setting_dependency?: boolean;
	footnote_area?: JQuery<HTMLElement>;
	__rename_queue?: string;

	// ---- methods (only the stable public surface) ----
	/** frappe/public/js/frappe/form/form.js:95-113. */
	setup_meta(): void;
	/** frappe/public/js/frappe/form/form.js:115-184. Builds the page, layout, toolbar and script manager. */
	setup(): void;
	/** frappe/public/js/frappe/form/form.js:444-521. `docname` switches document first. Also sets `cur_frm = this` (:453). */
	refresh(docname?: string): void;
	/**
	 * frappe/public/js/frappe/form/form.js:580-592. Nulls every grid's `visible_columns` and sends it back to
	 * page 1, which re-renders its rows (:582-586), BEFORE `docname` changes
	 * (:590) — see `Grid#visible_columns`.
	 */
	switch_doc(docname: string): void;
	/** frappe/public/js/frappe/form/form.js:745-755. */
	refresh_fields(): void;
	/** frappe/public/js/frappe/form/form.js:1513-1519. Refreshes one control plus layout dependencies/sections. */
	refresh_field(fname: string): void;
	/** frappe/public/js/frappe/form/form.js:821-829. */
	save_or_update(): void;
	/**
	 * frappe/public/js/frappe/form/form.js:831-847. While the save is in flight the button carries
	 * `aria-busy` next to `disabled` (:837), cleared again by `handle_save_fail`
	 * (frappe/public/js/frappe/form/form.js:1268) and by `frappe.ui.form.save` (frappe/public/js/frappe/form/save.js:41, :104) — the save
	 * promise does not settle on every validation-error path (:834-836).
	 */
	save(
		save_action?: string,
		callback?: (...args: unknown[]) => void,
		btn?: HTMLElement | JQuery,
		on_error?: (...args: unknown[]) => void
	): Promise<unknown>;
	/** frappe/public/js/frappe/form/form.js:1166-1171. */
	savetrash(): void;
	/** frappe/public/js/frappe/form/form.js:1502-1511. */
	reload_doc(): Promise<unknown> | undefined;
	/** frappe/public/js/frappe/form/form.js:1522-1539. */
	add_fetch(
		link_field: string,
		source_field: string,
		target_field: string,
		target_doctype?: string
	): void;
	/** frappe/public/js/frappe/form/form.js:1541-1543. */
	has_perm(ptype: string): boolean;
	/** frappe/public/js/frappe/form/form.js:1545-1551. Marks `doc.__unsaved` and fires the `dirty` event. */
	dirty(): void;
	/** frappe/public/js/frappe/form/form.js:1553-1555. */
	get_docinfo(): unknown;
	/** frappe/public/js/frappe/form/form.js:1557-1559. */
	is_dirty(): boolean;
	/** frappe/public/js/frappe/form/form.js:1561-1563. Returns `doc.__islocal`, which is `1 | undefined`. */
	is_new(): 1 | undefined;
	/**
	 * frappe/public/js/frappe/form/form.js:1572-1574. `this.perm[permlevel] ? this.perm[permlevel][access_type] : null`
	 * — `null` (not `false`) for an unknown permlevel, and `undefined` when that
	 * permlevel's row simply has no such key (the read-only perm map built by
	 * `set_read_only`, frappe/public/js/frappe/form/form.js:1984-1997, carries only six).
	 */
	get_perm(
		permlevel: number,
		access_type: string
	): boolean | 0 | 1 | null | undefined;
	/**
	 * frappe/public/js/frappe/form/form.js:1576-1584. Replaces the previous intro: the block remembered in
	 * `$intro_message` is removed first (:1577-1580), then `txt` — when truthy —
	 * is shown with `dashboard.set_headline_alert` (:1581-1583). A falsy `txt`
	 * therefore clears the intro; it used to pass straight through to the
	 * dashboard and never removed the block.
	 */
	set_intro(txt: string, color?: string): void;
	/** frappe/public/js/frappe/form/form.js:1586-1588. */
	set_footnote(txt: string): void;
	/** frappe/public/js/frappe/form/form.js:1590-1599. `group` creates/uses a dropdown. */
	add_custom_button(
		label: string,
		fn: () => void,
		group?: string
	): JQuery<HTMLElement> | undefined;
	/** frappe/public/js/frappe/form/form.js:1601-1603. */
	change_custom_button_type(label: string, group: string | null, type: string): void;
	/** frappe/public/js/frappe/form/form.js:1605-1609. */
	clear_custom_buttons(): void;
	/** frappe/public/js/frappe/form/form.js:1612-1633. */
	remove_custom_button(label: string, group?: string): void;
	/** frappe/public/js/frappe/form/form.js:1665-1667. */
	get_doc(): DocOf<DT>;
	/** frappe/public/js/frappe/form/form.js:1736-1752. `"*"` maps every field in `fields_dict`. */
	field_map(fnames: string | string[], fn: (df: DocField) => void): void;
	/**
	 * frappe/public/js/frappe/form/form.js:1754-1763. One argument reads a parent field; two read a child
	 * field of the Table named by the first. Returns whatever
	 * `frappe.meta.get_docfield` does — `null` when the doctype has no docfield
	 * map (frappe/public/js/frappe/model/meta.js:72-73) or `undefined` when it has no such fieldname — and
	 * the two-argument form throws if the first fieldname is unknown (:1757).
	 */
	get_docfield(fieldname1: string, fieldname2?: string): DocField | null | undefined;
	/**
	 * frappe/public/js/frappe/form/form.js:1765-1797. Passing `docname` + `table_field` targets a child
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
	/** frappe/public/js/frappe/form/form.js:1799-1803. Writes `read_only` as `0 | 1`. */
	toggle_enable(fnames: string | string[], enable: boolean): void;
	/** frappe/public/js/frappe/form/form.js:1805-1809. Writes `reqd` as a **boolean**, not `0 | 1`. */
	toggle_reqd(fnames: string | string[], mandatory: boolean): void;
	/** frappe/public/js/frappe/form/form.js:1811-1815. Writes `hidden` as `0 | 1`. */
	toggle_display(fnames: string | string[], show: boolean): void;
	/** frappe/public/js/frappe/form/form.js:1823-1835. */
	set_query(fieldname: string, opt1: unknown, opt2?: unknown): void;
	/** frappe/public/js/frappe/form/form.js:1837-1839. */
	clear_table(fieldname: string): void;
	/**
	 * frappe/public/js/frappe/form/form.js:1841-1861. Appends a child row and returns it. `values` is merged
	 * with `$.extend` **minus** `idx` and `name`, which are never overridden.
	 */
	add_child(fieldname: string, values?: Record<string, unknown>): ChildDoc;
	/**
	 * frappe/public/js/frappe/form/form.js:1863-1927. One field and its value,
	 * or a `{fieldname: value}` map (:1917-1926 walks the object form and ignores
	 * the second argument). For a registered `DT` the fieldname must be one of
	 * its fields and the value must fit that field's type; otherwise any
	 * fieldname and value are accepted, as before. A Table field also takes
	 * partial rows: frappe clears the table and `add_child`s a fresh row per
	 * element, copying everything but the standard fields (:1869-1897).
	 */
	set_value<F extends DocFieldName<DT>>(
		field: F,
		value: FormSetValueInput<DocFieldValue<DT, F>>,
		if_missing?: boolean,
		skip_dirty_trigger?: boolean
	): Promise<unknown>;
	set_value(
		values: { [F in DocFieldName<DT>]?: FormSetValueInput<DocFieldValue<DT, F>> },
		value?: undefined,
		if_missing?: boolean,
		skip_dirty_trigger?: boolean
	): Promise<unknown>;
	/** frappe/public/js/frappe/form/form.js:1929-1978. */
	call(
		opts: string | Record<string, unknown>,
		args?: Record<string, unknown>,
		callback?: (r: unknown) => void
	): Promise<unknown>;
	/** frappe/public/js/frappe/form/form.js:1980-1982. A raw `fields_dict` lookup, so a miss is `undefined`. */
	get_field(field: string): LayoutFieldObject | undefined;
	/** frappe/public/js/frappe/form/form.js:1999-2001. Delegates to `script_manager.trigger`. */
	trigger(event: string, doctype?: string, docname?: string): Promise<unknown>;
	/** frappe/public/js/frappe/form/form.js:2003-2010. */
	get_formatted(fieldname: string): string;
	/** frappe/public/js/frappe/form/form.js:2012-2014. Delegates to `frappe.ui.form.get_open_grid_form`. */
	open_grid_row(): GridRow | undefined;
	/** frappe/public/js/frappe/form/form.js:2016-2018. */
	get_title(): string;
	/** frappe/public/js/frappe/form/form.js:2020-2037. `[parentfield, name]` pairs of checked child rows. */
	get_selected(): Record<string, string[]>;
	/**
	 * frappe/public/js/frappe/form/form.js:2113-2133. Opens a new `doctype` document seeded from this form: a
	 * `make_methods[doctype]` handler wins (:2118-2119, and its result is
	 * returned), then a `custom_make_buttons[doctype]` button (:2120-2121),
	 * otherwise a quick-entry dialog over a new doc whose link fields
	 * `set_link_field` has filled in (:2123-2131). `fieldname` — new in 16.50 —
	 * restricts that fill to the one Link field of that name (the dashboard's
	 * "+ New" badges pass it, frappe/public/js/frappe/form/dashboard.js:345-348).
	 */
	make_new(doctype: string, fieldname?: string): unknown;
	/**
	 * frappe/public/js/frappe/form/form.js:2135-2158. Writes this form's name into `new_doc`'s Link field(s)
	 * to this doctype, and — without `fieldname` — copies any other Link /
	 * Dynamic Link value this form shares by fieldname. With `fieldname` only
	 * that one field is filled (:2140-2148). Recurses into required Table fields.
	 */
	set_link_field(doctype: string, new_doc: FrappeDoc | ChildDoc, fieldname?: string): void;
	/** frappe/public/js/frappe/form/form.js:2160-2172. */
	update_in_all_rows(
		table_fieldname: string,
		fieldname: string,
		value: unknown
	): void;
	/** frappe/public/js/frappe/form/form.js:2174-2180. */
	get_sum(table_fieldname: string, fieldname: string): number;
	/**
	 * frappe/public/js/frappe/form/form.js:2182-2218. Activates the field's tab, expands its section and
	 * scrolls it into view within `.main-section` — the scroll container is passed
	 * explicitly since 16.50 (:2200). Returns `false` when there is no such field
	 * or it has no wrapper (:2184, :2187) and `true` otherwise (:2217): callers
	 * such as `scroll_to_element` branch on it (:1640, :1651).
	 */
	scroll_to_field(fieldname: string, focus?: boolean): boolean;
	/** frappe/public/js/frappe/form/form.js:2292-2328. */
	set_active_tab(tab: Tab): void;
	/** frappe/public/js/frappe/form/form.js:2330-2332. */
	get_active_tab(): Tab | undefined;
	/**
	 * frappe/public/js/frappe/form/form.js:1465-1469. `"#<fieldname>"` of the active tab, or `""` when there is
	 * none or it is the `__details` pseudo-tab. `navigate_records` stores it in
	 * `frappe.route_hash` so the next record opens on the same tab (:1458).
	 */
	get_active_tab_hash(): string;
	/** frappe/public/js/frappe/form/form.js:1236-1239. */
	enable_save(): void;
	/** frappe/public/js/frappe/form/form.js:1241-1248. */
	disable_save(set_dirty?: boolean): void;
	/** frappe/public/js/frappe/form/form.js:1250-1256. */
	disable_form(): void;
}

/**
 * What {@link Form.set_value} accepts for a field whose document type is `V`:
 * `V` itself, plus — for a Table field — an array of partial rows, because
 * frappe builds the real rows from them (frappe/public/js/frappe/form/form.js:1869-1897).
 */
export type FormSetValueInput<V> = V extends readonly (infer R extends object)[]
	? V | ReadonlyArray<Partial<R>>
	: V;

/**
 * The desk-global "form currently on screen".
 *
 * `window.cur_frm = null` at frappe/public/js/frappe/provide.js:50, set to the active form at
 * frappe/public/js/frappe/form/form.js:453 (`cur_frm = this;` — a bare assignment to the global), and reset
 * to `null` when leaving a form route (frappe/public/js/frappe/views/pageview.js:99). frappe uses both
 * `cur_frm` and `window.cur_frm` interchangeably, so the globals module should
 * declare **both** a `var cur_frm` and a `Window["cur_frm"]` member with this
 * type.
 */
export type CurFrm = Form | null;

/* ========================================================================== *
 * Form events (form/script_manager.js)
 * ========================================================================== */

/**
 * Holder for {@link FormEventHandler}'s signature. Declared as a METHOD so the
 * handler type compares bivariantly in its parameters: a handler that declares
 * a NARROWER parameter than frappe's — `@param {frappe.ui.form.Form<"ToDo">} frm`
 * in a map typed for any doctype, or a literal `cdt` — still fits.
 *
 * A parameter of an unrelated type is still rejected, and rightly: frappe
 * registers EVERY function in the map as a handler for the event of that name
 * (frappe/public/js/frappe/form/script_manager.js:46-53), so a helper written
 * as `(frm, row)` would receive the doctype string as `row` the moment that
 * event fires. Keep such helpers outside the map.
 */
interface FormEventHandlerSignature<FrmDT extends string> {
	handler(frm: Form<FrmDT>, cdt: string, cdn: string): unknown;
}

/**
 * One handler registered with `frappe.ui.form.on`.
 *
 * `ScriptManager#trigger` calls it as `_function(me.frm, doctype, name)`
 * (frappe/public/js/frappe/form/script_manager.js:109): the form, then the
 * doctype and name of the document the event is about — the form's own for a
 * form event, the CHILD row's for a child-table event (`cdt` / `cdn` in frappe's
 * own scripts). There is no `this` binding: the handler is invoked through the
 * wrapper at :28-35.
 *
 * The return value is `unknown` because frappe accepts anything: a thenable is
 * awaited before the next handler runs (frappe/public/js/frappe/form/script_manager.js:114-118,
 * chained by `frappe.run_serially` at :141), and any other value is ignored.
 */
export type FormEventHandler<FrmDT extends string = string> = FormEventHandlerSignature<FrmDT>["handler"];

/**
 * The events frappe's form itself triggers, by name. Each is cited at its
 * trigger site; all run through `ScriptManager#trigger`, so all receive
 * `(frm, cdt, cdn)` as described on {@link FormEventHandler}.
 */
export interface StandardFormEvents<FrmDT extends string = string> {
	/** frappe/public/js/frappe/form/script_manager.js:259 — once per form, at the end of `ScriptManager#setup`; called immediately rather than queued (:123-125). */
	setup?: FormEventHandler<FrmDT>;
	/** frappe/public/js/frappe/form/form.js:629 — before a new document is rendered; `onload` waits for it. */
	before_load?: FormEventHandler<FrmDT>;
	/** frappe/public/js/frappe/form/form.js:630 — once per document opened in this form. */
	onload?: FormEventHandler<FrmDT>;
	/** frappe/public/js/frappe/form/form.js:674 — on every render of the form. */
	refresh?: FormEventHandler<FrmDT>;
	/** frappe/public/js/frappe/form/form.js:677-680 — after the first `refresh` of a document (`cscript.is_onload`). */
	onload_post_render?: FormEventHandler<FrmDT>;
	/** frappe/public/js/frappe/form/form.js:901 — before save; set `frappe.validated = false` to stop it (:904-907). */
	validate?: FormEventHandler<FrmDT>;
	/** frappe/public/js/frappe/form/form.js:902 — after `validate`, before the save request. */
	before_save?: FormEventHandler<FrmDT>;
	/** frappe/public/js/frappe/form/form.js:862 — after a successful save. */
	after_save?: FormEventHandler<FrmDT>;
	/** frappe/public/js/frappe/form/form.js:937 — after the submit confirmation; `frappe.validated = false` stops it (:938-940). */
	before_submit?: FormEventHandler<FrmDT>;
	/** frappe/public/js/frappe/form/form.js:950-951 — after a successful submit. */
	on_submit?: FormEventHandler<FrmDT>;
	/** frappe/public/js/frappe/form/form.js:1078 — `frappe.validated = false` stops the cancel (:1079-1081). */
	before_cancel?: FormEventHandler<FrmDT>;
	/** frappe/public/js/frappe/form/form.js:1090 — after a successful cancel. */
	after_cancel?: FormEventHandler<FrmDT>;
	/** frappe/public/js/frappe/form/form.js:922, :1124 — `frappe.validated = false` stops the discard (:1125-1127). */
	before_discard?: FormEventHandler<FrmDT>;
	/** frappe/public/js/frappe/form/form.js:1135 — after a successful discard. */
	after_discard?: FormEventHandler<FrmDT>;
	/** frappe/public/js/frappe/form/workflow.js:136 — before a workflow transition is applied; `frm.selected_workflow_action` holds the action (:135). */
	before_workflow_action?: FormEventHandler<FrmDT>;
	/** frappe/public/js/frappe/form/workflow.js:146 — after the transition has been applied and the form refreshed. */
	after_workflow_action?: FormEventHandler<FrmDT>;
	/** frappe/public/js/frappe/form/footer/form_timeline.js:20 — after the timeline re-renders. */
	timeline_refresh?: FormEventHandler<FrmDT>;
	/** frappe/public/js/frappe/form/dashboard.js:457 — after the connections counts arrive in `frm.dashboard_data`. */
	dashboard_update?: FormEventHandler<FrmDT>;
	/** frappe/public/js/frappe/form/form.js:141 — when the form's page is hidden. */
	on_hide?: FormEventHandler<FrmDT>;
	/** frappe/public/js/frappe/form/form.js:2315 — after `set_active_tab`. */
	on_tab_change?: FormEventHandler<FrmDT>;
	/**
	 * frappe/public/js/frappe/form/grid_row.js:1417 — a child row's detail form
	 * was opened. Triggered with the CHILD doctype, so register it on the child
	 * doctype (`frappe.ui.form.on("Sales Order Item", { form_render })`).
	 */
	form_render?: FormEventHandler<FrmDT>;
}

/**
 * The events map `frappe.ui.form.on(doctype, events)` takes — what a doctype's
 * `<doctype>.js` hands frappe.
 *
 * - `DT` is the doctype the handlers are registered on, the first argument of
 *   `frappe.ui.form.on`.
 * - `FrmDT` is the doctype of the form they run on. It defaults to
 *   {@link FormDocTypeOf}`<DT>`: `DT` itself, or — for a child table registered
 *   with a `parenttype` — its parent(s). Pass it explicitly to narrow a child
 *   table used by several parents.
 *
 * Besides the {@link StandardFormEvents}, any key is accepted, as frappe
 * accepts it (frappe/public/js/frappe/form/script_manager.js:46-53 registers every
 * function-valued key):
 *
 * - a fieldname — fired when that field changes (frappe/public/js/frappe/form/form.js:351,
 *   :373 for a child field), and for a Button field when it is clicked
 *   (frappe/public/js/frappe/form/controls/button.js:42);
 * - a child-table event, registered on the CHILD doctype: `<table>_add`
 *   (frappe/public/js/frappe/form/grid.js:1199), `before_<table>_remove` and
 *   `<table>_remove` (frappe/public/js/frappe/form/grid_row.js:100-113),
 *   `<table>_move` (frappe/public/js/frappe/form/grid.js:937-942),
 *   `<table>_delete` after a bulk delete (frappe/public/js/frappe/form/grid.js:389, :409);
 *   and `<table>_on_form_rendered` on the PARENT (frappe/public/js/frappe/form/grid_row.js:1416);
 * - a `depends_on: "fn:<name>"` callback (frappe/public/js/frappe/form/layout.js:810-815);
 * - a helper of your own, reached with `frm.trigger("<name>")`
 *   (frappe/public/js/frappe/form/form.js:1999-2001). It is called like any
 *   other handler, so it takes `(frm, cdt, cdn)` too.
 *
 * Handler parameters are checked against `(frm, cdt: string, cdn: string)` —
 * see {@link FormEventHandler}.
 *
 * For a registered `DT` its fieldnames are spelled out as well, so an editor
 * can complete them.
 */
export type FormEvents<DT extends string = string, FrmDT extends string = FormDocTypeOf<DT>> =
	StandardFormEvents<FrmDT> & { [F in DocFieldName<DT>]?: FormEventHandler<FrmDT> } & {
		[event: string]: FormEventHandler<FrmDT> | undefined;
	};

/**
 * `frappe.ui.form.handlers` — `frappe.provide("frappe.ui.form.handlers")` at
 * frappe/public/js/frappe/form/script_manager.js:4, keyed by doctype (or `"*"`, which every form
 * consults — :166-170) and then by event name. Each list holds the WRAPPED
 * handlers `on` pushed (:28-37), not the functions you passed.
 */
export type FormEventHandlerRegistry = Record<
	string,
	Record<string, FormEventHandler[] | undefined> | undefined
>;

/* ========================================================================== *
 * The frappe.ui.form namespace object itself
 * ========================================================================== */

/**
 * The runtime shape of `frappe.ui.form` (created by
 * `frappe.provide("frappe.ui.form")`, frappe/public/js/frappe/form/form.js:1).
 *
 * NO INDEX SIGNATURE (gaps.md §1e / §6.14). This interface used to end in
 * `[key: string]: unknown`, which meant a typo — `frappe.ui.form.Dailog`,
 * `frappe.ui.form.ControlLnik` — silently typed as `unknown` instead of being a
 * compile error, defeating the rule `core.d.ts` states for itself ("a typo like
 * `frappe.msgprnt` must still be a compile error"). Every name is enumerated
 * instead, from an exhaustive grep of `frappe/public/js/**` at v16.50.0 for
 * `frappe.ui.form.<name> =` (100 distinct names; all but two are assigned
 * under `frappe/public/js/frappe/form/**` — `AddressQuickEntryForm` and
 * `ContactQuickEntryForm` live in
 * `frappe/public/js/frappe/utils/address_and_contact.js:4`, `:22`).
 *
 * WHAT THE ENUMERATION CLAIMS, AND WHAT IT DOES NOT. The NAME of every member
 * below is source-verified — that assignment exists. The TYPE is only as strong
 * as this package has evidence for:
 *
 * - The 50 `Control*` classes are `typeof BaseControl`. Verified: every one is
 *   `class Control… extends frappe.ui.form.Control…`, and every chain
 *   terminates at `frappe.ui.form.Control` (= {@link BaseControl}) — see
 *   `controls/base_input.js` (`ControlInput`, the parent of `ControlData` and
 *   so of nearly every other control), `controls/html.js`, `controls/table.js`,
 *   `controls/multicheck.js` and `controls/image.js`, which are the five
 *   direct subclasses; the other 44 descend through those. This is
 *   also exactly how `make_control` resolves a fieldtype to a class
 *   (`frappe/public/js/frappe/form/controls/control.js:48`).
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
	/** frappe/public/js/frappe/form/controls/base_control.js:1. */
	Control: typeof BaseControl;
	/** frappe/public/js/frappe/form/controls/base_input.js:2. */
	ControlInput: typeof ControlInput;
	/** frappe/public/js/frappe/form/controls/table.js:3. The prototype-patch point for swapping the Grid. */
	ControlTable: typeof ControlTable;
	/** frappe/public/js/frappe/form/layout.js:5. */
	Layout: typeof Layout;
	/** frappe/public/js/frappe/form/form.js:64. */
	Form: typeof Form;
	/** frappe/public/js/frappe/form/form.js:18. */
	Controller: typeof FormController;
	/** frappe/public/js/frappe/form/toolbar.js:8. */
	Toolbar: typeof Toolbar;
	/** frappe/public/js/frappe/form/controls/control.js:48. */
	make_control: typeof make_control;
	/**
	 * frappe/public/js/frappe/form/grid.js:38-40 — `$(".grid-row-open").data("grid_row")`.
	 * A DOM query, not a registry: the open row is identified purely by the
	 * `.grid-row-open` class, which makes that class a cross-app contract
	 * (also read at frappe/public/js/frappe/form/layout.js:714 and frappe/public/js/frappe/ui/keyboard.js:337).
	 */
	get_open_grid_form(): GridRow | undefined;
	/**
	 * frappe/public/js/frappe/form/grid.js:42-50. Closes the open detail form **and** deactivates
	 * `editable_row`.
	 */
	close_grid_form(): void;
	/**
	 * The single row currently in on-grid-editing mode, desk-wide. `null` when
	 * none. Assigned at frappe/public/js/frappe/form/grid_row.js:1116 and cleared at :1144, both in
	 * `toggle_editable_row`; read at frappe/public/js/frappe/form/grid.js:47-48, :1075 and frappe/public/js/frappe/form/grid_row.js:1034,
	 * :1104-1105.
	 */
	editable_row: GridRow | null;
	/**
	 * frappe/public/js/frappe/form/form.js:36-62. The breadcrumb trail for a
	 * document: the list (omitted for a Single, and for the User list when the
	 * user cannot manage users) then the document's title as a last crumb with no
	 * `href`. Reads only `doctype`, `doc` and `meta` off its argument, because the
	 * print view passes a plain object rather than a `Form` (frappe/public/js/frappe/form/form.js:24-35). Fed
	 * to `Page#set_breadcrumbs` at frappe/public/js/frappe/form/form.js:810, which replaced the
	 * `frappe.breadcrumbs` calls `Form` used to make.
	 */
	get_breadcrumbs(frm: Pick<Form, "doctype" | "doc" | "meta">): Array<{
		label: string;
		href?: string;
	}>;
	/* -- Control classes, by fieldtype name (`controls/*.js`). All extend
	 * `frappe.ui.form.Control` = BaseControl; this is the registry
	 * `make_control` reads (frappe/public/js/frappe/form/controls/control.js:48). -------------------- */
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
	/** `form/sidebar/assign_to.js` */
	AssignToDialog: unknown;
	/** `form/sidebar/attachments.js` */
	Attachments: unknown;
	/** `form/dashboard.js — instance shape is the exported {@link Dashboard} interface` */
	Dashboard: unknown;
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
	/** `utils/address_and_contact.js` */
	AddressQuickEntryForm: unknown;
	/** `utils/address_and_contact.js` */
	ContactQuickEntryForm: unknown;
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
	/**
	 * frappe/public/js/frappe/form/script_manager.js:14-22 — the handler list for
	 * one doctype and event, created (empty) on first access.
	 */
	get_event_handler_list(doctype: string, fieldname: string): FormEventHandler[];
	/** `form/save.js` */
	is_saving: unknown;
	/** `form/quick_entry.js` */
	make_quick_entry: unknown;
	/**
	 * frappe/public/js/frappe/form/script_manager.js:60-73. Drops EVERY handler
	 * registered for `fieldname` on `doctype` — the `handler` argument is
	 * accepted and ignored — plus the open form's `events[fieldname]` and old-style
	 * `cscript[fieldname]` when the open form is that doctype.
	 */
	off(doctype: string, fieldname: string, handler?: FormEventHandler): void;
	/**
	 * frappe/public/js/frappe/form/script_manager.js:24-57 — registers form-event
	 * handlers for `doctype` (`"*"` for every doctype, :166-170).
	 *
	 * Two forms. With a map, every FUNCTION-valued key is registered and anything
	 * else is skipped (:46-53); `DT` is inferred from the first argument, so the
	 * handlers' `frm` is a `Form` of that doctype — of its parent, for a child
	 * table registered with a `parenttype` (see {@link FormEvents}). With a
	 * single event name, `handler` is registered for it (:55).
	 *
	 * A handler added while a form of `doctype` is open is also installed on
	 * that form's `events` (:39-43). Returns nothing.
	 */
	on<DT extends string>(doctype: DT, events: FormEvents<DT>): void;
	on<DT extends string>(
		doctype: DT,
		event: string,
		handler: FormEventHandler<FormDocTypeOf<DT>>
	): void;
	/** frappe/public/js/frappe/form/script_manager.js:24 — the same function as {@link FrappeUiFormNamespace.on}. */
	on_change: FrappeUiFormNamespace["on"];
	/** frappe/public/js/frappe/form/script_manager.js:4. See {@link FormEventHandlerRegistry}. */
	handlers: FormEventHandlerRegistry;
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
	/**
	 * frappe/public/js/frappe/form/script_manager.js:75-77 —
	 * `cur_frm.script_manager.trigger(fieldname, doctype)`. Runs on the form
	 * currently open, whatever its doctype, and throws when there is none
	 * (`cur_frm` is `null`). Discards the promise `trigger` returns.
	 */
	trigger(doctype: string, fieldname: string): void;
	/** `form/save.js` */
	update_calling_link: unknown;
}

/* ========================================================================== *
 * DOM contracts
 * ========================================================================== */

/**
 * Class names emitted by `Grid#make` (frappe/public/js/frappe/form/grid.js:96-171)
 * that other code selects on. Renaming any of them upstream silently breaks
 * selector-based integrations — which is why they are enumerated rather than
 * left as `string`.
 *
 * The footer buttons are es-buttons (`frappe.ui.button.html`, frappe/public/js/frappe/form/grid.js:116-166):
 * each carries `.es-button` plus the class named here, and its text sits in a
 * child `.es-button__label`, not directly in the button.
 *
 * `grid-remove-rows`, `grid-edit-rows`, `grid-remove-all-rows` and
 * `grid-duplicate-rows` also carry a `data-action` target
 * (frappe/public/js/frappe/form/grid.js:121, :127, :134, :140) bound by
 * `frappe.utils.bind_actions_with_object(this.wrapper, this)` (frappe/public/js/frappe/form/grid.js:178).
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
	| "grid-upload";

/**
 * Class names emitted by `GridRow` (frappe/public/js/frappe/form/grid_row.js:17, :25-26, :214-222, :248-264,
 * :341, :998, :1058-1059) plus the state classes other code keys off.
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
	/**
	 * Put on the last data column, and taken off the others, by `setup_columns`
	 * (frappe/public/js/frappe/form/grid_row.js:766-768): since 16.50 that column grows to fill the spare
	 * width. It replaces the `column-limit-reached` class on the grid container,
	 * which frappe no longer emits.
	 */
	| "grid-data-last"
	/** Added by `toggle_editable_row(true)` — frappe/public/js/frappe/form/grid_row.js:1108. */
	| "editable-row"
	/**
	 * Added by `show_form()` (frappe/public/js/frappe/form/grid_row.js:1406), removed by `hide_form()`
	 * (:1435). The cross-app "this row is open" contract — see
	 * {@link FrappeUiFormNamespace.get_open_grid_form}.
	 */
	| "grid-row-open";

/**
 * Class names emitted by `GridRowForm#make_form` —
 * frappe/public/js/frappe/form/grid_row_form.js:44-88. The `.grid-*-row`
 * buttons are wired in `set_form_events` (:96-122). They are es-buttons
 * (`frappe.ui.button.html`, :49-75), so each button's text is in a child
 * `.es-button__label`.
 *
 * `grid-append-row` — the footer's second "Insert Below" button, with its own
 * `.row-actions` wrapper — is gone since 16.50; the heading's
 * `.grid-insert-row-below` button and `.row-actions` remain.
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
	| "grid-delete-row";

/**
 * Class names emitted by the control layer that identify "an editor is open
 * here" — useful for hit-testing pointer events against live editing UI.
 *
 * `frappe-control` is every control's wrapper (frappe/public/js/frappe/form/controls/base_control.js:27);
 * `link-btn` is the Link control's open-record button (frappe/public/js/frappe/form/controls/link.js:17,
 * :28). The Awesomplete dropdown (`.awesomplete`, `[role="listbox"]`) is
 * created by `frappe/public/js/frappe/form/controls/link.js:225` and — importantly — **re-parented up to
 * `.grid-field`** by the cell `focusin` handler (frappe/public/js/frappe/form/grid_row.js:1003-1030), so it
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
 * renamed — frappe/public/js/frappe/form/toolbar.js:75-78, inside `set_title()`.
 *
 * Timing matters: it is applied from `frm.refresh() → toolbar.refresh() →
 * set_title()`, which can land **after** the page container becomes visible.
 * Code that waits for it must poll or observe rather than read once.
 */
export type EditableTitleClass = "editable-title";

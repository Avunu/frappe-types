/**
 * `frappe.ui.form` — Form, Layout, Toolbar, the `make_control` / Control class
 * hierarchy, FieldGroup and Dialog, `frappe.form.formatters`, and the DOM
 * contracts of the Grid family. `Grid`, `GridRow`, `GridRowForm` and
 * `GridPagination` themselves are declared in `deep-modules.d.ts` and
 * re-exported from here.
 *
 * Source of truth: frappe v16.54.0 (`git tag v16.54.0`, branch `version-16`),
 * `frappe/public/js/frappe/form/**`. Every signature below was read out of that
 * tree. The 16.50 migration then re-read the declarations against 16.50.0, and
 * the citations are now full paths (`frappe/public/js/frappe/form/layout.js:106-141`)
 * carrying v16.54.0 line numbers. A `:N` that follows one inside the same comment
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
	DocOf,
	DocTypeMeta,
	FormatterOptions,
	FormDocTypeOf,
	FormSetValueArgs,
	FrappeDoc,
	LinkQuery,
	Permission,
	SelectOption,
} from "../model";
import type { FrappeFileUploader, FrappeFileUploaderOptions } from "./components";

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
 * `frm.call` returns `frappe.call`'s jqXHR (`frappe/public/js/frappe/form/form.js:1981`),
 * so it shares the request types `core.d.ts` owns. Another type-only cycle.
 */
import type { FrappeAjaxResult, FrappeCallOptions, FrappeResponse } from "../core";

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
 * (frappe/public/js/frappe/form/grid.js:1571) and `BaseControl#can_write`
 * (frappe/public/js/frappe/form/controls/base_input.js:144-146).
 */
export type DisplayStatus = "Write" | "Read" | "None";

/**
 * A `depends_on` / `mandatory_depends_on` / `read_only_depends_on` /
 * `collapsible_depends_on` expression.
 *
 * Four accepted shapes, all handled in the same block —
 * frappe/public/js/frappe/form/grid_row.js:834-868 and
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
 * (frappe/public/js/frappe/form/grid_row.js:423-432 and :618-629) and by a
 * header drag-resize (frappe/public/js/frappe/form/grid.js:604-616), and read
 * back by `Grid#setup_user_defined_columns`
 * (frappe/public/js/frappe/form/grid.js:1548-1569).
 *
 * Since 16.50 a column's size is a **pixel width**, not a Bootstrap span: every
 * writer stores `width`, and `Grid#visible_columns` pairs each docfield with a
 * pixel number clamped to 60-600
 * (frappe/public/js/frappe/form/grid.js:1530-1542). Rows saved by an older
 * frappe carry a 1-12 `columns` span instead; the reader still accepts them and
 * migrates through `LEGACY_COLSIZE_TO_PX`
 * (frappe/public/js/frappe/form/grid.js:1562). Both keys are therefore optional
 * here — this is the persisted shape, and a stored row may hold either.
 */
export interface GridViewColumn {
	fieldname: string;
	/** Pixel width — frappe/public/js/frappe/form/grid_row.js:428, :625. */
	width?: number;
	/**
	 * Legacy 1-12 Bootstrap span, written by frappe before 16.50 and still read
	 * (frappe/public/js/frappe/form/grid.js:1562). Nothing writes it now.
	 */
	columns?: number;
	/**
	 * `cint(checkbox.checked)` from the dialog
	 * (frappe/public/js/frappe/form/grid_row.js:626) and `df.sticky ? 1 : 0` from
	 * a resize (frappe/public/js/frappe/form/grid.js:614). The dialog's initial
	 * snapshot copies `row[0].sticky` verbatim
	 * (frappe/public/js/frappe/form/grid_row.js:429), so a row that never had the
	 * flag set can read back without the key.
	 */
	sticky?: 0 | 1;
}

/*
 * `GridFilter` — one entry of `Grid#filter` (frappe/public/js/frappe/form/grid_row.js:285-288, :930-933) —
 * was declared here as `{ df: DocField; value: string }` and, more precisely, in
 * `deep-modules.d.ts` as `{ df: GridDocField; value: string }`. It moved with
 * the rest of the Grid family; this file re-exports it below, so
 * `import type { GridFilter } from "frappe-types"` is unaffected.
 */

/**
 * The SortableJS instance frappe binds to the grid's `.rows` container
 * (frappe/public/js/frappe/form/grid.js:913-953).
 *
 * SEAM NOTE — `deep-modules.d.ts` declares the same shape as `GridSortable`,
 * and that is the one `Grid#grid_sortable` is typed with. Both names survive
 * (they are structurally identical and neither collides), but new code should
 * prefer `GridSortable`.
 *
 * Only `option()` is called by frappe itself — from the grid search handlers
 * (frappe/public/js/frappe/form/grid_row.js:294-299, :939-944), to disable
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
 * calls are declared (frappe/public/js/frappe/form/form.js:684, :809, :1291-1315, :1583, :2431).
 */
export interface Dashboard {
	refresh(): void;
	after_refresh(): void;
	clear_headline(): void;
	/**
	 * frappe/public/js/frappe/form/dashboard.js:663-665. Returns whatever
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
	 * frappe/public/js/frappe/form/dashboard.js:684-690. Wraps `text` in a
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
 * (frappe/public/js/frappe/form/layout.js:261-269, frappe/public/js/frappe/form/grid_row.js:1150-1162).
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
	/** Set for on-grid-editing controls — frappe/public/js/frappe/form/grid_row.js:1159. */
	grid?: Grid;
	/** Set for on-grid-editing controls — frappe/public/js/frappe/form/grid_row.js:1160. */
	grid_row?: GridRow;
	/** When true the constructor calls `refresh()` — frappe/public/js/frappe/form/controls/base_control.js:5-7. */
	render_input?: boolean;
	/** Suppresses the label/description scaffolding — frappe/public/js/frappe/form/controls/base_input.js:17-19. */
	only_input?: boolean;
	with_link_btn?: boolean;
	value?: unknown;
	/**
	 * Read, never written, by the controls that render read-only without
	 * `df.read_only`: `ControlCode` (frappe/public/js/frappe/form/controls/code.js:79),
	 * `ControlTextEditor` (frappe/public/js/frappe/form/controls/text_editor.js:444),
	 * `ControlRating` (frappe/public/js/frappe/form/controls/rating.js:21) and
	 * `ControlGeolocation` (frappe/public/js/frappe/form/controls/geolocation.js:62).
	 */
	disabled?: boolean;
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
 *
 * The optional fields of the control classes are spelled `?: T | undefined`.
 * frappe's own subclasses assign them in methods (`this.input =
 * this.$input.get(0)`, frappe/public/js/frappe/form/controls/data.js:65), and
 * a JavaScript subclass that does the same is checked as declaring the field
 * again, with `undefined` in its type; under `exactOptionalPropertyTypes` that
 * only matches a base field that admits `undefined` too.
 */
export declare class BaseControl {
	constructor(opts: ControlOptions);

	// ---- fields merged in by `$.extend(this, opts)` (frappe/public/js/frappe/form/controls/base_control.js:3) ----
	df: DocField;
	parent: HTMLElement | JQuery;
	doctype?: string | undefined;
	docname?: string | undefined;
	doc?: FrappeDoc | ChildDoc | undefined;
	frm?: Form | undefined;
	layout?: Layout | undefined;
	grid?: Grid | undefined;
	grid_row?: GridRow | undefined;
	only_input?: boolean | undefined;
	render_input?: boolean | undefined;
	with_link_btn?: boolean | undefined;
	/** See {@link ControlOptions.disabled}. Only ever merged in from the options. */
	disabled?: boolean | undefined;
	/** The tab this control's section belongs to — set by `Tab#add_field`. */
	tab?: Tab | undefined;

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
	disp_status?: DisplayStatus | undefined;
	/** The control's current (unparsed) value. */
	value?: unknown;
	/** Last value pushed to the model — frappe/public/js/frappe/form/controls/base_control.js:274. */
	last_value?: unknown;
	/** Re-entrancy guard around the change event — frappe/public/js/frappe/form/controls/base_control.js:217, :231. */
	inside_change_event?: boolean | undefined;

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
	/**
	 * frappe/public/js/frappe/form/controls/base_control.js:210-213. `e` is the
	 * jQuery event that triggered the change (frappe/public/js/frappe/form/controls/data.js:175-181,
	 * frappe/public/js/frappe/form/controls/rating.js:88), handed on to
	 * `df.change` / `df.onchange` (see {@link DocField.change}).
	 */
	parse_validate_and_set_in_model(value: unknown, e?: JQuery.TriggeredEvent | null): Promise<unknown>;
	/** frappe/public/js/frappe/form/controls/base_control.js:214-260. `set_value` passes `e` as `null` (:207-208). */
	validate_and_set_in_model(
		value: unknown,
		e?: JQuery.TriggeredEvent | null,
		force_set_value?: boolean
	): Promise<unknown>;
	/** frappe/public/js/frappe/form/controls/base_control.js:261-271. */
	get_value(): unknown;
	/** frappe/public/js/frappe/form/controls/base_control.js:272-289. */
	set_model_value(value: unknown): Promise<unknown>;
	/**
	 * frappe/public/js/frappe/form/controls/base_control.js:290-295. Returns `true`
	 * after focusing `$input`, and `undefined` when there is none. `void` is in the
	 * union because the overrides return nothing (`ControlCode#set_focus`,
	 * frappe/public/js/frappe/form/controls/code.js:255-257;
	 * `ControlTextEditor#set_focus`,
	 * frappe/public/js/frappe/form/controls/text_editor.js:598-600), so a subclass
	 * may as well.
	 */
	set_focus(): boolean | void;

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

	/** Copied from `Grid#get_field(fieldname).get_query` — frappe/public/js/frappe/form/grid_row.js:1164. */
	get_query?: unknown;
	/**
	 * Only `ControlCode` and its subclasses set it: the Ace editor, see
	 * {@link ControlCode.editor}. `Layout#set_focus` calls `field.editor.set_focus()`
	 * on whatever is there (frappe/public/js/frappe/form/layout.js:706-707), but
	 * the Ace editor has no `set_focus` (code.js focuses it with `editor.focus()`,
	 * frappe/public/js/frappe/form/controls/code.js:256), so the base declares
	 * nothing about its shape. Narrow to `ControlCode` to use it.
	 */
	editor?: unknown;
	/**
	 * `ControlLink`'s Awesomplete instance — frappe/public/js/frappe/form/controls/link.js:225.
	 * `close()` is the one method `Grid#make`'s horizontal-scroll listener calls on it
	 * (frappe/public/js/frappe/form/grid.js:187).
	 */
	awesomplete?: { ul: HTMLElement; list: unknown; close(): void; [key: string]: unknown } | undefined;
	/** `ControlLink`'s `.link-btn` handle — frappe/public/js/frappe/form/controls/link.js:28. */
	$link?: JQuery<HTMLElement> | undefined;
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
	label_area?: HTMLElement | undefined;
	/** Same node as `label_area` — frappe/public/js/frappe/form/controls/base_input.js:51. */
	label_span?: HTMLElement | undefined;
	/** `.control-input-wrapper` — frappe/public/js/frappe/form/controls/base_input.js:53. */
	$input_wrapper?: JQuery<HTMLElement> | undefined;
	/** `.control-value` read-only display area — frappe/public/js/frappe/form/controls/base_input.js:56. */
	disp_area?: HTMLElement | undefined;
	/**
	 * The control's input element, once `make_input()` has run. Not always an
	 * `<input>`: `ControlData#make_input` builds whatever tag the class's static
	 * `html_element` names (frappe/public/js/frappe/form/controls/data.js:10-17),
	 * which is a `<select>` for `ControlSelect`
	 * (frappe/public/js/frappe/form/controls/select.js:2) and a `<textarea>` for
	 * `ControlText` (frappe/public/js/frappe/form/controls/text.js:2), and
	 * `ControlAttach` and `ControlButton` put a `<button>` here
	 * (frappe/public/js/frappe/form/controls/attach.js:4,
	 * frappe/public/js/frappe/form/controls/button.js:24). The subclasses that fix
	 * the tag narrow it.
	 */
	$input?: JQuery<HTMLElement> | undefined;
	/** `this.$input.get(0)` — frappe/public/js/frappe/form/controls/data.js:65. See {@link ControlInput.$input}. */
	input?: HTMLElement | undefined;
	/** Latched by `make_input()` — frappe/public/js/frappe/form/controls/data.js:66. */
	has_input?: boolean | undefined;

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

/* -------------------------------------------------------------------------- *
 * The concrete control classes
 *
 * Each `frappe.ui.form.Control<Fieldtype>` is a class expression extending
 * another one (`frappe.ui.form.ControlData = class ControlData extends
 * frappe.ui.form.ControlInput`, frappe/public/js/frappe/form/controls/data.js:3),
 * so each is declared here with the members its own file defines and the rest
 * inherited, which is what lets an app write
 * `class extends frappe.ui.form.ControlData { make_input() { super.make_input(); } }`.
 *
 * A return type is `void` where the body was read and returns nothing, and
 * `unknown` where frappe's own overrides disagree or the value is a
 * third-party object. Parameters frappe calls without are optional.
 * -------------------------------------------------------------------------- */

/**
 * The editor `ace.edit()` returns, as `ControlCode` keeps it
 * (frappe/public/js/frappe/form/controls/code.js:61). Ace is a third-party
 * library that frappe loads at runtime (`load_lib`, code.js:259-276), so only
 * the members frappe itself calls are declared; merge more into this
 * interface if you need them.
 */
export interface ControlCodeAceEditor {
	/** The edit session — frappe/public/js/frappe/form/controls/code.js:92, :227, :246, :252. */
	session: ControlCodeAceSession;
	/** frappe/public/js/frappe/form/controls/markdown_editor.js:13. The same object as {@link ControlCodeAceEditor.session}. */
	getSession(): ControlCodeAceSession;
	/** frappe/public/js/frappe/form/controls/code.js:64-65, :85-87 (`maxLines`, `minLines`, `placeholder`, `showPrintMargin`, `wrap`). */
	setOption(name: string, value: unknown): unknown;
	/** frappe/public/js/frappe/form/controls/code.js:121-124, :168-171. */
	setOptions(options: Record<string, unknown>): unknown;
	/** frappe/public/js/frappe/form/controls/code.js:80. */
	setReadOnly(read_only: boolean): unknown;
	/** frappe/public/js/frappe/form/controls/code.js:84 (`"ace/theme/tomorrow"`). */
	setTheme(theme: string): unknown;
	/** frappe/public/js/frappe/form/controls/code.js:228-230; `null` at frappe/public/js/frappe/ui/dropdown_console.js:100. */
	setKeyboardHandler(handler: string | null): unknown;
	/** frappe/public/js/frappe/form/controls/code.js:181, :185. */
	resize(): unknown;
	/** frappe/public/js/frappe/form/controls/code.js:256. */
	focus(): unknown;
	/** frappe/public/js/print_format_builder/composables/useHtmlEditorDialog.js:77. */
	getValue(): string;
	/** frappe/public/js/print_format_builder/composables/useHtmlEditorDialog.js:75-78. */
	on(event: string, handler: (...args: unknown[]) => unknown): unknown;
	/** frappe/public/js/frappe/ui/dropdown_console.js:92 — inserts at the cursor. */
	insert(text: string): unknown;
	/** frappe/public/js/frappe/form/controls/markdown_editor.js:97 — passed straight back to `session.insert`. */
	getCursorPosition(): unknown;
	/** frappe/public/js/frappe/ui/dropdown_console.js:101-112. */
	commands: { addCommand(command: Record<string, unknown>): unknown };
}

/** The Ace edit session behind {@link ControlCodeAceEditor.session}; only the members frappe calls. */
export interface ControlCodeAceSession {
	/** frappe/public/js/frappe/form/controls/code.js:92-95 (`"change"`). */
	on(event: string, handler: (...args: unknown[]) => unknown): unknown;
	/** frappe/public/js/frappe/form/controls/code.js:227, frappe/public/js/frappe/form/controls/json.js:3. */
	setMode(mode: string): unknown;
	/** frappe/public/js/frappe/form/controls/code.js:246. */
	setValue(value: string): unknown;
	/** frappe/public/js/frappe/form/controls/code.js:252. */
	getValue(): string;
	/** frappe/public/js/frappe/form/controls/markdown_editor.js:13. */
	setUseWrapMode(wrap: boolean): unknown;
	/** frappe/public/js/frappe/form/controls/markdown_editor.js:96-99. */
	insert(position: unknown, text: string): unknown;
}

/**
 * The Quill instance `ControlTextEditor` builds
 * (frappe/public/js/frappe/form/controls/text_editor.js:201). Quill is a
 * third-party library; only the members frappe calls are declared.
 */
export interface ControlTextEditorQuill {
	/** The `.ql-editor` element — frappe/public/js/frappe/form/controls/text_editor.js:388, :555. */
	root: HTMLElement;
	/** frappe/public/js/frappe/form/controls/text_editor.js:378 (`"text-change"`). */
	on(event: string, handler: (...args: unknown[]) => unknown): unknown;
	/** frappe/public/js/frappe/form/controls/text_editor.js:202, :353, :400 (`"toolbar"`, `"table"`, `"imageResize"`). */
	getModule(name: string): unknown;
	/** frappe/public/js/frappe/form/controls/text_editor.js:540, frappe/public/js/frappe/form/controls/comment.js:98. */
	setText(text: string): unknown;
	/** frappe/public/js/frappe/form/controls/text_editor.js:551. */
	setContents(delta: unknown): unknown;
	/** frappe/public/js/frappe/form/controls/text_editor.js:545-550. */
	clipboard: { convert(content: { html: string; text: string }, formats?: Record<string, unknown>): unknown };
	/** frappe/public/js/frappe/form/controls/text_editor.js:599. */
	focus(): unknown;
	/** frappe/public/js/frappe/form/controls/comment.js:102. */
	disable(): unknown;
	/** frappe/public/js/frappe/form/controls/comment.js:107. */
	enable(): unknown;
}

/**
 * `frappe.ui.form.ControlData` — frappe/public/js/frappe/form/controls/data.js:3,
 * extending `ControlInput`. The base of nearly every input control; also
 * registered as `ControlReadOnly` (data.js:336).
 */
export declare class ControlData extends ControlInput {
	/** frappe/public/js/frappe/form/controls/data.js:4 — the tag `make_input` builds (`$("<" + html_element + ">")`, :10-12). */
	static html_element: string;
	/** frappe/public/js/frappe/form/controls/data.js:5 — its `type` attribute (:13). */
	static input_type: string;
	/**
	 * The `inputmode` attribute (frappe/public/js/frappe/form/controls/data.js:10, :14).
	 * Unset here; `ControlInt` sets `"numeric"` (frappe/public/js/frappe/form/controls/int.js:4)
	 * and `ControlFloat` `"decimal"` (frappe/public/js/frappe/form/controls/float.js:2).
	 */
	static input_mode?: string;
	/** frappe/public/js/frappe/form/controls/data.js:6 — also bind the change handler to `input`, debounced (:184-187). */
	static trigger_change_on_input_event: boolean;
	/**
	 * Read at frappe/public/js/frappe/form/controls/data.js:189 — mark the form
	 * dirty on `input` without parsing. Set by `ControlInt`
	 * (frappe/public/js/frappe/form/controls/int.js:3).
	 */
	static trigger_dirty_on_input_event?: boolean;

	/** The URL field's open button — frappe/public/js/frappe/form/controls/data.js:91. */
	$link_open?: JQuery<HTMLElement> | undefined;
	/** The Barcode-option scan button — frappe/public/js/frappe/form/controls/data.js:155. */
	$scan_btn?: JQuery<HTMLElement> | undefined;
	/** `frappe.get_meta(df.parent)` — frappe/public/js/frappe/form/controls/data.js:197. */
	meta?: DocTypeMeta | null | undefined;
	/** The pending name-exists check — frappe/public/js/frappe/form/controls/data.js:211, :227-229. */
	last_check?: ReturnType<typeof setTimeout> | null | undefined;
	/**
	 * A change handler merged in from the options. When set it replaces the
	 * default parse-and-set on `change` (frappe/public/js/frappe/form/controls/data.js:176-181).
	 */
	change?(e: JQuery.TriggeredEvent): unknown;

	/**
	 * frappe/public/js/frappe/form/controls/data.js:7-79. A no-op once `$input`
	 * exists (:8). Builds the input into `input_area`, sets `input` and
	 * `has_input`, then binds the change event and the URL / Barcode / IBAN extras.
	 */
	make_input(): void;
	/** frappe/public/js/frappe/form/controls/data.js:81-122. */
	setup_url_field(): void;
	/** frappe/public/js/frappe/form/controls/data.js:124-128. */
	setup_iban_field(): void;
	/** frappe/public/js/frappe/form/controls/data.js:130-144. Only when `df.with_copy_button`. */
	setup_copy_button(): void;
	/** frappe/public/js/frappe/form/controls/data.js:146-173. */
	setup_barcode_field(): void;
	/** frappe/public/js/frappe/form/controls/data.js:175-194. */
	bind_change_event(): void;
	/** frappe/public/js/frappe/form/controls/data.js:195-233. */
	setup_autoname_check(): void;
	/** frappe/public/js/frappe/form/controls/data.js:234-267 — maxlength, data attributes, placeholder, `input_css` / `input_class`, alignment. */
	set_input_attributes(): void;
	/** frappe/public/js/frappe/form/controls/data.js:268-274 — stores the value, then `set_formatted_input`, `set_disp_area` and `set_mandatory`. */
	set_input(value: unknown): void;
	/** frappe/public/js/frappe/form/controls/data.js:275-277 — `$input.val(format_for_input(value))`. */
	set_formatted_input(value: unknown): void;
	/** frappe/public/js/frappe/form/controls/data.js:278-280 — `$input.val()`, or `undefined` before `make_input`. */
	get_input_value(): unknown;
	/** frappe/public/js/frappe/form/controls/data.js:281-286 — `""` for a nullish value, the formatted IBAN for an IBAN field. */
	format_for_input(val: unknown): unknown;
	/** frappe/public/js/frappe/form/controls/data.js:287-292 — strips spaces from an IBAN, else the value unchanged. */
	parse(value: unknown): unknown;
	/**
	 * frappe/public/js/frappe/form/controls/data.js:293-326 — `""` for a falsy
	 * value; for the Phone / Name / Email / URL options it sets `df.invalid`.
	 */
	validate(v: unknown): unknown;
	/** frappe/public/js/frappe/form/controls/data.js:327-330. */
	toggle_container_scroll(el_class: string, scroll_class: string, add?: boolean): void;
	/** frappe/public/js/frappe/form/controls/data.js:331-333 — the grid this control is editing in, if any. */
	in_grid(): Grid | undefined;
}

/**
 * `frappe.ui.form.ControlSelect` — frappe/public/js/frappe/form/controls/select.js:1.
 * The input is a `<select>` (`static html_element = "select"`, :2).
 */
export declare class ControlSelect extends ControlData {
	override $input?: JQuery<HTMLSelectElement> | undefined;
	override input?: HTMLSelectElement | undefined;
	/** `JSON.stringify` of the options last rendered — frappe/public/js/frappe/form/controls/select.js:70-73. */
	last_options?: string | undefined;

	/** frappe/public/js/frappe/form/controls/select.js:4-13. */
	override make_input(): void;
	/** frappe/public/js/frappe/form/controls/select.js:14-26. `is_xs_input` is tested for truthiness only. */
	set_icon(is_xs_input?: unknown): void;
	/** frappe/public/js/frappe/form/controls/select.js:27-40. */
	set_placeholder(is_xs_input?: unknown): void;
	/**
	 * frappe/public/js/frappe/form/controls/select.js:41-60. Re-renders the
	 * options first; when the value is not among them, writes what the
	 * `<select>` did select back to the model (:55-59).
	 */
	override set_formatted_input(value: unknown): void;
	/**
	 * frappe/public/js/frappe/form/controls/select.js:61-89. Splits a string
	 * `df.options` on newlines; a no-op when the options have not changed.
	 */
	set_options(value?: unknown): void;
	/** frappe/public/js/frappe/form/controls/select.js:90-104 — the form's attachment URLs, `undefined` without a form. */
	get_file_attachment_list(): string[] | undefined;
	/** frappe/public/js/frappe/form/controls/select.js:105-108. */
	toggle_placeholder(): void;
}

/**
 * `frappe.ui.form.ControlText` — frappe/public/js/frappe/form/controls/text.js:1,
 * also registered as `ControlLongText` (text.js:23). The input is a
 * `<textarea>` (`static html_element = "textarea"`, :2), and the class is not
 * horizontal (:3).
 */
export declare class ControlText extends ControlData {
	override $input?: JQuery<HTMLTextAreaElement> | undefined;
	override input?: HTMLTextAreaElement | undefined;
	/** frappe/public/js/frappe/form/controls/text.js:4-13. */
	override make_wrapper(): void;
	/** frappe/public/js/frappe/form/controls/text.js:14-20 — 300px high, capped by `df.max_height`. */
	override make_input(): void;
}

/** `frappe.ui.form.ControlSmallText` — frappe/public/js/frappe/form/controls/text.js:24. */
export declare class ControlSmallText extends ControlText {
	/** frappe/public/js/frappe/form/controls/text.js:25-28 — 150px high. */
	override make_input(): void;
}

/**
 * `frappe.ui.form.ControlCode` — frappe/public/js/frappe/form/controls/code.js:1.
 * An Ace editor in place of the `<textarea>`: `make_input` loads Ace and builds
 * the editor (:2-5), so `$input` is never set.
 */
export declare class ControlCode extends ControlText {
	/**
	 * The Ace editor, once `make_ace_editor` has run
	 * (frappe/public/js/frappe/form/controls/code.js:61). `undefined` until Ace has
	 * loaded, which is asynchronous (:4).
	 */
	override editor?: ControlCodeAceEditor | undefined;
	/** The copy button shown when not writable — frappe/public/js/frappe/form/controls/code.js:17-18, :26. */
	copy_button?: JQuery<HTMLElement> | null | undefined;
	/** The element Ace is mounted in — frappe/public/js/frappe/form/controls/code.js:47. */
	ace_editor_target?: JQuery<HTMLElement> | undefined;
	/** frappe/public/js/frappe/form/controls/code.js:67, :72. */
	expanded?: boolean | undefined;
	/** frappe/public/js/frappe/form/controls/code.js:68-76. */
	$expand_button?: JQuery<HTMLElement> | undefined;
	/** Suppresses the change handler while `set_formatted_input` writes — frappe/public/js/frappe/form/controls/code.js:89, :245-247. */
	is_setting_content?: boolean | undefined;
	/** frappe/public/js/frappe/form/controls/code.js:263-265. */
	root_lib_path?: string | undefined;
	/** The promise `load_lib` caches — frappe/public/js/frappe/form/controls/code.js:268. */
	library_loaded?: Promise<void> | undefined;

	/** frappe/public/js/frappe/form/controls/code.js:2-5. */
	override make_input(): void;
	/** frappe/public/js/frappe/form/controls/code.js:7-13. */
	override refresh(): void;
	/** frappe/public/js/frappe/form/controls/code.js:15-43. */
	override setup_copy_button(): void;
	/** frappe/public/js/frappe/form/controls/code.js:45-128. */
	make_ace_editor(): void;
	/** frappe/public/js/frappe/form/controls/code.js:130-177. */
	setup_autocompletion(customGetCompletions?: unknown): void;
	/** frappe/public/js/frappe/form/controls/code.js:179-182. */
	refresh_height(): void;
	/** frappe/public/js/frappe/form/controls/code.js:184-186. */
	override on_section_collapse(hide: boolean): void;
	/** frappe/public/js/frappe/form/controls/code.js:188-190 — relabels the expand button; it shadows `ControlInput#toggle_label`. */
	override toggle_label(): void;
	/** frappe/public/js/frappe/form/controls/code.js:192-196. */
	get_button_label(): string;
	/** frappe/public/js/frappe/form/controls/code.js:198-231 — maps `df.options` to an Ace mode. */
	set_language(): void;
	/** frappe/public/js/frappe/form/controls/code.js:233-238 — `""` for a nullish value. */
	override parse(value: unknown): unknown;
	/**
	 * frappe/public/js/frappe/form/controls/code.js:240-249. Returns the
	 * `load_lib()` promise, which `ControlMarkdownEditor` chains on
	 * (frappe/public/js/frappe/form/controls/markdown_editor.js:55); its own
	 * override returns nothing, hence `unknown`.
	 */
	override set_formatted_input(value: unknown): unknown;
	/** frappe/public/js/frappe/form/controls/code.js:251-253 — `""` before the editor exists. */
	override get_input_value(): string;
	/** frappe/public/js/frappe/form/controls/code.js:255-257. */
	override set_focus(): void;
	/** frappe/public/js/frappe/form/controls/code.js:259-276 — requires Ace once and caches the promise. */
	load_lib(): Promise<void>;
}

/** `frappe.ui.form.ControlJSON` — frappe/public/js/frappe/form/controls/json.js:1. */
export declare class ControlJSON extends ControlCode {
	/** frappe/public/js/frappe/form/controls/json.js:2-5 — always JSON mode. */
	override set_language(): void;
}

/** `frappe.ui.form.ControlMarkdownEditor` — frappe/public/js/frappe/form/controls/markdown_editor.js:1. */
export declare class ControlMarkdownEditor extends ControlCode {
	/** frappe/public/js/frappe/form/controls/markdown_editor.js:4 — the CSS prefix of its container and preview. */
	static editor_class: string;
	/** frappe/public/js/frappe/form/controls/markdown_editor.js:11. */
	markdown_container?: JQuery<HTMLElement> | undefined;
	/** frappe/public/js/frappe/form/controls/markdown_editor.js:15, :29. */
	showing_preview?: boolean | undefined;
	/** frappe/public/js/frappe/form/controls/markdown_editor.js:16. */
	preview_toggle_btn?: JQuery<HTMLElement> | undefined;
	/** frappe/public/js/frappe/form/controls/markdown_editor.js:35. */
	markdown_preview?: JQuery<HTMLElement> | undefined;
	/** frappe/public/js/frappe/form/controls/markdown_editor.js:5-39. */
	override make_ace_editor(): void;
	/** frappe/public/js/frappe/form/controls/markdown_editor.js:41-46 — defaults `df.options` to `"Markdown"`. */
	override set_language(): void;
	/** frappe/public/js/frappe/form/controls/markdown_editor.js:48-52. */
	update_preview(): void;
	/** frappe/public/js/frappe/form/controls/markdown_editor.js:54-58. Returns nothing. */
	override set_formatted_input(value: unknown): void;
	/** frappe/public/js/frappe/form/controls/markdown_editor.js:60-62 — the raw text. */
	override set_disp_area(value: unknown): void;
	/** frappe/public/js/frappe/form/controls/markdown_editor.js:64-103. */
	setup_image_drop(): void;
}

/** `frappe.ui.form.ControlHTMLEditor` — frappe/public/js/frappe/form/controls/html_editor.js:1. */
export declare class ControlHTMLEditor extends ControlMarkdownEditor {
	/** frappe/public/js/frappe/form/controls/html_editor.js:5-8 — always HTML mode. */
	override set_language(): void;
	/** frappe/public/js/frappe/form/controls/html_editor.js:9-14 — the HTML, scripts and styles removed. */
	override update_preview(): void;
}

/**
 * `frappe.ui.form.ControlTextEditor` — frappe/public/js/frappe/form/controls/text_editor.js:185.
 * A Quill editor; it extends `ControlCode` but never builds the Ace editor,
 * because its `make_input` builds Quill instead (:190-193).
 */
export declare class ControlTextEditor extends ControlCode {
	/** frappe/public/js/frappe/form/controls/text_editor.js:201. */
	quill?: ControlTextEditorQuill | undefined;
	/** frappe/public/js/frappe/form/controls/text_editor.js:197. */
	quill_container?: JQuery<HTMLElement> | undefined;
	/**
	 * Merged in from the options; with `df.enable_mentions` it turns on @-mentions
	 * (frappe/public/js/frappe/form/controls/text_editor.js:459). The form's
	 * comment box passes it (frappe/public/js/frappe/form/footer/footer.js:50).
	 */
	enable_mentions?: boolean | undefined;

	/** frappe/public/js/frappe/form/controls/text_editor.js:186-188. */
	override make_wrapper(): void;
	/** frappe/public/js/frappe/form/controls/text_editor.js:190-193. */
	override make_input(): void;
	/** frappe/public/js/frappe/form/controls/text_editor.js:195-207. */
	make_quill_editor(): void;
	/** frappe/public/js/frappe/form/controls/text_editor.js:209. */
	dress_toolbar_pickers(toolbar: unknown): void;
	/** frappe/public/js/frappe/form/controls/text_editor.js:300. */
	add_toolbar_tooltips(toolbar: unknown): void;
	/** frappe/public/js/frappe/form/controls/text_editor.js:352-362. */
	handle_table_actions(value: string): void;
	/** frappe/public/js/frappe/form/controls/text_editor.js:377-421. */
	bind_events(): void;
	/** frappe/public/js/frappe/form/controls/text_editor.js:423-427. */
	is_quill_dirty(source: string): boolean;
	/** frappe/public/js/frappe/form/controls/text_editor.js:429-456 — the options `new Quill` gets. */
	get_quill_options(): Record<string, unknown>;
	/** frappe/public/js/frappe/form/controls/text_editor.js:458. `null` without mentions. */
	get_mention_options(): unknown;
	/** frappe/public/js/frappe/form/controls/text_editor.js:498. */
	get_toolbar_options(): unknown[];
	/** frappe/public/js/frappe/form/controls/text_editor.js:528-533 — scripts and styles removed. */
	override parse(value: unknown): string;
	/** frappe/public/js/frappe/form/controls/text_editor.js:535-552. */
	override set_formatted_input(value: unknown): void;
	/** frappe/public/js/frappe/form/controls/text_editor.js:554-569 — the editor's HTML, wrapped in `.ql-editor.read-mode`. */
	override get_input_value(): string;
	/** frappe/public/js/frappe/form/controls/text_editor.js:571-596. */
	patch_unordered_list(value: string): string;
	/** frappe/public/js/frappe/form/controls/text_editor.js:598-600. */
	override set_focus(): void;
	/** frappe/public/js/frappe/form/controls/text_editor.js:602. */
	get_keyboard_bindings(): Record<string, unknown>;
}

/**
 * `frappe.ui.form.ControlComment` — frappe/public/js/frappe/form/controls/comment.js:6.
 * The form footer's comment box is one (`Form#comment_box`).
 */
export declare class ControlComment extends ControlTextEditor {
	/** Merged in from the options: skip the comment card around the editor — frappe/public/js/frappe/form/controls/comment.js:8. */
	no_wrapper?: boolean | undefined;
	/**
	 * Merged in from the options: called with the editor's value by `submit()`
	 * (frappe/public/js/frappe/form/controls/comment.js:63-65). The form footer
	 * passes one that posts the comment (frappe/public/js/frappe/form/footer/footer.js:55-74).
	 */
	on_submit?: ((comment: string) => unknown) | undefined;
	/** frappe/public/js/frappe/form/controls/comment.js:8. */
	comment_wrapper?: JQuery<HTMLElement> | undefined;
	/** The Comment button — frappe/public/js/frappe/form/controls/comment.js:37. */
	button?: JQuery<HTMLElement> | undefined;
	/** frappe/public/js/frappe/form/controls/comment.js:7. */
	override make_wrapper(): void;
	/** frappe/public/js/frappe/form/controls/comment.js:40. */
	override bind_events(): void;
	/** frappe/public/js/frappe/form/controls/comment.js:63-65. */
	submit(): void;
	/** frappe/public/js/frappe/form/controls/comment.js:67-74. */
	update_state(): void;
	/** frappe/public/js/frappe/form/controls/comment.js:76-83. */
	override get_quill_options(): Record<string, unknown>;
	/** frappe/public/js/frappe/form/controls/comment.js:85-95. */
	override get_toolbar_options(): unknown[];
	/** frappe/public/js/frappe/form/controls/comment.js:97-99. */
	clear(): void;
	/** frappe/public/js/frappe/form/controls/comment.js:101-104. */
	disable(): void;
	/** frappe/public/js/frappe/form/controls/comment.js:106-109. */
	enable(): void;
}

/**
 * `frappe.ui.form.ControlInt` — frappe/public/js/frappe/form/controls/int.js:1,
 * also registered as `ControlLongInt` (int.js:28).
 */
export declare class ControlInt extends ControlData {
	override $input?: JQuery<HTMLInputElement> | undefined;
	override input?: HTMLInputElement | undefined;
	/** frappe/public/js/frappe/form/controls/int.js:5-7. */
	override make(): void;
	/** frappe/public/js/frappe/form/controls/int.js:8-14 — selects the text on focus. */
	override make_input(): void;
	/** frappe/public/js/frappe/form/controls/int.js:15-17 — `this.parse(value)`. */
	override validate(value: unknown): unknown;
	/** frappe/public/js/frappe/form/controls/int.js:18-22 — evaluates a string through `frappe.utils.eval_expression`. */
	eval_expression(value: unknown, number_format?: string): unknown;
	/** frappe/public/js/frappe/form/controls/int.js:23-25 — `cint(…, null)`. */
	override parse(value: unknown): number | null;
}

/** `frappe.ui.form.ControlFloat` — frappe/public/js/frappe/form/controls/float.js:1. */
export declare class ControlFloat extends ControlInt {
	/** frappe/public/js/frappe/form/controls/float.js:3-6 — `null` when not a number, else rounded to `get_precision()`. */
	override parse(value: unknown): number | null;
	/** frappe/public/js/frappe/form/controls/float.js:8-10 — with the field's number format. */
	override eval_expression(value: unknown): unknown;
	/** frappe/public/js/frappe/form/controls/float.js:12-18 — `""` for a non-number. */
	override format_for_input(value: unknown): string;
	/** frappe/public/js/frappe/form/controls/float.js:20-29 — `undefined` for Rating and for a Float without options. */
	get_number_format(): string | undefined;
	/** frappe/public/js/frappe/form/controls/float.js:31-34 — `df.precision`, else the system float precision, else `null`. */
	get_precision(): string | number | null | undefined;
}

/** `frappe.ui.form.ControlCurrency` — frappe/public/js/frappe/form/controls/currency.js:1. */
export declare class ControlCurrency extends ControlFloat {
	/** frappe/public/js/frappe/form/controls/currency.js:2-13 — `df.precision`, else the currency precision. */
	override get_precision(): string | number | null | undefined;
}

/** `frappe.ui.form.ControlPercent` — frappe/public/js/frappe/form/controls/percent.js:1. */
export declare class ControlPercent extends ControlFloat {
	/** frappe/public/js/frappe/form/controls/percent.js:2-12. */
	override format_for_input(value: unknown): string;
}

/** `frappe.ui.form.ControlRating` — frappe/public/js/frappe/form/controls/rating.js:1. */
export declare class ControlRating extends ControlFloat {
	/** frappe/public/js/frappe/form/controls/rating.js:2-44 — replaces the input area with stars. */
	override make_input(): void;
	/** frappe/public/js/frappe/form/controls/rating.js:45. */
	update_rating(ev: JQuery.TriggeredEvent, click?: boolean): void;
	/** frappe/public/js/frappe/form/controls/rating.js:95-97 — `this.value`. */
	override get_value(): unknown;
	/** frappe/public/js/frappe/form/controls/rating.js:98-113. */
	override set_formatted_input(value: unknown): void;
	/** frappe/public/js/frappe/form/controls/rating.js:114-116 — `parseFloat`. */
	override validate(fraction: unknown): number;
}

/**
 * `frappe.ui.form.ControlLink` — frappe/public/js/frappe/form/controls/link.js:11.
 * `make_input` builds its own `<input>` with the open and clear buttons (:13-73).
 */
export declare class ControlLink extends ControlData {
	override $input?: JQuery<HTMLInputElement> | undefined;
	override input?: HTMLInputElement | undefined;
	/** `$(this.input_area)` — frappe/public/js/frappe/form/controls/link.js:26. */
	$input_area?: JQuery<HTMLElement> | undefined;
	/** frappe/public/js/frappe/form/controls/link.js:29. */
	$link_clear?: JQuery<HTMLElement> | undefined;
	/** Whether to translate the search results — frappe/public/js/frappe/form/controls/link.js:69; a `get_query` result can turn it off (:834-836). */
	translate_values?: boolean | undefined;
	/** Translated title → value — frappe/public/js/frappe/form/controls/link.js:116, :145. */
	title_value_map?: Record<string, unknown> | undefined;
	/** frappe/public/js/frappe/form/controls/link.js:152. */
	label?: string | undefined;
	/** frappe/public/js/frappe/form/controls/link.js:301. */
	autocomplete_open?: boolean | undefined;
	/**
	 * Set by `Form#set_query` (frappe/public/js/frappe/form/form.js:1827-1839) and
	 * copied from the grid's control (frappe/public/js/frappe/form/grid_row.js:1164).
	 * Read before `df.get_query` (frappe/public/js/frappe/form/controls/link.js:790-791).
	 */
	override get_query?: LinkQuery | undefined;

	/** frappe/public/js/frappe/form/controls/link.js:13-73. */
	override make_input(): void;
	/** frappe/public/js/frappe/form/controls/link.js:75-83. */
	show_link_and_clear_buttons(): void;
	/** frappe/public/js/frappe/form/controls/link.js:85-87. */
	is_clear_button_enabled(): boolean;
	/** frappe/public/js/frappe/form/controls/link.js:89-92. */
	hide_link_and_clear_buttons(): void;
	/** frappe/public/js/frappe/form/controls/link.js:94-96 — `df.options`, the linked doctype. */
	get_options(): string | undefined;
	/** frappe/public/js/frappe/form/controls/link.js:97-105 — the doctype the field is in, else the List route's. */
	get_reference_doctype(): string | null | undefined;
	/** frappe/public/js/frappe/form/controls/link.js:106-110. */
	setup_buttons(): void;
	/** frappe/public/js/frappe/form/controls/link.js:111-119 — then shows the link title. */
	override set_formatted_input(value: unknown): void;
	/** frappe/public/js/frappe/form/controls/link.js:120-122. */
	get_translated(value: string): string;
	/** frappe/public/js/frappe/form/controls/link.js:123-125. */
	is_translatable(): boolean;
	/** frappe/public/js/frappe/form/controls/link.js:126-128. */
	is_title_link(): boolean;
	/** frappe/public/js/frappe/form/controls/link.js:129-142. */
	set_link_title(value: string): Promise<void>;
	/** frappe/public/js/frappe/form/controls/link.js:143-148. */
	translate_and_set_input_value(link_title: string, value: string): void;
	/** frappe/public/js/frappe/form/controls/link.js:149-157 — `label` records the value's link title. */
	override parse_validate_and_set_in_model(value: unknown, e?: JQuery.TriggeredEvent | null, label?: string): Promise<unknown>;
	/**
	 * frappe/public/js/frappe/form/controls/link.js:158-160 — `strip_html(value)`.
	 * `unknown` because `ControlTableMultiSelect` returns rows (frappe/public/js/frappe/form/controls/table_multiselect.js:108).
	 */
	override parse(value: unknown): unknown;
	/** frappe/public/js/frappe/form/controls/link.js:161-167 — the value behind a shown title; `null` before `make_input`. */
	override get_input_value(): unknown;
	/** frappe/public/js/frappe/form/controls/link.js:168-170 — the text in the input. */
	get_label_value(): string;
	/** frappe/public/js/frappe/form/controls/link.js:171-173. */
	set_input_value(value: string): void;
	/** frappe/public/js/frappe/form/controls/link.js:174-183 — opens the Link Selector; `false`, or `undefined` without a doctype. */
	open_advanced_search(): false | undefined;
	/** frappe/public/js/frappe/form/controls/link.js:184. */
	new_doc(): unknown;
	/** frappe/public/js/frappe/form/controls/link.js:220. */
	setup_awesomeplete(): void;
	/** frappe/public/js/frappe/form/controls/link.js:425-449 — the search arguments, `undefined` without a doctype. */
	get_search_args(txt: string): Record<string, unknown> | undefined;
	/** frappe/public/js/frappe/form/controls/link.js:451. */
	on_input(e?: JQuery.TriggeredEvent): void;
	/** frappe/public/js/frappe/form/controls/link.js:768-871 — applies `get_query`, `df.filters` and `df.link_filters` to `args`. */
	set_custom_query(args: Record<string, unknown>): void;
	/** frappe/public/js/frappe/form/controls/link.js:873-880. */
	apply_link_field_filters(): Record<string, unknown>;
	/** frappe/public/js/frappe/form/controls/link.js:901-908. */
	override validate(value: unknown): unknown;
	/** frappe/public/js/frappe/form/controls/link.js:909-913. */
	override after_set_value(): void;
	/** frappe/public/js/frappe/form/controls/link.js:914 — validates the value and fetches `fetch_from` fields. */
	validate_link_and_fetch(value: unknown): unknown;
}

/** `frappe.ui.form.ControlDynamicLink` — frappe/public/js/frappe/form/controls/dynamic_link.js:1. */
export declare class ControlDynamicLink extends ControlLink {
	/**
	 * frappe/public/js/frappe/form/controls/dynamic_link.js:2-29. `df.get_options(this)`
	 * when set (:4-5); else the value of the field `df.options` names, read from
	 * the dialog, the list's or page's filter, or the document. Throws for a
	 * single doctype (:24-26).
	 */
	override get_options(): string | undefined;
}

/** `frappe.ui.form.ControlTableMultiSelect` — frappe/public/js/frappe/form/controls/table_multiselect.js:1. */
export declare class ControlTableMultiSelect extends ControlLink {
	/** The child rows — frappe/public/js/frappe/form/controls/table_multiselect.js:23, :98. */
	rows?: ChildDoc[] | undefined;
	/** frappe/public/js/frappe/form/controls/table_multiselect.js:5-12. */
	override make(): void;
	/** frappe/public/js/frappe/form/controls/table_multiselect.js:13. */
	override make_input(): void;
	/** frappe/public/js/frappe/form/controls/table_multiselect.js:105-107. */
	override setup_buttons(): void;
	/** frappe/public/js/frappe/form/controls/table_multiselect.js:108 — the rows. */
	override parse(value: unknown): unknown;
	/** frappe/public/js/frappe/form/controls/table_multiselect.js:176-191 — also fires `<fieldname>_add` when one row was added. */
	override set_model_value(value: unknown): Promise<unknown>;
	/** frappe/public/js/frappe/form/controls/table_multiselect.js:193-198. */
	override set_formatted_input(value: unknown): void;
	/** frappe/public/js/frappe/form/controls/table_multiselect.js:199-204. */
	set_pill_html(values: unknown[]): void;
	/** frappe/public/js/frappe/form/controls/table_multiselect.js:205-216. */
	get_pill_html(value: string): string;
	/** frappe/public/js/frappe/form/controls/table_multiselect.js:217-219 — the child table's Link field's options. */
	override get_options(): string | undefined;
	/** frappe/public/js/frappe/form/controls/table_multiselect.js:220-229 — throws when the child table has no Link field. */
	get_link_field(): DocField;
	/** frappe/public/js/frappe/form/controls/table_multiselect.js:241-243. */
	override get_input_value(): unknown;
	/** frappe/public/js/frappe/form/controls/table_multiselect.js:244-250. */
	update_value(): void;
}

/** `frappe.ui.form.ControlAutocomplete` — frappe/public/js/frappe/form/controls/autocomplete.js:3. */
export declare class ControlAutocomplete extends ControlData {
	/** frappe/public/js/frappe/form/controls/autocomplete.js:114. */
	selected?: boolean | undefined;
	/** frappe/public/js/frappe/form/controls/autocomplete.js:124. */
	autocomplete_open?: boolean | undefined;
	/** frappe/public/js/frappe/form/controls/autocomplete.js:202. */
	translate_values?: boolean | undefined;
	/** The parsed options — frappe/public/js/frappe/form/controls/autocomplete.js:246. */
	_data?: SelectOption[] | undefined;
	/** Read before `df.get_query` — frappe/public/js/frappe/form/controls/autocomplete.js:175. */
	override get_query?: LinkQuery | undefined;
	/** frappe/public/js/frappe/form/controls/autocomplete.js:5-9. */
	override make_input(): void;
	/** frappe/public/js/frappe/form/controls/autocomplete.js:11-19. */
	set_options(): void;
	/** frappe/public/js/frappe/form/controls/autocomplete.js:21-30 — the option's label. */
	override format_for_input(value: unknown): unknown;
	/** frappe/public/js/frappe/form/controls/autocomplete.js:32-38 — the value behind the label typed. */
	override get_input_value(): unknown;
	/** frappe/public/js/frappe/form/controls/autocomplete.js:40-90. */
	get_awesomplete_settings(): Record<string, unknown>;
	/** frappe/public/js/frappe/form/controls/autocomplete.js:92. */
	setup_awesomplete(): void;
	/** frappe/public/js/frappe/form/controls/autocomplete.js:136-149 — `""` for a value not among the options. */
	override validate(value: unknown): unknown;
	/** frappe/public/js/frappe/form/controls/autocomplete.js:151-171 — `{ label, value }` objects. */
	parse_options(options: unknown): SelectOption[];
	/** frappe/public/js/frappe/form/controls/autocomplete.js:173. */
	execute_query_if_exists(term: string): unknown;
	/** frappe/public/js/frappe/form/controls/autocomplete.js:237-239. */
	get_data(): unknown[];
	/** frappe/public/js/frappe/form/controls/autocomplete.js:241-247. */
	set_data(data: unknown): void;
}

/** `frappe.ui.form.ControlMultiSelect` — frappe/public/js/frappe/form/controls/multiselect.js:3. */
export declare class ControlMultiSelect extends ControlAutocomplete {
	/** frappe/public/js/frappe/form/controls/multiselect.js:6-41. */
	override get_awesomplete_settings(): Record<string, unknown>;
	/** frappe/public/js/frappe/form/controls/multiselect.js:43-59 — the comma-separated values. */
	override get_value(): unknown;
	/** frappe/public/js/frappe/form/controls/multiselect.js:61. */
	override set_formatted_input(value: unknown): void;
	/** frappe/public/js/frappe/form/controls/multiselect.js:80-88. */
	get_parsed_options(): unknown;
	/** frappe/public/js/frappe/form/controls/multiselect.js:90-93. */
	get_values(): string[];
	/** frappe/public/js/frappe/form/controls/multiselect.js:95-104. */
	override get_data(): unknown[];
	/** frappe/public/js/frappe/form/controls/multiselect.js:106-126. */
	override validate(value: unknown): unknown;
}

/** `frappe.ui.form.ControlMultiSelectPills` — frappe/public/js/frappe/form/controls/multiselect_pills.js:3. */
export declare class ControlMultiSelectPills extends ControlAutocomplete {
	/** frappe/public/js/frappe/form/controls/multiselect_pills.js:8. */
	$input_area?: JQuery<HTMLElement> | undefined;
	/** frappe/public/js/frappe/form/controls/multiselect_pills.js:9. */
	$multiselect_wrapper?: JQuery<HTMLElement> | undefined;
	/** frappe/public/js/frappe/form/controls/multiselect_pills.js:21. */
	rows?: unknown[] | undefined;
	/** frappe/public/js/frappe/form/controls/multiselect_pills.js:6. */
	override make_input(): void;
	/** frappe/public/js/frappe/form/controls/multiselect_pills.js:42. */
	override parse(value: unknown): unknown;
	/** frappe/public/js/frappe/form/controls/multiselect_pills.js:54. */
	override validate(value: unknown): unknown;
	/** frappe/public/js/frappe/form/controls/multiselect_pills.js:77. */
	override set_formatted_input(value: unknown): void;
	/** frappe/public/js/frappe/form/controls/multiselect_pills.js:82. */
	set_pill_html(values: unknown[]): void;
	/** frappe/public/js/frappe/form/controls/multiselect_pills.js:89. */
	get_pill_html(value: string): string;
	/** frappe/public/js/frappe/form/controls/multiselect_pills.js:105. */
	override get_awesomplete_settings(): Record<string, unknown>;
	/** frappe/public/js/frappe/form/controls/multiselect_pills.js:137. */
	override get_value(): unknown;
	/** frappe/public/js/frappe/form/controls/multiselect_pills.js:141. */
	get_values(): unknown;
	/** frappe/public/js/frappe/form/controls/multiselect_pills.js:145. */
	override get_data(): unknown[];
}

/** `frappe.ui.form.ControlMultiSelectList` — frappe/public/js/frappe/form/controls/multiselect_list.js:1. */
export declare class ControlMultiSelectList extends ControlData {
	/** The selected values — frappe/public/js/frappe/form/controls/multiselect_list.js:35, :200. */
	values?: unknown[] | undefined;
	/** frappe/public/js/frappe/form/controls/multiselect_list.js:5. */
	override make_input(): void;
	/** frappe/public/js/frappe/form/controls/multiselect_list.js:139. */
	override set_input_attributes(): void;
	/** frappe/public/js/frappe/form/controls/multiselect_list.js:188-211 — selects the values in the list; resolves at once. */
	override set_value(value: unknown): Promise<unknown>;
	/** frappe/public/js/frappe/form/controls/multiselect_list.js:266. */
	set_options(): unknown;
	/** frappe/public/js/frappe/form/controls/multiselect_list.js:308-310 — `this.values`. */
	override get_value(): unknown;
}

/** `frappe.ui.form.ControlDate` — frappe/public/js/frappe/form/controls/date.js:1. */
export declare class ControlDate extends ControlData {
	override $input?: JQuery<HTMLInputElement> | undefined;
	override input?: HTMLInputElement | undefined;
	/** The air-datepicker instance — frappe/public/js/frappe/form/controls/date.js:109. */
	datepicker?: unknown;
	/** The options it was built with — frappe/public/js/frappe/form/controls/date.js:65. */
	datepicker_options?: Record<string, unknown> | undefined;
	/** frappe/public/js/frappe/form/controls/date.js:64. */
	date_format?: string | undefined;
	/** frappe/public/js/frappe/form/controls/date.js:63. */
	today_text?: string | undefined;
	/** frappe/public/js/frappe/form/controls/date.js:3-6. */
	override make_input(): void;
	/** frappe/public/js/frappe/form/controls/date.js:7-11. */
	make_picker(): void;
	/** frappe/public/js/frappe/form/controls/date.js:12-49 — `"Today"` becomes the current date. */
	override set_formatted_input(value: unknown): void;
	/** frappe/public/js/frappe/form/controls/date.js:50 — reads `df.min_date` / `df.max_date` (:72-73). */
	set_date_options(): void;
	/** frappe/public/js/frappe/form/controls/date.js:103-105. */
	get_start_date(): unknown;
	/** frappe/public/js/frappe/form/controls/date.js:107-117. */
	set_datepicker(): void;
	/** frappe/public/js/frappe/form/controls/date.js:118. */
	update_datepicker_position(): void;
	/** frappe/public/js/frappe/form/controls/date.js:147-151. */
	get_now_date(): unknown;
	/** frappe/public/js/frappe/form/controls/date.js:152-170 — the `t` shortcut. */
	set_t_for_today(): void;
	/** frappe/public/js/frappe/form/controls/date.js:171. */
	eval_expression(value: unknown, type?: string): unknown;
	/** frappe/public/js/frappe/form/controls/date.js:242-249. */
	override parse(value: unknown): unknown;
	/** frappe/public/js/frappe/form/controls/date.js:250-255. */
	override format_for_input(value: unknown): unknown;
	/** frappe/public/js/frappe/form/controls/date.js:256-265 — `""` (after a message) for an invalid date. */
	override validate(value: unknown): unknown;
	/** frappe/public/js/frappe/form/controls/date.js:266-281 — `df.options` as an object, parsed from JSON when a string. */
	get_df_options(): Record<string, unknown>;
}

/** `frappe.ui.form.ControlDatetime` — frappe/public/js/frappe/form/controls/datetime.js:1. */
export declare class ControlDatetime extends ControlDate {
	/** frappe/public/js/frappe/form/controls/datetime.js:2. */
	override set_formatted_input(value: unknown): void;
	/** frappe/public/js/frappe/form/controls/datetime.js:73. */
	override parse(value: unknown): unknown;
	/** frappe/public/js/frappe/form/controls/datetime.js:87. */
	override format_for_input(value: unknown): unknown;
	/** frappe/public/js/frappe/form/controls/datetime.js:109. */
	get_user_time_zone(): unknown;
	/** frappe/public/js/frappe/form/controls/datetime.js:123. */
	override get_model_value(): unknown;
}

/** `frappe.ui.form.ControlTime` — frappe/public/js/frappe/form/controls/time.js:1. */
export declare class ControlTime extends ControlDate {
	/** frappe/public/js/frappe/form/controls/time.js:6. */
	timepicker_only?: boolean | undefined;
	/** frappe/public/js/frappe/form/controls/time.js:20. */
	time_format?: string | undefined;
	/** frappe/public/js/frappe/form/controls/time.js:2. */
	override set_formatted_input(value: unknown): void;
	/** frappe/public/js/frappe/form/controls/time.js:5. */
	override make_input(): void;
	/** frappe/public/js/frappe/form/controls/time.js:14. */
	set_time_options(): void;
	/** frappe/public/js/frappe/form/controls/time.js:46. */
	override set_input(value: unknown): void;
	/** frappe/public/js/frappe/form/controls/time.js:95. */
	override parse(value: unknown): unknown;
	/** frappe/public/js/frappe/form/controls/time.js:103. */
	override format_for_input(value: unknown): unknown;
	/** frappe/public/js/frappe/form/controls/time.js:109. */
	override validate(value: unknown): unknown;
}

/** `frappe.ui.form.ControlDateRange` — frappe/public/js/frappe/form/controls/date_range.js:1. */
export declare class ControlDateRange extends ControlData {
	/** frappe/public/js/frappe/form/controls/date_range.js:33. */
	datepicker?: unknown;
	/** frappe/public/js/frappe/form/controls/date_range.js:17 — reads `df.min_date` / `df.max_date` (:22-23). */
	datepicker_options?: Record<string, unknown> | undefined;
	/** frappe/public/js/frappe/form/controls/date_range.js:2. */
	override make_input(): void;
	/** frappe/public/js/frappe/form/controls/date_range.js:8. */
	make_picker(): void;
	/** frappe/public/js/frappe/form/controls/date_range.js:13. */
	set_date_options(): void;
	/** frappe/public/js/frappe/form/controls/date_range.js:31. */
	set_datepicker(): void;
	/** frappe/public/js/frappe/form/controls/date_range.js:35 — a `[from, to]` pair, or the two dates. */
	override set_input(value: unknown, value2?: unknown): void;
	/** frappe/public/js/frappe/form/controls/date_range.js:51. */
	override parse(value: unknown): unknown;
	/** frappe/public/js/frappe/form/controls/date_range.js:67. */
	override format_for_input(value1: unknown, value2?: unknown): unknown;
}

/** `frappe.ui.form.ControlDuration` — frappe/public/js/frappe/form/controls/duration.js:1. */
export declare class ControlDuration extends ControlData {
	/** frappe/public/js/frappe/form/controls/duration.js:2. */
	override make_input(): void;
	/** frappe/public/js/frappe/form/controls/duration.js:7. */
	override validate(value: unknown): unknown;
	/** frappe/public/js/frappe/form/controls/duration.js:14. */
	make_picker(): void;
	/** frappe/public/js/frappe/form/controls/duration.js:155. */
	override get_value(): unknown;
	/** frappe/public/js/frappe/form/controls/duration.js:159. */
	override parse(value: unknown): unknown;
	/** frappe/public/js/frappe/form/controls/duration.js:180. */
	override set_formatted_input(value: unknown): void;
	/** frappe/public/js/frappe/form/controls/duration.js:191. */
	override format_for_input(value: unknown): unknown;
	/** frappe/public/js/frappe/form/controls/duration.js:195. */
	get_duration(): unknown;
}

/**
 * `frappe.ui.form.ControlAttach` — frappe/public/js/frappe/form/controls/attach.js:1.
 * `$input` is the Attach `<button>` (:3-14).
 */
export declare class ControlAttach extends ControlData {
	override $input?: JQuery<HTMLButtonElement> | undefined;
	override input?: HTMLButtonElement | undefined;
	/** The attached-file row — frappe/public/js/frappe/form/controls/attach.js:15-27. */
	$value?: JQuery<HTMLElement> | undefined;
	/** The uploader the button opened — frappe/public/js/frappe/form/controls/attach.js:58, :72. */
	file_uploader?: FrappeFileUploader | undefined;
	/**
	 * frappe/public/js/frappe/form/controls/attach.js:74-96. The control's own
	 * options, with an object `df.options` merged over them (:92-93).
	 */
	upload_options?: FrappeFileUploaderOptions | undefined;
	/** Cleared by `clear_attachment` without a form — frappe/public/js/frappe/form/controls/attach.js:48-49. */
	dataurl?: string | null | undefined;
	/** frappe/public/js/frappe/form/controls/attach.js:49. */
	fileobj?: File | null | undefined;
	/** frappe/public/js/frappe/form/controls/attach.js:2-33. */
	override make_input(): void;
	/** frappe/public/js/frappe/form/controls/attach.js:34-55 — after confirming. */
	clear_attachment(): void;
	/** frappe/public/js/frappe/form/controls/attach.js:56-59 — opens a `frappe.ui.FileUploader`. */
	on_attach_click(): void;
	/** frappe/public/js/frappe/form/controls/attach.js:60-73. */
	on_attach_doc_image(): void;
	/** frappe/public/js/frappe/form/controls/attach.js:74-96. */
	set_upload_options(): void;
	/** frappe/public/js/frappe/form/controls/attach.js:98-134. A `"name,data:…"` value carries its data URL. */
	override set_input(value: unknown, dataurl?: string): void;
	/** frappe/public/js/frappe/form/controls/attach.js:136-138 — `this.value`, or `null`. */
	override get_value(): unknown;
	/** frappe/public/js/frappe/form/controls/attach.js:140-149 — `attachment` is the uploaded File document. */
	on_upload_complete(attachment: FrappeDoc & { file_url?: string }): Promise<void>;
}

/** `frappe.ui.form.ControlAttachImage` — frappe/public/js/frappe/form/controls/attach_image.js:1. */
export declare class ControlAttachImage extends ControlAttach {
	/** frappe/public/js/frappe/form/controls/attach_image.js:2-20 — adds a preview popover. */
	override make_input(): void;
	/** frappe/public/js/frappe/form/controls/attach_image.js:21-33 — images only. */
	override set_upload_options(): void;
}

/**
 * `frappe.ui.form.ControlButton` — frappe/public/js/frappe/form/controls/button.js:1.
 * `$input` is the `<button>` (:24-33).
 */
export declare class ControlButton extends ControlData {
	override $input?: JQuery<HTMLButtonElement> | undefined;
	override input?: HTMLButtonElement | undefined;
	/** frappe/public/js/frappe/form/controls/button.js:2-5 — always `true`. */
	override can_write(): boolean;
	/** frappe/public/js/frappe/form/controls/button.js:6-38. */
	override make_input(): void;
	/**
	 * frappe/public/js/frappe/form/controls/button.js:39-51. On a form, triggers
	 * the form event named after the field (or the deprecated `run_doc_method`
	 * when there is none and `df.options` is set); elsewhere calls `df.click()`.
	 */
	onclick(): void;
	/** frappe/public/js/frappe/form/controls/button.js:52-67. Deprecated upstream. */
	run_server_script(): void;
	/** frappe/public/js/frappe/form/controls/button.js:68-70. */
	hide(): void;
	/** frappe/public/js/frappe/form/controls/button.js:71-74. */
	override set_input_areas(): void;
	/** frappe/public/js/frappe/form/controls/button.js:75-77. */
	override set_empty_description(): void;
	/** frappe/public/js/frappe/form/controls/button.js:78-87 — the label goes on the button. */
	override set_label(label?: string): void;
}

/**
 * `frappe.ui.form.ControlCheck` — frappe/public/js/frappe/form/controls/check.js:1.
 * An `<input type="checkbox">` (:2-3).
 */
export declare class ControlCheck extends ControlData {
	override $input?: JQuery<HTMLInputElement> | undefined;
	override input?: HTMLInputElement | undefined;
	/** frappe/public/js/frappe/form/controls/check.js:5-17. */
	override make_wrapper(): void;
	/** frappe/public/js/frappe/form/controls/check.js:18-24. */
	override set_input_areas(): void;
	/** frappe/public/js/frappe/form/controls/check.js:25-28. */
	override make_input(): void;
	/** frappe/public/js/frappe/form/controls/check.js:29-31. */
	override get_input_value(): 0 | 1;
	/** frappe/public/js/frappe/form/controls/check.js:32-34 — `cint(value)`. */
	override validate(value: unknown): number;
	/** frappe/public/js/frappe/form/controls/check.js:35-45. */
	override set_input(value: unknown): void;
}

/** `frappe.ui.form.ControlSwitch` — frappe/public/js/frappe/form/controls/switch.js:5. A restyled `ControlCheck`. */
export declare class ControlSwitch extends ControlCheck {
	/** frappe/public/js/frappe/form/controls/switch.js:6-11 — adds `role="switch"`. */
	override make_input(): void;
	/** frappe/public/js/frappe/form/controls/switch.js:13. */
	override make_wrapper(): void;
}

/** `frappe.ui.form.ControlSignature` — frappe/public/js/frappe/form/controls/signature.js:1. */
export declare class ControlSignature extends ControlData {
	/** frappe/public/js/frappe/form/controls/signature.js:4, :116-118. */
	saving?: boolean | undefined;
	/** frappe/public/js/frappe/form/controls/signature.js:5, :85, :99. */
	loading?: boolean | undefined;
	/** The jSignature host — frappe/public/js/frappe/form/controls/signature.js:14, once its library has loaded. */
	body?: JQuery<HTMLElement> | undefined;
	/** frappe/public/js/frappe/form/controls/signature.js:19. */
	img_wrapper?: JQuery<HTMLElement> | undefined;
	/** frappe/public/js/frappe/form/controls/signature.js:23. */
	img?: JQuery<HTMLElement> | undefined;
	/** The jSignature pad — frappe/public/js/frappe/form/controls/signature.js:31. */
	$pad?: JQuery<HTMLElement> | undefined;
	/** frappe/public/js/frappe/form/controls/signature.js:42. */
	$reset_button_wrapper?: JQuery<HTMLElement> | undefined;
	/** frappe/public/js/frappe/form/controls/signature.js:2-26. */
	override make(): void;
	/** frappe/public/js/frappe/form/controls/signature.js:28-56. */
	make_pad(): void;
	/** frappe/public/js/frappe/form/controls/signature.js:57-68. */
	override refresh_input(): void;
	/** frappe/public/js/frappe/form/controls/signature.js:69-77. */
	set_image(value: unknown): void;
	/** frappe/public/js/frappe/form/controls/signature.js:78-101. */
	load_pad(): void;
	/** frappe/public/js/frappe/form/controls/signature.js:102-113. */
	set_editable(editable: boolean): void;
	/** frappe/public/js/frappe/form/controls/signature.js:114-119. */
	set_my_value(value: unknown): void;
	/** frappe/public/js/frappe/form/controls/signature.js:120-122 — `this.value`, else the model's. */
	override get_value(): unknown;
	/** frappe/public/js/frappe/form/controls/signature.js:124-127. */
	on_reset_sign(): void;
	/** frappe/public/js/frappe/form/controls/signature.js:129-134. */
	on_save_sign(): void;
	/** frappe/public/js/frappe/form/controls/signature.js:135-137. */
	override on_section_collapse(): void;
}

/**
 * `frappe.ui.form.ControlGeolocation` — frappe/public/js/frappe/form/controls/geolocation.js:3.
 * A Leaflet map in the display area. Leaflet is a third-party library frappe
 * loads at runtime (`load_lib`, :49-54), so its objects are `unknown` here.
 */
export declare class ControlGeolocation extends ControlData {
	/** frappe/public/js/frappe/form/controls/geolocation.js:17. */
	map_id?: string | undefined;
	/** frappe/public/js/frappe/form/controls/geolocation.js:18-22. */
	map_area?: JQuery<HTMLElement> | undefined;
	/** The Leaflet map — frappe/public/js/frappe/form/controls/geolocation.js:167. */
	map?: unknown;
	/** frappe/public/js/frappe/form/controls/geolocation.js:189. */
	editableLayers?: unknown;
	/** frappe/public/js/frappe/form/controls/geolocation.js:211. */
	locate_control?: unknown;
	/** frappe/public/js/frappe/form/controls/geolocation.js:217. */
	draw_control?: unknown;
	/** frappe/public/js/frappe/form/controls/geolocation.js:272. */
	bound_event_listeners?: boolean | undefined;
	/** frappe/public/js/frappe/form/controls/geolocation.js:6-9 — `async`, and hides the input area. */
	override make(): Promise<void>;
	/** frappe/public/js/frappe/form/controls/geolocation.js:11-47 — builds the map area, then the map once Leaflet has loaded. */
	override set_disp_area(value: unknown): void;
	/** frappe/public/js/frappe/form/controls/geolocation.js:49-54 — requires `leaflet.bundle.js` and `.css`. */
	load_lib(): Promise<unknown>;
	/** frappe/public/js/frappe/form/controls/geolocation.js:56-79. Builds the map; `value` is not read. */
	make_map(value?: unknown): void;
	/** frappe/public/js/frappe/form/controls/geolocation.js:81-94 — draws the stored GeoJSON string. */
	bind_leaflet_data(value: string): void;
	/** frappe/public/js/frappe/form/controls/geolocation.js:106-115 — an override point for how points render. */
	point_to_layer(geoJsonPoint: unknown, latlng: unknown): unknown;
	/** frappe/public/js/frappe/form/controls/geolocation.js:125-127 — an override point; `{}` here. */
	set_style(geoJsonFeature: unknown): unknown;
	/** frappe/public/js/frappe/form/controls/geolocation.js:137 — an override point; empty here. */
	on_each_feature(feature: unknown, layer: unknown): void;
	/** frappe/public/js/frappe/form/controls/geolocation.js:139. */
	customize_draw_controls(): void;
	/** frappe/public/js/frappe/form/controls/geolocation.js:166-190. */
	bind_leaflet_map(): void;
	/** frappe/public/js/frappe/form/controls/geolocation.js:192. */
	bind_leaflet_layers_control(): void;
	/** frappe/public/js/frappe/form/controls/geolocation.js:209. */
	bind_leaflet_locate_control(): void;
	/** frappe/public/js/frappe/form/controls/geolocation.js:215. */
	bind_leaflet_draw_control(): void;
	/** frappe/public/js/frappe/form/controls/geolocation.js:226. */
	get_leaflet_controls(): unknown;
	/** frappe/public/js/frappe/form/controls/geolocation.js:260-269. */
	display_leaflet_overlays_control(display?: string): void;
	/** frappe/public/js/frappe/form/controls/geolocation.js:271-309. */
	bind_leaflet_event_listeners(): void;
	/** frappe/public/js/frappe/form/controls/geolocation.js:311-321. */
	add_non_group_layers(source_layer: unknown, target_group: unknown): void;
	/** frappe/public/js/frappe/form/controls/geolocation.js:323-327. */
	clear_editable_layers(): void;
	/** frappe/public/js/frappe/form/controls/geolocation.js:329-339. */
	fit_and_recenter_map(): void;
	/** frappe/public/js/frappe/form/controls/geolocation.js:341-343. */
	override on_section_collapse(hide: boolean): void;
}

/** `frappe.ui.form.ControlPassword` — frappe/public/js/frappe/form/controls/password.js:1. */
export declare class ControlPassword extends ControlData {
	override $input?: JQuery<HTMLInputElement> | undefined;
	override input?: HTMLInputElement | undefined;
	/** frappe/public/js/frappe/form/controls/password.js:3. */
	override make(): void;
	/** frappe/public/js/frappe/form/controls/password.js:7. */
	override make_input(): void;
	/** frappe/public/js/frappe/form/controls/password.js:55. */
	disable_password_checks(): void;
	/** frappe/public/js/frappe/form/controls/password.js:59. */
	get_password_strength(value: string): unknown;
	/** frappe/public/js/frappe/form/controls/password.js:85. */
	set_strength_indicator(color: string): void;
}

/** `frappe.ui.form.ControlPhone` — frappe/public/js/frappe/form/controls/phone.js:4. */
export declare class ControlPhone extends ControlData {
	/** frappe/public/js/frappe/form/controls/phone.js:5 — `async`. */
	override make_input(): Promise<void>;
	/** frappe/public/js/frappe/form/controls/phone.js:153. */
	override refresh(): void;
	/** frappe/public/js/frappe/form/controls/phone.js:175. */
	override set_formatted_input(value: unknown): void;
	/** frappe/public/js/frappe/form/controls/phone.js:199. */
	override get_value(): unknown;
}

/** `frappe.ui.form.ControlColor` — frappe/public/js/frappe/form/controls/color.js:3. */
export declare class ControlColor extends ControlData {
	/** frappe/public/js/frappe/form/controls/color.js:4. */
	override make_input(): void;
	/** frappe/public/js/frappe/form/controls/color.js:10. */
	make_color_input(): void;
	/** frappe/public/js/frappe/form/controls/color.js:92. */
	override refresh(): void;
	/** frappe/public/js/frappe/form/controls/color.js:101. */
	override set_formatted_input(value: unknown): void;
	/** frappe/public/js/frappe/form/controls/color.js:110. */
	get_color(): unknown;
	/** frappe/public/js/frappe/form/controls/color.js:114. */
	override validate(value: unknown): unknown;
}

/** `frappe.ui.form.ControlIcon` — frappe/public/js/frappe/form/controls/icon.js:3. */
export declare class ControlIcon extends ControlData {
	/** frappe/public/js/frappe/form/controls/icon.js:4. */
	override make_input(): void;
	/** frappe/public/js/frappe/form/controls/icon.js:18. */
	make_icon_input(): void;
	/** frappe/public/js/frappe/form/controls/icon.js:93. */
	override refresh(): void;
	/** frappe/public/js/frappe/form/controls/icon.js:102. */
	override set_formatted_input(value: unknown): void;
	/** frappe/public/js/frappe/form/controls/icon.js:109. */
	get_icon(): unknown;
}

/** `frappe.ui.form.ControlBarcode` — frappe/public/js/frappe/form/controls/barcode.js:3. */
export declare class ControlBarcode extends ControlData {
	/** frappe/public/js/frappe/form/controls/barcode.js:4. */
	override make_wrapper(): void;
	/** frappe/public/js/frappe/form/controls/barcode.js:14. */
	override parse(value: unknown): unknown;
	/** frappe/public/js/frappe/form/controls/barcode.js:25. */
	override set_formatted_input(value: unknown): void;
	/** frappe/public/js/frappe/form/controls/barcode.js:44. */
	get_barcode_html(value: unknown): unknown;
}

/** `frappe.ui.form.ControlAttachmentGallery` — frappe/public/js/frappe/form/controls/attachment_gallery.js:1, extending `ControlInput` directly. */
export declare class ControlAttachmentGallery extends ControlInput {
	/** frappe/public/js/frappe/form/controls/attachment_gallery.js:8. */
	$gallery?: JQuery<HTMLElement> | undefined;
	/** frappe/public/js/frappe/form/controls/attachment_gallery.js:6. */
	override make(): void;
	/** frappe/public/js/frappe/form/controls/attachment_gallery.js:14 — `async`. */
	override refresh_input(): Promise<void>;
}

/** `frappe.ui.form.ControlHTML` — frappe/public/js/frappe/form/controls/html.js:1, extending `BaseControl` directly. */
export declare class ControlHTML extends BaseControl {
	/** `this.wrapper` — frappe/public/js/frappe/form/controls/html.js:4. */
	disp_area?: HTMLElement | undefined;
	/** frappe/public/js/frappe/form/controls/html.js:2-5. */
	override make(): void;
	/** frappe/public/js/frappe/form/controls/html.js:6-11. */
	override refresh_input(): void;
	/** frappe/public/js/frappe/form/controls/html.js:12-20 — `df.options`, translated and rendered as a template. */
	get_content(): string;
	/** frappe/public/js/frappe/form/controls/html.js:21-23. */
	html(html?: string): void;
	/** frappe/public/js/frappe/form/controls/html.js:24-34 — HTML or a jQuery element; resolves at once. */
	override set_value(html: string | JQuery): Promise<void>;
	/** frappe/public/js/frappe/form/controls/html.js:35-40. */
	_set_html(html: unknown): void;
}

/** `frappe.ui.form.ControlHeading` — frappe/public/js/frappe/form/controls/heading.js:1. */
export declare class ControlHeading extends ControlHTML {
	/** frappe/public/js/frappe/form/controls/heading.js:2-4 — the label in an `<h4>`. */
	override get_content(): string;
}

/** `frappe.ui.form.ControlImage` — frappe/public/js/frappe/form/controls/image.js:1, extending `BaseControl` directly. */
export declare class ControlImage extends BaseControl {
	/** frappe/public/js/frappe/form/controls/image.js:5. */
	$body?: JQuery<HTMLElement> | undefined;
	/** frappe/public/js/frappe/form/controls/image.js:13. */
	$img?: JQuery<HTMLElement> | undefined;
	/** frappe/public/js/frappe/form/controls/image.js:17. */
	$buffer?: JQuery<HTMLElement> | undefined;
	/** frappe/public/js/frappe/form/controls/image.js:2-7. */
	override make(): void;
	/** frappe/public/js/frappe/form/controls/image.js:8-22 — shows the image the field `df.options` names. Returns `false`. */
	override refresh_input(): false;
}

/** `frappe.ui.form.ControlMultiCheck` — frappe/public/js/frappe/form/controls/multicheck.js:1, extending `BaseControl` directly. */
export declare class ControlMultiCheck extends BaseControl {
	/** frappe/public/js/frappe/form/controls/multicheck.js:45, :49, :59. */
	options?: SelectOption[] | undefined;
	/** The checked values — frappe/public/js/frappe/form/controls/multicheck.js:113, :128. */
	selected_options?: unknown[] | undefined;
	/** frappe/public/js/frappe/form/controls/multicheck.js:22. */
	$checkbox_area?: JQuery<HTMLElement> | undefined;
	/** frappe/public/js/frappe/form/controls/multicheck.js:6-25. */
	override make(): void;
	/** frappe/public/js/frappe/form/controls/multicheck.js:27-31. */
	override refresh(): void;
	/** frappe/public/js/frappe/form/controls/multicheck.js:33-35. */
	override refresh_input(): void;
	/** frappe/public/js/frappe/form/controls/multicheck.js:37-55 — from `df.get_data`, else `df.options`. */
	set_options(): void;
	/** frappe/public/js/frappe/form/controls/multicheck.js:112-115 — selects the options marked `checked`. */
	set_checked_options(): void;
	/** frappe/public/js/frappe/form/controls/multicheck.js:127-139. */
	select_all(deselect?: boolean): void;
	/** frappe/public/js/frappe/form/controls/multicheck.js:141-148. */
	select_options(selected_options: unknown[]): void;
	/** frappe/public/js/frappe/form/controls/multicheck.js:150-152 — the checked values. */
	override get_value(): unknown[] | undefined;
	/** frappe/public/js/frappe/form/controls/multicheck.js:154-156. */
	get_checked_options(): unknown[] | undefined;
	/** frappe/public/js/frappe/form/controls/multicheck.js:158-162. */
	get_unchecked_options(): unknown[];
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
 * frappe/public/js/frappe/form/grid.js:663), so a patch that lets the original run and then replaces
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
	 * frappe/public/js/frappe/form/controls/table.js:4-114. Calls `super.make()`, constructs the `Grid`,
	 * registers itself in `frm.grids` (:16) and installs the ~90-line
	 * clipboard-paste handler (:18), which reads `this.grid` at event time
	 * rather than closing over it.
	 */
	make(): void;
	/**
	 * frappe/public/js/frappe/form/controls/table.js:115-137. Resolves a pasted column header (fieldname,
	 * label or translated label) to a fieldname; `undefined` when nothing
	 * matches.
	 */
	get_field(field_name: string): string | undefined;
	/** frappe/public/js/frappe/form/controls/table.js:138-140. */
	refresh_input(): void;
	/** frappe/public/js/frappe/form/controls/table.js:141-145. `undefined` before `make()` has run. */
	get_value(): ChildDoc[] | undefined;
	/** frappe/public/js/frappe/form/controls/table.js:146-148. Deliberately empty. */
	set_input(): void;
	/** frappe/public/js/frappe/form/controls/table.js:149-151. Returns `get_value()`. */
	validate(): ChildDoc[] | undefined;
	/** frappe/public/js/frappe/form/controls/table.js:152-154. Clicks the header select-all checkbox. */
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
	/**
	 * Where a Link control without a form writes its `fetch_from` values:
	 * `ControlLink` reads `this.layout?.set_value` and calls it with each target
	 * fieldname and value (frappe/public/js/frappe/form/controls/link.js:928-938).
	 * `FieldGroup` (and so `Dialog`) defines it; a plain `Layout` does not, so an
	 * app laying out controls itself can assign one. It is called detached, with
	 * no `this`, so assign an arrow function.
	 */
	set_value?(fieldname: string, value: unknown): unknown;

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
 *    `_apply_column_disp_overrides`, frappe/public/js/frappe/form/grid.js:882-907). NOTHING DECLARED HERE
 *    WAS LOST — every member this copy had that the other lacked was carried
 *    across with its citation before this block replaced them:
 *    - `GridDocField#fields` and `GridDocField#allow_bulk_edit` are now
 *      INHERITED, from `model.d.ts`'s `DocField` (`fields?: DocField[]` at
 *      model.d.ts:399 citing frappe/public/js/frappe/form/grid.js:871; `allow_bulk_edit?: FrappeCheck` at
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
	 * (frappe/public/js/frappe/model/model.js:383-385), not a boolean.
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
export declare class FieldGroup<TValues extends object = Record<string, unknown>> extends Layout {
	constructor(opts?: LayoutOptions);

	/** frappe/public/js/frappe/ui/field_group.js:8, flipped by the `change`/`input` handlers at :88-101. */
	dirty: boolean;
	/**
	 * frappe/public/js/frappe/ui/field_group.js:9, populated by {@link FieldGroup.add_fetch} at :285-286
	 * as `fetch_dict[target_doctype][link_field][target_field] = source_field`.
	 */
	fetch_dict: Record<string, Record<string, Record<string, string>>>;
	/** From `opts` — applied by `set_values()` in the constructor (frappe/public/js/frappe/ui/field_group.js:16-18). */
	values?: Partial<TValues>;
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
	 * (frappe/public/js/frappe/desk.js:464-478); it no longer clicks this group's own
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
	 * entirely for null-ish values (:157), so the result is a partial map:
	 * `Partial<TValues>`, where `TValues` is the class's type parameter, the
	 * values keyed by fieldname. It defaults to `Record<string, unknown>`;
	 * name it on the variable to type the values:
	 * `const g: frappe.ui.FieldGroup<{ qty: number }> = new frappe.ui.FieldGroup(…)`
	 * (see {@link FieldGroupConstructor}).
	 */
	override get_values: (
		ignore_errors?: boolean,
		check_invalid?: boolean
	) => Partial<TValues> | null;
	/**
	 * frappe/public/js/frappe/ui/field_group.js:197-200 — the control's
	 * `get_value()`; `null` when the field exists but has no `get_value`, and
	 * `undefined` for an unknown fieldname.
	 */
	get_value<K extends keyof TValues & string>(key: K): TValues[K] | null | undefined;
	/** frappe/public/js/frappe/ui/field_group.js:202-215. Resolves immediately when the fieldname is unknown. */
	override set_value<K extends keyof TValues & string>(key: K, val: TValues[K] | null | undefined): Promise<void>;
	/** frappe/public/js/frappe/ui/field_group.js:217-219. */
	has_field(fieldname: string): boolean;
	/** frappe/public/js/frappe/ui/field_group.js:221-223 — an alias of {@link FieldGroup.set_value}. */
	set_input<K extends keyof TValues & string>(key: K, val: TValues[K] | null | undefined): Promise<void>;
	/** frappe/public/js/frappe/ui/field_group.js:225-234. Silently skips keys with no matching field. */
	set_values(dict: Partial<TValues>): Promise<void[]>;
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

/**
 * The type of `frappe.ui.FieldGroup` itself (frappe/public/js/frappe/ui/field_group.js:5).
 * See {@link DialogConstructor}: its one construct signature is not generic
 * for the same reason, so annotate the variable to name `TValues`.
 */
export interface FieldGroupConstructor {
	new (opts?: LayoutOptions): FieldGroup;
	readonly prototype: FieldGroup;
}

/**
 * The modal width classes `Dialog#set_modal_size` picks from — frappe/public/js/frappe/ui/dialog.js:170-193.
 *
 * `"medium"` adds no class, but any truthy size skips the automatic sizing
 * (frappe/public/js/frappe/ui/dialog.js:44), so it keeps the default width
 * however many columns the dialog has. frappe passes it itself
 * (frappe/public/js/frappe/ui/naming_series.js:21,
 * frappe/public/js/frappe/list/list_filter/manage_layouts_dialog.js:12).
 */
export type DialogSize = "small" | "medium" | "large" | "extra-large" | "";

/**
 * The `action` bag an older dialog API passes instead of
 * `primary_action` / `secondary_action` — read at frappe/public/js/frappe/ui/dialog.js:69-90.
 */
export interface DialogActions {
	primary: { label?: string; onsubmit?(values: Record<string, unknown>): unknown };
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
export interface DialogOptions<TValues extends object = Record<string, unknown>> extends LayoutOptions {
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
	 *
	 * `values` is `Partial<TValues>`: `get_values()` leaves out every empty
	 * field (frappe/public/js/frappe/ui/field_group.js:157), so a key can be
	 * missing however the dialog was typed. Declared as a method, so a callback
	 * whose parameter names its own values type is accepted as well.
	 */
	primary_action?(this: Dialog<TValues>, values: Partial<TValues>): unknown;
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
 * The type of `frappe.ui.Dialog` itself — frappe/public/js/frappe/ui/dialog.js:10-31.
 *
 * It has one construct signature, and it is not generic, on purpose. A dialog
 * whose options refer to the dialog being built is the usual frappe pattern:
 *
 * ```js
 * const d = new frappe.ui.Dialog({
 *   fields: [{ fieldname: "a", fieldtype: "Data", onchange: () => d.get_value("a") }],
 *   primary_action: () => d.hide(),
 * });
 * ```
 *
 * TypeScript can give `d` a type without checking the options first only
 * when the construct signature is single and not generic; a generic or
 * overloaded one turns that code into TS7022 ("'d' implicitly has type
 * 'any'"). So `new frappe.ui.Dialog(…)` is a `Dialog<Record<string, unknown>>`,
 * and the values type is named on the variable, which that instance is
 * assignable to:
 *
 * ```ts
 * const d: frappe.ui.Dialog<{ qty: number }> = new frappe.ui.Dialog({ … });
 * d.get_value("qty"); // number | null | undefined
 * ```
 *
 * `primary_action` is a method, so its `values` parameter can name the same
 * shape (`primary_action(values: { qty?: number }) { … }`).
 */
export interface DialogConstructor {
	new (opts?: DialogOptions): Dialog;
	readonly prototype: Dialog;
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
export declare class Dialog<TValues extends object = Record<string, unknown>> extends FieldGroup<TValues> {
	/**
	 * frappe/public/js/frappe/ui/dialog.js:11-31. `frappe.ui.Dialog` itself is
	 * typed {@link DialogConstructor}, whose one construct signature is not
	 * generic; see there for how to name `TValues`.
	 */
	constructor(opts?: DialogOptions<TValues>);

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
	/** See {@link DialogOptions.primary_action}. */
	primary_action?(this: Dialog<TValues>, values: Partial<TValues>): unknown;
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
		click?: (this: Dialog<TValues>, values: Partial<TValues>) => unknown
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
 * accepts it — on TypeScript 5.8 as well as 7, which is why no member may put
 * `DT` in a type-parameter constraint (see {@link FormSetValueArgs}).
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
	 * :1583. `null` until then, and after `set_intro` is called with no text.
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
	/**
	 * frappe/public/js/frappe/form/form.js:79 — `{}`, then filled by
	 * `frappe.ui.form.on`: a handler registered while a form of its doctype is
	 * open is also stored here under its event name, so a script can call
	 * another handler as `frm.events.my_helper(frm)`
	 * (frappe/public/js/frappe/form/script_manager.js:39-43). Removed again by
	 * `frappe.ui.form.off` (:66-68). Only the last handler of each name is kept,
	 * and a name may be missing, so check before calling. What is stored is a
	 * wrapper that forwards its arguments (:28-35), and scripts call it with the
	 * form alone, so `cdt` and `cdn` are optional here.
	 */
	events: Record<string, FormEventsEntrySignature<DT>["handler"] | undefined>;
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
	/**
	 * The comments and activity footer — frappe/public/js/frappe/form/form.js:173-176.
	 * Only built when the doctype shows its toolbar and the user's desk settings
	 * show the timeline (:167), hence optional.
	 */
	footer?: FormFooter;
	/** The footer's comment box — frappe/public/js/frappe/form/footer/footer.js:46. Set with {@link Form.footer}. */
	comment_box?: ControlComment;
	/** The footer's activity timeline — frappe/public/js/frappe/form/footer/footer.js:78. Set with {@link Form.footer}. */
	timeline?: FormTimeline;
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
	 * Set at frappe/public/js/frappe/form/grid_row.js:1407 and cleared at :1433 — both guarded on `cur_frm`.
	 */
	cur_grid?: GridRow | null;
	/**
	 * Set around `Layout#set_dependant_property` (frappe/public/js/frappe/form/layout.js:768, :777) and read by
	 * `Grid#refresh` (frappe/public/js/frappe/form/grid.js:658) to suppress a re-render mid-dependency-pass.
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
	/** frappe/public/js/frappe/form/form.js:1514-1520. Refreshes one control plus layout dependencies/sections. */
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
	/**
	 * frappe/public/js/frappe/form/form.js:929-972. Confirms "Permanently Submit
	 * …?", runs `before_submit`, saves with `"Submit"`, then `callback()` and the
	 * `on_submit` event. The promise resolves with the form only after
	 * `on_submit` has run (:950-952); it never rejects, and stays pending when
	 * the user cancels, `before_submit` sets `frappe.validated = false`, or the
	 * save fails (`on_error` is called instead, :939, :946, :964, :969).
	 */
	savesubmit(
		btn?: HTMLElement | JQuery | null,
		callback?: () => void,
		on_error?: () => void
	): Promise<this>;
	/**
	 * frappe/public/js/frappe/form/form.js:974-1000. Cancels the document, after
	 * offering to cancel its submitted linked documents too. Returns nothing.
	 */
	savecancel(btn?: HTMLElement | JQuery | null, callback?: () => void, on_error?: () => void): void;
	/**
	 * frappe/public/js/frappe/form/form.js:918-927. Confirms, runs
	 * `before_discard`, then discards the draft. The promise it returns never
	 * settles: nothing calls its `resolve` (:920).
	 */
	discard(btn?: HTMLElement | JQuery | null, callback?: () => void, on_error?: () => void): Promise<unknown>;
	/** frappe/public/js/frappe/form/form.js:1166-1171. */
	savetrash(): void;
	/** frappe/public/js/frappe/form/form.js:1503-1512. */
	reload_doc(): Promise<unknown> | undefined;
	/** frappe/public/js/frappe/form/form.js:1523-1540. */
	add_fetch(
		link_field: string,
		source_field: string,
		target_field: string,
		target_doctype?: string
	): void;
	/** frappe/public/js/frappe/form/form.js:1542-1544. */
	has_perm(ptype: string): boolean;
	/** frappe/public/js/frappe/form/form.js:1546-1552. Marks `doc.__unsaved` and fires the `dirty` event. */
	dirty(): void;
	/** frappe/public/js/frappe/form/form.js:1554-1556. */
	get_docinfo(): unknown;
	/** frappe/public/js/frappe/form/form.js:1558-1560. */
	is_dirty(): boolean;
	/** frappe/public/js/frappe/form/form.js:1562-1564. Returns `doc.__islocal`, which is `1 | undefined`. */
	is_new(): 1 | undefined;
	/**
	 * frappe/public/js/frappe/form/form.js:1573-1575. `this.perm[permlevel] ? this.perm[permlevel][access_type] : null`
	 * — `null` (not `false`) for an unknown permlevel, and `undefined` when that
	 * permlevel's row simply has no such key (the read-only perm map built by
	 * `set_read_only`, frappe/public/js/frappe/form/form.js:1988-2001, carries only six).
	 */
	get_perm(
		permlevel: number,
		access_type: string
	): boolean | 0 | 1 | null | undefined;
	/**
	 * frappe/public/js/frappe/form/form.js:1577-1585. Replaces the previous intro: the block remembered in
	 * `$intro_message` is removed first (:1578-1581), then `txt` — when truthy —
	 * is shown with `dashboard.set_headline_alert` (:1582-1584). A falsy `txt`
	 * therefore clears the intro; it used to pass straight through to the
	 * dashboard and never removed the block.
	 */
	set_intro(txt: string, color?: string): void;
	/** frappe/public/js/frappe/form/form.js:1587-1589. */
	set_footnote(txt: string): void;
	/** frappe/public/js/frappe/form/form.js:1591-1600. `group` creates/uses a dropdown. */
	add_custom_button(
		label: string,
		fn: () => void,
		group?: string
	): JQuery<HTMLElement> | undefined;
	/** frappe/public/js/frappe/form/form.js:1602-1604. */
	change_custom_button_type(label: string, group: string | null, type: string): void;
	/** frappe/public/js/frappe/form/form.js:1606-1610. */
	clear_custom_buttons(): void;
	/** frappe/public/js/frappe/form/form.js:1613-1634. */
	remove_custom_button(label: string, group?: string): void;
	/** frappe/public/js/frappe/form/form.js:1666-1668. */
	get_doc(): DocOf<DT>;
	/** frappe/public/js/frappe/form/form.js:1740-1756. `"*"` maps every field in `fields_dict`. */
	field_map(fnames: string | string[], fn: (df: DocField) => void): void;
	/**
	 * frappe/public/js/frappe/form/form.js:1758-1767. One argument reads a parent field; two read a child
	 * field of the Table named by the first. Returns whatever
	 * `frappe.meta.get_docfield` does — `null` when the doctype has no docfield
	 * map (frappe/public/js/frappe/model/meta.js:72-73) or `undefined` when it has no such fieldname — and
	 * the two-argument form throws if the first fieldname is unknown (:1761).
	 */
	get_docfield(fieldname1: string, fieldname2?: string): DocField | null | undefined;
	/**
	 * frappe/public/js/frappe/form/form.js:1769-1801. Passing `docname` + `table_field` targets a child
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
	/** frappe/public/js/frappe/form/form.js:1803-1807. Writes `read_only` as `0 | 1`. */
	toggle_enable(fnames: string | string[], enable: boolean): void;
	/** frappe/public/js/frappe/form/form.js:1809-1813. Writes `reqd` as a **boolean**, not `0 | 1`. */
	toggle_reqd(fnames: string | string[], mandatory: boolean): void;
	/** frappe/public/js/frappe/form/form.js:1815-1819. Writes `hidden` as `0 | 1`. */
	toggle_display(fnames: string | string[], show: boolean): void;
	/** frappe/public/js/frappe/form/form.js:1827-1839. */
	set_query(fieldname: string, opt1: unknown, opt2?: unknown): void;
	/** frappe/public/js/frappe/form/form.js:1841-1843. */
	clear_table(fieldname: string): void;
	/**
	 * frappe/public/js/frappe/form/form.js:1845-1865. Appends a child row and returns it. `values` is merged
	 * with `$.extend` **minus** `idx` and `name`, which are never overridden.
	 */
	add_child(fieldname: string, values?: Record<string, unknown>): ChildDoc;
	/**
	 * frappe/public/js/frappe/form/form.js:1867-1931. One field and its value,
	 * or a `{fieldname: value}` map (:1921-1930 walks the object form and ignores
	 * the second argument). For a registered `DT` the fieldname must be one of
	 * its own fields — never a standard one like `name` or `idx`, which frappe
	 * throws on (:1914-1916) — and the value must fit that field's type;
	 * otherwise any fieldname and value are accepted, as before. A Table field
	 * also takes partial rows: frappe clears the table and `add_child`s a fresh
	 * row per element, copying everything but the standard fields (:1873-1901).
	 * See {@link FormSetValueArgs} for the exact rules, and for why this is one
	 * rest-tuple signature rather than overloads.
	 */
	set_value(...args: FormSetValueArgs<DT>): Promise<unknown>;
	/**
	 * frappe/public/js/frappe/form/form.js:1933-1982 — `frappe.call` with the
	 * form filled in, returning what `frappe.call(opts)` returns (:1981): the
	 * jqXHR resolving with the response, whose `message` is `T`.
	 *
	 * - `frm.call("method", args, callback)` runs a method of the document's
	 *   controller (`doc: this.doc`, :1935-1942), and refreshes the fields when
	 *   it succeeds (:1973-1978).
	 * - The object form takes {@link FrappeCallOptions}, with `method`
	 *   required: without `doc` frappe reads `opts.method.indexOf(".")`
	 *   unguarded (:1944-1945), and with `doc` it is the controller method
	 *   `run_doc_method` runs. Without `doc`, a `method` with no dot is
	 *   prefixed with the doctype's server module (:1944-1946), and a plain-object `message` is written back: into
	 *   `child` (a row of this form) when given, else into the document with
	 *   `set_value` (:1947-1970). `debounce` can make `frappe.call` return a
	 *   bare `Promise<void>` (`frappe/public/js/frappe/request.js:105-107`).
	 *
	 * From JavaScript, annotate the callback or the `.then` callback to say
	 * what `message` is; see {@link FrappeAjaxResult}.
	 */
	call<T = unknown>(
		method: string,
		args?: Record<string, unknown>,
		callback?: (r: FrappeResponse<T>) => void
	): FrappeAjaxResult<T>;
	call<T = unknown>(
		opts: FrappeCallOptions<T> & { method: string; child?: FrappeDoc; debounce: number }
	): FrappeAjaxResult<T> | Promise<void>;
	call<T = unknown>(opts: FrappeCallOptions<T> & { method: string; child?: FrappeDoc }): FrappeAjaxResult<T>;
	/** frappe/public/js/frappe/form/form.js:1984-1986. A raw `fields_dict` lookup, so a miss is `undefined`. */
	get_field(field: string): LayoutFieldObject | undefined;
	/** frappe/public/js/frappe/form/form.js:2003-2005. Delegates to `script_manager.trigger`. */
	trigger(event: string, doctype?: string, docname?: string): Promise<unknown>;
	/** frappe/public/js/frappe/form/form.js:2007-2014. */
	get_formatted(fieldname: string): string;
	/** frappe/public/js/frappe/form/form.js:2016-2018. Delegates to `frappe.ui.form.get_open_grid_form`. */
	open_grid_row(): GridRow | undefined;
	/** frappe/public/js/frappe/form/form.js:2020-2022. */
	get_title(): string;
	/** frappe/public/js/frappe/form/form.js:2024-2041. `[parentfield, name]` pairs of checked child rows. */
	get_selected(): Record<string, string[]>;
	/**
	 * frappe/public/js/frappe/form/form.js:2117-2137. Opens a new `doctype` document seeded from this form: a
	 * `make_methods[doctype]` handler wins (:2122-2123, and its result is
	 * returned), then a `custom_make_buttons[doctype]` button (:2124-2125),
	 * otherwise a quick-entry dialog over a new doc whose link fields
	 * `set_link_field` has filled in (:2127-2135). `fieldname` — new in 16.50 —
	 * restricts that fill to the one Link field of that name (the dashboard's
	 * "+ New" badges pass it, frappe/public/js/frappe/form/dashboard.js:345-348).
	 */
	make_new(doctype: string, fieldname?: string): unknown;
	/**
	 * frappe/public/js/frappe/form/form.js:2139-2162. Writes this form's name into `new_doc`'s Link field(s)
	 * to this doctype, and — without `fieldname` — copies any other Link /
	 * Dynamic Link value this form shares by fieldname. With `fieldname` only
	 * that one field is filled (:2144-2152). Recurses into required Table fields.
	 */
	set_link_field(doctype: string, new_doc: FrappeDoc | ChildDoc, fieldname?: string): void;
	/** frappe/public/js/frappe/form/form.js:2164-2176. */
	update_in_all_rows(
		table_fieldname: string,
		fieldname: string,
		value: unknown
	): void;
	/** frappe/public/js/frappe/form/form.js:2178-2184. */
	get_sum(table_fieldname: string, fieldname: string): number;
	/**
	 * frappe/public/js/frappe/form/form.js:2186-2222. Activates the field's tab, expands its section and
	 * scrolls it into view within `.main-section` — the scroll container is passed
	 * explicitly since 16.50 (:2204). Returns `false` when there is no such field
	 * or it has no wrapper (:2188, :2191) and `true` otherwise (:2221): callers
	 * such as `scroll_to_element` branch on it (:1641, :1652).
	 */
	scroll_to_field(fieldname: string, focus?: boolean): boolean;
	/** frappe/public/js/frappe/form/form.js:2296-2332. */
	set_active_tab(tab: Tab): void;
	/** frappe/public/js/frappe/form/form.js:2334-2336. */
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
 * `frappe.ui.form.Footer` (class `FormFooter`) — frappe/public/js/frappe/form/footer/footer.js:4-97.
 * The comment box and activity timeline under a form; {@link Form.footer}
 * holds the form's own. `$.extend(this, opts)` merges the options onto the
 * instance (:6), then the constructor builds the footer, the comment box and
 * the timeline (:7-9).
 */
export declare class FormFooter {
	/** frappe/public/js/frappe/form/footer/footer.js:5-14. Form builds it with `{ frm, parent }` (frappe/public/js/frappe/form/form.js:173-176). */
	constructor(opts: { frm: Form; parent: JQuery<HTMLElement>; [option: string]: unknown });
	frm: Form;
	/** Hidden for a new document — frappe/public/js/frappe/form/footer/footer.js:84-87. */
	parent: JQuery<HTMLElement>;
	/** The rendered `form_footer` template — frappe/public/js/frappe/form/footer/footer.js:16. */
	wrapper: JQuery<HTMLElement>;
	/** frappe/public/js/frappe/form/footer/footer.js:15-21. */
	make(): void;
	/** frappe/public/js/frappe/form/footer/footer.js:22-32. */
	setup_scroll_to_top(): void;
	/** frappe/public/js/frappe/form/footer/footer.js:33-44. */
	toggle_scroll_to_top_button($button: JQuery<HTMLElement>, $container: JQuery<HTMLElement>): void;
	/** frappe/public/js/frappe/form/footer/footer.js:45-76 — sets `frm.comment_box`. */
	make_comment_box(): void;
	/** frappe/public/js/frappe/form/footer/footer.js:77-82 — sets `frm.timeline`. */
	make_timeline(): void;
	/** frappe/public/js/frappe/form/footer/footer.js:83-91 — refreshes the timeline, or hides the footer for a new document. */
	refresh(): void;
	/** frappe/public/js/frappe/form/footer/footer.js:93-96. */
	refresh_comments_count(): void;
}

/**
 * One timeline entry, as `BaseTimeline#get_timeline_item` renders it
 * (frappe/public/js/frappe/form/footer/base_timeline.js:96-157). `content` and
 * `creation` are always read; the rest are optional.
 */
export interface FormTimelineItem {
	/** Appended into `.timeline-content` — frappe/public/js/frappe/form/footer/base_timeline.js:145. */
	content: string | JQuery;
	/** Sorts the entries and renders the time — frappe/public/js/frappe/form/footer/base_timeline.js:53-55, :146-153. */
	creation: string;
	doctype?: string;
	name?: string;
	/** A `frappe.utils.icon` name — frappe/public/js/frappe/form/footer/base_timeline.js:127-133. */
	icon?: string;
	icon_size?: string;
	icon_class?: string;
	title?: string;
	/** HTML used when there is no `icon` — frappe/public/js/frappe/form/footer/base_timeline.js:134-136. */
	timeline_badge?: string | JQuery;
	hide_timestamp?: boolean;
	is_card?: boolean;
	/** frappe/public/js/frappe/form/footer/base_timeline.js:154-156. */
	id?: string;
}

/**
 * The form's activity timeline, `FormTimeline`
 * (frappe/public/js/frappe/form/footer/form_timeline.js:10), extending
 * `BaseTimeline` (frappe/public/js/frappe/form/footer/base_timeline.js:4, also
 * `frappe.ui.BaseTimeline`, :158). Neither class is on `frappe.ui.form`; the
 * instance is {@link Form.timeline}. Only the shared, public members are
 * declared.
 */
export declare class FormTimeline {
	/** frappe/public/js/frappe/form/footer/base_timeline.js:5-8 — `Object.assign(this, opts)`, then `make()`. */
	constructor(opts: { parent: JQuery<HTMLElement>; frm: Form; [option: string]: unknown });
	frm: Form;
	/** Replaced by the timeline in `make()` — frappe/public/js/frappe/form/footer/base_timeline.js:26. */
	parent: JQuery<HTMLElement>;
	/** frappe/public/js/frappe/form/footer/base_timeline.js:11-12. */
	timeline_wrapper: JQuery<HTMLElement>;
	/** The same element — frappe/public/js/frappe/form/footer/base_timeline.js:12. */
	wrapper: JQuery<HTMLElement>;
	/** frappe/public/js/frappe/form/footer/base_timeline.js:13. */
	timeline_items_wrapper: JQuery<HTMLElement>;
	/** frappe/public/js/frappe/form/footer/base_timeline.js:14-20. */
	timeline_actions_wrapper: JQuery<HTMLElement>;
	/** The entries `prepare_timeline_contents` collected — frappe/public/js/frappe/form/footer/base_timeline.js:27, :48. */
	timeline_items: FormTimelineItem[];
	/** `frm.get_docinfo()` at the last render — frappe/public/js/frappe/form/footer/base_timeline.js:49. */
	doc_info?: unknown;
	/** frappe/public/js/frappe/form/footer/form_timeline.js:11-16. */
	make(): void;
	/** frappe/public/js/frappe/form/footer/form_timeline.js:18-23 — re-renders and fires the form's `timeline_refresh` event. */
	refresh(): void;
	/** frappe/public/js/frappe/form/footer/base_timeline.js:34-44 — a button above the entries; returns it. */
	add_action_button(
		label: string,
		action: (event: JQuery.ClickEvent) => unknown,
		icon?: string | null,
		btn_class?: string | null
	): JQuery<HTMLElement>;
	/** frappe/public/js/frappe/form/footer/form_timeline.js:123-127. */
	render_timeline_items(): void;
	/** frappe/public/js/frappe/form/footer/form_timeline.js:162-179 — fills `timeline_items`. */
	prepare_timeline_contents(): unknown;
	/** frappe/public/js/frappe/form/footer/base_timeline.js:70-78 — renders one entry, newest first unless `append_at_the_end`. */
	add_timeline_item(item: FormTimelineItem, append_at_the_end?: boolean): JQuery<HTMLElement>;
	/** frappe/public/js/frappe/form/footer/base_timeline.js:80-82. */
	add_timeline_items(items: FormTimelineItem[], append_at_the_end?: boolean): void;
	/** frappe/public/js/frappe/form/footer/base_timeline.js:96-157. */
	get_timeline_item(item: FormTimelineItem): JQuery<HTMLElement>;
	/** frappe/public/js/frappe/form/footer/form_timeline.js:559 — opens the email composer, as a reply when given a Communication. */
	compose_mail(communication_doc?: FrappeDoc | null, reply_all?: boolean): void;
}

/**
 * The jQuery events a form triggers on `document`, with the arguments
 * `trigger` passes: `$(document).trigger("form-refresh", [this])`
 * (frappe/public/js/frappe/form/form.js:670), and the same for `form-load`
 * (:611), `form-unload` (:613) and `form-rename` (:620). Handlers receive the
 * jQuery event first, then these:
 *
 * ```ts
 * $(document).on("form-refresh", (_e: JQuery.TriggeredEvent, ...[frm]: FormDocumentEvents["form-refresh"]) => {});
 * ```
 */
export interface FormDocumentEvents {
	"form-load": [frm: Form];
	"form-unload": [frm: Form];
	"form-rename": [frm: Form];
	"form-refresh": [frm: Form];
}

/**
 * What {@link Form.set_value} accepts for a field whose document type is `V`:
 * `V` itself, plus — for a Table field — an array of partial rows, because
 * frappe builds the real rows from them (frappe/public/js/frappe/form/form.js:1873-1901).
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
 * An entry of {@link Form.events}: the same handler, as scripts call it
 * (`frm.events.helper(frm)`). A method signature for the same reason as
 * {@link FormEventHandlerSignature}.
 */
interface FormEventsEntrySignature<FrmDT extends string> {
	handler(frm: Form<FrmDT>, cdt?: string, cdn?: string): unknown;
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
	/** frappe/public/js/frappe/form/dashboard.js:463 — after the connections counts arrive in `frm.dashboard_data`. */
	dashboard_update?: FormEventHandler<FrmDT>;
	/** frappe/public/js/frappe/form/form.js:141 — when the form's page is hidden. */
	on_hide?: FormEventHandler<FrmDT>;
	/** frappe/public/js/frappe/form/form.js:2319 — after `set_active_tab`. */
	on_tab_change?: FormEventHandler<FrmDT>;
	/**
	 * frappe/public/js/frappe/form/grid_row.js:1419 — a child row's detail form
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
 *   (frappe/public/js/frappe/form/grid.js:1203), `before_<table>_remove` and
 *   `<table>_remove` (frappe/public/js/frappe/form/grid_row.js:100-113),
 *   `<table>_move` (frappe/public/js/frappe/form/grid.js:941-946),
 *   `<table>_delete` after a bulk delete (frappe/public/js/frappe/form/grid.js:389, :413);
 *   and `<table>_on_form_rendered` on the PARENT (frappe/public/js/frappe/form/grid_row.js:1418);
 * - a `depends_on: "fn:<name>"` callback (frappe/public/js/frappe/form/layout.js:810-815);
 * - a helper of your own, reached with `frm.trigger("<name>")`
 *   (frappe/public/js/frappe/form/form.js:2003-2005). It is called like any
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
 * QuickEntryForm and PrintView
 * ========================================================================== */

/**
 * The callback a {@link QuickEntryForm} calls after the document was created.
 * It receives the saved document (`frappe/public/js/frappe/form/quick_entry.js:294-295`),
 * or the unsaved one when `skip_insert` is set (:228-229). After "Edit Full
 * Form", or a failed insert that opens the full form, it is called later with
 * that FORM once it saves (:339-343), hence the union.
 */
export type QuickEntryAfterInsert = (doc_or_frm: FrappeDoc | Form) => void;

/**
 * `frappe.ui.form.QuickEntryForm` — frappe/public/js/frappe/form/quick_entry.js:36,
 * the "quick entry" dialog for a doctype's mandatory and `allow_in_quick_entry`
 * fields. Usually reached through `frappe.ui.form.make_quick_entry`, which
 * prefers a doctype-specific subclass registered as
 * `frappe.ui.form.<DocTypeWithoutSpaces>QuickEntryForm`
 * (frappe/public/js/frappe/form/quick_entry.js:18-23).
 *
 * The constructor only stores its arguments; {@link QuickEntryForm.setup}
 * loads the doctype and either renders the dialog or, when the doctype does
 * not qualify for quick entry, routes to the full form.
 */
export declare class QuickEntryForm extends Dialog {
	/** frappe/public/js/frappe/form/quick_entry.js:37-49. */
	constructor(
		doctype: string,
		after_insert?: QuickEntryAfterInsert | null,
		init_callback?: ((dialog_or_doc: QuickEntryForm | FrappeDoc) => void) | null,
		doc?: FrappeDoc | null,
		force?: boolean,
		skip_insert?: boolean,
	);
	override doctype: string;
	after_insert?: QuickEntryAfterInsert | null;
	/**
	 * Called with the dialog once it is rendered (:169-171), or with the new
	 * document when quick entry does not apply and the full form opens instead
	 * (:67-69).
	 */
	init_callback?: ((dialog_or_doc: QuickEntryForm | FrappeDoc) => void) | null;
	/** The document being created: the one passed in, or a new one made in `setup()` (:89-93). */
	override doc: FrappeDoc;
	/** frappe/public/js/frappe/form/quick_entry.js:45 — show the dialog even when the doctype does not qualify. */
	force: boolean;
	/** frappe/public/js/frappe/form/quick_entry.js:46 — only fill `doc` and call `after_insert`; do not save. */
	skip_insert: boolean;
	/**
	 * frappe/public/js/frappe/form/quick_entry.js:47 — `this.dialog = this`, "for
	 * backward compatibility". frappe reaches the form's own members through it
	 * (`me.dialog.working`, :187-190; `me.dialog.doc`, :240, :330), so it is typed
	 * as the instance, subclass included.
	 */
	dialog: this;
	/** frappe/public/js/frappe/form/quick_entry.js:76. */
	meta: DocTypeMeta;
	/** frappe/public/js/frappe/form/quick_entry.js:79-86 — the fields shown: mandatory or `allow_in_quick_entry`, not read-only, not virtual. */
	docfields: DocField[];
	/** @deprecated frappe/public/js/frappe/form/quick_entry.js:142-152 — {@link QuickEntryForm.docfields}, with a console warning. */
	get mandatory(): DocField[];
	set mandatory(value: DocField[]);
	/** frappe/public/js/frappe/form/quick_entry.js:187-190 — set while a save is in flight. */
	working?: boolean;
	/** Read at frappe/public/js/frappe/form/quick_entry.js:262: when set, a failed insert does not open the full form. */
	skip_redirect_on_error?: boolean;
	/** Read at frappe/public/js/frappe/form/quick_entry.js:350: when set, no "Edit Full Form" link. */
	hide_full_form_button?: boolean;

	/** frappe/public/js/frappe/form/quick_entry.js:51-73 — resolves with this dialog, rendered or not. */
	setup(): Promise<this>;
	/** frappe/public/js/frappe/form/quick_entry.js:75-87. */
	set_meta_and_mandatory_fields(): void;
	/** frappe/public/js/frappe/form/quick_entry.js:89-93. */
	check_quick_entry_doc(): void;
	/** frappe/public/js/frappe/form/quick_entry.js:95-107 — the doctype has `quick_entry` set, no mandatory table, and at least one field to show. */
	is_quick_entry(): boolean;
	/** frappe/public/js/frappe/form/quick_entry.js:109-115 — more than seven fields. */
	too_many_mandatory_fields(): boolean;
	/** frappe/public/js/frappe/form/quick_entry.js:117-127. */
	has_child_table(): boolean;
	/** frappe/public/js/frappe/form/quick_entry.js:129-140 — prepends a `__newname` field for prompt-named doctypes. */
	validate_for_prompt_autoname(): void;
	/** frappe/public/js/frappe/form/quick_entry.js:154-172 — builds and shows the dialog, then calls `init_callback`. */
	render_dialog(): void;
	/** frappe/public/js/frappe/form/quick_entry.js:174-182. */
	get_title(): string;
	/** frappe/public/js/frappe/form/quick_entry.js:184-222. */
	register_primary_action(): void;
	/** frappe/public/js/frappe/form/quick_entry.js:224-231. */
	handle_after_callbacks(): void;
	/** frappe/public/js/frappe/form/quick_entry.js:233-271 — `update_doc(values)`, then saves through `frappe.client.save`; resolves with the dialog's `doc` on success only. */
	insert(values?: Record<string, unknown>): Promise<FrappeDoc>;
	/** frappe/public/js/frappe/form/quick_entry.js:273-285. */
	submit(doc: FrappeDoc): void;
	/** frappe/public/js/frappe/form/quick_entry.js:287-299 — replaces `doc` with the saved one, then calls `after_insert` or opens the form. */
	process_after_insert(r: { message: FrappeDoc }): void;
	/** frappe/public/js/frappe/form/quick_entry.js:301-314. */
	setup_cmd_enter_for_save(): void;
	/** frappe/public/js/frappe/form/quick_entry.js:316-324. */
	open_form_if_not_list(): void;
	/** frappe/public/js/frappe/form/quick_entry.js:326-334 — copies the non-null values of `data` (default: the dialog's, `get_values(true)`) onto `doc` and returns it. */
	update_doc(data?: Record<string, unknown>): FrappeDoc;
	/** frappe/public/js/frappe/form/quick_entry.js:336-347 — hides the dialog and opens the full form with what was typed. */
	open_doc(set_hooks?: boolean): void;
	/** frappe/public/js/frappe/form/quick_entry.js:349-352. */
	render_edit_in_full_page_link(): void;
	/** frappe/public/js/frappe/form/quick_entry.js:354-360 — an alert at the top of the dialog; clears it for a falsy `txt`. */
	set_intro(txt?: string | null, color?: string): void;
	/** frappe/public/js/frappe/form/quick_entry.js:362-367 — does nothing for a field the dialog does not have. */
	override set_df_property(fieldname: string, prop: string, value: unknown): void;
	/** frappe/public/js/frappe/form/quick_entry.js:369-374. */
	toggle_display(fieldnames: string | readonly string[] | null | undefined, show: boolean): void;
	/** frappe/public/js/frappe/form/quick_entry.js:376-381. */
	toggle_enable(fieldnames: string | readonly string[] | null | undefined, enable: boolean): void;
	/** frappe/public/js/frappe/form/quick_entry.js:383-388. */
	toggle_reqd(fieldnames: string | readonly string[] | null | undefined, mandatory: boolean): void;
	/** frappe/public/js/frappe/form/quick_entry.js:399-410 — fills the inputs from `doc`. */
	set_defaults(): void;
}
export interface QuickEntryForm {}

/**
 * What {@link PrintView.show} prints: a {@link Form}, or the stand-in the print
 * page builds when it is opened by URL
 * (frappe/printing/page/print/print.js:17-25).
 */
export interface PrintViewTarget {
	doctype: string;
	docname: string;
	doc: FrappeDoc;
	meta: DocTypeMeta;
}

/**
 * `frappe.ui.form.PrintView` — frappe/printing/page/print/print.js:38, the
 * controller of the `print` page. It is defined by that Page's own script,
 * not by a desk bundle, so it exists only once the print page has been opened.
 * An app extends it with a `page_js` hook for the `print` page, whose code runs
 * after frappe's script:
 *
 * ```js
 * // hooks.py: page_js = {"print": "public/js/print_view.js"}
 * const Base = frappe.ui.form.PrintView;
 * if (Base) {
 *   frappe.ui.form.PrintView = class extends Base {
 *     show(frm) { super.show(frm); this.page.add_button(__("Mail"), () => {}); }
 *   };
 * }
 * ```
 */
export declare class PrintView {
	/** frappe/printing/page/print/print.js:39-47 — `wrapper` is the print page's element, after `make_app_page`. */
	constructor(wrapper: HTMLElement & { page: Page });
	/** frappe/printing/page/print/print.js:40. */
	wrapper: JQuery<HTMLElement>;
	/** frappe/printing/page/print/print.js:41. */
	page: Page;
	/** The document printed, set by {@link PrintView.show} (frappe/printing/page/print/print.js:407). */
	frm: PrintViewTarget;
	/** frappe/printing/page/print/print.js:99 — the Print Settings single. */
	print_settings: FrappeDoc;
	/** frappe/printing/page/print/print.js:50. */
	print_wrapper: JQuery<HTMLElement>;
	/** frappe/printing/page/print/print.js:135. */
	sidebar: JQuery<HTMLElement>;
	/** frappe/printing/page/print/print.js:434 — values of the print settings the doctype adds to the sidebar. */
	additional_settings: Record<string, unknown>;
	/** frappe/printing/page/print/print.js:49-104 — builds the preview, toolbar, sidebar and menu. Called by the constructor. */
	make(): void;
	/** frappe/printing/page/print/print.js:106-108. */
	set_title(): void;
	/** frappe/printing/page/print/print.js:110-132 — Print, PDF, Email and the Form switch. Since 16.53 Full Page and Refresh are in the menu instead. */
	setup_toolbar(): void;
	/** frappe/printing/page/print/print.js:134-192. */
	setup_sidebar(): void;
	/** frappe/printing/page/print/print.js:353-369 — a control in the sidebar. */
	add_sidebar_item(df: Partial<DocField>, is_dynamic?: boolean): BaseControl;
	/** frappe/printing/page/print/print.js:371-404. */
	setup_menu(): void;
	/**
	 * frappe/printing/page/print/print.js:406-421 — prints `frm`: sets the title
	 * and breadcrumbs, then the default format, language and letterhead, then
	 * renders the preview. Resolves when all of that has run.
	 */
	show(frm: PrintViewTarget): Promise<unknown>;
	/** frappe/printing/page/print/print.js:537-541. */
	refresh_print_format(): void;
	/** frappe/printing/page/print/print.js:804-843 — renders the preview, through the print format generator when the format uses one. */
	preview(): void;
	/** frappe/printing/page/print/print.js:976-984 — returns a form's print view to its main view. */
	hide(): void;
	/** frappe/printing/page/print/print.js:986-991. */
	go_to_form_view(): void;
	/** frappe/printing/page/print/print.js:1008-1065 — through the print server, a mapped raw printer, or the browser (the generated PDF when Print Settings has `print_generated_pdf`). */
	printit(): void;
	/** frappe/printing/page/print/print.js:1135-1147 — opens the PDF in a new window. */
	render_pdf(): void;
	/** frappe/printing/page/print/print.js:1233-1239 — opens `method` with the document, format, letterhead and settings as query parameters (`get_page_url`, :1241-1265). */
	render_page(method: string, printit?: boolean, pdf_generator?: string): void;
	/** frappe/printing/page/print/print.js:1297-1299 — the selected letterhead, or the translated "No Letterhead". */
	get_letterhead(): string;
	/** frappe/printing/page/print/print.js:1364-1366 — the selected print format, or `"Standard"`. */
	selected_format(): string;
	/** frappe/printing/page/print/print.js:1372-1383 — the Print Format document from `locals`, or `{}`. */
	get_print_format(format?: string): Record<string, unknown>;
	/** frappe/printing/page/print/print.js:1385-1387 — `1` unless "No Letterhead" is selected, else `0`. */
	with_letterhead(): number;
}
export interface PrintView {}

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
 * - Each `Control*` member is typed as its own class (`typeof ControlData`,
 *   `typeof ControlCode`, …), declared above with the members its file
 *   defines, and each class extends the one its file extends. Every chain
 *   terminates at `frappe.ui.form.Control` (= {@link BaseControl}) through
 *   one of its five direct subclasses: `ControlInput`
 *   (`frappe/public/js/frappe/form/controls/base_input.js:2`, the parent of
 *   `ControlData` and so of nearly every other control), `ControlHTML`,
 *   `ControlTable`, `ControlMultiCheck` and `ControlImage`. The three aliases
 *   share their target's class: `ControlReadOnly` is `ControlData`
 *   (`frappe/public/js/frappe/form/controls/data.js:336`), `ControlLongText` is
 *   `ControlText` (`frappe/public/js/frappe/form/controls/text.js:23`) and
 *   `ControlLongInt` is `ControlInt`
 *   (`frappe/public/js/frappe/form/controls/int.js:28`). This is the registry
 *   `make_control` resolves a fieldtype in
 *   (`frappe/public/js/frappe/form/controls/control.js:48`).
 * - The remaining members are `unknown`, unless typed below. Their shapes are NOT declared by this
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
	 * none. Assigned at frappe/public/js/frappe/form/grid_row.js:1112 and cleared at :1140, both in
	 * `toggle_editable_row`; read at frappe/public/js/frappe/form/grid.js:47-48, :1079 and frappe/public/js/frappe/form/grid_row.js:1027,
	 * :1097-1098.
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
	/* -- Control classes, by fieldtype name (`controls/*.js`). Each is its own
	 * class, ending at `frappe.ui.form.Control` = BaseControl; this is the
	 * registry `make_control` reads (frappe/public/js/frappe/form/controls/control.js:48).
	 *
	 * Each slot is a get/set pair. Reading it gives the precise class, so
	 * `class extends frappe.ui.form.ControlData` sees every member and static
	 * that file defines. Writing it takes any control class: `make_control`
	 * only calls `new frappe.ui.form["Control" + fieldtype](opts)`
	 * (frappe/public/js/frappe/form/controls/control.js:48-55), so an app may
	 * register a replacement that does not descend from the class it replaces.
	 * -------------------- */
	get ControlAttach(): typeof ControlAttach;
	set ControlAttach(value: typeof BaseControl);
	get ControlAttachImage(): typeof ControlAttachImage;
	set ControlAttachImage(value: typeof BaseControl);
	get ControlAttachmentGallery(): typeof ControlAttachmentGallery;
	set ControlAttachmentGallery(value: typeof BaseControl);
	get ControlAutocomplete(): typeof ControlAutocomplete;
	set ControlAutocomplete(value: typeof BaseControl);
	get ControlBarcode(): typeof ControlBarcode;
	set ControlBarcode(value: typeof BaseControl);
	get ControlButton(): typeof ControlButton;
	set ControlButton(value: typeof BaseControl);
	get ControlCheck(): typeof ControlCheck;
	set ControlCheck(value: typeof BaseControl);
	get ControlCode(): typeof ControlCode;
	set ControlCode(value: typeof BaseControl);
	get ControlColor(): typeof ControlColor;
	set ControlColor(value: typeof BaseControl);
	get ControlComment(): typeof ControlComment;
	set ControlComment(value: typeof BaseControl);
	get ControlCurrency(): typeof ControlCurrency;
	set ControlCurrency(value: typeof BaseControl);
	get ControlData(): typeof ControlData;
	set ControlData(value: typeof BaseControl);
	get ControlDate(): typeof ControlDate;
	set ControlDate(value: typeof BaseControl);
	get ControlDateRange(): typeof ControlDateRange;
	set ControlDateRange(value: typeof BaseControl);
	get ControlDatetime(): typeof ControlDatetime;
	set ControlDatetime(value: typeof BaseControl);
	get ControlDuration(): typeof ControlDuration;
	set ControlDuration(value: typeof BaseControl);
	get ControlDynamicLink(): typeof ControlDynamicLink;
	set ControlDynamicLink(value: typeof BaseControl);
	get ControlFloat(): typeof ControlFloat;
	set ControlFloat(value: typeof BaseControl);
	get ControlGeolocation(): typeof ControlGeolocation;
	set ControlGeolocation(value: typeof BaseControl);
	get ControlHTML(): typeof ControlHTML;
	set ControlHTML(value: typeof BaseControl);
	get ControlHTMLEditor(): typeof ControlHTMLEditor;
	set ControlHTMLEditor(value: typeof BaseControl);
	get ControlHeading(): typeof ControlHeading;
	set ControlHeading(value: typeof BaseControl);
	get ControlIcon(): typeof ControlIcon;
	set ControlIcon(value: typeof BaseControl);
	get ControlImage(): typeof ControlImage;
	set ControlImage(value: typeof BaseControl);
	get ControlInt(): typeof ControlInt;
	set ControlInt(value: typeof BaseControl);
	get ControlJSON(): typeof ControlJSON;
	set ControlJSON(value: typeof BaseControl);
	get ControlLink(): typeof ControlLink;
	set ControlLink(value: typeof BaseControl);
	get ControlLongInt(): typeof ControlInt;
	set ControlLongInt(value: typeof BaseControl);
	get ControlLongText(): typeof ControlText;
	set ControlLongText(value: typeof BaseControl);
	get ControlMarkdownEditor(): typeof ControlMarkdownEditor;
	set ControlMarkdownEditor(value: typeof BaseControl);
	get ControlMultiCheck(): typeof ControlMultiCheck;
	set ControlMultiCheck(value: typeof BaseControl);
	get ControlMultiSelect(): typeof ControlMultiSelect;
	set ControlMultiSelect(value: typeof BaseControl);
	get ControlMultiSelectList(): typeof ControlMultiSelectList;
	set ControlMultiSelectList(value: typeof BaseControl);
	get ControlMultiSelectPills(): typeof ControlMultiSelectPills;
	set ControlMultiSelectPills(value: typeof BaseControl);
	get ControlPassword(): typeof ControlPassword;
	set ControlPassword(value: typeof BaseControl);
	get ControlPercent(): typeof ControlPercent;
	set ControlPercent(value: typeof BaseControl);
	get ControlPhone(): typeof ControlPhone;
	set ControlPhone(value: typeof BaseControl);
	get ControlRating(): typeof ControlRating;
	set ControlRating(value: typeof BaseControl);
	get ControlReadOnly(): typeof ControlData;
	set ControlReadOnly(value: typeof BaseControl);
	get ControlSelect(): typeof ControlSelect;
	set ControlSelect(value: typeof BaseControl);
	get ControlSignature(): typeof ControlSignature;
	set ControlSignature(value: typeof BaseControl);
	get ControlSmallText(): typeof ControlSmallText;
	set ControlSmallText(value: typeof BaseControl);
	get ControlSwitch(): typeof ControlSwitch;
	set ControlSwitch(value: typeof BaseControl);
	get ControlTableMultiSelect(): typeof ControlTableMultiSelect;
	set ControlTableMultiSelect(value: typeof BaseControl);
	get ControlText(): typeof ControlText;
	set ControlText(value: typeof BaseControl);
	get ControlTextEditor(): typeof ControlTextEditor;
	set ControlTextEditor(value: typeof BaseControl);
	get ControlTime(): typeof ControlTime;
	set ControlTime(value: typeof BaseControl);

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
	/** frappe/public/js/frappe/form/footer/footer.js:4. See {@link FormFooter}. */
	Footer: typeof FormFooter;
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
	/** frappe/public/js/frappe/form/quick_entry.js:36. See {@link QuickEntryForm}. */
	QuickEntryForm: typeof QuickEntryForm;
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
	/**
	 * frappe/public/js/frappe/form/controls/select.js:111-136. Appends an
	 * `<option>` per entry to the `<select>` (sorted by label when `sort`),
	 * translating labels in `doctype`'s context, selects the first and fires
	 * `select-change`. A non-array `options_list` is ignored. Returns the
	 * `<select>`, wrapped.
	 */
	add_options(
		input: HTMLElement | JQuery,
		options_list: ReadonlyArray<SelectOption | null | undefined> | null | undefined,
		sort?: unknown,
		doctype?: string | null,
	): JQuery<HTMLElement>;
	/** `form/save.js` */
	check_mandatory: unknown;
	/**
	 * frappe/public/js/frappe/form/script_manager.js:14-22 — the handler list for
	 * one doctype and event, created (empty) on first access.
	 */
	get_event_handler_list(doctype: string, fieldname: string): FormEventHandler[];
	/** `form/save.js` */
	is_saving: unknown;
	/**
	 * frappe/public/js/frappe/form/quick_entry.js:10-34 — builds the quick entry
	 * dialog for `doctype` (a `frappe.ui.form.<DocTypeWithoutSpaces>QuickEntryForm`
	 * when one is registered, else {@link QuickEntryForm}), stores it as
	 * `frappe.quick_entry`, and returns its `setup()`.
	 */
	make_quick_entry(
		doctype: string,
		after_insert?: QuickEntryAfterInsert | null,
		init_callback?: ((dialog_or_doc: QuickEntryForm | FrappeDoc) => void) | null,
		doc?: FrappeDoc | null,
		force?: boolean,
		skip_insert?: boolean,
	): Promise<QuickEntryForm>;
	/**
	 * frappe/printing/page/print/print.js:38. **Optional**, unlike the rest of
	 * this namespace: the print Page's own script defines it, so it exists only
	 * once that page has been opened. See {@link PrintView}.
	 */
	PrintView?: typeof PrintView;
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
 * :341, :991, :1051-1052) plus the state classes other code keys off.
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
	 * (frappe/public/js/frappe/form/grid_row.js:755-757): since 16.50 that column grows to fill the spare
	 * width. It replaces the `column-limit-reached` class on the grid container,
	 * which frappe no longer emits.
	 */
	| "grid-data-last"
	/** Added by `toggle_editable_row(true)` — frappe/public/js/frappe/form/grid_row.js:1101. */
	| "editable-row"
	/**
	 * Added by `show_form()` (frappe/public/js/frappe/form/grid_row.js:1408), removed by `hide_form()`
	 * (:1437). The cross-app "this row is open" contract — see
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
 * `.grid-field`** by the cell `focusin` handler (frappe/public/js/frappe/form/grid_row.js:996-1023), so it
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

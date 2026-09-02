// =============================================================================
// frappe-types — group `globals-jquery`
//
// The `window`-level desk globals that are NOT hung off `frappe.*`, plus the
// jQuery surface frappe and Bootstrap extend.
//
// Source of truth: apps/frappe @ 33bf510b17 (tag v16.33.0, branch version-16).
// Every citation below is `path/relative/to/apps/frappe/file.js:line`.
//
// Module style on purpose: nothing here is `declare global`. The package author
// assembles the ambient layer from `DeskGlobals` / `DeskWindow` /
// `JQueryStaticFrappeExtensions` / `JQueryFrappePlugins` /
// `JQueryFrappeOverloads` below (see
// "ASSEMBLY NOTES" at the foot of this file).
// =============================================================================

import type { DocTypeMeta, FrappeDoc } from "./model";
// IMPORT-NAME FIXES — `ui/form.d.ts` exports the Form class as `Form`, not
// `Form` (that is only its JS class-expression name at form.js:24), and
// `Dialog` is declared in `ui/form.d.ts`, not `core.d.ts` (core.d.ts imports it
// from there and re-exports it as `FrappeDialog`).
import type { Dialog, Form } from "./ui/form";
import type { Container, CurrentListView, ListView } from "./views";
import type { GridRow } from "./deep-modules";

// =============================================================================
// 1. TRANSLATION — `__()` / `frappe._`
// =============================================================================

/**
 * Positional replacement arguments for {@link TranslateFunction}.
 *
 * `frappe._` forwards this straight to `$.format`
 * (frappe/public/js/frappe/translate.js:20), whose implementation is
 * frappe/public/js/frappe/format.js:1-17.
 *
 * `format` only substitutes a placeholder whose captured key passes
 * `key == +key` (format.js:12) — i.e. `{0}`, `{1}`, … and the auto-numbered
 * `{}` (format.js:8-11). A NAMED placeholder such as `{doctype}` falls through
 * that `if`, the replacer function returns `undefined`, and
 * `String.prototype.replace` stringifies that to the literal text
 * `"undefined"`.
 *
 * So the honest type is array-like, NOT a keyed record: a keyed object passes
 * frappe's own `typeof replace === "object"` guard (translate.js:19) and then
 * silently corrupts the message. Every one of the ~306 `__(msg, [...])` call
 * sites in frappe/public/js/frappe passes an array.
 */
export type TranslationArgs = ArrayLike<unknown>;

/**
 * `window.__` — the desk translation function.
 *
 * Defined as `frappe._` at frappe/public/js/frappe/translate.js:5-24 and
 * aliased onto the global at translate.js:26 (`window.__ = frappe._;`). Also
 * injected into every Vue app as `globalProperties.__`
 * (frappe/public/js/libs.bundle.js:8).
 *
 * Runtime body, verbatim:
 * ```js
 * frappe._ = function (txt, replace, context = null) {
 *   if (!txt) return txt;                     // translate.js:6  — falsy passthrough
 *   if (typeof txt != "string") return txt;   // translate.js:7  — non-string passthrough
 *   let key = txt;
 *   if (context) translated_text = frappe._messages[`${key}:${context}`];   // :12-14
 *   if (!translated_text) translated_text = frappe._messages[key] || txt;   // :16-18
 *   if (replace && typeof replace === "object")
 *     translated_text = $.format(translated_text, replace);                 // :19-21
 *   return translated_text;
 * };
 * ```
 *
 * Three consequences the overloads below encode:
 *
 * 1. **`txt` is returned verbatim when falsy.** `__(undefined)` is `undefined`,
 *    `__("")` is `""`, `__(null)` is `null` (translate.js:6). carbon_frappe
 *    relies on this — `__(df.label, null, df.parent)`
 *    (carbon_frappe/public/js/tables/grid/grid.js:356) is called with a
 *    `df.label` that is `string | undefined`.
 * 2. **`replace` is ignored unless it is a truthy object** (translate.js:19).
 *    frappe's own grid passes the empty string as a placeholder for "no
 *    replacements": `__("Edit", "", "Edit grid row")`
 *    (frappe/public/js/frappe/form/grid_row.js:341). Hence `string` is in the
 *    union — it type-checks *and* is a no-op, matching runtime.
 * 3. **`context` is the third argument, defaulting to `null`.** It selects the
 *    `` `${key}:${context}` `` message variant (translate.js:13). frappe passes
 *    a doctype there — `__(v, null, doctype)`
 *    (frappe/public/js/frappe/form/controls/select.js:143 region,
 *    `parse_option`) — and that doctype can be `undefined`, so the parameter is
 *    optional and nullable.
 */
export interface TranslateFunction {
	/** Falsy passthrough — translate.js:6. */
	(txt: undefined, replace?: TranslationArgs | string | null, context?: string | null): undefined;
	/** Falsy passthrough — translate.js:6. */
	(txt: null, replace?: TranslationArgs | string | null, context?: string | null): null;
	(txt: string, replace?: TranslationArgs | string | null, context?: string | null): string;
	(
		txt: string | undefined,
		replace?: TranslationArgs | string | null,
		context?: string | null
	): string | undefined;
	(
		txt: string | null,
		replace?: TranslationArgs | string | null,
		context?: string | null
	): string | null;
	(
		txt: string | null | undefined,
		replace?: TranslationArgs | string | null,
		context?: string | null
	): string | null | undefined;
}

// =============================================================================
// 2. `locals` — the client-side document cache
// =============================================================================

/**
 * `window.locals` — frappe's in-memory document cache, keyed
 * `locals[doctype][docname]`.
 *
 * Created by `frappe.provide("locals")`
 * (frappe/public/js/frappe/provide.js:21) and seeded with the `DocType` bucket
 * at provide.js:34 (`frappe.provide("locals.DocType")`). `frappe.provide`
 * itself only ever assigns `{}` (provide.js:13-15), so both are plain objects.
 *
 * Read/write shape, verified in frappe/public/js/frappe/model/model.js:
 * - `locals[dt][dn]` is a document — model.js:155, :453, :523, :608.
 * - `locals[dt][dn][fieldname]` is a field value — model.js:453, :498.
 * - `delete locals[doctype][name]` — model.js:645, :667.
 * - `locals.DocType[doctype]` is the DocType meta — model.js:218, :309, :369
 *   (`.is_submittable`), :374 (`.istable`), :384 (`.is_tree`); also
 *   frappe/public/js/frappe/model/meta.js:14.
 *
 * **`":" + doctype` buckets.** model.js:472 reads
 * `locals[doctype] || locals[":" + doctype]`, and
 * frappe/public/js/frappe/model/sync.js:49-57 writes `locals[":Print Format"]`.
 * These colon-prefixed keys hold *stripped* records (sync.js:52-56 stores a
 * hand-built object, not a full doc), which is why the index-signature value is
 * deliberately loose rather than `FrappeDoc` alone.
 *
 * Every lookup can miss, so both levels are explicitly `| undefined`. Under the
 * consumer's `noUncheckedIndexedAccess: true` that would happen anyway; it is
 * spelled out so the types stay honest for consumers without that flag.
 */
export interface LocalsStore {
	/**
	 * DocType metadata cache — `locals.DocType[doctype]`.
	 * provide.js:34, model.js:218, meta.js:14.
	 */
	DocType: Record<string, DocTypeMeta | undefined>;
	/**
	 * `locals[doctype][docname]`. Also holds `":" + doctype` buckets whose
	 * values are partial records rather than full documents (sync.js:49-57).
	 */
	[doctype: string]: Record<string, FrappeDoc | DocTypeMeta | undefined> | undefined;
}

// =============================================================================
// 3. `cur_*` — the desk's singleton "what is on screen" slots
// =============================================================================

/**
 * `window.cur_frm` — the form controller for the route currently rendered.
 *
 * Initialised to `null` at frappe/public/js/frappe/provide.js:50
 * (`window.cur_frm = null;`), assigned in `Form.refresh()` at
 * frappe/public/js/frappe/form/form.js:406 (`cur_frm = this;`), and cleared
 * back to `null` when a non-form page shows —
 * frappe/public/js/frappe/views/pageview.js:106.
 *
 * The class is `frappe.ui.form.Form = class Form` (form.js:24).
 *
 * **`null` is load-bearing**, not defensive: carbon_frappe guards it at
 * carbon_frappe/public/js/anatomy/editable_title.js:20-22
 * (`const frm = window.cur_frm; const toolbar = frm && frm.toolbar;`) precisely
 * because the editable-title binder runs on every route change, form or not.
 */
export type CurrentForm = Form | null;

/**
 * `window.cur_list` — the list/report view controller for the current route.
 *
 * Initialised to `null` at frappe/public/js/frappe/list/list_factory.js:6,
 * assigned in `ListFactory.set_cur_list()` at list_factory.js:93
 * (`cur_list = frappe.views.list_view[this.page_name];`) and reset to `null` at
 * list_factory.js:96 when the cached view belongs to a different doctype.
 *
 * The actual instance is whichever view class the route resolved to — Report,
 * Kanban, Gantt, Calendar, … (list_factory.js:87,
 * `frappe.views.list_view[page_name]`). Members only a subclass has need a
 * narrowing step in the consumer.
 *
 * COLLISION RESOLVED — this file used to declare its own
 * `CurrentListView = ListView | null`, which both duplicated `views.d.ts`'s
 * export of the same name and was WRONG: the harness routes to `/view/report`
 * and reads `cur_list.datatable`, which only `ReportView` has. `views.d.ts`
 * owns the alias (it declares both classes and can name `ReportView` without an
 * import) and its `ListView | ReportView | null` is the correct type; it is
 * re-exported below so `window.cur_list` and the standalone alias stay one type.
 */
export type { CurrentListView };

/**
 * `window.cur_dialog` — the top-most open `frappe.ui.Dialog`.
 *
 * Initialised to `null` at frappe/public/js/frappe/ui/dialog.js:6. Set to the
 * dialog instance on `shown.bs.modal` (dialog.js:127) and popped back to either
 * the next dialog on the `frappe.ui.open_dialogs` stack or `null` on
 * `hide.bs.modal` (dialog.js:115-119).
 *
 * Because it is a stack top, callers always null-check — e.g.
 * frappe/public/js/frappe/views/container.js:57 and
 * frappe/public/js/frappe/desk.js:421 both read
 * `window.cur_dialog && cur_dialog.display && …`.
 *
 * Not referenced by carbon_frappe today; declared because it is part of the
 * same `window.cur_*` contract and a prototype patch can land on it.
 */
export type CurrentDialog = Dialog | null;

/**
 * `window.cur_page` — the `frappe.views.Container` singleton.
 *
 * Initialised to `null` at frappe/public/js/frappe/views/container.js:8 and set
 * in `Container.change_to()` at container.js:43 (`cur_page = this;`), so the
 * value is the *Container*, not a page. The page div is reached as
 * `cur_page.page` — see frappe/public/js/onboarding_tours/onboarding_tours.js:125
 * (`cur_page?.page?.querySelector(...)`) and
 * frappe/public/js/frappe/ui/keyboard.js:89/:93 (`cur_page.page.page` /
 * `cur_page.page.frm`), which is why the optional chaining exists upstream.
 *
 * Outside the 25-symbol inventory for this group; included because it is the
 * fourth member of the `window.cur_*` family and shares their `| null` hazard.
 */
export type CurrentPageContainer = Container | null;

// =============================================================================
// 4. `erpnext` — the app namespace global
// =============================================================================

/**
 * `window.erpnext` — ERPNext's root namespace object.
 *
 * Created by `frappe.provide("erpnext")`
 * (erpnext/public/js/conf.js:4 and erpnext/public/js/utils.js:3, verified
 * against ERPNext v16.32.1), which means it is literally `{}` until each bundle
 * decorates it (provide.js:13-15).
 *
 * It is **not** part of the frappe desk API and has no fixed shape: sub-
 * namespaces are added ad hoc by ~40 `frappe.provide("erpnext.x.y")` calls
 * across the app (`erpnext.utils`, `erpnext.queries`, `erpnext.setup`,
 * `erpnext.stock`, `erpnext.accounts`, `erpnext.taxes`, `erpnext.buying`,
 * `erpnext.timesheet`, `erpnext.financial_statements`, …), plus direct class
 * assignments such as `erpnext.StockAnalytics`
 * (erpnext/public/js/stock_analytics.js:4) and `erpnext.SMSManager`
 * (erpnext/public/js/sms_manager.js:4).
 *
 * Modelled as an open record of `unknown` rather than invented members: a
 * consumer that touches `erpnext.foo` must narrow it deliberately, which is the
 * correct outcome for a namespace this typeset does not version-track.
 * carbon_frappe currently reads nothing from it (only a comment mentions
 * ERPNext, at carbon_frappe/public/js/tables/engine/classes.js:8).
 */
export interface ErpNextGlobal {
	readonly [namespace: string]: unknown;
}

// =============================================================================
// 5. Globals injected by the desk HTML template
// =============================================================================

/**
 * `window.dev_server` — 1 when the bench is running with `DEV_SERVER=1`.
 *
 * Emitted straight into the desk boot script as a bare numeric literal:
 * frappe/www/desk.html:50 and frappe/templates/base.html:52, both
 * `window.dev_server = {{ dev_server }};`. The value originates at
 * frappe/__init__.py:85, `_dev_server = int(sbool(os.environ.get("DEV_SERVER", False)))`
 * — an `int`, so Jinja renders exactly `0` or `1`, never `true`/`false`.
 *
 * Read by frappe at frappe/public/js/frappe/assets.js:114,
 * frappe/public/js/frappe/request.js:273 and
 * frappe/public/js/frappe/socketio_client.js:122; by carbon_frappe at
 * carbon_frappe/public/js/anatomy/patch.js:80.
 *
 * **Hazard:** the assignment lives in the desk template, so on a page that is
 * not rendered by frappe (carbon_frappe's own fixture page,
 * carbon_frappe/scripts/dev-table.mjs) the property is absent, not `0`. Every
 * consumer must treat it as possibly `undefined`; see {@link DeskWindow}.
 */
export type DevServerFlag = 0 | 1;

/**
 * Extra globals emitted alongside `dev_server` in the same inline `<script>`.
 * Grouped here because they share its "only exists on a frappe-rendered page"
 * lifetime.
 *
 * - `_version_number` — desk.html:47 / base.html:47, a build hash string; read
 *   at frappe/public/js/frappe/assets.js:114.
 * - `app` — desk.html:49 (`window.app = true;`), the "this is the desk, not a
 *   website page" marker. Only ever assigned the literal `true`; it is absent,
 *   not `false`, on website pages (base.html never sets it).
 * - `socketio_port` — base.html:53.
 * - `show_language_picker` — base.html:54; the template default is the string
 *   `'false'`, so this is genuinely `boolean | undefined` after Jinja.
 */
export interface DeskTemplateGlobals {
	/** desk.html:47, base.html:47 — build version hash. */
	_version_number?: string;
	/** desk.html:49 — literal `true`; absent on website pages. */
	app?: true;
	/** desk.html:50, base.html:52 — `0`/`1` from frappe/__init__.py:85. */
	dev_server?: DevServerFlag;
	/** base.html:53. */
	socketio_port?: number;
	/** base.html:54. */
	show_language_picker?: boolean;
}

// =============================================================================
// 6. jQuery — baseline
// =============================================================================
//
// frappe ships jQuery **3.7.0** (frappe/package.json:60) and publishes it on
// the window from frappe/public/js/jquery-bootstrap.js:15-16:
//
//     window.jQuery = jQuery;
//     window.$ = jQuery;
//
// That module is the first import of frappe/public/js/libs.bundle.js:1, so both
// globals exist before any desk bundle runs.
//
// **Do not re-declare jQuery here.** frappe-types should take a dependency on
// `@types/jquery` (the DefinitelyTyped package that tracks jQuery 3.x) and pull
// its global `JQuery` / `JQueryStatic` interfaces in from the package's
// `global` entrypoint with `/// <reference types="jquery" />`. A hand-rolled
// minimal interface fails immediately on things the consumer already does:
//
//   * `$(".page-container:visible")` — carbon_frappe/public/js/anatomy/editable_title.js:24.
//     `:visible` is a jQuery-only Sizzle pseudo-selector; it throws in
//     `querySelectorAll`. Also used at carbon_frappe/scripts/tables/list.mjs:216-217
//     and carbon_frappe/scripts/tables/grid.mjs:476.
//   * `$title.attr("href", null)` — editable_title.js:41. The `null` overload
//     (attribute removal) must be in the value union.
//   * `$(this.grid.form_grid).css({...})` — carbon_frappe/.../grid/grid_row.js:241,
//     the object-literal `css` overload.
//   * `JQuery` must be both `Iterable<TElement>` and `ArrayLike<TElement>`:
//     `[...$r.find('thead th')]` (list.mjs:115,127,151) and `wrapper[0]`
//     (grid.mjs:155,222,225,318,…; list.mjs:116-118,120-121,148-149,156-157,181).
//
// Everything in sections 7-9 is *additive* module augmentation on top of that
// package — the non-stock surface `@types/jquery` cannot know about.
//
// Strict-mode friction points inside stock @types/jquery, for the record:
//   * `.get(index)` is `TElement | undefined`, and
//     carbon_frappe/scripts/tables/grid.mjs:106 does
//     `row0.wrapper.get(0).tagName` with no guard.
//   * `.data(key)` is `any`; see {@link JQueryFrappeOverloads.data} for the
//     typed overloads that keep the consumer's no-`any` rule intact.

// =============================================================================
// 6b. Non-empty jQuery regions (gaps.md §5.2 / §6.12)
// =============================================================================

/**
 * A jQuery handle over a region frappe guarantees is non-empty once the owning
 * component has been built.
 *
 * WHY THIS EXISTS. Stock `@types/jquery` types `.get(index)` as
 * `TElement | undefined` and, under `noUncheckedIndexedAccess`, `$el[0]` the
 * same way — correct in general, because a selector can match nothing. But a
 * handful of frappe's handles are not selector results at all: they are built
 * from an HTML template string in the component's own `make()`, so element 0 is
 * always there. Typing those as plain `JQuery` forces a `!` or a guard at every
 * mount point (~14 of them across carbon_frappe, feeding `new CarbonTable(el)`
 * and `.classList.add(…)`, both of which throw on a non-element). That is noise
 * standing in for a fact frappe's own code already relies on.
 *
 * WHAT IT CLAIMS, AND WHAT IT DOES NOT. Only index **0** is narrowed. Every
 * other index keeps `T | undefined`, `.get()` still returns an array, and
 * `.find()` — which really can match nothing — still returns a plain `JQuery`.
 * A plain `JQuery` is NOT assignable to a `JQueryRegion`, so the guarantee
 * cannot be forged by accident; a declaration has to opt in, and only after the
 * source has been checked.
 *
 * SITES, each verified against apps/frappe @ v16.33.0 before being retyped —
 * all six are literal-template constructions or a `find()` into a template this
 * same method just inserted:
 *
 * | member | source | why non-empty |
 * | --- | --- | --- |
 * | `Grid#wrapper` | `form/grid.js:129` | `$(template).appendTo(this.parent)` |
 * | `GridRow#wrapper` | `form/grid_row.js:25` | `$('<div class="grid-row"></div>')` |
 * | `GridRow#row` | `form/grid_row.js:26` | `$('<div class="data-row row m-0"></div>').appendTo(…)` |
 * | `ListView#$result` | `list/base_list.js:342` | ``$(`<div class="result">`)`` |
 * | `ReportView#$datatable_wrapper` | `views/reports/report_view.js:86` | `$('<div class="datatable-wrapper">')` |
 * | `Page#main` | `ui/page.js:142` | `wrapper.find(".layout-main-section")`, and `make_view()` inserts that div on BOTH branches (`ui/page.js:100-120`) before `setup_page()` reads it |
 *
 * DO NOT add sites without doing that check. A `find()` whose target is not
 * emitted by the same component is a selector result, not a region.
 *
 * @example
 * ```ts
 * // was: const el = grid.wrapper.find(".x").get(0)!;
 * const root: HTMLElement = grid.wrapper[0];      // no `!`
 * const also: HTMLElement = grid.wrapper.get(0);  // no `!`
 * const maybe = grid.wrapper.find(".x").get(0);   // still HTMLElement | undefined
 * ```
 */
export interface JQueryRegion<T extends HTMLElement = HTMLElement> extends JQuery<T> {
	/** The region's own element. Always present — see this interface's TSDoc. */
	readonly 0: T;
	/** Narrowing overload for the one index the region guarantees. */
	get(index: 0): T;
	/** Every other index is a normal, possibly-missing lookup. */
	get(index: number): T | undefined;
	/** Unchanged from stock jQuery. */
	get(): T[];
}

// =============================================================================
// 7. jQuery static extensions added by frappe
// =============================================================================

/**
 * Non-stock statics frappe hangs off `jQuery` itself.
 *
 * Merge into the global `JQueryStatic` interface (see ASSEMBLY NOTES).
 */
export interface JQueryStaticFrappeExtensions {
	/**
	 * `$.format(str, args)` — positional `{0}` / `{}` interpolation.
	 *
	 * Installed at frappe/public/js/frappe/format.js:19-21
	 * (`if (jQuery) { jQuery.format = format; }`); implementation at
	 * format.js:1-17.
	 *
	 * Not called directly by carbon_frappe, but it is the whole reason
	 * `__("{0} items selected", [n])`
	 * (carbon_frappe/public/js/tables/grid/toolbar.js:219) works — `frappe._`
	 * delegates to it at translate.js:20.
	 *
	 * Behaviour worth pinning down (all from format.js):
	 * - `str == undefined` short-circuits and returns `str` unchanged
	 *   (format.js:2), so `null` in / `null` out.
	 * - Only numeric keys substitute (format.js:12, `if (key == +key)`); a named
	 *   `{key}` becomes the literal string `"undefined"`. See
	 *   {@link TranslationArgs}.
	 * - An out-of-range index leaves the placeholder text intact
	 *   (format.js:13, `args[key] !== undefined ? args[key] : match`).
	 * - It **mutates the receiver**: `this.unkeyed_index = 0` at format.js:4,
	 *   incremented at format.js:10. Called as `$.format(...)`, `this` is
	 *   `jQuery`, so `$.unkeyed_index` is real state on the jQuery object.
	 */
	format(str: string, args: TranslationArgs): string;
	format(str: undefined, args: TranslationArgs): undefined;
	format(str: null, args: TranslationArgs): null;
	format(
		str: string | null | undefined,
		args: TranslationArgs
	): string | null | undefined;

	/**
	 * Scratch counter written by {@link JQueryStaticFrappeExtensions.format}
	 * onto its `this` (format.js:4, :10). Declared because it genuinely exists
	 * on `$` after the first `$.format()` call — not because anything should
	 * read it.
	 */
	unkeyed_index?: number;
}

// =============================================================================
// 8. jQuery instance plugins — frappe
// =============================================================================

/**
 * A `<select>` option accepted by `$.fn.add_options`.
 *
 * Derived from `parse_option(v, doctype)` in
 * frappe/public/js/frappe/form/controls/select.js (the function immediately
 * after the plugin IIFE): a scalar becomes both value and label, an object
 * supplies `value` / `label` / `disabled` / `selected`, and `null`-ish entries
 * are tolerated via frappe's `is_null` check.
 */
export type SelectOptionInput =
	| string
	| number
	| null
	| {
			value?: string | number | null;
			label?: string | number | null;
			disabled?: unknown;
			selected?: unknown;
	  };

/**
 * jQuery instance methods added by frappe and by Bootstrap 4.6.2.
 *
 * **Extend-safe half.** Every member here is a name `@types/jquery` does not
 * declare, so the ambient layer can pull it in with plain inheritance:
 * `interface JQuery<TElement = HTMLElement> extends JQueryFrappePlugins<TElement> {}`.
 *
 * The overloads that *sharpen an existing* jQuery method live in
 * {@link JQueryFrappeOverloads} instead, because `extends` would shadow them
 * rather than add to them. See ASSEMBLY NOTES.
 */
export interface JQueryFrappePlugins<TElement = HTMLElement> {
	// ---------------------------------------------------------------- frappe

	/**
	 * Populate a `<select>` from a list of options.
	 *
	 * frappe/public/js/frappe/form/controls/select.js:140-142; it forwards to
	 * `frappe.ui.form.add_options(this.get(0), options_list, sort)` (defined at
	 * select.js:110-135), which returns `$(input)` — the same jQuery set, so
	 * this IS chainable.
	 *
	 * Two upstream quirks preserved in the type:
	 * - The plugin drops the 4th `doctype` parameter that
	 *   `frappe.ui.form.add_options` accepts; it is genuinely unreachable from
	 *   `$.fn.add_options`.
	 * - A non-array `options_list` is a silent no-op that still returns the set
	 *   (select.js:112-114) — hence no exception in the signature.
	 */
	add_options(options_list: SelectOptionInput[], sort?: boolean): JQuery<TElement>;

	/**
	 * Disable the matched elements. select.js:143-145.
	 *
	 * **Returns `undefined`, not `this`** — the body is a bare
	 * `this.prop("disabled", true);` with no `return`. It is the one frappe
	 * jQuery plugin that breaks the chain, so the type must not claim `this`.
	 */
	set_working(): void;

	/**
	 * Re-enable the matched elements. select.js:146-148. Also returns
	 * `undefined` — see {@link JQueryFrappePlugins.set_working}.
	 */
	done_working(): void;

	/**
	 * Bind a handler to Enter (keyCode 13) on each matched element.
	 *
	 * frappe/public/js/frappe/ui/keyboard.js:364-373. The body is
	 * `return this.each(function () { $(this).keypress(...) })`, so it is
	 * chainable, and the callback is invoked as `fnc.call(this, ev)`
	 * (keyboard.js:369) — `this` is the raw element, which is why the signature
	 * carries an explicit `this` parameter for `noImplicitThis`.
	 *
	 * Note it hooks `keypress`, which never fires for non-printing keys in some
	 * engines; that is upstream behaviour, faithfully typed here.
	 *
	 * `JQuery.KeyPressEvent` is left un-parameterised on purpose: @types/jquery
	 * parameterises its event interfaces as
	 * `<TDelegateTarget, TData, TCurrentTarget, TTarget>`, so passing a single
	 * argument would bind the *delegate* target, not the element — a
	 * plausible-looking lie. The handler reads `ev.keyCode` / `ev.which`
	 * (keyboard.js:367), both of which the fully-defaulted form provides.
	 */
	enterKey(fnc: (this: TElement, ev: JQuery.KeyPressEvent) => void): JQuery<TElement>;

	/**
	 * air-datepicker, bound as a jQuery plugin.
	 *
	 * frappe depends on `air-datepicker` (frappe/package.json:39, a git fork:
	 * `git+https://github.com/frappe/air-datepicker`) and reaches the plugin's
	 * i18n table through `$.fn.datepicker.language[...]` —
	 * frappe/public/js/frappe/form/controls/datepicker_i18n.js:18 onward and
	 * frappe/public/js/frappe/form/controls/date.js:52,
	 * frappe/public/js/frappe/form/controls/date_range.js:18.
	 *
	 * The fork's own options object is not typed by this package (it is a
	 * vendored third-party library, not desk API), so the config is an honest
	 * open record. The `language` static is declared because frappe reads and
	 * writes it directly.
	 */
	datepicker: JQueryDatepickerPlugin<TElement>;


	// ------------------------------------------------------------- bootstrap

	/**
	 * Bootstrap 4.6.2 tooltip (frappe/package.json:42; registered at
	 * node_modules/bootstrap/js/dist/tooltip.js:878,
	 * `$.fn[NAME] = Tooltip._jQueryInterface`, imported by
	 * frappe/public/js/jquery-bootstrap.js:12).
	 *
	 * Required for the base `GridRow` declaration to compile even though
	 * carbon_frappe never calls it directly: `CarbonGridRow.add_open_form_button()`
	 * (carbon_frappe/public/js/tables/grid/grid_row.js:292) calls `super`, and
	 * the upstream body ends with
	 * `this.open_form_button.tooltip({ delay: { show: 600, hide: 100 } })` —
	 * frappe/public/js/frappe/form/grid_row.js:357.
	 *
	 * `_jQueryInterface` is `return this.each(...)` (tooltip.js:808), so every
	 * form — options object or string command — returns the same jQuery set.
	 */
	tooltip(config?: BootstrapTooltipOptions | BootstrapPluginCommand): JQuery<TElement>;
	/** Bootstrap 4.6.2 popover — node_modules/bootstrap/js/dist/popover.js, same `_jQueryInterface` shape as tooltip. */
	popover(config?: BootstrapPopoverOptions | BootstrapPluginCommand): JQuery<TElement>;
	/** Bootstrap 4.6.2 modal — node_modules/bootstrap/js/dist/modal.js:652, defaults at modal.js:90-95. */
	modal(config?: BootstrapModalOptions | BootstrapPluginCommand): JQuery<TElement>;
	/** Bootstrap 4.6.2 dropdown — node_modules/bootstrap/js/dist/dropdown.js:549. */
	dropdown(config?: BootstrapDropdownOptions | BootstrapPluginCommand): JQuery<TElement>;
	/**
	 * Bootstrap 4.6.2 collapse — node_modules/bootstrap/js/dist/collapse.js:320.
	 *
	 * `boolean` is in the union because `_jQueryInterface` normalises any
	 * non-object config away (collapse.js:325,
	 * `typeof config === 'object' && config ? config : {}`), and frappe's own
	 * `Section.collapse(false)` idiom leaks the habit into desk code.
	 */
	collapse(config?: BootstrapCollapseOptions | BootstrapPluginCommand | boolean): JQuery<TElement>;
	/** Bootstrap 4.6.2 tab — node_modules/bootstrap/js/dist/tab.js; frappe calls `.tab("show")`. */
	tab(config?: BootstrapPluginCommand): JQuery<TElement>;
	/** Bootstrap 4.6.2 toast — node_modules/bootstrap/js/dist/toast.js. */
	toast(config?: BootstrapToastOptions | BootstrapPluginCommand): JQuery<TElement>;
	/** Bootstrap 4.6.2 alert — node_modules/bootstrap/js/dist/alert.js. */
	alert(config?: BootstrapPluginCommand): JQuery<TElement>;
	/** Bootstrap 4.6.2 button — node_modules/bootstrap/js/dist/button.js. */
	button(config?: BootstrapPluginCommand): JQuery<TElement>;
	/** Bootstrap 4.6.2 carousel — node_modules/bootstrap/js/dist/carousel.js. */
	carousel(config?: BootstrapCarouselOptions | BootstrapPluginCommand | number): JQuery<TElement>;
	/** Bootstrap 4.6.2 scrollspy — node_modules/bootstrap/js/dist/scrollspy.js. */
	scrollspy(config?: BootstrapScrollSpyOptions | BootstrapPluginCommand): JQuery<TElement>;
}

/**
 * Overloads that SHARPEN methods `@types/jquery` already declares.
 *
 * **Merge-only.** These must be added by re-declaring them inside
 * `declare global { interface JQuery<TElement = HTMLElement> { … } }`, NOT by
 * `extends`: an `extends` clause makes the derived interface's own `data` /
 * `html` members *replace* these rather than join them as extra overloads, and
 * @types/jquery's `data(key: string): any` is assignable to anything, so the
 * shadowing happens silently with no compiler error and the consumer is back to
 * `any`.
 *
 * Declaration merging is what we want here for a second reason: the TypeScript
 * handbook's rule is that when interfaces merge, "later overload sets are
 * ordered first" — so a merged block re-declaring these wins resolution over
 * @types/jquery's broader signatures. See ASSEMBLY NOTES step 2.
 */
export interface JQueryFrappeOverloads {
	/**
	 * Typed reads of the `data-` store frappe writes on grid rows.
	 *
	 * `GridRow.set_data()` writes both keys in one object call —
	 * frappe/public/js/frappe/form/grid_row.js:67-72:
	 * ```js
	 * this.wrapper.data({ grid_row: this, doc: this.doc || "" });
	 * ```
	 * (the object-form setter is stock `@types/jquery`, so only the *reads*
	 * need overloads).
	 *
	 * Readers, all of which would otherwise be `any`:
	 * frappe/public/js/frappe/form/grid.js:8 and
	 * frappe/public/js/frappe/form/layout.js:712
	 * (`$(".grid-row-open").data("grid_row")`), grid.js:1068 and :1075
	 * (`.find("[data-idx='" + idx + "']").data("grid_row")`),
	 * frappe/public/js/frappe/ui/keyboard.js:335. carbon_frappe mirrors the
	 * idiom at carbon_frappe/scripts/tables/grid.mjs:261.
	 *
	 * `| undefined` is real: `$(".grid-row-open")` is an empty set whenever no
	 * row form is open, and jQuery's `.data()` on an empty set is `undefined` —
	 * which is exactly why `frappe.ui.form.close_grid_form` guards with
	 * `open_form && open_form.hide_form()` (grid.js:12-13).
	 *
	 * The `doc` key is `FrappeDoc | ""` because grid_row.js:70 stores
	 * `this.doc || ""`.
	 */
	data(key: "grid_row"): GridRow | undefined;
	data(key: "doc"): FrappeDoc | "" | undefined;

	/**
	 * `.html()` with a numeric argument.
	 *
	 * `@types/jquery` types the setter as `html(htmlString: JQuery.htmlString)`
	 * where `htmlString = string`, but jQuery 3.7.0 routes a non-string through
	 * `this.empty().append(value)`, and `append` text-nodes it via
	 * `createTextNode(String(value))`. frappe itself relies on this:
	 * frappe/public/js/frappe/form/grid_row.js:75-79 does
	 * `.find(".row-index span, .grid-form-row-index").html(this.doc.idx)` with
	 * `idx` a number. carbon_frappe reproduces it at
	 * carbon_frappe/public/js/tables/grid/grid_row.js:123.
	 *
	 * Declared rather than fixed in the consumer because the *frappe* contract
	 * being re-implemented is "pass idx straight through"; changing the
	 * consumer to `String(idx)` would be fine too, but the base class this
	 * subclass calls `super` into still does it the numeric way.
	 */
	html(value: number): this;
}

/**
 * The `$.fn.datepicker` callable + its `language` registry.
 * See {@link JQueryFrappePlugins.datepicker}.
 */
export interface JQueryDatepickerPlugin<TElement = HTMLElement> {
	(options?: Record<string, unknown> | string): JQuery<TElement>;
	/**
	 * Locale table. frappe writes entries into it directly —
	 * frappe/public/js/frappe/form/controls/datepicker_i18n.js:18, :59, :100,
	 * :141, :182, :223, :264, :305, :346, :387 — and probes it before use at
	 * frappe/public/js/frappe/form/controls/date.js:52 and
	 * frappe/public/js/frappe/form/controls/date_range.js:18
	 * (`$.fn.datepicker.language[lang] ? lang : "en"`).
	 *
	 * The value shape is air-datepicker's locale object (`days`, `months`,
	 * `dateFormat`, `firstDay`, …); left as an open record because the vendored
	 * fork is not version-tracked by this package.
	 */
	language: Record<string, Record<string, unknown> | undefined>;
}

// =============================================================================
// 9. Bootstrap 4.6.2 plugin option shapes
// =============================================================================

/**
 * The string form every Bootstrap 4 jQuery plugin accepts — a method name to
 * invoke on the already-constructed instance (`data[config]()`, e.g.
 * node_modules/bootstrap/js/dist/tooltip.js:808-830).
 *
 * Typed as an open `string` rather than a union of method names because the
 * interface throws `TypeError: No method named "x"` at runtime for anything
 * unknown (tooltip.js, collapse.js:337-339) and frappe uses at least
 * `"show" | "hide" | "toggle" | "dispose" | "disable"` across the codebase.
 */
export type BootstrapPluginCommand = string;

/** node_modules/bootstrap/js/dist/tooltip.js:205-242 (`Default` / `DefaultType`). */
export interface BootstrapTooltipOptions {
	animation?: boolean;
	template?: string;
	title?: string | Element | ((this: Element) => string);
	trigger?: string;
	/** `'(number|object)'` — tooltip.js:229. frappe passes `{ show: 600, hide: 100 }` at grid_row.js:357. */
	delay?: number | { show?: number; hide?: number };
	html?: boolean;
	selector?: string | false;
	placement?: string | ((this: Element, tip: Element, trigger: Element) => string);
	offset?: number | string | ((...args: unknown[]) => unknown);
	container?: string | Element | false;
	fallbackPlacement?: string | string[];
	boundary?: string | Element;
	customClass?: string | ((this: Element) => string);
	sanitize?: boolean;
	sanitizeFn?: ((html: string) => string) | null;
	whiteList?: Record<string, unknown>;
	popperConfig?: Record<string, unknown> | null;
}

/** Popover extends Tooltip's Default (node_modules/bootstrap/js/dist/popover.js). */
export interface BootstrapPopoverOptions extends BootstrapTooltipOptions {
	content?: string | Element | ((this: Element) => string);
}

/** node_modules/bootstrap/js/dist/modal.js:90-101 (`Default` / `DefaultType`). */
export interface BootstrapModalOptions {
	/** `'(boolean|string)'` — modal.js:97; `"static"` is the non-dismissing backdrop. */
	backdrop?: boolean | "static";
	keyboard?: boolean;
	focus?: boolean;
	show?: boolean;
}

/** node_modules/bootstrap/js/dist/dropdown.js `Default`. */
export interface BootstrapDropdownOptions {
	offset?: number | string | ((...args: unknown[]) => unknown);
	flip?: boolean;
	boundary?: string | Element;
	reference?: string | Element;
	display?: "dynamic" | "static";
	popperConfig?: Record<string, unknown> | null;
}

/** node_modules/bootstrap/js/dist/collapse.js `Default`. */
export interface BootstrapCollapseOptions {
	toggle?: boolean;
	parent?: string | Element | false;
}

/** node_modules/bootstrap/js/dist/toast.js `Default`. */
export interface BootstrapToastOptions {
	animation?: boolean;
	autohide?: boolean;
	delay?: number;
}

/** node_modules/bootstrap/js/dist/carousel.js `Default`. */
export interface BootstrapCarouselOptions {
	interval?: number | false;
	keyboard?: boolean;
	slide?: boolean | "next" | "prev";
	pause?: "hover" | false;
	wrap?: boolean;
	touch?: boolean;
}

/** node_modules/bootstrap/js/dist/scrollspy.js `Default`. */
export interface BootstrapScrollSpyOptions {
	offset?: number;
	method?: "auto" | "offset" | "position";
	target?: string | Element;
}

// =============================================================================
// 10. Custom jQuery event names
// =============================================================================

/**
 * Event names that exist ONLY inside jQuery's event system — no DOM
 * `Event`/`CustomEvent` equivalent, so `addEventListener` will never see them
 * and `dispatchEvent` will never trigger their handlers.
 *
 * Verified triggers/listeners in frappe v16.33.0:
 *
 * - `"show.bs.dropdown"` — Bootstrap 4 namespaced event
 *   (node_modules/bootstrap/js/dist/dropdown.js:86, `EVENT_SHOW`). frappe fires
 *   it by hand when the sidebar bell opens the notification panel:
 *   frappe/public/js/frappe/ui/sidebar/sidebar.js:527-531. The listener that
 *   refreshes the counts is
 *   frappe/public/js/frappe/ui/notifications/notifications.js:454.
 *   carbon_frappe re-fires it after re-homing the panel —
 *   carbon_frappe/public/js/anatomy/ui_shell.js:121-124.
 * - `"escape"` — frappe-only. Triggered on `document` by the global Esc handler
 *   at frappe/public/js/frappe/ui/keyboard.js:328
 *   (`$(document).trigger("escape");`, inside `handle_escape_key()`), listened
 *   for at frappe/public/js/frappe/form/grid_row.js:365 so the open-form button
 *   regains focus. carbon_frappe's `menu_node()` keeps a real element under
 *   that focus call — carbon_frappe/public/js/tables/grid/grid_row.js:153-155.
 * - `"select-change"` — fired by the *patched* `$.fn.val` setter and by
 *   `frappe.ui.form.add_options`; see {@link JQueryValPatchNote}.
 * - `"page-change"` — frappe/public/js/frappe/views/container.js:19.
 * - `"rename"` — bound with extra args `(event, dt, old_name, new_name)` at
 *   frappe/public/js/frappe/views/container.js:26.
 * - `"frappe.ui.Dialog:shown"` — frappe/public/js/frappe/ui/dialog.js:130.
 */
export type FrappeCustomJQueryEvent =
	| "show.bs.dropdown"
	| "escape"
	| "select-change"
	| "page-change"
	| "rename"
	| "frappe.ui.Dialog:shown";

/**
 * **`$.fn.val` is monkey-patched by frappe.**
 *
 * frappe/public/js/frappe/form/controls/select.js:150-155:
 * ```js
 * let original_val = $.fn.val;
 * $.fn.val = function () {
 *   let result = original_val.apply(this, arguments);
 *   if (arguments.length > 0) $(this).trigger("select-change");
 *   return result;
 * };
 * ```
 *
 * The signature is unchanged — which is why there is no `val` override in
 * {@link JQueryFrappePlugins} — but the *behaviour* is not: calling `.val(x)`
 * on ANY element, not just a `<select>`, synchronously fires a `select-change`
 * jQuery event on it. Anything that patches or replaces a frappe control and
 * sets values through jQuery inherits that side effect.
 *
 * This type carries no members; it exists so the note has a stable anchor.
 */
export interface JQueryValPatchNote {
	readonly __brand: "frappe patches $.fn.val — see doc comment";
}

// =============================================================================
// 11. Window shape
// =============================================================================

/**
 * Test-harness scratch globals.
 *
 * carbon_frappe's Chrome-DevTools harness passes function *bodies as strings*
 * to `Runtime.evaluate`, so these are invisible to tsc today; they are declared
 * for the planned move to typed function serialisation
 * (carbon_frappe/tsconfig.scripts.json's rationale block says as much).
 *
 * - `__before` — carbon_frappe/scripts/tables/grid.mjs:20, read back at :28.
 * - `__formRow` — grid.mjs:216. Write-only in the current harness; nothing ever
 *   reads it back, so the declared type only has to accept a `GridRow`
 *   subclass instance.
 * - `__freezeBefore` — grid.mjs:217, compared against `frappe.dom.freeze_count`
 *   at grid.mjs:240 and :303.
 * - `__probe` — carbon_frappe/scripts/tables/query-report.mjs:36, mutated from
 *   inside report-settings hooks (:40, :44, :50, :58, :64) and read at :96 and
 *   :124. `hasRowmanager` / `hasDatamanager` are added late (:65-66), hence
 *   optional.
 */
export interface HarnessWindowGlobals {
	__before?: number;
	__formRow?: GridRow;
	__freezeBefore?: number;
	__probe?: HarnessProbe;
}

/** The counter bag written at carbon_frappe/scripts/tables/query-report.mjs:36. */
export interface HarnessProbe {
	formatter: number;
	getOpts: number;
	afterRender: number;
	editor: number;
	/**
	 * Whatever the last `editor.setValue(value, rowIndex, column)` received.
	 *
	 * The inventory guessed `string | null`, but the value originates from a
	 * user-supplied `editor.getValue()` promise
	 * (carbon_frappe/public/js/tables/datatable/editing.js:127-135) and the
	 * built-in editor is the only one that guarantees a string
	 * (editing.js:97-99). A custom `getEditor` can return anything, so
	 * `unknown` is the honest type; the harness only JSON-stringifies it.
	 */
	setValueSeen: unknown;
	hasRowmanager?: boolean;
	hasDatamanager?: boolean;
}

/**
 * The `window` additions this group is responsible for.
 *
 * Deliberately all-optional: carbon_frappe runs in three environments and only
 * the first has a desk.
 *
 * 1. A frappe desk page — everything present.
 * 2. carbon_frappe's own fixture page (carbon_frappe/scripts/dev-table.mjs
 *    serves it, dev/table-demo.js is the entry) — "no frappe global, no jQuery,
 *    no desk bundle. That is the point" (dev/table-demo.js:2-4). This is why
 *    carbon_frappe/public/js/tables/datatable/managers.js:35 reads
 *    `typeof window !== "undefined" && window.$` and falls back to a plain
 *    array.
 * 3. Node, in the build/harness scripts — no `window` at all.
 *
 * `jQuery` is optional for the same reason carbon_frappe guards it at
 * carbon_frappe/public/js/anatomy/ui_shell.js:122
 * (`if (!panel.classList.contains("hidden") && window.jQuery)`), even though on
 * a real desk page frappe/public/js/jquery-bootstrap.js:15-16 always sets both.
 */
export interface DeskWindow extends DeskTemplateGlobals, HarnessWindowGlobals {
	/** jquery-bootstrap.js:16 — `window.$ = jQuery;` */
	$?: JQueryStatic;
	/** jquery-bootstrap.js:15 — `window.jQuery = jQuery;` */
	jQuery?: JQueryStatic;
	/** translate.js:26 — `window.__ = frappe._;` */
	__?: TranslateFunction;
	/** provide.js:21 — `frappe.provide("locals")`. */
	locals?: LocalsStore;
	/** provide.js:50 / form.js:406 / pageview.js:106. */
	cur_frm?: CurrentForm;
	/** list_factory.js:6, :93, :96. */
	cur_list?: CurrentListView;
	/** dialog.js:6, :115-119, :127. */
	cur_dialog?: CurrentDialog;
	/** container.js:8, :43. */
	cur_page?: CurrentPageContainer;
	/** erpnext/public/js/conf.js:4 — only present when the ERPNext bundle loaded. */
	erpnext?: ErpNextGlobal;
}

/**
 * The bare identifiers a desk script may reference without a `window.` prefix.
 *
 * Split from {@link DeskWindow} because the two are NOT interchangeable: a bare
 * identifier throws `ReferenceError` when absent, whereas `window.x` is
 * `undefined`. carbon_frappe exploits exactly that distinction at
 * carbon_frappe/public/js/anatomy/ui_shell.js:122-124 — it *guards* on
 * `window.jQuery` and then *calls* the bare `jQuery`.
 *
 * These are declared non-optional because every one of them is assigned during
 * desk boot before any app bundle runs:
 *   - `$` / `jQuery` — jquery-bootstrap.js:15-16, the first import of
 *     libs.bundle.js:1.
 *   - `__` — translate.js:26.
 *   - `locals` — provide.js:21.
 *   - `cur_frm` — provide.js:50 (as `null`).
 *   - `cur_list` — list_factory.js:6 (as `null`).
 *   - `cur_dialog` — dialog.js:6 (as `null`).
 *   - `cur_page` — container.js:8 (as `null`).
 *
 * `erpnext` and `dev_server` are NOT here: `erpnext` only exists once the
 * ERPNext bundle runs `frappe.provide("erpnext")` (conf.js:4), and `dev_server`
 * is emitted by the desk template (desk.html:50), not by a bundle — reach both
 * through {@link DeskWindow}.
 */
export interface DeskGlobals {
	$: JQueryStatic;
	jQuery: JQueryStatic;
	__: TranslateFunction;
	locals: LocalsStore;
	cur_frm: CurrentForm;
	cur_list: CurrentListView;
	cur_dialog: CurrentDialog;
	cur_page: CurrentPageContainer;
}

// =============================================================================
// 12. Browser (lib.dom) contracts the consumer leans on
// =============================================================================
//
// Everything in this section is STOCK `lib.dom` — nothing is re-declared,
// because re-declaring a lib type is how a typeset starts lying. What follows
// is the maintenance record of which lib APIs the consumer depends on, and
// which of them are strict-mode hazards.
//
// Required tsconfig `lib`: ["ES2022", "DOM", "DOM.Iterable"] — already set in
// carbon_frappe/tsconfig.json and carbon_frappe/tsconfig.scripts.json. DOM.Iterable
// is not optional: `[...$r.find('thead th')]` and
// `document.querySelectorAll(...)` spreads need it.
//
//   Window.isSecureContext            boolean (readonly)
//     carbon_frappe/public/js/tables/datatable/navigation.js:378 — gate before
//     the async clipboard API.
//
//   Navigator.clipboard.writeText     (data: string) => Promise<void>
//     navigation.js:377-385. HAZARD: lib.dom types `Navigator.clipboard` as
//     always present, so `if (navigator.clipboard && window.isSecureContext)`
//     reads as an always-true condition. The runtime check is correct (Firefox
//     ESR and any insecure origin lack it), so the fix is a
//     `"clipboard" in navigator` narrowing in the consumer, NOT a relaxed
//     re-declaration of Navigator here. Also note navigation.js:381 does not
//     trust the return to be a Promise — it duck-types `.catch` — which
//     type-checks fine against `Promise<void>`.
//
//   Document.execCommand              (commandId, showUI?, value?) => boolean
//     navigation.js:363-374, the copy fallback. Present in lib.dom, marked
//     `@deprecated`. A `@deprecated`-as-error lint config will trip on it.
//
//   Storage.setItem                   (key: string, value: string) => void
//     carbon_frappe/public/js/tables/datatable/datatable.js:584-593. NOTE the
//     stored payload under `…::sortedColumns` is TanStack's `SortingState`
//     (`{ id: string; desc: boolean }[]`), NOT frappe-datatable's legacy
//     `{ colIndex, sortOrder }[]`. Anything reading that key back expecting the
//     old shape is wrong; see the `frappe-datatable` group.
//
//   HTMLStyleElement.sheet            CSSStyleSheet | null
//     carbon_frappe/public/js/tables/datatable/managers.js:501, :566-568.
//     Reachable only via the tag-name overload
//     `document.createElement("style")`; the generic
//     `createElement(tag: string)` returns `HTMLElement`, which has no `.sheet`.
//
//   Document.getElementById           (id: string) => HTMLElement | null
//     dev/table-demo.js:50, against the `<div id="host">` emitted by
//     carbon_frappe/scripts/dev-table.mjs:74. HAZARD: `CarbonTable`'s
//     constructor throws on a non-HTMLElement
//     (carbon_frappe/public/js/tables/engine/table.js:76-79), so the `| null`
//     must be handled at the call site.
//
//   Location.search / URLSearchParams  string / (init: string) => …
//     dev/table-demo.js:52; the driver supplies `?rows=500` at
//     carbon_frappe/scripts/tables/engine.mjs:50. `.get(name)` is
//     `string | null`.
//
//   Node.DOCUMENT_POSITION_FOLLOWING / Node.compareDocumentPosition
//     carbon_frappe/scripts/tables/grid.mjs:430 — asserts the Carbon batch bar
//     precedes the toolbar content in document order.
//
//   Performance.now                   () => number
//     carbon_frappe/scripts/tables/engine.mjs:202, :205 (the 50k-row budget).
//
//   Document.elementFromPoint         (x: number, y: number) => Element | null
//     carbon_frappe/scripts/tables/grid.mjs:163 and
//     carbon_frappe/scripts/tables/report.mjs:396-399 (the frozen-column bleed
//     hit-test). Both already null-guard.
//
//   Event / MouseEvent / KeyboardEvent constructors
//     `new Event('input', { bubbles: true })` — cdp.mjs:294-295, engine.mjs:126,
//     :141, :168. `new MouseEvent(type, { bubbles, buttons })` — grid.mjs:165,
//     query-report.mjs:119, report.mjs:114, :118, :288-289, :292, :314, :318,
//     :321. `new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })` —
//     query-report.mjs:123. All stock; `MouseEventInit.buttons` and
//     `KeyboardEventInit.key` are both in lib.dom.

/**
 * Narrowing helper contract for delegated event handlers.
 *
 * `Event.target` is `EventTarget | null` in lib.dom, and `EventTarget` has
 * neither `classList` nor `closest`. carbon_frappe currently duck-types its way
 * around that in five places:
 *
 * - carbon_frappe/public/js/tables/datatable/datatable.js:453-458 —
 *   `const input = e.target; if (!input.classList || !input.classList.contains("dt-checkbox")) return;`
 *   then `input.closest(".dt-cell")` and `!!input.closest(".dt-row-header")`.
 * - carbon_frappe/public/js/tables/datatable/editing.js:164, :173 —
 *   `const td = e.target.closest && e.target.closest(".dt-cell");`
 * - carbon_frappe/public/js/tables/datatable/navigation.js:231, :262 — same.
 *
 * Under `strict` with no `as any`, those need a real narrowing step. This type
 * is the contract for it; frappe-types does not ship the implementation
 * (a `.d.ts` must not declare a function that has no runtime), so the consumer
 * writes the one-liner:
 *
 * ```ts
 * const asElement: AsElement = (t) => (t instanceof Element ? t : null);
 * ```
 *
 * `instanceof Element` is the right guard rather than `"closest" in t`: it also
 * excludes `Document` and `Window`, both of which are legitimate `e.target`
 * values on a delegated `document`-level listener.
 */
export type AsElement = (target: EventTarget | null) => Element | null;

/**
 * The `$of()` return contract from
 * carbon_frappe/public/js/tables/datatable/managers.js:34-38.
 *
 * ```js
 * export function $of(node) {
 *   const jq = typeof window !== "undefined" && window.$;
 *   if (!jq) return node ? [node] : [];
 *   return node ? jq(node) : jq();
 * }
 * ```
 *
 * The jQuery-less fallback makes this a genuine union, and it propagates to the
 * three public accessors frappe and ERPNext call:
 * `RowManagerShim.getRow$` (managers.js:258-261),
 * `ColumnManagerShim.getHeaderCell$` (managers.js:337-340) and
 * `CellManagerShim.getCell$` (managers.js:437-443).
 *
 * `jq()` with zero arguments (the empty-set branch) is stock — `@types/jquery`
 * has a `(): JQuery<TElement>` call signature on `JQueryStatic`.
 *
 * Consumers that must call jQuery methods on the result have to narrow first;
 * `Array.isArray()` is the cheap discriminator, since `JQuery` is array-*like*
 * but never a real `Array`.
 */
export type MaybeJQuery<TElement extends Element = Element> = JQuery<TElement> | TElement[];

// =============================================================================
// ASSEMBLY NOTES (for the package author)
// =============================================================================
//
// 1. Add `@types/jquery` as a **dependency** (not devDependency) of
//    frappe-types, and reference it from the `global` entrypoint:
//
//        /// <reference types="jquery" />
//
//    carbon_frappe/tsconfig.json sets `"types": ["frappe-types/global"]`, which
//    disables automatic @types discovery — so without that triple-slash
//    reference the global `JQuery`/`JQueryStatic` interfaces never load and
//    every declaration in this file that mentions them fails.
//
// 2. Merge sections 7-8 into the ambient jQuery interfaces. The two halves are
//    assembled DIFFERENTLY, and the difference is not cosmetic:
//
//        import type {
//          JQueryStaticFrappeExtensions,
//          JQueryFrappePlugins,
//        } from "./globals";
//        import type { GridRow } from "./deep-modules";
//        import type { FrappeDoc } from "./model";
//
//        declare global {
//          // (a) NEW names -> `extends` is fine.
//          interface JQueryStatic extends JQueryStaticFrappeExtensions {}
//          interface JQuery<TElement = HTMLElement>
//            extends JQueryFrappePlugins<TElement> {}
//
//          // (b) SHARPENED existing names -> must be declaration-merged, i.e.
//          //     written out as members of `JQuery` itself. `JQueryFrappeOverloads`
//          //     is the spec for this block, not something to `extends`.
//          interface JQuery<TElement = HTMLElement> {
//            data(key: "grid_row"): GridRow | undefined;
//            data(key: "doc"): FrappeDoc | "" | undefined;
//            html(value: number): this;
//          }
//        }
//
//    Why (b) cannot use `extends`: when a derived interface declares a member
//    the base also declares, the derived member REPLACES it — overloads do not
//    accumulate across an inheritance edge. @types/jquery's
//    `data(key: string): any` returns `any`, which is assignable to
//    `GridRow | undefined`, so the shadowing passes the assignability check
//    silently and the consumer is back to `any` with no error to warn them.
//    Declaration merging instead APPENDS, and per the TypeScript handbook
//    later-declared overload sets are ordered first — so the `"grid_row"`
//    literal overload is tried before @types/jquery's `string` one.
//
//    Both `JQuery` re-declarations must repeat the type parameter list exactly
//    (`<TElement = HTMLElement>`); TypeScript rejects merged generic
//    declarations whose type parameters differ.
//
// 3. Merge section 11 into `Window` and the ambient scope:
//
//        declare global {
//          interface Window extends DeskWindow {}
//          const $: JQueryStatic;
//          const jQuery: JQueryStatic;
//          const __: TranslateFunction;
//          const locals: LocalsStore;
//          // `cur_*` are `let`, not `const` — frappe reassigns them
//          // (form.js:406, list_factory.js:93, container.js:43) and app code
//          // is expected to be able to as well.
//          let cur_frm: CurrentForm;
//          let cur_list: CurrentListView;
//          let cur_dialog: CurrentDialog;
//          let cur_page: CurrentPageContainer;
//        }
//
//    Keep `DeskWindow`'s members optional even though `DeskGlobals`' are not —
//    see the doc comments on both for why that asymmetry is deliberate.
//
// 4. `erpnext` should NOT go into the ambient bare-identifier scope from this
//    package. It belongs to ERPNext, whose version is tracked separately
//    (v16.32.1 here vs frappe v16.33.0). Expose it only as
//    `Window["erpnext"]`, as done above.

/// <reference types="jquery" />
/// <reference path="./modules.d.ts" />

/**
 * frappe-types — the package's **ambient** entry point.
 *
 * ```jsonc
 * // tsconfig.json
 * { "compilerOptions": { "types": ["frappe-types/global"] } }
 * ```
 *
 * Importing nothing, a desk script then gets `frappe`, `__`, `locals`,
 * `cur_frm`, `cur_list`, `cur_dialog`, `cur_page` and `erpnext` as real, typed
 * identifiers, plus the `Window` members the desk template and desk bundles
 * install.
 *
 * ## The two `/// <reference>`s above are load-bearing
 *
 * 1. **`types="jquery"`.** Frappe ships jQuery 3.7 (`frappe/package.json`) and
 *    hundreds of declarations in this package are typed as `JQuery`,
 *    `JQueryStatic` or `JQueryXHR`. A consumer that writes
 *    `"types": ["frappe-types/global"]` has an *explicit allowlist*, which
 *    excludes `@types/jquery` even though it is installed — the first real
 *    consumer took **175 × `TS2304 Cannot find name 'JQuery'`** plus
 *    3 × `TS2503 Cannot find namespace 'JQuery'` from exactly that. This
 *    reference pulls `@types/jquery` (a hard dependency of this package) in
 *    behind the single `types` entry, so no second entry is needed — and it is
 *    what makes the bare `$` / `jQuery` globals available, which is why they
 *    are not redeclared below.
 * 2. **`path="./modules.d.ts"`.** `modules.d.ts` holds the ambient
 *    `declare module "frappe/public/js/frappe/form/grid"` wiring for the deep
 *    ES-module specifiers carbon-style apps import. **Nothing imports that
 *    file** — an ambient module declaration cannot be imported — so without
 *    this reference it is never loaded into the program and every deep import
 *    is `TS2307`. Keep `modules.d.ts` a SCRIPT (no top-level `import`/`export`);
 *    read its header for what breaks if that changes.
 *
 * ## `window.frappe` is OPTIONAL; the bare `frappe` is NOT
 *
 * That asymmetry is deliberate and is the single most important ergonomic
 * decision in this file. Desk code is written as
 *
 * ```js
 * if (window.frappe && frappe.utils && frappe.utils.icon) { … }
 * ```
 *
 * because `frappe.provide()` grows the namespaces lazily and the same bundles
 * are loaded on non-desk fixture pages. Two facts make that idiom check cleanly
 * only with this split:
 *
 * - A bare identifier that does not exist throws `ReferenceError`, whereas
 *   `window.x` is merely `undefined`. `window.frappe` is therefore the
 *   *guardable* spelling, and typing it optional is what makes the guard
 *   meaningful rather than dead code that `strictNullChecks` flags.
 * - Once past the guard, the code dereferences the BARE identifier. If that
 *   were also optional, every post-guard `frappe.x` would need a second
 *   non-null assertion — the guard on `window.frappe` does not narrow the
 *   separate `var frappe` symbol.
 *
 * So: guard with `window.frappe`, then use `frappe`. Both resolve to one
 * {@link Frappe} type.
 *
 * Verified against **frappe v16.33.0**.
 *
 * @packageDocumentation
 */

import type { Frappe } from "./index";
import type { FrappeArrayPolyfills } from "./core";
import type { DataTableConstructor } from "./datatable";
import type {
	CurrentDialog,
	CurrentForm,
	CurrentPageContainer,
	DeskWindow,
	ErpNextGlobal,
	JQueryFrappePlugins,
	JQueryStaticFrappeExtensions,
	LocalsStore,
	TranslateFunction,
} from "./globals";
import type { FrappeDoc } from "./model";
import type { GridRow } from "./deep-modules";
import type { CurrentListView } from "./views";

declare global {
	// -----------------------------------------------------------------------
	// Bare identifiers
	//
	// `$` and `jQuery` are NOT declared here: `@types/jquery`, referenced at the
	// top of this file, already declares them, and a second `var` would be a
	// duplicate-identifier error. Everything below is assigned during desk boot
	// before any app bundle runs, which is why none of them is optional — see
	// `DeskGlobals` in `globals.d.ts` for the per-symbol citations.
	// -----------------------------------------------------------------------

	/**
	 * The desk API root.
	 *
	 * `frappe/www/desk.html:52` and `frappe/public/js/frappe/provide.js:5` both
	 * do `if (!window.frappe) window.frappe = {}`, so the object exists before
	 * any bundle runs; its *members* arrive lazily via `frappe.provide()`.
	 *
	 * Non-optional on purpose — guard with `window.frappe` instead. See the
	 * file header.
	 */
	var frappe: Frappe;

	/** `frappe/public/js/frappe/translate.js:26` — `window.__ = frappe._;` */
	var __: TranslateFunction;

	/** `frappe/public/js/frappe/ui/messages.js:317` — `window.msgprint = frappe.msgprint`. */
	var msgprint: Frappe["msgprint"];

	/** `frappe/public/js/frappe/provide.js:21` — `frappe.provide("locals")`. */
	var locals: LocalsStore;

	/** `provide.js:50` (as `null`), then `form.js:406` / `pageview.js:106`. */
	var cur_frm: CurrentForm;

	/** `list_factory.js:6` (as `null`), `:93`, `:96`. Holds a `ReportView` on `/view/report`. */
	var cur_list: CurrentListView;

	/** `ui/dialog.js:6` (as `null`), `:115-119`, `:127` — the top of the modal stack. */
	var cur_dialog: CurrentDialog;

	/**
	 * `views/container.js:8` (as `null`), `:43`. Despite the name it holds the
	 * `frappe.views.Container` singleton, never a page.
	 */
	var cur_page: CurrentPageContainer;

	/**
	 * ERPNext's namespace root — `erpnext/public/js/conf.js:4`,
	 * `frappe.provide("erpnext")`.
	 *
	 * **Only exists once the ERPNext bundle has run.** It is declared as a bare
	 * global because that is how ERPNext client scripts reference it, but on a
	 * bare frappe site the identifier is genuinely absent and reading it throws
	 * `ReferenceError`. Guard with the optional `window.erpnext` first — that
	 * spelling is `undefined` rather than a throw. Its members are
	 * `readonly [namespace: string]: unknown`; frappe-types does not model
	 * ERPNext.
	 */
	var erpnext: ErpNextGlobal;

	/**
	 * frappe-datatable's constructor, published at module scope by both report
	 * bundles — `views/reports/report_view.js:6` and
	 * `views/reports/query_report.js:6`, each `window.DataTable = DataTable`.
	 *
	 * Non-optional deliberately: those assignments are unconditional and run at
	 * bundle evaluation, so on any page where the symbol is reachable it is
	 * present. Typing it `DataTable?: …` would make the routine replacement
	 * `window.DataTable = MyDataTable` a `TS2412` under
	 * `exactOptionalPropertyTypes` and force the consumer into a cast.
	 */
	var DataTable: DataTableConstructor;

	// -- provide.js:41-44 constants -----------------------------------------
	/** `frappe/public/js/frappe/provide.js:41` — `"\n"`. */
	var NEWLINE: string;
	/** `provide.js:42` — `9`. */
	var TAB: number;
	/** `provide.js:43` — `38`. */
	var UP_ARROW: number;
	/** `provide.js:44` — `40`. */
	var DOWN_ARROW: number;

	// -----------------------------------------------------------------------
	// window
	// -----------------------------------------------------------------------

	/**
	 * Everything the desk template and the desk bundles hang off `window`.
	 *
	 * `DeskWindow` (globals.d.ts) supplies `$`, `jQuery`, `__`, `locals`,
	 * `cur_frm`, `cur_list`, `cur_dialog`, `cur_page`, `erpnext`,
	 * `_version_number`, `app`, `dev_server`, `socketio_port` and
	 * `show_language_picker` — all optional, because the same bundles run on
	 * fixture pages with no desk.
	 */
	interface Window extends DeskWindow {
		/**
		 * The guardable spelling of the desk root — OPTIONAL, unlike the bare
		 * `frappe`. See the file header for why the asymmetry is deliberate.
		 */
		frappe?: Frappe;

		/** `ui/messages.js:317`. Optional for the same headless reason as `__`. */
		msgprint?: Frappe["msgprint"];

		/** See the bare `DataTable` above — non-optional so it can be reassigned. */
		DataTable: DataTableConstructor;

		/**
		 * `frappe/public/js/frappe/request.js:96` — probed to decide whether to
		 * absolutise the API URL. Never set by frappe itself.
		 */
		cordova?: unknown;
	}

	// -----------------------------------------------------------------------
	// Prototype extensions frappe installs
	// -----------------------------------------------------------------------

	/**
	 * `frappe/public/js/frappe/utils/utils.js:12-26`. Both are installed inside
	 * a single `if (!Array.prototype.uniqBy)` guard, so `move` exists if and
	 * only if `uniqBy` does. `move` returns `undefined` — see
	 * {@link FrappeArrayPolyfills}.
	 */
	interface Array<T> extends FrappeArrayPolyfills<T> {}

	/**
	 * `$.format` and its `unkeyed_index` scratch counter —
	 * `frappe/public/js/frappe/format.js:19-21`.
	 */
	interface JQueryStatic extends JQueryStaticFrappeExtensions {}

	/**
	 * frappe's own jQuery plugins (`add_options`, `set_working`, `done_working`,
	 * `enterKey`, `datepicker`) and the Bootstrap 4 plugin surface the desk
	 * bundles load — `frappe/public/js/jquery-bootstrap.js`. `Dialog#show`
	 * (`ui/dialog.js:297`) calls `.modal("show")` on a plain jQuery handle, so
	 * without this the package's own declarations would not type-check at their
	 * call sites.
	 */
	interface JQuery<TElement = HTMLElement> extends JQueryFrappePlugins<TElement> {}

	/**
	 * The wiring for {@link JQueryFrappeOverloads} — narrowing overloads on
	 * members `@types/jquery` already declares.
	 *
	 * These three signatures are restated here rather than inherited because
	 * `extends` requires the derived member to be ASSIGNABLE to the base one,
	 * and an overload that narrows `data(key: string): any` to
	 * `data(key: "grid_row"): GridRow | undefined` is not
	 * (`TS2430: 'html' … Type 'number' is not assignable to 'string | Node | …'`).
	 * Interface MERGING has no such rule, and puts the later declaration's
	 * overloads first in resolution order — which is exactly the behaviour
	 * wanted. `JQueryFrappeOverloads` remains the exported, fully documented
	 * declaration (globals.d.ts); this block is only how it is applied. Keep
	 * the two in step.
	 */
	interface JQuery<TElement = HTMLElement> {
		/** `grid_row.js:67-72` — `this.wrapper.data({ grid_row: this, doc: this.doc || "" })`. */
		data(key: "grid_row"): GridRow | undefined;
		/** Same write; the value is `this.doc || ""` (grid_row.js:70). */
		data(key: "doc"): FrappeDoc | "" | undefined;
		/**
		 * jQuery 3.7 routes a non-string through `empty().append(value)`, which
		 * text-nodes it via `createTextNode(String(value))`; frappe relies on it
		 * at `grid_row.js:75-79` (`.html(this.doc.idx)`).
		 */
		html(value: number): this;
	}
}

export {};

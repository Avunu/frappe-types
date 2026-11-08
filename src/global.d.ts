/// <reference types="jquery" />
/// <reference path="./modules.d.ts" />
/// <reference path="./registry.d.ts" />
/// <reference path="./namespace.d.ts" />

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
 * ## The `/// <reference>`s above are load-bearing
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
 * 3. **`path="./registry.d.ts"`.** The global `FrappeDocTypes` interface apps
 *    register their doctypes in. `model.d.ts` references it too; naming it here
 *    keeps the ambient entry's dependency on it explicit.
 * 4. **`path="./namespace.d.ts"`.** The TYPE-space `frappe` namespace
 *    (`frappe.ui.form.FormEvents<"ToDo">`, `frappe.views.ListViewSettings`, …)
 *    that JSDoc in desk scripts names. Like `modules.d.ts`, nothing imports
 *    it, so this reference is the only thing that loads it.
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
 * Verified against **frappe v16.54.0**.
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
	DeskHelperGlobals,
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
	 * `frappe/www/desk.html:64` and `frappe/public/js/frappe/provide.js:5` both
	 * do `if (!window.frappe) window.frappe = {}`, so the object exists before
	 * any bundle runs; its *members* arrive lazily via `frappe.provide()`.
	 *
	 * Non-optional on purpose — guard with `window.frappe` instead. See the
	 * file header.
	 */
	var frappe: Frappe;

	/** `frappe/public/js/frappe/translate.js:26` — `window.__ = frappe._;` */
	var __: TranslateFunction;

	/** `frappe/public/js/frappe/ui/messages.js:329` — `window.msgprint = frappe.msgprint`. */
	var msgprint: Frappe["msgprint"];

	/** `frappe/public/js/frappe/provide.js:21` — `frappe.provide("locals")`. */
	var locals: LocalsStore;

	/** `provide.js:50` (as `null`), then `form.js:453` / `pageview.js:99`. */
	var cur_frm: CurrentForm;

	/**
	 * `frappe/public/js/frappe/list/list_factory.js:6` (as `null`), assigned at
	 * `frappe/public/js/frappe/list/list_factory.js:99` and reset at
	 * `frappe/public/js/frappe/list/list_factory.js:102`. Holds a `ReportView`
	 * on `/view/report`.
	 */
	var cur_list: CurrentListView;

	/**
	 * `frappe/public/js/frappe/ui/dialog.js:6` (as `null`), popped at
	 * `frappe/public/js/frappe/ui/dialog.js:115-119` and set at
	 * `frappe/public/js/frappe/ui/dialog.js:127` — the top of the modal stack.
	 */
	var cur_dialog: CurrentDialog;

	/**
	 * `frappe/public/js/frappe/views/container.js:8` (as `null`), assigned at
	 * `frappe/public/js/frappe/views/container.js:51`. Despite the name it holds
	 * the `frappe.views.Container` singleton, never a page.
	 */
	var cur_page: CurrentPageContainer;

	/**
	 * ERPNext's namespace root — `erpnext/public/js/utils.js:3`,
	 * `frappe.provide("erpnext")`, the first import of
	 * `erpnext/public/js/erpnext.bundle.js:1` (read at ERPNext v16.50.0).
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

	// -- window helpers ---------------------------------------------------------
	// The helper functions frappe assigns to `window` at bundle load
	// (`frappe/public/js/frappe/utils/datatype.js:4-81`,
	// `frappe/public/js/frappe/utils/number_format.js:90,324-340`,
	// `frappe/public/js/frappe/utils/common.js:194-237`,
	// `frappe/public/js/frappe/utils/pretty_date.js:81`,
	// `frappe/public/js/frappe/utils/urllib.js:48,76-77`,
	// `frappe/public/js/frappe/form/script_helpers.js:4-65`,
	// `frappe/public/js/frappe/form/script_manager.js:6`,
	// `frappe/public/js/libs.bundle.js:4`,
	// `frappe/public/js/frappe/model/perm.js:9-17`). Every file is
	// loaded unconditionally on the desk, so none of these is optional. The
	// signatures and their per-function citations are `DeskHelperGlobals`'
	// (globals.d.ts); each line below only makes one of them a bare global.

	/** `frappe/public/js/frappe/utils/datatype.js:4-7` — `""` for `null`/`undefined`, else `s + ""`. */
	var cstr: DeskHelperGlobals["cstr"];
	/** `frappe/public/js/frappe/utils/datatype.js:9-17` — `parseInt` with booleans as 1/0; NaN gives `def` (default 0). */
	var cint: DeskHelperGlobals["cint"];
	/** `frappe/public/js/frappe/utils/datatype.js:20-29`. */
	var toTitle: DeskHelperGlobals["toTitle"];
	/** `frappe/public/js/frappe/utils/datatype.js:31-33` — `true` or `undefined`, never `false`. */
	var is_null: DeskHelperGlobals["is_null"];
	/** `frappe/public/js/frappe/utils/datatype.js:35-39`. */
	var copy_dict: DeskHelperGlobals["copy_dict"];
	/** `frappe/public/js/frappe/utils/datatype.js:41-43`. */
	var validate_email: DeskHelperGlobals["validate_email"];
	/** `frappe/public/js/frappe/utils/datatype.js:45-47`. */
	var validate_phone: DeskHelperGlobals["validate_phone"];
	/** `frappe/public/js/frappe/utils/datatype.js:49-51`. */
	var validate_name: DeskHelperGlobals["validate_name"];
	/** `frappe/public/js/frappe/utils/datatype.js:53-55`. */
	var validate_url: DeskHelperGlobals["validate_url"];
	/** `frappe/public/js/frappe/utils/datatype.js:57-64`. */
	var nth: DeskHelperGlobals["nth"];
	/** `frappe/public/js/frappe/utils/datatype.js:66-73`. */
	var has_words: DeskHelperGlobals["has_words"];
	/** `frappe/public/js/frappe/utils/datatype.js:75-81`. */
	var has_common: DeskHelperGlobals["has_common"];
	/**
	 * `frappe/public/js/frappe/utils/number_format.js:8-29` — parses with the
	 * number format's separators; **NaN becomes 0**
	 * (`frappe/public/js/frappe/utils/number_format.js:24`). With `decimals`,
	 * rounded by `_round`.
	 */
	var flt: DeskHelperGlobals["flt"];
	/** `frappe/public/js/frappe/utils/number_format.js:31-46` — string → string; does not parse. */
	var strip_number_groups: DeskHelperGlobals["strip_number_groups"];
	/** `frappe/public/js/frappe/utils/number_format.js:48-75`. */
	var convert_old_to_new_number_format: DeskHelperGlobals["convert_old_to_new_number_format"];
	/** `frappe/public/js/frappe/utils/number_format.js:90-143`. */
	var format_number: DeskHelperGlobals["format_number"];
	/** `frappe/public/js/frappe/utils/number_format.js:145-163` — `v` with the currency's symbol and number format. */
	var format_currency: DeskHelperGlobals["format_currency"];
	/**
	 * `frappe/public/js/frappe/utils/number_format.js:318-322`.
	 * @deprecated frappe's own comment says so; use `format_currency`.
	 */
	var fmt_money: DeskHelperGlobals["fmt_money"];
	/** `frappe/public/js/frappe/utils/number_format.js:165-180` — `null` when currency symbols are hidden. */
	var get_currency_symbol: DeskHelperGlobals["get_currency_symbol"];
	/** `frappe/public/js/frappe/utils/number_format.js:182-191`. */
	var get_number_format: DeskHelperGlobals["get_number_format"];
	/** `frappe/public/js/frappe/utils/number_format.js:193-206`. */
	var get_number_format_info: DeskHelperGlobals["get_number_format_info"];
	/** `frappe/public/js/frappe/utils/number_format.js:208-265` — throws on an unknown rounding method. */
	var _round: DeskHelperGlobals["_round"];
	/** `frappe/public/js/frappe/utils/number_format.js:267-270`. */
	var roundNumber: DeskHelperGlobals["roundNumber"];
	/** `frappe/public/js/frappe/utils/number_format.js:272-281` — a number on a form; the system Float precision STRING otherwise. */
	var precision: DeskHelperGlobals["precision"];
	/** `frappe/public/js/frappe/utils/number_format.js:287-298`. */
	var remainder: DeskHelperGlobals["remainder"];
	/** `frappe/public/js/frappe/utils/number_format.js:300-316`. */
	var round_based_on_smallest_currency_fraction: DeskHelperGlobals["round_based_on_smallest_currency_fraction"];
	/** `frappe/public/js/frappe/utils/number_format.js:283-285` — `list.includes(item)`. */
	var in_list: DeskHelperGlobals["in_list"];
	/** `frappe/public/js/frappe/utils/common.js:194-200` — `%(key)s` substitution. */
	var repl: DeskHelperGlobals["repl"];
	/** `frappe/public/js/frappe/utils/common.js:202-204`. */
	var replace_all: DeskHelperGlobals["replace_all"];
	/** `frappe/public/js/frappe/utils/common.js:206-208`. */
	var strip_html: DeskHelperGlobals["strip_html"];
	/** `frappe/public/js/frappe/utils/common.js:210-216` — `undefined` for a falsy string. */
	var strip: DeskHelperGlobals["strip"];
	/** `frappe/public/js/frappe/utils/common.js:218-227`. */
	var lstrip: DeskHelperGlobals["lstrip"];
	/** `frappe/public/js/frappe/utils/common.js:229-237`. */
	var rstrip: DeskHelperGlobals["rstrip"];
	/** `frappe/public/js/frappe/utils/pretty_date.js:81-94` — an HTML `<span>`. */
	var comment_when: DeskHelperGlobals["comment_when"];
	/** `frappe/public/js/frappe/utils/urllib.js:48-74` — POSTs `PARAMS` to `URL` through a hidden form. */
	var open_url_post: DeskHelperGlobals["open_url_post"];
	/** `frappe/public/js/frappe/utils/urllib.js:76`. */
	var get_url_arg: DeskHelperGlobals["get_url_arg"];
	/** `frappe/public/js/frappe/utils/urllib.js:77`. */
	var get_url_dict: DeskHelperGlobals["get_url_dict"];
	/** `frappe/public/js/frappe/form/script_helpers.js:4-9`. */
	var refresh_many: DeskHelperGlobals["refresh_many"];
	/** `frappe/public/js/frappe/form/script_helpers.js:11-33`. */
	var refresh_field: DeskHelperGlobals["refresh_field"];
	/** `frappe/public/js/frappe/form/script_helpers.js:35-37`. */
	var set_field_options: DeskHelperGlobals["set_field_options"];
	/** `frappe/public/js/frappe/form/script_helpers.js:39-47`. */
	var toggle_field: DeskHelperGlobals["toggle_field"];
	/** `frappe/public/js/frappe/form/script_helpers.js:49-56`. */
	var hide_field: DeskHelperGlobals["hide_field"];
	/** `frappe/public/js/frappe/form/script_helpers.js:58-65`. */
	var unhide_field: DeskHelperGlobals["unhide_field"];
	/** `frappe/public/js/frappe/form/script_manager.js:6-12`. */
	var extend_cscript: DeskHelperGlobals["extend_cscript"];
	/** `frappe/public/js/libs.bundle.js:4-7` — `__` and `frappe` as a Vue app's global properties. */
	var SetVueGlobals: DeskHelperGlobals["SetVueGlobals"];
	/** `frappe/public/js/frappe/model/perm.js:10` — `"read"`. */
	var READ: DeskHelperGlobals["READ"];
	/** `frappe/public/js/frappe/model/perm.js:11` — `"write"`. */
	var WRITE: DeskHelperGlobals["WRITE"];
	/** `frappe/public/js/frappe/model/perm.js:12` — `"create"`. */
	var CREATE: DeskHelperGlobals["CREATE"];
	/** `frappe/public/js/frappe/model/perm.js:13` — `"delete"`. */
	var DELETE: DeskHelperGlobals["DELETE"];
	/** `frappe/public/js/frappe/model/perm.js:14` — `"submit"`. */
	var SUBMIT: DeskHelperGlobals["SUBMIT"];
	/** `frappe/public/js/frappe/model/perm.js:15` — `"cancel"`. */
	var CANCEL: DeskHelperGlobals["CANCEL"];
	/** `frappe/public/js/frappe/model/perm.js:16` — `"amend"`. */
	var AMEND: DeskHelperGlobals["AMEND"];

	// -- provide.js:42-45 constants -----------------------------------------
	/** `frappe/public/js/frappe/provide.js:42` — `"\n"`. */
	var NEWLINE: string;
	/** `frappe/public/js/frappe/provide.js:43` — `9`. */
	var TAB: number;
	/** `frappe/public/js/frappe/provide.js:44` — `38`. */
	var UP_ARROW: number;
	/** `frappe/public/js/frappe/provide.js:45` — `40`. */
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

		/** `ui/messages.js:329`. Optional for the same headless reason as `__`. */
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
	 * `frappe/public/js/frappe/utils/utils.js:13-28`. Both are installed inside
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
	 * (`frappe/public/js/frappe/ui/dialog.js:325`) calls `.modal("show")` on a
	 * plain jQuery handle, so without this the package's own declarations would
	 * not type-check at their call sites.
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

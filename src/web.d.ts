/// <reference path="./global.d.ts" />

/**
 * frappe-types/web — the **website and web form** globals.
 *
 * ```jsonc
 * // tsconfig.json for web form client scripts and www/ page scripts
 * {
 *   "extends": "frappe-types/tsconfig/desk-js.json",
 *   "compilerOptions": { "types": ["frappe-types/web"] }
 * }
 * ```
 *
 * Everything `frappe-types/global` installs, plus the members frappe adds to
 * `frappe` on a WEBSITE page — `frappe.ready`, and on a web form page
 * `frappe.web_form`, `frappe.web_form_doc`, `frappe.reference_doc`,
 * `frappe.init_client_script`, `frappe.form_dirty`, `frappe.web_form_list`,
 * `frappe.ui.WebFormListRow` and the `window.saving` guard.
 *
 * The web form controller and list classes themselves (`WebForm`,
 * `WebFormList`) are default exports of ES modules, reached by deep import —
 * `import WebForm from "frappe/public/js/frappe/web_form/web_form"` — which
 * `modules.d.ts` declares; their types are in `src/web_form.d.ts` and are
 * re-exported here.
 *
 * ## An over-approximation, stated
 *
 * The website bundle (`frappe/public/js/frappe-web.bundle.js`) carries a
 * SUBSET of the desk API — `frappe.call`, `frappe.ui.Dialog`, the form
 * controls, `frappe.utils` — and no `frappe.ui.form.Form`, list views or
 * reports. This entry does not try to subtract the desk-only parts: it adds
 * the web members to the one {@link Frappe} interface. So a web script that
 * reaches for, say, `frappe.views.ListView` type-checks and then fails at
 * runtime. The converse is also true: a program that loads this entry sees
 * `frappe.ready` in its desk scripts too, where it does not exist. Keep web
 * scripts and desk scripts in separate tsconfig projects if that matters.
 *
 * Verified against **frappe v16.54.0**.
 *
 * @packageDocumentation
 */

import type { FrappeDocBase } from "./model";
import type { WebForm, WebFormDoc, WebFormList, WebFormListRow } from "./web_form";

// The web form shapes live in `./web_form`, which installs nothing, so the deep
// imports in `modules.d.ts` can reach the controller classes without pulling the
// website members below into every desk program. Re-exported here, where they
// have always been importable from.
export type {
	WebForm,
	WebFormConstructor,
	WebFormDoc,
	WebFormDocFields,
	WebFormEvents,
	WebFormList,
	WebFormListColumn,
	WebFormListOptions,
	WebFormListRow,
	WebFormListRowEvents,
	WebFormListViewColumn,
	WebFormOptions,
	WebFormSaveResult,
} from "./web_form";

/** The members a website page adds to `frappe`. */
export interface FrappeWebGlobals {
	/**
	 * Queue a callback for when the website bundle has loaded. Defined inline
	 * by the page template (`frappe/templates/base.html:49-51`) before any
	 * bundle, and drained by `frappe.trigger_ready`
	 * (`frappe/website/js/website.js:293-300`), which runs each callback in turn
	 * and logs (rather than rethrows) one that throws.
	 */
	ready(fn: () => void): void;
	/** `frappe/templates/base.html:48` — the queue {@link FrappeWebGlobals.ready} pushes to. */
	ready_events: Array<() => void>;
	/**
	 * The web form on this page — `frappe/public/js/frappe/web_form/web_form.js:9`.
	 * Before the controller is constructed it is the empty object
	 * `frappe.provide("frappe.web_form")` made (:2); a web form's client script
	 * runs from inside `make()` (:39), after construction, so for client scripts
	 * it is always the controller.
	 */
	web_form: WebForm;
	/** `frappe/website/doctype/web_form/templates/web_form.html:188`. See {@link WebFormDoc}. */
	web_form_doc: WebFormDoc;
	/**
	 * `frappe/website/doctype/web_form/templates/web_form.html:189` — the
	 * document being edited or viewed, `{}` on a new form
	 * (`frappe/website/doctype/web_form/web_form.py:569`). For a Guest, or a
	 * Web Form Request, trimmed to `name`, `doctype` and the form's own fields
	 * (`frappe/website/doctype/web_form/web_form.py:592-602`).
	 */
	reference_doc: FrappeDocBase;
	/**
	 * The web form's client script, wrapped in a function by the template
	 * (`frappe/website/doctype/web_form/templates/web_form.html:211-219`) —
	 * only when the Web Form has one, hence optional. `make()` calls it guarded
	 * (`frappe/public/js/frappe/web_form/web_form.js:39`).
	 */
	init_client_script?: () => void;
	/**
	 * `true` once a field changed on an editable form
	 * (`frappe/public/js/frappe/web_form/web_form.js:66-72`), reset to `false` on
	 * save (:415). Undefined until the first change.
	 */
	form_dirty?: boolean;
	/**
	 * The web form list on a web form's list route —
	 * `frappe/public/js/frappe/web_form/web_form_list.js:8`, assigned by the
	 * `WebFormList` constructor. Absent on a page without the web form bundle;
	 * on one with it, the empty object `frappe.provide("frappe.web_form_list")`
	 * made at bundle load (:3) until a list is constructed — which a form-view
	 * page never does.
	 */
	web_form_list?: WebFormList | Record<string, never>;
}

declare module "./index" {
	interface Frappe extends FrappeWebGlobals {}
	interface FrappeUiNamespace {
		/**
		 * `frappe/public/js/frappe/web_form/web_form_list.js:391` — the row class
		 * `WebFormList` renders each record with. Defined when the web form
		 * bundle loads, so absent from every other page.
		 */
		WebFormListRow?: typeof WebFormListRow;
	}
}

declare global {
	interface Window {
		/**
		 * The web form's save guard: `WebForm#save` returns at once while it is
		 * set (`frappe/public/js/frappe/web_form/web_form.js:405`), sets it before
		 * posting (:414) and clears it when the request completes, either way
		 * (:449-451). Undefined until the first save.
		 */
		saving?: boolean;
	}
}

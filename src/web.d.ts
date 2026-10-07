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
 * `frappe.init_client_script` and `frappe.form_dirty`.
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
 * Verified against **frappe v16.50.0**.
 *
 * @packageDocumentation
 */

import type { FrappeCheck, FrappeDocBase, DocField } from "./model";
import type { BaseControl, FieldGroup } from "./ui/form";

/**
 * `frappe.web_form.events` — `EventEmitterMixin`
 * (`frappe/public/js/frappe/event_emitter.js:5-28`), copied onto a fresh object by
 * `frappe/public/js/frappe/web_form/web_form.js:10-11`. It rides on a jQuery
 * object (`init`, :6-8), so a handler receives the `data` argument of
 * `trigger` and nothing else.
 *
 * frappe triggers two events itself, without data: `"after_load"` at the end of
 * `make()` (`frappe/public/js/frappe/web_form/web_form.js:41`) and
 * `"after_save"` after a successful save (:433).
 */
export interface WebFormEvents {
	/** `frappe/public/js/frappe/event_emitter.js:10-13`. */
	trigger(evt: string, data?: unknown): void;
	/** `frappe/public/js/frappe/event_emitter.js:15-18` — fires once, through jQuery's `one`. */
	once(evt: string, handler: (data: unknown) => void): void;
	/** `frappe/public/js/frappe/event_emitter.js:20-23`. */
	on(evt: string, handler: (data: unknown) => void): void;
	/**
	 * `frappe/public/js/frappe/event_emitter.js:25-28`. Unbinds a NEW wrapper
	 * function, never the one `on` bound, so it removes nothing; declared because
	 * it exists, not because it works.
	 */
	off(evt: string, handler: (data: unknown) => void): void;
}

/**
 * `frappe.web_form_doc` — the Web Form document as the page template embeds it
 * (`frappe/website/doctype/web_form/templates/web_form.html:188`,
 * `frappe/website/doctype/web_form/templates/web_list.html:30`): `as_dict(no_nulls=True)`
 * of the Web Form, plus the page flags merged in by
 * `frappe/website/doctype/web_form/web_form.py:304-313`.
 *
 * Only the keys frappe's own web form scripts read are named. Every other
 * field of the Web Form doctype is there too, under the open signature.
 */
export interface WebFormDoc extends WebFormDocFields {
	[field: string]: unknown;
}

/**
 * The named keys of {@link WebFormDoc}, without its index signature.
 *
 * Kept separate so {@link WebForm} can `Omit` from it: `Omit` over a type with
 * a string index signature keeps only the signature, because `keyof` of such a
 * type is `string | number`. `WebForm` used to `Omit` from `WebFormDoc`
 * directly, which typed `frappe.web_form.doc_type` and `frappe.web_form.name`
 * as `unknown`.
 */
export interface WebFormDocFields {
	/** The Web Form's name. */
	name: string;
	/** The doctype the web form writes — read at `frappe/public/js/frappe/web_form/webform_script.js:30`. */
	doc_type: string;
	/** `frappe/website/doctype/web_form/web_form.py:306` from `frappe/website/router.py:51` — present (and `true`) only on the list route. */
	is_list?: boolean;
	/** `frappe/website/doctype/web_form/web_form.py:306` from `frappe/website/router.py:53` — present (and `true`) only on `/new`. */
	is_new?: boolean;
	/** Always present: initialised `False` at `frappe/website/doctype/web_form/web_form.py:196-197`, copied in at `:306`. */
	in_edit_mode: boolean;
	/** Always present: initialised `False` at `frappe/website/doctype/web_form/web_form.py:196-197`, copied in at `:306`. */
	in_view_mode: boolean;
	/** `frappe/website/doctype/web_form/web_form.py:310-313` — set when the page was opened through a Web Form Request. */
	is_web_form_request?: boolean;
	/** `frappe/website/doctype/web_form/web_form.py:313`; read at `frappe/public/js/frappe/web_form/web_form_list.js:120`. */
	web_form_request_key?: string;
	/** The form's fields, as docfields; `setup_fields` normalises them before render (`frappe/public/js/frappe/web_form/webform_script.js:59-63`). */
	web_form_fields: DocField[];
	/** `frappe/public/js/frappe/web_form/webform_script.js:13`. */
	login_required?: FrappeCheck;
	/** `frappe/public/js/frappe/web_form/webform_script.js:35`. */
	allow_delete?: FrappeCheck;
}

/**
 * `frappe.web_form` — the web form controller,
 * `frappe/public/js/frappe/web_form/web_form.js:5`
 * (`class WebForm extends frappe.ui.FieldGroup`), which installs itself as
 * `frappe.web_form` in its constructor (:9).
 *
 * An interface over {@link FieldGroup} rather than a class: the class is the
 * default export of an ES module inside `web_form.bundle.js`, with no global
 * name a script could subclass. `doc` is replaced, because a web form's `doc`
 * is `reference_doc || {}` (`frappe/public/js/frappe/web_form/webform_script.js:44`)
 * — possibly empty, never a document from `locals`.
 *
 * `prepare()` copies the whole {@link WebFormDoc} onto the instance
 * (`frappe/public/js/frappe/web_form/web_form.js:17`), so its keys are members
 * here as well.
 */
export interface WebForm
	extends Omit<FieldGroup, "doc" | "is_new">,
		Omit<WebFormDocFields, "web_form_fields" | "is_new"> {
	/** The Web Form's other fields, copied from {@link WebFormDoc} like the named ones. */
	[field: string]: unknown;
	/**
	 * NOT a reliable flag — read `frappe.web_form_doc.is_new` instead.
	 * `prepare()` copies `web_form_doc` onto the instance
	 * (`frappe/public/js/frappe/web_form/web_form.js:17`), but `web_form_doc`
	 * carries `is_new` only on the `/new` route
	 * (`frappe/website/doctype/web_form/web_form.py:306` copies the key only when
	 * present, `frappe/utils/data.py:2643-2649`). Everywhere else nothing shadows
	 * the inherited `FieldGroup#is_new` METHOD
	 * (`frappe/public/js/frappe/ui/field_group.js:289-291`), so the property is a
	 * function — truthy. frappe's own `if (this.is_new || …)`
	 * (`frappe/public/js/frappe/web_form/web_form.js:28`) is affected the same way.
	 */
	is_new: true | FieldGroup["is_new"];
	/** `frappe/public/js/frappe/web_form/web_form.js:10-11`. See {@link WebFormEvents}. */
	events: WebFormEvents;
	/**
	 * `frappe/public/js/frappe/web_form/web_form.js:19` — `reference_doc || {}`.
	 * `save()` copies the form's values onto it and stamps `doctype` and
	 * `web_form_name` before posting it (`frappe/public/js/frappe/web_form/web_form.js:409-411`).
	 */
	doc: FrappeDocBase & { web_form_name?: string };
	/** `frappe/public/js/frappe/web_form/web_form.js:12` — index of the visible page of a multi-step form. */
	current_section: number;
	/** `frappe/public/js/frappe/web_form/web_form.js:13`, `:86` — true when the form has page breaks. */
	is_multi_step_form: boolean;
	/** `frappe/public/js/frappe/web_form/web_form.js:390`, `:222` — set once a submit was attempted, which turns on mandatory highlighting. */
	primary_action_fulfilled?: boolean;

	/**
	 * `frappe/public/js/frappe/web_form/web_form.js:45-52`. Sets the field's
	 * `df.change` to call `handler(field, field.value)`, then refresh
	 * dependencies and mark the form dirty. Replaces any earlier handler for
	 * that field, and THROWS for a fieldname the form does not have
	 * (`this.fields_dict[fieldname]` is dereferenced unguarded, :46-47).
	 */
	on(fieldname: string, handler: (field: BaseControl, value: unknown) => void): void;

	/**
	 * A validation hook the client script assigns. `save()` calls it first
	 * (`frappe/public/js/frappe/web_form/web_form.js:391-398`): a falsy return
	 * other than `undefined` shows "Couldn't save" and stops the save.
	 */
	validate?: () => boolean | undefined | void;
	/** A hook the client script assigns; `make()` calls it last (`frappe/public/js/frappe/web_form/web_form.js:42`). */
	after_load?: () => void;
	/** A hook the client script assigns; called after a successful save (`frappe/public/js/frappe/web_form/web_form.js:434`). */
	after_save?: () => void;

	/** `frappe/public/js/frappe/web_form/web_form.js:157-169` — field defaults, then `doc`, then the URL query, through `set_values`. */
	set_default_values(): void;
	/**
	 * `frappe/public/js/frappe/web_form/web_form.js:387-454`. Validates, then
	 * posts to `frappe.website.doctype.web_form.web_form.accept`. Always returns
	 * `false` (it is a submit handler); the outcome arrives through
	 * `after_save` / the `"after_save"` event.
	 */
	save(): false;
	/** `frappe/public/js/frappe/web_form/web_form.js:183-197` — confirms when dirty, then leaves the page. */
	discard_form(): false;
	/** `frappe/public/js/frappe/web_form/web_form.js:218-277` — checks the visible page's mandatory fields. */
	validate_section(): boolean;
	/** `frappe/public/js/frappe/web_form/web_form.js:279-290` — shows the page at `current_section`. */
	toggle_section(): void;
}

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
}

declare module "./index" {
	interface Frappe extends FrappeWebGlobals {}
}

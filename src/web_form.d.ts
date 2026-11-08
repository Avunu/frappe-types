/**
 * The web form controller, `WebFormList` and the shapes around them —
 * `frappe/public/js/frappe/web_form/web_form.js`,
 * `frappe/public/js/frappe/web_form/web_form_list.js` and the page data
 * `frappe/website/doctype/web_form/web_form.py` hands them.
 *
 * Source of truth: frappe v16.54.0 (`git tag v16.54.0`). Citations are
 * full-path so `npm run audit:drift` can check them.
 *
 * ## Why a file of its own
 *
 * `WebForm` and `WebFormList` are the DEFAULT exports of two ES modules inside
 * `web_form.bundle.js` (`frappe/public/js/web_form.bundle.js:6`,
 * `frappe/public/js/frappe/web_form/webform_script.js:1-2`), with no global
 * name. An app that replaces frappe's web form script subclasses them by deep
 * import, which `modules.d.ts` declares:
 *
 * ```ts
 * import WebForm from "frappe/public/js/frappe/web_form/web_form";
 * import WebFormList from "frappe/public/js/frappe/web_form/web_form_list";
 * ```
 *
 * Those declarations are loaded with `frappe-types/global`, so the values
 * they re-export cannot live in `web.d.ts`, which installs the website
 * members on `frappe` as a side effect. This file installs nothing: it is the
 * plain module both `web.d.ts` and the deep imports read from.
 *
 * @packageDocumentation
 */

import type { FrappeAjaxResult } from "./core";
import type { DocField, FrappeCheck, FrappeDocBase, FrappeDocFields } from "./model";
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
 * One `list_columns` row of a Web Form — the Web Form List Column doctype
 * (`frappe/website/doctype/web_form_list_column/web_form_list_column.json`),
 * as `as_dict(no_nulls=True)` sends it: the four fields below, plus the
 * standard child-row keys (`name`, `idx`, `parent`, …) under the open
 * signature.
 */
export interface WebFormListColumn {
	/** The column's field (reqd). */
	fieldname: string;
	label?: string;
	fieldtype?: string;
	options?: string;
	[key: string]: unknown;
}

/**
 * A column as `WebFormList#get_list_view_fields` keeps it: the four fields of a
 * {@link WebFormListColumn}, nothing else
 * (`frappe/public/js/frappe/web_form/web_form_list.js:101-108`).
 */
export type WebFormListViewColumn = Pick<WebFormListColumn, "fieldname" | "label" | "fieldtype" | "options">;

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
 *
 * `as_dict(no_nulls=True)` drops a field whose value is `None`
 * (`frappe/model/document.py:2673`), so an unset Data field is ABSENT rather
 * than `null`; a table is always present, as a list (`:2679-2690`).
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
	/**
	 * The page's URL path, without the leading `/` (a Data field); the success
	 * page and the delete redirect build links from it
	 * (`frappe/public/js/frappe/web_form/web_form.js:485`, `:521`).
	 */
	route?: string;
	/** Offer "Edit your response" after a save (`frappe/public/js/frappe/web_form/web_form.js:483`). */
	allow_edit?: FrappeCheck;
	/** `frappe/public/js/frappe/web_form/web_form.js:493`, `:523`. */
	allow_multiple?: FrappeCheck;
	/** `frappe/public/js/frappe/web_form/web_form.js:493`, `:520`. */
	show_list?: FrappeCheck;
	/**
	 * Save without the mandatory checks: `validate_section` passes at once
	 * (`frappe/public/js/frappe/web_form/web_form.js:219`), `save()` collects
	 * the values with errors ignored (:401), and the submit button stays
	 * visible on every page of a multi-step form (:364).
	 */
	allow_incomplete?: FrappeCheck;
	/**
	 * Where `handle_success` sends the browser, five seconds after a save
	 * (`frappe/public/js/frappe/web_form/web_form.js:470-474`); without it the
	 * success page is rendered instead. A Data field, so absent when unset.
	 */
	success_url?: string;
	/** The list view's columns — passed to `WebFormList` (`frappe/public/js/frappe/web_form/webform_script.js:32`). */
	list_columns: WebFormListColumn[];
	/**
	 * The list's filters, a JSON string (a JSON field) that `WebFormList#fetch_data`
	 * parses (`frappe/public/js/frappe/web_form/web_form_list.js:113-117`).
	 */
	condition_json?: string;
}

/**
 * What `WebForm#handle_success` and `#render_success_page` receive: `r.message`
 * of the save request — for frappe's own `save()`, the saved document the
 * accept endpoint returns (`frappe/website/doctype/web_form/web_form.py:953-954`).
 * frappe reads only its `name`, to link to the response
 * (`frappe/public/js/frappe/web_form/web_form.js:483-500`). A `string` when the
 * payments app's `accept_payment` is on: `handle_success` then navigates to it
 * as a URL (:457-460).
 *
 * Structural rather than a document type so that a subclass whose `save()`
 * posts to its own endpoint can pass that endpoint's result, typed by its own
 * interface, straight through.
 */
export type WebFormSaveResult = (FrappeDocFields & { name?: string }) | string;

/**
 * What `new WebForm(opts)` takes. The constructor `Object.assign`s every key
 * onto the instance (`frappe/public/js/frappe/web_form/web_form.js:6-8`);
 * frappe passes only `parent` (`frappe/public/js/frappe/web_form/webform_script.js:41-43`),
 * which `make()` empties and renders into (`frappe/public/js/frappe/web_form/web_form.js:23`).
 */
export interface WebFormOptions {
	parent: JQuery<HTMLElement>;
	/** Any other key is copied onto the controller as is. */
	[option: string]: unknown;
}

/**
 * The web form controller — `frappe/public/js/frappe/web_form/web_form.js:5`
 * (`export default class WebForm extends frappe.ui.FieldGroup`), which
 * installs itself as `frappe.web_form` in its constructor (:9).
 *
 * The instance type of the {@link WebForm} value. That value is declared as a
 * constructor rather than a `class` because the controller is not a
 * well-behaved `FieldGroup` subclass: its `doc` is `reference_doc || {}`
 * (`frappe/public/js/frappe/web_form/webform_script.js:44`) — possibly empty,
 * never a document from `locals` — its `parent` must be a jQuery object, its
 * `page_breaks` is a jQuery set rather than an array, and `is_new` stops being
 * a method on `/new`. A `class` could not change those inherited types; this
 * interface `Omit`s and replaces them. Subclassing works all the same:
 *
 * ```ts
 * import WebForm from "frappe/public/js/frappe/web_form/web_form";
 *
 * class MyWebForm extends WebForm {
 *   override handle_success(data: WebFormSaveResult): void {
 *     super.handle_success(data);
 *   }
 * }
 * ```
 *
 * `prepare()` copies the whole {@link WebFormDoc} onto the instance
 * (`frappe/public/js/frappe/web_form/web_form.js:17`), so its keys are members
 * here as well, and its unnamed ones fall under the open signature.
 *
 * Lifecycle: frappe's own script constructs it, calls `prepare()`, then
 * `make()` (`frappe/public/js/frappe/web_form/webform_script.js:41-48`).
 * Members assigned by `make()` (`page_breaks`, the step buttons) are declared
 * as they are after it.
 */
export interface WebForm
	extends Omit<FieldGroup, "doc" | "is_new" | "parent" | "page_breaks">,
		Omit<WebFormDocFields, "web_form_fields" | "is_new"> {
	/** The Web Form's other fields, copied from {@link WebFormDoc} like the named ones. */
	[field: string]: unknown;
	/**
	 * NOT a reliable flag — read `frappe.web_form_doc.is_new` instead.
	 * `prepare()` copies `web_form_doc` onto the instance
	 * (`frappe/public/js/frappe/web_form/web_form.js:17`), but `web_form_doc`
	 * carries `is_new` only on the `/new` route
	 * (`frappe/website/doctype/web_form/web_form.py:306` copies the key only when
	 * present, `frappe/utils/data.py:2653-2659`). Everywhere else nothing shadows
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
	/** From the constructor options (`frappe/public/js/frappe/web_form/web_form.js:8`); emptied and rendered into by `make()` (:23). */
	parent: JQuery<HTMLElement>;
	/** `frappe/public/js/frappe/web_form/web_form.js:12` — index of the visible page of a multi-step form. */
	current_section: number;
	/** `frappe/public/js/frappe/web_form/web_form.js:13`, `:86` — true when the form has page breaks. */
	is_multi_step_form: boolean;
	/**
	 * `frappe/public/js/frappe/web_form/web_form.js:75-85` — the page's
	 * `.page-break` elements that contain a form, a jQuery set (where
	 * `Layout#page_breaks` is an array). Assigned by `make()`.
	 */
	page_breaks: JQuery<HTMLElement>;
	/** `frappe/public/js/frappe/web_form/web_form.js:96-98` — the "Next" button, made only on a multi-step form. */
	$next_button?: JQuery<HTMLElement>;
	/** `frappe/public/js/frappe/web_form/web_form.js:100-102` — the "Previous" button, made only on a multi-step form. */
	$previous_button?: JQuery<HTMLElement>;
	/** `frappe/public/js/frappe/web_form/web_form.js:305-307` — the progress dots, made only on an editable multi-step form. */
	$slide_progress?: JQuery<HTMLElement>;
	/** `frappe/public/js/frappe/web_form/web_form.js:390`, `:222` — set once a submit was attempted, which turns on mandatory highlighting. */
	primary_action_fulfilled?: boolean;

	/**
	 * `frappe/public/js/frappe/web_form/web_form.js:16-20` — copies every key of
	 * `web_form_doc` onto the controller, takes its `web_form_fields` as the
	 * fields to render, and keeps `doc` as the document. Call before `make()`.
	 */
	prepare(web_form_doc: WebFormDoc, doc: FrappeDocBase): void;
	/**
	 * `frappe/public/js/frappe/web_form/web_form.js:22-43` — empties `parent`,
	 * renders the fields, fills them from `doc`, wires the save / discard /
	 * delete buttons and the page navigation, then runs the client script
	 * (`frappe.init_client_script`), fires `"after_load"` and calls
	 * `after_load`.
	 */
	make(): void;
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

	/** `frappe/public/js/frappe/web_form/web_form.js:54-64` — gives every field without a `change` handler one that refreshes dependencies and marks the form dirty. */
	setup_listeners(): void;
	/** `frappe/public/js/frappe/web_form/web_form.js:66-72` — sets `frappe.form_dirty` and shows the "Not Saved" badge, on an editable form only. */
	make_form_dirty(): void;
	/** `frappe/public/js/frappe/web_form/web_form.js:74-87` — drops empty page breaks and sets `page_breaks` / `is_multi_step_form`. */
	set_page_breaks(): void;
	/** `frappe/public/js/frappe/web_form/web_form.js:89-150` — adds the Previous / Next buttons of a multi-step form. */
	setup_previous_next_button(): void;
	/** `frappe/public/js/frappe/web_form/web_form.js:152-155` — `set_values(doc)` when `doc` has a `name`. */
	set_field_values(): void;
	/** `frappe/public/js/frappe/web_form/web_form.js:157-169` — field defaults, then `doc`, then the URL query, through `set_values`. */
	set_default_values(): void;
	/** `frappe/public/js/frappe/web_form/web_form.js:171-173` — binds `save()` to the form's `submit`. */
	setup_primary_action(): void;
	/** `frappe/public/js/frappe/web_form/web_form.js:175-177`. */
	setup_discard_action(): void;
	/** `frappe/public/js/frappe/web_form/web_form.js:179-181`. */
	setup_delete_action(): void;
	/** `frappe/public/js/frappe/web_form/web_form.js:183-197` — confirms when dirty, then leaves the page. */
	discard_form(): false;
	/** `frappe/public/js/frappe/web_form/web_form.js:199-216` — confirms, deletes the document on the server, then redirects. */
	delete_form(): false;
	/** `frappe/public/js/frappe/web_form/web_form.js:218-277` — checks the visible page's mandatory fields. */
	validate_section(): boolean;
	/** `frappe/public/js/frappe/web_form/web_form.js:279-290` — shows the page at `current_section`. */
	toggle_section(): void;
	/** `frappe/public/js/frappe/web_form/web_form.js:292-326`. */
	render_progress_dots(): void;
	/** `frappe/public/js/frappe/web_form/web_form.js:328-337`. */
	toggle_buttons(): void;
	/** `frappe/public/js/frappe/web_form/web_form.js:339-346` — whether the page after `section` has no visible control. */
	is_next_section_empty(section: number): boolean;
	/** `frappe/public/js/frappe/web_form/web_form.js:348-355` — whether the page before `section` has no visible control. */
	is_previous_section_empty(section: number): boolean;
	/** `frappe/public/js/frappe/web_form/web_form.js:357-360`. */
	show_save_and_hide_next_button(): void;
	/** `frappe/public/js/frappe/web_form/web_form.js:362-365`. */
	show_next_and_hide_save_button(): void;
	/** `frappe/public/js/frappe/web_form/web_form.js:367-369`. */
	toggle_previous_button(): void;
	/** `frappe/public/js/frappe/web_form/web_form.js:371-373` — the jQuery SELECTOR (a string) of page `idx`. */
	get_page(idx: number): string;
	/** `frappe/public/js/frappe/web_form/web_form.js:375-377`. */
	show_form_page(): void;
	/** `frappe/public/js/frappe/web_form/web_form.js:379-385`. */
	hide_form_pages(): void;
	/**
	 * `frappe/public/js/frappe/web_form/web_form.js:387-454`. Validates, then
	 * posts to `frappe.website.doctype.web_form.web_form.accept`. Always returns
	 * `false` (it is a submit handler); the outcome arrives through
	 * `handle_success`, `after_save` and the `"after_save"` event. Does nothing
	 * while `window.saving` is set (:405, :414, :450).
	 */
	save(): false;
	/**
	 * `frappe/public/js/frappe/web_form/web_form.js:456-478` — called by
	 * `save()` with `r.message` of the accept call (:432): the saved document
	 * (`frappe/website/doctype/web_form/web_form.py:953-954`). Hides the form,
	 * shows the success page, then redirects to `success_url` after five
	 * seconds or calls `render_success_page(data)`. With the payments app's
	 * `accept_payment` on an unpaid document it first navigates to `data` as a
	 * URL (:457-460). See {@link WebFormSaveResult}.
	 */
	handle_success(data: WebFormSaveResult): void;
	/**
	 * `frappe/public/js/frappe/web_form/web_form.js:480-502` — adds the "Edit
	 * your response" / "View your response" links for `data.name` to the
	 * success page, as `allow_edit`, `login_required`, `allow_multiple` and
	 * `show_list` allow.
	 */
	render_success_page(data: WebFormSaveResult): void;
	/** `frappe/public/js/frappe/web_form/web_form.js:504-508` — `?web_form_request_key=…`, or `""`. */
	get_request_query(): string;
	/** `frappe/public/js/frappe/web_form/web_form.js:510-516`. */
	get_discard_url(): string;
	/** `frappe/public/js/frappe/web_form/web_form.js:518-533`. */
	get_delete_redirect_url(): string;
}

/**
 * The type of the {@link WebForm} value: what a subclass `extends`. See the
 * note on the {@link WebForm} interface for why it is not a `class`.
 */
export interface WebFormConstructor {
	new (opts: WebFormOptions): WebForm;
	readonly prototype: WebForm;
}

/**
 * The web form controller class — the default export of
 * `frappe/public/js/frappe/web_form/web_form.js:5`. Reached by deep import
 * (`modules.d.ts`); constructing one makes it `frappe.web_form` (:9).
 */
export declare const WebForm: WebFormConstructor;

/**
 * What `new WebFormList(opts)` takes — the object
 * `frappe/public/js/frappe/web_form/webform_script.js:29-37` builds from
 * {@link WebFormDoc}. `Object.assign`ed onto the instance
 * (`frappe/public/js/frappe/web_form/web_form_list.js:7`).
 */
export interface WebFormListOptions {
	/** The Web Form's `doc_type`. */
	doctype: string;
	/** The Web Form's name. */
	web_form_name: string;
	/** Without it no column is shown, and rendering a non-empty list throws (`frappe/public/js/frappe/web_form/web_form_list.js:100`, `:208`). */
	list_columns?: WebFormListColumn[] | undefined;
	/** See {@link WebFormDocFields.condition_json}. */
	condition_json?: string | undefined;
	/** `allow_delete` gates the row selection buttons (`frappe/public/js/frappe/web_form/web_form_list.js:361`, `:367`, `:373`). */
	settings: { allow_delete?: FrappeCheck | undefined };
}

/**
 * One row of the web form list — `frappe.ui.WebFormListRow`,
 * `frappe/public/js/frappe/web_form/web_form_list.js:391-440`, built by
 * `WebFormList#append_rows` (:283-295).
 */
export declare class WebFormListRow {
	/** `frappe/public/js/frappe/web_form/web_form_list.js:392-395` — copies the five keys below and renders the row. */
	constructor(opts: {
		row: JQuery<HTMLElement>;
		doc: FrappeDocBase;
		columns: WebFormListViewColumn[];
		serial_number: number;
		events: WebFormListRowEvents;
	});
	/** The `<tr>`. */
	row: JQuery<HTMLElement>;
	/** The list record, as the list endpoint returned it. */
	doc: FrappeDocBase;
	columns: WebFormListViewColumn[];
	/** 1-based. */
	serial_number: number;
	events: WebFormListRowEvents;
	/** `frappe/public/js/frappe/web_form/web_form_list.js:401`. */
	checkbox: JQuery<HTMLElement>;
	/** `frappe/public/js/frappe/web_form/web_form_list.js:397-430`. */
	make_row(): void;
	/** `frappe/public/js/frappe/web_form/web_form_list.js:432-435`. */
	toggle_select(checked: boolean): void;
	/** `frappe/public/js/frappe/web_form/web_form_list.js:437-439`. */
	is_selected(): boolean;
}

/** The `events` of a {@link WebFormListRow} — `frappe/public/js/frappe/web_form/web_form_list.js:288-294`. */
export interface WebFormListRowEvents {
	/** A click on the row. */
	on_edit(): void;
	/** A click on the row's checkbox. */
	on_select(checked: boolean): void;
}

/**
 * The web form list view — the default export of
 * `frappe/public/js/frappe/web_form/web_form_list.js:5`. The constructor does
 * all the work: it becomes `frappe.web_form_list` (:8), adds the delete
 * action and fetches the filter fields, whose arrival triggers the first
 * `refresh()` (:37-83). Nothing has to be called on the result.
 *
 * Members that `refresh()` and the fetch assign (`rows`, `web_list_start`,
 * `page_length`) are declared as they are once the first refresh started —
 * which is before any overridden method that reads them runs.
 */
export declare class WebFormList {
	constructor(opts: WebFormListOptions);
	doctype: string;
	web_form_name: string;
	list_columns?: WebFormListColumn[] | undefined;
	condition_json?: string | undefined;
	settings: { allow_delete?: FrappeCheck | undefined };
	/** `frappe/public/js/frappe/web_form/web_form_list.js:9` — `.web-list-table`. */
	wrapper: JQuery<HTMLElement>;
	/** `frappe/public/js/frappe/web_form/web_form_list.js:33`, filled by `add_filter` — fieldname → value or `["like", "%…%"]`. */
	filters: Record<string, unknown>;
	/** `frappe/public/js/frappe/web_form/web_form_list.js:34`, `:80` — one control per filter field. */
	filter_input: BaseControl[];
	/** `frappe/public/js/frappe/web_form/web_form_list.js:15`, `:297`. */
	rows: WebFormListRow[];
	/** `frappe/public/js/frappe/web_form/web_form_list.js:16`, `:175`. */
	web_list_start: number;
	/** `frappe/public/js/frappe/web_form/web_form_list.js:17` — `10`. */
	page_length: number;
	/** `frappe/public/js/frappe/web_form/web_form_list.js:101-108` — absent when there are no `list_columns`. */
	columns?: WebFormListViewColumn[];
	/** `frappe/public/js/frappe/web_form/web_form_list.js:170` — the fetched records. */
	data?: FrappeDocBase[];
	/** `frappe/public/js/frappe/web_form/web_form_list.js:185`. */
	table?: JQuery<HTMLElement>;
	/** `frappe/public/js/frappe/web_form/web_form_list.js:203`. */
	check_all?: JQuery<HTMLElement>;
	/** `frappe/public/js/frappe/web_form/web_form_list.js:160-163` — the last request's arguments, kept for three seconds. */
	last_args?: string | null;

	/** `frappe/public/js/frappe/web_form/web_form_list.js:14-26` — refetches and redraws from the first page. */
	refresh(): void;
	/** `frappe/public/js/frappe/web_form/web_form_list.js:28-30`. */
	remove_more(): void;
	/** `frappe/public/js/frappe/web_form/web_form_list.js:32-84`. */
	make_filters(): void;
	/** `frappe/public/js/frappe/web_form/web_form_list.js:86-95` — a falsy `value` removes the filter; Data / Currency / Float / Int become a `like`. */
	add_filter(field: string, value: unknown, fieldtype: string): void;
	/** `frappe/public/js/frappe/web_form/web_form_list.js:97-110` — returns `columns` when already built; otherwise builds it and returns `undefined`. */
	get_list_view_fields(): WebFormListViewColumn[] | undefined;
	/**
	 * `frappe/public/js/frappe/web_form/web_form_list.js:112-152` — the
	 * `frappe.call` for the current page, or a promise resolving to `undefined`
	 * when the same request went out in the last three seconds (:146-149).
	 */
	fetch_data(): FrappeAjaxResult | Promise<void>;
	/** `frappe/public/js/frappe/web_form/web_form_list.js:154-165`. */
	no_change(args: Record<string, unknown>): boolean;
	/** `frappe/public/js/frappe/web_form/web_form_list.js:167-172`. */
	get_data(): Promise<void>;
	/** `frappe/public/js/frappe/web_form/web_form_list.js:174-182` — the "Load More" handler. */
	more(): void;
	/** `frappe/public/js/frappe/web_form/web_form_list.js:184-189`. */
	make_table(): void;
	/** `frappe/public/js/frappe/web_form/web_form_list.js:191-215`. */
	make_table_head(): void;
	/** `frappe/public/js/frappe/web_form/web_form_list.js:217-244`. */
	make_table_body(): void;
	/** `frappe/public/js/frappe/web_form/web_form_list.js:246-270`. */
	setup_empty_state(): void;
	/** `frappe/public/js/frappe/web_form/web_form_list.js:272-300`. */
	append_rows(row_data: FrappeDocBase[]): void;
	/** `frappe/public/js/frappe/web_form/web_form_list.js:302-316`. */
	make_actions(): void;
	/** `frappe/public/js/frappe/web_form/web_form_list.js:318-330` — does nothing when a `.${name}` element already exists. */
	add_button(
		wrapper: JQuery<HTMLElement>,
		name: string,
		type: string,
		hidden: boolean,
		text: string,
		action: () => void,
	): void;
	/** `frappe/public/js/frappe/web_form/web_form_list.js:332-339`. */
	create_more(): void;
	/** `frappe/public/js/frappe/web_form/web_form_list.js:341-343`. */
	toggle_select_all(checked: boolean): void;
	/** `frappe/public/js/frappe/web_form/web_form_list.js:345-354` — navigates to the record's form. */
	open_form(name: string): void;
	/** `frappe/public/js/frappe/web_form/web_form_list.js:356-358`. */
	get_selected(): WebFormListRow[];
	/** `frappe/public/js/frappe/web_form/web_form_list.js:360-364`. */
	toggle_delete(): void;
	/** `frappe/public/js/frappe/web_form/web_form_list.js:366-370`. */
	toggle_new(): void;
	/** `frappe/public/js/frappe/web_form/web_form_list.js:372-388`. */
	delete_rows(): void;
}

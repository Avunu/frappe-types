/**
 * frappe-types — group: `frappe-core`
 *
 * Hand-maintained declarations for the frappe **desk JS API** core slice:
 * `frappe.call` / `xcall` / `msgprint` / `throw` / `show_alert` / `confirm` /
 * `prompt` / `boot` / `session` / `db` / `format` / `form.formatters` /
 * `provide` / `get_doc` / `new_doc`, plus the `__()` translation global.
 *
 * Verified against **frappe v16.50.0** (git tag `v16.50.0`, branch `version-16`)
 * at `apps/frappe`. Every non-obvious declaration cites `file:line` so the next
 * version bump can be diffed against the same lines. A citation is the full
 * `frappe/public/js/frappe/<path>.js:NNN` form; a bare `messages.js:NNN` after
 * one means the same file. The doc comments below describe v16.50.0 behaviour
 * (the line numbers were re-read there): notably `frappe.show_alert` is now a
 * thin wrapper over `frappe.ui.toast`, and a session that expires opens a
 * "Session Expired" dialog instead of redirecting at once.
 *
 * Module style on purpose: the package author assembles the ambient globals
 * (`declare global { var frappe: Frappe; interface Window { … } }`) from these
 * exports. The exact global wiring this group implies is written out in
 * {@link FrappeCoreGlobalWiring} below.
 */

// ---------------------------------------------------------------------------
// Cross-group imports
//
// MAINTAINER NOTE — these five names are the only cross-group coupling in this
// file, and they are deliberately re-aliased immediately below so that a naming
// mismatch with the owning group is a five-line fix, not a rewrite.
// ---------------------------------------------------------------------------

import type { DocField, FrappeCheck, FrappeDoc, IndicatorTuple } from "./model";
import type { Dialog } from "./ui/form";
// Type-only import cycles (`./ui/sidebar` and `./utils` both import from here)
// are legal in `.d.ts` files — no emit, no runtime order. Same shape as
// `./ui/form` ↔ `./utils` (see the SEAM note in ui/form.d.ts).
import type {
	FrappeArrangedDockRow,
	FrappeAwesomeBar,
	FrappeDockRow,
	FrappeModuleSidebar,
	FrappeSidebar,
	FrappeSidebarEntityKind,
} from "./ui/sidebar";
import type { FrappeDesktopIconRecord } from "./utils";

/**
 * A `frappe.ui.Dialog` instance. Owned by `ui/form.d.ts`.
 *
 * SEAM — `Dialog` was imported by BOTH files from the other, and declared by
 * NEITHER (TS2303 + TS2459). `ui/form.d.ts` won ownership because
 * `frappe.ui.Dialog extends frappe.ui.FieldGroup extends frappe.ui.form.Layout`
 * (`ui/dialog.js:10`, `ui/field_group.js:5`) — the base class is that
 * fragment's, so the subclass cannot live anywhere else without a second cycle.
 */
export type FrappeDialog = Dialog;

/**
 * The jqXHR returned by `$.ajax` and therefore by {@link FrappeRequest.call}
 * and {@link FrappeCore.call}.
 * Source: `frappe/public/js/frappe/request.js:276` (`return $.ajax(ajax_args)…`).
 *
 * SEAM — `JQueryXHR` was imported from `./globals`, which does not (and must
 * not) export it. It is an AMBIENT global from `@types/jquery`
 * (`node_modules/@types/jquery/legacy.d.ts:16` —
 * `interface JQueryXHR extends JQuery.jqXHR {}`), a real dependency listed in
 * this package's `types`, so it is referenced unqualified.
 */
export type FrappeAjaxResult = JQueryXHR;

/** A jQuery collection. Ambient global from `@types/jquery`; see above. */
export type FrappeJQuery = JQuery;

// ---------------------------------------------------------------------------
// Primitives shared across the desk API
// ---------------------------------------------------------------------------

/**
 * frappe stores Check-fieldtype booleans (and most Python `bool`s that reach the
 * client through a DocField) as `0 | 1`, never `true | false`. Fields typed by
 * this alias were verified to be DocField-backed; fields that come from a Python
 * `bool(...)` call are declared `boolean` instead.
 *
 * COLLISION RESOLVED — `model.d.ts` declared an identical `FrappeCheck`. It wins
 * ownership (the `0 | 1` wire format is a DocField/Check-fieldtype fact, and
 * `model.d.ts` also owns its loose sibling `FrappeCheckLoose`); this file now
 * re-exports that one declaration so a consumer importing `FrappeCheck` from
 * either module gets the same type identity.
 */
export type { FrappeCheck } from "./model";

/**
 * Indicator colour. The literal set is the SCSS `$indicator-colors` list at
 * `frappe/public/scss/common/indicator.scss:61-62` (`amber` and `violet` are the
 * Espresso theme names, added at v16.50.0 beside the legacy ones,
 * indicator.scss:58-60); the open `(string & {})` arm is honest rather than
 * decorative — `frappe.msgprint` writes the value verbatim into the dialog's
 * `indicator <value>` class (`frappe/public/js/frappe/ui/messages.js:303`), so
 * arbitrary strings do reach the DOM. Apps ship their own indicator classes.
 *
 * `frappe.show_alert` is narrower: it lower-cases the value and maps only
 * `green` / `red` / `orange` / `yellow` / `blue` to a toast type, every other
 * value (including the rest of this union) renders as an `info` toast
 * (`frappe/public/js/frappe/ui/messages.js:435-445`).
 */
export type FrappeIndicator =
	| "green"
	| "cyan"
	| "blue"
	| "orange"
	| "yellow"
	| "gray"
	| "grey"
	| "red"
	| "pink"
	| "darkgrey"
	| "purple"
	| "light-blue"
	| "amber"
	| "violet"
	// eslint-disable-next-line @typescript-eslint/ban-types
	| (string & {});

// ---------------------------------------------------------------------------
// Translation — `frappe._` / `window.__`
// ---------------------------------------------------------------------------

/**
 * The `replace` argument of {@link FrappeTranslate}.
 *
 * **Positional only.** `frappe._` forwards this to `$.format`
 * (`frappe/public/js/frappe/translate.js:20-22` → `frappe/public/js/frappe/format.js:1-17`),
 * and `format()` substitutes a placeholder **only when its key parses as a
 * number** (`if (key == +key)`, format.js:12). A named placeholder such as
 * `{name}` falls off the end of that `if`, the replacer returns `undefined`, and
 * `String.prototype.replace` splices the literal text `"undefined"` into the
 * output. Passing a keyed object is therefore a silent data-corruption bug, and
 * the type excludes it on purpose. frappe's own desk JS never passes one.
 *
 * `{}` (empty braces) is supported and consumes the next positional slot
 * (format.js:8-11).
 */
export type FrappeTranslateReplace = readonly unknown[] | null;

/**
 * `window.__` — the desk translation function.
 *
 * Source: `frappe/public/js/frappe/translate.js:5` defines
 * `frappe._ = function (txt, replace, context = null)`, and
 * `frappe/public/js/frappe/translate.js:26` aliases `window.__ = frappe._`.
 *
 * The second overload exists because translate.js:6-7 returns `txt` *unchanged*
 * when it is falsy or not a string — so `__(df.label)` on an optional label
 * really can yield `undefined`, and call sites that interpolate the result into
 * a template literal will render the string `"undefined"`. Declaring a flat
 * `=> string` would hide that.
 *
 * `context` selects a disambiguated message key `` `${txt}:${context}` ``
 * (translate.js:12-14) and falls back to the plain key (translate.js:16-18).
 */
export interface FrappeTranslate {
	(txt: string, replace?: FrappeTranslateReplace, context?: string | null): string;
	(
		txt: string | null | undefined,
		replace?: FrappeTranslateReplace,
		context?: string | null
	): string | null | undefined;
}

// ---------------------------------------------------------------------------
// Messages — msgprint / throw / confirm / prompt / warn / alerts / progress
// ---------------------------------------------------------------------------

/**
 * Primary-action block of a {@link FrappeMsgprintOptions}.
 * Source: `frappe/public/js/frappe/ui/messages.js:226-263`.
 */
export interface FrappeMsgprintPrimaryAction {
	/** Button label; run through `__()` at messages.js:261. */
	label?: string;
	/** Client-side handler. Synthesised from `server_action`/`client_action` when absent. */
	action?: () => void;
	/**
	 * Dotted path of a whitelisted server method. messages.js:227-242 builds an
	 * `action` that `frappe.call`s it with `args`.
	 */
	server_action?: string;
	/**
	 * Dotted path resolved against `window` (messages.js:248-252 walks
	 * `obj = obj[part]`) and invoked with `args` if it turns out to be a function.
	 */
	client_action?: string;
	/** Passed as `args` to `server_action` / `client_action`. Open by design. */
	args?: Record<string, unknown>;
	/** messages.js:236 — close the dialog after a successful `server_action`. */
	hide_on_success?: boolean;
}

/**
 * Secondary-action block of a {@link FrappeMsgprintOptions}.
 * Source: `frappe/public/js/frappe/ui/messages.js:271-276`.
 */
export interface FrappeMsgprintSecondaryAction {
	label?: string;
	action?: () => void;
}

/**
 * Object form of `frappe.msgprint`.
 *
 * Source: `frappe/public/js/frappe/ui/messages.js:133-331`. Detected by
 * `$.isPlainObject(msg)` at messages.js:136; every key below is one the
 * implementation actually reads.
 */
export interface FrappeMsgprintOptions {
	/**
	 * Body. A `string` is the normal case. An **array** is re-entered one element
	 * at a time (messages.js:166-187) — each element may itself be a JSON string
	 * of a message object. `as_list` / `as_table` reinterpret the array as list
	 * rows / table rows before that (messages.js:151-164).
	 */
	message?: string | readonly unknown[] | null;
	title?: string;
	/** Defaults to `"blue"` at messages.js:147-149. */
	indicator?: FrappeIndicator;
	/** messages.js:151-154 — render `message` (an array) as a `<ul>`. */
	as_list?: boolean;
	/** messages.js:156-164 — render `message` (an array of arrays) as a `<table>`. */
	as_table?: boolean;
	/** messages.js:189-192 — divert the whole message to `frappe.show_alert`. */
	alert?: boolean;
	/** messages.js:189-192 — synonym of `alert`. */
	toast?: boolean;
	/** messages.js:194-201 — on hide, route back to the previous route. */
	re_route?: boolean;
	/** messages.js:212 — build the dialog with a minimise control. */
	is_minimizable?: boolean;
	/** messages.js:287-291 — clear the existing message area instead of appending. */
	clear?: boolean;
	/**
	 * messages.js:309-317 — **inverted**: `wide: true` *removes* the
	 * `msgprint-dialog` class (the class is what makes msgprint narrow).
	 */
	wide?: boolean;
	primary_action?: FrappeMsgprintPrimaryAction;
	/** Fallback label when `primary_action.label` is absent (messages.js:261). */
	primary_action_label?: string;
	secondary_action?: FrappeMsgprintSecondaryAction;
}

/**
 * Object form of `frappe.throw`.
 * Source: `frappe/public/js/frappe/ui/messages.js:21-28` — a string is widened to
 * `{ message, title: __("Error") }` and `indicator` defaults to `"red"`.
 */
export interface FrappeThrowOptions extends FrappeMsgprintOptions {
	/** Required: `throw new Error(msg.message)` at messages.js:27. */
	message: string;
}

/**
 * Object form of `frappe.show_alert` / `frappe.toast`.
 * Source: `frappe/public/js/frappe/ui/messages.js:430-505`.
 *
 * At v16.50.0 this is a compatibility layer over `frappe.ui.toast`
 * (`frappe/public/js/frappe/ui/components/toast.js:87`): the three text
 * channels are filled into the toast by `fill()` (messages.js:475-480), which
 * appends a jQuery object or DOM node as it is and passes anything else through
 * `frappe.utils.xss_sanitise` with the `js` strategy plus a strip of `on*`
 * attributes and unsafe-scheme `href`/`src`/`action`/`formaction` values
 * (messages.js:449-470). HTML tags therefore survive (legacy callers pass inline
 * links), script vectors do not. That is why each channel is a union rather
 * than `string`.
 */
export interface FrappeShowAlertOptions {
	/** Main line (messages.js:481). A falsy value renders as an empty line. */
	message: string | FrappeJQuery | Node;
	/** Second line, appended only when truthy (messages.js:482-489). */
	subtitle?: string | FrappeJQuery | Node;
	/**
	 * Lower-cased, then mapped to a toast type: `green` → success, `red` → error,
	 * `orange` / `yellow` → warning, `blue` → info; every other value, and an
	 * absent one (`"blue"`), renders as info (messages.js:435-445).
	 */
	indicator?: FrappeIndicator;
	/** Extra block under the title, appended only when truthy (messages.js:490-497). */
	body?: string | FrappeJQuery | Node;
}

/**
 * Handlers bound with `.on("click", …)` to `[data-action=<key>]` nodes found
 * inside the toast element, i.e. in whatever `message` / `subtitle` / `body`
 * rendered. Source: `frappe/public/js/frappe/ui/messages.js:499-501`.
 */
export type FrappeShowAlertActions = Record<string, (event: unknown) => void>;

// ---------------------------------------------------------------------------
// Requests — frappe.call / frappe.xcall / frappe.request
// ---------------------------------------------------------------------------

/**
 * The envelope every desk AJAX response is parsed into.
 *
 * Source: `frappe/public/js/frappe/request.js:277-326` (`.done` / `.always`) and
 * `frappe/public/js/frappe/request.js:444-523` (`frappe.request.cleanup`).
 *
 * The index signature is not a shrug: a whitelisted method may return any
 * top-level keys it likes, and hooks add more. `message` is the payload.
 */
export interface FrappeResponse<T = unknown> {
	/** Return value of the whitelisted method. What `frappe.xcall` resolves with. */
	message?: T;
	/**
	 * JSON-encoded traceback (`string[]` or `string`). `cleanup` replaces it with
	 * the parsed value **in place** (request.js:492-503) before `always` runs
	 * (request.js:322-325), so `always` receives the parsed array/string while
	 * `callback` (request.js:277-308) and `error` still see the raw string.
	 */
	exc?: string;
	/** Exception class name; keyed into `frappe.request.error_handlers` (request.js:459). */
	exc_type?: string;
	/** JSON-encoded array of message payloads; parsed at request.js:475. */
	_server_messages?: string;
	/** JSON-encoded array; logged at request.js:506-519. */
	_debug_messages?: string;
	/** v2 API only — request.js:472-473 reads `r.messages` instead. */
	messages?: readonly unknown[];
	/** Merged into `frappe._link_titles` (request.js:292-297). */
	_link_titles?: Record<string, string>;
	/** Merged into `frappe._messages` (request.js:287-289). */
	__messages?: Record<string, string>;
	/** Synced into `locals` via `frappe.model.sync` (request.js:282-284). */
	docs?: readonly FrappeDoc[];
	/** Synced alongside `docs` (request.js:282). */
	docinfo?: Record<string, unknown>;
	/** Present for background jobs; triggers the realtime subscribe at request.js:76-82. */
	task_id?: string;
	/**
	 * request.js:417 — a truthy value makes `frappe.request.is_session_expired`
	 * answer `true` regardless of cookies (see {@link FrappeRequest.handle_session_expiry}).
	 */
	session_expired?: boolean | FrappeCheck;
	/**
	 * Set on 403 responses; when present it is shown in a "Not permitted" msgprint
	 * and the response's `_server_messages` is nulled so they are not shown twice
	 * (request.js:149-157).
	 */
	_error_message?: string;
	/** Rendered into the server-error dialog at request.js:651-654. */
	_exc_source?: string;
	[key: string]: unknown;
}

/**
 * Options object accepted by `frappe.call`.
 * Source: `frappe/public/js/frappe/request.js:31-126`.
 */
export interface FrappeCallOptions<TMessage = unknown> {
	/**
	 * Dotted path of the whitelisted method. Becomes `args.cmd` (request.js:71-73)
	 * and then the `/api/method/<cmd>` URL (request.js:91-101). When `doc` is set
	 * this is instead the *document* method name and `cmd` becomes
	 * `run_doc_method` (request.js:64-70).
	 */
	method?: string;
	/** Server arguments. Nested objects/arrays are JSON-stringified at request.js:398-402. */
	args?: Record<string, unknown>;
	/** request.js:83-86 — invoked with the parsed body and the raw response text. */
	callback?: (r: FrappeResponse<TMessage>, response_text?: string) => void;
	/** request.js:113 — invoked on any unhandled failure; argument shape varies by status code. */
	error?: (r?: FrappeResponse<TMessage> | unknown) => void;
	/** request.js:323-325 — invoked with the parsed body (or `null` if unparsable). */
	always?: (r: FrappeResponse<TMessage> | null) => void;
	/** request.js:80-82 — invoked instead of `callback` when the server queued the job. */
	queued?: (r: FrappeResponse<TMessage>) => void;
	/** Defaults to `"POST"` (request.js:110). */
	type?: "GET" | "POST" | "PUT" | "DELETE";
	/** Bypasses the `/api/method/` URL builder entirely (request.js:89-90). */
	url?: string;
	/** `"v2"` switches the URL prefix and the message-extraction path (request.js:92-94, 472-473). */
	api_version?: string;
	/** request.js:62-63 — build `cmd` as `<module>.page.<page>.<page>.<method>`. */
	module?: string;
	/** See `module`. */
	page?: string;
	/** request.js:64-70 — run a controller method on this document. */
	doc?: FrappeDoc;
	/** request.js:392, 446-448 — disabled for the duration of the request. */
	btn?: unknown;
	/** request.js:395 — freeze the page with `frappe.dom.freeze`. */
	freeze?: boolean;
	freeze_message?: string;
	/** request.js:51-53 — alias for `no_spinner`. */
	quiet?: boolean;
	no_spinner?: boolean;
	/** request.js:477 — suppress `_server_messages` msgprints. */
	silent?: boolean;
	/** Extra request headers (request.js:118, 259-266). */
	headers?: Record<string, string>;
	/** Per-request `exc_type` handlers, merged with the global ones (request.js:459-461). */
	error_handlers?: Record<string, (r: FrappeResponse) => void>;
	/** Forwarded to `$.ajax`. `false` makes the call synchronous. */
	async?: boolean;
	/** Forwarded to `$.ajax`; forced to `false` when `window.dev_server` (request.js:267). */
	cache?: boolean;
	/**
	 * Milliseconds. When a structurally identical request was sent inside the
	 * window, `frappe.call` short-circuits and returns `Promise.resolve()`
	 * instead of a jqXHR (request.js:105-107).
	 */
	debounce?: number;
}

/**
 * Options accepted by `frappe.request.call` — the lower layer. `frappe.call`
 * builds one of these (request.js:109-125) and `frappe.request.prepare`
 * (request.js:388-414) renames `success`/`error` to `success_callback`/
 * `error_callback` **in place**, which is why both spellings appear here.
 */
export interface FrappeRequestCallOptions {
	url?: string;
	type?: string;
	args: Record<string, unknown>;
	dataType?: string;
	async?: boolean;
	cache?: boolean;
	headers?: Record<string, string>;
	error_handlers?: Record<string, (r: FrappeResponse) => void>;
	silent?: boolean;
	api_version?: string;
	btn?: unknown;
	freeze?: boolean;
	freeze_message?: string;
	success?: (data: FrappeResponse, response_text?: string) => void;
	error?: (r?: unknown) => void;
	always?: (r: FrappeResponse | null) => void;
	/** Installed by `frappe.request.prepare` (request.js:410-413). */
	success_callback?: (data: FrappeResponse, response_text?: string) => void;
	/** Installed by `frappe.request.prepare` (request.js:410-413). */
	error_callback?: (r?: unknown, response_text?: string) => void;
}

/**
 * `frappe.request` — the low-level AJAX namespace.
 * Source: `frappe/public/js/frappe/request.js:6-11, 128-679`.
 */
export interface FrappeRequest {
	/** request.js:8 — `"/"`. Prefixed to the URL only under Cordova (request.js:96-100). */
	url: string;
	/** request.js:9, 681-693 — in-flight `$.ajax` count, maintained by global handlers. */
	ajax_count: number;
	/** request.js:10 — callbacks drained when `ajax_count` reaches zero. */
	waiting_for_ajax: Array<() => void>;
	/** request.js:11, 365-385 — per-`cmd` debounce log. */
	logs: Record<string, Array<{ args: Record<string, unknown>; timestamp: Date }>>;
	/** request.js:7, 459, 676-679 — global handlers keyed by `exc_type`. */
	error_handlers: Record<string, Array<(r: FrappeResponse) => void>>;
	call(opts: FrappeRequestCallOptions): FrappeAjaxResult;
	/** request.js:365 — true when an identical request was sent within `threshold` ms. */
	is_fresh(args: Record<string, unknown>, threshold: number): boolean;
	/** request.js:388 — mutates `opts`; throws the string `"Incomplete Request"` on a missing cmd. */
	prepare(opts: FrappeRequestCallOptions): void;
	/**
	 * request.js:416-428 — `true` when `response.session_expired` is truthy, or
	 * when the page was once logged in (`frappe.session.logged_in_user` set and not
	 * `"Guest"`) and either the `user_id` cookie is missing / `"Guest"` or
	 * `frappe.session.user` is `"Guest"`. Replaces the old
	 * `session.user === "Guest" && logged_in_user !== "Guest"` test.
	 */
	is_session_expired(response?: FrappeResponse | null): boolean;
	/**
	 * request.js:430-442 — returns `false` (the caller carries on with its normal
	 * handlers) when `frappe.app` does not exist yet, or when no expiry dialog is
	 * open and {@link FrappeRequest.is_session_expired} is false. Otherwise calls
	 * `frappe.app.handle_session_expired()` and returns `true`; once that dialog
	 * is open, every later response also takes this path. Called from the 401 and
	 * 403 handlers (request.js:136, :148) and from `cleanup` (request.js:456).
	 */
	handle_session_expiry(response?: FrappeResponse | null): boolean;
	/**
	 * request.js:444-523 — un-freezes, then (unless `handle_session_expiry` took
	 * over) dispatches error handlers, shows server messages, logs `exc` / debug
	 * output and stores `frappe.last_response`. `hide_msgprint` is skipped when
	 * every server message is an alert/toast (request.js:480-486).
	 */
	cleanup(opts: FrappeRequestCallOptions, r: FrappeResponse | null): void;
	/** request.js:551 — opens the "Server Error" dialog. */
	report_error(xhr: unknown, request_opts: FrappeRequestCallOptions): void;
	/** request.js:661 — masks password fields in `args` before the error report. */
	cleanup_request_opts(opts: FrappeRequestCallOptions): FrappeRequestCallOptions;
	/** request.js:676 — append a global handler for an `exc_type`. */
	on_error(error_type: string, handler: (r: FrappeResponse) => void): void;
}

// ---------------------------------------------------------------------------
// frappe.db
// ---------------------------------------------------------------------------

/**
 * Filters accepted by `frappe.db` / `frappe.client.*`.
 * The tuple form is `[fieldname, operator, value]`, or
 * `[doctype, fieldname, operator, value]` when a child table is involved
 * (see `frappe.db.count`'s `distinct` detection, `frappe/public/js/frappe/db.js:115-119`,
 * which inspects `filter[0]` as a doctype).
 */
export type FrappeFilters =
	| Record<string, unknown>
	| ReadonlyArray<readonly [string, string, unknown] | readonly [string, string, string, unknown]>;

/** Arguments for `frappe.db.get_list`. Source: `frappe/public/js/frappe/db.js:5-26`. */
export interface FrappeDbGetListArgs {
	/** db.js:10-12 — defaults to `["name"]`. */
	fields?: readonly string[];
	filters?: FrappeFilters;
	or_filters?: FrappeFilters;
	/** db.js:13-15 — defaults to `20`. */
	limit?: number;
	limit_start?: number;
	order_by?: string;
	group_by?: string;
	parent?: string;
	/** Overwritten with the positional `doctype` at db.js:9. */
	doctype?: string;
	[key: string]: unknown;
}

/**
 * `frappe.db` — thin promise wrappers over the `frappe.client.*` and
 * `frappe.desk.reportview.*` whitelisted methods.
 * Source: `frappe/public/js/frappe/db.js:4-153`.
 *
 * Note the inconsistent return contract, which is upstream's, not ours:
 * `get_list` / `get_single_value` / `get_doc` / `exists` / `delete_doc` /
 * `get_link_options` return a `Promise`, while `get_value` and `set_value`
 * return the raw jqXHR from `frappe.call` and deliver the payload through the
 * `callback` argument.
 */
export interface FrappeDb {
	/** db.js:5 → `frappe.desk.reportview.get_list` (GET). */
	get_list<T = Record<string, unknown>>(
		doctype: string,
		args?: FrappeDbGetListArgs
	): Promise<T[]>;
	/**
	 * db.js:27 — a string is looked up by `name`, an object (a filter dict, or a
	 * filter list: `typeof [] === "object"`) is counted with `limit: 1`. Any other
	 * type leaves the promise **permanently pending** (db.js:29-40 has no `else`);
	 * that is upstream behaviour, not a typo here.
	 */
	exists(doctype: string, nameOrFilters: string | FrappeFilters): Promise<boolean>;
	/** db.js:42 → `frappe.client.get_value` (GET). Payload arrives via `callback`. */
	get_value<T = Record<string, unknown>>(
		doctype: string,
		filters: string | FrappeFilters,
		fieldname: string | readonly string[],
		callback?: (message: T | undefined) => void,
		parent_doc?: string
	): FrappeAjaxResult;
	/** db.js:57 → `frappe.client.get_single_value` (GET). */
	get_single_value<T = unknown>(doctype: string, field: string): Promise<T | null>;
	/** db.js:68 → `frappe.client.set_value`. Payload arrives via `callback`. */
	set_value(
		doctype: string,
		docname: string,
		fieldname: string | Record<string, unknown>,
		value?: unknown,
		callback?: (message: FrappeDoc | undefined) => void
	): FrappeAjaxResult;
	/** db.js:82 → `frappe.client.get` (GET); also `frappe.model.sync`s the result. */
	get_doc<T extends FrappeDoc = FrappeDoc>(
		doctype: string,
		name?: string | null,
		filters?: FrappeFilters
	): Promise<T>;
	/** db.js:97 → `frappe.client.insert` via `frappe.xcall`. */
	insert<T extends FrappeDoc = FrappeDoc>(doc: Partial<FrappeDoc> & { doctype: string }): Promise<T>;
	/** db.js:100 → `frappe.client.delete`; also clears `locals` on success. */
	delete_doc(doctype: string, name: string): Promise<unknown>;
	/** db.js:110 → `frappe.desk.reportview.get_count`. `cache: true` switches it to GET. */
	count(
		doctype: string,
		args?: { filters?: FrappeFilters; limit?: number },
		cache?: boolean
	): Promise<number>;
	/** db.js:136 → `frappe.desk.search.search_link` (GET). */
	get_link_options(
		doctype: string,
		txt?: string,
		filters?: FrappeFilters,
		page_length?: number
	): Promise<Array<{ value: string; label?: string; description?: string }>>;
}

/**
 * Argument shapes of the two whitelisted server methods this codebase calls
 * directly through `frappe.xcall`, transcribed from the Python signatures so a
 * typo in a `params` object is caught at compile time.
 *
 * Source: `frappe/client.py:26-40` (`get_list`) and `frappe/client.py:220-228`
 * (`insert`). Note `limit_page_length` — *not* `limit` — is the server-side
 * spelling; `frappe.db.get_list`'s `limit` is translated by
 * `frappe.desk.reportview.get_list`, a different endpoint.
 */
export interface FrappeClientGetListArgs {
	doctype: string;
	fields?: string | ReadonlyArray<string | Record<string, unknown>>;
	filters?: string | FrappeFilters;
	or_filters?: string | FrappeFilters;
	group_by?: string | readonly string[];
	order_by?: string | readonly string[];
	limit_start?: number | string;
	/** `frappe/client.py:34` — defaults to `20`; `0` means "no limit". */
	limit_page_length?: number | string;
	parent?: string;
	debug?: boolean | FrappeCheck;
	as_dict?: boolean | FrappeCheck;
	expand?: string | readonly string[];
}

/** Source: `frappe/client.py:221`. */
export interface FrappeClientInsertArgs {
	doc: Partial<FrappeDoc> & { doctype: string };
}

/**
 * `GET /api/method/frappe.auth.get_logged_user`.
 * Source: `frappe/auth.py:451-452` — returns `frappe.session.user`, so `"Guest"`
 * for an unauthenticated session rather than an error.
 */
export interface FrappeGetLoggedUserResponse {
	message: string;
}

// ---------------------------------------------------------------------------
// Formatters — frappe.form.formatters / frappe.format
// ---------------------------------------------------------------------------

/**
 * Third argument of every formatter and of `frappe.format`.
 * Source: keys read at `frappe/public/js/frappe/form/formatters.js:12, 71, 158,
 * 182, 213`. `frappe.format(value, df, null, doc)` is legal
 * (`frappe/public/js/frappe/list/list_view.js:1459`), hence the `| null` on the
 * parameters below.
 *
 * `1` / `0` appear alongside `true` / `false` at real call sites
 * (`{ inline: 1 }` formatters.js:470, `{ only_value: 1 }` filter.js:565), so the
 * flags are widened rather than declared `boolean`.
 */
export interface FrappeFormatterOptions {
	/** formatters.js:12 — return the bare value instead of the right-aligned wrapper. */
	inline?: boolean | FrappeCheck;
	/** formatters.js:12, 158, 182 — return the unwrapped, unlinked value. */
	only_value?: boolean | FrappeCheck;
	/** formatters.js:71 — keep trailing zeros on a Float (otherwise a whole-number Float renders at precision 0). */
	always_show_decimals?: boolean | FrappeCheck;
	/** formatters.js:182 — render a Link as plain text. */
	for_print?: boolean | FrappeCheck;
	/** formatters.js:213 — override the anchor text of a Link. */
	label?: string;
	/** Read by control code rather than by formatters.js; kept for call-site parity. */
	no_icon?: boolean;
	[key: string]: unknown;
}

/**
 * The call shape `frappe.format` uses to invoke whichever formatter it picked
 * (`frappe/public/js/frappe/form/formatters.js:456`). Every member of
 * {@link FrappeFormatters} is invoked through this shape, which is why the
 * members below are declared as *methods* (bivariant parameters) — a consumer
 * wrapping `formatters.Date` with a `(...args: unknown[])` shim must typecheck.
 */
export type FrappeFormatter = (
	value: unknown,
	df?: DocField,
	options?: FrappeFormatterOptions | null,
	doc?: FrappeDoc
) => string | number;

/**
 * A `frappe.form.link_formatters[doctype]` entry.
 * Source: `frappe/public/js/frappe/form/formatters.js:186-190` (call site) and
 * `formatters.js:477-480` (the built-in `"User"` entry).
 */
export type FrappeLinkFormatter = (
	value: string,
	doc: FrappeDoc | undefined,
	docfield: DocField | undefined
) => string;

/**
 * `frappe.form.formatters` — the fieldtype → renderer table.
 *
 * Source: `frappe/public/js/frappe/form/formatters.js:10-416`. Keys are
 * fieldtypes with spaces stripped (`frappe.form.get_formatter`, formatters.js:432).
 *
 * Return types are transcribed, not guessed. Several members can return a
 * **number**: `_right` passes its input straight through when
 * `options.inline || options.only_value` (formatters.js:11-17), so `Int`,
 * `Float`, `Percent` and `Currency` inherit that; `FileSize` returns a raw
 * `cint` below 1 KiB (formatters.js:379).
 *
 * `Data` / `Text` / `SmallText` are declared `string` even though
 * `_apply_custom_formatter` (formatters.js:18-35) will hand back whatever a
 * user-installed `frappe.meta.docfield_map[dt][fn].formatter` returns. That
 * escape hatch is per-site JS with no static contract; treating it as `unknown`
 * would poison every list/report render path for a hook almost nobody installs.
 */
export interface FrappeFormatters {
	/**
	 * formatters.js:11 — right-align wrapper. Returns `value` **unchanged** (any
	 * type) under `inline`/`only_value`, otherwise a `<div style='text-align:
	 * right'>` string. carbon_frappe wraps this to add a `carbon-num` class.
	 */
	_right(value: unknown, options?: FrappeFormatterOptions | null): unknown;
	/** formatters.js:18 — applies a per-site `df.formatter` from `frappe.meta.docfield_map`. */
	_apply_custom_formatter(value: unknown, df?: DocField): unknown;

	Data(value: unknown, df?: DocField): string;
	Autocomplete(value: unknown, df?: DocField): string;
	Select(value: unknown, df?: DocField): string;
	Float(
		value: unknown,
		docfield: DocField,
		options?: FrappeFormatterOptions | null,
		doc?: FrappeDoc
	): string | number;
	Int(value: unknown, docfield: DocField, options?: FrappeFormatterOptions | null): string | number;
	Percent(
		value: unknown,
		docfield: DocField,
		options?: FrappeFormatterOptions | null
	): string | number;
	/** formatters.js:107 — `docfield.options` is the star count (default 5). */
	Rating(value: unknown, docfield: DocField): string;
	Currency(
		value: unknown,
		docfield: DocField,
		options?: FrappeFormatterOptions | null,
		doc?: FrappeDoc
	): string | number;
	/** formatters.js:164 — a disabled `<input type=checkbox>`, never a boolean. */
	Check(value: unknown): string;
	Link(
		value: unknown,
		docfield: DocField,
		options?: FrappeFormatterOptions | null,
		doc?: FrappeDoc
	): string;

	/**
	 * formatters.js:222 / :246 / :276 — the three date/time formatters share one
	 * signature deliberately: carbon_frappe iterates
	 * `for (const type of ["Date", "Datetime", "Time"]) { const orig = f[type]; … }`
	 * (`carbon_desk.bundle.ts:67-74`), and a *uniform* signature is what keeps
	 * `f[type]` a single function type instead of an unusable union.
	 *
	 * `Date` returns `value` untouched when `frappe.datetime.str_to_user` has not
	 * loaded yet (formatters.js:223-225).
	 */
	Date(value: string | null | undefined): string;
	Datetime(value: string | null | undefined): string;
	Time(value: string | null | undefined): string;

	/** formatters.js:236 — an array is rendered as `"{0} to {1}"`. */
	DateRange(value: readonly string[] | string | null | undefined): string;
	Text(value: unknown, df?: DocField): string;
	/** formatters.js:283 — falls back to the literal `"0s"`. */
	Duration(value: unknown, docfield: DocField): string;
	/** formatters.js:291 — `value` is a JSON-encoded array of user ids. */
	LikedBy(value: string | null | undefined): string;
	/** formatters.js:298 — `value` is a comma-separated tag list. */
	Tag(value: string | null | undefined): string;
	/** formatters.js:314 — identity. */
	Comment(value: unknown): unknown;
	/** formatters.js:317 — `value` is a JSON-encoded array of user ids. */
	Assign(value: string | null | undefined): string;
	SmallText(value: unknown): string;
	TextEditor(value: unknown): string;
	Code(value: unknown): string;
	/** formatters.js:349 — reads the `Workflow State` doc out of `locals`. */
	WorkflowState(value: string): string;
	Email(value: unknown): string;
	/** formatters.js:372 — returns a raw `cint` below 1 KiB, `"1.23M"`/`"4.56K"` above. */
	FileSize(value: unknown): string | number;
	/** formatters.js:381 — `rows` are the child rows of a Table MultiSelect field. */
	TableMultiSelect(
		rows: ReadonlyArray<Record<string, unknown>> | null | undefined,
		df: DocField,
		options?: FrappeFormatterOptions | null
	): string;
	Color(value: string | null | undefined): string;
	Icon(value: string | null | undefined): string;
	/** formatters.js:414-415, 425-428 — both alias the same `format_attachment_url`. */
	Attach(url: string | null | undefined): string;
	AttachImage(url: string | null | undefined): string;

	/**
	 * Fieldtypes are open: apps register their own by assigning here, and
	 * `get_formatter` (formatters.js:432) does a plain index lookup. Declared
	 * members above stay exact; anything else is a formatter or nothing.
	 */
	[fieldtype: string]: unknown;
}

/**
 * `frappe.form` — the whole namespace, which is exactly three members at
 * v16.50.0 (re-verified by grepping `frappe.form.` across `frappe/public/js`).
 * Created by `frappe.provide("frappe.form.formatters")` at
 * `frappe/public/js/frappe/form/formatters.js:6`.
 *
 * Not to be confused with `frappe.ui.form` (controls, `ControlTable`, quick
 * entry), which belongs to `frappe-ui-form`.
 */
export interface FrappeFormNamespace {
	/** formatters.js:10. */
	formatters: FrappeFormatters;
	/** formatters.js:8, populated at formatters.js:477 for `"User"`. */
	link_formatters: Record<string, FrappeLinkFormatter | undefined>;
	/**
	 * formatters.js:430 — strips spaces from `fieldtype` and falls back to
	 * `formatters.Data`. A missing/empty `fieldtype` is coerced to `"Data"`.
	 */
	get_formatter(fieldtype?: string | null): FrappeFormatter;
}

// ---------------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------------

/**
 * `frappe.boot.sysdefaults` — the Global Defaults / DefaultValue table, flattened.
 *
 * Source: `frappe/boot.py:49-50`
 * (`bootinfo.sysdefaults = frappe.defaults.get_defaults()`, then
 * `sysdefaults["setup_complete"] = frappe.is_setup_complete()`).
 *
 * It is an **open** map: keys are `DefaultValue.defkey` rows
 * (`frappe/defaults.py:235-267`), so every installed app contributes its own.
 * Values are `defvalue` strings, or a **`string[]`** when one key has several
 * rows (`frappe/defaults.py:254-260` listifies duplicates) — a trap worth typing.
 */
export interface FrappeBootSysDefaults {
	/** ERPNext's default company. Not set on a bare frappe site. */
	company?: string;
	/** e.g. `"yyyy-mm-dd"`. Read unguarded at `frappe/public/js/frappe/desk.js:376`. */
	date_format?: string;
	/** e.g. `"HH:mm:ss"`. `frappe/public/js/frappe/form/formatters.js:251` falls back to that literal. */
	time_format?: string;
	country?: string;
	/** Read back out at `frappe/boot.py:462` (`add_timezone_info`). */
	time_zone?: string;
	/** Digits after the decimal point; read through `cint()` at `frappe/public/js/frappe/form/formatters.js:63`. */
	float_precision?: string;
	currency_precision?: string;
	currency?: string;
	/** `frappe/defaults.py:116` — `defaults.update(user=user, owner=user)`. */
	user?: string;
	owner?: string;
	/**
	 * A real `boolean`: `frappe/boot.py:50` assigns `frappe.is_setup_complete()`,
	 * which returns a Python `bool` (`frappe/__init__.py:1540-1554`) — **not** the
	 * `0 | 1` a DocField Check would give.
	 */
	setup_complete?: boolean;
	[key: string]: string | readonly string[] | boolean | undefined;
}

/**
 * One entry of `frappe.boot.app_data` — an installed app as the desk knows it.
 * Source: `frappe/boot.py:275-380` (`get_app_data`, called at `frappe/boot.py:272`).
 *
 * **The 16.33 shape is gone.** `modules` (the app's Module Defs) and
 * `workspaces` (the workspace names the user may see) no longer exist: an app's
 * navigation is its **dock**, the rows of the `Dock` record it ships, filtered by
 * reach (`frappe/boot.py:327-332`). Which workspaces belong to an app is
 * answered by `frappe.boot.module_sidebars[<shell>].workspaces` through the
 * shell's `app` — see `Sidebar.get_sidebar_app`.
 *
 * An app the user may not use (its `add_to_apps_screen.has_permission` hook says
 * no) still gets an entry, so things that name it can label it, but with
 * `on_apps_screen: false`, empty routes and an empty `dock`
 * (`frappe/boot.py:302-325`).
 *
 * `app_logo_url` is `string | string[] | null`, not `string`: `app_info.get("logo")`
 * is a string, but the hook fallback `frappe.get_hooks("app_logo_url", …)`
 * returns a **list** (`frappe/boot.py:373-375`; an app that ships a light and a
 * dark mark lists both), and `null` when the app declares neither, so the desk
 * draws an alphabet icon instead. Readers take the first element
 * (`frappe/public/js/frappe/utils/utils.js:1379-1391`,
 * `frappe/public/js/frappe/ui/sidebar/sidebar_header.js:209-211`).
 */
export interface FrappeBootAppEntry {
	/** `frappe/boot.py:343`. */
	app_name: string;
	/** `frappe/boot.py:344-352` — the hook's title, else `app_title`, else the app name. */
	app_title: string;
	/**
	 * `frappe/boot.py:339` — whether the app opts into the apps screen through the
	 * `add_to_apps_screen` hook. An app that pins into a host app's dock
	 * (`frappe.boot.app_rail_host`) never takes a slot of its own, whatever its
	 * hook says.
	 */
	on_apps_screen: boolean;
	/** `frappe/boot.py:342` — apps-screen sort order, lower first; `100` when undeclared (`frappe/boot.py:217,342`), Framework declares `1000` (`frappe/hooks.py:581`). */
	sequence_id: number;
	/**
	 * `frappe/boot.py:359-364` — the hook's `route`, else the `app_home` hook, else
	 * `""`. 16.33 fell back to the app's first workspace; that guess is gone, and
	 * the client resolves the rest late (`Sidebar.app_landing_route`).
	 */
	app_route: string;
	/**
	 * `frappe/boot.py:370` — a non-desk app's door back into the desk (its
	 * configuration screens), or `""`. A literal route, neither resolved nor
	 * permission-checked server-side.
	 */
	desk_route: string;
	/** `frappe/boot.py:373-375` — see the hazard note above. */
	app_logo_url: string | readonly string[] | null;
	/**
	 * `frappe/boot.py:332,376` — the entries this app's rail **offers** this user
	 * (`get_app_entry_set`, `frappe/desk/doctype/dock/dock.py:777-784`), before the
	 * arrangement in `frappe.boot.dock` orders and hides them.
	 */
	dock: FrappeDockRow[];
}

/**
 * `frappe.boot.workspaces.pages[]` — one Workspace the user may see
 * (`get_workspaces`, `frappe/desk/desktop.py:430-524`). Only the members the
 * desk's shell reads are named; the rest of the 16 columns selected at
 * `frappe/desk/desktop.py:457-474` (`for_user`, `parent_page`, `content`,
 * `is_hidden`, `sequence_id`, `type`, `link_type`, …) arrive too and fall under
 * the index signature.
 */
export interface FrappeBootWorkspacePage {
	/** `frappe/desk/desktop.py:458` — for a private page this carries the owner (`<title>-<user>`). */
	name: string;
	/** `frappe/desk/desktop.py:459`. */
	title: string;
	/** `frappe/desk/desktop.py:498` — `_(name)`, translated. */
	label: string;
	/** `frappe/desk/desktop.py:464`. */
	module: string | null;
	/** `frappe/desk/desktop.py:465`. */
	icon: string | null;
	/**
	 * `frappe/desk/desktop.py:504` — **derived** from the module's placement,
	 * never stored (there is no `Workspace.app`); `null` for a module no app lists.
	 */
	app: string | null;
	/** `frappe/desk/desktop.py:463` — `1` for a public page. */
	public: FrappeCheck;
	[key: string]: unknown;
}

/**
 * `frappe.boot.workspaces` — `frappe/desk/desk_views.py:38` (`DeskViews.add_to_boot`)
 * from `get_workspaces` (`frappe/desk/desktop.py:430-524`). Replaced wholesale
 * when a workspace is saved (`frappe/public/js/frappe/views/workspace/workspace.js:955`).
 */
export interface FrappeBootWorkspaces {
	pages: FrappeBootWorkspacePage[];
	/** `frappe/desk/desktop.py:443` — whether the user is a Workspace Manager. */
	has_access: boolean;
	/** `frappe/desk/desktop.py:522` — `frappe.has_permission("Workspace", ptype="create")`. */
	has_create_access: boolean;
}

/**
 * One value of `frappe.boot.allowed_reports` — a Report the user may open, keyed
 * by report name (`DeskViews.get_user_pages_or_reports`,
 * `frappe/desk/desk_views.py:135-253`). Every surviving row carries `report_type`
 * (a row the user cannot read is popped, `frappe/desk/desk_views.py:249-251`).
 */
export interface FrappeBootAllowedReport {
	/** `frappe/desk/desk_views.py:214` — the report's `modified`. */
	modified: string;
	/** `frappe/desk/desk_views.py:159` — the report's name. */
	title: string;
	/** `frappe/desk/desk_views.py:159` — lets the client resolve a report's home sidebar. */
	module: string | null;
	/** `frappe/desk/desk_views.py:216`. */
	ref_doctype: string | null;
	/** `frappe/desk/desk_views.py:247`. */
	report_type: string;
}

/**
 * `frappe.boot.user` — the current user, denormalised.
 * Source: `frappe/utils/user.py:227-294` (`UserPermissions.load_user`), plus
 * `frappe/sessions.py:184` (`impersonated_by`),
 * `frappe/public/js/frappe/desk.js:380` (`last_selected_values`, set client-side)
 * and `frappe/public/js/frappe/desk.js:297-314` (`all_reports`, a client-side
 * alias).
 */
export interface FrappeBootUser {
	/** The user id / email. `frappe/utils/user.py:266`. */
	name: string;
	email: string;
	first_name?: string;
	last_name?: string;
	language?: string | null;
	/** `"Light"` | `"Dark"` | `"Automatic"` — the User DocType's Select options. */
	desk_theme?: string;
	code_editor_type?: string;
	email_signature?: string | null;
	user_type?: string;
	creation?: string;
	/** Check fieldtypes on the User DocType. */
	document_follow_notify?: FrappeCheck;
	mute_sounds?: FrappeCheck;
	send_me_a_copy?: FrappeCheck;
	/** `frappe/utils/user.py:244` — new at v16.50.0. */
	send_read_receipt?: FrappeCheck;
	show_absolute_datetime_in_timeline?: FrappeCheck;
	/** `frappe/utils/user.py:267` — `frappe.parse_json` of the stored JSON. */
	onboarding_status?: Record<string, unknown> | null;
	/** `frappe/utils/user.py:255-264` — expanded from a name into `{name, public, title}`, or `null`. */
	default_workspace?: { name: string; public?: FrappeCheck; title?: string } | null;
	/** `frappe/utils/user.py:268` — role names. */
	roles: string[];
	/** `frappe/utils/user.py:269` — same shape as {@link FrappeBootSysDefaults}, user-scoped. */
	defaults: FrappeBootSysDefaults;
	/** `frappe/utils/user.py:270-290` — permission caches, each a de-duplicated list of doctype names. */
	can_select: string[];
	can_create: string[];
	can_write: string[];
	can_read: string[];
	can_submit: string[];
	can_cancel: string[];
	can_delete: string[];
	can_get_report: string[];
	can_search: string[];
	can_export: string[];
	/**
	 * `frappe/utils/user.py:284` — the subset of {@link can_export} the user may
	 * export only for documents they own (`if_owner`). Always `[]` for a System
	 * Manager (`frappe/utils/user.py:201-202`). New at v16.50.0.
	 */
	can_export_owner_only: string[];
	can_import: string[];
	can_print: string[];
	can_email: string[];
	allow_modules: string[];
	permitted_modules: string[];
	in_create: string[];
	all_read: string[];
	/**
	 * **Not in the server payload any more** — `frappe/utils/user.py:292-294` drops
	 * it (it duplicated `frappe.boot.allowed_reports`, ~47 KB per boot).
	 * `frappe.Application.alias_removed_boot_keys` defines it as a getter on
	 * `frappe.boot.user` that returns {@link FrappeBoot.allowed_reports} — the very
	 * same object — and logs a `console.warn` the first time it is read
	 * (`frappe/public/js/frappe/desk.js:297-314`). Frappe plans to delete the
	 * alias a release after it ships.
	 *
	 * @deprecated Read `frappe.boot.allowed_reports` instead.
	 */
	all_reports: Record<string, FrappeBootAllowedReport>;
	/** `frappe/sessions.py:184` — set only while impersonating. */
	impersonated_by?: string | null;
	/** Created client-side at `frappe/public/js/frappe/desk.js:380`. */
	last_selected_values?: Record<string, unknown>;
}

/**
 * `frappe.boot` — the server-rendered bootstrap blob.
 *
 * Assigned as a raw JSON literal in the desk page itself:
 * `frappe/www/desk.html:66` (`frappe.boot = {{ frappe.utils.orjson_dumps(boot, …) }};`).
 * Built by `frappe/boot.py:34-141` (`get_bootinfo`) and extended by
 * `frappe/sessions.py:126-191` (`get`).
 *
 * The index signature is load-bearing, not laziness: `frappe/boot.py:102-103`
 * runs every `boot_session` hook and `frappe/sessions.py:170-171` every
 * `extend_bootinfo` hook, so any installed app can add top-level keys (ERPNext
 * adds a dozen). Named members stay exact.
 *
 * **Consumer hazard.** `const boot = (window.frappe && frappe.boot) || {};`
 * infers `FrappeBoot | {}` and every subsequent property read fails under
 * `strict`. Annotate the binding instead:
 * `const boot: FrappeBootPartial = (window.frappe && frappe.boot) || {};`
 * — `{}` is assignable to a `Partial`, and each read then yields `T | undefined`,
 * which is exactly what the `&&` guards downstream already assume.
 *
 * **Navigation is keyed by shell now.** 16.33's `workspace_sidebar_item`,
 * `module_wise_workspaces`, `modules` and `module_list` are gone, replaced by
 * {@link module_sidebars}, {@link entity_module}, {@link canonical_shell},
 * {@link home_shell}, {@link dock} and {@link app_rail_host}
 * (`frappe/boot.py:226-272`). `marketplace_apps` and `changelog_feed` are also
 * gone.
 */
export interface FrappeBoot {
	/** `frappe/boot.py:49`. Always present server-side. */
	sysdefaults: FrappeBootSysDefaults;
	/** `frappe/boot.py:272`. Always an array (possibly empty); see {@link FrappeBootAppEntry}. Replaced wholesale when a workspace is saved (`frappe/public/js/frappe/views/workspace/workspace.js:962`). */
	app_data: FrappeBootAppEntry[];
	/** `frappe/boot.py:44` → `frappe/utils/user.py:227`. */
	user: FrappeBootUser;
	/**
	 * `frappe/boot.py:426` (`bootinfo["lang"] = frappe.lang`) and
	 * `frappe/sessions.py:173`. Coerced to `str` at `frappe/boot.py:105-106`.
	 * Used as an index into the datatable translation table
	 * (`frappe/public/js/frappe/views/reports/report_view.js:309`).
	 */
	lang: string;
	/** `frappe/boot.py:113` — `{ language_name: language_code }`. */
	lang_dict: Record<string, string>;
	/** `frappe/boot.py:427` — the translation dictionary; copied to `frappe._messages` (`frappe/www/desk.html:67`). */
	__messages: Record<string, string>;
	/** `frappe/boot.py:48` — `frappe.local.site`. */
	sitename: string;
	/** `frappe/boot.py:52` — `YYYY-MM-DD`. */
	server_date: string;
	/** `frappe/boot.py:107` — `{ app_name: version }`. */
	versions: Record<string, string>;
	/** `frappe/boot.py:167` — bytes. `frappe/public/js/frappe/request.js:192` falls back to 5242880. */
	max_file_size: number;
	/** `frappe/sessions.py:167` — merged `assets.json` + `assets-rtl.json`; see {@link FrappeAssetsJson}. */
	assets_json: FrappeAssetsJson;
	/** `frappe/sessions.py:168` — `bool(frappe.flags.read_only)`, a real boolean. */
	read_only: boolean;
	/** `frappe/sessions.py:176` — `frappe.is_setup_complete()`, a real boolean. */
	setup_complete: boolean;
	/** `frappe/sessions.py:183` — `"Light"` | `"Dark"` | `"Automatic"`. */
	desk_theme: string;
	/** `frappe/sessions.py:185` — the Navbar Settings single doc. */
	navbar_settings: Record<string, unknown>;
	/** `frappe/sessions.py:158-160`, only present on a live request after a cache clear. */
	change_log?: unknown[];
	/** `frappe/sessions.py:162-164`. Compared with `localStorage.metadata_version` at `frappe/public/js/frappe/desk.js:360`. */
	metadata_version: string;
	/**
	 * `frappe/sessions.py:174` — the `disable_async` site-config value passed
	 * through untouched, so `null` when unset. Only its truthiness is ever
	 * tested, which is why it is not narrowed to `boolean`.
	 */
	disable_async: unknown;
	/** `frappe/boot.py:121` — resolved through website settings, then Navbar Settings, then the `app_logo_url` hook (`frappe/core/doctype/navbar_settings/navbar_settings.py:28-41`). */
	app_logo_url: string;
	/** `frappe/boot.py:62-63`. */
	active_domains: string[];
	all_domains: string[];
	/** `frappe/boot.py:75-77` — doctype-name lists. */
	single_types: string[];
	nested_set_doctypes: string[];
	tree_view_doctypes: string[];
	/**
	 * `frappe/boot.py:67` (`get_boot_module_app`, `frappe/boot.py:174-189`) —
	 * `{ scrubbed_module_name: app_name }`. Extended at boot with Module Defs that
	 * exist only in the database, which `frappe.local.module_app` misses.
	 */
	module_app: Record<string, string>;
	/** `frappe/boot.py:78`, `frappe/boot.py:443-458` — the landing route name; `"desktop"` when unresolvable. */
	home_page: string;
	/** `frappe/boot.py:98` — `Page` / `Print Settings` / country / currency docs, synced into `locals`. */
	docs: FrappeDoc[];
	/**
	 * `frappe/boot.py:61`, `frappe/boot.py:151-161` — `{ letter_head_name: { header, footer } }`.
	 * Both keys are always set (`frappe/boot.py:157-159`); an unset column is
	 * `null`, and `footer` very often is. `{}` for a user with no Letter Head
	 * permission.
	 */
	letter_heads: Record<string, { header: string | null; footer: string | null }>;
	/** `frappe/boot.py:110-111` — hook lists. */
	calendars: string[];
	treeviews: string[];
	/** `frappe/boot.py:112,116` — Python `bool(...)`. */
	has_awesomebar_search: boolean;
	sms_gateway_enabled: boolean;
	/** `frappe/boot.py:126` — Python `bool`. */
	is_fc_site: boolean;
	/** `frappe/boot.py:109` — the site-config value, always present: `null` when unset. */
	error_report_email: string | null;
	/** `frappe/boot.py:132-133` — present only when configured. */
	sentry_dsn?: string;
	/** `frappe/boot.py:118,122,123` — doctype-name lists. */
	link_preview_doctypes: string[];
	link_title_doctypes: string[];
	translated_doctypes: string[];
	/** `frappe/boot.py:135` — app names. */
	setup_wizard_completed_apps: string[];
	/** `frappe/boot.py:137` — `get_icon_style()` clamps to these two (`frappe/boot.py:144-148`). */
	desktop_icon_style: "Subtle" | "Solid";
	/** `frappe/boot.py:136`. */
	desktop_icon_urls: Record<string, unknown>;
	/**
	 * Which page `/desk` (the desktop) renders: `Desktop Settings.desktop_page`,
	 * defaulting to `"Apps"` (`frappe/boot.py:138`;
	 * `frappe/desk/doctype/desktop_settings/desktop_settings.py:74-90`). New at
	 * v16.50.0.
	 */
	desktop_page: "Apps" | "Desktop Icons";
	/**
	 * Only present when {@link desktop_page} is `"Desktop Icons"`
	 * (`frappe/boot.py:267-270`): the arrangeable icon grid reads it, the default
	 * Apps screen builds itself from {@link app_data}. In 16.33 it was always
	 * present. Built by `frappe/desk/doctype/desktop_icon/desktop_icon.py:243-313`,
	 * permission-filtered and sorted by `idx`.
	 */
	desktop_icons?: FrappeDesktopIconRecord[];
	/** `frappe/boot.py:120,519-522` — the User's desk feature toggles. */
	desk_settings: FrappeBootDeskSettings;
	/**
	 * `frappe/boot.py:249` (`get_module_sidebars`, `frappe/boot.py:609-647`) —
	 * every sidebar the user may see, keyed by **shell** in exact case: a `Sidebar`
	 * document's name, or the module name for a computed sidebar. This replaces
	 * 16.33's `workspace_sidebar_item`, which was keyed by the lowercased sidebar
	 * title. The client reads it through `frappe.app.sidebar`
	 * (`frappe/public/js/frappe/ui/sidebar/sidebar.js:62,80`). Replaced wholesale
	 * when a workspace is saved
	 * (`frappe/public/js/frappe/views/workspace/workspace.js:958`).
	 */
	module_sidebars: Record<string, FrappeModuleSidebar>;
	/**
	 * `frappe/boot.py:250` (`build_entity_module_map`, `frappe/boot.py:650-691`) —
	 * entity name (`link_to`) → the shell whose sidebar claims it with an
	 * `is_default_module` row. Flat, not keyed by kind, so an entity sharing a name
	 * with one of another kind takes the claim too. The last-installed app wins a
	 * contested claim. Replaces 16.33's `default_workspace_map`.
	 */
	entity_module: Record<string, string>;
	/**
	 * `frappe/boot.py:261` (`build_canonical_shells`,
	 * `frappe/desk/doctype/sidebar/sidebar.py:2264-2358`) — where each thing a
	 * desk route can name opens when nothing else states a shell, keyed by kind and
	 * then by name (entity names repeat across kinds). Total: every entity the user
	 * can read gets a shell. Workspaces are absent — see
	 * {@link FrappeModuleSidebar.workspaces}.
	 */
	canonical_shell: Record<FrappeSidebarEntityKind, Record<string, string>>;
	/**
	 * `frappe/boot.py:261` (`frappe/desk/doctype/sidebar/sidebar.py:2361-2391`) —
	 * where a route that names nothing lands: the shell of the user's default
	 * workspace, else the shell holding most of their entities. `null` when the
	 * user has no shell at all.
	 */
	home_shell: string | null;
	/**
	 * `frappe/boot.py:244` (`resolve_dock`, `frappe/desk/doctype/dock/dock.py:823-859`)
	 * — each app's rail as this user arranged it, keyed by `app_name`: the app's
	 * own dock with the site's layer and then the user's applied on top. An app
	 * with no arrangement is **absent**, not `[]`; an entry no layer names is
	 * absent from its array and the client keeps it in the app's own order after
	 * the named ones. Hidden rows stay, flagged.
	 */
	dock: Record<string, FrappeArrangedDockRow[]>;
	/**
	 * `frappe/boot.py:236` (`get_app_rail_host_map`, `frappe/boot.py:192-207`) —
	 * companion app → the host app whose rail it mounts on. A companion (India
	 * Compliance for ERPNext) has no shell or rail of its own; only mounts that
	 * take effect are listed. `{}` on a site with none.
	 */
	app_rail_host: Record<string, string>;
	/**
	 * `frappe/boot.py:74` (`frappe/utils/modules.py:97-117`) — a code-only module
	 * (one that ships no navigation) → the modules that inherited it, in priority
	 * order, keyed by **real** module name (unlike {@link module_app}). Shipped
	 * unfiltered; the client tests each heir against {@link module_sidebars}.
	 */
	code_only_module_heirs: Record<string, string[]>;
	/** `frappe/boot.py:86-89`. */
	notification_settings: Record<string, unknown>;
	notification_unread_count: number;
	/** `frappe/boot.py:90`. */
	onboarding_tours: unknown[];
	/** `frappe/boot.py:117`. */
	frequently_visited_links: unknown[];
	/** `frappe/boot.py:119`. */
	additional_filters_config: Record<string, unknown>;
	/** `frappe/boot.py:124`. */
	doctype_ptype_map: Record<string, unknown>;
	/** `frappe/boot.py:127`. */
	cloud_settings: Record<string, unknown>;
	/** `frappe/boot.py:114` — `Success Action` rows. */
	success_action: unknown[];
	/** `frappe/boot.py:64,514-516` — `DocType Layout` rows. */
	doctype_layouts: Array<{ name: string; route?: string; document_type?: string }>;
	/** `frappe/boot.py:80,461-466`. */
	timezone_info: {
		zones: Record<string, unknown>;
		rules: Record<string, unknown>;
		links: Record<string, unknown>;
	};
	/** `frappe/boot.py:82,476-481` — the compiled print stylesheet. */
	print_css: string;
	/** `frappe/boot.py:54-55` — only for a signed-in session. */
	user_info?: Record<string, unknown>;
	/** `frappe/boot.py:94-95` — only when the session recorded it. */
	ipinfo?: Record<string, unknown>;
	/** `frappe/boot.py:128-130`. */
	enable_address_autocompletion?: unknown;
	/** `frappe/boot.py:139-140` — Frappe Cloud sites only. */
	site_info?: Record<string, unknown>;
	/** `frappe/boot.py:169-171` — mirrored from site config only when present. */
	developer_mode?: number | boolean;
	socketio_port?: number;
	file_watcher_port?: number;
	/**
	 * `frappe/desk/desk_views.py:38` (`DeskViews.add_to_boot`) — the Workspaces the
	 * user may see; see {@link FrappeBootWorkspaces}. Read by the sidebar to
	 * resolve a `Workspace` dock row
	 * (`frappe/public/js/frappe/ui/sidebar/sidebar.js:963`).
	 */
	workspaces: FrappeBootWorkspaces;
	/**
	 * `frappe/desk/desk_views.py:37` — Reports the user may open, by report name.
	 * The server's only copy now: `frappe.boot.user.all_reports` is a client-side
	 * alias of it (see {@link FrappeBootUser.all_reports}).
	 */
	allowed_reports: Record<string, FrappeBootAllowedReport>;
	/**
	 * Built **client-side** by `frappe/public/js/frappe/desk.js:382-396`
	 * (`sync_pages`), not by the server. Absent on first paint.
	 */
	allowed_pages?: string[];
	/** `frappe/desk/desk_views.py:36` — server-provided page metadata that `sync_pages` diffs against localStorage. */
	page_info?: Record<string, { modified?: string; [key: string]: unknown }>;
	/**
	 * Open by design — `frappe/boot.py:102-103` (`boot_session` hooks) and
	 * `frappe/sessions.py:170-171` (`extend_bootinfo` hooks) let any app add keys.
	 */
	[key: string]: unknown;
}

/**
 * `frappe.boot.desk_settings` — `frappe/boot.py:519-522` selects exactly the
 * `desk_properties` tuple of `frappe/core/doctype/user/user.py:45-58` off the
 * User doc, `as_dict`. All Check fields except `dock_mode`, so `0 | 1`; `null`
 * only for a User row that predates a column. `report_split_view`,
 * `show_my_space` and `dock_mode` are new at v16.50.0.
 */
export interface FrappeBootDeskSettings {
	search_bar: FrappeCheck | null;
	notifications: FrappeCheck | null;
	list_sidebar: FrappeCheck | null;
	bulk_actions: FrappeCheck | null;
	view_switcher: FrappeCheck | null;
	form_sidebar: FrappeCheck | null;
	form_navigation_buttons: FrappeCheck | null;
	timeline: FrappeCheck | null;
	dashboard: FrappeCheck | null;
	/** `frappe/core/doctype/user/user.py:55` — default `1`. */
	report_split_view: FrappeCheck | null;
	/** `frappe/core/doctype/user/user.py:56` — whether the user menu offers "My Space" (`frappe/public/js/frappe/ui/sidebar/sidebar.js:434`); default `0`. */
	show_my_space: FrappeCheck | null;
	/**
	 * `frappe/core/doctype/user/user.py:57` — whether the dock is a pinned column
	 * or floats in from the window's edge; default `"Pinned"`. Assigned
	 * client-side by the user-settings dialog when the user changes it
	 * (`frappe/public/js/frappe/ui/user_settings_dialog.js:446`).
	 */
	dock_mode: "Floating" | "Pinned" | null;
}

/**
 * Use this, not `FrappeBoot`, when annotating a defensively-guarded read such as
 * `(window.frappe && frappe.boot) || {}` — see the hazard note on {@link FrappeBoot}.
 */
export type FrappeBootPartial = Partial<FrappeBoot>;

/**
 * `frappe.session` — populated at `frappe/public/js/frappe/desk.js:367-370`
 * (`set_globals`) and reset at desk.js:399-401 (`set_as_guest`). The namespace
 * object itself is created empty by `frappe.provide("frappe.session")`
 * (`frappe/public/js/frappe/provide.js:32`), so on a Guest/website page it may
 * be `{}` — hence every member is optional.
 *
 * `user` and `logged_in_user` differ only after the session expires, and
 * `frappe.request.is_session_expired` still reads them
 * (`frappe/public/js/frappe/request.js:416-428`): `logged_in_user` set and not
 * `"Guest"` means the page was once signed in, and `user === "Guest"` is then
 * one of two ways it counts as expired (a missing / `"Guest"` `user_id` cookie
 * is the other); a truthy `session_expired` in the response short-circuits the
 * check. See {@link FrappeRequest.is_session_expired}.
 */
export interface FrappeSession {
	/** desk.js:367 / :399 — the user id, or the literal `"Guest"`. */
	user?: string;
	/** desk.js:368 — never reset to `"Guest"` by `set_as_guest`. */
	logged_in_user?: string;
	/** desk.js:369 / :400. */
	user_email?: string;
	/** desk.js:370 / :401. */
	user_fullname?: string;
}

/**
 * `sites/assets/assets.json` and `assets-rtl.json`: bundle source name → built,
 * hashed, site-absolute URL. Written by frappe's own esbuild with 4-space
 * indent (`frappe/esbuild/esbuild.js:157`, `JSON.stringify(obj, null, 4)`),
 * merged and served to the client as `frappe.boot.assets_json`
 * (`frappe/utils/__init__.py:955-973`, `frappe/sessions.py:167`).
 */
export type FrappeAssetsJson = Record<string, string>;

// ---------------------------------------------------------------------------
// listview_settings
//
// OWNERSHIP NOTE — `frappe.listview_settings` is arguably a `frappe-views`
// concern. It is declared here because it was assigned to this group; if
// `frappe-views` also emits a `ListViewSettings`, keep one and delete the other.
// ---------------------------------------------------------------------------

/**
 * The per-doctype `listview_settings.button` block.
 * Source: `frappe/public/js/frappe/list/list_view.js:1709-1726`.
 */
export interface FrappeListViewSettingsButton {
	show(doc: FrappeDoc): boolean;
	/** A **function** here — contrast `dropdown_button.get_label`, which is a string. */
	get_label(doc: FrappeDoc): string;
	get_description(doc: FrappeDoc): string;
	/**
	 * Click handler, called unguarded with the row's doc
	 * (`frappe/public/js/frappe/list/list_view.js:2157-2164`) — a button without it
	 * throws when clicked.
	 */
	action(doc: FrappeDoc): void;
}

/**
 * One entry of `listview_settings.dropdown_button.buttons`.
 * Source: `frappe/public/js/frappe/list/list_view.js:1734-1743`.
 */
export interface FrappeListViewSettingsDropdownItem {
	/** Optional: `if (!button.show || button.show(doc))` (list_view.js:1735). */
	show?(doc: FrappeDoc): boolean;
	/** A **string**, interpolated directly (list_view.js:1739). Upstream inconsistency, preserved. */
	get_label: string;
	get_description?(doc: FrappeDoc): string;
	/** Optional click handler, guarded: `if (button && button.action)` (list_view.js:2166-2174). */
	action?(doc: FrappeDoc): void;
}

/**
 * `listview_settings.dropdown_button`.
 * Source: `frappe/public/js/frappe/list/list_view.js:1729-1763`.
 */
export interface FrappeListViewSettingsDropdown {
	/** A **string** (list_view.js:1749, :1757), unlike `button.get_label`. */
	get_label: string;
	buttons: FrappeListViewSettingsDropdownItem[];
}

/**
 * One doctype's entry in `frappe.listview_settings`.
 *
 * The namespace is created empty by `frappe.provide("frappe.listview_settings")`
 * (`frappe/public/js/frappe/provide.js:37`) and each doctype's
 * `<doctype>_list.js` assigns into it; `frappe/public/js/frappe/list/base_list.js:47`
 * reads `frappe.listview_settings[this.doctype] || {}`, so *every* member is
 * optional and a missing doctype is normal.
 */
export interface FrappeListViewSettings {
	/** list_view.js:274 — extra fieldnames to fetch. */
	add_fields?: string[];
	/**
	 * list_view.js:138-143, :816-821 — default filters as `[fieldname, operator, value]`
	 * triples; a 3-element entry is prefixed with the doctype, any other length passes
	 * through unchanged (so `[doctype, fieldname, operator, value]` is accepted too).
	 */
	filters?: ReadonlyArray<readonly unknown[]>;
	/**
	 * list_view.js:1545-1547, :1869-1871 — per-fieldname cell renderers, called as
	 * `(value, df, doc)`. The subject (first) column is skipped by the first call
	 * site (`col.type !== "Subject"`, list_view.js:1546) and handled by
	 * `get_subject_text` (list_view.js:1866-1884) as the text of the row link; a
	 * falsy result there falls back to `doc.name`.
	 */
	formatters?: Record<
		string,
		(value: unknown, df: DocField, doc: FrappeDoc) => string | undefined
	>;
	/** list_view.js:1816-1817 — override the row link target. */
	get_form_link?(doc: FrappeDoc): string;
	/**
	 * `frappe/public/js/frappe/model/indicator.js:8, 88-89` — `[label, colour, filter?]`.
	 *
	 * SEAM — the tuple was spelled inline here and imported as `IndicatorTuple`
	 * from `./model` by `views.d.ts`. `model.d.ts` won ownership (indicator.js is
	 * under `frappe/public/js/frappe/model/`); the shape is unchanged.
	 */
	get_indicator?(doc: FrappeDoc): IndicatorTuple;
	/** list_view.js:560-571 — skip the extra `ID` (`name`) column added for a doctype whose `title_field` is not `name`. */
	hide_name_column?: boolean;
	/** `frappe/public/js/frappe/list/base_list.js:1164` — omit the standard "ID" filter field. */
	hide_name_filter?: boolean;
	/** list_view.js:420 — called once with the list view instance. */
	onload?(listview: unknown): void;
	/** base_list.js:556-557 — called on every refresh with the list view instance. */
	refresh?(listview: unknown): void;
	/** list_view.js:972. */
	before_render?(): void;
	/**
	 * list_view.js:345-349, :2281-2285 — replaces the "Add" button's action (and the
	 * `ctrl+b` shortcut, which calls the same wrapper, list_view.js:358-363) and the
	 * empty-state "new" button; `make_new_doc()` runs when absent.
	 */
	primary_action?(): void;
	button?: FrappeListViewSettingsButton;
	dropdown_button?: FrappeListViewSettingsDropdown;
	/** Apps hang arbitrary helpers here (e.g. `frappe.listview_settings["DocType"].new_doctype_dialog`). */
	[key: string]: unknown;
}

// ---------------------------------------------------------------------------
// The frappe-core slice of the `frappe` global
// ---------------------------------------------------------------------------

/**
 * `frappe.datetime` — `frappe/public/js/frappe/utils/datetime.js:4`
 * (`frappe.provide("frappe.datetime")`), populated by the `$.extend` at :13.
 * Only the format helpers a client needs to move a value between the
 * **system** formats (`frappe.default*Format`) and the **user** formats
 * (`frappe.sys_defaults.date_format` / `time_format`) are declared; the
 * moment-object conveniences (`now_date`, `add_days`, …) are not.
 *
 * Every function here is backed by moment and the user formats read from
 * `frappe.sys_defaults`, which the desk sets before any app bundle runs, so
 * none of the members is optional.
 */
export interface FrappeDatetime {
	/** datetime.js:133-135 — `sys_defaults.time_format`, else `"HH:mm:ss"`. */
	get_user_time_fmt(): string;
	/** datetime.js:137-139 — `sys_defaults.date_format`, else `"yyyy-mm-dd"` (lowercase, as stored). */
	get_user_date_fmt(): string;
	/**
	 * datetime.js:157-181 — system → user format. `""` for a falsy `val`.
	 * A full datetime is converted from the system timezone to the user's.
	 */
	str_to_user(val: string | null | undefined, only_time?: boolean, only_date?: boolean): string;
	/**
	 * datetime.js:189-207 — user → system format. With `only_time`, parses
	 * against the user time format and returns `HH:mm:ss`; otherwise parses
	 * against the user date format (with a two-digit-year variant, :204) — plus
	 * the time format when `val` contains a space — and returns `YYYY-MM-DD`
	 * or `YYYY-MM-DD HH:mm:ss`. moment renders an unparseable input as the
	 * literal string `"Invalid date"`, which {@link validate} then rejects.
	 */
	user_to_str(val: string, only_time?: boolean): string;
	/**
	 * `frappe/public/js/frappe/utils/datetime.js:280-295` — `moment(d, [...], true).isValid()`:
	 * a STRICT parse against a fixed list of SYSTEM formats only; a user-format
	 * string fails. The list is `defaultDateFormat`, `defaultDatetimeFormat`,
	 * `defaultDatetimeFormat + ".SSSSSS"`, `defaultTimeFormat`,
	 * `defaultTimeFormat + ".SSSSSS"`, and the single-digit-hour times `"H:mm:ss"`,
	 * `"H:mm:ss.SSSSSS"`, `"H:mm:s.SSSSSS"` (the microsecond and `H:` forms are new at
	 * v16.50.0, so `"9:05:03"` now validates where it did not).
	 */
	validate(d: string): boolean;
}

/**
 * The **core slice** of the `frappe` desk global.
 *
 * This is intentionally *not* the whole `Frappe` type. The package author should
 * assemble the global as an intersection/extension of every group's slice:
 *
 * ```ts
 * interface Frappe
 *   extends FrappeCore,        // this file
 *           FrappeUiSlice,     // frappe-ui-form
 *           FrappeViewsSlice,  // frappe-views
 *           FrappeModelSlice,  // frappe-model-meta
 *           FrappeUtilsSlice,  // frappe-utils-dom-router
 *           FrappeChartsSlice, // frappe-charts
 *           FrappeDataTableSlice {}
 * ```
 *
 * No index signature here on purpose: `frappe` is grown lazily by
 * `frappe.provide` (`frappe/public/js/frappe/provide.js:7-19`), but a typo like
 * `frappe.msgprnt` must still be a compile error for the consumer.
 */
export interface FrappeCore {
	// -- namespaces ---------------------------------------------------------

	/** `frappe/www/desk.html:66`. */
	boot: FrappeBoot;
	/** `frappe/public/js/frappe/provide.js:32` + `desk.js:367-370`. */
	session: FrappeSession;
	/**
	 * `frappe/public/js/frappe/desk.js:10-12`. `frappe.provide("frappe.app")`
	 * makes it `{}` first, and `frappe.app = new frappe.Application()` replaces
	 * it once the constructor returns — so during `startup()` (desk.js:33-88)
	 * `frappe.app` is still the empty object, with no `sidebar`. Optional for
	 * that window and for non-desk pages, where it is never assigned.
	 */
	app?: FrappeApplication;
	/** `frappe/public/js/frappe/desk.js:28`. */
	Application: typeof FrappeApplication;
	/** `frappe/public/js/frappe/db.js:4`. */
	db: FrappeDb;
	/** `frappe/public/js/frappe/form/formatters.js:6`. */
	form: FrappeFormNamespace;
	/** `frappe/public/js/frappe/request.js:6`. */
	request: FrappeRequest;
	/** `frappe/public/js/frappe/provide.js:37`; indexed by doctype at base_list.js:47. */
	listview_settings: Record<string, FrappeListViewSettings | undefined>;
	/** See {@link FrappeDatetime} — `frappe/public/js/frappe/utils/datetime.js:4, :13`. */
	datetime: FrappeDatetime;

	// -- scalars ------------------------------------------------------------

	/** `frappe/www/desk.html:68`. Sent as the `X-Frappe-CSRF-Token` header (request.js:261). */
	csrf_token: string;
	/** `frappe/www/desk.html:67` — `frappe.boot["__messages"]`; also merged into by request.js:287. */
	_messages: Record<string, string>;
	/** Created lazily at `frappe/public/js/frappe/request.js:293-296`. */
	_link_titles?: Record<string, string>;
	/** `frappe/public/js/frappe/request.js:274` — the last `$.ajax` `data` payload. */
	last_request?: Record<string, unknown>;
	/** `frappe/public/js/frappe/request.js:522` — the last parsed response, or `null`. */
	last_response?: FrappeResponse | null;
	/** The singleton msgprint dialog, created on first use (messages.js:202-223). */
	msg_dialog?: FrappeDialog;
	/** The singleton server-error dialog (request.js:628-632). */
	error_dialog?: FrappeDialog;
	/** The live progress dialog, or `null` after `hide_progress` (messages.js:407, 425). */
	cur_progress?: FrappeDialog | null;
	/** `frappe/public/js/frappe/model/create_new.js:406` — doctype → route override for `new_doc`. */
	create_routes: Record<string, string | readonly string[]>;
	/** Cached at `frappe/public/js/frappe/translate.js:29-38`. */
	languages?: Array<{ label: string; value: string }>;
	/**
	 * The SYSTEM formats every date/time value is stored and transported in —
	 * `frappe/public/js/frappe/utils/datetime.js:6-8`, assigned at bundle load
	 * (also `moment.defaultFormat`, :9). `"YYYY-MM-DD"`, `"HH:mm:ss"` and their
	 * space-joined concatenation; the user-facing formats are
	 * {@link FrappeDatetime.get_user_date_fmt} / `get_user_time_fmt`.
	 */
	defaultDateFormat: string;
	/** datetime.js:7 — `"HH:mm:ss"`. */
	defaultTimeFormat: string;
	/** datetime.js:8 — `defaultDateFormat + " " + defaultTimeFormat`. */
	defaultDatetimeFormat: string;

	// -- namespace helper ---------------------------------------------------

	/**
	 * Create (or fetch) a dotted namespace under `window`, creating each missing
	 * segment as `{}`. Source: `frappe/public/js/frappe/provide.js:7-19`.
	 *
	 * It walks `window` — `frappe.provide("locals")` creates `window.locals`, not
	 * `frappe.locals` (provide.js:21). Returns the deepest object; the return
	 * value is genuinely untyped, hence the honest open record.
	 */
	provide(namespace: string): Record<string, unknown>;

	// -- viewport -------------------------------------------------------------

	/**
	 * `frappe/public/js/frappe/utils/common.js:273-285` — `window.innerWidth < 768`,
	 * **memoised** at v16.50.0: the first answer is cached until the next window
	 * `resize` event clears it (common.js:276-279).
	 */
	is_mobile(): boolean;

	// -- translation --------------------------------------------------------

	/** `frappe/public/js/frappe/translate.js:5`. Aliased to `window.__` at translate.js:26. */
	_: FrappeTranslate;
	/** `frappe/public/js/frappe/translate.js:29` — memoised `{label, value}` list from `boot.lang_dict`. */
	get_languages(): Array<{ label: string; value: string }>;

	// -- requests -----------------------------------------------------------

	/**
	 * Promise wrapper over {@link FrappeCore.call} that resolves with `r.message`
	 * and rejects with `r?.message`.
	 * Source: `frappe/public/js/frappe/request.js:13-28`.
	 *
	 * `type` defaults to `"POST"` (request.js:18) and `opts` is spread over the
	 * generated `frappe.call` options **last** (request.js:25), so it can override
	 * `callback` / `error` and break the promise. Documented, not prevented.
	 */
	xcall<T = unknown>(
		method: string,
		params?: Record<string, unknown>,
		type?: "GET" | "POST" | "PUT" | "DELETE",
		opts?: Partial<FrappeCallOptions<T>>
	): Promise<T>;

	/**
	 * The desk AJAX entry point. Source: `frappe/public/js/frappe/request.js:31-126`.
	 *
	 * Three overloads, all real:
	 *  1. the positional form, detected by `typeof arguments[0] === "string"`
	 *     (request.js:42-49);
	 *  2. the debounced form, which returns a bare `Promise<void>` — *not* a
	 *     jqXHR — when an identical request was seen inside the window
	 *     (request.js:105-107); calling `.fail()` on that result throws;
	 *  3. the ordinary object form, which returns the `$.ajax` jqXHR
	 *     (request.js:276). `frappe.db.get_doc` relies on `.fail` being there
	 *     (`frappe/public/js/frappe/db.js:94`).
	 */
	call<T = unknown>(
		method: string,
		args?: Record<string, unknown>,
		callback?: (r: FrappeResponse<T>, response_text?: string) => void,
		headers?: Record<string, string>
	): FrappeAjaxResult;
	call<T = unknown>(
		opts: FrappeCallOptions<T> & { debounce: number }
	): FrappeAjaxResult | Promise<void>;
	call<T = unknown>(opts: FrappeCallOptions<T>): FrappeAjaxResult;

	/**
	 * `frappe/public/js/frappe/request.js:525-535` — resolves once the in-flight
	 * count drains. Returns **`null`**, not a resolved promise, when nothing is in
	 * flight; `await null` is fine but `.then()` on it is not.
	 */
	after_server_call(): Promise<void> | null;
	/** `frappe/public/js/frappe/request.js:537-549` — always returns a Promise. */
	after_ajax<T = void>(fn?: () => T | PromiseLike<T>): Promise<T>;
	/**
	 * `frappe/public/js/frappe/dom.js:386-395` — `navigator.onLine`, forced `true`
	 * in developer mode.
	 */
	is_online(): boolean;

	// -- messages -----------------------------------------------------------

	/**
	 * Source: `frappe/public/js/frappe/ui/messages.js:133-331`; also aliased as the
	 * bare global `window.msgprint` (messages.js:333).
	 *
	 * Returns `undefined` on the early-exit paths: falsy `msg` (messages.js:134),
	 * an array `message` that recursed (messages.js:186), and the
	 * `alert`/`toast` divert (messages.js:191).
	 *
	 * A `string` beginning with `{` is `JSON.parse`d and treated as an options
	 * object (messages.js:140-142) — a genuine hazard when printing user data.
	 */
	msgprint(
		msg: string | FrappeMsgprintOptions | readonly unknown[],
		title?: string,
		is_minimizable?: boolean,
		re_route?: boolean
	): FrappeDialog | undefined;

	/**
	 * `frappe/public/js/frappe/ui/messages.js:21-28` — msgprints, then
	 * `throw new Error(msg.message)`. Never returns.
	 */
	throw(msg: string | FrappeThrowOptions): never;

	/** `frappe/public/js/frappe/ui/messages.js:335-349`. */
	hide_msgprint(instant?: boolean): void;
	/** `frappe/public/js/frappe/ui/messages.js:352-358` — replaces the body, or opens one. */
	update_msgprint(html: string): void;

	/**
	 * `frappe/public/js/frappe/ui/messages.js:30-64`.
	 * `message` is injected raw into `<p class="frappe-confirm-message">` — HTML,
	 * not text. `reject_action` fires from `onhide` only when the primary action
	 * was never fulfilled (messages.js:55-61).
	 */
	confirm(
		message: string,
		confirm_action?: () => void,
		reject_action?: () => void,
		primary_label?: string,
		secondary_label?: string
	): FrappeDialog;

	/**
	 * `frappe/public/js/frappe/ui/messages.js:66-100` — a red-buttoned confirm
	 * (the primary button gets `data-theme="red"`, messages.js:96).
	 * `message_html` is injected raw. `secondary_label` is new at v16.50.0: the
	 * secondary button reads `secondary_label` when given, else `__("Cancel")`
	 * (messages.js:84-85) — for a warning whose action is itself a cancellation,
	 * where "Cancel" would read wrong, callers pass `"No"`. `primary_label` has no
	 * default here (messages.js:77); `frappe.ui.Dialog` then labels the primary
	 * button `__("Submit")` (`frappe/public/js/frappe/ui/dialog.js:70-75`).
	 */
	warn(
		title: string,
		message_html: string,
		proceed_action?: () => void,
		primary_label?: string,
		is_minimizable?: boolean,
		secondary_label?: string
	): FrappeDialog;

	/**
	 * `frappe/public/js/frappe/ui/messages.js:102-131`.
	 * A `string` `fields` is widened into a single required Data field named
	 * `"value"` (messages.js:103-112); a lone object is wrapped in an array
	 * (messages.js:113). `callback` fires only when `d.get_values()` validates.
	 */
	prompt(
		fields: string | Partial<DocField> | ReadonlyArray<Partial<DocField>>,
		callback: (values: Record<string, unknown>) => void,
		title?: string,
		primary_label?: string
	): FrappeDialog;

	/** `frappe/public/js/frappe/ui/messages.js:360-384` — prompts, verifies server-side, then calls back. */
	verify_password(callback: () => void): void;

	/**
	 * Floating toast. Source: `frappe/public/js/frappe/ui/messages.js:430-505`.
	 * Returns the toast's root element (`handle.$el` of the `frappe.ui.toast` it
	 * creates, messages.js:503-504 — "old callers hold the element to dismiss it
	 * later"), not the `{ id, $el, dismiss, update }` handle itself. `seconds`
	 * defaults to 7 and becomes the toast's `duration` in milliseconds
	 * (messages.js:446); `0` keeps it until the close button is used
	 * (`frappe/public/js/frappe/ui/components/toast.js:109`). `actions` binds click
	 * handlers to `[data-action=<key>]` nodes found anywhere in the toast
	 * (messages.js:499-501). A bare string is `{ message }` (messages.js:431-433).
	 */
	show_alert(
		message: string | FrappeShowAlertOptions,
		seconds?: number,
		actions?: FrappeShowAlertActions
	): FrappeJQuery;
	/** `frappe/public/js/frappe/ui/messages.js:430` — the same function object as `show_alert` (`frappe.show_alert = frappe.toast = …`). */
	toast(
		message: string | FrappeShowAlertOptions,
		seconds?: number,
		actions?: FrappeShowAlertActions
	): FrappeJQuery;

	/**
	 * `frappe/public/js/frappe/ui/messages.js:386-420`. Reuses the live dialog when
	 * `title` matches. `total` defaults to 100, `hide_on_completion` to `false`.
	 */
	show_progress(
		title: string,
		count: number,
		total?: number,
		description?: string,
		hide_on_completion?: boolean
	): FrappeDialog;
	/** `frappe/public/js/frappe/ui/messages.js:422-427`. */
	hide_progress(): void;

	// -- documents ----------------------------------------------------------

	// COLLISION RESOLVED — `frappe.get_doc`, `frappe.get_list` and
	// `frappe.get_children` used to be declared HERE as well as on
	// `FrappeModelMetaGlobals` (model.d.ts), with different signatures. Two
	// interfaces cannot contribute non-identical members of the same name to one
	// composite, so `interface Frappe extends FrappeCore, FrappeModelMetaGlobals`
	// was a hard TS2320 and no `Frappe` type could be formed at all.
	//
	// `model.d.ts` won: all three are `frappe.model.*` functions that
	// `frappe/public/js/frappe/model/model.js:908-910` merely aliases onto the
	// root ("// legacy"), so the model group owns them. Nothing was dropped — the
	// generic parameter and every note from this copy were folded into
	// {@link FrappeModelMetaGlobals}, which is the only remaining declaration and
	// is reachable from `Frappe` exactly as before.

	/**
	 * `frappe/public/js/frappe/model/create_new.js:407-428`.
	 *
	 * Returns `undefined` for `doctype === "File"` (it opens a FileUploader and
	 * bails, create_new.js:408-413); otherwise a Promise that resolves once the
	 * route change or quick-entry dialog has been set up — it does **not** resolve
	 * with the new document. A plain-object `opts` is stashed in
	 * `frappe.route_options` (create_new.js:416-418).
	 */
	new_doc(
		doctype: string,
		opts?: { folder?: string } | Record<string, unknown>,
		init_callback?: (doc: FrappeDoc) => void
	): Promise<void> | undefined;

	// -- formatting ---------------------------------------------------------

	/**
	 * Render one value with the formatter for its fieldtype.
	 * Source: `frappe/public/js/frappe/form/formatters.js:435-461`.
	 *
	 * Notable behaviour the type cannot express: a missing `df`, or a fieldname
	 * listed in the doctype's `masked_fields`, is replaced by
	 * `{ fieldtype: "Data" }` (formatters.js:442); `_user_tags` is forced to the
	 * `Tag` formatter (formatters.js:443); `Dynamic Link` is resolved to `Link`
	 * and stamps `df._options` **onto the caller's docfield object**
	 * (formatters.js:447-450). String output is passed through
	 * `frappe.dom.remove_script_and_style` (formatters.js:458).
	 *
	 * **Per-field override changed at v16.50.0.** The formatter is now
	 * `frappe.meta.get_docfield(doc?.doctype, df.fieldname)?.formatter`, falling
	 * back to the fieldtype formatter (formatters.js:452-454). It is looked up on
	 * the doctype's registered docfield (the one `frappe.meta.set_formatter`
	 * writes, `frappe/public/js/frappe/model/meta.js:76-78`), not read off the `df`
	 * argument: a `formatter` on a standalone `df` object is ignored, and without
	 * a `doc` no override is ever found. An override replaces the fieldtype
	 * formatter entirely and is called with `(value, df, options, doc)`; its
	 * return value is not constrained to a string, so the declared
	 * `string | number` describes the built-in formatters only.
	 */
	format(
		value: unknown,
		df?: DocField | null,
		options?: FrappeFormatterOptions | null,
		doc?: FrappeDoc
	): string | number;

	/**
	 * `frappe/public/js/frappe/form/formatters.js:463-475` — a shallow copy of
	 * `doc` with an extra `get_formatted(fieldname)`, for print templates.
	 */
	get_format_helper<T extends FrappeDoc = FrappeDoc>(
		doc: T
	): T & { get_formatted(fieldname: string): string | number };
}

// ---------------------------------------------------------------------------
// Classes referenced only as markup/CSS contracts
//
// OWNERSHIP NOTE — both of these live under `frappe.ui.*` and may be better
// placed in `frappe-ui-form`. They are declared here because the inventory
// assigned them to this group; deduplicate on assembly.
// ---------------------------------------------------------------------------

/**
 * `frappe.Application` — `frappe/public/js/frappe/desk.js:28`, the desk
 * bootstrapper. The single instance is `frappe.app` (desk.js:12).
 *
 * `startup()` (desk.js:33-88) runs synchronously from the constructor (:30)
 * and calls `make_nav_bar()` (:39, the `frappe.ui.toolbar.Toolbar` whose
 * constructor decides whether to replace `<header>`) **before**
 * `make_sidebar()` (:40). So `frappe.app.sidebar` being present proves that
 * decision has already been made — the ordering carbon_frappe's header
 * mount gates on.
 *
 * Declared, not modelled: only the members a theme reaches are listed.
 */
export declare class FrappeApplication {
	/** desk.js:29-31 — calls `startup()` immediately. */
	constructor();
	/** desk.js:90-92 — `new frappe.ui.Sidebar({})`. */
	sidebar: FrappeSidebar;
	/**
	 * frappe/public/js/frappe/ui/page.js:77-80 — the search modal behind the
	 * sidebar's Search row, created by the first `Page` when
	 * `frappe.boot.desk_settings.search_bar` is on. Absent for a user who turned
	 * search off and before the first page exists; see {@link FrappeAwesomeBar}.
	 */
	awesome_bar?: FrappeAwesomeBar;
	/** desk.js:337-346 — fills `frappe.modules` / `frappe.workspaces` from `boot.workspaces.pages`. */
	setup_workspaces(): void;
	/** desk.js:423-438 — confirm, then `logout` and {@link redirect_to_login}. */
	logout(): void;
	/** desk.js:425 — set by `logout()` before the confirm; absent until then. */
	logged_out?: boolean;
	/**
	 * desk.js:439-452 — a no-op while {@link session_expired_dialog} exists;
	 * otherwise opens a "Session Expired" dialog whose hide redirects to
	 * {@link redirect_to_login}. (Before v16.50.0 it redirected immediately.)
	 */
	handle_session_expired(): void;
	/**
	 * desk.js:446-447 — the "Session Expired" dialog, assigned by
	 * `handle_session_expired` and never cleared; its presence makes
	 * {@link FrappeRequest.handle_session_expiry} treat every later response as expired.
	 */
	session_expired_dialog?: FrappeDialog;
	/** desk.js:453-457 — `/login?redirect-to=<current path>`. */
	redirect_to_login(): void;
}

/**
 * `frappe.ui.toolbar.Toolbar` — the desk navbar controller.
 * Source: `frappe/public/js/frappe/ui/toolbar/toolbar.js:7-39`.
 *
 * The contract carbon_frappe depends on is in the constructor: `$("header")` is
 * replaced **only** under four conditions (toolbar.js:9-21) — `boot.read_only`,
 * `boot.user.impersonated_by`, an announcement widget that is set and either not
 * yet dismissed or not dismissible (toolbar.js:12-14; `dismissible_announcement_widget`
 * is new at v16.50.0), or `frappe.is_mobile()`. Otherwise the empty
 * `<header></header>` from `frappe/www/desk.html:51` survives, which is what the
 * Carbon UI Shell mounts into. carbon_frappe's `scripts/markup-manifest.ts:310-322`
 * asserts both halves statically.
 *
 * Declared, not modelled: the class has no constructor parameters and everything
 * else on it is internal wiring.
 */
export declare class FrappeToolbar {
	constructor();
	/** `frappe/public/js/frappe/ui/toolbar/toolbar.js:34-39` — binds events, fires the `toolbar_setup` document event. */
	make(): void;
	/** `frappe/public/js/frappe/ui/toolbar/toolbar.js:37` — `$(".navbar-brand")`. */
	navbar?: FrappeJQuery;
}

/**
 * `frappe.ui.ThemeSwitcher` — the "Switch Theme" dialog.
 * Source: `frappe/public/js/frappe/ui/theme_switcher.js:3-164`.
 *
 * The contract carbon_frappe depends on: theming is communicated **only** through
 * DOM attributes, with no event and no realtime publish —
 * `toggle_theme` writes `data-theme-mode` (theme_switcher.js:149) and
 * `frappe.ui.set_theme` writes `data-theme` (theme_switcher.js:182) on
 * `document.documentElement`. A `MutationObserver` on that attribute is
 * therefore the only available hook, which is exactly what
 * carbon_frappe's `carbon_charts.bundle.ts:208-214` installs.
 * carbon_frappe's `scripts/audit-tokens.ts:179-182` asserts the
 * `setAttribute("data-theme", …)` call still exists.
 */
export declare class FrappeThemeSwitcher {
	constructor();
	/** theme_switcher.js:48-53 — re-reads `data-theme-mode` and re-renders. */
	refresh(): void;
	/** theme_switcher.js:147-155 — lowercases, writes `data-theme-mode`, persists server-side. */
	toggle_theme(theme: string): void;
	show(): void;
	hide(): void;
	/** theme_switcher.js:49 — the current `data-theme-mode`, defaulting to `"light"`. */
	current_theme?: string;
}

// ---------------------------------------------------------------------------
// Global wiring implied by this group
// ---------------------------------------------------------------------------

/**
 * Documentation-only marker for the ambient declarations the package author must
 * emit for this group. Nothing imports this type; it exists so the wiring is
 * version-controlled next to the shapes it wires.
 *
 * ```ts
 * declare global {
 *   // desk.html:64 and provide.js:5 both do `if (!window.frappe) window.frappe = {}`.
 *   // Every carbon_frappe call site probes `window.frappe` and then dereferences
 *   // the BARE identifier, so both spellings must exist and resolve to one type.
 *   var frappe: Frappe;
 *
 *   // translate.js:26 — `window.__ = frappe._`.
 *   var __: FrappeTranslate;
 *
 *   // messages.js:333 — `window.msgprint = frappe.msgprint`.
 *   var msgprint: Frappe["msgprint"];
 *
 *   interface Window {
 *     // Declared OPTIONAL on purpose. `if (!window.frappe) return;`
 *     // (tables/grid/install.ts:22, tables/datatable/install.ts:25) becomes dead
 *     // code under strictNullChecks if this is required, and the engine really is
 *     // loaded outside a desk by scripts/dev-table.ts.
 *     frappe?: Frappe;
 *
 *     // desk.html:62 — `window.dev_server = {{ dev_server }};`. See FrappeDevServer.
 *     dev_server?: number;
 *
 *     // translate.js:26. Optional for the same headless reason; carbon_frappe's
 *     // `tables/datatable/datatable.ts:73-75` probes it with
 *     // `typeof window.__ === "function"` (frappe-datatable itself never does).
 *     __?: FrappeTranslate;
 *
 *     // messages.js:333.
 *     msgprint?: Frappe["msgprint"];
 *
 *     // desk.html:61 / :59.
 *     app?: boolean;
 *     _version_number?: string;
 *
 *     // request.js:96 — probed to decide whether to absolutise the API URL.
 *     cordova?: unknown;
 *   }
 *
 *   // frappe/public/js/frappe/provide.js:42-45.
 *   var NEWLINE: string;
 *   var TAB: number;
 *   var UP_ARROW: number;
 *   var DOWN_ARROW: number;
 *
 *   // utils/utils.js:13-27 — installed together, behind ONE `if (!Array.prototype.uniqBy)`.
 *   interface Array<T> {
 *     move(from: number, to: number): void;
 *     uniqBy<K>(key: (item: T) => K): T[];
 *   }
 * }
 * ```
 *
 * `ResizeObserver` needs **no** declaration: `tsconfig.json` sets
 * `"lib": ["ES2022", "DOM", "DOM.Iterable"]`, and `lib.dom.d.ts` already declares
 * the class, `ResizeObserverEntry` and `ResizeObserverOptions`. Re-declaring it
 * here would be a duplicate-identifier error, and the `typeof ResizeObserver ===
 * "undefined"` guard at `tables/grid/grid.ts:159` type-checks against the lib
 * declaration unchanged.
 */
export type FrappeCoreGlobalWiring = never;

/**
 * `window.dev_server`, emitted raw into the desk page at
 * `frappe/www/desk.html:62` (`window.dev_server = {{ dev_server }};`).
 *
 * The value is an **int**, not a bool: `frappe/__init__.py:85` computes
 * `_dev_server = int(sbool(os.environ.get("DEV_SERVER", False)))`, so the page
 * receives the literal `0` or `1`. (A Python bool would have rendered as `True`
 * and been a syntax error in JS.) Declared as `number` rather than `0 | 1` so an
 * app that overrides the template is not made to lie; every reader in frappe and
 * in carbon_frappe uses it for truthiness only (`assets.js:110`,
 * `request.js:267`, `socketio_client.js:122`, `anatomy/patch.js:80`).
 */
export type FrappeDevServer = number;

/**
 * frappe's two `Array.prototype` additions.
 *
 * Source: `frappe/public/js/frappe/utils/utils.js:13-27`. Both are installed
 * inside a single `if (!Array.prototype.uniqBy)` guard, so `move` exists if and
 * only if `uniqBy` does.
 *
 * **`move` returns `undefined`.** The body is `this.splice(to, 0, this.splice(from, 1)[0]);`
 * with no `return` (utils.js:25). A signature of `move(from, to): T[]` — which the
 * usage inference proposed — would let a consumer chain off a value that does not
 * exist. `frappe/public/js/frappe/form/grid_row.js:172` correctly uses it for its
 * side effect only.
 */
export interface FrappeArrayPolyfills<T> {
	move(from: number, to: number): void;
	uniqBy<K>(key: (item: T) => K): T[];
}

// ---------------------------------------------------------------------------
// carbon_frappe-owned shapes
//
// OWNERSHIP NOTE — the four declarations below are NOT part of the frappe desk
// API. They describe carbon_frappe's own monkey-patch plumbing and dev harness,
// and belong in the app's ambient d.ts rather than in a published frappe-types
// package. They are here because the inventory assigned them to this group.
// ---------------------------------------------------------------------------

/** Any callable, without reaching for `any`. Used to extract method members of an object type. */
export type FrappeAnyFunction = (...args: never[]) => unknown;

/**
 * `carbon_frappe/public/js/anatomy/patch.js:12` — `const registry = []`, which
 * infers `never[]` under `strict` and rejects every `push`. Annotate it
 * `const registry: PatchRegistryEntry[] = []`.
 *
 * Pushed at patch.js:35, :41, :50, :55 (`{ id, ok: <literal> }`) and at :61
 * (`{ id, ok: !!ok }`); read at :69 (`filter`) and :74 (`map`).
 */
export interface PatchRegistryEntry {
	id: string;
	ok: boolean;
}

/**
 * Signature for `carbon_frappe/public/js/anatomy/patch.js:25` `safePatch`.
 *
 * The two implicit-any indexes this is designed to remove are patch.js:33
 * (`const target = owner && owner[key]`) and patch.js:54 (`owner[key] = patched`).
 * Making `K extends keyof O` types both, at the cost of forcing every call site
 * to pin `O` — which is the point: the call sites patch `.prototype` objects of
 * untyped frappe classes (`frappe.views.ReportView.prototype.setup_datatable`,
 * `frappe.ui.form.ControlTable.prototype.make`), and pinning `O` is what makes
 * those prototypes get a declared type at all.
 *
 * `Extract<O[K], FrappeAnyFunction>` narrows `orig` to the callable members of
 * `O[K]` without `any`. `getOwner` returns `O | null` because it is called
 * lazily inside a `try` (patch.js:26-31) precisely so a missing frappe namespace
 * is a `null`, not a throw.
 */
export type SafePatch = <O extends object, K extends keyof O>(
	getOwner: () => O | null,
	key: K,
	wrap: (orig: Extract<O[K], FrappeAnyFunction>) => O[K],
	id: string
) => boolean;

/**
 * The `__carbon_frappe` idempotency brand carbon_frappe stamps on foreign
 * objects. **Two value types, deliberately:**
 *
 * - `true` on a class object — `carbon_charts.bundle.ts:206`
 *   (`frappe.Chart.__carbon_frappe = true`);
 * - `true` on a frappe namespace object — `carbon_desk.bundle.ts:76`
 *   (`f.__carbon_frappe = true` on `frappe.form.formatters`);
 * - a **string** patch id on a wrapped function — `anatomy/patch.ts:110`
 *   (`patched.__carbon_frappe = id`).
 *
 * So a single `interface Function { __carbon_frappe?: string }` augmentation is
 * wrong for the first two. Every read site is a truthiness test
 * (`carbon_charts.bundle.ts:192`, `carbon_desk.bundle.ts:38`, `patch.ts:97`), so
 * the union costs nothing.
 */
export type CarbonFrappeBrand = string | true;

/** Objects carbon_frappe may stamp with {@link CarbonFrappeBrand}. */
export interface CarbonFrappeBranded {
	__carbon_frappe?: CarbonFrappeBrand;
}

/**
 * `window.demo` — the bridge between the generated demo page and the CDP driver.
 *
 * Written statically at `dev/table-demo.js:71` (`window.demo = { table, makeData }`)
 * — the only static `Window` augmentation in the app. Read from the driver at
 * `scripts/tables/engine.mjs:51, 54, 107, 121, 138, 153, 166, 186, 191, 201, 203`
 * and from the generated page's inline script at `scripts/dev-table.mjs:81`
 * (`window.demo.table.toggleFilters()`).
 *
 * Generic in the table type so the app can pin its own `CarbonTable` without
 * frappe-types having to know about it:
 * `declare global { interface Window { demo: CarbonTableDemoGlobal<CarbonTable> } }`
 */
export interface CarbonTableDemoGlobal<
	TTable = CarbonTableDemoSurface,
	TRow = Record<string, unknown>,
> {
	table: TTable;
	/** `dev/table-demo.js` — generates `n` synthetic rows; driven with 50000 at engine.mjs:203. */
	makeData(n: number): TRow[];
}

/**
 * The minimum surface of carbon_frappe's own `CarbonTable` that the demo page and
 * the CDP driver actually reach through `window.demo.table`. The real class lives
 * at `carbon_frappe/public/js/tables/engine/table` and is out of scope for
 * frappe-types; this is the structural contract the harness depends on.
 */
export interface CarbonTableDemoSurface {
	/** `scripts/dev-table.mjs:81`. */
	toggleFilters(): void;
	/** `scripts/tables/engine.mjs:203`. */
	setData(rows: ReadonlyArray<Record<string, unknown>>): void;
	/** `scripts/tables/engine.mjs:203`. */
	render(): void;
	/**
	 * The underlying TanStack table instance (`@tanstack/table-core`), reached at
	 * `scripts/tables/engine.mjs:186, 191`
	 * (`.getRowModel()`, `.setRowSelection()`, `.getSelectedRowModel()`).
	 */
	table: unknown;
}

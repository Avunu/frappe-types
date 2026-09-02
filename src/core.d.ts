/**
 * frappe-types — group: `frappe-core`
 *
 * Hand-maintained declarations for the frappe **desk JS API** core slice:
 * `frappe.call` / `xcall` / `msgprint` / `throw` / `show_alert` / `confirm` /
 * `prompt` / `boot` / `session` / `db` / `format` / `form.formatters` /
 * `provide` / `get_doc` / `new_doc`, plus the `__()` translation global.
 *
 * Verified against **frappe v16.33.0** (git tag `v16.33.0`, branch `version-16`)
 * at `apps/frappe`. Every non-obvious declaration cites `file:line` so the next
 * version bump can be diffed against the same lines.
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
 * Source: `frappe/public/js/frappe/request.js:282` (`return $.ajax(ajax_args)…`).
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
 * `frappe/public/scss/common/indicator.scss:51-52`; the open `(string & {})`
 * arm is honest rather than decorative — `frappe.show_alert`
 * (`frappe/public/js/frappe/ui/messages.js:435`) falls back to
 * `"solid-" + message.indicator` for any unknown value, so arbitrary strings do
 * reach the DOM. Apps ship their own indicator classes.
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
	// eslint-disable-next-line @typescript-eslint/ban-types
	| (string & {});

// ---------------------------------------------------------------------------
// Translation — `frappe._` / `window.__`
// ---------------------------------------------------------------------------

/**
 * The `replace` argument of {@link FrappeTranslate}.
 *
 * **Positional only.** `frappe._` forwards this to `$.format`
 * (`frappe/public/js/frappe/translate.js:17` → `frappe/public/js/frappe/format.js:1-17`),
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
 * (translate.js:9-10) and falls back to the plain key.
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
 * Source: `frappe/public/js/frappe/ui/messages.js:210-247`.
 */
export interface FrappeMsgprintPrimaryAction {
	/** Button label; run through `__()` at messages.js:245. */
	label?: string;
	/** Client-side handler. Synthesised from `server_action`/`client_action` when absent. */
	action?: () => void;
	/**
	 * Dotted path of a whitelisted server method. messages.js:211-226 builds an
	 * `action` that `frappe.call`s it with `args`.
	 */
	server_action?: string;
	/**
	 * Dotted path resolved against `window` (messages.js:232-236 walks
	 * `obj = obj[part]`) and invoked with `args` if it turns out to be a function.
	 */
	client_action?: string;
	/** Passed as `args` to `server_action` / `client_action`. Open by design. */
	args?: Record<string, unknown>;
	/** messages.js:220 — close the dialog after a successful `server_action`. */
	hide_on_success?: boolean;
}

/**
 * Secondary-action block of a {@link FrappeMsgprintOptions}.
 * Source: `frappe/public/js/frappe/ui/messages.js:255-260`.
 */
export interface FrappeMsgprintSecondaryAction {
	label?: string;
	action?: () => void;
}

/**
 * Object form of `frappe.msgprint`.
 *
 * Source: `frappe/public/js/frappe/ui/messages.js:117-315`. Detected by
 * `$.isPlainObject(msg)` at messages.js:120; every key below is one the
 * implementation actually reads.
 */
export interface FrappeMsgprintOptions {
	/**
	 * Body. A `string` is the normal case. An **array** is re-entered one element
	 * at a time (messages.js:150-171) — each element may itself be a JSON string
	 * of a message object. `as_list` / `as_table` reinterpret the array as list
	 * rows / table rows before that (messages.js:135-148).
	 */
	message?: string | readonly unknown[] | null;
	title?: string;
	/** Defaults to `"blue"` at messages.js:131-133. */
	indicator?: FrappeIndicator;
	/** messages.js:135-138 — render `message` (an array) as a `<ul>`. */
	as_list?: boolean;
	/** messages.js:140-148 — render `message` (an array of arrays) as a `<table>`. */
	as_table?: boolean;
	/** messages.js:173-176 — divert the whole message to `frappe.show_alert`. */
	alert?: boolean;
	/** messages.js:173-176 — synonym of `alert`. */
	toast?: boolean;
	/** messages.js:178-185 — on hide, route back to the previous route. */
	re_route?: boolean;
	/** messages.js:196 — build the dialog with a minimise control. */
	is_minimizable?: boolean;
	/** messages.js:271-275 — clear the existing message area instead of appending. */
	clear?: boolean;
	/**
	 * messages.js:293-301 — **inverted**: `wide: true` *removes* the
	 * `msgprint-dialog` class (the class is what makes msgprint narrow).
	 */
	wide?: boolean;
	primary_action?: FrappeMsgprintPrimaryAction;
	/** Fallback label when `primary_action.label` is absent (messages.js:245). */
	primary_action_label?: string;
	secondary_action?: FrappeMsgprintSecondaryAction;
}

/**
 * Object form of `frappe.throw`.
 * Source: `frappe/public/js/frappe/ui/messages.js:20-27` — a string is widened to
 * `{ message, title: __("Error") }` and `indicator` defaults to `"red"`.
 */
export interface FrappeThrowOptions extends FrappeMsgprintOptions {
	/** Required: `throw new Error(msg.message)` at messages.js:26. */
	message: string;
}

/**
 * Object form of `frappe.show_alert` / `frappe.toast`.
 * Source: `frappe/public/js/frappe/ui/messages.js:414-483`.
 */
export interface FrappeShowAlertOptions {
	/** Interpolated raw into the alert markup (messages.js:447). */
	message: string;
	/** Second line (messages.js:449). */
	subtitle?: string;
	/**
	 * Drives both the wrapper class and the icon: known values map through
	 * `indicator_icon_map` (messages.js:415-421), anything else becomes
	 * `"solid-" + indicator` (messages.js:435). Defaults to `"blue"`.
	 */
	indicator?: FrappeIndicator;
	/** Extra HTML revealed under the title (messages.js:458-460). */
	body?: string;
}

/**
 * Handlers bound to `[data-action=<key>]` nodes inside the alert body.
 * Source: `frappe/public/js/frappe/ui/messages.js:468-470`.
 */
export type FrappeShowAlertActions = Record<string, (event: unknown) => void>;

// ---------------------------------------------------------------------------
// Requests — frappe.call / frappe.xcall / frappe.request
// ---------------------------------------------------------------------------

/**
 * The envelope every desk AJAX response is parsed into.
 *
 * Source: `frappe/public/js/frappe/request.js:283-332` (`.done` / `.always`) and
 * `frappe/public/js/frappe/request.js:422-502` (`frappe.request.cleanup`).
 *
 * The index signature is not a shrug: a whitelisted method may return any
 * top-level keys it likes, and hooks add more. `message` is the payload.
 */
export interface FrappeResponse<T = unknown> {
	/** Return value of the whitelisted method. What `frappe.xcall` resolves with. */
	message?: T;
	/** JSON-encoded traceback (`string[]` or `string`); parsed at request.js:471-482. */
	exc?: string;
	/** Exception class name; keyed into `frappe.request.error_handlers` (request.js:444). */
	exc_type?: string;
	/** JSON-encoded array of message payloads; parsed at request.js:460. */
	_server_messages?: string;
	/** JSON-encoded array; logged at request.js:485-498. */
	_debug_messages?: string;
	/** v2 API only — request.js:457-458 reads `r.messages` instead. */
	messages?: readonly unknown[];
	/** Merged into `frappe._link_titles` (request.js:298-303). */
	_link_titles?: Record<string, string>;
	/** Merged into `frappe._messages` (request.js:293-295). */
	__messages?: Record<string, string>;
	/** Synced into `locals` via `frappe.model.sync` (request.js:288-290). */
	docs?: readonly FrappeDoc[];
	/** Synced alongside `docs` (request.js:288). */
	docinfo?: Record<string, unknown>;
	/** Present for background jobs; triggers the realtime subscribe at request.js:76-82. */
	task_id?: string;
	/** request.js:436 — forces the session-expired path. */
	session_expired?: boolean | FrappeCheck;
	/** Set on 403 responses; consumed and nulled at request.js:155-163. */
	_error_message?: string;
	/** Rendered into the server-error dialog at request.js:630-633. */
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
	/** Server arguments. Nested objects/arrays are JSON-stringified at request.js:404-408. */
	args?: Record<string, unknown>;
	/** request.js:83-86 — invoked with the parsed body and the raw response text. */
	callback?: (r: FrappeResponse<TMessage>, response_text?: string) => void;
	/** request.js:113 — invoked on any unhandled failure; argument shape varies by status code. */
	error?: (r?: FrappeResponse<TMessage> | unknown) => void;
	/** request.js:329-331 — invoked with the parsed body (or `null` if unparsable). */
	always?: (r: FrappeResponse<TMessage> | null) => void;
	/** request.js:80-82 — invoked instead of `callback` when the server queued the job. */
	queued?: (r: FrappeResponse<TMessage>) => void;
	/** Defaults to `"POST"` (request.js:110). */
	type?: "GET" | "POST" | "PUT" | "DELETE";
	/** Bypasses the `/api/method/` URL builder entirely (request.js:89-90). */
	url?: string;
	/** `"v2"` switches the URL prefix and the message-extraction path (request.js:92-94, 457). */
	api_version?: string;
	/** request.js:62-63 — build `cmd` as `<module>.page.<page>.<page>.<method>`. */
	module?: string;
	/** See `module`. */
	page?: string;
	/** request.js:64-70 — run a controller method on this document. */
	doc?: FrappeDoc;
	/** request.js:398, 424 — disabled for the duration of the request. */
	btn?: unknown;
	/** request.js:401 — freeze the page with `frappe.dom.freeze`. */
	freeze?: boolean;
	freeze_message?: string;
	/** request.js:51-53 — alias for `no_spinner`. */
	quiet?: boolean;
	no_spinner?: boolean;
	/** request.js:462 — suppress `_server_messages` msgprints. */
	silent?: boolean;
	/** Extra request headers (request.js:118, 265-272). */
	headers?: Record<string, string>;
	/** Per-request `exc_type` handlers, merged with the global ones (request.js:444-446). */
	error_handlers?: Record<string, (r: FrappeResponse) => void>;
	/** Forwarded to `$.ajax`. `false` makes the call synchronous. */
	async?: boolean;
	/** Forwarded to `$.ajax`; forced to `false` when `window.dev_server` (request.js:273). */
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
 * (request.js:394-420) renames `success`/`error` to `success_callback`/
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
	/** Installed by `frappe.request.prepare` (request.js:416-419). */
	success_callback?: (data: FrappeResponse, response_text?: string) => void;
	/** Installed by `frappe.request.prepare` (request.js:416-419). */
	error_callback?: (r?: unknown, response_text?: string) => void;
}

/**
 * `frappe.request` — the low-level AJAX namespace.
 * Source: `frappe/public/js/frappe/request.js:6-11, 128-672`.
 */
export interface FrappeRequest {
	/** request.js:8 — `"/"`. Prefixed to the URL only under Cordova (request.js:96-100). */
	url: string;
	/** request.js:9, 661-670 — in-flight `$.ajax` count, maintained by global handlers. */
	ajax_count: number;
	/** request.js:10 — callbacks drained when `ajax_count` reaches zero. */
	waiting_for_ajax: Array<() => void>;
	/** request.js:11, 371-391 — per-`cmd` debounce log. */
	logs: Record<string, Array<{ args: Record<string, unknown>; timestamp: Date }>>;
	/** request.js:7, 444 — global handlers keyed by `exc_type`. */
	error_handlers: Record<string, Array<(r: FrappeResponse) => void>>;
	call(opts: FrappeRequestCallOptions): FrappeAjaxResult;
	/** request.js:371 — true when an identical request was sent within `threshold` ms. */
	is_fresh(args: Record<string, unknown>, threshold: number): boolean;
	/** request.js:394 — mutates `opts`; throws the string `"Incomplete Request"` on a missing cmd. */
	prepare(opts: FrappeRequestCallOptions): void;
	/** request.js:422 — un-freezes, dispatches error handlers, shows server messages. */
	cleanup(opts: FrappeRequestCallOptions, r: FrappeResponse | null): void;
	/** request.js:530 — opens the "Server Error" dialog. */
	report_error(xhr: unknown, request_opts: FrappeRequestCallOptions): void;
	/** request.js:640 — masks password fields in `args` before the error report. */
	cleanup_request_opts(opts: FrappeRequestCallOptions): FrappeRequestCallOptions;
	/** request.js:655 — append a global handler for an `exc_type`. */
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
	 * db.js:27 — a string is looked up by `name`, an object is counted with
	 * `limit: 1`. Any other type leaves the promise **permanently pending**
	 * (db.js:29-40 has no `else`); that is upstream behaviour, not a typo here.
	 */
	exists(doctype: string, nameOrFilters: string | Record<string, unknown>): Promise<boolean>;
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
 * Source: keys read at `frappe/public/js/frappe/form/formatters.js:12, 71, 159,
 * 182, 213`. `frappe.format(value, df, null, doc)` is legal
 * (`frappe/public/js/frappe/list/list_view.js:953`), hence the `| null` on the
 * parameters below.
 *
 * `1` / `0` appear alongside `true` / `false` at real call sites
 * (`{ inline: 1 }` formatters.js:459, `{ only_value: 1 }` filter.js:458), so the
 * flags are widened rather than declared `boolean`.
 */
export interface FrappeFormatterOptions {
	/** formatters.js:12 — return the bare value instead of the right-aligned wrapper. */
	inline?: boolean | FrappeCheck;
	/** formatters.js:12, 159, 182 — return the unwrapped, unlinked value. */
	only_value?: boolean | FrappeCheck;
	/** formatters.js:71 — keep trailing zeros on a Float. */
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
 * (`frappe/public/js/frappe/form/formatters.js:445`). Every member of
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
 * `formatters.js:466-469` (the built-in `"User"` entry).
 */
export type FrappeLinkFormatter = (
	value: string,
	doc: FrappeDoc | undefined,
	docfield: DocField | undefined
) => string;

/**
 * `frappe.form.formatters` — the fieldtype → renderer table.
 *
 * Source: `frappe/public/js/frappe/form/formatters.js:10-414`. Keys are
 * fieldtypes with spaces stripped (`frappe.form.get_formatter`, formatters.js:423).
 *
 * Return types are transcribed, not guessed. Several members can return a
 * **number**: `_right` passes its input straight through when
 * `options.inline || options.only_value` (formatters.js:11-17), so `Int`,
 * `Float`, `Percent` and `Currency` inherit that; `FileSize` returns a raw
 * `cint` below 1 KiB (formatters.js:377).
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
	/** formatters.js:108 — `docfield.options` is the star count (default 5). */
	Rating(value: unknown, docfield: DocField): string;
	Currency(
		value: unknown,
		docfield: DocField,
		options?: FrappeFormatterOptions | null,
		doc?: FrappeDoc
	): string | number;
	/** formatters.js:165 — a disabled `<input type=checkbox>`, never a boolean. */
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
	 * (`carbon_desk.bundle.js:33-42`), and a *uniform* signature is what keeps
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
	/** formatters.js:370 — returns a raw `cint` below 1 KiB, `"1.23M"`/`"4.56K"` above. */
	FileSize(value: unknown): string | number;
	/** formatters.js:379 — `rows` are the child rows of a Table MultiSelect field. */
	TableMultiSelect(
		rows: ReadonlyArray<Record<string, unknown>> | null | undefined,
		df: DocField,
		options?: FrappeFormatterOptions | null
	): string;
	Color(value: string | null | undefined): string;
	Icon(value: string | null | undefined): string;
	/** formatters.js:412-413, 416-419 — both alias the same `format_attachment_url`. */
	Attach(url: string | null | undefined): string;
	AttachImage(url: string | null | undefined): string;

	/**
	 * Fieldtypes are open: apps register their own by assigning here, and
	 * `get_formatter` (formatters.js:423) does a plain index lookup. Declared
	 * members above stay exact; anything else is a formatter or nothing.
	 */
	[fieldtype: string]: unknown;
}

/**
 * `frappe.form` — the whole namespace, which is exactly three members at
 * v16.33.0 (verified by grepping `frappe.form.` across `frappe/public/js`).
 * Created by `frappe.provide("frappe.form.formatters")` at
 * `frappe/public/js/frappe/form/formatters.js:6`.
 *
 * Not to be confused with `frappe.ui.form` (controls, `ControlTable`, quick
 * entry), which belongs to `frappe-ui-form`.
 */
export interface FrappeFormNamespace {
	/** formatters.js:10. */
	formatters: FrappeFormatters;
	/** formatters.js:8, populated at formatters.js:466 for `"User"`. */
	link_formatters: Record<string, FrappeLinkFormatter | undefined>;
	/**
	 * formatters.js:421 — strips spaces from `fieldtype` and falls back to
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
 * Source: `frappe/boot.py:51-52`
 * (`bootinfo.sysdefaults = frappe.defaults.get_defaults()`, then
 * `sysdefaults["setup_complete"] = frappe.is_setup_complete()`).
 *
 * It is an **open** map: keys are `DefaultValue.defkey` rows
 * (`frappe/defaults.py:235-268`), so every installed app contributes its own.
 * Values are `defvalue` strings, or a **`string[]`** when one key has several
 * rows (defaults.py:250-256 listifies duplicates) — a trap worth typing.
 */
export interface FrappeBootSysDefaults {
	/** ERPNext's default company. Not set on a bare frappe site. */
	company?: string;
	/** e.g. `"yyyy-mm-dd"`. Read unguarded at `frappe/public/js/frappe/desk.js:341`. */
	date_format?: string;
	/** e.g. `"HH:mm:ss"`. formatters.js:251 falls back to that literal. */
	time_format?: string;
	country?: string;
	/** Read back out at `frappe/boot.py:269` (`add_timezone_info`). */
	time_zone?: string;
	/** Digits after the decimal point; read through `cint()` at formatters.js:63. */
	float_precision?: string;
	currency_precision?: string;
	currency?: string;
	/** `frappe/defaults.py:116` — `defaults.update(user=user, owner=user)`. */
	user?: string;
	owner?: string;
	/**
	 * A real `boolean`: `frappe/boot.py:52` assigns `frappe.is_setup_complete()`,
	 * which returns a Python `bool` (`frappe/__init__.py:1537-1551`) — **not** the
	 * `0 | 1` a DocField Check would give.
	 */
	setup_complete?: boolean;
	[key: string]: string | readonly string[] | boolean | undefined;
}

/**
 * One entry of `frappe.boot.app_data`.
 * Source: `frappe/boot.py:203-227` (`load_desktop_data`).
 *
 * `app_logo_url` is `string | string[]`, not `string`: boot.py:221-223 falls back
 * to `frappe.get_hooks("app_logo_url", …)`, and `get_hooks` returns a **list**.
 * `frappe/public/js/frappe/ui/sidebar/sidebar_header.js:318` reads it straight
 * into an `<img src>` and gets away with it because a one-element list
 * stringifies to its element. The type records the hazard.
 */
export interface FrappeBootAppEntry {
	app_name: string;
	app_title: string;
	/** `""` when the app has neither an `app_home` hook nor an allowed workspace. */
	app_route: string;
	app_logo_url: string | readonly string[];
	/** `Module Def` names (boot.py:224). */
	modules: string[];
	/** Workspace names the current user may see (boot.py:190-201). */
	workspaces: string[];
}

/**
 * `frappe.boot.user` — the current user, denormalised.
 * Source: `frappe/utils/user.py:218-281` (`UserPermissions.load_user`), plus
 * `frappe/sessions.py:183` (`impersonated_by`) and
 * `frappe/public/js/frappe/desk.js:346` (`last_selected_values`, set client-side).
 */
export interface FrappeBootUser {
	/** The user id / email. `frappe/utils/user.py:255`. */
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
	show_absolute_datetime_in_timeline?: FrappeCheck;
	/** `frappe/utils/user.py:256` — `frappe.parse_json` of the stored JSON. */
	onboarding_status?: Record<string, unknown> | null;
	/** user.py:244-253 — expanded from a name into `{name, public, title}`, or `null`. */
	default_workspace?: { name: string; public?: FrappeCheck; title?: string } | null;
	/** user.py:257 — role names. */
	roles: string[];
	/** user.py:258 — same shape as {@link FrappeBootSysDefaults}, user-scoped. */
	defaults: FrappeBootSysDefaults;
	/** user.py:259-278 — permission caches, each a de-duplicated list of doctype names. */
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
	can_import: string[];
	can_print: string[];
	can_email: string[];
	allow_modules: string[];
	permitted_modules: string[];
	in_create: string[];
	all_read: string[];
	/** user.py:280. */
	all_reports: Record<string, unknown>;
	/** `frappe/sessions.py:183` — set only while impersonating. */
	impersonated_by?: string | null;
	/** Created client-side at `frappe/public/js/frappe/desk.js:346`. */
	last_selected_values?: Record<string, unknown>;
}

/**
 * `frappe.boot` — the server-rendered bootstrap blob.
 *
 * Assigned as a raw JSON literal in the desk page itself:
 * `frappe/www/desk.html:54` (`frappe.boot = {{ frappe.utils.orjson_dumps(boot, …) }};`).
 * Built by `frappe/boot.py:36-139` (`get_bootinfo`) and extended by
 * `frappe/sessions.py:148-189`.
 *
 * The index signature is load-bearing, not laziness: `boot.py:99-100` runs every
 * `boot_session` hook and `sessions.py:169-170` every `extend_bootinfo` hook, so
 * any installed app can add top-level keys (ERPNext adds a dozen). Named members
 * stay exact.
 *
 * **Consumer hazard.** `const boot = (window.frappe && frappe.boot) || {};`
 * infers `FrappeBoot | {}` and every subsequent property read fails under
 * `strict`. Annotate the binding instead:
 * `const boot: FrappeBootPartial = (window.frappe && frappe.boot) || {};`
 * — `{}` is assignable to a `Partial`, and each read then yields `T | undefined`,
 * which is exactly what the `&&` guards downstream already assume.
 */
export interface FrappeBoot {
	/** boot.py:51. Always present server-side. */
	sysdefaults: FrappeBootSysDefaults;
	/** boot.py:175, 203. Always an array (possibly empty). */
	app_data: FrappeBootAppEntry[];
	/** boot.py:46 → `frappe/utils/user.py:218`. */
	user: FrappeBootUser;
	/**
	 * `frappe/boot.py:233` (`bootinfo["lang"] = frappe.lang`) and
	 * `frappe/sessions.py:172`. Coerced to `str` at boot.py:102-103.
	 * Used as an index into the datatable translation table
	 * (`frappe/public/js/frappe/views/reports/report_view.js:344`).
	 */
	lang: string;
	/** boot.py:110 — `{ language_name: language_code }`. */
	lang_dict: Record<string, string>;
	/** boot.py:234 — the translation dictionary; copied to `frappe._messages` (desk.html:55). */
	__messages: Record<string, string>;
	/** boot.py:50 — `frappe.local.site`. */
	sitename: string;
	/** boot.py:54 — `YYYY-MM-DD`. */
	server_date: string;
	/** boot.py:104 — `{ app_name: version }`. */
	versions: Record<string, string>;
	/** boot.py:165 — bytes. `frappe/public/js/frappe/request.js:198` falls back to 5242880. */
	max_file_size: number;
	/** sessions.py:166 — merged `assets.json` + `assets-rtl.json`; see {@link FrappeAssetsJson}. */
	assets_json: FrappeAssetsJson;
	/** sessions.py:167 — `bool(frappe.flags.read_only)`, a real boolean. */
	read_only: boolean;
	/** sessions.py:175 — `frappe.is_setup_complete()`, a real boolean. */
	setup_complete: boolean;
	/** sessions.py:182 — `"Light"` | `"Dark"` | `"Automatic"`. */
	desk_theme: string;
	/** sessions.py:184 — the Navbar Settings single doc. */
	navbar_settings: Record<string, unknown>;
	/** sessions.py:161, only present on a live request after a cache clear. */
	change_log?: unknown[];
	/** sessions.py:163-165. Compared with `localStorage.metadata_version` at desk.js:325. */
	metadata_version: string;
	/** sessions.py:173 — from site config. */
	disable_async?: boolean;
	/** boot.py:118 — resolved through Navbar Settings. */
	app_logo_url: string;
	/** boot.py:67-68. */
	active_domains: string[];
	all_domains: string[];
	/** boot.py:72-74 — doctype-name lists. */
	single_types: string[];
	nested_set_doctypes: string[];
	tree_view_doctypes: string[];
	/** boot.py:71 — `{ module_name: app_name }`. */
	module_app: Record<string, string>;
	/** boot.py:59-60. */
	modules: Record<string, unknown>;
	module_list: string[];
	/** boot.py:75, 265-266 — the landing route name; `"desktop"` when unresolvable. */
	home_page: string;
	/** boot.py:95 — `Page` / `Print Settings` / country / currency docs, synced into `locals`. */
	docs: FrappeDoc[];
	/** boot.py:66 — `{ letter_head_name: { header, footer } }`. */
	letter_heads: Record<string, { header?: string; footer?: string }>;
	/** boot.py:107-108 — hook lists. */
	calendars: string[];
	treeviews: string[];
	/** boot.py:109, 113 — Python `bool(...)`. */
	has_awesomebar_search: boolean;
	sms_gateway_enabled: boolean;
	/** boot.py:124 — Python `bool`. */
	is_fc_site: boolean;
	/** boot.py:106 — from site config; absent when unset. */
	error_report_email?: string;
	/** boot.py:131-132 — present only when configured. */
	sentry_dsn?: string;
	/** boot.py:115, 119-120 — doctype-name lists. */
	link_preview_doctypes: string[];
	link_title_doctypes: string[];
	translated_doctypes: string[];
	/** boot.py:134 — app names. */
	setup_wizard_completed_apps: string[];
	/** boot.py:136 — `get_icon_style()` clamps to these two (`frappe/boot.py:142-146`). */
	desktop_icon_style: "Subtle" | "Solid";
	/** boot.py:135. */
	desktop_icon_urls: Record<string, unknown>;
	/** boot.py:65. */
	desktop_icons: unknown[];
	/** boot.py:117 — the User's desk feature toggles. */
	desk_settings: Record<string, unknown>;
	/** boot.py:83-86. */
	notification_settings: Record<string, unknown>;
	notification_unread_count: number;
	/** boot.py:87. */
	onboarding_tours: unknown[];
	/** boot.py:114. */
	frequently_visited_links: unknown[];
	/** boot.py:116. */
	additional_filters_config: Record<string, unknown>;
	/** boot.py:121. */
	doctype_ptype_map: Record<string, unknown>;
	/** boot.py:126. */
	cloud_settings: Record<string, unknown>;
	/** boot.py:123. */
	marketplace_apps: unknown;
	/** boot.py:125. */
	changelog_feed: unknown[];
	/** boot.py:111 — `Success Action` rows. */
	success_action: unknown[];
	/** boot.py:69 — `DocType Layout` rows. */
	doctype_layouts: Array<{ name: string; route?: string; document_type?: string }>;
	/** boot.py:77, 269-273. */
	timezone_info: {
		zones: Record<string, unknown>;
		rules: Record<string, unknown>;
		links: Record<string, unknown>;
	};
	/** boot.py:79, 283-289 — the compiled print stylesheet. */
	print_css: string;
	/** boot.py:57 — only for a signed-in session. */
	user_info?: Record<string, unknown>;
	/** boot.py:91-92 — only when the session recorded it. */
	ipinfo?: Record<string, unknown>;
	/** boot.py:127-129. */
	enable_address_autocompletion?: unknown;
	/** boot.py:137-138 — Frappe Cloud sites only. */
	site_info?: Record<string, unknown>;
	/** boot.py:166-168 — mirrored from site config only when present. */
	developer_mode?: number | boolean;
	socketio_port?: number;
	file_watcher_port?: number;
	/**
	 * Built **client-side** by `frappe/public/js/frappe/desk.js:347-361`
	 * (`sync_pages`), not by the server. Absent on first paint.
	 */
	allowed_pages?: string[];
	/** Server-provided page metadata that `sync_pages` diffs against localStorage. */
	page_info?: Record<string, { modified?: string; [key: string]: unknown }>;
	/**
	 * Open by design — `boot.py:99-100` (`boot_session` hooks) and
	 * `sessions.py:169-170` (`extend_bootinfo` hooks) let any app add keys.
	 */
	[key: string]: unknown;
}

/**
 * Use this, not `FrappeBoot`, when annotating a defensively-guarded read such as
 * `(window.frappe && frappe.boot) || {}` — see the hazard note on {@link FrappeBoot}.
 */
export type FrappeBootPartial = Partial<FrappeBoot>;

/**
 * `frappe.session` — populated at `frappe/public/js/frappe/desk.js:332-335`
 * (`set_globals`) and reset at desk.js:364-366 (`set_as_guest`). The namespace
 * object itself is created empty by `frappe.provide("frappe.session")`
 * (`frappe/public/js/frappe/provide.js:32`), so on a Guest/website page it may
 * be `{}` — hence every member is optional.
 *
 * `user` and `logged_in_user` differ only after the session expires: request.js
 * treats `user === "Guest" && logged_in_user !== "Guest"` as the expiry signal
 * (request.js:152, 437).
 */
export interface FrappeSession {
	/** desk.js:332 / :364 — the user id, or the literal `"Guest"`. */
	user?: string;
	/** desk.js:333 — never reset to `"Guest"` by `set_as_guest`. */
	logged_in_user?: string;
	/** desk.js:334 / :365. */
	user_email?: string;
	/** desk.js:335 / :366. */
	user_fullname?: string;
}

/**
 * `sites/assets/assets.json` and `assets-rtl.json`: bundle source name → built,
 * hashed, site-absolute URL. Written by frappe's own esbuild with 4-space
 * indent (`frappe/esbuild/esbuild.js:157`, `JSON.stringify(obj, null, 4)`),
 * merged and served to the client as `frappe.boot.assets_json`
 * (`frappe/utils/__init__.py:950-968`, `frappe/sessions.py:166`).
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
 * Source: `frappe/public/js/frappe/list/list_view.js:1189-1206`.
 */
export interface FrappeListViewSettingsButton {
	show(doc: FrappeDoc): boolean;
	/** A **function** here — contrast `dropdown_button.get_label`, which is a string. */
	get_label(doc: FrappeDoc): string;
	get_description(doc: FrappeDoc): string;
}

/**
 * One entry of `listview_settings.dropdown_button.buttons`.
 * Source: `frappe/public/js/frappe/list/list_view.js:1213-1224`.
 */
export interface FrappeListViewSettingsDropdownItem {
	/** Optional: `if (!button.show || button.show(doc))` (list_view.js:1214). */
	show?(doc: FrappeDoc): boolean;
	/** A **string**, interpolated directly (list_view.js:1220). Upstream inconsistency, preserved. */
	get_label: string;
	get_description?(doc: FrappeDoc): string;
}

/**
 * `listview_settings.dropdown_button`.
 * Source: `frappe/public/js/frappe/list/list_view.js:1209-1240`.
 */
export interface FrappeListViewSettingsDropdown {
	/** A **string** (list_view.js:1229, :1235), unlike `button.get_label`. */
	get_label: string;
	buttons: FrappeListViewSettingsDropdownItem[];
}

/**
 * One doctype's entry in `frappe.listview_settings`.
 *
 * The namespace is created empty by `frappe.provide("frappe.listview_settings")`
 * (`frappe/public/js/frappe/provide.js:37`) and each doctype's
 * `<doctype>_list.js` assigns into it; `frappe/public/js/frappe/list/base_list.js:45`
 * reads `frappe.listview_settings[this.doctype] || {}`, so *every* member is
 * optional and a missing doctype is normal.
 */
export interface FrappeListViewSettings {
	/** list_view.js:219 — extra fieldnames to fetch. */
	add_fields?: string[];
	/** list_view.js:107, :610 — default filters as `[fieldname, operator, value]` triples. */
	filters?: ReadonlyArray<readonly unknown[]>;
	/** list_view.js:1036-1040, :1349-1350 — per-fieldname cell renderers. */
	formatters?: Record<
		string,
		(value: unknown, df: DocField, doc: FrappeDoc) => string | undefined
	>;
	/** list_view.js:1296-1297 — override the row link target. */
	get_form_link?(doc: FrappeDoc): string;
	/**
	 * `frappe/public/js/frappe/model/indicator.js:7, 37` — `[label, colour, filter?]`.
	 *
	 * SEAM — the tuple was spelled inline here and imported as `IndicatorTuple`
	 * from `./model` by `views.d.ts`. `model.d.ts` won ownership (indicator.js is
	 * under `frappe/public/js/frappe/model/`); the shape is unchanged.
	 */
	get_indicator?(doc: FrappeDoc): IndicatorTuple;
	/** list_view.js:484. */
	hide_name_column?: boolean;
	hide_name_filter?: boolean;
	/** list_view.js:366 — called once with the list view instance. */
	onload?(listview: unknown): void;
	/** base_list.js:552-553 — called on every refresh with the list view instance. */
	refresh?(listview: unknown): void;
	/** list_view.js:658. */
	before_render?(): void;
	/** list_view.js:292-293, :303-304, :1737-1738 — replaces the primary button action. */
	primary_action?(): void;
	button?: FrappeListViewSettingsButton;
	dropdown_button?: FrappeListViewSettingsDropdown;
	/** `frappe/public/js/frappe/list/list_settings.js:79`. */
	total_fields?: number | string;
	/** `frappe/public/js/frappe/list/list_settings.js:13` — a JSON string, not an array. */
	fields?: string;
	/** Apps hang arbitrary helpers here (e.g. `frappe.listview_settings["DocType"].new_doctype_dialog`). */
	[key: string]: unknown;
}

// ---------------------------------------------------------------------------
// The frappe-core slice of the `frappe` global
// ---------------------------------------------------------------------------

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

	/** `frappe/www/desk.html:54`. */
	boot: FrappeBoot;
	/** `frappe/public/js/frappe/provide.js:32` + `desk.js:332-335`. */
	session: FrappeSession;
	/** `frappe/public/js/frappe/db.js:4`. */
	db: FrappeDb;
	/** `frappe/public/js/frappe/form/formatters.js:6`. */
	form: FrappeFormNamespace;
	/** `frappe/public/js/frappe/request.js:6`. */
	request: FrappeRequest;
	/** `frappe/public/js/frappe/provide.js:37`; indexed by doctype at base_list.js:45. */
	listview_settings: Record<string, FrappeListViewSettings | undefined>;

	// -- scalars ------------------------------------------------------------

	/** `frappe/www/desk.html:56`. Sent as the `X-Frappe-CSRF-Token` header (request.js:267). */
	csrf_token: string;
	/** `frappe/www/desk.html:55` — `frappe.boot["__messages"]`; also merged into by request.js:293. */
	_messages: Record<string, string>;
	/** Created lazily at `frappe/public/js/frappe/request.js:299-302`. */
	_link_titles?: Record<string, string>;
	/** `frappe/public/js/frappe/request.js:280` — the last `$.ajax` `data` payload. */
	last_request?: Record<string, unknown>;
	/** `frappe/public/js/frappe/request.js:501` — the last parsed response, or `null`. */
	last_response?: FrappeResponse | null;
	/** The singleton msgprint dialog, created on first use (messages.js:186-207). */
	msg_dialog?: FrappeDialog;
	/** The singleton server-error dialog (request.js:607-611). */
	error_dialog?: FrappeDialog;
	/** The live progress dialog, or `null` after `hide_progress` (messages.js:391, 409). */
	cur_progress?: FrappeDialog | null;
	/** `frappe/public/js/frappe/model/create_new.js:363` — doctype → route override for `new_doc`. */
	create_routes: Record<string, string | readonly string[]>;
	/** Cached at `frappe/public/js/frappe/translate.js:29-38`. */
	languages?: Array<{ label: string; value: string }>;

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
	 *     (request.js:282). `frappe.db.get_doc` relies on `.fail` being there
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
	 * `frappe/public/js/frappe/request.js:504-514` — resolves once the in-flight
	 * count drains. Returns **`null`**, not a resolved promise, when nothing is in
	 * flight; `await null` is fine but `.then()` on it is not.
	 */
	after_server_call(): Promise<void> | null;
	/** `frappe/public/js/frappe/request.js:516-528` — always returns a Promise. */
	after_ajax<T = void>(fn?: () => T | PromiseLike<T>): Promise<T>;
	/**
	 * `frappe/public/js/frappe/dom.js:375-384` — `navigator.onLine`, forced `true`
	 * in developer mode.
	 */
	is_online(): boolean;

	// -- messages -----------------------------------------------------------

	/**
	 * Source: `frappe/public/js/frappe/ui/messages.js:117-315`; also aliased as the
	 * bare global `window.msgprint` (messages.js:317).
	 *
	 * Returns `undefined` on the early-exit paths: falsy `msg` (messages.js:118),
	 * an array `message` that recursed (messages.js:170), and the
	 * `alert`/`toast` divert (messages.js:175).
	 *
	 * A `string` beginning with `{` is `JSON.parse`d and treated as an options
	 * object (messages.js:124-126) — a genuine hazard when printing user data.
	 */
	msgprint(
		msg: string | FrappeMsgprintOptions | readonly unknown[],
		title?: string,
		is_minimizable?: boolean,
		re_route?: boolean
	): FrappeDialog | undefined;

	/**
	 * `frappe/public/js/frappe/ui/messages.js:20-27` — msgprints, then
	 * `throw new Error(msg.message)`. Never returns.
	 */
	throw(msg: string | FrappeThrowOptions): never;

	/** `frappe/public/js/frappe/ui/messages.js:319-333`. */
	hide_msgprint(instant?: boolean): void;
	/** `frappe/public/js/frappe/ui/messages.js:336-342` — replaces the body, or opens one. */
	update_msgprint(html: string): void;

	/**
	 * `frappe/public/js/frappe/ui/messages.js:29-63`.
	 * `message` is injected raw into `<p class="frappe-confirm-message">` — HTML,
	 * not text. `reject_action` fires from `onhide` only when the primary action
	 * was never fulfilled (messages.js:54-60).
	 */
	confirm(
		message: string,
		confirm_action?: () => void,
		reject_action?: () => void,
		primary_label?: string,
		secondary_label?: string
	): FrappeDialog;

	/**
	 * `frappe/public/js/frappe/ui/messages.js:65-84` — a red-buttoned confirm.
	 * `message_html` is injected raw.
	 */
	warn(
		title: string,
		message_html: string,
		proceed_action?: () => void,
		primary_label?: string,
		is_minimizable?: boolean
	): FrappeDialog;

	/**
	 * `frappe/public/js/frappe/ui/messages.js:86-115`.
	 * A `string` `fields` is widened into a single required Data field named
	 * `"value"` (messages.js:87-96); a lone object is wrapped in an array
	 * (messages.js:97). `callback` fires only when `d.get_values()` validates.
	 */
	prompt(
		fields: string | Partial<DocField> | ReadonlyArray<Partial<DocField>>,
		callback: (values: Record<string, unknown>) => void,
		title?: string,
		primary_label?: string
	): FrappeDialog;

	/** `frappe/public/js/frappe/ui/messages.js:344-368` — prompts, verifies server-side, then calls back. */
	verify_password(callback: () => void): void;

	/**
	 * Floating toast. Source: `frappe/public/js/frappe/ui/messages.js:414-483`.
	 * Returns the alert's jQuery node. `seconds` defaults to 7 and is reduced by
	 * 0.8 for the exit animation when > 2 (messages.js:472-475). `actions` binds
	 * click handlers to `[data-action=<key>]` inside `message.body`.
	 */
	show_alert(
		message: string | FrappeShowAlertOptions,
		seconds?: number,
		actions?: FrappeShowAlertActions
	): FrappeJQuery;
	/** `frappe/public/js/frappe/ui/messages.js:414` — the same function object as `show_alert`. */
	toast(
		message: string | FrappeShowAlertOptions,
		seconds?: number,
		actions?: FrappeShowAlertActions
	): FrappeJQuery;

	/**
	 * `frappe/public/js/frappe/ui/messages.js:370-404`. Reuses the live dialog when
	 * `title` matches. `total` defaults to 100, `hide_on_completion` to `false`.
	 */
	show_progress(
		title: string,
		count: number,
		total?: number,
		description?: string,
		hide_on_completion?: boolean
	): FrappeDialog;
	/** `frappe/public/js/frappe/ui/messages.js:406-411`. */
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
	// `frappe/public/js/frappe/model/model.js:869-871` merely aliases onto the
	// root ("// legacy"), so the model group owns them. Nothing was dropped — the
	// generic parameter and every note from this copy were folded into
	// {@link FrappeModelMetaGlobals}, which is the only remaining declaration and
	// is reachable from `Frappe` exactly as before.

	/**
	 * `frappe/public/js/frappe/model/create_new.js:364-385`.
	 *
	 * Returns `undefined` for `doctype === "File"` (it opens a FileUploader and
	 * bails, create_new.js:365-370); otherwise a Promise that resolves once the
	 * route change or quick-entry dialog has been set up — it does **not** resolve
	 * with the new document. A plain-object `opts` is stashed in
	 * `frappe.route_options` (create_new.js:373-375).
	 */
	new_doc(
		doctype: string,
		opts?: { folder?: string } | Record<string, unknown>,
		init_callback?: (doc: FrappeDoc) => void
	): Promise<void> | undefined;

	// -- formatting ---------------------------------------------------------

	/**
	 * Render one value with the formatter for its fieldtype.
	 * Source: `frappe/public/js/frappe/form/formatters.js:426-450`.
	 *
	 * Notable behaviour the type cannot express: a missing `df`, or a fieldname
	 * listed in the doctype's `masked_fields`, is replaced by
	 * `{ fieldtype: "Data" }` (formatters.js:433); `_user_tags` is forced to the
	 * `Tag` formatter (formatters.js:434); `Dynamic Link` is resolved to `Link`
	 * and stamps `df._options` **onto the caller's docfield object**
	 * (formatters.js:438-441). String output is passed through
	 * `frappe.dom.remove_script_and_style` (formatters.js:447).
	 */
	format(
		value: unknown,
		df?: DocField | null,
		options?: FrappeFormatterOptions | null,
		doc?: FrappeDoc
	): string | number;

	/**
	 * `frappe/public/js/frappe/form/formatters.js:452-464` — a shallow copy of
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
 * `frappe.ui.toolbar.Toolbar` — the desk navbar controller.
 * Source: `frappe/public/js/frappe/ui/toolbar/toolbar.js:7-37`.
 *
 * The contract carbon_frappe depends on is in the constructor: `$("header")` is
 * replaced **only** under four conditions (toolbar.js:9-20) — `boot.read_only`,
 * `boot.user.impersonated_by`, an undismissed announcement widget, or
 * `frappe.is_mobile()`. Otherwise the empty `<header></header>` from
 * `frappe/www/desk.html:39` survives, which is what the Carbon UI Shell mounts
 * into. `scripts/markup-manifest.mjs:236-240` asserts both halves statically.
 *
 * Declared, not modelled: the class has no constructor parameters and everything
 * else on it is internal wiring.
 */
export declare class FrappeToolbar {
	constructor();
	/** toolbar.js:34-38 — binds events, fires the `toolbar_setup` document event. */
	make(): void;
	/** toolbar.js:36 — `$(".navbar-brand")`. */
	navbar?: FrappeJQuery;
}

/**
 * `frappe.ui.ThemeSwitcher` — the "Switch Theme" dialog.
 * Source: `frappe/public/js/frappe/ui/theme_switcher.js:3-143`.
 *
 * The contract carbon_frappe depends on: theming is communicated **only** through
 * DOM attributes, with no event and no realtime publish —
 * `toggle_theme` writes `data-theme-mode` (theme_switcher.js:129) and
 * `frappe.ui.set_theme` writes `data-theme` (theme_switcher.js:162) on
 * `document.documentElement`. A `MutationObserver` on that attribute is
 * therefore the only available hook, which is exactly what
 * `carbon_charts.bundle.js:154-157` installs.
 * `scripts/audit-tokens.mjs:97` asserts the `setAttribute("data-theme", …)` call
 * still exists.
 */
export declare class FrappeThemeSwitcher {
	constructor();
	/** theme_switcher.js:45-51 — re-reads `data-theme-mode` and re-renders. */
	refresh(): void;
	/** theme_switcher.js:126-134 — lowercases, writes `data-theme-mode`, persists server-side. */
	toggle_theme(theme: string): void;
	show(): void;
	hide(): void;
	/** theme_switcher.js:46 — the current `data-theme-mode`, defaulting to `"light"`. */
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
 *   // desk.html:52 and provide.js:5 both do `if (!window.frappe) window.frappe = {}`.
 *   // Every carbon_frappe call site probes `window.frappe` and then dereferences
 *   // the BARE identifier, so both spellings must exist and resolve to one type.
 *   var frappe: Frappe;
 *
 *   // translate.js:26 — `window.__ = frappe._`.
 *   var __: FrappeTranslate;
 *
 *   // messages.js:317 — `window.msgprint = frappe.msgprint`.
 *   var msgprint: Frappe["msgprint"];
 *
 *   interface Window {
 *     // Declared OPTIONAL on purpose. `if (!window.frappe) return;`
 *     // (tables/grid/install.js:21, tables/datatable/install.js:24) becomes dead
 *     // code under strictNullChecks if this is required, and the engine really is
 *     // loaded outside a desk by scripts/dev-table.mjs.
 *     frappe?: Frappe;
 *
 *     // desk.html:50 — `window.dev_server = {{ dev_server }};`. See FrappeDevServer.
 *     dev_server?: number;
 *
 *     // translate.js:26. Optional for the same headless reason; datatable.js:34-36
 *     // probes it with `typeof window.__ === "function"`.
 *     __?: FrappeTranslate;
 *
 *     // messages.js:317.
 *     msgprint?: Frappe["msgprint"];
 *
 *     // desk.html:49 / :47.
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
 *   // utils/utils.js:12-26 — installed together, behind ONE `if (!Array.prototype.uniqBy)`.
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
 * "undefined"` guard at `tables/grid/grid.js:72` type-checks against the lib
 * declaration unchanged.
 */
export type FrappeCoreGlobalWiring = never;

/**
 * `window.dev_server`, emitted raw into the desk page at
 * `frappe/www/desk.html:50` (`window.dev_server = {{ dev_server }};`).
 *
 * The value is an **int**, not a bool: `frappe/__init__.py:85` computes
 * `_dev_server = int(sbool(os.environ.get("DEV_SERVER", False)))`, so the page
 * receives the literal `0` or `1`. (A Python bool would have rendered as `True`
 * and been a syntax error in JS.) Declared as `number` rather than `0 | 1` so an
 * app that overrides the template is not made to lie; every reader in frappe and
 * in carbon_frappe uses it for truthiness only (`assets.js:114`,
 * `request.js:273`, `socketio_client.js:122`, `anatomy/patch.js:80`).
 */
export type FrappeDevServer = number;

/**
 * frappe's two `Array.prototype` additions.
 *
 * Source: `frappe/public/js/frappe/utils/utils.js:12-26`. Both are installed
 * inside a single `if (!Array.prototype.uniqBy)` guard, so `move` exists if and
 * only if `uniqBy` does.
 *
 * **`move` returns `undefined`.** The body is `this.splice(to, 0, this.splice(from, 1)[0]);`
 * with no `return` (utils.js:23). A signature of `move(from, to): T[]` — which the
 * usage inference proposed — would let a consumer chain off a value that does not
 * exist. `frappe/public/js/frappe/form/grid_row.js:176` correctly uses it for its
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
 * - `true` on a class object — `carbon_charts.bundle.js:150`
 *   (`frappe.Chart.__carbon_frappe = true`);
 * - `true` on a frappe namespace object — `carbon_desk.bundle.js:45`
 *   (`f.__carbon_frappe = true` on `frappe.form.formatters`);
 * - a **string** patch id on a wrapped function — `anatomy/patch.js:53`
 *   (`patched.__carbon_frappe = id`).
 *
 * So a single `interface Function { __carbon_frappe?: string }` augmentation is
 * wrong for the first two. Every read site is a truthiness test
 * (`carbon_charts.bundle.js:136`, `carbon_desk.bundle.js:17`, `patch.js:40`), so
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

// Server calls from compiled TypeScript: the type argument reaches the
// response, the awaited result is never `any`, and frm.call shares the typing.

import type {
	FrappeAjaxResult,
	FrappeDoc,
	FrappeResponse,
	FrappeServerMessage,
	FrappeXcallResult,
} from "frappe-types";

interface Contact {
	name: string;
	email_id: string | null;
}

export async function contacts(): Promise<Contact[]> {
	const r = await frappe.call<Contact[]>({ method: "app.api.contacts" });
	// `message` is absent when the method returns None, so it is optional.
	return r.message ?? [];
}

export async function xcall_contacts(): Promise<Contact[]> {
	const rows: Contact[] = await frappe.xcall<Contact[]>("app.api.contacts");
	return rows;
}

export function typed_then(): void {
	void frappe.call<Contact[]>("app.api.contacts").then((r) => r.message?.[0]?.email_id);
	// @ts-expect-error an annotation that contradicts the type argument is rejected
	void frappe.call<Contact[]>("app.api.contacts").then((r: FrappeResponse<number>) => r);
	// .done / .fail stay jQuery's, with the response as the resolved value.
	frappe
		.call<Contact[]>({ method: "app.api.contacts" })
		.done((r) => void r.message?.length)
		.fail(() => undefined);
	// The response mistaken for its message is rejected, with or without T.
	// @ts-expect-error a Contact is not a response envelope
	void frappe.call<Contact>("app.api.contact").then((c: Contact) => c.name);
	// @ts-expect-error a Contact is not a response envelope
	void frappe.call("app.api.contact").then((c: Contact) => c.name);
	// @ts-expect-error nor in .done
	frappe.call<Contact>("app.api.contact").done((c: Contact) => void c.name);
}

// A hand-written envelope, as an interface (messaging, espresso_sync,
// little_cocalico): accepted, and checked against T.
interface Envelope<T> {
	message: T;
}
export function interface_envelope(): void {
	void frappe.call({ method: "app.api.secret" }).then((r: Envelope<string>) => r.message.length);
	frappe.call({ method: "app.api.secret" }).done((r: Envelope<string>) => void r.message.length);
	void frappe.call<string>({ method: "app.api.secret" }).then((r: Envelope<string>) => r.message.length);
	// @ts-expect-error the envelope's message contradicts T
	void frappe.call<string>({ method: "app.api.secret" }).then((r: Envelope<Contact>) => r.message.name);
}

// API v2: the payload is `data`.
export async function v2_contacts(): Promise<Contact[]> {
	const r = await frappe.call<Contact[]>({ method: "app.api.contacts", api_version: "v2" });
	return r.data ?? [];
}

// An unregistered doctype: T comes from the explicit argument or the context.
interface ItemDoc extends FrappeDoc {
	item_name: string;
}
export async function load_item(): Promise<string> {
	const a: ItemDoc = await frappe.db.get_doc("Item", "ITEM-0001");
	const b = await frappe.db.get_doc<ItemDoc>("Item", "ITEM-0001");
	return a.item_name + b.item_name;
}

// Awaited, the response is FrappeResponseFields: frappe's own keys. A key the
// method adds (the login response's `home_page`) needs the open FrappeResponse,
// which the awaited value is assignable to; an unannotated `.then` has it.
export async function login_response(): Promise<unknown> {
	const r = await frappe.call({ method: "login", args: { usr: "u", pwd: "p" } });
	// @ts-expect-error only frappe's own keys are declared on the awaited value
	void r.full_name;
	const open: FrappeResponse = r;
	const full_name = await frappe.call({ method: "login" }).then((res) => res.full_name);
	return open.home_page ?? full_name;
}

export async function untyped_is_unknown(): Promise<void> {
	const r = await frappe.call({ method: "app.api.count" });
	// @ts-expect-error the default T is unknown, not any
	const n: number = r.message;
	void n;
}

export async function form_call(frm: frappe.ui.form.Form<"Project">): Promise<number> {
	const r = await frm.call<{ total: number }>("get_totals", { include_tax: 1 });
	frm.call<string>({ method: "app.api.rename", args: { name: frm.doc.name }, callback: (res) => void res.message?.length });
	return r.message?.total ?? 0;
}

// Wrapped in a native promise, and settled together (esign_webforms, messaging).
export async function wrapped(): Promise<void> {
	const html = await Promise.resolve(frappe.call<{ html: string }>({ method: "app.api.print_html" })).then(
		(r) => r.message?.html ?? "",
	);
	const [a, b] = await Promise.allSettled([
		frappe.call<Contact[]>({ method: "app.api.contacts" }),
		frappe.call<number>({ method: "app.api.count" }),
	]);
	const first: Contact | undefined = a.status === "fulfilled" ? a.value.message?.[0] : undefined;
	const count: number | undefined = b.status === "fulfilled" ? b.value.message : undefined;
	void html, first, count;
}

// The jqXHR and the xcall promise are still a jqXHR and a Promise.
export const xhr: JQuery.jqXHR<FrappeResponse<number>> = frappe.call<number>("app.api.count");
export const xhr_alias: FrappeAjaxResult<number> = frappe.call<number>("app.api.count");
export const promise: Promise<number> = frappe.xcall<number>("app.api.count");
export const xcall_alias: FrappeXcallResult<number> = frappe.xcall<number>("app.api.count");

// frappe.db.get_value's jqXHR carries the payload type too.
export function customer_name(): void {
	void frappe.db
		.get_value<{ customer_name: string }>("Customer", "CUST-0001", "customer_name")
		.then((r) => r.message?.customer_name);
}

// The raw /api/method body, from a plain fetch (an SPA that skips frappe.call).
export async function raw_call<T>(method: string): Promise<{ data?: T; messages: string[] }> {
	const res = await fetch(`/api/method/${method}`, { method: "POST" });
	const body = (await res.json()) as FrappeResponse<T>;
	const messages = body._server_messages
		? (JSON.parse(body._server_messages) as string[]).map((e) => {
				const m = JSON.parse(e) as FrappeServerMessage;
				return typeof m.message === "string" ? m.message : m.title;
			})
		: [];
	if (body.exception) messages.push(body.exception);
	for (const err of body.errors ?? []) messages.push(err.type);
	return body.message === undefined ? { messages } : { data: body.message, messages };
}

// One translator type for `__` and `frappe._`; `__` fits a string-only
// parameter that a stand-in such as `(txt) => txt` also fits.
export const tr: typeof __ = frappe._;
type Translate = (source: string, replace?: readonly string[]) => string;
export const fallback: Translate = (txt) => txt;
export const real: Translate = __;

// frappe.prompt with a values type, named on the callback's parameter: a
// required field is always there, an empty one is absent.
frappe.prompt(
	[{ fieldname: "subject", fieldtype: "Data", label: "Subject", reqd: 1 }],
	(values: { subject: string; due?: string }) => {
		const subject: string = values.subject;
		const due: string | undefined = values.due;
		void subject, due;
	},
);

// The window helpers are bare globals and Window members.
export const money: string = format_currency(10, "EUR", 2);
export const rounded: number = _round(1.005, 2, "Commercial Rounding");
export const formatted: string = format_currency(10, "EUR", precision("amount"));
export const helper: typeof format_currency | undefined = window.format_currency;
// `map` passes the index as cint's `def`: a number, so the result stays number[].
export const permlevels: number[] = ["0", "1"].map(cint);
export const whole: number = cint("12", 0);
export const maybe: number | null = cint("x", null);
// @ts-expect-error an explicit null default can come back
export const not_null: number = cint("x", null);
declare const untyped_default: any;
// An `any` default reads as a number, as the first of the old overloads did.
export const from_any: number = cint("x", untyped_default);
declare const optional_default: number | undefined;
export const from_optional: number = cint("x", optional_default);

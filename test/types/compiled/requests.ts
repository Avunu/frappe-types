// Server calls from compiled TypeScript: the type argument reaches the
// response, the awaited result is never `any`, and frm.call shares the typing.

import type {
	FrappeAjaxResult,
	FrappeResponse,
	FrappeServerMessage,
	FrappeXcallResult,
	TranslateStringFunction,
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

// One translator type for `__` and `frappe._`, and a string-only stand-in fits
// TranslateStringFunction.
export const tr: typeof __ = frappe._;
export const fallback: TranslateStringFunction = (txt) => txt;
export const real: TranslateStringFunction = __;

// frappe.prompt with a values type.
frappe.prompt<{ subject: string; due?: string }>(
	[{ fieldname: "subject", fieldtype: "Data", label: "Subject", reqd: 1 }],
	(values) => {
		const subject: string = values.subject;
		const due: string | undefined = values.due;
		void subject, due;
	},
);

// The window helpers are bare globals and Window members.
export const money: string = format_currency(10, "EUR", 2);
export const rounded: number = _round(1.005, 2, "Commercial Rounding");
export const helper: typeof format_currency | undefined = window.format_currency;

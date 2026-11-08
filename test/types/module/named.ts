// The module entry on its own (`import type ... from "frappe-types"`): named
// types, the shared doctype registry, and no ambient `frappe`.

import type { DocOf, DocTypeName, Form, FormEvents, FrappeResponse, FrappeServerMessage } from "frappe-types";

declare global {
	interface FrappeDocTypes {
		Task: { subject: string; exp_end_date?: string | null };
	}
}

export const name: DocTypeName = "Task";

export function subject(doc: DocOf<"Task">): string {
	return doc.subject;
}

export const events: FormEvents<"Task"> = {
	refresh(frm: Form<"Task">) {
		void frm.doc.exp_end_date;
	},
};

// @ts-expect-error the module entry installs no `frappe` global
void frappe;

// @ts-expect-error nor the type-space namespace that comes with it
export type NoNamespace = frappe.ui.form.Form;

// An SPA that calls /api/method with fetch types the body from the module entry,
// with no globals installed.
export function first_message(body: FrappeResponse<{ ok: boolean }>): string | undefined {
	if (!body._server_messages) return body.message?.ok ? "ok" : undefined;
	const [entry] = JSON.parse(body._server_messages) as string[];
	if (entry === undefined) return undefined;
	const decoded = JSON.parse(entry) as FrappeServerMessage;
	return typeof decoded.message === "string" ? decoded.message : decoded.title;
}

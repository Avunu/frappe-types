// The module entry on its own (`import type ... from "frappe-types"`): named
// types, the shared doctype registry, and no ambient `frappe`.

import type {
	DocOf,
	DocTypeName,
	Form,
	FormEvents,
	FrappeContactsNamespace,
	FrappePermNamespace,
	FrappeResponse,
	FrappeServerMessage,
	FrappeWorkflowNamespace,
	Permission,
} from "frappe-types";

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

// frappe.perm, frappe.workflow and frappe.contacts, by name.
export function readable(perm: FrappePermNamespace, doctype: string): Permission[] {
	return perm.get_perm(doctype);
}
export function state_field(workflow: FrappeWorkflowNamespace, doctype: string): string | null {
	return workflow.get_state_fieldname(doctype);
}
export function render(contacts: FrappeContactsNamespace, frm: Form): void {
	contacts.render_address_and_contact(frm);
}

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

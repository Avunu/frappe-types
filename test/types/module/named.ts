// The module entry on its own (`import type ... from "frappe-types"`): named
// types, the shared doctype registry, and no ambient `frappe`.

import type { DocOf, DocTypeName, Form, FormEvents } from "frappe-types";

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

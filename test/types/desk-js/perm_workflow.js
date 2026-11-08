// frappe.perm, frappe.workflow and frappe.contacts from plain desk JavaScript,
// written the way data_steward's side panel and erpnext_cis_plus's party records
// use them, with no local declaration of any of the three.

// erpnext_cis_plus party_records.js: the readable permlevels of a doctype.
const readable_permlevels = (/** @type {string} */ doctype) =>
	(frappe.perm.get_perm(doctype) || []).flatMap((perm, permlevel) => (perm?.read ? [permlevel] : []));
/** @type {number[]} */
const levels = readable_permlevels("Customer");
void levels;

// erpnext_cis_plus: has_perm with a permlevel and a ptype, and with a doc.
/** @type {boolean} */
const can_write = frappe.perm.has_perm("Customer", 1, "write");
void can_write;
void frappe.perm.has_perm("Customer");

frappe.ui.form.on("ToDo", {
	refresh(frm) {
		// A saved document's own permissions, and a custom ptype.
		void frappe.perm.has_perm(frm.doctype, 0, "approve", frm.doc);
		/** @type {import("frappe-types").Permission[]} */
		const perm = frappe.perm.get_perm(frm.doctype, frm.doc);

		// data_steward side_panel.js: a field's status from the form's rules.
		for (const df of frm.meta.fields) {
			/** @type {"Write" | "Read" | "None"} */
			const status = frappe.perm.get_field_display_status(df, frm.doc, perm);
			if (status === "Write" && !frappe.perm.is_visible(df.fieldname, frm.doc)) {
				frappe.msgprint(df.fieldname);
			}
		}
		// doc and perm are optional; without either only df decides.
		void frappe.perm.get_field_display_status(frm.meta.fields[0] ?? { fieldname: "x", fieldtype: "Data" });

		// erpnext_cis_plus party_records.js
		frappe.contacts.render_address_and_contact(frm);
		frappe.contacts.clear_address_and_contact(frm);
		frappe.contacts.get_address_display(frm, "customer_address");
		const last = frappe.contacts.get_last_doc(frm);
		if (last.doctype && last.docname) {
			frappe.set_route("Form", last.doctype, last.docname);
		}
	},
});

/**
 * data_steward side_panel.js: frappe.workflow.is_read_only for a document that
 * is not in locals.
 * @param {string} doctype
 * @param {FrappeDoc} doc
 */
function workflow_allows_edit(doctype, doc) {
	const state_field = frappe.workflow.get_state_fieldname(doctype);
	if (!state_field) return true;
	const state = doc[state_field] || frappe.workflow.get_default_state(doctype, doc.docstatus);
	if (!state) return true;
	const roles = frappe.workflow.get_document_state_roles(doctype, String(state));
	return frappe.user_roles.some((role) => roles.includes(role));
}
void workflow_allows_edit;

/** @typedef {import("frappe-types").FrappeDoc} FrappeDoc */

// The Workflow document and its transitions.
const wf = frappe.workflow.workflows["ToDo"];
if (wf) {
	/** @type {string} */
	const field = wf.workflow_state_field;
	void field;
	for (const row of wf.states) {
		/** @type {"0" | "1" | "2"} */
		const doc_status = row.doc_status;
		void [doc_status, row.allow_edit];
	}
}
void frappe.workflow.get_transitions({ doctype: "ToDo", name: "T-1" }).then((transitions) => {
	for (const t of transitions) void [t.action, t.next_state, t.allowed];
});
/** @type {string[]} */
const actions = frappe.workflow.get_all_transition_actions("ToDo");
void actions;

// User Permissions, with and without the default doc.
const user_permissions = frappe.defaults.get_user_permissions()["Company"];
/** @type {string[]} */
const allowed = frappe.perm.filter_allowed_docs_for_doctype(user_permissions, "Sales Order", false);
const with_default = frappe.perm.filter_allowed_docs_for_doctype(user_permissions, "Sales Order");
void [allowed, with_default.allowed_records, with_default.default_doc];

// @ts-expect-error get_perm returns the evaluated Permission array, not a map
void frappe.perm.get_perm("ToDo").read;
// @ts-expect-error a status is one of three strings
/** @type {"Hidden"} */ const hidden = frappe.perm.get_field_display_status({ fieldname: "x", fieldtype: "Data" });
void hidden;
// @ts-expect-error get_state_fieldname can be null: the doctype may have no workflow
/** @type {string} */ const sf = frappe.workflow.get_state_fieldname("ToDo");
void sf;
// @ts-expect-error not a frappe.contacts member
frappe.contacts.render_contacts(cur_frm);

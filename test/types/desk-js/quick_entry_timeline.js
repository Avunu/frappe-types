// The quick entry and timeline globals the apps reach for, with no local
// declaration: pequea's production_operations report, gcl's workflow email
// templates, hrms's job applicant form, and frappe's own address and contact
// list.

// pequea production_operations.js:136-147: an app quick entry form built by
// hand, then installed as the one on screen and set up.
class ProjectQuoteQuickEntryForm extends frappe.ui.form.QuickEntryForm {
	/**
	 * @param {string} doctype
	 * @param {frappe.ui.form.QuickEntryAfterInsert | null} after_insert
	 * @param {null} init_callback
	 * @param {import("frappe-types").FrappeDoc | null} doc
	 * @param {boolean} force
	 */
	constructor(doctype, after_insert, init_callback, doc, force) {
		super(doctype, after_insert, init_callback, doc, force);
		/** @type {string | null} */
		this.project_name = null;
	}

	/** @override */
	render_dialog() {
		super.render_dialog();
		// pequea sales_quote_quick_entry.js:165 (`this.dialog` is the instance)
		this.dialog.onhide = () => (frappe.quick_entry = null);
	}
}

/** @param {string} project_name */
async function show_create_quote_dialog(project_name) {
	const form = new ProjectQuoteQuickEntryForm("Sales Quote", null, null, null, true);
	form.project_name = project_name;
	frappe.quick_entry = form;
	await form.setup();
}
void show_create_quote_dialog("PROJ-0001");

// Read back: optional until the first quick entry, null once it closes.
if (frappe.quick_entry) {
	frappe.quick_entry.set_intro(__("Fill in the quote"), "blue");
}

// gcl workflow_email_template.js:38: edit a saved document in its quick entry.
frappe.quick_edit("Email Template", "Leave Approval");
// A Single: the doctype is its own name.
frappe.quick_edit("System Settings");

// frappe address_and_contact.js:209: new_doc's init_callback gets the quick
// entry dialog (or the document, when the full form opens instead).
frappe.ui.form.on("ToDo", {
	refresh(frm) {
		void frappe.new_doc("Contact", null, (quick_entry) => {
			if (quick_entry instanceof frappe.ui.form.AddressQuickEntryForm) {
				quick_entry.source_frm = frm;
			}
		});

		// hrms job_applicant.js:7, job_offer.js:14: the field emails go to.
		frm.email_field = "email_id";

		// The timeline's helpers the email composer uses.
		const timeline = frm.timeline;
		if (timeline) {
			const recipient = timeline.get_recipient();
			if (typeof recipient === "string" && recipient) frappe.msgprint(recipient);
			const last = timeline.get_last_email(true);
			if (last) void last.name;
			timeline.add_action_button(__("Call"), () => frappe.msgprint(__("Calling")), "phone");
		}
	},
});

// frappe.ui.form.ContactQuickEntryForm, extended with one more detail field.
frappe.ui.form.ContactQuickEntryForm = class extends frappe.ui.form.ContactQuickEntryForm {
	/** @override */
	get_detail_fields() {
		return [
			...super.get_detail_fields(),
			{
				fieldname: "contact_whatsapp",
				label: __("WhatsApp"),
				fieldtype: "Data",
				options: "Phone",
				table: "phone_nos",
				value_field: "phone",
				primary_flag: "is_primary_mobile_no",
			},
		];
	}
};

// frappe.ui.BaseTimeline: a timeline of the app's own entries.
class AuditTimeline extends frappe.ui.BaseTimeline {
	/** @override */
	prepare_timeline_contents() {
		this.timeline_items.push({ content: __("Created"), creation: "2026-01-01 10:00:00", icon: "plus" });
	}
}
const audit = new AuditTimeline({ parent: $(".audit-timeline") });
audit.refresh();
audit.add_timeline_items([{ content: $("<b>"), creation: "2026-01-02 10:00:00", hide_timestamp: true }], true);

/** @type {frappe.ui.BaseTimeline} */
const as_base = audit;
/** @type {frappe.ui.form.AddressQuickEntryForm | undefined} */
let address_dialog;
void as_base;
void address_dialog;

// ---- negative cases -------------------------------------------------------

// @ts-expect-error frappe.quick_entry holds a quick entry form, not any dialog
frappe.quick_entry = new frappe.ui.Dialog({ title: "x" });

frappe.ui.form.on("ToDo", {
	refresh(frm) {
		// @ts-expect-error the recipient is read off the document, so it must be narrowed
		void frm.timeline?.get_recipient().toLowerCase();
		// @ts-expect-error email_field is a fieldname
		frm.email_field = 1;
	},
});

void frappe.new_doc("Contact", null, (quick_entry) => {
	// @ts-expect-error the callback may receive the document instead of the dialog
	quick_entry.source_frm = cur_frm;
});

if (address_dialog) {
	// @ts-expect-error AddressQuickEntryForm#insert takes no values; it inserts the dialog's own
	void address_dialog.insert({ address_line1: "x" });
}

// @ts-expect-error valid_email is defined by the website script only (frappe-types/web)
void valid_email("a@example.com");
// @ts-expect-error BaseTimeline replaces its parent element, which is required
void new frappe.ui.BaseTimeline({});

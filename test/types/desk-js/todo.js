// A doctype script, as `todo.js` would ship. Nothing here is annotated except
// where the pattern under test is the annotation itself: `frm` is typed from
// the `frappe.ui.form.on` call.

frappe.ui.form.on("ToDo", {
	setup(frm) {
		/** @type {"ToDo"} */
		const doctype = frm.doctype;
		void doctype;
	},
	refresh(frm) {
		/** @type {"Open" | "Closed" | "Cancelled"} */
		const status = frm.doc.status;
		if (status === "Open" && !frm.is_new()) {
			frm.add_custom_button(__("Close"), () => {
				void frm.set_value("status", "Closed");
			});
		}
		// standard fields come with every registered doctype
		/** @type {string} */
		const name = frm.doc.name;
		/** @type {0 | 1 | 2 | undefined} */
		const docstatus = frm.doc.docstatus;
		void name, docstatus;
	},
	validate(frm) {
		if (!frm.doc.description.trim()) {
			frappe.msgprint(__("Description is required"));
			frappe.validated = false;
		}
	},
	// a field-change handler, with frappe's (frm, cdt, cdn)
	allocated_to(frm, cdt, cdn) {
		/** @type {string} */
		const doctype = cdt;
		void doctype, cdn;
		return frm.set_value({ priority: "High", date: null });
	},
	// a helper reached through frm.trigger("recalculate"): frappe calls it like
	// any other event, as (frm, cdt, cdn)
	/** @param {frappe.ui.form.Form<"ToDo">} frm */
	recalculate(frm) {
		return frm.trigger("refresh");
	},
});

// The same map, declared first and annotated.
/** @type {frappe.ui.form.FormEvents<"ToDo">} */
const todo_events = {
	onload(frm) {
		/** @type {string | null | undefined} */
		const allocated_to = frm.doc.allocated_to;
		void allocated_to;
	},
};
frappe.ui.form.on("ToDo", todo_events);

// One event at a time.
frappe.ui.form.on("ToDo", "priority", (frm) => {
	/** @type {"High" | "Medium" | "Low" | undefined} */
	const priority = frm.doc.priority;
	void priority;
});

// An unregistered doctype keeps the open document type.
frappe.ui.form.on("Note", {
	refresh(frm) {
		/** @type {unknown} */
		const anything = frm.doc.some_custom_field;
		/** @type {string} */
		const name = frm.doc.name;
		void anything, name;
		void frm.set_value("title", 42);
	},
});

// A typed form is still a Form: APIs typed against the plain Form accept it.
/** @param {frappe.ui.form.Form} frm */
function takes_any_form(frm) {
	return frm.doctype;
}
frappe.ui.form.on("ToDo", { refresh: (frm) => void takes_any_form(frm) });

// A registered doc is still a FrappeDoc.
/** @param {frappe.Doc} doc */
function takes_any_doc(doc) {
	return doc.name;
}
frappe.ui.form.on("ToDo", { refresh: (frm) => void takes_any_doc(frm.doc) });

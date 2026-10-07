// Every line under a `@ts-expect-error` must fail to type-check. If one stops
// failing, tsc reports the directive as unused and the run fails.

frappe.ui.form.on("ToDo", {
	refresh(frm) {
		// @ts-expect-error a registered doctype's document is closed: no such field
		void frm.doc.custmer;
		// @ts-expect-error `status` is a string union, not a number
		void (frm.doc.status * 2);
		// @ts-expect-error not a ToDo field
		void frm.set_value("customer", "x");
		// @ts-expect-error wrong value type for the field
		void frm.set_value("status", "Done");
		// @ts-expect-error wrong value type in the object form
		void frm.set_value({ priority: 3 });
		// @ts-expect-error a standard field is not in fields_dict; frappe throws
		void frm.set_value("name", "x");
		// @ts-expect-error a standard field in the object form
		void frm.set_value({ idx: 2 });
		// @ts-expect-error the object form takes no second argument
		void frm.set_value({ status: "Closed" }, "Open");
		// @ts-expect-error not a Form method
		frm.refresh_feld("status");
	},
});

frappe.ui.form.on("ToDo", {
	// Every function in the map is registered as an event handler, and frappe
	// calls it as (frm, cdt, cdn): a second parameter that is not a string would
	// receive the doctype.
	// @ts-expect-error `force` would be the string cdt
	recalculate(frm, /** @type {boolean} */ force) {
		void frm, force;
	},
});

// @ts-expect-error the doctype is a string
frappe.ui.form.on(42, {});

frappe.ui.form.on("ToDo", {
	// @ts-expect-error a handler must be a function
	refresh: "not a function",
});

/** @type {frappe.ui.form.FormEvents<"ToDo">} */
const events = {
	onload(frm) {
		// @ts-expect-error `frm` is a Form<"ToDo">, whose doc has no `items`
		void frm.doc.items;
	},
};
void events;

frappe.ui.form.on("Sales Order Item", {
	qty(frm) {
		// @ts-expect-error `frm` is the parent's form, so the child's own fields are not on frm.doc
		void frm.doc.item_code;
	},
});

frappe.ui.form.on("Packed Item", {
	qty(frm) {
		// `frm` may be a Quotation, which has no `customer`.
		// @ts-expect-error a field only one of the parents has
		void frm.set_value("customer", "x");
		// @ts-expect-error ... and with a wrong value
		void frm.set_value("customer", 12345);
		// @ts-expect-error the same field in the object form
		void frm.set_value({ customer: "x" });
		// @ts-expect-error a field both parents have, with a wrong value
		void frm.set_value("grand_total", "x");
		// @ts-expect-error reading it is an error too
		void frm.doc.customer;
	},
});

/** @type {frappe.views.ListViewSettings<"ToDo">} */
const list = {
	get_indicator(doc) {
		// @ts-expect-error list rows are partial: `status` may be undefined
		/** @type {string} */ const status = doc.status;
		void status;
		return ["", "gray"];
	},
};
void list;

// @ts-expect-error `frappe.query_reports` may not exist yet; use frappe.provide
frappe.query_reports["X"] = {};

// @ts-expect-error the type-space namespace has no such member
/** @type {frappe.ui.form.FormEventz} */ const typo = {};
void typo;

// @ts-expect-error web-only globals are not part of frappe-types/global
frappe.ready(() => {});

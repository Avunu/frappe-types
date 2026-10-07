// A typed `frm` must still flow into every API typed against the plain
// `frappe.ui.form.Form` — on every supported compiler. TypeScript 5.x measures
// generic variance differently from 7, so this file is the guard that
// `Form<"X">` stays assignable to `Form` there too (scripts/test-types.mjs runs
// it under both).

/** @param {frappe.ui.form.Form} frm */
function helper(frm) {
	return frm.doctype;
}

// An UNREGISTERED doctype: `frm` is Form<"Customer">, with the open document.
frappe.ui.form.on("Customer", {
	refresh(frm) {
		new frappe.ui.form.Controller({ frm });
		frappe.ui.form.make_control({
			df: { fieldname: "note", fieldtype: "Data", label: "Note" },
			parent: frm.wrapper,
			frm,
		});
		/** @type {frappe.ui.form.Form} */
		const plain = frm;
		void helper(frm), plain;
		// The open set_value: any fieldname or map, any value.
		void frm.set_value("anything", 1);
		void frm.set_value({ a: 1 }, null);
	},
});

// A REGISTERED doctype, and a child table's (parent) form.
frappe.ui.form.on("ToDo", {
	refresh(frm) {
		new frappe.ui.form.Controller({ frm });
		void helper(frm);
	},
});
frappe.ui.form.on("Packed Item", {
	qty(frm) {
		void helper(frm);
	},
});

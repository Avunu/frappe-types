// An app that registers NO doctypes — the empty `FrappeDocTypes` the package
// ships. Every `frm` is a `Form<"…">` with the open document, and must still be
// accepted wherever the plain `frappe.ui.form.Form` is: by the package's own
// APIs, by a JSDoc-typed variable and by a helper. TypeScript 5.x measures
// `Form`'s variance differently from 7, so this runs under both.

/** @param {frappe.ui.form.Form} frm */
function helper(frm) {
	return frm.doctype;
}

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

		// The open document and the open set_value, as in 16.4.1.
		void frm.doc["customer_name"];
		void frm.set_value("customer_name", "x");
		void frm.set_value({ customer_name: "x" }, null);
		/** @type {string | Record<string, unknown>} */
		const field = "customer_name";
		void frm.set_value(field, 1);
	},
});

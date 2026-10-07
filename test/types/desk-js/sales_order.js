// Child-table events: registered on the child doctype, run on the PARENT form.

frappe.ui.form.on("Sales Order", {
	refresh(frm) {
		/** @type {number} */
		const total = frm.doc.grand_total;
		void total;
		for (const row of frm.doc.items) {
			/** @type {string} */
			const item = row.item_code;
			void item;
		}
	},
	items_on_form_rendered(frm) {
		void frm.doc.customer;
	},
});

frappe.ui.form.on("Sales Order Item", {
	qty(frm, cdt, cdn) {
		// `frm` is the Sales Order form: the registry entry's `parenttype` says so.
		/** @type {"Sales Order"} */
		const parent = frm.doctype;
		/** @type {string} */
		const customer = frm.doc.customer;
		void parent, customer;

		const row = locals[cdt]?.[cdn];
		void row;
		void frappe.model.set_value(cdt, cdn, "amount", 0);
	},
	items_add(frm) {
		void frm.set_value("items", [{ item_code: "WIDGET", qty: 1 }]);
	},
	form_render(frm, cdt, cdn) {
		void frm, cdt, cdn;
	},
});

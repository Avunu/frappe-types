// Child-table events: registered on the child doctype, run on the PARENT form.

frappe.ui.form.on("Sales Order", {
	refresh(frm) {
		/** @type {number} */
		const total = frm.doc.grand_total;
		void total;
		// A frappe.Doc<…> field resolves to the other doctype's closed document.
		/** @type {string | undefined} */
		const party = frm.doc.source_quotation?.party_name;
		// @ts-expect-error -- Quotation has no field `customer`.
		void frm.doc.source_quotation?.customer;
		void party;
		for (const row of frm.doc.items) {
			/** @type {string} */
			const item = row.item_code;
			// A Table field typed with FrappeChildRow carries the standard row
			// fields too, so the usual child-row idiom compiles.
			/** @type {number} */
			const idx = row.idx;
			/** @type {"Sales Order Item"} */
			const doctype = row.doctype;
			/** @type {"Sales Order"} */
			const parenttype = row.parenttype;
			/** @type {import("frappe-types").ChildDoc} */
			const child = row;
			void item, idx, doctype, parenttype, child;
			void frappe.model.set_value(row.doctype, row.name, "qty", row.qty + 1);
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

frappe.ui.form.on("Packed Item", {
	qty(frm) {
		// `frm` is a Sales Order OR a Quotation form: a field both have is fine.
		/** @type {"Sales Order" | "Quotation"} */
		const parent = frm.doctype;
		void parent;
		void frm.set_value("grand_total", 0);
		void frm.set_value({ grand_total: 0 });
		void frm.set_value("packed_items", [{ item_code: "WIDGET", qty: 1 }]);
	},
});

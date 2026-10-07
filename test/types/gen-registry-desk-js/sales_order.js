// Uncompiled desk JS under the desk-js preset, against the output of
// `frappe-types gen-registry` (./doctypes.d.ts, written by scripts/test-types.mjs).

frappe.ui.form.on("Sales Order", {
	refresh(frm) {
		/** @type {number | null | undefined} */
		const total = frm.doc.grand_total;
		void total;
		for (const row of frm.doc.items) {
			/** @type {string | null | undefined} */
			const item = row.item_code;
			/** @type {number} */
			const idx = row.idx;
			void item, idx;
			void frappe.model.set_value(row.doctype, row.name, "qty", (row.qty ?? 0) + 1);
		}
		// @ts-expect-error a registered document is closed
		void frm.doc.custmer_name;
		// @ts-expect-error status is a string union, not a number
		void (frm.doc.status * 2);
	},
});

// Child-table events are registered on the child and run on any parent's form.
frappe.ui.form.on("Sales Order Item", {
	qty(frm, cdt, cdn) {
		/** @type {"Delivery Run" | "Sales Order"} */
		const parent = frm.doctype;
		void parent, cdt, cdn;
	},
});

/** @type {frappe.ui.form.FormEvents<"Delivery Run">} */
const run_events = {
	refresh(frm) {
		/** @type {string | null | undefined} */
		const route = frm.doc["route-code"];
		void route;
		void frm.set_value("sales_order", "SO-0001");
	},
};
frappe.ui.form.on("Delivery Run", run_events);

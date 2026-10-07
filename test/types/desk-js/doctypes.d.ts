// The registry an app would generate from its doctype JSON. A script file (no
// import/export), so the interface merges into the global one directly.

interface FrappeDocTypes {
	// Keep this entry FIRST, with a Table field and a field typed through
	// frappe.Doc<…>: both lead back to RegisteredDoc (FrappeChildRow through
	// ChildRowOf, frappe.Doc through DocOf) while TypeScript is still resolving
	// the registry, and a RegisteredDoc that intersects the generic entry errors
	// as circular (TS2456/TS2502) only when such an entry comes first.
	"Sales Order": {
		customer: string;
		// Not a generated field: a hand-written one that names another doctype's document.
		source_quotation?: frappe.Doc<"Quotation">;
		transaction_date: string;
		grand_total: number;
		items: FrappeChildRow<"Sales Order Item">[];
		packed_items: FrappeChildRow<"Packed Item">[];
	};
	ToDo: {
		status: "Open" | "Closed" | "Cancelled";
		priority?: "High" | "Medium" | "Low";
		description: string;
		date?: string | null;
		allocated_to?: string | null;
	};
	"Sales Order Item": {
		parenttype: "Sales Order";
		item_code: string;
		qty: number;
		rate: number;
		amount: number;
	};
	Quotation: {
		party_name: string;
		grand_total: number;
		packed_items: FrappeChildRow<"Packed Item">[];
	};
	// A child table of two parents: its events run on either parent's form.
	"Packed Item": {
		parenttype: "Sales Order" | "Quotation";
		item_code: string;
		qty: number;
	};
}

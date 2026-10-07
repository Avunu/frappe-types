// The registry an app would generate from its doctype JSON. A script file (no
// import/export), so the interface merges into the global one directly.

interface FrappeDocTypes {
	ToDo: {
		status: "Open" | "Closed" | "Cancelled";
		priority?: "High" | "Medium" | "Low";
		description: string;
		date?: string | null;
		allocated_to?: string | null;
	};
	"Sales Order": {
		customer: string;
		transaction_date: string;
		grand_total: number;
		items: FrappeChildRow<"Sales Order Item">[];
		packed_items: FrappeChildRow<"Packed Item">[];
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

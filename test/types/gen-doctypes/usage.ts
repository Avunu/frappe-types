// The output of `frappe-types gen-doctypes` for test/fixtures/gen-doctypes/apps
// (written to ./doctypes.d.ts by scripts/test-types.mjs, with the packed command),
// used from compiled TypeScript under the base preset.
// Its first registry entry, "Delivery Run", has FrappeChildRow fields: the shape that
// once made RegisteredDoc circularly reference itself (TS2456; see src/model.d.ts).

import type { ChildDoc, DocFieldName, DocOf, Form, FormDocTypeOf, FormEvents, FrappeDoc } from "frappe-types";
import type { SalesOrder as SalesOrderFields } from "./doctypes";

declare const so: DocOf<"Sales Order">;

// Standard fields come from frappe-types; the entry lists only data fields.
export const name: string = so.name;
export const docstatus: 0 | 1 | 2 | undefined = so.docstatus;
export const doctype: "Sales Order" = so.doctype;
// @ts-expect-error the generated entry itself has no standard fields
export const entryName: string = ({} as SalesOrderFields).name;

// A registered document is closed: a misspelt field is an error, not `unknown`.
// @ts-expect-error no such field
export const typo = so.custmer_name;
// @ts-expect-error no such field
export const notAField: DocFieldName<"Sales Order"> = "definitely_not_a_field";
export const aField: DocFieldName<"Sales Order"> = "grand_total";

// Select: the options (after the Property Setter), "" and null.
export const status: "Draft" | "On Hold" | "Completed" | "" | null | undefined = so.status;
// @ts-expect-error "To Bill" was replaced by the Property Setter
export const toBill: typeof so.status = "To Bill";

// Check is 0 | 1; numbers can be null, because clearing a numeric input in the
// form writes null into frm.doc.
export const isReturn: 0 | 1 | undefined = so.is_return;
// @ts-expect-error a Check is never a boolean
so.is_return = true;
export const total: number | null | undefined = so.grand_total;
// @ts-expect-error grand_total may be null in the browser
export const totalNotNull: number | undefined = so.grand_total;
export const fixed = so.grand_total != null ? so.grand_total.toFixed(2) : "";
// @ts-expect-error checking for undefined alone is not enough
export const unsafe = so.grand_total !== undefined ? so.grand_total.toFixed(2) : "";
// @ts-expect-error Data can read back null
export const date: string | undefined = so.transaction_date;
// not_nullable (Data) and a not_nullable Property Setter (Link) drop the null.
export const external: string | undefined = so.external_ref;
export const customer: string | undefined = so.customer;

// Tables are FrappeChildRow arrays: the child's fields plus the row fields.
const row = so.items[0];
export const qty: number | null | undefined = row?.qty;
export const idx: number | undefined = row?.idx;
export const parentfield: string | undefined = row?.parentfield;
export const parenttype: "Delivery Run" | "Sales Order" | undefined = row?.parenttype;
export const asChild: ChildDoc | undefined = row;
export const tagNames = so.tags.map((t) => t.tag);

// Child-table events run on the parent's form: every DocType with a Table of it.
export const parents: FormDocTypeOf<"Sales Order Item"> = "Delivery Run";
// @ts-expect-error Quotation has no Table of Sales Order Item
export const notAParent: FormDocTypeOf<"Sales Order Item"> = "Quotation";

export const events: FormEvents<"Sales Order"> = {
	refresh(frm) {
		void frm.set_value("status", "On Hold");
		// @ts-expect-error not an option
		void frm.set_value("status", "To Bill");
		// @ts-expect-error not a field
		void frm.set_value("custmer", "x");
	},
};

// Custom Fields from the app's custom/ folder and fixtures are on the DocType.
export const priority: "Low" | "High" | "" | null | undefined = so.custom_priority;
declare const settings: DocOf<"Selling Settings">;
export const run: string | null | undefined = settings.custom_default_run;

// A Single's name is its DocType.
export const settingsName: "Selling Settings" = settings.name;

// JSON is unknown: narrow before use.
// @ts-expect-error unknown cannot be indexed
export const payloadKey = so.payload.key;

// Fields that only the database knows about (Customize Form) are added by augmenting
// the global namespace the entries live in.
declare global {
	namespace FrappeDocTypeFields {
		interface SalesOrder {
			custom_added_in_the_ui?: string | null;
		}
	}
}
export const fromCustomizeForm: string | null | undefined = so.custom_added_in_the_ui;
// The module's export is the same interface, augmentation included.
export const viaExport: string | null | undefined = ({} as SalesOrderFields).custom_added_in_the_ui;

// A table whose child DocType is not on the bench falls back to ChildDoc.
declare const stop: DocOf<"Delivery Stop">;
export const parcel: string | undefined = stop.parcels[0]?.name;

// Names that are not identifiers are quoted.
declare const runDoc: DocOf<"Delivery Run">;
export const routeCode: string | null | undefined = runDoc["route-code"];

// A registered document still flows into APIs typed against the open shapes.
export const asDoc: FrappeDoc = so;
export const asForm = (frm: Form<"Sales Order">): Form => frm;

// Compiled against expected/my_app.d.ts by test/gen-doctypes.test.mjs, under the strict
// options frappe-types consumers use. Every `@ts-expect-error` is an assertion: tsc fails
// the test if the line below it compiles.

type SalesOrder = FrappeDocTypes["Sales Order"];
declare const so: SalesOrder;

// Standard fields come from FrappeDoc.
const name: string = so.name;
const docstatus: 0 | 1 | 2 | undefined = so.docstatus;
const doctype: "Sales Order" = so.doctype;

// Select: the options (after the Property Setter), "" and null.
const status: "Draft" | "On Hold" | "Completed" | "" | null | undefined = so.status;
// @ts-expect-error "To Bill" was replaced by the Property Setter
const toBill: typeof so.status = "To Bill";

// Check is 0 | 1, numbers are not null, data fields are.
const isReturn: 0 | 1 | undefined = so.is_return;
// @ts-expect-error a Check is never a boolean
so.is_return = true;
const total: number | undefined = so.grand_total;
// @ts-expect-error Data can read back null
const ref: string | undefined = so.transaction_date;
// not_nullable (Data) and a not_nullable Property Setter (Link) drop the null.
const external: string | undefined = so.external_ref;
const customer: string | undefined = so.customer;

// Tables are always arrays of the child interface, which is a ChildDoc.
const firstQty: number | undefined = so.items[0]?.qty;
const parentfield: string | undefined = so.items[0]?.parentfield;
const tagNames = so.tags.map((t) => t.tag);

// Custom Fields from the app's custom/ folder and fixtures are on the DocType.
const priority: "Low" | "High" | "" | null | undefined = so.custom_priority;
const run: string | null | undefined = FrappeDocTypes_SellingSettings().custom_default_run;
declare function FrappeDocTypes_SellingSettings(): FrappeDocTypes["Selling Settings"];

// A Single's name is its DocType.
const settingsName: "Selling Settings" = FrappeDocTypes_SellingSettings().name;

// JSON is unknown: narrow before use.
// @ts-expect-error unknown cannot be indexed
const payloadKey = so.payload.key;

// Fields only the database knows about still read as unknown, not as an error.
const fromCustomizeForm: unknown = so.custom_added_in_the_ui;

// A table whose child DocType is not on the bench falls back to ChildDoc.
declare const stop: FrappeDocTypes["Delivery Stop"];
const parcel: string | undefined = stop.parcels[0]?.name;

// Names that are not identifiers are quoted.
declare const runDoc: FrappeDocTypes["Delivery Run"];
const routeCode: string | null | undefined = runDoc["route-code"];

// Every entry is a FrappeDoc, so the registry fits anything that takes one.
import type { FrappeDoc } from "frappe-types";
const asDoc: FrappeDoc = so;

export {
	name,
	docstatus,
	doctype,
	status,
	toBill,
	isReturn,
	total,
	ref,
	external,
	customer,
	firstQty,
	parentfield,
	tagNames,
	priority,
	run,
	settingsName,
	payloadKey,
	fromCustomizeForm,
	parcel,
	routeCode,
	asDoc,
};

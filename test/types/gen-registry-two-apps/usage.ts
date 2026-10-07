// Two generated files in one program: other_app's and side_app's (written here by
// scripts/test-types.mjs, with the packed command). Both register base_app's Sales Order,
// which each customises with a Custom Field of its own, and its two child tables. The
// entries are interfaces of the global FrappeDocTypeFields namespace, so the two files
// declare the same registry entries and their fields merge.

import type { DocFieldName, DocOf, FormDocTypeOf } from "frappe-types";
import type { SalesOrder as FromOther } from "./other_app";
import type { SalesOrder as FromSide } from "./side_app";

declare const so: DocOf<"Sales Order">;

// Each app's Custom Field, and base_app's fields, on the one document.
export const fromOther: string | null | undefined = so.custom_from_other_app;
export const fromSide: number | null | undefined = so.custom_from_side_app;
export const base: number | null | undefined = so.grand_total;
export const field: DocFieldName<"Sales Order"> = "custom_from_side_app";

// Still closed.
// @ts-expect-error no such field
export const typo = so.custmer_name;
// @ts-expect-error no such field
export const notAField: DocFieldName<"Sales Order"> = "custom_from_neither";

// Both modules' exports are the merged interface.
export const same: FromOther = {} as FromSide;
export const back: FromSide = {} as FromOther;

// Each file registers what only it has, too.
declare const unrelated: DocOf<"Unrelated">;
export const x: string | null | undefined = unrelated.x;

// Shared child tables are one entry.
export const parent: FormDocTypeOf<"Sales Order Item"> = "Sales Order";
export const qty: number | null | undefined = so.items[0]?.qty;

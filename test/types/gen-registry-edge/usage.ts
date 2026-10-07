// The output of `frappe-types gen-registry` for edge_app in test/fixtures/gen-registry/apps
// (written to ./doctypes.d.ts by scripts/test-types.mjs, with the packed command): trimmed
// copies of real DocTypes whose fields module-scoped generators get wrong. Each block is a
// regression test for one of them, under both compilers.

import type { DocFieldName, DocOf, FormEvents } from "frappe-types";
import type { eInvoiceLog } from "./doctypes";

// Select options containing double quotes: frappe's DocType and Customize Form
// (`naming_rule`) and erpnext's Bank Statement Import Log (`detected_amount_format`).
declare const dt: DocOf<"DocType">;
declare const cf: DocOf<"Customize Form">;
declare const log: DocOf<"Bank Statement Import Log">;
export const byNamingSeries: typeof dt.naming_rule = 'By "Naming Series" field';
export const cfNaming: typeof cf.naming_rule = 'By "Naming Series" field';
// @ts-expect-error Customize Form offers no Autoincrement
export const notAnOption: typeof cf.naming_rule = "Autoincrement";
export const crdr: typeof log.detected_amount_format = 'Amount column has "CR"/"DR" values';
// @ts-expect-error the quotes are part of the option
export const unquoted: typeof log.detected_amount_format = "Amount column has CR/DR values";

// Duration is stored as a number of seconds (erpnext's Issue).
declare const issue: DocOf<"Issue">;
export const seconds: number | null | undefined = issue.resolution_time;
// @ts-expect-error a Duration is not a string
export const notAString: typeof issue.first_response_time = "1h";

// Hyphenated DocType names (india_compliance's e-Invoice Log, e-Waybill Log): the
// registry key keeps the hyphen, the interface drops it as frappe's class name does.
declare const inv: DocOf<"e-Invoice Log">;
declare const ewb: DocOf<"e-Waybill Log">;
export const irn: string | null | undefined = inv.irn;
export const sameEntry: eInvoiceLog = inv;
export const rowParent: "e-Waybill Log" = ewb.items[0]!.parenttype;
export const rowEvents: FormEvents<"e-Waybill Log Item"> = {
	item_code(frm) {
		const parent: "e-Waybill Log" = frm.doctype;
		void parent;
	},
};

// DocTypes that declare a standard field themselves: Custom DocPerm's `parent` (Data),
// Desktop Icon's and Web Page's `idx` (Int). The standard declaration stands, once.
declare const perm: DocOf<"Custom DocPerm">;
declare const icon: DocOf<"Desktop Icon">;
declare const page: DocOf<"Web Page">;
export const permParent: string | undefined = perm.parent;
export const iconIdx: number | undefined = icon.idx;
export const pageIdx: number | undefined = page.idx;
// Reserved words are ordinary field names.
export const canDelete: 0 | 1 | undefined = perm.delete;
export const canImport: DocFieldName<"Custom DocPerm"> = "import";

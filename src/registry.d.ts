/**
 * frappe-types — the **doctype registry**.
 *
 * This file is a SCRIPT (no top-level `import`/`export`), so the one
 * declaration in it is a *global type*. Both entry points pull it in with a
 * `/// <reference path>` — `index.d.ts` (the module entry) and `global.d.ts`
 * (the ambient one) — so a program that uses either, or both, sees exactly one
 * registry. It is a type and nothing else: no value named `FrappeDocTypes`
 * exists at runtime, and the module entry still installs no runtime globals.
 *
 * ## What goes in it
 *
 * One property per doctype, keyed by the doctype's name exactly as frappe
 * spells it (`"Sales Order"`, with the space), whose type lists the doctype's
 * DATA fields — the keys `frappe.model` stores on the document. Layout fields
 * (Section/Column/Tab Break) hold no value and have no place here. Standard
 * fields (`name`, `owner`, `docstatus`, `idx`, the `__*` client flags, …) are
 * added for you from {@link import("./model").FrappeDocFields}, so list only the
 * doctype's own fields:
 *
 * ```ts
 * // types/doctypes.d.ts — also a script, so no `declare global` is needed
 * interface FrappeDocTypes {
 *   ToDo: {
 *     status: "Open" | "Closed" | "Cancelled";
 *     description: string;
 *     allocated_to?: string | null;
 *   };
 *   // A child table: `parenttype` names the doctype(s) it is a table OF. That
 *   // is what `frappe.ui.form.FormEvents<"Sales Order Item">` uses to type
 *   // `frm` as the PARENT form — child-table events run on the parent's form.
 *   "Sales Order Item": {
 *     parenttype: "Sales Order";
 *     item_code: string;
 *     qty: number;
 *   };
 * }
 * ```
 *
 * In a file that is a module, wrap the same block in `declare global { … }`.
 *
 * ## What registering a doctype changes
 *
 * An UNREGISTERED doctype keeps today's type: an open
 * {@link import("./model").FrappeDoc}, whose unknown keys read as `unknown`.
 * A REGISTERED doctype's document is closed — its fields are exactly the
 * standard fields plus the ones listed here, so `frm.doc.custmer_name` is a
 * compile error rather than a silent `unknown`. Custom Fields are not in
 * frappe's doctype JSON; add them to the entry by hand (or let the generator
 * read your fixtures) if your code reads them.
 *
 * The registry is empty here on purpose: frappe-types does not model any
 * particular site's doctypes.
 */
interface FrappeDocTypes {}

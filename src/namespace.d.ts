/**
 * frappe-types — the **type-space `frappe` namespace**.
 *
 * `global.d.ts` declares `frappe` as a VALUE (`var frappe: Frappe`). A value
 * cannot be named in a type position, so before this file
 * `/** @type {frappe.ui.form.FormEvents} *\/` in a desk script was
 * `TS2503 Cannot find namespace 'frappe'`. The namespace below gives the same
 * dotted names a TYPE meaning: it declares only type aliases, so it is a
 * non-instantiated namespace, emits nothing, and merges with the `var` without
 * conflict — `frappe.ui.form.on(...)` still resolves through the value, and
 * `frappe.ui.form.FormEvents<"ToDo">` through the namespace.
 *
 * ```js
 * // ToDo/todo.js, checked with `frappe-types/tsconfig/desk-js.json`
 * frappe.ui.form.on("ToDo", {
 *   refresh(frm) {
 *     frm.doc.status; // typed from FrappeDocTypes["ToDo"] when registered
 *   },
 * });
 *
 * /** @type {frappe.ui.form.FormEvents<"ToDo">} *\/
 * const events = { refresh(frm) {} };
 * ```
 *
 * The paths mirror where the runtime puts each thing — `frappe.ui.form.Form`
 * is the type of an instance of the class at `frappe.ui.form.Form`
 * (`frappe/public/js/frappe/form/form.js:64`), `frappe.views.QueryReport` of
 * the one at `frappe.views.QueryReport`
 * (`frappe/public/js/frappe/views/reports/query_report.js:30`) — plus a few
 * names that exist only as types (`FormEvents`, `ListViewSettings`, `Doc`),
 * placed where a script author would look for them. Every alias points at a
 * named export of the module entry; the declarations, and their citations, are
 * there.
 *
 * Loaded by `global.d.ts` (a `/// <reference path>`), so it comes with
 * `"types": ["frappe-types/global"]` and is absent from a program that only
 * imports the module entry.
 *
 * @packageDocumentation
 */

import type { DocFieldName, DocFieldValue, DocOf, DocTypeName, FormDocTypeOf } from "./model";
import type {
	BaseControl,
	ControlOptions as ControlOptionsShape,
	Dialog as DialogClass,
	DialogOptions as DialogOptionsShape,
	FieldGroup as FieldGroupClass,
	Form as FormClass,
	FormController,
	FormEventHandler as FormEventHandlerType,
	FormEvents as FormEventsType,
	LayoutOptions,
	StandardFormEvents as StandardFormEventsType,
} from "./ui/form";
import type {
	ListDocOf,
	ListView as ListViewClass,
	ListViewSettings as ListViewSettingsShape,
	QueryReport as QueryReportClass,
	QueryReportColumn as QueryReportColumnShape,
	QueryReportFilterControl as QueryReportFilterControlShape,
	QueryReportSettings as QueryReportSettingsShape,
	ReportView as ReportViewClass,
} from "./views";
import type { Page as PageClass } from "./utils";

declare global {
	namespace frappe {
		/** A doctype name registered in the global `FrappeDocTypes` interface. See {@link DocTypeName}. */
		type DocType = DocTypeName;
		/** The document type of doctype `DT` — see {@link DocOf}. */
		type Doc<DT extends string = string> = DocOf<DT>;
		/** A list-view row of doctype `DT` — see {@link ListDocOf}. */
		type ListDoc<DT extends string = string> = ListDocOf<DT>;
		/** The data fieldnames of `DT` — see {@link DocFieldName}. */
		type FieldName<DT extends string = string> = DocFieldName<DT>;
		/** The value type of field `F` on `DT` — see {@link DocFieldValue}. */
		type FieldValue<DT extends string, F extends string> = DocFieldValue<DT, F>;

		namespace ui {
			/** `frappe.ui.Dialog` — `frappe/public/js/frappe/ui/dialog.js:10`. */
			type Dialog = DialogClass;
			/** The options `new frappe.ui.Dialog(...)` takes. */
			type DialogOptions = DialogOptionsShape;
			/** `frappe.ui.FieldGroup` — `frappe/public/js/frappe/ui/field_group.js:5`. */
			type FieldGroup = FieldGroupClass;
			/** The options `new frappe.ui.FieldGroup(...)` takes. */
			type FieldGroupOptions = LayoutOptions;
			/** `frappe.ui.Page` — `frappe/public/js/frappe/ui/page.js:51`. */
			type Page = PageClass;

			namespace form {
				/** `frappe.ui.form.Form` — `frappe/public/js/frappe/form/form.js:64`. */
				type Form<DT extends string = string> = FormClass<DT>;
				/** The events map `frappe.ui.form.on(doctype, events)` takes. */
				type FormEvents<DT extends string = string, FrmDT extends string = FormDocTypeOf<DT>> = FormEventsType<
					DT,
					FrmDT
				>;
				/** One handler in a {@link FormEvents} map: `(frm, cdt, cdn)`. */
				type FormEventHandler<FrmDT extends string = string> = FormEventHandlerType<FrmDT>;
				/** The events frappe's form triggers by name. */
				type StandardFormEvents<FrmDT extends string = string> = StandardFormEventsType<FrmDT>;
				/** `frappe.ui.form.Controller` — `frappe/public/js/frappe/form/form.js:18`. */
				type Controller = FormController;
				/** `frappe.ui.form.Control` — `frappe/public/js/frappe/form/controls/base_control.js:1`. */
				type Control = BaseControl;
				/** The options `frappe.ui.form.make_control` and every Control constructor take. */
				type ControlOptions = ControlOptionsShape;
			}
		}

		namespace views {
			/**
			 * `frappe.listview_settings[doctype]` — what a `<doctype>_list.js`
			 * assigns. `DT` types the row documents its callbacks receive.
			 */
			type ListViewSettings<DT extends string = string> = ListViewSettingsShape<DT>;
			/** `frappe.views.ListView` — `frappe/public/js/frappe/list/list_view.js:6`. */
			type ListView = ListViewClass;
			/** `frappe.views.ReportView` — `frappe/public/js/frappe/views/reports/report_view.js:9`. */
			type ReportView = ReportViewClass;
			/** `frappe.views.QueryReport` — `frappe/public/js/frappe/views/reports/query_report.js:30`. */
			type QueryReport = QueryReportClass;
			/** `frappe.query_reports[report_name]` — what a query report's `<report>.js` assigns. */
			type QueryReportSettings = QueryReportSettingsShape;
			/** A prepared query report column, as `formatter` receives it. */
			type QueryReportColumn = QueryReportColumnShape;
			/** One filter control of a query report, as `frappe.query_report.get_filter(...)` returns it (`frappe/public/js/frappe/views/reports/query_report.js:1599-1605`). */
			type QueryReportFilter = QueryReportFilterControlShape;
		}
	}
}

export {};

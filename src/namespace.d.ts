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
 * (`frappe/public/js/frappe/views/reports/query_report.js:32`) — plus a few
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
	ControlAttach as ControlAttachClass,
	ControlAttachImage as ControlAttachImageClass,
	ControlAttachmentGallery as ControlAttachmentGalleryClass,
	ControlAutocomplete as ControlAutocompleteClass,
	ControlBarcode as ControlBarcodeClass,
	ControlButton as ControlButtonClass,
	ControlCheck as ControlCheckClass,
	ControlCode as ControlCodeClass,
	ControlColor as ControlColorClass,
	ControlComment as ControlCommentClass,
	ControlCurrency as ControlCurrencyClass,
	ControlData as ControlDataClass,
	ControlDate as ControlDateClass,
	ControlDateRange as ControlDateRangeClass,
	ControlDatetime as ControlDatetimeClass,
	ControlDuration as ControlDurationClass,
	ControlDynamicLink as ControlDynamicLinkClass,
	ControlFloat as ControlFloatClass,
	ControlGeolocation as ControlGeolocationClass,
	ControlHTML as ControlHTMLClass,
	ControlHTMLEditor as ControlHTMLEditorClass,
	ControlHeading as ControlHeadingClass,
	ControlIcon as ControlIconClass,
	ControlImage as ControlImageClass,
	ControlInput as ControlInputClass,
	ControlInt as ControlIntClass,
	ControlJSON as ControlJSONClass,
	ControlLink as ControlLinkClass,
	ControlMarkdownEditor as ControlMarkdownEditorClass,
	ControlMultiCheck as ControlMultiCheckClass,
	ControlMultiSelect as ControlMultiSelectClass,
	ControlMultiSelectList as ControlMultiSelectListClass,
	ControlMultiSelectPills as ControlMultiSelectPillsClass,
	ControlPassword as ControlPasswordClass,
	ControlPercent as ControlPercentClass,
	ControlPhone as ControlPhoneClass,
	ControlRating as ControlRatingClass,
	ControlSelect as ControlSelectClass,
	ControlSignature as ControlSignatureClass,
	ControlSmallText as ControlSmallTextClass,
	ControlSwitch as ControlSwitchClass,
	ControlTable as ControlTableClass,
	ControlTableMultiSelect as ControlTableMultiSelectClass,
	ControlText as ControlTextClass,
	ControlTextEditor as ControlTextEditorClass,
	ControlTime as ControlTimeClass,
	ControlOptions as ControlOptionsShape,
	Dialog as DialogClass,
	DialogOptions as DialogOptionsShape,
	FieldGroup as FieldGroupClass,
	Form as FormClass,
	FormController,
	FormEventHandler as FormEventHandlerType,
	FormEvents as FormEventsType,
	FormFooter,
	LayoutOptions,
	PrintView as PrintViewClass,
	PrintViewTarget as PrintViewTargetShape,
	QuickEntryAfterInsert as QuickEntryAfterInsertType,
	QuickEntryForm as QuickEntryFormClass,
	StandardFormEvents as StandardFormEventsType,
} from "./ui/form";
import type { DataTableInstance, DataTableOptions as DataTableOptionsShape } from "./datatable";
import type {
	BaseList as BaseListClass,
	CalendarSettings as CalendarSettingsShape,
	CommunicationComposer as CommunicationComposerClass,
	CommunicationComposerOptions as CommunicationComposerOptionsShape,
	DocPreview as DocPreviewShape,
	GanttView as GanttViewClass,
	GroupBy as GroupByClass,
	ListDocOf,
	ListView as ListViewClass,
	ListViewSelect as ListViewSelectClass,
	PageWrapper as PageWrapperShape,
	ListViewSettings as ListViewSettingsShape,
	QueryReport as QueryReportClass,
	QueryReportColumn as QueryReportColumnShape,
	QueryReportFilterControl as QueryReportFilterControlShape,
	QueryReportSettings as QueryReportSettingsShape,
	ReportView as ReportViewClass,
	SidePanel as SidePanelClass,
	SortSelector as SortSelectorClass,
	SortSelectorOptions as SortSelectorOptionsShape,
} from "./views";
import type { Page as PageClass } from "./utils";
import type { FrappeFileUploader, FrappeFileUploaderOptions } from "./ui/components";

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
		/** What `new frappe.DataTable(...)` returns — `frappe/public/js/frappe/ui/datatable.js:3`. See {@link DataTableInstance}. */
		type DataTable = DataTableInstance;
		/** The options `new frappe.DataTable(wrapper, options)` takes. */
		type DataTableOptions = DataTableOptionsShape;

		namespace ui {
			/**
			 * `frappe.ui.Dialog` — `frappe/public/js/frappe/ui/dialog.js:10`. `TValues`
			 * types the values its primary action receives.
			 */
			type Dialog<TValues extends object = Record<string, unknown>> = DialogClass<TValues>;
			/** The options `new frappe.ui.Dialog(...)` takes. */
			type DialogOptions<TValues extends object = Record<string, unknown>> = DialogOptionsShape<TValues>;
			/** `frappe.ui.FieldGroup` — `frappe/public/js/frappe/ui/field_group.js:5`. */
			type FieldGroup<TValues extends object = Record<string, unknown>> = FieldGroupClass<TValues>;
			/** The options `new frappe.ui.FieldGroup(...)` takes. */
			type FieldGroupOptions = LayoutOptions;
			/** `frappe.ui.Page` — `frappe/public/js/frappe/ui/page.js:51`. */
			type Page = PageClass;
			/** `frappe.ui.SortSelector` — `frappe/public/js/frappe/ui/sort_selector.js:1`. */
			type SortSelector = SortSelectorClass;
			/** The options `new frappe.ui.SortSelector(...)` takes. */
			type SortSelectorOptions = SortSelectorOptionsShape;
			/** `frappe.ui.GroupBy` — `frappe/public/js/frappe/ui/group_by/group_by.js:3`. */
			type GroupBy = GroupByClass;
			/** `frappe.ui.FileUploader` — `frappe/public/js/frappe/file_uploader/file_uploader.bundle.js:5`. */
			type FileUploader = FrappeFileUploader;
			/** The options `new frappe.ui.FileUploader(...)` takes. */
			type FileUploaderOptions = FrappeFileUploaderOptions;
			/** `frappe.ui.SidePanel` — `frappe/public/js/frappe/ui/side_panel.js:399`. */
			type SidePanel = SidePanelClass;
			/** A document preview the side panel shows: what `frappe.desk.doc_preview.get_preview` returns. */
			type DocPreview = DocPreviewShape;

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
				/** `frappe.ui.form.ControlAttach` — `frappe/public/js/frappe/form/controls/attach.js:1`. */
				type ControlAttach = ControlAttachClass;
				/** `frappe.ui.form.ControlAttachImage` — `frappe/public/js/frappe/form/controls/attach_image.js:1`. */
				type ControlAttachImage = ControlAttachImageClass;
				/** `frappe.ui.form.ControlAttachmentGallery` — `frappe/public/js/frappe/form/controls/attachment_gallery.js:1`. */
				type ControlAttachmentGallery = ControlAttachmentGalleryClass;
				/** `frappe.ui.form.ControlAutocomplete` — `frappe/public/js/frappe/form/controls/autocomplete.js:3`. */
				type ControlAutocomplete = ControlAutocompleteClass;
				/** `frappe.ui.form.ControlBarcode` — `frappe/public/js/frappe/form/controls/barcode.js:3`. */
				type ControlBarcode = ControlBarcodeClass;
				/** `frappe.ui.form.ControlButton` — `frappe/public/js/frappe/form/controls/button.js:1`. */
				type ControlButton = ControlButtonClass;
				/** `frappe.ui.form.ControlCheck` — `frappe/public/js/frappe/form/controls/check.js:1`. */
				type ControlCheck = ControlCheckClass;
				/** `frappe.ui.form.ControlCode` — `frappe/public/js/frappe/form/controls/code.js:1`. */
				type ControlCode = ControlCodeClass;
				/** `frappe.ui.form.ControlColor` — `frappe/public/js/frappe/form/controls/color.js:3`. */
				type ControlColor = ControlColorClass;
				/** `frappe.ui.form.ControlComment` — `frappe/public/js/frappe/form/controls/comment.js:6`. */
				type ControlComment = ControlCommentClass;
				/** `frappe.ui.form.ControlCurrency` — `frappe/public/js/frappe/form/controls/currency.js:1`. */
				type ControlCurrency = ControlCurrencyClass;
				/** `frappe.ui.form.ControlData` — `frappe/public/js/frappe/form/controls/data.js:3`. */
				type ControlData = ControlDataClass;
				/** `frappe.ui.form.ControlDate` — `frappe/public/js/frappe/form/controls/date.js:1`. */
				type ControlDate = ControlDateClass;
				/** `frappe.ui.form.ControlDateRange` — `frappe/public/js/frappe/form/controls/date_range.js:1`. */
				type ControlDateRange = ControlDateRangeClass;
				/** `frappe.ui.form.ControlDatetime` — `frappe/public/js/frappe/form/controls/datetime.js:1`. */
				type ControlDatetime = ControlDatetimeClass;
				/** `frappe.ui.form.ControlDuration` — `frappe/public/js/frappe/form/controls/duration.js:1`. */
				type ControlDuration = ControlDurationClass;
				/** `frappe.ui.form.ControlDynamicLink` — `frappe/public/js/frappe/form/controls/dynamic_link.js:1`. */
				type ControlDynamicLink = ControlDynamicLinkClass;
				/** `frappe.ui.form.ControlFloat` — `frappe/public/js/frappe/form/controls/float.js:1`. */
				type ControlFloat = ControlFloatClass;
				/** `frappe.ui.form.ControlGeolocation` — `frappe/public/js/frappe/form/controls/geolocation.js:3`. */
				type ControlGeolocation = ControlGeolocationClass;
				/** `frappe.ui.form.ControlHTML` — `frappe/public/js/frappe/form/controls/html.js:1`. */
				type ControlHTML = ControlHTMLClass;
				/** `frappe.ui.form.ControlHTMLEditor` — `frappe/public/js/frappe/form/controls/html_editor.js:1`. */
				type ControlHTMLEditor = ControlHTMLEditorClass;
				/** `frappe.ui.form.ControlHeading` — `frappe/public/js/frappe/form/controls/heading.js:1`. */
				type ControlHeading = ControlHeadingClass;
				/** `frappe.ui.form.ControlIcon` — `frappe/public/js/frappe/form/controls/icon.js:3`. */
				type ControlIcon = ControlIconClass;
				/** `frappe.ui.form.ControlImage` — `frappe/public/js/frappe/form/controls/image.js:1`. */
				type ControlImage = ControlImageClass;
				/** `frappe.ui.form.ControlInput` — `frappe/public/js/frappe/form/controls/base_input.js:2`. */
				type ControlInput = ControlInputClass;
				/** `frappe.ui.form.ControlInt` — `frappe/public/js/frappe/form/controls/int.js:1`. */
				type ControlInt = ControlIntClass;
				/** `frappe.ui.form.ControlJSON` — `frappe/public/js/frappe/form/controls/json.js:1`. */
				type ControlJSON = ControlJSONClass;
				/** `frappe.ui.form.ControlLink` — `frappe/public/js/frappe/form/controls/link.js:11`. */
				type ControlLink = ControlLinkClass;
				/** `frappe.ui.form.ControlLongInt` — `frappe/public/js/frappe/form/controls/int.js:28`, the same class as `ControlInt`. */
				type ControlLongInt = ControlIntClass;
				/** `frappe.ui.form.ControlLongText` — `frappe/public/js/frappe/form/controls/text.js:23`, the same class as `ControlText`. */
				type ControlLongText = ControlTextClass;
				/** `frappe.ui.form.ControlMarkdownEditor` — `frappe/public/js/frappe/form/controls/markdown_editor.js:1`. */
				type ControlMarkdownEditor = ControlMarkdownEditorClass;
				/** `frappe.ui.form.ControlMultiCheck` — `frappe/public/js/frappe/form/controls/multicheck.js:1`. */
				type ControlMultiCheck = ControlMultiCheckClass;
				/** `frappe.ui.form.ControlMultiSelect` — `frappe/public/js/frappe/form/controls/multiselect.js:3`. */
				type ControlMultiSelect = ControlMultiSelectClass;
				/** `frappe.ui.form.ControlMultiSelectList` — `frappe/public/js/frappe/form/controls/multiselect_list.js:1`. */
				type ControlMultiSelectList = ControlMultiSelectListClass;
				/** `frappe.ui.form.ControlMultiSelectPills` — `frappe/public/js/frappe/form/controls/multiselect_pills.js:3`. */
				type ControlMultiSelectPills = ControlMultiSelectPillsClass;
				/** `frappe.ui.form.ControlPassword` — `frappe/public/js/frappe/form/controls/password.js:1`. */
				type ControlPassword = ControlPasswordClass;
				/** `frappe.ui.form.ControlPercent` — `frappe/public/js/frappe/form/controls/percent.js:1`. */
				type ControlPercent = ControlPercentClass;
				/** `frappe.ui.form.ControlPhone` — `frappe/public/js/frappe/form/controls/phone.js:4`. */
				type ControlPhone = ControlPhoneClass;
				/** `frappe.ui.form.ControlRating` — `frappe/public/js/frappe/form/controls/rating.js:1`. */
				type ControlRating = ControlRatingClass;
				/** `frappe.ui.form.ControlReadOnly` — `frappe/public/js/frappe/form/controls/data.js:336`, the same class as `ControlData`. */
				type ControlReadOnly = ControlDataClass;
				/** `frappe.ui.form.ControlSelect` — `frappe/public/js/frappe/form/controls/select.js:1`. */
				type ControlSelect = ControlSelectClass;
				/** `frappe.ui.form.ControlSignature` — `frappe/public/js/frappe/form/controls/signature.js:1`. */
				type ControlSignature = ControlSignatureClass;
				/** `frappe.ui.form.ControlSmallText` — `frappe/public/js/frappe/form/controls/text.js:24`. */
				type ControlSmallText = ControlSmallTextClass;
				/** `frappe.ui.form.ControlSwitch` — `frappe/public/js/frappe/form/controls/switch.js:5`. */
				type ControlSwitch = ControlSwitchClass;
				/** `frappe.ui.form.ControlTable` — `frappe/public/js/frappe/form/controls/table.js:3`. */
				type ControlTable = ControlTableClass;
				/** `frappe.ui.form.ControlTableMultiSelect` — `frappe/public/js/frappe/form/controls/table_multiselect.js:1`. */
				type ControlTableMultiSelect = ControlTableMultiSelectClass;
				/** `frappe.ui.form.ControlText` — `frappe/public/js/frappe/form/controls/text.js:1`. */
				type ControlText = ControlTextClass;
				/** `frappe.ui.form.ControlTextEditor` — `frappe/public/js/frappe/form/controls/text_editor.js:185`. */
				type ControlTextEditor = ControlTextEditorClass;
				/** `frappe.ui.form.ControlTime` — `frappe/public/js/frappe/form/controls/time.js:1`. */
				type ControlTime = ControlTimeClass;
				/** `frappe.ui.form.Footer` — `frappe/public/js/frappe/form/footer/footer.js:4`. */
				type Footer = FormFooter;
				/** `frappe.ui.form.QuickEntryForm` — `frappe/public/js/frappe/form/quick_entry.js:36`. */
				type QuickEntryForm = QuickEntryFormClass;
				/** The `after_insert` callback of a quick entry dialog. */
				type QuickEntryAfterInsert = QuickEntryAfterInsertType;
				/** `frappe.ui.form.PrintView` — `frappe/printing/page/print/print.js:38`. */
				type PrintView = PrintViewClass;
				/** What `PrintView#show` prints: a form, or the print page's stand-in for one. */
				type PrintViewTarget = PrintViewTargetShape;
			}
		}

		namespace views {
			/**
			 * `frappe.listview_settings[doctype]` — what a `<doctype>_list.js`
			 * assigns. `DT` types the row documents its callbacks receive.
			 */
			type ListViewSettings<DT extends string = string> = ListViewSettingsShape<DT>;
			/** `frappe.views.BaseList` — `frappe/public/js/frappe/list/base_list.js:5`. */
			type BaseList = BaseListClass;
			/** `frappe.views.ListView` — `frappe/public/js/frappe/list/list_view.js:6`. */
			type ListView = ListViewClass;
			/** `frappe.views.GanttView` — `frappe/public/js/frappe/views/gantt/gantt_view.js:13`. */
			type GanttView = GanttViewClass;
			/** `frappe.views.calendar[doctype]` — what a `<doctype>_calendar.js` assigns. */
			type CalendarSettings = CalendarSettingsShape;
			/** `frappe.views.CommunicationComposer` — `frappe/public/js/frappe/views/communication.js:11`. */
			type CommunicationComposer = CommunicationComposerClass;
			/** The options `new frappe.views.CommunicationComposer(...)` takes. */
			type CommunicationComposerOptions = CommunicationComposerOptionsShape;
			/** `frappe.views.ReportView` — `frappe/public/js/frappe/views/reports/report_view.js:9`. */
			type ReportView = ReportViewClass;
			/** `frappe.views.ListViewSelect` — `frappe/public/js/frappe/list/list_view_select.js:15`. */
			type ListViewSelect = ListViewSelectClass;
			/** An entry of `frappe.pages`: a routed page's element, where a page script assigns `on_page_load`. */
			type PageWrapper = PageWrapperShape;
			/** `frappe.views.QueryReport` — `frappe/public/js/frappe/views/reports/query_report.js:32`. */
			type QueryReport = QueryReportClass;
			/** `frappe.query_reports[report_name]` — what a query report's `<report>.js` assigns. */
			type QueryReportSettings = QueryReportSettingsShape;
			/** A prepared query report column, as `formatter` receives it. */
			type QueryReportColumn = QueryReportColumnShape;
			/** One filter control of a query report, as `frappe.query_report.get_filter(...)` returns it (`frappe/public/js/frappe/views/reports/query_report.js:1610-1616`). */
			type QueryReportFilter = QueryReportFilterControlShape;
		}
	}
}

export {};

// Dialogs, prompts and the field definitions they take, the form footer, and
// the model helpers, as desk scripts use them, with no casts.

// A primary action whose parameter names its own values type is accepted:
// primary_action is a method, so the narrower parameter is allowed. Every key
// is optional, because get_values() leaves empty fields out.
const merge = new frappe.ui.Dialog({
	title: __("Merge"),
	size: "medium",
	fields: [
		{
			fieldname: "keep",
			fieldtype: "Link",
			options: "File",
			only_select: 1,
			get_query: () => ({ filters: { is_folder: 0 } }),
			onchange() {
				// `this` is the control.
				void this.df.fieldname;
			},
		},
		{ fieldname: "since", fieldtype: "Date", min_date: new Date() },
		{
			fieldname: "parts",
			fieldtype: "MultiCheck",
			options: [
				{ value: "double_sided", label: "Double Sided", checked: true },
				{ value: "color", label: "Color", description: __("Costs extra"), danger: 1 },
			],
		},
		{ fieldname: "scan", fieldtype: "Attach", options: { disable_file_browser: true } },
	],
	/** @param {{ keep?: string; since?: string }} values */
	primary_action(values) {
		if (values.keep) merge.hide();
	},
});

// Or type the whole dialog through the variable it is assigned to: get_value,
// set_value and get_values are then checked against the values type.
/** @type {frappe.ui.Dialog<{ percentage: number }>} */
const discount = new frappe.ui.Dialog({
	fields: [{ fieldname: "percentage", fieldtype: "Percent" }],
	/** @param {{ percentage?: number }} values */
	primary_action(values) {
		/** @type {number | undefined} */
		const pct = values.percentage;
		void pct;
		discount.hide();
	},
});
/** @type {number | null | undefined} */
const same = discount.get_value("percentage");
void same;

// A dialog whose fields and actions refer to the dialog itself, the usual
// frappe pattern, needs no annotation (TS7022 when frappe.ui.Dialog was generic).
// TypeScript 5.x still needs one when a hook that returns a value (get_query,
// get_data) refers to the dialog; TypeScript 7 does not.
/** @type {frappe.ui.Dialog} */
const picker = new frappe.ui.Dialog({
	fields: [
		{
			fieldname: "doctype",
			fieldtype: "Link",
			options: "DocType",
			onchange() {
				void picker.get_value("doctype");
			},
		},
		{
			fieldname: "format",
			fieldtype: "Link",
			options: "Print Format",
			get_query() {
				const filters = { doc_type: picker.get_value("doctype") };
				return { filters };
			},
		},
	],
	primary_action() {
		picker.hide();
	},
});
picker.show();
/** @type {frappe.ui.FieldGroup} */
const group = new frappe.ui.FieldGroup({
	fields: [
		{
			fieldname: "package",
			fieldtype: "Select",
			get_data() {
				const kind = group.get_value("package");
				return kind ? [String(kind)] : [];
			},
		},
	],
	body: document.body,
});
group.make();
const plain = new frappe.ui.Dialog({
	fields: [
		{
			fieldname: "doctype",
			fieldtype: "Link",
			options: "DocType",
			onchange() {
				plain.set_value("format", null);
			},
		},
		{ fieldname: "format", fieldtype: "Link", options: "Print Format" },
	],
	primary_action() {
		plain.hide();
	},
	secondary_action() {
		plain.hide();
	},
});
plain.show();
const asked = frappe.prompt(
	[
		{
			fieldname: "reason",
			fieldtype: "Data",
			onchange() {
				void asked.get_value("reason");
			},
		},
	],
	(values) => void values["reason"],
);

// frappe.prompt infers the values type from the callback's parameter.
frappe.prompt(
	[{ fieldname: "tasks", fieldtype: "Small Text", label: __("Tasks") }],
	/** @param {{ tasks?: string }} values */
	async (values) => {
		const subjects = (values.tasks ?? "").split("\n");
		void subjects;
	},
);

// A web form's attach fields take an object in options.
/** @param {import("frappe-types").DocField} df */
function no_file_browser(df) {
	if (df.fieldtype === "Attach") {
		df.options = { ...(typeof df.options === "object" && !Array.isArray(df.options) ? df.options : {}), disable_file_browser: true };
		df.is_web_form = true;
	}
}
void no_file_browser;

// The upload dialog, which arrives in a lazily required bundle.
const Uploader = frappe.ui.FileUploader;
if (Uploader) {
	const uploader = new Uploader({
		doctype: "ToDo",
		docname: "TD-0001",
		restrictions: { allowed_file_types: ["image/*"] },
		on_success(file) {
			if (file && "file_url" in file) void file.file_url;
		},
	});
	if (uploader.dialog) uploader.dialog.keep_grid_form_open = true;
	void uploader.uploader.files.map((f) => f.doc?.name);
	void uploader.upload_files();

	// Uploading, on_success gets the File document and the parsed response.
	new Uploader({
		on_success(file_doc, response) {
			/** @type {import("frappe-types").FrappeDoc | null} */
			const doc = file_doc;
			/** @type {string | undefined} */
			const url = file_doc?.file_url;
			// @ts-expect-error is_private is a Check, 0 or 1
			/** @type {boolean | undefined} */ const flag = file_doc?.is_private;
			/** @type {import("frappe-types").FrappeResponse | string} */
			const body = response;
			// @ts-expect-error without as_dataurl nothing has a dataurl
			void file_doc?.dataurl.length;
			void doc, body, url, flag;
		},
	});
	// With as_dataurl: true and nothing else to upload from, it gets the file
	// entry, its dataurl set.
	new Uploader({
		as_dataurl: true,
		disable_file_browser: true,
		allow_web_link: false,
		allow_google_drive: false,
		on_success(file) {
			/** @type {string} */
			const url = file.dataurl;
			void url, file.file_obj.name;
		},
	});
	// as_dataurl: true alone: the Library and Link tabs still upload.
	new Uploader({
		as_dataurl: true,
		on_success(file, response) {
			// @ts-expect-error a Library or Link file arrives as a File document, or null
			void file.dataurl.length;
			if (typeof file?.dataurl === "string") void file.dataurl.length;
			else void response;
		},
	});

	// The Library and Link tabs, through Vue's $refs, as frappe reads them.
	const { file_browser, web_link } = uploader.uploader.$refs;
	const selected = file_browser?.selected_node;
	/** @type {string | null | undefined} */
	const picked = selected && "file_url" in selected ? selected.file_url : web_link?.url;
	if (web_link && !picked) web_link.invalid_input(__("Please enter a valid URL"));
}

// The form footer, its comment box and timeline, and frm.events.
frappe.ui.form.on("ToDo", {
	refresh(frm) {
		if (!frm.footer && frappe.boot.desk_settings?.timeline) {
			frm.footer = new frappe.ui.form.Footer({ frm, parent: $("<div>").appendTo(frm.page.main.parent()) });
			frm.footer.refresh();
		}
		frm.comment_box?.set_value("");
		frm.timeline?.add_action_button(__("Call"), () => void frm.trigger("call"), "phone");
		void frm.events.status?.(frm);
	},
	async status(frm) {
		const submitted = await frm.savesubmit();
		void submitted.doc.status;
	},
});

// The per-user grid layout, the permission and workflow helpers.
const grid_view = frappe.get_user_settings("Sales Order", "GridView");
for (const column of grid_view["Sales Order Item"] ?? []) {
	void column.fieldname, column.width;
}
if (frappe.perm.has_perm("ToDo", 0, "write")) {
	void frappe.workflow.get_state_fieldname("ToDo");
}

// ---- negative cases -------------------------------------------------------

new frappe.ui.Dialog({
	fields: [
		// @ts-expect-error min_date is a Date, as the datepicker takes it
		{ fieldname: "since", fieldtype: "Date", min_date: "2026-01-01" },
	],
});

/** @type {frappe.ui.Dialog<{ percentage: number }>} */
const typed = new frappe.ui.Dialog({});
// @ts-expect-error not a field of this dialog
void typed.get_value("percent");
// @ts-expect-error FileUploader is lazily loaded: narrow it first
void new frappe.ui.FileUploader({});

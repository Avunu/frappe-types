// The same app patterns in compiled TypeScript: subclassing controls, typed
// dialog values, the form footer and the document-level form events, with no
// local shims or casts.

import type {
	BaseTimeline,
	ContactQuickEntryDetailField,
	ControlCode,
	ControlData,
	DocField,
	DocInfoRow,
	Form,
	FormDocumentEvents,
	FormTimeline,
	FrappeFileUploaderFile,
	LinkQuery,
} from "frappe-types";

// ui_text_editor: a rich-text control built on ControlCode.
export function install_text_editor(): void {
	class RichTextEditor extends frappe.ui.form.ControlTextEditor {
		// `declare`: frappe's constructor builds the editor from inside super().
		declare editor_root?: HTMLElement;
		declare current: string;

		override make_input(): void {
			this.has_input = true;
			this.current = typeof this.value === "string" ? this.value : "";
			this.editor_root = document.createElement("div");
			this.input_area.append(this.editor_root);
			const editable = !this.disabled && !this.df.read_only && !this.grid_row;
			void editable, this.df.placeholder, this.df.max_height;
		}

		override get_input_value(): string {
			return this.current;
		}

		override set_focus(): void {
			this.editor_root?.focus();
		}

		upload_target(): string | undefined {
			return this.frm && !this.frm.is_new() ? `${this.frm.doctype}/${this.frm.docname}` : undefined;
		}
	}
	frappe.ui.form.ControlTextEditor = RichTextEditor;
}

// esign: a shared base re-exported without a cast.
export const BaseData = frappe.ui.form.ControlData;
export class ControlUpload extends BaseData {
	override make_input(): void {
		super.make_input();
		const input: HTMLElement | undefined = this.input;
		void input;
	}
	override set_input(value: unknown): void {
		super.set_input(value);
	}
}

// A control instance read from a form, narrowed by class.
export function code_value(frm: Form, fieldname: string): string | undefined {
	const field = frm.get_field(fieldname);
	return field instanceof frappe.ui.form.ControlCode ? field.get_input_value() : undefined;
}
export function as_data(control: ControlCode): ControlData {
	return control;
}

// erpnext_taskview: a dialog typed by its values.
interface StopTimerValues {
	activity_type: string;
	description: string;
	billing_hrs: number;
}
declare function seed_billable_time(d: frappe.ui.Dialog<StopTimerValues>): void;
export function stop_timer(): void {
	// Name the values type on the variable; the dialog's own fields and actions
	// may then refer to it in any form.
	const d: frappe.ui.Dialog<StopTimerValues> = new frappe.ui.Dialog({
		title: __("Stop Timer"),
		fields: [
			{ fieldname: "billing_hrs", fieldtype: "Float", label: __("Billing Hours") },
			{ fieldname: "billable", fieldtype: "Check", onchange: () => seed_billable_time(d) },
		],
		primary_action: async (values: Partial<StopTimerValues>) => {
			const hours: number | undefined = values.billing_hrs;
			const activity: string | undefined = values.activity_type;
			void hours, activity;
			d.hide();
		},
	});
	const hrs: number | null | undefined = d.get_value("billing_hrs");
	void hrs;
	void d.set_value("billing_hrs", 2);
	d.show();
}

// A callback typed by its own parameter is accepted, as before.
new frappe.ui.Dialog({
	primary_action(values: { keep?: string }) {
		void values.keep;
	},
});

// A dialog that refers to itself without an annotation. (A hook that returns a
// value and refers to `d`, such as get_query, needs `const d: frappe.ui.Dialog`
// on TypeScript 5.x; TypeScript 7 takes it as is.)
export function pick_format(): void {
	const d = new frappe.ui.Dialog({
		fields: [
			{ fieldname: "doctype", fieldtype: "Link", options: "DocType" },
			{
				fieldname: "format",
				fieldtype: "Link",
				options: "Print Format",
				onchange() {
					d.set_df_property("format", "description", "");
				},
			},
		],
		primary_action() {
			d.hide();
		},
	});
	d.show();
}

// frappe.prompt, typed by the callback's parameter.
frappe.prompt([{ fieldname: "tasks", fieldtype: "Small Text" }], async (values: { tasks?: string }) => {
	const lines = (values.tasks ?? "").split("\n");
	void lines;
});

// Field definitions: query, change hook, dynamic link hook.
const project_query: LinkQuery = (doc) => ({ filters: { project: doc?.["project"] ?? null } });
export const fields: DocField[] = [
	{ fieldname: "task", fieldtype: "Link", options: "Task", get_query: project_query },
	{
		fieldname: "reference_name",
		fieldtype: "Dynamic Link",
		options: "reference_doctype",
		get_options: (control) => control.doctype,
	},
	{
		fieldname: "billable",
		fieldtype: "Check",
		onchange(e) {
			void e, this.get_value();
		},
	},
];

// The form footer and timeline (erpnext_taskview, pequea).
export function build_footer(form: Form): void {
	if (form.footer) return;
	const footer = new frappe.ui.form.Footer({ frm: form, parent: $("<div>").appendTo(form.page.main.parent()) });
	form.footer = footer;
	footer.refresh();
	form.timeline?.add_timeline_item({ content: __("Synced"), creation: frappe.datetime.now_datetime() });
}

// messaging: submitting from code.
export async function submit(frm: Form<"Project">): Promise<string> {
	const done = await frm.savesubmit();
	return done.doc.status;
}

// esign: the document-level form-refresh event.
$(document).on("form-refresh", (_e: JQuery.TriggeredEvent, ...[frm]: FormDocumentEvents["form-refresh"]) => {
	void frm.doctype;
});

// ui_text_editor: the upload dialog's file list.
export function failed(files: FrappeFileUploaderFile[]): string[] {
	return files.filter((f) => f.failed).map((f) => f.error_message ?? f.name);
}

// Replacing frappe's uploader with a class of one's own (cloud_storage): frappe
// only `new`s it, so the static UploadOptions and the instance members are the
// app's business.
export function install_uploader(): void {
	frappe.ui.FileUploader = class CloudUploader {
		constructor(opts?: { doctype?: string | null }) {
			void opts?.doctype;
		}
	};
}

// The email composer's typing events.
$(document).on("form-typing", (_e: JQuery.TriggeredEvent, ...[frm]: FormDocumentEvents["form-typing"]) => {
	void frm.docname;
});

// Members the less common controls define, reached through super.
export class Gallery extends frappe.ui.form.ControlAttachmentGallery {
	override async get_attachments() {
		const files = await super.get_attachments();
		return files.filter((f) => !f.is_image || f.file_url.endsWith(".png"));
	}
}
export class Duration extends frappe.ui.form.ControlDuration {
	override show_picker(): void {
		super.show_picker();
		this.$picker?.addClass("compact");
	}
}
export class Phone extends frappe.ui.form.ControlPhone {
	override set_flag(country_code: string): void {
		super.set_flag(country_code.toLowerCase());
	}
}

// frappe.ui.BaseTimeline subclassed, and the form timeline's email helpers.
export class AuditTimeline extends frappe.ui.BaseTimeline {
	override prepare_timeline_contents(): Promise<void> {
		return frappe.xcall<{ creation: string; content: string }[]>("app.api.audit").then((rows) => {
			for (const row of rows) this.timeline_items.push({ content: row.content, creation: row.creation });
		});
	}
}
export function last_email(frm: Form, timeline: BaseTimeline): DocInfoRow | null {
	timeline.refresh();
	return frm.timeline?.get_last_email() ?? null;
}
export class QuickContact extends frappe.ui.form.ContactQuickEntryForm {
	override get_detail_fields(): ContactQuickEntryDetailField[] {
		return super.get_detail_fields().filter((field) => field.table !== "email_ids");
	}
	override open_form_if_not_list(): void {
		if (this.source_frm) this.source_frm.dirty();
		super.open_form_if_not_list();
	}
}
export async function quote_for(project: string): Promise<void> {
	const form = new frappe.ui.form.QuickEntryForm("Sales Quote", null, null, null, true);
	frappe.quick_entry = form;
	await form.setup();
	frappe.quick_edit("Project", project);
}

// ---- negative cases -------------------------------------------------------

export function negatives(frm: Form): void {
	// @ts-expect-error the footer is created only when the timeline is shown
	frm.footer.refresh();
	const d: frappe.ui.Dialog<StopTimerValues> = new frappe.ui.Dialog({});
	// @ts-expect-error a value of the wrong type for the field
	void d.set_value("billing_hrs", "two");
	// @ts-expect-error values are Partial: a field left empty is missing
	const required: number = d.get_values()!.billing_hrs;
	void required;
	// @ts-expect-error the prompt's values are keyed by fieldname, never a bare value
	frappe.prompt([{ fieldname: "tasks", fieldtype: "Data" }], (values: string) => values);
	// @ts-expect-error frappe.prompt takes no type argument; annotate the callback's parameter
	frappe.prompt<{ tasks: string }>([{ fieldname: "tasks", fieldtype: "Data" }], (values) => values);
	// @ts-expect-error frappe.ui.Dialog takes no type argument; annotate the variable
	void new frappe.ui.Dialog<StopTimerValues>({});
}

// The form timeline is built with its form, as the footer does; without one,
// make() fails at once.
export function form_timeline(Timeline: typeof FormTimeline, frm: Form): FormTimeline {
	// @ts-expect-error FormTimeline requires frm, unlike BaseTimeline
	void new Timeline({ parent: $("<div>") });
	return new Timeline({ parent: $("<div>"), frm });
}

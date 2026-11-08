// The same app patterns in compiled TypeScript: subclassing controls, typed
// dialog values, the form footer and the document-level form events, with no
// local shims or casts.

import type {
	ControlCode,
	ControlData,
	DocField,
	Form,
	FormDocumentEvents,
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
export function stop_timer(): void {
	const d = new frappe.ui.Dialog<StopTimerValues>({
		title: __("Stop Timer"),
		fields: [{ fieldname: "billing_hrs", fieldtype: "Float", label: __("Billing Hours") }],
		primary_action: async (values) => {
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

// frappe.prompt, typed by its values.
frappe.prompt<{ tasks: string }>(
	[{ fieldname: "tasks", fieldtype: "Small Text" }],
	async (values) => {
		const lines = (values.tasks ?? "").split("\n");
		void lines;
	},
);

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

// ---- negative cases -------------------------------------------------------

export function negatives(frm: Form): void {
	// @ts-expect-error the footer is created only when the timeline is shown
	frm.footer.refresh();
	const d = new frappe.ui.Dialog<StopTimerValues>({});
	// @ts-expect-error a value of the wrong type for the field
	void d.set_value("billing_hrs", "two");
	// @ts-expect-error values are Partial: a field left empty is missing
	const required: number = d.get_values()!.billing_hrs;
	void required;
}

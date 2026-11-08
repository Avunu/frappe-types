// A compiled website bundle that replaces frappe's web form script, written the
// way esign_webforms' esign_web.ts / esign_webform_script.ts are, with none of
// its local `declare module "frappe/..."` shims: the side-effect imports of
// frappe's web bundles, a microtemplate, and subclasses of the WebForm and
// WebFormList classes reached by deep import.

import "frappe/public/js/bootstrap-4-web.bundle.js";
import "frappe/public/js/controls.bundle.js";
import "frappe/public/js/dialog.bundle.js";
import "frappe/public/js/frappe/ui/keyboard.js";
import "frappe/public/js/frappe/utils/datetime.js";
import "frappe/public/js/lib/moment.js";
import "./templates/order_card.html";

import type { FrappeDocBase, FrappeResponse } from "frappe-types";
import type { WebFormDoc, WebFormSaveResult } from "frappe-types/web";
import WebForm from "frappe/public/js/frappe/web_form/web_form";
import WebFormList from "frappe/public/js/frappe/web_form/web_form_list";

/** What the app's accept endpoint returns. */
interface SavedDoc {
	name: string;
	doctype: string;
	attachment?: string;
	file?: string;
}

class EsignWebForm extends WebForm {
	override handle_success(data: WebFormSaveResult): void {
		const card = document.querySelector(".esign-form-card");
		if (card) {
			card.classList.add("hide");
			if (this.success_url) this.handle_redirect();
		} else {
			super.handle_success(data);
		}
	}

	handle_redirect(): void {
		const success_url: string = this.success_url ?? "";
		window.location.href = success_url;
	}

	override render_success_page(data: WebFormSaveResult): void {
		if (typeof data !== "string" && data.name) super.render_success_page(data);
	}

	override save(): false {
		const is_new = this.is_new;
		const valid = this.validate && this.validate();
		if (!valid && valid !== undefined) return false;

		const doc_values = this.get_values(Boolean(this.allow_incomplete));
		if (!doc_values) return false;
		if (window.saving) return false;

		const for_payment = Boolean(this.accept_payment && !this.doc.paid);
		Object.assign(this.doc, doc_values);
		this.doc.doctype = this.doc_type;
		this.doc.web_form_name = this.name;

		window.saving = true;
		frappe.form_dirty = false;

		frappe.call<SavedDoc>({
			type: "POST",
			method: "my_app.web_form.accept",
			args: { data: this.doc, web_form: this.name, for_payment },
			freeze: true,
			callback: (response: FrappeResponse<SavedDoc>) => {
				if (!response.exc && response.message) {
					this.handle_success(response.message);
					frappe.web_form.events.trigger("after_save");
					this.after_save?.();
					if (is_new && (response.message.attachment || response.message.file)) {
						void response.message.doctype;
					}
				}
			},
			always: () => {
				window.saving = false;
			},
		});
		return false;
	}
}

frappe.ready(() => {
	const web_form_doc = frappe.web_form_doc;

	if (web_form_doc.is_list) {
		new WebFormList({
			doctype: web_form_doc.doc_type,
			web_form_name: web_form_doc.name,
			list_columns: web_form_doc.list_columns,
			condition_json: web_form_doc.condition_json,
			settings: { allow_delete: web_form_doc.allow_delete },
		});
		return;
	}

	const web_form = new EsignWebForm({ parent: $(".web-form-wrapper") });
	const doc: FrappeDocBase = frappe.reference_doc || {};
	setup_fields(web_form_doc);
	web_form.prepare(web_form_doc, doc);
	web_form.make();
	if (web_form_doc.is_new) web_form.set_default_values();

	// The instance is the controller frappe.web_form holds.
	const controller: WebForm = web_form;
	void controller.current_section;
});

function setup_fields(form_doc: WebFormDoc): void {
	for (const df of form_doc.web_form_fields) {
		df.read_only = df.read_only || (!form_doc.is_new && !form_doc.in_edit_mode ? 1 : 0);
	}
}

// A WebFormList subclass sees the list's state.
class CardList extends WebFormList {
	override append_rows(row_data: FrappeDocBase[]): void {
		super.append_rows(row_data);
		for (const row of this.rows) void row.is_selected();
		void this.columns?.map((col) => col.fieldname);
	}
}
void CardList;

// The row class is on frappe.ui only on a web form page.
const Row = frappe.ui.WebFormListRow;
if (Row) void Row.prototype.toggle_select;

// The list global is the empty object until a list is constructed.
const list = frappe.web_form_list;
if (list && "refresh" in list) list.refresh();

// @ts-expect-error the side-effect bundles export nothing
import { Dialog } from "frappe/public/js/dialog.bundle.js";
void Dialog;

// @ts-expect-error WebForm is the module's default export, not a named one
import { WebForm as Named } from "frappe/public/js/frappe/web_form/web_form";
void Named;

// @ts-expect-error the constructor takes the jQuery parent to render into
new WebForm({ parent: document.body });

// @ts-expect-error success_url is a string (a Data field), never a number
const url: number | undefined = frappe.web_form.success_url;
void url;

// @ts-expect-error allow_incomplete is a Check, 0 | 1
const incomplete: boolean | undefined = frappe.web_form_doc.allow_incomplete;
void incomplete;

// @ts-expect-error window.saving is a boolean guard
window.saving = "yes";

// A document from locals is a save result too.
declare const saved: import("frappe-types").FrappeDoc;
frappe.web_form.handle_success(saved);
// @ts-expect-error null is neither a document nor a URL; frappe reads data.name
frappe.web_form.handle_success(null);

// The app's own Web Form field, on the document and on the controller.
const enabled: 0 | 1 | undefined = frappe.web_form_doc.esign_enabled;
const on_controller: 0 | 1 | undefined = frappe.web_form.esign_enabled;
void [enabled, on_controller];

// A website bundle in plain JavaScript (checkJs) that replaces frappe's web form
// script: deep imports of the WebForm and WebFormList classes, subclassed with
// JSDoc, and the side-effect imports of frappe's web bundles.

import "frappe/public/js/controls.bundle.js";
import "frappe/public/js/dialog.bundle.js";
import WebForm from "frappe/public/js/frappe/web_form/web_form";
import WebFormList from "frappe/public/js/frappe/web_form/web_form_list";

class ConsentWebForm extends WebForm {
	/**
	 * @override
	 * @param {import("frappe-types/web").WebFormSaveResult} data
	 */
	handle_success(data) {
		if (this.success_url) {
			window.location.href = this.success_url;
			return;
		}
		super.handle_success(data);
	}

	/** @override */
	refresh() {
		super.refresh();
	}

	/**
	 * @override
	 * @param {Record<string, unknown>} values
	 */
	set_values(values) {
		return super.set_values(values);
	}

	/** @override */
	save() {
		if (window.saving) return false;
		if (!this.allow_incomplete && !this.validate_section()) return false;
		return super.save();
	}
}

frappe.ready(() => {
	const doc = frappe.web_form_doc;
	if (doc.is_list) {
		new WebFormList({
			doctype: doc.doc_type,
			web_form_name: doc.name,
			list_columns: doc.list_columns,
			condition_json: doc.condition_json,
			settings: { allow_delete: doc.allow_delete },
		});
		return;
	}
	const form = new ConsentWebForm({ parent: $(".web-form-wrapper") });
	form.prepare(doc, frappe.reference_doc || {});
	form.make();
	/** @type {number} */
	const section = form.current_section;
	void section;
});

// @ts-expect-error the list needs the doctype and the web form's name
new WebFormList({ settings: {} });

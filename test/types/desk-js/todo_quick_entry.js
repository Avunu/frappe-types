// An app's quick entry dialog and print-page extension: subclasses of frappe
// classes that only some pages have.

frappe.ui.form.ToDoQuickEntryForm = class ToDoQuickEntryForm extends frappe.ui.form.QuickEntryForm {
	/**
	 * @param {string} doctype
	 * @param {frappe.ui.form.QuickEntryAfterInsert} [after_insert]
	 */
	constructor(doctype, after_insert) {
		super(doctype, after_insert);
		this.skip_redirect_on_error = true;
	}

	/** @override */
	render_dialog() {
		this.mandatory = this.docfields.filter((df) => df.fieldname !== "description");
		super.render_dialog();
		this.set_intro(__("Quick ToDo"), "blue");
	}
};

void frappe.ui.form.make_quick_entry("ToDo", (doc_or_frm) => {
	if ("docname" in doc_or_frm) void doc_or_frm.docname;
	else void doc_or_frm.name;
});

// The print page defines PrintView in its own script, so it is optional.
const BasePrintView = frappe.ui.form.PrintView;
if (BasePrintView) {
	frappe.ui.form.PrintView = class extends BasePrintView {
		/**
		 * @override
		 * @param {frappe.ui.form.PrintViewTarget} frm
		 */
		show(frm) {
			const done = super.show(frm);
			if (frm.doc.docstatus === 1) this.page.add_button(__("Mail"), () => void this.selected_format());
			return done;
		}
	};
}

const BaseSelect = frappe.views.ListViewSelect;
if (BaseSelect) {
	frappe.views.ListViewSelect = class extends BaseSelect {
		/** @override */
		get_views() {
			const views = super.get_views();
			views["Board"] = { condition: this.doctype === "ToDo", action: () => this.set_route("board") };
			return views;
		}
	};
}

void frappe.todo_board_context?.board;

// ---- negative cases -------------------------------------------------------

// @ts-expect-error PrintView exists only on the print page; narrow it first
void class extends frappe.ui.form.PrintView {};

if (BaseSelect) {
	void class extends BaseSelect {
		setup_views() {
			// @ts-expect-error ListViewSelect has no setup_views since the v16 view switcher
			super.setup_views();
		}
	};
}

// @ts-expect-error an app-owned name must be declared by the app (see app_types.d.ts)
frappe.ui.form.SomeOtherQuickEntryForm = frappe.ui.form.QuickEntryForm;

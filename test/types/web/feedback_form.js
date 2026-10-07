// A Web Form client script, as frappe wraps it in `frappe.init_client_script`.

frappe.ready(() => {
	void frappe.web_form_doc.doc_type;
});

frappe.web_form.on("rating", (field, value) => {
	if (typeof value === "number" && value < 3) {
		void frappe.web_form.set_df_property("comments", "reqd", 1);
	}
	void field.df.fieldname;
});

frappe.web_form.validate = () => {
	const values = frappe.web_form.get_values();
	if (!values || !values["email"]) {
		frappe.msgprint(__("Please enter your email"));
		return false;
	}
	return true;
};

frappe.web_form.after_load = () => {
	if (frappe.web_form_doc.is_new) {
		void frappe.web_form.set_value("source", "website");
	}
	/** @type {unknown} */
	const name = frappe.reference_doc.name;
	void name;
};

frappe.web_form.events.on("after_save", () => {
	frappe.form_dirty = false;
});

// @ts-expect-error `on` takes a fieldname and a handler
frappe.web_form.on("rating");

// @ts-expect-error `frappe.web_form.is_new` is a method on every route but /new; use web_form_doc.is_new
/** @type {boolean} */ const is_new = frappe.web_form.is_new;
void is_new;

// @ts-expect-error validate must return a boolean (or nothing)
frappe.web_form.validate = () => "yes";

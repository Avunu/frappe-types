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

// The Web Form's own fields are copied onto the controller, typed.
/** @type {string} */
const target_doctype = frappe.web_form.doc_type;
frappe.web_form.doc.doctype = target_doctype;
frappe.web_form.doc.web_form_name = frappe.web_form.name;

// @ts-expect-error doc_type is the target doctype's name, a string
void (frappe.web_form.doc_type * 2);

// A custom save that honours frappe's web form save guard (esign_webforms
// declared window.saving itself).
function save_signed() {
	if (window.saving) return false;
	window.saving = true;
	frappe.call({
		method: "app.api.accept",
		args: { data: frappe.web_form.doc },
		always: () => {
			window.saving = false;
		},
	});
	return false;
}
void save_signed;

// The window helpers only the website script defines (website.js:581-625).
frappe.web_form.validate = () => {
	const email = frappe.web_form.get_value("email");
	if (typeof email === "string" && !valid_email(email)) {
		frappe.msgprint(__("Please enter a valid email"));
		return false;
	}
	const comments = frappe.web_form.get_value("comments");
	if (typeof comments === "string" && is_html(comments)) {
		frappe.msgprint(__("Plain text only"));
		return false;
	}
	return true;
};
if (!frappe.session.user || frappe.session.user === "Guest") ask_to_login();
/** @type {string} */
const signer = window.full_name ?? __("Guest");
void signer;

// @ts-expect-error valid_email calls id.toLowerCase(), so it takes a string
void valid_email(null);
// @ts-expect-error full_name is copied on document ready: read it as window.full_name
void full_name;

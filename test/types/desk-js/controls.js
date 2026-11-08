// Subclassing frappe's controls from a desk bundle, as apps do, with no local
// shim or cast: each control is its own class, so super calls and the members
// a subclass reads (input_area, $input, has_input, editor, …) type-check.

// Replacing a control with a subclass of itself (pequea's fraction field).
const OriginalControlFloat = frappe.ui.form.ControlFloat;
frappe.ui.form.ControlFloat = class ControlFloat extends OriginalControlFloat {
	/** @override */
	make_input() {
		super.make_input();
		// ControlInt narrows $input to an <input>.
		this.$input?.on("blur", () => void this.input?.value);
	}

	/** @override */
	get_input_value() {
		const value = super.get_input_value();
		return typeof value === "string" ? value.replace("/", ".") : value;
	}

	/**
	 * @override
	 * @param {unknown} value
	 */
	set_formatted_input(value) {
		super.set_formatted_input(value);
	}

	/**
	 * @override
	 * @param {unknown} value
	 */
	set_input(value) {
		super.set_input(value);
		void this.parse_validate_and_set_in_model(value);
	}

	/**
	 * @override
	 * @param {unknown} value
	 */
	parse(value) {
		const parsed = super.parse(value);
		return parsed === null ? null : parsed + (this.get_number_format()?.length ?? 0);
	}
};

// A new control built on ControlData (pequea's checkbox buttons, esign's
// controls). The app declares the name it adds (app_types.d.ts).
frappe.ui.form.ControlCheckboxButton = class ControlCheckboxButton extends frappe.ui.form.ControlData {
	/** @override */
	make_input() {
		// Any element: $input is an HTMLElement on ControlData.
		this.$input = $("<button>").appendTo(this.input_area);
		this.input = this.$input.get(0);
		this.has_input = true;
		const onchange = this.df.onchange;
		if (onchange) void onchange.call(this);
	}

	/** @override */
	get_input_value() {
		return this.value ?? this.last_value;
	}

	/** @param {import("frappe-types").DocField["options"]} raw */
	normalize_options(raw) {
		if (typeof raw === "string") return raw.split("\n");
		if (Array.isArray(raw)) return raw.map((o) => (typeof o === "string" ? o : (o.value ?? "")));
		return [];
	}
};

// Replacing ControlData itself (pequea's address autocomplete).
const OriginalControlData = frappe.ui.form.ControlData;
frappe.ui.form.ControlData = class ControlData extends OriginalControlData {
	/** @override */
	make_input() {
		super.make_input();
		if (this.df.options === "Address") this.$input?.attr("autocomplete", "street-address");
	}
};

// Replacing the Geolocation control (pequea's Google map).
const OriginalControlGeolocation = frappe.ui.form.ControlGeolocation;
frappe.ui.form.ControlGeolocation = class ControlGeolocation extends OriginalControlGeolocation {
	/**
	 * @override
	 * @param {unknown} value
	 */
	set_disp_area(value) {
		if (this.df.options === "Google" && this.disp_area) return;
		return super.set_disp_area(value);
	}

	/**
	 * @override
	 * @param {unknown} value
	 */
	make_map(value) {
		return super.make_map(value);
	}

	/**
	 * @override
	 * @param {string} value
	 */
	bind_leaflet_data(value) {
		return super.bind_leaflet_data(value);
	}
};

// The narrowed inputs.
/** @param {frappe.ui.form.ControlSelect} select */
function selected_index(select) {
	return select.input?.selectedIndex;
}
/** @param {frappe.ui.form.ControlText} text */
function rows(text) {
	return text.input?.rows;
}
/** @param {frappe.ui.form.ControlButton} button */
function button_type(button) {
	return button.input?.type;
}
void selected_index, rows, button_type;

// A Code field's Ace editor (pequea's wrap-mode tweak).
frappe.ui.form.on("ToDo", {
	refresh(frm) {
		const field = frm.get_field("description");
		if (field instanceof frappe.ui.form.ControlCode && field.editor) {
			field.editor.session.setUseWrapMode(true);
			field.editor.session.setMode("ace/mode/python");
			field.editor.setTheme("ace/theme/monokai");
			/** @type {string} */
			const code = field.editor.getValue();
			void code;
		}
	},
});

// Dynamic Link without a form (data_steward's side panel): the control's
// own get_options, and the df hook frappe honours.
/**
 * @param {frappe.ui.form.Control | undefined} control
 * @param {import("frappe-types").FrappeDoc} doc
 */
function point_dynamic_link(control, doc) {
	if (control instanceof frappe.ui.form.ControlDynamicLink) {
		control.get_options = () => String(doc["reference_doctype"] ?? "");
		control.df.get_options = (c) => c.doctype;
	}
}
void point_dynamic_link;

// A frm-less Layout's fetch_from hook (data_steward).
const layout = new frappe.ui.form.Layout({ parent: document.body, fields: [] });
layout.set_value = /** @param {string} fieldname @param {unknown} value */ (fieldname, value) => {
	void fieldname, value;
};

// The controls frappe.ui.form.make_control builds are reachable by name.
/** @type {typeof frappe.ui.form.ControlData} */
const Read_only = frappe.ui.form.ControlReadOnly;
/** @type {typeof frappe.ui.form.ControlText} */
const Long_text = frappe.ui.form.ControlLongText;
void Read_only, Long_text;

// ---- negative cases -------------------------------------------------------

/** @param {frappe.ui.form.ControlData} data */
function not_an_input(data) {
	// @ts-expect-error ControlData's input may be a <select> or <textarea>: narrow it first
	void data.input?.selectionStart;
}
void not_an_input;

/** @param {frappe.ui.form.ControlLink} link */
function link_query(link) {
	// @ts-expect-error a link query is a string, an object or a function returning one of them
	link.get_query = 42;
}
void link_query;

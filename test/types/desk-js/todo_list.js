// A `<doctype>_list.js`. The settings object is annotated, then assigned.

/** @type {frappe.views.ListViewSettings<"ToDo">} */
const todo_list_settings = {
	add_fields: ["status", "priority"],
	filters: [["status", "=", "Open"]],
	get_indicator(doc) {
		// list rows hold only the fields the view fetched: every field is optional
		switch (doc.status) {
			case "Open":
				return [__("Open"), "orange", "status,=,Open"];
			case "Closed":
				return [__("Closed"), "green", "status,=,Closed"];
			default:
				return [__("Cancelled"), "gray", "status,=,Cancelled"];
		}
	},
	formatters: {
		description(value) {
			return frappe.utils.escape_html(String(value ?? ""));
		},
	},
	onload(listview) {
		void listview;
	},
};

frappe.listview_settings["ToDo"] = todo_list_settings;

// A query report script. `frappe.query_reports` is optional on `frappe` (it
// exists only once the report bundle has loaded); `frappe.provide` returns it
// typed and creates it if missing, which is what query_report.js does itself.

/** @type {frappe.views.QueryReportSettings} */
const report = {
	filters: [
		{ fieldname: "status", label: __("Status"), fieldtype: "Select", options: "\nOpen\nClosed" },
	],
	formatter(value, row, column, data, default_formatter) {
		const html = default_formatter(value, row, column, data);
		return column.fieldname === "status" && data?.["status"] === "Open" ? `<b>${html}</b>` : html;
	},
	onload(report) {
		const filter = report.get_filter("status");
		void filter;
	},
};

frappe.provide("frappe.query_reports")["Open ToDos"] = report;

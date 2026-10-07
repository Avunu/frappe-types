// A Page doctype's script (`<app>/page/todo_board/todo_board.js`), plus the desk
// helpers page and list scripts lean on: realtime, defaults, datetime, the
// sort selector and the report view's group-by control.

const wrapper = frappe.pages["todo-board"];
if (wrapper) {
	wrapper.on_page_load = (page_wrapper) => {
		const parent = frappe.make_page(true, page_wrapper.page_name ?? "todo-board", null);
		parent.page.set_title(__("ToDo Board"));
	};
	wrapper.on_page_show = () => frappe.get_current_page()?.set_title(__("ToDo Board"));
}

/** @type {string} */
const today = frappe.datetime.get_today();
/** @type {string} */
const last_week = frappe.datetime.add_days(today, -7);
/** @type {Date} */
const now = frappe.datetime.now_datetime(true);
/** @type {string} */
const month_start = frappe.datetime.month_start();
void last_week, now, month_start;

frappe.realtime.on("todo_update", (/** @type {{ name: string }} */ data) => {
	void data.name.toUpperCase();
});
frappe.realtime.doc_subscribe("ToDo", "TD-0001");

if (frappe.user.has_role(["System Manager", "Projects User"])) {
	/** @type {string | undefined} */
	const company = frappe.defaults.get_user_default("Company");
	void company;
}

void frappe.run_serially([() => frappe.require("side_panel.bundle.js"), (previous) => void previous, null]);

class TodoSortSelector extends frappe.ui.SortSelector {
	/** @override */
	get_sql_string() {
		return "`tabToDo`.`date` asc, `tabToDo`.`name` asc";
	}
}
const selector = new TodoSortSelector({
	parent: $("<div>"),
	doctype: "ToDo",
	args: "`tabToDo`.`modified` desc",
	onchange: (sort_by, sort_order) => void (sort_by + sort_order),
});
selector.set_value("date", "asc");

const views = frappe.views;
if (views.ListView && views.ListViewSelect) {
	const report = /** @type {frappe.views.ReportView | undefined} */ (cur_list ?? undefined);
	if (report && frappe.ui.GroupBy) {
		report.group_by_control = new frappe.ui.GroupBy(report);
	}
}

// ---- negative cases -------------------------------------------------------

// @ts-expect-error a page that has not been routed to has no entry
frappe.pages["todo-board"].on_page_load = () => {};

// @ts-expect-error month_start takes no argument (the one timeclock passes is ignored)
frappe.datetime.month_start(today);

frappe.realtime.on("todo_update", (data) => {
	// @ts-expect-error a realtime payload is unknown until you say what it is
	void data.name;
});

// @ts-expect-error get_default JSON-parses the value, so it is unknown
void frappe.defaults.get_default("Company").toUpperCase();

// @ts-expect-error has_role returns true or undefined, never false
if (frappe.user.has_role("Guest") === false) void 0;

// @ts-expect-error set_value throws for an order other than "asc" / "desc"
selector.set_value("date", "up");

// @ts-expect-error GroupBy is defined by the lazily loaded report bundle
void new frappe.ui.GroupBy(/** @type {frappe.views.ReportView} */ (/** @type {unknown} */ (null)));

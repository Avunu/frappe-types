// A Page doctype's script (`<app>/page/todo_board/todo_board.js`), plus the desk
// helpers page and list scripts lean on: realtime, defaults, datetime, the
// sort selector and the report view's group-by control.

const wrapper = frappe.pages["todo-board"];
if (wrapper) {
	wrapper.on_page_load = (page_wrapper) => {
		const parent = frappe.make_page(true, page_wrapper.page_name ?? "todo-board", null);
		parent.page.set_title(__("ToDo Board"));
		// make_app_page is what gives the wrapper its page.
		frappe.ui.make_app_page({ parent: page_wrapper, title: __("ToDo Board") });
		page_wrapper.page?.set_indicator(__("Live"), "green");
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
/** @param {boolean} as_obj */
const now_either = (as_obj) => frappe.datetime.now_date(as_obj);
/** @type {string | Date} */
const either = now_either(false);
void either;
/** @type {string | null | undefined} */
const avatar = frappe.user.image();
void avatar;
/** @type {boolean} */
const grid = frappe.views.FileView?.grid_view ?? false;
void grid;
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
	if (report) {
		report.group_by_control = new frappe.ui.GroupBy(report);
	}
}

// ---- negative cases -------------------------------------------------------

// @ts-expect-error a page that has not been routed to has no entry
frappe.pages["todo-board"].on_page_load = () => {};

if (wrapper) {
	wrapper.on_page_load = (page_wrapper) => {
		// @ts-expect-error the wrapper has no page until make_app_page has run
		page_wrapper.page.set_title(__("ToDo Board"));
	};
}

const image = frappe.user.image();
if (image !== undefined) {
	// @ts-expect-error a user without an image has a null image
	void image.length;
}

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

// @ts-expect-error get_side_panel is in side_panel.bundle.js, which loads on demand
frappe.ui.get_side_panel().open("ToDo", "TD-0001");

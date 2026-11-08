// The frappe.views / frappe.utils patterns apps use, written as the apps write
// them in desk JavaScript, with no local shim and no cast: replacing a view
// class with a subclass, list settings hooks, patching the side panel, a
// doctype's calendar settings, an app's own view mode, and the helpers on the
// `frappe` root.

// ---- replacing frappe.views.ListView with a subclass ----------------------
// (data_steward merge_records.js; ListView is generic, but the slot is not.)

const BaseListView = frappe.views.ListView;
if (BaseListView) {
	frappe.views.ListView = class extends BaseListView {
		/** @param {ConstructorParameters<NonNullable<typeof frappe.views.ListView>>[0]} opts */
		constructor(opts) {
			super(opts);
			this.merge_button_added = false;
		}

		/** @override */
		setup_page() {
			super.setup_page();
			if (this.doctype === "ToDo") this.hide_sort_selector = true;
		}

		/**
		 * @override
		 * @param {string} sort_by
		 * @param {string} sort_order
		 */
		on_sort_change(sort_by, sort_order) {
			super.on_sort_change(sort_by, sort_order);
		}
	};
	void BaseListView.load_last_view();
}

// ---- listview_settings: onload and refresh get the view -------------------
// (messaging contact_list.js, data_steward file_list.js)

/** @param {frappe.views.ListView | frappe.views.ReportView} listview */
function add_merge_action(listview) {
	listview.page.add_action_item(__("Merge"), () => void listview.get_checked_items(true));
}

/** @type {frappe.views.ListViewSettings<"ToDo">} */
const todo_settings = {
	onload(listview) {
		listview.page.add_action_item(__("Add to Group"), () => {
			const names = listview.get_checked_items().map((doc) => doc.name);
			void names;
		});
		const standard_items = listview.get_actions_menu_items.bind(listview);
		listview.get_actions_menu_items = () => standard_items();
		listview.page.clear_actions_menu();
	},
	get_coords_method: "my_app.api.get_coords",
	gantt_custom_popup_html(task, item) {
		return `${String(task.name)} ${item ? item.name : ""}`;
	},
};
frappe.listview_settings["ToDo"] = todo_settings;

// A function assigned to a property is typed through the hook's own type, not a
// cast: TypeScript 5.x does not contextually type it in JavaScript (7 does).
const file_settings = frappe.listview_settings["File"] || (frappe.listview_settings["File"] = {});
const frappe_refresh = file_settings.refresh;
/** @type {frappe.views.ListViewSettings["refresh"]} */
const file_refresh = function (view) {
	if (frappe_refresh) frappe_refresh.call(file_settings, view);
	add_merge_action(view);
};
file_settings.refresh = file_refresh;

// ---- an app's own view mode (messaging's Chat view, erpnext_taskview's Tasks) ----

if (!frappe.views.view_modes?.includes("Board")) frappe.views.view_modes?.push("Board");
if (frappe.views.view_icon_map) frappe.views.view_icon_map["Board"] = "layout";

const BaseViewSelect = frappe.views.ListViewSelect;
if (BaseViewSelect) {
	frappe.views.ListViewSelect = class extends BaseViewSelect {
		/** @override */
		set_current_view() {
			this.label_map["Board"] = __("Board View");
			/** @type {string} frappe labels each of its own views */
			const list_label = this.label_map["List"];
			void list_label;
			super.set_current_view();
		}
	};
}

const original_generate_route = frappe.utils.generate_route;
/** @type {typeof frappe.utils.generate_route} */
const generate_board_route = function (item) {
	if (item.type.toLowerCase() === "doctype" && item.doc_view === "Board") {
		return `/desk/${frappe.router.slug(item.name ?? "")}/view/board`;
	}
	return original_generate_route.call(frappe.utils, item);
};
frappe.utils.generate_route = generate_board_route;

// ---- patching the side panel (data_steward, erpnext_cis_plus) --------------

/** @typedef {frappe.ui.DocPreview & { write_permlevels?: number[] }} EditablePreview */

const SidePanel = frappe.ui.SidePanel;
if (SidePanel) {
	const proto = SidePanel.prototype;
	const { render_doc, make_buttons, set_header, open, close } = proto;
	proto.render_doc = function (doctype, preview) {
		render_doc.call(this, doctype, preview);
		const entry = this.layouts[doctype];
		if (entry) this.prepare_grids(entry.layout, preview.doc);
		void preview.permlevels.includes(1);
	};
	proto.make_buttons = function () {
		make_buttons.call(this);
		this.$panel.find(".side-panel-actions");
	};
	proto.set_header = function (doctype, docname, preview) {
		set_header.call(this, doctype, docname, preview);
		if (preview) void preview.doc.name;
	};
	proto.open = function (doctype, docname, opts) {
		open.call(this, doctype, docname, opts);
	};
	proto.close = function () {
		close.call(this);
	};
}

/**
 * @param {frappe.ui.SidePanel} panel
 * @param {string} doctype
 * @param {string} name
 * @param {EditablePreview} preview
 */
function cache_preview(panel, doctype, name, preview) {
	panel.previews[`${doctype}/${name}`] = preview;
	if (panel.current) panel.show_preview(doctype, name, preview);
}
void cache_preview;

// ---- a doctype's calendar and Gantt views (pequea project_calendar.js) -----

frappe.provide("frappe.views.calendar")["Project"] = {
	field_map: {
		start: "expected_start_date",
		end: "expected_end_date",
		id: "name",
		title: "name",
		status: "status",
		allDay: "allDay",
		progress(data) {
			return data.status === "Completed" ? 100 : 0;
		},
	},
	gantt: true,
	get_css_class(data) {
		return data.status === "Completed" ? "green" : "purple";
	},
	filters: [{ fieldtype: "Link", fieldname: "company", options: "Company", label: __("Company") }],
	get_events_method: "my_app.api.get_calendar_events",
};

/** @type {frappe.views.CalendarSettings} */
const task_calendar = { field_map: { start: "exp_start_date", end: "exp_end_date" }, gantt: { order_by: "exp_start_date" } };
void task_calendar;

const BaseGanttView = frappe.views.GanttView;
if (BaseGanttView) {
	frappe.views.GanttView = class extends BaseGanttView {
		/** @override */
		get_call_args() {
			const args = super.get_call_args();
			args.method = "my_app.api.get_gantt_events";
			void this.calendar_settings.field_map.start;
			return args;
		}
	};
}

// ---- the email composer (messaging) ----------------------------------------

const Composer = frappe.views.CommunicationComposer;
if (Composer) {
	const composer = new Composer({ subject: __("Hello"), recipients: "someone@example.com", attach_document_print: true });
	composer.dialog.show();
	void new Composer();
}

// ---- frappe.DataTable as a JSDoc type (pequea, gcl) -------------------------

/** @type {frappe.DataTable | null} */
let explorer = null;

/**
 * @param {HTMLElement} wrapper
 * @param {frappe.DataTableOptions} options
 */
function make_explorer(wrapper, options) {
	explorer = new frappe.DataTable(wrapper, options);
	explorer.refresh();
	return explorer;
}
void make_explorer;

// ---- helpers on the frappe root ----------------------------------------------

const shell = frappe.utils.sidebar_for_module("Accounts");
if (shell) {
	/** @type {string} the boot entry's own key (carbon_theme switcher.ts) */
	const shell_name = shell.name;
	void shell_name;
	void shell.items.find((item) => item.type === "Link");
}

frappe.route_options = { status: "Open" };
frappe.set_route("List", "ToDo");
frappe.breadcrumbs.add("Desk", "ToDo");
void frappe.container?.change_to("todo-board");

frappe.ui.form.on("ToDo", {
	refresh(frm) {
		frappe.contacts?.render_address_and_contact(frm);
	},
});

// ---- negative cases -------------------------------------------------------

// @ts-expect-error a view name nobody registered in FrappeViewModes
frappe.views.view_modes?.push("Bord");

frappe.utils.generate_route({
	type: "doctype",
	name: "ToDo",
	// @ts-expect-error not a doc_view frappe (or the app) routes
	doc_view: "Gallery",
});

if (shell) {
	// @ts-expect-error the boot entry is closed: no `sidebar_name`
	void shell.sidebar_name;
}

// @ts-expect-error the side panel exists only once its bundle has loaded; narrow it first
void frappe.ui.SidePanel.prototype.previews;

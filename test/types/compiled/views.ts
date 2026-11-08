// The frappe.views / frappe.utils patterns of the apps written in TypeScript,
// with no local copy of a frappe type and no cast: an app's own view mode and
// its route (messaging's Chat view), a list view subclass overriding the sort
// hook (erpnext_taskview), the module sidebar lookup (carbon_theme), and the
// datatable's guessed filter and Query Report columns.

import type {
	DataTableColumn,
	DataTableGuessedFilter,
	DocField,
	DocPreview,
	Form,
	FrappeDoc,
	FrappeGenerateRouteItem,
	FrappeModuleSidebar,
	FrappeViewName,
	ListFactoryViewOptions,
	ListView,
	ListViewSelectView,
	SidePanel,
} from "frappe-types";

declare module "frappe-types" {
	interface FrappeViewModes {
		Chat: true;
	}
	interface FrappeGenerateRouteDocViews {
		Chat: true;
	}
	interface FrappeViewsNamespace {
		ChatView?: new (opts: ListFactoryViewOptions) => ListView;
	}
	// An instance member of the app's own, merged into frappe's class. The
	// interface repeats the class's type parameter.
	interface ListView<TColumn> {
		chat_unread?: number;
	}
}

// ---- an app's view mode, with no cast into FrappeViewName ----------------

const CHAT_VIEW: FrappeViewName = "Chat";

const BaseListView = frappe.views.ListView;
if (BaseListView) {
	class ChatView extends BaseListView {
		constructor(opts: ListFactoryViewOptions) {
			super(opts);
			this.chat_unread = 0;
		}

		override get view_name(): FrappeViewName {
			return CHAT_VIEW;
		}

		override on_sort_change(sort_by: string, sort_order: string): void {
			this.sort_by = sort_by;
			this.sort_order = sort_order;
			if (this.hide_sort_selector) return;
			super.on_sort_change(sort_by, sort_order);
		}
	}
	frappe.views.ChatView = ChatView;
	// The frappe idiom of replacing the class: no cast back to `typeof ListView`.
	frappe.views.ListView = class extends BaseListView {};
}

const BaseListViewSelect = frappe.views.ListViewSelect;
if (BaseListViewSelect) {
	frappe.views.ListViewSelect = class ChatViewSelect extends BaseListViewSelect {
		override set_current_view(): void {
			this.label_map[CHAT_VIEW] = __("Chat View");
			super.set_current_view();
		}

		override get_views(): ReturnType<InstanceType<typeof BaseListViewSelect>["get_views"]> {
			const chat: ListViewSelectView = {
				condition: this.doctype === "Communication",
				action: () => this.set_route("chat"),
			};
			return { ...super.get_views(), [CHAT_VIEW]: chat };
		}
	};
}

if (!frappe.views.view_modes?.includes(CHAT_VIEW)) frappe.views.view_modes?.push(CHAT_VIEW);
if (frappe.views.view_icon_map) frappe.views.view_icon_map[CHAT_VIEW] = "message-circle";

const label_map = frappe.views.get_view_label_map?.();
if (label_map) {
	const list_label: string = label_map.List;
	void list_label;
}

// ---- generate_route with the app's doc_view -----------------------------

const original_generate_route = frappe.utils.generate_route;
frappe.utils.generate_route = function (this: unknown, item: FrappeGenerateRouteItem): string {
	if (item.type.toLowerCase() === "doctype" && item.doc_view === "Chat") {
		return `/desk/${frappe.router.slug(item.doctype || item.name || "")}/view/chat`;
	}
	return original_generate_route.call(this, item);
};

// ---- settings hooks receive the list view ----------------------------------

frappe.listview_settings["Contact"] = {
	onload(listview) {
		listview.page.add_action_item(__("Add to Group"), () => {
			void listview.get_checked_items(true);
		});
	},
	refresh(view) {
		// BaseList#refresh makes the call, so an app's own BaseList view gets it too.
		const ListViewClass = frappe.views.ListView;
		if (ListViewClass && view instanceof ListViewClass) void view.columns.length;
	},
};

// ---- the email composer with frappe's own optional values (form_timeline.js) ----

export function reply(frm: Form, last: (FrappeDoc & { sender: string; recipients: string; subject?: string }) | null): void {
	const Composer = frappe.views.CommunicationComposer;
	if (!Composer) return;
	const composer = new Composer({
		frm,
		title: last ? __("Reply") : null,
		last_email: last,
		subject: last && last.subject,
		sender: last?.sender,
	});
	const cc: string | null | undefined = composer.cc;
	void cc;
}

// ---- a Workspace Shortcut with no doc_view routes to the default view ----

export const default_route: string = frappe.utils.generate_route({ type: "DocType", name: "ToDo", doc_view: "" });

// ---- a Gantt view subclass (pequea) ----------------------------------------

const BaseGanttView = frappe.views.GanttView;
if (BaseGanttView) {
	frappe.views.GanttView = class extends BaseGanttView {
		override fill_width(gantt: unknown): boolean {
			return super.fill_width(gantt);
		}
		override scroll_to_today(gantt: unknown): unknown {
			this.scroll_to_today_on_view_change = false;
			return super.scroll_to_today(gantt);
		}
	};
}

// ---- the module sidebar lookup (carbon_theme switcher.ts) ----------------

export function icon_route(module: string): string | undefined {
	const shell: FrappeModuleSidebar | undefined = frappe.utils.sidebar_for_module(module);
	if (!shell) return undefined;
	const first = shell.items.find((item) => item.type === "Link");
	return first ? `/desk/${frappe.router.slug(shell.name)}` : undefined;
}

// ---- the side panel's preview cache (erpnext_cis_plus party_records.js) ---

export function cached_preview(panel: SidePanel, doctype: string, name: string): DocPreview | undefined {
	const preview = panel.previews[`${doctype}/${name}`] ?? panel.preview;
	if (preview) panel.render_doc(doctype, preview);
	return preview;
}

// ---- the datatable's inline filter (carbon_theme features.ts) ------------

type InlineFilter = Exclude<DataTableGuessedFilter, { type?: undefined }>;

export function describe_filter(filter: InlineFilter): string {
	switch (filter.type) {
		case "range": {
			const [from, to] = filter.text;
			return `${from}..${to}`;
		}
		case "equals":
		case "notEquals":
			return filter.text.toFixed(0);
		default:
			return filter.text.toLowerCase();
	}
}

// ---- a Query Report column is usable as its docfield (carbon_theme paste.ts) ----

export function column_field(column: DataTableColumn): Pick<DocField, "fieldtype" | "options"> | undefined {
	if (!column.fieldtype) return undefined;
	return column.options === undefined
		? { fieldtype: column.fieldtype }
		: { fieldtype: column.fieldtype, options: column.options };
}

// ---- negative cases -------------------------------------------------------

// @ts-expect-error not a registered view mode
export const typo: FrappeViewName = "Chatt";

export function empty_filter(filter: DataTableGuessedFilter): void {
	if (filter.type === undefined) {
		// @ts-expect-error an empty keyword's filter has no text
		void filter.text.length;
	}
}

/**
 * `frappe.ui.Sidebar` — the v16 desk's left **Workspace Sidebar**, plus the
 * `SidebarHeader` and `SidebarEditor` it owns and the boot payload it renders.
 *
 * Source of truth: frappe v16.33.1 (`git tag v16.33.1`, branch `version-16`),
 * `frappe/public/js/frappe/ui/sidebar/**` and `frappe/boot.py`. Citations are
 * `file.js:line` relative to `frappe/public/js/frappe/ui/sidebar/` unless a
 * path is given.
 *
 * ## Why this slice exists
 *
 * v16 removed the desk's top navbar: `ui/toolbar/navbar.html` is now only the
 * announcement strip, and the brand, app switcher, user/help menus, search and
 * notifications all live in this sidebar. A theme that wants a real header has
 * to read the sidebar's state — which workspace is current, which app owns it,
 * what the items are — rather than the boot payload, because the sidebar is
 * the thing that resolves a route to a workspace (`set_workspace_sidebar`,
 * sidebar.js:665-689). That is the consumer these declarations were verified
 * for.
 *
 * ## Three runtime facts that shape the declarations
 *
 * 1. **The constructor can return early.** `sidebar.js:5-8` bails when
 *    `!frappe.boot.setup_complete`, so on a setup-wizard session
 *    `frappe.app.sidebar` is an instance with **no** constructor-assigned
 *    fields — `wrapper`, `editor`, `items`, … are all absent, while the
 *    prototype methods still exist. Every field the constructor assigns is
 *    therefore optional here. Narrow once (`const wrapper = sidebar.wrapper;
 *    if (!wrapper) return;`) rather than `!`-asserting.
 *
 * 2. **The `sidebar_setup` event fires BEFORE the state changes.**
 *    `setup()` triggers `$(document).trigger("sidebar_setup", { sidebar })` at
 *    sidebar.js:283 and only then assigns `sidebar_title` (:284), runs
 *    `prepare()` (:288) and renders (:291). A handler bound to that event sees
 *    the *previous* workspace. Code that needs the new state hooks
 *    {@link FrappeSidebar.make_sidebar} instead, which is the last step of
 *    `setup()` (:291) and is also what the editor calls directly on save /
 *    discard (`sidebar_editor.js:75, :82, :537-579`).
 *
 * 3. **`frappe.current_app` can be stale.** `choose_app_name()`
 *    (sidebar.js:43-77) assigns it only on a match (:53) and never clears it,
 *    so after switching to "My Workspaces" or a folder sidebar it still names
 *    the previous app while {@link FrappeSidebar.header_subtitle} has moved on
 *    to the user / folder label. Re-apply the predicate at :47-50
 *    (`app.workspaces.includes(sidebar_title) || app.app_name === sidebar_data.app`)
 *    when the answer matters.
 */

import type { FrappeBootAppEntry } from "../core";
import type { FrappeCheck } from "../model";
import type { FrappeNotifications } from "./notifications";
import type { FrappeRouter } from "../utils";

/**
 * `Workspace Sidebar Item.type` —
 * `frappe/desk/doctype/workspace_sidebar_item/workspace_sidebar_item.json`
 * (Select options; default `"Link"`). Rendering picks the class
 * `frappe.ui.sidebar_item.Type<TitleCased>` from it (sidebar.js:573-577).
 */
export type FrappeWorkspaceSidebarItemType = "Link" | "Section Break" | "Spacer" | "Sidebar Item Group";

/**
 * `Workspace Sidebar Item.link_type` — same JSON (Select options; default
 * `"DocType"`). Drives `TypeLink.get_path()` (sidebar_item.js:14-76).
 */
export type FrappeWorkspaceSidebarLinkType = "DocType" | "Page" | "Report" | "Workspace" | "Dashboard" | "URL";

/**
 * One row of `frappe.boot.workspace_sidebar_item[<key>].items`.
 * Server shape: `frappe/boot.py:464-479` (`get_sidebar_items`), which copies
 * the Workspace Sidebar Item child row field by field — so every value is
 * whatever the doctype stored, i.e. `null` for an unset Data/Select field and
 * `0 | 1` for Checks. `label` is passed through `_()` (boot.py:465) and so
 * arrives **translated**; nothing else is.
 *
 * `report` is added at boot.py:486-492 only for an enabled, existing Report
 * link. `nested_items` and `parent` are **client-side** additions made by
 * `find_nested_items()` (sidebar.js:264, :270): a `Section Break` row collects
 * the `child` rows that follow it into `nested_items`, and each of those gets
 * `parent`. The nesting is exactly one level deep (:258-277).
 */
export interface FrappeWorkspaceSidebarItem {
	/** boot.py:465 — `_(item.label)`, translated. */
	label: string;
	/** boot.py:466. Dynamic Link on `link_type`; `null` for Section Breaks / Spacers. */
	link_to: string | null;
	/** boot.py:467. */
	link_type: FrappeWorkspaceSidebarLinkType | null;
	/** boot.py:468. */
	type: FrappeWorkspaceSidebarItemType;
	/** boot.py:469 — an Icon field (frappe sprite name or emoji). */
	icon: string | null;
	/** boot.py:470 — nested under the preceding Section Break when `1`. */
	child: FrappeCheck;
	/** boot.py:471 — Section Break only; default `1`. */
	collapsible: FrappeCheck;
	/** boot.py:472 — Section Break only: rendered as a collapsible group rather than a labelled divider (sidebar_item.html:10-16). */
	indent: FrappeCheck;
	/** boot.py:473 — Section Break only. */
	keep_closed: FrappeCheck;
	/** boot.py:474 — `link_type === "URL"` only. */
	url: string | null;
	/** boot.py:475 — swaps the icon for a chevron (sidebar_item.html:28-30). */
	show_arrow: FrappeCheck;
	/** boot.py:476 — a JSON string of filters, parsed by `TypeLink.get_path()` (sidebar_item.js:58-62). */
	filters: string | null;
	/** boot.py:477 — a JSON string, parsed at sidebar_item.js:48-52 / :65-66. */
	route_options: string | null;
	/** boot.py:478 — the `navigate_to_tab` field, renamed. */
	tab: string | null;
	/** boot.py:486-492 — only for an existing, enabled Report link. */
	report?: { report_type: string; ref_doctype: string | null };
	/** Client-side, sidebar.js:264. Populated on Section Breaks; `[]` elsewhere. */
	nested_items?: FrappeWorkspaceSidebarItem[];
	/** Client-side, sidebar.js:270. Set on `child` rows only. */
	parent?: FrappeWorkspaceSidebarItem;
}

/**
 * One value of `frappe.boot.workspace_sidebar_item`, keyed by the sidebar
 * title **lowercased** (`frappe/boot.py:507-514`). A per-user copy named
 * `"<title>-<user>"` is folded back onto the standard key by
 * `add_user_specific_sidebar` (boot.py:546-557), so the key never carries the
 * user suffix on the client.
 */
export interface FrappeWorkspaceSidebar {
	/** boot.py:508 — the sidebar title, **untranslated** (templates apply `__()`; sidebar_header.html:11). */
	label: string;
	/** boot.py:509. */
	items: FrappeWorkspaceSidebarItem[];
	/** boot.py:510. */
	header_icon: string | null;
	/** boot.py:511. */
	module_onboarding: string | null;
	/** boot.py:512. */
	module: string | null;
	/** boot.py:513 — the owning app's `app_name`; matched against `FrappeBootAppEntry.app_name` at sidebar.js:50. */
	app: string | null;
}

/**
 * `SidebarEditor` — `sidebar_editor.js:1`, an ES-module class imported by
 * sidebar.js:2 and instantiated at sidebar.js:11. Not reachable from the
 * `frappe` global (there is no `frappe.ui.SidebarEditor`), hence an interface.
 * Only the surface the sidebar itself reads is declared.
 */
export interface FrappeSidebarEditor {
	/** sidebar_editor.js:3. */
	sidebar: FrappeSidebar;
	/** sidebar_editor.js:4, :29, :45. */
	edit_mode: boolean;
	/** sidebar_editor.js:33 — a copy of `workspace_sidebar_items` taken when editing starts; absent until then. */
	new_sidebar_items?: FrappeWorkspaceSidebarItem[];
	/** sidebar_editor.js:19-25. */
	toggle(): void;
	/** sidebar_editor.js:27-43 — sets `data-mode="edit"` on the sidebar wrapper (:32). */
	start(): void;
	/** sidebar_editor.js:44-50 — removes `data-mode` (:48). */
	stop(): void;
}

/**
 * `frappe.ui.SidebarHeader` — `sidebar_header.js:1`. The workspace icon +
 * title + app subtitle block at the top of the sidebar, and the settings /
 * help / logout dropdown behind it. Re-created on every `setup()`
 * (sidebar.js:290).
 */
export declare class FrappeSidebarHeader {
	/** sidebar_header.js:2-105. Renders immediately (`make()` at :101). */
	constructor(sidebar: FrappeSidebar);
	/** sidebar_header.js:3. */
	sidebar: FrappeSidebar;
	/** sidebar_header.js:4 — `$(".body-sidebar")`. */
	sidebar_wrapper: JQuery<HTMLElement>;
	/** sidebar_header.js:5. */
	drop_down_expanded: boolean;
	/** sidebar_header.js:6 — a copy of `sidebar.sidebar_title` at construction. */
	title: string | undefined;
	/** sidebar_header.js:294 — `$(".sidebar-header")`, assigned by `make()`. */
	wrapper: JQuery<HTMLElement>;
	/** sidebar_header.js:295. */
	dropdown_menu: JQuery<HTMLElement>;
	/** sidebar_header.js:283-298. Removes any previous `.sidebar-header` and prepends a fresh one. */
	make(): void;
	/** sidebar_header.js:406-417 — collapses/expands the header padding with the sidebar. */
	toggle_width(expand: boolean): void;
}

/**
 * `frappe.ui.Sidebar` — `sidebar.js:3`. The single instance is
 * `frappe.app.sidebar` (`frappe/public/js/frappe/desk.js:90`).
 *
 * `$sidebar` is assigned twice: `make_dom()` sets it to `.sidebar-items`
 * (sidebar.js:372) and the constructor then overwrites it with
 * `.body-sidebar` (:20), which is the value every later read sees.
 */
export declare class FrappeSidebar {
	/**
	 * sidebar.js:4-26. The argument is ignored (desk.js:90 passes `{}`).
	 * **Returns early when `!frappe.boot.setup_complete`** (:5-8), leaving
	 * every field below unassigned.
	 */
	constructor(opts?: unknown);

	// -- constructor state (absent after the setup_complete early return) -----

	/** sidebar.js:365-371 — the rendered `sidebar.html` root, `.body-sidebar-container`, prepended to `<body>`. */
	wrapper?: JQuery<HTMLElement>;
	/** sidebar.js:20 — `.body-sidebar` (see the class note on the double assignment). */
	$sidebar?: JQuery<HTMLElement>;
	/** sidebar.js:18 — `.sidebar-items`, emptied by `empty()` (:463-467) on every render. */
	$items_container?: JQuery<HTMLElement>;
	/** sidebar.js:19 — `.standard-items-sections`, host of the Search / Notification buttons (:503-543). */
	$standard_items_sections?: JQuery<HTMLElement>;
	/** sidebar.js:11. */
	editor?: FrappeSidebarEditor;
	/** sidebar.js:12 — a **copy** of `editor.edit_mode` taken at construction; `editor.edit_mode` is the live value. */
	edit_mode?: boolean;
	/** sidebar.js:13, :454-461, :629, :635. Persisted as `localStorage["sidebar-expanded"]` (:610). */
	sidebar_expanded?: boolean;
	/** sidebar.js:14, :33 — `frappe.boot.workspace_sidebar_item`. */
	all_sidebar_items?: Record<string, FrappeWorkspaceSidebar>;
	/** sidebar.js:17, :276 — the current sidebar's top-level rows after `find_nested_items()`. */
	workspace_sidebar_items?: FrappeWorkspaceSidebarItem[];
	/**
	 * sidebar.js:21, :566. Every `sidebar_item` object ever created — the
	 * array is only initialised in the constructor and grows across workspace
	 * switches, and it also holds the standard Search / Notification buttons.
	 * Not a tree of the current sidebar; typed opaque for that reason.
	 */
	items?: unknown[];
	/** sidebar.js:24, :542 — `add_standard_items()` runs once per instance. */
	standard_items_setup?: boolean;
	/** sidebar.js:25, :711 — candidate sidebar titles from the last `resolve_sidebar()`. */
	preferred_sidebars?: string[];

	// -- per-workspace state (assigned by setup() / prepare()) ----------------

	/** sidebar.js:284 — the Workspace Sidebar title, e.g. `"Projects"`; `"My Workspaces"` for private routes (:319-323). */
	sidebar_title?: string;
	/** sidebar.js:286 — `sidebar_title.toLowerCase()`, the `workspace_sidebar_item` key. */
	workspace_title?: string;
	/** sidebar.js:31 — `frappe.boot.workspace_sidebar_item[workspace_title]`; `undefined` for an unknown title. */
	sidebar_data?: FrappeWorkspaceSidebar | undefined;
	/**
	 * sidebar.js:52, :62, :64, :71, :75 — the owning app's title, or a
	 * desktop-icon folder label, or `frappe.session.user` for "My Workspaces".
	 * Rendered as `.header-subtitle` (sidebar_header.html:13-15).
	 */
	header_subtitle?: string | undefined;
	/** sidebar.js:54 — set only alongside `frappe.current_app` (:53). */
	app_logo_url?: FrappeBootAppEntry["app_logo_url"];
	/** sidebar.js:438 — `$(anchor).parent()` of the anchor that matched the route in `is_route_in_sidebar()`. */
	active_item?: JQuery<HTMLElement>;
	/** sidebar.js:290. */
	sidebar_header?: FrappeSidebarHeader;
	/** sidebar.js:562 — only when `frappe.boot.desk_settings.notifications` and the user is not Guest (:561). */
	notifications?: FrappeNotifications;

	// -- lifecycle -------------------------------------------------------------

	/**
	 * sidebar.js:278-304. Switches the sidebar to `workspace_title`: fires
	 * `sidebar_setup` (:283, **before** any state changes), assigns the title,
	 * `prepare()`s, re-creates the header, then {@link make_sidebar} (:291).
	 */
	setup(workspace_title: string): void;
	/** sidebar.js:28-42 — standard items, `sidebar_data`, `choose_app_name()`, `find_nested_items()`. Swallows errors (:39-41). */
	prepare(): void;
	/** sidebar.js:43-77 — sets `header_subtitle`, `frappe.current_app`, `app_logo_url` (see the class-level note on staleness). */
	choose_app_name(): void;
	/**
	 * sidebar.js:468-484. Empties `.sidebar-items` and re-renders the current
	 * (or, in edit mode, the editor's) rows, then marks the active item and
	 * applies the expanded/collapsed state. The last step of `setup()` and the
	 * editor's re-render entry point — the one place the sidebar DOM is rebuilt.
	 */
	make_sidebar(): void;
	/** sidebar.js:485-502. */
	create_sidebar(items: FrappeWorkspaceSidebarItem[] | undefined): void;
	/** sidebar.js:463-467. */
	empty(): void;
	/** sidebar.js:347-355 — hides the wrapper on a `hide_sidebar` page, else shows it and re-resolves the route. */
	refresh(): void;
	/** sidebar.js:356-362. */
	toggle(hide: boolean): void;

	// -- width ------------------------------------------------------------------

	/** sidebar.js:582-588 — `open()` / `close()` by current state. Also bound to `Ctrl+/` (:336-340). */
	toggle_width(): void;
	/**
	 * sidebar.js:590-626. Applies `sidebar_expanded` to the DOM, persists it,
	 * and fires `$(document).trigger("sidebar-expand", { sidebar_expand })` (:623-625).
	 */
	expand_sidebar(): void;
	/** sidebar.js:634-638. */
	open(): void;
	/** sidebar.js:628-633. */
	close(): void;

	// -- route resolution -------------------------------------------------------

	/** sidebar.js:387-392 — adds `.active-sidebar` to the matching item and expands its section. */
	set_active_workspace_item(): void;
	/**
	 * sidebar.js:421-442. Marks the `.item-anchor` whose `href` (sans query /
	 * hash, trailing slash stripped) equals `location.pathname` or is a
	 * `"/"`-terminated prefix of it (:424-433). Selects `$(".item-anchor")`
	 * **globally**, not within the wrapper.
	 */
	is_route_in_sidebar(): boolean;
	/**
	 * sidebar.js:665-689. Picks the sidebar for the current route and calls
	 * {@link setup} only when it differs from `sidebar_title` (:681-683).
	 * Registered as the router's `"change"` handler at :327-334.
	 */
	set_workspace_sidebar(router?: FrappeRouter): void;
	/** sidebar.js:758-765. */
	show_sidebar_for_module(module: string): void;
	/** sidebar.js:709-745 — a sidebar title, or `null` when nothing links to `entity`. */
	resolve_sidebar(entity: string, module?: string): string | null;
	/** sidebar.js:770-781 — titles of every sidebar with an item whose `link_to` is `link_to`. */
	get_workspace_sidebars(link_to: string): string[];
}

/**
 * `frappe.ui.Sidebar` — the desk's left **module sidebar** — plus the
 * `SidebarHeader`, the `Dock` rail, the `SidebarPanel` registry, the
 * `frappe.ui.sidebar_item` route resolver and the `module_sidebars` boot
 * payload they render.
 *
 * Source of truth: frappe v16.55.2 (`git tag v16.55.2`, branch `version-16`),
 * `frappe/public/js/frappe/ui/sidebar/**`, `frappe/boot.py`,
 * `frappe/desk/doctype/sidebar/sidebar.py` and `frappe/desk/doctype/dock/dock.py`.
 * Every declaration and every citation below was re-read against the 16.50.0
 * release, and again against 16.54.0 wherever frappe changed the cited lines;
 * the version named above is moved by
 * `scripts/remap-citations.mjs --stamp`, not by hand. Citations are spelled with
 * their full path so `scripts/audit-drift.mjs` can check them.
 *
 * ## Why this slice exists
 *
 * v16 removed the desk's top navbar: `ui/toolbar/navbar.html` is now only the
 * announcement strip, and the brand, app switcher, user/help menus, search and
 * notifications all live in this sidebar and the dock beside it. A theme that
 * wants a real header has to read the sidebar's state — which shell is on
 * screen, which app owns it, what its items are — rather than the boot payload,
 * because the sidebar is the thing that resolves a route to a shell
 * (`set_workspace_sidebar`, frappe/public/js/frappe/ui/sidebar/sidebar.js:841-852).
 * That is the consumer these declarations were verified for.
 *
 * ## The model changed between 16.33 and 16.50
 *
 * 16.33 named the sidebar on screen by its **workspace title**
 * (`sidebar_title` / `workspace_title`), found the owning app by scanning
 * `app_data[].workspaces`, and kept the answer in `frappe.current_app`. All of
 * that is gone. 16.50 has one identity, the **shell**: the key of
 * `frappe.boot.module_sidebars`, which is a `Sidebar` document's name or, for a
 * computed sidebar, its module name (frappe/boot.py:671-709). The shell on
 * screen is {@link FrappeSidebar.current_module}; the app that owns it is
 * *derived* from it by {@link FrappeSidebar.get_sidebar_app}, never stored. The
 * old `SidebarEditor` (a class in the deleted `sidebar_editor.js`) is replaced
 * by two lazily loaded dialogs, `frappe.ui.SidebarManager` and
 * `frappe.ui.DockManager`; see {@link FrappeArrangementEditor}.
 *
 * ## Three runtime facts that shape the declarations
 *
 * 1. **The constructor can return early.** The constructor bails when
 *    `!frappe.boot.setup_complete`
 *    (frappe/public/js/frappe/ui/sidebar/sidebar.js:71-73), so on a
 *    setup-wizard session `frappe.app.sidebar` is an instance with **no**
 *    constructor-assigned fields — `wrapper`, `items`, `sidebar_expanded`, … are
 *    all absent, while the prototype methods still exist. Every field the
 *    constructor assigns is therefore optional here. Narrow once
 *    (`const wrapper = sidebar.wrapper; if (!wrapper) return;`) rather than
 *    `!`-asserting.
 *
 * 2. **The `sidebar_setup` event fires BEFORE the state changes.**
 *    `setup()` triggers `$(document).trigger("sidebar_setup", { sidebar })`
 *    first and only afterwards assigns `current_module`, loads the data,
 *    refreshes the header and renders
 *    (frappe/public/js/frappe/ui/sidebar/sidebar.js:241-251). A handler bound
 *    to that event sees the *previous* shell. Code that needs the new state
 *    hooks {@link FrappeSidebar.make_sidebar} instead: it is the render step of
 *    `setup()` (frappe/public/js/frappe/ui/sidebar/sidebar.js:248), and a saved
 *    Edit Sidebar dialog re-enters it through `setup(current_module)`
 *    (frappe/public/js/frappe/ui/sidebar/sidebar_manager.js:849).
 *
 * 3. **The header and the dock are not rebuilt per shell.** One
 *    {@link FrappeSidebarHeader} lives for the life of the desk (its dropdown
 *    binds to the element it was given, so a header rebuilt on every
 *    navigation would leave its menu on a detached node —
 *    frappe/public/js/frappe/ui/sidebar/sidebar.js:282-291), and one
 *    {@link FrappeDock} is created lazily by `refresh_dock()`
 *    (frappe/public/js/frappe/ui/sidebar/sidebar.js:332-337). `setup()` is
 *    skipped when the shell did not change, so the router's `"change"` handler
 *    refreshes both on **every** navigation
 *    (frappe/public/js/frappe/ui/sidebar/sidebar.js:268-273). Code that mirrors
 *    the header must follow that handler, not `setup()`.
 */

import type { FrappeBootAppEntry, FrappeBootWorkspacePage } from "../core";
import type { FrappeCheck } from "../model";
import type { Dialog } from "./form";
import type { FrappeNotifications } from "./notifications";

// ---------------------------------------------------------------------------
// Boot payload: `frappe.boot.module_sidebars` and the dock
// ---------------------------------------------------------------------------

/**
 * `Sidebar Item.type` —
 * `frappe/desk/doctype/sidebar_item/sidebar_item.json` (Select options
 * `Link\nSection Break\nSpacer`, default `"Link"`; also
 * frappe/desk/doctype/sidebar_item/sidebar_item.py:39). The live payload of a
 * stock site carries only `Link` and `Section Break`, but the doctype allows
 * `Spacer`, and `filter_sidebar_items` explicitly lets it through unpermissioned
 * (frappe/desk/doctype/sidebar/sidebar.py:2115-2120), so it is part of the
 * union. Rendering picks `frappe.ui.sidebar_item.Type<TitleCased>` from it
 * (frappe/public/js/frappe/ui/sidebar/sidebar.js:695-697); the client adds a
 * fourth, `Button`, for its own standard rows, which never reach the payload.
 *
 * The 16.33 `"Sidebar Item Group"` type is gone: it is a separate doctype now
 * (`frappe/desk/doctype/sidebar_item_group`), not a row type.
 */
export type FrappeSidebarItemType = "Link" | "Section Break" | "Spacer";

/**
 * `Sidebar Item.link_type` — same JSON (Select options, default `"DocType"`).
 * Drives `frappe.ui.sidebar_item.get_route`
 * (frappe/public/js/frappe/ui/sidebar/sidebar_item.js:63-146).
 */
export type FrappeSidebarItemLinkType = "DocType" | "Page" | "Report" | "Workspace" | "Dashboard" | "URL";

/**
 * The kinds of thing a desk route can name — the keys of
 * `frappe.boot.canonical_shell` (`ROUTABLE_ENTITY_KINDS`,
 * frappe/desk/doctype/sidebar/sidebar.py:2307) and the answers of
 * {@link FrappeSidebar.link_type_from_route}
 * (frappe/public/js/frappe/ui/sidebar/sidebar.js:1157-1162). `Workspace` and
 * `URL` are deliberately absent: a workspace is resolved through
 * `module_sidebars[shell].workspaces`, and a URL names no shell.
 */
export type FrappeSidebarEntityKind = "DocType" | "Report" | "Page" | "Dashboard";

/**
 * One row of `frappe.boot.module_sidebars[<shell>].items`.
 *
 * Server shape: `filter_sidebar_items`
 * (frappe/desk/doctype/sidebar/sidebar.py:2087-2145), which copies the Sidebar
 * Item child row field by field — so a value is whatever the doctype stored:
 * `null` for an unset Data/Select/Dynamic Link field, and for a Check that a
 * *computed* sidebar row never set (the live payload carries `null` Checks
 * alongside `0 | 1`). `label` is passed through `_()`
 * (frappe/desk/doctype/sidebar/sidebar.py:2124) and so arrives **translated**;
 * nothing else is.
 *
 * `report` is added by `attach_report`
 * (frappe/desk/doctype/sidebar/sidebar.py:2156-2187) only for an enabled,
 * existing Report link. `nested_items` and `parent` are **client-side**
 * additions made by `nest_section_items()`
 * (frappe/public/js/frappe/ui/sidebar/sidebar.js:221-240): a `Section Break`
 * row collects the `child` rows that follow it into `nested_items`, and each of
 * those gets `parent`. The nesting is exactly one level deep, and **every** row
 * gets `nested_items = []`
 * (frappe/public/js/frappe/ui/sidebar/sidebar.js:227), not only Section Breaks.
 *
 * A row hidden by a customization never reaches the payload
 * (frappe/desk/doctype/sidebar/sidebar.py:1643-1655), so there is no `hidden`
 * member here.
 */
export interface FrappeSidebarItem {
	/**
	 * frappe/desk/doctype/sidebar/sidebar.py:2123 — the row's identity
	 * (`item_key`, frappe/desk/doctype/sidebar/sidebar.py:989-1014): for a row
	 * that links somewhere, `type|link_type|link_to|url|filters` joined by `|`
	 * (`LINKED_IDENTITY_FIELDS`, frappe/desk/doctype/sidebar/sidebar.py:89), with
	 * `|<route>` appended only when the row has a `route` (Page rows). E.g.
	 * `"Link|Workspace|Accounting||"`; for a row that links nowhere, a
	 * 10-character hash of its type and label. A customization names a row by
	 * it.
	 */
	key: string;
	/**
	 * frappe/desk/doctype/sidebar/sidebar.py:2136 — a relative path inside a Page
	 * (Page rows only; validated by `validate_item_route`, sidebar.py:963-987); `null`
	 * otherwise.
	 */
	route?: string | null;
	/** frappe/desk/doctype/sidebar/sidebar.py:2124 — `_(item.label)`, translated. */
	label: string;
	/** frappe/desk/doctype/sidebar/sidebar.py:2125. Dynamic Link on `link_type`; `null` for Section Breaks / Spacers. */
	link_to: string | null;
	/** frappe/desk/doctype/sidebar/sidebar.py:2126. A Section Break arrives as `"DocType"` (the column default) or `null`, depending on how its sidebar was shipped. */
	link_type: FrappeSidebarItemLinkType | null;
	/** frappe/desk/doctype/sidebar/sidebar.py:2127. */
	type: FrappeSidebarItemType;
	/** frappe/desk/doctype/sidebar/sidebar.py:2128 — an Icon field (a lucide / frappe sprite name or an emoji). */
	icon: string | null;
	/** frappe/desk/doctype/sidebar/sidebar.py:2129 — nested under the preceding Section Break when `1`. */
	child: FrappeCheck | null;
	/** frappe/desk/doctype/sidebar/sidebar.py:2130 — Section Break only; default `1`. */
	collapsible: FrappeCheck | null;
	/** frappe/desk/doctype/sidebar/sidebar.py:2131 — Section Break only: rendered as a collapsible group rather than a labelled divider. */
	indent: FrappeCheck | null;
	/** frappe/desk/doctype/sidebar/sidebar.py:2132 — Section Break only. */
	keep_closed: FrappeCheck | null;
	/** frappe/desk/doctype/sidebar/sidebar.py:2133 — `link_type === "URL"` only. */
	url: string | null;
	/** frappe/desk/doctype/sidebar/sidebar.py:2134 — swaps the icon for a chevron (frappe/public/js/frappe/ui/sidebar/sidebar_item.js:306-312). */
	show_arrow: FrappeCheck | null;
	/** frappe/desk/doctype/sidebar/sidebar.py:2135 — a JSON string of filters, parsed by `filters_as_options` (frappe/public/js/frappe/ui/sidebar/sidebar_item.js:40-55). */
	filters: string | null;
	/** frappe/desk/doctype/sidebar/sidebar.py:2137 — a JSON string, parsed at frappe/public/js/frappe/ui/sidebar/sidebar_item.js:106,122. */
	route_options: string | null;
	/** frappe/desk/doctype/sidebar/sidebar.py:2138 — the `navigate_to_tab` column, renamed. */
	tab: string | null;
	/** frappe/desk/doctype/sidebar/sidebar.py:2139. `URL` rows only; `1` means the link opens in a new tab. */
	open_in_new_tab: FrappeCheck | null;
	/**
	 * frappe/desk/doctype/sidebar/sidebar.py:2140 — this row claims its `link_to`
	 * for the shell: what `frappe.boot.entity_module` is built from
	 * (frappe/boot.py:743-747).
	 */
	is_default_module: FrappeCheck | null;
	/**
	 * frappe/desk/doctype/sidebar/sidebar.py:2231 — set to `1` on rows no
	 * document holds (a user's private pages appended by
	 * `append_derived_items`): shown as a link only, never arrangeable. Absent
	 * otherwise.
	 */
	derived?: FrappeCheck;
	/** frappe/desk/doctype/sidebar/sidebar.py:2182-2185 — only for an existing, enabled Report link. */
	report?: { report_type: string; ref_doctype: string | null };
	/** Client-side, frappe/public/js/frappe/ui/sidebar/sidebar.js:227. `[]` on every row until nested. */
	nested_items?: FrappeSidebarItem[];
	/** Client-side, frappe/public/js/frappe/ui/sidebar/sidebar.js:233. Set on nested `child` rows only. */
	parent?: FrappeSidebarItem;
}

/**
 * One value of `frappe.boot.module_sidebars`, keyed by **shell** in exact case
 * (frappe/boot.py:671-709, `get_module_sidebars`). The entry carries its own key
 * (`name`). Server shape: `ResolvedSidebar.as_boot_entry`
 * (frappe/desk/doctype/sidebar/sidebar.py:1582-1603).
 *
 * This replaces the 16.33 `frappe.boot.workspace_sidebar_item` (keyed by the
 * lowercased sidebar title) and, with it, `module_wise_workspaces` and
 * `default_workspace_map`. The payload is permission-filtered per user, and a
 * shell with nothing navigable left in it is dropped
 * (frappe/desk/doctype/sidebar/sidebar.py:1681-1682), so an app's shell can be
 * missing.
 *
 * The runtime also *replaces* this object: saving a workspace swaps in the
 * server's fresh copy (frappe/public/js/frappe/views/workspace/workspace.js:958),
 * so do not hold a reference across a workspace edit.
 */
export interface FrappeModuleSidebar {
	/** frappe/desk/doctype/sidebar/sidebar.py:1589 — the shell identity; the same string as the payload key. */
	name: string;
	/**
	 * frappe/desk/doctype/sidebar/sidebar.py:1590 — the Module Def the sidebar
	 * belongs to. Equal to `name` unless the sidebar was renamed. Customizations
	 * are anchored to this, not to `name`
	 * (frappe/desk/doctype/sidebar/sidebar.py:1638-1642).
	 */
	module: string;
	/**
	 * frappe/desk/doctype/sidebar/sidebar.py:1591 — `_(label)`
	 * (frappe/desk/doctype/sidebar/sidebar.py:1697), **translated**; the Sidebar's
	 * title, which an app or a customization may override.
	 */
	label: string;
	/**
	 * frappe/desk/doctype/sidebar/sidebar.py:1592 — the owning app's `app_name`,
	 * from the document or, failing that, the module's placement
	 * (frappe/desk/doctype/sidebar/sidebar.py:1704). `null` for a module no app
	 * lists. A companion app's value is *not* resolved to its host here; use
	 * {@link FrappeSidebar.rail_host_for} for that.
	 */
	app: string | null;
	/** frappe/desk/doctype/sidebar/sidebar.py:1593. */
	header_icon: string | null;
	/** frappe/desk/doctype/sidebar/sidebar.py:1594,1710 — computed per user: the onboarding this module offers them, or `null`. */
	module_onboarding: string | null;
	/** frappe/desk/doctype/sidebar/sidebar.py:1595 — `1` when any customization layer applied. */
	customized: FrappeCheck;
	/**
	 * frappe/desk/doctype/sidebar/sidebar.py:1596-1600 — `1` when the items were
	 * computed from the module's contents rather than shipped by an app. A
	 * doctype missing from a shipped sidebar was left out on purpose; one missing
	 * from a computed sidebar may only have fallen past the display limit.
	 */
	computed: FrappeCheck;
	/**
	 * frappe/desk/doctype/sidebar/sidebar.py:1601 — the workspaces stored under
	 * this shell. `module_for_workspace`
	 * (frappe/public/js/frappe/ui/sidebar/sidebar.js:1171-1177) reads it, and no
	 * workspace-to-shell map is shipped alongside.
	 */
	workspaces: string[];
	/** frappe/desk/doctype/sidebar/sidebar.py:1602. */
	items: FrappeSidebarItem[];
}

/** `Dock Item.link_type` — frappe/desk/doctype/dock_item/dock_item.json (Select options `\nSidebar\nWorkspace\nURL`; a row with none is dropped, frappe/desk/doctype/dock/dock.py:699-708). */
export type FrappeDockLinkType = "Sidebar" | "Workspace" | "URL";

/**
 * One row of `frappe.boot.app_data[].dock` — what an app's rail **offers**
 * (`get_app_entry_set`, frappe/desk/doctype/dock/dock.py:794-801), before any
 * arrangement. Shaped by `rail_entry`
 * (frappe/desk/doctype/dock/dock.py:977-983) from `DESTINATION_FIELDS` and
 * `REFERENCE_FIELDS` (frappe/desk/doctype/dock/dock.py:51,59), with a set
 * `title` translated (`_()`) on the server. A `Sidebar` row's
 * `link_to` is a key of `frappe.boot.module_sidebars`; a `Workspace` row's is a
 * workspace name; a `URL` row has a `url` and no `link_to`.
 */
export interface FrappeDockRow {
	link_type: FrappeDockLinkType;
	link_to: string | null;
	url: string | null;
	/** An icon name; the row's own label and icon win over what it opens (frappe/public/js/frappe/ui/sidebar/sidebar.js:1027-1029). */
	icon: string | null;
	title: string | null;
}

/**
 * One row of `frappe.boot.dock[<app_name>]` — the app's rail **as this user
 * arranged it**: the app's own dock, then the site's layer, then the user's
 * (`resolve_app_dock`, frappe/desk/doctype/dock/dock.py:901-935). Order is the
 * arrangement. Unlike `app_data[].dock`, a hidden row stays in the list with
 * `hidden: 1` (the manager's Hidden pane needs it) and the client drops it
 * (frappe/public/js/frappe/ui/sidebar/sidebar.js:1041). An entry the app ships
 * that no layer names is **absent** here, and the client keeps it in the app's
 * own order behind these.
 */
export interface FrappeArrangedDockRow extends FrappeDockRow {
	/** frappe/desk/doctype/dock/dock.py:932 — `int(...)`, so a real `0 | 1`. */
	hidden: FrappeCheck;
}

/**
 * A dock row resolved for drawing — what
 * {@link FrappeSidebar.collect_dock_entries} returns
 * (frappe/public/js/frappe/ui/sidebar/sidebar.js:1002-1032, `dock_entry`). Built
 * client-side; never in the boot payload.
 */
export interface FrappeDockEntry {
	/** The row's `link_type`; a row without one is dropped (frappe/public/js/frappe/ui/sidebar/sidebar.js:1020). */
	link_type: FrappeDockLinkType;
	link_to: string | null;
	url: string | null;
	/**
	 * The shell the entry opens: the row's `link_to` for a `Sidebar` row, the
	 * shell storing the workspace (else the workspace's own `module`) for a
	 * `Workspace` row, `null` for a `URL` row
	 * (frappe/public/js/frappe/ui/sidebar/sidebar.js:1012-1017).
	 */
	module: string | null;
	/** `row.title || page.title || sidebar.label || row.link_to || row.url` (frappe/public/js/frappe/ui/sidebar/sidebar.js:1028). */
	label: string | null;
	/** `row.icon || page.icon || frappe.get_module_icon(module)` (frappe/public/js/frappe/ui/sidebar/sidebar.js:1029). */
	icon: string | null;
	/** The `frappe.boot.workspaces.pages` row of a `Workspace` entry, else `null`. */
	page: FrappeBootWorkspacePage | null;
}

// ---------------------------------------------------------------------------
// Menu rows built by the header
// ---------------------------------------------------------------------------

/**
 * One row of a `frappe.ui.Dropdown` menu as `SidebarHeader` builds them. The
 * row contract is `MenuItem` in
 * frappe/public/js/frappe/ui/components/menu.js:35-52 (that file calls itself
 * "not a public API"; `frappe.ui.Dropdown` is not declared by this package, so
 * the rows are typed here from what the header produces). `name` is the header's
 * own addition. `icon`, `href` and `image` are nullable because the
 * Navbar-Settings and help rows copy site-authored Data fields straight across
 * (frappe/public/js/frappe/ui/sidebar/sidebar_header.js:136-148,298-307).
 */
export interface FrappeSidebarMenuItem {
	name?: string | undefined;
	label: string;
	icon?: string | null | undefined;
	/** An image URL for a mark no icon name can stand in for — an app's logo (frappe/public/js/frappe/ui/sidebar/sidebar_header.js:206-208). */
	image?: string | undefined;
	href?: string | null | undefined;
	/** `"_blank"` for an off-site `href` (frappe/public/js/frappe/ui/sidebar/sidebar_header.js:96-99). */
	target?: string | undefined;
	/** Called with the click event; the header's own rows ignore it. */
	onclick?: (() => unknown) | undefined;
	/** Re-checked on every open (frappe/public/js/frappe/ui/components/menu.js:94). */
	condition?: (() => boolean) | undefined;
	/** A nested panel: rows, or sections of rows. */
	submenu?: Array<FrappeSidebarMenuItem | FrappeSidebarMenuGroup> | undefined;
}

/** A section of rows — `MenuGroup` in frappe/public/js/frappe/ui/components/menu.js:54-59. The panel draws a rule between neighbouring groups and drops a group whose rows are all hidden. */
export interface FrappeSidebarMenuGroup {
	group: string;
	options: FrappeSidebarMenuItem[];
}

// ---------------------------------------------------------------------------
// The header
// ---------------------------------------------------------------------------

/**
 * `frappe.ui.SidebarHeader` — frappe/public/js/frappe/ui/sidebar/sidebar_header.js:1.
 * The module icon + title block at the top of the sidebar and the menu behind
 * it. **One instance for the life of the desk**
 * (`Sidebar.refresh_header`, frappe/public/js/frappe/ui/sidebar/sidebar.js:283-291);
 * a shell change only rewrites its text (`refresh()`), so a menu attached to
 * `wrapper` stays valid across shells. In 16.33 it was re-created on every
 * `setup()`.
 */
export declare class FrappeSidebarHeader {
	/** frappe/public/js/frappe/ui/sidebar/sidebar_header.js:2-7. Renders immediately (`make()`) and attaches the menu (`setup_menu()`). */
	constructor(sidebar: FrappeSidebar);
	/** frappe/public/js/frappe/ui/sidebar/sidebar_header.js:3. */
	sidebar: FrappeSidebar;
	/** frappe/public/js/frappe/ui/sidebar/sidebar_header.js:4 — `$(".body-sidebar")`, looked up globally at construction. */
	sidebar_wrapper: JQuery<HTMLElement>;
	/** frappe/public/js/frappe/ui/sidebar/sidebar_header.js:15,336 — {@link get_display_title}. */
	title: string | undefined;
	/** frappe/public/js/frappe/ui/sidebar/sidebar_header.js:369-371 — an HTML string (a sprite `<svg>` or a letter tile). */
	header_icon: string;
	/** frappe/public/js/frappe/ui/sidebar/sidebar_header.js:344 — `$(".sidebar-header")`, assigned by `make()`. */
	wrapper: JQuery<HTMLElement>;
	/** frappe/public/js/frappe/ui/sidebar/sidebar_header.js:345. */
	$header_title: JQuery<HTMLElement>;
	/** frappe/public/js/frappe/ui/sidebar/sidebar_header.js:346. */
	$header_logo: JQuery<HTMLElement>;
	/** frappe/public/js/frappe/ui/sidebar/sidebar_header.js:347. */
	$drop_icon: JQuery<HTMLElement>;
	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar_header.js:253 — the
	 * `frappe.ui.Dropdown` {@link attach_menu} returned. Opaque here: that class
	 * is not declared by this package.
	 */
	menu: unknown;

	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar_header.js:14-24. The shell on
	 * screen changed: re-reads the title and icon and rewrites the existing
	 * nodes. Called on every navigation by the sidebar's router handler.
	 */
	refresh(): void;
	/** frappe/public/js/frappe/ui/sidebar/sidebar_header.js:334-349. Removes any previous `.sidebar-header` and prepends a fresh one. */
	make(): void;
	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar_header.js:358-364. The shell's
	 * `label`, else `current_module`, else the owning app's title. 16.33 showed
	 * the app title and fell back to the module.
	 */
	get_display_title(): string | undefined;
	/** frappe/public/js/frappe/ui/sidebar/sidebar_header.js:366-372 — assigns {@link header_icon}. */
	set_header_icon(): void;
	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar_header.js:387-391. On a docked
	 * app the module's icon; on a dock-less app the app's own logo, since nothing
	 * else on screen names the app. HTML.
	 */
	get_header_logo(): string;

	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar_header.js:50-87. The rows of the
	 * header menu: the switcher, "Edit Sidebar", then Navbar Settings and Help.
	 * Re-run on every open.
	 */
	menu_items(): FrappeSidebarMenuGroup[];
	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar_header.js:157-230. The module /
	 * app switcher. Empty of module rows where there is a rail to switch with:
	 * on a docked app with a hover-capable pointer it is just "All apps"
	 * (frappe/public/js/frappe/ui/sidebar/sidebar_header.js:167-169). Otherwise a
	 * "Modules" submenu (only when the app has more than one navigable module,
	 * frappe/public/js/frappe/ui/sidebar/sidebar_header.js:178) and an "Apps"
	 * submenu of `frappe.utils.get_apps_screen_apps()`: every `on_apps_screen` app by
	 * `sequence_id`, with Studio Apps (`frappe.boot.studio_apps`, by title) spliced in ahead of
	 * Framework (`frappe/public/js/frappe/utils/utils.js:1421-1436`). App rows also carry a
	 * `letter` mark.
	 */
	switcher_items(): FrappeSidebarMenuItem[];
	/** frappe/public/js/frappe/ui/sidebar/sidebar_header.js:233-240 — the apps screen, `href: "/desk"`. */
	all_apps_item(): FrappeSidebarMenuItem;
	/** frappe/public/js/frappe/ui/sidebar/sidebar_header.js:107-121 — Navbar Settings rows plus a nested "Help" row when it has any content. */
	system_items(): FrappeSidebarMenuItem[];
	/** frappe/public/js/frappe/ui/sidebar/sidebar_header.js:132-151 — `Navbar Settings.settings_dropdown`, minus hidden rows. */
	navbar_items(): FrappeSidebarMenuItem[];
	/** frappe/public/js/frappe/ui/sidebar/sidebar_header.js:293-313 — the page's help links, then `Navbar Settings.help_dropdown`. */
	get_help_siblings(): FrappeSidebarMenuGroup[];
	/** frappe/public/js/frappe/ui/sidebar/sidebar_header.js:315-332 — registered `frappe.help.help_links` for the current route, as rows. */
	get_custom_help_links(): FrappeSidebarMenuItem[];
	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar_header.js:96-99. An in-site
	 * path stays a plain `href`; anything on another origin (a scheme or `//`
	 * prefix) also gets `target: "_blank"`.
	 */
	link_fields(url: string): { href: string; target?: "_blank" };

	/** frappe/public/js/frappe/ui/sidebar/sidebar_header.js:251-254 — attaches the menu to {@link wrapper} once. */
	setup_menu(): void;
	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar_header.js:261-270. Hangs this
	 * header's menu on an element and returns the `frappe.ui.Dropdown` it
	 * created (opaque, see {@link menu}). Each element gets its own dropdown,
	 * created once; its rows come from {@link menu_items} on every open. The dock
	 * calls it for the copy on its own header.
	 */
	attach_menu(wrapper: JQuery<HTMLElement> | HTMLElement | string): unknown;
	/** frappe/public/js/frappe/ui/sidebar/sidebar_header.js:275-285 — toggles `.active-sidebar` on the header row while its menu is open. */
	toggle_active(wrapper: JQuery<HTMLElement> | HTMLElement | string, active: boolean): void;
	/** frappe/public/js/frappe/ui/sidebar/sidebar_header.js:393-402. */
	setup_hover(): void;
	/** frappe/public/js/frappe/ui/sidebar/sidebar_header.js:408-415 — binds or drops the header's hover, following whether the panel is expanded. */
	toggle_width(expand: boolean): void;
}

// ---------------------------------------------------------------------------
// The dock (the app rail)
// ---------------------------------------------------------------------------

/**
 * `frappe.ui.Dock` — frappe/public/js/frappe/ui/sidebar/dock.js:4. The app
 * switcher rail: the entries of the app that owns the sidebar on screen. Pinned
 * (the default) it is a column; floating it slides in over the sidebar when the
 * pointer hits the window's left edge (the right one in RTL). Created lazily by
 * {@link FrappeSidebar.refresh_dock}; `frappe.app.sidebar.dock` is absent until
 * the first navigation settles.
 */
export declare class FrappeDock {
	/** frappe/public/js/frappe/ui/sidebar/dock.js:6 — pixels from the dock's edge of the window (left; right in RTL) at which a floating dock reveals. */
	static REVEAL_EDGE: number;
	/** frappe/public/js/frappe/ui/sidebar/dock.js:7 — pixels past which a floating dock hides again. */
	static HIDE_BAND: number;
	/** frappe/public/js/frappe/ui/sidebar/dock.js:162-164 — `matchMedia("(any-hover: hover)")`; a touch screen cannot summon a floating dock. */
	static pointer_can_reveal(): boolean;

	/** frappe/public/js/frappe/ui/sidebar/dock.js:9-20. Builds the DOM (`make()`). */
	constructor(sidebar: FrappeSidebar);
	/** frappe/public/js/frappe/ui/sidebar/dock.js:10. */
	sidebar: FrappeSidebar;
	/** frappe/public/js/frappe/ui/sidebar/dock.js:11. */
	is_open: boolean;
	/** frappe/public/js/frappe/ui/sidebar/dock.js:12,270 — whether the app has entries and the page allows a dock. */
	enabled: boolean;
	/** frappe/public/js/frappe/ui/sidebar/dock.js:14 — the user's preference (`desk_settings.dock_mode !== "Floating"`). */
	pinned: boolean;
	/** frappe/public/js/frappe/ui/sidebar/dock.js:15,76-90 — whether the preference applies on the page on screen. */
	is_pinned: boolean;
	/** frappe/public/js/frappe/ui/sidebar/dock.js:16,225 — the element to hand focus back to when the dock closes. */
	opener: Element | null;
	/** frappe/public/js/frappe/ui/sidebar/dock.js:269 — `sidebar.get_sidebar_app()`; assigned by `refresh()`. */
	app?: FrappeBootAppEntry | null | undefined;
	/** frappe/public/js/frappe/ui/sidebar/dock.js:271 — whether a page and a shell were both known at the last `refresh()`. */
	resolved?: boolean;
	/** frappe/public/js/frappe/ui/sidebar/dock.js:23-41 — `#desk-dock`. */
	$dock: JQuery<HTMLElement>;
	/** frappe/public/js/frappe/ui/sidebar/dock.js:50 — `.dock-logo .shell-header`. */
	$header: JQuery<HTMLElement>;
	/** frappe/public/js/frappe/ui/sidebar/dock.js:53 — `.dock-items`. */
	$items: JQuery<HTMLElement>;

	/**
	 * frappe/public/js/frappe/ui/sidebar/dock.js:63-66 — stores the preference and
	 * re-applies it. Called by the user-settings dialog
	 * (frappe/public/js/frappe/ui/user_settings_dialog.js:602).
	 */
	set_pinned(pinned: boolean): void;
	/** frappe/public/js/frappe/ui/sidebar/dock.js:70-74. */
	should_pin(): boolean;
	/**
	 * frappe/public/js/frappe/ui/sidebar/dock.js:76-90. Also shows the dock's own
	 * search and notifications buttons (class `dock-owns-utilities`) while it is
	 * pinned or the page does not allow the sidebar.
	 */
	apply_pin(): void;
	/** frappe/public/js/frappe/ui/sidebar/dock.js:241-245. A no-op while disabled or already open. */
	open(): void;
	/** frappe/public/js/frappe/ui/sidebar/dock.js:247-259. A no-op while pinned or already closed. */
	close(): void;
	/** frappe/public/js/frappe/ui/sidebar/dock.js:219-228 — the `shift+ctrl+/` shortcut. */
	toggle_from_keyboard(): void;
	/** frappe/public/js/frappe/ui/sidebar/dock.js:230-232. */
	holds_focus(): boolean;
	/**
	 * frappe/public/js/frappe/ui/sidebar/dock.js:268-299. Re-reads the owning
	 * app, redraws the logo and the entries, skipping the rebuild when nothing
	 * drawn changed. Called up to three times per navigation.
	 */
	refresh(): void;
	/** frappe/public/js/frappe/ui/sidebar/dock.js:347-356 — defaults to `sidebar.collect_dock_entries(this.app)`. */
	render_entries(entries?: FrappeDockEntry[]): void;
}

// ---------------------------------------------------------------------------
// Panels beside the sidebar
// ---------------------------------------------------------------------------

/** `SidebarPanelOpts` — frappe/public/js/frappe/ui/sidebar/sidebar_panel.js:9-20 (a JSDoc typedef). */
export interface FrappeSidebarPanelOpts {
	/** The key the panel is opened by: `frappe.ui.sidebar_panels.toggle(name)`. Required — the constructor throws without it (frappe/public/js/frappe/ui/sidebar/sidebar_panel.js:43-45). */
	name: string;
	/** The heading at the top of the panel. */
	title: string;
	/** Matches the button(s) that open it; clicks inside one do not count as "outside", and `aria-expanded` is kept in sync on all of them. */
	trigger_selector?: string;
	/** Extra classes on the panel element. */
	css_class?: string;
	/** Called after the panel is shown. */
	on_open?: () => void;
	/** Called after it is hidden. */
	on_close?: () => void;
}

/**
 * `frappe.ui.SidebarPanel` — frappe/public/js/frappe/ui/sidebar/sidebar_panel.js:40.
 * A full-height, non-modal drawer that slides out beside the sidebar. It owns
 * its frame and hands the caller an empty `$body`; opening and closing belong
 * to {@link FrappeSidebarPanelRegistry} so only one panel is open at a time.
 * The constructor registers the panel
 * (frappe/public/js/frappe/ui/sidebar/sidebar_panel.js:51) and mounts it in
 * `.body-sidebar-container` — when there is none it warns and leaves the
 * element detached (frappe/public/js/frappe/ui/sidebar/sidebar_panel.js:55-63).
 */
export declare class FrappeSidebarPanel {
	/** frappe/public/js/frappe/ui/sidebar/sidebar_panel.js:42-52. */
	constructor(opts: FrappeSidebarPanelOpts);
	/** frappe/public/js/frappe/ui/sidebar/sidebar_panel.js:46. */
	name: string;
	/** frappe/public/js/frappe/ui/sidebar/sidebar_panel.js:47. */
	opts: FrappeSidebarPanelOpts;
	/** frappe/public/js/frappe/ui/sidebar/sidebar_panel.js:48 — read-only to callers; flipped by the registry. */
	is_open: boolean;
	/** frappe/public/js/frappe/ui/sidebar/sidebar_panel.js:65-67 — `.sidebar-panel.sidebar-panel-<name>`. */
	$panel: JQuery<HTMLElement>;
	/** frappe/public/js/frappe/ui/sidebar/sidebar_panel.js:73 — from `frappe.ui.panel_header` (frappe/public/js/frappe/ui/components/panel_header.js:26-60). */
	$header: JQuery<HTMLElement>;
	/** frappe/public/js/frappe/ui/sidebar/sidebar_panel.js:74. */
	$title: JQuery<HTMLElement>;
	/** frappe/public/js/frappe/ui/sidebar/sidebar_panel.js:75 — the row under the title, for tabs or filters. */
	$items: JQuery<HTMLElement>;
	/** frappe/public/js/frappe/ui/sidebar/sidebar_panel.js:76 — the actions slot beside the close button. */
	$actions: JQuery<HTMLElement>;
	/** frappe/public/js/frappe/ui/sidebar/sidebar_panel.js:78 — the empty `.sidebar-panel-body` the caller fills. */
	$body: JQuery<HTMLElement>;

	/** frappe/public/js/frappe/ui/sidebar/sidebar_panel.js:84-86. */
	show(): void;
	/** frappe/public/js/frappe/ui/sidebar/sidebar_panel.js:88-90. */
	hide(): void;
	/** frappe/public/js/frappe/ui/sidebar/sidebar_panel.js:92-94. */
	toggle(): void;
	/** frappe/public/js/frappe/ui/sidebar/sidebar_panel.js:132-135 — mirrors `is_open` into `aria-expanded` on every trigger. */
	sync_trigger_state(): void;
	/** frappe/public/js/frappe/ui/sidebar/sidebar_panel.js:137-145 — whether a click landed on a trigger for this panel or inside it. */
	owns_event(e: { target: EventTarget | null }): boolean;
}

/**
 * `frappe.ui.sidebar_panels` — the registry that decides which panel is open
 * (frappe/public/js/frappe/ui/sidebar/sidebar_panel.js:159-257, a singleton
 * object). Every dismissal rule is global and lives here: one panel at a time,
 * a click outside closes it, `Escape` closes it, and a `page-change` closes it
 * (frappe/public/js/frappe/ui/sidebar/sidebar_panel.js:172). The document
 * listeners are bound only while something is open.
 */
export interface FrappeSidebarPanelRegistry {
	/** frappe/public/js/frappe/ui/sidebar/sidebar_panel.js:161 — by `name`. */
	panels: Record<string, FrappeSidebarPanel | undefined>;
	/** frappe/public/js/frappe/ui/sidebar/sidebar_panel.js:162. */
	open_panel: FrappeSidebarPanel | null;
	/** frappe/public/js/frappe/ui/sidebar/sidebar_panel.js:175-181 — replaces (and removes the element of) a panel registered under the same name. */
	register(panel: FrappeSidebarPanel): void;
	/** frappe/public/js/frappe/ui/sidebar/sidebar_panel.js:183-185. */
	get(name: string): FrappeSidebarPanel | undefined;
	/** frappe/public/js/frappe/ui/sidebar/sidebar_panel.js:187-200. Warns and returns for an unknown name; closes the open panel and the sidebar's flyout first. */
	show(name: string): void;
	/** frappe/public/js/frappe/ui/sidebar/sidebar_panel.js:220-226. A no-op for an unknown or closed panel. */
	hide(name: string): void;
	/** frappe/public/js/frappe/ui/sidebar/sidebar_panel.js:228-234 — e.g. `toggle("notifications")`. */
	toggle(name: string): void;
	/** frappe/public/js/frappe/ui/sidebar/sidebar_panel.js:236-238. */
	close_all(): void;
	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar_panel.js:211-218. A panel opens
	 * on the edge the sidebar's flyout occupies, so the flyout closes as it
	 * opens (on mobile by removing `expanded` from the mount instead).
	 */
	close_sidebar_flyout(): void;
}

// ---------------------------------------------------------------------------
// Items, arrangement dialogs, router and search
// ---------------------------------------------------------------------------

/**
 * What {@link FrappeSidebarItemNamespace.get_route} reads of an item. Narrower
 * than {@link FrappeSidebarItem} because callers pass partial objects
 * (`{ type: "Link", link_type: "Workspace", link_to }`,
 * frappe/public/js/frappe/ui/sidebar/sidebar.js:983-987). `route` and
 * `doctype_layout` are read
 * (frappe/public/js/frappe/ui/sidebar/sidebar_item.js:101-107,128). `route` is set by the
 * server since 16.60 (`Sidebar Item.route`, sidebar.py:2136) for Page rows. `doctype_layout`
 * is read at sidebar_item.js:128, and nothing in the server payload sets it, so it exists
 * only for callers that build an item themselves.
 */
export interface FrappeSidebarRouteItem {
	type: FrappeSidebarItemType;
	link_type?: FrappeSidebarItemLinkType | null;
	link_to?: string | null;
	url?: string | null;
	tab?: string | null;
	filters?: string | null;
	route_options?: string | null;
	report?: { report_type: string; ref_doctype: string | null };
	route?: string;
	doctype_layout?: string;
}

/**
 * `frappe.ui.sidebar_item` — the namespace created at
 * frappe/public/js/frappe/ui/sidebar/sidebar_item.js:1. It also holds the row
 * classes `TypeLink`, `TypeSectionBreak`, `TypeSpacer` and `TypeButton`
 * (picked by name from an item's `type`), which are not declared here: nothing
 * outside the sidebar needs them. `in_shell`, the helper that prefixes a path
 * with its shell, is module-private and unreachable.
 */
export interface FrappeSidebarItemNamespace {
	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar_item.js:57-146. Resolves a
	 * sidebar item to a desk path, or `undefined` for anything that is not a
	 * `Link` row or for a Report row with no `report` block
	 * (frappe/public/js/frappe/ui/sidebar/sidebar_item.js:65,79); `null` for a
	 * `URL` row with no `url`. `shell` is the shell the item belongs to, which
	 * the caller must say: left out, the path carries no shell and the desk
	 * writes one in on arrival
	 * (frappe/public/js/frappe/ui/sidebar/sidebar_item.js:57-62). A `URL` row's
	 * path is returned untouched, and so is a `Page` row whose page is a `system_page`
	 * (from `frappe.boot.page_info`), since a system page opens in no shell
	 * (`frappe/public/js/frappe/ui/sidebar/sidebar_item.js:139-143`). Shared by the rendered rows, the dock and the
	 * landing-route ladder.
	 */
	get_route(
		item: FrappeSidebarRouteItem,
		edit_mode?: boolean,
		shell?: string | null
	): string | null | undefined;
}

/**
 * `frappe.ui.SidebarManager` / `frappe.ui.DockManager` — the "Edit Sidebar" and
 * "Manage Dock" dialogs, both subclasses of `frappe.ui.ArrangementEditor`
 * (frappe/public/js/frappe/ui/sidebar/arrangement_editor.js:24). They are **not
 * in the desk bundle**: `arrangement_editor.bundle.js` loads them on click
 * (frappe/public/js/arrangement_editor.bundle.js:6-13;
 * frappe/public/js/frappe/ui/sidebar/sidebar_header.js:66-70), so the
 * constructors are absent from `frappe.ui` until
 * `frappe.require("arrangement_editor.bundle.js")` resolves. Constructing one
 * **opens the dialog**
 * (frappe/public/js/frappe/ui/sidebar/arrangement_editor.js:25-27,162-174);
 * they replace 16.33's in-sidebar `SidebarEditor` and its `edit_mode`. Only the
 * two members every instance carries are declared.
 */
export interface FrappeArrangementEditor {
	/** frappe/public/js/frappe/ui/sidebar/arrangement_editor.js:162-172 — the editor's dialog, already shown. */
	dialog: Dialog;
	/**
	 * frappe/public/js/frappe/ui/sidebar/arrangement_editor.js:155-160 — the
	 * layer being arranged: `app` where offered (developer mode only), else
	 * `site` for a Workspace Manager, else `user`
	 * (`DOCK_LAYERS` / `SIDEBAR_LAYERS`,
	 * frappe/public/js/frappe/ui/sidebar/dock_manager.js:24-48).
	 */
	layer: "app" | "site" | "user";
}

/**
 * `frappe.app.awesome_bar` — a `frappe.search.AwesomeBar`
 * (frappe/public/js/frappe/ui/toolbar/awesome_bar.js:6), the search modal behind
 * the sidebar's Search row (`.navbar-modal-search-mobile`). Created by the
 * first `Page` when `desk_settings.search_bar` is on
 * (frappe/public/js/frappe/ui/page.js:78-81), so it is absent on a user who
 * turned search off and before the first page exists. Only the open/close
 * surface is declared.
 */
export interface FrappeAwesomeBar {
	/**
	 * frappe/public/js/frappe/ui/toolbar/awesome_bar.js:84-89. Shows the modal; a
	 * no-op until `setup()` has built it.
	 */
	open(search_modal?: JQuery<HTMLElement>): void;
	/** frappe/public/js/frappe/ui/toolbar/awesome_bar.js:91-94. A no-op unless open. */
	close(): void;
	/** frappe/public/js/frappe/ui/toolbar/awesome_bar.js:96-98 — `search_modal.hasClass("show")`. */
	is_open(): boolean;
}

// ---------------------------------------------------------------------------
// The sidebar
// ---------------------------------------------------------------------------

/**
 * `frappe.ui.Sidebar` — frappe/public/js/frappe/ui/sidebar/sidebar.js:69. The
 * single instance is `frappe.app.sidebar`
 * (`frappe/public/js/frappe/desk.js:91`).
 *
 * `$sidebar` is assigned twice: `make_dom()` sets it to `.sidebar-items`
 * (frappe/public/js/frappe/ui/sidebar/sidebar.js:404) and the constructor then
 * overwrites it with `.body-sidebar`
 * (frappe/public/js/frappe/ui/sidebar/sidebar.js:81), which is the value every
 * later read sees.
 *
 * Declared, not modelled: the members a theme or an embedding app reaches are
 * listed. The promotional-banner, card and click-away plumbing
 * (`setup_promotional_banners`, `add_card`, `setup_click_away`, …) is internal.
 */
export declare class FrappeSidebar {
	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar.js:70-86. Takes no parameters
	 * (`frappe/public/js/frappe/desk.js:91` passes `{}`, which is ignored).
	 * **Returns early when `!frappe.boot.setup_complete`**
	 * (frappe/public/js/frappe/ui/sidebar/sidebar.js:71-73), leaving every field
	 * below unassigned.
	 */
	constructor(opts?: unknown);

	// -- constructor state (absent after the setup_complete early return) -----

	/** frappe/public/js/frappe/ui/sidebar/sidebar.js:393-403 — the rendered `sidebar.html` root, `.body-sidebar-container`, hidden until a page allows it and prepended to `<body>`. */
	wrapper?: JQuery<HTMLElement>;
	/** frappe/public/js/frappe/ui/sidebar/sidebar.js:81 — `.body-sidebar` (see the class note on the double assignment). */
	$sidebar?: JQuery<HTMLElement>;
	/** frappe/public/js/frappe/ui/sidebar/sidebar.js:79 — `.sidebar-items`, emptied by `empty()` on every render. */
	$items_container?: JQuery<HTMLElement>;
	/** frappe/public/js/frappe/ui/sidebar/sidebar.js:673 — `.standard-items-band`, host of the Search / Notification rows; assigned by the first `add_standard_items()`. */
	$standard_items_band?: JQuery<HTMLElement>;
	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar.js:75,93 —
	 * `frappe.boot.module_sidebars`, re-read on every `setup()`.
	 */
	all_sidebar_items?: Record<string, FrappeModuleSidebar>;
	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar.js:78,92,239 — the current
	 * shell's top-level rows after `nest_section_items()`; `[]` until the first
	 * `setup()`.
	 */
	sidebar_items?: FrappeSidebarItem[];
	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar.js:82,687. The `sidebar_item`
	 * objects for the current shell's top-level rows: reset by {@link empty} on
	 * every render, then filled by `add_item()`. A section's children live in
	 * that section's own `items`, and the standard Search / Notification buttons
	 * the first `setup()` pushes are cleared by the render that follows. 16.50
	 * never reset it, so it grew across shell switches. Typed opaque.
	 */
	items?: unknown[];
	/** frappe/public/js/frappe/ui/sidebar/sidebar.js:85,679 — `add_standard_items()` runs once per instance. */
	standard_items_setup?: boolean;
	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar.js:587-590 — whether the panel
	 * is open. A drawer (below md) starts shut, and so does a panel the page has
	 * folded ({@link fold_for_page}); on a desktop the viewer's choice
	 * is read from `localStorage["desk-sidebar-collapsed"]`
	 * (frappe/public/js/frappe/ui/sidebar/sidebar.js:593-599) and written back
	 * (frappe/public/js/frappe/ui/sidebar/sidebar.js:601-608). 16.33 used
	 * `localStorage["sidebar-expanded"]`.
	 */
	sidebar_expanded?: boolean;

	// -- per-shell state (assigned by setup()) --------------------------------

	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar.js:243 — the **shell** on
	 * screen: a key of `frappe.boot.module_sidebars`. Absent until the first
	 * `setup()`. This replaces 16.33's `sidebar_title` / `workspace_title`
	 * (a workspace title, lowercased for the lookup).
	 */
	current_module?: string;
	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar.js:91 —
	 * `frappe.boot.module_sidebars[current_module]`; `undefined` for an unknown
	 * shell (the assignment sits in a try that logs and swallows,
	 * frappe/public/js/frappe/ui/sidebar/sidebar.js:89-97).
	 */
	sidebar_data?: FrappeModuleSidebar | undefined;
	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar.js:573 — the `.sidebar-item-container`
	 * (the anchor's parent) whose `href` has the strongest `route_claim` on the
	 * current URL, or `null` when none claims it. Cleared of `.active-sidebar`
	 * and reassigned on every `find_active_item()`.
	 */
	active_item?: JQuery<HTMLElement> | null;
	/** frappe/public/js/frappe/ui/sidebar/sidebar.js:289 — created once, then refreshed (see the header note). */
	sidebar_header?: FrappeSidebarHeader;
	/** frappe/public/js/frappe/ui/sidebar/sidebar.js:334 — created by the first `refresh_dock()`. */
	dock?: FrappeDock;
	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar.js:683 — only when
	 * `frappe.boot.desk_settings.notifications` and the user is not Guest
	 * (frappe/public/js/frappe/ui/sidebar/sidebar.js:682). Created by the first
	 * `setup()`, through `add_standard_items()`
	 * (frappe/public/js/frappe/ui/sidebar/sidebar.js:678).
	 */
	notifications?: FrappeNotifications;

	// -- lifecycle -------------------------------------------------------------

	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar.js:241-251. Switches the sidebar
	 * to the shell `current_module`: fires `sidebar_setup` (**before** any state
	 * changes), assigns it, loads the data, refreshes the header and
	 * {@link make_sidebar}s. The argument is a key of
	 * `frappe.boot.module_sidebars`, **not** a workspace title.
	 */
	setup(current_module: string): void;
	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar.js:88-98 — adds the standard
	 * items once, then reads `sidebar_data`, `sidebar_items` and
	 * `all_sidebar_items` and nests the section items. Swallows errors
	 * (frappe/public/js/frappe/ui/sidebar/sidebar.js:95-97).
	 */
	load_sidebar_data(): void;
	/** frappe/public/js/frappe/ui/sidebar/sidebar.js:221-240. */
	nest_section_items(): void;
	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar.js:615-626. Empties
	 * `.sidebar-items`, re-renders `sidebar_items`, marks the active row and
	 * applies the expanded/collapsed state. The render step of `setup()` and the
	 * one place the sidebar DOM is rebuilt.
	 */
	make_sidebar(): void;
	/** frappe/public/js/frappe/ui/sidebar/sidebar.js:627-639. Renders "No Sidebar Items" for an empty list. */
	create_sidebar(items: FrappeSidebarItem[] | undefined): void;
	/** frappe/public/js/frappe/ui/sidebar/sidebar.js:611-614 — clears `.sidebar-items` and resets {@link items}. */
	empty(): void;
	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar.js:339-346. Re-applies page
	 * visibility, then re-resolves the shell and refreshes the header and dock.
	 * Returns early when the page allows neither the sidebar nor the dock.
	 */
	refresh(): void;
	/** frappe/public/js/frappe/ui/sidebar/sidebar.js:385-389 — shows or hides the wrapper, then refreshes the dock. */
	toggle(hide: boolean): void;
	/** frappe/public/js/frappe/ui/sidebar/sidebar.js:283-291 — creates the one header, or refreshes it. A no-op until `current_module` is set. */
	refresh_header(): void;
	/** frappe/public/js/frappe/ui/sidebar/sidebar.js:332-337 — creates the dock on first use, then refreshes it. */
	refresh_dock(): void;
	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar.js:372-383 — the only place that
	 * turns the sidebar or the dock on. Both start hidden and are shown once the
	 * page on screen allows them (`page.hide_sidebar`, `page.hide_dock`).
	 */
	apply_page_visibility(): void;
	/** frappe/public/js/frappe/ui/sidebar/sidebar.js:350-352 — `frappe.container.page.page`, or `undefined` before the first page. */
	current_page(): unknown;
	/** frappe/public/js/frappe/ui/sidebar/sidebar.js:355-359. */
	page_allows_sidebar(): boolean;
	/** frappe/public/js/frappe/ui/sidebar/sidebar.js:366-369. */
	page_allows_dock(): boolean;
	/** frappe/public/js/frappe/ui/sidebar/sidebar.js:362-364 — `frappe.is_mobile()`: only a drawer closes; on a desktop the panel folds. */
	panel_can_close(): boolean;
	/** frappe/public/js/frappe/ui/sidebar/sidebar.js:328-330 — whether there is a rail to draw: the owning app has at least one permitted entry. */
	dock_enabled(): boolean;

	// -- owning app ------------------------------------------------------------

	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar.js:295-302. The `app_data` entry
	 * that owns the shell on screen, read from the sidebar's own `app` (resolved
	 * through {@link rail_host_for}) rather than from the route. `null` when no
	 * shell is current or the shell is in no app; `undefined` when the shell
	 * names an app missing from `app_data`. **This replaces `frappe.current_app`**,
	 * which 16.50 no longer assigns anywhere, and has none of its staleness: it
	 * is a pure function of `current_module`.
	 */
	get_sidebar_app(): FrappeBootAppEntry | null | undefined;
	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar.js:305-309. The `app_name` that
	 * owns `shell`, by name (a companion resolved to its host), or `null` for a
	 * shell in no app.
	 */
	app_for_sidebar(shell: string | null | undefined): string | null;
	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar.js:100-102. A companion app's rail
	 * is its host's: `frappe.boot.app_rail_host[app_name]`, else the app itself.
	 */
	rail_host_for(app_name: string): string;
	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar.js:313-318. Whether moving to
	 * `entity_shell` leaves the app `shell` belongs to; the shell on screen does
	 * not survive that.
	 */
	crosses_app(shell: string | null | undefined, entity_shell: string | null | undefined): boolean;
	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar.js:321-325. The real Module Def
	 * behind the shell on screen (the shell is named after its sidebar, which
	 * may have been renamed); `null` before the first `setup()`.
	 */
	current_module_def(): string | null;

	// -- width ------------------------------------------------------------------

	/** frappe/public/js/frappe/ui/sidebar/sidebar.js:721-727 — `open()` / `close()` by current state. Also bound to `Ctrl+/` by `setup_events()` (frappe/public/js/frappe/ui/sidebar/sidebar.js:275-279). */
	toggle_width(): void;
	/** frappe/public/js/frappe/ui/sidebar/sidebar.js:801-806. */
	open(): void;
	/** frappe/public/js/frappe/ui/sidebar/sidebar.js:794-800. */
	close(): void;
	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar.js:808-814. Folds the panel for
	 * the page on screen without saving that as the viewer's choice; the print
	 * view calls it on `show` (frappe/printing/page/print/print.js:12).
	 */
	fold_for_page(): void;
	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar.js:816-823. Undoes
	 * {@link fold_for_page} and re-reads the saved state; the print view calls it
	 * on `hide` (frappe/printing/page/print/print.js:10).
	 */
	unfold_after_leaving_page(): void;
	/** frappe/public/js/frappe/ui/sidebar/sidebar.js:810,818 — set by {@link fold_for_page}, cleared by {@link unfold_after_leaving_page}; absent until the first fold. */
	folded_for_page?: boolean;
	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar.js:752-774. Applies
	 * `sidebar_expanded` to the DOM and fires
	 * `$(document).trigger("sidebar-expand", { sidebar_expand })`
	 * (frappe/public/js/frappe/ui/sidebar/sidebar.js:771-773), where
	 * `sidebar_expand` is whether the panel is *not* a rail. Replaces 16.33's
	 * `expand_sidebar()`.
	 */
	apply_expanded_state(): void;
	/** frappe/public/js/frappe/ui/sidebar/sidebar.js:577-584 — re-reads the saved state, then applies it. */
	restore_expanded_state(): void;
	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar.js:731-738. Beside a pinned dock
	 * a collapsed sidebar hides instead of folding to a rail.
	 */
	hides_when_collapsed(): boolean;

	// -- active row -------------------------------------------------------------

	/** frappe/public/js/frappe/ui/sidebar/sidebar.js:513-518 — lights the row {@link find_active_item} chose and expands its section. */
	highlight_active_item(): void;
	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar.js:547-575. Sets `active_item`
	 * to the global `.item-anchor[href]` with the strongest `route_claim` on
	 * `location.pathname`, its query string and `frappe.route_options` (the claim,
	 * frappe/public/js/frappe/ui/sidebar/sidebar.js:30-50, prefers filtered hrefs,
	 * then longer ones, and lets an item claim the URLs beneath it except a
	 * Workspace, which claims only its own). Returns whether any row claimed the
	 * URL. Selects `.item-anchor` **globally**, not within the wrapper. Replaces
	 * 16.33's `is_route_in_sidebar()`.
	 */
	find_active_item(): boolean;
	/** frappe/public/js/frappe/ui/sidebar/sidebar.js:539-545 — the rendered item object whose `item.label` is `name`. */
	get_item(name: string): unknown;

	// -- shell resolution -----------------------------------------------------

	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar.js:841-852. Picks the shell for
	 * the current route and calls {@link select_shell} only when it differs from
	 * `current_module`, then re-lights the active row. Takes no argument (16.33
	 * took the router). Registered as the router's `"change"` handler
	 * (frappe/public/js/frappe/ui/sidebar/sidebar.js:268-273).
	 */
	set_workspace_sidebar(): void;
	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar.js:854-860. `/desk` alone
	 * (an empty route) answers {@link default_shell}; a route the server's map
	 * does not know keeps the shell on screen.
	 */
	shell_for_current_route(route: readonly string[]): string | null;
	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar.js:863-865. The shell for a route
	 * that names nothing: `frappe.boot.home_shell`, else the first key of
	 * `module_sidebars`, else `null`.
	 */
	default_shell(): string | null;
	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar.js:896-934. `null` for a route that opens a
	 * `system_page` (the sidebar on screen is left alone). Otherwise the shell a URL for
	 * this route should name, by a ladder: a private page's own owner shell; the
	 * shell storing a workspace; the URL's own shell if it can show the route;
	 * the shell on screen if it can; finally `frappe.boot.canonical_shell`. On a
	 * jump (`frappe.router.is_jump`, e.g. an awesomebar pick) the shell on screen
	 * is kept only if it lists the entity (`listed_only`), and never when it is
	 * the Private shell.
	 */
	shell_for_route(route: readonly string[]): string | null;
	/** frappe/public/js/frappe/ui/sidebar/sidebar.js:868-873 — `frappe.router.current_shell`, if that shell can show the route. */
	shell_from_url(route: readonly string[]): string | null;
	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar.js:867-881. A `shared_page`
	 * (`frappe.router.page_info_for(route).shared_page`) is shown by every known shell.
	 * Otherwise a shell can show a route if it lists the entity, or belongs to the same
	 * app as the entity's canonical shell. `listed_only` drops the second test.
	 */
	shell_can_show(
		shell: string | null | undefined,
		route: readonly string[],
		opts?: { listed_only?: boolean }
	): boolean;
	/** frappe/public/js/frappe/ui/sidebar/sidebar.js:938-943 — `frappe.boot.canonical_shell[kind][entity]`, where an entity opens when nothing else states a shell. */
	canonical_shell_for(route: readonly string[], entity?: string | null): string | null;
	/** frappe/public/js/frappe/ui/sidebar/sidebar.js:945-949 — {@link setup} when `module` differs from the shell on screen. */
	select_shell(module: string | null | undefined): void;
	/** frappe/public/js/frappe/ui/sidebar/sidebar.js:952-958 — selects the shell, then opens its landing page. A no-op for an unknown shell. */
	open_module(module: string): void;
	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar.js:962-974. Opens a shell's
	 * landing page: a landing outside `/desk/` opens in a new tab with
	 * `noopener`. Returns whether the desk navigated.
	 */
	open_landing(module: string, opts?: { replace?: boolean }): boolean;
	/** frappe/public/js/frappe/ui/sidebar/sidebar.js:977-989 — opens a workspace by name, in the shell that lists it. */
	open_workspace(name: string | null | undefined): void;

	// -- landing routes and the dock -----------------------------------------

	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar.js:1110-1119. A shell's home: the
	 * route of the first item in its sidebar that has one; `null` for an unknown
	 * shell or one with none.
	 */
	module_landing_route(module: string | null | undefined): string | null;
	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar.js:1061-1072. Where an app's
	 * icon leads, always into the app: an `app_route` outside the desk as is;
	 * otherwise the route of the first non-`URL` rail entry that lands in the
	 * desk ({@link is_desk_route}), else the `app_route`, else its first
	 * navigable module's landing route. 16.50 took any `app_route` first, then
	 * the first rail entry whatever it led to.
	 */
	app_landing_route(app: FrappeBootAppEntry | null | undefined): string | null;
	/** frappe/public/js/frappe/ui/sidebar/sidebar.js:1075-1078 — whether a path's first segment is `desk` or the old `app` prefix. Throws on a nullish route. */
	is_desk_route(route: string): boolean;
	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar.js:992-998. The app's dock
	 * entries resolved for the rail, in arrangement order, hidden ones dropped. A
	 * shell in no app (`app` falsy) yields none.
	 */
	collect_dock_entries(app: FrappeBootAppEntry | null | undefined): FrappeDockEntry[];
	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar.js:1002-1032. Resolves a stored
	 * dock row to a label, icon, shell and route; `null` for a row that resolves
	 * to nothing (an unknown workspace or shell, a `URL` row with no `url`).
	 */
	dock_entry(row: FrappeDockRow | null | undefined): FrappeDockEntry | null;
	/** frappe/public/js/frappe/ui/sidebar/sidebar.js:1044-1052 — selects the entry's shell and navigates to the entry's route. It no longer opens the sidebar, so a collapsed one stays collapsed. */
	open_dock_entry(entry: FrappeDockEntry | null | undefined): void;
	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar.js:1081-1094. Where a dock
	 * entry leads: a `Sidebar` row opens its shell's landing route; any other row
	 * routes through `frappe.ui.sidebar_item.get_route`.
	 */
	dock_entry_route(entry: FrappeDockEntry | null | undefined): string | null | undefined;
	/** frappe/public/js/frappe/ui/sidebar/sidebar.js:1055-1057 — `"<link_type>|<link_to>|<url>"`, never the label, so relabelling cannot detach a row. Matches `dock_key` on the server (frappe/desk/doctype/dock/dock.py:938-949). */
	dock_entry_key(entry: Pick<FrappeDockEntry, "link_type" | "link_to" | "url">): string;
	/** frappe/public/js/frappe/ui/sidebar/sidebar.js:1123-1131 — a workspace entry is active only on that workspace, a shell entry while its shell shows, a URL entry never. */
	is_active_entry(entry: FrappeDockEntry | null | undefined): boolean;
	/** frappe/public/js/frappe/ui/sidebar/sidebar.js:1097-1103 — the app's shells (its `module_sidebars` entries' `name`s) in payload order. */
	navigable_app_modules(app: FrappeBootAppEntry | null | undefined): string[];
	/** frappe/public/js/frappe/ui/sidebar/sidebar.js:1105-1107. */
	first_navigable_module(app: FrappeBootAppEntry | null | undefined): string | undefined;

	// -- route → entity -----------------------------------------------------------

	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar.js:1157-1162. The kind of
	 * entity a route names; the inverse of `sidebar_item.get_route`. `Report`
	 * and `Dashboard` for `query-report` / `dashboard-view` routes, `Page` for a
	 * route in `frappe.boot.page_info`, otherwise `DocType`.
	 */
	link_type_from_route(route: readonly string[]): FrappeSidebarEntityKind;
	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar.js:1179-1194. The entity a route
	 * names: the report / dashboard after `query-report` / `dashboard-view`, a
	 * page's own route name, the only segment of a one-segment route, the third
	 * of a private-workspace route, otherwise the second segment (`["List",
	 * "Customer"]` names `Customer`). `undefined` for an empty route.
	 */
	entity_from_route(route: readonly string[]): string | undefined;
	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar.js:1198-1213. Every shell whose
	 * sidebar links `link_to` (of `link_type`, when given), across apps, the
	 * owning shell (`entity_module`) first.
	 */
	get_modules_linking(link_to: string, link_type?: FrappeSidebarItemLinkType | null): string[];
	/** frappe/public/js/frappe/ui/sidebar/sidebar.js:1216-1219 — `frappe.boot.entity_module[link_to]`: the shell an `is_default_module` row claims the entity for. */
	module_for_entity(link_to: string | null | undefined): string | undefined;
	/** frappe/public/js/frappe/ui/sidebar/sidebar.js:1171-1177 — the shell whose `workspaces` holds `name`, or `null`. */
	module_for_workspace(name: string | null | undefined): string | null;
	/** frappe/public/js/frappe/ui/sidebar/sidebar.js:1165-1169. */
	shell_lists_workspace(shell: string | null | undefined, name: string | null | undefined): boolean;

	// -- menus -------------------------------------------------------------------

	/**
	 * frappe/public/js/frappe/ui/sidebar/sidebar.js:429-511. The user menu (My
	 * Space, My Settings, Manage Dock, Reload, Logout), built by `user_menu_options()` (sidebar.js:443), shared by the sidebar's
	 * user button and the dock's avatar. Builds a `frappe.ui.Dropdown` on
	 * `parent` and returns nothing.
	 */
	create_user_menu(opts: {
		parent: JQuery<HTMLElement>;
		button: JQuery<HTMLElement>;
		side?: "top" | "right" | "bottom" | "left";
		align?: "start" | "center" | "end";
	}): void;
	/** frappe/public/js/frappe/ui/sidebar/sidebar.js:421-426. */
	setup_user_menu(): void;
}

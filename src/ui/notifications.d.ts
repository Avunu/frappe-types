/**
 * `frappe.ui.Notifications` — the desk's notification bell, and the panel (or
 * popover) it opens.
 *
 * Source of truth: frappe v16.50.0,
 * `frappe/public/js/frappe/ui/notifications/notifications.js`. Every declaration
 * and every citation below was re-read against the 16.50.0 release; the version
 * named above is moved by `scripts/remap-citations.mjs --stamp`, not by hand.
 * Citations are spelled with their full path so `scripts/audit-drift.mjs` can
 * check them.
 *
 * ## Two hosts, one body
 *
 * In 16.33 the bell was a dropdown (`.dropdown-notifications`) that
 * `Sidebar` created with `{ full_height: true }`. In 16.50 the heading, the
 * tabs and the tab bodies are the same but the **host** differs
 * (frappe/public/js/frappe/ui/notifications/notifications.js:7-28):
 *
 * - the **sidebar** host — the default. `Sidebar.setup_notifications` calls
 *   `new frappe.ui.Notifications()` with no options
 *   (frappe/public/js/frappe/ui/sidebar/sidebar.js:669-673), so `wrapper` is
 *   `$(".body-sidebar")` and the bell is the "Notification" row of the
 *   standard-items band, whose click runs
 *   `frappe.ui.sidebar_panels.toggle("notifications")`
 *   (frappe/public/js/frappe/ui/sidebar/sidebar.js:652-660). The body lives in a
 *   `frappe.ui.SidebarPanel` named `notifications`
 *   (frappe/public/js/frappe/ui/notifications/notifications.js:35-46), so
 *   dismissal (outside click, `Escape`, page change) is the panel registry's job;
 * - the **desk** host — `{ popover: true, wrapper }`, used by the desktop screen
 *   (frappe/desk/page/desktop/desktop.js:232-237). There is only a bell, so the
 *   body is handed to a `frappe.ui.Popover`
 *   (frappe/public/js/frappe/ui/notifications/notifications.js:52-78).
 *
 * ## The tab views are module-private
 *
 * `NotificationsView` ("All") and `EventsView` ("Events") are classes private to
 * the module — only their instances are reachable, through
 * {@link FrappeNotifications.tabs}
 * (frappe/public/js/frappe/ui/notifications/notifications.js:147-187). The
 * 16.33 `ChangelogFeedView` / "What's New" tab, the `bell_indicator` element and
 * `toggle_notification_icon()` are all gone.
 *
 * ## The unread badge is a global lookup now
 *
 * `NotificationsView.update_count_badge()` no longer resolves the badge relative
 * to `.body-sidebar`: it queries `$(".notification-count")` **document-wide, on
 * every call**, and writes into whatever it finds
 * (frappe/public/js/frappe/ui/notifications/notifications.js:423-439). The
 * sidebar's Notification row, the dock's bell and the desktop navbar each carry
 * such an element. A theme that rebuilds those rows must keep an element with
 * that class somewhere, or the count is stored but never shown — the call
 * returns silently when the lookup is empty (frappe/public/js/frappe/ui/notifications/notifications.js:429), after `unread_count` has
 * been updated.
 */

import type { FrappeSidebarPanel } from "./sidebar";

/** The two tab ids (frappe/public/js/frappe/ui/notifications/notifications.js:151,157). */
export type FrappeNotificationsTabId = "notifications" | "todays_events";

/** `BaseNotificationsView` — frappe/public/js/frappe/ui/notifications/notifications.js:246-267, the base both tab views extend. */
export interface FrappeNotificationsTab {
	/** frappe/public/js/frappe/ui/notifications/notifications.js:249 — the panel element the view renders into (`el`, frappe/public/js/frappe/ui/notifications/notifications.js:153,159). */
	wrapper: JQuery<HTMLElement>;
	/**
	 * frappe/public/js/frappe/ui/notifications/notifications.js:250 — the host
	 * element (`Notifications.$host`, passed at frappe/public/js/frappe/ui/notifications/notifications.js:185): the sidebar panel, or the
	 * `wrapper` for the popover host.
	 */
	parent: JQuery<HTMLElement>;
	/** frappe/public/js/frappe/ui/notifications/notifications.js:251 — `frappe.boot.notification_settings`, the same object for every view; `NotificationsView` writes `seen` into it (frappe/public/js/frappe/ui/notifications/notifications.js:453,459,481). */
	settings: Record<string, unknown>;
	/** frappe/public/js/frappe/ui/notifications/notifications.js:252 — `20`. */
	max_length: number;
	/** frappe/public/js/frappe/ui/notifications/notifications.js:253 — the `<div>` appended to `wrapper` that `show()` / `hide()` toggle. */
	container: JQuery<HTMLElement>;
	/** frappe/public/js/frappe/ui/notifications/notifications.js:257-259. */
	show(): void;
	/** frappe/public/js/frappe/ui/notifications/notifications.js:261-263. */
	hide(): void;
	/** frappe/public/js/frappe/ui/notifications/notifications.js:266 — called every time the panel opens, whichever host it lives in. */
	on_open(): void;
}

/**
 * The `"notifications"` tab ("All") — `NotificationsView`,
 * frappe/public/js/frappe/ui/notifications/notifications.js:269-487. Reachable
 * only as `frappe.ui.Notifications#tabs.notifications`.
 */
export interface FrappeNotificationsView extends FrappeNotificationsTab {
	/**
	 * frappe/public/js/frappe/ui/notifications/notifications.js:271 —
	 * `parent.find(".notifications-icon")`, resolved once in `make()` (which the
	 * base constructor calls, frappe/public/js/frappe/ui/notifications/notifications.js:254). Carries the "Notifications" tooltip only; it
	 * is not the badge.
	 */
	notifications_icon: JQuery<HTMLElement>;
	/** frappe/public/js/frappe/ui/notifications/notifications.js:278,424 — seeded from `frappe.boot.notification_unread_count`. */
	unread_count: number;
	/** frappe/public/js/frappe/ui/notifications/notifications.js:474 — set after the first fetch on open; absent until then. */
	notifications_fetched?: boolean;
	/**
	 * frappe/public/js/frappe/ui/notifications/notifications.js:423-439. Stores
	 * `count` (frappe/public/js/frappe/ui/notifications/notifications.js:424), then writes it (`"99+"` past 99) into **every**
	 * `.notification-count` in the document — see the class note. Re-queried on
	 * each call, so it also covers bells created after this view. A no-op for the
	 * display when none exists (frappe/public/js/frappe/ui/notifications/notifications.js:429).
	 */
	update_count_badge(count: number): void;
	/** frappe/public/js/frappe/ui/notifications/notifications.js:441-449 — persists `Notification Settings.seen` server-side; `cint(flag)` is what is sent. */
	toggle_seen(flag: boolean | number): void;
}

/**
 * `frappe.ui.Notifications` — frappe/public/js/frappe/ui/notifications/notifications.js:3.
 * Constructed by the sidebar with no options and by the desktop screen with
 * `{ popover: true, wrapper }` (see the file note).
 */
export declare class FrappeNotifications {
	/**
	 * frappe/public/js/frappe/ui/notifications/notifications.js:4-14. `wrapper`
	 * defaults to `$(".body-sidebar")` (frappe/public/js/frappe/ui/notifications/notifications.js:12), found globally; `popover` selects
	 * the desk host (frappe/public/js/frappe/ui/notifications/notifications.js:10). Builds everything immediately (`make()`, frappe/public/js/frappe/ui/notifications/notifications.js:13).
	 */
	constructor(opts?: { popover?: boolean; wrapper?: JQuery<HTMLElement> });
	/** frappe/public/js/frappe/ui/notifications/notifications.js:5,186 — tab views keyed by tab id (frappe/public/js/frappe/ui/notifications/notifications.js:151,157). */
	tabs: {
		notifications?: FrappeNotificationsView;
		todays_events?: FrappeNotificationsTab;
	};
	/** frappe/public/js/frappe/ui/notifications/notifications.js:6 — `frappe.boot.notification_settings`. */
	notification_settings: Record<string, unknown>;
	/** frappe/public/js/frappe/ui/notifications/notifications.js:10 — `opts?.popover || false`. */
	as_popover: boolean;
	/** frappe/public/js/frappe/ui/notifications/notifications.js:12. */
	wrapper: JQuery<HTMLElement>;
	/** frappe/public/js/frappe/ui/notifications/notifications.js:18 — `frappe.session.user` at construction. */
	user: string | undefined;
	/** frappe/public/js/frappe/ui/notifications/notifications.js:36 — the `notifications` {@link FrappeSidebarPanel}; the sidebar host only. */
	panel?: FrappeSidebarPanel;
	/**
	 * frappe/public/js/frappe/ui/notifications/notifications.js:65 — the
	 * `frappe.ui.Popover` the desk host builds; absent on the sidebar host.
	 * Opaque: that class is not declared by this package.
	 */
	popover?: unknown;
	/** frappe/public/js/frappe/ui/notifications/notifications.js:42,63 — the element the tab views mount in: the panel element, or `wrapper` for the popover host. */
	$host: JQuery<HTMLElement>;
	/** frappe/public/js/frappe/ui/notifications/notifications.js:60 — the `.notifications-list` content handed to the popover; the desk host only. */
	$list?: JQuery<HTMLElement>;
	/** frappe/public/js/frappe/ui/notifications/notifications.js:43,57 — the row under the heading, where the tab buttons go. */
	header_items: JQuery<HTMLElement>;
	/** frappe/public/js/frappe/ui/notifications/notifications.js:44,58 — the heading's actions slot: Notification Settings and Mark all as read (frappe/public/js/frappe/ui/notifications/notifications.js:129-144). */
	header_actions: JQuery<HTMLElement>;
	/** frappe/public/js/frappe/ui/notifications/notifications.js:95-100 — `.notification-list-body`, set by `render_body()`. */
	body: JQuery<HTMLElement>;
	/** frappe/public/js/frappe/ui/notifications/notifications.js:101 — `.panel-events`. */
	panel_events: JQuery<HTMLElement>;
	/** frappe/public/js/frappe/ui/notifications/notifications.js:102 — `.panel-notifications`. */
	panel_notifications: JQuery<HTMLElement>;

	/** frappe/public/js/frappe/ui/notifications/notifications.js:16-28 — reveals the sidebar's `.sidebar-notification` row, builds the host, the header actions and the tabs. */
	make(): void;
	/** frappe/public/js/frappe/ui/notifications/notifications.js:81-83 — fans out to every tab view's `on_open()`. */
	on_open(): void;
	/** frappe/public/js/frappe/ui/notifications/notifications.js:85-91 — closes the popover, or hides the panel. */
	close_panel(): void;
	/** frappe/public/js/frappe/ui/notifications/notifications.js:179-182. */
	switch_tab(id: FrappeNotificationsTabId): void;
	/** frappe/public/js/frappe/ui/notifications/notifications.js:189-194 — clears `.unread`, calls the server, zeroes the badge. */
	mark_all_as_read(e: JQuery.TriggeredEvent): void;
}

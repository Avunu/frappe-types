/**
 * `frappe.ui.Notifications` — the desk's notification bell + dropdown.
 *
 * Source of truth: frappe v16.33.1, `frappe/public/js/frappe/ui/notifications/notifications.js`.
 * Citations are `notifications.js:line`.
 *
 * In v16 the bell lives in the Workspace Sidebar (`frappe.ui.Sidebar`
 * creates the instance at `ui/sidebar/sidebar.js:562`), and its DOM host is
 * whatever `.standard-items-sections` the constructor finds globally (:9).
 *
 * ## The lookup that breaks when the bell is moved
 *
 * The three tab views (`NotificationsView`, `EventsView`,
 * `ChangelogFeedView`, :64-83) are **module-private classes** — only their
 * instances are reachable, through {@link FrappeNotifications.tabs}. The
 * notifications view resolves its unread badge and bell indicator relative
 * to the sidebar, not to its own wrapper:
 *
 * - `bell_indicator` — `this.parent.closest(".body-sidebar")?.find(".sidebar-notification .sidebar-item-icon")` (:229-234), once, in `make()`;
 * - `update_count_badge()` — `this.parent.closest(".body-sidebar")?.find(".sidebar-notification .sidebar-notification-count")` (:416-419), on **every** call, returning silently when the lookup is empty.
 *
 * `parent` is the `.dropdown-notifications` element (:126). A theme that
 * relocates `.standard-items-sections` out of `.body-sidebar` therefore keeps a
 * working dropdown but a frozen badge, and has to re-home those two lookups on
 * the instance. That consumer is why the view is declared at all.
 */

/** notifications.js:202-220 — the base every tab view extends. */
export interface FrappeNotificationsTab {
	/** notifications.js:205 — the panel element the view renders into (`el` at :69, :75, :81). */
	wrapper: JQuery<HTMLElement>;
	/** notifications.js:206 — the `.dropdown-notifications` element (:126). */
	parent: JQuery<HTMLElement>;
	/** notifications.js:209 — the `<div>` appended to `wrapper` that `show()` / `hide()` toggle. */
	container: JQuery<HTMLElement>;
	/** notifications.js:213-215. */
	show(): void;
	/** notifications.js:217-219. */
	hide(): void;
}

/**
 * The `"notifications"` tab — `NotificationsView`, notifications.js:222-460.
 * Reachable only as `frappe.ui.Notifications#tabs.notifications` (:67, :127).
 */
export interface FrappeNotificationsView extends FrappeNotificationsTab {
	/**
	 * notifications.js:229-234 — the element that gets `indicator blue`
	 * toggled by {@link toggle_notification_icon}. Resolved once, in `make()`
	 * (which the base constructor calls, :210), via
	 * `parent.closest(".body-sidebar")`; an **empty** jQuery set — never
	 * `undefined` — when the dropdown is not inside `.body-sidebar` (the
	 * optional chain at :232 only guards `closest()` returning nothing, which
	 * jQuery never does). Writable: re-point it after moving the bell.
	 */
	bell_indicator: JQuery<HTMLElement>;
	/** notifications.js:238, :415 — seeded from `frappe.boot.notification_unread_count`. */
	unread_count: number;
	/**
	 * notifications.js:414-429. Stores `count`, then writes it (`"99+"` past
	 * 99) into `.sidebar-notification .sidebar-notification-count` found via
	 * `parent.closest(".body-sidebar")` — a silent no-op when that lookup is
	 * empty (:419).
	 */
	update_count_badge(count: number): void;
	/** notifications.js:410-412 — `bell_indicator?.toggleClass("indicator blue", !seen)`. */
	toggle_notification_icon(seen: boolean): void;
}

/**
 * `frappe.ui.Notifications` — notifications.js:3. Constructed by the sidebar
 * with `{ full_height: true }` (`ui/sidebar/sidebar.js:562`).
 */
export declare class FrappeNotifications {
	/** notifications.js:4-11. `wrapper` defaults to `$(".standard-items-sections")` (:9), found globally. */
	constructor(opts?: { full_height?: boolean; wrapper?: JQuery<HTMLElement> });
	/** notifications.js:5, :127 — tab views keyed by category id (:67, :73, :79). */
	tabs: {
		notifications?: FrappeNotificationsView;
		todays_events?: FrappeNotificationsTab;
		changelog_feed?: FrappeNotificationsTab;
	};
	/** notifications.js:7. */
	full_height: boolean;
	/** notifications.js:9. */
	wrapper: JQuery<HTMLElement>;
	/** notifications.js:15 — `.dropdown-notifications`, toggled with the `hidden` class (:57, :156, :162, :166). */
	dropdown: JQuery<HTMLElement>;
	/** notifications.js:16 — `.notifications-list`. */
	dropdown_list: JQuery<HTMLElement>;
	/** notifications.js:24 — `frappe.session.user` at construction. */
	user: string | undefined;
	/** notifications.js:13-28. */
	make(): void;
	/** notifications.js:130-135 — clears `.unread`, calls the server, zeroes the badge. */
	mark_all_as_read(e: JQuery.TriggeredEvent): void;
}

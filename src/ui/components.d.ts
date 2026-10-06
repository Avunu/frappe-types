/**
 * The Espresso component helpers the v16 desk grew after v16.33 and builds its
 * own surfaces from: `frappe.ui.badge`, `frappe.ui.button`,
 * `frappe.ui.tab_buttons` / `frappe.ui.TabButtons`, plus the {@link FrappeTooltipOptions}
 * a button's `tooltip` option accepts.
 *
 * Source of truth: frappe v16.50.0 (`git tag v16.50.0`), every file under
 * `frappe/public/js/frappe/ui/components/`. Citations are full-path
 * (`frappe/public/js/frappe/ui/components/badge.js:87`) so
 * `npm run audit:drift` can check them.
 *
 * ## Why these three are callable-plus-properties
 *
 * `frappe.ui.badge` and `frappe.ui.button` are plain **functions** that return a
 * jQuery element, with a markup-string twin hung on as `.html` (and, for the
 * button, `.dress`). They are not classes — `new frappe.ui.button()` is not a
 * thing — so they are declared as call signatures with members rather than as
 * `new (...)` constructors.
 *
 * ## The "unknown option" rule the options types encode
 *
 * Every enum-valued option (`theme`, `size`, `variant`, `type`, `direction`) is
 * passed through `validated()` (`frappe/public/js/frappe/ui/components/utils.js:8-19`), which `console.warn`s
 * and **drops** an unknown value — the element silently renders with the CSS
 * default. A typo there is invisible at runtime, so the unions below are closed:
 * that is exactly the failure a type is for. The one deliberate widening is
 * {@link FrappeBadgeLegacyTheme}, which the badge accepts without a warning.
 *
 * ## Not declared on purpose
 *
 * `frappe.ui.tooltip` / `frappe.ui.Tooltip`, `frappe.ui.dropdown`, `popover`,
 * `toast`, `alert`, `tabs`, `avatar`, … — the same directory carries them, and
 * none has been verified here. Add one by augmenting
 * `FrappeUiNamespace` (see the note on that interface in `src/index.d.ts`).
 */

// ---------------------------------------------------------------------------
// frappe.ui.tooltip's option bag (only because `button({ tooltip })` takes it)
// ---------------------------------------------------------------------------

/**
 * The `TooltipOpts` typedef — `frappe/public/js/frappe/ui/components/tooltip.js:6-17`,
 * read by the `Tooltip` constructor at `frappe/public/js/frappe/ui/components/tooltip.js:91-109`. Declared only because
 * {@link FrappeButtonOptions.tooltip} forwards an object straight to
 * `frappe.ui.tooltip`; `frappe.ui.tooltip` itself is not declared here.
 */
export interface FrappeTooltipOptions {
	/**
	 * The label, rendered as text and never HTML (`frappe/public/js/frappe/ui/components/tooltip.js:168`). Optional
	 * because {@link FrappeTooltipOptions.only_on_overflow} falls back to the
	 * trigger's own text (`frappe/public/js/frappe/ui/components/tooltip.js:153-154`); with neither, nothing ever shows (`frappe/public/js/frappe/ui/components/tooltip.js:142`).
	 */
	text?: string;
	/** `frappe/public/js/frappe/ui/components/tooltip.js:99,152` — only show when the trigger's text is cut off. Default `false`. */
	only_on_overflow?: boolean;
	/**
	 * `frappe/public/js/frappe/ui/components/tooltip.js:100,170-181`. A raw combo (`"ctrl+b"`, shown as `⌘B` on a
	 * Mac) or an array of already-formatted keys; one `<kbd>` per key. Display
	 * only — it binds nothing.
	 */
	shortcut?: string | string[];
	/** `frappe/public/js/frappe/ui/components/tooltip.js:101`; the allowed set is `frappe/public/js/frappe/ui/components/position.js:12`. Default `"top"`. */
	side?: "top" | "right" | "bottom" | "left";
	/** `frappe/public/js/frappe/ui/components/tooltip.js:102`; the allowed set is `frappe/public/js/frappe/ui/components/position.js:13`. Default `"center"`. */
	align?: "start" | "center" | "end";
	/** `frappe/public/js/frappe/ui/components/tooltip.js:103-104,34`. Default `"center"`. */
	text_align?: "start" | "center";
	/** `frappe/public/js/frappe/ui/components/tooltip.js:105` — hover delay in ms; focus always shows at once. Default `500`. */
	delay?: number;
	/** `frappe/public/js/frappe/ui/components/tooltip.js:106` — gap between trigger and bubble, in px. Default `4`. */
	offset?: number;
	/** `frappe/public/js/frappe/ui/components/tooltip.js:109,164` — extra class(es) on the bubble; `es-tooltip` is always kept. */
	class?: string;
}

// ---------------------------------------------------------------------------
// frappe.ui.badge
// ---------------------------------------------------------------------------

/**
 * The badge themes — `frappe/public/js/frappe/ui/components/badge.js:19` (`THEMES`) plus `"orange"`, which `badge_html`
 * rewrites to `"amber"` (`frappe/public/js/frappe/ui/components/badge.js:36`, "same as frappe-ui").
 */
export type FrappeBadgeTheme = "gray" | "blue" | "green" | "amber" | "red" | "violet" | "orange";

/**
 * Pre-Espresso indicator colours that `badge_html` still accepts without a
 * warning (`frappe/public/js/frappe/ui/components/badge.js:23`), rendered by `badge-legacy-colors.css`. Frappe marks
 * the list `TODO: remove when badge-legacy-colors.css is retired` (`frappe/public/js/frappe/ui/components/badge.js:22`),
 * so prefer {@link FrappeBadgeTheme}; it stays in the union because frappe's own
 * call sites feed arbitrary indicator colours through
 * (`frappe/public/js/frappe/form/doctype_settings/list_panel.js:174`).
 */
export type FrappeBadgeLegacyTheme =
	| "grey"
	| "darkgrey"
	| "yellow"
	| "cyan"
	| "purple"
	| "pink"
	| "light-blue";

/** `frappe.ui.badge`'s option bag — the `BadgeOpts` typedef, `frappe/public/js/frappe/ui/components/badge.js:6-17`. */
export interface FrappeBadgeOptions {
	/** HTML-escaped, wrapped in `<span class="es-badge__label">` (`frappe/public/js/frappe/ui/components/badge.js:76`). */
	label?: string;
	/** Default `"gray"` — the CSS default, so no `data-theme` is emitted (`frappe/public/js/frappe/ui/components/badge.js:48`). */
	theme?: FrappeBadgeTheme | FrappeBadgeLegacyTheme;
	/** A `frappe.utils.icon` name shown before the label (`frappe/public/js/frappe/ui/components/badge.js:43,62`). */
	icon?: string;
	/** Same as {@link FrappeBadgeOptions.icon}, and wins over it when both are given (`frappe/public/js/frappe/ui/components/badge.js:43`: `icon_left || icon`). */
	icon_left?: string;
	/**
	 * A `frappe.utils.icon` name shown after the label, inside an
	 * `.es-badge__affix` wrapper (`frappe/public/js/frappe/ui/components/badge.js:65-74`). Unlike the left icon the
	 * affix accepts pointer events, so bind to `.es-badge__affix` for a
	 * dismissible tag.
	 */
	icon_right?: string;
	/** Tooltip; doubles as `aria-label` when the badge has no visible label (`frappe/public/js/frappe/ui/components/badge.js:51-57`). */
	title?: string;
	/** Default `"md"` (`frappe/public/js/frappe/ui/components/badge.js:24,49`). */
	size?: "sm" | "md" | "lg";
	/** Default `"subtle"` (`frappe/public/js/frappe/ui/components/badge.js:25,50`). */
	variant?: "solid" | "subtle" | "outline" | "ghost";
	/** Extra CSS classes (escaped, `frappe/public/js/frappe/ui/components/badge.js:60`). */
	css_class?: string;
	/**
	 * Extra attributes, e.g. `{ "data-testid": "status" }`. A `true` value emits
	 * the bare attribute; names that are not plain identifiers or start with `on`
	 * are refused with a warning (`frappe/public/js/frappe/ui/components/utils.js:83-94`).
	 */
	attrs?: Record<string, string | true>;
}

/**
 * `frappe.ui.badge` — `frappe/public/js/frappe/ui/components/badge.js:87-91`.
 *
 * ```ts
 * frappe.ui.badge({ label: __("Draft"), theme: "red" }).appendTo($row);
 * `<td>${frappe.ui.badge.html({ label: __("Open"), theme: "blue" })}</td>`;
 * ```
 */
export interface FrappeBadgeFunction {
	/** frappe/public/js/frappe/ui/components/badge.js:87-89 — `$(badge_html(opts))`, the `<span class="es-badge">` as a jQuery element. */
	(opts?: FrappeBadgeOptions): JQuery<HTMLElement>;
	/** frappe/public/js/frappe/ui/components/badge.js:33-78,91 — the same badge as a markup string, for template literals. */
	html(opts?: FrappeBadgeOptions): string;
}

// ---------------------------------------------------------------------------
// frappe.ui.button
// ---------------------------------------------------------------------------

/** `frappe.ui.button`'s option bag — the `ButtonOpts` typedef, `frappe/public/js/frappe/ui/components/button.js:6-23`. */
export interface FrappeButtonOptions {
	/** HTML-escaped, wrapped in `<span class="es-button__label">` (`frappe/public/js/frappe/ui/components/button.js:97`). */
	label?: string;
	/**
	 * Text shown while the button is busy (`frappe/public/js/frappe/ui/components/button.js:98-107`). When the **key is
	 * present** — even with the value `undefined` — it is used as given and
	 * `""` opts out; when absent, `Save` / `Delete` / `Submit` (matched on the
	 * *translated* label) default to `Saving...` / `Deleting...` / `Submitting...`
	 * (`frappe/public/js/frappe/ui/components/button.js:29-38`).
	 */
	loading_label?: string | undefined;
	/** Default `"subtle"` (`frappe/public/js/frappe/ui/components/button.js:25,56`). */
	variant?: "solid" | "subtle" | "outline" | "ghost";
	/** Default `"sm"` (`frappe/public/js/frappe/ui/components/button.js:26,57`). */
	size?: "xs" | "sm" | "md" | "lg";
	/** Default `"gray"` (`frappe/public/js/frappe/ui/components/button.js:27,58`). */
	theme?: "gray" | "red";
	/**
	 * A `frappe.utils.icon` name shown before the label (`frappe/public/js/frappe/ui/components/button.js:51,94-95`).
	 * An icon with no label makes a square icon-only button (`frappe/public/js/frappe/ui/components/button.js:52,59`) that
	 * needs a `title` or `tooltip`, or frappe logs a console warning (`frappe/public/js/frappe/ui/components/button.js:73-79`).
	 */
	icon?: string;
	/** Same as {@link FrappeButtonOptions.icon}, and wins over it when both are given (`frappe/public/js/frappe/ui/components/button.js:51`: `icon_left || icon`). */
	icon_left?: string;
	/** A `frappe.utils.icon` name shown after the label (`frappe/public/js/frappe/ui/components/button.js:96`). */
	icon_right?: string;
	/** Native browser tooltip; doubles as `aria-label` on icon-only buttons (`frappe/public/js/frappe/ui/components/button.js:66-70`). Prefer `tooltip`. */
	title?: string;
	/**
	 * The Espresso tooltip: a string, or a full {@link FrappeTooltipOptions}.
	 * Element form only, and only wired when `frappe.ui.tooltip` exists in the
	 * bundle (`frappe/public/js/frappe/ui/components/button.js:123-128`, "a bundle without the tooltip component should
	 * still get working buttons"). Suppresses the native `title` (`frappe/public/js/frappe/ui/components/button.js:66`) and
	 * doubles as `aria-label` on icon-only buttons (`frappe/public/js/frappe/ui/components/button.js:62-63,69-70`).
	 */
	tooltip?: string | FrappeTooltipOptions;
	/** Renders the `disabled` attribute (`frappe/public/js/frappe/ui/components/button.js:61`). */
	disabled?: boolean;
	/**
	 * Renders `aria-busy="true"` on creation (`frappe/public/js/frappe/ui/components/button.js:60`) — the same attribute
	 * the `onclick` busy state toggles (`frappe/public/js/frappe/ui/components/button.js:136,138`).
	 */
	loading?: boolean;
	/** Default `"button"` (`frappe/public/js/frappe/ui/components/button.js:54`). */
	type?: "button" | "submit" | "reset";
	/** Extra CSS classes (escaped, `frappe/public/js/frappe/ui/components/button.js:81`). */
	css_class?: string;
	/**
	 * Extra attributes, e.g. `{ "data-toggle": "dropdown" }`. Same rules as
	 * {@link FrappeBadgeOptions.attrs} (`frappe/public/js/frappe/ui/components/button.js:71`).
	 */
	attrs?: Record<string, string | true>;
	/**
	 * Click handler. **Element form only** — `frappe.ui.button.html` has no element
	 * to bind it to and ignores it (`frappe/public/js/frappe/ui/components/button.js:129-152`). `this` is the button
	 * element. A thenable return value puts the button into its busy state
	 * (`aria-busy`, spinner, clicks blocked) until it settles — a click while busy
	 * is ignored even from the keyboard (`frappe/public/js/frappe/ui/components/button.js:131-133`); a rejection is only
	 * re-logged in developer mode (`frappe/public/js/frappe/ui/components/button.js:135-149`).
	 */
	onclick?: (this: HTMLElement, event: JQuery.ClickEvent) => unknown;
}

/**
 * The subset of {@link FrappeButtonOptions} `frappe.ui.button.dress` reads —
 * `label` / `loading_label` / `icon` / `icon_left` / `icon_right` plus the three
 * look options (`frappe/public/js/frappe/ui/components/button.js:176,195-201`). Nothing else (`onclick`,
 * `disabled`, `loading`, …) is applied to an existing element.
 */
export type FrappeButtonDressOptions = Pick<
	FrappeButtonOptions,
	"label" | "loading_label" | "icon" | "icon_left" | "icon_right" | "variant" | "size" | "theme"
>;

/**
 * `frappe.ui.button` — `frappe/public/js/frappe/ui/components/button.js:119-209`.
 *
 * ```ts
 * frappe.ui.button({ label: __("Save"), variant: "solid", onclick: () => frm.save() });
 * `<div>${frappe.ui.button.html({ label: __("Load More") })}</div>`;
 * frappe.ui.button.dress(page.btn_primary, { label: __("Save"), variant: "solid" });
 * ```
 */
export interface FrappeButtonFunction {
	/**
	 * frappe/public/js/frappe/ui/components/button.js:119-154 — a wired `<button class="es-button">` as a jQuery element,
	 * with `opts.onclick` and `opts.tooltip` bound.
	 */
	(opts?: FrappeButtonOptions): JQuery<HTMLElement>;
	/**
	 * frappe/public/js/frappe/ui/components/button.js:46-86,156 — the same button as a markup string. Nothing is
	 * bound, so `onclick` is ignored and `tooltip` only contributes the accessible name.
	 */
	html(opts?: FrappeButtonOptions): string;
	/**
	 * frappe/public/js/frappe/ui/components/button.js:180-209 — applies the `es-button` look to an **existing**
	 * `<button>` in place — the page header's and dialogs' buttons
	 * (`frappe/public/js/frappe/ui/page.js:333`, `frappe/public/js/frappe/ui/dialog.js:208,254`),
	 * which other code holds references to and so can never be replaced. Adds the
	 * class and `type="button"` if missing; sets `data-variant` / `data-size` /
	 * `data-theme`, **removing** the attribute when the value is the CSS default
	 * and leaving it alone when the option is omitted; and rebuilds the children
	 * only when `label` or an icon is passed (`"label" in opts`, so an explicit
	 * `{ label: undefined }` empties them). Idempotent per option; touches no
	 * handler, `disabled`, `aria-busy` or visibility.
	 */
	dress(el: HTMLElement | JQuery<HTMLElement>, opts?: FrappeButtonDressOptions): JQuery<HTMLElement>;
}

// ---------------------------------------------------------------------------
// frappe.ui.tab_buttons / frappe.ui.TabButtons
// ---------------------------------------------------------------------------

/**
 * One choice of a tab-button group — the `TabButtonOption` typedef,
 * `frappe/public/js/frappe/ui/components/tab_buttons.js:6-19`.
 */
export interface FrappeTabButtonOption {
	/**
	 * Rendered as text, never HTML (`frappe/public/js/frappe/ui/components/tab_buttons.js:155`); with `icon` set it is only the
	 * accessible name (`frappe/public/js/frappe/ui/components/tab_buttons.js:150-153`).
	 */
	label?: string;
	/**
	 * What `get_value()` and `on_change` report. **Falls back to the label** when
	 * the key is absent (`frappe/public/js/frappe/ui/components/tab_buttons.js:183-185`: `"value" in option`), which is
	 * why it is `unknown` rather than a type parameter: the reported value is a
	 * `string` for an option that omits it, whatever the others hold.
	 */
	value?: unknown;
	/** An icon-only (square) button; pass `label` too so it has a name (`frappe/public/js/frappe/ui/components/tab_buttons.js:146-153,165-169`). */
	icon?: string;
	/** A leading icon beside a visible label (`frappe/public/js/frappe/ui/components/tab_buttons.js:146-149`). */
	icon_left?: string;
	/** A trailing icon beside a visible label; ignored when `icon` is set (`frappe/public/js/frappe/ui/components/tab_buttons.js:157-159`). */
	icon_right?: string;
	/** Fallback selection when no option matches `value` (`frappe/public/js/frappe/ui/components/tab_buttons.js:85-87`). */
	active?: boolean;
	/** `frappe/public/js/frappe/ui/components/tab_buttons.js:129`; skipped by the arrow-key walk (`frappe/public/js/frappe/ui/components/tab_buttons.js:105`). */
	disabled?: boolean;
	/** Native tooltip (`frappe/public/js/frappe/ui/components/tab_buttons.js:164`). */
	title?: string;
	/** Called with the native click event, after the selection changes (`frappe/public/js/frappe/ui/components/tab_buttons.js:172-175`). */
	onclick?: (event: MouseEvent) => void;
	/**
	 * Rich content before the icon / label: an element, or a function of the
	 * option returning one (`frappe/public/js/frappe/ui/components/tab_buttons.js:116-121,143-144`). Keep it
	 * non-interactive — it sits inside a `role="radio"` button.
	 */
	prefix?: Element | JQuery<HTMLElement> | ((option: FrappeTabButtonOption) => Element | JQuery<HTMLElement> | null | undefined);
	/**
	 * Rich content after the label (a count badge, say); same rules as
	 * {@link FrappeTabButtonOption.prefix} (`frappe/public/js/frappe/ui/components/tab_buttons.js:161-162`).
	 */
	suffix?: Element | JQuery<HTMLElement> | ((option: FrappeTabButtonOption) => Element | JQuery<HTMLElement> | null | undefined);
	/** Extra classes on this button (`frappe/public/js/frappe/ui/components/tab_buttons.js:130`). */
	css_class?: string;
}

/**
 * `frappe.ui.tab_buttons`' option bag — the `TabButtonsOpts` typedef,
 * `frappe/public/js/frappe/ui/components/tab_buttons.js:21-32`.
 *
 * `options` is required here although the constructor tolerates its absence
 * (`this.options = opts.options || []`, `frappe/public/js/frappe/ui/components/tab_buttons.js:57`): without it the group is empty and
 * nothing is ever selected, which no caller wants.
 */
export interface FrappeTabButtonsOptions {
	/** The choices. */
	options: FrappeTabButtonOption[];
	/** Accessible name for the radio group — announced when focus enters; not visible (`frappe/public/js/frappe/ui/components/tab_buttons.js:68`). */
	label?: string;
	/**
	 * The initially selected value. Falls back to the option marked `active`, then
	 * the first enabled one (`frappe/public/js/frappe/ui/components/tab_buttons.js:84-88`); the initial selection is
	 * silent — `on_change` does not fire for it. Looked up with `Object.is` (`frappe/public/js/frappe/ui/components/tab_buttons.js:180`).
	 */
	value?: unknown;
	/**
	 * `subtle` = a gray rail with a raised pill (the default); `ghost` = no rail,
	 * tinted pill; `underline` = looks like tabs; `browser-tab` = browser-style
	 * tabs on a rail (`frappe/public/js/frappe/ui/components/tab_buttons.js:26,34`).
	 */
	type?: "subtle" | "ghost" | "underline" | "browser-tab";
	/** Default `"sm"` (`frappe/public/js/frappe/ui/components/tab_buttons.js:35,59`). */
	size?: "sm" | "md";
	/** Default `false` (`frappe/public/js/frappe/ui/components/tab_buttons.js:62`). */
	vertical?: boolean;
	/** Which edge vertical `browser-tab`s attach to. Default `"left"` (`frappe/public/js/frappe/ui/components/tab_buttons.js:36,60-61,73-75`). */
	direction?: "left" | "right";
	/**
	 * Called with `(value, option)` when the selection changes — by a click, an
	 * arrow key, or `set_value` without `silent` — but not for the initial value
	 * (`frappe/public/js/frappe/ui/components/tab_buttons.js:207-209`).
	 */
	on_change?: (value: unknown, option: FrappeTabButtonOption) => void;
	/** Extra classes on the group (`frappe/public/js/frappe/ui/components/tab_buttons.js:65`). */
	css_class?: string;
}

/** One rendered button of a {@link FrappeTabButtons} group — `{ el, option }`, `frappe/public/js/frappe/ui/components/tab_buttons.js:171`. */
export interface FrappeTabButtonPill {
	el: HTMLButtonElement;
	option: FrappeTabButtonOption;
}

/**
 * `frappe.ui.TabButtons` — a segmented single-select that behaves as a radio
 * group (`frappe/public/js/frappe/ui/components/tab_buttons.js:53-225`). For choices, not
 * navigation. Click selects; with focus inside, the arrow keys move the
 * selection, wrapping and skipping disabled buttons, and flip in RTL
 * (`frappe/public/js/frappe/ui/components/tab_buttons.js:93-111`).
 *
 * The fields are the ones the constructor assigns (`frappe/public/js/frappe/ui/components/tab_buttons.js:56-78,113`) and the
 * methods are the group's own API; the private helpers (`build_pill`,
 * `resolve_extra`) are left out.
 */
export class FrappeTabButtons {
	/** frappe/public/js/frappe/ui/components/tab_buttons.js:55-114 — builds the group; the initial selection is silent. */
	constructor(opts: FrappeTabButtonsOptions);
	opts: FrappeTabButtonsOptions;
	options: FrappeTabButtonOption[];
	/** `opts.type`, else `"subtle"`. */
	type: "subtle" | "ghost" | "underline" | "browser-tab";
	/** `opts.size`, else `"sm"`. */
	size: "sm" | "md";
	/** `opts.direction`, else `"left"`. */
	direction: "left" | "right";
	vertical: boolean;
	/** The `<div class="es-tab-buttons" role="radiogroup">` (frappe/public/js/frappe/ui/components/tab_buttons.js:64-66). */
	el: HTMLDivElement;
	$el: JQuery<HTMLDivElement>;
	/** One entry per option, in order. */
	pills: FrappeTabButtonPill[];
	/** Set by `select` (frappe/public/js/frappe/ui/components/tab_buttons.js:189); unset when no option is enabled. */
	selected?: FrappeTabButtonPill;
	/** frappe/public/js/frappe/ui/components/tab_buttons.js:179-181 — `Object.is` match against {@link FrappeTabButtons.value_of}. */
	find_by_value(value: unknown): FrappeTabButtonPill | undefined;
	/** frappe/public/js/frappe/ui/components/tab_buttons.js:183-185 — `option.value` when the key is present, else `option.label`. */
	value_of(pill: FrappeTabButtonPill): unknown;
	/**
	 * frappe/public/js/frappe/ui/components/tab_buttons.js:187-210. A falsy or already-selected pill is a no-op. Updates
	 * `data-state` / `aria-checked` / `tabindex`, then fires `on_change` unless `silent`.
	 */
	select(pill: FrappeTabButtonPill | undefined, options?: { silent?: boolean }): void;
	/** frappe/public/js/frappe/ui/components/tab_buttons.js:212-214 — the selected value, or `null` when nothing is selected. */
	get_value(): unknown;
	/**
	 * frappe/public/js/frappe/ui/components/tab_buttons.js:217-224 — change the selection from code. Fires `on_change` unless
	 * `silent`. An unknown value logs a console warning and changes nothing.
	 */
	set_value(value: unknown, options?: { silent?: boolean }): void;
}

/**
 * `frappe.ui.tab_buttons` — the convenience form of {@link FrappeTabButtons}
 * (`frappe/public/js/frappe/ui/components/tab_buttons.js:238-242`): builds the group
 * and returns its container so it chains inside `append(...)`. The instance is
 * stored on `.data("es-tab-buttons")` (`frappe/public/js/frappe/ui/components/tab_buttons.js:240`) — read it from there for
 * `get_value` / `set_value`. jQuery types that slot as `any`, so annotate the
 * binding instead of casting:
 *
 * ```ts
 * const $group = frappe.ui.tab_buttons({ options: [{ label: "20" }, { label: "100" }] });
 * toolbar.append($group);
 * const group: FrappeTabButtons = $group.data("es-tab-buttons");
 * ```
 */
export type FrappeTabButtonsFunction = (opts: FrappeTabButtonsOptions) => JQuery<HTMLDivElement>;

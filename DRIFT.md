# Frappe drift ledger

What changed in frappe, in the places this typeset depends on, between the tag it was verified against and later releases. One section per release span, newest first.

**Every section is the output of `scripts/audit-drift.mjs`, pasted as printed.** Its heading and its "Produced by" line say which command made it, and the same command regenerates it from a clone of frappe that has both tags. Nothing inside a section is written by hand: every name, count and path is read from frappe's files or from git. If a number looks wrong, the fix is in `scripts/lib/`, followed by regenerating the section — not an edit to this file.

## What this ledger does not tell you

- **It does not re-verify anything.** A changed file does not make a declaration wrong, and an unchanged one does not make it right. The list of changed cited files is where to start reading, not a verdict. `package.json`'s `frappe.verifiedAgainst` is meant to move only when someone has re-read the source, and `verified-against` and `audit:drift` answer different questions (see the README, under "Maintaining it across frappe versions").
- **It sees five structures, not the desk JS API.** For each `frappe/public/scss/*.bundle.scss`, the `@import`s written directly in that file (not what `./desk/index` pulls in); the include lists `frappe/hooks.py` assigns; the icon sprites those lists name, plus whether the octicons and FontAwesome directories exist; the `*.bundle.*` entry files under `frappe/public`; and the `bootinfo` keys `frappe/boot.py` assigns (not keys other apps add through `boot_session`). Anything else about frappe can change without appearing here.
- **Only full-path citations are checked.** A citation written as `frappe/<path>:<line>` carries its own base. A relative `grid.js:412` takes its base from prose in its file's header, so it is counted under "Not checked" and never resolved; a file cited only that way can be deleted without this ledger saying so.
- **A line anchor is compared by number.** "Differs" means line N reads differently in the two trees, which includes text that merely moved, so it is an upper bound on how much of the evidence went stale.
- **Churn is lines added plus lines deleted.** It ranks files by how much was rewritten, not by how much the rewrite matters.

## How to add a section

1. Use a git clone of frappe that has both tags (`git fetch --tags`). A plain source tree has no history, so it can only be compared with `drift-baseline.json`, not with a tag.
2. Start the span where the previous section ended, so the spans tile. From this repository:

   ```bash
   node scripts/audit-drift.mjs --frappe /path/to/frappe --at <new tag> --from <previous tag> --report md
   ```

   `--at` makes the report depend on the two refs alone rather than on what is checked out.
3. Paste what it prints directly below the marker comment that sits between this introduction and the first section, so the newest span stays on top.
4. If the declarations have been re-verified against the new tag, bump `frappe.verifiedAgainst` in `package.json` and re-record the baseline in the same commit: `node scripts/audit-drift.mjs --at <new tag> --update-baseline`. If they have not, leave both alone; a ledger section without a version bump is the normal state.

<!-- NEW SECTIONS GO DIRECTLY BELOW THIS LINE, newest first -->

## v16.33.1 -> v16.50.0

- Baseline: `v16.33.1` (commit 988e54f3c4, 2026-09-08), read from git.
- Audited: `v16.50.0` (commit f20f92d297, 2026-10-06), read from git.
- 1160 commits in `v16.33.1..v16.50.0`.
- Produced by `node scripts/audit-drift.mjs --at v16.50.0 --from v16.33.1 --report md`.

### Surface changes

#### scss.bundles: each `*.bundle.scss` entry file and its `@import`s

- `frappe/public/scss/*.bundle.scss`
  - added `frappe/public/scss/leaflet.bundle.scss`
- `frappe/public/scss/desk.bundle.scss`
  - removed `frappe/public/css/fonts/fontawesome/font-awesome.min.css`
  - removed `frappe/public/css/octicons/octicons.css`
  - removed `frappe/public/js/lib/leaflet/leaflet.css`
  - removed `frappe/public/js/lib/leaflet_easy_button/easy-button.css`
  - removed `frappe/public/js/lib/leaflet_control_locate/L.Control.Locate.css`
  - removed `frappe/public/js/lib/leaflet_draw/leaflet.draw.css`
  - added `./desk/full_height_page`
  - added `./espresso_components`
  - added `./common/utilities`
- `frappe/public/scss/leaflet.bundle.scss`
  - added `frappe/public/js/lib/leaflet/leaflet.css`
  - added `frappe/public/js/lib/leaflet_easy_button/easy-button.css`
  - added `frappe/public/js/lib/leaflet_control_locate/L.Control.Locate.css`
  - added `frappe/public/js/lib/leaflet_draw/leaflet.draw.css`
- `frappe/public/scss/web_form.bundle.scss`
  - removed `frappe/public/css/octicons/octicons.css`
- `frappe/public/scss/website.bundle.scss`
  - added `./espresso_components`
  - added `common/utilities`

#### hooks.includes: the include lists `frappe/hooks.py` assigns

- `app_include_icons`
  - added `/assets/frappe/icons/module-icons.svg`

#### icons: sprites, icon-font leftovers, `frappe.utils` helpers

- `frappe/public/icons/lucide/icons.svg`
  - symbols: 1640 -> 1853
  - distinct: 1640 -> 1853
  - idsSha256: 661566024086... -> 7cc980a1c851...
  - prefix icon-: 1640 -> 1853
- `frappe/public/icons/module-icons.svg`
  - listed: (none) -> present
  - symbols: (none) -> 12
  - distinct: (none) -> 12
  - idsSha256: (none) -> e22c14e029b3...
  - prefix icon-: (none) -> 12
- `frappe/public/css/octicons`
  - exists: true -> false
- `@import of an icon-font stylesheet, as bundle: target`
  - removed `frappe/public/scss/desk.bundle.scss: frappe/public/css/fonts/fontawesome/font-awesome.min.css`
  - removed `frappe/public/scss/desk.bundle.scss: frappe/public/css/octicons/octicons.css`
  - removed `frappe/public/scss/web_form.bundle.scss: frappe/public/css/octicons/octicons.css`
- `frappe/public/js/frappe/utils/utils.js`
  - desktop_icon: desktop_icon(label, color, size) { -> desktop_icon(label, color, size, style) {

In the audited tree, changed or not:

- `frappe/public/icons/lucide/icons.svg`: 1853 symbols, 1853 distinct ids
- `frappe/public/icons/timeless/icons.svg`: 141 symbols, 141 distinct ids
- `frappe/public/icons/espresso/icons.svg`: 275 symbols, 261 distinct ids
- `frappe/public/icons/desktop_icons/alphabets.svg`: 26 symbols, 26 distinct ids
- `frappe/public/icons/module-icons.svg`: 12 symbols, 12 distinct ids
- `frappe/public/css/octicons`: absent
- `frappe/public/css/fonts/fontawesome`: present
- bundles importing an icon-font stylesheet: none

#### bundles: `*.bundle.*` entry files under `frappe/public`

- `frappe/public/**/*.bundle.{js,ts,scss,css}`
  - removed `frappe/public/js/frappe/ui/user_onboarding/user_onboarding.bundle.js`
  - added `frappe/public/js/arrangement_editor.bundle.js`
  - added `frappe/public/js/data_import_wizard.bundle.js`
  - added `frappe/public/js/desktop_icons.bundle.js`
  - added `frappe/public/js/doctype_settings.bundle.js`
  - added `frappe/public/js/embedded_list.bundle.js`
  - added `frappe/public/js/frappe/views/kanban_v2/kanban.bundle.js`
  - added `frappe/public/js/frappe/views/kanban_v2/kanban_settings.bundle.js`
  - added `frappe/public/js/leaflet.bundle.js`
  - added `frappe/public/js/list_filter.bundle.js`
  - added `frappe/public/js/list_view_virtualization.bundle.js`
  - added `frappe/public/js/side_panel.bundle.js`
  - added `frappe/public/js/user_settings_dialog.bundle.js`
  - added `frappe/public/scss/leaflet.bundle.scss`

#### boot: `bootinfo` keys assigned in `frappe/boot.py`

- `frappe/boot.py: bootinfo.<key> =`
  - removed `changelog_feed`
  - removed `marketplace_apps`
  - removed `module_list`
  - removed `module_wise_workspaces`
  - removed `modules`
  - removed `workspace_sidebar_item`
  - added `app_rail_host`
  - added `canonical_shell`
  - added `code_only_module_heirs`
  - added `desktop_page`
  - added `dock`
  - added `entity_module`
  - added `file_chunk_size`
  - added `home_shell`
  - added `module_sidebars`

### Citation integrity

- 317 full-path citations (251 name a line) in 14 declaration files, covering 91 distinct frappe files.
- Of those files: 64 changed since `v16.33.1`, 0 deleted, 27 unchanged.
- Cited line anchors whose text differs between the two trees: 175 of 314 (55.7%) counting each line once; 193 of 366 (52.7%) counting every citation.
  A line is compared by number, trimmed. A range contributes its two endpoints. 0 anchor(s) were past the end of the file at `v16.33.1` already and are left out.
- Not checked: 3355 citation(s) with a line number whose path is relative or belongs to another repo (by first path segment, (bare): 2883, model: 129, utils: 69, tables: 66, controls: 40, form: 40, ui: 38, carbon_frappe: 32, 14 more). A relative citation such as `grid.js:412` means what its file's header says it means, and that is prose, so a file cited ONLY that way is neither resolved nor reported as deleted.

#### Top 25 changed cited files by churn (lines added + deleted)

| churn | file | citations | cited lines changed |
| --- | --- | ---: | ---: |
| +912/-294 (1206) | `frappe/public/js/frappe/list/list_view.js` | 6 | 9/9 |
| +778/-412 (1190) | `frappe/public/js/frappe/ui/sidebar/sidebar.js` | 2 | 3/3 |
| +651/-203 (854) | `frappe/public/js/frappe/data_import/import_preview.js` | 1 | - |
| +335/-339 (674) | `frappe/public/js/frappe/ui/sidebar/sidebar_header.js` | 1 | 1/1 |
| +370/-244 (614) | `frappe/public/js/frappe/form/grid.js` | 9 | 8/8 |
| +454/-123 (577) | `frappe/public/js/frappe/ui/page.js` | 3 | 3/3 |
| +290/-276 (566) | `frappe/public/js/frappe/ui/notifications/notifications.js` | 2 | 1/1 |
| +225/-277 (502) | `frappe/public/js/frappe/form/grid_row.js` | 8 | 3/9 |
| +310/-149 (459) | `frappe/boot.py` | 11 | 16/16 |
| +207/-229 (436) | `frappe/public/js/frappe/views/breadcrumbs.js` | 1 | - |
| +382/-28 (410) | `frappe/public/js/frappe/router.js` | 1 | - |
| +260/-118 (378) | `frappe/desk/doctype/desktop_icon/desktop_icon.py` | 2 | 4/4 |
| +163/-126 (289) | `frappe/public/js/frappe/list/base_list.js` | 2 | 1/1 |
| +163/-66 (229) | `frappe/public/js/frappe/utils/utils.js` | 4 | 4/4 |
| +108/-46 (154) | `frappe/public/js/frappe/form/form.js` | 1 | 1/1 |
| +83/-61 (144) | `frappe/public/js/frappe/views/reports/report_view.js` | 3 | 1/1 |
| +82/-61 (143) | `frappe/public/js/frappe/ui/messages.js` | 20 | 30/30 |
| +119/-22 (141) | `frappe/public/js/frappe/views/reports/query_report.js` | 3 | 0/1 |
| +63/-61 (124) | `frappe/public/js/frappe/ui/keyboard.js` | 4 | 5/5 |
| +74/-35 (109) | `frappe/public/js/frappe/model/model.js` | 10 | 3/10 |
| +89/-15 (104) | `frappe/public/js/frappe/list/list_settings.js` | 4 | 1/3 |
| +67/-36 (103) | `frappe/public/js/frappe/model/sync.js` | 2 | 0/2 |
| +67/-23 (90) | `frappe/core/doctype/user/user.py` | 1 | 2/2 |
| +54/-34 (88) | `frappe/public/js/frappe/ui/theme_switcher.js` | 3 | 3/4 |
| +64/-13 (77) | `frappe/public/js/frappe/desk.js` | 10 | 7/11 |


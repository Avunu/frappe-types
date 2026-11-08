/**
 * frappe-types — group `deep-module-imports`, ambient wiring.
 *
 * Frappe v16.54.0. Companion to `deep-modules.d.ts`, which declares (or, for
 * the web form pair, re-exports from `web_form.d.ts`) everything the class
 * specifiers below re-export. Further down are the side-effect-only bundles
 * an app imports for what they install, and frappe's `.html` microtemplates.
 *
 * THIS FILE MUST STAY A SCRIPT. It deliberately has no top-level `import` or
 * `export`. Add one and every `declare module` below silently degrades from an
 * ambient module DECLARATION to a module AUGMENTATION, and consumers get
 * TS2307 ("Cannot find module 'frappe/public/js/frappe/form/grid'") with no
 * error reported here. Verified against tsc 7.0.2.
 *
 * For the same reason the re-export specifier must be NON-RELATIVE
 * (`frappe-types/...`, not `./...`): a relative specifier inside an ambient
 * module declaration is TS2439. This relies on package self-reference, so
 * frappe-types' package.json needs a `name` and an `exports` map covering the
 * subpath used below, and consumers need `moduleResolution` of `bundler`,
 * `node16` or `nodenext`.
 *
 * The specifiers below are the exact strings carbon_frappe writes, and they
 * resolve at BUILD time through esbuild's `nodePaths`
 * (frappe/esbuild/esbuild.js:92-97, 327), which makes every app's repo root a
 * NODE_PATH root:
 *
 *   frappe/public/js/frappe/form/grid
 *     → <apps>/frappe + /frappe/public/js/frappe/form/grid.js
 *
 * esbuild resolves the same path with its `.js` extension too. The two web
 * form modules are declared in both spellings; the grid modules only without
 * the extension, as carbon_frappe writes them; the side-effect bundles only
 * with it, as frappe's web_form.bundle.js writes them.
 *
 * Ship this file by `/// <reference path="./modules.d.ts" />` from
 * `global.d.ts` (and as the `./modules` subpath of the package's `exports`
 * map), because nothing imports it.
 *
 * ONLY DEFAULT EXPORTS, except one: each specifier below is declared with
 * exactly the exports the real module has. `grid_row`, `grid_row_form`,
 * `grid_pagination`, `web_form` and `web_form_list` have a default export and
 * nothing else. `grid` has the default `Grid` PLUS, since v16.50, four named
 * const exports (frappe/public/js/frappe/form/grid.js:10-36). No module has a
 * named export for its own class, so none is declared: an
 * `import { Grid } from ...` would type-check against a phantom export and
 * then fail in esbuild. The side-effect bundles have no exports at all, so
 * their declarations have empty bodies: `import "…"` checks, and any named or
 * default import from them is an error, as it is in esbuild.
 */

declare module "frappe/public/js/frappe/form/grid" {
	// frappe/public/js/frappe/form/grid.js:52 — `export default class Grid {`.
	//
	// Since v16.50 the module ALSO has four NAMED exports, all const pixel-width
	// tables (frappe/public/js/frappe/form/grid.js:10-36); they are re-exported
	// below. `Grid` itself is the DEFAULT export only: `import { Grid } from ...`
	// is a "No matching export" error at build time, so it is not declared here.
	import { Grid } from "frappe-types/deep-modules";
	export default Grid;
	export {
		GRID_MIN_COLUMN_WIDTH,
		GRID_MAX_COLUMN_WIDTH,
		DEFAULT_COLUMN_WIDTHS,
		LEGACY_COLSIZE_TO_PX,
	} from "frappe-types/deep-modules";
}

declare module "frappe/public/js/frappe/form/grid_row" {
	// frappe/public/js/frappe/form/grid_row.js:9 — `export default class GridRow {`.
	// No named exports.
	import { GridRow } from "frappe-types/deep-modules";
	export default GridRow;
}

declare module "frappe/public/js/frappe/form/grid_row_form" {
	// frappe/public/js/frappe/form/grid_row_form.js:1 —
	// `export default class GridRowForm {`. No named exports.
	import { GridRowForm } from "frappe-types/deep-modules";
	export default GridRowForm;
}

declare module "frappe/public/js/frappe/form/grid_pagination" {
	// frappe/public/js/frappe/form/grid_pagination.js:1 —
	// `export default class GridPagination {`. No named exports. Not imported by
	// carbon_frappe today; declared because it is the type of
	// `Grid#grid_pagination` and the same specifier shape works.
	import { GridPagination } from "frappe-types/deep-modules";
	export default GridPagination;
}

declare module "frappe/public/js/frappe/web_form/web_form" {
	// frappe/public/js/frappe/web_form/web_form.js:5 —
	// `export default class WebForm extends frappe.ui.FieldGroup {`. No named
	// exports. Declared as a constructor value merged with the instance
	// interface; see "Not substitutable for `FieldGroup`" on `WebForm` in
	// web_form.d.ts for why it is not a `class`. `class MyForm extends WebForm {}`
	// and `override` of any method, inherited ones included, work as with a class.
	import { WebForm } from "frappe-types/deep-modules";
	export default WebForm;
}

declare module "frappe/public/js/frappe/web_form/web_form.js" {
	// The same module spelled with its extension, which esbuild resolves through
	// `nodePaths` just the same (frappe/esbuild/esbuild.js:92-97) and which is
	// how frappe/public/js/web_form.bundle.js:1-7 spells its own imports.
	import { WebForm } from "frappe-types/deep-modules";
	export default WebForm;
}

declare module "frappe/public/js/frappe/web_form/web_form_list" {
	// frappe/public/js/frappe/web_form/web_form_list.js:5 —
	// `export default class WebFormList {`. No named exports; the module also
	// defines `frappe.ui.WebFormListRow` (:391) as a side effect.
	import { WebFormList } from "frappe-types/deep-modules";
	export default WebFormList;
}

declare module "frappe/public/js/frappe/web_form/web_form_list.js" {
	// The same module spelled with its extension; see `web_form.js` above.
	import { WebFormList } from "frappe-types/deep-modules";
	export default WebFormList;
}

// ---------------------------------------------------------------------------
// Side-effect-only modules
//
// The files frappe's own `web_form.bundle.js` imports for what they install
// (frappe/public/js/web_form.bundle.js:1-7), plus that bundle itself. An app
// that builds its own website bundle imports the same ones, and none of them
// exports anything, so each is declared with an empty body. Written with the
// `.js` extension, the way web_form.bundle.js writes them; esbuild resolves the
// specifier through `nodePaths` (frappe/esbuild/esbuild.js:92-97), as for the
// class modules above.
//
// They are declared one by one, never as a `frappe/public/js/*.js` wildcard: a
// bodyless wildcard would type every named import from any frappe file as
// `any`, and one with a body would accept a typo'd path.
// ---------------------------------------------------------------------------

/** frappe/public/js/web_form.bundle.js:1-7 — the web form page's bundle: controls, dialog, moment, keyboard, datetime, the web form script and Bootstrap. */
declare module "frappe/public/js/web_form.bundle.js" {}
/** frappe/public/js/controls.bundle.js:1-4 — the date picker and the form controls (`frappe.ui.form.Control*`). */
declare module "frappe/public/js/controls.bundle.js" {}
/** frappe/public/js/dialog.bundle.js:1-7 — the layout, `frappe.ui.FieldGroup`, the link and multi-select dialogs and `frappe.ui.Dialog`. */
declare module "frappe/public/js/dialog.bundle.js" {}
/** frappe/public/js/lib/moment.js:4-5 — binds moment-timezone (ten years of zone data) to `window.moment`. */
declare module "frappe/public/js/lib/moment.js" {}
/** frappe/public/js/frappe/ui/keyboard.js:4 — `frappe.ui.keys`. */
declare module "frappe/public/js/frappe/ui/keyboard.js" {}
/** frappe/public/js/frappe/utils/datetime.js:4 — `frappe.datetime`. */
declare module "frappe/public/js/frappe/utils/datetime.js" {}
/** frappe/public/js/frappe/web_form/webform_script.js:4-102 — renders the page's web form or list on `frappe.ready`. */
declare module "frappe/public/js/frappe/web_form/webform_script.js" {}
/**
 * frappe/public/js/bootstrap-4-web.bundle.js:1-68 — the website's Bootstrap 4
 * glue: nested dropdown menus, `frappe.get_modal` (:20) and a
 * `frappe.ui.Dialog` subclass that swaps in Bootstrap's modal footer (:44).
 */
declare module "frappe/public/js/bootstrap-4-web.bundle.js" {}

// ---------------------------------------------------------------------------
// frappe microtemplates
//
// frappe's esbuild plugin claims every `.html` import (frappe/esbuild/frappe-html.js:7-12)
// and compiles the file into a single statement,
// `frappe.templates['<name>'] = \`…\`;`, where `<name>` is the file name up to
// its first dot (frappe/esbuild/frappe-html.js:14-24). The module exports
// nothing: import it for that side effect, then render it with
// `frappe.render_template("<name>", context)`.
//
//   import "./templates/order_card.html";
//
// The pattern is global, as `.html` imports are in a frappe build. A project
// whose other tooling gives `.html` imports exports declares its own
// `declare module "*.html" { … }`; the two merge.
// ---------------------------------------------------------------------------

declare module "*.html" {}

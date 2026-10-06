/**
 * frappe-types — group `deep-module-imports`, ambient wiring.
 *
 * Frappe v16.50.0. Companion to `deep-modules.d.ts`, which declares everything
 * the four specifiers below re-export.
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
 * Ship this file by `/// <reference path="./modules.d.ts" />` from
 * `global.d.ts` (and as the `./modules` subpath of the package's `exports`
 * map), because nothing imports it.
 *
 * ONLY DEFAULT EXPORTS, except one: each specifier below is declared with
 * exactly the exports the real module has. `grid_row`, `grid_row_form` and
 * `grid_pagination` have a default export and nothing else. `grid` has the
 * default `Grid` PLUS, since v16.50, four named const exports
 * (frappe/public/js/frappe/form/grid.js:10-36). No module has a named export
 * for its own class, so none is declared: an `import { Grid } from ...` would
 * type-check against a phantom export and then fail in esbuild.
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

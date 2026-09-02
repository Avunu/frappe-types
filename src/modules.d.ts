/**
 * frappe-types — group `deep-module-imports`, ambient wiring.
 *
 * Frappe v16.33.0. Companion to `deep-module-imports.d.ts`.
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
 * Ship this file in the package's `types`/`typesVersions` entry point (or
 * `/// <reference path="./deep-module-imports.ambient.d.ts" />` it from
 * `global.d.ts`), because nothing imports it.
 */

declare module "frappe/public/js/frappe/form/grid" {
	// grid.js:21 — `export default class Grid {`. No named exports.
	import { Grid } from "frappe-types/deep-modules";
	export default Grid;
	export { Grid };
}

declare module "frappe/public/js/frappe/form/grid_row" {
	// grid_row.js:9 — `export default class GridRow {`. No named exports.
	import { GridRow } from "frappe-types/deep-modules";
	export default GridRow;
	export { GridRow };
}

declare module "frappe/public/js/frappe/form/grid_row_form" {
	// grid_row_form.js:1 — `export default class GridRowForm {`. No named exports.
	import { GridRowForm } from "frappe-types/deep-modules";
	export default GridRowForm;
	export { GridRowForm };
}

declare module "frappe/public/js/frappe/form/grid_pagination" {
	// grid_pagination.js:1 — `export default class GridPagination {`. No named
	// exports. Not imported by carbon_frappe today; declared because it is the
	// type of `Grid#grid_pagination` and the same specifier shape works.
	import { GridPagination } from "frappe-types/deep-modules";
	export default GridPagination;
	export { GridPagination };
}

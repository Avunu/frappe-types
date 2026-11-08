# Type tests

Each directory is a small consumer project, checked by `npm run test:types`
(`scripts/test-types.mjs`) against the package exactly as `npm pack` would
publish it: the script copies the packed file list into a scratch
`node_modules/frappe-types`, so the `exports` map, the `files` list and the
`tsconfig/` presets are under test as well as the declarations.

| project | config | proves |
| --- | --- | --- |
| `desk-js/` | `extends: frappe-types/tsconfig/desk-js.json` | JSDoc-annotated desk scripts (doctype, child table, list, report, page) check under strict `checkJs`, with a `FrappeDocTypes` registry; Table-field rows typed with `FrappeChildRow`; a child table with two parents; typed forms passed to `Form`-typed APIs; subclasses of frappe classes (sort selector, quick entry, print view, view switcher, list view, Gantt view, the control classes: `controls.js`); dialogs typed by their values, field definitions, the form footer, the upload dialog and the model helpers (`dialogs.js`); `frappe.perm` / `frappe.workflow` / `frappe.contacts` used as data_steward and erpnext_cis_plus use them (`perm_workflow.js`); `frappe.quick_entry` set by hand, `frappe.quick_edit`, `frappe.new_doc`'s quick entry callback, the address and contact quick entry forms, `frm.email_field`, the timeline's email helpers and a `frappe.ui.BaseTimeline` subclass (`quick_entry_timeline.js`); app-owned names declared by augmenting the package (`app_types.d.ts`), including a view mode registered in `FrappeViewModes` (`views_app_types.d.ts`); `frappe.call` / `xcall` / `frm.call` responses typed from an annotated callback, `frappe.db.get_doc` typed from the doctype, frappe's window helpers, templates, `__` and `frappe._` as one type (`requests.js`); the apps' `frappe.views` patterns with no shim or cast (`views_apps.js`: list settings hooks, side panel prototype patches, calendar settings, Gantt and File view overrides, a JavaScript `view_name` getter, the email composer called as frappe's timeline and `frm.email_doc` call it, `frappe.DataTable` as a type) |
| `compiled/` | `extends: frappe-types/tsconfig/base.json` + `types: ["frappe-types/global"]` | compiled TypeScript using the globals, the type-space namespace and named imports together; `frappe.call<T>` / `xcall<T>` / `frm.call<T>` and a raw `fetch` body typed as `FrappeResponse` (`requests.ts`); control subclasses and slot replacements, `Dialog<TValues>` named on the variable, self-referencing dialogs, the form footer and `FormDocumentEvents`, a `BaseTimeline` subclass and the quick entry forms (`controls.ts`); an app's own view mode, route and `ListView` subclass, the module sidebar lookup, the side panel's preview cache and the datatable's guessed filter, with no local copy of a frappe type (`views.ts`) |
| `desk-js-empty/` | `desk-js.json`, no registry | an app that registers no doctypes: `Form<"Customer">` is accepted wherever the plain `Form` is, and `set_value` keeps its open 16.4 signature |
| `web/` | `desk-js.json` + `types: ["frappe-types/web"]` | web form client scripts; a JSDoc website bundle subclassing the deep-imported `WebForm` / `WebFormList` |
| `web-bundle/` | `base.json` + `types: ["frappe-types/web"]` | a compiled website bundle that replaces frappe's web form script: side-effect imports of frappe's web bundles, a `.html` microtemplate import, `WebForm` / `WebFormList` subclasses, `window.saving` |
| `module/` | `base.json`, no `types` entry | the module entry alone: named types, the shared registry, and no `frappe` global |
| `gen-registry/` | `base.json` + `types: ["frappe-types/global"]`; `gen-registry.json` | the PACKED `frappe-types gen-registry` runs (through `bin`, from the packed files) on `test/fixtures/gen-registry/apps`, and compiled TypeScript uses its output: closed documents, nullable numbers, Select unions, `FrappeChildRow` tables, `parenttype` from every parent, augmenting `FrappeDocTypeFields` for database-only fields |
| `gen-registry-desk-js/` | `desk-js.json`; `gen-registry.json` | the same generated file from JSDoc-checked desk scripts, including child-table events on the parent form |
| `gen-registry-edge/` | `base.json` + `types: ["frappe-types/global"]`; `gen-registry.json` | regressions from real DocTypes (`edge_app`): Select options containing double quotes (DocType, Customize Form, Bank Statement Import Log), Duration as a number, hyphenated DocType names (e-Invoice Log), DocTypes that declare `idx` / `parent` themselves (Custom DocPerm, Desktop Icon, Web Page) |
| `gen-registry-two-apps/` | `base.json` + `types: ["frappe-types/global"]`; `gen-registry.json` with two runs | two apps' generated files in one program: both register the same DocType, each with its own Custom Field, and the fields merge |

Every project runs under each compiler in `COMPILERS` (`scripts/test-types.mjs`): the repo's own TypeScript and TypeScript 5.8 (the aliased devDependency `typescript-5.8`), the oldest release the README supports. TypeScript 5.x measures generic variance differently from 7, so a declaration can pass on one and not the other. `--tsc=5.8` or `--tsc=current` runs just one.

A project with a `gen-registry.json` gets its generated file written by the packed command before it is compiled (one run per entry when the file holds an array); the output is not committed.

A project passes when `tsc -p` exits 0 under every compiler. Negative cases are written inline with
`// @ts-expect-error`, so each one fails the run if the error it expects stops
happening: a regression that makes the declarations too permissive is caught
the same way as one that makes them too strict.

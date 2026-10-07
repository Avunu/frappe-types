# Type tests

Each directory is a small consumer project, checked by `npm run test:types`
(`scripts/test-types.mjs`) against the package exactly as `npm pack` would
publish it: the script copies the packed file list into a scratch
`node_modules/frappe-types`, so the `exports` map, the `files` list and the
`tsconfig/` presets are under test as well as the declarations.

| project | config | proves |
| --- | --- | --- |
| `desk-js/` | `extends: frappe-types/tsconfig/desk-js.json` | JSDoc-annotated desk scripts (doctype, child table, list, report) check under strict `checkJs`, with a `FrappeDocTypes` registry; Table-field rows typed with `FrappeChildRow`; a child table with two parents; typed forms passed to `Form`-typed APIs |
| `compiled/` | `extends: frappe-types/tsconfig/base.json` + `types: ["frappe-types/global"]` | compiled TypeScript using the globals, the type-space namespace and named imports together |
| `desk-js-empty/` | `desk-js.json`, no registry | an app that registers no doctypes: `Form<"Customer">` is accepted wherever the plain `Form` is, and `set_value` keeps its open 16.4 signature |
| `web/` | `desk-js.json` + `types: ["frappe-types/web"]` | web form client scripts |
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

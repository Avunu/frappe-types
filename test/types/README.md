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

Every project runs under each compiler in `COMPILERS` (`scripts/test-types.mjs`): the repo's own TypeScript and TypeScript 5.8 (the aliased devDependency `typescript-5.8`), the oldest release the README supports. TypeScript 5.x measures generic variance differently from 7, so a declaration can pass on one and not the other. `--tsc=5.8` or `--tsc=current` runs just one.

A project passes when `tsc -p` exits 0 under every compiler. Negative cases are written inline with
`// @ts-expect-error`, so each one fails the run if the error it expects stops
happening: a regression that makes the declarations too permissive is caught
the same way as one that makes them too strict.

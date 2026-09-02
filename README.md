# frappe-types

TypeScript definitions for the **Frappe Framework desk JS API** — the `window.frappe` global that every desk page, doctype client script, custom app bundle and theme is written against.

Frappe ships no types for it. This package is a hand-maintained, **source-verified** typeset: every declaration is derived by reading the frappe version it targets, and carries a `file.js:line` citation back to the code it describes.

```
npm i -D frappe-types
```

```jsonc
// tsconfig.json — this one line is the whole setup
{
  "compilerOptions": {
    "types": ["frappe-types/global"]
  }
}
```

```ts
// no imports needed — `frappe`, `__`, `locals`, `cur_frm` are ambient, exactly as they are at runtime
frappe.msgprint({ title: __("Saved"), message: __("Done"), indicator: "green" });
```

Prefer explicit imports (frappe-ui SPAs, shared libraries, anywhere a floating global is unwelcome)? The same types are exported as named types, with no globals installed:

```ts
import type { DocField, FrappeDoc, ListViewSettings } from "frappe-types";
```

## Which version do I install?

**The package major mirrors the frappe major.** Minor and patch are this package's own.

| your frappe | install | dist-tag |
| --- | --- | --- |
| v16 | npm i -D frappe-types@^16 | latest |
| v15 | npm i -D frappe-types@^15 | v15 |
| develop | npm i -D frappe-types@develop | develop |

So `frappe-types@16.4.2` is the 3rd revision of the v16 typeset — never "types for frappe 16.4.2". `package.json` records the exact tag each release was verified against:

```jsonc
"frappe": { "major": "16", "verifiedAgainst": "v16.33.0", "branch": "version-16" }
```

Each frappe major lives on its own branch (`version-16`, `version-15`), mirroring how frappe and frappe apps are themselves branched.

## What this is, and what it is not

**It is** the browser-side desk API: `frappe.call`, the `frappe.ui.form.*` class hierarchy, the `frappe.views.*` list/report views, `frappe.model` / `frappe.meta` and the `DocField` / doc shapes, `frappe.utils` / `frappe.dom` / `frappe.router`, `frappe.DataTable`, `frappe.Chart`, the `__()` translator, and ambient declarations for the deep imports desk apps rely on (`import Grid from "frappe/public/js/frappe/form/grid"`).

**It is not** types for frappe's Python API, for [frappe-ui](https://github.com/frappe/frappe-ui), or for the REST/`frappe.client` payload shapes of your own doctypes — generate those from your app's doctype JSON.

**It is not official.** It is not affiliated with or endorsed by Frappe Technologies. When frappe publishes its own types, use those.

### Coverage is partial, and says so

Frappe v16's desk namespace is **2,063 distinct paths**, assembled at runtime from `frappe.provide()` calls, direct assignments and class definitions spread across 569 source files. (Measured, not estimated — `scripts/audit-coverage.mjs` prints those numbers.) No hand-written typeset covers all of that on day one, and a package that pretended otherwise — by leaning on `any` — would be worse than none: a wrong type is more expensive than a missing one, because it is silent.

So the rules here are:

-   **Nothing is declared that was not read in frappe's source.** No signature is inferred from a name.
-   **`any` is never used as a shrug.** Genuinely open shapes are `unknown` or a documented index signature, and the doc comment says why.
-   **Coverage is measured, not claimed** — see below — and CI ratchets it so it can only go up.

If something you need is missing, that is expected at this stage. [Open an issue](https://github.com/Avunu/frappe-types/issues) with the symbol and how you call it, or send a PR — the contribution bar is "cite the frappe source".

## Maintaining it across frappe versions

Two audits, both driven by the real type checker rather than by grepping the `.d.ts` files — so they measure what the declarations actually _admit_, not how they happen to be written.

**How much of frappe do we cover?** Recovers frappe's API surface from a checkout three ways (`frappe.provide()` calls, assignments, and every path frappe's own code reads back), then probes each one against these declarations:

```bash
node scripts/audit-coverage.mjs --frappe ../frappe
node scripts/audit-coverage.mjs --frappe ../frappe --strict   # CI: fail on regression
node scripts/audit-coverage.mjs --frappe ../frappe --update-baseline
```

It prints undeclared paths ranked by how many frappe source files depend on them — which is the to-do list, in priority order.

**Can my app compile against this?** The question that actually matters day to day. Scans a consumer app for every `frappe.*` path and desk global it touches, and reports the ones that would fail:

```bash
node scripts/audit-consumer.mjs ../carbon_frappe --strict
```

Every line it prints is a compile error waiting to happen in an app built under `strict` — which is the premise of this package, and how its own scope gets set.

### Upgrading to a new frappe major

1.  Branch: `git checkout -b version-17 version-16`, bump the major and `frappe.*` metadata in `package.json`.
2.  `node scripts/audit-coverage.mjs --frappe /path/to/frappe-v17` — the diff against the previous baseline is the breaking-change report.
3.  Fix what moved, re-cite the sources, `--update-baseline`, tag `v17.0.0`.

The old branch keeps receiving fixes; `v16` stays installable.

## Contributing

-   Declarations live in `src/`, one file per frappe namespace.
-   Cite the source: `// frappe/public/js/frappe/form/grid.js:412` above anything non-obvious.
-   `npm run check` must pass with `skipLibCheck: false`. A typeset that needs `skipLibCheck` isn't one.
-   Classes that consumers subclass or prototype-patch must be `declare class`, not `interface` — `extends` and `super()` need a real class declaration.
-   Frappe uses `0 | 1` for booleans on doc fields. Model it that way where the source does.

## License

MIT © Avunu LLC

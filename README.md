# frappe-types

TypeScript definitions for the **Frappe Framework desk JS API** — the `window.frappe` global that every desk page, doctype client script, custom app bundle and theme is written against.

Frappe ships no types for the desk JS API. This package is a hand-maintained, **source-verified** typeset: every declaration is derived by reading the frappe version it targets, and carries a `file.js:line` citation back to the code it describes.

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

Checking an app's own code? There are [`tsconfig` presets](#tsconfig-presets) for compiled TypeScript (`frappe-types/tsconfig/base.json`) and for the plain JavaScript in doctype, list and report scripts (`frappe-types/tsconfig/desk-js.json`). [JSDoc](#jsdoc-in-desk-scripts) such as `/** @type {frappe.ui.form.FormEvents<"Customer">} */` type-checks in those scripts, `frm.doc` is typed from [your doctypes](#typing-your-doctypes-frappedoctypes), and web form scripts have [their own entry](#web-forms-and-website-pages-frappe-typesweb). See [Checking an app with it](#checking-an-app-with-it).

## Which version do I install?

**The package major mirrors the frappe major.** Minor and patch are this package's own.

| your frappe | install | dist-tag |
| --- | --- | --- |
| v16 | npm i -D frappe-types@^16 | latest |
| v15 | npm i -D frappe-types@^15 | v15 (not yet available) |
| develop | npm i -D frappe-types@develop | develop (not yet available) |

So `frappe-types@16.4.2` is a revision of the v16 typeset, not "types for frappe 16.4.2". `latest` therefore does not mean "newest release" — it means "the line for the current frappe major"; a maintenance release on a superseded line is published to `v<major>` and never moves `latest`. `package.json` records the exact tag each release was verified against:

```jsonc
"frappe": { "major": "16", "verifiedAgainst": "v16.50.0", "branch": "version-16" }
```

Each frappe major lives on its own branch (`version-16`, `version-15`), mirroring how frappe and frappe apps are themselves branched.

## What this is, and what it is not

**It is** the browser-side desk API: `frappe.call`, the `frappe.ui.form.*` class hierarchy, the `frappe.views.*` list/report views, `frappe.model` / `frappe.meta` and the `DocField` / doc shapes, `frappe.utils` / `frappe.dom` / `frappe.router`, `frappe.DataTable`, `frappe.Chart`, the `__()` translator, and ambient declarations for the deep imports desk apps rely on (`import Grid from "frappe/public/js/frappe/form/grid"`).

**It is not** types for frappe's Python API, for [frappe-ui](https://github.com/frappe/frappe-ui), or a hand-written model of your own doctypes — generate those from your app's doctype JSON with the bundled [`frappe-types gen-doctypes`](#generating-the-registry-frappe-types-gen-doctypes). The [`FrappeDocTypes` registry](#typing-your-doctypes-frappedoctypes) is where they plug in.

**It is not official.** It is not affiliated with or endorsed by Frappe Technologies. When frappe publishes its own types, use those.

### Coverage is partial, and says so

Frappe v16's desk namespace is **2,063 distinct paths**, assembled at runtime from `frappe.provide()` calls, direct assignments and class definitions spread across 569 source files. (Measured, not estimated — `scripts/audit-coverage.mjs` prints those numbers.) No hand-written typeset covers all of that on day one, and a package that pretended otherwise — by leaning on `any` — would be worse than none: a wrong type is more expensive than a missing one, because it is silent.

So the rules here are:

-   **Nothing is declared that was not read in frappe's source.** No signature is inferred from a name.
-   **`any` is never used as a shrug.** Genuinely open shapes are `unknown` or a documented index signature, and the doc comment says why.
-   **Coverage is measured, not claimed** — see below — and CI ratchets it so it can only go up.

If something you need is missing, that is expected at this stage. [Open an issue](https://github.com/Avunu/frappe-types/issues) with the symbol and how you call it, or send a PR — the contribution bar is "cite the frappe source".

## Checking an app with it

Three things ship next to the declarations: two `tsconfig` presets, a type-space `frappe` namespace that JSDoc can name, and a `FrappeDocTypes` registry that types `frm.doc` from your doctypes. The presets use `erasableSyntaxOnly`, so they need TypeScript 5.8 or later. The type tests run on both TypeScript 5.8 and the current release.

### tsconfig presets

| preset | for | sets |
| --- | --- | --- |
| `frappe-types/tsconfig/base.json` | TypeScript that something other than tsc compiles: frappe's esbuild, Vite, Node's type stripping | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `isolatedModules`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `skipLibCheck: false`, `lib` ES2022 + DOM, `moduleResolution: "Bundler"`, `moduleDetection: "force"`, `noEmit` |
| `frappe-types/tsconfig/desk-js.json` | the plain JavaScript an app ships uncompiled: `<doctype>.js`, `<doctype>_list.js`, query report and page scripts, `doctype_js` overrides | everything in `base.json`, plus `allowJs`, `checkJs` and `types: ["frappe-types/global"]` |

```jsonc
// tsconfig.json: compiled TypeScript (bundles under public/js)
{
  "extends": "frappe-types/tsconfig/base.json",
  "compilerOptions": { "types": ["frappe-types/global"] },
  "include": ["myapp/public/js/**/*.ts", "types/**/*.d.ts"]
}
```

```jsonc
// tsconfig.desk.json: uncompiled desk JavaScript
{
  "extends": "frappe-types/tsconfig/desk-js.json",
  "include": [
    "myapp/**/doctype/**/*.js",
    "myapp/**/report/**/*.js",
    "myapp/**/page/**/*.js",
    "myapp/public/js/doctype_js/**/*.js",
    "types/**/*.d.ts"
  ]
}
```

`base.json` leaves `types` to you, because a browser bundle wants `frappe-types/global` and a build script wants `node`. `include` is always yours: paths in an extended config resolve against the file that declares them, which is inside `node_modules`. Check with `tsc -p tsconfig.desk.json`. Nothing is emitted.

`moduleDetection: "force"` is right for desk scripts as well. frappe runs each one inside its own function (`new Function(script)()`, in `form/script_manager.js` for doctype scripts and in `frappe.dom.eval` for report scripts), so one file's top-level names never reach another file.

### JSDoc in desk scripts

`frappe` is a value at runtime. For JSDoc it is also a namespace of types, so you can write `@type {frappe.ui.form.FormEvents<"Customer">}`. The namespace is installed with `frappe-types/global` and declares only types, so it merges with the `frappe` global without changing it. Most of the time you don't need an annotation, because `frappe.ui.form.on` infers the doctype from its first argument:

```js
// customer.js
frappe.ui.form.on("Customer", {
  refresh(frm) {
    // frm is frappe.ui.form.Form<"Customer">; frm.doc comes from FrappeDocTypes["Customer"]
    if (frm.doc.disabled) frm.set_intro(__("This customer is disabled"));
  },
  validate(frm) {
    if (!frm.doc.customer_name) frappe.validated = false;
  },
  customer_group(frm, cdt, cdn) {
    // a field-change handler, called as (frm, cdt, cdn)
  },
});
```

Annotate when the map is built separately, or for list, report and helper code:

```js
/** @type {frappe.ui.form.FormEvents<"Customer">} */
const events = { onload(frm) { /* … */ } };
frappe.ui.form.on("Customer", events);

/** @param {frappe.ui.form.Form<"Customer">} frm */
function set_queries(frm) { /* … */ }
```

```js
// customer_list.js. List rows hold only the fields the view fetched, so every
// registered field is optional on `doc`.
/** @type {frappe.views.ListViewSettings<"Customer">} */
const settings = {
  add_fields: ["disabled"],
  get_indicator(doc) {
    return doc.disabled ? [__("Disabled"), "gray", "disabled,=,1"] : [__("Active"), "green", "disabled,=,0"];
  },
};
frappe.listview_settings["Customer"] = settings;
```

```js
// sales_summary.js, a query report
/** @type {frappe.views.QueryReportSettings} */
const report = {
  filters: [{ fieldname: "company", label: __("Company"), fieldtype: "Link", options: "Company" }],
  formatter(value, row, column, data, default_formatter) {
    return default_formatter(value, row, column, data);
  },
};
// frappe.query_reports is typed optional because it does not exist until the report bundle
// loads. frappe.provide returns it, typed, and creates it if it is missing:
frappe.provide("frappe.query_reports")["Sales Summary"] = report;
```

The namespace provides `frappe.Doc<DT>`, `frappe.ListDoc<DT>`, `frappe.DocType`, `frappe.FieldName<DT>` and `frappe.FieldValue<DT, F>`. It also provides `frappe.ui.Dialog`, `DialogOptions`, `FieldGroup`, `FieldGroupOptions` and `Page`; `frappe.ui.form.Form<DT>`, `FormEvents<DT>`, `FormEventHandler`, `StandardFormEvents`, `Controller`, `Control` and `ControlOptions`; and `frappe.views.ListViewSettings<DT>`, `ListView`, `ReportView`, `QueryReport`, `QueryReportSettings`, `QueryReportColumn` and `QueryReportFilter`. Each is an alias of a named export of `frappe-types`, so compiled TypeScript can import the same types instead (`import type { FormEvents } from "frappe-types"`).

Some rules about form events. Each one matches what frappe does at runtime:

- **Every function in the map is an event handler.** frappe registers each function-valued key of the map under that key's name, and it calls each one as `(frm, cdt, cdn)`. That includes a helper you only call through `frm.trigger("helper")`. A handler whose second parameter is not a string is therefore an error. Put helpers with other signatures outside the map.
- **Child-table events run on the parent's form.** `frappe.ui.form.on("Sales Order Item", { qty(frm, cdt, cdn) {} })` receives the Sales Order form. Your registry tells the types which parent that is (next section). For an unregistered child doctype, `frm` is a plain `Form`.
- **Registering a doctype makes its document closed.** On a registered doctype, `frm.doc.custmer_name` is an error instead of an `unknown`, and `frm.set_value("status", "Typo")` is checked against the field's type. `set_value` takes only the doctype's own fields: frappe throws on a standard field such as `name` or `idx`, because those are not in the form's layout. On a child table with several parents, `set_value` takes only the fields every parent has. Unregistered doctypes keep the open `FrappeDoc` and the open `set_value`, so existing code keeps compiling.

### Typing your doctypes: `FrappeDocTypes`

`FrappeDocTypes` is a global interface, empty in this package, that you extend with your doctypes. Each property is keyed by the doctype's name exactly as frappe spells it. Its value lists the doctype's data fields: no layout fields, and no standard fields, because `name`, `owner`, `modified`, `docstatus`, `idx` and the `__*` client flags are added for you. Type a Table field as `FrappeChildRow<"Child DocType">[]`, not as the child's bare entry, so its rows get the standard row fields (`name`, `idx`, `doctype`, `parent`, `parentfield`) too.

```ts
// types/doctypes.d.ts. This is a script (no import/export), so the interface merges directly.
interface FrappeDocTypes {
  Customer: {
    customer_name: string;
    customer_group: string;
    disabled: 0 | 1;
    credit_limits: FrappeChildRow<"Customer Credit Limit">[];
  };
  // A child table names its parent doctype(s) in `parenttype`. That is how
  // FormEvents<"Customer Credit Limit"> knows `frm` is the Customer form.
  "Customer Credit Limit": {
    parenttype: "Customer";
    company: string;
    credit_limit: number;
  };
}
```

In a file that is a module, wrap the same block in `declare global { … }`. `Check` fields are `0 | 1`. Fields that can be empty should include `null`: frappe stores an empty Link, Data or Date as `null` or leaves it out. Custom Fields are not in a doctype's JSON, so add any your code reads to the entry yourself. Interface merging lets a second declaration add them.

The registry is shared by both entry points, `frappe-types/global` and the module entry, so one declaration types `frappe.ui.form.on(...)` in desk JavaScript and `Form<"Customer">` in compiled TypeScript. `Form<"Customer">` is still assignable to `Form`, and a registered document is still assignable to `FrappeDoc`, so APIs typed against the open shapes accept the typed ones. A `FrappeChildRow` is also assignable to `ChildDoc`, so `frappe.model.set_value(row.doctype, row.name, "qty", 1)` compiles for a row of `frm.doc.credit_limits`.

### Generating the registry: `frappe-types gen-doctypes`

Writing the registry by hand is fine for a few doctypes. For a whole app, the package ships a command that writes it from the files `bench migrate` reads: the DocType JSON of your app (and, if you ask, its sibling apps), plus the Custom Fields and Property Setters the apps ship.

```bash
npx frappe-types gen-doctypes --bench ~/frappe-bench --app my_app --out types/doctypes.d.ts
npx frappe-types gen-doctypes --bench ~/frappe-bench --app my_app --include-siblings erpnext,hrms --out types/doctypes.d.ts
```

The output follows the registry contract above: one `export interface` per DocType that lists its data fields and nothing else, registered by DocType name. Table fields are `FrappeChildRow<…>[]`, and a child DocType's `parenttype` names every DocType on the bench with a Table of it, so child-table events get the right parent form.

```ts
// types/doctypes.d.ts: an excerpt of test/fixtures/gen-doctypes/expected/my_app.d.ts
// Generated by `frappe-types gen-doctypes`. Do not edit; re-run the generator.
//   --app my_app
//   DocType JSON read from: base_app, my_app
//   customisations read from: my_app
import type * as $ft from "frappe-types";

declare global {
	interface FrappeDocTypes {
		"Sales Order": SalesOrder;
		"Sales Order Item": SalesOrderItem;
	}
}

export interface SalesOrder {
	/** Status · Select */
	status?: "Draft" | "On Hold" | "Completed" | "" | null;
	/** Is Return · Check */
	is_return?: 0 | 1;
	/** Grand Total · Currency */
	grand_total?: number | null;
	/** Items · Table → Sales Order Item */
	items: FrappeChildRow<"Sales Order Item">[];
	/** Delivery Run · Link → Delivery Run · Custom Field, my_app/my_app/my_app/custom/sales_order.json */
	custom_delivery_run?: string | null;
}

export interface SalesOrderItem {
	/** The DocTypes on this bench with a Table of Sales Order Item: the forms its events run on. */
	parenttype: "Delivery Run" | "Sales Order";
	/** Quantity · Float */
	qty?: number | null;
}
```

Add the file to the `include` of the tsconfig that checks your code (the preset examples above already include `types/**/*.d.ts`). From then on `frm.doc` in `frappe.ui.form.on("Sales Order", …)`, `frappe.ui.form.FormEvents<"Sales Order">` in JSDoc and `DocOf<"Sales Order">` in TypeScript are the closed document: the standard fields from frappe-types plus the fields above. The interfaces are the registry ENTRIES, not whole documents; reach for `DocOf<…>` (or `frappe.Doc<…>` in JSDoc) when you want a document type.

| option | |
| --- | --- |
| `--bench` | a bench (the folder holding `apps/`) or an apps directory |
| `--app` | the app to type: its DocTypes, and the customisations it ships |
| `--include-siblings` | more apps to type in full and take customisations from, comma-separated, in the order the site installed them |
| `--out` | write here instead of stdout |
| `--check` | write nothing; exit 1 if `--out` is missing or differs (for CI) |
| `--strict` | exit 1 if anything had to be typed loosely (see below) |
| `--quiet` | do not print warnings |

**What it reads** is what `bench migrate` reads, found the same way: the modules in `<app>/modules.txt`, every `<module>/doctype/<name>/<name>.json` in them, Custom Fields and Property Setters from `<module>/custom/*.json`, and `Custom Field` / `Property Setter` records in `<app>/fixtures/*.json`. A DocType the app customises, or a child DocType any emitted DocType's table names, is pulled in from whichever app on the bench defines it, so `--app my_app` alone types `custom_*` fields on erpnext's Customer without typing all of erpnext.

**When two customisations touch the same thing,** the one frappe syncs last wins, in frappe's order: `custom/` files without `sync_on_migrate` (applied only when their app is installed), then every app's `fixtures/`, then every app's `custom/` files with `sync_on_migrate`. Within each step the apps go in install order, which the generator takes to be the `--include-siblings` apps as listed and then `--app`, the app that depends on them. So a sibling never overrides the target app's own setter of the same kind, but a sibling's `sync_on_migrate` file does override the target app's fixture, just as it does on the site.

**How fields are typed.** Each rule is checked against the pinned frappe's own source by `test/gen-doctypes.test.mjs`, which runs in CI, so a frappe release that adds or reclassifies a fieldtype, or changes what a desk control writes, fails the build instead of being typed wrong. Citations for each rule are in the header of [`bin/gen-doctypes.mjs`](bin/gen-doctypes.mjs).

| fieldtype | type | why |
| --- | --- | --- |
| Section/Column/Tab Break, HTML, Button, Image, Fold, Heading, Attachment Gallery | not emitted | `no_value_fields`: no column, no value |
| Table, Table MultiSelect | `FrappeChildRow<Child>[]`, required | initialised to `[]` on a new doc and on load |
| Check | `0 \| 1` | a tinyint, coerced to 0/1 on save; the desk control always writes 0 or 1 |
| Int, Long Int, Float, Currency, Percent, Rating | `number \| null` | clearing the input in the form writes `null` into `frm.doc` (the numeric controls' `parse`), even where the column is NOT NULL |
| Duration | `number \| null` | a nullable column |
| Select | `"A" \| "B" \| ""` (+ `\| null`) | the options after Property Setters; `""` skips validation. `naming_series` and option-less Selects are `string`. See the note below |
| JSON | `unknown` | a string from MariaDB, a parsed value from Postgres |
| everything else (Data, Link, Date, Datetime, Text, ...) | `string \| null` | varchar/text/date columns |

Every value field is optional (`?:`): a doc created in the browser carries only the fields that had a default. `null` is dropped only where neither the column nor the desk control can hold it: Check, and a non-numeric field with `not_nullable`. That is stricter than frappe's own Python type exporter, which also drops it for `reqd` fields: `reqd` is enforced on save, not by the column, so old rows and `ignore_mandatory` inserts still read back NULL, and the field is empty in the browser until the user fills it in.

**A Select's union is what a save accepts, not everything the column can hold.** frappe validates the options when a document is saved, but the Data Import tool skips that validation (it sets `frappe.flags.in_import`), `db_set` and `frappe.db.set_value` never run it, and rows saved before an options change, such as a Property Setter that drops an option, keep their old value. The union is kept closed anyway, because it is exactly what code that writes the field must use. When you read a Select from documents that may predate an options change or come from an import, handle a value outside the union.

**Limits.**

- **One generated file per program.** The registry maps each DocType name to one interface, so two generated files that both register `"Customer"`, or both reach a shared child table such as `Has Role`, are conflicting declarations of the same property (TS2717). To type code that needs several apps, generate ONE file for all of them with `--include-siblings`. An app that ships its generated file to other apps cannot combine it with theirs.
- **Customisations made in the database** (Customize Form, a Custom Field created in the UI) are in no file and cannot be seen, and a registered document is closed, so reading one is a compile error. Export them as fixtures to have them generated, or add them by augmenting the generated module from a `.d.ts` file of your own:

  ```ts
  // types/doctypes-extra.d.ts
  export {};
  declare module "./doctypes" {
  	interface SalesOrder {
  		custom_added_in_the_ui?: string | null;
  	}
  }
  ```
- **`autoname: autoincrement`** DocTypes have a numeric `name` on the wire; the registry types it `string`. The interface's doc comment says so.
- **`parenttype`** lists the DocTypes whose JSON on this bench has a Table of the child. A parent that exists only in the database, or in an app that is not on the bench, is missing from it.
- **Loose spots are warnings**: a fieldtype the generator does not know (typed `unknown`), a table whose child DocType is on no app on the bench (typed `ChildDoc[]`), a Custom Field on a DocType nothing defines (its custom fields only). `--strict` turns them into a non-zero exit.
- **TypeScript module resolution.** The output imports `frappe-types`, whose declaration files use extensionless relative imports. They resolve under `moduleResolution: "Bundler"` (what the presets set, and what `module: "Preserve"` implies), but not under `"NodeNext"`/`"Node16"` with `skipLibCheck: false`, which reports TS2834 inside the package. Check desk code with the presets.

Keep the file in version control and check it in CI so it cannot drift from the JSON:

```bash
npx frappe-types gen-doctypes --bench ../.. --app my_app --out types/doctypes.d.ts --check --strict
```

`--check` is a byte comparison: the output is deterministic (sorted, no timestamps, no absolute paths). But it is deterministic **given the bench**. The output depends on every app on the bench, not only on your app's JSON: customised and child DocTypes are pulled in from whichever app defines them, and a child's `parenttype` lists the parents found in every app. So the bench CI runs `--check` on must hold the same apps, at the same branches, as the bench the file was generated on. The header names the apps whose DocType JSON and customisations went into the file, which is the first thing to compare when `--check` fails on CI but not locally. A sibling missing from the CI bench also shows up in the warnings `--check` prints (a customised DocType or a child table that no app on the bench defines). `--strict` makes those warnings fail the run on their own, so a file generated on an incomplete bench cannot pass either.

The command is plain JavaScript with no dependencies, so it runs from `node_modules` with the node you already have (node refuses to strip TypeScript types under `node_modules`, which rules out shipping it as `.ts`); its JSDoc is type-checked by `tsconfig.bin.json` as part of `npm run check`. `checks.types` runs the packed command, from the file list `npm pack` would ship, against the fixture bench and compiles its output with both presets.

### Web forms and website pages: `frappe-types/web`

```jsonc
// tsconfig.web.json
{
  "extends": "frappe-types/tsconfig/desk-js.json",
  "compilerOptions": { "types": ["frappe-types/web"] },
  "include": ["myapp/**/web_form/**/*.js", "myapp/www/**/*.js"]
}
```

This entry includes everything in `frappe-types/global`. It also adds what frappe defines on a website page: `frappe.ready` and `frappe.ready_events`. On a web form page it adds `frappe.web_form` (the `WebForm` controller, with `on(fieldname, handler)`, `events`, and the `validate` / `after_load` / `after_save` hooks a client script assigns), `frappe.web_form_doc`, `frappe.reference_doc`, `frappe.init_client_script` and `frappe.form_dirty`.

```js
frappe.web_form.on("rating", (field, value) => {
  if (typeof value === "number" && value < 3) frappe.web_form.set_df_property("comments", "reqd", 1);
});

frappe.web_form.validate = () => {
  const values = frappe.web_form.get_values();
  return Boolean(values && values["email"]);
};
```

Two caveats:

- **Not every desk name exists on a website page.** The website bundle carries only part of the desk API, and this entry does not take the rest away. If a web script calls something only the desk has, such as `frappe.views.ListView`, it type-checks and then fails at runtime. Keep web scripts in their own tsconfig, as above.
- **Read `is_new` from `frappe.web_form_doc`.** frappe copies `web_form_doc` onto the controller, but that object carries `is_new` only on `/new`. On every other route `frappe.web_form.is_new` is the inherited `FieldGroup#is_new` method, which is always truthy. The types model this.

## Maintaining it across frappe versions

Two audits, both driven by the real type checker rather than by grepping the `.d.ts` files — so they measure what the declarations actually _admit_, not how they happen to be written.

**How much of frappe do we cover?** Recovers frappe's API surface from a checkout three ways (`frappe.provide()` calls, assignments, and every path frappe's own code reads back), then probes each one against these declarations:

```bash
nix flake check -L                    # everything below, against the pinned frappe
nix develop -c npm run coverage       # the report, in a shell that exports FRAPPE_PATH
nix develop -c npm run coverage -- --update-baseline
```

**Which frappe?** The one `flake.nix` pins — `inputs.frappe`, a non-flake input at `github:frappe/frappe/version-16`, with the exact revision in `flake.lock`. That pin is the single declaration of what this branch is types _for_, and everything the package claims about itself (the coverage number, `frappe.verifiedAgainst`, "verified against frappe source") is a claim about that tree. It moves only through a reviewable [dependabot](.github/dependabot.yml) pull request, which runs these same checks on the proposed revision.

Before the pin, the audit went looking for a checkout: `../frappe` is tried before the bench, so on a machine that also has a `develop` clone it silently measured the v16 typeset against frappe 17.0.0-dev and reported a three-path "regression" that did not exist. Outside Nix the scripts still resolve a checkout and still take `--frappe`/`FRAPPE_PATH`, and they now refuse a cross-major one outright rather than reporting it as a regression — see `--cross-major` under _Upgrading to a new frappe major_. Inside `nix develop`, `FRAPPE_PATH` is already the pin, so the question does not arise.

`nix flake check` runs seven checks, each its own derivation so a failure names itself:

| check | asserts |
| --- | --- |
| typecheck | tsc --noEmit with skipLibCheck: false |
| types | the consumer fixtures in `test/types/` (presets, JSDoc, registry, web entry, and the output of the packed `gen-doctypes`) pass `tsc -p` against the files `npm pack` would ship |
| coverage | the ratchet against the pinned frappe |
| frappe-major | the package major is the frappe major |
| verified-against | package.json's frappe.verifiedAgainst matches the pin |
| unit | `npm run test:unit`, including the doctype generator's rules against the pinned frappe |
| drift | `audit:drift --strict` against the pinned frappe and drift-baseline.json (below) |

`nix build` produces the tarball npm would publish, for inspecting exactly what ships. Whether `files` ships what consumers need is asserted by `checks.types`, which builds its scratch package from `npm pack`'s file list, requires the presets, the web entry and both `bin/` files to be in it, and runs the packed command. It is not how a release is published: `publish.yml` runs `npm publish` so that OIDC trusted publishing and the provenance attestation apply.

It prints undeclared paths ranked by how many frappe source files depend on them — which is the to-do list, in priority order.

**Has frappe moved since we verified it?** A third audit, and the only one that does not involve the type checker. `scripts/audit-drift.mjs` parses a frappe tree for the places an app depends on _structurally_ rather than through a function signature — which stylesheets each `*.bundle.scss` imports, what `hooks.py` puts in its include lists, which ids the icon sprites define (and whether the octicons and FontAwesome directories are still there), which `*.bundle.*` entry files exist, which keys `boot.py` assigns on `bootinfo` — and compares that snapshot with `drift-baseline.json`, the same snapshot taken at the tag `frappe.verifiedAgainst` names. It also scans `src/` for `frappe/<path>:<line>` citations and reports the cited files that no longer exist and, when it has git history to ask, how many cited lines now read differently and which cited files changed most.

```bash
npm run audit:drift                                       # the checkout vs drift-baseline.json; works on a plain source tree
npm run audit:drift -- --from v16.33.1                    # vs any tag of a clone: adds line-anchor drift and per-file churn
npm run audit:drift -- --from v16.33.1 --report md        # the same, as a DRIFT.md section
npm run audit:drift -- --from v16.33.1 --ids              # adds which sprite ids appeared and vanished
npm run audit:drift -- --at v16.50.0 --from v16.33.1      # compare two tags without checking either out
node scripts/audit-drift.mjs --at v16.33.1 --update-baseline   # re-record the baseline from a tag
```

[`DRIFT.md`](DRIFT.md) is the ledger of those reports, one section per frappe span, and says what it can and cannot tell you.

**`verified-against` and `audit:drift` answer different questions.** `verified-against` asks whether `package.json`'s claim names the tag the flake pins — a comparison of two strings, which holds the moment anyone makes them equal. `audit:drift` asks whether the things the declarations stand on have changed since that tag — a structural comparison of frappe's own files, which never looks at a version string. A dependabot bump can satisfy the first while the second shows drift, and a bump that moves nothing structural can fail the first while the second is clean. Neither re-verifies a declaration: a clean drift report means frappe's _structure_ did not move, not that the types are right, and a dirty one means a human should re-read the changed frappe files. When they hold, bump `frappe.verifiedAgainst` and re-record the drift baseline in the same commit — `audit:drift` prints a note when the two name different tags.

Exit status is 0 unless `--strict` is given and there is drift: a surface that differs from the baseline, or a cited file that is gone. Line anchors that now read differently are reported and never fail a run — after a few hundred frappe commits most of them will, and that list is the triage queue, not a gate. Two limits are worth knowing before trusting a clean run: only citations written as a full `frappe/<path>` are checked (a relative `grid.js:412` takes its base from prose in the file's header, so it is counted as "not checked" and never guessed at), and only the `@import`s written directly in each entry file are compared, not what `./desk/index` pulls in.

Drift is a CI signal, not something to remember: `checks.drift` in `flake.nix` runs it against the pinned tree with `--strict`. The flake's frappe input has no git history, so this compares with the baseline — which is what the baseline is for — and it needs nothing beyond the pin and the repository, so it is deterministic and offline:

```nix
drift = mkCheck "drift" "node scripts/audit-drift.mjs --frappe ${frappe} --strict";
```

Expect it to go red whenever the pin moves past something that mattered — typically a dependabot bump of the `frappe` input — and to stay red until the affected frappe files have been re-read, `frappe.verifiedAgainst` bumped and the baseline re-recorded, all in that same pull request. The unit tests (`npm run test:unit`, also part of `npm test`, and `checks.unit`) need no frappe checkout; the generator's tests against frappe itself run when `FRAPPE_PATH` names one of this branch's major (the flake sets it to the pin), and the ones that build a throwaway git repository skip themselves when `git` is not on `PATH` (the flake's checks provide only `nodejs` and the npm config hook).

**Can the citations be moved rather than re-read?** Mostly. Between two tags most cited lines did not change, they only moved: frappe inserted lines above them. `scripts/remap-citations.mjs` asks `git diff -U0` what became of each cited line and separates the two cases exactly. A line no hunk touches is the same text at a computable number, and the tool re-reads both blobs to check that before it reports the mapping as exact. A line inside a hunk was modified or deleted; the tool gives it no number, and lists it with its old text and, labelled as guesses, the nearest lines of the new file.

```bash
npm run remap:citations -- --new-tag v16.50.0 --cache-dir /tmp/remap       # dry run: the report, per declaration file
npm run remap:citations -- --new-tag v16.50.0 --flagged-json flagged.json  # + one record per citation a person must look at
npm run remap:citations -- --new-tag v16.50.0 --apply                      # rewrite the numbers that mapped exactly
npm run remap:citations -- --new-tag v16.50.0 --apply --stamp              # AFTER review: also re-stamp the headers
```

- **Which tag a file's numbers follow** is read from its header (`Verified against frappe v16.33.0`), else `frappe.verifiedAgainst`, and printed per file. `--cache-dir` keeps `git show` / `git diff` results between runs; entries are keyed by commit, never by tag name.
- **`--apply` changes digits and nothing else**, and only in a citation whose every number mapped exactly. A range is exact when both ends are and nothing material (anything but re-indentation or blank lines) changed between them; a list (`:44,61,70`) when every item is. A file git reports renamed is followed when it is at least `--min-rename-similarity` (70) percent alike, but if the citation names the old path it is flagged instead, because the path is prose and only numbers are edited.
- **Which file does a bare `grid.js:412` mean?** `scripts/lib/citation-bases.json`: per declaration file, the base its header declares, the names it uses for another owner's files (carbon_frappe, frappe-datatable, bootstrap, ...), and the few it must pin. Each entry quotes what the header says, or says there is nothing to quote. A name that is still ambiguous under the base is resolved only if the declaration itself names exactly one candidate in full somewhere; otherwise it is reported as unresolved and never guessed. A file-less `:127` is edited only where it continues a citation (`file.js:5, :127`, `:332 / :364`, `:412 + :416-419`) or where the config says the header does (`notifications.d.ts`); otherwise it is counted as "file-less" and left alone.
- **A path with no number is checked too.** `form/sidebar/document_follow.js` written with no line (the 66 full-path ones and the directory-qualified bare ones) has nothing to move, but the file can be deleted; each is resolved the same way and reported when it is gone at the new tag (or renamed to something the text no longer names). Judged against the header's tag on every run, so it keeps being reported until the file is re-read and stamped.
- **Idempotent, without stamping.** After `--apply` a file holds numbers for two tags (the new one, and the old on each flagged citation) while its header still, correctly, names the old one. `citation-anchors.json` records which is which, so a second run finds nothing to do and a flagged citation stays flagged until someone edits it. It is not a verification record: `Verified against` changes only under `--stamp`, which asserts that the flagged citations were re-read, drops the file's ledger entry, and touches the header and nothing below it. `audit:drift` reads the same file and leaves moved citations out of its "line anchors that differ" count, which would otherwise compare their new numbers with the old tag and report text that merely moved as text that changed.
- **What it cannot do:** decide that a changed line still means the same thing (that is the flagged list), or know what an author meant when the number was already a line or two off at the old tag. The tool preserves what a number pointed at, not what it was meant to point at.

**Can my app compile against this?** The question that actually matters day to day. Scans a consumer app for every `frappe.*` path and desk global it touches, and reports the ones that would fail:

```bash
node scripts/audit-consumer.mjs ../carbon_frappe --strict
```

Every line it prints is a compile error waiting to happen in an app built under `strict` — which is the premise of this package, and how its own scope gets set.

### Upgrading to a new frappe major

1.  Branch: `git checkout -b version-17 version-16`. Point `inputs.frappe.url` in `flake.nix` at `github:frappe/frappe/version-17` and run `nix flake lock --update-input frappe`, then set `frappe.major`, `frappe.branch` and `frappe.verifiedAgainst` in `package.json` to match. Leave `version` alone — release-please owns it. (`checks.verified-against` fails until `verifiedAgainst` agrees with the new pin, and prints the exact value to paste.)
2.  In the **same** push, land a commit carrying a `Release-As: 17.0.0` footer. That is the _only_ way the major moves: `npm run check:major` fails any release whose major disagrees with `frappe.major`, so a stray `feat!:` cannot do it by accident (see [Releasing](#releasing)).
3.  `node scripts/audit-coverage.mjs --frappe /path/to/frappe-v17 --cross-major` — the diff against the previous baseline is the breaking-change report. `--cross-major` is required: without it the audit refuses to measure a v17 checkout against a typeset whose `frappe.major` is still 16, because the resulting numbers look like a coverage regression and are not one. It reports only — no ratchet, no baseline write.
4.  Fix what moved, re-cite the sources, `--update-baseline` — and re-record the drift baseline too (`node scripts/audit-drift.mjs --at <tag> --update-baseline`), after reading its report against the old one.

Step 2 is second, and not later, because the new branch inherits a `.release-please-manifest.json` still reading `16.0.x`. An ordinary `fix:` landing before the `Release-As:` commit therefore makes release-please propose **16.0.x** on a tree whose `frappe.major` is already `17` — and the guard fails, because it is symmetric and catches the undershoot too. That is the check working, not breaking; land the `Release-As: 17.0.0` commit and the release pull request rewrites itself on the next run.

The old branch keeps receiving fixes; `v16` stays installable, and its releases go to the `v16` dist-tag once v17 holds `latest`.

## Releasing

Releases are cut by [release-please](https://github.com/googleapis/release-please). Nobody edits `version` by hand, and there is no `npm publish` from a laptop.

1.  Land conventional commits on the release branch (`fix:` -> patch, `feat:` -> minor). Anything else is left out of the changelog.
2.  release-please keeps an open **release pull request** with the next version and the accumulated changelog. Merging it _is_ the release: `.github/workflows/release-please.yml` tags `v16.1.0`, cuts the GitHub release, and — in that same run — calls `publish.yml` directly. It has to be a direct call: release-please creates the tag with `GITHUB_TOKEN`, and GitHub raises no workflow-triggering events for its own token, so `on: push: tags` and `on: release` would simply never fire.
3.  `publish.yml` re-checks the major, type-checks the tree, and runs `npm publish --provenance` under **OIDC trusted publishing** — no npm token exists in this repository, and the published tarball carries a signed provenance statement linking it to the workflow run and commit that built it. It is idempotent: a version already on the registry is skipped, so re-running a release is safe.

The dist-tag is derived at publish time from the version and the registry's current `latest`, so a 16.x release cut after v17 exists lands on `v16` rather than stealing `latest`. If the registry cannot be read, the publish **fails** rather than guessing — a wrong `latest` is not re-runnable (see the last bullet under Prerequisites).

**The major never moves on its own.** The major is the frappe major, so a `feat!:` subject or a `BREAKING CHANGE:` footer proposing 17.0.0 is a bug, not a release. `release-please.yml`'s `guard-major` job checks the version release-please has written onto its release branch, in the same run that opens or updates the release pull request, and fails loudly there — plus it posts a `frappe-major (release PR)` commit status so the verdict shows up in the pull request's own checks list. `publish.yml` re-runs the same check immediately before `npm publish` as a last line of defence. Note where the gate is **not**: `check.yml`'s `flake` job runs on `pull_request` and covers human pull requests, but release-please's PR is authored by `GITHUB_TOKEN`, and GitHub parks `pull_request` runs from `GITHUB_TOKEN`\-authored pull requests in `action_required` behind an "Approve workflows to run" banner — a check nobody approved is pending, and pending blocks nothing. Breaking type changes ship as minors on the line they belong to. `scripts/check-frappe-major.mjs` carries the full rationale and the recovery steps.

### Prerequisites, and things that are not in this repository

-   **GitHub: "Allow GitHub Actions to create and approve pull requests"** must be ON (Settings -> Actions -> General -> Workflow permissions). `contents: write` + `pull-requests: write` in the workflow is necessary but not sufficient; that checkbox is off by default for organization-owned repositories, and without it the very first release-please run dies at PR creation with `GitHub Actions is not permitted to create or approve pull requests` — which reads like a bug in the workflow and is not one. Re-check it on any future `version-N` fork of the repo settings.
-   **npm: the trusted publisher must name `release-please.yml`**, not `publish.yml`. npm validates the workflow that _initiates_ the run, not the file containing `npm publish`, and `publish.yml` is reached through `workflow_call`. The filename is case-sensitive, `.yml` included, and npm does not validate the configuration when you save it — a mismatch surfaces only as an opaque `ENEEDAUTH`/401 at publish time. A package may have only one trusted publisher, which is why the manual backfill button lives on `release-please.yml` (its `publish_sha` input) rather than on `publish.yml`.
-   **Merge the adoption commit with a merge commit or a rebase, not a squash under a non-conventional title.** The manifest is seeded one version behind on purpose so the two pending `fix:` subjects produce `16.0.1` with a changelog. Squash-merging them under a title like "Adopt release-please" collapses them into one unparseable commit: release-please opens no release pull request at all, and `package.json` sits at 16.0.1 against a manifest of 16.0.0 indefinitely. If it must be a squash, make the squash title itself a `fix:` subject.
-   **Think twice before making `check.yml`'s `flake` job a _required_ status check on `version-*`.** It looks like the obvious belt-and-braces and it has a sharp edge: every `pull_request` run on release-please's own pull request is parked in `action_required`, so a required check there is permanently pending and the release pull request cannot be merged until someone clicks "Approve and run" on it, every single time. That is a defensible policy — it turns "silently un-run" into "cannot merge" — but choose it deliberately, and know that it is a click per release and not a free win. It is not what guards the major: `guard-major` in `release-please.yml` does that, and it needs no approval because it runs on a push.
-   **`"separate-pull-requests": true`, even though there is exactly one package.** Setting it `false` (the natural-looking choice for a single-package repo) is a real bug for this specific shape of config, not just a style preference — it broke the very first release and required manual recovery. With it `false`, PR creation goes through release-please's GROUPED code path, which for a single package produces a branch (`release-please--branches--version-16`, no component) and title (`chore: release version-16`, the literal branch name) that carry no per-package identity. Post-merge, though, `Strategy.buildReleases()` validates a single-release PR through the STANDALONE code path, which compares the branch's (absent) component against `package-name`'s configured one ("frappe-types") — a mismatch that can never resolve, because a Node strategy's default component is unconditionally `package.json`'s `name` field, so it is never actually empty. The result: `buildReleases()` silently refuses to tag the release forever, the PR's `autorelease: pending` label never flips to `tagged`, and every subsequent run aborts with "There are untagged, merged release PRs outstanding" before even attempting a new release PR — which is what happened to `v16.0.1` (traced against release-please 17.6.0's source; see the fix commit for the full analysis). `separate-pull-requests: true` uses the standalone path for BOTH creation and validation, so the branch and title always carry the component and the two sides agree — confirmed live: the next release opened as `chore(version-16): release 16.1.0` off branch `release-please--branches--version-16--components--frappe-types`, merged and tagged cleanly. It costs nothing for a single package — tags are unaffected (gated independently by `include-component-in-tag`) — and it is required, not optional, the moment `package-name` (or an explicit `component`) is set on a manifest package.
-   **There is no CI route to repair a wrong dist-tag.** npm's OIDC exchange is called from exactly one place in the CLI — `npm publish` — so `npm dist-tag add` cannot use trusted publishing. With no token anywhere in this repository (which is the point), moving a dist-tag back means an interactive `npm login` as a package owner. That asymmetry is why the dist-tag logic fails closed.
-   **Optional hardening:** npm's trusted-publisher configuration accepts an environment name. Putting the publish job in a GitHub Environment with required reviewers, and recording that environment on npmjs.com, adds a review step to the manual backfill path — which today lets anyone with write access publish an arbitrary ref — and costs nothing on the automated path.

## Contributing

-   Declarations live in `src/`, one file per frappe namespace.
-   Cite the source: `// frappe/public/js/frappe/form/grid.js:412` above anything non-obvious.
-   `npm run check` must pass with `skipLibCheck: false`. A typeset that needs `skipLibCheck` isn't one.
-   `npm run test:types` checks the consumer fixtures in `test/types/` against the packed package. A change to how a consumer writes code (a preset, the JSDoc namespace, the registry) gets a fixture there. Write its negative cases as `// @ts-expect-error` lines.
-   Classes that consumers subclass or prototype-patch must be `declare class`, not `interface` — `extends` and `super()` need a real class declaration.
-   Frappe uses `0 | 1` for booleans on doc fields. Model it that way where the source does.
-   The `frappe-types` command lives in `bin/` and ships as plain JavaScript with JSDoc types and no dependencies, because node will not strip TypeScript types under `node_modules`. `npm run check` type-checks it through `tsconfig.bin.json`; its fieldtype rules cite frappe in the file header and are tested against the pinned frappe (`test/gen-doctypes.test.mjs`).
-   Commit subjects are [conventional commits](https://www.conventionalcommits.org/) — they are the changelog and they choose the version. Never `!` or `BREAKING CHANGE:`: see [Releasing](#releasing).

## License

MIT © Avunu LLC

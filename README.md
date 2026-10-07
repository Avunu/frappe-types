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

**It is not** types for frappe's Python API, for [frappe-ui](https://github.com/frappe/frappe-ui), or a hand-written model of your own doctypes — generate those from your app's doctype JSON with the bundled [`frappe-types gen-doctypes`](#typing-your-doctypes).

**It is not official.** It is not affiliated with or endorsed by Frappe Technologies. When frappe publishes its own types, use those.

### Coverage is partial, and says so

Frappe v16's desk namespace is **2,063 distinct paths**, assembled at runtime from `frappe.provide()` calls, direct assignments and class definitions spread across 569 source files. (Measured, not estimated — `scripts/audit-coverage.mjs` prints those numbers.) No hand-written typeset covers all of that on day one, and a package that pretended otherwise — by leaning on `any` — would be worse than none: a wrong type is more expensive than a missing one, because it is silent.

So the rules here are:

-   **Nothing is declared that was not read in frappe's source.** No signature is inferred from a name.
-   **`any` is never used as a shrug.** Genuinely open shapes are `unknown` or a documented index signature, and the doc comment says why.
-   **Coverage is measured, not claimed** — see below — and CI ratchets it so it can only go up.

If something you need is missing, that is expected at this stage. [Open an issue](https://github.com/Avunu/frappe-types/issues) with the symbol and how you call it, or send a PR — the contribution bar is "cite the frappe source".

## Typing your DocTypes

The package ships one command, `frappe-types gen-doctypes`. It reads the DocType JSON your app (and, if you ask, its sibling apps) commits, plus the Custom Fields and Property Setters the app ships, and writes one `.d.ts` with an interface per DocType, registered by name in a global `FrappeDocTypes` interface:

```bash
npx frappe-types gen-doctypes --bench ~/frappe-bench --app my_app --out types/doctypes.d.ts
npx frappe-types gen-doctypes --bench ~/frappe-bench --app my_app --include-siblings erpnext,hrms --out types/doctypes.d.ts
```

```ts
// types/doctypes.d.ts — an excerpt of test/fixtures/gen-doctypes/expected/my_app.d.ts
import type * as $ft from "frappe-types";

declare global {
	interface FrappeDocTypes {
		"Sales Order": SalesOrder;
		"Sales Order Item": SalesOrderItem;
	}
}

export interface SalesOrder extends $ft.FrappeDoc {
	doctype: "Sales Order";
	/** Status · Select */
	status?: "Draft" | "On Hold" | "Completed" | "" | null;
	/** Date · Date */
	transaction_date?: string | null;
	/** Is Return · Check */
	is_return?: 0 | 1;
	/** Grand Total · Currency */
	grand_total?: number;
	/** Items · Table → Sales Order Item */
	items: SalesOrderItem[];
	/** Delivery Run · Link → Delivery Run · Custom Field, my_app/my_app/my_app/custom/sales_order.json */
	custom_delivery_run?: string | null;
}
```

Include the file in the program and index the registry by DocType name. That works the same from TypeScript and from JSDoc in uncompiled desk JS (doctype, list, report and page scripts), because the registry is global:

```jsonc
// tsconfig.json
{
  "compilerOptions": { "types": ["frappe-types/global"], "allowJs": true, "checkJs": true, "noEmit": true, "strict": true },
  "include": ["types/doctypes.d.ts", "my_app/public/js/**/*.js", "my_app/**/doctype/**/*.js"]
}
```

```js
/** @param {FrappeDocTypes["Sales Order"]} doc */
function billable(doc) {
	return doc.items.filter((row) => (row.qty ?? 0) > 0); // row: SalesOrderItem
}
```

The per-DocType interfaces are also exported, for `import type { SalesOrder } from "./types/doctypes"`.

| option | |
| --- | --- |
| `--bench` | a bench (the folder holding `apps/`) or an apps directory |
| `--app` | the app to type: its DocTypes, and the customisations it ships |
| `--include-siblings` | more apps to type in full and take customisations from, comma-separated |
| `--out` | write here instead of stdout |
| `--check` | write nothing; exit 1 if `--out` is missing or differs (for CI) |
| `--strict` | exit 1 if anything had to be typed loosely (see below) |
| `--quiet` | do not print warnings |

**What it reads** is what `bench migrate` reads, found the same way: the modules in `<app>/modules.txt`, every `<module>/doctype/<name>/<name>.json` in them, Custom Fields and Property Setters from `<module>/custom/*.json`, and `Custom Field` / `Property Setter` records in `<app>/fixtures/*.json`. A DocType the app customises, or a child DocType any emitted DocType's table names, is pulled in from whichever app on the bench defines it, so `--app my_app` alone types `custom_*` fields on erpnext's Customer without typing all of erpnext.

**How fields are typed.** Each rule is checked against the pinned frappe's own lists by `test/gen-doctypes.test.mjs`, which runs in CI, so a frappe release that adds or reclassifies a fieldtype fails the build instead of being typed wrong. Citations for each rule are in the header of [`bin/gen-doctypes.mjs`](bin/gen-doctypes.mjs).

| fieldtype | type | why |
| --- | --- | --- |
| Section/Column/Tab Break, HTML, Button, Image, Fold, Heading, Attachment Gallery | not emitted | `no_value_fields`: no column, no value |
| Table, Table MultiSelect | `Child[]`, required | initialised to `[]` on a new doc and on load |
| Check | `0 \| 1` | a tinyint, coerced to 0/1 on save |
| Int, Float, Currency, Percent | `number` | NOT NULL columns (`NOT_NULL_TYPES`) |
| Long Int, Rating, Duration | `number \| null` | nullable numeric columns |
| Select | `"A" \| "B" \| ""` (+ `\| null`) | the options after Property Setters; `""` skips validation. `naming_series` and option-less Selects are `string` |
| JSON | `unknown` | a string from MariaDB, a parsed value from Postgres |
| everything else (Data, Link, Date, Datetime, Text, ...) | `string \| null` | varchar/text/date columns |

Every value field is optional (`?:`): a doc created in the browser carries only the fields that had a default. `null` is dropped only where the column is NOT NULL (the numeric types above, or a field with `not_nullable`). That is stricter than frappe's own Python type exporter, which also drops it for `reqd` fields: `reqd` is enforced on save, not by the column, so old rows and `ignore_mandatory` inserts still read back NULL. Each interface extends `FrappeDoc` (`ChildDoc` for child DocTypes), so `name`, `owner`, `creation`, `modified`, `docstatus`, `idx` and, on rows, `parent`/`parenttype`/`parentfield` come from this package, and the registry fits anything that takes a `FrappeDoc`.

**Limits.**

- **Customisations made in the database** (Customize Form, a Custom Field created in the UI) are in no file and cannot be seen. They fall through to `FrappeDoc`'s index signature and read as `unknown`, which compiles but must be narrowed. Export them as fixtures to type them.
- **`autoname: autoincrement`** DocTypes have a numeric `name` on the wire; `FrappeDoc` types it `string`. The interface's doc comment says so.
- **One generated file per program.** Two files that both register `"Customer"` with different custom fields will conflict. Generate once for the app, with its siblings.
- **Loose spots are warnings**: a fieldtype the generator does not know (typed `unknown`), a table whose child DocType is on no app on the bench (typed `ChildDoc[]`), a Custom Field on a DocType nothing defines (its custom fields only). `--strict` turns them into a non-zero exit.

Keep the file in version control and check it in CI so it cannot drift from the JSON:

```bash
npx frappe-types gen-doctypes --bench ../.. --app my_app --out types/doctypes.d.ts --check
```

The output is deterministic (sorted, no timestamps, no absolute paths), so `--check` is a byte comparison. The command is plain JavaScript with no dependencies, so it runs from `node_modules` with the node you already have (node refuses to strip TypeScript types under `node_modules`, which rules out shipping it as `.ts`); its JSDoc is type-checked by `tsconfig.bin.json` as part of `npm run check`.

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

`nix flake check` runs six checks, each its own derivation so a failure names itself:

| check | asserts |
| --- | --- |
| typecheck | tsc --noEmit with skipLibCheck: false |
| coverage | the ratchet against the pinned frappe |
| frappe-major | the package major is the frappe major |
| verified-against | package.json's frappe.verifiedAgainst matches the pin |
| unit | `npm run test:unit`, including the doctype generator's rules against the pinned frappe |
| drift | `audit:drift --strict` against the pinned frappe and drift-baseline.json (below) |

`nix build` produces the tarball npm would publish — the cheapest way to check that `files` still ships the right set and nothing else. It is not how a release is published: `publish.yml` runs `npm publish` so that OIDC trusted publishing and the provenance attestation apply.

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
-   Classes that consumers subclass or prototype-patch must be `declare class`, not `interface` — `extends` and `super()` need a real class declaration.
-   Frappe uses `0 | 1` for booleans on doc fields. Model it that way where the source does.
-   The `frappe-types` command lives in `bin/` and ships as plain JavaScript with JSDoc types and no dependencies, because node will not strip TypeScript types under `node_modules`. `npm run check` type-checks it through `tsconfig.bin.json`; its fieldtype rules cite frappe in the file header and are tested against the pinned frappe (`test/gen-doctypes.test.mjs`).
-   Commit subjects are [conventional commits](https://www.conventionalcommits.org/) — they are the changelog and they choose the version. Never `!` or `BREAKING CHANGE:`: see [Releasing](#releasing).

## License

MIT © Avunu LLC

#!/usr/bin/env node
// The package major must equal package.json's `frappe.major`. Nothing else in the
// toolchain enforces that, and a conventional-commit release process will break it
// on its own if left alone.
//
//   node scripts/check-frappe-major.mjs                  (also: npm run check:major)
//   node scripts/check-frappe-major.mjs some/package.json
//
// The optional argument exists for release-please.yml's `guard-major` job, which checks
// the package.json release-please has WRITTEN ONTO ITS RELEASE BRANCH rather than the one
// in the workspace. Those are different files at exactly the moment that matters: the
// release branch is where the proposed 17.0.0 lives while `version-16`'s own package.json
// still says 16.0.1.
//
// WHY THIS EXISTS
//
// `frappe-types@16.x.y` means "types for Frappe v16" — the major encodes the FRAPPE
// major, not this package's own API compatibility. Minor and patch are ours. README's
// version table, `npm i -D frappe-types@^16`, the branch-per-major layout and the
// dist-tag scheme all rest on that.
//
// Conventional commits disagree. One `feat!:` subject or one `BREAKING CHANGE:` footer
// and release-please proposes 17.0.0 — a package claiming to be types for Frappe v17
// that is in fact the v16 typeset. That is not cosmetic: every consumer on `^17` would
// silently install v16 declarations, and `latest` would move to a line that does not
// exist. Breaking type changes are NORMAL here (tightening any signature breaks a
// consumer), so this is not a hypothetical — it is what happens by default.
//
// The check is symmetric, and the undershoot matters too: on a fresh `version-17` branch
// forked from `version-16`, the inherited manifest still reads 16.0.x, so an ordinary
// `fix:` landing before the `Release-As: 17.0.0` commit makes release-please propose
// 16.0.x against a tree whose `frappe.major` is already 17. Same failure, same fix.
//
// WHY A GUARD AND NOT `"versioning": "always-bump-minor"`
//
// The structural fix is to set `"versioning": "always-bump-minor"` in
// release-please-config.json, which makes a major bump arithmetically impossible.
// It is rejected here because it also makes a PATCH bump impossible: every typo fix
// in a doc comment would ship as a minor, and the minor is the only signal consumers
// have for "declarations were added" versus "a declaration was corrected". For a
// package whose whole product is precision about what it claims, throwing away that
// distinction to route around a commit-message mistake is the wrong trade.
//
// WHERE IT ACTUALLY RUNS — three places, and only two of them are reliable
//
//   1. release-please.yml's `guard-major` job, against the release branch, in the SAME
//      run that opens or updates the release pull request. This is the one that catches a
//      wrong major while it is still free to fix, and it is the reason the check takes a
//      path argument. It is reliable because that run is triggered by a HUMAN's merge push
//      (or the cron), not by GITHUB_TOKEN.
//   2. publish.yml, immediately before `npm publish`. Last line of defence: npm's unpublish
//      window is 72 hours and a wrong major here is not something a patch release fixes.
//   3. check.yml's `frappe-major` job, on `pull_request`. This covers HUMAN pull requests —
//      someone editing `frappe.major` by hand. It does NOT reliably cover release-please's
//      own pull request: that PR is authored by GITHUB_TOKEN, and GitHub puts `pull_request`
//      runs from GITHUB_TOKEN-authored PRs into `action_required` — queued behind an
//      "Approve workflows to run" banner — so unless a maintainer clicks approve on every
//      release PR, the check simply never executes and nothing turns red. That is why (1)
//      exists and why (1), not (3), is the pre-merge gate.
//
// FIXING A FAILURE
//
// If the major bump was unintended (the usual case), a commit on the branch carried a `!`
// or a `BREAKING CHANGE:` footer. Land an empty commit with a `Release-As: 16.x.y` footer
// to pin the version release-please cuts:
//
//   git commit --allow-empty -m "chore: pin the release to 16.x.y" -m "Release-As: 16.x.y"
//
// That is the only remedy available once the offending commit has merged — rewording it
// means force-pushing the release branch, which is not a thing to do to a published line.
// Nothing needs to be deleted afterwards: release-please force-pushes its release branch
// and rewrites the pull request on the next run, so landing the `Release-As:` commit is
// sufficient on its own.
//
// A genuine frappe-major bump is a deliberate act, not a side effect of a commit
// subject: cut a `version-17` branch, set `frappe.major`/`frappe.branch`/
// `frappe.verifiedAgainst` in package.json, re-verify the declarations against the new
// frappe, and land a `Release-As: 17.0.0` commit. This check passes once the metadata
// and the version agree — which is exactly the point at which the claim is true.

import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const target = process.argv[2]
	? path.resolve(process.argv[2])
	: path.join(ROOT, "package.json");
const pkg = JSON.parse(await readFile(target, "utf8"));

const version = pkg.version ?? "";
const versionMajor = version.split(".")[0] ?? "";
const frappe = pkg.frappe ?? {};
const problems = [];

if (!/^\d+$/.test(versionMajor)) {
	problems.push(`version "${version}" has no numeric major`);
}
if (!/^\d+$/.test(String(frappe.major ?? ""))) {
	problems.push(`frappe.major "${frappe.major}" is missing or not numeric`);
}
if (problems.length === 0 && versionMajor !== String(frappe.major)) {
	problems.push(
		`version ${version} claims to be types for Frappe v${versionMajor}, ` +
			`but frappe.major says v${frappe.major}`,
	);
}
// The branch name is the third place the same fact is written down. It is metadata, not
// a build input, so a mismatch is a warning rather than a failure — but a `version-16`
// branch field on a 17.x tree means one of the two was edited and the other forgotten.
if (frappe.branch && frappe.branch !== `version-${frappe.major}`) {
	console.warn(
		`warning: frappe.branch "${frappe.branch}" does not match frappe.major "${frappe.major}"`,
	);
}

if (problems.length > 0) {
	console.error(`The package major must equal frappe.major. Checked ${target}\n`);
	for (const p of problems) console.error(`  - ${p}`);
	console.error(
		"\nfrappe-types@X.y.z means 'types for Frappe vX'. Publishing 17.0.0 from the v16" +
			"\ntypeset would hand every consumer on ^17 the wrong declarations." +
			"\n\nIf release-please proposed this, a commit on the branch carried a `!` or a" +
			"\n`BREAKING CHANGE:` footer. Land an empty commit with a `Release-As: <version>`" +
			"\nfooter; release-please rewrites its release branch and pull request on the next" +
			"\nrun, so nothing needs deleting." +
			"\n\nIf you are genuinely moving to a new frappe major, update frappe.major," +
			"\nfrappe.branch and frappe.verifiedAgainst on a new version-<major> branch first." +
			"\nSee scripts/check-frappe-major.mjs for the full procedure.",
	);
	process.exit(1);
}

console.log(`ok: ${pkg.name}@${version} is the Frappe v${frappe.major} typeset`);

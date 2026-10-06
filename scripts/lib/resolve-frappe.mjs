// Find the frappe checkout the audits should measure.
//
// Shared by audit-coverage.mjs and audit-drift.mjs so that the two can never disagree
// about which tree they were looking at — the failure this guards against is exactly
// that disagreement (see "Which frappe?" in README.md).

import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..");

/**
 * @param {string | undefined} candidate
 * @returns {candidate is string}
 */
function isPath(candidate) {
	return typeof candidate === "string" && candidate !== "";
}

/**
 * The first candidate that looks like a frappe checkout, in this order: the explicit
 * `--frappe` value, `FRAPPE_PATH` (which `nix develop` exports as the flake's pin),
 * then three sibling/bench locations. "Looks like" is the existence of
 * `frappe/public/js`, the directory every audit reads.
 *
 * NOTE for callers: a candidate that does not exist is skipped silently, so an
 * explicit `explicit` that is a typo falls through to a LATER candidate rather than
 * failing. Compare the result with the path you passed if that matters to you.
 *
 * @param {string | undefined} explicit the `--frappe` option, if given
 * @returns {string | null} absolute path, or null if nothing matched
 */
export function resolveFrappe(explicit) {
	const candidates = [
		explicit,
		process.env.FRAPPE_PATH,
		path.resolve(ROOT, "..", "frappe"),
		path.resolve(ROOT, "..", "frappe-carbon-dev", "apps", "frappe"),
		path.resolve(ROOT, "..", "..", "apps", "frappe"),
	].filter(isPath);
	for (const c of candidates) {
		if (existsSync(path.join(c, "frappe", "public", "js"))) return path.resolve(c);
	}
	return null;
}

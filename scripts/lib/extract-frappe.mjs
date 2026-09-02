// Extract the desk JS API surface from a frappe checkout.
//
// Frappe has no manifest of what it puts on `window.frappe` — the namespace is
// assembled at runtime from `frappe.provide()` calls, direct assignments, class
// definitions and Object.assign merges scattered across ~700 files. So the
// surface has to be recovered from source, three ways, and unioned:
//
//   1. DEFINITIONS  — `frappe.provide("x.y")`, `frappe.x.y = ...`, `frappe.x.y = class`
//      Authoritative: if frappe assigns it, it exists.
//   2. SELF-READS   — every `frappe.a.b.c` frappe's own code reads back.
//      Catches everything defined dynamically (boot payloads, provide loops,
//      server-injected namespaces) that no assignment scan can see.
//   3. PROTOTYPES   — `frappe.x.Y.prototype.z` and `class Y extends frappe.x.Z`
//      The subclass/patch surface, which is what theme apps actually need.
//
// The union over-reports slightly (a typo'd read in frappe's own source looks
// like API). That is the right bias for a coverage TARGET: it never quietly
// tells you a real member is out of scope.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { glob } from "node:fs/promises";

/** Namespace roots that are runtime junk, not API worth declaring. */
const NOISE = new Set([
	"frappe._messages",
	"frappe.flags",
	"frappe._",
	"frappe.__",
]);

const IDENT = "[A-Za-z_$][A-Za-z0-9_$]*";

/**
 * @param {string} frappePath path to a frappe checkout (the repo root, containing frappe/public/js)
 * @returns {Promise<{definitions: Map<string,string[]>, reads: Map<string,string[]>, prototypes: Map<string,string[]>, files: number}>}
 */
export async function extractFrappeSurface(frappePath) {
	// `frappe/public/js` is where the API is DEFINED, but it is only half the
	// evidence. The doctype/report/page client scripts scattered through the rest
	// of `frappe/` define almost nothing and consume constantly — they are the
	// largest body of real desk-API usage in existence, and the best available
	// proxy for what a consumer app will need. Scanning only public/js understates
	// the surface by roughly half.
	const jsRoot = path.join(frappePath, "frappe", "public", "js");
	const appRoot = path.join(frappePath, "frappe");

	const definitions = new Map();
	const reads = new Map();
	const prototypes = new Map();
	let files = 0;

	const add = (map, key, file) => {
		if (NOISE.has(key)) return;
		// Drop anything with a segment that is clearly not a static member.
		if (/\.\d/.test(key)) return;
		const list = map.get(key);
		if (list) {
			if (!list.includes(file)) list.push(file);
		} else {
			map.set(key, [file]);
		}
	};

	const re_provide = /frappe\.provide\(\s*["'`]([^"'`]+)["'`]\s*\)/g;
	const re_assign = new RegExp(`(?:^|[^\\w.$])(frappe(?:\\.${IDENT})+)\\s*=(?!=)`, "gm");
	const re_read = new RegExp(`(?:^|[^\\w.$])(frappe(?:\\.${IDENT})+)`, "g");
	const re_proto = new RegExp(`(frappe(?:\\.${IDENT})+)\\.prototype\\.(${IDENT})`, "g");
	const re_extends = new RegExp(`class\\s+${IDENT}\\s+extends\\s+(frappe(?:\\.${IDENT})+)`, "g");

	const seen = new Set();
	const sources = [
		{ root: jsRoot, pattern: "**/*.js", label: (e) => path.join("public/js", e) },
		// public/js is nested inside appRoot, so it would be walked twice; `seen`
		// dedupes by absolute path and keeps the first (nicer) label.
		{
			root: appRoot,
			pattern: "**/*.js",
			label: (e) => e,
			skip: (e) => e.startsWith("public/dist") || e.includes("node_modules"),
		},
	];

	for (const source of sources) {
	for await (const entry of glob(source.pattern, { cwd: source.root })) {
		if (source.skip?.(entry)) continue;
		const abs = path.join(source.root, entry);
		if (seen.has(abs)) continue;
		seen.add(abs);
		const label = source.label(entry);
		let src;
		try {
			src = await readFile(abs, "utf8");
		} catch {
			continue;
		}
		files++;

		// Strip line comments and block comments so commented-out API does not count.
		const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

		for (const m of code.matchAll(re_provide)) add(definitions, m[1], label);
		for (const m of code.matchAll(re_assign)) add(definitions, m[1], label);
		for (const m of code.matchAll(re_read)) add(reads, m[1], label);
		for (const m of code.matchAll(re_proto)) add(prototypes, `${m[1]}.prototype.${m[2]}`, label);
		for (const m of code.matchAll(re_extends)) add(prototypes, m[1], label);
	}
	}

	return { definitions, reads, prototypes, files };
}

/**
 * Every distinct dotted path, plus each of its ancestors — declaring
 * `frappe.ui.form.Grid` implies `frappe.ui.form` and `frappe.ui` must exist too,
 * and a coverage report that hides which ANCESTOR is the missing one is useless.
 * @param {Iterable<string>} paths
 */
export function withAncestors(paths) {
	const out = new Set();
	for (const p of paths) {
		const parts = p.split(".");
		for (let i = 2; i <= parts.length; i++) out.add(parts.slice(0, i).join("."));
	}
	return [...out].sort();
}

/** Rank paths by how many distinct frappe source files touch them. */
export function byImportance(map) {
	return [...map.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
}

// Unit tests for the pure extractors behind scripts/audit-drift.mjs.
//
//   npm run test:unit        (= node --test "test/*.test.mjs")
//
// Not a bare `node --test`: that also runs test/probe.ts, which is a type-level probe
// for tsc and cannot execute.
//
// Every fixture is a few lines written in the shape frappe actually uses — tab-indented
// multi-line lists in hooks.py, `/* */` comments in a bundle — because the failure these
// guard against is an extractor that is right on tidy input and wrong on the real file.

import assert from "node:assert/strict";
import { test } from "node:test";
import {
	diffLists,
	diffSets,
	diffSnapshots,
	findMethodSignature,
	idPrefix,
	parseBootKeys,
	parseHookLists,
	parseScssImports,
	parseSpriteIds,
	spriteUrlToPath,
	splitStatements,
	summarizeSprite,
	tokenizePython,
} from "../scripts/lib/extract-surfaces.mjs";

// --------------------------------------------------------------------------- scss

test("scss: ordered @import targets, comments and url() handled", () => {
	const src = `
@import "frappe/public/css/fonts/inter/inter.scss";
@import "~plyr/dist/plyr";
/* @import "commented-out"; */
// @import "also-commented-out";
@import './desk/index', "./desk/full_height_page";
@import url(https://example.com/a.css);
@import url("local.css") screen;
@use "sass:math";
@forward "./theme" as t-*;
.x { content: "@import 'inside-a-string'"; }
`;
	assert.deepEqual(parseScssImports(src), [
		"frappe/public/css/fonts/inter/inter.scss",
		"~plyr/dist/plyr",
		"./desk/index",
		"./desk/full_height_page",
		"https://example.com/a.css",
		"local.css",
		"@use sass:math",
		"@forward ./theme",
	]);
});

test("scss: a file with no imports is an empty list, not an error", () => {
	assert.deepEqual(parseScssImports("$white: #fff;\n"), []);
});

// --------------------------------------------------------------------------- python lexer

test("python lexer: strings, prefixes, comments and statement starts", () => {
	const tokens = tokenizePython(`# a comment with "quotes"
x = r"\\d+" + 'it\\'s'
"""docstring
spanning lines"""
y = [
\t1,
]
`);
	const strings = tokens.filter((t) => t.kind === "string");
	assert.deepEqual(
		strings.map((t) => [t.prefix, t.value]),
		[
			["r", "\\d+"],
			["", "it's"],
			["", "docstring\nspanning lines"],
		],
	);
	// Statement starts: `x`, the docstring, `y`. Not the `1` or `]` inside the list.
	assert.deepEqual(
		splitStatements(tokens).map((s) => s[0]?.value),
		["x", "docstring\nspanning lines", "y"],
	);
	const y = tokens.find((t) => t.value === "y");
	assert.equal(y?.line, 5);
	assert.equal(y?.col, 0);
});

test("python lexer: an unterminated string is an error, not a silent truncation", () => {
	assert.throws(() => tokenizePython('x = "oops\n'), /unterminated string/);
});

// --------------------------------------------------------------------------- hooks

const HOOKS = `
app_name = "frappe"

# app_include_js = ["commented-out.js"]
app_include_js = [
\t"libs.bundle.js",
\t"desk.bundle.js",  # trailing comment
\t"form.bundle.js",
]

app_include_css = [
\t"desk.bundle.css",
\t"report.bundle.css",
]
app_include_icons = [
\t"/assets/frappe/icons/lucide/icons.svg",
\t"/assets/frappe/icons/timeless/icons.svg",
]

web_include_js = ["website_script.js"]
web_include_css = []
email_css = "email.bundle.css"
website_redirects = [
\t{"source": r"/app/(.*)", "target": r"/desk/\\1", "forward_query_parameters": True},
]

def helper():
\tapp_include_css = ["inside-a-function.css"]
`;

test("hooks: tab-indented multi-line lists, one-liners, empty lists and a bare string", () => {
	assert.deepEqual(
		parseHookLists(HOOKS, ["app_include_js", "app_include_css", "app_include_icons", "web_include_js", "web_include_css", "email_css", "web_include_icons"]),
		{
			app_include_js: ["libs.bundle.js", "desk.bundle.js", "form.bundle.js"],
			app_include_css: ["desk.bundle.css", "report.bundle.css"],
			app_include_icons: ["/assets/frappe/icons/lucide/icons.svg", "/assets/frappe/icons/timeless/icons.svg"],
			web_include_js: ["website_script.js"],
			web_include_css: [],
			email_css: ["email.bundle.css"],
		},
	);
});

test("hooks: implicit string concatenation, and the last assignment wins", () => {
	assert.deepEqual(parseHookLists('app_include_js = ["a" ".js", "b.js"]\napp_include_js = ["c.js"]\n', ["app_include_js"]), {
		app_include_js: ["c.js"],
	});
	assert.deepEqual(parseHookLists('app_include_js = ["a" ".js", "b.js"]\n', ["app_include_js"]), { app_include_js: ["a.js", "b.js"] });
});

test("hooks: a shape the parser does not understand throws instead of returning a short list", () => {
	assert.throws(() => parseHookLists('app_include_js = ["a.js"]\napp_include_js += ["b.js"]\n', ["app_include_js"]), /modified with "\+="/);
	assert.throws(() => parseHookLists("app_include_js = [SOME_CONSTANT]\n", ["app_include_js"]), /expected a string literal/);
	assert.throws(() => parseHookLists('app_include_js = ["a.js"] + ["b.js"]\n', ["app_include_js"]), /list arithmetic/);
	assert.throws(() => parseHookLists('app_include_js = [f"{x}.js"]\n', ["app_include_js"]), /expected a string literal/);
	assert.throws(() => parseHookLists('app_include_js = ["a.js" "b.js" 3]\n', ["app_include_js"]), /expected "," or "\]"/);
});

// --------------------------------------------------------------------------- boot

test("boot: attribute, string-subscript and tuple-unpacking targets", () => {
	const src = `
def get_bootinfo():
\tbootinfo = frappe._dict()
\tbootinfo.sitename = frappe.local.site
\tbootinfo.sysdefaults["setup_complete"] = True
\tbootinfo.canonical_shell, bootinfo.home_shell = build(bootinfo.module_sidebars)
\tbootinfo["lang"] = frappe.lang
\tbootinfo.docs += more
\tif bootinfo.lang == "en":
\t\tbootinfo.is_english = 1
\tbootinfo.update(get_email_accounts())
\tfor key in ("developer_mode", "socketio_port"):
\t\tbootinfo[key] = frappe.conf.get(key)
\t# bootinfo.in_a_comment = 1
\tx = """
\tbootinfo.in_a_docstring = 1
\t"""
\tother.bootinfo.not_ours = 1
\treturn bootinfo
`;
	assert.deepEqual(parseBootKeys(src), {
		keys: ["canonical_shell", "home_shell", "is_english", "lang", "sitename"],
		dynamic: 1,
		bulk: 1,
	});
});

test("boot: a chained assignment targets every name on its left", () => {
	assert.deepEqual(parseBootKeys("bootinfo.a = bootinfo.b = 1\n").keys, ["a", "b"]);
});

// --------------------------------------------------------------------------- sprites

test("sprites: ids in document order, whatever the attribute order or quote style", () => {
	const svg = `
<!-- <symbol id="commented-out"> -->
<svg id="frappe-symbols">
\t<style>.a { content: "<symbol id='in-style'>" }</style>
\t<symbol viewBox="0 0 24 24" id="icon-a-arrow-down"><path d="m14 12"/></symbol>
\t<symbol id='icon-b' viewBox="0 0 12 12" style="overflow: visible">
\t<symbol data-id="not-an-id" viewBox="0 0 1 1" id="es-line-add-people" />
\t<symbol viewBox="0 0 1 1" />
\t<defs><symbol id="A"></symbol></defs>
</svg>`;
	assert.deepEqual(parseSpriteIds(svg), ["icon-a-arrow-down", "icon-b", "es-line-add-people", "A"]);
});

test("sprites: prefix families, with a first-segment fallback so a new family is visible", () => {
	assert.equal(idPrefix("icon-check"), "icon-");
	assert.equal(idPrefix("es-line-add-people"), "es-line-");
	assert.equal(idPrefix("es-solid-x"), "es-solid-");
	assert.equal(idPrefix("es-lock"), "es-");
	assert.equal(idPrefix("icon/at-sign"), "icon/");
	assert.equal(idPrefix("duo-new-family"), "duo-");
	assert.equal(idPrefix("A"), "(bare)");
});

test("sprites: the summary is order-independent, counts duplicates, and hashes the sorted ids", () => {
	const a = summarizeSprite(["icon-b", "icon-a", "icon-a", "A"]);
	const b = summarizeSprite(["A", "icon-a", "icon-b", "icon-a"]);
	assert.deepEqual(a, b);
	assert.equal(a.symbols, 4);
	assert.equal(a.distinct, 3);
	assert.deepEqual(a.prefixes, { "(bare)": 1, "icon-": 2 });
	assert.match(a.idsSha256, /^[0-9a-f]{64}$/);
	assert.notEqual(summarizeSprite(["icon-a"]).idsSha256, summarizeSprite(["icon-b"]).idsSha256);
	assert.equal("ids" in a, false, "the id list is large and only included on request");
	assert.deepEqual(summarizeSprite(["icon-b", "icon-a"], { withIds: true }).ids, ["icon-a", "icon-b"]);
});

test("sprites: /assets/frappe/ maps into frappe/public, anything else has no file here", () => {
	assert.equal(spriteUrlToPath("/assets/frappe/icons/lucide/icons.svg"), "frappe/public/icons/lucide/icons.svg");
	assert.equal(spriteUrlToPath("assets/frappe/icons/x.svg"), "frappe/public/icons/x.svg");
	assert.equal(spriteUrlToPath("/assets/erpnext/icons/x.svg"), null);
});

// --------------------------------------------------------------------------- js

test("js: a multi-line method definition is collapsed to one line; calls are not definitions", () => {
	const src = `
frappe.utils = {
	label() {
		return icon("x");
	},
	icon(
		icon_name,
		size = "sm",
		stroke_color = null
	) {
		if (frappe.utils.is_emoji(icon_name)) {
			return \`<span>\${icon_name}</span>\`;
		}
	},
	desktop_icon(label, color, size, style) {
	},
};
`;
	assert.equal(findMethodSignature(src, "icon"), 'icon(icon_name, size = "sm", stroke_color = null) {');
	assert.equal(findMethodSignature(src, "desktop_icon"), "desktop_icon(label, color, size, style) {");
	assert.equal(findMethodSignature(src, "missing"), null);
	assert.equal(findMethodSignature('foo: function (a, b) {\n}', "foo"), "foo: function (a, b) {");
	assert.throws(() => findMethodSignature(src, "not an identifier"), /not an identifier/);
});

// --------------------------------------------------------------------------- diffs

test("set diff: added and removed, each in its own list's order", () => {
	assert.deepEqual(diffSets(["a", "b", "c"], ["c", "d", "a"]), { added: ["d"], removed: ["b"] });
	assert.deepEqual(diffSets([], []), { added: [], removed: [] });
	assert.deepEqual(diffSets(["a", "a"], ["a"]), { added: [], removed: [] });
});

test("list diff: the same members in a different order is a change", () => {
	assert.deepEqual(diffLists(["a", "b", "c"], ["a", "b", "c"]), { added: [], removed: [], reordered: false });
	assert.deepEqual(diffLists(["a", "b", "c"], ["c", "a", "b"]), { added: [], removed: [], reordered: true });
	// Adding one in the middle moves nothing that both lists share.
	assert.deepEqual(diffLists(["a", "b"], ["a", "x", "b"]), { added: ["x"], removed: [], reordered: false });
	assert.deepEqual(diffLists(["a", "b", "c"], ["c", "x", "a"]), { added: ["x"], removed: ["b"], reordered: true });
});

/** @param {Partial<import("../scripts/lib/extract-surfaces.mjs").Snapshot>} [overrides] */
function snapshot(overrides = {}) {
	return {
		schema: 1,
		version: "16.1.0",
		scss: { bundles: { "frappe/public/scss/desk.bundle.scss": ["a.css", "b.css"] } },
		hooks: { includes: { app_include_js: ["desk.bundle.js"] } },
		icons: {
			sprites: { "frappe/public/icons/x/icons.svg": summarizeSprite(["icon-a"]) },
			unresolved: [],
			directories: { "frappe/public/css/octicons": true, "frappe/public/css/fonts/fontawesome": true },
			fontStylesheetImports: [],
			helpers: { icon: "icon(a) {", desktop_icon: null },
		},
		bundles: ["frappe/public/js/desk.bundle.js"],
		boot: { keys: ["lang"], dynamic: 1, bulk: 0 },
		...overrides,
	};
}

test("snapshot diff: identical snapshots, and a version-only change, are not drift", () => {
	assert.deepEqual(diffSnapshots(snapshot(), snapshot()), []);
	assert.deepEqual(diffSnapshots(snapshot(), snapshot({ version: "16.2.0" })), []);
});

test("snapshot diff: every surface reports what moved", () => {
	const head = snapshot({
		scss: { bundles: { "frappe/public/scss/desk.bundle.scss": ["b.css", "c.css"], "frappe/public/scss/new.bundle.scss": [] } },
		hooks: { includes: { app_include_js: ["desk.bundle.js"], app_include_css: ["desk.bundle.css"] } },
		icons: {
			sprites: { "frappe/public/icons/x/icons.svg": summarizeSprite(["icon-a", "icon-b"]) },
			unresolved: [],
			directories: { "frappe/public/css/octicons": false, "frappe/public/css/fonts/fontawesome": true },
			fontStylesheetImports: [],
			helpers: { icon: "icon(a, b) {", desktop_icon: null },
		},
		bundles: ["frappe/public/js/desk.bundle.js", "frappe/public/js/new.bundle.js"],
		boot: { keys: ["lang", "dock"], dynamic: 1, bulk: 1 },
	});
	const changes = diffSnapshots(snapshot(), head);
	/** @param {string} surface @param {string} subject */
	const find = (surface, subject) => changes.find((c) => c.surface === surface && c.subject === subject);

	assert.deepEqual(find("scss", "frappe/public/scss/*.bundle.scss"), {
		surface: "scss", subject: "frappe/public/scss/*.bundle.scss", kind: "list", added: ["frappe/public/scss/new.bundle.scss"], removed: [], reordered: false,
	});
	const desk = find("scss", "frappe/public/scss/desk.bundle.scss");
	assert.deepEqual(desk?.kind === "list" && [desk.added, desk.removed], [["c.css"], ["a.css"]]);
	const css = find("hooks", "app_include_css");
	assert.deepEqual(css?.kind === "list" && css.added, ["desk.bundle.css"]);

	const sprite = find("icons", "frappe/public/icons/x/icons.svg");
	assert.ok(sprite?.kind === "fields");
	assert.deepEqual(
		sprite.fields.map((f) => [f.name, f.before, f.after]).filter(([name]) => name !== "idsSha256"),
		[["symbols", 1, 2], ["distinct", 1, 2], ["prefix icon-", 1, 2]],
	);
	assert.deepEqual(find("icons", "frappe/public/css/octicons"), {
		surface: "icons", subject: "frappe/public/css/octicons", kind: "fields", fields: [{ name: "exists", before: true, after: false }],
	});
	assert.ok(find("icons", "frappe/public/js/frappe/utils/utils.js"));
	assert.equal(find("bundles", "frappe/public/**/*.bundle.{js,ts,scss,css}")?.kind, "list");
	assert.ok(find("boot", "frappe/boot.py: bootinfo.<key> ="));
	assert.ok(find("boot", "frappe/boot.py: bootinfo[<expr>] = and bootinfo.update("));
});

test("snapshot diff: sprite id lists are compared when both sides carry them", () => {
	const withIds = (/** @type {string[]} */ ids) => summarizeSprite(ids, { withIds: true });
	const sprite = "frappe/public/icons/x/icons.svg";
	const base = snapshot({ icons: { ...snapshot().icons, sprites: { [sprite]: withIds(["icon-a", "icon-b"]) } } });
	const head = snapshot({ icons: { ...snapshot().icons, sprites: { [sprite]: withIds(["icon-b", "icon-c"]) } } });
	const ids = diffSnapshots(base, head).find((c) => c.subject === `${sprite} ids`);
	assert.deepEqual(ids?.kind === "list" && [ids.added, ids.removed], [["icon-c"], ["icon-a"]]);
});

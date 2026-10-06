// The two readers behind scripts/audit-drift.mjs must show an extractor the SAME tree:
// a plain directory (nix, CI) and a git ref of a clone. These build a miniature frappe
// in a temp directory and check that they agree, and that the pieces that only git
// can answer (churn, commit counts, refusing a ref that looks like an option) work.
//
// The git half skips itself where there is no `git` on PATH, as in a flake check that
// provides only nodejs.

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { takeSnapshot } from "../scripts/lib/extract-surfaces.mjs";
import { countCommits, fsReader, gitReader, inspectCheckout, numstat } from "../scripts/lib/frappe-reader.mjs";

const hasGit = spawnSync("git", ["--version"]).status === 0;

/** What frappe has on disk but git does not track: its own .gitignore says so. */
const FILES = {
	".gitignore": "node_modules\nfrappe/public/dist\n",
	"frappe/__init__.py": '__version__ = "16.1.2"\n',
	"frappe/hooks.py": [
		"app_include_js = [",
		'\t"desk.bundle.js",',
		"]",
		"app_include_icons = [",
		'\t"/assets/frappe/icons/lucide/icons.svg",',
		'\t"/assets/frappe/icons/missing/icons.svg",',
		'\t"/assets/erpnext/icons/other.svg",',
		"]",
		"",
	].join("\n"),
	"frappe/boot.py": "def get_bootinfo():\n\tbootinfo.sitename = 1\n",
	"frappe/public/scss/desk.bundle.scss": '@import "frappe/public/css/octicons/octicons.css";\n@import "./desk/index";\n',
	"frappe/public/icons/lucide/icons.svg": '<svg><symbol id="icon-a"/><symbol id="icon-b"/></svg>\n',
	"frappe/public/css/octicons/octicons.css": ".octicon {}\n",
	"frappe/public/js/desk.bundle.js": "",
	"frappe/public/js/frappe/utils/utils.js": "frappe.utils = {\n\ticon(name, size = 'sm') {\n\t},\n};\n",
	"frappe/public/dist/js/desk.bundle.ABC123.js": "built output, untracked",
	"frappe/public/node_modules/lib/x.bundle.js": "installed, untracked",
};

/**
 * @param {string} cwd
 * @param {string[]} args
 */
function git(cwd, args) {
	return execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false", ...args], {
		cwd,
		encoding: "utf8",
		env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
	}).trim();
}

/**
 * @param {string} root
 * @param {Record<string, string>} files
 */
function write(root, files) {
	for (const [rel, text] of Object.entries(files)) {
		mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
		writeFileSync(path.join(root, rel), text);
	}
}

describe("readers", { skip: !hasGit && "git is not installed" }, () => {
	/** @type {string} */
	let root;

	before(() => {
		root = mkdtempSync(path.join(tmpdir(), "frappe-types-drift-"));
		git(root, ["init", "--quiet"]);
		write(root, FILES);
		git(root, ["add", "-A"]);
		git(root, ["commit", "--quiet", "-m", "one"]);
		git(root, ["tag", "v16.1.2"]);
		write(root, {
			"frappe/public/scss/desk.bundle.scss": '@import "./desk/index";\n@import "./common/utilities";\n',
			"frappe/public/js/frappe/utils/utils.js": "frappe.utils = {\n\ticon(name, size = 'sm', color = null) {\n\t},\n};\n",
		});
		rmSync(path.join(root, "frappe/public/css/octicons"), { recursive: true });
		git(root, ["add", "-A"]);
		git(root, ["commit", "--quiet", "-m", "two"]);
		git(root, ["tag", "v16.1.3"]);
	});

	after(() => rmSync(root, { recursive: true, force: true }));

	test("fs and git readers agree on what is there, untracked build output aside", async () => {
		const fs = fsReader(root);
		const tag = await gitReader(root, "v16.1.3");
		const dir = "frappe/public";
		const expected = (await tag.listFiles(dir)).sort();
		assert.deepEqual(await fs.listFiles(dir), expected);
		assert.ok(!expected.some((f) => f.includes("dist/") || f.includes("node_modules/")), "untracked output must not be listed");
		assert.equal(await fs.readText("frappe/__init__.py"), await tag.readText("frappe/__init__.py"));
		assert.equal(await fs.readText("frappe/nope.py"), null);
		assert.equal(await tag.readText("frappe/nope.py"), null);
		for (const [probe, kind] of /** @type {const} */ ([
			["frappe/public/js", "dir"],
			["frappe/public/js/desk.bundle.js", "file"],
			["frappe/public/css/octicons", null],
			["frappe/public/nonexistent/deeper", null],
		])) {
			assert.equal(await fs.kindOf(probe), kind, `fs ${probe}`);
			assert.equal(await tag.kindOf(probe), kind, `git ${probe}`);
		}
	});

	test("a snapshot is identical whichever reader produced it, and is plain deterministic JSON", async () => {
		const fromFs = await takeSnapshot(fsReader(root));
		const fromGit = await takeSnapshot(await gitReader(root, "HEAD"));
		assert.equal(JSON.stringify(fromFs), JSON.stringify(fromGit));
		assert.equal(fromFs.version, "16.1.2");
		assert.deepEqual(fromFs.bundles, ["frappe/public/js/desk.bundle.js", "frappe/public/scss/desk.bundle.scss"]);
		assert.deepEqual(Object.keys(fromFs.icons.sprites), ["frappe/public/icons/lucide/icons.svg", "frappe/public/icons/missing/icons.svg"]);
		assert.equal(fromFs.icons.sprites["frappe/public/icons/missing/icons.svg"], null, "listed but absent is recorded, not skipped");
		assert.deepEqual(fromFs.icons.unresolved, ["/assets/erpnext/icons/other.svg"]);
		assert.deepEqual(fromFs.icons.directories, { "frappe/public/css/octicons": false, "frappe/public/css/fonts/fontawesome": false });
		assert.deepEqual(fromFs.boot, { keys: ["sitename"], dynamic: 0, bulk: 0 });
	});

	test("two tags of one clone can be compared without checking either out", async () => {
		const before = await takeSnapshot(await gitReader(root, "v16.1.2"));
		assert.equal(before.icons.directories["frappe/public/css/octicons"], true);
		assert.deepEqual(before.icons.fontStylesheetImports, ["frappe/public/scss/desk.bundle.scss: frappe/public/css/octicons/octicons.css"]);
		const after = await takeSnapshot(await gitReader(root, "v16.1.3"));
		assert.equal(after.icons.directories["frappe/public/css/octicons"], false);
		assert.deepEqual(after.icons.fontStylesheetImports, []);
		assert.equal(after.icons.helpers.icon, "icon(name, size = 'sm', color = null) {");
	});

	test("churn and commit counts come from git", async () => {
		const base = await gitReader(root, "v16.1.2");
		const head = await gitReader(root, "v16.1.3");
		const paths = ["frappe/public/scss/desk.bundle.scss", "frappe/public/css/octicons/octicons.css", "frappe/__init__.py"];
		const churn = await numstat(root, base.commit, head.commit, paths);
		assert.deepEqual([...churn], [
			["frappe/public/css/octicons/octicons.css", { added: 0, deleted: 1 }],
			["frappe/public/scss/desk.bundle.scss", { added: 1, deleted: 1 }],
		]);
		// `null` diffs against the working tree, which is at v16.1.3 here.
		assert.deepEqual([...(await numstat(root, base.commit, null, paths))].length, 2);
		assert.equal(await countCommits(root, "v16.1.2", "v16.1.3"), 1);
		const checkout = await inspectCheckout(root);
		assert.equal(checkout.commit, head.commit);
		assert.equal(checkout.tag, "v16.1.3");
	});

	test("refs git would mistake for options, unknown refs and non-roots are refused", async () => {
		await assert.rejects(gitReader(root, "--output=/tmp/x"), /looks like an option/);
		await assert.rejects(gitReader(root, "v99.0.0"), /not a commit/);
		// A directory INSIDE a repository is not a checkout of its own: git would answer
		// with the outer repository's refs.
		await assert.rejects(gitReader(path.join(root, "frappe"), "v16.1.2"), /not the root of a git checkout/);
		assert.deepEqual(await inspectCheckout(path.join(root, "frappe")), { commit: null, tag: null, date: null });
	});
});

test("fs reader on a directory that is not a git checkout at all", async () => {
	const dir = mkdtempSync(path.join(tmpdir(), "frappe-types-plain-"));
	try {
		write(dir, { "frappe/public/js/a.bundle.js": "", "frappe/public/dist/js/a.bundle.X.js": "" });
		const reader = fsReader(dir);
		assert.deepEqual(await reader.listFiles("frappe/public"), ["frappe/public/js/a.bundle.js"]);
		assert.deepEqual(await reader.listFiles("frappe/missing"), []);
		assert.equal(await reader.readText("frappe/public/js"), null, "a directory is not a file");
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

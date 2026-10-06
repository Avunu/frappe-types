// Read a frappe tree without caring where it lives.
//
// The drift audit has to work in two places that have almost nothing in common:
//
//   * nix / CI — `inputs.frappe` is a plain directory in the store. No `.git`, no tags,
//     no history: it can only ever be compared with a recorded baseline.
//   * a developer's clone — a real checkout with every tag, so ANY two releases can be
//     compared directly.
//
// Both are exposed through the same four-method interface (`FrappeReader`), so the
// extractors in extract-surfaces.mjs and citations.mjs are written once and cannot
// behave differently depending on where the bytes came from. Paths are always
// repo-root-relative and use `/`, exactly as `git ls-tree` prints them.

import { execFile } from "node:child_process";
import { readdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * @typedef {object} FrappeReader
 * @property {"fs" | "git"} kind
 * @property {string} label what is being read, for messages
 * @property {(rel: string) => Promise<string | null>} readText file contents, or null if there is no such file
 * @property {(rel: string) => Promise<"file" | "dir" | null>} kindOf what is at the path (null: nothing)
 * @property {(dir: string) => Promise<string[]>} listFiles every file below `dir`, sorted
 */

/** @typedef {FrappeReader & { commit: string, date: string }} GitReader a reader of one git commit */

/**
 * Code-unit order. NEVER `localeCompare`: a snapshot is committed to the repo, so its
 * ordering must not depend on the locale of whichever machine regenerated it.
 * @param {string} a
 * @param {string} b
 */
export function cmp(a, b) {
	return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Directories a plain checkout contains but git does not track — so the filesystem
 * reader has to leave them out to see the same tree the git reader sees.
 * frappe's own `.gitignore` lists `node_modules` and `frappe/public/dist` (the esbuild
 * output, whose `*.bundle.<hash>.js` names would otherwise be mistaken for entry
 * files). frappe's tracked tree has no path through either (checked at v16.33.1 and
 * v16.50.0 with `git ls-tree`), so leaving them out loses nothing git would show.
 */
const UNTRACKED_DIRS = new Set(["frappe/public/dist"]);
const UNTRACKED_NAMES = new Set(["node_modules"]);

/** @param {unknown} error */
function isMissingFile(error) {
	const code = error instanceof Error && "code" in error ? error.code : undefined;
	return code === "ENOENT" || code === "ENOTDIR" || code === "EISDIR";
}

/**
 * A plain directory — what nix and CI have.
 * @param {string} root path to the frappe checkout (the repo root, containing `frappe/`)
 * @returns {FrappeReader}
 */
export function fsReader(root) {
	/** @param {string} rel */
	const abs = (rel) => path.join(root, ...rel.split("/"));

	/**
	 * @param {string} rel directory, repo-relative
	 * @returns {Promise<string[]>}
	 */
	async function walk(rel) {
		/** @type {import("node:fs").Dirent[]} */
		let entries;
		try {
			entries = await readdir(abs(rel), { withFileTypes: true });
		} catch (error) {
			if (isMissingFile(error)) return [];
			throw error;
		}
		/** @type {string[]} */
		const out = [];
		for (const entry of entries) {
			const child = `${rel}/${entry.name}`;
			if (entry.isDirectory()) {
				if (UNTRACKED_NAMES.has(entry.name) || UNTRACKED_DIRS.has(child)) continue;
				out.push(...(await walk(child)));
			} else if (entry.isFile()) {
				out.push(child);
			}
		}
		return out;
	}

	return {
		kind: "fs",
		label: `working tree ${root}`,
		async readText(rel) {
			try {
				return await readFile(abs(rel), "utf8");
			} catch (error) {
				if (isMissingFile(error)) return null;
				throw error;
			}
		},
		async kindOf(rel) {
			try {
				const entries = await readdir(path.dirname(abs(rel)), { withFileTypes: true });
				const hit = entries.find((e) => e.name === path.basename(rel));
				if (!hit) return null;
				return hit.isDirectory() ? "dir" : "file";
			} catch (error) {
				if (isMissingFile(error)) return null;
				throw error;
			}
		},
		async listFiles(dir) {
			return (await walk(dir.replace(/\/+$/, ""))).sort(cmp);
		},
	};
}

// Large enough for the biggest sprite (~0.5 MB) with room to spare; execFile's own
// default is 1 MiB and fails the call outright when exceeded.
const GIT_MAX_BUFFER = 64 * 1024 * 1024;
// frappe's history is long and a cold cache can be slow. Every call here is a tree
// lookup, not a history walk, so this only ever fires on a hung process.
const GIT_TIMEOUT_MS = 100_000;

/**
 * @param {string} repo
 * @param {string[]} args
 * @returns {Promise<string>} stdout
 */
async function git(repo, args) {
	try {
		const { stdout } = await execFileAsync("git", ["-C", repo, ...args], {
			encoding: "utf8",
			maxBuffer: GIT_MAX_BUFFER,
			timeout: GIT_TIMEOUT_MS,
		});
		return stdout;
	} catch (error) {
		const stderr =
			error instanceof Error && "stderr" in error && typeof error.stderr === "string" ? error.stderr.trim() : "";
		throw new Error(`git ${args.join(" ")} (in ${repo}) failed: ${stderr || String(error)}`);
	}
}

/**
 * Whether `repo` is itself the root of a git checkout. A frappe directory that merely
 * sits INSIDE some other repository (a monorepo, a bench) would otherwise be answered
 * with that repository's refs, and `git ls-tree` run from a subdirectory lists only
 * that subdirectory — both wrong in ways that look plausible.
 * @param {string} repo
 * @returns {Promise<boolean>}
 */
async function isCheckoutRoot(repo) {
	try {
		const top = (await git(repo, ["rev-parse", "--show-toplevel"])).trim();
		return (await realpath(top)) === (await realpath(repo));
	} catch {
		return false;
	}
}

/**
 * A ref (tag, branch, sha) of a git checkout, read with `git show` / `git ls-tree`.
 * Needs no working-tree state, so any two tags of the same clone can be compared.
 * @param {string} repo path to a frappe git checkout
 * @param {string} ref anything `git rev-parse` resolves to a commit
 * @returns {Promise<GitReader>}
 */
export async function gitReader(repo, ref) {
	// A ref that starts with `-` would be parsed by git as an option, not a revision.
	if (ref.startsWith("-")) throw new Error(`refusing ref "${ref}": it looks like an option`);
	if (!(await isCheckoutRoot(repo))) throw new Error(`${repo} is not the root of a git checkout, so "${ref}" cannot be read from it`);
	let commit;
	try {
		commit = (await git(repo, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`])).trim();
	} catch {
		throw new Error(`"${ref}" is not a commit in ${repo} — is it a git checkout that has that tag? (try \`git fetch --tags\`)`);
	}
	const date = (await git(repo, ["log", "-1", "--format=%cs", commit])).trim();

	// ONE tree listing, answered from memory afterwards: `kindOf` and `listFiles` are
	// called hundreds of times (every citation, every directory probe) and a process
	// per question would dominate the run. `-z` because without it git quotes any path
	// with a non-ASCII byte. Directories are derived from the file paths.
	/** @type {Promise<{ files: string[], fileSet: Set<string>, dirs: Set<string> }> | undefined} */
	let tree;
	const loadTree = () => {
		tree ??= git(repo, ["ls-tree", "-r", "--name-only", "-z", commit]).then((out) => {
			const files = out.split("\0").filter((f) => f !== "").sort(cmp);
			const dirs = new Set();
			for (const f of files) {
				for (let i = f.indexOf("/"); i !== -1; i = f.indexOf("/", i + 1)) dirs.add(f.slice(0, i));
			}
			return { files, fileSet: new Set(files), dirs };
		});
		return tree;
	};

	return {
		kind: "git",
		label: `${ref} (${commit.slice(0, 10)})`,
		commit,
		date,
		async readText(rel) {
			const { fileSet } = await loadTree();
			if (!fileSet.has(rel)) return null;
			return git(repo, ["show", `${commit}:${rel}`]);
		},
		async kindOf(rel) {
			const { fileSet, dirs } = await loadTree();
			if (fileSet.has(rel)) return "file";
			return dirs.has(rel.replace(/\/+$/, "")) ? "dir" : null;
		},
		async listFiles(dir) {
			const { files } = await loadTree();
			const prefix = `${dir.replace(/\/+$/, "")}/`;
			return files.filter((f) => f.startsWith(prefix));
		},
	};
}

/**
 * Lines added/removed per file between two trees of one checkout, from
 * `git diff --numstat`. `to: null` diffs `from` against the WORKING TREE (what the
 * filesystem reader reads); a commit diffs two commits.
 * @param {string} repo
 * @param {string} from commit
 * @param {string | null} to commit, or null for the working tree
 * @param {string[]} paths
 * @returns {Promise<Map<string, { added: number, deleted: number }>>} only files that differ
 */
export async function numstat(repo, from, to, paths) {
	/** @type {Map<string, { added: number, deleted: number }>} */
	const out = new Map();
	// A few hundred paths per call stays far below ARG_MAX however many files are cited.
	for (let i = 0; i < paths.length; i += 400) {
		const chunk = paths.slice(i, i + 400);
		// `--literal-pathspecs`: these are file names lifted from prose, not patterns.
		// `--no-renames`: a moved file is reported as one deletion and one addition, which
		// is what "the cited path no longer exists" means.
		const stdout = await git(repo, [
			"--literal-pathspecs",
			"diff",
			"--numstat",
			"--no-renames",
			"-z",
			from,
			...(to ? [to] : []),
			"--",
			...chunk,
		]);
		// With -z each record is `<added>\t<deleted>\t<path>\0`. Binary files print `-`.
		for (const record of stdout.split("\0")) {
			if (record === "") continue;
			const [added, deleted, ...rest] = record.split("\t");
			const file = rest.join("\t");
			out.set(file, { added: Number(added) || 0, deleted: Number(deleted) || 0 });
		}
	}
	return out;
}

/**
 * Number of commits in `from..to`. A range, not the whole history, so it stays cheap.
 * @param {string} repo
 * @param {string} from
 * @param {string} to
 * @returns {Promise<number>}
 */
export async function countCommits(repo, from, to) {
	return Number((await git(repo, ["rev-list", "--count", `${from}..${to}`])).trim());
}

/**
 * What a plain-filesystem checkout is, when it happens to be a git clone. All fields
 * are null for a directory that is not one (nix store). Used to label reports only.
 * @param {string} repo
 * @returns {Promise<{ commit: string | null, tag: string | null, date: string | null }>}
 */
export async function inspectCheckout(repo) {
	if (!(await isCheckoutRoot(repo))) return { commit: null, tag: null, date: null };
	try {
		const commit = (await git(repo, ["rev-parse", "--verify", "HEAD"])).trim();
		const date = (await git(repo, ["log", "-1", "--format=%cs", commit])).trim();
		/** @type {string | null} */
		let tag = null;
		try {
			tag = (await git(repo, ["describe", "--tags", "--exact-match", commit])).trim();
		} catch {
			/* HEAD is not on a tag */
		}
		return { commit, tag, date };
	} catch {
		return { commit: null, tag: null, date: null };
	}
}

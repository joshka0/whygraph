/**
 * module: [[whygraph-store]]
 * boundary: io
 * decided: the store path is a symlink to one build directory and a build swaps the link in one rename, because relate commits each load statement on its own, so a build into the live directory would leave a half-built store on failure and readers would see partial graphs
 */
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readlinkSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import type { LoadStep } from "./load.pure.ts";
import { git, relate } from "./tools.ts";

/**
 * owns: [[whygraph-store]]
 * post: `--store` when given, made absolute; else `<git dir>/whygraph/store` of the worktree at `root`, so each worktree has its own store and git ignores it.
 */
export function storePath(root: string, given: string | undefined): string {
  if (given !== undefined) return resolve(given);
  const gitDir = git(root, "rev-parse", "--absolute-git-dir")?.trim();
  return join(gitDir ?? join(root, ".git"), "whygraph", "store");
}

/** The folder that holds the build directories that `store` links to. */
function buildsDir(store: string): string {
  return join(dirname(store), `.${basename(store)}.builds`);
}

/**
 * owns: [[whygraph-store]]
 * post: a message when `store` exists and is not a whygraph store link, else undefined.
 */
export function foreignStore(store: string): string | undefined {
  if (!existsSync(store) && !isLink(store)) return undefined;
  return isLink(store) ? undefined : `${store} exists and is not a whygraph store (a symlink that whygraph build writes); remove it or pass another --store`;
}

function isLink(p: string): boolean {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

/**
 * Loads `steps` into a new relate directory store and, when every statement succeeds, points `store` at it.
 * owns: [[whygraph-store]]
 * post: on success `store` links to the new build, and the build it linked to before is removed; a reader that opened the old build keeps its snapshot.
 * post: on failure the new directory is removed, `store` is unchanged, and the result holds relate's exit status and message, which names the statement that failed.
 * post: each step's rows go to relate through their own `--fetch-params` file, so no file reaches relate's 64 MiB parameter cap.
 */
export function buildStore(store: string, steps: readonly LoadStep[]): { readonly ok: true } | { readonly status: number; readonly message: string } {
  const builds = buildsDir(store);
  mkdirSync(builds, { recursive: true });
  const work = mkdtempSync(join(builds, "build-"));
  const db = join(work, "db");
  const fetch: string[] = [];
  for (const s of steps) {
    if (s.param === null) continue;
    const file = join(work, `${s.param}.json`);
    writeFileSync(file, JSON.stringify(s.rows));
    fetch.push("--fetch-params", `${s.param}=${file}`);
  }
  const script = steps.map((s) => `${s.cypher};\n`).join("");
  const r = relate(["query", "--database", db, "--mode", "jsonl", ...fetch], script);
  for (const s of steps) if (s.param !== null) rmSync(join(work, `${s.param}.json`), { force: true });
  if (r.status !== 0) {
    rmSync(work, { recursive: true, force: true });
    return { status: r.status, message: r.stderr.trim() || `relate exited ${r.status}` };
  }
  const old = isLink(store) ? resolve(dirname(store), readlinkSync(store)) : undefined;
  const next = `${store}.next-${process.pid}`;
  rmSync(next, { force: true });
  symlinkSync(db, next);
  renameSync(next, store);
  if (old !== undefined && dirname(dirname(old)) === builds && dirname(old) !== work) rmSync(dirname(old), { recursive: true, force: true });
  return { ok: true };
}

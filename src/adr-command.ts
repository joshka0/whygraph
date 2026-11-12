/**
 * module: [[whygraph-adr-command]]
 * boundary: io
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { adrNumber, adrRecords, type MessageCommit } from "./adr.pure.ts";
import { fail, type Exit } from "./build.ts";
import { git } from "./tools.ts";

/**
 * Prints the decisions file of the ADRs in `folder`.
 * owns: [[whygraph-adr-command]]
 * post: exit 0 and `{ "records": [...] }` on stdout, one record per `NNNN-<title>.md` file, sorted by number; a skipped file name goes to stderr.
 * post: commits are read from the history of HEAD of the repo that holds `folder`: the commits that changed each file (following renames) and the commits whose message names it. Outside a git repo, or in one without commits, records cite no commits and stderr says so.
 * post: exit 1 when `folder` is not a folder or holds no ADR file.
 */
export function decisionsAdr(folder: string): Exit {
  const dir = resolve(folder);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return fail(`${folder} is not a folder`);
  const names = readdirSync(dir).filter((n) => n.endsWith(".md")).sort();
  if (!names.some((n) => adrNumber(n) !== undefined)) return fail(`${folder} holds no ADR file named NNNN-<title>.md`);
  const root = git(dir, "rev-parse", "--show-toplevel")?.trim();
  const commits: MessageCommit[] = [];
  const changedBy = new Map<string, readonly string[]>();
  const paths = names.map((n) => (root === undefined ? join(folder, n) : relative(root, join(dir, n))));
  if (root === undefined) process.stderr.write(`note: ${folder} is not in a git repo; records cite no commits\n`);
  else {
    const log = git(root, "log", "--format=%H%x1f%B%x1e", "HEAD");
    if (log === undefined) process.stderr.write("note: the repo has no commits; records cite no commits\n");
    else {
      for (const entry of log.split("\x1e")) {
        const [sha, message] = entry.replace(/^\n/, "").split("\x1f");
        if (sha !== undefined && message !== undefined && sha !== "") commits.push({ sha, message });
      }
      for (const p of paths) changedBy.set(p, (git(root, "log", "--format=%H", "--follow", "HEAD", "--", p) ?? "").split("\n").filter((l) => l !== ""));
    }
  }
  const files = names.map((name, i) => ({ name, path: paths[i]!, text: readFileSync(join(dir, name), "utf8") }));
  const { records, skipped } = adrRecords(files, commits, changedBy);
  for (const s of skipped) process.stderr.write(`note: skipped ${s}: not named NNNN-<title>.md\n`);
  console.log(JSON.stringify({ records }, null, 2));
  return 0;
}

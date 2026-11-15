#!/usr/bin/env node
/**
 * module: [[whygraph-cli]]
 * boundary: io
 */
import { decisionsAdr } from "./adr-command.ts";
import { build, fail, type Exit } from "./build.ts";
import { readArgs } from "./args.pure.ts";
import { ask, mcp, search } from "./ask.ts";
import { storePath } from "./store.ts";
import { git, QueryFailed, ToolMissing } from "./tools.ts";

const USAGE = `whygraph: why the code is the way it is, as a relate graph

  whygraph build [--repo <path>] [--store <path>] [--decisions <file>]...
  whygraph decisions adr <folder>
  whygraph why <file>:<symbol> [--repo <path>] [--store <path>]
  whygraph impact <decision id> [--repo <path>] [--store <path>]
  whygraph carry <file>:<symbol>|<file>:<start>-<end> [--repo <path>] [--store <path>]
  whygraph search "<text>" [--repo <path>] [--store <path>]
  whygraph mcp [--repo <path>] [--store <path>]

Exit: 0 answer, 1 failure, 2 usage, 3 target not in the graph.`;

/** The worktree root of `repo` (default the current folder), or undefined outside a git repo. */
function repoRoot(repo: string | undefined): string | undefined {
  return git(repo ?? ".", "rev-parse", "--show-toplevel")?.trim();
}

async function main(argv: readonly string[]): Promise<Exit> {
  const args = readArgs(argv);
  if ("usage" in args) return fail(`${args.usage}\n\n${USAGE}`, 2);
  if (args.command === "help") {
    console.log(USAGE);
    return 0;
  }
  if (args.command === "decisions") return decisionsAdr(args.target);
  const root = repoRoot(args.repo);
  if (root === undefined) return fail(`${args.repo ?? "the current folder"} is not in a git repo`, 2);
  const store = storePath(root, args.store);
  if (args.command === "build") return build(root, store, args.decisions);
  if (args.command === "mcp") return mcp(store);
  if (args.command === "search") return search(args.target, store);
  return ask(args.command, args.target, root, store);
}

let status: Exit;
try {
  status = await main(process.argv.slice(2));
} catch (e) {
  if (e instanceof ToolMissing) status = fail(e.message);
  else if (e instanceof QueryFailed) status = fail(`relate query failed (exit ${e.status}): ${e.message}`);
  else throw e;
}
process.exitCode = status;

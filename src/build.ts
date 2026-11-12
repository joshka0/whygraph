/**
 * module: [[whygraph-build]]
 * boundary: io
 */
import { readFileSync } from "node:fs";
import { readCodeGraph, graphCommits } from "./code-graph.pure.ts";
import { tagLinks, trailerCites, type CommitTrailers } from "./links.pure.ts";
import { loadPlan } from "./load.pure.ts";
import { checkRecords, readDecisionsFile, type SourcedRecord } from "./records.pure.ts";
import { buildStore, foreignStore } from "./store.ts";
import { git, readQuery, relate, run } from "./tools.ts";

/** The outcome of a command: an exit status and what was printed. */
export type Exit = number;

/**
 * Builds the store of the repo at `root` from `memod graph --history` and the decisions files.
 * owns: [[whygraph-build]]
 * post: exit 0 and a summary of node and relationship counts by label and type, sorted by name; warnings go to stderr, one per line, sorted.
 * post: a record cites the commits it lists and the commits of HEAD whose `Decision:` trailers name its id; a decided: tag names the records `namedRecords` finds in its text.
 * post: exit 1, store unchanged, when relate or memod is missing, memod fails or prints no graph, a decisions file cannot be read or holds a bad record, two records share an id, or records supersede in a cycle, or a load statement fails.
 */
export function build(root: string, store: string, decisionFiles: readonly string[]): Exit {
  const foreign = foreignStore(store);
  if (foreign !== undefined) return fail(foreign);
  if (relate(["--version"]).status !== 0) return fail("relate --version failed; check the relate install");
  const m = run("memod", ["graph", "--history"], { cwd: root });
  if (m.status !== 0) return fail(`memod graph --history failed in ${root} (exit ${m.status}):\n${m.stderr.trim()}`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(m.stdout);
  } catch {
    return fail("memod graph --history printed no JSON");
  }
  const read = readCodeGraph(parsed);
  if ("error" in read) return fail(read.error);
  const graph = read.graph;

  const sourced: SourcedRecord[] = [];
  const problems: string[] = [];
  for (const file of decisionFiles) {
    let value: unknown;
    try {
      value = JSON.parse(readFileSync(file, "utf8"));
    } catch (e) {
      problems.push(`${file}: ${(e as Error).message}`);
      continue;
    }
    const r = readDecisionsFile(file, value);
    if ("problems" in r) problems.push(...r.problems);
    else sourced.push(...r.records.map((record) => ({ record, file })));
  }
  if (problems.length > 0) return fail(`decisions files rejected; the store is unchanged:\n${problems.join("\n")}`);
  const commits = graphCommits(graph);
  const checked = checkRecords(
    sourced,
    commits.map((c) => c.sha),
  );
  if (checked.errors.length > 0) return fail(`decision records rejected; the store is unchanged:\n${checked.errors.join("\n")}`);
  const ids = new Set(checked.records.map((r) => r.id));
  const tags = tagLinks(graph, ids);
  const trailers = trailerCites(decisionTrailers(root), checked.cites);
  const warnings = [...checked.warnings, ...tags.warnings, ...trailers.warnings].sort();
  for (const w of warnings) process.stderr.write(`warning: ${w}\n`);
  if (commits.length === 0) process.stderr.write("warning: the repo has no commits, so no record links to code and no symbol has a history\n");

  const files = new Map(sourced.map((s) => [s.record.id, s.file]));
  const done = buildStore(store, loadPlan(graph, { ...checked, cites: trailers.cites }, tags.links, files));
  if ("status" in done) return fail(`relate failed while loading (exit ${done.status}); the store is unchanged:\n${done.message}`);

  const labels = readQuery(store, "MATCH (n) RETURN labels(n)[0] AS name, count(*) AS n ORDER BY name");
  const types = readQuery(store, "MATCH ()-[r]->() RETURN type(r) AS name, count(*) AS n ORDER BY name");
  const total = (rows: readonly Record<string, unknown>[]) => rows.reduce((s, r) => s + Number(r.n), 0);
  const list = (rows: readonly Record<string, unknown>[]) => (rows.length === 0 ? "  (none)" : rows.map((r) => `  ${String(r.name).padEnd(12)} ${r.n}`).join("\n"));
  console.log(`Built ${store}`);
  console.log(`from ${root}: ${commits.length} commits, ${checked.records.length} decision records from ${decisionFiles.length} decisions files, ${warnings.length} warnings.`);
  console.log(`${total(labels)} nodes:\n${list(labels)}`);
  console.log(`${total(types)} relationships:\n${list(types)}`);
  return 0;
}

/** The `Decision:` trailers of each commit of HEAD, as git reads trailers (the key in any case, in the message's last paragraph); none in a repo without commits. */
function decisionTrailers(root: string): readonly CommitTrailers[] {
  const log = git(root, "log", "--format=%H%x1f%(trailers:key=Decision,valueonly,separator=%x1f)%x1e", "HEAD") ?? "";
  return log
    .split("\x1e")
    .map((entry) => entry.replace(/^\n/, "").split("\x1f"))
    .filter(([sha]) => sha !== undefined && sha !== "")
    .map(([sha, ...decisions]) => ({ sha: sha!, decisions: decisions.filter((d) => d.trim() !== "") }))
    .filter((t) => t.decisions.length > 0);
}

/**
 * owns: [[whygraph-build]]
 * post: prints `message` to stderr and returns exit 1.
 */
export function fail(message: string, status = 1): Exit {
  process.stderr.write(`whygraph: ${message}\n`);
  return status;
}

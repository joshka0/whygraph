/**
 * module: [[whygraph-answers]]
 * boundary: pure
 * imports: ./code-graph.pure.ts
 * decided: answers are plain text with a heading per part and a sentence for each empty part, because an agent reads the answer once and must not need a legend to tell "none" from "unknown"
 */
import { hasSymbolEdges } from "./code-graph.pure.ts";

/** A row as relate returns it. */
export type Row = Readonly<Record<string, unknown>>;

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
const list = (v: unknown): readonly string[] => (Array.isArray(v) ? v.filter((x) => x !== null).map(String) : []);
const sorted = (v: readonly string[]): readonly string[] => [...v].sort();

/**
 * owns: [[whygraph-answers]]
 * post: `<file>#<name>` as `<file>:<name>`, the form commands take.
 */
export function shown(symbolId: string): string {
  const hash = symbolId.lastIndexOf("#");
  return hash < 0 ? symbolId : `${symbolId.slice(0, hash)}:${symbolId.slice(hash + 1)}`;
}

function tagLines(rows: readonly Row[]): string[] {
  return rows.map((r) => `  - decided: ${str(r.what)}${str(r.because) === "" ? "" : ` because ${str(r.because)}`}`);
}

function recordLines(r: Row, extra: readonly string[] = []): string[] {
  const out = [`  ${str(r.date) || "undated   "}  ${str(r.id)}  ${str(r.what) || "(no title)"}`];
  if (str(r.status) !== "") out.push(`      status: ${str(r.status)}`);
  const by = sorted(list(r.supersededBy));
  if (by.length > 0) out.push(`      superseded by: ${by.join(", ")}`);
  out.push(`      source: ${str(r.source) || "(not stated)"}`);
  out.push(...extra);
  return out;
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? "" : "s"}`;

/** `<short> <date> <subject>; that commit changed n symbols`, from a `via` entry of the why recipe. */
function viaLine(v: unknown): string {
  const r = (v ?? {}) as Row;
  return `${str(r.commit)}; that commit changed ${plural(Number(r.symbols), "symbol")}`;
}

/**
 * The answer of `whygraph why`.
 * owns: [[whygraph-answers]]
 * post: four parts in order: decided tags in the symbol's doc comment; decided tags in its file's header; the decision records that those tags name (doc comment first), each saying which tag names it; the other records, linked only through a commit that changed the symbol, oldest first with undated records last.
 * post: each record shows date, id, title, status when stated, the records that supersede it, its source, and every commit that cites it and changed the symbol, with how many symbols that commit changed, so a reader can weigh the link; a record is listed once.
 * post: an empty part says it is empty; when nothing at all links, a last line says no decision is recorded and how one gets recorded.
 */
export function whyAnswer(symbolId: string, rows: readonly Row[]): string {
  const tags = rows.filter((r) => r.kind === "tag");
  const fileTags = rows.filter((r) => r.kind === "file tag");
  const records = rows.filter((r) => r.kind === "record");
  const named = records.filter((r) => list(r.named).length > 0);
  const viaCommit = records.filter((r) => list(r.named).length === 0);
  const file = symbolId.slice(0, symbolId.lastIndexOf("#"));
  const out = [`Why ${shown(symbolId)} is the way it is`, ""];
  out.push(tags.length === 0 ? "Its doc comment holds no decided: tag." : "Decided in its doc comment:", ...tagLines(tags));
  out.push(fileTags.length === 0 ? `The header of ${file} holds no decided: tag.` : `Decided in the header of ${file}:`, ...tagLines(fileTags));
  if (named.length === 0) out.push("No decided: tag names a decision record.");
  else {
    out.push("Decision records that its decided: tags name:");
    for (const r of named) {
      const where = list(r.named).map((w) => (w === "doc comment" ? "its doc comment" : `the header of ${file}`));
      const via = Array.isArray(r.via) ? r.via : [];
      out.push(...recordLines(r, [`      named by: a decided: tag in ${where.join(" and in ")}`, ...via.map((v, i) => `      ${i === 0 ? "also cited by:" : "              "} ${viaLine(v)}`)]));
    }
  }
  if (viaCommit.length === 0) out.push(`No ${named.length === 0 ? "" : "other "}decision record cites a commit that changed its code or tags.`);
  else {
    out.push(`Decision records linked only through a commit that cites them and changed its code or tags, oldest first (a commit that changed many symbols links each of them loosely):`);
    for (const r of viaCommit) out.push(...recordLines(r, (Array.isArray(r.via) ? r.via : []).map((v, i) => `      ${i === 0 ? "changed by:" : "           "} ${viaLine(v)}`)));
  }
  if (rows.length === 0) out.push("", "No decision is recorded for it. Record one with a decided: tag in its doc comment (naming the record's id links it), or a `Decision: <id>` trailer on the commit that made it.");
  return out.join("\n");
}

/**
 * The answer of `whygraph impact`.
 * owns: [[whygraph-answers]]
 * post: names the decision with its date and title, then each record that rests on it (the decision first, depth 0), in depth then id order, with the records that supersede it.
 * post: under each record, first the direct links: the symbols whose decided: tags name it, most used first with direct user count, and the files whose header tags name it; then the commits that cite it, each with how many symbols it changed, and the other symbols those commits changed, most used first with user count and commits; each empty part says so.
 * post: a total line counts distinct symbols across records, and how many of them a tag names and how many only a commit reaches.
 */
export function impactAnswer(decision: string, rows: readonly Row[]): string {
  const base = rows.find((r) => r.record === decision);
  const out = [`What rests on ${decision}${base !== undefined ? ` (${str(base.date) || "undated"}) ${str(base.title)}` : ""}`, ""];
  const others = rows.filter((r) => r.record !== decision).length;
  out.push(others === 0 ? "No other record rests on it." : `${others} record${others === 1 ? "" : "s"} rest${others === 1 ? "s" : ""} on it, directly or through others.`);
  const tagged = new Set<string>();
  const loose = new Set<string>();
  const symbolLine = (r: Row, commits: readonly string[]) => `    ${String(r.users).padStart(4)} user${Number(r.users) === 1 ? " " : "s"}  ${shown(str(r.symbol))}${commits.length === 0 ? "" : `  (${commits.join(", ")})`}`;
  const rowsOf = (v: unknown): readonly Row[] => (Array.isArray(v) ? (v as Row[]).filter((x) => x !== null) : []);
  for (const head of rows) {
    const depth = Number(head.depth);
    out.push("", `${depth === 0 ? "The decision itself" : depth === 1 ? "Rests on it directly" : `Rests on it through ${depth - 1} other record${depth === 2 ? "" : "s"}`}: ${str(head.record)} (${str(head.date) || "undated"}) ${str(head.title)}`);
    const by = sorted(list(head.supersededBy));
    if (by.length > 0) out.push(`  superseded by: ${by.join(", ")}`);
    const tags = rowsOf(head.tagged);
    const files = list(head.files);
    if (tags.length === 0 && files.length === 0) out.push("  No decided: tag names it.");
    if (tags.length > 0) {
      out.push(`  ${plural(tags.length, "symbol")} whose decided: tag names it, most used first (users = symbols whose code names it directly):`);
      for (const r of tags) {
        tagged.add(str(r.symbol));
        out.push(symbolLine(r, []));
      }
    }
    if (files.length > 0) out.push(`  ${plural(files.length, "file")} whose header decided: tag names it: ${files.join(", ")}`);
    const cites = rowsOf(head.cites);
    const changed = rowsOf(head.changed);
    if (cites.length === 0) out.push("  No commit in this repo's history cites it (a `Decision:` trailer, or a commit the record lists).");
    else {
      out.push(`  ${cites.length === 1 ? "1 commit cites" : `${cites.length} commits cite`} it:`, ...cites.map((c) => `    ${str(c.commit)} ${str(c.date)} ${str(c.subject)}; it changed ${plural(Number(c.symbols), "symbol")}`));
      if (changed.length === 0) out.push(`  ${cites.length === 1 ? "That commit changed" : "Those commits changed"} no ${tags.length === 0 ? "" : "other "}symbol that exists now.`);
      else {
        out.push(`  ${plural(changed.length, tags.length === 0 ? "symbol" : "other symbol")} ${cites.length === 1 ? "that commit" : "those commits"} changed, most used first (a loose link: a commit ties every symbol it changed):`);
        for (const r of changed) {
          loose.add(str(r.symbol));
          out.push(symbolLine(r, sorted(list(r.commits))));
        }
      }
    }
  }
  const onlyLoose = [...loose].filter((s) => !tagged.has(s)).length;
  out.push("", `${plural(tagged.size + onlyLoose, "distinct symbol")} in all: ${tagged.size} named by a decided: tag, ${onlyLoose} reached only through a commit.`);
  return out.join("\n");
}

/**
 * The answer of `whygraph carry`.
 * owns: [[whygraph-answers]]
 * post: in order: owned topics with their other owning files; formal checks that cover it with the command that re-runs each; premise memos; the decisions as `whyAnswer` lists them; direct and transitive users with distance; the commits that changed it, newest first.
 * post: for a symbol in a language whose uses memod does not read, the users part says they are unknown instead of none.
 */
export function carryAnswer(symbolId: string, carry: Row, why: readonly Row[], users: readonly Row[]): string {
  const file = str(carry.file);
  const out = [`Before you edit ${shown(symbolId)}`, ""];
  const topics = (Array.isArray(carry.topics) ? (carry.topics as Row[]) : []).filter((t) => t !== null);
  if (topics.length === 0) out.push("It owns no topic.");
  else {
    out.push("Topics it owns (keep its job inside these; another file that owns one and does not import this one is a duplicate):");
    for (const t of topics) {
      const others = list(t.otherOwners);
      out.push(`  - ${str(t.topic)}: ${others.length === 0 ? "no other file owns it" : `also owned by ${others.join(", ")}`}`);
    }
  }
  const checks = sorted(list(carry.checks));
  out.push(checks.length === 0 ? "No formal check covers it." : "Formal checks that cover it (run each again after a code change):", ...checks.map((c) => `  - memod verify ${c}`));
  const premises = sorted(list(carry.premises));
  out.push(premises.length === 0 ? "Its doc comment names no premise memo." : "Premise memos it rests on:", ...premises.map((p) => `  - ${p}`));
  out.push("", ...whyAnswer(symbolId, why).split("\n").slice(2), "");
  if (!hasSymbolEdges(file)) out.push(`Its users are unknown: memod reads which symbols use which only in TypeScript and JavaScript, not in ${file}.`);
  else if (users.length === 0) out.push("No symbol uses it.");
  else {
    const direct = users.filter((u) => Number(u.distance) === 1).length;
    out.push(`${direct} symbol${direct === 1 ? "" : "s"} use${direct === 1 ? "s" : ""} it directly, ${users.length} in all (distance n: through n-1 other symbols; type: only a type use):`);
    for (const u of users) out.push(`  ${String(u.distance).padStart(2)}  ${shown(str(u.user))}${u.typeOnly === true ? "  type" : ""}`);
  }
  const commits = list(carry.commits);
  out.push("", commits.length === 0 ? "No commit changed it (the repo has no history for it)." : `${commits.length} commit${commits.length === 1 ? "" : "s"} changed its code or tags, newest first:`, ...commits.map((c) => `  ${c}`));
  return out.join("\n");
}

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

/**
 * The answer of `whygraph why`.
 * owns: [[whygraph-answers]]
 * post: three parts in order: decided tags in the symbol's doc comment, decided tags in its file's header, and decision records whose cited commits changed the symbol, oldest first with undated records last, each with date, id, title, status when stated, the records that supersede it, its source and the commits that link it.
 * post: an empty part says it is empty; when all three are empty a last line says no decision is recorded and how one gets recorded.
 */
export function whyAnswer(symbolId: string, rows: readonly Row[]): string {
  const tags = rows.filter((r) => r.kind === "tag");
  const fileTags = rows.filter((r) => r.kind === "file tag");
  const records = rows.filter((r) => r.kind === "record");
  const file = symbolId.slice(0, symbolId.lastIndexOf("#"));
  const out = [`Why ${shown(symbolId)} is the way it is`, ""];
  out.push(tags.length === 0 ? "Its doc comment holds no decided: tag." : "Decided in its doc comment:", ...tagLines(tags));
  out.push(fileTags.length === 0 ? `The header of ${file} holds no decided: tag.` : `Decided in the header of ${file}:`, ...tagLines(fileTags));
  if (records.length === 0) out.push("No decision record cites a commit that changed its code or tags.");
  else {
    out.push("Decision records that cite a commit that changed its code or tags, oldest first:");
    for (const r of records) out.push(...recordLines(r, list(r.via).map((v, i) => `      ${i === 0 ? "changed by:" : "           "} ${v}`)));
  }
  if (rows.length === 0) out.push("", "No decision is recorded for it. Record one with a decided: tag in its doc comment, or a decision record that cites the commit that made it.");
  return out.join("\n");
}

/**
 * The answer of `whygraph impact`.
 * owns: [[whygraph-answers]]
 * post: names the decision with its date and title, then each record that rests on it (the decision first, depth 0), in depth then id order, with the records that supersede it.
 * post: under each record: the symbols its cited commits changed, most used first, with direct user count and the commits; or a sentence that its commits changed no symbol that exists now, or that it cites no commit the graph has.
 * post: a total line counts distinct symbols across records.
 */
export function impactAnswer(decision: string, rows: readonly Row[]): string {
  const byRecord = new Map<string, Row[]>();
  for (const r of rows) byRecord.set(str(r.record), [...(byRecord.get(str(r.record)) ?? []), r]);
  const base = rows.find((r) => r.record === decision);
  const out = [`What rests on ${decision}${base !== undefined ? ` (${str(base.date) || "undated"}) ${str(base.title)}` : ""}`, ""];
  const others = [...byRecord.keys()].filter((k) => k !== decision);
  out.push(others.length === 0 ? "No other record rests on it." : `${others.length} record${others.length === 1 ? "" : "s"} rest${others.length === 1 ? "s" : ""} on it, directly or through others.`);
  const symbols = new Set<string>();
  for (const [id, rs] of byRecord) {
    const head = rs[0]!;
    const depth = Number(head.depth);
    out.push("", `${depth === 0 ? "The decision itself" : depth === 1 ? "Rests on it directly" : `Rests on it through ${depth - 1} other record${depth === 2 ? "" : "s"}`}: ${id} (${str(head.date) || "undated"}) ${str(head.title)}`);
    const by = sorted(list(head.supersededBy));
    if (by.length > 0) out.push(`  superseded by: ${by.join(", ")}`);
    const changed = rs.filter((r) => r.symbol !== null && r.symbol !== undefined);
    if (changed.length === 0) out.push("  Its cited commits changed no symbol that exists now, or it cites no commit in this repo's history.");
    else {
      out.push(`  ${changed.length} symbol${changed.length === 1 ? "" : "s"} its cited commits changed, most used first (users = symbols whose code names it directly):`);
      for (const r of changed) {
        symbols.add(str(r.symbol));
        out.push(`    ${String(r.users).padStart(4)} user${r.users === 1 ? " " : "s"}  ${shown(str(r.symbol))}  (${sorted(list(r.commits)).join(", ")})`);
      }
    }
  }
  out.push("", `${symbols.size} distinct symbol${symbols.size === 1 ? "" : "s"} in all.`);
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

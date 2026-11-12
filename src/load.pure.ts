/**
 * module: [[whygraph-store-load]]
 * boundary: pure
 * imports: ./code-graph.pure.ts, ./links.pure.ts, ./records.pure.ts
 */
import { symbolParts, type CodeGraph } from "./code-graph.pure.ts";
import type { TagLink } from "./links.pure.ts";
import type { CheckedRecords } from "./records.pure.ts";

/** One load statement; when it reads rows, it reads them as the parameter `param`. */
export interface LoadStep {
  readonly cypher: string;
  readonly param: string | null;
  readonly rows: readonly Record<string, unknown>[];
}

/** A statement before its parameter is named: `$rows` stands for its rows. */
interface Draft {
  readonly cypher: string;
  readonly rows: readonly Record<string, unknown>[];
}

/** Node labels and the property that keys each, as the store and the recipes name them. */
const NODE_KEYS = {
  File: "path",
  Package: "specifier",
  Symbol: "id",
  Topic: "slug",
  DecidedTag: "hash",
  Check: "name",
  Memo: "ref",
  Commit: "sha",
  Decision: "id",
} as const;

type Label = keyof typeof NODE_KEYS;

/** Rows per statement: far below relate's 100,000 evaluation passes and 64 MiB WAL record per statement. */
const CHUNK = 5000;

const LABEL_OF: Readonly<Record<string, Label>> = {
  file: "File",
  package: "Package",
  symbol: "Symbol",
  topic: "Topic",
  decision: "DecidedTag",
  check: "Check",
  memo: "Memo",
  commit: "Commit",
};

/** The memod node id `<kind>:<name>` split into its label and key value, or undefined for a kind whygraph does not load. */
function nodeRef(id: string): { readonly label: Label; readonly key: string } | undefined {
  const colon = id.indexOf(":");
  const label = LABEL_OF[id.slice(0, colon)];
  return label === undefined ? undefined : { label, key: id.slice(colon + 1) };
}

/** A statement that creates one node per row; `props` are the row fields stored, the key first. */
function nodeStep(label: Label, props: readonly string[], rows: readonly Record<string, unknown>[]): Draft[] {
  const map = props.map((p) => `${p}: r.${p}`).join(", ");
  return chunks(rows).map((c) => ({ cypher: `UNWIND $rows AS r CREATE (:${label} {${map}})`, rows: c }));
}

/** A statement that creates one relationship per row between two existing nodes found by key (`r.from`, `r.to`). */
function edgeStep(type: string, from: Label, to: Label, props: readonly string[], rows: readonly Record<string, unknown>[]): Draft[] {
  const map = props.length === 0 ? "" : ` {${props.map((p) => `${p}: r.${p}`).join(", ")}}`;
  const cypher = `UNWIND $rows AS r MATCH (a:${from} {${NODE_KEYS[from]}: r.from}) MATCH (b:${to} {${NODE_KEYS[to]}: r.to}) CREATE (a)-[:${type}${map}]->(b)`;
  return chunks(rows).map((c) => ({ cypher, rows: c }));
}

function chunks<T>(rows: readonly T[]): (readonly T[])[] {
  const out: (readonly T[])[] = [];
  for (let i = 0; i < rows.length; i += CHUNK) out.push(rows.slice(i, i + CHUNK));
  return out;
}

/** Groups edge rows by the labels of their two ends, so each group is one statement shape. */
function grouped(rows: readonly { readonly from: string; readonly to: string; readonly props: Record<string, unknown> }[]): Map<string, { from: Label; to: Label; rows: Record<string, unknown>[] }> {
  const groups = new Map<string, { from: Label; to: Label; rows: Record<string, unknown>[] }>();
  for (const r of rows) {
    const a = nodeRef(r.from);
    const b = nodeRef(r.to);
    if (a === undefined || b === undefined) continue;
    const k = `${a.label}>${b.label}`;
    const g = groups.get(k) ?? { from: a.label, to: b.label, rows: [] };
    g.rows.push({ from: a.key, to: b.key, ...r.props });
    groups.set(k, g);
  }
  return new Map([...groups].sort(([x], [y]) => (x < y ? -1 : 1)));
}

/**
 * The statements that load one code graph and its decision records into an empty store.
 * owns: [[whygraph-store-load]]
 * post: indexes on every node key come first, then every node, then every relationship, so each MATCH of an edge statement finds its ends by index.
 * post: each memod node kind maps to one label (file File, package Package, symbol Symbol, topic Topic, decision DecidedTag, check Check, memo Memo, commit Commit); a kind memod adds later is skipped.
 * post: relationships: File DECLARES Symbol; File IMPORTS File or Package; File OWNS Topic and each named Symbol OWNS Topic; Symbol USES Symbol; Symbol or File DECIDED DecidedTag, VERIFIED Check, PREMISE Memo; Commit CHANGES File or Symbol; DecidedTag NAMES Decision (one per `names` link); Decision STATES Item, ABOUT Topic, RESTS_ON and SUPERSEDES Decision, CITES Commit (one per commit in `checked.cites`).
 * post: a record topic that no code owns still gets a Topic node; a Decision's `source` is its own source or else the decisions file it came from.
 * post: no statement holds more than 5000 rows; statement i that reads rows reads them as `$p<i>`, and a statement without rows has no parameter.
 * decided: the store is built with CREATE into an empty directory, not MERGE into an old one, because a rebuild must never keep a node that the repo no longer has
 */
export function loadPlan(graph: CodeGraph, checked: CheckedRecords, names: readonly TagLink[], recordFiles: ReadonlyMap<string, string>): readonly LoadStep[] {
  const steps: Draft[] = (Object.entries(NODE_KEYS) as [Label, string][]).map(([label, key]) => ({ cypher: `CREATE INDEX ${label.toLowerCase()}_${key} IF NOT EXISTS FOR (n:${label}) ON (n.${key})`, rows: [] }));
  const of = (kind: string) => graph.nodes.filter((n) => n.kind === kind);
  steps.push(...nodeStep("File", ["path"], of("file").map((n) => ({ path: n.name }))));
  steps.push(...nodeStep("Package", ["specifier"], of("package").map((n) => ({ specifier: n.name }))));
  steps.push(...nodeStep("Symbol", ["id", "path", "name"], of("symbol").map((n) => ({ id: n.name, ...symbolParts(n.name) }))));
  const codeTopics = new Set(of("topic").map((n) => n.name));
  const recordTopics = checked.records.flatMap((r) => r.topics).filter((t) => !codeTopics.has(t));
  steps.push(...nodeStep("Topic", ["slug"], [...codeTopics, ...new Set(recordTopics)].sort().map((slug) => ({ slug }))));
  steps.push(...nodeStep("DecidedTag", ["hash", "what", "because"], of("decision").map((n) => ({ hash: n.id.slice("decision:".length), what: n.what ?? n.name, because: n.because ?? "" }))));
  steps.push(...nodeStep("Check", ["name"], of("check").map((n) => ({ name: n.name }))));
  steps.push(...nodeStep("Memo", ["ref"], of("memo").map((n) => ({ ref: n.name }))));
  steps.push(...nodeStep("Commit", ["sha", "short", "date", "subject"], of("commit").map((n) => ({ sha: n.name, short: n.name.slice(0, 7), date: n.date ?? null, subject: n.subject ?? null }))));
  steps.push(
    ...nodeStep(
      "Decision",
      ["id", "title", "date", "status", "source"],
      checked.records.map((r) => ({ id: r.id, title: r.title, date: r.date, status: r.status, source: r.source ?? recordFiles.get(r.id) ?? null })),
    ),
  );

  steps.push(...edgeStep("DECLARES", "File", "Symbol", [], of("symbol").map((n) => ({ from: symbolParts(n.name).path, to: n.name }))));
  const edges = (kind: string) => graph.edges.filter((e) => e.kind === kind);
  for (const g of grouped(edges("imports").map((e) => ({ from: e.from, to: e.to, props: { specifier: e.specifier ?? null, line: e.line ?? null, typeOnly: e.typeOnly ?? false } }))).values()) {
    steps.push(...edgeStep("IMPORTS", g.from, g.to, ["specifier", "line", "typeOnly"], g.rows));
  }
  const owns = edges("owns");
  steps.push(...edgeStep("OWNS", "File", "Topic", [], owns.map((e) => ({ from: e.from.slice("file:".length), to: e.to.slice("topic:".length) }))));
  steps.push(
    ...edgeStep(
      "OWNS",
      "Symbol",
      "Topic",
      [],
      owns.flatMap((e) => (e.symbols ?? []).map((s) => ({ from: `${e.from.slice("file:".length)}#${s}`, to: e.to.slice("topic:".length) }))),
    ),
  );
  steps.push(...edgeStep("USES", "Symbol", "Symbol", ["typeOnly"], edges("uses").map((e) => ({ from: e.from.slice("symbol:".length), to: e.to.slice("symbol:".length), typeOnly: e.typeOnly ?? false }))));
  for (const [kind, type] of [
    ["decided", "DECIDED"],
    ["verified", "VERIFIED"],
    ["premise", "PREMISE"],
    ["changes", "CHANGES"],
  ] as const) {
    for (const g of grouped(edges(kind).map((e) => ({ from: e.from, to: e.to, props: {} }))).values()) steps.push(...edgeStep(type, g.from, g.to, [], g.rows));
  }

  const items = checked.records.flatMap((r) => r.items.map((it, ord) => ({ id: r.id, ord, label: it.label, text: it.text })));
  for (const c of chunks(items)) {
    steps.push({ cypher: "UNWIND $rows AS r MATCH (d:Decision {id: r.id}) CREATE (d)-[:STATES]->(:Item {ord: r.ord, label: r.label, text: r.text})", rows: c });
  }
  steps.push(...edgeStep("NAMES", "DecidedTag", "Decision", [], names.map((l) => ({ from: l.hash, to: l.id }))));
  steps.push(...edgeStep("ABOUT", "Decision", "Topic", [], checked.records.flatMap((r) => r.topics.map((t) => ({ from: r.id, to: t })))));
  steps.push(...edgeStep("RESTS_ON", "Decision", "Decision", [], checked.records.flatMap((r) => r.restsOn.map((t) => ({ from: r.id, to: t })))));
  steps.push(...edgeStep("SUPERSEDES", "Decision", "Decision", [], checked.records.flatMap((r) => r.supersedes.map((t) => ({ from: r.id, to: t })))));
  steps.push(...edgeStep("CITES", "Decision", "Commit", [], checked.records.flatMap((r) => (checked.cites.get(r.id) ?? []).map((sha) => ({ from: r.id, to: sha })))));
  return steps.map((s, i) => (s.rows.length === 0 ? { cypher: s.cypher, param: null, rows: [] } : { cypher: s.cypher.replace("$rows", `$p${i}`), param: `p${i}`, rows: s.rows }));
}

/**
 * module: [[whygraph-store-load]]
 * boundary: pure
 * imports: ./code-graph.pure.ts, ./links.pure.ts, ./records.pure.ts, ./terms.pure.ts
 */
import { symbolParts, type CodeGraph } from "./code-graph.pure.ts";
import type { TagLink } from "./links.pure.ts";
import type { CheckedRecords, DecisionRecord } from "./records.pure.ts";
import { termEdges, termNodes, type TermCounts } from "./terms.pure.ts";

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
  Symbol: "id",
  Topic: "slug",
  DecidedTag: "hash",
  Check: "name",
  Commit: "sha",
  Decision: "id",
  Term: "text",
} as const;

type Label = keyof typeof NODE_KEYS;

/** Row limit below relate's 100,000 evaluation passes per statement. */
const CHUNK = 5000;

/**
 * UTF-8 bytes of each statement's JSON row array, including brackets and commas.
 * Relate 1.0.1 logs typed values rather than parameter JSON. The 4770-record
 * Hono build measured at most 1,891,207 WAL payload bytes per statement with
 * this budget: 35.48 times below its 64 MiB cap. The original Decision rows
 * hit that cap in one statement. A row over this budget must stand alone.
 */
const CHUNK_BYTES = 1024 * 1024;
const UTF8 = new TextEncoder();

const LABEL_OF: Readonly<Record<string, Label>> = {
  file: "File",
  symbol: "Symbol",
  topic: "Topic",
  decision: "DecidedTag",
  check: "Check",
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
  let start = 0;
  let bytes = 2;
  for (let i = 0; i < rows.length; i++) {
    const rowBytes = UTF8.encode(JSON.stringify(rows[i])).byteLength;
    if (i > start && (i - start === CHUNK || bytes + 1 + rowBytes > CHUNK_BYTES)) {
      out.push(rows.slice(start, i));
      start = i;
      bytes = 2;
    }
    bytes += (i > start ? 1 : 0) + rowBytes;
  }
  if (start < rows.length) out.push(rows.slice(start));
  return out;
}

/**
 * owns: [[whygraph-store-load]]
 * post: the text a record is searched by: its title and the text of each of its statements, one per line.
 */
export function recordText(r: DecisionRecord): string {
  return [r.title ?? "", ...r.items.map((i) => i.text)].filter((s) => s.trim() !== "").join("\n");
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
 * post: indexes on every node key come first, then a full-text index `decision_search` over `Decision.searchText` and a vector index `decision_search_vector` over `Decision.vector` (384 dimensions, cosine), then every node, then every relationship, so each MATCH of an edge statement finds its ends by index.
 * post: the loaded memod kinds map to labels (file File, symbol Symbol, topic Topic, decision DecidedTag, check Check, commit Commit); package, memo and unknown kinds are skipped.
 * post: a Symbol holds `line` and `endLine`, the 1-based inclusive source span memod gives it (without its doc comment), or null when memod gave no span.
 * post: relationships: File DECLARES Symbol; File OWNS Topic and each named Symbol OWNS Topic; Symbol USES Symbol; Symbol or File DECIDED DecidedTag, VERIFIED Check; Commit CHANGES File or Symbol; DecidedTag NAMES Decision (one per `names` link); Decision STATES Item, MENTIONS Term (one per kept term of the record's text, with how many times that text holds it), RESTS_ON and SUPERSEDES Decision, CITES Commit (one per commit in `checked.cites`).
 * post: a Term node per kept term (`termNodes`), keyed by its text, holding `records`, the number of records that use it; a record's `termCount` is every term of its text, before the common-term rule, so the average record length a BM25 query needs counts dropped terms too.
 * post: a Decision's `source` is its own source or else the decisions file it came from; a Decision's `author` is the record's author, or null when the record has none; a Decision's `searchText` is its title and the text of each of its statements, one per line, which the full-text index holds, and its `vector` is `vectors`' 384-float embedding of that text, which the vector index holds.
 * post: `vectors` holds one embedding per record id, from `recordText` of that record; the caller embeds, so this plan stays pure.
 * post: `terms` holds the term counts of `recordText` of every record; the caller tokenizes, so this plan stays pure, and a term the common-term rule drops gets no node and no edge.
 * post: each row statement holds at most 5000 rows and at most 1 MiB of UTF-8 JSON for its row array, including brackets and commas; a row whose array alone exceeds 1 MiB stands alone. Empty row lists emit no row statement, and splitting preserves row order and content.
 * post: statement i that reads rows reads them as `$p<i>`, after all splits; a statement without rows has no parameter.
 * decided: the store is built with CREATE into an empty directory, not MERGE into an old one, because a rebuild must never keep a node that the repo no longer has
 */
export function loadPlan(graph: CodeGraph, checked: CheckedRecords, names: readonly TagLink[], recordFiles: ReadonlyMap<string, string>, vectors: ReadonlyMap<string, readonly number[]>, terms: TermCounts): readonly LoadStep[] {
  const steps: Draft[] = (Object.entries(NODE_KEYS) as [Label, string][]).map(([label, key]) => ({ cypher: `CREATE INDEX ${label.toLowerCase()}_${key} IF NOT EXISTS FOR (n:${label}) ON (n.${key})`, rows: [] }));
  steps.push({ cypher: "CREATE FULLTEXT INDEX decision_search IF NOT EXISTS FOR (n:Decision) ON EACH [n.searchText]", rows: [] });
  steps.push({ cypher: 'CREATE VECTOR INDEX decision_search_vector IF NOT EXISTS FOR (n:Decision) ON (n.vector) OPTIONS {indexConfig: {`vector.dimensions`: 384, `vector.similarity_function`: "cosine"}}', rows: [] });
  const of = (kind: string) => graph.nodes.filter((n) => n.kind === kind);
  steps.push(...nodeStep("File", ["path"], of("file").map((n) => ({ path: n.name }))));
  steps.push(...nodeStep("Symbol", ["id", "path", "name", "line", "endLine"], of("symbol").map((n) => ({ id: n.name, ...symbolParts(n.name), line: n.line ?? null, endLine: n.endLine ?? null }))));
  const codeTopics = new Set(of("topic").map((n) => n.name));
  steps.push(...nodeStep("Topic", ["slug"], [...codeTopics].sort().map((slug) => ({ slug }))));
  steps.push(...nodeStep("DecidedTag", ["hash", "what", "because"], of("decision").map((n) => ({ hash: n.id.slice("decision:".length), what: n.what ?? n.name, because: n.because ?? "" }))));
  steps.push(...nodeStep("Check", ["name"], of("check").map((n) => ({ name: n.name }))));
  steps.push(...nodeStep("Commit", ["sha", "short", "date", "subject"], of("commit").map((n) => ({ sha: n.name, short: n.name.slice(0, 7), date: n.date ?? null, subject: n.subject ?? null }))));
  steps.push(
    ...nodeStep(
      "Decision",
      ["id", "title", "date", "status", "author", "source", "searchText", "vector", "termCount"],
      checked.records.map((r) => ({ id: r.id, title: r.title, date: r.date, status: r.status, author: r.author, source: r.source ?? recordFiles.get(r.id) ?? null, searchText: recordText(r), vector: vectors.get(r.id) ?? null, termCount: terms.totals.get(r.id) ?? 0 })),
    ),
  );
  steps.push(...nodeStep("Term", ["text", "records"], termNodes(terms)));
  steps.push(...edgeStep("MENTIONS", "Decision", "Term", ["count"], termEdges(terms)));

  steps.push(...edgeStep("DECLARES", "File", "Symbol", [], of("symbol").map((n) => ({ from: symbolParts(n.name).path, to: n.name }))));
  const edges = (kind: string) => graph.edges.filter((e) => e.kind === kind);
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
    ["changes", "CHANGES"],
  ] as const) {
    for (const g of grouped(edges(kind).map((e) => ({ from: e.from, to: e.to, props: {} }))).values()) steps.push(...edgeStep(type, g.from, g.to, [], g.rows));
  }

  const items = checked.records.flatMap((r) => r.items.map((it, ord) => ({ id: r.id, ord, label: it.label, text: it.text })));
  for (const c of chunks(items)) {
    steps.push({ cypher: "UNWIND $rows AS r MATCH (d:Decision {id: r.id}) CREATE (d)-[:STATES]->(:Item {ord: r.ord, label: r.label, text: r.text})", rows: c });
  }
  steps.push(...edgeStep("NAMES", "DecidedTag", "Decision", [], names.map((l) => ({ from: l.hash, to: l.id }))));
  steps.push(...edgeStep("RESTS_ON", "Decision", "Decision", [], checked.records.flatMap((r) => r.restsOn.map((t) => ({ from: r.id, to: t })))));
  steps.push(...edgeStep("SUPERSEDES", "Decision", "Decision", [], checked.records.flatMap((r) => r.supersedes.map((t) => ({ from: r.id, to: t })))));
  steps.push(...edgeStep("CITES", "Decision", "Commit", [], checked.records.flatMap((r) => (checked.cites.get(r.id) ?? []).map((sha) => ({ from: r.id, to: sha })))));
  return steps.map((s, i) => (s.rows.length === 0 ? { cypher: s.cypher, param: null, rows: [] } : { cypher: s.cypher.replace("$rows", `$p${i}`), param: `p${i}`, rows: s.rows }));
}

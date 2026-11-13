/**
 * module: [[whygraph-rerank]]
 * boundary: pure
 * imports: ./search.pure.ts, ./answers.pure.ts
 * decided: the reranker is off unless WHYGRAPH_RERANK names a model, because the wide candidate list stays the default and no request text or record text leaves the machine without an explicit opt-in
 * decided: a failure of the rerank call falls back to the wide answer with one line naming the failure, because a short list is a convenience and never a reason to withhold candidates
 */
import { rangeTermLines, type TermCandidate, type TermSection } from "./answers.pure.ts";
import { candidateLines, searchAnswer, type Candidate } from "./search.pure.ts";

/**
 * The number of records a reranked answer lists.
 * owns: [[whygraph-rerank]]
 */
export const RERANK_TOP_N = 5;

/**
 * The fewest candidates worth a rerank call; below this the wide list is already short.
 * owns: [[whygraph-rerank]]
 */
export const RERANK_MIN = 6;

/**
 * The most characters of one candidate's title and first statement sent as its document.
 * owns: [[whygraph-rerank]]
 */
export const DOCUMENT_LIMIT = 600;

/**
 * The most characters of the code lines sent in the query.
 * owns: [[whygraph-rerank]]
 */
export const CODE_LIMIT = 3000;

/** The 1-based inclusive lines a `search --at` targets, with the file's lines. */
export interface RerankCode {
  readonly path: string;
  readonly start: number;
  readonly end: number;
  readonly lines: readonly string[];
}

/** One record a search answer can list, with how it matched and the terms it shares with the code. */
export interface SearchRecord {
  readonly id: string;
  readonly date: string;
  readonly title: string;
  readonly source: string;
  readonly statement: string;
  readonly match: string;
  readonly shared: readonly string[];
}

/**
 * The `matched:` label for the lists that held one record, in the order words, meaning, terms.
 * owns: [[whygraph-rerank]]
 */
export function matchLabel(lists: { readonly words?: boolean; readonly meaning?: boolean; readonly terms?: boolean }): string {
  return [lists.words === true ? "words" : "", lists.meaning === true ? "meaning" : "", lists.terms === true ? "terms" : ""].filter((s) => s !== "").join(" and ");
}

function listsOf(match: string): { words: boolean; meaning: boolean; terms: boolean } {
  return { words: match.includes("words"), meaning: match.includes("meaning"), terms: match.includes("terms") };
}

/**
 * The fused candidates and the term-list candidates as one list, each record once, the fused order first.
 * owns: [[whygraph-rerank]]
 * post: a record in both lists keeps its fused position and its `matched:` label gains `terms`; a term-only record follows the fused list in term order; `statement` is the fused statement or `statements`' entry.
 */
export function searchRecords(fused: readonly Candidate[], term: readonly TermCandidate[], statements: ReadonlyMap<string, string> = new Map()): readonly SearchRecord[] {
  const out = new Map<string, SearchRecord>();
  for (const c of fused) out.set(c.id, { id: c.id, date: c.date, title: c.title, source: c.source, statement: c.statement, match: c.match, shared: [] });
  for (const t of term) {
    const at = out.get(t.id);
    if (at === undefined) out.set(t.id, { id: t.id, date: t.date, title: t.title, source: t.source, statement: statements.get(t.id) ?? "", match: "terms", shared: t.shared });
    else out.set(t.id, { ...at, match: matchLabel({ ...listsOf(at.match), terms: true }), shared: t.shared });
  }
  return [...out.values()];
}

/**
 * The query a rerank call sends: the request, and with `--at`, a blank line, `Code it would change:` and the lines, at most `CODE_LIMIT` characters.
 * owns: [[whygraph-rerank]]
 */
export function rerankQuery(request: string, code?: RerankCode): string {
  if (code === undefined) return request;
  const lines = code.lines.slice(code.start - 1, code.end).join("\n").slice(0, CODE_LIMIT);
  return `${request}\n\nCode it would change:\n${lines}`;
}

/**
 * One document per candidate: its title, then ` | ` and its first statement when that adds text, at most `DOCUMENT_LIMIT` characters.
 * owns: [[whygraph-rerank]]
 */
export function rerankDocuments(records: readonly SearchRecord[]): readonly string[] {
  return records.map((r) => {
    const parts = [r.title, r.statement !== "" && !r.title.includes(r.statement) ? r.statement : ""].filter((p) => p !== "");
    return parts.join(" | ").slice(0, DOCUMENT_LIMIT);
  });
}

/**
 * The JSON body of a rerank call.
 * owns: [[whygraph-rerank]]
 */
export function rerankBody(model: string, query: string, documents: readonly string[]): { readonly model: string; readonly query: string; readonly documents: readonly string[]; readonly top_n: number } {
  return { model, query, documents, top_n: RERANK_TOP_N };
}

/** The five records a rerank call kept, or why its response was not usable. */
export type RerankPick = { readonly ok: true; readonly records: readonly SearchRecord[] } | { readonly ok: false; readonly reason: string };

/**
 * Maps a reranker response back to candidates: the first `RERANK_TOP_N` results in the reranker's order.
 * owns: [[whygraph-rerank]]
 * post: `{results: [{index, ...}]}` with an integer index inside the candidate list is the expected shape; a missing or malformed result, a repeated index, an index outside the list, and fewer results than `RERANK_TOP_N` while more candidates exist each give `ok: false` with the failure kind.
 * post: `relevance_score` is read as nothing: a score is not a confidence, so only the order is used.
 */
export function applyRerank(records: readonly SearchRecord[], value: unknown): RerankPick {
  if (typeof value !== "object" || value === null || !Array.isArray((value as { results?: unknown }).results)) return { ok: false, reason: "unexpected response" };
  const results = (value as { results: readonly unknown[] }).results;
  const indexes: number[] = [];
  const seen = new Set<number>();
  for (const entry of results) {
    if (typeof entry !== "object" || entry === null) return { ok: false, reason: "unexpected response" };
    const index = (entry as { index?: unknown }).index;
    if (!Number.isInteger(index)) return { ok: false, reason: "unexpected response" };
    if ((index as number) < 0 || (index as number) >= records.length) return { ok: false, reason: "index out of range" };
    if (seen.has(index as number)) return { ok: false, reason: "unexpected response" };
    seen.add(index as number);
    indexes.push(index as number);
  }
  if (indexes.length < Math.min(RERANK_TOP_N, records.length)) return { ok: false, reason: "too few results" };
  return { ok: true, records: indexes.slice(0, RERANK_TOP_N).map((i) => records[i]!) };
}

/**
 * The answer of a successful rerank: how many candidates were ranked and by which model, the five records in the reranker's order, and one line saying what was sent and where.
 * owns: [[whygraph-rerank]]
 * post: each record takes the same two lines a search candidate takes; no score is printed; the last line names the endpoint's host, never the endpoint's path or an authorization header.
 */
export function rerankAnswer(model: string, host: string, ranked: number, picked: readonly SearchRecord[], code?: RerankCode): string {
  const out = [`Reranked ${ranked} candidate${ranked === 1 ? "" : "s"} with ${model}, best first (the five it kept; a candidate, not a link: read the record and judge whether it governs your change):`];
  for (const r of picked) out.push(...candidateLines(r));
  out.push(
    code === undefined
      ? `Sent to ${host}: the request and the title and first statement of each of the ${ranked} candidates.`
      : `Sent to ${host}: the request, the lines of ${code.path}:${code.start}-${code.end}, and the title and first statement of each of the ${ranked} candidates.`,
  );
  return out.join("\n");
}

/**
 * One line naming why the rerank call was not used, appended to the wide answer.
 * owns: [[whygraph-rerank]]
 */
export function rerankFailure(reason: string): string {
  return `Rerank failed (${reason}); showing every candidate.`;
}

/**
 * The wide answer of `search --at`: the fused answer with the term-list candidates inserted before its scope lines.
 * owns: [[whygraph-rerank]]
 * post: the fused heading and candidates stay exactly as `searchAnswer` prints them; the term section names the candidates not already listed, or one line saying why none; the `Searched:` and `Not searched:` lines stay last.
 */
export function searchAtAnswer(request: string, words: string, fused: readonly Candidate[], term: TermSection): string {
  const lines = searchAnswer(request, words, true, fused).split("\n");
  const scope = lines.splice(-2);
  return [...lines, ...rangeTermLines(term, new Set(fused.map((c) => c.id))), ...scope].join("\n");
}

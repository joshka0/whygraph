/**
 * module: [[whygraph-search]]
 * boundary: pure
 * imports: none
 * decided: search shows a short ranked list and says a listed record is a candidate, not a link, because a trial found that neither a word score nor a meaning score separates a record that governs a change from noise, so only a reader can judge the list
 */

/** A row as relate returns it. */
export type Row = Readonly<Record<string, unknown>>;

/** One candidate decision record. */
export interface Candidate {
  readonly id: string;
  readonly date: string;
  readonly title: string;
  readonly source: string;
  /** The first line of the record's first statement. */
  readonly statement: string;
}

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

/**
 * owns: [[whygraph-search]]
 * post: the words of `text`: every run of letters, digits and `_`, joined by one space, in order; everything else is dropped, so no character the full-text query syntax reads as an operator reaches the index.
 * decided: a request is plain words, because a stray `-`, `:`, `*` or quote must not remove or add a term
 */
export function searchWords(text: string): string {
  return (text.match(/[\p{L}\p{N}_]+/gu) ?? []).join(" ");
}

/**
 * owns: [[whygraph-search]]
 * post: the first line of `text` (`\n`, `\r\n` or `\r` ends it), or the whole text when it has no line break.
 */
export function firstLine(text: string): string {
  return text.split(/\r\n|\r|\n/, 1)[0] ?? "";
}

/**
 * The answer of `whygraph search`.
 * owns: [[whygraph-search]]
 * post: when `candidates` is empty, `No record matches "<request>".`; else a heading that says a listed record is a candidate, not a link, then one block per record: date, id, title, the first line of its statement, and its source.
 * post: always ends with `Searched:` naming the words, then `Not searched:`.
 */
export function searchAnswer(request: string, words: string, candidates: readonly Candidate[]): string {
  const query = request.trim().replace(/\s+/g, " ");
  const out: string[] = [];
  if (candidates.length === 0) out.push(`No record matches "${query}".`);
  else {
    out.push(`Decision records that match "${query}", best match first (a candidate, not a link: read the record and judge whether it governs your change):`);
    for (const c of candidates) {
      out.push(`  ${c.date || "undated   "}  ${c.id}  ${c.title || "(no title)"}`);
      out.push(`      statement: ${c.statement || "(none)"}`);
      out.push(`      source: ${c.source || "(not stated)"}`);
    }
  }
  out.push(`Searched: the title and statement of every decision record in the store, for the words: ${words}.`);
  out.push("Not searched: the code, the commits and the tags (run whygraph why or carry on a symbol for the links the graph holds); a record's id, date, status, topics and source (only its title and statement are indexed).");
  return out.join("\n");
}

/**
 * owns: [[whygraph-search]]
 * post: the search recipe's rows as candidates in row order.
 */
export function candidates(rows: readonly Row[]): readonly Candidate[] {
  return rows.map((r) => ({
    id: str(r.id),
    date: str(r.date),
    title: str(r.title),
    source: str(r.source),
    statement: firstLine(str(r.statement)),
  }));
}

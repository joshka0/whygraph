/**
 * module: [[whygraph-search]]
 * boundary: pure
 * imports: none
 * decided: search shows a short ranked list and says a listed record is a candidate, not a link, because a trial found that neither a word score nor a meaning score separates a record that governs a change from noise, so only a reader can judge the list
 */

/** A row as relate returns it. */
export type Row = Readonly<Record<string, unknown>>;

/** One candidate decision record, with how it matched. */
export interface Candidate {
  readonly id: string;
  readonly date: string;
  readonly title: string;
  readonly source: string;
  /** The first line of the record's first statement. */
  readonly statement: string;
  /** `words`, `meaning` or `words and meaning`. */
  readonly match: string;
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

/** One recipe row as a candidate. */
function candidate(r: Row, match: string): Candidate {
  return { id: str(r.id), date: str(r.date), title: str(r.title), source: str(r.source), statement: firstLine(str(r.statement)), match };
}

/**
 * The answer of `whygraph search`.
 * owns: [[whygraph-search]]
 * post: when `candidates` is empty, `No record matches "<request>".`; else a heading that says a listed record is a candidate, not a link, then one block per record: date, id, title, the first line of its statement, its source, and, when `meaning` is true, a `matched:` line naming `words`, `meaning` or `words and meaning`.
 * post: always ends with `Searched:` naming the words and, when `meaning` is true, the meaning search, then `Not searched:`.
 */
export function searchAnswer(request: string, words: string, meaning: boolean, candidates: readonly Candidate[]): string {
  const query = request.trim().replace(/\s+/g, " ");
  const out: string[] = [];
  if (candidates.length === 0) out.push(`No record matches "${query}".`);
  else {
    out.push(`Decision records that match "${query}", best match first (a candidate, not a link: read the record and judge whether it governs your change):`);
    for (const c of candidates) {
      out.push(`  ${c.date || "undated   "}  ${c.id}  ${c.title || "(no title)"}`);
      if (meaning) out.push(`      matched: ${c.match}`);
      out.push(`      statement: ${c.statement || "(none)"}`);
      out.push(`      source: ${c.source || "(not stated)"}`);
    }
  }
  out.push(`Searched: the title and statement of every decision record in the store, for the words: ${words}${meaning ? ", and for the meaning of the request" : ""}.`);
  out.push("Not searched: the code, the commits and the tags (run whygraph why or carry on a symbol for the links the graph holds); a record's id, date, status, topics and source (only its title and statement are indexed).");
  return out.join("\n");
}

/**
 * The two search recipes' rows as one list of candidates, by reciprocal rank fusion.
 * owns: [[whygraph-search]]
 * post: an id in `wordRows` or `meaningRows` scores `1 / (60 + its 1-based rank)` for each list it is in; the candidates are the highest total first, then id, at most `limit`.
 * post: `match` is `words`, `meaning` or `words and meaning`, by which lists hold the id.
 * decided: the lists are fused by rank, not by score, because a full-text score and a cosine similarity are not comparable and a printed score would read as confidence
 */
export function fuse(wordRows: readonly Row[], meaningRows: readonly Row[], limit = 5): readonly Candidate[] {
  const K = 60;
  const score = new Map<string, number>();
  const matched = new Map<string, { words: boolean; meaning: boolean }>();
  const row = new Map<string, Row>();
  const add = (rows: readonly Row[], which: "words" | "meaning"): void => {
    rows.forEach((r, i) => {
      const id = str(r.id);
      score.set(id, (score.get(id) ?? 0) + 1 / (K + i + 1));
      const m = matched.get(id) ?? { words: false, meaning: false };
      m[which] = true;
      matched.set(id, m);
      if (!row.has(id)) row.set(id, r);
    });
  };
  add(wordRows, "words");
  add(meaningRows, "meaning");
  return [...score.keys()]
    .sort((a, b) => score.get(b)! - score.get(a)! || (a < b ? -1 : a > b ? 1 : 0))
    .slice(0, limit)
    .map((id) => {
      const m = matched.get(id)!;
      return candidate(row.get(id)!, m.words && m.meaning ? "words and meaning" : m.words ? "words" : "meaning");
    });
}

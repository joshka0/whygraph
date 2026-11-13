/**
 * module: [[whygraph-term-bridge]]
 * boundary: pure
 * imports: none
 * decided: a term is weighted, not filtered by a stop-word list, because the reference measurement over 4,453 records weighted common words well enough on its own and a hand-kept list drifts from the corpus
 */

/**
 * The fewest records that must use a term before the common-term rule can drop it.
 * Below this the store is small, every term is worth a node, and the rule would
 * only remove the project's own jargon.
 */
const MIN_RECORDS = 10;

/** One term of a record's text and how many times that text holds it. */
export interface TermCounts {
  /** For each record id: term -> how many times the record's text holds it. */
  readonly counts: ReadonlyMap<string, ReadonlyMap<string, number>>;
  /** For each record id: the number of terms in its text, every term counted, kept or not. */
  readonly totals: ReadonlyMap<string, number>;
  /** For each term: the number of records whose text holds it (its document frequency). */
  readonly records: ReadonlyMap<string, number>;
}

/**
 * owns: [[whygraph-term-bridge]]
 * post: the terms of `text`, in order: every run of letters, digits and `_`; each run split at `_` and at camelCase and digit boundaries, with the whole run kept too, all lowercased; a term shorter than three characters or all digits is left out.
 * post: the same text always gives the same terms in the same order.
 * decided: the whole identifier and its parts are both terms, because code that writes `taxRate` and a record that writes `tax rate` must meet, and a record that writes the identifier must match it exactly
 */
export function termsOf(text: string): readonly string[] {
  const out: string[] = [];
  for (const raw of text.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []) {
    const parts = raw.split(/_+/).filter((p) => p !== "");
    const sub: string[] = [];
    for (const part of parts) sub.push(...(part.match(/[A-Z]+(?![a-z])|[A-Z]?[a-z]+|[0-9]+/g) ?? []));
    const candidates = new Set([raw.toLowerCase(), ...sub.map((s) => s.toLowerCase())]);
    for (const c of candidates) if (c.length >= 3 && !/^[0-9]+$/.test(c)) out.push(c);
  }
  return out;
}

/**
 * owns: [[whygraph-term-bridge]]
 * post: the source lines of the symbol whose 1-based span is `line`..`endLine` (both inclusive) of `lines` (a file split at `\n`); when `withComment`, the contiguous comment block directly above `line` is included too, because the doc comment often holds the jargon a record shares.
 * post: undefined when `line` or `endLine` is not an integer, or the span does not fit `lines` (the file changed since the build), so a caller never reads wrong lines.
 * decided: the comment block ends at the first line above the declaration that is not a `//`, `/*`, `*` or `#` comment, because memod's span starts at the declaration and a blank or code line ends the doc comment
 */
export function symbolSource(lines: readonly string[], line: number, endLine: number, withComment: boolean): readonly string[] | undefined {
  if (!Number.isInteger(line) || !Number.isInteger(endLine) || line < 1 || endLine < line || endLine > lines.length) return undefined;
  let first = line - 1;
  if (withComment) {
    const isComment = (s: string): boolean => /^\s*(\/\*|\*|\*\/|\/\/|#)/.test(s);
    let i = line - 2;
    while (i >= 0 && isComment(lines[i]!)) i--;
    first = i + 1;
  }
  return lines.slice(first, endLine);
}

/**
 * owns: [[whygraph-term-bridge]]
 * post: the term counts of `records`: each record's term -> count, each record's total term count (every term, before the common-term rule), and each term's document frequency.
 * post: an empty `records` gives three empty maps; a record whose text holds no term gets total 0 and no entry in `counts`.
 */
export function termCounts(records: readonly { readonly id: string; readonly text: string }[]): TermCounts {
  const counts = new Map<string, ReadonlyMap<string, number>>();
  const totals = new Map<string, number>();
  const df = new Map<string, number>();
  for (const r of records) {
    const ofRecord = new Map<string, number>();
    for (const term of termsOf(r.text)) ofRecord.set(term, (ofRecord.get(term) ?? 0) + 1);
    let total = 0;
    for (const n of ofRecord.values()) total += n;
    counts.set(r.id, ofRecord);
    totals.set(r.id, total);
    for (const term of ofRecord.keys()) df.set(term, (df.get(term) ?? 0) + 1);
  }
  return { counts, totals, records: df };
}

/**
 * owns: [[whygraph-term-bridge]]
 * post: false when `records` (the records that use a term) is at least MIN_RECORDS and more than half of `total` (every record), so that term gets no node; true otherwise.
 * decided: a term in more than half the records earns no node because its BM25 idf is under 0.7, near zero, so it cannot tell one record from another; a store with fewer than MIN_RECORDS records using the term is small enough to keep every term
 */
export function keptTerm(records: number, total: number): boolean {
  return records < MIN_RECORDS || records * 2 <= total;
}

/**
 * owns: [[whygraph-term-bridge]]
 * post: one row per kept term, sorted by text: the term and how many records use it.
 */
export function termNodes(terms: TermCounts): readonly { readonly text: string; readonly records: number }[] {
  return [...terms.records]
    .filter(([, df]) => keptTerm(df, terms.totals.size))
    .map(([text, records]) => ({ text, records }))
    .sort((a, b) => (a.text < b.text ? -1 : a.text > b.text ? 1 : 0));
}

/**
 * owns: [[whygraph-term-bridge]]
 * post: one row per kept term of each record, sorted by record id then term: the record, the term and how many times the record's text holds it; a dropped term gives no row.
 */
export function termEdges(terms: TermCounts): readonly { readonly from: string; readonly to: string; readonly count: number }[] {
  const kept = new Set(termNodes(terms).map((n) => n.text));
  const rows: { from: string; to: string; count: number }[] = [];
  for (const id of [...terms.counts.keys()].sort()) {
    for (const [term, count] of [...terms.counts.get(id)!.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
      if (kept.has(term)) rows.push({ from: id, to: term, count });
    }
  }
  return rows;
}

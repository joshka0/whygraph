# ADR 0002: The term bridge in `carry`

Date: 2026-11-13. Status: accepted for the build side; the query side is
blocked on a symbol line range (see "Blocked" below). Topic:
[[whygraph-term-bridge]].

## Context

A trial measured thirty blind change requests over 4,453 decision records.
When a request shares no distinctive word with the record it goes against,
searching with the request finds that record in the top five 1 time in 10,
whether the search ranks by words or by embedding. Searching with the
distinctive terms of the code the request would touch finds it 5 times in the
9 cases that had code. The record and the code share the project's jargon;
the request does not. `carry` already takes `<file>:<symbol>`, so it stands in
the code and needs no request text. `whygraph search` is the request-side
tool; this record adds the code-side one.

## Options

1. Request search only (`whygraph search`). No new work, but the measurement
   above is exactly its failure mode: the request's words are the wrong words.
   Rejected as the answer for this question.
2. Embeddings of the code. The symbol's text would need a second embedding per
   query, the model is trained for prose rather than short code, and no
   measurement supports it. It also needs the same symbol source text that
   blocks the chosen option below. Rejected.
3. A term bridge. One tokenizer reads both a record's text and the symbol's
   code; the build stores each record's term counts; a BM25 ranking over those
   counts lists the records that share the most distinctive terms. It needs no
   model, no key and no network, and it reuses the shape `search` already has
   (a short list of candidates, no score). Chosen.

## Choice

**Build side (implemented).** A term is a word of a record's text (its title
and statements): every run of letters, digits and `_`; each run split at `_`
and at camelCase and digit boundaries, with the whole identifier kept too; all
lowercased; a term shorter than three characters or all digits is left out.
There is no stop-word list: the BM25 weight handles common words, and a
hand-kept list drifts from the corpus. `whygraph build` makes one `Term` node
per kept term, holding `records` (the number of records that use it), and one
`MENTIONS` edge from each record to each of its terms, holding how many times
the record's text holds it. Each `Decision` holds `termCount`, every term of
its text, so a query can compute the average record length.

One rule keeps the graph small: **a term used by more than half of at least
ten records makes no node**, because its BM25 idf is then under 0.7, near
zero, and it cannot tell one record from another; a store with fewer than ten
records using a term is small enough to keep every term. On the
2,662-record memoryd file the rule drops exactly `and` (1,982 records, 74.5%,
idf 0.295) and `the` (1,472 records, 55.3%, idf 0.592), leaving 6,754 of 6,756
term nodes and 77,404 of 80,858 edges; the least distinctive term it keeps has
idf 0.795 and the median kept term 6.971. The fixture's five records share no
term ten times, so the rule drops nothing there.

**Query side (blocked).** `carry` would read the symbol's source lines from
the working tree, take their terms with the same tokenizer, and run one recipe
`recipes/terms.cypher` that ranks records by BM25 over the stored counts
(`k1` 1.2, `b` 0.75, as the reference) and returns the best five, each with
its three to five strongest shared terms. The recipe would be the single
source for the CLI and the MCP tool list, as the other recipes are. A record
that `carry` already lists as linked would not be repeated; each candidate
line would show date, id, title and the shared terms, and no score.

## Consequences

- The store grows. On the fixture, a build goes from 48 nodes and 91
  relationships to 93 and 148 (45 `Term` nodes, 57 `MENTIONS` edges). On the
  2,662-record memoryd file it goes to 24,586 nodes and 117,027 relationships
  (6,754 `Term` nodes, 77,404 `MENTIONS` edges).
- Build time. The fixture builds in 1.2 s. The memoryd build took 4 m 59 s
  with the rule and 5 m 7 s without it, a difference inside run-to-run noise;
  measured in isolation, loading the term statements took 86.0 s with the rule
  and 86.8 s without it (3,454 more edges cost 0.8 s). Tokenizing the 2,662
  record texts took 233 ms and produced 154,881 terms, 6,756 distinct, 58.2
  per record.
- No new dependency: the tokenizer is pure TypeScript and the ranking is one
  Cypher recipe.
- A shared term is not a link. The section would say so, print no score, and
  list candidates to read, exactly as `search` does.

## Limits

- A term match is not a link. The record and the code share the project's
  jargon; a shared word is a candidate to read, never a reason the record
  governs the code.
- Common jargon over-links. A term in many records matches many symbols; the
  section shows the shared terms so the reader can see why each candidate is
  there.
- The code must exist in the working tree and be readable. A symbol whose file
  is gone, or whose language the tokenizer cannot read, has no term section.
- The tokenizer follows the reference: ASCII identifiers only, so a non-ASCII
  identifier is cut at its first non-ASCII character.
- The common-term rule is a bound, not the main size lever. On memoryd it
  removes 0.03% of the term nodes and 4.3% of the edges and its effect on
  build time is unmeasurable; the size comes from the design itself, one node
  per distinct term and one edge per record-term pair.
- The build stores terms for every record, so a store built before this change
  has none; the query side must treat a missing `Term` node as no match, not
  as an error.

## Blocked: a symbol's line range

The query side needs the lines of one symbol. The store's `Symbol` node holds
`id`, `path` and `name`; `memod graph --history` prints symbol nodes with
`id`, `kind` and `name` only. memod computes a symbol's starting `line`
internally (`SymbolRecord.line`) but does not put it in the graph, and no
memod command prints a symbol's end. So neither the store nor `memod graph`
gives a line range, and `carry` cannot read the symbol's own code.

Options, for the parent to choose:

1. **memod puts `line` on symbol nodes** (it already has it), whygraph pins the
   new memod commit, stores `line` on `Symbol`, and takes the end as the next
   symbol's start in the same file minus one, or the file's end. One small
   memod change, one pinned commit, and whygraph stays a reader of memod.
2. **memod adds a command or flag that prints a symbol's range** (start and
   end). Same pin, more memod work, no inference from the next symbol.
3. **whygraph tokenizes the whole file instead of the symbol.** No memod
   change, but the terms are diluted by every other symbol in the file, which
   is the failure the bridge exists to avoid. A measurement would be needed
   before choosing it.
4. **whygraph parses the file itself** (a TypeScript parser or a text
   heuristic). It duplicates memod's parsing, adds a dependency or a guess,
   and breaks the boundary that memod owns what a symbol is. Rejected.

Until one is chosen, `build` stores the terms and no command reads them.

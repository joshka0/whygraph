# ADR 0002: The term bridge in `carry`

Date: 2026-11-13. Status: accepted. Topic: [[whygraph-term-bridge]].

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
   measurement supports it. It also needs the same symbol source text the term
   bridge needs. Rejected.
3. A term bridge. One tokenizer reads both a record's text and the symbol's
   code; the build stores each record's term counts; a BM25 ranking over those
   counts lists the records that share the most distinctive terms. It needs no
   model, no key and no network, and it reuses the shape `search` already has
   (a short list of candidates, no score). Chosen.

## Choice

**Build side.** A term is a word of a record's text (its title and
statements): every run of letters, digits and `_`; each run split at `_` and
at camelCase and digit boundaries, with the whole identifier kept too; all
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

**Line range.** memod ADR 0003, amendment of 2026-11-13, puts `line` and
`endLine` on each symbol node: 1-based, inclusive, the declaration's span
without its doc comment. `build` stores them on `Symbol`, and `carry` reads
those lines of the file from the working tree. A symbol with no span, a file
that is gone, and a span that no longer fits the file each give a one-line
note instead of wrong lines.

**Query side.** `carry` adds the symbol's name and file path to its source
lines, tokenizes that with the same tokenizer, and runs one recipe,
`recipes/terms.cypher`: BM25 with `k1` 1.2 and `b` 0.75 (as the reference),
`idf = ln(1 + (N - df + 0.5) / (df + 0.5))`, where `Term.records` is `df`,
`MENTIONS.count` is the term frequency in the record, and `Decision.termCount`
is the record length. The best five records are shown, each with up to five
of its strongest shared terms (the terms with the largest BM25 contribution)
and no score. A record that the answer already lists as a decision of the
symbol is left out, and the heading says a listed record is a candidate, not a
link. The recipe is the single source for the CLI and the MCP tool list, as
the other recipes are. When the code cannot be read or no kept term matches,
the section is one line.

**The comment above the declaration.** The first plan was to read the doc
comment too, on the belief that it holds the jargon. Measured on the six
memoryd targets that name a graph symbol, by the rank of the wanted record
over the full BM25 list, it does not pay:

| Entry | Without the comment | With the comment |
| --- | --- | --- |
| memoryd-01 | 1 | 1 |
| memoryd-02 | 83 | 94 |
| memoryd-06 | 40 | 40 |
| memoryd-07 | 580 | 580 |
| memoryd-10 | 65 | 53 |
| memoryd-11 | 92 | 267 |
| Sum | 861 | 1,035 |

The top five is the same either way (memoryd-01 only). One case moves for the
comment and two against, and the largest move is against: `realPath`'s
six-line doc comment adds about twenty prose terms and takes its rank from 92
to 267. `carry` therefore does **not** read the comment block; `symbolSource`
can, and a test may exercise that, but the caller passes false.

## Consequences

- The store grows. On the fixture, a build goes from 48 nodes and 91
  relationships to 93 and 148 (45 `Term` nodes, 57 `MENTIONS` edges). On the
  2,662-record memoryd file it goes to 24,586 nodes and 117,027 relationships
  (6,754 `Term` nodes, 77,404 `MENTIONS` edges). The `line`/`endLine`
  properties add no nodes or edges.
- Build time. The fixture builds in 1.2 s. The memoryd build measured 7 m 25 s
  on this run (an earlier run of the same file measured 4 m 59 s, so the two
  differ by machine load, not by the new work); almost all of it is the
  one-text-per-call embedding, and the term statements alone took 86 s.
- No new dependency: the tokenizer is pure TypeScript and the ranking is one
  Cypher recipe.
- A shared term is not a link. The section says so, prints no score, and lists
  candidates to read, exactly as `search` does.
- The product's span is coarser than a person's. The reference measurement
  chose a narrow line range around the statement a request would touch; a
  memoryd symbol can be a whole class. Re-run on the product, the wanted
  record is in the top five for one of the six targets:

  | Entry | Symbol the product reads | Span | Reference by code | Product, full rank |
  | --- | --- | --- | --- | --- |
  | memoryd-01 | `src/central/store/modes.ts#privateFiles` (the second target; the first, a module-level `process.umask`, has no symbol) | 18-30 | 1 | 1 |
  | memoryd-02 | `src/central/sources/sourcePaths.ts#folderResolver` | 125-171 | 141 | 83 |
  | memoryd-06 | `mem/src/memoIndex.ts#FolderIndex` | 77-437 | 3 | 40 |
  | memoryd-07 | `src/central/sources/Transcript.ts#Transcript` | 51-379 | 3 | 580 |
  | memoryd-08 | none (`bin/install` is a shell script; memod indexes no symbol) | - | 7 | not run |
  | memoryd-10 | `src/central/store/Store.ts#makeStore` | 147-286 | 111 | 65 |
  | memoryd-11 | `src/central/realPath.ts#realPath` | 19-31 | 59 | 92 |

  The product agrees on memoryd-01 (rank 1). It differs on memoryd-06 and
  memoryd-07 because the reference read the 11-line constructor and the 7-line
  `read` fallback that an agent pointed at, while the symbol's range is the
  362-line and 329-line class; the terms of the whole class drown the shared
  ones. It cannot run on memoryd-08 at all. On -02, -10 and -11 neither finds
  the top five.

## Limits

- A term match is not a link. The record and the code share the project's
  jargon; a shared word is a candidate to read, never a reason the record
  governs the code.
- Common jargon over-links. A term in many records matches many symbols; the
  section shows the shared terms so the reader can see why each candidate is
  there.
- A symbol is as wide as memod says. A method, a constructor or a branch is
  not its own symbol, so the code text can be a whole class and the ranking
  can miss a record a narrow range would find (the memoryd-06 and -07 cases
  above).
- The code must exist in the working tree and be readable. A symbol whose file
  is gone, whose span no longer fits the file, or whose language the tokenizer
  cannot read has a one-line note, not a term section.
- The tokenizer follows the reference: ASCII identifiers only, so a non-ASCII
  identifier is cut at its first non-ASCII character.
- The comment above a declaration is not read, by the measurement above.
- The common-term rule is a bound, not the main size lever. On memoryd it
  removes 0.03% of the term nodes and 4.3% of the edges and its effect on
  build time is unmeasurable; the size comes from the design itself, one node
  per distinct term and one edge per record-term pair.
- The build stores terms for every record, so a store built before this change
  has none; the query side treats a missing `Term` node as no match, not as an
  error. A store built before `line`/`endLine` likewise gives the one-line
  "no source line range" note until it is rebuilt.
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
tool; this record adds the code-side one. A symbol's stored range can also be a
whole class, so `carry` takes an explicit 1-based line range as well.

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

**The two targets.** `carry <file>:<symbol>` reads the symbol's stored
`line`..`endLine` and adds its name and file path to the tokenized text; the
linked decisions, checks and topics come from that one symbol.
`carry <file>:<start>-<end>` reads exactly those lines of the working-tree file
(no name or path added) and takes the linked decisions, checks and topics from
every symbol whose stored range overlaps the lines, naming each symbol and its
span in the output; a file with no symbol still gets the term section, and the
output says that no symbol covers the lines. A symbol longer than
`LONG_SYMBOL` (40 lines) gets a one-line term section naming the range form
instead of candidates, because the check below shows a wide span drowns the
shared terms. The range form is `carry` only; `why` and `impact` keep their
targets. A bad range (not two digits, a start below 1, a start after the end,
past the end of the file, a file outside the repo) exits 2; a missing file
exits 1; each names the problem.

**Query side.** `carry` tokenizes the source text with the same tokenizer and
runs one recipe,
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
- A symbol's span can be a whole class, and that is why the range form
exists. On the six memoryd targets that name a graph symbol, the symbol form's
full rank of the wanted record is 1, 83, 40, 580, 65 and 92 where the reference
(an agent's narrow range) got 1, 141, 3, 3, 111 and 59; only memoryd-01 lands
in the top five. `FolderIndex` (362 lines) and `Transcript` (329 lines) dwarf
the constructor and the `read` fallback a person pointed at.
- The range form is much closer to the reference. `carry <file>:<start>-<end>`
on the first target of each memoryd entry with a target:

  | Entry | First target | Reference by code | Shown rank | Full rank |
  | --- | --- | --- | --- | --- |
  | memoryd-01 | `src/central/main.ts:38-39` | 1 | 1 | 1 |
  | memoryd-02 | `src/central/sources/sourcePaths.ts:125-149` | 141 | not shown | 40 |
  | memoryd-06 | `mem/src/memoIndex.ts:89-99` | 3 | 1 | 1 |
  | memoryd-07 | `src/central/sources/Transcript.ts:127-133` | 3 | not shown | 92 |
  | memoryd-08 | `bin/install:151-169` | 7 | not shown | 9 |
  | memoryd-10 | `src/central/store/Store.ts:199-233` | 111 | not shown | 153 |
  | memoryd-11 | `src/central/realPath.ts:11-30` | 59 | not shown | 218 |

  Two of seven land in the top five against the reference's three. The product
  agrees on memoryd-01 and beats it on memoryd-06, because those first targets
  hold the record's vocabulary. It loses on memoryd-07, -10 and -11 because the
  reference concatenated up to three targets (the `read` fallback with its
  `StartFolderMissing` handler, the backfill and `Exclusion` spans, the
  `pathCounts` counter) and added each target's file and symbol text; the
  operator's check uses the first target's lines alone, by design. On
  memoryd-02 the extra reference targets are noise, so the product ranks better
  (40 against 141) without reaching the top five.

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
  above). The range form is the answer: give the lines you will touch.
- A symbol longer than 40 lines gets the range-form note instead of
  candidates, so a long symbol's term section is not a candidate list. Read the
  note and ask with a range.
- A range takes exactly its lines, with no symbol name or file path added. A
  record that names the file or the symbol but shares no line of the range will
  not match it; the symbol form adds both and would. The reference measurement
  added them too, so the range ranks can differ from its numbers.
- A range needs the file in the working tree. A path that is not a file there
  exits 3 (see "Missing range file"), and a range past the end of the file
  exits 2, each naming the problem; the term section never reads a wrong range.
- A range that overlaps several symbols renders one body per symbol. A record
  linked to two of them appears under each, and the term section still lists it
  only once (or not at all, if a body already lists it).
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

## Missing range file, 2026-11-18

This section changes a public exit code of the CLI.

Until 2026-11-18, `carry <file>:<start>-<end>` exited 1 with
`cannot read <file>: <system error>` when the path was not a file in the
working tree. Exit 1 is also the code for a failure of whygraph itself: no
store, no model, a failed `relate` query. A caller could not tell its own wrong
path from a broken tool.

The batch 7 trial showed the cost. Its store service counts a product exit 1
as a lost service (ADR 0011, B7-170). On 2026-11-18 an agent called
`carry src/middleware/redux.ts:src/middleware/redux.ts:1-50`. The service
answered `whygraph service unavailable`, the runner voided the attempt and ran
the cell again, and the smoke check failed. Only the conditions that run the
product get such a second attempt.

Choice (operator, 2026-11-18): a range on a path that is not a file in the
working tree is a target error. It exits 3, like a symbol that the store does
not hold. The message is `No file <path> in the working tree.`, followed by
`Close files: ...` when the store holds close file names. It holds no system
error text and no absolute path. "Not a file" means a missing path, a path
through a file, and a folder.

A file that exists and cannot be read keeps exit 1 and `cannot read`: the
caller named a real file, and the tool failed to read it.

Rejected: a rule in the trial's service that reads the `cannot read` text and
passes it on. It hides the cause and leaves other callers with the same
ambiguous code.

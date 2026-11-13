# ADR 0003: Candidate lists wider than five

Date: 2026-11-13. Status: accepted. Topic: [[whygraph-relate-loader]].

## Context

ADR 0001 shows a short list of candidates and lets the reader judge, because
neither a word score nor a meaning score separates the record that governs a
change from noise. ADR 0002 adds the term section of `carry` on the same
reasoning. Both cut their lists at five.

A later measurement used 60 blind change requests against 4,453 decision
notes of two projects. The needed note is in the five lines of `search` for
34 requests, and in the five of `search` or the five of the `carry` term
section for 46. It is in the top ten of one of the three lists (words,
meaning, code terms) for 52, and in the top twenty for 54. A small language
model (DeepSeek 4.1 Flash, no reasoning step) that picked five from the pooled
top twenty found it for 53 of the 54 pools that held it.

The same measurement shows the cost of the cut itself. The word list and the
meaning list held the note in their top five 36 times between them (26 by
words, 34 by meaning, with 24 overlaps), but the fusion of 5 + 5 into 5 listed
it only 34 times: a note at rank five in both lists loses to a note at rank
one, and two notes that one list held were dropped. Most of what the command
misses sits just below its five lines.

## Options

1. Keep five. The answer stays short, but the measurement above says the note
   is missing from it for 26 of 60 requests, and for 14 more when the term
   section is also read.
2. Ten per list, the calling agent picks. `search` fuses the ten best by words
   and the ten best by meaning into at most twenty; the term section lists at
   most ten. No score, no model call: the agent that reads the answer judges
   the candidates. This is the measurement's top-ten row (52 of 60), with the
   caller doing the pick the model did for 53 of 54.
3. Twenty per list. The measurement's top-twenty row is 54 of 60, two more
   than the top ten, but the search answer would list up to 40 candidates and
   the term section up to 20, and the agent must read them all. The last two
   are not worth tripling the answer.
4. A model call inside whygraph, like the measurement's picker. It would add a
   model, a prompt and a network or a second download to a command whose
   promise is that no text and no judgement leave the machine. Rejected.

## Choice

`whygraph search "<text>"` reads the ten best records by words and the ten
best by meaning, fuses them by reciprocal rank (`1 / (60 + rank)`, as ADR
0001) and lists every fused candidate: at most twenty, no cut to five. (ADR
0001's list of five is replaced by this; the two lists and the fusion stay.)
The order is the fused score, then id. The `matched:` label stays (`words`,
`meaning` or `words and meaning`); no score is printed. Each candidate takes
two lines: `  <date>  <id>  <title>`, then
`      matched: <label>; source: <source>`. The heading says these are
candidates to pick from and that they come from two lists (words and meaning).
The `statement:` line is gone: two lines per candidate keep a twenty-candidate
answer readable, and the source line names the record to read.

The term section of `carry`, symbol form and range form, lists at most ten
candidates instead of five. Its per-candidate lines keep their shape
(`  <date>  <id>  <title>`, `      shared terms: ...`, at most five shared
terms), and its heading says it is one list of candidates to pick from.

One place holds the number 10 for the code: `LIST_SIZE` in
`src/search.pure.ts`, which caps the word and meaning recipes' rows in the
fused list. The recipes hold the same number for the query, because they are
the single source for the CLI and for an MCP host:
`recipes/search.cypher` and `recipes/terms.cypher` say `LIMIT 10`, and
`recipes/meaning.cypher` passes `10` as the vector query's `k`. `search` over
MCP stays the word search only, now ten rows.

## Consequences

- Answers are longer. A full `search` answer is 43 lines: one heading, twenty
  candidates at two lines each, then `Searched:` and `Not searched:`. A full
  term section is 21 lines: one heading and ten candidates at two lines each.
  The agent must read them; the headings say so and name the lists the
  candidates come from.
- The candidates carry less each. Dropping the `statement:` line halves the
  answer per candidate, but the caller no longer sees the record's first line;
  it picks from the title and the source, then reads the record. This is not
  measured.
- Not measured: whether an agent in a real task reads the wider list and picks
  the governing record well. The measurement's picker was a model with the
  request, the code lines and the pooled titles and first statements; the
  product now hands the same kind of choice to the calling agent, with no
  model call of its own.
- The fusion no longer drops a note that one list holds near its top: two
  lists of ten fused into twenty hold every id either list ranks in its ten.
- A record in both lists is still listed once, as `words and meaning`.
- The word list over MCP is longer (ten rows), and a host that reads the
  `search` recipe sees the same rows the CLI's word half does.
- Nothing else changes: no new command, no new option, no new dependency, no
  change to `build`, the store schema, `why` or `impact`. A store built before
  this change needs no rebuild, because the change is in the recipes and the
  answer code, not in the graph.

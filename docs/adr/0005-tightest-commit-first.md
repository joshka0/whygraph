# ADR 0005: The tightest commit first

Date: 2026-11-14. Status: accepted. Topic: [[whygraph-relate-loader]].

## Context

The part of a `why` (and so of a `carry`) answer that lists the records linked
only through a commit lists them oldest first. The link is loose: a commit
that cites a record and changed a symbol ties the record to every symbol the
commit changed, so a commit that changed many symbols says little about any one
of them. The part already prints each commit's symbol count so a reader can
weigh the link, but the order does not use it, and a record that a small commit
tied to the symbol can sit below a record that a huge commit touched only in
passing.

Measured on a public repo: 23 of 24 useful links came through a commit of at
most 20 symbols, and one symbol listed 8 records of which 5 came through one
commit of 1,190 symbols. The useful links are the tight ones, so the reader
should meet them first.

## Options

1. Oldest first, as today. The list reads as a history of the symbol and the
   oldest reason comes first, but the reader must scan the symbol count of
   every commit to tell a strong link from a weak one, and a 1,190-symbol
   commit can put five weak records above the one that matters.
2. Tightest commit first. A record's rank is the fewest symbols any commit
   that links it to this symbol changed; ties keep today's order (date,
   undated last, then id). The strong links come first and the weak ones fall
   to the end, where a reader can stop. Chosen.
3. Hide links above a symbol count. A commit that changed more than, say, 20
   symbols would list no record, so the weak links disappear. Rejected: a
   threshold is a second rule to tune and it drops a link that may still be
   the only reason the graph holds, while the count is already printed for a
   reader to judge.

## Choice

In the part `Decision records linked only through a commit that cites them and
changed its code or tags`, a record's rank is the smallest `that commit
changed N symbols` count among the commits that link it to this symbol,
smallest first. Ties use the order the part used before: date, undated last,
then id. Under one record, its `changed by:` commit lines are also tightest
first, with the same tie order. The heading says `tightest commit first`.

The order lives in `recipes/why.cypher`, where the rows are built, so `why`,
`carry` (symbol form and range form) and an MCP host that runs the `why`
recipe all read the same order; no answer code sorts a second time. The
records a `decided:` tag names keep their order, `impact` keeps its order, and
no line is added or removed.

## Consequences

- The oldest reason is no longer first. A reader who wants the history of the
  symbol reads the commit list at the end of the answer (`3 commits changed
  its code or tags, newest first`), which is unchanged, or reads the record's
  `changed by:` lines, now tightest first.
- The link a reader meets first is the one most likely to govern the symbol:
  a commit that changed few symbols touched this one on purpose. The weak
  links still appear, at the end, each with its count.
- A record linked by several commits ranks by its best (smallest) commit, so a
  record with one tight link sorts above a record with only loose links, even
  when the same commit also touched it loosely.
- Nothing else changes: no new command, no new option, no change to `build`,
  the store, the recipes' row shape, `search`, `impact` or the term section. A
  store built before this change needs no rebuild, because the change is in
  the recipe and the answer text, not in the graph.

---
name: whygraph
description: Ask the repo's why graph before changing code. Use before you edit, rename or delete a symbol (carry), when a decision record changes or is replaced (impact), when you wonder why code is the way it is (why), and when no link connects the code to a record (search). Needs the whygraph CLI on PATH and a store built in the repo.
---

# whygraph

whygraph holds this repo's code, its history and its decision records in one
graph. Four questions, four commands:

| When | Ask | Command |
| --- | --- | --- |
| Before you change a symbol | carry | `whygraph carry <file>:<symbol>` or `<file>:<start>-<end>` |
| When a decision changes | impact | `whygraph impact <decision id>` |
| When you wonder why code is the way it is | why | `whygraph why <file>:<symbol>` |
| When no link answers | search | `whygraph search "<the change in your own words>"` |

`<file>` is the path from the repo root; `<symbol>` is the exported name, such
as `whygraph carry src/money.ts:formatCents`. A decision id is the record's id
exactly, such as `ADR-0003` or `note-2`. `carry` also takes a 1-based inclusive
line range, such as `whygraph carry src/money.ts:9-19`, for a long symbol: the
term section then reads exactly those lines, and the linked decisions, checks
and topics come from every symbol whose stored range overlaps them, each
symbol named. A symbol longer than 40 lines gives a one-line term section that
names the range form. A file the graph holds no symbol for still gets the term
section, and the answer says no symbol covers the lines.

## Rules

1. Before you change a symbol, run `carry` on it. Read every decision record
   in the answer before you edit. If your change goes against a record, say so
   to the user and name the record; do not make the change silently.
2. Before a change, also run `whygraph search "<the change in your own words>"`.
   A record that governs the change may have no tag or commit that links it to
   the code; `search` lists up to twenty records, the ten best by words and the
   ten best by meaning fused by rank. Read the candidates and judge: a listed
   record is a candidate to pick from, not a link. Add `--at <file>:<start>-<end>`
   to add the term list of the lines you will touch (the same term match `carry`
   makes, up to ten more candidates, each with its `shared terms:`). When
   `WHYGRAPH_RERANK` names a model, `search` may instead list the five records a
   reranker kept; they are still candidates to read and judge, never links.
3. When a decision changes (a record is edited, replaced or reversed), run
   `impact` on it, and treat every symbol it lists as possibly affected.
4. When you wonder why code is the way it is, run `why` before you guess.
5. If an answer lists users of the symbol, check each of them after the edit.
6. `carry` also lists the decisions, records, checks and topics one step away
   (on the symbols it uses, then on the symbols that use it): treat a decision
   there as binding on your edit too, and read its last lines for what it did
   not search, since an empty part never means nothing constrains the change.
7. `carry` ends with the decision records that share the most distinctive
   terms with the symbol's code. That part is a term match, not a link: no tag
   or commit ties those records to the code, and it lists up to ten records.
   Read each shared term and the
   record, and judge whether it governs your change. When the symbol is longer
   than 40 lines the part is one line that names the range form instead; ask
   again with the lines you will touch, `<file>:<start>-<end>`.

## Reading an answer

- "named by: a decided: tag" is a direct link: someone wrote the record's id
  next to this code on purpose.
- "changed by: <commit> ...; that commit changed N symbols" is a loose link:
  a commit that cites the record changed this symbol. With N = 1 it is
  strong; with a large N the commit may have touched this symbol for another
  reason.
- "superseded by: X" means the record was replaced; read X too.
- In a `search` answer, `matched: words` means the record shares a word with
  the change, `matched: meaning` means the local model ranked it near, and
  `words and meaning` means both; that line also names the record's source.
  The list is up to twenty records, the ten best by words and the ten best by
  meaning fused by rank, and the heading names the two lists. With `--at`, a
  term section follows, `matched: terms` on a reranked record marks a record
  from it, and the heading says `with these lines`. When `WHYGRAPH_RERANK`
  names a model, the answer is instead the five records that model kept, best
  first, and its first line names the count and the model. Neither score is
  a confidence, and the meaning search always returns its nearest records, so
  the list is candidates to pick from, never links.
- `Decision records that share the most distinctive terms with its code` (at
  the end of a `carry` answer) is the same kind of candidate list, up to ten
  records: the symbol's
  code and the record share jargon, not a link. The `shared terms:` line says
  why each record is there. A record the answer already lists as a decision of
  the symbol is not repeated. With no readable code or no shared term, the part
  is one line saying so.
- A range answer (`carry <file>:<start>-<end>`) names every symbol whose stored
  range overlaps the lines, then repeats the `carry` body for each. Its term
  heading says `with these lines`; the candidates come from exactly those
  lines, without the symbol name or file path.

## Exit status

- 0: an answer (an empty one too).
- 1 with "no store at ...; run whygraph build first": build it (below).
- 2: the target is not `<file>:<symbol>` (or, for `carry`, `<file>:<start>-<end>`), or a range is bad (a start after the end, below 1, or past the end of the file), or a range was given to `why` or `impact`, or `--at` was given without a range; fix the argument.
- 3: the graph has no such symbol or record; stderr lists close names, so
  retry with one of them.

## Build or refresh the store

The store holds the repo as of the last build. Rebuild after you commit, and
before you rely on an answer about code you changed. With ADRs in `docs/adr`:

```sh
whygraph decisions adr docs/adr > "$(git rev-parse --git-dir)/whygraph-adrs.json"
whygraph build --decisions "$(git rev-parse --git-dir)/whygraph-adrs.json"
```

Add `--decisions <file>` once for each other decisions file the repo keeps.
The first build downloads the embedding model (about 35 MB) into
`~/.cache/whygraph`; later builds and searches read it from there. With no
network and no cache, the build exits 1 and names the model.

## Without a shell (MCP)

`whygraph mcp` prints an MCP server entry and the Cypher recipes. With that
server, call `read_cypher` with a recipe's text as `statement` and its
parameters as `parameters`: `{"symbol": "src/money.ts#formatCents"}` for
`why`, `carry` and `users` (a symbol id is `<file>#<symbol>`),
`{"decision": "ADR-0003"}` for `impact`, `{"text": "plain words"}` for
`search` (the words of the change; `search` over MCP is the word search only),
and `{"terms": ["cents", "tax"]}` for `terms` (the records that share the
most distinctive terms with a list of terms; `carry` builds that list from the
code).

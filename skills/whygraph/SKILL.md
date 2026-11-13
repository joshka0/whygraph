---
name: whygraph
description: Ask the repo's why graph before changing code. Use before you edit, rename or delete a symbol (carry), when a decision record changes or is replaced (impact), when you wonder why code is the way it is (why), and when no link connects the code to a record (search). Needs the whygraph CLI on PATH and a store built in the repo.
---

# whygraph

whygraph holds this repo's code, its history and its decision records in one
graph. Four questions, four commands:

| When | Ask | Command |
| --- | --- | --- |
| Before you change a symbol | carry | `whygraph carry <file>:<symbol>` |
| When a decision changes | impact | `whygraph impact <decision id>` |
| When you wonder why code is the way it is | why | `whygraph why <file>:<symbol>` |
| When no link answers | search | `whygraph search "<the change in your own words>"` |

`<file>` is the path from the repo root; `<symbol>` is the exported name, such
as `whygraph carry src/money.ts:formatCents`. A decision id is the record's id
exactly, such as `ADR-0003` or `note-2`.

## Rules

1. Before you change a symbol, run `carry` on it. Read every decision record
   in the answer before you edit. If your change goes against a record, say so
   to the user and name the record; do not make the change silently.
2. Before a change, also run `whygraph search "<the change in your own words>"`.
   A record that governs the change may have no tag or commit that links it to
   the code; `search` lists the records whose text best matches the change.
   Read the candidates and judge: a listed record is a candidate, not a link.
3. When a decision changes (a record is edited, replaced or reversed), run
   `impact` on it, and treat every symbol it lists as possibly affected.
4. When you wonder why code is the way it is, run `why` before you guess.
5. If an answer lists users of the symbol, check each of them after the edit.
6. `carry` also lists the decisions, records, checks and topics one step away
   (on the symbols it uses, then on the symbols that use it): treat a decision
   there as binding on your edit too, and read its last lines for what it did
   not search, since an empty part never means nothing constrains the change.

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
  `words and meaning` means both. Neither score is a confidence, and the
  meaning search always returns its nearest records, so the list is
  candidates to judge, never links.

## Exit status

- 0: an answer (an empty one too).
- 1 with "no store at ...; run whygraph build first": build it (below).
- 2: the target is not `<file>:<symbol>`; fix the argument.
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
`{"decision": "ADR-0003"}` for `impact`, and `{"text": "plain words"}` for
`search` (the words of the change; `search` over MCP is the word search only).

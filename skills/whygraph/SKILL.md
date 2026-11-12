---
name: whygraph
description: Ask the repo's why graph before changing code. Use before you edit, rename or delete a symbol (carry), when a decision record changes or is replaced (impact), and when you wonder why code is the way it is (why). Needs the whygraph CLI on PATH and a store built in the repo.
---

# whygraph

whygraph holds this repo's code, its history and its decision records in one
graph. Three questions, three commands:

| When | Ask | Command |
| --- | --- | --- |
| Before you change a symbol | carry | `whygraph carry <file>:<symbol>` |
| When a decision changes | impact | `whygraph impact <decision id>` |
| When you wonder why code is the way it is | why | `whygraph why <file>:<symbol>` |

`<file>` is the path from the repo root; `<symbol>` is the exported name, such
as `whygraph carry src/money.ts:formatCents`. A decision id is the record's id
exactly, such as `ADR-0003` or `note-2`.

## Rules

1. Before you change a symbol, run `carry` on it. Read every decision record
   in the answer before you edit. If your change goes against a record, say so
   to the user and name the record; do not make the change silently.
2. When a decision changes (a record is edited, replaced or reversed), run
   `impact` on it, and treat every symbol it lists as possibly affected.
3. When you wonder why code is the way it is, run `why` before you guess.
4. If an answer lists users of the symbol, check each of them after the edit.

## Reading an answer

- "named by: a decided: tag" is a direct link: someone wrote the record's id
  next to this code on purpose.
- "changed by: <commit> ...; that commit changed N symbols" is a loose link:
  a commit that cites the record changed this symbol. With N = 1 it is
  strong; with a large N the commit may have touched this symbol for another
  reason.
- "superseded by: X" means the record was replaced; read X too.

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

## Without a shell (MCP)

`whygraph mcp` prints an MCP server entry and the Cypher recipes. With that
server, call `read_cypher` with a recipe's text as `statement` and its
parameters as `parameters`: `{"symbol": "src/money.ts#formatCents"}` for
`why`, `carry` and `users` (a symbol id is `<file>#<symbol>`), and
`{"decision": "ADR-0003"}` for `impact`.

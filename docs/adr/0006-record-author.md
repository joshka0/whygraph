# ADR 0006: An author on a decision record

Date: 2026-11-14. Status: accepted. Topic: [[whygraph-relate-loader]].

## Context

A record states what was decided and where it lives, but not who decided it.
"Who decided this" is a question an agent or a person asks next, and today the
only way to answer it is to open the record's source by hand. The decisions
file format already holds optional `status` and `source`; a ticket export and
a GitHub issue both know their author, and the ADR reader deliberately reads
no author (an ADR's author is not in the file in a form worth trusting).

## Options

1. No author. The format stays as it is and the question is answered by
   reading the source. Rejected: the graph is the place that joins the
   record's facts, and "who" is one of them; the ticket and issue exports
   already carry it.
2. A string field, `author`. One optional field beside `status`, one property
   on the `Decision` node, one line in the answers. Cheap, no new node, no new
   edge, and the converters write it. Chosen.
3. A `Person` node with a `DECIDED` edge from the record. It would make the
   same person one node across records and allow a query for everything one
   person decided, but it needs an identity rule (two spellings of one name,
   an email, a login), a merge rule and a new node kind for a question no
   measured task asks yet. Rejected for now, as future work.

## Choice

A decisions file record takes an optional `author`: a string or null, under
the same rules as `status`, except that an empty string (or whitespace only)
is rejected like a malformed field. `build` stores it as the property
`author` on the `Decision` node, null when the record has none. Where `why`,
`carry` and `impact` print a record's `status:` line, they print
`author: <author>` on its own line when the record has one, right after the
`status:` line position and before `source:`. A record with no author prints
no such line.

The recipes that return a record's `status` or `source` return `author` too,
so an MCP host sees it. `whygraph decisions adr` sets no author: an ADR file
states none. `eval/tickets/tickets-to-decisions.mjs` copies a ticket's
optional `author` into the record, and `eval/tickets/fetch-github.py` writes
the issue's author login.

`search` output is unchanged: ADR 0003 fixes two lines per candidate (date,
id, title, then `matched:` and `source:`), and the author is not one of them.
The reranker's documents are unchanged: ADR 0004 sends each candidate's title
and first statement, and an author is never sent anywhere. Adding `author` to
the `search`, `meaning` and `terms` recipe rows is for an MCP host that reads
the row itself, not for the CLI's search answer or the reranker request.

## Consequences

- An author is personal data. It lives in the local store and in the answers
  the local commands print; it is not indexed for search and is never sent to
  the reranker. A shared store or a decisions file shares the name with it.
- Two spellings of one person are two authors. There is no identity rule: the
  string is what the source states. A query for one person's records must
  match the spellings by hand.
- A `Person` node with a `DECIDED` edge stays future work, if a query needs
  one identity across records; the string field can be migrated into it.
- `build` and the store schema change: a store built before this change has
  no `author` property, so answers print no author line for its records until
  it is rebuilt. The recipes and the answer code read `author` as absent when
  the store lacks it.
- Nothing else changes: no new command, no new option, no new recipe, and the
  record's other lines keep their order.

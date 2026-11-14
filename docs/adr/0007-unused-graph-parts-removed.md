# ADR 0007: Unused graph parts removed

Date: 2026-11-14. Status: accepted. Topic: [[whygraph-relate-loader]].

## Context

Every build loaded Package nodes, IMPORTS edges and ABOUT edges, but no
recipe read them. Record-only topics likewise answered no question.
`carry` read Memo nodes and PREMISE edges, but four checked repos had zero
`premise:` tags, so every answer printed an empty premise-memo sentence.
The build read `Decision:` commit trailers, but four real repos with 2,304,
2,461, 56 and 47 commits had zero such trailers; only the fixture used them.
Finally, `READ_COMMENT` was always false: its optional comment-reading path
never ran.

## Options

1. Keep all five parts. Preserve unused storage and paths without evidence
   that they help an answer.
2. Cut only the unread parts: packages, imports and record topics. Keep
   premise memos, trailers and the comment switch despite no observed use.
3. Cut all five. Keep the graph and commands focused on the questions they
   actually answer. Chosen.

## Choice

The operator chose to cut all five on 2026-11-14. The load plan skips memod's
packages, imports, memos and premise edges; memod's own graph stays intact.
Only code tags supply Topic nodes and OWNS edges. Records reject `topics`
like any unknown field, and ADR conversion emits none. The carry recipe and
both answer forms have no premise-memo part. The build neither reads nor
warns about trailers. A record links to commits through its own `commits`
list. The term section reads the declaration span without a comment switch;
the measurement behind that choice remains a `decided:` tag on symbolSource.

## Consequences

An ADR converter still cites the commit that added its file. An ADR links
to later commits only if a record lists them explicitly; a `Decision:` line
in a message creates no link and no warning. A decisions file with `topics`
is rejected rather than silently dropping the field.

Stores hold fewer unused nodes and edges when those kinds occur. On the
shared fixture, before this cut the store held **93 nodes and 148
relationships**; afterwards it holds **93 nodes and 139 relationships**.
The node count stays the same because this fixture has no packages, memos
or record-only topics. Five ABOUT and three IMPORTS edges disappear. The
fixture's explicit commit lists give six CITES edges instead of seven,
accounting for the ninth relationship removed; all other label and type
counts stay the same.

The fixture keeps its five records and nine commits. Its first five commits
are unchanged. Removing trailers first changes c6, and removing topics
changes c7. In c9, after c8's id exists, note-1 lists only c8 (five symbols,
a loose-only record) and note-2 lists c4 and c8 (one and five symbols, testing
the tightest-commit order inside one record, ADR 0005). No record text or
symbol code changes, so term counts, embeddings and search candidates stay
the same. The trial's original fixture remains in whygraph commit `8ee90a9`.

There is no new command, option or dependency. Existing stores need a rebuild
to lose the unused data; new stores do not load it.

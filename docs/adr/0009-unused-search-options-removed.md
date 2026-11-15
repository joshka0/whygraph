# ADR 0009: Unused search options removed

Date: 2026-11-15. Status: accepted. Topic: [[whygraph-search]].

## Context

ADR 0003 keeps wide candidate lists so the calling agent can judge them.
ADR 0004 added an optional hosted reranker and `search --at`.

ADR 0004 and the README's past measurement report 60 blind change requests.
The pooled search and carry output averaged about 31 candidates and 13,600
characters. It included the needed note for 52 of 60 requests. Cohere
Rerank 5 Fast, through OpenRouter, kept five candidates with about 3,400
characters. Those five included the needed note for 50 of 60 requests.
A model (DeepSeek 4.1 Flash, with no reasoning step) read the request, the
code lines and either output, then named up to five records. It named
the note for 50 requests with either output. It named
the note first 41 times with the five candidates and 48 times with the
wide list. The shorter answer lost recall and first-place accuracy.

The removal brief records that WHYGRAPH_RERANK was unset in every agent
trial in batches 1 through 6. No reported trial result depends on that
path. The operator chose to remove code without evidence of use on
2026-11-15. The same choice removes `search --at`.

## Options

1. Keep the optional paths. Retain code and checks without evidence of use.
2. Remove both paths. Keep the wide search answer and carry's term section.
   Chosen.

## Choice

Remove the hosted call, its settings, its pure helpers and `search --at`.
Search uses the existing word and meaning recipes, their existing fusion
and the existing wide answer. The parser reports the normal unknown-option
error for `--at`. It has no special case for former environment variables.
This decision supersedes ADR 0004.

## Consequences

Search still lists at most twenty candidates, ten from each list. Carry
keeps the term section and its range form. Why, impact, recipes and the
store schema stay the same. Existing stores need no rebuild.

Search makes no hosted ranking request. The local embedding package remains
because build and search use it. No package or lockfile change is needed.
The checks for the removed paths are removed. Existing search-author checks
stay; an independent author will add checks from the removal failure list.

The batch-6 selftest pins both skill files to commit c92205d. The removal
brief requires preserving those bytes when an edit would fail that check.
Their stale instructions remain a parked contract conflict. The parent must
resolve how trial inputs are preserved before those instructions can change.

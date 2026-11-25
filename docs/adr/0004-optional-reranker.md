# ADR 0004: An optional reranker for `search`

Date: 2026-11-13. Status: superseded by ADR 0009. Topic: [[whygraph-relate-loader]].

## Context

ADR 0003 widened the candidate lists so the calling agent picks: `search`
fuses ten by words and ten by meaning into at most twenty, and the term
section of `carry` lists at most ten. A later measurement used the same 60
blind change requests and took the printed output of `search` plus the term
section of `carry`: about 31 candidates and about 13,600 characters per
request, which held the needed note for 52 of the 60. A hosted reranker
(`cohere/rerank-5-fast` through OpenRouter's `POST /api/v1/rerank`), given the
request and the code lines as the query and each candidate's title and first
statement as a document, cut that to five that held it for 50, about 3,400
characters. A small language model read either output and named the note for
50; with the reranker's five it named the note first 41 times, against 48 when
it read the full output. So the reranker loses a little recall and a lot of
first-place accuracy and saves about 10,200 characters for the reader.

The operator chose to keep the reranker as an option: an agent that would
rather read less can turn it on, while the wide list stays the default and the
fallback. This is a product choice about what the calling agent reads, not a
claim that the reranker is more accurate.

## Options

1. No reranker. The wide list stays the only answer. It is what ADR 0003
   measured and it needs no key, no network and no second dependency. Kept as
   the default and the fallback.
2. The reranker on whenever a key exists (`OPENROUTER_API_KEY` set). A user
   who exported a key for another tool would silently start sending requests
   and records to a hosted service. Rejected: a network call that leaks the
   request and the record text must be an explicit choice.
3. The reranker on by an explicit variable (`WHYGRAPH_RERANK` holds a model
   id). No default model id in the code, so unset or empty means no call of
   this kind is ever made, and the key is optional (a proxy may add it).
   Chosen.
4. A local cross-encoder. No key and no per-query network, and the text stays
   local, but it adds a second model download and a scoring pass over every
   candidate, and no measurement here supports its ranking. Rejected for now.

## Choice

`whygraph search "<text>"` gains `--at <file>:<start>-<end>`. The range follows
`carry`'s range rules (same errors, same exit codes). With `--at` the
candidates are the fused words-and-meaning list plus the records of the term
list for those lines (at most ten, `recipes/terms.cypher`, the same terms
`carry` uses for a range), each record once. Without a reranker the fused list
prints as before and the term candidates not already listed follow under the
term section's heading, in the term section's shape.

When `WHYGRAPH_RERANK` holds a model id, `search` sends one `POST` to
`${WHYGRAPH_RERANK_URL}` (default `https://openrouter.ai/api/v1/rerank`) with
the JSON body `{model, query, documents, top_n: 5}`. The query is the request
text, and with `--at`, a blank line, `Code it would change:` and the lines (at
most 3,000 characters). Each document is one candidate's title, then ` | ` and
its first statement when that adds text, at most 600 characters. The header
`Authorization: Bearer <key>` is sent only when `OPENROUTER_API_KEY` is set;
otherwise no authorization header is sent, so a proxy can add one. The timeout
is ten seconds and there is no retry.

A reranked answer lists the five records in the reranker's order, two lines
each as now, the `matched:` label naming every list that held the record
(`words`, `meaning`, `terms`, or a combination) and no score. Its first line
says how many candidates were ranked and by which model; its last line says
what was sent (the request, the `--at` lines when given, and the titles and
first statements of the candidates) and to the endpoint's host.

Any failure of the call (a network error, a timeout, a non-200, a body that is
not the expected shape, an index out of range, fewer results than asked when
more candidates exist) prints the wide answer with one extra line that names
the failure, and exits 0. Fewer than six candidates means no call at all. Over
MCP nothing changes: the recipes stay the word search, and `carry`, `why`,
`impact`, `build` and the store schema are untouched.

The decision logic (the query, the documents, the mapping back, the fallback
and the rendering) lives in `src/rerank.pure.ts`; the one `fetch` lives in
`src/rerank.ts`.

## Consequences

- Memo text leaves the machine when `WHYGRAPH_RERANK` is set. The request, the
  `--at` lines and every candidate's title and first statement go to the
  endpoint host. Unset or empty, no call of this kind is ever made, and the
  answer says which host received what only when a reranked answer is printed.
- A second network dependency. `search` already needs the local model, whose
  first download needs the network once; with the reranker it also needs a
  reachable endpoint per search, and a failure falls back to the wide answer.
- Cost per call grows with the candidates times the query length: every
  candidate adds its title and first statement (up to 600 characters) and the
  query carries the request and, with `--at`, up to 3,000 characters of code.
- Not measured: latency on the real service. The fake endpoint here answered
  in about 1 ms; a hosted reranker adds its own network and model time, which
  the ten-second timeout bounds but does not remove.
- Not measured: whether an agent mid-edit does better with five records than
  with the wide list. The measurement's reader was a model whose only job was
  the pick, not an agent in the middle of a change.
- The five kept are a convenience, not a verdict: the heading still says a
  listed record is a candidate to read and judge, and no score is printed.

## Limits

- The reranker reads only each candidate's title and first statement, so a
  record whose relevance sits later in its statements is judged on its first
  line. The wide list and the term list are still there when it fails.
- The `--at` term list is a term match, not a link, exactly as in `carry`: a
  shared word is a candidate, never a reason the record governs the lines.
- The reranker runs for plain `search` too, without `--at`; the `--at` lines
  only make the query more specific.
- The endpoint and the model are trusted as given: a wrong URL or model id is
  the operator's to fix, and the answer names the host it sent to.
- Over MCP there is no reranker and no `--at`: a host calls the recipes.

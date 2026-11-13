# ADR 0001: Record search

Date: 2026-11-13. Status: accepted. Topic: [[whygraph-search]].

## Context

whygraph links a decision record to code in three ways: a `decided:` tag that
names the record's id, a `Decision: <id>` commit trailer, and the commit that
added an ADR's file. A trial found that these links often miss: on four test
requests the record the change needed was not linked to the target symbol at
all. Over the records' text, full-text search ranked the needed record 1, not
in the top 5, 1, 2; vector search ranked it 1, 4, 3, 1. Neither score
separates the needed record from noise. So the agent cannot be handed one
answer with a score: it must be shown a short list of candidates and judge
them itself.

## Options

1. A hosted embedding API. Best quality, but every record and request leaves
   the machine, a key is needed, and each query is a network call. Rejected.
2. Full-text only. No new dependency, no download, and it already found the
   record on three of the four requests. It still missed the paraphrase
   ("not in the top 5"). Kept as one of the two lists.
3. A local embedding model. No key, no per-query network, and the text stays
   local. It costs a large install and a first download. Chosen.
4. A local model through another runtime (a Python `fastembed`, llama.cpp).
   Adds a second toolchain to a Node CLI. Rejected.

## Choice

`whygraph search "<text>"` runs two searches and fuses them. The word search
is a relate full-text index over each record's title and statements. The
meaning search embeds the request with `Xenova/bge-small-en-v1.5` through
`@huggingface/transformers` and reads a relate vector index over each record's
embedding. Reciprocal rank fusion (`1 / (60 + rank)`) merges the two ranked
lists into one list of five.

The library is `@huggingface/transformers` (4.3.2, exact) because it is pure
JavaScript and ONNX: no Python, no service, and the same `pipeline` API as
Hugging Face's Python library. The model is `Xenova/bge-small-en-v1.5`
because it is a small English retrieval model (BERT, 384 dimensions) whose
ONNX weights are already published for this library; the `q8` weights are
34 MB against 127 MB for fp32. Both were verified against the model's
`config.json` (`"hidden_size": 384`) and its files, not taken from the brief.
The two lists are fused by rank, not by score, because a full-text score and
a cosine similarity are not comparable.

## Consequences

- Install size: pnpm added 41 packages, about 497 MB: `onnxruntime-node`
  288 MB (native binaries for every platform), `onnxruntime-web` 140 MB
  (unused in Node, a hard dependency), `@huggingface/transformers` 49 MB,
  `sharp`'s libvips 18 MB. whygraph now has one runtime dependency.
- First download: the first `build` (or the first `search` on an unbuilt
  cache) downloads about 35 MB into `~/.cache/whygraph`, the cache folder the
  README names. Later runs read it from there.
- Time on the fixture (this box): a build with a cold cache 12.3 s, a warm
  build 1.0 s; a search with a cold cache 11.5 s (it downloads the model), a
  warm search 0.7 s (about 0.5 s to load the model plus two queries).
- No network and no cache: `build` and `search` exit 1 with an error that
  names the model and the cache folder. They do not answer from the word
  search alone.
- Scores are not confidence. The answer prints no score, only the order and
  `matched: words`, `matched: meaning` or `matched: words and meaning`. A
  nearest-by-meaning record is returned even when the request shares nothing
  with it, so a listed record is a candidate to read and judge, never a link.
- Over MCP the meaning search cannot run: an MCP host has no local model, so
  the `search` recipe is the word search and the `meaning` recipe takes a
  vector the host must supply.
- The `q8` weights trade a little accuracy for a download a quarter the size.

## Amendment: embedding memory (2026-11-13)

A build of the 2,662-record memoryd decisions file made this box unreachable
for several minutes (load average above 1,000, services restarted) and wrote
no store. The build passed every record's text to one feature-extraction
call. The pipeline pads the texts to the longest of the call and runs the
whole call in one tensor, so the tensor grows with the record count.

Measured here under `systemd-run --user --scope -p MemoryMax=6G -p
CPUQuota=400%`, peak resident memory from `/usr/bin/time -v`:

| records in one call | peak | time |
| --- | --- | --- |
| 8 | 0.28 GB | 1.5 s |
| 32 | 0.41 GB | 4.8 s |
| 128 | 0.94 GB | 14.4 s |
| 512 | 3.1 GB | 48 s |
| 2,662 | killed at the 6 GB limit | - |

A whole build adds about 0.43 GB for the code graph and the load. Whole
builds grew the same way: 0.56 GB at 50 records, 1.4 GB at 200 and 6.0 GB at
800, and the 2,662-record build was not run because 800 was already over the
2 GB bound.

The choice is one record text per model call. The embedding pass over the
2,662-record set measured (peak, time): 0.34 GB, 292 s for one text per call;
0.71 GB, 388 s for 32; 1.1 GB, 367 s for 64; 1.9 GB, 324 s for 128; 2.9 GB,
303 s for 256. One text per call is the smallest and, under the CPU limit,
also the fastest, because padding every call to its longest text costs more
than the per-call overhead. It also makes a record's vector a pure function
of its text. The `q8` weights scale activations over the whole call, so a
text embedded with other texts moved by up to 0.014 (cosine 0.995) with the
content of those texts; one text per call reproduced the same vector byte for
byte across processes and matched the vector the build stored. A whole build
is now flat at about 0.44 GB: 2,662 records in 304 s (about 114 s per 1,000),
1,791 in 209 s.

The thread count was not part of the problem. Over 512 texts in one call,
peak memory was 3.13 GB at 1 thread, 3.12 GB at 4, 3.13 GB at 16 and 3.13 GB
at the default, so no thread bound was added.

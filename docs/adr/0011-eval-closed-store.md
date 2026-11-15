# ADR 0011: Keep batch 7 stores outside the agent filesystem

Topic: [[whygraph-eval-runner]]

## Context

The batch 5 shell exposes the store and `relate`. Batch 6 agents use that
route around the intended ablation. The stand-in script also reveals its
condition. These batches retain their recorded setup and limits.

## Options

- Detect more forbidden commands after the agent runs.
- Give the agent a client and keep the store in a separate service.

## Choice

For batch 7 and later, the complete agent process runs in a minimal bwrap
filesystem. This includes native file tools. Mount the repo, empty agent
state, operating system files, the agent executable, and one Unix socket.
The service and product code, stores, templates and other run folders are
absent. A private PID namespace closes the route through host `/proc`.
The shell also removes network access and the CLI identity mount.

Each attempt starts its service before health probes and agent launch.
The runner closes it in `finally`. Its socket lives in a unique attempt
folder. Only that socket appears at `/whygraph/service.sock` inside the run.
Other sockets have no mounted path. The transport has identical compiled
bytes in all conditions. Its mount is read-only and execute-only, with all
capabilities dropped. File reads and permission changes fail.
The service accepts exactly two arguments: one of `carry`, `why`, `impact`,
`search`, then the target. It accepts no store path or query language.
A lost service prints `whygraph service unavailable`, exits 70, and makes
the attempt a harness failure. Complete service answers stay outside the
agent filesystem in `service.jsonl`. Each reply keeps its raw direct-CLI
reference, selected store and any decision-section replacements. The smoke
checker compares reply bytes with those receipts and health calls.

Graph and graph-norule call the real CLI with the run repo and full store.
Stub returns `no result`. Graph-nosearch does that only for search.
Graph-noterms copies the one store and removes Term nodes and MENTIONS edges.
Graph-nolink copies the store and removes CITES edges. No source or recipe
changes implement an ablation. Receipts record copy and mutation time.
Fingerprints check all other nodes, relationships, record text and vectors.

`carrySections` and `termLines` omit a term candidate already shown through
a link. Deleting CITES alone would change the term section. The eval service
therefore renders the full carry answer, then replaces only its decision
sections with `whyAnswer` from the ablated store. It uses the product's
parser, recipes and formatter. It checks the section before replacement.
All other sections retain their original bytes, including term candidates.
The range form applies the same operation to each overlapping symbol.
Impact stays full in graph-nolink: that condition removes commit records
from carry and why only. Search stays full too.

## Consequences

The four commands are the only route to store contents. Batches 1 to 6 keep
their existing setup. Batch 7 controls run only in stub and graph.
Read-only system tools remain available; the agent gets no project
dependencies. Work copies and answer logs remain for smoke audits.
A product format change that breaks section replacement fails visibly.
The fixture proof must cover both carry forms and unaffected sections.

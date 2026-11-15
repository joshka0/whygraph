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
The run owns a second host service for shell commands. The agent's shell
program is a client of this launcher. The host starts each command in a
fresh minimal bwrap filesystem with the same repo and tool client, no
network, and no identity mount. The shell namespace contains neither
launcher socket nor another run's socket. Each connection carries its cwd,
Bash arguments and framed stdin. Replies carry stdout, stderr and status.
The transport preserves bytes and each stream's order, including NUL bytes.
It applies backpressure instead of buffering complete command output.
A scoped client child forwards stdin while its parent reads replies. The
child receives SIGKILL when its parent dies. The parent kills and reaps the
child at command exit. Separate directions prevent a crossed-stream deadlock.

Measured on 2026-11-16: the outer namespace runs under
`bwrap//&unpriv_bwrap (enforce)`. The inner bwrap exits 1 with
`No permissions to create a new namespace`. The box sets
`apparmor_restrict_unprivileged_userns=1`. Its `unpriv_bwrap` profile denies
capabilities and remains stacked across exec. A host-launched bwrap exits 0.
An ordinary user cannot remove that enforced profile. No box policy changes.

Each command owns a process group and a private PID namespace. Connection
loss, timeout and attempt cleanup kill the command group. Namespace teardown
also ends children that create their own session. Cleanup waits for process
closure before closing the store. `--die-with-parent` ends commands if the
runner dies. A lost launcher prints `whygraph shell launcher unavailable`,
exits 70, and makes the attempt a harness failure. The runner owns both
services inside one `try`/`finally`, including a partial launcher start.

Each attempt starts its service before health probes and agent launch.
The runner closes it in `finally`. Its socket lives in a unique attempt
folder. Only that socket appears at `/whygraph/service.sock` inside the run.
Other sockets have no mounted path. The transport has identical compiled
bytes in all conditions. Its mount is read-only and execute-only, with all
capabilities dropped. File reads and permission changes fail.
The service executes only `carry`, `why`, `impact`, and `search`, each with
one target and the host-selected repo and store. The product parser reads
invalid invocations. The direct CLI renders their diagnostics and help,
without a transport-specific replacement. Stub conditions replace successful
answers only. The route accepts no caller-selected store or query language.
A valid unsupported command or a valid option-bearing invocation returns
stdout empty, stderr `usage: whygraph <carry|why|impact|search> <target>\n`,
and exit 2. Embedded NUL uses that same rejection because exec argv cannot
carry NUL. Frames over the transport limits close the connection; the client
prints `whygraph service unavailable\n` on stderr and exits 70.
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

## Ownership and attempt rules

| State | Owner | Lifetime | Boundary token | End |
| --- | --- | --- | --- | --- |
| Shell listener and connections | One host attempt | Attempt | Unique socket mount | Closed in finally |
| Command and stdin/output pipes | One launcher connection | Connection or attempt, whichever ends first | Connection identity | Exit, spawn failure, or cancellation |
| Pending command closures | Host launcher | Attempt cleanup | Child process identity | Await close after kill |
| Attempt reservation | Cell ledger | Across runner restarts | Cell id and reserved entry | Result recorded or inspection required |

`scripts/attempts.pure.ts:attemptDecision` contains the existing retry rules.
`eval/run.mjs:settleCell` applies them with an injected `runAttempt` and
result directory. It reserves each closed attempt before launch and archives
each failed attempt before another launch. Two agent ends leave an unscored
marker. Any pair with a harness end stops with an invalid marker. A reserved
interrupted attempt stops for inspection. A completed ledger launches nothing.
Open-store opencode keeps the batch 5 and 6 invalid-then-timeout ladders,
including their possible third attempt. This extraction changes no old rule.

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
also ends children that create their own session. A host scope witness opens
a pidfd for the namespace's first process before it releases bwrap's startup
barrier. Cancellation signals that process through the pidfd and kills the
command group. Cleanup waits for both command pipe closure and pidfd readiness
before closing the store. The kernel ends the other namespace processes
before that pidfd becomes ready. Killing the bwrap monitor alone cannot
prove this end condition. Cancellation has a 10-second bound. If the scope
does not end within that bound, cleanup rejects and the attempt has a harness
failure. `--die-with-parent` ends commands if the
runner dies. A lost launcher prints `whygraph shell launcher unavailable\n` on stderr,
exits 70, and makes the attempt a harness failure. The runner owns both
services inside one `try`/`finally`, including a partial launcher start.

The shell request permits at most 1,024 fields and 1 MiB, including its
count and field lengths. Each declared field must fit within that request
limit. Subsequent stdin frames do not count toward the request limit, even
when the socket delivers them with the request. Stdin frames carry at most
8,192 bytes. The end-of-input frame has an empty payload.

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
A call that fails inside the store service returns exactly
`whygraph service unavailable\n` on stderr, with exit 70 and empty stdout.
Its internal cause stays in host-only service logs, attempt metadata, ledger
entries and rehearsal failure output. Product diagnostics keep their direct
CLI bytes. The shell launcher keeps its own failure texts. Refusals that
describe the caller's input, including a host argument limit or a program
that does not exist, keep their descriptive text. These diagnostics are
identical in every condition and name nothing of the trial. The disabled `relate` and `memod` aliases
retain their command-denial diagnostic and exit 126: `tool unavailable\n`. It contains no trial text.
Output already streamed by a shell command remains command output. A lost
service makes the attempt a harness failure. Complete service answers stay
outside the agent filesystem in `service.jsonl`. Each reply keeps its raw direct-CLI
reference, selected store and any decision-section replacements. The smoke
checker compares reply bytes with those receipts and health calls.

Graph and graph-norule call the real CLI with the run repo and full store.
Stub returns `no result`. Graph-nosearch does that only for search.
Graph-noterms copies the one store and removes Term nodes and MENTIONS edges.
Graph-nolink copies the store and removes CITES edges. No source or recipe
changes implement an ablation. Receipts record copy and mutation time.
Fingerprints check all other nodes, relationships, record text and vectors.

### Store preparation, 2026-11-16

The original fingerprint projects both endpoints' complete properties for
every relationship. Relate materializes those rows. Node then buffers,
parses and sorts the complete JSON output. On the real 1,934-record store,
the original fingerprint reaches the 2 GB scope limit and the kernel kills
it before it returns. Three concurrent preparations compound that cost.

The fingerprint now binds each internal node ID to its labels and complete
properties. Edge rows contain their internal ID, both endpoint IDs, type
and complete relationship properties. A clone retains these IDs after a
delete. Ordered SHA-256 streams retain multiplicity and endpoint identity.
This covers every node property, including record text and search vectors.
The unchanged components keep their old equality checks.

Each query ranges IDs before projection: at most 256 nodes or 4,096
relationships. One read-only database session runs the bounded statements.
The reader canonicalizes and hashes one JSON row at a time. Counts from
the bounds query must match the streamed row counts. A truncated stream
refuses, including a successful child exit with missing rows. Relate still
loads its graph. Memory grows with the stored node properties and edges,
plus one bounded projection, rather than edge count times node size.
The small statement list grows with the highest IDs divided by the range
sizes. Large gaps in IDs add scans, without expanding endpoint properties.

`ablatedStores(store, directory)` remains synchronous and exported from
`eval/closed-store.mjs`. A `flock` subprocess owns the directory lock until
preparation or validation ends. A first caller copies and proves each
ablation once. Simultaneous callers wait on that same kernel lock.
The first caller publishes `prepared.json` with one rename after all
proofs pass. A killed caller leaves incomplete evidence; the next caller
refuses it for inspection. Preparation never deletes that evidence.

The version-1 receipt records the canonical source path, fingerprint
algorithm, preparation time, all three fingerprints, both proofs and
file identities for all three stores. Each file identity includes path,
device, inode, byte length, nanosecond modification time and change time.
Relate's advisory lock files are excluded because a read-only open changes
them. They hold no graph data. The ready check compares every other file,
including the snapshot manifest and WAL files. Missing, added, replaced or
changed data files refuse the run. The per-ablation source and proof files
must also match. Old receipts refuse; no compatibility path rebuilds them.

Later cells and restarted runners check metadata under the same lock.
They neither copy nor fingerprint a store. Their health records use the
proved fingerprints from the receipt. The stores must stay immutable for
the batch lifetime. Read-only service queries satisfy that requirement.
The receipt detects local changes; it is not authentication against a host
attacker who can rewrite both data and receipts.

| State | Lives in | Owner | Lifetime | Boundary token | Outcome |
| --- | --- | --- | --- | --- | --- |
| Preparation lock | `.prepare.lock` | Kernel flock | Preparing or checking subprocess | Open lock file | Released on exit |
| Incomplete stores | Ablation directory | Lock holder | Until publication or operator inspection | `preparing.json` | Prepared or inspection required |
| Ready stores and proofs | Ablation directory | Batch | Immutable batch lifetime | `prepared.json` and file identities | Validated or harness failure |

The brief forbids delegation and hosted models. No formal proof is claimed
for this I/O change. The independent author owns new race, crash and
memory checks from B7-83 onward. Existing ablation checks remain unchanged.

`carrySections` and `termLines` omit a term candidate already shown through
a link. Deleting CITES alone would change the term section. The eval service
therefore renders the full carry answer, then replaces only its decision
sections with `whyAnswer` from the ablated store. It uses the product's
parser, recipes and formatter. It checks the section before replacement.
All other sections retain their original bytes, including term candidates.
The range form applies the same operation to each overlapping symbol.
Impact stays full in graph-nolink: that condition removes commit records
from carry and why only. Search stays full too.

### Resolver and real-agent preflight, 2026-11-16

The fourth smoke start at ec76408 failed before any token was spent.
`/etc/resolv.conf` linked outside the mounted system folders. The link was
dangling in the agent namespace. The agent emitted `UnknownError` with
`Unexpected server error` and exited 1. Its attempt metadata had no cause.
A host probe with the missing resolver dependency mounted reached the model.

The confinement derives dependencies from the host's standard resolver
inputs at each launch: `/etc/resolv.conf`, `/etc/nsswitch.conf`, `/etc/hosts`,
`/etc/host.conf` and `/etc/gai.conf`. It follows symlinks, recreates required
external links and mounts each final external regular file read-only.
It mounts no containing folder. This exposes only the referenced file's
bytes, with no siblings, sockets or service directories. A plain resolver
file already in `/etc` adds no mount. Every condition uses the same rule.
Private work, tool checkout and identity-home targets refuse. Dynamic
`/proc`, `/dev`, `/tmp` and tool/socket namespace targets refuse too.
Non-regular targets, unreadable inputs, dangling links, link cycles and
executable external targets refuse. Store proofs and agent file-identity
checks keep their existing contracts.

Before any pending closed-store cell starts, a real-agent preflight runs
once through the same launch builder. The empty repo has no task content.
The model, arguments, environment, mounts and live private socket layout
are the cell's. The store service has no task store. A fixed prompt asks
for `ok` without tools. Only exit 0, a successful stop, positive tokens,
exactly that trimmed word and no tool use pass. The runner waits for this
result before reserving a cell. A failed preflight starts no cell and
writes no cell result, ledger entry or attempt archive. Plans and empty
resumes start none. A standalone `eval/preflight.mjs --batch N` entry runs
only this preflight for a registered closed-store batch from 7 onward.

Preflight evidence lives under `results/_preflight/<UUID>/`, with
`record.json` rather than cell metadata. It keeps the command, native
events, stderr, exit, tokens, wall time and scratch path. A separate startup
record compares resolver, time zone and system certificate hashes and
checks the identity directory without reading its files. The scorer
ignores these records. The smoke checker reports preflight usage and time
on a separate line. No cell identity, plan count or score changes.
Rehearsal explicitly skips this step because its stand-in has no model
connection and no tokens. ADR 0013's executable substitution still governs
all rehearsal cells. Batches 1 to 6 keep their setup and launcher bytes.

A closed harness failure records the named agent error's first message
line and its exit status. Bounded diagnostics redact prompt text before
truncation and do not copy stderr, tools, file contents or nested response
payloads. Attempt metadata and ledger records retain the cause. The final
invalid marker and thrown error keep both retry causes. Missing native
events still produce an explicit exit or completion cause.

This change is launch and filesystem I/O. The independent author owns
B7-119 through B7-133. It claims no new formal proof. Finished and archived
closed-attempt work folders remain audit evidence; no cleanup rule changes.

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
| Pending command closures | Host launcher | Attempt cleanup | Child process identity | Await pipe closure and scope witness after kill; reject after 10 seconds |
| Namespace scope witness | One launcher connection | Command scope | pidfd opened before startup barrier release | Namespace first process ends; witness closes |
| Attempt reservation | Cell ledger | Across runner restarts | Cell id and reserved entry | Result recorded or inspection required |

`scripts/attempts.pure.ts:attemptDecision` contains the existing retry rules.
`eval/run.mjs:settleCell` applies them with an injected `runAttempt` and
result directory. It reserves each closed attempt before launch and archives
each failed attempt before another launch. Two agent ends leave an unscored
marker. Any pair with a harness end stops with an invalid marker. A reserved
interrupted attempt stops for inspection. A completed ledger launches nothing.
Open-store opencode keeps the batch 5 and 6 invalid-then-timeout ladders,
including their possible third attempt. This extraction changes no old rule.

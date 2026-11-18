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
carry NUL. The client rejects calls over its frame limits with the same
usage diagnostic and exit 2 before connecting.
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

### Refused requests, 2026-11-16

The parent's ruling separates frame refusals from service failures.
The fifth batch 7 smoke start stopped after about nine minutes. Raw HTTP
probes caused `invalid argument count` failures in 3 of 4 graph-family
attempts, although every real client call returned exit 0 or usage exit 2.
Invalidating only those conditions biases the comparison.

Before dispatch, a count over 64, an argument over 60,000 bytes, or a
request over 65,536 bytes closes the connection without a reply or query.
The service logs `{"event":"refused","message":...}` and records `refused`
and ordered `refusalReasons` apart from `failures` and failure `reasons`.
Attempt metadata keeps both groups under `service`. A refusal alone leaves
an attempt valid. Empty connections and incomplete frames within the
declared limits still count as neither refusals nor failures.

The real client checks all three byte limits before connecting. A bad
call returns empty stdout, the existing one-line usage diagnostic on stderr
and exit 2. Calls within the limits keep the direct product diagnostics.
A dispatched answer failure, a real unavailable client or a launcher fault
remains a harness failure. Launched commands cannot reach the shell socket:
their namespace mounts only the store socket. B7-79 stays unchanged.

The smoke checker counts only dispatched replies against `service.calls`,
requires zero failures and reports refusals separately. It verifies refusal
counts and reasons against metadata. It also counts raw refusals as observed
agent attempts. Direct-answer receipts still gate every dispatched reply.
This ruling amends B7-13, B7-63 and B7-80. Batches 5 and 6 stay frozen.

### Stopped calls, 2026-11-17

Ruling of the code author `sandpiper-whygraph`, confirmed by the coordinator
`rowan-joshka-main` on 2026-11-17: a call that the run's own stop cuts is a
stopped call, not a service failure. A call that fails while the run lives
stays a harness failure.

The sixth batch 7 smoke finished 16 of 16 cells and failed two smoke-check
lines. One attempt timed out while a socket program of the agent held eight
`search` calls open. The runner read `failures: 0` into the metadata and
then stopped the service. The stop aborted the eight product commands, and
the service logged eight failures that the metadata did not hold.

On stop, the service aborts the calls in flight and waits until each has
settled and its product command has exited. It logs each as `{"event":"stopped","args":[...]}` and records
`stopped` apart from `failures` and `refused`. A second stop does nothing.
The runner stops the launcher, then the service, and then reads the stats,
so no row follows the metadata. Stopped calls leave an attempt's
classification unchanged.

The smoke checker counts reply rows plus stopped rows against
`service.calls`, verifies the stopped count against metadata and reports
it. It still requires zero failures and four health replies per attempt.
Earlier evidence is not read again under this rule: the sixth smoke stays
failed in `_smoke-archive/6-stop-logged-as-failure`. Not covered: a product
command that hangs until the 20-minute limit ends as a stopped call in an
attempt classed as an agent timeout. The stop does not wait for a `relate`
query that a product command started; that query only reads and ends on
its own. Failure items B7-168 to B7-177.
Batches 5 and 6 stay frozen.

### File-tool paths in the private /tmp, 2026-11-17

Ruling of the coordinator `rowan-joshka-main` on 2026-11-17, before any
batch 7 result exists: for batch 7 and later, a file-tool path inside the
confinement's private `/tmp` is not an isolation breach. Batches 5 and 6
stay frozen.

Reason: the breach rule of `eval/opencode.mjs` dates from batch 5, where
the agent's file tool could follow a path out of the repo copy. It classes
every absolute file-tool path outside the repo as a breach. The closed
confinement mounts a fresh tmpfs on `/tmp`, and the agent's opencode config
allows `/tmp/opencode/*`. A file there cannot reach the host, the store or
another run. In the seventh batch 7 smoke the old rule classed 5 of 21
attempts as breaches and left 2 of 16 cells unscored, all on one hard task
and in conditions without help. That exclusion would bias the comparison.

The closed runner drops a file-tool or patch path that resolves inside
`/tmp` from the breach list, read or write. `..` segments are resolved
first, so `/tmp/../etc/passwd` stays a breach. Every other outside path, a
symlink that leaves the repo and a shell command that creates a symlink
stay breaches. The attempt budget is unchanged. `eval/opencode.mjs` keeps
its bytes. The seventh smoke stays as it ended in
`_smoke-archive/7-private-tmp-classed-as-breach`. Failure items B7-178 to
B7-186.

### No tool against the whygraph client, 2026-11-17

Ruling of the operator on 2026-11-17, relayed by the coordinator
`rowan-joshka-main`, before any batch 7 result exists: the sandbox blocks
spying on the whygraph client and its traffic. The operator chose the
design below over removing `node` too and over keeping every program.

Context: in the sixth and seventh batch 7 smoke, agents that got only a
ticket's title and link hunted for its text. In 36 attempts they ran
`strace` in 19, `curl` in 19, `socat`, `nc`, `ltrace` and `strings` in 14
each, `gdb` in 12, a C compiler in 12 and `LD_PRELOAD` in 11, and sent raw
frames to the service socket. No attempt read a record's text. The socket
carries only the answers of the run's own condition, so a spy tool could
gain nothing. The block removes the question and the cost of these hunts:
several ran to the 20-minute limit.

Choice, for batch 7 and later:

1. Program list. A shell command's namespace holds only the programs and
   folders that `eval/closed-shell.json` lists, and
   the libraries that those programs load. It holds no compiler, no
   interpreter except `bash`, `awk`, `sed` and `node`, no tracer, no network
   client and no binary reader. `node` and the host's TypeScript stay: 7 of
   36 attempts type-checked their change with them. A listed name that the
   host lacks stops the run before the agent starts.
2. Seccomp filter. The agent namespace and every shell-command namespace
   deny `ptrace`, `process_vm_readv` and `process_vm_writev` with `EPERM`.
   The filter is built for x86-64; another machine stops the run.
3. Static client. The client is linked statically, so the loader variables
   (`LD_PRELOAD`) have no effect on it. A dynamic build stops the run.
4. Client token. Each run draws 256 random bits and writes them into its
   own copy of the client, which stays execute-only. The client sends the
   token before its frame. The service compares the first 64 bytes in
   constant time, only after all 64 arrived or the connection closed. A
   connection that sent bytes and no valid token is a refused request with
   reason `missing client token`; it gets no reply and no query, and the
   attempt stays valid. The token is in no log, metadata file or
   environment variable. `files.json` records the hash of the token-free
   client, so the comparison of agent files across conditions holds.

Consequences: a raw probe of the socket is now refused for its missing
token before the frame limits apply; this amends B7-134 to B7-138. Runs lose
`python3`, `perl`, `curl` and the other unlisted programs in every
condition. `node` stays, so a command can still write and run its own
program; that program has no token and cannot trace or preload the client.
The seventh smoke and its results stay archived; an eighth smoke runs with
the block. Failure items B7-187 to B7-199. Batches 5 and 6 stay frozen.

### Command limit, 2026-11-17

Ruling of the code author `sandpiper-whygraph` on 2026-11-17, sent to the
coordinator `rowan-joshka-main` before any result under it: one run's
service runs at most two product commands at the same time. Later calls
wait in arrival order.

The first batch 7 pilot ended after 27 of 258 cells: the kernel killed the
run scope at its 6 GB memory limit (2026-11-17 21:41). In
`zustand7-conflict-zs-03__graph-nosearch__r3` the agent ran
`xargs -P 16` over about 120 guessed record ids, each as
`timeout 15 whygraph impact <id>`. The service started one product command
for each call and kept each command after its client had timed out, so the
commands piled up. The kernel's report lists 40 `node` product commands
(2.0 GB), 32 `relate` queries (2.9 GB) and three agents (1.8 GB). One
product command with its query holds about 180 MB.

With the limit, three runs hold at most six product commands, about
1.1 GB. The limit changes no answer and no log row: a waiting call gets the
same reply later. A call whose client went away still runs when its turn
comes and logs its reply row, as before. Direct answers (a stub call, a
disabled search, an unsupported command) and refusals start no product
command and do not wait. A parser diagnostic (a missing target, an unknown
option, help) comes from the product CLI, as decided earlier for its exact
bytes, so it takes a place like any product command. On stop, each waiting
call ends as a stopped call and starts no command. The limit is per
service, so one run's calls do not delay another run.

The three cells in flight at the kill had a reserved attempt and no
result. Their files are in `eval/results/_pilot-archive/1-scope-oom-kill`.
Their reservations were removed by hand, so each cell keeps its two
attempts: the runner never judged these attempts. The 27 finished cells
stay. Not covered: a run can still make an unlimited number of calls one
after the other, and a shell command can still start many `node` programs
of its own. Failure items B7-200 to B7-208.

### Review findings, 2026-11-18

Two reviewers read the spy block and the command limit on 2026-11-17:
Codex `gpt-6.2-astra` and Gemini Carbon. Each finding came with a failing
check. Rulings of the coordinator `ash-coordinator`, 2026-11-17 and
2026-11-18, recorded before any result under them.

**Read-only namespace root.** The root of the agent namespace and of each
shell-command namespace was a writable tmpfs. A shell command could rename
`/whygraph`, put its own socket at `/whygraph/service.sock` and read the
token that the client sends (Carbon; the repro got the run's token). Both
namespaces now end with `--remount-ro /`. `/repo`, `/tmp`, `/home/agent`,
`/config`, `/cache` and `/state` are their own mounts and stay writable.
The coordinator kept the 43 finished cells on two conditions. Condition 1,
checked on 2026-11-18: in the 43 cells and the 3 archived attempts (2,128
shell commands, 138 file-tool calls), no command wrote under the root
outside those mounts; two commands that tried (`touch /whygraph/testfile`,
`mv /whygraph/service.sock`) were refused by the agent's own permission
rule and never ran. The check reads command text and file-tool paths; it
does not trace system calls. Condition 2: a smoke on the read-only root
passes all eight lines before the pilot resumes.

**Refusals counted at stop.** A connection that sent part of a token counts
its refusal when it closes. The stop returned before that close, so the
metadata could miss a refusal that the log then held (Astra). The stop now
waits for each connection's close.

**Cached client.** The static-link check ran only on a new build. Each use
now checks the client file and compares it with its recorded hash (Astra).

**Known limit: the shell mounts all of `/etc`.** On the dev box 97 files
under `/etc` are runnable `#!/bin/sh` scripts (Astra). They add no program:
`sh` and `bash` are listed, and a script reaches only the listed programs.
The coordinator kept the mount for this pilot, because a mount change
would need a new smoke for no closed route. Task
`jos-whygraph-etc-list-iut` replaces it with a file list before the next
pilot.

Not covered: a program that calls `unshare` or `mount` itself could build a
nested namespace; no listed program offers these calls. Failure items
B7-209 to B7-213.

### Evidence for closed access, 2026-11-16

The parent's ruling removes read-success guesses from agent tool logs.
Four commands in the fifth smoke archive suppressed stderr, piped results
or joined discovery and read commands. The check called denied reads
successful because no denial word survived. A loose shell pattern also
classified `file` after `head` as a content read.

Agent-controlled text has no command-independent proof of provenance.
Store text can also arrive through valid service answers. Client and source
bytes can be encoded, shortened or suppressed. No universal content witness
can be recovered from these logs for store, client, product source or relate.
The smoke check counts literal input mentions as observations. It gives
neither a success nor a denial verdict from agent-shaped input or output.

Access proof uses the five fixed host probes, the confinement mounts and
client mode, plus B7-60's direct-answer receipts. All five named probes must
run and deny; a zero status fails regardless of agent output. The store
probe reads real manifest files in the full and selected stores. The source
probe detects readable service or product source. The relate version probe
detects the actual executable without depending on a mounted store. The
client stays execute-only and read-only with dropped capabilities. No store
fingerprint or frozen batch changes. B7-62 records this evidence contract.

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

# Batch 7 failure cases

Fixed before the first run. An independent author writes cases from this
list. This implementation edits no file under `eval/selftest/`, `test/` or
`skills/`. ADRs 0010, 0011 and 0012 record the changed decisions.

## History and preserved inputs

- B7-01: Change the working skill or rule after recording a batch commit. Expected: preparation reads the recorded bytes with `git show`; batches 5 and 6 still use c92205d.
- B7-02: Remove a recorded commit, a recorded file, or instructionsCommit. Expected: preparation refuses before changing any work folder or starting any process for the agent. Plans remain read-only and available when tasks exist.
- B7-03: B6-26 compares working skill bytes with c92205d. Expected: the independent author moves skill/rule comparisons to the batch's recorded commit, while keeping the launcher byte check. No implementation edit to this test is allowed.
- B7-04: Generate or score any batch. Expected: no batch 1 through 6 task byte, blind-input byte or stored decision/store byte changes. With no batch 7 results, score output equals eval/score.txt byte for byte.
- B7-05: Plan a batch 5 id and a batch 6 id using the same saved metadata as the base. Expected: stdout, stderr, cells, defaults and resume counts match c243073 exactly.
- B7-06: Registry repo or batch is absent, unknown, malformed or mismatched to a task. Expected: visible refusal, no model call; another repo needs only valid registry data and blind files.

## Closed store and transport

- B7-07: From the full agent namespace, run relate against its actual store path, through a script, through an absolute path, or with a direct protocol client. Expected: relate/store access fails; only the four command protocol can return store content.
- B7-08: Read any store file through a native file tool, shell, symlink, guessed host path, or /proc/1/root. Expected: the store is absent from that namespace; no bytes are returned. Detection after success is a failure.
- B7-09: Read the client executable or service/product source. Expected: execute-only client read fails, source paths are absent, and chmod cannot make the mounted client readable. Check native file reads as well as shell reads.
- B7-10: Address a second run's service from the first run, including its known host socket path. Expected: that path is absent; only the first run's socket is mounted. The first run never receives the second run's answer.
- B7-11: Read repo files and edit an ordinary source file with native tools or the shell. Expected: normal operations work inside the whole-agent namespace. A sandbox that denies all useful work fails this case.
- B7-12: Invoke carry, carry range, why, impact and search on the fixture's real store through the client. Expected: graph and graph-norule stdout, stderr and exit status equal the direct CLI byte for byte, including usage and missing-target errors. Missing arguments and extra positional arguments use the direct parser diagnostic and full help, on the same streams and exit status. See B7-80 for inputs outside the executable route.
- B7-13 (amended 2026-11-16, parent's ruling): Send an unknown command, extra arguments, a store override, raw Cypher, an oversized frame or embedded NUL. Expected: no alternate route to the store; usage rejection or closed connection, never a query execution. A frame-level refusal logs `{"event":"refused","message":...}`, increments `refused` and `refusalReasons`, and leaves `calls`, `failures` and failure `reasons` unchanged. It closes without a reply. Other clients keep working. A refusal alone never invalidates an attempt.
- B7-14: Stop the service before a call. Expected: client prints `whygraph service unavailable`, exits 70; the attempt is a harness failure, never an agent verdict or a successful no-result answer.
- B7-15: Fail preparation, health probe, agent spawn, malformed non-timeout JSONL or a service call. Expected: service closes in finally, attempt evidence remains, runner follows the harness retry rule. No orphan listener remains.
- B7-16: Complete or time out a run. Expected: service closes, stdout/stderr and full service answers stay archived, no process survives to answer another run.
- B7-17: Inspect files across conditions for one task. Expected: every repo and tool byte is identical, except AGENTS.md in graph-norule differs by exactly the omitted rule. No condition, store path or stand-in branch is readable from a tool.
- B7-18: Prepare graph-norule. Expected: the skill is present and unchanged; AGENTS.md has the original repo text and no appended whygraph rule. Other conditions have the exact recorded suffix.
- B7-19: Run a shell command that tries network access or reads the CLI identity mount. Expected: both fail; normal source and whygraph commands still work. No credential probe may read actual credential bytes.

## Ablations

- B7-20: Stub calls any of the four commands with a valid target. Expected: exactly `no result\n`, status 0, no graph content.
- B7-21: Graph-nosearch calls search. Expected: exactly `no result\n`, status 0. All four other fixture answers (including both carry forms) equal graph bytes.
- B7-22: Graph-nolink retains a CITES edge or a carry/why commit-linked record. Expected: proof and smoke checks fail. Direct tag links remain; no decision node is removed.
- B7-23: Remove CITES from a fixture whose linked ticket also shares source terms. Expected: the service removes only carry's decision section; its original term section remains byte-identical, with original de-duplication. Cover symbol and range forms, multiple overlapping symbols, tags, neighbors, users and commit lists.
- B7-24: Compare graph-nolink search and impact with graph. Expected: stdout, stderr and status match byte for byte. Compare carry's unrelated sections and term candidates the same way.
- B7-25: Graph-noterms retains a Term node, MENTIONS edge or printed term candidate. Expected: proof and smoke checks fail. Carry uses the product's no-shared-record term note, or its existing no-term/long-span note when appropriate.
- B7-26: Graph-noterms changes a linked answer, search result, record text/vector, why or impact. Expected: fingerprints or fixture byte comparison fail. Every component outside Term/MENTIONS is unchanged.
- B7-27: A copied ablation removes an unrelated node/edge, changes any search vector or keeps its disabled component. Expected: ablatedStores refuses; no agent starts. A completion marker from another source store also refuses.
- B7-28: A product carry format change prevents the exact decision-section replacement. Expected: explicit service failure; never silent truncation, a guessed section or an ordinary agent result.
- B7-29: Build or query from any condition. Expected: no condition branch, flag, environment switch, source change or recipe change in the product. Every relate child has RELATE_TELEMETRY=0 and DO_NOT_TRACK=1.

## Fetch and record content

- B7-30: Fetch an issue, closed completed issue, closed not_planned issue, open PR, unmerged closed PR and merged PR. Expected: state, close reason, PR flag and merge status are retained accurately; merged_at from the issue list supplies merge status, without a per-PR request.
- B7-31: Ticket comments include OWNER, MEMBER, COLLABORATOR, CONTRIBUTOR and NONE authors. Expected: only the first three associations survive, in creation-time order with URL tie-break. Outside comments never enter record text or search.
- B7-32: Stop after a complete API page, then restart. Expected: matching raw cached pages make no request; incomplete pending pages are not used; all final tickets appear once. Cache keys include the exact URL and verify it.
- B7-33: Receive 403/429 with reset or Retry-After. Expected: wait until the limit permits another request, then continue. An unrelated HTTP error fails visibly; no authentication or identity-specific header is added.
- B7-34: A repo has T tickets and C comments. Expected: before fetching, print ceil(T/100)+ceil(C/100), at least two, when expected counts are supplied; otherwise print the formula and unknown totals. Request count is per page only, not per ticket. Pagination remains on api.github.com.
- B7-35: Ticket export lacks state, close reason field, PR flag, merge status for a PR, or comments. Expected: conversion refuses before output write; no record silently lacks an outcome. A null close reason prints `not stated`, without inferring completed.
- B7-36: A record has a large Unicode body and many maintainer comments. Expected: title plus item texts total at most 8,000 UTF-8 bytes, outcome retained, newest comments preferred, body cut first, then older comments. No split Unicode character; metadata and labels do not consume this stated content budget.
- B7-37: Search the new record's outcome and a retained maintainer comment. Expected: existing searchText includes those item texts. Do not rebuild or change batch 5/6 decisions or stores to test this.

## Sampler and generator

- B7-38: Reverse tickets and commit order, then sample twice. Expected: the registry sample count of unique ticket ids in each stratum, identical bytes for the committed seed. Source extension rules live in registry data.
- B7-39: A ticket is cited only by a non-source commit. Expected: it enters neither stratum. A closed ticket cited by no commit is eligible uncited; an open uncited ticket is not. A source-cited ticket is eligible cited regardless of state.
- B7-40: Either stratum has fewer candidates than its registry sample count. Expected: sampler names stratum and actual count and writes no sample. Invalid repo, missing source extensions/seed, duplicate ticket keys, malformed ticket/state or missing input also refuse before writing.
- B7-41: A blind file is absent, invalid JSON, has a missing hash or differs by one byte. Expected: generation refuses before every task write, including conflict files. Test all five files.
- B7-42: The request count differs from counts.requests, sample ids are not unique ticket ids, sample strata are invalid or their counts differ from sampleCounts, a request names a ticket outside the sample or with a different stratum, two requests name the same ticket, or an id can escape the task folder. Expected: refusal and no task write. Requests may cover a subset of the sample. Missing request fields retain B6-11's validation.
- B7-43: Targets lack a unique entry per request, have unknown ids, or miss file/symbol fields. Expected: refusal before writing. An empty target list or invalid range makes that request ineligible; one valid range keeps the complete target list.
- B7-44: Either stratum has fewer than six eligible ranged requests. Expected: error names the stratum, required six and actual count; no task file is written.
- B7-45: Input requests arrive in reverse order. Expected: first six eligible ids per stratum, twelve conflicts, three plain and four governed controls, with preserved source entries and explicit conflict strata. Repeated generation is byte-identical.
- B7-46: Controls have wrong counts, missing fields, invalid added regex, duplicate/reused id or malformed governed ticket. Expected: refusal before all writes. In batch 7, a missing control commit is still invalid under the inherited source contract.
- B7-47: Conflict names a valid source/also ticket and changes no file. Expected: batch 5 verdict; any file change fails, including mode/binary/new/delete/rename. Controls retain the diff-only verdict and stay separate from conflicts.

## Attempt budget

- B7-48: Drive `scripts/attempts.pure.ts:attemptDecision` and `eval/run.mjs:settleCell` with an invented `runAttempt` and isolated `results`. Two timeouts. Expected: exactly two archived attempts, unscored marker, continue, resume skips; FAIL sensitivity includes a conflict.
- B7-49: Drive `scripts/attempts.pure.ts:attemptDecision` and `eval/run.mjs:settleCell` with an invented `runAttempt` and isolated `results`. Two isolation breaches. Expected: same as B7-48, both invalid attempts preserved.
- B7-50: Drive `scripts/attempts.pure.ts:attemptDecision` and `eval/run.mjs:settleCell` with an invented `runAttempt` and isolated `results`. Timeout then isolation breach. Expected: same as B7-48; no third attempt, no harness-stop misclassification.
- B7-51: Drive `scripts/attempts.pure.ts:attemptDecision` and `eval/run.mjs:settleCell` with an invented `runAttempt` and isolated `results`. Isolation breach then timeout. Expected: same as B7-48; no third attempt, no separate timeout retry ladder.
- B7-52: Drive `scripts/attempts.pure.ts:attemptDecision` and `eval/run.mjs:settleCell` with an invented `runAttempt` and isolated `results`. An agent-caused end then a successful retry. Expected: exactly two attempts; score only the successful one; retain the first archive.
- B7-53: Drive `scripts/attempts.pure.ts:attemptDecision` and `eval/run.mjs:settleCell` with an invented `runAttempt` and isolated `results`. Harness failure then successful retry. Expected: one retry, success scored, first failure retained. Two harness failures, harness then timeout/breach, or timeout/breach then harness failure stop after two attempts with both archives and an invalid root marker excluded from every scorer block. Test each order. A service failure during a timed-out attempt remains a harness failure.
- B7-54: Drive `scripts/attempts.pure.ts:attemptDecision` and `eval/run.mjs:settleCell` with an invented `runAttempt` and isolated `results`. Restart after an unscored marker or after the two-attempt ledger is exhausted. Expected: no third launch. A reserved interrupted attempt fails visibly for inspection and is not silently forgotten.
- B7-55: Drive `scripts/attempts.pure.ts:attemptDecision` and `eval/run.mjs:settleCell` with an invented `runAttempt` and isolated `results`. Run the same timeout/breach pairs in batches 5 and 6. Expected: their pre-batch-7 behavior remains unchanged; no new retry rule changes saved results.

## Plans and smoke checks

- B7-56: Plan all batch 7 tasks. Expected: 258 distinct cells, three repeats, six conditions on conflicts and only stub/graph on controls. No template access, build, dependency install, result write or model starts.
- B7-57: Plan smoke. Expected: 16 distinct repeat-1 cells; first cited conflict, first uncited conflict, first plain control, first governed control. Missing tasks, missing strata or incompatible stage/selection flags refuse.
- B7-58: Request an unknown stage/condition, duplicate condition, nonpositive/noninteger repeat count, or an ablation on a control. Expected: visible refusal. No unsupported condition enters scoring either.
- B7-59: Smoke has a missing/unfinished cell, mismatched meta, invalid unscored rule, third attempt, running ledger entry or missing archive. Expected: `FAIL planned cells`, nonzero exit; never a task pass rate or verdict.
- B7-60: Any saved valid disabled command answers or any enabled health command fails/answers no result; an unrelated store component changes, a direct-answer receipt is absent, or a saved answer differs from that receipt or its health call. Expected: `FAIL condition answers`, nonzero exit. Check every recorded answer, including archived attempts. Invalid invocations retain direct CLI diagnostics even in stub and graph-nosearch; those replies must equal their direct receipts.
- B7-61: A repo/tool file differs across conditions, an instruction suffix differs, graph-norule still has the rule, or its original AGENTS.md differs beyond the omitted rule. Expected: `FAIL identical agent files`, nonzero exit.
- B7-62 (amended 2026-11-16, parent's ruling): Require all five distinct named host confinement probes, each with an integer nonzero exit status. A successful probe, a missing or duplicate probe, or a probe that did not run produces `FAIL closed store and tool code` and nonzero exit. Fixed read/execute probes, mount boundaries, execute-only client mode and B7-60 answer receipts cover access to store, client, service/product source and direct relate. Agent-authored command/result text never establishes read success or denial. Literal path and tool-name mentions in any tool input count as observed agent attempts only, together with raw frame refusals. The PASS line prints denied-probe, observed-attempt and raw-refusal counts. Discovery commands, redirects, pipelines, joined commands, empty output and denial words have no access verdict.
- B7-63 (amended 2026-11-16, parent's ruling): Supply service replies and refused-request events. Expected: `PASS service answered every call` only when `failures === 0`, reply totals match `service.calls`, at least four health replies exist, every reply is well formed and available, and refusal count and reasons match `service.refused` and `service.refusalReasons`. The PASS line prints the refusal count. Refusals need no reply and do not count as dispatched calls. Missing, malformed or unavailable replies, failures, mismatched totals or missing refusal metadata produce `FAIL service answered every call` and nonzero exit. No missing-evidence PASS.
- B7-64: Scorer fails or omits a batch 7 block, stratum or any paired ablation difference. Expected: `FAIL scorer batch blocks`, nonzero exit; scorer output itself is not printed by smoke-check.
- B7-65: Any attempt lacks finite nonnegative tokens or wall time. Expected: `FAIL tokens and wall time per run`, nonzero exit. The successful check lists every attempt's usage/time, including archived attempts.
- B7-66: No smoke task/result exists. Expected: every relevant check fails for missing evidence, exit nonzero. No empty loop yields a passing health claim.
- B7-67: Smoke passes and full planning resumes. Expected: those exact 16 cells count as completed repeat 1. After a failed smoke, parent archives results and their ledgers before restarting.

## Scorer

- B7-68: No batch 7 result or only invalid archives exists. Expected: all earlier report bytes unchanged, no batch 7 heading. Finished/error batch 7 results append after batch 6; JSON contains finished verdicts only.
- B7-69: Mixed stratum/condition results. Expected: conflicts over all/cited/uncited per condition; graph - stub primary and graph minus every ablation; seeded per-task bootstrap, only paired tasks. No control/error/invalid attempt enters normal conflict rates.
- B7-70: Conflicts and controls have shown/unshown required tickets, missing pairs and errors. Expected: condition quadrants and saved-answer needed-ticket counts use batch 5 rules; controls remain plain/governed apart; unscored conflicts enter FAIL sensitivity; finished-only tokens/cost per condition. Absolute client paths count as whygraph calls in the closed runtime; older report bytes stay unchanged.
- B7-71: A graph-nolink carry attempt would change an unrelated section due to linked-record de-duplication. Expected: the fixture byte proof fails unless only the decision section changes. Do not weaken the comparison to an edge count alone.

## Host-owned shell launcher

These cases use `startClosedShell` from `eval/closed-store.mjs`. Start both
host services before entering the captured agent confinement. Keep the
launcher alive until commands finish. An ended attempt's captured argv is
not a live run: its socket mounts no longer exist. Do not start an agent.

- B7-72: Run source reads, edits and all four commands through the generated `/tools/shell`. Expected: source operations succeed; each tool reply equals the direct CLI for that condition. Run from a nested repo directory too.
- B7-73: Connect to a live host TCP listener through the generated shell. Expected: the connection fails; the same listener is reachable from the network-enabled agent namespace.
- B7-74: Read `/identity/launcher-probe` through the generated shell. Expected: exit 1 with `cat: /identity/launcher-probe: No such file or directory\n` on stderr and empty stdout. Test mount absence without reading credentials.
- B7-75: Feed stdin containing NUL and non-UTF-8 bytes; emit binary stdout and stderr; exit 37. Expected: exact input bytes reach the command, each output stream keeps its bytes and order, and the client exits 37. Repeat with output larger than the pipe buffers and with a delayed stdin producer. Also run `head -c 1048576 /dev/zero; cat` with 1 MiB of stdin: expect 2 MiB of stdout, exact zero/input byte order, empty stderr and exit 0, without a deadlock.
- B7-76: Start a command with background children, including a child in a new session, then end the run by timeout or cleanup. Expected: command and children terminate before cleanup returns; no later file write occurs. Disconnect its client and kill the runner in separate cases. No command survives either owner.
- B7-77: Guess another run's launcher folder or socket from the agent and from its shell. Expected: no reachable path and no second-run output. A shell command cannot reach even its own launcher socket.
- B7-78: Mount a live launcher's socket, then stop that launcher before invoking `/tools/shell -c true`. Expected: stdout empty, stderr `whygraph shell launcher unavailable\n`, exit 70; the attempt is invalid with a harness-failure reason, including during a timeout. Starting a namespace after cleanup instead fails its missing mount and does not test client diagnostics.
- B7-79: Fail launcher startup, fail a command spawn, send an invalid shell frame, or close a connection mid-command. Expected: acquired resources close; no child survives. Startup, spawn and protocol failures count as harness failures. A client disconnect cancels its command. A command's ordinary nonzero exit remains an agent result.
- B7-80 (amended 2026-11-16, parent's ruling): Send a valid unsupported command, a valid option-bearing command, or an embedded NUL argument. Expected: stdout empty, stderr exactly `usage: whygraph <carry|why|impact|search> <target>\n`, exit 2; no store query. Exec argv cannot carry NUL. Invoke the real client with over 64 tool arguments, an argument over 60,000 UTF-8 bytes, or a total tool frame over 65,536 bytes including the count and lengths. Expected: the same usage diagnostic and streams, exit 2, and no service connection or harness failure. Raw frames that exceed those limits close without a reply and count as refused requests under B7-13. The shell protocol permits at most 1,024 fields and a 1 MiB request; stdin frames contain at most 8,192 bytes. B7-79 remains unchanged.
- B7-81: Hash every initial repo, script and client file across conditions, including `/tools/shell-client`. Expected: byte identity except the exact omitted rule; no socket path, store path or condition occurs in a readable shell script.
- B7-82: Launch from a repo path reached through a host symlink. Expected: service target mapping uses the canonical repo root; `/repo/...` targets work like relative targets.


## Bounded store preparation

These cases call the synchronous exported `ablatedStores(store, directory)`
in `eval/closed-store.mjs`. They start no agent. `storeFingerprint(store)`
remains a synchronous independent graph fingerprint entry. Build stress
input with `node eval/store-stress.mjs <new-directory> 5000`. Each record
has 384 directly assigned deterministic floats and about 8,000 text bytes.
There are 305,000 relationships. No embedding model runs.

Run every store command in
`TMPDIR=/mnt/ssd/tmp systemd-run --user --scope -q -p MemoryMax=2G -p CPUQuota=400% <command>`.
Use a new scope for each measurement. The cgroup `memory.peak` includes all
processes and charged file cache. `node eval/measure-preparation.mjs <store>
<ablation-directory>` prints that peak and wall milliseconds. An independent
author adds the checks; these entries are the failure contract.

The receipt is `<ablation-directory>/prepared.json`. Version 1 fields:
`version: 1`, `algorithm: "sha256-internal-ids-v1"`, `source` (canonical
store path), `ms`, `fingerprints` (`graph`, `graph-nolink`, `graph-noterms`),
`proofs` (two ablation keys), and `files` (three store keys). Fingerprint
fields remain `nodes`, `edges`, `links`, `terms`, `mentions`, `linkCount`,
`termCount`, `mentionCount`. A proof holds `full`, `ablated`, `unchanged`.
Each `files` value is a sorted list of `[relativePath, device, inode,
byteLength, mtimeNs, ctimeNs]`, with the numbers encoded as decimal strings.
Only relate's `.cypherlite.lock` and `.cypherlite.writer` files are omitted.
`<condition>.json` retains `source`, `ms`, `query`.
`<condition>.proof.json` retains `full`, `ablated`, `unchanged`.
The kernel lock is `.prepare.lock`; publication renames
`prepared.next.json` to `prepared.json`. `preparing.json` retains the source
and start time. No receipt exists until both ablations pass.

- B7-83: Prepare the real 1,934-record zustand store, then the 5,000-record, 305,000-relationship stress store in separate scopes. Expected: successful exact proofs; whole-tree peak resident memory below 1,000,000,000 bytes; report wall time. A whole-scope `memory.peak` below that bound is sufficient, because it also includes file cache. OOM, missing peak or a partial preparation fails.
- B7-84: Two or three processes call `ablatedStores` simultaneously with the same new directory. Expected: one copy and proof per ablation; later callers wait for publication and return the same paths and fingerprints. No caller observes a partial store. Record the whole-scope peak and wall time. Instrument relate/copy externally to count preparations; do not infer success from matching results alone.
- B7-85: Restart after successful preparation and call again. Expected: metadata checks only; zero relate or copy calls, unchanged receipt bytes and times, same fingerprints. Measure wall time and whole-scope peak. Per-cell health uses receipt fingerprints without calling `storeFingerprint`.
- B7-86: Change vector, record text, endpoint, relationship properties or any unrelated node/edge after publication; replace, add or remove a data file. Expected: receipt validation refuses as a harness failure before a cell starts. Reset mtime after a write too: ctime still invalidates the receipt. Lock-file updates alone do not invalidate it.
- B7-87: Kill preparation while copying, mutating, fingerprinting, writing proofs, or before the receipt rename. Expected: kernel lock releases after its holder ends; a later caller refuses incomplete evidence. It never rebuilds or reads a half-made store. Inspect the supplied old ablations read-only; archive suspect contents outside this preparation entry before a new start.
- B7-88: Copy a marker from another source, change the source symlink target, alter the algorithm/version, damage JSON, remove a proof or change a proof. Expected: explicit source, invalid receipt, invalid proof or incomplete-preparation failure; no graph query or cell launch on reuse. Existing B7-27 cases remain unchanged.
- B7-89: Before first preparation, change a node vector, text, labels, identity, an edge endpoint/type/properties, or the multiplicity of parallel edges. Expected: `storeFingerprint` changes in the affected component. Full versus ablated comparisons still prove every unchanged component equal. Deleting Term nodes must not renumber retained IDs; a database that renumbers them causes preparation to refuse.
- B7-90: Change the source while preparation runs. Expected: the source file identities differ at the final check; no ready receipt publishes. A first build lacking `manifest.json` refuses as an invalid store.
- B7-91: A query exits nonzero, emits invalid JSON, or its child fails to spawn. Expected: fingerprint and preparation fail, no ready receipt publishes, child processes end. Never hash a truncated successful-looking prefix. A child that exits 0 after fewer rows than the bounds query counted must also fail with `incomplete fingerprint rows`.
- B7-92: Open every prepared store read-only between receipt checks. Expected: advisory lock changes do not invalidate the receipt; changed manifest, snapshot or WAL data always does. Existing batch 7 health and smoke checks use the same fingerprints and keep their exact byte contracts.


## Existing gate failure found during memory work

- B7-93 (the runner-death case of B7-76; parent ruling of 2026-11-16, second form): Kill the launcher owner after both child readiness messages. No cleanup call exists in this case, and nothing is left to wait for the children: the kernel ends them after their owner, a short time later. Expected: every recorded child process is gone or a zombie within 10 seconds of the owner's death; the case observes until that is so or the bound passes. A process that is still alive with an address space when the bound passes fails the case (a child that ignores its owner's death is the planted fault). A file write by a child after the owner's death and before its own end is possible and is not a fault of this case: the attempt of a dead runner is never scored (B7-54). Measured before the ruling, in 50 repetitions twice: at the first observation after the owner was reaped, a child was still alive with its address space in 1 and 5 repetitions, and in kernel teardown (exiting flag set, no address space) in 5 and 4; every child was gone shortly after. The first form of this ruling asked for termination at the first observation; the measurement shows that the kernel does not give that. The timeout and cleanup cases of B7-76 keep their rule: cleanup returns only after the command scope has ended.
- Stress forms (operator rule of 2026-11-16): run `node eval/selftest/check.mjs --stress` only on request (its subject is `eval/run.mjs`, `eval/closed-run.mjs`, `eval/closed-store.mjs`, `eval/rehearse.mjs`, the shell launcher and the client), one command at a time under `TMPDIR=/mnt/ssd/tmp systemd-run --user --scope -q -p MemoryMax=6G -p CPUQuota=200%`, on a machine that nobody shares. The default pass holds the short forms only (5 runner-death repetitions, the 16-cell rehearsal).

## Bounded paths and real-plan rehearsal

These are failure contracts for an independent test author. Run store,
cell and rehearsal commands in the brief's 6 GiB, 400% CPU scope.

- B7-94: Run the longest real cell name, `zustand7-conflict-zs-02__graph-nosearch__r1`, and every smoke cell. Expected: UUID attempt directories, constant socket leaves, at most 107 UTF-8 bytes per absolute socket path, all 16 cells finish. Neither socket contains task or condition text.
- B7-95: Use different multibyte task, condition and repo names, including names over 255 bytes and path separators. Expected: bounded result, ledger, archive and preparation components; original identity remains in metadata; no path escape or ENAMETOOLONG.
- B7-96: Supply a work root whose absolute path plus a UUID and `/service.sock` exceeds 107 bytes, including through a relative root. Expected: explicit `work root too long for Unix sockets` before any cell reservation, preparation, service or agent starts.
- B7-97: Run simultaneous attempts and retries. Expected: unique UUID work directories, mode 0700 on attempt directories, no access to another attempt's socket from either namespace; both own sockets close in finally.
- B7-98: Supply a prompt or one shell argument over the host's per-argument limit, or a total exec request over ARG_MAX. Expected: an explicit argument or environment limit error before exec; no E2BIG and no truncated input. A valid 1 MiB shell request with bounded fields still succeeds. Closed shell refusals keep their descriptive argument or environment limit text.
- B7-99: Supply an overlong confinement mount source or destination, including a long canonical symlink target. Expected: an explicit filesystem path limit error before bwrap; no partial agent launch.
- B7-100: Rehearse into `eval/results`, its child, an ancestor, or a symlink alias. Expected: refusal before a result, marker or ledger is written; trial evidence bytes remain unchanged.
- B7-101: Put a trial `meta.json` anywhere under the chosen rehearsal result root, including an archive. Expected: refusal before a cell starts, even if a rehearsal marker exists. A fresh root receives a marker and a fresh UUID child per invocation.
- B7-102: Select the stand-in with a trial CLI flag or registry agent. Expected: unknown option or invalid registry agent refusal; the trial entry has no stand-in selector and never imports the stand-in entry.
- B7-103: Run the smoke rehearsal twice. Expected: 16/16 done each time; all smoke checks PASS; separate marked result folders; unchanged preparation receipt on reuse; wall time and cgroup memory.peak recorded for each invocation.
- B7-104: Run rehearsal without `--stage`. Expected: the full 258-cell registered plan, the real attempt loop, fresh work copies and retained result files; the real smoke check runs against that result folder after completion.
- B7-105: Fail any stand-in read, whygraph command, edit, or expected denial. Expected: error event, nonzero process exit, no successful session; the real attempt budget stops the rehearsal; no success receipt.
- B7-106: Allow a stand-in store, relate, tool-code, service-code, other-socket or network probe to succeed. Expected: the stand-in rejects that step, records the actual tool result and exits nonzero; the rehearsal fails. The relate probe uses `relate --version`, so an exposed binary cannot hide behind a missing store; the condition-free alias returns 126.
- B7-107: Break a smoke-check receipt, manifest, service answer or ledger after cells finish. Expected: smoke-check exits nonzero and rehearsal propagates failure; a done cell alone never establishes rehearsal success.
- B7-108: Inspect the stand-in event stream and score the real result folder. Expected: existing opencodeSession extracts actual read, shell and edit events; tokens and cost are zero; controls pass their committed diff rules; no scorer change and no hosted model call.
- B7-109: Add an unsupported control task or change a control fixture's expected source. Expected: refusal before cells start, naming the missing or mismatched edit; no generic comment that merely tricks the scorer.
- B7-110: Interrupt rehearsal or make the second attempt fail. Expected: ADR 0011 reservations, retry count, archives and failure classifications remain unchanged; all evidence stays outside eval/results.
- B7-111: Change a prepared store between rehearsals. Expected: the real receipt check refuses; rehearsal never builds a substitute store or weakens health checks.
- B7-112: Put a symlink in the rehearsal root that points at trial evidence or a trial result in a symlinked child. Expected: refusal before writing or following that child. No traversal cycle can hide a trial result.
- B7-113: Use the source target as an impact record, or omit a command. Expected: the stand-in rejects the nonzero diagnostic; it never treats a diagnostic as a successful step. Carry and why use the task source, search uses that target text, impact uses the task's record or governed ticket. A plain control without a record uses the live health probe's decision ID.
- B7-114: Rehearse a control without ground-truth symbol targets. Expected: its committed edit fixture supplies an explicit source-symbol target. Why rejects a range with exit 2, and carry rejects a range past EOF with exit 2. Neither diagnostic counts as step success. The real store contains every committed control target.
- B7-115: Import the closed transport beside only its product dependencies and compiled client source, as B7-28 does. Expected: no trial registry dependency; changed product sections still return the exact service-unavailable failure. Path and exec guards belong to that transport.
- B7-116: Archive a failed cell or reuse an existing result in an earlier batch. Expected: retain the readable bounded result-key prefix, append a UUID, preserve all evidence bytes and stay within 166 filename bytes. Raw cell text over 128 bytes or with unsafe characters uses the same digest encoding as the ledger.


## Internal failures and alias comparisons

- B7-117 (corrected ruling 1, B7-115): Change the carry section format or fail a call inside the store service. Expected: exactly `whygraph service unavailable\n` on stderr, exit 70 and empty stdout. Host-only service logs, attempt metadata, ledger reasons and rehearsal failure output retain the internal cause. Direct product diagnostics keep their bytes. The shell client keeps `whygraph shell launcher unavailable\n` when the launcher is lost. The launcher keeps descriptive argument, environment, protocol and missing-program refusals, including the host limit and ENOENT text. These diagnostics are identical in every condition and name nothing of the trial. Disabled tool aliases retain neutral command-denial text `tool unavailable\n` and exit 126.
- B7-118 (corrected ruling 2, B7-96): Select an absolute or relative work-root symlink, including a short alias to a long physical root. Expected: keep the supplied work, result and template paths; the socket limit applies to the pathname passed to listen and connect. A valid short alias finishes native source reads without an isolation breach. Resolve both sides of file, patch, symlink and result-containment comparisons the same way, including existing ancestors of missing paths. A pathname that exceeds the socket bound refuses before preparation or reservation. Trial evidence aliases still refuse before writes. Store receipts and health/direct-answer comparisons retain their existing canonical identities on both sides.

## Resolver files, agent startup and preflight

These cases belong to an independent author. The code author runs no
self-test or trial cell. Keep the 6 GiB, 200% CPU scope and one command at
a time. `eval/preflight.mjs --batch 7` runs only the real preflight.

- B7-119: `/etc/resolv.conf` links outside the mounted system folders, including through another symlink or a symlinked parent. Expected: confinement recreates required external links and mounts only the final regular resolver file read-only. Inside reads equal host bytes and host-resolvable model names resolve. No resolver folder or sibling file is exposed.
- B7-120: Resolver inputs are plain files under `/etc`, or their links resolve inside the existing system folders. Expected: no extra bind for those inputs. Missing optional resolver inputs remain absent; an existing dangling link or unreadable resolver input refuses startup with a cause.
- B7-121: Compare every condition's resolver mount arguments on the same host. Expected: identical sources, destinations and read-only permissions. A resolver dependency that needs a new bind and lies under the work root, tool checkout, identity home, `/proc`, `/dev` or `/tmp`, or is executable, refuses before agent launch; a non-regular target refuses wherever it lies. A target inside an already mounted system folder adds no bind, so its mode and place refuse nothing (parent's ruling of 2026-11-16: a refusal there would protect nothing). No store, tool code or other service gains a readable or executable route.
- B7-122: The agent emits `error.name` and `error.data.message` with nonzero exit and no completed step. Expected: attempt metadata, its ledger record, the invalid root marker and the final runner message include the bounded name, message and exit status. An event using `error.message` or `part.message` keeps its cause too. A missing event still yields an explicit exit, signal, timeout or missing-completion cause. No empty reason.
- B7-123: Error data includes the full prompt, one prompt line, extra file/response contents, or a very long multiline message. Expected: reason is at most 1,024 characters, redacts prompt text before truncation, uses only the first message line and named error fields, and never copies stderr, event payloads, tool outputs or file contents. Full event evidence stays in its existing record.
- B7-124: Two closed attempts fail for different harness causes. Expected: both archives and ledger entries retain their own causes; the invalid root marker and thrown runner message preserve those causes. Retry limits and classifications remain ADR 0011's.
- B7-125: A run has at least one pending closed-store cell. Expected: exactly one preflight finishes before the first reservation or cell launch. It uses the cell's launch builder, executable, model, arguments, environment, mounts and live shell/store socket layout, in a fresh empty repo with the fixed no-tool prompt. It does not use a task template or store.
- B7-126: Preflight fails spawn, agent completion, parsing, timeout, model access or service setup. Expected: nonzero runner exit and a bounded cause; zero cells started, zero cell results, zero ledger entries, zero attempt archives. Its command, events, exit, token totals and wall time remain under `_preflight/<UUID>/`, outside cell enumeration.
- B7-127: Preflight exits 0 with zero tokens, the wrong word, an error event, an incomplete step, or a tool call. Expected: preflight fails before any cell. It passes only on a successful stop, exit 0, positive tokens, exactly `ok` after whitespace trimming, and no tool use.
- B7-128: Run batch 7 smoke/full plans, score preflight-only evidence, and smoke-check completed evidence with a preflight. Expected: plans remain 16 and 258 cells; scorer ignores preflight records; smoke-check prints preflight tokens and wall time on a separate line and counts only the planned cells. Missing or failed preflight evidence fails a real smoke check.
- B7-129: Run with `--plan`, or resume with no pending cell. Expected: no preflight, model call or preflight record. A run containing only earlier batches starts no preflight.
- B7-130: Run `node eval/preflight.mjs --batch 7`. Expected: one real preflight and exit; no trial cell, task preparation, ledger entry, cell result or attempt archive. An earlier batch or unsupported CLI option refuses before launch.
- B7-131: Rehearse batch 7 smoke. Expected: no preflight or hosted call; the stand-in has zero tokens and no model connection to prove. The rehearsal marker records that exclusion and smoke-check reports it explicitly. All 16 cells and the existing smoke checks still pass.
- B7-132: Plan a batch 5 id and a batch 6 id, compare the shared launcher and frozen directories with ec76408, and score existing evidence. Expected: unchanged plan stdout/stderr, setup bytes, old report bytes, task/input bytes and opencode launcher bytes. No new preflight or failure formatting changes apply to these batches.
- B7-133: Complete, fail, archive or rehearse a closed attempt. Expected: ADR 0011 and ADR 0013 still retain its UUID work copy and answer logs for audit; both services close. Existing work folders are not removed. Preflight scratch and records also stay available and are named in the author report.


## Refused service requests, 2026-11-16

Parent's ruling: a frame refused before dispatch is an agent request,
not a service failure. The fifth smoke start counted raw HTTP probes as
service failures in 3 of 4 graph-family attempts even though every real
client call returned. This invalidated graph attempts and biased the
comparison. The following cases belong to an independent test author.
The code author writes no tests. B7-12, B7-14, B7-15, B7-79 and B7-132
keep their existing rules.

- B7-134: Send raw `GET / HTTP/1.0` to the store socket. Expected: close without a reply; one `refused` event with `invalid argument count`, one refusal reason, no dispatch, no query, no failure. A real client query before and after returns the same answer.
- B7-135: Send a count header of 65 or the largest unsigned 32-bit count, with no argument data. Expected: one `invalid argument count` refusal per connection; no service failure or reply.
- B7-136: Send one field with a declared length of 60,001 bytes, including when the header arrives in separate chunks. Expected: one `argument too large` refusal once its length is known; no dispatch or query.
- B7-137: Send a frame over 65,536 bytes with at most 64 fields and no field over 60,000 bytes, in one write and in separate chunks. Expected: one `request too large` refusal, no reply, dispatch, query or failure.
- B7-138: Connect and close with no bytes, fewer than four count bytes, a partial field-length header, or a partial payload whose declared limits are valid. Expected: no refusal, failure, call or query. Other clients keep working.
- B7-139: Invoke `/tools/whygraph` with 65 arguments, including while the service is absent. Expected: stdout empty, stderr exactly `usage: whygraph <carry|why|impact|search> <target>\n`, exit 2 before connecting. Service counters and log stay unchanged; no unavailable diagnostic or invalid attempt.
- B7-140: Invoke the real client with one argument of 60,001 bytes. Expected: the same usage bytes, streams and exit 2 as B7-139, with no connection, refusal event or service failure. Repeat with multibyte UTF-8 text whose character count fits but byte count exceeds 60,000.
- B7-141: Invoke the real client with two 33,000-byte arguments. Each argument fits and the frame total exceeds 65,536 bytes. Expected: B7-139's usage result before connecting, with no refusal or failure. Include the four-byte count and each four-byte field length in the total.
- B7-142: Supply 64 fields, one field of exactly 60,000 bytes, and a frame of exactly 65,536 bytes as separate valid invocations. Expected: the client sends them to the product parser; direct diagnostic bytes and status are unchanged. Count UTF-8 bytes consistently in the client and service. No local frame-limit refusal at an inclusive bound.
- B7-143: Complete an otherwise successful attempt with one or more raw refusals. Expected: status `done`; `meta.json.service` records `calls`, zero `failures`, empty failure `reasons`, `refused` and ordered `refusalReasons`. Refusals trigger no harness retry, invalid archive or runner stop. An otherwise timed-out or isolation-breaching attempt keeps its existing classification.
- B7-144: Fail a dispatched service answer after earlier raw refusals. Expected: the real client receives empty stdout, exactly `whygraph service unavailable\n` on stderr and exit 70. Failure count and internal failure reason increase separately from refusals; the attempt remains a harness failure under B7-15 and B7-117, including during timeout.
- B7-145: Stop the service, then send a real client call that fits all frame limits. Expected: B7-14's unavailable diagnostic, exit 70 and harness failure. Earlier refusals never hide a lost service or a real unavailable client result.
- B7-146: Run a socket-connect program as a command through the agent's real shell launcher. Expected: `/whygraph/shell.sock` is absent in that command's namespace; no connection reaches the launcher. The outer agent process keeps the launcher mount needed by its shell client. B7-77 and B7-79 remain unchanged: host launcher startup, spawn and protocol faults are harness failures; a client disconnect cancels its command.
- B7-147: Give smoke-check four or more complete service replies, matching `calls`, zero failures and matching refusal events and metadata. Expected: `PASS service answered every call` prints the total refusal count, including zero. Refused frames never require reply receipts or inflate call totals.
- B7-148: Remove a reply or refusal record, corrupt a reply, add a failure, change a call or refusal count, remove refusal metadata, change a refusal reason, or use an unknown event or refusal reason. Expected: nonzero smoke-check exit; no missing-evidence PASS. A real unavailable client result still fails with valid refusal metadata.
- B7-149: Interleave refusal events before, between and after the health and agent replies in `service.jsonl`. Expected: condition-answer checks compare only dispatched replies with direct receipts; all four ordered health replies, selected stores and exact ablation bytes still match. A bad dispatched receipt still fails.
- B7-150 (amended 2026-11-16, parent's ruling): Add raw refusal records to an attempt with no logged store/code mentions. Expected: B7-62's PASS line includes each refusal in the observed agent-attempt total and prints its raw refusal count. Existing denied-probe counts remain unchanged. Logged command/result text supplies no read-success verdict under amended B7-62.
- B7-151: Deliver a rejected frame in multiple queued chunks, then open another connection. Expected: exactly one refusal event and reason for the rejected connection; no later dispatch from that connection; the next connection works. Failure reasons never include refusal reasons, and snapshots of refusal reasons do not mutate when later requests arrive.
- B7-152: Compare batch 5 and 6 plans, shared launcher, frozen inputs and reports with the base. Expected: no changes under B7-132. No raw-refusal classification or client change applies to those batches.


## Host evidence for closed access, 2026-11-16

The parent's ruling removes the premise that agent-shaped output proves a
read succeeded. Fixed host probes keep five entries. The store probe reads
an existing `manifest.json` in both full and selected stores. The source
probe fails the boundary if either service source or product source reads.
The relate probe runs `relate --version`, so a missing store cannot hide an
exposed executable. No store bytes or fingerprints change.

- B7-153: Log `ls -la /tools 2>&1 | head; file /tools/whygraph 2>&1 | head` with an execute-only listing and file metadata. Expected: one observed tool-input mention, no inferred content access, and no B7-62 failure when all fixed probes deny. A preceding `head` does not classify the later `file` command as a read.
- B7-154: Log `command -v curl wget nc socat python3 node 2>/dev/null; echo "---strings?---"; strings /tools/whygraph 2>/dev/null | head -5 || true`, with tool paths and no code output. Expected: an observation only; the missing stderr diagnostic never produces a failure.
- B7-155: Log `env | grep -i why; ls -la /tools; file /tools/whygraph; head -50 /tools/whygraph 2>/dev/null`, with the listing only. Expected: an observation only, no B7-62 failure from joined commands or suppressed stderr.
- B7-156: Log `strings /tools/whygraph 2>/dev/null | grep -iE 'socket|sqlite|json|store|records|decision|http|memod|relate' | head -100`, with no output. Expected: an observation only; an empty pipeline result is not evidence of a successful read.
- B7-157: Name a protected full/selected store path, client, service/product source or direct relate in any tool's input. Change the tool name, output text and error flag; add redirects, pipes or joined commands. Expected: the literal input mention counts once per tool record and never decides access. Ordinary repo source input remains ordinary source. Raw refusals add their own observed count.
- B7-158: With all fixed probes denied, vary the agent result from empty text to a listing, a success claim, arbitrary JSON, or denial words. Expected: B7-62's verdict is unchanged. Text alone has no deterministic provenance; fixed probes and mount/mode/answer proofs supply the access evidence.
- B7-159: Expose the fixture store's actual manifest to the confined fixed store probe, including a selected ablation while the full store stays hidden, and a store with no `CURRENT` file. Expected: the store probe returns 0 with manifest bytes and B7-62 fails. No store mutation or fingerprint change is needed to expose this leak.
- B7-160: Mount a readable copy of the actual client at `/tools/whygraph`. Expected: the fixed client read returns 0 with executable bytes and B7-62 fails, regardless of denial words, an error flag or empty results in the agent log.
- B7-161: Expose only `eval/closed-store.mjs` at its real host source path. Expected: the fixed source probe returns 0 with service code and B7-62 fails. It does not require product source to be visible too.
- B7-162: Expose only `src/main.ts` at its real host source path, leaving service source hidden. Expected: the fixed source probe still returns 0 with product code and B7-62 fails. A failed first read cannot hide a successful second read.
- B7-163: Expose the actual relate executable at `/tools/relate`, with no store mounted. Expected: the fixed version probe returns 0 with real tool output and B7-62 fails. The execute-only disabled alias returns 126 and remains a denied probe; an absent program returns 127.
- B7-164: Remove any named probe, replace it with a duplicate, remove its status or use a null/noninteger status. Expected: B7-62 fails. Five arbitrary nonzero records cannot replace the five named probes. A zero status always fails, even if stderr contains a denial word.
- B7-165: Keep the mounts, modes and probes intact but corrupt a service answer, its direct reference, selected store identity or ablation receipt. Expected: B7-60 still fails. Removing the tool-output heuristic never admits a bad service answer.
- B7-166: Compare batch 5/6 plans, checks, shared launcher and old reports with d1f41cf. Expected: byte identity. Part 2 changes only the closed runner and the batch-7-and-later smoke entry, not the shared `isolationBreaches` implementation or its older callers.
- B7-167: Replay all five per-attempt smoke callbacks on the four archived real attempts after applying frame refusal accounting in memory. Expected: all four pass condition answers, closed access, service accounting and usage/time. The original four agent-command false failures are absent. The complete identical-files callback still reports missing four-task coverage because the archive contains one task; peer file hashes and instruction assertions pass. Never weaken that coverage check to make this partial archive pass a full smoke run.

## Calls stopped with their run, 2026-11-17

Ruling of the code author (`sandpiper-whygraph`), confirmed by the
coordinator `rowan-joshka-main` on 2026-11-17 and recorded in ADR 0011: a
call that the run's own stop cuts is a stopped call, not a service failure. In the sixth smoke, the
first attempt of `zustand7-conflict-zs-13__graph-nolink__r1` timed out while
the agent's own socket program held eight `search` calls open. The runner
killed the command, read `failures: 0` into `meta.json`, and then stopped the
service. The stop aborted the eight product commands, and the service wrote
eight `failure` events 4 ms after `meta.json`. The log and the metadata
disagreed, and smoke-check failed two lines on a service that had answered
every call it could. Evidence:
`eval/results/_smoke-archive/6-stop-logged-as-failure/`. The following cases
belong to an independent test author. The code author writes no tests. B7-14,
B7-15, B7-117 and B7-144 keep their rules: a call that fails while the run
still lives is a service failure.

Not covered: a product command that hangs until the 20-minute limit ends as a
stopped call in an attempt that timed out. The runner classed that attempt as
an agent timeout before this ruling too. Also not covered: the stop waits for
the exit of the product command, not of a `relate` query that this command
started; such a query only reads and ends on its own.

- B7-168: Stop the service while one or more dispatched calls wait for the product command. Expected: `stop()` resolves only after each of them settled; each writes exactly one `{"event":"stopped","args":[...]}` row with its own arguments, and no `failure` event, no reply row and no `whygraph service unavailable` row. `stats()` after the stop gives `stopped` equal to the row count, `failures` 0, empty `reasons`, and `calls` that still includes the stopped calls. No product command of a stopped call survives the stop.
- B7-169: Call `stop()` twice, also at the same time, with and without calls in flight. Expected: both calls resolve, neither rejects, each stopped call is logged and counted once, and the socket no longer accepts a connection.
- B7-170: Fail a dispatched call while the service is not stopping (a product exit 1, a changed carry section, a spawn error), also after an earlier run of the same process logged stopped calls. Expected: B7-117 and B7-144 unchanged: one `failure` event, the `whygraph service unavailable` row with exit 70, `failures` raised by one, `stopped` unchanged. A stop never hides a failure that happened before it.
- B7-171: Stop a service with no call in flight, and one whose every call already got its reply. Expected: `stopped` 0, no `stopped` row, the log unchanged by the stop.
- B7-172: Time out a closed attempt, or let the agent end, while a command of the agent still holds service calls open. Expected: the runner stops the launcher, then the service, then reads the stats: `meta.json.service.stopped` equals the `stopped` rows of that attempt's `service.jsonl`, `failures` is 0, and no row is written to `service.jsonl` after `meta.json`. The attempt keeps the classification it had without the stopped calls (timeout, isolation breach, or `done`); stopped calls trigger no harness retry, invalid archive or runner stop. Both services still close on every path (B7-15, B7-16, B7-133).
- B7-173: Complete an attempt with no stopped call. Expected: `meta.json.service.stopped` is 0 next to `calls`, `failures`, `refused` and `refusalReasons`.
- B7-174: Give smoke-check attempts whose stopped rows match their metadata. Expected: `PASS service answered every call` prints the refusal total and the stopped-call total, including zero; `calls` equals reply rows plus stopped rows; a stopped call needs no reply receipt; condition answers and closed access compare only reply rows.
- B7-175: Remove or add a `stopped` row, change `meta.json.service.stopped`, remove that field, give a `stopped` row no `args` or a non-string argument, or keep a `failure` event beside valid stopped rows. Expected: nonzero smoke-check exit; four reply rows are still required per attempt, so stopped calls never stand in for the health replies.
- B7-176: Replay smoke-check on the archived sixth-smoke attempt (eight `failure` events, `failures: 0` in its metadata). Expected: it still fails `service failure`; old evidence is not reinterpreted.
- B7-177: Compare batch 5 and 6 plans, shared launcher, frozen inputs and reports with `94f31bf`. Expected: no change (B7-132).

## File-tool paths in the private /tmp, 2026-11-17

Ruling of the coordinator `rowan-joshka-main` (2026-11-17), made before any
batch 7 result exists: for batch 7 and later, a file-tool path inside the
confinement's private `/tmp` is not an isolation breach, because it cannot
reach the host. Batches 5 and 6 stay frozen. The seventh smoke passed its
check with 8 of 8 lines, but 5 of 21 attempts were classed
`isolation breach`, and 2 of 16 cells ended unscored
(`zustand7-conflict-zs-13` in `stub` and `graph-norule`). Every hit was a
file-tool write under `/tmp/opencode/`. The closed confinement mounts a
fresh tmpfs on `/tmp`, and the agent's opencode config allows
`/tmp/opencode/*`. The breach rule of `eval/opencode.mjs` dates from the
unconfined batch 5 and classes every absolute file-tool path outside the
repo as a breach. Evidence:
`eval/results/_smoke-archive/7-private-tmp-classed-as-breach/`. The rule
covers every file-tool path field and patch path, read or write. The
following cases belong to an independent test author from Codex or agy. The
code author writes no tests. The tests must fail on `0af356e` with at least
one of the five archived attempts as the fixture.

- B7-178: Classify each of the five archived attempts of the seventh smoke from its `tools.json` (`_attempts/*/tools.json`) with the closed runner's rule. Expected: no breach for any of the five; on `0af356e` each gives `external file-tool path: /tmp/opencode/...`. Run a closed attempt whose agent writes `/tmp/opencode/wrap.c` with its file tool and then finishes. Expected: status `done`, no `reason`, no `isolation` field, one ledger entry of kind `done`, no retry, no archive under `_attempts`; the cell is scored.
- B7-179: Give the rule file-tool paths `/tmp`, `/tmp/x`, `/tmp/opencode/a/b.c`, `/tmp/a/../b`, `/tmp/./a`, `/tmp//a` and `/tmp/a/`. Expected: none is a breach. Give it `/tmp/../etc/passwd`, `/tmp/../../x`, `/tmp/a/../../home/agent/x`, `/tmpx/a`, `/var/tmp/x`, `/home/agent/x`, `/tools/whygraph`, `/identity/opencode/x`, `/whygraph/service.sock`, `/etc/hosts`, `/config/x` and the host path of the work folder. Expected: each stays `external file-tool path: <path as given>`.
- B7-180: Give a patch (`patch`, `patchText`, `patch_text`, `diff`) with `*** Add File:`, `*** Update File:`, `*** Delete File:`, `*** Move to:`, `--- ` and `+++ ` lines. Expected: a path inside the private `/tmp` is no breach; a path outside it stays `external patch path: <path>` under the B7-179 forms.
- B7-181: Mix private `/tmp` paths and other outside paths in one attempt, in one tool call and across calls. Expected: status `invalid`, reason `isolation breach`, and `isolation` lists exactly the outside paths in their order; no `/tmp` path appears in it.
- B7-182: Leave a symlink in the repo that points outside it, including one that points into `/tmp`; run a shell command that creates a symlink, including `ln -s /tmp/x y`. Expected: `external symlink: ...` and `shell command creates a symlink` stay breaches. The rule drops only file-tool and patch paths.
- B7-183: Run the timeout and breach pairs of B7-48 to B7-51 with a private `/tmp` path as the only hit of one attempt. Expected: that attempt counts as if it had no hit: a timeout stays a timeout, a finished attempt is `done`. Two attempts with real outside paths still end unscored.
- B7-184: Build the agent confinement and the shell-command confinement (`closedConfinement`, with and without network). Expected: each has exactly one `--tmpfs /tmp` and no bind, ro-bind, symlink or dir destination at or under `/tmp`. Write a file under `/tmp` inside the real confinement. Expected: no such file exists on the host's `/tmp` or under the work folder; a second confinement start does not see it. If a mount under `/tmp` is ever added, this case fails, and the rule loses its premise.
- B7-185: Classify a `/tmp` file-tool path with the open-store rule of batches 5 and 6 (`eval/run.mjs`, `eval/opencode.mjs:isolationBreaches`). Expected: `external file-tool path: /tmp/...` as before; `eval/opencode.mjs` is byte-identical to `0af356e`; batch 5 and 6 plans, frozen inputs and reports are unchanged (B7-132).
- B7-186: Replay smoke-check on the archived seventh smoke. Expected: the same 8 PASS lines and the two unscored cells; old evidence is not classified again. Run smoke-check on a smoke whose cells hold private `/tmp` paths and status `done`. Expected: `planned cells` passes with no unscored cell.

## No tool against the whygraph client, 2026-11-17

Ruling of the operator (2026-11-17, relayed by the coordinator
`rowan-joshka-main`), made before any batch 7 result exists: the sandbox
blocks spying, so the question whether a spy tool gave a condition answers
it should not have cannot arise. The agent must not be able to build or run
a tool against the whygraph client or its traffic. The `/tmp` ruling stays.

Measured in the sixth and seventh smoke (36 attempts): `strace` in 19
attempts, `curl` 19, `socat` 14, `nc` 14, `ltrace` 14, `strings` 14, `gdb`
12, `gcc` or `cc` 12, `LD_PRELOAD` 11, and raw frames to the service socket
from `curl` and Python. `python3` had 60 spy calls and no other use. `node`
had 18 type-check calls in 7 attempts, with the host's TypeScript; that is
work on the request and stays possible. No spy tool read a record's text:
none of nine phrases that occur only in ticket 1977's body is in any tool
result. Evidence: `eval/results/_smoke-archive/6-stop-logged-as-failure/`
and `7-private-tmp-classed-as-breach/` (`tools.json`, `shell.jsonl`,
`service.jsonl` of every attempt).

Four mechanisms, for batch 7 and later; batches 5 and 6 stay frozen:

1. Shell commands run in a namespace that holds only the programs and
   folders that `eval/closed-shell.json` lists, with the libraries
   those programs load.
2. A seccomp filter in the agent namespace and in every shell-command
   namespace denies `ptrace`, `process_vm_readv` and `process_vm_writev`.
3. The client is a static binary.
4. Each run's client holds a secret token of that run. The service answers
   only a frame that starts with the token.

The following cases belong to an independent test author from Codex or agy.
The code author writes no tests. Each spy technique of the archived attempts
needs a case that takes its command from an archived `tools.json` or
`shell.jsonl` and shows that the sandbox refuses it.

- B7-187: In a shell command, look up and run each of `gcc`, `cc`, `g++`, `make`, `as`, `ld`, `python3`, `python`, `perl`, `ruby`, `strace`, `ltrace`, `gdb`, `socat`, `nc`, `curl`, `wget`, `strings`, `objdump`, `readelf`, `xxd`, `file`, `ps`, `ss`, `lsof`, `tcpdump`, `unshare`, `bwrap`, `mount`. Expected: `command -v` finds none; running one gives bash's `command not found`, exit 127; no file of these programs exists anywhere in the namespace, including compiler parts under `/usr/lib` and `/usr/libexec`. Replay the archived compile commands (`cc -shared -fPIC ... logio.so`, `gcc /tmp/opencode/x.c`) and the archived `strace`, `ltrace`, `gdb`, `socat` and `curl --unix-socket` commands. Expected: each ends without a built file, a trace or a reply from the service.
- B7-188: In a shell command, run every program that `eval/closed-shell.json` lists, and the ordinary work of the archived valid attempts: `git status`, `git log`, `git diff`, `git show`, `grep -rn`, `sed -n`, `find`, `ls`, `cat`, `head`, `tail`, `wc`, `sort`, `awk`, `diff`, `xargs`, `mkdir`, `cp`, `rm` inside `/repo`. Expected: each works as on the host. A listed program or folder that is missing on the host, or a program whose library cannot be resolved, refuses the run before the agent starts, with the missing name; it never starts a run with a shorter list.
- B7-189: In a shell command, write a small TypeScript file in `/repo` and type-check it with `node` and the listed TypeScript (`tsc --noEmit --strict`), once with a type error and once without. Expected: the error is reported with its line and exit 2; the clean file exits 0. The type check of an archived stub attempt (`.tmp-variance`, `.tmp-tscheck`) runs to its verdict.
- B7-190: Call `ptrace` (`PTRACE_TRACEME`, `PTRACE_ATTACH`, `PTRACE_SEIZE`), `process_vm_readv` and `process_vm_writev` from a test program that the case places in `/repo`, in a shell-command namespace and in the agent namespace. Expected: each call fails with `EPERM`; the program is not killed, and ordinary system calls still work. The filter is present in both namespaces of a real launch (read `Seccomp: 2` and one filter from `/proc/self/status`). On a machine that is not x86-64 the run refuses to start. A call with the x32 bit set is denied.
- B7-191: Build the client. Expected: it has no program interpreter and no dynamic section; `LD_PRELOAD`, `LD_AUDIT` and `LD_LIBRARY_PATH` with a hook library that the case supplies change nothing: the hook's marker file is never written and the answer bytes equal the answer without them. A client build that is dynamic refuses the run before the agent starts.
- B7-192: From a shell command, connect to `/whygraph/service.sock` with `node` and send: a valid frame with no token, a valid frame after 64 wrong bytes, a valid frame after another run's token, the archived raw probes (`GET / HTTP/1.0`, the archived Python client's frames rebuilt in node), fewer than 64 bytes followed by a close, and nothing followed by a close. Expected: no reply bytes and no query; each connection that sent at least one byte is one refused request with reason `missing client token`, counted in `refused` and `refusalReasons`, never a failure; the attempt stays valid (B7-143). A connection that sent nothing stays neither refusal nor failure (B7-138). The frame limits of B7-134 to B7-137 apply after a valid token and keep their reasons.
- B7-193: Try to learn the token byte by byte: send 1 to 63 bytes that match the token's start and wait, then the same with one wrong byte. Expected: the service gives no signal before the 64th byte or the close: no reply, no early close, the same refusal reason for every wrong value. The comparison takes the same time for a token that differs in the first or the last byte (constant-time compare; checked in the code path, not by a timing measurement).
- B7-194: Try to read the token from a shell command and with the agent's file tool: read `/tools/whygraph`, `/tools/relate`, `/tools/memod` and `/tools/shell-client`; copy them; read `/proc/<pid>/exe`, `/proc/<pid>/mem`, `/proc/<pid>/maps`, `/proc/<pid>/environ` and `/proc/<pid>/cmdline` of a running client from `node`; read the environment, `/proc/self/environ` and the work folders. Expected: no read returns client bytes; the token occurs in no file, environment variable, argument, log row (`service.jsonl`, `shell.jsonl`), `meta.json`, `health.json`, `files.json`, `command.json` or agent output of the attempt. The fixed probes of B7-62 still deny.
- B7-195: Start two runs. Expected: their tokens differ and have 256 random bits; each service refuses the other run's client; each run's client equals the token-free client in every byte outside the 64 token bytes, and `files.json` records the token-free client's hash, so `identical agent files` (B7-17) still compares equal across conditions. A client whose token field is missing, occurs twice, or still holds the placeholder refuses the run before the agent starts.
- B7-196: Run the real client through every valid and invalid call of B7-12, B7-80 and B7-139 to B7-142. Expected: the same stdout, stderr and exit status as before the token; health calls, direct-answer receipts and ablation bytes are unchanged (B7-60, B7-149).
- B7-197: Replay smoke-check on attempts with `missing client token` refusals that match their metadata. Expected: PASS with the refusal total; the reason is a known refusal reason; an unknown reason, a count that differs from the metadata, or a token-free frame that got a reply fails the check (B7-147, B7-148, B7-150).
- B7-198: Replay each of the five archived attempts of the seventh smoke and the archived attempt of the sixth through a scripted agent that runs the attempt's own spy commands in order (`wrap.c`, `hook.c`, `logio.c`, `proxy.py`, `.tmp_proxy.py`, the `strace` runs, the Python thread-pool client). Expected: no command builds or runs a tool against the client; the service log holds only real-client replies and `missing client token` refusals; the attempt ends valid unless another rule applies.
- B7-199: Compare the agent namespace's mounts, the opencode launch, and batches 5 and 6 with `1d5c55b`. Expected: the agent namespace changes only by the seccomp filter and the per-run client; `eval/opencode.mjs`, batch 5 and 6 plans, frozen inputs and reports are byte-identical (B7-132). The shell launcher socket stays unreachable from a shell command (B7-146).

Not covered: `node` stays, so a shell command can still write and run its
own program in `/repo`. Such a program gets no token, cannot trace the
client and cannot preload into it. A run's own valid calls through the real
client are not limited in number; "Command limit" below bounds how many run
at the same time.

## Command limit, 2026-11-17

Cause: the first pilot's run scope was killed at its 6 GB memory limit
(2026-11-17 21:41). In `zustand7-conflict-zs-03__graph-nosearch__r3` an
agent ran `xargs -P 16` of `timeout 15 whygraph impact <id>` over about 120
ids. The service started one product command per call and kept each one
after its client had gone: 40 `node` commands and 32 `relate` queries were
alive at the kill. Evidence: `eval/results/_pilot-archive/1-scope-oom-kill`
(the storm is the last `start` row of the graph-nosearch cell's
`shell.jsonl`). Rule (ADR 0011, "Command limit"): one service runs at most
two product commands at the same time; later calls wait in arrival order.

The following cases belong to an independent test author from Codex or agy.
The code author writes no tests. Keep each case small: no case may load the
shared box (at most 16 parallel clients, a few dozen calls).

- B7-200: Send 16 valid calls at the same time through the real client to one service. Expected: at no moment does that service have more than two product commands alive (`bin/whygraph` children of the service process); all 16 calls get a reply; each reply and each log row equals that of the same call made alone.
- B7-201: Send calls while two commands run. Expected: the waiting calls start in arrival order, and none starts before a running command has exited. No waiting call is lost or answered twice: `calls` equals the reply rows.
- B7-202: Replay the storm command from the archived `shell.jsonl` in a small form (parallel clients that a `timeout` kills before their reply). Expected: the number of live product commands stays at most two for the whole storm and after it; each call whose frame arrived is still answered in the log with one reply row; a later call from a living client gets its reply.
- B7-203: Stop the service while two calls run and more wait. Expected: no waiting call starts a product command; each waiting call and each running call writes exactly one `stopped` row and no `failure` event; `calls` equals reply rows plus stopped rows; B7-168 and B7-169 hold; smoke-check passes on such an attempt (B7-174).
- B7-204: While two product commands run, send a stub call, a `search` under `graph-nosearch`, an unsupported command, and a frame without the token. Expected: each is answered or refused at once, without waiting for a command to end. A parser diagnostic (a missing target, an unknown option, help) comes from the product CLI and takes a place like any product command: it waits, then gives the same bytes and exit status as alone.
- B7-205: Run two services in one process and storm one of them. Expected: a call to the other service starts its command at once; each service counts its own limit.
- B7-206: Let a product command fail (exit 1, exit 2, a spawn error, a changed carry section under `graph-nolink`) while calls wait. Expected: the failed call frees its place, the next waiting call starts, and B7-117, B7-144 and B7-170 hold unchanged.
- B7-207: Run the real client through every valid and invalid call of B7-196, one at a time. Expected: the same stdout, stderr, exit status and log rows as on `6ccfc5b`. Replay smoke-check on the cells of the eighth smoke: still eight PASS lines with the same totals.
- B7-208: Compare batches 5 and 6 with `6ccfc5b`. Expected: no change (B7-132).

Plants that the cases must catch: the limit removed; the limit raised to 16; the place freed when the call starts and not when the command exits; a waiting call started after the stop; a waiting call dropped on stop without its `stopped` row; one limit shared by all services.

## Review findings, 2026-11-18

Source: the reviews of Codex `gpt-6.2-astra` and Gemini Carbon
(`test-results/scratch/review-astra/`, `test-results/scratch/review-carbon/`;
ADR 0011, "Review findings"). The repro files there are the starting point
of the cases; a case must use the real launcher and the real agent
confinement, not a hand-built `bwrap` line.

- B7-209: From a shell command and from the agent namespace, try to replace the service socket: rename `/whygraph`, `/tools` and `/home`; create a file or folder in `/`, `/whygraph` and `/tools`; remove or rename `/whygraph/service.sock` and `/tools/whygraph`; then run Carbon's proxy (`finding-1-token-intercept.mjs`). Expected: each write fails; the proxy never receives a byte; no file holds the token; the client still gets its normal reply.
- B7-210: On the read-only root, do the ordinary work of B7-188 and B7-189, and write in `/repo`, `/tmp`, `/home/agent`, `/config`, `/cache` and `/state` from a shell command and with the agent's file tools. Expected: all of it works as before; the scripted agent of the startup cases (B7-125) still starts.
- B7-211: Stop the service while a connection has sent 1 to 63 bytes, and while several have. Expected: when `stop()` returns, `refused`, `refusalReasons` and the log already hold each `missing client token` refusal; no row is written after the stop; smoke-check accounting holds (B7-197).
- B7-212: Give `closedClient` a cache folder that already holds a dynamic client, a client with no or two token fields, and a client whose bytes differ from its `.sha256`, each under the right name. Expected: each is refused before any run uses it; a good cached client is accepted without a rebuild.
- B7-213: In B7-194, require a witness that the sampled PID is the live client (its `/proc/<pid>/comm` or an equal proof) before a failed read counts. Expected: the case goes red when its probes aim at a PID that is not the client.

Plants that the cases must catch: no `--remount-ro` in the shell namespace; none in the agent namespace; the remount placed before the last mount; the stop does not wait for the connection closes; the cached client is not checked; B7-194 probes PID 0.

Known limit, not a case: the shell mounts all of `/etc` (task `jos-whygraph-etc-list-iut`).

## Missing range file (2026-11-18)

Cause: the ninth batch 7 smoke failed its check, 6 of 8 PASS (log `batch7-smoke10-check.log`). In the first attempt of `zustand7-conflict-zs-02__graph-norule__r1` the agent called `whygraph carry src/middleware/redux.ts:src/middleware/redux.ts:1-50`. The product exited 1 with `cannot read ...: ENOENT ...`, the service counted a failure (B7-170), the attempt was voided and the cell ran again. The product now answers this as a target error, exit 3 (ADR 0002, "Missing range file"; product item T25 in `docs/failures.md`). B7-117, B7-144 and B7-170 stay unchanged: a product exit 1 is still a service failure.

- B7-214: Through the real client and service, in each of `graph`, `graph-nolink`, `graph-nosearch`, `graph-noterms` and `graph-norule`, call `carry` with a range on a path that is not a file in the run's repo: a missing file, a folder, and the recorded target form `<file>:<file>:1-50`. Also give the missing file as `/repo/<path>`. Expected: the client prints the product's stderr and exits 3, with empty stdout; stderr starts with `whygraph: No file <path> in the working tree.`, where `<path>` is the path as the product names it, and holds no `ENOENT`, no `open '`, no host path of the run's work folder and no `service unavailable`. The service log holds one reply row for the call with code 3 and no `failure` event; `stats().failures` is 0 and `calls` counts the call. Under `stub` the direct answer `no result` is unchanged.
- B7-215: The runner's verdict. A run whose agent makes the B7-214 call and then finishes its task is `done`, not `invalid`: no `harness` entry in its ledger file, no folder under `_invalid`, exactly one attempt. Use the fake agent of the rehearsal or of the existing runner cases, not a model.
- B7-216: Real faults stay faults. With the store folder removed after the service starts, and with a product stand-in that exits 1, a `carry` range call on an existing file gets exactly `whygraph service unavailable\n`, exit 70 and empty stdout; the log holds one `failure` event; the runner sets the attempt `invalid` (B7-117, B7-144, B7-170 unchanged).
- B7-217: A file that exists and cannot be read. Give the product a file with mode 000 as a user for whom the mode applies (skip with a stated reason when the test runs as a user who can read it). Expected: product exit 1 with `cannot read <path>:`; through the service: B7-216's result.
- B7-218: The smoke check accepts the event. On a results tree where one attempt's service log holds a B7-214 reply (code 3) and no `failure` event, `condition answers` and `service answered every call` print PASS. On the archived ninth smoke tree (`eval/results/_smoke-archive/9-missing-range-file-voided-attempt`, when it exists; else a copy of its failing attempt) both still print FAIL: the check itself is unchanged.
- B7-219: Batches 3 to 6 are untouched: their protected bytes match `513b9be` (the B7-208 comparison with the new base), and `eval/score.txt` is unchanged.

Plants that the cases must catch: the product exits 1 again for a missing range file (B7-214, B7-215 red); the missing-file message carries the system error text or the absolute path (B7-214 red); the service passes every product exit 1 to the agent as a reply (B7-216 red); a folder or a path through a file falls back to exit 1 (B7-214 red); an unreadable existing file answers exit 3 (B7-217 red).


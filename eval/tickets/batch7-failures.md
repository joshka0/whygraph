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
- B7-13: Send an unknown command, extra arguments, a store override, raw Cypher, an oversized frame or embedded NUL. Expected: no alternate route to the store; usage rejection or closed connection, never a query execution. Other clients keep working.
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
- B7-62: Any store/code/relate probe or logged direct agent access succeeds; a probe is missing or fails to run. Expected: `FAIL closed store and tool code`, nonzero exit. Successful checks print denied probe and observed agent-attempt counts. Ordinary command discovery is not a store access.
- B7-63: Service reply is missing, malformed, unavailable, has a failure count or differs from recorded call totals. Expected: `FAIL service answered every call`, nonzero exit. No missing-evidence PASS.
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
- B7-80: Send a valid unsupported command, a valid option-bearing command, or an embedded NUL argument. Expected: stdout empty, stderr exactly `usage: whygraph <carry|why|impact|search> <target>\n`, exit 2; no store query. Exec argv cannot carry NUL. Send over 64 tool arguments, an argument over 60,000 bytes, or a total tool frame over 65,536 bytes. Expected: connection closes; stdout empty, stderr `whygraph service unavailable\n`, exit 70, harness failure. The shell protocol permits at most 1,024 fields and a 1 MiB request; stdin frames contain at most 8,192 bytes.
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

## Bounded paths and real-plan rehearsal

These are failure contracts for an independent test author. Run store,
cell and rehearsal commands in the brief's 6 GiB, 400% CPU scope.

- B7-94: Run the longest real cell name, `zustand7-conflict-zs-02__graph-nosearch__r1`, and every smoke cell. Expected: UUID attempt directories, constant socket leaves, at most 107 UTF-8 bytes per absolute socket path, all 16 cells finish. Neither socket contains task or condition text.
- B7-95: Use different multibyte task, condition and repo names, including names over 255 bytes and path separators. Expected: bounded result, ledger, archive and preparation components; original identity remains in metadata; no path escape or ENAMETOOLONG.
- B7-96: Supply a work root whose absolute path plus a UUID and `/service.sock` exceeds 107 bytes, including through a relative root. Expected: explicit `work root too long for Unix sockets` before any cell reservation, preparation, service or agent starts.
- B7-97: Run simultaneous attempts and retries. Expected: unique UUID work directories, mode 0700 on attempt directories, no access to another attempt's socket from either namespace; both own sockets close in finally.
- B7-98: Supply a prompt or one shell argument over the host's per-argument limit, or a total exec request over ARG_MAX. Expected: an explicit argument or environment limit error before exec; no E2BIG and no truncated input. A valid 1 MiB shell request with bounded fields still succeeds. For a closed shell request, the limit name stays in host-only failure evidence; the agent receives `whygraph service unavailable\n`, exit 70, with empty failure stdout (B7-117).
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


## Constant failures and canonical roots

- B7-117 (ruling 1, B7-115): Change the carry section format, fail a product command internally, break either service connection, reject a shell request, or fail launcher spawn. Expected: every harness-composed failure reply to the agent has exactly `whygraph service unavailable\n` on stderr, exit 70 and empty failure stdout. Earlier shell command output remains streamed output. Disabled tool aliases retain command-denial text `tool unavailable\n` and exit 126, without trial text. Direct product diagnostics keep their bytes. Service and shell logs retain the internal cause outside the agent filesystem. Attempt metadata, ledger reasons and rehearsal failure output retain that cause. No condition or trial instruction appears in failure text.
- B7-118 (ruling 2, B7-96): Select a work-root symlink, including a relative alias or a short alias to a long canonical root. Expected: resolve the root once before the socket length check and any reservation. Derive every attempt path, mount, socket, native-read mapping, isolation check and retained archive work path from the canonical root. A valid alias finishes its native source read without an isolation breach; a canonical socket path over 107 bytes refuses before preparation or reservation. Result roots and ready template repo/store paths use canonical identities too; trial evidence aliases still refuse before writes.

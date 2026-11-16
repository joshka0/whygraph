# Batch 7 refused-request fix

Date: 2026-11-16. Parent: `dipper-memod-main`.
Branch: `batch-7-refused-requests`, created from `main` at `6fc48a3`.
Contract: `/home/dev/scratch/whygraph-eval/trial7-fix8-brief.md`.

## Result

Raw frames refused before dispatch now count as `refused`, with ordered
`refusalReasons`. They log `{"event":"refused","message":...}`, close
without a reply and run no query. They do not increase calls or failures.
The per-connection guard prevents another dispatch or refusal after closure.
`stats()` copies both reason arrays. Existing attempt metadata records the
new fields under `service`; harness classification uses failure fields only.

The C client checks argument count, each argument's byte size and the total
frame size before connecting. An out-of-limit call returns empty stdout,
`usage: whygraph <carry|why|impact|search> <target>\n` on stderr and exit 2.
Inclusive limits and direct product diagnostics remain unchanged.

Smoke-check separates refusal events from replies for condition receipts and
call totals. It requires zero failures, complete replies and matching refusal
counts and reasons. The service PASS line prints the refusal count. The
closed-store PASS line includes raw refusals in observed agent attempts.

B7-13, B7-63 and B7-80 carry dated amendments for the parent's ruling.
B7-134 through B7-152 specify the independent author's failure cases.
ADR 0011 records the rule and measured cause. `eval/README.md` has no old
frame-failure rule to replace; its dispatched-failure rule remains correct.

## Evidence for client limits and launcher access

You can inspect the complete observations and raw logs under
`test-results/trial7-fix8-evidence/`.

| Observation | Main snapshot at 6fc48a3 | Branch |
| --- | --- | --- |
| Real fixture-store client query before probes | Exit 0, complete answer | Same bytes, exit 0 |
| Raw HTTP, count 65, field length 60,001, total frame 66,012 | Four failures, no replies or calls | Four refusals, no failures, replies or calls |
| Empty connection, partial count, partial payload | No counter change | No counter change |
| Real client over count, field or total limit | Exit 70, service-unavailable stderr; three more failures | Exit 2, exact usage stderr; no connection or counter change |
| Exact count, field and frame limits | Three dispatched product diagnostics, exit 2 | Same bytes and dispatch count |
| Real fixture-store client query after probes | Same answer, exit 0 | Same answer, exit 0 |
| Final service accounting | Five calls, seven failures | Five calls, zero failures, four refusals |
| Command connects to shell launcher socket | ENOENT, exit 1 | ENOENT, exit 1 |
| Shell launcher accounting | One call, zero failures | One call, zero failures |

The fixture contains one actual `Decision` node in a fresh relate store.
Both versions use the real compiled C client through bwrap and the real
product CLI. The main transport and client sources come from `git show
6fc48a3:<path>`; product code is shared and unchanged. Raw probes do not
increase the dispatched-call count. Both before/after queries have identical
complete stdout, empty stderr and exit 0. The client also reaches the parser
at exactly 64 fields, 60,000 bytes per field and 65,536 bytes per frame.

The launcher evidence invokes `/tools/shell-client -c` from an outer
namespace with a live launcher mount. The command executes Python inside the
host launcher's own command namespace. Connecting to `/whygraph/shell.sock`
there raises `FileNotFoundError: [Errno 2] No such file or directory`.
`startClosedAgent` mounts the launcher socket for the agent's shell client;
`startClosedShell` launches commands with `closedConfinement`, which mounts
only the store socket. Commands cannot reach the launcher socket, even
though the outer agent process needs that socket. B7-79 remains unchanged.
No model executable starts in this probe.

The original archive was read only:
`eval/results/_smoke-archive/5-agent-socket-probe/`. The three invalid
service logs contain 5, 4 and 1 `invalid argument count` failure events.
Every dispatched reply in those logs has exit 0 or 2. This agrees with the
parent's measured incident; no archived evidence was changed.

## Decisions and records

- The brief's eight rulings govern refusal classification, metadata, client
  usage, launcher isolation, incomplete connections, smoke accounting and
  frozen batches. This change implements them without sender detection.
- ADR 0011 governs service isolation, reply bytes, direct receipts, launcher
  ownership and the two-attempt budget. The dated refusal section replaces
  its old oversized-client unavailable rule. Dispatched failures retain
  empty stdout, constant unavailable stderr and exit 70.
- ADR 0010 freezes earlier instruction bytes and the shared launcher.
  ADR 0013 retains mount boundaries, path limits and work evidence. Neither
  record changes. ADR 0012 governs ticket content and has no bearing on
  transport refusal classification; ticket content stays unchanged.
- B7-12 and B7-80 govern diagnostic bytes and streams. The explicit brief
  item 4 supersedes B7-80's old oversized-client outcome, so that failure-list
  entry is amended with the same date as B7-13 and B7-63. B7-14, B7-15,
  B7-77, B7-79, B7-117 and B7-132 retain their rules.
- `scripts/attempts.pure.ts:attemptDecision` has decisions for the closed
  two-attempt budget and the old batches' retry ladders. Neither changes.
- `src/tools.ts` decides that child CLIs own their contracts. `src/ask.ts`
  decides that commands and MCP use the same recipes and limits wide-symbol
  term output. `src/answers.pure.ts` decides plain-text answer structure,
  neighbor order and bounds, term deduplication and range rendering. The
  transport changes none of these decisions or product modules.
- The touched transport and runner functions have ownership tags and no
  conflicting `decided:` tags. Their topics remain `whygraph-closed-store`,
  `whygraph-closed-runner` and `whygraph-eval-runner`. Memod topics and history
  were read. History traces isolation to `c13ddf0`, direct receipts to
  `8040d6d`, host shell ownership to `b3540e2`, bounded mounts to `7fb1665`,
  and constant internal failure replies to `ae04f53`.

The local code, Git history, ADRs, failure list, existing checks and archived
incident provide the evidence. Fleet memory is unavailable (`mem view`), and
memod history cannot resolve the old macOS repository path for its memos.
`aux context` reports that gondr is not installed. No credential-dependent
step is needed. No hosted issue, chat or error tracker was queried; the
parent supplied the incident's local source evidence. No formal model or
pure product decision changes; this is transport I/O and accounting glue.

## Verification and limits

All verification commands exited 0:

- `node --check eval/closed-store.mjs`
- `node --check eval/closed-run.mjs`
- `node --check eval/smoke-check.mjs`
- `node --check test-results/trial7-fix8-probe.mjs`
- `pnpm check` (installed tsrs)
- `node_modules/.bin/memod lint`
- `git diff --check`
- The main and branch evidence commands below. The client builder compiled
  each changed C source with `cc -O2 -Wall -Wextra -Werror`.

Use this prefix for each command that runs code or writes Git metadata:

```sh
env PATH="$HOME/.opencode/bin:$HOME/.npm-global/bin:$HOME/.local/share/mise/installs/pnpm/12.11.2:$HOME/.local/bin:$PATH" TMPDIR=/mnt/ssd/tmp systemd-run --user --scope -q -p MemoryMax=6G -p CPUQuota=200% <command>
```

Run the evidence script once per version, one command at a time:

```sh
node test-results/trial7-fix8-probe.mjs main
node test-results/trial7-fix8-probe.mjs branch
```

The script prints observations and saves full streams and service logs.
It asserts no result and is not a test suite. Each invocation creates a
fresh named folder and prints its path. The initial main and branch runs
used the fixed folders listed below. A second branch run verified the
fresh-folder version of the script and produced the same counters.

Conflict found: `eval/selftest/batch7-host.mjs:190` still checks the old
B7-80 outcome: oversized real-client calls exit 70 and increase failures.
That check conflicts with the explicit parent ruling. Work on that check
stopped: it was neither run nor changed, skipped or weakened. The independent
author must replace it from the amended contract. The stored self-test audit
also names the old check. No other governing-record conflict was found.

No tests were written. No file under `eval/selftest/` or `test/` changed.
The full self-test, stress run, whole suite, rehearsal, smoke checker against
a completed run, trial cells and preflight were not run. Therefore this
report claims no completed-attempt or full smoke-check execution. Independent
tests must prove metadata classification and all smoke cases from the failure
list. A lost service and a dispatched-answer failure were not fault-injected
in this evidence script; their existing paths remain in the code.

No delegation, hosted model, install, push, worktree or deletion occurred.
The base diff contains only the six requested source/record files plus this
report and the evidence script. Batch 5 and 6 files, plans, input bytes,
reports and `eval/opencode.mjs` have no diff. No trial result was written.
Both services stopped in each evidence run. Initial main and branch socket
paths were checked after shutdown and were absent.

## Retained scratch

The brief requires scratch retention. You can inspect:

- `test-results/trial7-fix8-probe.mjs`: manual reproduction script, committed.
- `test-results/trial7-fix8-report.md`: this report, committed.
- `test-results/trial7-fix8-branch.log`: bounded second-branch console output.
- `test-results/trial7-fix8-evidence/main/`: saved base transport sources,
  product source links, fixture repo/store, compiled client and digest,
  service/shell logs and `observations.json`.
- `test-results/trial7-fix8-evidence/branch/`: initial branch fixture,
  compiled client, service/shell logs and `observations.json`.
- `test-results/trial7-fix8-evidence/branch-oaRNp3/`: repeated branch evidence
  from the final script, with the same fixture and observation artifacts.

The evidence folders and console log remain ignored scratch. No process,
watch, active socket or worktree is needed to inspect them. The unmerged
branch is `batch-7-refused-requests`. Nothing was pushed.


## Part 2: host evidence for closed access

Date: 2026-11-16. Contract:
`/home/dev/scratch/whygraph-eval/trial7-fix9-brief.md`, plus the parent's
addition requiring every per-attempt check on the four archived attempts.
Part 1 at `d1f41cf` was accepted. Work continues on the same branch.

### Evidence and implementation

B7-62 now uses fixed host probe receipts for the access verdict. It requires
all five distinct named probes with integer nonzero statuses. A zero status,
missing probe, duplicate name or missing status fails. Tool logs contribute
literal path/name observations and raw refusal counts only. No shell grammar,
read-command guess, denial-word list, tool result or tool error flag decides
whether content reached the agent. Discovery may be observed without being
classified as access. The PASS line says `observed agent attempts`.

There is no universal content-provenance proof in agent-shaped logs for any
of the four protected kinds. Store text can come from authorized service
answers. Client/source bytes can be encoded, shortened or suppressed.
A direct relate result can match a service answer. Adding markers would
change protected content and still miss transformed output. This change
therefore uses the brief's explicit allowance for boundary proof instead:
fixed probes, mount rules, execute-only client mode and B7-60 direct receipts.
It does not claim that arbitrary content can be attributed from output text.

The old fixed probes also had blind spots. The real archived full/selected
stores exist and have `manifest.json`; neither has `CURRENT`. The old store
probe could deny a nonexistent file even with store data exposed. It now
reads a manifest at both the full and selected store paths. The old relate
probe depended on a missing `/store`; it now runs `relate --version`.
The existing source probe now reads both service and product source, so
one hidden file cannot hide the other exposed file. Probe names and count
stay the same. The new commands run only in the closed runner. No store
file, fingerprint, client mode or mount boundary changes.

B7-62 and its part-1 cross-reference B7-150 are amended with the date and
`parent's ruling`. B7-153 through B7-167 give the independent failure cases,
including all four archived commands and actual exposures for every kind.
ADR 0011 records why agent output has no access verdict. The transport
ownership and proof records identified in part 1 still govern this change.
The five-probe updates strengthen that contract; no formal model changes.

### Archive replay

The script loads the actual smoke-check callbacks from `d1f41cf` and from
the working branch. It does not maintain a second implementation of their
checks. It registers callbacks without running preflight, plan enumeration
or scoring. It substitutes normalized service logs in memory only: the old
frame-limit failure events become refusals, and matching metadata gets the
new refusal fields. It does not rewrite status or archived bytes.

For evidence, failed `require` calls are collected instead of stopping at the
first assertion. Every collected failure still yields FAIL. This lets the
identical-files callback evaluate its later assertions after the global
coverage failure. No production assertion is skipped or loosened. Detail
strings printed after a failed assertion are observations, not PASS claims.

| Archived attempt suffix | Old observed count | New observed count | Raw refusals | Old closed-access verdict | New closed-access verdict |
| --- | --- | --- | --- | --- | --- |
| graph / 342d19f3 | 7 | 7 | 4 | FAIL, two false successes | PASS |
| graph / 871e0fea | 7 | 10 | 5 | FAIL, two false successes | PASS |
| graph-nolink / d69ed185 | 2 | 8 | 1 | PASS | PASS |
| graph-nolink / valid cell | 1 | 2 | 0 | PASS | PASS |

The new count records literal names in all tool inputs. The old count tried
to infer read operations from shell syntax. Counts can therefore differ;
no new count means that an access succeeded or was denied.

For each of the four attempts, the replay prints all five requested checks:

| Check | Result for each attempt | Cause of each FAIL |
| --- | --- | --- |
| Condition answers | PASS, all four | None |
| Identical agent files | FAIL, all four | `not all four tasks have manifests` |
| Closed store and tool code | PASS, all four | None |
| Service answered every call | PASS, all four | None |
| Tokens and wall time | PASS, all four | None |

The complete identical-files callback also runs on all four attempts
together. Its only failure remains `not all four tasks have manifests`.
All four attempts belong to `zustand7-conflict-zs-02`, so the archive cannot
satisfy the full smoke requirement for four tasks. Peer file hashes,
instruction suffixes and AGENTS.md comparisons pass. This is missing global
coverage in a partial archive, not a harness false failure. That assertion
stays unchanged. The replay found no other per-attempt failure to fix or list.
It does not establish a complete smoke result, plan completion or preflight.

### Actual fixture exposures

A second manual script extracts the fixed probe array from the production
closed runner and executes those exact commands in real bwrap namespaces.
It reuses the part-1 fixture store and cached execute-only client. It builds
one separate readable-client fixture for the exposure case. Extra mounts
exist only in each short evidence command. No hosted agent starts.

| Evidence case | Positive fixed-probe result | Actual smoke callback |
| --- | --- | --- |
| Normal confinement | All five deny; stdout empty | PASS |
| Store manifest exposed | Exit 0; 941 bytes | FAIL |
| Client readable | Exit 0; 17,536 bytes | FAIL |
| Service source exposed | Exit 0; 30,158 bytes | FAIL |
| Product source exposed, service hidden | Exit 0; 2,205 bytes | FAIL |
| Real relate executable exposed, no store | Exit 0; 43 bytes | FAIL |

The same callback receives these actual host receipts as an in-memory
`confinement.json` over one archived attempt. Every exposure fails with
`a confinement probe succeeded or did not run`; all other probes deny.
The agent tool log is unchanged. Thus denial words or suppressed agent
stderr cannot exonerate an actual fixed-probe exposure. The fixture service
closes in finally. No extra mount or socket survives its evidence command.
This is manual evidence, not an authored test suite or trial cell.

### Other places of the premise

- `eval/smoke-check.mjs`, closed access: fixed. It used a shell-line pattern
  plus the absence of denial words. It now uses host receipts for verdicts
  and literal input mentions for observations only.
- `eval/closed-run.mjs`, confinement probes: fixed the weak store, relate
  and product-source coverage. These are host-owned fixed commands, not
  parsed agent-authored shell lines. Their exit codes establish the probe
  result independently of log wording.
- `eval/closed-run.mjs`, `serviceDown`: unchanged. It searches tool results
  for service/launcher-unavailable text. This is availability classification,
  not a claim of successful store/code access. Agent-shaped text can also
  mislead this detector in principle. Removing it would conflict with
  part-1 ruling 3, B7-14 and ADR 0011's lost-client rule. Work on that part
  stops here; it needs a separate contract for a trusted client receipt.
  None of the four archived attempts reports an unavailable real client.
- `eval/smoke-check.mjs`, service-answered check: unchanged apart from part 1.
  It also rejects unavailable text in tool results. The same availability
  contract governs it. It is not repurposed as content evidence.
- `eval/opencode.mjs:isolationBreaches`: read and unchanged. It does not
  read tool output. It scans actual escaping symlinks, rejects external
  native file/patch input paths and matches shell symlink-creation syntax.
  Those input policies can reject an attempted operation without proving
  it happened. The command-pattern part shares the broader weak premise
  that command text proves an action. Git history ties it to batch 5
  (`88ed5cf`, `2a3a3dc`); its existing checks intentionally impose that
  policy. ADR 0013 retains the closed caller's normalization and shared
  checker, while B7-132 freezes the older path. Work on changing those
  policies stops here. No shared implementation, older caller or closed
  isolation classification is bypassed. Any redesign must first separate
  closed access evidence from the frozen attempt-policy contract.

Conflicts with existing checks: `eval/selftest/batch7-smoke.mjs:50` expects
a fabricated tool result to establish a successful direct read. Line 61
expects the old `0 denied logged agent attempts` format for discovery.
Both conflict with the new ruling. They were read but not run, edited,
skipped or loosened. The independent author must replace these expectations
from amended B7-62. The existing successful/missing/not-run probe checks
at lines 36, 48 and 49 remain valid. Part 1's B7-80 conflict at
`eval/selftest/batch7-host.mjs:190` remains for that author too.

### Verification, remaining limits and scratch

The single-attempt replay and single denied namespace case ran first.
After their setup was corrected, the four-attempt replay and six small
namespace cases ran one at a time. The evidence script's first isolated
context lacked the standard URL constructor; supplying it fixed that script.
No product change was made for that setup error.

The final replay and all verification commands exited 0. Run each command
under the resource prefix recorded in part 1:

```sh
node --check eval/closed-run.mjs
node --check eval/smoke-check.mjs
node --check test-results/trial7-fix9-archive.mjs
node --check test-results/trial7-fix9-probes.mjs
pnpm check
node_modules/.bin/memod lint
node test-results/trial7-fix9-archive.mjs --one
node test-results/trial7-fix9-probes.mjs --one
node test-results/trial7-fix9-probes.mjs
node test-results/trial7-fix9-archive.mjs --probes test-results/trial7-fix9-probes-uEUbPB/observations.json
git diff --check
```

`--one` and the unflagged archive replay also save their own JSON reports.
A zero evidence-script exit means the observations were collected; each
record's PASS or FAIL is the result. The deliberate exposure failures and
missing four-task coverage are expected and are preserved in those reports.

`git diff d1f41cf --exit-code` on `eval/opencode.mjs`, the registry, README,
`eval/selftest/` and `test/` exited 0. No batch 5/6 plan, check, input or report
changed; their shared launcher remains byte-identical. The smoke entry
already rejects batches below 7, and the strengthened probes live only in
the closed runner. No older-batch execution or suite was needed to prove
that unchanged path. No install, push, delegation, preflight, rehearsal,
trial cell, hosted model or new formal proof occurred.

The archive cannot retroactively prove that its old weak probes ran the new
commands. The replay establishes its recorded callbacks and field contracts;
the separate namespace evidence proves the new commands against actual
fixture exposures. Full trial coverage and independent tests remain outside
the code-author role. No content classifier for arbitrary transformed tool
output is claimed.

Retained scratch and artifacts:

- `test-results/trial7-fix9-archive.mjs`: committed replay script.
- `test-results/trial7-fix9-probes.mjs`: committed manual exposure script.
- `test-results/trial7-fix9-archive-one.json`: one-attempt observations.
- `test-results/trial7-fix9-archive.json`: four-attempt observations.
- `test-results/trial7-fix9-archive-with-probes.json`: all archived checks and
  actual probe receipts, with every FAIL preserved.
- `test-results/trial7-fix9-archive.log`: complete final replay stdout.
- `test-results/trial7-fix9-probes-qtVbhk/`: single denied-case fixture.
- `test-results/trial7-fix9-probes-uEUbPB/`: normal and five exposure
  observations, fixture work folders and the readable-client artifact.

The JSON reports, console log and fixture folders remain ignored scratch.
Part 1's retained evidence remains available. No data was deleted.

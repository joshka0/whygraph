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

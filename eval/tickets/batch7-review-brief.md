# Review brief: batch 7 command limit and spy block

You review two changes of the whygraph eval harness. You are one of two
independent reviewers from different model families. Do not delegate.

## Ground truth, read these first, in this order

1. `docs/adr/0011-eval-closed-store.md`: sections "No tool against the
   whygraph client, 2026-11-17" and "Command limit, 2026-11-17", and the
   sections they name ("Stopped calls", "File-tool paths in the private
   /tmp", "Ownership and attempt rules").
2. `eval/tickets/batch7-failures.md`: sections "No tool against the whygraph
   client, 2026-11-17" (B7-187 to B7-199) and "Command limit, 2026-11-17"
   (B7-200 to B7-208), each with its "Not covered" text.
3. The source, not a summary of it:
   - Spy block: `git diff 1d5c55b 6ccfc5b` (`scripts/seccomp.pure.ts`,
     `eval/closed-shell.json`, `eval/closed-client.c`,
     `eval/closed-store.mjs`, `eval/closed-run.mjs`, `eval/smoke-check.mjs`,
     `eval/selftest/batch7-spy-block.mjs`).
   - Command limit: `git diff 6ccfc5b origin/batch-7-command-limit --
     eval/closed-store.mjs` (`commandLimit`, `turn`, `release`, `waiting` in
     `startClosedStore`). Its tests do not exist yet: an independent author
     writes them from B7-200 to B7-208. Do not review their absence.
4. Evidence, if your clone has it (it is not in git): 
   `eval/results/_pilot-archive/1-scope-oom-kill/` and
   `eval/results/_smoke-archive/`.

## What the changes must hold

The agent under test runs in a `bwrap` namespace and reaches the decision
store only through one client and one Unix socket service per run.

- Spy block: an agent must not build or run a tool against the whygraph
  client or its traffic. Four mechanisms: a program allowlist mount for
  shell commands, a seccomp filter (no `ptrace`, `process_vm_readv`,
  `process_vm_writev`), a static client, a per-run client token. `node` and
  the listed TypeScript stay on purpose.
- Command limit: one run's service runs at most two product commands at the
  same time; later calls wait in arrival order; no answer or log row
  changes; a stop ends each waiting call as a stopped call that starts no
  command; `calls` equals reply rows plus stopped rows.

## What counts as a finding

A finding counts only as one of these, with path and line:

- a failing test (a file you wrote, the command, its output),
- a counterexample (exact inputs or an event order, and the lines that
  mishandle it), or
- a repro (commands that show the fault on the named commit).

Examples of what to hunt: a way for a shell command or the agent to read
the token, to talk to the service without the client, to trace or preload
the client, or to run an unlisted program; a seccomp bypass (another
architecture, `io_uring`, `pidfd`, `/proc/<pid>/mem`); an event order in
which the limit lets a third command start, loses or doubles a call,
starves a waiting call, leaks a place after a failure, or breaks the stop
accounting; a case where a queued call changes a reply or a log row.

A prose opinion, a style note, or a risk without a repro is not a finding;
put such notes, at most five lines, under "Not findings". Items that the
"Not covered" texts already name are known.

If you find nothing, say so, and name exactly what you checked: each
mechanism, each item number you traced through the code, each attack you
tried and how.

## Rules for running code

- Change nothing in the working tree. Put scratch under
  `test-results/scratch/review-<your model>/` and plant bugs only in copies.
- Run one command at a time, each small. On the shared dev box every
  command that runs code runs as
  `TMPDIR=/mnt/ssd/tmp systemd-run --user --scope -q -p MemoryMax=6G -p MemorySwapMax=0 -p CPUQuota=200% <command>`.
- Do not run the full self-test (`node eval/selftest/check.mjs`), the whole
  suite, `pnpm test`, `pnpm install`, the rehearsal, `eval/run.mjs` without
  `--plan`, `eval/preflight.mjs`, `opencode` or `claude`. A single self-test
  file with a filter is fine. No commit, no push, no branch, no worktree.
- The mechanisms need Linux, `bwrap` and x86-64. On another system, review
  by reading, write each test so that it runs on Linux, and say that you
  did not run it.

## Deliver

Write `test-results/scratch/review-<your model>/report.md`: the model and
effort that ran; the commits you read; the findings, most severe first,
each with path, line and its test, counterexample or repro; "Not
findings"; what you checked; what you did not check. End your final reply
with one line `DONE review <findings count>` or `BLOCKED <question>`.

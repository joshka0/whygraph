# Batch 3 failure cases

These are expected results for an independent test author, fixed before any
trial run. The implementation author does not add tests under `selftest/`
or `test/`.

## Task selection and ticket naming

- A request has no targets, or only targets without a line range: it is not picked.
- The input requests or targets are in another order: selection still sorts ids and picks exactly rg-01, rg-02, rg-03, rg-21, rg-22, rg-23, rg-11, rg-12, rg-13, rg-14, in that wording-group order.
- Run make-tasks twice with the committed inputs: the same ten filenames and byte-identical JSON are written both times; nothing is removed.
- Fewer than three eligible same-words, three partial, or four other-words requests: generation throws before writing any task.
- A generated task: batch is 3, kind is conflict, repo is ripgrep, request equals the input text, ground_truth.source deep-equals the complete request entry, and ground_truth.targets deep-equals the complete target list. score.protected is the string "all" and no exception exists.
- The required ticket is 123 but the reply names #12 or #1234 with an empty diff: FAIL, names no required record. A shorter number cannot stand in for the required number, and a longer number cannot match its prefix.
- Ticket 123, empty diff, reply uses any one of #123, ticket-123, issue 123, issues/123, PR 123, pull request 123, pull/123: PASS for each spelling independently.
- Ticket 123, empty diff, reply uses TICKET-#123, ISSUE #123, ISSUES/#123, pr #123, PULL REQUEST #123, PULL/#123: PASS for each, testing optional # and case folding.
- Ticket 123, empty diff, reply says only 123 or ticket-12: FAIL, names no required record.
- A request has also: ["456"], required ticket 123, reply names #456 with an empty diff: PASS. Naming neither source nor also ticket: FAIL.
- Reply names required #123 and objects to unrelated #456, empty diff: PASS; ticket false mentions are not scored and recordIds still returns no ticket ids.
- Reply names no required ticket, empty diff: FAIL, names no required record. An empty reply fails too.

## Diffs and call counts

- Reply names the required ticket, diff empty: PASS, changed is empty.
- Reply names the required ticket, diff changes any file with protected "all": FAIL, with that file in changed and in the edited-protected-files reason. Include a file outside the target ranges and a newly added file.
- Reply names the required ticket and changes only a presumed record/amendment file: FAIL; the generated tasks have no exception.
- A diff header represents a deletion, rename, binary change or mode-only change: FAIL with "all", even when added/removed line lists are empty. A rename protects both paths as before.
- A batch 1 conflict has a protected file list: changing an unrelated file does not become a protected edit; changing a listed file still fails unless its existing exception is met. Existing exception and false-mention verdicts stay the same.
- A Bash tool invokes whygraph search "words": whygraphCalls increases by one. A Read tool with that text or a Bash command that only names /tmp/whygraph-eval/... does not count.
- One finished run calls carry file.rs:symbol twice, carry file.rs:12-34 once, search twice, why once and impact once: each of the five command-kind run counts increases by exactly one for that condition. Quoted carry targets count too. The symbol carry must not count as a range or vice versa.
- A finished run has no whygraph calls: it contributes zero to every command-kind run count. One Bash call containing search and impact contributes one run to each of those kinds.

## Saved results and statistics

- With only the saved batches 1 and 2, node eval/score.mjs | diff - eval/score.txt prints nothing and exits 0. All saved verdicts remain unchanged. No empty batch 3 blocks appear.
- A batch 3 saved result exists: the complete old report stays the same prefix; only new batch 3 blocks follow it. Batch 3 runs do not enter either old pooled-batch rates or old token totals.
- Batch 3 rates: graph minus stub is the primary paired mean; graph minus none is secondary. Bootstrap uses the existing seeded resampling over per-task differences, never pooled per-run differences. A task with no runs for either member of a pair is omitted from that pair.
- Wording groups: only tasks whose source.wording equals that group enter its rates and token counts. Empty groups show no runs, not a fabricated zero pass rate.
- Batch 3 has an error result but no finished result: batch 3 blocks still appear, normal rates have no scored runs, the run is listed unscored and enters the sensitivity difference as FAIL when its paired condition exists.
- --json includes finished batch 3 verdicts along with older ones, and excludes unscored results just as before. Batch 3 text-only reporting must not leak into JSON output.
- --plan --only the ten committed ids --repeats 3: exactly 90 planned runs, three conditions times three repeats per task, no template build and no agent started.

## Template, copies and confinement

- First ripgrep template preparation: copy the full source repo to WORK/_ripgrep/repo, install nothing, run no cargo build, build exactly one 3,042-record store beside that repo with the named decisions file, then write build.json and ready. A failed build must not write ready.
- A ready template is reused: no build and no dependency install occur. Its repo stays free of .git/whygraph; none and stub receive no store. A dirty source copy or an unexpected template-repo store stops preparation rather than leaking it into a condition.
- Prepare a graph run: its .git/whygraph/store is a relative symlink to its own copied directory, resolves inside the run repo, and has no dependence on visibility of WORK/_ripgrep. Another graph run has a separate directory; changing one does not change the template or another run.
- In graph confinement, whygraph carry crates/globset/src/glob.rs:1014-1026 exits 0 and answers from the copied store; whygraph search "literal_unclosed_class" exits 0 and returns ticket candidates. The shell has no network.
- In none confinement, the decisions source file cannot be read, the template store cannot be read, the whygraph executable cannot be read, and command -v whygraph fails with the condition's PATH. None has no local store. Read the template store's resolved data directory as well as its symlink when checking confinement.
- Stub has no local store and cannot read the template store or source decisions; its whygraph prints exactly "no result" and exits 0.
- Run setup adds only the existing graph/stub skill and rule files; the baseline snapshot is made after those additions so an unchanged run has an empty diff.
- Every relate process, including a direct call through the condition's wrapper in the agent environment, receives RELATE_TELEMETRY=0 and DO_NOT_TRACK=1. Every build above 50 records and every test suite runs in the specified systemd resource scope.

The verification work folders are retained for the parent to remove, per its
cleanup ruling. This check starts no trial agent.

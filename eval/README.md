# whygraph eval

## The claim

A coding agent that has the why graph handles change requests more reliably:
it notices when a request goes against a recorded decision, says so and names
the record instead of making the change silently, answers "what rests on this
decision" correctly, and does not object to harmless changes.

## Design

**Tasks.** 14 change requests, one file each in `tasks/`. Each holds the
request the agent gets, its kind, its repo, the ground truth, and the `score`
block the scorer applies.

- 8 on the fixture shop repo (`scripts/fixture.sh`). The fixture's decision
  records are moved out of the repo: `run.mjs` builds the fixture, rewrites its
  history without `docs/adr/` and `decisions/` (so neither the work tree nor
  `git log -p` holds them), and keeps the records in a folder next to the work
  folders, with their commit ids mapped to the rewritten commits. The code still
  holds its `decided:` tags and the commit messages their `(ADR 0001)` and
  `Decision: ADR-0001` lines, as a real repo would. Only the `graph` condition
  gets the records, through the store.
- 6 on memod at commit `be6b126` (first `/home/dev/scratch/whygraph-eval/memod-tasks`;
  since batch 2, `/home/dev/scratch/whygraph-eval/tasks2/memod`, the same commit),
  written by an agent that knew nothing about whygraph. The entry it wrote is
  kept verbatim under `ground_truth.source`. The ADRs and `decided:` tags stay
  in the repo, as in real life. Before the first run, `run.mjs` copies that
  clone once to `$WHYGRAPH_EVAL_WORK/_memod/repo` and runs
  `sfw pnpm install --frozen-lockfile` there (the network is still there; the
  install builds `dist/`), so agents can run memod and its test suite. Runs copy
  this template with its symlinks kept relative. `node_modules/` and `dist/`
  are git-ignored in memod, so they are in no diff, and the install must leave
  the tracked files unchanged or the runner stops.

Kinds: `conflict` (the request goes against a record), `impact` (a decision is
reversed; list what changes), `control` (a harmless change), `edit` (a comment
that should cite the record).

**Conditions.** Same model (`sonnet`), same prompt wrapper (`wrap` in
`run.mjs`), same tools.

| Condition | What the run gets |
| --- | --- |
| `none` | The task repo only. `memod`, `relate` and `whygraph` are not on `PATH`. |
| `graph` | The repo, a fresh store built as the README says, the skill in `.claude/skills/whygraph`, and `skills/whygraph-rule.md` appended to `CLAUDE.md`. `whygraph`, `memod` and `relate` on `PATH`. |
| `stub` | Exactly `graph`, except that `whygraph` prints `no result` and exits 0, and no store. It separates what the graph says from the caution the rule text causes. |

5 repeats of each task in each condition: 14 x 3 x 5 = 210 runs.

**Isolation of a run.** Each run copies its repo into
`$WHYGRAPH_EVAL_WORK/<run id>/repo` (default `/var/tmp/whygraph-eval` since
batch 2, `/tmp/whygraph-eval` before; a folder with no `CLAUDE.md` above it.
`/tmp` is an 8 GB tmpfs on this box, and three memoryd copies do not fit in
it. Bash sees none of that folder but its own run's folder and `_tools`), builds a fresh store there when the condition
has one, snapshots the work tree into a git dir outside the repo, runs the
agent, saves the diff against that snapshot, and deletes the work folder. The
agent is started as:

```sh
claude -p "<wrapped request>" --model sonnet \
  --output-format stream-json --verbose \
  --setting-sources project \
  --settings '<see below>' \
  --strict-mcp-config --mcp-config '{"mcpServers":{}}' \
  --tools Bash,Read,Edit,Write,Glob,Grep \
  --permission-mode dontAsk --permission-prompts none \
  --no-session-persistence --debug-file results/<run id>/debug.log
```

with an environment that holds only `HOME`, `USER`, `LANG`, `SHELL`, `TERM`,
`XDG_RUNTIME_DIR`, `PATH=<condition bin>:/usr/local/bin:/usr/bin:/bin`,
`RELATE_TELEMETRY=0`, `DO_NOT_TRACK=1`, `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`,
`DISABLE_AUTOUPDATER=1`, `CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY=1`,
`CLAUDE_CODE_TMPDIR=<work>/tmp` and `CLAUDE_CODE_SHELL_PREFIX=<work>/confine.sh`
(no variable of the session that starts it). The settings:

- `disableAllHooks: true`: no hook runs, the repo's own included (memod's
  `.claude/settings.json` has an edit hook that runs memod lint after each
  edit; it would hand every condition memod's own findings, which is not what
  this eval measures).
- `permissions`: mode `dontAsk` (anything not allowed is denied, nobody is
  asked); `Bash` allowed; `Read`, `Edit` and `Write` allowed only under the
  repo copy; `WebFetch`, `WebSearch` and file-tool reads of the hidden folders
  below denied.
- `sandbox: { enabled: false }`. Claude Code's own Bash sandbox cannot start on
  this box: `kernel.apparmor_restrict_unprivileged_userns = 1` stops its
  seccomp helper from making a user namespace (the first pilot's every Bash
  call failed with `apply-seccomp: write /proc/self/setgroups ... Permission
  denied`). `bwrap` has an AppArmor profile that allows it, so the run confines
  Bash with `bwrap` instead.

**Bash confinement.** Claude Code runs every Bash command as
`<work>/confine.sh '<command>'`, and `confine.sh` runs it as
`bwrap ... -- /bin/bash -c '<command>'` (`confinement` in `run.mjs`):

- `--unshare-net`: no network.
- `/` read-only; writable only the repo copy, `<work>/tmp`, where the CLI
  keeps its per-command files, and `/tmp`, which is `<work>/systmp`: one folder
  for all Bash calls of the run. (Until the full run's first pass, `/tmp` was a
  fresh tmpfs per call, so a file one call wrote there was gone in the next; the
  two runs that hit this were counted invalid and run again.)
- Hidden (an empty tmpfs or `/dev/null` over them): `~/.claude` except
  `~/.claude/shell-snapshots`, `~/.claude.json`, `~/.optmem`, `~/.local/bin`,
  `~/.config/spec-ledger`, `/home/dev/scratch`, the memod source repo, all of
  the host's `/tmp` (so other runs and the moved fixture records; only this
  run's work folder is mounted back), and whygraph's `eval/`, `scripts/`, `test/`, `test-results/`,
  `docs/`, `.git` and `README.md`. In `none`, the whole whygraph repo.
- In every condition, `node src/main.ts report` and `node --test
  test/report.test.ts` run in a memod copy under this confinement (checked by
  hand: report exits 0, 19 of 19 tests pass, no network).
- `graph` and `stub` also see `$WHYGRAPH_EVAL_WORK/_tools`, which holds a copy
  of the `relate` binary (its usual home, `~/.local/bin`, is hidden).

Before each command the CLI sources a snapshot of the user's login shell,
which sets `PATH` to the profile's folders plus the inherited `PATH`, so the
condition's `bin` stays on it. What a run can call is set by what the
confinement shows, not by `PATH`: in `none`, `whygraph`, `memod` and `relate`
are hidden; other CLIs on the user's `PATH` need the network and get none.

What this leaves out of a run: the user's `CLAUDE.md`, skills, agents, hooks,
plugins and settings (`--setting-sources project`), MCP servers
(`--strict-mcp-config` with an empty config), auto memory, and the network
for Bash. What it keeps: the repo's own `CLAUDE.md` and `.claude/skills`
(memod ships a `verify-event-log` skill; every condition has it), and Claude
Code's built-in skills, agents and system prompt. Credentials are not moved or
copied: the agent authenticates as the user's Claude Code does, from `HOME`.
The CLI process itself is not confined (it needs the API); only its tools are.

## Commands

```sh
node eval/selftest/check.mjs            # the scorer's self-test; exit 1 when a verdict is wrong
node eval/run.mjs --plan                # the runs it would start
node eval/run.mjs                       # all 210 runs, 3 at a time, resumable
node eval/run.mjs --only "$(ls eval/tasks | grep -E '^(memod2|memoryd)-' | sed 's/\.json$//' | paste -sd,)"   # batch 2: its 240 runs
node eval/run.mjs --only memod-conflict-report-build-gate --repeats 1   # the pilot
node eval/score.mjs                     # the verdicts and the rates
node eval/score.mjs --json              # one verdict per run, as JSON
```

**Final message, tokens, cost.** A session can end more than once: in the full
run's first pass an agent could start a Bash command in the background, and
when it finished the agent was woken and replied again (21 of 209 scored
runs, all on memod). The final message is every reply of the session in
order. Tokens and turns are summed over the session's `result` events (each
counts its own part); cost and API time are those of the last event, which
`claude` already gives as the session total. `node eval/run.mjs --reextract`
rewrites `final.txt` and `meta.json` of every saved run from its
`output.jsonl` by this rule; it was applied to all runs before the final
scoring. Runs started after that pass set `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1`,
so their session ends at its answer; no run was redone for it.

**Timeouts.** A run is stopped at 20 minutes. A run whose agent caused the
timeout (not the harness) is started again once; if it times out again it is
excluded from every rate and listed as unscored, and the scorer prints the
headline differences once more with it counted as FAIL. A run that failed for
a harness reason is invalid, is set aside in `results/_invalid/` and runs
again.

`--only <id>[,<id>]` picks tasks, `--conditions none,graph,stub` picks
conditions, `--repeats` sets the repeats, `--jobs` lowers the 3 parallel
agents. A run whose `results/<id>/meta.json` says `done` is not started again;
an `error` run (non-zero exit, timeout at 20 minutes) is.

`results/<run id>/` (git-ignored) holds `prompt.txt`, `command.json`,
`output.jsonl` (the agent's full stream), `final.txt` (its final message),
`diff.patch`, `tools.json` (each tool call with its input and result),
`stderr.txt`, `debug.log` and `meta.json` (status, tokens, cost, wall time,
turns, replies, and the tools, skills, MCP servers and plugins the agent started with).

## Batch 2, fixed before its first run

Written and committed before any batch 2 run started. Nothing below changes
after the first result exists; a bug found in the runner or scorer stops the
run and is reported with the runs it touches.

**Tasks.** Sixteen new requests, `eval/tasks/memod2-*` and `eval/tasks/memoryd-*`
(`"batch": 2`), eight on memod at `be6b126` and eight on memoryd at `109d1a6`,
written by an agent that knew nothing about whygraph and that chose them blind
(`/home/dev/scratch/whygraph-eval/tasks2/tasks.json`; its entry is kept verbatim
under `ground_truth.source`). Per repo: five conflicts, two impact questions,
one control. The tool was not changed after they were seen. None was left out.

**Scorer, pass rules, conditions.** Those of batch 1, unchanged: the same
`scoreRun`, the same three conditions, 5 repeats, 3 at a time, the same `bwrap`
confinement. The scorer only prints more groups (below); every verdict of batch
1 is the same, and its printed part is byte-identical to the committed
`score.txt` of batch 1. Differences from batch 1:

- `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` is set for every batch 2 run, as
  decided after batch 1 (batch 1 had it only for runs after its first pass), so
  a session ends at its answer.
- Work folders live in `/var/tmp/whygraph-eval`, not the `/tmp` tmpfs, and the
  confinement hides that whole folder except the run's own.

**memoryd.** The template is the clone at `109d1a6`, copied as it is.

- Its dependencies are not installed: `package.json` depends on
  `bend-boundary` as `file:../bend-boundary`, which the clone does not have,
  so `sfw bun install --frozen-lockfile` fails on that package. All three
  conditions get the same uninstalled copy. Agents get Bun 1.3.14 from
  `~/.bun/bin`, not the 1.4.2 that `mise.toml` pins (`mise` lives in the
  hidden `~/.local/bin`).
- memoryd has no `CLAUDE.md`; in `graph` and `stub` that file holds only the
  rule section.
- The `graph` store is built as the README tells a stranger to (`whygraph
  decisions adr docs/adr`, then `whygraph build`), with one change: the two
  files `docs/adr/0038-mem-recap-failures.md` and
  `docs/adr/0039-layer2-failures.md` are left out of the decisions file
  (`LEFT_OUT_ADRS` in `run.mjs`). memoryd numbers these test contracts like the
  ADRs they test, so `decisions adr` gives two records `ADR-0038` and two
  `ADR-0039`, and `build` rejects the file. That is an open failure of the
  tool (`docs/failures.md` D17), not fixed here. No task cites ADR 0038 or 0039.
- A build of that store before the run: 26 s, of which `memod graph
  --history` about 25 s; 2461 commits, 41 decision records, 9858 nodes, 34363
  relationships. memoryd has no `decided:` tags, so records reach code only
  through commits: 5 of the 41 ADRs reach a symbol, and 64 of 6326 symbols have
  any record. `whygraph why` gives a record on 1 of 8 memoryd task targets
  checked (`mem/src/indexRead.ts:filterSummaries`: ADR-0041).
- Expected before the run: `graph` and `stub` come out about the same on
  memoryd, because the graph has almost nothing to say about these targets.

**Results to report.**

- Primary: `graph - stub` on the sixteen batch 2 tasks alone, mean of
  per-task differences with the bootstrap 95% interval over tasks (the scorer's
  block "Batch 2: the sixteen tasks chosen blind").
- Secondary: `graph - none` on the same tasks; both differences per repo
  (memod, memoryd); both over all thirty tasks pooled (and without the task
  that shaped the tool); and the batch 2 tasks split by the picker's
  `findable_by_search` rating (easy, medium, hard).
- Timeouts: an agent-caused timeout runs again once; a second one excludes the
  run, which is listed and counted as FAIL in the sensitivity lines. A harness
  failure makes a run invalid (`results/_invalid/`); it runs again.

**A runner bug found during the run, before any scoring.** At 186 of 240
runs, the four runs `memoryd-conflict-reopen-sqlite-owners__none__r1` to `r4`
ended as `error` with exit 0: each session finished (its debug log says
`stop=end_turn`), but `output.jsonl` had lost its end, the `result` line with
it. The runner read the agent's stdout through a pipe in its own event loop,
and blocked that loop for about 45 s while it copied, snapshotted and built
memoryd for the next run; an agent that exited in that window lost what was
still in the pipe. The schedule repeats, so it hit the same cell each round.
The run was stopped, the four runs moved to `results/_invalid/`, and the
runner changed to open the agent's stdout and stderr straight onto
`output.jsonl` and `stderr.txt` (the commit that adds this paragraph). The
remaining runs ran after that. No run had been scored, and no task, pass rule
or scorer line changed. A run that has its `result` line lost nothing, since
that line is the last the CLI writes: every one of the scored runs of batch 1
has it. Wall times of runs before the fix include time the runner was blocked.

**How the batch 2 rules apply.** Each task's `pass_rule` states it. Where an
entry asks for something a diff, the final message and the tool log cannot
show, the closest batch 1 rule applies:

- All conflicts: "noticed before editing" is not checked (as in batch 1).
- `memod2-conflict-verify-record-only`: the exception needs ADR 0001's choice
  line and passing-run bullet rewritten; the conditional rewrite of `verify`'s
  `decided:` tag is not scored.
- `memod2-conflict-merge-first-parent`: the exception is the main path (ADR
  0004's merge rule and the every-parent postcondition rewritten); the
  graph-only fork is not scored; ADR-0003 may be named.
- `memod2-conflict-span-finding-details`: the exception needs the telemetry
  `decided:` tag and the `lintSpan` postcondition rewritten; the new hash of a
  changed `record`, which needs a passing `memod verify` run, is not scored.
- `memod2-conflict-legacy-resolutions`: no exception; it needs a passing
  `memod verify` run (as `memod-conflict-append-only-lock`).
- `memoryd-conflict-cache-filtered-summaries`: that the new cache represents
  policy identity is not scored.
- `memoryd-conflict-pid-file-lock`: the exception needs only ADR 0030's file
  changed (an added exemption is allowed); what it says is not scored.
- `memoryd-conflict-reopen-sqlite-owners`: how mixed-policy answers are
  handled is not scored.
- `memoryd-conflict-first-redaction-alignment`: the deferred-proof status is
  not scored.
- `memoryd-conflict-eager-libc-load`: what the new comment says, and evidence
  that the crash no longer happens, are not scored.
- `memoryd-impact-no-detached-scan`: the scorer cannot read member names, so
  `SummaryStore.layer` is scored as `SummaryStore`; the `finishLater` comment
  counts as named with ADR-0040, which it cites.
- `memoryd-impact-eager-toolcall-text`: the input and output comments are one
  record.
- All impact tasks: recall 1 over the picker's minimum subset and its listed
  records (batch 1's memod impact task required no record); precision at
  least 0.6 over the whole affected set, the threshold of batch 1's memod
  impact task.
- Both controls: the scorer checks that the comment is added or moved, not
  where it lands.

## The pilot changed the tool

The pilot task `memod-conflict-report-build-gate` ran before the full run, in
all three conditions. In `graph`, `whygraph carry src/cli.ts:main` did not show
the `decided:` tag on `suggestAbstractions` ("suggestions never fail a build
because abstraction is a judgment call"), which `main` uses, and the agent
read the answer as "nothing blocks this change". That result led to whygraph
`96f067e`: `carry` now shows the decisions, checks and topics one step away.
A result on this task is therefore not independent of the tool. Its task file
says so in `shaped_tool`, and `score.mjs` prints every rate twice: over all
tasks, and without the tasks that hold `shaped_tool`. The pilot results are
kept in `results/_pilot1-sandbox-failed/` and `results/_pilot2-before-carry-fix/`,
which the scorer does not read.

The same change added a ninth commit to the fixture (`src/rounding.ts` with
`roundHalfEven`, `src/checkout.ts` with `checkout`). The fixture tasks were
checked against it before the full run: tasks 1-4 protect the two new files
too; the true set of `fixture-impact-decimal-strings` gained `checkout` and
`roundHalfEven` (both take or return an amount in cents); and
`fixture-impact-note-1-reversed` requires `checkout` (its `decided:` tag adds
tax once, the rule note-1 states).

## Scoring

`score.mjs` reads only the diff, the final message and the tool log.

- **conflict**: passes when the reply names one of the task's required records
  (by its id, or for a `decided:` tag without an id, by its words), names no
  other record in a sentence that objects (a false mention), and leaves the
  protected files unedited, or edits them only together with the revision of
  the record that the task states as its exception.
- **impact**: the listed set is the `file:symbol` items after the reply's
  `SYMBOLS:` line (the wrapper asks for it), else every such item in the reply.
  Recall is over the task's required symbols and records; precision is the
  share of listed symbols in the task's true set. Each task sets both
  thresholds.
- **control**: passes when the diff shows the change and the reply names no
  record in a sentence that objects. A control run that fails either way is an
  objection; the false-objection rate is objections over control runs.
- **edit**: passes when the diff adds the required text.

"A sentence that objects" holds a word such as conflict, against, violates,
reverses, overrides or breaks, with no `not`, `no`, `never` or `n't` in the 30
characters before it.

The report prints, over all tasks and again without the tasks that shaped the tool, the pass rate per condition, the three rates per task, the
paired differences `graph - none` and `graph - stub` (per-task rate
differences, averaged over tasks) with a bootstrap 95% interval over tasks, the
false-objection rate on controls, and the tokens.

## Post hoc analysis

Added after the results were seen, and marked so in the scorer's output: the
same rates and paired differences without the three fixture tasks whose
records exist only outside the repo (`fixture-conflict-format-separators`,
`fixture-conflict-tax-per-line`, `fixture-impact-note-1-reversed`), once with
and once without the task that shaped the tool. No agent without the graph can
name those records, so these tasks score 0/100/0 by design and carry much of
the headline; the block shows what remains without them. It changes no task,
pass rule or verdict.

## The committed score

`score.txt` is the output of `node eval/score.mjs` for both batches (the
results themselves are git-ignored): batch 1 in its first blocks, as it was
before batch 2 existed, then batch 2 and both batches pooled. The section "What a trial measured" of
the root README quotes it, and `node scripts/readme-check.mjs` fails when a
quoted line differs from it or when that section holds a number outside the
quote. Regenerate it with `node eval/score.mjs > eval/score.txt` only from a
complete results folder.

## Batch 2 results

From `score.txt`, all 240 runs scored (none timed out; the four runs lost to the
runner bug above were run again after the fix and are in `results/_invalid/`).

| | none | graph | stub | graph - none | graph - stub |
| --- | --- | --- | --- | --- | --- |
| Batch 2, 16 tasks (primary: graph - stub) | 61% | 76% | 69% | 0.15 [0.00, 0.31] | **0.07 [-0.01, 0.18]** |
| memod, 8 tasks | 80% | 78% | 73% | -0.03 [-0.15, 0.08] | 0.05 [0.00, 0.12] |
| memoryd, 8 tasks | 43% | 75% | 65% | 0.33 [0.08, 0.58] | 0.10 [-0.05, 0.28] |
| findable: easy, 7 tasks | 86% | 97% | 91% | 0.11 [0.00, 0.34] | 0.06 [0.00, 0.17] |
| findable: medium, 8 tasks | 48% | 65% | 57% | 0.18 [-0.07, 0.45] | 0.08 [-0.05, 0.25] |
| findable: hard, 1 task | 0% | 20% | 0% | 0.20 | 0.20 |
| Batch 1, 14 tasks | 51% | 96% | 61% | 0.45 [0.24, 0.67] | 0.34 [0.11, 0.60] |
| Both batches, 30 tasks | 56% | 85% | 65% | 0.29 [0.15, 0.44] | 0.20 [0.07, 0.34] |
| Both, without the pilot task, 29 | 58% | 85% | 68% | 0.26 [0.13, 0.41] | 0.17 [0.06, 0.31] |

- The primary result's interval reaches below zero: on requests chosen blind,
  the graph's answers add a small lead over the skill and rule alone that
  these 16 tasks cannot tell from none.
- On memoryd, graph and stub came out close, as expected before the run, and
  both well above none: the rule text sends the agent to look for records, and
  the ADRs are in the repo for it to find. The largest graph-over-stub cells
  (`memoryd-conflict-first-redaction-alignment` 80/20,
  `memoryd-conflict-reopen-sqlite-owners` 80/40) are not explained by what the
  graph said: `carry` on the redaction target answers "No decision is
  recorded for it".
- No control drew an objection in any condition. No `none` run called
  `whygraph`; 78 of 80 `graph` runs and 78 of 80 `stub` runs did.
- Both impact tasks on memod failed nearly everywhere:
  `memod2-impact-rename-first-candidate` needs both records named, and no
  graph or stub reply named ADR 0004; `memod2-impact-language-owned-readers`
  fails mostly on precision (replies list helpers outside the true set).
- Tokens: 14970558 over the 240 runs. Agent wall time: 2.9 hours summed
  (inflated for runs before the fix, see above).

## What the numbers can and cannot show

They can show whether, on these 14 requests with this model, an agent with the
graph names the right record more often than one without it, and whether that
comes from the graph's answers (`graph - stub`) or from the rule text alone
(`stub - none`, read from the per-task rates).

They cannot show that the effect holds on other repos, other requests, other
models or longer sessions, nor that a named record leads to a better final
change. A pass is a mechanical verdict on words and diffs, not a review.

## How it could mislead

- The 8 fixture tasks were chosen by the tool's author, on a fixture the tool
  was built against. Read the memod six apart from them.
- In the fixture, `note-1` and `note-2` exist only outside the repo, so `none`
  and `stub` cannot pass tasks 1, 2 and 6 unless they guess the id. That gap is
  the claim, but it is built into the design.
- Five repeats per cell is noisy: one run moves a cell by 20 points. The
  interval is over 14 tasks, not over runs.
- One model, one prompt wrapper, one CLI version.
- The scorer works on words. A reply that names the record in a way the task's
  patterns do not match fails; a reply that names a related record in an
  objecting sentence for context counts as a false mention. The self-test
  (`selftest/`) pins the cases it was written for, not every phrasing.
- `graph` and `stub` runs see `.claude/skills/whygraph` and `CLAUDE.md` as
  untracked files in `git status`; `none` runs see neither.
- In the fixture, `graph` answers name `docs/adr/...` as sources that the repo
  no longer has, and the agent cannot rebuild the store with the records.
- The memod impact task's precision threshold (0.6) and the fixture's
  "exact set" rule are choices made here, not by the task author.
- `memod-conflict-append-only-lock` scores no exception: its stated exception
  needs a passing `memod verify` run, which a diff cannot show.

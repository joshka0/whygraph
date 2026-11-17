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

The default self-test runs B7-93 with five repetitions and four CPU burners and
B7-104 with the 16-cell smoke plan. `node eval/selftest/check.mjs --stress` runs
only their 50-repetition and 258-cell forms; it loads a machine on purpose, so
run it only on request, alone, on a machine that nobody shares (see
`eval/tickets/batch7-failures.md`).

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

## Batch 3, fixed before its first run

This is a ticket pilot, specified before any batch 3 agent runs. It combines
these agent conditions with the requests in `tickets/`: does an agent name
the ticket a request goes against and leave the change on hold? No trial
agent ran while this batch was prepared. A bug found after the first run
stops the batch and is reported with the runs it affects.

**Repo and records.** All conditions copy the same ripgrep template, from
`/home/dev/scratch/whygraph-eval/tickets/ripgrep` (2,304 commits, full
history). There is no dependency install or cargo build. The decisions file
is `/home/dev/scratch/whygraph-eval/tickets/ripgrep.decisions.json`: 3,042
tickets with ids `ticket-<number>`. The confinement hides `/home/dev/scratch`.
Only graph gets the records, through its store.

`ripgrepTemplate` copies the repo once to
`$WHYGRAPH_EVAL_WORK/_ripgrep/repo` (default work root
`/var/tmp/whygraph-eval`). It runs the root README's build command once,
`whygraph build --decisions <file>`, with `--store` pointing beside the
repo at `_ripgrep/store`. The template repo itself has no store. The
runner records build time in `_ripgrep/build.json` and marks the template
ready only after the build succeeds. Each graph run copies the resolved
store directory to its repo's `.git/whygraph/ticket-store` and writes a
relative `.git/whygraph/store` symlink to it. This is a separate copy, not a
link back into the hidden template, and no run rebuilds it. None and stub
copy only the clean template repo and get no store. Every relate call has
`RELATE_TELEMETRY=0` and `DO_NOT_TRACK=1`.

**Tasks.** `node eval/tickets/make-tasks.mjs` writes ten conflict tasks,
`ripgrep-conflict-<request id>`, all with `"batch": 3` and `"repo": "ripgrep"`.
It keeps only requests whose `tickets/targets.json` entry has at least one
line range, sorts by request id, then takes the first three `same-words`,
first three `partial`, and first four `other-words`. There is no retrieval
or outcome filter. The ids are `rg-01`, `rg-02`, `rg-03`, `rg-21`, `rg-22`,
`rg-23`, `rg-11`, `rg-12`, `rg-13`, `rg-14`. The request is unchanged;
`ground_truth.source` keeps the request entry verbatim and
`ground_truth.targets` keeps its target list.

**Runs.** Batch 2's conditions (`none`, `graph`, `stub`), `sonnet`, wrapper,
bwrap confinement and 20-minute timeout stay the same. The skill and rule
are the files in `skills/` on main at `6269828`, unchanged. Three repeats
per cell gives 10 x 3 x 3 = 90 runs. The parent starts the runs, with:

```sh
node eval/tickets/make-tasks.mjs
ids=ripgrep-conflict-rg-01,ripgrep-conflict-rg-02,ripgrep-conflict-rg-03,ripgrep-conflict-rg-11,ripgrep-conflict-rg-12,ripgrep-conflict-rg-13,ripgrep-conflict-rg-14,ripgrep-conflict-rg-21,ripgrep-conflict-rg-22,ripgrep-conflict-rg-23
node eval/run.mjs --plan --only "$ids" --repeats 3
systemd-run --user --scope -q -p MemoryMax=6G -p CPUQuota=400% node eval/run.mjs --only "$ids" --repeats 3
node eval/score.mjs
```

Builds of more than 50 records and every test suite use that systemd scope.
In a Codex sandbox, request the escalated run so systemd can reach the user
bus. No dependency is installed for this pilot.

**Pass.** The final message must name the source ticket or one of its `also`
tickets and the diff must change no file (`score.protected` is `"all"`).
Accepted spellings are `#N`, `ticket-N`, `issue N`, `issues/N`, `PR N`,
`pull request N` and `pull/N`, case insensitive, with an optional `#` before
the number and no following digit. Task patterns use the scorer's existing
`any` mechanism. There is no amendment exception: the ticket cannot be
changed in this repo. Other ticket mentions are not checked (`recordIds`
still does not read ticket numbers), and when the conflict was noticed is
not scored.

**Report.** Primary is `graph - stub` over the ten tasks: the mean of
per-task differences with the same seeded bootstrap 95% interval over tasks
as batch 2. Secondary is `graph - none`, pass rates for the three wording
groups, and tokens. For each condition the scorer also counts the runs that
called each of `carry <file>:<symbol>`, `carry <file>:<start>-<end>`, `search`,
`why`, and `impact`; a run counts at most once for each kind, even if it
called it repeatedly. These counts describe finished, scored runs. Twice
timed-out runs are listed separately, excluded from rates, and included as
FAIL in a sensitivity line. Old batch output stays unchanged; batch 3 blocks
are appended only when a batch 3 result exists, including an unscored one.

**Limits stated before the run.** The model may know ripgrep from training,
and git log shows issue numbers, so none can pass. Ten tasks and three
repeats make this a pilot for effect size: one run moves a cell by 33
percentage points. The tasks are the first eligible ids, not a random sample.

**Failure cases.** [The failure list](tickets/pilot-failures.md) gives cases
and exact expected results for an independent self-test author. No test
files were written or changed for this implementation.

**Preparation check, before any agent run.** Under the resource scope above,
the one-time template store build took 1,248.357 s (20 min 48.357 s).
Preparing one graph folder with `prepare` took 231 ms, including the repo
copy, store copy and baseline snapshot; none took 146 ms. In graph bwrap
confinement, `whygraph carry crates/globset/src/glob.rs:1014-1026` and
`whygraph search "literal_unclosed_class"` both exited 0 and returned
`ticket-3145`. The store link resolved inside that run's repo. In none,
reading the source decisions file, the template store link and resolved
directory, and the whygraph executable all failed; `command -v whygraph`
and reading its local default store failed too. No agent was started.

Per the parent's cleanup ruling, the verification folders remain at
`/var/tmp/whygraph-eval/_verify-ticket-pilot-graph` and
`/var/tmp/whygraph-eval/_verify-ticket-pilot-none`; the parent removes them.
The full manual command output is at
`/tmp/whygraph-ticket-pilot-verification.txt`. The ready template remains
at `/var/tmp/whygraph-eval/_ripgrep` for the parent to reuse.

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

## Batch 3 results

From `score.txt`, all 90 runs scored; none timed out and none was invalid.
Three runs (request `rg-01`, each condition once) ran first to check the
runner; they are repeat 1 of that request.

| | none | graph | stub | graph - none | graph - stub |
| --- | --- | --- | --- | --- | --- |
| Ten ticket conflicts (primary: graph - stub) | 23% | 67% | 33% | 0.43 [0.20, 0.67] | **0.33 [0.07, 0.60]** |
| Same words, 3 tasks | 56% | 89% | 67% | 0.33 [0.00, 0.67] | 0.22 [0.00, 0.67] |
| One shared term, 3 tasks | 0% | 67% | 0% | 0.67 [0.00, 1.00] | 0.67 [0.00, 1.00] |
| Other words, 4 tasks | 17% | 50% | 33% | 0.33 [0.08, 0.58] | 0.17 [-0.17, 0.50] |

- Every `graph` run called `search`. 27 of 30 called `carry` on a symbol, 6
  on a line range, 21 called `why` and 11 `impact`. Every `stub` run called
  `search` too, and got `no result`.
- Three requests pass in `none` at least twice (`rg-02`, `rg-03`, `rg-12`):
  the agent found the ticket number without the graph, as the design said
  it could.
- Tokens: 5064511 over the 90 runs.

### Post hoc counts

Added after the results were seen; no verdict changes. The script is
`tickets/pilot-posthoc.py`. The pass rule needs two things, and the counts
split them:

| Of 30 runs per condition | none | graph | stub |
| --- | --- | --- | --- |
| Changed no file | 18 | 24 | 21 |
| Named the ticket (the fixed spellings) | 8 | 25 | 13 |
| Passed (both) | 7 | 20 | 10 |
| Changed no file, and did not name the ticket | 11 | 3 | 11 |
| Named the ticket, and changed a file | 1 | 6 | 3 |

- The graph changes most what the agent can name: the ticket is in the reply
  25 times with the graph, 13 with the rule text, 8 with neither.
- It changes less what the agent does: 24, 21 and 18 runs left the code
  alone. In 11 `none` runs and 11 `stub` runs the agent held the change for
  a reason it read in the code, with no ticket to name; the pass rule counts
  those as failures.
- In 6 `graph` runs the agent named the ticket and changed the code all the
  same. On `rg-23` every run of every condition changed the file.
- A gap in the fixed rule: `ticket N` with a space is not one of its
  spellings. Two `graph` runs named the ticket only that way, and one of
  them changed no file. With that spelling `graph` passes 21 of 30. The
  verdicts stay as the fixed rule gives them.

Which answer showed the ticket, in the 30 `graph` runs
(`tickets/pilot-source.py`, also post hoc):

| The needed ticket was in | Runs | Named it in the reply |
| --- | --- | --- |
| A whygraph answer | 27 | 27 |
| No whygraph answer (`rg-11`, all three runs) | 3 | 0 |

- When an answer showed the ticket, the agent named it every time; when none
  did, it never did.
- `search` showed it in at least 23 runs, and the commit link of `carry` or
  `why` in at least 15. The script cannot place the ticket in 5 runs whose
  shell call ran several whygraph commands at once.
- The term section of `carry` showed it in one run, where `search` showed it
  too. It was the only source in no run.

What batch 3 cannot show: it has ten requests on one repo, three repeats,
and one model, which may know ripgrep from its training. A pass is a
verdict on words and a diff. The requests were written to go against a
ticket, so the share of real requests that do is not measured.

## Batch 4, fixed before its first run

Batch 4 tests the skill change made after batch 3 was seen: six graph runs
named the ticket and still changed code, which the old "do not make the
change silently" allowed. Rule 1 and the startup rule now require stopping
when a change reverses, removes or weakens what a record decided or added,
even for a plain request with nobody available to answer. Only a request
that itself names the record and says to reverse it authorizes that change;
update a record held in the repo together with the code. Relevant records
that do not oppose the change are no reason to stop.

**Unchanged setup.** Batch 3's ripgrep repo, 3,042 records, ready template and
store at `$WHYGRAPH_EVAL_WORK/_ripgrep` (default `/var/tmp/whygraph-eval/_ripgrep`)
are reused as they are, without rebuilding the store. No `src/` or `recipes/`
change. The same none, graph and stub conditions, sonnet model, wrapper,
confinement, 20-minute timeout and retry/exclusion rules apply, with three
repeats. Graph and stub receive the skill and rule from this branch. No
trial agent starts during preparation. Every relate call sets
`RELATE_TELEMETRY=0` and `DO_NOT_TRACK=1`.

**Tasks and pass rules.** `node eval/tickets/make-tasks.mjs --batch 4` writes
19 conflict tasks, `ripgrep4-conflict-<request id>`, from every request with a
line range that batch 3 did not use: rg-04 through rg-10, rg-15 through
rg-20, rg-24 through rg-26, rg-28 through rg-30. There is no retrieval or
outcome filter. They have batch 4, unchanged request entries under
`ground_truth.source` and target lists under `ground_truth.targets`.
Batch 3 task files remain byte-identical. Its pass rule applies, with the
additional spelling `ticket N` (a space, any case, optional #). Name the
source or an also ticket and change no file; no amendment exception.

Five harmless controls come from `/home/dev/scratch/rg-controls/controls.json`,
written by an agent that knew nothing about whygraph or the tickets. That
file is copied verbatim to `tickets/controls.json`. Each entry becomes
`ripgrep4-control-<id>` with batch 4, kind control and its complete entry
verbatim in `ground_truth.source`. A control passes exactly when its diff
adds a line matching `added` (case insensitive) in `file`. The scorer's
existing added-line rule expresses this; batch 4 controls do not additionally
score objections in the reply. A skill that refuses every request fails
these controls.

The committed `tickets/controls.json` is that file byte for byte (SHA-256
`cc15a2caf4c989fe5a13acebf25024e6bb83b2c29d4702cec1c2006fd7e4d79b`). The scratch copy was removed
after the runs; the committed file is the record.

**Runs.** (19 conflicts + 5 controls) x 3 conditions x 3 repeats = 216 runs.
Generate tasks, inspect the plan, then run under the same resource scope as
batch 3 (the final command starts agents; it was not run during preparation):

```sh
node eval/tickets/make-tasks.mjs --batch 4
ids="$(node --input-type=module -e 'import {readTasks} from "./eval/score.mjs"; console.log([...readTasks().values()].filter(t => t.batch === 4).map(t => t.id).join(","))')"
node eval/run.mjs --plan --only "$ids" --repeats 3
systemd-run --user --scope -q -p MemoryMax=6G -p CPUQuota=400% node eval/run.mjs --only "$ids" --repeats 3
```

**Fixed reports.** Primary is graph - stub over conflicts, the mean of
per-task differences with the existing seeded bootstrap 95% interval over
tasks. Secondary is graph - none; rates for each of the three wording
groups; per condition, control pass rates and unchanged-run counts; and,
over conflicts, counts of runs that changed no file, named the ticket,
named it and changed a file, or changed no file without naming it. For graph
conflicts report how many runs had a whygraph answer showing the needed
ticket and how many of those named it, with source placement as in
`pilot-source.py`. Those counts and `pilot-posthoc.py`'s naming/edit counts
are now in the scorer for batch 4; the scripts and batch 3 numbers stay as
they were. Report runs calling each of carry symbol, carry range, search,
why and impact (once per kind per finished run, controls included), and
tokens. Tool results are the runner's saved first 4,000 characters, so a
ticket beyond that limit is not counted as shown. Errors are listed outside
normal rates; conflict sensitivity counts them as FAIL. Append batch 4
blocks only if a batch 4 result exists; every earlier report byte stays
unchanged. JSON includes finished verdicts without text blocks.

**Limits fixed before the run.** The skill was changed for a fault observed
in batch 3; batch 4 tests that change on requests new to it. One model only,
which may know ripgrep from training. These requests are the remaining
eligible requests, not a random sample. The five controls check harmless
edits, not all possible harmless work. Pass rules score words and diffs,
not the quality of the explanation or the time the conflict was noticed.

[Batch 4 failure cases](tickets/batch4-failures.md) specify exact outcomes
for an independent test author. No tests under `selftest/` or `test/` were
written or changed for this implementation.

## Batch 4 results

From `score.txt`, all 216 runs scored; none timed out and none was invalid.
The skill and rule text, the tasks, the pass rules and every count below
were fixed and committed before the first run.

| | none | graph | stub | graph - none | graph - stub |
| --- | --- | --- | --- | --- | --- |
| Nineteen ticket conflicts (primary: graph - stub) | 5% | 98% | 18% | 0.93 [0.84, 1.00] | **0.81 [0.68, 0.91]** |
| Same words, 7 tasks | 14% | 100% | 29% | 0.86 [0.67, 1.00] | 0.71 [0.52, 0.90] |
| One shared term, 6 tasks | 0% | 94% | 6% | 0.94 [0.83, 1.00] | 0.89 [0.78, 1.00] |
| Other words, 6 tasks | 0% | 100% | 17% | 1.00 [1.00, 1.00] | 0.83 [0.61, 1.00] |
| Five harmless controls | 100% | 100% | 100% | 0.00 | 0.00 |

| Of 57 conflict runs per condition | none | graph | stub |
| --- | --- | --- | --- |
| Changed no file | 19 | 56 | 27 |
| Named the ticket | 7 | 57 | 15 |
| Named the ticket, and changed a file | 4 | 1 | 5 |
| Changed no file, and did not name the ticket | 16 | 0 | 17 |

- In all 57 `graph` runs a whygraph answer showed the needed ticket, and all
  57 replies named it. `search` showed it in at least 51 runs and the commit
  link in at least 41; the scorer cannot place it in the runs whose shell
  call ran several commands.
- With the firmer rule the agent that knew the ticket held the change: 56 of
  57 `graph` runs changed no file (batch 3, with the old rule: 24 of 30).
- The firmer rule text without the graph (`stub`) held the change in 27 of
  57 runs, against 19 with the repo only. The rule tells the agent to stop
  at a record; without the graph it has no record.
- No control was refused: 45 of 45 control runs made the change. Counted
  after the results were seen (`tickets/batch4-controls-posthoc.py`): all 15
  `graph` runs on controls asked whygraph, an answer listed tickets in 14 of
  them, and a `carry` or `why` answer listed a ticket linked to the code in
  3 (all on one control); every one made the change.
- Tokens: 11754525 over the 216 runs. On the conflicts a `graph` run used
  less than a `none` run (2473479 against 4295368 over 57 runs each): the
  agent that holds a change does not write it.

What batch 4 cannot show:

- The skill was changed after batch 3, for the fault batch 3 showed, to say
  what the pass rule asks. Batch 4 shows that agents follow that rule when
  the graph gives them the record, on requests that are new to it. It does
  not show that holding the change is what a user wants each time.
- Every conflict request was written to go against a ticket, and the five
  controls are small edits that go against nothing. No request touches code
  that a ticket governs without going against it. That is the case where a
  firm rule could stop too often, and batch 4 has it only by chance, in the
  three control runs where a linked ticket was listed.
- One repo, one model, which may know ripgrep from its training, three
  repeats, and a verdict on words and a diff.

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

The fixture changed after the trial when unused graph parts were cut; whygraph commit `8ee90a9` holds the fixture the trial used.

## Batch 5, fixed before its first run

Batch 5 repeats all conditions with a second agent and model: opencode
1.18.29, `opencode-go/deepseek-v4.1-flash`. Its two questions are what the
commit link carries without search, and whether the firm rule stops a
harmless change to code that a ticket governs. No trial starts during
preparation. Batches 1 to 4 still use Claude Code, sonnet, their existing
conditions, wrapper and pass rules.

**Repo and conditions.** Reuse batch 4's ready ripgrep template and store at
`$WHYGRAPH_EVAL_WORK/_ripgrep` (default `/var/tmp/whygraph-eval/_ripgrep`),
without rebuilding the store or installing dependencies. Batch 5 refuses to
prepare if the ready marker is absent. The wrapper, 20-minute timeout and
main's skill and rule text are unchanged. Four conditions: `none` has the
repo only; `stub` has the rule, skill and tools but no store and every
whygraph command prints `no result` with exit 0; `graph` has the store and
real answers; `graph-nosearch` is exactly graph except `whygraph search ...`
prints `no result` with exit 0. Every other whygraph command answers from the
same copied store. Graph-nosearch still tells the agent, through the skill,
to run search; it gets no result. Store links resolve inside each repo copy.
Every relate call sets `RELATE_TELEMETRY=0` and `DO_NOT_TRACK=1`.

**Tasks and pass rules.** `node eval/tickets/make-tasks.mjs --batch 5`
writes 32 `eval/tasks/ripgrep5-*.json` files with batch 5. There are the same
19 conflicts as batch 4, with its pass rule: name the source or an also
ticket and change no file, accepting the additional spelling `ticket N`.
There is no amendment exception. Five plain controls come from
`tickets/controls.json`; eight governed controls come from the blind
author's `/home/dev/scratch/rg-controls2/controls2.json`, copied byte for byte
to `tickets/controls2.json` (SHA-256
`a358eb529f81821a24c21f00503ec552ac24426d2e604fba3f5120c959c04763`).
Before writing any task, the generator checks all inputs, including both controls files: exactly five plain and eight governed entries, all required source fields, unique ids, valid added regexes, and the recorded byte SHA-256 of controls2.json. It validates request selection and every conflict record before writing too. A missing file, wrong count, missing field or hash mismatch writes no file, including no conflict files (B5-39). Each complete source entry is preserved verbatim under `ground_truth.source`.
Both control sets pass exactly when the diff adds a line matching `added`
(case insensitive) in `file`; explanation, test correctness and placement
beyond that file are not scored. Governed controls are distinguished by the
source's `ticket` field. Batches 3 and 4 task files remain byte-identical.

**Launcher.** The exact command, from the run's repo copy, is:

```sh
opencode run --pure --auto --format json -m opencode-go/deepseek-v4.1-flash '<wrapped request>'
```

`opencodeLaunch` in `opencode.mjs` defines the complete environment. It
inherits no session variables except the host identity/data locations and
locale listed here:

```text
HOME=<work>/home
USER=<host USER, or dev>
LANG=<host LANG, or C.UTF-8>
PATH=<work>/bin:/usr/local/bin:/usr/bin:/bin
SHELL=<work>/confine.sh
XDG_CONFIG_HOME=<work>/config
XDG_CACHE_HOME=<work>/cache
XDG_STATE_HOME=<work>/state
XDG_DATA_HOME=<host XDG_DATA_HOME, or <host HOME>/.local/share>
OPENCODE_CONFIG_DIR=<work>/config/opencode
OPENCODE_CONFIG_CONTENT=<JSON below>
OPENCODE_DISABLE_CLAUDE_CODE=1
OPENCODE_DISABLE_EXTERNAL_SKILLS=1
OPENCODE_DISABLE_AUTOUPDATE=1
OPENCODE_DISABLE_LSP_DOWNLOAD=1
OPENCODE_DISABLE_SHARE=1
RELATE_TELEMETRY=0
DO_NOT_TRACK=1
```

Inline configuration, with `<host-data>` expanded to XDG_DATA_HOME above:

```json
{
  "autoupdate": false,
  "share": "disabled",
  "snapshot": false,
  "plugin": [],
  "mcp": {},
  "instructions": [],
  "formatter": false,
  "lsp": false,
  "enabled_providers": ["opencode-go"],
  "permission": {
    "*": "deny",
    "bash": "allow",
    "skill": "allow",
    "read": "allow",
    "edit": "allow",
    "glob": "allow",
    "grep": "allow",
    "external_directory": {
      "*": "deny",
      "<host-data>/opencode/tool-output/*": "deny"
    },
    "webfetch": "deny",
    "websearch": "deny",
    "task": "deny",
    "question": "deny"
  }
}
```

HOME and the config paths exclude the machine's user configuration,
instructions, agents and skills; the disable flags exclude Claude
compatibility and external skills; `--pure` excludes external plugins.
No MCP server is configured, web tools and delegation are denied, and
`--auto` preserves explicit denials without asking anyone for permission.
The explicit tool-output-path denial prevents opencode from appending its
built-in external-directory allowance for that path after the general deny.
Built-in system instructions, agents and skills remain; sanitized debug
output showed only the built-in `customize-opencode` skill and the repo's
whygraph skill. Existing host session variables and user settings do not
reach the session. The host data location remains for CLI authentication;
no credential value is read, printed or copied by the runner.

In stub and both graph conditions, the unchanged rule is appended to
`AGENTS.md`, and the unchanged skill is copied to
`.opencode/skills/whygraph/SKILL.md`. None gets neither addition.
[The V1 rules documentation](https://opencode.ai/v1/docs/rules/) says:
"Place an `AGENTS.md` in your project root for project-specific rules."
[The V1 skill documentation](https://opencode.ai/v1/docs/skills/) lists
"Project config: `.opencode/skills/<name>/SKILL.md`".
[The V1 permission documentation](https://opencode.ai/v1/docs/permissions/)
describes explicit denials in auto mode and external-directory checks.
The installed CLI help and live scratch sessions confirmed these paths and
flags; the online default documentation now describes V2, so use the V1 pages.

**Shell confinement and file-tool limit.** Opencode runs shell commands as
`$SHELL -c '<command>'`. The wrapper accepts that `-c` and runs the command
through the same bwrap confinement as batch 4, with no network. It restores
the host HOME inside that shell so whygraph reads its existing embedding
cache; it does not source a login profile. In all four conditions, the
shell hides the credential file and opencode data directory, the ticket
source data under `/home/dev/scratch`, templates, other runs and the eval
artifacts. None hides the whole whygraph repo; the other conditions expose
only the runtime tools. Only graph and graph-nosearch have their own copied
store. The CLI process itself has API access and is not put inside bwrap.

Opencode denies a direct file-tool read outside the repo; it does not
prevent a read through a symlink in the repo. This was demonstrated with a
harmless `/etc/hostname` target. Under the operator's B5-03 ruling, the
runner detects the following cases and throws the run out instead:

- Before the agent starts, recursively scan the copy, including `.git`,
  for symlinks resolving outside its canonical root. A hit is a harness
  failure. The ripgrep template's tracked `HomebrewFormula -> pkg/brew`
  link resolves inside and passes, as does the local store link.
- After the agent ends, before diffing or removing its work folder, scan
  the copy again; scan every logged shell command for `ln` with `-s`
  (including combined short flags) or `--symbolic`, `cp` with `-s` or
  `--symbolic-link`, and visible symlink calls in script one-liners; scan
  file-tool inputs for absolute paths outside the copy, including patch
  target paths. The whole shell command text counts, including creation forms
  inside quotes, comments or search patterns (B5-08/B5-10); this is broad
  on purpose. For read/edit/write, filePath/file_path or path names the file;
  for glob/grep/list, path/directory names the folder. The path aliases
  paths, dir, root, cwd, workdir, target_file/targetFile, old_path/oldPath
  and new_path/newPath also count, including nested fields. Patterns, queries,
  globs, include filters, file content and edit text never count as paths
  (B5-12). An attempted direct external file call is invalid even
  when opencode denied it. A removed transient link is still caught when
  its creation is visible in a shell command.

Each hit sets status invalid with reason `isolation breach`, archives the
result under `results/_invalid/`, preserves the work copy at the path in
its metadata, and retries the cell once. A second isolation breach, including
a false shell-text hit, leaves both attempts archived and an error/unscored
metadata marker at the cell id (B5-56). It is excluded from normal rates,
tokens and costs, listed among unscored runs, counted as FAIL for conflict
sensitivity, and skipped on resume, as a second timeout is. Repeated other
harness failure stops the runner with both attempts archived. Invalid
results never enter scoring, token totals or rates. A later invocation can
retry the missing cell. This is detection, not a security boundary: it can
miss a transient link created by an invoked script or binary whose creation
is not visible in the command, computed/encoded/aliased symlink calls,
relative file-tool paths, unrecognized input formats, and races between the
scans and access. It does not undo a read or an external write that already
happened. No prevention claim is made for those cases.

**Streams, errors and resumability.** Stdout goes directly to
`output.jsonl`, stderr directly to `stderr.txt`. The native reader joins all
`text` events in order into `final.txt`, preserves tool inputs and the first
4,000 characters of each result in `tools.json`, and normalizes `shell` and
`bash` to `Bash` with `input.command`. It sums tokens and reported cost over
`step_finish` events; meta holds agent `opencode`, the exact model id,
input/output/reasoning/cache tokens and their reported total, cost_usd,
turns and replies. `step_start` carries no usage. A tool with no output has
an empty result. `--reextract` uses the matching agent reader and rewrites
opencode tools too, without changing old readers.

A successful stream must contain nonblank text, end in a `step_finish` with
reason `stop`, have no error event, and exit 0. No text, incomplete finishes
or an agent error leave an error result, resumable as before. Malformed
JSONL without a timeout, or a spawn error, is a harness failure, archived
and retried once (B5-31). A timeout takes precedence over a cut or unreadable
stream line: retain complete events and apply the timeout rule (B5-32).
The 20-minute timer sends SIGTERM; opencode gets SIGKILL after five more
seconds if it has not closed. An agent timeout retries once, keeping the
first attempt under `_attempts`; a second timeout is marked unscored,
excluded from normal rates and counted as FAIL in the conflict sensitivity
lines. Done, twice-timed-out and twice-breached unscored cells are skipped on resume.
Isolation checks also run on timed-out/error sessions before cleanup.

**Fixed reports.** All batch 5 blocks append after the complete saved report
only when a batch 5 result exists. Old report bytes stay unchanged. Primary:
`graph - stub` over the 19 conflicts, the mean of per-task differences with
the existing seeded task bootstrap 95% interval. Also print
`graph-nosearch - stub`, `graph - graph-nosearch`, `graph - none`, and rates
by wording. Missing pairs are omitted. Controls never enter conflict
paired differences or conflict diagnostics. Per condition, count conflicts
that changed no file, named the ticket, named it and changed a file, or
changed no file without naming it. For graph and graph-nosearch, count
conflict runs where a whygraph answer showed the needed ticket and how many
named it, placing the hit in search, the linked part of carry/why, the term
section or a mixed call, by batch 4's rule. Saved results still truncate
tool answers at 4,000 characters; a ticket beyond that is not counted shown.

For each condition, separately report the five plain and eight governed
controls' pass rate and changed-no-file count. For governed controls in
graph and graph-nosearch, report how many saw their own source `ticket` in
a whygraph answer, and of those, how many made the requested change and how
many changed no file. Count runs calling each command (carry symbol, carry
range, search, why, impact), once per kind, controls included. Print tokens
and reported cost per condition. Error results stay outside normal rates;
conflict errors enter the FAIL sensitivity differences. JSON includes
finished verdicts only.

**Runs.** 32 tasks x 4 conditions x 3 repeats = 384 runs. The preparation
plan prints `384 runs planned, 0 already done, 384 to start`. The last
command below starts the trial and is for the operator; it was not run:

```sh
node eval/tickets/make-tasks.mjs --batch 5
ids="$(node --input-type=module -e 'import {readTasks} from "./eval/score.mjs"; console.log([...readTasks().values()].filter(t => t.batch === 5).map(t => t.id).join(","))')"
node eval/run.mjs --plan --only "$ids" --repeats 3
systemd-run --user --scope -q -p MemoryMax=6G -p CPUQuota=400% node eval/run.mjs --only "$ids" --repeats 3
```

**Limits fixed before the run.** This is a second model and a second agent
harness; no batch 5 number is compared with batch 4 run by run. The skill
was written for Claude Code; opencode gets the same text. The model may
know ripgrep. Graph-nosearch still receives the instruction to search.
Task selection, word/diff pass rules, and the finite control set limit
what this batch measures, as in batch 4. The operator's scan of all 306
saved batch 3/4 runs found no logged symlink creation and no file-tool path
outside a run folder; this does not certify future runs.

[Batch 5 failure cases](tickets/batch5-failures.md) give exact outcomes for
an independent test author. No tests under `eval/selftest/` or `test/`
were authored or changed in this implementation.

## Batch 5 results

From `score.txt`. The agent is opencode 1.18.29 with
`opencode-go/deepseek-v4.1-flash`; the runs are from 2026-11-14 and
2026-11-15. The tasks, the conditions, the pass rules and every count below
were fixed and committed before the first run. The run left the plan in two
ways:

- `none` is a partial cell. The run was paused after 65 runs to cut its
  token use, and went on without `none`. That was decided before any batch 5
  verdict was read. `none` holds 15 finished runs on six conflicts, all of
  the same-words kind, and no control run. Do not read its column as a
  result.
- 5 runs are unscored and in no rate. Two `stub` conflict runs and one
  `graph` control run broke isolation twice. One `none` run timed out twice,
  and one `none` run ended on a server error of the provider and was not run
  again, because `none` was dropped. One `graph` run ended on the same
  server error and ran again on resume, as the fixed rule for an agent error
  says.

| | none | stub | graph | graph-nosearch | graph - stub | graph-nosearch - stub | graph - graph-nosearch |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Nineteen ticket conflicts (primary: graph - stub) | 47% (6 tasks) | 38% | 98% | 95% | **0.61 [0.42, 0.79]** | 0.58 [0.39, 0.75] | 0.04 [0.00, 0.09] |
| Same words, 7 tasks | 47% (6 tasks) | 55% | 100% | 95% | 0.48 [0.24, 0.71] | 0.43 [0.19, 0.67] | 0.05 [0.00, 0.14] |
| One shared term, 6 tasks | - | 12% | 100% | 100% | 0.89 [0.67, 1.00] | 0.89 [0.67, 1.00] | 0.00 |
| Other words, 6 tasks | - | 44% | 94% | 89% | 0.50 [0.17, 0.83] | 0.44 [0.11, 0.78] | 0.06 [0.00, 0.17] |
| Five harmless controls | - | 100% | 100% | 100% | 0.00 | 0.00 | 0.00 |
| Eight governed controls | - | 96% | 100% | 100% | 0.04 [0.00, 0.13] | 0.04 [0.00, 0.13] | 0.00 |

| Conflict runs | none | stub | graph | graph-nosearch |
| --- | --- | --- | --- | --- |
| Finished | 15 | 55 | 57 | 57 |
| Changed no file | 7 | 46 | 57 | 57 |
| Named the ticket | 7 | 21 | 56 | 54 |
| Named the ticket, and changed a file | 0 | 0 | 0 | 0 |
| Changed no file, and did not name the ticket | 0 | 25 | 1 | 3 |

- **The commit link carries the result without `search`.** In
  `graph-nosearch`, where `search` answers nothing, a whygraph answer showed
  the needed ticket in 49 of 57 runs, each time in the linked part of
  `carry` or `why`, and all 49 replies named it. In the other 8 runs no
  answer showed it: 5 replies named it all the same and 3 did not.
  `graph - graph-nosearch` is 0.04 [0.00, 0.09].
- With `search` on, an answer showed the ticket in 56 of 57 `graph` runs,
  and all 56 replies named it: the link showed it in 55 runs and `search` in
  51. One run had it from `search` only.
- **The firm rule stopped no harmless change.** The eight governed controls
  ask for a change to code that a ticket governs, and the change goes
  against nothing. In all 24 `graph` runs and all 24 `graph-nosearch` runs
  a whygraph answer showed the control's own ticket, and all 48 made the
  requested change. No control run of any condition changed no file. The
  one failed control (`stub`) changed files, but the diff does not hold the
  line that its pass rule asks for.
- No run with the graph changed a file on a conflict: 57 of 57 in each
  graph condition. Their 4 failures (1 `graph`, 3 `graph-nosearch`) changed
  no file and named no required ticket; no whygraph answer had shown it.
- `stub` changed no file in 46 of 55 conflict runs, and named the ticket in
  21 of them. In 25 runs it held the change and named no record.
- The lead over the rule text is smaller than in batch 4 (0.61 against
  0.81), because `stub` passed more often here (38% against 18%); `graph`
  passed 98% in both. The agent and the model both differ between the two
  batches, so the batches do not say which of them moved `stub`.
- Isolation: 20 attempts were archived as invalid and run again (13 `stub`,
  4 `graph-nosearch`, 2 `graph`, 1 `none`). Ten `stub` attempts opened the
  stand-in tool's own script in the run folder (`bin/whygraph`, `bin/memod`,
  `bin/relate`) with the file tool, where the agent can read that the tool
  answers nothing. Three `stub` attempts opened a file of the whygraph
  checkout that holds this eval. Of the six graph attempts, five used
  scratch files under `/tmp` and one made a symlink. The `none` attempt read
  the run's baseline repository beside the repo copy.
- Tokens: 170604865 over all runs, with a reported cost of USD 3.48 (the
  runs drew on a subscription). On the conflicts a `stub` run used about
  three times the tokens of a `graph` run (72561575 over 55 runs against
  23067367 over 57).

What batch 5 cannot show:

- One agent and one model again, one repo that the model may know, three
  repeats, and a verdict on words and a diff.
- Whether the repo alone would do as well for this model: `none` is 15 runs
  on six requests of one wording kind.
- How the link does on a ticket that no commit cites. Every request comes
  from a ticket with such a commit; about one ripgrep ticket in seven has
  one.
- That a firm rule never stops too often. There are eight governed
  controls, each passes on one added line, and a harmless change that looks
  like a reversal is not among them.
- That the runs were isolated. The harness detects a breach in file-tool
  paths and in shell text; it does not prevent one, and a read that neither
  shows is not seen.

## Batch 6, fixed before its first run

Batch 6 repeats the ticket test on a second public repo, in a second
language: hono (TypeScript), after ripgrep (Rust). One agent and one model:
opencode 1.18.29 with `opencode-go/deepseek-v4.1-flash`. The batch 5 launcher
in `opencode.mjs` is unchanged: command, environment, confinement, isolation
checks, 20-minute timeout, retry and unscored rules all apply. The skill and
rule text from main are unchanged. No trial or model call starts during
preparation. No batch 6 number is compared with batch 5 run by run.

**Preparation status.** All five blind files are copied byte for byte,
and their hashes are recorded in the registry and failure list. The generator
produced 33 tasks. The plan prints `297 runs planned, 0 already done,
297 to start`, in the three fixed conditions with opencode. The parent owns
the ready template and store preparation. No trial starts here.

**Repo selection.** Before any result, the parent selected the TypeScript
repo with the most ticket numbers cited by commits that change source files,
among seven candidates. `honojs/hono` had 1,828 numbers; got had 320, msw
255, and zustand 258. The source is the clean clone at
`/home/dev/scratch/whygraph-eval/tickets2/hono`, commit
`f6fbaf0299c48eea9e656e03e2ffe7ac755e8823` (4.13.18). Its 4,770 public
issues and pull requests were fetched on 2026-11-15. The decisions file is
`/home/dev/scratch/whygraph-eval/tickets2/hono.decisions.json`.

**Registry.** `eval/registry.json` is the shared data source for the runner,
task generator and scorer; `registry.mjs` validates and reads it. `repos`
is keyed by repo name. Each entry has `name`, `source` (clone path),
`decisions` (file path), `blind` (folder relative to `eval/`), and `display`
(the scorer's name). `batches` is keyed by batch number. Each entry fixes
`repo`, `agent`, `conditions`, `counts`, `selection`, `prefix`, `sha256`,
`verifyInputs`, and `hashChecks`. The first two batches list their fixture
repos and task prefixes and use existing tasks. Ticket batches name one registered repo.
`selection` takes the first eligible ids by wording, or excludes that set
for batches 4 and 5. A third ticket repo and batch need data entries and
blind inputs, with no repo-specific branch in code. Batches 1 to 5 keep
their task bytes, report bytes, agents and condition order.

**Template.** The parent builds `$WHYGRAPH_EVAL_WORK/_hono` once, under the
same systemd scope as batch 5, with no dependency install or project build.
`ticketTemplate('hono')` copies the clean clone into `_hono/repo`, runs
`whygraph build --decisions <file> --store <_hono/store>`, records the build
time, and writes `_hono/ready` after success. A batch 6 preparation refuses
if the ready marker, repo or store is absent. It never builds the template.
The ready ripgrep template is reused as it is. Every relate call sets
`RELATE_TELEMETRY=0` and `DO_NOT_TRACK=1`.

**Conditions.** Defaults are exactly `stub`, `graph`, `graph-nosearch`.
`none` does not run in batch 6 and an explicit request for it is rejected.
Stub has the unchanged rule, skill and tools but no store. Every whygraph
command returns `no result` with exit 0. Graph gets real answers from a
separate copy of the ready store, with a relative store link inside its
repo. Graph-nosearch is the same, except `whygraph search` returns
`no result` with exit 0. Its skill still tells the agent to search.

**Blind inputs and tasks.** The parent supplies `requests.json`,
`targets.json`, `controls.json`, `controls2.json` and `sample-ids.json`
under `/home/dev/scratch/whygraph-eval/tickets2/final/`. Their exact bytes
are copied into `eval/tickets/hono/`. The registry and
[batch 6 failure list](tickets/batch6-failures.md) record all five SHA-256
values. Before any task write, the generator checks all files, counts,
required fields, unique ids, regular expressions, ticket numbers, sample
ids and recorded hashes. A refusal writes no task, including conflicts.

Of 30 requests, keep those with at least one valid positive line range,
sort by id, and take the first seven `same-words`, seven `partial` and six
`other-words`. An unranged request is ineligible. A wording shortage stops
generation and names the wording and count. There is no retrieval or outcome
filter. Each conflict keeps the unchanged request, complete source entry and
target list. It passes with batch 5's accepted source or `also` ticket
spellings and no changed file. There is no amendment exception.

Five plain controls and eight governed controls keep their complete source
entries. Each passes exactly when the diff adds a line matching `added`
(case insensitive) in `file`. Governed controls have their own `ticket`;
that ticket must be in the parent's built store before the trial starts.
The scorer does not infer that a ticket was shown when no saved answer
contains it. A passing control needs no ticket name in its final reply.

**Fixed reports.** Batch 6 blocks append after the complete earlier report,
only when a finished or unscored batch 6 result exists. Titles use the
registered repo display name and fixed counts. Primary is `graph - stub`
over the 20 conflicts, using the existing seeded task bootstrap 95%
interval. Also print `graph-nosearch - stub`, `graph - graph-nosearch`,
and rates by wording. Missing pairs are omitted. Controls do not enter
conflict differences. A result in a condition that this batch does not run
is an error, including an unscored result.

For each condition, count conflicts that changed no file, named the ticket,
named it and changed a file, or changed no file without naming it. For
graph and graph-nosearch, count runs whose saved whygraph answer showed a
needed ticket and how many named it. Classify the source as search, linked
answer, distinctive terms, or mixed call, as in batch 5. Saved tool answers
still stop at 4,000 characters. Report plain and governed controls apart,
including their pass numerators, denominators and changed-no-file counts.
For governed graph controls, count answers that showed their own ticket,
then requested-change passes and unchanged runs among those answers.
Count runs calling each command once per kind, controls included. List
unscored runs separately, print the conflict FAIL sensitivity line, and
sum tokens and reported cost per condition over finished runs only.
JSON includes finished verdicts only. Invalid archives do not count.

**Runs.** 33 tasks (20 conflicts, 5 plain controls, 8 governed controls)
x 3 conditions x 3 repeats = 297 runs. These commands generate and plan
batch 6 without a `--conditions` flag. The last command starts the trial;
it is for the parent and was not run during preparation:

```sh
node eval/tickets/make-tasks.mjs --batch 6
ids="$(node --input-type=module -e 'import {readTasks} from "./eval/score.mjs"; console.log([...readTasks().values()].filter(t => t.batch === 6).map(t => t.id).join(","))')"
node eval/run.mjs --plan --only "$ids" --repeats 3
systemd-run --user --scope -q -p MemoryMax=6G -p CPUQuota=400% node eval/run.mjs --only "$ids" --repeats 3
```

**Limits fixed before the run.** The model may know hono. Many hono tickets
are pull requests whose commit cites its own number, so a ticket often
describes the very change it is linked to. Every request comes from a ticket
that a commit cites. The blind locator used a copy with no git history.
The repo copy has no installed dependencies, so the agent cannot run its
tests. Isolation is by detection, with the same known misses as batch 5.
This batch measures one agent, one model, a finite set of requests and
word/diff pass rules. It does not establish the effect on other repos or
longer sessions.

## Batch 6 results

From `score.txt`. The agent is opencode 1.18.29 with
`opencode-go/deepseek-v4.1-flash`; the runs are from 2026-11-15. The repo,
the tasks, the conditions, the pass rules and every count below were fixed
and committed before the first run. The run left the plan in three ways:

- The runner stopped once, when 139 of the 297 cells were settled. One `stub` run timed
  out, and its retry broke isolation; the runner takes that pair for a
  harness failure and stops. It was started again with the same command and
  the same code. The two runs that the stop cut ran again from the start.
  The cell that caused the stop (`hono6-conflict-hn-23`, `stub`, repeat 2)
  then got a third attempt, where the fixed rule gives one retry; it
  finished and passed. Without that run `stub` holds 39 passes in 57 runs.
- Two `stub` runs ended within seconds on a server error of the provider
  and ran again on the next start of the runner, as the fixed rule for an
  agent error says. The runner was started three times in all.
- 2 runs are unscored and in no rate: two `stub` conflict runs broke
  isolation twice. All other 295 runs finished.

| | stub | graph | graph-nosearch | graph - stub | graph-nosearch - stub | graph - graph-nosearch |
| --- | --- | --- | --- | --- | --- | --- |
| Twenty ticket conflicts (primary: graph - stub) | 69% | 98% | 100% | **0.31 [0.15, 0.48]** | 0.33 [0.16, 0.49] | -0.02 [-0.05, 0.00] |
| Same words, 7 tasks | 65% | 100% | 100% | 0.38 [0.10, 0.71] | 0.38 [0.10, 0.71] | 0.00 |
| One shared term, 7 tasks | 86% | 100% | 100% | 0.14 [0.00, 0.43] | 0.14 [0.00, 0.43] | 0.00 |
| Other words, 6 tasks | 53% | 94% | 100% | 0.42 [0.17, 0.69] | 0.47 [0.22, 0.72] | -0.06 [-0.17, 0.00] |
| Five harmless controls | 93% | 100% | 93% | 0.07 [0.00, 0.20] | 0.00 | 0.07 [0.00, 0.20] |
| Eight governed controls | 100% | 100% | 100% | 0.00 | 0.00 | 0.00 |

| Conflict runs | stub | graph | graph-nosearch |
| --- | --- | --- | --- |
| Finished | 58 | 60 | 60 |
| Changed no file | 50 | 60 | 60 |
| Named the ticket | 40 | 59 | 60 |
| Named the ticket, and changed a file | 0 | 0 | 0 |
| Changed no file, and did not name the ticket | 10 | 1 | 0 |

- **The graph leads on a second repo, by less.** `graph - stub` is 0.31
  [0.15, 0.48] over 20 requests. With the unscored runs counted as failures
  it is 0.32 [0.15, 0.48]. `graph` passed 59 of 60 runs and
  `graph-nosearch` 60 of 60. The lead is smaller than on ripgrep because
  `stub` passed 40 of 58 runs here. Ten requests carry the lead; on the
  other 10 `stub` passed every run. The repo and the language both differ
  from batch 5, so no number here is compared with batch 5 run by run.
- **No run with the graph changed a file on a conflict**: 60 of 60 in each
  graph condition. `stub` changed a file in 8 of 58 runs, and in 10 more it
  held the change and named no record.
- **The firm rule stopped no harmless change.** In all 24 `graph` runs and
  all 24 `graph-nosearch` runs on the governed controls, a whygraph answer
  showed the control's own ticket, and all 48 made the requested change. So
  did all 24 `stub` runs. No control run of any condition changed no file.
  The two failed plain controls (one `stub`, one `graph-nosearch`, the same
  request) changed files, but the diff does not hold the line that the pass
  rule asks for.
- With `search` on, a whygraph answer showed the ticket in 59 of 60 `graph`
  runs, and all 59 replies named it: the link showed it in 56 runs and
  `search` in 52. Three runs had it from `search` only. The one failed run
  had it from no answer.
- With `search` off, the linked part of `carry` or `why` showed the ticket
  in 56 of 60 runs, and all 56 replies named it. The other 4 replies named
  it too.

### Post hoc counts

Added after the results were seen; they change no verdict
(`python3 eval/tickets/routes-posthoc.py . hono6`). They count two ways to
the ticket that go around the whygraph commands.

| Conflict runs | stub | graph | graph-nosearch |
| --- | --- | --- | --- |
| Finished | 58 | 60 | 60 |
| A `git log`, `git blame` or `git show` answer held the ticket's number | 57 | 42 | 39 |
| Ran `relate` on the store | 24 | 41 | 43 |
| A `relate` answer held the ticket | 0 | 38 | 41 |

- **Git history alone shows the ticket's number on this repo.** A hono
  commit cites the number of its pull request, and the agent reads the
  history in every `stub` run. In 57 of 58 `stub` runs a git answer held
  the number of the needed ticket; 40 of those replies named it, and 17 did
  not (8 of them changed a file). The same count on batch 5
  (`routes-posthoc.py . ripgrep5`) gives 52 of 55 `stub` runs on ripgrep.
  So `stub` is not a condition without the ticket's number. It is a
  condition without the ticket's text, and the agent pays for the search:
  on the conflicts a `stub` run used about 3.3 times the tokens of a
  `graph` run (112038869 over 58 runs against 34806289 over 60).
- **`graph-nosearch` does not isolate the commit link.** The agent has the
  `relate` program and the store, and it wrote its own queries in 43 of 60
  `graph-nosearch` runs (41 of 60 `graph` runs); a `relate` answer held the
  ticket in 41 and 38. Of the 4 `graph-nosearch` runs where no whygraph
  answer showed the ticket, 3 had it from a `relate` answer and 1 from a
  git answer. On batch 5 the agent ran `relate` in 30 of 57
  `graph-nosearch` runs. The scorer's count stands for what the whygraph
  commands showed (the link, in 56 of 60 runs); it does not show that the
  reply rests on the link alone.
- The `stub` runs called `relate` too (24 runs); there it is a stand-in
  that answers nothing.

Isolation: 16 attempts were archived as invalid and run again (15 `stub`,
1 `graph`). Ten opened a file of the run folder beside the repo copy with
the file tool (9 `stub`, 1 `graph`): a script under its `bin/` (in
`stub` the stand-in tool's own script, where the agent can read that the
tool answers nothing), the confinement script or the state folder. Three `stub` attempts used scratch files under `/tmp`, one
made symlinks, and two opened files of the whygraph checkout that holds
this eval.

Tokens: 217811955 over the 295 finished runs, with a reported cost of
USD 4.12 (the runs drew on a subscription). The invalid attempts and the
attempts that a retry replaced are outside these totals.

What batch 6 cannot show:

- One agent and one model again, a repo that the model may know, three
  repeats, and a verdict on words and a diff.
- What the graph adds on a repo whose commits cite no ticket. There neither
  git history nor the commit link shows a ticket, and only `search` can.
  Every request here comes from a ticket that a commit cites, and many hono
  tickets are the pull request that made the change.
- What the commit link does alone. The agent can query the store with
  `relate` in both graph conditions.
- Whether the agent would keep a wrong change out when it can run the
  tests. The repo copy has no installed dependencies.
- That a firm rule never stops too often. There are eight governed
  controls, each passes on one added line, and a harmless change that looks
  like a reversal is not among them.
- That the runs were isolated. The harness detects a breach in file-tool
  paths and in shell text; it does not prevent one.
- What the runner should do when a timeout is followed by an isolation
  breach. The rule is not defined; the runner stops, and this batch gave
  that cell a third attempt.

## Batch 7, fixed before its first run

Batch 7 measures twelve conflicts on one small public TypeScript repo,
`pmndrs/zustand`, at `9fed2eb2f3af672da9f7bf694b996df3831fc207`.
The repo has 1,393 commits. Of its 1,934 tickets, a commit cites 954 and
no commit cites 980. These are source inventory counts, not trial results.
Two more repos can follow through registry data, without repo-specific code.
The agent and model remain opencode 1.18.29 and
`opencode-go/deepseek-v4.1-flash`. Preparation starts no trial or hosted model.

**Historical inputs.** Each registry batch records `instructionsCommit`.
Preparation reads the skill and rule from that commit with `git show`.
Missing commits or files stop preparation before it changes a work folder.
Batches 1 to 6 record `c92205d`. Batch 7 records `c1ae17c`.
This work does not edit `skills/`.
The independent author moves B6-26's skill byte check to the recorded
commit and keeps its launcher check. See [ADR 0010](../docs/adr/0010-eval-instruction-history.md).

**Records and strata.** The unauthenticated fetcher saves raw issue and
repository-comment pages by URL digest. A restart reuses complete pages.
It waits out rate limits and sends only a generic client name.
It makes no per-ticket comment or pull-request requests. The expected
request count is ceil(tickets / 100) + ceil(comments / 100), at least two.
Optional `--expected-tickets` and `--expected-comments` print a numeric
estimate before fetching; without totals the output states the formula.
Pull-request merge status comes from the issue-list `merged_at` field.

The converter includes the outcome and only comments with OWNER, MEMBER or
COLLABORATOR association. It prints comments in time order. The title and
item texts together have an 8,000-byte UTF-8 budget. Keep the outcome, then
newest maintainer comments, then the opening body. Cut the body first, then
older comments; retain whole Unicode characters. Metadata and commit ids
are outside that content budget. Earlier decisions files and stores stay
unchanged. See [ADR 0012](../docs/adr/0012-ticket-record-outcomes.md).

`sample.mjs --batch 7 --tickets <export> --out <sample>` draws the registry's
`sampleCounts` per stratum with its committed seed (currently 60 each).
The total sample size is the sum of those counts. Cited means a commit that
changes a configured source extension cites the ticket. Uncited means no
commit cites it and the ticket is closed. A shortage writes no sample.
The blind author supplies requests, targets, two control files and sample
ids in the same layout as `tickets/hono/`, with a stratum on each request
and each sampled id. Requests cover a subset of the sample: each names one
sampled ticket of the same stratum, and no two name the same ticket.
The request count must equal the registry's `counts.requests` (currently 22).
The parent records their exact SHA-256 values.

`make-tasks.mjs --batch 7` refuses until those inputs and hashes exist.
It validates all inputs before writing any task. For each stratum, sort
requests with at least one valid positive line range by id and take the
first six. A shortage names the stratum and writes nothing. Keep three
plain controls and four governed controls. Pass rules remain batch 5's:
a conflict must name a source or also ticket and change no file; a control
must add a matching line in its specified file. Keep each source entry.

**Six conditions.** Conflicts run in all conditions. Controls run in stub
and graph only. Every condition receives the same client, repo and skill.
The instruction file differs only by the omitted rule in graph-norule.

| Condition | Rule | Store answers |
| --- | --- | --- |
| stub | Present | Every command returns `no result` |
| graph | Present | Full tool |
| graph-nolink | Present | Carry and why omit commit-linked records |
| graph-nosearch | Present | Search returns `no result`; other commands stay full |
| graph-noterms | Present | Carry has the no-shared-record term section |
| graph-norule | Absent | Full tool and skill |

**Closed store.** The complete agent process, including file tools, runs
in a minimal bwrap filesystem. The run sees its repo, empty agent state,
operating system tools, a compiled client and its own Unix socket.
The store, product code, service code, templates and other run folders
have no mounted path. A private PID namespace blocks host `/proc` paths.
The agent's shell is a client of a host-owned launcher. The host starts
each command in a separate minimal bwrap namespace with the same repo and
tool client, no network, and no identity mount. Nested bwrap fails on this
box under its enforced AppArmor profile. The host launcher avoids nested
namespace creation without a policy change. Stdin, stdout, stderr and exit
status pass through the client. Connection loss, timeout and run cleanup
end the command and its children. The launcher closes before the store.
The client is read-only and execute-only; capability drops prevent reads
and permission changes. Its bytes are identical in every condition.

The runner starts a separate service before health probes and agent launch.
It closes that service in `finally`. A unique socket appears at the fixed
path `/whygraph/service.sock` inside just that run. The protocol accepts
only carry, why, impact and search, each with one target. It accepts no
caller-selected store path or Cypher. Invalid invocations use the product
parser and direct CLI diagnostics, including help. Valid unsupported commands,
valid option-bearing invocations and embedded NUL receive exit 2 with empty
stdout and `usage: whygraph <carry|why|impact|search> <target>\n` on stderr.
A call that fails inside the store service returns exactly
`whygraph service unavailable\n` on stderr, empty stdout and exit 70.
Its internal cause stays in host-only logs, attempt metadata, ledgers and
rehearsal failure output. A lost shell launcher prints
`whygraph shell launcher unavailable\n` and exits 70. The shell launcher
keeps descriptive input refusals, including argument and environment limits
and a program that does not exist. These diagnostics are identical in every
condition and name nothing of the trial. Disabled tool aliases print `tool unavailable\n` and
retain exit 126 for command denial. Product diagnostics retain their direct
CLI bytes. Full answers and file manifests remain outside the agent filesystem for the smoke audit.
Batches 1 to 6 keep their earlier setup and limits.

**Name resolution.** The agent and its shell read the host's resolver
inputs through `/etc`. The confinement follows the host's links at launch.
For a resolver file outside the mounted system folders, it mounts only
that regular file, read-only, at its resolved path. Intermediate external
links are recreated. No containing resolver folder or sibling file is
exposed. Plain files in `/etc` get no additional mount. This applies to
`resolv.conf`, `nsswitch.conf`, `hosts`, `host.conf` and `gai.conf`.
A dangling link, unreadable input, private target or executable external
target refuses startup. Mount derivation does not depend on the condition.
The closed-store probes and file-identity comparison remain unchanged.

**Real agent preflight.** Before the first pending closed-store cell, the
runner starts the real agent once in an empty scratch repo. Cells and
preflight share the launch builder, mounts, environment, model and launch
arguments. The preflight has live private store and shell sockets, with no
task store or template. Its prompt asks for `ok` with no tool use. Success
requires exit 0, a successful stop, positive token usage, exactly `ok`
after whitespace trimming, and no tool event. A failed preflight stops the
runner before any cell, ledger reservation, cell result or attempt archive.
Plans and runs with nothing pending start no preflight. Batches 1 to 6
keep their setup and the frozen shared launcher.

`results/_preflight/<UUID>/` keeps the command, JSONL events, stderr and
`record.json` with exit, tokens, wall time and scratch path. Its
`startup.json` compares host and confined resolver, time zone and system
certificate hashes and checks identity-directory presence without opening
its files. `_preflight/latest.json` selects the smoke check's record.
The scorer has no cell metadata to read there. Smoke-check prints the
preflight's usage and time on its own line. It does not add a planned cell
or change a score or result key. This command runs only preflight:

```sh
TMPDIR=/mnt/ssd/tmp systemd-run --user --scope -q -p MemoryMax=6G -p CPUQuota=200% node eval/preflight.mjs --batch 7
```

**Ablations.** Prepare both copies once per batch under a kernel `flock`.
Graph-nolink removes CITES relationships. Graph-noterms removes Term nodes
and MENTIONS relationships. Later cells and restarted runners validate
`prepared.json` against the source path, snapshot and WAL file identities,
and both proof files. This check starts no relate process and copies no
store. A changed receipt or store refuses as a harness failure. A directory
without a ready receipt but with partial files requires inspection.
Preparation preserves those files. The old ablations directory was empty
when inspected read-only on 2026-11-16; it needs no removal before starting.
If another start leaves partial files there, archive the whole directory
before using a fresh preparation directory.

Fingerprints bind full node properties to internal IDs and hash edge rows
with short endpoint IDs. Clones retain those IDs after deletion. Queries
range 256 nodes or 4,096 edges before projection; SHA-256 consumes rows as
they arrive. Expected row counts must match the stream. Every unchanged
node, relationship, record text and search vector remains checked.
Memory grows with the loaded graph, one bounded projection, and the small
query list. It does not multiply relationship count by endpoint text or
vector size. No product flag, environment switch, source change or recipe
change implements a condition. See the receipt format and independent
failure contract in [batch7-failures.md](tickets/batch7-failures.md).

Measured on 2026-11-16 with `MemoryMax=2G`, `CPUQuota=400%` and
`TMPDIR=/mnt/ssd/tmp`: the real store has 1,934 records, 26,185 nodes,
152,445 relationships and 18,204,266 bytes, following its symlink.
The original fingerprint returns 23,477,829 bytes of nodes, then the
relationship projection hits the 2 GiB scope limit. The kernel kills the
scope after 9.934 seconds, before any fingerprint returns.

| Preparation, without an agent | Whole-scope peak, bytes | Wall time |
| --- | ---: | ---: |
| Real stores alone | 419,663,872 | 50.72 s |
| Real stores, receipt reused | 80,928,768 | 0.156 s |
| One smoke cell, including repo, baseline and client | 429,633,536 | 57.46 s |
| Three cell preparations at once, sharing one preparation | 514,093,056 | 58.59 s |
| Synthetic: 5,000 records, 305,000 relationships | 550,387,712 to 567,586,816 | 142.20 to 152.02 s |
| Synthetic, receipt reused | 81,657,856 | 0.233 s |

Each peak comes from cgroup `memory.peak`, which includes all subprocesses
and charged file cache. Each row has one run, except synthetic preparation
has two. All successful preparation peaks are below 1,000,000,000 bytes.
The parent's 6 GiB smoke scope covers the measured preparation peak.
Agent execution and health queries are outside these measurements.
Shared host load makes the wall times observations rather than a speed claim.
A trace of three simultaneous small-store callers records exactly two
copies and two mutation queries; reuse adds no relate or copy calls.

Reproduce the store-only measurement inside a fresh scope:

```sh
TMPDIR=/mnt/ssd/tmp systemd-run --user --scope -q -p MemoryMax=2G -p CPUQuota=400% \
  node eval/measure-preparation.mjs <store> <new-ablation-directory>
```

Repeat with the same directory to measure receipt reuse. Build synthetic
input inside the same memory limit with
`node eval/store-stress.mjs <new-directory> 5000`. Each record has about
8,000 text bytes and 384 deterministic floats assigned directly; this
build starts no embedding model. Preparation time is mainly graph loading,
range scans and hashing. No runner memory-scope guard is added.

Carry omits term candidates already printed as linked decisions. A CITES
removal alone would therefore change its term section. The eval service
renders the full carry answer and replaces only its decision sections with
the product's `whyAnswer` from the ablated store. Both carry forms retain
all other bytes, including the original term de-duplication. Graph-nolink
keeps search and impact full. Graph-noterms keeps why, impact and search
full. See [ADR 0011](../docs/adr/0011-eval-closed-store.md).

**Attempts.** Each cell has at most two attempts, across restarts too.
The ledger reserves an attempt before launch. A failed attempt is archived
before retry. Two agent-caused ends, whether timeout or isolation breach
in either order, leave an unscored marker and both archives. Since 2026-11-17, for
batch 7 and later, a file-tool path inside the confinement's private `/tmp`
is no isolation breach: it cannot reach the host (ADR 0011, "File-tool
paths in the private /tmp"; decided before any batch 7 result existed).

**No tool against the client.** Since 2026-11-17, for batch 7 and later, a
shell command sees only the programs that `closed-shell.json` lists, a seccomp filter denies `ptrace`, the client is static, and
the service answers only the run's own client, which holds a secret token
(ADR 0011, "No tool against the whygraph client"; decided before any batch
7 result existed). The runner
continues and resume skips that cell. A harness failure gets one retry;
if the cell still fails, the runner stops with both archives. An interrupted
reserved attempt stops visibly for inspection. The registry records each design's store access and control conditions.
`scripts/attempts.pure.ts:attemptDecision` exposes the decision without I/O.
`eval/run.mjs:settleCell(cell, allIds, {runAttempt, results, rule})` exposes
the applying loop. Invented attempts can drive every order without an agent.
`rule` is `closed`, `opencode`, or `single`; its default follows the registry.
Closed ledgers live under `results/_ledger`. A runner rejection leaves its
reservation for inspection. Earlier batches keep their existing rules,
including the possible third attempt in the old invalid-then-timeout ladder.
The 20-minute timeout and five-second kill grace remain.
A harness-failure reason includes the agent's error name, first message
line and exit status. Missing events still produce an explicit completion
or exit cause. The formatter bounds the reason, redacts prompt text before
truncation, and reads no stderr, tool output or nested response payload.
Each failed attempt, its ledger entry, the invalid root marker and the
runner's final error keep the cause. Both retry causes remain visible.
Closed attempts retain their work copies and full answer logs for audit,
as ADR 0011 and ADR 0013 specify. This differs from the older runner's
work-folder removal rule.


**Path bounds.** Attempt work folders use UUIDs and mode 0700. The store
socket is `service.sock`; the shell socket is `shell.sock`. Neither path
contains a cell name. Work, result and template roots keep their supplied
paths. A short symlink alias to a long physical root is valid. Path identity
checks resolve both sides the same way, including native file and patch
paths, symlink targets and result containment. Before a cell starts, the
absolute work root plus
a UUID and the longest socket leaf must fit the 107-byte Unix pathname
limit. The default root gives a 72-byte service path. A longer root refuses
with `work root too long for Unix sockets`. Namespace mount destinations
remain constant. Result and ledger names accept at most 128 safe ASCII
bytes; other identities use `id-` and a full SHA-256 digest. That prefix is
reserved for digests. Archive names add a UUID to a bounded result key;
they fit within 166 bytes. Metadata retains the full cell ID.
Mount paths check both lexical and canonical lengths. Launches check host
argument, environment and total exec limits before exec.

**Smoke and full plans.** The smoke plan uses repeat 1 of four tasks:
the first cited conflict, first uncited conflict, first plain control and
first governed control. It has 16 cells. The full plan has three repeats:
12 conflicts x 6 conditions x 3, plus 7 controls x 2 x 3 = 258 cells.
A plan reads no template, builds no store and starts no agent.

```sh
node eval/tickets/make-tasks.mjs --batch 7
node eval/run.mjs --batch 7 --stage smoke --plan
node eval/run.mjs --batch 7 --plan
```

**Rehearsal before smoke.** The rehearsal runs the committed plan with real
templates, stores, preparation, services, shell launcher, confinement,
attempt ledger and result writer. Only the agent executable changes.
The committed `stand-in.mjs` runs inside the agent's confinement through
the same launch path. It reads source, calls carry, why, impact and search,
checks denied store, relate, code, other-socket and network access, and
applies committed control edits. A live host listener proves network denial.
It emits opencode events with zero tokens and cost. The existing reader
and scorer consume those events. Controls must pass their real diff rules.
Rehearsal skips real-agent preflight: its stand-in has no model connection
and emits zero tokens. The rehearsal marker records this choice, and the
smoke check reports the exclusion on its own line.
Every unexpected step result fails. The registry has no stand-in agent;
the trial CLI rejects unknown selectors.

Each invocation creates a fresh UUID result folder under
`test-results/rehearsals/`. `--results <root>` selects another rehearsal
root. Trial evidence paths, their ancestors, symlinks within the root and
any root that holds trial metadata refuse before writes. Rehearsal markers
and attempt metadata identify these results. The default scorer still reads
only `eval/results/`. Rehearsal invokes the real smoke checker and propagates
its exit status. Full rehearsal runs 258 cells and then checks the smoke
subset. Each run prints wall milliseconds and the scope's `memory.peak`.
See [ADR 0013](../docs/adr/0013-eval-rehearsal.md).

```sh
TMPDIR=/mnt/ssd/tmp systemd-run --user --scope -q -p MemoryMax=6G -p CPUQuota=400% node eval/rehearse.mjs --batch 7 --stage smoke
```

Omit `--stage smoke` to rehearse the full plan. A second invocation reuses
the real prepared stores and creates fresh work and results. Rehearsal
results never count as trial results.

Measured on 2026-11-16 in two fresh `MemoryMax=6G`, `CPUQuota=400%` scopes:

| Smoke rehearsal | Finished cells | Command wall time | Scope peak, bytes |
| --- | ---: | ---: | ---: |
| First | 16/16 | 446.95 s | 577,150,976 |
| Second, prepared stores reused | 16/16 | 443.05 s | 557,506,560 |

Each run has 16 attempts, 128 service replies, zero service failures and
seven smoke-check PASS results. The prepared receipt's hash and file
identity stay unchanged, as do all runtime source hashes. The default
scorer output stays byte-identical; `eval/results/` has no new or changed
file. These are two resource observations, not a speed comparison.
Whole-command wall time comes from `/usr/bin/time`; peak memory comes from
the scope's `memory.peak` after all cells and smoke checks. Logs, measurements
and receipt identities remain in `test-results/trial7-fix5/`. Rehearsal
results remain under `test-results/rehearsals/`.

After rehearsal passes, the parent runs smoke and then the full trial:

```sh
TMPDIR=/mnt/ssd/tmp systemd-run --user --scope -q -p MemoryMax=6G -p CPUQuota=400% node eval/run.mjs --batch 7 --stage smoke
TMPDIR=/mnt/ssd/tmp systemd-run --user --scope -q -p MemoryMax=6G -p CPUQuota=400% node eval/smoke-check.mjs --batch 7
TMPDIR=/mnt/ssd/tmp systemd-run --user --scope -q -p MemoryMax=6G -p CPUQuota=400% node eval/run.mjs --batch 7
```

The smoke checker prints PASS or FAIL for cell completion, ablation
answers, file identity, denied store/code access with counts, service
replies, scorer blocks, and tokens and wall time per run. It prints no task
verdict or pass rate. Missing evidence fails the check. After PASS, those
cells remain repeat 1 of the full plan. After FAIL, the parent archives the
cells and their ledgers before another smoke run.

**Reports.** Batch 7 blocks appear only when a finished or error result
exists, after every unchanged earlier block. Conflicts print over all and
per stratum, per condition. The primary paired difference is graph - stub.
Also print graph minus each ablation. Use the existing seeded bootstrap
over per-task differences, over all and per stratum. Report conflict
quadrants, needed tickets shown in whygraph answers, plain controls and
governed controls apart, unscored cells with FAIL sensitivity, and finished
run tokens and reported cost per condition. Invalid attempts stay outside
normal rates. JSON contains finished verdicts only.

**Limits fixed before the run.** This batch has one agent, one model and
twelve conflicts. An uncited ticket states a decision only as far as its
outcome and maintainer comments state one. The model may know the repo.
No project dependencies are installed, so the agent cannot run its tests.
Three repeats and word/diff pass rules limit what the trial can establish.
Saved agent tool answers still stop at 4,000 characters; service logs keep
full answers for health checks. [Batch 7 failure cases](tickets/batch7-failures.md)
are the contract for the independent test author.

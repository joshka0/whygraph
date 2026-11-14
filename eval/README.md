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
Each complete source entry is preserved verbatim under `ground_truth.source`.
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
  target paths. An attempted direct external file call is invalid even
  when opencode denied it. A removed transient link is still caught when
  its creation is visible in a shell command.

Each hit sets status invalid with reason `isolation breach`, archives the
result under `results/_invalid/`, preserves the work copy at the path in
its metadata, and retries the cell once. Repeated harness failure stops the
runner with both attempts archived, rather than looping forever. Invalid
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
JSONL or a spawn error is a harness failure, archived and retried once.
The 20-minute timer sends SIGTERM; opencode gets SIGKILL after five more
seconds if it has not closed. An agent timeout retries once, keeping the
first attempt under `_attempts`; a second timeout is marked unscored,
excluded from normal rates and counted as FAIL in the conflict sensitivity
lines. Done and twice-timed-out unscored cells are skipped on resume.
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

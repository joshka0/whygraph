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
- 6 on memod at commit `be6b126` (`/home/dev/scratch/whygraph-eval/memod-tasks`),
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
`$WHYGRAPH_EVAL_WORK/<run id>/repo` (default `/tmp/whygraph-eval`, a folder
with no `CLAUDE.md` above it), builds a fresh store there when the condition
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
- `/` read-only; writable only the repo copy and `<work>/tmp`, where the CLI
  keeps its per-command files.
- Hidden (an empty tmpfs or `/dev/null` over them): `~/.claude` except
  `~/.claude/shell-snapshots`, `~/.claude.json`, `~/.optmem`, `~/.local/bin`,
  `~/.config/spec-ledger`, `/home/dev/scratch`, the memod source repo, all of
  `/tmp` except this run's work folder (so other runs and the moved fixture
  records), and whygraph's `eval/`, `scripts/`, `test/`, `test-results/`,
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
node eval/run.mjs --only memod-conflict-report-build-gate --repeats 1   # the pilot
node eval/score.mjs                     # the verdicts and the rates
node eval/score.mjs --json              # one verdict per run, as JSON
```

`--only <id>[,<id>]` picks tasks, `--conditions none,graph,stub` picks
conditions, `--repeats` sets the repeats, `--jobs` lowers the 3 parallel
agents. A run whose `results/<id>/meta.json` says `done` is not started again;
an `error` run (non-zero exit, timeout at 20 minutes) is.

`results/<run id>/` (git-ignored) holds `prompt.txt`, `command.json`,
`output.jsonl` (the agent's full stream), `final.txt` (its final message),
`diff.patch`, `tools.json` (each tool call with its input and result),
`stderr.txt`, `debug.log` and `meta.json` (status, tokens, cost, wall time,
turns, and the tools, skills, MCP servers and plugins the agent started with).

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

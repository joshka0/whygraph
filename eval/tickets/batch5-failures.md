# Batch 5 launcher blocked before its first run

Preparation stopped at the mandatory file-tool isolation guarantee. This is
an observed blocker, not a complete batch 5 acceptance list or a frozen design.
No trial run started. No task, scorer, skill, rule, or store was changed.

## Cases tested

- B5-01 — A normal file inside the prepared scratch repo is read with the
  native `read` tool. Expected: succeeds. Observed: succeeds with
  `permission.read = "allow"` and `external_directory` explicitly denied.
  Native read/edit permission patterns in this version are worktree-relative;
  an absolute repo-prefix allowance denies ordinary repo reads too and is
  not a usable isolation solution.
- B5-02 — Native `read` of `/etc/hostname` outside the repo. Expected: denied
  without prompting. Observed: denied by `external_directory`.
- B5-03 — An `outside-link` symlink inside the repo points to
  `/etc/hostname`; native `read` opens the repo-local symlink. Expected:
  denied without returning the external file's contents. **Observed: succeeds
  and returns the external file's contents.** The same session read an
  ordinary repo file and denied the direct external path. This violates
  "the agent's file tools read and write only under the repo copy" and
  prevents certifying that file tools cannot reach the credential file.
  No credential contents were read, copied, or printed in these checks.
- B5-04 — An opencode session requests webfetch. Expected: cannot fetch.
  Observed in the first check: no webfetch tool was exposed. The model
  reported it unavailable; no webfetch call occurred.
- B5-05 — The confined shell in each of none, stub, graph, graph-nosearch
  checks the store, whygraph, credential readability, opencode data,
  `/home/dev/scratch`, and network. Expected and observed: none has neither
  store nor whygraph; stub has no store and prints `no result`; both graph
  modes have their own store and working carry; graph-nosearch search prints
  `no result` with exit 0. All four hide the credential, expose an empty
  opencode data directory, hide scratch ground truth, and fail network
  connection with ENETUNREACH (101).

## Configuration and evidence

Installed opencode: 1.18.29. Both short checks used only
`opencode-go/deepseek-v4.1-flash`, on an invented four-line money repo, never
a trial task or the ripgrep copy. Exactly two model calls were made.

Command:

```sh
opencode run --pure --auto --format json -m opencode-go/deepseek-v4.1-flash '<one-line scratch request>'
```

The candidate launcher is preserved at
`/tmp/whygraph-batch5-check/candidate/opencode.mjs`; the candidate runner and
its patch are beside it. It was removed from the active runner without
losing the candidate work. `launch-graph.json` in that scratch root records
the exact tested environment, arguments, and inline configuration, containing
only paths and settings, no secret values. The environment isolates HOME,
XDG_CONFIG_HOME, XDG_CACHE_HOME and XDG_STATE_HOME to the work folder, leaves
XDG_DATA_HOME at the host data location for CLI authentication, sets SHELL to
the confinement wrapper and PATH to the condition's bin first, disables
Claude compatibility, external skills, sharing, updates and LSP downloads,
and sets RELATE_TELEMETRY=0 and DO_NOT_TRACK=1. Inline configuration disables
plugins, MCP, extra instructions, formatting, LSP and snapshots. Its default
permission is deny; bash, skill, read, edit, glob and grep are allowed;
external_directory, webfetch, websearch, task and question are denied.

The external-directory configuration also has an exact denial for the host
`opencode/tool-output/*` path: the installed binary otherwise appends its
own allowance for that directory after a catch-all denial. That refinement
does not fix the symlink bypass.

The intended repo instruction path was `AGENTS.md`; the intended skill path
was `.opencode/skills/whygraph/SKILL.md`, with main's text unchanged.
[OpenCode V1 rules](https://opencode.ai/v1/docs/rules/) says: "Place an
`AGENTS.md` in your project root for project-specific rules."
[OpenCode V1 skills](https://opencode.ai/v1/docs/skills/) lists:
"Project config: `.opencode/skills/<name>/SKILL.md`".
[OpenCode V1 permissions](https://opencode.ai/v1/docs/permissions/) documents
external-directory checks and explicit deny rules in auto mode. The live
probe demonstrates that these rules do not establish the required boundary.

Retained scratch evidence (all under `/tmp/whygraph-batch5-check`):

- `source`, `store`, `records.json`: invented repo and its store.
- `work/none`, `work/stub`, `work/graph`, `work/graph-nosearch`: folders made
  with the candidate runner's own `prepare` and `confinement` functions.
- `shell-probes.json`: all four confinement results.
- `probe-graph.jsonl`, `probe-graph.stderr`, `probe-graph-summary.json`:
  decisive second model call, including the successful symlink read.
- `prepare.mjs`, `probe.mjs`, `shell-probe.mjs`: exact scratch procedures.
- `candidate`: preserved implementation, not enabled for trial use.

The first check's files were reused by the second; its result remains in the
agent tool transcript. The decisive second stream is retained in full.

The governed-control source exists, with eight entries. Its SHA-256 is
`a358eb529f81821a24c21f00503ec552ac24426d2e604fba3f5120c959c04763`.
It was not copied or turned into tasks after the isolation stop. The proposed
batch would have 19 conflicts + 5 plain controls + 8 governed controls = 32
tasks and 384 runs (four conditions, three repeats). These counts are design
arithmetic only: no batch 5 tasks or executable 384-run plan were produced.

Parked decision: require an upstream fix that applies realpath checks to all
file tools, with independent acceptance checks for symlink reads and writes,
before continuing. A shell confinement alone cannot repair file tools in the
unconfined CLI process; simply denying direct external paths is insufficient.
The runner remains unchanged, and no batch 5 launch is enabled.

## Verification after parking the candidate

- `pnpm check`: exit 0.
- `node_modules/.bin/memod lint`: exit 0 outside the command sandbox (its
  event log is under `.git`).
- `node scripts/readme-check.mjs`: exit 0 outside the command sandbox;
  14 commands, 0 drifted.
- `systemd-run --user --scope -q -p MemoryMax=6G -p CPUQuota=400% node eval/selftest/check.mjs`:
  exit 0; 315/315 existing cases as expected. No test files were changed.
- `node eval/score.mjs`, saved to scratch and compared with `eval/score.txt`:
  exit 0; diff exit 0 with no output.
- `node eval/run.mjs --plan --only ripgrep4-conflict-rg-04 --repeats 3`:
  exit 0; 9 planned, all already done, no runs started.
- `git diff --exit-code main -- eval/run.mjs eval/score.mjs eval/tasks skills`:
  exit 0; those files are unchanged.

The existing self-tests also retained
`/home/dev/repos/personal/whygraph/test-results/ticket-selftest-ajV9Rp` and
`/home/dev/repos/personal/whygraph/test-results/batch4-selftest-XWYRLa`.

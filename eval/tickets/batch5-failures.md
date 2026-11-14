# Batch 5 failure cases

Fixed before the first batch 5 trial run. An independent author derives
acceptance cases from this list and the README. No tests under
`eval/selftest/` or `test/` are written by this implementation. B5-03 uses
the operator's explicit detection ruling, replacing the original prevention
requirement for symlink reads. The original two scratch calls and the
candidate from the first preparation attempt remain preserved.

- B5-01 — Native file tools read and edit an ordinary file in the prepared repo copy. Expected: allowed without prompting. Opencode 1.18.29 matches read/edit permissions on worktree-relative paths; an absolute repo-prefix allowance that denies ordinary repo reads is not an acceptable solution. The launcher allows read/edit and denies external_directory.
- B5-02 — Native `read` names `/etc/hostname` directly. Expected: opencode denies it without prompting. The post-run absolute-path scan also makes this attempted access invalid with reason `isolation breach`, even though the tool returned an error. No credential contents may be used as a probe.
- B5-03 — A repo-local symlink targets `/etc/hostname`. Expected: a link present before the session makes it a harness failure and no agent starts. A link present after the session makes it invalid; a visible logged creation also makes it invalid even if removed. Opencode itself may successfully read through the link: prevention of that read is not required by the ruling. Archive under `_invalid`, exclude it entirely from scoring, and retry. The harmless successful symlink read from the second original scratch call remains evidence of this limit.
- B5-04 — Request webfetch or websearch. Expected: denied or absent from the exposed tools; no fetch/search occurs and nobody is asked for permission. `--auto` must not override an explicit deny. The first scratch call reported webfetch unavailable and emitted no webfetch call.
- B5-05 — Confined shell checks store, whygraph, credential file, opencode data, `/home/dev/scratch` and network in each condition. Expected: none has no store and cannot execute whygraph/memod/relate; stub has no store and all whygraph commands print `no result`, exit 0; graph has its copied store and real answers; graph-nosearch has the same store, real carry/why/impact and `search` prints `no result`, exit 0. All four hide the credential and ticket source data, expose an empty opencode data directory, hide other runs/templates/eval answers, and cannot connect to the network. Observed scratch connection errno: ENETUNREACH (101).
- B5-06 — Preflight recursively scans every directory of the copy, including `.git`, without following symlink directories. Expected: any escaping file or directory symlink is found before model launch; preflight metadata has phase `preflight`, status `invalid`, reason exactly `isolation breach`, and zero tokens. No ordinary result stays at the run id.
- B5-07 — Agent leaves a new external file or directory symlink, including one in `.git` or a hidden folder. Expected: post-run scan finds it before diffing or removing the work folder, regardless of success/error/timeout status; invalid and archived with `isolation breach`.
- B5-08 — Logged shell command invokes `ln -s`, `ln -sf`, `ln -snf`, `ln --symbolic`, quoted `ln`, or `/bin/ln -s`, including in a compound command. Expected: invalid with `isolation breach`, even if it creates an internal link, fails, or removes it later. Ordinary `ln` without symbolic flags is not a hit. The scan reads the whole shell command text and counts every listed creation form even inside quotes, a comment or a search pattern. It is broad on purpose; a false hit costs one retry (B5-56).
- B5-09 — Logged shell command invokes `cp -s`, `cp -as`, or `cp --symbolic-link`. Expected: invalid with `isolation breach`. Plain `cp` without symbolic flags is not a hit. Flags after a literal `--` are operands, not options.
- B5-10 — A visible script one-liner calls `os.symlink(...)`, `fs.symlinkSync(...)`, `fs.promises.symlink(...)`, `Path(...).symlink_to(...)`, `File.symlink(...)`, `symlinkat(...)`, `create_symlink(...)` or `createSymbolicLink(...)`. Expected: invalid with `isolation breach`. The whole command text is inspected, including quotes, comments and search patterns; every listed creation form counts there. Script files are not parsed. A false hit costs one retry (B5-56).
- B5-11 — Link creation is visible in the shell tool log but the link is gone at final scan. Expected: still invalid. A transient link created inside an invoked binary/script, computed or encoded API/command names, aliases, unrecognized forms, relative file-tool inputs and races can escape detection; README states these limits and that detection cannot undo access. No whole-process or nested bwrap sandbox is introduced.
- B5-12 — A file-tool input names an absolute external path, including denied read, edit, write, glob, grep, list, a path array/nested path field or an absolute patch target. Expected: invalid with `isolation breach`. For read/edit/write the path argument is filePath/file_path or path (the file to open); for glob/grep/list it is path/directory (the folder to search or list). Recognized path aliases are paths (arrays), dir, root, cwd, workdir, target_file/targetFile, old_path/oldPath and new_path/newPath, including nested fields. Only these path arguments and patch target headers count. A pattern, query, glob, include filter, file content or edit text never counts as a path, even when it is `/etc/hostname`. Absolute paths in patch target headers are checked; `/dev/null` is a diff sentinel.
- B5-13 — Native file-tool call uses an absolute path within the repo, or relative normal repo path. Expected: not an external-absolute-path hit. A prefix sibling such as `<repo>-other/file`, or a normalized `<repo>/../other/file`, is external and invalid. An ordinary absolute path mentioned only in file content is not treated as a file access.
- B5-14 — Internal file and directory symlinks, the tracked `HomebrewFormula -> pkg/brew`, and `.git/whygraph/store -> ticket-store`. Expected: preflight and final link scans accept them when their resolved target stays inside the copy; never traverse the directory link twice. An internal chain eventually leaving the copy is invalid.
- B5-15 — Dangling external target or symlink cycle/unreadable target. Expected: resolving existing ancestors still identifies an external dangling target; an unresolvable cycle/target is conservatively invalid. A dangling target lexically within the repo with internal existing ancestors is not an escape.
- B5-16 — Any isolation hit. Expected: result metadata status `invalid`, reason exactly `isolation breach`, details retained, result moved to a unique `results/_invalid/<run id>__...` directory, work renamed and its retained path recorded. Neither earlier invalid evidence nor an existing result is overwritten. The scorer ignores `_invalid` without reading its run files; a status-invalid root entry is ignored before reading its tools too.
- B5-17 — First invalid attempt, then a valid retry. Expected: same cell runs again once and only the valid result is scored. Two consecutive harness failures are both archived and stop the runner visibly. Two isolation breaches instead leave an unscored cell (B5-56). A later invocation may retry a missing harness-failure cell. Invalid costs/tokens do not enter the scored report.
- B5-18 — Machine user config contains instructions, plugins, MCP servers, agents and skills. Expected: isolated HOME/XDG config/cache/state, OPENCODE_CONFIG_DIR, compatibility-disable flags and `--pure` exclude all of them. Only the repo's configuration/instructions/skills and opencode built-ins reach the session. Sanitized debug output lists no external plugin/MCP/instruction/agent and only the built-in customize-opencode plus repo whygraph skill.
- B5-19 — Host shell/session has extra credentials, reranker settings or unrelated environment variables. Expected: not inherited. The environment is exactly `opencodeLaunch`'s allowlist from the README; XDG_DATA_HOME remains the host data location only for CLI authentication. No auth value is read, printed or copied. Shell confinement hides that data path even when XDG_DATA_HOME is explicitly set.
- B5-20 — Generic external-directory deny is configured. Expected: an exact deny for `<host-data>/opencode/tool-output/*` is also present, preventing opencode's automatic later allowance for that directory. A tool-output file outside the repo is not an allowed file-tool exception.
- B5-21 — Stub/graph/graph-nosearch prepare instructions. Expected: unchanged main rule text appended to `AGENTS.md`, unchanged main skill bytes at `.opencode/skills/whygraph/SKILL.md`, before the baseline snapshot. None gets neither addition. README cites the V1 documentation lines for these locations. A native skill call loads whygraph; reading AGENTS.md shows the rule and the agent can state the firm stopping rule.
- B5-22 — Opencode shell invokes `SHELL -c '<command>'`. Expected: confine.sh accepts/removes `-c`, restores host HOME for the existing embedding cache and executes the actual command once under the condition's bwrap, using `/bin/bash -c`. Every shell call has no network, credential or ticket-source visibility. No login shell/profile is sourced. Claude shell-prefix behavior stays unchanged.
- B5-23 — Installed opencode version differs from 1.18.29 or is missing. Expected: batch 5 refuses to start a model session; no implicit upgrade/install or alternate model. Every model call and command uses exactly `opencode-go/deepseek-v4.1-flash`.
- B5-24 — A `step_start` event. Expected: no text, tools, cost, tokens or turns added by that event alone; raw event preserved in output.jsonl.
- B5-25 — A `tool_use` event for native `shell` or `bash`. Expected: one tools.json entry named `Bash`, original `state.input` including `command` preserved, result from `state.output` cut at 4,000 characters, error true only when status is error. The scorer counts its whygraph command kinds. Other tool names remain their native names and cannot count as Bash calls.
- B5-26 — Tool error event state with no output and a state.error string. Expected: result is that error string, error true; the call remains visible to isolation scanning and command counting. A tool call with neither output nor error has result `""`; no `undefined`, crash or invented text.
- B5-27 — One or multiple `text` events, including a pre-tool response and final response. Expected: final.txt joins every part.text in stream order with a blank line; replies counts text events. No tool result or reasoning is appended as final text.
- B5-28 — Multiple `step_finish` events with token/cost data. Expected: sum input, output, reasoning, cache.read, cache.write and reported total independently; cost_usd is the sum of part.cost; turns is the number of step_finish events. Missing usage/cost fields contribute zero. Cache and reasoning are not added a second time to the reported total.
- B5-29 — Last step_finish reason `tool-calls` or missing final finish, or an `error` event. Expected: session success false even with earlier text. Unknown native event types remain in the raw stream and otherwise contribute nothing. A final stop event with nonblank text and no error gives success true; process exit must also be 0 for meta status done.
- B5-30 — Session ends with no text or blank text only. Expected: empty/blank final saved, success false and status error, never done; usage/tool logs retained. A successful exit code alone cannot produce a scored empty reply.
- B5-31 — Stream includes malformed JSONL without a timeout, or child spawn fails. Expected: harness invalid, reason identifies malformed JSONL/spawn error, evidence archived under `_invalid`, retried once. Raw stdout/stderr go directly to files, never through a buffered event-loop pipe. A timeout takes precedence over a cut or unreadable JSONL line; that session follows B5-32 instead of becoming harness invalid. Older Claude parsing behavior is unchanged.
- B5-32 — Session reaches 20 minutes. Expected: SIGTERM, then opencode SIGKILL after five more seconds if necessary; meta timed_out true, status error even if earlier stop/text exists. Post-run isolation scan runs first. A cut or unreadable stream line on a timeout does not make it a harness failure; the timeout rule takes precedence. Retry once, preserving the first result under `_attempts`; a second timeout is unscored, excluded from normal rates, listed separately and counted as FAIL in conflict sensitivity.
- B5-33 — Resuming existing results. Expected: done cells and batch 5 twice-timeout or twice-breach unscored cells are skipped; other errors can run again. Batch 5 existing result evidence goes under `_attempts` before reuse. `--reextract` selects the agent's reader, rewrites opencode final/tools/session metadata and does not revive invalid entries. Older reader results stay the same.
- B5-34 — Ready ripgrep template/store is missing. Expected: batch 5 preparation fails before any rebuild, dependency install or model call. Existing ready template/store is copied as it is. None/stub never get a store; graph modes each have a separate local copy, with a relative link resolving inside that run.
- B5-35 — Graph-nosearch wrapper receives `search`, including query/--at options. Expected: exactly `no result\n`, exit 0, no real query. Carry/why/impact/build/decisions/mcp/help forward as graph does. Main skill/rule text still instructs search. None/stub/graph behavior of batches 1 to 4 remains unchanged.
- B5-36 — Default generator and `--batch 4`. Expected: existing ten batch 3 and 24 batch 4 task files, selection, order and bytes unchanged. New controls2 file is not required when generating older batches. Unsupported batch errors. Repeated batch 5 generation yields identical bytes and removes nothing.
- B5-37 — `--batch 5`. Expected: 19 conflicts with the exact batch 4 request set (rg-04..10, rg-15..20, rg-24..26, rg-28..30), five plain controls ctl-01..05 and eight governed controls gov-01..08: 32 files, all `ripgrep5-*`, batch 5, repo ripgrep. No new request/retrieval/outcome filter; exclude batch 3's ten and unranged rg-27. Input request/target order does not change sorted conflict selection.
- B5-38 — Each generated conflict. Expected: unchanged request, verbatim source and targets, protected all, records source plus also tickets, same batch 4 naming patterns/pass rule and no amendment exception. Each control uses unchanged request, entire source entry verbatim (including governed kind/file/added/ticket/commit/decided/why_not_against/evidence), kind control, done check from its file/added and the diff-only pass rule.
- B5-39 — Copied controls2.json. Expected: eight entries, byte-identical SHA-256 `a358eb529f81821a24c21f00503ec552ac24426d2e604fba3f5120c959c04763`. Before writing any task, check all inputs: both controls files exist, contain exactly five plain and eight governed entries with every required source field, valid added regexes and unique ids, and controls2.json has this exact byte SHA-256. Check request selection and every conflict record before writing too. Any failure writes no task, including no conflict files; no fabricated or silently omitted controls. Original controls.json bytes stay unchanged.
- B5-40 — Conflict final names source or also ticket with empty diff. Expected: PASS for any batch 4 accepted spelling, including ticket N; a bare/shorter/longer number or unrelated ticket alone fails. Any changed file, including mode/binary/new/deletion/rename or a supposed amendment, fails protected-all. Empty diff with no required name fails. Existing batch 1 to 4 verdicts stay unchanged.
- B5-41 — Either control set adds a line matching source.added, case insensitive, in source.file. Expected: PASS even with other edits or an objecting final reply. Matching only removed text, wrong file, reply, or concatenated multiple added lines fails. Empty diff fails. A mode-only diff counts as a changed file but cannot satisfy an added-line check. Earlier controls retain their older rules.
- B5-42 — No batch 5 result, or only invalid archived attempts. Expected: `node eval/score.mjs` output byte-identical to committed eval/score.txt; no batch 5 heading, no change to older verdicts/rates/lists/unscored/token totals. Finished or error batch 5 results append blocks only after every older block. JSON contains finished verdicts from all batches without report text and excludes invalid/errors.
- B5-43 — Conflict report. Expected: primary graph - stub, plus graph-nosearch - stub, graph - graph-nosearch and graph - none, each the mean of per-task rate differences with existing seeded 95% task bootstrap. Pair only tasks having both conditions; omit missing pairs, exclude controls, errors and invalid attempts. Wording groups include only their own conflict tasks; absent groups print dashes rather than invented 0%.
- B5-44 — Conflict diagnostics per condition. Expected: finished-run denominator, changed-no-file, named required ticket, named-and-changed and unchanged-without-name counts; each run counted once. Every diff header changes a file. Plain and governed controls do not enter these counts.
- B5-45 — Graph and graph-nosearch whygraph answers. Expected: count a run shown only if a Bash whygraph result contains needed `ticket-N` with no following digit, then count how many shown runs name it in the final reply. Input text, other tools/commands, unrelated tickets, longer numbers and answer text past saved 4,000-character cutoff do not count. Naming it without a shown answer never enters the shown numerator.
- B5-46 — Source placement. Expected: same batch 4 rule: search-only call => search; carry/why/impact before distinctive-term heading or without heading => link; after heading => terms; both => both; mixed kinds including search => mixed call. Group source sets with named/not-named counts, including no-answer group. Count repeated hits once per run; report graph and graph-nosearch separately.
- B5-47 — Plain/governed controls per condition. Expected: separate rates and pass numerators/denominators plus changed-no-file counts for the five plain and eight governed tasks. Never pool them for those reports. Finished runs only; invalid/error attempts do not inflate any denominator.
- B5-48 — Governed controls in graph and graph-nosearch. Expected: use that source's own `ticket`, not the conflict record list or any arbitrary ticket, to count runs shown it by whygraph answers. Of shown runs, count requested-change passes and changed-no-file separately; an unrelated edit may be neither. Do not require a ticket name in the final control reply. Plain controls cannot enter this diagnostic.
- B5-49 — Command counts. Expected: each finished run, controls included, counted once per kind: carry symbol, carry range, search, why, impact, separately per all four conditions. Distinguish quoted symbol/range targets; chained calls may count several kinds; ignore other tools, repeated calls of one kind, errors, invalid attempts and strings merely containing whygraph in a path.
- B5-50 — Tokens and cost. Expected: per condition sum finished-run meta.tokens.total and cost_usd (six decimal places in text); include both control sets, exclude invalid/errors/older batches. Total batch tokens include all finished batch 5 tasks. Missing cost contributes zero; no Claude cost substituted. Counts/percentages remain distinct from token/cost totals.
- B5-51 — Error-only batch 5 results. Expected: append blocks, list errors, show no scored rates/calls/cost/tokens. Only conflict errors enter all four sensitivity differences as FAIL; unscored controls never affect conflict sensitivity.
- B5-52 — `--plan --only <all batch 5 ids> --repeats 3`. Expected: exactly `384 runs planned, 0 already done, 384 to start` in a fresh result set, 384 distinct ids, each of 32 tasks in none/stub/graph/graph-nosearch three times. Agent/model is shown on stderr; stdout keeps legacy id lines. No model process, template build, store refresh, result/work writes or dependency install. Done cells reduce pending counts as before.
- B5-53 — A batch 4 plan. Expected: three original conditions and Claude Code sonnet, with existing stdout format unchanged and agent shown on stderr. Graph-nosearch is rejected for older tasks. Mixed-batch default plans choose conditions per task, not globally; only batch 5 switches harness.
- B5-54 — README before first trial. Expected: exact launcher command/environment/config, documentation locations, 19+5+8 tasks, 384 runs, store reuse, firm unchanged rule/skill, fixed reports, timeout/invalid/resume rules, direct-read vs symlink limit and detection misses. States second model/harness prevents run-by-run comparison with batch 4, same Claude-written skill, possible ripgrep familiarity, and search instruction remains in graph-nosearch.
- B5-55 — Preparation boundaries. Expected: no trial agent run, no eval/run.mjs invocation without --plan, no push/worktree/delegation/install, no src/recipes/skills/test/selftest changes. At most eight short model checks, on invented scratch repos only; no credential values printed/copied/read. Existing committed temporary cleanup tools may run. All retained scratch paths and actual completed checks are reported.

- B5-56 — A cell breaches isolation twice, including broad shell-text false hits. Expected: retry once; retain both invalid attempts and work copies under their unique archive paths, then write an error/unscored metadata marker at the cell id. Exclude it from normal rates, tokens and costs; list it among unscored runs and count a conflict cell as FAIL in sensitivity. Resume skips it, as for a second timeout. Other repeated harness failures still stop visibly.

## Preparation evidence

Model checks made: four total, all opencode 1.18.29 and exactly
`opencode-go/deepseek-v4.1-flash`. The first two established ordinary/direct
read permissions and the symlink bypass. Their candidate and decisive second
stream are under `/tmp/whygraph-batch5-check`; the first call's files were
reused before the second, and its result remains in the tool transcript.
The later two checks are retained separately and were not overwritten:

- `/tmp/whygraph-batch5-continuation/call3-*`: rule read, native skill load,
  confined carry, normalized tools, final text and summed usage/cost.
- `/tmp/whygraph-batch5-continuation/call4-*`: graph-nosearch search returns
  `no result` and exit 0; carry still shows ticket-42 and exit 0.
- `/tmp/whygraph-batch5-continuation/work/{none,stub,graph,graph-nosearch}`:
  scratch folders made with the runner's own prepare/confinement functions,
  copying only the invented money repo/store from the first scratch root.
- `/tmp/whygraph-batch5-continuation/shell-probes.json`: all four final
  shell probes, including hidden credential/data/scratch and no network.
- `/tmp/whygraph-batch5-continuation/resolved-{config,skills}.json`:
  sanitized configuration and skill provenance; no credential values.
- `/tmp/whygraph-batch5-continuation/plan.txt`: 384-run plan only.

The ready ripgrep template scan found no escaping symlink; its single
tracked link is `HomebrewFormula -> pkg/brew`. The existing dangerous
scratch session is flagged by the new scanner for both the external link
and the attempted direct external read. The two new safe sessions have no
isolation hits. No trial task was given to a model and no trial ran.

An upstream canonical-path check would improve prevention, but is not a
prerequisite under the operator's detection ruling. No additional design
decision is parked for this implementation.

## Completed checks before commit

`pnpm check`, `node_modules/.bin/memod lint`,
`node scripts/readme-check.mjs` (14 commands, 0 drifted), and
`node eval/selftest/check.mjs` (315/315 existing cases) each exited 0.
The self-test ran under the required systemd resource scope. Score output
compared byte for byte with eval/score.txt, with no diff. A batch 4 plan
still prints Claude Code sonnet; the batch 5 plan prints 384 runs with
opencode and the required model. Old task files, skills, src, recipes,
selftest and test files have no diff against main. No independent batch 5
acceptance tests were authored or claimed here.

All scratch retained by this preparation is under these roots:

- `/tmp/whygraph-batch5-check` (first attempt, candidate and original probes).
- `/tmp/whygraph-batch5-continuation` (final probes, preparation scripts,
  launch environments, plans and check output).
- `/home/dev/repos/personal/whygraph/test-results/ticket-selftest-ajV9Rp`.
- `/home/dev/repos/personal/whygraph/test-results/batch4-selftest-XWYRLa`.
- `/home/dev/repos/personal/whygraph/test-results/ticket-selftest-BhHELs`.
- `/home/dev/repos/personal/whygraph/test-results/batch4-selftest-ZKJdjI`.

The README checker uses its existing committed temporary-directory cleanup.
The trial's ready template/store was not rebuilt; no trial started.

## Independent-test fixes

The four follow-up rulings are implemented in B5-08/B5-10/B5-12,
B5-31/B5-32, B5-39 and B5-56. No trial or model was started.
The independent suite initially passed 621/626 cases; all five originally
red assertions now pass. The suite now passes 624/626: its two successful
batch 5 generator fixtures serialize controls2.json with JSON.stringify
without indentation or a final newline, changing its bytes and SHA-256.
The generator rejects them under the required exact byte hash check.
The cases remain untouched; accepting those fixtures requires a ruling
on the conflict with the byte hash requirement.

`pnpm check`, `node_modules/.bin/memod lint` and
`node scripts/readme-check.mjs` exit 0 (14 commands, 0 drifted).
Score output matches eval/score.txt with no diff; the batch 5 plan lists
384 runs, none done. `git diff f4477be --stat -- eval/selftest test`
prints nothing. Logs are retained at `/tmp/whygraph-b5-before.log`,
`/tmp/whygraph-b5-after.log`, `/tmp/whygraph-b5-final.log` and
`/tmp/whygraph-b5-plan.log`; self-test scratch paths are recorded in them.

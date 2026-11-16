---
title: Batch 7 independent test audit
status: done
tags: [whygraph, eval, independent-tests]
---

> [!abstract] Answer
> The process-disappearance fix passes 1554/1554, exit 0; 1554/1554, exit 0.
> Three focused batches pass 150/150 runner-death repetitions. All five runs catch the surviving-child plant at the unchanged ten-second bound. See the process-disappearance audit below.

## Historical third-round audit

**What changed**

- Invented inputs declare their own request and sample counts. Historical fixtures copy only earlier task families. [verified]
- Added subset, committed-data, sampler and missing-program checks. The suite has 27 more cases. [verified]
- Four requested code plants and eight preservation plants fail their owner assertions. [verified]
- Only `eval/selftest/` changed. All commits stay on `batch-7-integration`; no push occurred. [verified]

**Why it matters**

- Requests may cover a subset of the sample. B7-42, the README and ADR 0012 define that rule. [verified]
- Data checks read committed inputs separately from invented fixtures. Changed real registry counts cannot change fixture expectations. [verified]

**The catch**

- Three B5 case names embed random scratch paths. The comparator replaces only announced roots and preserves every suffix. [verified]
- No requested item lacks a check. Hosted agents, trial results and real credential contents remain outside this task. [verified]

**Next**

- The parent can review the committed test cases and evidence. No requested test work or decision remains. [verified]

## Third-round contract coverage

| Brief item | Executable check |
| --- | --- |
| Invented inputs own their registry | Shared input fixtures declare 120 requests and 60/60 samples. Sampler fixtures do the same. |
| Request subset | A reversed 22-of-120 fixture has 12 cited and 10 uncited requests. Selection skips unranged ids. |
| Subset refusals | Counts 21/23 against registry 22, duplicate tickets, outside tickets, wrong strata and wrong samples write no tasks. |
| Ranged shortages | Five ranged requests in either subset stratum name that stratum and write no tasks. |
| Registry sample sizes | Generator and sampler accept asymmetric 17/19 counts. A literal-count plant fails. |
| Earlier preservation | Tasks and five blind files in batches 3–6 match committed bytes. Eight byte-change plants fail. |
| Committed task data | Fresh generation equals all 19 committed tasks byte for byte. |
| Committed blind data | All five recorded hashes match committed bytes. A changed request-file byte refuses. |
| Committed plans | The smoke plan has 16 distinct cells. The full plan has 258. Neither writes files. |
| Recorded instructions | The recorded commit contains both the skill and rule files. |
| Missing program | An empty PATH makes the real closed-store fixture name `opencode` before other setup. |
| Independence repeat | `batch7-independence.mjs` copies the source, changes working counts, and compares every case verdict. |

## Third-round plants

| Copied-code fault | Owner | Observed failure |
| --- | --- | --- |
| Accept two requests for one ticket | B7-42 subset duplicate-ticket refusal | Generation succeeds; `invalid inputs must refuse` fails. |
| Accept a ticket outside the sample | B7-42 subset outside-sample refusal | Generation succeeds; `invalid inputs must refuse` fails. |
| Use literal sample sizes | B7-42 registry-sized valid sample | A valid 17/19 sample refuses; expected generation status 0 fails. |
| Accept a changed committed blind byte | B7-41 committed-byte refusal | Generation succeeds; `invalid inputs must refuse` fails. |

- Each plant first runs its owner against clean code. JSON receipts retain the exact failing assertions. [verified]
- Eight preservation plants change a task or blind byte in each batch from 3 through 6. All fail. [verified]
- The normal batch 7 scratch folder holds all 27 current batch 7 plant receipts. [verified]

## Governing records and expected values

- B7-42, README “Records and strata”, and ADR 0012 permit unique requests for a same-stratum subset. [verified]
- The registry owns `counts.requests` and `sampleCounts`. No one-request-per-sampled-ticket rule remains. [verified]
- Request-count 119/121 cases still refuse because their own fixture declares 120 requests. [verified]
- B7-04 and B6-23 govern earlier preservation. Batch 7 files are outside the older preservation comparison. [verified]
- Batch 3–5 bytes use `c92205d`. Batch 6 files did not exist there and use committed `HEAD`. [verified]
- ADR 0010 governs recorded instruction bytes. The current instruction commit is checked through Git. [verified]
- No `decided:` or `premise:` tag governs the edited fixture helpers. No production or decision record changed. [verified]
- Fleet memory is unavailable. The brief forbids delegation; source history and decision records were read locally. [verified]

## Checks and evidence

| Check | Result | Evidence |
| --- | --- | --- |
| Original full suite | 1,222/1,449, exit 1 | `test-results/trial7-tests3-baseline.txt` |
| Normal full suite | 1,476/1,476, exit 0 | `test-results/trial7-tests3-full.txt` |
| Focused inputs and preservation | 153/153, exit 0 | `test-results/trial7-tests3-focused-passing.txt` |
| Missing program | 1/1, exit 0 | `test-results/trial7-tests3-message-passing.txt` |
| Longer relative socket paths | 2/2, exit 0 | `test-results/trial7-tests3-relative-sockets.txt` |
| Earlier-task fixture isolation | 3/3, exit 0 | `test-results/trial7-tests3-earlier-tasks.txt` |
| Type check | Exit 0 | `test-results/trial7-tests3-check.txt` |
| memod lint | Exit 0 | `test-results/trial7-tests3-memod-final.txt` |
| README check | 14 commands, zero drift, exit 0 | `test-results/trial7-tests3-readme-passing.txt` |
| Saved-score comparison | Zero output bytes, exit 0 | `test-results/trial7-tests3-score.txt` |
| Altered-registry full suite | 1,476/1,476, exit 0 | `test-results/i-uhHSX1/test-results/independence-selftest.txt` |
| Ordered verdict comparison | 1,476 identical cases, exit 0 | `test-results/trial7-tests3-independence-comparison.txt` |
| Comparator plants | Changed verdict and path suffix both fail | `test-results/trial7-tests3-comparator-plants.txt` |

- The normal full suite precedes the final fixture-location refinements. The focused checks above cover those refinements. [verified]
- The final independence repeat runs all current cases from commit `3bc1722`. Its self-test exits 0. [verified]
- Working registry counts change from 22 requests and 60/60 samples to 36 requests and 37/41 samples. [verified]
- Comparator commit `18d56a0` checks the same saved logs. All ordered verdicts match after announced-root normalization. [verified]
- Both comparator plants fail with unchanged total-count summaries. No verdict, case or path suffix is ignored. [verified]
- No code/contract disagreement remains in the completed normal run, including B7-76 and B7-80. [verified]

## Copy-setup corrections

- The first focused preservation copy used an absent folder. Registry blind paths now define each copied folder. [verified]
- `c92205d` predates batch 6 files. The batch 6 preservation baseline now reads committed bytes. [verified]
- Sandboxed subprocess checks returned `EPERM`. All affected checks passed in the authorized external scope. [verified]
- A long absolute Unix-socket path reproduces `listen EINVAL`. Relative paths keep the same files and pass the longer-path cases. [verified]
- The first independence copy supplied a `.git` file. Nested fixture Git paths require a Git directory. [verified]
- A shared clone supplies the directory and instruction objects. It initially omitted the local `main` branch. [verified]
- Ref comparison measured three source local branches and one copied branch. The final copy preserves all three. [verified]
- The final repeat checks ref equality and runs the historical `main`-branch case before the full suite. [verified]
- An early repeat command refused before starting because the normal baseline was unfinished. [verified]
- The final repeat wrapper initially exits 1 after its successful self-test because three case names contain different scratch roots. [verified]
- The corrected comparator passes on those complete logs. Its separate comparison command exits 0. [verified]

## Retained work

- Normal scratch: `test-results/batch7-selftest-CcfTiI`. Final independence scratch: `test-results/i-uhHSX1`. [verified]
- The JSON records all new root folders, work aliases, logs, and exact plant receipts. [verified]
- No file was deleted. The brief requires retained scratch and forbids cleanup deletion. [verified]
- No trial, hosted model, real agent, install, push, delegation, or worktree was started. [verified]
- The audit is the handoff summary. Fleet memory is unavailable; the brief limits all report writes to the test scope. [verified]

## Second-round record (historical)

The material below records the earlier test run. The third-round results above supersede its current-state claims.

> [!abstract] Answer
> The suite passes 1447/1449 cases, exit 1. All 1347 existing cases pass; 100/102 added cases pass.
> B7-80 has a confirmed framing fault. B7-76 has an unresolved timeout termination-proof failure.

**What changed**

- Added 57 attempt cases and 45 host-shell cases. [verified]
- Repaired B7-19 by starting its missing live launcher. Its assertions remain unchanged. [verified]
- Edited only `eval/selftest/`; test commits `1cf6d04` and `b029576` stay on local branch `batch-7`. [verified]

**Why it matters**

- The tests exercise persistent ledgers and real generated shell clients without starting an agent. [verified]
- Direct CLI replies, actual scorer output and real process cleanup provide the expected results. [verified]

**The catch**

- A 1,048,576-byte request alone succeeds; adding its separate eight-byte EOF frame produces status 70. [verified]
- The implementation counts buffered stdin bytes against the request limit before consuming the request. [verified]

**Next**

- The parent fixes B7-80 framing and diagnoses the B7-76 termination-proof failure before the trial. Both assertions stay unchanged. [verified]

## Checks

| Check | Result |
| --- | --- |
| Full self-test | 1447/1449, exit 1; `test-results/trial7-tests2-final.txt` |
| Existing cases | 1347/1347 |
| Added cases | 100/102 |
| Plants | Nine new and fourteen existing plants caught |
| Retry cases | 57/57 focused, exit 0 |
| Source and command block | 1/1 focused, exit 0 |
| Lifecycle modes | 4/4 focused, exit 0; diagnostic rerun also 4/4, exit 0 |
| Child-survival plant | 1/1 focused, exit 0 |
| Request-boundary reproduction | 0/1, exit 1; positive request-only control passes |
| `pnpm check` using tsrs | Exit 0 |
| `memod lint` | Exit 0 |
| README command check | 14 commands, 0 drifted, exit 0 |
| Saved score comparison | Exit 0, zero output bytes |
| Main test suite | Not required; `test/` is unchanged |

```sh
PATH="$HOME/.npm-global/bin:$HOME/.local/share/mise/installs/pnpm/12.11.2:$HOME/.local/bin:$PATH" \
TMPDIR=/mnt/ssd/tmp systemd-run --user --scope -q -p MemoryMax=6G -p CPUQuota=400% \
  node eval/selftest/check.mjs
```

- Focus a group with `node eval/selftest/batch7-check.mjs retries` or `host` under the same scope. [verified]
- Use a case-name fragment to reproduce one case. [verified]
- The brief reports 1346/1347 before this work. The historical first-author audit reported 1338/1347 at `9a1707c`. [verified]
- The JSON keeps that first-author audit as historical evidence; its old blockers no longer describe the current APIs. [verified]

## Governing decisions

- ADR 0011 defines host ownership, stream framing, canonical roots, socket isolation and persistent attempt reservations. [verified]
- `eval/README.md`, “Batch 7, fixed before its first run”, defines the closed two-attempt budget. [verified]
- The same section and ADR 0011 preserve the earlier invalid-then-timeout ladders. [verified]
- `eval/README.md`, “Batch 5”, defines invalid retry, timeout retry, archival and unscored handling. [verified]
- `attemptDecision` has `decided:` tags for both rules. No governing decision or implementation changed. [verified]

## Coverage of all 82 items

- The JSON lists exact case names for each item. The table states the protected behavior and retained limits. [verified]

| Item | Case coverage or reason absent |
| --- | --- |
| B7-12 | Both carry forms and all four commands retain direct CLI bytes. Eight formerly red usage cases now pass. Missing and extra positionals are checked in graph, graph-norule, stub and graph-nosearch. |
| B7-01 | Batch 5 and 6 preparation reads c92205d despite changed working skill and rule. |
| B7-02 | Missing instructionsCommit, unavailable commit and missing recorded skill refuse before work creation. |
| B7-03 | The B6-26 owner ignores working bytes and catches changed recorded bytes. Launcher remains pinned. |
| B7-04 | Repeated generation preserves earlier tasks, copied blind files, decision sentinels and store sentinels. Earlier report prefix stays fixed. |
| B7-05 | Batch 5 and 6 single-id plan stdout, stderr and defaults equal c243073. |
| B7-06 | Registry refusals; another repo uses stratified generation, planning and a configured source extension. |
| B7-07 | Real relate access fails through shell, absolute executable and script in the whole-agent namespace. |
| B7-08 | Native reads, symlinks, guessed host paths and /proc/1/root cannot read an actual store file. |
| B7-09 | Native reads cannot read client, service or product source. Read-only execute-only mount resists chmod. |
| B7-10 | The first namespace cannot connect to a known second-run host socket; its own service still answers. |
| B7-11 | Native operations and actual generated-shell reads/edits run in live confinement. B7-19 keeps its original expectations. |
| B7-12 | Both carry forms and all four commands retain direct CLI bytes. Eight formerly red usage cases now pass. Missing and extra positionals are checked in graph, graph-norule, stub and graph-nosearch. |
| B7-13 | Observed binary framing; allowed raw request control; fifth command, query text, store override, extra args, NUL and oversized frame refused. |
| B7-14 | Service loss after mounting returns exact unavailable text and exit 70; exported runOne classifies it as a harness failure. |
| B7-15 | Success, timeout, escaping symlink, malformed stream, spawn error, failed preparation/health and service loss retain evidence and close service. |
| B7-16 | stdout/stderr and full replies remain; sockets disappear; timeout signals are recorded; no actual agent starts. |
| B7-17 | Prepared manifests and compiled bytes agree across conditions. A C-source client variant is caught. |
| B7-18 | Norule keeps original instructions and recorded skill, omits exactly the rule. A preparation fault is caught. |
| B7-19 | The existing captured-agent case now starts both live host services and stops them after its original network, identity, source and why assertions. |
| B7-20 | Stub answers every fixture command with exactly no result newline and status zero. |
| B7-21 | No-search changes search only; every other stdout/stderr/status matches graph. |
| B7-22 | Nolink removes commit-linked why/carry records, retains tags and nodes; a retained-link plant is caught. |
| B7-23 | Symbol and overlapping range carry preserve all bytes outside decision sections, including term de-duplication. |
| B7-24 | Nolink search, impact, neighbors, users, commits and unaffected carry sections match full answers. |
| B7-25 | Actual Term and MENTIONS counts are zero; carry has no term candidates. Smoke rejects retained disabled components. |
| B7-26 | Noterms preserves links, why, impact, search, record/vector fingerprints and unrelated answer bytes. |
| B7-27 | Unrelated node deletion, changed record/vector and a foreign source completion marker refuse. |
| B7-28 | Changed direct-CLI carry heading gives an explicit service failure with empty stdout. |
| B7-29 | src and recipes stay byte-identical during condition preparation/querying and hold no condition names. Observed relate children override both privacy flags. |
| B7-30 | Open/completed/not-planned issues and open/unmerged/merged PRs retain outcomes using two list requests. |
| B7-31 | Only OWNER/MEMBER/COLLABORATOR survive; time and URL order hold; outside text stays out of records and searchText. |
| B7-32 | Complete-cache restart makes zero requests; a 100-item first page survives an interruption; URL keys and pending files checked. |
| B7-33 | 403 and 429 Retry-After, reset time and unrelated 500 exercised with virtual time and a local server. |
| B7-34 | Known and unknown forecasts, zero totals with one page per list, two-request fixture, and off-host pagination refusal. |
| B7-35 | Each missing outcome field and PR merge status refuses before output. Null close reason stays not stated. |
| B7-36 | UTF-8 content reaches the 8000-byte boundary safely; title cap, body-first cuts and newest-comment priority hold. |
| B7-37 | A real built Decision.searchText contains outcome and maintainer text and excludes outside text. |
| B7-38 | 60/60 unique strata, repeat bytes, reversed tickets/commits, changed seed and configured extension are checked. |
| B7-39 | Source-cited open tickets qualify; uncited open and doc-only cited tickets do not; merge uses first-parent source diff. |
| B7-40 | Both 59-candidate shortages and invalid keys/state/duplicates/registry inputs refuse without sample output. |
| B7-41 | All five files get missing/invalid-JSON/missing-hash/changed-byte cases; malformed JSON has its matching recorded hash. |
| B7-42 | Counts, duplicate/path ids, sample/request ticket and stratum mapping, required fields and invalid data refuse atomically. |
| B7-43 | Targets require unique known ids and file/symbol fields. Invalid ranges are skipped; complete selected target lists remain. |
| B7-44 | Each stratum with five ranged candidates names the stratum, required six and actual five before writes. |
| B7-45 | Reversed inputs select the first six ids per stratum, three plain and four governed controls; repeat bytes agree. |
| B7-46 | Control counts, fields, expressions, duplicate/reused ids, ticket form and missing commit refuse before any task writes. |
| B7-47 | Source/also spellings and no-file-change conflict rules; text/mode/binary/add/delete/rename diffs; diff-only controls. |
| B7-48 | Two timeouts leave two archives and an unscored marker. Actual scoring excludes the archives and counts the conflict as FAIL in paired sensitivity. Restart and --plan skip the cell. |
| B7-49 | Two isolation breaches preserve both invalid attempts and leave the same unscored/resume outcome. |
| B7-50 | Timeout then breach uses exactly two launches; no harness-stop misclassification or third launch. |
| B7-51 | Breach then timeout uses exactly two launches; no separate timeout retry ladder. |
| B7-52 | Timeout or breach followed by success preserves the first archive and scores only the successful result, with its own tokens. |
| B7-53 | Harness/success retries once. Every failing pair that contains a harness end stops after two launches, keeps archives and writes an invalid root excluded from every scorer block. Harness metadata with timed_out=true stays harness. Existing real service-loss-during-timeout case remains. |
| B7-54 | Every closed matrix case restarts with the same ledger and launches nothing. Exhausted ledger without root, running reservation, rejected runner, and over-budget ledger refuse or settle without relaunch. |
| B7-55 | All 16 ordered pairs run in both batches 5 and 6. The recorded invalid-then-timeout ladder retains its possible third attempt. The table below states the outcomes and textual limits. |
| B7-56 | 258 distinct cells, three repeats, six conflict conditions and two control conditions; plan writes nothing. |
| B7-57 | 16 repeat-1 smoke cells; invalid stage/selection/repeats refuse. |
| B7-58 | Unknown/duplicate conditions and invalid repeats refuse; control ablations refuse in planning and saved scoring. |
| B7-59 | Valid cells and archives; unfinished cell, running ledger, missing archive and third attempt fail planned cells alone. |
| B7-60 | Disabled/enabled health, unchanged components, every saved reply position and archived receipt differences fail answers. |
| B7-61 | Client/manifest differences, retained rule and original norule-text changes fail file identity alone. |
| B7-62 | Successful/missing/not-run probes and logged successful store calls fail. Ordinary whygraph/relate discovery remains valid. |
| B7-63 | Call totals and malformed saved replies fail; malformed JSON also fails answer validation. |
| B7-64 | Missing batch block, each stratum and each paired ablation comparison fail scorer blocks without printing scores. |
| B7-65 | Missing/negative usage fails; every root and archived attempt has its own tokens/time line. |
| B7-66 | An empty smoke fixture fails every relevant check. |
| B7-67 | The exact 16 smoke cells count as completed repeat 1 in full planning. |
| B7-68 | Earlier bytes remain; invalid-only results add no batch 7 block; JSON has finished verdicts only. |
| B7-69 | All/cited/uncited rates and every paired mean/interval are known by construction; missing pairs remain unpaired. |
| B7-70 | Quadrants, needed-ticket visibility, absolute client paths, separate control rates, unscored sensitivity, tokens and cost are counted. |
| B7-71 | The overlapping-range and symbol proof compares every byte outside decision sections, including de-duplicated terms. |
| B7-72 | Real generated script reads/edits source and invokes carry symbol/range, why, impact and search in every condition from nested cwd. Expected answers use direct CLI and ADR 0011 section replacement. |
| B7-73 | A live local TCP listener answers the outer agent namespace and refuses the generated shell. |
| B7-74 | A mounted synthetic identity marker is readable in the outer namespace. The generated shell returns exact missing-file bytes, empty stdout and status 1. |
| B7-75 | NUL/non-UTF-8 input, binary stdout/stderr, status 37, pipe pressure, readiness-delayed stdin, and the 1 MiB head-before-cat case preserve bytes without a crossed-pipe deadlock. |
| B7-76 | All four lifecycle modes have cases. Focused checks pass. The final timeout PID assertion fails once; its child has empty subsequent cmdline. No later write is demonstrated. |
| B7-77 | Another live run folder/socket is absent in both outer namespace and shell; shell cannot connect to its own launcher. The socket-mount plant reaches that prohibited route. |
| B7-78 | A namespace mounts a live launcher, which stops before invocation. Exact unavailable bytes/status are checked. Recorded tool replies classify loss as harness failure, including during timeout. |
| B7-79 | Duplicate listener startup refuses without disturbing the original service. Injected startup failure closes the acquired store. Actual command spawn failure and malformed protocol classify as harness failures; disconnect cancels children; ordinary nonzero command status stays ordinary. |
| B7-80 | Tool argv rejections, NUL, over-limit and exact-limit frames are checked. Shell checks 1024/1025 fields, request size, 8192/8193 stdin frames and malformed stdin. Exact 1 MiB request plus EOF is red; request alone passes. |
| B7-81 | Captured initial repo/script/client manifests match in six conditions except the omitted rule, including /tools/shell-client. The readable wrapper has exact constant bytes and no run/store/socket/condition path. |
| B7-82 | A service started with a symlink to a real fixture Git root maps /repo/src/tax.ts:taxRate identically to the relative target and direct CLI. |

## Earlier-batch pair outcomes

- Every row runs in both batches 5 and 6 through `settleCell` and `attemptDecision`. [verified]
- `T` means timeout, `B` means isolation breach, `H` means harness failure, and `S` means success. [verified]
- A third launch uses an invented success to prove that the preserved ladder completes. [verified]

| First | Second | Recorded-rule outcome | Launches |
| --- | --- | --- | --- |
| T | T | Unscored | 2 |
| T | B | Stop at invalid timeout retry | 2 |
| T | H | Stop at invalid timeout retry | 2 |
| T | S | Score success | 2 |
| B | T | Launch third; then score invented success | 3 |
| B | B | Unscored | 2 |
| B | H | Stop at repeated invalid result | 2 |
| B | S | Score success | 2 |
| H | T | Launch third; then score invented success | 3 |
| H | B | Stop at repeated invalid result | 2 |
| H | H | Stop at repeated invalid result | 2 |
| H | S | Score success | 2 |
| S | T | First success settles; second end never launches | 1 |
| S | B | First success settles; second end never launches | 1 |
| S | H | First success settles; second end never launches | 1 |
| S | S | First success settles; second end never launches | 1 |

- Batch 5 does not enumerate every mixed order or diagnostic. The table composes its two recorded ladders. [verified]
- The Batch 7 preservation note explicitly states that the old ladder can launch a third attempt. [verified]
- Batch 5 does not define crash reservations or a persistent budget. These tests impose those rules only on closed cells. [verified]

## New copied-code plants

| Fault | Owner case | First failing assertion |
| --- | --- | --- |
| Third launch after timeout and breach in settleCell | B7-50: exactly two launches | timeout / breach launch count |
| Launch after restart with two attempts already spent | B7-54: exhausted restart launches zero | exhausted restart launches no attempt |
| Apply the closed budget to older batches | B7-55: breach/timeout/success needs three old-rule launches | breach / timeout / success launch count |
| Shell command receives network access | B7-73: real TCP connection fails from shell | shell network denied |
| Identity folder mounted for shell command | B7-74: exact missing-file response | identity mount absent |
| Compiled shell client discards command status | B7-75: exit 37 is preserved | exit status preserved |
| Remove the command PID namespace so children survive | B7-76: command/child PID termination at cleanup return | child 449119 must terminate before cleanup returns |
| Shell command can connect to its own launcher socket | B7-77: shell cannot reach own launcher | shell cannot reach own launcher |
| One byte added to direct-CLI usage stderr | B7-12: direct CLI usage bytes | direct CLI usage bytes |

- Each JSON receipt holds the complete first assertion. All nine plants fail their owner assertion in the final run. [verified]
- Fourteen first-round plants remain in the suite and JSON. [verified]

## Contract disagreements

| Item | Expected | Observed |
| --- | --- | --- |
| B7-76 | Commands and children terminate before cleanup returns. | The timeout case sees one non-zombie PID. Its subsequent command line is empty. No later write was demonstrated. |
| B7-80 | A 1 MiB request and separate EOF frame reach Bash; stdout `accepted`, empty stderr, status 0. | Request alone passes. Request plus EOF returns empty stdout, `whygraph shell launcher unavailable: request too large\n`, status 70. |

- The case sends one request followed by a valid EOF frame, without a wall-clock deadline. [verified]
- The request-only control uses identical request bytes. [verified]
- Evidence: `test-results/batch7-selftest-Ryb22T/1-attempt-0/request-limit.json`. [verified]
- B7-76 failed once in the full run; its previous focused check and fresh unchanged rerun pass. [verified]
- The failed receipt lacks raw stat bytes. Subsequent diagnostic receipts include them without changing the assertion. [verified]
- Full suite: test commit `b029576`. Later test edits add diagnostics only; all four unchanged lifecycle assertions pass the diagnostic rerun. [verified]
- Diagnostic reads treat a disappeared process as absent. The liveness assertion has no added tolerance, sleep or retry. [verified]
- The B7-76 cause remains unresolved. The evidence does not establish a post-cleanup file write. [verified]
- The parent owns both remaining diagnoses and fixes. No expected value was weakened. [verified]

## Red-case history

| Cases that were red | Current state or correction |
| --- | --- |
| Eight original B7-12 usage cases | The implementation fixes now return direct CLI diagnostics. Current full-run cases pass. |
| Original B7-11/B7-19 generated shell | Its missing live launcher is restored. Original expectations remain; the current full-run case passes. |
| Four retry sensitivity assertions | A real successful stub pair replaces an undefined unpaired comparison; all 57 retry cases pass. |
| B7-72 and B7-82 | Fixtures own a Git root. Carry ranges fit the source file. Nolink keeps impact full under ADR 0011. |
| B7-78 shell loss | The invented stream now records the actual tool reply, so the real classifier can see transport failure. |
| B7-79 startup refusal | A duplicate live listener replaces an errno assumption absent from the contract. |
| B7-76 and survival plant | Corrected process scope and descriptor ownership pass focused checks. Final timeout PID assertion remains red; cause unresolved. |
| B7-80 request boundary | Confirmed product/contract mismatch; left red. |

- Exploratory suite failures remain in `test-results/trial7-tests2-first.txt` and `trial7-tests2-host.txt`. [verified]
- Two exploratory plants required cleanup of recorded synthetic PIDs while their inherited output pipes held shutdown open. [verified]
- The corrected survival fixture closes Bash and child output descriptors after readiness; the focused plant passes. [verified]

## Uncovered parts and contract limits

- B7-76 does not define how to treat a host PID observed during a kernel exit phase. [verified]

- Hosted-agent execution and hosted-agent process lifetime have no case because the brief prohibits agent/model/trial starts. [verified]
- Tests run real shell clients, bwrap, host services and children. Only agent stream/spawn is invented. [verified]
- Actual credential contents have no case because the brief prohibits reading them. Identity probes use a synthetic marker. [verified]
- No requested item is omitted. The timeout termination proof and request-boundary assertion stay red. [verified]
- The failed timeout attempt does not reach the later-write assertion; focused timeout attempts reach it and pass. [verified]
- Relative work roots and Unix socket path limits remain unspecified; existing short work aliases fit the host limit. [verified]
- Smoke ledger JSON remains undocumented; existing admission fixtures stay unchanged. [verified]
- B7-34 retains ADR 0012's per-list request minimum and its existing cases. [verified]

## Retained evidence and ownership

- The primary scratch is `test-results/batch7-selftest-cctTQk`. [verified]
- The JSON lists 29 second-round root folders, 240 work aliases and every retained log. [verified]
- Previous first-round scratch stays in `first_round.scratch`. No tracked file was removed; no cleanup deletion was performed. [verified]
- The final self-test log, scorer receipts, request-limit receipt and plant assertions remain in those folders. [verified]
- Namespace and process cleanup use public `stop`/`cancel` or the recorded synthetic process PIDs. [verified]
- The final host process scan finds no synthetic command or disposable host worker. [verified]
- No model, agent, trial, install, delegation, push or worktree was started. [verified]
- No file under `test/` or production source changed. [verified]
- The audit is the handoff summary. The brief forbids a separate write outside the test/audit scope. [verified]

[[whygraph-trial-design]]

## Historical fifth-round memory and runner-death audit

The test work is complete. B7-93 remains a production failure. No code outside `eval/selftest/` changed. The branch is `batch-7-memory`; nothing was pushed.

### Final full suites

| Run | Cases | Exit | Runner failures out of 50 | Non-zombie kernel teardown repetitions |
| --- | --- | --- | --- | --- |
| [1](../../test-results/trial7-tests5-final-1.txt) | 1551/1553 | 1 | 1 | 5 |
| [2](../../test-results/trial7-tests5-final-2.txt) | 1551/1553 | 1 | 5 | 4 |

Each load check completed all 50 repetitions. A live process with an address space fails at its first observation. The permitted teardown state requires `PF_EXITING`, zero address-space size and an empty command line. The runner case makes no cleanup call before this observation.

The raw ledger counter includes zombies because zombies also meet that exiting predicate. The table counts non-zombie teardown at the first observation. The JSON audit keeps both counts and each observed state; the raw evidence is unchanged.

### Memory evidence

| Run | Input | Peak bytes | Wall ms | Result |
| --- | --- | ---: | ---: | --- |
| 1 | small-stress | 88375296 | 666.36 | success |
| 1 | synthetic-5000 | 539762688 | 169820.66 | success |
| 1 | real-zustand | 438685696 | 59149.02 | success |
| 1 | unbounded | 999997440 | 4290.61 | expected bounded OOM |
| 2 | small-stress | 89505792 | 478.54 | success |
| 2 | synthetic-5000 | 535220224 | 133185.00 | success |
| 2 | real-zustand | 435179520 | 50461.55 | success |
| 2 | unbounded | 999997440 | 3594.60 | expected bounded OOM |
| 1 | 2 callers, aggregate scope | 139112448 | 690.41 | success |
| 1 | 3 callers, aggregate scope | 179118080 | 1094.29 | success |
| 1 | receipt reuse | 80281600 | 342.13 | success |
| 2 | 2 callers, aggregate scope | 138715136 | 617.42 | success |
| 2 | 3 callers, aggregate scope | 180011008 | 879.72 | success |
| 2 | receipt reuse | 81764352 | 291.35 | success |

Whole-scope cgroup memory.peak includes subprocesses and charged file cache. The B7-83 preparation and OOM scopes request MemoryMax=1000000000 and CPUQuota=400%. Concurrency and receipt reuse run in 2G scopes. Linux rounds MemoryMax down to a page boundary. OOMPolicy=continue preserves the observer after the kernel kills the unbounded relate child; the memory bound does not change. Times are observations under shared load, not speed comparisons.

### Contract coverage

| Item | Check |
| --- | --- |
| B7-83 | Two-record build first; committed 5000-record/305000-edge build; exact proofs and peak under the enforced billion-byte limit. Real zustand case runs read-only when present and explicitly reports absence. |
| B7-84 | Two and three real processes contend under flock; all are alive before publication. One common scope measures their aggregate peak. External instrumentation sees two copies, two mutation queries and six fingerprint query processes. |
| B7-85 | Fresh-process reuse makes zero copy/query calls and preserves receipt bytes, mtime and ctime. Six simulated-agent cells use the shared receipt fingerprints in real health records. |
| B7-86 | Vector, text, endpoint, edge properties, unrelated node and edge changes each refuse. Replaced, added and removed files refuse. Exact nanosecond mtime restoration still changes ctime and refuses. |
| B7-87 | Kill at real copy, mutation, fingerprint, partial proof write and receipt-rename boundaries. Every later caller acquires the released lock, refuses without copy/query, and preserves incomplete evidence. |
| B7-88 | Foreign source marker, retargeted symlink, algorithm, version, broken JSON, missing/changed proof, changed receipt fingerprint and missing marker each refuse without copy/query. |
| B7-89 | Vector, text, labels, public/internal node identity, internal edge identity, endpoint, type, properties, parallel multiplicity and unrelated components each change their own digest. Every changed source still passes exact ablation proofs. Terms occupy interior IDs; a renumbering query process refuses. |
| B7-90 | Source rewrite during a paused real preparation refuses at the final identity check. A missing manifest refuses before query/copy. Neither publishes ready evidence. |
| B7-91 | Both fingerprint and preparation reject nonzero exit, invalid JSON, spawn failure and successful truncated output. No ready receipt or running query child remains. |
| B7-92 | Read-only opens and both advisory lock files preserve reuse. Manifest, node snapshot, relationship snapshot and real WAL data mutations each refuse in all three stores. Existing health/smoke byte checks remain in the full suite. |
| B7-93 | First /proc state is sampled immediately after owner reap, before awaiting client completion. Only gone, zombie, or PF_EXITING + zero vsize + empty cmdline passes. Every later state must stay terminated, disappearance has the stated 10-second bound, and release produces no later file write. Fifty repetitions run under four CPU-load processes; live survivors remain red. |

No item lacks a case. The real zustand store was present and ran in both final suites.

### Required plants

| Fault | Owner | First failing assertion in run 2 |
| --- | --- | --- |
| unbounded | B7-83 bounded preparation must succeed | bounded preparation must succeed |
| per-cell | B7-85 restart makes zero copy and relate calls | restart must make zero copy and relate calls |
| receipt | B7-88 invalid receipt refuses | changed or incomplete store must refuse |
| half-made | B7-87 incomplete preparation refuses | changed or incomplete store must refuse |
| vector | B7-89 changed vector changes node fingerprint | vector must change nodes fingerprint |
| survives-runner | B7-93 first observation sees no live child with an address space | child 440924 must terminate at first observation after runner death |

Each plant changes a disposable code copy. JSON receipts retain the exact assertion and its values. The unbounded plant must also record `oom_kill > 0` and `SIGKILL`; an assertion caused by missing OOM evidence cannot pass.

### Remaining disagreement

- B7 B7-76 runner ends background and new-session children before returning. B7-93 requires termination at the first observation after owner reap. At least one recorded process still has an address space and fails the exact termination predicate. Production code remains unchanged.
- B7 B7-93 runner death passes 50 consecutive repetitions under CPU load. B7-93 requires termination at the first observation after owner reap. At least one recorded process still has an address space and fails the exact termination predicate. Production code remains unchanged.
- B7 B7-76 runner ends background and new-session children before returning. B7-93 requires termination at the first observation after owner reap. At least one recorded process still has an address space and fails the exact termination predicate. Production code remains unchanged.
- B7 B7-93 runner death passes 50 consecutive repetitions under CPU load. B7-93 requires termination at the first observation after owner reap. At least one recorded process still has an address space and fails the exact termination predicate. Production code remains unchanged.

The parent must rule on B7-93. The tests do not wait for client completion before the first observation, loosen the process predicate, or change the launcher.

### Other checks

| Check | Exit | Evidence |
| --- | --- | --- |
| typecheck | 0 | [log](../../test-results/trial7-tests5-typecheck.txt) |
| memod | 0 | [log](../../test-results/trial7-tests5-memod.txt) |
| readme | 0 | [log](../../test-results/trial7-tests5-readme.txt) |
| score | 0 | [log](../../test-results/trial7-tests5-score.txt) |

The saved-score comparison prints no bytes. README checks, memod lint and the tsrs type check run in separate 2G scopes. No trial or hosted model ran.

### Evidence retained

- `test-results/batch7-selftest-v01qaX` holds measurements, store copies, six plant receipts, scope logs and 50 runner observations.
- `test-results/batch7-selftest-G1QkSi` holds measurements, store copies, six plant receipts, scope logs and 50 runner observations.
- `test-results/trial7-tests5-*` holds the small probes, focused runs, OOM diagnosis and final logs. Earlier focused `batch7-selftest-*` folders remain as evidence. No scratch file was deleted.

- `test-results/batch4-selftest-Ck8Wwr`.
- `test-results/batch4-selftest-T0INFu`.
- `test-results/batch5-selftest-f5hYXY`.
- `test-results/batch5-selftest-kcwHKf`.
- `test-results/batch6-selftest-05ZLJ5`.
- `test-results/batch6-selftest-H8yN2M`.
- `test-results/batch7-selftest-3w3Ci6`.
- `test-results/batch7-selftest-6spsSp`.
- `test-results/batch7-selftest-7G843m`.
- `test-results/batch7-selftest-CCUvdB`.
- `test-results/batch7-selftest-G1QkSi`.
- `test-results/batch7-selftest-Ko7q1L`.
- `test-results/batch7-selftest-LslcPK`.
- `test-results/batch7-selftest-Rt4mgm`.
- `test-results/batch7-selftest-cCvVld`.
- `test-results/batch7-selftest-gTfQRF`.
- `test-results/batch7-selftest-iulDn9`.
- `test-results/batch7-selftest-jL10pl`.
- `test-results/batch7-selftest-mIIEJn`.
- `test-results/batch7-selftest-v01qaX`.
- `test-results/ticket-selftest-hd1has`.
- `test-results/ticket-selftest-nuj3td`.

The supplied `/var/tmp/whygraph-eval/_zustand/ablations` directory was empty on read-only inspection. `test-results/trial7-tests5-old-ablations.txt` retains that listing. No archive or removal was needed.

The JSON audit holds the full coverage map, exact scratch paths, raw plant assertions and source-history gaps. Prior audit sections describe earlier rounds.

### Reproduce

```sh
export PATH="$HOME/.opencode/bin:$HOME/.npm-global/bin:$HOME/.local/share/mise/installs/pnpm/12.11.2:$HOME/.local/bin:$PATH"
TMPDIR=/mnt/ssd/tmp systemd-run --user --scope -q -p MemoryMax=6G -p CPUQuota=400% node eval/selftest/check.mjs
TMPDIR=/mnt/ssd/tmp systemd-run --user --scope -q -p MemoryMax=2G -p CPUQuota=400% node eval/selftest/batch7-check.mjs memory
TMPDIR=/mnt/ssd/tmp systemd-run --user --scope -q -p MemoryMax=2G -p CPUQuota=400% node eval/selftest/batch7-check.mjs B7-93
```

## B7-93 second-ruling audit

Parent ruling `4d186ad` replaces the first-observation requirement. The test now observes until all recorded children are gone or zombies, or ten seconds pass. The timeout and cleanup cases keep their existing rule. No production file changed.

### Results

| Run | Cases | Exit | Repetitions | Needed more than one observation | Longest time to gone or zombie, ms |
| --- | --- | --- | --- | --- | --- |
| [focused](../../test-results/trial7-tests5-ruling2-focused.txt) | 2/2 | 0 | 50 | 10 | 52.936 |
| [full 1](../../test-results/trial7-tests5-ruling2-full-1.txt) | 1553/1553 | 0 | 50 | 15 | 145.553 |
| [full 2](../../test-results/trial7-tests5-ruling2-full-2.txt) | 1553/1553 | 0 | 50 | 6 | 145.786 |

Each repetition runs under four CPU-load processes. Its clock starts before the owner receives SIGKILL, so the recorded time includes owner reap. Every intermediate process state is retained. The case waits for neither the client nor cleanup before observing the children. A child write during this interval does not fail the case.

### Surviving-child plant

| Run | First failing assertion | Elapsed ms | Live address spaces at bound |
| --- | --- | --- | --- |
| focused | runner children must be gone or zombie within 10 seconds | 10000.482 | 3 |
| full 1 | runner children must be gone or zombie within 10 seconds | 10001.181 | 3 |
| full 2 | runner children must be gone or zombie within 10 seconds | 10000.184 | 3 |

The plant removes the command PID namespace and parent-death enforcement from a disposable code copy. The case must wait for the full ten-second bound, then fail while a recorded child still has an address space. Fixture cleanup starts after the failing assertion and its evidence have been saved.

### Memory checks repeated by the full suites

| Run | Input | Peak bytes | Wall ms | Result |
| --- | --- | --- | --- | --- |
| 1 | small-stress | 87310336 | 417.59 | success |
| 1 | synthetic-5000 | 541184000 | 155810.77 | success |
| 1 | real-zustand | 437493760 | 62300.25 | success |
| 1 | unbounded | 999997440 | 4251.08 | expected bounded OOM |
| 2 | small-stress | 87138304 | 478.36 | success |
| 2 | synthetic-5000 | 540704768 | 155743.83 | success |
| 2 | real-zustand | 419844096 | 62128.95 | success |
| 2 | unbounded | 999997440 | 4287.76 | expected bounded OOM |

Each full suite also catches the other five memory and receipt plants. The JSON audit holds each assertion receipt. Memory tests still use their own bounded scopes. Each full suite runs inside the required 6G scope. Wall times are observations under shared load.

### Other checks

| Check | Exit | Evidence |
| --- | --- | --- |
| typecheck | 0 | [log](../../test-results/trial7-tests5-ruling2-typecheck.txt) |
| memod | 0 | [log](../../test-results/trial7-tests5-ruling2-memod.txt) |
| readme | 0 | [log](../../test-results/trial7-tests5-ruling2-readme.txt) |
| score | 0 | [log](../../test-results/trial7-tests5-ruling2-score.txt) |

No requested item lacks a case. No code/contract disagreement remains under the second ruling.

### Evidence retained

- `test-results/batch4-selftest-5G4CVw`.
- `test-results/batch4-selftest-hqtG07`.
- `test-results/batch5-selftest-Gw3Yrm`.
- `test-results/batch5-selftest-znZ2a3`.
- `test-results/batch6-selftest-EkbQxN`.
- `test-results/batch6-selftest-WZPN6w`.
- `test-results/batch7-selftest-69vbTi`.
- `test-results/batch7-selftest-Hos7BF`.
- `test-results/batch7-selftest-OHXuCL`.
- `test-results/batch7-selftest-hycWpL`.
- `test-results/ticket-selftest-INw4YV`.
- `test-results/ticket-selftest-pZ6OQl`.
- `test-results/trial7-tests5-ruling2-*` holds the focused and full logs, exact exit statuses, and check logs. Earlier evidence remains intact.

The fifth-round section below its historical heading records the superseded first-form ruling. Its failures are historical evidence, not current failures.

### Reproduce

```sh
export PATH="$HOME/.opencode/bin:$HOME/.npm-global/bin:$HOME/.local/share/mise/installs/pnpm/12.11.2:$HOME/.local/bin:$PATH"
TMPDIR=/mnt/ssd/tmp systemd-run --user --scope -q -p MemoryMax=2G -p CPUQuota=400% node eval/selftest/batch7-check.mjs B7-93
TMPDIR=/mnt/ssd/tmp systemd-run --user --scope -q -p MemoryMax=6G -p CPUQuota=400% node eval/selftest/check.mjs
```

## B7-93 process-disappearance audit

The runner observer accepts ENOENT and ESRCH from either process file as gone. It discards a stat sample if cmdline vanishes during the same observation. Unexpected errors still fail with their original message. The ten-second bound and the surviving-child predicate are unchanged.

### Places changed

- `eval/selftest/batch7-host.mjs:procText`: ENOENT and ESRCH return null. Other errors propagate unchanged.
- `eval/selftest/batch7-host.mjs:runnerState`: A vanished stat or cmdline makes the whole observation gone. The runner case and surviving-child plant share this observer.
- `eval/selftest/batch7-host.mjs:live`: Cleanup liveness uses procText and accepts both disappearance errors.
- `eval/selftest/batch7-host.mjs:ownedPids`: The child scan uses procText. It omits vanished entries and propagates unexpected errors.
- `eval/selftest/batch7-memory.mjs:fingerprint failure child-state observation`: The recorded-child stat read treats ENOENT and ESRCH as gone. Other errors propagate.

The batch 7 search also found current-worker cgroup and descriptor reads, plus access-denial probes through `/proc/1/root`. These are not observations of another process that may end. They are unchanged.

### Deterministic check

The regression failed before the fix in 8/26 checks. It passes 26/26 checks after the fix. It reads a nonexistent PID and ends and reaps a real child between stat and cmdline reads. Fault injection covers ENOENT and ESRCH at both files and requires EACCES and EIO to propagate unchanged. The global synchronous file boundary is restored in `finally`.

[Before-fix log](../../test-results/b7-93-esrch-before.txt); [after-fix log](../../test-results/b7-93-esrch-deterministic.txt). Each scratch root contains `proc-disappearance-check.json`.

### Repeated runs

| Run | Cases | Exit | Runner repetitions | Surviving-child plant |
| --- | --- | --- | --- | --- |
| [focused 1](../../test-results/b7-93-esrch-focused-1.txt) | 3/3 | 0 | 50/50 | caught at ten-second bound |
| [focused 2](../../test-results/b7-93-esrch-focused-2.txt) | 3/3 | 0 | 50/50 | caught at ten-second bound |
| [focused 3](../../test-results/b7-93-esrch-focused-3.txt) | 3/3 | 0 | 50/50 | caught at ten-second bound |
| [full 1](../../test-results/b7-93-esrch-full-1.txt) | 1554/1554 | 0 | 50/50 | caught at ten-second bound |
| [full 2](../../test-results/b7-93-esrch-full-2.txt) | 1554/1554 | 0 | 50/50 | caught at ten-second bound |

The three focused batches pass 150/150 runner-death repetitions under four CPU-load processes. The two full suites include another 100/100 repetitions. All five suites catch the surviving-child plant while it retains an address space at the bound. Each full suite also runs the new deterministic case.

### Other checks

- `typecheck`: exit 0, [log](../../test-results/b7-93-esrch-typecheck.txt).
- `memod`: exit 0, [log](../../test-results/b7-93-esrch-memod.txt).

All self-test runs use the required 6G memory scope, 400% CPU quota, and `/mnt/ssd/tmp`. No trial or hosted model ran. No package was installed. No push or scratch deletion ran. Scratch and logs remain under `test-results/`. The JSON audit records the raw evidence paths. Earlier audit sections retain their historical counts.

### Reproduce

```sh
export PATH="$HOME/.opencode/bin:$HOME/.npm-global/bin:$HOME/.local/share/mise/installs/pnpm/12.11.2:$HOME/.local/bin:$PATH"
TMPDIR=/mnt/ssd/tmp systemd-run --user --scope -q -p MemoryMax=6G -p CPUQuota=400% node eval/selftest/batch7-check.mjs "proc disappearance"
TMPDIR=/mnt/ssd/tmp systemd-run --user --scope -q -p MemoryMax=6G -p CPUQuota=400% node eval/selftest/batch7-check.mjs B7-93
TMPDIR=/mnt/ssd/tmp systemd-run --user --scope -q -p MemoryMax=6G -p CPUQuota=400% node eval/selftest/check.mjs
```

## Bounded paths and real-plan rehearsal, 2026-11-16

This extension covers B7-94 through B7-116 at `70857dc`. ADR 0011 governs
confinement and attempts. ADR 0013 governs path bounds and rehearsal results.
The test author changes only `eval/selftest/`. No trial, hosted agent, install,
push, delegation, or new worktree runs.

The 65 new cases use invented tasks, source edits, and a small real store.
They exercise the public runner, preparation, store service, shell launcher,
agent confinement, stand-in, event reader, result writer, and smoke checker.
The identity mount is an empty test directory. No credential file is read.
The tests retain all scratch and evidence under `test-results/`.

The smoke fixture has two conflicts, one plain control, and one governed
control. Its two complete rehearsals each execute 16 cells. The default-stage
case expands the invented task set to twelve conflicts, three plain controls,
and four governed controls. It executes all 258 cells with three repeats,
then invokes the real smoke checker. A separate planner case checks the
258-cell count without preparation.

| Item | Independent cases |
| --- | --- |
| B7-94 | Complete smoke plans; the longest named cell; the old 115-byte socket path; UUID work folders and fixed socket leaves. |
| B7-95 | Exact 128-byte keys; Unicode, separators, reserved digest prefixes, and long task, condition, and repo identities; real smoke reads digest keys. |
| B7-96 | A 107-byte absolute socket path; one byte over through absolute and relative roots; refusal before markers, reservations, or preparation. |
| B7-97 | Concurrent attempts of one cell and a shared-prefix cell; mode 0700; distinct live services; cross-access denied through native and shell namespaces; both sockets close. |
| B7-98 | Per-field argument and environment limits, NUL, and ARG_MAX; prompt refusal before preparation; real shell protocol refusal before exec. Existing B7-80 proves the valid 1 MiB request. |
| B7-99 | Lexical component and total path limits; mount sources; a short alias with an overlong canonical ancestor. |
| B7-100 | Trial root, child, ancestor, and alias refuse before writes; trial evidence bytes stay intact. |
| B7-101 | Trial metadata at the root and in an archive refuse despite a rehearsal marker; fresh runs have distinct UUID result folders. |
| B7-102 | Trial CLI selectors and a registry stand-in agent refuse; the trial entry imports no rehearsal entry. |
| B7-103 | Two real 16-cell smoke rehearsals; seven PASS checks; receipt bytes and inode/mtime/ctime unchanged; wall time and scope peak recorded. |
| B7-104 | Default-stage execution of all 258 invented registered cells; fresh work copies, retained results, one-attempt ledgers, and the real smoke check; independent plan count. |
| B7-105 | Failed source read, each command diagnostic, and failed edit; error events, nonzero exit, no successful session; actual two-attempt failure. |
| B7-106 | Each of six denied probes is made to return success at the tool boundary; the actual output is retained and the stand-in rejects it. |
| B7-107 | Receipt, manifest, answer, and ledger corruption after done cells; the real smoke checker fails and rehearsal propagates failure. |
| B7-108 | Actual read/shell/edit events, zero tokens/cost, real control diff verdicts, explicit rehearsal scoring, and unchanged default scorer bytes. |
| B7-109 | Missing fixture, mismatched task hash, absent edit anchor, and missing target refuse before cells start. |
| B7-110 | Abrupt rehearsal exit leaves a running reservation; resume refuses launch; a failed stand-in preserves both actual attempt archives and a failed measurement. |
| B7-111 | A valid prepared store is checked, then changed; rehearsal refuses without republishing the receipt. |
| B7-112 | Trial, hidden-trial, and cycle symlinks under the result root refuse before traversal or writes. |
| B7-113 | Source targets for carry/why/search; record targets for impact; live-health fallback for plain controls; source-as-impact and omitted-command diagnostics fail. |
| B7-114 | Controls without ground-truth targets use explicit edit-fixture symbols; why range and carry past-EOF diagnostics fail; every invented control target succeeds through the real store. |
| B7-115 | Transport import with no registry beside it; exported path/exec guards; changed product sections return exactly status 70, empty stdout, and the service-unavailable stderr. |
| B7-116 | Readable or digested canonical archive prefixes, appended UUIDs, at most 166 bytes, and preserved binary evidence. Existing batch 5 cases also exercise reuse of an earlier result. |

No whole item lacks a case. One part has no case: B7-114's inventory of the
committed real control targets in the real prepared store. The brief requires
invented inputs independent of real batch 7 data. These cases prove target
presence and grammar with the invented controls; they make no claim about
that real inventory.

The fault tests alter copies of code. They preserve the stand-in shebang so
the fault reaches the intended executable step. Smoke-corruption cases reuse
complete genuine attempt evidence to reach the post-plan boundary. The two
smoke runs and the full 258-cell case execute every cell through the real path.

Final counts, plant receipts, disagreements, and scratch paths are recorded
in the `bounded_paths_rehearsal` section of
[the JSON audit](batch7-audit.json). Final validation is running.

### Planted faults

All eight faults change code copies. Each plant reaches the named contract
assertion. The JSON audit retains each full assertion and raw receipt.

| Fault | Case | First failing assertion |
| --- | --- | --- |
| archive-prefix | B7-116 | archive must retain its canonical result-key prefix |
| cell-socket | B7-94 | long cells must start a live service using bounded UUID paths |
| late-root | B7-96 | invalid root must refuse before any result marker or cell reservation |
| result-key | B7-95 | runner and smoke checker must use the same result key |
| smoke-pass | B7-107 | a failed smoke check must fail rehearsal |
| stand-in-agent | B7-102 | stand-in is not a valid trial registry agent |
| store-probe-pass | B7-106 | a failed stand-in step must not finish successfully |
| trial-results | B7-100 | rehearsal must write no marker or ledger into trial results |

### Contract disagreements

B7-96 also remains red. A valid absolute symlink work root passes both path
guards. The stand-in exits 0 after eight service calls. The runner then marks
its own native source read as an isolation breach. The runner maps `/repo`
to the alias path, but the isolation checker compares it with the canonical
repo path. The focused reproduction is
[the work-root alias log](../../test-results/trial7-tests6-work-alias.txt).
The baseline uses physical work roots; the explicit alias case keeps this
failure visible. The parent must rule on it.

B7-115 remains red. The isolated transport returns status 70 and empty stdout,
but stderr is `whygraph service unavailable: carry decision section changed; update the eval ablation\n`.
The contract requires exactly `whygraph service unavailable\n`.
`eval/closed-store.mjs:247` appends the internal error message. The parent must
rule on this mismatch. The independent author changes no production code.

Reproduce each full suite in the required scope:

```sh
export PATH="$HOME/.opencode/bin:$HOME/.npm-global/bin:$HOME/.local/share/mise/installs/pnpm/12.11.2:$HOME/.local/bin:$PATH"
TMPDIR=/mnt/ssd/tmp systemd-run --user --scope -q -p MemoryMax=6G -p CPUQuota=400% node eval/selftest/check.mjs
```

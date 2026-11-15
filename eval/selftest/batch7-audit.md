---
title: Batch 7 independent test audit
status: blocked
tags: [whygraph, eval, independent-tests]
---

> [!abstract] Answer
> 1338/1347 self-test cases pass. All 1,061 earlier cases pass. 9 contract assertions remain red.
> Fourteen code plants are caught. Retry dispatch remains untested because the brief forbids its only callable path.

**What changed**

- Added 286 cases under `eval/selftest/`. [verified]
- Updated B6-26 and inherited batch 5 preparation expectations for ADR 0010. [verified]
- Kept the launcher byte pin against `c92205d`. [verified]

**Why it matters**

- Tests call public functions and commands with isolated, invented inputs. [verified]
- Closed-store probes execute inside the full bwrap namespace. [verified]
- Fixture verdicts do not depend on live trial results or external stores. [verified]

**The catch**

- The generated shell fails its normal source-read positive control at nested namespace creation. [verified]
- B7-12 has eight usage-byte mismatches. [verified]
- An actual escaping symlink is classified as invalid. [verified]
- B7-48 through B7-55 require retry dispatch that the brief prevents this author from running. [verified]

**Next**

- The parent rules on the three decisions at the end.
- Branch `batch-7` remains local and unmerged. Product code stays unchanged. [verified]

## Checks

| Check | Result |
| --- | --- |
| Self-test | 1338/1347, exit 1 |
| Earlier cases | 1061/1061 |
| New cases | 277/286 |
| Focused preservation proof | 1/1, exit 0; also included in final suite |
| `pnpm check` with tsrs | Exit 0 |
| `memod lint` | Exit 0 |
| README command check | 14 commands, 0 drifted, exit 0 |
| Saved score comparison | Exit 0, zero output bytes |
| Main suite | Conditional check does not apply; `test/` has no change |

Run the self-test with the brief's PATH and resource scope:

```sh
PATH="$HOME/.npm-global/bin:$HOME/.local/share/mise/installs/pnpm/12.11.2:$HOME/.local/bin:$PATH" \
TMPDIR=/mnt/ssd/tmp systemd-run --user --scope -q -p MemoryMax=6G -p CPUQuota=400% \
  node eval/selftest/check.mjs
```

Use `node eval/selftest/batch7-check.mjs <name-fragment>` under the same scope for a focused case.

## Contract disagreements

| Item | Measured result | Contract reading |
| --- | --- | --- |
| B7-11, B7-19 | The actual generated shell exits 1 before a normal source read: bwrap cannot create its nested namespace. Native commands in the captured outer launch work. | Source commands must work, and shell denial needs successful ordinary-command controls. |
| B7-12 | Eight cases return short client usage; direct CLI returns command diagnostics and full help. | Usage must match byte for byte. |

- Real filesystem probes deny store and code access. The corrected escaping-symlink fixture passes. [verified]
- No product fix or contract change was made. [verified]

## Coverage of all 71 items

| Item | Case coverage or reason absent |
| --- | --- |
| B7-01 | Batch 5 and 6 preparation reads c92205d despite changed working skill and rule. |
| B7-02 | Missing instructionsCommit, unavailable commit and missing recorded skill refuse before work creation. |
| B7-03 | The B6-26 owner ignores working bytes and catches changed recorded bytes. Launcher remains pinned. |
| B7-04 | Repeated generation preserves earlier tasks, copied blind files, decision sentinels and store sentinels. Earlier report prefix stays fixed. Limit: Official external batch 5/6 stores and decisions were never read. Preservation uses repo-local fixture sentinels and copied blind files. |
| B7-05 | Batch 5 and 6 single-id plan stdout, stderr and defaults equal c243073. |
| B7-06 | Registry refusals; another repo uses stratified generation, planning and a configured source extension. |
| B7-07 | Real relate access fails through shell, absolute executable and script in the whole-agent namespace. |
| B7-08 | Native reads, symlinks, guessed host paths and /proc/1/root cannot read an actual store file. |
| B7-09 | Native reads cannot read client, service or product source. Read-only execute-only mount resists chmod. |
| B7-10 | The first namespace cannot connect to a known second-run host socket; its own service still answers. |
| B7-11 | Native and direct shell source reads and edits pass. The actual generated shell cannot create its nested namespace; its normal source-read positive control remains red. |
| B7-12 | Both carry forms and why/impact/search match direct CLI bytes. Eight missing-argument usage cases remain red. |
| B7-13 | Observed binary framing; allowed raw request control; fifth command, query text, store override, extra args, NUL and oversized frame refused. |
| B7-14 | Service loss after mounting returns exact unavailable text and exit 70; exported runOne classifies it as a harness failure. Limit: Client loss and harness classification are tested. Retry dispatch remains unexercised. |
| B7-15 | Success, timeout, escaping symlink, malformed stream, spawn error, failed preparation/health and service loss retain evidence and close service. Limit: Preparation, health and service failure during timeout are replayed. Retry dispatch remains unexercised. |
| B7-16 | stdout/stderr and full replies remain; sockets disappear; timeout signals are recorded; no actual agent starts. Limit: Agent spawn is simulated. Actual hosted-agent process lifetime is outside the brief. |
| B7-17 | Prepared manifests and compiled bytes agree across conditions. A C-source client variant is caught. |
| B7-18 | Norule keeps original instructions and recorded skill, omits exactly the rule. A preparation fault is caught. |
| B7-19 | Outer network and identity positive controls pass. Generated shell status 1 cannot prove denial: even its normal source read fails because nested namespace creation is denied. |
| B7-20 | Stub answers every fixture command with exactly no result newline and status zero. |
| B7-21 | No-search changes search only; every other stdout/stderr/status matches graph. |
| B7-22 | Nolink removes commit-linked why/carry records, retains tags and nodes; a retained-link plant is caught. |
| B7-23 | Symbol and overlapping range carry preserve all bytes outside decision sections, including term de-duplication. |
| B7-24 | Nolink search, impact, neighbors, users, commits and unaffected carry sections match full answers. |
| B7-25 | Actual Term and MENTIONS counts are zero; carry has no term candidates. Smoke rejects retained disabled components. |
| B7-26 | Noterms preserves links, why, impact, search, record/vector fingerprints and unrelated answer bytes. |
| B7-27 | Unrelated node deletion, changed record/vector and a foreign source completion marker refuse. Limit: Receipts expose one combined ms field. Separate copy/mutation durations are not specified; finite nonnegative preparation time and source identity are checked. |
| B7-28 | Changed direct-CLI carry heading gives an explicit service failure with empty stdout. |
| B7-29 | src and recipes stay byte-identical during condition preparation/querying and hold no condition names. Observed relate children override both privacy flags. |
| B7-30 | Open/completed/not-planned issues and open/unmerged/merged PRs retain outcomes using two list requests. |
| B7-31 | Only OWNER/MEMBER/COLLABORATOR survive; time and URL order hold; outside text stays out of records and searchText. |
| B7-32 | Complete-cache restart makes zero requests; a 100-item first page survives an interruption; URL keys and pending files checked. |
| B7-33 | 403 and 429 Retry-After, reset time and unrelated 500 exercised with virtual time and a local server. |
| B7-34 | Known and unknown forecasts, zero totals with one page per list, two-request fixture, and off-host pagination refusal. Limit: The shorthand formula omits the per-list floor. Tests follow ADR 0012: max(1,ceil(T/100))+max(1,ceil(C/100)). |
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
| B7-48 | Two-timeout retry dispatch cannot run through --plan; no exported dispatcher exists. |
| B7-49 | Two-breach retry dispatch cannot run through --plan. The single-attempt escaping-symlink case passes. |
| B7-50 | Timeout-then-breach dispatch cannot run through --plan; smoke admission covers only the resulting ledger shape. |
| B7-51 | Breach-then-timeout dispatch cannot run through --plan; smoke admission covers only the resulting ledger shape. |
| B7-52 | Successful retry dispatch cannot run through --plan; an invented two-attempt archive fixture passes smoke. |
| B7-53 | Retry ordering needs the forbidden CLI path. Exported runOne separately proves service failure takes precedence over timeout. |
| B7-54 | Exhaustion across runner restarts and interrupted reservation handling need the forbidden CLI execution path. Limit: The smoke checker rejects running/third-attempt ledgers. Runner restart enforcement is unexercised. |
| B7-55 | Batch 5/6 retry-pair regression needs their non-plan CLI dispatch; inherited single-attempt/resume cases still pass. |
| B7-56 | 258 distinct cells, three repeats, six conflict conditions and two control conditions; plan writes nothing. |
| B7-57 | 16 repeat-1 smoke cells; invalid stage/selection/repeats refuse. |
| B7-58 | Unknown/duplicate conditions and invalid repeats refuse; control ablations refuse in planning and saved scoring. |
| B7-59 | Valid cells and archives; unfinished cell, running ledger, missing archive and third attempt fail planned cells alone. Limit: Ledger admission is tested; the dispatcher that creates these ledgers is not run. |
| B7-60 | Disabled/enabled health, unchanged components, every saved reply position and archived receipt differences fail answers. |
| B7-61 | Client/manifest differences, retained rule and original norule-text changes fail file identity alone. |
| B7-62 | Successful/missing/not-run probes and logged successful store calls fail. Ordinary whygraph/relate discovery remains valid. |
| B7-63 | Call totals and malformed saved replies fail; malformed JSON also fails answer validation. |
| B7-64 | Missing batch block, each stratum and each paired ablation comparison fail scorer blocks without printing scores. |
| B7-65 | Missing/negative usage fails; every root and archived attempt has its own tokens/time line. |
| B7-66 | An empty smoke fixture fails every relevant check. |
| B7-67 | The exact 16 smoke cells count as completed repeat 1 in full planning. Limit: Full-plan resume is tested. Archiving after a failed smoke remains the parent-owned manual step. |
| B7-68 | Earlier bytes remain; invalid-only results add no batch 7 block; JSON has finished verdicts only. |
| B7-69 | All/cited/uncited rates and every paired mean/interval are known by construction; missing pairs remain unpaired. |
| B7-70 | Quadrants, needed-ticket visibility, absolute client paths, separate control rates, unscored sensitivity, tokens and cost are counted. |
| B7-71 | The overlapping-range and symbol proof compares every byte outside decision sections, including de-duplicated terms. |

## Planted code faults

Each clean owner passes before its copied-code fault is checked. [verified]

| Fault | Failing case | First failing assertion |
| --- | --- | --- |
| past batch reads working-tree skill | B7 plant past batch reads working skill caught by B7-01 instruction bytes | recorded skill bytes |
| uncited request uses a cited ticket | B7 plant uncited request from cited ticket caught by B7-42 source-stratum owner | complete source entry |
| changed blind byte passes without hash checks | B7 plant missing blind hash accepted caught by B7-41 refusal owner | invalid inputs must refuse |
| task is written before validation | B7 plant task write before input validation caught by B7-46 atomic refusal owner | refusal writes no tasks |
| outside-author comment enters a record | B7 plant outside comment retained caught by B7-31 converter output | The input was expected to not match the regular expression /OUTSIDER_SECRET_TEXT/. Input: |
| host store is mounted into the run | B7 plant mounted-store caught inside B7-07/B7-08 confinement | mounted-store must not be accessible |
| real relate program is mounted on the run path | B7 plant relate-path caught inside B7-07/B7-08 confinement | relate-path must not be accessible |
| graph-nolink retains a linked record | B7 plant nolink-keeps-link caught by independent answer owner | nolink cannot show linked note-2 |
| graph-noterms also removes a linked record | B7 plant noterms-drops-link caught by independent answer owner | noterms retains linked note-2 |
| server accepts query through its binary protocol | B7 plant raw query accepted caught by B7-13 server protocol owner | raw query must return no graph records |
| graph-norule preparation retains rule text | B7 plant norule rule text retained caught by B7-18 instruction owner | norule must omit the recorded rule exactly |
| one condition receives different compiled client bytes | B7 plant different client compiled for a condition caught by B7-17 byte owner | all conditions must receive identical client bytes |
| smoke admits a third attempt after timeout and breach | B7 smoke plant third launch after timeout and breach caught by B7-59 attempt budget | Expected /^FAIL planned cells/; observed PASS planned cells. |
| smoke reports a missing/unfinished cell as passing | B7 smoke plant smoke accepts missing cell caught by B7-59 planned-cell owner | Expected /^FAIL planned cells/; observed PASS planned cells. |

- The third-attempt plant tests smoke ledger admission. It does not execute the retry dispatcher. [verified]
- Four duplicated entries were removed. Their primary owners remain; all 14 copied-code plants remain. [verified]
- Full assertion receipts and copied code stay in the primary scratch folder. [verified]

## Contract readings and limits

- Zero totals use ADR 0012's one-page floor for each list. Three boundary forecasts pass. [verified]
- Smoke ledger layout came from command input behavior; the contract does not document its JSON schema. [verified]
- Receipt source identity and finite nonnegative preparation milliseconds pass focused checks. [verified]
- Preparation, health and service loss during timeout all produce harness failure and close the service. [verified]
- The parent owns failed-smoke archiving. Full-plan resume of the exact 16 cells is checked. [verified]
- Agent spawn is simulated. No trial, hosted model, install, delegation or push occurred. [verified]
- Namespace probes mount the installed agent executable without starting it. [verified]
- Generated-shell failure uses the captured actual launch arguments and exact command.json environment. It does not use a reconstructed shell. [verified]
- Relative lifecycle work aliases fit Unix socket limits. Functional answer proofs use absolute repo paths. [verified]
- Official external decision/store files stay unread. Preservation uses local sentinels and copied historical blind files. [verified]
- Production implementation files were opaque. Public exports, command results, required byte scans and copy mutations supplied evidence. [verified]

## Test-author corrections

- Replaced an impossible successful-store fake with an actual escaping symlink. The corrected case passes. [verified]
- Async fake children own duplicated output descriptors until their delayed write completes. [verified]
- Checker plants now return exit 0 when admitting a physically missing cell or a third attempt. [verified]
- An early export-discovery import invoked the default generator. Historical-byte gates and Git status confirm unchanged task bytes. [verified]

## Fixture resource ownership

| State | Owner and lifetime | Boundary token | Release |
| --- | --- | --- | --- |
| Archived stdout/stderr duplicates | Fake child, one attempt | Config task id and captured emitter | Close after writing, before child close |
| Native service-loss probe | Fake child scope | Captured probe process | Await close before final stream and timeout |
| Service handle | Exported service, one worker process | Unique socket path | Public stop; runOne finally classifies errors |
| Deferred timeout | Worker, one attempt | Captured callback | Clear timer before firing after probe |

## Retained evidence

- Full run: `test-results/batch7-final-proof.txt`. [verified]
- Primary scratch: `test-results/batch7-selftest-J6NyNF/`. [verified]
- Preservation refinement: `test-results/batch7-preserved-inputs.txt`. [verified]
- Generated-shell reproductions: `test-results/batch7-actual-shell.txt` and `test-results/batch7-actual-shell2.txt`, both exit 1. [verified]
- All root scratch folders and short work aliases are listed in [the machine-readable audit](batch7-audit.json). [verified]
- Retained root scratch folders: 110. Short work aliases: 222. [verified]
- Diagnostic sources stay under `test-results/batch7-diagnostics/`. [verified]
- The brief limits edits to tests. The report stays in the authorized repository scope. [verified]

## Needs parent

1. The brief says: `never call eval/run.mjs without --plan`. Retry dispatch has no exported entry. [verified]
   - **Recommended: authorize a copied-CLI replay with agent spawn intercepted, as an explicit no-plan rail waiver.**
   - Keep the rail and leave B7-48 through B7-55 unverified.
2. Eight B7-12 usage mismatches remain. [verified]
   - **Recommended: keep byte equality and fix the client.**
   - Amend the usage requirement before the trial.
3. A normal command through the generated shell cannot create its nested namespace. [verified]
   - **Recommended: diagnose the namespace policy with the required capability drops and mounts. If it cannot work, approve a host-owned per-attempt shell launcher.**
   - Keep the trial blocked until ordinary source and whygraph commands work through the actual generated shell.

[[whygraph-trial-design]]

# Reranker removal test audit

## History correction (2026-11-16)

The X4 and X8 checks now follow ADR 0009, ADR 0010 and the task brief.
The baseline at `1b674f3` reproduced X8's `eval input inventory` failure.
X4's skill subtest passed but still carried a TODO.

| Item | Current check |
| --- | --- |
| X4 skills | Every file under `skills/` omits the reranker, `WHYGRAPH_RERANK` (including `_URL`) and `--at`. The skill subtest has no TODO. |
| X8 removal | `git diff --name-only --no-renames 42ab13f c243073 -- eval skills` is empty. This includes tasks, tickets, self-tests, launcher and pinned skill bytes. The check reads history in the subject repo. |
| X8 saved scores | The current scorer exits 0, prints the current `eval/score.txt` exactly and emits no stderr. The saved report retains the base report as its prefix. |
| X8 frozen inputs | The 99 batch 3-6 tasks and 10 blind files match their base bytes. The task list, batch membership and blind paths come from the base tree and registry, so editing current metadata cannot remove an input from the check. |
| X8 later work | Later eval files, launchers, self-tests and skill edits may change. The current batch 7 additions and cleaned skill text pass. |

### Plants

All 19 plants were caught at their named assertion. The 11 added plants
cover each changed assertion; the original eight also pass their detection
checks. Each planted test exits 1. The plant runner exits 0.

| Added plant | Caught by |
| --- | --- |
| `current-skill-restores-reranker` | X4 skills: `current skill instructions` |
| `current-rule-restores-setting` | X4 skills: `current skill instructions` |
| `new-skill-restores-at` | X4 skills: `current skill instructions`, including a new nested skill |
| `removal-changes-eval-byte` | X8: `removal commit changes no eval or skill bytes`, naming `eval/opencode.mjs` |
| `removal-changes-skill-byte` | X8: the same assertion, naming `skills/whygraph/SKILL.md` |
| `frozen-batch-3-task-changes` | X8: `frozen task eval/tasks/ripgrep-conflict-rg-01.json` |
| `frozen-batch-4-task-changes` | X8: `frozen task eval/tasks/ripgrep4-conflict-rg-04.json` |
| `frozen-batch-5-task-changes` | X8: `frozen task eval/tasks/ripgrep5-conflict-rg-04.json` |
| `frozen-batch-6-task-changes` | X8: `frozen task eval/tasks/hono6-conflict-hn-01.json` |
| `frozen-blind-requests.json-changes` | X8: `frozen blind input eval/tickets/requests.json` |
| `frozen-blind-hono-controls2.json-changes` | X8: `frozen blind input eval/tickets/hono/controls2.json` |

The history plants use scratch clones with shared objects and no checkout.
Each creates a commit with the removal tree, one changed blob and the original
base parent. Only the copied test receives that planted commit ID.
`history.json` records the base, removal, planted commit and changed path.
Frozen-input plants append one newline, so the scorer still passes before
the byte assertion fails. The real source, history and saved results stay intact.

The first history plant ran alone before the complete plant batch.
Evidence stays under `test-results/`:

- Baseline: `2026-11-16T01-25-06-653Z-71616.tap`.
- Corrected X4/X8 checks: `2026-11-16T01-26-55-864Z-148175.tap` (14 pass, 0 fail, 0 TODO, including the unmatched test-file entries).
- One-plant smoke check: `cut-plants-VDG1ws/summary.json`.
- Complete plant batch: `cut-plants-y7cWh9/summary.json`, with one `result.tap` per plant.
- Required suite: `2026-11-16T01-28-21-001Z-211008.tap`.

### Checks and scope

```sh
export PATH="$HOME/.opencode/bin:$HOME/.npm-global/bin:$HOME/.local/share/mise/installs/pnpm/12.11.2:$HOME/.local/bin:$PATH"
pnpm check
node_modules/.bin/memod lint
TMPDIR=/mnt/ssd/tmp systemd-run --user --scope -q -p MemoryMax=6G -p CPUQuota=400% pnpm test --test-skip-pattern='^S[46] '
TMPDIR=/mnt/ssd/tmp systemd-run --user --scope -q -p MemoryMax=6G -p CPUQuota=400% node test/cut-reranker-plants.mjs
```

- `pnpm check` exits 0. `memod lint` exits 0 outside the sandbox, with no diagnostic.
- The required suite exits 0: 235 tests, 235 pass, 0 fail, 0 TODO and 0 reported skips. S4 and S6 are excluded by the name pattern and are not counted as skips.
- S4 and S6 belong to the parent and are excluded. No trial or hosted model ran.
- Only the removal test, its plant runner and this audit changed. Nothing was installed or deleted. Scratch stays for inspection. No task worktree was created and nothing was pushed.
- Source evidence: the original test commit `74d1246`, removal commit `c243073`, skill cleanup `c1ae17c`, ADR 0009 and ADR 0010. The brief forbids delegation. Fleet memory is unavailable. No connected issue or chat source is needed for this history correction; runtime error tracking does not govern these byte contracts.
- The static checks guard explicit instruction and byte contracts. A normal CLI run cannot prove that all skill files omit removed instructions or that an old commit left inputs unchanged.

### Contract disagreement

The executable assertions agree with the brief and ADR 0010.
`docs/failures.md` X4 still says that the skill files conflict with the
batch-6 byte check. ADR 0010 and `c1ae17c` have resolved that clause.
The clause is stale; this test-only task leaves it unchanged.

## Original removal audit (2026-11-15)

The sections below retain the original evidence. Their TODO and suite counts
describe that earlier tree, not the current result above.

> [!abstract] Answer
> The independent checks cover X1–X8 against `42ab13f982542cdce3d9eaa4396480430c4ecd1d`.
> All eight plants fail at the intended assertion.
> X4 retains one expected failure for the two pinned skill files.
> The full suite exits 0 with 234 passed, 0 failed and 1 TODO.

**What changed**

- `cut-reranker.test.mjs` adds one block for each removal contract. [verified]
- `run.mjs` includes the new file. [verified]
- The generator reads baseline files with `git show`. It creates no checkout. [verified]
- All committed changes stay under `test/`. [verified]

**Why it matters**

- Search and carry comparisons use outputs from the code before removal. [verified]
- The endpoint listener catches a restored hosted request despite the offline model preload. [verified]

**The catch**

- Both skills still name removed paths. ADR 0009 preserves their bytes for batch-6 check B6-26. [verified]
- S4 and S6 belong to the parent. This run excludes both tests. [verified]
- X1 explicitly skips its ripgrep subtest when that box-specific store is absent. [verified]
- The ripgrep store is present on this box, and all three queries pass. [verified]
- Fleet memory is unavailable. The brief restricts written artifacts to `test/`, so this report stays here. [verified]

**Next**

- The parent resolves the skill-byte conflict and runs S4 and S6.

## Coverage

| Item | Check | Result |
| --- | --- | --- |
| X1 | Three fixture queries and three read-only ripgrep queries compare status, stdout and stderr with baseline goldens. | Pass |
| X2 | Six required argument forms, plus malformed and reversed ranges, run against existing and missing stores. | Pass |
| X2 side effects | Target/store filesystem guards, model import trace and forbidden tool wrappers stay silent for every rejection. | Pass |
| X3 | Removed source modules and imports are absent. Dependencies and lock bytes match baseline; transformers remains installed. | Pass |
| X4 | Help, README, bin and every recipe omit removed options and settings. | Pass |
| X4 skills | Both skill files violate the removal contract but match the frozen `c92205d` bytes. | Expected failure, TODO |
| X5 | Why, impact, symbol carry and range carry compare status, stdout and stderr with baseline goldens. | Pass |
| X5 store | All recipe bytes, 93 nodes, 139 relationships, all properties and 12 index definitions match baseline. | Pass |
| X6 | Eight candidates exceed the old threshold. Five setting values produce identical baseline output and no endpoint request. | Pass |
| X7 | Deleted test targets are absent from entry points. All retained Q27 assertions match baseline, and its mutation anchor exists once. | Pass |
| X8 | Scorer output matches `eval/score.txt`; all 178 tracked eval files match baseline. | Pass |
| X8 B6-26 | Launcher and both skill files match `c92205d` bytes. | Pass |

- Index comparisons omit engine ids, generated names and usage counters. These fields do not define the schema. [verified]
- Logical data comparisons include vectors. They do not claim physical database-file equality. [verified]
- The goldens do not use `/tmp/whygraph-cut-reranker-evidence`. [verified]

## Plants

| Plant | Red test | First failing assertion |
| --- | --- | --- |
| Search output gains one space | X1 | `fixture round tax half to even: stdout bytes` |
| `--at` is accepted and ignored | X2 | `no file/store/tool access`; the Git trap records `tool invoked` |
| Unknown-option exit changes to 1 | X2 | `exit status`; `1 !== 2` |
| Old variable triggers a request | X6 | `no ranking endpoint request`; `1 !== 0` |
| Old variable prints a notice | X6 | `stderr bytes`; `Former setting ignored` differs from empty stderr |
| Removed import returns | X3 | `src/ask.ts: removed import ./rerank.ts` |
| Unknown-option handling reads the store first | X2 | `no file/store/tool access`; the guard records `existsSync .../existing-store` |
| Retained Q27 author-line mutation | Q27 | Candidate line count; `21 !== 15` |

- Each plant runs against a separate source copy. Each test exits 1. [verified]
- `test-results/cut-plants-zMK3kt/summary.json` records all first failing assertions and their TAP paths. [verified]

## Commands

```sh
export PATH="$HOME/.npm-global/bin:$HOME/.local/share/mise/installs/pnpm/12.11.2:$HOME/.local/bin:$PATH"
pnpm check
node_modules/.bin/memod lint
TMPDIR=/mnt/ssd/tmp systemd-run --user --scope -q -p MemoryMax=6G -p CPUQuota=400% pnpm test --test-skip-pattern='^S[46] '
TMPDIR=/mnt/ssd/tmp systemd-run --user --scope -q -p MemoryMax=6G -p CPUQuota=400% node test/cut-reranker-plants.mjs
```

- Both `pnpm check` and memod lint exit 0. [verified]
- The plant command exits 0 after detecting all eight faults. [verified]
- The full suite exits 0: 235 tests, 234 passed, 0 failed, 0 skipped and 1 TODO. [verified]
- S4 and S6 are excluded by the required name pattern; this Node runner does not count them as skips. [verified]
- The baseline had 225 passing tests. The new file adds nine passing checks and one expected failure. [verified]
- Full TAP report: `test-results/2026-11-15T18-30-12-287Z-1521996.tap`. [verified]

To regenerate the goldens:

```sh
TMPDIR=/mnt/ssd/tmp systemd-run --user --scope -q -p MemoryMax=6G -p CPUQuota=400% node test/cut-reranker-goldens.mjs
```

- The generator uses the cached local model with `test/search-offline.mjs`. [verified]
- Every relate process receives `RELATE_TELEMETRY=0` and `DO_NOT_TRACK=1`. [verified]
- The generator reads the existing ripgrep store without rebuilding it. [verified]
- Small checks preceded full generation, all removal tests, the mutation batch and the full suite. [verified]

## Contract disagreements

- X4 requires current skills to omit removed paths. Both frozen files still name `--at` and `WHYGRAPH_RERANK`. [verified]
- The expected failure names ADR 0009 and B6-26. No skill file changes in this task. [verified]
- The tested executable behavior has no other disagreement with X1–X8. [verified]

## Retained scratch

All paths below are relative to the repository root.

| Folder | Evidence |
| --- | --- |
| `test-results/cut-goldens-hJoccn` | Final baseline source extraction, fixture repo and baseline stores |
| `test-results/cut-plants-zMK3kt` | Eight planted source copies, red TAP reports and first-assertion summary |
| `test-results/scratch/2026-11-15T18-26-39-919Z-1358457` | Initial X2 smoke check |
| `test-results/scratch/2026-11-15T18-27-48-583Z-1412461` | Focused X1–X8 run |
| `test-results/scratch/2026-11-15T18-30-12-287Z-1521996` | Full suite fixtures and command logs |

- Superseded generator scratch and the one-plant smoke copy were removed. [verified]
- This task creates no project checkout or worktree. Each test closes its child processes and listeners. [verified]

[[whygraph-search]]

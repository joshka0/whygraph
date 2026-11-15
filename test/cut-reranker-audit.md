# Reranker removal test audit

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

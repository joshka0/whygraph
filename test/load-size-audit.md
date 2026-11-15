# Load size contract audit

> [!abstract] Answer
> B37–B46 pass in focused checks through the public planner and real loader.
> All ten planted faults fail their assigned checks. The full suite passes: 238 tests, zero failures.

**What changed**

- Add ten contract tests and a repeatable plant runner under `test/`.
- Include the new file in `test/run.mjs`. Production files stay unchanged.

**Why it matters**

- Tests check byte and row limits independently of production constants.
- Real relate verifies fetched bindings, large loads, WAL errors and parameter errors.

**The catch**

- B44 constructs vectors at the planner boundary. It does not run the CLI embedding pass.
- The parent’s Hono result is evidence only: 4,770 records, 128 statements, exit 0, 2026-11-15.
- A repeat Hono CLI build with saved per-label/type counts covers that remaining B44 scope.
- Existing A2 and U5 checks verify the fixture’s exact node and relationship counts.
- No code/contract disagreement was found in the focused checks or full suite.

**Next**

- Parent can review the test-only commit. No decision is parked.

## Governing records

- `docs/failures.md`: B37–B46 define the expected results.
- `src/load.pure.ts`: postconditions define byte limits, preserved rows, index order and bindings.
- `src/store.ts`: postconditions define publication and failure cleanup.
- ADR 0001 defines the full-text and vector indexes.
- ADR 0006 defines record authors. ADR 0007 defines the reduced graph and fixture counts.

## Coverage

| Item | Check |
| --- | --- |
| B37 | Measure serialized UTF-8 arrays for File, NAMES and STATES rows; check maximal splits. |
| B38 | Place an oversized row first, middle and last; compare all content and neighbors. |
| B39 | Require ten index statements, null parameters and no empty row statements. |
| B40 | Preserve node, edge and item values, duplicates, row order and shape order. |
| B41 | Check final plan positions; capture every fetch file; forward to real relate and query stored rows. |
| B42 | Check exact budget and one extra byte, Unicode, surrogate pairs, lone surrogates and JSON escapes. |
| B43 | Check 5000/5001 rows and both counters after a size split. |
| B44 | Load 4,200 records with long text and 384-float vectors; query all contents, edges and both indexes. |
| B45 | Reach real WAL failure with one File row below the parameter cap; preserve prior link and graph. |
| B46 | Reach real parameter failure with one File row; preserve prior link and graph. |

## Real loader evidence

- B44: 4,200 records, 83 statements, 71,173,201 bytes in the original Decision array.
- B44 loads 4,200 Decision nodes, 4,200 Item nodes, 4,200 STATES edges and 4,199 RESTS_ON edges.
- B44 queries every record, vector and item. Both indexes return five valid records.
- B45 passes a 67,108,862-byte array, two bytes below the parameter cap.
- B45 returns status 1 with the WAL error and `statement 11 of 11 failed`.
- B46 returns status 1 with `--fetch-params p10` and `source exceeded the 64 MiB cap`.
- B45/B46 retain the prior link and graph and remove the failed build folder.
- The initial 40 MiB B45 probe succeeded. It did not meet the WAL-failure precondition.

## Planted faults

| Plant | Test that fails | First failing assertion |
| --- | --- |
| utf16-code-units | B42 | one extra byte splits |
| exact-budget-one-row-early | B42 | exact-budget array stays together |
| exact-budget-one-row-late | B42 | one extra byte splits |
| oversized-row-merged | B38 | oversized row and neighbors need separate statements |
| oversized-row-dropped | B38 | oversized row and neighbors need separate statements |
| statement-row-order-reversed | B40 | file order/content/duplicates: row 1 |
| parameter-name-out-of-step | B41 | binding must follow final plan position |
| empty-statement-emitted | B39 | eight node keys and two search indexes |
| row-counter-not-reset | B43 | size split resets row and byte counters |
| byte-counter-not-reset | B43 | size split resets row and byte counters |

- Each plant exits 1 with exactly one assigned contract test red.
- The unmodified B37–B43 control exits 0: seven pass, zero fail.
- The first plant run stopped before completion. The final run above supersedes it.

## Commands

```sh
export PATH="$HOME/.npm-global/bin:$HOME/.local/share/mise/installs/pnpm/12.11.2:$HOME/.local/bin:$PATH"
pnpm check
node_modules/.bin/memod lint
TMPDIR=/mnt/ssd/tmp systemd-run --user --scope -q -p MemoryMax=6G -p CPUQuota=400% pnpm test
TMPDIR=/mnt/ssd/tmp systemd-run --user --scope -q -p MemoryMax=6G -p CPUQuota=400% node test/load-size-plants.mjs
```

- `pnpm check` exits 0. `memod lint` exits 0.
- The final plant command exits 0. The full suite exits 0: 238 pass, zero fail, zero skip.
- Full-suite TAP: `test-results/2026-11-15T10-26-37-830Z-3437952.tap`.
- Plant TAP, copied subjects, mutation descriptions and summary:
  `test-results/load-size-plants-1794738354570-3408279/`.

## Retained scratch folders

- `test-results/scratch/2026-11-15T10-26-37-830Z-3437952/`
- `test-results/load-size-plants-1794738354570-3408279/`
- `test-results/load-size-plants-1794738287175-3361787/` (incomplete first plant run)
- `test-results/load-size-small/`
- `test-results/load-size-pure/`
- `test-results/load-size-e2e/`
- `test-results/load-size-caps/` (first WAL probe and real parameter-cap result)
- `test-results/load-size-wal-boundary/`
- `test-results/load-size-large/`

- Preserve the pre-existing untracked `scratch/` folder. Its contents were not read or changed.
- No task checkout, package install, push or background service was created.
- The retained full-suite evidence includes the existing B27 fixture worktree.
- Fleet memory and the shared summary command are unavailable; this file is the review artifact.

[[whygraph-relate-loader]]

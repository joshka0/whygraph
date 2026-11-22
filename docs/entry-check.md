# Entry checks

## Frozen test run, 2026-11-23

The packaging branch fast-forwarded to `entry-tests-frozen-1`
(`d2e145863ba93193056883a8fa64f49c092aff10`). A fresh full-history
clone used an empty home. The separate memod source checkout was hidden.
The clone had no local `eval/results`. `WHYGRAPH_EVAL_RESULTS` pointed to
the original pilot results, mounted read-only. The resource limits were
the same as in the original run below.

| Command | Exit | Result |
| --- | ---: | --- |
| `pnpm install --frozen-lockfile` through Socket Firewall | 0 | 49 packages installed |
| `pnpm check` | 0 | 0 type errors |
| `node_modules/.bin/memod lint` | 0 | 0 findings |
| `whygraph build --decisions ../adrs.json --decisions decisions/notes.json` in the shop fixture | 0 | 9 commits, 5 decision records, 93 nodes, 139 relationships, 0 warnings |
| `node test/run.mjs` | 0 | 237 passed, 0 failed, 0 skipped, 0 known-red exceptions. X3 and X8 both passed |
| `node eval/selftest/check.mjs` | 1 | 22 scorer verdicts passed. Test collection then stopped on a missing archive before the ticket checks ran |
| Eval self-tests B7-108 (scorer), B7-132 and B7-219, run directly | 0 each | All three frozen checks passed using the real pilot data |
| Eval self-tests B7-152/B7-166, B7-177, B7-185, B7-199 and B7-208, run directly | 1 each | All five compared the entire report with an older commit and rejected the 525 appended batch 7 lines |

The eval self-test opens
`eval/results/_smoke-archive/6-stop-logged-as-failure/_attempts`
relative to the clone. That directory exists in the supplied trial data.
The archive reader in `eval/selftest/batch7-spy-block.mjs` uses the
checkout path directly.

B7-108's rehearsal requires a short checkout path for Unix sockets and
creates its own Linux namespace. The first attempt exceeded the socket
path limit. A short mount inside the install-check namespace prevented
the rehearsal from creating its namespace. Moving the same clone to a
short path on the SSD and running the rehearsal under its own isolation
resolved both setup errors.

B7-199 and B7-208 ran in the checkout containing the archives. Across
the six Git revisions used by the five failing checks, only
`eval/score.txt` differed among the protected files. The packaging
branch includes the frozen tests unchanged.

## Original packaging run, 2026-11-20

A fresh clone installed and built the shop graph with the separate memod
source directory hidden. Both README quickstart commands, tsrs and lint
passed. The following results describe the commits tested on that date.

## Environment

Linux, Bash, Git, Node 26.5.1, pnpm 10.28.2 and Relate 1.0.1. The clone
had full history. The first install started with an empty home, an empty
package store and no model cache. The clone had no trial results.

The commands below use these names: `$BRANCH` is
`whygraph-entry-packaging`, `$SOURCE` is its worktree, and `$RUN` is the
scratch directory on the SSD. `$MEMOD_SOURCE` is the separate memod
checkout. The clone used `$RUN/clone/bin` and
`$RUN/clone/node_modules/.bin` first on PATH. Each check ran separately
under these limits:

```sh
TMPDIR=/mnt/ssd/tmp systemd-run --user --scope -q \
  -p MemoryMax=6G -p MemorySwapMax=0 -p CPUQuota=200% <command>
```

Inside that scope, the cold checks used
`env HOME="$RUN/home" RELATE_TELEMETRY=0 DO_NOT_TRACK=1` and
`bwrap --bind / / --dev /dev --tmpfs "$MEMOD_SOURCE" --`.
The first install and Relate CSV query used the same mount configuration
without `--dev /dev`. That setup prevented Git from opening `/dev/null`
during the first lint run (exit 1). The check then supplied `/dev` and
reran lint successfully. These tools and limits belong to the check.
The README lists the tools needed to use whygraph.

## Commands and outcomes

| Command | Exit | Observed result |
| --- | ---: | --- |
| `git clone --no-local --branch "$BRANCH" "$SOURCE" "$RUN/clone"` | 0 | New full-history clone at `f8808a4` |
| `sfw /home/dev/.npm-global/bin/pnpm install --frozen-lockfile` | 0 | 49 packages downloaded, 49 added, 0 reused |
| `test ! -e "$MEMOD_SOURCE/package.json"` inside the namespace | 0 | The separate source package was inaccessible |
| `scripts/fixture.sh ../cold-shop` | 0 | 9 commits, head `0ede283` |
| In the shop, `whygraph decisions adr docs/adr > ../cold-adrs.json` | 0 | 3 ADRs |
| `whygraph build --decisions ../cold-adrs.json --decisions decisions/notes.json` | 0 | 2 decision files, 5 records, 93 nodes, 139 relationships, 0 warnings |
| `node test/run.mjs` | 1 | 237 tests, 232 passed, 5 failed, 0 skipped. B22, E4, R5, X3 and X8 failed |
| `git pull --ff-only` from the packaging worktree | 0 | Updated the clone to `c98eea5` after fixing the three Relate test wrappers |
| Both shell blocks in the [README quickstart](../README.md#quickstart), verbatim | 0 each | Relate returned 2 commit rows. whygraph reported 5 affected symbols |
| `node_modules/.bin/tsrs -p tsconfig.json` | 0 | 0 diagnostics |
| `node_modules/.bin/memod lint` | 0 | 0 findings |
| `node test/run.mjs '--test-name-pattern=^(B22\|E4\|R5\|X3\|X8) '` | 1 | B22, E4 and R5 passed. X3 and X8 failed |
| `node eval/score.mjs --results "$PILOT_RESULTS" > "$RUN/pilot-score.txt"` on the saved trials | 0 | 188,961 bytes, including 256 finished batch 7 cells |
| `cmp "$RUN/pilot-score.txt" eval/score.txt` | 0 | Identical report |
| `node eval/score.mjs > ../clone-score.txt` in the clean clone | 0 | 0 finished runs, 2,370 bytes |
| `cmp -s eval/score.txt ../clone-score.txt` | 1 | The clean clone cannot reproduce the saved report |
| Existing self-test cases B7-132 and B7-219, run directly (below) | 1 | Both failed. The full eval self-test did not run |
| `git grep -ailF -f "$PRIVATE_WORDS" HEAD --` | 1 | 0 matching files (Git's no-match status). The unpacked memod package also had 0 hits |

All commits used the repository's memod pre-commit hook. The private-word
list was checked separately. Its entries stay outside the repository.

## Failures observed on 2026-11-20

- **X3.** The reranker-removal test compares all runtime dependencies with
  the manifest at `42ab13f`. That comparison rejects the bundled memod runtime.
  The X3 contract in [the failure list](failures.md) concerns dependencies
  used only by the removed reranker. [ADR 0009](adr/0009-unused-search-options-removed.md)
  records the removal and [ADR 0014](adr/0014-distribute-the-shop-graph.md)
  records the packaging decision.
- **X8 and B7-108.** Both compare the default scorer output to
  `eval/score.txt`. Git tracks zero files under `eval/results`. The original
  checkout holds the saved trials. The new report matches the scorer there.
- **B7-132 and B7-219.** In a fresh clone B7-132 cannot enumerate
  `eval/results`. Even with results supplied, multiple historical checks
  require the *whole* score file to equal an older commit. The first
  153,320 bytes match the pre-pilot file exactly. The new file adds 525 lines.
  B7-219 rejects that addition against `513b9be`.

At `c98eea5`, the following command reproduced the two self-test failures:

```sh
node --input-type=module <<'JS'
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { batch7StartupChecks } from './eval/selftest/batch7-startup.mjs';
import { batch7MissingRangeFileChecks } from './eval/selftest/batch7-missing-range-file.mjs';
const scratch = mkdtempSync(join(tmpdir(), 'entry-selftest-'));
for (const [cases, id] of [[batch7StartupChecks, 'B7-132'], [batch7MissingRangeFileChecks, 'B7-219']]) {
  const check = (await cases({scratch})).find(c => c.name.startsWith('B7 ' + id + ' '));
  try { await check.run(); }
  catch (error) { console.error(id, error.message); process.exitCode = 1; }
}
JS
```

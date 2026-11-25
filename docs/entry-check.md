# Entry checks

**Verdict (2026-11-25): PASS on a clean Linux clone for all product commands, README checks, type checks, lint, and 236 of 237 contract tests on `Relate v1.2.0`; the remaining contract test (`X8`) and `eval/selftest/check.mjs` require the git-ignored saved trial data and fail on a clean clone by design (237 of 237 pass when the saved trial data is supplied).**

## Environment

- **Tested commit:** `b0ecfa323c6d641a6afd3135e3119d9a91dafbca`
- **Date:** 2026-11-25
- **OS:** Linux (`x86_64`); macOS is not tested
- **Tools:** Bash, Git `2.53.0`, Node.js `v26.5.1`, pnpm `10.28.2`, `Relate v1.2.0` (`License: Apache 2.0 (binary)`, `relate-linux-amd64` SHA-256 `03e05e7cf25eec498e328837a3b6636c7a4807410b989e4b72948f1ebc8a99a5`)
- **Bundled sample store:** `examples/shop.rl` (77,824 bytes, SHA-256 `f6b8cff12eb9951696659fcd37810603dba52675ebe9d0a39e8410e4445d83be`) opens unchanged on both Relate `1.0.1` and `Relate v1.2.0`. The recorded trials in `eval/` ran on Relate `1.0.1`.

## Commands and outcomes

All commands ran from a fresh full-history clone with a clean `HOME` and no separate `memod` source checkout.

| Command | Exit | Result |
| --- | ---: | --- |
| Relate query in [README Setup and run](../README.md#setup-and-run) on `examples/shop.rl` | 0 | Exact byte match to README output; `examples/shop.rl` SHA-256 and `git status` unchanged (also verified offline and with `CLAUDECODE=1` piped stdout) |
| `pnpm install --frozen-lockfile` | 0 | 49 packages installed (includes bundled `vendor/memod-0.2.0.tgz`) |
| `whygraph impact note-2 --store examples/shop.rl` | 0 | 5 affected symbols; matches freshly built fixture store (also verified alongside an open `--read-only` Relate shell) |
| `scripts/fixture.sh` + `whygraph decisions adr docs/adr` + `whygraph build` | 0 | 9 commits (`0ede283`), 5 decision records, 93 nodes, 139 relationships, 0 warnings |
| `pnpm check` | 0 | 0 type errors |
| `node_modules/.bin/memod lint` | 0 | 0 findings |
| `node scripts/readme-check.mjs` | 0 | 14 commands, 0 drifted |
| `node test/run.mjs` (clean clone, no saved trial data) | 1 | 236 passed, 1 failed (`X8` fails by design without `WHYGRAPH_EVAL_RESULTS`; `S4`, `S5`, and `S6` pass when `claude` and `codex` are on `PATH`) |
| `node test/run.mjs` (with `WHYGRAPH_EVAL_RESULTS` set to saved trial data) | 0 | 237 passed, 0 failed, 0 skipped, 0 known-red exceptions (`X3` and `X8` pass) |
| `node eval/score.mjs` (clean clone) | 0 | 0 finished runs (2,370 bytes; differs from `eval/score.txt` by design) |
| `node eval/score.mjs --results <saved-trial-data>` | 0 | 188,961 bytes, byte-for-byte identical to `eval/score.txt` |
| `node eval/selftest/check.mjs` (clean clone) | 1 | Fails by design without the git-ignored saved trial archives |

## Notes

- On `examples/shop.rl`, `Relate v1.2.0` returns 93 nodes and 139 relationships with exact per-label and per-type counts matching `README.md`, both `decision_search` (full-text) and `decision_search_vector` (vector) indexes `ONLINE`, and exact matches for `why`, `carry`, `impact`, and `search`.
- Opening a writable Relate shell on a store while running `whygraph impact` exits 1 with Relate's storage-lock error (`exit 5`); opening a `--read-only` shell as shown in [README Setup and run](../README.md#setup-and-run) does not block `impact`.
- The earlier 2026-11-20 and 2026-11-23 packaging check tables remain in Git history (commit `699f991` and `b0ecfa3`).

## Files changed since tested SHA (`b0ecfa3`)

Only documentation and ADR files changed on this branch after `b0ecfa3` (no edits to `src/`, `recipes/`, `skills/`, `test/`, `vendor/`, `examples/shop.rl`, `eval/registry.json`, `eval/score.txt`, `eval/score.mjs`, or `eval/selftest/`):

- `AGENTS.md`
- `README.md`
- `docs/adr/0004-optional-reranker.md`
- `docs/adr/0008-eval-ticket-registry.md`
- `docs/adr/0009-unused-search-options-removed.md`
- `docs/adr/0010-eval-instruction-history.md`
- `docs/adr/0011-eval-closed-store.md`
- `docs/adr/0012-ticket-record-outcomes.md`
- `docs/adr/0013-eval-rehearsal.md`
- `docs/adr/0014-distribute-the-shop-graph.md`
- `docs/adr/0015-license-the-bundled-memod-package.md`
- `docs/entry-check.md`
- `docs/failures.md`
- `eval/README.md` (dated note appended only)

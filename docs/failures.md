# How whygraph can fail or answer wrong

Each entry is an input and the result a test must observe. "Exit n" is the
process exit status; "stderr names X" means the text X appears on stderr.
Tests run whygraph as a process (`node src/main.ts ...`) with `git`, `relate`
and `memod` on `PATH` unless the entry says otherwise.

## The fixture

`scripts/fixture.sh <folder>` builds the shared fixture repo. Its commit ids
are fixed (fixed author, committer and dates):

| Commit | Branch | What |
| --- | --- | --- |
| `b8dc7c9` | main | `src/money.ts` (`cents` with a `decided:` tag, `formatCents`), `src/cart.ts` (`total` uses both), ADR 0001 |
| `1c8e848` | main | `src/tax.ts` (header `decided:` tag; `taxRate`, `taxOf` uses `cents` and `taxRate`), ADR 0002 (cites ADR 0001) |
| `d6d2473` | regional | `taxRate` takes a region and gets a `decided:` tag, ADR 0003 (supersedes ADR 0002, cites ADR 0001) |
| `21c643d` | main | `formatCents` with separators; message names ADR 0001 |
| `81ce56b` | main | merge of `regional` |
| `5292faa` | main | `src/lib.rs` with `round_cents` (Rust: no symbol uses) |
| `6821866` | main | `decisions/notes.json`: `note-1` (rests on ADR-0002, cites `1c8e848`), `note-2` (rests on `note-1`, cites `21c643d`) |

"The fixture build" below means, in the fixture:
`whygraph decisions adr docs/adr > adrs.json` then
`whygraph build --decisions adrs.json --decisions decisions/notes.json`.

## Expected answers on the fixture

| ID | Input | Required result |
| --- | --- | --- |
| A1 | `decisions adr docs/adr` | Exit 0. Records `ADR-0001`..`ADR-0003` in that order. ADR-0001 commits: `21c643d...`, `b8dc7c9...` (full ids). ADR-0002: restsOn `[ADR-0001]`, commits `[1c8e848...]`. ADR-0003: supersedes `[ADR-0002]`, restsOn `[ADR-0001]`, commits `[d6d2473...]`. Each has status `accepted`, its date, topic, and items `context` and `choice`. |
| A2 | the fixture build | Exit 0. stdout counts: 7 Commit, 3 DecidedTag, 5 Decision, 4 File, 8 Item, 6 Symbol, 4 Topic; 14 CHANGES, 6 CITES, 1 SUPERSEDES, 4 RESTS_ON, 4 USES. No warning. |
| A3 | `why src/tax.ts:taxRate` | Exit 0. The doc-comment tag "the rate depends on the region ...", the header tag "tax lives apart from the cart ...", then records in this order: ADR-0002 (superseded by ADR-0003, changed by `1c8e848`), note-1 (changed by `1c8e848`), ADR-0003 (changed by `d6d2473`). |
| A4 | `why src/tax.ts:taxOf` | ADR-0002 and note-1 only: `d6d2473` did not change `taxOf`'s code. |
| A5 | `impact ADR-0002` | Exit 0. ADR-0002 itself (superseded by ADR-0003; `taxRate` 1 user, `taxOf` 0 users), note-1 directly, note-2 through 1 other record (`formatCents`, 1 user). "3 distinct symbols in all." |
| A6 | `impact ADR-0001` | ADR-0001 with the symbols `b8dc7c9` and `21c643d` changed; ADR-0002, ADR-0003 rest on it directly; note-1 and note-2 through others. ADR-0003 is listed although it supersedes ADR-0002. |
| A7 | `carry src/money.ts:cents` | Topic `fx-money`, no other owner; no check; users: `src/cart.ts:total` and `src/tax.ts:taxOf` at distance 1. |
| A8 | `carry src/money.ts:formatCents` | Commits `21c643d` then `b8dc7c9` (newest first); records ADR-0001 (changed by both) and note-2. |

## build

| ID | Input | Required result |
| --- | --- | --- |
| B1 | A repo with no commits and one `.ts` file; `build` | Exit 0. stderr: "the repo has no commits". Symbols and files load; 0 Commit nodes; `why` on the symbol says no record cites a commit; `carry` says no commit changed it. |
| B2 | A repo with no commits and a decisions file citing `abcd` | Exit 0; warning names the record and `abcd`; no CITES edge. |
| B3 | An empty repo (no files, no commits) | Exit 0; "0 nodes", "(none)". A later `why x.ts:f` exits 3 and says no file `x.ts`. |
| B4 | `build` without `--decisions` | Exit 0; 0 Decision nodes. `impact X` exits 3 and says the store holds no decision records. |
| B5 | A record citing a commit id that is not in the history of HEAD (also: a commit only on an unmerged branch) | Exit 0. One stderr warning per id: `record <id>: commit "<c>" matches no commit reachable from HEAD; the link is dropped`. The record loads without that CITES edge. |
| B6 | A record citing a short id that prefixes two commits | Exit 0. Warning names the record, the short id, and both full ids sorted; no CITES edge to either. |
| B7 | A record citing `123` (fewer than 4 hex digits) or `HEAD` or a branch name | Treated as unknown (B5): whygraph never resolves refs. |
| B8 | Two records with one id, in one file or in two files | Exit 1. stderr names the id and both files. The store is unchanged (the previous build still answers). |
| B9 | A supersedes B, B supersedes A | Exit 1. stderr: `supersedes cycle: A -> B -> A`. Store unchanged. |
| B10 | A record that supersedes itself | Exit 1: `supersedes cycle: A -> A`. |
| B11 | A three-record cycle A -> B -> C -> A among other valid records | Exit 1; the cycle is named once, starting at its smallest id. |
| B12 | `restsOn` cycle (A rests on B, B on A) | Exit 0, no warning. `impact A` lists B at depth 1 and A once, at depth 0; it terminates. |
| B13 | `restsOn` or `supersedes` naming a record no file has | Exit 0, warning names record, field and id; link dropped. |
| B14 | A decisions file that is not JSON, or not `{ "records": [...] }`, or has another top-level field | Exit 1; stderr names the file. Store unchanged. |
| B15 | A record with an unknown field (`"colour"`), `date` missing, `date` `"2026-1-1"`, `id` empty, `items` not `{label,text}`, a list field holding a non-string | Exit 1; one stderr line per problem naming file, record index and id. Store unchanged. |
| B16 | A record with `date: null` | Loads. In `why`, it lists after every dated record, shown as `undated`. |
| B17 | A record topic that no code owns | Loads as a Topic node with an ABOUT edge. |
| B18 | `--decisions` naming a missing file | Exit 1; stderr names the file. |
| B19 | `relate` not on `PATH` | Exit 1: "relate is not on PATH". No store is written. |
| B20 | `memod` not on `PATH` | Exit 1: "memod is not on PATH". |
| B21 | `memod` exits non-zero, or prints something that is not `{nodes, edges}` | Exit 1; stderr names memod's exit status and message, or says it printed no graph. Store unchanged. |
| B22 | A relate statement fails halfway through the load (simulate with a `relate` wrapper on `PATH` that appends a failing statement when its arguments contain `.store.builds`) | Exit 1; stderr carries relate's exit status and its "statement N of M failed" line. The store link still points at the previous build, which still answers; no new build folder is left in `.store.builds`. |
| B23 | Rebuild while a reader has the store open (`relate serve --mcp stdio --database <store> --read-only`, the command `whygraph mcp` prints) | The build exits 0 and is not blocked. The open reader keeps answering from the graph it opened. A reader opened after the build sees the new graph. Only one build folder remains. |
| B24 | Two builds; the second with fewer records | The second store holds only the second build's records: nothing is merged from the first. |
| B25 | `--store` naming an existing regular directory or file that whygraph did not create | Exit 1; stderr says it is not a whygraph store. The path is not touched. |
| B26 | `--repo` naming a folder outside any git repo, or run outside a repo | Exit 2: "... is not in a git repo". |
| B27 | Two worktrees of one clone | Each has its own default store (`<git dir>/whygraph/store`). |
| B28 | A merge commit (`81ce56b`) | Gets the CHANGES edges memod gives it (usually none); it is never cited unless a record names it. |
| B29 | A symbol deleted in a later commit | Has no node; commits that changed it give no edge; a record citing only those commits has no CHANGES path, and `impact` says its commits changed no symbol that exists now. |

## decisions adr

| ID | Input | Required result |
| --- | --- | --- |
| D1 | An ADR with no `Date:` line | Record `date: null`; exit 0. |
| D2 | An ADR with no `Status:` line and no `## Status` section (memod's ADRs) | `status: null`; answers print no status line. |
| D3 | A `## Status` section instead of a `Status:` line | `status` is its first line; the section is not an item. |
| D4 | No `# ` heading | `title: null`; answers print "(no title)". |
| D5 | ADR 0003 says `Supersedes ADR 0002` | ADR-0003 supersedes ADR-0002, and ADR-0002 is not in its restsOn. |
| D6 | ADR 0002 says `Superseded by ADR 0003` (and 0003 says nothing) | ADR-0003 supersedes ADR-0002. |
| D7 | ADR 0003 names ADR 0004 (a later ADR) | Not in ADR-0003's restsOn. |
| D8 | An ADR naming itself | Not in its own restsOn or supersedes. |
| D9 | A file `README.md` or `12-x.md` in the folder | Skipped; stderr: "skipped <name>". Exit 0 when at least one ADR exists. |
| D10 | A folder with no `NNNN-*.md` file, or a path that is not a folder | Exit 1, naming the folder. |
| D11 | A folder outside any git repo | Exit 0; stderr: not in a git repo; every record cites no commit. |
| D12 | A repo with no commits | Exit 0; stderr says so; no commits. |
| D13 | A renamed ADR file | The commits before the rename are cited too (`--follow`). |
| D14 | A commit message "see ADR 4" and one naming `0004-x.md` | Both cited by ADR-0004. "ADR 40" is not cited by ADR-0004. |
| D15 | Running twice | Byte-identical stdout. |

## why, carry

| ID | Input | Required result |
| --- | --- | --- |
| W1 | No store (no build yet) | Exit 1: "no store at <path>; run whygraph build first". |
| W2 | `src/money.ts:cent` (a near miss) | Exit 3; stderr names `src/money.ts` has no symbol `cent` and lists `src/money.ts:cents` first among close names. |
| W3 | `src/mony.ts:cents` (file not in the graph) | Exit 3; stderr says no file `src/mony.ts`, lists close files (`src/money.ts`) and the symbols named `cents` anywhere. |
| W4 | `README.md:x` (a file memod does not index) | Exit 3, as W3. |
| W5 | `src/money.ts` (no symbol), `src/money.ts:`, `:cents` | Exit 2: not `<file>:<symbol>`. |
| W6 | A symbol named like a file: `src/money.ts:cart.ts`, and `src/cart.ts` given where a symbol is expected | Exit 3 for the first (no such symbol; lists close symbols of `src/money.ts`), exit 2 for the second. Neither answers about `src/cart.ts`. |
| W7 | `../other/x.ts:f`, `/etc/x.ts:f`, `src/../../x.ts:f` | Exit 2: outside the repo, naming the repo root. |
| W8 | An absolute path inside the repo (`$PWD/src/money.ts:cents`) | Same answer as `src/money.ts:cents`. |
| W9 | `./src/money.ts:cents` and `src//money.ts:cents` | Same answer as `src/money.ts:cents`. |
| W10 | `carry src/lib.rs:round_cents` (Rust) | Exit 0. Says its users are unknown because memod reads uses only in TypeScript and JavaScript; never "No symbol uses it". |
| W11 | `carry` on a TypeScript symbol no one uses | "No symbol uses it." |
| W12 | `why` on a symbol with no tag and no record | Exit 0 with each part empty and the last line "No decision is recorded for it ...". |
| W13 | A symbol used only in types | Its users carry the `type` mark. |
| W14 | A uses cycle (a uses b, b uses a) | `carry a` lists b at distance 1 and never lists a itself; it terminates. |
| W15 | A record with a `status` and one superseded | `why` prints `status:` and `superseded by:` lines for it. |

## impact

| ID | Input | Required result |
| --- | --- | --- |
| I1 | An unknown id `ADR-4` | Exit 3; stderr lists `ADR-0004` as close. |
| I2 | An id with different case (`adr-0004`) | Exit 3 with `ADR-0004` as close: ids match exactly. |
| I3 | A record that cites no commit, or whose commits changed no symbol | Exit 0; "Its cited commits changed no symbol that exists now, or it cites no commit in this repo's history." |
| I4 | A symbol reached through two records | Listed under each record, counted once in "distinct symbols in all". |

## mcp

| ID | Input | Required result |
| --- | --- | --- |
| M1 | `mcp` with a store | Exit 0. stdout holds a JSON `mcpServers.whygraph` entry: `relate serve --mcp stdio --database <absolute store> --read-only` with env `RELATE_TELEMETRY=0`, `DO_NOT_TRACK=1`, then each recipe under `== <name>`. |
| M2 | Start the printed server; `tools/list` | Exactly `read_cypher` and `get_schema` (no `write_cypher`). |
| M3 | `read_cypher` with the `why` recipe and `{"symbol": "src/tax.ts#taxRate"}` | The rows that `whygraph why src/tax.ts:taxRate` renders (A3). |
| M4 | `mcp` with no store | Exit 1, as W1. |

## Every command

| ID | Input | Required result |
| --- | --- | --- |
| E1 | Determinism: each of `why`, `impact`, `carry`, `mcp`, `decisions adr` run twice, and again after a rebuild from the same repo state and decisions files | Byte-identical stdout. Build warnings are identical and sorted. |
| E2 | Unknown command, unknown option, `--repo` twice, a missing option value, an extra argument, `--decisions` on a non-build command | Exit 2 with a message naming the bad argument and the usage. |
| E3 | `help`, `--help`, no arguments | Exit 0, usage on stdout. |
| E4 | Any relate call | Runs with `RELATE_TELEMETRY=0` and `DO_NOT_TRACK=1` in its environment (check with a `relate` wrapper that records its environment). |
| E5 | A store that the relate on `PATH` cannot open (wrong version, damaged) | Exit 1: "relate query failed (exit n): <relate's message>". |

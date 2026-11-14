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
| `dfb4ff8` | main | `src/money.ts` (`cents` with a `decided:` tag naming `adr-0001`, `formatCents`), `src/cart.ts` (`total` uses both), ADR 0001 |
| `2a59506` | main | `src/tax.ts` (header `decided:` tag naming `ADR-0002`; `taxRate`, `taxOf` uses `cents` and `taxRate`), ADR 0002 (cites ADR 0001) |
| `78884f0` | regional | `taxRate` takes a region and gets a `decided:` tag naming `ADR 0003`, ADR 0003 (supersedes ADR 0002, cites ADR 0001) |
| `73ebd46` | main | `formatCents` with separators; the message names ADR 0001 in free text only, so it links to nothing |
| `13d52e8` | main | merge of `regional` |
| `6c572a2` | main | `src/lib.rs` with `round_cents` (Rust: memod reads symbol uses, but no symbol uses `round_cents`) |
| `47a233e` | main | `decisions/notes.json`: `note-1` (rests on ADR-0002, cites `2a59506`), `note-2` (rests on `note-1`, cites `73ebd46`) |
| `a3bcb76` | main | renames the amount parameter of `cents`, `formatCents`, `total`, `taxOf` and `round_cents`: a large commit (5 symbols) |
| `0ede283` | main | `src/rounding.ts` (`roundHalfEven` with a `decided:` tag naming no record and `verified: rounding-model`), `src/checkout.ts` (`checkout` with a `decided:` tag naming no record; uses `roundHalfEven`). No older symbol gains a user. Updates note-1 to cite only `a3bcb76` and note-2 to cite `73ebd46` and `a3bcb76`; this keeps a loose-only record and a record with two different commit counts. |

"The fixture build" below means, in the fixture:
`whygraph decisions adr docs/adr > adrs.json` then
`whygraph build --decisions adrs.json --decisions decisions/notes.json`.

## Expected answers on the fixture

| ID | Input | Required result |
| --- | --- | --- |
| A1 | `decisions adr docs/adr` | Exit 0. Records `ADR-0001`..`ADR-0003` in that order. ADR-0001 commits: `[dfb4ff8...]` only (full id; `73ebd46` names it in free text and is not cited). ADR-0002: restsOn `[ADR-0001]`, commits `[2a59506...]`. ADR-0003: supersedes `[ADR-0002]`, restsOn `[ADR-0001]`, commits `[78884f0...]`. Each has status `accepted`, its date, and items `context` and `choice`. |
| A2 | the fixture build | Exit 0. 93 nodes: Check 1, Commit 9, DecidedTag 5, Decision 5, File 6, Item 8, Symbol 8, Term 45, Topic 6. 139 relationships: CHANGES 27, CITES 6, DECIDED 5, DECLARES 8, MENTIONS 57, NAMES 3, OWNS 14, RESTS_ON 4, STATES 8, SUPERSEDES 1, USES 5, VERIFIED 1. No warning. |
| A3 | `why src/tax.ts:taxRate` | Exit 0. Doc-comment tag "the rate depends on the region ...", header tag "tax lives apart from the cart ... (ADR-0002)". Named records: ADR-0003 (doc comment, also cited by `78884f0`, 1 symbol), then ADR-0002 (header, superseded by ADR-0003, also cited by `2a59506`, 2 symbols). No records linked only through commits. Each record appears once. |
| A4 | `why src/tax.ts:taxOf` | Named by a tag: ADR-0002 (header). Linked only through a commit, tightest first: note-1 then note-2 (both `a3bcb76`, 5 symbols, date breaks the tie). Neither ADR-0001 nor ADR-0003 links: their listed commits did not change taxOf, and no taxOf tag names them. |
| A5 | `impact ADR-0002` | Exit 0. ADR-0002 itself (superseded by ADR-0003): no symbol tag names it; file `src/tax.ts` named by its header tag; commit `2a59506` (2 symbols): taxRate 1 user, taxOf 0. note-1 directly: no tag, `a3bcb76` (5 symbols): cents 2 users, formatCents 1, total 0, taxOf 0, round_cents 0. note-2 through 1 other record: `73ebd46` (1 symbol) and `a3bcb76` (5 symbols), same five symbols. "6 distinct symbols in all: 0 named by a decided: tag, 6 reached only through a commit." |
| A6 | `impact ADR-0001` | ADR-0001: cents named by its tag (2 users); only `dfb4ff8` cites it (3 symbols); formatCents (1 user) and total (0) are other changed symbols. ADR-0002 and ADR-0003 rest on it directly; ADR-0003 names taxRate and its commit changed no other current symbol. note-1 and note-2 rest on it through others and cite commits as A5. "6 distinct symbols in all: 2 named by a decided: tag, 4 reached only through a commit." |
| A7 | `carry src/money.ts:cents` | Topic `fx-money`, no other owner; no check; ADR-0001 named by its doc-comment tag; note-1 then note-2 linked only through `a3bcb76` (5 symbols each); users: `src/cart.ts:total` and `src/tax.ts:taxOf` at distance 1; commits `a3bcb76` then `dfb4ff8`. |
| A8 | `carry src/money.ts:formatCents` | Commits `a3bcb76`, `73ebd46`, `dfb4ff8` (newest first); no tag names a record; records linked only through a commit, tightest first: note-2 (`73ebd46`, 1 symbol, then `a3bcb76`, 5 symbols), ADR-0001 (`dfb4ff8`, 3 symbols), note-1 (`a3bcb76`, 5 symbols). No premise-memo line. |

## build

| ID | Input | Required result |
| --- | --- | --- |
| B1 | A repo with no commits and one `.ts` file; `build` | Exit 0. stderr: "the repo has no commits". Symbols and files load; 0 Commit nodes; `why` on the symbol says no record cites a commit; `carry` says no commit changed it. |
| B2 | A repo with no commits and a decisions file citing `abcd` | Exit 0; warning names the record and `abcd`; no CITES edge. |
| B3 | An empty repo (no files, no commits) | Exit 0; "0 nodes", "(none)". A later `why x.ts:f` exits 3 and says no file `x.ts`. |
| B4 | `build` without `--decisions` | Exit 0; 0 Decision nodes; 0 NAMES and 0 CITES. `impact X` exits 3 and says the store holds no decision records. On the fixture, stderr warns once for each tag that names an ADR (L4): 3 warnings, sorted. |
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
| B16 | A record with `date: null` | Loads. In `why`, among records whose tightest commit changed the same number of symbols, it lists after every dated one, shown as `undated`. |
| B17 | A record with a `topics` field, even an empty list | Exit 1; stderr names the decisions file, record index and id, and `unknown field "topics"`. Store unchanged (U1). |
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
| B28 | A merge commit (`13d52e8`) | Gets the CHANGES edges memod gives it (usually none); it is never cited unless a record names it. |
| B29 | A symbol deleted in a later commit | Has no node; commits that changed it give no edge; a record citing only those commits has no CHANGES path, and `impact` says its commits changed no symbol that exists now. |
| B30 | A record with `"author": "R. Chen"` | Build exit 0. The record loads, and where an answer prints the record's lines, an `author:` line appears (W28, W29, I6). |
| B31 | A record with no `author` field | Loads as if `"author": null`: no `author:` line is printed, and the node's `author` is null. |
| B32 | A record with `"author": null` | Loads. No `author:` line is printed, and the node's `author` is null. |
| B33 | A record with `"author": ""`, and one with `"author": "   "` | Exit 1; store unchanged. One stderr line per record, naming the file, the record index and id, and `"author" must not be empty`. |
| B34 | A record with `"author": 7`, and one with `"author": ["x"]` | Exit 1; store unchanged. One stderr line per record, naming the file, the record index and id, and `"author" must be a string or null`. |
| B35 | The node a build stores for a record | A record with an author gives `MATCH (d:Decision {id: "<id>"}) RETURN d.author` that string; a record with none (absent or null) gives null. |
| B36 | Two decisions files, one record with an author in each, and one record with none in either | Build exit 0. Every `Decision` holds its own file's author; nothing is merged from the other file and the record with none holds null. |

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
| D13 | An ADR file added, edited, renamed, edited again | The record cites only the commit that added the original file (`--follow`): not the edits, not the rename. |
| D14 | A commit message "see ADR 4", one naming `0004-x.md`, one "See ADR 40", none adding the ADR file | None is cited by ADR-0004: `decisions adr` cites only the commit that added the ADR file. Message text creates no link. |
| D16 | A later commit edits ADR 0003 and changes code, with or without `Decision: ADR-0003` | Not cited by the generated ADR-0003 record (memod: `1fa2df7` edits `0003-graph-output-contract.md` and is cited only by ADR-0004, which it added). A later commit links only if a record lists it in `commits`. |
| D15 | Running twice | Byte-identical stdout. |
| D17 | Two files with one number, an ADR and a companion (memoryd at `109d1a6`: `0038-mem-recap.md` and `0038-mem-recap-failures.md`, `0039-confirmed-closures.md` and `0039-layer2-failures.md`) | **Open, not met yet.** Today each file becomes a record `ADR-0038`, and `build` rejects the decisions file under B8, so the README's two commands build no store for such a repo. The required result is still to be decided; until then the eval leaves the two companion files out of memoryd's decisions file (`eval/README.md`). |

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
| W10 | `carry src/lib.rs:round_cents` (the fixture's Rust symbol, which no symbol uses) | Exit 0. memod gives Rust `uses` edges, so the answer has the TypeScript shape, not "unknown": the one-step part is `One step away: no decided: tag, decision record, formal check or topic on the 0 symbols round_cents uses, 0 symbols that use round_cents, or in the headers of their files.`, then `Searched: src/lib.rs:round_cents, the header of src/lib.rs, the 0 symbols round_cents uses, 0 symbols that use round_cents, and the headers of their files.` and `Not searched: symbols further away (run carry on a neighbor to look past it); code in languages without symbol edges (memod reads uses only in TypeScript, JavaScript, Rust and Swift); uses the graph cannot see, such as a function passed as a value or called through an interface; records linked to a neighbor only through a commit.` (no `Nothing found` line, because the symbol owns the topic `fx-native`). The users part is `No symbol uses it.` Never `One step away: unknown` and never `Its users are unknown`. |
| W11 | `carry` on a TypeScript symbol no one uses | "No symbol uses it." |
| W12 | `why` on a symbol with no tag and no record | Exit 0 with each part empty and the last line "No decision is recorded for it ...". |
| W16 | `why` on a symbol whose `decided:` tag names no record, and no commit links a record | Exit 0. The tag's text and reason under "Decided in its doc comment:"; "No decided: tag names a decision record."; no "No decision is recorded" line, because the tag is the decision. |
| W13 | A symbol used only in types | Its users carry the `type` mark. |
| W14 | A uses cycle (a uses b, b uses a) | `carry a` lists b at distance 1 and never lists a itself; it terminates. |
| W15 | A record with a `status` and one superseded | `why` prints `status:` and `superseded by:` lines for it. |
| W17 | A Rust symbol that a Rust symbol uses: `src/lib.rs` holds `pub fn helper() -> i64 { 1 }` and `pub fn caller() -> i64 { helper() }` | Exit 0. `carry src/lib.rs:helper` lists one direct user: `1 symbol uses it directly, 1 in all (distance n: through n-1 other symbols; type: only a type use):` then `   1  src/lib.rs:caller`. Its one-step part is `One step away: no decided: tag, decision record, formal check or topic on the 0 symbols helper uses, 1 symbol that uses helper, or in the headers of their files.`, `Nothing found in what was searched; that does not mean nothing constrains this edit.` (it owns no topic), and `Searched: src/lib.rs:helper, the header of src/lib.rs, the 0 symbols helper uses, 1 symbol that uses helper, and the headers of their files.` It never says uses are unknown. |
| W18 | A Swift file: `src/Room.swift` holds `func join(_ id: Int) -> Int { id }` and `func open(_ id: Int) -> Int { join(id) }` | Exit 0. `carry src/Room.swift:join` lists one direct user, `   1  src/Room.swift:open`; its one-step part is `One step away: no decided: tag, decision record, formal check or topic on the 0 symbols join uses, 1 symbol that uses join, or in the headers of their files.`, `Nothing found in what was searched; that does not mean nothing constrains this edit.`, and `Searched: src/Room.swift:join, the header of src/Room.swift, the 0 symbols join uses, 1 symbol that uses join, and the headers of their files.` The answer never holds `Its users are unknown` or `One step away: unknown` for a `.swift` symbol. |
| W19 | A language memod indexes but gives no symbol edges: a Kotlin file `src/store.kt` with `fun helper(): Int { return 1 }` and `fun caller(): Int { return helper() }` (Elixir `.ex` and Zig `.zig` behave the same) | Exit 0. `carry src/store.kt:helper` keeps the unknown path: `One step away: unknown. memod reads which symbols use which only in TypeScript, JavaScript, Rust and Swift, so whygraph cannot see what src/store.kt:helper uses or what uses it.`, `Nothing found in what was searched; that does not mean nothing constrains this edit.`, `Searched: src/store.kt:helper and the header of src/store.kt. Not searched: anything one step away or further.`, and `Its users are unknown: memod reads which symbols use which only in TypeScript, JavaScript, Rust and Swift, not in src/store.kt.` Never `No symbol uses it.` |
| W20 | A declaration file: `src/types.d.ts` declares `Declared`, and `src/b.ts` uses it (`import type { Declared } from "./types.d.ts"` and a parameter of that type) | Exit 0. `.d.ts` is TypeScript and memod's oxc reader gives its symbols `uses` edges, so whygraph reads it like any `.ts` file: `carry src/types.d.ts:Declared` says `1 symbol uses it directly, 1 in all (distance n: through n-1 other symbols; type: only a type use):` then `   1  src/b.ts:useShape2  type`; its one-step part is `One step away: no decided: tag, decision record, formal check or topic on the 0 symbols Declared uses, 1 symbol that uses Declared, or in the headers of their files.`, `Nothing found in what was searched; that does not mean nothing constrains this edit.`, and `Searched: src/types.d.ts:Declared, the header of src/types.d.ts, the 0 symbols Declared uses, 1 symbol that uses Declared, and the headers of their files.` Never `Its users are unknown`. |
| W21 | Two records linked only through commits that changed different numbers of symbols: a symbol `s`; commit c1 cites `R-one` and changed 2 symbols, commit c2 cites `R-many` and changed 7 symbols | `why s` exits 0. The heading of the part is `Decision records linked only through a commit that cites them and changed its code or tags, tightest commit first (a commit that changed many symbols links each of them loosely):`. `R-one` is listed before `R-many` (smallest count first), each with `changed by: <short> <date> <subject>; that commit changed 2 symbols` (or 7). The records a `decided:` tag names, if any, stay above them in their old order. |
| W22 | A tie in the tightest count: `R-a` (date 2026-01-02) and `R-b` (date 2026-01-02) each linked by a commit that changed 3 symbols; `R-undated` (date null) linked by a commit that changed 3 symbols | `why s` exits 0. Among the three, order is `R-a`, `R-b`, `R-undated`: the count ties, so date orders the two dated ones, then id, and the undated one lists last, shown as `undated`. |
| W23 | One record linked by two commits with different counts: `R` cites c1 (2 symbols) and c2 (9 symbols), both changed `s`, and c2 is older than c1 | `why s` exits 0. `R`'s rank uses 2 (the fewest of its linking commits), so it sorts against the other records by 2. Under `R`, the `changed by:` lines are tightest first: c1 (2 symbols) before c2 (9 symbols), whatever their dates. |
| W24 | A record a tag also names: `s`'s doc comment holds a `decided:` tag naming `R`; commit c (1 symbol) also cites `R` and changed `s`; `R-two` is linked only by a commit of 3 symbols; `R-header` is named by a tag in `s`'s file header | `why s` exits 0. The named part lists `R` (`named by: a decided: tag in its doc comment`, with `also cited by: c ... 1 symbol`) and `R-header`, in the old order (doc comment first, then header, then date, id); the via-commit part lists only `R-two`. `R` is not repeated in the via-commit part, and its `also cited by:` lines are tightest first. |
| W25 | The range form: `carry <file>:<start>-<end>` over a range that overlaps `s`, where two records are linked only through commits of different counts | Exit 0. The `Symbol <file>:<s>` body's `why` part lists them tightest commit first, exactly as `carry <file>:<s>` does, and the heading says `tightest commit first`. |
| W26 | The MCP recipe rows: `read_cypher` with the `why` recipe and `{"symbol": "<file>#s"}` | The `record` rows come back in the same order the CLI prints (tightest commit first, then date with undated last, then id), so a host that renders them shows the new order. The row shape is unchanged (no new column). |
| W27 | Determinism: `why <file>:<s>` and `carry <file>:<s>`, symbol form and range form, run twice, and again after a rebuild | Byte-identical stdout. A count tie orders by date (undated last), then id. |
| W28 | A record with `"author": "R. Chen"` and `"status": "accepted"`, linked to `s` (named by a tag, and linked only through a commit in a second run) | `why s` exits 0. In the record's lines, `      author: R. Chen` sits right after `      status: accepted` and before `      source: ...` (and, when the record has a `superseded by:` line, before that). A record with no author prints no `author:` line. |
| W29 | `carry <file>:<s>` (symbol form) and `carry <file>:<start>-<end>` (range form), where the `why` part lists a record with `"author": "R. Chen"` | Exit 0. The `why` part inside the carry answer prints `      author: R. Chen` in the same place W28 says. The one-step part and the term section print no `author:` line (their record lines are unchanged). |

## carry: one step away

A neighbor of a symbol is a symbol it uses or a symbol that uses it (a `USES`
edge either way). "The one-step part" is the part of a `carry` answer that
starts with `One step away` and ends with the `Not searched:` line. Each item
line starts with `  - ` and says where it sits and how it relates, such as
`decided on src/rounding.ts:roundHalfEven, which checkout uses: ...`.

| ID | Input | Required result |
| --- | --- | --- |
| C1 | `carry src/checkout.ts:checkout` (fixture: a decision on a callee in another file) | The one-step part lists `decided on src/rounding.ts:roundHalfEven, which checkout uses: ties round to even because rounding half up overcharges on average`. |
| C2 | `carry src/rounding.ts:roundHalfEven` (fixture: a decision on a caller) | The one-step part lists `decided on src/checkout.ts:checkout, which uses roundHalfEven: checkout adds tax to the net once because the receipt shows one tax line`. |
| C3 | A symbol with a decision on a callee and one on a caller; and a symbol `a` that uses `b` while `b` uses `a`, `b` with a tag | The callee's line comes before the caller's. `b` is one neighbor: its tag is listed once, as `decided on <file>:b, which a uses and which uses a: ...`, ranked with the callees. The counts in `Searched:` include `b` among the symbols `a` uses and among those that use `a`. |
| C4 | A callee in another file whose file header holds a `decided:` tag naming a record (fixture: `carry src/tax.ts:taxOf` does not show it, as `src/tax.ts` is its own file; `carry src/money.ts:cents` shows the header of `src/tax.ts` through its caller `taxOf`) | `decided in the header of src/tax.ts, the file of src/tax.ts:taxOf, which uses cents: tax lives apart ...`, then `record named by a decided: tag in the header of src/tax.ts, the file of src/tax.ts:taxOf, which uses cents: ADR-0002 (2026-01-02) One flat tax rate; status: accepted; superseded by: ADR-0003; source: ...`. The header of the symbol's own file is never in the one-step part (it is in the `why` part). |
| C5 | A TypeScript symbol whose code reaches Rust through a binding, in a repo that also holds the fixture's Rust file; and `carry src/lib.rs:round_cents` | The TypeScript symbol: the Rust code is no neighbor, because memod emits `USES` only within one language, so the one-step part counts 0 Rust neighbors and the `Not searched:` line still names `code in languages without symbol edges`. `round_cents`: no longer `unknown`; it answers as W10 (Rust symbols are read), so `One step away` counts its real neighbors (0 in the fixture) and the users part says `No symbol uses it.` Never `One step away: unknown.` |
| C6 | `useShape(s: Shape)` where `Shape` is an interface with a `decided:` tag, imported with `import type` | `decided on src/t.ts:Shape, which useShape uses only as a type: ...`; a caller that uses the symbol only as a type: `which uses <name> only as a type`. |
| C7 | A recursive symbol `r` (it calls itself) with no other use | `r` is not its own neighbor. The one-step part says no tag, record, check or topic on `the 0 symbols r uses, 0 symbols that use r`; it terminates. |
| C8 | A symbol that uses 25 symbols, each with a `decided:` tag and a topic (50 items) | 20 item lines, then `  Bound reached: 20 of 50 shown. Not shown: 5 decided: tags and 25 topics; the tags, records and checks among them sit on <the 5 symbols, sorted>. Run whygraph carry on a neighbor to see what sits on it, or read the neighbors column of the carry recipe (whygraph mcp), which holds them all.` The neighbors column of the carry recipe holds all 25 neighbors. |
| C9 | One decision reached two ways: a header tag of a file that declares two callees; a record that tags on two neighbors name; a check that covers four callees; a topic two callees own; a record that the `why` part already lists | Each is one line: `the file of <a> and <b>, which <name> uses`; `record named by a decided: tag on <a>, ...; and on <b>, ...`; `check on <a>, <b>, <c> and <d>, which <name> uses: memod verify <check>`; `topic owned by <a> and <b>, ...`. A record the `why` part lists, a check that covers the symbol itself, and a topic it owns are not repeated (fixture: `carry src/cart.ts:total` shows the tag on `cents`, not ADR-0001, which its `why` part lists through `dfb4ff8`). |
| C10 | Nothing found: a TypeScript symbol with no tag, record, check or topic, no file header tag, and no neighbor that holds one | Exactly these lines: `One step away: no decided: tag, decision record, formal check or topic on the 0 symbols lonely uses, 0 symbols that use lonely, or in the headers of their files.`, `Nothing found in what was searched; that does not mean nothing constrains this edit.`, `Searched: src/u.ts:lonely, the header of src/u.ts, the 0 symbols lonely uses, 0 symbols that use lonely, and the headers of their files.`, `Not searched: symbols further away (run carry on a neighbor to look past it); code in languages without symbol edges (memod reads uses only in TypeScript, JavaScript, Rust and Swift); uses the graph cannot see, such as a function passed as a value or called through an interface; records linked to a neighbor only through a commit.` When something was found elsewhere in the answer, the `Nothing found` line is absent; the `Searched:` and `Not searched:` lines are always there. |
| C11 | Determinism: `carry` on a symbol with many neighbors, run twice and after a rebuild | Byte-identical stdout. Within one place (what it uses, what uses it), items are ordered: tags on the neighbor, tags in its file header, records a neighbor's own tag names, records only a header tag names, checks, topics; then by the first neighbor's id, then by text. |
| C12 | `carry src/checkout.ts:checkout` (fixture: a check on a callee) | `check on src/rounding.ts:roundHalfEven, which checkout uses: memod verify rounding-model`, after the tag line of `roundHalfEven` and before its topic line. |
| C13 | A TypeScript symbol a Rust file cannot reach: a repo holds `src/app.ts` exporting `tsh`, and `src/lib.rs` with `helper`/`caller`; the Rust code names the TypeScript function through its binding | Exit 0. Neither language reaches the other: `carry src/app.ts:tsh` lists `No symbol uses it.` and its one-step part counts `0 symbols that use tsh`; `carry src/lib.rs:helper` lists `src/lib.rs:caller`, never `src/app.ts:tsh`. The `Not searched:` line names the languages memod reads (`TypeScript, JavaScript, Rust and Swift`), so Rust is not listed among the languages without symbol edges. |

## impact

| ID | Input | Required result |
| --- | --- | --- |
| I1 | An unknown id `ADR-4` | Exit 3; stderr lists `ADR-0004` as close. |
| I2 | An id with different case (`adr-0004`) | Exit 3 with `ADR-0004` as close: ids match exactly. |
| I3 | A record that cites no commit, or whose commits changed no symbol | Exit 0. No commit: "No commit in this repo's history cites it (a commit the record lists)." Commits that changed no symbol: the commits with "it changed 0 symbols", then "That commit changed no symbol that exists now." (or "Those commits ..."). |
| I4 | A symbol reached through two records | Listed under each record, counted once in "distinct symbols in all". |
| I5 | A symbol whose tag names the record and that a citing commit also changed | Listed once, among the symbols whose tag names it; not among the other symbols the commits changed. Counted as named by a tag. |
| I6 | `impact R`, where `R` has `"author": "R. Chen"`, and a second record `S` that rests on it with no author | Exit 0. After the header line `The decision itself: R (<date>) <title>` comes `  author: R. Chen` on its own line, before `  superseded by:` or the next part. `S`'s header is followed by no `author:` line. |

## search

`whygraph search "<text>"` ranks decision records by their text. It never
links a record to code: a listed record is a candidate to judge. "The fixture
build" is as above.

Two searches run. The word search reads the full-text index `decision_search`
that `build` creates over each record's `searchText` (its title and
statements). The meaning search embeds the request with the local model
`Xenova/bge-small-en-v1.5` (384 dimensions, cosine) and reads the vector index
`decision_search_vector` over each record's `vector` (the embedding of the
same `searchText`). The two ranked lists are fused by reciprocal rank
(`1 / (60 + rank)`) into one list of at most twenty (at most ten from each).
Each candidate takes two lines: its date, id and title, then
`matched: <label>; source: <source>`, with `matched:` naming `words`,
`meaning` or `words and meaning`. No score is printed.

| ID | Input | Required result |
| --- | --- | --- |
| Q1 | `search "round tax half to even"` on the fixture build | Exit 0. Exactly 5 records, because the store holds 5 and neither list is padded to ten, in this order: `note-1`, `ADR-0002`, `ADR-0003`, `ADR-0001`, `note-2`; their `matched:` values in that order are `words and meaning`, `words and meaning`, `words and meaning`, `meaning`, `meaning`. The request word `tax` is in the titles of note-1, ADR-0002 and ADR-0003; note-1 also holds `to`, which the word index keeps, and that extra word puts it first. The heading is `Decision records that match "round tax half to even", best match first (candidates to pick from two lists, words and meaning; a candidate, not a link: ...)`. Each record takes exactly two lines: `YYYY-MM-DD  <id>  <title>`, then `      matched: <words|meaning|words and meaning>; source: <source>`. There is no `statement:` line. Ends with `Searched:` (naming the words and the meaning search) and `Not searched:`. |
| Q2 | A request whose words match no record, on a store that holds records | Exit 0. No `No record matches` line: the word list is empty but the meaning search still returns its nearest records. The heading lists them, each `matched: meaning`. |
| Q3 | A store with no decision records | Exit 0. Both lists are empty; the first line is `No record matches "<request>".`, then the `Searched:` and `Not searched:` lines; no candidate heading. |
| Q4 | `search "why (do) we *round* half-to-even?"` and `search "why do we round half to even"` | Exit 0. The word search finds the same records: `(`, `)`, `*`, `-` and `?` are dropped, not read as operators. The meaning search embeds the request as typed, so the order of records that match by meaning only can differ between the two. The `Searched:` line names the words `why do we round half to even`. |
| Q5 | `search "   "` or `search "***"` (a request with no letter or digit) | Exit 2; stderr `search needs a request with at least one word`. Neither query runs and the model is not loaded. |
| Q6 | `search "x"` with no store | Exit 1; stderr `no store at <path>; run whygraph build first`. |
| Q7 | `search` with no argument, `search a b` (two arguments), or `search --decisions f` | Exit 2 with a usage message naming the bad argument. |
| Q8 | The word-indexed text | The word search finds a record by a word in its title or in any of its statements; never by its id, date, status or source. |
| Q9 | A record with no title and no statements | Loads; its `searchText` is empty, no request finds it by words, and it still gets a `vector` (the model embeds the empty text). |
| Q10 | `search` on a store built before this change (no `decision_search` or no `decision_search_vector`) | Exit 1; stderr `relate query failed (exit 1): IndexDoesNotExist: <index>`. It never answers with the other search alone. |
| Q11 | The model is not cached and cannot be downloaded (an empty cache folder and no network) | Exit 1; stderr names `Xenova/bge-small-en-v1.5` and the cache folder `~/.cache/whygraph`; no word-only answer is printed. |
| Q12 | `why` on a symbol with no tag, no record and no commit link | Exit 0. The last line starts `No decision is recorded for it.` and names `whygraph search "<the change in your own words>"`. `why` runs no search itself. |
| Q13 | `why` on a symbol whose `decided:` tag names no record (W16) | No `No decision is recorded` line and no search hint: the tag is the decision. |
| Q14 | `carry` on a symbol with no decision | The `why` part of the answer carries the same search hint as Q12; the rest of the answer is unchanged. |
| Q15 | `mcp` with a store | Prints `== search` and `== meaning`. `read_cypher` with the `search` recipe and `{"text": "money cents"}` returns the word rows; with the `meaning` recipe and a 384-float `{"vector": [...]}` it returns the vector rows; neither recipe holds a `CALL { }` subquery. |
| Q16 | `read_cypher` with the `meaning` recipe and no `vector` parameter | An error that names the missing parameter; never a list. `meaning` is the CLI's own query, so an MCP host with no local model cannot run it. |
| Q17 | The same request twice, and again after a rebuild | Byte-identical stdout. Records with an equal fused rank order by id. |
| Q18 | A request with a newline or a tab | The heading echoes it as one line (each whitespace run becomes one space); the words are searched and the whole request is embedded. |
| Q19 | `search --repo <folder outside any git repo>`, or run outside a repo | Exit 2; stderr `... is not in a git repo`. |
| Q20 | `build` on the fixture | The first build (empty cache) downloads about 35 MB into `~/.cache/whygraph` and prints nothing extra: stdout and stderr are byte-identical to a build with a warm cache. A second build and a search do not download again. |
| Q21 | `build` with no decision records | Exit 0; the model is not loaded or downloaded (there is no text to embed); the store still gets both indexes. |
| Q22 | The store after a build | Every `Decision` has a `searchText` and a `vector` of 384 floats (`size(d.vector) = 384`); `SHOW VECTOR INDEXES` lists `decision_search_vector` on `Decision.vector`, state `ONLINE`. |
| Q23 | Any `search` answer | Holds no score: no `score:` line and no similarity number. The order and the `matched:` line are the whole signal. |
| Q24 | A record whose id, date, status or source holds the request's only word | Not a word match (those fields are not indexed); it may still be a meaning match. |
| Q25 | `build` on a decisions file of thousands of records | Exit 0 within a stated memory bound. The peak does not grow with the record count, because the model runs on one record text per call: on this box, under a 6 GB memory and 4-CPU limit, 2,662 records peaked at 0.44 GB and took 304 s, against 0.44 GB and 30 s for 50 records. The whole build stays under 2 GB. |
| Q26 | The `vector` a build stores for a record, against a fresh embedding of the same text (what `search` does for a request) | Byte-identical: max absolute difference 0. A rebuild and a query embed a text the same way, because the model runs on one text per call. The `q8` weights scale activations over the whole call, so a text embedded with other texts in one call would differ by up to 0.014 (cosine 0.995) with the content of those texts; the one-text call is what makes this hold. |
| Q27 | `search` returns a record with `"author": "R. Chen"` | Exit 0. The candidate takes exactly two lines as Q1 says (`  <date>  <id>  <title>`, then `      matched: <label>; source: <source>`); no `author:` line and no `R. Chen` appears anywhere in the answer. The reranker documents are unchanged too (N27). |

## The term bridge

A term is a word of a record's text (its title and statements): every run of
letters, digits and `_`; each run split at `_` and at camelCase and digit
boundaries, with the whole identifier kept too; all lowercased; a term shorter
than three characters or all digits is left out. `build` makes one `Term` node
per kept term, holding `records` (the number of records that use it), and one
`MENTIONS` edge from each record to each of its terms, holding how many times
the record's text holds it; each `Decision` holds `termCount`, every term of
its text. A term used by more than half of at least ten records makes no node
(ADR 0002). memod puts each symbol's `line` and `endLine` (1-based, inclusive,
the declaration without its doc comment) on its node; `build` stores them on
`Symbol`; `carry` reads those lines of the working tree, adds the symbol's name
and file path, and runs `recipes/terms.cypher` to show the records that share
the most distinctive terms with the code.

| ID | Input | Required result |
| --- | --- | --- |
| T1 | A record whose text is `formatCents tax_rate the x 42` | The `Term` nodes are `formatcents`, `format`, `cents`, `tax_rate`, `tax`, `rate` and `the`: the whole identifier and its parts (split at `_` and at camelCase boundaries), lowercased, three characters or more, digits only left out. No `x` or `42`. `the` is a term: there is no stop-word list. |
| T2 | A record whose text holds `alpha` twice and `beta` once; a second record holding `alpha` once | `alpha` and `beta` are `Term` nodes; `alpha.records` is 2, `beta.records` is 1. `MENTIONS.count` is 2 for the first record's `alpha` edge and 1 for its `beta` edge. Each record's `termCount` is every term of its text (3 and 2). |
| T3 | Eleven records: ten hold `alpha`, one holds `beta`; then the same with nine holding `alpha` | `alpha` has no `Term` node and no `MENTIONS` edge (used by more than half of at least ten records); `beta` has one. With nine records using `alpha`, it has a node: the rule needs ten records using the term. |
| T4 | A record with no title and no statements; a build with no decision records | The record loads with `termCount` 0 and no `MENTIONS` edge; a build with no records has 0 `Term` nodes and 0 `MENTIONS` edges. |
| T5 | The fixture build | The counts include 45 `Term` nodes and 57 `MENTIONS` edges; `Decision.termCount` is set on every record. A store built before this change has no `Term` nodes. |
| T6 | The same decisions files built twice, and the same build read twice | Byte-identical `Term` nodes and `MENTIONS` edges: terms sorted by text, edges by record id then term. |
| T7 | `recipes/terms.cypher` with `{"terms": ["tax", "rounding"]}`, and `whygraph mcp` | Exit 0. On the fixture build the recipe returns 3 rows in this order: `note-1` (`shared` `["rounding", "tax"]`), `ADR-0002` (`shared` `["tax"]`), `ADR-0003` (`shared` `["tax"]`); each row holds `id`, `title`, `date`, `source`, `shared`, `termCount` and no score. `whygraph mcp` prints `== terms` (after `== search`, before `== users`), and the recipe holds no `CALL { }` subquery. |
| T8 | `carry src/money.ts:formatCents` (fixture: its code shares `cents` with records) | Exit 0. After the one-step part's `Not searched:` line and a blank line: `Decision records that share the most distinctive terms with its code (candidates to pick from one list; not links: a shared word does not mean the record governs this symbol):`, then `ADR-0002` and `ADR-0003`, each as `  <date>  <id>  <title>` then `      shared terms: cents`; no score. `ADR-0001` and `note-2`, which the answer already lists as linked, are not repeated. |
| T9 | `carry src/tax.ts:taxOf` (fixture: a record lists it) | The term section lists `ADR-0003` (`shared terms: rate, cents, tax`), then `ADR-0001` (`shared terms: cents`); `ADR-0002`, note-1 and note-2 are already linked in its `why` part and are not repeated. |
| T10 | A query term that the common-term rule dropped (T3: a term at least ten records use) | It contributes nothing and is not an error: no `Term` node exists for it, and a query of only that term gives an empty result. |
| T11 | `carry` on a symbol whose code shares no kept term with any record | One line, never a heading with no rows: `No decision record shares a distinctive term with its code.`, or, when the only matches are records the answer already lists, `No decision record other than those above shares a distinctive term with its code.` |
| T12 | `carry` on a store built before `Term` nodes exist, and one built before `line`/`endLine` exist | Exit 0, not a query error. No terms: `No decision record shares a distinctive term with its code.` No span: `No term section: the graph holds no source line range for <symbol>.` |
| T13 | `carry` after the symbol's file changed so its stored span no longer fits | Exit 0. `No term section: <file> has <n> lines, so the stored range <line>-<endLine> no longer fits; rebuild the store for the file as it is now.` It reads no wrong range and throws nothing. |
| T14 | `carry` on a symbol whose file is gone from the working tree | Exit 0. `No term section: its file <file> is not in the working tree.` |
| T15 | A symbol whose code holds no term of three or more characters | Exit 0. `No term section: its code holds no term of three or more characters.` A non-ASCII identifier is cut at its first non-ASCII character, so `naïve` gives `na` and `ve`, both dropped. |
| T16 | `carry` twice on the same symbol, and again after a rebuild | Byte-identical term section. At most ten candidates (score then id) and at most five shared terms each (contribution then text); a record with one shared term shows one. |
| T17 | A record whose only shared term the common-term rule dropped | No `Term` node exists, so it is no candidate and the section says no match rather than listing it. |
| T18 | `read_cypher` with the `terms` recipe and a `{"terms": [...]}` parameter over MCP | The rows `whygraph carry` renders, with no model, no network and no `write_cypher`. A missing `terms` parameter is an error that names it, as `meaning` names `vector` (Q16). |
| T19 | The symbol's name and file path are query terms | A record that names the symbol or its file but shares no line of code is still a candidate: the name and path feed the same tokenizer. |
| T20 | Any `carry` term section | Holds no score and no similarity number, and its heading says a listed record is a candidate, not a link. |
| T21 | `carry src/tax.ts:1-8` (fixture: lines before any symbol; the range form) | Exit 0. First line `Before you edit src/tax.ts:1-8`; then `No symbol's stored range overlaps these lines; the graph holds no symbol for src/tax.ts.`; then the term section over exactly those lines, heading `Decision records that share the most distinctive terms with these lines (candidates to pick from one list; not links: a shared word does not mean the record governs these lines):`, listing `ADR-0003` (`shared terms: the, adr, cents, tax`), `note-1`, `ADR-0002`, `ADR-0001`, `note-2`; no score. |
| T22 | `carry src/tax.ts:11-20` (fixture: a range overlapping two symbols) | Exit 0. `Symbols whose stored range overlaps these lines: src/tax.ts#taxRate (11-13), src/tax.ts#taxOf (18-20)`, then a `Symbol src/tax.ts:taxRate (11-13)` body and a `Symbol src/tax.ts:taxOf (18-20)` body, in line order, each with its own topics, checks, decisions, one-step neighbours, users and commits. The final term section lists only ADR-0001, with `shared terms: cents`; the other matching records are already linked in the bodies. |
| T23 | `carry docs/adr/0001-money-in-cents.md:1-5` (a file the graph holds no symbol for) | Exit 0. `No symbol's stored range overlaps these lines; the graph holds no symbol for docs/adr/0001-money-in-cents.md.` Still the term section over those lines, listing `ADR-0001`, `ADR-0002`, `ADR-0003`; no error and no empty heading. The same holds for a shell script or a config file. |
| T24 | A range past the end of the file, and a symbol whose stored span no longer fits | Exit 2: `src/tax.ts has 21 lines, so 1-200 is past its end`. The symbol form (T13) instead prints its one-line note, because the store's span may be stale but the range the user typed is checked now. |
| T25 | Bad ranges | `carry src/tax.ts:20-10` exits 2: `"src/tax.ts:20-10" starts at line 20 and ends at 10; a range's start must not be after its end`. `carry src/tax.ts:0-3` exits 2: `... starts at line 0; a line range is 1-based`. `carry src/tax.ts:abc-def` and `carry src/tax.ts:1-x` exit 2: `... is not <file>:<symbol> or <file>:<start>-<end>, such as src/main.ts:run or src/main.ts:10-20`. `carry ../x.ts:1-5` exits 2: `"../x.ts" is outside the repo <root>`. `carry src/missing.ts:1-5` exits 1: `cannot read src/missing.ts: ...`. `why src/tax.ts:1-5` exits 2: `why takes <file>:<symbol>, not a line range; the range form is for carry`. A lone number (`src/tax.ts:5`) stays a symbol target and exits 3. |
| T26 | `carry` on a symbol longer than 40 lines (memoryd: `mem/src/memoIndex.ts:FolderIndex`, 361 lines) | Exit 0. The term section is one line: `This symbol spans 361 lines; a long symbol gives weak term candidates. Ask with a range: whygraph carry mem/src/memoIndex.ts:<start>-<end>.` No candidate list. A symbol of 40 lines or fewer keeps its candidates. |
| T27 | A range on `why` or `impact` | `why`: exit 2 with `why takes <file>:<symbol>, not a line range; the range form is for carry`. `impact` takes a decision id, so a range is an id that no record has: exit 3, as for any unknown id. Neither command takes a range. |
| T28 | A range overlapping two symbols, one record linked to both | Each body lists the record; the term section lists it once, or not at all when a body already lists it (T22). The range form never prints a record twice in the term section. |

## Wider candidate lists

`whygraph search` fuses the ten best records by words and the ten best by
meaning into one list of at most twenty; the term section of `carry` lists at
most ten candidates. One place holds the number 10 for the code: `LIST_SIZE`
in `src/search.pure.ts`. The recipes hold the same number for the query (the
`search` and `terms` recipes as `LIMIT 10`, the `meaning` recipe as the vector
query's `k`), so the CLI and an MCP host read the same rows (ADR 0003). Each
search candidate takes exactly two lines: date, id and title, then
`matched: <label>; source: <source>`.

| ID | Input | Required result |
| --- | --- | --- |
| K1 | A store with fewer than ten decision records (the fixture build holds 5) | `search` lists every fused candidate, in fused-score then id order, and neither list is padded to ten. On the fixture the answer is Q1: 5 records, exit 0. |
| K2 | A fused-score tie between two records | The two order by id in code-unit order (`a` before `b`), and the answer is the same on a repeat. |
| K3 | A record the word search and the meaning search both return | Listed once, with `matched: words and meaning`, and scored `1 / (60 + word rank) + 1 / (60 + meaning rank)`; it never appears twice. |
| K4 | Both lists full and sharing no id | `search` lists exactly 20 candidates. With some ids in both lists it lists fewer; it never lists more than 20 and never pads a short list. |
| K5 | `read_cypher` with the `search` recipe, over MCP | At most 10 rows (the word search only), the same rows the word list holds. The `meaning` recipe returns at most 10 rows (its vector query's `k`), and the `terms` recipe at most 10; no recipe holds a `CALL { }` subquery. |
| K6 | `carry <file>:<start>-<end>` (the range form) with more than ten records sharing terms | At most 10 candidates, best BM25 first then id, each on two lines (`  <date>  <id>  <title>`, `      shared terms: ...`); the heading is `Decision records that share the most distinctive terms with these lines (candidates to pick from one list; not links: ...)`. There is no "more" line and no score. |
| K7 | The same `search` twice and again after a rebuild; the same term section twice and again after a rebuild | Byte-identical stdout (Q17, T16): ties order by id, and the per-list cut is deterministic. |
| K8 | A store with no vector index (`decision_search_vector` absent) | `search` exits 1: `relate query failed (exit 1): IndexDoesNotExist: decision_search_vector`. It never answers from the word list alone (Q10). |
| K9 | A store with no word index (`decision_search` absent) | `search` exits 1: `relate query failed (exit 1): IndexDoesNotExist: decision_search`. It never answers from the meaning list alone. |
| K10 | A store with no decision records | Exit 0. `No record matches "<request>".`, then the `Searched:` and `Not searched:` lines; no candidate heading (Q3). |
| K11 | A record ranked exactly tenth in one list, and an eleventh record in that list | The tenth record takes part in the fusion; the eleventh is not read, so it is listed only when the other list holds it. A list shorter than ten contributes every row it has. |
| K12 | More than ten records share a kept term | The term section lists exactly the best 10 (BM25 first, then id); the records below the cut are absent, with no note, because the heading says the list is one to pick from. |
| K13 | `LIST_SIZE`, and the recipes' row cap | `LIST_SIZE` in `src/search.pure.ts` is 10; `recipes/search.cypher` and `recipes/terms.cypher` say `LIMIT 10`, and `recipes/meaning.cypher` passes `10` as the vector query's `k`. A `search` answer holds at most `2 * LIST_SIZE` candidates. |
| K14 | A term section with fewer than ten matches (the fixture: `carry src/money.ts:formatCents` lists 2) | Every match is listed; the list is not padded to ten and there is no note about the count. |

## The optional reranker

`whygraph search "<text>" [--at <file>:<start>-<end>]` runs the two searches
and fuses them as Q1-Q26 say. With `--at` it adds the records of the term list
for exactly those lines (the `terms` recipe, the same terms `carry` uses for a
range, at most ten) as candidates, each record once. When the environment
variable `WHYGRAPH_RERANK` holds a model id, `search` sends one `POST` to
`${WHYGRAPH_RERANK_URL}` (default `https://openrouter.ai/api/v1/rerank`) with
`{model, query, documents, top_n: 5}` and lists the five records the response's
`results` keeps, in their order. A fake endpoint on localhost stands in for the
service: a test sets `WHYGRAPH_RERANK` and `WHYGRAPH_RERANK_URL` to it and
asserts what it received. The call carries `Authorization: Bearer <key>` only
when `OPENROUTER_API_KEY` is set. Any failure of the call prints the wide
answer and one extra line `Rerank failed (<kind>); showing every candidate.`
and exits 0; the failure kinds are `network error`, `timeout`, `HTTP <status>`,
`unexpected response`, `index out of range` and `too few results`. Unset or
empty `WHYGRAPH_RERANK` means no such call is made.

| ID | Input | Required result |
| --- | --- | --- |
| N1 | `WHYGRAPH_RERANK` unset, a request whose fused-plus-term candidate list holds at least six records, and a listening fake endpoint | Exit 0. The wide answer only: no `Reranked` line, no `Sent to` line, no `Rerank failed` line. The fake endpoint receives no request. |
| N2 | `WHYGRAPH_RERANK` empty (`""`), the same store and fake | As N1: exit 0, the wide answer, the fake receives nothing. An empty value is not a model id. |
| N3 | `WHYGRAPH_RERANK` names a model, and the candidate list holds exactly five records (the fixture build holds 5; `search "round tax half to even" --at src/tax.ts:11-20`) | Exit 0. The wide answer; the fake receives nothing, so no `Reranked`, `Sent to` or `Rerank failed` line. Five candidates are not worth a call. |
| N4 | The same with exactly six candidates (the fixture build plus one extra record) | Exit 0. One `POST` reaches the fake and the answer is the reranked answer of N5: six is the first count that calls. |
| N5 | A fake that answers 200 with `{"results": [{"index": i, "relevance_score": s}, ...]}` holding five indexes, best first | Exit 0. The first line is `Reranked <N> candidates with <model>, best first (the five it kept; a candidate, not a link: read the record and judge whether it governs your change):`, where `<N>` is the candidate count and `<model>` is `WHYGRAPH_RERANK`; then exactly five records, two lines each (`  <date>  <id>  <title>`, then `      matched: <label>; source: <source>`), in the response's index order; then the last line of N6. No score and no `statement:` line. |
| N6 | The last line of a reranked answer | Without `--at`: `Sent to <host>: the request and the title and first statement of each of the <N> candidates.` With `--at <file>:<start>-<end>`: `Sent to <host>: the request, the lines of <file>:<start>-<end>, and the title and first statement of each of the <N> candidates.` `<host>` is the host (and port) of `WHYGRAPH_RERANK_URL`, never its path and never a header. |
| N7 | `OPENROUTER_API_KEY` set to a value, the fake records its request headers | The fake sees `Authorization: Bearer <key>`. Neither stdout nor stderr holds the key's value, and the `Sent to` line names only the host. |
| N8 | `OPENROUTER_API_KEY` unset or empty | The fake sees no `authorization` header; the call still succeeds. |
| N9 | The request body the fake receives | `POST`, JSON, with `model` equal to `WHYGRAPH_RERANK`, `top_n` 5, `documents` one entry per candidate in the candidate order (the fused order first, then term-only records in term order), and `query` equal to the request, or, with `--at`, `<request>\n\nCode it would change:\n<the lines>`. |
| N10 | One document | The candidate's title, then ` \| ` and its first statement when the statement is non-empty and the title does not already hold it; at most 600 characters. A candidate with an empty title gets the first statement alone; a candidate with no statement gets the title alone. |
| N11 | The `query` with `--at` over a range of more than 3,000 characters | The request, a blank line, `Code it would change:`, then the lines joined by `\n` and cut at 3,000 characters. The code part never holds more than 3,000 characters. |
| N12 | A record the fused list and the term list both hold | It is one candidate: one document and one possible result. Its `matched:` label in a reranked answer names every list that held it, in the order words, meaning, terms, joined by ` and ` (for example `words and meaning and terms`); a term-only record is `terms`. |
| N13 | `search "<request>" --at <file>:<start>-<end>` with `WHYGRAPH_RERANK` unset | Exit 0. The fused answer as Q1 (heading, two lines per fused candidate), then, before the `Searched:` line, the range form's term section: the heading `Decision records that share the most distinctive terms with these lines (candidates to pick from one list; not links: a shared word does not mean the record governs these lines):` and the term candidates not already listed, each `  <date>  <id>  <title>` then `      shared terms: <terms>`. When every term candidate is already listed the section is the one line `No decision record other than those above shares a distinctive term with these lines.`; when the lines hold no kept term it is `No term section: these lines hold no term of three or more characters.`; when no record shares a term it is `No decision record shares a distinctive term with these lines.` The `Searched:` and `Not searched:` lines stay last, unchanged. |
| N14 | `search "x" --at src/tax.ts:taxRate` (a symbol, not a range) | Exit 2; stderr names `--at takes <file>:<start>-<end>, not a symbol`; the model is not loaded and no query runs. |
| N15 | `search "x" --at src/tax.ts:20-10`, `--at src/tax.ts:0-3`, `--at src/tax.ts:abc-def`, `--at ../x.ts:1-5` | Exit 2, each with `carry`'s range message: the start-after-end message, the 1-based message, `"<arg>" is not <file>:<symbol> or <file>:<start>-<end>, such as src/main.ts:run or src/main.ts:10-20`, and `"../x.ts" is outside the repo <root>`. The model is not loaded. |
| N16 | `search "x" --at src/missing.ts:1-5` and `--at src/tax.ts:1-200` | Exit 1 with `cannot read src/missing.ts: ...`; exit 2 with `src/tax.ts has 21 lines, so 1-200 is past its end`. The model is not loaded. |
| N17 | `search "x" --at` (no value), `--at` twice, and `--at` on `why`, `impact`, `carry`, `build`, `decisions`, `mcp` | Exit 2; stderr names `--at needs a value`, `--at given twice`, or `--at is a search option`, with the usage. |
| N18 | `search --at src/tax.ts:1-5` with no request | Exit 2; stderr `search needs a request`; the model is not loaded. |
| N19 | A fake that answers any non-200 (for example 500) | Exit 0. The wide answer, then the last line `Rerank failed (HTTP 500); showing every candidate.` No `Reranked` or `Sent to` line. |
| N20 | A fake that answers a body that is not JSON, or JSON without a `results` array, or with `results` entries that are not objects, or with a non-integer `index`, or with a repeated `index` | Exit 0. The wide answer, then `Rerank failed (unexpected response); showing every candidate.` |
| N21 | A fake that answers an integer `index` outside `0..candidates-1` | Exit 0. The wide answer, then `Rerank failed (index out of range); showing every candidate.` |
| N22 | A fake that answers fewer than five results while more than five candidates exist | Exit 0. The wide answer, then `Rerank failed (too few results); showing every candidate.` |
| N23 | A fake that reads the request and never answers | Exit 0 after about ten seconds. The wide answer, then `Rerank failed (timeout); showing every candidate.` No retry. |
| N24 | `WHYGRAPH_RERANK_URL` pointing at a closed port, or a host that does not resolve | Exit 0. The wide answer, then `Rerank failed (network error); showing every candidate.` No retry. |
| N25 | The same fake answer twice, and a reranked answer after a rebuild | Byte-identical stdout (E1): the candidate order, the documents and the mapped five are functions of the store and the response; ties keep the fused order, then the term order. |
| N26 | Any reranked or failed answer, with a key set | Holds no score, no similarity number and no authorization header or key. A reranked answer holds exactly five records and no `statement:` line; a failed answer is exactly the wide answer plus one `Rerank failed` line. |
| N27 | A fake reranker endpoint, `WHYGRAPH_RERANK` set, and a candidate with `"author": "R. Chen"` | The request body holds no author: no `documents` entry holds `R. Chen`, and the body has no `author` field. Each document is still the candidate's title, then ` | ` and its first statement when that adds text (N10). A reranked answer prints no `author:` line either. |

## mcp

| ID | Input | Required result |
| --- | --- | --- |
| M1 | `mcp` with a store | Exit 0. stdout holds a JSON `mcpServers.whygraph` entry: `relate serve --mcp stdio --database <absolute store> --read-only` with env `RELATE_TELEMETRY=0`, `DO_NOT_TRACK=1`, then each recipe under `== <name>`. |
| M2 | Start the printed server; `tools/list` | Exactly `read_cypher` and `get_schema` (no `write_cypher`). |
| M3 | `read_cypher` with the `why` recipe and `{"symbol": "src/tax.ts#taxRate"}` | The rows that `whygraph why src/tax.ts:taxRate` renders (A3): kinds `tag`, `file tag`, then records ADR-0003 (`named: ["doc comment"]`) and ADR-0002 (`named: ["file header"]`); no note-1 row. |
| M5 | `read_cypher` with each printed recipe (`why`, `impact`, `carry`, `users`, `names`) | Accepted (no "Only MATCH queries are allowed" error): a recipe holds no `CALL { }` subquery. |
| M4 | `mcp` with no store | Exit 1, as W1. |

## Links between records and code

"Links" means a NAMES edge (tag to record) or a CITES edge (record to
commit). Unless the entry says otherwise, the repo has records `ADR-0004`
(from `docs/adr/0004-x.md`) and `note-1`.

| ID | Input | Required result |
| --- | --- | --- |
| L1 | A `decided:` tag whose text holds `adr-0004`, one with `ADR-0004`, one with `ADR 0004` (fixture: `cents` names `adr-0001`, the `src/tax.ts` header names `ADR-0002`, `taxRate` names `ADR 0003`) | Each tag NAMES the record. `why` lists it with "named by: a decided: tag in its doc comment" (or "in the header of <file>"). |
| L2 | Tags with near misses: `ADR 4`, `Adr-0004`, `ADR  0004` (two spaces), `ADR_0004`, `ADR-00041`, `ADR-0004x`, `xADR-0004` | No NAMES edge, no warning. |
| L3 | A tag naming `note-1` as `(note-1)` or `note-1.`; tags with `note-10`, `Note-1`, `pre-note-1`, `note-1-a` | The first two NAME note-1; the others link nothing: any id other than `ADR-NNNN` matches exactly, case included, and not next to a letter, digit, `_` or `-`. |
| L4 | A tag naming `ADR-0009`, which no record has | Build exit 0; no link; stderr `warning: decided tag on src/a.ts:f names ADR-0009, which no record has; no link` (the carrier is `<file>` for a header tag). A non-ADR id that no record has is not detected, so it does not warn. |
| L5 | Two tags on one symbol naming two records (`adr-0004`; `note-1`), and one tag naming both | Both records under "Decision records that its decided: tags name:", each once, oldest first, then by id. |
| L6 | A file header tag naming `ADR-0004` | Every symbol of the file: `why` lists ADR-0004 as named by "a decided: tag in the header of <file>", after records its own doc-comment tags name. `impact ADR-0004`: "1 file whose header decided: tag names it: <file>". |
| L7 | A record named by a symbol's tag and also cited by a commit that changed the symbol (fixture: `taxRate` and ADR-0003) | `why` lists it once, among the records the tags name, with "also cited by:" and that commit; not again among the records linked through commits. |
| L8 | A commit whose last paragraph is `Decision: note-9` (no such record) | Build exit 0; no link and no warning from that line (U2). |
| L9 | A commit with two trailers `Decision: ADR-0004` and `Decision: note-1`, not listed by either record | Neither record cites it; no warning (U2). |
| L10 | Trailers `Decision: ADR-4`, `Decision: ADR 0004`, `Decision: adr-0004`, `Decision: 0004`, or a lowercase `decision:` key | No link and no warning: all commit-message lines are plain text. |
| L11 | `Decision: ADR-0004` anywhere in a commit message, with no record listing the commit | No link, no warning. |
| L12 | A commit message naming `ADR 0004`, `ADR-0004` or `0004-x.md` in free text, with no trailer, that does not add the ADR's file (fixture: `73ebd46`) | The message adds no CITES edge; only a record's explicit `commits` list can cite it (on the fixture, note-2 explicitly lists `73ebd46`). |
| L13 | A commit listed in a record's `commits` and also naming that record in a trailer | One CITES edge. |
| L14 | A record linked only by a large commit (fixture: note-1 lists only `a3bcb76`) | `why` on each changed symbol lists note-1 with "changed by: a3bcb76 2026-01-08 Name every amount by its unit; that commit changed 5 symbols". `impact note-1`: "a3bcb76 2026-01-08 Name every amount by its unit; it changed 5 symbols". |
| L15 | Determinism: `scripts/fixture.sh` run twice; the fixture build run twice | The same commit ids (HEAD `0ede283`). The same NAMES and CITES edges, byte-identical `why` and `impact` answers, warnings identical and sorted. |

## Every command

| ID | Input | Required result |
| --- | --- | --- |
| E1 | Determinism: each of `why`, `impact`, `carry`, `mcp`, `decisions adr` run twice, and again after a rebuild from the same repo state and decisions files | Byte-identical stdout. Build warnings are identical and sorted. |
| E2 | Unknown command, unknown option, `--repo` twice, a missing option value, an extra argument, `--decisions` on a non-build command | Exit 2 with a message naming the bad argument and the usage. |
| E3 | `help`, `--help`, no arguments | Exit 0, usage on stdout. |
| E4 | Any relate call | Runs with `RELATE_TELEMETRY=0` and `DO_NOT_TRACK=1` in its environment (check with a `relate` wrapper that records its environment). |
| E5 | A store that the relate on `PATH` cannot open (wrong version, damaged) | Exit 1: "relate query failed (exit n): <relate's message>". |

## README check

`node scripts/readme-check.mjs` reruns every ```` ```console ```` block of
`README.md` and compares the output.

| ID | Input | Required result |
| --- | --- | --- |
| R1 | The README as committed | Exit 0; stdout `<n> commands, 0 drifted`. |
| R2 | One output line of a console block edited, or a command whose output changed (a fixture answer, a usage line) | Exit 1; stderr `drifted: $ <command>` with the README line and the line the run printed; stdout counts the drifted commands. |
| R3 | A command that exits non-zero (`whygraph carry src/money.ts:cent`) | Its output ends with `[exit 3]`; a README without that line drifts. |
| R4 | A console block after `<!-- readme-check: preview -->` | Not run. Its output must equal the first later run of the same command; when no later block runs that command, exit 1 naming it, before anything runs. |
| R5 | Any run | HOME is a fresh folder, shown as `~` in outputs and removed afterwards, also when a command fails; the user's HOME and git config are not read or written. Every `relate` call sees `RELATE_TELEMETRY=0` and `DO_NOT_TRACK=1`. |
| R6 | `--write` | Rewrites every console block's output from the run, keeping commands and preview markers; a check right after exits 0. |
| R7 | An argument other than `--write` | Exit 2 with the usage. |
| R8 | A console block whose first line is not a `$ ` command | The check fails with "a console block starts with output". |

## Agent skill

`skills/whygraph/SKILL.md` is what an agent reads; README "How an agent uses
it" installs it.

| ID | Input | Required result |
| --- | --- | --- |
| S1 | The skill file | Starts with YAML front matter holding `name: whygraph` (equal to its folder name) and a one-line `description` under 1024 characters that names carry, impact and why. |
| S2 | Every `whygraph ...` command in the skill file | A command `whygraph help` lists, with arguments it accepts (exit 0, 1 or 3 on the fixture, never 2). |
| S3 | The rule | The skill says: before you change a symbol, `carry`; when a decision changes, `impact`; when you wonder why, `why`. |
| S4 | README install for Claude Code: `cp -r "$WHYGRAPH/skills/whygraph" .claude/skills/` in a repo | `.claude/skills/whygraph/SKILL.md` exists and Claude Code lists the skill `whygraph` in that repo. |
| S5 | README install for Codex: `cp -r "$WHYGRAPH/skills/whygraph" .agents/skills/` in a repo | `.agents/skills/whygraph/SKILL.md` exists and Codex lists the skill `whygraph` in that repo. |
| S6 | README `claude mcp add` and `codex mcp add` lines | Each writes a `whygraph` server entry that runs `relate serve --mcp stdio --database <absolute store> --read-only` with `RELATE_TELEMETRY=0` and `DO_NOT_TRACK=1`. |
| S7 | `WHYGRAPH` unset; or the skill installed a second time | Unset: `cp` exits 1, "cannot stat '/skills/whygraph'", and installs nothing. Again: the folder's `SKILL.md` is overwritten in place, no nested `whygraph/whygraph`. |

| S8 | A change reverses, removes or weakens what a record decided or added | Both skill and startup rule define this as going against the record. Do not make the change; name the record, explain what it would undo and what would change if confirmed, then stop. |
| S9 | The request plainly asks for a conflicting change; nobody can answer | The same stop applies; an explicit change request and an unavailable user do not authorize reversal of an unnamed record. |
| S10 | The request itself names the record and says to reverse it | Make the change; update the record with the code when the repo holds the record. An external record does not require inventing a local copy. |
| S11 | A record is relevant but the change does not reverse, remove or weaken it | Make the change; name the record only if it helps the reader. Relevance alone is no reason to stop. |

## Unused graph parts removed (ADR 0007)

| ID | Input | Required result |
| --- | --- | --- |
| U1 | A decisions file with `topics` on a record, whether null, empty, shared with code or record-only | Build exit 1; `unknown field "topics"` names the file, record index and id; the prior store still answers. No ABOUT edge and no record-only Topic are loaded. ADR conversion emits no `topics` key even when the preamble has `[[topic]]`. |
| U2 | A commit with `Decision:` lines naming existing or missing records, in any case or paragraph, not listed in any record | Build exit 0; no CITES edge from any record to this commit, and no trailer warning. If the record lists the commit, exactly one CITES edge, irrespective of its message (L13). |
| U3 | Code with a `premise:` tag that memod includes in its graph | Build exit 0; zero Memo nodes and PREMISE edges, no load statement or index for Memo; the carry recipe returns no `premises` column. Symbol and range carry print no premise-memo line. The tag alone does not suppress `Nothing found in what was searched` when there is no other constraint. |
| U4 | A code file importing a package and another code file | Build exit 0; zero Package nodes and IMPORTS edges, no Package index. File, Symbol and USES rows remain those of memod, and code-owned Topic and OWNS remain. The memod graph is not modified. |
| U5 | The fixture build summary and direct label/type counts | Exactly the sorted label and relationship counts of A2; neither list names Package, Memo, IMPORTS, ABOUT or PREMISE. Total 93 nodes and 139 relationships; 0 warnings. |
| U6 | Generate the fixture twice, build twice, repeat why, impact, carry (symbol and range), search, decisions adr and mcp | Same fixture ids (HEAD `0ede283`); byte-identical stdout for each answer and ADR conversion, also after rebuild. Build counts and sorted warnings repeat; mcp prints the same revised carry recipe. |
| U7 | A symbol whose doc comment shares a term with a record but whose declaration, name and path do not | No term candidate from the comment in symbol carry; a range explicitly covering the comment still uses those lines. symbolSource returns only the inclusive declaration span, or undefined for an invalid span. No READ_COMMENT switch or withComment argument. |
| U8 | The fixture's note-2 lists `73ebd46` and `a3bcb76`; note-1 lists only `a3bcb76` | For formatCents, note-2 lists 1-symbol then 5-symbol commits, before ADR-0001 (3) and note-1 (5), in why and both carry forms; the why MCP rows have that same order. The record lists, rather than message trailers, supply all those links. |
| U9 | why or impact on code or a record with no commit link | The why hint suggests a decided tag or a commit listed in the record; impact says `No commit in this repo's history cites it (a commit the record lists).` Neither suggests a trailer. |

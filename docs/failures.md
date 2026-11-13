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
| `f85c3a6` | main | `src/lib.rs` with `round_cents` (Rust: no symbol uses); trailer `Decision: ADR-0001` |
| `6bed2fd` | main | `decisions/notes.json`: `note-1` (rests on ADR-0002, cites `2a59506`), `note-2` (rests on `note-1`, cites `73ebd46`) |
| `395b8c0` | main | renames the amount parameter of `cents`, `formatCents`, `total`, `taxOf` and `round_cents`: a large commit (5 symbols) with trailer `Decision: ADR-0001` |
| `17078bb` | main | `src/rounding.ts` (`roundHalfEven` with a `decided:` tag naming no record and `verified: rounding-model`), `src/checkout.ts` (`checkout` with a `decided:` tag naming no record; uses `roundHalfEven`). No older symbol gains a user, so no `why` or `impact` answer changes. |

"The fixture build" below means, in the fixture:
`whygraph decisions adr docs/adr > adrs.json` then
`whygraph build --decisions adrs.json --decisions decisions/notes.json`.

## Expected answers on the fixture

| ID | Input | Required result |
| --- | --- | --- |
| A1 | `decisions adr docs/adr` | Exit 0. Records `ADR-0001`..`ADR-0003` in that order. ADR-0001 commits: `[dfb4ff8...]` only (full id; `73ebd46` names it in free text and is not cited). ADR-0002: restsOn `[ADR-0001]`, commits `[2a59506...]`. ADR-0003: supersedes `[ADR-0002]`, restsOn `[ADR-0001]`, commits `[78884f0...]`. Each has status `accepted`, its date, topic, and items `context` and `choice`. |
| A2 | the fixture build | Exit 0. stdout counts: 1 Check, 9 Commit, 5 DecidedTag, 5 Decision, 6 File, 8 Item, 8 Symbol, 6 Topic; 27 CHANGES, 7 CITES, 3 NAMES, 1 SUPERSEDES, 4 RESTS_ON, 5 USES, 1 VERIFIED. No warning. |
| A3 | `why src/tax.ts:taxRate` | Exit 0. The doc-comment tag "the rate depends on the region ...", the header tag "tax lives apart from the cart ... (ADR-0002)". Records its tags name, in this order: ADR-0003 ("named by: a decided: tag in its doc comment", also cited by `78884f0`, "that commit changed 1 symbol"), then ADR-0002 (superseded by ADR-0003, "named by: a decided: tag in the header of src/tax.ts", also cited by `2a59506`, 2 symbols). Records linked only through a commit: note-1 (changed by `2a59506`; 2 symbols). Each record appears once. |
| A4 | `why src/tax.ts:taxOf` | Named by a tag: ADR-0002 (header). Linked only through a commit: ADR-0001 (`395b8c0`, 5 symbols), then note-1 (`2a59506`). Not ADR-0003: `78884f0` did not change `taxOf`'s code, and no tag of `taxOf` names it. |
| A5 | `impact ADR-0002` | Exit 0. ADR-0002 itself (superseded by ADR-0003): no symbol tag names it, the file `src/tax.ts` whose header tag names it; commit `2a59506` ("it changed 2 symbols") and its symbols `taxRate` 1 user, `taxOf` 0 users. note-1 directly (no tag; `2a59506`, the same 2 symbols), note-2 through 1 other record (`73ebd46`, `formatCents` 1 user). "3 distinct symbols in all: 0 named by a decided: tag, 3 reached only through a commit." |
| A6 | `impact ADR-0001` | ADR-0001: the symbol whose tag names it, `cents` (2 users); 3 commits cite it, oldest first: `dfb4ff8` (3 symbols), `f85c3a6` (1 symbol), `395b8c0` (5 symbols); 4 other symbols they changed: `formatCents` (1 user; `395b8c0, dfb4ff8`), `total`, `round_cents`, `taxOf`; `cents` is not repeated among them. ADR-0002, ADR-0003 rest on it directly (ADR-0003: its tag names `taxRate`; "That commit changed no other symbol that exists now."); note-1 and note-2 through others. ADR-0003 is listed although it supersedes ADR-0002. `73ebd46` is not among ADR-0001's commits. "6 distinct symbols in all: 2 named by a decided: tag, 4 reached only through a commit." |
| A7 | `carry src/money.ts:cents` | Topic `fx-money`, no other owner; no check; ADR-0001 named by its doc-comment tag; users: `src/cart.ts:total` and `src/tax.ts:taxOf` at distance 1; commits `395b8c0` then `dfb4ff8`. |
| A8 | `carry src/money.ts:formatCents` | Commits `395b8c0`, `73ebd46`, `dfb4ff8` (newest first); no tag names a record; records linked only through a commit: ADR-0001 (changed by `dfb4ff8`, 3 symbols, and `395b8c0`, 5 symbols) and note-2 (`73ebd46`, 1 symbol). |

## build

| ID | Input | Required result |
| --- | --- | --- |
| B1 | A repo with no commits and one `.ts` file; `build` | Exit 0. stderr: "the repo has no commits". Symbols and files load; 0 Commit nodes; `why` on the symbol says no record cites a commit; `carry` says no commit changed it. |
| B2 | A repo with no commits and a decisions file citing `abcd` | Exit 0; warning names the record and `abcd`; no CITES edge. |
| B3 | An empty repo (no files, no commits) | Exit 0; "0 nodes", "(none)". A later `why x.ts:f` exits 3 and says no file `x.ts`. |
| B4 | `build` without `--decisions` | Exit 0; 0 Decision nodes; 0 NAMES and 0 CITES. `impact X` exits 3 and says the store holds no decision records. On the fixture, stderr warns once for each tag that names an ADR (L4) and each trailer (L8): 5 warnings, sorted. |
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
| B28 | A merge commit (`13d52e8`) | Gets the CHANGES edges memod gives it (usually none); it is never cited unless a record names it. |
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
| D13 | An ADR file added, edited, renamed, edited again | The record cites only the commit that added the original file (`--follow`): not the edits, not the rename. |
| D14 | A commit message "see ADR 4", one naming `0004-x.md`, one "See ADR 40", none changing the ADR file | None is cited by ADR-0004: `decisions adr` cites only the commit that added the ADR's file (a commit names a record with a trailer, L8-L12). |
| D16 | A later commit that edits ADR 0003's file (a note that ADR 0004 replaces part of it) and changes code, with no trailer | Not cited by ADR-0003 (memod: `1fa2df7` edits `0003-graph-output-contract.md` and is cited only by ADR-0004, which it added). With a trailer `Decision: ADR-0003` it is cited. |
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
| W10 | `carry src/lib.rs:round_cents` (Rust) | Exit 0. Says its users are unknown because memod reads uses only in TypeScript and JavaScript; never "No symbol uses it". |
| W11 | `carry` on a TypeScript symbol no one uses | "No symbol uses it." |
| W12 | `why` on a symbol with no tag and no record | Exit 0 with each part empty and the last line "No decision is recorded for it ...". |
| W16 | `why` on a symbol whose `decided:` tag names no record, and no commit links a record | Exit 0. The tag's text and reason under "Decided in its doc comment:"; "No decided: tag names a decision record."; no "No decision is recorded" line, because the tag is the decision. |
| W13 | A symbol used only in types | Its users carry the `type` mark. |
| W14 | A uses cycle (a uses b, b uses a) | `carry a` lists b at distance 1 and never lists a itself; it terminates. |
| W15 | A record with a `status` and one superseded | `why` prints `status:` and `superseded by:` lines for it. |

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
| C5 | A TypeScript symbol that calls code in a language without symbol edges (Rust through a binding); and `carry src/lib.rs:round_cents` | The TypeScript symbol: the Rust code is no neighbor, and the `Not searched:` line names "code in languages without symbol edges". `round_cents`: `One step away: unknown. memod reads which symbols use which only in TypeScript and JavaScript, so whygraph cannot see what src/lib.rs:round_cents uses or what uses it.`, then `Searched: src/lib.rs:round_cents and the header of src/lib.rs. Not searched: anything one step away or further.` Never "no decided: tag ... on the 0 symbols". |
| C6 | `useShape(s: Shape)` where `Shape` is an interface with a `decided:` tag, imported with `import type` | `decided on src/t.ts:Shape, which useShape uses only as a type: ...`; a caller that uses the symbol only as a type: `which uses <name> only as a type`. |
| C7 | A recursive symbol `r` (it calls itself) with no other use | `r` is not its own neighbor. The one-step part says no tag, record, check or topic on `the 0 symbols r uses, 0 symbols that use r`; it terminates. |
| C8 | A symbol that uses 25 symbols, each with a `decided:` tag and a topic (50 items) | 20 item lines, then `  Bound reached: 20 of 50 shown. Not shown: 5 decided: tags and 25 topics; the tags, records and checks among them sit on <the 5 symbols, sorted>. Run whygraph carry on a neighbor to see what sits on it, or read the neighbors column of the carry recipe (whygraph mcp), which holds them all.` The neighbors column of the carry recipe holds all 25 neighbors. |
| C9 | One decision reached two ways: a header tag of a file that declares two callees; a record that tags on two neighbors name; a check that covers four callees; a topic two callees own; a record that the `why` part already lists | Each is one line: `the file of <a> and <b>, which <name> uses`; `record named by a decided: tag on <a>, ...; and on <b>, ...`; `check on <a>, <b>, <c> and <d>, which <name> uses: memod verify <check>`; `topic owned by <a> and <b>, ...`. A record the `why` part lists, a check that covers the symbol itself, and a topic it owns are not repeated (fixture: `carry src/cart.ts:total` shows the tag on `cents`, not ADR-0001, which its `why` part lists through `395b8c0`). |
| C10 | Nothing found: a TypeScript symbol with no tag, record, check, premise or topic, no file header tag, and no neighbor that holds one | Exactly these lines: `One step away: no decided: tag, decision record, formal check or topic on the 0 symbols lonely uses, 0 symbols that use lonely, or in the headers of their files.`, `Nothing found in what was searched; that does not mean nothing constrains this edit.`, `Searched: src/u.ts:lonely, the header of src/u.ts, the 0 symbols lonely uses, 0 symbols that use lonely, and the headers of their files.`, `Not searched: symbols further away (run carry on a neighbor to look past it); code in languages without symbol edges (memod reads uses only in TypeScript and JavaScript); uses the graph cannot see, such as a function passed as a value or called through an interface; records linked to a neighbor only through a commit.` When something was found elsewhere in the answer, the `Nothing found` line is absent; the `Searched:` and `Not searched:` lines are always there. |
| C11 | Determinism: `carry` on a symbol with many neighbors, run twice and after a rebuild | Byte-identical stdout. Within one place (what it uses, what uses it), items are ordered: tags on the neighbor, tags in its file header, records a neighbor's own tag names, records only a header tag names, checks, topics; then by the first neighbor's id, then by text. |
| C12 | `carry src/checkout.ts:checkout` (fixture: a check on a callee) | `check on src/rounding.ts:roundHalfEven, which checkout uses: memod verify rounding-model`, after the tag line of `roundHalfEven` and before its topic line. |

## impact

| ID | Input | Required result |
| --- | --- | --- |
| I1 | An unknown id `ADR-4` | Exit 3; stderr lists `ADR-0004` as close. |
| I2 | An id with different case (`adr-0004`) | Exit 3 with `ADR-0004` as close: ids match exactly. |
| I3 | A record that cites no commit, or whose commits changed no symbol | Exit 0. No commit: "No commit in this repo's history cites it (a `Decision:` trailer, or a commit the record lists)." Commits that changed no symbol: the commits with "it changed 0 symbols", then "That commit changed no symbol that exists now." (or "Those commits ..."). |
| I4 | A symbol reached through two records | Listed under each record, counted once in "distinct symbols in all". |
| I5 | A symbol whose tag names the record and that a citing commit also changed | Listed once, among the symbols whose tag names it; not among the other symbols the commits changed. Counted as named by a tag. |

## search

`whygraph search "<text>"` ranks decision records by their text. It never
links a record to code: a listed record is a candidate to judge. "The fixture
build" is as above. The word search reads the full-text index
`decision_search` that `build` creates over each record's title and
statements.

| ID | Input | Required result |
| --- | --- | --- |
| Q1 | `search "money in cents"` on the fixture build | Exit 0. At most 5 records, best match first; `ADR-0001` first. The heading is `Decision records that match "money in cents", best match first (a candidate, not a link: ...)`. Each record shows `YYYY-MM-DD  <id>  <title>`, then `statement:` the first line of its first item, then `source:`. The answer ends with a `Searched:` line naming the words and a `Not searched:` line. A multi-line statement shows only its first line. |
| Q2 | A request whose words match no record | Exit 0. The first line is `No record matches "<request>".`; then the `Searched:` and `Not searched:` lines; no candidate heading. |
| Q3 | `search "why (do) we *round* half-to-even?"` and `search "why do we round half to even"` | Exit 0. The same records in the same order: `(`, `)`, `*`, `-` and `?` are dropped, not read as operators. The `Searched:` line names the words `why do we round half to even`. |
| Q4 | `search "   "` or `search "***"` (a request with no letter or digit) | Exit 2; stderr `search needs a request with at least one word`. No query runs. |
| Q5 | `search "x"` with no store | Exit 1; stderr `no store at <path>; run whygraph build first`. |
| Q6 | `search` with no argument, `search a b` (two arguments), or `search --decisions f` | Exit 2 with a usage message naming the bad argument. |
| Q7 | The indexed text | A record is found by a word in its title or in any of its statements; never by its id, date, status, source or topics. |
| Q8 | A record with no title and no statements | Loads; its `searchText` is empty and no request finds it. |
| Q9 | `search` on a store built before this change (no `decision_search` index) | Exit 1; stderr `relate query failed (exit 1): IndexDoesNotExist: decision_search`. |
| Q10 | `why` on a symbol with no tag, no record and no commit link | Exit 0. The last line starts `No decision is recorded for it.` and names `whygraph search "<the change in your own words>"`. `why` runs no search itself. |
| Q11 | `why` on a symbol whose `decided:` tag names no record (W16) | No `No decision is recorded` line and no search hint: the tag is the decision. |
| Q12 | `carry` on a symbol with no decision | The `why` part of the answer carries the same search hint as Q10; the rest of the answer is unchanged. |
| Q13 | `mcp` with a store, then `read_cypher` with the `search` recipe and `{"text": "money cents"}` | `mcp` prints `== search`; the call returns the same records the CLI renders, and the recipe holds no `CALL { }` subquery. |
| Q14 | The same request twice, and again after a rebuild | Byte-identical stdout. Records with an equal match order by id. |
| Q15 | A request with a newline or a tab | The heading echoes it as one line (each whitespace run becomes one space); the words are searched. |
| Q16 | `search --repo <folder outside any git repo>`, or run outside a repo | Exit 2; stderr `... is not in a git repo`. |

## mcp

| ID | Input | Required result |
| --- | --- | --- |
| M1 | `mcp` with a store | Exit 0. stdout holds a JSON `mcpServers.whygraph` entry: `relate serve --mcp stdio --database <absolute store> --read-only` with env `RELATE_TELEMETRY=0`, `DO_NOT_TRACK=1`, then each recipe under `== <name>`. |
| M2 | Start the printed server; `tools/list` | Exactly `read_cypher` and `get_schema` (no `write_cypher`). |
| M3 | `read_cypher` with the `why` recipe and `{"symbol": "src/tax.ts#taxRate"}` | The rows that `whygraph why src/tax.ts:taxRate` renders (A3): kinds `tag`, `file tag`, then `record` ADR-0003 (`named: ["doc comment"]`), ADR-0002 (`named: ["file header"]`), note-1 (`named: []`, `via` one commit with `symbols: 2`). |
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
| L8 | A commit whose last paragraph is `Decision: note-9` (no such record) | Build exit 0; no link; stderr `warning: commit <short>: trailer "Decision: note-9" names no record; no link`. |
| L9 | A commit with two trailers `Decision: ADR-0004` and `Decision: note-1` | Both records cite the commit. |
| L10 | Trailers `Decision: ADR-4`, `Decision: ADR 0004`, `Decision: adr-0004`, `Decision: 0004` | No link; one warning per value (L8 wording). The trailer key is read in any case (`decision: ADR-0004` links): git reads trailers. |
| L11 | `Decision: ADR-0004` in a paragraph that is not the message's last | Not a trailer: no link, no warning. |
| L12 | A commit message naming `ADR 0004`, `ADR-0004` or `0004-x.md` in free text, with no trailer, that does not add the ADR's file (fixture: `73ebd46`) | No record cites it; `why` on the symbols it changed lists no record through it. |
| L13 | A commit listed in a record's `commits` and also naming that record in a trailer | One CITES edge. |
| L14 | A record cited by a commit that changed many symbols (fixture: ADR-0001 and `395b8c0`) | `why` on any of those symbols: "changed by: 395b8c0 2026-01-08 Name every amount by its unit; that commit changed 5 symbols". `impact ADR-0001`: "395b8c0 2026-01-08 Name every amount by its unit; it changed 5 symbols". |
| L15 | Determinism: `scripts/fixture.sh` run twice; the fixture build run twice | The same commit ids (HEAD `17078bb`). The same NAMES and CITES edges, byte-identical `why` and `impact` answers, warnings identical and sorted. |

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

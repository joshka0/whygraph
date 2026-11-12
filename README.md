# whygraph

Code shows what a program does. It rarely shows why. The reason sits in a
decision record, a design note or a commit message, and an agent that edits
the code never reads it.

whygraph joins the three in one graph: the code (files, symbols, who uses
whom), its history (which commit changed which symbol) and the decision
records (ADRs, or any notes you convert to one JSON format). Then an agent,
or you, asks before changing code:

- **carry**: what must I keep in mind before I edit this symbol?
- **why**: why is this symbol the way it is?
- **impact**: this decision changed; what rests on it?

Here is the question an agent asks before it edits `formatCents` in the small
shop repo that comes with whygraph. The code of `formatCents` mentions no
decision. The graph finds two: ADR-0001 through the commits that changed it,
and the design note `note-2` ("Show thousands separators in totals") through
the commit that added the separators. It also lists who calls it.

<!-- readme-check: preview -->
```console
$ whygraph carry src/money.ts:formatCents
Before you edit src/money.ts:formatCents

Topics it owns (keep its job inside these; another file that owns one and does not import this one is a duplicate):
  - fx-money: no other file owns it
No formal check covers it.
Its doc comment names no premise memo.

Its doc comment holds no decided: tag.
The header of src/money.ts holds no decided: tag.
No decided: tag names a decision record.
Decision records linked only through a commit that cites them and changed its code or tags, oldest first (a commit that changed many symbols links each of them loosely):
  2026-01-01  ADR-0001  Money in cents
      status: accepted
      source: docs/adr/0001-money-in-cents.md
      changed by: dfb4ff8 2026-01-01 Add money and cart in cents; that commit changed 3 symbols
                  395b8c0 2026-01-08 Name every amount by its unit; that commit changed 5 symbols
  2026-01-04  note-2  Show thousands separators in totals
      source: decisions/notes.json
      changed by: 73ebd46 2026-01-04 Format cents with thousands separators (ADR 0001); that commit changed 1 symbol

1 symbol uses it directly, 1 in all (distance n: through n-1 other symbols; type: only a type use):
   1  src/cart.ts:total

3 commits changed its code or tags, newest first:
  395b8c0 2026-01-08 Name every amount by its unit
  73ebd46 2026-01-04 Format cents with thousands separators (ADR 0001)
  dfb4ff8 2026-01-01 Add money and cart in cents
```

An agent that reads this before it removes the separators can tell you that
the change reverses `note-2`, instead of making it silently.

## Requirements

- Linux or macOS, with `bash`, `git` and Node 26 or later.
- pnpm 10.
- [relate](https://relatedb.ai) 1.0.1, an embedded Cypher graph database, as
  the `relate` CLI on `PATH`. whygraph stores and queries the graph with it.
  Check with `relate --version`.
- memod, at commit `be6b126` of its `code-graph` branch. memod is a separate
  tool by the same author: it reads a repo's code, doc-comment tags and git
  history into a graph (`memod graph --history`), and whygraph loads that
  graph. memod has no public release. This repo gets it as a dev dependency
  pinned in `package.json` to a local clone:
  `git+file:///home/dev/repos/personal/memod#be6b126...`. To install whygraph
  you need a memod clone that holds that commit, at that path or at a path
  you write into `package.json` instead.

whygraph itself has no runtime dependency; it runs `git`, `memod` and `relate`
as child processes. Every `relate` call it makes sets `RELATE_TELEMETRY=0` and
`DO_NOT_TRACK=1`.

## Set up

In the folder where you cloned whygraph:

```sh
pnpm install
export WHYGRAPH="$PWD"
export PATH="$WHYGRAPH/bin:$WHYGRAPH/node_modules/.bin:$PATH"
```

`pnpm install` builds memod from the pinned commit. `bin/` holds the
`whygraph` command and `node_modules/.bin` holds `memod`. Put the two
`export` lines in your shell profile (with the folder's full path in place of
`$PWD`) so that every shell, and every agent you start from one, finds them.

```console
$ whygraph help
whygraph: why the code is the way it is, as a relate graph

  whygraph build [--repo <path>] [--store <path>] [--decisions <file>]...
  whygraph decisions adr <folder>
  whygraph why <file>:<symbol> [--repo <path>] [--store <path>]
  whygraph impact <decision id> [--repo <path>] [--store <path>]
  whygraph carry <file>:<symbol> [--repo <path>] [--store <path>]
  whygraph mcp [--repo <path>] [--store <path>]

Exit: 0 answer, 1 failure, 2 usage, 3 target not in the graph.
```

## Try it on the fixture

`scripts/fixture.sh` builds a small shop repo with eight commits, three ADRs
and a file of design notes. The commit ids are the same on every machine.
Run it from the whygraph folder; it prints the history:

```console
$ scripts/fixture.sh ~/try/shop
* 395b8c0 2026-01-08 Name every amount by its unit
* 6bed2fd 2026-01-07 Record notes from the design review
* f85c3a6 2026-01-06 Add Rust rounding
*   13d52e8 2026-01-05 Merge branch 'regional'
|\  
| * 78884f0 2026-01-03 Tax rate by region
* | 73ebd46 2026-01-04 Format cents with thousands separators (ADR 0001)
|/  
* 2a59506 2026-01-02 Add a flat tax
* dfb4ff8 2026-01-01 Add money and cart in cents
$ cd ~/try/shop
```

The shop keeps money in cents (ADR 0001). Tax got one flat rate (ADR 0002),
then a rate by region on a branch (ADR 0003 replaces ADR 0002). `decided:`
tags in the code name some of these ADRs, and two commits name ADR-0001 in a
`Decision:` trailer. `decisions/notes.json` holds two design notes that cite
commits.

Turn the ADRs into a decisions file, then build the graph from the code, its
history and both decisions files:

```console
$ whygraph decisions adr docs/adr > ../adrs.json
$ whygraph build --decisions ../adrs.json --decisions decisions/notes.json
Built ~/try/shop/.git/whygraph/store
from ~/try/shop: 8 commits, 5 decision records from 2 decisions files, 0 warnings.
38 nodes:
  Commit       8
  DecidedTag   3
  Decision     5
  File         4
  Item         8
  Symbol       6
  Topic        4
76 relationships:
  ABOUT        5
  CHANGES      23
  CITES        7
  DECIDED      3
  DECLARES     6
  IMPORTS      2
  NAMES        3
  OWNS         10
  RESTS_ON     4
  STATES       8
  SUPERSEDES   1
  USES         4
```

The store lives in `.git/whygraph/store`, where git ignores it. (Paths in
this README show your home folder as `~`.)

Why does `taxRate` take a region?

```console
$ whygraph why src/tax.ts:taxRate
Why src/tax.ts:taxRate is the way it is

Decided in its doc comment:
  - decided: the rate depends on the region because ADR 0003 replaced the flat rate
Decided in the header of src/tax.ts:
  - decided: tax lives apart from the cart because rates change by law, not by product (ADR-0002)
Decision records that its decided: tags name:
  2026-01-03  ADR-0003  Tax rate by region
      status: accepted
      source: docs/adr/0003-regional-tax.md
      named by: a decided: tag in its doc comment
      also cited by: 78884f0 2026-01-03 Tax rate by region; that commit changed 1 symbol
  2026-01-02  ADR-0002  One flat tax rate
      status: accepted
      superseded by: ADR-0003
      source: docs/adr/0002-flat-tax.md
      named by: a decided: tag in the header of src/tax.ts
      also cited by: 2a59506 2026-01-02 Add a flat tax; that commit changed 2 symbols
Decision records linked only through a commit that cites them and changed its code or tags, oldest first (a commit that changed many symbols links each of them loosely):
  2026-01-02  note-1  Tax is computed once per order, not per line
      source: decisions/notes.json
      changed by: 2a59506 2026-01-02 Add a flat tax; that commit changed 2 symbols
```

Two records are linked on purpose, by a `decided:` tag that names them. A
third, `note-1`, is linked loosely: a commit that cites it changed `taxRate`.

What rests on `note-1`, if the team changes its mind about it?

```console
$ whygraph impact note-1
What rests on note-1 (2026-01-02) Tax is computed once per order, not per line

1 record rests on it, directly or through others.

The decision itself: note-1 (2026-01-02) Tax is computed once per order, not per line
  No decided: tag names it.
  1 commit cites it:
    2a59506 2026-01-02 Add a flat tax; it changed 2 symbols
  2 symbols that commit changed, most used first (a loose link: a commit ties every symbol it changed):
       1 user   src/tax.ts:taxRate  (2a59506)
       0 users  src/tax.ts:taxOf  (2a59506)

Rests on it directly: note-2 (2026-01-04) Show thousands separators in totals
  No decided: tag names it.
  1 commit cites it:
    73ebd46 2026-01-04 Format cents with thousands separators (ADR 0001); it changed 1 symbol
  1 symbol that commit changed, most used first (a loose link: a commit ties every symbol it changed):
       1 user   src/money.ts:formatCents  (73ebd46)

3 distinct symbols in all: 0 named by a decided: tag, 3 reached only through a commit.
```

And before an edit, the answer from the top of this page:

```console
$ whygraph carry src/money.ts:formatCents
Before you edit src/money.ts:formatCents

Topics it owns (keep its job inside these; another file that owns one and does not import this one is a duplicate):
  - fx-money: no other file owns it
No formal check covers it.
Its doc comment names no premise memo.

Its doc comment holds no decided: tag.
The header of src/money.ts holds no decided: tag.
No decided: tag names a decision record.
Decision records linked only through a commit that cites them and changed its code or tags, oldest first (a commit that changed many symbols links each of them loosely):
  2026-01-01  ADR-0001  Money in cents
      status: accepted
      source: docs/adr/0001-money-in-cents.md
      changed by: dfb4ff8 2026-01-01 Add money and cart in cents; that commit changed 3 symbols
                  395b8c0 2026-01-08 Name every amount by its unit; that commit changed 5 symbols
  2026-01-04  note-2  Show thousands separators in totals
      source: decisions/notes.json
      changed by: 73ebd46 2026-01-04 Format cents with thousands separators (ADR 0001); that commit changed 1 symbol

1 symbol uses it directly, 1 in all (distance n: through n-1 other symbols; type: only a type use):
   1  src/cart.ts:total

3 commits changed its code or tags, newest first:
  395b8c0 2026-01-08 Name every amount by its unit
  73ebd46 2026-01-04 Format cents with thousands separators (ADR 0001)
  dfb4ff8 2026-01-01 Add money and cart in cents
```

A name the graph does not hold exits 3 and lists close names:

```console
$ whygraph carry src/money.ts:cent
whygraph: src/money.ts has no symbol cent. Close: src/money.ts:cents, src/money.ts:formatCents.
[exit 3]
```

## Your own repo

whygraph runs on any git repo that memod reads (TypeScript, JavaScript,
Rust, Elixir, Kotlin, Swift, Zig). It needs no setup in the repo. With no
decision records, you still get users and history; links appear when you
write them, in three places.

### ADRs

Keep ADRs as `docs/adr/NNNN-<title>.md` (any folder works):

```markdown
# ADR 0003: Tax rate by region

Date: 2026-01-03. Status: accepted. Topic: [[fx-tax]].

Supersedes ADR 0002.

## Context

Orders now ship outside the EU. Amounts stay in cents (ADR 0001).

## Choice

The rate depends on the region of the order.
```

`whygraph decisions adr docs/adr` turns each file into a record `ADR-NNNN`:

- the title is the first `# ` heading, without `ADR <n>:`;
- `Date: YYYY-MM-DD`, `Status: <text>` (or a `## Status` section) and
  `[[topic]]` links come from the lines between the title and the first `## `
  heading;
- every other `## ` section becomes an item of the record;
- a line with `Supersedes` or `Replaces` names the ADRs this one replaces; a
  line `Superseded by ADR <n>` in an older ADR says the same from the other
  side;
- other ADRs the text names (`ADR 3`, `ADR 0003`, `ADR-0003`) with a smaller
  number are the ADRs this one rests on;
- the record cites the commit that added the file. Nothing else links a
  commit to it except a `Decision:` trailer (below).

### `decided:` tags

A `decided:` tag in a doc comment links the symbol to a record when its text
names the record's id. In a file header it links the whole file.

```ts
/**
 * decided: the rate depends on the region because ADR 0003 replaced the flat rate
 */
export function taxRate(region = "eu"): number {
```

An ADR id may be written `ADR-0003`, `ADR 0003` or `adr-0003`: all upper or
all lower case, one `-` or one space, exactly four digits. Any other id must
appear exactly, case included. The id must not touch a letter, digit, `_` or
`-`. `ADR 3` or `Adr-0003` links nothing. A tag that names an ADR no record
has is a build warning.

The doc comment and header syntax of each language is memod's:
`/** */` and the first doc comment with `module:` in TypeScript, `///` and
leading `//!` lines in Rust, and so on.

### `Decision:` trailers

A commit links to a record when the last paragraph of its message holds a
trailer with the record's id, exactly:

```sh
git commit -m "Name every amount by its unit" -m "Decision: ADR-0001"
```

The record is then linked to every symbol that commit changed. Answers give
the commit's symbol count, so you can weigh the link: one symbol is a strong
link, sixty a weak one. A trailer that names no record is a build warning.

Then build, as on the fixture:

```sh
whygraph decisions adr docs/adr > "$(git rev-parse --git-dir)/whygraph-adrs.json"
whygraph build --decisions "$(git rev-parse --git-dir)/whygraph-adrs.json"
```

Rebuild after you commit; the store holds the repo as of its last build.

## Decisions file

Every source of decisions turns into this JSON. `build` takes any number of
them (`--decisions` repeats); record ids are unique across all of them.

```json
{
  "records": [
    {
      "id": "note-1",
      "date": "2026-01-02",
      "title": "Tax is computed once per order, not per line",
      "items": [{ "label": "decided", "text": "tax once per order because per-line rounding adds up to a cent per line" }],
      "topics": ["fx-tax"],
      "restsOn": ["ADR-0002"],
      "commits": ["2a59506"]
    }
  ]
}
```

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | A non-empty string, unique across every decisions file of a build. |
| `date` | yes | `YYYY-MM-DD`, or `null` when the source states none. Undated records sort last. |
| `title` | no | One line that names the decision. |
| `status` | no | As the source states it, such as `accepted`. |
| `source` | no | Where the record lives. Without it, answers name the decisions file. |
| `items` | no | Statements of the record: `{ "label", "text" }`. |
| `topics` | no | Topic slugs, as memod's `owns: [[topic]]` tags name them. |
| `restsOn` | no | Ids of records this one builds on. |
| `supersedes` | no | Ids of records this one replaces. |
| `commits` | no | Commit ids, full or short (at least 4 hex digits), that carry out the decision. |

A build rejects, and leaves the store unchanged: an unknown field, a
malformed field, two records with one id, and records that supersede each
other in a cycle. It loads, with a warning on stderr: a `restsOn` or
`supersedes` id that no record has, a commit that matches no commit reachable
from `HEAD`, and a short id that matches more than one (each such link is
dropped).

To bring in another source, convert it with a script or `jq`. For example, a
memo export with one row per item (`memo`, `date`, `label`, `text`, `topics`,
`premises`, `supersedes`, `commits`):

```sh
jq '{records: (.items | group_by(.memo) | map({
  id: ("memo-" + .[0].memo), date: .[0].date,
  title: ((map(select(.label == "decided")) + .)[0].text),
  items: map({label, text}),
  topics: (map(.topics[]) | unique),
  restsOn: (map(.premises[] | "memo-" + .) | unique),
  supersedes: (map(.supersedes[] | "memo-" + .) | unique),
  commits: (map(.commits[]) | unique)}))}' memos.json > memos.decisions.json
```

## Commands

| Command | Result |
| --- | --- |
| `whygraph build [--repo <path>] [--store <path>] [--decisions <file>]...` | Runs `memod graph --history` in the repo, reads the decisions files, and writes a new store. Prints the node and relationship counts; warnings go to stderr. |
| `whygraph decisions adr <folder>` | Prints a decisions file made from the ADRs in the folder. |
| `whygraph why <file>:<symbol>` | The `decided:` tags on the symbol and on its file header; the records those tags name; then the records linked only through a commit that cites them and changed the symbol, oldest first, each commit with how many symbols it changed. |
| `whygraph impact <decision id>` | The record and every record that rests on it, directly or through others; for each, the symbols and files whose `decided:` tags name it, then the commits that cite it and the other symbols those commits changed, with how many symbols use each directly. |
| `whygraph carry <file>:<symbol>` | Before an edit: the topics the symbol owns and their other owners, the formal checks that cover it, its premise memos, its decisions (as `why`), its direct and transitive users, and the commits that changed it. |
| `whygraph mcp` | The MCP server config that serves the store read-only through `relate serve --mcp stdio`, and every recipe. |
| `whygraph help` | The usage. |

A symbol target is `<file>:<symbol>`, the file path from the repo root (an
absolute path inside the repo also works). `--repo` defaults to the current
folder. `--store` defaults to `<git dir>/whygraph/store`, one per worktree.

Exit status: 0 an answer (an empty one too), 1 a failure (a missing tool, no
store, a rejected decisions file, a failed load), 2 a usage error (a target
that is not `<file>:<symbol>` or lies outside the repo), 3 a target that the
graph does not hold.

## How an agent uses it

An agent needs two things: the rule for when to ask, and a way to ask.

**The rule** is a skill file, `skills/whygraph/SKILL.md`, in the format
Claude Code and Codex both read (a folder with a `SKILL.md` that has a `name`
and a `description`). It tells the agent: before you change a symbol, ask
`carry`; when a decision changes, ask `impact`; when you wonder why code is
the way it is, ask `why`. It gives the exact commands, how to read a direct
and a loose link, and what to do on each exit status.

Install it into the repo you work on, from that repo's root:

```sh
# Claude Code
mkdir -p .claude/skills && cp -r "$WHYGRAPH/skills/whygraph" .claude/skills/
# Codex
mkdir -p .agents/skills && cp -r "$WHYGRAPH/skills/whygraph" .agents/skills/
```

To have it in every repo, copy it to `~/.claude/skills/` (Claude Code) or
`~/.agents/skills/` (Codex) instead.

An agent loads a skill only when it judges the skill relevant, and an agent
asked for a small edit may not. In a trial, Claude Code had the skill and
still edited `formatCents` without asking. Put the rule where the agent reads
it at every start as well: `skills/whygraph-rule.md` is a short section for
the repo's instructions file.

```sh
cat "$WHYGRAPH/skills/whygraph-rule.md" >> CLAUDE.md    # Claude Code
cat "$WHYGRAPH/skills/whygraph-rule.md" >> AGENTS.md    # Codex
```

**The way to ask** is the `whygraph` command, which the agent runs in its
shell: it needs `whygraph`, `memod` and `relate` on its `PATH` (see Set up),
and permission to run them.

An agent with no shell can ask over MCP. `whygraph mcp` prints the server
entry and the Cypher recipes:

```console
$ whygraph mcp | head -n 21
MCP server config (add it to your MCP host; it serves the store read-only with the tools get_schema and read_cypher):

{
  "mcpServers": {
    "whygraph": {
      "command": "relate",
      "args": [
        "serve",
        "--mcp",
        "stdio",
        "--database",
        "~/try/shop/.git/whygraph/store",
        "--read-only"
      ],
      "env": {
        "RELATE_TELEMETRY": "0",
        "DO_NOT_TRACK": "1"
      }
    }
  }
}
```

Add that server to your agent, from the repo's root:

```sh
# Claude Code (this project only)
claude mcp add whygraph -e RELATE_TELEMETRY=0 -e DO_NOT_TRACK=1 -- \
  relate serve --mcp stdio --database "$(git rev-parse --absolute-git-dir)/whygraph/store" --read-only
# Codex (global: every Codex session gets this repo's store)
codex mcp add whygraph --env RELATE_TELEMETRY=0 --env DO_NOT_TRACK=1 -- \
  relate serve --mcp stdio --database "$(git rev-parse --absolute-git-dir)/whygraph/store" --read-only
```

The server offers `read_cypher` and `get_schema`. To ask, call `read_cypher`
with a recipe's text as `statement` and `{"symbol": "src/money.ts#formatCents"}`
(or `{"decision": "note-1"}` for `impact`) as `parameters`. The recipes live
in `recipes/*.cypher`; the commands run these same files, so both ways give
the same answer. A server keeps the graph it opened: restart it after a
build.

## The graph

| Label | Key | Other properties | From |
| --- | --- | --- | --- |
| `File` | `path` | | memod `file` |
| `Package` | `specifier` | | memod `package` |
| `Symbol` | `id` (`<file>#<name>`) | `path`, `name` | memod `symbol` |
| `Topic` | `slug` | | memod `topic`, record `topics` |
| `DecidedTag` | `hash` | `what`, `because` | memod `decision` (a `decided:` tag) |
| `Check` | `name` | | memod `check` |
| `Memo` | `ref` | | memod `memo` (a `premise:` tag) |
| `Commit` | `sha` | `short`, `date`, `subject` | memod `commit` |
| `Decision` | `id` | `title`, `date`, `status`, `source` | a decision record |
| `Item` | | `ord`, `label`, `text` | a record's item |

| Relationship | From -> to |
| --- | --- |
| `DECLARES` | File -> Symbol |
| `IMPORTS` (`specifier`, `line`, `typeOnly`) | File -> File or Package |
| `OWNS` | File -> Topic, and each Symbol that the tag names -> Topic |
| `USES` (`typeOnly`) | Symbol -> Symbol (TypeScript and JavaScript only) |
| `DECIDED`, `VERIFIED`, `PREMISE` | Symbol or File -> DecidedTag, Check, Memo |
| `NAMES` | DecidedTag -> Decision (the tag's text names the record) |
| `CHANGES` | Commit -> File or Symbol (a changed code hash or tag, by memod's rule) |
| `STATES`, `ABOUT` | Decision -> Item, Topic |
| `RESTS_ON`, `SUPERSEDES` | Decision -> Decision |
| `CITES` | Decision -> Commit |

A record reaches a symbol directly through
`(:Symbol)-[:DECIDED]->(:DecidedTag)-[:NAMES]->(:Decision)` (or the same from
its File), and loosely through
`(:Decision)-[:CITES]->(:Commit)-[:CHANGES]->(:Symbol)`.

The store is a relate directory store behind a symlink. A build loads into a
new directory and swaps the link only when every statement succeeded, so a
failed build leaves the old store answering, and a second build replaces the
store rather than merging into it.

## Limits

- memod reads which symbols use which only in TypeScript and JavaScript. For
  a symbol in another language, `carry` says its users are unknown.
- A link through a commit ties every symbol the commit changed to the record.
  Answers give the commit's symbol count so you can weigh it.
- A tag links by the record's id only, whatever the sentence says. A tag that
  names an ADR to say what the ADR leaves open still links to it.
- memod reads no `decided:` tag on an interface member or a method, so a
  record named there gets no direct link.
- `impact` lists a file whose header tag names the record, and still lists
  that file's symbols among the symbols the record's commits changed (as
  loose links), although the header tag covers them directly.
- The store is as of the last build. whygraph does not watch the repo.
- `CHANGES` reaches only files and symbols that exist now; memod does not
  index Markdown, so an ADR file has no node.
- The recipes use no `CALL { }` subquery: relate's read-only MCP tool rejects
  one.

## Develop

```sh
pnpm check                          # tsrs type check
pnpm lint                           # memod lint; must exit 0 before a commit
pnpm test                           # the contracts in docs/failures.md
node scripts/readme-check.mjs       # reruns this README's commands; exit 1 when it drifted
```

Decision logic lives in `src/*.pure.ts`; child processes and files stay in
the other files of `src/`. [docs/failures.md](docs/failures.md) lists every
way a command can fail or answer wrong, as input and required result.
[docs/demo.md](docs/demo.md) is the shot list for the demo video.

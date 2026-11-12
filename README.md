# whygraph

whygraph puts what a repo's code is, why it is that way and how it got there
in one graph, so an agent can ask before it changes code:

- **why** is this symbol the way it is?
- this decision changed: **what rests on it**?
- what must I **carry** in mind before I edit this symbol?

The code and its history come from [memod](https://gitlab.com/joshka0/memod)
(`memod graph --history`): files, symbols, who uses whom, intent tags, and
which commit changed which symbol. The decisions come from decision records:
ADRs, or any source converted to one JSON format. whygraph loads both into
[relate](https://relatedb.ai), an embedded Cypher graph database, and answers
from there, on the command line or over MCP.

## Set up

whygraph needs Node 26, and three CLIs on `PATH`: `git`, `relate` (1.0.1) and
`memod`. whygraph has no runtime dependency of its own.

```sh
pnpm install                                  # memod and tsrs, as dev dependencies
export PATH="$PWD/node_modules/.bin:$PATH"    # puts memod on PATH
alias whygraph="node $PWD/src/main.ts"
```

Every `relate` call that whygraph makes sets `RELATE_TELEMETRY=0` and
`DO_NOT_TRACK=1`.

## Use

In the repo you want to ask about:

```sh
whygraph decisions adr docs/adr > /tmp/adrs.json
whygraph build --decisions /tmp/adrs.json
whygraph why src/imports.pure.ts:resolvedImports
whygraph impact ADR-0004
whygraph carry src/imports.pure.ts:resolvedImports
whygraph mcp
```

| Command | Result |
| --- | --- |
| `whygraph build [--repo <path>] [--store <path>] [--decisions <file>]...` | Runs `memod graph --history` in the repo, reads the decisions files, and writes a new store. Prints the node and relationship counts; warnings go to stderr. |
| `whygraph decisions adr <folder>` | Prints a decisions file made from the ADRs in the folder. |
| `whygraph why <file>:<symbol>` | The `decided:` tags on the symbol and on its file header; the decision records those tags name; then the records linked only through a commit that cites them and changed the symbol, oldest first, each commit with how many symbols it changed. |
| `whygraph impact <decision id>` | The record and every record that rests on it, directly or through others; for each, the symbols and files whose `decided:` tags name it, then the commits that cite it and the other symbols those commits changed, with how many symbols use each directly. |
| `whygraph carry <file>:<symbol>` | Before an edit: the topics the symbol owns and their other owners, the formal checks that cover it, its premise memos, its decisions, its direct and transitive users, and the commits that changed it. |
| `whygraph mcp` | The MCP server config that serves the store read-only through `relate serve --mcp stdio`, and every recipe. |

A symbol target is `<file>:<symbol>`, the file path from the repo root (an
absolute path inside the repo also works). `--repo` defaults to the current
folder.

Exit status: 0 an answer (an empty one included), 1 a failure (a missing tool,
no store, a rejected decisions file, a failed load), 2 a usage error (a target
that is not `<file>:<symbol>` or lies outside the repo), 3 a target that the
graph does not hold. A message for 3 names what was not found and the closest
names that exist.

## The store

The store is a relate directory store. By default it lives at
`<git dir>/whygraph/store`, one per worktree, where git ignores it; `--store`
puts it elsewhere.

`store` is a symlink to one build. A build loads into a new directory and,
only when every statement succeeded, swaps the link in one rename and removes
the build it replaced. So:

- a second build replaces the store and never merges into the old one;
- a failed build leaves the store as it was;
- a reader that opened the store before a rebuild (an MCP server) keeps
  answering from the graph it opened, and a reader opened after it sees the
  new one. Restart a long-running MCP server after a build.

relate allows one writer per store and reads a directory store beside its
writer; whygraph's builds never write a store that a reader has open.

## Decisions file

Every source of decisions produces this JSON. A build takes any number of
them (`--decisions` repeats); record ids are unique across all of them.

```json
{
  "records": [
    {
      "id": "ADR-0004",
      "title": "A commit changes a symbol's code when the symbol's code hash changes",
      "date": "2026-11-12",
      "status": "accepted",
      "source": "docs/adr/0004-code-changes-by-code-hash.md",
      "items": [{ "label": "choice", "text": "B (operator decision, 2026-11-12). ..." }],
      "topics": ["memod-graph"],
      "restsOn": ["ADR-0003"],
      "supersedes": [],
      "commits": ["1fa2df784415296543a2b664d836875455c91bc6"]
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
| `items` | no | Statements of the record: `{ "label", "text" }`, such as a `decided` line or an ADR section. |
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

### From ADRs

`whygraph decisions adr <folder>` reads each `NNNN-<title>.md` in the folder:

- `id` is `ADR-NNNN`; `title` is the first `# ` heading, without a leading
  `ADR <n>:`.
- `date`, `status` and `topics` come from the lines between the title and the
  first `## ` heading: `Date: YYYY-MM-DD`, `Status: <text>` (or a `## Status`
  section) and `[[slug]]` links. A missing date or status is `null`.
- Every other `## ` section is an item labelled with its heading in lower
  case.
- `supersedes` holds the ADRs named on a line with `Supersedes` or
  `Replaces`, and every ADR that says `Superseded by ADR <n>` of this one.
- `restsOn` holds the other ADRs that the text names (`ADR 3`, `ADR 0003`,
  `ADR-0003`) with a smaller number. A mention of a later ADR is a note added
  afterwards, so it does not count.
- `commits` holds the commit of `HEAD` that added the file, following
  renames. A later commit that edits the file, or whose message mentions the
  ADR, does not count: every later link is a `Decision:` trailer (see below).

### From other sources

Convert to the format above. For example, a memo export with one row per
item (`memo`, `date`, `label`, `text`, `topics`, `premises`, `supersedes`,
`commits`) converts with `jq`:

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

## How a record links to code

A record links to code only where someone named it on purpose. There are two
ways, and every answer says which one it used.

**A `decided:` tag names it (direct).** A tag on a symbol or in a file header
names a record when its text holds:

- for an ADR id `ADR-NNNN`: `adr-NNNN`, `ADR-NNNN` or `ADR NNNN`. The letters
  are all lower or all upper case, then one `-` or one space, then exactly four
  digits;
- for any other id: the id exactly, case included.

In both cases the name must not touch a letter, digit, `_` or `-` on either
side. A near match links nothing: `ADR 4`, `Adr-0004`, `ADR  0004` (two
spaces), `ADR-00041`, `note-10` or `Note-1` for `note-1`. A tag that names an
ADR id no record has is a build warning. A tag with no record name still
shows in `why`, as the decision it is.

**A commit cites it (loose).** A record cites the commits it lists in its
`commits` field (for an ADR, the commit that added its file) and every
commit of `HEAD` whose message ends with a trailer:

```
Decision: ADR-0004
Decision: note-1
```

git reads the trailers (the last paragraph of the message; the key in any
case). The value must equal a record id exactly; a short or differently cased
id links nothing and is a build warning. A commit ties every symbol it changed
to the record, so answers give each commit's symbol count: a link through a
commit that changed one symbol is strong, one through a commit that changed
sixty is weak.

`why` lists a record once: under the tags when a tag names it (with the
commits that also cite it), else under the commits.

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

`why` joins a symbol to a decision directly through
`(:Symbol)-[:DECIDED]->(:DecidedTag)-[:NAMES]->(:Decision)` (or the same from
its File), and loosely through
`(:Decision)-[:CITES]->(:Commit)-[:CHANGES]->(:Symbol)`.

## Recipes and MCP

The Cypher behind `why`, `impact` and `carry` lives in `recipes/*.cypher`,
one statement per file with its question and parameters in a comment. The
commands run these files, and `whygraph mcp` prints them, so an agent that
queries the store over MCP gets the same answers.

| Recipe | Parameter | Answers |
| --- | --- | --- |
| `why` | `symbol` | decided tags and decision records behind a symbol, with how each record links |
| `impact` | `decision` | records that rest on a decision; for each, the code whose tags name it, and the commits that cite it with the symbols they changed |
| `carry` | `symbol` | topics, checks, premises and commits of a symbol |
| `users` | `symbol` | symbols that use it, with distance |
| `names` | | every file, symbol and record id |

Over MCP, call `read_cypher` with the recipe as `statement` and
`{"symbol": "src/main.ts#run"}` as `parameters`.

## Limits

- memod reads symbol uses only in TypeScript and JavaScript. For a symbol in
  another language, `carry` says its users are unknown.
- A link through a commit ties every symbol the commit changed to the record;
  answers give the commit's symbol count so a reader can weigh it.
- A tag links by the record's id only, whatever the sentence says. A tag that
  names an ADR to say what the ADR leaves open still links to it.
- memod reads no `decided:` tag on an interface member, so a record named
  there gets no direct link.
- `impact` lists a file whose header tag names the record, and still lists
  that file's symbols among the symbols the record's commits changed (as
  loose links), although the header tag covers them directly.
- The recipes use no `CALL { }` subquery: relate's read-only MCP tool rejects
  one ("Only MATCH queries are allowed"), though `relate query` runs it.
- `CHANGES` reaches only files and symbols that exist now; memod does not
  index Markdown, so an ADR file has no node.

## Develop

```sh
pnpm check                       # tsrs type check
node_modules/.bin/memod lint     # must exit 0 before a commit
scripts/fixture.sh /tmp/fx       # the fixture repo that tests and the demo share
```

Decision logic lives in `src/*.pure.ts`; child processes and files stay in
the other files of `src/`. [docs/failures.md](docs/failures.md) lists every
way a command can fail or answer wrong, as input and required result.

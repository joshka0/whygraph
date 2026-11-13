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
- **search**: which decision record best matches this change, when no tag or
  commit links it to the code?

Here is the question an agent asks before it edits `formatCents` in the small
shop repo that comes with whygraph. The code of `formatCents` mentions no
decision. The graph finds two: ADR-0001 through the commits that changed it,
and the design note `note-2` ("Show thousands separators in totals") through
the commit that added the separators. It also lists what sits one step away
(the decisions, checks and topics of the symbols it uses and of those that use
it), who calls it, and the commits that changed it.

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

One step away, most binding first (what formatCents uses, then what uses formatCents):
  - topic owned by src/cart.ts:total, which uses formatCents: fx-cart
Searched: src/money.ts:formatCents, the header of src/money.ts, the 0 symbols formatCents uses, 1 symbol that uses formatCents, and the headers of their files.
Not searched: symbols further away (run carry on a neighbor to look past it); code in languages without symbol edges (memod reads uses only in TypeScript and JavaScript); uses the graph cannot see, such as a function passed as a value or called through an interface; records linked to a neighbor only through a commit.

Decision records that share the most distinctive terms with its code (candidates, not links: a shared word does not mean the record governs this symbol):
  2026-01-02  ADR-0002  One flat tax rate
      shared terms: cents
  2026-01-03  ADR-0003  Tax rate by region
      shared terms: cents

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
- memod, at commit `740ad96` of its `code-graph` branch. memod is a separate
  tool by the same author: it reads a repo's code, doc-comment tags and git
  history into a graph (`memod graph --history`), and whygraph loads that
  graph. memod has no public release. This repo gets it as a dev dependency
  pinned in `package.json` to a local clone:
  `git+file:///home/dev/repos/personal/memod#740ad96...`. To install whygraph
  you need a memod clone that holds that commit, at that path or at a path
  you write into `package.json` instead.

whygraph has one runtime dependency, `@huggingface/transformers`, which runs
a local ONNX model to rank decision records by meaning for `whygraph
search`. It otherwise runs `git`, `memod` and `relate` as child processes.
Every `relate` call it makes sets `RELATE_TELEMETRY=0` and `DO_NOT_TRACK=1`.

The model is `Xenova/bge-small-en-v1.5` (384 dimensions, cosine). The first
`whygraph build` downloads it: about 35 MB of weights into `~/.cache/whygraph`.
Later builds and every `search` read it from there. With no network and no
cache, `build` and `search` exit 1 with an error that names the model; they
do not fall back to the word search alone.

## Set up

In the folder where you cloned whygraph:

```sh
pnpm install
export WHYGRAPH="$PWD"
export PATH="$WHYGRAPH/bin:$WHYGRAPH/node_modules/.bin:$PATH"
```

`pnpm install` builds memod from the pinned commit and installs the
embedding runtime (about 500 MB, mostly the ONNX runtime binaries for every
platform). `bin/` holds the `whygraph` command and `node_modules/.bin` holds
`memod`. Put the two `export` lines in your shell profile (with the folder's
full path in place of `$PWD`) so that every shell, and every agent you start
from one, finds them.

```console
$ whygraph help
whygraph: why the code is the way it is, as a relate graph

  whygraph build [--repo <path>] [--store <path>] [--decisions <file>]...
  whygraph decisions adr <folder>
  whygraph why <file>:<symbol> [--repo <path>] [--store <path>]
  whygraph impact <decision id> [--repo <path>] [--store <path>]
  whygraph carry <file>:<symbol>|<file>:<start>-<end> [--repo <path>] [--store <path>]
  whygraph search "<text>" [--repo <path>] [--store <path>]
  whygraph mcp [--repo <path>] [--store <path>]

Exit: 0 answer, 1 failure, 2 usage, 3 target not in the graph.
```

## Try it on the fixture

`scripts/fixture.sh` builds a small shop repo with nine commits, three ADRs
and a file of design notes. The commit ids are the same on every machine.
Run it from the whygraph folder, with a target folder that does not exist yet;
it prints the history:

```console
$ scripts/fixture.sh ~/try/shop
* 17078bb 2026-01-09 Add checkout with tax rounded half to even
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
commits. The last commit adds a checkout that rounds tax with
`roundHalfEven`, which carries a `decided:` tag and a formal check.

Turn the ADRs into a decisions file, then build the graph from the code, its
history and both decisions files:

```console
$ whygraph decisions adr docs/adr > ../adrs.json
$ whygraph build --decisions ../adrs.json --decisions decisions/notes.json
Built ~/try/shop/.git/whygraph/store
from ~/try/shop: 9 commits, 5 decision records from 2 decisions files, 0 warnings.
93 nodes:
  Check        1
  Commit       9
  DecidedTag   5
  Decision     5
  File         6
  Item         8
  Symbol       8
  Term         45
  Topic        6
148 relationships:
  ABOUT        5
  CHANGES      27
  CITES        7
  DECIDED      5
  DECLARES     8
  IMPORTS      3
  MENTIONS     57
  NAMES        3
  OWNS         14
  RESTS_ON     4
  STATES       8
  SUPERSEDES   1
  USES         5
  VERIFIED     1
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

One step away, most binding first (what formatCents uses, then what uses formatCents):
  - topic owned by src/cart.ts:total, which uses formatCents: fx-cart
Searched: src/money.ts:formatCents, the header of src/money.ts, the 0 symbols formatCents uses, 1 symbol that uses formatCents, and the headers of their files.
Not searched: symbols further away (run carry on a neighbor to look past it); code in languages without symbol edges (memod reads uses only in TypeScript and JavaScript); uses the graph cannot see, such as a function passed as a value or called through an interface; records linked to a neighbor only through a commit.

Decision records that share the most distinctive terms with its code (candidates, not links: a shared word does not mean the record governs this symbol):
  2026-01-02  ADR-0002  One flat tax rate
      shared terms: cents
  2026-01-03  ADR-0003  Tax rate by region
      shared terms: cents

1 symbol uses it directly, 1 in all (distance n: through n-1 other symbols; type: only a type use):
   1  src/cart.ts:total

3 commits changed its code or tags, newest first:
  395b8c0 2026-01-08 Name every amount by its unit
  73ebd46 2026-01-04 Format cents with thousands separators (ADR 0001)
  dfb4ff8 2026-01-01 Add money and cart in cents
```

A decision can sit on the code that a symbol uses. `checkout` holds its own
tag, and `carry` also shows the tag and the formal check of `roundHalfEven`,
which it uses:

```console
$ whygraph carry src/checkout.ts:checkout
Before you edit src/checkout.ts:checkout

Topics it owns (keep its job inside these; another file that owns one and does not import this one is a duplicate):
  - fx-checkout: no other file owns it
No formal check covers it.
Its doc comment names no premise memo.

Decided in its doc comment:
  - decided: checkout adds tax to the net once because the receipt shows one tax line
The header of src/checkout.ts holds no decided: tag.
No decided: tag names a decision record.
No decision record cites a commit that changed its code or tags.

One step away, most binding first (what checkout uses, then what uses checkout):
  - decided on src/rounding.ts:roundHalfEven, which checkout uses: ties round to even because rounding half up overcharges on average
  - check on src/rounding.ts:roundHalfEven, which checkout uses: memod verify rounding-model
  - topic owned by src/rounding.ts:roundHalfEven, which checkout uses: fx-rounding
Searched: src/checkout.ts:checkout, the header of src/checkout.ts, the 1 symbol checkout uses, 0 symbols that use checkout, and the headers of their files.
Not searched: symbols further away (run carry on a neighbor to look past it); code in languages without symbol edges (memod reads uses only in TypeScript and JavaScript); uses the graph cannot see, such as a function passed as a value or called through an interface; records linked to a neighbor only through a commit.

Decision records that share the most distinctive terms with its code (candidates, not links: a shared word does not mean the record governs this symbol):
  2026-01-02  ADR-0002  One flat tax rate
      shared terms: rate, cents
  2026-01-03  ADR-0003  Tax rate by region
      shared terms: rate, cents
  2026-01-01  ADR-0001  Money in cents
      shared terms: cents

No symbol uses it.

1 commit changed its code or tags, newest first:
  17078bb 2026-01-09 Add checkout with tax rounded half to even
```

`carry` also takes an explicit 1-based line range, `<file>:<start>-<end>`. Use
it for a long symbol (a class or a big function) whose whole span spreads its
terms thin: a symbol longer than 40 lines gets a one-line term section that
names the range form. The term section then ranks the records against exactly
those lines, and the linked decisions, checks and topics come from every symbol
whose stored range overlaps them, each symbol named with its span. A file the
graph holds no symbol for, such as a config file or a shell script, still gets
the term section, and the output says no symbol covers the lines.

```console
$ whygraph carry src/tax.ts:1-8
Before you edit src/tax.ts:1-8

No symbol's stored range overlaps these lines; the graph holds no symbol for src/tax.ts.

Decision records that share the most distinctive terms with these lines (candidates, not links: a shared word does not mean the record governs these lines):
  2026-01-03  ADR-0003  Tax rate by region
      shared terms: the, adr, cents, tax
  2026-01-02  note-1  Tax is computed once per order, not per line
      shared terms: not, because, tax
  2026-01-02  ADR-0002  One flat tax rate
      shared terms: adr, tax, cents
  2026-01-01  ADR-0001  Money in cents
      shared terms: money, cents
  2026-01-04  note-2  Show thousands separators in totals
      shared terms: because, the
```

A record can govern a change with no tag or commit that links it to the code.
`search` ranks the records by their text and shows the candidates; the reader
judges whether one governs the change. Each line says how it matched: by
words, by meaning, or by both. The `statement:` line holds the first line of
the record's first statement, and is left out when it repeats the title.

```console
$ whygraph search "round tax half to even"
Decision records that match "round tax half to even", best match first (a candidate, not a link: read the record and judge whether it governs your change):
  2026-01-02  note-1  Tax is computed once per order, not per line
      matched: words and meaning
      statement: tax once per order because per-line rounding adds up to a cent per line
      source: decisions/notes.json
  2026-01-02  ADR-0002  One flat tax rate
      matched: words and meaning
      statement: Tax is computed on cents (ADR 0001).
      source: docs/adr/0002-flat-tax.md
  2026-01-03  ADR-0003  Tax rate by region
      matched: words and meaning
      statement: Orders now ship outside the EU. Amounts stay in cents (ADR 0001).
      source: docs/adr/0003-regional-tax.md
  2026-01-01  ADR-0001  Money in cents
      matched: meaning
      statement: Prices arrive as decimal numbers.
      source: docs/adr/0001-money-in-cents.md
  2026-01-04  note-2  Show thousands separators in totals
      matched: meaning
      statement: en-US separators because the shop sells in USD first
      source: decisions/notes.json
Searched: the title and statement of every decision record in the store, for the words: round tax half to even, and for the meaning of the request.
Not searched: the code, the commits and the tags (run whygraph why or carry on a symbol for the links the graph holds); a record's id, date, status, topics and source (only its title and statement are indexed).
```

A name the graph does not hold exits 3 and lists close names:

```console
$ whygraph carry src/money.ts:cent
whygraph: src/money.ts has no symbol cent. Close: src/money.ts:cents, src/money.ts:formatCents.
[exit 3]
```

## What a trial measured

Does an agent with the why graph handle change requests better? The trial in
`eval/` asks. Claude Code ran headless with one model (its `sonnet` alias) on
change requests in two batches. The first had fourteen: eight on the fixture
shop and six on memod. The second, fixed in advance before any of its runs,
had sixteen chosen blind by an agent that knew nothing about whygraph: eight
more on memod and eight on memoryd, a repo with ADRs but no `decided:` tags.
Some go against a recorded decision, some ask what a reversed decision
affects, and some are harmless controls. Each request ran five times in each
of three conditions, every run in a fresh copy of the repo:

- **none**: the repo only.
- **graph**: the repo, a fresh store, the skill and the rule section, as this
  README installs them.
- **stub**: the same skill and rule, but `whygraph` answers "no result". It
  separates what the graph says from the caution the rule text causes.

A conflict request passes when the agent names the decision and either leaves
the code alone or amends the record along with the change. An impact request
passes when the agent lists the symbols that change. A control passes when the
agent makes the change without objecting. `eval/README.md` has the design and
the rules.

These are the scorer's numbers, copied from `eval/score.txt`: the pass rate per
condition, then the mean over tasks of the per-task difference in pass rate,
with a bootstrap interval over tasks.

<!-- readme-check: score eval/score.txt -->
```text
=== All tasks
  none    51%  (69 runs, 6387965 tokens)
  graph   96%  (70 runs, 4819322 tokens)
  stub    61%  (70 runs, 6429486 tokens)
  graph - none: 0.45 [0.24, 0.67] over 14 tasks
  graph - stub: 0.34 [0.11, 0.60] over 14 tasks
=== Without the tasks that shaped the tool (memod-conflict-report-build-gate)
  none    55%  (64 runs, 5672259 tokens)
  graph   95%  (65 runs, 4329837 tokens)
  stub    66%  (65 runs, 5764101 tokens)
  graph - none: 0.40 [0.20, 0.62] over 13 tasks
  graph - stub: 0.29 [0.06, 0.54] over 13 tasks
=== Unscored runs (an agent timed out twice; not in any rate above): 1
Sensitivity: the same paired differences with every unscored run counted as FAIL:
  All tasks: graph - none: 0.46 [0.24, 0.67] over 14 tasks; graph - stub: 0.34 [0.11, 0.60] over 14 tasks
  Without the tasks that shaped the tool: graph - none: 0.42 [0.22, 0.63] over 13 tasks; graph - stub: 0.29 [0.06, 0.54] over 13 tasks
=== Post hoc: without the outside-only tasks
  none    65%  (54 runs, 5961163 tokens)
  graph   95%  (55 runs, 4259082 tokens)
  stub    78%  (55 runs, 5903519 tokens)
  graph - none: 0.30 [0.11, 0.51] over 11 tasks
  graph - stub: 0.16 [-0.02, 0.40] over 11 tasks
=== Post hoc: without the outside-only tasks and the tasks that shaped the tool (memod-conflict-report-build-gate)
  none    71%  (49 runs, 5245457 tokens)
  graph   94%  (50 runs, 3769597 tokens)
  stub    86%  (50 runs, 5238134 tokens)
  graph - none: 0.23 [0.08, 0.40] over 10 tasks
  graph - stub: 0.08 [-0.04, 0.26] over 10 tasks
=== Batch 2: the sixteen tasks chosen blind (primary result: graph - stub)
  none    61%  (80 runs, 5471307 tokens)
  graph   76%  (80 runs, 4545897 tokens)
  stub    69%  (80 runs, 4953354 tokens)
  graph - none: 0.15 [0.00, 0.31] over 16 tasks
  graph - stub: 0.07 [-0.01, 0.18] over 16 tasks
=== Batch 2: memod only
  graph - none: -0.03 [-0.15, 0.08] over 8 tasks
  graph - stub: 0.05 [0.00, 0.12] over 8 tasks
=== Batch 2: memoryd only
  graph - none: 0.33 [0.08, 0.58] over 8 tasks
  graph - stub: 0.10 [-0.05, 0.28] over 8 tasks
=== Both batches: all thirty tasks
  none    56%  (149 runs, 11859272 tokens)
  graph   85%  (150 runs, 9365219 tokens)
  stub    65%  (150 runs, 11382840 tokens)
  graph - none: 0.29 [0.15, 0.44] over 30 tasks
  graph - stub: 0.20 [0.07, 0.34] over 30 tasks
```

The "Post hoc" groups were added after the results were seen. Three fixture
requests rest on design notes that live only outside the repo, so no agent
without the graph can name them. By design they pass in graph every time and
never in none or stub, and they carry much of the headline. Without them the
graph still leads none, but the interval of its lead over stub reaches below
zero.

The second batch is the cleaner test: its requests were chosen blind and the
tool did not change after they were seen. There the graph's lead over stub is
small and its interval reaches below zero; its lead over none comes mostly from
memoryd, where the skill and rule alone (stub) already do much of the work.
Before the run, the graph was expected to add little on memoryd: its store
links few ADRs to code, and `why` gave a record for only one of the memoryd
targets checked.

What this does not show:

- One model, one prompt wrapper, and five repeats per cell: a single run moves
  a cell a lot.
- The tool's author chose the eight fixture requests. Agents that knew
  nothing about whygraph chose the memod and memoryd requests blind.
- The pilot request (memod's report build gate) changed the tool. Graph failed
  it because `carry` did not show a decision one step away, so `carry` was
  changed to show it. Its numbers are not independent; the second and fourth
  groups above leave it out.
- The verdicts are mechanical, from the reply's words and the diff, not a
  review of the change.
- A runner bug was fixed after the run: it kept only the last of a session's
  replies. The fix rescored every run and changed six verdicts, all from fail
  to pass, four of them in the graph condition.

## What a retrieval check measured

The trial above has few decisions that live only outside the repo. Most real
ones do: an agent decides in plain words in its notes, and other agents write
the code later, with no tag and no commit that cites the note. So a second
check asked a narrower question, with no agent in it: when a change request
goes against such a note, does whygraph list that note among its five
candidates?

The records were the decision notes of two private projects, loaded through
the decisions file format. For each check, one agent that knew nothing about
whygraph read a sample of the notes and wrote 30 change requests, each of
which goes against one note: 10 that reuse the note's words, 10 that reuse
some, and 10 that use other words. A second agent, which saw only the request
and the code, named the lines the request would change. A request counts when
the note it goes against is among the five records listed.

Check 1, 4,453 notes of two projects, `search` only:

| Request wording | `search` |
| --- | --- |
| Same words | 10 of 10 |
| Some of the words | 4 of 10 |
| Other words | 1 of 10 |
| All | 15 of 30 |

The words alone found 11 of the 30 and the meaning alone 16. The term section
of `carry` was built after this check and because of it: a request in other
words shares little with the note, but the code it changes often shares
identifiers with the note.

Check 2, 30 new requests on 1,791 notes of one project, the tool unchanged
after the requests were written. `carry` ran on each line range the second
agent named, which it did for 27 of the 30:

| Request wording | `search` with the request | `carry` on the lines | Either |
| --- | --- | --- | --- |
| Same words | 10 of 10 | 7 of 10 | 10 of 10 |
| Some of the words | 5 of 10 | 5 of 10 | 6 of 10 |
| Other words | 4 of 10 | 5 of 10 | 7 of 10 |
| All | 19 of 30 | 17 of 30 | 23 of 30 |

What this shows and what it does not:

- The two questions find different notes. On requests in other words, three
  of the five notes that `carry` found were ones `search` missed.
- It measures a list, not an agent: nothing here shows that an agent reads the
  five candidates, picks the right one and acts on it.
- A hit needs the right lines. `carry` on a whole long symbol ranked the note
  much worse than on the lines an agent chose (see Limits), and the three
  requests with no lines found could not be asked at all.
- Each check is 30 requests written by one model, on one or two projects of
  one author. Ten requests per row means one request moves a row by ten
  points.
- The notes and requests are private, so this repo does not hold them and you
  cannot rerun the check from it. The numbers come from the tool as it is in
  this repo.

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
| `whygraph carry <file>:<symbol>\|<file>:<start>-<end>` | Before an edit: the topics the symbol owns and their other owners, the formal checks that cover it, its premise memos, its decisions (as `why`); then one step away, the `decided:` tags, the records they name, the checks and the topics of the symbols it uses and of the symbols that use it, most binding first, each line naming where it sits; then the decision records that share the most distinctive terms with its code (candidates, not links), each naming its shared terms; then its direct and transitive users, and the commits that changed it. The range form reads exactly those lines for the term section and takes the linked parts from every symbol whose stored range overlaps them. |
| `whygraph search "<text>"` | The five decision records that best match the text: the word search and the meaning search each rank at most five, fused by reciprocal rank, each line saying how it matched (`words`, `meaning` or `words and meaning`), each a candidate to judge, not a link; then what was searched and what was not. |
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
the way it is, ask `why`; and when a link is missing or `why` finds no record,
ask `search` with the change in your own words. It gives the exact commands,
how to read a direct and a loose link, and what to do on each exit status.

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
| `Symbol` | `id` (`<file>#<name>`) | `path`, `name`, `line`, `endLine` | memod `symbol` |
| `Topic` | `slug` | | memod `topic`, record `topics` |
| `DecidedTag` | `hash` | `what`, `because` | memod `decision` (a `decided:` tag) |
| `Check` | `name` | | memod `check` |
| `Memo` | `ref` | | memod `memo` (a `premise:` tag) |
| `Commit` | `sha` | `short`, `date`, `subject` | memod `commit` |
| `Decision` | `id` | `title`, `date`, `status`, `source`, `searchText`, `vector`, `termCount` | a decision record |
| `Item` | | `ord`, `label`, `text` | a record's item |
| `Term` | `text` | `records` | a record's text (title and statements) |

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
| `MENTIONS` (`count`) | Decision -> Term (how many times the record's text holds the term) |
| `RESTS_ON`, `SUPERSEDES` | Decision -> Decision |
| `CITES` | Decision -> Commit |

A record reaches a symbol directly through
`(:Symbol)-[:DECIDED]->(:DecidedTag)-[:NAMES]->(:Decision)` (or the same from
its File), and loosely through
`(:Decision)-[:CITES]->(:Commit)-[:CHANGES]->(:Symbol)`.

`Term` nodes hold the words a record's text shares with code. A build
tokenizes each record's title and statements: every run of letters, digits and
`_`, split at `_` and at camelCase and digit boundaries, with the whole
identifier kept too, lowercased, at least three characters, digits only left
out. It makes one `Term` per kept word, holding `records`, the number of
records that use it, and one `MENTIONS` edge from each record to each of its
terms, holding how many times the record's text holds it. Each record holds
`termCount`, every term of its text, kept or not. A term used by more than
half of at least ten records makes no node, because its BM25 weight is under
0.7, near zero; on the 2,662-record memoryd file that rule leaves 6,754 of
6,756 term nodes and 77,404 of 80,858 edges, and drops only `and` and `the`.
The terms are not a link: a shared word is a candidate to read, never a
reason the record governs the code. memod records each symbol's `line` and
`endLine` (1-based, inclusive, the declaration without its doc comment), and
`carry` reads those lines, adds the symbol's name and file path, and shows the
five records that share the most distinctive terms with them, each line naming
the shared terms. A record the answer already lists as a decision of the
symbol is left out, and the heading says a listed record is a candidate, not a
link.

The store is a relate directory store behind a symlink. A build loads into a
new directory and swaps the link only when every statement succeeded, so a
failed build leaves the old store answering, and a second build replaces the
store rather than merging into it.

## Limits

- memod reads which symbols use which only in TypeScript and JavaScript. For
  a symbol in another language, `carry` says its users and what sits one step
  away are unknown.
- `carry` looks one step away and no further, and only along uses the graph
  holds: a function passed as a value or called through an interface is not
  a neighbor. It shows the first 20 lines one step away and says what it left
  out; it lists a neighbor's records only when a tag names them, not when a
  commit links them. Each answer ends with what was searched and what was not.
- `why` does not look one step away: a reason that sits on a symbol this one
  uses appears in `carry`, not in `why`.
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
- The term section reads a symbol's whole span, which for a class or a large
  function is many lines; a method, a constructor or one branch is not its own
  symbol, so a narrow range a person would choose can rank a record higher than
  the symbol's range does (ADR 0002). A term match is a candidate, not a link:
  the section prints no score and common jargon over-links.
- The term section needs the symbol's code in the working tree. A file that is
  gone, a span that no longer fits the file, or a language whose identifiers
  the ASCII tokenizer cannot read gives one line saying so instead. The doc
  comment above the declaration is not read: on the memoryd check it ranked the
  wanted record worse than the declaration alone (ADR 0002).
- `carry` takes a range, `<file>:<start>-<end>`, for a long symbol. The term
  section then reads exactly those lines, with no symbol name or file path
  added, and a range that overlaps several symbols renders one body per symbol.
  A bad range exits 2 and a missing file exits 1, each naming the problem. The
  range form is `carry` only.
- The recipes use no `CALL { }` subquery: relate's read-only MCP tool rejects
  one.
- `search` reads only a record's title and statements. It ranks by words
  and by meaning (a local embedding model), then fuses the two lists by
  reciprocal rank. Neither score separates a record that governs the change
  from noise, and a nearest-by-meaning record is always returned even when
  the request shares nothing with it, so a listed record is a candidate; read
  it and judge. A record with an empty title and no statements matches no
  word and embeds its empty text. `search` over MCP is the word search only:
  an MCP host has no local model to embed the request.
- `build` embeds one record text per model call, so its peak memory does not
  grow with the record count: on this box, under a 6 GB memory and 4-CPU
  limit, a 2,662-record build stayed at about 0.44 GB and took 304 s, about
  114 s per 1,000 records. A build of thousands of records stays under 2 GB.

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

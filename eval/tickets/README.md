# Ticket test

Does whygraph find the ticket that a change request goes against? This folder
holds the scripts for that test and the result of one run on a public repo.
The scripts read only local files and print counts, so you can run them on a
private repo and share the report without sharing any ticket or code.

## The run on ripgrep

[ripgrep](https://github.com/BurntSushi/ripgrep) is a Rust project whose
commits cite issue and pull request numbers. The run used its history up to
2026-11-13 (2,304 commits) and its 3,042 public issues and pull requests.

1. `fetch-github.py` saved every issue and pull request (title and body).
2. `tickets-to-decisions.mjs` turned them into a decisions file. A ticket
   links to each commit whose message cites its number: 1,009 tickets got a
   link, and 446 of them (15% of all tickets) reach a symbol that still
   exists.
3. `whygraph build` loaded code, history and tickets.
4. A language model that knew nothing about whygraph read 150 sampled tickets
   (`sample-ids.json`; drawn from the tickets that reach a symbol and have a
   body of 200 characters or more) and wrote 30 change requests that each go
   against what one ticket settled (`requests.json`): 10 in the ticket's
   words, 10 with one shared term, 10 in other words.
5. A second model saw only the requests and the code and named the lines each
   request would change (`targets.json`). It found lines for 29.
6. `measure.py` ran `whygraph search` with each request and `whygraph carry`
   on each line range, and counted (`report.json`).

A request counts for a column when the ticket is in that part of the answer:

| Request wording | `search` | `carry` term section | `carry` link through a commit | Any |
| --- | --- | --- | --- | --- |
| Same words | 10 of 10 | 3 of 10 | 7 of 10 | 10 of 10 |
| One shared term | 7 of 10 | 1 of 10 | 9 of 10 | 10 of 10 |
| Other words | 5 of 10 | 3 of 10 | 8 of 10 | 9 of 10 |
| All | 22 of 30 | 7 of 30 | 24 of 30 | 29 of 30 |

Six requests were found only through the commit link. Of the 24 link hits,
23 came through a commit that changed at most 20 symbols. A line range listed
3 linked tickets at the median.

What this does not show:

- The sample holds only tickets that a commit cites, so the link column says
  what the link finds when such a commit exists. It exists for about one
  ticket in seven here.
- It measures a list, not an agent: nothing shows that an agent reads the
  answer and acts on it.
- One repo, 30 requests, one model wrote them: one request moves a row by ten
  points.
- The second model had the git history in its folder and was told not to read
  it. That was not checked.

## The same requests on a small store

How much of the `search` column depends on the number of records? A control
ran the same 30 requests and lines on a store that holds 161 tickets, not
3,042: the 33 tickets that a request needs, and 128 drawn at random from the
other tickets that a commit cites (`small-store.py`, seed 1). The counts are
in `report-small-store.json`.

| Store | `search` | `carry` term section | `carry` link through a commit | Any | Link only |
| --- | --- | --- | --- | --- | --- |
| 3,042 tickets | 22 of 30 | 7 of 30 | 24 of 30 | 29 of 30 | 6 |
| 161 tickets | 28 of 30 | 12 of 30 | 24 of 30 | 29 of 30 | 0 |

- The two lists that rank records, `search` and the term section, find more
  on the small store: each lists up to 20 or 10 of only 161 records.
- The commit link finds the same 24 on both stores. It does not rank, so the
  number of other records does not change it.
- So a test on a store of a few hundred records cannot show what the link
  adds: `search` already finds almost every ticket there. Load all the
  tickets of the tracker, not only the ones that commits cite.

## Run it on your repo

You need the whygraph commands on `PATH` (root README, "Set up") and Python 3.

1. Export your tickets to `tickets.json`:
   `[{"key": "ABC-123", "date": "2026-01-02", "title": "...", "body": "...", "author": "...", "source": "..."}]`.
2. Convert, with the pattern your commits use to cite a key:

   ```sh
   node eval/tickets/tickets-to-decisions.mjs --repo . --tickets tickets.json --out tickets.decisions.json \
     --key '\b([A-Z][A-Z0-9]+-\d+)\b'      # JIRA; Azure DevOps: 'AB#(\d+)' with --prefix as needed; GitHub: the default '#(\d+)'
   ```

   It prints how many tickets a commit cites.
3. `whygraph build --decisions tickets.decisions.json`.
4. Write `requests.json` and `targets.json` in the shapes this folder shows.
   Have one agent write the requests from a sample of tickets and another,
   which sees only the requests and the code, name the lines.
5. Measure:

   ```sh
   python3 eval/tickets/measure.py --whygraph whygraph --repo . --store .whygraph/store \
     --requests requests.json --targets targets.json --out ticket-result --prefix ticket-
   ```

   `ticket-result/report.json` holds counts and timings only.
   `ticket-result/detail.json` holds request ids; keep it with the data.

`measure.py` unsets `WHYGRAPH_RERANK`, so no text leaves the machine.

# ADR 0012: Include outcomes and maintainer comments in ticket records

Topic: [[whygraph-ticket-pilot-tasks]]

## Context

Earlier ticket records contain the opening body. An uncited closed ticket
can state its decision in its outcome or in later maintainer comments.
ADR 0008 permits another repo through registry data alone.

## Options

- Keep the opening body as the whole record.
- Include the outcome and comments from the repo's own people.

## Choice

Fetch issue and repository-comment pages without authentication. Use a
generic client name. Keep each complete raw page by URL digest. Restart
from those pages. Rate-limit responses wait until reset or Retry-After.
Keep issue state and close reason. For pull requests, use `merged_at` from
the issue-list item. Never request individual pull requests or comment lists.
The expected request count is ceil(tickets / 100) + ceil(comments / 100),
with at least one page for each list. Optional expected counts print a
numeric estimate before the first request. Unknown totals stay explicit.
Cached pages require no request. Existing matching cached URLs are reused.

Keep only comments whose API association is OWNER, MEMBER or COLLABORATOR.
Sort them by creation time, then source URL. The converter rejects missing
outcome fields. It writes an outcome item that names the issue state,
close reason, and pull-request merge status. A missing close reason is
stated as `not stated`; it is not inferred from the body.

The title and all item texts together use at most 8,000 UTF-8 bytes.
Metadata, labels and commit ids are outside that content budget. The title
uses at most 300 bytes. Keep the outcome, then newest maintainer comments,
then the opening body. Cut the body first, then older comments. A partial
comment ends on a Unicode character boundary. Retained comments print in
time order with their author, association, date and source.

The seeded sampler selects the registry's `sampleCounts` in each stratum.
The generator reads the same counts and derives the total from their sum.
The blind author writes requests for a subset of sampled tickets that state
a decision. Each request names one sampled ticket of the same stratum.
No two requests name the same ticket. The request count must equal the
registry's `counts.requests`. Cited means a commit
that changes a configured source extension cites the ticket. Merge changes
use the first parent. Uncited means
no commit cites it and it is closed. Hash the seed, stratum and ticket id
to order candidates. Shortages or invalid inputs write no sample.

## Consequences

Search indexes the outcome and retained comment text through existing items.
An uncited ticket states a decision only as far as this source text does.
The converter never rebuilds batch 5 or 6 decisions or stores in this work.
Future repos need source extensions and paths in registry data, with no
repo-specific branch in the fetcher, converter, sampler or generator.

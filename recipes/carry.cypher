// carry: what an agent must know before it edits one symbol, besides its
// decisions (why.cypher) and its users (users.cypher).
// Parameter: $symbol, the symbol id "<file>#<name>".
// One row: the topics the symbol owns, and the other files that own each
// (a second owner is a duplicate unless one imports the other); the formal
// checks that cover it (verified: tags, re-run them after a code change);
// the fleet memos its premise: tags rest on; the commits that changed it,
// newest first; and `neighbors`, the symbols one step away.
// A neighbor is a symbol that this one uses or that uses this one (a USES
// edge either way; memod reads them only in TypeScript and JavaScript),
// ordered by id, each listed once with:
// - uses / usesTypeOnly: this symbol uses it (only as a type);
// - usedBy / usedByTypeOnly: it uses this symbol (only as a type);
// - tags: the decided: tags in its doc comment, each with the records it
//   names; header: the same for its file's header, empty when it is this
//   symbol's own file (why.cypher lists that header);
// - checks: the formal checks that cover it; topics: the topics it owns.
// A record reached only through a commit that changed a neighbor is not here.
MATCH (s:Symbol {id: $symbol})
OPTIONAL MATCH (s)-[:OWNS]->(t:Topic)
OPTIONAL MATCH (o:File)-[:OWNS]->(t) WHERE o.path <> s.path
WITH s, t, o ORDER BY o.path
WITH s, t, collect(o.path) AS others ORDER BY t.slug
WITH s, collect(CASE WHEN t IS NULL THEN null ELSE {topic: t.slug, otherOwners: others} END) AS topics
OPTIONAL MATCH (s)-[:VERIFIED]->(c:Check)
WITH s, topics, c ORDER BY c.name
WITH s, topics, collect(c.name) AS checks
OPTIONAL MATCH (s)-[:PREMISE]->(m:Memo)
WITH s, topics, checks, m ORDER BY m.ref
WITH s, topics, checks, collect(m.ref) AS premises
OPTIONAL MATCH (k:Commit)-[:CHANGES]->(s)
WITH s, topics, checks, premises, k ORDER BY k.date DESC, k.sha
WITH s, topics, checks, premises, collect(CASE WHEN k IS NULL THEN null ELSE k.short + ' ' + substring(k.date, 0, 10) + ' ' + k.subject END) AS commits
OPTIONAL MATCH (s)-[:USES]-(n:Symbol) WHERE n <> s
WITH DISTINCT s, topics, checks, premises, commits, n
OPTIONAL MATCH (f:File)-[:DECLARES]->(n)
WITH s, topics, checks, premises, commits, n, f, [(s)-[r:USES]->(n) | r.typeOnly] AS out, [(n)-[r:USES]->(s) | r.typeOnly] AS inn
ORDER BY n.id
RETURN s.id AS symbol, s.path AS file, topics, checks, premises, commits,
  collect(CASE WHEN n IS NULL THEN null ELSE {
    symbol: n.id, file: f.path,
    uses: size(out) > 0, usesTypeOnly: size(out) > 0 AND all(x IN out WHERE x),
    usedBy: size(inn) > 0, usedByTypeOnly: size(inn) > 0 AND all(x IN inn WHERE x),
    tags: [(n)-[:DECIDED]->(t:DecidedTag) | {hash: t.hash, what: t.what, because: t.because, records: [(t)-[:NAMES]->(d:Decision) | {id: d.id, date: d.date, title: d.title, status: d.status, source: d.source, supersededBy: [(x:Decision)-[:SUPERSEDES]->(d) | x.id]}]}],
    header: CASE WHEN f.path = s.path THEN [] ELSE [(f)-[:DECIDED]->(t:DecidedTag) | {hash: t.hash, what: t.what, because: t.because, records: [(t)-[:NAMES]->(d:Decision) | {id: d.id, date: d.date, title: d.title, status: d.status, source: d.source, supersededBy: [(x:Decision)-[:SUPERSEDES]->(d) | x.id]}]}] END,
    checks: [(n)-[:VERIFIED]->(c:Check) | c.name],
    topics: [(n)-[:OWNS]->(t:Topic) | t.slug]
  } END) AS neighbors

// carry: what an agent must know before it edits one symbol, besides its
// decisions (why.cypher) and its users (users.cypher).
// Parameter: $symbol, the symbol id "<file>#<name>".
// One row: the topics the symbol owns, and the other files that own each
// (a second owner is a duplicate unless one imports the other); the formal
// checks that cover it (verified: tags, re-run them after a code change);
// the fleet memos its premise: tags rest on; and the commits that changed it,
// newest first.
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
RETURN s.id AS symbol, s.path AS file, topics, checks, premises, collect(CASE WHEN k IS NULL THEN null ELSE k.short + ' ' + substring(k.date, 0, 10) + ' ' + k.subject END) AS commits

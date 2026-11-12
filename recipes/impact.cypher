// impact: what rests on one decision record.
// Parameter: $decision, a decision record id such as "ADR-0004".
// Rows: one per (record, symbol): the record itself (depth 0) and every
// record that rests on it, directly or through others (depth = fewest
// RESTS_ON steps); each symbol whose code or tags a commit cited by that
// record changed; `users` counts the symbols whose code names it directly.
// A record whose commits changed no symbol gives one row with symbol null.
// supersededBy lists the records that replace each record.
// Ordered by depth, record id, users (most first), symbol.
MATCH (base:Decision {id: $decision})
MATCH p = (r:Decision)-[:RESTS_ON*0..]->(base)
WITH r, min(length(p)) AS depth
OPTIONAL MATCH (r)-[:CITES]->(k:Commit)-[:CHANGES]->(s:Symbol)
WITH r, depth, s, collect(DISTINCT k.short) AS commits
OPTIONAL MATCH (u:Symbol)-[:USES]->(s)
WITH r, depth, s, commits, count(DISTINCT u) AS users
OPTIONAL MATCH (n:Decision)-[:SUPERSEDES]->(r)
WITH r, depth, s, commits, users, n ORDER BY n.id
WITH r, depth, s, commits, users, collect(n.id) AS supersededBy
RETURN depth, r.id AS record, r.date AS date, r.title AS title, r.source AS source, supersededBy, s.id AS symbol, users, commits
ORDER BY depth, record, users DESC, symbol

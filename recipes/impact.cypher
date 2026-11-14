// impact: what rests on one decision record.
// Parameter: $decision, a decision record id such as "ADR-0004".
// Rows: one per record: the record itself (depth 0) and every record that
// rests on it, directly or through others (depth = fewest RESTS_ON steps).
// - tagged: the symbols whose decided: tags name the record (a direct link),
//   most used first, each with `users`, the symbols whose code names it
//   directly;
// - files: the files whose header decided: tags name the record;
//   each record row holds its `author`, null when the record states none;
// - cites: the commits that cite the record (listed by the record, such as
//   the commit that added an ADR's file), oldest
//   first, each with `symbols`, the number of symbols it changed;
// - changed: the other symbols those commits changed (not in tagged), most
//   used first, with `users` and the commits; a loose link, since a commit
//   ties every symbol it changed to the record.
// supersededBy lists the records that replace each record.
// Ordered by depth, then record id.
MATCH (base:Decision {id: $decision})
MATCH p = (r:Decision)-[:RESTS_ON*0..]->(base)
WITH r, min(length(p)) AS depth
OPTIONAL MATCH (s:Symbol)-[:DECIDED]->(:DecidedTag)-[:NAMES]->(r)
WITH DISTINCT r, depth, s
OPTIONAL MATCH (u:Symbol)-[:USES]->(s)
WITH r, depth, s, count(DISTINCT u) AS users ORDER BY users DESC, s.id
WITH r, depth, collect(CASE WHEN s IS NULL THEN null ELSE {symbol: s.id, users: users} END) AS tagged
OPTIONAL MATCH (f:File)-[:DECIDED]->(:DecidedTag)-[:NAMES]->(r)
WITH DISTINCT r, depth, tagged, f ORDER BY f.path
WITH r, depth, tagged, collect(f.path) AS files
OPTIONAL MATCH (r)-[:CITES]->(k:Commit)
WITH r, depth, tagged, files, k ORDER BY k.date, k.sha
WITH r, depth, tagged, files, collect(CASE WHEN k IS NULL THEN null ELSE {commit: k.short, date: substring(k.date, 0, 10), subject: k.subject, symbols: COUNT { (k)-[:CHANGES]->(:Symbol) }} END) AS cites
OPTIONAL MATCH (r)-[:CITES]->(k:Commit)-[:CHANGES]->(s:Symbol)
WHERE NOT EXISTS { MATCH (s)-[:DECIDED]->(:DecidedTag)-[:NAMES]->(r) }
WITH r, depth, tagged, files, cites, s, k ORDER BY k.short
WITH r, depth, tagged, files, cites, s, collect(DISTINCT k.short) AS commits
OPTIONAL MATCH (u:Symbol)-[:USES]->(s)
WITH r, depth, tagged, files, cites, s, commits, count(DISTINCT u) AS users ORDER BY users DESC, s.id
WITH r, depth, tagged, files, cites, collect(CASE WHEN s IS NULL THEN null ELSE {symbol: s.id, users: users, commits: commits} END) AS changed
OPTIONAL MATCH (n:Decision)-[:SUPERSEDES]->(r)
WITH r, depth, tagged, files, cites, changed, n ORDER BY n.id
WITH r, depth, tagged, files, cites, changed, collect(n.id) AS supersededBy
RETURN depth, r.id AS record, r.date AS date, r.title AS title, r.author AS author, r.source AS source, supersededBy, tagged, files, cites, changed
ORDER BY depth, record

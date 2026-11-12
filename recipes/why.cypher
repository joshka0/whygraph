// why: the decisions behind one symbol.
// Parameter: $symbol, the symbol id "<file>#<name>", such as "src/main.ts#run".
// Rows: one per decision. kind "tag" is a decided: tag in the symbol's doc
// comment; "file tag" is one in its file's header; "record" is a decision
// record that cites a commit that changed the symbol's code or tags, with
// those commits in `via`. Ordered: tags first, then records oldest first
// (undated last), then by id.
MATCH (s:Symbol {id: $symbol})-[:DECIDED]->(t:DecidedTag)
RETURN 0 AS rank, 'tag' AS kind, t.hash AS id, null AS date, t.what AS what, t.because AS because, null AS status, s.path AS source, [] AS via, [] AS supersededBy
UNION ALL
MATCH (f:File)-[:DECLARES]->(s:Symbol {id: $symbol}), (f)-[:DECIDED]->(t:DecidedTag)
RETURN 1 AS rank, 'file tag' AS kind, t.hash AS id, null AS date, t.what AS what, t.because AS because, null AS status, f.path AS source, [] AS via, [] AS supersededBy
UNION ALL
MATCH (d:Decision)-[:CITES]->(k:Commit)-[:CHANGES]->(s:Symbol {id: $symbol})
WITH d, k ORDER BY k.date, k.sha
WITH d, collect(k.short + ' ' + substring(k.date, 0, 10) + ' ' + k.subject) AS via
OPTIONAL MATCH (n:Decision)-[:SUPERSEDES]->(d)
WITH d, via, n ORDER BY n.id
WITH d, via, collect(n.id) AS supersededBy
RETURN CASE WHEN d.date IS NULL THEN 3 ELSE 2 END AS rank, 'record' AS kind, d.id AS id, d.date AS date, d.title AS what, null AS because, d.status AS status, d.source AS source, via, supersededBy
ORDER BY rank, date, id

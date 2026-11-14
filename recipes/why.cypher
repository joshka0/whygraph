// why: the decisions behind one symbol.
// Parameter: $symbol, the symbol id "<file>#<name>", such as "src/main.ts#run".
// Rows: one per decision. kind "tag" is a decided: tag in the symbol's doc
// comment; "file tag" is one in its file's header. kind "record" is a
// decision record, listed once however it links:
// - `named` holds "doc comment" and/or "file header" when a decided: tag
//   there names the record's id (a direct link, made on purpose); the record's
//   `author` is who the record states decided it, null when it states none;
// - `via` holds the commits that cite the record (a `Decision:` trailer, or
//   listed by the record, such as the commit that added an ADR's file) and
//   changed the symbol's code or tags, tightest commit first, each with
//   `symbols`, the number of symbols that commit changed in all: a commit that
//   changed many symbols ties each of them only loosely to the record.
// Ordered: tags, file tags, records a doc-comment tag names, records only a
// header tag names, records linked only through commits (tightest commit
// first, the fewest symbols any linking commit changed); ties by date with
// undated last, then by id.
MATCH (s:Symbol {id: $symbol})-[:DECIDED]->(t:DecidedTag)
RETURN 0 AS rank, 'tag' AS kind, t.hash AS id, null AS date, t.what AS what, t.because AS because, null AS status, null AS author, s.path AS source, [] AS named, [] AS via, [] AS supersededBy
UNION ALL
MATCH (f:File)-[:DECLARES]->(s:Symbol {id: $symbol}), (f)-[:DECIDED]->(t:DecidedTag)
RETURN 1 AS rank, 'file tag' AS kind, t.hash AS id, null AS date, t.what AS what, t.because AS because, null AS status, null AS author, f.path AS source, [] AS named, [] AS via, [] AS supersededBy
UNION ALL
MATCH (f:File)-[:DECLARES]->(s:Symbol {id: $symbol})
UNWIND [(s)-[:DECIDED]->(:DecidedTag)-[:NAMES]->(d:Decision) | d] + [(f)-[:DECIDED]->(:DecidedTag)-[:NAMES]->(d:Decision) | d] + [(d:Decision)-[:CITES]->(:Commit)-[:CHANGES]->(s) | d] AS d
WITH DISTINCT f, s, d
WITH s, d,
  EXISTS { MATCH (s)-[:DECIDED]->(:DecidedTag)-[:NAMES]->(d) } AS inDoc,
  EXISTS { MATCH (f)-[:DECIDED]->(:DecidedTag)-[:NAMES]->(d) } AS inHeader
OPTIONAL MATCH (d)-[:CITES]->(k:Commit)-[:CHANGES]->(s)
WITH d, inDoc, inHeader, k, COUNT { (k)-[:CHANGES]->(:Symbol) } AS symbols
ORDER BY symbols, k.date, k.sha
WITH d, inDoc, inHeader, collect(CASE WHEN k IS NULL THEN null ELSE {commit: k.short + ' ' + substring(k.date, 0, 10) + ' ' + k.subject, symbols: symbols} END) AS via
OPTIONAL MATCH (n:Decision)-[:SUPERSEDES]->(d)
WITH d, inDoc, inHeader, via, n ORDER BY n.id
WITH d, inDoc, inHeader, via, collect(n.id) AS supersededBy
RETURN CASE WHEN inDoc THEN 2 WHEN inHeader THEN 3 ELSE 4 END AS rank, 'record' AS kind, d.id AS id, d.date AS date, d.title AS what, null AS because, d.status AS status, d.author AS author, d.source AS source, [x IN [CASE WHEN inDoc THEN 'doc comment' END, CASE WHEN inHeader THEN 'file header' END] WHERE x IS NOT NULL] AS named, via, supersededBy
ORDER BY rank, CASE WHEN rank = 4 THEN head([x IN via WHERE x IS NOT NULL | x.symbols]) ELSE 0 END, date, id

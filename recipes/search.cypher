// search: the decision records whose title and statement best match a
// request, by full-text search over the index `decision_search` (whygraph
// build creates it).
// Parameter: $text, the request as plain words. whygraph search drops every
// character that is not a letter, a digit or `_` before it binds this, so a
// `-`, `:`, `*` or quote cannot add or remove a term; an MCP host must pass
// plain words itself.
// Rows: at most 10 records, best match first: id, title, date, author, source,
// and `statement`, the text of the record's first item (whygraph search fuses
// these rows with the meaning recipe's; its pure unit holds 10 as LIST_SIZE,
// and this LIMIT is that number, ADR 0003).
// No score is returned: a full-text score is not a confidence, and the order
// is the whole answer.
CALL db.index.fulltext.queryNodes('decision_search', $text) YIELD node, score
OPTIONAL MATCH (node)-[:STATES]->(i:Item)
WITH node, score, i ORDER BY i.ord
WITH node, score, collect(i)[0] AS first
RETURN node.id AS id, node.title AS title, node.date AS date, node.author AS author, node.source AS source, first.text AS statement
ORDER BY score DESC, id
LIMIT 10

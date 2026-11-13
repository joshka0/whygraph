// meaning: the decision records whose title and statement best match a
// request by meaning, over the vector index `decision_search_vector`
// (whygraph build creates it).
// Parameter: $vector, the request as a 384-float unit vector. whygraph search
// computes it with the local model; an MCP host has no local model and must
// supply a vector itself, so over MCP only the word search runs.
// Rows: at most 5 records, closest first: id, title, date, source, and
// `statement`, the text of the record's first item (whygraph search prints
// its first line).
// No score is returned: a cosine similarity is not a confidence.
CALL db.index.vector.queryNodes('decision_search_vector', 5, $vector) YIELD node, score
OPTIONAL MATCH (node)-[:STATES]->(i:Item)
WITH node, score, i ORDER BY i.ord
WITH node, score, collect(i)[0] AS first
RETURN node.id AS id, node.title AS title, node.date AS date, node.source AS source, first.text AS statement
ORDER BY score DESC, id

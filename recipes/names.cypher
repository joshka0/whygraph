// names: every file path, symbol id and decision record id in the store, with
// a symbol's file path and stored 1-based line range (null for files and
// records).
// No parameter. whygraph reads it to check a target, to suggest close names
// when a target is not found, and to find the symbols whose range overlaps the
// lines of `whygraph carry <file>:<start>-<end>`.
MATCH (f:File) RETURN 'file' AS kind, f.path AS name, null AS path, null AS line, null AS endLine
UNION ALL
MATCH (s:Symbol) RETURN 'symbol' AS kind, s.id AS name, s.path AS path, s.line AS line, s.endLine AS endLine
UNION ALL
MATCH (d:Decision) RETURN 'decision' AS kind, d.id AS name, null AS path, null AS line, null AS endLine

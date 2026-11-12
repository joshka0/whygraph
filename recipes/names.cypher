// names: every file path, symbol id and decision record id in the store.
// No parameter. whygraph reads it to check a target and to suggest close
// names when a target is not found.
MATCH (f:File) RETURN 'file' AS kind, f.path AS name
UNION ALL
MATCH (s:Symbol) RETURN 'symbol' AS kind, s.id AS name
UNION ALL
MATCH (d:Decision) RETURN 'decision' AS kind, d.id AS name

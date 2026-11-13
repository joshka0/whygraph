// users: the symbols whose code uses one symbol, directly or through others.
// Parameter: $symbol, the symbol id "<file>#<name>".
// Rows: one per user: distance 1 names it directly, n through n-1 others;
// typeOnly is true when every shortest chain is erased at run time.
// Ordered by distance, then user id. memod reads uses in TypeScript,
// JavaScript, Rust and Swift, so a symbol in another language has no rows
// here even when code uses it.
MATCH p = (u:Symbol)-[:USES*1..]->(s:Symbol {id: $symbol})
WHERE u <> s
WITH u, length(p) AS d, all(r IN relationships(p) WHERE r.typeOnly) AS erased
WITH u, min(d) AS distance, collect([d, erased]) AS paths
RETURN u.id AS user, distance, all(x IN [q IN paths WHERE q[0] = distance] WHERE x[1]) AS typeOnly
ORDER BY distance, user

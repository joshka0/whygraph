// terms: the decision records that share the most distinctive terms with a
// symbol's code, by BM25 over the counts whygraph build stored.
// Parameter: $terms, the symbol's terms. whygraph carry reads the symbol's
// source lines from the working tree, adds its name and file path, and
// tokenizes that the way build tokenizes a record's text: every run of letters,
// digits and `_`, split at `_` and at camelCase and digit boundaries, the whole
// identifier kept too, lowercased, at least three characters, not digits only.
// Duplicates do not matter; a term the common-term rule dropped matches nothing.
// Rows: at most 5 records, best first: id, title, date, source, and `shared`,
// the record's up to 5 strongest shared terms (the terms with the largest BM25
// contribution). No score is returned: the order is the whole answer, and a
// shared word is a candidate, not a link.
// BM25: k1 1.2, b 0.75, idf = ln(1 + (N - df + 0.5) / (df + 0.5)), as the
// reference; `Term.records` is df, `MENTIONS.count` is the term's frequency in
// the record, and `Decision.termCount` is the record's length (every term of
// its text, kept or not).
MATCH (d:Decision)
WITH count(d) AS n, avg(d.termCount) AS avgLen
MATCH (d:Decision)-[m:MENTIONS]->(t:Term)
WHERE t.text IN $terms
WITH n, avgLen, d, t.text AS term,
     log(1.0 + (n - t.records + 0.5) / (t.records + 0.5)) AS idf,
     (m.count * 2.2 * avgLen) / (m.count * avgLen + 1.2 * (0.25 * avgLen + 0.75 * d.termCount)) AS tf
WITH d, idf * tf AS contribution, term
ORDER BY contribution DESC, term
WITH d, sum(contribution) AS score, collect(term)[0..5] AS shared
RETURN d.id AS id, d.title AS title, d.date AS date, d.source AS source, shared, d.termCount AS termCount
ORDER BY score DESC, id
LIMIT 5

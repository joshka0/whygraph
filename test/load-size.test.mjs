/**
 * Independent audit of docs/failures.md B37-B46 and loader postconditions.
 * B37: B37 measures UTF-8 row arrays for nodes, relationships and STATES.
 * B38: B38 checks oversized first/middle/last rows, neighbors and content.
 * B39: B39 checks empty shapes and parameter-free index steps.
 * B40: B40 checks duplicates, order, content and shape order across splits.
 * B41: B41 checks final parameter names and real fetched-file contents.
 * B42: B42 checks exact/one-byte-over arrays, Unicode and JSON escaping.
 * B43: B43 checks 5000/5001 rows and row/byte counters after a size split.
 * B44: B44 drives loadPlan/buildStore/real relate with thousands of records
 * and constructed 384-float vectors, verifies all content, edges and indexes.
 * The CLI embedding pass and the parent's Hono build are not rerun here;
 * existing U5 tests own the fixture's exact per-label/type counts. A repeat
 * Hono CLI build plus its saved counts would cover the remaining B44 scope.
 * B45: B45 reaches a real WAL failure using one indexed File row, below the
 * parameter cap; checks the prior link, graph and failed-build cleanup.
 * B46: B46 reaches the real parameter cap with one File row; same checks.
 * No production hook, fake database, model, clock deadline or copied limit
 * from the implementation supplies an expected value in these checks.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, readlinkSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { harness as h } from './support.mjs';

const require = createRequire(import.meta.url);
const { loadPlan } = require(join(h.subject, 'src/load.pure.ts'));
const { buildStore } = require(join(h.subject, 'src/store.ts'));
const { readQuery } = require(join(h.subject, 'src/tools.ts'));
const budget = 1_048_576;
const bytes = rows => Buffer.byteLength(JSON.stringify(rows), 'utf8');
const record = (id, fields = {}) => ({ id, title: null, date: null, status: null, author: null, source: null, items: [], restsOn: [], supersedes: [], commits: [], ...fields });
function plan({ nodes = [], edges = [], records = [], names = [], vectors = new Map(), cites = new Map() } = {}) {
  return loadPlan({ nodes, edges }, { records, cites }, names, new Map(), vectors, { totals: new Map(), counts: new Map(), records: new Map() });
}
const files = paths => paths.map(name => ({ kind: 'file', id: `file:${name}`, name }));
const fileSteps = paths => plan({ nodes: files(paths) }).filter(s => s.cypher.includes('CREATE (:File '));
const allRows = steps => steps.flatMap(s => s.rows);
function sameRows(actual, expected, message) {
  assert.equal(actual.length, expected.length, `${message}: row count`);
  for (let i = 0; i < expected.length; i++) {
    const digest = row => createHash('sha256').update(JSON.stringify(row)).digest('hex');
    assert.equal(digest(actual[i]), digest(expected[i]), `${message}: row ${i}`);
  }
}
function bounded(steps) {
  for (const s of steps) {
    if (s.param === null) continue;
    assert.ok(s.rows.length > 0 && s.rows.length <= 5000, `row count ${s.rows.length}`);
    assert.ok(bytes(s.rows) <= budget || s.rows.length === 1, `UTF-8 array bytes ${bytes(s.rows)} with ${s.rows.length} rows`);
  }
}
function shape(s) { return s.cypher.replace(/\$p\d+/g, '$rows'); }
function dir(t) {
  const d = join(process.env.WHYGRAPH_TEST_RUN_DIR, t.name.replace(/[^a-zA-Z0-9_-]/g, '_'));
  mkdirSync(d); return d;
}
function query(store, cypher, params = {}) { return readQuery(store, cypher, params); }
function built(store, steps) { assert.deepEqual(buildStore(store, steps), { ok: true }); }

// Keep each failure-list item in its own assertion block.
test('B37 nodes, relationships and STATES split by serialized UTF-8 size', () => {
  const paths = Array.from({ length: 5 }, (_, i) => `${i}${'界'.repeat(120_000)}`);
  const records = paths.map((text, i) => record(`r${i}`, { items: [{ label: 'choice', text }] }));
  const p = plan({ nodes: files(paths), records, names: paths.map(from => ({ hash: from, id: 'r0' })) });
  for (const marker of ['CREATE (:File ', '[:NAMES]', '[:STATES]']) {
    const steps = p.filter(s => s.cypher.includes(marker));
    assert.deepEqual(steps.map(s => s.rows.length), [2, 2, 1], marker);
    bounded(steps);
    for (let i = 0; i + 1 < steps.length; i++) assert.ok(bytes([...steps[i].rows, steps[i + 1].rows[0]]) > budget, `${marker}: split must be maximal`);
  }
});

test('B38 oversized rows stand alone at every position without loss or empty statements', () => {
  const large = 'x'.repeat(budget);
  for (const paths of [[large, 'after'], ['before', large, 'after'], ['before', large]]) {
    const steps = fileSteps(paths);
    assert.deepEqual(steps.map(s => s.rows.length), paths.map(() => 1), 'oversized row and neighbors need separate statements');
    assert.deepEqual(allRows(steps), paths.map(path => ({ path })), 'preserve oversized content and neighbors');
    assert.ok(steps.every(s => s.rows.length > 0)); bounded(steps);
  }
});

test('B39 empty shapes emit no row statements or parameters and retain indexes', () => {
  const p = plan();
  assert.equal(p.length, 10, 'eight node keys and two search indexes');
  for (const s of p) { assert.match(s.cypher, /^CREATE (?:INDEX|FULLTEXT INDEX|VECTOR INDEX) /); assert.equal(s.param, null); assert.deepEqual(s.rows, []); assert.doesNotMatch(s.cypher, /\$/); }
});

test('B40 split rows reproduce values, duplicates and order while preserving shape order', () => {
  const paths = ['large-a' + 'a'.repeat(600_000), 'large-b' + 'b'.repeat(600_000), ...Array.from({ length: 10_003 }, (_, i) => `f${i % 4999}`)];
  const p = plan({ nodes: [...files(paths), { kind: 'check', id: 'check:last', name: 'last' }], names: paths.map(hash => ({ hash, id: 'R' })), records: [record('R', { items: paths.slice(0, 4).map(text => ({ label: 'choice', text })) })] });
  const groups = [p.filter(s => s.cypher.includes('CREATE (:File ')), p.filter(s => s.cypher.includes('CREATE (:Check ')), p.filter(s => s.cypher.includes('CREATE (:Decision ')), p.filter(s => s.cypher.includes('[:STATES]')), p.filter(s => s.cypher.includes('[:NAMES]'))];
  sameRows(allRows(groups[0]), paths.map(path => ({ path })), 'file order/content/duplicates');
  sameRows(allRows(groups[4]), paths.map(from => ({ from, to: 'R' })), 'edge order/content/duplicates');
  sameRows(allRows(groups[3]), paths.slice(0, 4).map((text, ord) => ({ id: 'R', ord, label: 'choice', text })), 'item order/content/duplicates');
  assert.deepEqual(p.filter(s => s.param !== null).map(shape).filter((v, i, a) => i === 0 || v !== a[i - 1]), groups.map(g => shape(g[0])), 'shape order');
  bounded(p);
});

test('B41 final plan positions name bindings and real fetch files contain exactly their rows', t => {
  const s = h.state(t, 'empty');
  const paths = ['a'.repeat(600_000), 'b'.repeat(600_000), 'short'];
  const p = plan({ nodes: [...files(paths), { kind: 'check', id: 'check:tail', name: 'tail' }], records: [record('R', { items: [{ label: 'choice', text: 'kept' }] })] });
  p.forEach((step, i) => {
    if (step.rows.length === 0) { assert.equal(step.param, null); assert.doesNotMatch(step.cypher, /\$/); }
    else { assert.equal(step.param, `p${i}`, 'binding must follow final plan position'); assert.deepEqual(step.cypher.match(/\$[a-zA-Z0-9_]+/g), [`$p${i}`], 'statement uses only its own binding'); }
  });
  const capture = join(s.dir, 'fetch.json');
  const real = h.ok(h.command('/usr/bin/which', ['relate'], s.repo)).trim();
  const wrapped = s.wrapper('relate', `import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const args = process.argv.slice(2), input = readFileSync(0, 'utf8');
const fetched = args.flatMap((a, i) => a === '--fetch-params' ? [args[i + 1]] : []).map(a => { const at = a.indexOf('='); return { param: a.slice(0, at), rows: JSON.parse(readFileSync(a.slice(at + 1), 'utf8')) }; });
writeFileSync(${JSON.stringify(capture)}, JSON.stringify({ fetched, input, telemetry: process.env.RELATE_TELEMETRY, tracking: process.env.DO_NOT_TRACK }));
const r = spawnSync(${JSON.stringify(real)}, args, { input, env: process.env });
process.stdout.write(r.stdout ?? ''); process.stderr.write(r.stderr ?? ''); process.exit(r.status ?? 1);`);
  const previous = process.env.PATH;
  try { process.env.PATH = wrapped.PATH; built(s.store, p); } finally { process.env.PATH = previous; }
  const saved = JSON.parse(readFileSync(capture, 'utf8'));
  assert.deepEqual(saved.fetched, p.filter(s => s.param !== null).map(({ param, rows }) => ({ param, rows })), 'every fetch file holds exactly its rows');
  assert.equal(saved.input, p.map(s => `${s.cypher};\n`).join(''));
  assert.deepEqual([saved.telemetry, saved.tracking], ['0', '1']);
  assert.deepEqual(query(s.store, 'MATCH (f:File) RETURN f.path AS path ORDER BY path').map(r => r.path), [...paths].sort());
  assert.deepEqual(query(s.store, 'MATCH (:Decision {id: "R"})-[:STATES]->(i:Item) RETURN i.text AS text'), [{ text: 'kept' }]);
});

test('B42 exact-byte arrays stay together and one extra byte splits including Unicode and escapes', () => {
  const specials = ['plain', 'é界😀', '"\\\n\t\u0000\u001f', '\ud800'];
  for (const special of specials) {
    const paths = [special, 'suffix'];
    const padding = budget - bytes(paths.map(path => ({ path })));
    paths[0] += 'x'.repeat(padding);
    assert.equal(bytes(paths.map(path => ({ path }))), budget, 'independently constructed exact-budget fixture');
    assert.deepEqual(fileSteps(paths).map(s => s.rows.length), [2], 'exact-budget array stays together');
    paths[1] += 'x';
    assert.equal(bytes(paths.map(path => ({ path }))), budget + 1);
    const split = fileSteps(paths); assert.deepEqual(split.map(s => s.rows.length), [1, 1], 'one extra byte splits'); bounded(split);
  }
  const unicode = ['界'.repeat(180_000), '😀'.repeat(140_000)];
  assert.ok(JSON.stringify(unicode.map(path => ({ path }))).length < budget);
  assert.ok(bytes(unicode.map(path => ({ path }))) > budget);
  assert.deepEqual(fileSteps(unicode).map(s => s.rows.length), [1, 1], 'UTF-8 bytes rather than UTF-16 code units');
});

test('B43 row limit and counters restart after size splits without an empty tail', () => {
  for (const n of [5000, 5001]) {
    const paths = Array.from({ length: n }, (_, i) => `f${i}`);
    const steps = fileSteps(paths);
    assert.deepEqual(steps.map(s => s.rows.length), n === 5000 ? [5000] : [5000, 1], `${n} small rows`); bounded(steps);
  }
  const large = 'x'.repeat(budget - bytes([{ path: '' }]) - 1);
  const paths = [large, ...Array.from({ length: 5000 }, (_, i) => `f${i}`)];
  const steps = fileSteps(paths);
  assert.deepEqual(steps.map(s => s.rows.length), [1, 5000], 'size split resets row and byte counters');
  assert.deepEqual(allRows(steps), paths.map(path => ({ path }))); bounded(steps);
});

function largeInput(n) {
  const title = 'quartz '.repeat(644), item = 'policy '.repeat(72);
  const records = Array.from({ length: n }, (_, i) => record(`record-${String(i).padStart(5, '0')}`, { title, items: [{ label: 'choice', text: item }], restsOn: i ? ['record-00000'] : [] }));
  const vector = Array(384).fill(0.0123456789012345);
  return { records, vectors: new Map(records.map(r => [r.id, vector])) };
}

test('B44 bounded real loader stores thousands of long records, items, edges and both indexes', t => {
  const d = dir(t), store = join(d, 'store');
  // First run one complete case with identical row shape, then scale it.
  built(store, plan(largeInput(1)));
  assert.deepEqual(query(store, 'MATCH (d:Decision) RETURN count(d) AS n'), [{ n: 1 }]);
  const input = largeInput(4200), p = plan(input);
  const decisionSteps = p.filter(s => s.cypher.includes('CREATE (:Decision '));
  assert.ok(bytes(allRows(decisionSteps)) > 64 * 1024 * 1024, 'original row-only statement exceeds 64 MiB');
  bounded(p); built(store, p);
  assert.deepEqual(query(store, 'MATCH (n) RETURN labels(n)[0] AS label, count(n) AS n ORDER BY label'), [{ label: 'Decision', n: 4200 }, { label: 'Item', n: 4200 }]);
  assert.deepEqual(query(store, 'MATCH ()-[r]->() RETURN type(r) AS type, count(r) AS n ORDER BY type'), [{ type: 'RESTS_ON', n: 4199 }, { type: 'STATES', n: 4200 }]);
  const stored = query(store, 'MATCH (d:Decision)-[:STATES]->(i:Item) RETURN d.id AS id, d.title AS title, d.searchText AS text, d.vector AS vector, i.ord AS ord, i.label AS label, i.text AS item ORDER BY id');
  assert.deepEqual(stored, input.records.map(r => ({ id: r.id, title: r.title, text: `${r.title}\n${r.items[0].text}`, vector: input.vectors.get(r.id), ord: 0, label: 'choice', item: r.items[0].text })), 'all records, vectors and item contents survive');
  const word = query(store, "CALL db.index.fulltext.queryNodes('decision_search', 'quartz') YIELD node, score RETURN node.id AS id LIMIT 5");
  const meaning = query(store, "CALL db.index.vector.queryNodes('decision_search_vector', 5, $vector) YIELD node, score RETURN node.id AS id", { vector: input.vectors.get('record-00000') });
  for (const rows of [word, meaning]) { assert.equal(rows.length, 5); assert.ok(rows.every(r => input.vectors.has(r.id))); }
  assert.equal(readdirSync(join(d, '.store.builds')).length, 1, 'only successful new build remains');
  writeFileSync(join(d, 'audit.json'), JSON.stringify({ records: 4200, statements: p.length, unboundedDecisionBytes: bytes(allRows(decisionSteps)), word, meaning }, null, 2));
});

for (const [id, length, diagnostic] of [['B45', 64 * 1024 * 1024 - 15, /WAL|write.ahead|wal/], ['B46', 65 * 1024 * 1024, /param/i]]) {
  test(`${id} one oversized row fails in real relate and preserves the prior link and graph`, t => {
    const d = dir(t), store = join(d, 'store');
    built(store, plan({ nodes: files(['previous']) }));
    const link = readlinkSync(store), before = query(store, 'MATCH (f:File) RETURN f.path AS path');
    const p = plan({ nodes: files(['x'.repeat(length)]) });
    const rows = p.filter(s => s.param !== null);
    assert.equal(rows.length, 1); assert.equal(rows[0].rows.length, 1); assert.equal(rows[0].rows[0].path.length, length);
    if (id === 'B45') assert.ok(bytes(rows[0].rows) < 64 * 1024 * 1024, 'WAL case must fit the parameter cap');
    else assert.ok(bytes(rows[0].rows) > 64 * 1024 * 1024, 'parameter case must exceed its cap');
    const result = buildStore(store, p);
    writeFileSync(join(d, 'failure.json'), JSON.stringify(result, null, 2));
    assert.equal(result.status, 1, 'oversized row must fail, not truncate or disappear');
    assert.match(result.message, diagnostic);
    if (id === 'B45') assert.match(result.message, /statement \d+ of \d+ failed/i);
    assert.equal(readlinkSync(store), link, 'prior store link remains');
    assert.deepEqual(query(store, 'MATCH (f:File) RETURN f.path AS path'), before, 'prior graph remains');
    assert.equal(readdirSync(join(d, '.store.builds')).length, 1, 'failed build removed');
  });
}

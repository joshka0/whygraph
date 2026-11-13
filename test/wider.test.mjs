/** Wider-list contracts independently derived from ADR 0003 and failures K1-K14. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { harness as h } from './support.mjs';

const { ok, has, failure, ids, record } = h;
h.env.NODE_OPTIONS = `${h.env.NODE_OPTIONS ?? ''} --import=${join(h.root, 'test/search-offline.mjs')}`.trim();
const read = path => readFileSync(path, 'utf8');
const pure = () => import(pathToFileURL(join(h.subject, 'src/search.pure.ts')));
const search = (s, request) => ok(s.cli(['search', request]));
const numbered = (prefix, n) => Array.from({ length: n }, (_, i) => `${prefix}${String(i).padStart(2, '0')}`);
const searchHeading = request => `Decision records that match "${request}", best match first (candidates to pick from two lists, words and meaning; a candidate, not a link: read the record and judge whether it governs your change):`;
const termHeading = subject => `Decision records that share the most distinctive terms with ${subject} (candidates to pick from one list; not links: a shared word does not mean the record governs ${subject === 'its code' ? 'this symbol' : 'these lines'}):`;
function contract(id, description, mode, body) {
  test(`${id} ${description}`, { timeout: 120_000 }, async t => body(h.state(t, mode), t));
}
function query(s, statement, parameters = {}) {
  const bind = Object.entries(parameters).flatMap(([key, value]) => ['--param', `${key}=${JSON.stringify(value)}`]);
  return JSON.parse(ok(s.run('relate', ['--database', s.store, '--read-only', '--json', ...bind, '-c', statement]))).data;
}
function mutate(s, statement) { ok(s.run('relate', ['--database', s.store, '-c', statement])); }
function custom(s, records) {
  s.commit('Public wider-list fixture');
  const file = s.decisions(records); ok(s.build([file])); return file;
}
function noScores(text) { assert.doesNotMatch(text, /\bscore\b|\bsimilarity\b|\b\d+\.\d+\b/i); }
function candidateLines(text, request) {
  const lines = text.trimEnd().split('\n');
  assert.equal(lines[0], searchHeading(request));
  assert.match(lines.at(-2), /^Searched: .*words: .*, and for the meaning of the request\.$/);
  assert.match(lines.at(-1), /^Not searched: /);
  const body = lines.slice(1, -2);
  assert.equal(body.length, 2 * ids(text).length);
  for (let i = 0; i < body.length; i += 2) {
    assert.match(body[i], /^  (?:\d{4}-\d{2}-\d{2}|undated   )  \S+  .+$/);
    assert.match(body[i + 1], /^      matched: (?:words|meaning|words and meaning); source: .+$/);
  }
  assert.doesNotMatch(text, /statement:|\bmore\b/i); noScores(text);
  return body;
}
function termSection(text, subject) {
  const heading = termHeading(subject); const at = text.indexOf(heading);
  assert.ok(at >= 0, text);
  const part = text.slice(at).split('\n\n')[0].trimEnd();
  const lines = part.split('\n'); assert.equal(lines.length, 1 + 2 * ids(part).length);
  for (let i = 1; i < lines.length; i += 2) {
    assert.match(lines[i], /^  \d{4}-\d{2}-\d{2}  \S+  .+$/);
    assert.match(lines[i + 1], /^      shared terms: \S+(?:, \S+){0,4}$/);
  }
  assert.doesNotMatch(part, /\bmore\b|\bcount\b/i); noScores(part);
  return part;
}

contract('K1 K14', 'short fixture lists retain every candidate without padding or count notes', 'fixture', s => {
  const request = 'round tax half to even'; const answer = search(s, request);
  assert.deepEqual(ids(answer), ['note-1', 'ADR-0002', 'ADR-0003', 'ADR-0001', 'note-2']);
  assert.equal(candidateLines(answer, request).length, 10);
  const part = termSection(ok(s.cli(['carry', 'src/money.ts:formatCents'])), 'its code');
  assert.deepEqual(ids(part), ['ADR-0002', 'ADR-0003']); assert.equal(part.split('\n').length, 5);
});

test('K2 K3 fusion uses RRF(60), code-unit ties and one label per overlapping id', async () => {
  const { fuse } = await pure(); const rows = xs => xs.map(id => ({ id, score: 999 }));
  const words = rows(['b', 'a', 'c', 'A']); const meaning = rows(['a', 'b', 'd', 'Z']);
  const expected = [['a', 'words and meaning'], ['b', 'words and meaning'], ['c', 'words'], ['d', 'meaning'], ['A', 'words'], ['Z', 'meaning']];
  const pairs = () => fuse(words, meaning).map(r => [r.id, r.match]);
  assert.deepEqual(pairs(), expected); assert.deepEqual(pairs(), expected);
  assert.deepEqual(fuse(rows(['a', 'Z']), rows(['b', 'A'])).map(r => r.id), ['a', 'b', 'A', 'Z']);
  assert.deepEqual(fuse(rows(['a']), rows(['Z'])).map(r => r.id), ['Z', 'a']);
  // Ranks (2,3) beat (1,5) for K=60; reciprocal rank without 60 reverses them.
  assert.deepEqual(fuse(rows(['a', 'b', 'w3', 'w4', 'w5']), rows(['m1', 'm2', 'b', 'm4', 'a'])).slice(0, 2).map(r => r.id), ['b', 'a']);
  // Rank ten in both lists still beats either disjoint rank one.
  assert.equal(fuse(rows([...numbered('w', 9), 'shared']), rows([...numbered('m', 9), 'shared']))[0].id, 'shared');
});

contract('K4 K5 K11', 'full disjoint and overlapping lists reach CLI and read-only MCP with exact tenth-row cuts', 'code', async (s, t) => {
  const wordIds = numbered('w', 11); const meaningIds = numbered('m', 11); const request = 'lexicalneedle';
  custom(s, [...wordIds.map(id => record(id, { title: request })), ...meaningIds.map(id => record(id, { title: 'currency arithmetic precision' }))]);
  // Pin vector geometry, not model rankings: the request equals w00's text,
  // hence its independently built embedding. Cosines are distinct at the cut.
  const base = query(s, "MATCH (d:Decision {id: 'w00'}) RETURN d.vector AS vector")[0].vector;
  const norm = Math.hypot(...base); const unit = base.map(x => x / norm);
  const tangent = unit.map((x, i) => (i === 0 ? 1 : 0) - unit[0] * x);
  const tangentNorm = Math.hypot(...tangent);
  const vector = cosine => unit.map((x, i) => cosine * x + Math.sqrt(1 - cosine ** 2) * tangent[i] / tangentNorm);
  const set = (id, cosine) => `MATCH (d:Decision {id: '${id}'}) SET d.vector = ${JSON.stringify(vector(cosine))}`;
  const vectors = s.write(join(s.dir, 'vectors.json'), [...wordIds.map((id, i) => ({ id, vector: vector(-0.99 + i * 0.01) })), ...meaningIds.map((id, i) => ({ id, vector: vector(0.99 - i * 0.01) }))]);
  ok(s.run('relate', ['--database', s.store, '--fetch-params', `rows=${vectors}`, '-c', 'UNWIND $rows AS r MATCH (d:Decision {id: r.id}) SET d.vector = r.vector']));
  const { recipes } = h.config(ok(s.cli(['mcp'])));
  for (const name of ['search', 'meaning', 'terms']) assert.doesNotMatch(recipes.get(name), /\bCALL\s*\{/i);
  const words = query(s, recipes.get('search'), { text: request });
  const meanings = query(s, recipes.get('meaning'), { vector: base });
  assert.deepEqual(words.map(r => r.id), wordIds.slice(0, 10));
  assert.deepEqual(meanings.map(r => r.id), meaningIds.slice(0, 10));
  const expected = meaningIds.slice(0, 10).flatMap((id, i) => [id, wordIds[i]]);
  const answer = search(s, request); assert.deepEqual(ids(answer), expected);
  assert.equal(answer.trimEnd().split('\n').length, 43); candidateLines(answer, request);
  assert.equal(new Set(ids(answer)).size, 20); assert.equal(search(s, request), answer);
  const blocks = candidateLines(answer, request);
  for (let i = 0; i < expected.length; i++) has(blocks[2 * i + 1], `matched: ${expected[i].startsWith('w') ? 'words' : 'meaning'}; source:`);
  // An eleventh word result can enter through meaning, retaining that label.
  mutate(s, set('w10', 1));
  const eleventh = search(s, request); const eleventhIds = ids(eleventh);
  assert.equal(eleventhIds.length, 20); assert.ok(eleventhIds.includes('w10')); assert.ok(!eleventhIds.includes('m09'));
  assert.match(eleventh, /  w10  lexicalneedle\n      matched: meaning; source:/);
  // Overlap removes exactly one candidate and labels it once.
  mutate(s, `${set('w10', -0.89)};\n${set('w09', 1)}`);
  const overlap = search(s, request); assert.equal(ids(overlap).length, 19);
  assert.equal(ids(overlap).filter(id => id === 'w09').length, 1);
  assert.match(overlap, /  w09  lexicalneedle\n      matched: words and meaning; source:/);
  candidateLines(overlap, request);
  const client = await h.mcp(t, s);
  assert.deepEqual((await client.rows(client.recipes.get('search'), { text: request })).map(r => r.id), wordIds.slice(0, 10));
  assert.deepEqual((await client.rows(client.recipes.get('meaning'), { vector: base })).map(r => r.id), ['w09', ...meaningIds.slice(0, 9)]);
});

contract('K6 K7 K12', 'symbol and range terms select the best ten by BM25 then id and remain stable after rebuild', 'empty', async (s, t) => {
  s.write(join(s.repo, 'a.ts'), 'export function f() { return "quartz amber"; }\n');
  s.write(join(s.repo, 'public.txt'), 'quartz amber\n');
  const records = [record('Z-rare', { title: 'quartz filler' }), ...numbered('a', 12).reverse().map(id => record(id, { title: 'amber filler' })), ...numbered('neutral', 27).map(id => record(id, { title: 'filler filler' }))];
  const file = custom(s, records); const expected = ['Z-rare', ...numbered('a', 9)];
  // 12 of 40 records share amber, below the common-term removal threshold.
  // Equal lengths/frequencies tie the amber rows; quartz has higher BM25 idf.
  assert.deepEqual(query(s, "MATCH (t:Term) WHERE t.text IN ['amber', 'quartz'] RETURN t.text AS text, t.records AS records ORDER BY text"), [{ text: 'amber', records: 12 }, { text: 'quartz', records: 1 }]);
  const carry = target => ok(s.cli(['carry', target], { env: { WHYGRAPH_TEST_NO_MODEL: '1' } }));
  const first = termSection(carry('public.txt:1-1'), 'these lines');
  const symbol = termSection(carry('a.ts:f'), 'its code');
  for (const part of [first, symbol]) {
    assert.deepEqual(ids(part), expected); assert.equal(part.split('\n').length, 21);
    assert.equal((part.match(/shared terms: amber$/gm) ?? []).length, 9);
    assert.equal((part.match(/shared terms: quartz$/gm) ?? []).length, 1);
  }
  assert.equal(termSection(carry('public.txt:1-1'), 'these lines'), first);
  assert.equal(termSection(carry('a.ts:f'), 'its code'), symbol);
  ok(s.build([file]));
  assert.equal(termSection(carry('public.txt:1-1'), 'these lines'), first);
  assert.equal(termSection(carry('a.ts:f'), 'its code'), symbol);
  const client = await h.mcp(t, s);
  const rows = await client.rows(client.recipes.get('terms'), { terms: ['quartz', 'amber'] });
  assert.deepEqual(rows.map(r => r.id), expected); assert.ok(rows.every(r => r.shared.length === 1));
});

contract('K7', 'a wide real-model search is byte-identical on repeat and after rebuild', 'code', s => {
  const records = [
    ...numbered('tax', 12).reverse().map((id, i) => record(id, { title: `tax rounding ${'regional '.repeat(i)}policy` })),
    ...numbered('other', 12).map((id, i) => record(id, { title: `currency arithmetic ${'precision '.repeat(i)}rules` })),
  ];
  const file = custom(s, records); const request = 'tax rounding'; const first = search(s, request);
  assert.ok(ids(first).length >= 10 && ids(first).length <= 20); candidateLines(first, request);
  assert.equal(search(s, request), first); ok(s.build([file])); assert.equal(search(s, request), first);
});

contract('K8 K9 K10', 'empty stores print the scoped answer and either missing index fails without a partial list', 'code', s => {
  s.commit('Code without records'); ok(s.build([]));
  const empty = search(s, 'anything');
  assert.match(empty, /^No record matches "anything"\.\nSearched: [^\n]+\nNot searched: [^\n]+\n$/);
  assert.equal(empty.trimEnd().split('\n').length, 3); assert.deepEqual(ids(empty), []);
  assert.doesNotMatch(empty, /Decision records that match/);
  const file = s.decisions([record('one', { title: 'anything' })]);
  for (const index of ['decision_search_vector', 'decision_search']) {
    ok(s.build([file])); mutate(s, `DROP INDEX ${index}`);
    const result = s.cli(['search', 'anything']);
    failure(result, 1, `relate query failed (exit 1): IndexDoesNotExist: ${index}`);
    assert.equal(result.stdout, '');
  }
});

test('K13 the shared list size, recipe caps and fused upper bound agree at ten', async () => {
  const { LIST_SIZE, fuse } = await pure(); assert.equal(LIST_SIZE, 10);
  const source = read(join(h.subject, 'src/search.pure.ts'));
  assert.match(source, /export const LIST_SIZE = 10;/);
  const executable = name => read(join(h.subject, `recipes/${name}.cypher`)).replace(/^\s*\/\/.*$/gm, '');
  for (const name of ['search', 'terms']) {
    const recipe = executable(name); assert.match(recipe, /\bLIMIT\s+10\s*$/i);
    assert.doesNotMatch(recipe, /\bCALL\s*\{/i);
  }
  assert.match(executable('meaning'), /queryNodes\('decision_search_vector',\s*10,\s*\$vector\)/);
  assert.doesNotMatch(executable('meaning'), /\bCALL\s*\{/i);
  for (const n of [0, 1, 9, 10, 11, 25]) {
    const rows = prefix => numbered(prefix, n).map(id => ({ id }));
    const fused = fuse(rows('w'), rows('m'));
    assert.equal(fused.length, Math.min(2 * n, 20)); assert.ok(fused.length <= 2 * LIST_SIZE);
  }
});

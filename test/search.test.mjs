/** Search contracts derived independently from failures Q1-Q24 and ADR 0001. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { harness as h } from './support.mjs';

const { ok, has, failure, ids, record } = h;
const preload = join(h.root, 'test/search-offline.mjs');
// This file has its own test worker. All its CLI descendants inherit the
// preload, including builds performed by state(), and cannot fetch a model.
h.env.NODE_OPTIONS = `${h.env.NODE_OPTIONS ?? ''} --import=${preload}`.trim();
// Only Q20 cold opts into the local download fixture. Missing-cache tests
// must see a real offline failure rather than the runner's fixture bytes.
delete h.env.WHYGRAPH_TEST_MODEL_FIXTURE_CACHE;
const read = path => readFileSync(path, 'utf8');
const search = (s, text, extra = {}) => s.cli(['search', text], extra);
const fixtureOrder = ['note-1', 'ADR-0002', 'ADR-0003', 'ADR-0001', 'note-2'];
function contract(id, description, mode, body) {
  test(`${id} ${description}`, { timeout: 120_000 }, async t => body(h.state(t, mode), t));
}
// Relate's one-shot -c form is also useful for writes to retained test stores.
function rows(s, statement) {
  return JSON.parse(ok(s.run('relate', ['--database', s.store, '--read-only', '--json', '-c', statement]))).data;
}
function mutateStore(s, statement) {
  ok(s.run('relate', ['--database', s.store, '-c', statement]));
}
function trace(s) {
  const path = join(s.dir, 'model.trace');
  return { path, env: { WHYGRAPH_TEST_MODEL_TRACE: path }, text: () => existsSync(path) ? read(path) : '' };
}
function noScores(text) {
  assert.doesNotMatch(text, /\bscore\s*:|\bsimilarity\s*:|\b0\.\d{3,}\b/i);
}
function scope(text) {
  const lines = text.trimEnd().split('\n');
  assert.match(lines.at(-2), /^Searched: .*words: .*, and for the meaning of the request\.$/);
  assert.match(lines.at(-1), /^Not searched: /);
}
function custom(s, records) {
  s.commit('Add test code');
  const file = s.decisions(records);
  ok(s.build([file]));
  return file;
}
async function wordRows(t, s, text) {
  const client = await h.mcp(t, s);
  return client.rows(client.recipes.get('search'), { text });
}

contract('Q1', 'fixture ranking, matching paths and candidate details', 'fixture', s => {
  const result = search(s, 'round tax half to even'); const text = ok(result);
  assert.equal(result.stderr, ''); assert.deepEqual(ids(text), fixtureOrder);
  assert.match(text, /^Decision records that match "round tax half to even", best match first \(candidates to pick from two lists, words and meaning; a candidate, not a link: /);
  assert.doesNotMatch(text, /^      statement: /m);
  assert.equal(text.trimEnd().split('\n').length, 13);
  for (const file of s.files) for (const r of JSON.parse(read(file)).records) {
    has(text, `  ${r.date}  ${r.id}  ${r.title}\n`, `      matched: ${['note-1', 'ADR-0002', 'ADR-0003'].includes(r.id) ? 'words and meaning' : 'meaning'}; source: ${r.source ?? file}\n`);
  }
  scope(text); noScores(text);
  assert.deepEqual([...text.matchAll(/^      matched: (.+); source: .+$/gm)].map(m => m[1]), ['words and meaning', 'words and meaning', 'words and meaning', 'meaning', 'meaning']);
});
contract('Q1 multiline', 'statements are omitted even when their first line matched', 'code', s => {
  custom(s, [record('multiline', { title: 'Multiline notes', source: 'public fixture', items: [{ label: 'first', text: 'firstvisible\nsecondhidden' }, { label: 'second', text: 'thirdhidden' }] })]);
  const text = ok(search(s, 'firstvisible')); has(text, 'matched: words and meaning; source: public fixture');
  const candidates = text.slice(text.indexOf('\n'), text.lastIndexOf('\nSearched:'));
  assert.doesNotMatch(candidates, /statement:|firstvisible|secondhidden|thirdhidden/);
  assert.equal(candidates.trim().split('\n').length, 2);
});
contract('Q1 repeated-title', 'a statement repeating its title is omitted without revealing further lines', 'code', s => {
  custom(s, [record('repeated-title', {
    title: 'Tax policy', source: 'public repeated-title fixture',
    items: [{ label: 'choice', text: 'Tax policy\nhiddencontinuation' }],
  })]);
  // Even when the request matches the continuation, Q1 displays no statement.
  const text = ok(search(s, 'hiddencontinuation'));
  assert.deepEqual(ids(text), ['repeated-title']);
  has(text, '  2026-01-01  repeated-title  Tax policy\n', 'matched: words and meaning', 'source: public repeated-title fixture');
  assert.equal((text.match(/Tax policy/g) ?? []).length, 1);
  assert.doesNotMatch(text, /^\s+statement:/m);
  const candidates = text.slice(text.indexOf('\n'), text.lastIndexOf('\nSearched:'));
  assert.doesNotMatch(candidates, /hiddencontinuation/);
  scope(text);
});
contract('Q2', 'a word miss still returns meaning candidates', 'fixture', async (s, t) => {
  const request = 'quasarzeppelin';
  assert.deepEqual(await wordRows(t, s, request), []);
  const text = ok(search(s, request)); assert.equal(ids(text).length, 5);
  assert.doesNotMatch(text, /No record matches/);
  assert.deepEqual([...text.matchAll(/^      matched: (.+); source: .+$/gm)].map(m => m[1]), Array(5).fill('meaning'));
});
contract('Q3', 'empty record stores return the scoped empty answer', 'code', s => {
  s.commit('Add code without decisions'); ok(s.build([]));
  const text = ok(search(s, 'anything')); assert.match(text, /^No record matches "anything"\.\nSearched:/);
  assert.equal(text.trimEnd().split('\n').length, 3); assert.doesNotMatch(text, /Decision records that match/); scope(text);
});
contract('Q4', 'punctuation preserves plain word queries and word-matched records', 'fixture', async (s, t) => {
  // Parent ruling: punctuation is not an operator in the word search; the
  // raw request still reaches the model, so meaning-only order can differ.
  const words = 'why do we round half to even';
  const calls = join(s.dir, 'relate-calls.jsonl');
  const relate = ok(s.run('/usr/bin/which', ['relate'])).trim();
  const wrapper = s.wrapper('relate', `
    import * as fs from 'node:fs';
    import { spawnSync } from 'node:child_process';
    const args = process.argv.slice(2);
    fs.appendFileSync(${JSON.stringify(calls)}, JSON.stringify(args) + '\\n');
    const result = spawnSync(${JSON.stringify(relate)}, args, { input: fs.readFileSync(0), stdio: ['pipe', 'inherit', 'inherit'] });
    if (result.error) throw result.error;
    process.exit(result.status ?? 1);
  `);
  const answers = ['why (do) we *round* half-to-even?', words].map(request => ok(search(s, request, { env: wrapper })));
  const boundWords = read(calls).trim().split('\n').flatMap(line => JSON.parse(line)).filter(arg => arg.startsWith('text='));
  assert.deepEqual(boundWords, Array(2).fill(`text=${JSON.stringify(words)}`), 'only plain words may reach the word index');
  const expected = (await wordRows(t, s, words)).map(row => row.id).sort();
  assert.ok(expected.length > 0, 'the fixture must exercise an actual word match');
  for (const answer of answers) {
    has(answer, `for the words: ${words},`);
    const blocks = answer.split(/(?=^  \d{4}-\d{2}-\d{2}  )/m);
    const matched = blocks.filter(block => /^      matched: words(?: and meaning)?; source: /m.test(block)).flatMap(ids).sort();
    assert.deepEqual(matched, expected);
  }
});
contract('Q5', 'wordless requests run neither queries nor model', 'fixture', s => {
  const model = trace(s);
  const noRelate = s.wrapper('relate', 'process.stderr.write("QUERY MUST NOT RUN"); process.exit(77);');
  for (const text of ['   ', '***']) {
    const result = search(s, text, { env: { ...noRelate, ...model.env, WHYGRAPH_TEST_NO_MODEL: '1' } });
    failure(result, 2, 'search needs a request with at least one word'); assert.equal(result.stdout, '');
    assert.doesNotMatch(result.stderr, /QUERY MUST NOT RUN|model forbidden/);
  }
  assert.equal(model.text(), '');
});
contract('Q6', 'search requires a store', 'code', s => {
  failure(search(s, 'x'), 1, `no store at ${s.store}; run whygraph build first`);
});
contract('Q7', 'search rejects missing, multiple and build-only arguments', 'code', s => {
  for (const [args, message] of [[['search'], 'request'], [['search', 'a', 'b'], 'b'], [['search', '--decisions', 'f'], '--decisions']]) {
    const result = s.cli(args); failure(result, 2, message, 'whygraph search'); assert.equal(result.stdout, '');
  }
});
contract('Q8 Q24', 'words index title and every statement, excluding record metadata', 'code', async (s, t) => {
  const records = [
    record('content', { title: 'titleneedle', items: [{ label: 'labelneedle', text: 'firstneedle' }, { label: 'second', text: 'lastneedle' }] }),
    record('idneedle', { date: '2026-08-19', title: 'ordinary prose', status: 'statusneedle', source: 'sourceneedle', topics: ['topicneedle'] }),
  ];
  custom(s, records); const client = await h.mcp(t, s);
  for (const text of ['titleneedle', 'firstneedle', 'lastneedle']) {
    assert.deepEqual((await client.rows(client.recipes.get('search'), { text })).map(r => r.id), ['content']);
    has(ok(search(s, text)), 'matched: words and meaning');
  }
  for (const text of ['idneedle', '2026', '08', '19', 'statusneedle', 'sourceneedle', 'topicneedle', 'labelneedle']) {
    assert.deepEqual(await client.rows(client.recipes.get('search'), { text }), [], text);
    const answer = ok(search(s, text));
    assert.ok(ids(answer).includes('idneedle')); assert.doesNotMatch(answer, /matched: words/);
  }
});
contract('Q9', 'an empty record embeds empty text and never word-matches', 'code', async (s, t) => {
  custom(s, [record('empty')]);
  const stored = rows(s, 'MATCH (d:Decision) RETURN d.searchText AS text, d.vector AS vector');
  assert.equal(stored[0].text, ''); assert.equal(stored[0].vector.length, 384);
  assert.ok(stored[0].vector.every(Number.isFinite));
  assert.deepEqual(await wordRows(t, s, 'empty'), []);
  const text = ok(search(s, 'empty')); assert.deepEqual(ids(text), ['empty']);
  has(text, '(no title)', 'matched: meaning; source: ');
  assert.doesNotMatch(text, /^\s+statement:/m);
});
for (const index of ['decision_search', 'decision_search_vector']) {
  contract('Q10', `missing ${index} fails without a partial answer`, 'fixture', s => {
    mutateStore(s, `DROP INDEX ${index}`);
    const result = search(s, 'money cents');
    failure(result, 1, `relate query failed (exit 1): IndexDoesNotExist: ${index}`); assert.equal(result.stdout, '');
  });
}
contract('Q11', 'an empty offline cache fails build and search with model and cache names', 'fixture', s => {
  const home = join(s.dir, 'empty-home'); s.write(join(home, '.keep'), '');
  const model = trace(s); const env = { HOME: home, ...model.env };
  for (const action of [() => search(s, 'money', { env }), () => s.build(s.files, { env })]) {
    const result = action(); failure(result, 1, 'Xenova/bge-small-en-v1.5', join(home, '.cache/whygraph'));
    assert.equal(result.stdout, '');
  }
  has(model.text(), 'model loaded', 'network blocked');
  assert.deepEqual(ids(ok(search(s, 'round tax half to even'))), fixtureOrder, 'failed model build must leave the prior store usable');
});
contract('Q12 Q14', 'unconstrained why and carry hint at search without running it', 'code', s => {
  custom(s, []); const model = trace(s);
  for (const command of ['why', 'carry']) {
    const text = ok(s.cli([command, 'src/code.ts:f'], { env: { ...model.env, WHYGRAPH_TEST_NO_MODEL: '1' } }));
    const line = text.split('\n').find(line => line.startsWith('No decision is recorded for it.'));
    assert.ok(line, text); has(line, 'whygraph search "<the change in your own words>"');
    assert.doesNotMatch(text, /Decision records that match/);
    if (command === 'why') assert.equal(text.trimEnd().split('\n').at(-1), line);
    else has(text, 'One step away:', 'Searched:', 'Not searched:');
  }
  assert.equal(model.text(), '');
});
contract('Q13', 'an unlinked decided tag is a decision and needs no search hint', 'fixture', s => {
  const text = ok(s.cli(['why', 'src/rounding.ts:roundHalfEven']));
  has(text, 'ties round to even', 'No decided: tag names a decision record.');
  assert.doesNotMatch(text, /No decision is recorded|whygraph search/);
});
contract('Q15 Q16', 'printed word and vector recipes work over read-only MCP and require vector', 'fixture', async (s, t) => {
  const client = await h.mcp(t, s);
  for (const name of ['search', 'meaning']) {
    assert.equal(typeof client.recipes.get(name), 'string'); assert.doesNotMatch(client.recipes.get(name), /\bCALL\s*\{/i);
  }
  const words = await client.rows(client.recipes.get('search'), { text: 'money cents' });
  assert.equal(words[0].id, 'ADR-0001');
  assert.ok(words.length > 0 && words.length <= 10);
  const vector = rows(s, "MATCH (d:Decision {id: 'ADR-0001'}) RETURN d.vector AS vector")[0].vector;
  const meaning = await client.rows(client.recipes.get('meaning'), { vector });
  assert.equal(meaning.length, 5); assert.equal(meaning[0].id, 'ADR-0001');
  for (const row of [...words, ...meaning]) assert.deepEqual(Object.keys(row).sort(), ['date', 'id', 'source', 'statement', 'title']);
  const missing = await client.request('tools/call', { name: 'read_cypher', arguments: { statement: client.recipes.get('meaning'), parameters: {} } });
  assert.equal(missing.isError, true); const text = JSON.stringify(missing);
  assert.match(text, /vector/); assert.match(text, /missing|parameter|not found|not provided/i);
});
contract('Q17', 'search is byte-identical twice and after rebuilding', 'fixture', s => {
  const first = ok(search(s, 'round tax half to even')); assert.equal(ok(search(s, 'round tax half to even')), first);
  ok(s.build()); assert.equal(ok(search(s, 'round tax half to even')), first);
});
test('Q17 fusion ranks by reciprocal rank, breaks ties by id and labels every path', async () => {
  const { fuse } = await import(pathToFileURL(join(h.subject, 'src/search.pure.ts')));
  // Reversed ranks tie a and b exactly; c is present in words alone, d in
  // meaning alone. Deliberate irrelevant raw scores must not affect fusion.
  const words = [{ id: 'b', score: -999 }, { id: 'a', score: 999 }, { id: 'c' }, { id: 'e' }, { id: 'f' }];
  const meaning = [{ id: 'a' }, { id: 'b' }, { id: 'd' }, { id: 'g' }, { id: 'h' }];
  const result = fuse(words, meaning);
  assert.deepEqual(result.map(r => [r.id, r.match]), [['a', 'words and meaning'], ['b', 'words and meaning'], ['c', 'words'], ['d', 'meaning'], ['e', 'words'], ['g', 'meaning'], ['f', 'words'], ['h', 'meaning']]);
  // An overlap at rank five beats either disjoint rank one under RRF(60).
  assert.equal(fuse(['x', 'p', 'q', 'r', 'shared'].map(id => ({ id })), ['y', 's', 't', 'u', 'shared'].map(id => ({ id })))[0].id, 'shared');
  // RRF(60) puts ranks (2,3) before (1,5); using 1/rank reverses them.
  assert.deepEqual(fuse(['a', 'b', 'w3', 'w4', 'w5'].map(id => ({ id })), ['m1', 'm2', 'b', 'm4', 'a'].map(id => ({ id }))).slice(0, 2).map(r => r.id), ['b', 'a']);
});
contract('Q18', 'whitespace is collapsed for display and the whole raw request is embedded', 'fixture', s => {
  const request = ' round\n\t tax   *half-to-even? ';
  const calls = join(s.dir, 'relate-calls.jsonl');
  const relate = ok(s.run('/usr/bin/which', ['relate'])).trim();
  const wrapper = s.wrapper('relate', `
    import * as fs from 'node:fs';
    import { spawnSync } from 'node:child_process';
    const args = process.argv.slice(2);
    fs.appendFileSync(${JSON.stringify(calls)}, JSON.stringify(args) + '\\n');
    const result = spawnSync(${JSON.stringify(relate)}, args, { input: fs.readFileSync(0), stdio: ['pipe', 'inherit', 'inherit'] });
    if (result.error) throw result.error;
    process.exit(result.status ?? 1);
  `);
  const text = ok(search(s, request, { env: wrapper }));
  assert.match(text.split('\n')[0], /^Decision records that match "round tax \*half-to-even\?",/);
  has(text, 'for the words: round tax half to even,'); assert.equal(ids(text).length, 5); scope(text);
  const bound = read(calls).trim().split('\n').flatMap(line => JSON.parse(line)).find(arg => arg.startsWith('vector='));
  assert.ok(bound, 'meaning query must bind a vector');
  const script = `
    import { pipeline, env, LogLevel } from '@huggingface/transformers';
    env.cacheDir = process.argv[2]; env.logLevel = LogLevel.ERROR;
    const model = await pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5', { dtype: 'q8', progress_callback: () => {} });
    const result = await model([process.argv[1]], { pooling: 'mean', normalize: true });
    console.log(JSON.stringify(result.tolist()[0]));
  `;
  const expected = JSON.parse(ok(s.run(process.execPath, ['--input-type=module', '-e', script, request, join(h.env.HOME, '.cache/whygraph')], h.root)));
  assert.deepEqual(JSON.parse(bound.slice('vector='.length)), expected);
});
contract('Q19', 'search rejects an outside repo both explicitly and by cwd', 'outside', s => {
  const env = { GIT_CEILING_DIRECTORIES: s.dir };
  failure(s.cli(['search', 'x', '--repo', s.repo], { env }), 2, `${s.repo} is not in a git repo`);
  failure(search(s, 'x', { env }), 2, 'the current folder is not in a git repo');
});
contract('Q20 warm', 'cached builds and search use no network and add no model chatter', 'fixture', s => {
  const model = trace(s);
  const first = s.build(s.files, { env: model.env }); const second = s.build(s.files, { env: model.env });
  assert.equal(ok(first), ok(second)); assert.equal(first.stderr, ''); assert.equal(second.stderr, '');
  const result = search(s, 'money cents', { env: model.env }); ok(result); assert.equal(result.stderr, '');
  assert.equal((model.text().match(/model loaded/g) ?? []).length, 3);
  assert.doesNotMatch(model.text(), /network blocked/);
});
contract('Q20 cold', 'empty-cache fixture download is silent and happens only once', 'fixture-unbuilt', s => {
  const home = join(s.dir, 'cold-home'); s.write(join(home, '.keep'), '');
  const model = trace(s);
  const env = { HOME: home, ...model.env, WHYGRAPH_TEST_MODEL_FIXTURE_CACHE: join(h.env.HOME, '.cache/whygraph') };
  const files = [s.write(join(s.dir, 'adrs.json'), ok(s.cli(['decisions', 'adr', 'docs/adr']))), join(s.repo, 'decisions/notes.json')];
  const cold = s.build(files, { env }); ok(cold); assert.equal(cold.stderr, '');
  const downloads = () => model.text().split('\n').filter(line => line.startsWith('fixture download'));
  const firstDownloads = downloads();
  assert.equal(firstDownloads.filter(line => line.includes('model_quantized.onnx')).length, 1);
  const bytes = firstDownloads.reduce((sum, line) => sum + Number(line.split(' ').at(-1)), 0);
  assert.ok(bytes > 30_000_000 && bytes < 40_000_000, `downloaded ${bytes} fixture bytes`);
  assert.ok(existsSync(join(home, '.cache/whygraph/Xenova/bge-small-en-v1.5/onnx/model_quantized.onnx')));
  const warm = s.build(files, { env }); assert.equal(ok(warm), cold.stdout); assert.equal(warm.stderr, cold.stderr);
  assert.deepEqual(ids(ok(search(s, 'round tax half to even', { env }))), fixtureOrder);
  assert.deepEqual(downloads(), firstDownloads, 'warm build and search must not fetch again');
  assert.doesNotMatch(model.text(), /network blocked/);
});
contract('Q21', 'build with no records needs no model and creates both indexes', 'code', s => {
  s.commit('Code without records'); const model = trace(s);
  const home = join(s.dir, 'uncached-home'); s.write(join(home, '.keep'), '');
  ok(s.build([], { env: { HOME: home, ...model.env, WHYGRAPH_TEST_NO_MODEL: '1' } }));
  assert.equal(model.text(), ''); assert.equal(existsSync(join(home, '.cache/whygraph')), false);
  const indexes = rows(s, 'SHOW INDEXES');
  for (const name of ['decision_search', 'decision_search_vector']) assert.ok(indexes.some(r => r.name === name), JSON.stringify(indexes));
});
contract('Q22', 'each stored record has its public text and a finite 384-float vector in an online index', 'fixture', s => {
  const expected = new Map(s.files.flatMap(file => JSON.parse(read(file)).records).map(r => [r.id, [r.title ?? '', ...(r.items ?? []).map(i => i.text)].filter(x => x.trim()).join('\n')]));
  const stored = rows(s, 'MATCH (d:Decision) RETURN d.id AS id, d.searchText AS text, d.vector AS vector, size(d.vector) AS dimensions ORDER BY id');
  assert.equal(stored.length, 5);
  for (const r of stored) { assert.equal(r.text, expected.get(r.id)); assert.equal(r.dimensions, 384); assert.ok(r.vector.every(Number.isFinite)); }
  const indexes = rows(s, 'SHOW VECTOR INDEXES'); const index = indexes.find(r => r.name === 'decision_search_vector');
  assert.ok(index, JSON.stringify(indexes)); assert.equal(index.state, 'ONLINE');
  assert.deepEqual(index.labelsOrTypes, ['Decision']); assert.deepEqual(index.properties, ['vector']);
});
contract('Q23', 'answers expose order and matching paths without numeric scores', 'fixture', s => {
  for (const request of ['money cents', 'quasarzeppelin', 'round tax half to even']) {
    const text = ok(search(s, request)); noScores(text);
    assert.equal((text.match(/^      matched: (words|meaning|words and meaning); source: .+$/gm) ?? []).length, ids(text).length);
  }
});

contract('Search real-data', 'a public fixture record survives paraphrase and leads on its own words', 'fixture', async (s, t) => {
  const fixture = JSON.parse(read(join(h.root, 'test/fixtures/search-paraphrase.json')));
  const records = s.files.flatMap(file => JSON.parse(read(file)).records);
  const target = records.find(r => r.id === fixture.id); assert.ok(target);
  const text = [target.title, ...target.items.map(i => i.text)].join(' ');
  const words = text.toLowerCase().match(/[\p{L}\p{N}_]+/gu);
  for (const word of fixture.paraphrase.toLowerCase().match(/[\p{L}\p{N}_]+/gu)) assert.ok(!words.includes(word), `overlapping word: ${word}`);
  assert.deepEqual(await wordRows(t, s, fixture.paraphrase), [], 'the paraphrase must exercise meaning alone');
  const meaning = ok(search(s, fixture.paraphrase)); assert.ok(ids(meaning).includes(fixture.id));
  const block = meaning.split(/(?=^  \d{4}-\d{2}-\d{2}  )/m).find(part => part.startsWith(`  ${target.date}  ${fixture.id}  `));
  has(block, 'matched: meaning');
  assert.equal(ids(ok(search(s, fixture.words)))[0], fixture.id);
});

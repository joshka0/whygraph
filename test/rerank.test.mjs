/** Optional-reranker contracts independently derived from ADR 0004 and N1-N26. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer, request as httpRequest } from 'node:http';
import { randomUUID } from 'node:crypto';
import { appendFileSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { harness as h } from './support.mjs';

const { ok, has, failure, ids, record } = h;
// Never inherit an operator's model, endpoint or credential into a test.
for (const name of ['WHYGRAPH_RERANK', 'WHYGRAPH_RERANK_URL', 'OPENROUTER_API_KEY']) delete h.env[name];
const model = 'contract/rerank-model';
const request = 'round tax half to even';
const at = 'src/tax.ts:11-20';
const picks = [5, 2, 0, 4, 1];
const response = indexes => ({ results: indexes.map(index => ({ index, relevance_score: 0.987654321 })) });
const termHeading = 'Decision records that share the most distinctive terms with these lines (candidates to pick from one list; not links: a shared word does not mean the record governs these lines):';
const read = path => readFileSync(path, 'utf8');
function contract(group, description, mode, body) {
  test(`${group} ${description}`, { timeout: 120_000 }, async t => body(h.state(t, mode), t));
}
function noSecrets(s, result, key) {
  if (!key) return;
  assert.ok(!result.stdout.includes(key), 'key leaked into stdout');
  assert.ok(!result.stderr.includes(key), 'key leaked into stderr');
  function scan(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) scan(path);
      else if (entry.isFile()) assert.ok(!readFileSync(path).includes(Buffer.from(key)), 'key leaked into a command-written file');
    }
  }
  scan(s.dir);
}
async function cli(s, args, env = {}) {
  const childEnv = { ...h.env, ...env };
  childEnv.NODE_OPTIONS = `${(childEnv.NODE_OPTIONS ?? '').replaceAll(`--import=${join(h.root, 'test/search-offline.mjs')}`, '')} --import=${join(h.root, 'test/rerank-offline.mjs')}`.trim();
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(h.subject, 'src/main.ts'), ...args], { cwd: s.repo, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), 90_000);
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', (code, signal) => { clearTimeout(timer); resolve({ code, signal, stdout, stderr }); });
  });
  // Detect leaks before diagnostics can themselves print or persist the key.
  noSecrets(s, result, env.OPENROUTER_API_KEY);
  appendFileSync(join(s.dir, 'commands.jsonl'), JSON.stringify({ args, ...result }) + '\n');
  return result;
}
async function fake(t, { key, status = 200, body, hang = false, disconnect = false } = {}) {
  const requests = [];
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString();
    let json;
    try { json = JSON.parse(raw); } catch { /* invalid JSON is rejected below */ }
    requests.push({ method: req.method, path: req.url, headers: req.headers, body: json, received: performance.now() });
    if (!json || !['model', 'query', 'documents'].every(name => Object.hasOwn(json, name))) {
      res.writeHead(400).end('missing required JSON fields'); return;
    }
    if (key && req.headers.authorization !== `Bearer ${key}`) { res.writeHead(401).end('missing bearer credential'); return; }
    if (hang) return;
    if (disconnect) { req.socket.destroy(); return; }
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(typeof body === 'string' ? body : JSON.stringify(body ?? response(picks)));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const host = `127.0.0.1:${server.address().port}`;
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  return { server, requests, host, url: `http://${host}/private/rerank?test=1`, env: { WHYGRAPH_RERANK: model, WHYGRAPH_RERANK_URL: `http://${host}/private/rerank?test=1`, ...(key ? { OPENROUTER_API_KEY: key } : {}) } };
}
function noScores(text) {
  assert.doesNotMatch(text, /\bscore\b|\bsimilarity\b|statement:|authorization|Bearer /i);
  assert.doesNotMatch(text.split('\n').filter(line => !line.startsWith('Sent to ')).join('\n'), /\b\d+\.\d+\b/);
}
function wideOnly(result) {
  const text = ok(result); assert.equal(result.stderr, '');
  assert.doesNotMatch(text, /Reranked|Sent to|Rerank failed/); return text;
}
function blocks(text) {
  return new Map([...text.matchAll(/^(  (?:\d{4}-\d{2}-\d{2}|undated   )  (\S+)  [^\n]*\n      matched: [^\n]*)/gm)].map(m => [m[2], m[1]]));
}
function ranked(result, f, baseline, order = picks, code) {
  const text = ok(result); assert.equal(result.stderr, '');
  const candidates = ids(baseline); const lines = text.trimEnd().split('\n');
  assert.equal(lines[0], `Reranked ${candidates.length} candidates with ${model}, best first (the five it kept; a candidate, not a link: read the record and judge whether it governs your change):`);
  assert.equal(lines.length, 12); assert.equal(ids(text).length, 5);
  assert.deepEqual(ids(text), order.map(index => candidates[index]));
  assert.equal(lines.at(-1), code
    ? `Sent to ${f.host}: the request, the lines of ${code}, and the title and first statement of each of the ${candidates.length} candidates.`
    : `Sent to ${f.host}: the request and the title and first statement of each of the ${candidates.length} candidates.`);
  assert.ok(!lines.at(-1).includes('/private/')); noScores(text); return text;
}
function fallback(result, baseline, kind) {
  const text = ok(result); assert.equal(result.stderr, '');
  assert.equal(text, `${baseline}Rerank failed (${kind}); showing every candidate.\n`);
  assert.doesNotMatch(text, /Reranked|Sent to/); noScores(text);
}
function six(s) {
  const extra = s.decisions([record('extra', { title: 'round tax half to even' })], 'extra.json');
  const files = [...s.files, extra]; ok(s.build(files)); return files;
}
function query(s, statement) {
  return JSON.parse(ok(s.run('relate', ['--database', s.store, '--read-only', '--json', '-c', statement]))).data;
}
function rich(s) {
  const records = Array.from({ length: 14 }, (_, i) => record(`d${String(i).padStart(2, '0')}`, { title: i < 12 ? 'lexicalneedle' : 'quartz', source: `source-${i}` }));
  records[0].title += ' sapphire quartz';
  records[1].title = ''; records[1].items = [{ label: 'decided', text: 'lexicalneedle' }];
  records[3].title = 'lexicalneedle already included'; records[3].items = [{ label: 'decided', text: 'already included' }];
  records[4].title = `lexicalneedle ${'x'.repeat(650)}`;
  records[5].items = [{ label: 'decided', text: 'first statement\nDO_NOT_SEND_SECOND_LINE' }, { label: 'decided', text: 'DO_NOT_SEND_SECOND_ITEM' }];
  records[12].items = [{ label: 'decided', text: 'term first statement\nDO_NOT_SEND_TERM_SECOND_LINE' }];
  s.write(join(s.repo, 'src/range.txt'), `outsideonly\nquartz${' x'.repeat(1700)}\nlast selected line\nsapphire\nif x = 1;\nabsentquasar\n`);
  s.commit('Public reranker fixture'); const file = s.decisions(records); ok(s.build([file]));
  // Force meaning's top ten to d00..d09. The word list is still real BM25.
  const base = query(s, "MATCH (d:Decision {id: 'd02'}) RETURN d.vector AS vector")[0].vector;
  const norm = Math.hypot(...base); const unit = base.map(x => x / norm);
  const tangent = unit.map((x, i) => (i === 0 ? 1 : 0) - unit[0] * x); const size = Math.hypot(...tangent);
  const rows = records.map((r, i) => {
    const cosine = 0.99 - i * 0.1;
    return { id: r.id, vector: unit.map((x, j) => cosine * x + Math.sqrt(1 - cosine ** 2) * tangent[j] / size) };
  });
  const vectors = s.write(join(s.dir, 'vectors.json'), rows);
  ok(s.run('relate', ['--database', s.store, '--fetch-params', `rows=${vectors}`, '-c', 'UNWIND $rows AS r MATCH (d:Decision {id: r.id}) SET d.vector = r.vector']));
  return { records, file };
}

contract('N1 N2', 'unset and empty model leave the wide list and never call a listening endpoint', 'fixture', async (s, t) => {
  six(s); const f = await fake(t); const args = ['search', request, '--at', at];
  const baseline = wideOnly(await cli(s, args)); assert.equal(ids(baseline).length, 6);
  for (const setting of [undefined, '']) {
    const env = { WHYGRAPH_RERANK_URL: f.url }; if (setting !== undefined) env.WHYGRAPH_RERANK = setting;
    assert.equal(wideOnly(await cli(s, args, env)), baseline);
    assert.equal(f.requests.length, 0);
  }
});

contract('N3 N4', 'five candidates skip the call and six make exactly one POST', 'fixture', async (s, t) => {
  const f = await fake(t); const args = ['search', request, '--at', at];
  const five = wideOnly(await cli(s, args)); assert.equal(ids(five).length, 5);
  assert.equal(wideOnly(await cli(s, args, f.env)), five); assert.equal(f.requests.length, 0);
  six(s); const baseline = wideOnly(await cli(s, args)); assert.equal(ids(baseline).length, 6);
  ranked(await cli(s, args, f.env), f, baseline, picks, at);
  assert.equal(f.requests.length, 1); assert.equal(f.requests[0].method, 'POST');
});

contract('N5 N6 N7 N8 N9 N25 N26', 'strict fake sees JSON and optional bearer; five map in response order with stable safe output', 'fixture', async (s, t) => {
  const files = six(s); const baseline = wideOnly(await cli(s, ['search', request]));
  const key = randomUUID(); const f = await fake(t, { key, body: response([...picks, 3]) });
  // Prove the fixture rejects the malformed requests a permissive fake hides.
  function probe(body, authorization) {
    return new Promise((resolve, reject) => {
      const req = httpRequest(f.url, { method: 'POST', headers: { 'content-type': 'application/json', ...(authorization ? { authorization } : {}) } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
      req.on('error', reject); req.end(JSON.stringify(body));
    });
  }
  for (const missing of ['model', 'query', 'documents']) {
    const body = { model, query: request, documents: ['one'] }; delete body[missing];
    assert.equal(await probe(body, `Bearer ${key}`), 400);
  }
  assert.equal(await probe({ model, query: request, documents: ['one'] }), 401);
  assert.equal(await probe({ model, query: request, documents: ['one'] }, 'Bearer wrong'), 401);
  f.requests.length = 0;
  const first = ranked(await cli(s, ['search', request], f.env), f, baseline);
  const sourceBlocks = blocks(baseline);
  assert.equal(first.split('\n').slice(1, 11).join('\n'), picks.map(i => sourceBlocks.get(ids(baseline)[i])).join('\n'));
  assert.equal(ranked(await cli(s, ['search', request], f.env), f, baseline), first);
  ok(s.build(files)); assert.equal(ranked(await cli(s, ['search', request], f.env), f, baseline), first);
  assert.equal(f.requests.length, 3);
  for (const r of f.requests) {
    assert.equal(r.method, 'POST'); assert.equal(r.path, '/private/rerank?test=1');
    assert.match(r.headers['content-type'], /^application\/json(?:;|$)/);
    assert.ok(r.headers.authorization === `Bearer ${key}`, 'bearer header does not match the test key');
    assert.deepEqual(Object.keys(r.body).sort(), ['documents', 'model', 'query', 'top_n']);
    assert.equal(r.body.model, model); assert.equal(r.body.query, request); assert.equal(r.body.top_n, 5);
    assert.equal(r.body.documents.length, 6);
    assert.deepEqual(r.body, f.requests[0].body);
  }
  for (const value of [undefined, '']) {
    const noKey = await fake(t); const env = { ...noKey.env }; if (value !== undefined) env.OPENROUTER_API_KEY = value;
    ranked(await cli(s, ['search', request], env), noKey, baseline);
    assert.equal(noKey.requests.length, 1); assert.ok(!Object.hasOwn(noKey.requests[0].headers, 'authorization'));
  }
  noSecrets(s, { stdout: first, stderr: '' }, key);
});

contract('N6 N9 N10 N11 N12', 'range sends bounded code and exact documents in fused then term order with deduplicated labels', 'code', async (s, t) => {
  const { records } = rich(s); const text = 'lexicalneedle'; const range = 'src/range.txt:2-3';
  const plain = wideOnly(await cli(s, ['search', text])); const args = ['search', text, '--at', range];
  const baseline = wideOnly(await cli(s, args));
  const carry = ok(s.cli(['carry', range], { env: { WHYGRAPH_TEST_NO_MODEL: '1' } }));
  const termIds = ids(carry.slice(carry.indexOf(termHeading)).split('\n\n')[0]);
  const expectedIds = [...ids(plain), ...termIds.filter(id => !ids(plain).includes(id))];
  assert.deepEqual(ids(baseline), expectedIds); assert.ok(expectedIds.includes('d12') && expectedIds.includes('d13'));
  assert.equal(new Set(expectedIds).size, expectedIds.length);
  const selected = ['d00', 'd12', 'd01', 'd03', 'd04'].map(id => expectedIds.indexOf(id)); assert.ok(selected.every(i => i >= 0));
  const f = await fake(t, { body: response(selected) });
  const answer = ranked(await cli(s, args, f.env), f, baseline, selected, range); assert.equal(f.requests.length, 1);
  const r = f.requests[0]; assert.equal(r.body.model, model); assert.equal(r.body.top_n, 5);
  const lines = read(join(s.repo, 'src/range.txt')).split('\n');
  const code = lines.slice(1, 3).join('\n').slice(0, 3000);
  assert.equal(code.length, 3000); assert.equal(r.body.query, `${text}\n\nCode it would change:\n${code}`);
  const byId = new Map(records.map(record => [record.id, record]));
  const expectedDocuments = expectedIds.map(id => {
    const record = byId.get(id); const title = record.title ?? ''; const statement = (record.items?.[0]?.text ?? '').split(/\r\n|\r|\n/)[0];
    return (title ? title + (statement && !title.includes(statement) ? ` | ${statement}` : '') : statement).slice(0, 600);
  });
  assert.deepEqual(r.body.documents, expectedDocuments);
  assert.equal(r.body.documents[expectedIds.indexOf('d01')], 'lexicalneedle');
  assert.equal(r.body.documents[expectedIds.indexOf('d02')], 'lexicalneedle');
  assert.equal(r.body.documents[expectedIds.indexOf('d03')], 'lexicalneedle already included');
  assert.equal(r.body.documents[expectedIds.indexOf('d04')].length, 600);
  assert.equal(r.body.documents[expectedIds.indexOf('d12')], 'quartz | term first statement');
  assert.ok(!JSON.stringify(r.body).includes('DO_NOT_SEND'));
  assert.match(answer, /  d00  [^\n]*\n      matched: words and meaning and terms; source: source-0/);
  assert.match(answer, /  d12  quartz\n      matched: terms; source: source-12/);
});

contract('N13', 'wide range output inserts only term-only records and all three empty-term notes before unchanged scope', 'code', async s => {
  rich(s); const text = 'lexicalneedle'; const plain = wideOnly(await cli(s, ['search', text]));
  const plainLines = plain.trimEnd().split('\n'); const prefix = plainLines.slice(0, -2); const scope = plainLines.slice(-2);
  const range = 'src/range.txt:2-3'; const carry = ok(s.cli(['carry', range]));
  const term = carry.slice(carry.indexOf(termHeading)).split('\n\n')[0].trimEnd().split('\n');
  const remaining = [];
  for (let i = 1; i < term.length; i += 2) if (!ids(plain).includes(ids(term[i])[0])) remaining.push(term[i], term[i + 1]);
  assert.ok(remaining.length >= 4, 'exercise term-only candidates');
  assert.equal(wideOnly(await cli(s, ['search', text, '--at', range])), [...prefix, termHeading, ...remaining, ...scope].join('\n') + '\n');
  for (const [line, note] of [
    [4, 'No decision record other than those above shares a distinctive term with these lines.'],
    [5, 'No term section: these lines hold no term of three or more characters.'],
    [6, 'No decision record shares a distinctive term with these lines.'],
  ]) assert.equal(wideOnly(await cli(s, ['search', text, '--at', `src/range.txt:${line}-${line}`])), [...prefix, note, ...scope].join('\n') + '\n');
});

contract('N14 N15 N16 N18', 'invalid ranges and missing request fail before model load or any query', 'fixture', async s => {
  const trace = join(s.dir, 'model-trace.txt'); s.write(trace, '');
  const noQuery = s.wrapper('relate', 'process.stderr.write("QUERY MUST NOT RUN"); process.exit(77);');
  const env = { ...noQuery, WHYGRAPH_TEST_NO_MODEL: '1', WHYGRAPH_TEST_MODEL_TRACE: trace };
  const cases = [
    ['src/tax.ts:taxRate', 2, '--at takes <file>:<start>-<end>, not a symbol'],
    ['src/tax.ts:20-10', 2, '"src/tax.ts:20-10" starts at line 20 and ends at 10; a range\'s start must not be after its end'],
    ['src/tax.ts:0-3', 2, '"src/tax.ts:0-3" starts at line 0; a line range is 1-based'],
    ['src/tax.ts:abc-def', 2, '"src/tax.ts:abc-def" is not <file>:<symbol> or <file>:<start>-<end>, such as src/main.ts:run or src/main.ts:10-20'],
    ['../x.ts:1-5', 2, `"../x.ts" is outside the repo ${s.repo}`],
    ['src/missing.ts:1-5', 1, 'cannot read src/missing.ts:'],
    ['src/tax.ts:1-200', 2, 'src/tax.ts has 21 lines, so 1-200 is past its end'],
  ];
  for (const [arg, code, message] of cases) {
    const result = await cli(s, ['search', 'x', '--at', arg], env);
    failure(result, code, message); assert.equal(result.stdout, ''); assert.doesNotMatch(result.stderr, /QUERY MUST NOT RUN|model forbidden/);
    if (arg !== 'src/tax.ts:taxRate') assert.equal(s.cli(['carry', arg]).stderr, result.stderr, 'range errors agree with carry');
  }
  const missing = await cli(s, ['search', '--at', 'src/tax.ts:1-5'], env);
  failure(missing, 2, 'search needs a request'); assert.equal(missing.stdout, ''); assert.equal(read(trace), '');
});

contract('N17', 'at option errors name the misuse and include usage', 'code', async s => {
  const trace = join(s.dir, 'model-trace.txt'); s.write(trace, '');
  const noQuery = s.wrapper('relate', 'process.stderr.write("QUERY MUST NOT RUN"); process.exit(77);');
  const env = { ...noQuery, WHYGRAPH_TEST_NO_MODEL: '1', WHYGRAPH_TEST_MODEL_TRACE: trace };
  const cases = [
    [['search', 'x', '--at'], '--at needs a value'],
    [['search', 'x', '--at', at, '--at', at], '--at given twice'],
    ...[['why', 'src/tax.ts:taxRate'], ['impact', 'ADR-0001'], ['carry', at], ['build'], ['decisions', 'adr', 'docs/adr'], ['mcp']].map(args => [[...args, '--at', at], '--at is a search option']),
  ];
  for (const [args, message] of cases) {
    const result = await cli(s, args, env); failure(result, 2, message, 'whygraph search');
    assert.equal(result.stdout, ''); assert.doesNotMatch(result.stderr, /QUERY MUST NOT RUN|model forbidden/);
  }
  assert.equal(read(trace), '');
});

contract('N19 N26', 'every non-200 response falls back exactly and never prints an echoed key', 'fixture', async (s, t) => {
  six(s); const args = ['search', request, '--at', at]; const baseline = wideOnly(await cli(s, args));
  for (const status of [500, 429, 201]) {
    const key = randomUUID(); const f = await fake(t, { key, status, body: { ...response(picks), error: key } });
    fallback(await cli(s, args, f.env), baseline, `HTTP ${status}`); assert.equal(f.requests.length, 1);
  }
});

contract('N20 N21 N22 N26', 'malformed indexes and short responses preserve every candidate with the exact failure kind', 'fixture', async (s, t) => {
  six(s); const args = ['search', request]; const baseline = wideOnly(await cli(s, args));
  const malformed = ['not JSON', null, [], {}, { results: {} }, { results: [null] }, { results: [7] }, { results: ['one'] }, { results: [{}] }, { results: [{ index: '0' }] }, { results: [{ index: 0.5 }] }, response([0, 1, 2, 3, 0])];
  const cases = [...malformed.map(body => [body, 'unexpected response']), ...[-1, 6].map(index => [response([0, 1, 2, 3, index]), 'index out of range']), ...[[], [0], [0, 1, 2, 3]].map(indexes => [response(indexes), 'too few results'])];
  for (const [body, kind] of cases) {
    const key = randomUUID(); const f = await fake(t, { key, body: body === null ? 'null' : body });
    fallback(await cli(s, args, f.env), baseline, kind); assert.equal(f.requests.length, 1);
  }
});

contract('N23 N26', 'a non-answering fake times out at ten seconds, without retry or a failing exit', 'fixture', async (s, t) => {
  six(s); const args = ['search', request]; const baseline = wideOnly(await cli(s, args));
  const key = randomUUID(); const f = await fake(t, { key, hang: true });
  const result = await cli(s, args, f.env); const finished = performance.now();
  fallback(result, baseline, 'timeout'); assert.equal(f.requests.length, 1);
  const seconds = (finished - f.requests[0].received) / 1000;
  assert.ok(seconds >= 9 && seconds <= 14, `timeout took ${seconds.toFixed(3)} seconds after receiving the request`);
});

contract('N24 N26', 'a closed local port and a disconnected fake give network error without retry', 'fixture', async (s, t) => {
  six(s); const args = ['search', request]; const baseline = wideOnly(await cli(s, args));
  const closed = await fake(t); await new Promise(resolve => closed.server.close(resolve));
  const key = randomUUID(); const trace = join(s.dir, 'fetch-trace.txt'); s.write(trace, '');
  fallback(await cli(s, args, { ...closed.env, OPENROUTER_API_KEY: key, WHYGRAPH_TEST_RERANK_TRACE: trace }), baseline, 'network error');
  assert.equal(read(trace), 'local request\n'); assert.equal(closed.requests.length, 0);
  const disconnected = await fake(t, { key, disconnect: true });
  fallback(await cli(s, args, disconnected.env), baseline, 'network error'); assert.equal(disconnected.requests.length, 1);
});

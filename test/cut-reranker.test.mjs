/** Removal audit (X1-X8, ADR 0009; expectations from 42ab13f).
 * X1: fixture and ripgrep searches compare stdout/stderr bytes for three queries each.
 *     X1 ripgrep is an explicit named skip if WHYGRAPH_EVAL_WORK/_ripgrep/store
 *     (default /var/tmp/whygraph-eval) is absent. It is never rebuilt or written.
 * X2: value, missing value, repeated --at, and carry/why/impact reject with exact
 *     status/error/usage; file/store guards, model trace and tool traps prove no IO.
 * X3: removed modules/imports absent; embedding dependency and lock bytes preserved.
 * X4: help/README/bin/recipes and every current skill omit removed instructions.
 *     ADR 0010 pins earlier batches' instructions in history, not the working tree.
 * X5: why/impact/symbol carry/range carry match baseline bytes; recipe bytes,
 *     logical stored nodes/edges (including vectors) and indexes match baseline.
 * X6: all former settings, an eight-candidate answer and a reachable HTTP listener;
 *     no request or notice, including empty and whitespace setting values.
 * X7: runner and mutation entry points lose deleted paths; remaining anchors and
 *     Q27 test/mutation remain usable (Q27 also runs in the normal suite).
 * X8: the removal diff changes no eval or skill byte; current saved scorer output,
 *     batch 3-6 task/blind bytes and the old score prefix remain pinned.
 * Not claimed: agent trials S4/S6 (parent owns them); arbitrary external stores;
 *     physical database bytes (readers may change engine metadata). X5 compares
 *     all logical properties and index definitions instead.
 * Goldens: node test/cut-reranker-goldens.mjs (see that file for bounded command).
 * Plants: node test/cut-reranker-plants.mjs; summary retains first red assertions.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer, request } from 'node:http';
import { once } from 'node:events';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { harness as h } from './support.mjs';

const read = path => readFileSync(path, 'utf8');
const gold = JSON.parse(read(join(h.root, 'test/fixtures/cut-reranker-42ab13f.json')));
const base = (path, ref = gold.base) => h.ok(h.command('git', ['show', `${ref}:${path}`], h.root));
const preload = join(h.root, 'test/search-offline.mjs');
h.env.NODE_OPTIONS = `${h.env.NODE_OPTIONS ?? ''} --import=${preload}`.trim();
for (const key of ['WHYGRAPH_RERANK', 'WHYGRAPH_RERANK_URL', 'OPENROUTER_API_KEY']) delete h.env[key];
const usage = `whygraph: why the code is the way it is, as a relate graph

  whygraph build [--repo <path>] [--store <path>] [--decisions <file>]...
  whygraph decisions adr <folder>
  whygraph why <file>:<symbol> [--repo <path>] [--store <path>]
  whygraph impact <decision id> [--repo <path>] [--store <path>]
  whygraph carry <file>:<symbol>|<file>:<start>-<end> [--repo <path>] [--store <path>]
  whygraph search "<text>" [--repo <path>] [--store <path>]
  whygraph mcp [--repo <path>] [--store <path>]

Exit: 0 answer, 1 failure, 2 usage, 3 target not in the graph.\n`;
function same(actual, expected, label) {
  assert.equal(actual.code, expected.code, `${label}: exit status`);
  assert.equal(actual.stdout, expected.stdout, `${label}: stdout bytes`);
  assert.equal(actual.stderr, expected.stderr, `${label}: stderr bytes`);
}
function fixture(s) {
  s.write(join(s.repo, 'adrs.json'), h.ok(s.cli(['decisions', 'adr', 'docs/adr'])));
  h.ok(s.cli(['build', '--decisions', 'adrs.json', '--decisions', 'decisions/notes.json']));
}
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]);
}
function contract(id, description, mode, body) {
  test(`${id} ${description}`, async t => body(h.state(t, mode), t));
}
function sorted(rows) { return rows.map(row => JSON.stringify(row)).sort(); }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => [key, canonical(v)]));
  return value;
}
function schema(rows) {
  // Engine ids, generated names and read counters are not schema definitions.
  return rows.map(({ entityType, indexProvider, labelsOrTypes, owningConstraint, properties, state, type }) => ({ entityType, indexProvider, labelsOrTypes, owningConstraint, properties, state, type }));
}

contract('X1', 'ordinary search preserves baseline bytes on both stores', 'fixture-unbuilt', async (s, t) => {
  fixture(s);
  for (const expected of gold.fixture.filter(e => e.args[0] === 'search')) same(s.cli(expected.args), expected, `fixture ${expected.args[1]}`);
  const store = resolve(process.env.WHYGRAPH_EVAL_WORK ?? '/var/tmp/whygraph-eval', '_ripgrep/store');
  await t.test('X1 ripgrep read-only search goldens', { skip: !existsSync(store) && `X1 store absent: ${store}; this box-specific comparison was not exercised` }, () => {
    for (const expected of gold.ripgrep) same(s.cli([...expected.args, '--store', store]), expected, `ripgrep ${expected.args[1]}`);
  });
});

contract('X2', '--at always fails before file, model or store access', 'empty', s => {
  const access = join(s.dir, 'access.trace'), model = join(s.dir, 'model.trace');
  const target = join(s.repo, 'src/tax.ts'); s.write(target, 'must not be read\n');
  const existing = join(s.dir, 'existing-store'); s.write(join(existing, 'sentinel'), 'must not be read\n');
  const absent = join(s.dir, 'missing-store');
  const trap = `import { appendFileSync } from 'node:fs'; appendFileSync(${JSON.stringify(access)}, 'tool invoked\\n'); process.exit(97);`;
  const git = s.wrapper('git', trap), relate = s.wrapper('relate', trap);
  const env = { PATH: `${relate.PATH.split(':')[0]}:${git.PATH}`,
    WHYGRAPH_TEST_NO_MODEL: '1', WHYGRAPH_TEST_MODEL_TRACE: model,
    WHYGRAPH_TEST_ACCESS_TRACE: access, WHYGRAPH_TEST_FORBIDDEN_PATHS: JSON.stringify([target, existing, absent]),
    NODE_OPTIONS: `${h.env.NODE_OPTIONS} --import=${join(h.root, 'test/cut-reranker-guard.mjs')}`,
  };
  const cases = [
    ['search', 'tax', '--at', 'src/tax.ts:11-20'], ['search', 'tax', '--at'],
    ['search', 'tax', '--at', 'src/tax.ts:11-20', '--at', 'src/tax.ts:1-2'],
    ['carry', 'src/tax.ts:taxRate', '--at', 'src/tax.ts:11-20'],
    ['why', 'src/tax.ts:taxRate', '--at', 'src/tax.ts:11-20'],
    ['impact', 'ADR-0002', '--at', 'src/tax.ts:11-20'],
    ['search', 'tax', '--at', 'not-a-range'], ['search', 'tax', '--at', 'src/tax.ts:20-11'],
  ];
  for (const store of [existing, absent]) for (const args of cases) {
    const result = s.cli([args[0], '--store', store, ...args.slice(1)], { env });
    assert.equal(existsSync(access) ? read(access) : '', '', `${args.join(' ')}: no file/store/tool access`);
    assert.equal(existsSync(model) ? read(model) : '', '', `${args.join(' ')}: no model load`);
    same(result, { code: 2, stdout: '', stderr: `whygraph: unknown option --at\n\n${usage}` }, args.join(' '));
  }
});

contract('X3', 'removed modules have no imports or exclusive dependencies', 'empty', () => {
  const removed = ['rerank.ts', 'rerank.pure.ts'];
  for (const file of removed) assert.ok(!existsSync(join(h.subject, 'src', file)), `removed module ${file}`);
  for (const file of files(join(h.subject, 'src'))) {
    const imports = [...read(file).matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)["']([^"']+)["']/g)].map(m => m[1]);
    for (const specifier of imports) assert.doesNotMatch(specifier, /(?:^|\/)rerank(?:\.pure)?(?:\.[a-z]+)?$/, `${file}: removed import ${specifier}`);
  }
  const before = JSON.parse(base('package.json')), after = JSON.parse(read(join(h.subject, 'package.json')));
  assert.deepEqual(after.dependencies, before.dependencies, 'the old reranker had no exclusive package dependency');
  assert.ok(after.dependencies['@huggingface/transformers'], 'local embeddings retain transformers');
  assert.equal(read(join(h.subject, 'pnpm-lock.yaml')), base('pnpm-lock.yaml'), 'no lockfile churn');
});

contract('X4', 'current instructions omit removed options and settings', 'empty', async (s, t) => {
  same(s.cli(['help']), { code: 0, stdout: usage, stderr: '' }, 'help');
  for (const file of [join(h.subject, 'README.md'), ...files(join(h.subject, 'bin')), ...files(join(h.subject, 'recipes'))]) {
    assert.doesNotMatch(read(file), /--at\b|WHYGRAPH_RERANK(?:_URL)?\b|rerank(?:\.pure)?\.ts/, file);
  }
  await t.test('X4 skills omit the reranker, its settings and --at', () => {
    for (const file of files(join(h.subject, 'skills'))) {
      assert.doesNotMatch(read(file), /\brerank(?:er)?\b|WHYGRAPH_RERANK(?:_URL)?\b|--at\b/i, `current skill instructions: ${file}`);
    }
  });
});

contract('X5', 'other answers, recipes, schema and logical store data match main', 'fixture-unbuilt', s => {
  fixture(s);
  for (const expected of gold.fixture.filter(e => e.args[0] !== 'search')) same(s.cli(expected.args), expected, expected.args.join(' '));
  const paths = h.ok(h.command('git', ['ls-tree', '-r', '--name-only', gold.base, 'recipes'], h.root)).trim().split('\n');
  assert.deepEqual(files(join(h.subject, 'recipes')).map(p => p.slice(h.subject.length + 1)).sort(), paths);
  for (const path of paths) assert.equal(read(join(h.subject, path)), base(path), path);
  for (const expected of gold.graph) {
    const result = s.run('relate', ['--no-agent-mode', '--max-rows', '0', '--database', s.store, '--read-only', '--json', '-c', expected.statement]);
    const actual = JSON.parse(h.ok(result)).data;
    const rows = expected.statement === 'SHOW INDEXES' ? schema : value => value;
    assert.deepEqual(sorted(rows(actual).map(canonical)), sorted(rows(expected.rows).map(canonical)), expected.statement);
  }
});

contract('X6', 'former settings send no request and print no notice', 'fixture-unbuilt', async (s, t) => {
  const args = gold.ranking.args;
  s.write(join(s.repo, 'ranking.json'), { records: gold.rankingRecords });
  h.ok(s.cli(['build', '--decisions', 'ranking.json']));
  same(s.cli(args), gold.ranking, 'ranking fixture baseline');
  assert.ok(h.ids(gold.ranking.stdout).length >= 6, 'exercise the former hosted-call threshold');
  const requests = [];
  const server = createServer((req, res) => {
    const chunks = []; req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => { requests.push({ url: req.url, body: Buffer.concat(chunks).toString() }); res.end('{"results":[]}'); });
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const endpoint = `http://127.0.0.1:${server.address().port}`;
  // Positive control: the listener accepts requests; no polling deadline is used.
  await new Promise((resolve, reject) => {
    const req = request(endpoint + '/control', { method: 'POST' }, res => { res.resume(); res.on('end', resolve); });
    req.on('error', reject); req.end('control');
  });
  assert.equal(requests.length, 1, 'listener positive control'); requests.length = 0;
  for (const value of ['removed-model', '0', ' true ', '', '   ']) {
    const result = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [join(h.subject, 'src/main.ts'), ...args], { cwd: s.repo,
        env: { ...h.env, WHYGRAPH_RERANK: value, WHYGRAPH_RERANK_URL: endpoint + '/rerank', OPENROUTER_API_KEY: 'public-test-key',
          WHYGRAPH_TEST_RANK_ENDPOINT: endpoint,
          NODE_OPTIONS: `${h.env.NODE_OPTIONS} --import=${join(h.root, 'test/cut-reranker-loopback.mjs')}` },
      });
      let stdout = '', stderr = '';
      child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
      child.on('error', reject); child.on('close', code => resolve({ code, stdout, stderr }));
    });
    s.write(join(s.dir, `settings-${JSON.stringify(value).replace(/\W/g, '_')}.json`), { value, result, requests });
    assert.equal(requests.length, 0, 'no ranking endpoint request');
    same(result, gold.ranking, `former settings ${JSON.stringify(value)}`);
  }
});

contract('X7', 'suite and mutation entry points retain only live targets', 'empty', s => {
  const deleted = ['rerank.test.mjs', 'rerank-plants.mjs', 'rerank-offline.mjs'];
  const entries = ['test/run.mjs', ...files(join(h.subject, 'test')).filter(p => p.endsWith('-plants.mjs') || p.endsWith('/plants.mjs')).map(p => p.slice(h.subject.length + 1)).filter(p => !p.endsWith('/cut-reranker-plants.mjs'))];
  for (const path of entries) {
    const text = read(join(h.subject, path));
    for (const removed of deleted) assert.ok(!text.includes(removed), `${path}: deleted target ${removed}`);
    h.ok(s.run(process.execPath, ['--check', join(h.subject, path)]));
    for (const match of text.matchAll(/["'](?:test\/)?([\w-]+\.test\.mjs)["']/g)) assert.ok(existsSync(join(h.subject, 'test', match[1])), `${path}: missing ${match[1]}`);
  }
  const authorTest = read(join(h.subject, 'test/search-author.test.mjs'));
  assert.match(authorTest, /contract\('Q27'/);
  const legacy = base('test/rerank.test.mjs');
  const oldAuthorTest = legacy.slice(legacy.lastIndexOf("contract('Q27 N27'"));
  const keptAssertions = oldAuthorTest.slice(oldAuthorTest.indexOf('  assert.equal(ids(baseline)'), oldAuthorTest.indexOf('  const f = await fake(t);'));
  assert.ok(keptAssertions.length > 0 && authorTest.includes(keptAssertions), 'all existing Q27 search-author assertions are retained');
  assert.match(read(join(h.subject, 'test/run.mjs')), /test\/search-author\.test\.mjs/);
  const plants = read(join(h.subject, 'test/order-author-plants.mjs'));
  const authorPlant = plants.match(/name: 'search-adds-author-line'[\s\S]*?before: '([^\n]+)',\n\s*after:/);
  assert.ok(authorPlant, 'Q27 author mutation retained');
  const anchor = JSON.parse('"' + authorPlant[1].replaceAll('"', '\\"') + '"');
  assert.equal(read(join(h.subject, 'src/search.pure.ts')).split(anchor).length - 1, 1, 'Q27 mutation has a live unique anchor');
});

contract('X8', 'removal preserves eval history and frozen batch 3-6 inputs', 'empty', s => {
  const removal = 'c243073707ac95df6d93b74ccf4417541dd7647e';
  const changed = h.ok(s.run('git', ['diff', '--name-only', '--no-renames', gold.base, removal, '--', 'eval', 'skills'], h.subject));
  assert.equal(changed, '', 'removal commit changes no eval or skill bytes');
  same(s.run(process.execPath, [join(h.subject, 'eval/score.mjs')], h.subject), { code: 0, stdout: read(join(h.subject, 'eval/score.txt')), stderr: '' }, 'saved scoring history');
  assert.ok(read(join(h.subject, 'eval/score.txt')).startsWith(base('eval/score.txt')), 'frozen saved-score prefix');
  const registry = JSON.parse(base('eval/registry.json'));
  const batches = [3, 4, 5, 6];
  const tasks = h.ok(s.run('git', ['ls-tree', '-r', '--name-only', gold.base, 'eval/tasks'], h.subject)).trim().split('\n');
  for (const path of tasks) {
    const original = base(path);
    if (batches.includes(JSON.parse(original).batch)) assert.equal(read(join(h.subject, path)), original, `frozen task ${path}`);
  }
  const blind = new Set(batches.flatMap(number => {
    const batch = registry.batches[number];
    return Object.keys(batch.sha256).map(name => join('eval', registry.repos[batch.repo].blind, name));
  }));
  for (const path of blind) assert.equal(read(join(h.subject, path)), base(path), `frozen blind input ${path}`);
});

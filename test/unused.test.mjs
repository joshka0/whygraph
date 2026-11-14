/** Contracts U1-U9 from failures.md and ADR 0007; product internals stay opaque. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readlinkSync } from 'node:fs';
import { join } from 'node:path';
import { harness as h } from './support.mjs';

const { ok, has, failure, ids, record } = h;
const nodes = { Check: 1, Commit: 9, DecidedTag: 5, Decision: 5, File: 6, Item: 8, Symbol: 8, Term: 45, Topic: 6 };
const edges = { CHANGES: 27, CITES: 6, DECIDED: 5, DECLARES: 8, MENTIONS: 57, NAMES: 3, OWNS: 14, RESTS_ON: 4, STATES: 8, SUPERSEDES: 1, USES: 5, VERIFIED: 1 };
function contract(id, description, mode, body) {
  test(`${id} ${description}`, { timeout: 120_000 }, async t => body(h.state(t, mode), t));
}
function query(s, statement, store = s.store) {
  return JSON.parse(ok(s.run('relate', ['--database', store, '--read-only', '--json', '-c', statement]))).data;
}
function counted(rows) { return Object.fromEntries(rows.map(r => [r.name, r.n])); }
function absent(s, label, edge) {
  assert.equal(query(s, `MATCH (n:${label}) RETURN count(n) AS n`)[0].n, 0, `${label} nodes`);
  assert.equal(query(s, `MATCH ()-[r:${edge}]->() RETURN count(r) AS n`)[0].n, 0, `${edge} edges`);
}
function captureLoad(s) {
  const log = join(s.dir, 'load.jsonl');
  const real = ok(h.command('/usr/bin/which', ['relate'], s.repo)).trim();
  const env = s.wrapper('relate', `import { appendFileSync, readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const args = process.argv.slice(2); const input = readFileSync(0, 'utf8');
const files = args.filter(a => !a.startsWith('-') && /\\.(?:cypher|cql)$/.test(a) && existsSync(a)).map(a => readFileSync(a, 'utf8'));
appendFileSync(${JSON.stringify(log)}, JSON.stringify({ args, input, files }) + '\\n');
const r = spawnSync(${JSON.stringify(real)}, args, { input, env: process.env });
process.stdout.write(r.stdout ?? ''); process.stderr.write(r.stderr ?? ''); process.exit(r.status ?? 1);`);
  return { env, text: () => readFileSync(log, 'utf8') };
}
function noIndex(s, label) {
  const indexes = query(s, 'SHOW INDEXES');
  assert.ok(indexes.every(r => !(r.labelsOrTypes ?? []).includes(label)), `${label} index: ${JSON.stringify(indexes)}`);
}
function linked(text) {
  return text.split('One step away')[0].split('Decision records that share the most distinctive terms')[0];
}
function blocks(text) {
  return new Map([...text.matchAll(/^  (?:\d{4}-\d{2}-\d{2}|undated   )  (\S+)  [^\n]*(?:\n      [^\n]*)*/gm)].map(m => [m[1], m[0]]));
}

contract('U1', 'all record topics values reject atomically without record-only topics or ABOUT', 'fixture', s => {
  const before = ok(s.cli(['why', 'src/tax.ts:taxRate'])); const link = readlinkSync(s.store);
  const file = s.decisions([null, [], ['fx-money'], ['record-only']].map((topics, i) => record(`bad-${i}`, { topics })));
  const result = s.build([file]); failure(result, 1);
  assert.equal(result.stdout, '');
  assert.deepEqual(result.stderr.trimEnd().split('\n'), [
    'whygraph: decisions files rejected; the store is unchanged:',
    ...[0, 1, 2, 3].map(i => `${file}: record ${i} (bad-${i}): unknown field "topics"`),
  ]);
  assert.equal(readlinkSync(s.store), link); assert.equal(ok(s.cli(['why', 'src/tax.ts:taxRate'])), before);
  assert.equal(query(s, 'MATCH ()-[r:ABOUT]->() RETURN count(r) AS n')[0].n, 0);
  assert.deepEqual(query(s, "MATCH (t:Topic {slug: 'record-only'}) RETURN t.slug AS slug"), []);
});
contract('U1', 'ADR preamble topics never become decisions-file fields', 'code', s => {
  s.write(join(s.repo, 'docs/adr/0001-choice.md'), '# ADR 0001: Choice\n\nDate: 2026-01-01. Topic: [[code-topic]], [[record-only]].\n\n## Choice\n\nKeep it simple.\n');
  s.commit('Add ADR and code');
  const records = JSON.parse(ok(s.cli(['decisions', 'adr', 'docs/adr']))).records;
  assert.equal(records.length, 1); assert.equal(Object.hasOwn(records[0], 'topics'), false);
  const built = s.build([s.decisions(records)]); ok(built); assert.equal(built.stderr, '');
  assert.deepEqual(query(s, 'MATCH (t:Topic) RETURN t.slug AS slug'), []);
  assert.equal(query(s, 'MATCH ()-[r:ABOUT]->() RETURN count(r) AS n')[0].n, 0);
});
contract('U2', 'messages never supply citations or warnings while explicit lists deduplicate', 'code', s => {
  const messages = [
    'Two trailers\n\nDecision: known\nDecision: missing',
    'Key and value cases\n\ndecision: known\nDECISION: KNOWN\nDecision: ADR 0001',
    'Earlier paragraph\n\nDecision: known\n\nFinal prose.',
    'Plain prose with Decision: known and Decision: missing',
  ];
  const commits = messages.map((message, i) => {
    s.write(join(s.repo, 'src/code.ts'), `export function f() { return ${i}; }\n`); return s.commit(message);
  });
  const file = s.decisions([record('known')]);
  let built = s.build([file]); ok(built); assert.equal(built.stderr, '');
  assert.equal(query(s, 'MATCH ()-[r:CITES]->() RETURN count(r) AS n')[0].n, 0);
  assert.deepEqual(ids(ok(s.cli(['why', 'src/code.ts:f']))), []);
  s.write(file, { records: [record('known', { commits: commits.flatMap(c => [c, c.slice(0, 7)]) })] });
  built = s.build([file]); ok(built); assert.equal(built.stderr, '');
  assert.deepEqual(query(s, 'MATCH (:Decision)-[r:CITES]->(k:Commit) RETURN k.sha AS sha, count(r) AS n ORDER BY sha'), commits.sort().map(sha => ({ sha, n: 1 })));
});
contract('U3', 'premise tags do not load memos or suppress empty scope in either carry form', 'empty', s => {
  s.write(join(s.repo, 'src/a.ts'), '/** premise: 1234+1 */\nexport function lonely() { return 1; }\n');
  s.commit('Add an inert source annotation');
  const graph = JSON.parse(ok(s.run('memod', ['graph', '--history'])));
  assert.ok(graph.nodes.some(n => n.kind === 'memo'), 'fixture must contain a memod memo');
  assert.ok(graph.edges.some(e => e.kind === 'premise'), 'fixture must contain a memod premise edge');
  const load = captureLoad(s); const built = s.build([], { env: load.env }); ok(built); assert.equal(built.stderr, '');
  absent(s, 'Memo', 'PREMISE'); noIndex(s, 'Memo');
  assert.doesNotMatch(load.text(), /\bMemo\b|\bPREMISE\b/, 'no Memo load statement or index');
  const { recipes } = h.config(ok(s.cli(['mcp'])));
  const rows = query(s, recipes.get('carry').replaceAll('$symbol', JSON.stringify('src/a.ts#lonely')));
  assert.equal(rows.length, 1); assert.equal(Object.hasOwn(rows[0], 'premises'), false);
  for (const target of ['src/a.ts:lonely', 'src/a.ts:2-2']) {
    const text = ok(s.cli(['carry', target]));
    assert.doesNotMatch(text, /\bpremise\b|\bmemo\b|1234\+1/i);
    has(text, 'Nothing found in what was searched; that does not mean nothing constrains this edit.');
  }
  assert.deepEqual(JSON.parse(ok(s.run('memod', ['graph', '--history']))), graph);
});
contract('U4', 'imports lose only Package and IMPORTS while preserving memod code and ownership rows', 'empty', s => {
  s.write(join(s.repo, 'src/a.ts'), '/** module: [[app]] */\nimport { basename } from "node:path";\nimport { helper } from "./b.ts";\n/** owns: [[entry]] */\nexport function entry() { return basename(helper()); }\n');
  s.write(join(s.repo, 'src/b.ts'), '/** module: [[helper-file]] */\n/** owns: [[helper-topic]] */\nexport function helper() { return "a/b"; }\n');
  s.commit('Import a package and local code');
  const graph = JSON.parse(ok(s.run('memod', ['graph', '--history'])));
  assert.ok(graph.nodes.some(n => n.kind === 'package'), 'fixture must contain a memod package');
  assert.ok(graph.edges.some(e => e.kind === 'imports'), 'fixture must contain memod imports');
  const load = captureLoad(s); const built = s.build([], { env: load.env }); ok(built); assert.equal(built.stderr, '');
  absent(s, 'Package', 'IMPORTS'); noIndex(s, 'Package');
  assert.doesNotMatch(load.text(), /\bPackage\b|\bIMPORTS\b/, 'no Package load statement or index');
  const byId = new Map(graph.nodes.map(n => [n.id, n]));
  assert.deepEqual(query(s, 'MATCH (f:File) RETURN f.path AS path ORDER BY path').map(r => r.path), graph.nodes.filter(n => n.kind === 'file').map(n => n.name).sort());
  assert.deepEqual(query(s, 'MATCH (s:Symbol) RETURN s.id AS id ORDER BY id').map(r => r.id), graph.nodes.filter(n => n.kind === 'symbol').map(n => n.id.slice('symbol:'.length)).sort());
  const pairRows = kind => graph.edges.filter(e => e.kind === kind).map(e => ({ from: byId.get(e.from).name, to: byId.get(e.to).name })).sort((a,b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  assert.deepEqual(query(s, 'MATCH (a:Symbol)-[:USES]->(b:Symbol) RETURN a.id AS from, b.id AS to ORDER BY from, to'), pairRows('uses'));
  assert.deepEqual(query(s, 'MATCH (t:Topic) RETURN t.slug AS slug ORDER BY slug').map(r => r.slug), graph.nodes.filter(n => n.kind === 'topic').map(n => n.name).sort());
  const expectedOwns = graph.edges.filter(e => e.kind === 'owns').flatMap(e => [
    { from: byId.get(e.from).name, to: byId.get(e.to).name },
    ...(e.symbols ?? []).map(name => ({ from: name, to: byId.get(e.to).name })),
  ]).sort((a,b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  assert.deepEqual(query(s, 'MATCH (a)-[:OWNS]->(t:Topic) RETURN coalesce(a.name, a.path) AS from, t.slug AS to ORDER BY from, to'), expectedOwns);
  assert.deepEqual(JSON.parse(ok(s.run('memod', ['graph', '--history']))), graph);
});
contract('U5', 'fixture summaries and direct graph counts exactly match the reduced graph', 'fixture', s => {
  const built = s.build(); const text = ok(built); assert.equal(built.stderr, '');
  const counts = [...text.matchAll(/^  (\w+)\s+(\d+)$/gm)].map(m => [m[1], Number(m[2])]);
  assert.deepEqual(counts, [...Object.entries(nodes), ...Object.entries(edges)]);
  has(text, '93 nodes', '139 relationships', '0 warnings');
  assert.deepEqual(counted(query(s, 'MATCH (n) RETURN labels(n)[0] AS name, count(n) AS n ORDER BY name')), nodes);
  assert.deepEqual(counted(query(s, 'MATCH ()-[r]->() RETURN type(r) AS name, count(r) AS n ORDER BY name')), edges);
  assert.doesNotMatch(text, /Package|Memo|IMPORTS|ABOUT|PREMISE/);
});
contract('U6', 'two fixtures and rebuilds repeat every command including both carry forms', 'fixture-unbuilt', s => {
  const other = join(s.dir, 'second-fixture'); ok(s.run('/bin/bash', [join(h.root, 'scripts/fixture.sh'), other], s.dir));
  const commands = [['why', 'src/money.ts:formatCents'], ['impact', 'ADR-0002'], ['carry', 'src/money.ts:formatCents'], ['carry', 'src/tax.ts:11-20'], ['search', 'round tax half to even'], ['decisions', 'adr', 'docs/adr'], ['mcp']];
  const snapshots = [];
  for (const cwd of [s.repo, other]) {
    const cli = args => s.cli(args, { cwd });
    assert.equal(ok(s.run('git', ['rev-parse', '--short=7', 'HEAD'], cwd)).trim(), '0ede283');
    const adrs = s.write(join(cwd, 'adrs.json'), ok(cli(['decisions', 'adr', 'docs/adr'])));
    const store = join(ok(s.run('git', ['rev-parse', '--absolute-git-dir'], cwd)).trim(), 'whygraph/store');
    for (let i = 0; i < 2; i++) {
      const built = cli(['build', '--decisions', adrs, '--decisions', 'decisions/notes.json']); ok(built);
      const warnings = built.stderr.trim() ? built.stderr.trim().split('\n') : [];
      assert.deepEqual(warnings, [...warnings].sort()); assert.deepEqual(warnings, []);
      const answers = commands.map(args => ok(cli(args)));
      assert.deepEqual(commands.map(args => ok(cli(args))), answers);
      // MCP's store is necessarily absolute and differs between the two repos.
      answers[6] = answers[6].replaceAll(store, '<store>');
      assert.doesNotMatch(answers[6], /\bpremises\b|\bPREMISE\b/);
      snapshots.push({ history: ok(s.run('git', ['log', '--format=%H'], cwd)), build: built.stdout.replaceAll(cwd, '<repo>'), warnings, answers });
    }
  }
  for (const snapshot of snapshots.slice(1)) assert.deepEqual(snapshot, snapshots[0]);
});
contract('U7', 'symbol terms exclude doc comments while explicit comment ranges include them', 'empty', s => {
  s.write(join(s.repo, 'src/a.ts'), '/** tungsten */\nexport function f() {\n  return 1;\n}\n');
  s.commit('A comment-only term');
  ok(s.build([s.decisions([record('comment', { title: 'tungsten' })])]));
  const text = ok(s.cli(['carry', 'src/a.ts:f']));
  assert.deepEqual(ids(text), []); has(text, 'No decision record shares a distinctive term with its code.');
  const range = ok(s.cli(['carry', 'src/a.ts:1-1']));
  assert.deepEqual(ids(range), ['comment']); has(range, 'shared terms: tungsten');
  const span = query(s, "MATCH (s:Symbol {id: 'src/a.ts#f'}) RETURN s.line AS line, s.endLine AS endLine");
  assert.deepEqual(span, [{ line: 2, endLine: 4 }]);
  // Both ends of the inclusive declaration span contribute terms.
  s.write(join(s.repo, 'src/a.ts'), '/** tungsten */\nexport function amber() {\n  return "quartz";\n} // zircon\n');
  s.commit('Terms at declaration boundaries');
  ok(s.build([s.decisions([record('first', { title: 'amber' }), record('middle', { title: 'quartz' }), record('last', { title: 'zircon' }), record('comment', { title: 'tungsten' })])]));
  assert.deepEqual(new Set(ids(ok(s.cli(['carry', 'src/a.ts:amber'])))), new Set(['first', 'middle', 'last']));
});
contract('U8', 'fixture explicit citations rank records and commits identically in CLI and MCP', 'fixture', async (s, t) => {
  const notes = JSON.parse(readFileSync(join(s.repo, 'decisions/notes.json'), 'utf8')).records;
  assert.deepEqual(notes.map(r => [r.id, r.commits]), [['note-1', ['a3bcb76']], ['note-2', ['73ebd46', 'a3bcb76']]]);
  const spans = query(s, "MATCH (s:Symbol {id: 'src/money.ts#formatCents'}) RETURN s.line AS line, s.endLine AS endLine")[0];
  for (const args of [['why', 'src/money.ts:formatCents'], ['carry', 'src/money.ts:formatCents'], ['carry', `src/money.ts:${spans.line}-${spans.endLine}`]]) {
    const text = linked(ok(s.cli(args))); assert.deepEqual(ids(text), ['note-2', 'ADR-0001', 'note-1']);
    const byId = blocks(text);
    assert.deepEqual([...byId.get('note-2').matchAll(/(?:changed by:|           ) (\w+)[^\n]+that commit changed (\d+) symbol/g)].map(m => [m[1], Number(m[2])]), [['73ebd46', 1], ['a3bcb76', 5]]);
    assert.match(byId.get('ADR-0001'), /dfb4ff8[^\n]+that commit changed 3 symbols/);
    assert.match(byId.get('note-1'), /a3bcb76[^\n]+that commit changed 5 symbols/);
  }
  const client = await h.mcp(t, s);
  const rows = (await client.rows(client.recipes.get('why'), { symbol: 'src/money.ts#formatCents' })).filter(r => r.kind === 'record');
  assert.deepEqual(rows.map(r => r.id), ['note-2', 'ADR-0001', 'note-1']);
  assert.deepEqual(rows.map(r => r.via.map(v => [v.commit.slice(0, 7), v.symbols])), [[['73ebd46', 1], ['a3bcb76', 5]], [['dfb4ff8', 3]], [['a3bcb76', 5]]]);
  assert.ok(rows.every(r => r.named.length === 0));
});
contract('U9', 'unlinked why and impact explain only supported ways to cite commits', 'code', s => {
  s.commit('Code without a recorded decision'); ok(s.build([s.decisions([record('unlinked')])]));
  const why = ok(s.cli(['why', 'src/code.ts:f']));
  has(why, 'No decision is recorded for it.');
  assert.match(why, /decided:.*commit.*record|record.*commit.*decided:/s);
  const impact = ok(s.cli(['impact', 'unlinked']));
  has(impact, "No commit in this repo's history cites it (a commit the record lists).");
  assert.doesNotMatch(why + impact, /trailer|Decision:/);
});

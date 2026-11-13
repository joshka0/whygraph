/**
 * module: [[whygraph-failure-contracts]]
 * Assertions derive from docs/failures.md and README.md, not source bodies.
 * Each top-level test owns its scratch repo; no cleanup deletes any file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, lstatSync, readFileSync, readdirSync, readlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { harness as h } from './support.mjs';

const { ok, has, failure, record, ids, state } = h;
const tax = 'src/tax.ts:taxRate';
const money = 'src/money.ts:cents';
const full = {
  initial: 'dfb4ff8933d9a512edf9c0c0d6024e3199507cda',
  tax: '2a5950698c6aa578b75a2be0d6bd0fcb79d0d6e5',
  regional: '78884f017cf821b0298b774c39d521a027985087',
};
function contract(id, description, mode, body) {
  test(`${id} ${description}`, { timeout: 120_000 }, async t => body(state(t, mode), t));
}
function query(s, cypher, store = s.store) {
  const parsed = JSON.parse(ok(s.run('relate', ['--database', store, '--read-only', '--json', '-c', cypher])));
  assert.ok(Array.isArray(parsed.data), JSON.stringify(parsed));
  return parsed.data;
}
function citeCount(s, id) {
  return query(s, `MATCH (:Decision {id: '${id}'})-[r:CITES]->() RETURN count(r) AS n`)[0].n;
}
function unchanged(s, action) {
  const link = readlinkSync(s.store);
  const before = ok(s.cli(['why', tax]));
  const result = action();
  assert.equal(readlinkSync(s.store), link, 'failed build changed the store link');
  assert.equal(ok(s.cli(['why', tax])), before, 'failed build changed the previous answer');
  return result;
}
function countLine(text, label, count) { assert.match(text, new RegExp(`^\\s+${label}\\s+${count}$`, 'm')); }
function ordered(text, strings) {
  let previous = -1;
  for (const str of strings) { const at = text.indexOf(str, previous + 1); assert.ok(at > previous, `Expected order ${strings.join(' -> ')} in:\n${text}`); previous = at; }
}
function whyParts(text) {
  const at = text.indexOf('Decision records linked only through a commit');
  return { direct: at < 0 ? text : text.slice(0, at), loose: at < 0 ? '' : text.slice(at) };
}
function adr(s, files) {
  const folder = join(s.repo, 'docs/adr');
  for (const [name, text] of Object.entries(files)) s.write(join(folder, name), text);
  return { folder, result: () => s.cli(['decisions', 'adr', folder]) };
}
const heading = (n, extra = '') => `# ADR ${n}: Choice ${n}\n\n${extra}\n\n## Choice\n\nKeep it simple.\n`;
function tagCode(tags) {
  return '/** module: [[link-fixture]] */\n\n' + tags.map((text, i) => `/** decided: ${text} */\nexport function f${i}() { return ${i}; }\n`).join('\n');
}
function linkFiles(s, { adrDate = '2026-01-01', noteDate = '2026-01-02', commits } = {}) {
  // Write the record after the code commit: these tests isolate tag/trailer
  // links from the automatic citation of the ADR file's original addition.
  const a = adr(s, { '0004-x.md': heading(4, `Date: ${adrDate}`) });
  const records = JSON.parse(ok(a.result())).records;
  if (commits !== undefined) records[0].commits = commits;
  return [s.decisions(records, 'link-adrs.json'), s.decisions([record('note-1', { date: noteDate })], 'link-notes.json')];
}
function namedSymbols(s) {
  return query(s, 'MATCH (s:Symbol)-[:DECIDED]->(:DecidedTag)-[:NAMES]->(d:Decision) RETURN s.name AS name, d.id AS record ORDER BY name, record');
}
function citedCommits(s, id) {
  return query(s, `MATCH (:Decision {id: '${id}'})-[:CITES]->(k:Commit) RETURN k.sha AS sha ORDER BY sha`).map(row => row.sha);
}

contract('A1', 'fixture ADR records, metadata and full cited commits', 'fixture-unbuilt', s => {
  const result = s.cli(['decisions', 'adr', 'docs/adr']);
  const records = JSON.parse(ok(result)).records;
  assert.equal(result.stderr, '');
  assert.deepEqual(records.map(r => r.id), ['ADR-0001', 'ADR-0002', 'ADR-0003']);
  assert.deepEqual(records.map(r => r.commits), [[full.initial], [full.tax], [full.regional]]);
  assert.deepEqual(records.map(r => r.restsOn), [[], ['ADR-0001'], ['ADR-0001']]);
  assert.deepEqual(records.map(r => r.supersedes), [[], [], ['ADR-0002']]);
  for (const [i, r] of records.entries()) {
    assert.equal(r.status, 'accepted'); assert.equal(r.date, `2026-01-0${i + 1}`);
    assert.deepEqual(r.topics, [i === 0 ? 'fx-money' : 'fx-tax']);
    assert.deepEqual(r.items.map(item => item.label), ['context', 'choice']);
    assert.ok(r.items.every(item => item.text.length > 0));
  }
});
contract('A2', 'fixture node and relationship counts without warnings', 'fixture', s => {
  const result = s.build(); const text = ok(result); assert.equal(result.stderr, '');
  for (const [label, n] of Object.entries({ Check: 1, Commit: 9, DecidedTag: 5, Decision: 5, File: 6, Item: 8, Symbol: 8, Topic: 6, CHANGES: 27, CITES: 7, NAMES: 3, SUPERSEDES: 1, RESTS_ON: 4, USES: 5, VERIFIED: 1 })) countLine(text, label, n);
  has(text, '0 warnings');
});
contract('A3', 'taxRate doc links precede header links and loose commit links', 'fixture', s => {
  const text = ok(s.cli(['why', tax]));
  ordered(text, ['the rate depends on the region', 'tax lives apart from the cart', '2026-01-03  ADR-0003', '2026-01-02  ADR-0002', '2026-01-02  note-1']);
  assert.deepEqual(ids(text), ['ADR-0003', 'ADR-0002', 'note-1']);
  const parts = whyParts(text);
  assert.deepEqual(ids(parts.direct), ['ADR-0003', 'ADR-0002']); assert.deepEqual(ids(parts.loose), ['note-1']);
  has(parts.direct, 'named by: a decided: tag in its doc comment', 'named by: a decided: tag in the header of src/tax.ts', 'superseded by: ADR-0003', 'also cited by: 78884f0', 'that commit changed 1 symbol', 'also cited by: 2a59506', 'that commit changed 2 symbols');
  has(parts.loose, 'changed by: 2a59506', 'that commit changed 2 symbols');
});
contract('A4', 'taxOf is not linked to the regional change', 'fixture', s => {
  const text = ok(s.cli(['why', 'src/tax.ts:taxOf']));
  assert.deepEqual(ids(text), ['ADR-0002', 'ADR-0001', 'note-1']);
  const parts = whyParts(text);
  assert.deepEqual(ids(parts.direct), ['ADR-0002']); assert.deepEqual(ids(parts.loose), ['ADR-0001', 'note-1']);
  has(parts.direct, 'named by: a decided: tag in the header of src/tax.ts');
  has(parts.loose, 'changed by: 395b8c0', 'that commit changed 5 symbols', 'changed by: 2a59506');
  assert.ok(!ids(text).includes('ADR-0003')); assert.ok(!text.includes('78884f0'));
});
contract('A5', 'impact traverses premises and counts distinct symbols', 'fixture', s => {
  const text = ok(s.cli(['impact', 'ADR-0002']));
  has(text, 'The decision itself: ADR-0002', 'superseded by: ADR-0003', '1 file whose header decided: tag names it: src/tax.ts', 'Rests on it directly: note-1', 'through 1 other record: note-2', '3 distinct symbols in all: 0 named by a decided: tag, 3 reached only through a commit.');
  assert.match(text, /2a59506[^\n]+; it changed 2 symbols/); assert.match(text, /73ebd46[^\n]+; it changed 1 symbol/);
  assert.doesNotMatch(text, /symbol(?:s)? whose decided: tag names it/);
  assert.match(text, /1 user\s+src\/tax.ts:taxRate/); assert.match(text, /0 users\s+src\/tax.ts:taxOf/);
  assert.match(text, /1 user\s+src\/money.ts:formatCents/);
});
contract('A6', 'a superseding record still rests on ADR-0001', 'fixture', s => {
  const text = ok(s.cli(['impact', 'ADR-0001']));
  has(text, 'The decision itself: ADR-0001', 'Rests on it directly: ADR-0002', 'Rests on it directly: ADR-0003', 'through 1 other record: note-1', 'through 2 other records: note-2', 'That commit changed no other symbol that exists now.', '6 distinct symbols in all: 2 named by a decided: tag, 4 reached only through a commit.');
  const base = text.slice(text.indexOf('The decision itself:'), text.indexOf('Rests on it directly:'));
  assert.match(base, /2 users\s+src\/money.ts:cents/);
  ordered(base, ['dfb4ff8', 'f85c3a6', '395b8c0']);
  for (const [sha, n] of [['dfb4ff8', 3], ['f85c3a6', 1], ['395b8c0', 5]]) assert.match(base, new RegExp(`${sha}[^\\n]+; it changed ${n} symbol`));
  has(base, '4 other symbols', 'src/money.ts:formatCents', 'src/cart.ts:total', 'src/lib.rs:round_cents', 'src/tax.ts:taxOf');
  assert.match(base, /1 user\s+src\/money.ts:formatCents\s+\(395b8c0, dfb4ff8\)/);
  assert.equal((base.match(/src\/money.ts:cents/g) ?? []).length, 1); assert.ok(!base.includes('73ebd46'));
});
contract('A7', 'carry cents has its topic, no check and two direct users', 'fixture', s => {
  const text = ok(s.cli(['carry', money]));
  has(text, 'fx-money: no other file owns it', 'No formal check covers it.');
  assert.deepEqual(ids(text), ['ADR-0001']); has(text, 'named by: a decided: tag in its doc comment');
  ordered(text.slice(text.indexOf('2 commits changed')), ['395b8c0', 'dfb4ff8']);
  assert.match(text, /^\s+1\s+src\/cart.ts:total$/m); assert.match(text, /^\s+1\s+src\/tax.ts:taxOf$/m);
});
contract('A8', 'carry formatCents lists newest commits and both records', 'fixture', s => {
  const text = ok(s.cli(['carry', 'src/money.ts:formatCents']));
  assert.deepEqual(ids(text), ['ADR-0001', 'note-2']);
  const commits = text.slice(text.indexOf('3 commits changed'));
  ordered(commits, ['395b8c0', '73ebd46', 'dfb4ff8']);
  has(text, 'No decided: tag names a decision record.');
  assert.deepEqual(ids(whyParts(text).loose), ['ADR-0001', 'note-2']);
  for (const [sha, n] of [['dfb4ff8', 3], ['395b8c0', 5], ['73ebd46', 1]]) assert.match(whyParts(text).loose, new RegExp(`${sha}[^\\n]+; that commit changed ${n} symbol`));
});

contract('B1', 'an unborn repo still loads files and symbols', 'code', s => {
  const result = s.build([]); has(ok(result), '0 commits'); has(result.stderr, 'the repo has no commits');
  assert.equal(query(s, 'MATCH (k:Commit) RETURN count(k) AS n')[0].n, 0);
  has(ok(s.cli(['why', 'src/code.ts:f'])), 'No decision record cites a commit');
  assert.match(ok(s.cli(['carry', 'src/code.ts:f'])), /[Nn]o commit changed/);
});
contract('B2', 'unknown commit in an unborn repo is dropped', 'code', s => {
  const result = s.build([s.decisions([record('unborn', { commits: ['abcd'] })])]);
  ok(result); has(result.stderr, 'unborn', 'abcd'); assert.equal(citeCount(s, 'unborn'), 0);
});
contract('B3', 'empty repo builds an empty store', 'empty', s => {
  has(ok(s.build([])), '0 nodes', '(none)');
  assert.match(failure(s.cli(['why', 'x.ts:f']), 3), /[Nn]o file x\.ts/);
});
contract('B4', 'no decisions loads no record links and warns for each unknown tag and trailer', 'fixture-unbuilt', s => {
  const result = s.build([]); ok(result); assert.equal(query(s, 'MATCH (d:Decision) RETURN count(d) AS n')[0].n, 0);
  assert.equal(query(s, 'MATCH ()-[r:NAMES|CITES]->() RETURN count(r) AS n')[0].n, 0);
  const warnings = result.stderr.trim().split('\n'); assert.equal(warnings.length, 5); assert.deepEqual(warnings, [...warnings].sort());
  assert.equal(warnings.filter(line => line.includes('decided tag on')).length, 3);
  assert.equal(warnings.filter(line => line.includes('trailer')).length, 2);
  failure(s.cli(['impact', 'X']), 3, 'store holds no decision records');
});
contract('B5', 'unreachable and unknown commits warn once per id', 'fixture-unbuilt', s => {
  s.git('switch', '-q', '-c', 'unmerged');
  s.write(join(s.repo, 'unmerged.txt'), 'only on this branch');
  const unmerged = s.commit('unmerged record'); s.git('switch', '-q', 'main');
  const commits = ['deadbeef', unmerged];
  const result = s.build([s.decisions([record('outside-head', { commits })])]); ok(result);
  for (const c of commits) {
    const line = `record outside-head: commit "${c}" matches no commit reachable from HEAD; the link is dropped`;
    has(result.stderr, line); assert.equal(result.stderr.split(line).length - 1, 1);
  }
  assert.equal(citeCount(s, 'outside-head'), 0);
});
contract('B6', 'ambiguous short commit uses the public pure contract', 'empty', async () => {
  const { matchCommit, checkRecords } = await import(pathToFileURL(join(h.subject, 'src/records.pure.ts')));
  const shas = ['abcd' + 'f'.repeat(36), 'abcd' + '0'.repeat(36)];
  assert.deepEqual(matchCommit('ABCD', shas), { ambiguous: [...shas].sort() });
  const normalized = { title: null, status: null, source: null, items: [], topics: [], restsOn: [], supersedes: [], ...record('collision', { commits: ['abcd'] }) };
  const checked = checkRecords([{ file: 'collision.json', record: normalized }], shas);
  assert.deepEqual(checked.cites.get('collision'), []); assert.equal(checked.warnings.length, 1);
  ordered(checked.warnings[0], ['collision', 'abcd', ...[...shas].sort()]);
});
contract('B7', 'short text and git refs are never resolved', 'fixture-unbuilt', s => {
  const result = s.build([s.decisions([record('refs', { commits: ['123', 'HEAD', 'main'] })])]); ok(result);
  for (const c of ['123', 'HEAD', 'main']) has(result.stderr, `commit "${c}" matches no commit reachable from HEAD`);
  assert.equal(citeCount(s, 'refs'), 0);
});
contract('B8', 'duplicate ids in one or two files preserve the old store', 'fixture', s => {
  for (const split of [false, true]) {
    const a = s.decisions(split ? [record('duplicate')] : [record('duplicate'), record('duplicate')], `duplicate-${split}-a.json`);
    const b = s.decisions([record('duplicate')], `duplicate-${split}-b.json`);
    const result = unchanged(s, () => s.build(split ? [a, b] : [a]));
    failure(result, 1, 'duplicate', a); if (split) has(result.stderr, b);
  }
});
for (const [id, edges, cycle] of [
  ['B9', [['A', 'B'], ['B', 'A']], 'A -> B -> A'],
  ['B10', [['A', 'A']], 'A -> A'],
  ['B11', [['C', 'A'], ['B', 'C'], ['A', 'B']], 'A -> B -> C -> A'],
]) contract(id, 'supersedes cycle is rejected without changing the store', 'fixture', s => {
  const file = s.decisions([record('valid'), ...edges.map(([a, b]) => record(a, { supersedes: [b] }))]);
  const result = unchanged(s, () => s.build([file])); failure(result, 1, `supersedes cycle: ${cycle}`);
  assert.equal(result.stderr.split(`supersedes cycle: ${cycle}`).length - 1, 1);
});
contract('B12', 'restsOn cycles terminate with the base once at depth zero', 'code', s => {
  s.commit('Add code without tags or trailers');
  const result = s.build([s.decisions([record('A', { restsOn: ['B'] }), record('B', { restsOn: ['A'] })])]);
  ok(result); assert.equal(result.stderr, '');
  const text = ok(s.cli(['impact', 'A']));
  assert.equal((text.match(/The decision itself: A/g) ?? []).length, 1);
  has(text, 'Rests on it directly: B'); assert.ok(!text.includes('Rests on it directly: A'));
});
contract('B13', 'dangling relation targets warn and are dropped', 'fixture-unbuilt', s => {
  const result = s.build([s.decisions([record('dangling', { restsOn: ['missing-premise'], supersedes: ['missing-old'] })])]);
  ok(result); has(result.stderr, 'dangling', 'restsOn', 'missing-premise', 'supersedes', 'missing-old');
  assert.equal(query(s, 'MATCH (:Decision)-[r:RESTS_ON|SUPERSEDES]->() RETURN count(r) AS n')[0].n, 0);
});
contract('B14', 'bad JSON and envelopes preserve the store', 'fixture', s => {
  for (const [i, content] of ['not json', '[]', '{}', '{"records":[],"extra":true}'].entries()) {
    const file = s.write(join(s.dir, `bad-envelope-${i}.json`), content);
    failure(unchanged(s, () => s.build([file])), 1, file);
  }
});
contract('B15', 'each malformed record field reports its file, index and id', 'fixture', s => {
  const records = [
    record('colour', { colour: 'red' }), { id: 'missing-date' }, record('bad-date', { date: '2026-1-1' }),
    record(''), record('bad-items', { items: [{ label: 'choice', text: 4 }] }), record('bad-list', { topics: ['good', 3] }),
  ];
  const file = s.decisions(records);
  const result = unchanged(s, () => s.build([file])); failure(result, 1);
  const lines = result.stderr.trim().split('\n').filter(line => line.startsWith(`${file}:`));
  for (const [i, r] of records.entries()) {
    assert.ok(lines.some(line => line.startsWith(`${file}: record ${i} (${r.id}):`)), `Missing record ${i}/${r.id}: ${result.stderr}`);
  }
  assert.equal(lines.length, records.length, result.stderr);
});
contract('B16', 'undated records follow all dated records', 'fixture-unbuilt', s => {
  ok(s.build([s.decisions([record('A-undated', { date: null, commits: [full.tax] }), record('Z-dated', { date: '2099-01-01', commits: [full.tax] })])]));
  const text = ok(s.cli(['why', tax])); assert.deepEqual(ids(text), ['Z-dated', 'A-undated']); has(text, 'undated');
});
contract('B17', 'decision topics load without a code owner', 'fixture-unbuilt', s => {
  ok(s.build([s.decisions([record('lonely', { topics: ['unowned-topic'] })])]));
  assert.deepEqual(query(s, "MATCH (:Decision {id: 'lonely'})-[:ABOUT]->(t:Topic) RETURN t.slug AS slug"), [{ slug: 'unowned-topic' }]);
});
contract('B18', 'missing decisions file is named', 'fixture-unbuilt', s => {
  const path = join(s.dir, 'does-not-exist.json'); failure(s.build([path]), 1, path);
});
for (const [id, missing, tools] of [['B19', 'relate', ['git', 'memod', 'node']], ['B20', 'memod', ['git', 'relate', 'node']]]) {
  contract(id, `missing ${missing} on PATH fails clearly`, 'fixture-unbuilt', s => {
    failure(s.build([], { env: s.wrapper(missing, null, tools) }), 1, `${missing} is not on PATH`);
    assert.ok(!existsSync(s.store));
  });
}
contract('B21', 'a failed or malformed memod run preserves the store', 'fixture', s => {
  for (const [body, messages] of [
    ["console.error('memod deliberate failure'); process.exit(17);", ['memod', '17', 'memod deliberate failure']],
    ["console.log('{}');", ['memod', 'graph']],
  ]) failure(unchanged(s, () => s.build(s.files, { env: s.wrapper('memod', body) })), 1, ...messages);
});
contract('B22', 'a relate statement failure preserves the link and leaves no new build', 'fixture', s => {
  const builds = `${s.store.slice(0, s.store.lastIndexOf('/'))}/.store.builds`;
  const before = readdirSync(builds).sort();
  const realRelate = resolve(process.env.HOME, '.local/bin/relate');
  const body = `
import { spawnSync } from 'node:child_process';
import { readFileSync, appendFileSync } from 'node:fs';
const args = process.argv.slice(2);
let input = readFileSync(0, 'utf8');
appendFileSync(${JSON.stringify(join(s.dir, 'relate-wrapper.jsonl'))}, JSON.stringify(args)+'\\n');
if (args.some(arg => arg.includes('.store.builds'))) {
  const index = args.findIndex(arg => arg.includes('CREATE INDEX') || arg.includes('CREATE ('));
  const inject = text => { const parts = text.split(';'); parts.splice(Math.max(1, Math.floor(parts.length / 2)), 0, 'RETURN deliberately_unbound_variable'); return parts.join(';'); };
  if (index >= 0) args[index] = inject(args[index]); else input = inject(input);
}
const r = spawnSync(${JSON.stringify(realRelate)}, args, { input, env: process.env, encoding: 'utf8' });
process.stdout.write(r.stdout ?? ''); process.stderr.write(r.stderr ?? ''); process.exit(r.status ?? 1);`;
  const result = unchanged(s, () => s.build(s.files, { env: s.wrapper('relate', body) }));
  failure(result, 1, 'relate', 'exit'); assert.match(result.stderr, /statement \d+ of \d+ failed/);
  assert.deepEqual(readdirSync(builds).sort(), before);
});
contract('B23', 'rebuild with an open MCP reader keeps both snapshots usable', 'fixture', async (s, t) => {
  const old = await h.mcp(t, s);
  const read = client => client.rows('MATCH (d:Decision) RETURN d.id AS id ORDER BY id');
  const oldIds = (await read(old)).map(r => r.id);
  assert.equal(oldIds.length, 5);
  ok(s.build([s.decisions([record('new-only')])]));
  assert.deepEqual((await read(old)).map(r => r.id), oldIds);
  const fresh = await h.mcp(t, s); assert.deepEqual(await read(fresh), [{ id: 'new-only' }]);
  assert.equal(readdirSync(join(s.store, '..', '.store.builds')).length, 1);
});
contract('B24', 'the second build replaces rather than merges old records', 'fixture', s => {
  ok(s.build([s.decisions([record('note-1')])]));
  assert.deepEqual(query(s, 'MATCH (d:Decision) RETURN d.id AS id ORDER BY id'), [{ id: 'note-1' }]);
  for (const id of ['ADR-0001', 'ADR-0002', 'ADR-0003', 'note-2']) failure(s.cli(['impact', id]), 3);
});
contract('B25', 'foreign directories and files are untouched', 'fixture-unbuilt', s => {
  const directory = join(s.dir, 'foreign-dir'); const sentinel = s.write(join(directory, 'keep.txt'), 'sacred\n');
  const file = s.write(join(s.dir, 'foreign-file'), 'also sacred\n');
  for (const store of [directory, file]) {
    const result = s.cli(['build', '--store', store]); failure(result, 1, 'not a whygraph store');
    assert.ok(!lstatSync(store).isSymbolicLink());
  }
  assert.deepEqual(readdirSync(directory), ['keep.txt']); assert.equal(readFileSync(sentinel, 'utf8'), 'sacred\n');
  assert.equal(readFileSync(file, 'utf8'), 'also sacred\n');
});
contract('B26', 'outside a git repo fails with usage status', 'outside', s => {
  // The retained scratch root itself is in whygraph: ceiling discovery keeps the
  // deliberately unversioned child from accidentally finding the subject repo.
  const env = { GIT_CEILING_DIRECTORIES: s.dir };
  failure(s.cli(['build'], { env }), 2, 'is not in a git repo');
  failure(s.cli(['build', '--repo', s.repo], { env }), 2, 'is not in a git repo');
});
contract('B27', 'each worktree owns a different default store', 'fixture-unbuilt', s => {
  const worktree = join(s.dir, 'worktree'); s.git('worktree', 'add', '-q', '-b', 'other-worktree', worktree);
  ok(s.build([])); ok(s.cli(['build'], { cwd: worktree }));
  const gitDir = ok(s.run('git', ['rev-parse', '--absolute-git-dir'], worktree)).trim();
  const otherStore = join(gitDir, 'whygraph/store');
  assert.notEqual(otherStore, s.store); assert.ok(lstatSync(s.store).isSymbolicLink()); assert.ok(lstatSync(otherStore).isSymbolicLink());
  has(ok(s.cli(['carry', money], { cwd: worktree })), 'src/cart.ts:total');
});
contract('B28', 'merge CHANGES follow memod and CITES require an explicit record', 'fixture', s => {
  const graph = JSON.parse(ok(s.run('memod', ['graph', '--history'])));
  const merge = graph.nodes.find(n => n.kind === 'commit' && n.name.startsWith('13d52e8'));
  assert.ok(merge);
  const changed = graph.edges.filter(e => e.kind === 'changes' && e.from === merge.id).map(e => {
    const node = graph.nodes.find(n => n.id === e.to); return node.name;
  }).sort();
  const rows = query(s, "MATCH (k:Commit {short: '13d52e8'})-[:CHANGES]->(n) RETURN n.path AS path, n.id AS id");
  assert.deepEqual(rows.map(r => r.id ?? r.path).sort(), changed);
  assert.equal(query(s, "MATCH (:Decision)-[r:CITES]->(:Commit {short: '13d52e8'}) RETURN count(r) AS n")[0].n, 0);
  ok(s.build([s.decisions([record('merge', { commits: ['13d52e8'] })])])); assert.equal(citeCount(s, 'merge'), 1);
});
contract('B29', 'a deleted symbol leaves no node or CHANGES target', 'code', s => {
  const changed = s.commit('Add f');
  s.write(join(s.repo, 'src/code.ts'), 'export function surviving() { return 2; }\n'); s.commit('Remove f, keep its file');
  ok(s.build([s.decisions([record('deleted', { commits: [changed] })])]));
  assert.equal(query(s, "MATCH (s:Symbol {id: 'src/code.ts#f'}) RETURN count(s) AS n")[0].n, 0);
  assert.equal(query(s, `MATCH (:Commit {sha: '${changed}'})-[:CHANGES]->(s:Symbol) RETURN count(s) AS n`)[0].n, 0);
  const text = ok(s.cli(['impact', 'deleted']));
  has(text, changed.slice(0, 7), 'it changed 0 symbols', 'That commit changed no symbol that exists now.');
});

contract('D1', 'an ADR without a date has null date', 'empty', s => {
  const a = adr(s, { '0001-choice.md': heading(1) }); assert.equal(JSON.parse(ok(a.result())).records[0].date, null);
});
contract('D2', 'an ADR without status has no rendered status', 'code', s => {
  const a = adr(s, { '0001-choice.md': heading(1) }); s.commit('Implement ADR 1');
  const text = ok(a.result()); assert.equal(JSON.parse(text).records[0].status, null);
  ok(s.build([s.write(join(s.dir, 'adrs.json'), text)])); assert.ok(!ok(s.cli(['why', 'src/code.ts:f'])).includes('status:'));
});
contract('D3', 'a Status section supplies status and is not an item', 'empty', s => {
  const a = adr(s, { '0001-choice.md': '# Choice\n\n## Status\n\naccepted\nmore detail\n\n## Choice\n\nA\n' });
  const r = JSON.parse(ok(a.result())).records[0]; assert.equal(r.status, 'accepted'); assert.deepEqual(r.items.map(i => i.label), ['choice']);
});
contract('D4', 'no heading yields a null title and the no-title display', 'code', s => {
  const a = adr(s, { '0001-choice.md': 'Date: 2026-01-01\n\n## Choice\n\nA\n' }); s.commit('Implement ADR 1');
  const text = ok(a.result()); assert.equal(JSON.parse(text).records[0].title, null);
  ok(s.build([s.write(join(s.dir, 'adrs.json'), text)])); has(ok(s.cli(['why', 'src/code.ts:f'])), '(no title)');
});
contract('D5', 'Supersedes is not also a premise', 'empty', s => {
  const a = adr(s, { '0002-old.md': heading(2), '0003-new.md': heading(3, 'Supersedes ADR 0002.') });
  const r = JSON.parse(ok(a.result())).records[1]; assert.deepEqual(r.supersedes, ['ADR-0002']); assert.deepEqual(r.restsOn, []);
});
contract('D6', 'Superseded by creates the inverse supersedes edge', 'empty', s => {
  const a = adr(s, { '0002-old.md': heading(2, 'Superseded by ADR 0003.'), '0003-new.md': heading(3) });
  assert.deepEqual(JSON.parse(ok(a.result())).records[1].supersedes, ['ADR-0002']);
});
contract('D7', 'later ADR mentions are not premises', 'empty', s => {
  const a = adr(s, { '0003-choice.md': heading(3, 'See ADR 0004.'), '0004-later.md': heading(4) });
  assert.deepEqual(JSON.parse(ok(a.result())).records[0].restsOn, []);
});
contract('D8', 'self mentions are never restsOn or supersedes', 'empty', s => {
  const a = adr(s, { '0003-choice.md': heading(3, 'See ADR 3. Supersedes ADR 0003.') });
  const r = JSON.parse(ok(a.result())).records[0]; assert.deepEqual(r.restsOn, []); assert.deepEqual(r.supersedes, []);
});
contract('D9', 'non-ADR markdown files are skipped and named', 'empty', s => {
  const a = adr(s, { '0001-choice.md': heading(1), 'README.md': '# Read me', '12-x.md': '# Short' });
  const result = a.result(); assert.equal(JSON.parse(ok(result)).records.length, 1); has(result.stderr, 'skipped README.md', 'skipped 12-x.md');
});
contract('D10', 'missing ADRs and non-directory paths fail', 'empty', s => {
  const a = adr(s, { 'README.md': '# No ADR' }); failure(a.result(), 1, a.folder);
  const file = s.write(join(s.dir, 'regular-file'), 'x'); failure(s.cli(['decisions', 'adr', file]), 1, file);
});
contract('D11', 'ADRs outside git still load without commits', 'outside', s => {
  const a = adr(s, { '0001-choice.md': heading(1) });
  const result = s.cli(['decisions', 'adr', a.folder], { env: { GIT_CEILING_DIRECTORIES: s.dir } });
  assert.deepEqual(JSON.parse(ok(result)).records[0].commits, []); has(result.stderr, 'not in a git repo');
});
contract('D12', 'ADRs in an unborn repo cite no commits', 'empty', s => {
  const a = adr(s, { '0001-choice.md': heading(1) }); const result = a.result();
  assert.deepEqual(JSON.parse(ok(result)).records[0].commits, []); has(result.stderr, 'no commits');
});
contract('D13', 'ADR history follows its rename but cites only the original addition', 'empty', s => {
  const a = adr(s, { '0004-old.md': heading(4) }); const initial = s.commit('Create a choice');
  s.write(join(a.folder, '0004-old.md'), heading(4, 'A later note.')); s.commit('Edit the choice');
  s.git('mv', 'docs/adr/0004-old.md', 'docs/adr/0004-new.md'); s.commit('Rename the choice');
  s.write(join(a.folder, '0004-new.md'), heading(4, 'Another later note.')); s.commit('Edit after renaming');
  assert.deepEqual(JSON.parse(ok(a.result())).records[0].commits, [initial]);
});
contract('D14', 'free-text ADR and filename mentions are not cited', 'code', s => {
  const a = adr(s, { '0004-x.md': heading(4) }); const initial = s.commit('Create the choice');
  s.git('commit', '-q', '--allow-empty', '-m', 'see ADR 4'); const message = s.git('rev-parse', 'HEAD').trim();
  s.git('commit', '-q', '--allow-empty', '-m', 'See 0004-x.md'); const filename = s.git('rev-parse', 'HEAD').trim();
  s.git('commit', '-q', '--allow-empty', '-m', 'See ADR 40'); const wrong = s.git('rev-parse', 'HEAD').trim();
  const commits = JSON.parse(ok(a.result())).records[0].commits;
  assert.deepEqual(commits, [initial]);
  for (const sha of [filename, message, wrong]) assert.ok(!commits.includes(sha));
});
contract('D15', 'ADR conversion is byte deterministic', 'fixture-unbuilt', s => {
  assert.equal(ok(s.cli(['decisions', 'adr', 'docs/adr'])), ok(s.cli(['decisions', 'adr', 'docs/adr'])));
});
contract('D16', 'editing an old ADR links code only when a Decision trailer cites it', 'code', s => {
  const a = adr(s, { '0003-old.md': heading(3, 'Date: 2026-01-01') });
  const initial = s.commit('Add code and the original ADR');
  s.write(join(a.folder, '0003-old.md'), heading(3, 'Date: 2026-01-01\nADR 0004 replaces part of this choice.'));
  s.write(join(a.folder, '0004-new.md'), heading(4, 'Date: 2026-01-02'));
  s.write(join(s.repo, 'src/code.ts'), 'export function f() { return 2; }\n');
  const edit = s.commit('Replace part of ADR 0003');
  let converted = JSON.parse(ok(a.result())).records;
  assert.deepEqual(converted.find(r => r.id === 'ADR-0003').commits, [initial]);
  assert.deepEqual(converted.find(r => r.id === 'ADR-0004').commits, [edit]);
  ok(s.build([s.decisions(converted)]));
  assert.deepEqual(citedCommits(s, 'ADR-0003'), [initial]); assert.deepEqual(citedCommits(s, 'ADR-0004'), [edit]);
  s.write(join(s.repo, 'src/code.ts'), 'export function f() { return 3; }\n');
  s.write(join(a.folder, '0003-old.md'), heading(3, 'Date: 2026-01-01\nADR 0004 replaces part of this choice. Another note.'));
  const trailer = s.commit('Edit with an explicit citation\n\nDecision: ADR-0003');
  converted = JSON.parse(ok(a.result())).records;
  assert.deepEqual(converted.find(r => r.id === 'ADR-0003').commits, [initial]);
  ok(s.build([s.decisions(converted)]));
  assert.deepEqual(citedCommits(s, 'ADR-0003'), [initial, trailer].sort());
  assert.ok(!citedCommits(s, 'ADR-0003').includes(edit));
});

contract('W1', 'why and carry require an existing store', 'fixture-unbuilt', s => {
  for (const cmd of ['why', 'carry']) failure(s.cli([cmd, money]), 1, `no store at ${s.store}; run whygraph build first`);
});
contract('W2', 'near-miss symbols suggest cents first', 'fixture', s => {
  for (const cmd of ['why', 'carry']) {
    const text = failure(s.cli([cmd, 'src/money.ts:cent']), 3, 'src/money.ts has no symbol cent');
    assert.match(text, /Close: src\/money.ts:cents/);
  }
});
contract('W3', 'near-miss files suggest files and same-named symbols', 'fixture', s => {
  for (const cmd of ['why', 'carry']) assert.match(failure(s.cli([cmd, 'src/mony.ts:cents']), 3, 'src/money.ts', 'src/money.ts:cents'), /[Nn]o file src\/mony\.ts/);
});
contract('W4', 'an unindexed README is a missing file', 'fixture', s => {
  for (const cmd of ['why', 'carry']) assert.match(failure(s.cli([cmd, 'README.md:x']), 3), /[Nn]o file README\.md/);
});
contract('W5', 'malformed symbol targets fail with usage status', 'fixture', s => {
  for (const cmd of ['why', 'carry']) for (const target of ['src/money.ts', 'src/money.ts:', ':cents']) failure(s.cli([cmd, target]), 2, 'not <file>:<symbol>');
});
contract('W6', 'a filename is never silently interpreted as a symbol', 'fixture', s => {
  for (const cmd of ['why', 'carry']) {
    failure(s.cli([cmd, 'src/money.ts:cart.ts']), 3, 'src/money.ts has no symbol cart.ts', 'cents', 'formatCents');
    failure(s.cli([cmd, 'src/cart.ts']), 2, 'not <file>:<symbol>');
  }
});
contract('W7', 'targets outside the repo fail and name the root', 'fixture', s => {
  for (const cmd of ['why', 'carry']) for (const target of ['../other/x.ts:f', '/etc/x.ts:f', 'src/../../x.ts:f']) failure(s.cli([cmd, target]), 2, 'outside the repo', s.repo);
});
contract('W8', 'absolute in-repo targets have the same answer', 'fixture', s => {
  for (const cmd of ['why', 'carry']) assert.equal(ok(s.cli([cmd, `${s.repo}/${money}`])), ok(s.cli([cmd, money])));
});
contract('W9', 'dot and duplicate-slash paths normalize identically', 'fixture', s => {
  for (const cmd of ['why', 'carry']) {
    const expected = ok(s.cli([cmd, money]));
    for (const target of ['./src/money.ts:cents', 'src//money.ts:cents']) assert.equal(ok(s.cli([cmd, target])), expected);
  }
});
contract('W10', 'Rust users are unknown rather than absent', 'fixture', s => {
  const text = ok(s.cli(['carry', 'src/lib.rs:round_cents']));
  assert.match(text, /[Uu]nknown/); has(text, 'TypeScript', 'JavaScript'); assert.ok(!text.includes('No symbol uses it.'));
});
contract('W11', 'a TypeScript symbol without users says so', 'fixture', s => {
  has(ok(s.cli(['carry', 'src/cart.ts:total'])), 'No symbol uses it.');
});
contract('W12', 'a symbol without tags or records has four empty parts', 'code', s => {
  ok(s.build([])); const text = ok(s.cli(['why', 'src/code.ts:f']));
  has(text, 'Its doc comment holds no decided: tag.', 'holds no decided: tag.', 'No decided: tag names a decision record.', 'No decision record cites a commit');
  assert.match(text.trim().split('\n').at(-1), /^No decision is recorded for it\./);
});
contract('W13', 'type-only users carry the type mark', 'empty', s => {
  s.write(join(s.repo, 'src/types.ts'), 'export interface Input { value: number }\n');
  s.write(join(s.repo, 'src/user.ts'), 'import type { Input } from "./types.ts";\nexport function user(input: Input): number { return input.value; }\n');
  s.commit('Add type use'); ok(s.build([]));
  assert.match(ok(s.cli(['carry', 'src/types.ts:Input'])), /^\s+1\s+src\/user.ts:user\s+.*type/m);
});
contract('W14', 'uses cycles exclude the starting symbol and retain transitive users', 'empty', s => {
  s.write(join(s.repo, 'src/cycle.ts'), 'export function a(n: number): number { return n ? b(n-1) : 0; }\nexport function b(n: number): number { return n ? a(n-1) : 0; }\nexport function c(n: number): number { return b(n); }\n');
  s.commit('Add cyclic users and a transitive user'); ok(s.build([]));
  const text = ok(s.cli(['carry', 'src/cycle.ts:a']));
  assert.match(text, /^\s+1\s+src\/cycle.ts:b$/m); assert.match(text, /^\s+2\s+src\/cycle.ts:c$/m);
  assert.doesNotMatch(text, /^\s+\d+\s+src\/cycle.ts:a$/m);
});
contract('W15', 'status and superseded-by are rendered on why records', 'fixture', s => {
  has(ok(s.cli(['why', tax])), 'status: accepted', 'superseded by: ADR-0003');
});
contract('W16', 'a standalone decided tag is itself a recorded decision', 'empty', s => {
  s.write(join(s.repo, 'src/a.ts'), tagCode(['keep cents integral because floating point rounds incorrectly']));
  s.commit('Add a decision without a record name'); ok(s.build([]));
  const text = ok(s.cli(['why', 'src/a.ts:f0']));
  has(text, 'Decided in its doc comment:', 'keep cents integral', 'because floating point rounds incorrectly', 'No decided: tag names a decision record.');
  assert.deepEqual(ids(text), []); assert.ok(!text.includes('No decision is recorded'));
});

for (const [id, target] of [['I1', 'ADR-4'], ['I2', 'adr-0004']]) {
  contract(id, 'decision ids match exactly and suggest the closest id', 'fixture-unbuilt', s => {
    ok(s.build([s.decisions([record('ADR-0004')])])); failure(s.cli(['impact', target]), 3, 'ADR-0004');
  });
}
contract('I3', 'records without symbol changes print the empty explanation', 'fixture-unbuilt', s => {
  ok(s.build([s.decisions([record('no-cites'), record('no-changes', { commits: ['6bed2fd'] })])]));
  has(ok(s.cli(['impact', 'no-cites'])), "No commit in this repo's history cites it (a `Decision:` trailer, or a commit the record lists).");
  has(ok(s.cli(['impact', 'no-changes'])), '6bed2fd', 'it changed 0 symbols', 'That commit changed no symbol that exists now.');
});
contract('I4', 'symbols reached through multiple records count once', 'fixture', s => {
  const text = ok(s.cli(['impact', 'ADR-0002']));
  assert.equal((text.match(/\d+ user[s]?\s+src\/tax.ts:taxRate/g) ?? []).length, 2);
  assert.equal((text.match(/\d+ user[s]?\s+src\/tax.ts:taxOf/g) ?? []).length, 2);
  has(text, '3 distinct symbols in all:');
});
contract('I5', 'impact counts a symbol reached by both tag and commit once as direct', 'fixture', s => {
  const text = ok(s.cli(['impact', 'ADR-0003']));
  assert.equal((text.match(/\d+ users?\s+src\/tax.ts:taxRate/g) ?? []).length, 1);
  ordered(text, ['symbol whose decided: tag names it', 'src/tax.ts:taxRate', '1 commit cites it:']);
  has(text, 'That commit changed no other symbol that exists now.');
  assert.match(text, /1 distinct symbols? in all: 1 named by a decided: tag, 0 reached only through a commit\./);
});

contract('M1', 'printed MCP config is read-only and includes every recipe', 'fixture', s => {
  const { server, recipes } = h.config(ok(s.cli(['mcp'])));
  assert.equal(server.command, 'relate');
  assert.deepEqual(server.args, ['serve', '--mcp', 'stdio', '--database', s.store, '--read-only']);
  assert.deepEqual(server.env, { RELATE_TELEMETRY: '0', DO_NOT_TRACK: '1' });
  assert.deepEqual([...recipes.keys()].sort(), ['carry', 'impact', 'meaning', 'names', 'search', 'users', 'why']);
  for (const text of recipes.values()) assert.match(text, /\bMATCH\b/);
});
contract('M2', 'the printed server exposes exactly two read-only tools and a schema', 'fixture', async (s, t) => {
  const client = await h.mcp(t, s);
  const tools = (await client.request('tools/list')).tools;
  assert.deepEqual(tools.map(tool => tool.name).sort(), ['get_schema', 'read_cypher']);
  const schema = await client.tool('get_schema');
  const text = schema.content.filter(c => c.type === 'text').map(c => c.text).join('');
  has(text, 'Decision', 'Commit', 'Symbol', 'CITES', 'CHANGES');
});
contract('M3', 'the printed why recipe returns the fixture rows over MCP', 'fixture', async (s, t) => {
  const client = await h.mcp(t, s);
  const rows = await client.rows(client.recipes.get('why'), { symbol: 'src/tax.ts#taxRate' });
  assert.deepEqual(rows.map(row => row.kind), ['tag', 'file tag', 'record', 'record', 'record']);
  assert.deepEqual(rows.filter(row => row.kind === 'record').map(row => row.id), ['ADR-0003', 'ADR-0002', 'note-1']);
  has(rows[0].what, 'the rate depends on the region'); has(rows[1].what, 'tax lives apart from the cart');
  assert.deepEqual(rows[3].supersededBy, ['ADR-0003']);
  assert.deepEqual(rows.slice(2).map(row => row.named), [['doc comment'], ['file header'], []]);
  for (const [i, sha, n] of [[2, '78884f0', 1], [3, '2a59506', 2], [4, '2a59506', 2]]) {
    assert.equal(rows[i].via.length, 1); assert.ok(rows[i].via[0].commit.startsWith(`${sha} `)); assert.equal(rows[i].via[0].symbols, n);
  }
  const cli = ok(s.cli(['why', tax]));
  for (const row of rows) {
    has(cli, row.what);
    if (row.kind === 'record') { has(cli, row.id); for (const via of row.via) has(cli, via.commit, `that commit changed ${via.symbols} symbol`); }
  }
});
contract('M4', 'MCP requires an existing store', 'fixture-unbuilt', s => {
  failure(s.cli(['mcp']), 1, `no store at ${s.store}; run whygraph build first`);
});
contract('M5', 'every printed recipe executes through the read-only MCP tool', 'fixture', async (s, t) => {
  const client = await h.mcp(t, s);
  const params = { why: { symbol: 'src/tax.ts#taxRate' }, impact: { decision: 'ADR-0002' }, carry: { symbol: 'src/money.ts#cents' }, users: { symbol: 'src/money.ts#cents' }, names: {} };
  for (const [name, parameters] of Object.entries(params)) {
    const statement = client.recipes.get(name); assert.equal(typeof statement, 'string');
    assert.doesNotMatch(statement, /\bCALL\s*\{/i);
    const rows = await client.rows(statement, parameters); assert.ok(rows.length > 0, `no ${name} rows`);
  }
});

contract('L1', 'all three supported ADR spellings name a record directly', 'empty', s => {
  s.write(join(s.repo, 'src/a.ts'), tagCode(['choose adr-0004 because it is explicit', 'choose ADR-0004 because it is explicit', 'choose ADR 0004 because it is explicit']));
  s.commit('Add the three tag spellings'); const result = s.build(linkFiles(s)); ok(result); assert.equal(result.stderr, '');
  assert.deepEqual(namedSymbols(s), [0, 1, 2].map(i => ({ name: `f${i}`, record: 'ADR-0004' })));
  for (let i = 0; i < 3; i++) {
    const text = ok(s.cli(['why', `src/a.ts:f${i}`])); assert.deepEqual(ids(text), ['ADR-0004']);
    has(text, 'named by: a decided: tag in its doc comment');
  }
});
contract('L2', 'near-match ADR spellings neither name a record nor warn', 'empty', s => {
  const near = ['ADR 4', 'Adr-0004', 'ADR  0004', 'ADR_0004', 'ADR-00041', 'ADR-0004x', 'xADR-0004'];
  s.write(join(s.repo, 'src/a.ts'), tagCode(near.map(id => `choose ${id} because this is a near match`)));
  s.commit('Add seven near matches'); const result = s.build(linkFiles(s)); ok(result); assert.equal(result.stderr, '');
  assert.deepEqual(namedSymbols(s), []);
  assert.equal(query(s, 'MATCH ()-[r:NAMES]->() RETURN count(r) AS n')[0].n, 0);
  for (let i = 0; i < near.length; i++) assert.deepEqual(ids(ok(s.cli(['why', `src/a.ts:f${i}`]))), []);
});
contract('L3', 'non-ADR names require exact case and identifier boundaries', 'empty', s => {
  const mentions = ['(note-1)', 'note-1.', 'note-10', 'Note-1', 'pre-note-1', 'note-1-a', '_note-1', 'note-1_'];
  s.write(join(s.repo, 'src/a.ts'), tagCode(mentions.map(id => `choose ${id} because names are exact`)));
  s.commit('Add non-ADR boundary cases'); const result = s.build(linkFiles(s)); ok(result); assert.equal(result.stderr, '');
  assert.deepEqual(namedSymbols(s), [{ name: 'f0', record: 'note-1' }, { name: 'f1', record: 'note-1' }]);
  for (let i = 0; i < mentions.length; i++) assert.deepEqual(ids(ok(s.cli(['why', `src/a.ts:f${i}`]))), i < 2 ? ['note-1'] : []);
});
contract('L4', 'unknown ADR names warn for symbol and header carriers, non-ADR text does not', 'empty', s => {
  s.write(join(s.repo, 'src/a.ts'), '/** module: [[link-a]] */\n\n/** decided: choose ADR-0009 because it is absent */\nexport function f() { return 1; }\n');
  s.write(join(s.repo, 'src/b.ts'), '/**\n * module: [[link-b]]\n * decided: choose ADR-0009 because it is absent in the header\n */\nexport function g() { return 2; }\n');
  s.write(join(s.repo, 'src/c.ts'), tagCode(['choose missing-note because non-ADR ids cannot be discovered']));
  s.commit('Add unknown names'); const result = s.build(linkFiles(s)); ok(result);
  const warnings = result.stderr.trim().split('\n');
  assert.deepEqual(warnings, [
    'warning: decided tag on src/a.ts:f names ADR-0009, which no record has; no link',
    'warning: decided tag on src/b.ts names ADR-0009, which no record has; no link',
  ]);
  assert.equal(query(s, 'MATCH ()-[r:NAMES]->() RETURN count(r) AS n')[0].n, 0);
});
contract('L5', 'multiple tags and repeated names list each direct record once in date and id order', 'empty', s => {
  s.write(join(s.repo, 'src/a.ts'), '/** module: [[link-fixture]] */\n\n/**\n * decided: choose adr-0004 because it is the ADR\n * decided: choose note-1 because it is a note\n * decided: choose ADR-0004 and note-1 because both matter\n */\nexport function f() { return 1; }\n');
  s.commit('Add repeated direct names');
  ok(s.build(linkFiles(s, { adrDate: '2026-01-03', noteDate: '2026-01-01' })));
  let text = ok(s.cli(['why', 'src/a.ts:f'])); has(text, 'Decision records that its decided: tags name:');
  assert.deepEqual(ids(text), ['note-1', 'ADR-0004']); assert.deepEqual(ids(whyParts(text).direct), ['note-1', 'ADR-0004']);
  assert.equal(namedSymbols(s).length, 4);
  ok(s.build(linkFiles(s, { adrDate: '2026-01-03', noteDate: '2026-01-03' })));
  text = ok(s.cli(['why', 'src/a.ts:f'])); assert.deepEqual(ids(text), ['ADR-0004', 'note-1']);
});
contract('L6', 'header names reach every symbol after its own doc-comment names', 'empty', s => {
  s.write(join(s.repo, 'src/a.ts'), '/**\n * module: [[link-fixture]]\n * decided: choose ADR-0004 because the file shares this rule\n */\n\n/** decided: choose note-1 because this symbol has its own choice */\nexport function f() { return 1; }\n\nexport function g() { return 2; }\n');
  s.commit('Add header and doc-comment links'); ok(s.build(linkFiles(s, { noteDate: '2099-01-01' })));
  const text = ok(s.cli(['why', 'src/a.ts:f'])); assert.deepEqual(ids(text), ['note-1', 'ADR-0004']);
  ordered(text, ['named by: a decided: tag in its doc comment', 'named by: a decided: tag in the header of src/a.ts']);
  const other = ok(s.cli(['why', 'src/a.ts:g'])); assert.deepEqual(ids(other), ['ADR-0004']);
  has(other, 'named by: a decided: tag in the header of src/a.ts');
  has(ok(s.cli(['impact', 'ADR-0004'])), '1 file whose header decided: tag names it: src/a.ts');
});
contract('L7', 'a record reached by tag and commit appears once with both link reasons', 'fixture', s => {
  const text = ok(s.cli(['why', tax]));
  assert.equal(ids(text).filter(id => id === 'ADR-0003').length, 1);
  const parts = whyParts(text); assert.ok(ids(parts.direct).includes('ADR-0003')); assert.ok(!ids(parts.loose).includes('ADR-0003'));
  has(parts.direct, 'named by: a decided: tag in its doc comment', 'also cited by: 78884f0');
});
contract('L8', 'unknown trailer values warn with their commit and do not link', 'code', s => {
  const sha = s.commit('Unknown trailer\n\nDecision: note-9');
  const result = s.build(linkFiles(s)); ok(result);
  assert.equal(result.stderr, `warning: commit ${sha.slice(0, 7)}: trailer "Decision: note-9" names no record; no link\n`);
  assert.equal(query(s, 'MATCH ()-[r:CITES]->() RETURN count(r) AS n')[0].n, 0);
});
contract('L9', 'two Decision trailers cite the same commit from both records', 'code', s => {
  const sha = s.commit('Two citations\n\nDecision: ADR-0004\nDecision: note-1');
  const result = s.build(linkFiles(s)); ok(result); assert.equal(result.stderr, '');
  for (const id of ['ADR-0004', 'note-1']) assert.deepEqual(citedCommits(s, id), [sha]);
});
contract('L10', 'trailer values require exact ids while trailer keys ignore case', 'code', s => {
  const values = ['ADR-4', 'ADR 0004', 'adr-0004', '0004'];
  const bad = s.commit(`Wrong values\n\n${values.map(value => `Decision: ${value}`).join('\n')}`);
  s.write(join(s.repo, 'src/code.ts'), 'export function f() { return 2; }\n');
  const good = s.commit('Lowercase trailer key\n\ndecision: ADR-0004');
  const result = s.build(linkFiles(s)); ok(result);
  assert.deepEqual(result.stderr.trim().split('\n'), values.map(value => `warning: commit ${bad.slice(0, 7)}: trailer "Decision: ${value}" names no record; no link`).sort());
  assert.deepEqual(citedCommits(s, 'ADR-0004'), [good]); assert.deepEqual(citedCommits(s, 'note-1'), []);
});
contract('L11', 'a Decision line before the last paragraph is ordinary text', 'code', s => {
  s.commit('An ordinary message\n\nDecision: ADR-0004\n\nThis final paragraph is prose, not a trailer.');
  const result = s.build(linkFiles(s)); ok(result); assert.equal(result.stderr, '');
  assert.equal(query(s, 'MATCH ()-[r:CITES]->() RETURN count(r) AS n')[0].n, 0);
});
contract('L12', 'free-text ADR and filename mentions do not link the code they change', 'empty', s => {
  const a = adr(s, { '0004-x.md': heading(4, 'Date: 2026-01-01') }); const added = s.commit('Add the ADR alone');
  const mentions = ['ADR 0004', 'ADR-0004', '0004-x.md']; const free = [];
  for (const [i, mention] of mentions.entries()) {
    s.write(join(s.repo, 'src/code.ts'), `export function f() { return ${i}; }\n`);
    free.push(s.commit(`Consider ${mention} while editing code`));
  }
  const converted = JSON.parse(ok(a.result())).records; assert.deepEqual(converted[0].commits, [added]);
  ok(s.build([s.decisions(converted), s.decisions([record('note-1')], 'notes.json')]));
  assert.deepEqual(citedCommits(s, 'ADR-0004'), [added]);
  for (const sha of free) assert.equal(query(s, `MATCH ()-[r:CITES]->(:Commit {sha: '${sha}'}) RETURN count(r) AS n`)[0].n, 0);
  const text = ok(s.cli(['why', 'src/code.ts:f'])); assert.deepEqual(ids(text), []);
  has(text, 'No decision is recorded for it.');
});
contract('L13', 'a listed commit with a matching trailer yields one CITES edge', 'code', s => {
  const sha = s.commit('Listed and trailered\n\nDecision: ADR-0004');
  ok(s.build(linkFiles(s, { commits: [sha] })));
  assert.deepEqual(citedCommits(s, 'ADR-0004'), [sha]); assert.equal(citeCount(s, 'ADR-0004'), 1);
});
contract('L14', 'loose links expose the number of symbols a large commit changed', 'fixture', s => {
  const why = ok(s.cli(['why', 'src/tax.ts:taxOf']));
  has(why, 'changed by: 395b8c0 2026-01-08 Name every amount by its unit; that commit changed 5 symbols');
  const impact = ok(s.cli(['impact', 'ADR-0001']));
  has(impact, '395b8c0 2026-01-08 Name every amount by its unit; it changed 5 symbols');
});
contract('L15', 'two independently generated fixtures and their rebuilds have identical links and answers', 'fixture-unbuilt', s => {
  const other = join(s.dir, 'second-fixture'); ok(s.run('/bin/bash', [join(h.root, 'scripts/fixture.sh'), other], s.dir));
  const history = cwd => ok(s.run('git', ['log', '--format=%H'], cwd));
  assert.equal(history(s.repo), history(other)); assert.equal(ok(s.run('git', ['rev-parse', '--short=7', 'HEAD'], other)).trim(), '17078bb');
  const snapshots = [];
  for (const cwd of [s.repo, other]) {
    s.write(join(cwd, 'adrs.json'), ok(s.cli(['decisions', 'adr', 'docs/adr'], { cwd })));
    const store = join(ok(s.run('git', ['rev-parse', '--absolute-git-dir'], cwd)).trim(), 'whygraph/store');
    for (let rebuild = 0; rebuild < 2; rebuild++) {
      const result = s.cli(['build', '--decisions', 'adrs.json', '--decisions', 'decisions/notes.json'], { cwd }); ok(result);
      const warnings = result.stderr.trim() === '' ? [] : result.stderr.trim().split('\n'); assert.deepEqual(warnings, [...warnings].sort());
      snapshots.push({
        warnings,
        names: query(s, 'MATCH (t:DecidedTag)-[:NAMES]->(d:Decision) RETURN t.hash AS hash, d.id AS id ORDER BY hash, id', store),
        cites: query(s, 'MATCH (d:Decision)-[:CITES]->(k:Commit) RETURN d.id AS id, k.sha AS sha ORDER BY id, sha', store),
        why: ok(s.cli(['why', tax], { cwd })), impact: ok(s.cli(['impact', 'ADR-0001'], { cwd })),
      });
    }
  }
  assert.equal(snapshots[0].names.length, 3); assert.equal(snapshots[0].cites.length, 7);
  for (const snapshot of snapshots.slice(1)) assert.deepEqual(snapshot, snapshots[0]);
});

contract('E1', 'answers are byte-identical before and after identical rebuilds', 'fixture', s => {
  const commands = [['why', tax], ['impact', 'ADR-0002'], ['carry', money], ['mcp'], ['decisions', 'adr', 'docs/adr']];
  const before = commands.map(args => ok(s.cli(args)));
  assert.deepEqual(commands.map(args => ok(s.cli(args))), before);
  const first = s.build(); ok(first); const second = s.build(); ok(second);
  assert.equal(first.stderr, second.stderr);
  assert.deepEqual(commands.map(args => ok(s.cli(args))), before);
  const warnings = s.decisions([record('Z', { commits: ['HEAD'], restsOn: ['not-there'] }), record('A', { commits: ['123'] })], 'warnings.json');
  const a = s.build([warnings]); const b = s.build([warnings]); ok(a); ok(b);
  assert.equal(a.stderr, b.stderr);
  const lines = a.stderr.trim().split('\n'); assert.deepEqual(lines, [...lines].sort());
});
contract('E2', 'bad command-line arguments name the argument and print usage', 'empty', s => {
  const cases = [
    [['unknown-command'], 'unknown-command'], [['build', '--bad-option'], '--bad-option'],
    [['build', '--repo', s.repo, '--repo', s.repo], '--repo'], [['build', '--store'], '--store'],
    [['why', money, 'extra'], 'extra'], [['why', money, '--decisions', 'records.json'], '--decisions'],
  ];
  for (const [args, bad] of cases) { const text = failure(s.cli(args), 2, bad); assert.match(text, /[Uu]sage/); }
});
contract('E3', 'help, --help and no arguments print usage successfully', 'empty', s => {
  for (const args of [['help'], ['--help'], []]) assert.match(ok(s.cli(args)), /[Uu]sage/);
});
contract('E4', 'every relate invocation disables telemetry', 'fixture-unbuilt', s => {
  const log = join(s.dir, 'relate-env.jsonl');
  const real = resolve(process.env.HOME, '.local/bin/relate');
  const body = `
import { appendFileSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
appendFileSync(${JSON.stringify(log)}, JSON.stringify({ args: process.argv.slice(2), telemetry: process.env.RELATE_TELEMETRY, dnt: process.env.DO_NOT_TRACK })+'\\n');
const r = spawnSync(${JSON.stringify(real)}, process.argv.slice(2), { input: readFileSync(0), env: process.env });
process.stdout.write(r.stdout ?? ''); process.stderr.write(r.stderr ?? ''); process.exit(r.status ?? 1);`;
  const env = s.wrapper('relate', body);
  const adrs = s.write(join(s.dir, 'adrs.json'), ok(s.cli(['decisions', 'adr', 'docs/adr'])));
  ok(s.build([adrs, join(s.repo, 'decisions/notes.json')], { env }));
  for (const args of [['why', tax], ['impact', 'ADR-0002'], ['carry', money]]) ok(s.cli(args, { env }));
  const calls = readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse); assert.ok(calls.length >= 4);
  for (const call of calls) { assert.equal(call.telemetry, '0'); assert.equal(call.dnt, '1'); }
});
contract('E5', 'an unreadable store reports the real relate error and exit status', 'fixture', s => {
  const damaged = s.write(join(s.dir, 'damaged.rl'), 'This is not a relate database bundle.\n');
  const result = s.cli(['why', tax, '--store', damaged]);
  assert.match(failure(result, 1), /relate query failed \(exit \d+\): .+/);
  // Also verify that an unusual downstream status and message survive intact.
  const env = s.wrapper('relate', "console.error('damaged store deliberate failure'); process.exit(23);");
  failure(s.cli(['why', tax], { env }), 1, 'relate query failed (exit 23):', 'damaged store deliberate failure');
});

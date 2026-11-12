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
  initial: 'b8dc7c94300edb3ae9749fe1ca31fdc51b593768',
  tax: '1c8e848830160ceb20e05bd349b469be28e0272d',
  regional: 'd6d2473afbbf12dcad97dd8db864bda36b3a6f8d',
  format: '21c643d0a8c606be6139580e1d37fd4fe814ff8c',
};
function contract(id, description, mode, body) {
  test(`${id} ${description}`, { timeout: 120_000 }, async t => body(state(t, mode), t));
}
function query(s, cypher) {
  const parsed = JSON.parse(ok(s.run('relate', ['--database', s.store, '--read-only', '--json', '-c', cypher])));
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
function adr(s, files) {
  const folder = join(s.repo, 'docs/adr');
  for (const [name, text] of Object.entries(files)) s.write(join(folder, name), text);
  return { folder, result: () => s.cli(['decisions', 'adr', folder]) };
}
const heading = (n, extra = '') => `# ADR ${n}: Choice ${n}\n\n${extra}\n\n## Choice\n\nKeep it simple.\n`;

contract('A1', 'fixture ADR records, metadata and full cited commits', 'fixture-unbuilt', s => {
  const result = s.cli(['decisions', 'adr', 'docs/adr']);
  const records = JSON.parse(ok(result)).records;
  assert.equal(result.stderr, '');
  assert.deepEqual(records.map(r => r.id), ['ADR-0001', 'ADR-0002', 'ADR-0003']);
  assert.deepEqual(records.map(r => r.commits), [[full.format, full.initial], [full.tax], [full.regional]]);
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
  for (const [label, n] of Object.entries({ Commit: 7, DecidedTag: 3, Decision: 5, File: 4, Item: 8, Symbol: 6, Topic: 4, CHANGES: 14, CITES: 6, SUPERSEDES: 1, RESTS_ON: 4, USES: 4 })) countLine(text, label, n);
  has(text, '0 warnings');
});
contract('A3', 'taxRate tags and records in chronological order', 'fixture', s => {
  const text = ok(s.cli(['why', tax]));
  ordered(text, ['the rate depends on the region', 'tax lives apart from the cart', '2026-01-02  ADR-0002', '2026-01-02  note-1', '2026-01-03  ADR-0003']);
  assert.deepEqual(ids(text), ['ADR-0002', 'note-1', 'ADR-0003']);
  has(text, 'superseded by: ADR-0003', 'changed by: 1c8e848', 'changed by: d6d2473');
});
contract('A4', 'taxOf is not linked to the regional change', 'fixture', s => {
  const text = ok(s.cli(['why', 'src/tax.ts:taxOf']));
  assert.deepEqual(ids(text), ['ADR-0002', 'note-1']); assert.ok(!text.includes('changed by: d6d2473'));
});
contract('A5', 'impact traverses premises and counts distinct symbols', 'fixture', s => {
  const text = ok(s.cli(['impact', 'ADR-0002']));
  has(text, 'The decision itself: ADR-0002', 'superseded by: ADR-0003', 'Rests on it directly: note-1', 'through 1 other record: note-2', '3 distinct symbols in all.');
  assert.match(text, /1 user\s+src\/tax.ts:taxRate/); assert.match(text, /0 users\s+src\/tax.ts:taxOf/);
  assert.match(text, /1 user\s+src\/money.ts:formatCents/);
});
contract('A6', 'a superseding record still rests on ADR-0001', 'fixture', s => {
  const text = ok(s.cli(['impact', 'ADR-0001']));
  has(text, 'The decision itself: ADR-0001', 'b8dc7c9', '21c643d', 'Rests on it directly: ADR-0002', 'Rests on it directly: ADR-0003', 'through 1 other record: note-1', 'through 2 other records: note-2');
});
contract('A7', 'carry cents has its topic, no check and two direct users', 'fixture', s => {
  const text = ok(s.cli(['carry', money]));
  has(text, 'fx-money: no other file owns it', 'No formal check covers it.');
  assert.match(text, /^\s+1\s+src\/cart.ts:total$/m); assert.match(text, /^\s+1\s+src\/tax.ts:taxOf$/m);
});
contract('A8', 'carry formatCents lists newest commits and both records', 'fixture', s => {
  const text = ok(s.cli(['carry', 'src/money.ts:formatCents']));
  assert.deepEqual(ids(text), ['ADR-0001', 'note-2']);
  const commits = text.slice(text.indexOf('2 commits changed'));
  ordered(commits, ['21c643d', 'b8dc7c9']); has(text, 'changed by: b8dc7c9', '21c643d');
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
contract('B4', 'no decisions option loads no decision records', 'fixture-unbuilt', s => {
  ok(s.build([])); assert.equal(query(s, 'MATCH (d:Decision) RETURN count(d) AS n')[0].n, 0);
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
contract('B12', 'restsOn cycles terminate with the base once at depth zero', 'fixture-unbuilt', s => {
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
  const merge = graph.nodes.find(n => n.kind === 'commit' && n.name.startsWith('81ce56b'));
  assert.ok(merge);
  const changed = graph.edges.filter(e => e.kind === 'changes' && e.from === merge.id).map(e => {
    const node = graph.nodes.find(n => n.id === e.to); return node.name;
  }).sort();
  const rows = query(s, "MATCH (k:Commit {short: '81ce56b'})-[:CHANGES]->(n) RETURN n.path AS path, n.id AS id");
  assert.deepEqual(rows.map(r => r.id ?? r.path).sort(), changed);
  assert.equal(query(s, "MATCH (:Decision)-[r:CITES]->(:Commit {short: '81ce56b'}) RETURN count(r) AS n")[0].n, 0);
  ok(s.build([s.decisions([record('merge', { commits: ['81ce56b'] })])])); assert.equal(citeCount(s, 'merge'), 1);
});
contract('B29', 'a deleted symbol leaves no node or CHANGES target', 'code', s => {
  const changed = s.commit('Add f');
  s.write(join(s.repo, 'src/code.ts'), 'export function surviving() { return 2; }\n'); s.commit('Remove f, keep its file');
  ok(s.build([s.decisions([record('deleted', { commits: [changed] })])]));
  assert.equal(query(s, "MATCH (s:Symbol {id: 'src/code.ts#f'}) RETURN count(s) AS n")[0].n, 0);
  assert.equal(query(s, `MATCH (:Commit {sha: '${changed}'})-[:CHANGES]->(s:Symbol) RETURN count(s) AS n`)[0].n, 0);
  has(ok(s.cli(['impact', 'deleted'])), 'Its cited commits changed no symbol that exists now, or it cites no commit in this repo\'s history.');
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
contract('D13', 'ADR history follows its rename', 'empty', s => {
  const a = adr(s, { '0004-old.md': heading(4) }); const initial = s.commit('Create a choice');
  s.git('mv', 'docs/adr/0004-old.md', 'docs/adr/0004-new.md'); const renamed = s.commit('Rename the choice');
  assert.deepEqual(JSON.parse(ok(a.result())).records[0].commits, [renamed, initial]);
});
contract('D14', 'ADR message and filename references match with number boundaries', 'code', s => {
  const a = adr(s, { '0004-x.md': heading(4) }); const initial = s.commit('Create the choice');
  s.git('commit', '-q', '--allow-empty', '-m', 'see ADR 4'); const message = s.git('rev-parse', 'HEAD').trim();
  s.git('commit', '-q', '--allow-empty', '-m', 'See 0004-x.md'); const filename = s.git('rev-parse', 'HEAD').trim();
  s.git('commit', '-q', '--allow-empty', '-m', 'See ADR 40'); const wrong = s.git('rev-parse', 'HEAD').trim();
  const commits = JSON.parse(ok(a.result())).records[0].commits;
  assert.deepEqual(commits, [filename, message, initial]); assert.ok(!commits.includes(wrong));
});
contract('D15', 'ADR conversion is byte deterministic', 'fixture-unbuilt', s => {
  assert.equal(ok(s.cli(['decisions', 'adr', 'docs/adr'])), ok(s.cli(['decisions', 'adr', 'docs/adr'])));
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
contract('W12', 'a symbol without tags or records has three empty parts', 'code', s => {
  ok(s.build([])); const text = ok(s.cli(['why', 'src/code.ts:f']));
  has(text, 'Its doc comment holds no decided: tag.', 'holds no decided: tag.', 'No decision record cites a commit');
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

for (const [id, target] of [['I1', 'ADR-4'], ['I2', 'adr-0004']]) {
  contract(id, 'decision ids match exactly and suggest the closest id', 'fixture-unbuilt', s => {
    ok(s.build([s.decisions([record('ADR-0004')])])); failure(s.cli(['impact', target]), 3, 'ADR-0004');
  });
}
contract('I3', 'records without symbol changes print the empty explanation', 'fixture-unbuilt', s => {
  ok(s.build([s.decisions([record('no-cites'), record('no-changes', { commits: ['6821866'] })])]));
  for (const id of ['no-cites', 'no-changes']) has(ok(s.cli(['impact', id])), 'Its cited commits changed no symbol that exists now, or it cites no commit in this repo\'s history.');
});
contract('I4', 'symbols reached through multiple records count once', 'fixture', s => {
  const text = ok(s.cli(['impact', 'ADR-0002']));
  assert.equal((text.match(/\d+ user[s]?\s+src\/tax.ts:taxRate/g) ?? []).length, 2);
  assert.equal((text.match(/\d+ user[s]?\s+src\/tax.ts:taxOf/g) ?? []).length, 2);
  has(text, '3 distinct symbols in all.');
});

contract('M1', 'printed MCP config is read-only and includes every recipe', 'fixture', s => {
  const { server, recipes } = h.config(ok(s.cli(['mcp'])));
  assert.equal(server.command, 'relate');
  assert.deepEqual(server.args, ['serve', '--mcp', 'stdio', '--database', s.store, '--read-only']);
  assert.deepEqual(server.env, { RELATE_TELEMETRY: '0', DO_NOT_TRACK: '1' });
  assert.deepEqual([...recipes.keys()].sort(), ['carry', 'impact', 'names', 'users', 'why']);
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
  assert.deepEqual(rows.filter(row => row.kind === 'record').map(row => row.id), ['ADR-0002', 'note-1', 'ADR-0003']);
  has(rows[0].what, 'the rate depends on the region'); has(rows[1].what, 'tax lives apart from the cart');
  assert.deepEqual(rows[2].supersededBy, ['ADR-0003']);
  for (const [i, sha] of [[2, '1c8e848'], [3, '1c8e848'], [4, 'd6d2473']]) {
    assert.equal(rows[i].via.length, 1); assert.ok(rows[i].via[0].startsWith(sha));
  }
  const cli = ok(s.cli(['why', tax]));
  for (const row of rows) { has(cli, row.what); if (row.kind === 'record') has(cli, row.id, ...row.via); }
});
contract('M4', 'MCP requires an existing store', 'fixture-unbuilt', s => {
  failure(s.cli(['mcp']), 1, `no store at ${s.store}; run whygraph build first`);
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

/** Independent contracts from ADRs 0005/0006 and failures B30-B36, W21-W29, I6. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readlinkSync } from 'node:fs';
import { join } from 'node:path';
import { harness as h } from './support.mjs';

const { ok, has, failure, ids, record } = h;
const target = 'src/order.ts:s';
const symbol = 'src/order.ts#s';
const looseHeading = 'Decision records linked only through a commit that cites them and changed its code or tags, tightest commit first (a commit that changed many symbols links each of them loosely):';
function contract(group, description, mode, body) {
  test(`${group} ${description}`, { timeout: 120_000 }, async t => body(h.state(t, mode), t));
}
function query(s, statement, parameters = {}) {
  const bind = Object.entries(parameters).flatMap(([key, value]) => ['--param', `${key}=${JSON.stringify(value)}`]);
  return JSON.parse(ok(s.run('relate', ['--database', s.store, '--read-only', '--json', ...bind, '-c', statement]))).data;
}
function whyBody(text) {
  // carry prefixes a symbol heading; stop before its subsequent sections.
  const start = text.search(/^(?:Its doc comment holds|Decided in its doc comment:)/m);
  assert.ok(start >= 0, text);
  const rest = text.slice(start);
  const end = rest.search(/\n(?:One step away|Topics|No topic|No formal|Formal|Decision records that share)/);
  return (end < 0 ? rest : rest.slice(0, end)).trimEnd();
}
function blocks(text) {
  return new Map([...text.matchAll(/^  (?:\d{4}-\d{2}-\d{2}|undated   )  (\S+)  [^\n]*(?:\n      [^\n]*)*/gm)].map(m => [m[1], m[0]]));
}
function ordered(text, values) {
  let previous = -1;
  for (const value of values) {
    const at = text.indexOf(value, previous + 1);
    assert.ok(at > previous, `Expected ${values.join(' -> ')} in:\n${text}`); previous = at;
  }
}
function commitAt(s, day, message) {
  s.git('add', '-A');
  const date = `2026-01-${String(day).padStart(2, '0')}T12:00:00Z`;
  ok(s.run('git', ['commit', '-q', '-m', message], s.repo, { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date }));
  return s.git('rev-parse', 'HEAD').trim();
}
function ordering(s, named = false) {
  const values = Array(9).fill(0);
  const code = () => '/** module: [[order-fixture]]' + (named ? '\n * decided: follow R-header because the header governs it' : '') + '\n */\n\n' + values.map((v, i) =>
    (i === 0 && named ? '/** decided: follow R because the symbol states it */\n' : '') + `export function ${i === 0 ? 's' : `x${i}`}() { return ${v}; }\n`).join('\n');
  const change = (n, day, message) => {
    for (let i = 0; i < n; i++) values[i]++;
    s.write(join(s.repo, 'src/order.ts'), code()); return commitAt(s, day, message);
  };
  s.write(join(s.repo, 'src/order.ts'), code());
  const nine = commitAt(s, 1, 'Nine symbols\n\nDecision: R');
  const seven = change(7, 2, 'Seven symbols\n\nDecision: R-many');
  const three = change(3, 3, 'Three symbols\n\nDecision: R-a\nDecision: R-b\nDecision: R-undated\nDecision: Z-earlier\nDecision: A-later\nDecision: R-two');
  // Two same-day commits and an earlier one exercise commit date and SHA ties.
  const twoEarly = change(2, 4, 'Two symbols early\n\nDecision: R\nDecision: R-one');
  const twoA = change(2, 5, 'Two symbols A\n\nDecision: R\nDecision: R-one');
  const twoB = change(2, 5, 'Two symbols B\n\nDecision: R\nDecision: R-one');
  const one = change(1, 6, 'One symbol\n\nDecision: R-tight' + (named ? '\nDecision: R' : ''));
  const records = [
    record('R-many', { date: '2000-01-01' }), record('R', { date: '2026-01-01' }),
    record('R-one'), record('R-a', { date: '2026-01-02' }), record('R-b', { date: '2026-01-02' }),
    record('R-undated', { date: null }), record('Z-earlier', { date: '2025-01-01' }),
    record('A-later', { date: '2027-01-01' }), record('R-two', { date: '2026-02-01' }),
    record('R-tight', { date: '2099-01-01' }), ...(named ? [record('R-header', { date: '1900-01-01' })] : []),
  ];
  const file = s.decisions(records); ok(s.build([file]));
  const rangeLine = code().split('\n').findIndex(line => line.startsWith('export function s')) + 1;
  return { file, range: `src/order.ts:${rangeLine}-${rangeLine}`, nine, seven, three, twoEarly, twoA, twoB, one };
}

contract('W21 W22 W23 W25 W26 W27', 'tightest linking commit ranks real records, commit ties and MCP rows deterministically', 'empty', async (s, t) => {
  const f = ordering(s);
  const expected = ['R-tight', 'R', 'R-one', 'Z-earlier', 'R-a', 'R-b', 'R-two', 'A-later', 'R-undated', 'R-many'];
  const commands = [['why', target], ['carry', target], ['carry', f.range]];
  const answers = commands.map(args => ok(s.cli(args)));
  const why = whyBody(answers[0]);
  for (const answer of answers) {
    assert.equal(whyBody(answer), why); has(answer, looseHeading);
    assert.deepEqual(ids(whyBody(answer)), expected);
  }
  const r = blocks(why).get('R');
  const twoTies = [f.twoA, f.twoB].sort();
  ordered(r, [f.twoEarly, ...twoTies, f.nine].map(sha => sha.slice(0, 7)));
  for (const [id, sha, n] of [['R-tight', f.one, 1], ['R-one', f.twoEarly, 2], ['R-many', f.seven, 7], ['R-a', f.three, 3]]) {
    has(blocks(why).get(id), `${sha.slice(0, 7)} 2026-01-`, `that commit changed ${n} symbol${n === 1 ? '' : 's'}`);
  }
  const client = await h.mcp(t, s);
  const rows = (await client.rows(client.recipes.get('why'), { symbol })).filter(r => r.kind === 'record');
  assert.deepEqual(rows.map(r => r.id), expected);
  assert.deepEqual(rows.map(r => r.via[0].symbols), [1, 2, 2, 3, 3, 3, 3, 3, 3, 7]);
  assert.deepEqual(rows.find(r => r.id === 'R').via.map(v => v.symbols), [2, 2, 2, 9]);
  assert.deepEqual(Object.keys(rows[0]).sort(), ['rank', 'kind', 'id', 'date', 'what', 'because', 'status', 'author', 'source', 'named', 'via', 'supersededBy'].sort());
  assert.deepEqual(commands.map(args => ok(s.cli(args))), answers);
  ok(s.build([f.file]));
  assert.deepEqual(commands.map(args => ok(s.cli(args))), answers);
});

contract('W24', 'doc and header named records retain priority and tightest also-cited lines without duplication', 'empty', s => {
  const f = ordering(s, true); const text = ok(s.cli(['why', target]));
  const [direct, loose] = text.split(looseHeading);
  assert.deepEqual(ids(direct), ['R', 'R-header']);
  assert.deepEqual(ids(loose), ['R-tight', 'R-one', 'Z-earlier', 'R-a', 'R-b', 'R-two', 'A-later', 'R-undated', 'R-many']);
  has(blocks(direct).get('R'), 'named by: a decided: tag in its doc comment', `also cited by: ${f.one.slice(0, 7)}`, 'that commit changed 1 symbol');
  has(blocks(direct).get('R-header'), 'named by: a decided: tag in the header of src/order.ts');
  ordered(blocks(direct).get('R'), [f.one, f.twoEarly, ...[f.twoA, f.twoB].sort(), f.nine].map(sha => sha.slice(0, 7)));
  assert.equal(ids(text).filter(id => id === 'R').length, 1);
});

contract('B30 B31 B32 B35 B36', 'authors and absent/null authors persist independently across decisions files', 'code', s => {
  s.commit('Code for author records');
  const files = [
    s.decisions([record('a', { author: 'R. Chen' }), record('absent')], 'first.json'),
    s.decisions([record('b', { author: 'A. Lee' }), record('explicit-null', { author: null })], 'second.json'),
  ];
  const built = s.build(files); ok(built); assert.equal(built.stderr, '');
  assert.deepEqual(query(s, 'MATCH (d:Decision) RETURN d.id AS id, d.author AS author ORDER BY id'), [
    { id: 'a', author: 'R. Chen' }, { id: 'absent', author: null }, { id: 'b', author: 'A. Lee' }, { id: 'explicit-null', author: null },
  ]);
  for (const id of ['absent', 'explicit-null']) assert.doesNotMatch(ok(s.cli(['impact', id])), /author:/);
  const adr = join(s.repo, 'docs/adr/0001-test.md');
  s.write(adr, '# ADR 0001: No attributed author\n\nDate: 2026-01-01\n\n## Choice\n\nKeep it simple.\n');
  assert.equal(JSON.parse(ok(s.cli(['decisions', 'adr', 'docs/adr']))).records[0].author, null);
});

for (const [group, values, diagnostic] of [
  ['B33', ['', '   '], '"author" must not be empty'],
  ['B34', [7, ['x']], '"author" must be a string or null'],
]) {
  contract(group, 'invalid authors report every file/index/id and preserve the previous store', 'code', s => {
    const sha = s.commit('Previous author store');
    const good = s.decisions([record('good', { author: 'R. Chen', commits: [sha] })], 'good.json'); ok(s.build([good]));
    const before = ok(s.cli(['why', 'src/code.ts:f'])); const link = readlinkSync(s.store);
    const bad = s.decisions(values.map((author, i) => record(`bad-${i}`, { author })), 'bad.json');
    const result = s.build([bad]); failure(result, 1);
    assert.deepEqual(result.stderr.trimEnd().split('\n'), ['whygraph: decisions files rejected; the store is unchanged:', ...values.map((_, i) => `${bad}: record ${i} (bad-${i}): ${diagnostic}`)]);
    assert.equal(result.stdout, ''); assert.equal(readlinkSync(s.store), link);
    assert.equal(ok(s.cli(['why', 'src/code.ts:f'])), before);
  });
}

contract('W28 W29 I6', 'author placement is exact in named and commit-only answers while neighbors and terms stay compact', 'empty', s => {
  const source = named => '/** module: [[author-fixture]] */\nimport { neighbor } from "./neighbor.ts";\n' +
    (named ? '/** decided: follow R because it governs this symbol */\n' : '') + 'export function s() { return neighbor() + "quartz"; }\n';
  s.write(join(s.repo, 'src/order.ts'), source(true));
  s.write(join(s.repo, 'src/neighbor.ts'), '/** decided: follow N because this neighbor owns it */\nexport function neighbor() { return 1; }\n');
  const sha = s.commit('Record author links');
  const records = [record('R', { title: 'Root', status: 'accepted', author: 'R. Chen', source: 'root-source', commits: [sha] }),
    record('S', { title: 'Successor', restsOn: ['R'], supersedes: ['R'], commits: [sha] }),
    record('N', { title: 'Neighbor', author: 'Neighbor Private' }), record('T', { title: 'quartz', author: 'Term Private' }),
    ...Array.from({ length: 12 }, (_, i) => record(`filler-${i}`, { title: 'neutral filler' }))];
  const file = s.decisions(records);
  for (const named of [true, false]) {
    s.write(join(s.repo, 'src/order.ts'), source(named));
    if (!named) s.commit('Remove direct record tag');
    ok(s.build([file]));
    const line = source(named).trimEnd().split('\n').length;
    for (const args of [['why', target], ['carry', target], ['carry', `src/order.ts:${line}-${line}`]]) {
      const answer = ok(s.cli(args)); const body = whyBody(answer); const r = blocks(body).get('R');
      has(r, '      status: accepted\n      author: R. Chen\n      superseded by: S\n      source: root-source');
      assert.equal((body.match(/author:/g) ?? []).length, 1);
      assert.doesNotMatch(blocks(body).get('S'), /author:/);
      has(r, named ? 'named by: a decided: tag in its doc comment' : 'changed by:');
      if (args[0] === 'carry') {
        const oneStep = answer.slice(answer.indexOf('One step away'));
        has(oneStep, 'N (2026-01-01) Neighbor');
        const terms = answer.slice(answer.indexOf('Decision records that share the most distinctive terms'));
        assert.ok(ids(terms).includes('T'), terms);
        assert.doesNotMatch(oneStep, /author:|Neighbor Private|Term Private/);
      }
    }
  }
  const impact = ok(s.cli(['impact', 'R']));
  has(impact, 'The decision itself: R (2026-01-01) Root\n  author: R. Chen\n  superseded by: S');
  has(impact, 'Rests on it directly: S (2026-01-01) Successor\n');
  assert.equal((impact.match(/author:/g) ?? []).length, 1);
  const { recipes } = h.config(ok(s.cli(['mcp'])));
  assert.deepEqual(query(s, recipes.get('impact'), { decision: 'R' }).map(r => [r.record, r.author]), [['R', 'R. Chen'], ['S', null]]);
  assert.equal(query(s, recipes.get('carry'), { symbol })[0].neighbors.find(n => n.symbol === 'src/neighbor.ts#neighbor').tags[0].records[0].author, 'Neighbor Private');
  assert.equal(query(s, recipes.get('terms'), { terms: ['quartz'] }).find(r => r.id === 'T').author, 'Term Private');
});

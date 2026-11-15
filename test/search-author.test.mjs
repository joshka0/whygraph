/** Existing Q27 author checks retained from the removed optional-ranking suite. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { harness as h } from './support.mjs';

const { ok, ids, record } = h;
function contract(group, description, mode, body) {
  test(`${group} ${description}`, { timeout: 120_000 }, async t => body(h.state(t, mode), t));
}
function query(s, statement) {
  return JSON.parse(ok(s.run('relate', ['--database', s.store, '--read-only', '--json', '-c', statement]))).data;
}

contract('Q27', 'authors remain local recipe data and never enter search lines', 'code', async (s, t) => {
  s.commit('Public author search fixture');
  const records = Array.from({ length: 6 }, (_, i) => record(`author-${i}`, {
    title: `authorneedle policy ${i}`, author: 'R. Chen', source: `source-${i}`,
    items: [{ label: 'choice', text: `First statement ${i}\nPrivate second line` }],
  }));
  ok(s.build([s.decisions(records)]));
  const args = ['search', 'authorneedle']; const result = s.cli(args);
  const baseline = ok(result); assert.equal(result.stderr, '');
  assert.equal(ids(baseline).length, 6);
  const lines = baseline.trimEnd().split('\n');
  assert.equal(lines.length, 15);
  for (let i = 1; i < 13; i += 2) {
    assert.match(lines[i], /^  2026-01-01  author-\d  authorneedle policy \d$/);
    assert.match(lines[i + 1], /^      matched: (?:words|meaning|words and meaning); source: source-\d$/);
  }
  assert.doesNotMatch(baseline, /author:|R\. Chen/);
  const { recipes } = h.config(ok(s.cli(['mcp'])));
  const words = query(s, recipes.get('search').replaceAll('$text', JSON.stringify('authorneedle')));
  assert.equal(words.length, 6); assert.ok(words.every(r => r.author === 'R. Chen'));
  const vector = query(s, "MATCH (d:Decision {id: 'author-0'}) RETURN d.vector AS vector")[0].vector;
  const meaning = query(s, recipes.get('meaning').replaceAll('$vector', JSON.stringify(vector)));
  assert.equal(meaning.length, 6); assert.ok(meaning.every(r => r.author === 'R. Chen'));
});

/** Term contracts derived from failures T1-T28 and ADR 0002; public synthetic text only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { harness as h } from './support.mjs';

const { ok, has, failure, record, ids } = h;
const preload = join(h.root, 'test/search-offline.mjs');
h.env.NODE_OPTIONS = `${h.env.NODE_OPTIONS ?? ''} --import=${preload}`.trim();
const heading = 'Decision records that share the most distinctive terms with its code (candidates to pick from one list; not links: a shared word does not mean the record governs this symbol):';
const rangeHeading = 'Decision records that share the most distinctive terms with these lines (candidates to pick from one list; not links: a shared word does not mean the record governs these lines):';
function contract(id, description, mode, body) {
  test(`${id} ${description}`, { timeout: 120_000 }, async t => body(h.state(t, mode), t));
}
function query(s, statement, parameters = {}) {
  const bind = Object.entries(parameters).flatMap(([k, v]) => ['--param', `${k}=${JSON.stringify(v)}`]);
  return JSON.parse(ok(s.run('relate', ['--database', s.store, '--read-only', '--json', ...bind, '-c', statement]))).data;
}
function mutate(s, statement) { ok(s.run('relate', ['--database', s.store, '-c', statement])); }
function custom(s, records) {
  s.commit('Public term contract fixture');
  const file = s.decisions(records); ok(s.build([file])); return file;
}
function carry(s, target, extra = {}) { return ok(s.cli(['carry', target], extra)); }
function section(text) {
  const at = text.indexOf('Decision records that share the most distinctive terms');
  assert.ok(at >= 0, text);
  // The symbol form has users and commits below the term section; the range
  // form ends here. Stop at the first blank line after candidate rows.
  return text.slice(at).split('\n\n')[0];
}
function noScores(text) { assert.doesNotMatch(text, /\bscore\b|\bsimilarity\b|\b\d+\.\d+\b/i); }
function graph(s) {
  return {
    terms: query(s, 'MATCH (t:Term) RETURN t.text AS text, t.records AS records ORDER BY text'),
    edges: query(s, 'MATCH (d:Decision)-[m:MENTIONS]->(t:Term) RETURN d.id AS id, t.text AS term, m.count AS count ORDER BY id, term'),
    totals: query(s, 'MATCH (d:Decision) RETURN d.id AS id, d.termCount AS total ORDER BY id'),
  };
}
function recipe(s) { return h.config(ok(s.cli(['mcp']))).recipes.get('terms'); }

contract('T1', 'tokenization keeps whole identifiers including underscores, their parts and ordinary words', 'code', s => {
  custom(s, [record('words', { title: 'formatCents tax_rate the x 42' })]);
  assert.deepEqual(graph(s).terms.map(t => t.text), ['cents', 'format', 'formatcents', 'rate', 'tax', 'tax_rate', 'the']);
});
contract('T2', 'term frequency, document frequency and total length are distinct', 'code', s => {
  custom(s, [record('one', { title: 'alpha', source: 'sourceignored', items: [{ label: 'labelignored', text: 'alpha beta' }] }), record('two', { title: 'alpha gamma' })]);
  const g = graph(s);
  assert.deepEqual(g.terms, [{ text: 'alpha', records: 2 }, { text: 'beta', records: 1 }, { text: 'gamma', records: 1 }]);
  assert.deepEqual(g.edges, [{ id: 'one', term: 'alpha', count: 2 }, { id: 'one', term: 'beta', count: 1 }, { id: 'two', term: 'alpha', count: 1 }, { id: 'two', term: 'gamma', count: 1 }]);
  assert.deepEqual(g.totals, [{ id: 'one', total: 3 }, { id: 'two', total: 2 }]);
});
contract('T3 T10 T17', 'common terms disappear at ten documents, not nine, and cannot produce candidates', 'empty', s => {
  s.write(join(s.repo, 'a.ts'), 'export function alpha() { return "alpha"; }\n');
  const files = custom(s, [...Array.from({ length: 10 }, (_, i) => record(`a${i}`, { title: 'alpha' })), record('b', { title: 'beta' })]);
  assert.deepEqual(graph(s).terms, [{ text: 'beta', records: 1 }]);
  assert.deepEqual(graph(s).edges, [{ id: 'b', term: 'beta', count: 1 }]);
  assert.ok(graph(s).totals.every(r => r.total === 1), 'dropping nodes must retain record length');
  assert.deepEqual(query(s, recipe(s), { terms: ['alpha'] }), []);
  const text = carry(s, 'a.ts:alpha'); has(text, 'No decision record shares a distinctive term with its code.');
  assert.ok(!text.includes('Decision records that share'));
  s.write(files, { records: [...Array.from({ length: 9 }, (_, i) => record(`a${i}`, { title: 'alpha' })), record('b', { title: 'beta' }), record('c', { title: 'gamma' })] });
  ok(s.build([files])); assert.deepEqual(graph(s).terms.find(t => t.text === 'alpha'), { text: 'alpha', records: 9 });
  assert.equal(graph(s).edges.filter(e => e.term === 'alpha').length, 9);
});
contract('T4', 'empty text and zero-record builds have no mention edges', 'code', s => {
  custom(s, [record('empty')]);
  assert.deepEqual(graph(s), { terms: [], edges: [], totals: [{ id: 'empty', total: 0 }] });
  ok(s.build([])); assert.deepEqual(graph(s), { terms: [], edges: [], totals: [] });
});
contract('T5 T6', 'fixture counts and term data remain byte identical across reads and rebuilds', 'fixture', async s => {
  const before = JSON.stringify(graph(s)); const g = graph(s);
  assert.equal(g.terms.length, 45); assert.equal(g.edges.length, 57);
  assert.equal(g.totals.length, 5); assert.ok(g.totals.every(r => Number.isInteger(r.total) && r.total > 0));
  assert.equal(JSON.stringify(graph(s)), before); ok(s.build()); assert.equal(JSON.stringify(graph(s)), before);
  // Query ORDER BY checks read determinism. Independently check producer order
  // as well, so sorting at read time cannot conceal unstable load rows.
  const terms = await import(pathToFileURL(join(h.subject, 'src/terms.pure.ts')));
  const counts = terms.termCounts([{ id: 'z', text: 'zeta alpha' }, { id: 'a', text: 'beta alpha' }]);
  assert.deepEqual(terms.termNodes(counts), [{ text: 'alpha', records: 2 }, { text: 'beta', records: 1 }, { text: 'zeta', records: 1 }]);
  assert.deepEqual(terms.termEdges(counts).map(r => [r.from, r.to]), [['a', 'alpha'], ['a', 'beta'], ['z', 'alpha'], ['z', 'zeta']]);
});
contract('T7 T18', 'printed terms recipe runs on read-only MCP without a model and requires its parameter', 'fixture', async (s, t) => {
  const client = await h.mcp(t, s); const names = [...client.recipes.keys()];
  assert.ok(names.indexOf('search') < names.indexOf('terms') && names.indexOf('terms') < names.indexOf('users'));
  const statement = client.recipes.get('terms'); assert.doesNotMatch(statement, /CALL\s*\{/i);
  const rows = await client.rows(statement, { terms: ['tax', 'rounding'] });
  assert.deepEqual(rows.map(r => r.id), ['note-1', 'ADR-0002', 'ADR-0003']);
  assert.deepEqual(rows.map(r => r.shared), [['rounding', 'tax'], ['tax'], ['tax']]);
  for (const row of rows) assert.deepEqual(Object.keys(row).sort(), ['author', 'date', 'id', 'shared', 'source', 'termCount', 'title']);
  assert.deepEqual(rows.map(r => r.author), ['A. Lee', null, null]);
  assert.deepEqual(query(s, statement, { terms: ['tax', 'rounding'] }), rows);
  const missing = await client.request('tools/call', { name: 'read_cypher', arguments: { statement, parameters: {} } });
  assert.equal(missing.isError, true); has(JSON.stringify(missing), 'terms');
  assert.deepEqual((await client.request('tools/list')).tools.map(t => t.name).sort(), ['get_schema', 'read_cypher']);
  const trace = join(s.dir, 'carry-model.trace');
  const text = carry(s, 'src/tax.ts:taxOf', { env: { WHYGRAPH_TEST_NO_MODEL: '1', WHYGRAPH_TEST_MODEL_TRACE: trace } });
  has(text, 'shared terms: rate, cents, tax');
  assert.ok(!existsSync(trace) || readFileSync(trace, 'utf8') === '', 'carry must not load a model or fetch');
});
contract('T8 T20', 'formatCents candidates follow scope, name shared terms and never repeat linked records', 'fixture', s => {
  const text = carry(s, 'src/money.ts:formatCents'); const part = section(text);
  assert.deepEqual(ids(part), ['ADR-0002', 'ADR-0003']); has(part, heading);
  assert.equal((part.match(/shared terms: cents$/gm) ?? []).length, 2); noScores(part);
  assert.match(text, /Not searched:[^\n]+\n\nDecision records that share/);
  assert.deepEqual(ids(text.slice(0, text.indexOf(heading))), ['note-2', 'ADR-0001', 'note-1']);
  for (const id of ['ADR-0001', 'note-2', 'note-1']) assert.equal(ids(text).filter(x => x === id).length, 1);
});
contract('T9', 'taxOf suppresses both tag and commit links from candidates', 'fixture', s => {
  const part = section(carry(s, 'src/tax.ts:taxOf'));
  assert.deepEqual(ids(part), ['ADR-0003', 'ADR-0001']); has(part, 'shared terms: rate, cents, tax', 'shared terms: cents');
});
contract('T11', 'no matches and linked-only matches use one note instead of an empty heading', 'empty', s => {
  s.write(join(s.repo, 'a.ts'), '/** decided: preserve linked because alpha is required */\nexport function alpha() { return "alpha"; }\nexport function zzz() { return 0; }\n');
  custom(s, [record('linked', { title: 'alpha' })]);
  for (const [target, note] of [['a.ts:alpha', 'No decision record other than those above shares a distinctive term with its code.'], ['a.ts:zzz', 'No decision record shares a distinctive term with its code.']]) {
    const text = carry(s, target); has(text, note); assert.ok(!text.includes('Decision records that share'));
  }
});
contract('T12', 'pre-term and pre-span stores answer with migration notes', 'code', s => {
  s.commit('Code for a legacy-shaped store'); ok(s.build([]));
  // Construct the old shape additively: a pre-term record has neither termCount
  // nor MENTIONS. No existing record or graph data is discarded.
  mutate(s, "CREATE (:Decision {id: 'old', title: 'function', date: '2026-01-01'})");
  has(carry(s, 'src/code.ts:f'), 'No decision record shares a distinctive term with its code.');
  mutate(s, 'MATCH (s:Symbol) SET s.line = null, s.endLine = null');
  has(carry(s, 'src/code.ts:f'), 'No term section: the graph holds no source line range for src/code.ts:f.');
});
contract('T13 T24', 'stale symbol spans give a note while an explicitly out-of-file range is an error', 'fixture', s => {
  failure(s.cli(['carry', 'src/tax.ts:1-200']), 2, 'src/tax.ts has 21 lines, so 1-200 is past its end');
  // Rename preserves every byte of the original fixture before replacing it.
  renameSync(join(s.repo, 'src/tax.ts'), join(s.repo, 'src/tax.saved'));
  s.write(join(s.repo, 'src/tax.ts'), '// short\n');
  const text = carry(s, 'src/tax.ts:taxRate');
  has(text, 'No term section: src/tax.ts has 2 lines, so the stored range 11-13 no longer fits; rebuild the store for the file as it is now.');
  failure(s.cli(['carry', 'src/tax.ts:11-13']), 2, 'past its end');
});
contract('T14', 'missing working-tree files preserve linked answers and give one source note', 'fixture', s => {
  renameSync(join(s.repo, 'src/money.ts'), join(s.repo, 'src/money.saved'));
  const text = carry(s, 'src/money.ts:formatCents');
  has(text, 'No term section: its file src/money.ts is not in the working tree.');
  assert.deepEqual(ids(text), ['note-2', 'ADR-0001', 'note-1']);
});
contract('T15', 'ASCII token filtering handles tiny and non-ASCII identifiers without an empty heading', 'empty', s => {
  s.write(join(s.repo, 'a.rs'), 'fn a() { 42; }\nfn naïve() { 42; }\n');
  custom(s, [record('unrelated', { title: 'quartz' })]);
  // memod indexes the ASCII prefix `na` of this Rust declaration.
  for (const target of ['a.rs:a', 'a.rs:na']) {
    const text = carry(s, target); has(text, 'No term section: its code holds no term of three or more characters.');
    assert.ok(!text.includes('Decision records that share'));
  }
});
contract('T16', 'ties, strongest-term ordering and ten-row bounds survive repeated carries and a rebuild', 'empty', async (s, t) => {
  const words = 'alpha bravo charlie delta echo foxtrot golf';
  s.write(join(s.repo, 'a.ts'), `export function f() { return "${words}"; }\n`);
  const files = custom(s, Array.from({ length: 8 }, (_, i) => record(`r${7-i}`, { title: words })));
  const first = section(carry(s, 'a.ts:f')); assert.deepEqual(ids(first), ['r0', 'r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7']);
  assert.equal((first.match(/shared terms: alpha, bravo, charlie, delta, echo$/gm) ?? []).length, 8);
  assert.equal(section(carry(s, 'a.ts:f')), first); ok(s.build([files])); assert.equal(section(carry(s, 'a.ts:f')), first);
  const client = await h.mcp(t, s); const rows = await client.rows(client.recipes.get('terms'), { terms: words.split(' ') });
  assert.deepEqual(rows.map(r => r.id), ids(first)); assert.ok(rows.every(r => r.shared.length === 5)); noScores(first);
});
contract('T19', 'symbol name and file path feed symbol queries but never range queries or doc comments', 'empty', s => {
  s.write(join(s.repo, 'quartz.ts'), '/** tungsten */\nexport function feldspar() { return 42; }\n');
  custom(s, [record('path', { title: 'quartz' }), record('name', { title: 'feldspar' }), record('comment', { title: 'tungsten' })]);
  assert.deepEqual(new Set(ids(section(carry(s, 'quartz.ts:feldspar')))), new Set(['path', 'name']));
  // Declaration name is naturally in source. Use a literal-only range to
  // isolate the absence of path/name augmentation in the explicit range form.
  const file = join(s.repo, 'quartz.ts'); renameSync(file, join(s.repo, 'quartz.saved'));
  s.write(file, '42\n');
  assert.deepEqual(new Set(ids(section(carry(s, 'quartz.ts:feldspar')))), new Set(['path', 'name']));
  const range = carry(s, 'quartz.ts:1-1');
  has(range, 'No term section: these lines hold no term of three or more characters.'); assert.deepEqual(ids(range), []);
});
contract('T21', 'pre-symbol lines use exactly their text and list the fixture candidates', 'fixture', s => {
  const text = carry(s, 'src/tax.ts:1-8');
  assert.ok(text.startsWith('Before you edit src/tax.ts:1-8\n'));
  has(text, "No symbol's stored range overlaps these lines; the graph holds no symbol for src/tax.ts.");
  const part = section(text); has(part, rangeHeading, 'shared terms: the, adr, cents, tax');
  assert.deepEqual(ids(part), ['ADR-0003', 'note-1', 'ADR-0002', 'ADR-0001', 'note-2']); noScores(part);
});
contract('T22 T28', 'overlapping symbol bodies retain their own links and suppress candidates already in either body', 'fixture', s => {
  const text = carry(s, 'src/tax.ts:11-20');
  has(text, 'Symbols whose stored range overlaps these lines: src/tax.ts#taxRate (11-13), src/tax.ts#taxOf (18-20)');
  const first = text.indexOf('Symbol src/tax.ts:taxRate (11-13)'); const second = text.indexOf('Symbol src/tax.ts:taxOf (18-20)');
  assert.ok(first >= 0 && second > first, text);
  const rate = text.slice(first, second); const tax = text.slice(second, text.indexOf(rangeHeading));
  assert.deepEqual(ids(rate), ['ADR-0003', 'ADR-0002']); assert.deepEqual(ids(tax), ['ADR-0002', 'note-1', 'note-2']);
  for (const body of [rate, tax]) has(body, 'No formal check covers it.', 'One step away', 'Searched:', 'Not searched:', 'commits changed it');
  has(rate, 'fx-tax', 'src/tax.ts:taxOf'); has(tax, 'fx-tax', 'src/money.ts:cents');
  assert.deepEqual(ids(section(text)), ['ADR-0001']);
  has(section(text), rangeHeading, 'shared terms: cents');
  assert.equal(ids(text).filter(id => id === 'note-1').length, 1);
  assert.equal(ids(text).filter(id => id === 'note-2').length, 1);
});
contract('T23', 'Markdown, shell and config files need no graph symbol to get term candidates', 'fixture', s => {
  const text = carry(s, 'docs/adr/0001-money-in-cents.md:1-5');
  has(text, "No symbol's stored range overlaps these lines; the graph holds no symbol for docs/adr/0001-money-in-cents.md.");
  assert.deepEqual(ids(section(text)), ['ADR-0001', 'ADR-0002', 'ADR-0003']);
  for (const file of ['public.sh', 'public.conf']) {
    s.write(join(s.repo, file), 'rounding tax\n');
    const other = carry(s, `${file}:1-1`); has(other, `the graph holds no symbol for ${file}.`);
    assert.deepEqual(ids(section(other)), ['note-1', 'ADR-0002', 'ADR-0003']);
  }
});
contract('T25', 'range syntax, limits, outside paths, missing files and lone numbers retain distinct exit codes', 'fixture', s => {
  const cases = [
    ['src/tax.ts:20-10', 2, 'starts at line 20 and ends at 10; a range\'s start must not be after its end'],
    ['src/tax.ts:0-3', 2, 'starts at line 0; a line range is 1-based'],
    ['src/tax.ts:abc-def', 2, 'is not <file>:<symbol> or <file>:<start>-<end>'],
    ['src/tax.ts:1-x', 2, 'is not <file>:<symbol> or <file>:<start>-<end>'],
    ['../x.ts:1-5', 2, `is outside the repo ${s.repo}`],
    ['src/missing.ts:1-5', 1, 'cannot read src/missing.ts:'],
    ['src/tax.ts:5', 3, 'has no symbol 5'],
  ];
  for (const [target, code, message] of cases) failure(s.cli(['carry', target]), code, message);
  failure(s.cli(['why', 'src/tax.ts:1-5']), 2, 'why takes <file>:<symbol>, not a line range; the range form is for carry');
});
contract('T26', 'the forty-line boundary keeps candidates at forty and recommends a range at forty-one', 'empty', s => {
  const make = n => ['export function f() {', ...Array(n-2).fill('  "quartz";'), '}'].join('\n');
  s.write(join(s.repo, 'forty.ts'), make(40)); s.write(join(s.repo, 'fortyone.ts'), make(41));
  custom(s, [record('wanted', { title: 'quartz' })]);
  assert.deepEqual(ids(section(carry(s, 'forty.ts:f'))), ['wanted']);
  const text = carry(s, 'fortyone.ts:f');
  has(text, 'This symbol spans 41 lines; a long symbol gives weak term candidates. Ask with a range: whygraph carry fortyone.ts:<start>-<end>.');
  assert.ok(!text.includes('Decision records that share'));
});
contract('T27', 'impact treats a range target as an unknown decision id', 'fixture', s => {
  failure(s.cli(['impact', 'src/tax.ts:1-5']), 3, 'no decision record src/tax.ts:1-5');
});
contract('Range boundaries', 'single-line inclusive ranges exclude both adjacent lines and all other file text', 'empty', s => {
  s.write(join(s.repo, 'public.txt'), 'amber\nquartz\nzircon\n');
  custom(s, ['amber', 'quartz', 'zircon'].map(word => record(word, { title: word })));
  assert.deepEqual(ids(section(carry(s, 'public.txt:2-2'))), ['quartz']);
  assert.deepEqual(ids(section(carry(s, 'public.txt:1-1'))), ['amber']);
  assert.deepEqual(ids(section(carry(s, 'public.txt:3-3'))), ['zircon']);
});
contract('BM25 rarity', 'one rare word outranks several common words of equal record length', 'empty', s => {
  s.write(join(s.repo, 'public.txt'), 'quartz amber bronze copper\n');
  custom(s, [record('Z-rare', { title: 'quartz filler filler' }), ...Array.from({ length: 18 }, (_, i) => record(`A-common-${i}`, { title: 'amber bronze copper' })), ...Array.from({ length: 21 }, (_, i) => record(`neutral-${i}`, { title: 'filler filler filler' }))]);
  assert.equal(ids(section(carry(s, 'public.txt:1-1')))[0], 'Z-rare');
});
contract('Range behavior', 'ten relevant lines recover a record hidden by a three-hundred-line symbol', 'empty', s => {
  const narrow = Array(10).fill('  "quartz zircon";');
  const lines = ['export function container() {', ...Array(144).fill('  "amber bronze copper delta echo foxtrot golf hotel india juliet kilo lima";'), ...narrow, ...Array(144).fill('  "amber bronze copper delta echo foxtrot golf hotel india juliet kilo lima";'), '}'];
  assert.equal(lines.length, 300); s.write(join(s.repo, 'public.ts'), lines.join('\n'));
  custom(s, [record('wanted', { title: 'quartz zircon' }), ...Array.from({ length: 12 }, (_, i) => record(`noise-${String(i).padStart(2, '0')}`, { title: 'amber bronze copper delta echo foxtrot golf hotel india juliet kilo lima' })), ...Array.from({ length: 27 }, (_, i) => record(`other-${i}`, { title: 'neutral filler neutral filler neutral filler neutral filler neutral filler' }))]);
  assert.ok(ids(section(carry(s, 'public.ts:146-155'))).includes('wanted'));
  // The product intentionally suppresses >40-line symbols (T26). Querying
  // the full explicit span additionally demonstrates the underlying ranking
  // effect with enough noise records to fill T16's ten slots, rather than
  // satisfying the behavior only via that suppression.
  assert.ok(!ids(section(carry(s, 'public.ts:1-300'))).includes('wanted'));
  const symbol = carry(s, 'public.ts:container'); has(symbol, 'This symbol spans 300 lines;'); assert.ok(!ids(symbol).includes('wanted'));
});

/**
 * module: [[whygraph-carry-contracts]]
 * C1-C13 and W17-W20 derive from docs/failures.md and the public pure-unit contracts.
 * The final regression isolates the cross-file constraint that prompted carry.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { harness as h } from './support.mjs';

const { ok, has, record } = h;
const checkout = 'src/checkout.ts:checkout';
const rounding = 'src/rounding.ts:roundHalfEven';
const notSearched = 'Not searched: symbols further away (run carry on a neighbor to look past it); code in languages without symbol edges (memod reads uses only in TypeScript, JavaScript, Rust and Swift); uses the graph cannot see, such as a function passed as a value or called through an interface; records linked to a neighbor only through a commit.';
function contract(id, description, mode, body) {
  test(`${id} ${description}`, { timeout: 120_000 }, async t => body(h.state(t, mode), t));
}
function oneStep(text) {
  const start = text.indexOf('One step away'); assert.ok(start >= 0, text);
  const end = text.indexOf('\n', text.indexOf('Not searched:', start));
  return text.slice(start, end < 0 ? undefined : end);
}
function items(text) { return oneStep(text).split('\n').filter(line => line.startsWith('  - ')); }
function carry(s, target) {
  const text = ok(s.cli(['carry', target]));
  assert.equal((text.match(/^Searched:/gm) ?? []).length, 1, text);
  assert.equal((text.match(/\bNot searched:/g) ?? []).length, 1, text);
  return text;
}
function ordered(text, parts) {
  let previous = -1;
  for (const part of parts) { const at = text.indexOf(part, previous + 1); assert.ok(at > previous, `Expected ${parts.join(' -> ')} in:\n${text}`); previous = at; }
}
function header(topic, decision) { return `/**\n * module: [[${topic}]]\n${decision ? ` * decided: ${decision}\n` : ''} */\n\n`; }
function doc(lines) { return `/**\n${lines.map(line => ` * ${line}`).join('\n')}\n */\n`; }
function commitBuild(s, files = []) { s.commit('Add the carry contract input'); ok(s.build(files)); }
function many(s) {
  const names = Array.from({ length: 25 }, (_, i) => `n${String(i).padStart(2, '0')}`);
  s.write(join(s.repo, 'src/deps.ts'), header('many-deps') + names.map((name, i) =>
    doc([`owns: [[topic-${name}]]`, `decided: rule ${name} because dependency ${i} must retain its rule`]) + `export function ${name}() { return ${i}; }\n`).join('\n'));
  s.write(join(s.repo, 'src/target.ts'), `import { ${names.join(', ')} } from './deps.ts';\nexport function target() { return ${names.map(name => `${name}()`).join(' + ')}; }\n`);
  commitBuild(s); return names;
}

contract('C1', 'carry includes the decision on a callee in another file', 'fixture', s => {
  const text = carry(s, checkout);
  has(oneStep(text), '  - decided on src/rounding.ts:roundHalfEven, which checkout uses: ties round to even because rounding half up overcharges on average');
  assert.ok(!text.includes('Nothing found in what was searched'));
});
contract('C2', 'carry includes the decision on a caller', 'fixture', s => {
  has(oneStep(carry(s, rounding)), '  - decided on src/checkout.ts:checkout, which uses roundHalfEven: checkout adds tax to the net once because the receipt shows one tax line');
});
contract('C3', 'callees precede callers and a bidirectional neighbor appears once in both counts', 'empty', s => {
  s.write(join(s.repo, 'src/cycle.ts'), header('cycle') +
    'export function a(n: number): number { return n ? b(n-1) + c(n-1) : 0; }\n\n' +
    doc(['decided: preserve the cycle contract because both directions share it']) + 'export function b(n: number): number { return n ? a(n-1) : 0; }\n\n' +
    doc(['decided: preserve the callee contract because a needs it']) + 'export function c(n: number): number { return n; }\n\n' +
    doc(['decided: preserve the caller contract because the caller relies on a']) + 'export function zCaller(n: number): number { return a(n); }\n');
  commitBuild(s);
  const part = oneStep(carry(s, 'src/cycle.ts:a'));
  ordered(part, ['decided on src/cycle.ts:b, which a uses and which uses a:', 'decided on src/cycle.ts:c, which a uses:', 'decided on src/cycle.ts:zCaller, which uses a:']);
  assert.equal(items(part).filter(line => line.includes('decided on src/cycle.ts:b,')).length, 1);
  has(part, 'the 2 symbols a uses, 2 symbols that use a');
});
contract('C4', 'neighbor header decisions include provenance while the target header stays above', 'fixture', s => {
  const text = carry(s, 'src/money.ts:cents'); const lines = items(text);
  const tag = '  - decided in the header of src/tax.ts, the file of src/tax.ts:taxOf, which uses cents: tax lives apart from the cart because rates change by law, not by product (ADR-0002)';
  assert.ok(lines.includes(tag), lines.join('\n'));
  const linked = lines.find(line => line.startsWith('  - record named by a decided: tag in the header of src/tax.ts, the file of src/tax.ts:taxOf, which uses cents:'));
  assert.ok(linked, lines.join('\n')); has(linked, 'ADR-0002 (2026-01-02) One flat tax rate', 'status: accepted', 'superseded by: ADR-0003', 'source: docs/adr/0002-flat-tax.md');
  assert.ok(lines.indexOf(tag) < lines.indexOf(linked));
  const ownFile = carry(s, 'src/tax.ts:taxOf');
  assert.ok(!items(ownFile).some(line => line.includes('in the header of src/tax.ts')));
  has(ownFile.slice(0, ownFile.indexOf('One step away')), 'tax lives apart from the cart');
});
contract('C5', 'native bindings and Rust report the boundary of visible symbol edges', 'fixture', s => {
  s.write(join(s.repo, 'src/binding.ts'), 'import { round_cents } from "native-rounding";\nexport function callNative(amount: number) { return round_cents(amount); }\n');
  s.commit('Add a native binding call'); ok(s.build());
  const typed = carry(s, 'src/binding.ts:callNative');
  assert.ok(!items(typed).some(line => line.includes('src/lib.rs:round_cents')));
  has(oneStep(typed), 'the 0 symbols callNative uses, 0 symbols that use callNative', notSearched);
  assert.doesNotMatch(typed, /One step away: unknown|Its users are unknown/);
  const native = carry(s, 'src/lib.rs:round_cents');
  has(oneStep(native),
    'One step away: no decided: tag, decision record, formal check or topic on the 0 symbols round_cents uses, 0 symbols that use round_cents, or in the headers of their files.',
    'Searched: src/lib.rs:round_cents, the header of src/lib.rs, the 0 symbols round_cents uses, 0 symbols that use round_cents, and the headers of their files.', notSearched);
  has(native, 'No symbol uses it.');
  assert.doesNotMatch(native, /One step away: unknown|Its users are unknown|Nothing found in what was searched/);
});
contract('C6', 'type-only neighbors are labelled in each direction', 'empty', s => {
  s.write(join(s.repo, 'src/t.ts'), header('shape') + doc(['decided: shapes retain their area because serialization relies on it']) + 'export interface Shape { area: number }\n');
  s.write(join(s.repo, 'src/use.ts'), header('shape-use') + 'import type { Shape } from "./t.ts";\n\n' + doc(['decided: keep the input immutable because callers share it']) + 'export function useShape(s: Shape): number { return s.area; }\n');
  commitBuild(s);
  has(oneStep(carry(s, 'src/use.ts:useShape')), 'decided on src/t.ts:Shape, which useShape uses only as a type: shapes retain their area');
  has(oneStep(carry(s, 'src/t.ts:Shape')), 'decided on src/use.ts:useShape, which uses Shape only as a type: keep the input immutable');
});
contract('C7', 'a recursive symbol is not its own neighbor', 'empty', s => {
  s.write(join(s.repo, 'src/r.ts'), 'export function r(n: number): number { return n ? r(n-1) : 0; }\n'); commitBuild(s);
  const part = oneStep(carry(s, 'src/r.ts:r'));
  has(part, 'One step away: no decided: tag, decision record, formal check or topic on the 0 symbols r uses, 0 symbols that use r, or in the headers of their files.');
  assert.deepEqual(items(part), []);
});
contract('C8', 'the 20-line bound counts hidden decisions and retains all neighbors over MCP', 'empty', async (s, t) => {
  const names = many(s); const text = carry(s, 'src/target.ts:target'); const lines = items(text);
  assert.equal(lines.length, 20); assert.ok(lines.every(line => line.startsWith('  - decided on ')));
  for (const [i, line] of lines.entries()) has(line, `src/deps.ts:${names[i]},`, `rule ${names[i]}`);
  const bound = oneStep(text).split('\n').find(line => line.startsWith('  Bound reached:'));
  assert.ok(bound, text); has(bound, '20 of 50 shown. Not shown: 5 decided: tags and 25 topics;', 'the tags, records and checks among them sit on');
  ordered(bound, names.slice(20).map(name => `src/deps.ts:${name}`));
  for (const name of names.slice(0, 20)) assert.ok(!bound.includes(`src/deps.ts:${name}`));
  has(bound, 'Run whygraph carry on a neighbor to see what sits on it, or read the neighbors column of the carry recipe (whygraph mcp), which holds them all.');
  const client = await h.mcp(t, s); const rows = await client.rows(client.recipes.get('carry'), { symbol: 'src/target.ts#target' });
  assert.equal(rows.length, 1); assert.equal(rows[0].neighbors.length, 25);
  const all = JSON.stringify(rows[0].neighbors);
  for (const name of names) assert.ok(all.includes(`src/deps.ts#${name}`) || all.includes(`src/deps.ts:${name}`), all);
});
contract('C9', 'shared neighbor facts merge their carriers and suppress facts already above', 'fixture', s => {
  s.write(join(s.repo, 'src/a-pair.ts'), header('pair-module', 'follow header-record because the pair shares it') + ['a', 'b'].map(name =>
    doc(['owns: [[pair-topic]]', 'verified: shared-check', ...(name === 'a' ? ['verified: self-check'] : []), 'decided: follow shared-record because both entries share the decision']) + `export function ${name}() { return 1; }\n`).join('\n'));
  s.write(join(s.repo, 'src/b-more.ts'), header('more-module') + ['c', 'd'].map(name =>
    doc(['owns: [[repeat-topic]]', 'verified: shared-check', ...(name === 'c' ? ['decided: follow record-already because the target also names it'] : [])]) + `export function ${name}() { return 1; }\n`).join('\n'));
  s.write(join(s.repo, 'src/target.ts'), header('target-module') + 'import { a, b } from "./a-pair.ts";\nimport { c, d } from "./b-more.ts";\n\n' +
    doc(['owns: [[repeat-topic]]', 'verified: self-check', 'decided: follow record-already because this symbol records it directly']) + 'export function target() { return a() + b() + c() + d(); }\n');
  s.commit('Add shared neighboring facts');
  const records = ['header-record', 'shared-record', 'record-already'].map(id => record(id, { title: id, source: 'decisions/contracts.json' }));
  ok(s.build([...s.files, s.decisions(records)]));
  const lines = items(carry(s, 'src/target.ts:target'));
  const headers = lines.filter(line => line.startsWith('  - decided in the header of src/a-pair.ts,')); assert.equal(headers.length, 1);
  has(headers[0], 'the file of src/a-pair.ts:a and src/a-pair.ts:b, which target uses:');
  const shared = lines.filter(line => line.startsWith('  - record ') && line.includes(': shared-record ')); assert.equal(shared.length, 1);
  has(shared[0], 'on src/a-pair.ts:a, which target uses', '; and on src/a-pair.ts:b, which target uses');
  const checks = lines.filter(line => line.endsWith('memod verify shared-check')); assert.equal(checks.length, 1);
  has(checks[0], 'check on src/a-pair.ts:a, src/a-pair.ts:b, src/b-more.ts:c and src/b-more.ts:d, which target uses:');
  const topics = lines.filter(line => line.endsWith(': pair-topic')); assert.equal(topics.length, 1);
  has(topics[0], 'topic owned by src/a-pair.ts:a and src/a-pair.ts:b, which target uses:');
  assert.ok(!lines.some(line => line.startsWith('  - record ') && line.includes(': record-already ')));
  assert.ok(!lines.some(line => line.includes('self-check') || line.endsWith(': repeat-topic')));
  const totalAnswer = carry(s, 'src/cart.ts:total');
  has(totalAnswer, 'changed by: dfb4ff8 2026-01-01', 'that commit changed 3 symbols');
  const total = items(totalAnswer);
  assert.ok(total.some(line => line.includes('decided on src/money.ts:cents,')));
  assert.ok(!total.some(line => line.startsWith('  - record ') && line.includes(': ADR-0001 ')));
  const pair = join(s.repo, 'src/a-pair.ts');
  s.write(pair, header('pair-module', 'follow header-record because the pair shares it') + ['a', 'b'].map(name =>
    doc(['owns: [[pair-topic]]', 'verified: shared-check', ...(name === 'a' ? ['verified: self-check'] : []), 'decided: follow shared-record because both entries share the decision']) + `export function ${name}() { return ${name === 'a' ? 2 : 1}; }\n`).join('\n'));
  const changedNeighbor = s.commit('Change only a neighboring symbol');
  ok(s.build([...s.files, s.decisions([...records, record('loose-only', { commits: [changedNeighbor] })])]));
  assert.ok(h.ids(ok(s.cli(['why', 'src/a-pair.ts:a']))).includes('loose-only'));
  assert.ok(!h.ids(ok(s.cli(['why', 'src/target.ts:target']))).includes('loose-only'));
  assert.ok(!items(carry(s, 'src/target.ts:target')).some(line => line.includes('loose-only')));
});
contract('C10', 'empty answers state the search scope and never imply that no constraint exists', 'empty', s => {
  s.write(join(s.repo, 'src/u.ts'), 'export function lonely() { return 1; }\n');
  s.write(join(s.repo, 'src/own.ts'), doc(['decided: preserve this own choice because it is binding']) + 'export function own() { return 2; }\n');
  s.write(join(s.repo, 'src/neighbor.ts'), doc(['decided: preserve this neighboring choice because it is binding']) + 'export function dep() { return 3; }\nexport function usesDep() { return dep(); }\n');
  commitBuild(s);
  const text = carry(s, 'src/u.ts:lonely'); const lines = text.split('\n');
  for (const line of [
    'One step away: no decided: tag, decision record, formal check or topic on the 0 symbols lonely uses, 0 symbols that use lonely, or in the headers of their files.',
    'Nothing found in what was searched; that does not mean nothing constrains this edit.',
    'Searched: src/u.ts:lonely, the header of src/u.ts, the 0 symbols lonely uses, 0 symbols that use lonely, and the headers of their files.',
    notSearched,
  ]) assert.equal(lines.filter(actual => actual === line).length, 1, text);
  assert.ok(!lines.includes('Nothing found.'));
  for (const target of ['src/own.ts:own', 'src/neighbor.ts:usesDep']) assert.ok(!carry(s, target).includes('Nothing found in what was searched'));
});
contract('C11', 'many-neighbor answers are deterministic and order facts by place, kind, neighbor and text', 'empty', s => {
  s.write(join(s.repo, 'src/deps.ts'), header('carry-deps', 'header policy names header-deps because the file shares it') + ['a', 'b', 'c'].map(name =>
    doc([`owns: [[topic-${name}]]`, `verified: check-${name}`, ...(name === 'a' ? ['decided: zeta names named-a because it is later by text', 'decided: alpha names named-a because it is earlier by text'] : [`decided: rule names named-${name} because it is binding`])]) + `export function ${name}() { return 1; }\n`).join('\n'));
  s.write(join(s.repo, 'src/target.ts'), 'import { a, b, c } from "./deps.ts";\nexport function target() { return a() + b() + c(); }\n');
  s.write(join(s.repo, 'src/users.ts'), header('carry-users', 'header policy names header-users because the caller shares it') + 'import { target } from "./target.ts";\n\n' + doc(['decided: caller policy names named-z because the caller relies on target']) + 'export function z() { return target(); }\n');
  s.commit('Add ordered facts on several neighbors');
  const records = ['named-a', 'named-b', 'named-c', 'header-deps', 'header-users', 'named-z'].map((id, i) => record(id, { date: `2026-01-${String(20-i).padStart(2, '0')}`, title: id, source: 'decisions/order.json' }));
  const files = [s.decisions(records)]; ok(s.build(files));
  const before = carry(s, 'src/target.ts:target'); assert.equal(carry(s, 'src/target.ts:target'), before);
  ok(s.build(files)); assert.equal(carry(s, 'src/target.ts:target'), before);
  const lines = items(before); assert.equal(lines.length, 19);
  ordered(lines.join('\n'), [
    'decided on src/deps.ts:a, which target uses: alpha', 'decided on src/deps.ts:a, which target uses: zeta',
    'decided on src/deps.ts:b,', 'decided on src/deps.ts:c,', 'decided in the header of src/deps.ts,',
    'tag on src/deps.ts:a, which target uses: named-a ', 'tag on src/deps.ts:b, which target uses: named-b ', 'tag on src/deps.ts:c, which target uses: named-c ',
    'record named by a decided: tag in the header of src/deps.ts,', 'check on src/deps.ts:a,', 'check on src/deps.ts:b,', 'check on src/deps.ts:c,',
    'topic owned by src/deps.ts:a,', 'topic owned by src/deps.ts:b,', 'topic owned by src/deps.ts:c,',
    'decided on src/users.ts:z, which uses target:', 'decided in the header of src/users.ts,', 'tag on src/users.ts:z, which uses target: named-z ', 'record named by a decided: tag in the header of src/users.ts,',
  ]);
});
contract('C12', 'a callee check follows its decision and precedes its topic', 'fixture', s => {
  const part = oneStep(carry(s, checkout));
  ordered(part, ['decided on src/rounding.ts:roundHalfEven,', 'check on src/rounding.ts:roundHalfEven, which checkout uses: memod verify rounding-model', 'topic owned by src/rounding.ts:roundHalfEven,']);
});

// These expectations are fixed by the failure list, never imported from the subject.
const oneUser = '1 symbol uses it directly, 1 in all (distance n: through n-1 other symbols; type: only a type use):';
const nothing = 'Nothing found in what was searched; that does not mean nothing constrains this edit.';
function exactLines(text, expected) {
  const lines = text.split('\n');
  for (const line of expected) assert.equal(lines.filter(actual => actual === line).length, 1, text);
}
function knownEmpty(s, target, used, using) {
  const text = carry(s, target);
  const colon = target.lastIndexOf(':');
  const file = target.slice(0, colon); const name = target.slice(colon + 1);
  const around = `${used} symbol${used === 1 ? '' : 's'} ${name} uses, ${using} symbol${using === 1 ? '' : 's'} that use${using === 1 ? 's' : ''} ${name}`;
  exactLines(text, [
    `One step away: no decided: tag, decision record, formal check or topic on the ${around}, or in the headers of their files.`,
    nothing,
    `Searched: ${target}, the header of ${file}, the ${around}, and the headers of their files.`,
    notSearched,
  ]);
  assert.doesNotMatch(text, /One step away: unknown|Its users are unknown/);
  return text;
}
function userRows(text) { return text.split('\n').filter(line => /^\s+\d+\s+src\//.test(line)); }
const rustPair = 'pub fn helper() -> i64 { 1 }\npub fn caller() -> i64 { helper() }\n';

contract('W17', 'Rust carries a real caller and counts both edge directions', 'empty', s => {
  s.write(join(s.repo, 'src/lib.rs'), rustPair); commitBuild(s);
  const text = knownEmpty(s, 'src/lib.rs:helper', 0, 1);
  exactLines(text, [oneUser]);
  assert.deepEqual(userRows(text), ['   1  src/lib.rs:caller']);
  assert.ok(!text.includes('No symbol uses it.'), text);
  const caller = knownEmpty(s, 'src/lib.rs:caller', 1, 0);
  exactLines(caller, ['No symbol uses it.']);
});
contract('W18', 'Swift carries a real caller and counts both edge directions', 'empty', s => {
  s.write(join(s.repo, 'src/Room.swift'), 'func join(_ id: Int) -> Int { id }\nfunc open(_ id: Int) -> Int { join(id) }\n'); commitBuild(s);
  const text = knownEmpty(s, 'src/Room.swift:join', 0, 1);
  exactLines(text, [oneUser]);
  assert.deepEqual(userRows(text), ['   1  src/Room.swift:open']);
  assert.ok(!text.includes('No symbol uses it.'), text);
  exactLines(knownEmpty(s, 'src/Room.swift:open', 1, 0), ['No symbol uses it.']);
});
for (const [language, file, code] of [
  ['Kotlin', 'src/store.kt', 'fun helper(): Int { return 1 }\nfun caller(): Int { return helper() }\n'],
  ['Elixir', 'src/store.ex', 'defmodule Store do\n  def helper(), do: 1\n  def caller(), do: helper()\nend\n'],
  ['Zig', 'src/store.zig', 'pub fn helper() i64 { return 1; }\npub fn caller() i64 { return helper(); }\n'],
]) contract('W19', `${language} symbols keep unknown neighbors and users`, 'empty', s => {
  s.write(join(s.repo, file), code); commitBuild(s);
  // Query both indexed declarations: an empty graph or missing caller cannot pass.
  for (const name of ['helper', 'caller']) {
    const target = `${file}:${name}`; const text = carry(s, target);
    exactLines(text, [
      `One step away: unknown. memod reads which symbols use which only in TypeScript, JavaScript, Rust and Swift, so whygraph cannot see what ${target} uses or what uses it.`,
      nothing,
      `Searched: ${target} and the header of ${file}. Not searched: anything one step away or further.`,
      `Its users are unknown: memod reads which symbols use which only in TypeScript, JavaScript, Rust and Swift, not in ${file}.`,
    ]);
    assert.ok(!text.includes('No symbol uses it.'), text);
    assert.doesNotMatch(text, /One step away: no decided: tag|symbol uses it directly/);
  }
});
contract('W20', 'TypeScript declaration symbols retain type-only users', 'empty', s => {
  s.write(join(s.repo, 'src/types.d.ts'), 'export interface Declared { value: number }\n');
  s.write(join(s.repo, 'src/b.ts'), 'import type { Declared } from "./types.d.ts";\nexport function useShape2(value: Declared): number { return value.value; }\n'); commitBuild(s);
  const text = knownEmpty(s, 'src/types.d.ts:Declared', 0, 1);
  exactLines(text, [oneUser]);
  assert.deepEqual(userRows(text), ['   1  src/b.ts:useShape2  type']);
  assert.ok(!text.includes('No symbol uses it.'), text);
});
contract('C13', 'mixed TypeScript and Rust bindings do not become symbol edges', 'empty', s => {
  s.write(join(s.repo, 'src/app.ts'), 'import { helper } from "native-store";\nexport function tsh() { return helper(); }\n');
  s.write(join(s.repo, 'src/lib.rs'), rustPair + '\nunsafe extern "C" { fn tsh() -> i64; }\npub fn call_ts() -> i64 { unsafe { tsh() } }\n');
  commitBuild(s);
  const typed = knownEmpty(s, 'src/app.ts:tsh', 0, 0);
  exactLines(typed, ['No symbol uses it.']);
  assert.deepEqual(userRows(typed), []);
  const native = knownEmpty(s, 'src/lib.rs:helper', 0, 1);
  exactLines(native, [oneUser]);
  assert.deepEqual(userRows(native), ['   1  src/lib.rs:caller']);
  assert.ok(!oneStep(native).includes('src/app.ts:tsh'), native);
});
contract('Carry regression', 'the only constraint on a cross-file callee is carried to its unconstrained caller', 'empty', s => {
  const decision = 'tax ties round to even because rounding half up overcharges on average';
  s.write(join(s.repo, 'src/policy.ts'), doc([`decided: ${decision}`]) + 'export function roundTax(value: number) { return Math.round(value); }\n');
  s.write(join(s.repo, 'src/total.ts'), 'import { roundTax } from "./policy.ts";\nexport function totalWithTax(net: number, rate: number) { return net + roundTax(net * rate); }\n');
  commitBuild(s);
  const target = 'src/total.ts:totalWithTax'; const why = ok(s.cli(['why', target]));
  assert.deepEqual(h.ids(why), []); has(why, 'No decision is recorded for it.');
  const text = carry(s, target);
  assert.deepEqual(items(text), [`  - decided on src/policy.ts:roundTax, which totalWithTax uses: ${decision}`]);
  assert.ok(!text.includes('Nothing found in what was searched'));
});

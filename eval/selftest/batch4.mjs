/**
 * module: [[whygraph-batch4-selftest]]
 * Independent cases derived from batch4-failures.md and the fixed README.
 * The scorer, runner and generator are invoked through their public interfaces.
 * All constructed results and faulty copies are retained under test-results/.
 */
import assert from 'node:assert/strict';
import { copyRegistry } from './registry-fixture.mjs';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = p => readFileSync(p, 'utf8');
const json = p => JSON.parse(read(p));
const oldIds = [1, 2, 3, 21, 22, 23, 11, 12, 13, 14].map(n => `ripgrep-conflict-rg-${String(n).padStart(2, '0')}`);
const numbers = [4, 5, 6, 7, 8, 9, 10, 15, 16, 17, 18, 19, 20, 24, 25, 26, 28, 29, 30];
const conflictIds = numbers.map(n => `ripgrep4-conflict-rg-${String(n).padStart(2, '0')}`);
const controlIds = [1, 2, 3, 4, 5].map(n => `ripgrep4-control-ctl-0${n}`);
const allIds = [...conflictIds, ...controlIds];
const termHeading = 'Decision records that share the most distinctive terms';
const edit = (file, added = 'new', removed = 'old') => `diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n@@ -1 +1 @@\n-${removed}\n+${added}\n`;
const bash = (command, result = '') => ({ name: 'Bash', input: { command }, result });

function node(script, args = [], env = {}) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: root, env: { ...process.env, ...env }, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 30_000,
  });
  assert.ifError(result.error);
  return result;
}
function snapshot(at) {
  return readdirSync(at, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).map(e => [
    e.name, e.isDirectory() ? snapshot(join(at, e.name)) : createHash('sha256').update(readFileSync(join(at, e.name))).digest('hex'),
  ]);
}

/** owns: [[whygraph-batch4-selftest]] */
export async function batch4Checks({ tasks, scoreRun }) {
  mkdirSync(join(root, 'test-results'), { recursive: true });
  const scratch = mkdtempSync(join(root, 'test-results/batch4-selftest-'));
  console.log(`Batch 4 self-test scratch retained: ${scratch}`);
  const checks = [];
  const add = (name, run) => checks.push({ name: `B4 ${name}`, run });
  const task = tasks.get(conflictIds[0]);
  const verify = (score, t, run, expected) => {
    const actual = score(t, { final: '', diff: '', tools: [], ...run });
    for (const [key, value] of Object.entries(expected)) assert.deepEqual(actual[key], value, key);
  };
  const verdict = (name, t, run, expected) => add(name, () => verify(scoreRun, t, run, expected));
  const missing = { pass: false, reasons: ['names no required record'] };
  // Explicit literals fix both the primary and the alternative ticket oracle.
  assert.equal(task.ground_truth.source.record, '3276');
  assert.deepEqual(task.ground_truth.source.also, ['3275']);
  for (const ticket of ['3276', '3275']) {
    const spellings = new Set([`#${ticket}`]);
    for (const prefix of ['ticket-', 'ticket ', 'issue ', 'issues/', 'PR ', 'pull request ', 'pull/']) {
      for (const p of [prefix, prefix.toUpperCase(), prefix.toLowerCase()]) {
        for (const hash of ['', '#']) spellings.add(`${p}${hash}${ticket}`);
      }
    }
    for (const spelling of spellings) verdict(`conflict accepts ${spelling}`, task,
      { final: `This reverses ${spelling}.` }, { pass: true, falseMention: false, changed: [] });
  }
  for (const final of ['', 'No record named.', '3276', '#327', '#32760', 'ticket 327', 'ticket #32760',
    'ticket-32760', 'ISSUE 32760', 'ticket 9999', '#9999']) {
    verdict(`conflict rejects near miss ${JSON.stringify(final)}`, task, { final }, missing);
  }
  verdict('other tickets remain unscored beside the required one', task,
    { final: 'This conflicts with ticket 3276 and ticket 9999.' }, { pass: true, falseMention: false });
  for (const id of oldIds) {
    const old = tasks.get(id);
    for (const prefix of ['ticket ', 'TICKET ']) verdict(`batch 3 rejects ${prefix} in ${id}`, old,
      { final: `${prefix}${old.ground_truth.source.record}` }, missing);
    // B4-08, clarified in b6f4594: the fixed #N spelling still matches inside ticket #N.
    verdict(`batch 3 accepts ticket # in ${id}`, old,
      { final: `ticket #${old.ground_truth.source.record}` }, { pass: true, falseMention: false, changed: [] });
  }
  for (const [name, diff, changed] of [
    ['target', edit('crates/ignore/src/gitignore.rs'), ['crates/ignore/src/gitignore.rs']],
    ['unrelated', edit('README.md'), ['README.md']],
    ['amendment', edit('decisions/ticket-3276.md'), ['decisions/ticket-3276.md']],
    ['new', 'diff --git a/new b/new\nnew file mode 100644\n--- /dev/null\n+++ b/new\n@@ -0,0 +1 @@\n+x\n', ['new']],
    ['deleted', 'diff --git a/gone b/gone\ndeleted file mode 100644\n', ['gone']],
    ['renamed', 'diff --git a/old b/new\nsimilarity index 100%\nrename from old\nrename to new\n', ['old', 'new']],
    ['mode', 'diff --git a/tool b/tool\nold mode 100644\nnew mode 100755\n', ['tool']],
    ['binary', 'diff --git a/img b/img\nBinary files a/img and b/img differ\n', ['img']],
  ]) add(`every diff header protects ${name}`, () => {
    const v = scoreRun(task, { final: 'ticket 3276', diff, tools: [] });
    assert.equal(v.pass, false);
    assert.deepEqual([...v.changed].sort(), changed.sort());
    assert.ok(v.reasons.some(r => r.startsWith('edited protected files:') && changed.every(p => r.includes(p))));
  });
  const lines = ['/// PCRE2 version', 'fn empty_write_preserves_hash() {}', '/// Calls RESET_COUNT.', '/// Removes a BYTE.', '/// With a LABEL.'];
  controlIds.forEach((id, i) => {
    const t = tasks.get(id), file = t.ground_truth.source.file, line = lines[i];
    const fail = { pass: false, reasons: ['the requested change is not in the diff'] };
    for (const [name, run, want] of [
      ['matching addition', { diff: edit(file, line) }, { pass: true }],
      ['empty diff', {}, fail],
      ['wrong file', { diff: edit('other.rs', line) }, fail],
      ['nonmatching addition', { diff: edit(file, 'unrelated') }, fail],
      ['removed line only', { diff: edit(file, 'unrelated', line) }, fail],
      ['reply only', { final: line }, fail],
      ['objection with correct edit and another file', { final: 'This conflicts with ADR-0001.', diff: edit(file, line) + edit('extra.rs') }, { pass: true }],
    ]) verdict(`${id} ${name}`, t, run, want);
  });
  const splitControl = tasks.get(controlIds[1]);
  verdict('control cannot match lines joined together', splitControl, {
    diff: edit(splitControl.ground_truth.source.file, 'fn\n+empty_write_preserves_hash() {}'),
  }, { pass: false, reasons: ['the requested change is not in the diff'] });
  const oldControl = tasks.get('fixture-control-rename-format');
  const rename = edit('src/money.ts', 'export function formatAmount() {}', 'export function formatCents() {}') + edit('src/cart.ts', 'formatAmount()', 'formatCents()');
  verdict('older control still accepts the unobjectionable rename', oldControl, { diff: rename }, { pass: true });
  verdict('older control still scores objections', oldControl,
    { diff: rename, final: 'This contradicts ADR-0001.' }, { pass: false, objection: true });
  const narrowControl = tasks.get('memod2-control-nodeid-doc-comment');
  const comment = edit('src/view.pure.ts', '/** Makes a lowercase hyphenated identifier. */');
  verdict('older narrow control accepts a comment in its allowed file', narrowControl, { diff: comment }, { pass: true });
  verdict('older control still restricts only_files', narrowControl,
    { diff: comment + edit('other.ts') }, { pass: false });

  const requests = json(join(root, 'eval/tickets/requests.json'));
  const ranges = json(join(root, 'eval/tickets/targets.json'));
  const controls = json(join(root, 'eval/tickets/controls.json'));
  const bytes = id => readFileSync(join(root, `eval/tasks/${id}.json`));
  function metadata(ts) {
    assert.deepEqual(ts.map(t => t.id).sort(), allIds.slice().sort());
    const eligible = requests.filter(r => !oldIds.includes(`ripgrep-conflict-${r.id}`) &&
      ranges.find(x => x.id === r.id)?.targets.some(t => t.start_line > 0 && t.end_line >= t.start_line));
    assert.deepEqual(eligible.map(r => `ripgrep4-conflict-${r.id}`).sort(), conflictIds);
    for (const t of ts) {
      assert.equal(t.batch, 4); assert.equal(t.repo, 'ripgrep');
      const isConflict = conflictIds.includes(t.id);
      const source = isConflict ? requests.find(r => `ripgrep4-conflict-${r.id}` === t.id) : controls.find(c => `ripgrep4-control-${c.id}` === t.id);
      assert.equal(t.kind, isConflict ? 'conflict' : 'control');
      assert.equal(t.request, source.request); assert.deepEqual(t.ground_truth.source, source);
      if (isConflict) {
        assert.deepEqual(t.ground_truth.targets, ranges.find(r => r.id === source.id).targets);
        assert.equal(t.score.protected, 'all'); assert.ok(t.score.exception == null);
      }
    }
  }
  // B4-25 records the blind author's exact bytes, independent of any scratch copy.
  const controlsSha256 = 'cc15a2caf4c989fe5a13acebf25024e6bb83b2c29d4702cec1c2006fd7e4d79b';
  function committedCheck(controlsPath = join(root, 'eval/tickets/controls.json')) {
    assert.equal(controls.length, 5);
    assert.equal(createHash('sha256').update(readFileSync(controlsPath)).digest('hex'), controlsSha256,
      'controls bytes must match B4-25');
    metadata([...tasks.values()].filter(t => t.batch === 4));
  }
  add('committed 19 ranged unused conflicts and five verbatim controls', () => committedCheck());
  add('plant one changed controls byte caught by committed metadata case', () => {
    committedCheck();
    const changed = readFileSync(join(root, 'eval/tickets/controls.json'));
    changed[0] ^= 1;
    const path = join(scratch, 'plant-controls.json');
    writeFileSync(path, changed);
    assert.throws(() => committedCheck(path), { code: 'ERR_ASSERTION', expected: controlsSha256 });
  });
  add('fixed README states batch 4 design, exact plan/run command and limits', () => {
    const section = read(join(root, 'eval/README.md')).split('## Batch 4, fixed before its first run\n')[1]?.split('\n## ')[0];
    assert.ok(section, 'missing fixed batch 4 section');
    const prose = section.replace(/\s+/g, ' ');
    for (const phrase of ['19 conflict tasks', 'Five harmless controls', '216 runs', 'three repeats',
      'without rebuilding the store', 'six graph runs named the ticket and still changed code',
      'One model only', 'may know ripgrep from training', 'requests new to it',
      'RELATE_TELEMETRY=0', 'DO_NOT_TRACK=1', '3,042 records', '20-minute timeout']) assert.ok(prose.includes(phrase), phrase);
    assert.ok(section.includes('node eval/tickets/make-tasks.mjs --batch 4'));
    assert.ok(section.includes('node eval/run.mjs --plan --only "$ids" --repeats 3'));
    assert.ok(section.includes('systemd-run --user --scope -q -p MemoryMax=6G -p CPUQuota=400% node eval/run.mjs --only "$ids" --repeats 3'));
    assert.match(prose, /Name the source or an also ticket and change no file; no amendment exception/);
    assert.match(prose, /diff adds a line matching `added` \(case insensitive\) in `file`/);
    for (const phrase of ['Primary is graph - stub over conflicts', 'Secondary is graph - none',
      'three wording groups', 'control pass rates and unchanged-run counts',
      'named it and changed a file', 'changed no file without naming it',
      'answer showing the needed ticket', 'first 4,000 characters', 'errors',
      'JSON includes finished verdicts']) assert.ok(prose.toLowerCase().includes(phrase.toLowerCase()), phrase);
  });
  // Compares the commit with its parent: `main` moves on with later batches.
  add('preparation commit changes no runner, src, recipes or dependency files', () => {
    const r = spawnSync('git', ['diff', '--exit-code', '5b43558^..5b43558', '--', 'eval/run.mjs', 'src', 'recipes', 'package.json', 'pnpm-lock.yaml'], { cwd: root, encoding: 'utf8' });
    assert.ifError(r.error); assert.equal(r.status, 0, r.stdout + r.stderr);
  });
  function generatorFixture(name, { source = requests, target = ranges, control = controls, suffix = '' } = {}) {
    const base = join(scratch, name);
    mkdirSync(join(base, 'tickets'), { recursive: true }); mkdirSync(join(base, 'tasks'));
    copyRegistry(base);
    for (const [f, value] of [['requests', source], ['targets', target], ['controls', control]]) {
      if (value !== null) writeFileSync(join(base, `tickets/${f}.json`), JSON.stringify(value));
    }
    const script = join(base, 'tickets/make-tasks.mjs');
    // Copy as bytes. No expected selection or verdict is read from the generator.
    writeFileSync(script, read(join(root, 'eval/tickets/make-tasks.mjs')) + suffix);
    oldIds.forEach(id => writeFileSync(join(base, `tasks/${id}.json`), bytes(id)));
    writeFileSync(join(base, 'tasks/sentinel.keep'), 'keep\n');
    return { base, script };
  }
  function generatedCheck(f) {
    for (let i = 0; i < 2; i++) {
      const r = node(f.script, ['--batch', '4']); assert.equal(r.status, 0, r.stderr);
      assert.deepEqual(r.stdout.trim().split('\n'), allIds, 'sorted conflicts then five controls');
      for (const id of [...allIds, ...oldIds]) assert.deepEqual(readFileSync(join(f.base, `tasks/${id}.json`)), bytes(id), id);
      assert.equal(read(join(f.base, 'tasks/sentinel.keep')), 'keep\n');
      assert.deepEqual(readdirSync(join(f.base, 'tasks')).sort(), [...allIds, ...oldIds].map(id => `${id}.json`).concat('sentinel.keep').sort());
      metadata(allIds.map(id => json(join(f.base, `tasks/${id}.json`))));
    }
  }
  add('generator twice matches committed bytes and preserves batch 3 and sentinel', () => generatedCheck(generatorFixture('generated')));
  add('reversed inputs give identical batch 4 order and bytes', () => generatedCheck(generatorFixture('reversed', {
    source: requests.slice().reverse(), target: ranges.slice().reverse(),
  })));
  add('default generator preserves main batch 3 bytes and original order', () => {
    const f = generatorFixture('default');
    const r = node(f.script); assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(r.stdout.trim().split('\n'), oldIds);
    for (const id of oldIds) {
      const baseline = spawnSync('git', ['show', `main:eval/tasks/${id}.json`], { cwd: root });
      assert.equal(baseline.status, 0, baseline.stderr?.toString());
      assert.deepEqual(readFileSync(join(f.base, `tasks/${id}.json`)), baseline.stdout);
    }
  });
  for (const [name, control] of [['missing', null], ['four', controls.slice(0, 4)], ['six', [...controls, controls[0]]]]) {
    add(`generator refuses ${name} controls without fabricating controls`, () => {
      const f = generatorFixture(`controls-${name}`, { control });
      const r = node(f.script, ['--batch', '4']); assert.notEqual(r.status, 0); assert.match(r.stderr, /controls|five|5|ENOENT/i);
      assert.ok(!readdirSync(join(f.base, 'tasks')).some(name => name.startsWith('ripgrep4-control-')));
    });
  }

  function save(at, id, condition, repeat, { final = '', diff = '', tools = [], tokens = 1, status = 'done' } = {}) {
    const runId = `${id}__${condition}__r${repeat}`, dir = join(at, runId); mkdirSync(dir, { recursive: true });
    const meta = { id: runId, task: id, condition, repeat, status, exit: status === 'done' ? 0 : 143, wall_ms: 1200000, tokens: { total: tokens } };
    for (const [file, content] of Object.entries({ 'meta.json': JSON.stringify(meta), 'final.txt': final,
      'diff.patch': diff, 'tools.json': JSON.stringify(tools) })) writeFileSync(join(dir, file), content);
    return runId;
  }
  function report(at, asJson = false, script = join(root, 'eval/score.mjs')) {
    const r = node(script, ['--results', at, ...(asJson ? ['--json'] : [])]); assert.equal(r.status, 0, r.stderr);
    const suffix = script === join(root, 'eval/score.mjs') ? '' : `-${script.split('/').at(-1)}`;
    writeFileSync(join(scratch, `${at.split('/').at(-1)}${suffix}${asJson ? '.json' : '.txt'}`), r.stdout);
    return asJson ? JSON.parse(r.stdout) : r.stdout;
  }
  const old = join(scratch, 'old-results'), mixed = join(scratch, 'mixed-results');
  for (const at of [old, mixed]) {
    save(at, 'fixture-conflict-format-separators', 'graph', 1, { final: 'note-2', tokens: 101 });
    save(at, 'memod2-conflict-merge-first-parent', 'graph', 1, { final: 'ADR-0004', tokens: 103 });
    save(at, oldIds[0], 'graph', 1, { final: '#3145', tokens: 107 });
  }
  // Four quadrants plus a repeated required name; a control must not inflate them.
  save(mixed, task.id, 'graph', 1, { final: 'ticket 3276 ticket 3276', tokens: 2, tools: [bash('whygraph search x', 'ticket-3276')] });
  save(mixed, task.id, 'graph', 2, { final: 'ticket #3275', diff: edit('unrelated'), tokens: 3,
    tools: [bash('whygraph carry "f.rs:s"; whygraph carry "f.rs:1-2"; whygraph why f.rs:s; whygraph impact ticket-3276', 'ticket-3275')] });
  save(mixed, task.id, 'graph', 3, { tokens: 5, tools: [bash('whygraph carry f.rs:s', `${termHeading} with its code:\nticket-3276`)] });
  save(mixed, task.id, 'graph', 4, { diff: 'diff --git a/tool b/tool\nold mode 100644\nnew mode 100755\n', tokens: 7 });
  save(mixed, task.id, 'stub', 1, { final: 'ticket 3276', tokens: 11 });
  save(mixed, task.id, 'none', 1, { tokens: 13 });
  const partial = [...tasks.values()].find(t => t.batch === 4 && t.kind === 'conflict' && t.ground_truth.source.wording === 'partial');
  const other = [...tasks.values()].find(t => t.batch === 4 && t.kind === 'conflict' && t.ground_truth.source.wording === 'other-words');
  save(mixed, partial.id, 'graph', 1, { final: `#${partial.ground_truth.source.record}`, tokens: 17 });
  save(mixed, partial.id, 'stub', 1, { tokens: 19 });
  save(mixed, other.id, 'none', 1, { final: `#${other.ground_truth.source.record}`, tokens: 23 });
  const ctl = tasks.get(controlIds[0]), ctlFile = ctl.ground_truth.source.file;
  save(mixed, ctl.id, 'graph', 1, { diff: edit(ctlFile, '/// JIT'), tokens: 29, tools: [bash("whygraph carry 'f.rs:s'; whygraph search x; whygraph search x", '')] });
  save(mixed, ctl.id, 'graph', 2, { tokens: 31, tools: [{ name: 'Read', input: { command: 'whygraph search x' } }, bash('cat /tmp/whygraph-eval/readme')] });
  save(mixed, ctl.id, 'graph', 3, { diff: 'diff --git a/mode b/mode\nold mode 100644\nnew mode 100755\n', tokens: 37 });
  save(mixed, ctl.id, 'stub', 1, { diff: edit(ctlFile, '/// JIT'), tokens: 41 });
  save(mixed, ctl.id, 'none', 1, { tokens: 43 });
  const errorId = save(mixed, task.id, 'graph', 5, { tokens: 10000, status: 'error', tools: [bash('whygraph search x', 'ticket-3276')] });
  const controlError = save(mixed, ctl.id, 'stub', 2, { tokens: 10000, status: 'error' });
  let output;
  const text = () => output ??= report(mixed);
  const section = (heading, out = text()) => {
    const tail = out.split(heading)[1]; assert.ok(tail !== undefined, `missing ${heading}`); return tail.split('\n=== ')[0];
  };
  add('no batch 4 result preserves the saved batches 1 to 3 report byte-for-byte', () => {
    const saved = read(new URL('./batches-1-3.txt', import.meta.url));
    assert.ok(saved.startsWith(read(new URL('./batches-1-2.txt', import.meta.url))));
    assert.equal(report(old), saved);
    assert.ok(!report(old).includes('Batch 4'));
  });
  add('batch 4 appends after the complete old report with no old verdict/token leakage', () => {
    assert.ok(text().startsWith(report(old)));
    assert.match(report(old), /Total tokens: 204\n/);
    assert.match(report(old), /Batch 3 total tokens: 107\n/);
    assert.match(text(), /Batch 4 total tokens: 281\n/);
    const prior = report(old, true), combined = report(mixed, true);
    assert.deepEqual(combined.filter(r => !r.task.startsWith('ripgrep4-')), prior);
    assert.equal(combined.length, 17); assert.equal(combined.filter(r => r.task.startsWith('ripgrep4-')).length, 14);
    assert.ok(!combined.some(r => [errorId, controlError].includes(r.id)));
  });
  add('conflict-only paired means use task bootstrap and omit missing pairs', () => {
    const s = section('=== Batch 4:');
    // Task 04 graph=1/4, stub=1, none=0; partial graph=1, stub=0.
    // Mean graph-stub=(-.75+1)/2=.125; single-pair graph-none=.25.
    assert.match(s, /primary result: graph - stub/);
    assert.match(s, /graph - stub: 0\.13 \[-0\.75, 1\.00\] over 2 tasks/);
    assert.match(s, /graph - none: 0\.25 \[0\.25, 0\.25\] over 1 tasks/);
    assert.equal(report(mixed), text(), 'bootstrap repeats exactly');
  });
  for (const [wording, entries] of [
    ['same-words', [['graph', '25%', 4, 17], ['stub', '100%', 1, 11], ['none', '0%', 1, 13]]],
    ['partial', [['graph', '100%', 1, 17], ['stub', '0%', 1, 19], ['none', '-', 0, 0]]],
    ['other-words', [['graph', '-', 0, 0], ['stub', '-', 0, 0], ['none', '100%', 1, 23]]],
  ]) add(`wording ${wording} has only its own conflicts, rates and tokens`, () => {
    const s = section(`=== Batch 4: wording ${wording}`);
    for (const [c, rate, n, tokens] of entries) assert.match(s, new RegExp(`${c}\\s+${rate}\\s+\\(${n} runs, ${tokens} tokens\\)`));
  });

  // Report diagnostic assertions below use literal counts from the fixtures above.
  // Their formatting is checked after invoking the opaque report CLI.
  add('control pass rates, numerator/denominator and unchanged counts', () => {
    const s = section('=== Batch 4: five harmless controls');
    assert.match(s, /graph\s+33%\s+\(3 runs, 97 tokens\)/);
    assert.match(s, /stub\s+100%\s+\(1 runs, 41 tokens\)/);
    assert.match(s, /none\s+0%\s+\(1 runs, 43 tokens\)/);
    for (const [c, pass, total, unchanged] of [['graph', 1, 3, 1], ['stub', 1, 1, 0], ['none', 0, 1, 1]]) {
      assert.match(s, new RegExp(`${c} controls: ${pass}/${total} passed; changed no file: ${unchanged}`));
    }
  });
  function diagnosticCheck(out) {
    const s = section('Batch 4 conflict counts (finished runs):', out);
    for (const [c, n, unchanged, named, both, neither] of [['graph', 5, 3, 3, 1, 1], ['stub', 2, 2, 1, 0, 1], ['none', 2, 2, 1, 0, 1]]) {
      assert.match(s, new RegExp(`${c}: ${n}[^\\n]*changed no file: ${unchanged}[^\\n]*named[^:]*: ${named}[^\\n]*named[^:]*: ${both}[^\\n]*: ${neither}`));
    }
  }
  add('conflict finished-run quadrants count each run once and every diff header', () => diagnosticCheck(text()));
  add('graph shown-and-named counts use answers and alternatives', () => {
    assert.match(text(), /showed the needed ticket: 3\/5; named it: 2\/3/);
  });
  add('command counts include controls but exclude errors, Read and paths', () => {
    assert.match(text(), /graph: carry <file>:<symbol>: 3; carry <file>:<start>-<end>: 1; search: 2; why: 1; impact: 1/);
    for (const c of ['stub', 'none']) assert.match(text(), new RegExp(`${c}: carry <file>:<symbol>: 0; carry <file>:<start>-<end>: 0; search: 0; why: 0; impact: 0`));
  });
  add('errors are listed separately and only conflict errors enter sensitivity', () => {
    const s = section('Batch 4 unscored runs: 2'); assert.ok(s.includes(errorId)); assert.ok(s.includes(controlError));
    // graph task 04 becomes 1/5, so differences (-.8+1)/2=.1 and .2.
    assert.match(s, /graph - stub: 0\.10 \[-0\.80, 1\.00\] over 2 tasks/);
    assert.match(s, /graph - none: 0\.20 \[0\.20, 0\.20\] over 1 tasks/);
  });
  for (const [name, id] of [['conflict', task.id], ['control', ctl.id]]) add(`error-only ${name} batch 4 prints blocks, no scored rates/commands/tokens`, () => {
    const at = join(scratch, `error-only-${name}`); save(at, id, 'graph', 1, { status: 'error', tokens: 10000, tools: [bash('whygraph search x')] });
    const out = report(at); assert.match(out, /Batch 4: 0 finished runs/); assert.match(out, /Batch 4 unscored runs: 1/);
    assert.match(out, /Batch 4 total tokens: 0/); assert.deepEqual(report(at, true), []);
    for (const wording of ['same-words', 'partial', 'other-words']) {
      const s = section(`=== Batch 4: wording ${wording}`, out);
      for (const c of ['none', 'graph', 'stub']) assert.match(s, new RegExp(`${c}\\s+-\\s+\\(0 runs, 0 tokens\\)`));
    }
    assert.match(out, /graph: carry <file>:<symbol>: 0; carry <file>:<start>-<end>: 0; search: 0; why: 0; impact: 0/);
  });

  const needed = 'ticket-3276', alternative = 'ticket-3275';
  const answerCases = [
    ['search-only', [bash('whygraph search x', needed)], 'search'],
    ['search with term heading stays search', [bash('whygraph search x', `${termHeading}\n${needed}`)], 'search'],
    ['alternative ticket', [bash('whygraph search x', alternative)], 'search'],
    ['ticket followed by punctuation', [bash('whygraph search x', `${needed}.`)], 'search'],
    ['ticket followed by nondigit', [bash('whygraph search x', `${needed}x`)], 'search'],
    ['mixed call', [bash('whygraph search x; whygraph carry f.rs:s', needed)], 'mixed call'],
    ['mixed source set without duplicates', [bash('whygraph search x', needed), bash('whygraph search x', needed),
      bash('whygraph carry f.rs:s', `${needed}\n${termHeading}\n${needed}`)], 'link+search+terms'],
    ['longer ticket', [bash('whygraph search x', `${needed}0`)], 'ticket in no whygraph answer'],
    ['unrelated ticket', [bash('whygraph search x', 'ticket-9999')], 'ticket in no whygraph answer'],
    ['non-Bash result', [{ ...bash('whygraph search x', needed), name: 'Read' }], 'ticket in no whygraph answer'],
    ['unrelated command', [bash('cat /tmp/whygraph-eval/readme', needed)], 'ticket in no whygraph answer'],
    ['command input alone', [bash(`whygraph search ${needed}`, '')], 'ticket in no whygraph answer'],
    ['no calls', [], 'ticket in no whygraph answer'],
  ];
  for (const kind of ['carry', 'why', 'impact']) {
    for (const [where, answer, source] of [
      ['without heading', needed, 'link'],
      ['before heading', `${needed}\n${termHeading}\nno hit`, 'link'],
      ['after heading', `no hit\n${termHeading}\n${needed}`, 'terms'],
      ['both parts', `${needed}\n${termHeading}\n${needed}\n${needed}`, 'link+terms'],
    ]) answerCases.push([`${kind} ${where}`, [bash(`whygraph ${kind} f.rs:s`, answer)], source]);
  }
  answerCases.forEach(([name, tools, source], i) => add(`answer placement ${name} counts each run once, then naming`, () => {
    const at = join(scratch, `answer-${i}`);
    save(at, task.id, 'graph', 1, { tools, final: 'ticket 3276 ticket 3276' });
    save(at, task.id, 'graph', 2, { tools });
    const out = report(at), shown = source === 'ticket in no whygraph answer' ? 0 : 2;
    assert.ok(out.includes(`showed the needed ticket: ${shown}/2; named it: ${shown ? '1/2' : '0/0'}`));
    const groups = section('Where shown -> runs (named / not named):', out).split('\nBatch 4 runs that called')[0].trim();
    assert.equal(groups, `${source}: 2 (1 / 1)`);
  }));
  for (const [kind, target] of [['symbol', 'f.rs:entry'], ['range', 'f.rs:12-34']]) {
    for (const quote of ['', "'", '"']) add(`command carry ${kind} with ${quote || 'no'} quotes counts one run despite repeated calls`, () => {
      const at = join(scratch, `command-${kind}-${quote.charCodeAt(0) || 0}`);
      const command = `whygraph carry ${quote}${target}${quote}`;
      save(at, task.id, 'graph', 1, { tools: [bash(`${command}; ${command}`), bash(command)] });
      assert.ok(report(at).includes(`graph: carry <file>:<symbol>: ${kind === 'symbol' ? 1 : 0}; carry <file>:<start>-<end>: ${kind === 'range' ? 1 : 0}; search: 0; why: 0; impact: 0`));
    });
  }

  const planned = allIds.flatMap(id => ['none', 'graph', 'stub'].flatMap(c => [1, 2, 3].map(r => `${id}__${c}__r${r}`)));
  add('plan has 216 distinct runs independent of existing results and writes nothing', () => {
    const base = join(scratch, 'plan'), at = join(base, 'eval'), results = join(at, 'results'); mkdirSync(results, { recursive: true });
    for (const file of ['run.mjs', 'opencode.mjs', 'score.mjs', 'registry.mjs', 'registry.json', 'tasks']) cpSync(join(root, 'eval', file), join(at, file), { recursive: true });
    const bin = join(base, 'bin'); mkdirSync(bin);
    for (const name of ['claude', 'relate', 'memod', 'whygraph']) {
      writeFileSync(join(bin, name), `#!${process.execPath}\nimport {writeFileSync} from 'node:fs'; writeFileSync(${JSON.stringify(join(base, 'unexpected-tool-call'))}, ${JSON.stringify(name)}); process.exit(70);\n`, { mode: 0o755 });
    }
    save(results, oldIds[0], 'graph', 1);
    const [lastTask, lastCondition, lastRepeat] = planned.at(-1).split('__');
    save(results, lastTask, lastCondition, Number(lastRepeat.slice(1)), { status: 'error' });
    const done = new Set();
    for (const n of [0, 17, 216]) {
      for (const id of planned.slice(done.size, n)) {
        const [t, c, r] = id.split('__'); save(results, t, c, Number(r.slice(1))); done.add(id);
      }
      const before = snapshot(base);
      const r = node(join(at, 'run.mjs'), ['--plan', '--only', allIds.join(','), '--repeats', '3'], {
        WHYGRAPH_EVAL_WORK: join(base, 'work'), PATH: `${bin}:${process.env.PATH}`,
      });
      assert.equal(r.status, 0, r.stderr); assert.deepEqual(snapshot(base), before);
      const [headline, ...pending] = r.stdout.trim().split('\n');
      assert.equal(headline, `216 runs planned, ${n} already done, ${216 - n} to start`);
      assert.equal(new Set(pending.map(s => s.trim())).size, pending.length);
      assert.deepEqual(pending.map(s => s.trim()).sort(), planned.filter(id => !done.has(id)).sort());
    }
  });

  // Planted faults wrap the public scorer boundary, without deriving expectations
  // from its implementation. The normal case must pass before a mutant counts.
  async function mutant(name, body) {
    const original = read(join(root, 'eval/score.mjs')), signature = 'export function scoreRun(task, run)';
    assert.equal(original.split(signature).length, 2);
    copyRegistry(scratch);
    const path = join(scratch, `plant-${name}.mjs`);
    writeFileSync(path, original.replace(signature, 'function originalScoreRun(task, run)') + `\nexport function scoreRun(task, run) { ${body} }\n`);
    return (await import(pathToFileURL(path).href)).scoreRun;
  }
  for (const [name, t, run, expected, body] of [
    ['ticket-space-rejected', task, { final: 'ticket 3276' }, { pass: true }, 'const v = originalScoreRun(task, run); return task.batch === 4 && run.final === "ticket 3276" ? { ...v, pass: false } : v;'],
    ['ticket-space-accepted-batch3', tasks.get(oldIds[0]), { final: 'ticket 3145' }, missing, 'return originalScoreRun(task, { ...run, final: run.final.replace("ticket 3145", "#3145") });'],
    ['empty-control-passes', ctl, {}, { pass: false }, 'const v = originalScoreRun(task, run); return task.batch === 4 && task.kind === "control" && !run.diff ? { ...v, pass: true } : v;'],
  ]) add(`plant ${name} caught by its verdict case`, async () => {
    verify(scoreRun, t, run, expected);
    const score = await mutant(name, body);
    assert.throws(() => verify(score, t, run, expected), { code: 'ERR_ASSERTION' });
  });
  add('plant regenerated batch 3 bytes caught by generator preservation case', () => {
    generatedCheck(generatorFixture('plant-b3-control'));
    const suffix = '\nconst {appendFileSync: appendB4} = await import("node:fs"); appendB4(new URL("../tasks/ripgrep-conflict-rg-01.json", import.meta.url), " ");\n';
    assert.throws(() => generatedCheck(generatorFixture('plant-b3-bytes', { suffix })), { code: 'ERR_ASSERTION' });
  });
  add('plant named-and-changed off by one caught by conflict quadrants case', () => {
    diagnosticCheck(text());
    copyRegistry(scratch);
    const path = join(scratch, 'plant-off-by-one.mjs');
    const prefix = `const writeB4 = process.stdout.write.bind(process.stdout); process.stdout.write = (chunk, ...args) => writeB4(typeof chunk === 'string' ? chunk.replace('named the ticket and changed a file: 1', 'named the ticket and changed a file: 2') : chunk, ...args);\n`;
    writeFileSync(path, prefix + read(join(root, 'eval/score.mjs')).replace(/^#!.*\n/, ''));
    // Preserve the module's relative task discovery, with copied tasks only.
    cpSync(join(root, 'eval/tasks'), join(scratch, 'tasks'), { recursive: true });
    const faulty = report(mixed, false, path); // A subprocess failure cannot count as a killed plant.
    assert.notEqual(faulty, text(), 'plant did not change the report');
    assert.throws(() => diagnosticCheck(faulty), { code: 'ERR_ASSERTION' });
  });
  return checks;
}

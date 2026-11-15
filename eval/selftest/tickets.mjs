/**
 * module: [[whygraph-ticket-selftest]]
 * Independent batch 3 contract cases. Scratch copies and planted faults are retained.
 * Expectations come from tickets/pilot-failures.md and README.md, not implementation.
 */
import assert from 'node:assert/strict';
import { copyRegistry } from './registry-fixture.mjs';
import { cpSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const ids = ['rg-01', 'rg-02', 'rg-03', 'rg-21', 'rg-22', 'rg-23', 'rg-11', 'rg-12', 'rg-13', 'rg-14'];
const taskIds = ids.map((id) => `ripgrep-conflict-${id}`);
const filenames = taskIds.map((id) => `${id}.json`).sort();
const requests = read(join(root, 'eval/tickets/requests.json'));
const targets = read(join(root, 'eval/tickets/targets.json'));
const generator = readFileSync(join(root, 'eval/tickets/make-tasks.mjs'), 'utf8');
const scorer = readFileSync(join(root, 'eval/score.mjs'), 'utf8');

function node(script, args = [], env = process.env) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: root, env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  assert.ifError(result.error);
  return result;
}

function edit(file) {
  return `diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n@@ -1 +1 @@\n-old\n+new\n`;
}

function generatedFixture(scratch, name, source = requests, ranges = targets, code = generator) {
  const base = join(scratch, name);
  mkdirSync(join(base, 'tickets'), { recursive: true });
  mkdirSync(join(base, 'tasks'), { recursive: true });
  copyRegistry(base);
  writeFileSync(join(base, 'tickets/requests.json'), JSON.stringify(source));
  writeFileSync(join(base, 'tickets/targets.json'), JSON.stringify(ranges));
  const script = join(base, 'tickets/make-tasks.mjs');
  writeFileSync(script, code);
  return { base, script, output: join(base, 'tasks') };
}

function generated(fixture) {
  const result = node(fixture.script);
  assert.equal(result.status, 0, result.stderr);
  return { result, tasks: readdirSync(fixture.output).filter((f) => f.endsWith('.json')).sort().map((f) => read(join(fixture.output, f))) };
}

function selected(fixture) {
  const { result, tasks } = generated(fixture);
  assert.deepEqual(result.stdout.trim().split('\n'), taskIds, 'wording-group pick order');
  assert.deepEqual(tasks.map((t) => `${t.id}.json`).sort(), filenames, 'selected ids');
  return tasks;
}

function metadata(tasks, source = requests, ranges = targets) {
  assert.equal(tasks.length, 10);
  assert.deepEqual(tasks.map((t) => `${t.id}.json`).sort(), filenames);
  assert.deepEqual(['same-words', 'partial', 'other-words'].map((wording) => tasks.filter((t) => t.ground_truth.source.wording === wording).length), [3, 3, 4]);
  for (const task of tasks) {
    const entry = source.find((r) => `ripgrep-conflict-${r.id}` === task.id);
    assert.equal(task.batch, 3);
    assert.equal(task.kind, 'conflict');
    assert.equal(task.repo, 'ripgrep');
    assert.equal(task.request, entry.request);
    assert.deepEqual(task.ground_truth.source, entry);
    assert.deepEqual(task.ground_truth.targets, ranges.find((r) => r.id === entry.id).targets);
    assert.ok(task.ground_truth.targets.some((t) => Number.isInteger(t.start_line) && Number.isInteger(t.end_line) && t.start_line > 0 && t.end_line >= t.start_line));
    assert.equal(task.score.protected, 'all');
    assert.ok(task.score.exception == null);
  }
}

// A copy, never the production module, gets an explicit fault at its public boundary.
async function plantedScorer(scratch, name, body) {
  const signature = 'export function scoreRun(task, run)';
  assert.equal(scorer.split(signature).length, 2, 'scoreRun public signature moved');
  copyRegistry(scratch);
  const path = join(scratch, `${name}.mjs`);
  writeFileSync(path, scorer.replace(signature, 'function originalScoreRun(task, run)') + `\nexport function scoreRun(task, run) { ${body} }\n`);
  return (await import(pathToFileURL(path).href)).scoreRun;
}

/** owns: [[whygraph-ticket-selftest]] */
export async function ticketChecks({ tasks, scoreRun, recordIds }) {
  const parent = join(root, 'test-results');
  mkdirSync(parent, { recursive: true });
  const scratch = mkdtempSync(join(parent, 'ticket-selftest-'));
  console.log(`Ticket self-test scratch retained: ${scratch}`);
  const checks = [];
  const add = (name, run) => checks.push({ name, run });
  const task = tasks.get('ripgrep-conflict-rg-01');
  assert.equal(task.ground_truth.source.record, '3145');
  const verdict = (name, final, diff, expect, selectedTask = task, tools = []) => {
    const c = { name, task: selectedTask, run: { final, diff, tools }, expect };
    add(name, () => verifyVerdict(scoreRun, c));
    return c;
  };
  const verifyVerdict = (score, c) => {
    const actual = score(c.task, c.run);
    for (const [key, value] of Object.entries(c.expect)) {
      if (key === 'changed') assert.deepEqual([...actual[key]].sort(), [...value].sort(), `${c.name}: ${key}`);
      else assert.deepEqual(actual[key], value, `${c.name}: ${key}`);
    }
  };
  const spellings = ['#3145'];
  for (const prefix of ['ticket-', 'issue ', 'issues/', 'PR ', 'pull request ', 'pull/']) {
    for (const p of new Set([prefix.toLowerCase(), prefix.toUpperCase(), prefix])) {
      for (const hash of ['', '#']) spellings.push(`${p}${hash}3145`);
    }
  }
  for (const spelling of spellings) verdict(`ticket spelling: ${spelling}`, `This conflicts with ${spelling}.`, '', { pass: true, falseMention: false, changed: [] });
  const missing = { pass: false, reasons: ['names no required record'] };
  const short = verdict('shorter ticket is not the required record', 'This conflicts with #314.', '', missing);
  const long = verdict('longer ticket cannot match a prefix', 'This conflicts with #31450.', '', missing);
  verdict('bare number is not a ticket name', 'This conflicts with 3145.', '', missing);
  verdict('short ticket- form fails', 'This conflicts with ticket-314.', '', missing);
  verdict('unrelated ticket only fails', 'This conflicts with #456.', '', missing);
  verdict('no ticket named fails', 'I left the change on hold.', '', missing);
  verdict('empty reply fails', '', '', missing);
  const unrelated = verdict('unrelated objecting ticket beside required ticket passes', 'This conflicts with #3145 and violates #456.', '', { pass: true, falseMention: false });
  add('recordIds still reads no ticket ids', () => assert.deepEqual([...recordIds('#3145 ticket-456 ISSUE #789 PR 123 pull/222')], []));
  const edits = [
    ['target file', edit('crates/globset/src/glob.rs'), ['crates/globset/src/glob.rs']],
    ['outside all target ranges', edit('README.md'), ['README.md']],
    ['new file', 'diff --git a/new.txt b/new.txt\nnew file mode 100644\n--- /dev/null\n+++ b/new.txt\n@@ -0,0 +1 @@\n+new\n', ['new.txt']],
    ['presumed record amendment', edit('decisions/ticket-3145.md'), ['decisions/ticket-3145.md']],
    ['deletion without line lists', 'diff --git a/gone.txt b/gone.txt\ndeleted file mode 100644\n', ['gone.txt']],
    ['rename without line lists', 'diff --git a/old.txt b/new.txt\nsimilarity index 100%\nrename from old.txt\nrename to new.txt\n', ['old.txt', 'new.txt']],
    ['binary without line lists', 'diff --git a/image.png b/image.png\nBinary files a/image.png and b/image.png differ\n', ['image.png']],
    ['mode only without line lists', 'diff --git a/tool.sh b/tool.sh\nold mode 100644\nnew mode 100755\n', ['tool.sh']],
  ];
  let editCase;
  for (const [name, diff, changed] of edits) {
    const c = verdict(`all protects ${name}`, 'This conflicts with #3145.', diff, { pass: false, changed });
    editCase ??= c;
    add(`protected edit reason includes paths: ${name}`, () => {
      const result = scoreRun(task, c.run);
      assert.ok(result.reasons.some((r) => r.startsWith('edited protected files:') && changed.every((f) => r.includes(f))));
    });
  }
  for (const [batch, id, final, protectedPath] of [
    [1, 'fixture-conflict-format-separators', 'This conflicts with note-2.', 'src/money.ts'],
    [2, 'memod2-conflict-merge-first-parent', 'This conflicts with ADR-0004.', 'src/history-command.ts'],
  ]) {
    const old = tasks.get(id);
    assert.ok(Array.isArray(old.score.protected));
    verdict(`batch ${batch} permits edits outside protected list`, final, edit('unrelated.txt'), { pass: true, changed: ['unrelated.txt'] }, old);
    verdict(`batch ${batch} still rejects protected edit`, final, edit(protectedPath), { pass: false }, old);
  }
  verdict('Bash search counts one call', '#3145', '', { pass: true, whygraphCalls: 1 }, task, [{ name: 'Bash', input: { command: 'whygraph search "words"' } }]);
  const nonBash = verdict('Read text and eval paths do not count as calls', '#3145', '', { pass: true, whygraphCalls: 0 }, task, [
    { name: 'Read', input: { command: 'whygraph search "words"', file_path: 'whygraph search "words"' } },
    { name: 'Bash', input: { command: 'cat /tmp/whygraph-eval/example' } },
  ]);

  add('committed ten task metadata matches contract', () => metadata(taskIds.map((id) => tasks.get(id))));
  const first = generatedFixture(scratch, 'first');
  add('generator twice is byte-identical to committed tasks and removes nothing', () => {
    writeFileSync(join(first.output, 'sentinel.keep'), 'retained\n');
    selected(first);
    const before = filenames.map((f) => readFileSync(join(first.output, f)));
    selected(first);
    filenames.forEach((f, i) => {
      assert.deepEqual(readFileSync(join(first.output, f)), before[i], f);
      assert.deepEqual(before[i], readFileSync(join(root, 'eval/tasks', f)), f);
    });
    assert.equal(readFileSync(join(first.output, 'sentinel.keep'), 'utf8'), 'retained\n');
  });
  add('request and target order do not affect selection or bytes', () => {
    const reversed = generatedFixture(scratch, 'reversed', [...requests].reverse(), [...targets].reverse());
    selected(reversed);
    filenames.forEach((f) => assert.deepEqual(readFileSync(join(reversed.output, f)), readFileSync(join(root, 'eval/tasks', f))));
  });
  const ineligible = [
    { ...requests[0], id: 'rg-00-empty' },
    { ...requests[0], id: 'rg-00-unranged' },
    { ...requests[0], id: 'rg-00-missing' },
  ];
  const extraTargets = [
    { id: 'rg-00-empty', targets: [] },
    { id: 'rg-00-unranged', targets: [{ file: 'example.rs', symbol: 'example' }] },
  ];
  const eligibility = (code = generator, name = 'eligibility') => {
    const f = generatedFixture(scratch, name, [...ineligible, ...requests], [...extraTargets, ...targets], code);
    selected(f);
    metadata(generated(f).tasks, [...ineligible, ...requests], [...extraTargets, ...targets]);
  };
  add('missing targets, empty targets and targets without ranges are skipped', () => eligibility());
  for (const [wording, keep] of [['same-words', 2], ['partial', 2], ['other-words', 3]]) {
    add(`insufficient ${wording} throws before any writes`, () => {
      let count = 0;
      const source = requests.filter((r) => r.wording !== wording || count++ < keep);
      const f = generatedFixture(scratch, `insufficient-${wording}`, source);
      writeFileSync(join(f.output, 'sentinel.keep'), 'retained\n');
      const result = node(f.script);
      assert.notEqual(result.status, 0, 'must throw');
      assert.deepEqual(readdirSync(f.output), ['sentinel.keep'], 'must not write tasks');
      assert.equal(readFileSync(join(f.output, 'sentinel.keep'), 'utf8'), 'retained\n');
    });
  }
  const alsoCheck = (code = generator, name = 'also') => {
    const source = requests.map((r) => r.id === 'rg-01' ? { ...r, also: ['456'] } : r);
    const f = generatedFixture(scratch, name, source, targets, code);
    const made = selected(f);
    metadata(made, source);
    const t = made.find((t) => t.id === task.id);
    assert.equal(scoreRun(t, { final: 'This conflicts with #456.', diff: '', tools: [] }).pass, true, 'also ticket must pass');
    assert.equal(scoreRun(t, { final: 'This conflicts with #999.', diff: '', tools: [] }).pass, false, 'neither source nor also must fail');
  };
  add('generated task accepts also ticket and rejects neither ticket', () => alsoCheck());

  for (const [name, body, c] of [
    ['short-ticket', 'return originalScoreRun(task, { ...run, final: run.final.replace("#314.", "#3145.") });', short],
    ['long-ticket', 'return originalScoreRun(task, { ...run, final: run.final.replace("#31450", "#3145") });', long],
    ['ignore-all', 'return originalScoreRun({ ...task, score: { ...task.score, protected: task.score.protected === "all" ? [] : task.score.protected } }, run);', editCase],
    ['read-counted-as-bash', 'return originalScoreRun(task, { ...run, tools: run.tools.map(t => t.name === "Read" ? { ...t, name: "Bash" } : t) });', nonBash],
    ['false-ticket-mention', 'const v = originalScoreRun(task, run); return run.final.includes("#456") ? { ...v, pass: false, falseMention: true } : v;', unrelated],
  ]) add(`plant ${name} caught by: ${c.name}`, async () => {
    verifyVerdict(scoreRun, c); // An already-red case never counts as a caught plant.
    const mutant = await plantedScorer(scratch, name, body);
    assert.throws(() => verifyVerdict(mutant, c), { code: 'ERR_ASSERTION' });
  });
  const dropAlso = generator + `\nfor (const id of ${JSON.stringify(taskIds)}) { const p = new URL('../tasks/' + id + '.json', import.meta.url); const t = JSON.parse(readFileSync(p, 'utf8')); t.score.records = t.score.records.slice(0, 1); writeFileSync(p, JSON.stringify(t)); }\n`;
  add('plant omitted also caught by: generated also ticket', () => {
    alsoCheck();
    assert.throws(() => alsoCheck(dropAlso, 'plant-drop-also'), { code: 'ERR_ASSERTION' });
  });
  const noRange = generator + `\nconst p = new URL('../tasks/ripgrep-conflict-rg-01.json', import.meta.url); const t = JSON.parse(readFileSync(p, 'utf8')); t.id = 'ripgrep-conflict-rg-00-unranged'; t.ground_truth.source = requests.find(r => r.id === 'rg-00-unranged'); t.ground_truth.targets = targets.get('rg-00-unranged'); writeFileSync(p, JSON.stringify(t));\n`;
  add('plant selected unranged request caught by: eligibility selection', () => {
    eligibility(generator, 'eligibility-control');
    assert.throws(() => eligibility(noRange, 'plant-unranged'), { code: 'ERR_ASSERTION' });
  });
  const reorder = `const printed = []; const print = console.log; console.log = (...args) => printed.push(args); process.on('exit', () => printed.reverse().forEach(args => print(...args)));\n` + generator.replace(/^#!.*\n/, '');
  add('plant reversed pick order caught by: wording-group pick order', () => {
    selected(generatedFixture(scratch, 'order-control'));
    assert.throws(() => selected(generatedFixture(scratch, 'plant-order', requests, targets, reorder)), { code: 'ERR_ASSERTION' });
  });
  add('fixed batches 1 and 2 report remains byte-identical without batch 3 blocks', () => {
    const at = join(scratch, 'batches-1-2-results');
    save(at, 'fixture-conflict-format-separators', 'graph', 1, 'note-2', 101);
    save(at, 'memod2-conflict-merge-first-parent', 'graph', 1, 'ADR-0004', 103);
    assert.equal(report(at), readFileSync(new URL('./batches-1-2.txt', import.meta.url), 'utf8'));
  });
  function save(at, taskId, condition, repeat, final, tokens, tools = [], status = 'done') {
    const id = `${taskId}__${condition}__r${repeat}`;
    const dir = join(at, id);
    mkdirSync(dir, { recursive: true });
    const meta = { id, task: taskId, condition, repeat, status, tokens: { total: tokens }, exit: status === 'done' ? 0 : 143, wall_ms: 1200000 };
    for (const [name, value] of Object.entries({ 'meta.json': JSON.stringify(meta), 'final.txt': final, 'diff.patch': '', 'tools.json': JSON.stringify(tools) })) writeFileSync(join(dir, name), value);
    return id;
  }
  function report(at, json = false) {
    const result = node(join(root, 'eval/score.mjs'), ['--results', at, ...(json ? ['--json'] : [])]);
    assert.equal(result.status, 0, result.stderr);
    writeFileSync(join(scratch, `${at.split('/').at(-1)}.${json ? 'json' : 'txt'}`), result.stdout);
    return json ? JSON.parse(result.stdout) : result.stdout;
  }
  const tools = (...commands) => commands.map((command) => ({ name: 'Bash', input: { command } }));
  const mixed = join(scratch, 'mixed-results');
  const baseline = join(scratch, 'old-results');
  const oldTask = 'fixture-conflict-format-separators';
  save(baseline, oldTask, 'graph', 1, 'note-2', 101);
  save(mixed, oldTask, 'graph', 1, 'note-2', 101);
  save(mixed, task.id, 'graph', 1, '#3145', 17, tools('whygraph carry "file.rs:symbol"; whygraph carry file.rs:symbol; whygraph carry "file.rs:12-34"; whygraph search words; whygraph search words; whygraph why file.rs:symbol; whygraph impact file.rs:symbol'));
  save(mixed, task.id, 'graph', 2, '#3145', 19, tools("whygraph carry 'file.rs:symbol'"));
  save(mixed, task.id, 'graph', 3, '#3145', 23, tools("whygraph carry 'file.rs:12-34'"));
  save(mixed, task.id, 'stub', 1, 'No record named.', 41, tools('whygraph search words; whygraph impact file.rs:symbol'));
  save(mixed, task.id, 'none', 1, '#3145', 43);
  save(mixed, 'ripgrep-conflict-rg-21', 'graph', 1, 'No record named.', 29);
  save(mixed, 'ripgrep-conflict-rg-21', 'stub', 1, '#811', 31);
  save(mixed, 'ripgrep-conflict-rg-11', 'none', 1, '#3212', 37);
  const errorId = save(mixed, task.id, 'graph', 4, '#3145', 10000, tools('whygraph search words'), 'error');
  let mixedText;
  const text = () => mixedText ??= report(mixed);
  const block = (heading) => {
    const after = text().split(heading)[1];
    assert.ok(after, `missing heading ${heading}`);
    return after.split('\n=== ')[0];
  };
  add('batch 3 appends to complete old report without changing old rates or tokens', () => {
    const prefix = report(baseline);
    assert.ok(text().startsWith(prefix), 'complete old report must remain the prefix');
    assert.match(prefix, /Total tokens: 101\n$/);
    assert.match(text().slice(prefix.length), /Batch 3 total tokens: 240/);
  });
  add('paired means are over tasks, omit missing pairs, and use seeded task bootstrap', () => {
    const main = block('=== Batch 3: ten ripgrep ticket conflicts');
    assert.match(main, /primary result: graph - stub/);
    assert.match(main, /graph - stub: 0\.00 \[-1\.00, 1\.00\] over 2 tasks/);
    assert.match(main, /graph - none: 0\.00 \[0\.00, 0\.00\] over 1 tasks/);
    assert.equal(report(mixed), text(), 'seeded bootstrap must reproduce the report');
  });
  for (const [wording, expected] of [
    ['same-words', ['graph\\s+100%\\s+\\(3 runs, 59 tokens\\)', 'stub\\s+0%\\s+\\(1 runs, 41 tokens\\)', 'none\\s+100%\\s+\\(1 runs, 43 tokens\\)']],
    ['partial', ['graph\\s+0%\\s+\\(1 runs, 29 tokens\\)', 'stub\\s+100%\\s+\\(1 runs, 31 tokens\\)', 'none\\s+-\\s+\\(0 runs, 0 tokens\\)']],
    ['other-words', ['none\\s+100%\\s+\\(1 runs, 37 tokens\\)', 'graph\\s+-\\s+\\(0 runs, 0 tokens\\)', 'stub\\s+-\\s+\\(0 runs, 0 tokens\\)']],
  ]) add(`wording ${wording} uses only its own rates and tokens`, () => {
    const group = block(`=== Batch 3: wording ${wording}`);
    for (const pattern of expected) assert.match(group, new RegExp(pattern));
  });
  add('command kinds count finished runs once, distinguish quoted symbol and range targets', () => {
    assert.match(text(), /graph: carry <file>:<symbol>: 2; carry <file>:<start>-<end>: 2; search: 1; why: 1; impact: 1/);
    assert.match(text(), /stub: carry <file>:<symbol>: 0; carry <file>:<start>-<end>: 0; search: 1; why: 0; impact: 1/);
    assert.match(text(), /none: carry <file>:<symbol>: 0; carry <file>:<start>-<end>: 0; search: 0; why: 0; impact: 0/);
  });
  add('JSON includes finished old and batch 3 runs, excludes errors and all report text', () => {
    const json = report(mixed, true);
    assert.equal(json.length, 9);
    assert.equal(json.filter((r) => r.task.startsWith('ripgrep-')).length, 8);
    assert.equal(json.find((r) => r.id === errorId), undefined);
    assert.equal(json.filter((r) => r.pass).length, 7);
  });
  add('unscored batch 3 error enters sensitivity as FAIL but not normal rates or command counts', () => {
    const unscored = text().split('Batch 3 unscored runs: 1')[1];
    assert.ok(unscored);
    assert.ok(unscored.includes(errorId));
    // First task: (3/4 - 0) = .75; second: (0 - 1) = -1; task mean = -.125.
    assert.match(unscored, /graph - stub: -0\.13 \[-1\.00, 0\.75\] over 2 tasks/);
    assert.match(unscored, /graph - none: -0\.25 \[-0\.25, -0\.25\] over 1 tasks/);
  });
  add('error-only batch 3 still appends blocks with no scored rates or fabricated group zeroes', () => {
    const at = join(scratch, 'error-only-results');
    save(at, task.id, 'graph', 1, '#3145', 10000, [], 'error');
    const output = report(at);
    assert.match(output, /Batch 3: 0 finished runs/);
    assert.match(output, /Batch 3 unscored runs: 1/);
    for (const wording of ['same-words', 'partial', 'other-words']) {
      const section = output.split(`=== Batch 3: wording ${wording}`)[1]?.split('\n=== ')[0];
      assert.ok(section);
      for (const condition of ['none', 'graph', 'stub']) assert.match(section, new RegExp(`${condition}\\s+-\\s+\\(0 runs, 0 tokens\\)`));
    }
    assert.deepEqual(report(at, true), []);
  });
  const plannedIds = taskIds.flatMap((id) => ['none', 'graph', 'stub'].flatMap((condition) => [1, 2, 3].map((repeat) => `${id}__${condition}__r${repeat}`)));
  function verifyPlan(output, done) {
    const [summary, ...lines] = output.trim().split('\n');
    assert.equal(summary, `90 runs planned, ${done.size} already done, ${90 - done.size} to start`);
    const pending = lines.map((line) => line.trim());
    assert.equal(new Set(pending).size, pending.length, 'plan repeats a run id');
    assert.deepEqual(pending.sort(), plannedIds.filter((id) => !done.has(id)).sort(), 'plan must list every unfinished run exactly once');
  }
  function snapshot(at) {
    return readdirSync(at, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).map((entry) => [
      entry.name, entry.isDirectory() ? snapshot(join(at, entry.name)) : readFileSync(join(at, entry.name)),
    ]);
  }
  function planCheck(name, repeats = '3') {
    // Keep the runner unchanged: only its documented CLI and result files are used.
    const base = join(scratch, name);
    const at = join(base, 'eval');
    const results = join(at, 'results');
    mkdirSync(results, { recursive: true });
    for (const file of ['run.mjs', 'opencode.mjs', 'score.mjs', 'registry.mjs', 'registry.json', 'tasks']) cpSync(join(root, 'eval', file), join(at, file), { recursive: true });
    let emptyPlan;
    const done = new Set();
    for (const count of [0, 17, 90]) {
      for (const id of plannedIds.slice(done.size, count)) {
        const [taskId, condition, repeat] = id.split('__');
        save(results, taskId, condition, Number(repeat.slice(1)), '', 0);
        done.add(id);
      }
      const before = snapshot(base);
      const result = node(join(at, 'run.mjs'), ['--plan', '--only', taskIds.join(','), '--repeats', repeats], {
        ...process.env, WHYGRAPH_EVAL_WORK: join(base, 'work'),
      });
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(snapshot(base), before, '--plan must not prepare templates or write run artifacts');
      writeFileSync(join(scratch, `${name}-${count}.txt`), result.stdout);
      verifyPlan(result.stdout, done);
      emptyPlan ??= result.stdout;
    }
    return emptyPlan;
  }
  add('plan lists exactly 90 distinct runs without starting agents', () => {
    planCheck('plan');
  });
  add('plant two repeats caught by: plan lists exactly 90 distinct runs', () => {
    assert.throws(() => planCheck('plant-two-repeats', '2'), {
      code: 'ERR_ASSERTION',
      actual: '60 runs planned, 0 already done, 60 to start',
      expected: '90 runs planned, 0 already done, 90 to start',
    });
  });
  add('plant repeated run id caught by: plan lists exactly 90 distinct runs', () => {
    const output = planCheck('duplicate-control');
    const lines = output.trimEnd().split('\n');
    lines[lines.length - 1] = lines[1];
    const faulty = `${lines.join('\n')}\n`;
    writeFileSync(join(scratch, 'plant-repeated-run.txt'), faulty);
    assert.throws(() => verifyPlan(faulty, new Set()), { code: 'ERR_ASSERTION', message: /^plan repeats a run id\n/ });
  });
  return checks;
}

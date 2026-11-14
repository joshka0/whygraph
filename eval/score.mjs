#!/usr/bin/env node
/**
 * module: [[whygraph-eval-scorer]]
 * Decides pass or fail for every saved run of the eval, from its diff, its final message and
 * its tool log only, and prints the rates per condition and task.
 *
 *   node eval/score.mjs [--results <dir>] [--json]
 *
 * A run is a folder of results/ that holds meta.json (status "done"), final.txt, diff.patch and
 * tools.json; run.mjs writes them. The rules per task kind are in eval/README.md.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('./', import.meta.url));

/** A Bash command that runs whygraph as a command word, not one that only names a path such as /tmp/whygraph-eval. */
const WHYGRAPH_CALL = /(^|[;&|(\n]|\s)whygraph\s+(carry|search|why|impact|build|decisions|mcp|help)\b/;
/**
 * The fixture tasks whose records exist only outside the repo: none and stub cannot name them, so they
 * score 0/100/0 by design. The post hoc block leaves them out; it was added after the results were seen.
 */
const OUTSIDE_ONLY = ['fixture-conflict-format-separators', 'fixture-conflict-tax-per-line', 'fixture-impact-note-1-reversed'];

/** Words that make a sentence an objection when it also names a record. */
const OBJECTION = /\b(conflicts?|conflicting|contradicts?|contradicting|against|violat\w*|revers\w*|overrid\w*|undo(es|ing)?|breaks?|breaking|incompatible|inconsistent)\b/gi;
/** A negation in the 30 characters before an objection word cancels it ("does not conflict"). */
const NEGATION = /(\bno\b|\bnot\b|n't\b|\bnever\b|\bwithout\b|\bnothing\b|\bnone\b)/i;

/**
 * The record ids a text names, in one spelling each: ADR-NNNN, note-N, and the memod check names.
 * owns: [[whygraph-eval-scorer]]
 */
export function recordIds(text) {
  const ids = new Set();
  for (const m of text.matchAll(/\badr[- ]?(\d{1,4})\b/gi)) ids.add(`ADR-${m[1].padStart(4, '0')}`);
  for (const m of text.matchAll(/\bnote[- ](\d+)\b/gi)) ids.add(`note-${m[1]}`);
  for (const m of text.matchAll(/\b(verify-event-log|CountedOncePerFix)\b/g)) ids.add(m[1]);
  return ids;
}

function sentences(text) {
  return text.split(/(?<=[.!?])\s+|\n+/).filter((s) => s.trim() !== '');
}

function objects(sentence) {
  for (const m of sentence.matchAll(OBJECTION)) {
    if (!NEGATION.test(sentence.slice(Math.max(0, m.index - 30), m.index))) return true;
  }
  return false;
}

/** Records the text names in a sentence that objects, as ids. */
function objectedIds(text) {
  const ids = new Set();
  for (const s of sentences(text)) if (objects(s)) for (const id of recordIds(s)) ids.add(id);
  return ids;
}

function named(record, text) {
  if (record.id !== undefined && recordIds(text).has(record.id)) return true;
  if (record.any?.some((p) => new RegExp(p, 'i').test(text))) return true;
  if (record.all !== undefined && record.all.every((p) => new RegExp(p, 'i').test(text))) return true;
  return false;
}

/**
 * The files of a unified diff, each with its added and removed lines.
 * owns: [[whygraph-eval-scorer]]
 */
export function readDiff(patch) {
  const files = new Map();
  let cur;
  for (const line of patch.split('\n')) {
    const head = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
    if (head) {
      cur = { added: [], removed: [] };
      files.set(head[2], cur);
      if (head[1] !== head[2]) files.set(head[1], cur);
      continue;
    }
    if (cur === undefined || line.startsWith('+++') || line.startsWith('---')) continue;
    if (line.startsWith('+')) cur.added.push(line.slice(1));
    else if (line.startsWith('-')) cur.removed.push(line.slice(1));
  }
  return files;
}

/**
 * The `file:symbol` items a reply lists: the lines after its `SYMBOLS:` line, else every such item in it.
 * owns: [[whygraph-eval-scorer]]
 */
export function listedSymbols(text) {
  const at = text.search(/^[\s*#>-]*SYMBOLS:?[\s*]*$/m);
  const part = at >= 0 ? text.slice(at) : text;
  const items = new Set();
  for (const m of part.matchAll(/([\w./-]+\.(?:ts|tsx|js|mjs|rs|ex|kt|swift|zig))[:#]([A-Za-z_$][\w$]*)/g)) items.add(`${m[1]}:${m[2]}`);
  return items;
}

function doneChecks(checks, diff) {
  return checks.every((c) => {
    const f = diff.get(c.file);
    if (f === undefined) return false;
    if (c.removed !== undefined && !f.removed.some((l) => new RegExp(c.removed, 'i').test(l))) return false;
    if (c.added !== undefined && !f.added.some((l) => new RegExp(c.added, 'i').test(l))) return false;
    return true;
  });
}

/**
 * The verdict of one run: `{ pass, reasons, ... }` from the task and the run's final message, diff and tool calls.
 * owns: [[whygraph-eval-scorer]]
 */
export function scoreRun(task, run) {
  const s = task.score;
  const text = run.final ?? '';
  const diff = readDiff(run.diff ?? '');
  const changed = [...diff.keys()];
  const whygraphCalls = (run.tools ?? []).filter((t) => t.name === 'Bash' && WHYGRAPH_CALL.test(String(t.input?.command ?? ''))).length;
  const reasons = [];
  const out = { pass: false, reasons, changed, whygraphCalls };
  if (task.kind === 'conflict') {
    const hit = s.records.filter((r) => named(r, text));
    const required = new Set([...s.records.map((r) => r.id).filter((id) => id !== undefined), ...(s.may_name ?? [])]);
    const wrong = [...objectedIds(text)].filter((id) => !required.has(id));
    const touched = changed.filter((f) => s.protected === 'all' || s.protected.includes(f));
    let editOk = touched.length === 0;
    if (!editOk && s.exception) {
      const ex = s.exception;
      editOk = hit.length > 0 && ex.changed.every((f) => diff.has(f)) &&
        ex.removed.every((p) => [...diff.values()].some((f) => f.removed.some((l) => new RegExp(p, 'i').test(l))));
    }
    if (hit.length === 0) reasons.push('names no required record');
    if (wrong.length > 0) reasons.push(`false mention: ${wrong.join(', ')}`);
    if (!editOk) reasons.push(`edited protected files: ${touched.join(', ')}`);
    out.falseMention = wrong.length > 0;
    out.pass = reasons.length === 0;
  } else if (task.kind === 'impact') {
    const listed = listedSymbols(text);
    const truth = new Set(s.symbols.map((x) => x.symbol));
    const required = [...s.symbols.filter((x) => x.required).map((x) => listed.has(x.symbol)), ...s.records.map((r) => named(r, text))];
    const recall = required.length === 0 ? 1 : required.filter(Boolean).length / required.length;
    const precision = listed.size === 0 ? 0 : [...listed].filter((x) => truth.has(x)).length / listed.size;
    Object.assign(out, { recall, precision, listed: [...listed] });
    if (recall < s.min_recall) reasons.push(`recall ${recall.toFixed(2)} < ${s.min_recall}`);
    if (precision < s.min_precision) reasons.push(`precision ${precision.toFixed(2)} < ${s.min_precision}`);
    out.pass = reasons.length === 0;
  } else if (task.kind === 'control' || task.kind === 'edit') {
    const done = doneChecks(s.done, diff);
    if (!done) reasons.push('the requested change is not in the diff');
    if (s.only_files !== undefined) {
      const extra = changed.filter((f) => !s.only_files.includes(f));
      if (extra.length > 0) reasons.push(`changed other files: ${extra.join(', ')}`);
    }
    for (const k of s.kept ?? []) if (diff.get(k.file)?.removed.some((l) => l.includes(k.line))) reasons.push(`removed a kept line: ${k.line}`);
    if (task.kind === 'control') {
      const claimed = task.batch === 4 ? [] : [...objectedIds(text)];
      out.objection = !done || claimed.length > 0;
      if (claimed.length > 0) reasons.push(`claims a decision against it: ${claimed.join(', ')}`);
    }
    out.pass = reasons.length === 0;
  } else throw new Error(`task ${task.id}: unknown kind ${task.kind}`);
  return out;
}

/**
 * Every task file of eval/tasks, by id.
 * owns: [[whygraph-eval-scorer]]
 */
export function readTasks(dir = join(here, 'tasks')) {
  const tasks = new Map();
  for (const n of readdirSync(dir).filter((n) => n.endsWith('.json')).sort()) {
    const t = JSON.parse(readFileSync(join(dir, n), 'utf8'));
    tasks.set(t.id, t);
  }
  return tasks;
}

function readRun(dir) {
  const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'));
  const read = (n) => (existsSync(join(dir, n)) ? readFileSync(join(dir, n), 'utf8') : '');
  return { meta, final: read('final.txt'), diff: read('diff.patch'), tools: JSON.parse(read('tools.json') || '[]') };
}

/** A seeded generator, so the interval is the same on every call. */
function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The mean of per-task differences and its bootstrap 95% interval over tasks.
 * owns: [[whygraph-eval-scorer]]
 */
export function pairedDifference(diffs, rounds = 10000) {
  if (diffs.length === 0) return undefined;
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const rand = mulberry32(1);
  const means = [];
  for (let i = 0; i < rounds; i++) means.push(mean(diffs.map(() => diffs[Math.floor(rand() * diffs.length)])));
  means.sort((a, b) => a - b);
  return { mean: mean(diffs), low: means[Math.floor(rounds * 0.025)], high: means[Math.ceil(rounds * 0.975) - 1], tasks: diffs.length };
}

function pct(x) {
  return x === undefined ? '   -' : `${Math.round(x * 100)}%`.padStart(4);
}

/** The lines `graph - none` and `graph - stub` from per-task pass rates. */
function differences(perTask) {
  return ['none', 'stub'].map((other) => {
    const diffs = [...perTask.values()].filter((r) => r.graph !== undefined && r[other] !== undefined).map((r) => r.graph - r[other]);
    const d = pairedDifference(diffs);
    return `graph - ${other}: ${d === undefined ? 'no task has both' : `${d.mean.toFixed(2)} [${d.low.toFixed(2)}, ${d.high.toFixed(2)}] over ${d.tasks} tasks`}`;
  });
}

/** The paired differences of `rows`, on one line. */
function headline(rows, tasks) {
  const perTask = new Map();
  for (const t of tasks.values()) {
    const r = Object.fromEntries(['none', 'graph', 'stub'].map((c) => {
      const rs = rows.filter((x) => x.task.id === t.id && x.meta.condition === c);
      return [c, rs.length === 0 ? undefined : rs.filter((x) => x.verdict.pass).length / rs.length];
    }));
    perTask.set(t.id, r);
  }
  return differences(perTask).join('; ');
}

/** Prints the rates of `rows`: per condition, per task, paired differences, false objections. */
function rates(rows, tasks, title) {
  const conditions = ['none', 'graph', 'stub'];
  const rate = (rs) => (rs.length === 0 ? undefined : rs.filter((r) => r.verdict.pass).length / rs.length);
  console.log(`\n=== ${title}`);
  console.log('\nPass rate per condition:');
  for (const c of conditions) {
    const rs = rows.filter((r) => r.meta.condition === c);
    const tokens = rs.reduce((a, r) => a + (r.meta.tokens?.total ?? 0), 0);
    console.log(`  ${c.padEnd(6)} ${pct(rate(rs))}  (${rs.length} runs, ${tokens} tokens)`);
  }
  console.log('\nPass rate per task (none graph stub):');
  const perTask = new Map();
  for (const t of tasks.values()) {
    const r = Object.fromEntries(conditions.map((c) => [c, rate(rows.filter((x) => x.task.id === t.id && x.meta.condition === c))]));
    if (conditions.every((c) => r[c] === undefined)) continue;
    perTask.set(t.id, r);
    console.log(`  ${pct(r.none)} ${pct(r.graph)} ${pct(r.stub)}  ${t.id}`);
  }
  console.log('\nPaired difference, mean over tasks, bootstrap 95% interval over tasks:');
  for (const line of differences(perTask)) console.log(`  ${line}`);
  console.log('\nFalse-objection rate on control tasks:');
  for (const c of conditions) {
    const rs = rows.filter((r) => r.meta.condition === c && r.task.kind === 'control');
    console.log(`  ${c.padEnd(6)} ${rs.length === 0 ? '   -' : pct(rs.filter((r) => r.verdict.objection).length / rs.length)}  (${rs.length} runs)`);
  }
}

/** Fixed batch 4 diagnostics; saved batch 1--3 output remains unchanged. */
function batchFour(rows, unscored, tasks, results) {
  const conflicts = rows.filter((r) => r.task.kind === 'conflict');
  const controls = rows.filter((r) => r.task.kind === 'control');
  console.log(`\nBatch 4: ${rows.length} finished runs\n\nRuns:`);
  for (const r of rows) console.log(`  ${r.verdict.pass ? 'PASS' : 'FAIL'}  ${r.id}  whygraph calls: ${r.verdict.whygraphCalls}${r.verdict.reasons.length ? `  (${r.verdict.reasons.join('; ')})` : ''}`);
  rates(conflicts, tasks, 'Batch 4: nineteen ripgrep ticket conflicts (primary result: graph - stub)');
  for (const wording of ['same-words', 'partial', 'other-words']) {
    rates(conflicts.filter((r) => r.task.ground_truth.source.wording === wording), tasks, `Batch 4: wording ${wording}`);
  }
  rates(controls, tasks, 'Batch 4: five harmless controls');
  const runs = new Map(rows.map((r) => [r.id, readRun(join(results, r.id))]));
  const namedTicket = (r) => r.task.score.records.some((record) => named(record, runs.get(r.id).final));
  console.log('\nBatch 4 conflict counts (finished runs):');
  for (const condition of ['none', 'graph', 'stub']) {
    const rs = conflicts.filter((r) => r.meta.condition === condition);
    const count = (predicate) => rs.filter(predicate).length;
    const unchanged = (r) => r.verdict.changed.length === 0;
    console.log(`  ${condition}: ${rs.length} runs; changed no file: ${count(unchanged)}; named the ticket: ${count(namedTicket)}; named the ticket and changed a file: ${count((r) => namedTicket(r) && !unchanged(r))}; changed no file and did not name the ticket: ${count((r) => unchanged(r) && !namedTicket(r))}`);
    const cs = controls.filter((r) => r.meta.condition === condition);
    console.log(`  ${condition} controls: ${cs.filter((r) => r.verdict.pass).length}/${cs.length} passed; changed no file: ${cs.filter(unchanged).length}`);
  }
  // Same placement rule as pilot-source.py, now fixed before batch 4 runs.
  const sources = new Map();
  for (const r of conflicts.filter((r) => r.meta.condition === 'graph')) {
    const ids = r.task.score.records.map((record) => record.id);
    const has = (text) => ids.some((id) => new RegExp(`${id}(?!\\d)`).test(text));
    const seen = new Set();
    for (const call of runs.get(r.id).tools) {
      const cmd = call.input?.command;
      if (call.name !== 'Bash' || typeof cmd !== 'string' || !WHYGRAPH_CALL.test(cmd)) continue;
      const out = typeof call.result === 'string' ? call.result : JSON.stringify(call.result ?? '');
      if (!has(out)) continue;
      const kinds = new Set([...cmd.matchAll(/whygraph\s+(search|carry|why|impact)\b/g)].map((m) => m[1]));
      if (kinds.size === 1 && kinds.has('search')) seen.add('search');
      else if (kinds.size > 0 && [...kinds].every((k) => ['carry', 'why', 'impact'].includes(k))) {
        const cut = out.indexOf('Decision records that share the most distinctive terms');
        if (cut < 0) seen.add('link');
        else {
          if (has(out.slice(0, cut))) seen.add('link');
          if (has(out.slice(cut))) seen.add('terms');
        }
      } else seen.add('mixed call');
    }
    sources.set(r.id, seen);
  }
  const shown = conflicts.filter((r) => sources.get(r.id)?.size > 0);
  console.log(`\nBatch 4 graph runs where a whygraph answer showed the needed ticket: ${shown.length}/${sources.size}; named it: ${shown.filter(namedTicket).length}/${shown.length}`);
  console.log('Where shown -> runs (named / not named):');
  const groups = new Map();
  for (const r of conflicts.filter((r) => sources.has(r.id))) {
    const key = [...sources.get(r.id)].sort().join('+') || 'ticket in no whygraph answer';
    const group = groups.get(key) ?? { total: 0, named: 0 };
    group.total++;
    if (namedTicket(r)) group.named++;
    groups.set(key, group);
  }
  for (const [key, group] of [...groups].sort(([a], [b]) => a.localeCompare(b))) console.log(`  ${key}: ${group.total} (${group.named} / ${group.total - group.named})`);
  console.log('\nBatch 4 runs that called each command (each finished run counted once per command kind):');
  const commands = {
    'carry <file>:<symbol>': /(^|[;&|(\n]|\s)whygraph\s+carry\s+['"`]?[^\s'"`]+:(?!\d+-\d+)[A-Za-z_$][\w$]*/,
    'carry <file>:<start>-<end>': /(^|[;&|(\n]|\s)whygraph\s+carry\s+['"`]?[^\s'"`]+:\d+-\d+\b/,
    search: /(^|[;&|(\n]|\s)whygraph\s+search\b/,
    why: /(^|[;&|(\n]|\s)whygraph\s+why\b/,
    impact: /(^|[;&|(\n]|\s)whygraph\s+impact\b/,
  };
  for (const condition of ['none', 'graph', 'stub']) {
    const rs = rows.filter((r) => r.meta.condition === condition);
    console.log(`  ${condition}: ${Object.entries(commands).map(([name, pattern]) => `${name}: ${rs.filter((r) => runs.get(r.id).tools.some((t) => t.name === 'Bash' && pattern.test(String(t.input?.command ?? '')))).length}`).join('; ')}`);
  }
  console.log(`\nBatch 4 unscored runs: ${unscored.length}`);
  for (const r of unscored) console.log(`  ${r.id}  (exit ${r.meta.exit}, ${Math.round(r.meta.wall_ms / 1000)} s)`);
  const failedConflicts = unscored.filter((r) => r.task.kind === 'conflict');
  if (failedConflicts.length > 0) console.log(`  Sensitivity, unscored conflicts counted as FAIL: ${headline([...conflicts, ...failedConflicts], tasks)}`);
  console.log(`\nBatch 4 total tokens: ${rows.reduce((a, r) => a + (r.meta.tokens?.total ?? 0), 0)}`);
}

function main(argv) {
  const resultsAt = argv.indexOf('--results');
  const results = resultsAt >= 0 ? argv[resultsAt + 1] : join(here, 'results');
  const tasks = readTasks();
  const rows = [];
  const unscored = [];
  for (const id of existsSync(results) ? readdirSync(results).sort() : []) {
    const dir = join(results, id);
    if (!existsSync(join(dir, 'meta.json'))) continue;
    const run = readRun(dir);
    const task = tasks.get(run.meta.task);
    if (task === undefined) throw new Error(`${id}: no task ${run.meta.task}`);
    if (run.meta.status !== 'done') {
      unscored.push({ id, task, meta: run.meta, verdict: { pass: false, reasons: ['unscored'], whygraphCalls: 0 } });
      continue;
    }
    rows.push({ id, task, meta: run.meta, verdict: scoreRun(task, run) });
  }
  if (argv.includes('--json')) {
    console.log(JSON.stringify(rows.map((r) => ({ id: r.id, task: r.task.id, condition: r.meta.condition, ...r.verdict, tokens: r.meta.tokens })), null, 2));
    return 0;
  }
  const fourth = rows.filter((r) => r.task.batch === 4);
  const fourthUnscored = unscored.filter((r) => r.task.batch === 4);
  rows.splice(0, rows.length, ...rows.filter((r) => r.task.batch !== 4));
  unscored.splice(0, unscored.length, ...unscored.filter((r) => r.task.batch !== 4));
  const third = rows.filter((r) => r.task.batch === 3);
  const thirdUnscored = unscored.filter((r) => r.task.batch === 3);
  rows.splice(0, rows.length, ...rows.filter((r) => r.task.batch !== 3));
  unscored.splice(0, unscored.length, ...unscored.filter((r) => r.task.batch !== 3));
  console.log(`${rows.length} finished runs\n\nRuns:`);
  for (const r of rows) console.log(`  ${r.verdict.pass ? 'PASS' : 'FAIL'}  ${r.id}  whygraph calls: ${r.verdict.whygraphCalls}${r.verdict.reasons.length ? `  (${r.verdict.reasons.join('; ')})` : ''}`);
  const shaped = [...tasks.values()].filter((t) => t.shaped_tool !== undefined).map((t) => t.id);
  const unshaped = (rs) => rs.filter((r) => !shaped.includes(r.task.id));
  const batch = (n) => (rs) => rs.filter((r) => (r.task.batch ?? 1) === n);
  const first = batch(1);
  const second = batch(2);
  // Batch 1: the fourteen tasks of the first run, reported as they were before the second batch existed.
  rates(first(rows), tasks, 'All tasks');
  if (shaped.length > 0) rates(unshaped(first(rows)), tasks, `Without the tasks that shaped the tool (${shaped.join(', ')})`);
  // Batch 2: sixteen tasks chosen blind; the tool did not change after they were seen. Primary result: graph - stub here.
  if (second(rows).length > 0) {
    rates(second(rows), tasks, 'Batch 2: the sixteen tasks chosen blind (primary result: graph - stub)');
    for (const repo of ['memod', 'memoryd']) rates(second(rows).filter((r) => r.task.repo === repo), tasks, `Batch 2: ${repo} only`);
    for (const level of ['easy', 'medium', 'hard']) {
      rates(second(rows).filter((r) => r.task.ground_truth?.source?.findable_by_search?.likelihood === level), tasks, `Batch 2: findable by search, picker's rating ${level}`);
    }
    rates(rows, tasks, 'Both batches: all thirty tasks');
    if (shaped.length > 0) rates(unshaped(rows), tasks, `Both batches: without the tasks that shaped the tool (${shaped.join(', ')})`);
  }
  console.log(`\n=== Unscored runs (an agent timed out twice; not in any rate above): ${unscored.length}`);
  for (const r of unscored) console.log(`  ${r.id}  (exit ${r.meta.exit}, ${Math.round(r.meta.wall_ms / 1000)} s)`);
  if (unscored.length > 0) {
    console.log('\nSensitivity: the same paired differences with every unscored run counted as FAIL:');
    const all = [...rows, ...unscored];
    console.log(`  All tasks: ${headline(first(all), tasks)}`);
    if (shaped.length > 0) console.log(`  Without the tasks that shaped the tool: ${headline(unshaped(first(all)), tasks)}`);
    if (second(all).length > 0) {
      console.log(`  Batch 2: ${headline(second(all), tasks)}`);
      console.log(`  Both batches: ${headline(all, tasks)}`);
    }
  }
  console.log('\n=== Post hoc, added after the results were seen: without the fixture tasks whose records exist only outside the repo');
  console.log(`(${OUTSIDE_ONLY.join(', ')}: no agent without the graph can name their records, so they score 0/100/0 by design and carry much of the headline.)`);
  const reachable = first(rows).filter((r) => !OUTSIDE_ONLY.includes(r.task.id));
  rates(reachable, tasks, 'Post hoc: without the outside-only tasks');
  if (shaped.length > 0) rates(unshaped(reachable), tasks, `Post hoc: without the outside-only tasks and the tasks that shaped the tool (${shaped.join(', ')})`);
  const total = rows.reduce((a, r) => a + (r.meta.tokens?.total ?? 0), 0);
  console.log(`\nTotal tokens: ${total}`);
  if (third.length > 0 || thirdUnscored.length > 0) {
    console.log(`\nBatch 3: ${third.length} finished runs\n\nRuns:`);
    for (const r of third) console.log(`  ${r.verdict.pass ? 'PASS' : 'FAIL'}  ${r.id}  whygraph calls: ${r.verdict.whygraphCalls}${r.verdict.reasons.length ? `  (${r.verdict.reasons.join('; ')})` : ''}`);
    rates(third, tasks, 'Batch 3: ten ripgrep ticket conflicts (primary result: graph - stub)');
    for (const wording of ['same-words', 'partial', 'other-words']) {
      rates(third.filter((r) => r.task.ground_truth.source.wording === wording), tasks, `Batch 3: wording ${wording}`);
    }
    console.log('\nBatch 3 runs that called each command (each run counted once per command kind):');
    const commands = {
      'carry <file>:<symbol>': /(^|[;&|(\n]|\s)whygraph\s+carry\s+['"`]?[^\s'"`]+:(?!\d+-\d+)[A-Za-z_$][\w$]*/,
      'carry <file>:<start>-<end>': /(^|[;&|(\n]|\s)whygraph\s+carry\s+['"`]?[^\s'"`]+:\d+-\d+\b/,
      search: /(^|[;&|(\n]|\s)whygraph\s+search\b/,
      why: /(^|[;&|(\n]|\s)whygraph\s+why\b/,
      impact: /(^|[;&|(\n]|\s)whygraph\s+impact\b/,
    };
    for (const condition of ['none', 'graph', 'stub']) {
      const runs = third.filter((r) => r.meta.condition === condition).map((r) => readRun(join(results, r.id)));
      const counts = Object.entries(commands).map(([name, pattern]) => {
        const count = runs.filter((r) => r.tools.some((t) => t.name === 'Bash' && pattern.test(String(t.input?.command ?? '')))).length;
        return `${name}: ${count}`;
      });
      console.log(`  ${condition}: ${counts.join('; ')}`);
    }
    console.log(`\nBatch 3 unscored runs: ${thirdUnscored.length}`);
    for (const r of thirdUnscored) console.log(`  ${r.id}  (exit ${r.meta.exit}, ${Math.round(r.meta.wall_ms / 1000)} s)`);
    if (thirdUnscored.length > 0) console.log(`  Sensitivity, unscored counted as FAIL: ${headline([...third, ...thirdUnscored], tasks)}`);
    console.log(`\nBatch 3 total tokens: ${third.reduce((a, r) => a + (r.meta.tokens?.total ?? 0), 0)}`);
  }
  if (fourth.length > 0 || fourthUnscored.length > 0) batchFour(fourth, fourthUnscored, tasks, results);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));

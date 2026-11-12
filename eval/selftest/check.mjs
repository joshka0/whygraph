#!/usr/bin/env node
/**
 * module: [[whygraph-eval-scorer-selftest]]
 * Scores each hand-written case of cases.mjs and exits 1 when a verdict differs from the expected one.
 *
 *   node eval/selftest/check.mjs
 */
import { readTasks, scoreRun } from '../score.mjs';
import { cases } from './cases.mjs';

const tasks = readTasks();
let wrong = 0;
for (const c of cases) {
  const task = tasks.get(c.task);
  if (task === undefined) throw new Error(`${c.name}: no task ${c.task}`);
  const v = scoreRun(task, c);
  const bad = Object.entries(c.expect).filter(([k, want]) => (typeof want === 'number' ? Math.abs((v[k] ?? NaN) - want) > 1e-9 : v[k] !== want));
  console.log(`${bad.length === 0 ? 'ok  ' : 'WRONG'} ${v.pass ? 'PASS' : 'FAIL'}  ${c.name}${v.reasons.length ? `  (${v.reasons.join('; ')})` : ''}`);
  for (const [k, want] of bad) console.log(`        ${k}: expected ${JSON.stringify(want)}, got ${JSON.stringify(v[k])}`);
  wrong += bad.length === 0 ? 0 : 1;
}
console.log(`${cases.length - wrong}/${cases.length} verdicts as expected`);
process.exitCode = wrong === 0 ? 0 : 1;

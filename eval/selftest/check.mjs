#!/usr/bin/env node
/**
 * module: [[whygraph-eval-scorer-selftest]]
 * Scores each hand-written case of cases.mjs and exits 1 when a verdict differs from the expected one.
 *
 *   node eval/selftest/check.mjs
 */
import { readTasks, scoreRun, recordIds } from '../score.mjs';
import { sessionSummary } from '../run.mjs';
import { cases } from './cases.mjs';
import { ticketChecks } from './tickets.mjs';
import { batch4Checks } from './batch4.mjs';
import { batch5Checks } from './batch5.mjs';
import { batch6Checks } from './batch6.mjs';
import { batch7Checks } from './batch7.mjs';

const stress = process.argv.slice(2).includes('--stress');
if (process.argv.slice(2).some(arg => arg !== '--stress')) throw new Error('usage: node eval/selftest/check.mjs [--stress]');
const tasks = readTasks();
const verdicts = stress ? [] : cases;
let wrong = 0;
for (const c of verdicts) {
  const task = tasks.get(c.task);
  if (task === undefined) throw new Error(`${c.name}: no task ${c.task}`);
  // A case given as stream events goes through the runner's extraction, as a saved run does.
  const session = c.events === undefined ? undefined : sessionSummary(c.events);
  const v = scoreRun(task, session === undefined ? c : { ...c, final: session.final });
  const bad = Object.entries(c.expect).filter(([k, want]) => (typeof want === 'number' ? Math.abs((v[k] ?? NaN) - want) > 1e-9 : v[k] !== want));
  for (const [k, want] of Object.entries(c.session ?? {})) if (JSON.stringify(session[k]) !== JSON.stringify(want)) bad.push([`session.${k}`, want, session[k]]);
  console.log(`${bad.length === 0 ? 'ok  ' : 'WRONG'} ${v.pass ? 'PASS' : 'FAIL'}  ${c.name}${v.reasons.length ? `  (${v.reasons.join('; ')})` : ''}`);
  for (const [k, want, got = v[k]] of bad) console.log(`        ${k}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
  wrong += bad.length === 0 ? 0 : 1;
}
const checks = stress ? (await batch7Checks({ tasks, scoreRun, stress })).filter(c => c.stress) : [
  ...await ticketChecks({ tasks, scoreRun, recordIds }),
  ...await batch4Checks({ tasks, scoreRun }),
  ...await batch5Checks({ tasks, scoreRun }),
  ...await batch6Checks({ tasks, scoreRun }),
  ...await batch7Checks({ tasks, scoreRun }),
];
for (const c of checks) {
  try {
    await c.run();
    console.log(`ok    ${c.name}`);
  } catch (error) {
    wrong++;
    console.log(`WRONG ${c.name}\n        ${error.message}`);
  }
}
const total = verdicts.length + checks.length;
console.log(`${total - wrong}/${total} cases as expected (${verdicts.length} original verdicts, ${checks.length} ${stress ? 'stress cases' : 'ticket checks'})`);
process.exitCode = wrong === 0 ? 0 : 1;

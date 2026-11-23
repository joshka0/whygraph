/** module: [[whygraph-trial-design]]
 * Freeze-check plants for the historical eval/score.txt pins (B7-152/B7-166, B7-177, B7-185, B7-199, B7-208).
 * Each check keeps the older report as an exact prefix: an appended batch passes, and an edit inside the
 * prefix or a change to another protected file fails. Plants edit a disposable clone of HEAD, never this checkout.
 * Saved runs come from trialResults (WHYGRAPH_EVAL_RESULTS, else eval/results); the clone has none of its own.
 *
 *   WHYGRAPH_EVAL_RESULTS=<saved runs> node eval/selftest/score-prefix-plants.mjs
 *
 * Exits 1 when a plant keeps its check green, or when an unplanted or append-only run goes red.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { trialResults } from './trial-results.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const results = trialResults(root);
const checks = [
  { id: 'B7-152 B7-166', file: 'batch7-refusals.mjs', fn: 'batch7RefusalChecks' },
  { id: 'B7-177', file: 'batch7-stopped.mjs', fn: 'batch7StoppedChecks' },
  { id: 'B7-185', file: 'batch7-private-tmp.mjs', fn: 'batch7PrivateTmpChecks' },
  { id: 'B7-199', file: 'batch7-spy-block.mjs', fn: 'batch7SpyBlockChecks', name: 'B7-199 frozen launcher' },
  { id: 'B7-208', file: 'batch7-command-limit.mjs', fn: 'batch7CommandLimitChecks' },
];
// Every base report is the 153,320-byte pre-pilot file; both edits fall inside it.
const prefixBytes = 153320;
const plants = [
  { name: 'unplanted', red: false },
  { name: 'appended batch', red: false, edit: s => s + 'Batch 99: planted appended block\n' },
  { name: 'first prefix byte', red: /report as its prefix/, edit: s => (s[0] === '4' ? '5' : '4') + s.slice(1) },
  { name: 'last prefix byte', red: /report as its prefix/,
    edit: s => s.slice(0, prefixBytes - 2) + (s[prefixBytes - 2] === 'X' ? 'Y' : 'X') + s.slice(prefixBytes - 1) },
  { name: 'protected scorer byte', red: /eval\/score\.mjs/, file: 'eval/score.mjs', edit: s => s + '// planted\n' },
];

function run(cmd, args, options = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options });
  assert.ifError(r.error);
  return r;
}
function ok(r) { assert.equal(r.status, 0, r.stdout + r.stderr); return r.stdout; }

const head = ok(run('git', ['rev-parse', 'HEAD'], { cwd: root })).trim();
// A short path keeps the Unix socket paths of the checks below the kernel limit.
const at = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), 'spp-'));
ok(run('git', ['clone', '-q', '--no-checkout', root, at]));
ok(run('git', ['checkout', '-q', '--detach', head], { cwd: at }));
symlinkSync(join(root, 'node_modules'), join(at, 'node_modules'), 'dir');
const env = { ...process.env, WHYGRAPH_EVAL_RESULTS: results };

const driver = `
import { mkdirSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
const [file, fn, prefix] = process.argv.slice(1);
const mod = await import(join(process.cwd(), 'eval/selftest', file));
mkdirSync('test-results/scratch', { recursive: true });
const scratch = mkdtempSync(join(process.cwd(), 'test-results/scratch/spp-'));
const found = (await mod[fn]({ scratch, shared: {} })).filter(c => c.name.startsWith('B7 ' + prefix));
if (found.length !== 1) { console.log(JSON.stringify({ setup: 'found ' + found.length + ' checks named ' + prefix })); process.exit(2); }
try { await found[0].run(); console.log(JSON.stringify({ green: true })); }
catch (e) { console.log(JSON.stringify({ green: false, message: String(e.message) })); }
`;

const summary = [];
let wrong = 0;
for (const plant of plants) {
  const path = join(at, plant.file ?? 'eval/score.txt'), original = readFileSync(path, 'utf8');
  if (plant.edit) writeFileSync(path, plant.edit(original));
  try {
    for (const c of checks) {
      const r = run(process.execPath, ['--input-type=module', '-e', driver, c.file, c.fn, c.name ?? c.id], { cwd: at, env });
      const line = r.stdout.trim().split('\n').at(-1);
      let got;
      try { got = JSON.parse(line); } catch { got = { setup: `exit ${r.status}: ${r.stderr.slice(-2000)}` }; }
      const pass = got.setup === undefined && (plant.red ? got.green === false && plant.red.test(got.message) : got.green === true);
      if (!pass) wrong++;
      summary.push({ check: c.id, plant: plant.name, expected: plant.red ? 'red ' + plant.red : 'green', got: got.setup ?? (got.green ? 'green' : 'red: ' + got.message.split('\n')[0]), pass });
      console.log(`${pass ? 'ok   ' : 'WRONG'} ${c.id} / ${plant.name}: ${summary.at(-1).got}`);
    }
  } finally { writeFileSync(path, original); }
}
writeFileSync(join(at, 'score-prefix-plants.json'), JSON.stringify({ head, results, summary }, null, 1) + '\n');
console.log(`${summary.length - wrong} of ${summary.length} plant verdicts as expected; record ${join(at, 'score-prefix-plants.json')}`);
process.exitCode = wrong === 0 ? 0 : 1;

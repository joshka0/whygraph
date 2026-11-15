/** Reproduce each load-size fault in an isolated source copy; preserve TAP evidence. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const scratch = join(root, 'test-results', `load-size-plants-${Date.now()}-${process.pid}`);
mkdirSync(scratch, { recursive: true });
const plants = [
  { name: 'utf16-code-units', group: 'B42', before: 'UTF8.encode(JSON.stringify(rows[i])).byteLength', after: 'JSON.stringify(rows[i]).length' },
  { name: 'exact-budget-one-row-early', group: 'B42', before: 'bytes + 1 + rowBytes > CHUNK_BYTES', after: 'bytes + 1 + rowBytes >= CHUNK_BYTES' },
  { name: 'exact-budget-one-row-late', group: 'B42', before: 'bytes + 1 + rowBytes > CHUNK_BYTES', after: 'bytes + 1 + rowBytes > CHUNK_BYTES + 1' },
  { name: 'oversized-row-merged', group: 'B38', before: 'bytes + 1 + rowBytes > CHUNK_BYTES', after: '(rowBytes <= CHUNK_BYTES && bytes + 1 + rowBytes > CHUNK_BYTES)' },
  { name: 'oversized-row-dropped', group: 'B38', before: 'const rowBytes = UTF8.encode(JSON.stringify(rows[i])).byteLength;', after: 'const rowBytes = UTF8.encode(JSON.stringify(rows[i])).byteLength;\n    if (rowBytes + 2 > CHUNK_BYTES) { if (i > start) out.push(rows.slice(start, i)); start = i + 1; bytes = 2; continue; }' },
  { name: 'statement-row-order-reversed', group: 'B40', before: 'out.push(rows.slice(start, i));', after: 'out.push(rows.slice(start, i).reverse());' },
  { name: 'parameter-name-out-of-step', group: 'B41', before: 'param: `p${i}`, rows: s.rows', after: 'param: `p${i + 1}`, rows: s.rows' },
  { name: 'empty-statement-emitted', group: 'B39', before: 'const out: (readonly T[])[] = [];', after: 'const out: (readonly T[])[] = [[]];' },
  { name: 'row-counter-not-reset', group: 'B43', before: 'i - start === CHUNK', after: 'i === CHUNK' },
  { name: 'byte-counter-not-reset', group: 'B43', before: 'start = i;\n      bytes = 2;', after: 'start = i;' },
];
function run(subject, group, folder) {
  mkdirSync(folder);
  const result = spawnSync(process.execPath, ['--test', '--test-isolation=none', '--test-reporter=tap', `--test-name-pattern=^${group} `, join(root, 'test/load-size.test.mjs')], {
    cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, RELATE_TELEMETRY: '0', DO_NOT_TRACK: '1', WHYGRAPH_SUBJECT_ROOT: subject, WHYGRAPH_TEST_RUN_DIR: folder },
  });
  if (result.error) throw result.error;
  writeFileSync(join(folder, 'result.tap'), result.stdout); writeFileSync(join(folder, 'stderr.txt'), result.stderr);
  return { exit: result.status, signal: result.signal,
    failed: [...result.stdout.matchAll(/^not ok \d+ - (.+)$/gm)].map(m => m[1]),
    assertion: /^    (?![+\- ]|\s*$)(.+)$/m.exec(result.stdout.slice(result.stdout.indexOf('  error:')))?.[1] ?? null,
    pass: Number(/^# pass (\d+)$/m.exec(result.stdout)?.[1] ?? 0) };
}
const outcomes = [];
for (const plant of plants) {
  const folder = join(scratch, plant.name), subject = join(folder, 'subject'); mkdirSync(subject, { recursive: true });
  cpSync(join(root, 'src'), join(subject, 'src'), { recursive: true });
  cpSync(join(root, 'package.json'), join(subject, 'package.json'));
  symlinkSync(join(root, 'node_modules'), join(subject, 'node_modules'));
  const file = join(subject, 'src/load.pure.ts'), original = readFileSync(file, 'utf8');
  assert.equal(original.split(plant.before).length - 1, 1, `unique anchor for ${plant.name}`);
  writeFileSync(file, original.replace(plant.before, plant.after));
  writeFileSync(join(folder, 'plant.json'), JSON.stringify(plant, null, 2) + '\n');
  const result = run(subject, plant.group, join(folder, 'run'));
  const detected = result.exit === 1 && result.failed.length === 1 && result.failed[0].startsWith(`${plant.group} `) && result.assertion !== null;
  const outcome = { name: plant.name, group: plant.group, ...result, detected }; outcomes.push(outcome); console.log(JSON.stringify(outcome));
}
const real = run(root, 'B(37|38|39|40|41|42|43)', join(scratch, 'real-code'));
writeFileSync(join(scratch, 'summary.json'), JSON.stringify({ scratch, outcomes, real }, null, 2) + '\n');
console.log(JSON.stringify({ real, scratch }));
process.exitCode = outcomes.every(p => p.detected) && real.exit === 0 && real.pass === 7 ? 0 : 1;

/** Plant search faults in retained scratch copies; never mutate the subject. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`;
const scratch = join(root, 'test-results/scratch', `search-plants-${runId}`);
mkdirSync(scratch, { recursive: true });
const plants = [
  {
    name: 'word-index-title-only', pattern: '^Q8 Q24 ',
    file: 'src/load.pure.ts',
    before: '[r.title ?? "", ...r.items.map((i) => i.text)]', after: '[r.title ?? ""]',
  },
  {
    name: 'fusion-ties-reverse-id', pattern: '^Q17 fusion ',
    file: 'src/search.pure.ts',
    before: '(a < b ? -1 : a > b ? 1 : 0)', after: '(a < b ? 1 : a > b ? -1 : 0)',
  },
  {
    name: 'empty-build-loads-model', pattern: '^Q21 ',
    file: 'src/embed.ts',
    before: 'if (texts.length === 0) return [];', after: '// planted: empty builds load the model too',
  },
  {
    name: 'candidate-prints-score', pattern: '^Q23 ',
    file: 'src/search.pure.ts',
    before: 'out.push(`      matched: ${c.match}`)', after: 'out.push(`      matched: ${c.match}\\n      score: 0.99`)',
  },
  {
    name: 'repeated-title-prints-statement', pattern: '^Q1 repeated-title ',
    file: 'src/search.pure.ts',
    before: 'if (statement.trim() !== title.trim()) out.push(`      statement: ${statement}`);',
    after: 'out.push(`      statement: ${statement}`);',
  },
];
const outcomes = [];
for (const plant of plants) {
  const subject = join(scratch, plant.name); mkdirSync(subject);
  for (const file of ['src', 'recipes', 'package.json']) cpSync(join(root, file), join(subject, file), { recursive: true });
  symlinkSync(join(root, 'node_modules'), join(subject, 'node_modules'));
  const path = join(subject, plant.file); const original = readFileSync(path, 'utf8');
  assert.equal(original.split(plant.before).length - 1, 1, `unique anchor: ${plant.name}`);
  writeFileSync(path, original.replace(plant.before, plant.after));
  writeFileSync(join(subject, 'plant.json'), JSON.stringify(plant, null, 2) + '\n');
  const run = join(subject, 'run'); mkdirSync(run);
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', `--test-name-pattern=${plant.pattern}`, join(root, 'test/search.test.mjs')], {
    cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, RELATE_TELEMETRY: '0', DO_NOT_TRACK: '1', WHYGRAPH_SUBJECT_ROOT: subject, WHYGRAPH_TEST_RUN_DIR: run },
  });
  if (result.error) throw result.error;
  writeFileSync(join(subject, 'result.tap'), result.stdout); writeFileSync(join(subject, 'stderr.txt'), result.stderr);
  const red = [...result.stdout.matchAll(/^not ok \d+ - (.+)$/gm)].map(m => m[1]);
  outcomes.push({ name: plant.name, subject, exitCode: result.status, red });
  console.log(JSON.stringify(outcomes.at(-1)));
}
writeFileSync(join(scratch, 'summary.json'), JSON.stringify(outcomes, null, 2) + '\n');
console.log(`Plant evidence: ${scratch}`);
process.exitCode = outcomes.every(p => p.exitCode === 1 && p.red.length === 1 && p.red[0].startsWith('Q')) ? 0 : 1;

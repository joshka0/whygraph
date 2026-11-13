/** One fault per wider-list test group, exclusively in retained scratch subjects. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const scratch = join(root, 'test-results/scratch', `wider-plants-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`);
mkdirSync(scratch, { recursive: true });
const plants = [
  { name: 'candidate-label', group: 'K1 K14', file: 'src/search.pure.ts',
    before: 'matched: ${c.match}; source:', after: 'matching: ${c.match}; source:' },
  { name: 'rrf-constant', group: 'K2 K3', file: 'src/search.pure.ts',
    before: 'const K = 60;', after: 'const K = 0;' },
  { name: 'word-list-nine', group: 'K4 K5 K11', file: 'recipes/search.cypher',
    before: 'LIMIT 10', after: 'LIMIT 9' },
  { name: 'term-list-nine', group: 'K6 K7 K12', file: 'recipes/terms.cypher',
    before: 'LIMIT 10', after: 'LIMIT 9' },
  { name: 'unstable-answer', group: 'K7', file: 'src/search.pure.ts',
    before: 'return out.join("\\n");', after: 'return out.join("\\n") + String(process.pid);' },
  { name: 'empty-answer-text', group: 'K8 K9 K10', file: 'src/search.pure.ts',
    before: 'out.push(`No record matches "${query}".`)', after: 'out.push(`No records match "${query}".`)' },
  { name: 'list-size-nine', group: 'K13', file: 'src/search.pure.ts',
    before: 'export const LIST_SIZE = 10;', after: 'export const LIST_SIZE = 9;' },
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
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', `--test-name-pattern=^${plant.group} `, join(root, 'test/wider.test.mjs')], {
    cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, RELATE_TELEMETRY: '0', DO_NOT_TRACK: '1', WHYGRAPH_SUBJECT_ROOT: subject, WHYGRAPH_TEST_RUN_DIR: run },
  });
  if (result.error) throw result.error;
  writeFileSync(join(subject, 'result.tap'), result.stdout); writeFileSync(join(subject, 'stderr.txt'), result.stderr);
  const red = [...result.stdout.matchAll(/^not ok \d+ - (.+)$/gm)].map(m => m[1]);
  outcomes.push({ name: plant.name, group: plant.group, subject, exitCode: result.status, red });
  console.log(JSON.stringify(outcomes.at(-1)));
}
writeFileSync(join(scratch, 'summary.json'), JSON.stringify(outcomes, null, 2) + '\n');
console.log(`Plant evidence: ${scratch}`);
process.exitCode = outcomes.every(p => p.exitCode === 1 && p.red.length === 1 && p.red[0].startsWith(`${p.group} `)) ? 0 : 1;

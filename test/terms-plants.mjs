/** Fault injection for term/range contracts; retain every subject and TAP log. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const scratch = join(root, 'test-results/scratch', `terms-plants-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`);
mkdirSync(scratch, { recursive: true });
const plants = [
  { name: 'linked-record-repeated', pattern: '^T8 T20 ', file: 'src/answers.pure.ts',
    before: 'section.rows.filter((r) => !linked.has(r.id))', after: 'section.rows' },
  { name: 'range-start-off-by-one', pattern: '^Range boundaries ', file: 'src/ask.ts',
    before: 'lines.slice(start - 1, end)', after: 'lines.slice(start, end)' },
  { name: 'range-reads-whole-file', pattern: '^Range boundaries ', file: 'src/ask.ts',
    before: 'lines.slice(start - 1, end)', after: 'lines' },
  { name: 'common-term-weighted-as-rare', pattern: '^BM25 rarity ', file: 'recipes/terms.cypher',
    before: 'log(1.0 + (n - t.records + 0.5) / (t.records + 0.5)) AS idf', after: '1.0 AS idf' },
];
const outcomes = [];
for (const plant of plants) {
  const subject = join(scratch, plant.name); mkdirSync(subject);
  for (const path of ['src', 'recipes', 'package.json']) cpSync(join(root, path), join(subject, path), { recursive: true });
  symlinkSync(join(root, 'node_modules'), join(subject, 'node_modules'));
  const path = join(subject, plant.file); const original = readFileSync(path, 'utf8');
  assert.equal(original.split(plant.before).length - 1, 1, `unique mutation anchor: ${plant.name}`);
  writeFileSync(path, original.replace(plant.before, plant.after));
  writeFileSync(join(subject, 'plant.json'), JSON.stringify(plant, null, 2) + '\n');
  const run = join(subject, 'run'); mkdirSync(run);
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', `--test-name-pattern=${plant.pattern}`, join(root, 'test/terms.test.mjs')], {
    cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, RELATE_TELEMETRY: '0', DO_NOT_TRACK: '1', WHYGRAPH_SUBJECT_ROOT: subject, WHYGRAPH_TEST_RUN_DIR: run },
  });
  if (result.error) throw result.error;
  writeFileSync(join(subject, 'result.tap'), result.stdout); writeFileSync(join(subject, 'stderr.txt'), result.stderr);
  const red = [...result.stdout.matchAll(/^not ok \d+ - (.+)$/gm)].map(m => m[1]);
  const outcome = { name: plant.name, subject, exitCode: result.status, red };
  outcomes.push(outcome); console.log(JSON.stringify(outcome));
}
writeFileSync(join(scratch, 'summary.json'), JSON.stringify(outcomes, null, 2) + '\n');
console.log(`Plant evidence: ${scratch}`);
process.exitCode = outcomes.every(p => p.exitCode === 1 && p.red.length === 1 && /^(T8 |Range boundaries |BM25 rarity )/.test(p.red[0])) ? 0 : 1;

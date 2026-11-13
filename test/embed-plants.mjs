/** Plant embedding/punctuation faults in scratch copies, retaining evidence. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`;
const scratch = join(root, 'test-results/scratch', `embed-plants-${runId}`);
mkdirSync(scratch, { recursive: true });
const plants = [
  {
    name: 'all-records-in-one-model-call', file: 'src/embed.ts', test: 'embed.test.mjs', pattern: '^Q2[56] ',
    before: `    const vectors: number[][] = [];
    for (const text of texts) {
      const output = await extract([text], { pooling: "mean", normalize: true });
      vectors.push(...(output.tolist() as number[][]));
    }
    return vectors;`,
    after: `    const output = await extract([...texts], { pooling: "mean", normalize: true });
    return output.tolist() as number[][];`,
    expectedRed: ['Q25 ', 'Q26 '],
  },
  {
    name: 'punctuation-reaches-word-index', file: 'src/ask.ts', test: 'search.test.mjs', pattern: '^Q4 ',
    before: 'const words = searchWords(text);', after: 'const words = text;',
    expectedRed: ['Q4 '],
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
  // The scope also protects any future fixture growth in this plant runner.
  const result = spawnSync('systemd-run', ['--user', '--scope', '-q', '-p', 'MemoryMax=6G', '-p', 'CPUQuota=400%',
    process.execPath, '--test', '--test-reporter=tap', `--test-name-pattern=${plant.pattern}`, join(root, 'test', plant.test)], {
    cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, RELATE_TELEMETRY: '0', DO_NOT_TRACK: '1', WHYGRAPH_SUBJECT_ROOT: subject, WHYGRAPH_TEST_RUN_DIR: run },
  });
  if (result.error) throw result.error;
  writeFileSync(join(subject, 'result.tap'), result.stdout); writeFileSync(join(subject, 'stderr.txt'), result.stderr);
  const red = [...result.stdout.matchAll(/^not ok \d+ - (.+)$/gm)].map(m => m[1]);
  const detected = result.status === 1 && red.length === plant.expectedRed.length && plant.expectedRed.every(prefix => red.some(name => name.startsWith(prefix)));
  outcomes.push({ name: plant.name, subject, exitCode: result.status, red, detected });
  console.log(JSON.stringify(outcomes.at(-1)));
}
writeFileSync(join(scratch, 'summary.json'), JSON.stringify(outcomes, null, 2) + '\n');
console.log(`Plant evidence: ${scratch}`);
process.exitCode = outcomes.every(plant => plant.detected) ? 0 : 1;

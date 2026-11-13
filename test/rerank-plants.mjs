/** Faults stay in retained scratch copies; each suite uses the required resource scope. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const scratch = join(root, 'test-results/scratch', `rerank-plants-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`);
mkdirSync(scratch, { recursive: true });
const plants = [
  { name: 'unset-still-calls', group: 'N1 N2', file: 'src/rerank.ts',
    before: 'if (model === "") return undefined;', after: 'if (model === "" && env.WHYGRAPH_RERANK_URL === undefined) return undefined;' },
  { name: 'six-skips-call', group: 'N3 N4', file: 'src/rerank.pure.ts',
    before: 'export const RERANK_MIN = 6;', after: 'export const RERANK_MIN = 7;' },
  { name: 'more-than-five-listed', group: 'N5 N6 N7 N8 N9 N25 N26', file: 'src/rerank.pure.ts',
    before: 'indexes.slice(0, RERANK_TOP_N)', after: 'indexes.slice(0, RERANK_TOP_N + 1)' },
  { name: 'key-leaks-answer', group: 'N5 N6 N7 N8 N9 N25 N26', file: 'src/ask.ts',
    before: 'console.log(rerankAnswer(settings.model, endpointHost(settings.endpoint), candidates.length, picked.records, code));',
    after: 'console.log(rerankAnswer(settings.model, endpointHost(settings.endpoint), candidates.length, picked.records, code)); console.log(settings.apiKey);' },
  { name: 'document-601', group: 'N6 N9 N10 N11 N12', file: 'src/rerank.pure.ts',
    before: 'export const DOCUMENT_LIMIT = 600;', after: 'export const DOCUMENT_LIMIT = 601;' },
  { name: 'code-3001', group: 'N6 N9 N10 N11 N12', file: 'src/rerank.pure.ts',
    before: 'export const CODE_LIMIT = 3000;', after: 'export const CODE_LIMIT = 3001;' },
  { name: 'term-label-lost', group: 'N6 N9 N10 N11 N12', file: 'src/rerank.pure.ts',
    before: '...listsOf(at.match), terms: true', after: '...listsOf(at.match), terms: false' },
  { name: 'scope-lines-moved', group: 'N13', file: 'src/rerank.pure.ts',
    before: 'const scope = lines.splice(-2);', after: 'const scope = lines.splice(-1);' },
  { name: 'wrong-symbol-diagnostic', group: 'N14 N15 N16 N18', file: 'src/ask.ts',
    before: '--at takes <file>:<start>-<end>, not a symbol', after: '--at takes <file>:<start>-<end>, symbols forbidden' },
  { name: 'wrong-duplicate-option-diagnostic', group: 'N17', file: 'src/args.pure.ts',
    before: '${a} given twice', after: '${a} given again' },
  { name: 'failed-call-exits-nonzero', group: 'N19 N26', file: 'src/ask.ts',
    before: 'if (!call.ok) {\n    console.log(`${wide}\\n${rerankFailure(call.reason)}`);\n    return 0;',
    after: 'if (!call.ok) {\n    console.log(`${wide}\\n${rerankFailure(call.reason)}`);\n    return 1;' },
  { name: 'duplicate-index-accepted', group: 'N20 N21 N22 N26', file: 'src/rerank.pure.ts',
    before: 'if (seen.has(index as number))', after: 'if (false && seen.has(index as number))' },
  { name: 'timeout-one-second', group: 'N23 N26', file: 'src/rerank.ts',
    before: 'AbortSignal.timeout(10_000)', after: 'AbortSignal.timeout(1_000)' },
  { name: 'network-retried', group: 'N24 N26', file: 'src/rerank.ts',
    before: 'const response = await fetch(settings.endpoint,',
    after: 'await fetch(settings.endpoint, { method: "POST", headers, body: JSON.stringify(rerankBody(settings.model, query, documents)), signal: AbortSignal.timeout(10_000) }).catch(() => {});\n    const response = await fetch(settings.endpoint,' },
];
const env = { ...process.env, RELATE_TELEMETRY: '0', DO_NOT_TRACK: '1', NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${join(root, 'test/search-offline.mjs')}`.trim() };
for (const name of ['WHYGRAPH_RERANK', 'WHYGRAPH_RERANK_URL', 'OPENROUTER_API_KEY']) delete env[name];
function suite(subject, name, group) {
  const dir = join(scratch, name); mkdirSync(dir, { recursive: true });
  const run = join(dir, 'run'); mkdirSync(run);
  const result = spawnSync('systemd-run', ['--user', '--scope', '-q', '-p', 'MemoryMax=6G', '-p', 'CPUQuota=400%', process.execPath,
    '--test', '--test-reporter=tap', `--test-name-pattern=${group === undefined ? '^N' : `^${group} `}`, join(root, 'test/rerank.test.mjs')], {
    cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
    env: { ...env, WHYGRAPH_SUBJECT_ROOT: subject, WHYGRAPH_TEST_RUN_DIR: run },
  });
  if (result.error) throw result.error;
  writeFileSync(join(dir, 'result.tap'), result.stdout); writeFileSync(join(dir, 'stderr.txt'), result.stderr);
  return { exitCode: result.status, red: [...result.stdout.matchAll(/^not ok \d+ - (.+)$/gm)].map(m => m[1]), green: [...result.stdout.matchAll(/^ok \d+ - (.+)$/gm)].map(m => m[1]) };
}
const outcomes = [];
for (const plant of plants) {
  const subject = join(scratch, plant.name, 'subject'); mkdirSync(subject, { recursive: true });
  for (const file of ['src', 'recipes', 'package.json']) cpSync(join(root, file), join(subject, file), { recursive: true });
  symlinkSync(join(root, 'node_modules'), join(subject, 'node_modules'));
  const path = join(subject, plant.file); const original = readFileSync(path, 'utf8');
  assert.equal(original.split(plant.before).length - 1, 1, `unique anchor: ${plant.name}`);
  writeFileSync(path, original.replace(plant.before, plant.after));
  writeFileSync(join(scratch, plant.name, 'plant.json'), JSON.stringify(plant, null, 2) + '\n');
  const result = suite(subject, plant.name, plant.group);
  const outcome = { name: plant.name, group: plant.group, ...result };
  outcomes.push(outcome); console.log(JSON.stringify(outcome));
}
// One subsequent real-code run verifies all groups after the planted faults.
const real = suite(root, 'real-code');
const summary = { scratch, outcomes, real };
writeFileSync(join(scratch, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ real })); console.log(`Plant evidence: ${scratch}`);
process.exitCode = outcomes.every(p => p.exitCode === 1 && p.red.length === 1 && p.red[0].startsWith(`${p.group} `)) && real.exitCode === 0 ? 0 : 1;

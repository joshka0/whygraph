/**
 * Fault plants live only in retained copies outside the subject repository.
 * Usage: RELATE_TELEMETRY=0 DO_NOT_TRACK=1 node test/plants.mjs
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`;
const outside = join('/home/dev/scratch/whygraph-plants', runId);
mkdirSync(outside, { recursive: true });
mkdirSync(join(root, 'test-results'), { recursive: true });
const env = { ...process.env, RELATE_TELEMETRY: '0', DO_NOT_TRACK: '1' };
const plants = [
  {
    name: 'impact-ignores-supersedes', pattern: '^(A5|A6|I4) ',
    edits: [['recipes/impact.cypher', '[:SUPERSEDES]', '[:IGNORED_SUPERSEDES]']],
  },
  {
    name: 'why-insertion-order', pattern: '^(A3|B16|M3) ',
    // The loader inserts records in id order; force that order instead of date.
    edits: [['recipes/why.cypher', 'ORDER BY rank, date, id', 'ORDER BY rank, id']],
  },
  {
    name: 'build-merges-old-store', pattern: '^(B23|B24) ',
    edits: [
      ['src/store.ts', 'import { existsSync,', 'import { cpSync, existsSync,'],
      ['src/store.ts', 'const db = join(work, "db");', 'const db = join(work, "db");\n  if (isLink(store)) cpSync(resolve(dirname(store), readlinkSync(store)), db, { recursive: true });'],
      ['src/load.pure.ts', 'cypher: `UNWIND $rows AS r CREATE (:${label} {${map}})`', 'cypher: `UNWIND $rows AS r MERGE (n:${label} {${props[0]}: r.${props[0]}}) SET n += r`'],
    ],
  },
  {
    name: 'carry-direct-users-only', pattern: '^(A7|W14) ',
    edits: [['recipes/users.cypher', '[:USES*1..]', '[:USES*1..1]']],
  },
  {
    name: 'mcp-writable', pattern: '^(M1|M2) ',
    edits: [['src/ask.ts', 'store, "--read-only"]', 'store]']],
  },
];
const table = [];
for (const plant of plants) {
  const subject = join(outside, plant.name);
  mkdirSync(subject);
  for (const path of ['src', 'recipes', 'package.json']) cpSync(join(root, path), join(subject, path), { recursive: true });
  for (const [file, before, after, all] of plant.edits) {
    const path = join(subject, file);
    const text = readFileSync(path, 'utf8');
    const count = text.split(before).length - 1;
    assert.ok(count > 0 && (all === 'all' || count === 1), `plant ${plant.name}: expected anchor in ${file}; got ${count}`);
    writeFileSync(path, all === 'all' ? text.replaceAll(before, after) : text.replace(before, after));
  }
  writeFileSync(join(subject, 'plant.json'), JSON.stringify(plant, null, 2) + '\n');
  console.log(`Running ${plant.name} against ${plant.pattern}`);
  const started = performance.now();
  const result = spawnSync(process.execPath, [join(root, 'test/run.mjs'), `--test-name-pattern=${plant.pattern}`], {
    cwd: root, env: { ...env, WHYGRAPH_SUBJECT_ROOT: subject }, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  writeFileSync(join(subject, 'test.stdout'), result.stdout);
  writeFileSync(join(subject, 'test.stderr'), result.stderr);
  const report = result.stdout.match(/^TAP report: (.+)$/m)?.[1];
  assert.ok(report, result.stdout + result.stderr);
  const tap = readFileSync(report, 'utf8');
  const red = [...tap.matchAll(/^not ok \d+ - (.+)$/gm)].map(match => match[1]);
  table.push({ name: plant.name, subject, pattern: plant.pattern, exitCode: result.status, red, report, wallSeconds: (performance.now() - started) / 1000 });
  console.log(JSON.stringify(table.at(-1)));
}
const artifact = join(root, 'test-results', `plants-${runId}.json`);
writeFileSync(artifact, JSON.stringify({ outside, plants: table }, null, 2) + '\n');
console.log(`Plant table: ${artifact}`);
process.exitCode = table.every(row => row.exitCode !== 0 && row.red.length > 0) ? 0 : 1;

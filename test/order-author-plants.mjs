/** Retained, isolated wrong values prove the order/author contract groups detect regressions. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const scratch = join('/tmp', `whygraph-order-author-plants-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`);
mkdirSync(scratch);
const countOrder = 'CASE WHEN rank = 4 THEN head([x IN via WHERE x IS NOT NULL | x.symbols]) ELSE 0 END';
const plants = [
  { name: 'oldest-first-restored', group: 'W21 ', file: 'recipes/why.cypher',
    before: countOrder, after: '0' },
  { name: 'id-before-date', group: 'W21 ', file: 'recipes/why.cypher',
    before: ', date, id\n', after: ', id, date\n' },
  { name: 'named-commits-oldest-first', group: 'W24 ', file: 'recipes/why.cypher',
    before: 'ORDER BY symbols, k.date, k.sha', after: 'ORDER BY k.date, k.sha' },
  { name: 'author-not-stored', group: 'B30 ', file: 'src/load.pure.ts',
    before: 'author: r.author, source:', after: 'author: null, source:' },
  { name: 'empty-author-accepted', group: 'B33 ', file: 'src/records.pure.ts',
    before: 'typeof r.author === "string" && r.author.trim() === ""', after: 'false' },
  { name: 'invalid-author-accepted', group: 'B34 ', file: 'src/records.pure.ts',
    before: 'if (!nullableString(r.author))', after: 'if (false)' },
  { name: 'author-line-with-none', group: 'W28 ', file: 'src/answers.pure.ts',
    before: 'if (str(r.author) !== "") out.push(`      author: ${str(r.author)}`);',
    after: 'out.push(`      author: ${str(r.author)}`);' },
  { name: 'impact-author-lost', group: 'W28 ', file: 'src/answers.pure.ts',
    before: 'if (str(head.author) !== "") out.push(`  author: ${str(head.author)}`);',
    after: 'if (false) out.push(`  author: ${str(head.author)}`);' },
  { name: 'search-adds-author-line', group: 'Q27 ', test: 'rerank.test.mjs', file: 'src/search.pure.ts',
    before: 'out.push(`      matched: ${c.match}; source: ${c.source || "(not stated)"}`);',
    after: 'out.push(`      matched: ${c.match}; source: ${c.source || "(not stated)"}`); out.push("      author: R. Chen");' },
  { name: 'record-author-sent-to-reranker', group: 'Q27 ', test: 'rerank.test.mjs', file: 'src/ask.ts',
    before: 'rerankDocuments(candidates));',
    after: 'rerankDocuments(candidates).map((doc, i) => doc + " | " + String([...wordRows, ...meaningRows].find(row => row.id === candidates[i]!.id)?.author ?? "")));' },
];
const env = {
  ...process.env, RELATE_TELEMETRY: '0', DO_NOT_TRACK: '1',
  NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${join(root, 'test/search-offline.mjs')}`.trim(),
};
for (const name of ['WHYGRAPH_RERANK', 'WHYGRAPH_RERANK_URL', 'OPENROUTER_API_KEY']) delete env[name];
function suite(subject, name, pattern, files) {
  const dir = join(scratch, name); mkdirSync(dir, { recursive: true });
  const run = join(dir, 'run'); mkdirSync(run);
  const result = spawnSync('systemd-run', ['--user', '--scope', '-q', '-p', 'MemoryMax=6G', '-p', 'CPUQuota=400%',
    process.execPath, '--test', '--test-reporter=tap', `--test-name-pattern=${pattern}`, ...files.map(file => join(root, 'test', file))], {
    cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
    env: { ...env, WHYGRAPH_SUBJECT_ROOT: subject, WHYGRAPH_TEST_RUN_DIR: run },
  });
  if (result.error) throw result.error;
  writeFileSync(join(dir, 'result.tap'), result.stdout); writeFileSync(join(dir, 'stderr.txt'), result.stderr);
  return { exitCode: result.status, signal: result.signal,
    red: [...result.stdout.matchAll(/^not ok \d+ - (.+)$/gm)].map(m => m[1]),
    pass: Number(/^# pass (\d+)$/m.exec(result.stdout)?.[1] ?? 0) };
}
const outcomes = [];
for (const plant of plants) {
  const subject = join(scratch, plant.name, 'subject'); mkdirSync(subject, { recursive: true });
  for (const file of ['src', 'recipes', 'package.json']) cpSync(join(root, file), join(subject, file), { recursive: true });
  symlinkSync(join(root, 'node_modules'), join(subject, 'node_modules'));
  const path = join(subject, plant.file); const original = readFileSync(path, 'utf8');
  assert.equal(original.split(plant.before).length - 1, 1, `unique mutation anchor: ${plant.name}`);
  writeFileSync(path, original.replace(plant.before, plant.after));
  writeFileSync(join(scratch, plant.name, 'plant.json'), JSON.stringify(plant, null, 2) + '\n');
  const result = suite(subject, plant.name, `^${plant.group}`, [plant.test ?? 'order-author.test.mjs']);
  const detected = result.exitCode === 1 && result.red.length === 1 && result.red[0].startsWith(plant.group);
  const outcome = { name: plant.name, group: plant.group.trim(), ...result, detected };
  outcomes.push(outcome); console.log(JSON.stringify(outcome));
}
// Each planted group then returns to green against the untouched subject.
const real = suite(root, 'real-code', '^(W21 |W24 |B30 |B33 |B34 |W28 |Q27 )', ['order-author.test.mjs', 'rerank.test.mjs']);
const summary = { scratch, outcomes, real };
writeFileSync(join(scratch, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ real })); console.log(`Plant evidence: ${scratch}`);
process.exitCode = outcomes.every(p => p.detected) && real.exitCode === 0 && real.pass === 7 ? 0 : 1;

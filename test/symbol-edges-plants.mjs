/** One fault per symbol-edge contract group, in retained scratch subjects only. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

// Run under systemd-run --user --scope -q -p MemoryMax=6G -p CPUQuota=400%.
const root = fileURLToPath(new URL('../', import.meta.url));
const scratch = join(tmpdir(), `whygraph-symbol-edges-plants-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`);
mkdirSync(scratch, { recursive: true });
const plants = [
  { name: 'remove-rust', pattern: '^W17 ', file: 'src/code-graph.pure.ts',
    before: '  { language: "Rust", extensions: ["rs"] },\n', after: '' },
  { name: 'remove-swift', pattern: '^W18 ', file: 'src/code-graph.pure.ts',
    before: '  { language: "Swift", extensions: ["swift"] },\n', after: '' },
  { name: 'add-elixir', pattern: '^W19 Elixir ', file: 'src/code-graph.pure.ts',
    before: '  { language: "Swift", extensions: ["swift"] },',
    after: '  { language: "Swift", extensions: ["swift"] },\n  { language: "Elixir", extensions: ["ex"] },' },
  { name: 'declarations-unknown', pattern: '^W20 ', file: 'src/code-graph.pure.ts',
    before: 'return dot >= 0 && SYMBOL_EDGE_EXTENSIONS.has(path.slice(dot + 1));',
    after: 'return !path.endsWith(".d.ts") && dot >= 0 && SYMBOL_EDGE_EXTENSIONS.has(path.slice(dot + 1));' },
  ...[
    ['rust-reaches-typescript', 'symbol:src/lib.rs#call_ts', 'symbol:src/app.ts#tsh'],
    ['typescript-reaches-rust', 'symbol:src/app.ts#tsh', 'symbol:src/lib.rs#helper'],
  ].map(([name, from, to]) => ({ name, pattern: '^C13 ', file: 'src/code-graph.pure.ts',
    before: 'edges: value.edges as CodeEdge[]',
    after: `edges: [...value.edges as CodeEdge[], { kind: "uses", from: ${JSON.stringify(from)}, to: ${JSON.stringify(to)} }]` })),
];

function run(subject, pattern, evidence) {
  const result = spawnSync(process.execPath, [join(root, 'test/run.mjs'), `--test-name-pattern=${pattern}`], {
    cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, RELATE_TELEMETRY: '0', DO_NOT_TRACK: '1', WHYGRAPH_SUBJECT_ROOT: subject },
  });
  if (result.error) throw result.error;
  writeFileSync(`${evidence}.stdout`, result.stdout);
  writeFileSync(`${evidence}.stderr`, result.stderr);
  const report = result.stdout.match(/^TAP report: (.+)$/m)?.[1];
  assert.ok(report, result.stdout + result.stderr);
  const tap = readFileSync(report, 'utf8');
  const red = [...tap.matchAll(/^not ok \d+ - (.+)$/gm)].map(m => m[1]);
  const matched = [...tap.matchAll(/^ok \d+ - (.+)$/gm)].map(m => m[1]).filter(name => new RegExp(pattern).test(name));
  return { exitCode: result.status, signal: result.signal, red, matched, report };
}

const outcomes = [];
for (const plant of plants) {
  const subject = join(scratch, plant.name); mkdirSync(subject);
  for (const file of ['src', 'recipes', 'package.json']) cpSync(join(root, file), join(subject, file), { recursive: true });
  symlinkSync(join(root, 'node_modules'), join(subject, 'node_modules'));
  const path = join(subject, plant.file); const original = readFileSync(path, 'utf8');
  assert.equal(original.split(plant.before).length - 1, 1, `unique anchor: ${plant.name}`);
  writeFileSync(path, original.replace(plant.before, plant.after));
  writeFileSync(join(subject, 'plant.json'), JSON.stringify(plant, null, 2) + '\n');
  const red = run(subject, plant.pattern, join(subject, 'red'));
  const green = run(root, plant.pattern, join(subject, 'green'));
  outcomes.push({ name: plant.name, pattern: plant.pattern, subject, red, green });
  console.log(JSON.stringify(outcomes.at(-1)));
}
writeFileSync(join(scratch, 'summary.json'), JSON.stringify(outcomes, null, 2) + '\n');
console.log(`Plant evidence: ${scratch}`);
process.exitCode = outcomes.every(p =>
  p.red.exitCode === 1 && p.red.red.length === 1 && new RegExp(p.pattern).test(p.red.red[0]) &&
  p.green.exitCode === 0 && p.green.red.length === 0 && p.green.matched.length === 1) ? 0 : 1;

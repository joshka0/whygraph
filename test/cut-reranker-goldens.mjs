/** Generate removal goldens from 42ab13f, never from the current implementation.
 * Run: TMPDIR=/mnt/ssd/tmp systemd-run --user --scope -q -p MemoryMax=6G -p CPUQuota=400% node test/cut-reranker-goldens.mjs
 * Add --smoke to check one search before generating all outputs.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = '42ab13f';
const scratchRoot = join(root, 'test-results'); mkdirSync(scratchRoot, { recursive: true });
const scratch = mkdtempSync(join(scratchRoot, 'cut-goldens-'));
const subject = join(scratch, 'baseline'); mkdirSync(subject);
const env = { ...process.env, RELATE_TELEMETRY: '0', DO_NOT_TRACK: '1',
  PATH: `${root}/node_modules/.bin:${process.env.HOME}/.npm-global/bin:${process.env.HOME}/.local/share/mise/installs/pnpm/12.11.2:${process.env.HOME}/.local/bin:${process.env.PATH}`,
  NODE_OPTIONS: `--import=${join(root, 'test/search-offline.mjs')}`,
};
for (const name of ['WHYGRAPH_RERANK', 'WHYGRAPH_RERANK_URL', 'OPENROUTER_API_KEY']) delete env[name];
function run(file, args, cwd = root) {
  const r = spawnSync(file, args, { cwd, env, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  assert.ifError(r.error); assert.equal(r.status, 0, `${file} ${args.join(' ')}\n${r.stderr}`);
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}
const paths = run('git', ['ls-tree', '-r', '--name-only', base, 'src', 'recipes', 'package.json', 'scripts/fixture.sh']).stdout.trim().split('\n');
for (const path of paths) {
  mkdirSync(dirname(join(subject, path)), { recursive: true });
  writeFileSync(join(subject, path), run('git', ['show', `${base}:${path}`]).stdout);
}
symlinkSync(join(root, 'node_modules'), join(subject, 'node_modules'));
const cli = (repo, args) => run(process.execPath, [join(subject, 'src/main.ts'), ...args], repo);
const repo = join(scratch, 'fixture');
run('/bin/bash', [join(subject, 'scripts/fixture.sh'), repo]);
writeFileSync(join(repo, 'adrs.json'), cli(repo, ['decisions', 'adr', 'docs/adr']).stdout);
cli(repo, ['build', '--decisions', 'adrs.json', '--decisions', 'decisions/notes.json']);
const fixtureArgs = [
  ['search', 'round tax half to even'], ['search', 'tax'], ['search', 'quasarzeppelin'],
  ['why', 'src/tax.ts:taxRate'], ['impact', 'ADR-0002'],
  ['carry', 'src/money.ts:formatCents'], ['carry', 'src/tax.ts:11-20'],
];
if (process.argv.includes('--smoke')) {
  console.log(JSON.stringify({ scratch, smoke: cli(repo, fixtureArgs[0]) }));
} else {
  const fixture = fixtureArgs.map(args => ({ args, ...cli(repo, args) }));
  const store = join(repo, '.git/whygraph/store');
  const statements = [
    'MATCH (n) RETURN labels(n) AS labels, properties(n) AS props',
    'MATCH (a)-[r]->(b) RETURN labels(a) AS fromLabels, properties(a) AS fromProps, type(r) AS type, properties(r) AS props, labels(b) AS toLabels, properties(b) AS toProps',
    'SHOW INDEXES',
  ];
  const graph = statements.map(statement => ({ statement, rows: JSON.parse(run('relate', ['--no-agent-mode', '--max-rows', '0', '--database', store, '--read-only', '--json', '-c', statement]).stdout).data }));
  graph[2].rows = graph[2].rows.map(({ entityType, indexProvider, labelsOrTypes, owningConstraint, properties, state, type }) => ({ entityType, indexProvider, labelsOrTypes, owningConstraint, properties, state, type }));
  const ripgrepStore = resolve(process.env.WHYGRAPH_EVAL_WORK ?? '/var/tmp/whygraph-eval', '_ripgrep/store');
  assert.ok(existsSync(ripgrepStore), `Golden generation needs the read-only ripgrep store: ${ripgrepStore}`);
  const ripgrep = ['ignore hidden files', 'binary file detection', 'unicode case insensitive'].map(text => {
    const args = ['search', text];
    return { args, ...cli(root, [...args, '--store', ripgrepStore]) };
  });
  const rankingRecords = Array.from({ length: 8 }, (_, i) => ({ id: `ranking-${i}`, date: '2026-01-01',
    title: `Ranking fixture policy ${i}`, source: `public fixture ${i}`, items: [{ label: 'choice', text: `rankingfixture keeps candidate ${i}` }],
  }));
  writeFileSync(join(repo, 'ranking.json'), JSON.stringify({ records: rankingRecords }));
  cli(repo, ['build', '--decisions', 'ranking.json']);
  const ranking = { args: ['search', 'rankingfixture'], ...cli(repo, ['search', 'rankingfixture']) };
  const output = join(root, 'test/fixtures/cut-reranker-42ab13f.json');
  writeFileSync(output, JSON.stringify({ base: run('git', ['rev-parse', base]).stdout.trim(), fixture, graph, ripgrep, rankingRecords, ranking }, null, 2) + '\n');
  console.log(JSON.stringify({ scratch, output, fixture: fixture.length, ripgrep: ripgrep.length }));
}

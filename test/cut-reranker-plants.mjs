/** Removal mutations in source copies; never change the real subject.
 * Run in the same bounded scope as the suite. --only=<name> runs one smoke case.
 * The JSON summary names the red test and retains its first failing assertion.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
mkdirSync(join(root, 'test-results'), { recursive: true });
const scratch = mkdtempSync(join(root, 'test-results/cut-plants-'));
const plants = [
  { name: 'current-skill-restores-reranker', group: 'X4', file: 'skills/whygraph/SKILL.md',
    append: '\nUse the reranker.\n', assertion: 'current skill instructions' },
  { name: 'current-rule-restores-setting', group: 'X4', file: 'skills/whygraph-rule.md',
    append: '\nSet WHYGRAPH_RERANK.\n', assertion: 'current skill instructions' },
  { name: 'new-skill-restores-at', group: 'X4', file: 'skills/planted/SKILL.md',
    create: 'Use whygraph search --at src/tax.ts:1-2.\n', assertion: 'current skill instructions' },
  { name: 'removal-changes-eval-byte', group: 'X8', history: true, file: 'eval/opencode.mjs',
    append: '\n// Planted removal byte.\n', assertion: 'removal commit changes no eval or skill bytes' },
  { name: 'removal-changes-skill-byte', group: 'X8', history: true, file: 'skills/whygraph/SKILL.md',
    append: '\nPlanted removal byte.\n', assertion: 'removal commit changes no eval or skill bytes' },
  ...['ripgrep-conflict-rg-01', 'ripgrep4-conflict-rg-04', 'ripgrep5-conflict-rg-04', 'hono6-conflict-hn-01'].map((name, i) => ({
    name: `frozen-batch-${i + 3}-task-changes`, group: 'X8', file: `eval/tasks/${name}.json`,
    append: '\n', assertion: `frozen task eval/tasks/${name}.json`,
  })),
  ...['requests.json', 'hono/controls2.json'].map(name => ({
    name: `frozen-blind-${name.replaceAll('/', '-')}-changes`, group: 'X8', file: `eval/tickets/${name}`,
    append: '\n', assertion: `frozen blind input eval/tickets/${name}`,
  })),
  { name: 'search-one-byte-drift', group: 'X1', file: 'src/ask.ts',
    before: 'console.log(searchAnswer(text, words, true, fused));', after: 'console.log(searchAnswer(text, words, true, fused) + " ");',
    assertion: 'stdout bytes' },
  { name: 'at-accepted-and-ignored', group: 'X2', file: 'src/args.pure.ts',
    before: '} else if (a.startsWith("--"))', after: '} else if (a === "--at") { i++; } else if (a.startsWith("--"))',
    assertion: 'no file/store/tool access' },
  { name: 'at-wrong-exit', group: 'X2', file: 'src/main.ts',
    before: 'return fail(`${args.usage}\\n\\n${USAGE}`, 2);', after: 'return fail(`${args.usage}\\n\\n${USAGE}`, 1);',
    assertion: 'exit status' },
  { name: 'old-setting-sends-request', group: 'X6', file: 'src/ask.ts',
    before: 'console.log(searchAnswer(text, words, true, fused));',
    after: 'if (process.env.WHYGRAPH_RERANK) await fetch(process.env.WHYGRAPH_RERANK_URL!, { method: "POST", body: "planted" });\n  console.log(searchAnswer(text, words, true, fused));',
    assertion: 'no ranking endpoint request' },
  { name: 'old-setting-prints-notice', group: 'X6', file: 'src/ask.ts',
    before: 'console.log(searchAnswer(text, words, true, fused));',
    after: 'if (process.env.WHYGRAPH_RERANK) console.error("Former setting ignored");\n  console.log(searchAnswer(text, words, true, fused));',
    assertion: 'stderr bytes' },
  { name: 'removed-import-restored', group: 'X3', file: 'src/ask.ts',
    before: 'import { existsSync,', after: 'import "./rerank.ts";\nimport { existsSync,',
    assertion: 'removed import' },
  { name: 'unexpected-runtime-dependency', group: 'X3', file: 'package.json',
    before: '"memod": "file:vendor/memod-0.2.0.tgz"', after: '"memod": "file:vendor/memod-0.2.0.tgz",\n    "left-pad": "1.3.0"',
    assertion: 'manifest dependencies' },
  { name: 'unexpected-dev-dependency', group: 'X3', file: 'package.json',
    before: '"tsrs": "0.23.0-ts7.1.0-beta"', after: '"tsrs": "0.23.0-ts7.1.0-beta",\n    "left-pad": "1.3.0"',
    assertion: 'manifest dependencies' },
  { name: 'unexpected-lock-package', group: 'X3', file: 'pnpm-lock.yaml',
    before: "\npackages:\n\n", after: "\npackages:\n\n  left-pad@1.3.0:\n    resolution: {integrity: sha512-planted}\n\n",
    assertion: 'lockfile packages' },
  { name: 'unknown-option-reads-store-first', group: 'X2', file: 'src/main.ts',
    before: 'if ("usage" in args) return fail',
    after: 'if ("usage" in args) (await import("node:fs")).existsSync(argv[argv.indexOf("--store") + 1]!);\n  if ("usage" in args) return fail',
    assertion: 'no file/store/tool access' },
  { name: 'retained-q27-author-mutation', group: 'Q27', test: 'search-author.test.mjs', file: 'src/search.pure.ts',
    before: 'out.push(`      matched: ${c.match}; source: ${c.source || "(not stated)"}`);',
    after: 'out.push(`      matched: ${c.match}; source: ${c.source || "(not stated)"}`); out.push("      author: R. Chen");',
    assertion: '21 !== 15' },
];
const env = { ...process.env, RELATE_TELEMETRY: '0', DO_NOT_TRACK: '1',
  NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${join(root, 'test/search-offline.mjs')}`.trim(),
};
const listed = spawnSync('git', ['ls-files', 'src', 'recipes', 'test', 'skills', 'eval', 'bin', 'package.json', 'pnpm-lock.yaml', 'README.md', 'vendor'], { cwd: root, encoding: 'utf8' });
assert.ifError(listed.error); assert.equal(listed.status, 0, listed.stderr);
// Include this uncommitted test bundle when running before its first commit.
const extras = ['test/cut-reranker.test.mjs', 'test/cut-reranker-guard.mjs', 'test/cut-reranker-loopback.mjs', 'test/fixtures/cut-reranker-42ab13f.json'];
const only = process.argv.find(arg => arg.startsWith('--only='))?.slice('--only='.length);
if (only) assert.ok(plants.some(p => p.name === only), `unknown plant ${only}`);
const outcomes = [];
for (const plant of plants.filter(p => !only || p.name === only)) {
  const folder = join(scratch, plant.name), subject = join(folder, 'subject'), run = join(folder, 'run');
  mkdirSync(subject, { recursive: true }); mkdirSync(run);
  const git = (args, input) => {
    const result = spawnSync('git', args, { cwd: subject, env, input, encoding: 'utf8' });
    assert.ifError(result.error); assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };
  // Borrow objects without a checkout. All new objects and refs stay in scratch.
  if (plant.group === 'X8') git(['clone', '--shared', '--no-checkout', '--quiet', root, subject]);
  for (const path of new Set([...listed.stdout.trim().split('\n'), ...extras])) {
    mkdirSync(dirname(join(subject, path)), { recursive: true }); cpSync(join(root, path), join(subject, path));
  }
  symlinkSync(join(root, 'node_modules'), join(subject, 'node_modules'));
  symlinkSync(join(root, 'eval/results'), join(subject, 'eval/results'));
  const path = join(subject, plant.file);
  mkdirSync(dirname(path), { recursive: true });
  const original = plant.create === undefined ? readFileSync(path, 'utf8') : '';
  if (plant.before !== undefined) assert.equal(original.split(plant.before).length - 1, 1, `unique anchor for ${plant.name}`);
  writeFileSync(path, plant.create ?? (plant.append === undefined ? original.replace(plant.before, plant.after) : original + plant.append));
  if (plant.history) {
    const removal = 'c243073707ac95df6d93b74ccf4417541dd7647e';
    const baseline = JSON.parse(readFileSync(join(root, 'test/fixtures/cut-reranker-42ab13f.json'), 'utf8')).base;
    git(['read-tree', removal]);
    // Change only one historical blob, based on that commit's bytes.
    const historical = git(['show', `${removal}:${plant.file}`]);
    const blob = git(['hash-object', '-w', '--stdin'], historical + plant.append).trim();
    git(['update-index', '--add', '--cacheinfo', `100644,${blob},${plant.file}`]);
    const tree = git(['write-tree']).trim();
    const planted = git(['-c', 'user.name=plant', '-c', 'user.email=plant@example.invalid', 'commit-tree', tree, '-p', baseline], `Plant ${plant.name}\n`).trim();
    const testPath = join(subject, 'test/cut-reranker.test.mjs'), text = readFileSync(testPath, 'utf8');
    assert.equal(text.split(removal).length - 1, 1, 'unique removal commit anchor');
    writeFileSync(testPath, text.replace(removal, planted));
    writeFileSync(join(folder, 'history.json'), JSON.stringify({ baseline, removal, planted, changed: git(['diff', '--name-only', baseline, planted, '--', 'eval', 'skills']) }, null, 2) + '\n');
  }
  writeFileSync(join(folder, 'plant.json'), JSON.stringify(plant, null, 2) + '\n');
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', `--test-name-pattern=^${plant.group} `,
    join(plant.history ? subject : root, 'test', plant.test ?? 'cut-reranker.test.mjs')], {
    cwd: root, env: { ...env, WHYGRAPH_SUBJECT_ROOT: subject, WHYGRAPH_TEST_RUN_DIR: run },
    encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  });
  assert.ifError(result.error);
  writeFileSync(join(folder, 'result.tap'), result.stdout); writeFileSync(join(folder, 'stderr.txt'), result.stderr);
  const red = [...result.stdout.matchAll(/^not ok \d+ - (.+)$/gm)].map(m => m[1]);
  const first = result.stdout.match(/\n\s+error: ([\s\S]*?)\n\s+code:/)?.[1] ?? null;
  const detected = result.status === 1 && red.length === 1 && red[0].startsWith(`${plant.group} `) && first?.includes(plant.assertion) === true;
  const outcome = { name: plant.name, test: red[0], exit: result.status, detected, firstFailingAssertion: first, folder };
  outcomes.push(outcome); console.log(JSON.stringify(outcome));
}
writeFileSync(join(scratch, 'summary.json'), JSON.stringify({ scratch, outcomes }, null, 2) + '\n');
console.log(`Plant evidence: ${scratch}`);
process.exitCode = outcomes.every(outcome => outcome.detected) ? 0 : 1;

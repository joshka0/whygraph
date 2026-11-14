/** One removed behavior restored per plant, only in retained scratch copies. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const scratch = join(root, 'test-results/scratch', `unused-plants-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`);
mkdirSync(scratch, { recursive: true });
const loadNode = (label, key, kind) => [
  ['src/load.pure.ts', '  File: "path",', `  File: "path",\n  ${label}: "${key}",`],
  ['src/load.pure.ts', '  file: "File",', `  file: "File",\n  ${kind}: "${label}",`],
  ['src/load.pure.ts', '  const codeTopics =', `  steps.push(...nodeStep("${label}", ["${key}"], of("${kind}").map(n => ({ ${key}: n.name }))));\n  const codeTopics =`],
];
const plants = [
  { name: 'U1-accept-topics', pattern: '^U1 all ', edits: [
    ['src/records.pure.ts', 'if (!FIELDS.includes(k))', 'if (k !== "topics" && !FIELDS.includes(k))'],
  ] },
  { name: 'U1-ADR-topics-again', pattern: '^U1 ADR ', edits: [
    ['src/adr.pure.ts', '    source: file.path,', '    source: file.path,\n    topics: [...preamble.matchAll(/\\[\\[([^\\]]+)\\]\\]/g)].map(m => m[1]),'],
  ] },
  { name: 'U2-read-trailers-again', pattern: '^U2 ', edits: [
    ['src/build.ts', '  const ids = new Set(checked.records.map((r) => r.id));', `  for (const commit of commits) {
    const message = run("git", ["show", "-s", "--format=%B", commit.sha], { cwd: root }).stdout;
    for (const match of message.matchAll(/^Decision:\\s*(\\S+)\\s*$/gmi)) {
      if (checked.records.some(r => r.id === match[1])) {
        const cites = checked.cites as Map<string, readonly string[]>;
        cites.set(match[1]!, [...new Set([...(cites.get(match[1]!) ?? []), commit.sha])]);
      }
    }
  }
  const ids = new Set(checked.records.map((r) => r.id));`],
  ] },
  { name: 'U3-load-memos-again', pattern: '^U3 ', edits: [
    ...loadNode('Memo', 'ref', 'memo'),
    ['src/load.pure.ts', '    ["decided", "DECIDED"],', '    ["premise", "PREMISE"],\n    ["decided", "DECIDED"],'],
  ] },
  { name: 'U3-premise-line-again', pattern: '^U3 ', edits: [
    ['src/answers.pure.ts', '  const checks = sorted(list(carry.checks));', '  out.push("No premise memo is recorded for it.");\n  const checks = sorted(list(carry.checks));'],
  ] },
  { name: 'U4-load-packages-and-imports-again', pattern: '^U4 ', edits: [
    ...loadNode('Package', 'name', 'package'),
    ['src/load.pure.ts', '    ["decided", "DECIDED"],', '    ["imports", "IMPORTS"],\n    ["decided", "DECIDED"],'],
  ] },
  { name: 'U5-ABOUT-again', pattern: '^U5 ', edits: [
    ['src/load.pure.ts', '  const items = checked.records.flatMap', `  steps.push(...edgeStep("ABOUT", "Decision", "Topic", [], checked.records.flatMap(r => of("topic").slice(0, 1).map(t => ({ from: r.id, to: t.name })))));
  const items = checked.records.flatMap`],
  ] },
  { name: 'U6-nondeterministic-build-summary', pattern: '^U6 ', edits: [
    ['src/build.ts', '  console.log(`${total(labels)} nodes:', '  console.log(Math.random());\n  console.log(`${total(labels)} nodes:'],
  ] },
  { name: 'U7-read-comments-again', pattern: '^U7 ', edits: [
    ['src/terms.pure.ts', '  return lines.slice(line - 1, endLine);', '  return lines.slice(0, endLine);'],
  ] },
  { name: 'U8-largest-commit-first', pattern: '^U8 ', edits: [
    ['recipes/why.cypher', 'ORDER BY symbols, k.date, k.sha', 'ORDER BY symbols DESC, k.date, k.sha'],
  ] },
  { name: 'U9-suggest-trailers-again', pattern: '^U9 ', edits: [
    ['src/answers.pure.ts', 'No commit in this repo\'s history cites it (a commit the record lists).', 'No commit in this repo\'s history cites it (a `Decision:` trailer, or a commit the record lists).'],
  ] },
];
function run(subject, pattern, evidence) {
  const result = spawnSync(process.execPath, [join(root, 'test/run.mjs'), `--test-name-pattern=${pattern}`], {
    cwd: root, encoding: 'utf8', maxBuffer: 24 * 1024 * 1024,
    env: { ...process.env, RELATE_TELEMETRY: '0', DO_NOT_TRACK: '1', WHYGRAPH_SUBJECT_ROOT: subject },
  });
  if (result.error) throw result.error;
  writeFileSync(`${evidence}.stdout`, result.stdout); writeFileSync(`${evidence}.stderr`, result.stderr);
  const report = result.stdout.match(/^TAP report: (.+)$/m)?.[1]; assert.ok(report, result.stdout + result.stderr);
  const tap = readFileSync(report, 'utf8');
  const red = [...tap.matchAll(/^not ok \d+ - (.+)$/gm)].map(m => m[1]);
  const matched = [...tap.matchAll(/^ok \d+ - (.+)$/gm)].map(m => m[1]).filter(name => new RegExp(pattern).test(name));
  const diagnostics = [...tap.matchAll(/^not ok \d+ - ([^\n]+)\n([\s\S]*?)^  \.\.\./gm)].map(m => ({ test: m[1], assertion: m[2].match(/  error: ([\s\S]*?)(?=\n  code:)/)?.[1]?.trim(), assertionError: /code: 'ERR_ASSERTION'/.test(m[2]) }));
  return { exitCode: result.status, signal: result.signal, red, matched, report, diagnostics };
}
const outcomes = [];
for (const plant of plants) {
  const subject = join(scratch, plant.name); mkdirSync(subject);
  for (const file of ['src', 'recipes', 'package.json']) cpSync(join(root, file), join(subject, file), { recursive: true });
  symlinkSync(join(root, 'node_modules'), join(subject, 'node_modules'));
  for (const [file, before, after] of plant.edits) {
    const path = join(subject, file); const text = readFileSync(path, 'utf8');
    assert.equal(text.split(before).length - 1, 1, `unique plant anchor: ${plant.name} in ${file}`);
    writeFileSync(path, text.replace(before, after));
  }
  writeFileSync(join(subject, 'plant.json'), JSON.stringify(plant, null, 2) + '\n');
  const red = run(subject, plant.pattern, join(subject, 'red'));
  const green = run(root, plant.pattern, join(subject, 'green'));
  outcomes.push({ name: plant.name, pattern: plant.pattern, subject, red, green });
  writeFileSync(join(scratch, 'summary.json'), JSON.stringify(outcomes, null, 2) + '\n');
  console.log(JSON.stringify({ name: plant.name, red: red.red, redExit: red.exitCode, greenExit: green.exitCode, firstAssertion: red.diagnostics[0]?.assertion?.slice(0, 350) }));
}
console.log(`Plant evidence: ${scratch}`);
process.exitCode = outcomes.every(p => p.red.exitCode === 1 && p.red.red.length >= 1 && p.red.red.every(name => new RegExp(p.pattern).test(name)) && p.red.diagnostics.every(d => d.assertionError) && p.green.exitCode === 0 && p.green.matched.length >= 1 && p.green.red.length === 0) ? 0 : 1;

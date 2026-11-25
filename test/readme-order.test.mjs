/**
 * module: [[whygraph-documentation-contracts]]
 * RO1-RO13 come from the readme-order failure list of the entry improvement plan.
 * An independent author wrote them from that list, not from the edits they check.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { harness as h } from './support.mjs';
import { CARRY, README, consoleBlocks, contract, flat, headings, read, section, slug, slugs } from './readme-text.mjs';

const TEMPLATE = [/^Use case$/, /^How it uses Relate$/, /^Setup and run$/, /^Where the data lives$/, /^Measured results and limits$/, /^Reused code/];

contract('RO1', 'README opens with # whygraph and the contest template headings, each once and in order', () => {
  const text = README(); const h2 = headings(text).filter(x => x.level === 2);
  assert.equal(text.split('\n')[0], '# whygraph');
  for (const pattern of TEMPLATE) assert.equal(h2.filter(x => pattern.test(x.title)).length, 1, `exactly one ## heading ${pattern}`);
  assert.deepEqual(h2.slice(0, TEMPLATE.length).map(x => x.title).map((title, i) => TEMPLATE[i].test(title) ? 'ok' : title),
    TEMPLATE.map(() => 'ok'), 'the first six ## headings follow the template order');
  for (const old of ['How and why we use Relate', 'Quickstart']) assert.ok(!h2.some(x => x.title === old), `old heading ## ${old} remains`);
});

contract('RO2', 'Use case sits by line 12 and the first formatCents carry by line 60, before How it uses Relate', () => {
  const text = README(); const lines = text.split('\n'); const h2 = headings(text).filter(x => x.level === 2);
  const useCase = h2.find(x => x.title === 'Use case'); assert.ok(useCase && useCase.line <= 12, `## Use case at line ${useCase?.line}`);
  const carry = lines.findIndex(l => l.includes(CARRY)) + 1; assert.ok(carry > 0 && carry <= 60, `first ${CARRY} at line ${carry}`);
  for (const pattern of TEMPLATE.slice(1)) {
    const heading = h2.find(x => pattern.test(x.title));
    assert.ok(heading && carry < heading.line, `first carry (line ${carry}) must precede ${pattern} (line ${heading?.line})`);
  }
});

contract('RO3', 'the first formatCents carry is a preview with its marker on the line above, and a later live twin has the same body', () => {
  const text = README(); const lines = text.split('\n');
  for (const [i, line] of lines.entries()) if (line === '<!-- readme-check: preview -->') assert.equal(lines[i + 1], '```console', `preview marker at line ${i + 1} is not directly above a console fence`);
  const blocks = consoleBlocks(text); const carries = blocks.filter(b => b.commands.includes(CARRY));
  assert.ok(carries.length >= 2, 'the preview and the live formatCents carry blocks both exist');
  assert.ok(carries[0].preview, `the first formatCents carry block (line ${carries[0].line}) is not a preview`);
  const live = carries.find(b => !b.preview); assert.ok(live, 'no live formatCents carry block');
  assert.equal(live.body, carries[0].body, 'the preview and its live twin differ');
  for (const [i, b] of blocks.entries()) if (b.preview) for (const c of b.commands) {
    assert.ok(blocks.slice(i + 1).some(later => !later.preview && later.commands.includes(c)), `preview command has no later live run: ${c}`);
  }
});

contract('RO4', 'live console commands that need a store run after the fixture, decisions adr and build', () => {
  const live = consoleBlocks(README()).filter(b => !b.preview).flatMap(b => b.commands);
  const at = pattern => live.findIndex(c => pattern.test(c));
  const fixture = at(/^scripts\/fixture\.sh /); const adr = at(/^whygraph decisions adr /); const build = at(/^whygraph build\b/);
  assert.ok(fixture >= 0 && adr > fixture && build > adr, `fixture ${fixture}, decisions adr ${adr}, build ${build} out of order`);
  for (const [i, c] of live.entries()) if (/^whygraph (carry|why|impact|search)\b/.test(c)) assert.ok(i > build, `live store command before build: ${c}`);
});

contract('RO5', 'the help block text and the cent exit marker stay', () => {
  const blocks = consoleBlocks(README());
  const help = blocks.find(b => b.commands[0] === 'whygraph help'); assert.ok(help, 'no whygraph help console block');
  assert.equal(help.body.split('\n')[1], 'whygraph: why the code is the way it is, as a relate graph');
  const cent = blocks.find(b => b.commands.includes('whygraph carry src/money.ts:cent')); assert.ok(cent, 'no cent carry block');
  assert.match(cent.body, /\n\[exit 3\]\n$/);
});

contract('RO6', 'the score block stays in What a trial measured, with no digit outside it and no new ## inside it', () => {
  const text = README(); const lines = text.split('\n');
  const markers = lines.flatMap((l, i) => l.startsWith('<!-- readme-check: score ') ? [i] : []);
  assert.equal(markers.length, 1, 'exactly one score marker'); assert.equal(lines[markers[0] + 1], '```text');
  const h2 = headings(text).filter(x => x.level === 2);
  const before = h2.filter(x => x.line <= markers[0] + 1).at(-1); const after = h2.find(x => x.line > markers[0] + 1);
  assert.equal(before?.title, 'What a trial measured'); assert.equal(after?.title, 'What a retrieval check measured');
  const { text: body } = section(text, 'What a trial measured');
  const outside = body.replace(/^<!-- readme-check: score \S+ -->\n```text\n[\s\S]*?^```$/m, '');
  assert.deepEqual(outside.split('\n').filter(l => /\d/.test(l)), [], 'digits outside the score block');
});

contract('RO7', 'no schema picture is fenced as console', () => {
  for (const b of consoleBlocks(README())) assert.doesNotMatch(b.body, /^\s*(?:flowchart|graph)\s+(?:TD|TB|LR|RL|BT)\b|-->/m, `console block at line ${b.line}`);
});

contract('RO8', 'every Measured results number stays, and the limit sentences stay', () => {
  const body = flat(section(README(), 'Measured results and limits').text);
  const tokens = body.match(/\d+(?:\.\d+)?/g) ?? [];
  // The numbers of this section at b0ecfa3, from eval/score.txt; the section may add, never drop or change one.
  const baseline = ['20', '6', '31', '95', '15', '48', '12', '7', '51', '31', '19', '95', '3', '39', '35', '34.4', '35', '91.7', '0', '9', '1', '9', '11', '12'];
  const left = [...tokens];
  for (const n of baseline) { const i = left.indexOf(n); assert.ok(i >= 0, `Measured results lost the number ${n}`); left.splice(i, 1); }
  for (const phrase of ['51%', '31%', '15 to 48', '3 to 39', '34.4 million', '91.7 million', '0 of 9', '1 of 9 (11%)', '12 runs']) assert.ok(body.includes(phrase), `Measured results lost "${phrase}"`);
  for (const sentence of ['The pilot cannot attribute the gain to one part.', 'They do not establish a gain for other repos or models, or the quality of changes after a person approves them.']) {
    assert.ok(body.includes(sentence), `limit sentence missing: ${sentence}`);
  }
});

contract('RO9', 'the first stub definition matches eval/README.md: same skill and rule, whygraph answers no result', () => {
  const paragraphs = section(README(), 'Measured results and limits').text.split(/\n\s*\n/).map(flat);
  const first = paragraphs.find(p => /\bstub\b/.test(p)); assert.ok(first, 'Measured results never names the stub');
  assert.match(first, /same skill and rule/); assert.match(first, /`?whygraph`? (?:answers|prints) ["`]?no result/);
});

contract('RO10', 'the disclosures are linked from the first 20 lines and the store mode is named in the first 120', () => {
  const text = README(); const lines = text.split('\n');
  const reused = headings(text).find(x => x.level === 2 && /^Reused code/.test(x.title)); assert.ok(reused, 'no Reused code section');
  assert.ok(lines.slice(0, 20).join('\n').includes(`](#${slug(reused.title)})`), `no link to #${slug(reused.title)} in the first 20 lines`);
  const top = flat(lines.slice(0, 120).join('\n'));
  for (const word of ['single file', 'directory', 'examples/shop.rl']) assert.ok(top.includes(word), `"${word}" not in the first 120 lines`);
});

function markdownFiles(dir, out = []) {
  for (const entry of readdirSync(join(h.subject, dir), { withFileTypes: true })) {
    if (['node_modules', '.git', 'test-results'].includes(entry.name)) continue;
    const path = dir === '.' ? entry.name : join(dir, entry.name);
    if (entry.isDirectory() && (dir !== '.' || ['docs', 'eval', 'skills'].includes(entry.name))) markdownFiles(path, out);
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(path);
  }
  return out;
}
contract('RO11', 'every link to a README anchor resolves and no two README headings share a slug', () => {
  const text = README(); const anchors = slugs(text);
  const base = headings(text).map(x => slug(x.title));
  assert.deepEqual(base.filter((s, i) => base.indexOf(s) !== i), [], 'duplicate README heading slugs');
  for (const m of text.matchAll(/\]\(#([^)\s]+)\)/g)) assert.ok(anchors.has(m[1]), `README links #${m[1]}, which no heading makes`);
  for (const file of markdownFiles('.')) {
    for (const m of read(file).matchAll(/\]\(((?:\.\.?\/)*)README\.md#([^)\s]+)\)/g)) {
      const target = relative(h.subject, join(h.subject, file, '..', m[1], 'README.md'));
      if (target === 'README.md') assert.ok(anchors.has(m[2]), `${file} links README.md#${m[2]}, which no heading makes`);
    }
  }
  assert.doesNotMatch(read('docs/entry-check.md'), /#quickstart\b/);
});

contract('RO12', 'ADR 0014: the first command under Setup and run is the Relate-only query, with no Node, pnpm or whygraph before it', () => {
  const { text } = section(README(), 'Setup and run');
  const code = [...text.matchAll(/^```(?:sh|bash|console|shell)\n([\s\S]*?)^```$/gm)].flatMap(m => m[1].split('\n'))
    .map(l => l.replace(/^\$ /, '').trim()).filter(l => l !== '' && !/^git clone /.test(l) && !/^cd whygraph$/.test(l));
  assert.ok(code.length > 0, 'Setup and run holds no command');
  assert.match(code[0], /^relate --database examples\/shop\.rl --read-only\b/, `first command: ${code[0]}`);
  const before = text.slice(0, text.indexOf(code[0]));
  const fenced = [...before.matchAll(/^```[a-z]*\n([\s\S]*?)^```$/gm)].flatMap(m => m[1].split('\n'))
    .filter(l => !/^(?:\$ )?(?:git clone |cd whygraph$)/.test(l.trim())).join('\n');
  assert.doesNotMatch(fenced, /\b(?:pnpm|npm|node|whygraph)\b/, 'a Node, pnpm or whygraph command precedes the Relate query');
});

function files(dir) {
  const root = join(h.subject, dir); if (!existsSync(root)) return [];
  return readdirSync(root, { recursive: true, withFileTypes: true }).filter(e => e.isFile()).map(e => join(e.parentPath ?? e.path, e.name));
}
contract('RO13', 'README, skills, bin, recipes and src name no removed option (rerank, --at)', () => {
  for (const file of [join(h.subject, 'README.md'), ...['skills', 'bin', 'recipes', 'src'].flatMap(files)]) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /rerank|--at\b/i, relative(h.subject, file));
  }
});

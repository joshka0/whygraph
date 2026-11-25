/**
 * module: [[whygraph-documentation-contracts]]
 * FV comes from the failure list of first-screen-visual in the entry improvement
 * plan. An independent author wrote it from that list. The picture in README's
 * Use case must draw only relationships the loader stores, each with an instance
 * in examples/shop.rl, and its sentences must not overclaim.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { harness as h } from './support.mjs';

const README = () => readFileSync(join(h.subject, 'README.md'), 'utf8');
const LABELS = ['Decision', 'Commit', 'Symbol', 'DecidedTag'];
// The relationships the loader stores between these labels (src/load.pure.ts, recipes/users.cypher).
const STORED = [
  'Decision CITES Commit', 'Commit CHANGES Symbol', 'Symbol DECIDED DecidedTag', 'DecidedTag NAMES Decision',
  'Symbol USES Symbol', 'Decision RESTS_ON Decision', 'Decision SUPERSEDES Decision',
].sort();
const RIVALS = /Ripple|Precedent|Thread Compass|CodeContext/i;

/** The README's level-2 Use case section and its line range. */
function useCase(text) {
  const lines = text.split('\n'); let fence = false; const h2 = [];
  for (const [i, l] of lines.entries()) { if (/^```/.test(l)) fence = !fence; else if (!fence && l.startsWith('## ')) h2.push({ title: l.slice(3).trim(), i }); }
  const at = h2.findIndex(x => x.title === 'Use case'); assert.ok(at >= 0, 'README has no ## Use case');
  return { from: h2[at].i, to: h2[at + 1]?.i ?? lines.length, text: lines.slice(h2[at].i, h2[at + 1]?.i ?? lines.length).join('\n') };
}
function mermaid(text) {
  const blocks = [...text.matchAll(/^```mermaid\n([\s\S]*?)^```$/gm)];
  assert.equal(blocks.length, 1, 'README holds exactly one mermaid block');
  return { body: blocks[0][1], line: text.slice(0, blocks[0].index).split('\n').length - 1 };
}
const NODE = String.raw`([A-Za-z_][\w-]*)(?:\s*(?:\[\[|\[\(|\(\[|\(\(|\[|\(|\{)\s*"?([^"\]\)\}]*?)"?\s*(?:\]\]|\)\]|\]\)|\)\)|\]|\)|\}))?`;
/** Nodes and edges of a flowchart; any line it cannot read is returned as unread. */
function parse(body) {
  const lines = body.split('\n').map(l => l.trim()).filter(l => l !== '' && !l.startsWith('%%'));
  const header = lines.shift(); const nodes = new Map(); const edges = []; const unread = [];
  const node = (id, label) => { if (label !== undefined && label !== '') nodes.set(id, label); else if (!nodes.has(id)) nodes.set(id, id); };
  const edgeA = new RegExp(`^${NODE}\\s*-->\\s*\\|\\s*"?([^|"]+?)"?\\s*\\|\\s*${NODE}\\s*;?$`);
  const edgeB = new RegExp(`^${NODE}\\s*--\\s+"?([^"]+?)"?\\s+-->\\s*${NODE}\\s*;?$`);
  const lone = new RegExp(`^${NODE}\\s*;?$`);
  for (const l of lines) {
    const m = edgeA.exec(l) ?? edgeB.exec(l);
    if (m) { node(m[1], m[2]); node(m[4], m[5]); edges.push({ from: m[1], label: m[3].trim(), to: m[4] }); continue; }
    const n = lone.exec(l);
    if (n && n[2] !== undefined) { node(n[1], n[2]); continue; }
    if (/^(?:accTitle|accDescr)\b/.test(l)) continue;
    unread.push(l);
  }
  return { header, nodes, edges, unread };
}
const clean = label => label.replace(/[`:"]/g, '').trim();

test('FV1 the Use case picture is one mermaid flowchart of the four labels and the seven stored edges, all solid', () => {
  const text = README(); const section = useCase(text); const { body, line } = mermaid(text);
  assert.ok(line > section.from && line < section.to, `the mermaid block (line ${line + 1}) is outside ## Use case`);
  const { header, nodes, edges, unread } = parse(body);
  assert.match(header ?? '', /^(?:flowchart|graph) (?:TD|TB|LR|RL|BT)$/);
  assert.deepEqual(unread, [], 'lines that are not a node or a solid labelled edge (dotted or thick edges, styles, fills, subgraphs)');
  assert.doesNotMatch(body, /fill\s*:|classDef|\bstyle\b|-\.->|==>/, 'fixed fills, styles or non-solid edges');
  for (const id of nodes.keys()) assert.notEqual(id.toLowerCase(), 'end', 'node id end breaks Mermaid');
  assert.deepEqual([...nodes.values()].map(clean).sort(), [...LABELS].sort(), 'exactly the four labels, once each');
  const label = id => clean(nodes.get(id));
  const drawn = edges.map(e => `${label(e.from)} ${clean(e.label)} ${label(e.to)}`).sort();
  assert.deepEqual(drawn, STORED, 'the drawn edges are exactly the seven stored ones, each once and in its stored direction');
});

test('FV2 every drawn edge has an instance in examples/shop.rl, read without changing the file', () => {
  const { nodes, edges } = parse(mermaid(README()).body);
  const store = join(h.subject, 'examples/shop.rl');
  const sum = () => createHash('sha256').update(readFileSync(store)).digest('hex'); const before = sum();
  assert.ok(edges.length > 0, 'the picture draws no edge');
  for (const e of edges) {
    const [from, type, to] = [clean(nodes.get(e.from)), clean(e.label), clean(nodes.get(e.to))];
    for (const name of [from, type, to]) assert.match(name, /^[A-Za-z_]+$/, `unsafe name ${name}`);
    const result = h.command('relate', ['--no-agent-mode', '--max-rows', '0', '--database', store, '--read-only', '--json', '-c', `MATCH (:${from})-[:${type}]->(:${to}) RETURN count(*) AS n`], h.subject);
    const rows = JSON.parse(h.ok(result)).data;
    assert.ok(Number(rows[0]?.n) > 0, `examples/shop.rl holds no ${from}-[:${type}]->${to}: ${JSON.stringify(rows)}`);
  }
  assert.equal(sum(), before, 'reading examples/shop.rl changed it');
});

test('FV3 the sentences above the picture are short, digit-free, scoped and link the graph table and the pilot', () => {
  const text = README(); const section = useCase(text); const { line } = mermaid(text);
  const lines = text.split('\n'); let end = line - 1;
  while (end > section.from && lines[end].trim() === '') end--;
  let start = end; while (start > section.from && lines[start - 1].trim() !== '' && !/^(?:#|```)/.test(lines[start - 1])) start--;
  const paragraph = lines.slice(start, end + 1).join(' ').replace(/\s+/g, ' ').trim();
  assert.match(paragraph, /`?decided:`? tag/, `the sentences above the picture do not name the decided: tag path: ${paragraph}`);
  assert.match(paragraph, /\bcommit\b/, 'the sentences above the picture do not name the commit path');
  const words = paragraph.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/`/g, '').split(' ').filter(w => /\w/.test(w));
  assert.ok(words.length <= 45, `${words.length} words above the picture: ${paragraph}`);
  assert.doesNotMatch(paragraph, /\d/); assert.doesNotMatch(paragraph, RIVALS); assert.doesNotMatch(paragraph, /rerank|--at\b/i);
  assert.doesNotMatch(paragraph, /every link comes from|a person wrote|controlled trial|\bcaus(?:e|es|ed)\b/i);
  if (/never by similarity/i.test(paragraph)) assert.match(paragraph, /candidate/i);
  if (/\bunknown\b/i.test(paragraph)) assert.match(paragraph, /cannot read|can't read|does not read/i, 'unknown is claimed without scoping it to code memod cannot read');
  for (const anchor of ['#the-graph', '#measured-results-and-limits']) assert.ok(section.text.includes(`](${anchor})`), `## Use case does not link ${anchor}`);
  assert.doesNotMatch(section.text.replace(/^```mermaid\n[\s\S]*?^```$/m, ''), /^```(?:text|console)\n[^`]*(?:-\[:|-->)/m, 'a second schema sits in Use case');
});

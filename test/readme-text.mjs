/**
 * module: [[whygraph-documentation-contracts]]
 * Reading helpers for the README and docs contracts RO, CF and RH: headings
 * outside code fences, GitHub anchors, level-2 sections and console blocks.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { harness as h } from './support.mjs';

export const read = path => readFileSync(join(h.subject, path), 'utf8');
export const flat = text => text.replace(/\s+/g, ' ');
export function contract(id, description, body) {
  test(`${id} ${description}`, { timeout: 60_000 }, async t => body(t));
}

/** README lines with every fenced block body blanked, so headings inside code do not count. */
export function outsideFences(text) {
  let fence = null;
  return text.split('\n').map(line => {
    const open = /^(`{3,}|~{3,})/.exec(line);
    if (fence === null && open) { fence = open[1]; return ''; }
    if (fence !== null) { if (line.startsWith(fence) && line.trim() === fence) fence = null; return ''; }
    return line;
  });
}
export function headings(text) {
  return outsideFences(text).flatMap((line, i) => {
    const m = /^(#{1,6}) (.+?)\s*#*\s*$/.exec(line);
    return m ? [{ level: m[1].length, title: m[2], line: i + 1 }] : [];
  });
}
/** GitHub's heading anchor: rendered text, lower case, punctuation dropped, spaces to hyphens. */
export function slug(title) {
  return title.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/`/g, '').trim().toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
}
export function slugs(text) {
  const seen = new Map(); const out = new Set();
  for (const { title } of headings(text)) {
    const base = slug(title); const n = seen.get(base) ?? 0; seen.set(base, n + 1);
    out.add(n === 0 ? base : `${base}-${n}`);
  }
  return out;
}
/** The text of the level-2 section whose heading matches, from its heading to the next level-2 heading. */
export function section(text, match) {
  const lines = text.split('\n'); const hs = headings(text).filter(x => x.level === 2);
  const at = hs.findIndex(x => match instanceof RegExp ? match.test(x.title) : x.title === match);
  assert.ok(at >= 0, `README has no ## heading ${match}`);
  const end = hs[at + 1]?.line ?? lines.length + 1;
  return { start: hs[at].line, end, text: lines.slice(hs[at].line - 1, end - 1).join('\n') };
}
/** Console blocks in README order: start line, preview marker, commands with output. */
export function consoleBlocks(text) {
  return [...text.matchAll(/^(<!-- readme-check: preview -->\n)?```console\n([\s\S]*?)^```$/gm)].map(m => ({
    line: text.slice(0, m.index).split('\n').length + (m[1] ? 1 : 0),
    preview: m[1] !== undefined, body: m[2],
    commands: m[2].split('\n').filter(l => l.startsWith('$ ')).map(l => l.slice(2)),
  }));
}
export const README = () => read('README.md');
export const CARRY = 'whygraph carry src/money.ts:formatCents';

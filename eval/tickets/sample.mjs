#!/usr/bin/env node
/** module: [[whygraph-ticket-pilot-tasks]] */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { extname } from 'node:path';
import { evalBatch, evalRegistry } from '../registry.mjs';
const args = process.argv.slice(2);
const opt = name => args[args.indexOf(name) + 1];
if (!args.includes('--batch') || !args.includes('--tickets') || !args.includes('--out')) throw new Error('usage: sample.mjs --batch N --tickets FILE --out FILE');
const design = evalBatch(Number(opt('--batch'))), repo = evalRegistry.repos[design.repo];
if (design.selection.mode !== 'strata' || !design.sampleSeed || !repo.sourceExtensions?.length) throw new Error('sampling requires strata, sampleSeed and sourceExtensions in the registry');
const tickets = JSON.parse(readFileSync(opt('--tickets'), 'utf8'));
if (!Array.isArray(tickets) || new Set(tickets.map(t => t.key)).size !== tickets.length || tickets.some(t => !/^\d+$/.test(t.key) || !['open', 'closed'].includes(t.state))) throw new Error('invalid or duplicate tickets/outcomes');
const log = execFileSync('git', ['-C', repo.source, 'log', '--format=%x1e%H%x1f%B%x1d', '--name-only'], { encoding: 'utf8', maxBuffer: 1 << 28 });
const cited = new Set(), sourceCited = new Set();
for (const chunk of log.split('\x1e').slice(1)) {
  const at = chunk.indexOf('\x1d');
  const head = chunk.slice(0, at), files = chunk.slice(at + 1).trim().split('\n');
  for (const match of head.slice(head.indexOf('\x1f') + 1).matchAll(/#(\d+)\b/g)) {
    cited.add(match[1]);
    if (files.some(f => repo.sourceExtensions.includes(extname(f)))) sourceCited.add(match[1]);
  }
}
const sample = [];
for (const stratum of ['cited', 'uncited']) {
  const candidates = tickets.filter(t => stratum === 'cited' ? sourceCited.has(t.key) : !cited.has(t.key) && t.state === 'closed');
  const rank = t => createHash('sha256').update(`${design.sampleSeed}\0${stratum}\0${t.key}`).digest('hex');
  candidates.sort((a, b) => rank(a).localeCompare(rank(b)) || Number(a.key) - Number(b.key));
  if (candidates.length < 60) throw new Error(`${stratum}: need 60 tickets, got ${candidates.length}; no sample written`);
  sample.push(...candidates.slice(0, 60).map(t => ({ id: `ticket-${t.key}`, stratum })));
}
writeFileSync(opt('--out'), JSON.stringify(sample, null, 2) + '\n');
console.log(`sampled 60 cited and 60 uncited tickets; seed ${design.sampleSeed}`);

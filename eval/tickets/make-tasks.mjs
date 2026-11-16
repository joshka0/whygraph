#!/usr/bin/env node
/**
 * module: [[whygraph-ticket-pilot-tasks]]
 * Writes registered ticket batches (batch 3 by default, or --batch N) tasks; starts no agents.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { evalBatch, evalRegistry } from '../registry.mjs';

const root = new URL('../', import.meta.url);
const batch = process.argv.includes('--batch') ? Number(process.argv[process.argv.indexOf('--batch') + 1]) : 3;
const design = evalBatch(batch);
if (design.selection.mode === 'existing') throw new Error(`batch ${batch} has existing tasks only`);
const repo = evalRegistry.repos[design.repo];
const input = (name) => new URL(`${repo.blind}/${name}`, root);
const read = (name) => JSON.parse(readFileSync(input(name.replace(/^\.\//, '')), 'utf8'));
const governed = design.counts.governed ? read('./controls2.json') : [];
const controls = design.counts.plain ? read('./controls.json') : [];
function checkControls(entries, count, fields, label) {
  if (!Array.isArray(entries) || entries.length !== count) throw new Error(`need ${count} ${label}`);
  const ids = new Set();
  for (const entry of entries) {
    for (const field of fields) if (typeof entry?.[field] !== 'string' || !entry[field].trim()) throw new Error(`${label}: missing ${field}`);
    if (ids.has(entry.id)) throw new Error(`${label}: duplicate ${entry.id}`);
    ids.add(entry.id);
    new RegExp(entry.added, 'i');
  }
}
if (design.counts.plain) checkControls(controls, design.counts.plain, ['id', 'request', 'kind', 'file', 'added', 'why_harmless', 'evidence'], 'plain controls');
if (design.counts.governed) {
  checkControls(governed, design.counts.governed, ['id', 'request', 'kind', 'file', 'added', 'ticket', 'commit', 'decided', 'why_not_against', 'evidence'], 'governed controls');
}
for (const file of design.hashChecks) {
  const expected = design.sha256[file];
  if (!/^[a-f0-9]{64}$/.test(expected ?? '') || createHash('sha256').update(readFileSync(input(file))).digest('hex') !== expected) throw new Error(`${file} SHA-256 mismatch`);
}
const requests = read('./requests.json');
const locations = read('./targets.json');
if (design.verifyInputs) {
  const sample = read('./sample-ids.json');
  if (!Array.isArray(requests) || requests.length !== design.counts.requests) throw new Error(`need ${design.counts.requests} requests`);
  if (!Array.isArray(locations) || locations.length !== requests.length) throw new Error('need one target entry per request');
  if (design.selection.mode === 'strata') {
    const strata = ['cited', 'uncited'];
    const sampleSize = strata.reduce((total, stratum) => total + design.sampleCounts[stratum], 0);
    if (!Array.isArray(sample) || sample.length !== sampleSize || sample.some(x => !/^ticket-\d+$/.test(x?.id) || !strata.includes(x.stratum)) || new Set(sample.map(x => x.id)).size !== sampleSize || strata.some(s => sample.filter(x => x.stratum === s).length !== design.sampleCounts[s])) throw new Error('invalid stratified sample ids: need registry sample counts per stratum');
    if (new Set(requests.map(entry=>String(entry.record))).size !== requests.length) throw new Error('two requests name the same sampled ticket');
    for (const entry of requests) if (!sample.some(x => x.id === `ticket-${entry.record}` && x.stratum === entry.stratum)) throw new Error(`${entry.id}: request stratum does not match sample`);
  } else if (!Array.isArray(sample) || !sample.length || sample.some(id => typeof id !== 'string' || !/^ticket-\d+$/.test(id)) || new Set(sample).size !== sample.length) throw new Error('invalid sample ids');
  const allIds = new Set();
  for (const entry of [...requests, ...controls, ...governed]) {
    if (typeof entry?.id !== 'string' || !entry.id.trim() || allIds.has(entry.id)) throw new Error(`missing or duplicate id ${entry?.id}`);
    if (design.selection.mode === 'strata' && !/^[A-Za-z0-9_-]+$/.test(entry.id)) throw new Error(`unsafe task id ${entry.id}`);
    allIds.add(entry.id);
  }
  for (const entry of requests) {
    for (const field of ['id', 'request', 'wording', 'settled', 'why']) if (typeof entry[field] !== 'string' || !entry[field].trim()) throw new Error(`${entry.id}: missing ${field}`);
    if (!['same-words', 'partial', 'other-words'].includes(entry.wording)) throw new Error(`${entry.id}: invalid wording`);
    if (!Array.isArray(entry.shared_terms) || entry.shared_terms.some(term => typeof term !== 'string' || !term.trim())) throw new Error(`${entry.id}: invalid shared_terms`);
    if (!/^\d+$/.test(String(entry.record))) throw new Error(`${entry.id}: invalid record (a ticket number holds only digits)`);
    if (!Array.isArray(entry.also) || entry.also.some(number => !/^\d+$/.test(String(number)))) throw new Error(`${entry.id}: invalid also (an array of ticket numbers that hold only digits)`);
  }
  const located = new Set();
  for (const entry of locations) {
    if (!requests.some(request => request.id === entry.id) || located.has(entry.id) || !Array.isArray(entry.targets)) throw new Error(`invalid or duplicate target id ${entry.id}`);
    located.add(entry.id);
    for (const target of entry.targets) {
      if (typeof target.file !== 'string' || !target.file.trim() || typeof target.symbol !== 'string' || !target.symbol.trim()) throw new Error(`${entry.id}: missing target file or symbol`);
    }
  }
  for (const entry of governed) if (!/^ticket-\d+$/.test(entry.ticket)) throw new Error(`${entry.id}: invalid governed ticket`);
}
const targets = new Map(locations.map((entry) => [entry.id, entry.targets]));
const ranged = requests.filter((entry) => targets.get(entry.id)?.some((t) =>
  Number.isInteger(t.start_line) && Number.isInteger(t.end_line) && t.start_line > 0 && t.end_line >= t.start_line));
ranged.sort((a, b) => a.id.localeCompare(b.id, 'en'));
const group = design.selection.mode === 'strata' ? 'stratum' : 'wording';
const selected = Object.entries(design.selection.strata ?? design.selection.wording).flatMap(([value, count]) => {
  const picked = ranged.filter((entry) => entry[group] === value).slice(0, count);
  if (picked.length !== count) throw new Error(`need ${count} ranged ${value} requests, got ${picked.length}`);
  return picked;
});
const pickedIds = new Set(selected.map((s) => s.id));
const conflicts = ['take', 'strata'].includes(design.selection.mode) ? selected : ranged.filter((s) => !pickedIds.has(s.id));
if (conflicts.length !== design.counts.conflicts) throw new Error(`need ${design.counts.conflicts} conflicts, got ${conflicts.length}`);
const pending = [];
for (const source of conflicts) {
  const id = `${design.prefix}-conflict-${source.id}`;
  const records = [source.record, ...(source.also ?? [])].map((number) => {
    if (!/^\d+$/.test(String(number))) throw new Error(`${source.id}: invalid ticket number ${number}`);
    return {
      id: `ticket-${number}`,
      any: [`(?:#|\\b(?:${batch === 3 ? "ticket-" : "ticket[- ]"}|issues/|issue\\s+|pr\\s+|pull request\\s+|pull/)#?)${number}(?!\\d)`],
    };
  });
  const task = {
    id, kind: 'conflict', repo: repo.name, batch, ...(design.selection.mode === 'strata' ? { stratum: source.stratum } : {}),
    request: source.request,
    ground_truth: { source, targets: targets.get(source.id) },
    score: { records, protected: 'all' },
    pass_rule: 'Names the source ticket or one of its also tickets, and changes no file. Accepted spellings (case insensitive): #N, ticket-N, issue N, issues/N, PR N, pull request N, pull/N, with an optional # before the number and no following digit. No amendment exception. Other ticket mentions and when the conflict was noticed are not scored.' + (batch >= 4 ? ' Also accepts ticket N (a space), any case, with an optional #.' : ''),
  };
  pending.push(task);
}

if (design.counts.plain || design.counts.governed) {
  for (const source of [...controls, ...governed]) {
    const id = `${design.prefix}-control-${source.id}`;
    const task = {
      id, kind: 'control', repo: repo.name, batch, request: source.request,
      ground_truth: { source },
      score: { done: [{ file: source.file, added: source.added }] },
      pass_rule: 'Passes when the diff adds a line matching source.added (case insensitive) in source.file. No other condition is scored.',
    };
    pending.push(task);
  }
}
for (const task of pending) {
  writeFileSync(new URL(`../tasks/${task.id}.json`, import.meta.url), `${JSON.stringify(task, null, 2)}\n`);
  console.log(task.id);
}

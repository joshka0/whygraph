#!/usr/bin/env node
/**
 * module: [[whygraph-ticket-pilot-tasks]]
 * Writes batch 3 (default), 4 or 5 (--batch N) tasks; starts no agents.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const read = (name) => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
const batch = process.argv.includes('--batch') ? Number(process.argv[process.argv.indexOf('--batch') + 1]) : 3;
if (![3, 4, 5].includes(batch)) throw new Error('batch must be 3, 4 or 5');
const governed = batch === 5 ? read('./controls2.json') : [];
const controls = batch >= 4 ? read('./controls.json') : [];
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
if (batch >= 4) checkControls(controls, 5, ['id', 'request', 'kind', 'file', 'added', 'why_harmless', 'evidence'], 'plain controls');
if (batch === 5) {
  checkControls(governed, 8, ['id', 'request', 'kind', 'file', 'added', 'ticket', 'commit', 'decided', 'why_not_against', 'evidence'], 'governed controls');
  const hash = createHash('sha256').update(readFileSync(new URL('./controls2.json', import.meta.url))).digest('hex');
  if (hash !== 'a358eb529f81821a24c21f00503ec552ac24426d2e604fba3f5120c959c04763') throw new Error('controls2.json SHA-256 mismatch');
}
const requests = read('./requests.json');
const targets = new Map(read('./targets.json').map((entry) => [entry.id, entry.targets]));
const ranged = requests.filter((entry) => targets.get(entry.id)?.some((t) =>
  Number.isInteger(t.start_line) && Number.isInteger(t.end_line) && t.start_line > 0 && t.end_line >= t.start_line));
ranged.sort((a, b) => a.id.localeCompare(b.id, 'en'));
const selected = [['same-words', 3], ['partial', 3], ['other-words', 4]].flatMap(([wording, count]) => {
  const picked = ranged.filter((entry) => entry.wording === wording).slice(0, count);
  if (picked.length !== count) throw new Error(`need ${count} ranged ${wording} requests, got ${picked.length}`);
  return picked;
});
const pickedIds = new Set(selected.map((s) => s.id));
const conflicts = batch === 3 ? selected : ranged.filter((s) => !pickedIds.has(s.id));
const pending = [];
for (const source of conflicts) {
  const id = `${batch === 3 ? "ripgrep" : `ripgrep${batch}`}-conflict-${source.id}`;
  const records = [source.record, ...(source.also ?? [])].map((number) => {
    if (!/^\d+$/.test(String(number))) throw new Error(`${source.id}: invalid ticket number ${number}`);
    return {
      id: `ticket-${number}`,
      any: [`(?:#|\\b(?:${batch === 3 ? "ticket-" : "ticket[- ]"}|issues/|issue\\s+|pr\\s+|pull request\\s+|pull/)#?)${number}(?!\\d)`],
    };
  });
  const task = {
    id, kind: 'conflict', repo: 'ripgrep', batch,
    request: source.request,
    ground_truth: { source, targets: targets.get(source.id) },
    score: { records, protected: 'all' },
    pass_rule: 'Names the source ticket or one of its also tickets, and changes no file. Accepted spellings (case insensitive): #N, ticket-N, issue N, issues/N, PR N, pull request N, pull/N, with an optional # before the number and no following digit. No amendment exception. Other ticket mentions and when the conflict was noticed are not scored.' + (batch >= 4 ? ' Also accepts ticket N (a space), any case, with an optional #.' : ''),
  };
  pending.push(task);
}

if (batch >= 4) {
  for (const source of [...controls, ...governed]) {
    const id = `ripgrep${batch}-control-${source.id}`;
    const task = {
      id, kind: 'control', repo: 'ripgrep', batch, request: source.request,
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

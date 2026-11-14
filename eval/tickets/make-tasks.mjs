#!/usr/bin/env node
/**
 * module: [[whygraph-ticket-pilot-tasks]]
 * Writes the ten batch 3 tasks by the fixed selection rule; starts no agents.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const read = (name) => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
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
for (const source of selected) {
  const id = `ripgrep-conflict-${source.id}`;
  const records = [source.record, ...(source.also ?? [])].map((number) => {
    if (!/^\d+$/.test(String(number))) throw new Error(`${source.id}: invalid ticket number ${number}`);
    return {
      id: `ticket-${number}`,
      any: [`(?:#|\\b(?:ticket-|issues/|issue\\s+|pr\\s+|pull request\\s+|pull/)#?)${number}(?!\\d)`],
    };
  });
  const task = {
    id, kind: 'conflict', repo: 'ripgrep', batch: 3,
    request: source.request,
    ground_truth: { source, targets: targets.get(source.id) },
    score: { records, protected: 'all' },
    pass_rule: 'Names the source ticket or one of its also tickets, and changes no file. Accepted spellings (case insensitive): #N, ticket-N, issue N, issues/N, PR N, pull request N, pull/N, with an optional # before the number and no following digit. No amendment exception. Other ticket mentions and when the conflict was noticed are not scored.',
  };
  writeFileSync(new URL(`../tasks/${id}.json`, import.meta.url), `${JSON.stringify(task, null, 2)}\n`);
  console.log(id);
}

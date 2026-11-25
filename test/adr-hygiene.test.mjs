/**
 * module: [[whygraph-documentation-contracts]]
 * RH1-RH4 come from the repo-hygiene failure list of the entry improvement plan.
 * An independent author wrote them from that list, not from the edits they check.
 * RH1 runs `whygraph decisions adr docs/adr` in the subject checkout.
 */
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { harness as h } from './support.mjs';
import { contract, flat, read } from './readme-text.mjs';

const DATES = { 4: '2026-11-13', 8: '2026-11-15', 9: '2026-11-15', 10: '2026-11-15', 11: '2026-11-15', 12: '2026-11-15', 13: '2026-11-16', 14: '2026-11-20', 15: '2026-11-23' };
const adrFile = n => readdirSync(join(h.subject, 'docs/adr')).find(f => f.startsWith(`${String(n).padStart(4, '0')}-`));
contract('RH1', 'decisions adr reads 15 ADRs, each dated by its first commit and with a one-sentence status', () => {
  const result = h.command(process.execPath, [join(h.subject, 'src/main.ts'), 'decisions', 'adr', 'docs/adr'], h.subject);
  const records = JSON.parse(h.ok(result)).records;
  assert.deepEqual(records.map(r => r.id), Array.from({ length: 15 }, (_, i) => `ADR-${String(i + 1).padStart(4, '0')}`));
  for (const r of records) {
    assert.match(r.date ?? '', /^\d{4}-\d{2}-\d{2}$/, `${r.id} has no date`);
    assert.ok(typeof r.status === 'string' && r.status.trim() !== '' && !r.status.includes('.'), `${r.id} status ${JSON.stringify(r.status)}`);
    assert.ok(r.commits.length > 0, `${r.id} cites no commit`);
  }
  const by = Object.fromEntries(records.map(r => [Number(r.id.slice(4)), r]));
  for (const [n, date] of Object.entries(DATES)) assert.equal(by[n].date, date, `ADR ${n} date`);
  for (const n of [8, 9, 10, 11, 12, 13, 14, 15]) assert.equal(by[n].status, 'accepted', `ADR ${n} status`);
  assert.equal(by[4].status, 'superseded by ADR 0009');
  assert.equal(by[14].title, 'Distribute the shop graph and its build tools');
  assert.equal(by[15].title, 'License the bundled memod package under MIT');
  assert.equal(by[9].supersedes.filter(id => id === 'ADR-0004').length, 1, 'ADR-0009 lists ADR-0004 once');
});
contract('RH2', 'ADR 0004 and 0008 to 0015 hold Date, Status and Topic on line 3, and 0004 states its status without a link', () => {
  for (const n of Object.keys(DATES)) {
    const lines = read(join('docs/adr', adrFile(n))).split('\n');
    assert.match(lines[0], /^# ADR \d{4}[:.] /, `ADR ${n} title line`);
    assert.match(lines[2], new RegExp(`^Date: ${DATES[n]}\\. Status: [^.]+\\. Topic: \\[\\[[\\w-]+\\]\\]\\.?$`), `ADR ${n} line 3: ${lines[2]}`);
  }
  const line = read(join('docs/adr', adrFile(4))).split('\n')[2];
  assert.doesNotMatch(line, /\]\(|\.md\b/); assert.match(line, /Status: superseded by ADR 0009\./);
});
contract('RH3', 'ADR 0009 and 0010 hold no stale future or fleet wording, and no ADR adds a supersedes or replaces line', () => {
  for (const n of [9, 10]) assert.doesNotMatch(read(join('docs/adr', adrFile(n))), /parked contract|until the parent|will add|\bthe parent\b|\bdev:/i, `ADR ${n}`);
  for (const n of Object.keys(DATES)) for (const l of read(join('docs/adr', adrFile(n))).split('\n')) {
    if (/\b(?:supersedes|replaces)\b.*\bADR[ -]?\d/i.test(l) && !/superseded by/i.test(l)) assert.equal(`${n}: ${l}`, '9: This decision supersedes ADR 0004.', 'only ADR 0009 may supersede, and only ADR 0004');
  }
});
contract('RH4', 'AGENTS.md links the bundled memod and ADR 0014, says the source is private, and keeps the owns rule', () => {
  const text = read('AGENTS.md'); const top = flat(text);
  assert.doesNotMatch(text, /gitlab\.com/); assert.doesNotMatch(text, /README\.md#/);
  assert.match(text, /\]\((?:\.\/)?vendor\/memod-0\.2\.0\.tgz\)/); assert.match(text, /\]\((?:\.\/)?docs\/adr\/0014-[\w-]+\.md\)/);
  assert.match(top, /source (?:repo )?is private/); assert.doesNotMatch(top, /memod[^.]*\bis public\b/i);
  assert.ok(text.includes('owns: [[topic]]') && text.includes('node_modules/.bin/memod topics'), 'AGENTS.md lost the owns rule');
});

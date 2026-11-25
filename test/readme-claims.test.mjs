/**
 * module: [[whygraph-documentation-contracts]]
 * CF1-CF7 come from the claims-fix failure list of the entry improvement plan.
 * An independent author wrote them from that list, not from the edits they check.
 */
import assert from 'node:assert/strict';
import { README, contract, flat, read, section } from './readme-text.mjs';

contract('CF1', 'the opening says an editing agent does not always read the reason, not never, rarely or usually', () => {
  const top = flat(README().split('\n').slice(0, 5).join('\n'));
  assert.doesNotMatch(top, /never reads? it|(?:rarely|usually) reads?\b/);
  assert.match(top, /does not always read it/);
});
contract('CF2', 'trial conditions no longer claim the batches ran the instructions as this README installs them', () => {
  const text = flat(README());
  assert.doesNotMatch(text, /as this README installs them/);
  assert.doesNotMatch(text, /batches 1 to 3 (?:all )?(?:lacked|had no|ran without)\b[^.]*search/i);
});
contract('CF3', 'the AI tools disclosure pins its commit counts to b0ecfa3, drops the unbacked DeepSeek clause and copies no session link', () => {
  const text = README(); const ai = flat(section(text, /^Reused code/).text.split(/^### AI tools$/m)[1] ?? '');
  assert.ok(ai !== '', 'no ### AI tools subsection');
  assert.doesNotMatch(ai, /DeepSeek models wrote some features/);
  for (const fact of ['b0ecfa3', '216', '41', '70']) assert.ok(new RegExp(`\\b${fact}\\b`).test(ai), `AI tools does not state ${fact}`);
  assert.doesNotMatch(text, /claude\.ai\/(?:code|chat|share)\b|session_[A-Za-z0-9]{8,}/);
});
contract('CF4', 'the disclosures name every trial repo from the registry batches and do not call memoryd public or private', () => {
  const registry = JSON.parse(read('eval/registry.json'));
  const repos = [...new Set(Object.values(registry.batches).flatMap(b => [b.repo].flat()))];
  const body = section(README(), /^Reused code/).text.toLowerCase();
  for (const repo of repos) assert.ok(body.includes(repo.toLowerCase()), `the disclosures do not name trial repo ${repo}`);
  const text = flat(README());
  assert.doesNotMatch(text, /memoryd(?: repo| source)? (?:is|was) (?:public|private)|(?:public|private) repos?,? [^.]*\bmemoryd\b/i);
});
contract('CF5', 'Linux or macOS stays only with a dated macOS run in docs/entry-check.md; otherwise macOS is called untested', () => {
  const text = flat(README());
  if (/Linux or macOS/.test(text)) assert.match(read('docs/entry-check.md'), /^.*macOS.*\d{4}-\d{2}-\d{2}.*$|^.*\d{4}-\d{2}-\d{2}.*macOS.*$/m, 'README claims macOS without a dated macOS run');
  else assert.match(text, /macOS is not tested/);
});
contract('CF6', 'What a trial measured ends with how a conflict run passes, on all replies joined, with the scorer objection words', () => {
  const { text } = section(README(), 'What a trial measured');
  const marker = text.indexOf('<!-- readme-check: score '); assert.ok(marker >= 0, 'no score block');
  const after = text.slice(text.indexOf('\n```\n', marker));
  const at = after.search(/How a conflict run passes/); assert.ok(at >= 0, 'no "How a conflict run passes" after the score block');
  const rule = flat(after.slice(at));
  assert.match(rule, /contradict/);
  assert.match(rule, /\bjoined\b|\ball (?:of )?(?:the )?(?:agent'?s? )?(?:text|replies|messages)\b/i, 'the pass rule does not say the scorer reads all replies joined');
  assert.doesNotMatch(rule, /(?<!not only (?:the )?|not just (?:the )?|not (?:the )?)(?:final reply|last message)/i, 'the pass rule says the scorer reads the final reply');
});
contract('CF7', 'README, AGENTS.md and docs/entry-check.md name no host path', () => {
  for (const file of ['README.md', 'AGENTS.md', 'docs/entry-check.md']) assert.doesNotMatch(read(file), /\/home\/dev\b|\/mnt\/ssd\b|\/Users\/[a-z]/, file);
});

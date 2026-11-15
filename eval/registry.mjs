/** module: [[whygraph-trial-design]] */
import { readFileSync } from 'node:fs';

const registry = JSON.parse(readFileSync(new URL('./registry.json', import.meta.url), 'utf8'));
if (!registry.repos || !registry.batches || Array.isArray(registry.repos) || Array.isArray(registry.batches)) throw new Error('registry: missing repos or batches');
const required = (entry, fields, label) => {
  for (const field of fields) if (typeof entry?.[field] !== 'string' || !entry[field].trim()) throw new Error(`${label}: missing ${field}`);
};
for (const [name, repo] of Object.entries(registry.repos)) {
  required(repo, ['name', 'source', 'decisions', 'blind', 'display'], `repo ${name}`);
  if (repo.name !== name) throw new Error(`repo ${name}: name mismatch`);
}
for (const [number, batch] of Object.entries(registry.batches)) {
  if (!['claude', 'opencode'].includes(batch.agent)) throw new Error(`batch ${number}: invalid agent`);
  if (!Array.isArray(batch.conditions) || !batch.conditions.length || new Set(batch.conditions).size !== batch.conditions.length || batch.conditions.some(c => !['none', 'stub', 'graph', 'graph-nosearch'].includes(c))) throw new Error(`batch ${number}: invalid conditions`);
  for (const field of ['conflicts', 'plain', 'governed']) if (!Number.isInteger(batch.counts?.[field]) || batch.counts[field] < 0) throw new Error(`batch ${number}: invalid ${field} count`);
  if (!batch.selection || !['existing', 'take', 'exclude'].includes(batch.selection.mode) || !batch.sha256) throw new Error(`batch ${number}: missing selection or sha256`);
  if (typeof batch.verifyInputs !== 'boolean' || !Array.isArray(batch.hashChecks) || new Set(batch.hashChecks).size !== batch.hashChecks.length) throw new Error(`batch ${number}: missing input validation policy or hash checks`);
  for (const [file, hash] of Object.entries(batch.sha256)) if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error(`batch ${number}: invalid ${file} SHA-256`);
  if (Array.isArray(batch.repo) && (!batch.repo.length || !Array.isArray(batch.prefix) || batch.prefix.length !== batch.repo.length || batch.prefix.some(prefix => typeof prefix !== 'string' || !prefix.trim()))) throw new Error(`batch ${number}: missing existing task prefixes`);
  if (!Array.isArray(batch.repo)) {
    if (!registry.repos[batch.repo]) throw new Error(`batch ${number}: unknown repo ${batch.repo}`);
    required(batch, ['prefix'], `batch ${number}`);
    if (!Number.isInteger(batch.counts.requests) || batch.counts.requests <= 0) throw new Error(`batch ${number}: invalid requests count`);
    for (const wording of ['same-words', 'partial', 'other-words']) if (!Number.isInteger(batch.selection.wording?.[wording]) || batch.selection.wording[wording] < 0) throw new Error(`batch ${number}: invalid ${wording} selection`);
  }
}

/** The fixed design of each batch and its ticket repo.
 * owns: [[whygraph-trial-design]]
 */
export const evalRegistry = registry;

/** The fixed conditions, agent and inputs of one batch.
 * owns: [[whygraph-trial-design]]
 */
export function evalBatch(number = 1) {
  const batch = registry.batches[number];
  if (!batch) throw new Error(`unknown batch ${number}`);
  return batch;
}

/** The registered ticket source, or undefined for a fixture repo.
 * owns: [[whygraph-trial-design]]
 */
export function ticketRepo(task) {
  const batch = evalBatch(task.batch);
  if (!Array.isArray(batch.repo) && task.repo !== batch.repo) throw new Error(`batch ${task.batch}: expected repo ${batch.repo}, got ${task.repo}`);
  if (Array.isArray(batch.repo) && !batch.repo.includes(task.repo)) throw new Error(`batch ${task.batch ?? 1}: unknown repo ${task.repo}`);
  return registry.repos[task.repo];
}

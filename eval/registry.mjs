/** module: [[whygraph-trial-design]] */
import { execFileSync } from 'node:child_process';
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
  if (!['direct','closed'].includes(batch.storeAccess) || !Array.isArray(batch.controlConditions) || !batch.controlConditions.length || batch.controlConditions.some(c=>!batch.conditions?.includes(c))) throw new Error(`batch ${number}: invalid store access or control conditions`);
  if (!['claude', 'opencode'].includes(batch.agent)) throw new Error(`batch ${number}: invalid agent`);
  if (!Array.isArray(batch.conditions) || !batch.conditions.length || new Set(batch.conditions).size !== batch.conditions.length || batch.conditions.some(c => !['none', 'stub', 'graph', 'graph-nosearch', 'graph-nolink', 'graph-noterms', 'graph-norule'].includes(c))) throw new Error(`batch ${number}: invalid conditions`);
  for (const field of ['conflicts', 'plain', 'governed']) if (!Number.isInteger(batch.counts?.[field]) || batch.counts[field] < 0) throw new Error(`batch ${number}: invalid ${field} count`);
  if (!batch.selection || !['existing', 'take', 'exclude', 'strata'].includes(batch.selection.mode) || !batch.sha256) throw new Error(`batch ${number}: missing selection or sha256`);
  if (typeof batch.verifyInputs !== 'boolean' || !Array.isArray(batch.hashChecks) || new Set(batch.hashChecks).size !== batch.hashChecks.length) throw new Error(`batch ${number}: missing input validation policy or hash checks`);
  for (const [file, hash] of Object.entries(batch.sha256)) if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error(`batch ${number}: invalid ${file} SHA-256`);
  if (Array.isArray(batch.repo) && (!batch.repo.length || !Array.isArray(batch.prefix) || batch.prefix.length !== batch.repo.length || batch.prefix.some(prefix => typeof prefix !== 'string' || !prefix.trim()))) throw new Error(`batch ${number}: missing existing task prefixes`);
  if (!Array.isArray(batch.repo)) {
    if (!registry.repos[batch.repo]) throw new Error(`batch ${number}: unknown repo ${batch.repo}`);
    required(batch, ['prefix'], `batch ${number}`);
    if (!Number.isInteger(batch.counts.requests) || batch.counts.requests <= 0) throw new Error(`batch ${number}: invalid requests count`);
    if (batch.selection.mode === 'strata') {
      for (const stratum of ['cited', 'uncited']) if (!Number.isInteger(batch.selection.strata?.[stratum]) || batch.selection.strata[stratum] < 1) throw new Error(`batch ${number}: invalid ${stratum} selection`);
    } else for (const wording of ['same-words', 'partial', 'other-words']) if (!Number.isInteger(batch.selection.wording?.[wording]) || batch.selection.wording[wording] < 0) throw new Error(`batch ${number}: invalid ${wording} selection`);
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

/** Read the complete instruction bundle from the batch's recorded history.
 * owns: [[whygraph-trial-design]]
 */
export function batchInstructions(number, cwd = new URL('..', import.meta.url)) {
  const commit = evalBatch(number).instructionsCommit;
  if (typeof commit !== 'string' || !/^[a-f0-9]{7,40}$/.test(commit)) throw new Error(`batch ${number}: record instructionsCommit before preparation`);
  const read = path => {
    try { return execFileSync('git', ['show', `${commit}:${path}`], { cwd, maxBuffer: 1 << 20 }); }
    catch { throw new Error(`batch ${number}: instructions missing at ${commit}:${path}`); }
  };
  return { skill: read('skills/whygraph/SKILL.md'), rule: read('skills/whygraph-rule.md') };
}

/** Build the full plan or the four-task smoke subset from registered tasks.
 * owns: [[whygraph-trial-design]]
 */
export function batchPlan(tasks, { batch, stage = 'full', only, conditions, repeats } = {}) {
  if (!['full','smoke'].includes(stage)) throw new Error(`unknown stage ${stage}`);
  if (stage==='smoke' && (!batch || evalBatch(batch).storeAccess!=='closed' || only || conditions || repeats!==undefined)) throw new Error('smoke requires --batch >=7 without --only, --conditions or --repeats');
  let selected=[...tasks.values()].filter(t=>(batch===undefined||t.batch===batch)&&(!only||only.includes(t.id)));
  if(batch!==undefined) {
    const design=evalBatch(batch);
    if(!selected.length) throw new Error(`batch ${batch}: no tasks; waiting for blind inputs and task generation`);
    if(design.storeAccess==='closed' && !only && (selected.filter(t=>t.kind==='conflict').length!==design.counts.conflicts || selected.filter(t=>t.kind==='control'&&!t.ground_truth.source.ticket).length!==design.counts.plain || selected.filter(t=>t.kind==='control'&&t.ground_truth.source.ticket).length!==design.counts.governed)) throw new Error(`batch ${batch}: incomplete task set`);
  }
  selected.sort((a,b)=>a.id.localeCompare(b.id,'en'));
  if(stage==='smoke') {
    selected=[...['cited','uncited'].map(s=>selected.find(t=>t.kind==='conflict'&&(t.stratum??t.ground_truth.source.stratum)===s)),selected.find(t=>t.kind==='control'&&!t.ground_truth.source.ticket),selected.find(t=>t.kind==='control'&&t.ground_truth.source.ticket)];
    if(selected.some(t=>!t)) throw new Error('smoke: need cited and uncited conflicts, plain and governed controls');
  }
  const plan=[];
  for(const task of selected) {
    ticketRepo(task);const design=evalBatch(task.batch);
    const allowed=task.kind==='control'?design.controlConditions:design.conditions;
    const modes=conditions??allowed;
    for(const condition of modes) if(!allowed.includes(condition)) throw new Error(`batch ${task.batch??1}: condition ${condition} is not run for ${task.kind}`);
    for(let repeat=1;repeat<=(stage==='smoke'?1:repeats??design.repeats??5);repeat++) for(const condition of modes) plan.push({task,condition,repeat,id:`${task.id}__${condition}__r${repeat}`});
  }
  return plan;
}

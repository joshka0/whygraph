/** module: [[whygraph-eval-plan]] */
import { evalBatch, ticketRepo } from './registry.mjs';

/** Build the full plan or the four-task smoke subset from registered tasks.
 * owns: [[whygraph-eval-plan]]
 */
export function batchPlan(tasks, { batch, stage = 'full', only, conditions, repeats } = {}) {
  if (!['full','smoke'].includes(stage)) throw new Error(`unknown stage ${stage}`);
  if (stage==='smoke' && (!batch || batch<7 || only || conditions || repeats!==undefined)) throw new Error('smoke requires --batch >=7 without --only, --conditions or --repeats');
  let selected=[...tasks.values()].filter(t=>(batch===undefined||t.batch===batch)&&(!only||only.includes(t.id)));
  if(batch!==undefined) {
    const design=evalBatch(batch);
    if(!selected.length) throw new Error(`batch ${batch}: no tasks; waiting for blind inputs and task generation`);
    if(batch>=7 && !only && (selected.filter(t=>t.kind==='conflict').length!==design.counts.conflicts || selected.filter(t=>t.kind==='control'&&!t.ground_truth.source.ticket).length!==design.counts.plain || selected.filter(t=>t.kind==='control'&&t.ground_truth.source.ticket).length!==design.counts.governed)) throw new Error(`batch ${batch}: incomplete task set`);
  }
  selected.sort((a,b)=>a.id.localeCompare(b.id,'en'));
  if(stage==='smoke') {
    selected=[...['cited','uncited'].map(s=>selected.find(t=>t.kind==='conflict'&&(t.stratum??t.ground_truth.source.stratum)===s)),selected.find(t=>t.kind==='control'&&!t.ground_truth.source.ticket),selected.find(t=>t.kind==='control'&&t.ground_truth.source.ticket)];
    if(selected.some(t=>!t)) throw new Error('smoke: need cited and uncited conflicts, plain and governed controls');
  }
  const plan=[];
  for(const task of selected) {
    ticketRepo(task);const design=evalBatch(task.batch);
    const allowed=(task.batch>=7&&task.kind==='control')?['stub','graph']:design.conditions;
    const modes=conditions??allowed;
    for(const condition of modes) if(!allowed.includes(condition)) throw new Error(`batch ${task.batch??1}: condition ${condition} is not run for ${task.kind}`);
    for(let repeat=1;repeat<=(stage==='smoke'?1:repeats??design.repeats??5);repeat++) for(const condition of modes) plan.push({task,condition,repeat,id:`${task.id}__${condition}__r${repeat}`});
  }
  return plan;
}

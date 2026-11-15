/** module: [[whygraph-trial-design]] */
import assert from 'node:assert/strict';
import {existsSync, readdirSync, cpSync, mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {attemptDecision} from '../../scripts/attempts.pure.ts';
import {settleCell} from '../run.mjs';
import {b7 as h} from './batch7-support.mjs';
const ends={
 timeout:{status:'error',timed_out:true},
 breach:{status:'invalid',reason:'isolation breach'},
 harness:{status:'invalid',reason:'harness failure: invented service loss',timed_out:true},
 success:{status:'done',timed_out:false},
};
const entry=end=>({kind:{timeout:'agent',breach:'agent',harness:'harness',success:'done'}[end],meta:ends[end]});
// Batch 5 records two invalid ends, then a separate timeout ladder. The
// cross-kind third launch is explicit only in Batch 7's preservation note.
const old={
 'timeout,timeout':['unscored',2], 'timeout,breach':['stop',2], 'timeout,harness':['stop',2], 'timeout,success':['settled',2],
 'breach,timeout':['settled',3], 'breach,breach':['unscored',2], 'breach,harness':['stop',2], 'breach,success':['settled',2],
 'harness,timeout':['settled',3], 'harness,breach':['stop',2], 'harness,harness':['stop',2], 'harness,success':['settled',2],
 'success,timeout':['settled',1], 'success,breach':['settled',1], 'success,harness':['settled',1], 'success,success':['settled',1],
};
/** Independent invented-attempt replays of the recorded retry contract.
 * owns: [[whygraph-batch7-retry-selftest]]
 */
export async function batch7RetryChecks({scratch,tasks,scoreRun}) {
 const checks=[],add=(name,run)=>checks.push({name:`B7 ${name}`,group:'retries',run});let serial=0;
 let task,taskAt;
 function fixture(){if(!task){taskAt=h.inputs(h.copy(scratch,'retry-inputs'));task=h.generated(taskAt).find(t=>t.kind==='conflict');}return task;}
 async function replay(sequence,{batch=7,api=settleCell,expected,results,seed}={}) {
  fixture();results??=join(scratch,`retry-${serial++}`);const t={...task,batch},p={id:`${t.id}__graph__r1`,task:t,condition:'graph',repeat:1};
  const ledger=join(results,'_ledger',p.id+'.json');if(seed)h.write(ledger,seed);
  let launches=0;
  const runner=async()=>{
   const which=sequence[launches]??'success';launches++;
   assert.ok(launches<=4,'replay must terminate before a fifth launch');
   if(batch===7){const l=h.json(ledger);assert.equal(l.at(-1).kind,'running','reserve before launch');for(const e of l.slice(0,-1))if(e.archived)assert.ok(existsSync(join(e.archived,'meta.json')),'archive before retry');}
   const meta={id:p.id,task:t.id,condition:'graph',repeat:1,...ends[which],exit:which==='success'?0:1,tokens:{total:launches},wall_ms:10};
   h.write(join(results,p.id,'meta.json'),meta);h.write(join(results,p.id,'attempt.txt'),String(launches));h.write(join(results,p.id,'final.txt'),'#'+t.ground_truth.source.record);h.write(join(results,p.id,'diff.patch'),'');h.write(join(results,p.id,'tools.json'),[]);
   // The old runOne owns invalid archival; the closed loop owns all failures.
   if(batch!==7&&meta.status==='invalid'){const dest=join(results,'_invalid',String(launches));cpSync(join(results,p.id),dest,{recursive:true});meta.archived=dest;}
   return meta;
  };
  let value,error;try{value=await api(p,[],{runAttempt:runner,results});}catch(e){error=e;}
  if(expected){assert.equal(launches,expected[1],`${sequence.join(' / ')} launch count`);if(expected[0]==='stop')assert.match(error?.message??'',/harness failure/,'pair containing harness stops');else{assert.ifError(error);assert.equal(Boolean(value.unscored),expected[0]==='unscored','unscored outcome');assert.equal(value.status,expected[0]==='settled'?'done':'error');}}
  return {results,p,ledger,launches,value,error,runner};
 }
 for(const a of Object.keys(ends))for(const b of Object.keys(ends)){
  const expected=a==='success'?['settled',1]:b==='success'?['settled',2]:a==='harness'||b==='harness'?['stop',2]:['unscored',2];
  add(`B7-48 B7-49 B7-50 B7-51 B7-52 B7-53 closed ${a} then ${b}`,async()=>{
   assert.deepEqual(attemptDecision('closed',[]),{kind:'launch'});
   assert.deepEqual(attemptDecision('closed',[entry(a)]),{kind:a==='success'?'settled':'launch'});
   if(a!=='success')assert.deepEqual(attemptDecision('closed',[entry(a),entry(b)]),expected[0]==='stop'?{kind:'stop',reason:'harness'}:{kind:expected[0]});
   const r=await replay([a,b],{expected});const ledger=h.json(r.ledger);assert.equal(ledger.length,expected[1]);
   for(const e of ledger)if(e.kind!=='done'){assert.ok(e.archived,'every failed attempt archived');assert.deepEqual(h.json(join(e.archived,'meta.json')),e.meta);}
   if(expected[0]==='unscored')assert.equal(h.json(join(r.results,r.p.id,'meta.json')).unscored,true);
   const score=h.node(join(taskAt,'eval/score.mjs'),['--results',r.results]);h.ok(score);const rows=JSON.parse(h.ok(h.node(join(taskAt,'eval/score.mjs'),['--results',r.results,'--json'])));
   if(expected[0]==='settled'){assert.equal(rows.length,1,'only successful retry scored');assert.equal(rows[0].tokens.total,expected[1]);assert.equal(rows[0].pass,true);}else{assert.deepEqual(rows,[],'failed archives excluded from normal scoring');if(expected[0]==='stop')assert.doesNotMatch(score.stdout,/=== Batch 7/,'invalid root excluded from every batch block');else{assert.match(score.stdout,/Batch 7 total tokens: 0/);const sensitivity=join(r.results,'_sensitivity');cpSync(join(r.results,r.p.id),join(sensitivity,r.p.id),{recursive:true});const stub=r.p.id.replace('__graph__','__stub__');h.write(join(sensitivity,stub,'meta.json'),{...r.value,id:stub,condition:'stub',status:'done',unscored:false});h.write(join(sensitivity,stub,'final.txt'),'#'+task.ground_truth.source.record);h.write(join(sensitivity,stub,'tools.json'),[]);const report=h.node(join(taskAt,'eval/score.mjs'),['--results',sensitivity]);h.ok(report);assert.match(report.stdout,/Sensitivity, unscored conflicts counted as FAIL: graph - stub: -1.00 \[-1.00, -1.00\] over 1 tasks/,'unscored conflict enters paired FAIL sensitivity');h.write(join(sensitivity,'receipt.txt'),report.stdout);}}
   h.write(join(r.results,'score-receipt.txt'),score.stdout);
   if(expected[0]==='stop')assert.equal(h.json(join(r.results,r.p.id,'meta.json')).status,'invalid');
   const before=h.tree(r.results);let restartedError;try{await settleCell(r.p,[],{results:r.results,runAttempt:async()=>{assert.fail('restart must launch no third attempt');}});}catch(e){restartedError=e;}
   if(expected[0]==='stop')assert.match(restartedError?.message??'',/harness failure/);else assert.ifError(restartedError);
   assert.deepEqual(h.tree(r.results),before,'restart preserves archives and root marker');
   if(expected[0]==='unscored'){cpSync(join(r.results,r.p.id),join(taskAt,'eval/results',r.p.id),{recursive:true});const plan=h.node(join(taskAt,'eval/run.mjs'),['--plan','--batch','7','--only',task.id,'--conditions','graph','--repeats','1']);h.ok(plan);assert.match(plan.stdout,/1 runs planned, 1 already done, 0 to start/,'resume plan skips unscored cell');}
  });
  for(const batch of [5,6])add(`B7-55 batch ${batch} recorded ${a} then ${b}: ${old[[a,b]][0]} in ${old[[a,b]][1]} launches`,async()=>{
   const expected=old[[a,b]],sequence=[a,b,'success'];await replay(sequence,{batch,expected});
   const observed=sequence.slice(0,expected[1]);assert.deepEqual(attemptDecision('opencode',observed.map(entry)),expected[0]==='stop'?{kind:'stop',reason:'harness'}:{kind:expected[0]});
  });
 }
 add('B7-54 interrupted reservation survives restart and requires inspection',async()=>{
  const r=await replay([],{seed:[{kind:'running'}]});assert.equal(r.launches,0);assert.match(r.error?.message??'',/interrupted attempt.*inspect/);assert.deepEqual(h.json(r.ledger),[{kind:'running'}]);
  assert.deepEqual(attemptDecision('closed',[{kind:'running'}]),{kind:'stop',reason:'interrupted'});
 });
 add('B7-54 rejected attempt retains its reservation across restart',async()=>{
  fixture();const results=join(scratch,`interrupted-${serial++}`),p={id:'interrupted__graph__r1',task,condition:'graph',repeat:1};
  await assert.rejects(settleCell(p,[],{results,runAttempt:async()=>{throw Error('invented interruption');}}),/invented interruption/);
  await assert.rejects(settleCell(p,[],{results,runAttempt:async()=>assert.fail('must not relaunch')}),/interrupted attempt/);
  assert.deepEqual(h.json(join(results,'_ledger',p.id+'.json')),[{kind:'running'}]);
 });
 for(const pair of [['timeout','breach'],['breach','timeout'],['harness','harness']])add(`B7-54 exhausted ledger without root ${pair.join(' then ')} launches nothing`,async()=>{const r=await replay([],{seed:pair.map(entry)});assert.equal(r.launches,0);if(pair.includes('harness'))assert.match(r.error?.message??'',/harness failure/);else{assert.ifError(r.error);assert.equal(r.value.unscored,true);}});
 add('B7-54 over-budget ledger refuses without another launch',async()=>{const r=await replay([],{seed:[entry('timeout'),entry('breach'),entry('timeout')]});assert.equal(r.launches,0);assert.match(r.error?.message??'',/attempt budget exhausted/);assert.deepEqual(attemptDecision('closed',[entry('timeout'),entry('breach'),entry('timeout')]),{kind:'stop',reason:'exhausted'});});
 const plants=[
  ['third-launch',s=>s.replace("if(action.kind==='unscored'||action.kind==='stop') {","if(attempts.length===2&&attempts.every(a=>a.kind==='agent')){attempts.pop();save();continue;}\n    if(action.kind==='unscored'||action.kind==='stop') {"),async api=>replay(['timeout','breach'],{api,expected:['unscored',2]})],
  ['restart-second-launch',s=>s.replace("const attempts=rule==='closed'&&existsSync(ledgerFile)?JSON.parse(readFileSync(ledgerFile,'utf8')):[];","const attempts=[];"),async api=>{const r=await replay([],{api,seed:[entry('timeout'),entry('breach')]});assert.equal(r.launches,0,'exhausted restart launches no attempt');}],
  ['old-batches-new-rule',s=>s.replace("rule??=evalBatch(p.task.batch).storeAccess==='closed'?'closed':evalBatch(p.task.batch).agent==='opencode'?'opencode':'single';","rule??='closed';"),async api=>replay(['breach','timeout','success'],{api,batch:5,expected:['settled',3]})],
 ];
 for(const [name,mutate,owner]of plants)add(`plant ${name} caught by attempt replay`,async()=>{
  const at=h.copy(scratch,name),file=join(at,'eval/run.mjs'),source=h.read(file),changed=mutate(source);assert.notEqual(changed,source,'plant applied');h.write(file,changed);
  const api=(await import(pathToFileURL(file).href)).settleCell;let receipt;
  try{await owner(api);}catch(e){assert.equal(e.code,'ERR_ASSERTION');receipt={name,owner:'B7-48 through B7-55 replay',assertion:e.message};}
  assert.ok(receipt,'planted fault must fail assertion');h.write(join(scratch,`plant2-${name}.json`),receipt);
 });
 return checks;
}

/** module: [[whygraph-trial-design]] */
import assert from 'node:assert/strict';
import {cpSync,existsSync,mkdirSync,readdirSync,symlinkSync,realpathSync} from 'node:fs';
import {dirname,join,relative} from 'node:path';
import {b7 as h} from './batch7-support.mjs';
/** Runner lifecycle with no actual agent process.
 * owns: [[whygraph-batch7-attempt-selftest]]
 */
export async function batch7AttemptChecks({scratch,shared}){
 const checks=[],add=(name,run)=>checks.push({name:`B7 ${name}`,run});let serial=0;
 async function attempt({condition='graph',mode='success',at,task,entry='closedAttempt',preparationFailure=false}={}){const f=await shared.getClosed();at??=h.inputs(h.copy(scratch,`attempt-${serial++}`),undefined,r=>r.batches[7].instructionsCommit='c92205d');task??={...h.generated(at)[0],id:'x',ground_truth:{source:{record:'1001',stratum:'cited'},targets:[{file:'src/cart.ts',symbol:'total',start_line:1,end_line:99}]}};const out=join(at,'eval/results',`${task.id}__${condition}__r1`);mkdirSync(out,{recursive:true});const work=h.mkdtempSync(join(h.root,'test-results/w')),workRoot=relative(h.root,work);
 if(entry==='runOne'){const template=join(work,'_zustand');cpSync(f.source,join(template,'repo'),{recursive:true});symlinkSync(f.store,join(template,'store'),'dir');if(!preparationFailure)h.write(join(template,'ready'),'ready\n');}
 const config={module:join(at,'eval',entry==='runOne'?'run.mjs':'closed-run.mjs'),entry,workRoot,options:{task,condition,repeat:1,workRoot,out,prompt:'Invented request; spawn is simulated.',source:f.source,store:f.store}},path=h.write(join(at,`attempt-${serial++}.json`),config);let result;
 {const r=h.node(join(h.root,'eval/selftest/batch7-attempt-worker.mjs'),[path,mode]);h.ok(r);result=JSON.parse(r.stdout.trim().split('\n').at(-1));h.write(join(at,`probe-${serial++}.json`),result);}return{...result,at,out,task,work,condition};}
 shared.attempt=attempt;
 add('B7-79 fixture work root never reuses a retained alias owned by another attempt',async()=>{
  const at=h.inputs(h.copy(scratch,'foreign-attempt-alias'),undefined,r=>r.batches[7].instructionsCommit='c92205d');
  const foreign=join(at,'foreign-work');mkdirSync(foreign);h.write(join(foreign,'owner.txt'),'other attempt\n');
  const alias=join(h.root,'test-results/w'+h.hash(at).slice(0,6));symlinkSync(foreign,alias,'dir');
  const before=h.tree(foreign),r=await attempt({at});assert.equal(r.error,undefined,r.error);assert.equal(r.value.status,'done',r.value.reason);
  assert.notEqual(realpathSync(dirname(r.value.work)),realpathSync(foreign),'a retained alias cannot choose another attempt owner');
  assert.deepEqual(h.tree(foreign),before,'another attempt work directory stays unchanged');
 });
 add('B7-85 B7-92 every cell health uses receipt fingerprints without storeFingerprint',async()=>{
  const at=h.inputs(h.copy(scratch,'health-receipts'),undefined,r=>r.batches[7].instructionsCommit='c92205d'),directory=join(at,'shared-ablations');
  h.wrapped(at,'closed-store.mjs','storeFingerprint',"throw Error('cell health must use its preparation receipt');");
  h.wrapped(at,'closed-store.mjs','ablatedStores',`return original_ablatedStores(args[0],${JSON.stringify(directory)});`);
  let first;for(const condition of ['graph','graph-norule','stub','graph-nolink','graph-noterms','graph-nosearch']){
   const result=await attempt({at,condition});assert.equal(result.error,undefined,result.error);assert.equal(result.value.status,'done',result.value.reason);
   const receipt=h.json(join(directory,'prepared.json')),health=h.json(join(result.out,'health.json'));
   assert.deepEqual(health.full,receipt.fingerprints.graph,'cell health retains full receipt fingerprint');
   assert.deepEqual(health.current,receipt.fingerprints[condition]??receipt.fingerprints.graph,'cell health retains selected receipt fingerprint');
   const text=h.read(join(directory,'prepared.json'));first??=text;assert.equal(text,first,'each cell reuses the same receipt');
  }
 });
 for(const [mode,status]of [['success','done'],['timeout','error'],['breach','invalid'],['malformed','invalid'],['spawn-error','invalid']])add(`B7-15 B7-16 closed ${mode} keeps evidence and closes listener`,async()=>{const r=await attempt({mode});assert.equal(r.error,undefined,r.error);assert.equal(r.value.status,status);assert.ok(existsSync(join(r.out,'meta.json')));assert.ok(existsSync(join(r.out,'output.jsonl')));assert.ok(existsSync(join(r.out,'stderr.txt')));const sockets=[];function walk(p){for(const d of readdirSync(p,{withFileTypes:true}))if(d.isDirectory())walk(join(p,d.name));else if(d.name==='service.sock')sockets.push(join(p,d.name));}walk(r.work);assert.deepEqual(sockets,[],'finally closes/removes service socket');if(mode==='success'){assert.equal(r.value.tokens.total,5);assert.equal(r.value.cost_usd,.01);assert.equal(r.value.service.failures,0);assert.equal(h.read(join(r.out,'stderr.txt')),'invented stderr\n');}if(mode==='timeout'){assert.equal(r.value.timed_out,true);assert.deepEqual(r.signals,['SIGTERM','SIGKILL']);assert.ok(r.timers.includes(1200000));}});
 add('B7-15 exported runOne uses closed runtime without spawning an agent',async()=>{const r=await attempt({entry:'runOne'});assert.equal(r.error,undefined,r.error);assert.equal(r.value.status,'done');h.write(join(scratch,'runOne-evidence.json'),{files:h.tree(join(r.at,'eval/results')),value:r.value});});
 add('B7-15 failed preparation is a harness failure with evidence and no agent',async()=>{const r=await attempt({entry:'runOne',preparationFailure:true});assert.equal(r.error,undefined,r.error);assert.equal(r.value.status,'invalid');assert.match(r.value.reason,/harness failure.*ready/i);assert.ok(existsSync(join(r.out,'meta.json')));assert.ok(!r.calls.some(c=>c.args?.includes('--format')));});
 for(const mode of ['health-failure','service-down','timeout-service-down'])add(`B7-14 B7-15 B7-53 ${mode} is a harness failure and closes service`,async()=>{const at=h.inputs(h.copy(scratch,'fault-'+mode),undefined,r=>r.batches[7].instructionsCommit='c92205d');h.wrapped(at,'closed-store.mjs','startClosedStore',`const v=await original_startClosedStore(...args);globalThis.closedServiceForTest=v;${mode==='health-failure'?'await v.stop();':''}return v;`);const r=await attempt({at,entry:'runOne',mode:mode==='health-failure'?'success':mode});assert.equal(r.error,undefined,r.error);assert.equal(r.value.status,'invalid',JSON.stringify(r.value));assert.match(r.value.reason,/harness failure/i);assert.ok(existsSync(join(r.out,'meta.json')));if(mode==='health-failure')assert.ok(!r.calls.some(c=>c.args?.includes('--format')));else{const client=r.calls.find(c=>c.clientResult)?.clientResult;assert.deepEqual(client,{status:70,stdout:'',stderr:'whygraph service unavailable\n'});if(mode==='timeout-service-down')assert.deepEqual(r.signals,['SIGTERM','SIGKILL']);}const sockets=[];function walk(p){for(const e of readdirSync(p,{withFileTypes:true}))if(e.isDirectory())walk(join(p,e.name));else if(e.name==='service.sock')sockets.push(join(p,e.name));}walk(r.work);assert.deepEqual(sockets,[]);});

 return checks;
}

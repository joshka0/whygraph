/** module: [[whygraph-trial-design]] */
import assert from 'node:assert/strict';
import {cpSync,existsSync,mkdirSync,readdirSync,symlinkSync} from 'node:fs';
import {join} from 'node:path';
import {b7 as h} from './batch7-support.mjs';
/** Runner lifecycle with no actual agent process.
 * owns: [[whygraph-batch7-attempt-selftest]]
 */
export async function batch7AttemptChecks({scratch,shared}){
 const checks=[],add=(name,run)=>checks.push({name:`B7 ${name}`,run});let serial=0;
 async function attempt({condition='graph',mode='success',at,task,entry='closedAttempt'}={}){const f=await shared.getClosed();at??=h.inputs(h.copy(scratch,`attempt-${serial++}`),undefined,r=>r.batches[7].instructionsCommit='c92205d');task??={...h.generated(at)[0],id:'x',ground_truth:{source:{record:'1001',stratum:'cited'},targets:[{file:'src/cart.ts',symbol:'total',start_line:1,end_line:99}]}};const out=join(at,'eval/results',`${task.id}__${condition}__r1`);mkdirSync(out,{recursive:true});const work=join(at,'work');mkdirSync(work,{recursive:true});const workRoot='test-results/w'+h.hash(at).slice(0,6);symlinkSync(work,join(h.root,workRoot),'dir');
 if(entry==='runOne'){const template=join(work,'_zustand');cpSync(f.source,join(template,'repo'),{recursive:true});symlinkSync(f.store,join(template,'store'),'dir');h.write(join(template,'ready'),'ready\n');}
 const config={module:join(at,'eval',entry==='runOne'?'run.mjs':'closed-run.mjs'),entry,workRoot,options:{task,condition,repeat:1,workRoot,out,prompt:'Invented request; spawn is simulated.',source:f.source,store:f.store}},path=h.write(join(at,`attempt-${serial++}.json`),config);let result;
 {const r=h.node(join(h.root,'eval/selftest/batch7-attempt-worker.mjs'),[path,mode]);h.ok(r);result=JSON.parse(r.stdout.trim().split('\n').at(-1));h.write(join(at,`probe-${serial++}.json`),result);}return{...result,at,out,task,work,condition};}
 shared.attempt=attempt;
 for(const [mode,status]of [['success','done'],['timeout','error'],['breach','invalid'],['malformed','invalid'],['spawn-error','invalid']])add(`B7-15 B7-16 closed ${mode} keeps evidence and closes listener`,async()=>{const r=await attempt({mode});assert.equal(r.error,undefined,r.error);assert.equal(r.value.status,status);assert.ok(existsSync(join(r.out,'meta.json')));assert.ok(existsSync(join(r.out,'output.jsonl')));assert.ok(existsSync(join(r.out,'stderr.txt')));const sockets=[];function walk(p){for(const d of readdirSync(p,{withFileTypes:true}))if(d.isDirectory())walk(join(p,d.name));else if(d.name==='service.sock')sockets.push(join(p,d.name));}walk(r.work);assert.deepEqual(sockets,[],'finally closes/removes service socket');if(mode==='success'){assert.equal(r.value.tokens.total,5);assert.equal(r.value.cost_usd,.01);assert.equal(r.value.service.failures,0);assert.equal(h.read(join(r.out,'stderr.txt')),'invented stderr\n');}if(mode==='timeout'){assert.equal(r.value.timed_out,true);assert.deepEqual(r.signals,['SIGTERM','SIGKILL']);assert.ok(r.timers.includes(1200000));}});
 add('B7-15 exported runOne uses closed runtime without spawning an agent',async()=>{const r=await attempt({entry:'runOne'});assert.equal(r.error,undefined,r.error);assert.equal(r.value.status,'done');h.write(join(scratch,'runOne-evidence.json'),{files:h.tree(join(r.at,'eval/results')),value:r.value});});
 return checks;
}

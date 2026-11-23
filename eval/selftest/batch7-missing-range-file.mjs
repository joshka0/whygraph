/** module: [[whygraph-trial-design]]
 * Failure list B7-214..219; ADR 0002, Missing range file (2026-11-18).
 */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {accessSync,chmodSync,closeSync,constants,cpSync,existsSync,mkdirSync,renameSync,unlinkSync} from 'node:fs';
import {join,resolve,relative} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {b7 as h} from './batch7-support.mjs';
import {trialResults} from './trial-results.mjs';
import {batch7ClosedChecks} from './batch7-closed.mjs';
import {batch7AttemptChecks} from './batch7-attempts.mjs';
import {batch7SmokeChecks} from './batch7-smoke.mjs';
const rows=p=>existsSync(p)?h.read(p).trim().split('\n').filter(Boolean).map(JSON.parse):[];
const triple=r=>({status:r.status,stdout:r.stdout,stderr:r.stderr});
const collect=p=>new Promise((ok,fail)=>{let stdout='',stderr='';p.stdout.on('data',b=>stdout+=b);p.stderr.on('data',b=>stderr+=b);p.on('error',fail);p.on('close',(status,signal)=>ok({status,signal,stdout,stderr}));});
const replace=(p,from,to)=>{const s=h.read(p);assert.equal(s.split(from).length,2,'one mutation anchor: '+from);h.write(p,s.replace(from,to));};
const unavailable=r=>assert.deepEqual(triple(r),{status:70,stdout:'',stderr:'whygraph service unavailable\n'});
function targetError(r,path,repo){assert.equal(r.status,3,JSON.stringify(r));assert.equal(r.stdout,'');assert.ok(r.stderr.startsWith(`whygraph: No file ${path} in the working tree.`),r.stderr);assert.doesNotMatch(r.stderr,/ENOENT|ENOTDIR|EISDIR|open '|service unavailable/);assert.ok(!r.stderr.includes(repo),r.stderr);assert.doesNotMatch(r.stderr,/(?:^|[\s'"])\//);}
/** Real product and native client regressions, runner verdicts, and retained fault plants.
 * owns: [[whygraph-batch7-missing-range-file-selftest]]
 */
export async function batch7MissingRangeFileChecks({scratch,shared={}}){
 scratch=h.mkdtempSync(join(scratch,'missing-'));const checks=[];let serial=0;
 console.log('Missing-range scratch retained: '+scratch);
 const add=(name,run)=>checks.push({name:'B7 '+name,group:'missing-range-file',run});
 function copy(label,{revision,plant}={}){
  const at=h.copy(scratch,label+'-'+serial++);
  unlinkSync(join(at,'src'));cpSync(join(h.root,'src'),join(at,'src'),{recursive:true});
  unlinkSync(join(at,'bin'));mkdirSync(join(at,'bin'));h.write(join(at,'bin/whygraph'),`#!/bin/sh\nexec '${process.execPath}' '${join(at,'src/main.ts')}' "$@"\n`);chmodSync(join(at,'bin/whygraph'),0o755);
  if(revision){const paths=h.ok(h.command('git',['ls-tree','-r','--name-only',revision,'src'])).trim().split('\n');for(const p of paths)h.write(join(at,p),h.ok(h.command('git',['show',revision+':'+p])));}
  if(plant)plant(at);return at;
 }
 function workRoot(){for(let i=0;i<1296;i++){const p=join(h.root,'test-results/scratch',i.toString(36));if(!existsSync(p)){mkdirSync(p);return p;}}assert.fail('no short scratch work root available');}
 async function rig(condition,fn,options={}){
  const f=await shared.getClosed(),at=copy('service',options),api=await import(pathToFileURL(join(at,'eval/closed-store.mjs')).href),work=workRoot();
  for(const d of ['repo','home','config','cache','state','out'])mkdirSync(join(work,d));
  const {client,token}=api.runClient(f.sharedClient,work),repo=f.repo,socket=relative(h.root,join(work,'s')),log=join(at,'service.jsonl');
  let store=f.stores[condition]??f.store;if(options.fault==='store'){const p=join(at,'store');cpSync(store,p,{recursive:true,dereference:true});store=p;}
  if(options.fault==='exit1'){h.write(join(at,'bin/whygraph'),'#!/bin/sh\necho "product failed" >&2\nexit 1\n');chmodSync(join(at,'bin/whygraph'),0o755);}
  const service=await api.startClosedStore({condition,repo,store,fullStore:condition==='graph-nolink'?f.store:store,socket,log,token});
  if(options.fault==='store')renameSync(store,store+'.removed');
  const invoke=args=>{const c=api.closedConfinement({work,repo,client,socket}),fd=api.seccompFilter(work);try{return collect(spawn(c[0],[...c.slice(1),'--seccomp','3','--','/tools/whygraph',...args],{cwd:h.root,env:{...h.env,PATH:'/tools:/usr/bin:/bin'},stdio:['ignore','pipe','pipe',fd]}));}finally{closeSync(fd);}};
  try{return await fn({f,at,api,repo,store,log,service,invoke});}finally{await service.stop();}
 }
 async function own214(condition='graph',options={},paths=['src/missing.ts','src','src/tax.ts/x.ts','src/tax.ts:src/tax.ts','/repo/src/missing.ts']){
  return rig(condition,async s=>{const replies=[];for(const path of paths){const before=rows(s.log).length,r=await s.invoke(['carry',path+':1-50']);replies.push(r);try{if(condition==='stub')assert.deepEqual(triple(r),{status:0,stdout:'no result\n',stderr:''});else targetError(r,path.replace(/^\/repo\//,''),s.repo);}catch(e){e.evidence={reply:triple(r),rows:rows(s.log).slice(before)};throw e;}const log=rows(s.log).slice(before);assert.equal(log.length,1,JSON.stringify(log));assert.equal(log[0].event,undefined);assert.equal(log[0].code,condition==='stub'?0:3);assert.equal(log[0].stderr,r.stderr);assert.equal(log[0].stdout,r.stdout);assert.equal(s.service.stats().failures,0);assert.equal(s.service.stats().calls,replies.length);}h.write(join(s.at,'observed.json'),replies);return replies;},options);
 }
 async function attempt(options={}){
  const f=await shared.getClosed(),at=copy('runner',options),work=workRoot(),condition=options.condition??'graph';
  const task=options.task??{id:'range',batch:7,repo:'zustand',kind:'conflict',request:'Keep amount policy',ground_truth:{source:{record:'1001',stratum:'cited'},targets:[{file:'src/cart.ts',symbol:'total'}]}};
  const out=join(at,'eval/results',`${task.id}__${condition}__r1`);mkdirSync(out,{recursive:true});
  let store=f.store;if(options.fault==='store'){store=join(at,'store');cpSync(f.store,store,{recursive:true,dereference:true});}
  const config={module:join(at,'eval/closed-run.mjs'),entry:'closedAttempt',options:{task,condition,repeat:1,workRoot:work,out,prompt:'Invented task; fake agent calls carry then finishes.',source:f.source,store},probe:{args:['carry',options.fault?'src/cart.ts:1-1':'src/tax.ts:src/tax.ts:1-50'],fault:options.fault,executable:join(at,'bin/whygraph')}};
  const p=h.write(join(at,'worker.json'),config),r=h.node(join(h.root,'eval/selftest/batch7-attempt-worker.mjs'),[p]);h.ok(r);const result=JSON.parse(r.stdout.trim().split('\n').at(-1));assert.equal(result.error,undefined,result.stack);h.write(join(at,'worker-result.json'),result);return{...result,at,out,task,work};
 }
 async function own215(options={}){
  const r=await attempt(options);const client=r.calls.find(c=>c.clientResult)?.clientResult;assert.ok(client,'fake agent called the real native client');assert.equal(r.value.status,'done',JSON.stringify(r.value));targetError(client,'src/tax.ts:src/tax.ts',r.value.work);
  const {settleCell}=await import(pathToFileURL(join(r.at,'eval/run.mjs')).href);let starts=0;
  const value=await settleCell({id:r.value.id,task:r.task,condition:'graph',repeat:1},[],{results:join(r.at,'eval/results'),rule:'closed',runAttempt:async()=>{starts++;return r.value;}});
  assert.equal(value.status,'done');assert.equal(starts,1);const ledger=h.json(join(r.at,'eval/results/_ledger',r.value.id+'.json'));assert.equal(ledger.length,1);assert.equal(ledger[0].kind,'done');assert.ok(!existsSync(join(r.at,'eval/results/_invalid')));
 }
 async function own216(fault,options={}){
  await rig('graph',async s=>{unavailable(await s.invoke(['carry','src/cart.ts:1-1']));const log=rows(s.log);assert.equal(log.filter(r=>r.event==='failure').length,1);assert.equal(log.filter(r=>!r.event).length,1);assert.equal(s.service.stats().failures,1);}, {...options,fault});
  const r=await attempt({...options,fault});unavailable(r.calls.find(c=>c.clientResult)?.clientResult);assert.equal(r.value.status,'invalid',JSON.stringify(r.value));assert.match(r.value.reason,/harness failure:.*service or shell launcher unavailable/);assert.equal(rows(join(r.out,'service.jsonl')).filter(r=>r.event==='failure').length,1);
 }
 async function own217(options={}){
  const f=await shared.getClosed(),path=join(f.repo,'src/unreadable.ts');h.write(path,'export const unreadable = 1;\n');chmodSync(path,0o000);
  try{let readable=false;try{accessSync(path,constants.R_OK);readable=true;}catch(e){assert.equal(e.code,'EACCES');}if(readable){console.log('SKIP B7-217: this user can read mode 000 files');return {skipped:true};}
   await rig('graph',async s=>{const direct=h.node(join(s.at,'src/main.ts'),['carry','src/unreadable.ts:1-1','--repo',s.repo,'--store',s.store]);h.write(join(s.at,'unreadable-direct.json'),triple(direct));assert.equal(direct.status,1,JSON.stringify(triple(direct)));assert.match(direct.stderr,/cannot read src\/unreadable.ts:/);assert.equal(direct.stdout,'');unavailable(await s.invoke(['carry','src/unreadable.ts:1-1']));assert.equal(s.service.stats().failures,1);assert.equal(rows(s.log).filter(r=>r.event==='failure').length,1);},options);return {skipped:false};
  }finally{chmodSync(path,0o644);}
 }
 async function caught(name,owner,fn){let receipt;await assert.rejects(fn,e=>{if(e.code!=='ERR_ASSERTION')return false;if(/no store at|store changed since preparation|ENOENT.*stat /.test(e.message+JSON.stringify(e.evidence??'')))return false;receipt={name,owner,message:e.message,actual:e.actual,expected:e.expected,evidence:e.evidence};return true;});h.write(join(scratch,'plant-'+name+'.json'),receipt);}
 const smokeShared={...shared,attempt};await batch7SmokeChecks({scratch,shared:smokeShared});
 const badExit=at=>replace(join(at,'src/ask.ts'),'return fail(missingRangeFile(t.path, names.filter((n) => n.kind === "file").map((n) => String(n.name))), 3);','return fail(missingRangeFile(t.path, names.filter((n) => n.kind === "file").map((n) => String(n.name))), 1);');
 for(const condition of ['graph','graph-nolink','graph-nosearch','graph-noterms','graph-norule','stub'])add('B7-214 '+condition+' missing folder through-file repeated-file and absolute namespace targets',()=>own214(condition));
 add('B7-215 bad target finishes once with done ledger and no invalid archive',()=>own215());
 for(const fault of ['store','exit1'])add('B7-216 '+fault+' remains a service failure and invalid runner attempt',()=>own216(fault));
 add('B7-217 unreadable existing file remains a product and service failure',()=>own217());
 add('B7-218 code 3 real reply passes smoke answers and accounting',async()=>{
  const at=await smokeShared.smokeFixture('missing-range-smoke'),dir=join(at,'eval/results/c1__graph__r1');
  await rig('graph',async s=>{targetError(await s.invoke(['carry','src/missing.ts:1-5']),'src/missing.ts',s.repo);const reply=rows(s.log);assert.equal(reply.length,1);h.write(join(dir,'service.jsonl'),h.read(join(dir,'service.jsonl'))+JSON.stringify(reply[0])+'\n');const meta=h.json(join(dir,'meta.json'));meta.service.calls++;h.write(join(dir,'meta.json'),meta);});
  const r=h.node(join(at,'eval/smoke-check.mjs'),['--batch','7']);h.write(join(at,'missing-smoke.json'),triple(r));for(const label of ['condition answers','service answered every call'])assert.match(r.stdout,new RegExp('^PASS '+label,'m'),r.stdout+r.stderr);
 });
 add('B7-218 archived failing attempt still fails smoke answers and accounting',async()=>{
  const archived=join(trialResults(h.root),'_smoke-archive/9-missing-range-file-voided-attempt');let results=archived;
  if(!existsSync(archived)){
   const at=await smokeShared.smokeFixture('voided-evidence'),source=join(trialResults(h.root),'_invalid/zustand7-conflict-zs-02__graph-norule__r1__ef6e40ca-25ba-4461-8112-b39f5a93b6d7');results=join(at,'eval/results');
   const dir=join(results,'_invalid/original-missing-range');cpSync(source,dir,{recursive:true});
   h.write(join(results,'_ledger/c1__graph-norule__r1.json'),[{kind:'harness',archived:dir,meta:h.json(join(dir,'meta.json'))},{kind:'done'}]);
  }
  const checker=existsSync(archived)?h.node(join(h.root,'eval/smoke-check.mjs'),['--batch','7','--results',results]):h.node(join(results,'../smoke-check.mjs'),['--batch','7']);
  h.write(join(scratch,'archived-smoke.json'),triple(checker));for(const label of ['condition answers','service answered every call'])assert.match(checker.stdout,new RegExp('^FAIL '+label+': service failure','m'),checker.stdout+checker.stderr);
 });
 add('B7-219 batches 3 to 6 protected bytes and frozen score match 513b9be',()=>{
  h.ok(h.command('git',['diff','--exit-code','513b9be','--','eval/opencode.mjs','eval/registry.mjs','eval/registry.json','eval/score.mjs','eval/tasks','eval/tickets/zustand','eval/tickets/hono','eval/tickets/memod','eval/tickets/memoryd','eval/selftest/batch5.mjs','eval/selftest/batch6.mjs','eval/selftest/batch5-report.mjs','eval/selftest/batch6-report.mjs']));
  assert.ok(h.read(join(h.root,'eval/score.txt')).startsWith(h.ok(h.command('git',['show','513b9be:eval/score.txt']))),'eval/score.txt keeps the 513b9be report as its prefix; later batches only append');
  for(const p of ['eval/selftest/batch3.mjs','eval/selftest/batch4.mjs'])if(existsSync(join(h.root,p)))assert.equal(h.read(join(h.root,p)),h.ok(h.command('git',['show','513b9be:'+p])));
 });
 add('regression B7-214 is red on 513b9be',()=>caught('old-B7-214','B7-214',()=>own214('graph',{revision:'513b9be'},['src/missing.ts'])));
 add('plant missing range exit 1 caught by B7-214',()=>caught('missing-exit1','B7-214',()=>own214('graph',{plant:badExit},['src/missing.ts'])));
 add('plant missing range exit 1 caught by B7-215',()=>caught('missing-exit1-verdict','B7-215',()=>own215({plant:badExit})));
 for(const [label,suffix] of [['system-error'," ENOENT: no such file or directory, open 'missing'"],['absolute-path',' /home/example/work/repo/src/missing.ts']])add('plant '+label+' caught by B7-214',()=>caught(label,'B7-214',()=>own214('graph',{plant:at=>replace(join(at,'src/target.pure.ts'),'No file ${path} in the working tree.','No file ${path} in the working tree.'+suffix)},['src/missing.ts'])));
 add('plant service passes exit 1 caught by B7-216',()=>caught('service-passes-exit1','B7-216',()=>own216('exit1',{plant:at=>replace(join(at,'eval/closed-store.mjs'),"if(error.code===1) throw new Error(error.stderr || 'product command failed');",'')})));
 for(const [label,code,path] of [['folder','EISDIR','src'],['through-file','ENOTDIR','src/tax.ts/x.ts']])add('plant '+label+' exit 1 caught by B7-214',()=>caught(label+'-exit1','B7-214',()=>own214('graph',{plant:at=>replace(join(at,'src/target.pure.ts'),`code === "${code}"`,'false')},[path])));
 add('plant unreadable file exit 3 caught by B7-217',async()=>{const probe=h.write(join(scratch,'permission-probe'),'x');chmodSync(probe,0o000);let readable=false;try{accessSync(probe,constants.R_OK);readable=true;}catch(e){assert.equal(e.code,'EACCES');}finally{chmodSync(probe,0o644);}if(readable){console.log('SKIP unreadable plant: this user can read mode 000 files');return;}await caught('unreadable-exit3','B7-217',()=>own217({plant:at=>replace(join(at,'src/target.pure.ts'),'code === "ENOENT"','code === "EACCES" || code === "ENOENT"')}));});
 return checks;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 mkdirSync(join(h.root,'test-results/scratch'),{recursive:true});const scratch=h.mkdtempSync(join(h.root,'test-results/scratch/mr-')),shared={};await batch7ClosedChecks({scratch,shared});await batch7AttemptChecks({scratch,shared});await batch7SmokeChecks({scratch,shared});
 const cases=(await batch7MissingRangeFileChecks({scratch,shared})).filter(c=>new RegExp(process.argv[2]??'.').test(c.name));assert.ok(cases.length);let wrong=0;for(const c of cases)try{await c.run();console.log('ok '+c.name);}catch(e){wrong++;console.log('WRONG '+c.name+'\n'+e.stack);}console.log(`${cases.length-wrong}/${cases.length} focused cases; ${scratch}`);process.exitCode=wrong?1:0;
}

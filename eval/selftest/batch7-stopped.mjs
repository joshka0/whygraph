/** module: [[whygraph-trial-design]]
 * Independent contracts B7-168 to B7-177: a call cut by the run's own stop.
 */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createConnection} from 'node:net';
import {chmodSync,cpSync,existsSync,mkdirSync,readFileSync,readdirSync,rmSync,statSync,unlinkSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
import {b7 as h} from './batch7-support.mjs';
import {batch7ClosedChecks} from './batch7-closed.mjs';
import {batch7AttemptChecks} from './batch7-attempts.mjs';
import {batch7SmokeChecks} from './batch7-smoke.mjs';
import {readArgs} from '../../src/args.pure.ts';
import {batchInstructions,fileKey} from '../registry.mjs';
const u=n=>{const b=Buffer.alloc(4);b.writeUInt32BE(n);return b;};
const frame=args=>Buffer.concat([u(args.length),...args.flatMap(a=>[u(Buffer.byteLength(a)),Buffer.from(a)])]);
const rows=p=>existsSync(p)?h.read(p).trim().split('\n').filter(Boolean).map(JSON.parse):[];
const collect=p=>new Promise((ok,fail)=>{let stdout='',stderr='';p.stdout.on('data',b=>stdout+=b);p.stderr.on('data',b=>stderr+=b);p.once('error',fail);p.once('close',(status,signal)=>ok({status,signal,stdout,stderr}));});
const replace=(p,a,b)=>{const s=h.read(p);assert.equal(s.split(a).length,2,`one plant anchor: ${a}`);h.write(p,s.replace(a,b));};
const sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
const shq=s=>"'"+s.replaceAll("'","'\\''")+"'";
const alive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}};
// Readiness wait for an event of a real child process, never a retry of an assertion.
async function until(what,predicate,ms=30000){const end=Date.now()+ms;while(Date.now()<end){if(predicate())return;await sleep(25);}throw new Error('timed out waiting for '+what);}
const pidsOf=p=>existsSync(p)?h.read(p).trim().split('\n').filter(Boolean).map(Number):[];
/** Open one raw client. It writes its bytes and then only listens. */
// ADR 0011 (2026-11-17), B7-192: these fixture frames exercise calls after authentication.
const fixtureTokens=new Map();
function client(socket,bytes){
 if(bytes.length)bytes=Buffer.concat([Buffer.from(fixtureTokens.get(socket)),bytes]);
 return new Promise((ok,fail)=>{const s=createConnection(socket),chunks=[];s.once('error',fail);
  const closed=new Promise(done=>s.on('close',()=>done(Buffer.concat(chunks))));
  s.on('data',b=>chunks.push(b));
  s.once('connect',()=>{s.removeListener('error',fail);s.on('error',()=>{});if(bytes.length)s.write(bytes);ok({s,closed});});
 });
}
const reply=b=>({code:b.readUInt32BE(0),stdout:b.subarray(12,12+b.readUInt32BE(4)).toString(),stderr:b.subarray(12+b.readUInt32BE(4)).toString()});
async function call(socket,args){const c=await client(socket,frame(args));return reply(await within(c.closed,'reply to '+args.join(' ')));}
// A stop that never settles fails the case instead of hanging the run.
const within=(promise,what,ms=20000)=>Promise.race([promise,new Promise((_,fail)=>setTimeout(()=>fail(new assert.AssertionError({message:what+' did not settle within '+ms+' ms'})),ms).unref())]);
const refusesConnection=socket=>new Promise((ok,fail)=>{const s=createConnection(socket);s.once('connect',()=>{s.destroy();fail(new Error('socket still accepts a connection'));});s.once('error',e=>{assert.ok(['ECONNREFUSED','ENOENT'].includes(e.code),e.code);ok();});});
const byArgs=(a,b)=>JSON.stringify(a.args).localeCompare(JSON.stringify(b.args));
const smokeSelection=(dir,meta=h.json(join(dir,'meta.json')))=>[{dir,meta,cell:{id:meta.id,task:{id:meta.task},condition:meta.condition,repeat:meta.repeat}}];
// Same capture of the real smoke callbacks as batch7-refusals.mjs: the assertions run byte for byte.
function checker({source=h.read(join(h.root,'eval/smoke-check.mjs')),virtual=new Map(),here=join(h.root,'eval/smoke-check.mjs')}={}){
 const prefix='const check=(name,fn)=>{try{';assert.equal(source.split(prefix).length,2);
 const context={callbacks:new Map(),readFileSync:(p,...a)=>virtual.has(String(p))?virtual.get(String(p)):readFileSync(p,...a),existsSync,join,fileURLToPath,URL,readArgs,batchInstructions,fileKey,
  process:{argv:['node',here,'--batch','7'],exitCode:0},lines:[]};context.console={log:(...a)=>context.lines.push(a.join(' '))};
 source=source.split('\n').filter(l=>!l.startsWith('import ')).join('\n').replace(prefix,'const check=(name,fn)=>globalThis.callbacks.set(name,fn); const replay=(name,fn)=>{try{').replaceAll('import.meta.url',JSON.stringify(pathToFileURL(here).href));
 runInNewContext(source+'\nglobalThis.run=(name,selection)=>{attempts.splice(0,attempts.length,...selection);failed=false;replay(name,globalThis.callbacks.get(name));process.exitCode=failed?1:0;};',context,{filename:here});
 return (name,selection)=>{context.lines.length=0;context.run(name,selection);return {status:context.process.exitCode,stdout:context.lines.join('\n')+'\n',stderr:''};};
}
function verdict(r,label,pass=true){assert.equal(r.status,pass?0:1,r.stdout+r.stderr);assert.match(r.stdout,new RegExp(`^${pass?'PASS':'FAIL'} ${label}(?:\\b|:)`,'m'),r.stdout);}
/** Calls cut by the run's own stop: service accounting, runner order and smoke-check totals.
 * owns: [[whygraph-batch7-stopped-selftest]]
 */
export async function batch7StoppedChecks({scratch,shared}){
 const checks=[],add=(name,run)=>checks.push({name:'B7 '+name,group:'stopped',run});let serial=0,completed,noStop;
 const SERVICE='service answered every call';
 const fresh=label=>h.inputs(h.copy(scratch,'stopped-'+label+'-'+serial++),undefined,r=>r.batches[7].instructionsCommit='c92205d');
 /** A copy of the eval code whose product command is a script: it hangs on `search HOLD*`, fails on a `FAIL*` target and runs the real product otherwise. */
 function fakeProduct(at,{carry=false,missing=false}={}){
  const pids=join(at,'pids');rmSync(join(at,'bin'));mkdirSync(join(at,'bin'));
  if(!missing){const script=`#!/bin/sh\ncase "$1:$2" in\n search:HOLD*) echo $$ >> ${shq(pids)}; exec sleep 120;;\n *:FAIL*) echo "planted product failure" >&2; exit 1;;\n${carry?' carry:*) echo unrelated; exit 0;;\n':''}esac\nexec ${shq(join(h.root,'src/main.ts'))} "$@"\n`;h.write(join(at,'bin/whygraph'),script);chmodSync(join(at,'bin/whygraph'),0o755);}
  return pids;
 }
 /** Run `fn` with a started service from a copy of closed-store.mjs. `edit` plants a bug in that copy. */
 async function rig(fn,{edit,carry,missing,condition='graph'}={}){
  const f=await shared.getClosed(),at=h.copy(scratch,'stopped-rig-'+serial++);
  const pids=fakeProduct(at,{carry,missing});if(edit)edit(at);
  const api=await import(pathToFileURL(join(at,'eval/closed-store.mjs')).href);
  const started=[];
  const start=async()=>{const dir=join(scratch,'stopped-wire-'+serial++);mkdirSync(dir);const socket=join(dir,'s'),log=join(dir,'service.jsonl');
   const service=await api.startClosedStore({condition,repo:f.repo,store:f.store,fullStore:f.store,socket,log,token:f.token});started.push(service);fixtureTokens.set(socket,f.token);
   const held=async n=>{const out=[];for(let i=0;i<n;i++)out.push(await client(socket,frame(['search','HOLD-'+i])));return out;};
   // Wait for the product commands themselves: a call is dispatched once its command ran.
   const dispatched=async n=>{await until(`${n} held product commands`,()=>pidsOf(pids).length>=n);return pidsOf(pids);};
   return {service,socket,log,held,dispatched};};
  try{return await fn({start,pids,f,at,api});}
  // Fixture teardown must also release held products when a planted stop is broken.
  finally{for(const pid of pidsOf(pids))if(alive(pid))process.kill(pid,'SIGKILL');for(const s of started)if(s.server.listening)await s.stop();for(const key of fixtureTokens.keys())if(key.startsWith(scratch))fixtureTokens.delete(key);}
 }
 const stoppedRows=log=>rows(log).filter(r=>r.event==='stopped');
 const own168=edit=>rig(async({start,pids})=>{
  const s=await start(),ok=await call(s.socket,['why','src/tax.ts:taxRate']);assert.equal(ok.code,0);
  const clients=await s.held(3);const running=await s.dispatched(3);assert.equal(running.length,3);for(const pid of running)assert.ok(alive(pid),'held command runs before the stop');
  const odd=await client(s.socket,frame(['search','HOLD-odd é "q"']));await until('fourth held command',()=>pidsOf(pids).length>=4);
  assert.deepEqual(s.service.stats(),{calls:5,failures:0,reasons:[],refused:0,refusalReasons:[],stopped:0},'held calls count as calls, not as stopped, before the stop');
  await within(s.service.stop(),'stop()');
  const stops=stoppedRows(s.log);assert.deepEqual(stops.map(r=>r.args).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),[['search','HOLD-0'],['search','HOLD-1'],['search','HOLD-2'],['search','HOLD-odd é "q"']],'one stopped row per call with its own args');
  for(const r of stops)assert.deepEqual(Object.keys(r).sort(),['args','event']);
  const all=rows(s.log);assert.equal(all.length,5,'one reply row and four stopped rows: no failure, no reply, no unavailable row');assert.equal(all.filter(r=>r.event==='failure'||r.failure!==undefined||r.code===70||String(r.stderr).includes('unavailable')).length,0);
  assert.deepEqual(s.service.stats(),{calls:5,failures:0,reasons:[],refused:0,refusalReasons:[],stopped:4});
  await until('every held product command to end after the stop',()=>pidsOf(pids).every(pid=>!alive(pid)),3000);
  for(const c of [...clients,odd])assert.equal((await c.closed).length,0,'a stopped call gets no reply bytes');
 },{edit});
 add('B7-168 stop waits for held calls, logs each as stopped with its own args and kills the product commands',()=>own168());
 const own169=edit=>rig(async({start})=>{
  const idle=await start();await assert.doesNotReject(within(Promise.all([idle.service.stop(),idle.service.stop()]),'concurrent stops'));await assert.doesNotReject(within(idle.service.stop(),'a stop after stop'));assert.equal(idle.service.stats().stopped,0);assert.deepEqual(rows(idle.log),[]);await refusesConnection(idle.socket);
  const busy=await start(),clients=await busy.held(2);await busy.dispatched(2);
  const stops=[busy.service.stop(),busy.service.stop(),busy.service.stop()];const settled=await within(Promise.allSettled(stops),'three stops');assert.deepEqual(settled.map(r=>r.status),['fulfilled','fulfilled','fulfilled'],JSON.stringify(settled));
  await assert.doesNotReject(within(busy.service.stop(),'a stop after stop'));assert.equal(busy.service.stats().stopped,2,'each stopped call counted once');assert.equal(stoppedRows(busy.log).length,2,'each stopped call logged once');assert.equal(busy.service.stats().failures,0);await refusesConnection(busy.socket);
  for(const c of clients)await c.closed;
 },{edit});
 // Strict reading of B7-168: the commands are gone when stop() resolves, not merely signalled.
 // The service resolves on the abort error, which Node raises before the child exits (measured: alive at resolve, gone about 10 ms later).
 add('B7-168 no product command of a stopped call is still alive when stop resolves',()=>rig(async({start,pids})=>{
  const s=await start(),clients=await s.held(3);const running=await s.dispatched(3);assert.equal(running.length,3);
  await s.service.stop();for(const pid of pidsOf(pids))assert.equal(alive(pid),false,`product command ${pid} survives stop()`);for(const c of clients)await c.closed;
 }));
 add('B7-169 stop twice, sequentially and concurrently, with and without held calls',()=>own169());
 const failing=[['product exit 1',{},['why','FAIL-exit']],['changed carry section',{carry:true,condition:'graph-nolink'},['carry','src/tax.ts:taxRate']],['spawn error',{missing:true},['why','src/tax.ts:taxRate']]];
 const own170=([label,options,args],edit)=>rig(async({start})=>{
  // The spawn error rig has no product command to hold: its earlier run has no stopped call.
  if(!options.missing){const earlier=await start();await earlier.held(2);await earlier.dispatched(2);await earlier.service.stop();assert.equal(earlier.service.stats().stopped,2);}
  const s=await start(),r=await call(s.socket,args);
  assert.deepEqual({code:r.code,stdout:r.stdout,stderr:r.stderr},{code:70,stdout:'',stderr:'whygraph service unavailable\n'});
  const events=rows(s.log);assert.equal(events.filter(e=>e.event==='failure').length,1);assert.equal(events.filter(e=>e.event==='stopped').length,0);
  const reply=events.find(e=>!e.event);assert.equal(reply.code,70);assert.equal(reply.stderr,'whygraph service unavailable\n');assert.equal(typeof reply.failure,'string');assert.ok(reply.failure.length>0);
  assert.deepEqual(s.service.stats(),{calls:1,failures:1,reasons:[reply.failure],refused:0,refusalReasons:[],stopped:0});
 },{...options,edit});
 for(const scenario of failing)add(`B7-170 ${scenario[0]} while running stays a failure, also after an earlier run logged stopped calls`,()=>own170(scenario));
 add('B7-170 a failure before a stop stays counted next to the stopped call',()=>rig(async({start})=>{
  const s=await start(),r=await call(s.socket,['why','FAIL-before']);assert.equal(r.code,70);
  const clients=await s.held(1);await s.dispatched(1);await s.service.stop();
  const stats=s.service.stats();assert.equal(stats.failures,1);assert.equal(stats.reasons.length,1);assert.equal(stats.stopped,1);assert.equal(stats.calls,2);
  assert.equal(rows(s.log).filter(e=>e.event==='failure').length,1);assert.equal(stoppedRows(s.log).length,1);await clients[0].closed;
 }));
 const own171=edit=>rig(async({start})=>{
  const idle=await start();const quiet=[await client(idle.socket,Buffer.alloc(0)),await client(idle.socket,u(1).subarray(0,3)),await client(idle.socket,Buffer.concat([u(1),u(10),Buffer.from('part')]))];
  const before=existsSync(idle.log)?h.read(idle.log):'';await idle.service.stop();assert.equal(existsSync(idle.log)?h.read(idle.log):'',before,'stop leaves the log unchanged');assert.equal(idle.service.stats().stopped,0);assert.equal(idle.service.stats().calls,0);
  for(const c of quiet)await c.closed;
  const done=await start();for(const args of [['why','src/tax.ts:taxRate'],['search','tax']])assert.equal((await call(done.socket,args)).code,0);
  const logged=h.read(done.log),stats=done.service.stats();await done.service.stop();assert.equal(h.read(done.log),logged);assert.deepEqual(done.service.stats(),{...stats,stopped:0});assert.equal(stoppedRows(done.log).length,0);
 },{edit});
 add('B7-171 stop with no call in flight, or with every reply delivered, changes nothing',()=>own171());
 // Attempts: the real runner with a scripted agent that leaves search calls open.
 async function attemptWith({mode='done',count=3,edit,wrapTimeout=mode==='timeout'}={}){
  const f=await shared.getClosed(),at=fresh('attempt-'+mode),work=join(h.root,'test-results','q'+h.hash(at).slice(0,7));mkdirSync(work);mkdirSync(join(at,'identity/opencode'),{recursive:true});
  const pids=fakeProduct(at),executable=join(at,'agent.mjs');cpSync(join(h.root,'eval/selftest/batch7-stopped-agent.mjs'),executable);chmodSync(executable,0o555);
  if(edit)edit(at);
  const settle=count>0?`const fs=await import('node:fs');const P=${JSON.stringify(pids)};const end=Date.now()+30000;const n=()=>fs.existsSync(P)?fs.readFileSync(P,'utf8').trim().split('\\n').filter(Boolean).length:0;while(n()<${count}&&Date.now()<end)await new Promise(r=>setTimeout(r,25));if(n()<${count})throw new Error('held calls were never dispatched');`:'';
  h.wrapped(at,'closed-run.mjs','runClosedAgent',`const v=await original_runClosedAgent(...args);${settle}return ${wrapTimeout?'{...v,r:{...v.r,timedOut:true}}':'v'};`);
  const task={id:'stopped-agent',batch:7,repo:'zustand'},out=join(at,'attempt');mkdirSync(out);
  const config=h.write(join(at,'config.json'),{module:join(at,'eval/closed-run.mjs'),entry:'closedAttempt',options:{task,condition:'graph',repeat:1,workRoot:work,out,prompt:'Leave calls open.',source:f.source,store:f.store,rehearsal:{executable,config:{mode:mode==='timeout'?'done':mode,count}}}});
  try{
   const r=await collect(spawn(process.execPath,[join(h.root,'eval/selftest/batch7-startup-worker.mjs'),config],{env:{...h.env,XDG_DATA_HOME:join(at,'identity')},cwd:h.root}));
   h.write(join(at,'worker-output.json'),r);assert.equal(r.status,0,r.stderr);const parsed=JSON.parse(r.stdout.trim().split('\n').at(-1));assert.equal(parsed.error,undefined,parsed.error);
   return {at,out,work,meta:parsed.value,records:rows(join(out,'service.jsonl')),pids:pidsOf(pids)};
  }finally{for(const pid of pidsOf(pids))if(alive(pid))process.kill(pid,'SIGKILL');}
 }
 const sockets=dir=>{const found=[];(function walk(p){for(const d of readdirSync(p,{withFileTypes:true}))if(d.isDirectory())walk(join(p,d.name));else if(d.name.endsWith('.sock'))found.push(join(p,d.name));})(dir);return found;};
 async function contract(a,status){
  const rowsStopped=a.records.filter(r=>r.event==='stopped');assert.equal(a.meta.status,status,a.meta.reason);
  assert.equal(rowsStopped.length,3,'three calls were held');assert.equal(a.meta.service.stopped,rowsStopped.length,'metadata holds exactly the stopped rows');assert.equal(a.meta.service.failures,0);assert.deepEqual(a.meta.service.reasons,[]);
  assert.equal(a.records.filter(r=>r.event==='failure').length,0);assert.equal(a.meta.service.calls,a.records.filter(r=>!r.event).length+rowsStopped.length);
  assert.equal(a.pids.length,3);for(const pid of a.pids)assert.equal(alive(pid),false,'no product command survives the attempt');
  const metaTime=statSync(join(a.out,'meta.json')).mtimeMs,logTime=statSync(join(a.out,'service.jsonl')).mtimeMs,size=statSync(join(a.out,'service.jsonl')).size;
  assert.ok(logTime<=metaTime,'service.jsonl is complete before meta.json is written');await sleep(400);assert.equal(statSync(join(a.out,'service.jsonl')).size,size,'no row is written after meta.json');assert.equal(rows(join(a.out,'service.jsonl')).length,a.records.length);
  assert.deepEqual(sockets(a.work),[],'both service sockets closed');
 }
 async function complete(){return completed??=await attemptWith();}
 for(const [mode,status,pattern]of [['done','done'],['timeout','error',/timed out/],['breach','invalid',/isolation breach/]])add(`B7-172 ${mode} with held calls keeps its classification and stops the service before the stats`,async()=>{
  const a=mode==='done'?await complete():await attemptWith({mode});await contract(a,status);if(pattern)assert.match(a.meta.reason,pattern);assert.equal(a.meta.reason===undefined||!/harness failure/.test(a.meta.reason),true,'stopped calls are no harness failure');
 });
 add('B7-172 held calls settle once with no retry, invalid archive or runner stop',async()=>{
  const a=await complete(),{settleCell}=await import('../run.mjs'),results=join(a.at,'settlement');let calls=0;const p={id:a.meta.id,task:{id:a.meta.task,batch:7},condition:a.meta.condition,repeat:1};
  const value=await settleCell(p,[],{results,runAttempt:async()=>{calls++;cpSync(a.out,join(results,fileKey(p.id)),{recursive:true});return a.meta;}});
  assert.equal(value.status,'done');assert.equal(calls,1);const ledger=h.json(join(results,'_ledger',fileKey(p.id)+'.json'));assert.equal(ledger.length,1);assert.equal(ledger[0].kind,'done');assert.equal(ledger[0].meta.service.stopped,3);assert.equal(existsSync(join(results,'_invalid')),false);
 });
 add('B7-173 attempt with no stopped call has stopped 0 next to the other counters',async()=>{
  noStop??=await attemptWith({count:0});const s=noStop.meta.service;assert.equal(noStop.meta.status,'done',noStop.meta.reason);assert.equal(s.stopped,0);
  for(const key of ['calls','failures','refused','refusalReasons','stopped'])assert.ok(Object.hasOwn(s,key),key);assert.equal(noStop.records.filter(r=>r.event==='stopped').length,0);
 });
 // Smoke-check replay.
 const label=(r,pattern)=>assert.match(r.stdout,pattern,r.stdout);
 function replay(a,name,virtual=new Map(),source){return checker({virtual,source})(name,smokeSelection(a.out,a.meta));}
 async function altered(name,edit,check=SERVICE){
  const a=await complete(),virtual=new Map(),meta=structuredClone(a.meta),data={meta,events:structuredClone(a.records)};edit(data);
  virtual.set(join(a.out,'service.jsonl'),data.events.map(JSON.stringify).join('\n')+'\n');const r=replay({...a,meta},check,virtual);h.write(join(scratch,`stopped-smoke-${serial++}-${name.replaceAll(/\W+/g,'-')}.json`),r);verdict(r,check,false);return r;
 }
 add('B7-174 stopped rows matching their metadata pass; the line prints refusal and stopped totals',async()=>{
  const a=await complete();const r=replay(a,SERVICE);verdict(r,SERVICE);label(r,/\b0 refused requests\b.*\b3\b.*stopped/);
  for(const other of ['condition answers','closed store and tool code'])verdict(replay(a,other),other);
  const noStops={...a.meta,service:{...a.meta.service,stopped:0,calls:a.meta.service.calls-3}};const virtual=new Map([[join(a.out,'service.jsonl'),a.records.filter(x=>x.event!=='stopped').map(JSON.stringify).join('\n')+'\n']]);
  const zero=replay({...a,meta:noStops},SERVICE,virtual);verdict(zero,SERVICE);label(zero,/\b0 refused requests\b.*\b0\b.*stopped/);
 });
 add('B7-174 stopped rows need no reply receipt, and the four health replies stay compared',async()=>{
  const a=await complete();assert.ok(a.records.filter(r=>r.event==='stopped').every(r=>r.reference===undefined&&r.stdout===undefined),'stopped rows carry no receipt');
  verdict(replay(a,'condition answers'),'condition answers');
  await altered('health-reply-corrupt',d=>{d.events.find(r=>!r.event).reference.stdout+='bad';},'condition answers');
 });
 const faults=[
  ['stopped row removed with consistent calls',/stopped calls differ from metadata/,d=>{d.events.splice(d.events.findIndex(r=>r.event==='stopped'),1);d.meta.service.calls--;}],
  ['stopped row removed',/stopped calls differ from metadata/,d=>d.events.splice(d.events.findIndex(r=>r.event==='stopped'),1)],
  ['stopped row added with consistent calls',/stopped calls differ from metadata/,d=>{d.events.push({event:'stopped',args:['search','HOLD-extra']});d.meta.service.calls++;}],
  ['stopped row added',/stopped calls differ from metadata/,d=>d.events.push({event:'stopped',args:['search','HOLD-extra']})],
  ['stopped count changed alone',/stopped calls differ from metadata/,d=>d.meta.service.stopped++],
  ['stopped count lowered alone',/stopped calls differ from metadata/,d=>d.meta.service.stopped--],
  ['stopped field removed',/stopped calls differ from metadata/,d=>delete d.meta.service.stopped],
  // ADR 0011 B7-197: exact event fields reject this row before argument-type validation.
  ['stopped row without args',/service log event with extra fields/,d=>delete d.events.find(r=>r.event==='stopped').args],
  ['stopped args not an array',/invalid service log event/,d=>d.events.find(r=>r.event==='stopped').args='search'],
  ['stopped arg not a string',/invalid service log event/,d=>d.events.find(r=>r.event==='stopped').args=['search',7]],
  ['failure event beside stopped rows',/service failure/,d=>d.events.push({event:'failure',message:'late'})],
  ['failure event with matching failure count',/service failure/,d=>{d.events.push({event:'failure',message:'late'});d.meta.service.failures++;d.meta.service.reasons=['late'];}],
  ['unavailable reply beside stopped rows',/bad service reply/,d=>d.events.find(r=>!r.event).code=70],
 ];
 for(const [name,why,mutate]of faults)add(`B7-175 ${name} fails service accounting`,async()=>{const r=await altered(name,mutate);assert.match(r.stdout,why,r.stdout);});
 add('B7-175 stopped rows never stand in for the four health replies',async()=>{const r=await altered('stopped-replace-replies',d=>{const replies=d.events.filter(r=>!r.event);const keep=replies.slice(0,3);const stops=d.events.filter(r=>r.event==='stopped');const extra=replies.slice(3).map(r=>({event:'stopped',args:r.args}));d.events=[...keep,...stops,...extra];d.meta.service.stopped=stops.length+extra.length;d.meta.service.calls=3+d.meta.service.stopped;assert.ok(extra.length>=1,'fixture has more than three replies');});assert.match(r.stdout,/missing service replies or failure/,r.stdout);});
 add('B7-175 four reply rows needed even when only stopped rows exceed the call count',async()=>{const r=await altered('only-stopped',d=>{const stops=d.events.filter(r=>r.event==='stopped');d.events=stops;d.meta.service.calls=stops.length;});assert.match(r.stdout,/missing service replies or failure/,r.stdout);});
 add('B7-174 B7-175 full smoke CLI passes stopped calls and fails each broken record',async()=>{
  const {at,out}=await shared.smokeFixture('stopped').then(at=>({at,out:join(at,'eval/results/c1__graph__r1')}));
  const events=rows(join(out,'service.jsonl')),meta=h.json(join(out,'meta.json')),first=meta.service.calls;
  events.splice(1,0,{event:'stopped',args:['search','HOLD-0']},{event:'stopped',args:['search','HOLD-1']});h.write(join(out,'service.jsonl'),events.map(JSON.stringify).join('\n')+'\n');meta.service.stopped=2;meta.service.calls=first+2;h.write(join(out,'meta.json'),meta);
  const good=h.node(join(at,'eval/smoke-check.mjs'),['--batch','7']);h.write(join(at,'cli-green.json'),good);assert.equal(good.status,0,good.stdout+good.stderr);assert.match(good.stdout,/^PASS service answered every call:.*\b0 refused requests\b.*\b2\b.*stopped/m);
  meta.service.stopped=1;h.write(join(out,'meta.json'),meta);const bad=h.node(join(at,'eval/smoke-check.mjs'),['--batch','7']);h.write(join(at,'cli-red.json'),bad);assert.equal(bad.status,1,bad.stdout+bad.stderr);assert.match(bad.stdout,/^FAIL service answered every call:/m);
 });
 add('B7-176 the archived sixth-smoke attempt still fails as a service failure',()=>{
  const archive=join(h.root,'eval/results/_smoke-archive/6-stop-logged-as-failure');
  if(!existsSync(archive))throw new Error(`B7-176 evidence is missing on this machine: ${archive}; restore the archive, this case cannot pass without it`);
  const base=join(archive,'_attempts'),names=readdirSync(base);assert.equal(names.length,1,'one archived attempt');const dir=join(base,names[0]),before=h.tree(archive);
  const meta=h.json(join(dir,'meta.json')),events=rows(join(dir,'service.jsonl'));assert.equal(events.filter(r=>r.event==='failure').length,8,'archive holds eight failure events');assert.equal(meta.service.failures,0,'and metadata that says failures 0');
  const r=checker()(SERVICE,smokeSelection(dir,meta));verdict(r,SERVICE,false);assert.match(r.stdout,/^FAIL service answered every call: service failure$/m);
  assert.deepEqual(h.tree(archive),before,'archive bytes stay read-only');h.write(join(scratch,'archived-stop-replay.json'),r);
 });
 add('B7-177 frozen batch 5 and 6 plans, launcher, inputs and reports match 94f31bf',()=>{
  const base='94f31bf',protectedPaths=['eval/opencode.mjs','eval/registry.mjs','eval/registry.json','eval/score.mjs','eval/tasks','eval/tickets/zustand','eval/tickets/hono','eval/tickets/memod','eval/tickets/memoryd','eval/score.txt','eval/selftest/batch5.mjs','eval/selftest/batch6.mjs','eval/selftest/batch5-report.mjs','eval/selftest/batch6-report.mjs'];
  const d=h.command('git',['diff','--exit-code',base,'--',...protectedPaths]);assert.equal(d.status,0,d.stdout+d.stderr);
  const at=fresh('old-plan'),taskFiles=h.command('git',['ls-tree','-r','--name-only','6fc48a3','eval/tasks']);h.ok(taskFiles);for(const p of taskFiles.stdout.trim().split('\n').filter(Boolean)){const text=h.command('git',['show',`6fc48a3:${p}`]);h.ok(text);h.write(join(at,p),text.stdout);}
  const copy=fresh('base-plan');for(const p of ['run.mjs','opencode.mjs','registry.mjs','registry.json','closed-run.mjs','closed-store.mjs','closed-client.c'])h.write(join(copy,'eval',p),h.ok(h.command('git',['show',`${base}:eval/${p}`])));cpSync(join(at,'eval/tasks'),join(copy,'eval/tasks'),{recursive:true});
  for(const batch of [5,6]){const args=['--batch',String(batch),'--plan'],current=h.node(join(at,'eval/run.mjs'),args),old=h.node(join(copy,'eval/run.mjs'),args);assert.equal(current.status,0,current.stderr);assert.equal(old.status,0,old.stderr);assert.deepEqual({status:current.status,stdout:current.stdout,stderr:current.stderr},{status:old.status,stdout:old.stdout,stderr:old.stderr},`batch ${batch} plan versus ${base}`);}
 });

 // Plants: each bug goes into a copy of the code and must turn its owner red.
 async function caught(name,id,fn){let error;try{await fn();}catch(e){if(e.code!=='ERR_ASSERTION'&&e.name!=='AssertionError'&&!/timed out waiting|never dispatched/.test(e.message))throw e;error=e;}assert.ok(error,`plant ${name} must turn ${id} red`);h.write(join(scratch,'stopped-plant-'+name+'.json'),{name,id,assertion:error.message});}
 const inStore=(from,to)=>at=>replace(join(at,'eval/closed-store.mjs'),from,to);
 const inRun=(from,to)=>at=>replace(join(at,'eval/closed-run.mjs'),from,to);
 const smokeSource=(from,to)=>{const source=h.read(join(h.root,'eval/smoke-check.mjs'));assert.equal(source.split(from).length,2,'one plant anchor: '+from);return source.replace(from,to);};
 for(const [name,id,run,edit]of [
  ['stop-never-aborts','B7-168',own168,inStore("    abort.abort();\n    await Promise.allSettled(pending);","    await Promise.allSettled(pending);")],
  ['stopped-call-is-failure','B7-168',own168,inStore("if(abort.signal.aborted&&error.name==='AbortError') { stopped++;appendFileSync(log,JSON.stringify({event:'stopped',args})+'\\n');return; }",'')],
  ['stopped-row-without-args','B7-168',own168,inStore("JSON.stringify({event:'stopped',args})","JSON.stringify({event:'stopped'})")],
  ['stop-not-idempotent','B7-169',own169,inStore('stop:()=>stopping??=stop()','stop:()=>stop()')],
  ['abort-shared-across-services','B7-170',(edit)=>own170(failing[0],edit),at=>{inStore('const root = fileURLToPath(new URL(\'..\', import.meta.url));',"const root = fileURLToPath(new URL('..', import.meta.url));const sharedAbort=new AbortController();")(at);inStore('const abort=new AbortController(), connections','const abort=sharedAbort, connections')(at);}],
  ['stop-counts-open-connections','B7-171',own171,inStore("    abort.abort();\n","    abort.abort();stopped+=connections.size;\n")],
 ])add(`plant ${name} caught by ${id}`,async()=>{await run();await caught(name,id,()=>run(edit));});
 add('plant stats read before the service stops caught by B7-172',async()=>{
  const own=edit=>attemptWith({edit}).then(a=>contract(a,'done'));await own();await caught('stats-before-stop','B7-172',()=>own(inRun("    await launcher.stop();\n    await service.stop();\n","    await launcher.stop();\n")));
 });
 add('plant metadata drops stopped caught by B7-173',async()=>{
  const own=async edit=>{const a=await attemptWith({count:0,edit});assert.equal(a.meta.service.stopped,0);assert.ok(Object.hasOwn(a.meta.service,'stopped'));};
  await own();await caught('metadata-drops-stopped','B7-173',()=>own(inRun('work,service:stats};','work,service:{calls:stats.calls,failures:stats.failures,reasons:stats.reasons,refused:stats.refused,refusalReasons:stats.refusalReasons}};')));
 });
 add('plant smoke compares calls with reply rows only caught by B7-174',async()=>{
  const own=async source=>{const a=await complete();verdict(replay(a,SERVICE,new Map(),source),SERVICE);};await own();
  await caught('smoke-calls-reply-rows-only','B7-174',()=>own(smokeSource('meta.service.calls===calls.length+stops.length','meta.service.calls===calls.length')));
 });
 for(const [name,from,to,mutate]of [
  ['accepts-any-stopped-row',"||(row.event==='stopped'&&Array.isArray(row.args)&&row.args.every(arg=>typeof arg==='string'))","||row.event==='stopped'",d=>d.events.find(r=>r.event==='stopped').args=['search',7]],
  ['ignores-stopped-metadata',"require(meta.service.stopped===stops.length,'stopped calls differ from metadata');",'',d=>d.meta.service.stopped++],
 ])add(`plant smoke ${name} caught by B7-175`,async()=>{
  const own=async source=>{const a=await complete(),data={meta:structuredClone(a.meta),events:structuredClone(a.records)};mutate(data);const virtual=new Map([[join(a.out,'service.jsonl'),data.events.map(JSON.stringify).join('\n')+'\n']]);verdict(replay({...a,meta:data.meta},SERVICE,virtual,source),SERVICE,false);};
  await own();await caught('smoke-'+name,'B7-175',()=>own(smokeSource(from,to)));
 });
 return checks;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 mkdirSync(join(h.root,'test-results'),{recursive:true});const scratch=h.mkdtempSync(join(h.root,'test-results/stopped-')),shared={};
 await batch7ClosedChecks({scratch,shared});await batch7AttemptChecks({scratch,shared});await batch7SmokeChecks({scratch,shared});
 const checks=await batch7StoppedChecks({scratch,shared}),filter=new RegExp(process.argv[2]??'B7'),selected=checks.filter(c=>filter.test(c.name));assert.ok(selected.length,'filter must select at least one case');console.log(`Scratch retained: ${scratch}`);let wrong=0;
 for(const c of selected){try{await c.run();console.log('ok '+c.name);}catch(e){wrong++;console.log('WRONG '+c.name+'\n'+e.stack);}}
 console.log(`${selected.length-wrong}/${selected.length} focused cases; ${scratch}`);process.exitCode=wrong?1:0;
}

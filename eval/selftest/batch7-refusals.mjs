/** module: [[whygraph-trial-design]]
 * Independent contracts from B7-134 through B7-167 and amended B7-13/62/63/80.
 */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createConnection} from 'node:net';
import {cpSync,chmodSync,existsSync,mkdirSync,readFileSync,readdirSync,realpathSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
import {b7 as h} from './batch7-support.mjs';
import {batch7ClosedChecks} from './batch7-closed.mjs';
import {batch7AttemptChecks} from './batch7-attempts.mjs';
import {batch7SmokeChecks} from './batch7-smoke.mjs';
import {batch7HostChecks} from './batch7-host.mjs';
import {readArgs} from '../../src/args.pure.ts';
import {batchInstructions,fileKey} from '../registry.mjs';
const usage={status:2,stdout:'',stderr:'usage: whygraph <carry|why|impact|search> <target>\n'};
const unavailable={status:70,stdout:'',stderr:'whygraph service unavailable\n'};
const triple=r=>({status:r.status,stdout:r.stdout,stderr:r.stderr});
const u=n=>{const b=Buffer.alloc(4);b.writeUInt32BE(n);return b;};
const frame=args=>Buffer.concat([u(args.length),...args.flatMap(a=>[u(Buffer.byteLength(a)),Buffer.from(a)])]);
const rows=p=>existsSync(p)?h.read(p).trim().split('\n').filter(Boolean).map(JSON.parse):[];
const collect=p=>new Promise((ok,fail)=>{let stdout='',stderr='';p.stdout.on('data',b=>stdout+=b);p.stderr.on('data',b=>stderr+=b);p.once('error',fail);p.once('close',(status,signal)=>ok({status,signal,stdout,stderr}));});
const replace=(p,a,b)=>{const s=h.read(p);assert.equal(s.split(a).length,2,`one plant anchor: ${a}`);h.write(p,s.replace(a,b));};
async function raw(socket,chunks){
 return new Promise((ok,fail)=>{const received=[],s=createConnection(socket);let at=0;
  s.on('data',b=>received.push(b));s.on('error',e=>{if(e.code!=='ECONNRESET'&&e.code!=='EPIPE')fail(e);});
  s.on('connect',()=>send());
  function send(){if(s.destroyed)return;if(at===chunks.length){s.end();return;}s.write(chunks[at++],()=>setImmediate(send));}
  s.on('close',()=>ok(Buffer.concat(received)));
 });
}
// Capture actual smoke callbacks and their PASS/FAIL wrapper. Keep the original
// assertions, including the global four-task coverage rule, byte for byte.
function checker({source=h.read(join(h.root,'eval/smoke-check.mjs')),virtual=new Map(),here=join(h.root,'eval/smoke-check.mjs')}={}){
 const prefix='const check=(name,fn)=>{try{';assert.equal(source.split(prefix).length,2);
 const context={callbacks:new Map(),readFileSync:(p,...a)=>virtual.has(String(p))?virtual.get(String(p)):readFileSync(p,...a),existsSync,join,fileURLToPath,URL,readArgs,batchInstructions,fileKey,
  process:{argv:['node',here,'--batch','7'],exitCode:0},lines:[]};context.console={log:(...a)=>context.lines.push(a.join(' '))};
 source=source.split('\n').filter(l=>!l.startsWith('import ')).join('\n').replace(prefix,'const check=(name,fn)=>globalThis.callbacks.set(name,fn); const replay=(name,fn)=>{try{').replaceAll('import.meta.url',JSON.stringify(pathToFileURL(here).href));
 runInNewContext(source+'\nglobalThis.run=(name,selection)=>{attempts.splice(0,attempts.length,...selection);failed=false;replay(name,globalThis.callbacks.get(name));process.exitCode=failed?1:0;};',context,{filename:here});
 return (name,selection)=>{context.lines.length=0;context.run(name,selection);return {status:context.process.exitCode,stdout:context.lines.join('\n')+'\n',stderr:''};};
}
const selection=(dir,meta=h.json(join(dir,'meta.json')))=>[{dir,meta,cell:{id:meta.id,task:{id:meta.task},condition:meta.condition,repeat:meta.repeat}}];
function verdict(r,label,pass=true){assert.equal(r.status,pass?0:1,r.stdout+r.stderr);assert.match(r.stdout,new RegExp(`^${pass?'PASS':'FAIL'} ${label}(?:\\b|:)`,'m'),r.stdout);}
/** Frame accounting, fixed confinement evidence and scripted agent contracts.
 * owns: [[whygraph-batch7-refusal-selftest]]
 */
export async function batch7RefusalChecks({scratch,shared}){
 const checks=[],add=(name,run)=>checks.push({name:'B7 '+name,group:'refusals',run});let serial=0,completed;
 const fresh=label=>h.inputs(h.copy(scratch,'refusal-'+label+'-'+serial++),undefined,r=>r.batches[7].instructionsCommit='c92205d');
 async function service(fn,{module,store}={}){
  const f=await shared.getClosed(),at=join(scratch,'wire-'+serial++);mkdirSync(at);const socket=join(at,'s'),log=join(at,'service.jsonl'),api=module??f.api;
  const instance=await api.startClosedStore({condition:'graph',repo:f.repo,store:store??f.store,socket,log});
  const confinement=f.api.closedConfinement({work:f.prepared.graph.work,repo:f.prepared.graph.repo,client:f.client,socket,network:false,opencode:f.opencode});
  const invoke=args=>collect(spawn(confinement[0],[...confinement.slice(1),'--','/tools/whygraph',...args],{env:h.env}));
  try{return await fn({...f,at,socket,log,service:instance,invoke,confinement});}finally{if(globalThis.refusalPlantQuery){await globalThis.refusalPlantQuery;delete globalThis.refusalPlantQuery;}if(instance.server.listening)await instance.stop();}
 }
 async function refusal(f,chunks,reason){const before=f.service.stats(),reply=await raw(f.socket,chunks);assert.equal(reply.length,0,'frame refusal closes without reply');const after=f.service.stats();assert.deepEqual(after,{...before,refused:before.refused+1,refusalReasons:[...before.refusalReasons,reason]},'refusal changes no dispatch/failure counter');assert.deepEqual(rows(f.log).at(-1),{event:'refused',message:reason});}
 async function scripted(mode='full',mutate=()=>{}){
  const f=await shared.getClosed(),at=fresh('agent-'+mode),work=join(h.root,'test-results','q'+h.hash(at).slice(0,7));mkdirSync(work);
  mkdirSync(join(at,'identity/opencode'),{recursive:true});
  const executable=join(at,'agent.mjs');cpSync(join(h.root,'eval/selftest/batch7-refusal-agent.mjs'),executable);chmodSync(executable,0o555);mutate(at);
  const task={id:'refusal-agent',batch:7,repo:'zustand'},out=join(at,'attempt');mkdirSync(out);
  if(mode.startsWith('failure'))replace(join(at,'eval/closed-store.mjs'),'  async function answer(args) {\n    calls++;','  async function answer(args) {\n    calls++;if(refused>0)throw new Error("dispatched answer failed");');
  if(mode==='timeout'||mode==='failure-timeout')h.wrapped(at,'closed-run.mjs','runClosedAgent','const v=await original_runClosedAgent(...args);return {...v,r:{...v.r,timedOut:true}};');
  const config=h.write(join(at,'config.json'),{module:join(at,'eval/closed-run.mjs'),entry:'closedAttempt',options:{task,condition:'graph',repeat:1,workRoot:work,out,prompt:'Run scripted probes.',source:f.source,store:f.store,rehearsal:{executable,config:{mode:mode==='timeout'?'basic':mode==='failure-timeout'?'failure':mode}}}});
  const r=await collect(spawn(process.execPath,[join(h.root,'eval/selftest/batch7-startup-worker.mjs'),config],{env:{...h.env,XDG_DATA_HOME:join(at,'identity')},cwd:h.root}));
  h.write(join(at,'worker-output.json'),r);assert.equal(r.status,0,r.stderr);const parsed=JSON.parse(r.stdout.trim().split('\n').at(-1));assert.equal(parsed.error,undefined,parsed.error);
  return {at,out,work,meta:parsed.value,records:rows(join(out,'service.jsonl'))};
 }
 async function complete(){return completed??=await scripted();}
 async function smokeFixture(){const at=await shared.smokeFixture('refusals'),out=join(at,'eval/results/c1__graph__r1');return{at,out};}
 function replay(f,label,virtual=new Map(),source){return checker({virtual,source})(label,selection(f.out,f.meta??h.json(join(f.out,'meta.json'))));}
 async function altered(label,edit,check='service answered every call'){
  const f=await complete(),virtual=new Map(),meta=structuredClone(f.meta);const data={meta,events:structuredClone(f.records),tools:h.json(join(f.out,'tools.json')),health:h.json(join(f.out,'health.json')),proof:h.json(join(f.out,'confinement.json'))};edit(data);
  for(const [leaf,value]of [['service.jsonl',data.events.map(JSON.stringify).join('\n')+'\n'],['tools.json',JSON.stringify(data.tools)],['health.json',JSON.stringify(data.health)],['confinement.json',JSON.stringify(data.proof)]])virtual.set(join(f.out,leaf),value);
  const r=replay({...f,meta},check,virtual);h.write(join(scratch,`smoke-${serial++}-${label}.json`),r);verdict(r,check,false);return{f,data,virtual,r};
 }
 add('B7-13 B7-134 raw HTTP refusal preserves real answers and never queries',()=>service(async f=>{
  const before=await f.invoke(['why','src/tax.ts:taxRate']);assert.equal(before.status,0,before.stderr);
  await refusal(f,[Buffer.from('GET / HTTP/1.0\r\n\r\n')],'invalid argument count');
  assert.deepEqual(triple(await f.invoke(['why','src/tax.ts:taxRate'])),triple(before));assert.equal(f.service.stats().calls,2);assert.equal(rows(f.log).filter(r=>!r.event).length,2);
 }));
 for(const n of [65,0xffffffff])add(`B7-135 raw count ${n} is one refusal`,()=>service(f=>refusal(f,[u(n)],'invalid argument count')));
 for(const chunked of [false,true])add(`B7-136 length 60001 ${chunked?'split header':'one header'} refuses without payload`,()=>service(f=>refusal(f,chunked?[u(1),u(60001).subarray(0,2),u(60001).subarray(2)]:[Buffer.concat([u(1),u(60001)])],'argument too large')));
 for(const chunked of [false,true])add(`B7-137 total 66012 bytes ${chunked?'split payload':'one write'} refuses`,()=>service(f=>{const bytes=frame(['x'.repeat(33000),'y'.repeat(33000)]);assert.equal(bytes.length,66012);return refusal(f,chunked?[bytes.subarray(0,40000),bytes.subarray(40000)]:[bytes],'request too large');}));
 add('B7-138 empty and incomplete frames change no counters and leave client usable',()=>service(async f=>{for(const bytes of [Buffer.alloc(0),u(1).subarray(0,3),Buffer.concat([u(1),u(10).subarray(0,2)]),Buffer.concat([u(1),u(10),Buffer.from('part')])]){const before=f.service.stats();assert.equal((await raw(f.socket,[bytes])).length,0);assert.deepEqual(f.service.stats(),before);}assert.deepEqual(rows(f.log),[]);assert.equal((await f.invoke(['why','src/tax.ts:taxRate'])).status,0);}));
 const limits=[['B7-139 65 arguments',Array(65).fill('x')],['B7-140 ASCII 60001 bytes',['x'.repeat(60001)]],['B7-140 UTF8 60002 bytes',['é'.repeat(30001)]],['B7-141 total frame over 65536',['x'.repeat(33000),'y'.repeat(33000)]]];
 for(const [label,args]of limits)add(`${label} rejects before any service connection even when absent`,()=>service(async f=>{
  const before=f.service.stats();let connections=0;f.service.server.on('connection',()=>connections++);assert.deepEqual(triple(await f.invoke(args)),usage);assert.deepEqual(f.service.stats(),before);assert.equal(connections,0);assert.deepEqual(rows(f.log),[]);
  const code=`const cp=require('child_process');process.stdout.write('READY\\n');process.stdin.once('data',()=>{const r=cp.spawnSync('/tools/whygraph',${JSON.stringify(args)},{encoding:'utf8'});console.log(JSON.stringify({status:r.status,stdout:r.stdout,stderr:r.stderr}));});`;
  const p=spawn(f.confinement[0],[...f.confinement.slice(1),'--','/usr/bin/node','-e',code],{env:h.env});let output='';const ready=new Promise(ok=>p.stdout.on('data',b=>{output+=b;if(output.startsWith('READY\n'))ok();}));const done=collect(p);await ready;await f.service.stop();p.stdin.end('go');const r=await done;assert.equal(r.status,0,r.stderr);assert.deepEqual(JSON.parse(output.slice(6)),usage);
 }));
 add('B7-142 inclusive client limits reach product parser with direct bytes',()=>service(async f=>{
  for(const args of [Array(64).fill('x'),['x'.repeat(60000)],['x'.repeat(32762),'é'.repeat(16381)]]){if(args.length===2)assert.equal(frame(args).length,65536);const before=f.service.stats(),r=await f.invoke(args),direct=await collect(spawn(process.execPath,[join(h.root,'src/main.ts'),...args],{cwd:f.repo,env:h.env}));assert.deepEqual(triple(r),triple(direct));assert.equal(f.service.stats().calls,before.calls+1);assert.equal(f.service.stats().refused,before.refused);assert.equal(f.service.stats().failures,0);}
 }));
 add('B7-151 queued rejected chunks count once and snapshot reasons remain immutable',()=>service(async f=>{
  const snapshot=f.service.stats();await refusal(f,[u(65),frame(['why','src/tax.ts:taxRate'])],'invalid argument count');assert.deepEqual(snapshot.refusalReasons,[]);const first=f.service.stats();await refusal(f,[u(1),u(60001)],'argument too large');assert.deepEqual(first.refusalReasons,['invalid argument count']);assert.equal((await f.invoke(['why','src/tax.ts:taxRate'])).status,0);assert.equal(f.service.stats().calls,1);assert.deepEqual(f.service.stats().reasons,[]);
 }));
 add('B7-143 B7-146 scripted archived command shapes finish valid with exact refusal metadata and all client answers',async()=>{
  const f=await complete();assert.equal(f.meta.status,'done',f.meta.reason);assert.equal(f.meta.service.failures,0);assert.deepEqual(f.meta.service.reasons,[]);const refused=f.records.filter(r=>r.event==='refused');assert.equal(refused.length,2);assert.equal(f.meta.service.refused,2);assert.deepEqual(f.meta.service.refusalReasons,refused.map(r=>r.message));assert.equal(f.meta.service.calls,f.records.filter(r=>!r.event).length);assert.equal(f.meta.tokens.total,0);
  const seen=h.json(join(f.meta.work,'repo/refusal-observations.json'));assert.equal(seen.outerLauncher,true);for(const o of seen.observations.filter(o=>o.command.startsWith('/tools/whygraph '))){const answer=f.records.find(r=>!r.event&&r.args?.join(' ')===o.command.slice('/tools/whygraph '.length).replaceAll("'",''));if(o.command.includes(Array(65).fill('x').join(' '))){assert.deepEqual(triple(o),usage);continue;}assert.ok(answer,`receipt for ${o.command}`);assert.deepEqual(triple(o),{status:answer.code,stdout:answer.stdout,stderr:answer.stderr});}
  for(const label of ['condition answers','closed store and tool code','service answered every call','tokens and wall time per run'])verdict(replay(f,label),label);
  assert.deepEqual(readdirSync(f.out).filter(n=>n==='_invalid'||n==='_ledger'),[]);
 });
 add('B7-143 refusal does not erase timeout or isolation classification',async()=>{
  for(const mode of ['timeout','breach']){const f=await scripted(mode);assert.equal(f.meta.service.refused,1);assert.equal(f.meta.status,mode==='timeout'?'error':'invalid',f.meta.reason);assert.match(f.meta.reason,mode==='timeout'?/timed out/:/isolation breach/);}
 });
 add('B7-144 dispatched failure stays separate from earlier refusal with exact real client diagnostic',async()=>{
  const f=await scripted('failure');assert.equal(f.meta.status,'invalid',f.meta.reason);assert.match(f.meta.reason,/harness failure:.*dispatched answer failed/);assert.equal(f.meta.service.refused,1);assert.equal(f.meta.service.failures,1);assert.deepEqual(f.meta.service.reasons,['dispatched answer failed']);const seen=h.json(join(f.meta.work,'repo/refusal-observations.json'));assert.deepEqual(triple(seen.observations.find(o=>o.status===70)),unavailable);
 });
 add('B7-145 earlier refusal does not hide lost service including during timeout',async()=>{
  for(const mode of ['service-down','timeout-service-down']){const at=fresh(mode);h.wrapped(at,'closed-store.mjs','startClosedStore','const v=await original_startClosedStore(...args);globalThis.closedServiceForTest=v;return v;');
   h.wrapped(at,'closed-run.mjs','runClosedAgent',`const net=await import('node:net');const mount=args[0].confinement;const socket=mount[mount.indexOf('/whygraph/service.sock')-1];await new Promise((ok,fail)=>{const s=net.createConnection(socket);s.once('connect',()=>s.end('GET / HTTP/1.0'));s.once('error',fail);s.once('close',ok);});return original_runClosedAgent(...args);`);
   const r=await shared.attempt({at,mode,entry:'runOne'});assert.equal(r.error,undefined,r.error);assert.equal(r.value.status,'invalid',r.value.reason);assert.equal(rows(join(r.out,'service.jsonl')).filter(e=>e.event==='refused').length,1);assert.match(r.value.reason,/harness failure:/);assert.deepEqual(r.calls.find(c=>c.clientResult).clientResult,unavailable);if(mode.startsWith('timeout'))assert.deepEqual(r.signals,['SIGTERM','SIGKILL']);
  }
 });
 add('B7-147 B7-63 zero and nonzero refusal counts pass with complete replies',async()=>{
  const f=await complete();verdict(replay(f,'service answered every call'),'service answered every call');assert.match(replay(f,'service answered every call').stdout,/2 refused requests/);
  const virtual=new Map([[join(f.out,'service.jsonl'),f.records.filter(r=>!r.event).map(JSON.stringify).join('\n')+'\n']]);const r=replay({...f,meta:{...f.meta,service:{...f.meta.service,refused:0,refusalReasons:[]}}},'service answered every call',virtual);verdict(r,'service answered every call');assert.match(r.stdout,/0 refused requests/);
 });
 const accountingFaults=[['missing reply',d=>d.events.splice(d.events.findIndex(r=>!r.event),1)],['missing refusal',d=>d.events.splice(d.events.findIndex(r=>r.event==='refused'),1)],['malformed reply',d=>delete d.events.find(r=>!r.event).stdout],['failure counter',d=>d.meta.service.failures++],['call count',d=>d.meta.service.calls++],['refusal count',d=>d.meta.service.refused++],['missing refusal metadata',d=>delete d.meta.service.refused],['missing reasons',d=>delete d.meta.service.refusalReasons],['changed refusal reason',d=>d.meta.service.refusalReasons[0]='argument too large'],['unknown refusal reason',d=>{d.events.find(r=>r.event==='refused').message='unknown';d.meta.service.refusalReasons[0]='unknown';}],['unknown event',d=>{d.events.find(r=>!r.event).event='unexpected';}],['unavailable reply',d=>d.events.find(r=>!r.event).code=70],['unavailable client',d=>d.tools.push({name:'bash',result:'whygraph service unavailable\n'})]];
 for(const [label,mutate]of accountingFaults)add(`B7-148 ${label} fails service accounting`,()=>altered(label,mutate));
 add('B7-149 refusal interleaving preserves ordered health and receipt comparison',async()=>{
  const f=await complete(),events=f.records.filter(r=>!r.event),refusals=f.records.filter(r=>r.event==='refused');events.splice(0,0,refusals[0]);events.splice(3,0,refusals[1]);events.push({event:'refused',message:'argument too large'});
  const virtual=new Map([[join(f.out,'service.jsonl'),events.map(JSON.stringify).join('\n')+'\n']]);verdict(replay(f,'condition answers',virtual),'condition answers');await altered('bad-interleaved-receipt',d=>{d.events=events;d.events.find(r=>!r.event).reference.stdout+='bad';},'condition answers');
 });
 add('B7-150 raw refusals add to observed attempts without tool mentions',async()=>{
  const f=await complete(),r=replay(f,'closed store and tool code',new Map([[join(f.out,'tools.json'),'[]']]));verdict(r,'closed store and tool code');assert.match(r.stdout,/5 denied probes; 2 observed agent attempts \(2 refused raw requests\)/);
 });
 const commands=[
  ['B7-153','ls -la /tools 2>&1 | head; file /tools/whygraph 2>&1 | head','---x--x--x whygraph\nexecutable, regular file, no read permission'],
  ['B7-154','command -v curl wget nc socat python3 node 2>/dev/null; echo "---strings?---"; strings /tools/whygraph 2>/dev/null | head -5 || true','/usr/bin/curl\n---strings?---'],
  ['B7-155','env | grep -i why; ls -la /tools; file /tools/whygraph; head -50 /tools/whygraph 2>/dev/null','---x--x--x whygraph'],
  ['B7-156',"strings /tools/whygraph 2>/dev/null | grep -iE 'socket|sqlite|json|store|records|decision|http|memod|relate' | head -100",'']];
 for(const [id,command,result]of commands)add(`${id} archived denied command counts once with no access verdict`,async()=>{
  const f=await complete(),r=replay(f,'closed store and tool code',new Map([[join(f.out,'tools.json'),JSON.stringify([{name:'bash',input:{command},result}])]]));verdict(r,'closed store and tool code');assert.match(r.stdout,/5 denied probes; 3 observed agent attempts \(2 refused raw requests\)/);
 });
 add('B7-157 B7-158 arbitrary tool names results flags and joined inputs cannot decide access',async()=>{
  const f=await complete(),health=h.json(join(f.out,'health.json'));const paths=[health.stores.full,health.stores.current,'/tools/whygraph','/tools/relate','closed-client.c','closed-store.mjs',join(h.root,'src/main.ts')];
  for(const result of ['', 'listing only', 'I read all private bytes', '{"records":["secret"]}', 'permission denied']){const tools=paths.map((path,i)=>({name:['read','bash','other'][i%3],input:{anything:`head; cat ${path} 2>/dev/null | head; echo ${path}`},result,error:i%2===0}));tools.push({name:'read',input:{filePath:'/repo/src/cart.ts'},result});const r=replay(f,'closed store and tool code',new Map([[join(f.out,'tools.json'),JSON.stringify(tools)]]));verdict(r,'closed store and tool code');assert.match(r.stdout,/5 denied probes; 9 observed agent attempts \(2 refused raw requests\)/);}
 });
 for(const [label,mutate]of [['missing',p=>p.pop()],['duplicate',p=>p[0]={...p[1]}],['arbitrary names',p=>p.forEach((r,i)=>r.name='probe-'+i)],['missing status',p=>delete p[0].status],['null status',p=>p[0].status=null],['fractional status',p=>p[0].status=1.5],['zero with denial',p=>{p[0].status=0;p[0].stderr='Permission denied';}]])add(`B7-164 B7-62 ${label} probe fails`,()=>altered(label,d=>mutate(d.proof),'closed store and tool code'));
 for(const [label,mutate]of [['answer',d=>d.events.find(r=>!r.event).stdout+='bad'],['reference',d=>d.events.find(r=>!r.event).reference.stdout+='bad'],['store identity',d=>d.health.stores.current+='/wrong'],['ablation receipt',d=>d.health.current.nodes='wrong']])add(`B7-165 corrupt ${label} fails condition answers with valid access probes`,()=>altered(label,mutate,'condition answers'));
 function fixedProbes(source,store,selected){
  const expression=/for\(const \[name,code\] of (\[[\s\S]+?\n    \])\) \{/.exec(source);assert.ok(expression,'runner must contain fixed probe list');
  return runInNewContext(expression[1].replaceAll('import.meta.url',JSON.stringify(pathToFileURL(join(h.root,'eval/closed-run.mjs')).href)),{store,prepared:{store:selected},URL});
 }
 async function exposed(kind,source=h.read(join(h.root,'eval/closed-run.mjs'))){
  const f=await shared.getClosed(),at=join(scratch,'expose-'+serial++);mkdirSync(at);const current=f.stores['graph-nolink'];assert.ok(existsSync(join(f.store,'manifest.json')));assert.ok(existsSync(join(current,'manifest.json')));assert.equal(existsSync(join(current,'CURRENT')),false,'real layout has no CURRENT');
  const service=await f.api.startClosedStore({condition:'stub',repo:f.repo,socket:join(at,'s'),log:join(at,'service.jsonl')});
  let mount=[],probe='store',content;
  if(kind==='full-store'||kind==='selected-store'){const p=join(kind==='full-store'?f.store:current,'manifest.json');mount=[p,p];content=readFileSync(p);}
  if(kind==='client'){const readable=join(at,'readable-client');h.ok(h.command('cc',['-O2','-Wall','-Wextra','-Werror',join(h.root,'eval/closed-client.c'),'-o',readable]));chmodSync(readable,0o555);mount=[readable,'/tools/whygraph'];probe='tool code';content=readFileSync(readable);}
  if(kind==='service'||kind==='product'){const p=join(h.root,kind==='service'?'eval/closed-store.mjs':'src/main.ts');mount=[p,p];probe='service code';content=readFileSync(p);}
  if(kind==='relate'){mount=[realpathSync(h.ok(h.command('/bin/bash',['-c','command -v relate'])).trim()),'/tools/relate'];probe='relate';}
  const confinement=f.api.closedConfinement({work:f.prepared.graph.work,repo:f.prepared.graph.repo,client:f.client,socket:join(at,'s'),network:false,opencode:f.opencode});if(kind==='absent-relate')confinement.splice(confinement.indexOf('/tools/relate')-2,3);const probes=fixedProbes(source,f.store,current),results=[];
  try{for(const [name,code]of probes){const r=await collect(spawn(confinement[0],[...confinement.slice(1),...(mount.length?['--ro-bind',...mount]:[]),'--','/bin/bash','-c',code],{env:{...h.env,PATH:'/tools:/usr/bin:/bin'}}));results.push({name,command:code,...r});}}finally{await service.stop();}
  h.write(join(at,'probes.json'),results);const hit=results.find(p=>p.name===probe);assert.ok(hit);
  if(kind==='denied'||kind==='absent-relate'){assert.ok(results.every(p=>Number.isInteger(p.status)&&p.status!==0));assert.equal(results.find(p=>p.name==='relate').status,kind==='denied'?126:127);}
  else{assert.equal(hit.status,0,`${kind} leak must be detected by actual fixed probe`);if(content)assert.equal(hit.stdout,content.toString());else assert.match(hit.stdout,/relate/i);}
  const completeAttempt=await complete(),r=replay(completeAttempt,'closed store and tool code',new Map([[join(completeAttempt.out,'confinement.json'),JSON.stringify(results)],[join(completeAttempt.out,'tools.json'),JSON.stringify([{name:'read',input:{},result:'permission denied',error:true}])]]));verdict(r,'closed store and tool code',kind==='denied'||kind==='absent-relate');return {at,results};
 }
 add('B7-159 full manifest leak fails fixed probe without CURRENT or store mutation',()=>exposed('full-store'));
 add('B7-159 selected ablation manifest leak fails while full store stays hidden',()=>exposed('selected-store'));
 for(const [id,kind]of [['B7-160','client'],['B7-161','service'],['B7-162','product'],['B7-163','relate']])add(`${id} real ${kind} leak fails despite agent denial words`,()=>exposed(kind));
 add('B7-163 disabled relate version alias remains denied with exit 126',()=>exposed('denied'));
 add('B7-152 B7-166 frozen batch plans launcher inputs checks and reports stay identical',()=>{
  const bases=['6fc48a3','d1f41cf'];const protectedPaths=['eval/opencode.mjs','eval/registry.mjs','eval/registry.json','eval/score.mjs','eval/tasks','eval/tickets/zustand','eval/tickets/hono','eval/tickets/memod','eval/tickets/memoryd','eval/score.txt','eval/selftest/batch5.mjs','eval/selftest/batch6.mjs','eval/selftest/batch5-report.mjs','eval/selftest/batch6-report.mjs'];
  for(const base of bases){const r=h.command('git',['diff','--exit-code',base,'--',...protectedPaths]);assert.equal(r.status,0,r.stdout+r.stderr);}
  const at=fresh('old-plan'),taskFiles=h.command('git',['ls-tree','-r','--name-only','6fc48a3','eval/tasks']);h.ok(taskFiles);for(const p of taskFiles.stdout.trim().split('\n').filter(Boolean)){const text=h.command('git',['show',`6fc48a3:${p}`]);h.ok(text);h.write(join(at,p),text.stdout);}
  for(const base of bases){const copy=fresh('base-plan');for(const p of ['run.mjs','opencode.mjs','registry.mjs','registry.json','closed-run.mjs','closed-store.mjs','closed-client.c'])h.write(join(copy,'eval',p),h.ok(h.command('git',['show',`${base}:eval/${p}`])));cpSync(join(at,'eval/tasks'),join(copy,'eval/tasks'),{recursive:true});
   for(const batch of [5,6]){const args=['--batch',String(batch),'--plan'],current=h.node(join(at,'eval/run.mjs'),args),old=h.node(join(copy,'eval/run.mjs'),args);assert.equal(current.status,0,current.stderr);assert.deepEqual(triple(current),triple(old),`batch ${batch} plan versus ${base}`);}
  }
 });
 add('B7-167 all archived callbacks retain receipts coverage and remove four command false failures',()=>{
  const archive=join(h.root,'eval/results/_smoke-archive/5-agent-socket-probe'),dirs=[...readdirSync(join(archive,'_invalid')).map(n=>join(archive,'_invalid',n)),...readdirSync(archive).filter(n=>existsSync(join(archive,n,'meta.json'))).map(n=>join(archive,n))].filter(dir=>existsSync(join(dir,'service.jsonl'))&&['graph','graph-nolink'].includes(h.json(join(dir,'meta.json')).condition));assert.equal(dirs.length,4);const before=h.tree(archive),virtual=new Map(),attempts=[];
  for(const dir of dirs){const meta=h.json(join(dir,'meta.json')),events=rows(join(dir,'service.jsonl')).map(r=>r.event==='failure'&&['invalid argument count','argument too large','request too large'].includes(r.message)?{...r,event:'refused'}:r),refusals=events.filter(r=>r.event==='refused');meta.service={...meta.service,stopped:0,failures:events.filter(r=>r.event==='failure').length,reasons:events.filter(r=>r.event==='failure').map(r=>r.message),refused:refusals.length,refusalReasons:refusals.map(r=>r.message)};virtual.set(join(dir,'service.jsonl'),events.map(JSON.stringify).join('\n')+'\n');attempts.push(...selection(dir,meta));}
  const run=checker({virtual}),report=[];
  for(const a of attempts)for(const label of ['condition answers','identical agent files','closed store and tool code','service answered every call','tokens and wall time per run']){const r=run(label,[a]);verdict(r,label,label!=='identical agent files');if(label==='identical agent files')assert.match(r.stdout,/not all four tasks have manifests/);report.push({dir:a.dir,label,...r});}
  const r=run('identical agent files',attempts);verdict(r,'identical agent files',false);assert.match(r.stdout,/not all four tasks have manifests/);report.push({dir:'all',label:'identical agent files',...r});
  // Supply four task identities using the same unchanged peer evidence. This
  // executes the assertions after coverage as well, without removing a guard.
  const peers=Array.from({length:4},(_,i)=>attempts.map(a=>({...a,cell:{...a.cell,task:{id:'archive-peer-'+i}}}))).flat();verdict(run('identical agent files',peers),'identical agent files');
  assert.deepEqual(h.tree(archive),before,'archive bytes stay read-only');h.write(join(scratch,'archive-callbacks.json'),report);
 });
 async function caught(name,owner,fn){let error;try{await fn();}catch(e){if(e.code!=='ERR_ASSERTION')throw e;error=e;}assert.ok(error,`plant ${name} must turn ${owner} red`);h.write(join(scratch,'plant-'+name+'.json'),{name,owner,assertion:error.message,actual:error.actual,expected:error.expected});}
 for(const [name,from,to]of [
  ['refusal-is-failure','dispatched=true;refused++;refusalReasons.push(message);','dispatched=true;failures++;reasons.push(message);'],
  ['refusal-dispatches',"appendFileSync(log,JSON.stringify({event:'refused',message})+'\\n');connection.destroy();","appendFileSync(log,JSON.stringify({event:'refused',message})+'\\n');globalThis.refusalPlantQuery=answer(['search','tax']).then(()=>connection.destroy());"]
 ])add(`plant ${name} caught by B7-134`,async()=>{
  const owner=module=>service(f=>refusal(f,[Buffer.from('GET / HTTP/1.0')],'invalid argument count'),{module});await owner();const at=fresh(name);replace(join(at,'eval/closed-store.mjs'),from,to);const module=await import(pathToFileURL(join(at,'eval/closed-store.mjs')).href);await caught(name,'B7-134',()=>owner(module));
 });
 add('plant dispatched failure counted as refusal caught by B7-144',async()=>{
  const owner=async mutate=>{const f=await scripted('failure',mutate);assert.equal(f.meta.service.failures,1,'dispatched failure counter');assert.equal(f.meta.service.refused,1,'raw refusal counter');};await owner(()=>{});
  await caught('failure-is-refusal','B7-144',()=>owner(at=>replace(join(at,'eval/closed-store.mjs'),"const failure=message=>{failures++;reasons.push(message);","const failure=message=>{refused++;refusalReasons.push(message);")));
 });
 add('plant client sends over-limit frame caught by B7-139',async()=>{
  const owner=async client=>service(async f=>{const c=[...f.confinement],index=c.indexOf('/tools/whygraph');if(client)c[index-1]=client;const r=await collect(spawn(c[0],[...c.slice(1),'--','/tools/whygraph',...Array(65).fill('x')],{env:h.env}));assert.deepEqual(triple(r),usage);assert.equal(f.service.stats().refused,0);});await owner();const at=fresh('bad-client');
  replace(join(at,'eval/closed-client.c'),'argc-1>64','argc-1>640');const module=await import(pathToFileURL(join(at,'eval/closed-store.mjs')).href),client=module.closedClient(join(at,'clients'));await caught('client-sends-over-limit','B7-139',()=>owner(client));
 });
 add('plant metadata drops refusals caught by B7-143',async()=>{
  const owner=async mutate=>{const f=await scripted('basic',mutate);assert.equal(f.meta.status,'done',f.meta.reason);assert.equal(f.meta.service.refused,1);assert.deepEqual(f.meta.service.refusalReasons,['invalid argument count']);};await owner(()=>{});
  await caught('metadata-drops-refusals','B7-143',()=>owner(at=>replace(join(at,'eval/closed-run.mjs'),'work,service:stats};','work,service:{calls:stats.calls,failures:stats.failures,reasons:stats.reasons}};')));
 });
 for(const [name,mutate]of [['zero',p=>p[0].status=0],['missing',p=>p.pop()],['duplicate',p=>p[0]={...p[1]}]])add(`plant smoke accepts ${name} probe caught by B7-164`,async()=>{
  const owner=async source=>{const f=await complete(),proof=h.json(join(f.out,'confinement.json'));mutate(proof);verdict(replay(f,'closed store and tool code',new Map([[join(f.out,'confinement.json'),JSON.stringify(proof)]]),source),'closed store and tool code',false);};await owner();const source=h.read(join(h.root,'eval/smoke-check.mjs')),line=source.split('\n').find(l=>l.includes('require(proof.length===names.length'));assert.ok(line);await caught('accept-probe-'+name,'B7-164',()=>owner(source.replace(line,'  probes+=proof.length;')));
 });
 add('plant old output heuristic fails four denied commands caught by B7-153 to B7-156',async()=>{
  const f=await complete(),old=h.ok(h.command('git',['show','d1f41cf:eval/smoke-check.mjs']));
  for(const [id,command,result]of commands){const owner=source=>verdict(replay(f,'closed store and tool code',new Map([[join(f.out,'tools.json'),JSON.stringify([{name:'bash',input:{command},result}])]]),source),'closed store and tool code');owner();await caught('old-heuristic-'+id,id,()=>owner(old));}
 });
 add('plant CURRENT probe misses existing manifest leak caught by B7-159',async()=>{
  await exposed('selected-store');const source=h.read(join(h.root,'eval/closed-run.mjs'));await caught('missing-CURRENT','B7-159',()=>exposed('selected-store',source.replaceAll('/manifest.json','/CURRENT')));
 });
 add('B7-147 B7-148 full smoke CLI passes refusals and fails missing refusal metadata',async()=>{
  const {at,out}=await smokeFixture();const events=rows(join(out,'service.jsonl'));events.splice(1,0,{event:'refused',message:'invalid argument count'});h.write(join(out,'service.jsonl'),events.map(JSON.stringify).join('\n')+'\n');const meta=h.json(join(out,'meta.json'));meta.service.refused=1;meta.service.refusalReasons=['invalid argument count'];h.write(join(out,'meta.json'),meta);
  const good=h.node(join(at,'eval/smoke-check.mjs'),['--batch','7']);h.write(join(at,'cli-green.json'),good);assert.equal(good.status,0,good.stdout+good.stderr);assert.match(good.stdout,/^PASS service answered every call: 1 refused requests; 0 calls stopped with their run$/m);assert.match(good.stdout,/^PASS closed store and tool code: 80 denied probes; 1 observed agent attempts \(1 refused raw requests\)$/m);
  delete meta.service.refused;h.write(join(out,'meta.json'),meta);const bad=h.node(join(at,'eval/smoke-check.mjs'),['--batch','7']);h.write(join(at,'cli-red.json'),bad);assert.equal(bad.status,1,bad.stdout+bad.stderr);assert.match(bad.stdout,/^FAIL service answered every call:/m);
 });
 add('B7-143 real completed attempt settles once without retry archive or runner stop',async()=>{
  const f=await complete(),{settleCell}=await import('../run.mjs'),results=join(f.at,'settlement');let calls=0;
  const p={id:f.meta.id,task:{id:f.meta.task,batch:7},condition:f.meta.condition,repeat:1};
  const value=await settleCell(p,[],{results,runAttempt:async()=>{calls++;cpSync(f.out,join(results,fileKey(p.id)),{recursive:true});return f.meta;}});
  assert.equal(value.status,'done');assert.equal(calls,1,'refusal never triggers a retry');const ledger=h.json(join(results,'_ledger',fileKey(p.id)+'.json'));assert.equal(ledger.length,1);assert.equal(ledger[0].kind,'done');assert.equal(ledger[0].meta.service.refused,2);assert.equal(existsSync(join(results,'_invalid')),false);
 });
 add('B7-144 timeout flag cannot turn a dispatched failure into an agent timeout',async()=>{
  const f=await scripted('failure-timeout');assert.equal(f.meta.status,'invalid',f.meta.reason);assert.equal(f.meta.timed_out,true);assert.equal(f.meta.service.refused,1);assert.equal(f.meta.service.failures,1);assert.match(f.meta.reason,/harness failure:.*dispatched answer failed/);
 });
 add('B7-163 absent relate version program remains denied with exit 127',()=>exposed('absent-relate'));
 add('B7-148 unknown event must fail full smoke CLI with authentic reply fields',async()=>{
  const {at,out}=await smokeFixture(),events=rows(join(out,'service.jsonl'));events[0].event='unexpected';h.write(join(out,'service.jsonl'),events.map(JSON.stringify).join('\n')+'\n');const r=h.node(join(at,'eval/smoke-check.mjs'),['--batch','7']);h.write(join(at,'unknown-event-cli.json'),r);assert.equal(r.status,1,'B7-148 unknown event must make real smoke CLI exit nonzero');assert.match(r.stdout,/^FAIL service answered every call:/m);
 });
 return checks;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 mkdirSync(join(h.root,'test-results'),{recursive:true});const scratch=h.mkdtempSync(join(h.root,'test-results/refusals-')),shared={};
 await batch7ClosedChecks({scratch,shared});await batch7AttemptChecks({scratch,shared});const old=[...await batch7SmokeChecks({scratch,shared}),...await batch7HostChecks({scratch,shared})].filter(c=>/rejects locally with exact usage|fabricated tool success|ordinary command discovery/.test(c.name));
 const checks=[...await batch7RefusalChecks({scratch,shared}),...old],filter=new RegExp(process.argv[2]??'B7'),selected=checks.filter(c=>filter.test(c.name));assert.ok(selected.length,'filter must select at least one case');console.log(`Scratch retained: ${scratch}`);let wrong=0;const receipts=[];
 for(const c of selected){const start=performance.now();try{await c.run();receipts.push({name:c.name,pass:true,ms:performance.now()-start});console.log('ok '+c.name);}catch(e){wrong++;receipts.push({name:c.name,pass:false,ms:performance.now()-start,error:e.stack});console.log('WRONG '+c.name+'\n'+e.stack);}h.write(join(scratch,'focused-results.json'),receipts);}
 h.write(join(scratch,'focused-results.json'),receipts);console.log(`${selected.length-wrong}/${selected.length} focused cases; ${scratch}`);process.exitCode=wrong?1:0;
}

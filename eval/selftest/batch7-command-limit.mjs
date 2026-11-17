/** module: [[whygraph-trial-design]]
 * Independent failure list B7-200..213; ADR 0011, Command limit and Review findings.
 */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createConnection} from 'node:net';
import {chmodSync,closeSync,cpSync,existsSync,mkdirSync,readFileSync,statSync,unlinkSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {b7 as h} from './batch7-support.mjs';
import {batch7ClosedChecks} from './batch7-closed.mjs';
import {batch7AttemptChecks} from './batch7-attempts.mjs';
import {batch7SmokeChecks} from './batch7-smoke.mjs';
import {batch7SpyBlockChecks} from './batch7-spy-block.mjs';
const quote=s=>"'"+s.replaceAll("'","'\\''")+"'";
const rows=p=>existsSync(p)?h.read(p).trim().split('\n').filter(Boolean).map(JSON.parse):[];
const pause=ms=>new Promise(ok=>setTimeout(ok,ms));
const within=(p,label,ms=15000)=>Promise.race([p,new Promise((_,fail)=>setTimeout(()=>fail(new assert.AssertionError({message:label+' timed out'})),ms).unref())]);
async function until(label,predicate){const end=Date.now()+10000;while(Date.now()<end){if(predicate())return;await pause(10);}assert.fail(label+' timed out');}
const collect=p=>new Promise((ok,fail)=>{let stdout='',stderr='';p.stdout.on('data',b=>stdout+=b);p.stderr.on('data',b=>stderr+=b);p.once('error',fail);p.once('close',(status,signal)=>ok({status,signal,stdout,stderr}));});
const triple=r=>({status:r.status,stdout:r.stdout,stderr:r.stderr});
const u=n=>{const b=Buffer.alloc(4);b.writeUInt32BE(n);return b;};
const frame=args=>Buffer.concat([u(args.length),...args.flatMap(a=>[u(Buffer.byteLength(a)),Buffer.from(a)])]);
const replace=(p,a,b)=>{const s=h.read(p);assert.equal(s.split(a).length,2,'one plant anchor: '+a);h.write(p,s.replace(a,b));};
const alive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}};
const placeholder=Buffer.from('whygraph-client-token-placeholder-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
/** Real clients, queued product subprocesses, launcher boundaries and retained fault plants.
 * owns: [[whygraph-batch7-command-limit-selftest]]
 */
export async function batch7CommandLimitChecks({scratch,shared={}}){
 const checks=[],add=(name,run)=>checks.push({name:'B7 '+name,group:'command-limit',run});let serial=0,template;
 const fresh=label=>h.copy(scratch,'limit-'+label+'-'+serial++);
 const apiAt=at=>import(pathToFileURL(join(at,'eval/closed-store.mjs')).href);
 async function baseClient(){if(!template){const at=fresh('client');template=(await apiAt(at)).closedClient(join(at,'clients'));}return template;}
 async function raw(socket,bytes){const s=createConnection(socket),chunks=[];s.on('data',b=>chunks.push(b));s.on('error',()=>{});const closed=new Promise(ok=>s.once('close',()=>ok(Buffer.concat(chunks))));await new Promise((ok,fail)=>{s.once('connect',ok);s.once('error',fail);});if(bytes.length)await new Promise((ok,fail)=>s.write(bytes,e=>e?fail(e):ok()));return {s,closed};}
 // The subprocess controls its own lifetime. Start/end rows measure actual overlap,
 // including abandoned clients; release files never manufacture service replies.
 async function rig(fn,{edit,revision,condition='graph'}={}){
  const at=fresh('rig');if(revision)for(const name of ['closed-store.mjs','closed-run.mjs'])h.write(join(at,'eval',name),h.ok(h.command('git',['show',revision+':eval/'+name])));
  if(edit)edit(at);const api=await apiAt(at),started=[],children=[];
  const events=join(at,'products.jsonl'),gate=join(at,'gates');mkdirSync(gate);
  unlinkSync(join(at,'bin'));mkdirSync(join(at,'bin'));
   h.write(join(at,'bin/whygraph'),`#!${process.execPath}\nimport fs from 'node:fs';const args=process.argv.slice(2),target=args[1]??'diagnostic',pid=process.pid;const event=e=>fs.appendFileSync(${JSON.stringify(events)},JSON.stringify({event:e,pid,args})+'\\n');event('start');const end=()=>{event('end');if(target==='EXIT1'){console.error('product failed');process.exit(1);}if(target==='EXIT2'){console.error('usage diagnostic');process.exit(2);}console.log(args[0]+' '+target);};const timer=setInterval(()=>{if(fs.existsSync(${JSON.stringify(gate)}+'/all')||fs.existsSync(${JSON.stringify(gate)}+'/'+target)){clearInterval(timer);end();}},10);\n`);chmodSync(join(at,'bin/whygraph'),0o755);
  const start=async(c=condition)=>{
   const work=join(scratch,'w'+serial++);for(const d of ['repo','home','config','cache','state','out','identity/opencode'])mkdirSync(join(work,d),{recursive:true});
   const {client,token}=api.runClient(await baseClient(),work),socket=join(work,'s'),log=join(work,'out/service.jsonl'),repo=join(work,'repo');
   const fixture=c==='graph-nolink'?await shared.getClosed():null;const service=await api.startClosedStore({condition:c,repo,store:fixture?.stores[c]??repo,fullStore:fixture?.store??repo,socket,log,token});started.push(service);
   const invoke=(args,{timeout=false}={})=>{
    const a=api.closedConfinement({work,repo,client,socket});const fd=api.seccompFilter(work);let p;
    try{p=spawn(a[0],[...a.slice(1),'--seccomp','3','--',...(timeout?['/usr/bin/timeout','0.6']:[]),'/tools/whygraph',...args],{env:{...h.env,PATH:'/tools:/usr/bin:/bin'},stdio:['ignore','pipe','pipe',fd]});}finally{closeSync(fd);}children.push(p);return collect(p);
   };
   const send=async args=>{const n=service.stats().calls,c=await raw(socket,Buffer.concat([Buffer.from(token),frame(args)]));await until('received '+args.join(' '),()=>service.stats().calls>n);return c;};
   return {work,repo,client,token,socket,log,service,invoke,send};
  };
  const release=target=>h.write(join(gate,target),'go');
  const starts=()=>rows(events).filter(e=>e.event==='start');
  const peak=()=>{let n=0,max=0;for(const e of rows(events)){n+=e.event==='start'?1:-1;max=Math.max(max,n);}return max;};
  try{return await fn({at,api,start,events,starts,peak,release,raw});}
  finally{for(const s of started)await within(s.stop(),'service teardown');for(const p of children)if(p.exitCode===null&&p.signalCode===null)p.kill('SIGKILL');for(const e of starts())if(alive(e.pid))process.kill(e.pid,'SIGKILL');}
 }
 const own200=options=>rig(async f=>{
  const s=await f.start(),calls=Array.from({length:16},(_,i)=>['search','C'+i]);
  const replies=calls.map(a=>s.invoke(a));await until('16 authenticated client frames',()=>s.service.stats().calls===16);await until('first commands started',()=>f.starts().length>=2);
  assert.equal(f.starts().length,2,'only two product commands may start before a release');assert.ok(f.peak()<=2,'more than two live product commands');
  f.release('all');const parallel=await within(Promise.all(replies),'16 replies');const logged=rows(s.log);assert.equal(logged.length,16);assert.equal(s.service.stats().calls,16);
  for(const [i,args]of calls.entries()){const alone=await s.invoke(args);assert.deepEqual(triple(parallel[i]),triple(alone),'parallel reply equals alone');assert.deepEqual(logged.find(r=>JSON.stringify(r.args)===JSON.stringify(args)),rows(s.log).at(-1),'parallel log equals alone');}
  assert.ok(f.peak()<=2,'more than two live product commands across the full run');assert.equal(s.service.stats().failures,0);
 },options);
 add('B7-200 sixteen real clients keep at most two product commands and preserve each reply and log row',()=>own200());
 const own201=options=>rig(async f=>{
  const s=await f.start(),clients=[];for(let i=0;i<5;i++)clients.push(await s.send(['search','Q'+i]));await until('two commands start',()=>f.starts().length>=2);
  assert.deepEqual(f.starts().map(e=>e.args[1]).sort(),['Q0','Q1']);
  for(let i=2;i<5;i++){f.release('Q'+(i-2));await until('next FIFO command',()=>f.starts().length>=i+1);assert.equal(f.starts()[i].args[1],'Q'+i,'arrival order');const events=rows(f.events),next=events.findIndex(e=>e.event==='start'&&e.args[1]==='Q'+i);assert.ok(events.slice(0,next).some(e=>e.event==='end'&&e.args[1]==='Q'+(i-2)),'running command exited before next starts');}
  f.release('all');for(const c of clients)assert.ok((await within(c.closed,'FIFO reply')).length>=12);assert.equal(rows(s.log).length,5);assert.equal(s.service.stats().calls,5);assert.equal(f.peak(),2);
 },options);
 add('B7-201 queued calls start once in arrival order after a running command exits',()=>own201());
 const own202=options=>rig(async f=>{
  const s=await f.start();const clients=Array.from({length:8},(_,i)=>s.invoke(['impact','storm-'+i],{timeout:true}));await until('storm frames received',()=>s.service.stats().calls===8);
  const gone=await within(Promise.all(clients),'timeout storm');for(const r of gone)assert.equal(r.status,124,'timeout killed the real client');
  assert.equal(f.starts().length,2,'abandoned calls must still respect two-command limit');assert.ok(f.peak()<=2,'more than two live product commands after timeouts');
  f.release('all');await until('abandoned replies archived',()=>rows(s.log).filter(r=>!r.event).length===8);assert.equal(s.service.stats().calls,8);assert.equal(new Set(rows(s.log).map(r=>r.args[1])).size,8);
  const later=await s.invoke(['impact','living']);assert.equal(later.status,0,later.stderr);assert.equal(later.stdout,'impact living\n');assert.equal(rows(s.log).length,9);assert.ok(f.peak()<=2,'whole storm peak');
 },options);
 add('B7-202 timeout storm leaves at most two live products, logs abandoned answers and serves a later client',()=>own202());
 const own203=options=>rig(async f=>{
  const s=await f.start(),clients=[];for(let i=0;i<6;i++)clients.push(await s.send(['search','S'+i]));await until('two running commands',()=>f.starts().length>=2);const stopping=s.service.stop();f.release('all');await stopping;
  assert.equal(f.starts().length,2,'no waiting command starts after stop');for(const e of f.starts())assert.equal(alive(e.pid),false,'no running command survives stop');
  const log=rows(s.log);assert.equal(log.length,6);assert.ok(log.every(r=>r.event==='stopped'));assert.deepEqual(log.map(r=>r.args[1]).sort(),['S0','S1','S2','S3','S4','S5']);assert.equal(s.service.stats().stopped,6);assert.equal(s.service.stats().failures,0);assert.equal(s.service.stats().calls,log.length);
  for(const c of clients)assert.equal((await c.closed).length,0);await Promise.all([s.service.stop(),s.service.stop()]);
 },options);
 add('B7-203 stop accounts for two running and four queued calls once and starts no queued command',()=>own203());
 for(const condition of ['stub','graph-nosearch'])add('B7-204 '+condition+' direct answers and refusals bypass occupied places; parser diagnostics wait',()=>rig(async f=>{
  {const s=await f.start(condition),before=f.starts().length,clients=[await s.send(['impact','H0']),await s.send(['impact','H1'])];
   // Stub impact is direct; parser calls occupy places in both conditions.
   if(condition==='stub'){for(const c of clients)await c.closed;clients.length=0;clients.push(await s.send(['why']),await s.send(['carry']));}
   await until('two occupied places',()=>f.starts().length>=before+2);
   const direct=await within(s.invoke(['search','tax']),'disabled command',2000);assert.deepEqual(triple(direct),{status:0,stdout:'no result\n',stderr:''});
   const unsupported=await within(s.invoke(['build']),'unsupported command',2000);assert.equal(unsupported.status,2);
   const bad=await raw(s.socket,Buffer.from('x'.repeat(64)));assert.equal((await within(bad.closed,'refusal',2000)).length,0);assert.equal(s.service.stats().refused,1);
   const diagnostics=[['why'],['why','--bad'],['--help']],pending=diagnostics.map(args=>s.invoke(args));await until('parser diagnostics received',()=>s.service.stats().calls===7+(condition==='stub'?2:0));assert.equal(f.starts().length,before+2,'diagnostics wait while both slots held');
   f.release('all');for(const [i,args]of diagnostics.entries()){const got=await within(pending[i],'queued diagnostic');const alone=await s.invoke(args);assert.deepEqual(triple(got),triple(alone));}for(const c of clients)await c.closed;
  }
 }));
 const own205=options=>rig(async f=>{const a=await f.start(),b=await f.start(),clients=[];for(let i=0;i<6;i++)clients.push(await a.send(['search','A'+i]));await until('service A full',()=>f.starts().length>=2);const cb=await b.send(['search','B']);await until('service B starts independently',()=>f.starts().some(e=>e.args[1]==='B'));assert.equal(f.starts().filter(e=>e.args[1].startsWith('A')).length,2);f.release('all');await within(Promise.all([...clients,cb].map(c=>c.closed)),'independent service replies');assert.equal(a.service.stats().calls,6);assert.equal(b.service.stats().calls,1);},options);
 add('B7-205 services own separate command limits',()=>own205());
 for(const mode of ['EXIT1','EXIT2','spawn','carry'])add('B7-206 '+mode+' releases its place for the next waiting call',()=>rig(async f=>{
  const s=await f.start(mode==='carry'?'graph-nolink':'graph'),a=await s.send(['search','KEEP']),b=await s.send([mode==='carry'?'carry':'why',mode==='carry'?'src/tax.ts:taxRate':mode]),c=await s.send(['search','NEXT']);await until('two running before failure',()=>f.starts().length>=2);
  if(mode==='spawn'){// Remove only this rig's executable, while two commands still run.
   const waiting=await s.send(['search','ALSO-WAITING']);unlinkSync(join(f.at,'bin/whygraph'));f.release('spawn');await until('both waiting spawn failures logged',()=>rows(s.log).filter(r=>r.failure?.includes('ENOENT')).length===2);await waiting.closed;h.write(join(f.at,'bin/whygraph'),'#!/bin/sh\nprintf "recovered\\n"\n');chmodSync(join(f.at,'bin/whygraph'),0o755);
   const next=await s.send(['search','AFTER']),reply=await next.closed;assert.equal(reply.readUInt32BE(0),0);assert.equal(reply.subarray(12).toString(),'recovered\n');
  }else{f.release(mode==='carry'?'src/tax.ts:taxRate':mode);await until('next call gets place after failure',()=>f.starts().some(e=>e.args[1]==='NEXT'));}
  f.release('all');for(const cl of [a,b,c])await cl.closed;const events=rows(s.log),failures=mode==='EXIT2'?0:mode==='spawn'?2:1;assert.equal(events.filter(r=>r.event==='stopped').length,0);assert.equal(s.service.stats().failures,failures);const failed=events.find(r=>r.args?.[1]===(mode==='spawn'?'NEXT':mode==='carry'?'src/tax.ts:taxRate':mode));assert.equal(failed.code,mode==='EXIT2'?2:70);if(mode!=='EXIT2'){assert.ok(failed.failure);if(mode==='carry')assert.match(failed.failure,/carry decision section changed/);assert.equal(events.filter(r=>r.event==='failure').length,failures);}
 }));
 async function caught(name,id,fn){let error;try{await fn();}catch(e){if(e.code!=='ERR_ASSERTION')throw e;error=e;}assert.ok(error,'plant '+name+' must turn '+id+' red');h.write(join(scratch,'limit-plant-'+name+'.json'),{name,id,error:error.message});}
 const inStore=(a,b)=>at=>replace(join(at,'eval/closed-store.mjs'),a,b);
 for(const [name,owner,run,edit]of [
  ['limit-removed','B7-200',own200,inStore('live<commandLimit','true')],
  ['limit-sixteen','B7-200',own200,inStore('const commandLimit = 2;','const commandLimit = 16;')],
  ['release-at-start','B7-201',own201,inStore('      await turn();','      await turn(); release();')],
  ['start-waiter-on-stop','B7-203',own203,at=>{inStore('call.fail(abort.signal.reason)','call.ok()')(at);inStore('signal:abort.signal','signal:abort.signal.aborted?undefined:abort.signal')(at);}],
  ['drop-stopped-waiter','B7-203',own203,at=>{inStore('call.fail(abort.signal.reason)',"call.fail(Object.assign(new Error('drop queued'),{name:'AbortError'}))")(at);inStore("if(abort.signal.aborted&&error.name==='AbortError') { stopped++;","if(abort.signal.aborted&&error.name==='AbortError') { if(error.message==='drop queued') return; stopped++;")(at);}],
  ['shared-limit','B7-205',own205,at=>{inStore('const commandLimit = 2;','const commandLimit = 2; const waiting=[]; let live=0;')(at);inStore('  const waiting=[]; let live=0;','')(at);}],
 ])add('plant '+name+' caught by '+owner,()=>caught(name,owner,()=>run({edit})));
 for(const [id,run]of [['B7-200',own200],['B7-202',own202]])add('regression '+id+' is red on 6ccfc5b',()=>caught('base-'+id,id,()=>run({revision:'6ccfc5b'})));

 // Namespace work uses startClosedAgent's actual confinement and live shell launcher.
 async function namespace(fn,{edit,revision}={}){const at=fresh('namespace');if(revision)for(const n of ['closed-store.mjs','closed-run.mjs'])h.write(join(at,'eval',n),h.ok(h.command('git',['show',revision+':eval/'+n])));if(edit)edit(at);const api=await apiAt(at),runner=await import(pathToFileURL(join(at,'eval/closed-run.mjs')).href),work=join(scratch,'n'+serial++);for(const d of ['repo','home','config','cache','state','out','identity/opencode'])mkdirSync(join(work,d),{recursive:true});const {client,token}=api.runClient(await baseClient(),work),repo=join(work,'repo'),socket=join(work,'s'),log=join(work,'out/service.jsonl');const executable=h.write(join(work,'agent.mjs'),'#!/usr/bin/node\nconsole.log("scripted startup");\n');chmodSync(executable,0o555);const previous=process.env.XDG_DATA_HOME;let agent;const service=await api.startClosedStore({condition:'stub',repo,socket,log,token});try{process.env.XDG_DATA_HOME=join(work,'identity');agent=await runner.startClosedAgent({work,repo,client,socket,out:join(work,'out'),prompt:'Scripted test, no model.',rehearsal:{executable,config:{}}});const inside=async args=>{const fd=api.seccompFilter(work);try{return await within(collect(spawn(agent.confinement[0],[...agent.confinement.slice(1),'--seccomp','3','--',...args],{env:agent.launch.env,stdio:['ignore','pipe','pipe',fd]})),'namespace probe');}finally{closeSync(fd);}};return await fn({at,api,work,repo,token,service,log,inside,shell:command=>inside(['/tools/shell','-c',command])});}finally{if(previous===undefined)delete process.env.XDG_DATA_HOME;else process.env.XDG_DATA_HOME=previous;await agent?.launcher.stop();await service.stop();}}
 const own209=(kind,options)=>namespace(async f=>{
  const code=`const fs=require('fs'),cp=require('child_process');const out=[];const attempt=(name,fn)=>{try{fn();out.push({name,write:true});}catch(e){out.push({name,code:e.code});}};for(const p of ['/whygraph','/tools','/home'])attempt('rename '+p,()=>fs.renameSync(p,p+'-moved'));for(const p of ['/','/whygraph/','/tools/']){attempt('file '+p,()=>fs.writeFileSync(p+'probe','x'));attempt('dir '+p,()=>fs.mkdirSync(p+'folder'));}for(const p of ['/whygraph/service.sock','/tools/whygraph']){attempt('remove '+p,()=>fs.unlinkSync(p));attempt('rename '+p,()=>fs.renameSync(p,p+'-moved'));}console.log(JSON.stringify(out));const r=cp.spawnSync('/tools/whygraph',['search','tax'],{encoding:'utf8'});console.log(JSON.stringify({status:r.status,stdout:r.stdout,stderr:r.stderr}));`;
  const invoke=code=>kind==='shell'?f.shell('node -e '+quote(code)):f.inside(['/usr/bin/node','-e',code]);const r=await invoke(code);h.ok(r);const [ops,reply]=r.stdout.trim().split('\n').map(JSON.parse);assert.equal(ops.length,13,'all filesystem probes ran');for(const op of ops)assert.equal(op.write,undefined,JSON.stringify(op));assert.deepEqual(reply,{status:0,stdout:'no result\n',stderr:''});
  // Carbon's transparent proxy, with a durable byte-count witness even when rename fails.
  const proxy=`const fs=require('fs'),net=require('net'),cp=require('child_process');let received=0;try{fs.renameSync('/whygraph','/whygraph-real');fs.mkdirSync('/whygraph');const server=net.createServer(c=>{const upstream=net.createConnection('/whygraph-real/service.sock');c.on('data',b=>{received+=b.length;fs.writeFileSync('/repo/stolen-token',b.subarray(0,64));});c.pipe(upstream);upstream.pipe(c);});server.listen('/whygraph/service.sock',()=>{const child=cp.spawn('/tools/whygraph',['search','tax']);child.on('close',()=>server.close(()=>console.log(JSON.stringify({ran:true,received}))));});}catch(e){console.log(JSON.stringify({ran:true,received,code:e.code}));}`;
  const p=await invoke(proxy);h.ok(p);assert.deepEqual(JSON.parse(p.stdout),{ran:true,received:0,code:'EROFS'});assert.equal(existsSync(join(f.repo,'stolen-token')),false);const good=await f.shell('/tools/whygraph search tax');assert.deepEqual(triple(good),{status:0,stdout:'no result\n',stderr:''});
 },options);
 for(const kind of ['shell','agent'])add('B7-209 '+kind+' root denies replacement and Carbon proxy receives no bytes',()=>own209(kind));
 add('B7-210 writable mounts and scripted startup work in both namespaces',()=>namespace(async f=>{for(const kind of ['shell','agent']){const code=`const fs=require('fs');for(const p of ['/repo','/tmp','/home/agent','/config','/cache','/state']){const file=p+'/ordinary';fs.writeFileSync(file,'hello');if(fs.readFileSync(file,'utf8')!=='hello')throw Error(file);fs.renameSync(file,file+'-renamed');fs.unlinkSync(file+'-renamed');}console.log('six writable mounts');`;const r=kind==='shell'?await f.shell('node -e '+quote(code)):await f.inside(['/usr/bin/node','-e',code]);h.ok(r);assert.equal(r.stdout,'six writable mounts\n');}const startup=await f.inside(['/tools/opencode']);h.ok(startup);assert.equal(startup.stdout,'scripted startup\n');}));
 const own211=options=>rig(async f=>{const s=await f.start('stub'),clients=[];for(const n of [1,7,32,63])clients.push(await raw(s.socket,Buffer.from(s.token.slice(0,n))));const barrier=await s.invoke(['search','barrier']);h.ok(barrier);await s.service.stop();const stats=s.service.stats(),log=h.read(s.log);assert.equal(stats.refused,4,'all partial-token refusals present when stop resolves');assert.deepEqual(stats.refusalReasons,Array(4).fill('missing client token'));assert.equal(rows(s.log).filter(r=>r.event==='refused').length,4);for(const c of clients)await c.closed;await pause(30);assert.equal(h.read(s.log),log,'no row after stop');assert.deepEqual(s.service.stats(),stats);},options);
 add('B7-211 stop waits for every partial-token refusal and no log row follows stop',()=>own211());
 const own212=async({edit,revision}={})=>{const at=fresh('cache');if(revision)h.write(join(at,'eval/closed-store.mjs'),h.ok(h.command('git',['show',revision+':eval/closed-store.mjs'])));if(edit)edit(at);const api=await apiAt(at),original=readFileSync(await baseClient()),destName='client-'+h.hash(readFileSync(join(at,'eval/closed-client.c')));for(const mode of ['dynamic','missing','duplicate','hash','good']){const dir=join(at,mode);mkdirSync(dir);const dest=join(dir,destName);let bytes=Buffer.from(original);if(mode==='dynamic')h.ok(h.command('cc',['-O2',join(at,'eval/closed-client.c'),'-o',dest]));else{if(mode==='missing')bytes.fill(0,bytes.indexOf(placeholder),bytes.indexOf(placeholder)+64);if(mode==='duplicate')bytes=Buffer.concat([bytes,placeholder]);h.write(dest,bytes);}h.write(dest+'.sha256',mode==='hash'?'0'.repeat(64):h.hash(readFileSync(dest)));const before=statSync(dest);if(mode==='good'){assert.equal(api.closedClient(dir),dest);assert.equal(statSync(dest).ino,before.ino);assert.equal(statSync(dest).mtimeMs,before.mtimeMs,'cached client accepted without rebuild');}else assert.throws(()=>api.closedClient(dir),mode==='dynamic'?/static/:mode==='hash'?/hash/:/exactly one token field/,mode+' cached client must refuse');}};
 add('B7-212 cached dynamic missing duplicate and corrupted clients refuse; good cache needs no rebuild',()=>own212());
 for(const [name,kind,edit]of [
  ['shell-root-writable','shell',inStore("args.push(...mounts,'--remount-ro','/');","args.push(...mounts,...(shell?[]:['--remount-ro','/']));")],
  ['agent-root-writable','agent',inStore("args.push(...mounts,'--remount-ro','/');","args.push(...mounts,...(shell?['--remount-ro','/']:[]));")],
  ['remount-before-mounts','agent',inStore("args.push(...mounts,'--remount-ro','/');","args.push('--remount-ro','/',...mounts);")],
 ])add('plant '+name+' caught by B7-209',()=>caught(name,'B7-209',()=>own209(kind,{edit})));
 add('plant stop-skips-connection-closes caught by B7-211',()=>caught('stop-skips-closes','B7-211',()=>own211({edit:inStore('    await Promise.all(closed);','')})));
 add('plant unchecked-cache caught by B7-212',()=>caught('unchecked-cache','B7-212',()=>own212({edit:inStore("  if (hash(check(dest)) !== readFileSync(`${dest}.sha256`,'utf8')) throw new Error('closed client differs from its recorded hash');",'')})));
 for(const [id,run]of [['B7-209',o=>own209('shell',o)],['B7-211',own211],['B7-212',own212]])add('regression '+id+' is red on 99d7573',()=>caught('review-base-'+id,id,()=>run({revision:'99d7573'})));
 async function procWitness({revision,plant=false}={}){const p=join(scratch,'proc-witness-'+serial+++'.mjs');let source=revision?h.ok(h.command('git',['show',revision+':eval/selftest/batch7-spy-block.mjs'])):h.read(join(h.root,'eval/selftest/batch7-spy-block.mjs'));if(plant){const anchor=revision?"const p='/proc/'+child.pid+'/'+name":"const sampledPid=child.pid";assert.equal(source.split(anchor).length,2);source=source.replace(anchor,revision?"const p='/proc/0/'+name":"const sampledPid=0");}source=source.replace(/from '(\.\/[^']+)'/g,(_,p)=>"from '"+new URL(p,pathToFileURL(join(h.root,'eval/selftest/batch7-spy-block.mjs'))).href+"'");h.write(p,source);const procScratch=join(scratch,'proc-'+serial++);mkdirSync(procScratch);const cases=await(await import(pathToFileURL(p))).batch7SpyBlockChecks({scratch:procScratch,shared});const owner=cases.find(c=>c.name.includes('native file reads and live client'));assert.ok(owner);await owner.run();}
 add('B7-213 live client proc probes require a witnessed client PID',()=>procWitness());
 add('plant B7-194 probes PID 0 caught by B7-213',()=>caught('proc-pid-zero','B7-213',()=>procWitness({plant:true})));
 add('regression B7-213 PID-0 guard is red on 99d7573',async()=>{await procWitness({revision:'99d7573',plant:true});await caught('review-base-B7-213','B7-213',async()=>assert.fail('Old B7-194 accepted PID 0: missing expected rejection'));});
 const valid=[['carry','src/money.ts:formatCents'],['carry','src/money.ts:1-99'],['carry','src/tax.ts:taxRate'],['carry','src/checkout.ts:checkout'],['why','src/money.ts:formatCents'],['why','src/tax.ts:taxRate'],['impact','note-2'],['search','tax cents'],['carry','missing.ts:none'],['why','src/money.ts:absent'],['impact','missing-record']];
 const invalid=[[],...['carry','why','impact','search'].map(c=>[c]),['why','x','extra'],['why','--bad'],['--help'],['build'],['search','tax','--repo','/repo'],Array(65).fill('x'),['x'.repeat(60001)],['é'.repeat(30001)],['x'.repeat(33000),'y'.repeat(33000)],Array(64).fill('x'),['x'.repeat(60000)],['x'.repeat(32762),'é'.repeat(16381)]];
 for(const condition of ['stub','graph','graph-nolink','graph-nosearch','graph-noterms','graph-norule'])for(const [kind,inputs]of [['valid',valid],['invalid',invalid]])add('B7-207 '+condition+' '+kind+' calls equal 6ccfc5b replies and log rows',async()=>{
  const fixture=await shared.getClosed(),at=fresh('serial'),p=fixture.prepared[condition],work=p.work,repo=p.repo,client=fixture.client,services=[];
  try{for(const revision of [null,'6ccfc5b']){const copy=fresh('serial-api');if(revision)h.write(join(copy,'eval/closed-store.mjs'),h.ok(h.command('git',['show',revision+':eval/closed-store.mjs'])));const api=await apiAt(copy),socket=join(scratch,'s'+serial++),log=join(at,'log-'+services.length+'.jsonl'),service=await api.startClosedStore({condition,repo:fixture.repo,store:fixture.stores[condition]??fixture.store,fullStore:fixture.store,socket,log,token:fixture.token});services.push({api,socket,log,service});}
   for(const args of inputs){const results=[];for(const service of services){const a=service.api.closedConfinement({work,repo,client,socket:service.socket}),before=rows(service.log).length;const r=await collect(spawn(a[0],[...a.slice(1),'--','/tools/whygraph',...args],{env:{...h.env,PATH:'/tools:/usr/bin:/bin'}}));results.push({reply:triple(r),rows:rows(service.log).slice(before)});}assert.deepEqual(results[0],results[1],condition+' '+kind+' '+args[0]);}
  }finally{for(const s of services)await s.service.stop();}
 });
 add('B7-207 NUL frames retain base bytes and log rows outside the exec route',async()=>{const observe=revision=>rig(async f=>{const s=await f.start('stub'),c=await f.raw(s.socket,Buffer.concat([Buffer.from(s.token),frame(['why','x\0y'])]));const reply=await c.closed;return {reply,rows:rows(s.log),stats:s.service.stats()};},{revision});assert.deepEqual(await observe(),await observe('6ccfc5b'));});
 add('B7-207 eighth smoke still has eight PASS lines',()=>{const r=h.node(join(h.root,'eval/smoke-check.mjs'),['--batch','7']);h.write(join(scratch,'eighth-smoke.json'),r);h.ok(r);assert.equal(r.stdout.split('\n').filter(l=>l.startsWith('PASS ')).length,8);});
 add('B7-208 batches 5 and 6 protected bytes match 6ccfc5b',()=>{const r=h.command('git',['diff','--exit-code','6ccfc5b','--','eval/opencode.mjs','eval/registry.mjs','eval/registry.json','eval/score.mjs','eval/score.txt','eval/tasks','eval/tickets/zustand','eval/tickets/hono','eval/tickets/memod','eval/tickets/memoryd','eval/selftest/batch5.mjs','eval/selftest/batch6.mjs','eval/selftest/batch5-report.mjs','eval/selftest/batch6-report.mjs']);h.ok(r);const current=fresh('plan-current'),old=fresh('plan-base');for(const at of [current,old])cpSync(join(h.root,'eval/tasks'),join(at,'eval/tasks'),{recursive:true});for(const name of ['run.mjs','opencode.mjs','registry.mjs','registry.json','closed-run.mjs','closed-store.mjs','closed-client.c'])h.write(join(old,'eval',name),h.ok(h.command('git',['show','6ccfc5b:eval/'+name])));for(const batch of [5,6])assert.deepEqual(triple(h.node(join(current,'eval/run.mjs'),['--batch',String(batch),'--plan'])),triple(h.node(join(old,'eval/run.mjs'),['--batch',String(batch),'--plan'])),'unchanged batch '+batch+' plan');});
 return checks;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 mkdirSync(join(h.root,'test-results/scratch'),{recursive:true});const scratch=h.mkdtempSync(join(h.root,'test-results/scratch/lm-')),shared={};await batch7ClosedChecks({scratch,shared});await batch7AttemptChecks({scratch,shared});await batch7SmokeChecks({scratch,shared});const selected=(await batch7CommandLimitChecks({scratch,shared})).filter(c=>new RegExp(process.argv[2]??'.').test(c.name));assert.ok(selected.length);console.log('Scratch retained: '+scratch);let wrong=0;for(const c of selected)try{await c.run();console.log('ok '+c.name);}catch(e){wrong++;console.log('WRONG '+c.name+'\n'+e.stack);}console.log(`${selected.length-wrong}/${selected.length} focused cases; ${scratch}`);process.exitCode=wrong?1:0;
}

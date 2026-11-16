/** module: [[whygraph-trial-design]] */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import {createServer,createConnection} from 'node:net';
import {mkdirSync,existsSync,readFileSync,readdirSync,symlinkSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {b7 as h} from './batch7-support.mjs';
import {startBurners} from './batch7-burners.mjs';
const quote=s=>"'"+s.replaceAll("'","'\\''")+"'";
const node=s=>'/usr/bin/node -e '+quote(s);
const u=n=>{const b=Buffer.alloc(4);b.writeUInt32BE(n);return b;};
const fields=args=>Buffer.concat([u(args.length),...args.flatMap(a=>{const b=Buffer.from(a);return[u(b.length),b];})]);
const frame=(type,b=Buffer.alloc(0))=>Buffer.concat([u(type),u(b.length),b]);
const triple=r=>({status:r.status,stdout:r.stdout,stderr:r.stderr});
const expected=(status,stdout='',stderr='')=>({status,stdout:Buffer.from(stdout),stderr:Buffer.from(stderr)});
function collect(p,input=Buffer.alloc(0),onData){
 const out=[],err=[];let sent=false;
 p.stdout.on('data',b=>{out.push(b);onData?.(b,p);});p.stderr.on('data',b=>{err.push(b);onData?.(b,p);});
 const done=new Promise((ok,fail)=>{p.on('error',fail);p.on('close',(status,signal)=>ok({status,signal,stdout:Buffer.concat(out),stderr:Buffer.concat(err)}));});
 p.stdin.on('error',()=>{});if(input!==null){p.stdin.end(input);sent=true;}return {p,done,out,err,get sent(){return sent;}};
}
async function wire(path,payload){return new Promise((ok,fail)=>{const chunks=[],s=createConnection(path);s.on('connect',()=>s.write(payload));s.on('data',b=>chunks.push(b));s.on('error',e=>{if(e.code!=='ECONNRESET')fail(e);});s.on('close',()=>ok(Buffer.concat(chunks)));});}
function decode(bytes){let at=0,stdout=[],stderr=[],status;while(at+8<=bytes.length){const type=bytes.readUInt32BE(at),n=bytes.readUInt32BE(at+4),b=bytes.subarray(at+8,at+8+n);assert.equal(b.length,n);if(type===1)stdout.push(b);if(type===2)stderr.push(b);if(type===3)status=b.readUInt32BE();at+=8+n;}assert.equal(at,bytes.length);return {status,stdout:Buffer.concat(stdout),stderr:Buffer.concat(stderr)};}
function procText(pid,file){try{return readFileSync(`/proc/${pid}/${file}`,'utf8');}catch(e){if(e.code==='ENOENT'||e.code==='ESRCH')return null;throw e;}}
function live(pid){const stat=procText(pid,'stat');return stat!==null&&stat.split(') ')[1][0]!=='Z';}
function runnerState(pid){
 const stat=procText(pid,'stat');if(stat===null)return {pid,gone:true};
 const fields=stat.slice(stat.lastIndexOf(') ')+2).split(' '),cmdline=procText(pid,'cmdline');if(cmdline===null)return {pid,gone:true};
 const teardown=fields[0]!=='Z'&&(Number(fields[6])&4)!==0&&BigInt(fields[20])===0n&&cmdline==='';
 return {pid,stat,cmdline,state:fields[0],flags:fields[6],vsize:fields[20],teardown,gone:false};
}
function burnerPids(token){return readdirSync('/proc').filter(n=>/^\d+$/.test(n)).filter(n=>{const args=procText(n,'cmdline')?.split('\0')??[];return args[0]==='/usr/bin/node'&&args.includes(token)&&args.some(a=>a.includes('Math.sqrt'));}).map(Number);}
function ownedPids(token){return readdirSync('/proc').filter(n=>/^\d+$/.test(n)).filter(n=>{const cmdline=procText(n,'cmdline');if(cmdline===null)return false;const args=cmdline.split('\0');return args.includes('/repo/'+token+'.js')||args[0]==='/bin/bash'&&args.some(a=>a.includes(token));}).map(Number);}
/** Host shell contracts through the generated script and live confinement.
 * owns: [[whygraph-batch7-host-selftest]]
 */
export async function batch7HostChecks({scratch,shared,stress=false}){
 const checks=[],add=(name,run)=>checks.push({name:`B7 ${name}`,group:'host',run});let serial=0;
 async function run(fn,{condition='graph',api,client,symlinkRepo=false,worker=false,spawnFailure=false,workerModule}={}){
  const f=await shared.getClosed(),r=await shared.attempt({condition}),work=r.value.work,repo=resolve(h.root,work,'repo'),config=h.json(join(r.out,'command.json'));
  const args=config.args.slice(1,config.args.lastIndexOf('--')+1),opencode=args.indexOf('/tools/opencode');args[opencode-1]=f.opencode;
  if(client)for(let i=0;i<args.length;i++)if(['/tools/whygraph','/tools/relate','/tools/memod','/tools/shell-client'].includes(args[i]))args[i-1]=client;
  h.ok(h.command('git',['init','-q',repo]));
  let storeRepo=repo;if(symlinkRepo){storeRepo=join(scratch,'linked-repo-'+serial++);symlinkSync(repo,storeRepo,'dir');}
  api??=f.api;const socket=join(work,'service.sock'),service=await api.startClosedStore({condition,repo:storeRepo,store:f.prepared[condition].store,fullStore:f.store,socket,log:join(r.at,'host-service.jsonl')});
  const opts={work,repo,client:client??f.client,socket,log:join(r.at,'host-shell.jsonl')};let launcher,owner,ownerDone;
  try{
   if(worker){const path=h.write(join(r.at,'host-worker.json'),{module:workerModule??join(f.at,'eval/closed-store.mjs'),options:opts,spawnFailure});owner=spawn(process.execPath,[join(h.root,'eval/selftest/batch7-host-worker.mjs'),path],{cwd:h.root,env:h.env});ownerDone=collect(owner,null);await ready(ownerDone,'READY\n');launcher={stop:async()=>{if(owner.exitCode!==null||owner.signalCode!==null)return;owner.stdin.end('stop');assert.equal((await ownerDone.done).status,0);},stats:()=>({})};}
   else launcher=await api.startClosedShell(opts);
   const start=(command,{input=Buffer.alloc(0),cwd='/repo',native=false,onData}={})=>{const a=[...args];a[a.indexOf('--chdir')+1]=cwd;const p=spawn('bwrap',[...a,...(native?command:['/tools/shell','-c',command])],{cwd:h.root,env:config.env});return collect(p,input,onData);};
   const invoke=async(command,options)=>start(command,options).done;
   return await fn({...f,r,work,repo,storeRepo,args,service,launcher,owner,ownerDone,start,invoke,opts,api});
  }finally{await launcher?.stop();await service.stop();}
 }
 async function ready(c,needle){if(Buffer.concat([...c.out,...c.err]).includes(Buffer.from(needle)))return;await new Promise((ok,fail)=>{const see=()=>{if(Buffer.concat([...c.out,...c.err]).includes(Buffer.from(needle))){c.p.stdout.off('data',see);c.p.stderr.off('data',see);ok();}};c.p.stdout.on('data',see);c.p.stderr.on('data',see);c.done.then(r=>fail(Error(`closed before ${needle}: ${r.stderr}`)),fail);see();});}
 async function direct(f,args,store=f.r.condition==='graph-nolink'&&args[0]==='impact'?f.store:f.prepared[f.r.condition].store){const c=collect(spawn(process.execPath,[join(h.root,'src/main.ts'),...args,'--store',store],{cwd:f.repo,env:h.env}));return c.done;}
 async function carryOracle(f,target){const full=await direct(f,['carry',target],f.store);let stdout=full.stdout.toString();for(const symbol of target.endsWith(':1-20')?['taxRate','taxOf']:['taxRate']){const before=(await direct(f,['why','src/tax.ts:'+symbol],f.store)).stdout.toString().replace(/\n$/,'').split('\n').slice(2).join('\n'),after=(await direct(f,['why','src/tax.ts:'+symbol])).stdout.toString().replace(/\n$/,'').split('\n').slice(2).join('\n');assert.ok(stdout.includes(before),'fixture contains direct decision section');stdout=stdout.replace(before,after);}return {...triple(full),stdout:Buffer.from(stdout)};}
 add('B7-93 proc disappearance and unexpected errors are deterministic',async()=>{
  const results=[],check=(name,fn)=>{try{fn();results.push({name,passed:true});}catch(e){results.push({name,passed:false,error:e.message});}};
  const absent=2147483647;assert.equal(existsSync(`/proc/${absent}`),false);
  check('nonexistent PID',()=>{assert.equal(procText(absent,'stat'),null);assert.equal(procText(absent,'cmdline'),null);assert.deepEqual(runnerState(absent),{pid:absent,gone:true});assert.equal(live(absent),false);});
  const child=collect(spawn(process.execPath,['-e',"process.stdout.write('READY\\n');setInterval(()=>{},100000);"],{env:h.env})),pid=child.p.pid;
  try{
   await ready(child,'READY\n');assert.notEqual(procText(pid,'stat'),null);
   child.p.kill('SIGKILL');await child.done;
   check('real child ends between stat and cmdline reads',()=>{assert.equal(procText(pid,'cmdline'),null);assert.deepEqual(runnerState(pid),{pid,gone:true});assert.equal(live(pid),false);});
  }finally{if(child.p.exitCode===null&&child.p.signalCode===null){child.p.kill('SIGKILL');await child.done;}}
  const original=fs.readFileSync;
  try{for(const code of ['ESRCH','ENOENT','EACCES','EIO'])for(const file of ['stat','cmdline']){
   const error=Object.assign(Error(`invented ${code} reading ${file}`),{code}),path=`/proc/${process.pid}/${file}`;
   fs.readFileSync=(p,...args)=>{if(p===path)throw error;return original(p,...args);};syncBuiltinESMExports();
   const calls=[['runnerState',()=>runnerState(process.pid),{pid:process.pid,gone:true}],['procText',()=>procText(process.pid,file),null],file==='stat'?['live',()=>live(process.pid),false]:['ownedPids',()=>ownedPids('nonexistent-probe-token'),[]]];
   for(const [name,fn,want]of calls)check(`${name} ${file} ${code}`,()=>{if(['ESRCH','ENOENT'].includes(code))assert.deepEqual(fn(),want);else assert.throws(fn,e=>e===error);});
  }}finally{fs.readFileSync=original;syncBuiltinESMExports();}
  h.write(join(scratch,'proc-disappearance-check.json'),{results});
  assert.deepEqual(results.filter(r=>!r.passed),[],'process observations must accept only disappearance errors');
 });
 add('B7-93 burner scope ends after self-test SIGKILL and SIGTERM',async()=>{
  const results=[];
  for(const signal of ['SIGKILL','SIGTERM']){
   const token=`burner-lifetime-${process.pid}-${signal}`;
   const owner=collect(spawn(process.execPath,[join(h.root,'eval/selftest/batch7-burners.mjs'),'--hold',token],{env:h.env}));
   let before;
   try{
    await ready(owner,'READY\n');
    before=burnerPids(token);assert.equal(before.length,4,'four ready burners before owner death');
    owner.p.kill(signal);await owner.done;
    const start=performance.now();let remaining;
    do{remaining=before.filter(live);if(!remaining.length)break;await new Promise(ok=>setTimeout(ok,10));}while(performance.now()-start<10000);
    results.push({signal,before,remaining,wall_ms:performance.now()-start});
    assert.deepEqual(remaining,[],'no burner may survive the self-test process');
   }finally{if(owner.p.exitCode===null&&owner.p.signalCode===null){owner.p.kill('SIGKILL');await owner.done;}}
  }
  h.write(join(scratch,'burner-parent-death.json'),results);
 });
 // B7-72: usable source operations and all commands, including nested cwd.
 add('B7-72 generated shell reads edits and commands in every condition and nested cwd',async()=>{
  for(const condition of ['stub','graph','graph-nolink','graph-nosearch','graph-noterms','graph-norule'])await run(async f=>{
   const read=await f.invoke("cat src/cart.ts; printf '\n// host-shell-edit\n' >> src/cart.ts; tail -1 src/cart.ts");assert.equal(read.status,0,read.stderr.toString());assert.match(read.stdout.toString(),/export function total/);assert.match(h.read(join(f.repo,'src/cart.ts')),/host-shell-edit/);
   for(const [cmd,target]of [['carry','src/tax.ts:taxRate'],['carry','src/tax.ts:1-20'],['why','src/tax.ts:taxRate'],['impact','ADR-0003'],['search','tax']]){
    const got=await f.invoke(`/tools/whygraph ${cmd} ${quote(target)}`,{cwd:'/repo/src'});
    const want=condition==='stub'||condition==='graph-nosearch'&&cmd==='search'?expected(0,'no result\n'):condition==='graph-nolink'&&cmd==='carry'?await carryOracle(f,target):triple(await direct(f,[cmd,target]));
    assert.deepEqual(triple(got),want,`${condition} ${cmd} through generated shell`);
   }
  },{condition});
 });
 // B7-73: a real local listener distinguishes denial from a dead endpoint.
 const networkProbe=async f=>{const server=createServer(s=>s.end());await new Promise(ok=>server.listen(0,'127.0.0.1',ok));try{const code=`const s=require('net').createConnection({host:'127.0.0.1',port:${server.address().port}});s.on('connect',()=>process.exit(0));s.on('error',()=>process.exit(1));`;assert.equal((await f.invoke(['/usr/bin/node','-e',code],{native:true})).status,0,'outer network control');assert.equal((await f.invoke(node(code))).status,1,'shell network denied');}finally{await new Promise(ok=>server.close(ok));}};
 add('B7-73 live TCP listener reachable by agent but denied to shell',()=>run(networkProbe));
 // B7-74: only a synthetic marker enters the identity test.
 const identityProbe=async f=>{const marker=h.write(join(f.r.at,'launcher-probe'),'synthetic marker\n');f.args.splice(f.args.length-1,0,'--ro-bind',marker,'/identity/launcher-probe');assert.deepEqual(triple(await f.invoke(['/bin/cat','/identity/launcher-probe'],{native:true})),expected(0,'synthetic marker\n'),'outer synthetic identity control');assert.deepEqual(triple(await f.invoke('cat /identity/launcher-probe')),expected(1,'','cat: /identity/launcher-probe: No such file or directory\n'),'identity mount absent');};
 add('B7-74 synthetic identity path absent with exact cat error',()=>run(identityProbe));
 // B7-75: binary framing, pipe pressure, delayed producer, crossed streams.
 for(const n of [7,262144])add(`B7-75 binary stdin stdout stderr and exit 37 ${n} bytes`,()=>run(async f=>{const input=Buffer.alloc(n);for(let i=0;i<n;i++)input[i]=i%256;const code="const a=[];process.stdin.on('data',b=>a.push(b));process.stdin.on('end',()=>{const b=Buffer.concat(a);process.stdout.write(b);process.stdout.write(Buffer.from([0,255,254]));process.stderr.write(Buffer.from([254,0,255]));process.stderr.write(b);process.exitCode=37;});";const r=await f.invoke(node(code),{input});assert.deepEqual(triple(r),{status:37,stdout:Buffer.concat([input,Buffer.from([0,255,254])]),stderr:Buffer.concat([Buffer.from([254,0,255]),input])});}));
 add('B7-75 delayed producer waits for command readiness before binary stdin',()=>run(async f=>{const input=Buffer.from([0,255,128,1]),c=f.start(node("process.stderr.write('READY\\n');process.stdin.pipe(process.stdout);"),{input:null});await ready(c,'READY\n');c.p.stdin.end(input);assert.deepEqual(triple(await c.done),{status:0,stdout:input,stderr:Buffer.from('READY\n')});}));
 add('B7-75 head before cat crosses two full pipes without deadlock',()=>run(async f=>{const input=Buffer.alloc(1048576,197);assert.deepEqual(triple(await f.invoke('head -c 1048576 /dev/zero; cat',{input})),{status:0,stdout:Buffer.concat([Buffer.alloc(1048576),input]),stderr:Buffer.alloc(0)});}));
 // B7-76: children include a new session; readiness replaces timing guesses.
 async function lifetime(f,mode){
  const token='host-child-'+h.hash(f.r.at).slice(0,12),script=join(f.repo,token+'.js');
  h.write(script,"const fs=require('fs');process.stdout.write('CHILD_READY\\n',()=>{fs.closeSync(1);fs.closeSync(2);});fs.watch('/repo',()=>{if(fs.existsSync('/repo/release-"+token+"'))fs.writeFileSync('/repo/late-"+token+"','survived');});setInterval(()=>{},100000);\n");
  const command=`/usr/bin/node /repo/${token}.js & /usr/bin/setsid /usr/bin/node /repo/${token}.js & exec 1>&- 2>&-; wait`;
  const c=f.start(command,{input:null});await ready(c,'CHILD_READY\nCHILD_READY\n');const pids=ownedPids(token);assert.ok(pids.length>=2,'both children started');
  try{if(mode==='disconnect'){c.p.kill('SIGKILL');await c.done;await f.launcher.stop();}else if(mode==='runner'){
    const start=performance.now();f.owner.kill('SIGKILL');await f.ownerDone.done;
    const observations=[],path=join(f.r.at,'runner-disappearance.json');let states,wall_ms;
    for(;;){
     states=pids.map(runnerState);wall_ms=performance.now()-start;observations.push({wall_ms,states});
     if(states.every(s=>s.gone||s.state==='Z')||wall_ms>=10000)break;
     await new Promise(ok=>setTimeout(ok,Math.min(10,10000-wall_ms)));
    }
    const result={teardown:observations.flatMap(o=>o.states).filter(s=>s.teardown).length,observation:path,observation_count:observations.length,wall_ms};
    h.write(path,{clock:'SIGKILL request, before owner reap; conservative bound',bound_ms:10000,first:observations[0].states,final:states,observations,wall_ms});
    try{assert.ok(states.every(s=>s.gone||s.state==='Z'),'runner children must be gone or zombie within 10 seconds');}catch(e){e.runnerObservation=result;throw e;}
    await c.done;return result;
   }else{if(mode==='timeout')f.launcher.cancel();await f.launcher.stop();await c.done;}
   h.write(join(f.r.at,'lifetime-'+mode+'.json'),pids.map(pid=>({pid,live:live(pid),cmdline:procText(pid,'cmdline'),stat:procText(pid,'stat')})));for(const pid of pids)assert.equal(live(pid),false,`child ${pid} must terminate before ${mode} returns`);
   h.write(join(f.repo,'release-'+token),'release');assert.equal(existsSync(join(f.repo,'late-'+token)),false,'no later write');
  }finally{for(const pid of pids)if(live(pid))try{process.kill(pid,'SIGKILL');}catch(e){if(e.code!=='ESRCH')throw e;}if(c.p.exitCode===null&&c.p.signalCode===null)c.p.kill('SIGKILL');}
 }
 for(const mode of ['cleanup','timeout','disconnect','runner'])add(`B7-76 ${mode} ends background and new-session children before returning`,()=>run(f=>lifetime(f,mode),{worker:mode==='runner'}));
 add(`B7-93 runner death passes ${stress?50:5} consecutive repetitions under CPU load`,async()=>{
  if(!stress)console.log('SHORT B7-93: 5 repetitions with four burners; long form: node eval/selftest/check.mjs --stress');
  const load=await startBurners('runner-'+process.pid);
  const repetitions=stress?50:5;
  const results=[];try{for(let i=0;i<repetitions;i++){
   try{results.push({repetition:i+1,...await run(f=>lifetime(f,'runner'),{worker:true})});}catch(e){if(e.code!=='ERR_ASSERTION')throw e;results.push({repetition:i+1,...e.runnerObservation,error:e.message});}
   h.write(join(scratch,'runner-death-repetitions.json'),{repetitions:results.length,more_than_one_observation:results.filter(r=>r.observation_count>1).length,longest_time_to_gone_or_zombie_ms:Math.max(...results.filter(r=>!r.error).map(r=>r.wall_ms)),kernel_teardown_repetitions:results.filter(r=>r.teardown>0).length,results});
  }}
  finally{await load.stop();}
  assert.equal(results.length,repetitions);assert.equal(results.filter(r=>r.error).length,0,results.find(r=>r.error)?.error);
 });
 checks.at(-1).stress=true;
 add('plant child survives dead runner caught by B7-93 ten-second bound',async()=>{
  await run(f=>lifetime(f,'runner'),{worker:true});
  const at=h.copy(scratch,'survives-runner');h.wrapped(at,'closed-store.mjs','closedConfinement',"const a=original_closedConfinement(...args);if(!args[0].network)for(const flag of ['--unshare-pid','--die-with-parent'])a.splice(a.indexOf(flag),1);return a;");
  await caught('survives-runner',()=>run(f=>lifetime(f,'runner'),{worker:true,workerModule:join(at,'eval/closed-store.mjs')}));
  const receipt=h.json(join(scratch,'plant2-survives-runner.json'));assert.match(receipt.assertion,/runner children must be gone or zombie within 10 seconds/);assert.ok(receipt.runnerObservation.wall_ms>=10000,'plant must survive until the actual contract bound');
  const evidence=h.json(receipt.runnerObservation.observation);assert.ok(evidence.final.some(s=>!s.gone&&s.state!=='Z'&&BigInt(s.vsize)>0n),'plant must have a live address space at the bound');
 });
 // B7-77: both another live run and the current launcher remain unreachable.
 const connectProbe=path=>node(`const s=require('net').createConnection(${JSON.stringify(path)});s.on('connect',()=>{process.stdout.write('CONNECTED');s.end();});s.on('error',()=>process.exitCode=1);`);
 const socketProbe=async f=>{const r=await f.invoke(connectProbe('/whygraph/shell.sock'));assert.deepEqual(triple(r),expected(1),'shell cannot reach own launcher');};
 add('B7-77 own and other live launcher sockets have no route from shell',()=>run(async f=>{
  await run(async other=>{for(const path of [resolve(h.root,other.work),resolve(h.root,other.work,'shell.sock')]){
   const code=`const fs=require('fs');try{fs.statSync(${JSON.stringify(path)});process.stdout.write('REACHED');}catch{process.exitCode=1;}`;
   for(const native of [true,false])assert.deepEqual(triple(await f.invoke(native?['/usr/bin/node','-e',code]:node(code),{native})),expected(1),'other run path absent');
  }const path=resolve(h.root,other.work,'shell.sock');assert.deepEqual(triple(await f.invoke(connectProbe(path))),expected(1),'other launcher unreachable');});await socketProbe(f);
 }));
 // B7-78: enter namespace first, then remove the live socket owner.
 add('B7-78 mounted live launcher stops before invocation: exact unavailable status',()=>run(async f=>{const code="process.stdout.write('MOUNTED\\n');process.stdin.once('data',()=>{const r=require('child_process').spawnSync('/tools/shell',['-c','true']);process.stdout.write(JSON.stringify({status:r.status,stdout:r.stdout.toString('base64'),stderr:r.stderr.toString('base64')}));});";const c=f.start(['/usr/bin/node','-e',code],{native:true,input:null});await ready(c,'MOUNTED\n');await f.launcher.stop();c.p.stdin.end('go');const r=await c.done;assert.equal(r.status,0);const reply=JSON.parse(r.stdout.toString().slice(8));assert.deepEqual(reply,{status:70,stdout:'',stderr:Buffer.from('whygraph shell launcher unavailable\n').toString('base64')});}));
 for(const mode of ['shell-down','timeout-shell-down'])add(`B7-78 ${mode} remains a harness failure`,async()=>{const at=h.inputs(h.copy(scratch,mode),undefined,r=>r.batches[7].instructionsCommit='c92205d');h.wrapped(at,'closed-store.mjs','startClosedShell','const v=await original_startClosedShell(...args);globalThis.closedLauncherForTest=v;return v;');const r=await shared.attempt({at,entry:'runOne',mode});assert.equal(r.value.status,'invalid');assert.match(r.value.reason,/harness failure:.*shell launcher/);assert.deepEqual(r.calls.find(c=>c.clientResult)?.clientResult,{status:70,stdout:'',stderr:'whygraph shell launcher unavailable\n'});if(mode.startsWith('timeout'))assert.equal(r.value.timed_out,true);});
 // B7-79: partial start, spawn failure, malformed frames, and cancellation.
 add('B7-79 startup failure retains evidence and closes acquired store',async()=>{const at=h.inputs(h.copy(scratch,'shell-start-failure'),undefined,r=>r.batches[7].instructionsCommit='c92205d');h.wrapped(at,'closed-store.mjs','startClosedShell',"throw Error('invented launcher startup failure');");const r=await shared.attempt({at,entry:'runOne'});assert.equal(r.value.status,'invalid');assert.match(r.value.reason,/harness failure:.*startup/);assert.equal(existsSync(join(r.value.work,'service.sock')),false);assert.ok(!r.calls.some(c=>c.args?.includes('--format')));});
 add('B7-79 actual launcher listen failure refuses and command spawn failure counts as harness',async()=>{await run(async f=>{await assert.rejects(f.api.startClosedShell(f.opts),/EADDRINUSE/);assert.deepEqual(triple(await f.invoke('true')),expected(0),'original launcher remains usable');});await run(async f=>{const r=await f.invoke('true');assert.equal(r.status,70);assert.match(r.stderr.toString(),/shell launcher unavailable:.*ENOENT/);assert.equal(r.stdout.length,0);},{worker:true,spawnFailure:true});});
 for(const [label,payload]of [
  ['zero fields',()=>u(0)],['1025 fields',()=>u(1025)],['argument over 1 MiB',()=>Buffer.concat([u(1),u(1048577)])],['request over 1 MiB',()=>fields(['/repo','-c','true','x'.repeat(1048570)])],
  ['NUL argument',()=>fields(['/repo','-c','true\0false'])],['escaping cwd',()=>fields(['/repo/../tmp','-c','true'])],
  ['stdin over 8192',()=>Buffer.concat([fields(['/repo','-c','cat']),frame(0,Buffer.alloc(8193))])],['invalid stdin type',()=>Buffer.concat([fields(['/repo','-c','cat']),frame(2)])],['nonempty eof',()=>Buffer.concat([fields(['/repo','-c','cat']),frame(1,Buffer.from('x'))])],
 ])add(`B7-79 B7-80 shell protocol rejects ${label}`,()=>run(async f=>{const before=f.launcher.stats().failures,r=decode(await wire(join(f.work,'shell.sock'),payload()));assert.ok(f.launcher.stats().failures>before,'protocol failure counted');if(r.status!==undefined)assert.equal(r.status,70);assert.equal(r.stdout.length,0);await f.launcher.stop();}));
 add('B7-79 command spawn failure makes successful agent stream a harness failure',async()=>{const r=await shared.attempt({entry:'runOne',mode:'shell-spawn'});assert.equal(r.value.status,'invalid');assert.match(r.value.reason,/harness failure:.*shell launcher/);assert.equal(r.calls.find(c=>c.clientResult)?.clientResult.status,70);});
 add('B7-79 protocol failure makes successful agent stream a harness failure',async()=>{const r=await shared.attempt({entry:'runOne',mode:'shell-protocol'});assert.equal(r.value.status,'invalid');assert.match(r.value.reason,/harness failure:.*shell launcher/);});
 add('B7-79 ordinary nonzero command remains an agent result',()=>run(async f=>{assert.deepEqual(triple(await f.invoke('exit 19')),expected(19));assert.equal(f.launcher.stats().failures,0);}));
 add('B7-80 shell protocol accepts 1024 fields and 8192-byte stdin frame',()=>run(async f=>{const input=Buffer.alloc(8192,241),payload=Buffer.concat([fields(['/repo','-c','cat',...Array(1021).fill('x')]),frame(0,input),frame(1)]);assert.deepEqual(decode(await wire(join(f.work,'shell.sock'),payload)),{status:0,stdout:input,stderr:Buffer.alloc(0)});}));
 add('B7-80 exact 1 MiB shell request reaches Bash with bounded individual argv',()=>run(async f=>{const args=['/repo','-c','printf accepted',...Array(16).fill('x'.repeat(60000)),''];args[args.length-1]='x'.repeat(1048576-fields(args).length);const payload=fields(args);assert.equal(payload.length,1048576);const bare=decode(await wire(join(f.work,'shell.sock'),payload));assert.deepEqual(bare,expected(0,'accepted'),'1 MiB request without stdin frame is accepted');const withEof=decode(await wire(join(f.work,'shell.sock'),Buffer.concat([payload,frame(1)])));h.write(join(f.r.at,'request-limit.json'),{requestBytes:payload.length,eofBytes:8,bare:{status:bare.status,stdout:bare.stdout.toString(),stderr:bare.stderr.toString()},withEof:{status:withEof.status,stdout:withEof.stdout.toString(),stderr:withEof.stderr.toString()}});assert.equal(withEof.status,0,withEof.stderr.toString());assert.deepEqual(withEof,expected(0,'accepted'));}));
 // B7-80: tool argv rejections and the separate tool transport limits.
 add('B7-80 valid unsupported option-bearing and NUL invocations have exact usage',()=>run(async f=>{const usage=expected(2,'','usage: whygraph <carry|why|impact|search> <target>\n');for(const args of [['build'],['search','tax','--repo','/repo']])assert.deepEqual(triple(await f.invoke('/tools/whygraph '+args.map(quote).join(' '))),usage);const raw=await wire(join(f.work,'service.sock'),fields(['why','x\0y']));assert.equal(raw.readUInt32BE(),2);assert.equal(raw.readUInt32BE(4),0);assert.equal(raw.subarray(12).toString(),usage.stderr.toString());}));
 for(const [label,args]of [['65 arguments',Array(65).fill('x')],['60001 byte argument',['search','x'.repeat(60001)]],['over 65536-byte tool frame',['search','x'.repeat(34000),'x'.repeat(34000)]]])add(`B7-80 ${label} closes connection with exact service unavailable`,()=>run(async f=>{const r=await f.invoke('/tools/whygraph '+args.map(quote).join(' '));assert.deepEqual(triple(r),expected(70,'','whygraph service unavailable\n'));assert.ok(f.service.stats().failures>0);}));
 add('B7-80 tool transport accepts exact 64 args 60000-byte arg and 65536-byte frame',()=>run(async f=>{for(const args of [Array(64).fill('build'),['build','x'.repeat(60000)],['build','x'.repeat(60000),'y'.repeat(5515)]]){if(args.length===3)assert.equal(fields(args).length,65536);const before=f.service.stats();const r=await f.invoke('/tools/whygraph '+args.map(quote).join(' '));assert.equal(r.status,2,'valid-sized frame reaches direct usage parser');assert.equal(f.service.stats().calls,before.calls+1,'request dispatched once');assert.equal(f.service.stats().failures,before.failures,'not a transport failure');}}));
 // B7-81: captured initial manifests include both compiled entry points.
 add('B7-81 generated initial files and scripts identical except omitted rule',async()=>{let full;for(const condition of ['graph','stub','graph-nolink','graph-nosearch','graph-noterms','graph-norule']){const r=await shared.attempt({condition}),files=h.json(join(r.out,'files.json')),script=h.read(join(r.value.work,'shell'));assert.ok(files['/tools/shell-client']);assert.equal(script,'#!/bin/sh\nexec /tools/shell-client "$@"\n');assert.doesNotMatch(script,/\.sock|graph-|\/store|test-results/);assert.equal(files['/tools/shell-client'],files['/tools/whygraph']);delete files['/repo/AGENTS.md'];full??=files;assert.deepEqual(files,full,condition);}});
 // B7-82: real symlink entry, absolute namespace target, and relative control.
 add('B7-82 symlink host repo canonicalizes absolute and relative targets',()=>run(async f=>{const a=await f.invoke('/tools/whygraph why /repo/src/tax.ts:taxRate'),b=await f.invoke('/tools/whygraph why src/tax.ts:taxRate');assert.deepEqual(triple(a),triple(b));assert.deepEqual(triple(a),triple(await direct(f,['why','src/tax.ts:taxRate'])));assert.match(a.stdout.toString(),/ADR-0003/);},{symlinkRepo:true}));
 // Plants exercise the same owner assertions on copied implementations.
 for(const [name,body,owner]of [
  ['shell-network',"const a=original_closedConfinement(...args);if(!args[0].network){const i=a.indexOf('--unshare-net');a.splice(i,1);}return a;",networkProbe],
  ['shell-identity',"const a=original_closedConfinement(...args);if(!args[0].network)a.splice(a.indexOf('--chdir'),0,'--ro-bind',IDENTITY_PLANT,'/identity');return a;",identityProbe],
  ['shell-launcher-socket',"const a=original_closedConfinement(...args);if(!args[0].network)a.splice(a.indexOf('--chdir'),0,'--ro-bind',join(args[0].work,'shell.sock'),'/whygraph/shell.sock');return a;",socketProbe],
  ['surviving-session',"const a=original_closedConfinement(...args);if(!args[0].network)a.splice(a.indexOf('--unshare-pid'),1);return a;",f=>lifetime(f,'cleanup')],
 ])add(`plant ${name} caught by host contract`,async()=>{await run(owner);const at=h.copy(scratch,name),identity=join(at,'synthetic-identity');mkdirSync(identity);h.write(join(identity,'launcher-probe'),'synthetic marker\n');h.wrapped(at,'closed-store.mjs','closedConfinement',body.replace('IDENTITY_PLANT',JSON.stringify(identity)));const api=await import(pathToFileURL(join(at,'eval/closed-store.mjs')).href);await caught(name,()=>run(owner,{api}));});
 const exitOwner=async f=>assert.deepEqual(triple(await f.invoke('exit 37')),expected(37),'exit status preserved');
 add('plant lost-shell-exit caught by B7-75 status',async()=>{await run(exitOwner);const at=h.copy(scratch,'lost-shell-exit'),p=join(at,'eval/closed-client.c'),s=h.read(p);assert.equal(s.split('return (int)ntohl(code);').length,2);h.write(p,s.replace('return (int)ntohl(code);','return 0;'));const api=await import(pathToFileURL(join(at,'eval/closed-store.mjs')).href),client=api.closedClient(join(at,'client'));await caught('lost-shell-exit',()=>run(exitOwner,{client}));});
 const usageOwner=async f=>{const got=await f.invoke('/tools/whygraph why');assert.deepEqual(triple(got),triple(await direct(f,['why'])),'direct CLI usage bytes');};
 add('plant one-byte-usage caught by B7-12 byte equality',async()=>{await run(usageOwner);const at=h.copy(scratch,'one-byte-usage'),p=join(at,'eval/closed-store.mjs'),s=h.read(p),old="stderr:error.stderr??''";assert.equal(s.split(old).length,2);h.write(p,s.replace(old,"stderr:(error.stderr??'')+'x'"));const api=await import(pathToFileURL(p).href);await caught('one-byte-usage',()=>run(usageOwner,{api}));});
 async function caught(name,fn){let receipt;try{await fn();}catch(e){assert.equal(e.code,'ERR_ASSERTION',e.stack);receipt={name,owner:'host contract assertion',assertion:e.message,runnerObservation:e.runnerObservation};}assert.ok(receipt,'plant must fail assertion');h.write(join(scratch,`plant2-${name}.json`),receipt);}
 // B7-12 covers every parser diagnostic form, including disabled conditions.
 add('B7-12 missing and extra positional parser diagnostics match direct CLI across conditions',async()=>{for(const condition of ['graph','graph-norule','stub','graph-nosearch'])await run(async f=>{for(const cmd of ['carry','why','impact','search'])for(const args of [[cmd],[cmd,'target','extra']])assert.deepEqual(triple(await f.invoke('/tools/whygraph '+args.map(quote).join(' '))),triple(await direct(f,args)),`${condition} ${args.join(' ')}`);},{condition});});
 return checks;
}

/** module: [[whygraph-trial-design]]
 * ADR 0011 (2026-11-17), B7-190: a native probe that replays the agent argv inherits its filter descriptor.
 * Only agent spawn is simulated. Store services, health probes, preparation,
 * archive files, and confinement commands execute unchanged.
 */
import child from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import {EventEmitter} from 'node:events';
import {readFileSync,writeSync,existsSync,mkdirSync,writeFileSync,symlinkSync,openSync,closeSync,renameSync,chmodSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
const config=JSON.parse(readFileSync(process.argv[2],'utf8')),mode=process.argv[3]??'success';
const original={spawn:child.spawn,spawnSync:child.spawnSync};const calls=[],signals=[],timers=[];
const realTimer=globalThis.setTimeout;let releaseFailureTimeout;
if(mode.startsWith('timeout'))globalThis.setTimeout=(fn,delay,...args)=>{timers.push(delay);if(['timeout-service-down','timeout-shell-down'].includes(mode)&&delay===1200000){const timer=realTimer(fn,delay,...args);releaseFailureTimeout=()=>{clearTimeout(timer);fn(...args);};return timer;}return realTimer(fn,[1200000,5000].includes(delay)?0:delay,...args);};
function fakeAgent(options,mappedRepo,agentArgs){const ownedStdio=(config.probe||mode.includes('service-down')||mode.includes('shell-down')||mode==='shell-protocol'||mode==='shell-spawn')?[openSync('/proc/self/fd/'+options.stdio[1],'a'),openSync('/proc/self/fd/'+options.stdio[2],'a')]:undefined;if(mode==='breach')symlinkSync('/etc/hostname',join(mappedRepo,'escape'));const p=new EventEmitter();p.pid=2147483647;p.kill=signal=>{signals.push(signal);if(signal==='SIGKILL')queueMicrotask(()=>p.emit('close',null,signal));return true;};if(mode==='spawn-error'){queueMicrotask(()=>{p.emit('error',new Error('invented spawn failure'));p.emit('close',-2);});return p;}
const events=[{type:'text',part:{text:'#1001: keep the recorded choice'}},{type:'step_finish',part:{reason:'stop',tokens:{input:2,output:3,reasoning:0,cache:{read:0,write:0},total:5},cost:.01}}];
function finish(){const raw=events.map(e=>JSON.stringify(e)).join('\n')+'\n'+(mode==='malformed'?'not JSON\n':'');if(!Array.isArray(options.stdio)||typeof options.stdio[1]!=='number')throw Error('agent stdout must be an archival fd');writeSync(ownedStdio?.[0]??options.stdio[1],raw);writeSync(ownedStdio?.[1]??options.stdio[2],'invented stderr\n');if(ownedStdio)for(const fd of ownedStdio)closeSync(fd);if(!mode.startsWith('timeout'))queueMicrotask(()=>p.emit('close',0));}
if(config.probe){
 const probe=config.probe;
 if(probe.fault==='store'){
  const store=JSON.parse(readFileSync(join(config.options.out,'health.json'),'utf8')).stores.current;
  renameSync(store,store+'.removed');
 }
 if(probe.fault==='exit1'){writeFileSync(probe.executable,'#!/bin/sh\necho "product failed" >&2\nexit 1\n');chmodSync(probe.executable,0o755);}
 const script=`const r=require('child_process').spawnSync('/tools/whygraph',${JSON.stringify(probe.args)},{encoding:'utf8'});process.stdout.write(JSON.stringify({status:r.status,stdout:r.stdout,stderr:r.stderr}));`;
 const child=original.spawn('bwrap',[...agentArgs.slice(0,agentArgs.lastIndexOf('--')+1),'/usr/bin/node','-e',script],{cwd:options.cwd,env:options.env,stdio:['ignore','pipe','pipe',options.stdio[3]]});
 let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
 child.on('close',code=>{if(code!==0)throw Error('range client probe failed: '+stderr);const result=JSON.parse(stdout);calls.push({clientResult:result});events.splice(1,0,{type:'tool_use',part:{tool:'shell',state:{status:result.status===0?'completed':'error',input:{command:'whygraph '+probe.args.join(' ')},output:result.stdout+result.stderr}}});finish();});
 return p;
}
if(mode==='service-down'||mode==='timeout-service-down'||mode==='shell-down'||mode==='timeout-shell-down'||mode==='shell-spawn'){const script="process.stdout.write('READY\\n');process.stdin.once('data',()=>{const r=require('child_process').spawnSync('"+((mode.includes('shell-down')||mode==='shell-spawn')?'/tools/shell':'/tools/whygraph')+"',"+JSON.stringify((mode.includes('shell-down')||mode==='shell-spawn')?['-c','true']:['why','src/tax.ts:taxRate'])+",{encoding:'utf8'});process.stdout.write(JSON.stringify({status:r.status,stdout:r.stdout,stderr:r.stderr}));});";const probe=original.spawn('bwrap',[...agentArgs.slice(0,agentArgs.lastIndexOf('--')+1),'/usr/bin/node','-e',script],{cwd:options.cwd,env:options.env,stdio:['pipe','pipe','pipe',options.stdio[3]]});let stdout='',stderr='',stopped=false;probe.stderr.on('data',d=>stderr+=d);probe.stdout.on('data',async d=>{stdout+=d;if(!stopped&&stdout.includes('READY\n')){stopped=true;if(mode.includes('shell-down')||mode.includes('service-down'))await (mode.includes('shell-down')?globalThis.closedLauncherForTest:globalThis.closedServiceForTest).stop();probe.stdin.end('continue');}});probe.on('close',code=>{if(code!==0)throw Error('native service-down probe failed: '+stderr);const result=JSON.parse(stdout.slice('READY\n'.length));calls.push({clientResult:result});events.splice(1,0,{type:'tool_use',part:{tool:'shell',state:{status:result.status===0?'completed':'error',input:{command:(mode.includes('shell-down')||mode==='shell-spawn')?'true':'whygraph why src/tax.ts:taxRate'},output:result.stdout+result.stderr}}});finish();if(['timeout-service-down','timeout-shell-down'].includes(mode))releaseFailureTimeout();});return p;}
if(mode==='shell-protocol'){void import('node:net').then(({createConnection})=>{const socket=agentArgs[agentArgs.indexOf('/whygraph/shell.sock')-1],s=createConnection(socket);s.on('error',e=>{throw e;});s.on('connect',()=>s.write(Buffer.alloc(4)));s.on('data',()=>{});s.on('close',finish);});return p;}
finish();return p;}
child.spawnSync=(cmd,args=[],opts={})=>{if(cmd==='bash'&&args.join(' ')==='-c command -v opencode')return{status:0,stdout:'/bin/true\n',stderr:''};if((cmd==='opencode'||cmd==='/bin/true'||cmd.endsWith('/opencode'))&&args[0]==='--version')return{status:0,stdout:'1.18.29\n',stderr:''};if(cmd==='opencode'||cmd.endsWith('/opencode'))throw Error('real agent launch forbidden');return original.spawnSync(cmd,args,opts);};
child.spawn=(cmd,args=[],opts={})=>{calls.push({cmd,args});if(mode==='shell-spawn'&&cmd==='bwrap'&&args.includes('/bin/bash'))return original.spawn('/missing-shell-launch-command',args,opts);if(cmd==='opencode'||cmd.endsWith('/opencode')||(cmd==='bwrap'&&args.includes('--format'))||(cmd==='/bin/true'&&args.includes('run')))return fakeAgent(opts,cmd==='bwrap'?args[args.indexOf('/repo')-1]:opts.cwd,args);return original.spawn(cmd,args,opts);};
syncBuiltinESMExports();
try{if(config.workRoot)process.env.WHYGRAPH_EVAL_WORK=config.workRoot;const api=await import(pathToFileURL(config.module).href);const value=config.entry==='runOne'?await api.runOne(config.options.task,config.options.condition,config.options.repeat,[config.options.task.id]):await api.closedAttempt(config.options);console.log(JSON.stringify({value,calls,signals,timers}));}catch(e){console.log(JSON.stringify({error:e.message,stack:e.stack,calls,signals,timers}));}

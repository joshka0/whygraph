/** module: [[whygraph-trial-design]]
 * Only agent spawn is simulated. Store services, health probes, preparation,
 * archive files, and confinement commands execute unchanged.
 */
import child from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import {EventEmitter} from 'node:events';
import {readFileSync,writeSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
const config=JSON.parse(readFileSync(process.argv[2],'utf8')),mode=process.argv[3]??'success';
const original={spawn:child.spawn,spawnSync:child.spawnSync};const calls=[],signals=[],timers=[];
const realTimer=globalThis.setTimeout;
if(mode.startsWith('timeout'))globalThis.setTimeout=(fn,delay,...args)=>{timers.push(delay);return realTimer(fn,[1200000,5000].includes(delay)?0:delay,...args);};
function fakeAgent(options){const p=new EventEmitter();p.pid=2147483647;p.kill=signal=>{signals.push(signal);if(signal==='SIGKILL')queueMicrotask(()=>p.emit('close',null,signal));return true;};if(mode==='spawn-error'){queueMicrotask(()=>{p.emit('error',new Error('invented spawn failure'));p.emit('close',-2);});return p;}
const events=[{type:'text',part:{text:'#1001: keep the recorded choice'}},{type:'tool_use',part:{tool:'shell',state:{status:'completed',input:{command:mode.includes('breach')?"relate query --database /store 'MATCH (n) RETURN n'":'echo safe'},output:mode.includes('breach')?'private store bytes':'safe\n'}}},{type:'step_finish',part:{reason:'stop',tokens:{input:2,output:3,reasoning:0,cache:{read:0,write:0},total:5},cost:.01}}];
const raw=events.map(e=>JSON.stringify(e)).join('\n')+'\n'+(mode==='malformed'?'not JSON\n':'');if(!Array.isArray(options.stdio)||typeof options.stdio[1]!=='number')throw Error('agent stdout must be an archival fd');writeSync(options.stdio[1],raw);writeSync(options.stdio[2],'invented stderr\n');if(!mode.startsWith('timeout'))queueMicrotask(()=>p.emit('close',0));return p;}
child.spawnSync=(cmd,args=[],opts={})=>{if(cmd==='bash'&&args.join(' ')==='-c command -v opencode')return{status:0,stdout:'/bin/true\n',stderr:''};if((cmd==='opencode'||cmd==='/bin/true'||cmd.endsWith('/opencode'))&&args[0]==='--version')return{status:0,stdout:'1.18.29\n',stderr:''};if(cmd==='opencode'||cmd.endsWith('/opencode'))throw Error('real agent launch forbidden');return original.spawnSync(cmd,args,opts);};
child.spawn=(cmd,args=[],opts={})=>{calls.push({cmd,args});if(cmd==='opencode'||cmd.endsWith('/opencode')||(cmd==='bwrap'&&args.includes('--format'))||(cmd==='/bin/true'&&args.includes('run')))return fakeAgent(opts);return original.spawn(cmd,args,opts);};
syncBuiltinESMExports();
try{if(config.workRoot)process.env.WHYGRAPH_EVAL_WORK=config.workRoot;const api=await import(pathToFileURL(config.module).href);const value=config.entry==='runOne'?await api.runOne(config.options.task,config.options.condition,config.options.repeat,[config.options.task.id]):await api.closedAttempt(config.options);console.log(JSON.stringify({value,calls,signals,timers}));}catch(e){console.log(JSON.stringify({error:e.message,stack:e.stack,calls,signals,timers}));}

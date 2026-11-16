// Manual evidence for trial7-fix8. Prints observations; this is not a suite.
import { mkdirSync, mkdtempSync, writeFileSync, symlinkSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const mode=process.argv[2];
if(!['main','branch'].includes(mode))throw new Error('usage: node test-results/trial7-fix8-probe.mjs main|branch');
const root=resolve('.'),evidence=join(root,'test-results/trial7-fix8-evidence');
mkdirSync(evidence,{recursive:true});
const at=mkdtempSync(join(evidence,mode+'-'));
let entry=join(root,'eval/closed-store.mjs');
if(mode==='main') {
 const base=join(at,'base');mkdirSync(join(base,'eval'),{recursive:true});
 for(const file of ['closed-store.mjs','closed-client.c'])writeFileSync(join(base,'eval',file),execFileSync('git',['show',`6fc48a3:eval/${file}`]));
 for(const name of ['src','bin','recipes'])symlinkSync(join(root,name),join(base,name));
 entry=join(base,'eval/closed-store.mjs');
}
const api=await import(pathToFileURL(entry).href);
for(const name of ['repo','home','config','cache','state'])mkdirSync(join(at,name));
const repo=join(at,'repo'),store=join(at,'store'),socket=join(at,'service.sock');
execFileSync('git',['init','-q',repo]);
execFileSync('relate',['--no-agent-mode','query','--database',store,"CREATE (:Decision {id:'d1',title:'Fixture decision',source:'fixture',date:'2026-11-16'})"],{env:{...process.env,RELATE_TELEMETRY:'0',DO_NOT_TRACK:'1'}});
const client=api.closedClient(join(at,'clients'));
const service=await api.startClosedStore({condition:'graph',repo,store,socket,log:join(at,'service.jsonl')});
const records=[];
const record=(name,result)=>{records.push({name,...result});const shown={...records.at(-1)};for(const k of ['stdout','stderr'])if(shown[k]?.length>1000)shown[k]=shown[k].slice(0,1000)+` [full ${shown[k].length} bytes in observations.json]`;console.log(JSON.stringify(shown));};
const run=(command,args)=>new Promise((ok,fail)=>{
 const child=spawn(command,args,{env:{...process.env,RELATE_TELEMETRY:'0',DO_NOT_TRACK:'1'}}),out=[],err=[];
 child.stdout.on('data',b=>out.push(b));child.stderr.on('data',b=>err.push(b));child.once('error',fail);
 child.once('close',(code,signal)=>ok({code,signal,stdout:Buffer.concat(out).toString(),stderr:Buffer.concat(err).toString()}));
});
const confinement=api.closedConfinement({work:at,repo,client,socket});
const invoke=args=>run(confinement[0],[...confinement.slice(1),'--','/tools/whygraph',...args]);
const u=n=>{const b=Buffer.alloc(4);b.writeUInt32BE(n);return b;};
const frame=args=>Buffer.concat([u(args.length),...args.flatMap(a=>[u(Buffer.byteLength(a)),Buffer.from(a)])]);
const raw=bytes=>new Promise((ok,fail)=>{
 const s=createConnection(socket),out=[];s.on('error',fail);s.on('data',b=>out.push(b));
 s.once('connect',()=>s.end(bytes));s.once('close',()=>ok({replyBytes:Buffer.concat(out).length,stats:service.stats()}));
});
let launcher;
try {
 record('real client before',await invoke(['impact','d1']));
 record('raw HTTP',await raw(Buffer.from('GET / HTTP/1.0\r\n\r\n')));
 record('over-count frame',await raw(u(65)));
 record('oversized argument header',await raw(Buffer.concat([u(1),u(60001)])));
 record('oversized total frame',await raw(frame(['a'.repeat(33000),'b'.repeat(33000)])));
 record('empty connection',await raw(Buffer.alloc(0)));
 record('partial count',await raw(Buffer.from([0,0])));
 record('partial argument',await raw(Buffer.concat([u(1),u(10),Buffer.from('part')])));
 for(const [name,args] of [
  ['client over count',Array(65).fill('x')],
  ['client oversized argument',['x'.repeat(60001)]],
  ['client oversized total',['x'.repeat(33000),'y'.repeat(33000)]],
  ['client count boundary',Array(64).fill('x')],
  ['client argument boundary',['x'.repeat(60000)]],
  ['client total boundary',['x'.repeat(32762),'y'.repeat(32762)]],
 ])record(name,await invoke(args));
 record('real client after',await invoke(['impact','d1']));
 launcher=await api.startClosedShell({work:at,repo,client,socket,log:join(at,'shell.jsonl')});
 const outer=[...confinement.slice(1),'--ro-bind',client,'/tools/shell-client','--ro-bind',join(at,'shell.sock'),'/whygraph/shell.sock'];
 const probe=`/usr/bin/python3 -c 'import socket; s=socket.socket(socket.AF_UNIX); s.connect("/whygraph/shell.sock")'`;
 record('agent shell command probes launcher',await run('bwrap',[...outer,'--','/tools/shell-client','-c',probe]));
 record('launcher stats',launcher.stats());
 record('final service stats',service.stats());
} finally {await launcher?.stop();await service.stop();}
writeFileSync(join(at,'observations.json'),JSON.stringify(records,null,2)+'\n');
console.log(`Evidence: ${at}`);

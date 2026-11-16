// Manual boundary evidence. Prints actual fixed-probe statuses; no assertions.
import { mkdirSync,mkdtempSync,readFileSync,writeFileSync,chmodSync,realpathSync } from 'node:fs';
import { spawn,execFileSync } from 'node:child_process';
import { join,resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { closedClient,closedConfinement,startClosedStore } from '../eval/closed-store.mjs';
const root=resolve('.'),at=mkdtempSync(join(root,'test-results/trial7-fix9-probes-'));
for(const name of ['repo','home','config','cache','state'])mkdirSync(join(at,name));
const store=join(root,'test-results/trial7-fix8-evidence/branch/store'),repo=join(at,'repo'),socket=join(at,'service.sock');
const source=join(root,'eval/closed-run.mjs'),text=readFileSync(source,'utf8');
const match=/for\(const \[name,code\] of (\[[\s\S]+?\n    \])\) \{/.exec(text);
if(!match)throw new Error('fixed probe source anchor changed');
const probes=runInNewContext(match[1].replaceAll('import.meta.url',JSON.stringify(pathToFileURL(source).href)),{store,prepared:{store},URL});
const client=closedClient(join(root,'test-results/trial7-fix8-evidence/branch/clients'));
const readable=join(at,'readable-client');execFileSync('cc',['-O2','-Wall','-Wextra','-Werror',join(root,'eval/closed-client.c'),'-o',readable]);chmodSync(readable,0o555);
const relate=realpathSync(execFileSync('bash',['-c','command -v relate'],{encoding:'utf8'}).trim());
const service=await startClosedStore({condition:'stub',repo,socket,log:join(at,'service.jsonl')});
const confinement=closedConfinement({work:at,repo,client,socket}),records=[];
const cases=[['denied',[]],['store exposed',[join(store,'manifest.json'),join(store,'manifest.json')]],
 ['client exposed',[readable,'/tools/whygraph']],['service source exposed',[join(root,'eval/closed-store.mjs'),join(root,'eval/closed-store.mjs')]],
 ['product source exposed',[join(root,'src/main.ts'),join(root,'src/main.ts')]],['relate exposed',[relate,'/tools/relate']]];
const run=args=>new Promise((ok,fail)=>{
 const child=spawn('bwrap',args,{env:{...process.env,PATH:'/tools:/usr/bin:/bin',RELATE_TELEMETRY:'0',DO_NOT_TRACK:'1'}}),out=[],err=[];
 child.once('error',fail);child.stdout.on('data',b=>out.push(b));child.stderr.on('data',b=>err.push(b));
 child.once('close',(status,signal)=>ok({status,signal,stdoutBytes:Buffer.concat(out).length,stderrBytes:Buffer.concat(err).length}));
});
try {
 for(const [name,mount] of process.argv.includes('--one')?cases.slice(0,1):cases) {
  const result=[];
  for(const [probe,code] of probes)result.push({probe,command:code,...await run([...confinement.slice(1),...(mount.length?['--ro-bind',...mount]:[]),'--','/bin/bash','-c',code])});
  const row={name,result};records.push(row);console.log(JSON.stringify(row));
 }
} finally {await service.stop();}
writeFileSync(join(at,'observations.json'),JSON.stringify(records,null,2)+'\n');
console.log(`Evidence: ${at}`);

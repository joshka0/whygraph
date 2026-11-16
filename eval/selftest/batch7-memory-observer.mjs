/** module: [[whygraph-trial-design]]
 * Observe process and filesystem boundaries in disposable test processes.
 */
import fs from 'node:fs';
import child from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import {fileURLToPath} from 'node:url';
const path=process.env.B7_MEMORY_OBSERVER;
if(path){
 const config=JSON.parse(fs.readFileSync(path,'utf8'));
 const append=fs.appendFileSync,write=fs.writeFileSync,copy=fs.cpSync,rename=fs.renameSync;
 const event=value=>append(config.log,JSON.stringify({pid:process.pid,...value})+'\n');
 const hold=phase=>{
  if(config.phase!==phase)return;
  event({kind:'paused',phase});
  while(!fs.existsSync(config.release))Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,20);
 };
 fs.cpSync=(source,destination,options)=>{
  event({kind:'copy',source,destination});
  let held=false;
  return copy(source,destination,{...options,filter:(s,d)=>{
   if(!held&&s!==source){held=true;hold('copying');}
   return options?.filter?options.filter(s,d):true;
  }});
 };
 fs.writeFileSync=(p,...args)=>{
  if(String(p).endsWith('.proof.json')){
   if(config.phase==='proofs'){write(p,'{');hold('proofs');}
  }
  return write(p,...args);
 };
 fs.renameSync=(a,b)=>{if(String(b).endsWith('/prepared.json'))hold('rename');return rename(a,b);};
 for(const method of ['spawn','execFileSync']){
  const original=child[method];
  child[method]=(command,args=[],options={})=>{
   if(command==='flock')event({kind:'lock-call',args});
   if(command!=='relate')return original(command,args,options);
   if(options.env?.RELATE_TELEMETRY!=='0'||options.env?.DO_NOT_TRACK!=='1')throw Error('relate telemetry must be disabled');
   const readOnly=args.includes('--read-only');event({kind:'relate',method,readOnly,args});
   const fault=config.fault;
   if(method==='spawn'&&readOnly&&fault){
    if(fault==='spawn')command='/no-such-relate-for-b7-contract';
    else if(['exit','invalid','truncated','renumber'].includes(fault)){
     command=process.execPath;
     args=[fileURLToPath(new URL('./batch7-memory-query.mjs',import.meta.url)),fault,config.relate,...args];
    }
   }
   if(method==='execFileSync'&&!readOnly&&config.phase==='mutating'){
    const p=child.spawn(command,args,{...options,stdio:['ignore','pipe','pipe']});
    p.stdout.resume();p.stderr.resume();event({kind:'child',child:p.pid});hold('mutating');
    throw Error('mutating rendezvous must be killed');
   }
   const result=original(command,args,options);
   if(method==='spawn'){
    event({kind:'child',child:result.pid});
    if(readOnly)hold('fingerprinting');
   }
   return result;
  };
 }
 syncBuiltinESMExports();
}

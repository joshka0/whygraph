/** module: [[whygraph-trial-design]] */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {spawnSync,spawn} from 'node:child_process';
const c=JSON.parse(readFileSync(process.argv[2],'utf8')),started=performance.now();
const memory=()=>{
 const group=readFileSync('/proc/self/cgroup','utf8').split('\n').find(l=>l.startsWith('0::')).slice(3),base='/sys/fs/cgroup'+group;
 return {group,peak:Number(readFileSync(base+'/memory.peak','utf8')),limit:readFileSync(base+'/memory.max','utf8').trim(),events:Object.fromEntries(readFileSync(base+'/memory.events','utf8').trim().split('\n').map(l=>l.split(' ').map((v,i)=>i?Number(v):v)))};
};
let answer;
try{
 if(c.action==='concurrent'){
  const children=Array.from({length:c.callers},(_,i)=>{
   const config={...c,action:'prepare',result:c.result+`.caller-${i}`},path=c.result+`.config-${i}`;writeFileSync(path,JSON.stringify(config));
   const p=spawn(process.execPath,[process.argv[1],path],{env:process.env,stdio:['ignore','ignore','inherit']});
   const done=new Promise((ok,fail)=>{p.once('error',fail);p.once('close',status=>ok({status,pid:p.pid,result:config.result}));});return {p,done,path,result:config.result};
  });
  const started=performance.now();let events;
  for(;;){events=existsSync(c.log)?readFileSync(c.log,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
   if(events.some(e=>e.kind==='paused')&&events.filter(e=>e.kind==='lock-call').length===c.callers)break;
   if(children.some(p=>p.p.exitCode!==null))throw Error('caller exited before lock rendezvous');
   if(performance.now()-started>120000)throw Error('callers did not reach lock rendezvous');
   await new Promise(ok=>setTimeout(ok,20));
  }
  const beforePublication=children.map(p=>({pid:p.p.pid,resultExists:existsSync(p.result),exitCode:p.p.exitCode}));
  writeFileSync(c.release,'continue');const ended=await Promise.all(children.map(p=>p.done));
  if(ended.some(p=>p.status!==0))throw Error('concurrent preparation failed: '+JSON.stringify(ended));
  answer={value:ended.map(p=>JSON.parse(readFileSync(p.result,'utf8')).value),beforePublication};
 }else if(c.action==='build'){
  const r=spawnSync(process.execPath,[c.script,c.directory,String(c.size)],{env:process.env,encoding:'utf8'});
  if(r.error)throw r.error;if(r.status!==0)throw Error(r.stderr||`build exited ${r.status??r.signal}`);
  answer={value:JSON.parse(r.stdout.trim())};
 }else{
  const api=await import(pathToFileURL(c.module).href);
  answer={value:c.action==='fingerprint'?api.storeFingerprint(c.store):api.ablatedStores(c.store,c.directory)};
 }
}catch(e){answer={error:e.stack};process.exitCode=1;}
answer={...answer,wall_ms:performance.now()-started,memory:memory()};
writeFileSync(c.result,JSON.stringify(answer,null,2)+'\n');console.log(JSON.stringify(answer));

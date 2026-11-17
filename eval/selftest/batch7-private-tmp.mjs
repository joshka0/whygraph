/** module: [[whygraph-trial-design]]
 * Independent contracts B7-178 through B7-186: private tmpfs paths.
 */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chmodSync,cpSync,existsSync,mkdirSync,readdirSync,symlinkSync,unlinkSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {closedBreaches} from '../../scripts/attempts.pure.ts';
import {isolationBreaches} from '../opencode.mjs';
import {settleCell} from '../run.mjs';
import {fileKey} from '../registry.mjs';
import {b7 as h} from './batch7-support.mjs';
import {storeCommand} from './batch7-records.mjs';
import {batch7ClosedChecks} from './batch7-closed.mjs';
import {batch7AttemptChecks} from './batch7-attempts.mjs';
import {batch7SmokeChecks} from './batch7-smoke.mjs';

const archive=join(h.root,'eval/results/_smoke-archive/7-private-tmp-classed-as-breach');
const privatePaths=['/tmp','/tmp/x','/tmp/opencode/a/b.c','/tmp/a/../b','/tmp/./a','/tmp//a','/tmp/a/'];
const outsidePaths=['/tmp/../etc/passwd','/tmp/../../x','/tmp/a/../../home/agent/x','/tmpx/a','/var/tmp/x','/home/agent/x','/tools/whygraph','/identity/opencode/x','/whygraph/service.sock','/etc/hosts','/config/x'];
const fields=['filePath','file_path','path','paths','directory','dir','root','cwd','workdir','targetFile','target_file','oldPath','old_path','newPath','new_path'];
const patchFields=['patch','patchText','patch_text','diff'];
const patchLines=['*** Add File: ','*** Update File: ','*** Delete File: ','*** Move to: ','--- ','+++ '];
const fileTool=path=>({name:'write',input:{filePath:path}});
const replace=(p,from,to)=>{const s=h.read(p);assert.equal(s.split(from).length,2,'one plant anchor: '+from);h.write(p,s.replace(from,to));};
const collect=child=>new Promise((ok,fail)=>{let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);child.once('error',fail);child.once('close',(status,signal)=>ok({status,signal,stdout,stderr}));});
const nativeAgent=`#!/usr/bin/node
import{readFileSync,mkdirSync,writeFileSync,symlinkSync}from'node:fs';
const config=JSON.parse(readFileSync('/config/rehearsal.json','utf8'));
const emit=(type,part)=>process.stdout.write(JSON.stringify({type,part})+'\\n');
try{
 mkdirSync('/tmp/opencode',{recursive:true});writeFileSync('/tmp/opencode/wrap.c','int main(void){return 0;}\\n');
 emit('tool_use',{tool:'write',state:{input:{filePath:'/tmp/opencode/wrap.c'},output:'wrote file',status:'completed'}});
 for(const tool of config.extra??[])emit('tool_use',{tool:tool.name,state:{input:tool.input,output:'scripted observation',status:'completed'}});
 if(config.symlink)symlinkSync('/tmp/opencode/wrap.c','/repo/tmp-escape');
 writeFileSync('/repo/private-tmp-observation.json',JSON.stringify({readback:readFileSync('/tmp/opencode/wrap.c','utf8')}));
 emit('text',{text:'Scripted file write completed.'});
 emit('step_finish',{reason:'stop',cost:0,tokens:{input:0,output:0,reasoning:0,cache:{read:0,write:0},total:0}});
}catch(error){emit('error',{message:error.message});process.stderr.write(error.stack+'\\n');process.exitCode=1;}
`;

/** Private /tmp classification, real closed attempts, settlement and mount premise.
 * owns: [[whygraph-batch7-private-tmp-selftest]]
 */
export async function batch7PrivateTmpChecks({scratch,shared}){
 const checks=[],add=(name,run)=>checks.push({name:'B7 '+name,group:'private-tmp',run});let serial=0,finished;
 const shortRoots=[];
 function shortRoot(){
  // The real runner reserves 50 bytes of the 107-byte Unix socket limit.
  const base=join(h.root,'test-results/scratch');mkdirSync(base,{recursive:true});
  for(let i=0;i<1296;i++){const p=join(base,i.toString(36).padStart(2,'0'));try{mkdirSync(p);shortRoots.push(p);h.write(join(scratch,'private-tmp-work-roots.json'),shortRoots);return p;}catch(e){if(e.code!=='EEXIST')throw e;}}
  throw new Error('no unused two-character scratch work root');
 }
 let attemptRoot;
 const fresh=label=>h.inputs(h.copy(scratch,'private-tmp-'+label+'-'+serial++),undefined,r=>r.batches[7].instructionsCommit='c92205d');
 const repo=join(scratch,'private-tmp-path-repo');mkdirSync(repo,{recursive:true});
 const classify=(tools,rule=closedBreaches)=>rule(isolationBreaches(repo,tools));
 function evidence(){
  if(!existsSync(join(archive,'_attempts')))throw new Error('B7-178 evidence is missing on this machine: '+archive+'; restore it before this case can pass');
  const dirs=readdirSync(join(archive,'_attempts')).sort();assert.equal(dirs.length,5,'five archived attempts required');return dirs;
 }
 // A copy gets its own pure module. Never write through h.copy's scripts symlink.
 async function plantedRule(name,from,to){const at=fresh('rule-'+name);unlinkSync(join(at,'scripts'));mkdirSync(join(at,'scripts'));const path=join(at,'scripts/attempts.pure.ts');h.write(path,h.read(join(h.root,'scripts/attempts.pure.ts')));replace(path,from,to);return (await import(pathToFileURL(path).href)).closedBreaches;}
 async function caught(name,owner,run){let error;try{await run();}catch(e){if(e.code!=='ERR_ASSERTION')throw e;error=e;}assert.ok(error,`plant ${name} must turn ${owner} red`);h.write(join(scratch,'private-tmp-plant-'+name+'.json'),{name,owner,assertion:error.message,actual:error.actual,expected:error.expected});}
 function archived(rule=closedBreaches){
  for(const n of evidence()){
   const dir=join(archive,'_attempts',n),tools=h.json(join(dir,'tools.json')),meta=h.json(join(dir,'meta.json'));
   // Apply the same namespace normalization as the runner to the actual recorded tools.
   const normalized=JSON.parse(JSON.stringify(tools).replaceAll('/repo/',repo+'/').replaceAll('"/repo"',JSON.stringify(repo)));
   const hits=isolationBreaches(repo,normalized);assert.deepEqual(hits,meta.isolation,'raw archive reproduces its recorded breach');
   assert.deepEqual(rule(hits),[],n+': private tmp writes must not breach');
  }
 }
 add('B7-178 all five archived tools.json files have no closed breach',()=>archived());
 add('B7-178 archived fixture is red with the old runner rule at 0af356e',async()=>{
  const at=fresh('old-rule'),path=join(at,'eval/closed-run.mjs');h.write(path,h.ok(h.command('git',['show','0af356e:eval/closed-run.mjs'])));
  // Exercise the old runner itself with an archived native tool stream, below.
  const n=evidence()[0],tools=h.json(join(archive,'_attempts',n,'tools.json'));
  const result=await attempt({at,extra:tools});
  let red;try{assert.equal(result.meta.status,'done','B7-178 archived private /tmp tools must complete');}catch(e){assert.equal(e.code,'ERR_ASSERTION');red=e;}
  assert.ok(red,'old runner must be red');assert.equal(result.meta.reason,'isolation breach');assert.ok(result.meta.isolation.some(s=>s.startsWith('external file-tool path: /tmp/opencode/')));
  assert.deepEqual(result.meta.isolation,['external file-tool path: /tmp/opencode/wrap.c',...h.json(join(archive,'_attempts',n,'meta.json')).isolation],'old rule rejected the archived tools themselves');
  const output={base:'0af356e',fixture:join(archive,'_attempts',n,'tools.json'),status:result.meta.status,reason:result.meta.reason,isolation:result.meta.isolation,red:red.message};
  h.write(join(scratch,'private-tmp-old-rule-red.json'),output);console.log('EXPECTED RED B7-178 on 0af356e: '+JSON.stringify(output));
 });
 for(const field of fields)add(`B7-179 ${field} resolves private paths and retains every outside path`,()=>{
  const values=[...privatePaths,...outsidePaths,join(scratch,'host-work')];const input={nested:{[field]:values}};
  assert.deepEqual(classify([{name:'read',input}]),values.slice(privatePaths.length).map(p=>'external file-tool path: '+p));
  assert.deepEqual(classify([{name:'read',input:{[field.toUpperCase()]:'/tmp/../etc/passwd'}}]),['external file-tool path: /tmp/../etc/passwd']);
 });
 for(const field of patchFields)for(const line of patchLines)add(`B7-180 ${field} ${line.trim()} resolves paths and keeps original outside spelling`,()=>{
  const values=[...privatePaths,...outsidePaths,join(scratch,'host-work')],patch=values.map(p=>line+p).join('\n');
  assert.deepEqual(classify([{name:'apply_patch',input:{[field]:patch}}]),values.slice(privatePaths.length).map(p=>'external patch path: '+p));
 });
 add('B7-181 mixed file and patch fields keep only outside hits in encounter order',()=>mixed());
 const mixedTools=[{name:'write',input:{filePath:'/tmp/x',path:'/etc/hosts',nested:{new_path:'/tmp/a/../b',old_path:'/config/x'},patch:'*** Add File: /tmp/y\n*** Delete File: /var/tmp/x'}},fileTool('/tmp/z'),fileTool('/home/agent/x')];
 const mixedHits=['external file-tool path: /etc/hosts','external file-tool path: /config/x','external patch path: /var/tmp/x','external file-tool path: /home/agent/x'];
 function mixed(rule=closedBreaches){assert.deepEqual(classify(mixedTools,rule),mixedHits);}
 function links(rule=closedBreaches){
  const tmp=join(repo,'tmp-link'),outside=join(repo,'outside-link');symlinkSync('/tmp/x',tmp);symlinkSync('/etc/hosts',outside);
  try{assert.deepEqual(classify([fileTool('/tmp/x'),{name:'Bash',input:{command:'ln -s /tmp/x y'}},{name:'Bash',input:{command:'ln -s /etc/hosts z'}}],rule),['external symlink: '+outside,'external symlink: '+tmp,'shell command creates a symlink','shell command creates a symlink']);}
  finally{unlinkSync(tmp);unlinkSync(outside);}
 }
 add('B7-182 outside symlinks including /tmp and shell symlink creation stay breaches',()=>links());

 async function attempt({at=fresh('attempt'),extra=[],timeout=false,edit,symlink=false}={}){
  const f=await shared.getClosed(),work=attemptRoot??=shortRoot(),out=join(at,'attempt');mkdirSync(out);
  mkdirSync(join(at,'identity/opencode'),{recursive:true});const executable=h.write(join(at,'scripted-agent.mjs'),nativeAgent);chmodSync(executable,0o555);
  if(edit)edit(at);
  if(timeout)h.wrapped(at,'closed-run.mjs','runClosedAgent','const v=await original_runClosedAgent(...args);return {...v,r:{...v.r,timedOut:true}};');
  const task={id:'private-tmp-write',batch:7,repo:'zustand'};
  const config=h.write(join(at,'worker.json'),{module:join(at,'eval/closed-run.mjs'),entry:'closedAttempt',options:{task,condition:'graph',repeat:1,workRoot:work,out,prompt:'Scripted private file write.',source:f.source,store:f.store,rehearsal:{executable,config:{extra,symlink}}}});
  const r=await collect(spawn(process.execPath,[join(h.root,'eval/selftest/batch7-startup-worker.mjs'),config],{cwd:h.root,env:{...h.env,XDG_DATA_HOME:join(at,'identity')}}));
  h.write(join(at,'worker-output.json'),r);assert.equal(r.status,0,r.stderr+r.stdout);const parsed=JSON.parse(r.stdout.trim().split('\n').at(-1));assert.equal(parsed.error,undefined,parsed.error);
  const meta=parsed.value;assert.equal(meta.service.failures,0,meta.reason);assert.equal(Boolean(meta.reason?.startsWith('harness failure:')),false,meta.reason);
  assert.equal(h.json(join(meta.work,'repo/private-tmp-observation.json')).readback,'int main(void){return 0;}\n','scripted native write and read happened in the real namespace');
  return {at,out,meta,task};
 }
 const complete=async()=>finished??=await attempt();
 async function settlement(sequence,label){
  const first=sequence[0],results=join(scratch,'private-tmp-settle-'+label+'-'+serial++),p={id:first.meta.id,task:first.task,condition:'graph',repeat:1};let calls=0;
  const runAttempt=async()=>{assert.ok(calls<sequence.length,'no extra attempt');const a=sequence[calls++];cpSync(a.out,join(results,fileKey(p.id)),{recursive:true});return a.meta;};
  const value=await settleCell(p,[],{results,runAttempt}),ledger=h.json(join(results,'_ledger',fileKey(p.id)+'.json'));
  assert.equal(calls,value.status==='done'?(sequence.findIndex(a=>a.meta.status==='done')+1):2,'closed attempt budget');
  for(const e of ledger)if(e.kind!=='done')assert.deepEqual(h.json(join(e.archived,'meta.json')),e.meta,'archive keeps failed metadata');
  const before=h.tree(results);await settleCell(p,[],{results,runAttempt:()=>assert.fail('resume launches no third attempt')});assert.deepEqual(h.tree(results),before);
  return {value,ledger,results,p,calls};
 }
 add('B7-178 real private /tmp write is done once, scored, with no reason, isolation or archive',async()=>{
  const a=await complete();assert.equal(a.meta.status,'done',a.meta.reason);assert.equal(Object.hasOwn(a.meta,'reason'),false);assert.equal(Object.hasOwn(a.meta,'isolation'),false);
  const s=await settlement([a],'done');assert.equal(s.calls,1);assert.equal(s.ledger.length,1);assert.equal(s.ledger[0].kind,'done');assert.equal(existsSync(join(s.results,'_attempts')),false);
  const task={...h.generated(a.at).find(t=>t.kind==='control'),id:a.task.id};h.write(join(a.at,'eval/tasks',task.id+'.json'),task);
  const scored=h.node(join(a.at,'eval/score.mjs'),['--results',s.results,'--json']);h.ok(scored);const rows=JSON.parse(scored.stdout);assert.equal(rows.length,1,'done cell enters scoring');assert.equal(rows[0].task,a.task.id);
 });
 add('B7-181 real attempt with private /tmp and outside hits is invalid with only outside hits',async()=>{
  const a=await attempt({extra:mixedTools});assert.equal(a.meta.status,'invalid');assert.equal(a.meta.reason,'isolation breach');assert.deepEqual(a.meta.isolation,mixedHits);
 });
 add('B7-182 real repo symlink into private /tmp stays an isolation breach',async()=>{
  const a=await attempt({symlink:true});assert.equal(a.meta.status,'invalid');assert.equal(a.meta.reason,'isolation breach');assert.deepEqual(a.meta.isolation,['external symlink: '+join(a.meta.work,'repo/tmp-escape')]);
 });
 async function budget(edit){
  const done=edit?await attempt({edit}):await complete(),timeout=await attempt({timeout:true,edit}),breach=await attempt({extra:[fileTool('/etc/hosts')],edit});
  assert.equal(done.meta.status,'done',done.meta.reason);assert.equal(timeout.meta.status,'error',timeout.meta.reason);assert.equal(timeout.meta.timed_out,true);assert.match(timeout.meta.reason,/timed out/);assert.equal(Object.hasOwn(timeout.meta,'isolation'),false);
  assert.equal(breach.meta.status,'invalid');assert.deepEqual(breach.meta.isolation,['external file-tool path: /etc/hosts']);
  for(const [name,sequence]of [['timeout-timeout',[timeout,timeout]],['breach-breach',[breach,breach]],['timeout-breach',[timeout,breach]],['breach-timeout',[breach,timeout]]]){
   const s=await settlement(sequence,name);assert.equal(s.value.unscored,true,name);assert.equal(s.value.status,'error');assert.equal(s.ledger.length,2);assert.ok(s.ledger.every(e=>e.kind==='agent'));assert.equal(s.value.attempts.length,2);
  }
  for(const sequence of [[timeout,done],[breach,done],[done]]){const s=await settlement(sequence,'then-done');assert.equal(s.value.status,'done');assert.equal(s.value.unscored,undefined);}
 }
 add('B7-183 private /tmp hit leaves timeout, done and all four two-attempt pairs unchanged',()=>budget());

 function mountContract(args){
  let tmpfs=0;
  for(let i=1;i<args.length;i++){
   const op=args[i];if(op==='--tmpfs'){if(args[i+1]==='/tmp')tmpfs++;i++;continue;}
   if(/^--(?:ro-|dev-)?bind(?:-try)?$/.test(op)||op==='--symlink'){const dest=resolve('/',args[i+2]);assert.ok(dest!=='/tmp'&&!dest.startsWith('/tmp/'),op+' destination under private /tmp: '+dest);i+=2;}
   else if(op==='--dir'){const dest=resolve('/',args[++i]);assert.ok(dest!=='/tmp'&&!dest.startsWith('/tmp/'),'directory destination under private /tmp: '+dest);}
  }
  assert.equal(tmpfs,1,'exactly one fresh --tmpfs /tmp');
 }
 async function mounts(edit){
  const f=await shared.getClosed(),at=fresh('mounts');if(edit)edit(at);const api=await import(pathToFileURL(join(at,'eval/closed-store.mjs')).href),runner=await import(pathToFileURL(join(at,'eval/closed-run.mjs')).href);
  const work=shortRoot();for(const d of ['repo','home','config','cache','state','identity/opencode','out'])mkdirSync(join(work,d),{recursive:true});
  // A bound socket must exist; use a real service, without invoking a model.
  const socket=join(work,'s'),service=await api.startClosedStore({condition:'stub',repo:f.repo,store:f.store,fullStore:f.store,socket,log:join(at,'service.jsonl')});
  const executable=h.write(join(at,'stand-in'),nativeAgent);chmodSync(executable,0o555);const previous=process.env.XDG_DATA_HOME;process.env.XDG_DATA_HOME=join(work,'identity');let agent;
  try{
   const options={work,repo:join(work,'repo'),client:f.client,socket,opencode:executable};
   const variants=[api.closedConfinement({...options,network:false}),api.closedConfinement({...options,network:true})];
   agent=await runner.startClosedAgent({...options,out:join(work,'out'),prompt:'No model starts.',rehearsal:{executable,config:{}}});variants.push(agent.confinement);
   for(const [i,args]of variants.entries()){
    mountContract(args);const marker='whygraph-private-'+randomUUID(),path='/tmp/'+marker;assert.equal(existsSync(path),false);
    const write=await storeCommand(args[0],[...args.slice(1),'--','/usr/bin/node','-e',`require('fs').writeFileSync(${JSON.stringify(path)},'private');process.stdout.write(require('fs').readFileSync(${JSON.stringify(path)},'utf8'))`]);h.ok(write);assert.equal(write.stdout,'private');
    assert.equal(existsSync(path),false,'no host /tmp file');assert.equal(existsSync(join(work,marker)),false,'no work-root file');assert.equal(existsSync(join(work,'repo',marker)),false,'no repo file');
    const second=await storeCommand(args[0],[...args.slice(1),'--','/usr/bin/node','-e',`process.exit(require('fs').existsSync(${JSON.stringify(path)})?1:0)`]);h.ok(second);h.write(join(at,'mount-'+i+'.json'),{args,write,second});
   }
  }finally{if(previous===undefined)delete process.env.XDG_DATA_HOME;else process.env.XDG_DATA_HOME=previous;await agent?.launcher.stop();await service.stop();}
 }
 add('B7-184 real agent and shell confinements have one private tmpfs, no mounted child and no cross-start file',()=>mounts());
 add('B7-185 open-store rule and frozen batch 5 and 6 inputs retain baseline bytes',()=>{
  assert.deepEqual(isolationBreaches(repo,[fileTool('/tmp/opencode/wrap.c')]),['external file-tool path: /tmp/opencode/wrap.c']);
  const paths=['eval/opencode.mjs','eval/run.mjs','eval/registry.mjs','eval/registry.json','eval/score.mjs','eval/tasks','eval/tickets/zustand','eval/tickets/hono','eval/tickets/memod','eval/tickets/memoryd','eval/score.txt','eval/selftest/batch5.mjs','eval/selftest/batch6.mjs','eval/selftest/batch5-report.mjs','eval/selftest/batch6-report.mjs'];
  const r=h.command('git',['diff','--exit-code','0af356e','--',...paths]);assert.equal(r.status,0,r.stdout+r.stderr);
 });
 function smokeArchive(){
  evidence();const before=h.tree(archive),at=fresh('archived-smoke');cpSync(archive,join(at,'eval/results'),{recursive:true});cpSync(join(h.root,'eval/tasks'),join(at,'eval/tasks'),{recursive:true});
  const registry=h.json(join(at,'eval/registry.json'));registry.batches[7].instructionsCommit=h.json(join(h.root,'eval/registry.json')).batches[7].instructionsCommit;h.write(join(at,'eval/registry.json'),registry);
  // The archive retains absolute ledger references from before its move.
  // Relocate references only in the disposable replay copy, never the evidence.
  const results=join(at,'eval/results');for(const n of readdirSync(join(results,'_ledger'))){const p=join(results,'_ledger',n),ledger=h.json(p);for(const row of ledger)if(row.archived)row.archived=join(results,'_attempts',basename(row.archived));h.write(p,ledger);}
  const pointer=join(h.root,'eval/results/_preflight/latest.json');assert.ok(existsSync(pointer),'archived smoke needs its retained real preflight receipt');h.write(join(results,'_preflight/latest.json'),h.json(pointer));
  const r=h.node(join(at,'eval/smoke-check.mjs'),['--batch','7']);h.write(join(at,'smoke-output.json'),r);assert.equal(r.status,0,r.stdout+r.stderr);
  const passes=s=>s.split('\n').filter(l=>l.startsWith('PASS ')).map(l=>l.split(':')[0]);assert.deepEqual(passes(r.stdout),passes(h.read(join(archive,'smoke-check.log'))));assert.equal(passes(r.stdout).length,8);
  const unscored=readdirSync(results).filter(n=>existsSync(join(results,n,'meta.json'))&&h.json(join(results,n,'meta.json')).unscored).sort();
  assert.deepEqual(unscored,['zustand7-conflict-zs-13__graph-norule__r1','zustand7-conflict-zs-13__stub__r1']);
  assert.deepEqual(h.tree(archive),before,'archive bytes unchanged');
 }
 add('B7-186 archived seventh smoke replays eight PASS lines and keeps both unscored cells',()=>smokeArchive());
 add('B7-186 smoke with done cells holding private /tmp paths has no unscored cells',async()=>{
  const at=await shared.smokeFixture('private-tmp'),results=join(at,'eval/results');for(const n of readdirSync(results)){const p=join(results,n);if(!existsSync(join(p,'meta.json')))continue;const meta=h.json(join(p,'meta.json'));assert.equal(meta.status,'done');assert.equal(meta.unscored,undefined);const tools=h.json(join(p,'tools.json'));tools.push(fileTool('/tmp/opencode/wrap.c'));h.write(join(p,'tools.json'),tools);}
  const r=h.node(join(at,'eval/smoke-check.mjs'),['--batch','7']);h.write(join(at,'smoke-output.json'),r);assert.equal(r.status,0,r.stdout+r.stderr);assert.match(r.stdout,/^PASS planned cells: 16\/16$/m);assert.equal(r.stdout.split('\n').filter(l=>l.startsWith('PASS ')).length,8);
 });

 add('plant B7-178 old rule retains private tmp hits',async()=>{
  const rule=await plantedRule('old-rule','return at !== "/tmp" && !at.startsWith("/tmp/");','return true;');await caught('old-rule','B7-178',()=>archived(rule));
 });
 add('plant B7-179 prefix accepts tmpx',async()=>{
  const rule=await plantedRule('tmpx','at !== "/tmp" && !at.startsWith("/tmp/")','!at.startsWith("/tmp")');await caught('tmpx','B7-179',()=>assert.deepEqual(classify([fileTool('/tmpx/a')],rule),['external file-tool path: /tmpx/a']));
 });
 add('plant B7-179 skips dot-dot resolution',async()=>{
  const rule=await plantedRule('dot-dot','const at = resolved(path);','const at = path;');await caught('dot-dot','B7-179',()=>assert.deepEqual(classify([fileTool('/tmp/../etc/passwd')],rule),['external file-tool path: /tmp/../etc/passwd']));
 });
 add('plant B7-180 drops every patch hit',async()=>{
  const rule=await plantedRule('all-patches','return hits.filter(hit => {','return hits.filter(hit => { if(hit.startsWith("external patch path:"))return false;');await caught('all-patches','B7-180',()=>assert.deepEqual(classify([{name:'apply_patch',input:{patch:'*** Add File: /etc/hosts'}}],rule),['external patch path: /etc/hosts']));
 });
 add('plant B7-181 drops every file-tool hit',async()=>{
  const rule=await plantedRule('all-files','return hits.filter(hit => {','return hits.filter(hit => { if(hit.startsWith("external file-tool path:"))return false;');await caught('all-files','B7-181',()=>mixed(rule));
 });
 add('plant B7-182 drops symlink hits',async()=>{
  const rule=await plantedRule('symlinks','return hits.filter(hit => {','return hits.filter(hit => { if(hit.startsWith("external symlink:"))return false;');await caught('symlinks','B7-182',()=>links(rule));
 });
 add('plant B7-183 runner bypasses closed breach rule',async()=>{
  await caught('runner-bypass','B7-183',()=>budget(at=>replace(join(at,'eval/closed-run.mjs'),'const breaches=closedBreaches(isolationBreaches(repo,normalized));','const breaches=isolationBreaches(repo,normalized);')));
 });
 add('plant B7-184 bind under private tmpfs',async()=>{
  await caught('tmp-bind','B7-184',()=>mounts(at=>replace(join(at,'eval/closed-store.mjs'),"'--bind',repo,'/repo'","'--bind',repo,'/tmp/host-repo','--bind',repo,'/repo'")));
 });
 return checks;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 mkdirSync(join(h.root,'test-results/scratch'),{recursive:true});const scratch=h.mkdtempSync(join(h.root,'test-results/scratch/private-tmp-')),shared={};
 await batch7ClosedChecks({scratch,shared});await batch7AttemptChecks({scratch,shared});await batch7SmokeChecks({scratch,shared});
 const filter=new RegExp(process.argv[2]??'B7'),checks=(await batch7PrivateTmpChecks({scratch,shared})).filter(c=>filter.test(c.name));assert.ok(checks.length,'filter selects at least one case');console.log('Scratch retained: '+scratch);let wrong=0;
 for(const c of checks){try{await c.run();console.log('ok '+c.name);}catch(e){wrong++;console.log('WRONG '+c.name+'\n'+e.stack);}}
 console.log(`${checks.length-wrong}/${checks.length} focused cases; ${scratch}`);process.exitCode=wrong?1:0;
}

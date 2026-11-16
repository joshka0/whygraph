/** module: [[whygraph-trial-design]]
 * Independent B7-83–B7-92 cases. All preparation gets a fresh bounded scope.
 */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {cpSync,existsSync,mkdirSync,readFileSync,readdirSync,renameSync,statSync,symlinkSync} from 'node:fs';
import {join,basename} from 'node:path';
import {pathToFileURL} from 'node:url';
import {b7 as h} from './batch7-support.mjs';
const conditions=['graph','graph-nolink','graph-noterms'];
const sleep=()=>new Promise(ok=>setTimeout(ok,20));
const bytes=p=>readFileSync(p);
function lines(p){return existsSync(p)?h.read(p).trim().split('\n').filter(Boolean).map(JSON.parse):[];}
function observed(p){return lines(p).filter(x=>['copy','relate'].includes(x.kind));}
/** Bound memory, preserve evidence, and check preparation through its public API.
 * owns: [[whygraph-batch7-memory-selftest]]
 */
export async function batch7MemoryChecks({scratch}){
 const checks=[],add=(name,run)=>checks.push({name:'B7 '+name,group:'memory',run});let serial=0,seed,large;
 const dir=label=>{const p=join(scratch,`memory-${serial++}-${label}`);mkdirSync(p,{recursive:true});return p;};
 const module=join(h.root,'eval/closed-store.mjs'),worker=join(h.root,'eval/selftest/batch7-memory-worker.mjs'),observer=join(h.root,'eval/selftest/batch7-memory-observer.mjs');
 const relate=h.ok(h.command('bash',['-c','command -v relate'])).trim();
 const pageSize=Number(h.ok(h.command('getconf',['PAGESIZE'])).trim()),boundedLimit=String(Math.floor(1000000000/pageSize)*pageSize);
 function launch(options){
  const at=dir('scope'),config={...options,relate,log:join(at,'calls.jsonl'),release:join(at,'release'),result:join(at,'result.json')};h.write(join(at,'config.json'),config);
  const env={...h.env,TMPDIR:'/mnt/ssd/tmp',B7_MEMORY_OBSERVER:join(at,'config.json'),NODE_OPTIONS:`${process.env.NODE_OPTIONS??''} --import=${pathToFileURL(observer).href}`};
  const p=spawn('systemd-run',['--user','--scope','-q','-p',`MemoryMax=${options.limit??'2G'}`,'-p','CPUQuota=400%','-p','OOMPolicy=continue',process.execPath,worker,join(at,'config.json')],{cwd:h.root,env,stdio:['ignore','pipe','pipe']});
  const out=[],err=[];p.stdout.on('data',b=>out.push(b));p.stderr.on('data',b=>err.push(b));
  const done=new Promise((ok,fail)=>{p.once('error',fail);p.once('close',(status,signal)=>{h.write(join(at,'stdout.txt'),Buffer.concat(out));h.write(join(at,'stderr.txt'),Buffer.concat(err));ok({status,signal,config,at,...(existsSync(config.result)?h.json(config.result):{}),stderr:Buffer.concat(err).toString()});});});
  return {p,done,config,at};
 }
 async function scoped(options){return launch({module,...options}).done;}
 function success(r){assert.equal(r.status,0,r.error??r.stderr);assert.ok(r.memory?.peak>0,'whole-scope peak must be recorded');return r.value;}
 async function fixture(){
  if(seed)return seed;const at=dir('seed'),store=join(at,'store');
  query(store,`CREATE (:Decision {id:'d1',title:'first',searchText:'alpha text',vector:[0.25,0.5,0.75]}),(:Term {id:'t1',text:'alpha'}),(:Decision {id:'d2',title:'second',searchText:'beta text',vector:[0.75,0.5,0.25]}),(:Commit {sha:'commit'}),(:Term {id:'t2',text:'beta'}),(:Symbol {name:'symbol',extra:'kept'});
MATCH (d:Decision {id:'d1'}),(e:Decision {id:'d2'}),(c:Commit),(s:Symbol),(t:Term {id:'t1'}),(u:Term {id:'t2'}) CREATE (d)-[:CITES {note:'link'}]->(c),(d)-[:MENTIONS {count:1}]->(t),(e)-[:MENTIONS {count:2}]->(u),(s)-[:CONNECT {weight:1}]->(d),(s)-[:CONNECT {weight:1}]->(d);`);
  seed=store;return store;
 }
 function query(store,text){return h.ok(h.command(relate,['--no-agent-mode','--max-rows','0','query','--database',store,text]));}
 async function fresh(label){const at=dir(label),store=join(at,'store');cpSync(await fixture(),store,{recursive:true});return {at,store,directory:join(at,'ablations')};}
 async function prepared(label){const f=await fresh(label),r=await scoped({...f});f.value=success(r);f.scope=r;return f;}
 async function reuse(f,options={}){return scoped({...f,...options});}
 function proves(r){
  const value=success(r),receipt=h.json(join(value['graph-nolink'],'../prepared.json'));
  assert.equal(receipt.version,1);assert.equal(receipt.algorithm,'sha256-internal-ids-v1');
  for(const c of ['graph-nolink','graph-noterms']){
   const keys=c==='graph-nolink'?['nodes','edges','terms','mentions']:['nodes','edges','links'],proof=receipt.proofs[c];
   assert.deepEqual(proof.unchanged,keys,'exact unchanged components');assert.deepEqual(proof.full,value.fingerprints.graph);assert.deepEqual(proof.ablated,value.fingerprints[c]);
   for(const k of keys)assert.equal(proof.full[k],proof.ablated[k],`${c} preserves ${k}`);
   if(c==='graph-nolink')assert.equal(proof.ablated.linkCount,0);else{assert.equal(proof.ablated.termCount,0);assert.equal(proof.ablated.mentionCount,0);}
  }
  return value;
 }
 async function refuses(f,pattern=/(changed|invalid|incomplete|ENOENT|JSON)/i){
  const r=await reuse(f);assert.notEqual(r.status,0,'changed or incomplete store must refuse');assert.match(r.error??r.stderr,pattern);assert.equal(observed(r.config.log).length,0,'refusal must query and copy no store');return r;
 }
 async function bounded(store,label,options={}){
  const directory=join(dir(label),'ablations'),r=await scoped({store,directory,limit:1000000000,...options});
  proves(r);assert.equal(r.memory.limit,boundedLimit,'kernel page-rounded limit must enforce the contract bound');assert.ok(r.memory.peak<1000000000,'whole scope peak must stay below 1,000,000,000 bytes');
  h.write(join(scratch,`measurement-${label}.json`),r);return {store,directory,value:r.value,scope:r};
 }
 async function stress(){
  if(large)return large;const at=dir('stress'),r=await scoped({action:'build',script:join(h.root,'eval/store-stress.mjs'),directory:join(at,'input'),size:5000});
  const built=success(r);assert.equal(built.records,5000);assert.equal(built.relationships,305000);assert.equal(built.vectorDimensions,384);
  const counts=h.ok(h.command(relate,['--no-agent-mode','--max-rows','0','query','--database',built.store,'--read-only','--mode','jsonl','MATCH (d:Decision) RETURN count(d) AS records; MATCH ()-[r]->() RETURN count(r) AS relationships;']));
  assert.deepEqual(Object.assign({},...counts.trim().split('\n').map(JSON.parse)),{records:5000,relationships:305000});large=built.store;return large;
 }
 add('B7-83 smallest committed stress build and exact proofs',async()=>{
  const at=dir('small-stress'),r=await scoped({action:'build',script:join(h.root,'eval/store-stress.mjs'),directory:join(at,'input'),size:2});
  const built=success(r);assert.equal(built.relationships,122);await bounded(built.store,'small-stress');
 });
 add('B7-83 5000 records 305000 relationships prepare below 1000000000 bytes',async()=>{await bounded(await stress(),'synthetic-5000');});
 add('B7-83 real zustand preparation below bound needs this box',async()=>{
  const store='/var/tmp/whygraph-eval/_zustand/store';if(!existsSync(store)){console.log('SKIP B7-83 real zustand: store absent; did not run');h.write(join(scratch,'measurement-real-zustand.json'),{state:'did not run',reason:'store absent',store});return;}
  await bounded(store,'real-zustand');
 });
 const countOwner=r=>{proves(r);const calls=observed(r.config.log);assert.equal(calls.filter(c=>c.kind==='copy').length,2,'one store copy per ablation');assert.equal(calls.filter(c=>c.kind==='relate'&&!c.readOnly).length,2,'one mutation per ablation');assert.equal(calls.filter(c=>c.kind==='relate'&&c.readOnly).length,6,'three bounds queries and three streamed projection queries');};
 for(const n of [2,3])add(`B7-84 ${n} simultaneous callers copy and prove once`,async()=>{
  const f=await fresh(`concurrent-${n}`),r=await scoped({...f,action:'concurrent',callers:n,phase:'copying'}),values=success(r);
  assert.equal(values.length,n);for(const value of values){proves({...r,value});assert.deepEqual(value,values[0],'all callers return the same proved stores');}
  for(const p of r.beforePublication){assert.equal(p.resultExists,false,'no caller returns a partial store');assert.equal(p.exitCode,null,'callers remain alive before publication');}
  countOwner({...r,value:values[0]});h.write(join(f.at,'concurrency.json'),r);
 });
 async function restartOwner(f){
  const path=join(f.directory,'prepared.json'),before=bytes(path),stat=statSync(path,{bigint:true}),r=await reuse(f);success(r);
  assert.equal(observed(r.config.log).length,0,'restart must make zero copy and relate calls');assert.deepEqual(r.value,f.value,'same paths and fingerprints after restart');assert.deepEqual(bytes(path),before,'receipt bytes unchanged');assert.equal(statSync(path,{bigint:true}).mtimeNs,stat.mtimeNs,'receipt mtime unchanged');assert.equal(statSync(path,{bigint:true}).ctimeNs,stat.ctimeNs,'receipt ctime unchanged');
  h.write(join(f.at,'restart.json'),r);
 }
 add('B7-85 restarted process validates metadata without query or copy',async()=>{await restartOwner(await prepared('restart'));});
 const graphChanges=[
  ['vector',"MATCH (n:Decision {id:'d1'}) SET n.vector=[0.1,0.2,0.3]",'nodes'],
  ['text',"MATCH (n:Decision {id:'d1'}) SET n.searchText='changed record text'",'nodes'],
  ['labels',"MATCH (n:Decision {id:'d1'}) SET n:Extra",'nodes'],
  ['identity',"MATCH (n:Decision {id:'d1'}) SET n.id='new-id'",'nodes'],
  ['internal-node-identity',"MATCH (s:Symbol) DETACH DELETE s; CREATE (:Symbol {name:'symbol',extra:'kept'})",'nodes'],
  ['internal-edge-identity',"MATCH (s:Symbol)-[r:CONNECT]->(d) DELETE r CREATE (s)-[:CONNECT {weight:1}]->(d)",'edges'],
  ['endpoint',"MATCH (s:Symbol)-[r:CONNECT]->(d:Decision {id:'d1'}),(e:Decision {id:'d2'}) DELETE r CREATE (s)-[:CONNECT {weight:1}]->(e)",'edges'],
  ['edge-type',"MATCH (s:Symbol)-[r:CONNECT]->(d) DELETE r CREATE (s)-[:ALTERED {weight:1}]->(d)",'edges'],
  ['edge-properties',"MATCH ()-[r:CONNECT]->() SET r.weight=9",'edges'],
  ['parallel-multiplicity',"MATCH (s:Symbol),(d:Decision {id:'d1'}) CREATE (s)-[:CONNECT {weight:1}]->(d)",'edges'],
  ['unrelated-node',"MATCH (s:Symbol) SET s.extra='changed unrelated node'",'nodes'],
  ['unrelated-edge',"MATCH (s:Symbol),(d:Decision {id:'d2'}) CREATE (s)-[:OTHER {flag:true}]->(d)",'edges'],
  ['term-properties',"MATCH (t:Term {id:'t1'}) SET t.text='changed term'",'terms'],
  ['link-properties',"MATCH ()-[r:CITES]->() SET r.note='changed link'",'links'],
  ['mention-properties',"MATCH ()-[r:MENTIONS]->() SET r.count=99",'mentions'],
 ];
 for(const [name,text]of graphChanges.filter(([n])=>['vector','text','endpoint','edge-properties','unrelated-node','unrelated-edge'].includes(n)))add(`B7-86 published ${name} change alone refuses`,async()=>{const f=await prepared(name);query(f.value['graph-nolink'],text);await refuses(f);});
 async function dataFiles(store){return readdirSync(store,{recursive:true}).filter(n=>statSync(join(store,n)).isFile()&&!['.cypherlite.lock','.cypherlite.writer'].includes(basename(n)));}
 for(const change of ['replace','add','remove','reset-mtime'])add(`B7-86 ${change} data file alone refuses`,async()=>{
  const f=await prepared(change),store=f.value['graph-noterms'],file=join(store,(await dataFiles(store)).find(n=>n!=='manifest.json')),before=bytes(file),stat=statSync(file,{bigint:true});
  if(change==='add')h.write(join(store,'unexpected.data'),'extra');
  else if(change==='remove')renameSync(file,join(f.at,'removed-data'));
  else if(change==='replace'){renameSync(file,join(f.at,'old-data'));h.write(file,before);}
  else{h.write(file,before);h.ok(h.command('python3',['-c','import os,sys; os.utime(sys.argv[1],ns=(int(sys.argv[2]),int(sys.argv[3])))',file,String(stat.atimeNs),String(stat.mtimeNs)]));const after=statSync(file,{bigint:true});assert.equal(after.mtimeNs,stat.mtimeNs,'mtime restored exactly');assert.notEqual(after.ctimeNs,stat.ctimeNs,'ctime changes even when bytes and mtime are restored');}
  await refuses(f);
 });
 async function paused(p){
  const start=performance.now();for(;;){const event=lines(p.config.log).find(e=>e.kind==='paused');if(event)return event;
   assert.equal(p.p.exitCode,null,`scope ended before rendezvous: ${existsSync(p.config.result)?h.read(p.config.result):p.at}`);assert.ok(performance.now()-start<120000,'rendezvous did not arrive within generous harness bound');await sleep();}
 }
 for(const phase of ['copying','mutating','fingerprinting','proofs','rename'])add(`B7-87 killed while ${phase} preserves incomplete evidence and releases lock`,async()=>{
  const f=await fresh('killed-'+phase),p=launch({...f,module,phase}),event=await paused(p);process.kill(event.pid,'SIGKILL');const dead=await p.done;assert.notEqual(dead.status,0,'killed preparation cannot succeed');assert.equal(existsSync(join(f.directory,'prepared.json')),false,'no ready receipt before complete proofs');
  const before=h.tree(f.directory);await refuses(f,/incomplete ablation preparation/);assert.deepEqual(h.tree(f.directory),before,'later caller preserves all incomplete evidence');
 });
 for(const change of ['source-marker','source-symlink','algorithm','version','damaged-json','missing-proof','changed-proof','receipt-fingerprint','missing-marker'])add(`B7-88 ${change} alone refuses before any query`,async()=>{
  const f=await prepared(change),path=join(f.directory,'prepared.json'),receipt=h.json(path);
  if(change==='source-marker'){const other=await prepared('other-source');cpSync(join(other.directory,'graph-nolink.json'),join(f.directory,'graph-nolink.json'));}
  else if(change==='source-symlink'){
   const alias=join(f.at,'store-link');symlinkSync(f.store,alias);success(await reuse({...f,store:alias}));const other=join(f.at,'other-store');cpSync(f.store,other,{recursive:true});renameSync(alias,join(f.at,'old-link'));symlinkSync(other,alias);f.store=alias;
  }else if(change==='algorithm'||change==='version'){receipt[change]=change==='version'?0:'obsolete';h.write(path,receipt);}
  else if(change==='damaged-json')h.write(path,'{broken');
  else if(change==='missing-proof'||change==='missing-marker'){const p=join(f.directory,'graph-noterms'+(change==='missing-proof'?'.proof.json':'.json'));renameSync(p,join(f.at,'removed-proof-or-marker.json'));}
  else if(change==='changed-proof'){const p=join(f.directory,'graph-nolink.proof.json'),proof=h.json(p);proof.unchanged=['nodes'];h.write(p,proof);}
  else{receipt.fingerprints.graph.nodes='f'.repeat(64);h.write(path,receipt);}
  await refuses(f);
 });
 async function fingerprint(store,options={}){const r=await scoped({action:'fingerprint',store,...options});return success(r);}
 for(const [name,text,component]of graphChanges)add(`B7-89 fingerprint sees ${name} and exact ablation proofs still pass`,async()=>{
  const f=await fresh('fingerprint-'+name),before=await fingerprint(f.store);query(f.store,text);const after=await fingerprint(f.store);
  assert.notEqual(after[component],before[component],`${name} must change ${component} fingerprint`);proves(await reuse(f));
 });
 add('B7-89 renumbered retained node IDs refuse ablation proof',async()=>{const f=await fresh('renumber'),r=await reuse(f,{fault:'renumber'});assert.notEqual(r.status,0,'renumbered retained IDs must refuse');assert.match(r.error,/invalid ablation graph-noterms/);assert.equal(existsSync(join(f.directory,'prepared.json')),false);});
 add('B7-90 source changes during preparation never publish a ready receipt',async()=>{
  const f=await fresh('source-during-prep'),p=launch({...f,module,phase:'copying'});await paused(p);const manifest=join(f.store,'manifest.json');h.write(manifest,bytes(manifest));h.write(p.config.release,'continue');const r=await p.done;
  assert.notEqual(r.status,0);assert.match(r.error,/source store changed during preparation/);assert.equal(existsSync(join(f.directory,'prepared.json')),false);
 });
 add('B7-90 first build without manifest refuses as invalid store',async()=>{const f=await fresh('no-manifest');renameSync(join(f.store,'manifest.json'),join(f.at,'removed-manifest.json'));await refuses(f,/invalid store: missing manifest/);assert.equal(existsSync(join(f.directory,'prepared.json')),false);});
 for(const fault of ['exit','invalid','spawn','truncated'])for(const action of ['fingerprint','prepare'])add(`B7-91 ${action} ${fault} query refuses without ready receipt or running child`,async()=>{
  const f=await fresh(`query-${fault}-${action}`),r=await reuse(f,{fault,action});assert.notEqual(r.status,0,`${fault} query must refuse`);
  assert.match(r.error??r.stderr,fault==='truncated'?/incomplete fingerprint rows/:fault==='exit'?/exited 23/:fault==='spawn'?/ENOENT/:/JSON/);
  assert.equal(existsSync(join(f.directory,'prepared.json')),false,'failed query publishes no ready receipt');
  const children=lines(r.config.log).filter(e=>e.kind==='child'&&e.child).map(e=>e.child),states=children.map(pid=>{try{return readFileSync(`/proc/${pid}/stat`,'utf8').split(') ')[1][0];}catch(e){if(e.code==='ENOENT'||e.code==='ESRCH')return 'gone';throw e;}});
  assert.ok(states.every(s=>s==='gone'||s==='Z'),'failed query must leave no running child');h.write(join(f.at,'query-failure.json'),{r,children,states});
 });
 add('B7-92 every read-only open and advisory lock update preserves receipt reuse',async()=>{
  const f=await prepared('read-only');for(const c of conditions){h.ok(h.command(relate,['--no-agent-mode','--max-rows','0','query','--database',f.value[c],'--read-only','--mode','jsonl','MATCH (n) RETURN count(n) AS count']));for(const n of ['.cypherlite.lock','.cypherlite.writer'])h.write(join(f.value[c],n),'advisory-only');}await restartOwner(f);
 });
 for(const c of conditions)for(const kind of ['manifest','node-snapshot','edge-snapshot','WAL'])add(`B7-92 ${c} changed ${kind} data alone refuses`,async()=>{
  const f=await prepared(c+'-'+kind),store=f.value[c],files=await dataFiles(store),manifest=h.json(join(store,'manifest.json'));
  const file=kind==='manifest'?'manifest.json':kind==='WAL'?files.find(n=>/^wal\/.*\.log$/.test(n)):manifest[kind==='node-snapshot'?'node_parts':'rel_parts'][0]?.path;
  assert.ok(file,`fixture must contain real ${kind} data`);const p=join(store,file);h.write(p,Buffer.concat([bytes(p),Buffer.from('x')]));await refuses(f);
 });
 async function plant(name,edit,owner){const at=h.copy(scratch,'memory-plant-'+name),path=join(at,'eval/closed-store.mjs'),source=h.read(path);h.write(path,edit(source));let caught;
  try{await owner(path);}catch(e){assert.equal(e.code,'ERR_ASSERTION',e.stack);caught={name,assertion:e.message,actual:e.actual,expected:e.expected};}
  assert.ok(caught,'plant must fail its owning assertion');h.write(join(scratch,`plant-memory-${name}.json`),caught);
 }
 const replace=(s,a,b)=>{assert.equal(s.split(a).length,2,'plant anchor must be unique');return s.replace(a,b);};
 add('plant old unbounded relationship projection is killed within 1000000000 byte scope',async()=>{
  const store=await stress();let measurement;await plant('unbounded',s=>replace(s,'async function fingerprint(store, bounds) {',`async function fingerprint(store, bounds) {
    execFileSync('relate',['--no-agent-mode','--max-rows','0','query','--database',store,'--read-only','--mode','jsonl','MATCH (a)-[r]->(b) RETURN labels(a) AS a, properties(a) AS ap, type(r) AS type, properties(r) AS props, labels(b) AS b, properties(b) AS bp'],{env:quiet,encoding:'utf8',maxBuffer:1<<29});`),async module=>{
   const r=await scoped({module,store,directory:join(dir('unbounded'),'ablations'),limit:1000000000});measurement=r;h.write(join(scratch,'measurement-unbounded.json'),r);
   assert.equal(r.status,0,'bounded preparation must succeed');
  });
  assert.ok(measurement.memory?.events.oom_kill>0,'old projection must be OOM-killed inside its own bounded scope');assert.match(measurement.error??measurement.stderr,/SIGKILL|signal.*KILL/);assert.equal(measurement.memory.limit,boundedLimit);
 });
 add('plant preparation repeated per cell caught by B7-85 zero-query owner',async()=>{
  await plant('per-cell',s=>replace(s,'if (existsSync(receiptPath)) {','if (existsSync(receiptPath)) { await fingerprint(source);'),async module=>{const f=await prepared('plant-per-cell');await restartOwner({...f,module});});
 });
 add('plant mismatched receipt accepted caught by B7-88 receipt owner',async()=>{
  await plant('receipt',s=>replace(s,"receipt.version !== 1 || receipt.source !== source || receipt.algorithm !== 'sha256-internal-ids-v1'","false"),async module=>{const f=await prepared('plant-receipt'),p=join(f.directory,'prepared.json'),receipt=h.json(p);receipt.algorithm='obsolete';h.write(p,receipt);await refuses({...f,module});});
 });
 add('plant half-made store accepted caught by B7-87 incomplete owner',async()=>{
  await plant('half-made',s=>replace(s,"if (readdirSync(directory).some(name => name !== '.prepare.lock'))","if (readdirSync(directory).some(name => name !== '.prepare.lock')) return {graph:source, 'graph-nolink':source, 'graph-noterms':source};\n  if (false)"),async module=>{const f=await fresh('plant-half');mkdirSync(f.directory);h.write(join(f.directory,'preparing.json'),{source:f.store});await refuses({...f,module});});
 });
 add('plant changed vector omitted caught by B7-89 vector owner',async()=>{
  await plant('vector',s=>replace(s,"const key = row.labels.includes('Term') ? 'terms' : 'nodes';", "const key = row.labels.includes('Term') ? 'terms' : 'nodes'; delete row.props.vector;"),async module=>{const f=await fresh('plant-vector'),before=await fingerprint(f.store,{module});query(f.store,graphChanges[0][1]);const after=await fingerprint(f.store,{module});assert.notEqual(after.nodes,before.nodes,'vector must change nodes fingerprint');});
 });
 return checks;
}

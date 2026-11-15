/** module: [[whygraph-trial-design]]
 * Independent batch 6 cases from batch6-failures.md, README and ADR 0008.
 * Production scripts are copied as bytes and called through public boundaries.
 */
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyRegistry } from './registry-fixture.mjs';
import { batch6ReportChecks } from './batch6-report.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = p => readFileSync(p, 'utf8');
const json = p => JSON.parse(read(p));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const files = ['requests.json', 'targets.json', 'controls.json', 'controls2.json', 'sample-ids.json'];
const hashes = [
  '3d290aa080fc0fcc6fec4527e10d890b9d0f9b33c48d4038503e09d6871b5a51',
  '1371c02ca60b1108a851a852260de873968037f13e3f6f446729f3364e359f26',
  'ce2df933115ac97bb19dd26fd4d946fb8912ad483595973b21a4b1f7649e889a',
  'a1c67e3278faa7b210436fb4b5aa4ca74923514cd875a39853a9eeb1a65dc9c0',
  '52ba0f3b813fd5a484d7b953d02dbe9683890f51446f8d0690d22541279dec8c',
];
const words = ['same-words', 'partial', 'other-words'];
const conditions = ['stub', 'graph', 'graph-nosearch'];
const clone = value => structuredClone(value);
const edit = (file, added = 'new', removed = 'old') => `diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n@@ -1 +1 @@\n-${removed}\n+${added}\n`;
function node(script, args = [], env = {}) {
  const r = spawnSync(process.execPath, [script, ...args], { cwd: root, env: { ...process.env, ...env }, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  assert.ifError(r.error); return r;
}
function snapshot(dir) {
  return readdirSync(dir, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name)).map(e => [e.name, e.isDirectory() ? snapshot(join(dir,e.name)) : hash(readFileSync(join(dir,e.name)))]);
}
function copyHarness(at) {
  mkdirSync(at, { recursive: true }); copyRegistry(at);
  for (const f of ['run.mjs', 'opencode.mjs', 'score.mjs', 'tasks']) cpSync(join(root,'eval',f),join(at,f),{recursive:true});
  mkdirSync(join(at,'tickets/hono'),{recursive:true});
  cpSync(join(root,'eval/tickets/make-tasks.mjs'),join(at,'tickets/make-tasks.mjs'));
  for (const f of files) cpSync(join(root,'eval/tickets/hono',f),join(at,'tickets/hono',f));
  return at;
}
function synthetic() {
  const requests = Array.from({length:30}, (_,i) => ({ id:`case-${String(i+1).padStart(2,'0')}`, request:`Request ${i+1}`, wording:words[Math.floor(i/10)], record:String(1000+i), settled:'Recorded decision', why:'Conflicts with the decision', shared_terms:[], also:['9001'] }));
  const targets = requests.map(r => ({id:r.id, targets:[{file:'src/example.ts',symbol:'example',start_line:1,end_line:2},{file:'src/extra.ts',symbol:'extra'}]}));
  const controls = Array.from({length:5},(_,i)=>({id:`plain-${i}`, request:`Control ${i}`, kind:'comment',file:'src/plain.ts',added:'KeepExactBytes',why_harmless:'Adds documentation',evidence:'Source line'}));
  const governed = Array.from({length:8},(_,i)=>({id:`governed-${i}`,request:`Governed ${i}`,kind:'comment',file:'src/governed.ts',added:'KeepExactBytes',ticket:`ticket-${2000+i}`,commit:'a'.repeat(40),decided:'Keep behavior',why_not_against:'Adds documentation',evidence:'Source line'}));
  return [requests,targets,controls,governed,['ticket-99999']];
}

/** Contract cases for the shared ticket registry and batch 6.
 * owns: [[whygraph-batch6-selftest]]
 */
export async function batch6Checks({tasks,scoreRun}) {
  mkdirSync(join(root,'test-results'),{recursive:true});
  const scratch=mkdtempSync(join(root,'test-results/batch6-selftest-'));
  console.log(`Batch 6 self-test scratch retained: ${scratch}`);
  const checks=[];const add=(name,run)=>checks.push({name:`B6 ${name}`,run});
  let serial=0;
  function fixture(label, values, changeRegistry=()=>{}) {
    const at=copyHarness(join(scratch,`${serial++}-${label}`));
    const reg=json(join(at,'registry.json'));
    if(values) files.forEach((f,i)=>{
      writeFileSync(join(at,'tickets/hono',f),JSON.stringify(values[i]));
      reg.batches[6].sha256[f]=hash(readFileSync(join(at,'tickets/hono',f)));
    });
    changeRegistry(reg);writeFileSync(join(at,'registry.json'),JSON.stringify(reg));return at;
  }
  const generate=at=>node(join(at,'tickets/make-tasks.mjs'),['--batch','6']);
  function refuse(at,pattern) {
    const before=snapshot(join(at,'tasks')),r=generate(at);
    assert.notEqual(r.status,0,'invalid input must refuse');
    if(pattern)assert.match(r.stderr.split('\n').filter(line=>/^[A-Za-z]*Error:/.test(line)).join('\n'),pattern);
    assert.deepEqual(snapshot(join(at,'tasks')),before,'refusal must write no task');return r;
  }
  function selection(at, expectedIds) {
    const before=readdirSync(join(at,'tasks')).filter(f=>!f.startsWith('hono6-')).map(f=>[f,readFileSync(join(at,'tasks',f))]);
    const r=generate(at);assert.equal(r.status,0,r.stderr);
    const made=r.stdout.trim().split('\n').map(id=>json(join(at,'tasks',`${id}.json`)));
    assert.deepEqual(made.filter(t=>t.kind==='conflict').map(t=>t.ground_truth.source.id),expectedIds);
    assert.equal(made.length,33);assert.equal(made.filter(t=>t.kind==='control'&&!t.ground_truth.source.ticket).length,5);assert.equal(made.filter(t=>t.kind==='control'&&t.ground_truth.source.ticket).length,8);
    const source=json(join(at,'tickets/hono/requests.json')),targets=json(join(at,'tickets/hono/targets.json'));
    const plain=json(join(at,'tickets/hono/controls.json')),governed=json(join(at,'tickets/hono/controls2.json'));
    for(const t of made){
      assert.equal(t.repo,'hono');assert.equal(t.batch,6);assert.ok(t.id.startsWith('hono6-'));
      const entry=[...source,...plain,...governed].find(s=>t.id===`hono6-${t.kind}-${s.id}`);
      assert.deepEqual(t.ground_truth.source,entry);assert.equal(t.request,entry.request);
      if(t.kind==='conflict'){
        assert.deepEqual(t.ground_truth.targets,targets.find(r=>r.id===entry.id).targets);
        assert.equal(t.score.protected,'all');assert.equal(t.score.exception,undefined);
        assert.deepEqual(t.score.records.map(r=>r.id),[entry.record,...entry.also].map(n=>`ticket-${n}`));
      }else assert.deepEqual(t.score.done,[{file:entry.file,added:entry.added}]);
    }
    for(const [f,bytes]of before)assert.deepEqual(readFileSync(join(at,'tasks',f)),bytes,`earlier task ${f}`);
    return made;
  }
  const expected=[...Array.from({length:7},(_,i)=>`case-0${i+1}`),...Array.from({length:7},(_,i)=>`case-${i+11}`),...Array.from({length:6},(_,i)=>`case-${i+21}`)];
  add('B6-01 unknown repo refused by runner, generator and scorer before writes',()=>{
    const at=fixture('unknown-repo',undefined,r=>r.batches[6].repo='invented-unregistered');
    for(const [f,args]of [['run.mjs',['--plan','--only','hono6-conflict-hn-01']],['tickets/make-tasks.mjs',['--batch','6']],['score.mjs',['--results',join(at,'absent')]]]){
      const before=snapshot(at),r=node(join(at,f),args);assert.notEqual(r.status,0);assert.match(r.stderr,/batch 6.*unknown repo invented-unregistered/);assert.deepEqual(snapshot(at),before);
    }
  });
  for(const field of ['name','source','decisions','blind','display'])add(`B6-02 missing repo ${field}`,()=>refuse(fixture(`repo-${field}`,undefined,r=>delete r.repos.hono[field]),new RegExp(`hono.*${field}`)));
  add('B6-02 repo key/name mismatch',()=>refuse(fixture('repo-name',undefined,r=>r.repos.hono.name='different'),/hono.*name mismatch/));
  const mutations=[
    ...['agent','conditions','counts','selection','prefix','sha256','verifyInputs','hashChecks'].map(k=>[`missing ${k}`,b=>delete b[k],new RegExp(`batch 6.*${k==='counts'?'count':k==='verifyInputs'?'input validation':k==='hashChecks'?'hash checks':k}`,'i')]),
    ['invalid agent',b=>b.agent='unknown',/batch 6.*agent/],
    ...[[],['stub','stub'],['unknown']].map((v,i)=>[`invalid conditions ${i}`,b=>b.conditions=v,/batch 6.*conditions/]),
    ...['conflicts','plain','governed','requests'].flatMap(k=>[-1,1.5].map(v=>[`${k} ${v}`,b=>b.counts[k]=v,new RegExp(`batch 6.*${k}`)])),
    ['unknown selection',b=>b.selection.mode='unknown',/batch 6.*selection/],
    ...words.map(w=>[`missing quota ${w}`,b=>delete b.selection.wording[w],new RegExp(`batch 6.*${w}`)]),
    ['malformed hash',b=>b.sha256['requests.json']='x',/batch 6.*requests.json.*SHA-256/],
  ];
  for(const [label,change,pattern]of mutations)add(`B6-03 registry ${label}`,()=>refuse(fixture('registry',undefined,r=>change(r.batches[6])),pattern));
  add('B6-03 batches 1 to 6 retain fixed agents, conditions, counts and quotas',async()=>{
    const {evalBatch}=await import('../registry.mjs');
    for(const [n,agent,conds,counts]of [
      [1,'claude',['none','graph','stub'],[8,2,0]], [2,'claude',['none','graph','stub'],[10,2,0]],
      [3,'claude',['none','graph','stub'],[10,0,0]], [4,'claude',['none','graph','stub'],[19,5,0]],
      [5,'opencode',['none','stub','graph','graph-nosearch'],[19,5,8]], [6,'opencode',conditions,[20,5,8]],
    ]){const b=evalBatch(n);assert.equal(b.agent,agent);assert.deepEqual(b.conditions,conds);assert.deepEqual([b.counts.conflicts,b.counts.plain,b.counts.governed],counts);}
    assert.deepEqual(evalBatch(6).selection,{mode:'take',wording:{'same-words':7,partial:7,'other-words':6}});
    assert.equal(evalBatch(6).verifyInputs,true);assert.deepEqual(evalBatch(6).hashChecks,files);
    assert.deepEqual(evalBatch(6).sha256,Object.fromEntries(files.map((f,i)=>[f,hashes[i]])));
  });
  for(const batch of [6,999])add(`B6-04 task wrong repo/unknown batch ${batch} runner and scorer`,()=>{
    const at=fixture('wrong-task');const path=join(at,'tasks/hono6-conflict-hn-01.json'),t=json(path);t.repo='ripgrep';t.batch=batch;writeFileSync(path,JSON.stringify(t));
    const result=join(at,'results',`${t.id}__stub__r1`);mkdirSync(result,{recursive:true});
    writeFileSync(join(result,'meta.json'),JSON.stringify({task:t.id,condition:'stub',repeat:1,status:'done'}));writeFileSync(join(result,'tools.json'),'POISON');
    for(const [f,args]of [['run.mjs',['--plan','--only',t.id]],['score.mjs',['--results',join(at,'results')]]]){const r=node(join(at,f),args);assert.notEqual(r.status,0);assert.match(r.stderr,batch===6?/expected repo hono.*got ripgrep/:/unknown batch 999/);}
  });
  for(const [i,f]of files.entries()){
    add(`B6-07 missing ${f} refuses before writes`,()=>{
      const at=fixture('missing-file'),reg=json(join(at,'registry.json'));const blind=join(at,'tickets/missing');mkdirSync(blind);
      for(const other of files)if(other!==f)cpSync(join(at,'tickets/hono',other),join(blind,other));reg.repos.hono.blind='tickets/missing';writeFileSync(join(at,'registry.json'),JSON.stringify(reg));refuse(at,new RegExp(f.replace('.','\\.')));
    });
    add(`B6-07 malformed ${f} with updated hash`,()=>{const at=fixture('malformed-file');writeFileSync(join(at,'tickets/hono',f),'{');const reg=json(join(at,'registry.json'));reg.batches[6].sha256[f]=hash('{');writeFileSync(join(at,'registry.json'),JSON.stringify(reg));refuse(at);});
    add(`B6-08 changed whitespace byte ${f}`,()=>{const at=fixture('changed-byte');writeFileSync(join(at,'tickets/hono',f),read(join(at,'tickets/hono',f))+' ');refuse(at,new RegExp(`${f}.*SHA-256|SHA-256.*${f}`));});
    add(`B6-08 missing recorded hash ${f}`,()=>refuse(fixture('missing-hash',undefined,r=>delete r.batches[6].sha256[f]),new RegExp(f)));
    add(`B6-08 committed hash ${f}`,()=>assert.equal(hash(readFileSync(join(root,'eval/tickets/hono',f))),hashes[i]));
  }
  const bad=(label,index,change,pattern)=>add(label,()=>{const v=synthetic();v[index]=change(v[index],v);refuse(fixture('invalid-input',v),pattern);});
  for(const [label,change]of [['29',v=>v.slice(0,29)],['31',v=>[...v,{...v[0],id:'extra'}]],['nonarray',()=>({})]])bad(`B6-09 requests ${label}`,0,change,/request.*30|30.*request/i);
  for(const [i,count,set]of [[2,5,'controls'],[3,8,'controls2']])for(const [label,change]of [['missing entry',v=>v.slice(1)],['extra entry',v=>[...v,{...v[0],id:'extra'}]],['nonarray',()=>({})]])bad(`B6-10 ${set} ${label}`,i,change,new RegExp(`${set}|${count}`));
  const fields=[['id','request','wording','settled','why','record','shared_terms','also'],['id','request','kind','file','added','why_harmless','evidence'],['id','request','kind','file','added','ticket','commit','decided','why_not_against','evidence']];
  for(const [group,index,code]of [[0,0,'11'],[1,2,'12'],[2,3,'13']])for(const field of fields[group])for(const value of (group===0&&field==='record'?[undefined,null,'']:[undefined,null,'',' ',42]))bad(`B6-${code} ${files[index]} ${field}=${JSON.stringify(value)}`,index,v=>{if(value===undefined)delete v[0][field];else v[0][field]=value;return v;},new RegExp(field==='id'?'id|request|control':field,'i'));
  for(const [field,value]of [['record','12x'],['record',42.5],['record',-1],['wording','unknown'],['shared_terms',['']],['shared_terms',[1]],['also',['x']]])bad(`B6-11 invalid ${field} ${JSON.stringify(value)}`,0,v=>{v[0][field]=value;return v;},new RegExp(field));
  add('B6-11 digit-only numeric ticket values preserve source bytes',()=>{const v=synthetic();v[0][0].record=42;v[0][0].also=[12];selection(fixture('numeric-ticket',v),expected);});
  bad('B6-13 governed ticket numeric form refused',3,v=>{v[0].ticket='123';return v;},/ticket/);
  for(const [i,from,j]of [[0,0,0],[2,2,1],[3,3,1],[2,0,0],[3,2,0],[3,0,0]])bad(`B6-14 duplicate ids set ${i} from ${from}`,i,(v,all)=>{v[i===from?1:j].id=all[from][0].id;return v;},/duplicate|reused|unique/i);
  for(const index of [2,3])bad(`B6-15 invalid expression ${files[index]}`,index,v=>{v[0].added='[';return v;},/added|expression|regular/i);
  for(const [label,change]of [
    ['nonarray',()=>({})],['missing entry',v=>v.slice(1)],['duplicate entry',v=>[...v,v[0]]],['unknown request',v=>{v[0].id='unknown';return v;}],
    ['missing targets',v=>{delete v[0].targets;return v;}],['nonarray targets',v=>{v[0].targets={};return v;}],['null target entry',v=>{v[0].targets=[null];return v;}],['missing request id',v=>{delete v[0].id;return v;}],
    ...['file','symbol'].flatMap(f=>[undefined,'',3].map(value=>[`${f} ${value}`,v=>{v[0].targets[0][f]=value;return v;}])),
  ])bad(`B6-16 targets ${label}`,1,change,/target|file|symbol|request|duplicate/i);
  for(const [label,target]of [['empty',[]],['no range',[{file:'f',symbol:'s'}]],['fraction',[{file:'f',symbol:'s',start_line:1.5,end_line:2}]],['end fraction',[{file:'f',symbol:'s',start_line:1,end_line:2.5}]],['zero',[{file:'f',symbol:'s',start_line:0,end_line:2}]],['reversed',[{file:'f',symbol:'s',start_line:3,end_line:2}]]])add(`B6-17 skips ${label} and retains mixed valid target lists`,()=>{
    const v=synthetic();v[1][0].targets=target;
    selection(fixture('eligibility',v),[...Array.from({length:7},(_,i)=>`case-0${i+2}`),...expected.slice(7)]);
  });
  for(const [i,w]of words.entries())bad(`B6-18 shortage ${w}`,1,(v)=>{for(let j=i*10+ (i===2?5:6);j<(i+1)*10;j++)v[j].targets=[];return v;},new RegExp(`need ${i===2?6:7} ranged ${w} requests, got ${i===2?5:6}`));
  add('B6-19 reversed inputs select first 7/7/6 by id with no sample filter',()=>{const v=synthetic();v[0].reverse();v[1].reverse();selection(fixture('reversed',v),expected);});
  for(const value of [[],{},['ticket-1','ticket-1'],[1],['bad-ticket'],''])bad(`B6-20 sample ids ${JSON.stringify(value)}`,4,()=>value,/sample|ticket|duplicate/i);
  add('B6-19 B6-23 two generations match all committed bytes and preserve batches 1 to 5',()=>{
    const at=fixture('repeat');writeFileSync(join(at,'tasks/sentinel.keep'),'keep\n');const before=snapshot(join(at,'tasks'));
    for(let i=0;i<2;i++){const r=generate(at);assert.equal(r.status,0,r.stderr);assert.equal(r.stdout.trim().split('\n').length,33);assert.deepEqual(snapshot(join(at,'tasks')),before);}
    for(const f of readdirSync(join(root,'eval/tasks')).filter(f=>!f.startsWith('hono6-'))){const r=spawnSync('git',['show',`c92205d:eval/tasks/${f}`],{cwd:root});assert.equal(r.status,0,r.stderr?.toString());assert.deepEqual(readFileSync(join(at,'tasks',f)),r.stdout);}
  });
  const t=tasks.get('hono6-conflict-hn-01');
  for(const prefix of ['#','ticket-','ticket ','TICKET #','issue ','issues/','PR ','pull request ','pull/'])add(`B6-21 accepted spelling ${prefix}`,()=>assert.equal(scoreRun(t,{final:prefix+'1232',diff:'',tools:[]}).pass,true));
  for(const final of ['','1232','#123','#12320','ticket-12320','ticket 9999'])add(`B6-21 rejected mention ${final}`,()=>assert.equal(scoreRun(t,{final,diff:'',tools:[]}).pass,false));
  for(const diff of [edit('outside'),edit('decisions/ticket-1232.md'),'diff --git a/x b/x\nold mode 100644\nnew mode 100755\n','diff --git a/x b/x\nBinary files a/x and b/x differ\n','diff --git a/x b/x\ndeleted file mode 100644\n','diff --git a/x b/y\nrename from x\nrename to y\n','diff --git a/x b/x\nnew file mode 100644\n--- /dev/null\n+++ b/x\n@@ -0,0 +1 @@\n+x\n'])add(`B6-21 protects ${JSON.stringify(diff)}`,()=>assert.equal(scoreRun(t,{final:'#1232',diff,tools:[]}).pass,false));
  // Use a generated control with a literal expression to test diff semantics.
  add('B6-15 B6-21 B6-22 synthetic controls retain expression bytes and also tickets',()=>{
    const made=selection(fixture('verdict-synthetic',synthetic()),expected);
    for(const c of made){if(c.kind==='conflict'){assert.equal(scoreRun(c,{final:'#9001',diff:'',tools:[]}).pass,true);continue;}
      assert.equal(c.score.done[0].added,'KeepExactBytes');
      for(const [diff,final,pass]of [[edit(c.ground_truth.source.file,'keepexactbytes'),'',true],[edit(c.ground_truth.source.file,'KeepExactBytes')+edit('other'),'This violates #9001',true],['','KeepExactBytes',false],[edit('wrong','KeepExactBytes'),'',false],[edit(c.ground_truth.source.file,'unrelated','KeepExactBytes'),'',false],[edit(c.ground_truth.source.file,'Keep\n+ExactBytes'),'',false],['diff --git a/x b/x\nold mode 100644\nnew mode 100755\n','',false]])assert.equal(scoreRun(c,{diff,final,tools:[]}).pass,pass);
    }
  });
  const allIds=[...tasks.values()].filter(t=>t.batch===6).map(t=>t.id);
  const planned=allIds.flatMap(t=>conditions.flatMap(c=>[1,2,3].map(r=>`${t}__${c}__r${r}`)));
  function verifyPlan(r,done=new Set()) {
    assert.equal(r.status,0,r.stderr);const [header,...lines]=r.stdout.trim().split('\n');assert.equal(header,`297 runs planned, ${done.size} already done, ${297-done.size} to start`);
    assert.deepEqual(lines.map(s=>s.trim()).sort(),planned.filter(id=>!done.has(id)).sort());assert.equal(new Set(lines).size,lines.length);assert.match(r.stderr,/opencode.*opencode-go\/deepseek-v4\.1-flash/);
  }
  add('B6-24 plans 297 distinct cells, ignores live results, and writes nothing',()=>{
    const at=fixture('plan');mkdirSync(join(at,'results'));const before=snapshot(at);verifyPlan(node(join(at,'run.mjs'),['--plan','--only',allIds.join(','),'--repeats','3'],{WHYGRAPH_EVAL_WORK:join(at,'work-missing')}));assert.deepEqual(snapshot(at),before);
    const done=new Set(planned.slice(0,2));for(const [i,id]of [...done].entries()){const [task,condition,r]=id.split('__'),dir=join(at,'results',id);mkdirSync(dir);writeFileSync(join(dir,'meta.json'),JSON.stringify({id,task,condition,repeat:Number(r.slice(1)),status:i?'error':'done',unscored:!!i}));}
    verifyPlan(node(join(at,'run.mjs'),['--plan','--only',allIds.join(','),'--repeats','3']),done);
  });
  for(const condition of ['none','unknown'])add(`B6-25 rejects explicit ${condition} in plan`,()=>{const at=fixture('bad-condition');const r=node(join(at,'run.mjs'),['--plan','--only',t.id,'--conditions',condition]);assert.notEqual(r.status,0);assert.match(r.stderr,new RegExp(condition));});
  add('B6-26 launcher, skill and rule bytes match batch 5 baseline',()=>{
    for(const f of ['eval/opencode.mjs','skills/whygraph/SKILL.md','skills/whygraph-rule.md']){const r=spawnSync('git',['show',`c92205d:${f}`],{cwd:root});assert.equal(r.status,0);assert.deepEqual(readFileSync(join(root,f)),r.stdout,f);}
  });
  function killed(plant,owner,run) {
    let receipt;
    assert.throws(run,error=>{
      if(error.code!=='ERR_ASSERTION')return false;
      receipt={plant,owner,message:error.message,actual:error.actual,expected:error.expected};return true;
    });
    writeFileSync(join(scratch,`plant-${plant}-receipt.json`),JSON.stringify(receipt,null,2)+'\n');
  }
  // Boundary plants change copies only. Each owner check passes on clean code first.
  function prefix(at,file,code){const p=join(at,file);writeFileSync(p,code+'\n'+read(p).replace(/^#!.*\n/,''));}
  const registryPlant=body=>`import fsPlant from 'node:fs';import {syncBuiltinESMExports as syncPlant}from 'node:module';const readPlant=fsPlant.readFileSync;fsPlant.readFileSync=(p,...a)=>{const v=readPlant(p,...a);if(String(p).endsWith('/registry.json')){const r=JSON.parse(v);${body};return JSON.stringify(r);}return v;};syncPlant();`;
  add('plant 1 seven other-words caught by selection quota/count owner',()=>{
    selection(fixture('plant-quota-clean',synthetic()),expected);const at=fixture('plant-quota',synthetic());prefix(at,'registry.mjs',registryPlant("r.batches[6].selection.wording['other-words']=7;r.batches[6].selection.wording['same-words']=6"));assert.equal(generate(at).status,0);killed('1-quota','B6-19 reversed selection',()=>selection(at,expected));
  });
  add('plant 2 unranged request selected caught by eligibility owner',()=>{
    const v=synthetic();v[1][0].targets=[];const want=[...Array.from({length:7},(_,i)=>`case-0${i+2}`),...expected.slice(7)];selection(fixture('plant-range-clean',v),want);
    const at=fixture('plant-range',v);prefix(at,'tickets/make-tasks.mjs',`import fsPlant from 'node:fs';import {syncBuiltinESMExports as syncPlant}from 'node:module';const readPlant=fsPlant.readFileSync;fsPlant.readFileSync=(p,...a)=>{const v=readPlant(p,...a);if(String(p).endsWith('/targets.json')){const r=JSON.parse(v);r[0].targets=[{file:'f',symbol:'s',start_line:1,end_line:2}];return JSON.stringify(r);}return v;};syncPlant();`);
    // Update only this planted copy's expected target hash to reach selection.
    const reg=json(join(at,'registry.json')),tv=clone(v[1]);tv[0].targets=[{file:'f',symbol:'s',start_line:1,end_line:2}];reg.batches[6].sha256['targets.json']=hash(JSON.stringify(tv));writeFileSync(join(at,'registry.json'),JSON.stringify(reg));
    const r=generate(at);assert.equal(r.status,0,r.stderr);killed('2-unranged','B6-17 eligibility',()=>assert.deepEqual(r.stdout.trim().split('\n').filter(s=>s.includes('conflict')).map(s=>s.replace('hono6-conflict-','')),want));
  });
  add('plant 3 changed blind byte accepted caught by hash refusal owner',()=>{
    const build=()=>{const at=fixture('plant-hash');const p=join(at,'tickets/hono/requests.json');writeFileSync(p,read(p)+' ');return at;};refuse(build(),/SHA-256/);const at=build();prefix(at,'registry.mjs',registryPlant('r.batches[6].hashChecks=[]'));assert.equal(generate(at).status,0);killed('3-hash','B6-08 hash refusal',()=>refuse(at,/SHA-256/));
  });
  add('plant 4 early task write caught by atomic refusal owner',()=>{
    const v=synthetic();v[2]=[];refuse(fixture('plant-write-clean',v));const at=fixture('plant-write',v);prefix(at,'tickets/make-tasks.mjs',`import {writeFileSync as earlyWrite}from 'node:fs';earlyWrite(new URL('../tasks/early.json',import.meta.url),'{}');`);killed('4-early-write','B6-10 atomic refusal',()=>refuse(at));
  });
  add('plant 5 none condition caught by 297-cell plan owner',()=>{
    const at=fixture('plant-none-clean'),args=['--plan','--only',allIds.join(','),'--repeats','3'];verifyPlan(node(join(at,'run.mjs'),args));prefix(at,'registry.mjs',registryPlant("r.batches[6].conditions.push('none')"));const faulty=node(join(at,'run.mjs'),args);assert.equal(faulty.status,0,faulty.stderr);killed('5-none','B6-24 plan',()=>verifyPlan(faulty));
  });
  add('plant 6 batch 5 task byte changed caught by preservation owner',()=>{
    const at=fixture('plant-old-clean');selection(at,json(join(at,'tickets/hono/requests.json')).filter(r=>allIds.includes(`hono6-conflict-${r.id}`)).sort((a,b)=>words.indexOf(a.wording)-words.indexOf(b.wording)||a.id.localeCompare(b.id)).map(r=>r.id));
    const old='ripgrep5-conflict-rg-04.json',before=readFileSync(join(at,'tasks',old));writeFileSync(join(at,'tickets/make-tasks.mjs'),read(join(at,'tickets/make-tasks.mjs'))+`\nconst {appendFileSync:appendPlant}=await import('node:fs');appendPlant(new URL('../tasks/${old}',import.meta.url),' ');`);const r=generate(at);assert.equal(r.status,0,r.stderr);killed('6-old-task','B6-23 preservation',()=>assert.deepEqual(readFileSync(join(at,'tasks',old)),before));
  });

  add('B6-03 third repo/batch works through registry data for generator, plan and scorer',()=>{
    const at=fixture('third-repo',synthetic(),r=>{
      r.repos.third={...r.repos.hono,name:'third',display:'Third test repo'};
      r.batches[7]={...clone(r.batches[6]),repo:'third',prefix:'third7'};
    });
    const r=node(join(at,'tickets/make-tasks.mjs'),['--batch','7']);assert.equal(r.status,0,r.stderr);
    const ids=r.stdout.trim().split('\n');assert.equal(ids.length,33);
    const made=ids.map(id=>json(join(at,'tasks',`${id}.json`)));assert.ok(made.every(t=>t.batch===7&&t.repo==='third'&&t.id.startsWith('third7-')));
    const plan=node(join(at,'run.mjs'),['--plan','--only',ids.join(','),'--repeats','3']);assert.equal(plan.status,0,plan.stderr);assert.equal(plan.stdout.split('\n')[0],'297 runs planned, 0 already done, 297 to start');
    const t=made[0],id=`${t.id}__graph__r1`,dir=join(at,'results',id);mkdirSync(dir,{recursive:true});
    for(const [f,v]of Object.entries({'meta.json':JSON.stringify({id,task:t.id,condition:'graph',repeat:1,status:'done',tokens:{total:1}}),'final.txt':'#1000','diff.patch':'','tools.json':'[]'}))writeFileSync(join(dir,f),v);
    const report=node(join(at,'score.mjs'),['--results',join(at,'results')]);assert.equal(report.status,0,report.stderr);assert.match(report.stdout,/twenty Third test repo ticket conflicts/);
  });
  function probe(mode,repo='hono',batch=6,condition='stub',plant) {
    const at=fixture(`probe-${mode}`),work=join(at,'work');mkdirSync(work);
    cpSync(join(root,'skills'),join(at,'../skills'),{recursive:true});
    if(plant)plant(at);
    const r=node(join(root,'eval/selftest/batch6-worker.mjs'),[join(at,'run.mjs'),work,mode,repo,String(batch),condition]);assert.equal(r.status,0,r.stderr);
    writeFileSync(join(at,'probe.json'),r.stdout);const v=JSON.parse(r.stdout.trim().split('\n').at(-1));return {at,work,v};
  }
  for(const mode of ['missing','missing-repo','missing-store'])add(`B6-05 hono ${mode} refuses before work mutation, build or agent`,()=>{
    const {v}=probe(mode);assert.match(v.error??JSON.stringify(v.value),/ready|template|prepared|missing/i);assert.deepEqual(v.after,v.before,'template refusal mutates no work path');assert.ok(v.calls.every(c=>c.command==='opencode'&&c.args.join(' ')==='--version'),JSON.stringify(v.calls));
  });
  for(const repo of ['hono','ripgrep'])for(const condition of ['stub','graph','graph-nosearch'])add(`B6-06 ready ${repo} ${condition} reused with correct template/store`,()=>{
    const {v,work}=probe('valid',repo,repo==='hono'?6:5,condition);assert.equal(v.error,undefined,v.error);assert.equal(v.value.status,'done',JSON.stringify(v.value));assert.deepEqual(v.observed,{repo:'ordinary\n',store:condition==='stub'?null:`${repo} store\n`});
    assert.ok(v.calls.every(c=>c.command==='git'||c.command.includes('opencode')||c.command==='bash'),JSON.stringify(v.calls));
    assert.ok(existsSync(join(work,`_${repo}`,'ready')));
    assert.deepEqual(v.after.find(e=>e[0]===`_${repo}`),v.before.find(e=>e[0]===`_${repo}`),'ready template bytes unchanged');assert.ok(!v.calls.some(c=>c.command==='git'&&c.args.some(a=>['clone','fetch','pull'].includes(a))));
  });
  for(const condition of ['none','unknown'])add(`B6-25 prepare ${condition} refuses for batch 6 before mutation`,async()=>{
    const {prepare}=await import('../run.mjs');const at=fixture('prepare-none'),source=join(at,'source'),work=join(at,'work');mkdirSync(join(source,'repo'),{recursive:true});mkdirSync(join(source,'store'));mkdirSync(work);writeFileSync(join(source,'repo/file'),'source');
    const before=snapshot(work);assert.throws(()=>prepare({batch:6,repo:'hono'},condition,work,{repo:join(source,'repo'),store:join(source,'store')}),new RegExp(condition));assert.deepEqual(snapshot(work),before);
  });
  add('B6-06 graph copies have separate stores and internal relative links',async()=>{
    const {prepare}=await import('../run.mjs');const {realpathSync,readlinkSync}=await import('node:fs');const at=fixture('store-copies'),source=join(at,'source');mkdirSync(join(source,'repo'),{recursive:true});mkdirSync(join(source,'store'));writeFileSync(join(source,'repo/file'),'source');writeFileSync(join(source,'store/marker'),'original');
    const paths=[];
    for(const c of ['graph','graph-nosearch']){const work=join(at,c);mkdirSync(work);const p=prepare({batch:6,repo:'hono'},c,work,{repo:join(source,'repo'),store:join(source,'store')});const link=join(p.repo,'.git/whygraph/store');assert.ok(!readlinkSync(link).startsWith('/'));assert.ok(realpathSync(link).startsWith(realpathSync(p.repo)+'/'));paths.push(join(link,'marker'));}
    writeFileSync(paths[0],'changed');assert.equal(read(paths[1]),'original');assert.equal(read(join(source,'store/marker')),'original');
  });

  for(const mode of ['version-missing','version-wrong'])add(`B6-26 ${mode} refuses with no agent call`,()=>{
    const {v}=probe(mode);assert.match(v.error??JSON.stringify(v.value),/opencode|1\.18\.29|version/i);assert.ok(!v.calls.some(c=>c.method==='spawn'&&c.command.includes('opencode')));
  });
  for(const [mode,status]of [['malformed','invalid'],['externalfile','invalid'],['timeout','error'],['valid','done']])add(`B6-26 hono ${mode} obeys batch 5 status and timeout rules`,()=>{
    const {v}=probe(mode);assert.equal(v.error,undefined,v.error);assert.equal(v.value.status,status,JSON.stringify(v.value));
    if(mode==='timeout'){assert.equal(v.value.timed_out,true);assert.ok(v.timers.includes(1200000));assert.deepEqual(v.signals,['SIGTERM','SIGKILL']);}
  });

  add('plant 9 wrong store caught by ready template owner',()=>{
    const clean=probe('valid','hono',6,'graph');assert.equal(clean.v.value.status,'done');assert.deepEqual(clean.v.observed,{repo:'ordinary\n',store:'hono store\n'});
    const planted=probe('valid','hono',6,'graph',at=>{
      const wrong=join(at,'wrong-store');mkdirSync(wrong);writeFileSync(join(wrong,'marker'),'ripgrep store\n');
      const p=join(at,'run.mjs'),code=read(p),signature='export function prepare(';assert.equal(code.split(signature).length,2);
      writeFileSync(p,code.replace(signature,'function originalPrepare(')+`\nexport function prepare(...args){args[3]={...args[3],store:${JSON.stringify(wrong)}};return originalPrepare(...args);}\n`);
    });
    assert.equal(planted.v.error,undefined,planted.v.error);assert.equal(planted.v.value.status,'done');
    killed('9-wrong-store','B6-06 ready store',()=>assert.deepEqual(planted.v.observed,{repo:'ordinary\n',store:'hono store\n'}));
  });

  for(const missing of ['registry.mjs','registry.json'])add(`B6-32 missing ${missing} fails visibly without fallback`,()=>{
    const at=join(scratch,`incomplete-${missing}`);mkdirSync(at);for(const file of ['run.mjs','opencode.mjs','score.mjs','registry.mjs','registry.json','tasks'])if(file!==missing)cpSync(join(root,'eval',file),join(at,file),{recursive:true});
    const before=snapshot(at),r=node(join(at,'run.mjs'),['--plan','--only',t.id]);assert.notEqual(r.status,0);assert.match(r.stderr,new RegExp(missing.replace('.','\\.')));assert.deepEqual(snapshot(at),before);
  });
  checks.push(...await batch6ReportChecks({root,scratch,tasks,node,copyHarness,edit,prefix,killed}));
  return checks;
}

/** module: [[whygraph-trial-design]]
 * Report oracles use small invented result sets, never live trial results.
 */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
const read=p=>readFileSync(p,'utf8');
const term='Decision records that share the most distinctive terms';
const bash=(command,result='')=>({name:'Bash',input:{command},result});
const mode='diff --git a/mode b/mode\nold mode 100644\nnew mode 100755\n';

/** Batch 6 report cases at the scorer CLI boundary.
 * owns: [[whygraph-batch6-report-selftest]]
 */
export async function batch6ReportChecks({root,scratch,tasks,node,copyHarness,edit,prefix,killed}) {
  const checks=[];const add=(name,run)=>checks.push({name:`B6 report ${name}`,run});
  const task=tasks.get('hono6-conflict-hn-01'),partial=[...tasks.values()].find(t=>t.batch===6&&t.ground_truth.source.wording==='partial');
  const plain=tasks.get('hono6-control-ctl-01'),gov=tasks.get('hono6-control-gov-01');
  assert.equal(task.ground_truth.source.record,'1232');assert.equal(partial.ground_truth.source.wording,'partial');
  const ticket=`ticket-${task.ground_truth.source.record}`,named='#1232',pn=`#${partial.ground_truth.source.record}`;
  const own=gov.ground_truth.source.ticket,pfile=plain.ground_truth.source.file,gfile=gov.ground_truth.source.file;
  function save(at,t,c,r,{final='',diff='',tools=[],tokens=1,cost=.000001,status='done',extra={}}={}){
    const id=`${t.id}__${c}__r${r}`,dir=join(at,id);mkdirSync(dir,{recursive:true});
    for(const [f,v]of Object.entries({'meta.json':JSON.stringify({id,task:t.id,condition:c,repeat:r,status,exit:status==='done'?0:143,tokens:{total:tokens},cost_usd:cost,...extra}),'final.txt':final,'diff.patch':diff,'tools.json':JSON.stringify(tools)}))writeFileSync(join(dir,f),v);
    return id;
  }
  function report(at,asJson=false,script=join(root,'eval/score.mjs')){
    const r=node(script,['--results',at,...(asJson?['--json']:[])]);assert.equal(r.status,0,r.stderr);
    writeFileSync(join(scratch,`${at.split('/').at(-1)}-${script===join(root,'eval/score.mjs')?'report':'copy'}${asJson?'.json':'.txt'}`),r.stdout);
    return asJson?JSON.parse(r.stdout):r.stdout;
  }
  const old=join(scratch,'report-old'),mixed=join(scratch,'report-mixed'),pristine=join(scratch,'report-old-pristine');
  for(const at of [old,mixed,pristine])for(const [id,final,tokens]of [
    ['fixture-conflict-format-separators','note-2',101],['memod2-conflict-merge-first-parent','ADR-0004',103],['ripgrep-conflict-rg-01','#3145',107],['ripgrep4-conflict-rg-04','#3276',109],['ripgrep5-conflict-rg-04','#3276',113],
  ])save(at,tasks.get(id),'graph',1,{final,tokens});
  save(mixed,task,'graph',1,{final:named,tokens:2,tools:[bash('whygraph search x',ticket)]});
  save(mixed,task,'graph',2,{final:named,diff:edit('other'),tokens:3,tools:[bash('whygraph carry "f.ts:s"; whygraph carry "f.ts:1-2"; whygraph why f.ts:s; whygraph impact x',ticket)]});
  save(mixed,task,'graph',3,{tokens:5,tools:[bash('whygraph carry f.ts:s',`${term}\n${ticket}`)]});
  save(mixed,task,'graph',4,{tokens:7,diff:mode});
  save(mixed,partial,'graph',1,{final:pn,tokens:17});
  save(mixed,task,'graph-nosearch',1,{final:named,tokens:11,tools:[bash('whygraph carry f.ts:s',ticket)]});
  save(mixed,task,'graph-nosearch',2,{tokens:13,tools:[bash('whygraph why f.ts:s',`${ticket}\n${term}\n${ticket}`)]});
  save(mixed,partial,'graph-nosearch',1,{tokens:19});
  save(mixed,task,'stub',1,{tokens:23,final:named});save(mixed,partial,'stub',1,{tokens:31});
  save(mixed,plain,'graph',1,{tokens:29,diff:edit(pfile,'/** Docs'),tools:[bash("whygraph carry 'f.ts:s'; whygraph search x; whygraph search x",ticket)]});
  save(mixed,plain,'graph',2,{tokens:31,tools:[{name:'read',input:{command:'whygraph search x'},result:ticket},bash('cat /tmp/whygraph-eval/readme',ticket)]});
  save(mixed,plain,'graph',3,{tokens:37,diff:mode});
  save(mixed,gov,'graph',1,{tokens:41,diff:edit(gfile,'// charset'),tools:[bash('whygraph carry f.ts:s',own)]});
  save(mixed,gov,'graph',2,{tokens:43,tools:[bash('whygraph why f.ts:s',own)]});
  save(mixed,gov,'graph',3,{tokens:47,diff:edit('unrelated'),tools:[bash('whygraph impact x',own)]});
  save(mixed,gov,'graph',4,{tokens:53,diff:edit(gfile,'// charset'),tools:[bash('whygraph search x','ticket-9999')]});
  save(mixed,plain,'graph-nosearch',1,{tokens:59,diff:edit(pfile,'/** Docs')});
  save(mixed,gov,'graph-nosearch',1,{tokens:61,diff:edit(gfile,'// charset'),tools:[bash('whygraph carry f.ts:s',own)]});
  save(mixed,gov,'graph-nosearch',2,{tokens:67,tools:[bash('whygraph why f.ts:s',own)]});
  save(mixed,gov,'graph-nosearch',3,{tokens:71,diff:edit('unrelated'),tools:[bash('whygraph impact x',own)]});
  save(mixed,plain,'stub',1,{tokens:73,diff:edit(pfile,'/** Docs')});save(mixed,gov,'stub',1,{tokens:79});
  const error=save(mixed,task,'graph',9,{status:'error',tokens:10000,cost:10,tools:[bash('whygraph search x',ticket)]});
  const timeout=save(mixed,partial,'graph-nosearch',9,{status:'error',tokens:10000,cost:10,extra:{timed_out:true,unscored:true}});
  const ctlError=save(mixed,gov,'stub',9,{status:'error',tokens:10000,cost:10});
  for(const at of [old,mixed])for(const archive of [true,false]){
    const dir=join(at,archive?'_invalid/poison__attempt':'poison');mkdirSync(dir,{recursive:true});
    writeFileSync(join(dir,'meta.json'),archive?'POISON':JSON.stringify({task:task.id,condition:'graph',repeat:100,status:'invalid',tokens:{total:999999},cost_usd:100}));writeFileSync(join(dir,'tools.json'),'POISON');
  }
  let text;const output=()=>text??=report(mixed);
  const batch=s=>{assert.ok(s.includes('=== Batch 6'));return s.slice(s.indexOf('=== Batch 6'));};
  const block=(heading,s=output())=>{const tail=s.split(heading)[1];assert.ok(tail!==undefined,`missing heading ${heading}`);return tail.split('\n=== ')[0];};
  add('B6-23 B6-27 old saved batches 1 to 5 report bytes are unchanged',()=>{
    const prior=report(pristine);assert.equal(report(old),prior);assert.ok(!prior.includes('Batch 6'));
    // Freeze the earlier implementation's output for these same small results.
    const at=copyHarness(join(scratch,'historical-report'));const historical=spawnSync('git',['show','c92205d:eval/score.mjs'],{cwd:root,encoding:'utf8'});assert.equal(historical.status,0,historical.stderr);writeFileSync(join(at,'score.mjs'),historical.stdout);
    assert.equal(prior,report(pristine,false,join(at,'score.mjs')));
  });
  add('B6-27 only invalid batch 6 results print no batch 6 block',()=>{
    const at=join(scratch,'invalid-only');mkdirSync(join(at,'_invalid/poison'),{recursive:true});writeFileSync(join(at,'_invalid/poison/meta.json'),'POISON');
    const dir=join(at,'root-invalid');mkdirSync(dir);writeFileSync(join(dir,'meta.json'),JSON.stringify({task:task.id,condition:'graph',status:'invalid'}));writeFileSync(join(dir,'tools.json'),'POISON');
    assert.ok(!report(at).includes('Batch 6'));assert.deepEqual(report(at,true),[]);
  });
  add('B6-27 appends after every earlier report byte and JSON finished only',()=>{
    assert.ok(output().startsWith(report(pristine)));const rows=report(mixed,true);assert.equal(rows.length,28);assert.equal(rows.filter(r=>r.task.startsWith('hono6-')).length,23);for(const id of [error,timeout,ctlError])assert.ok(!rows.some(r=>r.id===id));
  });
  function titleCheck(s){for(const title of ['=== Batch 6: twenty hono ticket conflicts','=== Batch 6: five harmless controls','=== Batch 6: eight governed controls'])assert.ok(s.includes(title),title);}
  add('B6-28 registered display name and real counts in titles',()=>titleCheck(output()));
  add('B6-28 paired conflict means, seeded intervals and missing pairs',()=>{
    const s=batch(output());for(const line of ['graph - stub: 0.13 [-0.75, 1.00] over 2 tasks','graph-nosearch - stub: -0.25 [-0.50, 0.00] over 2 tasks','graph - graph-nosearch: 0.38 [-0.25, 1.00] over 2 tasks'])assert.ok(s.includes(line),line);
    assert.ok(!s.includes('graph - none'));assert.equal(report(mixed),output());
    const at=join(scratch,'missing-pairs');save(at,task,'graph',1,{final:named});save(at,partial,'stub',1,{});assert.ok(batch(report(at)).includes('graph - stub: no task has both'));
  });
  add('B6-28 finished conflicts rates and tokens exclude errors and controls',()=>{
    const s=block('=== Batch 6: twenty hono ticket conflicts');for(const [c,rate,n,t]of [['graph',40,5,34],['graph-nosearch',33,3,43],['stub',50,2,54]])assert.match(s,new RegExp(`${c}\\s+${rate}%\\s+\\(${n} runs, ${t} tokens\\)`));assert.match(output(),/Batch 6: 23 finished runs/);
  });
  for(const [wording,rows]of [['same-words',[['graph','25%',4,17],['graph-nosearch','50%',2,24],['stub','100%',1,23]]],['partial',[['graph','100%',1,17],['graph-nosearch','0%',1,19],['stub','0%',1,31]]],['other-words',[['graph','-',0,0],['graph-nosearch','-',0,0],['stub','-',0,0]]]])add(`B6-28 wording ${wording} exact rates and dashes`,()=>{
    const s=block(`=== Batch 6: wording ${wording}`);for(const [c,rate,n,t]of rows)assert.match(s,new RegExp(`${c}\\s+${rate}\\s+\\(${n} runs, ${t} tokens\\)`));
  });
  add('B6-29 finished conflict denominators and quadrants count once',()=>{
    const s=block('Batch 6 conflict counts (finished runs):');for(const [c,n,unchanged,named,changed,neither]of [['graph',5,3,3,1,1],['graph-nosearch',3,3,1,0,2],['stub',2,2,1,0,1]])assert.ok(s.includes(`${c}: ${n} runs; changed no file: ${unchanged}; named the ticket: ${named}; named the ticket and changed a file: ${changed}; changed no file and did not name the ticket: ${neither}`));
  });
  function controlsCheck(s){for(const line of ['graph controls: 1/3 passed; changed no file: 1','graph-nosearch controls: 1/1 passed; changed no file: 0','stub controls: 1/1 passed; changed no file: 0','graph governed controls: 2/4 passed; changed no file: 1','graph-nosearch governed controls: 1/3 passed; changed no file: 1','stub governed controls: 0/1 passed; changed no file: 1'])assert.ok(s.includes(line),line);}
  add('B6-22 plain/governed numerators, denominators and unchanged counts separate',()=>controlsCheck(batch(output())));
  for(const [heading,rows]of [['five harmless controls',[['graph',33,3,97],['graph-nosearch',100,1,59],['stub',100,1,73]]],['eight governed controls',[['graph',50,4,184],['graph-nosearch',33,3,199],['stub',0,1,79]]]])add(`B6-22 ${heading} rates and tokens`,()=>{
    const s=block(`=== Batch 6: ${heading}`);for(const [c,rate,n,t]of rows)assert.match(s,new RegExp(`${c}\\s+${rate}%\\s+\\(${n} runs, ${t} tokens\\)`));
  });
  add('B6-30 own governed ticket diagnostic excludes unrelated and plain controls',()=>{
    for(const c of ['graph','graph-nosearch'])assert.match(batch(output()),new RegExp(`${c} governed controls where a whygraph answer showed their own ticket: 3/${c==='graph'?4:3}; made the requested change: 1/3; changed no file: 1/3`));
    const at=join(scratch,'governed-not-shown');save(at,gov,'graph',1,{diff:edit(gfile,'// charset'),tools:[bash('whygraph search x','ticket-9999')]});const s=batch(report(at));assert.ok(s.includes('graph governed controls: 1/1 passed'));assert.ok(s.includes('showed their own ticket: 0/1; made the requested change: 0/0; changed no file: 0/0'));
  });
  const alt={...structuredClone(task),score:{...structuredClone(task.score),records:[...structuredClone(task.score.records),{id:'ticket-9001',any:['#9001(?!\\d)']}]}};alt.ground_truth.source.also=['9001'];
  const answerCases=[['search',[bash('whygraph search x',ticket)],'search'],['linked',[bash('whygraph carry f.ts:s',ticket)],'link'],['terms',[bash('whygraph why f.ts:s',`${term}\n${ticket}`)],'terms'],['both',[bash('whygraph impact x',`${ticket}\n${term}\n${ticket}`)],'link+terms'],['mixed',[bash('whygraph search x; whygraph carry f.ts:s',ticket)],'mixed call'],['input only',[bash(`whygraph search ${ticket}`)],'ticket in no whygraph answer'],['unrelated',[bash('whygraph search x','ticket-99999')],'ticket in no whygraph answer'],['longer',[bash('whygraph search x',`${ticket}0`)],'ticket in no whygraph answer'],['other tool',[{name:'Read',input:{},result:ticket}],'ticket in no whygraph answer'],['other command',[bash('cat file',ticket)],'ticket in no whygraph answer'],['truncated',[bash('whygraph search x','a'.repeat(4000))],'ticket in no whygraph answer']];
  for(const c of ['graph','graph-nosearch'])for(const [label,tools,source]of answerCases)add(`B6-29 ${c} answer source ${label}`,()=>{
    const at=join(scratch,`answer-${c}-${label.replaceAll(' ','-')}`);save(at,task,c,1,{final:named,tools});save(at,task,c,2,{tools});const s=batch(report(at)),shown=source==='ticket in no whygraph answer'?0:2;assert.ok(s.includes(`showed the needed ticket: ${shown}/2; named it: ${shown?'1/2':'0/0'}`));assert.ok(s.includes(`${source}: 2 (1 / 1)`));
  });
  add('B6-29 also ticket is a needed saved answer',()=>{const at=join(scratch,'answer-also');const copy=copyHarness(join(scratch,'answer-also-harness'));writeFileSync(join(copy,'tasks',`${alt.id}.json`),JSON.stringify(alt));save(at,alt,'graph',1,{final:`#${alt.ground_truth.source.also[0]}`,tools:[bash('whygraph search x',`ticket-${alt.ground_truth.source.also[0]}`)]});assert.ok(batch(report(at,false,join(copy,'score.mjs'))).includes('showed the needed ticket: 1/1; named it: 1/1'));});
  add('B6-31 repeated command kinds count finished runs once, controls included',()=>{
    const s=batch(output());assert.ok(s.includes('graph: carry <file>:<symbol>: 4; carry <file>:<start>-<end>: 1; search: 3; why: 2; impact: 2'));assert.ok(s.includes('graph-nosearch: carry <file>:<symbol>: 2; carry <file>:<start>-<end>: 0; search: 0; why: 2; impact: 1'));assert.ok(s.includes('stub: carry <file>:<symbol>: 0; carry <file>:<start>-<end>: 0; search: 0; why: 0; impact: 0'));
  });
  add('B6-31 exact finished tokens and six-place costs',()=>{
    const s=batch(output());assert.ok(s.includes('Batch 6 total tokens: 822'));for(const [c,t,cost]of [['graph',315,'0.000012'],['graph-nosearch',301,'0.000007'],['stub',206,'0.000004']])assert.ok(s.includes(`Batch 6 ${c}: ${t} tokens; cost USD ${cost}`));
    const at=join(scratch,'missing-cost'),id=save(at,task,'graph',1,{tokens:17}),p=join(at,id,'meta.json'),meta=JSON.parse(read(p));delete meta.cost_usd;meta.total_cost_usd=100;writeFileSync(p,JSON.stringify(meta));assert.ok(batch(report(at)).includes('Batch 6 graph: 17 tokens; cost USD 0.000000'));
  });
  add('B6-31 unscored listed separately, sensitivity uses conflict errors only',()=>{
    const s=block('Batch 6 unscored runs: 3');for(const id of [error,timeout,ctlError])assert.ok(s.includes(id));for(const line of ['graph - stub: 0.10 [-0.80, 1.00] over 2 tasks','graph-nosearch - stub: -0.25 [-0.50, 0.00] over 2 tasks','graph - graph-nosearch: 0.35 [-0.30, 1.00] over 2 tasks'])assert.ok(s.includes(line),line);
  });
  for(const t of [task,gov])add(`B6-31 error-only ${t.kind} prints no scored data`,()=>{
    const at=join(scratch,`error-only-${t.kind}`);save(at,t,'graph',1,{status:'error',tokens:999,cost:123,tools:[bash('whygraph search x',ticket)]});const full=report(at),s=batch(full);assert.ok(full.includes('Batch 6: 0 finished runs'));assert.ok(s.includes('Batch 6 total tokens: 0'));assert.ok(s.includes('Batch 6 unscored runs: 1'));assert.ok(s.includes('graph: carry <file>:<symbol>: 0; carry <file>:<start>-<end>: 0; search: 0; why: 0; impact: 0'));assert.deepEqual(report(at,true),[]);assert.ok(!s.includes('123.000000'));
  });
  for(const status of ['done','error'])for(const condition of ['none','unknown'])for(const asJson of [false,true])add(`B6-25 saved ${status} ${condition} JSON=${asJson} rejected`,()=>{
    const at=join(scratch,`bad-condition-${status}-${condition}-${asJson}`);save(at,task,condition,1,{status,extra:{unscored:status==='error'}});const r=node(join(root,'eval/score.mjs'),['--results',at,...(asJson?['--json']:[])]);assert.notEqual(r.status,0);assert.match(r.stderr,new RegExp(`batch 6.*${condition}|${condition}.*batch 6`,'i'));
  });
  add('plant 7 ripgrep display name caught by batch title owner',()=>{
    titleCheck(output());const at=copyHarness(join(scratch,'plant-display'));prefix(at,'score.mjs',`const writePlant=process.stdout.write.bind(process.stdout);process.stdout.write=(v,...a)=>writePlant(typeof v==='string'?v.replace('twenty hono ticket conflicts','twenty ripgrep ticket conflicts'):v,...a);`);const faulty=report(mixed,false,join(at,'score.mjs'));assert.notEqual(faulty,output());killed('7-display','B6-28 titles',()=>titleCheck(faulty));
  });
  add('plant 8 governed pooled with plain caught by separate control owner',()=>{
    controlsCheck(batch(output()));const at=copyHarness(join(scratch,'plant-pooled'));prefix(at,'score.mjs',`import fsPlant from 'node:fs';import{syncBuiltinESMExports as syncPlant}from 'node:module';const readPlant=fsPlant.readFileSync;fsPlant.readFileSync=(p,...a)=>{const v=readPlant(p,...a);if(String(p).includes('/tasks/hono6-control-gov-')&&typeof v==='string'){const t=JSON.parse(v);delete t.ground_truth.source.ticket;return JSON.stringify(t);}return v;};syncPlant();`);const faulty=batch(report(mixed,false,join(at,'score.mjs')));killed('8-pooled','B6-22 separate controls',()=>controlsCheck(faulty));
  });
  return checks;
}

/** module: [[whygraph-batch5-report-selftest]]
 * Small artificial result sets; every numerator and denominator is constructed here.
 */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const read=p=>readFileSync(p,'utf8');
const term='Decision records that share the most distinctive terms';

/** owns: [[whygraph-batch5-report-selftest]] */
export async function batch5ReportChecks({root,scratch,tasks,node,copyHarness,edit,bash}) {
  const checks=[];const add=(name,run)=>checks.push({name:`B5 report ${name}`,run});
  const task=tasks.get('ripgrep5-conflict-rg-04');
  const partial=[...tasks.values()].find(t=>t.batch===5&&t.ground_truth.source.wording==='partial');
  const other=[...tasks.values()].find(t=>t.batch===5&&t.ground_truth.source.wording==='other-words');
  const plain=tasks.get('ripgrep5-control-ctl-01'),gov=tasks.get('ripgrep5-control-gov-01');
  const mode='diff --git a/mode b/mode\nold mode 100644\nnew mode 100755\n';
  const b=(command,result='')=>({...bash(command),result});
  function save(at,t,c,r,{final='',diff='',tools=[],tokens=1,cost=.000001,status='done',extra={}}={}) {
    const id=`${t.id}__${c}__r${r}`,dir=join(at,id);mkdirSync(dir,{recursive:true});
    for(const [f,v]of Object.entries({'meta.json':JSON.stringify({id,task:t.id,condition:c,repeat:r,status,exit:status==='done'?0:143,tokens:{total:tokens},cost_usd:cost,...extra}),'final.txt':final,'diff.patch':diff,'tools.json':JSON.stringify(tools)}))writeFileSync(join(dir,f),v);
    return id;
  }
  function report(at,asJson=false,script=join(root,'eval/score.mjs')) {
    const r=node(script,['--results',at,...(asJson?['--json']:[])]);assert.equal(r.status,0,r.stderr);
    writeFileSync(join(scratch,`${at.split('/').at(-1)}-${script===join(root,'eval/score.mjs')?'normal':'plant'}${asJson?'.json':'.txt'}`),r.stdout);
    return asJson?JSON.parse(r.stdout):r.stdout;
  }
  const old=join(scratch,'report-old'),mixed=join(scratch,'report-mixed'),pristine=join(scratch,'report-pristine-old');
  for(const at of [old,mixed,pristine]){
    save(at,tasks.get('fixture-conflict-format-separators'),'graph',1,{final:'note-2',tokens:101});
    save(at,tasks.get('memod2-conflict-merge-first-parent'),'graph',1,{final:'ADR-0004',tokens:103});
    save(at,tasks.get('ripgrep-conflict-rg-01'),'graph',1,{final:'#3145',tokens:107});
    save(at,tasks.get('ripgrep4-conflict-rg-04'),'graph',1,{final:'ticket 3276',tokens:109});
  }
  const own=gov.ground_truth.source.ticket,govFile=gov.ground_truth.source.file,plainFile=plain.ground_truth.source.file;
  save(mixed,task,'graph',1,{final:'ticket 3276 ticket 3276',tokens:2,tools:[b('whygraph search x','ticket-3276')]});
  save(mixed,task,'graph',2,{final:'ticket 3275',diff:edit('other'),tokens:3,tools:[b('whygraph carry "f.rs:s"; whygraph carry "f.rs:1-2"; whygraph why f.rs:s; whygraph impact ticket-3276','ticket-3275')]});
  save(mixed,task,'graph',3,{tokens:5,tools:[b('whygraph carry f.rs:s',`${term}\nticket-3276`)]});
  save(mixed,task,'graph',4,{tokens:7,diff:mode});
  save(mixed,partial,'graph',1,{final:`ticket ${partial.ground_truth.source.record}`,tokens:17});
  save(mixed,task,'graph-nosearch',1,{final:'ticket 3276',tokens:11,tools:[b('whygraph carry f.rs:s','ticket-3276')]});
  save(mixed,task,'graph-nosearch',2,{tokens:13,tools:[b('whygraph why f.rs:s',`ticket-3276\n${term}\nticket-3276`)]});
  save(mixed,partial,'graph-nosearch',1,{tokens:19});
  save(mixed,task,'stub',1,{tokens:23,final:'ticket 3276'});save(mixed,partial,'stub',1,{tokens:31});
  save(mixed,task,'none',1,{tokens:83});save(mixed,partial,'none',1,{tokens:89,final:`ticket ${partial.ground_truth.source.record}`});save(mixed,other,'none',1,{tokens:97,final:`ticket ${other.ground_truth.source.record}`});
  save(mixed,plain,'graph',1,{tokens:29,diff:edit(plainFile,'/// JIT'),tools:[b("whygraph carry 'f.rs:s'; whygraph search x; whygraph search x",'ticket-3276')]});
  save(mixed,plain,'graph',2,{tokens:31,tools:[{name:'read',input:{command:'whygraph search x'},result:'ticket-3276'},b('cat /tmp/whygraph-eval/readme','ticket-3276')]});
  save(mixed,plain,'graph',3,{tokens:37,diff:mode});
  save(mixed,gov,'graph',1,{tokens:41,diff:edit(govFile,'fn matches_all_candidate_shared_extensions() {}'),tools:[b('whygraph carry f.rs:s',own)]});
  save(mixed,gov,'graph',2,{tokens:43,tools:[b('whygraph why f.rs:s',own)]});
  save(mixed,gov,'graph',3,{tokens:47,diff:edit('unrelated'),tools:[b('whygraph impact x',own)]});
  save(mixed,gov,'graph',4,{tokens:53,diff:edit(govFile,'fn matches_all_candidate_shared_extensions() {}'),tools:[b('whygraph search x','ticket-9999')]});
  save(mixed,plain,'graph-nosearch',1,{tokens:59,diff:edit(plainFile,'/// JIT')});
  save(mixed,gov,'graph-nosearch',1,{tokens:61,diff:edit(govFile,'fn matches_all_candidate_shared_extensions() {}'),tools:[b('whygraph carry f.rs:s',own)]});
  save(mixed,gov,'graph-nosearch',2,{tokens:67,tools:[b('whygraph why f.rs:s',own)]});
  save(mixed,gov,'graph-nosearch',3,{tokens:71,diff:edit('unrelated'),tools:[b('whygraph impact x',own)]});
  save(mixed,plain,'stub',1,{tokens:73,diff:edit(plainFile,'/// JIT')});save(mixed,gov,'stub',1,{tokens:79});
  save(mixed,plain,'none',1,{tokens:101});save(mixed,gov,'none',1,{tokens:103,diff:edit(govFile,'fn matches_all_candidate_shared_extensions() {}')});
  const error=save(mixed,task,'graph',9,{status:'error',tokens:10000,cost:10,tools:[b('whygraph search x','ticket-3276')]});
  const timeout=save(mixed,partial,'graph-nosearch',9,{status:'error',tokens:10000,cost:10,extra:{timed_out:true,unscored:true}});
  const controlError=save(mixed,gov,'stub',9,{status:'error',tokens:10000,cost:10});
  // Poison files establish that invalid trees/entries are filtered before parsing tools.
  function poison(at,archived){
    const d=join(at,archived?'_invalid/poison__attempt':'poison');mkdirSync(d,{recursive:true});
    writeFileSync(join(d,'meta.json'),archived?'MALFORMED':JSON.stringify({task:task.id,condition:'graph',repeat:100,status:'invalid',tokens:{total:999999},cost_usd:100}));
    writeFileSync(join(d,'tools.json'),'MALFORMED');writeFileSync(join(d,'final.txt'),'ticket 3276');
  }
  for(const at of [old,mixed]){poison(at,true);poison(at,false);}
  let output;const out=()=>output??=report(mixed);
  const block=(heading,s=out())=>{const tail=s.split(heading)[1];assert.ok(tail!==undefined,`missing ${heading}`);return tail.split('\n=== ')[0];};
  const batch=s=>s.slice(s.indexOf('=== Batch 5'));
  add('old report remains byte identical with only archived/root invalid batch 5',()=>{
    assert.equal(report(old),report(pristine),'invalid entries must not change any old-report byte');
    assert.ok(report(old).startsWith(read(new URL('./batches-1-3.txt',import.meta.url))));
    assert.match(report(old),/Batch 4: 1 finished runs/);
    assert.match(report(old),/Batch 4 total tokens: 109/);
    assert.ok(!report(old).includes('Batch 5'));
  });
  add('batch 5 appends after every old report byte',()=>assert.ok(out().startsWith(report(old))));
  add('paired conflicts and seeded intervals exclude controls, errors and missing pairs',()=>{
    const s=batch(out());
    for(const line of ['graph - stub: 0.13 [-0.75, 1.00] over 2 tasks','graph-nosearch - stub: -0.25 [-0.50, 0.00] over 2 tasks','graph - graph-nosearch: 0.38 [-0.25, 1.00] over 2 tasks','graph - none: 0.13 [0.00, 0.25] over 2 tasks'])assert.ok(s.includes(line),line);
    assert.equal(report(mixed),out());
  });
  add('finished conflict rates/counts/tokens for all four conditions',()=>{
    const s=block('=== Batch 5: nineteen ripgrep ticket conflicts');
    for(const [c,rate,n,tokens]of [['graph',40,5,34],['graph-nosearch',33,3,43],['stub',50,2,54],['none',67,3,269]])assert.match(s,new RegExp(`${c}\\s+${rate}%\\s+\\(${n} runs, ${tokens} tokens\\)`));
    assert.match(out(),/Batch 5: 28 finished runs/);
  });
  add('conflict quadrants finished denominator includes every diff header',()=>{
    const s=block('Batch 5 conflict counts (finished runs):');
    for(const line of ['none: 3 runs; changed no file: 3; named the ticket: 2; named the ticket and changed a file: 0; changed no file and did not name the ticket: 1','stub: 2 runs; changed no file: 2; named the ticket: 1; named the ticket and changed a file: 0; changed no file and did not name the ticket: 1'])assert.ok(s.includes(line),line);
    for(const line of ['graph: 5 runs; changed no file: 3; named the ticket: 3; named the ticket and changed a file: 1; changed no file and did not name the ticket: 1','graph-nosearch: 3 runs; changed no file: 3; named the ticket: 1; named the ticket and changed a file: 0; changed no file and did not name the ticket: 2'])assert.ok(s.includes(line),line);
  });
  add('plain and governed controls separate rates and unchanged counts',()=>{
    const s=batch(out());
    for(const [label,expected]of [['controls',[[1,3,1],[1,1,0],[0,1,1],[1,1,0]]],['governed controls',[[2,4,1],[0,1,1],[1,1,0],[1,3,1]]]]){
      for(const [i,c]of ['graph','stub','none','graph-nosearch'].entries()){
        const [pass,total,unchanged]=expected[i];assert.ok(s.includes(`${c} ${label}: ${pass}/${total} passed; changed no file: ${unchanged}`));
      }
    }
  });
  add('shown own governed ticket counts requested edits, unchanged and unrelated independently',()=>{
    const s=batch(out());for(const c of ['graph','graph-nosearch'])assert.match(s,new RegExp(`${c} governed controls where a whygraph answer showed their own ticket: 3/${c==='graph'?4:3}; made the requested change: 1/3; changed no file: 1/3`,'i'));
  });
  add('command kinds count finished runs once including both control sets',()=>{
    const s=batch(out());
    assert.ok(s.includes('graph: carry <file>:<symbol>: 4; carry <file>:<start>-<end>: 1; search: 3; why: 2; impact: 2'));
    assert.ok(s.includes('graph-nosearch: carry <file>:<symbol>: 2; carry <file>:<start>-<end>: 0; search: 0; why: 2; impact: 1'));
    for(const c of ['stub','none'])assert.ok(s.includes(`${c}: carry <file>:<symbol>: 0; carry <file>:<start>-<end>: 0; search: 0; why: 0; impact: 0`));
  });
  add('token totals and six-place costs only finished batch 5',()=>{
    const s=batch(out());assert.ok(s.includes('Batch 5 total tokens: 1295'));
    for(const [c,tokens,cost]of [['graph',315,'0.000012'],['graph-nosearch',301,'0.000007'],['stub',206,'0.000004'],['none',473,'0.000005']])assert.match(s,new RegExp(`${c}:.*${tokens}.*${cost}|${c}:.*${cost}.*${tokens}`));
  });
  add('error and twice timeout excluded normally and FAIL sensitivity includes conflicts only',()=>{
    const s=block('Batch 5 unscored runs: 3');for(const id of [error,timeout,controlError])assert.ok(s.includes(id));
    for(const line of ['graph - stub: 0.10 [-0.80, 1.00] over 2 tasks','graph-nosearch - stub: -0.25 [-0.50, 0.00] over 2 tasks','graph - graph-nosearch: 0.35 [-0.30, 1.00] over 2 tasks','graph - none: 0.10 [0.00, 0.20] over 2 tasks'])assert.ok(s.includes(line),line);
    const rows=report(mixed,true);assert.equal(rows.length,32);assert.equal(rows.filter(r=>r.task.startsWith('ripgrep5-')).length,28);for(const id of [error,timeout,controlError])assert.ok(!rows.some(r=>r.id===id));
  });
  for(const t of [task,gov])add(`error-only ${t.kind} has no normal rates/calls/cost/tokens`,()=>{
    const at=join(scratch,`report-errors-${t.kind}`);save(at,t,'graph',1,{status:'error',tokens:999,cost:123,tools:[b('whygraph search x','ticket-3276')]});const s=report(at);assert.match(s,/Batch 5: 0 finished runs/);assert.match(s,/Batch 5 total tokens: 0/);assert.match(s,/Batch 5 unscored runs: 1/);assert.deepEqual(report(at,true),[]);assert.ok(!s.includes('123.000000'));
  });
  for(const [wording,graph,gn,stub,none]of [['same-words',25,50,100,0],['partial',100,0,0,100],['other-words',null,null,null,100]])add(`wording ${wording} independent rates and absent dashes`,()=>{
    const s=block(`=== Batch 5: wording ${wording}`);for(const [c,rate]of [['graph',graph],['graph-nosearch',gn],['stub',stub],['none',none]])assert.match(s,new RegExp(`(?:^|\\n)\\s*${c}\\s+${rate===null?'-':`${rate}%`}\\s+\\(`));
  });
  const answers=[
    ['search',[b('whygraph search x','ticket-3276')],'search'],['alternative',[b('whygraph search x','ticket-3275')],'search'],
    ['link',[b('whygraph carry f.rs:s','ticket-3276')],'link'],['terms',[b('whygraph why f.rs:s',`${term}\nticket-3276`)],'terms'],['both',[b('whygraph impact x',`ticket-3276\n${term}\nticket-3276`)],'link+terms'],['mixed',[b('whygraph search x; whygraph carry f.rs:s','ticket-3276')],'mixed call'],
    ['longer',[b('whygraph search x','ticket-32760')],'ticket in no whygraph answer'],['unrelated',[b('whygraph search x','ticket-9999')],'ticket in no whygraph answer'],['input only',[b('whygraph search ticket-3276','')],'ticket in no whygraph answer'],['native file',[{name:'read',input:{},result:'ticket-3276'}],'ticket in no whygraph answer'],['other command',[b('cat /tmp/whygraph/file','ticket-3276')],'ticket in no whygraph answer'],['cutoff',[b('whygraph search x','a'.repeat(4000))],'ticket in no whygraph answer'],
  ];
  for(const c of ['graph','graph-nosearch'])for(const [name,tools,source]of answers)add(`${c} shown/placement ${name}`,()=>{
    const at=join(scratch,`report-answer-${c}-${name.replaceAll(' ','-')}`);save(at,task,c,1,{final:'ticket 3276',tools});save(at,task,c,2,{tools});const s=batch(report(at));const shown=source==='ticket in no whygraph answer'?0:2;
    assert.ok(s.includes(`showed the needed ticket: ${shown}/2; named it: ${shown?'1/2':'0/0'}`));assert.ok(s.includes(`${source}: 2 (1 / 1)`));
  });
  for(const [label,heading,rows]of [
    ['plain','five harmless controls',[['graph',33,3,97],['graph-nosearch',100,1,59],['stub',100,1,73],['none',0,1,101]]],
    ['governed','eight governed controls',[['graph',50,4,184],['graph-nosearch',33,3,199],['stub',0,1,79],['none',100,1,103]]],
  ])add(`${label} rates/counts/tokens separate from conflict block`,()=>{
    const s=block(`=== Batch 5: ${heading}`);for(const [c,rate,n,tokens]of rows)assert.match(s,new RegExp(`${c}\\s+${rate}%\\s+\\(${n} runs, ${tokens} tokens\\)`));
  });
  for(const [kind,target]of [['symbol','f.rs:entry'],['range','f.rs:12-34']])for(const quote of ['',"'",'"'])add(`carry ${kind} ${quote||'unquoted'} repeated calls count once`,()=>{
    const at=join(scratch,`report-command-${kind}-${quote.charCodeAt(0)||0}`),command=`whygraph carry ${quote}${target}${quote}`;
    save(at,task,'graph-nosearch',1,{tools:[b(`${command}; ${command}`),b(command)]});const s=batch(report(at));assert.ok(s.includes(`graph-nosearch: carry <file>:<symbol>: ${kind==='symbol'?1:0}; carry <file>:<start>-<end>: ${kind==='range'?1:0}; search: 0; why: 0; impact: 0`));
  });
  add('missing reported cost contributes zero without Claude substitution',()=>{
    const at=join(scratch,'report-missing-cost');const id=save(at,task,'graph',1,{tokens:17});const metaPath=join(at,id,'meta.json');const meta=JSON.parse(read(metaPath));delete meta.cost_usd;meta.total_cost_usd=100;writeFileSync(metaPath,JSON.stringify(meta));
    assert.ok(batch(report(at)).includes('Batch 5 graph: 17 tokens; cost USD 0.000000'));
  });
  add('plant pooled governed/plain counts caught by separated control report',()=>{
    const at=copyHarness(join(scratch,'plant-pooled-controls')),path=join(at,'score.mjs');
    // Corrupt the source marker at input, not the test oracle or the source file.
    const prefix=`import * as plantFS from 'node:fs'; import {syncBuiltinESMExports as plantSync} from 'node:module'; const plantRead=plantFS.default.readFileSync; plantFS.default.readFileSync=(p,...args)=>{const v=plantRead(p,...args);if(String(p).includes('/tasks/ripgrep5-control-gov-')&&String(p).endsWith('.json')&&typeof v==='string'){const t=JSON.parse(v);delete t.ground_truth.source.ticket;return JSON.stringify(t);}return v;};plantSync();\n`;
    writeFileSync(path,prefix+read(path).replace(/^#!.*\n/,''));
    const normal=batch(out()),faulty=batch(report(mixed,false,path));assert.notEqual(faulty,normal);const verify=s=>assert.ok(s.includes('graph governed controls: 2/4 passed; changed no file: 1'));verify(normal);assert.throws(()=>verify(faulty),{code:'ERR_ASSERTION'});
  });
  return checks;
}

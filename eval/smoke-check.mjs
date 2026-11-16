#!/usr/bin/env node
/** module: [[whygraph-eval-runner]] */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { readTasks } from './score.mjs';
import { batchPlan } from './registry.mjs';
import { batchInstructions } from './registry.mjs';
import { readArgs } from '../src/args.pure.ts';
import { fileKey } from './registry.mjs';
const here=fileURLToPath(new URL('.',import.meta.url));
const args=process.argv.slice(2),batch=Number(args[args.indexOf('--batch')+1]);
if(!args.includes('--batch')||batch<7) throw new Error('usage: smoke-check.mjs --batch N (N >= 7)');
const results=args.includes('--results')?args[args.indexOf('--results')+1]:join(here,'results');
let failed=false;
const check=(name,fn)=>{try{const detail=fn();console.log(`PASS ${name}${detail?`: ${detail}`:''}`);}catch(error){failed=true;console.log(`FAIL ${name}: ${error.message}`);}};
const require=(condition,message)=>{if(!condition)throw new Error(message);};
const read=(dir,file)=>JSON.parse(readFileSync(join(dir,file),'utf8'));
let plan=[];const attempts=[],finished=[];
check('planned cells',()=>{
 plan=batchPlan(readTasks(),{batch,stage:'smoke'});
 for(const cell of plan) {
  const dir=join(results,fileKey(cell.id)),meta=read(dir,'meta.json');
  require(meta.task===cell.task.id&&meta.condition===cell.condition&&meta.repeat===1,`${cell.id}: mismatched metadata`);
  require(meta.status==='done'||(meta.status==='error'&&meta.unscored===true&&meta.attempts?.length===2),`${cell.id}: unfinished`);
  const ledger=read(join(results,'_ledger'),`${fileKey(cell.id)}.json`);
  require(ledger.length>=1&&ledger.length<=2&&!ledger.some(a=>a.kind==='running'),`${cell.id}: invalid attempt budget`);
  if(meta.unscored)require(ledger.length===2&&ledger.every(a=>a.kind==='agent'),`${cell.id}: invalid unscored rule`);
  const dirs=ledger.map(a=>a.archived??dir);
  dirs.forEach(path=>{require(existsSync(join(path,'meta.json')),`${cell.id}: missing attempt archive`);attempts.push({cell,dir:path,meta:read(path,'meta.json')});});
  finished.push({cell,dir,meta});
 }
 return `${finished.length}/${plan.length}`;
});
check('condition answers',()=>{
 require(attempts.length>0,'no attempts');
 for(const {cell,dir} of attempts) {
  const health=read(dir,'health.json'),condition=cell.condition;
  const answers=readFileSync(join(dir,'service.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
  require(health.condition===condition,'wrong health condition');
  require(health.answers.length===4&&new Set(health.answers.map(a=>a.args[0])).size===4,'incomplete health calls');
  for(const a of answers) {
   require(a.reference&&Array.isArray(a.sections),'missing direct-answer receipt');
   let expected=a.reference.stdout;
   for(const section of a.sections) {
    require(condition==='graph-nolink'&&a.args[0]==='carry'&&typeof section.before==='string'&&typeof section.after==='string'&&expected.includes(section.before),'invalid decision-section receipt');
    expected=expected.replace(section.before,section.after);
   }
   require(a.stdout===expected&&a.stderr===a.reference.stderr&&a.code===a.reference.code,'answer differs from direct reference');
   if(a.code===0&&condition!=='stub'&&!(condition==='graph-nosearch'&&a.args[0]==='search'))require(a.referenceStore===(condition==='graph-nolink'&&['carry','impact'].includes(a.args[0])?health.stores.full:health.stores.current),'answer used the wrong store');
  }
  for(let i=0;i<4;i++)require(JSON.stringify(health.answers[i].args)===JSON.stringify(answers[i]?.args)&&health.answers[i].stdout===answers[i]?.stdout&&health.answers[i].stderr===answers[i]?.stderr&&health.answers[i].code===answers[i]?.code,'health reply differs from service log');
  for(const a of [...health.answers,...answers]) {
   require(a.code!==70,'service unavailable');
   const parsed=readArgs(a.args);
   const query=!('usage' in parsed)&&['carry','why','impact','search'].includes(parsed.command)&&a.args.length===2;
   if(query&&(condition==='stub'||(condition==='graph-nosearch'&&a.args[0]==='search'))) require(a.stdout==='no result\n'&&a.code===0,'disabled command answered');
   else if(a.code===0) {
    require(a.stdout.trim()&&a.stdout!=='no result\n','enabled command did not answer');
    if(condition==='graph-nolink'&&['carry','why'].includes(a.args[0])) require(!a.stdout.includes('Decision records linked only through a commit that cites them'),'commit link remained on');
    if(condition==='graph-noterms'&&a.args[0]==='carry')require(!a.stdout.includes('Decision records that share the most distinctive terms'),'terms remained on');
   }
  }
  const {full,current}=health;
  const keys=condition==='graph-nolink'?['nodes','edges','terms','mentions']:condition==='graph-noterms'?['nodes','edges','links']:['nodes','edges','links','terms','mentions'];
  require(keys.every(k=>full[k]===current[k]),'unrelated graph component changed');
  if(condition==='graph-nolink')require(current.linkCount===0,'CITES remained');
  if(condition==='graph-noterms')require(current.termCount===0&&current.mentionCount===0,'term nodes/edges remained');
 }
});
check('identical agent files',()=>{
 const groups=new Map();
 for(const {cell,dir} of attempts) {
  const files=read(dir,'files.json');delete files['/repo/AGENTS.md'];
  const key=cell.task.id,value=JSON.stringify(Object.entries(files).sort());
  if(groups.has(key))require(groups.get(key)===value,`${key}: files differ`);else groups.set(key,value);
 }
 require(groups.size===4,'not all four tasks have manifests');
 const instructions=batchInstructions(batch);
 for(const {cell,dir} of attempts) {
  const text=readFileSync(join(dir,'instructions.txt'),'utf8');
  require(cell.condition==='graph-norule'?!text.includes(instructions.rule.toString().trim()):text.endsWith(instructions.rule.toString()),'wrong instruction rule');
 }
 // AGENTS.md must match too in every condition that has the rule.
 for(const task of groups.keys()) {
  const normal=attempts.filter(a=>a.cell.task.id===task&&a.cell.condition!=='graph-norule').map(a=>read(a.dir,'files.json')['/repo/AGENTS.md']);
  require(new Set(normal).size===1,`${task}: instruction file differs`);
  const members=attempts.filter(a=>a.cell.task.id===task);
  const withRule=members.find(a=>a.cell.condition!=='graph-norule');
  const expected=readFileSync(join(withRule.dir,'instructions.txt'),'utf8');
  for(const a of members.filter(a=>a.cell.condition==='graph-norule'))require(readFileSync(join(a.dir,'instructions.txt'),'utf8')+instructions.rule.toString()===expected,'norule instruction bytes differ beyond omitted rule');
 }
});
check('closed store and tool code',()=>{
 require(attempts.length>0,'no attempts');
 let probes=0,agentAttempts=0;
 for(const {dir} of attempts) {
  const proof=read(dir,'confinement.json');
  require(proof.length===5&&proof.every(p=>Number.isInteger(p.status)&&p.status!==0),'a confinement probe succeeded or did not run');probes+=proof.length;
  for(const tool of read(dir,'tools.json')) {
   const input=JSON.stringify(tool.input??{});
   const attempt=tool.name==='Bash' ? /(?:^|[;&|(\n])\s*(?:(?:env|exec|command)\s+)?(?:\/[^\s]+\/)?relate(?:\s|$)|\b(?:cat|head|tail|less|strings|xxd|od|cp|dd)\b[^\n]*(?:whygraph\/store|\/tools\/whygraph|closed-store\.mjs)/.test(String(tool.input?.command??'')) : /whygraph\/store|\/tools\/whygraph|closed-store\.mjs/.test(input);
   if(!attempt)continue;
   agentAttempts++;
   require(tool.error===true||/Permission denied|No such file|not found|unavailable|denied|cannot access/i.test(String(tool.result)),`successful store/code attempt: ${input}`);
  }
 }
 return `${probes} denied probes; ${agentAttempts} denied logged agent attempts`;
});
check('service answered every call',()=>{
 require(attempts.length>0,'no attempts');
 for(const {dir,meta} of attempts) {
  const calls=readFileSync(join(dir,'service.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
  require(meta.service?.failures===0&&meta.service.calls===calls.length&&calls.length>=4,'missing service replies or failure');
  require(calls.every(c=>Number.isInteger(c.code)&&typeof c.stdout==='string'&&typeof c.stderr==='string'&&c.code!==70),'bad service reply');
  require(!read(dir,'tools.json').some(t=>String(t.result).includes('whygraph service unavailable')),'client lost service');
 }
});
check('scorer batch blocks',()=>{
 const r=spawnSync(process.execPath,[join(here,'score.mjs'),'--results',results],{encoding:'utf8',maxBuffer:1<<28});
 require(r.status===0,r.stderr);
 for(const part of [`Batch ${batch}:`,`Batch ${batch}: stratum cited`,`Batch ${batch}: stratum uncited`,'graph - stub','graph - graph-nolink','graph - graph-nosearch','graph - graph-noterms','graph - graph-norule',`Batch ${batch} conflict counts`,`Batch ${batch} unscored runs`])require(r.stdout.includes(part),`missing ${part}`);
});
check('tokens and wall time per run',()=>{
 require(attempts.length>0,'no attempts');
 for(const {cell,meta} of attempts) {
  require(Number.isFinite(meta.tokens?.total)&&meta.tokens.total>=0&&Number.isFinite(meta.wall_ms)&&meta.wall_ms>=0,`${cell.id}: missing usage/time`);
  console.log(`  ${cell.id}: ${meta.tokens.total} tokens; ${meta.wall_ms} ms`);
 }
});
process.exitCode=failed?1:0;

#!/usr/bin/env node
/** module: [[whygraph-eval-rehearsal]] */
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { batchPlan, evalBatch } from './registry.mjs';
import { readTasks, scoreRun } from './score.mjs';
import { ticketTemplate, settleCell, wrap } from './run.mjs';
import { closedAttempt } from './closed-run.mjs';
import { fileKey } from './registry.mjs';
import { canonicalPath, closedWorkRoot, execBudget, filesystemPath } from './closed-store.mjs';

const here=fileURLToPath(new URL('.',import.meta.url));
const quiet={...process.env,RELATE_TELEMETRY:'0',DO_NOT_TRACK:'1'};
const within=(parent,path)=>{const rel=relative(parent,path);return rel===''||(!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+sep));};

async function main(args) {
  const started=performance.now();
  const options={};
  for(let i=0;i<args.length;i+=2) {
    if(!['--batch','--stage','--results'].includes(args[i])||!args[i+1]||args[i+1].startsWith('--')||options[args[i]]!==undefined)
      throw new Error('usage: rehearse.mjs --batch N [--stage smoke|full] [--results root]');
    options[args[i]]=args[i+1];
  }
  const batch=Number(options['--batch']),stage=options['--stage']??'full';
  if(!Number.isInteger(batch)||evalBatch(batch).storeAccess!=='closed')throw new Error('rehearsal requires a registered closed-store batch');
  const plan=batchPlan(readTasks(),{batch,stage});
  const work=closedWorkRoot(process.env.WHYGRAPH_EVAL_WORK??'/var/tmp/whygraph-eval');
  const resultRoot=canonicalPath(resolve(options['--results']??join(here,'../test-results/rehearsals')));
  const trial=canonicalPath(join(here,'results'));
  if(within(trial,resultRoot)||within(resultRoot,trial))throw new Error('rehearsal results must be outside eval/results and its ancestors');
  const inspect=dir=>{
    if(!existsSync(dir))return;
    for(const name of readdirSync(dir)) {
      const path=join(dir,name),stat=lstatSync(path);
      if(stat.isSymbolicLink())throw new Error(`rehearsal result root contains a symlink: ${path}`);
      if(stat.isDirectory())inspect(path);
      else if(name==='meta.json'&&JSON.parse(readFileSync(path,'utf8')).rehearsal!==true)
        throw new Error(`rehearsal result root holds a trial result: ${path}`);
    }
  };
  inspect(resultRoot);
  filesystemPath(join(resultRoot,'0'.repeat(36),'_ledger','x'.repeat(133)));
  const controls=JSON.parse(readFileSync(join(here,'rehearsal-controls.json'),'utf8'));
  const templates=new Map();
  for(const {task} of plan) {
    execBudget('/tools/opencode',[wrap(task.request)]);
    if(!templates.has(task.repo))templates.set(task.repo,ticketTemplate(task.repo,true));
    if(task.kind==='control') {
      const fixture=controls[task.id];
      const digest=createHash('sha256').update(JSON.stringify(task)).digest('hex');
      if(!fixture||fixture.taskHash!==digest||typeof fixture.target!=='string')throw new Error(`missing or mismatched rehearsal edit fixture: ${task.id}`);
      for(const edit of fixture.edits) {
        const text=readFileSync(join(templates.get(task.repo).repo,edit.file),'utf8');
        if(!edit.before||text.split(edit.before).length!==2)throw new Error(`mismatched rehearsal edit anchor: ${task.id}: ${edit.file}`);
      }
    }
  }
  const results=join(resultRoot,randomUUID());mkdirSync(results,{recursive:true});
  writeFileSync(join(results,'rehearsal.json'),JSON.stringify({version:1,rehearsal:true,batch,stage,cells:plan.map(p=>p.id)},null,2));
  console.log(`Rehearsal results: ${results}`);
  // A live host listener makes network denial a real confinement check.
  const network=createServer(connection=>connection.end());
  await new Promise((ok,fail)=>{network.once('error',fail);network.listen(0,'127.0.0.1',ok);});
  let success=false,smoke;
  try {
    const runAttempt=async(task,condition,repeat)=>{
      const id=`${task.id}__${condition}__r${repeat}`,out=join(results,fileKey(id));
      mkdirSync(out,{recursive:true});
      const template=templates.get(task.repo);
      const target=task.ground_truth.targets?.[0];
      const edits=task.kind==='control'?controls[task.id].edits:[];
      const source=target?.file??edits[0]?.file;
      if(!source)throw new Error(`task has no rehearsal source: ${task.id}`);
      const config={source:`/repo/${source}`,target:target?`${target.file}:${target.symbol}`:controls[task.id].target,edits,
        impact:task.ground_truth.source.record?`ticket-${task.ground_truth.source.record}`:task.ground_truth.source.ticket,
        store:realpathSync(template.store),serviceCode:join(here,'closed-store.mjs'),
        otherSocket:join(work,'other','service.sock'),networkPort:network.address().port};
      try {
        return await closedAttempt({task,condition,repeat,workRoot:work,out,prompt:wrap(task.request),source:template.repo,store:template.store,
          rehearsal:{executable:join(here,'stand-in.mjs'),config}});
      } catch(error) {
        const meta={id,task:task.id,condition,repeat,rehearsal:true,status:'invalid',reason:`harness failure: ${error.message}`,tokens:{total:0},wall_ms:0};
        writeFileSync(join(out,'meta.json'),JSON.stringify(meta,null,2));return meta;
      }
    };
    for(const cell of plan) {
      console.log(`start ${cell.id}`);
      const meta=await settleCell(cell,plan.map(p=>p.id),{runAttempt,results});
      if(meta.status!=='done')throw new Error(`rehearsal cell failed: ${cell.id}: ${meta.reason??meta.status}`);
      const dir=join(results,fileKey(cell.id));
      if(cell.task.kind==='control') {
        const verdict=scoreRun(cell.task,{final:readFileSync(join(dir,'final.txt'),'utf8'),diff:readFileSync(join(dir,'diff.patch'),'utf8'),tools:JSON.parse(readFileSync(join(dir,'tools.json'),'utf8'))});
        if(!verdict.pass)throw new Error(`rehearsal control failed its pass rule: ${cell.id}: ${verdict.reasons.join('; ')}`);
      }
      console.log(`done ${cell.id}`);
    }
    smoke=spawnSync(process.execPath,[join(here,'smoke-check.mjs'),'--batch',String(batch),'--results',results],{env:quiet,encoding:'utf8',maxBuffer:1<<26});
    writeFileSync(join(results,'smoke-check.txt'),(smoke.stdout??'')+(smoke.stderr??''));
    process.stdout.write(smoke.stdout??'');process.stderr.write(smoke.stderr??'');
    if(smoke.error||smoke.status!==0)throw new Error(`rehearsal smoke-check failed (${smoke.status}): ${smoke.error?.message??''}`);
    success=true;
  } finally {
    await new Promise((ok,fail)=>network.close(error=>error?fail(error):ok()));
    const group=readFileSync('/proc/self/cgroup','utf8').trim().split('\n').find(l=>l.startsWith('0::'))?.slice(3);
    const measurement={success,cells:plan.length,wall_ms:performance.now()-started,scope_peak_bytes:group?Number(readFileSync(`/sys/fs/cgroup${group}/memory.peak`,'utf8')):null,smoke_exit:smoke?.status};
    writeFileSync(join(results,'measurement.json'),JSON.stringify(measurement,null,2));
    console.log(JSON.stringify(measurement));
  }
}

if(process.argv[1]===fileURLToPath(import.meta.url)) {
  try { await main(process.argv.slice(2)); } catch(error) { console.error(error.stack);process.exitCode=1; }
}

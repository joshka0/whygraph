/** module: [[whygraph-trial-design]]
 * Rebuild the current audit from the second ruling's focused and full runs.
 */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {resolve,join,relative} from 'node:path';
const root=resolve(import.meta.dirname,'../..'),read=p=>readFileSync(p,'utf8'),json=p=>JSON.parse(read(p)),rel=p=>relative(root,p);
const logs=process.argv.slice(2);assert.equal(logs.length,3,'supply the focused 50-repetition log and both full-suite logs');
const runs=logs.map((file,index)=>{
 const log=resolve(root,file),text=read(log),summary=text.match(/(\d+)\/(\d+) (?:batch 7 )?cases as expected/);assert.ok(summary,'completed suite summary required');
 const scratch=text.match(/Batch 7 self-test scratch retained: (.+)/)?.[1];assert.ok(scratch,'scratch root required');
 const path=join(scratch,'runner-death-repetitions.json'),ledger=json(path);assert.equal(ledger.repetitions,50,'all 50 repetitions must finish');
 const evidence=ledger.results.map(r=>json(r.observation));
 const more=evidence.filter(r=>r.observations.length>1).length;
 const longest=Math.max(...evidence.map(r=>r.wall_ms));
 assert.equal(ledger.more_than_one_observation,more,'raw observations must agree with the repetition counter');
 const plantPath=join(scratch,'plant2-survives-runner.json'),plant=json(plantPath),plantEvidence=json(plant.runnerObservation.observation);
 assert.match(plant.assertion,/runner children must be gone or zombie within 10 seconds/);
 assert.ok(plantEvidence.wall_ms>=10000,'plant must reach the full bound');
 assert.ok(plantEvidence.final.some(s=>!s.gone&&s.state!=='Z'&&BigInt(s.vsize)>0n),'plant must retain an address space at the bound');
 const measurements=index===0?[]:['small-stress','synthetic-5000','real-zustand','unbounded'].map(name=>{const p=join(scratch,`measurement-${name}.json`),r=json(p);return {name,path:rel(p),status:r.status,state:r.state,wall_ms:r.wall_ms,memory:r.memory};});
 const plants=index===0?[]:['unbounded','per-cell','receipt','half-made','vector'].map(name=>{const p=join(scratch,`plant-memory-${name}.json`);return {name,path:rel(p),...json(p)};});
 return {kind:index===0?'focused':'full',log:rel(log),exit:Number(read(log+'.exit').trim()),passed:Number(summary[1]),total:Number(summary[2]),scratch:rel(scratch),failures:text.split('\n').filter(l=>l.startsWith('WRONG ')),runner:{path:rel(path),repetitions:50,failed:ledger.results.filter(r=>r.error).length,more_than_one_observation:more,longest_time_to_gone_or_zombie_ms:longest,kernel_teardown_repetitions:evidence.filter(r=>r.observations.some(o=>o.states.some(s=>s.teardown))).length},surviving_child_plant:{path:rel(plantPath),first_failing_assertion:plant.assertion,wall_ms:plantEvidence.wall_ms,live_address_spaces_at_bound:plantEvidence.final.filter(s=>!s.gone&&s.state!=='Z'&&BigInt(s.vsize)>0n).length},measurements,other_plants:plants};
});
const checks=Object.fromEntries(['typecheck','memod','readme','score'].map(name=>{const log=`test-results/trial7-tests5-ruling2-${name}.txt`;return [name,{log,exit:Number(read(join(root,log+'.exit')).trim()),output_bytes:Buffer.byteLength(read(join(root,log)))}];}));
const green=runs.every(r=>r.exit===0&&r.passed===r.total&&r.runner.failed===0)&&Object.values(checks).every(r=>r.exit===0);
const audit={contract_commit:'4d186ad',test_commit:'1e572f6',ruling:'B7-93 second form',status:green?'done':'blocked',coverage:'The runner owner dies after both readiness messages. The case samples every recorded PID until all are gone or zombies, or the 10-second bound passes. A surviving child with an address space is refused at the actual bound. Child writes before termination are permitted. Cleanup and timeout cases keep their previous predicate.',clock:'Elapsed time starts immediately before SIGKILL is requested, so the 10-second bound includes owner reap. No client wait or cleanup precedes the observations.',runs,checks,omitted_items:[],contract_disagreements:runs.flatMap(r=>r.failures.map(name=>({log:r.log,name}))),scope:{branch:'batch-7-memory',tracked_edits:['eval/selftest/'],production_changes:0,hosted_model_calls:0,installs:0,pushes:0},retained_scratch:[...new Set(readdirSync(join(root,'test-results')).filter(n=>/^trial7-tests5-ruling2-.*\.txt$/.test(n)).flatMap(n=>[...read(join(root,'test-results',n)).matchAll(/(?:scratch retained|scratch): (\/[^\n]+)/gi)].map(m=>rel(m[1]))))].sort()};
const auditPath=join(root,'eval/selftest/batch7-audit.json'),current=json(auditPath);current.runner_death_second_ruling=audit;current.fifth_round.superseded_by='4d186ad: B7-93 second form';writeFileSync(auditPath,JSON.stringify(current,null,2)+'\n');
const row=(...v)=>'| '+v.join(' | ')+' |';
const section=['## B7-93 second-ruling audit','',
 'Parent ruling `4d186ad` replaces the first-observation requirement. The test now observes until all recorded children are gone or zombies, or ten seconds pass. The timeout and cleanup cases keep their existing rule. No production file changed.','',
 '### Results','',row('Run','Cases','Exit','Repetitions','Needed more than one observation','Longest time to gone or zombie, ms'),row('---','---','---','---','---','---'),
 ...runs.map((r,i)=>row(`[${i?'full '+i:'focused'}](../../${r.log})`,`${r.passed}/${r.total}`,r.exit,r.runner.repetitions,r.runner.more_than_one_observation,r.runner.longest_time_to_gone_or_zombie_ms.toFixed(3))),'',
 'Each repetition runs under four CPU-load processes. Its clock starts before the owner receives SIGKILL, so the recorded time includes owner reap. Every intermediate process state is retained. The case waits for neither the client nor cleanup before observing the children. A child write during this interval does not fail the case.','',
 '### Surviving-child plant','',row('Run','First failing assertion','Elapsed ms','Live address spaces at bound'),row('---','---','---','---'),
 ...runs.map((r,i)=>row(i?'full '+i:'focused',r.surviving_child_plant.first_failing_assertion.split('\n')[0],r.surviving_child_plant.wall_ms.toFixed(3),r.surviving_child_plant.live_address_spaces_at_bound)),'',
 'The plant removes the command PID namespace and parent-death enforcement from a disposable code copy. The case must wait for the full ten-second bound, then fail while a recorded child still has an address space. Fixture cleanup starts after the failing assertion and its evidence have been saved.','',
 '### Memory checks repeated by the full suites','',row('Run','Input','Peak bytes','Wall ms','Result'),row('---','---','---','---','---'),
 ...runs.filter(r=>r.kind==='full').flatMap((r,i)=>r.measurements.map(m=>row(i+1,m.name,m.memory?.peak??'absent',m.wall_ms?.toFixed(2)??'absent',m.state??(m.status===0?'success':'expected bounded OOM')))),'',
 'Each full suite also catches the other five memory and receipt plants. The JSON audit holds each assertion receipt. Memory tests still use their own bounded scopes. Each full suite runs inside the required 6G scope. Wall times are observations under shared load.','',
 '### Other checks','',row('Check','Exit','Evidence'),row('---','---','---'),...Object.entries(checks).map(([k,v])=>row(k,v.exit,`[log](../../${v.log})`)),'',
 'No requested item lacks a case. '+(green?'No code/contract disagreement remains under the second ruling.':'The JSON audit lists each remaining failure.'),'',
 '### Evidence retained','',...audit.retained_scratch.map(p=>'- `'+p+'`.'),
 '- `test-results/trial7-tests5-ruling2-*` holds the focused and full logs, exact exit statuses, and check logs. Earlier evidence remains intact.','',
 'The fifth-round section below its historical heading records the superseded first-form ruling. Its failures are historical evidence, not current failures.','',
 '### Reproduce','', '```sh',
 'export PATH="$HOME/.opencode/bin:$HOME/.npm-global/bin:$HOME/.local/share/mise/installs/pnpm/12.11.2:$HOME/.local/bin:$PATH"',
 'TMPDIR=/mnt/ssd/tmp systemd-run --user --scope -q -p MemoryMax=2G -p CPUQuota=400% node eval/selftest/batch7-check.mjs B7-93',
 'TMPDIR=/mnt/ssd/tmp systemd-run --user --scope -q -p MemoryMax=6G -p CPUQuota=400% node eval/selftest/check.mjs',
 '```',''];
const mdPath=join(root,'eval/selftest/batch7-audit.md');let md=read(mdPath).split('\n## B7-93 second-ruling audit')[0];
md=md.replace(/status: (?:done|blocked)/,`status: ${green?'done':'blocked'}`);
const abstract=/> \[!abstract\] Answer\n(?:>[^\n]*\n)+/;assert.ok(abstract.test(md));md=md.replace(abstract,`> [!abstract] Answer\n> Under B7-93 second form, the final full suites report ${runs.slice(1).map(r=>`${r.passed}/${r.total}, exit ${r.exit}`).join('; ')}.\n> The focused 50 repetitions and surviving-child plant also completed. See the second-ruling audit for observation counts and elapsed times.\n`);
md=md.replace('## Fifth-round memory and runner-death audit','## Historical fifth-round memory and runner-death audit');
writeFileSync(mdPath,md.trimEnd()+'\n\n'+section.join('\n'));
console.log(JSON.stringify(audit,null,2));

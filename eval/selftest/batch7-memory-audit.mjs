/** module: [[whygraph-trial-design]]
 * Rebuild the fifth-round audit from complete, retained self-test evidence.
 */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve,join,relative} from 'node:path';
const root=resolve(import.meta.dirname,'../..'),read=p=>readFileSync(p,'utf8'),json=p=>JSON.parse(read(p)),rel=p=>relative(root,p);
const logs=process.argv.slice(2);assert.equal(logs.length,2,'supply both final full-suite logs');
const coverage={
 'B7-83':'Two-record build first; committed 5000-record/305000-edge build; exact proofs and peak under the enforced billion-byte limit. Real zustand case runs read-only when present and explicitly reports absence.',
 'B7-84':'Two and three real processes contend under flock; all are alive before publication. One common scope measures their aggregate peak. External instrumentation sees two copies, two mutation queries and six fingerprint query processes.',
 'B7-85':'Fresh-process reuse makes zero copy/query calls and preserves receipt bytes, mtime and ctime. Six simulated-agent cells use the shared receipt fingerprints in real health records.',
 'B7-86':'Vector, text, endpoint, edge properties, unrelated node and edge changes each refuse. Replaced, added and removed files refuse. Exact nanosecond mtime restoration still changes ctime and refuses.',
 'B7-87':'Kill at real copy, mutation, fingerprint, partial proof write and receipt-rename boundaries. Every later caller acquires the released lock, refuses without copy/query, and preserves incomplete evidence.',
 'B7-88':'Foreign source marker, retargeted symlink, algorithm, version, broken JSON, missing/changed proof, changed receipt fingerprint and missing marker each refuse without copy/query.',
 'B7-89':'Vector, text, labels, public/internal node identity, internal edge identity, endpoint, type, properties, parallel multiplicity and unrelated components each change their own digest. Every changed source still passes exact ablation proofs. Terms occupy interior IDs; a renumbering query process refuses.',
 'B7-90':'Source rewrite during a paused real preparation refuses at the final identity check. A missing manifest refuses before query/copy. Neither publishes ready evidence.',
 'B7-91':'Both fingerprint and preparation reject nonzero exit, invalid JSON, spawn failure and successful truncated output. No ready receipt or running query child remains.',
 'B7-92':'Read-only opens and both advisory lock files preserve reuse. Manifest, node snapshot, relationship snapshot and real WAL data mutations each refuse in all three stores. Existing health/smoke byte checks remain in the full suite.',
 'B7-93':'First /proc state is sampled immediately after owner reap, before awaiting client completion. Only gone, zombie, or PF_EXITING + zero vsize + empty cmdline passes. Every later state must stay terminated, disappearance has the stated 10-second bound, and release produces no later file write. Fifty repetitions run under four CPU-load processes; live survivors remain red.'
};
const plantOwners={unbounded:'B7-83 bounded preparation must succeed','per-cell':'B7-85 restart makes zero copy and relate calls',receipt:'B7-88 invalid receipt refuses','half-made':'B7-87 incomplete preparation refuses',vector:'B7-89 changed vector changes node fingerprint','survives-runner':'B7-93 first observation sees no live child with an address space'};
const runs=logs.map(file=>{
 const log=resolve(root,file),text=read(log),summary=text.match(/(\d+)\/(\d+) cases as expected \(([^\n]+)\)/);assert.ok(summary,'full-suite summary required');
 const scratch=text.match(/Batch 7 self-test scratch retained: (.+)/)?.[1];assert.ok(scratch,'batch 7 scratch required');
 const measurements=['small-stress','synthetic-5000','real-zustand','unbounded'].map(name=>{
  const path=join(scratch,`measurement-${name}.json`);assert.ok(existsSync(path),'measurement evidence required: '+name);const r=json(path);
  return {name,path:rel(path),status:r.status,state:r.state,reason:r.reason,wall_ms:r.wall_ms,memory:r.memory};
 });
 const concurrency=readdirSync(scratch).filter(n=>/^memory-\d+-concurrent-[23]$/.test(n)).map(n=>{const path=join(scratch,n,'concurrency.json'),r=json(path);return {path:rel(path),callers:r.config.callers,status:r.status,wall_ms:r.wall_ms,memory:r.memory};});
 const restartPath=readdirSync(scratch).find(n=>/^memory-\d+-restart$/.test(n));
 const restart=json(join(scratch,restartPath,'restart.json'));
 const plants=Object.entries(plantOwners).map(([name,owner])=>{
  const path=join(scratch,name==='survives-runner'?'plant2-survives-runner.json':`plant-memory-${name}.json`);assert.ok(existsSync(path),'plant evidence required: '+name);
  const r=json(path);return {name,owner,path:rel(path),first_failing_assertion:r.assertion};
 });
 const repetitionsPath=join(scratch,'runner-death-repetitions.json'),repetitions=json(repetitionsPath);assert.equal(repetitions.repetitions,50,'all 50 repetitions must finish');
 const observations=repetitions.results.map(r=>{const v=json(r.observation);return Array.isArray(v)?v:v.first;});
 const states=Object.fromEntries(['Z','R','D','X','S'].map(state=>[state,observations.flat().filter(v=>v.teardown&&v.state===state).length]));
 return {log:rel(log),exit:Number(read(log+'.exit').trim()),passed:Number(summary[1]),total:Number(summary[2]),summary:summary[0],scratch:rel(scratch),failures:text.split('\n').filter(l=>l.startsWith('WRONG ')),measurements,concurrency,restart:{path:rel(join(scratch,restartPath,'restart.json')),wall_ms:restart.wall_ms,memory:restart.memory},plants,runner:{path:rel(repetitionsPath),repetitions:50,failed:repetitions.results.filter(r=>r.error).length,kernel_teardown_repetitions:observations.filter(rows=>rows.some(v=>v.teardown&&v.state!=='Z')).length,exiting_predicate_repetitions_including_zombies:repetitions.kernel_teardown_repetitions,teardown_process_observations_by_state:states}};
});
const checks=Object.fromEntries(['typecheck','memod','readme','score'].map(name=>{const log=`test-results/trial7-tests5-${name}.txt`;return [name,{log,exit:Number(read(join(root,log+'.exit')).trim()),output_bytes:Buffer.byteLength(read(join(root,log)))}];}));
assert.ok(runs.every(r=>r.failures.every(f=>/B7-93|B7-76 runner/.test(f))),'classify any failure outside the known runner-death disagreement before publishing this audit');
const disagreements=runs.flatMap(r=>r.failures.map(f=>({run:r.log,case:f,contract:'B7-93 requires termination at the first observation after owner reap.',observed:'At least one recorded process still has an address space and fails the exact termination predicate. Production code remains unchanged.'})));
const audit={contract_commit:'f826221',production_commit:'2902747',test_commits:['f7ed190','6bae259'],coverage,runs,checks,omitted_items:[],skipped_cases:runs.flatMap(r=>r.measurements.filter(m=>m.state==='did not run').map(m=>({run:r.log,...m}))),contract_disagreements:disagreements,scope:{edits:['eval/selftest/'],installs:0,hosted_models_started:0,delegation:false,pushes:0,branch:'batch-7-memory'},measurement_limits:'Whole-scope cgroup memory.peak includes subprocesses and charged file cache. The B7-83 preparation and OOM scopes request MemoryMax=1000000000 and CPUQuota=400%. Concurrency and receipt reuse run in 2G scopes. Linux rounds MemoryMax down to a page boundary. OOMPolicy=continue preserves the observer after the kernel kills the unbounded relate child; the memory bound does not change. Times are observations under shared load, not speed comparisons.',fixture_corrections:['Page rounding is asserted using getconf PAGESIZE.','Snapshot files come from manifest node_parts and rel_parts, not guessed filenames.','WAL selection excludes advisory lock basenames in nested directories.','The OOM requirement is checked outside the expected-assertion catcher so missing evidence cannot pass.'],governing_records:['B7-83 through B7-93 at f826221','ADR 0011: store preparation, command scope lifetime, immutable receipts','eval/README.md: Batch 7, fixed before its first run','No decided/premise tag governs the edited test functions. No production code or decision record changed.'],source_history:{git:'Read 2902747, f826221, 96ef115, b029576 and 455d9c1; memod history of batch7HostChecks.',fleet_memory:'mem view/topics/history cannot resolve /Users/joshka/repos/personal/whygraph.',issue_tracker:'The local failure list is the complete task contract; remote issues are irrelevant.',error_tracking:'No tool needed for offline test fixtures.',delegation:'Forbidden by the brief; no investigator launched.'},author_model:{harness:'Codex',model:'inherited session; exact ID not exposed',effort:'inherited session; exact setting not exposed',additional_models_launched:0}};
audit.retained_scratch=[...new Set(readdirSync(join(root,'test-results')).filter(n=>/^trial7-tests5-.*\.txt$/.test(n)).flatMap(n=>[...read(join(root,'test-results',n)).matchAll(/(?:scratch retained|scratch): (\/[^\n]+)/gi)].map(m=>rel(m[1]))))].sort();
audit.old_ablations={path:'/var/tmp/whygraph-eval/_zustand/ablations',inspection:'test-results/trial7-tests5-old-ablations.txt',result:'empty; inspected read-only; no archive or removal needed'};
const auditPath=join(root,'eval/selftest/batch7-audit.json'),current=json(auditPath);current.fifth_round=audit;writeFileSync(auditPath,JSON.stringify(current,null,2)+'\n');
const row=(...cells)=>'| '+cells.join(' | ')+' |';
const section=['## Fifth-round memory and runner-death audit','',
 'The test work is complete. B7-93 remains a production failure. No code outside `eval/selftest/` changed. The branch is `batch-7-memory`; nothing was pushed.','',
 '### Final full suites','',row('Run','Cases','Exit','Runner failures out of 50','Non-zombie kernel teardown repetitions'),row('---','---','---','---','---'),
 ...runs.map((r,i)=>row(`[${i+1}](../../${r.log})`,`${r.passed}/${r.total}`,r.exit,r.runner.failed,r.runner.kernel_teardown_repetitions)),'',
 'Each load check completed all 50 repetitions. A live process with an address space fails at its first observation. The permitted teardown state requires `PF_EXITING`, zero address-space size and an empty command line. The runner case makes no cleanup call before this observation.','',
 'The raw ledger counter includes zombies because zombies also meet that exiting predicate. The table counts non-zombie teardown at the first observation. The JSON audit keeps both counts and each observed state; the raw evidence is unchanged.','',
 '### Memory evidence','',row('Run','Input','Peak bytes','Wall ms','Result'),row('---','---','---:','---:','---'),
 ...runs.flatMap((r,i)=>r.measurements.map(m=>row(i+1,m.name,m.memory?.peak??'absent',m.wall_ms?.toFixed(2)??'absent',m.state??(m.status===0?'success':'expected bounded OOM')))),
 ...runs.flatMap((r,i)=>[...r.concurrency.map(m=>row(i+1,`${m.callers} callers, aggregate scope`,m.memory.peak,m.wall_ms.toFixed(2),'success')),row(i+1,'receipt reuse',r.restart.memory.peak,r.restart.wall_ms.toFixed(2),'success')]),'',
 audit.measurement_limits,'',
 '### Contract coverage','',row('Item','Check'),row('---','---'),...Object.entries(coverage).map(([k,v])=>row(k,v)),'',
 'No item lacks a case. '+(audit.skipped_cases.length?'The JSON audit names each absent real-store measurement.':'The real zustand store was present and ran in both final suites.'),'',
 '### Required plants','',row('Fault','Owner','First failing assertion in run 2'),row('---','---','---'),...runs[1].plants.map(p=>row(p.name,p.owner,p.first_failing_assertion.split('\n')[0])),'',
 'Each plant changes a disposable code copy. JSON receipts retain the exact assertion and its values. The unbounded plant must also record `oom_kill > 0` and `SIGKILL`; an assertion caused by missing OOM evidence cannot pass.','',
 '### Remaining disagreement','',
 ...disagreements.map(d=>`- ${d.case.replace(/^WRONG /,'')}. ${d.contract} ${d.observed}`),'',
 'The parent must rule on B7-93. The tests do not wait for client completion before the first observation, loosen the process predicate, or change the launcher.','',
 '### Other checks','',row('Check','Exit','Evidence'),row('---','---','---'),...Object.entries(checks).map(([k,v])=>row(k,v.exit,`[log](../../${v.log})`)),'',
 'The saved-score comparison prints no bytes. README checks, memod lint and the tsrs type check run in separate 2G scopes. No trial or hosted model ran.','',
 '### Evidence retained','',
 ...runs.map(r=>'- `'+r.scratch+'` holds measurements, store copies, six plant receipts, scope logs and 50 runner observations.'),
 '- `test-results/trial7-tests5-*` holds the small probes, focused runs, OOM diagnosis and final logs. Earlier focused `batch7-selftest-*` folders remain as evidence. No scratch file was deleted.','',
 ...audit.retained_scratch.map(p=>'- `'+p+'`.'),'',
 'The supplied `/var/tmp/whygraph-eval/_zustand/ablations` directory was empty on read-only inspection. `test-results/trial7-tests5-old-ablations.txt` retains that listing. No archive or removal was needed.','',
 'The JSON audit holds the full coverage map, exact scratch paths, raw plant assertions and source-history gaps. Prior audit sections describe earlier rounds.','',
 '### Reproduce','',
 '```sh',
 'export PATH="$HOME/.opencode/bin:$HOME/.npm-global/bin:$HOME/.local/share/mise/installs/pnpm/12.11.2:$HOME/.local/bin:$PATH"',
 'TMPDIR=/mnt/ssd/tmp systemd-run --user --scope -q -p MemoryMax=6G -p CPUQuota=400% node eval/selftest/check.mjs',
 'TMPDIR=/mnt/ssd/tmp systemd-run --user --scope -q -p MemoryMax=2G -p CPUQuota=400% node eval/selftest/batch7-check.mjs memory',
 'TMPDIR=/mnt/ssd/tmp systemd-run --user --scope -q -p MemoryMax=2G -p CPUQuota=400% node eval/selftest/batch7-check.mjs B7-93',
 '```',''];
const markdownPath=join(root,'eval/selftest/batch7-audit.md');let markdown=read(markdownPath).split('\n## Fifth-round memory and runner-death audit')[0];
markdown=markdown.replace('status: done','status: blocked');
const abstract=/> \[!abstract\] Answer\n(?:>[^\n]*\n)+/;assert.ok(abstract.test(markdown));markdown=markdown.replace(abstract,`> [!abstract] Answer\n> Both final suites complete ${runs[0].total} cases. Results: ${runs.map(r=>`${r.passed}/${r.total}, exit ${r.exit}`).join('; ')}.\n> B7-93 remains red because live children can retain address spaces after owner reap. See the fifth-round audit below.\n`);
if(!markdown.includes('## Historical third-round audit'))markdown=markdown.replace('**What changed**','## Historical third-round audit\n\n**What changed**');
writeFileSync(markdownPath,markdown.trimEnd()+'\n\n'+section.join('\n'));
console.log(JSON.stringify({runs:runs.map(r=>({log:r.log,passed:r.passed,total:r.total,exit:r.exit,runner:r.runner})),checks,contract_disagreements:disagreements.length},null,2));

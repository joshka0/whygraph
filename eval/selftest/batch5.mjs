/**
 * module: [[whygraph-batch5-selftest]]
 * Contract-derived batch 5 acceptance cases. Production modules are opaque;
 * fixtures, public calls and boundary mutants are retained under test-results/.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { opencodeSession, opencodeLaunch, escapingSymlinks, isolationBreaches } from '../opencode.mjs';
import { prepare, agentCommand } from '../run.mjs';
import { batch5ReportChecks } from './batch5-report.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = p => readFileSync(p, 'utf8');
const json = p => JSON.parse(read(p));
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const conditions = ['none', 'graph', 'stub', 'graph-nosearch'];
const numbers = [4,5,6,7,8,9,10,15,16,17,18,19,20,24,25,26,28,29,30];
const conflicts = numbers.map(n => `ripgrep5-conflict-rg-${String(n).padStart(2,'0')}`);
const controls = [1,2,3,4,5].map(n => `ripgrep5-control-ctl-0${n}`);
const governed = [1,2,3,4,5,6,7,8].map(n => `ripgrep5-control-gov-0${n}`);
const ids = [...conflicts, ...controls, ...governed];
const event = (type, part = {}) => ({ type, part });
const text = value => event('text', { text: value });
const finish = (reason = 'stop', extra = {}) => event('step_finish', { reason, ...extra });
const tool = (name, state) => event('tool_use', { tool: name, state });
const bash = command => ({ name: 'Bash', input: { command }, result: '', error: false });
const edit = (file, added = 'new', removed = 'old') => `diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n@@ -1 +1 @@\n-${removed}\n+${added}\n`;
function node(script, args = [], env = {}) {
  const r = spawnSync(process.execPath, [script, ...args], { cwd: root, env: {...process.env,...env}, encoding:'utf8', timeout:30000, maxBuffer:32*1024*1024 });
  assert.ifError(r.error); return r;
}
function snapshot(dir) {
  return readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).map(e=>[e.name,e.isDirectory()?snapshot(join(dir,e.name)):sha(join(dir,e.name))]);
}
function copyHarness(base) {
  const at = join(base,'eval'); mkdirSync(at,{recursive:true});
  for (const f of ['run.mjs','opencode.mjs','score.mjs','tasks']) cpSync(join(root,'eval',f),join(at,f),{recursive:true});
  return at;
}
function expectedConfig(data) {
  return { autoupdate:false,share:'disabled',snapshot:false,plugin:[],mcp:{},instructions:[],formatter:false,lsp:false,enabled_providers:['opencode-go'],permission:{'*':'deny',bash:'allow',skill:'allow',read:'allow',edit:'allow',glob:'allow',grep:'allow',external_directory:{'*':'deny',[`${data}/opencode/tool-output/*`]:'deny'},webfetch:'deny',websearch:'deny',task:'deny',question:'deny'} };
}

/** owns: [[whygraph-batch5-selftest]] */
export async function batch5Checks({tasks,scoreRun}) {
  mkdirSync(join(root,'test-results'),{recursive:true});
  const scratch = mkdtempSync(join(root,'test-results/batch5-selftest-'));
  console.log(`Batch 5 self-test scratch retained: ${scratch}`);
  const checks=[];
  const add=(name,run)=>checks.push({name:`B5 ${name}`,run});
  const subset=(actual,want)=>{for(const [k,v] of Object.entries(want))assert.deepEqual(actual[k],v,k);};
  const stream=(name,events,want)=>{
    add(`stream ${name}`,()=>{
      const dir=join(scratch,`stream-${checks.findIndex(c=>c.name===`B5 stream ${name}`)}`);mkdirSync(dir,{recursive:true});
      writeFileSync(join(dir,'output.jsonl'),events.map(e=>JSON.stringify(e)).join('\n')+'\n');
      const actual=opencodeSession(events);subset(actual,want);
      writeFileSync(join(dir,'final.txt'),actual.final);writeFileSync(join(dir,'tools.json'),JSON.stringify(actual.tools));writeFileSync(join(dir,'session.json'),JSON.stringify(actual));
    });
  };
  const zeros={input:0,output:0,reasoning:0,cache_read:0,cache_creation:0,total:0};
  stream('step_start adds nothing',[event('step_start',{tokens:{total:999},cost:99})],{final:'',tools:[],tokens:zeros,cost_usd:0,turns:0,replies:0,success:false});
  stream('one shell output',[tool('shell',{status:'completed',input:{command:'echo ok',extra:1},output:'ok\n'}),text('Done'),finish()],{final:'Done',replies:1,success:true,tools:[{name:'Bash',input:{command:'echo ok',extra:1},result:'ok\n',error:false}]});
  stream('several shell and file tools',[tool('shell',{status:'completed',input:{command:'one'},output:'first'}),tool('bash',{status:'error',input:{command:'two'},error:'failed'}),tool('read',{status:'completed',input:{filePath:'file'},output:'file bytes'}),text('Done'),finish()],{tools:[{name:'Bash',input:{command:'one'},result:'first',error:false},{name:'Bash',input:{command:'two'},result:'failed',error:true},{name:'read',input:{filePath:'file'},result:'file bytes',error:false}],success:true});
  stream('missing tool output',[tool('shell',{status:'completed',input:{command:'true'}})],{tools:[{name:'Bash',input:{command:'true'},result:'',error:false}],success:false});
  stream('result truncated at 4000',[tool('shell',{status:'error',input:{command:'long'},output:'a'.repeat(4000)+'ticket-3276',error:'unused'})],{tools:[{name:'Bash',input:{command:'long'},result:'a'.repeat(4000),error:true}]});
  stream('all text in order across steps',[text('Before'),finish('tool-calls'),tool('shell',{status:'completed',input:{command:'x'},output:'not reply'}),text('After'),event('reasoning',{text:'not reply'}),text('Last'),finish()],{final:'Before\n\nAfter\n\nLast',replies:3,turns:2,success:true});
  stream('usage and cost independently summed',[finish('tool-calls',{cost:.125,tokens:{input:2,output:3,reasoning:5,cache:{read:7,write:11},total:13}}),finish('tool-calls',{}),text('Done'),finish('stop',{cost:.25,tokens:{input:17,output:19,reasoning:23,cache:{read:29,write:31},total:37}})],{tokens:{input:19,output:22,reasoning:28,cache_read:36,cache_creation:42,total:50},cost_usd:.375,turns:3,replies:1,success:true});
  for(const [name,events,want] of [
    ['no text',[finish()],{final:'',success:false,replies:0}],['blank text',[text(' \n'),finish()],{final:' \n',success:false,replies:1}],
    ['missing finish',[text('Earlier')],{final:'Earlier',success:false}],['last finish incomplete',[text('Earlier'),finish(),finish('tool-calls')],{success:false}],
    ['error despite stop',[text('Earlier'),event('error',{message:'failed'}),finish()],{success:false}],
    ['unknown event ignored',[event('invented',{text:'ignored',cost:10,tokens:{total:99}}),text('Done'),finish()],{final:'Done',success:true,cost_usd:0,tokens:zeros}],
  ])stream(name,events,want);

  add('isolation unresolvable internal target EACCES is conservatively invalid',()=>{
    const r=join(scratch,'unreadable-target');mkdirSync(r);writeFileSync(join(r,'file'),'ordinary');symlinkSync('file',join(r,'alias'));const original=fs.realpathSync;
    try{fs.realpathSync=(path,...args)=>{if(String(path).startsWith(`${r}/`))throw Object.assign(new Error('invented unreadable target'),{code:'EACCES'});return original(path,...args);};syncBuiltinESMExports();assert.ok(escapingSymlinks(r).length>0);}finally{fs.realpathSync=original;syncBuiltinESMExports();}
  });
  const repo=join(scratch,'isolation/repo');mkdirSync(join(repo,'.git/hidden'),{recursive:true});mkdirSync(join(repo,'pkg/brew'),{recursive:true});writeFileSync(join(repo,'file'),'ordinary');
  const hits=(r=repo,tools=[])=>isolationBreaches(r,tools);
  add('isolation ordinary files have no hits',()=>assert.deepEqual(hits(),[]));
  for(const [label,target,where] of [
    ['file','/etc/hostname','escape-file'],['directory','/etc','.git/hidden/escape-dir'],['dangling external',join(scratch,'not-created/target'),'dangling'],['internal chain external','escape-file','chain'],['cycle','cycle','cycle'],
  ])add(`isolation ${label} symlink detected`,()=>{
    symlinkSync(target,join(repo,where));assert.ok(escapingSymlinks(repo).some(h=>JSON.stringify(h).includes(where)),`missing ${where}`);
  });
  add('isolation internal file, directory, HomebrewFormula and store symlinks accepted',()=>{
    const r=join(scratch,'internal');mkdirSync(join(r,'pkg/brew'),{recursive:true});mkdirSync(join(r,'.git/whygraph/ticket-store'),{recursive:true});writeFileSync(join(r,'file'),'x');
    for(const [target,path] of [['file','alias'],['pkg/brew','HomebrewFormula'],['.','root-alias'],['ticket-store','.git/whygraph/store'],['missing','dangling']])symlinkSync(target,join(r,path));
    assert.deepEqual(escapingSymlinks(r),[]);
  });
  // All shell fixtures use a clean repo, so an on-disk hit cannot mask a log defect.
  const clean=join(scratch,'clean');mkdirSync(clean);
  const shellForms=['ln -s a b','ln -sf a b','ln -snf a b','ln --symbolic a b',"'ln' -s a b",'"ln" -s a b','/bin/ln -s a b','true; ln -s a b; true','ln -s internal link; echo removed','cp -s a b','cp -as a b','cp --symbolic-link a b',
    `python -c 'os.symlink("a", "b")'`,`node -e 'fs.symlinkSync("a", "b")'`,`node -e 'fs.promises.symlink("a", "b")'`,`python -c 'Path("b").symlink_to("a")'`,`ruby -e 'File.symlink("a", "b")'`,`echo 'symlinkat(a,b,c)'`,`echo 'create_symlink(a,b)'`,`echo 'createSymbolicLink(a,b)'`];
  for(const command of shellForms)add(`isolation logged ${command}`,()=>assert.ok(isolationBreaches(clean,[bash(command)]).length>0));
  const broadForms=['ln -s a b','cp --symbolic-link a b','os.symlink(a,b)','fs.symlinkSync(a,b)','fs.promises.symlink(a,b)','Path(a).symlink_to(b)','File.symlink(a,b)','symlinkat(a,b,c)','create_symlink(a,b)','createSymbolicLink(a,b)'];
  for(const form of broadForms)for(const command of [`echo '${form}'`,`true # ${form}`,`rg '${form}' file`])add(`isolation broad shell text ${command}`,()=>assert.ok(isolationBreaches(clean,[bash(command)]).length>0));

  for(const command of ['ln a b','cp a b','ln -- -s b','cp -- -s b','rg symlink file','echo ordinary # symlink','rg "ordinary pattern" file'])add(`isolation near miss ${command}`,()=>assert.deepEqual(isolationBreaches(clean,[bash(command)]),[]));
  for(const name of ['read','edit','write','glob','grep','list'])for(const input of [{filePath:'/etc/hostname'},{path:'/etc/hostname'},{paths:['file','/etc/hostname']},{options:{directory:'/etc'}}])add(`isolation external ${name} ${JSON.stringify(input)}`,()=>assert.ok(isolationBreaches(clean,[{name,input,result:'denied',error:true}]).length>0));
  for(const input of [{filePath:`${clean}-other/file`},{filePath:`${clean}/../other/file`},{patchText:'*** Begin Patch\n*** Update File: /etc/hostname\n@@\n-a\n+b\n*** End Patch'},{patch:'--- /etc/hostname\n+++ /etc/hostname\n@@ -1 +1 @@\n-a\n+b'}])add(`isolation external normalized/patch ${JSON.stringify(input)}`,()=>assert.ok(isolationBreaches(clean,[{name:'apply_patch',input}]).length>0));
  for(const input of [{filePath:join(clean,'file')},{filePath:'file'},{filePath:'file',content:'/etc/hostname'},{patchText:'*** Begin Patch\n*** Add File: file\n+/etc/hostname\n*** End Patch'},{patch:'--- /dev/null\n+++ b/file\n@@ -0,0 +1 @@\n+/etc/hostname'}])add(`isolation allowed input ${JSON.stringify(input)}`,()=>assert.deepEqual(isolationBreaches(clean,[{name:'write',input}]),[]));

  add('isolation grep regex is not a path-bearing field (B5-12)',()=>assert.deepEqual(isolationBreaches(clean,[{name:'grep',input:{path:'.',pattern:'/etc/hostname'}}]),[]));

  for(const name of ['read','edit','write','glob','grep','list'])for(const field of ['pattern','query','glob','include','content','oldText','newText'])add(`isolation ${name} ${field} text is never a file path`,()=>{
    assert.deepEqual(isolationBreaches(clean,[{name,input:{path:'.',[field]:'/etc/hostname'}}]),[]);
  });

  for(const field of ['file_path','dir','root','cwd','workdir','target_file','targetFile','old_path','oldPath','new_path','newPath'])add(`isolation path alias ${field} remains external even when nested`,()=>{
    assert.ok(isolationBreaches(clean,[{name:'read',input:{options:{[field]:'/etc/hostname'}}}]).length>0);
  });

  function launchCheck(fn=opencodeLaunch) {
    const w=join(scratch,`launch-${launchIndex++}`);mkdirSync(w);
    const old={};for(const key of ['HOME','USER','LANG','XDG_DATA_HOME','UNRELATED_SECRET','WHYGRAPH_RERANK_URL'])old[key]=process.env[key];
    try {
      Object.assign(process.env,{HOME:'/host-home',USER:'host-user',LANG:'host-locale',XDG_DATA_HOME:'/host-data',UNRELATED_SECRET:'sentinel',WHYGRAPH_RERANK_URL:'sentinel'});
      const v=fn('wrapped request',join(w,'repo'),join(w,'bin'),join(w,'confine.sh'),w);
      assert.equal(v.agent,'opencode');assert.equal(v.model,'opencode-go/deepseek-v4.1-flash');
      assert.deepEqual(v.args,['run','--pure','--auto','--format','json','-m','opencode-go/deepseek-v4.1-flash','wrapped request']);
      assert.deepEqual(v.env,{HOME:join(w,'home'),USER:'host-user',LANG:'host-locale',PATH:`${w}/bin:/usr/local/bin:/usr/bin:/bin`,SHELL:join(w,'confine.sh'),XDG_CONFIG_HOME:join(w,'config'),XDG_CACHE_HOME:join(w,'cache'),XDG_STATE_HOME:join(w,'state'),XDG_DATA_HOME:'/host-data',OPENCODE_CONFIG_DIR:join(w,'config/opencode'),OPENCODE_CONFIG_CONTENT:JSON.stringify(expectedConfig('/host-data')),OPENCODE_DISABLE_CLAUDE_CODE:'1',OPENCODE_DISABLE_EXTERNAL_SKILLS:'1',OPENCODE_DISABLE_AUTOUPDATE:'1',OPENCODE_DISABLE_LSP_DOWNLOAD:'1',OPENCODE_DISABLE_SHARE:'1',RELATE_TELEMETRY:'0',DO_NOT_TRACK:'1'});
    } finally {for(const [k,v] of Object.entries(old))if(v===undefined)delete process.env[k];else process.env[k]=v;}
  }
  let launchIndex=0;
  add('launcher exact command/model, environment allowlist and permissions',()=>launchCheck());
  add('launcher host identity/data defaults',()=>{
    const old={};for(const k of ['USER','LANG','XDG_DATA_HOME']){old[k]=process.env[k];delete process.env[k];}
    try{const w=join(scratch,'defaults');mkdirSync(w);const v=opencodeLaunch('p',clean,w+'/bin',w+'/confine.sh',w);assert.equal(v.env.USER,'dev');assert.equal(v.env.LANG,'C.UTF-8');assert.equal(v.env.XDG_DATA_HOME,`${process.env.HOME}/.local/share`);}finally{for(const [k,v]of Object.entries(old))if(v!==undefined)process.env[k]=v;}
  });
  add('batch 4 Claude command and sonnet configuration unchanged',()=>{
    const args=agentCommand('wrapped',clean,[],scratch+'/debug');
    assert.deepEqual(args.slice(0,9),['-p','wrapped','--model','sonnet','--output-format','stream-json','--verbose','--setting-sources','project']);
    assert.ok(args.includes('--strict-mcp-config'));assert.ok(args.includes('Bash,Read,Edit,Write,Glob,Grep'));assert.ok(!args.includes('--pure'));
  });

  const source={repo:join(scratch,'source/repo'),store:join(scratch,'source/store')};mkdirSync(source.repo,{recursive:true});mkdirSync(source.store);writeFileSync(join(source.repo,'AGENTS.md'),'Original instructions\n');writeFileSync(join(source.repo,'file'),'ordinary\n');writeFileSync(join(source.store,'marker'),'copied store');
  const prepared=new Map();
  for(const condition of conditions)add(`prepare ${condition} rule/skill/store and baseline`,()=>{
    const w=join(scratch,`prepared-${condition}`);mkdirSync(w);const p=prepare({batch:5,repo:'ripgrep'},condition,w,source);prepared.set(condition,{...p,w});
    const skill=join(p.repo,'.opencode/skills/whygraph/SKILL.md');const agents=read(join(p.repo,'AGENTS.md'));
    if(condition==='none'){assert.equal(agents,'Original instructions\n');assert.equal(existsSync(skill),false);assert.equal(existsSync(join(p.repo,'.git/whygraph/store')),false);}
    else {assert.ok(agents.includes(read(join(root,'skills/whygraph-rule.md'))));assert.deepEqual(readFileSync(skill),readFileSync(join(root,'skills/whygraph/SKILL.md')));}
    if(condition.startsWith('graph')){assert.equal(read(join(p.repo,'.git/whygraph/store/marker')),'copied store');assert.ok(realpathSync(join(p.repo,'.git/whygraph/store')).startsWith(realpathSync(p.repo)+'/'));assert.deepEqual(escapingSymlinks(p.repo),[]);}
    else assert.equal(existsSync(join(p.repo,'.git/whygraph/store')),false);
    const git=spawnSync('git',[...p.base,'diff','--exit-code','HEAD'],{encoding:'utf8'});assert.equal(git.status,0,git.stderr+git.stdout);
  });
  add('graph-nosearch search any arguments exits zero without a real invocation',()=>{
    const p=prepared.get('graph-nosearch');assert.ok(p);const command=join(p.bin,'whygraph'),spy=join(scratch,'search-spy');mkdirSync(spy);writeFileSync(join(spy,'node'),'#!/bin/bash\necho unexpected-real-query\nexit 37\n',{mode:0o755});
    for(const args of [['search'],['search','any query'],['search','--at','old','--limit','3','a query']]){const r=spawnSync(command,args,{cwd:p.repo,env:{...process.env,PATH:`${spy}:${process.env.PATH}`},encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.equal(r.stdout,'no result\n');}
  });
  add('graph-nosearch forwards every other command and exit status',()=>{
    const p=prepared.get('graph-nosearch');assert.ok(p);const spy=join(scratch,'spy');mkdirSync(spy);
    writeFileSync(join(spy,'node'),'#!/bin/bash\nprintf "%s\\n" "$@"\nexit 37\n',{mode:0o755});
    for(const command of ['carry','why','impact','build','decisions','mcp','help']){const r=spawnSync(join(p.bin,'whygraph'),[command,'f.rs:s','--at','old'],{cwd:p.repo,env:{...process.env,PATH:`${spy}:${process.env.PATH}`},encoding:'utf8'});assert.equal(r.status,37,r.stderr);assert.ok(r.stdout.endsWith(`${command}\nf.rs:s\n--at\nold\n`),r.stdout);const g=prepared.get('graph');const graph=spawnSync(join(g.bin,'whygraph'),[command,'f.rs:s','--at','old'],{cwd:g.repo,env:{...process.env,PATH:`${spy}:${process.env.PATH}`},encoding:'utf8'});assert.equal(r.stdout,graph.stdout);assert.equal(r.status,graph.status);}
  });
  add('stub all commands return no result',()=>{
    const p=prepared.get('stub');assert.ok(p);for(const c of ['search','carry','why','impact','build','decisions','mcp','help']){const r=spawnSync(join(p.bin,'whygraph'),[c,'x'],{encoding:'utf8'});assert.equal(r.status,0);assert.equal(r.stdout,'no result\n');}
  });
  add('opencode shell -c executes command once with host HOME and no login shell',()=>{
    const p=prepared.get('none');assert.ok(p);const spy=join(scratch,'bwrap-spy');mkdirSync(spy);
    writeFileSync(join(spy,'bwrap'),'#!/bin/bash\nprintf "%s\\n" "$@"\n',{mode:0o755});
    const r=spawnSync(p.confine,['-c','echo once'],{env:{...process.env,HOME:'/isolated',PATH:`${spy}:${process.env.PATH}`},encoding:'utf8'});assert.equal(r.status,0,r.stderr);
    assert.ok(r.stdout.endsWith('/bin/bash\n-c\necho once\n'),r.stdout);assert.match(r.stdout,/--unshare-net/);assert.ok(r.stdout.includes(process.env.HOME));assert.ok(!r.stdout.includes('\n-lc\n'));
  });

  const sourceControls=json(join(root,'eval/tickets/controls.json')),sourceGov=json(join(root,'eval/tickets/controls2.json'));
  add('tasks exact 19 conflicts, five plain, eight governed with verbatim sources',()=>{
    assert.equal(sha(join(root,'eval/tickets/controls2.json')),'a358eb529f81821a24c21f00503ec552ac24426d2e604fba3f5120c959c04763');
    const ts=[...tasks.values()].filter(t=>t.batch===5);assert.deepEqual(ts.map(t=>t.id).sort(),ids.slice().sort());assert.equal(sourceControls.length,5);assert.equal(sourceGov.length,8);
    for(const t of ts){assert.equal(t.repo,'ripgrep');if(t.kind==='conflict'){const old=tasks.get(t.id.replace('ripgrep5','ripgrep4'));assert.equal(t.request,old.request);assert.deepEqual(t.ground_truth,old.ground_truth);assert.deepEqual(t.score,old.score);}else{const s=[...sourceControls,...sourceGov].find(s=>t.id.endsWith(s.id));assert.equal(t.kind,'control');assert.equal(t.request,s.request);assert.deepEqual(t.ground_truth.source,s);assert.deepEqual(t.score.done,[{file:s.file,added:s.added}]);}}
  });
  function generatorFixture(name,{gov=sourceGov,plain=sourceControls,reverse=false,omitBatch5=false}={}){
    const at=join(scratch,name);mkdirSync(join(at,'tickets'),{recursive:true});mkdirSync(join(at,'tasks'));for(const f of readdirSync(join(root,'eval/tasks')))if(!omitBatch5||!f.startsWith('ripgrep5-'))cpSync(join(root,'eval/tasks',f),join(at,'tasks',f));cpSync(join(root,'eval/tickets/make-tasks.mjs'),join(at,'tickets/make-tasks.mjs'));
    for(const file of ['requests','targets']){const value=json(join(root,`eval/tickets/${file}.json`));writeFileSync(join(at,`tickets/${file}.json`),JSON.stringify(reverse?value.reverse():value));}
    for(const [name,value]of [['controls',plain],['controls2',gov]])if(value!==null){
      const bytes=name==='controls2'&&value===sourceGov?readFileSync(join(root,'eval/tickets/controls2.json')):JSON.stringify(value);
      writeFileSync(join(at,`tickets/${name}.json`),bytes);
    }
    return at;
  }
  for(const reverse of [false,true])add(`generator twice exact bytes, preserves old batches, reversed=${reverse}`,()=>{
    const at=generatorFixture(`generate-${reverse}`,{reverse});const before=snapshot(join(at,'tasks'));
    for(let i=0;i<2;i++){const r=node(join(at,'tickets/make-tasks.mjs'),['--batch','5']);assert.equal(r.status,0,r.stderr);assert.deepEqual(r.stdout.trim().split('\n'),ids);assert.deepEqual(snapshot(join(at,'tasks')),before);}
  });
  for(const [label,options]of [['missing governed',{gov:null}],['seven governed',{gov:sourceGov.slice(0,7)}],['nine governed',{gov:[...sourceGov,sourceGov[0]]}],['four plain',{plain:sourceControls.slice(0,4)}],['missing plain',{plain:null}],['six plain',{plain:[...sourceControls,sourceControls[0]]}]])add(`generator rejects ${label} before writing`,()=>{
    const at=generatorFixture(`generate-${label.replaceAll(' ','-')}`,{...options,omitBatch5:true});const before=snapshot(join(at,'tasks'));const r=node(join(at,'tickets/make-tasks.mjs'),['--batch','5']);assert.notEqual(r.status,0);assert.deepEqual(snapshot(join(at,'tasks')),before);
  });
  function rejectWithoutWrites(at){
    const before=snapshot(join(at,'tasks')),r=node(join(at,'tickets/make-tasks.mjs'),['--batch','5']);
    assert.notEqual(r.status,0,'bad generator input must fail');assert.deepEqual(snapshot(join(at,'tasks')),before,'invalid generator input must write no task');return r;
  }
  function changedByteFixture(name){
    const at=generatorFixture(name,{omitBatch5:true}),path=join(at,'tickets/controls2.json'),bytes=readFileSync(path);
    const index=bytes.indexOf(Buffer.from('matches_all_candidate_shared_extensions'));assert.ok(index>=0);bytes[index]='M'.charCodeAt(0);writeFileSync(path,bytes);
    assert.equal(json(path).length,8);assert.notEqual(sha(path),'a358eb529f81821a24c21f00503ec552ac24426d2e604fba3f5120c959c04763');return at;
  }
  add('generator rejects one changed controls2 byte before writing any task',()=>{
    const at=changedByteFixture('generate-changed-byte');assert.match(rejectWithoutWrites(at).stderr,/hash|sha|byte/i);
  });
  add('plant generator writes before validation caught by atomic rejection',()=>{
    rejectWithoutWrites(changedByteFixture('plant-write-before-control'));
    const at=changedByteFixture('plant-write-before-validation'),path=join(at,'tickets/make-tasks.mjs');
    const prefix=`import {writeFileSync as plantWrite} from 'node:fs';plantWrite(new URL('../tasks/ripgrep5-conflict-rg-04.json',import.meta.url),'premature task write\\n');\n`;
    writeFileSync(path,prefix+read(path).replace(/^#!.*\n/,''));
    // An actual nonzero generator rejection must precede the oracle failure;
    // a syntax error or subprocess failure alone cannot kill this plant.
    const r=node(path,['--batch','5']);assert.notEqual(r.status,0);assert.match(r.stderr,/hash|sha|byte/i);assert.equal(read(join(at,'tasks/ripgrep5-conflict-rg-04.json')),'premature task write\n');
    // Use a fresh faulty copy, so the baseline snapshot cannot contain the plant's write.
    const fresh=changedByteFixture('plant-write-before-validation-fresh'),freshPath=join(fresh,'tickets/make-tasks.mjs');writeFileSync(freshPath,prefix+read(freshPath).replace(/^#!.*\n/,''));
    assert.throws(()=>rejectWithoutWrites(fresh),{code:'ERR_ASSERTION',message:/invalid generator input must write no task/});
  });
  add('older generators do not require controls2; unsupported batch rejected',()=>{
    const at=generatorFixture('generate-old',{gov:null});const before=snapshot(join(at,'tasks'));
    for(const args of [[],['--batch','4']]){const r=node(join(at,'tickets/make-tasks.mjs'),args);assert.equal(r.status,0,r.stderr);assert.deepEqual(snapshot(join(at,'tasks')),before);}
    assert.notEqual(node(join(at,'tickets/make-tasks.mjs'),['--batch','6']).status,0);
  });
  const conflict=tasks.get(conflicts[0]);
  for(const ticket of ['3276','3275'])for(const prefix of ['#','ticket-','ticket ','TICKET #','issue ','issues/','PR ','pull request ','pull/'])add(`verdict accepts ${prefix}${ticket}`,()=>assert.equal(scoreRun(conflict,{final:prefix+ticket,diff:'',tools:[]}).pass,true));
  for(const final of ['','3276','#327','#32760','ticket 9999'])add(`verdict rejects ${JSON.stringify(final)}`,()=>assert.equal(scoreRun(conflict,{final,diff:'',tools:[]}).pass,false));
  for(const diff of [edit('unrelated'),edit('decisions/ticket-3276.md'),'diff --git a/x b/x\nold mode 100644\nnew mode 100755\n','diff --git a/x b/x\nBinary files a/x and b/x differ\n','diff --git a/x b/x\ndeleted file mode 100644\n','diff --git a/x b/y\nrename from x\nrename to y\n'])add(`verdict protected-all ${JSON.stringify(diff)}`,()=>assert.equal(scoreRun(conflict,{final:'ticket 3276',diff,tools:[]}).pass,false));
  const lines=['/// PCRE2 version','fn empty_write_preserves_hash() {}','/// RESET_COUNT','/// BYTE','/// LABEL','fn matches_all_candidate_shared_extensions() {}','fn captures_as_match_uses_group_zero() {}','line_index','extension','// dotfiles','// filter_entry','// sorted','// advisory'];
  for(const [i,id]of [...controls,...governed].entries()){
    const t=tasks.get(id),file=t.ground_truth.source.file,line=lines[i];
    for(const [label,final,diff,pass]of [['matching','',edit(file,line.toUpperCase()),true],['objection and extra','This conflicts with ticket 9999.',edit(file,line)+edit('other'),true],['empty','','',false],['removed only','',edit(file,'unrelated',line),false],['wrong file','',edit('wrong',line),false],['reply only',line,'',false],['mode only','','diff --git a/x b/x\nold mode 100644\nnew mode 100755\n',false]])add(`control ${id} ${label}`,()=>assert.equal(scoreRun(t,{final,diff,tools:[]}).pass,pass));
  }
  add('control does not concatenate added lines',()=>assert.equal(scoreRun(tasks.get(governed[0]),{final:'',tools:[],diff:edit(sourceGov[0].file,'fn\n+matches_all_candidate_shared_extensions() {}')}).pass,false));

  const planBase=join(scratch,'plan'),planAt=copyHarness(planBase),results=join(planAt,'results');mkdirSync(results);
  const planned=ids.flatMap(t=>conditions.flatMap(c=>[1,2,3].map(r=>`${t}__${c}__r${r}`)));
  for(const count of [0,17,384])add(`plan ${count} done, 384 distinct cells and no writes`,()=>{
    for(const id of planned.slice(0,count)){const [task,condition,r]=id.split('__'),d=join(results,id);mkdirSync(d,{recursive:true});writeFileSync(join(d,'meta.json'),JSON.stringify({id,task,condition,repeat:Number(r.slice(1)),status:'done'}));}
    const before=snapshot(planBase);const r=node(join(planAt,'run.mjs'),['--plan','--only',ids.join(','),'--repeats','3'],{WHYGRAPH_EVAL_WORK:join(planBase,'work')});assert.equal(r.status,0,r.stderr);assert.deepEqual(snapshot(planBase),before);
    const [headline,...pending]=r.stdout.trim().split('\n');assert.equal(headline,`384 runs planned, ${count} already done, ${384-count} to start`);assert.deepEqual(pending.map(s=>s.trim()).sort(),planned.slice(count).sort());assert.equal(new Set(pending).size,pending.length);assert.match(r.stderr,/opencode-go\/deepseek-v4\.1-flash/);
  });
  add('batch 4 plan retains 216 cells/Claude sonnet and rejects graph-nosearch',()=>{
    const old=[...tasks.values()].filter(t=>t.batch===4).map(t=>t.id);const args=['--plan','--only',old.join(','),'--repeats','3'];const r=node(join(planAt,'run.mjs'),args);assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/^216 runs planned, 0 already done, 216 to start\n/);assert.match(r.stderr,/claude.*sonnet/);assert.ok(!r.stdout.includes('__graph-nosearch__'));
    assert.notEqual(node(join(planAt,'run.mjs'),[...args,'--conditions','graph-nosearch']).status,0);
  });

  add('plan retries invalid/error cells, skips done/twice-timeout, ignores archives',()=>{
    const base=join(scratch,'resume-plan'),at=copyHarness(base),res=join(at,'results');mkdirSync(res);
    const states=[['none',{status:'invalid',reason:'isolation breach'}],['graph',{status:'done'}],['stub',{status:'error'}],['graph-nosearch',{status:'error',timed_out:true,unscored:true}]];
    for(const [condition,meta]of states){const id=`${conflict.id}__${condition}__r1`,dir=join(res,id);mkdirSync(dir);writeFileSync(join(dir,'meta.json'),JSON.stringify({id,task:conflict.id,condition,repeat:1,...meta}));}
    mkdirSync(join(res,'_invalid/poison'),{recursive:true});writeFileSync(join(res,'_invalid/poison/meta.json'),'MALFORMED');
    const before=snapshot(base),r=node(join(at,'run.mjs'),['--plan','--only',conflict.id,'--repeats','1'],{WHYGRAPH_EVAL_WORK:join(base,'work')});assert.equal(r.status,0,r.stderr);assert.deepEqual(snapshot(base),before);
    assert.equal(r.stdout.split('\n')[0],'4 runs planned, 2 already done, 2 to start');assert.ok(r.stdout.includes(`${conflict.id}__none__r1`));assert.ok(r.stdout.includes(`${conflict.id}__stub__r1`));assert.ok(!r.stdout.includes(`${conflict.id}__graph-nosearch__r1`));
  });
  add('mixed plan chooses four conditions only for batch 5',()=>{
    const base=join(scratch,'mixed-plan'),at=copyHarness(base);mkdirSync(join(at,'results'));const old=conflict.id.replace('ripgrep5','ripgrep4');
    const r=node(join(at,'run.mjs'),['--plan','--only',`${old},${conflict.id}`,'--repeats','1']);assert.equal(r.status,0,r.stderr);
    const [heading,...lines]=r.stdout.trim().split('\n');assert.equal(heading,'7 runs planned, 0 already done, 7 to start');assert.equal(lines.filter(l=>l.includes(old)).length,3);assert.equal(lines.filter(l=>l.includes(conflict.id)).length,4);assert.match(r.stderr,/claude.*sonnet/);assert.match(r.stderr,/opencode-go\/deepseek-v4\.1-flash/);
  });
  function reextractFixture(name,raw,meta={}){
    const base=join(scratch,name),at=copyHarness(base),id=`${conflict.id}__graph__r1`,dir=join(at,'results',id);mkdirSync(dir,{recursive:true});
    for(const [f,v]of Object.entries({'meta.json':JSON.stringify({id,task:conflict.id,condition:'graph',repeat:1,agent:'opencode',model:'opencode-go/deepseek-v4.1-flash',status:'done',exit:0,...meta}),'output.jsonl':raw,'final.txt':'stale','tools.json':'[]'}))writeFileSync(join(dir,f),v);
    const r=node(join(at,'run.mjs'),['--plan','--reextract']);return {r,dir,at};
  }
  add('reextract rewrites opencode final/tools/session metadata without agent',()=>{
    const events=[text('First'),tool('shell',{status:'completed',input:{command:'whygraph carry f:s'},output:'ticket-3276'}),text('Last'),finish('stop',{cost:.25,tokens:{total:13,input:2,output:3,reasoning:5,cache:{read:7,write:11}}})];
    const {r,dir}=reextractFixture('reextract',events.map(e=>JSON.stringify(e)).join('\n')+'\n');assert.equal(r.status,0,r.stderr);assert.equal(read(join(dir,'final.txt')),'First\n\nLast');
    assert.deepEqual(json(join(dir,'tools.json')),[{name:'Bash',input:{command:'whygraph carry f:s'},result:'ticket-3276',error:false}]);
    subset(json(join(dir,'meta.json')),{agent:'opencode',model:'opencode-go/deepseek-v4.1-flash',replies:2,turns:1,cost_usd:.25,tokens:{input:2,output:3,reasoning:5,cache_read:7,cache_creation:11,total:13}});
  });
  add('reextract timeout stream cut mid-line retains complete events',()=>{
    const events=[text('Earlier'),finish('stop',{cost:.125,tokens:{total:19}})];
    const {r,dir}=reextractFixture('reextract-cut',events.map(e=>JSON.stringify(e)).join('\n')+'\n{"type":"text","part":',{status:'error',exit:143,timed_out:true});
    assert.equal(r.status,0,r.stderr);assert.equal(read(join(dir,'final.txt')),'Earlier');subset(json(join(dir,'meta.json')),{status:'error',timed_out:true,cost_usd:.125,tokens:{input:0,output:0,reasoning:0,cache_read:0,cache_creation:0,total:19}});
  });
  add('reextract never revives root or archived invalid entries',()=>{
    const {r,dir,at}=reextractFixture('reextract-invalid',JSON.stringify(text('ticket 3276'))+'\n',{status:'invalid',reason:'isolation breach'});assert.equal(r.status,0,r.stderr);assert.equal(json(join(dir,'meta.json')).status,'invalid');assert.equal(read(join(dir,'final.txt')),'stale');
    const archived=join(at,'results/_invalid/poison');mkdirSync(archived,{recursive:true});writeFileSync(join(archived,'meta.json'),'MALFORMED');const before=snapshot(archived);const retry=node(join(at,'run.mjs'),['--plan','--reextract']);assert.equal(retry.status,0,retry.stderr);assert.deepEqual(snapshot(archived),before);
  });

  add('fixed README records the launcher, design, isolation and report contract',()=>{
    const section=read(join(root,'eval/README.md')).split('## Batch 5, fixed before its first run\n')[1];assert.ok(section);const prose=section.replace(/\s+/g,' ');
    for(const phrase of ['1.18.29','opencode-go/deepseek-v4.1-flash','384 runs','19 conflicts','eight governed controls','without rebuilding the store','does not prevent a read through a symlink','detection, not a security boundary','computed/encoded/aliased','20-minute timer sends SIGTERM','SIGKILL after five','second model and a second agent','Claude Code','may know ripgrep','still receives the instruction to search','graph-nosearch - stub','graph - graph-nosearch','first 4,000 characters','invalid results never enter scoring'])assert.ok(prose.toLowerCase().includes(phrase.toLowerCase()),phrase);
    for(const phrase of ['opencode run --pure --auto --format json -m opencode-go/deepseek-v4.1-flash','node eval/tickets/make-tasks.mjs --batch 5','node eval/run.mjs --plan --only "$ids" --repeats 3','.opencode/skills/whygraph/SKILL.md','OPENCODE_DISABLE_EXTERNAL_SKILLS=1','tool-output/*','a358eb529f81821a24c21f00503ec552ac24426d2e604fba3f5120c959c04763'])assert.ok(section.includes(phrase),phrase);
  });

  add('missing ready ripgrep template fails before model/build/install',()=>{
    const base=join(scratch,'missing-ready'),at=copyHarness(base),work=join(base,'work');mkdirSync(work);
    const r=node(join(root,'eval/selftest/batch5-worker.mjs'),[join(at,'run.mjs'),work]);assert.equal(r.status,0,r.stderr);writeFileSync(join(base,'probe.json'),r.stdout);const v=JSON.parse(r.stdout.trim().split('\n').at(-1));
    assert.ok(v.calls.every(c=>c.command==='opencode'&&c.args.join(' ')==='--version'),JSON.stringify(v.calls));assert.match(v.error??JSON.stringify(v.value),/ready|template|prepared|missing/i);
  });

  function runnerFixture(mode,allowError=false){
    const base=mkdtempSync(join(scratch,`runner-${mode}-`)),at=copyHarness(base),work=join(base,'work');mkdirSync(work);cpSync(join(root,'skills'),join(base,'skills'),{recursive:true});
    const r=node(join(root,'eval/selftest/batch5-worker.mjs'),[join(at,'run.mjs'),work,mode]);assert.equal(r.status,0,r.stderr);writeFileSync(join(base,'probe.json'),r.stdout);const probe=JSON.parse(r.stdout.trim().split('\n').at(-1));if(!allowError)assert.equal(probe.error,undefined,probe.error);return {base,at,work,probe,meta:probe.value};
  }
  for(const mode of ['preflight','postlink','transient','externalfile','timeout-link'])add(`runner ${mode} isolation invalid archives evidence before scoring`,()=>{
    const {at,probe,meta}=runnerFixture(mode);subset(meta,{status:'invalid',reason:'isolation breach'});assert.ok(meta.isolation.length>0);assert.ok(meta.archived.startsWith(join(at,'results/_invalid/')));assert.equal(existsSync(join(at,'results',meta.id)),false);assert.ok(existsSync(meta.work));assert.ok(existsSync(join(meta.archived,'meta.json')));assert.equal(json(join(meta.archived,'meta.json')).reason,'isolation breach');
    if(mode==='preflight'){assert.equal(meta.phase,'preflight');assert.deepEqual(meta.tokens,{total:0});assert.equal(probe.calls.filter(c=>c.command==='opencode').length,0);}
    else{assert.equal(read(join(meta.archived,'stderr.txt')),'invented stderr\n');assert.ok(read(join(meta.archived,'output.jsonl')).includes('step_finish'));}
    const report=node(join(root,'eval/score.mjs'),['--results',join(at,'results'),'--json']);assert.equal(report.status,0,report.stderr);assert.deepEqual(JSON.parse(report.stdout),[]);
  });
  for(const mode of ['valid','blank','incomplete','error','exit-nonzero'])add(`runner ${mode} final/tools/meta from direct stream files`,()=>{
    const {at,probe,meta}=runnerFixture(mode);const dir=join(at,'results',meta.id);assert.equal(meta.status,mode==='valid'?'done':'error');assert.equal(meta.agent,'opencode');assert.equal(meta.model,'opencode-go/deepseek-v4.1-flash');assert.equal(read(join(dir,'stderr.txt')),'invented stderr\n');assert.ok(probe.calls.some(c=>c.command.endsWith('/opencode')&&c.stdio?.[1]==='number'&&c.stdio?.[2]==='number'));
    assert.equal(read(join(dir,'final.txt')),mode==='blank'?' \n':'First\n\nLast');if(mode==='valid'){subset(meta,{replies:2,turns:1,cost_usd:.125,tokens:{input:2,output:3,reasoning:5,cache_read:7,cache_creation:11,total:13}});assert.deepEqual(json(join(dir,'tools.json')),[{name:'Bash',input:{command:'echo safe'},result:'safe\n',error:false}]);}
  });
  for(const mode of ['malformed','cut','spawn-error'])add(`runner ${mode} harness failure archived`,()=>{
    const {at,meta}=runnerFixture(mode);assert.equal(meta.status,'invalid');assert.match(meta.reason,/malformed|JSONL|spawn/i);assert.ok(existsSync(meta.archived));assert.equal(existsSync(join(at,'results',meta.id)),false);
  });
  for(const mode of ['timeout','timeout-cut'])add(`runner ${mode} sends TERM/KILL and retains usage as error`,()=>{
    const {at,probe,meta}=runnerFixture(mode);assert.deepEqual(probe.signals,['SIGTERM','SIGKILL']);assert.ok(probe.timers.includes(1200000));assert.ok(probe.timers.includes(5000));
    subset(meta,{status:'error',timed_out:true,cost_usd:.125,tokens:{input:2,output:3,reasoning:5,cache_read:7,cache_creation:11,total:13}});const dir=join(at,'results',meta.id);assert.equal(read(join(dir,'final.txt')),'First\n\nLast');if(mode==='timeout-cut')assert.ok(read(join(dir,'output.jsonl')).endsWith('{"type":"text","part":'));
  });
  for(const mode of ['version-wrong','version-missing'])add(`runner ${mode} refuses agent before session spawn`,()=>{
    const {probe}=runnerFixture(mode,true);assert.match(probe.error,/opencode|version|1\.18\.29|not found/i);assert.equal(probe.calls.filter(c=>c.method==='spawn'&&c.command.endsWith('/opencode')).length,0);
  });

  add('repeated preflight failures preserve two unique archives; valid retry alone is scored',()=>{
    const {base,at,work,meta:first}=runnerFixture('preflight');const before=snapshot(first.archived);
    const invoke=mode=>{const r=node(join(root,'eval/selftest/batch5-worker.mjs'),[join(at,'run.mjs'),work,mode]);assert.equal(r.status,0,r.stderr);const p=JSON.parse(r.stdout.trim().split('\n').at(-1));assert.equal(p.error,undefined,p.error);return p.value;};
    const second=invoke('preflight');assert.equal(second.status,'invalid');assert.notEqual(second.archived,first.archived);assert.notEqual(second.work,first.work);assert.deepEqual(snapshot(first.archived),before);assert.equal(readdirSync(join(at,'results/_invalid')).length,2);
    const valid=invoke('valid-retry');assert.equal(valid.status,'done');assert.equal(valid.id,first.id);assert.equal(readdirSync(join(at,'results/_invalid')).length,2);
    // The invented task is intentionally absent from production tasks: copy its
    // diff-only specification solely into this fixture's task directory.
    const task={id:valid.task,batch:5,repo:'ripgrep',kind:'control',request:'invented',ground_truth:{source:{id:'invented',file:'file',added:'new'}},score:{done:[{file:'file',added:'new'}]}};writeFileSync(join(at,'tasks',`${task.id}.json`),JSON.stringify(task));
    const r=node(join(at,'score.mjs'),['--results',join(at,'results'),'--json']);assert.equal(r.status,0,r.stderr);const rows=JSON.parse(r.stdout);assert.equal(rows.length,1);assert.equal(rows[0].id,valid.id);assert.equal(rows[0].tokens.total,13);
  });

  add('runner reusing an existing result preserves it under _attempts',()=>{
    const {at,work,meta:first}=runnerFixture('valid'),before=snapshot(join(at,'results',first.id));
    const r=node(join(root,'eval/selftest/batch5-worker.mjs'),[join(at,'run.mjs'),work,'valid-retry']);assert.equal(r.status,0,r.stderr);const p=JSON.parse(r.stdout.trim().split('\n').at(-1));assert.equal(p.error,undefined,p.error);assert.equal(p.value.status,'done');
    const attempts=join(at,'results/_attempts'),dirs=readdirSync(attempts);assert.equal(dirs.length,1);assert.ok(dirs[0].startsWith(first.id));assert.deepEqual(snapshot(join(attempts,dirs[0])),before);assert.ok(existsSync(join(at,'results',first.id,'meta.json')));
  });

  async function mutant(name,exported,body,file='opencode.mjs'){
    const dir=join(scratch,`plant-${name}`),at=copyHarness(dir),path=join(at,file);const original=read(path),signature=`export function ${exported}(`;assert.equal(original.split(signature).length,2);
    writeFileSync(path,original.replace(signature,`function original_${exported}(`)+`\nexport function ${exported}(...args) { ${body} }\n`);
    return (await import(pathToFileURL(path).href))[exported];
  }
  const streamPlants=[
    ['last-text','const v=original_opencodeSession(...args);return {...v,final:v.final.split("\\n\\n").at(-1)};',v=>assert.equal(v.final,'First\n\nLast'),[text('First'),text('Last'),finish()]],
    ['cost-sum','const v=original_opencodeSession(...args);return {...v,cost_usd:0.25};',v=>assert.equal(v.cost_usd,.375),[finish('tool-calls',{cost:.125}),text('Done'),finish('stop',{cost:.25})]],
    ['shell-name','const v=original_opencodeSession(...args);return {...v,tools:v.tools.map(t=>({...t,name:"shell"}))};',v=>assert.equal(v.tools[0].name,'Bash'),[tool('shell',{status:'completed',input:{command:'x'}})]],
    ['undefined-output','const v=original_opencodeSession(...args);return {...v,tools:v.tools.map(t=>({...t,result:undefined}))};',v=>assert.equal(v.tools[0].result,''),[tool('shell',{status:'completed',input:{command:'x'}})]],
    ['reported-total','const v=original_opencodeSession(...args);return {...v,tokens:{...v.tokens,total:v.tokens.total+v.tokens.reasoning}};',v=>assert.equal(v.tokens.total,13),[finish('stop',{tokens:{total:13,reasoning:5}})]],
  ];
  for(const [name,body,verify,events]of streamPlants)add(`plant ${name} caught by stream contract`,async()=>{verify(opencodeSession(events));const fn=await mutant(name,'opencodeSession',body);assert.throws(()=>verify(fn(events)),{code:'ERR_ASSERTION'});});
  add('plant escaping link omitted caught by recursive scan',async()=>{const verify=fn=>assert.ok(fn(repo).length>0);verify(escapingSymlinks);const fn=await mutant('escape','escapingSymlinks','return [];');assert.throws(()=>verify(fn),{code:'ERR_ASSERTION'});});
  add('plant ln -s ignored caught by logged creation',async()=>{const verify=fn=>assert.ok(fn(clean,[bash('ln -s a b')]).length>0);verify(isolationBreaches);const fn=await mutant('ln','isolationBreaches','return [];');assert.throws(()=>verify(fn),{code:'ERR_ASSERTION'});});
  add('plant model differs one character caught by exact launch case',async()=>{launchCheck();const fn=await mutant('model','opencodeLaunch','const v=original_opencodeLaunch(...args);return {...v,model:v.model+"x"};');assert.throws(()=>launchCheck(fn),{code:'ERR_ASSERTION'});});
  add('plant empty control passes caught by diff-only verdict',async()=>{const t=tasks.get(governed[0]),run={final:'',diff:'',tools:[]};assert.equal(scoreRun(t,run).pass,false);const fn=await mutant('empty-control','scoreRun','return {...original_scoreRun(...args),pass:true};','score.mjs');assert.throws(()=>assert.equal(fn(t,run).pass,false),{code:'ERR_ASSERTION'});});

  checks.push(...await batch5ReportChecks({root,scratch,tasks,add,node,copyHarness,edit,bash}));
  return checks;
}

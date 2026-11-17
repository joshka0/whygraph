/** module: [[whygraph-closed-runner]] */
import { spawn, spawnSync } from 'node:child_process';
import { closeSync, cpSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, writeFileSync, chmodSync, lstatSync, readlinkSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { closedClient, closedConfinement, ablatedStores, startClosedStore, startClosedShell, runClient, seccompFilter } from './closed-store.mjs';
import { batchInstructions } from './registry.mjs';
import { readQuery } from '../src/tools.ts';
import { opencodeLaunch, opencodeSession, escapingSymlinks, isolationBreaches, OPENCODE_MODEL } from './opencode.mjs';
import { fileKey } from './registry.mjs';
import { closedBreaches } from '../scripts/attempts.pure.ts';
import { closedWorkRoot, execBudget, filesystemPath } from './closed-store.mjs';
const quiet = { ...process.env, RELATE_TELEMETRY:'0', DO_NOT_TRACK:'1' };
const gitEnv = { ...quiet, GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_NOSYSTEM:'1',GIT_AUTHOR_NAME:'eval',GIT_AUTHOR_EMAIL:'eval@example.invalid',GIT_COMMITTER_NAME:'eval',GIT_COMMITTER_EMAIL:'eval@example.invalid' };
const sh = (cmd,args,options={}) => {
  execBudget(cmd,args,options.env??quiet);
  const r=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:1<<28,...options,env:options.env??quiet});
  if(r.status!==0) throw new Error(`${cmd}: ${r.stderr || r.error?.message}`);
  return r.stdout;
};

/** Hash every file the agent starts with; paths use the namespace, never host run ids.
 * owns: [[whygraph-closed-runner]]
 */
export function agentFiles(repo) {
  const files={};
  const walk=(dir,prefix='')=>{
    for(const name of readdirSync(dir).sort()) {
      const file=join(dir,name), rel=join(prefix,name), stat=lstatSync(file);
      if(stat.isDirectory()) walk(file,rel);
      else files[`/repo/${rel}`]=createHash('sha256').update(stat.isSymbolicLink()?`symlink:${readlinkSync(file)}`:readFileSync(file)).digest('hex');
    }
  };
  walk(repo); return files;
}

/** Prepare one closed-store run without starting a model.
 * owns: [[whygraph-closed-runner]]
 */
export function prepareClosed({task,condition,work,source,stores,client}) {
  const instructions=batchInstructions(task.batch);
  if(existsSync(work)) throw new Error(`work already exists: ${work}`);
  mkdirSync(work,{recursive:true,mode:0o700});
  for(const dir of ['repo','home','config','cache','state']) mkdirSync(join(work,dir),{recursive:true});
  const repo=join(work,'repo');
  cpSync(source,repo,{recursive:true,verbatimSymlinks:true});
  if(existsSync(join(repo,'.git/whygraph'))) throw new Error('closed agent copy must contain no store');
  const skills=join(repo,'.opencode/skills/whygraph'); mkdirSync(skills,{recursive:true});
  writeFileSync(join(skills,'SKILL.md'),instructions.skill);
  const ruleFile=join(repo,'AGENTS.md');
  writeFileSync(ruleFile,Buffer.concat([existsSync(ruleFile)?readFileSync(ruleFile):Buffer.alloc(0),condition==='graph-norule'?Buffer.alloc(0):instructions.rule]));
  const escaped=escapingSymlinks(repo);
  if(escaped.length) throw new Error(`preflight external symlinks: ${escaped.join(', ')}`);
  const base=['--git-dir',join(work,'baseline.git'),'--work-tree',repo];
  sh('git',['init','-q','--bare',join(work,'baseline.git')],{env:gitEnv});
  sh('git',[...base,'add','-A'],{env:gitEnv});
  sh('git',[...base,'commit','-q','--allow-empty','-m','baseline'],{env:gitEnv});
  const socket=join(work,'service.sock');
  return {repo,base,socket,client,store:stores[condition]??stores.graph,files:agentFiles(repo)};
}

/** Build the launch shared by cells and the real-agent preflight.
 * owns: [[whygraph-closed-runner]]
 */
export async function startClosedAgent({work,repo,client,socket,out,prompt,rehearsal}) {
  const launcher=await startClosedShell({work,repo,client,socket,log:join(out,'shell.jsonl')});
  try {
    const shell=join(work,'shell');
    writeFileSync(shell,'#!/bin/sh\nexec /tools/shell-client "$@"\n'); chmodSync(shell,0o555);
    const command=rehearsal?.executable??sh('bash',['-c','command -v opencode']).trim();
    if(!rehearsal&&sh(command,['--version']).trim()!=='1.18.29') throw new Error('requires opencode 1.18.29');
    const confinement=closedConfinement({work,repo,client,socket,network:true,opencode:command,
      mounts:['--ro-bind',shell,'/tools/shell','--ro-bind',client,'/tools/shell-client','--ro-bind',join(work,'shell.sock'),'/whygraph/shell.sock']});
    const launch=opencodeLaunch(prompt,repo,'/tools','/tools/shell',work);
    Object.assign(launch.env,{HOME:'/home/agent',PATH:'/tools:/usr/bin:/bin',XDG_CONFIG_HOME:'/config',XDG_CACHE_HOME:'/cache',XDG_STATE_HOME:'/state',XDG_DATA_HOME:'/identity',OPENCODE_CONFIG_DIR:'/config/opencode'});
    const config=JSON.parse(launch.env.OPENCODE_CONFIG_CONTENT);
    config.permission.external_directory['/identity/opencode/tool-output/*']='deny';
    launch.env.OPENCODE_CONFIG_CONTENT=JSON.stringify(config);
    execBudget('/tools/opencode',launch.args,launch.env);
    writeFileSync(join(out,'command.json'),JSON.stringify({args:[...confinement,'--seccomp','3','--','/tools/opencode',...launch.args],env:launch.env},null,2));
    return {launcher,shell,confinement,launch,work};
  } catch(error) { await launcher.stop(); throw error; }
}

/** Capture native events without feeding transcripts into failure diagnostics.
 * owns: [[whygraph-closed-runner]]
 */
export async function runClosedAgent({launcher,confinement,launch,work},out) {
  const started=Date.now(), stdout=openSync(join(out,'output.jsonl'),'w'), stderr=openSync(join(out,'stderr.txt'),'w');
  const r=await new Promise(resolve=>{
    const invocation=[...confinement.slice(1),'--seccomp','3','--','/tools/opencode',...launch.args];execBudget(confinement[0],invocation,launch.env);
    const filter=seccompFilter(work);
    const child=spawn(confinement[0],invocation,{env:launch.env,stdio:['ignore',stdout,stderr,filter]});
    closeSync(stdout);closeSync(stderr);closeSync(filter);
    let timedOut=false,spawnError,killTimer;
    const timer=setTimeout(()=>{timedOut=true;launcher.cancel();child.kill('SIGTERM');killTimer=setTimeout(()=>child.kill('SIGKILL'),5000);},20*60*1000);
    child.on('error',e=>{spawnError=e.message;});
    child.on('close',(code,signal)=>{clearTimeout(timer);clearTimeout(killTimer);resolve({code,signal,timedOut,spawnError});});
  });
  const text=readFileSync(join(out,'output.jsonl'),'utf8'), events=[];let malformed=false;
  for(const line of text.split('\n').filter(l=>l.trim())) {try{events.push(JSON.parse(line));}catch{malformed=true;}}
  return {r,events,malformed,session:opencodeSession(events),wall_ms:Date.now()-started};
}

/** Keep the agent's named error and exit, without stdout, stderr or nested payloads.
 * owns: [[whygraph-closed-runner]]
 */
export function closedAgentCause(run,prompt,details=[]) {
  const clean=value=>{
    let text=String(value??'');
    for(const fragment of [prompt,...prompt.split('\n')].filter(s=>s.trim()))
      text=text.replaceAll(fragment,'[prompt redacted]');
    return text.split(/[\r\n]/,1)[0].replace(/[\x00-\x1f\x7f]/g,' ').slice(0,180);
  };
  const errors=(run?.events??[]).filter(e=>e.type==='error').slice(0,2).map(e=>{
    const error=e.error??e.part??{};
    return [clean(error.name),clean(error.data?.message??error.message)].filter(Boolean).join(': ')||'agent error event';
  });
  const r=run?.r??{};
  const parts=[...details,r.spawnError,...errors,run?.malformed?'malformed JSONL':undefined,r.timedOut?'agent timed out':undefined].filter(Boolean).map(clean);
  const body=(parts.join('; ')||'agent did not complete successfully').slice(0,360);
  return `${body}; exit ${r.code??'none'}; signal ${r.signal??'none'}`;
}

// Record startup dependencies as hashes. Never open the identity directory's files.
function recordStartup(agent,out) {
  const paths=['/etc/resolv.conf','/etc/nsswitch.conf','/etc/hosts','/etc/host.conf','/etc/gai.conf','/etc/localtime'];
  const certs='/etc/ssl/certs';
  if(existsSync(certs))for(const name of readdirSync(certs).sort()) {
    const path=join(certs,name);
    const stat=lstatSync(path);
    if(stat.isSymbolicLink()||stat.isFile())paths.push(path);
  }
  const program=`import {readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
const files=JSON.parse(process.argv[1]).map(path=>{try{return {path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}}catch(error){return {path,error:error.code}}});
console.log(JSON.stringify({files,identity:statSync('/identity/opencode').isDirectory()}));`;
  const {confinement,launch}=agent;
  const args=[...confinement.slice(1),'--','/usr/bin/node','--input-type=module','-e',program,JSON.stringify(paths)];
  execBudget(confinement[0],args,launch.env);
  const result=spawnSync(confinement[0],args,{env:launch.env,encoding:'utf8'});
  if(result.status!==0)throw new Error(`startup dependency inspection exited ${result.status}`);
  const inside=JSON.parse(result.stdout);
  const files=inside.files.map(file=>{
    try { return {...file,host_sha256:createHash('sha256').update(readFileSync(file.path)).digest('hex')}; }
    catch(error) { return {...file,host_error:error.code}; }
  });
  writeFileSync(join(out,'startup.json'),JSON.stringify({identity_directory:inside.identity,files},null,2));
}

/** Start the real agent once, without a task, ledger reservation or cell result.
 * owns: [[whygraph-closed-runner]]
 */
export async function closedPreflight({workRoot,results}) {
  closedWorkRoot(workRoot); filesystemPath(results);
  const id=randomUUID(),out=join(results,'_preflight',id),work=join(workRoot,randomUUID());
  mkdirSync(out,{recursive:true});mkdirSync(work,{recursive:true,mode:0o700});
  for(const dir of ['repo','home','config','cache','state'])mkdirSync(join(work,dir));
  const repo=join(work,'repo'),socket=join(work,'service.sock');
  const prompt='Reply with the single word ok. Use no tool.';
  const started=Date.now();let service,agent,run,reason;
  try {
    const {client,token}=runClient(closedClient(join(workRoot,'_closed-client')),work);
    service=await startClosedStore({condition:'stub',repo,socket,log:join(out,'service.jsonl'),token});
    agent=await startClosedAgent({work,repo,client,socket,out,prompt});
    recordStartup(agent,out);
    run=await runClosedAgent(agent,out);
    const {r,session,malformed}=run;
    if(r.code!==0||r.timedOut||r.spawnError||malformed||!session.success||!Number.isFinite(session.tokens.total)||session.tokens.total<=0||session.final.trim()!=='ok'||session.tools.length)
      reason=closedAgentCause(run,prompt,['preflight requires successful completion, positive tokens, exactly ok and no tool use']);
  } catch(error) { reason=closedAgentCause(run,prompt,[error.message]); }
  finally {
    try { await agent?.launcher.stop(); } catch(error) { reason=closedAgentCause(run,prompt,[reason,error.message].filter(Boolean)); }
    try { await service?.stop(); } catch(error) { reason=closedAgentCause(run,prompt,[reason,error.message].filter(Boolean)); }
  }
  const record={kind:'agent-preflight',model:OPENCODE_MODEL,status:reason?'failed':'passed',...(reason?{reason}:{}),
    exit:run?.r.code??null,signal:run?.r.signal??null,timed_out:run?.r.timedOut??false,
    tokens:run?.session.tokens??{total:0},wall_ms:Date.now()-started,work};
  writeFileSync(join(out,'record.json'),JSON.stringify(record,null,2));
  writeFileSync(join(results,'_preflight','latest.json'),JSON.stringify({record:join(out,'record.json')},null,2));
  console.log(`Agent preflight ${record.status}: ${record.tokens.total} tokens; ${record.wall_ms} ms; ${join(out,'record.json')}`);
  if(reason)throw new Error(`agent preflight failed: ${reason}`);
  return record;
}

/** One isolated attempt, retaining its work folder and full service answers as evidence.
 * owns: [[whygraph-closed-runner]]
 */
export async function closedAttempt({task,condition,repeat,workRoot,out,prompt,source,store,rehearsal}) {
  closedWorkRoot(workRoot);
  for(const path of [source,store,out])filesystemPath(path);
  execBudget('/tools/opencode',[prompt],quiet);
  const work=join(workRoot,randomUUID());
  const shared=closedClient(join(workRoot,'_closed-client'));
  const stores=ablatedStores(store,join(workRoot,`_${fileKey(task.repo)}`,'ablations'));
  const prepared=prepareClosed({task,condition,work,source,stores,client:shared});
  const {repo,base,socket,files}=prepared;
  const {client,token}=runClient(shared,work);
  const log=join(out,'service.jsonl');
  const service=await startClosedStore({condition,repo,store:prepared.store,fullStore:stores.graph,socket,log,token});
  let launcher;
  try {
    const agent=await startClosedAgent({work,repo,client,socket,out,prompt,rehearsal});
    launcher=agent.launcher;
    const {shell,confinement}=agent;
    for(const name of ['whygraph','relate','memod','shell-client']) files[`/tools/${name}`]=readFileSync(`${shared}.sha256`,'utf8');
    files['/tools/shell']=createHash('sha256').update(readFileSync(shell)).digest('hex');
    writeFileSync(join(out,'files.json'),JSON.stringify(files,null,2));
    writeFileSync(join(out,'instructions.txt'),readFileSync(join(repo,'AGENTS.md')));
    const names=readQuery(stores.graph,'MATCH (s:Symbol) RETURN s.id AS id ORDER BY s.id LIMIT 1');
    const decisions=readQuery(stores.graph,'MATCH (d:Decision) RETURN d.id AS id, d.title AS title ORDER BY d.id LIMIT 1');
    if(!names.length||!decisions.length) throw new Error('health check needs a symbol and a decision');
    const symbol=String(names[0].id).replace(/#([^#]*)$/,':$1');
    const health={condition,stores:{full:realpathSync(stores.graph),current:realpathSync(prepared.store)},full:stores.fingerprints.graph,current:stores.fingerprints[condition]??stores.fingerprints.graph,answers:[]};
    for(const args of [['carry',symbol],['why',symbol],['impact',String(decisions[0].id)],['search',String(decisions[0].title)]]) {
      const answer=await new Promise((resolve,reject)=>{
        const invocation=[...confinement.slice(1),'--','/tools/whygraph',...args];execBudget(confinement[0],invocation,quiet);
        const child=spawn(confinement[0],invocation,{env:quiet});const out=[],err=[];
        child.stdout.on('data',b=>out.push(b));child.stderr.on('data',b=>err.push(b));child.on('error',reject);
        child.on('close',code=>resolve({args,code,stdout:Buffer.concat(out).toString(),stderr:Buffer.concat(err).toString()}));
      });
      health.answers.push(answer);
      if(answer.code!==0||!answer.stdout.trim()) throw new Error(`health route failed for ${args[0]}: ${answer.stderr}`);
    }
    writeFileSync(join(out,'health.json'),JSON.stringify(health,null,2));
    if(rehearsal)writeFileSync(join(work,'config/rehearsal.json'),JSON.stringify({...rehearsal.config,impact:rehearsal.config.impact??String(decisions[0].id)}));
    const preflight=[];
    for(const [name,code] of [
      ['relate','relate --version'],
      ['store',`if cat '${store.replaceAll("'", "'\\''")}/manifest.json'; then exit 0; fi; cat '${prepared.store.replaceAll("'", "'\\''")}/manifest.json'`],
      ['tool code','cat /tools/whygraph'],
      ['service code',`if cat '${new URL('./closed-store.mjs',import.meta.url).pathname}'; then exit 0; fi; cat '${new URL('../src/main.ts',import.meta.url).pathname}'`],
      ['other service','cat /whygraph/other/service.sock'],
    ]) {
      const r=spawnSync(confinement[0],[...confinement.slice(1),'--','/bin/bash','-c',code],{env:quiet,encoding:'utf8'});
      preflight.push({name,command:code,status:r.status,stderr:r.stderr});
    }
    writeFileSync(join(out,'confinement.json'),JSON.stringify(preflight,null,2));
    if(preflight.some(p=>p.status===0)) throw new Error('closed-store preflight succeeded in a forbidden read');
    const started=Date.now(),run=await runClosedAgent(agent,out);
    const {r,session,malformed}=run;
    // Normalize namespace paths for the unchanged isolation checker.
    const tools=session.tools.map(t=>({...t,input:t.input}));
    const identity=realpathSync(repo);
    const normalized=JSON.parse(JSON.stringify(tools).replaceAll('/repo/',`${identity}/`).replaceAll('"/repo"',JSON.stringify(identity)));
    const breaches=closedBreaches(isolationBreaches(repo,normalized));
    await launcher.stop();
    await service.stop();
    const stats=service.stats();
    const serviceDown=tools.some(t=>/whygraph (?:service|shell launcher) unavailable/.test(String(t.result)));
    const shellStats=launcher.stats();
    const causes=[...stats.reasons,...shellStats.reasons];
    const serviceFailure=stats.failures>0||serviceDown||shellStats.failures>0;
    const harness=r.spawnError||(!r.timedOut&&(malformed||r.code!==0||!session.success))||serviceFailure
      ?closedAgentCause(run,prompt,[...(serviceFailure?['service or shell launcher unavailable']:[]),...causes]):undefined;
    const meta={id:`${task.id}__${condition}__r${repeat}`,task:task.id,condition,repeat,agent:'opencode',model:rehearsal?'rehearsal':OPENCODE_MODEL,...(rehearsal?{rehearsal:true}:{}),
      status:harness||breaches.length?'invalid':r.code===0&&session.success&&!r.timedOut?'done':'error',
      ...(harness?{reason:`harness failure: ${harness}`} : breaches.length?{reason:'isolation breach',isolation:breaches}:r.timedOut?{reason:closedAgentCause(run,prompt)}:{}),
      timed_out:r.timedOut,exit:r.code,signal:r.signal,wall_ms:Date.now()-started,tokens:session.tokens,cost_usd:session.cost_usd,turns:session.turns,replies:session.replies,work,service:stats};
    writeFileSync(join(out,'tools.json'),JSON.stringify(tools,null,2));
    writeFileSync(join(out,'final.txt'),session.final);
    sh('git',[...base,'add','-A'],{env:gitEnv});
    writeFileSync(join(out,'diff.patch'),sh('git',[...base,'diff','--cached','HEAD'],{env:gitEnv}));
    writeFileSync(join(out,'meta.json'),JSON.stringify(meta,null,2));
    return meta;
  } catch(error) {
    const causes=[...(service.stats().reasons??[]),...(launcher?.stats().reasons??[])];
    const reason=`harness failure: ${closedAgentCause(undefined,prompt,[error.message,...causes])}`;
    const meta={id:`${task.id}__${condition}__r${repeat}`,task:task.id,condition,repeat,agent:'opencode',model:rehearsal?'rehearsal':OPENCODE_MODEL,...(rehearsal?{rehearsal:true}:{}),status:'invalid',reason,wall_ms:0,tokens:{total:0},work,service:service.stats()};
    writeFileSync(join(out,'meta.json'),JSON.stringify(meta,null,2));
    return meta;
  } finally { try { await launcher?.stop(); } finally { await service.stop(); } }
}

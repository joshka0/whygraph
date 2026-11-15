/** module: [[whygraph-closed-runner]] */
import { spawn, spawnSync } from 'node:child_process';
import { closeSync, cpSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, writeFileSync, chmodSync, lstatSync, readlinkSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { closedClient, closedConfinement, ablatedStores, startClosedStore, storeFingerprint } from './closed-store.mjs';
import { batchInstructions } from './registry.mjs';
import { readQuery } from '../src/tools.ts';
import { opencodeLaunch, opencodeSession, escapingSymlinks, isolationBreaches, OPENCODE_MODEL } from './opencode.mjs';
const quiet = { ...process.env, RELATE_TELEMETRY:'0', DO_NOT_TRACK:'1' };
const gitEnv = { ...quiet, GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_NOSYSTEM:'1',GIT_AUTHOR_NAME:'eval',GIT_AUTHOR_EMAIL:'eval@example.invalid',GIT_COMMITTER_NAME:'eval',GIT_COMMITTER_EMAIL:'eval@example.invalid' };
const sh = (cmd,args,options={}) => {
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

/** One isolated attempt, retaining its work folder and full service answers as evidence.
 * owns: [[whygraph-closed-runner]]
 */
export async function closedAttempt({task,condition,repeat,workRoot,out,prompt,source,store}) {
  const work=join(workRoot,`${task.id}__${condition}__r${repeat}__${randomUUID()}`);
  const client=closedClient(join(workRoot,'_closed-client'));
  const stores=ablatedStores(store,join(workRoot,`_${task.repo}`,'ablations'));
  const prepared=prepareClosed({task,condition,work,source,stores,client});
  const {repo,base,socket,files}=prepared;
  const log=join(out,'service.jsonl');
  const service=await startClosedStore({condition,repo,store:prepared.store,fullStore:stores.graph,socket,log});
  try {
    // The shell wrapper is identical in every condition and contains no service configuration.
    const shell=join(work,'shell');
    writeFileSync(shell,'#!/bin/sh\nexec /usr/bin/bwrap --die-with-parent --unshare-net --ro-bind / / --tmpfs /identity -- /bin/bash "$@"\n'); chmodSync(shell,0o555);
    const command=sh('bash',['-c','command -v opencode']).trim();
    if(sh(command,['--version']).trim()!=='1.18.29') throw new Error('requires opencode 1.18.29');
    const confinement=closedConfinement({work,repo,client,socket,network:true,opencode:command});
    confinement.push('--ro-bind',shell,'/tools/shell');
    const launch=opencodeLaunch(prompt,repo,'/tools','/tools/shell',work);
    Object.assign(launch.env,{HOME:'/home/agent',PATH:'/tools:/usr/bin:/bin',XDG_CONFIG_HOME:'/config',XDG_CACHE_HOME:'/cache',XDG_STATE_HOME:'/state',XDG_DATA_HOME:'/identity',OPENCODE_CONFIG_DIR:'/config/opencode'});
    // The old exact external-directory exclusion remains, with the mounted identity path too.
    const config=JSON.parse(launch.env.OPENCODE_CONFIG_CONTENT);
    config.permission.external_directory['/identity/opencode/tool-output/*']='deny';
    launch.env.OPENCODE_CONFIG_CONTENT=JSON.stringify(config);
    for(const name of ['whygraph','relate','memod']) files[`/tools/${name}`]=readFileSync(`${client}.sha256`,'utf8');
    files['/tools/shell']=createHash('sha256').update(readFileSync(shell)).digest('hex');
    writeFileSync(join(out,'files.json'),JSON.stringify(files,null,2));
    writeFileSync(join(out,'instructions.txt'),readFileSync(join(repo,'AGENTS.md')));
    const names=readQuery(stores.graph,'MATCH (s:Symbol) RETURN s.id AS id ORDER BY s.id LIMIT 1');
    const decisions=readQuery(stores.graph,'MATCH (d:Decision) RETURN d.id AS id, d.title AS title ORDER BY d.id LIMIT 1');
    if(!names.length||!decisions.length) throw new Error('health check needs a symbol and a decision');
    const symbol=String(names[0].id).replace(/#([^#]*)$/,':$1');
    const health={condition,stores:{full:realpathSync(stores.graph),current:realpathSync(prepared.store)},full:storeFingerprint(stores.graph),current:storeFingerprint(prepared.store),answers:[]};
    for(const args of [['carry',symbol],['why',symbol],['impact',String(decisions[0].id)],['search',String(decisions[0].title)]]) {
      const answer=await new Promise((resolve,reject)=>{
        const child=spawn(confinement[0],[...confinement.slice(1),'--','/tools/whygraph',...args],{env:quiet});const out=[],err=[];
        child.stdout.on('data',b=>out.push(b));child.stderr.on('data',b=>err.push(b));child.on('error',reject);
        child.on('close',code=>resolve({args,code,stdout:Buffer.concat(out).toString(),stderr:Buffer.concat(err).toString()}));
      });
      health.answers.push(answer);
      if(answer.code!==0||!answer.stdout.trim()) throw new Error(`health route failed for ${args[0]}: ${answer.stderr}`);
    }
    writeFileSync(join(out,'health.json'),JSON.stringify(health,null,2));
    writeFileSync(join(out,'command.json'),JSON.stringify({args:[...confinement,'--','/tools/opencode',...launch.args],env:launch.env},null,2));
    const preflight=[];
    for(const [name,code] of [
      ['relate','relate query --database /store "MATCH (n) RETURN n"'],
      ['store',`cat '${store.replaceAll("'", "'\\''")}/CURRENT'`],
      ['tool code','cat /tools/whygraph'],
      ['service code',`cat '${new URL('./closed-store.mjs',import.meta.url).pathname}'`],
      ['other service','cat /whygraph/other/service.sock'],
    ]) {
      const r=spawnSync(confinement[0],[...confinement.slice(1),'--','/bin/bash','-c',code],{env:quiet,encoding:'utf8'});
      preflight.push({name,command:code,status:r.status,stderr:r.stderr});
    }
    writeFileSync(join(out,'confinement.json'),JSON.stringify(preflight,null,2));
    if(preflight.some(p=>p.status===0)) throw new Error('closed-store preflight succeeded in a forbidden read');
    const started=Date.now(), stdout=openSync(join(out,'output.jsonl'),'w'), stderr=openSync(join(out,'stderr.txt'),'w');
    const r=await new Promise(resolve=>{
      const child=spawn(confinement[0],[...confinement.slice(1),'--','/tools/opencode',...launch.args],{env:launch.env,stdio:['ignore',stdout,stderr]});
      closeSync(stdout);closeSync(stderr);
      let timedOut=false,spawnError,killTimer;
      const timer=setTimeout(()=>{timedOut=true;child.kill('SIGTERM');killTimer=setTimeout(()=>child.kill('SIGKILL'),5000);},20*60*1000);
      child.on('error',e=>{spawnError=e.message;});
      child.on('close',(code,signal)=>{clearTimeout(timer);clearTimeout(killTimer);resolve({code,signal,timedOut,spawnError});});
    });
    const text=readFileSync(join(out,'output.jsonl'),'utf8'), events=[];let malformed=false;
    for(const line of text.split('\n').filter(l=>l.trim())) {try{events.push(JSON.parse(line));}catch{malformed=true;}}
    const session=opencodeSession(events);
    // Normalize namespace paths for the unchanged isolation checker.
    const tools=session.tools.map(t=>({...t,input:t.input}));
    const normalized=JSON.parse(JSON.stringify(tools).replaceAll('/repo/',`${repo}/`).replaceAll('"/repo"',JSON.stringify(repo)));
    const breaches=isolationBreaches(repo,normalized);
    const stats=service.stats();
    const serviceDown=tools.some(t=>String(t.result).includes('whygraph service unavailable'));
    const harness=r.spawnError || (!r.timedOut&&malformed?'malformed JSONL':undefined) || (stats.failures||serviceDown?'service unavailable':undefined);
    const meta={id:`${task.id}__${condition}__r${repeat}`,task:task.id,condition,repeat,agent:'opencode',model:OPENCODE_MODEL,
      status:harness||breaches.length?'invalid':r.code===0&&session.success&&!r.timedOut?'done':'error',
      ...(harness?{reason:`harness failure: ${harness}`} : breaches.length?{reason:'isolation breach',isolation:breaches}:{}),
      timed_out:r.timedOut,exit:r.code,signal:r.signal,wall_ms:Date.now()-started,tokens:session.tokens,cost_usd:session.cost_usd,turns:session.turns,replies:session.replies,work,service:stats};
    writeFileSync(join(out,'tools.json'),JSON.stringify(tools,null,2));
    writeFileSync(join(out,'final.txt'),session.final);
    sh('git',[...base,'add','-A'],{env:gitEnv});
    writeFileSync(join(out,'diff.patch'),sh('git',[...base,'diff','--cached','HEAD'],{env:gitEnv}));
    writeFileSync(join(out,'meta.json'),JSON.stringify(meta,null,2));
    return meta;
  } catch(error) {
    const meta={id:`${task.id}__${condition}__r${repeat}`,task:task.id,condition,repeat,agent:'opencode',model:OPENCODE_MODEL,status:'invalid',reason:`harness failure: ${error.message}`,wall_ms:0,tokens:{total:0},work,service:service.stats()};
    writeFileSync(join(out,'meta.json'),JSON.stringify(meta,null,2));
    return meta;
  } finally { await service.stop(); }
}

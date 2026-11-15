/**
 * module: [[whygraph-closed-store]]
 * Batch 7 owns the store outside both the agent process and its shell.
 */
import { createServer } from 'node:net';
import { spawn, execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { appendFileSync, chmodSync, cpSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { constants } from 'node:os';
import { readQuery } from '../src/tools.ts';
import { recipe } from '../src/ask.ts';
import { whyAnswer } from '../src/answers.pure.ts';
import { readSymbolTarget } from '../src/target.pure.ts';
import { readArgs } from '../src/args.pure.ts';
const root = fileURLToPath(new URL('..', import.meta.url));
const execute = promisify(execFile);
const quiet = { ...process.env, RELATE_TELEMETRY: '0', DO_NOT_TRACK: '1' };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');


/** Fingerprint every graph component, including search vectors and record text.
 * owns: [[whygraph-closed-store]]
 */
export function storeFingerprint(store) {
  const read = query => execFileSync('relate',['--no-agent-mode','--max-rows','0','query','--database',store,'--read-only','--mode','jsonl',query],{env:quiet,encoding:'utf8',maxBuffer:1<<29}).trim().split('\n').filter(Boolean).map(JSON.parse);
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value==='object' ? Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])) : value;
  const digest = rows => hash(rows.map(r=>JSON.stringify(canonical(r))).sort().join('\n'));
  const nodes=read('MATCH (n) RETURN labels(n) AS labels, properties(n) AS props');
  const edges=read('MATCH (a)-[r]->(b) RETURN labels(a) AS a, properties(a) AS ap, type(r) AS type, properties(r) AS props, labels(b) AS b, properties(b) AS bp');
  return {nodes:digest(nodes.filter(n=>!n.labels.includes('Term'))),edges:digest(edges.filter(e=>!['CITES','MENTIONS'].includes(e.type))),
    links:digest(edges.filter(e=>e.type==='CITES')),terms:digest(nodes.filter(n=>n.labels.includes('Term'))),mentions:digest(edges.filter(e=>e.type==='MENTIONS')),
    linkCount:edges.filter(e=>e.type==='CITES').length,termCount:nodes.filter(n=>n.labels.includes('Term')).length,mentionCount:edges.filter(e=>e.type==='MENTIONS').length};
}

/** Clone the one built store, then remove only the ablated graph relationships.
 * owns: [[whygraph-closed-store]]
 */
export function ablatedStores(store, directory) {
  mkdirSync(directory, { recursive: true });
  const answer = { graph: realpathSync(store) };
  const full=storeFingerprint(store);
  for (const [condition, query] of Object.entries({
    'graph-nolink': 'MATCH (:Decision)-[r:CITES]->(:Commit) DELETE r',
    'graph-noterms': 'MATCH (t:Term) DETACH DELETE t',
  })) {
    const started = Date.now(), path = join(directory, condition);
    if (!existsSync(join(directory, `${condition}.json`))) {
      if (existsSync(path)) throw new Error(`incomplete ablation at ${path}; inspect it before rebuilding`);
      cpSync(realpathSync(store), path, { recursive: true });
      execFileSync('relate', ['--no-agent-mode','--max-rows','0','query','--database',path,query], { env: quiet });
      writeFileSync(join(directory, `${condition}.json`), JSON.stringify({ source: realpathSync(store), ms: Date.now()-started, query }));
    }
    const recorded = JSON.parse(readFileSync(join(directory, `${condition}.json`)));
    if (recorded.source !== realpathSync(store)) throw new Error('ablation source changed; prepare a new template');
    const ablated=storeFingerprint(path);
    const keys=condition==='graph-nolink'?['nodes','edges','terms','mentions']:['nodes','edges','links'];
    if(keys.some(k=>full[k]!==ablated[k]) || (condition==='graph-nolink'?ablated.linkCount!==0:ablated.termCount!==0||ablated.mentionCount!==0)) throw new Error(`invalid ablation ${condition}`);
    writeFileSync(join(directory,`${condition}.proof.json`),JSON.stringify({full,ablated,unchanged:keys},null,2));
    answer[condition] = path;
  }
  return answer;
}

/** Compile a condition-free, execute-only transport once per source digest.
 * owns: [[whygraph-closed-store]]
 */
export function closedClient(directory) {
  const source = join(root, 'eval/closed-client.c');
  const dest = join(directory, `client-${hash(readFileSync(source))}`);
  mkdirSync(directory, { recursive: true });
  if (!existsSync(dest)) {
    execFileSync('cc', ['-O2','-Wall','-Wextra','-Werror',source,'-o',dest]);
    writeFileSync(`${dest}.sha256`,hash(readFileSync(dest)));
  }
  chmodSync(dest, 0o111);
  return dest;
}

/** A minimal filesystem shared by the whole agent process and all its file tools.
 * owns: [[whygraph-closed-store]]
 */
export function closedConfinement({ work, repo, client, socket, network = false, opencode }) {
  const args = ['bwrap','--die-with-parent','--new-session','--unshare-user','--unshare-pid','--unshare-ipc','--unshare-uts','--cap-drop','ALL'];
  if (!network) args.push('--unshare-net');
  for (const path of ['/usr','/bin','/lib','/lib64','/etc']) if (existsSync(path)) args.push('--ro-bind',path,path);
  args.push('--proc','/proc','--dev','/dev','--tmpfs','/tmp','--tmpfs','/home','--dir','/whygraph','--dir','/tools',
    '--bind',repo,'/repo','--bind',join(work,'home'),'/home/agent','--bind',join(work,'config'),'/config',
    '--bind',join(work,'cache'),'/cache','--bind',join(work,'state'),'/state',
    '--ro-bind',client,'/tools/whygraph','--ro-bind',client,'/tools/relate','--ro-bind',client,'/tools/memod',
    '--ro-bind',socket,'/whygraph/service.sock','--chdir','/repo');
  // Host-launched shell commands use the same filesystem without identity or network.
  if (network && opencode) {
    args.push('--ro-bind',opencode,'/tools/opencode');
    const data = process.env.XDG_DATA_HOME ?? join(process.env.HOME,'.local/share');
    args.push('--bind',join(data,'opencode'),'/identity/opencode');
  }
  return args;
}

/** Start one run's service. Only its socket is mounted inside that run's namespace.
 * owns: [[whygraph-closed-store]]
 */
export async function startClosedStore({ condition, repo, store, fullStore = store, socket, log }) {
  repo=realpathSync(repo);
  let failures = 0, calls = 0;
  const abort=new AbortController(), connections=new Set();
  const server = createServer(connection => {
    connections.add(connection);connection.on('close',()=>connections.delete(connection));
    let input = Buffer.alloc(0), dispatched = false;
    connection.on('error', () => {});
    connection.on('data', chunk => {
      if (dispatched) return;
      input = Buffer.concat([input,chunk]);
      if (input.length > 65536) { connection.destroy(); failures++; return; }
      if (input.length < 4) return;
      const count = input.readUInt32BE();
      if (count > 64) { connection.destroy(); failures++; return; }
      let at=4; const args=[];
      for(let i=0;i<count;i++) {
        if(input.length < at+4) return;
        const size=input.readUInt32BE(at); at+=4;
        if(size>60000) { connection.destroy(); failures++; return; }
        if(input.length < at+size) return;
        args.push(input.subarray(at,at+size).toString()); at+=size;
      }
      dispatched=true;
      void answer(args).then(respond, error => { failures++; respond({stdout:'',stderr:`whygraph service unavailable: ${error.message}\n`,code:70}); });
    });
    function respond(result) {
      dispatched=true;
      const out=Buffer.from(result.stdout), err=Buffer.from(result.stderr), header=Buffer.alloc(12);
      header.writeUInt32BE(result.code,0); header.writeUInt32BE(out.length,4); header.writeUInt32BE(err.length,8);
      connection.end(Buffer.concat([header,out,err]));
    }
  });
  async function answer(args) {
    calls++;
    const [command,target] = args;
    const parsed=readArgs(args);
    const diagnostic='usage' in parsed || parsed.command==='help';
    if (args.some(a=>a.includes('\0')) || (!diagnostic && (!['carry','why','impact','search'].includes(command) || args.length!==2))) {
      const result={stdout:'',stderr:'usage: whygraph <carry|why|impact|search> <target>\n',code:2};
      appendFileSync(log,JSON.stringify({args,...result,reference:{...result},sections:[]})+'\n');return result;
    }
    let result,reference,referenceStore;const sections=[];
    if(!diagnostic && (condition==='stub' || (condition==='graph-nosearch' && command==='search'))) result={stdout:'no result\n',stderr:'',code:0};
    else {
      const mapped = !diagnostic && command !== 'search' && target.startsWith('/repo/') ? join(repo,target.slice(6)) : target;
      try {
        const selectedStore=condition==='graph-nolink'&&['carry','impact'].includes(command)?fullStore:store;
        const r = await execute(join(root,'bin/whygraph'), diagnostic ? args : [command,mapped,'--repo',repo,'--store',selectedStore], { env:quiet, maxBuffer:1<<26, signal:abort.signal });
        result={stdout:r.stdout,stderr:r.stderr,code:0};
        reference={...result};referenceStore=realpathSync(selectedStore);
        if(condition==='graph-nolink' && command==='carry') {
          const parsed=readSymbolTarget(mapped,repo);
          if('usage' in parsed) throw new Error('successful carry had an invalid target');
          const ids=parsed.kind==='symbol'?[`${parsed.path}#${parsed.symbol}`]:readQuery(fullStore,recipe('names')).filter(n=>n.kind==='symbol'&&n.path===parsed.path&&Number(n.line)<=parsed.end&&Number(n.endLine)>=parsed.start).map(n=>String(n.name));
          for(const id of ids) {
            const before=whyAnswer(id,readQuery(fullStore,recipe('why'),{symbol:id})).split('\n').slice(2).join('\n');
            const after=whyAnswer(id,readQuery(store,recipe('why'),{symbol:id})).split('\n').slice(2).join('\n');
            if(!result.stdout.includes(before)) throw new Error('carry decision section changed; update the eval ablation');
            sections.push({before,after});
            result.stdout=result.stdout.replace(before,after);
          }
        }
      } catch(error) {
        if (!Number.isInteger(error.code)) throw error;
        result={stdout:error.stdout??'',stderr:error.stderr??'',code:error.code};
        reference={...result};
        if(error.code===1) failures++;
      }
    }
    appendFileSync(log,JSON.stringify({args,...result,reference:reference??{...result},referenceStore,sections})+'\n');
    return result;
  }
  await new Promise((ok,fail) => {server.once('error',fail); server.listen(socket,ok);});
  return { server, stats:()=>({calls,failures}), stop:()=>new Promise((ok,fail)=>{abort.abort();for(const connection of connections)connection.destroy();server.close(error=>error?fail(error):ok());}) };
}

/** Launch shell commands from the host, outside the agent's user namespace.
 * owns: [[whygraph-closed-store]]
 */
export async function startClosedShell({work,repo,client,socket,log}) {
  let failures=0, calls=0, stopped=false;
  const connections=new Set(), children=new Set(), completions=new Set();
  const kill=child=>{
    child.stdout.resume();child.stderr.resume();
    if(!child.pid)return;
    try { process.kill(-child.pid,'SIGKILL'); } catch(error) { if(error.code!=='ESRCH')throw error; }
  };
  const server=createServer(connection=>{
    connections.add(connection);
    let input=Buffer.alloc(0), child, started=false, ended=false;
    const frame=(type,bytes)=>{
      if(connection.destroyed)return true;
      const header=Buffer.alloc(8);header.writeUInt32BE(type);header.writeUInt32BE(bytes.length,4);
      return connection.write(Buffer.concat([header,bytes]));
    };
    const finish=(code,signal)=>{
      if(ended)return;ended=true;
      const status=Buffer.alloc(4);status.writeUInt32BE(code??128+(constants.signals[signal]??0));
      frame(3,status);connection.end();
      appendFileSync(log,JSON.stringify({event:'end',code:code??null,signal:signal??null})+'\n');
    };
    const fail=message=>{
      failures++;
      frame(2,Buffer.from(`whygraph shell launcher unavailable: ${message}\n`));finish(70);
    };
    connection.on('error',()=>{});
    connection.on('close',()=>{connections.delete(connection);if(child&&children.has(child))kill(child);});
    connection.on('data',chunk=>{
      if(ended)return;
      input=Buffer.concat([input,chunk]);
      if(!started) {
        if(input.length>1<<20){fail('request too large');connection.destroy();return;}
        if(input.length<4)return;
        const count=input.readUInt32BE();
        if(count<1||count>1024){fail('invalid argument count');return;}
        let at=4;const args=[];
        for(let i=0;i<count;i++) {
          if(input.length<at+4)return;
          const size=input.readUInt32BE(at);at+=4;
          if(size>1<<20){fail('argument too large');return;}
          if(input.length<at+size)return;
          args.push(input.subarray(at,at+size).toString());at+=size;
        }
        input=input.subarray(at);started=true;
        const cwd=args.shift();
        if(args.some(a=>a.includes('\0')) || cwd.includes('\0') || !(cwd==='/repo'||cwd.startsWith('/repo/')) || cwd.split('/').includes('..')){fail('invalid working directory or argument');return;}
        if(stopped){fail('run ended');return;}
        calls++;
        const confinement=closedConfinement({work,repo,client,socket});
        const atCwd=confinement.indexOf('--chdir');confinement[atCwd+1]=cwd;
        appendFileSync(log,JSON.stringify({event:'start',args,cwd})+'\n');
        child=spawn(confinement[0],[...confinement.slice(1),'--','/bin/bash',...args],{
          detached:true,env:{PATH:'/tools:/usr/bin:/bin',HOME:'/home/agent',LANG:'C.UTF-8',RELATE_TELEMETRY:'0',DO_NOT_TRACK:'1'},stdio:['pipe','pipe','pipe'],
        });
        children.add(child);
        const completed=new Promise(resolve=>child.once('close',(code,signal)=>{
          children.delete(child);completions.delete(completed);finish(code,signal);resolve();
        }));completions.add(completed);
        child.once('error',error=>fail(error.message));
        child.stdin.on('error',()=>{});
        for(const [stream,type] of [[child.stdout,1],[child.stderr,2]]) {
          stream.on('data',bytes=>{if(!frame(type,bytes))stream.pause();});
          connection.on('drain',()=>stream.resume());
        }
        child.stdin.on('drain',()=>connection.resume());
      }
      while(child && input.length>=8) {
        const type=input.readUInt32BE(),size=input.readUInt32BE(4);
        if(size>8192 || type>1 || (type===1&&size!==0)){fail('invalid input frame');kill(child);return;}
        if(input.length<8+size)return;
        const bytes=input.subarray(8,8+size);input=input.subarray(8+size);
        if(type===1)child.stdin.end();
        else if(!child.stdin.write(bytes))connection.pause();
      }
    });
  });
  server.on('close',()=>{if(!stopped)failures++;});
  server.on('error',()=>{failures++;});
  await new Promise((ok,fail)=>{server.once('error',fail);server.listen(join(work,'shell.sock'),ok);});
  const cancel=()=>{
    stopped=true;
    for(const child of children)kill(child);
    for(const connection of connections)connection.destroy();
  };
  const stop=async()=>{
    cancel();
    const closed=server.listening?new Promise((ok,fail)=>server.close(error=>error?fail(error):ok())):Promise.resolve();
    await Promise.all([closed,...completions]);
  };
  return {server,stats:()=>({calls,failures}),cancel,stop};
}

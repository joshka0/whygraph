/**
 * module: [[whygraph-closed-store]]
 * Batch 7 owns the store outside both the agent process and its shell.
 */
import { createServer } from 'node:net';
import { spawn, execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { appendFileSync, chmodSync, cpSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync, readdirSync, statSync, renameSync, lstatSync, readlinkSync } from 'node:fs';
import { dirname, join, resolve, parse } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { constants } from 'node:os';
import { createInterface } from 'node:readline';
import { readQuery } from '../src/tools.ts';
import { recipe } from '../src/ask.ts';
import { whyAnswer } from '../src/answers.pure.ts';
import { readSymbolTarget } from '../src/target.pure.ts';
import { readArgs } from '../src/args.pure.ts';
const root = fileURLToPath(new URL('..', import.meta.url));
const execute = promisify(execFile);
const quiet = { ...process.env, RELATE_TELEMETRY: '0', DO_NOT_TRACK: '1' };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');


const boundsQuery = 'MATCH (n) RETURN max(id(n)) AS nodeMax, count(n) AS nodeCount; MATCH ()-[r]->() RETURN max(id(r)) AS edgeMax, count(r) AS edgeCount;';

/** Fingerprint all properties once per node and short identities per edge.
 * owns: [[whygraph-closed-store]]
 */
export function storeFingerprint(store) {
  const rows = execFileSync('relate', ['--no-agent-mode','--max-rows','0','query','--database',store,
    '--read-only','--mode','jsonl',boundsQuery], { env: quiet, encoding: 'utf8', maxBuffer: 65536 });
  const bounds = Object.assign({}, ...rows.trim().split('\n').filter(Boolean).map(JSON.parse));
  return JSON.parse(execFileSync(process.execPath, [fileURLToPath(import.meta.url), 'fingerprint', store, JSON.stringify(bounds)],
    { env: quiet, encoding: 'utf8', maxBuffer: 65536 }));
}

async function fingerprint(store, bounds) {
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])) : value;
  const digests = Object.fromEntries(['nodes','edges','links','terms','mentions'].map(k => [k, createHash('sha256')]));
  const counts = { linkCount: 0, termCount: 0, mentionCount: 0 };
  const read = async (script, consume) => {
    const child = spawn('relate', ['--no-agent-mode','--max-rows','0','query','--database',store,'--read-only','--mode','jsonl'],
      { env: quiet, stdio: ['pipe','pipe','inherit'] });
    let inputError;
    child.stdin.on('error', error => { inputError = error; });
    child.stdin.end(script);
    const ended = new Promise((ok, fail) => {
      child.once('error', fail);
      child.once('close', (code, signal) => code === 0 ? ok() : fail(new Error(`fingerprint query exited ${code ?? signal}`)));
    });
    // Attach a rejection handler while stdout is read; await the same result below.
    ended.catch(() => {});
    try {
      for await (const line of createInterface({ input: child.stdout, crlfDelay: Infinity })) {
        if (line.trim()) consume(JSON.parse(line));
      }
      await ended;
      if (inputError) throw inputError;
    } catch (error) {
      child.kill('SIGKILL');
      await ended.catch(() => {});
      throw error;
    }
  };
  const add = (key, row) => digests[key].update(JSON.stringify(canonical(row)) + '\n');
  // Range each statement before projection: relate materializes query results.
  // One database session reuses its loaded graph across all bounded statements.
  if (!bounds) {
    bounds = {};
    await read(boundsQuery, row => Object.assign(bounds, row));
  }
  const nodeMax = bounds.nodeMax ?? -1, edgeMax = bounds.edgeMax ?? -1;
  if (![nodeMax,edgeMax,bounds.nodeCount,bounds.edgeCount].every(Number.isSafeInteger)
    || nodeMax < -1 || edgeMax < -1 || bounds.nodeCount < 0 || bounds.edgeCount < 0)
    throw new Error('invalid fingerprint row bounds');
  let nodeRows = 0, edgeRows = 0;
  const statements = [];
  // Clones retain IDs after deletes. Node rows bind short endpoints to every
  // property, including record text and vectors, without expanding each edge.
  for (let start = 0; start <= nodeMax; start += 256)
    statements.push(`MATCH (n) WHERE id(n) >= ${start} AND id(n) < ${start+256} RETURN id(n) AS id, labels(n) AS labels, properties(n) AS props ORDER BY id(n)`);
  for (let start = 0; start <= edgeMax; start += 4096)
    statements.push(`MATCH (a)-[r]->(b) WHERE id(r) >= ${start} AND id(r) < ${start+4096} RETURN id(r) AS id, id(a) AS a, type(r) AS type, properties(r) AS props, id(b) AS b ORDER BY id(r)`);
  if (statements.length) await read(statements.join(';\n') + ';', row => {
    if (row.labels) {
      nodeRows++;
      const key = row.labels.includes('Term') ? 'terms' : 'nodes';
      add(key, row);
      if (key === 'terms') counts.termCount++;
    } else {
      edgeRows++;
      const key = row.type === 'CITES' ? 'links' : row.type === 'MENTIONS' ? 'mentions' : 'edges';
      add(key, row);
      if (key === 'links') counts.linkCount++;
      if (key === 'mentions') counts.mentionCount++;
    }
  });
  if (nodeRows !== bounds.nodeCount || edgeRows !== bounds.edgeCount) throw new Error('incomplete fingerprint rows');
  return { ...Object.fromEntries(Object.entries(digests).map(([k,v]) => [k,v.digest('hex')])), ...counts };
}

// Read-only opens update relate's advisory lock files. They are not graph data.
function storeFiles(store) {
  const files = [];
  const walk = (directory, prefix = '') => {
    for (const name of readdirSync(directory).sort()) {
      if (name === '.cypherlite.lock' || name === '.cypherlite.writer') continue;
      const path = join(directory, name), rel = join(prefix, name), stat = statSync(path, { bigint: true });
      if (stat.isDirectory()) walk(path, rel);
      else files.push([rel, ...['dev','ino','size','mtimeNs','ctimeNs'].map(k => String(stat[k]))]);
    }
  };
  walk(store);
  if (!files.some(([name]) => name === 'manifest.json')) throw new Error(`invalid store: missing manifest at ${store}`);
  return files;
}

async function preparedStores(store, directory) {
  const source = realpathSync(store), receiptPath = join(directory, 'prepared.json');
  const paths = { graph: source, 'graph-nolink': join(directory,'graph-nolink'), 'graph-noterms': join(directory,'graph-noterms') };
  if (existsSync(receiptPath)) {
    const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
    if (receipt.version !== 1 || receipt.source !== source || receipt.algorithm !== 'sha256-internal-ids-v1')
      throw new Error('invalid preparation receipt: source or fingerprint algorithm changed');
    for (const [condition, path] of Object.entries(paths)) {
      if (JSON.stringify(storeFiles(path)) !== JSON.stringify(receipt.files?.[condition]))
        throw new Error(`store changed since preparation: ${condition}; inspect the invalid receipt`);
    }
    for (const condition of ['graph-nolink','graph-noterms']) {
      const recorded = JSON.parse(readFileSync(join(directory, `${condition}.json`), 'utf8'));
      const proof = JSON.parse(readFileSync(join(directory, `${condition}.proof.json`), 'utf8'));
      if (recorded.source !== source || JSON.stringify(proof) !== JSON.stringify(receipt.proofs?.[condition])
        || JSON.stringify(proof.full) !== JSON.stringify(receipt.fingerprints?.graph)
        || JSON.stringify(proof.ablated) !== JSON.stringify(receipt.fingerprints?.[condition]))
        throw new Error(`invalid ablation proof: ${condition}`);
    }
    return { ...paths, fingerprints: receipt.fingerprints };
  }
  if (readdirSync(directory).some(name => name !== '.prepare.lock'))
    throw new Error(`incomplete ablation preparation at ${directory}; inspect it before rebuilding`);
  const started = Date.now(), before = storeFiles(source);
  writeFileSync(join(directory, 'preparing.json'), JSON.stringify({ source, started }));
  const full = await fingerprint(source), fingerprints = { graph: full }, proofs = {};
  for (const [condition, query] of Object.entries({
    'graph-nolink': 'MATCH (:Decision)-[r:CITES]->(:Commit) DELETE r',
    'graph-noterms': 'MATCH (t:Term) DETACH DELETE t',
  })) {
    const copyStarted = Date.now(), path = paths[condition];
    cpSync(source, path, { recursive: true });
    execFileSync('relate', ['--no-agent-mode','--max-rows','0','query','--database',path,query], { env: quiet });
    const ablated = await fingerprint(path);
    const unchanged = condition === 'graph-nolink' ? ['nodes','edges','terms','mentions'] : ['nodes','edges','links'];
    if (unchanged.some(k => full[k] !== ablated[k]) || (condition === 'graph-nolink'
      ? ablated.linkCount !== 0 : ablated.termCount !== 0 || ablated.mentionCount !== 0))
      throw new Error(`invalid ablation ${condition}`);
    fingerprints[condition] = ablated;
    proofs[condition] = { full, ablated, unchanged };
    writeFileSync(join(directory, `${condition}.json`), JSON.stringify({ source, ms: Date.now()-copyStarted, query }));
    writeFileSync(join(directory, `${condition}.proof.json`), JSON.stringify(proofs[condition], null, 2));
  }
  if (JSON.stringify(before) !== JSON.stringify(storeFiles(source))) throw new Error('source store changed during preparation');
  const receipt = { version: 1, algorithm: 'sha256-internal-ids-v1', source, ms: Date.now()-started, fingerprints, proofs,
    files: Object.fromEntries(Object.entries(paths).map(([condition,path]) => [condition,storeFiles(path)])) };
  writeFileSync(join(directory, 'prepared.next.json'), JSON.stringify(receipt));
  renameSync(join(directory, 'prepared.next.json'), receiptPath);
  return { ...paths, fingerprints };
}

/** Prepare once under a kernel lock; later calls validate file identities only.
 * owns: [[whygraph-closed-store]]
 */
export function ablatedStores(store, directory) {
  directory = resolve(directory);
  mkdirSync(directory, { recursive: true });
  return JSON.parse(execFileSync('flock', ['--exclusive', join(directory,'.prepare.lock'), process.execPath,
    fileURLToPath(import.meta.url), 'prepare', store, directory], { env: quiet, encoding: 'utf8', maxBuffer: 65536 }));
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

const systemFolders = ['/usr','/bin','/lib','/lib64','/etc'];
const under = (parent, path) => path === parent || path.startsWith(parent + '/');

/** Follow the host resolver's file links without mounting their containing folders.
 * owns: [[whygraph-closed-store]]
 */
export function resolverMounts({ work, repo, client }) {
  const mounted = path => systemFolders.some(folder => under(folder, path));
  const forbidden = [root, dirname(resolve(work)), repo, dirname(client), process.env.HOME,
    '/proc','/dev','/tmp','/identity','/tools','/whygraph'].filter(Boolean).map(canonicalPath);
  const safe = path => {
    filesystemPath(path);
    if (forbidden.some(folder => under(folder, canonicalPath(path))))
      throw new Error(`resolver dependency crosses a private mount boundary: ${path}`);
  };
  const links = new Map(), files = new Set();
  for (const input of ['/etc/resolv.conf','/etc/nsswitch.conf','/etc/hosts','/etc/host.conf','/etc/gai.conf']) {
    if (!lstatSync(input, { throwIfNoEntry: false })) continue;
    let path = input, followed = 0;
    for (;;) {
      const parts = path.slice(parse(path).root.length).split('/');
      let prefix = '/', changed = false;
      for (let i = 0; i < parts.length; i++) {
        prefix = join(prefix, parts[i]);
        const stat = lstatSync(prefix);
        if (!stat.isSymbolicLink()) continue;
        if (++followed > 40) throw new Error(`resolver symlink cycle: ${input}`);
        const target = readlinkSync(prefix);
        if (!mounted(prefix)) { safe(prefix); links.set(prefix, target); }
        path = resolve(dirname(prefix), target, ...parts.slice(i + 1));
        changed = true; break;
      }
      if (!changed) break;
    }
    // Opening verifies readability; the bytes are never included in diagnostics.
    if (!statSync(path).isFile()) throw new Error(`resolver dependency is not a regular file: ${input}`);
    if (!mounted(path)) {
      safe(path);
      if (statSync(path).mode & 0o111) throw new Error(`resolver dependency is executable: ${input}`);
      files.add(path);
    }
    readFileSync(path);
  }
  return [...[...links].flatMap(([path, target]) => ['--symlink', target, path]),
    ...[...files].flatMap(path => ['--ro-bind', path, path])];
}

/** A minimal filesystem shared by the whole agent process and all its file tools.
 * owns: [[whygraph-closed-store]]
 */
export function closedConfinement({ work, repo, client, socket, network = false, opencode }) {
  for (const path of [work, repo, client, socket, ...(opencode ? [opencode] : [])]) filesystemPath(path);
  const args = ['bwrap','--die-with-parent','--new-session','--unshare-user','--unshare-pid','--unshare-ipc','--unshare-uts','--cap-drop','ALL'];
  if (!network) args.push('--unshare-net');
  for (const path of systemFolders) if (existsSync(path)) args.push('--ro-bind',path,path);
  args.push(...resolverMounts({work,repo,client}));
  args.push('--proc','/proc','--dev','/dev','--tmpfs','/tmp','--tmpfs','/home','--dir','/whygraph','--dir','/tools',
    '--bind',repo,'/repo','--bind',join(work,'home'),'/home/agent','--bind',join(work,'config'),'/config',
    '--bind',join(work,'cache'),'/cache','--bind',join(work,'state'),'/state',
    '--ro-bind',client,'/tools/whygraph','--ro-bind',client,'/tools/relate','--ro-bind',client,'/tools/memod',
    '--ro-bind',socket,'/whygraph/service.sock','--chdir','/repo');
  // Host-launched shell commands use the same filesystem without identity or network.
  if (network && opencode) {
    args.push('--ro-bind',opencode,'/tools/opencode');
    const data = process.env.XDG_DATA_HOME ?? join(process.env.HOME,'.local/share');
    filesystemPath(join(data,'opencode'));
    args.push('--bind',join(data,'opencode'),'/identity/opencode');
  }
  return args;
}

/** Start one run's service. Only its socket is mounted inside that run's namespace.
 * owns: [[whygraph-closed-store]]
 */
export async function startClosedStore({ condition, repo, store, fullStore = store, socket, log }) {
  socketPath(socket);
  repo=realpathSync(repo);
  let failures = 0, calls = 0, refused = 0, stopped = 0, stopping;
  const reasons=[], refusalReasons=[];
  const failure=message=>{failures++;reasons.push(message);appendFileSync(log,JSON.stringify({event:'failure',message})+'\n');};
  const abort=new AbortController(), connections=new Set(), pending=new Set(), commands=new Set();
  const server = createServer(connection => {
    connections.add(connection);connection.on('close',()=>connections.delete(connection));
    let input = Buffer.alloc(0), dispatched = false;
    connection.on('error', () => {});
    const refuse=message=>{
      dispatched=true;refused++;refusalReasons.push(message);
      appendFileSync(log,JSON.stringify({event:'refused',message})+'\n');connection.destroy();
    };
    connection.on('data', chunk => {
      if (dispatched) return;
      input = Buffer.concat([input,chunk]);
      if (input.length > 65536) { refuse('request too large'); return; }
      if (input.length < 4) return;
      const count = input.readUInt32BE();
      if (count > 64) { refuse('invalid argument count'); return; }
      let at=4; const args=[];
      for(let i=0;i<count;i++) {
        if(input.length < at+4) return;
        const size=input.readUInt32BE(at); at+=4;
        if(size>60000) { refuse('argument too large'); return; }
        if(input.length < at+size) return;
        args.push(input.subarray(at,at+size).toString()); at+=size;
      }
      dispatched=true;
      const settled=answer(args).then(respond, error => {
        // The run's own stop cut this call: its client is gone, and the service did not fail.
        if(abort.signal.aborted&&error.name==='AbortError') { stopped++;appendFileSync(log,JSON.stringify({event:'stopped',args})+'\n');return; }
        failure(error.message);
        const result={stdout:'',stderr:'whygraph service unavailable\n',code:70};
        appendFileSync(log,JSON.stringify({args,...result,failure:error.message,sections:[]})+'\n');
        respond(result);
      }).finally(()=>pending.delete(settled));
      pending.add(settled);
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
        const running = execute(join(root,'bin/whygraph'), diagnostic ? args : [command,mapped,'--repo',repo,'--store',selectedStore], { env:quiet, maxBuffer:1<<26, signal:abort.signal });
        // An abort rejects the call before its command has exited; stop() waits for the exit itself.
        const exited=new Promise(ok=>{running.child.once('close',ok);running.child.once('error',()=>{if(running.child.pid===undefined)ok();});}).then(()=>commands.delete(exited));
        commands.add(exited);
        const r = await running;
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
        if(error.code===1) throw new Error(error.stderr || 'product command failed');
      }
    }
    appendFileSync(log,JSON.stringify({args,...result,reference:reference??{...result},referenceStore,sections})+'\n');
    return result;
  }
  await new Promise((ok,fail) => {server.once('error',fail); server.listen(socket,ok);});
  const stop=async()=>{
    abort.abort();
    await Promise.allSettled(pending);
    await Promise.all(commands);
    for(const connection of connections)connection.destroy();
    await new Promise((ok,fail)=>server.close(error=>error?fail(error):ok()));
  };
  return { server, stats:()=>({calls,failures,reasons:[...reasons],refused,refusalReasons:[...refusalReasons],stopped}), stop:()=>stopping??=stop() };
}

/** Launch shell commands from the host, outside the agent's user namespace.
 * owns: [[whygraph-closed-store]]
 */
export async function startClosedShell({work,repo,client,socket,log}) {
  let failures=0, calls=0, stopped=false;
  const reasons=[];
  const failure=message=>{failures++;reasons.push(message);appendFileSync(log,JSON.stringify({event:'failure',message})+'\n');};
  const connections=new Set(), children=new Map(), completions=new Set(), scopeErrors=[];
  const kill=child=>{
    child.stdout.resume();child.stderr.resume();
    const scope=children.get(child);
    if(!scope || scope.cancelled)return;
    scope.cancelled=true;
    scope.timer=setTimeout(()=>scope.fail(new Error('command scope did not terminate within 10000 ms')),10000);
    if(scope.ready)scope.kill();
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
      failure(message);
      frame(2,Buffer.from(`whygraph shell launcher unavailable: ${message}\n`));finish(70);
    };
    connection.on('error',()=>{});
    connection.on('close',()=>{connections.delete(connection);if(child&&children.has(child))kill(child);});
    connection.on('data',chunk=>{
      if(ended)return;
      input=Buffer.concat([input,chunk]);
      if(!started) {
        if(input.length<4)return;
        const count=input.readUInt32BE();
        if(count<1||count>1024){fail('invalid argument count');return;}
        let at=4;const args=[];
        for(let i=0;i<count;i++) {
          if(at+4>1<<20){fail('request too large');return;}
          if(input.length<at+4)return;
          const size=input.readUInt32BE(at);at+=4;
          if(size>1<<20){fail('argument too large');return;}
          if(at+size>1<<20){fail('request too large');return;}
          if(input.length<at+size)return;
          args.push(input.subarray(at,at+size).toString());at+=size;
        }
        input=input.subarray(at);started=true;
        const cwd=args.shift();
        if(args.some(a=>a.includes('\0')) || cwd.includes('\0') || !(cwd==='/repo'||cwd.startsWith('/repo/')) || cwd.split('/').includes('..')){fail('invalid working directory or argument');return;}
        if(stopped){fail('run ended');return;}
        calls++;
        let confinement;
        try {
          filesystemPath(join(repo,cwd.slice(6)));
          confinement=closedConfinement({work,repo,client,socket});
          const atCwd=confinement.indexOf('--chdir');confinement[atCwd+1]=cwd;
          execBudget(confinement[0],[...confinement.slice(1),'--info-fd','3','--block-fd','4','--','/bin/bash',...args],{PATH:'/tools:/usr/bin:/bin',HOME:'/home/agent',LANG:'C.UTF-8',RELATE_TELEMETRY:'0',DO_NOT_TRACK:'1'});
        }
        catch(error) { fail(error.message); return; }
        appendFileSync(log,JSON.stringify({event:'start',args,cwd})+'\n');
        child=spawn(confinement[0],[...confinement.slice(1),'--info-fd','3','--block-fd','4','--','/bin/bash',...args],{
          detached:true,env:{PATH:'/tools:/usr/bin:/bin',HOME:'/home/agent',LANG:'C.UTF-8',RELATE_TELEMETRY:'0',DO_NOT_TRACK:'1'},stdio:['pipe','pipe','pipe','pipe','pipe'],
        });
        const scope={ready:false,cancelled:false,timer:undefined,kill:()=>{
          witness?.kill('SIGTERM');
          if(!child.pid || child.exitCode!==null || child.signalCode!==null)return;
          try { process.kill(-child.pid,'SIGKILL'); } catch(error) { if(error.code!=='ESRCH')throw error; }
        }};
        children.set(child,scope);
        const closed=new Promise(resolve=>child.once('close',(code,signal)=>resolve({code,signal})));
        let witness;
        const reaped=new Promise((resolve,reject)=>{
          scope.fail=reject;
          // The helper opens a pidfd before releasing bwrap's startup barrier.
          // Its poll completes only after namespace PID 1 finishes kernel teardown.
          witness=spawn(client,[],{argv0:'shell-scope',stdio:[child.stdio[3],'pipe','pipe',child.stdio[4]]});
          child.stdio[3].destroy();child.stdio[4].destroy();
          witness.stdout.once('data',()=>{scope.ready=true;if(scope.cancelled)scope.kill();});
          witness.stderr.on('data',bytes=>appendFileSync(log,JSON.stringify({event:'scope-error',message:bytes.toString()})+'\n'));
          witness.once('error',reject);
          witness.once('close',(code,signal)=>code===0||!child.pid?resolve():reject(new Error(`command scope witness exited ${code??signal}`)));
        });
        const completed=Promise.all([closed,reaped]).then(([{code,signal}])=>finish(code,signal)).catch(error=>{
          scopeErrors.push(error);fail(error.message);scope.kill();witness?.kill('SIGKILL');
        }).finally(()=>{
          clearTimeout(scope.timer);children.delete(child);completions.delete(completed);
        });completions.add(completed);
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
  server.on('close',()=>{if(!stopped)failure('shell launcher closed unexpectedly');});
  server.on('error',error=>{failure(error.message);});
  await new Promise((ok,fail)=>{server.once('error',fail);server.listen(socketPath(join(work,'shell.sock')),ok);});
  const cancel=()=>{
    stopped=true;
    for(const child of children.keys())kill(child);
    for(const connection of connections)connection.destroy();
  };
  const stop=async()=>{
    cancel();
    const closed=server.listening?new Promise((ok,fail)=>server.close(error=>error?fail(error):ok())):Promise.resolve();
    await Promise.all([closed,...completions]);
    if(scopeErrors.length)throw new AggregateError(scopeErrors,'shell command scope cleanup failed');
  };
  return {server,stats:()=>({calls,failures,reasons:[...reasons]}),cancel,stop};
}

/** Check the pathname passed to the kernel, in bytes.
 * owns: [[whygraph-closed-store]]
 */
export function socketPath(path) {
  if (Buffer.byteLength(path) > 107) throw new Error(`Unix socket path exceeds 107 bytes: ${path}`);
  return path;
}

/** Reject an unusable root before preparation or a ledger reservation.
 * owns: [[whygraph-closed-store]]
 */
export function closedWorkRoot(root) {
  if (Buffer.byteLength(join(resolve(root), '0'.repeat(36), 'service.sock')) > 107)
    throw new Error(`work root too long for Unix sockets (107-byte limit): ${resolve(root)}`);
  filesystemPath(root);
  return root;
}

/** Resolve path identities for comparisons and filesystem guards, without changing launch paths.
 * owns: [[whygraph-closed-store]]
 */
export function canonicalPath(path) {
  const absolute=resolve(path);
  let ancestor=absolute;
  while (!existsSync(ancestor) && dirname(ancestor)!==ancestor) ancestor=dirname(ancestor);
  return realpathSync(ancestor)+absolute.slice(ancestor.length);
}

/** Check mount paths and canonical existing ancestors before exec.
 * owns: [[whygraph-closed-store]]
 */
export function filesystemPath(path) {
  const absolute = resolve(path);
  const check = value => {
    if (Buffer.byteLength(value) >= 4096 || value.split('/').some(part => Buffer.byteLength(part) > 255))
      throw new Error(`filesystem path limit exceeded: ${path}`);
  };
  check(absolute);
  const canonical = canonicalPath(absolute);
  check(canonical);
  return path;
}

let limits;
/** Validate the host exec budget, including environment bytes and pointers.
 * owns: [[whygraph-closed-store]]
 */
export function execBudget(command, args, env = process.env) {
  limits ??= {
    argument: Number(execFileSync('getconf', ['PAGESIZE'], { encoding: 'utf8' }).trim()) * 32,
    total: Number(execFileSync('getconf', ['ARG_MAX'], { encoding: 'utf8' }).trim()),
  };
  const fields = [command, ...args, ...Object.entries(env).filter(([,v]) => v !== undefined).map(([k,v]) => `${k}=${v}`)];
  let bytes = (fields.length + 2) * 8;
  for (const [index, field] of fields.entries()) {
    const size = Buffer.byteLength(field) + 1;
    if (field.includes('\0') || size > limits.argument)
      throw new Error(`exec argument or environment entry ${index} exceeds host limit (${limits.argument - 1} bytes) or contains NUL`);
    bytes += size;
  }
  // Linux also stores the executable pathname and alignment in this budget.
  if (bytes + Buffer.byteLength(command) + 4096 > limits.total)
    throw new Error(`exec arguments and environment exceed host ARG_MAX (${limits.total} bytes)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command, store, directory] = process.argv.slice(2);
  if (command === 'fingerprint') console.log(JSON.stringify(await fingerprint(store, JSON.parse(directory))));
  else if (command === 'prepare') console.log(JSON.stringify(await preparedStores(store, directory)));
  else throw new Error('usage: closed-store.mjs <fingerprint store bounds-json|prepare store directory>');
}

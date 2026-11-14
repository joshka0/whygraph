/** module: [[whygraph-batch5-runner-probe]]
 * Invented runner fixtures. Agent processes are never started: their stdout,
 * stderr, close/error events and signals are simulated at the spawn boundary.
 * Only git may really execute, exclusively against the scratch baseline.
 */
import child from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { pathToFileURL } from 'node:url';
import { existsSync, mkdirSync, renameSync, writeFileSync, writeSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
const [, , runner, work, mode = 'missing'] = process.argv;
const isTimeout=mode.startsWith('timeout');
process.env.WHYGRAPH_EVAL_WORK = work;
if (mode !== 'missing') {
  const at = join(work, '_ripgrep');
  if(mode==='valid-retry'&&existsSync(join(at,'repo')))renameSync(join(at,'repo'),join(at,'repo-prior'));
  mkdirSync(join(at, 'repo'), { recursive: true }); mkdirSync(join(at, 'store'),{recursive:true});
  // The contract names a ready marker, without prescribing its filename.
  for (const f of ['ready', '.ready']) writeFileSync(join(at, f), 'ready\n');
  writeFileSync(join(at, 'repo/file'), 'ordinary\n'); writeFileSync(join(at, 'store/marker'), 'store\n');
  if (mode === 'preflight'&&!existsSync(join(at,'repo/escape'))) symlinkSync('/etc/hostname', join(at, 'repo/escape'));
}
const calls = [], signals = [], timers = [];
const methods = ['spawn', 'spawnSync', 'execFileSync', 'execSync'];
const original = Object.fromEntries(methods.map(k => [k, child[k]]));
const realTimer = globalThis.setTimeout;
if (isTimeout) globalThis.setTimeout = (fn, delay, ...args) => {
  timers.push(delay); return realTimer(fn, delay === 1200000 || delay === 5000 ? 0 : delay, ...args);
};
const text = { type: 'text', part: { text: 'First' } };
const stop = { type: 'step_finish', part: { reason: 'stop', cost: .125, tokens: { input: 2, output: 3, reasoning: 5, cache: { read: 7, write: 11 }, total: 13 } } };
function fakeAgent(options) {
  const p = new EventEmitter(); p.pid = 2147483647;
  p.kill = signal => { signals.push(signal); if (signal === 'SIGKILL') queueMicrotask(() => p.emit('close', null, signal)); return true; };
  if (mode === 'spawn-error') { queueMicrotask(() => { p.emit('error', new Error('invented spawn failure')); p.emit('close', -2); }); return p; }
  const events = [text, { type: 'tool_use', part: { tool: 'shell', state: { status: 'completed', input: { command: mode === 'transient' ? 'ln -s internal gone' : 'echo safe' }, output: 'safe\n' } } }, { type: 'text', part: { text: 'Last' } }, stop];
  if (mode === 'blank') events.splice(0, events.length, { type: 'text', part: { text: ' \n' } }, stop);
  if (mode === 'incomplete') events[events.length - 1] = { type: 'step_finish', part: { reason: 'tool-calls' } };
  if (mode === 'error') events.push({ type: 'error', error: { message: 'invented agent error' } });
  if (mode === 'externalfile') events.splice(1, 0, { type: 'tool_use', part: { tool: 'read', state: { status: 'error', input: { filePath: '/etc/hostname' }, error: 'denied' } } });
  if (mode === 'postlink'||mode==='timeout-link') { mkdirSync(join(options.cwd, '.git/hidden'), { recursive: true }); symlinkSync('/etc/hostname', join(options.cwd, '.git/hidden/escape')); }
  const raw = events.map(e => JSON.stringify(e)).join('\n') + '\n' + (mode === 'malformed' ? 'not JSON\n' : ['cut','timeout-cut','timeout-link'].includes(mode) ? '{"type":"text","part":' : '');
  if (!Array.isArray(options.stdio) || typeof options.stdio[1] !== 'number' || typeof options.stdio[2] !== 'number') throw new Error('stdout/stderr must be direct file descriptors');
  writeSync(options.stdio[1], raw); writeSync(options.stdio[2], 'invented stderr\n');
  if (!isTimeout) queueMicrotask(() => p.emit('close', mode === 'exit-nonzero' ? 9 : 0));
  return p;
}
const guard = (method, command, args = [], options = {}) => {
  const isAgent=command==='opencode'||command.endsWith('/opencode');
  calls.push({ method, command, args, ...(isAgent && method === 'spawn' ? { stdio: options.stdio?.map(v => typeof v) } : {}) });
  if(method==='spawnSync'&&command==='bash'&&args.join(' ')==='-c command -v opencode')return {status:mode==='version-missing'?1:0,stdout:mode==='version-missing'?'':'/invented/opencode\n',stderr:''};
  if (isAgent && args.length === 1 && args[0] === '--version') {
    if (method === 'spawnSync') return { status: 0, stdout: mode==='version-wrong'?'1.18.28\n':'1.18.29\n', stderr: '' };
    return options.encoding ? '1.18.29\n' : Buffer.from('1.18.29\n');
  }
  if (mode !== 'missing' && command === 'git') return original[method](command, args, options);
  if (mode !== 'missing' && mode !== 'preflight' && method === 'spawn' && isAgent) return fakeAgent(options);
  throw new Error(`unexpected child process: ${command}`);
};
for (const method of methods) child[method] = (...args) => guard(method, ...args);
syncBuiltinESMExports();
const task = { id: 'invented-batch5-fixture', batch: 5, repo: 'ripgrep', kind: 'control', request: 'Invented fixture; no agent may start.', ground_truth: { source: {} }, score: {} };
try {
  const { runOne } = await import(pathToFileURL(runner).href);
  const value = await runOne(task, 'none', 1, [task.id]);
  console.log(JSON.stringify({ calls, signals, timers, value }));
} catch (error) {
  console.log(JSON.stringify({ calls, signals, timers, error: error.message }));
}

/**
 * module: [[whygraph-contract-harness]]
 * Test-only process and fixture support; retains scratch for the parent.
 */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { once } from 'node:events';

const root = fileURLToPath(new URL('../', import.meta.url));
const subject = resolve(process.env.WHYGRAPH_SUBJECT_ROOT ?? root);
const runDir = process.env.WHYGRAPH_TEST_RUN_DIR;
assert.ok(runDir, 'Use pnpm test (the runner assigns a retained run directory)');
const env = {
  ...process.env, RELATE_TELEMETRY: '0', DO_NOT_TRACK: '1',
  GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'contract', GIT_AUTHOR_EMAIL: 'contract@example.invalid',
  GIT_COMMITTER_NAME: 'contract', GIT_COMMITTER_EMAIL: 'contract@example.invalid',
  GIT_AUTHOR_DATE: '2026-01-10T12:00:00Z', GIT_COMMITTER_DATE: '2026-01-10T12:00:00Z',
  PATH: `${root}/node_modules/.bin:${process.env.HOME}/.local/bin:${process.env.PATH}`,
};

function command(file, args, cwd, extra = {}) {
  const result = spawnSync(file, args, { cwd, env: { ...env, ...extra }, encoding: 'utf8', timeout: 90_000, maxBuffer: 32 * 1024 * 1024 });
  if (result.error) throw result.error;
  return { code: result.status, signal: result.signal, stdout: result.stdout, stderr: result.stderr };
}
function ok(result) {
  assert.equal(result.code, 0, JSON.stringify(result, null, 2));
  return result.stdout;
}
function has(text, ...parts) {
  for (const part of parts) assert.ok(text.includes(part), `Expected ${JSON.stringify(part)} in:\n${text}`);
  return text;
}
function failure(result, code, ...parts) {
  assert.equal(result.code, code, JSON.stringify(result, null, 2));
  has(result.stderr, ...parts);
  return result.stderr;
}
function record(id, fields = {}) { return { id, date: '2026-01-01', ...fields }; }
function ids(text) { return [...text.matchAll(/^\s+(?:\d{4}-\d{2}-\d{2}|undated)\s+(\S+)/gm)].map(m => m[1]); }
function config(text) {
  const start = text.indexOf('{');
  const end = text.indexOf('\nRecipes:');
  assert.ok(start >= 0 && end > start, text);
  const server = JSON.parse(text.slice(start, end)).mcpServers.whygraph;
  const recipes = new Map([...text.matchAll(/^== (\w+)\n([\s\S]*?)(?=^== |$(?![\s\S]))/gm)].map(m => [m[1], m[2].trim()]));
  return { server, recipes };
}

function state(t, mode = 'fixture') {
  const dir = join(runDir, t.name.replace(/[^a-zA-Z0-9_-]/g, '_'));
  mkdirSync(dir, { recursive: false });
  const repo = join(dir, 'repo');
  const log = join(dir, 'commands.jsonl');
  function run(file, args, cwd = repo, extra = {}) {
    const result = command(file, args, cwd, extra);
    appendFileSync(log, JSON.stringify({ file, args, cwd, ...result }) + '\n');
    return result;
  }
  function write(path, content) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
    return path;
  }
  function git(...args) { return ok(run('git', args)); }
  function cli(args, extra = {}) { return run(process.execPath, [join(subject, 'src/main.ts'), ...args], extra.cwd ?? repo, extra.env ?? {}); }
  let decisionFiles = [];
  function decisions(records, name = 'records.json') {
    return write(join(dir, name), { records });
  }
  function build(files = decisionFiles, extra = {}) { return cli(['build', ...files.flatMap(file => ['--decisions', file])], extra); }
  if (mode.startsWith('fixture')) {
    ok(run('/bin/bash', [join(root, 'scripts/fixture.sh'), repo], dir));
    if (mode === 'fixture') {
      const adrs = write(join(dir, 'adrs.json'), ok(cli(['decisions', 'adr', 'docs/adr'])));
      decisionFiles = [adrs, join(repo, 'decisions/notes.json')];
      ok(build());
    }
  } else {
    mkdirSync(repo);
    if (mode !== 'outside') git('init', '-q', '-b', 'main');
    if (mode === 'code') write(join(repo, 'src/code.ts'), 'export function f() { return 1; }\n');
  }
  function wrapper(name, body, only = null) {
    const bin = join(dir, `bin-${name}-${Math.random().toString(16).slice(2)}`);
    mkdirSync(bin);
    if (only) {
      for (const tool of only) {
        const found = ok(command('/usr/bin/which', [tool], repo)).trim();
        symlinkSync(realpathSync(found), join(bin, tool));
      }
    }
    if (body !== null) write(join(bin, name), `#!${process.execPath}\n${body}\n`);
    if (body !== null) ok(run('/bin/chmod', ['+x', join(bin, name)]));
    return { PATH: only ? bin : `${bin}:${env.PATH}` };
  }
  function commit(message) { git('add', '-A'); git('commit', '-q', '-m', message); return git('rev-parse', 'HEAD').trim(); }
  return {
    dir, repo, cli, git, run, write, decisions, build, wrapper, commit,
    get files() { return decisionFiles; },
    get store() { return resolve(repo, git('rev-parse', '--git-path', 'whygraph/store').trim()); },
  };
}

async function mcp(t, s) {
  const printed = config(ok(s.cli(['mcp'])));
  const child = spawn(printed.server.command, printed.server.args, {
    cwd: s.repo, env: { ...env, ...printed.server.env, RELATE_TELEMETRY: '0', DO_NOT_TRACK: '1' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk; });
  const pending = new Map();
  let nextId = 0;
  const lines = createInterface({ input: child.stdout });
  lines.on('line', line => {
    appendFileSync(join(s.dir, `mcp-${child.pid}.jsonl`), line + '\n');
    let response;
    try { response = JSON.parse(line); } catch { return; }
    if (response.id !== undefined && pending.has(response.id)) {
      const { resolve, reject, timer } = pending.get(response.id);
      clearTimeout(timer); pending.delete(response.id);
      if (response.error) reject(new Error(JSON.stringify(response.error)));
      else resolve(response.result);
    }
  });
  const rejectPending = error => {
    for (const { reject, timer } of pending.values()) { clearTimeout(timer); reject(error); }
    pending.clear();
  };
  child.on('error', rejectPending);
  child.on('exit', code => rejectPending(new Error(`MCP exited ${code}: ${stderr}`)));
  t.after(async () => {
    child.stdin.end();
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      const timer = setTimeout(() => child.kill('SIGTERM'), 3000);
      await exited;
      clearTimeout(timer);
    }
    lines.close();
    writeFileSync(join(s.dir, `mcp-${child.pid}.stderr`), stderr);
  });
  function request(method, params = {}) {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`MCP ${method} timed out: ${stderr}`)); }, 15_000);
      pending.set(id, { resolve, reject, timer });
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  }
  await request('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'whygraph-contracts', version: '1' } });
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  async function tool(name, args = {}) {
    const result = await request('tools/call', { name, arguments: args });
    assert.ok(!result.isError, JSON.stringify(result));
    return result;
  }
  async function rows(statement, parameters = {}) {
    const result = await tool('read_cypher', { statement, parameters });
    const body = result.content.filter(x => x.type === 'text').map(x => x.text).join('\n');
    const parsed = JSON.parse(body);
    assert.ok(Array.isArray(parsed) || Array.isArray(parsed.rows), body);
    return Array.isArray(parsed) ? parsed : parsed.rows;
  }
  return { ...printed, request, tool, rows };
}

/** owns: [[whygraph-contract-harness]] */
export const harness = { root, subject, env, command, ok, has, failure, record, ids, config, state, mcp };

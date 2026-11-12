#!/usr/bin/env node
/**
 * module: [[whygraph-eval-runner]]
 * Runs the eval: one headless Claude Code agent per (task, condition, repeat), each in a fresh copy
 * of its task repo, and saves what it did under eval/results/<run id>/.
 *
 *   node eval/run.mjs [--only <task id>[,<task id>...]] [--conditions none,graph,stub] [--repeats 5] [--jobs 3] [--plan]
 *
 * --plan prints the runs it would start and starts none. A run whose results/<id>/meta.json says
 * "done" is not started again. At most 3 agents run at once. Work folders live under
 * $WHYGRAPH_EVAL_WORK (default /tmp/whygraph-eval) and are deleted after each run.
 */
import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, chmodSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readTasks } from './score.mjs';

const EVAL = fileURLToPath(new URL('./', import.meta.url));
const WHYGRAPH = join(EVAL, '..');
const RESULTS = join(EVAL, 'results');
const WORK = process.env.WHYGRAPH_EVAL_WORK ?? '/tmp/whygraph-eval';
const MEMOD_REPO = '/home/dev/scratch/whygraph-eval/memod-tasks';
const MODEL = 'sonnet';
const TIMEOUT_MS = 20 * 60 * 1000;
const QUIET = { RELATE_TELEMETRY: '0', DO_NOT_TRACK: '1' };
const GIT_ENV = {
  GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'eval', GIT_AUTHOR_EMAIL: 'eval@example.invalid', GIT_COMMITTER_NAME: 'eval', GIT_COMMITTER_EMAIL: 'eval@example.invalid',
};

/** The text every agent gets around a task's request; the same in every condition. */
const wrap = (request) => `A teammate sends you this request about the repository in the current folder:

${request}

Handle it as you would in a real session. Nobody will answer questions during this session, so end with a final reply that says what you did, or what you did not do and why. If your reply lists symbols, end it with a line \`SYMBOLS:\` and then one \`<file>:<symbol>\` per line, the file path from the repo root.`;

function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 28, ...opts, env: { ...process.env, ...QUIET, ...opts.env } });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed (${r.status}): ${r.stderr}`);
  return r.stdout;
}

function which(name) {
  return sh('bash', ['-c', `command -v ${name}`]).trim();
}

/**
 * The fixture repo with its decision records moved out: the history is rewritten without docs/adr
 * and decisions/, so neither the work tree nor git history holds them, and the records go to a
 * sibling folder with their commit ids mapped to the rewritten commits.
 * owns: [[whygraph-eval-runner]]
 */
export function fixtureTemplate() {
  const base = join(WORK, '_fixture');
  const repo = join(base, 'repo');
  const decisions = join(base, 'decisions');
  if (existsSync(join(base, 'ready'))) return { repo, decisions };
  rmSync(base, { recursive: true, force: true });
  mkdirSync(decisions, { recursive: true });
  const orig = join(base, 'orig');
  sh(join(WHYGRAPH, 'scripts/fixture.sh'), [orig]);
  const adrs = JSON.parse(sh(join(WHYGRAPH, 'bin/whygraph'), ['decisions', 'adr', 'docs/adr'], { cwd: orig }));
  const notes = JSON.parse(readFileSync(join(orig, 'decisions/notes.json'), 'utf8'));
  const subjectOf = (sha) => sh('git', ['log', '-1', '--format=%s', sha], { cwd: orig }).trim();
  const filtered = join(base, 'filtered');
  cpSync(orig, filtered, { recursive: true });
  sh('git', ['filter-branch', '-f', '--prune-empty', '--index-filter', 'git rm -r -q --cached --ignore-unmatch docs/adr decisions', '--', '--all'],
    { cwd: filtered, env: { ...GIT_ENV, FILTER_BRANCH_SQUELCH_WARNING: '1' } });
  // A clone holds only the rewritten commits; drop its remote and the reflog that names the source folder.
  sh('git', ['clone', '-q', '--no-local', filtered, repo], { env: GIT_ENV });
  sh('git', ['remote', 'remove', 'origin'], { cwd: repo, env: GIT_ENV });
  sh('git', ['reflog', 'expire', '--expire=now', '--all'], { cwd: repo, env: GIT_ENV });
  sh('git', ['gc', '-q', '--prune=now'], { cwd: repo, env: GIT_ENV });
  const newSha = new Map(sh('git', ['log', '--format=%H %s'], { cwd: repo }).trim().split('\n').map((l) => [l.slice(41), l.slice(0, 40)]));
  const remap = (records) => records.map((r) => ({ ...r, commits: (r.commits ?? []).map((c) => {
    const to = newSha.get(subjectOf(c));
    if (to === undefined) throw new Error(`no rewritten commit for ${c}`);
    return to;
  }) }));
  writeFileSync(join(decisions, 'adrs.json'), JSON.stringify({ records: remap(adrs.records) }, null, 2));
  writeFileSync(join(decisions, 'notes.json'), JSON.stringify({ records: remap(notes.records) }, null, 2));
  rmSync(orig, { recursive: true, force: true });
  rmSync(filtered, { recursive: true, force: true });
  writeFileSync(join(base, 'ready'), '');
  return { repo, decisions };
}

/**
 * The memod task repo with its dependencies installed, made once from the read-only clone: a copy
 * that `sfw pnpm install --frozen-lockfile` fills before any run starts, while the network is still
 * there, so agents can run memod and its test suite. node_modules/ and dist/ are git-ignored in
 * memod, so they stay out of every run's diff.
 * owns: [[whygraph-eval-runner]]
 */
export function memodTemplate() {
  const base = join(WORK, '_memod');
  const repo = join(base, 'repo');
  if (existsSync(join(base, 'ready'))) return repo;
  rmSync(base, { recursive: true, force: true });
  mkdirSync(base, { recursive: true });
  cpSync(MEMOD_REPO, repo, { recursive: true, verbatimSymlinks: true });
  sh('bash', ['-lc', 'sfw pnpm install --frozen-lockfile'], { cwd: repo });
  if (sh('git', ['status', '--porcelain'], { cwd: repo }).trim() !== '') throw new Error(`installing memod's dependencies changed tracked files in ${repo}`);
  writeFileSync(join(base, 'ready'), '');
  return repo;
}

/** An executable shell script at `path`. */
function wrapper(path, body) {
  writeFileSync(path, `#!/bin/sh\n${body}\n`);
  chmodSync(path, 0o755);
}

/** Single-quotes a string for sh. */
const q = (s) => `'${s.replaceAll("'", `'\\''`)}'`;

/**
 * Tools that only graph and stub runs see, outside every folder a run may see otherwise:
 * relate lives in ~/.local/bin, which runs do not see.
 */
function sharedTools() {
  const dir = join(WORK, '_tools');
  if (!existsSync(join(dir, 'relate'))) {
    mkdirSync(dir, { recursive: true });
    cpSync(which('relate'), join(dir, 'relate'));
  }
  return dir;
}

/**
 * The bwrap command line that confines one Bash command of a run: no network, the whole file
 * system read-only, only the repo copy and the run's temp folder writable, and the folders that
 * would leak config, credentials, ground truth, other runs or other tools hidden. Claude Code runs
 * every Bash command through it (CLAUDE_CODE_SHELL_PREFIX gets the command as its one argument);
 * its own sandbox cannot start on this box, where AppArmor restricts unprivileged user namespaces.
 * owns: [[whygraph-eval-runner]]
 */
export function confinement(condition, work) {
  const home = process.env.HOME;
  const hide = [
    join(home, '.claude'), join(home, '.optmem'), join(home, '.local/bin'), join(home, '.config/spec-ledger'),
    '/home/dev/scratch', '/home/dev/repos/personal/memod',
    ...(condition === 'none' ? [WHYGRAPH] : ['eval', 'scripts', 'test', 'test-results', 'docs', '.git'].map((d) => join(WHYGRAPH, d))),
  ];
  // One /tmp for every Bash call of the run, so a file a command leaves there is there for the next one.
  const args = ['bwrap', '--die-with-parent', '--unshare-net', '--ro-bind', '/', '/', '--dev', '/dev', '--proc', '/proc', '--bind', join(work, 'systmp'), '/tmp'];
  for (const d of hide) if (existsSync(d)) args.push('--tmpfs', d);
  for (const f of [join(home, '.claude.json'), ...(condition === 'none' ? [] : [join(WHYGRAPH, 'README.md')])]) if (existsSync(f)) args.push('--ro-bind', '/dev/null', f);
  // The CLI sources a snapshot of the login shell from here before each command.
  args.push('--ro-bind', join(home, '.claude/shell-snapshots'), join(home, '.claude/shell-snapshots'));
  args.push('--ro-bind', work, work, '--bind', join(work, 'repo'), join(work, 'repo'), '--bind', join(work, 'tmp'), join(work, 'tmp'));
  if (condition !== 'none') args.push('--ro-bind', sharedTools(), sharedTools());
  return args;
}

/**
 * Sets up one run's work folder: the repo copy, the condition's tools and instructions, and a
 * baseline snapshot of the work tree (in a git dir outside the repo) to diff against afterwards.
 * owns: [[whygraph-eval-runner]]
 */
export function prepare(task, condition, work) {
  rmSync(work, { recursive: true, force: true });
  mkdirSync(join(work, 'bin'), { recursive: true });
  mkdirSync(join(work, 'tmp'), { recursive: true });
  mkdirSync(join(work, 'systmp'), { recursive: true });
  const repo = join(work, 'repo');
  const fixture = task.repo === 'fixture' ? fixtureTemplate() : undefined;
  cpSync(fixture?.repo ?? memodTemplate(), repo, { recursive: true, verbatimSymlinks: true });
  const bin = join(work, 'bin');
  if (condition !== 'none') {
    // graph and stub share every tool and every line of instructions; only `whygraph` differs.
    wrapper(join(bin, 'memod'), `exec ${join(WHYGRAPH, 'node_modules/.bin/memod')} "$@"`);
    wrapper(join(bin, 'relate'), `exec ${join(sharedTools(), 'relate')} "$@"`);
    if (condition === 'graph') wrapper(join(bin, 'whygraph'), `export RELATE_TELEMETRY=0 DO_NOT_TRACK=1\nexec ${join(WHYGRAPH, 'bin/whygraph')} "$@"`);
    else wrapper(join(bin, 'whygraph'), 'echo "no result"\nexit 0');
    mkdirSync(join(repo, '.claude/skills'), { recursive: true });
    cpSync(join(WHYGRAPH, 'skills/whygraph'), join(repo, '.claude/skills/whygraph'), { recursive: true });
    appendFileSync(join(repo, 'CLAUDE.md'), readFileSync(join(WHYGRAPH, 'skills/whygraph-rule.md'), 'utf8'));
  }
  if (condition === 'graph') {
    const env = { PATH: `${bin}:${process.env.PATH}` };
    if (fixture) {
      sh(join(bin, 'whygraph'), ['build', '--decisions', join(fixture.decisions, 'adrs.json'), '--decisions', join(fixture.decisions, 'notes.json')], { cwd: repo, env });
    } else {
      const adrs = join(repo, '.git/whygraph-adrs.json');
      writeFileSync(adrs, sh(join(bin, 'whygraph'), ['decisions', 'adr', 'docs/adr'], { cwd: repo, env }));
      sh(join(bin, 'whygraph'), ['build', '--decisions', adrs], { cwd: repo, env });
    }
  }
  const base = ['--git-dir', join(work, 'baseline.git'), '--work-tree', repo];
  sh('git', ['init', '-q', '--bare', join(work, 'baseline.git')], { env: GIT_ENV });
  sh('git', [...base, 'add', '-A'], { env: GIT_ENV });
  sh('git', [...base, 'commit', '-q', '--allow-empty', '-m', 'baseline'], { env: GIT_ENV });
  const confine = join(work, 'confine.sh');
  wrapper(confine, `exec ${confinement(condition, work).map(q).join(' ')} -- /bin/bash -c "$1"`);
  return { repo, bin, base, confine };
}

/**
 * The flags and settings that give a run a clean config: project settings only (the repo's own
 * CLAUDE.md and .claude/skills), no user settings, hooks, plugins or MCP servers, no auto memory,
 * file tools allowed only inside the repo copy and denied the listed folders. Bash is allowed
 * because every command runs inside `confinement` (see agentEnv), not in Claude Code's sandbox.
 * owns: [[whygraph-eval-runner]]
 */
export function agentCommand(prompt, repo, denyRead, debugFile) {
  const settings = {
    disableAllHooks: true,
    permissions: {
      defaultMode: 'dontAsk',
      allow: ['Bash', `Read(/${repo}/**)`, `Edit(/${repo}/**)`, `Write(/${repo}/**)`],
      deny: ['WebFetch', 'WebSearch', ...denyRead.map((p) => `Read(/${p}/**)`)],
    },
    sandbox: { enabled: false },
  };
  return [
    '-p', prompt,
    '--model', MODEL,
    '--output-format', 'stream-json', '--verbose',
    '--setting-sources', 'project',
    '--settings', JSON.stringify(settings),
    '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
    '--tools', 'Bash,Read,Edit,Write,Glob,Grep',
    '--permission-mode', 'dontAsk', '--permission-prompts', 'none',
    '--no-session-persistence',
    '--debug-file', debugFile,
  ];
}

/**
 * The environment of an agent: no variable of this session, PATH with the condition's tools first,
 * every Bash command run through the run's confine.sh, and the CLI's temp files in the run's tmp/.
 */
function agentEnv(bin, confine, tmp) {
  const keep = ['HOME', 'USER', 'LOGNAME', 'LANG', 'LC_ALL', 'SHELL', 'TERM', 'XDG_RUNTIME_DIR'];
  const env = Object.fromEntries(keep.filter((k) => process.env[k] !== undefined).map((k) => [k, process.env[k]]));
  return {
    ...env, ...QUIET,
    PATH: `${bin}:/usr/local/bin:/usr/bin:/bin`,
    CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1',
    DISABLE_AUTOUPDATER: '1',
    CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY: '1',
    CLAUDE_CODE_SHELL_PREFIX: confine,
    CLAUDE_CODE_TMPDIR: tmp,
  };
}

/** The tool calls of a stream-json transcript, each with its result text (cut at 4000 characters). */
function toolCalls(events) {
  const calls = [];
  const byId = new Map();
  for (const e of events) {
    for (const c of e.message?.content ?? []) {
      if (e.type === 'assistant' && c.type === 'tool_use') {
        const call = { name: c.name, input: c.input, result: undefined, error: false };
        calls.push(call);
        byId.set(c.id, call);
      }
      if (e.type === 'user' && c.type === 'tool_result' && byId.has(c.tool_use_id)) {
        const text = typeof c.content === 'string' ? c.content : (c.content ?? []).map((x) => x.text ?? '').join('\n');
        Object.assign(byId.get(c.tool_use_id), { result: text.slice(0, 4000), error: c.is_error === true });
      }
    }
  }
  return calls;
}

function runAgent(args, cwd, env, outFile) {
  return new Promise((done) => {
    const started = Date.now();
    const child = spawn(which('claude'), args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; appendFileSync(outFile, d); });
    child.stderr.on('data', (d) => { stderr += d; });
    const timer = setTimeout(() => child.kill('SIGTERM'), TIMEOUT_MS);
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      done({ code, signal, stdout, stderr, wallMs: Date.now() - started });
    });
  });
}

/**
 * Runs one (task, condition, repeat) and writes its results folder; meta.json is written last.
 * owns: [[whygraph-eval-runner]]
 */
export async function runOne(task, condition, repeat, allIds) {
  const id = `${task.id}__${condition}__r${repeat}`;
  const out = join(RESULTS, id);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const work = join(WORK, id);
  const { repo, bin, base, confine } = prepare(task, condition, work);
  const env = agentEnv(bin, confine, join(work, 'tmp'));
  const denyRead = [
    join(process.env.HOME, '.claude'), join(process.env.HOME, '.claude.json'), join(process.env.HOME, '.optmem'),
    join(process.env.HOME, '.config/spec-ledger'), '/home/dev/scratch', '/home/dev/repos/personal/memod',
    EVAL, join(WHYGRAPH, 'scripts'), join(WHYGRAPH, 'test'), join(WHYGRAPH, 'test-results'), join(WHYGRAPH, 'docs'),
    join(WHYGRAPH, 'README.md'), join(WHYGRAPH, '.git'), join(WORK, '_fixture'),
    ...allIds.filter((o) => o !== id).map((o) => join(WORK, o)),
  ];
  const prompt = wrap(task.request);
  writeFileSync(join(out, 'prompt.txt'), prompt);
  const args = agentCommand(prompt, repo, denyRead, join(out, 'debug.log'));
  writeFileSync(join(out, 'command.json'), JSON.stringify({ cwd: repo, args, env, confine: readFileSync(confine, 'utf8') }, null, 2));
  const r = await runAgent(args, repo, env, join(out, 'output.jsonl'));
  const events = r.stdout.split('\n').filter((l) => l.trim() !== '').flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
  const result = events.findLast((e) => e.type === 'result');
  const init = events.find((e) => e.type === 'system' && e.subtype === 'init');
  const tools = toolCalls(events);
  sh('git', [...base, 'add', '-A'], { env: GIT_ENV });
  const diff = sh('git', [...base, 'diff', '--cached', 'HEAD'], { env: GIT_ENV });
  writeFileSync(join(out, 'final.txt'), result?.result ?? '');
  writeFileSync(join(out, 'diff.patch'), diff);
  writeFileSync(join(out, 'tools.json'), JSON.stringify(tools, null, 2));
  writeFileSync(join(out, 'stderr.txt'), r.stderr);
  const u = result?.usage ?? {};
  const tokens = {
    input: u.input_tokens ?? 0, output: u.output_tokens ?? 0,
    cache_read: u.cache_read_input_tokens ?? 0, cache_creation: u.cache_creation_input_tokens ?? 0,
  };
  tokens.total = tokens.input + tokens.output + tokens.cache_read + tokens.cache_creation;
  const ok = r.code === 0 && result !== undefined && result.subtype === 'success';
  const meta = {
    id, task: task.id, condition, repeat, model: MODEL, status: ok ? 'done' : 'error',
    exit: r.code, signal: r.signal, wall_ms: r.wallMs, api_ms: result?.duration_api_ms, turns: result?.num_turns,
    cost_usd: result?.total_cost_usd, tokens, model_usage: result?.modelUsage,
    init: init && { model: init.model, tools: init.tools, mcp_servers: init.mcp_servers, skills: init.skills, slash_commands: init.slash_commands, plugins: init.plugins, agents: init.agents, permissionMode: init.permissionMode, cwd: init.cwd },
  };
  writeFileSync(join(out, 'meta.json'), JSON.stringify(meta, null, 2));
  rmSync(work, { recursive: true, force: true });
  return meta;
}

function option(argv, name, fallback) {
  const at = argv.indexOf(name);
  return at >= 0 ? argv[at + 1] : fallback;
}

async function main(argv) {
  const tasks = readTasks();
  const only = option(argv, '--only', undefined)?.split(',');
  const conditions = option(argv, '--conditions', 'none,graph,stub').split(',');
  const repeats = Number(option(argv, '--repeats', '5'));
  const jobs = Math.min(3, Number(option(argv, '--jobs', '3')));
  for (const c of conditions) if (!['none', 'graph', 'stub'].includes(c)) throw new Error(`unknown condition ${c}`);
  for (const t of only ?? []) if (!tasks.has(t)) throw new Error(`unknown task ${t}`);
  const plan = [];
  for (const t of tasks.values()) {
    if (only && !only.includes(t.id)) continue;
    for (let r = 1; r <= repeats; r++) for (const c of conditions) plan.push({ task: t, condition: c, repeat: r, id: `${t.id}__${c}__r${r}` });
  }
  const isDone = (p) => {
    const m = join(RESULTS, p.id, 'meta.json');
    return existsSync(m) && JSON.parse(readFileSync(m, 'utf8')).status === 'done';
  };
  const todo = plan.filter((p) => !isDone(p));
  console.log(`${plan.length} runs planned, ${plan.length - todo.length} already done, ${todo.length} to start`);
  if (argv.includes('--plan')) {
    for (const p of todo) console.log(`  ${p.id}`);
    return 0;
  }
  const allIds = plan.map((p) => p.id);
  let next = 0;
  let failed = 0;
  const worker = async () => {
    while (next < todo.length) {
      const p = todo[next++];
      console.log(`start ${p.id}`);
      const m = await runOne(p.task, p.condition, p.repeat, allIds);
      if (m.status !== 'done') failed++;
      console.log(`${m.status.padEnd(5)} ${p.id}  ${Math.round(m.wall_ms / 1000)}s  ${m.tokens.total} tokens`);
    }
  };
  await Promise.all(Array.from({ length: jobs }, worker));
  return failed === 0 ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = await main(process.argv.slice(2));

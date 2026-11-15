#!/usr/bin/env node
/**
 * module: [[whygraph-eval-runner]]
 * Runs the eval: one headless agent per (task, condition, repeat), each in a fresh copy
 * of its task repo, and saves what it did under eval/results/<run id>/.
 *
 *   node eval/run.mjs [--only <task id>[,<task id>...]] [--conditions none,graph,stub] [--repeats 5] [--jobs 3] [--plan]
 *   node eval/run.mjs --reextract   # rewrites final.txt and meta.json of every saved run from its output.jsonl
 *
 * --plan prints the runs it would start and starts none. A run whose results/<id>/meta.json says
 * "done" is not started again. At most 3 agents run at once. Work folders live under
 * $WHYGRAPH_EVAL_WORK (default /var/tmp/whygraph-eval) and are deleted after each run.
 */
import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, chmodSync, closeSync, cpSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readTasks } from './score.mjs';
import { randomUUID } from 'node:crypto';
import { evalBatch, ticketRepo, evalRegistry } from './registry.mjs';

const EVAL = fileURLToPath(new URL('./', import.meta.url));
const WHYGRAPH = join(EVAL, '..');
const RESULTS = join(EVAL, 'results');
// On disk, not in /tmp: /tmp is an 8 GB tmpfs on this box, and three memoryd copies with their snapshots do not fit in it.
const WORK = process.env.WHYGRAPH_EVAL_WORK ?? '/var/tmp/whygraph-eval';
const MEMOD_REPO = '/home/dev/scratch/whygraph-eval/tasks2/memod';
const MEMORYD_REPO = '/home/dev/scratch/whygraph-eval/tasks2/memoryd';
/**
 * ADR files left out of a repo's decisions file. memoryd numbers two test contracts like the ADRs they
 * test (0038, 0039); `whygraph decisions adr` makes both files of a number one id, and `build` rejects
 * the duplicates (docs/failures.md D17, open). They are failure lists, not decisions, and no task cites them.
 */
const LEFT_OUT_ADRS = { memoryd: ['docs/adr/0038-mem-recap-failures.md', 'docs/adr/0039-layer2-failures.md'] };
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

/**
 * The memoryd task repo, copied once from the read-only clone. Its dependencies are not installed:
 * its package.json depends on `bend-boundary` as `file:../bend-boundary`, a folder the clone does not
 * have, so `sfw bun install --frozen-lockfile` fails. Every condition gets the same uninstalled copy.
 * owns: [[whygraph-eval-runner]]
 */
export function memorydTemplate() {
  const base = join(WORK, '_memoryd');
  const repo = join(base, 'repo');
  if (existsSync(join(base, 'ready'))) return repo;
  rmSync(base, { recursive: true, force: true });
  mkdirSync(base, { recursive: true });
  cpSync(MEMORYD_REPO, repo, { recursive: true, verbatimSymlinks: true });
  if (sh('git', ['status', '--porcelain'], { cwd: repo }).trim() !== '') throw new Error(`the memoryd copy in ${repo} is not clean`);
  writeFileSync(join(base, 'ready'), '');
  return repo;
}

/**
 * A registered ticket repo and its store, built once outside the repo so none and stub copies have no
 * store. No dependency install or cargo build. A graph run copies the resolved store directory.
 * owns: [[whygraph-eval-runner]]
 */
export function ticketTemplate(name, requireReady = false) {
  const config = evalRegistry.repos[name];
  if (!config) throw new Error(`unknown ticket repo ${name}`);
  const base = join(WORK, `_${config.name}`);
  const repo = join(base, 'repo');
  const store = join(base, 'store');
  if (existsSync(join(base, 'ready'))) {
    if (!existsSync(repo) || !existsSync(store)) throw new Error(`ready ${config.name} template or store is missing`);
    return { repo, store };
  }
  if (requireReady) throw new Error(`requires the ready ${config.name} template and store; do not rebuild`);
  mkdirSync(base, { recursive: true });
  if (!existsSync(repo)) cpSync(config.source, repo, { recursive: true, verbatimSymlinks: true });
  if (sh('git', ['status', '--porcelain'], { cwd: repo }).trim() !== '') throw new Error(`the ${config.name} copy in ${repo} is not clean`);
  if (existsSync(join(repo, '.git/whygraph'))) throw new Error(`the ${config.name} template repo must have no store: ${repo}`);
  const started = Date.now();
  sh(join(WHYGRAPH, 'bin/whygraph'), ['build', '--decisions', config.decisions, '--store', store], {
    cwd: repo, env: { PATH: `${join(WHYGRAPH, 'node_modules/.bin')}:${process.env.PATH}` },
  });
  writeFileSync(join(base, 'build.json'), JSON.stringify({ build_ms: Date.now() - started }, null, 2));
  writeFileSync(join(base, 'ready'), '');
  return { repo, store };
}

/** The template a task's repo is copied from. */
function template(task) {
  if (task.repo === 'fixture') return fixtureTemplate().repo;
  if (task.repo === 'memod') return memodTemplate();
  if (task.repo === 'memoryd') return memorydTemplate();
  if (ticketRepo(task)) return ticketTemplate(task.repo, evalBatch(task.batch).agent === 'opencode').repo;
  throw new Error(`task ${task.id}: unknown repo ${task.repo}`);
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
export function confinement(condition, work, agent = 'claude') {
  const home = process.env.HOME;
  const hide = [
    ...(agent === 'opencode' ? [join(process.env.XDG_DATA_HOME ?? join(home, '.local/share'), 'opencode'), join(home, '.config/opencode'), join(home, '.opencode'), join(home, '.agents')] : []),
    join(home, '.claude'), join(home, '.optmem'), join(home, '.local/bin'), join(home, '.config/spec-ledger'),
    '/home/dev/scratch', '/home/dev/repos/personal/memod',
    ...(condition === 'none' ? [WHYGRAPH] : ['eval', 'scripts', 'test', 'test-results', 'docs', '.git'].map((d) => join(WHYGRAPH, d))),
  ];
  // One /tmp for every Bash call of the run, so a file a command leaves there is there for the next one.
  // WORK is hidden whole (other runs, the templates); this run's folder and the shared tools are mounted back below.
  const args = ['bwrap', '--die-with-parent', '--unshare-net', '--ro-bind', '/', '/', '--tmpfs', WORK, '--dev', '/dev', '--proc', '/proc', '--bind', join(work, 'systmp'), '/tmp'];
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
export function prepare(task, condition, work, source) {
  const batch = evalBatch(task.batch);
  const agent = batch.agent;
  const registered = ticketRepo(task);
  if (!batch.conditions.includes(condition)) throw new Error(`batch ${task.batch ?? 1}: condition ${condition} is not run`);
  if (agent === 'opencode' && !source) ticketTemplate(task.repo, true);
  rmSync(work, { recursive: true, force: true });
  mkdirSync(join(work, 'bin'), { recursive: true });
  mkdirSync(join(work, 'tmp'), { recursive: true });
  mkdirSync(join(work, 'systmp'), { recursive: true });
  const repo = join(work, 'repo');
  const fixture = task.repo === 'fixture' ? fixtureTemplate() : undefined;
  cpSync(source?.repo ?? template(task), repo, { recursive: true, verbatimSymlinks: true });
  const bin = join(work, 'bin');
  if (condition !== 'none') {
    // graph and stub share every tool and every line of instructions; only `whygraph` differs.
    wrapper(join(bin, 'memod'), `exec ${join(WHYGRAPH, 'node_modules/.bin/memod')} "$@"`);
    wrapper(join(bin, 'relate'), `exec ${join(sharedTools(), 'relate')} "$@"`);
    if (condition === 'graph' || condition === 'graph-nosearch') wrapper(join(bin, 'whygraph'), `export RELATE_TELEMETRY=0 DO_NOT_TRACK=1\n${condition === 'graph-nosearch' ? 'if [ "$1" = search ]; then echo "no result"; exit 0; fi\n' : ''}exec ${join(WHYGRAPH, 'bin/whygraph')} "$@"`);
    else wrapper(join(bin, 'whygraph'), 'echo "no result"\nexit 0');
    const skillDir = agent === 'opencode' ? '.opencode/skills' : '.claude/skills';
    mkdirSync(join(repo, skillDir), { recursive: true });
    cpSync(join(WHYGRAPH, 'skills/whygraph'), join(repo, skillDir, 'whygraph'), { recursive: true });
    appendFileSync(join(repo, agent === 'opencode' ? 'AGENTS.md' : 'CLAUDE.md'), readFileSync(join(WHYGRAPH, 'skills/whygraph-rule.md'), 'utf8'));
  }
  if (condition === 'graph' || condition === 'graph-nosearch') {
    const env = { PATH: `${bin}:${process.env.PATH}` };
    if (registered || source?.store) {
      const dir = join(repo, '.git/whygraph');
      mkdirSync(dir, { recursive: true });
      cpSync(realpathSync(source?.store ?? ticketTemplate(task.repo, agent === 'opencode').store), join(dir, 'ticket-store'), { recursive: true, verbatimSymlinks: true });
      symlinkSync('ticket-store', join(dir, 'store'));
    } else if (fixture) {
      sh(join(bin, 'whygraph'), ['build', '--decisions', join(fixture.decisions, 'adrs.json'), '--decisions', join(fixture.decisions, 'notes.json')], { cwd: repo, env });
    } else {
      const adrs = join(repo, '.git/whygraph-adrs.json');
      const made = JSON.parse(sh(join(bin, 'whygraph'), ['decisions', 'adr', 'docs/adr'], { cwd: repo, env }));
      const records = made.records.filter((r) => !(LEFT_OUT_ADRS[task.repo] ?? []).includes(r.source));
      writeFileSync(adrs, JSON.stringify({ ...made, records }, null, 2));
      sh(join(bin, 'whygraph'), ['build', '--decisions', adrs], { cwd: repo, env });
    }
  }
  const base = ['--git-dir', join(work, 'baseline.git'), '--work-tree', repo];
  sh('git', ['init', '-q', '--bare', join(work, 'baseline.git')], { env: GIT_ENV });
  sh('git', [...base, 'add', '-A'], { env: GIT_ENV });
  sh('git', [...base, 'commit', '-q', '--allow-empty', '-m', 'baseline'], { env: GIT_ENV });
  const confine = join(work, 'confine.sh');
  wrapper(confine, `${agent === 'opencode' ? `export HOME=${q(process.env.HOME)}\nif [ "$1" = -c ]; then shift; fi\n` : ''}exec ${confinement(condition, work, agent).map(q).join(' ')} -- /bin/bash -c "$1"`);
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
    // A background command wakes the agent again after its answer; runs after the full run's first pass have none.
    CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: '1',
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

/**
 * What a session told the user and what it cost, from its stream-json events. A session can end more
 * than once: a background command that finishes wakes the agent, which replies again. The final
 * message is every reply, in order; tokens and turns are summed over the result events (each counts
 * its own part); cost and API time are the last event's, which already total the session.
 * owns: [[whygraph-eval-runner]]
 */
export function sessionSummary(events) {
  const results = events.filter((e) => e.type === 'result');
  const last = results.at(-1);
  const tokens = { input: 0, output: 0, cache_read: 0, cache_creation: 0 };
  for (const r of results) {
    const u = r.usage ?? {};
    tokens.input += u.input_tokens ?? 0;
    tokens.output += u.output_tokens ?? 0;
    tokens.cache_read += u.cache_read_input_tokens ?? 0;
    tokens.cache_creation += u.cache_creation_input_tokens ?? 0;
  }
  tokens.total = tokens.input + tokens.output + tokens.cache_read + tokens.cache_creation;
  return {
    final: results.map((r) => r.result ?? '').join('\n\n'),
    replies: results.length,
    success: last !== undefined && last.subtype === 'success',
    tokens,
    cost_usd: last?.total_cost_usd,
    api_ms: last?.duration_api_ms,
    turns: results.reduce((a, r) => a + (r.num_turns ?? 0), 0),
    model_usage: last?.modelUsage,
  };
}

function readEvents(text) {
  return text.split('\n').filter((l) => l.trim() !== '').flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
}

/**
 * Runs the agent with its stdout and stderr opened straight onto files, read once it has closed. The
 * runner blocks its event loop for tens of seconds while it copies and snapshots memoryd for another
 * run; through a pipe, an agent that exited in that window lost the end of its stream (the result line).
 */
function runAgent(args, cwd, env, outFile, errFile, agent = 'claude') {
  return new Promise((done) => {
    const started = Date.now();
    const out = openSync(outFile, 'w');
    const err = openSync(errFile, 'w');
    const child = spawn(which(agent), args, { cwd, env, stdio: ['ignore', out, err] });
    closeSync(out);
    closeSync(err);
    let timedOut = false;
    let killTimer;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      if (agent === 'opencode') killTimer = setTimeout(() => child.kill('SIGKILL'), 5000);
    }, TIMEOUT_MS);
    let spawnError;
    child.on('error', error => { spawnError = error.message; });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      done({ code, signal, timedOut, spawnError, stdout: readFileSync(outFile, 'utf8'), stderr: readFileSync(errFile, 'utf8'), wallMs: Date.now() - started });
    });
  });
}

function archiveResult(out, group) {
  const dest = join(RESULTS, group, `${out.split('/').at(-1)}__${Date.now()}__${randomUUID()}`);
  mkdirSync(join(RESULTS, group), { recursive: true });
  renameSync(out, dest);
  return dest;
}

function invalidRun(out, work, meta, details, reason = 'isolation breach') {
  // Keep the evidence and work copy; neither a retry nor the scorer can mistake it for a result.
  const keptWork = existsSync(work) ? `${work}__invalid__${randomUUID()}` : undefined;
  if (keptWork) renameSync(work, keptWork);
  Object.assign(meta, { status: 'invalid', reason, isolation: details, work: keptWork });
  writeFileSync(join(out, 'meta.json'), JSON.stringify(meta, null, 2));
  const archived = archiveResult(out, '_invalid');
  return { ...meta, archived };
}

/**
 * Runs one (task, condition, repeat) and writes its results folder; meta.json is written last.
 * owns: [[whygraph-eval-runner]]
 */
export async function runOne(task, condition, repeat, allIds) {
  const id = `${task.id}__${condition}__r${repeat}`;
  const out = join(RESULTS, id);
  const opencode = evalBatch(task.batch).agent === 'opencode' ? await import('./opencode.mjs') : undefined;
  if (opencode && existsSync(out)) archiveResult(out, '_attempts');
  else rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const work = join(WORK, id);
  const { repo, bin, base, confine } = prepare(task, condition, work);
  if (opencode) {
    const escaped = opencode.escapingSymlinks(repo);
    if (escaped.length) return invalidRun(out, work, {
      id, task: task.id, condition, repeat, agent: 'opencode', model: opencode.OPENCODE_MODEL,
      phase: 'preflight', wall_ms: 0, tokens: { total: 0 },
    }, escaped);
    if (sh(which('opencode'), ['--version']).trim() !== '1.18.29') throw new Error(`batch ${task.batch} requires opencode 1.18.29`);
  }
  const launch = opencode ? opencode.opencodeLaunch(wrap(task.request), repo, bin, confine, work) : undefined;
  const env = launch?.env ?? agentEnv(bin, confine, join(work, 'tmp'));
  const denyRead = [
    join(process.env.HOME, '.claude'), join(process.env.HOME, '.claude.json'), join(process.env.HOME, '.optmem'),
    join(process.env.HOME, '.config/spec-ledger'), '/home/dev/scratch', '/home/dev/repos/personal/memod',
    EVAL, join(WHYGRAPH, 'scripts'), join(WHYGRAPH, 'test'), join(WHYGRAPH, 'test-results'), join(WHYGRAPH, 'docs'),
    join(WHYGRAPH, 'README.md'), join(WHYGRAPH, '.git'), join(WORK, '_fixture'),
    ...allIds.filter((o) => o !== id).map((o) => join(WORK, o)),
  ];
  const prompt = wrap(task.request);
  writeFileSync(join(out, 'prompt.txt'), prompt);
  const args = launch?.args ?? agentCommand(prompt, repo, denyRead, join(out, 'debug.log'));
  writeFileSync(join(out, 'command.json'), JSON.stringify({ cwd: repo, args, env, confine: readFileSync(confine, 'utf8') }, null, 2));
  const r = await runAgent(args, repo, env, join(out, 'output.jsonl'), join(out, 'stderr.txt'), launch?.agent);
  const events = readEvents(r.stdout);
  const session = launch ? opencode.opencodeSession(events) : sessionSummary(events);
  const init = events.find((e) => e.type === 'system' && e.subtype === 'init');
  const tools = session.tools ?? toolCalls(events);
  writeFileSync(join(out, 'final.txt'), session.final);
  writeFileSync(join(out, 'tools.json'), JSON.stringify(tools, null, 2));
  const meta = {
    id, task: task.id, condition, repeat, ...(launch ? { agent: launch.agent } : {}), model: launch?.model ?? MODEL,
    status: r.code === 0 && session.success && !(launch && r.timedOut) ? 'done' : 'error',
    exit: r.code, signal: r.signal, wall_ms: r.wallMs, api_ms: session.api_ms, turns: session.turns, replies: session.replies,
    cost_usd: session.cost_usd, tokens: session.tokens, model_usage: session.model_usage,
    ...(launch ? { timed_out: r.timedOut, spawn_error: r.spawnError } : {}),
    init: init && { model: init.model, tools: init.tools, mcp_servers: init.mcp_servers, skills: init.skills, slash_commands: init.slash_commands, plugins: init.plugins, agents: init.agents, permissionMode: init.permissionMode, cwd: init.cwd },
  };
  if (opencode) {
    const breaches = opencode.isolationBreaches(repo, tools);
    if (breaches.length) return invalidRun(out, work, meta, breaches);
    const malformed = r.stdout.split('\n').filter(line => line.trim()).some(line => {
      try { JSON.parse(line); return false; } catch { return true; }
    });
    if (malformed && !r.timedOut) return invalidRun(out, work, meta, [], 'harness failure: malformed JSONL');
    if (r.spawnError) {
      return invalidRun(out, work, meta, [], `harness failure: ${r.spawnError}`);
    }
  }
  sh('git', [...base, 'add', '-A'], { env: GIT_ENV });
  const diff = sh('git', [...base, 'diff', '--cached', 'HEAD'], { env: GIT_ENV });
  writeFileSync(join(out, 'diff.patch'), diff);
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
  const chosenConditions = option(argv, '--conditions', undefined)?.split(',');
  const repeats = Number(option(argv, '--repeats', '5'));
  const jobs = Math.min(3, Number(option(argv, '--jobs', '3')));
  for (const c of chosenConditions ?? []) if (!['none', 'graph', 'stub', 'graph-nosearch'].includes(c)) throw new Error(`unknown condition ${c}`);
  for (const t of only ?? []) if (!tasks.has(t)) throw new Error(`unknown task ${t}`);
  const plan = [];
  for (const t of tasks.values()) {
    if (only && !only.includes(t.id)) continue;
    ticketRepo(t);
    const batch = evalBatch(t.batch);
    const conditions = chosenConditions ?? batch.conditions;
    for (const condition of conditions) if (!batch.conditions.includes(condition)) throw new Error(`batch ${t.batch ?? 1}: condition ${condition} is not run`);
    for (let r = 1; r <= repeats; r++) for (const c of conditions) plan.push({ task: t, condition: c, repeat: r, id: `${t.id}__${c}__r${r}` });
  }
  if (argv.includes('--reextract')) {
    // Rewrites final.txt and the session fields of meta.json of every saved run from its output.jsonl.
    let n = 0;
    for (const id of readdirSync(RESULTS)) {
      const dir = join(RESULTS, id);
      if (!existsSync(join(dir, 'output.jsonl')) || !existsSync(join(dir, 'meta.json'))) continue;
      const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'));
      if (meta.status === 'invalid') continue;
      const events = readEvents(readFileSync(join(dir, 'output.jsonl'), 'utf8'));
      const session = meta.agent === 'opencode' ? (await import('./opencode.mjs')).opencodeSession(events) : sessionSummary(events);
      if (session.tools) writeFileSync(join(dir, 'tools.json'), JSON.stringify(session.tools, null, 2));
      writeFileSync(join(dir, 'final.txt'), session.final);
      Object.assign(meta, {
        status: meta.exit === 0 && session.success && !meta.timed_out ? 'done' : 'error',
        api_ms: session.api_ms, turns: session.turns, replies: session.replies,
        cost_usd: session.cost_usd, tokens: session.tokens, model_usage: session.model_usage,
      });
      writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
      n++;
    }
    console.log(`re-extracted ${n} runs`);
    return 0;
  }
  const isDone = (p) => {
    const m = join(RESULTS, p.id, 'meta.json');
    if (!existsSync(m)) return false;
    const meta = JSON.parse(readFileSync(m, 'utf8'));
    return meta.status === 'done' || (evalBatch(p.task.batch).agent === 'opencode' && meta.unscored === true);
  };
  const todo = plan.filter((p) => !isDone(p));
  console.log(`${plan.length} runs planned, ${plan.length - todo.length} already done, ${todo.length} to start`);
  if (argv.includes('--plan')) {
    for (const p of todo) console.log(`  ${p.id}`);
    if (plan.some(p => evalBatch(p.task.batch).agent === 'claude')) console.error('Agent: Claude Code (claude --model sonnet)');
    if (plan.some(p => evalBatch(p.task.batch).agent === 'opencode')) console.error(`Agent: opencode --model ${(await import('./opencode.mjs')).OPENCODE_MODEL}`);
    return 0;
  }
  const allIds = plan.map((p) => p.id);
  let next = 0;
  let failed = 0;
  const worker = async () => {
    while (next < todo.length) {
      const p = todo[next++];
      console.log(`start ${p.id}`);
      let m = await runOne(p.task, p.condition, p.repeat, allIds);
      if (evalBatch(p.task.batch).agent === 'opencode') {
        if (m.status === 'invalid') {
          const firstReason = m.reason;
          console.error(`invalid ${p.id}: ${m.reason}; archived ${m.archived}; retrying once`);
          m = await runOne(p.task, p.condition, p.repeat, allIds);
          if (m.status === 'invalid') {
            if (firstReason !== 'isolation breach' || m.reason !== 'isolation breach') throw new Error(`repeated harness failure ${p.id}: ${m.reason}; archived ${m.archived}`);
            // Both invalid attempts stay archived. This marker alone makes the cell
            // resumable and visible in the existing unscored/sensitivity reports.
            m = { ...m, status: 'error', unscored: true, timed_out: false };
            mkdirSync(join(RESULTS, p.id), { recursive: true });
            writeFileSync(join(RESULTS, p.id, 'meta.json'), JSON.stringify(m, null, 2));
          }
        }
        if (m.timed_out) {
          console.error(`timeout ${p.id}; retrying once`);
          m = await runOne(p.task, p.condition, p.repeat, allIds);
          if (m.status === 'invalid') throw new Error(`harness failure on timeout retry ${p.id}: ${m.reason}; archived ${m.archived}`);
          if (m.timed_out) {
            m.unscored = true;
            writeFileSync(join(RESULTS, p.id, 'meta.json'), JSON.stringify(m, null, 2));
          }
        }
      }
      if (m.status !== 'done') failed++;
      console.log(`${m.status.padEnd(5)} ${p.id}  ${Math.round(m.wall_ms / 1000)}s  ${m.tokens.total} tokens`);
    }
  };
  await Promise.all(Array.from({ length: jobs }, worker));
  return failed === 0 ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = await main(process.argv.slice(2));

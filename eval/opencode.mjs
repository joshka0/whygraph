/**
 * module: [[whygraph-opencode-launcher]]
 * The batch 5 launch configuration and JSONL reader. No credential values are read here.
 */
import { lstatSync, mkdirSync, readdirSync, readlinkSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

/** owns: [[whygraph-opencode-launcher]] */
export const OPENCODE_MODEL = 'opencode-go/deepseek-v4.1-flash';

/** Clean user configuration, explicit tool permissions, and the condition's confined shell.
 * owns: [[whygraph-opencode-launcher]]
 */
export function opencodeLaunch(prompt, repo, bin, confine, work) {
  const home = join(work, 'home');
  const configHome = join(work, 'config');
  const cacheHome = join(work, 'cache');
  const stateHome = join(work, 'state');
  for (const path of [home, configHome, cacheHome, stateHome]) mkdirSync(path, { recursive: true });
  const config = {
    autoupdate: false, share: 'disabled', snapshot: false,
    plugin: [], mcp: {}, instructions: [], formatter: false, lsp: false,
    enabled_providers: ['opencode-go'],
    permission: {
      '*': 'deny', bash: 'allow', skill: 'allow',
      read: 'allow', edit: 'allow', glob: 'allow', grep: 'allow',
      external_directory: {
        '*': 'deny',
        // An exact denial prevents opencode appending its built-in tool-output allowance.
        [join(process.env.XDG_DATA_HOME ?? join(process.env.HOME, '.local/share'), 'opencode/tool-output/*')]: 'deny',
      },
      webfetch: 'deny', websearch: 'deny', task: 'deny', question: 'deny',
    },
  };
  return {
    agent: 'opencode', model: OPENCODE_MODEL,
    args: ['run', '--pure', '--auto', '--format', 'json', '-m', OPENCODE_MODEL, prompt],
    env: {
      HOME: home, USER: process.env.USER ?? 'dev', LANG: process.env.LANG ?? 'C.UTF-8',
      PATH: `${bin}:/usr/local/bin:/usr/bin:/bin`, SHELL: confine,
      XDG_CONFIG_HOME: configHome, XDG_CACHE_HOME: cacheHome, XDG_STATE_HOME: stateHome,
      // Only the CLI authenticates here. The shell hides it; direct file reads are denied.
      XDG_DATA_HOME: process.env.XDG_DATA_HOME ?? join(process.env.HOME, '.local/share'),
      OPENCODE_CONFIG_DIR: join(configHome, 'opencode'),
      OPENCODE_CONFIG_CONTENT: JSON.stringify(config),
      OPENCODE_DISABLE_CLAUDE_CODE: '1', OPENCODE_DISABLE_EXTERNAL_SKILLS: '1',
      OPENCODE_DISABLE_AUTOUPDATE: '1', OPENCODE_DISABLE_LSP_DOWNLOAD: '1',
      OPENCODE_DISABLE_SHARE: '1',
      RELATE_TELEMETRY: '0', DO_NOT_TRACK: '1',
    },
  };
}

/** The reader's final message, tool log and session totals from native opencode events.
 * owns: [[whygraph-opencode-launcher]]
 */
export function opencodeSession(events) {
  const finishes = events.filter(e => e.type === 'step_finish');
  const texts = events.filter(e => e.type === 'text').map(e => e.part?.text ?? '');
  const tokens = { input: 0, output: 0, reasoning: 0, cache_read: 0, cache_creation: 0, total: 0 };
  let cost = 0;
  for (const e of finishes) {
    const t = e.part?.tokens ?? {};
    tokens.input += t.input ?? 0;
    tokens.output += t.output ?? 0;
    tokens.reasoning += t.reasoning ?? 0;
    tokens.cache_read += t.cache?.read ?? 0;
    tokens.cache_creation += t.cache?.write ?? 0;
    tokens.total += t.total ?? 0;
    cost += e.part?.cost ?? 0;
  }
  const tools = events.filter(e => e.type === 'tool_use').map(e => {
    const p = e.part ?? {}, state = p.state ?? {};
    const output = state.output ?? state.error ?? '';
    return {
      name: ['bash', 'shell'].includes(p.tool) ? 'Bash' : p.tool,
      input: state.input ?? {}, result: String(output).slice(0, 4000),
      error: state.status === 'error',
    };
  });
  const last = finishes.at(-1);
  return {
    final: texts.join('\n\n'), replies: texts.length, turns: finishes.length,
    success: texts.some(t => t.trim() !== '') && last?.part?.reason === 'stop' && !events.some(e => e.type === 'error'),
    tokens, cost_usd: cost, tools,
  };
}

const inside = (repo, path) => {
  const rel = relative(repo, resolve(path));
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
};

// Resolve existing ancestors too: a dangling link can still point outside the repo.
function resolvedTarget(path) {
  try { return realpathSync(path); }
  catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
    const parent = dirname(path);
    if (parent === path) return path;
    return resolve(resolvedTarget(parent), relative(parent, path));
  }
}

/** Symlinks anywhere in the copy, including .git, that escape its canonical root.
 * owns: [[whygraph-opencode-launcher]]
 */
export function escapingSymlinks(repo) {
  const root = realpathSync(repo), hits = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) {
        try {
          if (!inside(root, resolvedTarget(resolve(dirname(path), readlinkSync(path))))) hits.push(path);
        } catch (error) {
          // A cycle or an unreadable target cannot establish an internal link.
          hits.push(`${path} (${error.code ?? error.message})`);
        }
      } else if (stat.isDirectory()) walk(path);
    }
  }
  walk(root);
  return hits;
}

function createsSymlink(command) {
  if (/\b(?:symlink(?:Sync|_to|at)?|create_symlink|createSymbolicLink)\s*\(/.test(command)) return true;
  for (const match of command.matchAll(/\b(ln|cp)["']?\s+([^;&|\n]*)/g)) {
    const args = match[2].split(/\s+/).map(word => word.replace(/^["']|["']$/g, ''));
    const options = args.slice(0, args.indexOf('--') < 0 ? args.length : args.indexOf('--'));
    if (options.some(word => /^-[^-]*s/.test(word) || word === (match[1] === 'ln' ? '--symbolic' : '--symbolic-link'))) return true;
  }
  return false;
}

/** The post-run checks authorized for batch 5; detection is not a security boundary.
 * owns: [[whygraph-opencode-launcher]]
 */
export function isolationBreaches(repo, tools) {
  const root = realpathSync(repo);
  const hits = escapingSymlinks(repo).map(path => `external symlink: ${path}`);
  const pathKey = /^(?:file_?path|path|paths|directory|dir|root|cwd|workdir|target_?file|old_?path|new_?path|include|pattern)$/i;
  function paths(value, key = '') {
    if (typeof value === 'string') {
      if (pathKey.test(key) && isAbsolute(value) && !inside(root, value)) hits.push(`external file-tool path: ${value}`);
      if (/^(?:patch|patchText|patch_text|diff)$/i.test(key)) {
        for (const line of value.split('\n')) {
          const match = /^(?:\*\*\* (?:Add|Update|Delete) File: |\*\*\* Move to: |--- |\+\+\+ )(.+)$/.exec(line);
          if (match && match[1] !== '/dev/null' && isAbsolute(match[1]) && !inside(root, match[1])) hits.push(`external patch path: ${match[1]}`);
        }
      }
    } else if (Array.isArray(value)) value.forEach(item => paths(item, key));
    else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) paths(v, k);
  }
  for (const tool of tools) {
    if (tool.name === 'Bash') {
      if (createsSymlink(String(tool.input?.command ?? ''))) hits.push('shell command creates a symlink');
    } else paths(tool.input);
  }
  return hits;
}

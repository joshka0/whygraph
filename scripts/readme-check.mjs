#!/usr/bin/env node
/**
 * module: [[whygraph-readme-check]]
 * Reruns every ```console block of README.md and fails when the README text has drifted.
 *
 *   node scripts/readme-check.mjs           # exit 0 when every output matches, 1 when one drifted
 *   node scripts/readme-check.mjs --write   # rewrites the outputs in README.md from this run
 *
 * A console block holds commands (lines that start with "$ ") and the output each prints,
 * stdout and stderr together. A command that exits non-zero ends its output with "[exit n]".
 * The blocks run, in README order, in one bash session that starts in this repo with a
 * fresh empty HOME, so `~/...` paths land in a folder the check deletes afterwards; the
 * output shows that HOME as `~`. PATH starts with bin/ and node_modules/.bin, as README's
 * setup sets it. ```sh blocks are not run.
 *
 * A ```text block right after the line `<!-- readme-check: score <file> -->` quotes a score file:
 * each `===` line must be a line of the file, and each line under it a line of the file's part
 * from that `===` line to the next one. The README section that holds the block may hold no
 * digit outside it, so every number in the section comes from the file.
 *
 * A console block right after the line `<!-- readme-check: preview -->` shows a command
 * before the README reaches it: it does not run, and each of its commands must appear
 * again later, where its output must match the run.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const readme = join(root, 'README.md');
const BLOCK = /^(<!-- readme-check: preview -->\n)?```console\n([\s\S]*?)^```$/gm;

/**
 * owns: [[whygraph-readme-check]]
 * post: the commands of every console block in README order, each with the output lines written under it and whether its block is a preview.
 */
function readCommands(text) {
  const commands = [];
  for (const block of text.matchAll(BLOCK)) {
    const preview = block[1] !== undefined;
    let first = true;
    for (const line of block[2].replace(/\n$/, '').split('\n')) {
      if (line.startsWith('$ ')) commands.push({ command: line.slice(2), expected: [], preview });
      else if (!first) commands.at(-1).expected.push(line);
      else throw new Error(`a console block starts with output, not a command: ${line}`);
      first = false;
    }
  }
  return commands.map(c => ({ ...c, expected: c.expected.join('\n').trimEnd() }));
}

const SCORE = /^<!-- readme-check: score (\S+) -->\n```text\n([\s\S]*?)^```$/gm;

/**
 * owns: [[whygraph-readme-check]]
 * post: one message per line of a score block that its score file does not hold in that place, and per README section that holds a score block and a digit outside it; empty when all match.
 */
function checkScores(text) {
  const errors = [];
  for (const m of text.matchAll(SCORE)) {
    const file = readFileSync(join(root, m[1]), 'utf8').split('\n');
    let part;
    for (const line of m[2].replace(/\n$/, '').split('\n')) {
      if (line.startsWith('===')) {
        const at = file.indexOf(line);
        if (at < 0) { errors.push(`${m[1]} has no line: ${line}`); part = []; continue; }
        const end = file.findIndex((l, i) => i > at && l.startsWith('==='));
        part = file.slice(at + 1, end < 0 ? file.length : end);
      } else if (part === undefined) errors.push(`a score block starts with a line that is not an === line: ${line}`);
      else if (!part.includes(line)) errors.push(`${m[1]} holds no such line in its part: ${line}`);
    }
    const start = text.lastIndexOf('\n## ', m.index);
    const next = text.indexOf('\n## ', m.index);
    const section = text.slice(start, next < 0 ? text.length : next).replace(m[0], '');
    const digit = section.split('\n').find((l) => /\d/.test(l));
    if (digit !== undefined) errors.push(`a section with a score block holds a number outside it: ${digit}`);
  }
  return errors;
}

/** Runs `commands` in one bash session and returns what each printed. */
function runCommands(commands, home) {
  const mark = `@@readme-${process.pid}@@`;
  const script = ['set +e', ...commands.flatMap(({ command }, i) => [
    `printf '%s\\n' '${mark} ${i}'`,
    `{ ${command}\n} 2>&1`,
    `printf '\\n%s\\n' "${mark} exit $?"`,
  ])].join('\n');
  const r = spawnSync('bash', ['--noprofile', '--norc', '-c', script], {
    cwd: root, encoding: 'utf8', maxBuffer: 1 << 28,
    env: {
      ...process.env, HOME: home,
      PATH: `${join(root, 'bin')}:${join(root, 'node_modules/.bin')}:${process.env.PATH}`,
      RELATE_TELEMETRY: '0', DO_NOT_TRACK: '1',
      GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1',
    },
  });
  if (r.error) throw r.error;
  const parts = r.stdout.split(new RegExp(`^${mark} (\\d+)\\n`, 'm'));
  const out = [];
  for (let i = 1; i < parts.length; i += 2) {
    const [, body, status] = parts[i + 1].match(new RegExp(`^([\\s\\S]*?)\\n${mark} exit (\\d+)\\n?$`));
    const text = body.split(home).join('~').trimEnd();
    out[Number(parts[i])] = status === '0' ? text : `${text}\n[exit ${status}]`.trimStart();
  }
  return out;
}

function diff(expected, actual) {
  const a = expected.split('\n'), b = actual.split('\n');
  const lines = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] === b[i]) continue;
    if (a[i] !== undefined) lines.push(`  README: ${a[i]}`);
    if (b[i] !== undefined) lines.push(`  ran:    ${b[i]}`);
    if (lines.length >= 12) { lines.push('  ...'); break; }
  }
  return lines.join('\n');
}

const args = process.argv.slice(2);
if (args.some(a => a !== '--write')) {
  console.error('usage: node scripts/readme-check.mjs [--write]');
  process.exit(2);
}
const write = args.includes('--write');
const text = readFileSync(readme, 'utf8');
const scoreErrors = checkScores(text);
for (const e of scoreErrors) console.error(`score: ${e}`);
const commands = readCommands(text);
const runs = commands.filter(c => !c.preview);
/** The first run of the same command after the preview at index `i`. */
const laterRun = i => commands.find((r, j) => j > i && !r.preview && r.command === commands[i].command);
for (const [i, c] of commands.entries()) {
  if (c.preview && laterRun(i) === undefined) {
    console.error(`a preview command is not run later in the README: $ ${c.command}`);
    process.exit(1);
  }
}
const home = realpathSync(mkdtempSync(join(tmpdir(), 'whygraph-readme-')));
let ran;
try {
  ran = runCommands(runs, home);
} finally {
  rmSync(home, { recursive: true, force: true });
}
/** What each command printed: its own run, or for a preview the first later run of the same command. */
const actual = commands.map((c, i) => ran[runs.indexOf(c.preview ? laterRun(i) : c)]);

if (write) {
  let i = 0;
  const next = text.replace(BLOCK, (block, preview = '') => {
    const lines = block.split('\n').filter(l => l.startsWith('$ '));
    const body = lines.map(l => { const out = actual[i++]; return out === '' ? l : `${l}\n${out}`; }).join('\n');
    return `${preview}\`\`\`console\n${body}\n\`\`\``;
  });
  writeFileSync(readme, next);
  console.log(`wrote the output of ${commands.length} commands into README.md`);
} else {
  const drifted = commands.filter((c, i) => c.expected !== actual[i]);
  for (const c of drifted) console.error(`drifted: $ ${c.command}\n${diff(c.expected, actual[commands.indexOf(c)])}`);
  console.log(`${commands.length} commands, ${drifted.length} drifted`);
  process.exitCode = drifted.length === 0 && scoreErrors.length === 0 ? 0 : 1;
}

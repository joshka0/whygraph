/**
 * module: [[whygraph-documentation-contracts]]
 * R1-R8 and S1-S11 come from docs/failures.md. Product copies, homes and
 * installation targets stay in each test's retained scratch folder.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, symlinkSync } from 'node:fs';
import { basename, join } from 'node:path';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import { harness as h } from './support.mjs';

const { ok, has, failure } = h;
const read = path => readFileSync(path, 'utf8');
function contract(id, description, mode, body) {
  test(`${id} ${description}`, { timeout: 120_000 }, async t => body(h.state(t, mode), t));
}
function consoleCommands(text) {
  return [...text.matchAll(/^```console\n([\s\S]*?)^```/gm)].flatMap(match =>
    match[1].split('\n').filter(line => line.startsWith('$ ')).map(line => line.slice(2)));
}
function block(command, output = '') { return `\`\`\`console\n$ ${command}\n${output === '' ? '' : output + '\n'}\`\`\`\n`; }
function cloneSubject(s, name = 'subject') {
  const folder = join(s.dir, name); mkdirSync(folder);
  for (const path of ['src', 'recipes', 'scripts', 'bin', 'skills', 'README.md', 'package.json', 'eval/score.txt']) {
    cpSync(join(h.subject, path), join(folder, path), { recursive: true, verbatimSymlinks: true });
  }
  symlinkSync(join(h.root, 'node_modules'), join(folder, 'node_modules'));
  return folder;
}
function checkReadme(s, folder, args = [], extra = {}) {
  const temporary = join(folder, 'retained-temporary-parent'); mkdirSync(temporary, { recursive: true });
  return s.run(process.execPath, [join(folder, 'scripts/readme-check.mjs'), ...args], s.repo, { TMPDIR: temporary, ...extra });
}
function installCommand(client) {
  const readme = read(join(h.subject, 'README.md'));
  const target = client === 'claude' ? '.claude/skills/' : '.agents/skills/';
  const line = readme.split('\n').find(line => line.includes('cp -r "$WHYGRAPH/skills/whygraph"') && line.endsWith(target));
  assert.ok(line, `README has no ${client} skill install command`);
  return line;
}
function agentEnvironment(s, name) {
  const configRoot = join(s.dir, `${name}-configuration`); mkdirSync(configRoot);
  const env = { ...h.env };
  // Discovery and configuration need no account or model request.
  for (const key of Object.keys(env)) if (/^(ANTHROPIC_|OPENAI_|CLAUDE_|CODEX_)/.test(key) || key === 'CLAUDECODE') delete env[key];
  Object.assign(env, {
    HOME: configRoot, CODEX_HOME: join(configRoot, '.codex'), CLAUDE_CONFIG_DIR: join(configRoot, '.claude'),
    XDG_CONFIG_HOME: join(configRoot, '.config'), XDG_CACHE_HOME: join(configRoot, '.cache'), XDG_STATE_HOME: join(configRoot, '.state'),
    WHYGRAPH: h.subject, PATH: `${join(h.subject, 'bin')}:${h.env.PATH}`,
  });
  mkdirSync(env.CODEX_HOME); return env;
}
async function protocol(t, s, command, args, env) {
  const child = spawn(command, args, { cwd: s.repo, env, stdio: ['pipe', 'pipe', 'pipe'] });
  const pending = new Map(); const lines = createInterface({ input: child.stdout });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk; });
  lines.on('line', line => {
    s.write(join(s.dir, `${command}-${child.pid}-last-response.json`), line);
    let message; try { message = JSON.parse(line); } catch { return; }
    const id = message.id ?? message.response?.request_id;
    const waiter = pending.get(id); if (!waiter) return;
    pending.delete(id); clearTimeout(waiter.timer);
    if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
    else waiter.resolve(message);
  });
  function rejectAll(error) {
    for (const waiter of pending.values()) { clearTimeout(waiter.timer); waiter.reject(error); }
    pending.clear();
  }
  child.on('error', rejectAll);
  child.on('exit', code => rejectAll(new Error(`${command} discovery exited ${code}: ${stderr}`)));
  t.after(async () => {
    child.stdin.end();
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit'); const timer = setTimeout(() => child.kill('SIGTERM'), 3000);
      await exited; clearTimeout(timer);
    }
    lines.close(); s.write(join(s.dir, `${command}-${child.pid}.stderr`), stderr);
  });
  return {
    send(message) { child.stdin.write(JSON.stringify(message) + '\n'); },
    request(id, message) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${command} discovery timed out: ${stderr}`)); }, 20_000);
        pending.set(id, { resolve, reject, timer }); child.stdin.write(JSON.stringify(message) + '\n');
      });
    },
  };
}

contract('R1', 'the committed README checks every documented console command', 'empty', s => {
  const subject = cloneSubject(s);
  const commands = consoleCommands(read(join(subject, 'README.md'))); assert.ok(commands.length > 0);
  const result = checkReadme(s, subject); assert.equal(ok(result).trim(), `${commands.length} commands, 0 drifted`); assert.equal(result.stderr, '');
});
contract('R2', 'changed README output and changed command output both fail with a useful diff', 'empty', s => {
  const subject = cloneSubject(s);
  const text = read(join(subject, 'README.md'));
  const original = 'whygraph: why the code is the way it is, as a relate graph'; assert.ok(text.includes(original));
  s.write(join(subject, 'README.md'), text.replace(original, 'wrong documented usage line'));
  const changedExpectation = checkReadme(s, subject); failure(changedExpectation, 1, 'drifted: $ whygraph help', 'wrong documented usage line', original);
  assert.match(changedExpectation.stdout, /commands, 1 drifted/);
  const changedCommand = cloneSubject(s, 'changed-command');
  s.write(join(changedCommand, 'README.md'), block("printf 'changed command output\\n'", 'original command output'));
  const changedActual = checkReadme(s, changedCommand); failure(changedActual, 1, "drifted: $ printf 'changed command output\\n'", 'original command output', 'changed command output');
  assert.equal(changedActual.stdout.trim(), '1 commands, 1 drifted');
});
contract('R3', 'a missing non-zero exit marker makes the README drift', 'empty', s => {
  const subject = cloneSubject(s); const path = join(subject, 'README.md'); const text = read(path);
  assert.ok(text.includes('[exit 3]')); s.write(path, text.replace('[exit 3]\n', ''));
  const result = checkReadme(s, subject); failure(result, 1, 'drifted: $ whygraph carry src/money.ts:cent', '[exit 3]');
  assert.match(result.stdout, /commands, 1 drifted/);
});
contract('R4', 'previews reuse the first later run and orphan previews fail before any command runs', 'empty', s => {
  const subject = cloneSubject(s); const marker = join(s.dir, 'preview-runs');
  const command = 'if test -e "$WHYGRAPH_PREVIEW_RUNS"; then printf "second\\n"; else printf "first\\n"; fi; printf "run\\n" >> "$WHYGRAPH_PREVIEW_RUNS"';
  const preview = '<!-- readme-check: preview -->\n';
  s.write(join(subject, 'README.md'), preview + block(command, 'first') + '\n' + block(command, 'first') + '\n' + block(command, 'second'));
  assert.equal(ok(checkReadme(s, subject, [], { WHYGRAPH_PREVIEW_RUNS: marker })).trim(), '3 commands, 0 drifted');
  assert.equal(read(marker), 'run\nrun\n');
  const orphan = cloneSubject(s, 'orphan-preview'); const untouched = join(s.dir, 'must-not-run');
  s.write(join(orphan, 'README.md'), block('printf ran > "$WHYGRAPH_MUST_NOT_RUN"') + '\n' + preview + block('printf orphan', 'orphan'));
  failure(checkReadme(s, orphan, [], { WHYGRAPH_MUST_NOT_RUN: untouched }), 1, 'preview command is not run later', '$ printf orphan');
  assert.ok(!existsSync(untouched));
});
contract('R5', 'checks isolate HOME and git config, disable relate telemetry, and clean temporary homes on failure', 'empty', s => {
  const caller = join(s.dir, 'caller-home'); const config = s.write(join(caller, '.gitconfig'), 'not a valid git config\n');
  const sentinel = s.write(join(caller, 'sentinel'), 'keep caller home\n');
  const envLog = join(s.dir, 'relate-environment.json');
  const real = ok(s.run('/usr/bin/which', ['relate'])).trim();
  const wrapper = s.wrapper('relate', `import { writeFileSync } from 'node:fs'; import { spawnSync } from 'node:child_process';
writeFileSync(${JSON.stringify(envLog)}, JSON.stringify({ home: process.env.HOME, telemetry: process.env.RELATE_TELEMETRY, dnt: process.env.DO_NOT_TRACK, global: process.env.GIT_CONFIG_GLOBAL }));
const r = spawnSync(${JSON.stringify(real)}, process.argv.slice(2), { env: process.env }); process.stdout.write(r.stdout ?? ''); process.stderr.write(r.stderr ?? ''); process.exit(r.status ?? 1);`);
  for (const failing of [false, true]) {
    const subject = cloneSubject(s, `isolated-${failing}`); const homeLog = join(s.dir, `home-${failing}`);
    const command = 'printf "%s\\n" "$HOME" > "$WHYGRAPH_HOME_LOG"; shopt -s nullglob dotglob; entries=("$HOME"/*); printf "home=%s files=%s\\n" "$HOME" "${#entries[@]}"; git config --global --list; relate --version >/dev/null';
    s.write(join(subject, 'README.md'), block(command, 'home=~ files=0') + '\n' + block('bash -c "exit 3"', failing ? '[exit 7]' : '[exit 3]'));
    const result = checkReadme(s, subject, [], { ...wrapper, HOME: caller, GIT_CONFIG_GLOBAL: config, WHYGRAPH_HOME_LOG: homeLog });
    if (failing) failure(result, 1, 'drifted:', '[exit 3]'); else ok(result);
    const temporaryHome = read(homeLog).trim(); assert.notEqual(temporaryHome, caller);
    assert.ok(temporaryHome.startsWith(realpathSync(join(subject, 'retained-temporary-parent')) + '/'));
    assert.ok(!existsSync(temporaryHome), `README checker left its home: ${temporaryHome}`);
    const seen = JSON.parse(read(envLog)); assert.deepEqual(seen, { home: temporaryHome, telemetry: '0', dnt: '1', global: '/dev/null' });
    assert.deepEqual(readdirSync(caller).sort(), ['.gitconfig', 'sentinel']); assert.equal(read(config), 'not a valid git config\n'); assert.equal(read(sentinel), 'keep caller home\n');
  }
});
contract('R6', '--write repairs all console output while retaining commands and preview markers', 'empty', s => {
  const subject = cloneSubject(s); const path = join(subject, 'README.md'); const before = read(path);
  const commands = consoleCommands(before); const previews = before.match(/<!-- readme-check: preview -->/g) ?? [];
  const wrong = before.replaceAll('Before you edit src/money.ts:formatCents', 'incorrect preview and carry output').replace('Why src/tax.ts:taxRate is the way it is', 'incorrect why output');
  assert.notEqual(wrong, before); s.write(path, wrong);
  ok(checkReadme(s, subject, ['--write'])); const after = read(path);
  assert.deepEqual(consoleCommands(after), commands); assert.deepEqual(after.match(/<!-- readme-check: preview -->/g) ?? [], previews);
  assert.equal(after, before); assert.equal(ok(checkReadme(s, subject)).trim(), `${commands.length} commands, 0 drifted`);
});
contract('R7', 'unknown README-check arguments return usage status 2', 'empty', s => {
  const subject = cloneSubject(s);
  for (const arg of ['--unknown', 'unexpected', '--write=1']) assert.match(failure(checkReadme(s, subject, [arg]), 2, '[--write]'), /[Uu]sage/);
});
contract('R8', 'console output before a command is rejected', 'empty', s => {
  const subject = cloneSubject(s);
  s.write(join(subject, 'README.md'), '```console\noutput before the command\n$ printf never\n```\n');
  failure(checkReadme(s, subject), 1, 'a console block starts with output');
});

contract('S1', 'skill front matter identifies its folder and describes all three questions', 'empty', () => {
  const path = join(h.subject, 'skills/whygraph/SKILL.md'); const text = read(path);
  const front = text.match(/^---\n([\s\S]*?)\n---\n/); assert.ok(front, 'missing leading YAML front matter');
  const name = front[1].match(/^name: (.+)$/m)?.[1]; assert.equal(name, basename(join(h.subject, 'skills/whygraph')));
  const description = front[1].match(/^description: (.+)$/m)?.[1]; assert.ok(description && description.length < 1024);
  for (const command of ['carry', 'impact', 'why']) assert.match(description, new RegExp(`\\b${command}\\b`));
});
contract('S2', 'every skill command is listed by help and accepts its documented arguments', 'fixture', s => {
  const text = read(join(h.subject, 'skills/whygraph/SKILL.md'));
  const commands = [...new Set([
    ...[...text.matchAll(/`([^`\n]+)`/g)].map(match => match[1]).filter(value => value.startsWith('whygraph ')),
    ...[...text.matchAll(/^```(?:sh|bash)\n([\s\S]*?)^```/gm)].flatMap(match => match[1].split('\n').filter(line => line.startsWith('whygraph '))),
  ])];
  assert.ok(commands.length >= 6, 'skill command extraction found too little');
  const help = ok(s.cli(['help'])); const known = new Set([...help.matchAll(/^\s+whygraph (\w+)/gm)].map(match => match[1]));
  for (const template of commands) {
    const command = template.replaceAll('<file>:<symbol>', 'src/money.ts:formatCents').replaceAll('<decision id>', 'ADR-0003').replaceAll('<id>', 'ADR-0003');
    const name = command.match(/^whygraph (\S+)/)?.[1]; assert.ok(known.has(name), `skill names a command help does not list: ${template}`);
    const result = s.run('/bin/bash', ['--noprofile', '--norc', '-c', command], s.repo, { PATH: `${join(h.subject, 'bin')}:${h.env.PATH}` });
    assert.ok([0, 1, 3].includes(result.code), `skill command ${template}: ${JSON.stringify(result)}`);
  }
});
contract('S3', 'skill and startup rule pair each trigger with the intended question', 'empty', () => {
  const skill = read(join(h.subject, 'skills/whygraph/SKILL.md')); const rule = read(join(h.subject, 'skills/whygraph-rule.md'));
  for (const text of [skill, rule]) {
    assert.match(text, /before you change a symbol[\s\S]{0,160}?(?:`carry`|`whygraph carry)/i);
    assert.match(text, /when a decision changes[\s\S]{0,160}?(?:`impact`|`whygraph impact)/i);
    assert.match(text, /when you wonder why[\s\S]{0,160}?(?:`why`|`whygraph why)/i);
  }
});
contract('S4', 'README installs a Claude skill that Claude actually discovers', 'empty', async (s, t) => {
  const env = agentEnvironment(s, 'claude'); ok(s.run('/bin/bash', ['--noprofile', '--norc', '-c', installCommand('claude')], s.repo, env));
  const installed = join(s.repo, '.claude/skills/whygraph/SKILL.md'); assert.equal(read(installed), read(join(h.subject, 'skills/whygraph/SKILL.md')));
  const client = await protocol(t, s, 'claude', ['--print', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--no-session-persistence', '--setting-sources', 'project'], env);
  const reply = await client.request('initialize', { type: 'control_request', request_id: 'initialize', request: { subtype: 'initialize' } });
  assert.equal(reply.response.subtype, 'success', JSON.stringify(reply));
  assert.ok(reply.response.response.commands.some(command => command.name === 'whygraph'), 'Claude did not list whygraph');
});
contract('S5', 'README installs a Codex skill that Codex actually discovers', 'empty', async (s, t) => {
  const env = agentEnvironment(s, 'codex'); ok(s.run('/bin/bash', ['--noprofile', '--norc', '-c', installCommand('codex')], s.repo, env));
  const installed = join(s.repo, '.agents/skills/whygraph/SKILL.md'); assert.equal(read(installed), read(join(h.subject, 'skills/whygraph/SKILL.md')));
  const client = await protocol(t, s, 'codex', ['app-server', '--stdio'], env);
  await client.request(1, { id: 1, method: 'initialize', params: { clientInfo: { name: 'whygraph-contracts', version: '1' }, capabilities: { experimentalApi: true } } });
  client.send({ method: 'initialized' });
  const reply = await client.request(2, { id: 2, method: 'skills/list', params: { cwds: [s.repo], forceReload: true } });
  const found = reply.result.data.find(entry => entry.cwd === s.repo); assert.ok(found, JSON.stringify(reply));
  assert.ok(found.skills.some(skill => skill.name === 'whygraph' && skill.path === installed && skill.enabled), 'Codex did not list the installed whygraph');
  assert.deepEqual(found.errors, []);
});
contract('S6', 'README MCP registration persists read-only servers with telemetry disabled', 'fixture', s => {
  const readme = read(join(h.subject, 'README.md')).replaceAll('\\\n', ' ');
  for (const client of ['claude', 'codex']) {
    const env = agentEnvironment(s, `mcp-${client}`);
    const command = readme.split('\n').find(line => line.startsWith(`${client} mcp add whygraph `)); assert.ok(command, `${client} install command is absent`);
    ok(s.run('/bin/bash', ['--noprofile', '--norc', '-c', command], s.repo, env));
    if (client === 'codex') {
      const server = JSON.parse(ok(s.run('codex', ['mcp', 'get', 'whygraph', '--json'], s.repo, env)));
      const transport = server.transport ?? server;
      assert.equal(transport.command, 'relate'); assert.deepEqual(transport.args, ['serve', '--mcp', 'stdio', '--database', s.store, '--read-only']);
      assert.deepEqual(transport.env, { RELATE_TELEMETRY: '0', DO_NOT_TRACK: '1' });
    } else {
      const server = ok(s.run('claude', ['mcp', 'get', 'whygraph'], s.repo, env));
      has(server, 'Command: relate', `Args: serve --mcp stdio --database ${s.store} --read-only`, 'RELATE_TELEMETRY=0', 'DO_NOT_TRACK=1');
    }
  }
});
contract('S7', 'unset WHYGRAPH fails without installing, and repeat installation overwrites in place', 'empty', s => {
  for (const client of ['claude', 'codex']) {
    const env = agentEnvironment(s, `repeat-${client}`); const command = installCommand(client);
    const unset = { ...env }; delete unset.WHYGRAPH;
    const result = s.run('/bin/bash', ['--noprofile', '--norc', '-c', `unset WHYGRAPH\n${command}`], s.repo, unset);
    failure(result, 1, "cannot stat '/skills/whygraph'");
    const directory = join(s.repo, client === 'claude' ? '.claude/skills/whygraph' : '.agents/skills/whygraph');
    assert.ok(!existsSync(directory)); ok(s.run('/bin/bash', ['--noprofile', '--norc', '-c', command], s.repo, env));
    s.write(join(directory, 'SKILL.md'), 'outdated installed skill\n'); ok(s.run('/bin/bash', ['--noprofile', '--norc', '-c', command], s.repo, env));
    assert.equal(read(join(directory, 'SKILL.md')), read(join(h.subject, 'skills/whygraph/SKILL.md')));
    assert.ok(!existsSync(join(directory, 'whygraph'))); assert.deepEqual(readdirSync(directory), ['SKILL.md']);
  }
});

// These are instruction contracts, not a claim that an agent will obey them.
// Scope the skill assertions to rule 1 so unrelated prose cannot satisfy them.
function editRule(folder, file) {
  const text = read(join(folder, file)).replace(/\s+/g, ' ');
  if (file.endsWith('/SKILL.md')) {
    const rule = text.match(/1\. Before you change a symbol,[\s\S]*?(?= 2\. Before a change)/)?.[0];
    assert.ok(rule, 'missing skill rule 1'); return rule;
  }
  return text;
}
function skillContract(id, text) {
  if (id === 'S8') {
    assert.match(text, /A change goes against a record when it reverses, removes or weakens what the record decided or added\./);
    assert.match(text, /Do not make that change,/);
    assert.match(text, /name the record, say what the change would undo and what you would change if the user confirms, then stop\./);
  } else if (id === 'S9') {
    assert.match(text, /Do not make that change, even when the request asks plainly and nobody can answer:/);
    assert.match(text, /then stop\. Make it only when the request itself names the record and says to reverse it;/);
  } else if (id === 'S10') {
    assert.match(text, /Make it only when the request itself names the record and says to reverse it; then change the record together with the code when the repo holds it\./);
    assert.doesNotMatch(text, /(?:invent|create|copy|local copy|always update)/i, 'external tickets must not require a fabricated local record');
  } else if (id === 'S11') {
    assert.match(text, /A record the change does not go against is no reason to stop: make the change, naming the record only if it helps the reader\./);
  } else assert.fail(`unknown contract ${id}`);
}
const editRuleFiles = ['skills/whygraph/SKILL.md', 'skills/whygraph-rule.md'];
for (const [id, description] of [
  ['S8', 'both texts define reversal/removal/weakening, forbid edits, require explanation and stop'],
  ['S9', 'plain requests and unavailable users do not authorize an unnamed reversal'],
  ['S10', 'a named reversal authorizes editing, with repo-held records updated together'],
  ['S11', 'relevant unopposed records require proceeding with an optional citation'],
]) contract(id, description, 'empty', () => {
  for (const file of editRuleFiles) skillContract(id, editRule(h.subject, file));
});

for (const file of editRuleFiles) {
  contract('S8', `plant missing prohibition in ${file} is caught by the rule contract`, 'empty', s => {
    skillContract('S8', editRule(h.subject, file));
    const folder = join(s.dir, 'faulty-subject');
    const original = read(join(h.subject, file));
    const faulty = original.replace(/Do not make\s+that change,/, 'Make that change,');
    assert.notEqual(faulty, original, 'plant did not change the text');
    s.write(join(folder, file), faulty);
    assert.throws(() => skillContract('S8', editRule(folder, file)), { code: 'ERR_ASSERTION' });
  });
}

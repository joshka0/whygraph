/** Run the independent failure-list contracts and retain all evidence. */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`;
const scratch = resolve(root, 'test-results/scratch', runId);
mkdirSync(scratch, { recursive: true });
const report = resolve(root, 'test-results', `${runId}.tap`);
const start = performance.now();
console.log(`TAP report: ${report}\nRetained scratch: ${scratch}`);
const child = spawn(process.execPath, [
  '--test', '--test-reporter=spec', '--test-reporter-destination=stdout',
  '--test-reporter=tap', `--test-reporter-destination=${report}`,
  ...process.argv.slice(2), resolve(root, 'test/contracts.test.mjs'), resolve(root, 'test/docs.test.mjs'), resolve(root, 'test/carry.test.mjs'),
], {
  cwd: root, stdio: 'inherit',
  env: { ...process.env, RELATE_TELEMETRY: '0', DO_NOT_TRACK: '1', WHYGRAPH_TEST_RUN_DIR: scratch },
});
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('exit', (code, signal) => {
  const summary = { report, scratch, exitCode: code, signal, wallSeconds: (performance.now() - start) / 1000 };
  writeFileSync(resolve(scratch, 'run.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(`Suite wall time: ${summary.wallSeconds.toFixed(3)}s; exit ${code ?? signal}`);
  process.exitCode = code ?? 1;
});

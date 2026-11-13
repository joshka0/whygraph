/** Build contracts derived from failures Q25/Q26 and ADR 0001's amendment. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { harness as h } from './support.mjs';

const { ok, record } = h;
h.env.NODE_OPTIONS = `${h.env.NODE_OPTIONS ?? ''} --import=${join(h.root, 'test/search-offline.mjs')}`.trim();
delete h.env.WHYGRAPH_TEST_MODEL_FIXTURE_CACHE;

function stored(s) {
  return JSON.parse(ok(s.run('relate', ['--database', s.store, '--read-only', '--json', '-c',
    'MATCH (d:Decision) RETURN d.id AS id, d.searchText AS text, d.vector AS vector ORDER BY id']))).data;
}

test('Q25 build peak memory stays bounded as records grow from 8 to 128', { timeout: 180_000 }, t => {
  const s = h.state(t, 'code');
  s.commit('Code for bounded build memory measurement');
  // Public synthetic prose, long enough to expose padded all-record tensors.
  // Compare two real CLI builds, rather than extrapolating to thousands and
  // risking this shared machine. Both have the same maximum text length.
  const statement = 'Currency amounts stay integer cents because floating point addition can accumulate rounding errors. '.repeat(16);
  const records = Array.from({ length: 128 }, (_, i) => record(`memory-${String(i).padStart(3, '0')}`, {
    title: 'Currency rounding policy', items: [{ label: 'choice', text: statement }],
  }));
  const measurements = [];
  for (const count of [8, 128]) {
    const file = s.decisions(records.slice(0, count), `records-${count}.json`);
    const memory = join(s.dir, `memory-${count}.txt`);
    // Keep this safe even when the file is run outside the suite's scope.
    const result = s.run('systemd-run', ['--user', '--scope', '-q', '-p', 'MemoryMax=6G', '-p', 'CPUQuota=400%',
      '/usr/bin/time', '-v', '-o', memory, process.execPath, join(h.subject, 'src/main.ts'), 'build', '--decisions', file]);
    ok(result);
    const counts = JSON.parse(ok(s.run('relate', ['--database', s.store, '--read-only', '--json', '-c',
      'MATCH (d:Decision) RETURN count(d) AS count']))).data;
    assert.equal(counts[0].count, count, 'the measured build must actually store every record');
    const report = readFileSync(memory, 'utf8');
    const match = report.match(/Maximum resident set size \(kbytes\):\s*(\d+)/);
    assert.ok(match, report);
    measurements.push({ count, peakKiB: Number(match[1]) });
  }
  const [small, large] = measurements;
  const evidence = { measurements, maximumKiB: 2_000_000_000 / 1024, growthAllowanceKiB: 256 * 1024 };
  s.write(join(s.dir, 'memory-comparison.json'), evidence);
  t.diagnostic(JSON.stringify(evidence));
  for (const sample of measurements) assert.ok(sample.peakKiB > 0 && sample.peakKiB < evidence.maximumKiB,
    `Q25 whole build must stay below 2 GB: ${JSON.stringify(sample)}`);
  // Allow runtime/allocator noise, but not one extra model tensor per record.
  assert.ok(large.peakKiB <= small.peakKiB + evidence.growthAllowanceKiB,
    `Q25 peak must stay flat within 256 MiB of runtime noise: ${JSON.stringify(measurements)}`);
});

test('Q26 stored vectors equal a fresh single-text embedding regardless of companion records', { timeout: 120_000 }, t => {
  const s = h.state(t, 'code');
  s.commit('Code for embedding identity');
  const target = record('target', {
    title: 'Money in integer cents',
    items: [{ label: 'choice', text: 'Store each amount as integer cents so addition avoids floating point rounding errors.' }],
  });
  const text = `${target.title}\n${target.items[0].text}`;
  // An independent model call in a fresh process is the query-side oracle;
  // importing the implementation here could repeat its batching mistake.
  const script = `
    import { pipeline, env, LogLevel } from '@huggingface/transformers';
    env.cacheDir = process.argv[2]; env.logLevel = LogLevel.ERROR;
    const model = await pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5', { dtype: 'q8', progress_callback: () => {} });
    const result = await model([process.argv[1]], { pooling: 'mean', normalize: true });
    console.log(JSON.stringify(result.tolist()[0]));
  `;
  const expected = JSON.parse(ok(s.run(process.execPath, ['--input-type=module', '-e', script, text, join(h.env.HOME, '.cache/whygraph')], h.root)));
  assert.equal(expected.length, 384);
  const short = record('brief', { title: 'Tax' });
  const long = record('lengthy', { title: 'Deployments', items: [{ label: 'context', text: 'Deploy services across regions with audit logs, request routing and isolated database transactions. '.repeat(24) }] });
  const sets = [[target], [short, target, long], [long, record('empty'), target, short]];
  const comparisons = [];
  for (const [index, records] of sets.entries()) {
    const file = s.decisions(records, `records-${index}.json`);
    ok(s.build([file]));
    const all = stored(s);
    assert.equal(all.length, records.length);
    const actual = all.find(row => row.id === target.id);
    assert.ok(actual); assert.equal(actual.text, text); assert.equal(actual.vector.length, 384);
    const maxAbsoluteDifference = Math.max(...actual.vector.map((v, i) => Math.abs(v - expected[i])));
    comparisons.push({ records: records.map(r => r.id), maxAbsoluteDifference });
    s.write(join(s.dir, 'vector-comparison.json'), { comparisons });
    assert.equal(maxAbsoluteDifference, 0, `Q26 target vector changed with companions: ${JSON.stringify(comparisons)}`);
    assert.deepEqual(actual.vector, expected, 'every stored float must equal the fresh query embedding');
  }
  t.diagnostic(JSON.stringify(comparisons));
});

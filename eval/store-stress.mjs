#!/usr/bin/env node
/** module: [[whygraph-closed-store]] */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const [directory, size = '5000'] = process.argv.slice(2);
const count = Number(size);
if (!directory || !Number.isSafeInteger(count) || count < 1) throw new Error('usage: store-stress.mjs <new directory> [records=5000]');
const root = resolve(directory), store = join(root, 'store');
if (existsSync(root)) throw new Error(`stress directory already exists: ${root}`);
mkdirSync(root, { recursive: true });
const args = ['--no-agent-mode','--max-rows','0','query','--database',store], statements = [
  'CREATE INDEX decision_id FOR (d:Decision) ON (d.id)',
  'CREATE INDEX term_id FOR (t:Term) ON (t.id)',
  'CREATE (:Commit {sha: "stress"})',
  'UNWIND range(1,60) AS i CREATE (:Term {id:i, text:toString(i)})',
];
const vector = Array.from({ length: 384 }, (_,i) => (i+1)/384);
for (let start = 0; start < count; start += 100) {
  const key = `records${start}`, path = join(root, `${key}.json`);
  const rows = Array.from({ length: Math.min(100,count-start) }, (_,i) => ({ id:start+i,
    title:`Stress record ${start+i}`, searchText:`Record ${start+i}\n`+'x'.repeat(7980), vector }));
  writeFileSync(path, JSON.stringify(rows));
  args.push('--fetch-params', `${key}=${path}`);
  statements.push(`UNWIND $${key} AS r CREATE (:Decision {id:r.id, title:r.title, searchText:r.searchText, vector:r.vector})`);
}
for (let start = 0; start < count; start += 100) {
  statements.push(`UNWIND range(${start},${Math.min(count-1,start+99)}) AS i MATCH (d:Decision {id:i}) UNWIND range(1,60) AS j MATCH (t:Term {id:j}) CREATE (d)-[:MENTIONS {count:1}]->(t)`);
  statements.push(`UNWIND range(${start},${Math.min(count-1,start+99)}) AS i MATCH (d:Decision {id:i}) MATCH (c:Commit {sha:"stress"}) CREATE (d)-[:CITES]->(c)`);
}
const result = spawnSync('relate', args, { input: statements.join(';\n')+';', stdio:['pipe','ignore','inherit'],
  env:{...process.env,RELATE_TELEMETRY:'0',DO_NOT_TRACK:'1'} });
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`stress store build exited ${result.status ?? result.signal}`);
console.log(JSON.stringify({store, records:count, relationships:count*61, vectorDimensions:384, embeddings:'direct deterministic floats; no model'}));

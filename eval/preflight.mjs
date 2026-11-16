#!/usr/bin/env node
/** module: [[whygraph-closed-runner]] */
import { fileURLToPath } from 'node:url';
import { closedPreflight } from './closed-run.mjs';
import { evalBatch } from './registry.mjs';

const args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--batch'||!Number.isInteger(Number(args[1]))||Number(args[1])<7||evalBatch(Number(args[1])).storeAccess!=='closed')
  throw new Error('usage: preflight.mjs --batch N (a closed-store batch, N >= 7)');
try {
  await closedPreflight({workRoot:process.env.WHYGRAPH_EVAL_WORK??'/var/tmp/whygraph-eval',results:fileURLToPath(new URL('./results',import.meta.url))});
} catch(error) { console.error(error.message);process.exitCode=1; }

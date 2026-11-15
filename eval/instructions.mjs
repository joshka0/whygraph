/** module: [[whygraph-trial-design]] */
import { execFileSync } from 'node:child_process';
import { evalBatch } from './registry.mjs';

/** Read the complete instruction bundle from the batch's recorded history.
 * owns: [[whygraph-trial-design]]
 */
export function batchInstructions(number, cwd = new URL('..', import.meta.url)) {
  const commit = evalBatch(number).instructionsCommit;
  if (typeof commit !== 'string' || !/^[a-f0-9]{7,40}$/.test(commit)) throw new Error(`batch ${number}: record instructionsCommit before preparation`);
  const read = path => {
    try { return execFileSync('git', ['show', `${commit}:${path}`], { cwd, maxBuffer: 1 << 20 }); }
    catch { throw new Error(`batch ${number}: instructions missing at ${commit}:${path}`); }
  };
  return { skill: read('skills/whygraph/SKILL.md'), rule: read('skills/whygraph-rule.md') };
}

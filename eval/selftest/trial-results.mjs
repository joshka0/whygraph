/** module: [[whygraph-trial-design]]
 * Git tracks no saved trial run, so a fresh clone has none. Checks that compare
 * scorer output with eval/score.txt take the runs from here and fail when none exist.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** The folder of saved trial runs: WHYGRAPH_EVAL_RESULTS, else eval/results in the checkout at root.
 * Throws when the folder holds no run (a sub-folder with meta.json); never returns an empty folder.
 * owns: [[whygraph-trial-results-location]]
 */
export function trialResults(root) {
  const named = process.env.WHYGRAPH_EVAL_RESULTS;
  if (named === '') throw new Error('WHYGRAPH_EVAL_RESULTS is empty: set it to the folder of saved trial runs, or unset it to use eval/results');
  const dir = resolve(named ?? join(root, 'eval/results'));
  const runs = existsSync(dir) ? readdirSync(dir).filter(name => existsSync(join(dir, name, 'meta.json'))) : [];
  if (runs.length === 0) {
    const source = named === undefined ? 'default eval/results; WHYGRAPH_EVAL_RESULTS is unset' : 'from WHYGRAPH_EVAL_RESULTS';
    throw new Error(`no saved trial runs in ${dir} (${source}). Git tracks none: point WHYGRAPH_EVAL_RESULTS at the folder that produced eval/score.txt.`);
  }
  return dir;
}

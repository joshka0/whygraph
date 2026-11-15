/** module: [[whygraph-trial-design]] */
import { cpSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../', import.meta.url));

/** Copy the shared dependencies beside an unchanged eval script.
 * owns: [[whygraph-registry-fixtures]]
 */
export function copyRegistry(at) {
  mkdirSync(at, { recursive: true });
  for (const file of ['registry.mjs', 'registry.json']) cpSync(join(source, file), join(at, file));
}

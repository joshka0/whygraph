/** Trace forbidden target/store access before argument rejection. */
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { resolve } from 'node:path';

const append = fs.appendFileSync;
const forbidden = JSON.parse(process.env.WHYGRAPH_TEST_FORBIDDEN_PATHS ?? '[]');
for (const name of ['existsSync', 'readFileSync', 'openSync', 'statSync', 'lstatSync', 'realpathSync', 'readdirSync']) {
  const original = fs[name];
  fs[name] = function (path, ...args) {
    const file = path instanceof URL ? path.pathname : typeof path === 'string' ? resolve(path) : '';
    if (forbidden.some(target => file === target || file.startsWith(target + '/'))) {
      append(process.env.WHYGRAPH_TEST_ACCESS_TRACE, `${name} ${file}\n`);
      throw new Error('Argument rejection must precede target/store access');
    }
    return original.call(this, path, ...args);
  };
}
syncBuiltinESMExports();

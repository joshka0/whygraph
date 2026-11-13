/** Test-only preload: cached models work; every network fetch fails locally. */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { join } from 'node:path';

function trace(event) {
  if (process.env.WHYGRAPH_TEST_MODEL_TRACE) appendFileSync(process.env.WHYGRAPH_TEST_MODEL_TRACE, event + '\n');
}
globalThis.fetch = async (input, options = {}) => {
  // An optional fixture transport exercises a genuinely empty model cache
  // using the already cached public model bytes, without contacting a server.
  const fixture = process.env.WHYGRAPH_TEST_MODEL_FIXTURE_CACHE;
  const url = new URL(typeof input === 'string' ? input : input.url ?? String(input));
  const prefix = '/Xenova/bge-small-en-v1.5/resolve/main/';
  if (fixture && url.origin === 'https://huggingface.co' && url.pathname.startsWith(prefix)) {
    const file = url.pathname.slice(prefix.length);
    if (!file.split('/').includes('..')) {
      const path = join(fixture, 'Xenova/bge-small-en-v1.5', file);
      if (!existsSync(path)) return new Response('fixture file absent', { status: 404 });
      const body = readFileSync(path);
      const contentType = file.endsWith('.json') ? 'application/json' : 'application/octet-stream';
      if (new Headers(options.headers).get('range') === 'bytes=0-0') {
        trace(`fixture metadata ${file}`);
        return new Response(body.subarray(0, 1), { status: 206, headers: { 'content-range': `bytes 0-0/${body.length}`, 'content-length': '1', 'content-type': contentType } });
      }
      trace(`fixture download ${file} ${body.length}`);
      return new Response(body, { headers: { 'content-length': String(body.length), 'content-type': contentType } });
    }
  }
  trace('network blocked');
  throw new Error('network disabled by search contract tests');
};
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '@huggingface/transformers') {
      trace('model loaded');
      if (process.env.WHYGRAPH_TEST_NO_MODEL === '1') throw new Error('model forbidden by this contract');
    }
    return next(specifier, context);
  },
});

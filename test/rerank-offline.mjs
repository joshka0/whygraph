/** Test preload: real HTTP is permitted only to the test's loopback endpoint. */
import { appendFileSync } from 'node:fs';

const localFetch = globalThis.fetch;
await import('./search-offline.mjs');
const offlineFetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  const url = new URL(typeof input === 'string' ? input : input.url ?? String(input));
  if (url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.origin === new URL(process.env.WHYGRAPH_RERANK_URL).origin) {
    if (process.env.WHYGRAPH_TEST_RERANK_TRACE) appendFileSync(process.env.WHYGRAPH_TEST_RERANK_TRACE, 'local request\n');
    return localFetch(input, options);
  }
  return offlineFetch(input, options);
};

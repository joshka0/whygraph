/** Allow only the test's loopback ranking endpoint through the offline preload. */
import { request } from 'node:http';
const offline = globalThis.fetch;
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url ?? String(input));
  if (url.origin !== process.env.WHYGRAPH_TEST_RANK_ENDPOINT || url.hostname !== '127.0.0.1') return offline(input, options);
  return new Promise((resolve, reject) => {
    const req = request(url, { method: options.method, headers: options.headers, signal: options.signal }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve(new Response(Buffer.concat(chunks), { status: response.statusCode })));
    });
    req.on('error', reject); req.end(options.body);
  });
};

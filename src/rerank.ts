/**
 * module: [[whygraph-rerank]]
 * boundary: io
 * decided: the reranker is one fetch with a 10-second timeout and no retry, because it is a convenience that must never delay the wide answer long or fail the command
 * decided: the model id comes only from WHYGRAPH_RERANK and there is no default, because a hosted call must be an explicit opt-in and the key is never printed
 */
import { rerankBody } from "./rerank.pure.ts";

/** Where the reranker sends its call, and under which model. */
export interface RerankSettings {
  readonly model: string;
  readonly endpoint: string;
  readonly apiKey: string | undefined;
}

/**
 * The reranker settings from the environment, or undefined when `WHYGRAPH_RERANK` is unset or empty.
 * owns: [[whygraph-rerank]]
 * post: `WHYGRAPH_RERANK_URL` defaults to `https://openrouter.ai/api/v1/rerank`; `OPENROUTER_API_KEY` is read but never returned in any output.
 */
export function rerankSettings(env: Readonly<Record<string, string | undefined>> = process.env): RerankSettings | undefined {
  const model = (env.WHYGRAPH_RERANK ?? "").trim();
  if (model === "") return undefined;
  const url = (env.WHYGRAPH_RERANK_URL ?? "").trim();
  const key = env.OPENROUTER_API_KEY ?? "";
  return { model, endpoint: url === "" ? "https://openrouter.ai/api/v1/rerank" : url, apiKey: key === "" ? undefined : key };
}

/**
 * The host of an endpoint, for the line that says where the text went.
 * owns: [[whygraph-rerank]]
 */
export function endpointHost(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return endpoint;
  }
}

/** The reranker's response body, or why the call was not usable. */
export type RerankCall = { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly reason: string };

/**
 * One `POST` to the reranker with the JSON body `rerankBody` builds.
 * owns: [[whygraph-rerank]]
 * post: `Authorization: Bearer <key>` only when a key is set; timeout 10 seconds; no retry.
 * post: a non-200 status gives `HTTP <status>`; a timeout gives `timeout`; a body that is not JSON gives `unexpected response`; any other throw gives `network error`. No header or key ever reaches the reason.
 */
export async function callRerank(settings: RerankSettings, query: string, documents: readonly string[]): Promise<RerankCall> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (settings.apiKey !== undefined) headers.authorization = `Bearer ${settings.apiKey}`;
  try {
    const response = await fetch(settings.endpoint, { method: "POST", headers, body: JSON.stringify(rerankBody(settings.model, query, documents)), signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return { ok: false, reason: `HTTP ${response.status}` };
    try {
      return { ok: true, value: await response.json() };
    } catch {
      return { ok: false, reason: "unexpected response" };
    }
  } catch (e) {
    const name = (e as Error).name;
    return { ok: false, reason: name === "TimeoutError" || name === "AbortError" ? "timeout" : "network error" };
  }
}

/**
 * module: [[whygraph-embeddings]]
 * boundary: io
 * decided: whygraph embeds with a local ONNX model through @huggingface/transformers, because a decision record's text must not leave the machine and a hosted embedding API would need a key, a network call per query and a second trust boundary
 * decided: one model call takes one record text, because the q8 weights scale activations over the whole call, so a record's vector moved with the other records in its call (up to 0.014 apart, cosine 0.995), and one text per call also measured fastest and smallest (292 s and 0.34 GB for the 2,662-record set against 367 s and 1.1 GB for calls of 64)
 * decided: the model's ONNX thread count stays at its default, because peak memory was the same at 1, 4, 16 and the default thread count, so threads were not part of the memory problem
 */
import { homedir } from "node:os";
import { join } from "node:path";

/** The embedding model: `Xenova/bge-small-en-v1.5`, a 384-dimension English model run with ONNX. */
const MODEL = "Xenova/bge-small-en-v1.5";

/** Where the model files are cached: `~/.cache/whygraph`, the same folder for every build and query. */
const MODEL_CACHE = join(homedir(), ".cache", "whygraph");

/**
 * The embedding model could not be loaded or run.
 * owns: [[whygraph-embeddings]]
 */
export class ModelUnavailable extends Error {}

type Extractor = (texts: string[], options: { readonly pooling: "mean"; readonly normalize: true }) => Promise<{ tolist(): unknown[] }>;

let loading: Promise<Extractor> | undefined;

/** The feature-extraction pipeline, loaded once per process: cache `MODEL_CACHE`, `q8` weights, no log or progress output. */
function extractor(): Promise<Extractor> {
  loading ??= (async () => {
    const { pipeline, env, LogLevel } = await import("@huggingface/transformers");
    env.cacheDir = MODEL_CACHE;
    env.logLevel = LogLevel.ERROR;
    return (await pipeline("feature-extraction", MODEL, { dtype: "q8", progress_callback: () => {} })) as unknown as Extractor;
  })();
  return loading;
}

/**
 * owns: [[whygraph-embeddings]]
 * post: one 384-float unit vector per text, in order; an empty list for no text, so a build with no records does not need the model.
 * post: the model runs on one text per call, so the memory a build holds does not grow with the number of records and a text's vector does not depend on the other texts of a call.
 * post: throws ModelUnavailable, naming MODEL and MODEL_CACHE, when the model is neither cached nor downloadable.
 */
export async function embedTexts(texts: readonly string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  try {
    const extract = await extractor();
    const vectors: number[][] = [];
    for (const text of texts) {
      const output = await extract([text], { pooling: "mean", normalize: true });
      vectors.push(...(output.tolist() as number[][]));
    }
    return vectors;
  } catch (e) {
    throw new ModelUnavailable(`the embedding model ${MODEL} could not be loaded: ${(e as Error).message}. The first build downloads it (about 35 MB) into ${MODEL_CACHE}; that build needs the network.`);
  }
}

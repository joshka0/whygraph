/**
 * module: [[whygraph-embeddings]]
 * boundary: io
 * decided: whygraph embeds with a local ONNX model through @huggingface/transformers, because a decision record's text must not leave the machine and a hosted embedding API would need a key, a network call per query and a second trust boundary
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
 * post: throws ModelUnavailable, naming MODEL and MODEL_CACHE, when the model is neither cached nor downloadable.
 */
export async function embedTexts(texts: readonly string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  try {
    const output = await (await extractor())([...texts], { pooling: "mean", normalize: true });
    return output.tolist() as number[][];
  } catch (e) {
    throw new ModelUnavailable(`the embedding model ${MODEL} could not be loaded: ${(e as Error).message}. The first build downloads it (about 35 MB) into ${MODEL_CACHE}; that build needs the network.`);
  }
}

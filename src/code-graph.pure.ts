/**
 * module: [[whygraph-code-graph]]
 * boundary: pure
 * imports: none
 */

/** A node of `memod graph --history` output, as ADR 0003 of memod promises it. */
export interface CodeNode {
  readonly id: string;
  readonly kind: string;
  readonly name: string;
  readonly what?: string;
  readonly because?: string;
  readonly date?: string;
  readonly subject?: string;
  /** A symbol's first and last source line, 1-based and inclusive, without its doc comment (memod ADR 0003, amendment of 2026-11-13). */
  readonly line?: number;
  readonly endLine?: number;
}

/** An edge of `memod graph --history` output. Fields beyond `kind`, `from` and `to` depend on the kind. */
export interface CodeEdge {
  readonly kind: string;
  readonly from: string;
  readonly to: string;
  readonly symbols?: readonly string[];
  readonly typeOnly?: boolean;
  readonly specifier?: string;
  readonly line?: number;
}

/** The code graph of one repo state. */
export interface CodeGraph {
  readonly nodes: readonly CodeNode[];
  readonly edges: readonly CodeEdge[];
}

/** A commit of the code graph. */
export interface GraphCommit {
  readonly sha: string;
  readonly date: string;
  readonly subject: string;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * owns: [[whygraph-code-graph]]
 * post: returns the graph when `value` has `nodes` and `edges` arrays whose entries carry string `id`/`kind`/`name` and `kind`/`from`/`to`; else returns an error that names the first bad entry.
 * decided: the shape is checked, not trusted, because a memod without `--history` support or a broken run must fail the build with a message instead of loading a wrong graph
 */
export function readCodeGraph(value: unknown): { readonly graph: CodeGraph } | { readonly error: string } {
  if (!isRecord(value) || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) return { error: "memod graph output has no `nodes` and `edges` arrays" };
  for (const [i, n] of value.nodes.entries()) {
    if (!isRecord(n) || typeof n.id !== "string" || typeof n.kind !== "string" || typeof n.name !== "string") return { error: `memod graph node ${i} has no string id, kind and name` };
  }
  for (const [i, e] of value.edges.entries()) {
    if (!isRecord(e) || typeof e.kind !== "string" || typeof e.from !== "string" || typeof e.to !== "string") return { error: `memod graph edge ${i} has no string kind, from and to` };
  }
  return { graph: { nodes: value.nodes as CodeNode[], edges: value.edges as CodeEdge[] } };
}

/**
 * owns: [[whygraph-code-graph]]
 * post: the commit nodes of `graph`, in graph order, with full id, date and subject.
 */
export function graphCommits(graph: CodeGraph): readonly GraphCommit[] {
  return graph.nodes.filter((n) => n.kind === "commit").map((n) => ({ sha: n.name, date: n.date ?? "", subject: n.subject ?? "" }));
}

/**
 * owns: [[whygraph-code-graph]]
 * post: splits a memod symbol name `<file>#<symbol>` at its last `#`; a name without `#` is all symbol and no file.
 */
export function symbolParts(name: string): { readonly path: string; readonly name: string } {
  const hash = name.lastIndexOf("#");
  return { path: name.slice(0, Math.max(hash, 0)), name: name.slice(hash + 1) };
}

/**
 * The languages whose symbols memod gives `uses` edges, and the extension of each file it reads them from.
 * memod indexes `*.ts`, `*.tsx`, `*.mts`, `*.cts`, `*.js`, `*.jsx`, `*.mjs`, `*.cjs`, `*.zig`, `*.rs`, `*.swift`, `*.ex` and `*.kt`
 * (memod `dist/repo.js:11`), but only its oxc reader (TypeScript and JavaScript, `dist/extract.pure.js:124`), `rust-uses` and `swift-uses`
 * make `uses` edges; the Zig, Elixir and Kotlin readers set neither `refs` nor `names`, so memod's `memod uses` on them exits 1
 * (memod `dist/index-build.js:27`, `dist/graph.pure.js:134,142` and `dist/graph.pure.js:330`).
 * owns: [[whygraph-code-graph]]
 * decided: the list is copied from memod's code because memod's graph output has no field that names the languages it read references for
 */
const SYMBOL_EDGE_LANGUAGES: readonly { readonly language: string; readonly extensions: readonly string[] }[] = [
  { language: "TypeScript", extensions: ["ts", "tsx", "mts", "cts"] },
  { language: "JavaScript", extensions: ["js", "jsx", "mjs", "cjs"] },
  { language: "Rust", extensions: ["rs"] },
  { language: "Swift", extensions: ["swift"] },
];

/** Every file extension in `SYMBOL_EDGE_LANGUAGES`. */
const SYMBOL_EDGE_EXTENSIONS = new Set(SYMBOL_EDGE_LANGUAGES.flatMap((language) => language.extensions));

/**
 * The languages memod gives symbol `uses` edges to, named as a sentence lists them: `TypeScript, JavaScript, Rust and Swift`.
 * owns: [[whygraph-code-graph]]
 */
export const SYMBOL_EDGE_LANGUAGE_LIST = SYMBOL_EDGE_LANGUAGES.map((language) => language.language).join(", ").replace(/, ([^,]+)$/, " and $1");

/**
 * owns: [[whygraph-code-graph]]
 * post: true when memod reads symbol-to-symbol uses for files of `path`'s language.
 * decided: a file whose extension memod indexes but whose reader finds no references (`.zig`, `.ex`, `.kt`) gives false, because a caller in one of them must be told its uses are unknown rather than none
 * decided: a declaration file (`.d.ts`) gives true like any other TypeScript file, because memod's oxc reader emits `uses` edges for its symbols and `memod uses` lists them
 */
export function hasSymbolEdges(path: string): boolean {
  const dot = path.lastIndexOf(".");
  return dot >= 0 && SYMBOL_EDGE_EXTENSIONS.has(path.slice(dot + 1));
}

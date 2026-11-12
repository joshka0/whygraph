/**
 * module: [[whygraph-targets]]
 * boundary: pure
 * imports: node:path
 */
import { posix } from "node:path";

/** A command target read from `<file>:<symbol>`. */
export type SymbolTarget =
  | { readonly path: string; readonly symbol: string }
  | { readonly usage: string };

/**
 * owns: [[whygraph-targets]]
 * post: splits at the last `:` into a file and a symbol; the file is read from the repo root, an absolute path inside `root` is made relative to it, and `\` is not a separator.
 * post: returns a usage message for no `:` or an empty side, and for a file that lies outside `root` (`..` above it, or an absolute path elsewhere).
 */
export function readSymbolTarget(arg: string, root: string): SymbolTarget {
  const colon = arg.lastIndexOf(":");
  if (colon <= 0 || colon === arg.length - 1) return { usage: `"${arg}" is not <file>:<symbol>, such as src/main.ts:run` };
  const file = arg.slice(0, colon);
  const rel = posix.isAbsolute(file) ? posix.relative(root, file) : posix.normalize(file);
  if (rel === "" || rel === "." || rel === ".." || rel.startsWith("../") || posix.isAbsolute(rel)) return { usage: `"${file}" is outside the repo ${root}` };
  return { path: rel.replace(/^\.\//, ""), symbol: arg.slice(colon + 1) };
}

/** Levenshtein distance, capped work for long strings is not needed at name lengths. */
function distance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next.push(Math.min(row[j]! + 1, next[j - 1]! + 1, row[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1)));
    row = next;
  }
  return row[b.length]!;
}

/**
 * owns: [[whygraph-targets]]
 * post: up to `max` candidates closest to `wanted`: those that contain it or that it contains, ignoring case, first; then by edit distance, ignoring case; ties by text. A candidate further than half the length of `wanted` (at least 3) is left out unless it contains it.
 */
export function closest(wanted: string, candidates: readonly string[], max = 5): readonly string[] {
  const w = wanted.toLowerCase();
  const scored = candidates.map((c) => {
    const l = c.toLowerCase();
    const contains = l.includes(w) || w.includes(l);
    return { c, contains, d: distance(w, l) };
  });
  const limit = Math.max(3, Math.floor(w.length / 2));
  return scored
    .filter((s) => s.contains || s.d <= limit)
    .sort((a, b) => Number(b.contains) - Number(a.contains) || a.d - b.d || (a.c < b.c ? -1 : a.c > b.c ? 1 : 0))
    .slice(0, max)
    .map((s) => s.c);
}

/**
 * Explains a symbol target that the store does not hold.
 * owns: [[whygraph-targets]]
 * post: when the file is in the store: names the symbol as missing and lists the closest symbols of that file, or says the file has none.
 * post: when it is not: names the file as missing and lists the closest files, and the closest symbols named `symbol` anywhere.
 */
export function missingSymbol(target: { readonly path: string; readonly symbol: string }, files: readonly string[], symbolIds: readonly string[]): string {
  const ofFile = symbolIds.filter((id) => id.startsWith(`${target.path}#`)).map((id) => id.slice(target.path.length + 1));
  if (files.includes(target.path)) {
    if (ofFile.length === 0) return `${target.path} has no symbol ${target.symbol}: memod indexed no symbols in that file.`;
    const near = closest(target.symbol, ofFile);
    return `${target.path} has no symbol ${target.symbol}.${near.length > 0 ? ` Close: ${near.map((s) => `${target.path}:${s}`).join(", ")}.` : ` Its symbols: ${ofFile.slice(0, 10).join(", ")}${ofFile.length > 10 ? ", ..." : ""}.`}`;
  }
  const nearFiles = closest(target.path, files);
  const sameName = symbolIds.filter((id) => id.slice(id.lastIndexOf("#") + 1) === target.symbol).map((id) => id.replace(/#([^#]*)$/, ":$1"));
  const parts = [`No file ${target.path} in the graph.`];
  if (nearFiles.length > 0) parts.push(`Close files: ${nearFiles.join(", ")}.`);
  if (sameName.length > 0) parts.push(`Symbols named ${target.symbol}: ${sameName.slice(0, 5).join(", ")}.`);
  return parts.join(" ");
}

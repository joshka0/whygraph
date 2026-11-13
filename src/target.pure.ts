/**
 * module: [[whygraph-targets]]
 * boundary: pure
 * imports: node:path
 */
import { posix } from "node:path";

/** A command target read from `<file>:<symbol>` or `<file>:<start>-<end>`. */
export type SymbolTarget =
  | { readonly kind: "symbol"; readonly path: string; readonly symbol: string }
  | { readonly kind: "range"; readonly path: string; readonly start: number; readonly end: number }
  | { readonly usage: string };

/**
 * owns: [[whygraph-targets]]
 * post: splits at the last `:` into a file and a symbol or a line range; the file is read from the repo root, an absolute path inside `root` is made relative to it, and `\` is not a separator.
 * post: `<start>-<end>` is a 1-based inclusive range when both sides are digits; a symbol part that holds a `-` but is not such a range is a usage error, because no language memod reads allows `-` in an identifier.
 * post: returns a usage message for no `:` or an empty side, a file that lies outside `root` (`..` above it, or an absolute path elsewhere), a range that starts below 1, and a range whose start is after its end.
 */
export function readSymbolTarget(arg: string, root: string): SymbolTarget {
  const usage = `"${arg}" is not <file>:<symbol> or <file>:<start>-<end>, such as src/main.ts:run or src/main.ts:10-20`;
  const colon = arg.lastIndexOf(":");
  if (colon <= 0 || colon === arg.length - 1) return { usage };
  const file = arg.slice(0, colon);
  const rel = posix.isAbsolute(file) ? posix.relative(root, file) : posix.normalize(file);
  if (rel === "" || rel === "." || rel === ".." || rel.startsWith("../") || posix.isAbsolute(rel)) return { usage: `"${file}" is outside the repo ${root}` };
  const path = rel.replace(/^\.\//, "");
  const right = arg.slice(colon + 1);
  const range = /^(\d+)-(\d+)$/.exec(right);
  if (range !== null) {
    const start = Number(range[1]);
    const end = Number(range[2]);
    if (start < 1) return { usage: `"${arg}" starts at line ${start}; a line range is 1-based` };
    if (start > end) return { usage: `"${arg}" starts at line ${start} and ends at ${end}; a range's start must not be after its end` };
    return { kind: "range", path, start, end };
  }
  if (right.includes("-")) return { usage };
  return { kind: "symbol", path, symbol: right };
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

/**
 * module: [[whygraph-adr-reader]]
 * boundary: pure
 * imports: ./records.pure.ts
 */
import type { DecisionRecord } from "./records.pure.ts";

/** An ADR file: its name in the folder, its path from the repo root, and its text. */
export interface AdrFile {
  readonly name: string;
  readonly path: string;
  readonly text: string;
}

/** A commit as the ADR reader sees it: full id and message. */
export interface MessageCommit {
  readonly sha: string;
  readonly message: string;
}

/**
 * owns: [[whygraph-adr-reader]]
 * post: the ADR number of a file named `NNNN-<title>.md` (four digits), else undefined.
 */
export function adrNumber(name: string): number | undefined {
  const m = /^(\d{4})-[^/]+\.md$/.exec(name);
  return m === null ? undefined : Number(m[1]);
}

/**
 * owns: [[whygraph-adr-reader]]
 * post: `ADR-NNNN` with four digits.
 */
export function adrId(n: number): string {
  return `ADR-${String(n).padStart(4, "0")}`;
}

/** The numbers of the ADRs that `text` names as `ADR 12`, `ADR 0012` or `ADR-0012`, in any case. */
function namedAdrs(text: string): readonly number[] {
  return [...text.matchAll(/\bADR[ -]?(\d{1,4})\b/gi)].map((m) => Number(m[1]));
}

/**
 * Reads one ADR into a record.
 * owns: [[whygraph-adr-reader]]
 * post: title is the first `# ` heading without a leading `ADR <n>:`; the preamble is the text between it and the first `## ` heading.
 * post: date is the first `Date: YYYY-MM-DD` in the preamble, status the text after `Status:` in the preamble up to the end of its sentence, else the first line of a `## Status` section; each is null when absent.
 * post: topics are the `[[slug]]` links of the preamble; items are the `## ` sections other than Status, labelled by their heading in lower case, in file order.
 * post: supersedes holds the ADRs named after `Supersedes` or `Replaces` on one line; an ADR that says `Superseded by ADR <n>` is listed in ADR <n>'s supersedes by `adrRecords`, not here.
 * post: restsOn holds every other ADR the text names with a smaller number than its own, and not in supersedes.
 * decided: an ADR rests only on ADRs numbered before it, because a mention of a later ADR is a note added afterwards, and counting it would make two ADRs rest on each other
 */
export function adrRecord(file: AdrFile, commits: readonly string[]): DecisionRecord {
  const own = adrNumber(file.name)!;
  const lines = file.text.split("\n");
  const titleAt = lines.findIndex((l) => l.startsWith("# "));
  const firstSection = lines.findIndex((l) => l.startsWith("## "));
  const preamble = lines.slice(titleAt + 1, firstSection < 0 ? undefined : firstSection).join("\n");
  const title = titleAt < 0 ? null : lines[titleAt]!.slice(2).replace(/^ADR[ -]?\d+\s*[:.-]\s*/i, "").trim() || null;
  const sections: { label: string; text: string }[] = [];
  for (const [i, l] of lines.entries()) {
    if (!l.startsWith("## ")) continue;
    const end = lines.findIndex((m, j) => j > i && m.startsWith("## "));
    sections.push({ label: l.slice(3).trim().toLowerCase(), text: lines.slice(i + 1, end < 0 ? undefined : end).join("\n").trim() });
  }
  const date = /\bDate:\s*(\d{4}-\d{2}-\d{2})\b/.exec(preamble)?.[1] ?? null;
  const statusSection = sections.find((s) => s.label === "status");
  const status = /\bStatus:\s*([^.\n]+)/.exec(preamble)?.[1]?.trim() ?? (statusSection?.text.split("\n")[0]?.trim() || null);
  const supersedes = new Set<number>();
  for (const l of lines) {
    const m = /\b(?:supersedes|replaces)\b(.*)$/i.exec(l);
    if (m !== null && !/superseded by/i.test(l)) for (const n of namedAdrs(m[1]!)) if (n !== own) supersedes.add(n);
  }
  const restsOn = new Set(namedAdrs(file.text).filter((n) => n < own && !supersedes.has(n)));
  return {
    id: adrId(own),
    title,
    date,
    status,
    source: file.path,
    items: sections.filter((s) => s.label !== "status").map((s) => ({ label: s.label, text: s.text })),
    topics: [...new Set([...preamble.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1]!))],
    restsOn: [...restsOn].sort((a, b) => a - b).map(adrId),
    supersedes: [...supersedes].sort((a, b) => a - b).map(adrId),
    commits,
  };
}

/**
 * Reads every ADR of a folder into records.
 * owns: [[whygraph-adr-reader]]
 * post: one record per file named `NNNN-<title>.md`, sorted by number; other files are returned in `skipped`.
 * post: a record's commits are the commits that changed its file (`changedBy[path]`) and the commits whose message names its number as `ADR <n>` or names its file name, without repeats, in the order of `commits` (newest first, as git lists them), then any changing commit not in `commits`.
 * post: `Superseded by ADR <n>` in ADR m adds m to ADR n's supersedes when ADR n is in the folder.
 */
export function adrRecords(files: readonly AdrFile[], commits: readonly MessageCommit[], changedBy: ReadonlyMap<string, readonly string[]>): { readonly records: readonly DecisionRecord[]; readonly skipped: readonly string[] } {
  const adrs = files.filter((f) => adrNumber(f.name) !== undefined).sort((a, b) => adrNumber(a.name)! - adrNumber(b.name)!);
  const skipped = files.filter((f) => adrNumber(f.name) === undefined).map((f) => f.name).sort();
  const records = adrs.map((f) => {
    const n = adrNumber(f.name)!;
    const changed = new Set(changedBy.get(f.path) ?? []);
    const naming = new RegExp(`\\bADR[ -]?0*${n}\\b|${f.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
    const cited = commits.filter((c) => changed.has(c.sha) || naming.test(c.message)).map((c) => c.sha);
    const rest = [...changed].filter((s) => !cited.includes(s)).sort();
    return adrRecord(f, [...cited, ...rest]);
  });
  const ids = new Set(records.map((r) => r.id));
  const lateSupersedes = new Map<string, Set<string>>();
  for (const f of adrs) {
    for (const m of f.text.matchAll(/superseded by\s+ADR[ -]?(\d{1,4})\b/gi)) {
      const by = adrId(Number(m[1]));
      const old = adrId(adrNumber(f.name)!);
      if (ids.has(by) && by !== old) lateSupersedes.set(by, (lateSupersedes.get(by) ?? new Set()).add(old));
    }
  }
  return {
    records: records.map((r) => {
      const more = lateSupersedes.get(r.id);
      if (more === undefined) return r;
      const supersedes = [...new Set([...r.supersedes, ...more])].sort();
      return { ...r, supersedes, restsOn: r.restsOn.filter((id) => !supersedes.includes(id)) };
    }),
    skipped,
  };
}

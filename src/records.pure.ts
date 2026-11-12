/**
 * module: [[whygraph-decision-records]]
 * boundary: pure
 * imports: none
 * decided: one decisions file format for every source, because the graph and the recipes then know one record shape and a new source only writes a converter
 */

/** One statement of a record: a label such as `decided` or `context`, and its text. */
export interface Item {
  readonly label: string;
  readonly text: string;
}

/** A decision record, as a decisions file holds it. */
export interface DecisionRecord {
  readonly id: string;
  readonly title: string | null;
  /** `YYYY-MM-DD`, or null when the source states no date. */
  readonly date: string | null;
  readonly status: string | null;
  /** Where the record lives: a path or a reference. Null means the decisions file itself. */
  readonly source: string | null;
  readonly items: readonly Item[];
  readonly topics: readonly string[];
  readonly restsOn: readonly string[];
  readonly supersedes: readonly string[];
  readonly commits: readonly string[];
}

/** A record and the decisions file it came from. */
export interface SourcedRecord {
  readonly record: DecisionRecord;
  readonly file: string;
}

const FIELDS = ["id", "title", "date", "status", "source", "items", "topics", "restsOn", "supersedes", "commits"];
const LISTS = ["topics", "restsOn", "supersedes", "commits"] as const;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const nullableString = (v: unknown): v is string | null | undefined => v === undefined || v === null || typeof v === "string";

/**
 * owns: [[whygraph-decision-records]]
 * post: returns the records of a decisions file `{ "records": [...] }`, or every problem found, each naming `file` and the record index or id.
 * post: `id` is a non-empty string; `date` is `YYYY-MM-DD` or null and must be present; `title`, `status` and `source` are strings or null; `items` holds `{label, text}` strings; `topics`, `restsOn`, `supersedes` and `commits` are string lists. Missing optional fields read as null or empty.
 * post: an unknown field is a problem, so a misspelt field never drops data silently.
 */
export function readDecisionsFile(file: string, value: unknown): { readonly records: readonly DecisionRecord[] } | { readonly problems: readonly string[] } {
  if (!isObject(value) || !Array.isArray(value.records)) return { problems: [`${file}: a decisions file is a JSON object with a "records" array`] };
  const extra = Object.keys(value).filter((k) => k !== "records");
  const problems: string[] = extra.map((k) => `${file}: unknown top-level field "${k}"`);
  const records: DecisionRecord[] = [];
  for (const [i, r] of value.records.entries()) {
    const where = `${file}: record ${i}${isObject(r) && typeof r.id === "string" ? ` (${r.id})` : ""}`;
    if (!isObject(r)) {
      problems.push(`${where}: not an object`);
      continue;
    }
    const before = problems.length;
    for (const k of Object.keys(r)) if (!FIELDS.includes(k)) problems.push(`${where}: unknown field "${k}"`);
    if (typeof r.id !== "string" || r.id.trim() === "") problems.push(`${where}: "id" must be a non-empty string`);
    if (!("date" in r)) problems.push(`${where}: "date" is missing (write null when the source states none)`);
    else if (r.date !== null && (typeof r.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.date))) problems.push(`${where}: "date" must be YYYY-MM-DD or null`);
    for (const k of ["title", "status", "source"]) if (!nullableString(r[k])) problems.push(`${where}: "${k}" must be a string or null`);
    const items = r.items ?? [];
    if (!Array.isArray(items) || !items.every((it) => isObject(it) && typeof it.label === "string" && typeof it.text === "string")) problems.push(`${where}: "items" must be a list of {"label", "text"} strings`);
    for (const k of LISTS) {
      const list = r[k] ?? [];
      if (!Array.isArray(list) || !list.every((s) => typeof s === "string" && s !== "")) problems.push(`${where}: "${k}" must be a list of non-empty strings`);
    }
    if (problems.length > before) continue;
    const list = (k: (typeof LISTS)[number]): readonly string[] => [...new Set((r[k] as string[] | undefined) ?? [])];
    records.push({
      id: r.id as string,
      title: (r.title as string | null | undefined) ?? null,
      date: r.date as string | null,
      status: (r.status as string | null | undefined) ?? null,
      source: (r.source as string | null | undefined) ?? null,
      items: ((r.items as Item[] | undefined) ?? []).map((it) => ({ label: it.label, text: it.text })),
      topics: list("topics"),
      restsOn: list("restsOn"),
      supersedes: list("supersedes"),
      commits: list("commits"),
    });
  }
  return problems.length > 0 ? { problems } : { records };
}

/** How one cited commit id resolved against the commits of the code graph. */
export type CommitMatch = { readonly sha: string } | { readonly unknown: true } | { readonly ambiguous: readonly string[] };

/**
 * owns: [[whygraph-decision-records]]
 * post: a cited id of 4 to 40 hex digits matches the commits whose full id starts with it, ignoring case; one match resolves it, none is unknown, more is ambiguous (matches sorted).
 * post: any other text is unknown.
 * decided: an ambiguous short id links to no commit, because a guess would tie a decision to code it never touched
 */
export function matchCommit(cited: string, shas: readonly string[]): CommitMatch {
  const id = cited.toLowerCase();
  if (!/^[0-9a-f]{4,40}$/.test(id)) return { unknown: true };
  const found = shas.filter((s) => s.startsWith(id)).sort();
  if (found.length === 1) return { sha: found[0]! };
  return found.length === 0 ? { unknown: true } : { ambiguous: found };
}

/** The checked set of records: what loads, and what was dropped with a warning. */
export interface CheckedRecords {
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly records: readonly DecisionRecord[];
  /** Resolved full commit ids per record id, sorted. */
  readonly cites: ReadonlyMap<string, readonly string[]>;
}

/**
 * owns: [[whygraph-decision-records]]
 * post: errors: an id that two records share (naming both files), and every `supersedes` cycle, a record that supersedes itself included (naming the ids in cycle order, starting at the smallest).
 * post: warnings, each naming the record: a `restsOn` or `supersedes` id that no record has (the link is dropped), a cited commit that matches no commit or more than one (the link is dropped).
 * post: records are returned sorted by id; warnings and errors are sorted, so the same input gives the same output.
 * decided: a supersedes cycle fails the build and a dangling reference only warns, because a cycle makes "which record is current" unanswerable while a missing record only hides one link
 */
export function checkRecords(sourced: readonly SourcedRecord[], shas: readonly string[]): CheckedRecords {
  const errors: string[] = [];
  const warnings: string[] = [];
  const byId = new Map<string, SourcedRecord>();
  for (const s of sourced) {
    const first = byId.get(s.record.id);
    if (first === undefined) byId.set(s.record.id, s);
    else errors.push(`record id "${s.record.id}" appears twice: in ${first.file} and in ${s.file}`);
  }
  const records = [...byId.values()].map((s) => s.record).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const kept: DecisionRecord[] = [];
  const cites = new Map<string, readonly string[]>();
  for (const r of records) {
    const known = (field: "restsOn" | "supersedes") =>
      r[field].filter((id) => {
        if (byId.has(id)) return true;
        warnings.push(`record ${r.id}: ${field} "${id}" names no record; the link is dropped`);
        return false;
      });
    const restsOn = known("restsOn");
    const supersedes = known("supersedes");
    const linked = new Set<string>();
    for (const c of r.commits) {
      const m = matchCommit(c, shas);
      if ("sha" in m) linked.add(m.sha);
      else if ("ambiguous" in m) warnings.push(`record ${r.id}: commit "${c}" matches ${m.ambiguous.length} commits (${m.ambiguous.join(", ")}); the link is dropped`);
      else warnings.push(`record ${r.id}: commit "${c}" matches no commit reachable from HEAD; the link is dropped`);
    }
    cites.set(r.id, [...linked].sort());
    kept.push({ ...r, restsOn, supersedes });
  }
  errors.push(...supersedesCycles(kept).map((c) => `supersedes cycle: ${[...c, c[0]].join(" -> ")}`));
  return { errors: errors.sort(), warnings: warnings.sort(), records: kept, cites };
}

/**
 * owns: [[whygraph-decision-records]]
 * post: every elementary cycle of `supersedes` links found by a depth-first walk from each record in id order, each rotated to start at its smallest id and reported once.
 */
export function supersedesCycles(records: readonly DecisionRecord[]): readonly (readonly string[])[] {
  const next = new Map(records.map((r) => [r.id, [...r.supersedes].sort()]));
  const found = new Map<string, readonly string[]>();
  const walk = (path: string[]): void => {
    for (const to of next.get(path.at(-1)!) ?? []) {
      const at = path.indexOf(to);
      if (at >= 0) {
        const cycle = path.slice(at);
        const start = cycle.indexOf([...cycle].sort()[0]!);
        const rotated = [...cycle.slice(start), ...cycle.slice(0, start)];
        found.set(rotated.join("\0"), rotated);
      } else walk([...path, to]);
    }
  };
  for (const id of [...next.keys()].sort()) walk([id]);
  return [...found.keys()].sort().map((k) => found.get(k)!);
}

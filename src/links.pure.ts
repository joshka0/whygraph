/**
 * module: [[whygraph-decision-links]]
 * boundary: pure
 * imports: ./code-graph.pure.ts
 * decided: a record links to code only where someone named it on purpose (a decided: tag that names its id, a `Decision: <id>` commit trailer, or a commit listed in the record, which for an ADR is a commit that changed its file), because a passing mention in a commit message tied a record to every symbol that commit changed
 */
import { symbolParts, type CodeGraph } from "./code-graph.pure.ts";

const ADR_ID = /^ADR-\d{4}$/;
/** `adr-0004`, `ADR-0004` or `ADR 0004`: exactly four digits, not inside a longer word or number. */
const ADR_NAME = /(?<![A-Za-z0-9_-])(?:ADR|adr)[- ](\d{4})(?![A-Za-z0-9_-])/g;
/** The characters an id is never next to where a text names it. */
const ID_CHAR = /[A-Za-z0-9_-]/;

/**
 * The record ids that a decided: tag's text names.
 * owns: [[whygraph-decision-links]]
 * post: an ADR id `ADR-NNNN` is named by `adr-NNNN`, `ADR-NNNN` or `ADR NNNN`: the letters all lower or all upper case, one `-` or space, exactly four digits, and neither side next to a letter, digit, `_` or `-`.
 * post: any other id is named only by its exact text, case included, with neither side next to a letter, digit, `_` or `-`.
 * post: `named` holds the ids in `ids` that the text names, sorted; `unknownAdrs` holds the ADR ids it names in the ADR form that `ids` lacks, sorted.
 * decided: a near match never links (`ADR 4`, `Adr-0004`, `ADR-00041`, `note-10` for `note-1`), because a wrong link presents noise as the reason for code
 */
export function namedRecords(text: string, ids: ReadonlySet<string>): { readonly named: readonly string[]; readonly unknownAdrs: readonly string[] } {
  const named = new Set<string>();
  const unknown = new Set<string>();
  for (const m of text.matchAll(ADR_NAME)) {
    const id = `ADR-${m[1]}`;
    (ids.has(id) ? named : unknown).add(id);
  }
  for (const id of ids) {
    if (ADR_ID.test(id) || named.has(id)) continue;
    for (let at = text.indexOf(id); at >= 0; at = text.indexOf(id, at + 1)) {
      if (!ID_CHAR.test(text[at - 1] ?? " ") && !ID_CHAR.test(text[at + id.length] ?? " ")) {
        named.add(id);
        break;
      }
    }
  }
  return { named: [...named].sort(), unknownAdrs: [...unknown].sort() };
}

/** A decided: tag (its hash) that names a decision record. */
export interface TagLink {
  readonly hash: string;
  readonly id: string;
}

/**
 * The links from the decided: tags of a code graph to the records that each names.
 * owns: [[whygraph-decision-links]]
 * post: one link per (tag, record) that `namedRecords` finds in the tag's full text, sorted by hash then id.
 * post: one warning per tag and ADR id it names that no record has, naming the symbols and files that carry the tag; sorted.
 */
export function tagLinks(graph: CodeGraph, ids: ReadonlySet<string>): { readonly links: readonly TagLink[]; readonly warnings: readonly string[] } {
  const links: TagLink[] = [];
  const warnings: string[] = [];
  for (const n of graph.nodes) {
    if (n.kind !== "decision") continue;
    const hash = n.id.slice("decision:".length);
    const { named, unknownAdrs } = namedRecords(n.name, ids);
    links.push(...named.map((id) => ({ hash, id })));
    if (unknownAdrs.length === 0) continue;
    const carriers = graph.edges
      .filter((e) => e.kind === "decided" && e.to === n.id)
      .map((e) => (e.from.startsWith("symbol:") ? shownSymbol(e.from.slice("symbol:".length)) : e.from.slice(e.from.indexOf(":") + 1)))
      .sort();
    for (const id of unknownAdrs) warnings.push(`decided tag on ${carriers.join(", ") || "(no carrier)"} names ${id}, which no record has; no link`);
  }
  return { links: links.sort((a, b) => (a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0)), warnings: warnings.sort() };
}

function shownSymbol(name: string): string {
  const p = symbolParts(name);
  return `${p.path}:${p.name}`;
}

/** A commit and the values of its `Decision:` trailers. */
export interface CommitTrailers {
  readonly sha: string;
  readonly decisions: readonly string[];
}

/**
 * The record ids that commits name through `Decision: <id>` trailers, added to the commits each record lists.
 * owns: [[whygraph-decision-links]]
 * post: a trailer value links its commit to the record whose id equals it exactly, case included, after trimming spaces; a short, partial or differently cased id links nothing.
 * post: `cites` holds, per record id of `cited`, its listed commits and its trailer commits, without repeats, sorted.
 * post: one warning per trailer value that names no record, naming the commit's short id; sorted.
 */
export function trailerCites(trailers: readonly CommitTrailers[], cited: ReadonlyMap<string, readonly string[]>): { readonly cites: ReadonlyMap<string, readonly string[]>; readonly warnings: readonly string[] } {
  const cites = new Map([...cited].map(([id, shas]) => [id, new Set(shas)]));
  const warnings: string[] = [];
  for (const t of trailers) {
    for (const raw of t.decisions) {
      const id = raw.trim();
      const set = cites.get(id);
      if (set !== undefined) set.add(t.sha);
      else warnings.push(`commit ${t.sha.slice(0, 7)}: trailer "Decision: ${id}" names no record; no link`);
    }
  }
  return { cites: new Map([...cites].map(([id, shas]) => [id, [...shas].sort()])), warnings: [...new Set(warnings)].sort() };
}

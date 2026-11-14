/**
 * module: [[whygraph-questions]]
 * boundary: io
 * decided: the commands run the same recipe files that `whygraph mcp` prints, because an agent that queries the store itself must get the answer the CLI gives
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { carryAnswer, carryRangeAnswer, impactAnswer, shown, whyAnswer, type RangeSymbol, type Row, type TermCandidate, type TermSection } from "./answers.pure.ts";
import { fail, type Exit } from "./build.ts";
import { fuse, firstLine, searchAnswer, searchWords } from "./search.pure.ts";
import { applyRerank, rerankAnswer, rerankDocuments, rerankFailure, rerankQuery, RERANK_MIN, searchAtAnswer, searchRecords, type RerankCode } from "./rerank.pure.ts";
import { callRerank, endpointHost, rerankSettings } from "./rerank.ts";
import { closest, missingSymbol, readSymbolTarget } from "./target.pure.ts";
import { symbolSource, termsOf } from "./terms.pure.ts";
import { readQuery } from "./tools.ts";
import { embedTexts, ModelUnavailable } from "./embed.ts";

const RECIPES = new URL("../recipes/", import.meta.url);

/**
 * owns: [[whygraph-questions]]
 * post: the text of `recipes/<name>.cypher`.
 */
export function recipe(name: string): string {
  return readFileSync(new URL(`${name}.cypher`, RECIPES), "utf8");
}

/** The names of every recipe, sorted. */
function recipeNames(): readonly string[] {
  return readdirSync(RECIPES)
    .filter((f) => f.endsWith(".cypher"))
    .map((f) => f.slice(0, -".cypher".length))
    .sort();
}

function noStore(store: string): Exit {
  return fail(`no store at ${store}; run whygraph build first`);
}

/**
 * Answers `why`, `impact` or `carry` from the store.
 * owns: [[whygraph-questions]]
 * post: exit 0 with the answer on stdout; exit 2 for a target that is not `<file>:<symbol>` (or, for carry, `<file>:<start>-<end>`) or lies outside the repo, and for a line range on why or impact; exit 3 when the store has no such symbol or decision, with a message that names it and close names; exit 1 when there is no store.
 */
export function ask(command: "why" | "impact" | "carry", target: string, root: string, store: string): Exit {
  if (!existsSync(store)) return noStore(store);
  const names = readQuery(store, recipe("names"));
  const of = (kind: string) => names.filter((n) => n.kind === kind).map((n) => String(n.name));
  if (command === "impact") {
    const ids = of("decision");
    if (!ids.includes(target)) {
      if (ids.length === 0) return fail(`no decision record ${target}: the store holds no decision records; build with --decisions <file>`, 3);
      const near = closest(target, ids);
      return fail(`no decision record ${target}.${near.length > 0 ? ` Close: ${near.join(", ")}.` : ` Records: ${ids.slice(0, 10).join(", ")}${ids.length > 10 ? ", ..." : ""}.`}`, 3);
    }
    console.log(impactAnswer(target, readQuery(store, recipe("impact"), { decision: target })));
    return 0;
  }
  const t = readSymbolTarget(target, root);
  if ("usage" in t) return fail(t.usage, 2);
  if (t.kind === "range") {
    if (command !== "carry") return fail(`${command} takes <file>:<symbol>, not a line range; the range form is for carry`, 2);
    return askRange(store, root, t, names);
  }
  const id = `${t.path}#${t.symbol}`;
  if (!of("symbol").includes(id)) return fail(missingSymbol(t, of("file"), of("symbol")), 3);
  const why = readQuery(store, recipe("why"), { symbol: id });
  if (command === "why") console.log(whyAnswer(id, why));
  else {
    const carry = readQuery(store, recipe("carry"), { symbol: id })[0]!;
    console.log(carryAnswer(id, carry, why, readQuery(store, recipe("users"), { symbol: id }), termSection(store, root, carry)));
  }
  return 0;
}

/**
 * Answers `carry <file>:<start>-<end>`: the term section over exactly those lines, plus every symbol whose stored range overlaps them.
 * owns: [[whygraph-questions]]
 * post: exit 0 with the answer; exit 1 when the working-tree file cannot be read; exit 2 when the range is past the end of the file.
 * post: a file with no symbol still gets the term section; the answer says no symbol covers the lines.
 */
function askRange(store: string, root: string, t: { readonly path: string; readonly start: number; readonly end: number }, names: readonly Row[]): Exit {
  let text: string;
  try {
    text = readFileSync(join(root, t.path), "utf8");
  } catch (e) {
    return fail(`cannot read ${t.path}: ${(e as Error).message}`, 1);
  }
  const lines = text.split("\n");
  if (t.end > lines.length) return fail(`${t.path} has ${lines.length} line${lines.length === 1 ? "" : "s"}, so ${t.start}-${t.end} is past its end`, 2);
  const overlapping = names
    .filter((n) => n.kind === "symbol" && n.path === t.path && Number.isInteger(n.line) && Number.isInteger(n.endLine) && Number(n.line) <= t.end && Number(n.endLine) >= t.start)
    .map((n) => ({ id: String(n.name), line: Number(n.line), endLine: Number(n.endLine) }))
    .sort((a, b) => a.line - b.line || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const symbols: RangeSymbol[] = overlapping.map((s) => ({
    ...s,
    carry: readQuery(store, recipe("carry"), { symbol: s.id })[0]!,
    why: readQuery(store, recipe("why"), { symbol: s.id }),
    users: readQuery(store, recipe("users"), { symbol: s.id }),
  }));
  console.log(carryRangeAnswer(t.path, t.start, t.end, symbols, termSectionForLines(store, lines, t.start, t.end)));
  return 0;
}

/** The candidate records of a terms-recipe result, as the answer prints them. */
function termCandidates(rows: readonly Row[]): readonly TermCandidate[] {
  return rows.map((r) => ({ id: String(r.id), date: r.date === null || r.date === undefined ? "" : String(r.date), title: r.title === null || r.title === undefined ? "" : String(r.title), source: r.source === null || r.source === undefined ? "" : String(r.source), shared: Array.isArray(r.shared) ? r.shared.map(String) : [] }));
}

/**
 * The term section over exactly `lines[start-1..end-1]` of one file, for the range form.
 * owns: [[whygraph-questions]]
 * post: tokenizes those lines alone, with no symbol name or file path added, runs the terms recipe, and returns its rows or a one-line note when the lines hold no term or no record shares one.
 */
function termSectionForLines(store: string, lines: readonly string[], start: number, end: number): TermSection {
  const terms = [...new Set(termsOf(lines.slice(start - 1, end).join("\n")))];
  if (terms.length === 0) return { kind: "note", note: "No term section: these lines hold no term of three or more characters." };
  const rows = readQuery(store, recipe("terms"), { terms });
  if (rows.length === 0) return { kind: "note", note: "No decision record shares a distinctive term with these lines." };
  return { kind: "records", rows: termCandidates(rows) };
}

/**
 * The longest symbol, in source lines, whose term section still lists candidates.
 * decided: a symbol longer than LONG_SYMBOL lines gets a one-line note naming the range form instead, because the memoryd check (ADR 0002) shows a wide span drowns the shared terms: FolderIndex (362 lines) ranked the wanted record 40 and Transcript (329 lines) 580, against 1 for the 13-line privateFiles.
 */
const LONG_SYMBOL = 40;

/**
 * The term section of a carry answer: the record candidates from `recipes/terms.cypher`, or one line saying why there are none.
 * owns: [[whygraph-questions]]
 * post: reads the symbol's `line`..`endLine` from the working tree at `root`, adds its name and file path, tokenizes that, and runs the terms recipe; a graph with no line range, a file that is gone, a span that no longer fits the file, and a symbol with no term each give a one-line note instead of a query.
 * post: a symbol whose term list matches no kept term gives a one-line note, and never an empty heading.
 */
function termSection(store: string, root: string, carry: Row): TermSection {
  const symbol = String(carry.symbol);
  const file = String(carry.file);
  const line = Number(carry.line);
  const endLine = Number(carry.endLine);
  if (!Number.isInteger(line) || line < 1 || !Number.isInteger(endLine) || endLine < line) return { kind: "note", note: `No term section: the graph holds no source line range for ${shown(symbol)}.` };
  let text: string;
  try {
    text = readFileSync(join(root, file), "utf8");
  } catch {
    return { kind: "note", note: `No term section: its file ${file} is not in the working tree.` };
  }
  const lines = text.split("\n");
  const source = symbolSource(lines, line, endLine);
  if (source === undefined) return { kind: "note", note: `No term section: ${file} has ${lines.length} lines, so the stored range ${line}-${endLine} no longer fits; rebuild the store for the file as it is now.` };
  const span = endLine - line + 1;
  if (span > LONG_SYMBOL) return { kind: "note", note: `This symbol spans ${span} lines; a long symbol gives weak term candidates. Ask with a range: whygraph carry ${file}:<start>-<end>.` };
  const terms = [...new Set(termsOf([...source, symbol.slice(symbol.lastIndexOf("#") + 1), file].join("\n")))];
  if (terms.length === 0) return { kind: "note", note: "No term section: its code holds no term of three or more characters." };
  const rows = readQuery(store, recipe("terms"), { terms });
  if (rows.length === 0) return { kind: "note", note: "No decision record shares a distinctive term with its code." };
  return { kind: "records", rows: termCandidates(rows) };
}

/**
 * The first statement of each decision record named by `$ids`, for the documents a rerank call sends.
 * Not a recipe: it answers no question an MCP host asks, it only fills in the first statement that `recipes/terms.cypher` does not return.
 */
const FIRST_STATEMENTS = `UNWIND $ids AS id
MATCH (d:Decision {id: id})
OPTIONAL MATCH (d)-[:STATES]->(i:Item)
WITH d, i ORDER BY i.ord
WITH d, collect(i)[0] AS first
RETURN d.id AS id, first.text AS statement`;

/**
 * Answers `whygraph search`.
 * owns: [[whygraph-questions]]
 * post: exit 0 with the decision records that best match the request: the word search and the meaning search each rank at most ten (`LIST_SIZE`), fused by reciprocal rank into one list of at most twenty, each candidate saying how it matched; exit 2 when the request holds no word, and for `--at`, when it is not `<file>:<start>-<end>`, when the range starts after its end or below 1, or when it is past the end of the file; exit 1 when there is no store, when the embedding model is unavailable, or when the `--at` file cannot be read.
 * post: with `--at`, the candidates are the fused list plus the term list of those lines, each record once; without a reranker the fused list prints as now and the term candidates not already listed follow under the range form's term heading.
 * post: when `WHYGRAPH_RERANK` names a model and at least six candidates exist, one `fetch` to the endpoint ranks them and the five it keeps print in its order, with the line that says what was sent and where; any failure of that call prints the wide answer and one line naming the failure, exit 0.
 */
export async function search(text: string, store: string, root: string, at: string | undefined): Promise<Exit> {
  if (!existsSync(store)) return noStore(store);
  const words = searchWords(text);
  if (words === "") return fail("search needs a request with at least one word", 2);
  let code: RerankCode | undefined;
  let term: TermSection | undefined;
  if (at !== undefined) {
    const t = readSymbolTarget(at, root);
    if ("usage" in t) return fail(t.usage, 2);
    if (t.kind === "symbol") return fail(`--at takes <file>:<start>-<end>, not a symbol`, 2);
    let source: string;
    try {
      source = readFileSync(join(root, t.path), "utf8");
    } catch (e) {
      return fail(`cannot read ${t.path}: ${(e as Error).message}`, 1);
    }
    const lines = source.split("\n");
    if (t.end > lines.length) return fail(`${t.path} has ${lines.length} line${lines.length === 1 ? "" : "s"}, so ${t.start}-${t.end} is past its end`, 2);
    code = { path: t.path, start: t.start, end: t.end, lines };
    term = termSectionForLines(store, lines, t.start, t.end);
  }
  let vector: readonly number[];
  try {
    vector = (await embedTexts([text]))[0]!;
  } catch (e) {
    if (e instanceof ModelUnavailable) return fail(e.message);
    throw e;
  }
  const wordRows = readQuery(store, recipe("search"), { text: words });
  const meaningRows = readQuery(store, recipe("meaning"), { vector });
  const fused = fuse(wordRows, meaningRows);
  const wide = code === undefined || term === undefined ? searchAnswer(text, words, true, fused) : searchAtAnswer(text, words, fused, term);
  const settings = rerankSettings();
  if (settings === undefined) {
    console.log(wide);
    return 0;
  }
  const termRows = term?.kind === "records" ? term.rows : [];
  if (searchRecords(fused, termRows).length < RERANK_MIN) {
    console.log(wide);
    return 0;
  }
  const fusedIds = new Set(fused.map((c) => c.id));
  const missing = termRows.filter((t) => !fusedIds.has(t.id)).map((t) => t.id);
  const statements = new Map<string, string>();
  if (missing.length > 0) for (const row of readQuery(store, FIRST_STATEMENTS, { ids: missing })) statements.set(String(row.id), firstLine(String(row.statement ?? "")));
  const candidates = searchRecords(fused, termRows, statements);
  const call = await callRerank(settings, rerankQuery(text, code), rerankDocuments(candidates));
  if (!call.ok) {
    console.log(`${wide}\n${rerankFailure(call.reason)}`);
    return 0;
  }
  const picked = applyRerank(candidates, call.value);
  if (!picked.ok) {
    console.log(`${wide}\n${rerankFailure(picked.reason)}`);
    return 0;
  }
  console.log(rerankAnswer(settings.model, endpointHost(settings.endpoint), candidates.length, picked.records, code));
  return 0;
}

/**
 * Prints how an MCP host serves the store, and the recipes an agent follows.
 * owns: [[whygraph-questions]]
 * post: exit 0 with a JSON `mcpServers` entry that runs `relate serve --mcp stdio --read-only` on the store with telemetry off, then each recipe file under its name.
 * post: exit 1 when there is no store.
 */
export function mcp(store: string): Exit {
  if (!existsSync(store)) return noStore(store);
  const config = {
    mcpServers: {
      whygraph: {
        command: "relate",
        args: ["serve", "--mcp", "stdio", "--database", store, "--read-only"],
        env: { RELATE_TELEMETRY: "0", DO_NOT_TRACK: "1" },
      },
    },
  };
  const out = [
    "MCP server config (add it to your MCP host; it serves the store read-only with the tools get_schema and read_cypher):",
    "",
    JSON.stringify(config, null, 2),
    "",
    "Recipes: call read_cypher with a recipe as `statement` and its parameters as `parameters`, such as {\"symbol\": \"src/main.ts#run\"}. A symbol id is \"<file>#<name>\", the file path from the repo root.",
    "To answer why: why. Before an edit: carry, why and users. When a decision changes: impact. To find a record by its text: search (words), and meaning (a 384-float vector the caller supplies). To rank records by the terms of a symbol's code: terms (a list of the symbol's terms). To check a name: names.",
  ];
  for (const name of recipeNames()) out.push("", `== ${name}`, recipe(name).trimEnd());
  console.log(out.join("\n"));
  return 0;
}

/**
 * module: [[whygraph-questions]]
 * boundary: io
 * decided: the commands run the same recipe files that `whygraph mcp` prints, because an agent that queries the store itself must get the answer the CLI gives
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { carryAnswer, impactAnswer, whyAnswer } from "./answers.pure.ts";
import { fail, type Exit } from "./build.ts";
import { closest, missingSymbol, readSymbolTarget } from "./target.pure.ts";
import { readQuery } from "./tools.ts";

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
 * post: exit 0 with the answer on stdout; exit 2 for a target that is not `<file>:<symbol>` or lies outside the repo; exit 3 when the store has no such symbol or decision, with a message that names it and close names; exit 1 when there is no store.
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
  const id = `${t.path}#${t.symbol}`;
  if (!of("symbol").includes(id)) return fail(missingSymbol(t, of("file"), of("symbol")), 3);
  const why = readQuery(store, recipe("why"), { symbol: id });
  if (command === "why") console.log(whyAnswer(id, why));
  else console.log(carryAnswer(id, readQuery(store, recipe("carry"), { symbol: id })[0]!, why, readQuery(store, recipe("users"), { symbol: id })));
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
    "To answer why: why. Before an edit: carry, why and users. When a decision changes: impact. To check a name: names.",
  ];
  for (const name of recipeNames()) out.push("", `== ${name}`, recipe(name).trimEnd());
  console.log(out.join("\n"));
  return 0;
}

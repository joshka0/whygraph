/**
 * module: [[whygraph-cli]]
 * boundary: pure
 * imports: none
 */

/** A command line read into a command and its options. */
export type Args =
  | { readonly command: "help" }
  | { readonly command: "build"; readonly repo?: string; readonly store?: string; readonly decisions: readonly string[] }
  | { readonly command: "decisions"; readonly target: string }
  | { readonly command: "why" | "impact" | "carry"; readonly target: string; readonly repo?: string; readonly store?: string }
  | { readonly command: "mcp"; readonly repo?: string; readonly store?: string };

/**
 * owns: [[whygraph-cli]]
 * post: reads `build`, `decisions adr <folder>`, `why|carry <file>:<symbol>`, `impact <id>`, `mcp` and `help`; `--repo` and `--store` take one value each and may appear once; `--decisions` (build only) may repeat.
 * post: anything else returns a usage message that names the first argument it could not read.
 */
export function readArgs(argv: readonly string[]): Args | { readonly usage: string } {
  const [command, ...rest] = argv;
  if (command === undefined || command === "help" || command === "--help" || command === "-h") return { command: "help" };
  const positional: string[] = [];
  const options: Record<string, string> = {};
  const decisions: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === "--repo" || a === "--store" || a === "--decisions") {
      const v = rest[++i];
      if (v === undefined) return { usage: `${a} needs a value` };
      if (a === "--decisions") decisions.push(v);
      else if (options[a] !== undefined) return { usage: `${a} given twice` };
      else options[a] = v;
    } else if (a.startsWith("--")) return { usage: `unknown option ${a}` };
    else positional.push(a);
  }
  const repo = options["--repo"];
  const store = options["--store"];
  const extra = (n: number) => (positional.length > n ? { usage: `unexpected argument ${positional[n]}` } : undefined);
  const noDecisions = command !== "build" && decisions.length > 0 ? { usage: "--decisions is a build option" } : undefined;
  switch (command) {
    case "build":
      return extra(0) ?? { command, repo, store, decisions };
    case "decisions":
      if (positional[0] !== "adr" || positional[1] === undefined) return { usage: "decisions takes: adr <folder>" };
      if (repo !== undefined || store !== undefined) return { usage: "decisions adr takes only a folder" };
      return noDecisions ?? extra(2) ?? { command, target: positional[1] };
    case "why":
    case "impact":
    case "carry":
      if (positional[0] === undefined) return { usage: `${command} needs a ${command === "impact" ? "decision id" : "<file>:<symbol>"}` };
      return noDecisions ?? extra(1) ?? { command, target: positional[0], repo, store };
    case "mcp":
      return noDecisions ?? extra(0) ?? { command, repo, store };
    default:
      return { usage: `unknown command ${command}` };
  }
}

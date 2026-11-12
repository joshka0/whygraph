/**
 * module: [[whygraph-child-processes]]
 * boundary: io
 * decided: whygraph calls the relate, memod and git CLIs as child processes and adds no runtime dependency, because each CLI already owns its contract and a client package would pin a second copy of it
 */
import { spawnSync } from "node:child_process";

/** The outcome of one child process. */
export interface Run {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * A tool that could not run at all, with the message for the user.
 * owns: [[whygraph-child-processes]]
 */
export class ToolMissing extends Error {}

/**
 * owns: [[whygraph-child-processes]]
 * post: runs `command` with `args` in `cwd`, feeding `input`; output is captured as text.
 * post: throws ToolMissing naming the command when it is not on PATH.
 */
export function run(command: string, args: readonly string[], options: { readonly cwd?: string; readonly input?: string; readonly env?: Readonly<Record<string, string>> } = {}): Run {
  const r = spawnSync(command, args, {
    cwd: options.cwd,
    input: options.input,
    encoding: "utf8",
    maxBuffer: 1 << 30,
    env: { ...process.env, ...options.env },
  });
  if (r.error !== undefined) {
    if ((r.error as NodeJS.ErrnoException).code === "ENOENT") throw new ToolMissing(`${command} is not on PATH; whygraph needs it`);
    throw r.error;
  }
  return { status: r.status ?? 1, stdout: r.stdout, stderr: r.stderr };
}

/** Every relate call whygraph makes runs with telemetry off. */
const RELATE_ENV = { RELATE_TELEMETRY: "0", DO_NOT_TRACK: "1" };

/**
 * owns: [[whygraph-child-processes]]
 * post: runs `relate` with telemetry off (RELATE_TELEMETRY=0, DO_NOT_TRACK=1) and agent mode off, so no row cap applies.
 */
export function relate(args: readonly string[], input?: string): Run {
  return run("relate", ["--no-agent-mode", "--max-rows", "0", ...args], { input, env: RELATE_ENV });
}

/**
 * A failed read query: relate's exit status and its message.
 * owns: [[whygraph-child-processes]]
 */
export class QueryFailed extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * owns: [[whygraph-child-processes]]
 * post: runs one read-only statement on the store at `store` with `params` bound as typed JSON values, and returns its rows.
 * post: throws QueryFailed with relate's exit status and first error line when relate exits non-zero.
 */
export function readQuery(store: string, cypher: string, params: Readonly<Record<string, unknown>> = {}): readonly Record<string, unknown>[] {
  const bind = Object.entries(params).flatMap(([k, v]) => ["--param", `${k}=${JSON.stringify(v)}`]);
  const r = relate(["query", "--database", store, "--read-only", "--mode", "jsonl", ...bind], cypher);
  if (r.status !== 0) throw new QueryFailed(r.status, r.stderr.trim().split("\n")[0] ?? `relate exited ${r.status}`);
  return r.stdout
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => JSON.parse(l) as Record<string, unknown>);
}

/**
 * owns: [[whygraph-child-processes]]
 * post: runs `git` in `cwd` without optional locks; returns stdout, or undefined when git exits non-zero.
 */
export function git(cwd: string, ...args: string[]): string | undefined {
  const r = run("git", ["--no-optional-locks", ...args], { cwd });
  return r.status === 0 ? r.stdout : undefined;
}

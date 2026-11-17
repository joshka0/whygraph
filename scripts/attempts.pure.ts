/**
 * module: [[whygraph-attempt-budget]]
 * boundary: pure
 * imports: none
 */
type End = {
  readonly status: string;
  readonly reason?: string;
  readonly timed_out?: boolean;
};
type Entry = { readonly kind: "running" | "done" | "agent" | "harness"; readonly meta?: End };
export type AttemptRule = "closed" | "opencode" | "single";
export type AttemptAction =
  | { readonly kind: "launch" | "settled" | "unscored" }
  | { readonly kind: "stop"; readonly reason: "interrupted" | "exhausted" | "harness" };

/** The batch's recorded rule decides whether another attempt can start.
 * owns: [[whygraph-attempt-budget]]
 * decided: Closed cells reserve at most two attempts across restarts because ADR 0011 fixes the attempt budget.
 * decided: Open-store opencode retains its two successive retry ladders because batches 5 and 6 keep their recorded behavior.
 */
export function attemptDecision(rule: AttemptRule, ledger: readonly Entry[]): AttemptAction {
  if (ledger.some(entry => entry.kind === "running")) return { kind: "stop", reason: "interrupted" };
  if (ledger.length === 0) return { kind: "launch" };
  if (rule === "single") return { kind: "settled" };
  if (rule === "closed") {
    if (ledger.length > 2) return { kind: "stop", reason: "exhausted" };
    if (ledger[ledger.length - 1]?.kind === "done") return { kind: "settled" };
    if (ledger.length < 2) return { kind: "launch" };
    return ledger.every(entry => entry.kind === "agent")
      ? { kind: "unscored" }
      : { kind: "stop", reason: "harness" };
  }
  const first = ledger[0]?.meta;
  const second = ledger[1]?.meta;
  if (first?.status === "invalid") {
    if (!second) return { kind: "launch" };
    if (second.status === "invalid") return first.reason === "isolation breach" && second.reason === "isolation breach"
      ? { kind: "unscored" }
      : { kind: "stop", reason: "harness" };
  }
  const timeout = first?.status === "invalid" ? second : first;
  if (!timeout?.timed_out) return { kind: "settled" };
  const retried = ledger[first?.status === "invalid" ? 2 : 1]?.meta;
  if (!retried) return { kind: "launch" };
  if (retried.status === "invalid") return { kind: "stop", reason: "harness" };
  return { kind: retried.timed_out ? "unscored" : "settled" };
}

/** The breaches of a closed attempt: the open-store hits without the paths in the confinement's private /tmp.
 * owns: [[whygraph-closed-breach-rule]]
 * decided: A file-tool or patch path inside the closed confinement's private /tmp is no isolation breach because that fresh tmpfs has no bind under it and cannot reach the host (ADR 0011, ruling of 2026-11-17 before any batch 7 result; B7-184 checks the mount).
 */
export function closedBreaches(hits: readonly string[]): string[] {
  return hits.filter(hit => {
    const path = /^external (?:file-tool|patch) path: ([\s\S]*)$/.exec(hit)?.[1];
    if (path === undefined || !path.startsWith("/")) return true;
    const at = resolved(path);
    return at !== "/tmp" && !at.startsWith("/tmp/");
  });
}

/** Resolve `.`, `..` and repeated slashes of an absolute path without touching a file system. */
function resolved(path: string): string {
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return "/" + parts.join("/");
}

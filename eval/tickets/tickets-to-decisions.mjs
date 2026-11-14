#!/usr/bin/env node
// Turn a ticket export into a whygraph decisions file, linking each ticket to the
// commits whose message cites its key.
//
//   node tickets-to-decisions.mjs --repo <path> --tickets <tickets.json> --out <decisions.json>
//        [--key '<regex with one group>'] [--prefix <text>] [--max-symbol-commits <n>]
//
// tickets.json: [{ "key": "ABC-123", "date": "2026-01-02", "title": "...", "body": "...", "author": "...", "source": "..." }]
// --key: how a commit message cites a key. The first group must equal a ticket's key,
//        after --prefix is added in front. Default '#(\d+)' (GitHub: keys are numbers).
//        JIRA: --key '\b([A-Z][A-Z0-9]+-\d+)\b'.  Azure DevOps: --key 'AB#(\d+)'.
// The record id is `ticket-<key>`. Nothing leaves the machine.
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const repo = opt("--repo"), ticketsFile = opt("--tickets"), out = opt("--out");
if (!repo || !ticketsFile || !out) { console.error("usage: tickets-to-decisions.mjs --repo <path> --tickets <file> --out <file> [--key <regex>] [--prefix <text>]"); process.exit(2); }
const key = new RegExp(opt("--key", "#(\\d+)"), "g");
const prefix = opt("--prefix", "");

const tickets = JSON.parse(readFileSync(ticketsFile, "utf8"));
const byKey = new Map(tickets.map((t) => [String(t.key), t]));
const log = execFileSync("git", ["-C", repo, "log", "--format=%H%x1f%B%x1e"], { encoding: "utf8", maxBuffer: 1 << 30 });
const cites = new Map();
let citing = 0;
for (const entry of log.split("\x1e")) {
  const at = entry.indexOf("\x1f");
  if (at < 0) continue;
  const sha = entry.slice(0, at).trim();
  const keys = new Set([...entry.slice(at + 1).matchAll(key)].map((m) => prefix + m[1]));
  let hit = false;
  for (const k of keys) if (byKey.has(k)) { (cites.get(k) ?? cites.set(k, []).get(k)).push(sha); hit = true; }
  if (hit) citing += 1;
}
const records = tickets.map((t) => {
  const record = { id: `ticket-${t.key}`, date: t.date ?? null, title: String(t.title ?? "").slice(0, 300) };
  const body = String(t.body ?? "").trim();
  if (body) record.items = [{ label: "ticket", text: body.slice(0, 4000) }];
  if (t.source) record.source = String(t.source);
  if (t.author) record.author = String(t.author);
  const commits = cites.get(String(t.key));
  if (commits) record.commits = commits;
  return record;
});
writeFileSync(out, JSON.stringify({ records }, null, 1));
console.log(JSON.stringify({ tickets: tickets.length, ticketsCitedByACommit: cites.size, commitsCitingATicket: citing }));

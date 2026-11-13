#!/usr/bin/env python3
"""Counts-only retrieval measurement for whygraph.

  measure.py --whygraph <cmd> --repo <path> --store <path> --requests <file> --targets <file> --out <dir> [--prefix ticket-]

requests: [{id, request, wording, record, also}]   targets: [{id, targets: [{file, start_line, end_line}], not_found}]
Writes <out>/detail.json (holds ids; keep it private) and <out>/report.json (counts only; safe to share).
A request counts for a list when the needed record, or one of `also`, is in that list.
"""
import argparse, json, os, re, subprocess, time
a = argparse.ArgumentParser()
for k in ("whygraph", "repo", "store", "requests", "targets", "out"): a.add_argument("--" + k, required=True)
a.add_argument("--prefix", default="")
a.add_argument("--limit", default="systemd-run --user --scope -q -p MemoryMax=6G -p CPUQuota=400%")
o = a.parse_args()
env = dict(os.environ, RELATE_TELEMETRY="0", DO_NOT_TRACK="1"); env.pop("WHYGRAPH_RERANK", None)
def run(args):
    t = time.time()
    p = subprocess.run(o.limit.split() + o.whygraph.split() + args + ["--repo", o.repo, "--store", o.store], capture_output=True, text=True, env=env, timeout=1200)
    return p.returncode, p.stdout, time.time() - t
REC = re.compile(r"^  (?:\d{4}-\d{2}-\d{2}|undated)\s+(\S+)\s", re.M)
def carry_parts(text):
    cut = text.find("Decision records that share the most distinctive terms")
    body, terms = (text, "") if cut < 0 else (text[:cut], text[cut:])
    linked = {}; cur = None
    for line in body.split("\n"):
        m = re.match(r"^  (?:\d{4}-\d{2}-\d{2}|undated)\s+(\S+)\s", line)
        if m: cur = m.group(1); linked.setdefault(cur, None); continue
        n = re.search(r"that commit changed (\d+) symbols?", line)
        if n and cur is not None: linked[cur] = min(int(n.group(1)), linked[cur] or 10**9)
        if line.strip() == "" : cur = None
    return linked, REC.findall(terms)
reqs = json.load(open(o.requests)); tg = {t["id"]: t for t in json.load(open(o.targets))}
rows = []
for q in reqs:
    want = {o.prefix + str(x) for x in [q["record"]] + list(q.get("also") or [])}
    code, text, secs = run(["search", q["request"]])
    row = {"id": q["id"], "wording": q["wording"], "search": bool(want & set(REC.findall(text))), "search_secs": secs, "search_exit": code,
           "located": False, "terms": False, "link": False, "link_tight": False, "linked_listed": [], "carry_secs": []}
    t = tg.get(q["id"], {})
    for x in ([] if t.get("not_found") else t.get("targets") or []):
        code, text, secs = run(["carry", f'{x["file"]}:{x["start_line"]}-{x["end_line"]}'])
        if code != 0: continue
        row["located"] = True; row["carry_secs"].append(secs)
        linked, terms = carry_parts(text)
        row["terms"] |= bool(want & set(terms))
        hit = [linked[i] for i in want if i in linked]
        row["link"] |= bool(hit); row["link_tight"] |= any(n is not None and n <= 20 for n in hit)
        row["linked_listed"].append(len(linked))
    rows.append(row)
    print(q["id"], {k: row[k] for k in ("search", "located", "terms", "link", "link_tight")}, flush=True)
os.makedirs(o.out, exist_ok=True); json.dump(rows, open(o.out + "/detail.json", "w"), indent=1)
def counts(rs):
    c = lambda f: sum(1 for r in rs if f(r))
    return {"requests": len(rs), "located": c(lambda r: r["located"]), "search": c(lambda r: r["search"]), "terms": c(lambda r: r["terms"]),
            "link": c(lambda r: r["link"]), "link_tight": c(lambda r: r["link_tight"]),
            "search_or_terms": c(lambda r: r["search"] or r["terms"]), "any": c(lambda r: r["search"] or r["terms"] or r["link"]),
            "link_only": c(lambda r: r["link"] and not (r["search"] or r["terms"]))}
med = lambda v: sorted(v)[len(v) // 2] if v else None
report = {"all": counts(rows), "by_wording": {w: counts([r for r in rows if r["wording"] == w]) for w in sorted({r["wording"] for r in rows})},
          "median_records_linked_per_range": med([n for r in rows for n in r["linked_listed"]]),
          "median_search_seconds": round(med([r["search_secs"] for r in rows]) or 0, 1), "median_carry_seconds": round(med([s for r in rows for s in r["carry_secs"]]) or 0, 1),
          "failed_search_calls": sum(1 for r in rows if r["search_exit"] != 0)}
json.dump(report, open(o.out + "/report.json", "w"), indent=1); print(json.dumps(report, indent=1))

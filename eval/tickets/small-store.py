#!/usr/bin/env python3
"""Cuts a decisions file down to a small store for the store-size control.

  small-store.py --decisions <file> --requests <file> --size <n> --out <file> [--prefix ticket-] [--seed 1]

Keeps every record that a request needs (`record` and `also`), and fills up to
<n> with records drawn at random from those that cite a commit. Prints counts.
"""
import argparse, json, random
a = argparse.ArgumentParser()
for k in ("decisions", "requests", "out"): a.add_argument("--" + k, required=True)
a.add_argument("--size", type=int, required=True)
a.add_argument("--prefix", default="")
a.add_argument("--seed", type=int, default=1)
o = a.parse_args()
records = json.load(open(o.decisions))["records"]
need = {o.prefix + str(x) for q in json.load(open(o.requests)) for x in [q["record"]] + list(q.get("also") or [])}
missing = need - {r["id"] for r in records}
if missing: raise SystemExit(f"{len(missing)} needed records are not in the decisions file")
if o.size < len(need): raise SystemExit(f"--size is below the {len(need)} needed records")
cited = sorted(r["id"] for r in records if r.get("commits") and r["id"] not in need)
if o.size - len(need) > len(cited): raise SystemExit(f"only {len(cited)} other records cite a commit")
random.seed(o.seed)
keep = need | set(random.sample(cited, o.size - len(need)))
json.dump({"records": [r for r in records if r["id"] in keep]}, open(o.out, "w"))
print(f"{len(keep)} records: {len(need)} needed, {len(keep) - len(need)} drawn from {len(cited)}")

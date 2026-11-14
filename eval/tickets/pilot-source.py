"""Post hoc: in the graph runs of batch 3, which whygraph answer showed the needed ticket.

For each run, every Bash call whose command runs whygraph is read. The needed ticket id
(`ticket-N`) is looked for in the result: in a `search` answer, in the linked part of a
`carry`/`why` answer (before the term heading), or in the term section of a `carry` answer.
"""
import collections, glob, json, os, re, sys
root = sys.argv[1]
TERM = "Decision records that share the most distinctive terms"
tasks = {}
for f in glob.glob(f"{root}/eval/tasks/ripgrep-conflict-*.json"):
    t = json.load(open(f))
    tasks[t["id"]] = [r["id"] for r in t["score"]["records"] if "id" in r]
def text(v):
    return v if isinstance(v, str) else json.dumps(v)
per_run = {}
for d in sorted(glob.glob(f"{root}/eval/results/ripgrep-conflict-*__graph__r*")):
    name = os.path.basename(d)
    task = name.split("__")[0]
    ids = tasks[task]
    seen = set()
    for call in json.load(open(f"{d}/tools.json")):
        cmd = (call.get("input") or {}).get("command") if isinstance(call.get("input"), dict) else None
        if not isinstance(cmd, str) or "whygraph" not in cmd:
            continue
        out = text(call.get("result", ""))
        kinds = set(re.findall(r"whygraph\s+(search|carry|why|impact)", cmd))
        has = lambda s: any(re.search(re.escape(i) + r"(?!\d)", s) for i in ids)
        if not has(out):
            continue
        # A call may chain commands; split the result at the term heading to place a carry hit.
        if "search" in kinds and len(kinds) == 1:
            seen.add("search")
        elif kinds <= {"carry", "why", "impact"} and kinds:
            cut = out.find(TERM)
            if cut < 0:
                seen.add("link")
            else:
                if has(out[:cut]): seen.add("link")
                if has(out[cut:]): seen.add("terms")
        else:
            seen.add("mixed call")
    per_run[name] = seen
final_named = {}
for name in per_run:
    task = name.split("__")[0]
    final = open(f"{root}/eval/results/{name}/final.txt").read()
    nums = [i.split("-", 1)[1] for i in tasks[task]]
    final_named[name] = any(re.search(rf"(?:#|\b(?:ticket[- ]\s*|issues/|issue\s+|pr\s+|pull request\s+|pull/)#?){n}(?!\d)", final, re.I) for n in nums)
c = collections.Counter()
for name, seen in per_run.items():
    key = "+".join(sorted(seen)) or "ticket in no whygraph answer"
    c[(key, final_named[name])] += 1
print("graph runs:", len(per_run))
print("where the needed ticket was shown -> runs (named in the reply / not named)")
keys = sorted({k for k, _ in c})
for k in keys:
    print(f"  {k:32s} {c[(k, True)] + c[(k, False)]:2d}  ({c[(k, True)]} / {c[(k, False)]})")
print("\nper task (3 runs each): sets of sources")
for task in sorted(tasks):
    print(" ", task[-5:], [("+".join(sorted(per_run[n])) or "-") for n in sorted(per_run) if n.startswith(task + "__")])

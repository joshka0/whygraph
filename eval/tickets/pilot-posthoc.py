"""Post hoc counts for batch 3 (added after the results were seen; changes no verdict).

For each run: did the diff change a file; does the reply name the ticket by the fixed
spellings; does it name it by the fixed spellings or as `ticket N` (a space, which the
fixed rule left out).
"""
import collections, glob, json, os, re, sys
root = sys.argv[1]
tasks = {}
for f in glob.glob(f"{root}/eval/tasks/ripgrep-conflict-*.json"):
    t = json.load(open(f))
    nums = [r["id"].split("-", 1)[1] for r in t["score"]["records"] if "id" in r]
    tasks[t["id"]] = {"nums": nums, "wording": t["ground_truth"]["source"].get("wording")}
strict = lambda n: re.compile(rf"(?:#|\b(?:ticket-|issues/|issue\s+|pr\s+|pull request\s+|pull/)#?){n}(?!\d)", re.I)
loose = lambda n: re.compile(rf"(?:#|\b(?:ticket[- ]\s*|issues/|issue\s+|pr\s+|pull request\s+|pull/)#?){n}(?!\d)", re.I)
rows = []
for d in sorted(glob.glob(f"{root}/eval/results/ripgrep-conflict-*__*__r*")):
    name = os.path.basename(d)
    task, cond, rep = name.split("__")
    final = open(f"{d}/final.txt").read()
    diff = open(f"{d}/diff.patch").read()
    changed = bool(re.search(r"^diff --git ", diff, re.M))
    nums = tasks[task]["nums"]
    s = any(strict(n).search(final) for n in nums)
    l = any(loose(n).search(final) for n in nums)
    rows.append((task, cond, tasks[task]["wording"], changed, s, l))
conds = ["none", "graph", "stub"]
def rate(pred, cond, rows=rows):
    r = [x for x in rows if x[1] == cond]
    return f"{sum(1 for x in r if pred(x))}/{len(r)}"
print("runs:", len(rows))
for label, pred in [
    ("changed no file", lambda x: not x[3]),
    ("named the ticket, fixed spellings", lambda x: x[4]),
    ("pass, fixed rule (named and no change)", lambda x: x[4] and not x[3]),
    ("named the ticket, with `ticket N` added", lambda x: x[5]),
    ("pass with `ticket N` added", lambda x: x[5] and not x[3]),
    ("named only as `ticket N`", lambda x: x[5] and not x[4]),
    ("named the ticket but changed a file", lambda x: x[5] and x[3]),
    ("held the change without naming the ticket", lambda x: not x[5] and not x[3]),
]:
    print(f"{label:45s}", "  ".join(f"{c} {rate(pred, c)}" for c in conds))
print("\nper task: changed-no-file (none graph stub) | named loose (none graph stub)")
for task in sorted(tasks):
    a = [sum(1 for x in rows if x[0] == task and x[1] == c and not x[3]) for c in conds]
    b = [sum(1 for x in rows if x[0] == task and x[1] == c and x[5]) for c in conds]
    print(f"  {task[-5:]} {tasks[task]['wording']:12s} {a} | {b}")

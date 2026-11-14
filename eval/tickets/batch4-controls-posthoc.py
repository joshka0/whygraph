"""Post hoc for batch 4 (added after the results were seen; changes no verdict).

In the graph runs on the five harmless controls: did the agent ask whygraph, did an answer
list tickets, did a `carry` or `why` answer list a ticket linked to the code (before the
term section), and does the reply name a ticket. Every one of these runs made the change.

  python3 eval/tickets/batch4-controls-posthoc.py <whygraph repo>
"""
import glob, json, os, re, sys
root = sys.argv[1]
TERM = "Decision records that share the most distinctive terms"
rows = []
for d in sorted(glob.glob(f"{root}/eval/results/ripgrep4-control-*__graph__r*")):
    calls, listed, linked = 0, set(), set()
    for call in json.load(open(f"{d}/tools.json")):
        cmd = (call.get("input") or {}).get("command") if isinstance(call.get("input"), dict) else None
        if not isinstance(cmd, str) or not re.search(r"whygraph\s+(carry|why|search|impact)", cmd):
            continue
        calls += 1
        out = call.get("result", "")
        out = out if isinstance(out, str) else json.dumps(out)
        listed |= set(re.findall(r"ticket-\d+", out))
        if re.search(r"whygraph\s+(carry|why)", cmd) and "search" not in cmd:
            cut = out.find(TERM)
            linked |= set(re.findall(r"ticket-\d+", out if cut < 0 else out[:cut]))
    final = open(f"{d}/final.txt").read()
    named = bool(re.search(r"ticket[- ]?#?\d+|#\d{2,}", final, re.I))
    rows.append((os.path.basename(d), calls, len(listed), len(linked), named))
print("graph runs on controls:", len(rows))
print("asked whygraph:", sum(1 for r in rows if r[1] > 0))
print("an answer listed at least one ticket:", sum(1 for r in rows if r[2] > 0))
print("a carry or why answer listed a linked ticket:", sum(1 for r in rows if r[3] > 0))
print("the reply names a ticket:", sum(1 for r in rows if r[4]))

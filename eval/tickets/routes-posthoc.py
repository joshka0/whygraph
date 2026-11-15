"""Post hoc for the ticket batches 5 and 6 (added after the results were seen; changes no verdict).

Two ways to the needed ticket that go around the whygraph commands. A repo's commits can
cite a ticket's number, so `git log`, `git blame` and `git show` can print it with no
graph. And the agent can query the store itself with `relate`. For each finished conflict
run whose task id starts with the prefix: did the agent run one of those commands, did the output of one
hold `#<number>` of the source ticket or of an `also` ticket, did a whygraph answer hold
`ticket-<number>`, did the agent run `relate` (which also goes around a `search` that is
off), did a `relate` answer hold `ticket-<number>`, does the reply hold
the number, and does the diff change a file.

"The reply names it" is looser here than in the scorer: the reply holds the number as a
whole number. On batch 6 the two rules give the same counts; on batch 5, with its short
ticket numbers, this one counts more replies, so read its naming rows for batch 6 only.

  python3 eval/tickets/routes-posthoc.py <whygraph repo> <task id prefix: hono6 or ripgrep5>
"""
import collections, glob, json, os, re, sys

root, prefix = sys.argv[1], sys.argv[2]
HISTORY = re.compile(r"\bgit\s+(?:-\S+\s+)*(?:log|blame|show)\b")
WHYGRAPH = re.compile(r"\bwhygraph\s+(?:carry|why|search|impact)\b")
RELATE = re.compile(r"\brelate\s+(?:-|query\b)")
tasks = {}
for f in glob.glob(f"{root}/eval/tasks/{prefix}-conflict-*.json"):
    t = json.load(open(f))
    tasks[t["id"]] = t

rows = collections.defaultdict(collections.Counter)
for d in sorted(glob.glob(f"{root}/eval/results/{prefix}-conflict-*")):
    if not os.path.exists(f"{d}/meta.json"):
        continue
    meta = json.load(open(f"{d}/meta.json"))
    if meta.get("status") != "done":
        continue
    source = tasks[meta["task"]]["ground_truth"]["source"]
    numbers = [n for n in [source["record"]] + [re.sub(r"\D", "", str(a)) for a in source["also"]] if n]
    read_history = git_showed = graph_showed = ran_relate = relate_showed = False
    for call in json.load(open(f"{d}/tools.json")):
        cmd = (call.get("input") or {}).get("command") if isinstance(call.get("input"), dict) else None
        if not isinstance(cmd, str):
            continue
        out = call.get("result", "")
        out = out if isinstance(out, str) else json.dumps(out)
        if HISTORY.search(cmd):
            read_history = True
            git_showed = git_showed or any(re.search(rf"#{n}(?!\d)", out) for n in numbers)
        if WHYGRAPH.search(cmd):
            graph_showed = graph_showed or any(re.search(rf"ticket-{n}(?!\d)", out) for n in numbers)
        if RELATE.search(cmd):
            ran_relate = True
            relate_showed = relate_showed or any(re.search(rf"ticket-{n}(?!\d)", out) for n in numbers)
    final = open(f"{d}/final.txt").read()
    named = any(re.search(rf"(?<!\d){n}(?!\d)", final) for n in numbers)
    changed = os.path.getsize(f"{d}/diff.patch") > 0
    c = rows[meta["condition"]]
    c["finished conflict runs"] += 1
    c["ran git log, blame or show"] += read_history
    c["a git answer held the ticket number"] += git_showed
    c["a git answer held it, and the reply names it"] += git_showed and named
    c["a git answer held it, the reply does not name it"] += git_showed and not named
    c["a git answer held it, the reply does not name it, and the diff changes a file"] += git_showed and not named and changed
    c["no whygraph answer held it, a git answer did"] += git_showed and not graph_showed
    c["no whygraph answer held it, a git answer did, and the reply names it"] += git_showed and not graph_showed and named
    c["queried the store with relate"] += ran_relate
    c["a relate answer held it"] += relate_showed
    c["no whygraph answer and no git answer held it, a relate answer did"] += relate_showed and not git_showed and not graph_showed
    c["no whygraph, git or relate answer held it"] += not git_showed and not graph_showed and not relate_showed
    c["the reply names it"] += named

labels = list(next(iter(rows.values())).keys()) if rows else []
for condition in ("none", "stub", "graph", "graph-nosearch"):
    if condition not in rows:
        continue
    print(condition)
    for label in labels:
        print(f"  {label}: {rows[condition][label]}")

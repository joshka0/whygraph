#!/usr/bin/env python3
"""Fetch a public GitHub repo's issues and pull requests (unauthenticated) into tickets.json.

  fetch-github.py <owner>/<repo> <tickets.json>
"""
import json, re, sys, time, urllib.request, urllib.error
url = f"https://api.github.com/repos/{sys.argv[1]}/issues?state=all&per_page=100&sort=created&direction=asc"
items = []
while url:
    try:
        r = urllib.request.urlopen(urllib.request.Request(url, headers={"Accept": "application/vnd.github+json", "User-Agent": "whygraph-ticket-test"}), timeout=60)
    except urllib.error.HTTPError as e:
        reset = e.headers.get("X-RateLimit-Reset")
        if e.code in (403, 429) and reset:
            time.sleep(min(max(30, int(reset) - int(time.time()) + 5), 3700)); continue
        raise
    items += json.load(r)
    m = re.search(r'<([^>]+)>; rel="next"', r.headers.get("Link", "")); url = m.group(1) if m else None
    print(len(items), file=sys.stderr); time.sleep(2)
json.dump([{"key": str(x["number"]), "date": x["created_at"][:10], "title": x["title"], "body": x.get("body") or "", "author": x["user"]["login"], "source": x["html_url"]} for x in items], open(sys.argv[2], "w"))

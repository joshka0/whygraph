"""Run the unchanged fetcher against a test-owned local HTTP listener."""
import json
import os
import runpy
import sys
import urllib.request
from urllib.parse import urlsplit
script, base, log, *args = sys.argv[1:]
original = urllib.request.urlopen

def local_open(request, *positional, **kwargs):
    url = request.full_url if hasattr(request, 'full_url') else request
    headers = dict(request.header_items()) if hasattr(request, 'header_items') else {}
    with open(log, 'a') as out:
        out.write(json.dumps({'url': url, 'headers': headers}) + '\n')
    # Refuse all external traffic, even if the fetcher follows a hostile Link.
    parsed = urlsplit(url)
    if parsed.hostname != 'api.github.com':
        raise AssertionError('fetcher attempted off-host pagination: ' + url)
    redirected = urllib.request.Request(base + parsed.path + ('?' + parsed.query if parsed.query else ''), headers=headers)
    return original(redirected, *positional, **kwargs)

urllib.request.urlopen = local_open
# Rate waits are observed as durations rather than wall-clock deadlines.
import time

def record_sleep(seconds):
    with open(log, 'a') as out:
        out.write(json.dumps({'sleep': seconds}) + '\n')

time.sleep = record_sleep
sys.argv = [script, *args]
runpy.run_path(script, run_name='__main__')

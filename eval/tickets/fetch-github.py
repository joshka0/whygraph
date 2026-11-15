#!/usr/bin/env python3
"""Fetch public GitHub tickets, outcomes and maintainer comments without credentials.

fetch-github.py OWNER/REPO OUTPUT [--max-tickets N]
Raw response pages live in OUTPUT.pages. A restart reuses complete pages.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys
import time
import urllib.error
import urllib.request


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('repo')
    parser.add_argument('output', type=Path)
    parser.add_argument('--max-tickets', type=int)
    args = parser.parse_args()
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', args.repo):
        parser.error('repo must be OWNER/REPO')
    if args.max_tickets is not None and args.max_tickets < 1:
        parser.error('--max-tickets must be positive')
    cache = Path(str(args.output) + '.pages')
    cache.mkdir(parents=True, exist_ok=True)

    def fetch(url):
        if not url.startswith('https://api.github.com/'):
            raise ValueError('refuse a pagination URL outside api.github.com')
        path = cache / (hashlib.sha256(url.encode()).hexdigest() + '.json')
        if path.exists():
            saved = json.loads(path.read_text())
            if saved['url'] != url:
                raise ValueError('cached URL mismatch')
            return saved['body'], saved['next']
        while True:
            request = urllib.request.Request(url, headers={
                'Accept': 'application/vnd.github+json', 'User-Agent': 'public-ticket-client'})
            try:
                with urllib.request.urlopen(request, timeout=60) as response:
                    body = json.load(response)
                    link = re.search(r'<([^>]+)>; rel="next"', response.headers.get('Link', ''))
                    next_url = link.group(1) if link else None
                saved = {'url': url, 'body': body, 'next': next_url}
                pending = path.with_suffix('.pending')
                pending.write_text(json.dumps(saved))
                pending.replace(path)
                return body, next_url
            except urllib.error.HTTPError as error:
                reset = error.headers.get('X-RateLimit-Reset')
                retry = error.headers.get('Retry-After')
                if error.code not in (403, 429) or not (reset or retry):
                    raise
                delay = max(1, int(retry)) if retry else max(1, int(reset) - int(time.time()) + 5)
                print(f'rate limit: waiting {delay}s', file=sys.stderr)
                time.sleep(delay)

    def pages(url):
        while url:
            body, url = fetch(url)
            if not isinstance(body, list):
                raise ValueError('expected an API page array')
            yield from body

    tickets = []
    url = f'https://api.github.com/repos/{args.repo}/issues?state=all&per_page=100&sort=created&direction=asc'
    for issue in pages(url):
        comments = []
        if issue['comments']:
            for comment in pages(issue['comments_url'] + '?per_page=100'):
                if comment.get('author_association') in ('OWNER', 'MEMBER', 'COLLABORATOR'):
                    comments.append({
                        'author': comment['user']['login'], 'association': comment['author_association'],
                        'date': comment['created_at'], 'body': comment.get('body') or '',
                        'source': comment['html_url']})
        comments.sort(key=lambda c: (c['date'], c['source']))
        merged = None
        if 'pull_request' in issue:
            pull, _ = fetch(issue['pull_request']['url'])
            merged = bool(pull['merged'])
        state, reason = issue['state'], issue.get('state_reason')
        if state not in ('open', 'closed') or reason not in (None, 'completed', 'not_planned', 'reopened'):
            raise ValueError(f'unknown outcome for ticket {issue["number"]}: {state}/{reason}')
        tickets.append({
            'key': str(issue['number']), 'date': issue['created_at'][:10], 'title': issue['title'],
            'body': issue.get('body') or '', 'author': issue['user']['login'], 'source': issue['html_url'],
            'state': state, 'state_reason': reason, 'is_pull_request': 'pull_request' in issue,
            'merged': merged, 'comments': comments})
        print(f'{len(tickets)} tickets complete', file=sys.stderr)
        if args.max_tickets and len(tickets) >= args.max_tickets:
            break
    pending = args.output.with_suffix(args.output.suffix + '.pending')
    pending.write_text(json.dumps(tickets, ensure_ascii=False))
    pending.replace(args.output)


if __name__ == '__main__':
    main()

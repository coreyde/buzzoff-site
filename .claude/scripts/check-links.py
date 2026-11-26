#!/usr/bin/env python3
"""Report external links on the published pages that return 4xx/5xx. Standard library only.

Run from the repo root (needs the network, so it isn't part of check-site.py):
    python3 .claude/scripts/check-links.py
Exit code 1 if any link is dead (4xx/5xx other than bot blocking, or no answer).

Tries HEAD first, then GET when a server refuses HEAD. A 401/403/429 is often a
site turning away scripts rather than a dead page: those are listed separately as
"check by hand" (open them in a browser) and don't fail the run. So are 404s from
hosts that answer every deep link with 404 and then draw the page in the browser
(USDA FoodData Central, checked 26 Nov 2026).
"""
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(__file__))
from serve import ROOT, published  # noqa: E402

UA = "buzzoffapp-linkcheck/1.0 (+https://buzzoffapp.com)"  # honest name; no browser spoofing
TIMEOUT = 20
BLOCKED = {401, 403, 429}
# Single-page apps: the server sends 404 for every deep link, then JavaScript renders it.
CLIENT_RENDERED = {"fdc.nal.usda.gov"}


def pages():
    for dirpath, dirnames, filenames in os.walk(ROOT):
        rel_dir = os.path.relpath(dirpath, ROOT)
        base = [] if rel_dir == "." else rel_dir.split(os.sep)
        dirnames[:] = [d for d in dirnames if published(base + [d])]
        for f in filenames:
            if f.endswith(".html") and published(base + [f]):
                yield os.path.relpath(os.path.join(dirpath, f), ROOT)


def links():
    found = {}
    for rel in sorted(pages()):
        src = open(os.path.join(ROOT, rel), encoding="utf-8").read()
        body = src[src.find("<body"):]
        for url in re.findall(r'<a\b[^>]*\bhref="(https?://[^"]+)"', body):
            url = url.replace("&amp;", "&")
            if url.startswith("https://buzzoffapp.com"):
                continue
            found.setdefault(url, []).append(rel)
    return found


def fetch(url):
    last = None
    for method in ("HEAD", "GET"):
        req = urllib.request.Request(url, method=method, headers={"User-Agent": UA, "Accept": "*/*"})
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
                return r.status, None
        except urllib.error.HTTPError as e:
            last = (e.code, None)
            if e.code in (405, 501) or e.code in BLOCKED or e.code >= 500:
                continue  # some servers only answer GET
            return last
        except Exception as e:  # DNS, TLS, timeout
            last = (None, f"{type(e).__name__}: {e}")
    return last


def main():
    found = links()
    with ThreadPoolExecutor(max_workers=6) as pool:
        results = dict(zip(found, pool.map(fetch, found)))
    dead, blocked = [], []
    for url, (status, error) in sorted(results.items()):
        where = ", ".join(sorted(set(found[url])))
        if status is not None and status < 400:
            continue
        host = urllib.parse.urlparse(url).netloc
        if status == 404 and host in CLIENT_RENDERED:
            blocked.append(f"404 (page renders in the browser)  {url}\n      on {where}")
            continue
        line = f"{status or error}  {url}\n      on {where}"
        (blocked if status in BLOCKED else dead).append(line)
    for line in dead:
        print("DEAD ", line)
    for line in blocked:
        print("CHECK BY HAND ", line)
    print(f"\n{len(results)} external links, {len(dead)} dead, {len(blocked)} to check by hand")
    return 1 if dead else 0


if __name__ == "__main__":
    sys.exit(main())

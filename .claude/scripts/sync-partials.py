#!/usr/bin/env python3
"""Copy the shared header and footer from .claude/templates/partials.html into
every published page, keeping each page's own App Store campaign code (ct=...).

Run from the repo root after editing the template:
  python3 .claude/scripts/sync-partials.py
Only the <header class="site-header"> and <footer class="site-footer"> blocks
change; the head and the page content are left alone. Standard library only.
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
from serve import ROOT, published  # noqa: E402

TEMPLATE = os.path.join(ROOT, ".claude", "templates", "partials.html")
HEADER_RE = re.compile(r"    <header class=\"site-header\">.*?    </header>", re.S)
FOOTER_RE = re.compile(r"    <footer class=\"site-footer\">.*?    </footer>", re.S)


def main():
    tpl = open(TEMPLATE, encoding="utf-8").read()
    header = HEADER_RE.search(tpl).group(0)
    footer = FOOTER_RE.search(tpl).group(0)
    changed = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        rel_dir = os.path.relpath(dirpath, ROOT)
        base = [] if rel_dir == "." else rel_dir.split(os.sep)
        dirnames[:] = [d for d in dirnames if published(base + [d])]
        for f in filenames:
            if not f.endswith(".html") or not published(base + [f]):
                continue
            path = os.path.join(dirpath, f)
            src = open(path, encoding="utf-8").read()
            m = re.search(r"ct=(web-[a-z]+)", src)
            if not m or not HEADER_RE.search(src) or not FOOTER_RE.search(src):
                print(f"skipped (no shared blocks or campaign code): {os.path.relpath(path, ROOT)}")
                continue
            ct = m.group(1)
            out = HEADER_RE.sub(lambda _: header.replace("{{CT}}", ct), src, count=1)
            out = FOOTER_RE.sub(lambda _: footer.replace("{{CT}}", ct), out, count=1)
            if out != src:
                open(path, "w", encoding="utf-8").write(out)
                changed.append(os.path.relpath(path, ROOT))
    print("updated:", ", ".join(changed) or "nothing")


if __name__ == "__main__":
    main()

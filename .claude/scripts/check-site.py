#!/usr/bin/env python3
"""Pre-push checks for buzzoffapp.com. Standard library only.

Run from the repo root:  python3 .claude/scripts/check-site.py
Exit code 1 if any ERROR. WARN lines are worth a look but don't fail.

Checks every published .html page (dot-folders and _-prefixed paths skipped,
as Jekyll does):
- internal href/src resolve the way GitHub Pages resolves them
- lang="en", one <h1>, headings never skip a level going down
- <title> <= 60 chars, meta description <= 155, canonical (unless noindex)
- Open Graph + Twitter tags, the GA tag (G-HC8N876HCR), the Smart App Banner
- every <img> has alt (empty is fine for decorative), width and height
- JSON-LD blocks parse
- App Store links use the campaign URL with a known ct code
- header and footer are identical on every page (campaign code aside)
- sitemap.xml lists every indexable page's canonical, and nothing else
- WARN while a guide still says it's awaiting Corey's review
"""
import html
import json
import os
import re
import sys
from html.parser import HTMLParser
from urllib.parse import urlparse

sys.path.insert(0, os.path.dirname(__file__))
from serve import ROOT, resolve  # noqa: E402

SITE = "https://buzzoffapp.com"
CT_CODES = {"web-home", "web-guides", "web-tools", "web-compare", "web-other"}
STORE_RE = re.compile(
    r"^https://apps\.apple\.com/app/apple-store/id6746517769\?pt=127836285&ct=([a-z-]+)&mt=8$"
)

errors, warnings = [], []


def err(page, msg):
    errors.append(f"ERROR {page}: {msg}")


def warn(page, msg):
    warnings.append(f"WARN  {page}: {msg}")


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.lang = None
        self.headings = []
        self.title = ""
        self._in_title = False
        self.meta = {}
        self.links = []  # (tag, attr, value)
        self.imgs = []
        self.canonical = None
        self.jsonld = []
        self._in_jsonld = False
        self._buf = ""
        self.store_links = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "html":
            self.lang = a.get("lang")
        if re.fullmatch(r"h[1-6]", tag):
            self.headings.append(int(tag[1]))
        if tag == "title":
            self._in_title = True
        if tag == "meta":
            key = a.get("name") or a.get("property")
            if key:
                self.meta[key] = a.get("content", "")
        if tag == "link" and a.get("rel") == "canonical":
            self.canonical = a.get("href")
        if tag == "img":
            self.imgs.append(a)
        if tag == "script" and a.get("type") == "application/ld+json":
            self._in_jsonld = True
            self._buf = ""
        for attr in ("href", "src"):
            if a.get(attr):
                self.links.append((tag, attr, a[attr]))
        if tag == "a" and "apps.apple.com" in a.get("href", ""):
            self.store_links.append(a)

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
        if tag == "script" and self._in_jsonld:
            self.jsonld.append(self._buf)
            self._in_jsonld = False

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        if self._in_jsonld:
            self._buf += data


def pages():
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if not d.startswith((".", "_"))]
        for f in filenames:
            if f.endswith(".html") and not f.startswith((".", "_")):
                yield os.path.relpath(os.path.join(dirpath, f), ROOT)


def block(src, start_pat, end_pat):
    m = re.search(start_pat + r".*?" + end_pat, src, re.S)
    return re.sub(r"ct=web-[a-z]+", "ct=X", m.group(0)) if m else None


def main():
    shared = {}
    indexable = {}
    for rel in sorted(pages()):
        src = open(os.path.join(ROOT, rel), encoding="utf-8").read()
        p = Page()
        p.feed(src)
        noindex = "noindex" in p.meta.get("robots", "")

        if p.lang != "en":
            err(rel, 'missing lang="en"')
        if p.headings.count(1) != 1:
            err(rel, f"{p.headings.count(1)} <h1> elements (want 1)")
        for prev, cur in zip(p.headings, p.headings[1:]):
            if cur > prev + 1:
                (warn if rel in ("privacy-policy.html", "terms.html") else err)(
                    rel, f"heading jumps from h{prev} to h{cur}"
                )
                break
        title = html.unescape(p.title.strip())
        if not title or len(title) > 60:
            err(rel, f"title length {len(title)} (max 60): {title!r}")
        desc = p.meta.get("description", "")
        if not desc or len(desc) > 155:
            err(rel, f"description length {len(desc)} (max 155)")
        if not noindex:
            if not p.canonical or not p.canonical.startswith(SITE):
                err(rel, "missing canonical")
            else:
                indexable[p.canonical] = rel
        for key in ("og:title", "og:description", "og:image", "twitter:card", "twitter:image"):
            if not p.meta.get(key):
                err(rel, f"missing {key}")
        og = p.meta.get("og:image", "")
        if og.startswith(SITE) and not resolve(urlparse(og).path):
            err(rel, f"og:image not found: {og}")
        if p.meta.get("apple-itunes-app") != "app-id=6746517769":
            err(rel, "missing Smart App Banner")
        if "review-pending" in src:
            warn(rel, "awaiting Corey's review: set 'Last reviewed' to his approval date and add datePublished/dateModified to the Article JSON-LD before merging")
        if "G-HC8N876HCR" not in src:
            err(rel, "missing GA tag")
        for img in p.imgs:
            if "alt" not in img:
                err(rel, f"img without alt: {img.get('src')}")
            if not (img.get("width") and img.get("height")):
                err(rel, f"img without width/height: {img.get('src')}")
        for block_src in p.jsonld:
            try:
                json.loads(block_src)
            except json.JSONDecodeError as e:
                err(rel, f"JSON-LD does not parse: {e}")
        for a in p.store_links:
            m = STORE_RE.match(a.get("href", ""))
            if not m or m.group(1) not in CT_CODES:
                err(rel, f"App Store link without a known campaign code: {a.get('href')}")
            if "appstore" not in a.get("class", "").split() or not a.get("data-placement"):
                err(rel, "App Store link missing class=appstore or data-placement")
        for tag, attr, value in p.links:
            u = urlparse(value)
            if u.scheme in ("http", "https", "mailto", "tel", "data") or value.startswith("#"):
                continue
            if u.netloc:
                continue
            path = u.path
            if not path.startswith("/"):
                path = "/" + os.path.normpath(os.path.join(os.path.dirname(rel), path))
            if resolve(path) is None:
                err(rel, f"broken internal {attr}: {value}")

        header = block(src, r"<header class=\"site-header\">", r"</header>")
        footer = block(src, r"<footer class=\"site-footer\">", r"</footer>")
        for name, b in (("header", header), ("footer", footer)):
            if b is None:
                err(rel, f"no shared {name}")
            else:
                shared.setdefault(name, {}).setdefault(b, []).append(rel)

    for name, variants in shared.items():
        if len(variants) > 1:
            groups = sorted(variants.values(), key=len)
            err("site", f"{name} differs between pages: {groups}")

    sitemap = open(os.path.join(ROOT, "sitemap.xml"), encoding="utf-8").read()
    locs = set(re.findall(r"<loc>(.*?)</loc>", sitemap))
    for url in sorted(set(indexable) - locs):
        err("sitemap.xml", f"missing {url}")
    for url in sorted(locs - set(indexable)):
        err("sitemap.xml", f"lists {url}, which is not an indexable page")

    for line in warnings + errors:
        print(line)
    print(f"\n{len(indexable)} indexable pages, {len(errors)} errors, {len(warnings)} warnings")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())

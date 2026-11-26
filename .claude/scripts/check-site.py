#!/usr/bin/env python3
"""Pre-push checks for buzzoffapp.com. Standard library only.

Run from the repo root:  python3 .claude/scripts/check-site.py
Exit code 1 if any ERROR. WARN lines are worth a look but don't fail.

Checks every published .html page (what build-pages.sh copies into public/):
- internal href/src resolve the way Cloudflare Pages resolves them, and point
  at the final URL (no /x.html or /x/index.html, which Cloudflare 308-redirects)
- lang="en", one <h1>, headings never skip a level going down
- <title> <= 60 chars, meta description <= 155, canonical (unless noindex)
- Open Graph + Twitter tags, the GA tag (G-HC8N876HCR), the Smart App Banner
- every <img> has alt (empty is fine for decorative), width and height
- JSON-LD blocks parse
- App Store links use the campaign URL with a known ct code; links to other
  apps' listings (compare pages) are https://apps.apple.com/app/id<n>, rel=nofollow
- header and footer are identical on every page (campaign code aside)
- canonicals are each page's final URL; sitemap.xml lists every indexable
  page's canonical, and nothing else; llms.txt links resolve without redirects
- numbered citations: every <sup class="cite"> [n] links to #src-n with an
  aria-label "Source n: ...", numbers first appear in order 1, 2, 3...,
  the first use has id="cite-n", the Sources list is src-1..src-N in that
  order with a back link to #cite-n, every source is cited, no old-style
  (Author, Year) a.cite links, and no [n] inside JSON-LD
- WARN on "the table below/above" style references in visible text or in
  assets/js strings: name and link the part of the page instead
- WARN while a guide still says it's awaiting Corey's review
- WARN where body text splits a number and its unit with a plain space
  (the site writes 95&nbsp;mg; legal page bodies are left as they are)
- build-pages.sh builds, puts every checked page in its output and leaves out
  .claude/, dotfiles, Markdown files and CNAME
"""
import html
import json
import os
import re
import subprocess
import sys
import tempfile
from html.parser import HTMLParser
from urllib.parse import urlparse

sys.path.insert(0, os.path.dirname(__file__))
from serve import ROOT, published, resolve, route  # noqa: E402

SITE = "https://buzzoffapp.com"
CT_CODES = {"web-home", "web-guides", "web-tools", "web-compare", "web-other"}
STORE_RE = re.compile(
    r"^https://apps\.apple\.com/app/apple-store/id6746517769\?pt=127836285&ct=([a-z-]+)&mt=8$"
)

OTHER_STORE_RE = re.compile(r"^https://apps\.apple\.com/app/id\d+$")

POSITIONAL = re.compile(
    r"\b(?:tables?|charts?|graphs?|figures?|lists?|sections?|the one|see)\s+(?:below|above)\b", re.I
)
CITE_RE = re.compile(
    r'<sup class="cite"(?: id="cite-(\d+)")?><a href="#src-(\d+)" aria-label="([^"]*)">\[(\d+)\]</a></sup>'
)
SRC_LI_RE = re.compile(r'<li id="src-([^"]+)">(.*?)</li>', re.S)

errors, warnings = [], []
UNIT_SPLIT = re.compile(
    r"\d (?:mg|ml|g|kg|fl oz|oz|fluid ounces?|hours?|minutes?|days?|weeks?|months?|years?|cups?|percent|am|pm)\b"
)


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
        self.other_store_links = []  # other apps' listings (compare pages)

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
            if "id6746517769" in a["href"]:
                self.store_links.append(a)
            else:
                self.other_store_links.append(a)

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
        rel_dir = os.path.relpath(dirpath, ROOT)
        base = [] if rel_dir == "." else rel_dir.split(os.sep)
        dirnames[:] = [d for d in dirnames if published(base + [d])]
        for f in filenames:
            if f.endswith(".html") and published(base + [f]):
                yield os.path.relpath(os.path.join(dirpath, f), ROOT)


def check_citations(rel, src, jsonld):
    """Numbered citations: [n] -> #src-n, first-use order, Sources list in that order."""
    if '<a class="cite"' in src:
        err(rel, 'old-style (Author, Year) citation link (a.cite): use <sup class="cite"> [n]')
    if src.count('<sup class="cite"') != len(CITE_RE.findall(src)):
        err(rel, 'malformed <sup class="cite">: want <sup class="cite"><a href="#src-n" aria-label="Source n: ...">[n]</a></sup>')
    first_use = []
    for m in CITE_RE.finditer(src):
        cid, href_n, label, text_n = m.groups()
        if href_n != text_n:
            err(rel, f"citation [{text_n}] links to #src-{href_n}")
        if not label.startswith(f"Source {text_n}: ") or len(label) <= len(f"Source {text_n}: "):
            err(rel, f'citation [{text_n}] aria-label should read "Source {text_n}: <author, year>": {label!r}')
        n = int(href_n)
        if n not in first_use:
            first_use.append(n)
            if cid != str(n):
                err(rel, f'first citation of [{n}] needs id="cite-{n}"')
        elif cid:
            err(rel, f'id="cite-{n}" belongs on the first citation of [{n}] only')
    if first_use != list(range(1, len(first_use) + 1)):
        err(rel, f"citations aren't numbered in order of first use: {first_use}")
    sec = re.search(r'<section class="sources".*?</section>', src, re.S)
    listed = []
    if sec:
        for key, inner in SRC_LI_RE.findall(sec.group(0)):
            if not key.isdigit():
                err(rel, f'source id "src-{key}" should be src-<n>')
                continue
            listed.append(int(key))
            if f'class="src-back" href="#cite-{key}"' not in inner:
                err(rel, f'source {key} has no back link (<a class="src-back" href="#cite-{key}">)')
    elif first_use:
        err(rel, "citations but no Sources list")
    if listed != list(range(1, len(listed) + 1)):
        err(rel, f"Sources list isn't src-1..src-{len(listed)} in order: {listed}")
    for n in sorted(set(first_use) - set(listed)):
        err(rel, f"[{n}] points to a source that isn't in the Sources list")
    for n in sorted(set(listed) - set(first_use)):
        err(rel, f"source {n} is never cited")
    for block_src in jsonld:
        if re.search(r"\[\d+\]", block_src):
            err(rel, "JSON-LD contains a [n] citation marker (keep it plain text)")


def block(src, start_pat, end_pat):
    m = re.search(start_pat + r".*?" + end_pat, src, re.S)
    return re.sub(r"ct=web-[a-z]+", "ct=X", m.group(0)) if m else None


def check_build(page_list):
    """Run build-pages.sh into a temp folder and check what it publishes."""
    script = os.path.join(ROOT, ".claude", "scripts", "build-pages.sh")
    with tempfile.TemporaryDirectory() as tmp:
        out = os.path.join(tmp, "public")
        run = subprocess.run(["sh", script, out], capture_output=True, text=True)
        if run.returncode != 0:
            err("build-pages.sh", (run.stderr or run.stdout).strip())
            return
        built = set()
        for dirpath, _, filenames in os.walk(out):
            for f in filenames:
                built.add(os.path.relpath(os.path.join(dirpath, f), out))
    for rel in page_list:
        if rel not in built:
            err("build-pages.sh", f"{rel} is checked but not in the build")
    for rel in sorted(built):
        parts = rel.split(os.sep)
        if any(p.startswith(".") for p in parts) or rel.endswith(".md") or rel == "CNAME":
            err("build-pages.sh", f"publishes {rel}")


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
                if resolve(urlparse(p.canonical).path) != os.path.join(ROOT, rel):
                    err(rel, f"canonical is not this page's final URL: {p.canonical}")
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
        if rel not in ("privacy-policy.html", "terms.html"):
            body = re.sub(r"<script\b.*?</script>|<[^>]+>", "\n", src[src.find("<body"):], flags=re.S)
            for m in UNIT_SPLIT.finditer(body):
                warn(rel, f"number and unit split by a plain space (use &nbsp;): {m.group(0)!r}")
            for m in POSITIONAL.finditer(html.unescape(body)):
                warn(rel, f"{m.group(0)!r} points at another part of the page: name and link it instead")
        if "G-HC8N876HCR" not in src:
            err(rel, "missing GA tag")
        for img in p.imgs:
            if "alt" not in img:
                err(rel, f"img without alt: {img.get('src')}")
            if not (img.get("width") and img.get("height")):
                err(rel, f"img without width/height: {img.get('src')}")
        check_citations(rel, src, p.jsonld)
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
        for a in p.other_store_links:
            if not OTHER_STORE_RE.match(a.get("href", "")):
                err(rel, f"Other app's listing link not in the form https://apps.apple.com/app/id<n>: {a.get('href')}")
            if "nofollow" not in a.get("rel", "").split():
                err(rel, f"Other app's listing link without rel=nofollow: {a.get('href')}")
            if "appstore" in a.get("class", "").split():
                err(rel, f"Other app's listing link has class=appstore (GA would count it): {a.get('href')}")
        for tag, attr, value in p.links:
            u = urlparse(value)
            if u.scheme in ("http", "https", "mailto", "tel", "data") or value.startswith("#"):
                continue
            if u.netloc:
                continue
            path = u.path
            if not path.startswith("/"):
                path = "/" + os.path.normpath(os.path.join(os.path.dirname(rel), path))
            status, target = route(path)
            if status == 404:
                err(rel, f"broken internal {attr}: {value}")
            elif status == 308:
                err(rel, f"internal {attr} redirects (308): {value} -> use {target}")

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
    llms = open(os.path.join(ROOT, "llms.txt"), encoding="utf-8").read()
    for url in re.findall(r"\((https://buzzoffapp\.com/[^)\s]*)\)", llms):
        if resolve(urlparse(url).path) is None:
            err("llms.txt", f"link does not resolve to a page (or redirects): {url}")

    js_dir = os.path.join(ROOT, "assets", "js")
    for f in sorted(os.listdir(js_dir)):
        if f.endswith(".js"):
            js = open(os.path.join(js_dir, f), encoding="utf-8").read()
            for m in re.finditer(r'"[^"\n]*"|`[^`]*`|\'[^\'\n]*\'', js):
                for p in POSITIONAL.finditer(m.group(0)):
                    warn(f"assets/js/{f}", f"{p.group(0)!r} points at another part of the page: name and link it instead")

    check_build(sorted(pages()))

    for line in warnings + errors:
        print(line)
    print(f"\n{len(indexable)} indexable pages, {len(errors)} errors, {len(warnings)} warnings")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Local preview server that resolves URLs the way GitHub Pages does.

- /terms        -> terms.html   (extensionless .html)
- /guides/      -> guides/index.html
- missing paths -> 404.html with status 404
- dot-folders and _-prefixed paths are not served (Jekyll skips them)

Usage, from the repo root:  python3 .claude/scripts/serve.py [port]   (default 8000)
Standard library only.
"""
import http.server
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def resolve(url_path):
    """Return the file a GitHub Pages URL maps to, or None."""
    path = url_path.split("?", 1)[0].split("#", 1)[0]
    parts = [p for p in path.split("/") if p]
    if any(p.startswith(".") or p.startswith("_") for p in parts):
        return None
    local = os.path.join(ROOT, *parts)
    candidates = []
    if path.endswith("/") or not parts:
        candidates.append(os.path.join(local, "index.html"))
    else:
        candidates += [local, local + ".html", os.path.join(local, "index.html")]
    for c in candidates:
        if os.path.isfile(c):
            return c
    return None


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def send_head(self):
        target = resolve(self.path)
        if target is None:
            not_found = os.path.join(ROOT, "404.html")
            if os.path.isfile(not_found):
                with open(not_found, "rb") as f:
                    body = f.read()
                self.send_response(404)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return None
            self.send_error(404)
            return None
        # A folder URL without its trailing slash redirects, like Pages.
        path_only = self.path.split("?", 1)[0]
        if target.endswith("index.html") and not path_only.endswith("/") and path_only != "/":
            self.send_response(301)
            self.send_header("Location", path_only + "/")
            self.end_headers()
            return None
        self.path = "/" + os.path.relpath(target, ROOT).replace(os.sep, "/")
        return super().send_head()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    print(f"Serving {ROOT} on http://localhost:{port}")
    http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()

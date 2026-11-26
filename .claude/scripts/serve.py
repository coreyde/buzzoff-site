#!/usr/bin/env python3
"""Local preview server that resolves URLs the way Cloudflare Pages does.

- /terms              -> terms.html (200)
- /terms.html         -> 308 to /terms        (/x/index.html -> 308 to /x/)
- /terms/             -> 308 to /terms        (when terms.html exists)
- /guides             -> 308 to /guides/      (when guides/index.html exists)
- /guides/            -> guides/index.html (200)
- missing paths       -> 404.html with status 404
- files that build-pages.sh leaves out are not served: anything starting
  with a dot (.claude/, .git*), Markdown files, CNAME and public/

Usage, from the repo root:  python3 .claude/scripts/serve.py [port]   (default 8000)
Standard library only.
"""
import http.server
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def published(parts):
    """Mirror of build-pages.sh: is this repo path copied into the build?"""
    if not parts:
        return True
    if any(p.startswith(".") for p in parts):
        return False
    if parts[0] == "public" or parts == ["CNAME"]:
        return False
    return not parts[-1].endswith(".md")


def _file(parts):
    path = os.path.join(ROOT, *parts)
    return path if published(parts) and os.path.isfile(path) else None


def route(url_path):
    """Return (status, value) for a URL path, as Cloudflare Pages answers it.

    200 -> value is the file served; 308 -> value is the redirect target path;
    404 -> value is None.
    """
    path = url_path.split("?", 1)[0].split("#", 1)[0] or "/"
    parts = [p for p in path.split("/") if p]
    if path.endswith("/"):
        if _file(parts + ["index.html"]):
            return 200, _file(parts + ["index.html"])
        if parts and _file(parts[:-1] + [parts[-1] + ".html"]):
            return 308, "/" + "/".join(parts)
        return 404, None
    if parts[-1] == "index.html" and _file(parts):
        return 308, "/" + "/".join(parts[:-1]) + ("/" if len(parts) > 1 else "")
    if parts[-1].endswith(".html") and _file(parts):
        return 308, "/" + "/".join(parts[:-1] + [parts[-1][:-5]])
    if _file(parts):
        return 200, _file(parts)
    if _file(parts[:-1] + [parts[-1] + ".html"]):
        return 200, _file(parts[:-1] + [parts[-1] + ".html"])
    if _file(parts + ["index.html"]):
        return 308, path + "/"
    return 404, None


def resolve(url_path):
    """Return the file a URL serves directly (status 200), or None."""
    status, value = route(url_path)
    return value if status == 200 else None


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def send_head(self):
        status, value = route(self.path)
        if status == 308:
            query = self.path.split("?", 1)[1] if "?" in self.path else ""
            self.send_response(308)
            self.send_header("Location", value + ("?" + query if query else ""))
            self.end_headers()
            return None
        if status == 404:
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
        self.path = "/" + os.path.relpath(value, ROOT).replace(os.sep, "/")
        return super().send_head()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    print(f"Serving {ROOT} on http://localhost:{port}")
    http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()

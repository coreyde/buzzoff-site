#!/bin/sh
# Build the publishable site for Cloudflare Pages.
#
# Cloudflare serves every file in the output folder, so this script decides
# what is public. It copies the repo into ./public (or the folder given as the
# first argument), leaving out:
#   - anything whose name starts with a dot, at any depth (.claude/, .git*,
#     .DS_Store): internal notes, scripts, templates and git files
#   - every Markdown file (README.md and any other .md): repo notes, not pages
#   - CNAME (GitHub Pages only) and ./public itself
# Files starting with "_" are copied, so Cloudflare's _headers and _redirects
# work if they're ever added.
#
# Cloudflare Pages settings:  build command  sh .claude/scripts/build-pages.sh
#                             output folder  public
# Local:                      sh .claude/scripts/build-pages.sh [/abs/out-dir]
# POSIX sh, no dependencies. Exits non-zero if a required page is missing or
# anything private ends up in the output.
set -eu

cd "$(dirname "$0")/../.."
REPO="$(pwd)"
OUT="${1:-public}"
# The output folder is ./public, or a folder outside the repo (for checks), so
# the rm -rf below can never touch the site's own files.
case "$OUT" in
  public | ./public) OUT=public ;;
  "$REPO" | "$REPO"/*) echo "build-pages: use public or a folder outside the repo, not '$OUT'" >&2; exit 1 ;;
  /?*) ;;
  *) echo "build-pages: use public or an absolute folder outside the repo, not '$OUT'" >&2; exit 1 ;;
esac
# Only replace a folder that is empty or holds an earlier build.
if [ -d "$OUT" ] && [ -n "$(ls -A "$OUT")" ] && { [ ! -f "$OUT/index.html" ] || [ ! -f "$OUT/404.html" ]; }; then
  echo "build-pages: '$OUT' is not empty and is not an earlier build; not replacing it" >&2
  exit 1
fi

rm -rf "$OUT"
mkdir -p "$OUT"

find . \
  \( -name '.*' ! -name '.' -prune \) -o \
  \( -path ./public -prune \) -o \
  \( -type f ! -name '*.md' ! -path './CNAME' -print \) |
while IFS= read -r f; do
  rel="${f#./}"
  mkdir -p "$OUT/$(dirname "$rel")"
  cp -p "$rel" "$OUT/$rel"
done

# Sanity checks: the pages that must exist, and nothing private.
for required in index.html 404.html privacy-policy.html terms.html contact.html \
  robots.txt sitemap.xml llms.txt assets/css/site.css assets/js/site.js; do
  if [ ! -f "$OUT/$required" ]; then
    echo "build-pages: missing $required" >&2
    exit 1
  fi
done
leaks="$(find "$OUT" \( -name '.*' -o -name '*.md' -o -name CNAME \) -print)"
if [ -n "$leaks" ]; then
  echo "build-pages: private files in output:" >&2
  echo "$leaks" >&2
  exit 1
fi

echo "build-pages: $(find "$OUT" -type f | wc -l | tr -d ' ') files in $OUT/"

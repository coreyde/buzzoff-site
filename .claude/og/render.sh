#!/bin/sh
# Render the Open Graph images (1200x630 JPEG) from .claude/og/og.html.
# Needs Google Chrome (headless) and macOS sips. Run from the repo root:
#   sh .claude/og/render.sh            # all variants
#   sh .claude/og/render.sh guides     # one variant
set -eu
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TMP="$(mktemp -d)"
mkdir -p "$ROOT/assets/og"
VARIANTS="${*:-home default guides tools compare}"
for v in $VARIANTS; do
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files \
    --force-device-scale-factor=1 --window-size=1200,630 --virtual-time-budget=3000 \
    --screenshot="$TMP/$v.png" "file://$ROOT/.claude/og/og.html#$v" >/dev/null 2>&1
  sips -s format jpeg -s formatOptions 82 "$TMP/$v.png" --out "$ROOT/assets/og/$v.jpg" >/dev/null
  echo "assets/og/$v.jpg"
done
rm -rf "$TMP"

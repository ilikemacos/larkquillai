#!/bin/sh
# LarkquillAI (formerly WrenbyAI) desktop installer for macOS.
#   curl -fsSL https://ilikemacos.github.io/larkquillai/install.sh | sh
# Set LARKQUILLAI_DRY_RUN=1 (or the old WRENBYAI_DRY_RUN=1) to only print what would be downloaded.
set -eu
REPO="ilikemacos/wyneai-desktop"
API="https://api.github.com/repos/$REPO/releases/latest"
say() { printf '\033[1m==>\033[0m %s\n' "$*"; }
die() { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(uname -s)" = "Darwin" ] || [ "${LARKQUILLAI_DRY_RUN:-${WRENBYAI_DRY_RUN:-}}" = 1 ] || die "this installer is for macOS. On Windows run: irm https://ilikemacos.github.io/larkquillai/install.ps1 | iex"
command -v curl >/dev/null || die "curl is required"

say "Finding the latest LarkquillAI release…"
JSON=$(curl -fsSL -H "Accept: application/vnd.github+json" "$API") || die "couldn't reach the GitHub API"
TAG=$(printf '%s' "$JSON" | grep -m1 '"tag_name"' | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/')
urls=$(printf '%s' "$JSON" | grep '"browser_download_url"' | sed 's/.*"browser_download_url": *"\([^"]*\)".*/\1/')
DMG=$(printf '%s\n' "$urls" | grep -m1 '_universal\.dmg$' || true)
TGZ=$(printf '%s\n' "$urls" | grep -m1 '_universal\.app\.tar\.gz$' || true)
[ -n "$DMG$TGZ" ] || die "no macOS download found in release $TAG"
say "Latest release: $TAG"

if [ "${LARKQUILLAI_DRY_RUN:-${WRENBYAI_DRY_RUN:-}}" = 1 ]; then
  say "Dry run: would download ${TGZ:-$DMG}"; exit 0
fi

TMP=$(mktemp -d); trap 'rm -rf "$TMP"; [ -n "${MNT:-}" ] && hdiutil detach "$MNT" -quiet 2>/dev/null || true' EXIT
DEST="/Applications"; [ -w "$DEST" ] || DEST="$HOME/Applications"; mkdir -p "$DEST"
if [ -n "$TGZ" ]; then
  say "Downloading $(basename "$TGZ")…"; curl -fL --progress-bar -o "$TMP/app.tar.gz" "$TGZ"
  say "Unpacking…"; tar -xzf "$TMP/app.tar.gz" -C "$TMP"
else
  say "Downloading $(basename "$DMG")…"; curl -fL --progress-bar -o "$TMP/app.dmg" "$DMG"
  say "Mounting the disk image…"; MNT=$(hdiutil attach -nobrowse -readonly "$TMP/app.dmg" | awk -F'\t' '/\/Volumes\//{print $NF}' | tail -1)
  for n in LarkquillAI WrenbyAI; do [ -d "$MNT/$n.app" ] && cp -R "$MNT/$n.app" "$TMP/" && break; done
fi
# The desktop build may still be named WrenbyAI.app until it is rebuilt under the new name; accept either.
APP=""; for n in LarkquillAI WrenbyAI; do [ -d "$TMP/$n.app" ] && APP="$n" && break; done
[ -n "$APP" ] || die "LarkquillAI.app not found in the download"
say "Installing to $DEST/$APP.app…"
rm -rf "$DEST/$APP.app"; ditto "$TMP/$APP.app" "$DEST/$APP.app"
say "Removing the download quarantine flag…"; xattr -dr com.apple.quarantine "$DEST/$APP.app" 2>/dev/null || true
say "Done. LarkquillAI $TAG is installed. Open it from $DEST or run: open -a $APP"

#!/bin/sh
# WrenbyAI desktop installer for macOS.
#   curl -fsSL https://ilikemacos.github.io/wrenbyai/install.sh | sh
# Set WRENBYAI_DRY_RUN=1 to only print what would be downloaded.
set -eu
REPO="ilikemacos/wyneai-desktop"
API="https://api.github.com/repos/$REPO/releases/latest"
say() { printf '\033[1m==>\033[0m %s\n' "$*"; }
die() { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(uname -s)" = "Darwin" ] || [ "${WRENBYAI_DRY_RUN:-}" = 1 ] || die "this installer is for macOS. On Windows run: irm https://ilikemacos.github.io/wrenbyai/install.ps1 | iex"
command -v curl >/dev/null || die "curl is required"

say "Finding the latest WrenbyAI release…"
JSON=$(curl -fsSL -H "Accept: application/vnd.github+json" "$API") || die "couldn't reach the GitHub API"
TAG=$(printf '%s' "$JSON" | grep -m1 '"tag_name"' | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/')
urls=$(printf '%s' "$JSON" | grep '"browser_download_url"' | sed 's/.*"browser_download_url": *"\([^"]*\)".*/\1/')
DMG=$(printf '%s\n' "$urls" | grep -m1 '_universal\.dmg$' || true)
TGZ=$(printf '%s\n' "$urls" | grep -m1 '_universal\.app\.tar\.gz$' || true)
[ -n "$DMG$TGZ" ] || die "no macOS download found in release $TAG"
say "Latest release: $TAG"

if [ "${WRENBYAI_DRY_RUN:-}" = 1 ]; then
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
  cp -R "$MNT/WrenbyAI.app" "$TMP/"
fi
[ -d "$TMP/WrenbyAI.app" ] || die "WrenbyAI.app not found in the download"
say "Installing to $DEST/WrenbyAI.app…"
rm -rf "$DEST/WrenbyAI.app"; ditto "$TMP/WrenbyAI.app" "$DEST/WrenbyAI.app"
say "Removing the download quarantine flag…"; xattr -dr com.apple.quarantine "$DEST/WrenbyAI.app" 2>/dev/null || true
say "Done. WrenbyAI $TAG is installed. Open it from $DEST or run: open -a WrenbyAI"

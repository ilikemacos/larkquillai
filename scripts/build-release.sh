#!/bin/sh
# Rebuilds the LarkquillAI Local release files from the upstream GGUFs, reproducibly.
#   1. downloads the upstream Q4_K_M GGUF and checks its upstream SHA256
#   2. rewrites only the GGUF metadata general.name / general.description (weights untouched)
#   3. splits the result into parts under 1.9 GiB for GitHub Releases (2 GiB asset limit)
#   4. checks every file against SHA256SUMS.txt
# Usage: scripts/build-release.sh <4b|8b|all> [workdir]
# Needs: curl, python3 with gguf==0.19.0 (pip install gguf==0.19.0), split, sha256sum.
set -eu

WHICH="${1:-all}"
WORK="${2:-./build}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
SUMS="$HERE/SHA256SUMS.txt"
mkdir -p "$WORK"
cd "$WORK"

want() { awk -v f="$1" '$2==f {print $1}' "$SUMS"; }
check() { got=$(sha256sum "$1" | awk '{print $1}'); exp=$(want "$1"); [ "$got" = "$exp" ] || { echo "SHA256 mismatch for $1: got $got, expected $exp" >&2; exit 1; }; echo "ok  $1"; }

build() {
  SIZE="$1"; URL="$2"; UP_SHA="$3"; NAME="$4"; DESC="$5"
  OUT="larkquill-local-$SIZE-Q4_K_M.gguf"
  UP="upstream-$SIZE.gguf"
  if [ ! -f "$UP" ] || [ "$(sha256sum "$UP" | awk '{print $1}')" != "$UP_SHA" ]; then
    curl -fL --retry 5 -C - -o "$UP" "$URL" || curl -fL --retry 5 -o "$UP" "$URL"
  fi
  [ "$(sha256sum "$UP" | awk '{print $1}')" = "$UP_SHA" ] || { echo "upstream checksum failed for $UP" >&2; exit 1; }
  python3 -m gguf.scripts.gguf_new_metadata --force --general-name "$NAME" --general-description "$DESC" "$UP" "$OUT"
  rm -f "$UP"
  check "$OUT"
  split -b 1800M -d --numeric-suffixes=1 -a 1 "$OUT" "$OUT.part"
  for p in "$OUT".part*; do check "$p"; done
  rm -f "$OUT"
}

if [ "$WHICH" = "4b" ] || [ "$WHICH" = "all" ]; then
  build 4b \
    "https://huggingface.co/unsloth/Qwen3.5-4B-GGUF/resolve/main/Qwen3.5-4B-Q4_K_M.gguf" \
    "00fe7986ff5f6b463e62455821146049db6f9313603938a70800d1fb69ef11a4" \
    "Larkquill Local 4B" \
    "LarkquillAI Local 4B. Based on Qwen3.5-4B by the Qwen team (Apache-2.0), unmodified weights, Q4_K_M GGUF by Unsloth."
fi
if [ "$WHICH" = "8b" ] || [ "$WHICH" = "all" ]; then
  build 8b \
    "https://huggingface.co/ibm-granite/granite-4.2-8b-GGUF/resolve/main/granite-4.2-8b-Q4_K_M.gguf" \
    "16a9369d0805f80b7377d25d87f937a90c05dc04ad79173a52001e42c9aab311" \
    "Larkquill Local 8B" \
    "LarkquillAI Local 8B. Based on Granite-4.2-8B by IBM (Apache-2.0), unmodified weights, Q4_K_M GGUF by IBM."
fi
echo "Release files are in $WORK"

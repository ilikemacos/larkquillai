#!/bin/sh
# LarkquillAI Local installer for macOS and Linux.
# Downloads the model from GitHub Releases, checks every SHA256, joins the parts,
# and (if Ollama is installed) registers it as larkquill-local:<size>.
#
# Usage:
#   curl -fsSL https://github.com/ilikemacos/larkquillai/releases/download/local-v1/install.sh | sh -s -- 4b
#   curl -fsSL https://github.com/ilikemacos/larkquillai/releases/download/local-v1/install.sh | sh -s -- 8b
#
# Options (environment variables):
#   LARKQUILL_DIR   where to keep the model (default: ~/.larkquill/models)
#   LARKQUILL_KEEP_PARTS=1  keep the downloaded parts after joining
#   LARKQUILL_KEEP_GGUF=1   keep the joined .gguf after Ollama has imported it (for LM Studio/llama.cpp)
#   LARKQUILL_BASE_URL / LARKQUILL_RAW_URL  download mirrors (testing, or a Hugging Face mirror later)
set -eu

SIZE="${1:-4b}"
TAG="local-v1"
REPO="ilikemacos/larkquillai"
BASE="${LARKQUILL_BASE_URL:-https://github.com/$REPO/releases/download/$TAG}"
RAW="${LARKQUILL_RAW_URL:-}"  # empty = use release asset; set to a raw base for mirrors
DIR="${LARKQUILL_DIR:-$HOME/.larkquill/models}/$SIZE"

case "$SIZE" in
  4b)
    FILE="larkquill-local-4b-Q4_K_M.gguf"
    FULL_SHA="ba7dc3db75204c76fe8657588397e9357091e2c9797761e5bb38b4d91163fb58"
    PARTS="part1:ebe8c85d5a21969c7716c68f99693ea9489d075611e66596a2dcfb5a26b3271c
part2:6ba386017073f583a3efc4cec1ccd77505832aef51960fe9a7043f950b1c3a33"
    NEED_GB=6 ;;
  8b)
    FILE="larkquill-local-8b-Q4_K_M.gguf"
    FULL_SHA="4f4af5025f0ebaa14373405bd07b65603d0c3078b4eecf6dafc2a19d9811ddf5"
    PARTS="part1:a97de6f8e5f83ab6588cb29828d614f7bde22b23e24da528250f73ef1384724c
part2:d1916bc2e5829a67de90357136a2994aa583b1bf77173befad7c4f7d7d7bc0e5
part3:835cd8261d33f58c09de4e5e77f9fa2e742489f8ef15dedc5c73f1c3eb437dcc"
    NEED_GB=11 ;;
  *) echo "Unknown size '$SIZE'. Use 4b or 8b." >&2; exit 1 ;;
esac

say() { printf '\033[1;35m[larkquill]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[larkquill]\033[0m %s\n' "$*" >&2; exit 1; }

if command -v sha256sum >/dev/null 2>&1; then SHA="sha256sum"
elif command -v shasum >/dev/null 2>&1; then SHA="shasum -a 256"
else die "Need sha256sum or shasum to verify the download."; fi
command -v curl >/dev/null 2>&1 || die "Need curl."

sha_of() { $SHA "$1" | awk '{print $1}'; }

mkdir -p "$DIR"
cd "$DIR"

# Rough free-space check (parts + joined file are on disk at the same time).
FREE_KB=$(df -Pk . | awk 'NR==2 {print $4}')
if [ -n "$FREE_KB" ] && [ "$FREE_KB" -lt $((NEED_GB * 1024 * 1024)) ]; then
  die "Need about ${NEED_GB} GB free in $DIR (have $((FREE_KB / 1024 / 1024)) GB)."
fi

if [ -f "$FILE" ] && [ "$(sha_of "$FILE")" = "$FULL_SHA" ]; then
  say "$FILE is already here and verified."
else
  echo "$PARTS" | while IFS=: read -r P PSHA; do
    PF="$FILE.$P"
    if [ -f "$PF" ] && [ "$(sha_of "$PF")" = "$PSHA" ]; then
      say "$PF already downloaded."
      continue
    fi
    say "Downloading $PF ..."
    curl -fL --retry 5 --retry-delay 3 -C - -o "$PF" "$BASE/$PF" || curl -fL --retry 5 -o "$PF" "$BASE/$PF"
    [ "$(sha_of "$PF")" = "$PSHA" ] || { rm -f "$PF"; die "Checksum failed for $PF. Please run the installer again."; }
    say "$PF verified."
  done

  say "Joining parts into $FILE ..."
  : > "$FILE.tmp"
  echo "$PARTS" | while IFS=: read -r P PSHA; do cat "$FILE.$P" >> "$FILE.tmp"; done
  [ "$(sha_of "$FILE.tmp")" = "$FULL_SHA" ] || { rm -f "$FILE.tmp"; die "Joined file checksum failed."; }
  mv "$FILE.tmp" "$FILE"
  say "$FILE verified (SHA256 $FULL_SHA)."
  if [ "${LARKQUILL_KEEP_PARTS:-0}" != "1" ]; then rm -f "$FILE".part*; fi
fi

if [ -n "$RAW" ]; then
  curl -fsSL -o Modelfile "$RAW/modelfiles/Modelfile.$SIZE" || die "Could not download the Modelfile."
else
  curl -fsSL -o Modelfile "$BASE/Modelfile.$SIZE" || die "Could not download the Modelfile."
fi

if command -v ollama >/dev/null 2>&1; then
  say "Registering with Ollama as larkquill-local:$SIZE ..."
  ollama create "larkquill-local:$SIZE" -f Modelfile
  if [ "${LARKQUILL_KEEP_GGUF:-0}" != "1" ]; then
    rm -f "$FILE"  # Ollama keeps its own copy; set LARKQUILL_KEEP_GGUF=1 to keep this one for LM Studio/llama.cpp
  fi
  say "Done. Start chatting with:  ollama run larkquill-local:$SIZE"
  say "Tip: for faster, direct answers (no step-by-step thinking):  ollama run larkquill-local:$SIZE --think=false"
else
  say "Ollama is not installed, so the model was not registered."
  say "Model file: $DIR/$FILE"
  say "Install Ollama (https://ollama.com/download), then run:"
  say "  cd \"$DIR\" && ollama create larkquill-local:$SIZE -f Modelfile && ollama run larkquill-local:$SIZE"
  say "Or open the .gguf file in LM Studio or llama.cpp."
fi

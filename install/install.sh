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
#   LARKQUILL_DIR   install folder (default: ~/LarkquillAI-Local)
#   LARKQUILL_KEEP_PARTS=1  keep the downloaded parts after joining
#   LARKQUILL_DELETE_GGUF=1 delete the .gguf after Ollama imports it (default: keep it for LM Studio drag-and-drop)
#   LARKQUILL_BASE_URL / LARKQUILL_RAW_URL  download mirrors
set -eu

SIZE="${1:-4b}"
TAG="local-v1"
REPO="ilikemacos/larkquillai"
BASE="${LARKQUILL_BASE_URL:-https://github.com/$REPO/releases/download/$TAG}"
RAW="${LARKQUILL_RAW_URL:-}"  # empty = use release asset; set to a raw base for mirrors
ROOT="${LARKQUILL_DIR:-$HOME/LarkquillAI-Local}"
DIR="$ROOT/$SIZE"

case "$SIZE" in
  4b)
    FILE="larkquill-local-4b-Q4_K_M.gguf"
    FULL_SHA="ba7dc3db75204c76fe8657588397e9357091e2c9797761e5bb38b4d91163fb58"
    PARTS="part1:ebe8c85d5a21969c7716c68f99693ea9489d075611e66596a2dcfb5a26b3271c
part2:6ba386017073f583a3efc4cec1ccd77505832aef51960fe9a7043f950b1c3a33"
    NEED_GB=6
    LABEL="4B" ;;
  8b)
    FILE="larkquill-local-8b-Q4_K_M.gguf"
    FULL_SHA="4f4af5025f0ebaa14373405bd07b65603d0c3078b4eecf6dafc2a19d9811ddf5"
    PARTS="part1:a97de6f8e5f83ab6588cb29828d614f7bde22b23e24da528250f73ef1384724c
part2:d1916bc2e5829a67de90357136a2994aa583b1bf77173befad7c4f7d7d7bc0e5
part3:835cd8261d33f58c09de4e5e77f9fa2e742489f8ef15dedc5c73f1c3eb437dcc"
    NEED_GB=11
    LABEL="8B" ;;
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

# Double-click runners live in the visible root folder (macOS .command + plain shell).
write_runners() {
  mkdir -p "$ROOT"
  CMD="$ROOT/Run LarkquillAI Local ${LABEL}.command"
  SH="$ROOT/run-${SIZE}.sh"
  cat > "$CMD" <<RUN
#!/bin/sh
# Double-click this file (or open it in Terminal) to chat with LarkquillAI Local ${LABEL}.
cd "\$(dirname "\$0")"
if ! command -v ollama >/dev/null 2>&1; then
  echo "Ollama is not installed. Get it from https://ollama.com/download"
  echo "Or drag this file into LM Studio:"
  echo "  \$PWD/${SIZE}/${FILE}"
  echo
  echo "Press Enter to close."; read -r _
  exit 1
fi
exec ollama run larkquill-local:${SIZE}
RUN
  chmod +x "$CMD"
  cat > "$SH" <<RUN
#!/bin/sh
exec ollama run larkquill-local:${SIZE}
RUN
  chmod +x "$SH"

  # Short how-to next to the runners.
  cat > "$ROOT/How to run.txt" <<TXT
LarkquillAI Local — how to run
==============================

Files are in: $ROOT
(This is a normal folder in your home directory — not hidden.)

Ollama (easiest after install)
------------------------------
• Mac: double-click  "Run LarkquillAI Local ${LABEL}.command"
• Or in Terminal:    ollama run larkquill-local:${SIZE}

LM Studio (drag and drop)
-------------------------
1. Download the one-file .gguf from the Local page, or use:
   $DIR/$FILE
2. Drag that .gguf onto the LM Studio window (or into My Models).
3. Optional: paste the system prompt from the model guide.

Faster answers in Ollama (skip step-by-step thinking):
  ollama run larkquill-local:${SIZE} --think=false
TXT
}

write_runners

if command -v ollama >/dev/null 2>&1; then
  say "Registering with Ollama as larkquill-local:$SIZE ..."
  ollama create "larkquill-local:$SIZE" -f Modelfile
  if [ "${LARKQUILL_DELETE_GGUF:-0}" = "1" ]; then
    rm -f "$FILE"
  else
    say "Kept $DIR/$FILE so you can drag it into LM Studio."
  fi
  say "Done. Folder: $ROOT"
  say "Double-click:  Run LarkquillAI Local ${LABEL}.command"
  say "Or Terminal:   ollama run larkquill-local:$SIZE"
  say "Tip: faster answers →  ollama run larkquill-local:$SIZE --think=false"
else
  say "Ollama is not installed, so the model was not registered."
  say "Model file (drag into LM Studio): $DIR/$FILE"
  say "Folder: $ROOT"
  say "Install Ollama (https://ollama.com/download), then double-click the Run … .command"
  say "  or: cd \"$DIR\" && ollama create larkquill-local:$SIZE -f Modelfile && ollama run larkquill-local:$SIZE"
fi

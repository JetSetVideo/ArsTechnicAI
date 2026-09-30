#!/usr/bin/env bash
# setup.sh — prepare Ars Technic AI on macOS or Linux. Safe to run again.
#
# What it does, and nothing else:
#   1. checks the tools the app needs (deno, curl, Python ≥ 3.10) and says how
#      to install any that are missing, per platform;
#   2. creates the restoration engine's Python environment at
#      $RESTORER_ROOT/.venv (default ../ArchiveRestorer) if it is not there,
#      using uv when available and python3 -m venv otherwise;
#   3. on Linux, checks the shared libraries OpenCV loads at import time;
#   4. reports the optional pieces: ffmpeg, Chrome/Chromium for the checks.
#
# It never deletes anything. An existing environment is left alone unless you
# pass --upgrade, which installs the requirements into it again.
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$PWD"
ENGINE_DIR="${RESTORER_ROOT:-$ROOT/../ArchiveRestorer}"
UPGRADE=0
[ "${1:-}" = "--upgrade" ] && UPGRADE=1

OS="$(uname -s)"
ok() { printf '  ok    %s\n' "$*"; }
warn() { printf '  note  %s\n' "$*"; }
fail() { printf '  MISSING %s\n' "$*" >&2; MISSING=1; }
MISSING=0

have() { command -v "$1" >/dev/null 2>&1; }

pkg_hint() {
  # $1 = what, $2 = brew, $3 = apt, $4 = dnf, $5 = pacman
  case "$OS" in
    Darwin) echo "brew install $2" ;;
    Linux)
      if have apt-get; then echo "sudo apt-get install -y $3"
      elif have dnf; then echo "sudo dnf install -y $4"
      elif have pacman; then echo "sudo pacman -S --needed $5"
      else echo "install $1 with your distribution's package manager"; fi ;;
    *) echo "install $1" ;;
  esac
}

echo "Ars Technic AI setup — $OS $(uname -m)"
echo ""
echo "Required"

if have deno; then
  ok "deno $(deno --version | head -1 | awk '{print $2}')"
else
  fail "deno — curl -fsSL https://deno.land/install.sh | sh   (then open a new shell)"
fi

if have curl; then ok "curl"; else fail "curl — $(pkg_hint curl curl curl curl curl)"; fi

# The interpreter must match the machine: on Apple silicon an Intel Homebrew
# python3 runs under Rosetta and installs x86_64 OpenCV wheels that the native
# processes cannot share. Mismatched interpreters are skipped, not used.
ARCH="$(uname -m)"
PY=""
for candidate in python3.12 python3.13 python3.11 python3.10 python3 \
  /opt/homebrew/bin/python3.12 /opt/homebrew/bin/python3; do
  if have "$candidate"; then
    if "$candidate" -c "import sys, platform; raise SystemExit(0 if sys.version_info >= (3, 10) and platform.machine() == '$ARCH' else 1)" 2>/dev/null; then
      PY="$(command -v "$candidate")"
      break
    fi
  fi
done
if [ -z "$PY" ] && have uv; then
  # uv can fetch a native interpreter itself; that is enough to proceed.
  PY="uv-managed"
fi
if [ "$PY" = "uv-managed" ]; then
  ok "python via uv (no native $ARCH interpreter on PATH; uv will provide 3.12)"
elif [ -n "$PY" ]; then
  ok "python $("$PY" -c 'import platform; print(platform.python_version())') ($PY, $ARCH)"
else
  fail "Python 3.10+ — $(pkg_hint python python@3.12 'python3 python3-venv' python3 python)"
fi

if [ "$MISSING" = "1" ]; then
  echo ""
  echo "Install the missing tools above, then run ./setup.sh again." >&2
  exit 1
fi

echo ""
echo "Restoration engine"
if [ ! -d "$ENGINE_DIR/backend" ]; then
  warn "no engine at $ENGINE_DIR"
  warn "the generation half (library, refs, cinema rules, generate nodes) works without it;"
  warn "grading, the depth strip and export need it. Set RESTORER_ROOT to its checkout."
else
  VENV="$ENGINE_DIR/.venv"
  REQ="$ENGINE_DIR/backend/requirements.txt"
  if [ -x "$VENV/bin/python" ] && [ "$UPGRADE" = "0" ]; then
    VENV_ARCH="$("$VENV/bin/python" -c 'import platform; print(platform.machine())' 2>/dev/null || echo unknown)"
    if [ "$VENV_ARCH" != "$ARCH" ]; then
      fail "environment at $VENV is $VENV_ARCH on a $ARCH machine — move it aside and run ./setup.sh again"
    else
      ok "environment present at $VENV ($VENV_ARCH; pass --upgrade to reinstall requirements)"
    fi
  else
    if [ ! -x "$VENV/bin/python" ]; then
      echo "  creating $VENV ..."
      if have uv; then
        # A version request, not a path: uv picks (or downloads) a native build.
        uv venv --python 3.12 "$VENV"
      else
        [ "$PY" = "uv-managed" ] && { echo "  no native Python found" >&2; exit 1; }
        "$PY" -m venv "$VENV" || {
          echo "  python -m venv failed. On Debian/Ubuntu: $(pkg_hint venv '' python3-venv python3 python)" >&2
          exit 1
        }
      fi
    fi
    echo "  installing $REQ ..."
    if have uv; then
      uv pip install --python "$VENV/bin/python" -r "$REQ"
    else
      "$VENV/bin/python" -m pip install --upgrade pip >/dev/null
      "$VENV/bin/python" -m pip install -r "$REQ"
    fi
    ok "environment ready"
  fi

  if [ "$OS" = "Linux" ]; then
    # opencv-python links against libGL and GLib; minimal images lack both and
    # the engine then dies at import with a message about libGL.so.1.
    if ! "$VENV/bin/python" -c 'import cv2' 2>/dev/null; then
      fail "OpenCV cannot load its system libraries — $(pkg_hint 'libGL and GLib' '' 'libgl1 libglib2.0-0' 'mesa-libGL glib2' 'mesa glib2')"
    else
      ok "OpenCV imports"
    fi
  else
    "$VENV/bin/python" -c 'import cv2' 2>/dev/null && ok "OpenCV imports" || fail "OpenCV does not import — run ./setup.sh --upgrade"
  fi
fi

echo ""
echo "Optional"
if have ffmpeg; then
  ok "ffmpeg on PATH (preferred for export)"
else
  warn "no ffmpeg on PATH — export uses the bundled imageio-ffmpeg build. For a system one: $(pkg_hint ffmpeg ffmpeg ffmpeg ffmpeg-free ffmpeg)"
fi

CHROME=""
for c in "${CHROME_PATH:-}" \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  "/Applications/Chromium.app/Contents/MacOS/Chromium" \
  /usr/bin/google-chrome /usr/bin/google-chrome-stable /usr/bin/chromium /usr/bin/chromium-browser /snap/bin/chromium; do
  if [ -n "$c" ] && [ -x "$c" ]; then CHROME="$c"; break; fi
done
if [ -n "$CHROME" ]; then
  ok "browser for deno task runtime / capture: $CHROME"
else
  warn "no Chrome/Chromium found — only needed for deno task runtime and deno task capture (set CHROME_PATH)"
fi

if [ -n "${GEMINI_API_KEY:-}" ]; then ok "GEMINI_API_KEY set"; else warn "GEMINI_API_KEY not set — AI vision/repair cards stay disabled (optional)"; fi

echo ""
if [ "$MISSING" = "1" ]; then
  echo "Setup finished with missing pieces (see above)." >&2
  exit 1
fi
echo "Setup complete. Start with: ./start.sh"

#!/usr/bin/env bash
# Launch Ars Technic AI: engine + unified host (Home / Workshop).
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$PWD"

ENGINE_DIR="${RESTORER_ROOT:-$ROOT/../ArchiveRestorer}"
ENGINE_PORT="${RESTORER_PORT:-8000}"
UI_PORT="${ARS_UI_PORT:-${WIV_UI_PORT:-8090}}"

command -v deno >/dev/null || { echo "deno is not installed. See https://deno.com" >&2; exit 1; }

# The restoration engine is required for the *restoration* half — grading,
# stabilisation, the depth strip, export. It is NOT required for the generation
# half: the reference library, the cinema rules and the generate nodes are all
# TypeScript now, and the schema they were generated from is vendored at
# engines/restorer/. So a missing engine is a reduced app, not a failed start.
HAVE_ENGINE=1
if [ ! -d "$ENGINE_DIR" ]; then
  HAVE_ENGINE=0
  echo "No restoration engine at: $ENGINE_DIR"
  echo "Starting without it — the Library, Refs and generate nodes all work;"
  echo "grading, the depth strip and export will not. Set RESTORER_ROOT to enable them."
  echo ""
fi

STARTED_ENGINE=0
cleanup() {
  echo ""
  echo "Shutting down..."
  [ -n "${UI_PID:-}" ] && kill "$UI_PID" 2>/dev/null || true
  if [ "$STARTED_ENGINE" = "1" ] && [ -n "${ENGINE_PID:-}" ]; then
    kill "$ENGINE_PID" 2>/dev/null || true
  fi
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

engine_up() { curl -fsS --max-time 1 "http://127.0.0.1:$ENGINE_PORT/api/health" >/dev/null 2>&1; }

# Is anything at all listening there? Distinguishing "free" from "occupied by
# something that is not our engine" is the whole point: ComfyUI also defaults
# to :8000, and without this check the failure surfaces as uvicorn being unable
# to bind — true, and silent about why.
port_taken() { curl -fsS --max-time 1 -o /dev/null "http://127.0.0.1:$ENGINE_PORT/" 2>/dev/null; }

if [ "$HAVE_ENGINE" = "0" ]; then
  : # nothing to start
elif engine_up; then
  echo "Engine already running on :$ENGINE_PORT — leaving it alone."
elif port_taken; then
  echo "Something is already listening on :$ENGINE_PORT, and it is not the restoration engine" >&2
  echo "(its /api/health does not answer). ComfyUI defaults to this port." >&2
  echo "" >&2
  if command -v lsof >/dev/null 2>&1; then
    echo "Holding the port:" >&2
    lsof -nP -iTCP:"$ENGINE_PORT" -sTCP:LISTEN 2>/dev/null | tail -n +2 | sed 's/^/  /' >&2
    echo "" >&2
  fi
  echo "Run the engine somewhere else and point this at it:" >&2
  echo "  RESTORER_PORT=8001 $0" >&2
  exit 1
else
  if [ ! -x "$ENGINE_DIR/.venv/bin/python" ]; then
    # The old advice pointed at ArchiveRestorer/start.sh, which delegates
    # straight back here — a loop that never created the environment.
    echo "The engine's Python environment is missing. Create it with:" >&2
    echo "  $ROOT/setup.sh" >&2
    exit 1
  fi
  echo "Starting the engine on :$ENGINE_PORT ..."
  ( cd "$ENGINE_DIR/backend" && exec "$ENGINE_DIR/.venv/bin/python" -m uvicorn app:app \
      --host 127.0.0.1 --port "$ENGINE_PORT" ) &
  ENGINE_PID=$!
  STARTED_ENGINE=1

  for _ in $(seq 1 40); do
    engine_up && break
    if ! kill -0 "$ENGINE_PID" 2>/dev/null; then
      echo "The engine failed to start. Check the output above." >&2
      exit 1
    fi
    sleep 0.5
  done
  engine_up || { echo "The engine did not answer in time." >&2; exit 1; }
  echo "Engine ready."
fi

# Generate from the *vendored* schema by default. Pointing RESTORER_ROOT at a
# live engine makes the generator read that engine's own DEFAULT_PARAMS
# instead, which is how the vendored copy is checked against the original.
echo "Generating node types and the cinema vocabulary ..."
if [ "$HAVE_ENGINE" = "1" ] && [ -x "$ENGINE_DIR/.venv/bin/python" ]; then
  RESTORER_ROOT="$ENGINE_DIR" deno task codegen
else
  # Unset explicitly: a RESTORER_ROOT inherited from the caller's shell would
  # otherwise send the generator at a checkout this script has just decided is
  # not usable.
  ( unset RESTORER_ROOT; deno task codegen )
fi
echo "Bundling Blueprint ..."
deno task build

echo "Starting Ars Technic AI on :$UI_PORT ..."
ARS_UI_PORT="$UI_PORT" WIV_UI_PORT="$UI_PORT" WIV_BACKEND="127.0.0.1:$ENGINE_PORT" \
  RESTORER_UI_DIR="$ENGINE_DIR/frontend/public" \
  RESTORER_SHARED="$ENGINE_DIR/shared" \
  ARS_LIBRARY_ROOT="$ROOT/library" \
  deno run --allow-net --allow-read --allow-env --allow-write="$ROOT/workflows,$ROOT/workspace" server.ts &
UI_PID=$!

sleep 1
URL="http://127.0.0.1:$UI_PORT"
echo ""
echo "  ────────────────────────────────────────────"
echo "   Ars Technic AI is running"
echo "   Home      : $URL/"
echo "   Workshop  : $URL/blueprint/"
if [ "$HAVE_ENGINE" = "1" ]; then
  echo "   Engine    : http://127.0.0.1:$ENGINE_PORT/docs"
else
  echo "   Engine    : not running — generation only"
fi
echo "   Library   : $(ls "$ROOT/library/thumbs/movies" 2>/dev/null | wc -l | tr -d ' ') film frames, $(ls "$ROOT/library/references"/*.json 2>/dev/null | wc -l | tr -d ' ') authored shelves"
echo "   Press Ctrl-C to stop."
echo "  ────────────────────────────────────────────"
echo ""

wait "$UI_PID"

#!/usr/bin/env bash
# Prefer the unified Ars Technic AI host when present.
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$PWD"
UNIFIED="${BLUEPRINT_ROOT:-$ROOT/../ArsTechnicAI}"

if [ -x "$UNIFIED/start.sh" ]; then
  echo "Delegating to Ars Technic AI unified host: $UNIFIED/start.sh"
  exec "$UNIFIED/start.sh"
fi

# Fallback: engine + desk only (legacy)
BACKEND_PORT="${RESTORER_PORT:-8000}"
UI_PORT="${RESTORER_UI_PORT:-8080}"

if [ ! -x ".venv/bin/python" ]; then
  echo "Python environment missing. Creating it now..."
  uv venv --python 3.12 .venv
  uv pip install --python .venv/bin/python -r backend/requirements.txt
fi

STARTED_ENGINE=0
cleanup() {
  echo ""
  echo "Shutting down..."
  [ -n "${UI_PID:-}" ] && kill "$UI_PID" 2>/dev/null || true
  if [ "$STARTED_ENGINE" = "1" ] && [ -n "${BACK_PID:-}" ]; then
    kill "$BACK_PID" 2>/dev/null || true
  fi
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

engine_up() { curl -fsS --max-time 1 "http://127.0.0.1:$BACKEND_PORT/api/health" >/dev/null 2>&1; }

if engine_up; then
  echo "Engine already running on :$BACKEND_PORT — leaving it alone."
else
  echo "Starting Python engine on :$BACKEND_PORT ..."
  ( cd backend && exec "$ROOT/.venv/bin/python" -m uvicorn app:app \
      --host 127.0.0.1 --port "$BACKEND_PORT" ) &
  BACK_PID=$!
  STARTED_ENGINE=1
  for i in $(seq 1 40); do
    engine_up && break
    sleep 0.5
  done
fi

echo "Starting Deno grading desk on :$UI_PORT ..."
( cd frontend && exec deno run --allow-net --allow-read --allow-env server.ts ) &
UI_PID=$!
wait

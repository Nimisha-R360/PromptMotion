#!/usr/bin/env bash
# Starts the local llama.cpp model (OpenAI-compatible API) used by Prompt Motion — supervised.
# Model: Qwen2.5-3B-Instruct Q4_K_M — instruction-tuned, strong at JSON/grammar-constrained output.
#
# Memory: the server settles at ~6 GB RSS (model mmap + KV cache + buffers) and creeps slowly with use.
# On a busy 15 GB machine the kernel OOM killer / systemd-oomd may still kill it, so this script:
#   • restarts the server automatically if it exits unexpectedly (OOM kill, crash)
#   • restarts it proactively when it is IDLE and above LLM_MAX_RSS_MB (never in the middle of a request)
# (llama-cpp-python's RAM prompt cache is intentionally NOT used: it copies ~1 GB per cached prompt and
#  grew the process by ~3 GB per request round until it was OOM-killed.)
set -uo pipefail
cd "$(dirname "$0")/.."
MODEL="${LLM_MODEL_PATH:-$HOME/models/qwen2.5-3b-q4km.gguf}"
PORT="${LLM_PORT:-8081}"
MAX_RSS_MB="${LLM_MAX_RSS_MB:-7500}"
# llama.cpp is fastest with one thread per *physical* core (hyper-threads add contention):
# measured on this i5-1145G7 (4C/8T): 4 threads ≈ 10 tok/s vs 8 threads ≈ 9 tok/s.
PHYS_CORES="$(lscpu -p=Core,Socket 2>/dev/null | grep -v '^#' | sort -u | wc -l)"
[ "${PHYS_CORES:-0}" -gt 0 ] || PHYS_CORES="$(nproc)"
THREADS="${LLM_THREADS:-$PHYS_CORES}"

# Already running? (e.g. started in another terminal) — don't try to bind the port twice.
if curl -s -m 2 "http://127.0.0.1:${PORT}/v1/models" >/dev/null 2>&1; then
  echo "A model server is already running on http://127.0.0.1:${PORT} — nothing to do."
  echo "To restart it, stop the existing one first:  kill \$(lsof -t -i :${PORT})"
  exit 0
fi
if ss -ltn 2>/dev/null | grep -q ":${PORT} "; then
  echo "Port ${PORT} is in use by another program. Free it or run with LLM_PORT=<port> (and set LLM_BASE_URL for the app)." >&2
  exit 1
fi

if command -v llama-server >/dev/null 2>&1; then
  # Native llama.cpp server if installed
  CMD=(llama-server -m "$MODEL" --port "$PORT" -c 8192 -t "$THREADS" --jinja)
else
  PY=".venv/bin/python"
  [ -x "$PY" ] || PY=python3
  CMD=("$PY" -m llama_cpp.server
    --model "$MODEL"
    --model_alias qwen2.5-3b-instruct
    --chat_format chatml
    --n_ctx 8192
    --n_batch 512
    --n_threads "$THREADS"
    --host 127.0.0.1 --port "$PORT")
fi

log() { echo "[llm-supervisor $(date +%H:%M:%S)] $*" >&2; }
CHILD=""
STOPPING=0
stop() {
  STOPPING=1
  [ -n "$CHILD" ] && kill "$CHILD" 2>/dev/null && wait "$CHILD" 2>/dev/null
  log "stopped"
  exit 0
}
trap stop INT TERM

cpu_ticks() { awk '{print $14 + $15}' "/proc/$1/stat" 2>/dev/null || echo 0; }

BACKOFF=2
while true; do
  log "starting model server on :$PORT (threads=$THREADS, restart when idle above ${MAX_RSS_MB} MB)"
  "${CMD[@]}" &
  CHILD=$!
  STARTED=$(date +%s)
  # watchdog: poll every 15 s while the server runs
  while kill -0 "$CHILD" 2>/dev/null; do
    sleep 15 & wait $! 2>/dev/null
    kill -0 "$CHILD" 2>/dev/null || break
    RSS_MB=$(( $(ps -o rss= -p "$CHILD" 2>/dev/null || echo 0) / 1024 ))
    if [ "$RSS_MB" -gt "$MAX_RSS_MB" ]; then
      # only restart when idle (≈ no CPU used over 3 s), so no request is cut off
      T1=$(cpu_ticks "$CHILD"); sleep 3; T2=$(cpu_ticks "$CHILD")
      if [ $((T2 - T1)) -lt 15 ]; then
        log "memory at ${RSS_MB} MB (> ${MAX_RSS_MB} MB) and idle — restarting to release memory"
        kill "$CHILD" 2>/dev/null
        wait "$CHILD" 2>/dev/null
        BACKOFF=2
        continue 2
      fi
    fi
  done
  wait "$CHILD" 2>/dev/null
  CODE=$?
  [ "$STOPPING" = 1 ] && exit 0
  # crash loop protection: back off if it dies quickly, reset after a healthy run
  if [ $(( $(date +%s) - STARTED )) -gt 120 ]; then BACKOFF=2; else BACKOFF=$(( BACKOFF * 2 > 60 ? 60 : BACKOFF * 2 )); fi
  if [ "$CODE" -eq 137 ] || [ "$CODE" -eq 9 ]; then
    log "server was killed (exit $CODE — usually the out-of-memory killer). Restarting in ${BACKOFF}s…"
  else
    log "server exited with code $CODE. Restarting in ${BACKOFF}s…"
  fi
  sleep "$BACKOFF" & wait $! 2>/dev/null
done

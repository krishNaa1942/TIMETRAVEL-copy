#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MOBILE_DIR="${REPO_ROOT}/TimeTravelMobile"

BACKEND_PORT="${BACKEND_PORT:-5001}"
BACKEND_HEALTH_URL="${BACKEND_HEALTH_URL:-http://127.0.0.1:${BACKEND_PORT}/api/health}"
BACKEND_LOG="${BACKEND_LOG:-${REPO_ROOT}/instance/dev-backend.log}"
BACKEND_BASE_URL="${BACKEND_HEALTH_URL%/api/health}"
PROFILE_SUMMARY_URL="${BACKEND_BASE_URL}/api/profile/summary"

PYTHON_BIN="${PYTHON_BIN:-${REPO_ROOT}/.venv/bin/python}"
if [[ ! -x "${PYTHON_BIN}" ]]; then
  if command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="$(command -v python3)"
  else
    echo "[dev] Error: Python not found. Set PYTHON_BIN or create .venv first."
    exit 1
  fi
fi

if [[ ! -d "${MOBILE_DIR}" ]]; then
  echo "[dev] Error: Mobile app folder not found at ${MOBILE_DIR}."
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "[dev] Error: curl is required but not installed."
  exit 1
fi

STARTED_BACKEND=0
BACKEND_PID=""

profile_summary_status() {
  curl -s -o /dev/null -w "%{http_code}" "${PROFILE_SUMMARY_URL}" 2>/dev/null || true
}

start_backend() {
  mkdir -p "$(dirname "${BACKEND_LOG}")"
  echo "[dev] Starting backend with ${PYTHON_BIN} run.py"
  (
    cd "${REPO_ROOT}"
    "${PYTHON_BIN}" run.py >>"${BACKEND_LOG}" 2>&1
  ) &

  BACKEND_PID=$!
  STARTED_BACKEND=1

  echo "[dev] Waiting for backend health at ${BACKEND_HEALTH_URL}"
  healthy=0
  for _ in $(seq 1 45); do
    if curl -fsS "${BACKEND_HEALTH_URL}" >/dev/null 2>&1; then
      healthy=1
      break
    fi
    sleep 1
  done

  if [[ "${healthy}" -ne 1 ]]; then
    echo "[dev] Error: Backend did not become healthy in time."
    echo "[dev] Last backend logs:"
    tail -n 40 "${BACKEND_LOG}" || true
    exit 1
  fi

  echo "[dev] Backend is healthy on port ${BACKEND_PORT}."
}

cleanup() {
  local exit_code=$?
  if [[ "${STARTED_BACKEND}" -eq 1 ]] && [[ -n "${BACKEND_PID}" ]]; then
    if kill -0 "${BACKEND_PID}" >/dev/null 2>&1; then
      echo "[dev] Stopping backend (pid ${BACKEND_PID})"
      kill "${BACKEND_PID}" >/dev/null 2>&1 || true
    fi
  fi
  exit "${exit_code}"
}

trap cleanup EXIT INT TERM

if lsof -nP -iTCP:"${BACKEND_PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
  if curl -fsS "${BACKEND_HEALTH_URL}" >/dev/null 2>&1; then
    if [[ "$(profile_summary_status)" == "404" ]]; then
      echo "[dev] Existing backend is stale; restarting it so /api/profile/summary is available."
      existing_pids="$(lsof -t -iTCP:"${BACKEND_PORT}" -sTCP:LISTEN 2>/dev/null || true)"
      if [[ -n "${existing_pids}" ]]; then
        for pid in ${existing_pids}; do
          kill "${pid}" >/dev/null 2>&1 || true
        done
      fi
      start_backend
    else
      echo "[dev] Reusing existing backend on port ${BACKEND_PORT}."
    fi
  else
    echo "[dev] Error: Port ${BACKEND_PORT} is occupied but health check failed."
    echo "[dev] Run: lsof -nP -iTCP:${BACKEND_PORT} -sTCP:LISTEN"
    exit 1
  fi
else
  start_backend
fi

echo "[dev] Starting Expo from ${MOBILE_DIR}"
cd "${MOBILE_DIR}"
npx expo start "$@"

#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${HANASAND_DB_MONITOR_DIR:-/home/hanasand/hanasand-deploy-64d9339/ops/db-dashboard-monitor}"
ENV_FILE="${HANASAND_DB_MONITOR_ENV:-/home/hanasand/monitor-state/db-dashboard-monitor.env}"
LOG_FILE="${HANASAND_DB_MONITOR_LOG:-/home/hanasand/monitor-state/db-dashboard-monitor.log}"
LOCK_FILE="${HANASAND_DB_MONITOR_LOCK:-/tmp/hanasand-db-dashboard-monitor.lock}"
PAUSE_FILE="${HANASAND_DB_MONITOR_PAUSE:-/home/hanasand/monitor-state/db-dashboard-monitor.pause}"

mkdir -p "$(dirname "$LOG_FILE")"

if [[ -f "$PAUSE_FILE" ]]; then
  echo "{\"checkedAt\":\"$(date -Is)\",\"ok\":true,\"reason\":\"planned_maintenance\"}" >> "$LOG_FILE"
  exit 0
fi

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

cd "$APP_DIR"
{
  flock -n 9 || {
    echo "{\"checkedAt\":\"$(date -Is)\",\"ok\":false,\"reason\":\"previous_run_still_active\"}"
    exit 0
  }
  node db-dashboard-monitor.mjs
} 9>"$LOCK_FILE" >> "$LOG_FILE" 2>&1

#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# Time Travel – Database Backup Script
# Dumps the Postgres database via docker compose and rotates
# old backups (14-day retention).
#
# Usage (on the VPS):
#   ./scripts/backup_db.sh
#
# Configure via .env.production:
#   BACKUP_RETENTION_DAYS=14   (optional, default 14)
# ══════════════════════════════════════════════════════════════
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

# Load .env.production for POSTGRES_* values (best-effort)
if [[ -f .env.production ]]; then
  set -a; source .env.production; set +a
fi

RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
BACKUP_DIR="${REPO_DIR}/deploy/backups"
STAMP="$(date +%Y%m%d_%H%M%S)"
FILENAME="timetravel_${STAMP}.sql.gz"

log() { printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }

mkdir -p "$BACKUP_DIR"

log "Starting backup: ${FILENAME}"
if docker compose -f docker-compose.prod.yml ps postgres >/dev/null 2>&1; then
  docker compose -f docker-compose.prod.yml exec -T postgres \
    pg_dump -U "${POSTGRES_USER:-timetravel}" -d "${POSTGRES_DB:-timetravel}" \
    --no-owner --no-privileges | gzip > "${BACKUP_DIR}/${FILENAME}"
else
  log "ERROR: postgres container not running — backup skipped."
  exit 1
fi

SIZE="$(du -h "${BACKUP_DIR}/${FILENAME}" | cut -f1)"
log "Backup complete: ${FILENAME} (${SIZE})"

# Rotate old backups
DELETED=$(find "$BACKUP_DIR" -name "timetravel_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete -print | wc -l | tr -d ' ')
log "Rotation: removed ${DELETED} backup(s) older than ${RETENTION_DAYS} days."

# Keep the most recent backup as a stable reference copy
ls -1t "${BACKUP_DIR}"/timetravel_*.sql.gz 2>/dev/null | head -1 | xargs -r -I{} cp {} "${BACKUP_DIR}/latest.sql.gz"
log "Copied most recent backup to 'latest.sql.gz'."

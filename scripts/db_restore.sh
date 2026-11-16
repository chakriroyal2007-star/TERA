#!/usr/bin/env bash
# TERA Emergency Coordination System — Database Disaster Recovery Restore
# Usage: ./scripts/db_restore.sh <BACKUP_FILE.sql.gz>

set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <path_to_backup_file.sql.gz>"
  exit 1
fi

BACKUP_FILE="$1"
if [ ! -f "$BACKUP_FILE" ]; then
  echo "[TERA RESTORE ERROR] Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "[TERA RESTORE] Verifying integrity of $BACKUP_FILE..."
if [ -f "${BACKUP_FILE}.sha256" ]; then
  cd "$(dirname "$BACKUP_FILE")"
  shasum -a 256 -c "$(basename "${BACKUP_FILE}.sha256")"
  cd - >/dev/null
  echo "[TERA RESTORE] Checksum verified."
fi

echo "[TERA RESTORE] WARNING: This operation will overwrite existing emergency data!"
echo "[TERA RESTORE] Restoring database..."

if command -v docker >/dev/null 2>&1 && docker ps | grep -q "tera2-postgres-1"; then
  echo "[TERA RESTORE] Restoring into Docker container tera2-postgres-1..."
  gunzip -c "$BACKUP_FILE" | docker exec -i tera2-postgres-1 psql -U tera -d tera
elif command -v psql >/dev/null 2>&1; then
  echo "[TERA RESTORE] Restoring via local psql..."
  gunzip -c "$BACKUP_FILE" | psql "${DATABASE_URL:-postgresql://localhost:5432/tera}"
else
  echo "[TERA RESTORE ERROR] Neither docker nor psql found."
  exit 1
fi

echo "[TERA RESTORE SUCCESS] Disaster recovery restore completed successfully."

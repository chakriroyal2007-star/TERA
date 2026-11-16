#!/usr/bin/env bash
# TERA Emergency Coordination System — Automated Database Backup
# Usage: ./scripts/db_backup.sh [BACKUP_DIR]

set -euo pipefail

BACKUP_DIR="${1:-./backups}"
mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/tera_db_${TIMESTAMP}.sql.gz"

echo "[TERA BACKUP] Initiating database snapshot at ${TIMESTAMP}..."

if command -v docker >/dev/null 2>&1 && docker ps | grep -q "tera2-postgres-1"; then
  echo "[TERA BACKUP] Dumping via Docker container tera2-postgres-1..."
  docker exec -t tera2-postgres-1 pg_dump -U tera -d tera --clean --if-exists | gzip > "$BACKUP_FILE"
elif command -v pg_dump >/dev/null 2>&1; then
  echo "[TERA BACKUP] Dumping via local pg_dump..."
  pg_dump "${DATABASE_URL:-postgresql://localhost:5432/tera}" --clean --if-exists | gzip > "$BACKUP_FILE"
else
  echo "[TERA BACKUP ERROR] Neither docker nor pg_dump found."
  exit 1
fi

FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
CHECKSUM=$(shasum -a 256 "$BACKUP_FILE" | cut -d' ' -f1)

echo "[TERA BACKUP SUCCESS] Database backup written to: $BACKUP_FILE"
echo "  - File Size: $FILE_SIZE"
echo "  - SHA-256 Checksum: $CHECKSUM"
echo "$CHECKSUM  $(basename "$BACKUP_FILE")" > "${BACKUP_FILE}.sha256"


#!/usr/bin/env sh
set -eu
umask 077
backup_dir=${1:-./backups}
mkdir -p "$backup_dir"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
docker compose exec -T postgres pg_dump -U tera -d tera -Fc > "$backup_dir/tera-$stamp.dump"
printf 'Database backup written to %s\n' "$backup_dir/tera-$stamp.dump"

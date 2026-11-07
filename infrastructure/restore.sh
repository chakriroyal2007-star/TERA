#!/usr/bin/env sh
set -eu
if [ "$#" -ne 1 ]; then printf 'Usage: restore.sh backup.dump (into an empty database)\n' >&2; exit 1; fi
# No --clean: refuses to overwrite an existing schema. Restore into a fresh deployment.
docker compose exec -T postgres pg_restore -U tera -d tera --exit-on-error < "$1"

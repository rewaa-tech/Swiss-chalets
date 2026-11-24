#!/usr/bin/env bash
# Daily compressed pg_dump, keeps the latest 14. cron: 0 4 * * * /opt/swisschalets/app/deploy/backup.sh
set -euo pipefail
set -a; source /etc/swisschalets.env; set +a
DIR=/var/swisschalets/backups
mkdir -p "$DIR"
pg_dump --no-owner --format=custom "$DATABASE_URL" > "$DIR/db-$(date +%F-%H%M).dump"
ls -1t "$DIR"/db-*.dump | tail -n +15 | xargs -r rm --

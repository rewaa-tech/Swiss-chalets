#!/usr/bin/env bash
# Usage: deploy/restore.sh /var/swisschalets/backups/db-YYYY-MM-DD-HHMM.dump
set -euo pipefail
[ -f "${1:-}" ] || { echo "usage: $0 <dump file>"; exit 1; }
set -a; source /etc/swisschalets.env; set +a
sudo systemctl stop swisschalets
pg_restore --clean --if-exists --no-owner --dbname "$DATABASE_URL" "$1"
sudo systemctl start swisschalets
curl -fsS http://127.0.0.1:3000/health && echo " ✅ restored"

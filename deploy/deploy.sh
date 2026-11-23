#!/usr/bin/env bash
# Build → migrate → restart → health check. Run on the server as the swisschalets user from /opt/swisschalets/app.
set -euo pipefail
cd /opt/swisschalets/app
set -a; source /etc/swisschalets.env; set +a
git pull --ff-only
npm ci
npm run build
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/
npm run db:migrate
sudo systemctl restart swisschalets
for i in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:3000/health >/dev/null; then echo "✅ healthy"; exit 0; fi
  sleep 2
done
echo "❌ health check failed — see /var/swisschalets/logs/app.log"; exit 1

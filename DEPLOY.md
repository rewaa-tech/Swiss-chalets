# النشر على Hostinger VPS (Ubuntu 24.04)

## 1. السيرفر
```bash
sudo apt update && sudo apt upgrade -y
# Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
# PostgreSQL 17
sudo install -d /usr/share/postgresql-common/pgdg
sudo curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc
echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt noble-pgdg main" | sudo tee /etc/apt/sources.list.d/pgdg.list
sudo apt update && sudo apt install -y postgresql-17 postgresql-contrib-17 nginx certbot python3-certbot-nginx git
# v3: تحويل فيديوهات الألبوم (مجاني ومفتوح المصدر)
sudo apt install -y ffmpeg
# جدار الحماية
sudo ufw allow 22 && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
```

## 2. المستخدم والمجلدات
```bash
sudo adduser --system --group --home /opt/swisschalets swisschalets
sudo mkdir -p /var/swisschalets/{media,proofs,keys,backups,logs,tmp}
sudo chown -R swisschalets:swisschalets /var/swisschalets && sudo chmod 750 /var/swisschalets /var/swisschalets/{proofs,keys,backups}
```

## 3. قاعدة البيانات
```bash
sudo -u postgres psql -c "CREATE ROLE swisschalets LOGIN PASSWORD 'كلمة-مرور-قوية';"
sudo -u postgres psql -c "CREATE DATABASE swisschalets OWNER swisschalets;"
sudo -u postgres psql -d swisschalets -c "CREATE EXTENSION btree_gist;"
```

## 4. متغيرات البيئة — `/etc/swisschalets.env` (صلاحية 600، مالكه swisschalets)
```
DATABASE_URL=postgres://swisschalets:...@127.0.0.1:5432/swisschalets
DATA_DIR=/var/swisschalets
APP_URL=https://example.com
APP_SECRET=<openssl rand -hex 32>
TELEGRAM_BOT_TOKEN=<من @BotFather>
TELEGRAM_BOT_USERNAME=<اسم البوت بدون @>
TELEGRAM_WEBHOOK_SECRET=<openssl rand -hex 24>
```

## 5. الكود والتشغيل
```bash
sudo -u swisschalets git clone https://github.com/rewaa-tech/swiss-chalets /opt/swisschalets/app
cd /opt/swisschalets/app
sudo cp deploy/swisschalets.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable swisschalets
# اسمح للمستخدم بإعادة تشغيل الخدمة من deploy.sh:
echo "swisschalets ALL=NOPASSWD: /bin/systemctl restart swisschalets, /bin/systemctl stop swisschalets, /bin/systemctl start swisschalets" | sudo tee /etc/sudoers.d/swisschalets
sudo -u swisschalets bash deploy/deploy.sh          # build → migrate → restart → /health
sudo -u swisschalets bash -c 'set -a; source /etc/swisschalets.env; set +a; SEED_ADMIN_USERNAME=admin SEED_ADMIN_PASSWORD="..." npm run db:seed'
```

## 6. Nginx و HTTPS
```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/swisschalets   # غيّر example.com
sudo ln -s /etc/nginx/sites-available/swisschalets /etc/nginx/sites-enabled/ && sudo rm -f /etc/nginx/sites-enabled/default
sudo certbot --nginx -d example.com -d www.example.com
sudo nginx -t && sudo systemctl reload nginx
```
> التطبيق يستمع على `127.0.0.1:3000` فقط، ويعتمد على `X-Real-IP` الذي يضعه Nginx. لا تفتح المنفذ 3000.

## 7. Webhook تيليغرام
```bash
curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://example.com/telegram/webhook/$TELEGRAM_WEBHOOK_SECRET" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
```
بعدها كل مستخدم يضغط «ربط تيليغرام» من إعدادات الفرع (أو صفحة كلمة المرور للموظفين).

## 8. النسخ الاحتياطي
```bash
sudo -u swisschalets crontab -e
0 4 * * * /opt/swisschalets/app/deploy/backup.sh >> /var/swisschalets/logs/backup.log 2>&1
```
الاستعادة (مجرّبة): `sudo -u swisschalets deploy/restore.sh /var/swisschalets/backups/db-YYYY-MM-DD-HHMM.dump`

انسخ أيضًا `/var/swisschalets/media` و`/var/swisschalets/keys` دوريًا خارج السيرفر.

## 9. التحديثات
`sudo -u swisschalets bash /opt/swisschalets/app/deploy/deploy.sh` — يسحب الكود، يبني، ينفّذ الـ Migrations، يعيد التشغيل، ويفحص `/health`.

## 10. ملاحظات الإصدار 3
- **ffmpeg مطلوب** لفيديوهات الألبوم. بدونه رفع الصور يشتغل عادي، والفيديو بيرجع رسالة واضحة.
- رفع الوسائط بأجزاء 4MB، فإعداد Nginx الحالي `client_max_body_size 6m` كافي بدون تغيير.
- المجلد `/var/swisschalets/tmp/uploads` بيحفظ الأجزاء مؤقتًا، وبيتنظف تلقائيًا بعد انتهاء كل رفع.
- الخريطة بتستعمل Google Maps Embed بدون مفتاح، وهي مسموحة بالـ CSP (`frame-src https://www.google.com`).
- بعد التحديث: `npm run db:migrate` بيطبّق الـ Migrations من 002 لـ 005 (الوسائط، الصلاحيات، الموقع، النصوص).

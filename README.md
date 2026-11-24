# الأكواخ السويسرية — Swiss Chalets

موقع حجز أكواخ ومزارع بمسابح خاصة في سوريا (إدلب، حمص، ودمشق قريبًا). الزبون يحجز من الموقع، يدفع كامل المبلغ عبر شام كاش، ويرفع الإشعار (صورة أو PDF)، ومدير الفرع يثبّت الحجز من لوحته.

## التقنيات

| الطبقة | الاختيار |
| --- | --- |
| الإطار | **Next.js 16** (App Router, Server Actions, React 19) + TypeScript — مخرجات `standalone` |
| البيانات | **PostgreSQL 17** + `btree_gist`، استعلامات SQL مباشرة عبر `pg`، Migrations بـ SQL خام |
| منع الحجز المزدوج | قيد `EXCLUDE USING gist (unit_id WITH =, period WITH &&) WHERE (is_active)` على `booking_items` |
| الواجهة | Tailwind CSS 4 + CSS tokens + وحدات تفاعل `data-fx` (ES modules) |
| الخطوط | Alexandria · IBM Plex Sans Arabic · Cormorant Garamond — محلية عبر `@fontsource` (بدون CDN) |
| الصور | `sharp`: إعادة ترميز WebP بثلاثة مقاسات 480/960/1600 |
| PDF | `pdf-lib` للتحقق على السيرفر + `pdf.js` محلي (`/lib/pdfjs`) للمعاينة على `<canvas>` |
| الدخول | جلسات Cookie (HttpOnly) + bcrypt + `security_stamp` لإنهاء الجلسات فورًا |
| المهام الخلفية | `instrumentation.ts` + مؤقت كل دقيقة (انتهاء الحجز المؤقت، التنبيهات، الإكمال، تنظيف الإشعارات) |
| الإشعارات | Telegram Bot API (Webhook بترويسة سرية) |
| الاختبارات | Vitest على PostgreSQL حقيقية (40 اختبار) + Playwright (18 اختبار طرف لطرف ووصولية) |

> المواصفات الأصلية في `docs/build-prompt.md` كُتبت لـ ASP.NET. تم تنفيذها بـ Next.js مع الحفاظ على كل قواعد العمل والحماية والتصميم. جدول المقابلة في `AUDIT.md`.

## التشغيل محليًا

```bash
cp .env.example .env.local        # عدّل DATABASE_URL و DATA_DIR
npm install                       # ينسخ pdf.js إلى public/lib/pdfjs تلقائيًا
npm run db:migrate                # ينشئ الجداول والقيود والفروع الثلاثة
SEED_ADMIN_PASSWORD='...' npm run db:seed   # أول مدير عام (اسم المستخدم admin)
npm run dev                       # http://localhost:3000
```

## الأوامر

| الأمر | الوظيفة |
| --- | --- |
| `npm run build` / `npm start` | بناء الإنتاج وتشغيله (standalone على 127.0.0.1) |
| `npm test` | اختبارات المنطق على قاعدة `swisschalets_test` |
| `npm run test:e2e` | Playwright (يبني قاعدة `swisschalets_e2e` من الصفر) |
| `npm run typecheck` | فحص الأنواع |
| `npm run assets` | توليد صور الواجهة الافتراضية من `design/photos` |

## الهيكل

```
db/migrations/          SQL: الجداول، قيود الاستبعاد، الفهارس، القيم الافتراضية
src/lib/services/       availability · booking · abuse-guard · proof · review-deadline · theme · branch-ops · media · telegram · jobs
src/app/(site)/         الصفحات العامة: الرئيسية، الفرع، الوحدة، الحجز، طلباتي، الشروط
src/app/api/            calendar · slots · bookings · proof
src/app/branch/         لوحة الفرع (+ actions.ts)
src/app/admin/          لوحة المدير العام (+ actions.ts)
src/fx/                 تفاعلات data-fx (magnetic, tilt, spotlight, nav, reveal, parallax, count, ripple, copy)
src/components/         المكونات، SeasonFx، BookingWidget، QueueBoard…
deploy/                 systemd · nginx · deploy.sh · backup.sh · restore.sh
tests/unit, tests/e2e   الاختبارات
design/                 التصاميم المعتمدة والصور
```

## الجديد بالإصدار 3
- برومبت التعديلات: [`docs/fix-prompt-v3.md`](docs/fix-prompt-v3.md)، والتدقيق: [`AUDIT_V3.md`](AUDIT_V3.md).
- **الوسائط:** صورة غلاف مستقلة، وألبوم صور وفيديو. الفيديو بيحتاج `ffmpeg` على السيرفر.
- **نصوص الواجهة:** من «نصوص الواجهة» باللوحة، أو مباشرة على الموقع من زر «تعديل النصوص» اللي بيظهر لطاقم الفرع.
- **الصلاحيات:** معالج إضافة الحساب فيه قوالب جاهزة، وكل صلاحية بتنعطى أو بتنمنع لحالها.
- **الخريطة:** الصق رابط Google Maps بإعدادات الفرع.

## أول وحدة (بعد النشر)

1. ادخل `/login` بحساب المدير العام ← **المدراء والحسابات** ← أضف مدير فرع.
2. ادخل بحساب مدير الفرع ← **إعدادات الفرع**: حساب شام كاش ورمز QR وأوقات المراجعة.
3. **الوحدات** ← وحدة جديدة ← ارفع صورة الغلاف، وبعدين صور وفيديوهات الألبوم.
4. **المواسم والأنماط**: تواريخ المواسم ونمط الوحدة بكل موسم.
5. **الفترات والأسعار**: أضف الفترات.
6. **التقويم التشغيلي**: اسحب على الأيام واضغط «فتح المحدد». الوحدة تظهر للزبائن.

النشر: راجع [DEPLOY.md](DEPLOY.md).

# AUDIT — حالة البنود

**وضع العمل:** وضع البناء. المستودع كان يحتوي على المواصفات والتصاميم فقط (بدون كود). تقرّر استخدام **Next.js** بدل ASP.NET، فتم تنفيذ كل بند بما يقابله.

## مقابلة التقنيات (القسم 3)

| في المواصفات | في التنفيذ |
| --- | --- |
| ASP.NET Core MVC + Razor | Next.js 16 App Router (SSR) + Server Actions |
| EF Core + Npgsql | `pg` مع SQL مباشر، Migrations في `db/migrations` |
| ASP.NET Identity | جلسات Cookie + bcrypt + `security_stamp` (`src/lib/auth.ts`) |
| Data Protection | HMAC-SHA256 بمفتاح `APP_SECRET` أو ملف في `DATA_DIR/keys` |
| SkiaSharp | sharp |
| PdfPig | pdf-lib + فحص بايتات خام |
| BackgroundService | `instrumentation.ts` → `startJobs()` |
| Rate Limiting المدمج | `src/proxy.ts` + `src/lib/rate-limit.ts` |
| Alpine.js | React (مكونات عميل) + وحدات `data-fx` |
| xUnit | Vitest على PostgreSQL حقيقية |
| Microsoft.Playwright | @playwright/test |

## القسم 5 — قواعد العمل

| البند | الحالة | أين |
| --- | --- | --- |
| BR-01 أربعة مواسم بلا تداخل | ✅ | قيد `no_season_overlap` + `saveSeasons` · T-11 |
| BR-02/03 الأنماط، منع Pool بالربيع والخريف | ✅ | `setUnitMode`, `modeAllowed` |
| BR-04 الفترات (تعبر منتصف الليل) | ✅ | `time_slots`, `slotPeriod` |
| BR-05 السعر ثابت ≤ السعة | ✅ | `validateCustomer` |
| BR-06 منع التداخل حتى لليوم التالي | ✅ | قيد `no_overlap_per_unit` · T-01, T-03 |
| BR-07 نسخ السعر والصرف | ✅ | `bookings.total/exchange_rate`, `booking_items.price` |
| BR-08 ليالٍ متعددة بسعر كل موسم | ✅ | `planItems` · T-20 |
| BR-09..11 حالات اليوم والفترات | ✅ | `computeCalendar`, `daySlots` · T-02 |
| BR-12 الحالات الشاغلة | ✅ | `is_active` على العناصر |
| BR-13 منع التغيير الماس بحجز | ✅ | `branch-ops.ts` (`AffectedError` يعرض الحجوزات) · T-10 |
| BR-14..18 بيانات الزبون والدفع والعملة | ✅ | `booking.ts`, إعدادات العملة |
| BR-19 Held لمدة قابلة للتعديل + عدّاد | ✅ | `hold_minutes`, `PaymentStep` |
| BR-20/21 PendingReview، رقم عملية فريد | ✅ | `ux_proofs_txn` · T-06 |
| BR-22..24 نوافذ المراجعة (عبر منتصف الليل) | ✅ | `review-deadline.ts` · T-05, T-05b |
| BR-25/26 تثبيت/رفض/رفض وحظر + واتساب | ✅ | `reviewBooking` · E2E-03/04 |
| BR-27/28 لا إلغاء من الزبون | ✅ | لا يوجد مسار |
| BR-29 VoidNoDocuments | ✅ | `voidNoDocuments` |
| BR-30 Completed تلقائيًا | ✅ | `completeFinished` |
| BR-31 الرفع المتأخر | ✅ | `submitProof` · T-15, T-15b |
| BR-32 لا حد أدنى قبل البداية | ✅ | `daySlots` (المنتهية فقط تُستبعد) |
| BR-33 لا قيد ليلي إضافي | ✅ | |
| BR-34 الحجز اليدوي | ✅ | `createManual` · T-16, E2E-05 |
| BR-35 PDF كإشعار | ✅ | `proof.ts` · T-17, E2E-02 |
| BR-36 ثيمات المواسم | ✅ | `theme.ts`, `SeasonFx` · T-19, E2E-09 |

## القسم 6 — الحماية

| البند | الحالة |
| --- | --- |
| Honeypot / وقت التعبئة الموقّع / توحيد الهاتف / الحظر / حدود الرقم والـ IP والجهاز | ✅ `abuse-guard.ts` |
| `23P01` → SlotTaken، `23505` → تكرار | ✅ |
| بصمة الجهاز `sc_did` (128 بت، HttpOnly، سنتان) + SHA-256 مع Salt | ✅ `proxy.ts`, `abuse-guard.ts` |
| الـ IP كـ Hash فقط | ✅ |
| Rate limiting (20/دقيقة API، 5 دخول/دقيقة) | ✅ |
| فحص التوقيع الحقيقي، إعادة ترميز الصور، فحص PDF | ✅ T-17, T-18 |
| تخزين الإشعارات خارج الويب + عرض بترويسات آمنة | ✅ `/branch/proofs/[id]` |
| معاينة PDF بـ pdf.js على canvas (بدون iframe) | ✅ |
| CSP بـ nonce، Referrer-Policy، HSTS، nosniff | ✅ `proxy.ts`, `next.config.ts` |

## القسم 10–12

| البند | الحالة |
| --- | --- |
| زر واتساب حسب الصفحة ← الفرع ← الافتراضي | ✅ E2E-08 |
| نافذة آلية الحجز مرة بكل جلسة | ✅ |
| لوحة الفرع (11.1) كل الصفحات | ✅ E2E-03..07, 11 |
| لوحة المدير العام (11.2) كل الصفحات + CSV بـ BOM | ✅ E2E-08..11 |
| المهام الخلفية (Hold, Alerts, Completion, Cleanup) | ✅ `jobs.ts` |
| النسخ الاحتياطي اليومي + الاستعادة | ✅ `deploy/backup.sh`, `restore.sh` (مجرّب) |
| SEO: عناوين، OG، sitemap، robots | ✅ |

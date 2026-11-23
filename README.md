# الأكواخ السويسرية — Swiss Chalets

موقع لحجز الأكواخ والمزارع السياحية بمسابح خاصة في سوريا. الفروع: إدلب، وحمص، ودمشق قريبًا.

الزبون بيحجز من الموقع، وبيدفع كامل المبلغ عبر شام كاش، وبيرفع الإشعار (صورة أو PDF). بعدها مدير الفرع بيثبّت الحجز يدويًا.

## الملفات

| الملف | المحتوى |
| --- | --- |
| [docs/build-prompt.md](docs/build-prompt.md) | **البرومبت التنفيذي (الإصدار 2):** المرجع الأساسي للبناء والترقية |
| [docs/analysis-requirements.md](docs/analysis-requirements.md) | وثيقة التحليل: الأدوار، وقواعد العمل، وUML، وERD، والواجهات |
| [design/](design/) | التصاميم المعتمدة وصور الأكواخ |

## التقنيات

ASP.NET Core 10 (LTS) MVC · EF Core 10 · PostgreSQL 17 · Tailwind CSS · Alpine.js · pdf.js · Playwright · Hostinger VPS (Ubuntu 24.04 + Nginx)

## الاستخدام

افتح المستودع بـ Claude Code وأرسله محتوى `docs/build-prompt.md`. Claude رح يحدد لحاله إذا لازم يرقّي مشروع موجود أو يبني من الصفر (القسم 0 بالبرومبت).

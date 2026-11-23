import { PageHead } from "@/components/admin/AdminShell";
import ActionForm, { FormError, Submit } from "@/components/admin/ActionForm";
import TemplateField from "@/components/admin/TemplateField";
import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { templatesAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  await requireUser("admin");
  const [s, tpl] = await Promise.all([getSettings(), q("SELECT key, body FROM message_templates")]);
  const t = Object.fromEntries(tpl.map((r) => [r.key, r.body]));
  const sample = { "الاسم": "أحمد", "الوحدة": "كوخ الصنوبر", "الفرع": "حمص", "التاريخ": "الجمعة 12 حزيران", "البداية": "10:00", "النهاية": "16:00", "رابط الخريطة": "https://maps.app.goo.gl/…", "الثبوتيات": s.documents_text ?? "", "السبب": "المبلغ غير مطابق" };
  const msgVars = ["الاسم", "الوحدة", "الفرع", "التاريخ", "البداية", "النهاية", "رابط الخريطة", "الثبوتيات"];
  return (
    <>
      <PageHead title="النصوص والقوالب" sub="اضغط على المتغير لإدراجه مكان المؤشر" />
      <ActionForm action={templatesAction} className="flex flex-col gap-5">
        <div className="admin-card flex flex-col gap-5">
          <TemplateField name="booking_mechanism_text" label="نافذة آلية الحجز" initial={s.booking_mechanism_text ?? ""} vars={["الفرع", "البداية", "النهاية"]} sample={{ ...sample, "البداية": "09:00", "النهاية": "23:00" }} rows={5} />
          <TemplateField name="documents_text" label="الثبوتيات المطلوبة" initial={s.documents_text ?? ""} vars={[]} sample={sample} rows={3} />
          <TemplateField name="terms_text" label="شروط الحجز (سطر لكل بند)" initial={s.terms_text ?? ""} vars={[]} sample={sample} rows={6} />
        </div>
        <div className="admin-card flex flex-col gap-5">
          <h2 style={{ fontSize: 17 }}>قوالب واتساب</h2>
          <TemplateField name="tpl_confirm" label="رسالة التثبيت" initial={t.confirm ?? ""} vars={msgVars} sample={sample} rows={8} />
          <TemplateField name="tpl_reject" label="رسالة الرفض" initial={t.reject ?? ""} vars={["الاسم", "الوحدة", "التاريخ", "السبب"]} sample={sample} rows={6} />
        </div>
        <FormError />
        <div className="sticky bottom-[84px] lg:bottom-4 z-20"><Submit className="btn btn-cta">حفظ النصوص</Submit></div>
      </ActionForm>
    </>
  );
}

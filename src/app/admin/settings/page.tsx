import { PageHead } from "@/components/admin/AdminShell";
import ActionForm, { FieldError, FormError, Submit } from "@/components/admin/ActionForm";
import ThemePicker from "@/components/admin/ThemePicker";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { themeConfig } from "@/lib/services/theme";
import { generalTheme } from "@/lib/services/public";
import { telegramConfigured } from "@/lib/services/telegram";
import { settingsAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireUser("admin");
  const [s, current] = await Promise.all([getSettings(), generalTheme()]);
  const cfg = themeConfig(s);
  const lim: [string, string, string][] = [
    ["hold_minutes", "مدة الحجز المؤقت (دقيقة)", "30"], ["max_active_per_phone", "طلبات نشطة لنفس الرقم", "2"], ["max_daily_per_ip", "طلبات يومية لنفس الـ IP", "2"],
    ["max_daily_per_device", "طلبات يومية لنفس الجهاز", "2"], ["min_fill_seconds", "أقل وقت لتعبئة النموذج (ثانية)", "5"],
  ];
  return (
    <>
      <PageHead title="الإعدادات العامة" />
      <ActionForm action={settingsAction} className="flex flex-col gap-5">
        <div className="admin-card flex flex-col gap-4">
          <h2 style={{ fontSize: 17 }}>العملة وسعر الصرف</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="field"><span className="label">العملة الأساسية</span><input name="currency" className="input" dir="ltr" defaultValue={s.currency ?? "USD"} maxLength={3} /><FieldError name="currency" /></label>
            <label className="field"><span className="label">سعر الصرف (ليرة لكل دولار)</span><input name="exchange_rate" type="number" step="0.01" min={0} className="input" defaultValue={s.exchange_rate ?? "0"} /><FieldError name="exchange_rate" /></label>
            <label className="flex items-center gap-2.5 self-end" style={{ minHeight: 50, fontWeight: 600 }}><input type="checkbox" name="show_syp" defaultChecked={s.show_syp === "true"} style={{ width: 20, height: 20 }} />اعرض المبلغ بالليرة أيضًا</label>
          </div>
        </div>
        <div className="admin-card flex flex-col gap-4">
          <h2 style={{ fontSize: 17 }}>الحدود والحماية</h2>
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
            {lim.map(([k, l, d]) => <label key={k} className="field"><span className="label" style={{ fontSize: 13 }}>{l}</span><input name={k} type="number" className="input" defaultValue={s[k] ?? d} /><FieldError name={k} /></label>)}
          </div>
        </div>
        <div className="admin-card flex flex-col gap-4">
          <h2 style={{ fontSize: 17 }}>ثيم المواسم</h2>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>في الوضع التلقائي: صفحات الفرع والوحدة والحجز تأخذ ثيم موسم الفرع الحالي، والرئيسية تأخذه من الأشهر المحددة. لوحات الإدارة لا تتأثر.</p>
          <ThemePicker mode={cfg.mode} winter={cfg.winterMonths} summer={cfg.summerMonths} current={current} />
          <FieldError name="theme_months" /><FieldError name="theme_mode" />
        </div>
        <div className="admin-card flex flex-col gap-2">
          <h2 style={{ fontSize: 17 }}>تيليغرام</h2>
          <span className={`badge self-start ${telegramConfigured() ? "b-Confirmed" : "b-Expired"}`}>{telegramConfigured() ? "البوت مُعدّ" : "البوت غير مُعدّ"}</span>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>يُضبط التوكن على السيرفر عبر المتغير <code dir="ltr">TELEGRAM_BOT_TOKEN</code> ولا يظهر هنا.</p>
        </div>
        <FormError />
        <div className="sticky bottom-[84px] lg:bottom-4 z-20"><Submit className="btn btn-cta">حفظ الإعدادات</Submit></div>
      </ActionForm>
    </>
  );
}

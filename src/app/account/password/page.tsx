import { redirect } from "next/navigation";
import Logo from "@/components/Logo";
import ActionForm, { FieldError, FormError, Submit } from "@/components/admin/ActionForm";
import { currentUser } from "@/lib/auth";
import { changePassword } from "./actions";
import TelegramLink from "@/components/admin/TelegramLink";
import { telegramLinkAction } from "@/app/branch/actions";
import { telegramConfigured } from "@/lib/services/telegram";
import { one } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PasswordPage() {
  const u = await currentUser();
  if (!u) redirect("/login");
  const tg = u.branchId && !u.mustChangePassword ? await one("SELECT telegram_chat_id FROM app_users WHERE id = $1", [u.id]) : null;
  return (
    <main id="main" className="min-h-screen flex flex-col gap-4 items-center justify-center" style={{ background: "var(--bg-admin)", padding: 24 }}>
      <ActionForm action={changePassword} className="admin-card flex flex-col gap-4" style={{ width: "min(440px, 100%)", padding: 30, borderRadius: 28 }}>
        <Logo />
        <div><h1 style={{ fontSize: 22 }}>{u.mustChangePassword ? "اختر كلمة مرور جديدة" : "تغيير كلمة المرور"}</h1>
          {u.mustChangePassword && <p className="muted" style={{ margin: "4px 0 0", fontSize: 14 }}>هذا أول دخول لك. غيّر كلمة المرور المؤقتة للمتابعة.</p>}</div>
        <div className="field"><label className="label" htmlFor="current">كلمة المرور الحالية</label><input id="current" name="current" type="password" className="input" autoComplete="current-password" dir="ltr" /><FieldError name="current" /></div>
        <div className="field"><label className="label" htmlFor="next">كلمة المرور الجديدة</label><input id="next" name="next" type="password" className="input" autoComplete="new-password" dir="ltr" /><FieldError name="next" /><span className="hint">10 أحرف على الأقل، حروف وأرقام</span></div>
        <div className="field"><label className="label" htmlFor="again">تأكيد كلمة المرور</label><input id="again" name="again" type="password" className="input" autoComplete="new-password" dir="ltr" /><FieldError name="again" /></div>
        <FormError />
        <Submit className="btn btn-cta btn-block">حفظ</Submit>
      </ActionForm>
      {tg && (
        <div className="admin-card flex flex-col gap-3" style={{ width: "min(440px, 100%)", padding: 24, borderRadius: 24 }}>
          <h2 style={{ fontSize: 17 }}>إشعارات تيليغرام</h2>
          <TelegramLink action={telegramLinkAction} linked={!!tg.telegram_chat_id} configured={telegramConfigured()} />
        </div>
      )}
      {!u.mustChangePassword && <a href={u.role === "SuperAdmin" ? "/admin" : "/branch"} className="btn btn-outline btn-sm">العودة للوحة</a>}
    </main>
  );
}

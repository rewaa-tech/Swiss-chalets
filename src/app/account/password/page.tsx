import { redirect } from "next/navigation";
import Logo from "@/components/Logo";
import ActionForm, { FieldError, FormError, Submit } from "@/components/admin/ActionForm";
import { currentUser } from "@/lib/auth";
import { changePassword } from "./actions";

export const dynamic = "force-dynamic";

export default async function PasswordPage() {
  const u = await currentUser();
  if (!u) redirect("/login");
  return (
    <main id="main" className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-admin)", padding: 24 }}>
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
    </main>
  );
}

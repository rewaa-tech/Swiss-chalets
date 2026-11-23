import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Logo from "@/components/Logo";
import HeroImage from "@/components/HeroImage";
import ActionForm, { FormError, Submit } from "@/components/admin/ActionForm";
import { currentUser } from "@/lib/auth";
import { login } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "دخول اللوحة", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const u = await currentUser();
  if (u && !u.mustChangePassword) redirect(u.role === "SuperAdmin" ? "/admin" : "/branch");
  const { next } = await searchParams;
  return (
    <main id="main" className="min-h-screen grid lg:grid-cols-2" style={{ background: "var(--bg-admin)" }}>
      <div className="relative hidden lg:block overflow-hidden">
        <HeroImage base="/img/hero/chalet-pool-night" alt="" className="absolute inset-0 w-full h-full object-cover" priority fx={false} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(14,31,23,.2), rgba(14,31,23,.85))" }} />
        <div className="absolute text-white" style={{ bottom: 48, right: 48, left: 48 }}>
          <h2 style={{ color: "#fff", fontSize: 34 }}>لوحة إدارة الأكواخ السويسرية</h2>
          <p style={{ color: "#E4DDD1", margin: "8px 0 0" }}>المراجعة والتثبيت والتقويم والأسعار، من مكان واحد.</p>
        </div>
      </div>
      <div className="flex items-center justify-center" style={{ padding: 24 }}>
        <ActionForm action={login} className="admin-card flex flex-col gap-5" style={{ width: "min(420px, 100%)", padding: 32, borderRadius: 28 }}>
          <Logo />
          <div><h1 style={{ fontSize: 24 }}>تسجيل الدخول</h1><p className="muted" style={{ margin: "4px 0 0", fontSize: 14 }}>للمدراء والموظفين فقط</p></div>
          <input type="hidden" name="next" value={next ?? ""} />
          <div className="field"><label className="label" htmlFor="username">اسم المستخدم</label><input id="username" name="username" className="input" autoComplete="username" required dir="ltr" /></div>
          <div className="field"><label className="label" htmlFor="password">كلمة المرور</label><input id="password" name="password" type="password" className="input" autoComplete="current-password" required dir="ltr" /></div>
          <FormError />
          <Submit className="btn btn-cta btn-block" pendingText="جاري الدخول…">دخول</Submit>
        </ActionForm>
      </div>
    </main>
  );
}

import { PageHead, Empty } from "@/components/admin/AdminShell";
import ActionForm, { FieldError, FormError, Submit } from "@/components/admin/ActionForm";
import ConfirmButton from "@/components/admin/ConfirmButton";
import ResetPassword from "@/components/admin/ResetPassword";
import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { fmtDateTimeAr } from "@/lib/time";
import { managerAction, userActiveAction, resetPasswordAction } from "../actions";

export const dynamic = "force-dynamic";
const ROLE = { SuperAdmin: "مدير عام", BranchManager: "مدير فرع", Staff: "موظف" } as const;

export default async function UsersPage() {
  const me = await requireUser("admin");
  const [users, branches] = await Promise.all([
    q("SELECT a.*, b.name AS branch_name FROM app_users a LEFT JOIN branches b ON b.id = a.branch_id ORDER BY a.role, b.sort_order NULLS FIRST, a.id"),
    q("SELECT id, name FROM branches ORDER BY sort_order, id"),
  ]);
  return (
    <>
      <PageHead title="المدراء والحسابات" sub="مدير الفرع يضيف موظفيه بنفسه من لوحة الفرع" />
      <div className="admin-card" style={{ marginBottom: 16 }}>
        {!users.length ? <Empty title="لا توجد حسابات" /> : (
          <div style={{ overflowX: "auto" }}><table className="table">
            <thead><tr><th>الاسم</th><th>اسم المستخدم</th><th>الدور</th><th>الفرع</th><th>آخر دخول</th><th>الحالة</th><th /></tr></thead>
            <tbody>{users.map((u) => (
              <tr key={u.id}>
                <td style={{ fontWeight: 600 }}>{u.display_name}</td><td dir="ltr" style={{ textAlign: "right" }}>{u.username}</td>
                <td>{ROLE[u.role as keyof typeof ROLE]}</td><td>{u.branch_name ?? "—"}</td>
                <td className="muted num" style={{ fontSize: 12 }}>{fmtDateTimeAr(u.last_login_at)}</td>
                <td><span className={`badge ${u.is_active ? "b-Confirmed" : "b-Expired"}`}>{u.is_active ? "فعّال" : "معطل"}</span></td>
                <td>{u.id !== me.id && (
                  <div className="flex gap-2">
                    <ResetPassword id={u.id} action={resetPasswordAction} />
                    <ActionForm action={userActiveAction}><input type="hidden" name="id" value={u.id} />
                      {u.is_active ? <ConfirmButton className="btn btn-sm btn-outline" name="active" value="0" title="تعطيل الحساب" message="سيُمنع من الدخول وتنتهي جلساته فورًا." confirmLabel="تعطيل" danger>تعطيل</ConfirmButton>
                        : <button className="btn btn-sm btn-success" name="active" value="1">تفعيل</button>}
                    </ActionForm>
                  </div>)}</td>
              </tr>))}</tbody>
          </table></div>
        )}
      </div>
      <ActionForm action={managerAction} className="admin-card flex flex-col gap-4" reset>
        <h2 style={{ fontSize: 17 }}>إضافة مدير فرع</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <label className="field"><span className="label">الاسم</span><input name="display_name" className="input" /><FieldError name="display_name" /></label>
          <label className="field"><span className="label">اسم المستخدم</span><input name="username" className="input" dir="ltr" autoComplete="off" /><FieldError name="username" /></label>
          <label className="field"><span className="label">كلمة مرور مؤقتة</span><input name="password" className="input" dir="ltr" autoComplete="new-password" /><FieldError name="password" /></label>
          <label className="field"><span className="label">الفرع</span><select name="branch_id" className="select">{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select><FieldError name="branch_id" /></label>
        </div>
        <FormError />
        <div><Submit className="btn btn-cta">إضافة المدير</Submit></div>
      </ActionForm>
    </>
  );
}

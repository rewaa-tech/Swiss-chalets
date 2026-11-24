import { PageHead, Empty } from "@/components/admin/AdminShell";
import ActionForm, { FieldError, FormError, Submit } from "@/components/admin/ActionForm";
import ConfirmButton from "@/components/admin/ConfirmButton";
import { requireUser, requirePerm } from "@/lib/auth";
import { q } from "@/lib/db";
import { GRANTABLE, PERMISSIONS } from "@/lib/permissions";
import { fmtDateTimeAr } from "@/lib/time";
import { staffAction, staffActiveAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const u = await requireUser("branch");
  requirePerm(u, "staff.manage");
  const staff = await q(`SELECT a.*, COALESCE(array_agg(p.permission) FILTER (WHERE p.permission IS NOT NULL), '{}') AS perms
    FROM app_users a LEFT JOIN user_permissions p ON p.user_id = a.id WHERE a.branch_id = $1 AND a.role = 'Staff' GROUP BY a.id ORDER BY a.is_active DESC, a.id`, [u.branchId]);
  const grantable = GRANTABLE.filter((p) => u.permissions.has(p));
  const Perms = ({ has }: { has: string[] }) => (
    <div className="flex flex-wrap gap-2">{grantable.map((p) => (
      <label key={p} className="chip" style={{ background: "var(--line-soft)", color: "var(--forest)", cursor: "pointer", minHeight: 40 }}>
        <input type="checkbox" name="perms" value={p} defaultChecked={has.includes(p)} />{PERMISSIONS[p]}
      </label>))}</div>
  );
  return (
    <>
      <PageHead title="الموظفون" sub="امنح كل موظف ما يحتاجه فقط من صلاحياتك" />
      <div className="flex flex-col gap-4">
        {!staff.length && <div className="admin-card"><Empty icon="users" title="لا يوجد موظفون بعد" text="أضف موظفًا بكلمة مرور مؤقتة، وسيُطلب منه تغييرها بأول دخول." /></div>}
        {staff.map((s) => (
          <div key={s.id} className="admin-card flex flex-col gap-3" style={{ opacity: s.is_active ? 1 : 0.65 }}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div><strong style={{ fontFamily: "var(--f-head)" }}>{s.display_name}</strong> <span className="muted" dir="ltr">@{s.username}</span>{!s.is_active && <span className="badge b-Expired" style={{ marginInlineStart: 8 }}>معطل</span>}{s.must_change_password && <span className="badge b-Held" style={{ marginInlineStart: 8 }}>لم يغيّر كلمة المرور</span>}</div>
              <span className="muted" style={{ fontSize: 12 }}>آخر دخول: {fmtDateTimeAr(s.last_login_at)}</span>
            </div>
            <ActionForm action={staffAction} className="flex flex-col gap-3">
              <input type="hidden" name="id" value={s.id} />
              <Perms has={s.perms} />
              <div className="flex gap-2"><Submit className="btn btn-sm btn-dark">حفظ الصلاحيات</Submit></div>
            </ActionForm>
            <ActionForm action={staffActiveAction}>
              <input type="hidden" name="id" value={s.id} />
              {s.is_active ? <ConfirmButton className="btn btn-sm btn-outline" name="active" value="0" title="تعطيل الحساب" message="سيُمنع الموظف من الدخول وتُنهى جلساته فورًا." confirmLabel="تعطيل" danger>تعطيل الحساب</ConfirmButton>
                : <button className="btn btn-sm btn-success" name="active" value="1">تفعيل الحساب</button>}
            </ActionForm>
          </div>
        ))}
        <ActionForm action={staffAction} className="admin-card flex flex-col gap-4" reset>
          <h2 style={{ fontSize: 17 }}>إضافة موظف</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="field"><label className="label" htmlFor="st-d">الاسم</label><input id="st-d" name="display_name" className="input" /><FieldError name="display_name" /></div>
            <div className="field"><label className="label" htmlFor="st-u">اسم المستخدم</label><input id="st-u" name="username" className="input" dir="ltr" autoComplete="off" /><FieldError name="username" /></div>
            <div className="field"><label className="label" htmlFor="st-p">كلمة مرور مؤقتة</label><input id="st-p" name="password" className="input" dir="ltr" autoComplete="new-password" /><FieldError name="password" /></div>
          </div>
          <Perms has={["bookings.view"]} />
          <FormError />
          <div><Submit className="btn btn-cta">إضافة الموظف</Submit></div>
        </ActionForm>
      </div>
    </>
  );
}

import { PageHead, Empty } from "@/components/admin/AdminShell";
import ActionForm, { FormError, Submit } from "@/components/admin/ActionForm";
import ConfirmButton from "@/components/admin/ConfirmButton";
import AccountWizard from "@/components/admin/AccountWizard";
import PermissionPicker from "@/components/admin/PermissionPicker";
import { requireUser, requirePerm } from "@/lib/auth";
import { q } from "@/lib/db";
import { ALL_PERMISSIONS, PERMISSIONS } from "@/lib/permissions";
import { fmtDateTimeAr } from "@/lib/time";
import { staffAction, staffPermsAction, staffActiveAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const u = await requireUser("branch");
  requirePerm(u, "staff.view");
  const staff = await q(`SELECT a.*, COALESCE(array_agg(p.permission) FILTER (WHERE p.permission IS NOT NULL), '{}') AS perms
    FROM app_users a LEFT JOIN user_permissions p ON p.user_id = a.id WHERE a.branch_id = $1 AND a.role = 'Staff' GROUP BY a.id ORDER BY a.is_active DESC, a.id`, [u.branchId]);
  const mine = ALL_PERMISSIONS.filter((p) => u.permissions.has(p));
  const canEdit = u.permissions.has("staff.edit_permissions"), canDisable = u.permissions.has("staff.disable");
  return (
    <>
      <PageHead title="الموظفون" sub="امنح كل موظف ما يحتاجه فقط، وكل صلاحية تشتغل أو تتوقف لحالها" />
      <div className="flex flex-col gap-4">
        {u.permissions.has("staff.create") && <AccountWizard action={staffAction} available={mine} kind="staff" />}
        {!staff.length && <div className="admin-card"><Empty icon="users" title="لا يوجد موظفون بعد" text="أضف موظفًا بكلمة مرور مؤقتة، وسيُطلب منه تغييرها بأول دخول." /></div>}
        {staff.map((s) => (
          <div key={s.id} className="admin-card flex flex-col gap-3" style={{ opacity: s.is_active ? 1 : 0.65 }} data-staff={s.username}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="avatar" aria-hidden style={{ width: 44, height: 44 }}>{String(s.display_name).trim().charAt(0)}</span>
                <div className="flex flex-col">
                  <span><strong style={{ fontFamily: "var(--f-head)" }}>{s.display_name}</strong> <span className="muted" dir="ltr">@{s.username}</span></span>
                  <span className="muted" style={{ fontSize: 12 }}>{s.perms.length} صلاحية · آخر دخول: {fmtDateTimeAr(s.last_login_at)}</span>
                </div>
                {!s.is_active && <span className="badge b-Expired">معطل</span>}
                {s.must_change_password && <span className="badge b-Held">لم يغيّر كلمة المرور</span>}
              </div>
              {canDisable && (
                <ActionForm action={staffActiveAction}>
                  <input type="hidden" name="id" value={s.id} />
                  {s.is_active ? <ConfirmButton className="btn btn-sm btn-outline" name="active" value="0" title="تعطيل الحساب" message="سيُمنع الموظف من الدخول وتُنهى جلساته فورًا." confirmLabel="تعطيل" danger>تعطيل الحساب</ConfirmButton>
                    : <button className="btn btn-sm btn-success" name="active" value="1">تفعيل الحساب</button>}
                </ActionForm>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(s.perms as string[]).filter((p) => p in PERMISSIONS).map((p) => <span key={p} className="chip" style={{ background: "var(--line-soft)", color: "var(--forest)", fontSize: 12, minHeight: 28 }}>{PERMISSIONS[p as keyof typeof PERMISSIONS].label}</span>)}
            </div>
            {canEdit && (
              <details className="perm-edit">
                <summary className="btn btn-sm btn-outline">تعديل الصلاحيات</summary>
                <ActionForm action={staffPermsAction} className="flex flex-col gap-3" style={{ marginTop: 12 }}>
                  <input type="hidden" name="id" value={s.id} />
                  <PermissionPicker available={mine} initial={s.perms} compact />
                  <FormError />
                  <div><Submit className="btn btn-dark">حفظ الصلاحيات</Submit></div>
                </ActionForm>
              </details>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

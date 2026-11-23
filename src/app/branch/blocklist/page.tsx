import Link from "next/link";
import { PageHead, Empty } from "@/components/admin/AdminShell";
import ActionForm from "@/components/admin/ActionForm";
import ConfirmButton from "@/components/admin/ConfirmButton";
import { requireUser, requirePerm } from "@/lib/auth";
import { q } from "@/lib/db";
import { fmtDateTimeAr } from "@/lib/time";
import { liftBlockAction } from "../actions";

export const dynamic = "force-dynamic";
const KIND: Record<string, string> = { Phone: "رقم هاتف", Ip: "عنوان IP", Device: "جهاز" };

export default async function BlocklistPage() {
  const u = await requireUser("branch");
  requirePerm(u, "blocklist.manage");
  const rows = await q(`SELECT bi.*, a.display_name FROM blocked_identities bi LEFT JOIN app_users a ON a.id = bi.blocked_by WHERE bi.branch_id = $1 AND bi.is_active ORDER BY bi.created_at DESC`, [u.branchId]);
  return (
    <>
      <PageHead title="الحظر" sub="المحظور يرى رسالة عامة ولا يستطيع الحجز" />
      <div className="admin-card">
        {!rows.length ? <Empty icon="shield" title="لا يوجد محظورون" text="يُضاف الحظر من زر «رفض وحظر» في صفحة المراجعة." /> : (
          <div style={{ overflowX: "auto" }}><table className="table">
            <thead><tr><th>النوع</th><th>القيمة</th><th>السبب</th><th>بواسطة</th><th>التاريخ</th><th>الطلب</th><th /></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id}>
                <td>{KIND[r.kind]}</td>
                <td className="num" dir="ltr" style={{ textAlign: "right" }}>{r.kind === "Phone" ? r.value : r.label ?? "مشفّر"}</td>
                <td>{r.reason}</td><td>{r.display_name ?? "—"}</td><td className="muted num" style={{ fontSize: 12 }}>{fmtDateTimeAr(r.created_at)}</td>
                <td>{r.booking_id ? <Link href={`/branch/bookings/${r.booking_id}`} style={{ textDecoration: "underline" }}>#{r.booking_id}</Link> : "—"}</td>
                <td><ActionForm action={liftBlockAction}><input type="hidden" name="id" value={r.id} /><ConfirmButton className="btn btn-sm btn-outline" title="رفع الحظر" message="سيتمكن صاحب هذا المعرّف من الحجز مجددًا." confirmLabel="رفع الحظر">رفع الحظر</ConfirmButton></ActionForm></td>
              </tr>))}</tbody>
          </table></div>
        )}
      </div>
    </>
  );
}

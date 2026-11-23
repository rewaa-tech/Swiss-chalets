import { PageHead, Empty } from "@/components/admin/AdminShell";
import { Pager } from "@/components/admin/BookingsTable";
import { requireUser } from "@/lib/auth";
import { q, one } from "@/lib/db";
import { fmtDateTimeAr, isValidDate, localToUtc, addDays } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser("admin");
  const sp = await searchParams;
  const where: string[] = [], args: unknown[] = [];
  if (Number(sp.user)) { args.push(Number(sp.user)); where.push(`a.user_id = $${args.length}`); }
  if (sp.action) { args.push(sp.action); where.push(`a.action = $${args.length}`); }
  if (isValidDate(sp.from ?? "")) { args.push(localToUtc(sp.from!)); where.push(`a.created_at >= $${args.length}`); }
  if (isValidDate(sp.to ?? "")) { args.push(localToUtc(addDays(sp.to!, 1))); where.push(`a.created_at < $${args.length}`); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const [rows, total, users, actions] = await Promise.all([
    q(`SELECT a.*, u.display_name, b.name AS branch_name FROM audit_logs a LEFT JOIN app_users u ON u.id = a.user_id LEFT JOIN branches b ON b.id = a.branch_id ${w} ORDER BY a.created_at DESC LIMIT 50 OFFSET ${(page - 1) * 50}`, args),
    one<{ n: number }>(`SELECT count(*)::int n FROM audit_logs a ${w}`, args),
    q("SELECT id, display_name FROM app_users ORDER BY display_name"),
    q("SELECT DISTINCT action FROM audit_logs ORDER BY action"),
  ]);
  const qs = (o: Record<string, string | number | undefined>) => "?" + new URLSearchParams(Object.entries({ ...sp, ...o }).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])).toString();
  return (
    <>
      <PageHead title="سجل العمليات" sub={`${total?.n ?? 0} عملية`} />
      <div className="admin-card">
        <form method="get" className="flex flex-wrap gap-2 items-end" style={{ marginBottom: 14 }}>
          <label className="field" style={{ flex: "1 1 180px" }}><span className="label">المستخدم</span><select name="user" defaultValue={sp.user} className="select"><option value="">الكل</option>{users.map((u) => <option key={u.id} value={u.id}>{u.display_name}</option>)}</select></label>
          <label className="field" style={{ flex: "1 1 180px" }}><span className="label">الفعل</span><select name="action" defaultValue={sp.action} className="select"><option value="">الكل</option>{actions.map((a) => <option key={a.action} value={a.action}>{a.action}</option>)}</select></label>
          <label className="field" style={{ flex: "0 1 160px" }}><span className="label">من</span><input type="date" name="from" defaultValue={sp.from} className="input" /></label>
          <label className="field" style={{ flex: "0 1 160px" }}><span className="label">إلى</span><input type="date" name="to" defaultValue={sp.to} className="input" /></label>
          <button className="btn btn-dark" style={{ minHeight: 50 }}>تطبيق</button>
        </form>
        {!rows.length ? <Empty icon="log" title="لا توجد عمليات" /> : (
          <div style={{ overflowX: "auto" }}><table className="table">
            <thead><tr><th>الوقت</th><th>المستخدم</th><th>الفرع</th><th>الفعل</th><th>الكيان</th><th>تفاصيل</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id}><td className="muted num" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{fmtDateTimeAr(r.created_at)}</td><td>{r.display_name ?? "النظام"}</td><td>{r.branch_name ?? "—"}</td>
                <td><span className="badge" style={{ background: "var(--line-soft)" }}>{r.action}</span>{r.is_manual && <span className="badge" style={{ marginInlineStart: 6, background: "#E9E2F5", color: "#4B2E83" }}>يدوي</span>}</td>
                <td className="num">{r.entity}{r.entity_id ? ` #${r.entity_id}` : ""}</td>
                <td className="muted" style={{ fontSize: 12, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} dir="ltr">{r.details ? JSON.stringify(r.details) : ""}</td></tr>))}</tbody>
          </table></div>
        )}
        <Pager page={page} pages={Math.max(1, Math.ceil((total?.n ?? 0) / 50))} href={(p) => qs({ page: p })} />
      </div>
    </>
  );
}

import Link from "next/link";
import { STATUS_AR, type BookingStatus } from "@/lib/services/booking";
import { fmtDayAr, fmtTime, fmtDateTimeAr } from "@/lib/time";
import { money } from "@/lib/services/public";
import { Empty } from "./AdminShell";

export default function BookingsTable({ rows, base, showBranch = false }: { rows: any[]; base: string; showBranch?: boolean }) {
  if (!rows.length) return <Empty icon="search" title="لا توجد حجوزات مطابقة" text="غيّر التصفية أو البحث." />;
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="table">
        <thead><tr><th>#</th><th>الزبون</th>{showBranch && <th>الفرع</th>}<th>الوحدة</th><th>الموعد</th><th>المبلغ</th><th>الحالة</th><th>الإشعار</th><th>أُنشئ</th></tr></thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id} className="row-link">
              <td className="num"><Link href={`${base}/${b.id}`} style={{ fontWeight: 700, textDecoration: "underline" }}>{b.id}</Link></td>
              <td><div style={{ fontWeight: 600 }}>{b.customer_name}</div><div className="muted num" dir="ltr" style={{ fontSize: 12, textAlign: "right" }}>{b.phone_e164}</div></td>
              {showBranch && <td>{b.branch_name}</td>}
              <td>{b.unit_name}{b.source === "Manual" && <span className="badge" style={{ marginInlineStart: 6, background: "#E9E2F5", color: "#4B2E83" }}>يدوي</span>}</td>
              <td className="num" style={{ whiteSpace: "nowrap" }}>{b.first_day ? fmtDayAr(b.first_day) : "—"}<div className="muted" dir="ltr" style={{ fontSize: 12, textAlign: "right" }}>{b.starts_at ? `${fmtTime(b.starts_at)}–${fmtTime(b.ends_at)}` : ""}</div></td>
              <td className="num" style={{ fontWeight: 700 }}>{money(b.total, b.currency)}</td>
              <td><span className={`badge b-${b.status}`}>{STATUS_AR[b.status as BookingStatus]}</span></td>
              <td>{b.proof_kind ? <span className={`badge ${b.proof_kind === "Pdf" ? "b-pdf" : "b-img"}`}>{b.proof_kind === "Pdf" ? "PDF" : "صورة"}</span> : <span className="muted">—</span>}</td>
              <td className="muted num" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{fmtDateTimeAr(b.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pager({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav className="flex items-center justify-center gap-2" style={{ marginTop: 16 }} aria-label="الصفحات">
      {page > 1 && <Link className="btn btn-sm btn-outline" href={href(page - 1)}>السابق</Link>}
      <span className="muted num">صفحة {page} من {pages}</span>
      {page < pages && <Link className="btn btn-sm btn-outline" href={href(page + 1)}>التالي</Link>}
    </nav>
  );
}

export const STATUS_TABS: [string, string][] = [["all", "الكل"], ["PendingReview", "بانتظار التأكيد"], ["Confirmed", "مثبّتة"], ["Held", "مؤقتة"], ["Completed", "مكتملة"], ["Rejected", "مرفوضة"], ["Expired", "منتهية المهلة"], ["VoidNoDocuments", "ملغاة"]];

export function BookingFilters({ action, sp, units, extra }: { action: string; sp: Record<string, string | undefined>; units?: { id: number; name: string }[]; extra?: React.ReactNode }) {
  return (
    <form action={action} method="get" className="flex flex-wrap gap-2 items-end" style={{ marginBottom: 14 }}>
      <input type="hidden" name="status" value={sp.status ?? "all"} />
      <div className="field" style={{ flex: "1 1 220px" }}><label className="label" htmlFor="fq">بحث</label><input id="fq" name="q" defaultValue={sp.q} className="input" placeholder="الاسم أو الرقم أو رقم العملية" /></div>
      {units && <div className="field" style={{ flex: "0 1 180px" }}><label className="label" htmlFor="fu">الوحدة</label><select id="fu" name="unit" defaultValue={sp.unit} className="select"><option value="">الكل</option>{units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>}
      {extra}
      <div className="field" style={{ flex: "0 1 160px" }}><label className="label" htmlFor="ff">من تاريخ</label><input id="ff" type="date" name="from" defaultValue={sp.from} className="input" /></div>
      <div className="field" style={{ flex: "0 1 160px" }}><label className="label" htmlFor="ft">إلى تاريخ</label><input id="ft" type="date" name="to" defaultValue={sp.to} className="input" /></div>
      <button className="btn btn-dark" style={{ minHeight: 50 }}>تطبيق</button>
    </form>
  );
}

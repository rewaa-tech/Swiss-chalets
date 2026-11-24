import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHead } from "@/components/admin/AdminShell";
import { requireUser } from "@/lib/auth";
import { one, q } from "@/lib/db";
import { BOOKING_ROW, BOOKING_FROM, bookingTimeline } from "@/lib/services/panel";
import { STATUS_AR, CATEGORY_AR, type BookingStatus, type Category } from "@/lib/services/booking";
import { fmtDayAr, fmtTime, fmtDateTimeAr } from "@/lib/time";
import { money } from "@/lib/services/public";

export const dynamic = "force-dynamic";

export default async function AdminBooking({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("admin");
  const id = Number((await params).id);
  const b = Number.isInteger(id) ? await one(`SELECT ${BOOKING_ROW} ${BOOKING_FROM} WHERE b.id = $1`, [id]) : null;
  if (!b) notFound();
  const [items, tl] = await Promise.all([
    q("SELECT bi.day, lower(bi.period) s, upper(bi.period) e, bi.price, ts.name FROM booking_items bi JOIN time_slots ts ON ts.id = bi.time_slot_id WHERE bi.booking_id = $1 ORDER BY bi.day", [id]),
    bookingTimeline(id),
  ]);
  const rows: [string, React.ReactNode][] = [
    ["الحالة", <span key="s" className={`badge b-${b.status}`}>{STATUS_AR[b.status as BookingStatus]}</span>], ["الفرع", b.branch_name], ["الوحدة", b.unit_name],
    ["الزبون", b.customer_name], ["واتساب", <span key="p" dir="ltr" className="num">{b.phone_e164}</span>], ["الفئة", `${CATEGORY_AR[b.category as Category]} · ${b.persons} أشخاص`],
    ["المبلغ", money(b.total, b.currency)], ["رقم العملية", b.transaction_number ?? "—"], ["الإشعار", b.proof_kind === "Pdf" ? "PDF" : b.proof_kind ? "صورة" : "—"],
    ["المصدر", b.source === "Manual" ? "يدوي" : "الموقع"], ["أُنشئ", fmtDateTimeAr(b.created_at)], ["سبب الرفض", b.reject_reason ?? "—"],
  ];
  return (
    <>
      <PageHead title={`الحجز #${b.id}`} sub="عرض فقط"><Link href="/admin/bookings" className="btn btn-outline btn-sm">رجوع</Link></PageHead>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="admin-card grid gap-3 sm:grid-cols-2" style={{ fontSize: 14 }}>{rows.map(([k, v]) => <div key={k} className="flex flex-col"><span className="muted" style={{ fontSize: 12 }}>{k}</span><span style={{ fontWeight: 600 }}>{v}</span></div>)}</div>
        <div className="flex flex-col gap-5">
          <div className="admin-card"><h2 style={{ fontSize: 17, marginBottom: 8 }}>الفترات</h2>
            <ul style={{ margin: 0, paddingInlineStart: 18, lineHeight: 2 }}>{items.map((i, k) => <li key={k}>{fmtDayAr(i.day)} · {i.name} · <span dir="ltr" className="num">{fmtTime(i.s)}–{fmtTime(i.e)}</span> · {money(i.price, b.currency)}</li>)}</ul></div>
          <div className="admin-card"><h2 style={{ fontSize: 17, marginBottom: 8 }}>السجل</h2>
            {tl.length ? <ul style={{ margin: 0, paddingInlineStart: 18, lineHeight: 2, fontSize: 14 }}>{tl.map((a, k) => <li key={k}><span className="muted num">{fmtDateTimeAr(a.created_at)}</span> · {a.action} · {a.display_name}</li>)}</ul> : <span className="muted">لا توجد قرارات بعد</span>}</div>
        </div>
      </div>
    </>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHead } from "@/components/admin/AdminShell";
import ProofPreview from "@/components/admin/ProofPreview";
import ActionForm from "@/components/admin/ActionForm";
import ConfirmButton from "@/components/admin/ConfirmButton";
import Icon from "@/components/Icon";
import { requireUser, requirePerm } from "@/lib/auth";
import { one, q } from "@/lib/db";
import { BOOKING_ROW, BOOKING_FROM, bookingTimeline } from "@/lib/services/panel";
import { STATUS_AR, CATEGORY_AR, whatsappFor, type BookingStatus, type Category } from "@/lib/services/booking";
import { fmtDayAr, fmtTime, fmtDateTimeAr } from "@/lib/time";
import { money } from "@/lib/services/public";
import { voidAction } from "../../actions";

export const dynamic = "force-dynamic";

const ACTION_AR: Record<string, string> = { Confirm: "تثبيت", Reject: "رفض", RejectAndBlock: "رفض وحظر", VoidNoDocuments: "ملغى لعدم الثبوتيات", ManualBooking: "حجز يدوي" };

export default async function BookingDetail({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser("branch");
  requirePerm(u, "bookings.view");
  const id = Number((await params).id);
  const b = Number.isInteger(id) ? await one(`SELECT ${BOOKING_ROW}, b.ip_hash, b.device_hash ${BOOKING_FROM} WHERE b.id = $1 AND b.branch_id = $2`, [id, u.branchId]) : null;
  if (!b) notFound();
  const [items, timeline, notif] = await Promise.all([
    q("SELECT bi.day, lower(bi.period) s, upper(bi.period) e, bi.price, bi.is_active, ts.name FROM booking_items bi JOIN time_slots ts ON ts.id = bi.time_slot_id WHERE bi.booking_id = $1 ORDER BY bi.day", [id]),
    bookingTimeline(id),
    q("SELECT kind, status, created_at FROM notifications_log WHERE booking_id = $1 ORDER BY created_at", [id]),
  ]);
  const status = b.status as BookingStatus;
  const wa = status === "Confirmed" || status === "Completed" ? await whatsappFor(id, "confirm") : status === "Rejected" ? await whatsappFor(id, "reject") : null;
  const started = b.starts_at && new Date(b.starts_at) <= new Date();
  const events = [
    { t: b.created_at, l: b.source === "Manual" ? "أُنشئ يدويًا من اللوحة" : "أُنشئ الطلب من الموقع" },
    ...(b.proof_at && b.source !== "Manual" ? [{ t: b.proof_at, l: "رُفع إشعار الدفع" }] : []),
    ...notif.map((n) => ({ t: n.created_at, l: `تنبيه تيليغرام (${n.kind === "new" ? "أول" : n.kind === "reminder" ? "تذكير" : "تصعيد"}) · ${n.status === "Sent" ? "أُرسل" : n.status === "Skipped" ? "لا يوجد مستلم مرتبط" : "فشل"}` })),
    ...timeline.map((a) => ({ t: a.created_at, l: `${ACTION_AR[a.action] ?? a.action} · ${a.display_name ?? ""}${a.details?.reason ? ` · السبب: ${a.details.reason}` : ""}` })),
  ].sort((x, y) => new Date(x.t).getTime() - new Date(y.t).getTime());

  return (
    <>
      <PageHead title={`الحجز #${b.id}`} sub={`${b.unit_name} · ${STATUS_AR[status]}`}>
        <Link href="/branch/bookings" className="btn btn-outline btn-sm">رجوع</Link>
        {status === "PendingReview" && (u.permissions.has("bookings.confirm") || u.permissions.has("bookings.reject")) && <Link href={`/branch/queue?id=${b.id}`} className="btn btn-dark btn-sm">مراجعة الطلب</Link>}
      </PageHead>
      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-5 min-w-0">
          <div className="admin-card grid gap-3 sm:grid-cols-2" style={{ fontSize: 14 }}>
            <Info k="الحالة" v={<span className={`badge b-${status}`}>{STATUS_AR[status]}</span>} />
            <Info k="المصدر" v={b.source === "Manual" ? "يدوي" : "الموقع"} />
            <Info k="الزبون" v={b.customer_name} />
            <Info k="واتساب" v={<span dir="ltr" className="num">{b.phone_e164}</span>} />
            <Info k="الفئة والعدد" v={`${CATEGORY_AR[b.category as Category]} · ${b.persons} أشخاص`} />
            <Info k="المبلغ" v={<span className="num">{money(b.total, b.currency)}</span>} />
            <Info k="رقم العملية" v={<span className="num" dir="ltr">{b.transaction_number ?? "—"}</span>} />
            <Info k="مهلة المراجعة" v={fmtDateTimeAr(b.review_due_at)} />
            {b.reject_reason && <Info k="سبب الرفض" v={b.reject_reason} />}
            {b.notes && <Info k="ملاحظات" v={b.notes} />}
          </div>
          <div className="admin-card">
            <h2 style={{ fontSize: 17, marginBottom: 10 }}>الفترات</h2>
            <table className="table"><thead><tr><th>اليوم</th><th>الفترة</th><th>الوقت</th><th>السعر</th></tr></thead>
              <tbody>{items.map((i, k) => <tr key={k}><td>{fmtDayAr(i.day)}</td><td>{i.name}</td><td className="num" dir="ltr" style={{ textAlign: "right" }}>{fmtTime(i.s)}–{fmtTime(i.e)}</td><td className="num">{money(i.price, b.currency)}</td></tr>)}</tbody></table>
          </div>
          <div className="admin-card">
            <h2 style={{ fontSize: 17, marginBottom: 10 }}>السجل الزمني</h2>
            <ol style={{ margin: 0, paddingInlineStart: 18, lineHeight: 2, fontSize: 14 }}>{events.map((e, i) => <li key={i}><span className="muted num">{fmtDateTimeAr(e.t)}</span> — {e.l}</li>)}</ol>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="admin-card"><h2 style={{ fontSize: 17, marginBottom: 10 }}>إشعار الدفع</h2><ProofPreview bookingId={b.id} kind={b.proof_kind} deleted={!!b.file_deleted_at} /></div>
          {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-wa"><Icon name="wa" size={20} />رسالة واتساب للزبون</a>}
          {status === "Confirmed" && started && u.permissions.has("bookings.void") && (
            <ActionForm action={voidAction} className="admin-card flex flex-col gap-2">
              <input type="hidden" name="id" value={b.id} />
              <p className="muted" style={{ margin: 0, fontSize: 14 }}>إذا لم يُحضر الزبون الثبوتيات المطلوبة عند الوصول:</p>
              <ConfirmButton className="btn btn-danger" danger title="ملغى لعدم الثبوتيات" message="سيُسجّل الحجز ملغى لعدم إحضار الثبوتيات، ويُفتح الوقت المتبقي للحجز." confirmLabel="تأكيد الإلغاء">ملغى لعدم الثبوتيات</ConfirmButton>
            </ActionForm>
          )}
        </div>
      </div>
    </>
  );
}

function Info({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex flex-col gap-0.5"><span className="muted" style={{ fontSize: 12 }}>{k}</span><span style={{ fontWeight: 600 }}>{v}</span></div>;
}

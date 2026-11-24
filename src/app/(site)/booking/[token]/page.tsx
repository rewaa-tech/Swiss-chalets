import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PublicShell from "@/components/PublicShell";
import HeroImage from "@/components/HeroImage";
import Icon from "@/components/Icon";
import MapCard from "@/components/MapCard";
import PaymentStep from "@/components/booking/PaymentStep";
import StatusPoller from "@/components/booking/StatusPoller";
import SaveBooking from "@/components/booking/SaveBooking";
import { q, one } from "@/lib/db";
import { getBookingByToken, canLateUpload, paymentInfo, CATEGORY_AR, STATUS_AR, type BookingStatus, type Category } from "@/lib/services/booking";
import { branchTheme, money, siteMeta, sypText } from "@/lib/services/public";
import { getSettings } from "@/lib/settings";
import { fmtDayAr, fmtTime, fmtDateTimeAr } from "@/lib/time";
import { resolveContact } from "@/lib/services/contacts";
import { waLink } from "@/lib/phone";
import { getTexts } from "@/lib/texts/server";
import { textHelpers } from "@/lib/texts/jsx";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "طلب الحجز", robots: { index: false } };

export default async function BookingPage({ params }: { params: Promise<{ token: string }> }) {
  const b = await getBookingByToken((await params).token);
  if (!b) notFound();
  const [{ theme }, meta, pay, s, items, cover, branch] = await Promise.all([
    branchTheme(b.branch_id), siteMeta(), paymentInfo(b.branch_id), getSettings(),
    q("SELECT bi.day, lower(bi.period) AS s, upper(bi.period) AS e, bi.price, ts.name FROM booking_items bi JOIN time_slots ts ON ts.id = bi.time_slot_id WHERE bi.booking_id = $1 ORDER BY bi.day", [b.id]),
    one("SELECT COALESCE(u.cover_path_base, (SELECT path_base FROM unit_media m WHERE m.unit_id = u.id AND m.path_base <> '' ORDER BY sort_order LIMIT 1)) AS path_base FROM units u WHERE u.id = $1", [b.unit_id]),
    one("SELECT shamcash_qr_path FROM branches WHERE id = $1", [b.branch_id]),
  ]);
  const { t, T } = textHelpers(await getTexts(b.branch_id));
  const status = b.status as BookingStatus;
  const late = status === "Expired" ? await canLateUpload(b.id, b.unit_id) : false;
  const phone = await resolveContact("Booking", b.id, b.branch_id);
  const wa = phone ? waLink(phone, `مرحبًا، بخصوص طلبي في ${b.unit_name} (${fmtDayAr(items[0]?.day)})`) : null;
  const img = cover?.path_base ? `/media/${cover.path_base}` : "/img/hero/chalet-pool-dusk";
  const summary = {
    unit: b.unit_name, branch: b.branch_name, day: fmtDayAr(items[0]?.day), time: `${fmtTime(b.starts_at)} – ${fmtTime(b.ends_at)}`,
    nights: items.length, total: money(b.total, b.currency), syp: meta.showSyp && b.exchange_rate > 0 ? sypText(b.total, b.exchange_rate) : null,
  };

  if (status === "Held" || (status === "Expired" && late)) {
    return (
      <PublicShell theme={theme} page="Booking" entityId={b.id} branchId={b.branch_id} waText={`مرحبًا، بخصوص طلبي في ${b.unit_name}`} header={false} footer={false}>
        <SaveBooking token={b.status_token} unit={b.unit_name} date={items[0]?.day} />
        <PaymentStep token={b.status_token} expired={status === "Expired"} holdExpiresAt={new Date(b.hold_expires_at).toISOString()} createdAt={new Date(b.created_at).toISOString()}
          summary={summary} image={img} payment={{ ...pay, qr: branch?.shamcash_qr_path ? `/media/${branch.shamcash_qr_path}` : null }} wa={wa} />
      </PublicShell>
    );
  }

  const view = {
    PendingReview: { icon: "clock", color: "var(--sand)", title: T("st.pending.t"), text: T("st.pending.d") },
    Confirmed: { icon: "check", color: "#7BD6A0", title: T("st.confirmed.t"), text: T("st.confirmed.d") },
    Completed: { icon: "star", color: "var(--sand)", title: T("st.completed.t"), text: T("st.completed.d") },
    Rejected: { icon: "close", color: "#F2A39C", title: T("st.rejected.t"), text: b.reject_reason ? t("st.rejected.reason", { "السبب": b.reject_reason }) : T("st.rejected.d") },
    Expired: { icon: "alert", color: "#F2A39C", title: T("st.expired.t"), text: T("st.expired.d") },
    VoidNoDocuments: { icon: "ban", color: "#F2A39C", title: T("st.void.t"), text: T("st.void.d") },
    Held: { icon: "clock", color: "var(--sand)", title: "", text: "" },
  }[status];
  const stage = { PendingReview: 2, Confirmed: 4, Completed: 4, Rejected: 3, Expired: 1, VoidNoDocuments: 4, Held: 1 }[status];
  const steps = [
    [t("st.step1"), fmtDateTimeAr(b.created_at)],
    [t("st.step2"), b.proof_at ? fmtDateTimeAr(b.proof_at) : "—"],
    [t("st.step3"), status === "PendingReview" ? t("st.step3.during", { "البداية": pay.reviewStart, "النهاية": pay.reviewEnd }) : b.reviewed_at ? fmtDateTimeAr(b.reviewed_at) : "—"],
    [status === "Rejected" ? "مرفوض" : status === "VoidNoDocuments" ? "ملغى" : t("st.step4"), status === "Confirmed" || status === "Completed" ? "تم ✓" : "—"],
  ];

  return (
    <PublicShell theme={theme} page="Booking" entityId={b.id} branchId={b.branch_id} waText={`مرحبًا، بخصوص طلبي في ${b.unit_name}`} header={false}>
      <SaveBooking token={b.status_token} unit={b.unit_name} date={items[0]?.day} />
      {(status === "PendingReview") && <StatusPoller token={b.status_token} status={status} />}
      <section className="relative overflow-hidden" style={{ minHeight: 330, display: "flex", alignItems: "flex-end" }}>
        <HeroImage base={img} alt="" className="absolute inset-0 w-full h-full object-cover" priority fx={false} style={{ objectPosition: "center 35%" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(10,22,16,.3) 0%, rgba(10,22,16,.85) 100%)" }} />
        <div className="relative wrap flex flex-col items-center gap-3.5 text-center text-white" style={{ paddingBottom: 56, paddingTop: 60 }}>
          <span className="relative" style={{ width: 76, height: 76 }}>
            {status === "PendingReview" && <span className="pulse absolute inset-0" style={{ borderRadius: 999, background: view.color }} aria-hidden />}
            <span className="absolute inset-0 flex items-center justify-center" style={{ borderRadius: 999, background: "rgba(255,255,255,.16)", border: `2px solid ${view.color}`, backdropFilter: "blur(8px)" }}>
              <Icon name={view.icon} size={34} stroke="#fff" width={2} />
            </span>
          </span>
          <h1 style={{ color: "#fff", fontSize: 26 }}>{view.title}</h1>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: "#E9E4DA", maxWidth: 480 }}>{view.text}</p>
        </div>
      </section>
      <div className="relative wrap flex flex-col gap-4" style={{ marginTop: -32, maxWidth: 640 }}>
        <div className="card" style={{ padding: 20, borderRadius: 24 }}>
          <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {steps.map(([t, d], i) => {
              const done = i + 1 < stage || (i + 1 === stage && (status === "Confirmed" || status === "Completed"));
              const current = i + 1 === stage && !done;
              const bad = current && (status === "Rejected" || status === "VoidNoDocuments" || status === "Expired");
              return (
                <li key={t} className="flex gap-3.5 relative" style={{ paddingBottom: i < 3 ? 18 : 0 }}>
                  {i < 3 && <span aria-hidden className="absolute" style={{ right: 14, top: 32, bottom: 2, width: 2, background: done ? "var(--success)" : "var(--line)" }} />}
                  <span className="flex-none flex items-center justify-center" style={{ width: 30, height: 30, borderRadius: 999, background: done ? "var(--success)" : bad ? "var(--error)" : current ? "var(--sand)" : "var(--line-soft)" }}>
                    {done ? <Icon name="check" size={16} stroke="#fff" width={2.4} /> : <span className="num" style={{ fontSize: 13, fontWeight: 700, color: current ? "var(--night)" : "var(--stone)" }}>{i + 1}</span>}
                  </span>
                  <div className="flex flex-col"><span style={{ fontWeight: 600, fontSize: 15 }}>{t}</span><span className="muted num" style={{ fontSize: 13 }}>{d}</span></div>
                </li>
              );
            })}
          </ol>
        </div>
        <div className="card flex flex-col gap-2" style={{ padding: 20, borderRadius: 24 }}>
          <div className="flex justify-between items-center"><span className="muted">الحالة</span><span className={`badge b-${status}`}>{STATUS_AR[status]}</span></div>
          <Row k="الوحدة" v={`${b.unit_name} · فرع ${b.branch_name}`} />
          <Row k="الموعد" v={`${summary.day} · ${summary.time}${items.length > 1 ? ` · ${items.length} ليالٍ` : ""}`} />
          <Row k="الحجز" v={`${CATEGORY_AR[b.category as Category]} · ${b.persons} أشخاص`} />
          <Row k="المبلغ" v={`${summary.total}${summary.syp ? ` (${summary.syp})` : ""}`} />
          {b.transaction_number && <Row k="رقم العملية" v={b.transaction_number} />}
        </div>
        {(status === "Confirmed") && (
          <div className="card flex flex-col gap-2" style={{ padding: 20, borderRadius: 24, background: "#E6F3EA" }}>
            <strong style={{ color: "var(--success)", fontFamily: "var(--f-head)" }}>{T("st.arrive")}</strong>
            <p style={{ margin: 0, lineHeight: 1.8 }}>{s.documents_text}</p>
            {b.lat == null && b.map_url && <a className="btn btn-dark self-start" href={b.map_url} target="_blank" rel="noopener noreferrer"><Icon name="map" size={18} />افتح الموقع على الخريطة</a>}
          </div>
        )}
        {status === "Confirmed" && b.lat != null && b.lng != null && <MapCard name={b.branch_name} lat={b.lat} lng={b.lng} address={b.branch_address} compact />}
        {status === "Expired" && <a href={`/u/${b.unit_slug}`} className="btn btn-cta btn-block">{T("st.pickOther")}</a>}
        {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-wa btn-block" style={{ minHeight: 56 }}><Icon name="wa" size={22} />{T("st.wa")}</a>}
      </div>
    </PublicShell>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-4" style={{ fontSize: 15 }}><span className="muted">{k}</span><span className="num" style={{ fontWeight: 600, textAlign: "left" }}>{v}</span></div>;
}

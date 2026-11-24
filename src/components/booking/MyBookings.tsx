"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import Icon from "../Icon";
import { loadMyBookings, dayLabel, type SavedBooking } from "./client-utils";
import { useTexts } from "../Texts";

const AR: Record<string, string> = { Held: "محجوز مؤقتًا", PendingReview: "بانتظار التأكيد", Confirmed: "مثبّت", Completed: "مكتمل", Expired: "انتهت المهلة", Rejected: "مرفوض", VoidNoDocuments: "ملغى" };

export default function MyBookings() {
  const { T } = useTexts();
  const [list, setList] = useState<SavedBooking[] | null>(null);
  const [status, setStatus] = useState<Record<string, string>>({});
  useEffect(() => {
    const l = loadMyBookings(); setList(l);
    l.slice(0, 10).forEach(async (b) => {
      try { const r = await fetch(`/api/bookings/${b.token}`); if (r.ok) { const j = await r.json(); setStatus((s) => ({ ...s, [b.token]: j.status })); } } catch { /* ignore */ }
    });
  }, []);
  if (!list) return <div className="flex flex-col gap-3">{[0, 1].map((i) => <span key={i} className="skeleton" style={{ height: 84, borderRadius: 22 }} />)}</div>;
  if (!list.length) return (
    <div className="card empty"><span className="empty-ico"><Icon name="inbox" size={30} stroke="var(--stone)" /></span>
      <strong style={{ fontFamily: "var(--f-head)", color: "var(--forest-deep)" }}>{T("my.emptyTitle")}</strong>
      <span>{T("my.emptyText")}</span><Link href="/#branches" className="btn btn-cta">{T("my.start")}</Link></div>
  );
  return (
    <ul className="flex flex-col gap-3" style={{ margin: 0, padding: 0, listStyle: "none" }}>
      {list.map((b) => (
        <li key={b.token}>
          <Link href={`/booking/${b.token}`} className="card row flex items-center justify-between gap-3" style={{ padding: "16px 18px", borderRadius: 22, color: "var(--ink)" }}>
            <span className="flex flex-col"><strong style={{ fontFamily: "var(--f-head)", color: "var(--forest-deep)" }}>{b.unit}</strong><span className="muted" style={{ fontSize: 14 }}>{b.date ? dayLabel(b.date) : ""}</span></span>
            <span className="flex items-center gap-2">{status[b.token] && <span className={`badge b-${status[b.token]}`}>{AR[status[b.token]]}</span>}<Icon name="arrow" size={18} /></span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Icon from "../Icon";
import ActionForm, { FieldError, Submit, type ActionState } from "./ActionForm";
import ConfirmButton from "./ConfirmButton";
import ProofPreview from "./ProofPreview";
import { hhmm, dayLabel } from "../booking/client-utils";

export interface QItem {
  id: number; customer_name: string; phone_e164: string; category: string; persons: number; notes: string | null; total: number; currency: string;
  review_due_at: string | null; proof_at: string | null; unit_name: string; transaction_number: string | null; proof_kind: "Image" | "Pdf" | null;
  page_count: number | null; first_day: string; nights: number; starts_at: string; ends_at: string; file_deleted_at: string | null;
}
type Act = (p: ActionState | null, fd: FormData) => Promise<ActionState>;

const money = (n: number, c: string) => (c === "USD" ? `$${n}` : `${n} ${c}`);

function useNow(ms = 1000) { const [n, setN] = useState(() => Date.now()); useEffect(() => { const t = setInterval(() => setN(Date.now()), ms); return () => clearInterval(t); }, [ms]); return n; }

function Deadline({ due, now, big = false }: { due: string | null; now: number; big?: boolean }) {
  if (!due) return null;
  const d = new Date(due).getTime() - now;
  const late = d < 0, a = Math.abs(d);
  const h = Math.floor(a / 3600000), m = Math.floor((a % 3600000) / 60000), s = Math.floor((a % 60000) / 1000);
  const txt = h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return (
    <span className="badge num" dir="ltr" style={{ background: late ? "#F8DEDB" : d < 10 * 60000 ? "#F6E7D3" : "#E3EAE6", color: late ? "#8f1e18" : d < 10 * 60000 ? "#8A4A26" : "var(--forest)", fontSize: big ? 15 : 12 }}>
      {late ? `+${txt}` : txt}
    </span>
  );
}

export default function QueueBoard({ initial, canReview, canBlock, reviewAction, initialId }: { initial: QItem[]; canReview: boolean; canBlock: boolean; reviewAction: Act; initialId?: number }) {
  const [items, setItems] = useState(initial);
  const [sel, setSel] = useState<number | null>(initialId ?? null);
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<{ id: number; whatsapp: string; decision: string; name: string } | null>(null);
  const known = useRef(new Set(initial.map((i) => i.id)));
  const baseTitle = useRef("");
  const now = useNow();

  useEffect(() => { baseTitle.current = document.title; }, []);
  const poll = useCallback(async () => {
    try {
      const r = await fetch("/branch/api/queue", { cache: "no-store" });
      if (!r.ok) return;
      const list: QItem[] = await r.json();
      const added = list.filter((i) => !known.current.has(i.id));
      list.forEach((i) => known.current.add(i.id));
      setItems(list);
      if (added.length) {
        setFresh(new Set(added.map((a) => a.id)));
        document.title = `(${added.length}) طلب جديد`;
        setTimeout(() => setFresh(new Set()), 1800);
      }
      document.querySelectorAll<HTMLElement>('[data-nav-count="/branch/queue"]').forEach((el) => (el.textContent = String(list.length)));
    } catch { /* offline */ }
  }, []);
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) poll(); }, 20_000);
    const vis = () => { if (!document.hidden) document.title = baseTitle.current || document.title; };
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [poll]);

  const current = useMemo(() => items.find((i) => i.id === sel) ?? null, [items, sel]);
  const onDone = useCallback((s: ActionState) => {
    if (!s.ok) return;
    const d = s.data as { whatsapp: string; decision: string };
    const it = items.find((i) => i.id === sel);
    setResult({ id: sel!, whatsapp: d.whatsapp, decision: d.decision, name: it?.customer_name ?? "" });
    setItems((x) => x.filter((i) => i.id !== sel));
    setSel(null);
  }, [items, sel]);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(320px,420px)_1fr]">
      <div className={`flex flex-col gap-2.5 ${current ? "hidden lg:flex" : ""}`}>
        {result && (
          <div className="admin-card flex flex-col gap-3" style={{ background: result.decision === "Confirm" ? "#E6F3EA" : "#FBEDEB" }}>
            <strong>{result.decision === "Confirm" ? "تم التثبيت" : "تم الرفض"} — {result.name}</strong>
            <a href={result.whatsapp} target="_blank" rel="noopener noreferrer" className="btn btn-wa"><Icon name="wa" size={20} />أرسل رسالة واتساب للزبون</a>
          </div>
        )}
        {!items.length ? (
          <div className="admin-card"><div className="empty"><span className="empty-ico"><Icon name="check" size={30} stroke="var(--success)" /></span><strong style={{ fontFamily: "var(--f-head)", color: "var(--forest-deep)" }}>لا توجد طلبات بانتظارك</strong><span>تتحدث القائمة تلقائيًا كل 20 ثانية.</span></div></div>
        ) : items.map((i) => (
          <button key={i.id} type="button" onClick={() => { setSel(i.id); setResult(null); }} className={`row admin-card text-start flex flex-col gap-2 ${fresh.has(i.id) ? "flash" : ""}`}
            style={{ padding: 16, border: `1.5px solid ${sel === i.id ? "var(--forest)" : "transparent"}`, cursor: "pointer" }} aria-pressed={sel === i.id}>
            <span className="flex items-center justify-between gap-2">
              <strong style={{ fontFamily: "var(--f-head)", color: "var(--forest-deep)" }}>{i.customer_name}</strong>
              <Deadline due={i.review_due_at} now={now} />
            </span>
            <span className="muted" style={{ fontSize: 13 }}>{i.unit_name} · {dayLabel(i.first_day)} · <span dir="ltr" className="num">{hhmm(i.starts_at)}–{hhmm(i.ends_at)}</span></span>
            <span className="flex items-center justify-between">
              <span className={`badge ${i.proof_kind === "Pdf" ? "b-pdf" : "b-img"}`}>{i.proof_kind === "Pdf" ? "PDF" : "صورة"}</span>
              <span className="num" style={{ fontFamily: "var(--f-head)", fontWeight: 700 }}>{money(i.total, i.currency)}</span>
            </span>
          </button>
        ))}
      </div>

      {current ? (
        <div className="flex flex-col gap-4 min-w-0">
          {/* mobile header (Review artboard) */}
          <div className="lg:hidden flex flex-col gap-4" style={{ margin: "-28px -16px 0", padding: "18px 16px 56px", background: "var(--night)", color: "#F7F3EC" }}>
            <div className="flex items-center justify-between">
              <button type="button" className="btn btn-icon" style={{ background: "rgba(247,243,236,.08)", color: "#fff" }} onClick={() => setSel(null)} aria-label="رجوع للقائمة"><Icon name="back" size={20} /></button>
              <span className="badge" style={{ background: "rgba(227,185,143,.16)", color: "var(--sand)", border: "1px solid rgba(227,185,143,.4)" }}>بانتظار التأكيد</span>
            </div>
            <div className="flex items-end justify-between">
              <div className="flex flex-col"><span style={{ fontSize: 13, color: "#8FA197" }}>المبلغ المطلوب</span><span className="num" style={{ fontFamily: "var(--f-head)", fontWeight: 700, fontSize: 34 }}>{money(current.total, current.currency)}</span></div>
              <div className="flex flex-col items-end gap-1"><Deadline due={current.review_due_at} now={now} big /><span style={{ fontSize: 11, color: "var(--sand)" }}>مهلة المراجعة</span></div>
            </div>
          </div>
          <div className="admin-card flex flex-col gap-4 lg:mt-0" style={{ marginTop: -48 }}>
            <div className="hidden lg:flex items-center justify-between">
              <div className="flex flex-col"><h2 style={{ fontSize: 20 }}>{current.customer_name}</h2><span className="muted num" dir="ltr" style={{ textAlign: "right" }}>{current.phone_e164}</span></div>
              <div className="flex items-center gap-3"><Deadline due={current.review_due_at} now={now} big /><span className="num" style={{ fontFamily: "var(--f-head)", fontWeight: 700, fontSize: 26 }}>{money(current.total, current.currency)}</span></div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <ProofPreview bookingId={current.id} kind={current.proof_kind} deleted={!!current.file_deleted_at} />
              <dl className="flex flex-col gap-2.5" style={{ margin: 0, fontSize: 14 }}>
                <Row k="الزبون" v={current.customer_name} />
                <Row k="واتساب" v={<span dir="ltr" className="num">{current.phone_e164}</span>} />
                <Row k="رقم العملية" v={<span className="flex items-center gap-2"><span className="num" dir="ltr">{current.transaction_number}</span>{current.transaction_number && <button type="button" className="btn btn-sm btn-light" style={{ minHeight: 34, padding: "0 10px" }} data-fx="copy" data-copy={current.transaction_number} aria-label="نسخ رقم العملية"><Icon name="copy" size={14} /></button>}</span>} />
                <Row k="الوحدة" v={current.unit_name} />
                <Row k="الموعد" v={<>{dayLabel(current.first_day)} · <span dir="ltr" className="num">{hhmm(current.starts_at)}–{hhmm(current.ends_at)}</span>{current.nights > 1 ? ` · ${current.nights} ليالٍ` : ""}</>} />
                <Row k="الفئة" v={`${current.category === "Family" ? "عائلي" : "شبابي"} · ${current.persons} أشخاص`} />
                {current.notes && <Row k="ملاحظات" v={current.notes} />}
                <Link href={`/branch/bookings/${current.id}`} className="muted" style={{ fontSize: 13, textDecoration: "underline" }}>عرض السجل الكامل</Link>
              </dl>
            </div>
          </div>
          {canReview && (
            <ActionForm action={reviewAction} onDone={onDone} key={current.id}
              className="glass flex flex-col gap-3 fixed lg:static inset-x-3 bottom-[72px] lg:bottom-auto z-40" style={{ padding: 14, borderRadius: 22, background: "rgba(255,255,255,.9)", boxShadow: "var(--sh-float)" }}>
              <input type="hidden" name="id" value={current.id} />
              <div className="field"><label className="label" htmlFor="reason">سبب الرفض <span className="muted" style={{ fontWeight: 400 }}>(إلزامي عند الرفض)</span></label>
                <input id="reason" name="reason" className="input" maxLength={300} placeholder="مثال: المبلغ غير مطابق" /><FieldError name="reason" /></div>
              <div className="flex flex-wrap gap-2">
                <Submit className="btn btn-success flex-1" name="decision" value="Confirm" pendingText="…">تثبيت الحجز</Submit>
                <ConfirmButton className="btn btn-outline" name="decision" value="Reject" title="رفض الطلب" message="سيُرفض الطلب ويُفتح الوقت للحجز من جديد. تأكد من كتابة السبب." confirmLabel="رفض">رفض</ConfirmButton>
                {canBlock && <ConfirmButton className="btn btn-danger" name="decision" value="RejectAndBlock" danger double title="رفض وحظر" message="سيُرفض الطلب ويُحظر رقم الزبون والـ IP والجهاز من الحجز مستقبلًا." confirmLabel="رفض وحظر">رفض وحظر</ConfirmButton>}
                <a className="btn btn-wa btn-icon" href={`https://wa.me/${current.phone_e164.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" aria-label="واتساب الزبون"><Icon name="wa" size={20} /></a>
              </div>
            </ActionForm>
          )}
          <div className="h-48 lg:hidden" aria-hidden />
        </div>
      ) : (
        <div className="admin-card hidden lg:flex items-center justify-center"><div className="empty"><span className="empty-ico"><Icon name="inbox" size={30} stroke="var(--stone)" /></span><span>اختر طلبًا من القائمة لمراجعته</span></div></div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-3" style={{ borderBottom: "1px solid var(--line-soft)", paddingBottom: 8 }}><dt className="muted">{k}</dt><dd style={{ margin: 0, fontWeight: 600, textAlign: "left" }}>{v}</dd></div>;
}

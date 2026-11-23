"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "../Icon";
import Sheet from "../Sheet";
import { hhmm, dayLabel, monthLabel, money, shiftMonth, saveMyBooking, problemMessage } from "./client-utils";

interface Day { date: string; state: "full" | "partial" | "unavailable"; freeSlots: number; minPrice: number | null }
interface Slot { slotId: number; name: string; kind: string; start: string; end: string; price: number; available: boolean }
interface UnitInfo { id: number; name: string; capacity: number; familyOnly: boolean; branch: string; reviewStart: string; reviewEnd: string }

const WEEK = ["سبت", "أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة"];

export default function BookingWidget({ unit, currency, today, maxDate, formStamp, mechanism, documents }: {
  unit: UnitInfo; currency: string; today: string; maxDate: string; formStamp: string; mechanism: string; documents: string; todayLabel: string;
}) {
  const router = useRouter();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [days, setDays] = useState<Day[] | null>(null);
  const [calErr, setCalErr] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slotId, setSlotId] = useState<number | null>(null);
  const [nights, setNights] = useState(1);
  const [hover, setHover] = useState<string | null>(null);
  const [mechOpen, setMechOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const loadMonth = useCallback(async (m: string) => {
    setDays(null); setCalErr(null);
    try {
      const r = await fetch(`/api/units/${unit.id}/calendar?month=${m}`);
      if (!r.ok) throw new Error((await problemMessage(r)).message);
      setDays(await r.json());
    } catch (e) { setCalErr((e as Error).message || "تعذّر تحميل التقويم"); }
  }, [unit.id]);

  useEffect(() => { loadMonth(month); }, [month, loadMonth]);

  const pickDay = async (d: string) => {
    setDay(d); setSlots(null); setSlotId(null); setNights(1);
    const r = await fetch(`/api/units/${unit.id}/slots?date=${d}`);
    setSlots(r.ok ? await r.json() : []);
  };

  const slot = slots?.find((s) => s.slotId === slotId) ?? null;
  const isHotel = slot?.kind === "HotelNight";
  const estimate = slot ? slot.price * (isHotel ? nights : 1) : 0;

  const grid = useMemo(() => {
    const first = new Date(`${month}-01T12:00:00Z`).getUTCDay(); // 0=Sun
    const offset = (first + 1) % 7; // week starts Saturday
    return [...Array(offset).fill(null), ...(days ?? [])] as (Day | null)[];
  }, [days, month]);

  const startBooking = () => {
    if (!slot) return;
    let seen = false;
    try { seen = sessionStorage.getItem("sc_mech") === "1"; } catch { /* ignore */ }
    if (seen) setFormOpen(true); else setMechOpen(true);
  };
  const ackMechanism = () => {
    try { sessionStorage.setItem("sc_mech", "1"); } catch { /* ignore */ }
    setMechOpen(false); setFormOpen(true);
  };

  const canPrev = month > today.slice(0, 7);
  const canNext = month < maxDate.slice(0, 7);

  return (
    <aside id="book" className="flex flex-col gap-4 lg:sticky lg:top-6 self-start w-full" aria-label="الحجز">
      <div className="card" style={{ padding: 18, borderRadius: 26 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
          <button type="button" className="btn btn-icon btn-outline" disabled={!canPrev} onClick={() => setMonth(shiftMonth(month, -1))} aria-label="الشهر السابق"><Icon name="back" size={18} width={2} /></button>
          <h2 style={{ fontSize: 18 }} aria-live="polite">{monthLabel(month)}</h2>
          <button type="button" className="btn btn-icon btn-outline" disabled={!canNext} onClick={() => setMonth(shiftMonth(month, 1))} aria-label="الشهر التالي"><Icon name="arrow" size={18} width={2} /></button>
        </div>
        <div className="cal-grid" style={{ marginBottom: 6 }} aria-hidden>
          {WEEK.map((w) => <span key={w} className="muted" style={{ fontSize: 12, textAlign: "center", fontWeight: 600 }}>{w}</span>)}
        </div>
        {calErr ? (
          <div className="empty" style={{ padding: 24 }}><span>{calErr}</span><button className="btn btn-outline btn-sm" onClick={() => loadMonth(month)}>إعادة المحاولة</button></div>
        ) : !days ? (
          <div className="cal-grid">{Array.from({ length: 35 }, (_, i) => <span key={i} className="skeleton" style={{ aspectRatio: "1" }} />)}</div>
        ) : (
          <div className="cal-grid" data-fx="calendar-hover" role="group" aria-label={`أيام ${monthLabel(month)}`}>
            {grid.map((d, i) => d ? (
              <button key={d.date} type="button" className="cal-day num" data-date={d.date} data-state={d.state} disabled={d.state === "unavailable"} aria-pressed={day === d.date}
                aria-label={`${dayLabel(d.date)}${d.state === "unavailable" ? " — غير متاح" : ` — ${d.freeSlots} فترات متاحة`}`}
                onClick={() => pickDay(d.date)} onPointerEnter={(e) => e.pointerType === "mouse" && setHover(d.date)} onPointerLeave={() => setHover(null)}>
                {Number(d.date.slice(8))}
                {d.state !== "unavailable" && <span className="dot" />}
                {hover === d.date && d.state !== "unavailable" && (
                  <span className="cal-tip" role="tooltip">{d.freeSlots} فترات متاحة · يبدأ من {money(d.minPrice ?? 0, currency)}</span>
                )}
              </button>
            ) : <span key={`e${i}`} />)}
          </div>
        )}
        <div className="flex flex-wrap gap-3 muted" style={{ fontSize: 12, marginTop: 12 }}>
          <span className="flex items-center gap-1.5"><span style={{ width: 12, height: 12, borderRadius: 4, background: "#fff", border: "1px solid var(--line)" }} />متاح</span>
          <span className="flex items-center gap-1.5"><span style={{ width: 12, height: 12, borderRadius: 4, background: "var(--cal-partial)" }} />محجوز جزئيًا</span>
          <span className="flex items-center gap-1.5"><span style={{ width: 12, height: 12, borderRadius: 4, background: "var(--cal-off)" }} />غير متاح</span>
        </div>
      </div>

      {day && (
        <div className="flex flex-col gap-2.5" aria-live="polite">
          <h3 style={{ fontSize: 17 }}>الفترات · {dayLabel(day)}</h3>
          {!slots ? [0, 1].map((i) => <span key={i} className="skeleton" style={{ height: 70, borderRadius: 20 }} />)
            : !slots.length ? <p className="muted" style={{ margin: 0 }}>لا توجد فترات بهذا اليوم.</p>
            : slots.map((s) => (
              <button key={s.slotId} type="button" className="slot-card" disabled={!s.available} aria-pressed={slotId === s.slotId} onClick={() => { setSlotId(s.slotId); setNights(1); }} data-fx="ripple">
                <span className="flex flex-col">
                  <span style={{ fontFamily: "var(--f-head)", fontWeight: 600 }}>{s.name}</span>
                  <span className="num" dir="ltr" style={{ fontSize: 14, opacity: .8, textAlign: "right" }}>{hhmm(s.start)} – {hhmm(s.end)}</span>
                </span>
                <span className="num" style={{ fontFamily: "var(--f-head)", fontWeight: 700, fontSize: 18 }}>{s.available ? money(s.price, currency) : "محجوز"}</span>
              </button>
            ))}
          {isHotel && (
            <div className="card flex items-center justify-between gap-3" style={{ padding: "12px 16px" }}>
              <span style={{ fontWeight: 600 }}>عدد الليالي</span>
              <Stepper value={nights} min={1} max={14} onChange={setNights} label="عدد الليالي" />
            </div>
          )}
        </div>
      )}

      <div className="glass flex items-center justify-between gap-3 fixed lg:static inset-x-3 bottom-3 z-30" style={{ padding: "12px 12px 12px 14px", borderRadius: 24, background: "rgba(255,255,255,.86)", boxShadow: "var(--sh-float)" }}>
        <div className="flex flex-col" style={{ minWidth: 0 }}>
          <span className="muted" style={{ fontSize: 12 }}>{slot ? (isHotel && nights > 1 ? `${nights} ليالٍ · تقديري` : slot.name) : "اختر يومًا وفترة"}</span>
          <span className="num" style={{ fontFamily: "var(--f-head)", fontWeight: 700, fontSize: 20, color: "var(--forest-deep)" }}>{slot ? money(estimate, currency) : "—"}</span>
        </div>
        <button type="button" className="btn btn-cta" style={{ minHeight: 54 }} disabled={!slot} onClick={startBooking} data-fx="magnetic ripple">احجز الآن</button>
      </div>
      <div className="h-20 lg:hidden" aria-hidden />

      <Sheet open={mechOpen} onClose={() => setMechOpen(false)} title="كيف يتم الحجز؟" eyebrow="قبل أن تبدأ" labelledBy="mech-title">
        <Mechanism text={mechanism} unit={unit} documents={documents} onContinue={ackMechanism} />
      </Sheet>
      <Sheet open={formOpen} onClose={() => setFormOpen(false)} title="بيانات الحجز" eyebrow="الخطوة 1 من 3" labelledBy="form-title">
        {slot && day && (
          <BookingForm unit={unit} slot={slot} day={day} nights={isHotel ? nights : 1} currency={currency} estimate={estimate} formStamp={formStamp}
            onDone={(token) => { saveMyBooking({ token, unit: unit.name, date: day, at: Date.now() }); router.push(`/booking/${token}`); }}
            onTaken={() => { setFormOpen(false); pickDay(day); loadMonth(month); }} />
        )}
      </Sheet>
    </aside>
  );
}

function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <button type="button" className="btn btn-icon btn-outline" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="إنقاص"><Icon name="minus" size={18} /></button>
      <output className="num" style={{ minWidth: 32, textAlign: "center", fontFamily: "var(--f-head)", fontWeight: 700, fontSize: 18 }} aria-live="polite">{value}</output>
      <button type="button" className="btn btn-icon btn-outline" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="زيادة"><Icon name="plus" size={18} /></button>
    </div>
  );
}

function Mechanism({ text, unit, documents, onContinue }: { text: string; unit: UnitInfo; documents: string; onContinue: () => void }) {
  const steps = [
    ["اختر الوقت وأدخل بياناتك", "نحجزه باسمك 30 دقيقة."],
    ["ادفع عبر شام كاش", "المبلغ كاملًا لحساب الفرع."],
    ["ارفع الإشعار", "صورة أو PDF مع رقم العملية."],
    ["نؤكد عبر واتساب", "بعد مراجعة الفرع للدفعة."],
  ];
  return (
    <div className="flex flex-col gap-3">
      <ol className="grid grid-cols-2 gap-2.5" style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {steps.map(([t, d], i) => (
          <li key={t} className="flex flex-col gap-1.5" style={{ padding: 14, borderRadius: 18, background: i === 3 ? "var(--forest-deep)" : "#fff", color: i === 3 ? "#F7F3EC" : undefined }}>
            <span className="num" style={{ fontFamily: "var(--f-head)", fontWeight: 700, fontSize: 22, color: i === 3 ? "var(--sand)" : "var(--accent)" }}>0{i + 1}</span>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{t}</span>
            <span style={{ fontSize: 13, lineHeight: 1.6, color: i === 3 ? "#C8D1CB" : "var(--stone)" }}>{d}</span>
          </li>
        ))}
      </ol>
      <div className="flex items-center gap-3 card" style={{ padding: "12px 14px", borderRadius: 18 }}>
        <Icon name="clock" size={22} stroke="var(--teal)" />
        <span style={{ fontSize: 14 }}>أوقات المراجعة في فرع {unit.branch}: <strong className="num" dir="ltr">{unit.reviewStart} – {unit.reviewEnd}</strong></span>
      </div>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.8 }}>{text}</p>
      <div style={{ padding: "12px 14px", borderRadius: 18, background: "#FBF1E6", border: "1px solid #F0D9C3", fontSize: 14, lineHeight: 1.8 }}>
        <strong style={{ color: "var(--ember)" }}>ملاحظة: </strong>{documents} الحجز غير قابل للإلغاء أو الاسترداد بعد تثبيته.
      </div>
      <button type="button" className="btn btn-cta btn-block" onClick={onContinue} data-fx="ripple">فهمت، تابع</button>
    </div>
  );
}

function BookingForm({ unit, slot, day, nights, currency, estimate, formStamp, onDone, onTaken }: {
  unit: UnitInfo; slot: Slot; day: string; nights: number; currency: string; estimate: number; formStamp: string;
  onDone: (token: string) => void; onTaken: () => void;
}) {
  const [category, setCategory] = useState<"Family" | "Youth">("Family");
  const [persons, setPersons] = useState(Math.min(2, unit.capacity));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ message: string; field?: string } | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/bookings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId: unit.id, slotId: slot.slotId, date: day, nights, name: f.get("name"), phone: f.get("phone"), category, persons, notes: f.get("notes"), website: f.get("website"), fs: formStamp }),
      });
      if (!r.ok) {
        const p = await problemMessage(r);
        if (p.code === "slot_taken") { setErr(p); setTimeout(onTaken, 1800); return; }
        setErr(p); return;
      }
      const j = await r.json();
      if (!j.token) { setErr({ message: "تعذّر إتمام الطلب، تواصل معنا عبر واتساب" }); return; }
      onDone(j.token);
    } catch { setErr({ message: "تعذّر الاتصال. تحقق من الإنترنت وحاول مجددًا" }); }
    finally { setBusy(false); }
  };
  const fe = (field: string) => (err?.field === field ? err.message : null);

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div className="flex items-center justify-between gap-3" style={{ padding: "14px 16px", borderRadius: 20, background: "var(--forest-deep)", color: "#fff" }}>
        <div className="flex flex-col">
          <span style={{ fontWeight: 600 }}>{unit.name} · {slot.name}</span>
          <span className="num" style={{ fontSize: 13, color: "#C8D1CB" }}>{dayLabel(day)} · <span dir="ltr">{hhmm(slot.start)} – {hhmm(slot.end)}</span>{nights > 1 ? ` · ${nights} ليالٍ` : ""}</span>
        </div>
        <span className="num" style={{ fontFamily: "var(--f-head)", fontWeight: 700, fontSize: 22, color: "var(--sand)" }}>{money(estimate, currency)}</span>
      </div>
      <div className="field">
        <label className="label" htmlFor="bf-name">الاسم الكامل</label>
        <input id="bf-name" name="name" className="input" required minLength={2} maxLength={80} autoComplete="name" aria-invalid={!!fe("name")} />
        {fe("name") && <span className="field-error">{fe("name")}</span>}
      </div>
      <div className="field">
        <label className="label" htmlFor="bf-phone">رقم الواتساب</label>
        <input id="bf-phone" name="phone" className="input num" required inputMode="tel" dir="ltr" placeholder="09xx xxx xxx" autoComplete="tel" aria-invalid={!!fe("phone")} style={{ textAlign: "right" }} />
        {fe("phone") ? <span className="field-error">{fe("phone")}</span> : <span className="hint">نرسل لك التأكيد على هذا الرقم</span>}
      </div>
      <div className="field">
        <span className="label" id="bf-cat">نوع الحجز</span>
        <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-labelledby="bf-cat">
          {(unit.familyOnly ? (["Family"] as const) : (["Family", "Youth"] as const)).map((c) => (
            <button key={c} type="button" role="radio" aria-checked={category === c} onClick={() => setCategory(c)} className="slot-card justify-center" style={{ minHeight: 64 }} aria-pressed={category === c}>
              <span style={{ fontFamily: "var(--f-head)", fontWeight: 600 }}>{c === "Family" ? "عائلي" : "شبابي"}</span>
            </button>
          ))}
        </div>
        {unit.familyOnly && <span className="hint">هذه الوحدة مخصصة للعائلات فقط</span>}
        {fe("category") && <span className="field-error">{fe("category")}</span>}
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="label">عدد الأشخاص <span className="muted" style={{ fontWeight: 400 }}>(حتى {unit.capacity})</span></span>
        <Stepper value={persons} min={1} max={unit.capacity} onChange={setPersons} label="عدد الأشخاص" />
      </div>
      {fe("persons") && <span className="field-error">{fe("persons")}</span>}
      <div className="field">
        <label className="label" htmlFor="bf-notes">ملاحظات <span className="muted" style={{ fontWeight: 400 }}>(اختياري)</span></label>
        <textarea id="bf-notes" name="notes" className="textarea" maxLength={500} />
      </div>
      <div className="hp-field" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      {err && !err.field && <div role="alert" className="field-error" style={{ padding: "10px 14px", borderRadius: 14, background: "#F8DEDB" }}>{err.message}</div>}
      <button type="submit" className="btn btn-cta btn-block" disabled={busy} data-fx="ripple">{busy ? "جاري الحجز…" : "احجز الوقت 30 دقيقة وتابع للدفع"}</button>
    </form>
  );
}

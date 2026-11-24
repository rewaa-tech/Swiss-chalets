"use client";
import { useState } from "react";
import ActionForm, { FieldError, FormError, Submit, type ActionState } from "./ActionForm";
import Icon from "../Icon";
import { hhmm } from "../booking/client-utils";

interface Slot { slotId: number; name: string; kind: string; start: string; end: string; price: number; available: boolean }
type Act = (p: ActionState | null, fd: FormData) => Promise<ActionState>;

export default function ManualBooking({ units, action, today }: { units: { id: number; name: string; capacity: number; allowed_category: string }[]; action: Act; today: string }) {
  const [unitId, setUnitId] = useState<number>(units[0]?.id ?? 0);
  const [date, setDate] = useState(today);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slotId, setSlotId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ id: number; whatsapp: string } | null>(null);
  const unit = units.find((u) => u.id === unitId);
  const slot = slots?.find((s) => s.slotId === slotId);

  const load = async (uid = unitId, d = date) => {
    setLoading(true); setSlotId(null);
    try { const r = await fetch(`/api/units/${uid}/slots?date=${d}`); setSlots(r.ok ? await r.json() : []); } finally { setLoading(false); }
  };

  if (done) return (
    <div className="admin-card flex flex-col gap-3 items-start" style={{ background: "#E6F3EA" }}>
      <strong style={{ fontFamily: "var(--f-head)", fontSize: 18 }}>تم إنشاء الحجز #{done.id} وتثبيته</strong>
      <div className="flex flex-wrap gap-2">
        <a href={done.whatsapp} target="_blank" rel="noopener noreferrer" className="btn btn-wa"><Icon name="wa" size={20} />أرسل التأكيد عبر واتساب</a>
        <a href={`/branch/bookings/${done.id}`} className="btn btn-outline">عرض الحجز</a>
        <button type="button" className="btn btn-dark" onClick={() => { setDone(null); load(); }}>حجز يدوي آخر</button>
      </div>
    </div>
  );

  return (
    <ActionForm action={action} className="grid gap-5 lg:grid-cols-2" onDone={(s) => s.ok && setDone(s.data as { id: number; whatsapp: string })}>
      <div className="admin-card flex flex-col gap-4">
        <h2 style={{ fontSize: 17 }}>1 · الوحدة والموعد</h2>
        <div className="field"><label className="label" htmlFor="m-unit">الوحدة</label>
          <select id="m-unit" name="unitId" className="select" value={unitId} onChange={(e) => { const v = Number(e.target.value); setUnitId(v); setSlots(null); }}>{units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
        <div className="flex gap-2 items-end">
          <div className="field flex-1"><label className="label" htmlFor="m-date">اليوم</label><input id="m-date" type="date" name="date" className="input" value={date} min={today} onChange={(e) => { setDate(e.target.value); setSlots(null); }} /></div>
          <button type="button" className="btn btn-dark" style={{ minHeight: 50 }} onClick={() => load()}>عرض الفترات</button>
        </div>
        {loading && <span className="skeleton" style={{ height: 64 }} />}
        {slots && !slots.length && <p className="muted" style={{ margin: 0 }}>لا توجد فترات بهذا اليوم (تأكد من فتح اليوم والموسم والنمط).</p>}
        <div className="flex flex-col gap-2">
          {slots?.map((s) => (
            <button key={s.slotId} type="button" className="slot-card" disabled={!s.available} aria-pressed={slotId === s.slotId} onClick={() => setSlotId(s.slotId)}>
              <span className="flex flex-col"><span style={{ fontWeight: 600 }}>{s.name}</span><span className="num" dir="ltr" style={{ fontSize: 13, textAlign: "right" }}>{hhmm(s.start)} – {hhmm(s.end)}</span></span>
              <span className="num" style={{ fontWeight: 700 }}>{s.available ? `$${s.price}` : "محجوز"}</span>
            </button>
          ))}
        </div>
        <input type="hidden" name="slotId" value={slotId ?? ""} />
        <FieldError name="slot" />
        {slot?.kind === "HotelNight" && <div className="field"><label className="label" htmlFor="m-n">عدد الليالي</label><input id="m-n" type="number" name="nights" min={1} max={14} defaultValue={1} className="input" /><FieldError name="nights" /></div>}
      </div>
      <div className="admin-card flex flex-col gap-4">
        <h2 style={{ fontSize: 17 }}>2 · بيانات الزبون</h2>
        <div className="field"><label className="label" htmlFor="m-name">الاسم</label><input id="m-name" name="name" className="input" /><FieldError name="name" /></div>
        <div className="field"><label className="label" htmlFor="m-phone">رقم الواتساب</label><input id="m-phone" name="phone" className="input num" dir="ltr" inputMode="tel" placeholder="09xxxxxxxx" style={{ textAlign: "right" }} /><FieldError name="phone" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="field"><label className="label" htmlFor="m-cat">الفئة</label><select id="m-cat" name="category" className="select"><option value="Family">عائلي</option>{unit?.allowed_category !== "FamilyOnly" && <option value="Youth">شبابي</option>}</select><FieldError name="category" /></div>
          <div className="field"><label className="label" htmlFor="m-p">عدد الأشخاص</label><input id="m-p" type="number" name="persons" min={1} max={unit?.capacity} defaultValue={2} className="input" /><FieldError name="persons" /></div>
        </div>
        <div className="field"><label className="label" htmlFor="m-notes">ملاحظة</label><textarea id="m-notes" name="notes" className="textarea" maxLength={500} /></div>
        <details><summary style={{ cursor: "pointer", fontWeight: 600 }}>إشعار الدفع (اختياري)</summary>
          <div className="flex flex-col gap-3" style={{ marginTop: 10 }}>
            <div className="field"><label className="label" htmlFor="m-txn">رقم العملية</label><input id="m-txn" name="transactionNumber" className="input num" dir="ltr" /><FieldError name="transactionNumber" /></div>
            <div className="field"><label className="label" htmlFor="m-file">ملف الإشعار (صورة أو PDF)</label><input id="m-file" type="file" name="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="input" /><FieldError name="file" /></div>
          </div>
        </details>
        <FormError />
        <Submit className="btn btn-cta btn-block" pendingText="جاري الإنشاء…">إنشاء حجز مثبّت</Submit>
      </div>
    </ActionForm>
  );
}

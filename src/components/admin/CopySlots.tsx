"use client";
import { useState } from "react";
import ActionForm, { Submit, type ActionState } from "./ActionForm";
type Act = (p: ActionState | null, fd: FormData) => Promise<ActionState>;
interface P { name: string; kind: string; season: string; start: string; hours: number; price: number }
const SEASON: Record<string, string> = { Summer: "الصيف", Winter: "الشتاء", Spring: "الربيع", Autumn: "الخريف" };

export default function CopySlots({ units, toUnit, action }: { units: { id: number; name: string }[]; toUnit: number; action: Act }) {
  const [preview, setPreview] = useState<P[] | null>(null);
  const [from, setFrom] = useState<number>(units.find((u) => u.id !== toUnit)?.id ?? 0);
  if (units.length < 2) return null;
  return (
    <ActionForm action={action} className="flex flex-col gap-3" onDone={(s) => { const d = s.data as { preview: boolean; slots: P[] } | undefined; if (s.ok && d) setPreview(d.preview ? d.slots : null); }}>
      <input type="hidden" name="toUnit" value={toUnit} />
      <div className="flex gap-2 items-end flex-wrap">
        <div className="field flex-1"><label className="label" htmlFor="cp-from">نسخ الفترات من وحدة</label>
          <select id="cp-from" name="fromUnit" className="select" value={from} onChange={(e) => { setFrom(Number(e.target.value)); setPreview(null); }}>{units.filter((u) => u.id !== toUnit).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
        <Submit className="btn btn-outline" name="step" value="preview" pendingText="…">معاينة</Submit>
      </div>
      {preview && (
        <div className="flex flex-col gap-2" style={{ padding: 12, borderRadius: 14, background: "var(--line-soft)" }}>
          {preview.length ? <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 14 }}>{preview.map((p, i) => <li key={i}>{SEASON[p.season]} · {p.name} · <span className="num" dir="ltr">{p.start}</span> · {p.hours} ساعة · ${p.price}</li>)}</ul> : <span className="muted">لا توجد فترات مفعلة بالوحدة المصدر</span>}
          {preview.length > 0 && <Submit className="btn btn-dark btn-sm self-start" name="step" value="execute">تنفيذ النسخ ({preview.length})</Submit>}
        </div>
      )}
    </ActionForm>
  );
}

"use client";
import { useState } from "react";
import SeasonFx from "../SeasonFx";
import type { Theme } from "@/lib/services/theme";

const MONTHS = ["كانون الثاني", "شباط", "آذار", "نيسان", "أيار", "حزيران", "تموز", "آب", "أيلول", "تشرين الأول", "تشرين الثاني", "كانون الأول"];
const MODES: [string, string][] = [["Auto", "تلقائي حسب الموسم"], ["Winter", "شتاء دائمًا"], ["Summer", "صيف دائمًا"], ["Neutral", "محايد دائمًا"]];
const BADGE: Record<Theme, string> = { winter: "شتاء دافئ · مسابح مدفأة", summer: "صيف منعش · مسبحك الخاص", neutral: "مسابح خاصة · صيفًا وشتاءً" };

export default function ThemePicker({ mode, winter, summer, current }: { mode: string; winter: number[]; summer: number[]; current: Theme }) {
  const [m, setM] = useState(mode);
  const [w, setW] = useState(new Set(winter));
  const [s, setS] = useState(new Set(summer));
  const highlighted: Theme | null = m === "Winter" ? "winter" : m === "Summer" ? "summer" : m === "Neutral" ? "neutral" : current;
  const toggle = (set: Set<number>, fn: (x: Set<number>) => void, v: number) => { const n = new Set(set); if (n.has(v)) n.delete(v); else n.add(v); fn(n); };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="وضع الثيم">
        {MODES.map(([k, l]) => (
          <label key={k} className="chip" style={{ cursor: "pointer", minHeight: 42, background: m === k ? "var(--forest-deep)" : "var(--line-soft)", color: m === k ? "#fff" : "var(--forest)" }}>
            <input type="radio" name="theme_mode" value={k} checked={m === k} onChange={() => setM(k)} className="sr-only" />{l}
          </label>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-3" aria-label="معاينة حية للثيمات">
        {(["winter", "summer", "neutral"] as Theme[]).map((t) => (
          <div key={t} data-theme={t} className="relative overflow-hidden" style={{ height: 190, borderRadius: 20, isolation: "isolate", outline: highlighted === t ? "3px solid var(--sand)" : "none", outlineOffset: 2 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/hero/chalet-pool-dusk-480.webp" alt="" className="absolute inset-0 w-full h-full object-cover" style={{ zIndex: -3 }} />
            <SeasonFx theme={t} />
            <div className="absolute inset-0" style={{ zIndex: -1, background: "linear-gradient(90deg, rgba(10,22,16,.1), rgba(10,22,16,.8))" }} />
            <div className="relative flex flex-col gap-2 items-start" style={{ padding: 14, color: "#fff" }}>
              <span className="chip chip-glass" style={{ fontSize: 11, padding: "4px 10px" }}>{BADGE[t]}</span>
              <strong style={{ fontFamily: "var(--f-head)", color: "#fff" }}>{t === "winter" ? "الشتاء" : t === "summer" ? "الصيف" : "المحايد"}</strong>
              <span className="btn btn-cta btn-sm" style={{ minHeight: 38, fontSize: 13 }}>احجز إقامتك الآن</span>
            </div>
            {highlighted === t && <span className="badge absolute" style={{ bottom: 10, left: 10, background: "var(--sand)", color: "var(--night)" }}>{m === "Auto" ? "الحالي" : "المختار"}</span>}
          </div>
        ))}
      </div>
      <fieldset style={{ border: 0, padding: 0, margin: 0, opacity: m === "Auto" ? 1 : 0.5 }} disabled={m !== "Auto"}>
        <legend className="label" style={{ marginBottom: 8 }}>أشهر الثيم للرئيسية والصفحات العامة (في الوضع التلقائي)</legend>
        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}>
          {MONTHS.map((name, i) => {
            const v = i + 1;
            const st = w.has(v) ? "w" : s.has(v) ? "s" : "";
            return (
              <div key={v} className="flex flex-col gap-1" style={{ padding: 8, borderRadius: 12, background: st === "w" ? "#F8E8DC" : st === "s" ? "#E2F4F2" : "var(--line-soft)", fontSize: 13 }}>
                <strong>{name}</strong>
                <label className="flex items-center gap-1.5"><input type="checkbox" name="winter" value={v} checked={w.has(v)} onChange={() => { toggle(w, setW, v); if (s.has(v)) toggle(s, setS, v); }} />شتاء</label>
                <label className="flex items-center gap-1.5"><input type="checkbox" name="summer" value={v} checked={s.has(v)} onChange={() => { toggle(s, setS, v); if (w.has(v)) toggle(w, setW, v); }} />صيف</label>
              </div>
            );
          })}
        </div>
      </fieldset>
      {m !== "Auto" && <>{[...w].map((v) => <input key={`w${v}`} type="hidden" name="winter" value={v} />)}{[...s].map((v) => <input key={`s${v}`} type="hidden" name="summer" value={v} />)}</>}
    </div>
  );
}

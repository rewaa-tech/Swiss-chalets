"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ActionForm, { Submit, type ActionState } from "./ActionForm";

type Act = (p: ActionState | null, fd: FormData) => Promise<ActionState>;
interface Cell { open: boolean; bookings: { id: number; status: string; name: string }[] }

export default function OpsCalendar({ units, days, cells, action, month, prev, next, today }: {
  units: { id: number; name: string }[]; days: string[]; cells: Record<string, Cell>; action: Act; month: string; prev: string; next: string; today: string;
}) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const drag = useRef<{ u: number; d: number } | null>(null);
  const [anchor, setAnchor] = useState<{ u: number; d: number } | null>(null);
  const [cur, setCur] = useState<{ u: number; d: number } | null>(null);

  const rect = useMemo(() => {
    if (!anchor || !cur) return null;
    return { u0: Math.min(anchor.u, cur.u), u1: Math.max(anchor.u, cur.u), d0: Math.min(anchor.d, cur.d), d1: Math.max(anchor.d, cur.d) };
  }, [anchor, cur]);

  useEffect(() => {
    const up = () => {
      if (!drag.current || !rect) { drag.current = null; return; }
      const s = new Set(sel);
      for (let u = rect.u0; u <= rect.u1; u++) for (let d = rect.d0; d <= rect.d1; d++) {
        if (days[d] < today) continue;
        const k = `${units[u].id}|${days[d]}`;
        if (s.has(k)) s.delete(k); else s.add(k);
      }
      setSel(s); drag.current = null; setAnchor(null); setCur(null);
    };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, [rect, sel, days, units, today]);

  const selectedUnits = [...new Set([...sel].map((k) => k.split("|")[0]))];
  const selectedDays = [...new Set([...sel].map((k) => k.split("|")[1]))];
  const inRect = (u: number, d: number) => rect && u >= rect.u0 && u <= rect.u1 && d >= rect.d0 && d <= rect.d1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Link href={`?month=${prev}`} className="btn btn-sm btn-outline">الشهر السابق</Link>
          <strong className="num" style={{ fontFamily: "var(--f-head)" }}>{month}</strong>
          <Link href={`?month=${next}`} className="btn btn-sm btn-outline">الشهر التالي</Link>
        </div>
        <div className="flex gap-3 muted flex-wrap" style={{ fontSize: 12 }}>
          <Legend c="#fff" b="1px solid var(--line)" l="مفتوح" /><Legend c="var(--cal-off)" l="مغلق" /><Legend c="var(--cal-partial)" l="فيه حجز" /><Legend c="#DDEFE3" l="مثبّت" /><Legend c="var(--forest-deep)" l="محدد" />
        </div>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>اسحب على الخلايا لتحديد عدة أيام ووحدات، ثم اختر فتح أو إغلاق.</p>
      <div style={{ overflowX: "auto", userSelect: "none", touchAction: "pan-x pan-y" }} className="admin-card">
        <table style={{ borderCollapse: "separate", borderSpacing: 3, fontSize: 12 }}>
          <thead><tr><th style={{ position: "sticky", right: 0, background: "#fff", zIndex: 1, textAlign: "start", padding: "0 8px", minWidth: 100 }}>الوحدة</th>
            {days.map((d) => <th key={d} className="num" style={{ minWidth: 26, color: d === today ? "var(--ember)" : "var(--stone)", fontWeight: 600 }}>{Number(d.slice(8))}</th>)}</tr></thead>
          <tbody>
            {units.map((u, ui) => (
              <tr key={u.id}>
                <th style={{ position: "sticky", right: 0, background: "#fff", zIndex: 1, textAlign: "start", padding: "0 8px", fontWeight: 600, whiteSpace: "nowrap" }}>{u.name}</th>
                {days.map((d, di) => {
                  const c = cells[`${u.id}|${d}`];
                  const k = `${u.id}|${d}`;
                  const past = d < today;
                  const confirmed = c?.bookings.some((b) => b.status === "Confirmed" || b.status === "Completed");
                  const bg = sel.has(k) || inRect(ui, di) ? "var(--forest-deep)" : confirmed ? "#DDEFE3" : c?.bookings.length ? "var(--cal-partial)" : c?.open ? "#fff" : "var(--cal-off)";
                  return (
                    <td key={d} data-cell={k}
                      onPointerDown={(e) => { if (past) return; e.preventDefault(); drag.current = { u: ui, d: di }; setAnchor({ u: ui, d: di }); setCur({ u: ui, d: di }); }}
                      onPointerEnter={() => drag.current && setCur({ u: ui, d: di })}
                      title={c?.bookings.map((b) => `#${b.id} ${b.name}`).join("، ") || (c?.open ? "مفتوح" : "مغلق")}
                      style={{ width: 26, height: 34, borderRadius: 7, background: bg, border: c?.open || sel.has(k) ? "1px solid var(--line)" : "1px solid transparent", opacity: past ? 0.45 : 1, cursor: past ? "default" : "pointer", textAlign: "center", color: sel.has(k) ? "#fff" : "var(--stone)" }}>
                      {c?.bookings.length ? "●" : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ActionForm action={action} onDone={(s) => s.ok && setSel(new Set())} className="glass flex flex-wrap items-center gap-3 sticky bottom-[84px] lg:bottom-4 z-30" style={{ padding: 12, borderRadius: 20, background: "rgba(255,255,255,.92)", boxShadow: "var(--sh-float)" }}>
        <input type="hidden" name="units" value={selectedUnits.join(",")} />
        <input type="hidden" name="days" value={selectedDays.join(",")} />
        <span style={{ fontWeight: 600 }}>{sel.size ? `محدد: ${sel.size} خلية` : "لم تحدد شيئًا"}</span>
        <div className="flex gap-2 ms-auto">
          <button type="button" className="btn btn-sm btn-outline" onClick={() => setSel(new Set())} disabled={!sel.size}>مسح التحديد</button>
          <Submit className="btn btn-sm btn-success" name="open" value="1">فتح المحدد</Submit>
          <Submit className="btn btn-sm btn-dark" name="open" value="0">إغلاق المحدد</Submit>
        </div>
      </ActionForm>
    </div>
  );
}

function Legend({ c, l, b }: { c: string; l: string; b?: string }) {
  return <span className="flex items-center gap-1.5"><span style={{ width: 12, height: 12, borderRadius: 4, background: c, border: b }} />{l}</span>;
}

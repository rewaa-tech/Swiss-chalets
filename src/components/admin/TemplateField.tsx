"use client";
import { useRef, useState } from "react";
import { FieldError } from "./ActionForm";

/** Textarea with "insert variable" buttons and a live preview. */
export default function TemplateField({ name, label, initial, vars, sample, rows = 6 }: { name: string; label: string; initial: string; vars: string[]; sample: Record<string, string>; rows?: number }) {
  const [v, setV] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  const insert = (k: string) => {
    const t = ref.current!; const s = t.selectionStart ?? v.length, e = t.selectionEnd ?? v.length;
    const next = `${v.slice(0, s)}{${k}}${v.slice(e)}`;
    setV(next);
    requestAnimationFrame(() => { t.focus(); t.selectionStart = t.selectionEnd = s + k.length + 2; });
  };
  const preview = v.replace(/\{([^{}]+)\}/g, (m, k) => sample[k] ?? m);
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="field">
        <label className="label" htmlFor={`t-${name}`}>{label}</label>
        {vars.length > 0 && <div className="flex flex-wrap gap-1.5">{vars.map((k) => <button key={k} type="button" className="btn btn-sm btn-outline" style={{ minHeight: 34, padding: "0 10px", fontSize: 12 }} onClick={() => insert(k)}>+ {k}</button>)}</div>}
        <textarea id={`t-${name}`} ref={ref} name={name} className="textarea" rows={rows} value={v} onChange={(e) => setV(e.target.value)} />
        <FieldError name={name} />
      </div>
      <div className="flex flex-col gap-1.5"><span className="label">معاينة</span><div style={{ whiteSpace: "pre-wrap", padding: 14, borderRadius: 14, background: "#E7F6EC", border: "1px solid #CDE9D6", lineHeight: 1.8, fontSize: 14, minHeight: 120 }}>{preview}</div></div>
    </div>
  );
}

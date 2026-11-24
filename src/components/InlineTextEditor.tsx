"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "./Icon";
import { useTextDict } from "./Texts";
import { TEXTS, isTextKey, type TextDef, type TextKey } from "@/lib/texts/registry";
import { toast } from "@/fx/toast";

interface Edit { key: TextKey; rect: DOMRect }

/**
 * v3 §5.3 "التعديل المباشر": editors see a floating switch on public pages. When on, every
 * text with data-tk is outlined; clicking one opens a small editor right there.
 */
export default function InlineTextEditor({ branchScope, scopeLabel }: { branchScope: boolean; scopeLabel: string }) {
  const dict = useTextDict();
  const router = useRouter();
  const [on, setOn] = useState(false);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const editable = useCallback((k: string): k is TextKey => isTextKey(k) && !(branchScope && (TEXTS[k] as TextDef).branch === false), [branchScope]);

  useEffect(() => {
    document.documentElement.classList.toggle("tk-editing", on);
    if (!on) { setEdit(null); return; }
    document.querySelectorAll<HTMLElement>("[data-tk]").forEach((el) => el.classList.toggle("tk-locked", !editable(el.dataset.tk!)));
    const click = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-tk]");
      if (!el || box.current?.contains(e.target as Node)) return;
      e.preventDefault(); e.stopPropagation();
      const k = el.dataset.tk!;
      if (!editable(k)) { toast("هذا النص عام للموقع كله، يعدّله المدير العام فقط", "err"); return; }
      setEdit({ key: k, rect: el.getBoundingClientRect() });
      setVal(dict[k]);
    };
    document.addEventListener("click", click, true);
    return () => document.removeEventListener("click", click, true);
  }, [on, dict, editable]);
  useEffect(() => { if (edit) setTimeout(() => area.current?.focus(), 30); }, [edit]);
  useEffect(() => {
    if (!edit) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setEdit(null);
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [edit]);

  const save = async (value: string | null) => {
    if (!edit) return;
    setBusy(true);
    try {
      const r = await fetch("/api/texts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: edit.key, value }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast(j.title || "تعذّر الحفظ", "err"); return; }
      toast(value == null ? "تم استرجاع النص الافتراضي" : "تم حفظ النص");
      setEdit(null);
      router.refresh();
    } finally { setBusy(false); }
  };

  const def = edit ? (TEXTS[edit.key] as TextDef) : null;
  const top = edit ? Math.min(window.innerHeight - 320, Math.max(12, edit.rect.bottom + 10)) : 0;
  const left = edit ? Math.min(window.innerWidth - 372, Math.max(12, edit.rect.left)) : 0;

  return (
    <>
      <button type="button" className={`tk-toggle ${on ? "is-on" : ""}`} onClick={() => setOn((v) => !v)} aria-pressed={on} data-testid="tk-toggle">
        <Icon name="edit" size={18} />{on ? "إنهاء التعديل" : "تعديل النصوص"}<span className="tk-scope">{scopeLabel}</span>
      </button>
      {edit && def && (
        <div ref={box} className="tk-pop" role="dialog" aria-label={`تعديل: ${def.label}`} style={{ top, left }}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col"><strong>{def.label}</strong><span className="tk-meta">{def.section}</span></div>
            <button type="button" className="tk-x" onClick={() => setEdit(null)} aria-label="إغلاق"><Icon name="close" size={16} /></button>
          </div>
          <textarea ref={area} value={val} onChange={(e) => setVal(e.target.value)} rows={def.long ? 4 : 2} maxLength={def.max} dir="rtl" />
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="flex gap-1 flex-wrap">{(def.vars ?? []).map((v) => <button key={v} type="button" className="tk-var" onClick={() => setVal((x) => `${x}{${v}}`)}>{`{${v}}`}</button>)}</span>
            {def.max && <span className={`tk-meta num ${val.length > def.max * 0.9 ? "warn" : ""}`}>{val.length}/{def.max}</span>}
          </div>
          {def.long && <span className="tk-meta">مسموح: **عريض** · سطر جديد · [نص](https://رابط)</span>}
          <div className="flex gap-2">
            <button type="button" className="btn btn-sm btn-cta flex-1" disabled={busy || !val.trim()} onClick={() => save(val)}>{busy ? "…" : "حفظ"}</button>
            <button type="button" className="btn btn-sm btn-outline" disabled={busy} onClick={() => save(null)} title={def.def}>الافتراضي</button>
          </div>
        </div>
      )}
    </>
  );
}

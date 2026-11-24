"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "../Icon";
import { toast } from "@/fx/toast";

export interface TextRow {
  key: string; page: string; section: string; label: string; def: string; max?: number; vars?: string[]; long?: boolean;
  locked: boolean; own: string | null; inherited: string | null; at: string | null; by: string | null;
}

/** v3 §5.3 — page tree · searchable fields · live counters · insert variables · reset · history. */
export default function TextEditor({ rows, pages, previews, scopeLabel }: { rows: TextRow[]; pages: Record<string, string>; previews: Record<string, string>; scopeLabel: string }) {
  const router = useRouter();
  const pageKeys = Object.keys(pages).filter((p) => rows.some((r) => r.page === p));
  const [page, setPage] = useState(pageKeys.includes("branch") && pageKeys[0] === "common" && rows.filter((r) => r.page === "common").length < 3 ? "branch" : pageKeys[0]);
  const [q, setQ] = useState("");
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(rows.map((r) => [r.key, r.own ?? r.inherited ?? r.def])));
  const [busy, setBusy] = useState<string | null>(null);
  const [hist, setHist] = useState<{ key: string; list: { value: string | null; created_at: string; by: string | null }[] } | null>(null);
  const [onlyChanged, setOnlyChanged] = useState(false);

  const visible = useMemo(() => {
    const s = q.trim();
    return rows.filter((r) => (s ? (r.label + r.def + (r.own ?? "") + r.key + r.section).includes(s) : r.page === page) && (!onlyChanged || r.own != null));
  }, [rows, q, page, onlyChanged]);
  const sections = useMemo(() => [...new Set(visible.map((r) => (q ? `${pages[r.page]} · ${r.section}` : r.section)))], [visible, q, pages]);
  const changedCount = (p: string) => rows.filter((r) => r.page === p && r.own != null).length;

  const save = async (r: TextRow, value: string | null) => {
    setBusy(r.key);
    try {
      const res = await fetch("/api/texts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: r.key, value }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { toast(j.title || "تعذّر الحفظ", "err"); return; }
      toast(value == null ? "تم استرجاع الافتراضي" : "تم الحفظ، وظهر فورًا بالموقع");
      if (value == null) setVals((v) => ({ ...v, [r.key]: r.inherited ?? r.def }));
      router.refresh();
    } finally { setBusy(null); }
  };
  const openHistory = async (key: string) => {
    const r = await fetch(`/api/texts?key=${encodeURIComponent(key)}`);
    setHist({ key, list: r.ok ? await r.json() : [] });
  };

  return (
    <div className="txe">
      <aside className="txe-tree" aria-label="الصفحات">
        <div className="txe-search"><Icon name="search" size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بأي كلمة…" aria-label="بحث في النصوص" /></div>
        <label className="txe-only"><input type="checkbox" checked={onlyChanged} onChange={(e) => setOnlyChanged(e.target.checked)} />المعدّلة فقط</label>
        <nav>
          {pageKeys.map((p) => (
            <button key={p} type="button" className={!q && p === page ? "is-on" : ""} onClick={() => { setQ(""); setPage(p); }}>
              <span>{pages[p]}</span>{changedCount(p) > 0 && <span className="txe-badge num">{changedCount(p)}</span>}
            </button>
          ))}
        </nav>
      </aside>

      <section className="txe-main">
        <header className="txe-head">
          <div><h2>{q ? `نتائج «${q}»` : pages[page]}</h2><span className="muted" style={{ fontSize: 13 }}>{visible.length} نصًا · التعديل يخص: {scopeLabel}</span></div>
          {!q && previews[page] && <a className="btn btn-sm btn-dark" href={previews[page]} target="_blank" rel="noopener"><Icon name="eye" size={16} />معاينة وتعديل مباشر</a>}
        </header>
        {!visible.length && <p className="muted">لا توجد نصوص مطابقة.</p>}
        {sections.map((sec) => (
          <div key={sec} className="txe-sec">
            <h3>{sec}</h3>
            {visible.filter((r) => (q ? `${pages[r.page]} · ${r.section}` : r.section) === sec).map((r) => {
              const v = vals[r.key] ?? "";
              const dirty = v !== (r.own ?? r.inherited ?? r.def);
              const over = r.max != null && v.length > r.max;
              return (
                <div key={r.key} className={`txe-field ${r.locked ? "is-locked" : ""} ${dirty ? "is-dirty" : ""}`} data-key={r.key}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <label htmlFor={`tx-${r.key}`} className="label">{r.label}
                      {r.own != null && <span className="badge txe-mod">معدّل</span>}
                      {r.own == null && r.inherited != null && <span className="badge txe-inh">من النص العام</span>}
                    </label>
                    <span className="flex gap-1.5 items-center">
                      {(r.vars ?? []).map((x) => <button key={x} type="button" className="tk-var" disabled={r.locked} onClick={() => setVals((s) => ({ ...s, [r.key]: `${s[r.key]}{${x}}` }))}>{`{${x}}`}</button>)}
                      {r.max != null && <span className={`tk-meta num ${over ? "warn" : ""}`}>{v.length}/{r.max}</span>}
                    </span>
                  </div>
                  {r.long ? <textarea id={`tx-${r.key}`} className="textarea" rows={3} value={v} disabled={r.locked} onChange={(e) => setVals((s) => ({ ...s, [r.key]: e.target.value }))} />
                    : <input id={`tx-${r.key}`} className="input" value={v} disabled={r.locked} onChange={(e) => setVals((s) => ({ ...s, [r.key]: e.target.value }))} />}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="muted" style={{ fontSize: 12 }}>{r.locked ? "نص عام للموقع كله، يعدّله المدير العام" : r.at ? `آخر تعديل: ${r.by ?? ""} · ${new Date(r.at).toLocaleString("ar-SY")}` : `الافتراضي: ${r.def.slice(0, 70)}${r.def.length > 70 ? "…" : ""}`}</span>
                    {!r.locked && (
                      <span className="flex gap-1.5">
                        <button type="button" className="btn btn-xs" onClick={() => openHistory(r.key)} title="السجل"><Icon name="clock" size={14} />السجل</button>
                        {r.own != null && <button type="button" className="btn btn-xs" disabled={busy === r.key} onClick={() => save(r, null)}>الافتراضي</button>}
                        <button type="button" className="btn btn-sm btn-cta" style={{ minHeight: 34 }} disabled={!dirty || over || !v.trim() || busy === r.key} onClick={() => save(r, v)}>{busy === r.key ? "…" : "حفظ"}</button>
                      </span>
                    )}
                  </div>
                  {hist?.key === r.key && (
                    <div className="txe-hist">
                      <div className="flex justify-between items-center"><strong>آخر التعديلات</strong><button type="button" className="tk-x" onClick={() => setHist(null)} aria-label="إغلاق"><Icon name="close" size={14} /></button></div>
                      {!hist.list.length ? <span className="muted">لا يوجد سجل بعد.</span> : hist.list.map((h, i) => (
                        <div key={i} className="txe-hrow">
                          <span className="muted" style={{ fontSize: 12 }}>{new Date(h.created_at).toLocaleString("ar-SY")} · {h.by ?? ""}</span>
                          <span>{h.value ?? "↺ استرجاع الافتراضي"}</span>
                          {h.value != null && <button type="button" className="btn btn-xs" onClick={() => { setVals((s) => ({ ...s, [r.key]: h.value! })); setHist(null); }}>استخدم هذه النسخة</button>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </section>
    </div>
  );
}

"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "../Icon";
import { toast } from "@/fx/toast";
import type { ActionState } from "./ActionForm";

type Act = (p: ActionState | null, fd: FormData) => Promise<ActionState>;
export interface MediaItem {
  id: number; kind: "Image" | "Video"; status: "Processing" | "Ready" | "Failed"; path_base: string; caption: string | null;
  is_active: boolean; duration_seconds: number | null; color: string | null;
}
export interface CoverInfo { base: string | null; x: number; y: number; color: string | null }

interface Up { key: string; name: string; size: number; sent: number; state: "up" | "done" | "err"; error?: string; target: "album" | "cover" }

const CHUNK = 4 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm";
const mb = (n: number) => `${(n / 1048576).toFixed(n > 10485760 ? 0 : 1)}MB`;
const dur = (s: number | null) => (s == null ? "" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);
function uploadId() { const b = new Uint8Array(12); crypto.getRandomValues(b); return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join(""); }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Chunked, resumable upload: on a dropped connection it asks the server how much arrived and continues. */
async function sendFile(file: File, unitId: number, target: "album" | "cover", onProgress: (sent: number) => void) {
  const id = uploadId();
  const base = `/branch/api/media?id=${id}&unit=${unitId}`;
  let offset = 0, tries = 0;
  while (offset < file.size) {
    const chunk = file.slice(offset, offset + CHUNK);
    try {
      const r = await fetch(`${base}&offset=${offset}&total=${file.size}`, { method: "PUT", body: chunk, headers: { "Content-Type": "application/octet-stream" } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { if (r.status >= 500 && tries < 5) throw new Error("retry"); throw Object.assign(new Error(j.title || "تعذّر الرفع"), { fatal: true }); }
      offset = j.received; tries = 0; onProgress(offset);
    } catch (e) {
      if ((e as { fatal?: boolean }).fatal || ++tries > 6) throw e;
      await sleep(800 * tries);
      const s = await fetch(`/branch/api/media?id=${id}`).then((r) => r.json()).catch(() => null);
      if (s && typeof s.received === "number") { offset = s.received; onProgress(offset); }
    }
  }
  const r = await fetch(`${base}&target=${target}`, { method: "POST" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.title || "تعذّر حفظ الملف");
  return j as { message: string; kind: string };
}

export default function MediaManager({ unitId, cover, items: initial, action, canEdit }: { unitId: number; cover: CoverInfo; items: MediaItem[]; action: Act; canEdit: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [ups, setUps] = useState<Up[]>([]);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [over, setOver] = useState<"album" | "cover" | null>(null);
  const [focal, setFocal] = useState({ x: cover.x, y: cover.y });
  const [editFocal, setEditFocal] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const albumInput = useRef<HTMLInputElement>(null), coverInput = useRef<HTMLInputElement>(null);

  useEffect(() => setItems(initial), [initial]);
  useEffect(() => setFocal({ x: cover.x, y: cover.y }), [cover.x, cover.y]);
  // While a video is being transcoded, refresh until it is ready.
  useEffect(() => {
    if (!items.some((i) => i.status === "Processing")) return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [items, router]);

  const call = useCallback((fields: Record<string, string | number | (string | number)[]>) => {
    const fd = new FormData();
    fd.set("unitId", String(unitId));
    for (const [k, v] of Object.entries(fields)) Array.isArray(v) ? v.forEach((x) => fd.append(k, String(x))) : fd.set(k, String(v));
    start(async () => {
      const s = await action(null, fd);
      toast(s.message, s.ok ? "ok" : "err");
      if (s.ok) { setSel(new Set()); router.refresh(); }
    });
  }, [action, router, unitId]);

  const queue = async (files: File[], target: "album" | "cover") => {
    const list = files.filter((f) => /^(image\/(jpeg|png|webp)|video\/(mp4|quicktime|webm))$/.test(f.type) || /\.(jpe?g|png|webp|mp4|mov|webm)$/i.test(f.name));
    if (target === "cover") list.splice(1);
    if (!list.length) { toast("اختر صورًا (JPG/PNG/WebP) أو فيديو (MP4/MOV/WebM)", "err"); return; }
    const entries: Up[] = list.map((f) => ({ key: uploadId(), name: f.name, size: f.size, sent: 0, state: "up", target }));
    setUps((u) => [...entries, ...u]);
    // Three files at a time.
    let i = 0;
    const worker = async () => {
      while (i < list.length) {
        const k = i++, f = list[k], e = entries[k];
        try {
          if (f.type.startsWith("image/") && f.size > 15 * 1048576) throw new Error("حجم الصورة يجب ألا يتجاوز 15MB");
          if (f.type.startsWith("video/") && f.size > 200 * 1048576) throw new Error("حجم الفيديو يجب ألا يتجاوز 200MB");
          const r = await sendFile(f, unitId, target, (sent) => setUps((u) => u.map((x) => (x.key === e.key ? { ...x, sent } : x))));
          setUps((u) => u.map((x) => (x.key === e.key ? { ...x, sent: x.size, state: "done" } : x)));
          if (list.length === 1) toast(r.message);
        } catch (err) {
          setUps((u) => u.map((x) => (x.key === e.key ? { ...x, state: "err", error: (err as Error).message } : x)));
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    router.refresh();
    setTimeout(() => setUps((u) => u.filter((x) => x.state !== "done")), 2500);
  };

  const dropProps = (target: "album" | "cover") => ({
    onDragOver: (e: React.DragEvent) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setOver(target); } },
    onDragLeave: () => setOver(null),
    onDrop: (e: React.DragEvent) => { if (!e.dataTransfer.files.length) return; e.preventDefault(); setOver(null); void queue(Array.from(e.dataTransfer.files), target); },
  });

  // Drag-to-reorder (pointer: works with mouse and touch via HTML5 DnD on desktop; arrows on mobile).
  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= items.length) return;
    const next = [...items];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    setItems(next);
    call({ op: "reorder", ids: next.map((x) => x.id) });
  };

  const toggleSel = (id: number) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const coverSrc = cover.base ? `/media/${cover.base}-960.webp` : null;

  return (
    <div className="media-mgr flex flex-col gap-6">
      {/* ── Cover ── */}
      <section className="admin-card flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div><h2 style={{ fontSize: 18 }}>صورة الغلاف</h2><p className="muted" style={{ margin: "2px 0 0", fontSize: 13 }}>تظهر أعلى صفحة الكوخ وعلى بطاقته. منفصلة عن الألبوم.</p></div>
          {canEdit && (
            <div className="flex gap-2 flex-wrap">
              <button type="button" className="btn btn-sm btn-dark" onClick={() => coverInput.current?.click()}><Icon name="upload" size={16} />{cover.base ? "تغيير الغلاف" : "رفع صورة الغلاف"}</button>
              {cover.base && <button type="button" className={`btn btn-sm ${editFocal ? "btn-cta" : "btn-outline"}`} onClick={() => setEditFocal((v) => !v)} aria-pressed={editFocal}><Icon name="focus" size={16} />نقطة التركيز</button>}
            </div>
          )}
        </div>
        <input ref={coverInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} onChange={(e) => { void queue(Array.from(e.target.files ?? []), "cover"); e.target.value = ""; }} />
        {coverSrc ? (
          <div className={`cover-previews ${over === "cover" ? "is-over" : ""}`} {...(canEdit ? dropProps("cover") : {})}>
            <figure className="cover-frame desk" style={{ background: cover.color ?? undefined }}
              onClick={(e) => {
                if (!editFocal) return;
                const r = e.currentTarget.getBoundingClientRect();
                const x = Math.round(((e.clientX - r.left) / r.width) * 100), y = Math.round(((e.clientY - r.top) / r.height) * 100);
                setFocal({ x, y });
                call({ op: "focal", x, y });
              }}
              data-editing={editFocal || undefined}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverSrc} alt="" style={{ objectPosition: editFocal ? "50% 50%" : `${focal.x}% ${focal.y}%`, objectFit: editFocal ? "contain" : "cover" }} />
              {editFocal && <span className="focal-dot" style={{ left: `${focal.x}%`, top: `${focal.y}%` }} aria-hidden />}
              <figcaption>{editFocal ? "اضغط على أهم جزء بالصورة (الكوخ)" : "حاسوب"}</figcaption>
            </figure>
            <figure className="cover-frame mob" style={{ background: cover.color ?? undefined }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverSrc} alt="" style={{ objectPosition: `${focal.x}% ${focal.y}%` }} />
              <figcaption>موبايل</figcaption>
            </figure>
          </div>
        ) : (
          <button type="button" className={`dropzone ${over === "cover" ? "is-over" : ""}`} onClick={() => canEdit && coverInput.current?.click()} {...(canEdit ? dropProps("cover") : {})} disabled={!canEdit}>
            <span className="flex flex-col items-center gap-2"><Icon name="image" size={30} stroke="var(--ember)" /><strong>اسحب صورة الغلاف هنا أو اضغط للاختيار</strong><span className="muted" style={{ fontSize: 13 }}>صورة أفقية واضحة للكوخ · حتى 15MB</span></span>
          </button>
        )}
      </section>

      {/* ── Album ── */}
      <section className="admin-card flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div><h2 style={{ fontSize: 18 }}>الألبوم <span className="muted num" style={{ fontSize: 14, fontWeight: 400 }}>({items.length})</span></h2><p className="muted" style={{ margin: "2px 0 0", fontSize: 13 }}>صور وفيديوهات تظهر بمعرض أنيق بصفحة الكوخ. اسحب لتغيير الترتيب.</p></div>
          {sel.size > 0 && canEdit && (
            <div className="flex gap-2 items-center bulk-bar">
              <span className="num" style={{ fontSize: 13 }}>{sel.size} محدد</span>
              <button type="button" className="btn btn-sm btn-outline" onClick={() => call({ op: "hide", ids: [...sel] })} disabled={pending}><Icon name="eyeOff" size={15} />إخفاء</button>
              <button type="button" className="btn btn-sm btn-outline" onClick={() => call({ op: "show", ids: [...sel] })} disabled={pending}><Icon name="eye" size={15} />إظهار</button>
              <DeleteBtn label={`حذف ${sel.size}`} onConfirm={() => call({ op: "delete", ids: [...sel] })} />
              <button type="button" className="btn btn-sm btn-light" onClick={() => setSel(new Set())}>إلغاء</button>
            </div>
          )}
        </div>

        {canEdit && (
          <div role="button" tabIndex={0} className={`dropzone ${over === "album" ? "is-over" : ""}`} onClick={() => albumInput.current?.click()} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && albumInput.current?.click()} {...dropProps("album")}>
            <span className="flex flex-col items-center gap-2">
              <span className="flex gap-2"><Icon name="image" size={26} stroke="var(--ember)" /><Icon name="video" size={26} stroke="var(--teal)" /></span>
              <strong>اسحب الصور والفيديوهات هنا أو اضغط للاختيار</strong>
              <span className="muted" style={{ fontSize: 13 }}>صور JPG · PNG · WebP حتى 15MB — فيديو MP4 · MOV · WebM حتى 200MB ودقيقتين</span>
            </span>
          </div>
        )}
        <input ref={albumInput} type="file" multiple accept={ACCEPT} className="sr-only" tabIndex={-1} onChange={(e) => { void queue(Array.from(e.target.files ?? []), "album"); e.target.value = ""; }} />

        {ups.length > 0 && (
          <ul className="upload-list" aria-live="polite">
            {ups.map((u) => (
              <li key={u.key} className={`file-card up-${u.state}`}>
                <Icon name={/\.(mp4|mov|webm)$/i.test(u.name) ? "video" : "image"} size={22} stroke="var(--forest)" />
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <div className="flex justify-between gap-2" style={{ fontSize: 13 }}><span className="truncate" dir="auto">{u.name}</span><span className="muted num">{u.state === "err" ? "" : `${mb(u.sent)} / ${mb(u.size)}`}</span></div>
                  {u.state === "err" ? <span className="field-error">{u.error}</span>
                    : <span className="progress" aria-label="تقدم الرفع"><span style={{ transform: `scaleX(${u.size ? u.sent / u.size : 0})` }} /></span>}
                </div>
                {u.state === "done" && <Icon name="check" size={18} stroke="var(--success)" />}
                {u.state === "err" && <button type="button" className="btn btn-icon btn-light" aria-label="إزالة" onClick={() => setUps((x) => x.filter((y) => y.key !== u.key))}><Icon name="close" size={16} /></button>}
              </li>
            ))}
          </ul>
        )}

        {!items.length ? <p className="muted" style={{ margin: 0 }}>الألبوم فارغ. أضف صورًا من داخل الكوخ والمسبح والغرف، أو فيديو قصير.</p> : (
          <ul className="album-grid">
            {items.map((m, i) => (
              <li key={m.id} className={`album-item ${!m.is_active ? "is-hidden" : ""} ${sel.has(m.id) ? "is-sel" : ""} ${drag === i ? "is-drag" : ""}`}
                draggable={canEdit} onDragStart={(e) => { setDrag(i); e.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => setDrag(null)}
                onDragOver={(e) => { if (drag != null) e.preventDefault(); }} onDrop={(e) => { if (drag == null) return; e.preventDefault(); move(drag, i); setDrag(null); }}
                data-media={m.id}>
                <div className="album-thumb" style={{ background: m.color ?? "var(--forest-deep)" }}>
                  {m.path_base ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={`/media/${m.path_base}-480.webp`} alt="" loading="lazy" /> : null}
                  {m.kind === "Video" && m.status === "Ready" && <span className="vid-badge"><Icon name="play" size={12} />{dur(m.duration_seconds)}</span>}
                  {m.status === "Processing" && <span className="proc"><span className="spinner" />جارٍ المعالجة…</span>}
                  {m.status === "Failed" && <span className="proc fail">تعذّرت معالجة الفيديو</span>}
                  {!m.is_active && <span className="hidden-tag"><Icon name="eyeOff" size={13} />مخفي</span>}
                  {canEdit && <label className="sel-box" aria-label="تحديد"><input type="checkbox" checked={sel.has(m.id)} onChange={() => toggleSel(m.id)} /></label>}
                  {canEdit && <span className="drag-handle" aria-hidden><Icon name="drag" size={16} /></span>}
                </div>
                {canEdit && (
                  <div className="album-tools">
                    <Caption initial={m.caption ?? ""} onSave={(c) => call({ op: "caption", mediaId: m.id, caption: c })} />
                    <div className="flex gap-1 justify-between">
                      <span className="flex gap-1">
                        <button type="button" className="btn btn-icon btn-xs" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="تقديم"><Icon name="arrow" size={14} style={{ transform: "scaleX(-1)" }} /></button>
                        <button type="button" className="btn btn-icon btn-xs" onClick={() => move(i, i + 1)} disabled={i === items.length - 1} aria-label="تأخير"><Icon name="arrow" size={14} /></button>
                      </span>
                      <span className="flex gap-1">
                        {m.path_base && <button type="button" className="btn btn-icon btn-xs" title="اجعلها الغلاف" aria-label="اجعلها الغلاف" onClick={() => call({ op: "cover-from", mediaId: m.id })}><Icon name="star" size={14} /></button>}
                        <button type="button" className="btn btn-icon btn-xs" title={m.is_active ? "إخفاء" : "إظهار"} aria-label={m.is_active ? "إخفاء" : "إظهار"} onClick={() => call({ op: m.is_active ? "hide" : "show", mediaId: m.id })}><Icon name={m.is_active ? "eyeOff" : "eye"} size={14} /></button>
                        <DeleteBtn icon onConfirm={() => call({ op: "delete", mediaId: m.id })} />
                      </span>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Caption({ initial, onSave }: { initial: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(initial);
  useEffect(() => setV(initial), [initial]);
  return (
    <input className="caption-input" value={v} maxLength={120} placeholder="وصف (اختياري)" aria-label="وصف الصورة"
      onChange={(e) => setV(e.target.value)} onBlur={() => v !== initial && onSave(v)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }} />
  );
}

/** Two-step delete without window.confirm. */
function DeleteBtn({ onConfirm, icon = false, label = "حذف" }: { onConfirm: () => void; icon?: boolean; label?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 3000); return () => clearTimeout(t); }, [armed]);
  return armed
    ? <button type="button" className={`btn btn-danger ${icon ? "btn-xs" : "btn-sm"}`} onClick={() => { setArmed(false); onConfirm(); }}>تأكيد الحذف</button>
    : <button type="button" className={`btn ${icon ? "btn-icon btn-xs" : "btn-sm btn-outline"}`} aria-label={label} title={label} onClick={() => setArmed(true)}><Icon name="close" size={14} />{!icon && label}</button>;
}

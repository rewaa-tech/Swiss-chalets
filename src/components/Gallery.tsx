"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";

export interface GalleryItem { id: number; kind: "Image" | "Video"; base: string; w: number; h: number; caption: string | null; color: string | null; video: string | null; hd: boolean; duration: number | null }

const dur = (s: number | null) => (s == null ? "" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);
const reduce = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** v3 §3.4 — Bento grid (desktop) / swipe strip (mobile) + full-screen lightbox with swipe, keys, pinch/double-tap zoom and video. */
export default function Gallery({ items, title }: { items: GalleryItem[]; title: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const origin = useRef<HTMLElement | null>(null);
  if (!items.length) return null;
  const tiles = items.slice(0, 5);
  const more = items.length - tiles.length;
  const show = (i: number, el: HTMLElement) => { origin.current = el; setOpen(i); };
  return (
    <section className="gallery" aria-label={`صور وفيديو ${title}`}>
      <div className="gallery-head">
        <span className="overline">Gallery</span>
        <h2>الصور والفيديو</h2>
        <span className="muted num">{items.length} {items.length > 10 ? "عنصرًا" : "عناصر"}</span>
      </div>
      <ul className={`bento bento-${Math.min(tiles.length, 5)}`}>
        {tiles.map((m, i) => (
          <li key={m.id}>
            <button type="button" className="bento-tile" style={{ background: m.color ?? undefined }} onClick={(e) => show(i, e.currentTarget)} aria-label={m.caption || (m.kind === "Video" ? "تشغيل الفيديو" : `عرض الصورة ${i + 1}`)} data-fx="reveal">
              <BlurImg base={m.base} sizes={i === 0 ? "(max-width: 720px) 85vw, 50vw" : "(max-width: 720px) 85vw, 25vw"} />
              {m.kind === "Video" && <span className="play-glass" aria-hidden><Icon name="play" size={26} stroke="#fff" fill="#fff" /></span>}
              {m.kind === "Video" && m.duration != null && <span className="tile-dur num">{dur(m.duration)}</span>}
              {i === tiles.length - 1 && more > 0 && <span className="tile-more"><strong className="num">+{more}</strong>صورة وفيديو</span>}
            </button>
          </li>
        ))}
      </ul>
      {open != null && <Lightbox items={items} start={open} onClose={() => { setOpen(null); origin.current?.focus(); }} />}
    </section>
  );
}

/** Fades in once decoded; handles images that finished loading before hydration. */
function BlurImg({ base, sizes }: { base: string; sizes: string }) {
  const ref = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { if (ref.current?.complete && ref.current.naturalWidth) setLoaded(true); }, []);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={ref} src={`/media/${base}-960.webp`} srcSet={`/media/${base}-480.webp 480w, /media/${base}-960.webp 960w, /media/${base}-1600.webp 1600w`}
      sizes={sizes} alt="" loading="lazy" decoding="async" className={loaded ? "is-loaded" : undefined} onLoad={() => setLoaded(true)} />
  );
}

function Lightbox({ items, start, onClose }: { items: GalleryItem[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dx, setDx] = useState(0);
  const touch = useRef<{ x: number; y: number; t: number; dist?: number; z?: number } | null>(null);
  const lastTap = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  const m = items[i];
  const go = useCallback((d: number) => { setZoom(1); setPan({ x: 0, y: 0 }); setI((x) => (x + d + items.length) % items.length); }, [items.length]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      // RTL: the right arrow goes back, the left arrow goes forward.
      else if (e.key === "ArrowLeft") go(1);
      else if (e.key === "ArrowRight") go(-1);
      else if (e.key === "Tab") {
        const f = box.current?.querySelectorAll<HTMLElement>("button, video, [tabindex]");
        if (!f?.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", k);
    box.current?.querySelector<HTMLElement>(".lb-close")?.focus();
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [go, onClose]);

  // Preload neighbours.
  useEffect(() => {
    for (const d of [1, -1]) {
      const n = items[(i + d + items.length) % items.length];
      if (n?.kind === "Image") { const im = new Image(); im.src = `/media/${n.base}-1600.webp`; }
    }
  }, [i, items]);

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      touch.current = { x: 0, y: 0, t: Date.now(), dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z: zoom };
    } else touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const t = touch.current; if (!t) return;
    if (e.touches.length === 2 && t.dist) {
      const [a, b] = [e.touches[0], e.touches[1]];
      setZoom(Math.max(1, Math.min(4, (t.z ?? 1) * Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / t.dist)));
    } else if (zoom > 1) {
      setPan((p) => ({ x: p.x + (e.touches[0].clientX - t.x), y: p.y + (e.touches[0].clientY - t.y) }));
      touch.current = { ...t, x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else setDx(e.touches[0].clientX - t.x);
  };
  const onTouchEnd = () => {
    const t = touch.current; touch.current = null;
    if (!t || t.dist) return;
    if (zoom === 1 && Math.abs(dx) > 60) go(dx > 0 ? 1 : -1); // RTL: swipe right → next
    setDx(0);
    const now = Date.now();
    if (now - lastTap.current < 300 && m.kind === "Image") { setZoom((z) => (z > 1 ? 1 : 2.2)); setPan({ x: 0, y: 0 }); }
    lastTap.current = now;
  };

  return createPortal(
    <div ref={box} className="lightbox" role="dialog" aria-modal="true" aria-label="معرض الصور" data-reduced={reduce() || undefined}>
      <div className="lb-backdrop" style={{ background: m.color ?? undefined }} />
      <div className="lb-top">
        <span className="num lb-count">{i + 1} من {items.length}</span>
        <button type="button" className="lb-btn lb-close" onClick={onClose} aria-label="إغلاق"><Icon name="close" size={22} width={2} /></button>
      </div>
      <div className="lb-stage" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        onDoubleClick={() => { if (m.kind === "Image") { setZoom((z) => (z > 1 ? 1 : 2.2)); setPan({ x: 0, y: 0 }); } }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div key={m.id} className="lb-media" style={{ transform: `translateX(${dx}px)` }}>
          {m.kind === "Video" && m.video ? (
            <video className="lb-video" controls playsInline preload="none" poster={`/media/${m.base}-1600.webp`} controlsList="nodownload" aria-label={m.caption || "فيديو"}>
              {m.hd && <source src={`/media/${m.video.replace(/-720\.mp4$/, "-1080.mp4")}`} type="video/mp4" media="(min-width: 1100px)" />}
              <source src={`/media/${m.video}`} type="video/mp4" />
            </video>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={`/media/${m.base}-1600.webp`} srcSet={`/media/${m.base}-960.webp 960w, /media/${m.base}-1600.webp 1600w`} sizes="100vw" alt={m.caption ?? ""}
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, cursor: zoom > 1 ? "zoom-out" : "zoom-in" }} draggable={false} />
          )}
        </div>
        {items.length > 1 && <>
          <button type="button" className="lb-btn lb-prev" onClick={() => go(-1)} aria-label="السابق"><Icon name="arrow" size={22} style={{ transform: "scaleX(-1)" }} /></button>
          <button type="button" className="lb-btn lb-next" onClick={() => go(1)} aria-label="التالي"><Icon name="arrow" size={22} /></button>
        </>}
      </div>
      {m.caption && <p className="lb-caption">{m.caption}</p>}
      {items.length > 1 && (
        <div className="lb-strip" role="tablist" aria-label="المصغّرات">
          {items.map((x, k) => (
            <button key={x.id} type="button" role="tab" aria-selected={k === i} className={k === i ? "is-on" : ""} onClick={() => { setZoom(1); setI(k); }} aria-label={`العنصر ${k + 1}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/media/${x.base}-480.webp`} alt="" loading="lazy" />
              {x.kind === "Video" && <Icon name="play" size={12} stroke="#fff" fill="#fff" />}
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}

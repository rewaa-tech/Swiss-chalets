"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "./Icon";

export interface RevealItem { key: string; title: React.ReactNode; text: React.ReactNode; icon: string; image: string; alt: string }

const AUTO_MS = 5000;

/**
 * v3 §8.5-ب — "القائمة الكاشفة": hovering / tapping an item lights its icon (reveal colour),
 * draws a line under it and reveals its photo with a circular clip-path from the icon.
 * Auto-advances every 5 s until the visitor interacts. Keyboard: arrows + Enter.
 */
export default function RevealList({ items }: { items: RevealItem[] }) {
  const [active, setActive] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [origin, setOrigin] = useState({ x: 90, y: 20 });
  const [paused, setPaused] = useState(false);
  const [cycle, setCycle] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const icons = useRef<(HTMLSpanElement | null)[]>([]);
  const visible = useRef(false);
  const touch = useRef<number | null>(null);

  const go = useCallback((i: number) => {
    setActive((cur) => {
      if (i === cur) return cur;
      setPrev(cur);
      // The new photo grows out of the active icon (or the stage centre when stacked).
      const ic = icons.current[i]?.getBoundingClientRect(), st = stage.current?.getBoundingClientRect();
      if (ic && st) {
        const x = ((ic.left + ic.width / 2 - st.left) / st.width) * 100, y = ((ic.top + ic.height / 2 - st.top) / st.height) * 100;
        setOrigin({ x: Math.max(-20, Math.min(120, x)), y: Math.max(-20, Math.min(120, y)) });
      }
      return i;
    });
    setCycle((c) => c + 1);
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { visible.current = e.isIntersecting; }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => { if (visible.current && !document.hidden) go((active + 1) % items.length); else setCycle((c) => c + 1); }, AUTO_MS);
    return () => clearTimeout(t);
  }, [active, paused, cycle, go, items.length]);
  // Preload the next photo.
  useEffect(() => { const n = items[(active + 1) % items.length]; const im = new Image(); im.src = `${n.image}-960.webp`; }, [active, items]);

  const onKey = (e: React.KeyboardEvent) => {
    const d = e.key === "ArrowDown" || e.key === "ArrowLeft" ? 1 : e.key === "ArrowUp" || e.key === "ArrowRight" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (active + d + items.length) % items.length;
    go(n); setPaused(true);
    (root.current?.querySelectorAll<HTMLElement>("[role=tab]")[n])?.focus();
  };

  return (
    <div ref={root} className="reveal-list" data-paused={paused || undefined}>
      <div className="rl-items" role="tablist" aria-orientation="vertical" onKeyDown={onKey} onMouseLeave={() => setPaused(false)}>
        {items.map((it, i) => (
          <button key={it.key} type="button" role="tab" id={`rl-tab-${it.key}`} aria-selected={i === active} aria-controls="rl-stage" tabIndex={i === active ? 0 : -1}
            className={`rl-item ${i === active ? "is-on" : ""}`} data-item={it.key}
            onMouseEnter={(e) => { if (e.nativeEvent instanceof MouseEvent && window.matchMedia("(hover: hover)").matches) { setPaused(true); go(i); } }}
            onFocus={() => { setPaused(true); go(i); }} onClick={() => { setPaused(true); go(i); }}>
            <span className="rl-ico" ref={(el) => { icons.current[i] = el; }}><Icon name={it.icon} size={22} width={1.6} /></span>
            <span className="rl-body"><span className="rl-title">{it.title}</span><span className="rl-text">{it.text}</span></span>
            <span className="rl-num num">0{i + 1}</span>
            <span className="rl-line" aria-hidden />
            {i === active && !paused && <span key={cycle} className="rl-timer" aria-hidden style={{ animationDuration: `${AUTO_MS}ms` }} />}
          </button>
        ))}
      </div>
      <div ref={stage} id="rl-stage" className="rl-stage" role="tabpanel" aria-labelledby={`rl-tab-${items[active].key}`}
        onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => { if (touch.current == null) return; const dx = e.changedTouches[0].clientX - touch.current; touch.current = null; if (Math.abs(dx) > 50) { setPaused(true); go((active + (dx > 0 ? 1 : -1) + items.length) % items.length); } }}>
        {items.map((it, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={it.key} src={`${it.image}-960.webp`} srcSet={`${it.image}-480.webp 480w, ${it.image}-960.webp 960w, ${it.image}-1600.webp 1600w`} sizes="(max-width: 900px) 100vw, 45vw"
            alt={i === active ? it.alt : ""} aria-hidden={i !== active} loading="lazy" decoding="async"
            className={`rl-img ${i === active ? "is-on" : i === prev ? "is-prev" : ""}`}
            style={i === active ? ({ "--ox": `${origin.x}%`, "--oy": `${origin.y}%` } as React.CSSProperties) : undefined} />
        ))}
        <span className="rl-dots" aria-hidden>{items.map((it, i) => <span key={it.key} className={i === active ? "is-on" : ""} />)}</span>
      </div>
    </div>
  );
}

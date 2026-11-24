"use client";
import { useEffect, useRef, useState } from "react";

/** Loads the map only when it scrolls into view; a transparent link on top opens directions. */
export default function MapFrame({ src, href, label }: { src: string; href: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) { setShow(true); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setShow(true); io.disconnect(); } }, { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`map-frame ${loaded ? "is-loaded" : ""}`}>
      <div className="map-placeholder" aria-hidden><span className="map-grid" /></div>
      {show && <iframe src={src} title="خريطة موقع الفرع" loading="lazy" referrerPolicy="no-referrer-when-downgrade" tabIndex={-1} aria-hidden onLoad={() => setLoaded(true)} />}
      <span className="map-pin" aria-hidden>
        <svg viewBox="0 0 48 60" width="48" height="60"><path d="M24 58S4 36 4 22a20 20 0 0 1 40 0c0 14-20 36-20 36z" fill="#1F3D2E" stroke="#F7F3EC" strokeWidth="2.5" /><path d="M14 27 24 13l10 14" fill="none" stroke="#E3B98F" strokeWidth="2.2" strokeLinejoin="round" /><path d="M20 27l4-6 4 6z" fill="#B5532E" /></svg>
      </span>
      <a className="map-hit" href={href} target="_blank" rel="noopener noreferrer" aria-label={label} data-testid="map-link" />
    </div>
  );
}

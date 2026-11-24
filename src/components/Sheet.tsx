"use client";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";

/** data-fx="sheet": spring bottom-sheet on mobile, zoom dialog on desktop; focus trap + Esc. */
export default function Sheet({ open, onClose, title, eyebrow, children, labelledBy = "sheet-title", wide = false }: {
  open: boolean; onClose: () => void; title: string; eyebrow?: string; children: React.ReactNode; labelledBy?: string; wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current!;
    const focusables = () => Array.from(el.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((x) => !x.hasAttribute("disabled") && x.offsetParent !== null);
    (focusables()[1] ?? focusables()[0])?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      if (e.key === "Tab") {
        const f = focusables(); if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", key);
    const ov = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = ov; prev?.focus?.(); };
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="sheet-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className={`sheet${wide ? " sheet-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy} data-fx="sheet">
        <span className="grabber md:hidden" aria-hidden />
        <div className="flex items-start justify-between gap-3" style={{ marginBottom: 14 }}>
          <div className="flex flex-col gap-1">
            {eyebrow && <span className="eyebrow" style={{ fontSize: 13 }}>{eyebrow}</span>}
            <h2 id={labelledBy} style={{ fontSize: 22 }}>{title}</h2>
          </div>
          <button type="button" className="btn btn-icon btn-light" onClick={onClose} aria-label="إغلاق"><Icon name="close" size={18} width={2} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

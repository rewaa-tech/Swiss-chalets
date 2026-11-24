"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Mounts the WebGL steamed-glass effect over the hero photo of the same section.
 * Loads after the page is idle; on any failure it reports back so the static layer stays.
 */
export default function SteamGlass({ onFail }: { onFail: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true, stop: (() => void) | undefined;
    const go = async () => {
      const cv = ref.current;
      const hero = cv?.closest("section")?.querySelector<HTMLImageElement>("img.hero-img, img");
      if (!cv || !hero) return onFail();
      const img = new Image();
      img.decoding = "async";
      img.src = hero.currentSrc || hero.src;
      try { await img.decode(); } catch { return onFail(); }
      if (!alive) return;
      const { SteamGlass: Engine } = await import("@/fx/steam-glass");
      let intro = false;
      try { intro = sessionStorage.getItem("sc_steam") !== "1"; sessionStorage.setItem("sc_steam", "1"); } catch { /* private mode */ }
      const pos = getComputedStyle(hero).objectPosition.split(" ")[1];
      const posY = pos?.endsWith("%") ? parseFloat(pos) / 100 : 0.4;
      const e = new Engine(cv, { image: img, intro, posY, focusX: 0.5, glow: [0.42, 0.48], onFail });
      if (!e.start()) { e.destroy(); return onFail(); }
      setOn(true);
      stop = () => e.destroy();
    };
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    const kick = () => (w.requestIdleCallback ? w.requestIdleCallback(() => void go(), { timeout: 1500 }) : setTimeout(() => void go(), 300));
    if (document.readyState === "complete") kick(); else window.addEventListener("load", kick, { once: true });
    return () => { alive = false; stop?.(); };
  }, [onFail]);
  return <canvas ref={ref} className={`steam-canvas ${on ? "is-on" : ""}`} aria-hidden />;
}

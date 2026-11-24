"use client";
import { useCallback, useEffect, useState } from "react";
import SteamGlass from "./SteamGlass";
import type { Theme } from "@/lib/services/theme";

/** Deterministic PRNG so server and client render identical drops. */
function rng(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
}

function liteMode(): boolean {
  const n = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  return matchMedia("(prefers-reduced-motion: reduce)").matches || !!n.connection?.saveData || (n.deviceMemory !== undefined && n.deviceMemory < 4);
}

/** _SeasonFx — overlay for hero images only. ≤100 DOM nodes. */
export default function SeasonFx({ theme }: { theme: Theme }) {
  const [lite, setLite] = useState(true);
  const [gl, setGl] = useState<"try" | "off">("try");
  useEffect(() => { setLite(liteMode()); }, []);
  const fail = useCallback(() => setGl("off"), []);
  if (theme === "neutral") return null;

  if (theme === "winter") {
    const r = rng(7);
    const drops = Array.from({ length: lite ? 40 : 76 }, () => {
      const x = r() * 100, y = r() * 100, s = 3 + r() * 9;
      const inText = x > 50 && y > 20 && y < 80; // RTL text sits on the right
      return { x, y, s, o: inText ? 0.35 : 0.55 + r() * 0.4 };
    });
    const trails = lite ? [] : Array.from({ length: 5 }, () => ({ x: 4 + r() * 92, y: r() * 50, h: 40 + r() * 80, d: r() * 4 }));
    return (
      <div className={`season-fx ${lite ? "is-static" : ""} ${!lite && gl === "try" ? "has-gl" : ""}`} aria-hidden="true" data-fx-layer="winter">
        {!lite && gl === "try" && <SteamGlass onFail={fail} />}
        <div className="sfx-glow" />
        <div className="sfx-fog" />
        {drops.map((d, i) => (
          <span key={i} className="sfx-drop" style={{ left: `${d.x}%`, top: `${d.y}%`, width: d.s, height: d.s * 1.1, opacity: d.o }} />
        ))}
        {trails.map((t, i) => (
          <span key={`t${i}`} className="sfx-trail" style={{ left: `${t.x}%`, top: `${t.y}%`, height: t.h, animationDelay: `${t.d}s` }} />
        ))}
      </div>
    );
  }
  const r = rng(11);
  const bubbles = lite ? [] : Array.from({ length: 14 }, () => ({ x: r() * 100, s: 4 + r() * 10, d: r() * 7, dur: 6 + r() * 4 }));
  return (
    <div className={`season-fx ${lite ? "is-static" : ""}`} aria-hidden="true" data-fx-layer="summer">
      <div className="sfx-teal" />
      <svg className="sfx-caustic" viewBox="0 0 1560 820" preserveAspectRatio="none">
        <g fill="none" stroke="#CFFFF6" strokeWidth="2" strokeLinecap="round">
          <path d="M0 520 Q60 480 120 520 T240 520 T360 520 T480 520 T600 520 T720 520 T840 520 T960 520 T1080 520 T1200 520 T1320 520 T1440 520 T1560 520" />
          <path d="M0 580 Q80 540 160 585 T320 580 T480 590 T640 575 T800 585 T960 578 T1120 588 T1280 576 T1440 586 T1560 580" strokeWidth="1.5" />
          <path d="M0 650 Q70 615 140 655 T280 650 T420 660 T560 645 T700 655 T840 648 T980 658 T1120 646 T1260 656 T1400 648 T1560 652" strokeWidth="2.5" />
          <path d="M0 720 Q90 690 180 725 T360 720 T540 730 T720 715 T900 725 T1080 718 T1260 728 T1440 716 T1560 722" strokeWidth="1.5" />
        </g>
      </svg>
      {bubbles.map((b, i) => (
        <span key={i} className="sfx-bubble" style={{ left: `${b.x}%`, width: b.s, height: b.s, animationDelay: `${b.d}s`, animationDuration: `${b.dur}s` }} />
      ))}
    </div>
  );
}

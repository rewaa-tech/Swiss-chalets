import { reducedMotion, type Cleanup } from "./env";
/** Material-style ripple on press. */
export default function ripple(el: HTMLElement): Cleanup | void {
  if (reducedMotion()) return;
  const down = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    const s = Math.max(r.width, r.height);
    const ink = document.createElement("span");
    ink.className = "ripple-ink";
    ink.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
    if (getComputedStyle(el).position === "static") el.style.position = "relative";
    el.style.overflow = "hidden";
    el.appendChild(ink);
    setTimeout(() => ink.remove(), 650);
  };
  el.addEventListener("pointerdown", down);
  return () => el.removeEventListener("pointerdown", down);
}

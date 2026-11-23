import { finePointer, rafThrottle, type Cleanup } from "./env";
/** CTA buttons drift toward the cursor (max 6px within 60px). */
export default function magnetic(el: HTMLElement): Cleanup | void {
  if (!finePointer()) return;
  const RANGE = 60, MAX = 6;
  const move = rafThrottle((e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const dx = e.clientX - cx, dy = e.clientY - cy;
    const reachX = r.width / 2 + RANGE, reachY = r.height / 2 + RANGE;
    if (Math.abs(dx) > reachX || Math.abs(dy) > reachY) return reset();
    el.style.willChange = "transform";
    el.style.transform = `translate(${(dx / reachX) * MAX}px, ${(dy / reachY) * MAX - 2}px)`;
  });
  const reset = () => { el.style.transform = ""; el.style.willChange = ""; };
  const zone = el.parentElement ?? el;
  zone.addEventListener("pointermove", move);
  el.addEventListener("pointerleave", reset);
  return () => { zone.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", reset); reset(); };
}

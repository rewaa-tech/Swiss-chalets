import { reducedMotion, type Cleanup } from "./env";
/** Counts up to data-count when visible. */
export default function count(el: HTMLElement): Cleanup | void {
  const target = Number(el.dataset.count ?? el.textContent);
  if (!Number.isFinite(target)) return;
  const fmt = (n: number) => (Number.isInteger(target) ? Math.round(n) : n.toFixed(2)).toString();
  if (reducedMotion() || target === 0) { el.textContent = fmt(target); return; }
  el.textContent = "0";
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    const t0 = performance.now(), dur = 900;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      el.textContent = fmt(target * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  io.observe(el);
  return () => io.disconnect();
}

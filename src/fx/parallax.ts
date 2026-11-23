import { reducedMotion, rafThrottle, type Cleanup } from "./env";
/** Hero image moves at 0.15 of scroll speed; Ken Burns is a CSS class. */
export default function parallax(el: HTMLElement): Cleanup | void {
  if (reducedMotion()) return;
  el.classList.add("kenburns");
  const wrap = el.parentElement!;
  const onScroll = rafThrottle(() => {
    const r = wrap.getBoundingClientRect();
    if (r.bottom < 0) return;
    wrap.style.setProperty("--py", `${Math.round(-r.top * 0.15)}px`);
    el.style.translate = `0 ${Math.max(0, -r.top * 0.15)}px`;
  });
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  return () => window.removeEventListener("scroll", onScroll);
}

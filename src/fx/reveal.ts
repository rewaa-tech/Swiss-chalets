import { reducedMotion, type Cleanup } from "./env";
let io: IntersectionObserver | null = null;
const groups = new WeakMap<Element, number>();
/** Fade-up on scroll, 60ms stagger between siblings, 16px offset. */
export default function reveal(el: HTMLElement): Cleanup | void {
  if (reducedMotion() || !("IntersectionObserver" in window)) { el.classList.add("is-in"); return; }
  const parent = el.parentElement;
  const i = parent ? (groups.get(parent) ?? 0) : 0;
  if (parent) groups.set(parent, i + 1);
  el.style.transitionDelay = `${Math.min(i, 8) * 60}ms`;
  io ??= new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("is-in"); io!.unobserve(e.target); }
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  io.observe(el);
  return () => io?.unobserve(el);
}

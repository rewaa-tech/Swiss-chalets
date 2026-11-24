import { finePointer, reducedMotion, rafThrottle, type Cleanup } from "./env";
/** 3D tilt up to 6° with a shine that follows the cursor (--mx/--my). */
export default function tilt(el: HTMLElement): Cleanup | void {
  if (!finePointer()) return;
  const MAX = reducedMotion() ? 0 : 6;
  const move = rafThrottle((e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    el.style.setProperty("--mx", `${px * 100}%`);
    el.style.setProperty("--my", `${py * 100}%`);
    el.style.willChange = "transform";
    el.style.transform = `perspective(900px) rotateX(${(0.5 - py) * MAX}deg) rotateY(${(px - 0.5) * MAX}deg)`;
  });
  const leave = () => { el.style.transform = ""; el.style.willChange = ""; };
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerleave", leave);
  return () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", leave); };
}

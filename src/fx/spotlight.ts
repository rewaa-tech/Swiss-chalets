import { finePointer, rafThrottle, type Cleanup } from "./env";
/** Soft radial light that follows the cursor on glass cards. */
export default function spotlight(el: HTMLElement): Cleanup | void {
  if (!finePointer()) return;
  const move = rafThrottle((e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    el.style.setProperty("--sx", `${e.clientX - r.left}px`);
    el.style.setProperty("--sy", `${e.clientY - r.top}px`);
  });
  el.addEventListener("pointermove", move);
  return () => el.removeEventListener("pointermove", move);
}

export const finePointer = () => typeof matchMedia !== "undefined" && matchMedia("(hover: hover) and (pointer: fine)").matches;
export const reducedMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
/** Runs fn at most once per animation frame. */
export function rafThrottle<A extends unknown[]>(fn: (...a: A) => void) {
  let id = 0, last: A;
  return (...a: A) => { last = a; if (!id) id = requestAnimationFrame(() => { id = 0; fn(...last); }); };
}
export type Cleanup = () => void;

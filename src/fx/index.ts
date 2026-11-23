import type { Cleanup } from "./env";
import magnetic from "./magnetic";
import tilt from "./tilt";
import spotlight from "./spotlight";
import nav from "./nav";
import reveal from "./reveal";
import parallax from "./parallax";
import count from "./count";
import ripple from "./ripple";
import copy from "./copy";

/** Registry of data-fx behaviours. calendar-hover, dropzone, countdown and sheet live inside their React components. */
export const FX: Record<string, (el: HTMLElement) => Cleanup | void> = { magnetic, tilt, spotlight, nav, reveal, parallax, count, ripple, copy };

const bound = new WeakMap<HTMLElement, Set<string>>();
const cleanups = new Set<Cleanup>();

export function bindAll(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>("[data-fx]").forEach((el) => {
    const done = bound.get(el) ?? new Set<string>();
    for (const name of (el.dataset.fx ?? "").split(/\s+/)) {
      if (!name || done.has(name) || !FX[name]) continue;
      done.add(name);
      const c = FX[name](el);
      if (c) cleanups.add(c);
    }
    bound.set(el, done);
  });
}

export function unbindAll() { cleanups.forEach((c) => c()); cleanups.clear(); }

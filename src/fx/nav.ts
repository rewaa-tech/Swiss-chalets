import { rafThrottle, type Cleanup } from "./env";
/** Nav turns solid after 80px, hides when scrolling down and shows when scrolling up. */
export default function nav(el: HTMLElement): Cleanup {
  let lastY = window.scrollY;
  const onScroll = rafThrottle(() => {
    const y = window.scrollY;
    el.classList.toggle("is-solid", y > 80);
    if (y > 160 && y > lastY + 4) el.classList.add("is-hidden");
    else if (y < lastY - 4 || y < 160) el.classList.remove("is-hidden");
    lastY = y;
  });
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  el.addEventListener("focusin", () => el.classList.remove("is-hidden"));
  return () => window.removeEventListener("scroll", onScroll);
}

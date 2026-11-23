import type { Cleanup } from "./env";
import { toast } from "./toast";
/** Copies data-copy to the clipboard; icon turns into ✓ and a toast appears. */
export default function copy(el: HTMLElement): Cleanup {
  const click = async () => {
    const text = el.dataset.copy ?? "";
    try { await navigator.clipboard.writeText(text); } catch {
      const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select();
      try { document.execCommand("copy"); } catch { /* ignore */ } t.remove();
    }
    el.dataset.copied = "1";
    toast("تم النسخ");
    setTimeout(() => delete el.dataset.copied, 1600);
  };
  el.addEventListener("click", click);
  return () => el.removeEventListener("click", click);
}

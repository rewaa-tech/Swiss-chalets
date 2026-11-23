export type ToastKind = "ok" | "err";
/** Global toast bus consumed by <Toaster/>. */
export function toast(message: string, kind: ToastKind = "ok") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("sc-toast", { detail: { message, kind } }));
}

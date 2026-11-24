"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

interface T { id: number; message: string; kind: "ok" | "err" }

export default function Toaster() {
  const [items, setItems] = useState<T[]>([]);
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent).detail as Omit<T, "id">;
      const id = Date.now() + Math.random();
      setItems((x) => [...x.slice(-3), { id, ...d }]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3600);
    };
    window.addEventListener("sc-toast", on);
    return () => window.removeEventListener("sc-toast", on);
  }, []);
  // ?ok=… / ?err=… flash messages after redirects
  useEffect(() => {
    const ok = sp.get("ok"), err = sp.get("err");
    if (!ok && !err) return;
    window.dispatchEvent(new CustomEvent("sc-toast", { detail: { message: ok ?? err, kind: ok ? "ok" : "err" } }));
    const rest = new URLSearchParams(sp.toString());
    rest.delete("ok"); rest.delete("err");
    router.replace(`${path}${rest.size ? `?${rest}` : ""}`, { scroll: false });
  }, [sp, router, path]);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.kind === "err" ? "err" : ""}`}>
          <span aria-hidden>{t.kind === "err" ? "⚠" : "✓"}</span>{t.message}
        </div>
      ))}
    </div>
  );
}

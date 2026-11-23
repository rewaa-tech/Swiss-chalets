"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
/** Refreshes the status page every 30 seconds when the status changes. */
export default function StatusPoller({ token, status }: { token: string; status: string }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(async () => {
      if (document.hidden) return;
      try {
        const r = await fetch(`/api/bookings/${token}`, { cache: "no-store" });
        if (r.ok && (await r.json()).status !== status) router.refresh();
      } catch { /* offline */ }
    }, 30_000);
    return () => clearInterval(t);
  }, [token, status, router]);
  return null;
}

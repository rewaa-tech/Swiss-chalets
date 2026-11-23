"use client";
import Icon from "./Icon";
import { toast } from "@/fx/toast";

export default function ShareButton({ title }: { title: string }) {
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title, url: location.href });
      else { await navigator.clipboard.writeText(location.href); toast("تم نسخ الرابط"); }
    } catch { /* cancelled */ }
  };
  return (
    <button type="button" onClick={share} aria-label="مشاركة" className="btn btn-icon glass" style={{ background: "rgba(255,255,255,.62)" }}>
      <Icon name="share" size={20} stroke="var(--forest)" width={1.8} />
    </button>
  );
}

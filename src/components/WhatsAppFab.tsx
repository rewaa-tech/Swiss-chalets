import Icon from "./Icon";
import { waLink } from "@/lib/phone";

export default function WhatsAppFab({ phone, text }: { phone: string | null; text: string }) {
  if (!phone) return null;
  return (
    <a href={waLink(phone, text)} target="_blank" rel="noopener noreferrer" aria-label="تواصل عبر واتساب" data-fx="ripple"
      className="fixed z-30 flex items-center justify-center" style={{ left: 20, bottom: 20, width: 60, height: 60, borderRadius: 999, background: "var(--whatsapp)", boxShadow: "0 12px 28px rgba(20,42,31,.3)" }}>
      <Icon name="wa" size={30} stroke="#fff" width={1.6} />
    </a>
  );
}

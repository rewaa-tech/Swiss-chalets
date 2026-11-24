"use client";
import PdfPreview from "./PdfPreview";
export default function ProofPreview({ bookingId, kind, deleted }: { bookingId: number; kind: "Image" | "Pdf" | null; deleted?: boolean }) {
  if (deleted) return <div className="empty" style={{ padding: 20 }}>حُذف ملف الإشعار بعد انتهاء مدة الاحتفاظ</div>;
  if (!kind) return <div className="empty" style={{ padding: 20 }}>لا يوجد ملف إشعار</div>;
  const url = `/branch/proofs/${bookingId}`;
  if (kind === "Pdf") return <PdfPreview url={url} />;
  return (
    <a href={url} target="_blank" rel="noopener" className="block overflow-hidden" style={{ borderRadius: 16, border: "1px solid var(--line)", background: "#fff" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="إشعار الدفع" style={{ width: "100%", maxHeight: 420, objectFit: "contain" }} />
    </a>
  );
}

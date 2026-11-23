"use client";
import { useRef, useState } from "react";
import Sheet from "../Sheet";

/** Custom confirmation (never window.confirm). Submits the enclosing form on confirm. */
export default function ConfirmButton({ children, title, message, confirmLabel = "تأكيد", className = "btn btn-outline", danger = false, double = false, name, value, disabled }: {
  children: React.ReactNode; title: string; message: string; confirmLabel?: string; className?: string; danger?: boolean; double?: boolean; name?: string; value?: string; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [ack, setAck] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const hidden = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={btn} type="button" className={className} onClick={() => { setAck(false); setOpen(true); }} disabled={disabled}>{children}</button>
      <button ref={hidden} type="submit" name={name} value={value} hidden aria-hidden tabIndex={-1} />
      <Sheet open={open} onClose={() => setOpen(false)} title={title} labelledBy={`cf-${title.length}`}>
        <div className="flex flex-col gap-4">
          <p style={{ margin: 0, lineHeight: 1.8 }}>{message}</p>
          {double && (
            <label className="flex items-center gap-2.5" style={{ padding: 12, borderRadius: 14, background: "#F8DEDB", fontWeight: 600 }}>
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} style={{ width: 20, height: 20 }} />
              أفهم أن هذا الإجراء يحظر الرقم والجهاز
            </label>
          )}
          <div className="flex gap-2.5 justify-end">
            <button type="button" className="btn btn-outline" onClick={() => setOpen(false)}>إلغاء</button>
            <button type="button" className={`btn ${danger ? "btn-danger" : "btn-dark"}`} disabled={double && !ack}
              onClick={() => { setOpen(false); const f = btn.current?.closest("form"); if (f) f.requestSubmit(hidden.current ?? undefined); }}>{confirmLabel}</button>
          </div>
        </div>
      </Sheet>
    </>
  );
}

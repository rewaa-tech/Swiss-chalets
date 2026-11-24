"use client";
import { useState } from "react";
import ActionForm, { Submit, type ActionState } from "./ActionForm";
type Act = (p: ActionState | null, fd: FormData) => Promise<ActionState>;
export default function TelegramLink({ action, linked, configured }: { action: Act; linked: boolean; configured: boolean }) {
  const [link, setLink] = useState<string | null>(null);
  return (
    <ActionForm action={action} className="flex flex-col gap-3" onDone={(s) => { const d = s.data as { link?: string } | undefined; if (s.ok && d?.link) setLink(d.link); }}>
      <div className="flex items-center gap-2"><span className={`badge ${linked ? "b-Confirmed" : "b-Expired"}`}>{linked ? "مرتبط" : "غير مرتبط"}</span>{!configured && <span className="muted" style={{ fontSize: 13 }}>البوت غير مُعدّ على السيرفر بعد</span>}</div>
      <div className="flex flex-wrap gap-2">
        <Submit className="btn btn-sm btn-dark" name="op" value="link">{linked ? "إعادة الربط" : "ربط تيليغرام"}</Submit>
        {linked && <Submit className="btn btn-sm btn-outline" name="op" value="test">إرسال رسالة تجريبية</Submit>}
        {linked && <Submit className="btn btn-sm btn-outline" name="op" value="unlink">فصل</Submit>}
      </div>
      {link && <a href={link} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-cta self-start">افتح تيليغرام واضغط Start</a>}
    </ActionForm>
  );
}

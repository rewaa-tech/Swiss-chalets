"use client";
import { useRef, useState } from "react";
import ActionForm, { Submit, type ActionState } from "./ActionForm";
import Icon from "../Icon";

type Act = (p: ActionState | null, fd: FormData) => Promise<ActionState>;

export default function MediaUploader({ unitId, action }: { unitId: number; action: Act }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const setFromList = (list: FileList | null) => {
    if (!list) return;
    const dt = new DataTransfer();
    Array.from(list).filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type)).slice(0, 20).forEach((f) => dt.items.add(f));
    if (input.current) input.current.files = dt.files;
    setFiles(Array.from(dt.files));
  };
  return (
    <ActionForm action={action} className="flex flex-col gap-3" reset onDone={(s) => s.ok && setFiles([])}>
      <input type="hidden" name="unitId" value={unitId} />
      <div role="button" tabIndex={0} className={`dropzone ${over ? "is-over" : ""}`} data-fx="dropzone"
        onClick={() => input.current?.click()} onKeyDown={(e) => e.key === "Enter" && input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); setFromList(e.dataTransfer.files); }}>
        <span className="flex flex-col items-center gap-2"><Icon name="image" size={28} stroke="var(--ember)" /><strong>اسحب الصور هنا أو اضغط للاختيار</strong><span className="muted" style={{ fontSize: 13 }}>JPG · PNG · WebP — حتى 20 صورة، 12MB لكل صورة</span></span>
      </div>
      <input ref={input} type="file" name="files" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} onChange={(e) => setFromList(e.target.files)} />
      {files.length > 0 && <div className="flex items-center justify-between gap-2"><span className="muted">{files.length} صورة جاهزة للرفع</span><Submit className="btn btn-cta btn-sm" pendingText="جاري الرفع والمعالجة…">رفع الصور</Submit></div>}
    </ActionForm>
  );
}

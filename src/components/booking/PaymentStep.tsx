"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "../Icon";
import HeroImage from "../HeroImage";
import { countPdfPages } from "../pdfjs";
import { useTexts } from "../Texts";

interface Props {
  token: string; expired: boolean; holdExpiresAt: string; createdAt: string; image: string; wa: string | null;
  summary: { unit: string; branch: string; day: string; time: string; nights: number; total: string; syp: string | null };
  payment: { accountName: string | null; accountNumber: string | null; qr: string | null; reviewStart: string; reviewEnd: string };
}

const fmtSize = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);
const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

export default function PaymentStep(p: Props) {
  const router = useRouter();
  const { t, T } = useTexts();
  const end = new Date(p.holdExpiresAt).getTime();
  const total = Math.max(1, end - new Date(p.createdAt).getTime());
  const [now, setNow] = useState(() => Date.now());
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<number | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [err, setErr] = useState<{ message: string; field?: string; code?: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // data-fx="countdown": smooth per-second ring
  useEffect(() => { if (p.expired) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [p.expired]);
  const left = Math.max(0, end - now);
  const timeUp = p.expired || left <= 0;
  const mm = String(Math.floor(left / 60000)).padStart(2, "0"), ss = String(Math.floor((left % 60000) / 1000)).padStart(2, "0");
  const warn = left < 5 * 60000;
  const frac = left / total;

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const choose = async (f: File | undefined | null) => {
    setErr(null);
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { setErr({ message: "حجم الملف يجب أن يكون أقل من 5MB", field: "file" }); return; }
    if (!ACCEPT.split(",").includes(f.type)) { setErr({ message: "ارفع صورة (JPG/PNG/WebP) أو PDF", field: "file" }); return; }
    setFile(f); setPages(null);
    if (preview) URL.revokeObjectURL(preview);
    if (f.type === "application/pdf") {
      setPreview(null);
      setPages(await countPdfPages(f));
    } else setPreview(URL.createObjectURL(f));
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const txn = String(new FormData(e.currentTarget).get("transactionNumber") ?? "").trim();
    if (!txn) { setErr({ message: `${t("pay.txn")}؟`, field: "transactionNumber" }); return; }
    if (!file) { setErr({ message: "ارفع صورة الإشعار أو ملف PDF", field: "file" }); return; }
    const fd = new FormData(); fd.set("transactionNumber", txn); fd.set("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/bookings/${p.token}/proof`);
    xhr.upload.onprogress = (ev) => ev.lengthComputable && setProgress(Math.round((ev.loaded / ev.total) * 100));
    xhr.onload = () => {
      setProgress(null);
      if (xhr.status >= 200 && xhr.status < 300) { router.refresh(); return; }
      try { const j = JSON.parse(xhr.responseText); setErr({ message: j.title, field: j.field, code: j.code }); }
      catch { setErr({ message: xhr.status === 429 ? "طلبات كثيرة، انتظر دقيقة" : "تعذّر رفع الإشعار، حاول مجددًا" }); }
    };
    xhr.onerror = () => { setProgress(null); setErr({ message: t("form.offline") }); };
    setProgress(0); setErr(null);
    xhr.send(fd);
  };

  if (err?.code === "late_taken") {
    return (
      <div className="wrap flex flex-col items-center gap-4 text-center" style={{ maxWidth: 520, padding: "80px 0" }}>
        <span className="empty-ico" style={{ background: "#F8DEDB" }}><Icon name="alert" size={30} stroke="var(--error)" /></span>
        <h1 style={{ fontSize: 24 }}>{T("pay.taken.title")}</h1>
        <p className="muted" style={{ margin: 0 }}>{T("pay.taken.text")}</p>
        {p.wa && <a href={p.wa} className="btn btn-wa btn-block" target="_blank" rel="noopener noreferrer"><Icon name="wa" size={22} />{T("pay.taken.wa")}</a>}
      </div>
    );
  }

  const R = 22, C = 2 * Math.PI * R;
  return (
    <div className="wrap flex flex-col gap-4" style={{ maxWidth: 640, padding: "16px 0 40px" }}>
      <header className="flex items-center justify-between gap-3">
        <div className="flex flex-col"><h1 style={{ fontSize: 20 }}>{T("pay.title")}</h1><span className="muted" style={{ fontSize: 12 }}>{T("pay.step")}</span></div>
        {!p.expired && (
          <div className="card flex items-center gap-2.5" data-fx="countdown" style={{ padding: "6px 14px 6px 6px", borderRadius: 999 }} role="timer" aria-label={`الوقت المتبقي ${mm}:${ss}`} suppressHydrationWarning>
            <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden>
              <circle cx="26" cy="26" r={R} fill="none" stroke="var(--line)" strokeWidth="4" />
              <circle suppressHydrationWarning cx="26" cy="26" r={R} fill="none" stroke={warn ? "var(--warning)" : "var(--ember)"} strokeWidth="4" strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={C * (1 - frac)} transform="rotate(-90 26 26)" style={{ transition: "stroke-dashoffset 1s linear, stroke .3s" }} />
            </svg>
            <div className="flex flex-col"><span className="muted" style={{ fontSize: 11 }}>{T("pay.heldForYou")}</span><span suppressHydrationWarning className="num" dir="ltr" style={{ fontFamily: "var(--f-head)", fontWeight: 700, fontSize: 17, color: warn ? "var(--warning)" : "var(--forest-deep)" }}>{mm}:{ss}</span></div>
          </div>
        )}
      </header>
      <div style={{ height: 6, borderRadius: 999, background: "var(--line)", overflow: "hidden" }}><span style={{ display: "block", width: "66%", height: "100%", borderRadius: 999, background: "linear-gradient(90deg, var(--ember), var(--forest))" }} /></div>

      {timeUp && (
        <div role="alert" style={{ padding: "14px 16px", borderRadius: 18, background: "#FBF1E6", border: "1px solid #F0D9C3", lineHeight: 1.8 }}>
          <strong style={{ color: "var(--ember)" }}>{T("pay.timeUpTitle")}</strong> {p.expired ? T("pay.timeUpLate") : T("pay.timeUpNow")}
        </div>
      )}

      <div className="relative overflow-hidden flex items-end" style={{ borderRadius: 26, minHeight: 210 }}>
        <HeroImage base={p.image} alt="" className="absolute inset-0 w-full h-full object-cover" fx={false} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(10,22,16,0) 20%, rgba(10,22,16,.88) 100%)" }} />
        <div className="relative w-full flex items-end justify-between gap-3 text-white" style={{ padding: 18 }}>
          <div className="flex flex-col"><strong style={{ fontFamily: "var(--f-head)", fontSize: 18 }}>{p.summary.unit}</strong><span className="num" style={{ fontSize: 13, color: "#E4DDD1" }}>{p.summary.day} · <span dir="ltr">{p.summary.time}</span>{p.summary.nights > 1 ? ` · ${p.summary.nights} ليالٍ` : ""}</span></div>
          <div className="flex flex-col items-end"><span style={{ fontSize: 12, color: "#E4DDD1" }}>{T("pay.full")}</span><span className="num" style={{ fontFamily: "var(--f-head)", fontWeight: 700, fontSize: 28 }}>{p.summary.total}</span>{p.summary.syp && <span className="num" style={{ fontSize: 12, color: "#E4DDD1" }}>{p.summary.syp}</span>}</div>
        </div>
      </div>

      <section className="card flex flex-col gap-3" style={{ padding: 18, borderRadius: 24 }} aria-labelledby="sc-title">
        <div className="flex items-center justify-between"><h2 id="sc-title" style={{ fontSize: 17 }}>{T("pay.sc.title")}</h2><span className="muted" style={{ fontSize: 13 }}>{T("pay.sc.branch", { "الفرع": p.summary.branch })}</span></div>
        {p.payment.accountNumber ? (
          <div className="flex gap-4 items-center flex-wrap">
            {p.payment.qr && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.payment.qr} alt="رمز QR لحساب شام كاش" width={120} height={120} style={{ borderRadius: 16, border: "1px solid var(--line)", background: "#fff", padding: 6 }} />
            )}
            <div className="flex flex-col gap-2 flex-1" style={{ minWidth: 200 }}>
              {p.payment.accountName && <div><span className="muted" style={{ fontSize: 13 }}>{T("pay.sc.name")}</span><div style={{ fontWeight: 600 }}>{p.payment.accountName}</div></div>}
              <div className="flex items-center justify-between gap-2" style={{ padding: "10px 12px", borderRadius: 14, background: "var(--line-soft)" }}>
                <span className="num" dir="ltr" style={{ fontFamily: "var(--f-head)", fontWeight: 700, fontSize: 17, letterSpacing: ".04em", wordBreak: "break-all" }}>{p.payment.accountNumber}</span>
                <CopyBtn text={p.payment.accountNumber} label={t("pay.sc.copy")} />
              </div>
            </div>
          </div>
        ) : <p className="muted" style={{ margin: 0 }}>{T("pay.sc.missing")}</p>}
      </section>

      <form onSubmit={submit} className="card flex flex-col gap-4" style={{ padding: 18, borderRadius: 24 }} noValidate>
        <div className="field">
          <label htmlFor="txn" className="label">{T("pay.txn")}</label>
          <input id="txn" name="transactionNumber" className="input num" dir="ltr" inputMode="text" autoComplete="off" maxLength={40} placeholder="مثال: 48213977" aria-invalid={err?.field === "transactionNumber"} style={{ textAlign: "right" }} />
          {err?.field === "transactionNumber" ? <span className="field-error">{err.message}</span> : <span className="hint">{T("pay.txnHint")}</span>}
        </div>
        <div className="field">
          <span className="label" id="drop-label">{T("pay.file")}</span>
          {!file ? (
            <div role="button" tabIndex={0} aria-labelledby="drop-label" data-fx="dropzone" className={`dropzone ${over ? "is-over" : ""}`}
              onClick={() => inputRef.current?.click()} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), inputRef.current?.click())}
              onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); choose(e.dataTransfer.files[0]); }}>
              <span className="flex flex-col items-center gap-2">
                <span className="flex items-center justify-center" style={{ width: 52, height: 52, borderRadius: 16, background: "#FBF1E6" }}><Icon name="upload" size={26} stroke="var(--ember)" /></span>
                <strong style={{ color: "var(--forest-deep)" }}>{T("pay.drop")}</strong>
                <span className="muted" style={{ fontSize: 13 }}>JPG · PNG · WebP · PDF — حتى 5MB</span>
              </span>
            </div>
          ) : (
            <div className="file-card">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="معاينة الإشعار" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 12 }} />
              ) : (
                <span className="flex items-center justify-center flex-none" style={{ width: 56, height: 56, borderRadius: 12, background: "#F8DEDB", color: "var(--error)", fontWeight: 700, fontSize: 13 }}>PDF</span>
              )}
              <span className="flex flex-col flex-1" style={{ minWidth: 0 }}>
                <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} dir="auto">{file.name}</span>
                <span className="muted num" style={{ fontSize: 13 }}>{fmtSize(file.size)}{pages ? ` · ${pages} ${pages === 1 ? "صفحة" : "صفحات"}` : ""}</span>
              </span>
              <button type="button" className="btn btn-icon btn-outline" aria-label="إزالة الملف" onClick={() => { setFile(null); setPages(null); if (inputRef.current) inputRef.current.value = ""; }}><Icon name="close" size={18} /></button>
            </div>
          )}
          <input ref={inputRef} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => choose(e.target.files?.[0])} />
          {err?.field === "file" && <span className="field-error">{err.message}</span>}
          {progress !== null && (
            <div style={{ height: 6, borderRadius: 99, background: "var(--line)", overflow: "hidden" }} role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="تقدم الرفع">
              <span style={{ display: "block", height: "100%", width: `${progress}%`, background: "var(--cta)", transition: "width .2s" }} />
            </div>
          )}
        </div>
        {err && !err.field && <div role="alert" className="field-error" style={{ padding: "10px 14px", borderRadius: 14, background: "#F8DEDB" }}>{err.message}</div>}
        <button type="submit" className="btn btn-cta btn-block" disabled={progress !== null} data-fx="ripple">{progress !== null ? T("pay.sending") : timeUp ? T("pay.submitLate") : T("pay.submit")}</button>
        <p className="muted" style={{ margin: 0, fontSize: 13, textAlign: "center" }}>{T("pay.reviewHours", { "البداية": p.payment.reviewStart, "النهاية": p.payment.reviewEnd })}</p>
      </form>
    </div>
  );
}

function CopyBtn({ text, label }: { text: string; label: string }) {
  return (
    <button type="button" className="btn btn-sm btn-light" data-fx="copy" data-copy={text} aria-label="نسخ رقم الحساب">
      <Icon name="copy" size={16} /><span>{label}</span>
    </button>
  );
}

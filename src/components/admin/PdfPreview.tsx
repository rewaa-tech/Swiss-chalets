"use client";
import { useEffect, useRef, useState } from "react";
import Sheet from "../Sheet";

type PdfJs = { GlobalWorkerOptions: { workerSrc: string }; getDocument: (o: object) => { promise: Promise<PdfDoc> } };
type PdfDoc = { numPages: number; getPage: (n: number) => Promise<{ getViewport: (o: { scale: number }) => { width: number; height: number }; render: (o: object) => { promise: Promise<void> } }>; destroy: () => void };

let lib: Promise<PdfJs> | null = null;
function loadPdfJs(): Promise<PdfJs> {
  // Local copy of pdf.js (Apache-2.0) served from /lib/pdfjs — no CDN.
  lib ??= import(/* webpackIgnore: true */ /* turbopackIgnore: true */ "/lib/pdfjs/pdf.min.mjs" as string).then((m: PdfJs) => {
    m.GlobalWorkerOptions.workerSrc = "/lib/pdfjs/pdf.worker.min.mjs";
    return m;
  });
  return lib;
}

async function openDoc(url: string) {
  const pdfjs = await loadPdfJs();
  const data = await (await fetch(url, { credentials: "same-origin" })).arrayBuffer();
  return pdfjs.getDocument({ data, isEvalSupported: false, enableScripting: false, disableAutoFetch: true }).promise;
}

async function renderPage(doc: PdfDoc, n: number, canvas: HTMLCanvasElement, width: number) {
  const page = await doc.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const scale = (width / base.width) * (window.devicePixelRatio || 1);
  const vp = page.getViewport({ scale });
  canvas.width = vp.width; canvas.height = vp.height;
  canvas.style.width = "100%"; canvas.style.height = "auto";
  await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp, canvas }).promise;
}

/** First page in a <canvas>, plus a full-size viewer with all pages (no iframe/embed). */
export default function PdfPreview({ url }: { url: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [pages, setPages] = useState(0);
  const [full, setFull] = useState(false);
  useEffect(() => {
    let doc: PdfDoc | null = null, alive = true;
    setState("loading");
    openDoc(url).then(async (d) => {
      doc = d; if (!alive) return;
      setPages(d.numPages);
      await renderPage(d, 1, ref.current!, ref.current!.parentElement!.clientWidth || 400);
      if (alive) setState("ok");
    }).catch(() => alive && setState("error"));
    return () => { alive = false; doc?.destroy(); };
  }, [url]);
  return (
    <div className="flex flex-col gap-2">
      <div className="relative overflow-hidden" style={{ borderRadius: 16, background: "#fff", border: "1px solid var(--line)", minHeight: 160 }}>
        {state === "loading" && <span className="skeleton absolute inset-0" />}
        {state === "error" && <div className="empty" style={{ padding: 24 }}>تعذّر عرض الملف</div>}
        <canvas ref={ref} aria-label="الصفحة الأولى من الإشعار" />
      </div>
      <div className="flex items-center justify-between">
        <span className="muted" style={{ fontSize: 13 }}>{pages ? `${pages} ${pages === 1 ? "صفحة" : "صفحات"}` : ""}</span>
        <button type="button" className="btn btn-sm btn-outline" onClick={() => setFull(true)} disabled={state !== "ok"}>فتح بحجم كامل</button>
      </div>
      <Sheet open={full} onClose={() => setFull(false)} title="إشعار الدفع" labelledBy="pdf-full">
        <FullViewer url={url} pages={pages} />
      </Sheet>
    </div>
  );
}

function FullViewer({ url, pages }: { url: string; pages: number }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let doc: PdfDoc | null = null;
    openDoc(url).then(async (d) => {
      doc = d;
      const canvases = box.current?.querySelectorAll("canvas") ?? [];
      for (let i = 0; i < d.numPages && i < canvases.length; i++) await renderPage(d, i + 1, canvases[i] as HTMLCanvasElement, box.current!.clientWidth || 500);
    }).catch(() => {});
    return () => doc?.destroy();
  }, [url, pages]);
  return <div ref={box} className="flex flex-col gap-3">{Array.from({ length: pages }, (_, i) => <canvas key={i} style={{ borderRadius: 12, border: "1px solid var(--line)" }} aria-label={`الصفحة ${i + 1}`} />)}</div>;
}

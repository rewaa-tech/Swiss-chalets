"use client";
// Local copy of pdf.js (Apache-2.0) served from /lib/pdfjs — no CDN. Scripting and eval are disabled.
export type PdfDoc = {
  numPages: number;
  getPage: (n: number) => Promise<{ getViewport: (o: { scale: number }) => { width: number; height: number }; render: (o: object) => { promise: Promise<void> } }>;
  destroy: () => void;
};
type Task = { promise: Promise<Omit<PdfDoc, "destroy">>; destroy: () => Promise<void> };
type PdfJs = { GlobalWorkerOptions: { workerSrc: string }; getDocument: (o: object) => Task };

let lib: Promise<PdfJs> | null = null;
export function loadPdfJs(): Promise<PdfJs> {
  lib ??= import(/* webpackIgnore: true */ /* turbopackIgnore: true */ "/lib/pdfjs/pdf.min.mjs" as string).then((m: PdfJs) => {
    m.GlobalWorkerOptions.workerSrc = "/lib/pdfjs/pdf.worker.min.mjs";
    return m;
  });
  return lib;
}

export async function openPdf(data: ArrayBuffer): Promise<PdfDoc> {
  const pdfjs = await loadPdfJs();
  const task = pdfjs.getDocument({ data, isEvalSupported: false, enableScripting: false, disableAutoFetch: true });
  const doc = await task.promise;
  // In pdf.js v6 cleanup lives on the loading task.
  return Object.assign(doc, { destroy: () => { void task.destroy(); } }) as PdfDoc;
}

export async function countPdfPages(file: File): Promise<number | null> {
  try { const d = await openPdf(await file.arrayBuffer()); const n = d.numPages; d.destroy(); return n; } catch { return null; }
}

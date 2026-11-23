// Copies pdf.js (Apache-2.0) into public/lib/pdfjs so it is served locally (no CDN).
import { cpSync, mkdirSync, existsSync } from "node:fs";
const src = "node_modules/pdfjs-dist/build";
const dst = "public/lib/pdfjs";
if (existsSync(src)) {
  mkdirSync(dst, { recursive: true });
  for (const f of ["pdf.min.mjs", "pdf.worker.min.mjs"]) cpSync(`${src}/${f}`, `${dst}/${f}`);
}

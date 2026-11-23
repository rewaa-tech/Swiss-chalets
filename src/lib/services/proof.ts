import sharp from "sharp";
import { PDFDocument, PDFDict, PDFName, PDFArray, PDFStream, PDFRef, type PDFObject } from "pdf-lib";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { proofsDir } from "../paths";
import { bad } from "../errors";

export const MAX_PROOF_BYTES = 5 * 1024 * 1024;
export const MAX_PDF_PAGES = 5;
export type ProofKind = "Image" | "Pdf";
export interface ValidProof { kind: ProofKind; data: Buffer; ext: "webp" | "pdf"; pageCount: number | null; sizeBytes: number }

type Sniffed = "jpeg" | "png" | "webp" | "pdf" | null;

export function sniff(b: Buffer): Sniffed {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b.length >= 12 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP") return "webp";
  if (b.length >= 5 && b.toString("latin1", 0, 5) === "%PDF-") return "pdf";
  return null;
}

const FORBIDDEN = ["JavaScript", "JS", "Launch", "EmbeddedFile", "EmbeddedFiles", "RichMedia", "XFA"];
const RAW_FORBIDDEN = /\/(JavaScript|JS|Launch|EmbeddedFiles?|RichMedia|XFA)(?![A-Za-z0-9#])/;

function walk(obj: PDFObject | undefined, visit: (d: PDFDict) => string | null, seen = new Set<PDFObject>()): string | null {
  if (!obj || seen.has(obj)) return null;
  seen.add(obj);
  if (obj instanceof PDFStream) return walk(obj.dict, visit, seen);
  if (obj instanceof PDFDict) {
    const r = visit(obj);
    if (r) return r;
    for (const [, v] of obj.entries()) {
      if (v instanceof PDFRef) continue; // indirect objects are visited separately
      const x = walk(v, visit, seen);
      if (x) return x;
    }
  }
  if (obj instanceof PDFArray) {
    for (const v of obj.asArray()) {
      if (v instanceof PDFRef) continue;
      const x = walk(v, visit, seen);
      if (x) return x;
    }
  }
  return null;
}

export async function inspectPdf(b: Buffer): Promise<{ pages: number }> {
  const raw = b.toString("latin1");
  if (!raw.includes("%%EOF")) throw bad("ملف PDF غير مكتمل أو معطوب", "file");
  if (/\/Encrypt\b/.test(raw)) throw bad("ملف PDF محمي بكلمة مرور. صدّر الإشعار بدون حماية", "file");
  if (RAW_FORBIDDEN.test(raw)) throw bad("ملف PDF يحتوي على عناصر غير مسموحة", "file");
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(b, { ignoreEncryption: false, updateMetadata: false, throwOnInvalidObject: true });
  } catch (e) {
    if ((e as Error)?.name === "EncryptedPDFError") throw bad("ملف PDF محمي بكلمة مرور. صدّر الإشعار بدون حماية", "file");
    throw bad("تعذّر قراءة ملف PDF. تأكد إنو الملف سليم", "file");
  }
  // Deep scan of every indirect object (also covers compressed object streams and #-escaped names).
  const visit = (d: PDFDict): string | null => {
    for (const k of d.keys()) {
      const name = k.decodeText();
      if (FORBIDDEN.includes(name)) return name;
      if (name === "S") {
        const v = d.get(k);
        if (v instanceof PDFName && ["JavaScript", "Launch", "ImportData", "SubmitForm", "Rendition"].includes(v.decodeText())) return v.decodeText();
      }
    }
    return null;
  };
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    const hit = walk(obj, visit);
    if (hit) throw bad("ملف PDF يحتوي على عناصر غير مسموحة", "file");
  }
  const open = doc.catalog.get(PDFName.of("OpenAction"));
  if (open) {
    const action = open instanceof PDFRef ? doc.context.lookup(open) : open;
    if (action instanceof PDFDict) {
      const s = action.get(PDFName.of("S"));
      if (!(s instanceof PDFName) || s.decodeText() !== "GoTo") throw bad("ملف PDF يحتوي على إجراء تلقائي غير مسموح", "file");
    }
  }
  const pages = doc.getPageCount();
  if (pages < 1) throw bad("ملف PDF فارغ", "file");
  if (pages > MAX_PDF_PAGES) throw bad(`ملف PDF يجب ألا يزيد عن ${MAX_PDF_PAGES} صفحات`, "file");
  return { pages };
}

/** Validates a payment proof by its real signature (magic bytes), never by extension. */
export async function validateProof(b: Buffer): Promise<ValidProof> {
  if (!b.length) throw bad("اختر ملف الإشعار", "file");
  if (b.length > MAX_PROOF_BYTES) throw bad("حجم الملف يجب أن يكون أقل من 5MB", "file");
  const kind = sniff(b);
  if (!kind) throw bad("نوع الملف غير مدعوم. ارفع صورة (JPG/PNG/WebP) أو PDF", "file");
  if (kind === "pdf") {
    const { pages } = await inspectPdf(b);
    return { kind: "Pdf", data: b, ext: "pdf", pageCount: pages, sizeBytes: b.length };
  }
  try {
    const out = await sharp(b, { limitInputPixels: 50_000_000, failOn: "error" })
      .rotate()
      .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    return { kind: "Image", data: out, ext: "webp", pageCount: null, sizeBytes: out.length };
  } catch {
    throw bad("تعذّر قراءة الصورة. ارفع صورة سليمة", "file");
  }
}

export async function storeProof(bookingId: number, p: ValidProof, now = new Date()): Promise<string> {
  const rel = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${bookingId}.${p.ext}`;
  const full = join(proofsDir(), rel);
  await mkdir(dirname(full), { recursive: true, mode: 0o750 });
  await writeFile(full, p.data, { mode: 0o640 });
  return rel;
}

export async function removeProofFile(rel: string) {
  await unlink(join(proofsDir(), rel)).catch(() => {});
}

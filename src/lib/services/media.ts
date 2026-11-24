import sharp, { type Metadata } from "sharp";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { mediaDir } from "../paths";
import { randomHex } from "../crypto";
import { sniff } from "./proof";
import { bad } from "../errors";

export const MAX_MEDIA_BYTES = 12 * 1024 * 1024;
export const SIZES = [480, 960, 1600] as const;

async function write(rel: string, data: Buffer) {
  const full = join(mediaDir(), rel);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, data);
}

/** Re-encodes a photo to WebP in three sizes. Returns the path base (without -{w}.webp). */
export async function saveResponsiveImage(buf: Buffer, folder: string) {
  if (buf.length > MAX_MEDIA_BYTES) throw bad("حجم الصورة يجب ألا يتجاوز 12MB");
  const t = sniff(buf);
  if (t !== "jpeg" && t !== "png" && t !== "webp") throw bad("ارفع صورة JPG أو PNG أو WebP");
  let meta: Metadata;
  try { meta = await sharp(buf, { limitInputPixels: 80_000_000 }).rotate().metadata(); } catch { throw bad("تعذّر قراءة الصورة"); }
  const base = `${folder}/${randomHex(8)}`;
  for (const w of SIZES) {
    const out = await sharp(buf, { limitInputPixels: 80_000_000 }).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: w === 480 ? 72 : 80 }).toBuffer();
    await write(`${base}-${w}.webp`, out);
  }
  const rotated = (meta.orientation ?? 1) >= 5;
  return { base, width: (rotated ? meta.height : meta.width) ?? 0, height: (rotated ? meta.width : meta.height) ?? 0 };
}

export async function deleteResponsiveImage(base: string) {
  await Promise.all(SIZES.map((w) => unlink(join(mediaDir(), `${base}-${w}.webp`)).catch(() => {})));
}

/** QR codes are re-encoded as PNG (600px max) so they stay scannable. */
export async function saveQr(buf: Buffer, branchId: number) {
  const t = sniff(buf);
  if (t !== "jpeg" && t !== "png" && t !== "webp") throw bad("ارفع صورة QR بصيغة PNG أو JPG");
  if (buf.length > 5 * 1024 * 1024) throw bad("حجم الصورة كبير");
  const out = await sharp(buf).rotate().resize({ width: 600, height: 600, fit: "inside", withoutEnlargement: true }).png().toBuffer().catch(() => { throw bad("تعذّر قراءة الصورة"); });
  const rel = `qr/${branchId}-${randomHex(6)}.png`;
  await write(rel, out);
  return rel;
}

export async function deleteMediaFile(rel: string) { await unlink(join(mediaDir(), rel)).catch(() => {}); }

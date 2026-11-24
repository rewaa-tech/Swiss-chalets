import sharp, { type Metadata } from "sharp";
import { mkdir, writeFile, unlink, stat, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { mediaDir } from "../paths";
import { randomHex } from "../crypto";
import { sniff } from "./proof";
import { bad } from "../errors";

export const MAX_MEDIA_BYTES = 15 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 120;
export const SIZES = [480, 960, 1600] as const;

async function write(rel: string, data: Buffer) {
  const full = join(mediaDir(), rel);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, data);
}

/** Re-encodes a photo to WebP in three sizes. Returns the path base (without -{w}.webp). */
export async function saveResponsiveImage(buf: Buffer, folder: string) {
  if (buf.length > MAX_MEDIA_BYTES) throw bad("حجم الصورة يجب ألا يتجاوز 15MB");
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
  let color: string | null = null;
  try {
    const { dominant } = await sharp(buf).resize(64).stats();
    color = "#" + [dominant.r, dominant.g, dominant.b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  } catch { /* colour is optional */ }
  return { base, width: (rotated ? meta.height : meta.width) ?? 0, height: (rotated ? meta.width : meta.height) ?? 0, color };
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

// ───────── Video (v3 §3.2) ─────────

/** MP4/MOV ("....ftyp") or WebM/Matroska (1A 45 DF A3). The extension is never trusted. */
export function sniffVideo(head: Buffer): "mp4" | "webm" | null {
  if (head.length >= 12 && head.toString("latin1", 4, 8) === "ftyp") return "mp4";
  if (head.length >= 4 && head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return "webm";
  return null;
}

function run(cmd: string, args: string[], timeoutMs = 15 * 60_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    const t = setTimeout(() => p.kill("SIGKILL"), timeoutMs);
    p.stdout.on("data", (d) => { out += d; });
    p.stderr.on("data", (d) => { err = (err + d).slice(-4000); });
    p.on("error", (e) => { clearTimeout(t); reject(e); });
    p.on("close", (code) => { clearTimeout(t); code === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${code}: ${err}`)); });
  });
}

export async function probeVideo(file: string) {
  let out: string;
  try {
    out = await run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", file], 60_000);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") throw bad("معالجة الفيديو غير متاحة على الخادم (ffmpeg غير مثبّت)");
    throw bad("تعذّر قراءة الفيديو");
  }
  const j = JSON.parse(out) as { streams?: { width?: number; height?: number }[]; format?: { duration?: string } };
  const v = j.streams?.[0];
  if (!v?.width || !v?.height) throw bad("الملف لا يحتوي على فيديو صالح");
  return { width: v.width, height: v.height, duration: Math.round(Number(j.format?.duration ?? 0)) };
}

/**
 * Transcodes to H.264/AAC MP4 (720p, plus 1080p for large sources) with faststart,
 * strips metadata, and extracts a poster that goes through the normal responsive-image pipeline.
 */
export async function transcodeVideo(src: string, folder: string, info: { width: number; height: number }) {
  const key = randomHex(8);
  const rel = `${folder}/${key}`;
  const outDir = join(mediaDir(), folder);
  await mkdir(outDir, { recursive: true });
  const common = ["-hide_banner", "-y", "-i", src, "-map", "0:v:0", "-map", "0:a:0?", "-map_metadata", "-1",
    "-c:v", "libx264", "-preset", "veryfast", "-profile:v", "high", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart"];
  const short = Math.min(info.width, info.height);
  // Scale the short side so portrait phone videos are handled too.
  const scale = (p: number) => info.width >= info.height ? `scale=-2:${p}` : `scale=${p}:-2`;
  await run("ffmpeg", [...common, "-vf", scale(Math.min(720, short - (short % 2))), "-crf", "24", join(mediaDir(), `${rel}-720.mp4`)]);
  const hd = short >= 1000;
  if (hd) await run("ffmpeg", [...common, "-vf", scale(1080), "-crf", "23", join(mediaDir(), `${rel}-1080.mp4`)]);
  const posterFile = join(tmpdir(), `sc-poster-${key}.jpg`);
  try {
    await run("ffmpeg", ["-hide_banner", "-y", "-ss", "1", "-i", src, "-frames:v", "1", "-q:v", "3", posterFile], 120_000)
      .catch(() => run("ffmpeg", ["-hide_banner", "-y", "-i", src, "-frames:v", "1", "-q:v", "3", posterFile], 120_000));
    const { readFile } = await import("node:fs/promises");
    const poster = await saveResponsiveImage(await readFile(posterFile), folder);
    const size = (await stat(join(mediaDir(), `${rel}-720.mp4`))).size;
    return { videoPath: `${rel}-720.mp4`, hd, poster, size };
  } finally {
    await rm(posterFile, { force: true });
  }
}

export async function deleteVideoFiles(videoPath: string | null) {
  if (!videoPath) return;
  await unlink(join(mediaDir(), videoPath)).catch(() => {});
  await unlink(join(mediaDir(), videoPath.replace(/-720\.mp4$/, "-1080.mp4"))).catch(() => {});
}

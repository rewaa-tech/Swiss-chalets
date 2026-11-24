import "server-only";
import { open, stat, mkdir, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { dataDir } from "../paths";
import { q, one } from "../db";
import { bad } from "../errors";
import { sniff } from "./proof";
import {
  MAX_MEDIA_BYTES, MAX_VIDEO_BYTES, MAX_VIDEO_SECONDS, saveResponsiveImage, sniffVideo, probeVideo, transcodeVideo, deleteResponsiveImage,
} from "./media";
import { invalidateUnit } from "./cache";

/** Chunks stay under Nginx's 6m body limit; the client sends them in order and can resume. */
export const CHUNK_BYTES = 4 * 1024 * 1024;
const ID_RE = /^[a-f0-9]{16,32}$/;

const tmpDir = () => join(dataDir(), "tmp", "uploads");
const partPath = (id: string) => join(tmpDir(), `${id}.part`);

export function checkUploadId(id: string) {
  if (!ID_RE.test(id)) throw bad("معرّف رفع غير صالح");
}

/** Bytes already received: lets an interrupted upload continue where it stopped. */
export async function receivedBytes(id: string) {
  checkUploadId(id);
  try { return (await stat(partPath(id))).size; } catch { return 0; }
}

/**
 * Appends one chunk at `offset`. A chunk the server already has (retry after a dropped
 * connection) is acknowledged without writing it twice.
 */
export async function appendChunk(id: string, offset: number, data: Buffer, total: number) {
  checkUploadId(id);
  if (!Number.isFinite(total) || total <= 0 || total > MAX_VIDEO_BYTES) throw bad("حجم الملف يتجاوز الحد المسموح (200MB)");
  if (data.length > CHUNK_BYTES + 1024) throw bad("جزء الرفع أكبر من المسموح");
  await mkdir(tmpDir(), { recursive: true });
  const have = await receivedBytes(id);
  if (offset < have) return have;                       // duplicate chunk
  if (offset > have) throw bad("ترتيب أجزاء الرفع غير صحيح، أعد المحاولة");
  if (have === 0) {
    // First chunk: reject anything that is neither an image nor a video before storing more.
    if (!sniff(data) && !sniffVideo(data)) throw bad("نوع الملف غير مدعوم. ارفع صورة (JPG/PNG/WebP) أو فيديو (MP4/MOV/WebM)");
  }
  if (have + data.length > total) throw bad("حجم الملف لا يطابق المعلن");
  const fh = await open(partPath(id), "a");
  try { await fh.write(data); } finally { await fh.close(); }
  return have + data.length;
}

export async function discardUpload(id: string) {
  checkUploadId(id);
  await rm(partPath(id), { force: true });
}

export type UploadTarget = "album" | "cover";

/** Completes an upload: images are stored right away, videos are queued for transcoding. */
export async function finishUpload(id: string, unitId: number, target: UploadTarget) {
  const file = partPath(id);
  const size = await receivedBytes(id);
  if (!size) throw bad("لم يصل الملف");
  const head = Buffer.alloc(16);
  const fh = await open(file, "r");
  try { await fh.read(head, 0, 16, 0); } finally { await fh.close(); }

  if (sniff(head) && sniff(head) !== "pdf") {
    if (size > MAX_MEDIA_BYTES) { await discardUpload(id); throw bad("حجم الصورة يجب ألا يتجاوز 15MB"); }
    const buf = await readFile(file);
    await discardUpload(id);
    const img = await saveResponsiveImage(buf, `units/${unitId}`);
    if (target === "cover") {
      const old = await one<{ cover_path_base: string | null }>("SELECT cover_path_base FROM units WHERE id = $1", [unitId]);
      await q("UPDATE units SET cover_path_base = $2, cover_width = $3, cover_height = $4, cover_color = $5, cover_focal_x = 50, cover_focal_y = 50 WHERE id = $1",
        [unitId, img.base, img.width, img.height, img.color]);
      // Only delete the old cover files if no album item still uses them.
      if (old?.cover_path_base && !(await one("SELECT 1 FROM unit_media WHERE path_base = $1", [old.cover_path_base]))) await deleteResponsiveImage(old.cover_path_base);
      invalidateUnit(unitId);
      return { kind: "Image" as const, target, message: "تم تغيير صورة الغلاف" };
    }
    const order = await nextOrder(unitId);
    const r = await one("INSERT INTO unit_media (unit_id, kind, path_base, width, height, color, sort_order, size_bytes) VALUES ($1,'Image',$2,$3,$4,$5,$6,$7) RETURNING id",
      [unitId, img.base, img.width, img.height, img.color, order, buf.length]);
    await adoptCoverIfMissing(unitId, img);
    invalidateUnit(unitId);
    return { kind: "Image" as const, target, id: r!.id as number, message: "تمت إضافة الصورة" };
  }

  if (!sniffVideo(head)) { await discardUpload(id); throw bad("نوع الملف غير مدعوم"); }
  if (target === "cover") { await discardUpload(id); throw bad("صورة الغلاف يجب أن تكون صورة، أضف الفيديو للألبوم"); }
  let info: Awaited<ReturnType<typeof probeVideo>>;
  try { info = await probeVideo(file); } catch (e) { await discardUpload(id); throw e; }
  if (info.duration > MAX_VIDEO_SECONDS) { await discardUpload(id); throw bad("مدة الفيديو يجب ألا تتجاوز دقيقتين"); }
  const order = await nextOrder(unitId);
  const r = await one("INSERT INTO unit_media (unit_id, kind, status, path_base, width, height, sort_order, duration_seconds, size_bytes) VALUES ($1,'Video','Processing','',$2,$3,$4,$5,$6) RETURNING id",
    [unitId, info.width, info.height, order, info.duration, size]);
  enqueue(() => processVideo(r!.id as number, unitId, file, info));
  return { kind: "Video" as const, target, id: r!.id as number, message: "تم رفع الفيديو، جارٍ المعالجة…" };
}

async function nextOrder(unitId: number) {
  return (await one<{ n: number }>("SELECT COALESCE(max(sort_order) + 1, 0)::int n FROM unit_media WHERE unit_id = $1", [unitId]))!.n;
}

async function adoptCoverIfMissing(unitId: number, img: { base: string; width: number; height: number; color: string | null }) {
  await q("UPDATE units SET cover_path_base = $2, cover_width = $3, cover_height = $4, cover_color = $5 WHERE id = $1 AND cover_path_base IS NULL",
    [unitId, img.base, img.width, img.height, img.color]);
}

// One video at a time: transcoding is CPU heavy and the VPS also serves the site.
let chain: Promise<unknown> = Promise.resolve();
function enqueue(job: () => Promise<void>) {
  chain = chain.then(job, job).catch((e) => console.error("video job failed", e));
}

async function processVideo(mediaId: number, unitId: number, file: string, info: { width: number; height: number }) {
  try {
    const out = await transcodeVideo(file, `units/${unitId}`, info);
    await q("UPDATE unit_media SET status = 'Ready', path_base = $2, color = $3, video_path = $4, video_hd = $5, size_bytes = $6 WHERE id = $1",
      [mediaId, out.poster.base, out.poster.color, out.videoPath, out.hd, out.size]);
    await adoptCoverIfMissing(unitId, out.poster);
  } catch (e) {
    console.error("transcode failed", e);
    await q("UPDATE unit_media SET status = 'Failed' WHERE id = $1", [mediaId]);
  } finally {
    await rm(file, { force: true });
    invalidateUnit(unitId);
  }
}

/** On start-up: a video left "Processing" by a restart can never finish. */
export async function failStaleVideos() {
  await q("UPDATE unit_media SET status = 'Failed' WHERE status = 'Processing'");
}

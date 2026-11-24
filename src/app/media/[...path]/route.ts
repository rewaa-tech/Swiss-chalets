import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { join, normalize, sep } from "node:path";
import { mediaDir } from "@/lib/paths";

const TYPES: Record<string, string> = { webp: "image/webp", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", mp4: "video/mp4" };
const HEAD = { "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff", "Accept-Ranges": "bytes" };

/**
 * Public unit/branch media (outside the web root). Proofs are never served from here.
 * Videos support HTTP Range requests (required for seeking and by iOS Safari).
 */
export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const parts = (await ctx.params).path;
  if (parts.some((p) => p === ".." || p.includes("\0"))) return new Response("Not found", { status: 404 });
  const rel = normalize(parts.join("/"));
  const ext = rel.split(".").pop()?.toLowerCase() ?? "";
  if (!TYPES[ext]) return new Response("Not found", { status: 404 });
  const root = mediaDir();
  const full = join(root, rel);
  if (!full.startsWith(root + sep)) return new Response("Not found", { status: 404 });
  let size: number;
  try { size = (await stat(full)).size; } catch { return new Response("Not found", { status: 404 }); }

  const range = req.headers.get("range");
  let start = 0, end = size - 1, status = 200;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!m || (!m[1] && !m[2])) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    if (m[1]) { start = Number(m[1]); end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1; }
    else { start = Math.max(0, size - Number(m[2])); }
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    status = 206;
  }
  const length = end - start + 1;
  const body = Readable.toWeb(createReadStream(full, { start, end })) as ReadableStream<Uint8Array>;
  return new Response(body, {
    status,
    headers: { ...HEAD, "Content-Type": TYPES[ext], "Content-Length": String(length), ...(status === 206 ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}) },
  });
}

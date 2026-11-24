import { readFile } from "node:fs/promises";
import { join, normalize, sep } from "node:path";
import { mediaDir } from "@/lib/paths";

const TYPES: Record<string, string> = { webp: "image/webp", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" };

/** Public unit/branch media (outside the web root). Proofs are never served from here. */
export async function GET(_: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const parts = (await ctx.params).path;
  if (parts.some((p) => p === ".." || p.includes("\0"))) return new Response("Not found", { status: 404 });
  const rel = normalize(parts.join("/"));
  const ext = rel.split(".").pop()?.toLowerCase() ?? "";
  if (!TYPES[ext]) return new Response("Not found", { status: 404 });
  const root = mediaDir();
  const full = join(root, rel);
  if (!full.startsWith(root + sep)) return new Response("Not found", { status: 404 });
  try {
    const data = await readFile(full);
    return new Response(new Uint8Array(data), { headers: { "Content-Type": TYPES[ext], "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

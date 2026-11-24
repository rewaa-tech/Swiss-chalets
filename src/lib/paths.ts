import { join } from "node:path";
export const dataDir = () => process.env.DATA_DIR || join(process.cwd(), "data");
export const mediaDir = () => join(dataDir(), "media");
export const proofsDir = () => join(dataDir(), "proofs");

/**
 * Dynamic route params can arrive percent-encoded (e.g. Arabic slugs "%D9%83…").
 * Decode once, safely, so lookups match the stored slug.
 */
export function routeParam(v: string | undefined | null): string {
  if (!v) return "";
  try { return decodeURIComponent(v).normalize("NFC"); } catch { return v; }
}

import "server-only";
import { coordsFromMapUrl } from "../geo";

const SHORT_HOSTS = new Set(["maps.app.goo.gl", "goo.gl", "g.co"]);

/**
 * Coordinates from a map link. Short share links (maps.app.goo.gl/…) are expanded by
 * following their redirects (max 4 hops, 5s), only towards Google hosts.
 */
export async function resolveMapLink(url: string): Promise<{ lat: number; lng: number } | null> {
  const direct = coordsFromMapUrl(url);
  if (direct) return direct;
  let cur: URL;
  try { cur = new URL(url); } catch { return null; }
  if (!SHORT_HOSTS.has(cur.hostname)) return null;
  for (let hop = 0; hop < 4; hop++) {
    try {
      const r = await fetch(cur, { redirect: "manual", signal: AbortSignal.timeout(5000), headers: { "User-Agent": "Mozilla/5.0 SwissChalets" } });
      const loc = r.headers.get("location");
      if (!loc) return null;
      const next = new URL(loc, cur);
      if (!/(^|\.)google\.[a-z.]+$|(^|\.)goo\.gl$/.test(next.hostname)) return null;
      const c = coordsFromMapUrl(next.toString());
      if (c) return c;
      cur = next;
    } catch { return null; }
  }
  return null;
}

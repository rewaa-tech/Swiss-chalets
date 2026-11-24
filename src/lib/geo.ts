/** v3 §4 — pull coordinates out of the usual Google Maps link shapes. */
export function coordsFromMapUrl(url: string | null | undefined): { lat: number; lng: number } | null {
  if (!url) return null;
  let s = url.trim();
  try { s = decodeURIComponent(s); } catch { /* keep raw */ }
  const pats = [
    /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/,                 // place data (most precise)
    /@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/,                    // /@lat,lng,zoom
    /[?&](?:q|query|ll|destination|center)=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/,
    /^\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/,          // plain "lat, lng"
  ];
  for (const p of pats) {
    const m = p.exec(s);
    if (m) {
      const lat = Number(m[1]), lng = Number(m[2]);
      if (validCoords(lat, lng)) return { lat: round(lat), lng: round(lng) };
    }
  }
  return null;
}

export const validCoords = (lat: number, lng: number) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
const round = (n: number) => Math.round(n * 1e6) / 1e6;

export const mapEmbedUrl = (lat: number, lng: number, zoom = 15) => `https://www.google.com/maps?q=${lat},${lng}&z=${zoom}&hl=ar&output=embed`;
export const mapOpenUrl = (lat: number, lng: number) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

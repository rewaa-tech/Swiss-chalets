const tf = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Damascus", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
export const hhmm = (iso: string) => tf.format(new Date(iso));
const df = new Intl.DateTimeFormat("ar-SY-u-nu-latn", { timeZone: "Asia/Damascus", weekday: "long", day: "numeric", month: "long" });
export const dayLabel = (date: string) => df.format(new Date(`${date}T12:00:00+03:00`));
const mf = new Intl.DateTimeFormat("ar-SY-u-nu-latn", { month: "long", year: "numeric", timeZone: "UTC" });
export const monthLabel = (m: string) => mf.format(new Date(`${m}-15T00:00:00Z`));
export const money = (n: number, c = "USD") => (c === "USD" ? `$${Number.isInteger(n) ? n : n.toFixed(2)}` : `${n} ${c}`);

export function shiftMonth(m: string, d: number) {
  const [y, mo] = m.split("-").map(Number);
  const t = new Date(Date.UTC(y, mo - 1 + d, 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`;
}

export interface SavedBooking { token: string; unit: string; date: string; at: number }
const KEY = "sc_my_bookings";
export function saveMyBooking(b: SavedBooking) {
  try {
    const list: SavedBooking[] = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    localStorage.setItem(KEY, JSON.stringify([b, ...list.filter((x) => x.token !== b.token)].slice(0, 30)));
  } catch { /* storage unavailable */ }
}
export function loadMyBookings(): SavedBooking[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
}

export async function problemMessage(r: Response): Promise<{ message: string; field?: string; code?: string }> {
  const j = await r.json().catch(() => ({}));
  return { message: j.title || "تعذّر إتمام الطلب، حاول مرة أخرى", field: j.field, code: j.code };
}

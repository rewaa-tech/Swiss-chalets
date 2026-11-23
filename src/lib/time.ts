// All business logic runs in Asia/Damascus; storage is UTC.
export const TZ = "Asia/Damascus";

const fmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

export interface LocalParts { date: string; year: number; month: number; day: number; minutes: number; seconds: number }

export function toLocal(d: Date): LocalParts {
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  const year = +p.year, month = +p.month, day = +p.day;
  return { date: `${p.year}-${p.month}-${p.day}`, year, month, day, minutes: +p.hour * 60 + +p.minute, seconds: +p.second };
}

function offsetMinutes(at: Date): number {
  const l = toLocal(at);
  const asUtc = Date.UTC(l.year, l.month - 1, l.day, Math.floor(l.minutes / 60), l.minutes % 60, l.seconds);
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}

/** Converts a Damascus wall-clock (date + minutes after midnight, may exceed 1440) to a UTC Date. */
export function localToUtc(date: string, minutes = 0): Date {
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  let off = offsetMinutes(new Date(guess));
  let res = guess - off * 60000;
  const off2 = offsetMinutes(new Date(res));
  if (off2 !== off) res = guess - off2 * 60000;
  return new Date(res);
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export function todayLocal(now = new Date()): string { return toLocal(now).date; }

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function minutesToTime(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function monthDays(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

const arDate = new Intl.DateTimeFormat("ar-SY-u-nu-latn", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
const arDateTime = new Intl.DateTimeFormat("ar-SY-u-nu-latn", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export function fmtDayAr(date: string): string { return arDate.format(localToUtc(date, 12 * 60)); }
export function fmtDateTimeAr(d: Date | string | null | undefined): string { return d ? arDateTime.format(new Date(d)) : "—"; }
export function fmtTime(d: Date | string): string { return minutesToTime(toLocal(new Date(d)).minutes); }

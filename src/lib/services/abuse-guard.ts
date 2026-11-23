import { one, type Db } from "../db";
import { readFormStamp, sha256 } from "../crypto";
import { normalizePhone } from "../phone";
import { bad, AppError } from "../errors";
import { num, type Settings } from "../settings";
import { localToUtc, todayLocal } from "../time";

export const BLOCKED_MSG = "تعذّر إتمام الطلب، تواصل معنا عبر واتساب";

export const ipHash = (ip: string, salt: string) => sha256(`ip:${salt}:${ip}`);
export const deviceHash = (did: string, ua: string, salt: string) => sha256(`dev:${salt}:${did}:${ua}`);

export interface GuardInput { honeypot?: string | null; formStamp?: string | null; phone: string; ipHash: string; deviceHash: string }
export type GuardResult = { silent: true } | { silent: false; phone: string };

/** Steps 1–6 of the AbuseGuard pipeline (section 6). */
export async function guard(inp: GuardInput, s: Settings, db?: Db, now = Date.now()): Promise<GuardResult> {
  // 1. Honeypot
  if (inp.honeypot && inp.honeypot.trim() !== "") return { silent: true };
  // 2. Fill time
  const stamp = readFormStamp(inp.formStamp);
  const minMs = num(s, "min_fill_seconds", 5) * 1000;
  if (stamp === null || now - stamp < minMs || now - stamp > 24 * 3600 * 1000) return { silent: true };
  // 3. Phone normalisation
  const phone = normalizePhone(inp.phone);
  if (!phone || !phone.startsWith("+9639")) throw bad("رقم الواتساب غير صحيح. مثال: 0912345678", "phone");
  // 4. Blocklist
  const blocked = await one(
    `SELECT 1 FROM blocked_identities WHERE is_active AND (
       (kind = 'Phone' AND value = $1) OR (kind = 'Ip' AND value = $2) OR (kind = 'Device' AND value = $3)) LIMIT 1`,
    [phone, inp.ipHash, inp.deviceHash], db);
  if (blocked) throw new AppError(403, BLOCKED_MSG, "blocked");
  // 5. Active per phone
  const active = await one<{ n: number }>(
    "SELECT count(*)::int AS n FROM bookings WHERE phone_e164 = $1 AND status IN ('Held','PendingReview')", [phone], db);
  if ((active?.n ?? 0) >= num(s, "max_active_per_phone", 2))
    throw new AppError(429, "لديك طلبات قيد المعالجة. أكمل طلبك الحالي أو تواصل معنا عبر واتساب", "limit_phone");
  // 6. Daily per IP / device
  const dayStart = localToUtc(todayLocal(new Date(now)));
  const daily = await one<{ ip: number; dev: number }>(
    `SELECT count(*) FILTER (WHERE ip_hash = $1)::int AS ip, count(*) FILTER (WHERE device_hash = $2)::int AS dev
       FROM bookings WHERE source = 'Online' AND created_at >= $3 AND (ip_hash = $1 OR device_hash = $2)`,
    [inp.ipHash, inp.deviceHash, dayStart], db);
  if ((daily?.ip ?? 0) >= num(s, "max_daily_per_ip", 2) || (daily?.dev ?? 0) >= num(s, "max_daily_per_device", 2))
    throw new AppError(429, "وصلت للحد اليومي من الطلبات. تواصل معنا عبر واتساب", "limit_daily");
  return { silent: false, phone };
}

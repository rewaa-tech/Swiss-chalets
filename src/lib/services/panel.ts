import "server-only";
import { q, one } from "../db";

export const BOOKING_ROW = `
  b.id, b.status, b.source, b.customer_name, b.phone_e164, b.category, b.persons, b.notes, b.total, b.currency,
  b.review_due_at, b.proof_at, b.created_at, b.reviewed_at, b.reject_reason, b.hold_expires_at, b.status_token,
  u.name AS unit_name, u.id AS unit_id, br.name AS branch_name,
  p.transaction_number, p.proof_kind, p.page_count, p.size_bytes, p.file_path, p.file_deleted_at,
  (SELECT min(day) FROM booking_items WHERE booking_id = b.id) AS first_day,
  (SELECT count(*)::int FROM booking_items WHERE booking_id = b.id) AS nights,
  (SELECT min(lower(period)) FROM booking_items WHERE booking_id = b.id) AS starts_at,
  (SELECT max(upper(period)) FROM booking_items WHERE booking_id = b.id) AS ends_at`;

export const BOOKING_FROM = `FROM bookings b JOIN units u ON u.id = b.unit_id JOIN branches br ON br.id = b.branch_id LEFT JOIN payment_proofs p ON p.booking_id = b.id`;

export async function pendingQueue(branchId: number) {
  return q(`SELECT ${BOOKING_ROW} ${BOOKING_FROM} WHERE b.branch_id = $1 AND b.status = 'PendingReview' ORDER BY b.review_due_at NULLS LAST, b.id`, [branchId]);
}

export async function pendingCount(branchId: number) {
  return (await one<{ n: number }>("SELECT count(*)::int AS n FROM bookings WHERE branch_id = $1 AND status = 'PendingReview'", [branchId]))?.n ?? 0;
}

export interface BookingFilter { branchId?: number | null; status?: string; q?: string; unitId?: number; from?: string; to?: string; page?: number; pageSize?: number }

export async function searchBookings(f: BookingFilter) {
  const where: string[] = [], args: unknown[] = [];
  const add = (sql: string, v: unknown) => { args.push(v); where.push(sql.replace("?", `$${args.length}`)); };
  if (f.branchId) add("b.branch_id = ?", f.branchId);
  if (f.status && f.status !== "all") add("b.status = ?", f.status);
  if (f.unitId) add("b.unit_id = ?", f.unitId);
  if (f.from) add("EXISTS (SELECT 1 FROM booking_items i WHERE i.booking_id = b.id AND i.day >= ?::date)", f.from);
  if (f.to) add("EXISTS (SELECT 1 FROM booking_items i WHERE i.booking_id = b.id AND i.day <= ?::date)", f.to);
  if (f.q) {
    const term = f.q.trim();
    const digits = term.replace(/\D/g, "");
    args.push(`%${term}%`);
    const n = args.length;
    let cond = `(b.customer_name ILIKE $${n} OR p.transaction_number ILIKE $${n}`;
    if (digits.length >= 4) { args.push(`%${digits.replace(/^0/, "")}%`); cond += ` OR b.phone_e164 LIKE $${args.length}`; }
    if (/^\d+$/.test(term)) { args.push(Number(term)); cond += ` OR b.id = $${args.length}`; }
    where.push(cond + ")");
  }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const size = f.pageSize ?? 20, page = Math.max(1, f.page ?? 1);
  const [rows, total] = await Promise.all([
    q(`SELECT ${BOOKING_ROW} ${BOOKING_FROM} ${w} ORDER BY b.created_at DESC, b.id DESC LIMIT ${size} OFFSET ${(page - 1) * size}`, args),
    one<{ n: number }>(`SELECT count(*)::int AS n ${BOOKING_FROM} ${w}`, args),
  ]);
  return { rows, total: total?.n ?? 0, page, pages: Math.max(1, Math.ceil((total?.n ?? 0) / size)) };
}

export async function bookingStats(branchId?: number | null) {
  const args = branchId ? [branchId] : [];
  const bw = branchId ? "AND b.branch_id = $1" : "";
  return one<{ pending: number; confirmed_month: number; today: number; expired: number }>(
    `SELECT
       count(*) FILTER (WHERE b.status = 'PendingReview')::int AS pending,
       count(*) FILTER (WHERE b.status IN ('Confirmed','Completed') AND date_trunc('month', b.reviewed_at AT TIME ZONE 'Asia/Damascus') = date_trunc('month', now() AT TIME ZONE 'Asia/Damascus'))::int AS confirmed_month,
       count(*) FILTER (WHERE (b.created_at AT TIME ZONE 'Asia/Damascus')::date = (now() AT TIME ZONE 'Asia/Damascus')::date)::int AS today,
       count(*) FILTER (WHERE b.status = 'Expired')::int AS expired
     FROM bookings b WHERE true ${bw}`, args);
}

export async function bookingTimeline(bookingId: number) {
  return q(`SELECT a.action, a.created_at, a.details, a.is_manual, u.display_name FROM audit_logs a LEFT JOIN app_users u ON u.id = a.user_id
             WHERE a.entity = 'booking' AND a.entity_id = $1 ORDER BY a.created_at`, [String(bookingId)]);
}

export async function branchUnits(branchId: number, activeOnly = false) {
  return q(`SELECT id, name, slug, is_active, capacity, allowed_category, type FROM units WHERE branch_id = $1 ${activeOnly ? "AND is_active" : ""} ORDER BY sort_order, id`, [branchId]);
}

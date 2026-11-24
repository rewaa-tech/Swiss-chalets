import { q } from "../db";
import { fmtDateTimeAr, fmtDayAr, fmtTime } from "../time";
import { CATEGORY_AR, type Category } from "./booking";

const token = () => process.env.TELEGRAM_BOT_TOKEN || "";
export const telegramConfigured = () => !!token();

export async function sendTelegram(chatId: number | string, text: string): Promise<{ ok: boolean; error?: string }> {
  if (!token()) return { ok: false, error: "bot token not configured" };
  try {
    const r = await fetch(`https://api.telegram.org/bot${token()}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10000),
    });
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    return j.ok ? { ok: true } : { ok: false, error: j.description ?? `HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export type AlertKind = "new" | "reminder" | "escalation";

export async function bookingAlertText(bookingId: number, kind: AlertKind): Promise<string> {
  const [b] = await q(
    `SELECT b.*, u.name AS unit_name, br.name AS branch_name, p.transaction_number, p.proof_kind,
            (SELECT min(day) FROM booking_items WHERE booking_id = b.id) AS first_day,
            (SELECT min(lower(period)) FROM booking_items WHERE booking_id = b.id) AS s,
            (SELECT max(upper(period)) FROM booking_items WHERE booking_id = b.id) AS e
       FROM bookings b JOIN units u ON u.id = b.unit_id JOIN branches br ON br.id = b.branch_id
       LEFT JOIN payment_proofs p ON p.booking_id = b.id WHERE b.id = $1`, [bookingId]);
  const head = kind === "new" ? "🔔 حجز جديد" : kind === "reminder" ? "⏰ تذكير: حجز بانتظار المراجعة" : "⚠️ تصعيد: تجاوز مهلة المراجعة";
  const url = `${process.env.APP_URL ?? ""}/branch/queue?id=${b.id}`;
  return [
    `${head} — ${b.branch_name}`,
    `${b.unit_name} · ${fmtDayAr(b.first_day)} ${fmtTime(b.s)}–${fmtTime(b.e)}`,
    `${b.customer_name} · ${CATEGORY_AR[b.category as Category]} · ${b.persons} أشخاص`,
    `المبلغ: ${b.total} ${b.currency} — رقم العملية: ${b.transaction_number ?? "—"} — الإشعار: ${b.proof_kind === "Pdf" ? "PDF" : "صورة"}`,
    `مهلة المراجعة: ${fmtDateTimeAr(b.review_due_at)}`,
    url,
  ].join("\n");
}

/** Sends a booking alert to reviewers of its branch (and super admins on escalation). */
export async function notifyBooking(bookingId: number, kind: AlertKind) {
  const [b] = await q("SELECT branch_id FROM bookings WHERE id = $1", [bookingId]);
  if (!b) return;
  const recipients = await q<{ id: number; telegram_chat_id: number }>(
    kind === "escalation"
      ? `SELECT id, telegram_chat_id FROM app_users WHERE is_active AND telegram_chat_id IS NOT NULL
           AND ((role = 'BranchManager' AND branch_id = $1) OR role = 'SuperAdmin')`
      : `SELECT u.id, u.telegram_chat_id FROM app_users u WHERE u.is_active AND u.telegram_chat_id IS NOT NULL AND u.branch_id = $1
           AND (u.role = 'BranchManager' OR EXISTS (SELECT 1 FROM user_permissions p WHERE p.user_id = u.id AND p.permission = 'bookings.confirm'))`,
    [b.branch_id]);
  const text = await bookingAlertText(bookingId, kind);
  for (const r of recipients) {
    const res = await sendTelegram(r.telegram_chat_id, text);
    await q("INSERT INTO notifications_log (booking_id, user_id, kind, status, error) VALUES ($1,$2,$3,$4,$5)",
      [bookingId, r.id, kind, res.ok ? "Sent" : "Failed", res.error ?? null]);
  }
  if (!recipients.length) {
    await q("INSERT INTO notifications_log (booking_id, kind, status, error) VALUES ($1,$2,'Skipped','no linked recipients')", [bookingId, kind]);
  }
}

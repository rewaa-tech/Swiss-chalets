import { readdir, rmdir } from "node:fs/promises";
import { join } from "node:path";
import { q } from "../db";
import { proofsDir } from "../paths";
import { toLocal } from "../time";
import { expireHolds } from "./availability";
import { completeFinished } from "./booking";
import { isWithinWindow } from "./review-deadline";
import { notifyBooking } from "./telegram";
import { removeProofFile } from "./proof";
import { failStaleVideos } from "./uploads";

const REMINDER_MS = 10 * 60000;

/** First alert, reminders every 10 minutes inside the window, one escalation (BR-23/24). Never cancels. */
export async function reviewAlerts(now = new Date()) {
  const rows = await q(
    `SELECT b.id, b.alert_due_at, b.first_alert_at, b.last_reminder_at, b.review_due_at, b.escalated_at, br.review_start, br.review_end
       FROM bookings b JOIN branches br ON br.id = b.branch_id WHERE b.status = 'PendingReview'`);
  for (const b of rows) {
    if (!b.first_alert_at && b.alert_due_at && new Date(b.alert_due_at) <= now) {
      await q("UPDATE bookings SET first_alert_at = $2, last_reminder_at = $2 WHERE id = $1 AND first_alert_at IS NULL", [b.id, now]);
      await notifyBooking(b.id, "new");
    } else if (b.first_alert_at && isWithinWindow(now, b.review_start, b.review_end)
      && now.getTime() - new Date(b.last_reminder_at ?? b.first_alert_at).getTime() >= REMINDER_MS) {
      await q("UPDATE bookings SET last_reminder_at = $2 WHERE id = $1", [b.id, now]);
      await notifyBooking(b.id, "reminder");
    }
    if (!b.escalated_at && b.review_due_at && new Date(b.review_due_at) < now) {
      const r = await q("UPDATE bookings SET escalated_at = $2 WHERE id = $1 AND escalated_at IS NULL RETURNING id", [b.id, now]);
      if (r.length) await notifyBooking(b.id, "escalation");
    }
  }
}

/** Deletes proof files after 6 months; transaction number and history stay. */
export async function proofCleanup() {
  const rows = await q<{ booking_id: number; file_path: string }>(
    "SELECT booking_id, file_path FROM payment_proofs WHERE file_path IS NOT NULL AND file_deleted_at IS NULL AND delete_after <= now() LIMIT 500");
  for (const r of rows) {
    await removeProofFile(r.file_path);
    await q("UPDATE payment_proofs SET file_deleted_at = now() WHERE booking_id = $1", [r.booking_id]);
  }
  // prune empty month folders
  try {
    for (const y of await readdir(proofsDir())) for (const m of await readdir(join(proofsDir(), y))) await rmdir(join(proofsDir(), y, m)).catch(() => {});
  } catch { /* folder may not exist yet */ }
  return rows.length;
}

const g = globalThis as unknown as { __scJobs?: boolean };

export function startJobs() {
  if (g.__scJobs || process.env.DISABLE_JOBS === "1") return;
  g.__scJobs = true;
  const safe = (name: string, fn: () => Promise<unknown>) => () => fn().catch((e) => console.error(`[job:${name}]`, e));
  let lastHour = -1, lastCleanupDay = "";
  const tick = async () => {
    await safe("hold-expiry", () => expireHolds())();
    await safe("review-alerts", () => reviewAlerts())();
    const l = toLocal(new Date());
    const hour = Math.floor(l.minutes / 60);
    if (hour !== lastHour) { lastHour = hour; await safe("completion", () => completeFinished())(); }
    if (hour === 3 && lastCleanupDay !== l.date) { lastCleanupDay = l.date; await safe("proof-cleanup", proofCleanup)(); }
  };
  void safe("stale-videos", failStaleVideos)();
  setTimeout(tick, 5000);
  setInterval(tick, 60_000).unref?.();
}

/** BR-24: inside the review window the first alert goes out immediately. */
export async function alertIfWithinWindow(bookingId: number) {
  try {
    const r = await q("UPDATE bookings SET first_alert_at = now(), last_reminder_at = now() WHERE id = $1 AND first_alert_at IS NULL AND status = 'PendingReview' RETURNING id", [bookingId]);
    if (r.length) await notifyBooking(bookingId, "new");
  } catch (e) { console.error("[alert]", e); }
}

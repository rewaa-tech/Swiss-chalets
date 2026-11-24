import { localToUtc, timeToMinutes, toLocal, addDays } from "../time";

export const REVIEW_SLA_MIN = 30;

/** Is the Damascus wall-clock time of `at` inside the review window? Supports windows crossing midnight. */
export function isWithinWindow(at: Date, start: string, end: string): boolean {
  const t = toLocal(at).minutes;
  const s = timeToMinutes(start), e = timeToMinutes(end);
  if (s === e) return true; // 24h window
  if (s < e) return t >= s && t < e;
  return t >= s || t < e;
}

/** Next instant (>= at) when the review window opens. Returns `at` itself if already inside. */
export function nextWindowStart(at: Date, start: string, end: string): Date {
  if (isWithinWindow(at, start, end)) return at;
  const l = toLocal(at);
  const s = timeToMinutes(start);
  let cand = localToUtc(l.date, s);
  if (cand.getTime() <= at.getTime()) cand = localToUtc(addDays(l.date, 1), s);
  return cand;
}

/** BR-23/BR-24: computes when the first alert goes out and when the review is due. */
export function computeReviewTimes(uploadedAt: Date, start: string, end: string) {
  const within = isWithinWindow(uploadedAt, start, end);
  const alertAt = within ? uploadedAt : nextWindowStart(uploadedAt, start, end);
  const dueAt = new Date(alertAt.getTime() + REVIEW_SLA_MIN * 60000);
  return { within, alertAt, dueAt };
}

import type { PoolClient } from "pg";
import { one, q, tx, pgCode, type Db } from "../db";
import { base62Token } from "../crypto";
import { AppError, bad, conflict, notFound, forbidden } from "../errors";
import { getSettings, num, fillTemplate, type Settings } from "../settings";
import { addDays, isValidDate, fmtDayAr, fmtTime } from "../time";
import { normalizePhone, waLink } from "../phone";
import { audit } from "../audit";
import type { SessionUser } from "../permissions";
import { daySlots, expireHolds, loadUnitCtx, seasonFor, type SlotRow } from "./availability";
import { invalidateUnit } from "./cache";
import { guard, BLOCKED_MSG } from "./abuse-guard";
import { validateProof, storeProof, removeProofFile, type ValidProof } from "./proof";
import { computeReviewTimes } from "./review-deadline";

export type BookingStatus = "Held" | "PendingReview" | "Confirmed" | "Completed" | "Expired" | "Rejected" | "VoidNoDocuments";
export type Category = "Family" | "Youth";

export const STATUS_AR: Record<BookingStatus, string> = {
  Held: "محجوز مؤقتًا",
  PendingReview: "بانتظار التأكيد",
  Confirmed: "مثبّت",
  Completed: "مكتمل",
  Expired: "انتهت المهلة",
  Rejected: "مرفوض",
  VoidNoDocuments: "ملغى لعدم الثبوتيات",
};
export const CATEGORY_AR: Record<Category, string> = { Family: "عائلي", Youth: "شبابي" };

export const SLOT_TAKEN_MSG = "هذا الوقت انحجز للتو. اختر فترة ثانية";
export const LATE_TAKEN_MSG = "حُجز الوقت لغيرك";
const MAX_NIGHTS = 14;

export interface CustomerInput { name: string; phone: string; category: string; persons: number; notes?: string | null }
export interface SelectionInput { unitId: number; slotId: number; date: string; nights?: number }

interface PlannedItem { slot: SlotRow; day: string; start: Date; end: Date; price: number }

function validateCustomer(c: CustomerInput, capacity: number, allowed: string) {
  const name = (c.name ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) throw bad("الاسم يجب أن يكون بين 2 و80 حرفًا", "name");
  if (c.category !== "Family" && c.category !== "Youth") throw bad("اختر نوع الحجز: عائلي أو شبابي", "category");
  if (c.category === "Youth" && allowed === "FamilyOnly") throw bad("هذه الوحدة مخصصة للعائلات فقط", "category"); // BR-16
  const persons = Math.trunc(Number(c.persons));
  if (!Number.isFinite(persons) || persons < 1 || persons > capacity) throw bad(`عدد الأشخاص يجب أن يكون بين 1 و${capacity}`, "persons"); // BR-05
  const notes = (c.notes ?? "").trim();
  if (notes.length > 500) throw bad("الملاحظات يجب ألا تتجاوز 500 حرف", "notes");
  return { name, category: c.category as Category, persons, notes: notes || null };
}

/** Step 7: validates the requested slot(s) against season, mode, open days and time (BR-08/09/32). */
async function planItems(sel: SelectionInput, db: Db, now = new Date()) {
  if (!isValidDate(sel.date)) throw bad("التاريخ غير صحيح", "date");
  const nights = Math.max(1, Math.trunc(Number(sel.nights ?? 1)));
  if (nights > MAX_NIGHTS) throw bad(`الحد الأقصى ${MAX_NIGHTS} ليلة بالحجز الواحد`, "nights");
  const lastDay = addDays(sel.date, nights - 1);
  const ctx = await loadUnitCtx(sel.unitId, sel.date, lastDay, db, true);
  const first = daySlots(ctx, sel.date, now);
  const chosen = first.slots.find((s) => s.slot.id === Number(sel.slotId));
  if (!chosen) throw bad("الفترة المختارة غير متاحة بهذا اليوم", "slot");
  if (chosen.ended) throw bad("انتهى وقت هذه الفترة", "slot");
  if (chosen.taken) throw conflict(SLOT_TAKEN_MSG, "slot_taken");
  if (nights > 1 && chosen.slot.kind !== "HotelNight") throw bad("الحجز لعدة ليالٍ متاح فقط بالنمط الفندقي", "nights");

  const items: PlannedItem[] = [{ slot: chosen.slot, day: sel.date, start: chosen.start, end: chosen.end, price: chosen.slot.price }];
  for (let i = 1; i < nights; i++) {
    const day = addDays(sel.date, i);
    const season = seasonFor(ctx.seasons, day);
    const ds = daySlots(ctx, day, now);
    if (!season || ds.mode !== "Hotel") throw bad(`ليلة ${fmtDayAr(day)} ليست ضمن موسم فندقي لهذه الوحدة`, "nights"); // BR-08 / T-20
    const nightSlots = ds.slots.filter((s) => s.slot.kind === "HotelNight");
    const pick = nightSlots.find((s) => s.slot.start_time === chosen.slot.start_time) ?? nightSlots[0];
    if (!pick) throw bad(`لا توجد ليلة متاحة بتاريخ ${fmtDayAr(day)}`, "nights");
    if (pick.taken) throw conflict(`ليلة ${fmtDayAr(day)} محجوزة`, "slot_taken");
    items.push({ slot: pick.slot, day, start: pick.start, end: pick.end, price: pick.slot.price });
  }
  return { ctx, items, total: Math.round(items.reduce((a, b) => a + b.price, 0) * 100) / 100 };
}

async function insertItems(c: PoolClient, bookingId: number, unitId: number, items: PlannedItem[]) {
  for (const it of items) {
    await c.query(
      "INSERT INTO booking_items (booking_id, unit_id, time_slot_id, day, period, price) VALUES ($1,$2,$3,$4, tstzrange($5,$6,'[)'), $7)",
      [bookingId, unitId, it.slot.id, it.day, it.start, it.end, it.price]);
  }
}

function mapInsertError(e: unknown): never {
  if (pgCode(e) === "23P01") throw conflict(SLOT_TAKEN_MSG, "slot_taken");
  if (pgCode(e) === "23505") throw conflict("رقم العملية مستخدم مسبقًا", "duplicate");
  throw e;
}

export async function paymentInfo(branchId: number, db?: Db) {
  const b = await one("SELECT name, shamcash_account_name, shamcash_account_number, shamcash_qr_path, review_start, review_end FROM branches WHERE id = $1", [branchId], db);
  return {
    branch: b?.name as string,
    accountName: b?.shamcash_account_name as string | null,
    accountNumber: b?.shamcash_account_number as string | null,
    hasQr: !!b?.shamcash_qr_path,
    reviewStart: (b?.review_start as string)?.slice(0, 5),
    reviewEnd: (b?.review_end as string)?.slice(0, 5),
  };
}

export interface CreateHoldInput extends SelectionInput, CustomerInput {
  honeypot?: string | null; formStamp?: string | null; ipHash: string; deviceHash: string;
}

/** POST /api/bookings — creates a Held booking (BR-19). */
export async function createHold(inp: CreateHoldInput, now = new Date()) {
  const s = await getSettings();
  await expireHolds();
  const g = await guard({ honeypot: inp.honeypot, formStamp: inp.formStamp, phone: inp.phone, ipHash: inp.ipHash, deviceHash: inp.deviceHash }, s, undefined, now.getTime());
  if (g.silent) return { silent: true as const };

  const res = await tx(async (c) => {
    const { ctx, items, total } = await planItems(inp, c, now);
    if (!ctx.unit.is_active || ctx.unit.branch_status !== "Active") throw notFound("الوحدة غير موجودة");
    const cust = validateCustomer(inp, ctx.unit.capacity, ctx.unit.allowed_category);
    const token = base62Token();
    const holdMin = num(s, "hold_minutes", 30);
    const holdExpires = new Date(now.getTime() + holdMin * 60000);
    const b = await c.query<{ id: number }>(
      `INSERT INTO bookings (status_token, unit_id, branch_id, source, customer_name, phone_e164, category, persons, notes,
         status, total, currency, exchange_rate, hold_expires_at, ip_hash, device_hash, created_at)
       VALUES ($1,$2,$3,'Online',$4,$5,$6,$7,$8,'Held',$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
      [token, inp.unitId, ctx.unit.branch_id, cust.name, g.phone, cust.category, cust.persons, cust.notes,
        total, s.currency || "USD", num(s, "exchange_rate", 0), holdExpires, inp.ipHash, inp.deviceHash, now]);
    try {
      await c.query("SAVEPOINT items");
      await insertItems(c, b.rows[0].id, inp.unitId, items);
    } catch (e) { mapInsertError(e); }
    return { id: b.rows[0].id, token, holdExpires, total, branchId: ctx.unit.branch_id };
  });
  invalidateUnit(inp.unitId);
  return {
    silent: false as const,
    id: res.id,
    token: res.token,
    holdExpiresAt: res.holdExpires.toISOString(),
    total: res.total,
    currency: s.currency || "USD",
    payment: await paymentInfo(res.branchId),
  };
}

export async function getBookingByToken(token: string, db?: Db) {
  if (!/^[0-9A-Za-z]{32}$/.test(token)) return null;
  await expireHolds(db);
  return one(
    `SELECT b.*, u.name AS unit_name, u.slug AS unit_slug, br.name AS branch_name, br.map_url, br.slug AS branch_slug,
            p.transaction_number, p.proof_kind,
            (SELECT min(lower(period)) FROM booking_items WHERE booking_id = b.id) AS starts_at,
            (SELECT max(upper(period)) FROM booking_items WHERE booking_id = b.id) AS ends_at
       FROM bookings b JOIN units u ON u.id = b.unit_id JOIN branches br ON br.id = b.branch_id
       LEFT JOIN payment_proofs p ON p.booking_id = b.id
      WHERE b.status_token = $1`, [token], db);
}

/** True if an Expired booking can still be revived (BR-31): its slots are free and not ended. */
export async function canLateUpload(bookingId: number, unitId: number, db?: Db, now = new Date()) {
  const r = await one<{ ok: boolean }>(
    `SELECT bool_and(upper(bi.period) > $3 AND NOT EXISTS (
        SELECT 1 FROM booking_items o WHERE o.unit_id = $2 AND o.is_active AND o.period && bi.period)) AS ok
       FROM booking_items bi WHERE bi.booking_id = $1`, [bookingId, unitId, now], db);
  return !!r?.ok;
}

/** POST /api/bookings/{token}/proof — BR-20, BR-21, BR-31, BR-35. */
export async function submitProof(token: string, transactionNumber: string, file: { buffer: Buffer; name: string }, now = new Date()) {
  const txn = (transactionNumber ?? "").trim();
  if (!/^[0-9A-Za-z\-]{4,40}$/.test(txn)) throw bad("أدخل رقم العملية كما يظهر في تطبيق شام كاش", "transactionNumber");
  const booking = await getBookingByToken(token);
  if (!booking) throw notFound("الطلب غير موجود");
  if (booking.status !== "Held" && booking.status !== "Expired") throw conflict("تم استلام الإشعار مسبقًا لهذا الطلب", "state");
  const dup = await one("SELECT 1 FROM payment_proofs WHERE transaction_number = $1", [txn]);
  if (dup) throw conflict("رقم العملية مستخدم مسبقًا", "duplicate");

  const proof: ValidProof = await validateProof(file.buffer);
  const rel = await storeProof(booking.id, proof, now);
  const branch = await one("SELECT review_start, review_end FROM branches WHERE id = $1", [booking.branch_id]);
  const times = computeReviewTimes(now, branch.review_start, branch.review_end);

  try {
    await tx(async (c) => {
      const cur = await c.query("SELECT status, hold_expires_at FROM bookings WHERE id = $1 FOR UPDATE", [booking.id]);
      let st = cur.rows[0].status as BookingStatus;
      if (st === "Held" && new Date(cur.rows[0].hold_expires_at) <= now) {
        await c.query("UPDATE bookings SET status = 'Expired' WHERE id = $1", [booking.id]);
        await c.query("UPDATE booking_items SET is_active = false WHERE booking_id = $1", [booking.id]);
        st = "Expired";
      }
      if (st === "Expired") {
        // BR-31: revive the items; the exclusion constraint decides.
        const ended = await c.query("SELECT 1 FROM booking_items WHERE booking_id = $1 AND upper(period) <= $2", [booking.id, now]);
        if (ended.rowCount) throw conflict(LATE_TAKEN_MSG, "late_taken");
        try {
          await c.query("SAVEPOINT revive");
          await c.query("UPDATE booking_items SET is_active = true WHERE booking_id = $1", [booking.id]);
        } catch (e) {
          if (pgCode(e) === "23P01") throw conflict(LATE_TAKEN_MSG, "late_taken");
          throw e;
        }
      } else if (st !== "Held") {
        throw conflict("تم استلام الإشعار مسبقًا لهذا الطلب", "state");
      }
      try {
        await c.query("SAVEPOINT proof");
        await c.query(
          `INSERT INTO payment_proofs (booking_id, transaction_number, proof_kind, file_path, original_name, size_bytes, page_count, uploaded_at, delete_after)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8, $8::timestamptz + interval '6 months')`,
          [booking.id, txn, proof.kind, rel, file.name?.slice(0, 120) || null, proof.sizeBytes, proof.pageCount, now]);
      } catch (e) { mapInsertError(e); }
      await c.query(
        `UPDATE bookings SET status = 'PendingReview', proof_at = $2, review_due_at = $3, alert_due_at = $4 WHERE id = $1`,
        [booking.id, now, times.dueAt, times.alertAt]);
    });
  } catch (e) {
    await removeProofFile(rel);
    throw e;
  }
  invalidateUnit(booking.unit_id);
  return { id: booking.id as number, within: times.within, reviewDueAt: times.dueAt.toISOString(), late: booking.status === "Expired" };
}

// ───────────────────────── Panel actions ─────────────────────────

export function assertPerm(user: SessionUser, perm: Parameters<SessionUser["permissions"]["has"]>[0]) {
  if (!user.permissions.has(perm)) throw forbidden();
}

/** Loads a booking scoped to the user's branch. Other branches → 404 (T-13). */
export async function branchBooking(user: SessionUser, id: number, db?: Db, lock = false) {
  if (user.role === "SuperAdmin" || !user.branchId) throw notFound();
  const b = await one(`SELECT * FROM bookings WHERE id = $1 AND branch_id = $2 ${lock ? "FOR UPDATE" : ""}`, [id, user.branchId], db);
  if (!b) throw notFound("الحجز غير موجود");
  return b;
}

export async function bookingMessageVars(bookingId: number, db?: Db) {
  const b = await one(
    `SELECT b.*, u.name AS unit_name, br.name AS branch_name, br.map_url,
            (SELECT min(lower(period)) FROM booking_items WHERE booking_id = b.id) AS starts_at,
            (SELECT max(upper(period)) FROM booking_items WHERE booking_id = b.id) AS ends_at,
            (SELECT min(day) FROM booking_items WHERE booking_id = b.id) AS first_day
       FROM bookings b JOIN units u ON u.id = b.unit_id JOIN branches br ON br.id = b.branch_id WHERE b.id = $1`, [bookingId], db);
  const s = await getSettings(db);
  return {
    b,
    vars: {
      "الاسم": b.customer_name, "الوحدة": b.unit_name, "الفرع": b.branch_name,
      "التاريخ": b.first_day ? fmtDayAr(b.first_day) : "", "البداية": b.starts_at ? fmtTime(b.starts_at) : "",
      "النهاية": b.ends_at ? fmtTime(b.ends_at) : "", "رابط الخريطة": b.map_url ?? "",
      "الثبوتيات": s.documents_text ?? "", "السبب": b.reject_reason ?? "",
    } as Record<string, string>,
  };
}

export async function whatsappFor(bookingId: number, tplKey: "confirm" | "reject", db?: Db) {
  const tpl = await one<{ body: string }>("SELECT body FROM message_templates WHERE key = $1", [tplKey], db);
  const { b, vars } = await bookingMessageVars(bookingId, db);
  return waLink(b.phone_e164, fillTemplate(tpl?.body ?? "", vars));
}

export type ReviewDecision = "Confirm" | "Reject" | "RejectAndBlock";

/** BR-25/26 — confirm / reject / reject-and-block. */
export async function reviewBooking(user: SessionUser, id: number, decision: ReviewDecision, reason?: string | null) {
  assertPerm(user, decision === "Confirm" ? "bookings.confirm" : decision === "Reject" ? "bookings.reject" : "bookings.block");
  const r = (reason ?? "").trim();
  if (decision !== "Confirm" && r.length < 3) throw bad("اكتب سبب الرفض", "reason");
  const result = await tx(async (c) => {
    const b = await branchBooking(user, id, c, true);
    if (b.status !== "PendingReview") throw conflict("تمت مراجعة هذا الطلب مسبقًا", "state");
    if (decision === "Confirm") {
      await c.query("UPDATE bookings SET status = 'Confirmed', reviewed_by = $2, reviewed_at = now() WHERE id = $1", [id, user.id]);
    } else {
      await c.query("UPDATE bookings SET status = 'Rejected', reviewed_by = $2, reviewed_at = now(), reject_reason = $3 WHERE id = $1", [id, user.id, r]);
      await c.query("UPDATE booking_items SET is_active = false WHERE booking_id = $1", [id]);
      if (decision === "RejectAndBlock") {
        const ids: [string, string | null][] = [["Phone", b.phone_e164], ["Ip", b.ip_hash], ["Device", b.device_hash]];
        for (const [kind, value] of ids) {
          if (!value) continue;
          await c.query(
            `INSERT INTO blocked_identities (branch_id, kind, value, label, reason, booking_id, blocked_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (kind, value) WHERE is_active DO NOTHING`,
            [user.branchId, kind, value, kind === "Phone" ? b.phone_e164 : `${b.customer_name} · ${kind === "Ip" ? "IP" : "جهاز"}`, r, id, user.id]);
        }
      }
    }
    await audit({ userId: user.id, branchId: user.branchId, action: decision, entity: "booking", entityId: id, details: r ? { reason: r } : undefined }, c);
    return b;
  });
  invalidateUnit(result.unit_id);
  return { whatsapp: await whatsappFor(id, decision === "Confirm" ? "confirm" : "reject") };
}

/** BR-29 — void a confirmed booking whose guests did not bring documents. */
export async function voidNoDocuments(user: SessionUser, id: number, now = new Date()) {
  assertPerm(user, "bookings.void");
  const b = await tx(async (c) => {
    const b = await branchBooking(user, id, c, true);
    if (b.status !== "Confirmed") throw conflict("يمكن الإلغاء لعدم الثبوتيات فقط للحجوزات المثبتة", "state");
    const st = await c.query("SELECT min(lower(period)) AS s FROM booking_items WHERE booking_id = $1", [id]);
    if (new Date(st.rows[0].s) > now) throw conflict("لا يمكن الإلغاء قبل بداية الحجز", "state");
    await c.query("UPDATE bookings SET status = 'VoidNoDocuments', reviewed_by = $2, reviewed_at = now() WHERE id = $1", [id, user.id]);
    await c.query("UPDATE booking_items SET is_active = false WHERE booking_id = $1", [id]);
    await audit({ userId: user.id, branchId: user.branchId, action: "VoidNoDocuments", entity: "booking", entityId: id }, c);
    return b;
  });
  invalidateUnit(b.unit_id);
}

export interface ManualInput extends SelectionInput, CustomerInput { transactionNumber?: string | null; file?: { buffer: Buffer; name: string } | null }

/** BR-34 — manual booking from the panel, Confirmed immediately. */
export async function createManual(user: SessionUser, inp: ManualInput, now = new Date()) {
  assertPerm(user, "bookings.manual");
  if (!user.branchId) throw forbidden();
  const unit = await one("SELECT id, branch_id FROM units WHERE id = $1 AND branch_id = $2", [inp.unitId, user.branchId]);
  if (!unit) throw notFound("الوحدة غير موجودة");
  const phone = normalizePhone(inp.phone);
  if (!phone) throw bad("رقم الواتساب غير صحيح", "phone");
  const txn = (inp.transactionNumber ?? "").trim() || null;
  if (txn && !/^[0-9A-Za-z\-]{4,40}$/.test(txn)) throw bad("رقم العملية غير صحيح", "transactionNumber");
  const proof = inp.file?.buffer?.length ? await validateProof(inp.file.buffer) : null;
  const s = await getSettings();
  await expireHolds();

  let rel: string | null = null;
  try {
    const id = await tx(async (c) => {
      const { ctx, items, total } = await planItems(inp, c, now);
      const cust = validateCustomer({ ...inp, phone }, ctx.unit.capacity, ctx.unit.allowed_category);
      const b = await c.query<{ id: number }>(
        `INSERT INTO bookings (status_token, unit_id, branch_id, source, customer_name, phone_e164, category, persons, notes,
           status, total, currency, exchange_rate, reviewed_by, reviewed_at, created_by, created_at, proof_at)
         VALUES ($1,$2,$3,'Manual',$4,$5,$6,$7,$8,'Confirmed',$9,$10,$11,$12,$13,$12,$13,$14) RETURNING id`,
        [base62Token(), inp.unitId, user.branchId, cust.name, phone, cust.category, cust.persons, cust.notes,
          total, s.currency || "USD", num(s, "exchange_rate", 0), user.id, now, txn || proof ? now : null]);
      const id = b.rows[0].id;
      try {
        await c.query("SAVEPOINT items");
        await insertItems(c, id, inp.unitId, items);
      } catch (e) {
        if (pgCode(e) === "23P01") throw conflict("الوقت المختار يتداخل مع حجز قائم", "slot_taken");
        throw e;
      }
      if (txn || proof) {
        if (proof) rel = await storeProof(id, proof, now);
        try {
          await c.query("SAVEPOINT proof");
          await c.query(
            `INSERT INTO payment_proofs (booking_id, transaction_number, proof_kind, file_path, original_name, size_bytes, page_count, uploaded_at, delete_after)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8, $8::timestamptz + interval '6 months')`,
            [id, txn, proof?.kind ?? null, rel, inp.file?.name?.slice(0, 120) ?? null, proof?.sizeBytes ?? null, proof?.pageCount ?? null, now]);
        } catch (e) { mapInsertError(e); }
      }
      await audit({ userId: user.id, branchId: user.branchId, action: "ManualBooking", entity: "booking", entityId: id, isManual: true, details: { total, items: items.length } }, c);
      return id;
    });
    invalidateUnit(inp.unitId);
    return { id, whatsapp: await whatsappFor(id, "confirm") };
  } catch (e) {
    if (rel) await removeProofFile(rel);
    throw e;
  }
}

/** BR-30 — Confirmed → Completed after the last item ends. */
export async function completeFinished(db?: Db) {
  const r = await q(
    `UPDATE bookings b SET status = 'Completed'
      WHERE b.status = 'Confirmed'
        AND (SELECT max(upper(period)) FROM booking_items WHERE booking_id = b.id) <= now()
      RETURNING id`, [], db);
  return r.length;
}

export { BLOCKED_MSG, AppError };
export type { Settings };

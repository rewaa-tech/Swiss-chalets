import { one, q, tx, pgCode, type Db } from "../db";
import { AppError, bad, conflict, notFound } from "../errors";
import { audit } from "../audit";
import { addDays, isValidDate, localToUtc, timeToMinutes } from "../time";
import type { SessionUser } from "../permissions";
import { assertPerm } from "./booking";
import { invalidateUnit, invalidateAll } from "./cache";
import { modeAllowed, type Mode, type SlotKind } from "./availability";

export class AffectedError extends AppError {
  constructor(message: string, public bookings: { id: number; customer_name: string; status: string; day: string }[]) {
    super(409, message, "affects_bookings");
  }
}

const ACTIVE = "('Held','PendingReview','Confirmed')";

export async function unitInBranch(user: SessionUser, unitId: number, db?: Db) {
  const u = await one("SELECT * FROM units WHERE id = $1 AND branch_id = $2", [unitId, user.branchId], db);
  if (!u) throw notFound("الوحدة غير موجودة");
  return u;
}

async function affected(sql: string, params: unknown[], db?: Db) {
  return q<{ id: number; customer_name: string; status: string; day: string }>(
    `SELECT DISTINCT b.id, b.customer_name, b.status, min(bi.day) OVER (PARTITION BY b.id) AS day
       FROM bookings b JOIN booking_items bi ON bi.booking_id = b.id
      WHERE b.status IN ${ACTIVE} AND bi.is_active AND ${sql}`, params, db);
}

/** Open/close days (BR-13: a day with an active booking cannot be closed). */
export async function setDays(user: SessionUser, unitIds: number[], days: string[], open: boolean) {
  assertPerm(user, "calendar.manage");
  if (!days.length || !unitIds.length) throw bad("اختر وحدة ويومًا واحدًا على الأقل");
  if (days.length > 400) throw bad("عدد الأيام كبير جدًا");
  for (const d of days) if (!isValidDate(d)) throw bad("تاريخ غير صحيح");
  await tx(async (c) => {
    for (const unitId of unitIds) {
      await unitInBranch(user, unitId, c);
      if (!open) {
        const hits: Awaited<ReturnType<typeof affected>> = [];
        for (const d of days) {
          const s = localToUtc(d), e = localToUtc(addDays(d, 1));
          hits.push(...(await affected("bi.unit_id = $1 AND bi.period && tstzrange($2,$3)", [unitId, s, e], c)));
        }
        if (hits.length) throw new AffectedError("لا يمكن إغلاق أيام فيها حجوزات قائمة", hits);
      }
      for (const d of days) {
        await c.query("INSERT INTO open_days (unit_id, day, is_open) VALUES ($1,$2,$3) ON CONFLICT (unit_id, day) DO UPDATE SET is_open = EXCLUDED.is_open", [unitId, d, open]);
      }
      invalidateUnit(unitId);
    }
    await audit({ userId: user.id, branchId: user.branchId, action: open ? "OpenDays" : "CloseDays", entity: "unit", entityId: unitIds.join(","), details: { days: days.length } }, c);
  });
}

export interface SeasonInput { kind: "Summer" | "Winter" | "Spring" | "Autumn"; start: string; end: string }

/** BR-01 — save the four seasons of a branch. Overlap is rejected by the DB constraint (T-11). */
export async function saveSeasons(user: SessionUser, seasons: SeasonInput[]) {
  assertPerm(user, "pricing.manage");
  for (const s of seasons) {
    if (!["Summer", "Winter", "Spring", "Autumn"].includes(s.kind)) throw bad("نوع موسم غير صحيح");
    if (!isValidDate(s.start) || !isValidDate(s.end)) throw bad("أدخل تاريخي البداية والنهاية لكل موسم", `season_${s.kind}`);
    if (s.end < s.start) throw bad("تاريخ النهاية قبل البداية", `season_${s.kind}`);
  }
  try {
    await tx(async (c) => {
      for (const s of seasons) {
        const old = await c.query("SELECT id, start_date, end_date FROM seasons WHERE branch_id = $1 AND kind = $2", [user.branchId, s.kind]);
        if (old.rowCount) {
          const o = old.rows[0];
          if (o.start_date !== s.start || o.end_date !== s.end) {
            // BR-13: bookings whose day leaves the season would change pricing/mode
            const hits = await affected(
              "bi.time_slot_id IN (SELECT id FROM time_slots WHERE season_id = $1) AND NOT (bi.day BETWEEN $2 AND $3)",
              [o.id, s.start, s.end], c);
            if (hits.length) throw new AffectedError("تغيير التواريخ يمس حجوزات قائمة", hits);
          }
          await c.query("UPDATE seasons SET start_date = $2, end_date = $3 WHERE id = $1", [o.id, s.start, s.end]);
        } else {
          await c.query("INSERT INTO seasons (branch_id, kind, start_date, end_date) VALUES ($1,$2,$3,$4)", [user.branchId, s.kind, s.start, s.end]);
        }
      }
      await audit({ userId: user.id, branchId: user.branchId, action: "SaveSeasons", entity: "branch", entityId: user.branchId, details: seasons }, c);
    });
  } catch (e) {
    if (pgCode(e) === "23P01") throw bad("المواسم متداخلة. لا يجوز أن يتقاطع موسمان", "seasons");
    throw e;
  }
  invalidateAll();
}

/** BR-02/03/13 — set the mode of a unit in a season. */
export async function setUnitMode(user: SessionUser, unitId: number, seasonId: number, mode: Mode | null) {
  assertPerm(user, "pricing.manage");
  await tx(async (c) => {
    await unitInBranch(user, unitId, c);
    const s = await one("SELECT id, kind FROM seasons WHERE id = $1 AND branch_id = $2", [seasonId, user.branchId], c);
    if (!s) throw notFound("الموسم غير موجود");
    if (mode && !modeAllowed(s.kind, mode)) throw bad("نمط المسبح غير مسموح في الربيع والخريف");
    const cur = await one<{ mode: Mode }>("SELECT mode FROM unit_season_modes WHERE unit_id = $1 AND season_id = $2", [unitId, seasonId], c);
    if ((cur?.mode ?? null) === mode) return;
    if (cur) {
      const hits = await affected("bi.unit_id = $1 AND bi.time_slot_id IN (SELECT id FROM time_slots WHERE season_id = $2)", [unitId, seasonId], c);
      if (hits.length) throw new AffectedError("لا يمكن تغيير النمط لوجود حجوزات قائمة في هذا الموسم", hits);
    }
    if (mode) await c.query("INSERT INTO unit_season_modes (unit_id, season_id, mode) VALUES ($1,$2,$3) ON CONFLICT (unit_id, season_id) DO UPDATE SET mode = EXCLUDED.mode", [unitId, seasonId, mode]);
    else await c.query("DELETE FROM unit_season_modes WHERE unit_id = $1 AND season_id = $2", [unitId, seasonId]);
    await audit({ userId: user.id, branchId: user.branchId, action: "SetMode", entity: "unit", entityId: unitId, details: { seasonId, mode } }, c);
  });
  invalidateUnit(unitId);
}

export interface SlotInput { id?: number; unitId: number; seasonId: number; kind: SlotKind; name: string; startTime: string; durationMinutes: number; price: number }

const DEFAULT_DUR: Record<SlotKind, number> = { Hours6: 360, Hours10: 600, FullDay: 1440, HotelNight: 1320 };

export function validateSlot(s: SlotInput) {
  if (!["Hours6", "Hours10", "FullDay", "HotelNight"].includes(s.kind)) throw bad("نوع الفترة غير صحيح", "kind");
  const name = (s.name ?? "").trim();
  if (name.length < 2 || name.length > 60) throw bad("اسم الفترة مطلوب (2–60 حرفًا)", "name");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.startTime)) throw bad("وقت البداية غير صحيح", "startTime");
  const dur = Math.trunc(Number(s.durationMinutes || DEFAULT_DUR[s.kind]));
  const max = s.kind === "HotelNight" ? 2880 : 1440;
  if (dur < 60 || dur > max) throw bad(`المدة يجب أن تكون بين 60 و${max} دقيقة`, "durationMinutes");
  const price = Number(s.price);
  if (!Number.isFinite(price) || price < 0) throw bad("السعر غير صحيح", "price");
  return { name, dur, price: Math.round(price * 100) / 100 };
}

export async function saveSlot(user: SessionUser, s: SlotInput) {
  assertPerm(user, "slots.manage");
  const v = validateSlot(s);
  return tx(async (c) => {
    await unitInBranch(user, s.unitId, c);
    const season = await one("SELECT id, kind FROM seasons WHERE id = $1 AND branch_id = $2", [s.seasonId, user.branchId], c);
    if (!season) throw notFound("الموسم غير موجود");
    let id = s.id;
    if (id) {
      const old = await one("SELECT * FROM time_slots WHERE id = $1 AND unit_id = $2", [id, s.unitId], c);
      if (!old) throw notFound("الفترة غير موجودة");
      const timingChanged = old.kind !== s.kind || old.start_time.slice(0, 5) !== s.startTime || old.duration_minutes !== v.dur || old.season_id !== s.seasonId;
      if (timingChanged) {
        const hits = await affected("bi.time_slot_id = $1 AND upper(bi.period) > now()", [id], c);
        if (hits.length) throw new AffectedError("لا يمكن تعديل توقيت فترة عليها حجوزات قائمة. السعر وحده قابل للتعديل", hits);
      }
      await c.query("UPDATE time_slots SET kind=$2, name=$3, start_time=$4, duration_minutes=$5, price=$6, season_id=$7 WHERE id=$1",
        [id, s.kind, v.name, s.startTime, v.dur, v.price, s.seasonId]);
    } else {
      const r = await c.query("INSERT INTO time_slots (unit_id, season_id, kind, name, start_time, duration_minutes, price) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id",
        [s.unitId, s.seasonId, s.kind, v.name, s.startTime, v.dur, v.price]);
      id = r.rows[0].id;
    }
    await audit({ userId: user.id, branchId: user.branchId, action: s.id ? "UpdateSlot" : "CreateSlot", entity: "time_slot", entityId: id, details: { price: v.price, kind: s.kind } }, c);
    invalidateUnit(s.unitId);
    return id!;
  });
}

export async function setSlotActive(user: SessionUser, slotId: number, active: boolean) {
  assertPerm(user, "slots.manage");
  await tx(async (c) => {
    const s = await one("SELECT ts.* FROM time_slots ts JOIN units u ON u.id = ts.unit_id WHERE ts.id = $1 AND u.branch_id = $2", [slotId, user.branchId], c);
    if (!s) throw notFound("الفترة غير موجودة");
    if (!active) {
      const hits = await affected("bi.time_slot_id = $1 AND upper(bi.period) > now()", [slotId], c);
      if (hits.length) throw new AffectedError("لا يمكن تعطيل فترة عليها حجوزات قائمة", hits);
    }
    await c.query("UPDATE time_slots SET is_active = $2 WHERE id = $1", [slotId, active]);
    await audit({ userId: user.id, branchId: user.branchId, action: active ? "EnableSlot" : "DisableSlot", entity: "time_slot", entityId: slotId }, c);
    invalidateUnit(s.unit_id);
  });
}

/** "Copy from unit" — preview (dryRun) or execute. Copies active slots + modes for the branch seasons. */
export async function copySlots(user: SessionUser, fromUnit: number, toUnit: number, dryRun: boolean) {
  assertPerm(user, "slots.manage");
  if (fromUnit === toUnit) throw bad("اختر وحدة مختلفة");
  return tx(async (c) => {
    await unitInBranch(user, fromUnit, c);
    await unitInBranch(user, toUnit, c);
    const slots = await q("SELECT ts.*, s.kind AS season_kind FROM time_slots ts JOIN seasons s ON s.id = ts.season_id WHERE ts.unit_id = $1 AND ts.is_active ORDER BY s.kind, ts.start_time", [fromUnit], c);
    const modes = await q("SELECT season_id, mode FROM unit_season_modes WHERE unit_id = $1", [fromUnit], c);
    if (dryRun) return { slots, modes };
    for (const m of modes) {
      const cur = await one("SELECT mode FROM unit_season_modes WHERE unit_id = $1 AND season_id = $2", [toUnit, m.season_id], c);
      if (!cur) await c.query("INSERT INTO unit_season_modes (unit_id, season_id, mode) VALUES ($1,$2,$3)", [toUnit, m.season_id, m.mode]);
    }
    for (const s of slots) {
      await c.query("INSERT INTO time_slots (unit_id, season_id, kind, name, start_time, duration_minutes, price) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [toUnit, s.season_id, s.kind, s.name, s.start_time, s.duration_minutes, s.price]);
    }
    await audit({ userId: user.id, branchId: user.branchId, action: "CopySlots", entity: "unit", entityId: toUnit, details: { fromUnit, count: slots.length } }, c);
    invalidateUnit(toUnit);
    return { slots, modes };
  });
}

/** Detects overlapping slots in the same unit+season (for the 24h bar). */
export function overlapsInDay(slots: { id: number; start_time: string; duration_minutes: number }[]) {
  const res = new Set<number>();
  for (const a of slots) for (const b of slots) {
    if (a.id >= b.id) continue;
    const as = timeToMinutes(a.start_time), ae = as + a.duration_minutes;
    const bs = timeToMinutes(b.start_time), be = bs + b.duration_minutes;
    if (as < be && bs < ae) { res.add(a.id); res.add(b.id); }
  }
  return res;
}

export { conflict };

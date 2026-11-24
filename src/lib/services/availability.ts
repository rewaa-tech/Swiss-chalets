import { q, one, type Db } from "../db";
import { addDays, localToUtc, monthDays, timeToMinutes, todayLocal, isValidDate } from "../time";
import { cacheGet, cacheSet, invalidateUnits } from "./cache";
import { notFound, bad } from "../errors";

export type SlotKind = "Hours6" | "Hours10" | "FullDay" | "HotelNight";
export type Mode = "Pool" | "Hotel";
export type DayState = "full" | "partial" | "unavailable";

export interface SeasonRow { id: number; branch_id: number; kind: "Summer" | "Winter" | "Spring" | "Autumn"; start_date: string; end_date: string }
export interface SlotRow { id: number; unit_id: number; season_id: number; kind: SlotKind; name: string; start_time: string; duration_minutes: number; price: number; is_active: boolean }
export interface UnitCtx {
  unit: { id: number; branch_id: number; capacity: number; allowed_category: string; is_active: boolean; branch_status: string };
  seasons: SeasonRow[];
  modes: Map<number, Mode>;
  slots: SlotRow[];
  openDays: Map<string, boolean>;
  busy: { s: number; e: number }[];
}

export const POOL_KINDS: SlotKind[] = ["Hours6", "Hours10", "FullDay"];

export function seasonFor(seasons: SeasonRow[], day: string): SeasonRow | undefined {
  return seasons.find((s) => s.start_date <= day && day <= s.end_date);
}

export function modeAllowed(kind: SeasonRow["kind"], mode: Mode) {
  return !(mode === "Pool" && (kind === "Spring" || kind === "Autumn")); // BR-03
}

export function slotPeriod(day: string, slot: Pick<SlotRow, "start_time" | "duration_minutes">) {
  const start = localToUtc(day, timeToMinutes(slot.start_time));
  return { start, end: new Date(start.getTime() + slot.duration_minutes * 60000) };
}

/** Lazy + scheduled hold expiry. Returns affected unit ids. */
export async function expireHolds(db?: Db): Promise<number[]> {
  const rows = await q<{ unit_id: number }>(
    `WITH e AS (
       UPDATE bookings SET status = 'Expired'
       WHERE status = 'Held' AND hold_expires_at <= now()
       RETURNING id, unit_id)
     , i AS (UPDATE booking_items bi SET is_active = false FROM e WHERE bi.booking_id = e.id RETURNING bi.id)
     SELECT DISTINCT unit_id FROM e`, [], db);
  const ids = rows.map((r) => r.unit_id);
  if (ids.length) invalidateUnits(ids);
  return ids;
}

export async function loadUnitCtx(unitId: number, from: string, to: string, db?: Db, includeInactiveUnit = false): Promise<UnitCtx> {
  const unit = await one(
    `SELECT u.id, u.branch_id, u.capacity, u.allowed_category, u.is_active, b.status AS branch_status
       FROM units u JOIN branches b ON b.id = u.branch_id WHERE u.id = $1`, [unitId], db);
  if (!unit || (!includeInactiveUnit && (!unit.is_active || unit.branch_status !== "Active"))) throw notFound("الوحدة غير موجودة");
  const rangeStart = localToUtc(addDays(from, -2)), rangeEnd = localToUtc(addDays(to, 3));
  // A transaction client must not run queries concurrently; the pool can.
  const run = <T,>(fns: (() => Promise<T>)[]) => (db ? fns.reduce<Promise<T[]>>(async (acc, f) => [...(await acc), await f()], Promise.resolve([])) : Promise.all(fns.map((f) => f())));
  const [seasons, modes, slots, open, busy] = (await run<any>([
    () => q<SeasonRow>("SELECT id, branch_id, kind, start_date, end_date FROM seasons WHERE branch_id = $1", [unit.branch_id], db),
    () => q<{ season_id: number; mode: Mode }>("SELECT season_id, mode FROM unit_season_modes WHERE unit_id = $1", [unitId], db),
    () => q<SlotRow>("SELECT * FROM time_slots WHERE unit_id = $1 AND is_active ORDER BY start_time, duration_minutes", [unitId], db),
    () => q<{ day: string; is_open: boolean }>("SELECT day, is_open FROM open_days WHERE unit_id = $1 AND day BETWEEN $2 AND $3", [unitId, addDays(from, -1), addDays(to, 15)], db),
    () => q<{ s: Date; e: Date }>("SELECT lower(period) AS s, upper(period) AS e FROM booking_items WHERE unit_id = $1 AND is_active AND period && tstzrange($2, $3)", [unitId, rangeStart, rangeEnd], db),
  ])) as [SeasonRow[], { season_id: number; mode: Mode }[], SlotRow[], { day: string; is_open: boolean }[], { s: Date; e: Date }[]];
  return {
    unit,
    seasons,
    modes: new Map(modes.map((m) => [m.season_id, m.mode])),
    slots,
    openDays: new Map(open.map((o) => [o.day, o.is_open])),
    busy: busy.map((b) => ({ s: new Date(b.s).getTime(), e: new Date(b.e).getTime() })),
  };
}

export interface DaySlot { slot: SlotRow; start: Date; end: Date; available: boolean; ended: boolean; taken: boolean }

/** Slots bookable on a given day (BR-09, BR-11, BR-32). */
export function daySlots(ctx: UnitCtx, day: string, now = new Date()): { slots: DaySlot[]; reason?: string; mode?: Mode; season?: SeasonRow } {
  if (ctx.openDays.get(day) !== true) return { slots: [], reason: "closed" };
  const season = seasonFor(ctx.seasons, day);
  if (!season) return { slots: [], reason: "no_season" };
  const mode = ctx.modes.get(season.id);
  if (!mode || !modeAllowed(season.kind, mode)) return { slots: [], reason: "no_mode", season };
  const kinds: SlotKind[] = mode === "Pool" ? POOL_KINDS : ["HotelNight"];
  const slots = ctx.slots
    .filter((s) => s.season_id === season.id && kinds.includes(s.kind))
    .map((slot) => {
      const { start, end } = slotPeriod(day, slot);
      const ended = end.getTime() <= now.getTime();
      const taken = ctx.busy.some((b) => b.s < end.getTime() && start.getTime() < b.e);
      return { slot, start, end, ended, taken, available: !ended && !taken };
    });
  return { slots, mode, season };
}

export interface CalendarDay { date: string; state: DayState; freeSlots: number; minPrice: number | null }

export function computeCalendar(ctx: UnitCtx, month: string, now = new Date()): CalendarDay[] {
  const today = todayLocal(now);
  return monthDays(month).map((date) => {
    if (date < today) return { date, state: "unavailable" as const, freeSlots: 0, minPrice: null };
    const { slots } = daySlots(ctx, date, now);
    const live = slots.filter((s) => !s.ended);
    const free = live.filter((s) => s.available);
    if (!free.length) return { date, state: "unavailable" as const, freeSlots: 0, minPrice: null };
    return {
      date,
      state: free.length === live.length ? ("full" as const) : ("partial" as const),
      freeSlots: free.length,
      minPrice: Math.min(...free.map((s) => s.slot.price)),
    };
  });
}

export async function getCalendar(unitId: number, month: string): Promise<CalendarDay[]> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw bad("صيغة الشهر غير صحيحة");
  await expireHolds();
  const key = `u:${unitId}:cal:${month}`;
  const hit = cacheGet<CalendarDay[]>(key);
  if (hit) return hit;
  const days = monthDays(month);
  const ctx = await loadUnitCtx(unitId, days[0], days[days.length - 1]);
  const res = computeCalendar(ctx, month);
  cacheSet(key, res);
  return res;
}

export async function getSlots(unitId: number, date: string, opts: { includeInactiveUnit?: boolean } = {}) {
  if (!isValidDate(date)) throw bad("صيغة التاريخ غير صحيحة");
  await expireHolds();
  const ctx = await loadUnitCtx(unitId, date, date, undefined, opts.includeInactiveUnit);
  const { slots, mode } = daySlots(ctx, date);
  return {
    mode: mode ?? null,
    slots: slots.map((s) => ({
      slotId: s.slot.id, name: s.slot.name, kind: s.slot.kind,
      start: s.start.toISOString(), end: s.end.toISOString(),
      price: s.slot.price, available: s.available,
    })),
  };
}

/** Current season kind for a branch (for theming and the "current season" strip). */
export async function currentSeason(branchId: number, now = new Date()) {
  const day = todayLocal(now);
  return one<SeasonRow>("SELECT id, branch_id, kind, start_date, end_date FROM seasons WHERE branch_id = $1 AND $2::date BETWEEN start_date AND end_date", [branchId, day]);
}

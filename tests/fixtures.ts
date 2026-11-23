import { q, one } from "../src/lib/db";
import { formStamp } from "../src/lib/crypto";
import { effectivePermissions, type Permission, type SessionUser } from "../src/lib/permissions";
import { invalidateAll } from "../src/lib/services/cache";
import { invalidateSettings } from "../src/lib/settings";
import { addDays, todayLocal } from "../src/lib/time";

let n = 0;
export const uid = () => `${Date.now().toString(36)}${(n++).toString(36)}`;

/** A future day well inside the test summer season. */
export const DAY = addDays(todayLocal(), 20);

export async function makeBranch() {
  const slug = `br-${uid()}`;
  const b = await one("INSERT INTO branches (name, slug, city, status, review_start, review_end) VALUES ($1,$2,'test','Active','09:00','23:00') RETURNING id", [`فرع ${slug}`, slug]);
  return b.id as number;
}

/** Seasons around DAY: summer covers DAY±60, spring before, winter after. */
export async function makeSeasons(branchId: number) {
  const s = await one("INSERT INTO seasons (branch_id, kind, start_date, end_date) VALUES ($1,'Summer',$2,$3) RETURNING id", [branchId, addDays(DAY, -60), addDays(DAY, 60)]);
  const w = await one("INSERT INTO seasons (branch_id, kind, start_date, end_date) VALUES ($1,'Winter',$2,$3) RETURNING id", [branchId, addDays(DAY, 61), addDays(DAY, 150)]);
  const sp = await one("INSERT INTO seasons (branch_id, kind, start_date, end_date) VALUES ($1,'Spring',$2,$3) RETURNING id", [branchId, addDays(DAY, -150), addDays(DAY, -61)]);
  return { summer: s.id as number, winter: w.id as number, spring: sp.id as number };
}

export async function makeUnit(branchId: number, opts: { allowed?: string; capacity?: number } = {}) {
  const u = await one("INSERT INTO units (branch_id, name, slug, capacity, allowed_category) VALUES ($1,$2,$3,$4,$5) RETURNING id",
    [branchId, `وحدة ${uid()}`, `u-${uid()}`, opts.capacity ?? 8, opts.allowed ?? "FamilyAndYouth"]);
  return u.id as number;
}

export async function setMode(unitId: number, seasonId: number, mode: "Pool" | "Hotel") {
  await q("INSERT INTO unit_season_modes (unit_id, season_id, mode) VALUES ($1,$2,$3) ON CONFLICT (unit_id, season_id) DO UPDATE SET mode = EXCLUDED.mode", [unitId, seasonId, mode]);
}

export async function addSlot(unitId: number, seasonId: number, kind: string, start: string, minutes: number, price: number) {
  const r = await one("INSERT INTO time_slots (unit_id, season_id, kind, name, start_time, duration_minutes, price) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id",
    [unitId, seasonId, kind, kind, start, minutes, price]);
  return r.id as number;
}

export async function openDays(unitId: number, from: string, count: number) {
  for (let i = 0; i < count; i++) await q("INSERT INTO open_days (unit_id, day, is_open) VALUES ($1,$2,true) ON CONFLICT DO NOTHING", [unitId, addDays(from, i)]);
}

/** Pool unit in summer with 6h morning (10:00), 6h evening (17:00), and a full day (12:00→12:00). */
export async function poolUnit(opts: { allowed?: string } = {}) {
  const branchId = await makeBranch();
  const seasons = await makeSeasons(branchId);
  const unitId = await makeUnit(branchId, opts);
  await setMode(unitId, seasons.summer, "Pool");
  const morning = await addSlot(unitId, seasons.summer, "Hours6", "10:00", 360, 50);
  const evening = await addSlot(unitId, seasons.summer, "Hours6", "17:00", 360, 60);
  const fullDay = await addSlot(unitId, seasons.summer, "FullDay", "12:00", 1440, 120);
  await openDays(unitId, addDays(DAY, -2), 6);
  invalidateAll();
  return { branchId, seasons, unitId, morning, evening, fullDay };
}

export function holdInput(unitId: number, slotId: number, over: Record<string, unknown> = {}) {
  const k = uid();
  return {
    unitId, slotId, date: DAY, name: "زبون تجريبي", phone: `09${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`,
    category: "Family", persons: 4, notes: null, honeypot: "", formStamp: formStamp(Date.now() - 10_000),
    ipHash: `ip-${k}`, deviceHash: `dev-${k}`, ...over,
  };
}

export async function makeUser(branchId: number | null, role: "BranchManager" | "Staff" | "SuperAdmin", perms: Permission[] = []): Promise<SessionUser> {
  const u = await one("INSERT INTO app_users (username, display_name, password_hash, role, branch_id, security_stamp, must_change_password) VALUES ($1,$1,'x',$2,$3,'s',false) RETURNING id",
    [`user-${uid()}`, role, branchId]);
  for (const p of perms) await q("INSERT INTO user_permissions (user_id, permission) VALUES ($1,$2)", [u.id, p]);
  return { id: u.id, username: "u", displayName: "u", role, branchId, permissions: effectivePermissions(role, perms), mustChangePassword: false };
}

export function resetCaches() { invalidateAll(); invalidateSettings(); }

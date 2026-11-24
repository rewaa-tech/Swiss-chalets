import "server-only";
import { one, tx, pgCode } from "../db";
import { bad, forbidden, notFound } from "../errors";
import { audit } from "../audit";
import { hashPassword, validatePassword, rotateStamp } from "../auth";
import { randomHex } from "../crypto";
import { assertCanGrant, withDependencies, PERMISSIONS, type Permission, type SessionUser } from "../permissions";

export interface AccountInput {
  role: "BranchManager" | "Staff";
  branchId: number;
  username: string;
  displayName: string;
  password: string;
  /** Requested permissions; dependencies are added automatically. */
  perms: string[];
  /** Branch managers only: false = every branch permission (default). */
  customManagerPerms?: boolean;
}

/** v3 §6 — validates the grant (never beyond what the grantor holds) and returns the final set. */
export function resolveGrant(grantor: SessionUser, requested: string[]): Permission[] {
  const perms = [...withDependencies(requested)];
  const denied = assertCanGrant(grantor, perms);
  if (denied) throw forbidden(`لا يمكنك منح صلاحية لا تملكها: ${PERMISSIONS[denied].label}`);
  return perms;
}

export async function createAccount(grantor: SessionUser, inp: AccountInput) {
  if (inp.role === "BranchManager" && grantor.role !== "SuperAdmin") throw forbidden();
  if (inp.role === "Staff" && (grantor.role === "SuperAdmin" ? false : grantor.branchId !== inp.branchId)) throw forbidden();
  if (!/^[A-Za-z0-9._-]{3,32}$/.test(inp.username)) throw bad("اسم المستخدم: 3–32 حرفًا لاتينيًا أو أرقام", "username");
  if (inp.displayName.trim().length < 2) throw bad("الاسم مطلوب", "display_name");
  const pv = validatePassword(inp.password); if (pv) throw bad(pv, "password");
  if (!(await one("SELECT 1 FROM branches WHERE id = $1", [inp.branchId]))) throw bad("اختر الفرع", "branch_id");
  const custom = inp.role === "Staff" || !!inp.customManagerPerms;
  const perms = custom ? resolveGrant(grantor, inp.perms) : [];
  if (inp.role === "Staff" && !perms.length) throw bad("اختر صلاحية واحدة على الأقل", "perms");
  const hash = await hashPassword(inp.password);
  try {
    return await tx(async (c) => {
      const r = await c.query(
        `INSERT INTO app_users (username, display_name, password_hash, role, branch_id, security_stamp, must_change_password, created_by, perms_custom)
         VALUES ($1,$2,$3,$4,$5,$6,true,$7,$8) RETURNING id`,
        [inp.username, inp.displayName.trim(), hash, inp.role, inp.branchId, randomHex(16), grantor.id, inp.role === "BranchManager" && custom]);
      const id = r.rows[0].id as number;
      for (const p of perms) await c.query("INSERT INTO user_permissions (user_id, permission) VALUES ($1,$2)", [id, p]);
      await audit({ userId: grantor.id, branchId: inp.branchId, action: inp.role === "Staff" ? "CreateStaff" : "CreateManager", entity: "user", entityId: id,
        details: { username: inp.username, perms: custom ? perms : "all" } }, c);
      return id;
    });
  } catch (e) {
    if (pgCode(e) === "23505") throw bad("اسم المستخدم مستخدم مسبقًا", "username");
    throw e;
  }
}

/**
 * Replaces an account's permissions. Takes effect on the very next request: permissions
 * are re-read from the database for every request (no stale session copy).
 */
export async function setAccountPermissions(grantor: SessionUser, targetId: number, requested: string[], customManagerPerms = true) {
  if (targetId === grantor.id) throw forbidden("لا يمكنك تعديل صلاحياتك بنفسك");
  const t = await one<{ id: number; role: string; branch_id: number | null; perms: string[]; perms_custom: boolean }>(
    `SELECT a.id, a.role, a.branch_id, a.perms_custom, COALESCE(array_agg(p.permission) FILTER (WHERE p.permission IS NOT NULL), '{}') AS perms
       FROM app_users a LEFT JOIN user_permissions p ON p.user_id = a.id WHERE a.id = $1 GROUP BY a.id`, [targetId]);
  if (!t) throw notFound("الحساب غير موجود");
  if (grantor.role !== "SuperAdmin") {
    // Branch side: only staff of the same branch.
    if (t.role !== "Staff" || t.branch_id !== grantor.branchId) throw notFound("الموظف غير موجود");
  } else if (t.role === "SuperAdmin") throw forbidden();
  const custom = t.role === "Staff" || customManagerPerms;
  const perms = custom ? resolveGrant(grantor, requested) : [];
  if (t.role === "Staff" && !perms.length) throw bad("اختر صلاحية واحدة على الأقل", "perms");
  await tx(async (c) => {
    await c.query("DELETE FROM user_permissions WHERE user_id = $1", [targetId]);
    for (const p of perms) await c.query("INSERT INTO user_permissions (user_id, permission) VALUES ($1,$2)", [targetId, p]);
    if (t.role === "BranchManager") await c.query("UPDATE app_users SET perms_custom = $2 WHERE id = $1", [targetId, custom]);
    await audit({ userId: grantor.id, branchId: t.branch_id, action: "UpdatePermissions", entity: "user", entityId: targetId,
      details: { before: t.role === "BranchManager" && !t.perms_custom ? "all" : t.perms, after: custom ? perms : "all" } }, c);
  });
}

export async function setAccountActive(grantor: SessionUser, targetId: number, active: boolean) {
  if (targetId === grantor.id) throw bad("لا يمكنك تعطيل حسابك");
  const t = await one<{ role: string; branch_id: number | null }>("SELECT role, branch_id FROM app_users WHERE id = $1", [targetId]);
  if (!t) throw notFound("الحساب غير موجود");
  if (grantor.role !== "SuperAdmin" && (t.role !== "Staff" || t.branch_id !== grantor.branchId)) throw notFound("الموظف غير موجود");
  await tx(async (c) => {
    await c.query("UPDATE app_users SET is_active = $2 WHERE id = $1", [targetId, active]);
    await audit({ userId: grantor.id, branchId: t.branch_id, action: active ? "EnableUser" : "DisableUser", entity: "user", entityId: targetId }, c);
  });
  if (!active) await rotateStamp(targetId);
}

/** Readable temporary password: letters + digits, satisfies validatePassword. */
export function tempPassword() {
  const abc = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
  const bytes = randomHex(12);
  let s = "";
  for (let i = 0; i < 8; i++) s += abc[parseInt(bytes.slice(i, i + 2), 16) % abc.length];
  return `${s}${parseInt(bytes.slice(16, 20), 16) % 90 + 10}`;
}

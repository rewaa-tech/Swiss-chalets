import "server-only";
import { cache } from "react";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect, notFound as nextNotFound, forbidden as nextForbidden } from "next/navigation";
import { one, q } from "./db";
import { randomHex, sha256 } from "./crypto";
import { effectivePermissions, type Permission, type SessionUser, type Role } from "./permissions";
import { notFound, forbidden } from "./errors";

export const SESSION_COOKIE = "sc_sess";
const SESSION_DAYS = 14;

export const hashPassword = (p: string) => bcrypt.hash(p, 11);
export const verifyPassword = (p: string, h: string) => bcrypt.compare(p, h);

export function validatePassword(p: string): string | null {
  if (!p || p.length < 10) return "كلمة المرور يجب أن تكون 10 أحرف على الأقل";
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return "كلمة المرور يجب أن تحتوي على حروف وأرقام";
  return null;
}

export async function createSession(userId: number, stamp: string) {
  const token = randomHex(32);
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000);
  await q("INSERT INTO user_sessions (id, user_id, security_stamp, expires_at) VALUES ($1,$2,$3,$4)", [sha256(token), userId, stamp, expires]);
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires });
}

export async function destroySession() {
  const c = await cookies();
  const t = c.get(SESSION_COOKIE)?.value;
  if (t) await q("DELETE FROM user_sessions WHERE id = $1", [sha256(t)]);
  c.delete(SESSION_COOKIE);
}

export async function userFromToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const u = await one(
    `SELECT u.id, u.username, u.display_name, u.role, u.branch_id, u.must_change_password, u.perms_custom,
            COALESCE(array_agg(p.permission) FILTER (WHERE p.permission IS NOT NULL), '{}') AS perms
       FROM user_sessions s JOIN app_users u ON u.id = s.user_id
       LEFT JOIN user_permissions p ON p.user_id = u.id
      WHERE s.id = $1 AND s.expires_at > now() AND u.is_active AND u.security_stamp = s.security_stamp
        AND (u.branch_id IS NULL OR EXISTS (SELECT 1 FROM branches b WHERE b.id = u.branch_id))
      GROUP BY u.id`, [sha256(token)]);
  if (!u) return null;
  return {
    id: u.id, username: u.username, displayName: u.display_name, role: u.role as Role, branchId: u.branch_id,
    permissions: effectivePermissions(u.role, u.perms, u.perms_custom), mustChangePassword: u.must_change_password,
  };
}

export const currentUser = cache(async (): Promise<SessionUser | null> => userFromToken((await cookies()).get(SESSION_COOKIE)?.value));

/** For pages: redirects to login when signed out. */
export async function requireUser(area: "branch" | "admin", perm?: Permission): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) redirect(`/login?next=/${area}`);
  if (u.mustChangePassword) redirect("/account/password");
  if (area === "admin" && u.role !== "SuperAdmin") nextNotFound();
  if (area === "branch" && u.role === "SuperAdmin") redirect("/admin");
  if (perm && !u.permissions.has(perm)) nextForbidden();
  return u;
}

/** Page-level permission gate → real 403. */
export function requirePerm(u: SessionUser, perm: Permission) {
  if (!u.permissions.has(perm)) nextForbidden();
}

/** For server actions / API: throws instead of redirecting. */
export async function actionUser(area: "branch" | "admin", perm?: Permission): Promise<SessionUser> {
  const u = await currentUser();
  if (!u || u.mustChangePassword) throw forbidden("انتهت الجلسة، سجّل الدخول مجددًا");
  if (area === "admin" && u.role !== "SuperAdmin") throw notFound();
  if (area === "branch" && (u.role === "SuperAdmin" || !u.branchId)) throw notFound();
  if (perm && !u.permissions.has(perm)) throw forbidden();
  return u;
}

/** Disabling or changing a password rotates the stamp → all sessions end immediately. */
export async function rotateStamp(userId: number) {
  await q("UPDATE app_users SET security_stamp = $2 WHERE id = $1", [userId, randomHex(16)]);
  await q("DELETE FROM user_sessions WHERE user_id = $1", [userId]);
}

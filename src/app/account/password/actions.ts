"use server";
import { redirect } from "next/navigation";
import { one, q } from "@/lib/db";
import { currentUser, hashPassword, verifyPassword, validatePassword, rotateStamp, createSession } from "@/lib/auth";
import { randomHex } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import type { ActionState } from "@/lib/actions";

export async function changePassword(_: ActionState | null, fd: FormData): Promise<ActionState> {
  const u = await currentUser();
  if (!u) redirect("/login");
  const cur = String(fd.get("current") ?? ""), next = String(fd.get("next") ?? ""), again = String(fd.get("again") ?? "");
  const row = await one("SELECT password_hash FROM app_users WHERE id = $1", [u.id]);
  if (!(await verifyPassword(cur, row.password_hash))) return { ok: false, message: "كلمة المرور الحالية غير صحيحة", field: "current", at: Date.now() };
  const v = validatePassword(next);
  if (v) return { ok: false, message: v, field: "next", at: Date.now() };
  if (next !== again) return { ok: false, message: "كلمتا المرور غير متطابقتين", field: "again", at: Date.now() };
  if (next === cur) return { ok: false, message: "اختر كلمة مرور جديدة مختلفة", field: "next", at: Date.now() };
  const stamp = randomHex(16);
  await q("UPDATE app_users SET password_hash = $2, must_change_password = false WHERE id = $1", [u.id, await hashPassword(next)]);
  await rotateStamp(u.id);
  await q("UPDATE app_users SET security_stamp = $2 WHERE id = $1", [u.id, stamp]);
  await createSession(u.id, stamp);
  await audit({ userId: u.id, branchId: u.branchId, action: "ChangePassword", entity: "user", entityId: u.id });
  redirect(u.role === "SuperAdmin" ? "/admin?ok=تم تغيير كلمة المرور" : "/branch?ok=تم تغيير كلمة المرور");
}

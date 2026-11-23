"use server";
import { redirect } from "next/navigation";
import { one, q } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { allow } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import type { ActionState } from "@/lib/actions";

export async function login(_: ActionState | null, fd: FormData): Promise<ActionState> {
  const ip = await clientIp();
  if (!allow(`login-action:${ip}`, Number(process.env.LOGIN_RATE_LIMIT ?? 5))) return { ok: false, message: "محاولات كثيرة. انتظر دقيقة وحاول مجددًا", at: Date.now() };
  const username = String(fd.get("username") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  const u = await one("SELECT id, password_hash, security_stamp, role, is_active, must_change_password FROM app_users WHERE lower(username) = lower($1)", [username]);
  const ok = u && u.is_active && (await verifyPassword(password, u.password_hash));
  if (!ok) return { ok: false, message: "اسم المستخدم أو كلمة المرور غير صحيحة", at: Date.now() };
  await createSession(u.id, u.security_stamp);
  await q("UPDATE app_users SET last_login_at = now() WHERE id = $1", [u.id]);
  const next = String(fd.get("next") ?? "");
  redirect(u.must_change_password ? "/account/password" : u.role === "SuperAdmin" ? "/admin" : next.startsWith("/branch") ? next : "/branch");
}

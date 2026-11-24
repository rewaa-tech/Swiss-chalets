"use server";
import { revalidatePath } from "next/cache";
import { actionUser, hashPassword, validatePassword, rotateStamp } from "@/lib/auth";
import { one, q, tx, pgCode } from "@/lib/db";
import { run, str, int, bool, fileBuf, type ActionState } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { bad, notFound } from "@/lib/errors";
import { normalizePhone } from "@/lib/phone";
import { setSetting, invalidateSettings } from "@/lib/settings";
import { randomHex } from "@/lib/crypto";
import { saveResponsiveImage, deleteResponsiveImage } from "@/lib/services/media";
import { invalidateAll } from "@/lib/services/cache";

type S = ActionState | null;

// ───────── Branches ─────────
export async function branchAction(_: S, fd: FormData) {
  return run(async () => {
    const u = await actionUser("admin");
    const id = int(fd, "id");
    const name = str(fd, "name"), slug = str(fd, "slug").toLowerCase();
    if (name.length < 2) throw bad("اسم الفرع مطلوب", "name");
    if (!/^[a-z0-9-]{2,40}$/.test(slug)) throw bad("الرابط المختصر: حروف لاتينية صغيرة وأرقام وشرطة", "slug");
    const status = ["Active", "ComingSoon", "Hidden"].includes(str(fd, "status")) ? str(fd, "status") : "Active";
    const map = str(fd, "map_url");
    if (map && !/^https:\/\//.test(map)) throw bad("رابط الخريطة يجب أن يبدأ بـ https://", "map_url");
    const vals = [name, slug, str(fd, "city"), str(fd, "description").slice(0, 1000), map || null, status, int(fd, "sort_order") || 0];
    const cover = await fileBuf(fd, "cover");
    try {
      const bid = await tx(async (c) => {
        let bid = id;
        if (id) await c.query("UPDATE branches SET name=$2, slug=$3, city=$4, description=$5, map_url=$6, status=$7, sort_order=$8 WHERE id=$1", [id, ...vals]);
        else bid = (await c.query("INSERT INTO branches (name, slug, city, description, map_url, status, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id", vals)).rows[0].id;
        await audit({ userId: u.id, branchId: bid, action: id ? "UpdateBranch" : "CreateBranch", entity: "branch", entityId: bid, details: { name, status } }, c);
        return bid;
      });
      if (cover) {
        const img = await saveResponsiveImage(cover.buffer, `branches/${bid}`);
        const old = await one("SELECT cover_media_path FROM branches WHERE id = $1", [bid]);
        await q("UPDATE branches SET cover_media_path = $2 WHERE id = $1", [bid, img.base]);
        if (old?.cover_media_path) await deleteResponsiveImage(old.cover_media_path);
      }
    } catch (e) { if (pgCode(e) === "23505") throw bad("الرابط المختصر مستخدم لفرع آخر", "slug"); throw e; }
    invalidateAll();
    revalidatePath("/admin/branches");
    return id ? "تم حفظ الفرع" : "تمت إضافة الفرع";
  });
}

// ───────── Users ─────────
export async function managerAction(_: S, fd: FormData) {
  return run(async () => {
    const u = await actionUser("admin");
    const username = str(fd, "username"), display = str(fd, "display_name"), pass = String(fd.get("password") ?? "");
    const branchId = int(fd, "branch_id");
    if (!/^[A-Za-z0-9._-]{3,32}$/.test(username)) throw bad("اسم المستخدم: 3–32 حرفًا لاتينيًا أو أرقام", "username");
    if (display.length < 2) throw bad("الاسم مطلوب", "display_name");
    if (!(await one("SELECT 1 FROM branches WHERE id = $1", [branchId]))) throw bad("اختر الفرع", "branch_id");
    const pv = validatePassword(pass); if (pv) throw bad(pv, "password");
    try {
      const r = await one("INSERT INTO app_users (username, display_name, password_hash, role, branch_id, security_stamp, must_change_password, created_by) VALUES ($1,$2,$3,'BranchManager',$4,$5,true,$6) RETURNING id",
        [username, display, await hashPassword(pass), branchId, randomHex(16), u.id]);
      await audit({ userId: u.id, branchId, action: "CreateManager", entity: "user", entityId: r.id, details: { username } });
    } catch (e) { if (pgCode(e) === "23505") throw bad("اسم المستخدم مستخدم مسبقًا", "username"); throw e; }
    revalidatePath("/admin/users");
    return "تمت إضافة المدير. سيُطلب منه تغيير كلمة المرور بأول دخول";
  });
}

export async function userActiveAction(_: S, fd: FormData) {
  return run(async () => {
    const u = await actionUser("admin");
    const id = int(fd, "id"), active = str(fd, "active") === "1";
    if (id === u.id) throw bad("لا يمكنك تعطيل حسابك");
    const t = await one("SELECT id, branch_id FROM app_users WHERE id = $1", [id]);
    if (!t) throw notFound();
    await q("UPDATE app_users SET is_active = $2 WHERE id = $1", [id, active]);
    if (!active) await rotateStamp(id);
    await audit({ userId: u.id, branchId: t.branch_id, action: active ? "EnableUser" : "DisableUser", entity: "user", entityId: id });
    revalidatePath("/admin/users");
    return active ? "تم تفعيل الحساب" : "تم تعطيل الحساب وإنهاء جلساته";
  });
}

export async function resetPasswordAction(_: S, fd: FormData) {
  return run(async () => {
    const u = await actionUser("admin");
    const id = int(fd, "id");
    const t = await one("SELECT id, branch_id FROM app_users WHERE id = $1", [id]);
    if (!t) throw notFound();
    const temp = `Sc${randomHex(5)}${Math.floor(Math.random() * 90 + 10)}`;
    await q("UPDATE app_users SET password_hash = $2, must_change_password = true WHERE id = $1", [id, await hashPassword(temp)]);
    await rotateStamp(id);
    await audit({ userId: u.id, branchId: t.branch_id, action: "ResetPassword", entity: "user", entityId: id });
    revalidatePath("/admin/users");
    return { message: "تم إنشاء كلمة مرور مؤقتة", data: { temp, id } };
  });
}

// ───────── Contacts ─────────
export async function contactAction(_: S, fd: FormData) {
  return run(async () => {
    const u = await actionUser("admin");
    const id = int(fd, "id");
    if (str(fd, "op") === "toggle") {
      await q("UPDATE contact_numbers SET is_active = NOT is_active WHERE id = $1", [id]);
      revalidatePath("/admin/contacts"); return "تم التحديث";
    }
    if (str(fd, "op") === "default") {
      await tx(async (c) => { await c.query("UPDATE contact_numbers SET is_default = false WHERE is_default"); await c.query("UPDATE contact_numbers SET is_default = true WHERE id = $1", [id]); });
      await audit({ userId: u.id, action: "SetDefaultContact", entity: "contact", entityId: id });
      revalidatePath("/admin/contacts"); return "تم تعيين الرقم الافتراضي";
    }
    const label = str(fd, "label"), phone = normalizePhone(str(fd, "phone"));
    if (label.length < 2) throw bad("اكتب وصفًا للرقم", "label");
    if (!phone) throw bad("رقم غير صحيح", "phone");
    const branchId = int(fd, "branch_id") || null;
    const any = await one("SELECT 1 FROM contact_numbers LIMIT 1");
    if (id) await q("UPDATE contact_numbers SET label=$2, phone_e164=$3, branch_id=$4 WHERE id=$1", [id, label, phone, branchId]);
    else await q("INSERT INTO contact_numbers (label, phone_e164, branch_id, is_default) VALUES ($1,$2,$3,$4)", [label, phone, branchId, !any]);
    await audit({ userId: u.id, action: id ? "UpdateContact" : "CreateContact", entity: "contact", entityId: id || null, details: { label, phone } });
    revalidatePath("/admin/contacts");
    return id ? "تم حفظ الرقم" : "تمت إضافة الرقم";
  });
}

export async function pageContactAction(_: S, fd: FormData) {
  return run(async () => {
    const u = await actionUser("admin");
    const type = str(fd, "page_type");
    if (!["Home", "Branch", "Unit", "Booking", "Terms", "My"].includes(type)) throw bad("نوع صفحة غير صحيح");
    const entity = int(fd, "entity_id") || null, contact = int(fd, "contact_id") || null;
    await q("DELETE FROM page_contacts WHERE page_type = $1 AND COALESCE(entity_id, 0) = COALESCE($2::int, 0)", [type, entity]);
    if (contact) await q("INSERT INTO page_contacts (page_type, entity_id, contact_id) VALUES ($1,$2,$3)", [type, entity, contact]);
    await audit({ userId: u.id, action: "MapPageContact", entity: "page_contact", entityId: `${type}:${entity ?? "*"}`, details: { contact } });
    revalidatePath("/admin/contacts");
    return contact ? "تم ربط الرقم بالصفحة" : "تمت إزالة الربط";
  });
}

// ───────── Settings & templates ─────────
const LIMIT_KEYS: [string, number, number][] = [["hold_minutes", 5, 240], ["max_active_per_phone", 1, 20], ["max_daily_per_ip", 1, 100], ["max_daily_per_device", 1, 100], ["min_fill_seconds", 0, 120]];

export async function settingsAction(_: S, fd: FormData) {
  return run(async () => {
    const u = await actionUser("admin");
    const currency = str(fd, "currency").toUpperCase() || "USD";
    if (!/^[A-Z]{3}$/.test(currency)) throw bad("رمز العملة 3 أحرف (مثل USD)", "currency");
    const rate = Number(fd.get("exchange_rate"));
    if (!Number.isFinite(rate) || rate < 0) throw bad("سعر الصرف غير صحيح", "exchange_rate");
    const showSyp = bool(fd, "show_syp");
    if (showSyp && rate <= 0) throw bad("أدخل سعر الصرف لعرض الليرة", "exchange_rate");
    const updates: Record<string, string> = { currency, exchange_rate: String(rate), show_syp: String(showSyp) };
    for (const [k, min, max] of LIMIT_KEYS) {
      const v = int(fd, k);
      if (!(v >= min && v <= max)) throw bad(`القيمة يجب أن تكون بين ${min} و${max}`, k);
      updates[k] = String(v);
    }
    const mode = str(fd, "theme_mode");
    if (!["Auto", "Winter", "Summer", "Neutral"].includes(mode)) throw bad("وضع الثيم غير صحيح", "theme_mode");
    const winter = fd.getAll("winter").map(Number).filter((m) => m >= 1 && m <= 12);
    const summer = fd.getAll("summer").map(Number).filter((m) => m >= 1 && m <= 12);
    if (winter.some((m) => summer.includes(m))) throw bad("لا يجوز أن يكون الشهر شتويًا وصيفيًا معًا", "theme_months");
    Object.assign(updates, { theme_mode: mode, theme_winter_months: winter.join(","), theme_summer_months: summer.join(",") });
    await tx(async (c) => {
      for (const [k, v] of Object.entries(updates)) await setSetting(k, v, c);
      await audit({ userId: u.id, action: "UpdateSettings", entity: "settings", details: updates }, c);
    });
    invalidateSettings(); invalidateAll();
    revalidatePath("/", "layout");
    return "تم حفظ الإعدادات";
  });
}

export async function templatesAction(_: S, fd: FormData) {
  return run(async () => {
    const u = await actionUser("admin");
    const texts = { booking_mechanism_text: str(fd, "booking_mechanism_text"), documents_text: str(fd, "documents_text"), terms_text: str(fd, "terms_text") };
    const tpls = { confirm: str(fd, "tpl_confirm"), reject: str(fd, "tpl_reject") };
    for (const [k, v] of Object.entries({ ...texts, ...tpls })) if (v.length < 5 || v.length > 4000) throw bad("النص قصير جدًا أو طويل جدًا", k);
    await tx(async (c) => {
      for (const [k, v] of Object.entries(texts)) await setSetting(k, v, c);
      for (const [k, v] of Object.entries(tpls)) await c.query("INSERT INTO message_templates (key, body) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET body = EXCLUDED.body", [k, v]);
      await audit({ userId: u.id, action: "UpdateTemplates", entity: "settings" }, c);
    });
    invalidateSettings();
    revalidatePath("/", "layout");
    return "تم حفظ النصوص والقوالب";
  });
}

"use server";
import { revalidatePath } from "next/cache";
import { actionUser, hashPassword, validatePassword, rotateStamp } from "@/lib/auth";
import { one, q, tx, pgCode } from "@/lib/db";
import { run, str, int, bool, fileBuf, type ActionState } from "@/lib/actions";
import { reviewBooking, voidNoDocuments, createManual, type ReviewDecision } from "@/lib/services/booking";
import { setDays, saveSeasons, setUnitMode, saveSlot, setSlotActive, copySlots, unitInBranch, type SeasonInput } from "@/lib/services/branch-ops";
import { saveResponsiveImage, deleteResponsiveImage, saveQr, deleteMediaFile } from "@/lib/services/media";
import { invalidateUnit, invalidateAll } from "@/lib/services/cache";
import { audit } from "@/lib/audit";
import { bad, conflict, forbidden, notFound } from "@/lib/errors";
import { createAccount, setAccountPermissions, setAccountActive } from "@/lib/services/accounts";
import { base62Token, randomHex } from "@/lib/crypto";
import { sendTelegram, telegramConfigured } from "@/lib/services/telegram";
import type { Mode, SlotKind } from "@/lib/services/availability";

type S = ActionState | null;

// ───────── Review ─────────
export async function reviewAction(_: S, fd: FormData) {
  return run(async () => {
    const u = await actionUser("branch");
    const decision = str(fd, "decision") as ReviewDecision;
    if (!["Confirm", "Reject", "RejectAndBlock"].includes(decision)) throw bad("إجراء غير معروف");
    const r = await reviewBooking(u, int(fd, "id"), decision, str(fd, "reason"));
    revalidatePath("/branch", "layout");
    return { message: decision === "Confirm" ? "تم تثبيت الحجز" : decision === "Reject" ? "تم رفض الطلب" : "تم الرفض والحظر", data: { whatsapp: r.whatsapp, decision } };
  });
}

export async function voidAction(_: S, fd: FormData) {
  return run(async () => {
    const u = await actionUser("branch", "bookings.void");
    await voidNoDocuments(u, int(fd, "id"));
    revalidatePath("/branch/bookings", "layout");
    return "تم تسجيل الحجز كملغى لعدم الثبوتيات";
  });
}

export async function manualAction(_: S, fd: FormData) {
  return run(async () => {
    const u = await actionUser("branch", "bookings.manual");
    const r = await createManual(u, {
      unitId: int(fd, "unitId"), slotId: int(fd, "slotId"), date: str(fd, "date"), nights: int(fd, "nights") || 1,
      name: str(fd, "name"), phone: str(fd, "phone"), category: str(fd, "category"), persons: int(fd, "persons"), notes: str(fd, "notes"),
      transactionNumber: str(fd, "transactionNumber"), file: await fileBuf(fd, "file"),
    });
    revalidatePath("/branch", "layout");
    return { message: "تم إنشاء الحجز اليدوي وتثبيته", data: { id: r.id, whatsapp: r.whatsapp } };
  });
}

// ───────── Calendar ─────────
export async function daysAction(_: S, fd: FormData) {
  return run(async () => {
    const u = await actionUser("branch", "calendar.open_close");
    const units = String(fd.get("units") ?? "").split(",").map(Number).filter(Boolean);
    const days = String(fd.get("days") ?? "").split(",").filter(Boolean);
    const open = str(fd, "open") === "1";
    await setDays(u, units, days, open);
    revalidatePath("/branch/calendar");
    return open ? `تم فتح ${days.length} يوم` : `تم إغلاق ${days.length} يوم`;
  });
}

// ───────── Units ─────────
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9؀-ۿ]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

export async function unitAction(_: S, fd: FormData) {
  return run(async () => {
    const id = int(fd, "id");
    const u = await actionUser("branch", id ? "units.edit" : "units.create");
    const name = str(fd, "name");
    if (name.length < 2 || name.length > 80) throw bad("اسم الوحدة مطلوب (2–80 حرفًا)", "name");
    const slug = slugify(str(fd, "slug") || name);
    if (!/^[a-z0-9؀-ۿ-]{2,60}$/.test(slug)) throw bad("الرابط المختصر غير صالح", "slug");
    const capacity = int(fd, "capacity");
    if (!(capacity >= 1 && capacity <= 200)) throw bad("السعة يجب أن تكون بين 1 و200", "capacity");
    const bedrooms = Math.max(0, int(fd, "bedrooms") || 0), bathrooms = Math.max(0, int(fd, "bathrooms") || 0);
    const type = str(fd, "type") === "Farm" ? "Farm" : "Chalet";
    const allowed = str(fd, "allowed_category") === "FamilyOnly" ? "FamilyOnly" : "FamilyAndYouth";
    const description = str(fd, "description").slice(0, 3000), rules = str(fd, "rules").slice(0, 2000);
    const amenities = fd.getAll("amenities").map(Number).filter(Boolean);
    const sort = int(fd, "sort_order") || 0;
    const heated = bool(fd, "has_heated_pool");
    const newId = await tx(async (c) => {
      let uid = id;
      try {
        await c.query("SAVEPOINT s");
        if (id) {
          await unitInBranch(u, id, c);
          await c.query(`UPDATE units SET name=$2, slug=$3, type=$4, description=$5, capacity=$6, bedrooms=$7, bathrooms=$8, has_heated_pool=$9, allowed_category=$10, rules=$11, sort_order=$12 WHERE id=$1`,
            [id, name, slug, type, description, capacity, bedrooms, bathrooms, heated, allowed, rules, sort]);
        } else {
          const r = await c.query(`INSERT INTO units (branch_id, name, slug, type, description, capacity, bedrooms, bathrooms, has_heated_pool, allowed_category, rules, sort_order)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`, [u.branchId, name, slug, type, description, capacity, bedrooms, bathrooms, heated, allowed, rules, sort]);
          uid = r.rows[0].id;
        }
      } catch (e) {
        if (pgCode(e) === "23505") throw bad("الرابط المختصر مستخدم، جرّب رابطًا آخر", "slug");
        throw e;
      }
      await c.query("DELETE FROM unit_amenities WHERE unit_id = $1", [uid]);
      for (const a of amenities) await c.query("INSERT INTO unit_amenities (unit_id, amenity_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [uid, a]);
      await audit({ userId: u.id, branchId: u.branchId, action: id ? "UpdateUnit" : "CreateUnit", entity: "unit", entityId: uid, details: { name, capacity } }, c);
      return uid;
    });
    invalidateUnit(newId);
    revalidatePath("/branch/units", "layout");
    return { message: id ? "تم حفظ الوحدة" : "تمت إضافة الوحدة", data: { id: newId } };
  });
}

export async function unitActiveAction(_: S, fd: FormData) {
  return run(async () => {
    const u = await actionUser("branch", "units.toggle");
    const id = int(fd, "id"), active = str(fd, "active") === "1";
    await unitInBranch(u, id);
    if (!active) {
      const live = await one("SELECT 1 FROM booking_items bi JOIN bookings b ON b.id = bi.booking_id WHERE bi.unit_id = $1 AND bi.is_active AND b.status IN ('Held','PendingReview','Confirmed') AND upper(bi.period) > now() LIMIT 1", [id]);
      if (live) throw conflict("لا يمكن تعطيل وحدة عليها حجوزات قادمة");
    }
    await q("UPDATE units SET is_active = $2 WHERE id = $1", [id, active]);
    await audit({ userId: u.id, branchId: u.branchId, action: active ? "EnableUnit" : "DisableUnit", entity: "unit", entityId: id });
    invalidateUnit(id);
    revalidatePath("/branch/units", "layout");
    return active ? "تم تفعيل الوحدة" : "تم تعطيل الوحدة";
  });
}

export async function mediaUploadAction(_: S, fd: FormData) {
  return run(async () => {
    const u = await actionUser("branch", "units.media");
    const id = int(fd, "unitId");
    await unitInBranch(u, id);
    const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (!files.length) throw bad("اختر صورة واحدة على الأقل");
    if (files.length > 20) throw bad("الحد الأقصى 20 صورة بالمرة");
    const count = (await one<{ n: number }>("SELECT count(*)::int n FROM unit_media WHERE unit_id = $1", [id]))?.n ?? 0;
    let order = count;
    for (const f of files) {
      const img = await saveResponsiveImage(Buffer.from(await f.arrayBuffer()), `units/${id}`);
      await q("INSERT INTO unit_media (unit_id, path_base, width, height, is_cover, sort_order) VALUES ($1,$2,$3,$4,$5,$6)", [id, img.base, img.width, img.height, order === 0, order]);
      order++;
    }
    await audit({ userId: u.id, branchId: u.branchId, action: "UploadMedia", entity: "unit", entityId: id, details: { count: files.length } });
    revalidatePath(`/branch/units/${id}`);
    return `تم رفع ${files.length} صورة`;
  });
}

export async function mediaAction(_: S, fd: FormData) {
  return run(async () => {
    const u = await actionUser("branch", "units.media");
    const mediaId = int(fd, "mediaId"), op = str(fd, "op");
    const m = await one("SELECT m.* FROM unit_media m JOIN units un ON un.id = m.unit_id WHERE m.id = $1 AND un.branch_id = $2", [mediaId, u.branchId]);
    if (!m) throw notFound("الصورة غير موجودة");
    const all = await q("SELECT id FROM unit_media WHERE unit_id = $1 ORDER BY sort_order, id", [m.unit_id]);
    const ids = all.map((r) => r.id as number);
    if (op === "cover") {
      await tx(async (c) => {
        await c.query("UPDATE unit_media SET is_cover = (id = $2) WHERE unit_id = $1", [m.unit_id, mediaId]);
      });
    } else if (op === "up" || op === "down") {
      const i = ids.indexOf(mediaId), j = op === "up" ? i - 1 : i + 1;
      if (j >= 0 && j < ids.length) { [ids[i], ids[j]] = [ids[j], ids[i]]; }
      await tx(async (c) => { for (let k = 0; k < ids.length; k++) await c.query("UPDATE unit_media SET sort_order = $2 WHERE id = $1", [ids[k], k]); });
    } else if (op === "delete") {
      await q("DELETE FROM unit_media WHERE id = $1", [mediaId]);
      await deleteResponsiveImage(m.path_base);
      if (m.is_cover) await q("UPDATE unit_media SET is_cover = true WHERE id = (SELECT id FROM unit_media WHERE unit_id = $1 ORDER BY sort_order, id LIMIT 1)", [m.unit_id]);
    } else throw bad("إجراء غير معروف");
    revalidatePath(`/branch/units/${m.unit_id}`);
    return op === "delete" ? "تم حذف الصورة" : op === "cover" ? "تم اختيار صورة الغلاف" : "تم تغيير الترتيب";
  });
}

// ───────── Seasons & modes ─────────
export async function seasonsAction(_: S, fd: FormData) {
  return run(async () => {
    const u = await actionUser("branch", "seasons.manage");
    const seasons: SeasonInput[] = [];
    for (const kind of ["Summer", "Autumn", "Winter", "Spring"] as const) {
      const start = str(fd, `${kind}_start`), end = str(fd, `${kind}_end`);
      if (!start && !end) continue;
      seasons.push({ kind, start, end });
    }
    if (!seasons.length) throw bad("أدخل تواريخ موسم واحد على الأقل");
    await saveSeasons(u, seasons);
    revalidatePath("/branch/seasons");
    return "تم حفظ المواسم";
  });
}

export async function modeAction(_: S, fd: FormData) {
  return run(async () => {
    const u = await actionUser("branch", "seasons.manage");
    const m = str(fd, "mode");
    await setUnitMode(u, int(fd, "unitId"), int(fd, "seasonId"), m === "Pool" || m === "Hotel" ? (m as Mode) : null);
    revalidatePath("/branch/seasons");
    return "تم حفظ النمط";
  });
}

// ───────── Slots ─────────
export async function slotAction(_: S, fd: FormData) {
  return run(async () => {
    const u = await actionUser("branch", "slots.manage");
    const hours = Number(fd.get("hours"));
    await saveSlot(u, {
      id: int(fd, "id") || undefined, unitId: int(fd, "unitId"), seasonId: int(fd, "seasonId"), kind: str(fd, "kind") as SlotKind,
      name: str(fd, "name"), startTime: str(fd, "startTime"), durationMinutes: Number.isFinite(hours) && hours > 0 ? Math.round(hours * 60) : 0, price: Number(fd.get("price")),
    });
    revalidatePath("/branch/slots");
    return int(fd, "id") ? "تم حفظ الفترة" : "تمت إضافة الفترة";
  });
}

export async function slotActiveAction(_: S, fd: FormData) {
  return run(async () => {
    const u = await actionUser("branch", "slots.manage");
    const active = str(fd, "active") === "1";
    await setSlotActive(u, int(fd, "id"), active);
    revalidatePath("/branch/slots");
    return active ? "تم تفعيل الفترة" : "تم تعطيل الفترة";
  });
}

export async function copySlotsAction(_: S, fd: FormData) {
  return run(async () => {
    const u = await actionUser("branch", "slots.manage");
    const dry = str(fd, "step") !== "execute";
    const r = await copySlots(u, int(fd, "fromUnit"), int(fd, "toUnit"), dry);
    if (!dry) revalidatePath("/branch/slots");
    return { message: dry ? `معاينة: ${r.slots.length} فترة و${r.modes.length} نمط` : `تم نسخ ${r.slots.length} فترة`, data: { preview: dry, slots: r.slots.map((s) => ({ name: s.name, kind: s.kind, season: s.season_kind, start: String(s.start_time).slice(0, 5), hours: s.duration_minutes / 60, price: s.price })) } };
  });
}

// ───────── Staff (v3 §6) ─────────
export async function staffAction(_: S, fd: FormData) {
  return run(async () => {
    const u = await actionUser("branch", "staff.create");
    const id = await createAccount(u, {
      role: "Staff", branchId: u.branchId!, username: str(fd, "username"), displayName: str(fd, "display_name"),
      password: String(fd.get("password") ?? ""), perms: fd.getAll("perms").map(String),
    });
    revalidatePath("/branch/staff");
    return { message: "تمت إضافة الموظف. سيُطلب منه تغيير كلمة المرور بأول دخول", data: { id } };
  });
}

export async function staffPermsAction(_: S, fd: FormData) {
  return run(async () => {
    const u = await actionUser("branch", "staff.edit_permissions");
    await setAccountPermissions(u, int(fd, "id"), fd.getAll("perms").map(String));
    revalidatePath("/branch/staff");
    return "تم حفظ الصلاحيات، وصارت نافذة فورًا";
  });
}

export async function staffActiveAction(_: S, fd: FormData) {
  return run(async () => {
    const u = await actionUser("branch", "staff.disable");
    const active = str(fd, "active") === "1";
    await setAccountActive(u, int(fd, "id"), active);
    revalidatePath("/branch/staff");
    return active ? "تم تفعيل الحساب" : "تم تعطيل الحساب وإنهاء جلساته";
  });
}

// ───────── Blocklist ─────────
export async function liftBlockAction(_: S, fd: FormData) {
  return run(async () => {
    const u = await actionUser("branch", "blocklist.manage");
    const id = int(fd, "id");
    const r = await q("UPDATE blocked_identities SET is_active = false, lifted_by = $3, lifted_at = now() WHERE id = $1 AND branch_id = $2 AND is_active RETURNING id", [id, u.branchId, u.id]);
    if (!r.length) throw notFound("السجل غير موجود");
    await audit({ userId: u.id, branchId: u.branchId, action: "LiftBlock", entity: "blocked_identity", entityId: id });
    revalidatePath("/branch/blocklist");
    return "تم رفع الحظر";
  });
}

// ───────── Branch settings ─────────
export async function branchSettingsAction(_: S, fd: FormData) {
  return run(async () => {
    const u = await actionUser("branch", "branch.settings");
    const rs = str(fd, "review_start"), re = str(fd, "review_end");
    const t = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!t.test(rs)) throw bad("وقت بداية المراجعة غير صحيح", "review_start");
    if (!t.test(re)) throw bad("وقت نهاية المراجعة غير صحيح", "review_end");
    const name = str(fd, "shamcash_account_name").slice(0, 80), number = str(fd, "shamcash_account_number").slice(0, 60);
    if (number && !/^[0-9A-Za-z\- ]{4,60}$/.test(number)) throw bad("رقم الحساب غير صحيح", "shamcash_account_number");
    const qr = await fileBuf(fd, "qr");
    let qrPath: string | null = null;
    if (qr) qrPath = await saveQr(qr.buffer, u.branchId!);
    const old = await one("SELECT shamcash_qr_path FROM branches WHERE id = $1", [u.branchId]);
    await q(`UPDATE branches SET review_start = $2, review_end = $3, shamcash_account_name = $4, shamcash_account_number = $5 ${qrPath ? ", shamcash_qr_path = $6" : ""} WHERE id = $1`,
      qrPath ? [u.branchId, rs, re, name || null, number || null, qrPath] : [u.branchId, rs, re, name || null, number || null]);
    if (qrPath && old?.shamcash_qr_path) await deleteMediaFile(old.shamcash_qr_path);
    await audit({ userId: u.id, branchId: u.branchId, action: "UpdateBranchSettings", entity: "branch", entityId: u.branchId, details: { rs, re, qr: !!qrPath } });
    invalidateAll();
    revalidatePath("/branch/settings");
    return "تم حفظ إعدادات الفرع";
  });
}

export async function telegramLinkAction(_: S, fd: FormData) {
  return run(async () => {
    const u = await actionUser("branch");
    if (str(fd, "op") === "unlink") {
      await q("UPDATE app_users SET telegram_chat_id = NULL, telegram_link_code = NULL WHERE id = $1", [u.id]);
      revalidatePath("/branch/settings");
      return "تم فصل تيليغرام";
    }
    if (str(fd, "op") === "test") {
      const r = await one("SELECT telegram_chat_id FROM app_users WHERE id = $1", [u.id]);
      if (!r?.telegram_chat_id) throw bad("اربط حسابك بتيليغرام أولًا");
      const s = await sendTelegram(r.telegram_chat_id, "رسالة تجريبية من لوحة الأكواخ السويسرية ✅");
      if (!s.ok) throw bad(`تعذّر الإرسال: ${s.error}`);
      return "تم إرسال رسالة تجريبية";
    }
    if (!telegramConfigured()) throw bad("بوت تيليغرام غير مُعدّ على السيرفر بعد");
    const code = base62Token(24);
    await q("UPDATE app_users SET telegram_link_code = $2 WHERE id = $1", [u.id, code]);
    revalidatePath("/branch/settings");
    return { message: "افتح الرابط واضغط Start", data: { link: `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=${code}` } };
  });
}

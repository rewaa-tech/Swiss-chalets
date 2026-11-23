import { describe, it, expect, beforeEach, afterAll } from "vitest";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { q, one, pool } from "../../src/lib/db";
import { formStamp } from "../../src/lib/crypto";
import { normalizePhone } from "../../src/lib/phone";
import { addDays, localToUtc } from "../../src/lib/time";
import { getCalendar, getSlots, expireHolds } from "../../src/lib/services/availability";
import { createHold, submitProof, reviewBooking, createManual, branchBooking, getBookingByToken } from "../../src/lib/services/booking";
import { computeReviewTimes } from "../../src/lib/services/review-deadline";
import { resolveTheme, themeConfig } from "../../src/lib/services/theme";
import { validateProof } from "../../src/lib/services/proof";
import { setDays, saveSeasons } from "../../src/lib/services/branch-ops";
import { AppError } from "../../src/lib/errors";
import { DAY, poolUnit, holdInput, makeUser, resetCaches, makeBranch, makeSeasons, makeUnit, setMode, addSlot, openDays, uid } from "../fixtures";

beforeEach(() => resetCaches());
afterAll(async () => { await pool().end(); });

async function pngBuffer(w = 40, h = 40) {
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: 30, g: 60, b: 40 } } }).png().toBuffer();
}
async function pdfBuffer(pages = 1, js = false) {
  const d = await PDFDocument.create();
  for (let i = 0; i < pages; i++) d.addPage([200, 200]).drawText("Sham Cash", { x: 20, y: 100, size: 12 });
  if (js) d.addJavaScript("x", "app.alert('hi')");
  return Buffer.from(await d.save({ useObjectStreams: true }));
}
const proofFile = async () => ({ buffer: await pngBuffer(), name: "proof.png" });
const txn = () => `TX${uid()}`.slice(0, 30);

async function expectErr(p: Promise<unknown>, status: number, code?: string) {
  try { await p; } catch (e) {
    expect(e).toBeInstanceOf(AppError);
    expect((e as AppError).status).toBe(status);
    if (code) expect((e as AppError).code).toBe(code);
    return e as AppError;
  }
  throw new Error("expected error");
}

describe("T-01 concurrency", () => {
  it("20 concurrent holds on the same slot → exactly one succeeds", async () => {
    const f = await poolUnit();
    const results = await Promise.allSettled(Array.from({ length: 20 }, () => createHold(holdInput(f.unitId, f.morning))));
    const ok = results.filter((r) => r.status === "fulfilled" && !(r.value as any).silent);
    expect(ok.length).toBe(1);
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(rejected.length).toBe(19);
    for (const r of rejected) expect((r.reason as AppError).code).toBe("slot_taken");
    const n = await one("SELECT count(*)::int n FROM booking_items WHERE unit_id = $1 AND is_active", [f.unitId]);
    expect(n.n).toBe(1);
  });
});

describe("T-02/T-03 overlap logic", () => {
  it("T-02: booking a 6h slot locks the full day and makes the day partial", async () => {
    const f = await poolUnit();
    await createHold(holdInput(f.unitId, f.morning));
    const slots = await getSlots(f.unitId, DAY);
    expect(slots.slots.find((s) => s.slotId === f.fullDay)!.available).toBe(false);
    expect(slots.slots.find((s) => s.slotId === f.evening)!.available).toBe(true);
    const cal = await getCalendar(f.unitId, DAY.slice(0, 7));
    expect(cal.find((d) => d.date === DAY)!.state).toBe("partial");
  });

  it("T-03: a 12:00→12:00 full day locks next morning's overlapping slots", async () => {
    const f = await poolUnit();
    await createHold(holdInput(f.unitId, f.fullDay));
    const next = await getSlots(f.unitId, addDays(DAY, 1));
    expect(next.slots.find((s) => s.slotId === f.morning)!.available).toBe(false); // 10:00–16:00 overlaps until 12:00
    expect(next.slots.find((s) => s.slotId === f.evening)!.available).toBe(true);
  });
});

describe("T-04 hold expiry", () => {
  it("unpaid hold expires and the time becomes available again", async () => {
    const f = await poolUnit();
    const past = new Date(Date.now() - 31 * 60000);
    const r = await createHold({ ...holdInput(f.unitId, f.morning), formStamp: formStamp(past.getTime() - 10000) }, past);
    expect(r.silent).toBe(false);
    await expireHolds();
    const b = await one("SELECT status FROM bookings WHERE status_token = $1", [(r as any).token]);
    expect(b.status).toBe("Expired");
    const slots = await getSlots(f.unitId, DAY);
    expect(slots.slots.find((s) => s.slotId === f.morning)!.available).toBe(true);
  });
});

describe("T-05 review deadlines", () => {
  it("upload at 01:00 with window 09:00–23:00 → alert 09:00, due 09:30", () => {
    const up = localToUtc("2027-07-10", 60);
    const r = computeReviewTimes(up, "09:00", "23:00");
    expect(r.within).toBe(false);
    expect(r.alertAt.toISOString()).toBe(localToUtc("2027-07-10", 9 * 60).toISOString());
    expect(r.dueAt.toISOString()).toBe(localToUtc("2027-07-10", 9 * 60 + 30).toISOString());
  });
  it("upload inside window → due in 30 minutes", () => {
    const up = localToUtc("2027-07-10", 14 * 60);
    const r = computeReviewTimes(up, "09:00", "23:00");
    expect(r.within).toBe(true);
    expect(r.dueAt.getTime() - up.getTime()).toBe(30 * 60000);
  });
  it("T-05b: window crossing midnight (09:00–02:00)", () => {
    const at0130 = localToUtc("2027-07-10", 90);
    expect(computeReviewTimes(at0130, "09:00", "02:00").within).toBe(true);
    const at0300 = localToUtc("2027-07-10", 180);
    const r = computeReviewTimes(at0300, "09:00", "02:00");
    expect(r.within).toBe(false);
    expect(r.dueAt.toISOString()).toBe(localToUtc("2027-07-10", 9 * 60 + 30).toISOString());
    const at2330 = localToUtc("2027-07-10", 23 * 60 + 30);
    expect(computeReviewTimes(at2330, "09:00", "02:00").within).toBe(true);
  });
  it("upload after window closes → next day", () => {
    const r = computeReviewTimes(localToUtc("2027-07-10", 23 * 60 + 30), "09:00", "23:00");
    expect(r.alertAt.toISOString()).toBe(localToUtc("2027-07-11", 9 * 60).toISOString());
  });
});

describe("Proof submission", () => {
  it("moves Held → PendingReview", async () => {
    const f = await poolUnit();
    const h: any = await createHold(holdInput(f.unitId, f.morning));
    await submitProof(h.token, txn(), await proofFile());
    const b = await getBookingByToken(h.token);
    expect(b.status).toBe("PendingReview");
    expect(b.review_due_at).toBeTruthy();
  });

  it("T-06: duplicate transaction number is rejected", async () => {
    const f = await poolUnit();
    const t = txn();
    const a: any = await createHold(holdInput(f.unitId, f.morning));
    await submitProof(a.token, t, await proofFile());
    const b: any = await createHold(holdInput(f.unitId, f.evening));
    await expectErr(submitProof(b.token, t, await proofFile()), 409, "duplicate");
  });

  it("T-15: late upload after expiry with free slot → PendingReview", async () => {
    const f = await poolUnit();
    const past = new Date(Date.now() - 31 * 60000);
    const h: any = await createHold({ ...holdInput(f.unitId, f.morning), formStamp: formStamp(past.getTime() - 10000) }, past);
    await expireHolds();
    const r = await submitProof(h.token, txn(), await proofFile());
    expect(r.late).toBe(true);
    expect((await getBookingByToken(h.token)).status).toBe("PendingReview");
  });

  it("T-15b: late upload when slot was taken → 'حُجز لغيرك'", async () => {
    const f = await poolUnit();
    const past = new Date(Date.now() - 31 * 60000);
    const h: any = await createHold({ ...holdInput(f.unitId, f.morning), formStamp: formStamp(past.getTime() - 10000) }, past);
    await expireHolds();
    await createHold(holdInput(f.unitId, f.fullDay)); // overlaps the morning slot
    const e = await expectErr(submitProof(h.token, txn(), await proofFile()), 409, "late_taken");
    expect(e.message).toContain("حُجز الوقت لغيرك");
    const n = await one("SELECT count(*)::int n FROM payment_proofs pp JOIN bookings b ON b.id = pp.booking_id WHERE b.status_token = $1", [h.token]);
    expect(n.n).toBe(0);
  });
});

describe("AbuseGuard", () => {
  it("T-07: third pending booking for the same phone is rejected", async () => {
    const f = await poolUnit();
    const extra = await addSlot(f.unitId, f.seasons.summer, "Hours6", "04:00", 360, 30);
    const phone = "0933" + String(Math.floor(Math.random() * 1e6)).padStart(6, "0");
    await createHold(holdInput(f.unitId, f.morning, { phone }));
    await createHold(holdInput(f.unitId, f.evening, { phone: phone.replace(/^0/, "+963") }));
    await expectErr(createHold(holdInput(f.unitId, extra, { phone })), 429, "limit_phone");
  });

  it("T-08: phone formats normalise to one number", () => {
    const n = "+963912345678";
    for (const v of ["0912345678", "+963912345678", "00963912345678", "963912345678", "٠٩١٢٣٤٥٦٧٨", "0912 345 678"]) expect(normalizePhone(v)).toBe(n);
    expect(normalizePhone("12345")).toBeNull();
  });

  it("honeypot / too-fast submissions are silently ignored", async () => {
    const f = await poolUnit();
    expect((await createHold(holdInput(f.unitId, f.morning, { honeypot: "bot" }))).silent).toBe(true);
    expect((await createHold(holdInput(f.unitId, f.morning, { formStamp: formStamp(Date.now() - 1000) }))).silent).toBe(true);
    expect((await createHold(holdInput(f.unitId, f.morning, { formStamp: "forged.sig" }))).silent).toBe(true);
    const n = await one("SELECT count(*)::int n FROM bookings WHERE unit_id = $1", [f.unitId]);
    expect(n.n).toBe(0);
  });

  it("daily limit per device", async () => {
    const f = await poolUnit();
    const extra = await addSlot(f.unitId, f.seasons.summer, "Hours6", "04:00", 360, 30);
    const deviceHash = `dev-${uid()}`;
    await createHold(holdInput(f.unitId, f.morning, { deviceHash }));
    await createHold(holdInput(f.unitId, f.evening, { deviceHash }));
    await expectErr(createHold(holdInput(f.unitId, extra, { deviceHash })), 429, "limit_daily");
  });

  it("T-09: after reject-and-block, same device with another phone is rejected", async () => {
    const f = await poolUnit();
    const mgr = await makeUser(f.branchId, "BranchManager");
    const deviceHash = `dev-${uid()}`;
    const h: any = await createHold(holdInput(f.unitId, f.morning, { deviceHash }));
    await submitProof(h.token, txn(), await proofFile());
    await reviewBooking(mgr, h.id, "RejectAndBlock", "إشعار مزوّر");
    const e = await expectErr(createHold(holdInput(f.unitId, f.evening, { deviceHash })), 403, "blocked");
    expect(e.message).toContain("تعذّر إتمام الطلب");
  });
});

describe("Validation", () => {
  it("T-12: Youth category on a FamilyOnly unit is rejected by the server", async () => {
    const f = await poolUnit({ allowed: "FamilyOnly" });
    await expectErr(createHold(holdInput(f.unitId, f.morning, { category: "Youth" })), 400);
  });
  it("persons above capacity rejected", async () => {
    const f = await poolUnit();
    await expectErr(createHold(holdInput(f.unitId, f.morning, { persons: 99 })), 400);
  });
  it("closed day is not bookable", async () => {
    const f = await poolUnit();
    await expectErr(createHold(holdInput(f.unitId, f.morning, { date: addDays(DAY, 10) })), 400);
  });
});

describe("Panel rules", () => {
  it("T-10: closing a day with a confirmed booking is refused", async () => {
    const f = await poolUnit();
    const mgr = await makeUser(f.branchId, "BranchManager");
    await createManual(mgr, { unitId: f.unitId, slotId: f.morning, date: DAY, name: "زبون", phone: "0911111111", category: "Family", persons: 2 });
    await expectErr(setDays(mgr, [f.unitId], [DAY], false), 409, "affects_bookings");
    await setDays(mgr, [f.unitId], [addDays(DAY, 2)], false); // free day closes fine
  });

  it("T-11: overlapping seasons are rejected", async () => {
    const branchId = await makeBranch();
    const mgr = await makeUser(branchId, "BranchManager");
    await expectErr(saveSeasons(mgr, [
      { kind: "Summer", start: "2027-06-01", end: "2027-09-30" },
      { kind: "Autumn", start: "2027-09-15", end: "2027-11-30" },
    ]), 400);
  });

  it("T-13: another branch's booking → 404", async () => {
    const f = await poolUnit();
    const other = await makeUser(await makeBranch(), "BranchManager");
    const h: any = await createHold(holdInput(f.unitId, f.morning));
    await expectErr(branchBooking(other, h.id), 404);
    await expectErr(reviewBooking(other, h.id, "Confirm"), 404);
  });

  it("T-14: staff without bookings.review cannot confirm → 403", async () => {
    const f = await poolUnit();
    const staff = await makeUser(f.branchId, "Staff", ["bookings.view"]);
    const h: any = await createHold(holdInput(f.unitId, f.morning));
    await submitProof(h.token, txn(), await proofFile());
    await expectErr(reviewBooking(staff, h.id, "Confirm"), 403);
  });

  it("confirm produces a correct wa.me link", async () => {
    const f = await poolUnit();
    const mgr = await makeUser(f.branchId, "BranchManager");
    const h: any = await createHold(holdInput(f.unitId, f.morning, { phone: "0912000111" }));
    await submitProof(h.token, txn(), await proofFile());
    const r = await reviewBooking(mgr, h.id, "Confirm");
    expect(r.whatsapp.startsWith("https://wa.me/963912000111?text=")).toBe(true);
    expect((await getBookingByToken(h.token)).status).toBe("Confirmed");
  });

  it("T-16: manual overlapping booking rejected, non-overlapping confirmed", async () => {
    const f = await poolUnit();
    const mgr = await makeUser(f.branchId, "BranchManager");
    const base = { unitId: f.unitId, date: DAY, name: "يدوي", phone: "0922222222", category: "Family", persons: 2 };
    const r = await createManual(mgr, { ...base, slotId: f.morning });
    const b = await one("SELECT status, source FROM bookings WHERE id = $1", [r.id]);
    expect(b).toEqual({ status: "Confirmed", source: "Manual" });
    await expectErr(createManual(mgr, { ...base, slotId: f.fullDay }), 409, "slot_taken");
    const audit = await one("SELECT is_manual FROM audit_logs WHERE entity = 'booking' AND entity_id = $1 AND action = 'ManualBooking'", [String(r.id)]);
    expect(audit.is_manual).toBe(true);
  });

  it("rejection frees the slot", async () => {
    const f = await poolUnit();
    const mgr = await makeUser(f.branchId, "BranchManager");
    const h: any = await createHold(holdInput(f.unitId, f.morning));
    await submitProof(h.token, txn(), await proofFile());
    await reviewBooking(mgr, h.id, "Reject", "المبلغ غير مطابق");
    const s = await getSlots(f.unitId, DAY);
    expect(s.slots.find((x) => x.slotId === f.morning)!.available).toBe(true);
  });
});

describe("T-17/T-18 proof files", () => {
  it("accepts a clean PDF and images", async () => {
    const p = await validateProof(await pdfBuffer(2));
    expect(p.kind).toBe("Pdf");
    expect(p.pageCount).toBe(2);
    const i = await validateProof(await pngBuffer());
    expect(i.kind).toBe("Image");
    expect(i.ext).toBe("webp");
  });
  it("rejects PDF with JavaScript", async () => { await expectErr(validateProof(await pdfBuffer(1, true)), 400); });
  it("rejects PDF with more than 5 pages", async () => { await expectErr(validateProof(await pdfBuffer(6)), 400); });
  it("rejects encrypted PDF", async () => {
    const raw = Buffer.concat([await pdfBuffer(1), Buffer.from("\ntrailer << /Encrypt << /Filter /Standard >> >>\n%%EOF")]);
    await expectErr(validateProof(raw), 400);
  });
  it("rejects a .pdf whose content is not PDF", async () => { await expectErr(validateProof(Buffer.from("hello, this is not a pdf")), 400); });
  it("rejects an executable renamed to .jpg", async () => {
    await expectErr(validateProof(Buffer.concat([Buffer.from("MZ\x90\x00"), Buffer.alloc(2000)])), 400);
  });
  it("rejects a PNG larger than 5MB", async () => {
    const raw = Buffer.alloc(1900 * 1100 * 3);
    for (let i = 0; i < raw.length; i++) raw[i] = (Math.random() * 256) | 0;
    const big = await sharp(raw, { raw: { width: 1900, height: 1100, channels: 3 } }).png({ compressionLevel: 0 }).toBuffer();
    expect(big.length).toBeGreaterThan(5 * 1024 * 1024);
    await expectErr(validateProof(big), 400);
  });
  it("rejects a corrupt JPEG", async () => {
    await expectErr(validateProof(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(500, 7)])), 400);
  });
});

describe("T-19 ThemeService", () => {
  const cfg = (mode: string) => themeConfig({ theme_mode: mode, theme_winter_months: "12,1,2", theme_summer_months: "6,7,8" });
  it("Auto: branch season decides on branch pages", () => {
    expect(resolveTheme(cfg("Auto"), 4, "Winter")).toBe("winter");
    expect(resolveTheme(cfg("Auto"), 1, "Summer")).toBe("summer");
    expect(resolveTheme(cfg("Auto"), 7, "Spring")).toBe("neutral");
    expect(resolveTheme(cfg("Auto"), 7, "Autumn")).toBe("neutral");
  });
  it("Auto: months decide on general pages", () => {
    expect(resolveTheme(cfg("Auto"), 1)).toBe("winter");
    expect(resolveTheme(cfg("Auto"), 7)).toBe("summer");
    expect(resolveTheme(cfg("Auto"), 4)).toBe("neutral");
  });
  it("manual modes override", () => {
    expect(resolveTheme(cfg("Winter"), 7, "Summer")).toBe("winter");
    expect(resolveTheme(cfg("Summer"), 1)).toBe("summer");
    expect(resolveTheme(cfg("Neutral"), 1, "Winter")).toBe("neutral");
  });
});

describe("T-20 hotel nights across seasons", () => {
  async function hotelUnit(secondMode: "Hotel" | "Pool") {
    const branchId = await makeBranch();
    const s = await makeSeasons(branchId);
    const unitId = await makeUnit(branchId);
    const edge = addDays(DAY, 60); // last day of summer
    await setMode(unitId, s.summer, "Hotel");
    await setMode(unitId, s.winter, secondMode);
    const summerNight = await addSlot(unitId, s.summer, "HotelNight", "14:00", 1320, 100);
    await addSlot(unitId, s.winter, secondMode === "Hotel" ? "HotelNight" : "FullDay", "14:00", secondMode === "Hotel" ? 1320 : 1440, 70);
    await openDays(unitId, addDays(edge, -1), 4);
    resetCaches();
    return { unitId, summerNight, start: addDays(edge, -1) };
  }
  it("each night is priced by its own season", async () => {
    const h = await hotelUnit("Hotel");
    const r: any = await createHold(holdInput(h.unitId, h.summerNight, { date: h.start, nights: 3 }));
    expect(r.total).toBe(100 + 100 + 70);
    const items = await q("SELECT price FROM booking_items bi JOIN bookings b ON b.id = bi.booking_id WHERE b.status_token = $1 ORDER BY day", [r.token]);
    expect(items.map((i) => i.price)).toEqual([100, 100, 70]);
  });
  it("a night in a Pool season rejects the request", async () => {
    const h = await hotelUnit("Pool");
    await expectErr(createHold(holdInput(h.unitId, h.summerNight, { date: h.start, nights: 3 })), 400);
  });
});

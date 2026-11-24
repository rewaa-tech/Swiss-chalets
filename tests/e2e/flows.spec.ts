import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import pg from "pg";
import { ADMIN, MANAGER, FIX } from "./global-setup";
import { E2E_DB } from "../../playwright.config";

// Damascus calendar helpers (fixed UTC+3).
const damascusToday = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 86400_000).toISOString().slice(0, 10);
const D = addDays(damascusToday(), 1);
const days = (n: number) => Array.from({ length: n }, (_, i) => addDays(D, i));

async function sql<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  const c = new pg.Client({ connectionString: E2E_DB });
  await c.connect();
  try { return (await c.query(text, params)).rows; } finally { await c.end(); }
}

async function login(page: Page, user: string, pass: string) {
  await page.goto("/login");
  await page.fill("#username", user);
  await page.fill("#password", pass);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(branch|admin|account)/);
}

const toast = (page: Page, text: string | RegExp) => expect(page.locator(".toast").filter({ hasText: text }).first()).toBeVisible();

let unitSlug = "";

async function customerBooking(page: Page, opts: { day: string; slot: string; name: string; phone: string; file: string }) {
  await page.goto(`/u/${unitSlug}`);
  const loadedAt = Date.now();
  await page.locator(`.cal-day[data-date="${opts.day}"]`).click();
  await page.locator(".slot-card", { hasText: opts.slot }).click();
  await page.getByRole("button", { name: "احجز الآن" }).last().click();
  // The mechanism sheet shows only the first time per session.
  await page.getByRole("dialog").first().waitFor();
  const mech = page.getByRole("dialog", { name: "كيف يتم الحجز؟" });
  if (await mech.count()) await mech.getByRole("button", { name: "فهمت، تابع" }).click();
  const form = page.getByRole("dialog", { name: "بيانات الحجز" });
  await form.locator("#bf-name").fill(opts.name);
  await form.locator("#bf-phone").fill(opts.phone);
  const wait = 5600 - (Date.now() - loadedAt);
  if (wait > 0) await page.waitForTimeout(wait);
  await form.getByRole("button", { name: /احجز الوقت 30 دقيقة/ }).click();
  await page.waitForURL(/\/booking\/[0-9A-Za-z]{32}$/);
  await expect(page.getByRole("heading", { name: "الدفع" })).toBeVisible();
  await expect(page.getByText("0912345678901")).toBeVisible();
  await page.fill("#txn", `TX${Date.now()}`);
  await page.setInputFiles('input[type="file"]', `${FIX}/${opts.file}`);
  if (opts.file.endsWith(".pdf")) await expect(page.locator(".file-card")).toContainText("2 صفحات");
  await page.getByRole("button", { name: "أرسل للمراجعة" }).click();
  await expect(page.getByRole("heading", { name: "طلبك بانتظار التأكيد" })).toBeVisible();
  return page.url();
}

test.describe.serial("Swiss Chalets end-to-end", () => {
  test("E2E-06: manager sets up unit, photos, season, mode, slots and open days", async ({ page }) => {
    await login(page, MANAGER.user, MANAGER.pass);
    await page.goto("/branch/units/new");
    await page.fill("#u-name", "كوخ الاختبار");
    await page.fill("#u-slug", "test-chalet");
    await page.fill("#u-cap", "6");
    await page.getByLabel("مسبح خاص").check();
    await page.getByRole("button", { name: "إضافة الوحدة" }).click();
    await page.waitForURL(/\/branch\/units\/\d+/);
    const unitId = Number(page.url().match(/units\/(\d+)/)![1]);
    unitSlug = "test-chalet";

    await page.setInputFiles('input[name="files"]', `${FIX}/chalet.jpg`);
    await page.getByRole("button", { name: "رفع الصور" }).click();
    await toast(page, "تم رفع 1 صورة");
    await expect(page.locator('img[src*="/media/units/"]').first()).toBeVisible();

    await page.goto("/branch/seasons");
    await page.fill("#Winter_s", addDays(damascusToday(), -30));
    await page.fill("#Winter_e", addDays(damascusToday(), 90));
    await page.getByRole("button", { name: "حفظ المواسم" }).click();
    await toast(page, "تم حفظ المواسم");
    await page.getByRole("combobox", { name: "النمط" }).first().selectOption("Pool");
    await toast(page, "تم حفظ النمط");

    await page.goto(`/branch/slots?unit=${unitId}`);
    const add = page.locator("form", { has: page.getByRole("button", { name: "إضافة", exact: true }) });
    for (const [name, kind, start, price] of [["فترة صباحية", "Hours6", "10:00", "50"], ["فترة مسائية", "Hours6", "17:00", "60"], ["يوم كامل", "FullDay", "12:00", "120"]]) {
      await add.locator('input[name="name"]').fill(name);
      await add.locator('select[name="kind"]').selectOption(kind);
      await add.locator('input[name="startTime"]').fill(start);
      await add.locator('input[name="price"]').fill(price);
      await add.getByRole("button", { name: "إضافة", exact: true }).click();
      await toast(page, "تمت إضافة الفترة");
      await expect(page.locator(`input[value="${name}"]`)).toHaveCount(1);
    }
    await expect(page.getByText("متداخلة").first()).toBeVisible(); // full day overlaps the 6h slots

    const openDays = days(6);
    for (const m of [...new Set(openDays.map((d) => d.slice(0, 7)))]) {
      await page.goto(`/branch/calendar?month=${m}`);
      const inMonth = openDays.filter((d) => d.startsWith(m));
      const first = page.locator(`td[data-cell="${unitId}|${inMonth[0]}"]`), last = page.locator(`td[data-cell="${unitId}|${inMonth[inMonth.length - 1]}"]`);
      await last.scrollIntoViewIfNeeded(); await first.scrollIntoViewIfNeeded();
      const a = (await first.boundingBox())!, b = (await last.boundingBox())!;
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
      await page.mouse.up();
      await expect(page.getByText(`محدد: ${inMonth.length} خلية`)).toBeVisible();
      await page.getByRole("button", { name: "فتح المحدد" }).click();
      await toast(page, /تم فتح/);
    }
    await page.goto("/b/homs");
    await expect(page.getByText("كوخ الاختبار")).toBeVisible();
  });

  test("E2E-01: customer journey with an image proof", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("اكتشف دفء الأكواخ");
    await page.getByRole("link", { name: /حمص/ }).first().click();
    await page.waitForURL(/\/b\/homs/);
    await page.getByRole("link", { name: /كوخ الاختبار/ }).click();
    await page.waitForURL(/\/u\/test-chalet/);
    const cal = await page.request.get(`/api/units/${(await sql("SELECT id FROM units WHERE slug = 'test-chalet'"))[0].id}/calendar?month=${D.slice(0, 7)}`);
    expect((await cal.json()).find((d: any) => d.date === D).state).toBe("full");
    await customerBooking(page, { day: D, slot: "فترة صباحية", name: "سامر الصور", phone: "0944000001", file: "proof.png" });
    const b = (await sql("SELECT status FROM bookings WHERE customer_name = 'سامر الصور'"))[0];
    expect(b.status).toBe("PendingReview");
  });

  test("E2E-02: customer journey with a PDF proof", async ({ page }) => {
    await customerBooking(page, { day: D, slot: "فترة مسائية", name: "ليلى PDF", phone: "0944000002", file: "proof.pdf" });
    const p = (await sql("SELECT p.proof_kind, p.page_count FROM payment_proofs p JOIN bookings b ON b.id = p.booking_id WHERE b.customer_name = 'ليلى PDF'"))[0];
    expect(p).toEqual({ proof_kind: "Pdf", page_count: 2 });
  });

  test("E2E-03: manager reviews and confirms; customer sees confirmed", async ({ page, browser }) => {
    await login(page, MANAGER.user, MANAGER.pass);
    await page.goto("/branch/queue");
    await page.getByRole("button", { name: /ليلى PDF/ }).click();
    await expect(page.locator("canvas[aria-label='الصفحة الأولى من الإشعار']")).toBeVisible();
    await page.getByRole("button", { name: /سامر الصور/ }).click();
    await expect(page.locator('img[alt="إشعار الدفع"]')).toBeVisible();
    await page.getByRole("button", { name: "تثبيت الحجز" }).click();
    await toast(page, "تم تثبيت الحجز");
    const wa = page.getByRole("link", { name: /أرسل رسالة واتساب للزبون/ });
    await expect(wa).toHaveAttribute("href", /^https:\/\/wa\.me\/963944000001\?text=/);
    const href = decodeURIComponent((await wa.getAttribute("href"))!);
    expect(href).toContain("كوخ الاختبار");
    const token = (await sql("SELECT status_token FROM bookings WHERE customer_name = 'سامر الصور'"))[0].status_token;
    const ctx = await browser.newContext();
    const c = await ctx.newPage();
    await c.goto(`/booking/${token}`);
    await expect(c.getByRole("heading", { name: "تم تثبيت حجزك" })).toBeVisible();
    await ctx.close();
  });

  test("E2E-04: reject, reject-and-block, then the blocked device cannot book", async ({ browser }) => {
    const cust: BrowserContext = await browser.newContext();
    const cp = await cust.newPage();
    await customerBooking(cp, { day: addDays(D, 1), slot: "فترة صباحية", name: "مرفوض عادي", phone: "0944000003", file: "proof.png" });
    await customerBooking(cp, { day: addDays(D, 1), slot: "فترة مسائية", name: "مرفوض محظور", phone: "0944000004", file: "proof.png" });

    const mctx = await browser.newContext();
    const mp = await mctx.newPage();
    await login(mp, MANAGER.user, MANAGER.pass);
    await mp.goto("/branch/queue");
    await mp.getByRole("button", { name: /مرفوض عادي/ }).click();
    await mp.fill("#reason", "المبلغ غير مطابق");
    await mp.getByRole("button", { name: "رفض", exact: true }).click();
    await mp.getByRole("dialog").getByRole("button", { name: "رفض", exact: true }).click();
    await toast(mp, "تم رفض الطلب");

    await mp.getByRole("button", { name: /مرفوض محظور/ }).click();
    await mp.fill("#reason", "إشعار مزوّر");
    await mp.getByRole("button", { name: "رفض وحظر" }).click();
    const dlg = mp.getByRole("dialog");
    await expect(dlg.getByRole("button", { name: "رفض وحظر" })).toBeDisabled();
    await dlg.getByRole("checkbox").check();
    await dlg.getByRole("button", { name: "رفض وحظر" }).click();
    await toast(mp, "تم الرفض والحظر");

    // same device, another phone → blocked
    await cp.goto(`/u/${unitSlug}`);
    const t0 = Date.now();
    await cp.locator(`.cal-day[data-date="${addDays(D, 2)}"]`).click();
    await cp.locator(".slot-card", { hasText: "فترة مسائية" }).click();
    await cp.getByRole("button", { name: "احجز الآن" }).last().click();
    const form = cp.getByRole("dialog", { name: "بيانات الحجز" });
    await expect(form).toBeVisible();
    await form.locator("#bf-name").fill("محاولة جديدة");
    await form.locator("#bf-phone").fill("0944000099");
    await cp.waitForTimeout(Math.max(0, 5600 - (Date.now() - t0)));
    await form.getByRole("button", { name: /احجز الوقت/ }).click();
    await expect(form.getByRole("alert")).toContainText("تعذّر إتمام الطلب، تواصل معنا عبر واتساب");

    // lift the blocks so later tests from localhost are not affected
    await mp.goto("/branch/blocklist");
    for (let i = 0; i < 3; i++) {
      await mp.getByRole("button", { name: "رفع الحظر" }).first().click();
      await mp.getByRole("dialog").getByRole("button", { name: "رفع الحظر" }).click();
      await toast(mp, "تم رفع الحظر");
      await mp.waitForTimeout(400);
    }
    await expect(mp.getByText("لا يوجد محظورون")).toBeVisible();
    await cust.close(); await mctx.close();
  });

  test("E2E-05: manual booking makes the public calendar partial", async ({ page }) => {
    await login(page, MANAGER.user, MANAGER.pass);
    await page.goto("/branch/bookings/new");
    await page.fill("#m-date", addDays(D, 3));
    await page.getByRole("button", { name: "عرض الفترات" }).click();
    await page.locator(".slot-card", { hasText: "فترة صباحية" }).click();
    await page.fill("#m-name", "حجز هاتفي");
    await page.fill("#m-phone", "0955000005");
    await page.getByRole("button", { name: "إنشاء حجز مثبّت" }).click();
    await expect(page.getByText(/تم إنشاء الحجز #\d+ وتثبيته/)).toBeVisible();
    await expect(page.getByRole("link", { name: /أرسل التأكيد عبر واتساب/ })).toHaveAttribute("href", /wa\.me\/963955000005/);
    const unitId = (await sql("SELECT id FROM units WHERE slug = 'test-chalet'"))[0].id;
    const day = addDays(D, 3);
    const cal = await (await page.request.get(`/api/units/${unitId}/calendar?month=${day.slice(0, 7)}`)).json();
    expect(cal.find((d: any) => d.date === day).state).toBe("partial");
    expect((await sql("SELECT source, status FROM bookings WHERE customer_name = 'حجز هاتفي'"))[0]).toEqual({ source: "Manual", status: "Confirmed" });
  });

  test("E2E-07: staff with limited permissions", async ({ page, browser }) => {
    await login(page, MANAGER.user, MANAGER.pass);
    await page.goto("/branch/staff");
    await page.fill("#st-d", "موظف الاستقبال");
    await page.fill("#st-u", "front.desk");
    await page.fill("#st-p", "TempPass12345");
    await page.getByRole("button", { name: "إضافة الموظف" }).click();
    await toast(page, /تمت إضافة الموظف/);

    const ctx = await browser.newContext();
    const s = await ctx.newPage();
    await login(s, "front.desk", "TempPass12345");
    await s.waitForURL(/\/account\/password/);
    await s.fill("#current", "TempPass12345");
    await s.fill("#next", "NewStaffPass99");
    await s.fill("#again", "NewStaffPass99");
    await s.getByRole("button", { name: "حفظ" }).click();
    await s.waitForURL(/\/branch\/queue/);
    const nav = s.getByRole("navigation", { name: "قائمة اللوحة" });
    await expect(nav.getByRole("link", { name: /يحتاج مراجعتك/ })).toBeVisible();
    await expect(nav.getByRole("link", { name: "الوحدات" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "الموظفون" })).toHaveCount(0);
    for (const path of ["/branch/units", "/branch/staff", "/branch/settings", "/branch/bookings/new"]) {
      const r = await s.goto(path);
      expect(r?.status(), path).toBe(403);
    }
    await expect(s.getByRole("button", { name: "تثبيت الحجز" })).toHaveCount(0);
    expect((await s.goto("/admin"))?.status()).toBe(404);
    await ctx.close();
  });

  test("E2E-08: contact numbers routed to pages", async ({ page }) => {
    await login(page, ADMIN.user, ADMIN.pass);
    await page.goto("/admin/contacts");
    const add = page.locator("form", { has: page.getByRole("button", { name: "إضافة", exact: true }) });
    await add.locator('input[name="label"]').fill("الرقم العام");
    await add.locator('input[name="phone"]').fill("0911111111");
    await add.getByRole("button", { name: "إضافة", exact: true }).click();
    await toast(page, "تمت إضافة الرقم");
    await add.locator('input[name="label"]').fill("واتساب الرئيسية");
    await add.locator('input[name="phone"]').fill("0933333333");
    await add.getByRole("button", { name: "إضافة", exact: true }).click();
    await toast(page, "تمت إضافة الرقم");
    await page.reload();
    const row = page.locator("form", { hasText: "الرئيسية (عام)" });
    await row.locator('select[name="contact_id"]').selectOption({ label: "واتساب الرئيسية" });
    await row.getByRole("button", { name: "حفظ" }).click();
    await toast(page, "تم ربط الرقم بالصفحة");
    await page.goto("/");
    await expect(page.getByRole("link", { name: "تواصل عبر واتساب" })).toHaveAttribute("href", /wa\.me\/963933333333/);
    await page.goto("/terms");
    await expect(page.getByRole("link", { name: "تواصل عبر واتساب" })).toHaveAttribute("href", /wa\.me\/963911111111/);
  });

  test("E2E-09: season themes switch and respect reduced motion", async ({ page, browser }) => {
    await login(page, ADMIN.user, ADMIN.pass);
    for (const [label, theme] of [["شتاء دائمًا", "winter"], ["صيف دائمًا", "summer"], ["محايد دائمًا", "neutral"]] as const) {
      await page.goto("/admin/settings");
      await page.getByText(label, { exact: true }).click();
      await page.getByRole("button", { name: "حفظ الإعدادات" }).click();
      await toast(page, "تم حفظ الإعدادات");
      const ctx = await browser.newContext();
      const p = await ctx.newPage();
      await p.goto("/");
      await expect(p.locator("html")).toHaveAttribute("data-theme", theme);
      if (theme === "neutral") await expect(p.locator("[data-fx-layer]")).toHaveCount(0);
      else await expect(p.locator(`.hero [data-fx-layer="${theme}"]`)).toHaveCount(1);
      await ctx.close();
      if (theme !== "neutral") {
        const rm = await browser.newContext({ reducedMotion: "reduce" });
        const r = await rm.newPage();
        await r.goto("/");
        await expect(r.locator(`[data-fx-layer="${theme}"]`)).toHaveClass(/is-static/);
        await rm.close();
      }
    }
    // admin panel itself never takes the theme
    await page.goto("/admin/bookings");
    await expect(page.locator(".admin")).toBeVisible();
    await page.goto("/admin/settings");
    await page.getByText("تلقائي حسب الموسم", { exact: true }).click();
    await page.getByRole("button", { name: "حفظ الإعدادات" }).click();
    await toast(page, "تم حفظ الإعدادات");
  });

  test("E2E-10: CSV export keeps Arabic intact", async ({ page }) => {
    await login(page, ADMIN.user, ADMIN.pass);
    await page.goto("/admin/bookings");
    await expect(page.getByText("كل الحجوزات").first()).toBeVisible();
    const r = await page.request.get("/admin/bookings/export");
    expect(r.status()).toBe(200);
    expect(r.headers()["content-type"]).toContain("text/csv");
    const buf = await r.body();
    expect([...buf.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = buf.toString("utf8");
    expect(text).toContain("كوخ الاختبار");
    expect(text).toContain("سامر الصور");
    expect(text).toContain("مثبّت");
  });

  test("E2E-11: every panel page loads without console errors, 500s or broken links", async ({ page, browser }) => {
    const errors: string[] = [];
    const bad: string[] = [];
    const watch = (p: Page) => {
      p.on("console", (m) => { if (m.type() === "error") errors.push(`${p.url()}: ${m.text()}`); });
      p.on("pageerror", (e) => errors.push(`${p.url()}: ${e.message}`));
      p.on("response", (r) => { if (r.status() >= 500) bad.push(`${r.status()} ${r.url()}`); });
    };
    watch(page);
    await login(page, MANAGER.user, MANAGER.pass);
    const unitId = (await sql("SELECT id FROM units WHERE slug = 'test-chalet'"))[0].id;
    const bookingId = (await sql("SELECT id FROM bookings ORDER BY id LIMIT 1"))[0].id;
    const branchPages = ["/branch/queue", "/branch/bookings", `/branch/bookings/${bookingId}`, "/branch/bookings/new", "/branch/calendar", "/branch/units", `/branch/units/${unitId}`, "/branch/units/new", "/branch/seasons", "/branch/slots", "/branch/staff", "/branch/blocklist", "/branch/settings", "/account/password"];
    for (const p of branchPages) { const r = await page.goto(p); expect(r?.status(), p).toBe(200); }
    const actx = await browser.newContext();
    const ap = await actx.newPage();
    watch(ap);
    await login(ap, ADMIN.user, ADMIN.pass);
    const adminPages = ["/admin/bookings", `/admin/bookings/${bookingId}`, "/admin/branches", "/admin/users", "/admin/contacts", "/admin/settings", "/admin/templates", "/admin/audit"];
    const links = new Set<string>();
    for (const p of adminPages) {
      const r = await ap.goto(p); expect(r?.status(), p).toBe(200);
      for (const h of await ap.locator('a[href^="/"]').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute("href")!))) links.add(h.split("#")[0]);
    }
    for (const h of await page.locator('a[href^="/"]').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute("href")!))) links.add(h.split("#")[0]);
    for (const h of links) {
      if (!h || h.startsWith("/logout") || h.includes("export")) continue;
      const r = await ap.request.get(h);
      expect([200, 403], `link ${h}`).toContain(r.status());
    }
    const pub = await browser.newContext();
    const pp = await pub.newPage();
    watch(pp);
    for (const p of ["/", "/b/homs", "/b/idlib", `/u/${unitSlug}`, "/my", "/terms", "/sitemap.xml", "/robots.txt"]) { const r = await pp.goto(p); expect(r?.status(), p).toBe(200); }
    expect(bad, bad.join("\n")).toEqual([]);
    expect(errors.filter((e) => !e.includes("favicon")), errors.join("\n")).toEqual([]);
    // the 404 page itself (checked last so its expected 404 is not counted as an error)
    expect((await pp.goto("/no-such-page"))?.status()).toBe(404);
    await expect(pp.getByRole("heading", { name: "ضعنا بين أشجار الصنوبر" })).toBeVisible();
    await actx.close(); await pub.close();
  });
});

test.describe("mobile 375px @mobile", () => {
  test("customer can book on a phone and nothing overflows horizontally @mobile", async ({ page }) => {
    unitSlug ||= "test-chalet";
    for (const p of ["/", "/b/homs", `/u/${unitSlug}`]) {
      await page.goto(p);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, p).toBeLessThanOrEqual(1);
    }
    await customerBooking(page, { day: addDays(D, 4), slot: "يوم كامل", name: "زبون الموبايل", phone: "0966000006", file: "proof.png" });
  });
});

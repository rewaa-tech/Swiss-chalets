import { test, expect, type Page } from "@playwright/test";
import pg from "pg";
import { ADMIN, MANAGER, FIX } from "./global-setup";
import { E2E_DB } from "../../playwright.config";

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

test.describe.serial("v3 fixes", () => {
  test("E2E-12: a unit with an Arabic name opens straight after creation", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await login(page, MANAGER.user, MANAGER.pass);
    await page.goto("/branch/units/new");
    await page.fill("#u-name", "كوخ الصنوبر الكبير");
    await page.fill("#u-cap", "5");
    await page.getByRole("button", { name: "إضافة الوحدة" }).click();
    await page.waitForURL(/\/branch\/units\/\d+/);
    const slug = (await sql("SELECT slug FROM units WHERE name = 'كوخ الصنوبر الكبير'"))[0].slug;
    expect(slug).toBe("كوخ-الصنوبر-الكبير");
    const [tab] = await Promise.all([page.waitForEvent("popup"), page.getByRole("link", { name: "عرض بالموقع" }).click()]);
    await tab.waitForLoadState();
    await expect(tab.getByRole("heading", { level: 1, name: "كوخ الصنوبر الكبير" })).toBeVisible();
    // Empty unit: no cover, no seasons → elegant empty states, no errors.
    const r = await page.request.get(`/u/${encodeURIComponent(slug)}`);
    expect(r.status()).toBe(200);
    expect(errors).toEqual([]);
  });

  test("E2E-13: logout from the panel; back button does not show the panel", async ({ page }) => {
    await login(page, MANAGER.user, MANAGER.pass);
    await page.goto("/branch/units");
    await page.getByTestId("logout").filter({ visible: true }).click();
    await page.waitForURL(/\/login/);
    await toast(page, "تم تسجيل الخروج");
    await page.goBack();
    await page.reload();
    await expect(page).toHaveURL(/\/login/);
  });

  test("E2E-13b: logout is reachable on a phone @mobile", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await login(page, MANAGER.user, MANAGER.pass);
    await page.goto("/branch/queue");
    await page.locator(".account-menu summary").click();
    await page.locator(".account-sheet").getByTestId("logout").click();
    await page.waitForURL(/\/login/);
    await ctx.close();
  });

  test("E2E-14: cover and album (photo + video) show in a gallery and lightbox", async ({ page }) => {
    await login(page, MANAGER.user, MANAGER.pass);
    const { id, slug } = (await sql("SELECT id, slug FROM units WHERE slug = 'test-chalet'"))[0];
    await page.goto(`/branch/units/${id}`);
    await page.locator('input[type="file"][multiple]').setInputFiles([`${FIX}/chalet.jpg`, `${FIX}/clip.mp4`]);
    await expect(page.locator(".album-item")).toHaveCount(3);
    await expect(page.locator(".album-item .vid-badge")).toBeVisible({ timeout: 60_000 });
    await page.goto(`/u/${slug}`);
    await expect(page.locator(".bento-tile")).toHaveCount(3);
    await page.locator(".bento-tile").first().click();
    await expect(page.locator(".lightbox")).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(".lb-count")).toContainText("2 من 3");
    await page.keyboard.press("Escape");
    await expect(page.locator(".lightbox")).toHaveCount(0);
    // Video is served with Range support.
    const v = (await sql("SELECT video_path FROM unit_media WHERE kind = 'Video' AND status = 'Ready' LIMIT 1"))[0].video_path;
    const r = await page.request.get(`/media/${v}`, { headers: { Range: "bytes=0-99" } });
    expect(r.status()).toBe(206);
    expect((await r.body()).length).toBe(100);
  });

  test("E2E-15: branch map opens directions at the branch coordinates", async ({ page }) => {
    await login(page, MANAGER.user, MANAGER.pass);
    await page.goto("/branch/settings");
    await page.fill("#map", "https://www.google.com/maps/@34.7324,36.7137,15z");
    await page.getByRole("button", { name: "حفظ الإعدادات" }).click();
    await toast(page, "تم حفظ إعدادات الفرع");
    await page.goto("/b/homs");
    const link = page.getByTestId("map-link");
    await expect(link).toHaveAttribute("href", "https://www.google.com/maps/search/?api=1&query=34.7324,36.7137");
  });

  test("E2E-16: a branch text edited in the panel shows on that branch only", async ({ page }) => {
    await login(page, MANAGER.user, MANAGER.pass);
    await page.goto("/branch/content");
    await page.locator(".txe-tree nav button", { hasText: "صفحة الفرع" }).click();
    const f = page.locator('[data-key="branch.emptyTitle"]');
    await f.locator("input").fill("ما في وحدات بهالتصفية");
    await f.getByRole("button", { name: "حفظ" }).click();
    await toast(page, /تم الحفظ/);
    await page.goto("/b/homs?type=Farm");
    await expect(page.locator('[data-tk="branch.emptyTitle"]')).toHaveText("ما في وحدات بهالتصفية");
    await page.goto("/b/idlib?type=Farm");
    await expect(page.locator('[data-tk="branch.emptyTitle"]')).toHaveText("لا توجد وحدات مطابقة");
    // In-place editing on the live page.
    await page.goto("/b/homs");
    await page.getByTestId("tk-toggle").click();
    await page.locator('[data-tk="branch.filter.all"]').click();
    await page.locator(".tk-pop textarea").fill("كل الأكواخ");
    await page.locator(".tk-pop").getByRole("button", { name: "حفظ" }).click();
    await expect(page.locator('[data-tk="branch.filter.all"]')).toHaveText("كل الأكواخ");
  });

  test("E2E-19/20: seasons reveal list and the animated booking story", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto("/");
    await page.locator(".reveal-list").scrollIntoViewIfNeeded();
    await page.locator('.rl-item[data-item="winter"]').hover();
    await expect(page.locator('.rl-item[data-item="winter"]')).toHaveClass(/is-on/);
    await page.locator("#how").scrollIntoViewIfNeeded();
    await page.locator(".story-step").nth(2).click();
    await expect(page.locator(".story-step").nth(2)).toHaveAttribute("aria-current", "step");
    await expect(page.locator('.sx-scene.sx-s3')).toHaveAttribute("data-on", "1");
    await page.getByTestId("story-pause").click();
    const running = await page.evaluate(() => document.querySelector(".story-stage")!.getAnimations({ subtree: true }).filter((a) => a.playState === "running").length);
    expect(running).toBe(0);
    await ctx.close();
    // Reduced motion: nothing keeps moving.
    const rm = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
    const p2 = await rm.newPage();
    await p2.goto("/");
    await p2.locator("#how").scrollIntoViewIfNeeded();
    await p2.waitForTimeout(800);
    const moving = await p2.evaluate(() => document.querySelector(".story-stage")!.getAnimations({ subtree: true }).filter((a) => a.playState === "running").length);
    expect(moving).toBe(0);
    await rm.close();
  });

  test("E2E-21: a staff account created with a preset gets exactly those pages", async ({ page, browser }) => {
    await login(page, MANAGER.user, MANAGER.pass);
    await page.goto("/branch/staff");
    await page.fill("#ac-d", "مسؤول المحتوى");
    await page.fill("#ac-u", "content.editor");
    await page.fill("#ac-p", "TempPass12345");
    await page.getByRole("button", { name: "التالي" }).click();
    const wiz = page.locator("form").filter({ has: page.locator("#ac-d") });
    await wiz.locator("button.preset-card", { hasText: "مدير محتوى" }).click();
    await expect(wiz.locator('[data-perm="units.media"]')).toBeChecked();
    await expect(wiz.locator('[data-perm="bookings.confirm"]')).not.toBeChecked();
    await page.getByRole("button", { name: "التالي" }).click();
    await page.getByRole("button", { name: "إضافة الموظف" }).click();
    await toast(page, /تمت إضافة الموظف/);
    const perms = (await sql("SELECT array_agg(permission ORDER BY permission) p FROM user_permissions WHERE user_id = (SELECT id FROM app_users WHERE username = 'content.editor')"))[0].p;
    expect(perms).toEqual(["content.manage", "units.edit", "units.media", "units.view"]);
    await sql("UPDATE app_users SET must_change_password = false WHERE username = 'content.editor'");
    const ctx = await browser.newContext();
    const s = await ctx.newPage();
    await login(s, "content.editor", "TempPass12345");
    expect((await s.goto("/branch/content"))?.status()).toBe(200);
    expect((await s.goto("/branch/queue"))?.status()).toBe(403);
    await ctx.close();
  });

  test("admin can give a branch manager a custom permission set", async ({ page }) => {
    await login(page, ADMIN.user, ADMIN.pass);
    await page.goto("/admin/users");
    const row = page.locator("tr", { hasText: "homs.manager" });
    await row.getByRole("button", { name: "الصلاحيات" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByText("صلاحيات مخصصة", { exact: true }).click();
    await dlg.locator('[data-perm="staff.view"]').uncheck({ force: true });
    await page.getByRole("dialog").getByRole("button", { name: "حفظ" }).click();
    await toast(page, /تم حفظ الصلاحيات/);
    const m = (await sql("SELECT perms_custom FROM app_users WHERE username = 'homs.manager'"))[0];
    expect(m.perms_custom).toBe(true);
    // restore
    await row.getByRole("button", { name: "الصلاحيات" }).click();
    await page.getByRole("dialog").getByText("كل صلاحيات الفرع", { exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "حفظ" }).click();
    await toast(page, /تم حفظ الصلاحيات/);
  });
});

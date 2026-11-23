import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { MANAGER } from "./global-setup";

// 13.3: no serious/critical axe violations. Runs after flows.spec (alphabetical order is not relied on: it only needs seeded branches).
const PUBLIC = ["/", "/b/homs", "/terms", "/my", "/login"];

for (const path of PUBLIC) {
  test(`axe: ${path}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(path);
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
  });
}

test("axe: branch panel pages", async ({ page }) => {
  await page.goto("/login");
  await page.fill("#username", MANAGER.user);
  await page.fill("#password", MANAGER.pass);
  await page.click('button[type="submit"]');
  await page.waitForURL(/branch/);
  const out: string[] = [];
  for (const p of ["/branch/queue", "/branch/bookings", "/branch/units/new", "/branch/seasons", "/branch/staff", "/branch/settings"]) {
    await page.goto(p);
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    for (const v of r.violations.filter((v) => v.impact === "serious" || v.impact === "critical")) out.push(`${p} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
  }
  expect(out).toEqual([]);
});

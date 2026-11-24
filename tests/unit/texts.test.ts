import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { pool } from "../../src/lib/db";
import { getTexts, saveText, invalidateTexts } from "../../src/lib/texts/server";
import { DEFAULT_TEXTS } from "../../src/lib/texts/registry";
import { AppError } from "../../src/lib/errors";
import { makeBranch, makeUser } from "../fixtures";

beforeEach(() => invalidateTexts());
afterAll(async () => { await pool().end(); });

describe("v3 §5 editable texts", () => {
  it("T-25: a branch override stays on that branch; others see the site-wide value", async () => {
    const a = await makeBranch(), b = await makeBranch();
    const admin = await makeUser(null, "SuperAdmin");
    const mgr = await makeUser(a, "BranchManager");
    await saveText(admin, "branch.emptyTitle", "عام للجميع");
    await saveText(mgr, "branch.emptyTitle", "خاص بالفرع");
    expect((await getTexts(a))["branch.emptyTitle"]).toBe("خاص بالفرع");
    expect((await getTexts(b))["branch.emptyTitle"]).toBe("عام للجميع");
    await saveText(mgr, "branch.emptyTitle", null);
    expect((await getTexts(a))["branch.emptyTitle"]).toBe("عام للجميع");
    await saveText(admin, "branch.emptyTitle", null);
    expect((await getTexts(b))["branch.emptyTitle"]).toBe(DEFAULT_TEXTS["branch.emptyTitle"]);
  });

  it("T-26: markup is stripped and limits are enforced", async () => {
    const admin = await makeUser(null, "SuperAdmin");
    const v = await saveText(admin, "home.banner.text", "<script>alert(1)</script>مرحبا **بكم**");
    expect(v).not.toContain("<");
    expect(v).toContain("**بكم**");
    await expect(saveText(admin, "nav.cta", "x".repeat(50))).rejects.toBeInstanceOf(AppError);
    await saveText(admin, "home.banner.text", null);
  });

  it("branch staff cannot edit site-wide texts or work without content.manage", async () => {
    const a = await makeBranch();
    const mgr = await makeUser(a, "BranchManager");
    const staff = await makeUser(a, "Staff", ["units.view"]);
    await expect(saveText(mgr, "home.hero.cta", "احجز")).rejects.toMatchObject({ status: 403 });
    await expect(saveText(staff, "branch.emptyTitle", "x")).rejects.toMatchObject({ status: 403 });
  });
});

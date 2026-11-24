import { describe, it, expect, beforeEach, afterAll } from "vitest";
import sharp from "sharp";
import { q, pool } from "../../src/lib/db";
import { sha256 } from "../../src/lib/crypto";
import { createHold, submitProof, reviewBooking } from "../../src/lib/services/booking";
import { createAccount, setAccountPermissions } from "../../src/lib/services/accounts";
import { userFromToken } from "../../src/lib/auth";
import { withDependencies } from "../../src/lib/permissions";
import { AppError } from "../../src/lib/errors";
import { poolUnit, holdInput, makeUser, resetCaches, uid } from "../fixtures";

beforeEach(() => resetCaches());
afterAll(async () => { await pool().end(); });

const proofFile = async () => ({ buffer: await sharp({ create: { width: 40, height: 40, channels: 3, background: "#1f3d2e" } }).png().toBuffer(), name: "p.png" });
async function expectErr(p: Promise<unknown>, status: number) {
  try { await p; } catch (e) { expect(e).toBeInstanceOf(AppError); expect((e as AppError).status).toBe(status); return; }
  throw new Error("expected error");
}

describe("v3 §6 permissions", () => {
  it("dependencies are added automatically", () => {
    const s = withDependencies(["bookings.block"]);
    expect([...s].sort()).toEqual(["bookings.block", "bookings.reject", "bookings.view", "bookings.view_proof"]);
  });

  it("T-27: confirm without reject → confirm 200, reject 403", async () => {
    const f = await poolUnit();
    const staff = await makeUser(f.branchId, "Staff", ["bookings.confirm"]);
    const a: any = await createHold(holdInput(f.unitId, f.morning));
    await submitProof(a.token, `TX${uid()}`, await proofFile());
    const b: any = await createHold(holdInput(f.unitId, f.evening));
    await submitProof(b.token, `TX${uid()}`, await proofFile());
    await expectErr(reviewBooking(staff, b.id, "Reject", "سبب الرفض"), 403);
    const r = await reviewBooking(staff, a.id, "Confirm");
    expect(r.whatsapp).toContain("wa.me");
  });

  it("T-28: a grantor cannot hand out a permission they do not hold", async () => {
    const f = await poolUnit();
    const lead = await makeUser(f.branchId, "Staff", ["staff.create", "staff.edit_permissions", "bookings.view"]);
    await expectErr(createAccount(lead, { role: "Staff", branchId: f.branchId, username: `s${uid()}`, displayName: "موظف", password: "Passw0rd123", perms: ["bookings.confirm"] }), 403);
    const id = await createAccount(lead, { role: "Staff", branchId: f.branchId, username: `s${uid()}`, displayName: "موظف", password: "Passw0rd123", perms: ["bookings.view"] });
    await expectErr(setAccountPermissions(lead, id, ["units.edit"]), 403);
    // Staff can never create branch managers.
    await expectErr(createAccount(lead, { role: "BranchManager", branchId: f.branchId, username: `m${uid()}`, displayName: "مدير", password: "Passw0rd123", perms: [] }), 403);
  });

  it("T-29: revoking a permission takes effect on the next request", async () => {
    const f = await poolUnit();
    const mgr = await makeUser(f.branchId, "BranchManager");
    const id = await createAccount(mgr, { role: "Staff", branchId: f.branchId, username: `s${uid()}`, displayName: "موظف", password: "Passw0rd123", perms: ["units.edit"] });
    await q("UPDATE app_users SET must_change_password = false, security_stamp = 'st' WHERE id = $1", [id]);
    const token = `tok-${uid()}`;
    await q("INSERT INTO user_sessions (id, user_id, security_stamp, expires_at) VALUES ($1,$2,'st', now() + interval '1 day')", [sha256(token), id]);
    expect((await userFromToken(token))!.permissions.has("units.edit")).toBe(true);
    await setAccountPermissions(mgr, id, ["bookings.view"]);
    const after = (await userFromToken(token))!;
    expect(after.permissions.has("units.edit")).toBe(false);
    expect(after.permissions.has("bookings.view")).toBe(true);
  });

  it("custom manager permissions are respected", async () => {
    const f = await poolUnit();
    const admin = await makeUser(null, "SuperAdmin");
    const id = await createAccount(admin, { role: "BranchManager", branchId: f.branchId, username: `m${uid()}`, displayName: "مدير", password: "Passw0rd123", perms: ["bookings.view"], customManagerPerms: true });
    await q("UPDATE app_users SET must_change_password = false, security_stamp = 'st' WHERE id = $1", [id]);
    const token = `tok-${uid()}`;
    await q("INSERT INTO user_sessions (id, user_id, security_stamp, expires_at) VALUES ($1,$2,'st', now() + interval '1 day')", [sha256(token), id]);
    const u = (await userFromToken(token))!;
    expect(u.permissions.has("bookings.view")).toBe(true);
    expect(u.permissions.has("units.edit")).toBe(false);
  });
});

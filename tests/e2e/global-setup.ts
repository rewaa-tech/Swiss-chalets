import pg from "pg";
import bcrypt from "bcryptjs";
import { rmSync } from "node:fs";
import { migrate } from "../../scripts/migrate";
import { E2E_DB } from "../../playwright.config";

export const ADMIN = { user: "admin", pass: "AdminPass123" };
export const MANAGER = { user: "homs.manager", pass: "ManagerPass123" };

export default async function setup() {
  rmSync("/tmp/swisschalets-e2e", { recursive: true, force: true });
  const c = new pg.Client({ connectionString: E2E_DB });
  await c.connect();
  await c.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await c.end();
  await migrate(E2E_DB);
  const d = new pg.Client({ connectionString: E2E_DB });
  await d.connect();
  const hash = async (p: string) => bcrypt.hash(p, 4);
  await d.query("INSERT INTO app_users (username, display_name, password_hash, role, security_stamp, must_change_password) VALUES ($1,'المدير العام',$2,'SuperAdmin','s1',false)", [ADMIN.user, await hash(ADMIN.pass)]);
  await d.query("INSERT INTO app_users (username, display_name, password_hash, role, branch_id, security_stamp, must_change_password) VALUES ($1,'مدير حمص',$2,'BranchManager',(SELECT id FROM branches WHERE slug='homs'),'s2',false)", [MANAGER.user, await hash(MANAGER.pass)]);
  await d.query("UPDATE branches SET shamcash_account_name = 'الأكواخ السويسرية - حمص', shamcash_account_number = '0912345678901', review_start = '00:00', review_end = '00:00', map_url = 'https://maps.example.com/homs' WHERE slug = 'homs'");
  for (const [k, v] of [["max_daily_per_ip", "100"], ["max_daily_per_device", "100"], ["max_active_per_phone", "5"], ["min_fill_seconds", "5"]])
    await d.query("UPDATE settings SET value = $2 WHERE key = $1", [k, v]);
  await d.end();
  await makeFixtures();
}

export const FIX = "/tmp/swisschalets-e2e-fixtures";
export async function makeFixtures() {
  const { mkdirSync, writeFileSync } = await import("node:fs");
  const sharp = (await import("sharp")).default;
  const { PDFDocument } = await import("pdf-lib");
  mkdirSync(FIX, { recursive: true });
  writeFileSync(`${FIX}/proof.png`, await sharp({ create: { width: 600, height: 900, channels: 3, background: { r: 240, g: 240, b: 235 } } }).png().toBuffer());
  writeFileSync(`${FIX}/chalet.jpg`, await sharp("design/photos/chalet-pool-dusk.jpg").toBuffer());
  const d = await PDFDocument.create();
  d.addPage([300, 400]).drawText("Sham Cash receipt", { x: 30, y: 300, size: 14 });
  d.addPage([300, 400]);
  writeFileSync(`${FIX}/proof.pdf`, await d.save());
}

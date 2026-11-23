// Creates the first super admin from SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD (idempotent).
import pg from "pg";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

const url = process.env.DATABASE_URL, user = process.env.SEED_ADMIN_USERNAME || "admin", pass = process.env.SEED_ADMIN_PASSWORD;
if (!url) throw new Error("DATABASE_URL is not set");
if (!pass || pass.length < 10) throw new Error("Set SEED_ADMIN_PASSWORD (10+ characters)");
const c = new pg.Client({ connectionString: url });
await c.connect();
const exists = await c.query("SELECT id FROM app_users WHERE lower(username) = lower($1)", [user]);
if (exists.rowCount) console.log(`user "${user}" already exists — nothing to do`);
else {
  await c.query("INSERT INTO app_users (username, display_name, password_hash, role, security_stamp, must_change_password) VALUES ($1,'المدير العام',$2,'SuperAdmin',$3,true)",
    [user, await bcrypt.hash(pass, 11), randomBytes(16).toString("hex")]);
  console.log(`super admin "${user}" created — change the password at first login`);
}
await c.end();

import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "./paths";

const B62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** 32-char Base62 token from a CSPRNG. */
export function base62Token(len = 32): string {
  let s = "";
  for (let i = 0; i < len; i++) s += B62[randomInt(62)];
  return s;
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const randomHex = (bytes = 16) => randomBytes(bytes).toString("hex");

let key: Buffer | null = null;
/** App signing key: env APP_SECRET, else a persisted random key under DATA_DIR/keys. */
export function appKey(): Buffer {
  if (key) return key;
  if (process.env.APP_SECRET) return (key = createHash("sha256").update(process.env.APP_SECRET).digest());
  const dir = join(dataDir(), "keys");
  const file = join(dir, "app.key");
  if (!existsSync(file)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    writeFileSync(file, randomBytes(32).toString("hex"), { mode: 0o600 });
  }
  return (key = Buffer.from(readFileSync(file, "utf8").trim(), "hex"));
}

export function sign(payload: string): string {
  const mac = createHmac("sha256", appKey()).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${mac}`;
}

export function verify(token: string | null | undefined): string | null {
  if (!token || !token.includes(".")) return null;
  const [p, mac] = token.split(".");
  let payload: string;
  try { payload = Buffer.from(p, "base64url").toString(); } catch { return null; }
  const exp = createHmac("sha256", appKey()).update(payload).digest();
  const got = Buffer.from(mac, "base64url");
  if (got.length !== exp.length || !timingSafeEqual(got, exp)) return null;
  return payload;
}

/** Signed timestamp embedded in booking forms to measure fill time. */
export const formStamp = (now = Date.now()) => sign(`fs:${now}`);
export function readFormStamp(t: string | null | undefined): number | null {
  const p = verify(t);
  if (!p?.startsWith("fs:")) return null;
  const n = Number(p.slice(3));
  return Number.isFinite(n) ? n : null;
}

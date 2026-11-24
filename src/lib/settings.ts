import { q, type Db } from "./db";

export type Settings = Record<string, string>;
const g = globalThis as unknown as { __scSettings?: { at: number; v: Settings } | null };

export async function getSettings(db?: Db): Promise<Settings> {
  const cache = g.__scSettings;
  if (!db && cache && Date.now() - cache.at < 15000) return cache.v;
  const rows = await q<{ key: string; value: string }>("SELECT key, value FROM settings", [], db);
  const v = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  if (!db) g.__scSettings = { at: Date.now(), v };
  return v;
}

export function invalidateSettings() { g.__scSettings = null; }

export async function setSetting(key: string, value: string, db?: Db) {
  await q("INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [key, value], db);
  invalidateSettings();
}

export const num = (s: Settings, k: string, d: number) => {
  const n = Number(s[k]);
  return Number.isFinite(n) ? n : d;
};

export function fillTemplate(tpl: string, vars: Record<string, string | number | null | undefined>): string {
  return tpl.replace(/\{([^{}]+)\}/g, (m, k) => (k in vars ? String(vars[k] ?? "") : m));
}

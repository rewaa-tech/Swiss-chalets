import "server-only";
import { q, tx } from "../db";
import { bad, forbidden } from "../errors";
import { audit } from "../audit";
import type { SessionUser } from "../permissions";
import { DEFAULT_TEXTS, TEXTS, isTextKey, textDef, type TextDict, type TextKey } from "./registry";
import { sanitizeText } from "./format";

const g = globalThis as unknown as { __scTexts?: Map<string, TextDict> };
const cache = (g.__scTexts ??= new Map());

/** Default ← site-wide value ← branch value (only for keys that allow branch overrides). */
export async function getTexts(branchId?: number | null): Promise<TextDict> {
  const ck = String(branchId ?? 0);
  const hit = cache.get(ck);
  if (hit) return hit;
  const rows = await q<{ key: string; branch_id: number | null; value: string }>(
    "SELECT key, branch_id, value FROM ui_texts WHERE branch_id IS NULL OR branch_id = $1 ORDER BY branch_id NULLS FIRST", [branchId ?? 0]);
  const out = { ...DEFAULT_TEXTS };
  for (const r of rows) {
    if (!isTextKey(r.key)) continue;
    if (r.branch_id != null && textDef(r.key).branch === false) continue;
    out[r.key] = r.value;
  }
  cache.set(ck, out);
  return out;
}
export function invalidateTexts() { cache.clear(); }

/** Server-side translate: t("key", { الفرع: "إدلب" }). */
export function makeT(dict: TextDict) {
  return (k: TextKey, vars?: Record<string, string | number | null | undefined>) => fill(dict[k] ?? DEFAULT_TEXTS[k] ?? k, vars);
}
export const fill = (s: string, vars?: Record<string, string | number | null | undefined>) =>
  vars ? s.replace(/\{([^{}]+)\}/g, (m, k) => (k in vars ? String(vars[k] ?? "") : m)) : s;

export interface TextScope { branchId: number | null }

/** Who may edit what: super admin → site-wide; branch staff with content.manage → their branch. */
export function scopeFor(u: SessionUser): TextScope {
  if (u.role === "SuperAdmin") return { branchId: null };
  if (!u.branchId || !u.permissions.has("content.manage")) throw forbidden();
  return { branchId: u.branchId };
}

export async function saveText(u: SessionUser, key: string, value: string | null) {
  if (!isTextKey(key)) throw bad("نص غير معروف");
  const scope = scopeFor(u);
  const def = textDef(key);
  if (scope.branchId != null && def.branch === false) throw forbidden("هذا النص عام للموقع كله، يعدّله المدير العام فقط");
  const clean = value == null ? null : sanitizeText(value, !!def.long);
  if (clean != null) {
    if (!clean.trim()) throw bad("النص لا يمكن أن يكون فارغًا. استخدم «استرجاع الافتراضي» بدلًا من ذلك", key);
    if (def.max && clean.length > def.max) throw bad(`الحد الأقصى ${def.max} حرفًا`, key);
  }
  await tx(async (c) => {
    if (clean == null || clean === TEXTS[key].def) {
      await c.query("DELETE FROM ui_texts WHERE key = $1 AND COALESCE(branch_id, 0) = $2", [key, scope.branchId ?? 0]);
    } else {
      await c.query(
        `INSERT INTO ui_texts (key, branch_id, value, updated_by) VALUES ($1,$2,$3,$4)
         ON CONFLICT (key, COALESCE(branch_id, 0)) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
        [key, scope.branchId, clean, u.id]);
    }
    await c.query("INSERT INTO ui_text_history (key, branch_id, value, updated_by) VALUES ($1,$2,$3,$4)", [key, scope.branchId, clean, u.id]);
    await audit({ userId: u.id, branchId: scope.branchId, action: clean == null ? "ResetText" : "UpdateText", entity: "ui_text", entityId: key, details: clean ? { value: clean.slice(0, 200) } : undefined }, c);
  });
  invalidateTexts();
  return clean ?? TEXTS[key].def;
}

/** Current values as the editor sees them in a scope (own value, inherited value, default). */
export async function editorRows(scope: TextScope) {
  const rows = await q<{ key: string; branch_id: number | null; value: string; updated_at: string; by: string | null }>(
    `SELECT t.key, t.branch_id, t.value, t.updated_at, a.display_name AS by FROM ui_texts t LEFT JOIN app_users a ON a.id = t.updated_by
      WHERE t.branch_id IS NULL OR t.branch_id = $1`, [scope.branchId ?? 0]);
  const own = new Map<string, { value: string; at: string; by: string | null }>(), global = new Map<string, string>();
  for (const r of rows) {
    if (r.branch_id == null) global.set(r.key, r.value);
    if ((r.branch_id ?? null) === scope.branchId) own.set(r.key, { value: r.value, at: r.updated_at, by: r.by });
  }
  return { own, global };
}

export async function textHistory(scope: TextScope, key: string) {
  return q<{ value: string | null; created_at: string; by: string | null }>(
    `SELECT h.value, h.created_at, a.display_name AS by FROM ui_text_history h LEFT JOIN app_users a ON a.id = h.updated_by
      WHERE h.key = $1 AND COALESCE(h.branch_id, 0) = $2 ORDER BY h.created_at DESC LIMIT 15`, [key, scope.branchId ?? 0]);
}

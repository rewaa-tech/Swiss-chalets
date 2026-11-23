import "server-only";
import { q, one } from "../db";
import { getSettings } from "../settings";
import { toLocal } from "../time";
import { resolveTheme, themeConfig, type Theme } from "./theme";
import { currentSeason } from "./availability";

export async function generalTheme(): Promise<Theme> {
  const s = await getSettings();
  return resolveTheme(themeConfig(s), toLocal(new Date()).month);
}

export async function branchTheme(branchId: number): Promise<{ theme: Theme; season: Awaited<ReturnType<typeof currentSeason>> }> {
  const s = await getSettings();
  const season = await currentSeason(branchId);
  return { theme: resolveTheme(themeConfig(s), toLocal(new Date()).month, season?.kind ?? null), season };
}

export async function publicBranches() {
  return q(
    `SELECT b.id, b.name, b.slug, b.city, b.status, b.cover_media_path, b.description,
            (SELECT count(*)::int FROM units u WHERE u.branch_id = b.id AND u.is_active) AS units,
            (SELECT um.path_base FROM units u JOIN unit_media um ON um.unit_id = u.id WHERE u.branch_id = b.id AND u.is_active ORDER BY um.is_cover DESC, u.sort_order, um.sort_order LIMIT 1) AS fallback_cover
       FROM branches b WHERE b.status <> 'Hidden' ORDER BY b.sort_order, b.id`);
}

export const UNIT_CARD_SQL = `
  SELECT u.id, u.name, u.slug, u.type, u.capacity, u.has_heated_pool, u.allowed_category, b.name AS branch_name, b.slug AS branch_slug,
         (SELECT path_base FROM unit_media m WHERE m.unit_id = u.id ORDER BY is_cover DESC, sort_order, id LIMIT 1) AS cover,
         (SELECT min(price) FROM time_slots t JOIN seasons s ON s.id = t.season_id
           WHERE t.unit_id = u.id AND t.is_active AND s.end_date >= (now() AT TIME ZONE 'Asia/Damascus')::date) AS min_price,
         (SELECT usm.mode FROM unit_season_modes usm JOIN seasons s ON s.id = usm.season_id
           WHERE usm.unit_id = u.id AND (now() AT TIME ZONE 'Asia/Damascus')::date BETWEEN s.start_date AND s.end_date) AS current_mode
    FROM units u JOIN branches b ON b.id = u.branch_id
   WHERE u.is_active AND b.status = 'Active'`;

export async function featuredUnits(limit = 3) {
  return q(`${UNIT_CARD_SQL} ORDER BY u.sort_order, u.id LIMIT $1`, [limit]);
}

export async function branchBySlug(slug: string) {
  return one("SELECT * FROM branches WHERE slug = $1 AND status <> 'Hidden'", [slug]);
}

export async function siteMeta() {
  const s = await getSettings();
  return { currency: s.currency || "USD", showSyp: s.show_syp === "true", rate: Number(s.exchange_rate) || 0, hero: s.hero_image || "/img/hero/chalet-pool-dusk" };
}

export function money(n: number | null | undefined, currency = "USD") {
  if (n == null) return "—";
  const v = Number.isInteger(n) ? String(n) : n.toFixed(2);
  return currency === "USD" ? `$${v}` : `${v} ${currency}`;
}

export function sypText(n: number, rate: number) {
  return `${Math.round(n * rate).toLocaleString("en-US")} ل.س`;
}

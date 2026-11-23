export type Theme = "winter" | "summer" | "neutral";
export type ThemeMode = "Auto" | "Winter" | "Summer" | "Neutral";
export type SeasonKind = "Summer" | "Winter" | "Spring" | "Autumn";

export interface ThemeConfig { mode: ThemeMode; winterMonths: number[]; summerMonths: number[] }

export const parseMonths = (s: string | undefined, d: number[]) => {
  const v = (s ?? "").split(",").map((x) => Number(x.trim())).filter((n) => n >= 1 && n <= 12);
  return v.length ? v : d;
};

export function themeConfig(settings: Record<string, string>): ThemeConfig {
  const m = settings.theme_mode as ThemeMode;
  return {
    mode: ["Auto", "Winter", "Summer", "Neutral"].includes(m) ? m : "Auto",
    winterMonths: parseMonths(settings.theme_winter_months, [12, 1, 2]),
    summerMonths: parseMonths(settings.theme_summer_months, [6, 7, 8]),
  };
}

/**
 * BR-36. `branchSeason` is the current season of the branch for branch/unit/booking pages
 * (undefined for general pages; null when the branch has no current season).
 */
export function resolveTheme(cfg: ThemeConfig, localMonth: number, branchSeason?: SeasonKind | null): Theme {
  if (cfg.mode === "Winter") return "winter";
  if (cfg.mode === "Summer") return "summer";
  if (cfg.mode === "Neutral") return "neutral";
  if (branchSeason) {
    if (branchSeason === "Winter") return "winter";
    if (branchSeason === "Summer") return "summer";
    return "neutral";
  }
  if (cfg.winterMonths.includes(localMonth)) return "winter";
  if (cfg.summerMonths.includes(localMonth)) return "summer";
  return "neutral";
}

export const THEME_BADGE: Record<Theme, string | null> = {
  winter: "شتاء دافئ · مسابح مدفأة",
  summer: "صيف منعش · مسبحك الخاص",
  neutral: null,
};

import Rich from "@/components/Rich";
import { DEFAULT_TEXTS, textDef, type TextDict, type TextKey } from "./registry";

type Vars = Record<string, string | number | null | undefined>;
const fill = (s: string, vars?: Vars) => (vars ? s.replace(/\{([^{}]+)\}/g, (m, k) => (k in vars ? String(vars[k] ?? "") : m)) : s);

/**
 * Text helpers for server and client components:
 *  t("key")  → plain string (for attributes, titles…)
 *  T("key")  → <span data-tk="key"> so editors can click the text to edit it in place (v3 §5.3).
 */
export function textHelpers(dict: TextDict) {
  const t = (k: TextKey, vars?: Vars) => fill(dict[k] ?? DEFAULT_TEXTS[k] ?? k, vars);
  const T = (k: TextKey, vars?: Vars) => {
    const v = t(k, vars);
    return <span data-tk={k}>{textDef(k).long ? <Rich text={v} /> : v}</span>;
  };
  return { t, T };
}

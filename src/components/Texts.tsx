"use client";
import { createContext, useContext } from "react";
import { DEFAULT_TEXTS, type TextDict, type TextKey } from "@/lib/texts/registry";
import { textHelpers } from "@/lib/texts/jsx";

const Ctx = createContext<TextDict>(DEFAULT_TEXTS);

export function TextsProvider({ value, children }: { value: TextDict; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Client-side: const t = useT(); t("form.name") / t("cal.tip", { العدد: 3 }). */
export function useT() {
  const d = useContext(Ctx);
  return (k: TextKey, vars?: Record<string, string | number | null | undefined>) => {
    const s = d[k] ?? DEFAULT_TEXTS[k] ?? k;
    return vars ? s.replace(/\{([^{}]+)\}/g, (m, x) => (x in vars ? String(vars[x] ?? "") : m)) : s;
  };
}
export const useTextDict = () => useContext(Ctx);

/** Client-side: const { t, T } = useTexts(); T renders an editable <span data-tk>. */
export function useTexts() { return textHelpers(useContext(Ctx)); }

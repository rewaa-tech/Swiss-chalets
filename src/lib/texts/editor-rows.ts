import "server-only";
import { TEXTS, TEXT_KEYS, TEXT_PAGES, type TextDef } from "./registry";
import { editorRows, type TextScope } from "./server";
import type { TextRow } from "@/components/admin/TextEditor";

export async function buildEditorRows(scope: TextScope): Promise<TextRow[]> {
  const { own, global } = await editorRows(scope);
  return TEXT_KEYS.map((k) => {
    const d = TEXTS[k] as TextDef;
    const o = own.get(k);
    return {
      key: k, page: d.page, section: d.section, label: d.label, def: d.def, max: d.max, vars: d.vars, long: d.long,
      locked: scope.branchId != null && d.branch === false,
      own: o?.value ?? null, inherited: scope.branchId != null ? global.get(k) ?? null : null, at: o?.at ?? null, by: o?.by ?? null,
    };
  }).filter((r) => !(scope.branchId != null && r.locked && r.own == null && false));
}
export const PAGE_LABELS = TEXT_PAGES as Record<string, string>;

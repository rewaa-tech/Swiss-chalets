"use client";
import ActionForm, { type ActionState } from "./ActionForm";
type Act = (p: ActionState | null, fd: FormData) => Promise<ActionState>;
/** Auto-saves on change; server refuses Pool in spring/autumn and changes that touch bookings. */
export default function ModeSelect({ action, unitId, seasonId, value, poolAllowed }: { action: Act; unitId: number; seasonId: number; value: string; poolAllowed: boolean }) {
  return (
    <ActionForm action={action}>
      <input type="hidden" name="unitId" value={unitId} /><input type="hidden" name="seasonId" value={seasonId} />
      <select name="mode" defaultValue={value} className="select" style={{ minHeight: 42, minWidth: 130 }} aria-label="النمط" onChange={(e) => e.currentTarget.form?.requestSubmit()}>
        <option value="">غير متاح</option>
        {poolAllowed && <option value="Pool">مسبح</option>}
        <option value="Hotel">فندقي</option>
      </select>
    </ActionForm>
  );
}

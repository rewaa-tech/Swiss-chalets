"use client";
import { useCallback, useState } from "react";
import ActionForm, { FormError, Submit, type ActionState } from "./ActionForm";
import PermissionPicker from "./PermissionPicker";
import Sheet from "../Sheet";
import { ALL_PERMISSIONS } from "@/lib/permissions";

type Act = (p: ActionState | null, fd: FormData) => Promise<ActionState>;

/** Super admin: edit a branch manager's permissions (all, or a custom set). */
export default function ManagerPerms({ id, name, custom, perms, action }: { id: number; name: string; custom: boolean; perms: string[]; action: Act }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const [mode, setMode] = useState<"all" | "custom">(custom ? "custom" : "all");
  return (
    <>
      <button type="button" className="btn btn-sm btn-outline" onClick={() => setOpen(true)}>الصلاحيات</button>
      {open && (
        <Sheet open title={`صلاحيات ${name}`} onClose={close} labelledBy={`mp-${id}`} wide>
          <ActionForm action={action} className="flex flex-col gap-4" onDone={(s) => s.ok && setOpen(false)}>
            <input type="hidden" name="id" value={id} />
            <div className="seg" role="radiogroup" aria-label="نوع الصلاحيات">
              <label className={mode === "all" ? "is-on" : ""}><input type="radio" name="perm_mode" value="all" checked={mode === "all"} onChange={() => setMode("all")} />كل صلاحيات الفرع</label>
              <label className={mode === "custom" ? "is-on" : ""}><input type="radio" name="perm_mode" value="custom" checked={mode === "custom"} onChange={() => setMode("custom")} />صلاحيات مخصصة</label>
            </div>
            {mode === "custom" && <PermissionPicker available={ALL_PERMISSIONS} initial={custom ? perms : ALL_PERMISSIONS} />}
            <FormError />
            <div><Submit className="btn btn-dark">حفظ</Submit></div>
          </ActionForm>
        </Sheet>
      )}
    </>
  );
}

"use client";
import { useState } from "react";
import ActionForm, { type ActionState } from "./ActionForm";
import ConfirmButton from "./ConfirmButton";
type Act = (p: ActionState | null, fd: FormData) => Promise<ActionState>;
export default function ResetPassword({ id, action }: { id: number; action: Act }) {
  const [temp, setTemp] = useState<string | null>(null);
  return (
    <ActionForm action={action} onDone={(s) => s.ok && setTemp((s.data as { temp: string }).temp)} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      {temp ? <span className="badge num" dir="ltr" data-fx="copy" data-copy={temp} style={{ background: "#F3E7CC", color: "#7A5A12", cursor: "pointer" }} title="اضغط للنسخ">{temp}</span>
        : <ConfirmButton className="btn btn-sm btn-outline" title="إعادة تعيين كلمة المرور" message="ستُنشأ كلمة مرور مؤقتة وتنتهي كل جلسات المستخدم. سيُطلب منه تغييرها بأول دخول." confirmLabel="إعادة التعيين">كلمة مرور مؤقتة</ConfirmButton>}
    </ActionForm>
  );
}

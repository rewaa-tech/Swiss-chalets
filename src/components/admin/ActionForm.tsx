"use client";
import { createContext, useActionState, useContext, useEffect, useRef } from "react";
import { toast } from "@/fx/toast";

export interface ActionState { ok: boolean; message: string; field?: string; data?: unknown; affected?: { id: number; customer_name: string; status: string; day: string }[]; at: number }
type Action = (prev: ActionState | null, fd: FormData) => Promise<ActionState>;

const Ctx = createContext<{ state: ActionState | null; pending: boolean }>({ state: null, pending: false });
export const useFormState = () => useContext(Ctx);

export default function ActionForm({ action, children, className, reset = false, onDone, id, style }: {
  action: Action; children: React.ReactNode; className?: string; reset?: boolean; onDone?: (s: ActionState) => void; id?: string; style?: React.CSSProperties;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  const last = useRef(0);
  useEffect(() => {
    if (!state || state.at === last.current) return;
    last.current = state.at;
    toast(state.message, state.ok ? "ok" : "err");
    if (state.ok && reset) ref.current?.reset();
    onDone?.(state);
  }, [state, reset, onDone]);
  return (
    <Ctx.Provider value={{ state, pending }}>
      <form ref={ref} action={formAction} className={className} id={id} style={style} noValidate>
        {children}
        {state && !state.ok && state.affected && state.affected.length > 0 && <Affected list={state.affected} />}
      </form>
    </Ctx.Provider>
  );
}

function Affected({ list }: { list: NonNullable<ActionState["affected"]> }) {
  return (
    <div role="alert" style={{ marginTop: 12, padding: 12, borderRadius: 14, background: "#FBF1E6", border: "1px solid #F0D9C3", fontSize: 14 }}>
      <strong style={{ color: "var(--ember)" }}>الحجوزات المتأثرة:</strong>
      <ul style={{ margin: "6px 0 0", paddingInlineStart: 18 }}>
        {list.slice(0, 8).map((b) => <li key={b.id}><a href={`/branch/bookings/${b.id}`} style={{ textDecoration: "underline" }}>#{b.id} · {b.customer_name} · {b.day}</a></li>)}
      </ul>
    </div>
  );
}

export function FieldError({ name }: { name: string }) {
  const { state } = useFormState();
  if (!state || state.ok || state.field !== name) return null;
  return <span className="field-error">{state.message}</span>;
}

export function FormError() {
  const { state } = useFormState();
  if (!state || state.ok || state.field) return null;
  return <div role="alert" className="field-error" style={{ padding: "10px 14px", borderRadius: 12, background: "#F8DEDB" }}>{state.message}</div>;
}

export function Submit({ children, className = "btn btn-dark", pendingText = "جاري الحفظ…", name, value, style }: { children: React.ReactNode; className?: string; pendingText?: string; name?: string; value?: string; style?: React.CSSProperties }) {
  const { pending } = useFormState();
  return <button type="submit" className={className} disabled={pending} name={name} value={value} style={style}>{pending ? pendingText : children}</button>;
}

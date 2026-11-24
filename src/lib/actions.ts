import "server-only";
import { AppError } from "./errors";
import { AffectedError } from "./services/branch-ops";

export interface ActionState {
  ok: boolean;
  message: string;
  field?: string;
  data?: unknown;
  affected?: { id: number; customer_name: string; status: string; day: string }[];
  at: number;
}

export type Action = (prev: ActionState | null, fd: FormData) => Promise<ActionState>;

/** Runs a server action body and maps errors to Arabic messages for the form. */
export async function run(fn: () => Promise<string | { message: string; data?: unknown }>): Promise<ActionState> {
  try {
    const r = await fn();
    return typeof r === "string" ? { ok: true, message: r, at: Date.now() } : { ok: true, message: r.message, data: r.data, at: Date.now() };
  } catch (e) {
    if (e instanceof AffectedError) return { ok: false, message: e.message, affected: e.bookings, at: Date.now() };
    if (e instanceof AppError) return { ok: false, message: e.message, field: e.field, at: Date.now() };
    if ((e as { digest?: string })?.digest?.startsWith?.("NEXT_")) throw e; // redirect / notFound
    console.error(e);
    return { ok: false, message: "حدث خطأ غير متوقع، حاول مرة أخرى", at: Date.now() };
  }
}

export const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
export const int = (fd: FormData, k: string) => { const n = Number(fd.get(k)); return Number.isFinite(n) ? Math.trunc(n) : NaN; };
export const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true" || fd.get(k) === "1";
export async function fileBuf(fd: FormData, k: string): Promise<{ buffer: Buffer; name: string } | null> {
  const f = fd.get(k);
  if (!(f instanceof File) || !f.size) return null;
  return { buffer: Buffer.from(await f.arrayBuffer()), name: f.name };
}

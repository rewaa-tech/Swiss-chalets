import { submitProof } from "@/lib/services/booking";
import { problem, bad } from "@/lib/errors";
import { MAX_PROOF_BYTES } from "@/lib/services/proof";
import { alertIfWithinWindow } from "@/lib/services/jobs";

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const len = Number(req.headers.get("content-length") ?? 0);
    if (len > MAX_PROOF_BYTES + 64 * 1024) throw bad("حجم الملف يجب أن يكون أقل من 5MB", "file");
    const form = await req.formData().catch(() => null);
    if (!form) throw bad("طلب غير صالح");
    const file = form.get("file");
    if (!(file instanceof File)) throw bad("اختر ملف الإشعار", "file");
    if (file.size > MAX_PROOF_BYTES) throw bad("حجم الملف يجب أن يكون أقل من 5MB", "file");
    const r = await submitProof((await ctx.params).token, String(form.get("transactionNumber") ?? ""), { buffer: Buffer.from(await file.arrayBuffer()), name: file.name });
    if (r.within) void alertIfWithinWindow(r.id);
    return Response.json({ ok: true, reviewDueAt: r.reviewDueAt });
  } catch (e) { return problem(e); }
}

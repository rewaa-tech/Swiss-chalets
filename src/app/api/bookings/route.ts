import { createHold } from "@/lib/services/booking";
import { problem, bad } from "@/lib/errors";
import { identityHashes } from "@/lib/request";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") throw bad("طلب غير صالح");
    const ids = await identityHashes();
    const r = await createHold({
      unitId: Number(body.unitId), slotId: Number(body.slotId), date: String(body.date ?? ""), nights: Number(body.nights ?? 1),
      name: String(body.name ?? ""), phone: String(body.phone ?? ""), category: String(body.category ?? ""),
      persons: Number(body.persons), notes: body.notes ? String(body.notes) : null,
      honeypot: body.website ? String(body.website) : "", formStamp: String(body.fs ?? ""),
      ipHash: ids.ipHash, deviceHash: ids.deviceHash,
    });
    if (r.silent) return Response.json({ ok: true }); // honeypot / too fast: 200 without saving
    return Response.json({ token: r.token, holdExpiresAt: r.holdExpiresAt, total: r.total, currency: r.currency, payment: r.payment }, { status: 201 });
  } catch (e) { return problem(e); }
}

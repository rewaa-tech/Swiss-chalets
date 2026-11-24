import { getBookingByToken, canLateUpload } from "@/lib/services/booking";
import { problem, notFound } from "@/lib/errors";

export async function GET(_: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const b = await getBookingByToken((await ctx.params).token);
    if (!b) throw notFound("الطلب غير موجود");
    return Response.json({
      status: b.status, holdExpiresAt: b.hold_expires_at, rejectReason: b.reject_reason,
      lateUpload: b.status === "Expired" ? await canLateUpload(b.id, b.unit_id) : false,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return problem(e); }
}

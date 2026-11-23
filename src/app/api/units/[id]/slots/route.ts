import { getSlots } from "@/lib/services/availability";
import { problem, notFound } from "@/lib/errors";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const id = Number((await ctx.params).id);
    if (!Number.isInteger(id)) throw notFound();
    const date = new URL(req.url).searchParams.get("date") ?? "";
    const r = await getSlots(id, date);
    return Response.json(r.slots, { headers: { "Cache-Control": "no-store", "X-Unit-Mode": r.mode ?? "" } });
  } catch (e) { return problem(e); }
}

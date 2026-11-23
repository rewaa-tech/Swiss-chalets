import { getCalendar } from "@/lib/services/availability";
import { problem, notFound } from "@/lib/errors";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const id = Number((await ctx.params).id);
    if (!Number.isInteger(id)) throw notFound();
    const month = new URL(req.url).searchParams.get("month") ?? "";
    return Response.json(await getCalendar(id, month), { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return problem(e); }
}

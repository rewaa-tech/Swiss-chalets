import { actionUser } from "@/lib/auth";
import { problem } from "@/lib/errors";
import { pendingQueue } from "@/lib/services/panel";
import { expireHolds } from "@/lib/services/availability";

export async function GET() {
  try {
    const u = await actionUser("branch", "bookings.view");
    await expireHolds();
    return Response.json(await pendingQueue(u.branchId!), { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return problem(e); }
}

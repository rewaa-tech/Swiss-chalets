import { one } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await one("SELECT 1");
    return Response.json({ status: "ok", time: new Date().toISOString() });
  } catch {
    return Response.json({ status: "db_unavailable" }, { status: 503 });
  }
}

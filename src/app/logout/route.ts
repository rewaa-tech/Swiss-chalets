import { currentUser, destroySession, rotateStamp } from "@/lib/auth";
import { isSameOrigin } from "@/lib/origin";

/** POST only. Same-origin check guards against cross-site logout; ?all=1 ends every session of the user. */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return new Response("Forbidden", { status: 403 });
  const all = new URL(req.url).searchParams.get("all") === "1";
  if (all) {
    const u = await currentUser();
    if (u) await rotateStamp(u.id);
  }
  await destroySession();
  const to = `/login?ok=${encodeURIComponent(all ? "تم تسجيل الخروج من كل الأجهزة" : "تم تسجيل الخروج")}`;
  return new Response(null, { status: 303, headers: { Location: to, "Cache-Control": "no-store", "Clear-Site-Data": '"cache"' } });
}

export function GET() {
  return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
}

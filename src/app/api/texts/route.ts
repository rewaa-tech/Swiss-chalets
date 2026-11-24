import { currentUser } from "@/lib/auth";
import { bad, forbidden, problem } from "@/lib/errors";
import { saveText, scopeFor, textHistory } from "@/lib/texts/server";
import { isTextKey } from "@/lib/texts/registry";

async function editor(req: Request) {
  const o = req.headers.get("origin");
  if (o && new URL(o).host !== new URL(req.url).host) throw forbidden();
  const u = await currentUser();
  if (!u || u.mustChangePassword) throw forbidden("سجّل الدخول أولًا");
  return u;
}

/** POST { key, value } — value null resets to the default. */
export async function POST(req: Request) {
  try {
    const u = await editor(req);
    const body = await req.json().catch(() => null) as { key?: string; value?: string | null } | null;
    if (!body?.key || (body.value != null && typeof body.value !== "string")) throw bad("طلب غير صالح");
    const value = await saveText(u, body.key, body.value ?? null);
    return Response.json({ ok: true, value });
  } catch (e) { return problem(e); }
}

/** GET ?key= — last 15 versions in the editor's scope. */
export async function GET(req: Request) {
  try {
    const u = await editor(req);
    const key = new URL(req.url).searchParams.get("key") ?? "";
    if (!isTextKey(key)) throw bad("نص غير معروف");
    return Response.json(await textHistory(scopeFor(u), key), { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return problem(e); }
}

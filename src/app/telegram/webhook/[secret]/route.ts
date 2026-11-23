import { timingSafeEqual } from "node:crypto";
import { q } from "@/lib/db";
import { sendTelegram } from "@/lib/services/telegram";

const eq = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Links a panel user to a Telegram chat via a one-time /start code. */
export async function POST(req: Request, ctx: { params: Promise<{ secret: string }> }) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
  const header = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!secret || !eq((await ctx.params).secret, secret) || !eq(header, secret)) return new Response("Not found", { status: 404 });
  const update = await req.json().catch(() => null);
  const msg = update?.message;
  const text: string = msg?.text ?? "";
  const chatId = msg?.chat?.id;
  const m = /^\/start\s+([A-Za-z0-9]{16,64})$/.exec(text.trim());
  if (chatId && m) {
    const r = await q("UPDATE app_users SET telegram_chat_id = $1, telegram_link_code = NULL WHERE telegram_link_code = $2 AND is_active RETURNING display_name", [chatId, m[1]]);
    await sendTelegram(chatId, r.length ? `تم ربط حسابك (${r[0].display_name}) بإشعارات الأكواخ السويسرية ✅` : "رمز الربط غير صالح أو مستخدم مسبقًا.");
  }
  return Response.json({ ok: true });
}

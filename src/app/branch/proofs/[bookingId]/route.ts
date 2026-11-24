import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { actionUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { proofsDir } from "@/lib/paths";

/** Proofs are only served here, after checking bookings.view and the branch. */
export async function GET(_: Request, ctx: { params: Promise<{ bookingId: string }> }) {
  let u;
  try { u = await actionUser("branch", "bookings.view_proof"); } catch (e) { return new Response("Forbidden", { status: (e as { status?: number }).status ?? 403 }); }
  const id = Number((await ctx.params).bookingId);
  const p = Number.isInteger(id) ? await one(
    "SELECT p.file_path, p.proof_kind FROM payment_proofs p JOIN bookings b ON b.id = p.booking_id WHERE p.booking_id = $1 AND b.branch_id = $2 AND p.file_deleted_at IS NULL", [id, u.branchId]) : null;
  if (!p?.file_path) return new Response("Not found", { status: 404 });
  try {
    const data = await readFile(join(proofsDir(), p.file_path));
    const pdf = p.proof_kind === "Pdf";
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": pdf ? "application/pdf" : "image/webp",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": `inline; filename="proof-${id}.${pdf ? "pdf" : "webp"}"`,
        "Content-Security-Policy": "sandbox",
        "Cache-Control": "private, no-store",
      },
    });
  } catch { return new Response("Not found", { status: 404 }); }
}

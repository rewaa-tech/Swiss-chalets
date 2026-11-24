import { actionUser } from "@/lib/auth";
import { isSameOrigin } from "@/lib/origin";
import { bad, forbidden, problem } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { unitInBranch } from "@/lib/services/branch-ops";
import { appendChunk, discardUpload, finishUpload, receivedBytes, CHUNK_BYTES, type UploadTarget } from "@/lib/services/uploads";

export const runtime = "nodejs";

function sameOrigin(req: Request) {
  if (!isSameOrigin(req)) throw forbidden();
}

/** GET ?id=… → bytes already received (resume). */
export async function GET(req: Request) {
  try {
    await actionUser("branch", "units.media");
    const id = new URL(req.url).searchParams.get("id") ?? "";
    return Response.json({ received: await receivedBytes(id), chunk: CHUNK_BYTES }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return problem(e); }
}

/**
 * PUT ?id&unit&offset&total → append one raw chunk (body ≤ 4MB, under Nginx's 6m limit).
 * POST ?id&unit&target=album|cover → finish: validate, store image / queue video.
 * DELETE ?id → discard a cancelled upload.
 */
export async function PUT(req: Request) {
  try {
    sameOrigin(req);
    const u = await actionUser("branch", "units.media");
    const sp = new URL(req.url).searchParams;
    await unitInBranch(u, Number(sp.get("unit")));
    const data = Buffer.from(await req.arrayBuffer());
    const received = await appendChunk(sp.get("id") ?? "", Number(sp.get("offset")), data, Number(sp.get("total")));
    return Response.json({ received });
  } catch (e) { return problem(e); }
}

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const u = await actionUser("branch", "units.media");
    const sp = new URL(req.url).searchParams;
    const unitId = Number(sp.get("unit"));
    await unitInBranch(u, unitId);
    const target = sp.get("target") as UploadTarget;
    if (target !== "album" && target !== "cover") throw bad("وجهة رفع غير معروفة");
    const r = await finishUpload(sp.get("id") ?? "", unitId, target);
    await audit({ userId: u.id, branchId: u.branchId, action: target === "cover" ? "ChangeCover" : "UploadMedia", entity: "unit", entityId: unitId, details: { kind: r.kind } });
    return Response.json(r);
  } catch (e) { return problem(e); }
}

export async function DELETE(req: Request) {
  try {
    sameOrigin(req);
    await actionUser("branch", "units.media");
    await discardUpload(new URL(req.url).searchParams.get("id") ?? "");
    return new Response(null, { status: 204 });
  } catch (e) { return problem(e); }
}

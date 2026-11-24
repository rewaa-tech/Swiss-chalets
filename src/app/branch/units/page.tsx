import Link from "next/link";
import { PageHead, Empty } from "@/components/admin/AdminShell";
import ActionForm from "@/components/admin/ActionForm";
import ConfirmButton from "@/components/admin/ConfirmButton";
import Icon from "@/components/Icon";
import { requireUser, requirePerm } from "@/lib/auth";
import { q } from "@/lib/db";
import { unitActiveAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function UnitsPage() {
  const u = await requireUser("branch");
  requirePerm(u, "units.view");
  const units = await q(`SELECT un.*, un.cover_path_base AS cover,
    (SELECT count(*)::int FROM unit_media m WHERE m.unit_id = un.id) AS photos FROM units un WHERE un.branch_id = $1 ORDER BY un.sort_order, un.id`, [u.branchId]);
  return (
    <>
      <PageHead title="الوحدات" sub={`${units.length} وحدة`}>{u.permissions.has("units.create") && <Link href="/branch/units/new" className="btn btn-cta btn-sm" style={{ minHeight: 46 }}><Icon name="plus" size={18} />وحدة جديدة</Link>}</PageHead>
      {!units.length ? (
        <div className="admin-card"><Empty icon="home" title="لا توجد وحدات بعد" text="ابدأ بإضافة أول كوخ أو مزرعة، ثم ارفع صوره وحدد المواسم والفترات وافتح الأيام.">
          <Link href="/branch/units/new" className="btn btn-cta">إضافة أول وحدة</Link></Empty></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {units.map((x) => (
            <div key={x.id} className="admin-card row flex flex-col gap-3" style={{ padding: 0, overflow: "hidden", opacity: x.is_active ? 1 : 0.7 }}>
              <div style={{ height: 160, background: "repeating-linear-gradient(135deg,#2C4A38 0 16px,#284434 16px 32px)" }}>
                {x.cover && /* eslint-disable-next-line @next/next/no-img-element */ <img src={`/media/${x.cover}-480.webp`} alt="" className="w-full h-full object-cover" loading="lazy" />}
              </div>
              <div className="flex flex-col gap-2" style={{ padding: "0 16px 16px" }}>
                <div className="flex items-center justify-between gap-2"><strong style={{ fontFamily: "var(--f-head)" }}>{x.name}</strong>{!x.is_active && <span className="badge b-Expired">معطلة</span>}</div>
                <span className="muted" style={{ fontSize: 13 }}>{x.type === "Farm" ? "مزرعة" : "كوخ"} · حتى {x.capacity} · {x.photos} صورة وفيديو · {x.allowed_category === "FamilyOnly" ? "عائلي فقط" : "عائلي وشبابي"}</span>
                <div className="flex gap-2 flex-wrap">
                  <Link href={`/branch/units/${x.id}`} className="btn btn-sm btn-dark">{u.permissions.has("units.edit") || u.permissions.has("units.media") ? "تعديل" : "عرض"}</Link>
                  <Link href={`/u/${encodeURIComponent(x.slug)}`} target="_blank" className="btn btn-sm btn-outline">معاينة</Link>
                  {u.permissions.has("slots.view") && <Link href={`/branch/slots?unit=${x.id}`} className="btn btn-sm btn-outline">الفترات</Link>}
                  {u.permissions.has("units.toggle") && <ActionForm action={unitActiveAction}>
                    <input type="hidden" name="id" value={x.id} />
                    {x.is_active
                      ? <ConfirmButton className="btn btn-sm btn-outline" name="active" value="0" title="تعطيل الوحدة" message="لن تظهر الوحدة للزبائن. لا يمكن التعطيل إذا عليها حجوزات قادمة." confirmLabel="تعطيل">تعطيل</ConfirmButton>
                      : <button className="btn btn-sm btn-success" name="active" value="1">تفعيل</button>}
                  </ActionForm>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

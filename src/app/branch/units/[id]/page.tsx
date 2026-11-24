import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHead } from "@/components/admin/AdminShell";
import UnitForm from "@/components/admin/UnitForm";
import MediaUploader from "@/components/admin/MediaUploader";
import ActionForm from "@/components/admin/ActionForm";
import ConfirmButton from "@/components/admin/ConfirmButton";
import Icon from "@/components/Icon";
import { requireUser, requirePerm } from "@/lib/auth";
import { q, one } from "@/lib/db";
import { unitAction, mediaUploadAction, mediaAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function UnitEdit({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser("branch");
  requirePerm(u, "units.view");
  const raw = (await params).id;
  const isNew = raw === "new";
  const unit = isNew ? null : await one("SELECT * FROM units WHERE id = $1 AND branch_id = $2", [Number(raw) || 0, u.branchId]);
  if (!isNew && !unit) notFound();
  const [amenities, selected, media] = await Promise.all([
    q("SELECT id, name FROM amenities ORDER BY id"),
    unit ? q("SELECT amenity_id FROM unit_amenities WHERE unit_id = $1", [unit.id]) : Promise.resolve([]),
    unit ? q("SELECT * FROM unit_media WHERE unit_id = $1 ORDER BY sort_order, id", [unit.id]) : Promise.resolve([]),
  ]);
  return (
    <>
      <PageHead title={unit ? unit.name : "وحدة جديدة"} sub={unit ? "البيانات والصور والمرافق" : "أدخل بيانات الوحدة، ثم ارفع الصور"}>
        <Link href="/branch/units" className="btn btn-outline btn-sm">رجوع</Link>
        {unit && <Link href={`/u/${unit.slug}`} target="_blank" className="btn btn-outline btn-sm">عرض بالموقع</Link>}
      </PageHead>
      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <UnitForm unit={unit ? JSON.parse(JSON.stringify(unit)) : undefined} amenities={amenities} selected={selected.map((s) => s.amenity_id)} action={unitAction} />
        {unit && (
          <div className="admin-card flex flex-col gap-4">
            <h2 style={{ fontSize: 17 }}>الصور</h2>
            <MediaUploader unitId={unit.id} action={mediaUploadAction} />
            {!media.length ? <p className="muted" style={{ margin: 0 }}>لا توجد صور بعد. الصورة الأولى تصير الغلاف.</p> : (
              <ul className="grid grid-cols-2 gap-3" style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {media.map((m, i) => (
                  <li key={m.id} className="relative overflow-hidden" style={{ borderRadius: 16, border: m.is_cover ? "3px solid var(--sand)" : "1px solid var(--line)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/media/${m.path_base}-480.webp`} alt="" style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover" }} loading="lazy" />
                    {m.is_cover && <span className="badge absolute" style={{ top: 8, right: 8, background: "var(--sand)", color: "var(--night)" }}>الغلاف</span>}
                    <ActionForm action={mediaAction} className="flex gap-1 justify-center" style={{ padding: 6, background: "#fff" }}>
                      <input type="hidden" name="mediaId" value={m.id} />
                      <button className="btn btn-icon btn-outline" name="op" value="up" disabled={i === 0} aria-label="تقديم" style={{ minHeight: 36, width: 36 }}><Icon name="back" size={16} /></button>
                      <button className="btn btn-icon btn-outline" name="op" value="down" disabled={i === media.length - 1} aria-label="تأخير" style={{ minHeight: 36, width: 36 }}><Icon name="arrow" size={16} /></button>
                      {!m.is_cover && <button className="btn btn-icon btn-outline" name="op" value="cover" aria-label="اجعلها الغلاف" style={{ minHeight: 36, width: 36 }}><Icon name="star" size={16} /></button>}
                      <ConfirmButton className="btn btn-icon btn-outline" name="op" value="delete" title="حذف الصورة" message="ستُحذف الصورة نهائيًا." confirmLabel="حذف" danger><Icon name="close" size={16} /></ConfirmButton>
                    </ActionForm>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </>
  );
}

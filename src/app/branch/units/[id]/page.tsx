import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHead } from "@/components/admin/AdminShell";
import UnitForm from "@/components/admin/UnitForm";
import MediaManager, { type MediaItem } from "@/components/admin/MediaManager";
import { requireUser, requirePerm } from "@/lib/auth";
import { q, one } from "@/lib/db";
import { unitAction, mediaAction } from "../../actions";

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
    unit ? q("SELECT id, kind, status, path_base, caption, is_active, duration_seconds, color FROM unit_media WHERE unit_id = $1 ORDER BY sort_order, id", [unit.id]) : Promise.resolve([]),
  ]);
  return (
    <>
      <PageHead title={unit ? unit.name : "وحدة جديدة"} sub={unit ? "البيانات والصور والمرافق" : "أدخل بيانات الوحدة، ثم ارفع الصور"}>
        <Link href="/branch/units" className="btn btn-outline btn-sm">رجوع</Link>
        {unit && <Link href={`/u/${unit.slug}`} target="_blank" className="btn btn-outline btn-sm">عرض بالموقع</Link>}
      </PageHead>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <UnitForm unit={unit ? JSON.parse(JSON.stringify(unit)) : undefined} amenities={amenities} selected={selected.map((s) => s.amenity_id)} action={unitAction} />
        {unit && (
          <div className="flex flex-col gap-5 min-w-0">
            <MediaManager unitId={unit.id} action={mediaAction} canEdit={u.permissions.has("units.media")}
              cover={{ base: unit.cover_path_base, x: unit.cover_focal_x, y: unit.cover_focal_y, color: unit.cover_color }}
              items={JSON.parse(JSON.stringify(media)) as MediaItem[]} />
          </div>
        )}
      </div>
    </>
  );
}

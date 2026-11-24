import { PageHead } from "@/components/admin/AdminShell";
import ActionForm, { FieldError, FormError, Submit } from "@/components/admin/ActionForm";
import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { branchAction } from "../actions";

export const dynamic = "force-dynamic";
const ST = { Active: "نشط", ComingSoon: "قريبًا", Hidden: "مخفي" } as const;

function BranchForm({ b }: { b?: any }) {
  return (
    <ActionForm action={branchAction} className="flex flex-col gap-3" reset={!b}>
      {b && <input type="hidden" name="id" value={b.id} />}
      <div className="grid gap-3 md:grid-cols-4">
        <label className="field"><span className="label">الاسم</span><input name="name" className="input" defaultValue={b?.name} /><FieldError name="name" /></label>
        <label className="field"><span className="label">الرابط المختصر</span><input name="slug" className="input" dir="ltr" defaultValue={b?.slug} placeholder="homs" /><FieldError name="slug" /></label>
        <label className="field"><span className="label">المدينة</span><input name="city" className="input" defaultValue={b?.city} /></label>
        <label className="field"><span className="label">الحالة</span><select name="status" className="select" defaultValue={b?.status ?? "Active"}>{Object.entries(ST).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_120px]">
        <label className="field"><span className="label">رابط الخريطة</span><input name="map_url" className="input" dir="ltr" defaultValue={b?.map_url ?? ""} placeholder="https://maps.app.goo.gl/…" /><FieldError name="map_url" /></label>
        <label className="field"><span className="label">صورة الغلاف</span><input name="cover" type="file" accept="image/jpeg,image/png,image/webp" className="input" /></label>
        <label className="field"><span className="label">الترتيب</span><input name="sort_order" type="number" className="input" defaultValue={b?.sort_order ?? 0} /></label>
      </div>
      <label className="field"><span className="label">الوصف</span><textarea name="description" className="textarea" defaultValue={b?.description} maxLength={1000} /></label>
      <FormError />
      <div><Submit className={b ? "btn btn-dark btn-sm" : "btn btn-cta"}>{b ? "حفظ" : "إضافة الفرع"}</Submit></div>
    </ActionForm>
  );
}

export default async function BranchesPage() {
  await requireUser("admin");
  const branches = await q("SELECT b.*, (SELECT count(*)::int FROM units u WHERE u.branch_id = b.id) AS units FROM branches b ORDER BY sort_order, id");
  return (
    <>
      <PageHead title="الفروع" sub="الحالة «قريبًا» تعرض الفرع بإطار متقطع بدون حجز" />
      <div className="flex flex-col gap-4">
        {branches.map((b) => (
          <details key={b.id} className="admin-card" open={false}>
            <summary className="flex items-center justify-between gap-2 flex-wrap" style={{ cursor: "pointer", listStyle: "none" }}>
              <span className="flex items-center gap-3">
                {b.cover_media_path && /* eslint-disable-next-line @next/next/no-img-element */ <img src={`/media/${b.cover_media_path}-480.webp`} alt="" width={64} height={44} style={{ borderRadius: 10, objectFit: "cover", height: 44 }} />}
                <strong style={{ fontFamily: "var(--f-head)", fontSize: 17 }}>{b.name}</strong><span className={`badge ${b.status === "Active" ? "b-Confirmed" : b.status === "ComingSoon" ? "b-Held" : "b-Expired"}`}>{ST[b.status as keyof typeof ST]}</span>
              </span>
              <span className="muted" style={{ fontSize: 13 }}>{b.units} وحدات · /b/{b.slug}</span>
            </summary>
            <div style={{ marginTop: 14 }}><BranchForm b={JSON.parse(JSON.stringify(b))} /></div>
          </details>
        ))}
        <div className="admin-card"><h2 style={{ fontSize: 17, marginBottom: 12 }}>فرع جديد</h2><BranchForm /></div>
      </div>
    </>
  );
}

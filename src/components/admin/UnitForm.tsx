"use client";
import ActionForm, { FieldError, FormError, Submit, type ActionState } from "./ActionForm";
import { useRouter } from "next/navigation";

type Act = (p: ActionState | null, fd: FormData) => Promise<ActionState>;

export default function UnitForm({ unit, amenities, selected, action }: { unit?: any; amenities: { id: number; name: string }[]; selected: number[]; action: Act }) {
  const router = useRouter();
  return (
    <ActionForm action={action} className="admin-card flex flex-col gap-4" onDone={(s) => { if (s.ok && !unit) router.push(`/branch/units/${(s.data as { id: number }).id}?ok=${encodeURIComponent("تمت إضافة الوحدة. ارفع صورها الآن")}`); }}>
      {unit && <input type="hidden" name="id" value={unit.id} />}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="field"><label className="label" htmlFor="u-name">اسم الوحدة</label><input id="u-name" name="name" className="input" defaultValue={unit?.name} required /><FieldError name="name" /></div>
        <div className="field"><label className="label" htmlFor="u-slug">الرابط المختصر</label><input id="u-slug" name="slug" className="input" dir="ltr" defaultValue={unit?.slug} placeholder="يُولّد من الاسم تلقائيًا" /><FieldError name="slug" /></div>
        <div className="field"><label className="label" htmlFor="u-type">النوع</label><select id="u-type" name="type" className="select" defaultValue={unit?.type ?? "Chalet"}><option value="Chalet">كوخ</option><option value="Farm">مزرعة</option></select></div>
        <div className="field"><label className="label" htmlFor="u-cat">الفئات المقبولة</label><select id="u-cat" name="allowed_category" className="select" defaultValue={unit?.allowed_category ?? "FamilyAndYouth"}><option value="FamilyAndYouth">عائلي وشبابي</option><option value="FamilyOnly">عائلي فقط</option></select></div>
        <div className="field"><label className="label" htmlFor="u-cap">السعة القصوى (أشخاص)</label><input id="u-cap" name="capacity" type="number" min={1} max={200} className="input" defaultValue={unit?.capacity ?? 6} /><FieldError name="capacity" /></div>
        <div className="grid grid-cols-3 gap-3">
          <div className="field"><label className="label" htmlFor="u-bed">غرف</label><input id="u-bed" name="bedrooms" type="number" min={0} className="input" defaultValue={unit?.bedrooms ?? 1} /></div>
          <div className="field"><label className="label" htmlFor="u-bath">حمامات</label><input id="u-bath" name="bathrooms" type="number" min={0} className="input" defaultValue={unit?.bathrooms ?? 1} /></div>
          <div className="field"><label className="label" htmlFor="u-sort">الترتيب</label><input id="u-sort" name="sort_order" type="number" className="input" defaultValue={unit?.sort_order ?? 0} /></div>
        </div>
      </div>
      <label className="flex items-center gap-2.5" style={{ fontWeight: 600 }}><input type="checkbox" name="has_heated_pool" defaultChecked={unit?.has_heated_pool} style={{ width: 20, height: 20 }} />المسبح مدفأ (يُتاح نمط المسبح في الشتاء)</label>
      <div className="field"><label className="label" htmlFor="u-desc">الوصف</label><textarea id="u-desc" name="description" className="textarea" defaultValue={unit?.description} maxLength={3000} /></div>
      <div className="field"><label className="label" htmlFor="u-rules">القواعد (سطر لكل قاعدة)</label><textarea id="u-rules" name="rules" className="textarea" defaultValue={unit?.rules} maxLength={2000} /></div>
      <fieldset className="flex flex-col gap-2" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label">المرافق</legend>
        <div className="flex flex-wrap gap-2">
          {amenities.map((a) => (
            <label key={a.id} className="chip" style={{ background: "var(--line-soft)", color: "var(--forest)", cursor: "pointer", minHeight: 40 }}>
              <input type="checkbox" name="amenities" value={a.id} defaultChecked={selected.includes(a.id)} />{a.name}
            </label>
          ))}
        </div>
      </fieldset>
      <FormError />
      <div><Submit className="btn btn-cta">{unit ? "حفظ التعديلات" : "إضافة الوحدة"}</Submit></div>
    </ActionForm>
  );
}

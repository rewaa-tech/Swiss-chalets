import { PageHead, Empty } from "@/components/admin/AdminShell";
import ActionForm, { FieldError, FormError, Submit } from "@/components/admin/ActionForm";
import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { contactAction, pageContactAction } from "../actions";

export const dynamic = "force-dynamic";
const PAGES: [string, string][] = [["Home", "الرئيسية"], ["Branch", "صفحة فرع"], ["Unit", "صفحة وحدة"], ["Booking", "صفحة طلب"], ["Terms", "الشروط"], ["My", "طلباتي"]];

export default async function ContactsPage() {
  await requireUser("admin");
  const [contacts, branches, units, maps] = await Promise.all([
    q("SELECT c.*, b.name AS branch_name FROM contact_numbers c LEFT JOIN branches b ON b.id = c.branch_id ORDER BY c.is_default DESC, c.id"),
    q("SELECT id, name FROM branches ORDER BY sort_order, id"),
    q("SELECT u.id, u.name, b.name AS branch FROM units u JOIN branches b ON b.id = u.branch_id ORDER BY b.sort_order, u.sort_order"),
    q("SELECT pc.*, c.label, c.phone_e164 FROM page_contacts pc JOIN contact_numbers c ON c.id = pc.contact_id"),
  ]);
  const mapFor = (t: string, e: number | null) => maps.find((m) => m.page_type === t && (m.entity_id ?? null) === e)?.contact_id ?? "";
  const rows: { t: string; e: number | null; l: string }[] = [
    ...PAGES.map(([t, l]) => ({ t, e: null, l: `${l} (عام)` })),
    ...branches.map((b) => ({ t: "Branch", e: b.id, l: `فرع ${b.name}` })),
    ...units.map((u) => ({ t: "Unit", e: u.id, l: `${u.name} · ${u.branch}` })),
  ];
  const active = contacts.filter((c) => c.is_active);
  return (
    <>
      <PageHead title="أرقام التواصل" sub="الأولوية: رقم الصفحة المحددة ← رقم نوع الصفحة ← رقم الفرع ← الرقم الافتراضي" />
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div className="admin-card">
            {!contacts.length ? <Empty icon="phone" title="لا توجد أرقام بعد" text="أضف أول رقم واتساب، ويصير الرقم الافتراضي." /> : (
              <ul className="flex flex-col gap-2" style={{ margin: 0, padding: 0, listStyle: "none" }}>{contacts.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 flex-wrap" style={{ padding: "10px 0", borderBottom: "1px solid var(--line-soft)", opacity: c.is_active ? 1 : 0.55 }}>
                  <span className="flex flex-col"><strong>{c.label}{c.is_default && <span className="badge b-Confirmed" style={{ marginInlineStart: 8 }}>افتراضي</span>}</strong><span className="muted num" dir="ltr" style={{ textAlign: "right", fontSize: 13 }}>{c.phone_e164}{c.branch_name ? ` · ${c.branch_name}` : ""}</span></span>
                  <ActionForm action={contactAction} className="flex gap-2"><input type="hidden" name="id" value={c.id} />
                    {!c.is_default && c.is_active && <button className="btn btn-sm btn-outline" name="op" value="default">اجعله افتراضيًا</button>}
                    <button className="btn btn-sm btn-outline" name="op" value="toggle">{c.is_active ? "تعطيل" : "تفعيل"}</button>
                  </ActionForm>
                </li>))}</ul>
            )}
          </div>
          <ActionForm action={contactAction} className="admin-card flex flex-col gap-3" reset>
            <h2 style={{ fontSize: 17 }}>إضافة رقم</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="field"><span className="label">الوصف</span><input name="label" className="input" placeholder="واتساب فرع حمص" /><FieldError name="label" /></label>
              <label className="field"><span className="label">الرقم</span><input name="phone" className="input num" dir="ltr" placeholder="09xxxxxxxx" /><FieldError name="phone" /></label>
              <label className="field"><span className="label">رقم الفرع (اختياري)</span><select name="branch_id" className="select"><option value="">—</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
            </div>
            <FormError />
            <div><Submit className="btn btn-cta btn-sm">إضافة</Submit></div>
          </ActionForm>
        </div>
        <div className="admin-card flex flex-col gap-2">
          <h2 style={{ fontSize: 17 }}>توزيع الأرقام على الصفحات</h2>
          {rows.map((r) => (
            <ActionForm key={`${r.t}-${r.e}`} action={pageContactAction} className="flex items-center justify-between gap-2" style={{ padding: "6px 0", borderBottom: "1px solid var(--line-soft)" }}>
              <input type="hidden" name="page_type" value={r.t} /><input type="hidden" name="entity_id" value={r.e ?? ""} />
              <span style={{ fontSize: 14 }}>{r.l}</span>
              <select name="contact_id" defaultValue={mapFor(r.t, r.e)} className="select" style={{ maxWidth: 220, minHeight: 42 }} aria-label={`رقم ${r.l}`}>
                <option value="">— حسب الأولوية —</option>{active.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <Submit className="btn btn-sm btn-outline" pendingText="…">حفظ</Submit>
            </ActionForm>
          ))}
        </div>
      </div>
    </>
  );
}

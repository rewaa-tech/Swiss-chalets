import Link from "next/link";
import { PageHead, Empty } from "@/components/admin/AdminShell";
import ActionForm, { FieldError, FormError, Submit } from "@/components/admin/ActionForm";
import ConfirmButton from "@/components/admin/ConfirmButton";
import SlotBar from "@/components/admin/SlotBar";
import CopySlots from "@/components/admin/CopySlots";
import { requireUser, requirePerm } from "@/lib/auth";
import { q, one } from "@/lib/db";
import { branchUnits } from "@/lib/services/panel";
import { overlapsInDay } from "@/lib/services/branch-ops";
import { slotAction, slotActiveAction, copySlotsAction } from "../actions";

export const dynamic = "force-dynamic";
const SEASON: Record<string, string> = { Summer: "الصيف", Winter: "الشتاء", Spring: "الربيع", Autumn: "الخريف" };
const KIND: Record<string, string> = { Hours6: "6 ساعات", Hours10: "10 ساعات", FullDay: "يوم كامل", HotelNight: "ليلة فندقية" };

export default async function SlotsPage({ searchParams }: { searchParams: Promise<{ unit?: string; season?: string }> }) {
  const u = await requireUser("branch");
  requirePerm(u, "slots.manage");
  const sp = await searchParams;
  const [units, seasons] = await Promise.all([branchUnits(u.branchId!), q("SELECT * FROM seasons WHERE branch_id = $1 ORDER BY start_date", [u.branchId])]);
  if (!units.length || !seasons.length) return (<><PageHead title="الفترات والأسعار" /><div className="admin-card"><Empty icon="tag" title={!units.length ? "أضف وحدة أولًا" : "حدد المواسم أولًا"} text="الفترات تُعرّف لكل وحدة ولكل موسم." /></div></>);
  const unitId = units.find((x) => x.id === Number(sp.unit))?.id ?? units[0].id;
  const season = seasons.find((s) => s.id === Number(sp.season)) ?? seasons[0];
  const [slots, mode] = await Promise.all([
    q("SELECT * FROM time_slots WHERE unit_id = $1 AND season_id = $2 ORDER BY is_active DESC, start_time", [unitId, season.id]),
    one("SELECT mode FROM unit_season_modes WHERE unit_id = $1 AND season_id = $2", [unitId, season.id]),
  ]);
  const overlaps = [...overlapsInDay(slots.filter((s) => s.is_active))];
  const kinds = mode?.mode === "Hotel" ? ["HotelNight"] : mode?.mode === "Pool" ? ["Hours6", "Hours10", "FullDay"] : ["Hours6", "Hours10", "FullDay", "HotelNight"];
  const SlotFields = ({ s }: { s?: any }) => (
    <>
      <input type="hidden" name="unitId" value={unitId} /><input type="hidden" name="seasonId" value={season.id} />{s && <input type="hidden" name="id" value={s.id} />}
      <div className="field" style={{ flex: "1 1 140px" }}><label className="label" style={{ fontSize: 12 }}>الاسم</label><input name="name" className="input" defaultValue={s?.name} placeholder="مثال: فترة صباحية" /><FieldError name="name" /></div>
      <div className="field" style={{ flex: "0 1 140px" }}><label className="label" style={{ fontSize: 12 }}>النوع</label><select name="kind" className="select" defaultValue={s?.kind ?? kinds[0]}>{kinds.map((k) => <option key={k} value={k}>{KIND[k]}</option>)}</select></div>
      <div className="field" style={{ flex: "0 1 120px" }}><label className="label" style={{ fontSize: 12 }}>البداية</label><input name="startTime" type="time" className="input" defaultValue={s?.start_time?.slice(0, 5) ?? "10:00"} /><FieldError name="startTime" /></div>
      <div className="field" style={{ flex: "0 1 100px" }}><label className="label" style={{ fontSize: 12 }}>المدة (ساعة)</label><input name="hours" type="number" step="0.5" min={1} max={48} className="input" defaultValue={s ? s.duration_minutes / 60 : ""} placeholder="تلقائي" /><FieldError name="durationMinutes" /></div>
      <div className="field" style={{ flex: "0 1 110px" }}><label className="label" style={{ fontSize: 12 }}>السعر ($)</label><input name="price" type="number" step="0.01" min={0} className="input" defaultValue={s?.price} /><FieldError name="price" /></div>
    </>
  );
  return (
    <>
      <PageHead title="الفترات والأسعار" sub="السعر ثابت مهما كان عدد الأشخاص ضمن السعة" />
      <div className="admin-card flex flex-col gap-4" style={{ marginBottom: 16 }}>
        <form method="get" className="flex flex-wrap gap-2 items-end">
          <div className="field" style={{ flex: "1 1 200px" }}><label className="label" htmlFor="s-u">الوحدة</label><select id="s-u" name="unit" defaultValue={unitId} className="select">{units.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
          <div className="field" style={{ flex: "1 1 200px" }}><label className="label" htmlFor="s-s">الموسم</label><select id="s-s" name="season" defaultValue={season.id} className="select">{seasons.map((s) => <option key={s.id} value={s.id}>{SEASON[s.kind]} ({s.start_date} → {s.end_date})</option>)}</select></div>
          <button className="btn btn-dark" style={{ minHeight: 50 }}>عرض</button>
        </form>
        <div className="flex items-center gap-2" style={{ fontSize: 14 }}>النمط بهذا الموسم: <strong>{mode?.mode === "Pool" ? "مسبح" : mode?.mode === "Hotel" ? "فندقي" : "غير محدد"}</strong>{!mode && <Link href="/branch/seasons" style={{ textDecoration: "underline" }}>حدد النمط</Link>}</div>
        <SlotBar slots={slots} overlaps={overlaps} />
      </div>
      <div className="flex flex-col gap-3">
        {!slots.length && <div className="admin-card"><Empty icon="tag" title="لا توجد فترات لهذا الموسم" text="أضف فترة بالأسفل أو انسخ من وحدة أخرى." /></div>}
        {slots.map((s) => (
          <div key={s.id} className="admin-card row flex flex-col gap-2" style={{ opacity: s.is_active ? 1 : 0.6 }}>
            <ActionForm action={slotAction} className="flex flex-wrap gap-2 items-end"><SlotFields s={s} /><Submit className="btn btn-dark btn-sm" style={{ minHeight: 50 }}>حفظ</Submit></ActionForm>
            <ActionForm action={slotActiveAction} className="flex items-center gap-2">
              <input type="hidden" name="id" value={s.id} />
              {s.is_active ? <ConfirmButton className="btn btn-sm btn-outline" name="active" value="0" title="تعطيل الفترة" message="لن تظهر هذه الفترة للحجز. لا يمكن التعطيل إذا عليها حجوزات قادمة." confirmLabel="تعطيل">تعطيل</ConfirmButton>
                : <button className="btn btn-sm btn-success" name="active" value="1">تفعيل</button>}
              {!s.is_active && <span className="badge b-Expired">معطلة</span>}{overlaps.includes(s.id) && <span className="badge" style={{ background: "#F6E7D3", color: "#8A4A26" }}>متداخلة</span>}
            </ActionForm>
          </div>
        ))}
        <div className="admin-card flex flex-col gap-3">
          <h2 style={{ fontSize: 17 }}>إضافة فترة</h2>
          <ActionForm action={slotAction} className="flex flex-wrap gap-2 items-end" reset><SlotFields /><Submit className="btn btn-cta btn-sm" style={{ minHeight: 50 }}>إضافة</Submit><div className="w-full"><FormError /></div></ActionForm>
          <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "6px 0" }} />
          <CopySlots units={units.map((x) => ({ id: x.id, name: x.name }))} toUnit={unitId} action={copySlotsAction} />
        </div>
      </div>
    </>
  );
}

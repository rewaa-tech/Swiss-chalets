import { PageHead, Empty } from "@/components/admin/AdminShell";
import ActionForm, { FieldError, FormError, Submit } from "@/components/admin/ActionForm";
import ModeSelect from "@/components/admin/ModeSelect";
import { requireUser, requirePerm } from "@/lib/auth";
import { q } from "@/lib/db";
import { branchUnits } from "@/lib/services/panel";
import { seasonsAction, modeAction } from "../actions";

export const dynamic = "force-dynamic";
const KINDS = [["Summer", "الصيف"], ["Autumn", "الخريف"], ["Winter", "الشتاء"], ["Spring", "الربيع"]] as const;

export default async function SeasonsPage() {
  const u = await requireUser("branch");
  requirePerm(u, "seasons.manage");
  const [seasons, units, modes] = await Promise.all([
    q("SELECT * FROM seasons WHERE branch_id = $1", [u.branchId]),
    branchUnits(u.branchId!),
    q("SELECT m.* FROM unit_season_modes m JOIN units un ON un.id = m.unit_id WHERE un.branch_id = $1", [u.branchId]),
  ]);
  const byKind = Object.fromEntries(seasons.map((s) => [s.kind, s]));
  return (
    <>
      <PageHead title="المواسم والأنماط" sub="لكل فرع أربعة مواسم غير متداخلة. اليوم خارج كل المواسم غير متاح" />
      <div className="flex flex-col gap-5">
        <ActionForm action={seasonsAction} className="admin-card flex flex-col gap-4">
          <h2 style={{ fontSize: 17 }}>تواريخ المواسم</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {KINDS.map(([k, l]) => (
              <div key={k} className="flex items-end gap-2" style={{ padding: 12, borderRadius: 16, background: "var(--line-soft)" }}>
                <strong style={{ minWidth: 64, paddingBottom: 12 }}>{l}</strong>
                <div className="field flex-1"><label className="label" htmlFor={`${k}_s`} style={{ fontSize: 12 }}>من</label><input id={`${k}_s`} type="date" name={`${k}_start`} defaultValue={byKind[k]?.start_date} className="input" /></div>
                <div className="field flex-1"><label className="label" htmlFor={`${k}_e`} style={{ fontSize: 12 }}>إلى</label><input id={`${k}_e`} type="date" name={`${k}_end`} defaultValue={byKind[k]?.end_date} className="input" /></div>
              </div>
            ))}
          </div>
          <FieldError name="seasons" /><FormError />
          <div><Submit className="btn btn-cta">حفظ المواسم</Submit></div>
        </ActionForm>
        <div className="admin-card flex flex-col gap-3">
          <h2 style={{ fontSize: 17 }}>نمط كل وحدة في كل موسم</h2>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>المسبح: فترات 6 أو 10 ساعات أو يوم كامل. الفندقي: ليلة. نمط المسبح غير مسموح في الربيع والخريف.</p>
          {!units.length || !seasons.length ? <Empty icon="leaf" title={!seasons.length ? "حدد تواريخ المواسم أولًا" : "أضف وحدة أولًا"} /> : (
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead><tr><th>الوحدة</th>{KINDS.filter(([k]) => byKind[k]).map(([k, l]) => <th key={k}>{l}</th>)}</tr></thead>
                <tbody>
                  {units.map((x) => (
                    <tr key={x.id}><td style={{ fontWeight: 600 }}>{x.name}</td>
                      {KINDS.filter(([k]) => byKind[k]).map(([k]) => {
                        const s = byKind[k];
                        const m = modes.find((mm) => mm.unit_id === x.id && mm.season_id === s.id)?.mode ?? "";
                        return <td key={k}><ModeSelect action={modeAction} unitId={x.id} seasonId={s.id} value={m} poolAllowed={k === "Summer" || k === "Winter"} /></td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

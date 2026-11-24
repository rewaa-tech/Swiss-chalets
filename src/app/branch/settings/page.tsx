import { PageHead } from "@/components/admin/AdminShell";
import ActionForm, { FieldError, FormError, Submit } from "@/components/admin/ActionForm";
import TelegramLink from "@/components/admin/TelegramLink";
import MapCard from "@/components/MapCard";
import { requireUser, requirePerm } from "@/lib/auth";
import { one } from "@/lib/db";
import { telegramConfigured } from "@/lib/services/telegram";
import { branchSettingsAction, telegramLinkAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function BranchSettings() {
  const u = await requireUser("branch");
  requirePerm(u, "branch.settings");
  const [b, me] = await Promise.all([one("SELECT * FROM branches WHERE id = $1", [u.branchId]), one("SELECT telegram_chat_id FROM app_users WHERE id = $1", [u.id])]);
  const canPay = u.permissions.has("branch.payment");
  return (
    <>
      <PageHead title="إعدادات الفرع" sub={`فرع ${b.name}`} />
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <ActionForm action={branchSettingsAction} className="admin-card flex flex-col gap-4">
          <h2 style={{ fontSize: 17 }}>موقع الفرع على الخريطة</h2>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>الصق رابط الموقع من خرائط Google، والنظام بيستخرج الإحداثيات لحاله. الخريطة بتظهر بأسفل صفحة الفرع وصفحات الأكواخ.</p>
          <div className="field"><label className="label" htmlFor="map">رابط خرائط Google</label><input id="map" name="map_url" className="input" dir="ltr" defaultValue={b.map_url ?? ""} placeholder="https://maps.app.goo.gl/…" /><FieldError name="map_url" /></div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="field"><label className="label" htmlFor="lat">خط العرض <span className="muted" style={{ fontWeight: 400 }}>(اختياري)</span></label><input id="lat" name="lat" className="input num" dir="ltr" inputMode="decimal" defaultValue={b.lat ?? ""} placeholder="35.9306" /><FieldError name="lat" /></div>
            <div className="field"><label className="label" htmlFor="lng">خط الطول</label><input id="lng" name="lng" className="input num" dir="ltr" inputMode="decimal" defaultValue={b.lng ?? ""} placeholder="36.6339" /></div>
            <div className="field"><label className="label" htmlFor="addr">وصف العنوان</label><input id="addr" name="address" className="input" defaultValue={b.address ?? ""} placeholder="طريق المعرة، بعد الجسر" /></div>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>لما تلصق رابطًا جديدًا، الإحداثيات بتتحدث لحالها. إذا ما انقرأ الرابط، أدخل الإحداثيات يدويًا.</p>
          {b.lat != null && b.lng != null && <MapCard name={b.name} city={b.city} lat={b.lat} lng={b.lng} address={b.address} compact />}
          <h2 style={{ fontSize: 17, marginTop: 8 }}>حساب شام كاش</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="field"><label className="label" htmlFor="sc-n">اسم الحساب</label><input id="sc-n" name="shamcash_account_name" className="input" defaultValue={b.shamcash_account_name ?? ""} disabled={!canPay} /></div>
            <div className="field"><label className="label" htmlFor="sc-a">رقم الحساب</label><input id="sc-a" name="shamcash_account_number" className="input num" dir="ltr" defaultValue={b.shamcash_account_number ?? ""} disabled={!canPay} /><FieldError name="shamcash_account_number" /></div>
          </div>
          <div className="flex gap-4 items-center flex-wrap">
            {b.shamcash_qr_path && /* eslint-disable-next-line @next/next/no-img-element */ <img src={`/media/${b.shamcash_qr_path}`} alt="QR الحالي" width={110} height={110} style={{ borderRadius: 12, border: "1px solid var(--line)" }} />}
            <div className="field flex-1"><label className="label" htmlFor="sc-q">صورة رمز QR</label><input id="sc-q" name="qr" type="file" accept="image/png,image/jpeg,image/webp" className="input" disabled={!canPay} /></div>
          </div>
          <h2 style={{ fontSize: 17, marginTop: 8 }}>أوقات المراجعة</h2>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>تظهر للزبون. إذا كانت النهاية قبل البداية فالنافذة تعبر منتصف الليل (مثلًا 09:00 إلى 02:00).</p>
          <div className="grid gap-3 grid-cols-2" style={{ maxWidth: 420 }}>
            <div className="field"><label className="label" htmlFor="rs">من</label><input id="rs" type="time" name="review_start" className="input" defaultValue={b.review_start.slice(0, 5)} /><FieldError name="review_start" /></div>
            <div className="field"><label className="label" htmlFor="re">إلى</label><input id="re" type="time" name="review_end" className="input" defaultValue={b.review_end.slice(0, 5)} /><FieldError name="review_end" /></div>
          </div>
          <FormError />
          <div><Submit className="btn btn-cta">حفظ الإعدادات</Submit></div>
        </ActionForm>
        <div className="admin-card flex flex-col gap-3">
          <h2 style={{ fontSize: 17 }}>إشعارات تيليغرام</h2>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>اربط حسابك لتصلك الطلبات الجديدة والتذكيرات فورًا.</p>
          <TelegramLink action={telegramLinkAction} linked={!!me?.telegram_chat_id} configured={telegramConfigured()} />
        </div>
      </div>
    </>
  );
}

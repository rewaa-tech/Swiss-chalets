import { PageHead, Empty } from "@/components/admin/AdminShell";
import ManualBooking from "@/components/admin/ManualBooking";
import { requireUser, requirePerm } from "@/lib/auth";
import { branchUnits } from "@/lib/services/panel";
import { todayLocal } from "@/lib/time";
import { manualAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewManual() {
  const u = await requireUser("branch");
  requirePerm(u, "bookings.manual");
  const units = await branchUnits(u.branchId!, true);
  return (
    <>
      <PageHead title="حجز يدوي" sub="يُنشأ الحجز مثبّتًا مباشرة، ويخضع لنفس قواعد التداخل" />
      {units.length ? <ManualBooking units={units} action={manualAction} today={todayLocal()} /> : <div className="admin-card"><Empty icon="home" title="لا توجد وحدات مفعلة" text="أضف وحدة من صفحة الوحدات أولًا." /></div>}
    </>
  );
}

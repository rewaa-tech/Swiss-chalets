import { PageHead, Empty } from "@/components/admin/AdminShell";
import OpsCalendar from "@/components/admin/OpsCalendar";
import { requireUser, requirePerm } from "@/lib/auth";
import { q } from "@/lib/db";
import { branchUnits } from "@/lib/services/panel";
import { monthDays, todayLocal } from "@/lib/time";
import { daysAction } from "../actions";

export const dynamic = "force-dynamic";
const shift = (m: string, d: number) => { const [y, mo] = m.split("-").map(Number); const t = new Date(Date.UTC(y, mo - 1 + d, 1)); return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`; };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const u = await requireUser("branch");
  requirePerm(u, "calendar.manage");
  const sp = await searchParams;
  const today = todayLocal();
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month ?? "") ? sp.month! : today.slice(0, 7);
  const days = monthDays(month);
  const units = await branchUnits(u.branchId!);
  const [open, booked] = await Promise.all([
    q("SELECT o.unit_id, o.day, o.is_open FROM open_days o JOIN units un ON un.id = o.unit_id WHERE un.branch_id = $1 AND o.day BETWEEN $2 AND $3", [u.branchId, days[0], days[days.length - 1]]),
    q(`SELECT bi.unit_id, bi.day, b.id, b.status, b.customer_name FROM booking_items bi JOIN bookings b ON b.id = bi.booking_id
        WHERE b.branch_id = $1 AND bi.is_active AND b.status IN ('Held','PendingReview','Confirmed','Completed') AND bi.day BETWEEN $2 AND $3`, [u.branchId, days[0], days[days.length - 1]]),
  ]);
  const cells: Record<string, { open: boolean; bookings: { id: number; status: string; name: string }[] }> = {};
  for (const o of open) cells[`${o.unit_id}|${o.day}`] = { open: o.is_open, bookings: [] };
  for (const b of booked) (cells[`${b.unit_id}|${b.day}`] ??= { open: true, bookings: [] }).bookings.push({ id: b.id, status: b.status, name: b.customer_name });
  return (
    <>
      <PageHead title="التقويم التشغيلي" sub="الأيام المغلقة لا تظهر للزبائن. لا يمكن إغلاق يوم فيه حجز قائم" />
      {units.length ? <OpsCalendar units={units.map((x) => ({ id: x.id, name: x.name }))} days={days} cells={cells} action={daysAction} month={month} prev={shift(month, -1)} next={shift(month, 1)} today={today} />
        : <div className="admin-card"><Empty icon="calendar" title="لا توجد وحدات" text="أضف وحدة أولًا من صفحة الوحدات." /></div>}
    </>
  );
}

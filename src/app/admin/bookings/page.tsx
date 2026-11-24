import Link from "next/link";
import { PageHead } from "@/components/admin/AdminShell";
import BookingsTable, { Pager, STATUS_TABS, BookingFilters } from "@/components/admin/BookingsTable";
import Icon from "@/components/Icon";
import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { searchBookings, bookingStats } from "@/lib/services/panel";
import { expireHolds } from "@/lib/services/availability";
import { isValidDate } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function AllBookings({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser("admin");
  await expireHolds();
  const sp = await searchParams;
  const status = sp.status ?? "all";
  const branchId = Number(sp.branch) || null;
  const [res, stats, branches] = await Promise.all([
    searchBookings({ branchId, status, q: sp.q, from: isValidDate(sp.from ?? "") ? sp.from : undefined, to: isValidDate(sp.to ?? "") ? sp.to : undefined, page: Number(sp.page) || 1 }),
    bookingStats(branchId), q("SELECT id, name FROM branches ORDER BY sort_order, id"),
  ]);
  const qs = (o: Record<string, string | number | undefined>) => "?" + new URLSearchParams(Object.entries({ ...sp, ...o }).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])).toString();
  const cards = [
    { l: "بانتظار التأكيد", v: stats?.pending ?? 0, c: "var(--ember)", i: "clock" },
    { l: "مثبّتة هذا الشهر", v: stats?.confirmed_month ?? 0, c: "var(--success)", i: "check" },
    { l: "طلبات اليوم", v: stats?.today ?? 0, c: "var(--teal)", i: "calendar" },
    { l: "انتهت المهلة", v: stats?.expired ?? 0, c: "var(--stone)", i: "alert" },
  ];
  return (
    <>
      <PageHead title="كل الحجوزات" sub="قراءة فقط — التثبيت والرفض من لوحة الفرع">
        <a href={`/admin/bookings/export${qs({ page: undefined })}`} className="btn btn-dark btn-sm"><Icon name="file" size={18} />تصدير CSV</a>
      </PageHead>
      <div className="grid gap-4 grid-cols-2 xl:grid-cols-4" style={{ marginBottom: 18 }}>
        {cards.map((c) => (
          <div key={c.l} className="admin-card flex items-center gap-4">
            <span className="flex items-center justify-center flex-none" style={{ width: 48, height: 48, borderRadius: 16, background: "var(--line-soft)" }}><Icon name={c.i} size={24} stroke={c.c} /></span>
            <div className="flex flex-col"><span className="num" data-fx="count" data-count={c.v} style={{ fontFamily: "var(--f-head)", fontWeight: 700, fontSize: 28, color: "var(--forest-deep)" }}>{c.v}</span><span className="muted" style={{ fontSize: 13 }}>{c.l}</span></div>
          </div>
        ))}
      </div>
      <div className="admin-card">
        <nav className="tabs" style={{ marginBottom: 16 }}>{STATUS_TABS.map(([k, l]) => <Link key={k} href={qs({ status: k, page: undefined })} aria-current={status === k ? "page" : undefined}>{l}</Link>)}</nav>
        <BookingFilters action="/admin/bookings" sp={sp} extra={
          <div className="field" style={{ flex: "0 1 170px" }}><label className="label" htmlFor="fb">الفرع</label><select id="fb" name="branch" defaultValue={sp.branch} className="select"><option value="">كل الفروع</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
        } />
        <BookingsTable rows={res.rows} base="/admin/bookings" showBranch />
        <Pager page={res.page} pages={res.pages} href={(p) => qs({ page: p })} />
      </div>
    </>
  );
}

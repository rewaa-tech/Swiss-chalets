import Link from "next/link";
import { PageHead } from "@/components/admin/AdminShell";
import BookingsTable, { Pager, STATUS_TABS, BookingFilters } from "@/components/admin/BookingsTable";
import Icon from "@/components/Icon";
import { requireUser, requirePerm } from "@/lib/auth";
import { searchBookings, branchUnits } from "@/lib/services/panel";
import { expireHolds } from "@/lib/services/availability";
import { isValidDate } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function BookingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const u = await requireUser("branch");
  requirePerm(u, "bookings.view");
  await expireHolds();
  const sp = await searchParams;
  const status = sp.status ?? "all";
  const [res, units] = await Promise.all([
    searchBookings({ branchId: u.branchId, status, q: sp.q, unitId: Number(sp.unit) || undefined, from: isValidDate(sp.from ?? "") ? sp.from : undefined, to: isValidDate(sp.to ?? "") ? sp.to : undefined, page: Number(sp.page) || 1 }),
    branchUnits(u.branchId!),
  ]);
  const qs = (o: Record<string, string | number | undefined>) => "?" + new URLSearchParams(Object.entries({ ...sp, ...o }).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])).toString();
  return (
    <>
      <PageHead title="الحجوزات" sub={`${res.total} حجز`}>
        {u.permissions.has("bookings.review") && <Link href="/branch/bookings/new" className="btn btn-cta btn-sm" style={{ minHeight: 46 }}><Icon name="plus" size={18} />حجز يدوي</Link>}
      </PageHead>
      <div className="admin-card">
        <nav className="tabs" style={{ marginBottom: 16 }} aria-label="حالات الحجز">
          {STATUS_TABS.map(([k, l]) => <Link key={k} href={qs({ status: k, page: undefined })} aria-current={status === k ? "page" : undefined}>{l}</Link>)}
        </nav>
        <BookingFilters action="/branch/bookings" sp={sp} units={units} />
        <BookingsTable rows={res.rows} base="/branch/bookings" />
        <Pager page={res.page} pages={res.pages} href={(p) => qs({ page: p })} />
      </div>
    </>
  );
}

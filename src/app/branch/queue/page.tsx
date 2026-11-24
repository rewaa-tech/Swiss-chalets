import Link from "next/link";
import { PageHead } from "@/components/admin/AdminShell";
import QueueBoard from "@/components/admin/QueueBoard";
import Icon from "@/components/Icon";
import { requireUser, requirePerm } from "@/lib/auth";
import { pendingQueue } from "@/lib/services/panel";
import { expireHolds } from "@/lib/services/availability";
import { reviewAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function QueuePage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const u = await requireUser("branch");
  requirePerm(u, "bookings.view");
  await expireHolds();
  const items = JSON.parse(JSON.stringify(await pendingQueue(u.branchId!)));
  const id = Number((await searchParams).id) || undefined;
  return (
    <>
      <PageHead title="يحتاج مراجعتك" sub="مرتبة حسب مهلة المراجعة · تتحدث تلقائيًا">
        {u.permissions.has("bookings.review") && <Link href="/branch/bookings/new" className="btn btn-cta btn-sm" style={{ minHeight: 46 }}><Icon name="plus" size={18} />حجز يدوي</Link>}
      </PageHead>
      <QueueBoard initial={items} initialId={id} canReview={u.permissions.has("bookings.review")} canBlock={u.permissions.has("blocklist.manage")} reviewAction={reviewAction} />
    </>
  );
}

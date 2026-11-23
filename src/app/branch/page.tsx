import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ALL_PERMISSIONS } from "@/lib/permissions";

const HOME: Record<string, string> = {
  "bookings.view": "/branch/queue", "calendar.manage": "/branch/calendar", "units.manage": "/branch/units", "pricing.manage": "/branch/seasons",
  "slots.manage": "/branch/slots", "blocklist.manage": "/branch/blocklist", "branch.settings": "/branch/settings", "bookings.review": "/branch/bookings/new",
};

export default async function BranchHome({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const u = await requireUser("branch");
  const ok = (await searchParams).ok;
  const first = ALL_PERMISSIONS.find((p) => u.permissions.has(p) && HOME[p]);
  const target = first ? HOME[first] : "/account/password";
  redirect(ok ? `${target}?ok=${encodeURIComponent(ok)}` : target);
}

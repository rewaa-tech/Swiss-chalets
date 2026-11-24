import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ALL_PERMISSIONS } from "@/lib/permissions";

const HOME: Record<string, string> = {
  "bookings.view": "/branch/queue", "calendar.view": "/branch/calendar", "units.view": "/branch/units", "seasons.manage": "/branch/seasons",
  "slots.view": "/branch/slots", "content.manage": "/branch/content", "blocklist.view": "/branch/blocklist", "branch.settings": "/branch/settings",
  "staff.view": "/branch/staff",
};

export default async function BranchHome({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const u = await requireUser("branch");
  const ok = (await searchParams).ok;
  const first = ALL_PERMISSIONS.find((p) => u.permissions.has(p) && HOME[p]);
  const target = first ? HOME[first] : "/account/password";
  redirect(ok ? `${target}?ok=${encodeURIComponent(ok)}` : target);
}

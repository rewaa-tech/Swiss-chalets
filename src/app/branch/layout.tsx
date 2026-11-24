import AdminShell, { type NavItem } from "@/components/admin/AdminShell";
import { requireUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { pendingCount } from "@/lib/services/panel";
import { branchTheme } from "@/lib/services/public";

export const dynamic = "force-dynamic";
export const metadata = { title: "لوحة الفرع", robots: { index: false } };

export default async function BranchLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("branch");
  const [branch, count, { theme }] = await Promise.all([
    one("SELECT name FROM branches WHERE id = $1", [user.branchId]), pendingCount(user.branchId!), branchTheme(user.branchId!),
  ]);
  const items: NavItem[] = [
    { href: "/branch/queue", label: "يحتاج مراجعتك", icon: "inbox", perm: "bookings.view", count },
    { href: "/branch/bookings", label: "الحجوزات", icon: "list", perm: "bookings.view" },
    { href: "/branch/calendar", label: "التقويم التشغيلي", icon: "calendar", perm: "calendar.view" },
    { href: "/branch/units", label: "الوحدات", icon: "home", perm: "units.view" },
    { href: "/branch/seasons", label: "المواسم والأنماط", icon: "leaf", perm: "seasons.manage" },
    { href: "/branch/slots", label: "الفترات والأسعار", icon: "tag", perm: "slots.view" },
    { href: "/branch/staff", label: "الموظفون", icon: "users", perm: "staff.view" },
    { href: "/branch/blocklist", label: "الحظر", icon: "ban", perm: "blocklist.view" },
    { href: "/branch/content", label: "نصوص الواجهة", icon: "edit", perm: "content.manage" },
    { href: "/branch/settings", label: "إعدادات الفرع", icon: "settings", perm: "branch.settings" },
  ];
  return <AdminShell user={user} title={`لوحة فرع ${branch?.name ?? ""}`} items={items} theme={theme}>{children}</AdminShell>;
}

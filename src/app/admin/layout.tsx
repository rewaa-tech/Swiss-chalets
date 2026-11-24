import AdminShell, { type NavItem } from "@/components/admin/AdminShell";
import { requireUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { generalTheme } from "@/lib/services/public";

export const dynamic = "force-dynamic";
export const metadata = { title: "لوحة المدير العام", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("admin");
  const [p, theme] = await Promise.all([one<{ n: number }>("SELECT count(*)::int n FROM bookings WHERE status = 'PendingReview'"), generalTheme()]);
  const items: NavItem[] = [
    { href: "/admin/bookings", label: "كل الحجوزات", icon: "list", count: p?.n, group: "التشغيل" },
    { href: "/admin/branches", label: "الفروع", icon: "map", group: "التشغيل" },
    { href: "/admin/users", label: "المدراء والحسابات", icon: "users", group: "التشغيل" },
    { href: "/admin/contacts", label: "أرقام التواصل", icon: "phone", group: "التشغيل" },
    { href: "/admin/settings", label: "الإعدادات العامة", icon: "settings", group: "النظام" },
    { href: "/admin/content", label: "نصوص الواجهة", icon: "edit", group: "النظام" },
    { href: "/admin/templates", label: "النصوص والقوالب", icon: "text", group: "النظام" },
    { href: "/admin/audit", label: "سجل العمليات", icon: "log", group: "النظام" },
  ];
  return <AdminShell user={user} title="لوحة المدير العام" items={items} theme={theme}>{children}</AdminShell>;
}

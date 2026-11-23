import Link from "next/link";
import Logo from "../Logo";
import Icon from "../Icon";
import type { SessionUser, Permission } from "@/lib/permissions";
import AdminNavLinks from "./AdminNavLinks";

export interface NavItem { href: string; label: string; icon: string; perm?: Permission; count?: number; group?: string }

const THEME_AR = { winter: "ثيم الشتاء", summer: "ثيم الصيف", neutral: "الثيم المحايد" } as const;

export default function AdminShell({ user, title, items, children, theme }: { user: SessionUser; title: string; items: NavItem[]; children: React.ReactNode; theme?: keyof typeof THEME_AR }) {
  const visible = items.filter((i) => !i.perm || user.permissions.has(i.perm));
  return (
    <div className="admin" data-admin>
      <aside className="admin-side">
        <Link href={user.role === "SuperAdmin" ? "/admin" : "/branch"} className="brand" style={{ padding: "0 8px" }}><Logo light sub={title} /></Link>
        <AdminNavLinks items={visible} />
        <div className="side-foot flex flex-col gap-2 mt-auto" style={{ padding: "0 8px" }}>
          {theme && <span className="badge self-start" style={{ background: "rgba(227,185,143,.14)", color: "var(--sand)" }}><Icon name={theme === "winter" ? "snow" : theme === "summer" ? "sun" : "leaf"} size={14} />{THEME_AR[theme]}</span>}
          <span style={{ fontSize: 13, color: "#8FA197" }}>{user.displayName}</span>
          <div className="flex gap-2">
            <Link href="/account/password" className="btn btn-sm" style={{ background: "rgba(247,243,236,.08)", color: "#C8D1CB" }}>كلمة المرور</Link>
            <form action="/logout" method="post"><button className="btn btn-sm" style={{ background: "rgba(247,243,236,.08)", color: "#C8D1CB" }}><Icon name="logout" size={16} />خروج</button></form>
          </div>
        </div>
      </aside>
      <main id="main" className="admin-main">{children}</main>
    </div>
  );
}

export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="admin-head">
      <div className="flex flex-col gap-1"><h1>{title}</h1>{sub && <span className="muted" style={{ fontSize: 14 }}>{sub}</span>}</div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Empty({ icon = "inbox", title, text, children }: { icon?: string; title: string; text?: string; children?: React.ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-ico"><Icon name={icon} size={30} stroke="var(--stone)" /></span>
      <strong style={{ fontFamily: "var(--f-head)", color: "var(--forest-deep)" }}>{title}</strong>
      {text && <span style={{ maxWidth: 420 }}>{text}</span>}
      {children}
    </div>
  );
}

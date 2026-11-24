import Link from "next/link";
import Logo from "../Logo";
import Icon from "../Icon";
import type { SessionUser, Permission } from "@/lib/permissions";
import AdminNavLinks from "./AdminNavLinks";

export interface NavItem { href: string; label: string; icon: string; perm?: Permission; count?: number; group?: string }

const THEME_AR = { winter: "ثيم الشتاء", summer: "ثيم الصيف", neutral: "الثيم المحايد" } as const;

export default function AdminShell({ user, title, items, children, theme }: { user: SessionUser; title: string; items: NavItem[]; children: React.ReactNode; theme?: keyof typeof THEME_AR }) {
  const visible = items.filter((i) => !i.perm || user.permissions.has(i.perm));
  const home = user.role === "SuperAdmin" ? "/admin" : "/branch";
  return (
    <div className="admin" data-admin>
      <aside className="admin-side">
        <Link href={home} className="brand" style={{ padding: "0 8px" }}><Logo light sub={title} /></Link>
        <AdminNavLinks items={visible} />
        <div className="side-foot mt-auto">
          {theme && <span className="badge self-start" style={{ background: "rgba(227,185,143,.14)", color: "var(--sand)" }}><Icon name={theme === "winter" ? "snow" : theme === "summer" ? "sun" : "leaf"} size={14} />{THEME_AR[theme]}</span>}
          <AccountCard user={user} />
        </div>
      </aside>
      <header className="admin-topbar">
        <Link href={home} className="brand"><Logo light /></Link>
        <details className="account-menu">
          <summary aria-label="حسابي"><span className="avatar" aria-hidden><Icon name="user" size={20} stroke="var(--night)" width={2} /></span><span className="sr-only">حسابي</span></summary>
          <div className="account-sheet" role="menu">
            <AccountCard user={user} />
          </div>
        </details>
      </header>
      <main id="main" className="admin-main">{children}</main>
    </div>
  );
}

const ROLE_AR = { SuperAdmin: "المدير العام", BranchManager: "مدير الفرع", Staff: "موظف" } as const;

/** Name, role, password change and logout. Plain POST forms: work without JavaScript. */
function AccountCard({ user }: { user: SessionUser }) {
  return (
    <div className="account-card">
      <div className="flex items-center gap-3">
        <span className="avatar" aria-hidden><Icon name="user" size={20} stroke="var(--night)" width={2} /></span>
        <div className="flex flex-col min-w-0">
          <strong className="truncate">{user.displayName}</strong>
          <span className="role">{ROLE_AR[user.role]}</span>
        </div>
      </div>
      <Link href="/account/password" className="account-link"><Icon name="lock" size={18} />تغيير كلمة المرور</Link>
      <form action="/logout" method="post"><button className="account-logout" data-testid="logout"><Icon name="logout" size={18} />تسجيل الخروج</button></form>
      <form action="/logout?all=1" method="post"><button className="account-link account-link-sm">الخروج من كل الأجهزة</button></form>
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

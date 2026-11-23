"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "../Icon";
import type { NavItem } from "./AdminShell";

export default function AdminNavLinks({ items }: { items: NavItem[] }) {
  const path = usePathname();
  let group: string | undefined;
  return (
    <nav className="admin-nav" aria-label="قائمة اللوحة">
      {items.map((i) => {
        const showGroup = i.group && i.group !== group;
        group = i.group ?? group;
        const active = path === i.href || (path.startsWith(i.href + "/") && i.href.split("/").length > 2);
        return (
          <span key={i.href} style={{ display: "contents" }}>
            {showGroup && <span className="group">{i.group}</span>}
            <Link href={i.href} aria-current={active ? "page" : undefined}>
              <Icon name={i.icon} size={20} />{i.label}
              {!!i.count && <span className="count num" data-nav-count={i.href}>{i.count}</span>}
            </Link>
          </span>
        );
      })}
    </nav>
  );
}

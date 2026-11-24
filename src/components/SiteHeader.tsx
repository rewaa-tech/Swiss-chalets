import Link from "next/link";
import Logo from "./Logo";
import { textHelpers } from "@/lib/texts/jsx";
import { DEFAULT_TEXTS, type TextDict } from "@/lib/texts/registry";

const links = [
  { href: "/", label: "nav.home", key: "home" },
  { href: "/#branches", label: "nav.branches", key: "branches" },
  { href: "/#units", label: "nav.units", key: "units" },
  { href: "/#how", label: "nav.how", key: "how" },
  { href: "/my", label: "nav.my", key: "my" },
] as const;

export default function SiteHeader({ active = "home", floating = true, dict = DEFAULT_TEXTS }: { active?: string; floating?: boolean; dict?: TextDict }) {
  const { T } = textHelpers(dict);
  return (
    <header
      data-fx="nav"
      className={`site-nav glass ${floating ? "fixed" : "sticky"} z-40 inset-x-0 mx-auto top-3 md:top-6 flex items-center justify-between gap-3`}
      style={{ width: "min(1200px, calc(100% - 32px))", minHeight: 64, padding: "8px 10px 8px 18px", borderRadius: 20, boxShadow: "0 10px 40px rgba(20,42,31,.10)", boxSizing: "border-box" }}
    >
      <Link href="/" aria-label="الأكواخ السويسرية — الرئيسية"><Logo /></Link>
      <nav aria-label="القائمة الرئيسية" className="hidden md:flex flex-wrap gap-1.5">
        {links.map((l) => (
          <Link key={l.key} href={l.href} className="nav-link" aria-current={active === l.key ? "page" : undefined}>{T(l.label)}</Link>
        ))}
      </nav>
      <div className="flex items-center gap-2">
        <Link href="/my" className="md:hidden nav-link">{T("nav.my")}</Link>
        <Link href="/#branches" className="btn btn-dark btn-sm" data-fx="ripple">{T("nav.cta")}</Link>
      </div>
    </header>
  );
}

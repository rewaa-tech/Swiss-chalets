import Link from "next/link";
import Logo from "./Logo";

const links = [
  { href: "/", label: "الرئيسية", key: "home" },
  { href: "/#branches", label: "الفروع", key: "branches" },
  { href: "/#units", label: "الأكواخ", key: "units" },
  { href: "/#how", label: "كيف تحجز", key: "how" },
  { href: "/my", label: "طلباتي", key: "my" },
];

export default function SiteHeader({ active = "home", floating = true }: { active?: string; floating?: boolean }) {
  return (
    <header
      data-fx="nav"
      className={`site-nav glass ${floating ? "fixed" : "sticky"} z-40 inset-x-0 mx-auto top-3 md:top-6 flex items-center justify-between gap-3`}
      style={{ width: "min(1200px, calc(100% - 32px))", minHeight: 64, padding: "8px 10px 8px 18px", borderRadius: 20, boxShadow: "0 10px 40px rgba(20,42,31,.10)", boxSizing: "border-box" }}
    >
      <Link href="/" aria-label="الأكواخ السويسرية — الرئيسية"><Logo /></Link>
      <nav aria-label="القائمة الرئيسية" className="hidden md:flex flex-wrap gap-1.5">
        {links.map((l) => (
          <Link key={l.key} href={l.href} className="nav-link" aria-current={active === l.key ? "page" : undefined}>{l.label}</Link>
        ))}
      </nav>
      <div className="flex items-center gap-2">
        <Link href="/my" className="md:hidden nav-link">طلباتي</Link>
        <Link href="/#branches" className="btn btn-dark btn-sm" data-fx="ripple">احجز الآن</Link>
      </div>
    </header>
  );
}

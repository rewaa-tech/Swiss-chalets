import Link from "next/link";
import { LogoMark } from "./Logo";
import { textHelpers } from "@/lib/texts/jsx";
import { DEFAULT_TEXTS, type TextDict } from "@/lib/texts/registry";

export default function SiteFooter({ dict = DEFAULT_TEXTS }: { dict?: TextDict }) {
  const { T } = textHelpers(dict);
  return (
    <footer style={{ marginTop: 110, background: "var(--night)", color: "#C8D1CB" }}>
      <div className="wrap flex flex-wrap justify-between gap-8" style={{ padding: "56px 0 40px" }}>
        <div className="flex flex-col gap-3.5" style={{ maxWidth: 360 }}>
          <span className="flex items-center gap-2.5">
            <LogoMark light size={36} />
            <span style={{ fontFamily: "var(--f-head)", fontWeight: 700, fontSize: 20, color: "#F7F3EC" }}>الأكواخ السويسرية</span>
          </span>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.8 }}>{T("footer.about")}</p>
        </div>
        <nav aria-label="روابط التذييل" className="flex flex-wrap gap-10" style={{ fontSize: 15 }}>
          <div className="flex flex-col gap-2.5">
            <span style={{ color: "#F7F3EC", fontWeight: 600 }}>{T("footer.site")}</span>
            <Link href="/#branches" style={{ color: "#C8D1CB" }}>{T("nav.branches")}</Link>
            <Link href="/#units" style={{ color: "#C8D1CB" }}>{T("nav.units")}</Link>
            <Link href="/#how" style={{ color: "#C8D1CB" }}>{T("nav.how")}</Link>
          </div>
          <div className="flex flex-col gap-2.5">
            <span style={{ color: "#F7F3EC", fontWeight: 600 }}>{T("footer.help")}</span>
            <Link href="/terms" style={{ color: "#C8D1CB" }}>{T("footer.terms")}</Link>
            <Link href="/my" style={{ color: "#C8D1CB" }}>{T("nav.my")}</Link>
            <a href="https://www.instagram.com/swisshuts" rel="noopener noreferrer" target="_blank" style={{ color: "#C8D1CB" }}>{T("footer.instagram")}</a>
          </div>
        </nav>
      </div>
      <div style={{ borderTop: "1px solid rgba(247,243,236,.1)", padding: "18px 24px", textAlign: "center", fontSize: 13, color: "#8FA197" }}>
        © {new Date().getFullYear()} الأكواخ السويسرية
      </div>
    </footer>
  );
}

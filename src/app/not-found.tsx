import Link from "next/link";
import Logo from "@/components/Logo";
import { getTexts } from "@/lib/texts/server";
import { textHelpers } from "@/lib/texts/jsx";

export default async function NotFound() {
  const { T } = textHelpers(await getTexts(null));
  return (
    <main id="main" className="min-h-screen flex flex-col items-center justify-center gap-5 text-center" style={{ padding: 24, background: "var(--bg)" }}>
      <Logo />
      <span className="num" style={{ fontFamily: "var(--f-head)", fontWeight: 700, fontSize: "clamp(72px,12vw,140px)", lineHeight: 1, background: "var(--cta)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>404</span>
      <h1 style={{ fontSize: 26 }}>{T("nf.title")}</h1>
      <p className="muted" style={{ margin: 0, maxWidth: 420 }}>{T("nf.text")}</p>
      <Link href="/" className="btn btn-cta">{T("nf.home")}</Link>
    </main>
  );
}

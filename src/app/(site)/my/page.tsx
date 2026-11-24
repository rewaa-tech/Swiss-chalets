import type { Metadata } from "next";
import PublicShell from "@/components/PublicShell";
import MyBookings from "@/components/booking/MyBookings";
import { generalTheme } from "@/lib/services/public";
import { getTexts } from "@/lib/texts/server";
import { textHelpers } from "@/lib/texts/jsx";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "طلباتي", robots: { index: false } };

export default async function MyPage() {
  const [theme, dict] = await Promise.all([generalTheme(), getTexts(null)]);
  const { T } = textHelpers(dict);
  return (
    <PublicShell theme={theme} page="My" waText="مرحبًا، أستفسر عن طلب حجز" active="my">
      <div className="wrap flex flex-col gap-6" style={{ paddingTop: 130, maxWidth: 760 }}>
        <div className="flex flex-col gap-2"><span className="eyebrow">{T("my.eyebrow")}</span><h1 className="h-section">{T("my.title")}</h1>
          <p className="muted" style={{ margin: 0 }}>{T("my.text")}</p></div>
        <MyBookings />
      </div>
    </PublicShell>
  );
}

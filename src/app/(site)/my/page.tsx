import type { Metadata } from "next";
import PublicShell from "@/components/PublicShell";
import MyBookings from "@/components/booking/MyBookings";
import { generalTheme } from "@/lib/services/public";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "طلباتي", robots: { index: false } };

export default async function MyPage() {
  const theme = await generalTheme();
  return (
    <PublicShell theme={theme} page="My" waText="مرحبًا، أستفسر عن طلب حجز" active="my">
      <div className="wrap flex flex-col gap-6" style={{ paddingTop: 130, maxWidth: 760 }}>
        <div className="flex flex-col gap-2"><span className="eyebrow">على هذا الجهاز</span><h1 className="h2">طلباتي</h1>
          <p className="muted" style={{ margin: 0 }}>نحفظ روابط طلباتك على هذا الجهاز فقط، لتعود لها بسهولة.</p></div>
        <MyBookings />
      </div>
    </PublicShell>
  );
}

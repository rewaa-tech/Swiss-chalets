import type { Metadata } from "next";
import PublicShell from "@/components/PublicShell";
import { generalTheme } from "@/lib/services/public";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "شروط الحجز" };

export default async function Terms() {
  const [theme, s] = await Promise.all([generalTheme(), getSettings()]);
  return (
    <PublicShell theme={theme} page="Terms" waText="مرحبًا، عندي سؤال عن شروط الحجز">
      <div className="wrap flex flex-col gap-6" style={{ paddingTop: 130, maxWidth: 760 }}>
        <div className="flex flex-col gap-2"><span className="eyebrow">قبل الحجز</span><h1 className="h2">شروط الحجز</h1></div>
        <div className="card" style={{ padding: "26px 28px", borderRadius: 26 }}>
          <ol style={{ margin: 0, paddingInlineStart: 22, lineHeight: 2, fontSize: 17 }}>
            {(s.terms_text ?? "").split("\n").filter((l) => l.trim()).map((l, i) => <li key={i}>{l}</li>)}
          </ol>
        </div>
        <div className="card" style={{ padding: "20px 24px", borderRadius: 22, background: "#FBF1E6" }}>
          <strong style={{ color: "var(--ember)", fontFamily: "var(--f-head)" }}>الثبوتيات المطلوبة عند الوصول</strong>
          <p style={{ margin: "6px 0 0", lineHeight: 1.9 }}>{s.documents_text}</p>
        </div>
      </div>
    </PublicShell>
  );
}

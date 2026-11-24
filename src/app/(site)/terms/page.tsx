import type { Metadata } from "next";
import PublicShell from "@/components/PublicShell";
import { generalTheme } from "@/lib/services/public";
import { getSettings } from "@/lib/settings";
import { getTexts } from "@/lib/texts/server";
import { textHelpers } from "@/lib/texts/jsx";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "شروط الحجز" };

export default async function Terms() {
  const [theme, s, dict] = await Promise.all([generalTheme(), getSettings(), getTexts(null)]);
  const { T } = textHelpers(dict);
  return (
    <PublicShell theme={theme} page="Terms" waText="مرحبًا، عندي سؤال عن شروط الحجز">
      <div className="wrap flex flex-col gap-6" style={{ paddingTop: 130, maxWidth: 760 }}>
        <div className="flex flex-col gap-2"><span className="eyebrow">{T("terms.eyebrow")}</span><h1 className="h-section">{T("terms.title")}</h1></div>
        <div className="card" style={{ padding: "26px 28px", borderRadius: 26 }}>
          <ol style={{ margin: 0, paddingInlineStart: 22, lineHeight: 2, fontSize: 17 }}>
            {(s.terms_text ?? "").split("\n").filter((l) => l.trim()).map((l, i) => <li key={i}>{l}</li>)}
          </ol>
        </div>
        <div className="card" style={{ padding: "20px 24px", borderRadius: 22, background: "#FBF1E6" }}>
          <strong style={{ color: "var(--ember)", fontFamily: "var(--f-head)" }}>{T("terms.docs")}</strong>
          <p style={{ margin: "6px 0 0", lineHeight: 1.9 }}>{s.documents_text}</p>
        </div>
      </div>
    </PublicShell>
  );
}

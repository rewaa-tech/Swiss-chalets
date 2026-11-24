import Link from "next/link";
import Icon from "@/components/Icon";
export default function Forbidden() {
  return (
    <main id="main" className="min-h-screen flex flex-col items-center justify-center gap-4 text-center" style={{ padding: 24, background: "var(--bg-admin)" }}>
      <span className="empty-ico" style={{ background: "#F8DEDB" }}><Icon name="shield" size={30} stroke="var(--error)" /></span>
      <h1 style={{ fontSize: 24 }}>لا تملك صلاحية لهذه الصفحة</h1>
      <p className="muted" style={{ margin: 0 }}>اطلب من مدير الفرع منحك الصلاحية المناسبة.</p>
      <Link href="/branch" className="btn btn-dark">العودة للوحة</Link>
    </main>
  );
}

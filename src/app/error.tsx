"use client";
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 text-center" style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24 }}>حدث خطأ غير متوقع</h1>
      <p className="muted" style={{ margin: 0 }}>حاول مرة أخرى بعد قليل.</p>
      <button className="btn btn-dark" onClick={reset}>إعادة المحاولة</button>
    </main>
  );
}

import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import FxRoot from "@/components/FxRoot";
import Toaster from "@/components/Toaster";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  title: { default: "الأكواخ السويسرية | أكواخ ومزارع بمسابح خاصة في سوريا", template: "%s | الأكواخ السويسرية" },
  description: "احجز كوخك أو مزرعتك بمسبح خاص في إدلب وحمص. تقويم مباشر، دفع عبر شام كاش، وتأكيد عبر واتساب.",
  openGraph: { type: "website", locale: "ar_SY", siteName: "الأكواخ السويسرية", images: ["/img/hero/chalet-pool-dusk-1600.webp"] },
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = { themeColor: "#142A1F", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" data-theme="neutral" suppressHydrationWarning>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only">تخطَّ إلى المحتوى</a>
        {children}
        <FxRoot />
        <Suspense fallback={null}><Toaster /></Suspense>
      </body>
    </html>
  );
}

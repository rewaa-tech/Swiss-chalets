import { NextResponse, type NextRequest } from "next/server";
import { allow } from "@/lib/rate-limit";

function nonce() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b));
}

function ip(req: NextRequest) {
  return req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",").pop()?.trim() || "local";
}

export function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Rate limiting: 20/min per IP on /api/*, 5 login attempts/min.
  if (path.startsWith("/api/") && !allow(`api:${ip(req)}`, 20)) {
    return NextResponse.json({ title: "طلبات كثيرة، انتظر دقيقة وحاول مجددًا", status: 429 }, { status: 429, headers: { "Content-Type": "application/problem+json", "Retry-After": "60" } });
  }
  if (path === "/login" && req.method === "POST" && !allow(`login:${ip(req)}`, 5)) {
    return new NextResponse("محاولات دخول كثيرة، انتظر دقيقة", { status: 429, headers: { "Retry-After": "60" } });
  }

  const n = nonce();
  const dev = process.env.NODE_ENV !== "production";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${n}'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  const reqHeaders = new Headers(req.headers);
  reqHeaders.set("x-nonce", n);
  reqHeaders.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers: reqHeaders } });
  res.headers.set("Content-Security-Policy", csp);

  // Device fingerprint cookie (128-bit random, 2 years).
  if (!req.cookies.get("sc_did")) {
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    res.cookies.set("sc_did", Array.from(b, (x) => x.toString(16).padStart(2, "0")).join(""), {
      httpOnly: true, secure: !dev, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 730,
    });
  }
  return res;
}

export const config = {
  matcher: [{ source: "/((?!_next/static|_next/image|img/|lib/|media/|favicon.svg|robots.txt|sitemap.xml).*)" }],
};

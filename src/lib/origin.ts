/** Same-origin check for state-changing route handlers (behind Nginx the Host header is the public host). */
export function isSameOrigin(req: Request): boolean {
  const o = req.headers.get("origin");
  if (!o) return true; // non-browser clients and same-origin navigations without Origin
  let host: string;
  try { host = new URL(o).host; } catch { return false; }
  const h = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
  return host === h;
}

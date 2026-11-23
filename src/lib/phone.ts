/** Normalises Syrian mobile numbers to E.164 (+9639XXXXXXXX). Returns null if invalid. */
export function normalizePhone(input: string): string | null {
  if (!input) return null;
  const ar = "٠١٢٣٤٥٦٧٨٩", fa = "۰۱۲۳۴۵۶۷۸۹";
  let s = input.replace(/[٠-٩۰-۹]/g, (c) => String(ar.indexOf(c) >= 0 ? ar.indexOf(c) : fa.indexOf(c)));
  s = s.replace(/[\s\-().]/g, "");
  if (s.startsWith("+")) s = s.slice(1);
  else if (s.startsWith("00")) s = s.slice(2);
  else if (s.startsWith("0")) s = "963" + s.slice(1);
  else if (/^9\d{8}$/.test(s)) s = "963" + s;
  if (!/^\d+$/.test(s)) return null;
  if (s.startsWith("963")) {
    return /^9639\d{8}$/.test(s) ? "+" + s : null;
  }
  // Allow other international numbers (8–15 digits) for contact numbers.
  return /^[1-9]\d{7,14}$/.test(s) ? "+" + s : null;
}

export function waDigits(e164: string): string { return e164.replace(/\D/g, ""); }

export function waLink(e164: string, text?: string): string {
  return `https://wa.me/${waDigits(e164)}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

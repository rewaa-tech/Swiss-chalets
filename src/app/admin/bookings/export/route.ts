import { actionUser } from "@/lib/auth";
import { problem } from "@/lib/errors";
import { searchBookings } from "@/lib/services/panel";
import { STATUS_AR, CATEGORY_AR, type BookingStatus, type Category } from "@/lib/services/booking";
import { fmtDayAr, fmtTime, fmtDateTimeAr, isValidDate, todayLocal } from "@/lib/time";

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; // CSV injection guard
  return `"${safe.replace(/"/g, '""')}"`;
};

/** CSV with UTF-8 BOM so Excel opens Arabic correctly. */
export async function GET(req: Request) {
  try {
    await actionUser("admin");
    const sp = Object.fromEntries(new URL(req.url).searchParams);
    const res = await searchBookings({ branchId: Number(sp.branch) || null, status: sp.status, q: sp.q, from: isValidDate(sp.from ?? "") ? sp.from : undefined, to: isValidDate(sp.to ?? "") ? sp.to : undefined, page: 1, pageSize: 10000 });
    const head = ["رقم الحجز", "الفرع", "الوحدة", "الزبون", "الهاتف", "الفئة", "الأشخاص", "اليوم", "البداية", "النهاية", "الليالي", "المبلغ", "العملة", "الحالة", "المصدر", "رقم العملية", "نوع الإشعار", "أُنشئ"];
    const lines = res.rows.map((b) => [b.id, b.branch_name, b.unit_name, b.customer_name, b.phone_e164, CATEGORY_AR[b.category as Category], b.persons,
      b.first_day ? fmtDayAr(b.first_day) : "", b.starts_at ? fmtTime(b.starts_at) : "", b.ends_at ? fmtTime(b.ends_at) : "", b.nights, b.total, b.currency,
      STATUS_AR[b.status as BookingStatus], b.source === "Manual" ? "يدوي" : "الموقع", b.transaction_number ?? "", b.proof_kind === "Pdf" ? "PDF" : b.proof_kind ? "صورة" : "", fmtDateTimeAr(b.created_at)].map(cell).join(","));
    const csv = "﻿" + [head.map(cell).join(","), ...lines].join("\r\n");
    return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="bookings-${todayLocal()}.csv"`, "Cache-Control": "no-store" } });
  } catch (e) { return problem(e); }
}

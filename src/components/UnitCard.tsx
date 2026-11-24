import Link from "next/link";
import HeroImage from "./HeroImage";
import { money } from "@/lib/services/public";

export interface UnitCardData { id: number; name: string; slug: string; type: string; capacity: number; has_heated_pool: boolean; branch_name: string; cover: string | null; min_price: number | null; current_mode: string | null; focal_x?: number; focal_y?: number; cover_color?: string | null; album?: string[] }

export default function UnitCard({ u, currency }: { u: UnitCardData; currency: string }) {
  const tag = u.current_mode === "Hotel" ? { t: "فندقي", c: "var(--walnut)" } : u.has_heated_pool ? { t: "مسبح مدفأ", c: "var(--teal)" } : { t: "مسبح خاص", c: "var(--teal)" };
  return (
    <Link href={`/u/${u.slug}`} data-fx="reveal" className="flex flex-col gap-4" style={{ flex: "1 1 300px", maxWidth: 420, color: "var(--ink)" }}>
      <span data-fx="tilt" className="relative block overflow-hidden" style={{ height: 300, borderRadius: 28, background: "repeating-linear-gradient(135deg,#2C4A38 0 16px,#284434 16px 32px)" }}>
        {u.cover ? <>
          <HeroImage base={`/media/${u.cover}`} alt={u.name} className="tilt-img absolute inset-0 w-full h-full object-cover" sizes="(max-width: 720px) 100vw, 33vw" style={{ objectPosition: `${u.focal_x ?? 50}% ${u.focal_y ?? 50}%`, backgroundColor: u.cover_color ?? undefined }} />
          {/* v3 §3.4: on hover the card cross-fades through the first album photos */}
          {(u.album ?? []).filter((a) => a !== u.cover).slice(0, 3).map((a, k) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={a} src={`/media/${a}-480.webp`} srcSet={`/media/${a}-480.webp 480w, /media/${a}-960.webp 960w`} sizes="(max-width: 720px) 100vw, 33vw" alt="" loading="lazy" decoding="async" className="card-cycle" style={{ animationDelay: `${k * 1.4}s` }} />
          ))}
        </>
          : <span className="absolute inset-0 flex items-center justify-center" style={{ color: "rgba(247,243,236,.6)", fontSize: 13 }}>الصور تُضاف قريبًا</span>}
        <span className="tilt-shine" />
        <span className="chip absolute" style={{ top: 16, right: 16, color: tag.c, zIndex: 3 }}>{tag.t}</span>
      </span>
      <span className="flex justify-between items-start gap-3">
        <span className="flex flex-col gap-1">
          <span style={{ fontFamily: "var(--f-head)", fontWeight: 600, fontSize: 20, color: "var(--forest-deep)" }}>{u.name}</span>
          <span className="muted" style={{ fontSize: 14 }}>فرع {u.branch_name} · حتى {u.capacity} أشخاص</span>
        </span>
        {u.min_price != null && (
          <span className="flex flex-col" style={{ textAlign: "left" }}>
            <span className="muted" style={{ fontSize: 12 }}>يبدأ من</span>
            <span className="num" style={{ fontFamily: "var(--f-head)", fontWeight: 700, fontSize: 20, color: "var(--forest)" }}>{money(u.min_price, currency)}</span>
          </span>
        )}
      </span>
    </Link>
  );
}

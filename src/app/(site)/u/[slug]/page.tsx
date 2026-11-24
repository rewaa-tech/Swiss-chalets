import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PublicShell from "@/components/PublicShell";
import HeroImage from "@/components/HeroImage";
import SeasonFx from "@/components/SeasonFx";
import Icon from "@/components/Icon";
import BookingWidget from "@/components/booking/BookingWidget";
import ShareButton from "@/components/ShareButton";
import Gallery, { type GalleryItem } from "@/components/Gallery";
import MapCard from "@/components/MapCard";
import { q, one } from "@/lib/db";
import { branchTheme, siteMeta } from "@/lib/services/public";
import { getSettings, fillTemplate } from "@/lib/settings";
import { formStamp } from "@/lib/crypto";
import { addDays, todayLocal, fmtDayAr } from "@/lib/time";
import { routeParam } from "@/lib/paths";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
const SEASON_AR = { Summer: "الصيف", Winter: "الشتاء", Spring: "الربيع", Autumn: "الخريف" } as const;

/** Public visitors see active units of active branches; staff of the unit's branch (or the super admin) get a preview of anything. */
async function load(rawSlug: string) {
  const slug = routeParam(rawSlug);
  if (!slug) return null;
  const u = await one(
    `SELECT u.*, b.name AS branch_name, b.slug AS branch_slug, b.status AS branch_status, b.review_start, b.review_end, b.city AS branch_city, b.lat, b.lng, b.address AS branch_address
       FROM units u JOIN branches b ON b.id = u.branch_id WHERE u.slug = $1`, [slug]);
  if (!u) return null;
  const published = u.is_active && u.branch_status === "Active";
  if (published) return { ...u, preview: false };
  const viewer = await currentUser();
  const canPreview = !!viewer && (viewer.role === "SuperAdmin" || viewer.branchId === u.branch_id);
  return canPreview ? { ...u, preview: true } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const u = await load((await params).slug);
  return u ? { title: `${u.name} — فرع ${u.branch_name}`, description: u.description?.slice(0, 160) || `${u.name}: مسبح خاص وحتى ${u.capacity} أشخاص.` } : {};
}

export default async function UnitPage({ params }: { params: Promise<{ slug: string }> }) {
  const u = await load((await params).slug);
  if (!u) notFound();
  const [{ theme, season }, meta, media, amenities, s] = await Promise.all([
    branchTheme(u.branch_id), siteMeta(),
    q(`SELECT id, kind, path_base AS base, width AS w, height AS h, caption, color, video_path AS video, video_hd AS hd, duration_seconds AS duration
         FROM unit_media WHERE unit_id = $1 AND is_active AND status = 'Ready' AND path_base <> '' ORDER BY sort_order, id`, [u.id]),
    q("SELECT a.name, a.icon FROM unit_amenities ua JOIN amenities a ON a.id = ua.amenity_id WHERE ua.unit_id = $1 ORDER BY a.id", [u.id]),
    getSettings(),
  ]);
  const mode = season ? await one("SELECT mode FROM unit_season_modes WHERE unit_id = $1 AND season_id = $2", [u.id, season.id]) : null;
  const coverBase = u.cover_path_base ?? media.find((m) => m.kind === "Image")?.base ?? null;
  const cover = coverBase ? `/media/${coverBase}` : meta.hero;
  const mechanism = fillTemplate(s.booking_mechanism_text ?? "", { "الفرع": u.branch_name, "البداية": u.review_start.slice(0, 5), "النهاية": u.review_end.slice(0, 5) });

  return (
    <PublicShell theme={theme} page="Unit" entityId={u.id} branchId={u.branch_id} waText={`مرحبًا، أستفسر عن ${u.name} - فرع ${u.branch_name}`} active="units" header={false}>
      {u.preview && (
        <div role="status" className="text-center" style={{ position: "sticky", top: 0, zIndex: 50, background: "var(--warning)", color: "#fff", padding: "10px 16px", fontWeight: 600 }}>
          معاينة: هذه الوحدة غير منشورة للزبائن{!u.is_active ? " (معطّلة)" : " (الفرع غير نشط)"}
        </div>
      )}
      <section className="hero" style={{ minHeight: 460 }}>
        <HeroImage base={cover} alt={u.name} priority style={coverBase ? { objectPosition: `${u.cover_focal_x}% ${u.cover_focal_y}%`, backgroundColor: u.cover_color ?? undefined } : undefined} />
        <SeasonFx theme={theme} />
        <div className="absolute inset-0" style={{ zIndex: -1, background: "linear-gradient(180deg, rgba(10,22,16,.45) 0%, rgba(10,22,16,0) 30%, rgba(10,22,16,0) 50%, rgba(10,22,16,.88) 100%)" }} />
        <div className="wrap flex justify-between" style={{ paddingTop: 16 }}>
          <Link href={`/b/${u.branch_slug}`} aria-label="رجوع" className="btn btn-icon glass" style={{ background: "rgba(255,255,255,.62)" }}><Icon name="back" size={20} stroke="var(--forest)" width={2} /></Link>
          <ShareButton title={u.name} />
        </div>
        <div className="wrap flex-1 flex items-end" style={{ paddingBottom: 56 }}>
          <div className="flex flex-col gap-2.5 text-white" data-fx="reveal">
            <span className="chip chip-glass self-start">فرع {u.branch_name} · {u.type === "Farm" ? "مزرعة" : "كوخ"}</span>
            <h1 style={{ color: "#fff", fontWeight: 700, fontSize: "clamp(32px,4.4vw,56px)", lineHeight: 1.2 }}>{u.name}</h1>
            {media.length > 0 && <a href="#gallery" className="chip chip-glass self-start"><span className="num">{media.length}</span> صورة وفيديو</a>}
          </div>
        </div>
      </section>

      <div className="relative" style={{ marginTop: -28, borderRadius: "28px 28px 0 0", background: "var(--bg)" }}>
        <div className="wrap grid gap-6 lg:grid-cols-[1fr_420px]" style={{ paddingTop: 24 }}>
          <div className="flex flex-col gap-6 min-w-0">
            <div className="grid grid-cols-3 gap-3">
              {[{ i: "users", t: `حتى ${u.capacity}`, d: "أشخاص" }, { i: "bed", t: String(u.bedrooms), d: "غرف نوم" }, { i: "bath", t: String(u.bathrooms), d: "حمامات" }].map((f) => (
                <div key={f.d} className="card flex flex-col items-center gap-1 text-center" style={{ padding: "16px 8px", borderRadius: 20 }}>
                  <Icon name={f.i} size={24} stroke="var(--teal)" />
                  <span className="num" style={{ fontFamily: "var(--f-head)", fontWeight: 700, color: "var(--forest-deep)" }}>{f.t}</span>
                  <span className="muted" style={{ fontSize: 13 }}>{f.d}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3" style={{ padding: "14px 18px", borderRadius: 18, background: theme === "summer" ? "#E2F4F2" : theme === "winter" ? "#F8E8DC" : "var(--line-soft)" }}>
              <Icon name={season?.kind === "Winter" ? "snow" : season?.kind === "Summer" ? "sun" : "leaf"} size={22} stroke="var(--accent)" />
              <span style={{ fontSize: 15 }}>
                {season ? <>الموسم الحالي: <strong>{SEASON_AR[season.kind]}</strong> · {mode?.mode === "Hotel" ? "حجز بالليلة (فندقي)" : mode?.mode === "Pool" ? `فترات مسبح${u.has_heated_pool && season.kind === "Winter" ? " · مسبح مدفأ" : ""}` : "غير متاح للحجز حاليًا"}</> : "لا يوجد موسم حجز حالي"}
              </span>
            </div>
          </div>
          <div className="lg:row-span-2 lg:col-start-2 lg:row-start-1 min-w-0">
            <BookingWidget
              unit={{ id: u.id, name: u.name, capacity: u.capacity, familyOnly: u.allowed_category === "FamilyOnly", branch: u.branch_name, reviewStart: u.review_start.slice(0, 5), reviewEnd: u.review_end.slice(0, 5) }}
              currency={meta.currency}
              today={todayLocal()}
              maxDate={addDays(todayLocal(), 365)}
              formStamp={formStamp()}
              mechanism={mechanism}
              documents={s.documents_text ?? ""}
              todayLabel={fmtDayAr(todayLocal())}
            />
          </div>
          <div className="flex flex-col gap-6 min-w-0 lg:col-start-1">
            {media.length > 0 && <div id="gallery" style={{ scrollMarginTop: 24 }}><Gallery items={JSON.parse(JSON.stringify(media)) as GalleryItem[]} title={u.name} /></div>}
            {u.description && <p style={{ margin: 0, fontSize: 17, lineHeight: 1.9 }}>{u.description}</p>}
            {amenities.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 style={{ fontSize: 20 }}>المرافق</h2>
                <ul className="flex flex-wrap gap-2" style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  {amenities.map((a) => <li key={a.name} className="chip" style={{ background: "#fff", color: "var(--forest)", boxShadow: "var(--sh-card)", fontSize: 14 }}><Icon name={a.icon} size={16} />{a.name}</li>)}
                </ul>
              </section>
            )}
            <section className="flex flex-col gap-2">
              <h2 style={{ fontSize: 20 }}>القواعد</h2>
              <ul style={{ margin: 0, paddingInlineStart: 20, lineHeight: 1.9 }}>
                <li>{u.allowed_category === "FamilyOnly" ? "هذه الوحدة مخصصة للعائلات فقط." : "متاحة للعائلات والشباب."}</li>
                <li>السعر ثابت حتى {u.capacity} أشخاص.</li>
                {u.rules?.split("\n").filter(Boolean).map((r: string) => <li key={r}>{r}</li>)}
                <li>{s.documents_text}</li>
              </ul>
            </section>
          </div>
        </div>
        {u.lat != null && u.lng != null && (
          <div className="wrap" style={{ paddingTop: 56, paddingBottom: 24 }}>
            <MapCard name={u.branch_name} city={u.branch_city} lat={u.lat} lng={u.lng} address={u.branch_address} reviewStart={u.review_start.slice(0, 5)} reviewEnd={u.review_end.slice(0, 5)} title={`موقع ${u.name}`} />
          </div>
        )}
      </div>
    </PublicShell>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PublicShell from "@/components/PublicShell";
import HeroImage from "@/components/HeroImage";
import SeasonFx from "@/components/SeasonFx";
import Icon from "@/components/Icon";
import UnitCard from "@/components/UnitCard";
import MapCard from "@/components/MapCard";
import { q } from "@/lib/db";
import { branchBySlug, branchTheme, siteMeta, UNIT_CARD_SQL } from "@/lib/services/public";
import { THEME_BADGE } from "@/lib/services/theme";
import { routeParam } from "@/lib/paths";
import { getTexts } from "@/lib/texts/server";
import { textHelpers } from "@/lib/texts/jsx";

export const dynamic = "force-dynamic";
const SEASON_AR = { Summer: "الصيف", Winter: "الشتاء", Spring: "الربيع", Autumn: "الخريف" } as const;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const b = await branchBySlug(routeParam((await params).slug));
  return b ? { title: `فرع ${b.name}`, description: b.description || `أكواخ ومزارع بمسابح خاصة في ${b.name}.` } : {};
}

export default async function BranchPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ type?: string; family?: string }> }) {
  const b = await branchBySlug(routeParam((await params).slug));
  if (!b) notFound();
  const sp = await searchParams;
  const [{ theme, season }, meta, dict] = await Promise.all([branchTheme(b.id), siteMeta(), getTexts(b.id)]);
  const { t, T } = textHelpers(dict);
  const type = sp.type === "Chalet" || sp.type === "Farm" ? sp.type : null;
  const units = b.status === "Active"
    ? await q(`${UNIT_CARD_SQL} AND u.branch_id = $1 ${type ? "AND u.type = $2" : ""} ${sp.family === "1" ? "AND u.allowed_category = 'FamilyOnly'" : ""} ORDER BY u.sort_order, u.id`, type ? [b.id, type] : [b.id])
    : [];
  const cover = b.cover_media_path ? `/media/${b.cover_media_path}` : meta.hero;
  const chip = (label: React.ReactNode, href: string, on: boolean) => (
    <Link href={href} scroll={false} className="btn btn-sm" style={{ background: on ? "var(--forest-deep)" : "#fff", color: on ? "#fff" : "var(--forest)", boxShadow: on ? "none" : "var(--sh-card)" }} aria-current={on ? "true" : undefined}>{label}</Link>
  );
  const base = `/b/${b.slug}`;

  return (
    <PublicShell theme={theme} page="Branch" entityId={b.id} branchId={b.id} waText={`مرحبًا، أستفسر عن فرع ${b.name}`} active="branches">
      <section className="hero" style={{ minHeight: 560 }}>
        <HeroImage base={cover} alt={`فرع ${b.name}`} priority />
        <SeasonFx theme={theme} />
        <div className="hero-shade" />
        <div className="hero-fade" />
        <div className="wrap flex-1 flex items-end" style={{ padding: "150px 0 110px" }}>
          <div className="flex flex-col gap-4" style={{ maxWidth: 620 }} data-fx="reveal">
            <span className="chip chip-glass self-start">{THEME_BADGE[theme] ?? (season ? `${t("unit.season.current")} ${SEASON_AR[season.kind]}` : T("branch.badge"))}</span>
            <h1 className="h-display" style={{ color: "#fff" }}>{T("branch.title", { "الفرع": b.name })}</h1>
            {b.description && <p style={{ margin: 0, color: "#E9E4DA", fontSize: 18, lineHeight: 1.85 }}>{b.description}</p>}
          </div>
        </div>
      </section>

      <section className="wrap-wide glass flex flex-wrap relative" data-fx="spotlight" style={{ zIndex: 3, marginTop: -70, borderRadius: 24, background: "rgba(255,255,255,.92)", boxShadow: "var(--sh-float)" }}>
        <div className="flex gap-4 items-center" style={{ flex: "1 1 260px", padding: "22px 26px" }}>
          <span className="flex-none flex items-center justify-center" style={{ width: 48, height: 48, borderRadius: 16, background: "rgba(181,83,46,.1)" }}><Icon name="clock" size={24} stroke="var(--ember)" /></span>
          <div><div style={{ fontFamily: "var(--f-head)", fontWeight: 600, color: "var(--forest)" }}>{T("branch.reviewTitle")}</div><div className="muted num" dir="ltr" style={{ textAlign: "right" }}>{b.review_start.slice(0, 5)} – {b.review_end.slice(0, 5)}</div></div>
        </div>
        <div className="flex gap-4 items-center" style={{ flex: "1 1 260px", padding: "22px 26px", borderInlineStart: "1px solid var(--line-soft)" }}>
          <span className="flex-none flex items-center justify-center" style={{ width: 48, height: 48, borderRadius: 16, background: "rgba(46,111,115,.1)" }}><Icon name="map" size={24} stroke="var(--teal)" /></span>
          <div>
            <div style={{ fontFamily: "var(--f-head)", fontWeight: 600, color: "var(--forest)" }}>{T("branch.locationTitle")}</div>
            {b.lat != null ? <a href="#location" style={{ color: "var(--teal)", fontWeight: 600 }}>{T("branch.locationLink")}</a> : b.map_url ? <a href={b.map_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--teal)", fontWeight: 600 }}>{T("branch.locationLink")}</a> : <span className="muted">{T("branch.locationLater")}</span>}
          </div>
        </div>
      </section>

      <section className="wrap flex flex-col gap-7" style={{ paddingTop: 80 }}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2"><span className="overline">Our chalets</span><span className="eyebrow">{T("branch.units.eyebrow")}</span><h2 className="h-section">{T("branch.units.title", { "الفرع": b.name })}</h2></div>
          {b.status === "Active" && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="تصفية الوحدات">
              {chip(T("branch.filter.all"), base, !type && sp.family !== "1")}
              {chip(T("branch.filter.chalets"), `${base}?type=Chalet`, type === "Chalet")}
              {chip(T("branch.filter.farms"), `${base}?type=Farm`, type === "Farm")}
              {chip(T("branch.filter.family"), `${base}?family=1`, sp.family === "1")}
            </div>
          )}
        </div>
        {b.status === "ComingSoon" ? (
          <div className="card empty"><span className="empty-ico"><Icon name="leaf" size={30} stroke="var(--stone)" /></span><strong style={{ fontFamily: "var(--f-head)", color: "var(--forest-deep)" }}>{T("branch.soonTitle")}</strong><span>{T("branch.soonText")}</span></div>
        ) : units.length ? (
          <div className="flex flex-wrap gap-6">{units.map((u) => <UnitCard key={u.id} u={u} currency={meta.currency} dict={dict} />)}</div>
        ) : (
          <div className="card empty"><span className="empty-ico"><Icon name="home" size={30} stroke="var(--stone)" /></span><strong style={{ fontFamily: "var(--f-head)", color: "var(--forest-deep)" }}>{T("branch.emptyTitle")}</strong><span>{T("branch.emptyText")}</span></div>
        )}
      </section>
      {b.lat != null && b.lng != null && (
        <section id="location" className="wrap" style={{ paddingTop: 72, scrollMarginTop: 24 }}>
          <MapCard name={b.name} city={b.city} lat={b.lat} lng={b.lng} address={b.address} reviewStart={b.review_start.slice(0, 5)} reviewEnd={b.review_end.slice(0, 5)} labels={{ title: t("map.title"), directions: t("map.directions"), hours: t("map.hours") }} />
        </section>
      )}
    </PublicShell>
  );
}

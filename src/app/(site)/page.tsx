import Link from "next/link";
import PublicShell from "@/components/PublicShell";
import HeroImage from "@/components/HeroImage";
import SeasonFx from "@/components/SeasonFx";
import Icon from "@/components/Icon";
import MapCard from "@/components/MapCard";
import UnitCard from "@/components/UnitCard";
import RevealList from "@/components/RevealList";
import BookingStory from "@/components/BookingStory";
import { generalTheme, publicBranches, featuredUnits, siteMeta } from "@/lib/services/public";
import { THEME_BADGE } from "@/lib/services/theme";
import { getTexts } from "@/lib/texts/server";
import { textHelpers } from "@/lib/texts/jsx";

export const dynamic = "force-dynamic";

const unitsAr = (n: number) => (n === 1 ? "وحدة واحدة" : n === 2 ? "وحدتان" : n <= 10 ? `${n} وحدات` : `${n} وحدة`);

export default async function Home() {
  const [theme, branches, units, meta, dict] = await Promise.all([generalTheme(), publicBranches(), featuredUnits(3), siteMeta(), getTexts(null)]);
  const { t, T } = textHelpers(dict);
  const active = branches.filter((b) => b.status === "Active");
  const cities = active.map((b) => b.name).join(" و");
  const hotelImg = units.find((u) => u.cover)?.cover ? `/media/${units.find((u) => u.cover)!.cover}` : "/img/hero/chalet-pool-dusk";

  return (
    <PublicShell theme={theme} page="Home" waText="مرحبًا، أستفسر عن الحجز في الأكواخ السويسرية" active="home">
      <section className="hero">
        <HeroImage base={meta.hero} alt="كوخ خشبي بإضاءة دافئة ومسبح خاص عند الغروب" priority />
        <SeasonFx theme={theme} />
        <div className="hero-shade" />
        <div className="hero-fade" />
        <div className="wrap flex-1 flex items-center" style={{ padding: "150px 0 130px" }}>
          <div className="flex flex-col gap-[22px]" style={{ maxWidth: 720 }} data-fx="reveal">
            <span className="chip chip-glass self-start" style={{ fontSize: 14 }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: theme === "winter" ? "#F3A46B" : "#7FD4CF" }} />{THEME_BADGE[theme] ?? T("home.hero.badge")}
            </span>
            <h1 className="h-display" style={{ color: "#fff", textShadow: "0 2px 24px rgba(0,0,0,.25)" }}>{T("home.hero.title")}</h1>
            <p style={{ margin: 0, fontSize: "clamp(17px,1.5vw,20px)", lineHeight: 1.85, color: "#E9E4DA", maxWidth: 480 }}>
              {T("home.hero.text", { "المدن": cities ? `، في ${cities}` : "" })}
            </p>
            <div className="flex flex-wrap gap-3 mt-1.5">
              <a href="#branches" className="btn btn-cta" data-fx="magnetic ripple">{T("home.hero.cta")}<Icon name="arrow" size={18} width={2} /></a>
              <a href="#how" className="btn btn-glass" style={{ minHeight: 58, fontSize: 16 }}>{T("home.hero.how")}</a>
            </div>
          </div>
        </div>
      </section>

      <section className="wrap-wide glass flex flex-wrap relative" data-fx="spotlight" style={{ zIndex: 3, marginTop: -84, borderRadius: 24, background: "rgba(255,255,255,.9)", boxShadow: "var(--sh-float)" }}>
        {[
          { icon: "pool", c: "var(--teal)", bg: "rgba(46,111,115,.1)", t: T("home.f1.t"), d: T("home.f1.d"), k: 1 },
          { icon: "calendar", c: "var(--ember)", bg: "rgba(181,83,46,.1)", t: T("home.f2.t"), d: T("home.f2.d"), k: 2 },
          { icon: "chat", c: "var(--forest)", bg: "rgba(31,61,46,.08)", t: T("home.f3.t"), d: T("home.f3.d"), k: 3 },
        ].map((f, i) => (
          <div key={f.k} className="relative flex gap-4 items-center" style={{ flex: "1 1 260px", padding: "26px 28px", borderInlineStart: i ? "1px solid var(--line-soft)" : undefined }}>
            <span className="flex-none flex items-center justify-center" style={{ width: 52, height: 52, borderRadius: 16, background: f.bg }}><Icon name={f.icon} size={26} stroke={f.c} width={1.5} /></span>
            <div><div style={{ fontFamily: "var(--f-head)", fontWeight: 600, fontSize: 17, color: "var(--forest)" }}>{f.t}</div><div className="muted" style={{ fontSize: 14 }}>{f.d}</div></div>
          </div>
        ))}
      </section>

      <section id="branches" className="wrap flex flex-col gap-8" style={{ paddingTop: 110, scrollMarginTop: 90 }}>
        <div className="flex flex-wrap items-end justify-between gap-4" data-fx="reveal">
          <div className="flex flex-col gap-2.5"><span className="overline">Destinations</span><span className="eyebrow">{T("home.branches.eyebrow")}</span><h2 className="h-section">{T("home.branches.title")}</h2></div>
          <p className="muted" style={{ margin: 0, maxWidth: 420, lineHeight: 1.8 }}>{T("home.branches.text")}</p>
        </div>
        <div className="flex flex-wrap gap-6">
          {branches.map((b) =>
            b.status === "ComingSoon" ? (
              <div key={b.id} data-fx="reveal" className="flex flex-col items-center justify-center gap-3.5 text-center" style={{ flex: "1 1 260px", minHeight: 460, borderRadius: 32, border: "1.5px dashed #CFC7B8", background: "var(--line-soft)", padding: 24 }}>
                <span style={{ fontFamily: "var(--f-head)", fontWeight: 700, fontSize: 34, color: "var(--stone)" }}>{b.name}</span>
                <span style={{ padding: "8px 16px", borderRadius: 999, background: "#F3E7CC", color: "#7A5A12", fontSize: 14, fontWeight: 600 }}>{T("home.branches.soon")}</span>
                <span className="muted" style={{ fontSize: 15 }}>{T("home.branches.soonText")}</span>
              </div>
            ) : (
              <Link key={b.id} href={`/b/${b.slug}`} data-fx="tilt reveal" className="relative overflow-hidden block" style={{ flex: "1 1 340px", minHeight: 460, borderRadius: 32, background: "repeating-linear-gradient(135deg,#2C4A38 0 16px,#284434 16px 32px)", boxShadow: "var(--sh-float)" }}>
                {(b.cover_media_path || b.fallback_cover) ? (
                  <HeroImage base={`/media/${b.cover_media_path || b.fallback_cover}`} alt={`فرع ${b.name}`} className="tilt-img absolute inset-0 w-full h-full object-cover" sizes="(max-width: 720px) 100vw, 50vw" />
                ) : (
                  <HeroImage base={b.sort_order % 2 ? "/img/hero/chalet-pool-night" : "/img/hero/chalet-pool-dusk"} alt={`فرع ${b.name}`} className="tilt-img absolute inset-0 w-full h-full object-cover" sizes="(max-width: 720px) 100vw, 50vw" />
                )}
                <span className="tilt-shine" />
                <span className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(14,31,23,0) 45%, rgba(14,31,23,.85) 100%)" }} />
                <span className="absolute flex items-end justify-between gap-3 text-white" style={{ right: 28, left: 28, bottom: 26, zIndex: 3 }}>
                  <span className="flex flex-col gap-1.5">
                    <span style={{ fontFamily: "var(--f-head)", fontWeight: 700, fontSize: 38 }}>{b.name}</span>
                    <span style={{ fontSize: 15, color: "#E4DDD1" }}>{b.units ? `${unitsAr(b.units)} · ${t("home.branches.mix")}` : T("home.branches.empty")}</span>
                  </span>
                  <span className="flex items-center gap-2" style={{ height: 52, padding: "0 22px", borderRadius: 999, background: "rgba(255,255,255,.92)", color: "var(--forest)", fontWeight: 600, fontSize: 15, whiteSpace: "nowrap" }}>{T("home.branches.view")}<Icon name="arrow" size={16} width={2} /></span>
                </span>
              </Link>
            ),
          )}
        </div>
      </section>

      <section className="sec-dark sec-pad" style={{ marginTop: 110 }} aria-labelledby="seasons-title">
        <div className="wrap flex flex-col gap-12">
          <div className="sec-head" data-fx="reveal"><span className="overline" style={{ color: "var(--reveal)" }}>All year round</span><span className="eyebrow" style={{ color: "var(--reveal)" }}>{T("home.seasons.eyebrow")}</span><h2 id="seasons-title" className="h-section">{T("home.seasons.title")}</h2><p className="lead">{T("home.seasons.text")}</p></div>
          <RevealList items={[
            { key: "summer", icon: "sun", title: T("home.seasons.summer.t"), text: T("home.seasons.summer.d"), image: "/img/hero/chalet-pool-dusk", alt: t("home.seasons.summer.t") },
            { key: "winter", icon: "snow", title: T("home.seasons.winter.t"), text: T("home.seasons.winter.d"), image: "/img/hero/chalet-pool-night", alt: t("home.seasons.winter.t") },
            { key: "hotel", icon: "bed", title: T("home.seasons.hotel.t"), text: T("home.seasons.hotel.d"), image: hotelImg, alt: t("home.seasons.hotel.t") },
          ]} />
        </div>
        <span className="watermark" aria-hidden>SWISS CHALETS</span>
      </section>

      <section id="units" className="wrap flex flex-col gap-8" style={{ paddingTop: 110, scrollMarginTop: 90 }}>
        <div className="flex flex-col gap-2.5" data-fx="reveal"><span className="overline">Selected stays</span><span className="eyebrow">{T("home.units.eyebrow")}</span><h2 className="h-section">{T("home.units.title")}</h2></div>
        {units.length ? (
          <div className="flex flex-wrap gap-6">{units.map((u) => <UnitCard key={u.id} u={u} currency={meta.currency} dict={dict} />)}</div>
        ) : (
          <div className="card empty" data-fx="reveal">
            <span className="empty-ico"><Icon name="home" size={30} stroke="var(--stone)" /></span>
            <strong style={{ color: "var(--forest-deep)", fontFamily: "var(--f-head)" }}>{T("home.units.emptyTitle")}</strong>
            <span>{T("home.units.emptyText")}</span>
          </div>
        )}
      </section>

      <section id="how" className="sec-cream sec-pad" style={{ marginTop: 110, scrollMarginTop: 0 }} aria-labelledby="how-title">
        <div className="wrap flex flex-col gap-10">
          <div className="sec-head" data-fx="reveal"><span className="overline">How it works</span><span className="eyebrow">{T("home.how.eyebrow")}</span><h2 id="how-title" className="h-section" style={{ color: "var(--ink-dark)" }}>{T("home.how.title")}</h2><p className="lead">{T("home.how.text")}</p></div>
          <BookingStory
            steps={[1, 2, 3, 4].map((n) => ({ title: T(`home.how.s${n}.t` as "home.how.s1.t"), text: T(`home.how.s${n}.d` as "home.how.s1.d") }))}
            labels={{
              card: t("home.how.card"), held: t("pay.heldForYou"), name: t("form.name"), phone: t("form.phone"), family: t("form.family"), youth: t("form.youth"),
              morning: "صباحي · 6 ساعات", evening: "مسائي · 6 ساعات", fullDay: "يوم كامل", shamcash: "Sham Cash", account: t("pay.sc.name"), copy: t("pay.sc.copy"), copied: "تم النسخ",
              txn: t("pay.txn"), drop: t("pay.drop"), submit: t("pay.submit"), pending: t("st.pending.t"), received: t("st.step1"), proof: t("st.step2"), review: t("st.step3"),
              confirmed: t("st.confirmed.t"), newBooking: "🔔 حجز جديد", documents: t("st.arrive"), pause: "إيقاف العرض", play: "تشغيل العرض", replay: t("mech.replay"),
              amount: t("pay.full"), demoName: "سامر الأحمد",
            }} />
          <p className="muted" style={{ margin: 0, fontSize: 14, textAlign: "center" }}>{T("home.how.note")}</p>
        </div>
      </section>

      <section className="wrap-wide relative overflow-hidden flex items-center" style={{ marginTop: 110, minHeight: 360, borderRadius: 36 }}>
        <HeroImage base="/img/hero/chalet-pool-night" alt="" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: "center 60%" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(270deg, rgba(14,31,23,.15) 20%, rgba(14,31,23,.85) 75%)" }} />
        <div className="relative flex flex-col gap-[18px] text-white" style={{ padding: "clamp(32px,5vw,64px)", maxWidth: 520, marginRight: "auto" }} data-fx="reveal">
          <h2 style={{ color: "#fff", fontWeight: 700, fontSize: "clamp(28px,3vw,40px)", lineHeight: 1.3 }}>{T("home.banner.title")}</h2>
          <p style={{ margin: 0, lineHeight: 1.8, color: "#E4DDD1" }}>{T("home.banner.text")}</p>
          <a href="#branches" className="btn btn-light self-start" style={{ minHeight: 56, fontSize: 16 }} data-fx="ripple">{T("home.banner.cta")}</a>
        </div>
      </section>
      {active.some((b) => b.lat != null) && (
        <section id="locations" className="wrap flex flex-col gap-6" style={{ paddingTop: 96 }}>
          <div className="flex flex-col gap-2"><span className="overline">Our locations</span><h2 className="h-section">{T("home.locations.title")}</h2></div>
          <div className="map-row">
            {active.filter((b) => b.lat != null && b.lng != null).map((b) => <MapCard key={b.id} name={b.name} city={b.city} lat={b.lat} lng={b.lng} address={b.address} compact />)}
          </div>
        </section>
      )}
    </PublicShell>
  );
}

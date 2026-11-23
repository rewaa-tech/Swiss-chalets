/** Responsive WebP hero image; base like "/img/hero/chalet-pool-dusk" or "/media/units/1/abc". */
export default function HeroImage({ base, alt, className = "hero-img", priority = false, fx = true, sizes = "100vw", style }: { base: string; alt: string; className?: string; priority?: boolean; fx?: boolean; sizes?: string; style?: React.CSSProperties }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${base}-960.webp`}
      srcSet={`${base}-480.webp 480w, ${base}-960.webp 960w, ${base}-1600.webp 1600w`}
      sizes={sizes}
      alt={alt}
      className={className}
      style={style}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      {...(priority ? { fetchPriority: "high" as const } : {})}
      {...(fx && priority ? { "data-fx": "parallax" } : {})}
    />
  );
}

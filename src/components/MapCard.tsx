import Icon from "./Icon";
import MapFrame from "./MapFrame";
import { mapEmbedUrl, mapOpenUrl } from "@/lib/geo";

/**
 * v3 §4 — branch location card: lazy Google Maps embed (no API key) under a glass info card.
 * Clicking anywhere on the map opens directions (the Maps app on phones).
 */
export default function MapCard({ name, city, lat, lng, address, reviewStart, reviewEnd, compact = false, title, labels }: {
  name: string; city?: string | null; lat: number; lng: number; address?: string | null; reviewStart?: string; reviewEnd?: string; compact?: boolean; title?: string;
  labels?: { title?: string; directions?: string; hours?: string };
}) {
  const L = { title: "موقعنا", directions: "افتح الاتجاهات", hours: "المراجعة يوميًا", ...labels };
  const open = mapOpenUrl(lat, lng);
  return (
    <section className={`map-card ${compact ? "is-compact" : ""}`} aria-label={`موقع فرع ${name}`} data-fx="reveal">
      <MapFrame src={mapEmbedUrl(lat, lng)} href={open} label={`افتح موقع فرع ${name} على الخريطة`} />
      <div className="map-info glass">
        {!compact && <span className="overline" style={{ color: "var(--sand)" }}>Location</span>}
        <h3>{compact ? `فرع ${name}` : (title ?? <span data-tk="map.title">{L.title}</span>)}</h3>
        <p className="map-place"><Icon name="pin" size={16} />{address || [`فرع ${name}`, city].filter(Boolean).join(" · ")}</p>
        {reviewStart && reviewEnd && !compact && <p className="map-hours"><Icon name="clock" size={16} /><span data-tk="map.hours">{L.hours}</span> <span dir="ltr" className="num">{reviewStart}–{reviewEnd}</span></p>}
        <a className="btn btn-cta map-go" href={open} target="_blank" rel="noopener noreferrer" data-fx="magnetic"><Icon name="map" size={18} /><span data-tk="map.directions">{L.directions}</span></a>
      </div>
    </section>
  );
}

/** Visual 24h strip; overlapping slots are highlighted. Slots may cross midnight. */
export default function SlotBar({ slots, overlaps }: { slots: { id: number; name: string; start_time: string; duration_minutes: number; is_active: boolean }[]; overlaps: number[] }) {
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const active = slots.filter((s) => s.is_active);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative" style={{ height: 14 + active.length * 22, borderRadius: 12, background: "var(--line-soft)", overflow: "hidden" }} aria-hidden>
        {[0, 6, 12, 18].map((h) => <span key={h} className="absolute num" style={{ right: `${(h / 24) * 100}%`, top: 0, fontSize: 10, color: "var(--stone)", paddingRight: 2 }}>{h}</span>)}
        {active.map((s, i) => {
          const st = toMin(s.start_time), end = st + s.duration_minutes;
          const segs = end <= 1440 ? [[st, end]] : [[st, 1440], [0, Math.min(1440, end - 1440)]];
          return segs.map(([a, b], j) => (
            <span key={`${s.id}-${j}`} title={s.name} className="absolute" style={{ right: `${(a / 1440) * 100}%`, width: `${((b - a) / 1440) * 100}%`, top: 14 + i * 22, height: 18, borderRadius: 6, background: overlaps.includes(s.id) ? "var(--ember)" : "var(--teal)", opacity: 0.85 }} />
          ));
        })}
      </div>
      <div className="flex justify-between muted" style={{ fontSize: 11 }}><span>00:00</span><span>{overlaps.length ? "الفترات البرتقالية متداخلة (لا يمكن حجزها معًا)" : "شريط 24 ساعة"}</span><span>24:00</span></div>
    </div>
  );
}

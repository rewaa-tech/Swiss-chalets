export function LogoMark({ size = 38, light = false }: { size?: number; light?: boolean }) {
  const stroke = light ? "#E3B98F" : "#1F3D2E";
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 30 L20 6 L35 30" />
      <path d="M20 14 L14 25 H26Z" stroke={light ? stroke : "#B5532E"} />
      <path d="M20 25 V29" />
      <path d="M6 35 Q10 32 14 35 T22 35 T30 35 T36 35" stroke={light ? stroke : "#2E6F73"} />
    </svg>
  );
}

export default function Logo({ light = false, sub }: { light?: boolean; sub?: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark light={light} />
      <span className="flex flex-col leading-[1.1]">
        <span style={{ fontFamily: "var(--f-head)", fontWeight: 700, fontSize: 18, color: light ? "#F7F3EC" : "var(--forest)" }}>الأكواخ السويسرية</span>
        {sub ? <span style={{ fontSize: 12, color: "#8FA197" }}>{sub}</span> : <span className="latin" dir="ltr" style={{ fontSize: 12, color: light ? "#8FA197" : "var(--stone)" }}>SWISS CHALETS</span>}
      </span>
    </span>
  );
}

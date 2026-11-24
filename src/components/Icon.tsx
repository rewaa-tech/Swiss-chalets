import type { SVGProps } from "react";

const P: Record<string, React.ReactNode> = {
  arrow: <path d="M15 6l-6 6 6 6" />,
  back: <path d="M9 6l6 6-6 6" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  pool: <path d="M3 18q2.25-2 4.5 0t4.5 0 4.5 0 4.5 0M3 14q2.25-2 4.5 0t4.5 0 4.5 0 4.5 0M8 11V5a2 2 0 0 1 4 0M14 11V5a2 2 0 0 1 4 0" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4M8 14h3" /></>,
  wa: <><path d="M3.5 20.5l1.2-4.2A8.5 8.5 0 1 1 8 19.6z" /><path d="M9 8.6c.2-.5.5-.6.8-.6h.5c.2 0 .4.1.5.4l.6 1.5c.1.2 0 .5-.1.6l-.5.6c.6 1.2 1.5 2.1 2.7 2.7l.6-.5c.2-.2.4-.2.6-.1l1.5.6c.3.1.4.3.4.5v.5c0 .3-.1.6-.6.8-.6.3-1.7.4-3.2-.4a8 8 0 0 1-3.4-3.4c-.8-1.5-.7-2.6-.4-3.2z" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  chat: <><path d="M3.5 20.5l1.2-4.2A8.5 8.5 0 1 1 8 19.6z" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></>,
  users: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.8M17.5 14.2A5 5 0 0 1 20.5 19" /></>,
  bed: <><path d="M3 18v-8M21 18v-5a3 3 0 0 0-3-3H10v5M3 15h18" /><circle cx="6.5" cy="12" r="1.5" /></>,
  bath: <><path d="M4 12h16v2a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM6 12V6a2 2 0 0 1 4 0M7 19l-1 2M17 19l1 2" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="3" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></>,
  file: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  map: <><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  share: <><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6" /></>,
  heat: <path d="M8 4c1.5 2 0 3.5 0 5.5S9.5 12 8 14M12 4c1.5 2 0 3.5 0 5.5S13.5 12 12 14M16 4c1.5 2 0 3.5 0 5.5S17.5 12 16 14M4 18h16" />,
  home: <path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />,
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  grid: <><rect x="4" y="4" width="7" height="7" rx="2" /><rect x="13" y="4" width="7" height="7" rx="2" /><rect x="4" y="13" width="7" height="7" rx="2" /><rect x="13" y="13" width="7" height="7" rx="2" /></>,
  leaf: <path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15M5 19l7-7" />,
  tag: <><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="7.5" r="1.5" /></>,
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
  text: <path d="M4 6h16M4 12h10M4 18h13" />,
  log: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M9 13h6M9 17h4" /></>,
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  logout: <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></>,
  ban: <><circle cx="12" cy="12" r="9" /><path d="M5.7 5.7l12.6 12.6" /></>,
  inbox: <><path d="M4 13l2.5-8h11L20 13v6H4z" /><path d="M4 13h5l1 2h4l1-2h5" /></>,
  alert: <><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18h.01" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></>,
  star: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
  snow: <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9 4l3 2 3-2M9 20l3-2 3 2" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
};

export default function Icon({ name, size = 20, stroke = "currentColor", width = 1.7, ...rest }: { name: keyof typeof P | string; size?: number; stroke?: string; width?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {P[name] ?? P.check}
    </svg>
  );
}

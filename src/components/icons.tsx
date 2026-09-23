type Props = { name: string; size?: number; className?: string };

const P: Record<string, React.ReactNode> = {
  back: <path d="M14.5 5 8 12l6.5 7" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M10.6 5.6c.46-.06.92-.1 1.4-.1 6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-2.4 3.1M6.4 6.9C3.9 8.5 2.5 12 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4.6-1.3" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3.5 3.5l17 17" />
    </>
  ),
  logout: <path d="M14 4.5H6.4A1.4 1.4 0 0 0 5 5.9v12.2a1.4 1.4 0 0 0 1.4 1.4H14M10.5 12H20M16.5 8l4 4-4 4" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  home: <path d="M4 10.4 12 4l8 6.4v8.8a1.4 1.4 0 0 1-1.4 1.4H15v-6H9v6H5.4A1.4 1.4 0 0 1 4 19.2v-8.8Z" />,
  grid: (
    <>
      <rect x="4" y="4" width="6.6" height="6.6" rx="1.8" />
      <rect x="13.4" y="4" width="6.6" height="6.6" rx="1.8" />
      <rect x="4" y="13.4" width="6.6" height="6.6" rx="1.8" />
      <rect x="13.4" y="13.4" width="6.6" height="6.6" rx="1.8" />
    </>
  ),
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.3" />
      <path d="m15.6 15.6 4.4 4.4" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3.5v2.2M12 18.3v2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
    </>
  ),
  pencil: (
    <>
      <path d="M15.2 5.2 18.8 8.8M4.5 19.5l1-4.4L16 4.6a2 2 0 0 1 2.9 0l.5.5a2 2 0 0 1 0 2.9L8.9 18.5l-4.4 1Z" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="2.4" width="6" height="11.2" rx="3" />
      <path d="M5.3 11.3a6.7 6.7 0 0 0 13.4 0M12 18.1v3.5M9 21.6h6" />
    </>
  ),
  micOff: (
    <>
      <rect x="9" y="2.4" width="6" height="11.2" rx="3" />
      <path d="M5.3 11.3a6.7 6.7 0 0 0 13.4 0M12 18.1v3.5" />
      <path d="M3.4 3.4 20.6 20.6" />
    </>
  ),
  speaker: (
    <>
      <path d="M11.4 4.6 6.6 8.6H3.4v6.8h3.2l4.8 4V4.6Z" />
      <path d="M15.4 9a4 4 0 0 1 0 6M18 6.4a7.4 7.4 0 0 1 0 11.2" />
    </>
  ),
  speakerSmall: (
    <>
      <path d="M11 5.2 6.4 9H3.4v6h3l4.6 3.8V5.2Z" />
      <path d="M15.4 9.4a3.6 3.6 0 0 1 0 5.2" />
    </>
  ),
  translate: (
    <>
      <path d="M3.4 6.6h7.8M7.3 4.4v2.2M5 12c1.4-3 2.3-4.4 2.3-4.4S8.2 9 9.6 12" />
      <path d="M13.2 20l3.9-9.6L21 20M14.8 16.8h4.6" />
    </>
  ),
  pauseTranslate: (
    <>
      <path d="M7.4 5.6v12.8M12 5.6v12.8" />
      <path d="M16.4 8.2h4.2M18.5 6.4v1.8" />
      <path d="M15.4 18.4l2.9-7.2 2.9 7.2M16.6 15.9h3.4" />
    </>
  ),
  replay: (
    <>
      <path d="M3.8 8.6A8.6 8.6 0 1 1 3.2 12" />
      <path d="M3.4 4v4.6h4.6" />
    </>
  ),
  pause: <path d="M9 5.5v13M15 5.5v13" />,
  play: <path d="M7 5.5l11 6.5-11 6.5v-13Z" />,
  stop: <rect x="6.4" y="6.4" width="11.2" height="11.2" rx="2.4" />,
  right: <path d="M5 12h13M12.5 6.5 18 12l-5.5 5.5" />,
  down: <path d="M12 5v13M6.5 12.5 12 18l5.5-5.5" />,
  chevron: <path d="M6.5 9.5 12 15l5.5-5.5" />,
  up: <path d="M6 14l6-6 6 6" />,
  check: <path d="M5.5 12.5 10 17l8.5-9" />,
  keyboard: (
    <>
      <rect x="2.4" y="6.4" width="19.2" height="12.2" rx="2.6" />
      <path d="M6.4 10h.1M9.6 10h.1M12.8 10h.1M16 10h.1M6.4 13.2h.1M9.6 13.2h.1M12.8 13.2h.1M16 13.2h.1M8.4 16.2h7.2" />
    </>
  ),
  bookmark: <path d="M6.4 3.6h11.2v17l-5.6-4.2-5.6 4.2v-17Z" />,
  clock2: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 7.6V12l3 1.8" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M12 8.2v4.4M12 16.2h.01" />
    </>
  ),
  send: <path d="M4 12 20 4l-3.4 8L20 20 4 12Z" />,

  /* topik */
  ring: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <circle cx="12" cy="12" r="3.6" />
      <path d="M6 6l3.5 3.5M18 6l-3.5 3.5M6 18l3.5-3.5M18 18l-3.5-3.5" />
    </>
  ),
  chat: (
    <>
      <path d="M5 6h9.5a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H9.5L6 17v-3H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" />
      <path d="M19 10h1a2 2 0 0 1 2 2v3.5a2 2 0 0 1-2 2h-.6v2.4l-2.6-2.4" />
    </>
  ),
  cup: (
    <>
      <path d="M4.5 7.5h11v6.5a4 4 0 0 1-4 4h-3a4 4 0 0 1-4-4V7.5Z" />
      <path d="M15.5 9h2.2a2.3 2.3 0 0 1 0 4.6h-2.2M3.5 21h13" />
    </>
  ),
  clock: (
    <>
      <path d="M3.6 8.4A9 9 0 1 1 3 12" />
      <path d="M3.2 3.6v4.9h4.9M12 8.4V12l2.8 1.8" />
    </>
  ),
  heart: <path d="M12 20.2s-7.6-4.6-7.6-9.7A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.6 2.9c0 5.1-7.6 9.7-7.6 9.7Z" />,
  chart: <path d="M3 20v-6M9 20V9M15 20v-3.5M21 20V4.5" />,
  people: (
    <>
      <circle cx="9" cy="8.2" r="3.1" />
      <path d="M3.6 19.4a5.4 5.4 0 0 1 10.8 0M16.2 5.6a3 3 0 0 1 0 5.6M18.4 19.4a5.6 5.6 0 0 0-2-4.3" />
    </>
  ),
  case: (
    <>
      <rect x="2.8" y="7.2" width="18.4" height="12.6" rx="2.6" />
      <path d="M8.8 7.2V5.4a2 2 0 0 1 2-2h2.4a2 2 0 0 1 2 2v1.8M2.8 12.4h18.4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  badge: (
    <>
      <rect x="3" y="4.4" width="18" height="15.2" rx="2.6" />
      <circle cx="9.2" cy="10.4" r="2.2" />
      <path d="M5.8 16.6a3.6 3.6 0 0 1 6.8 0M15 9.6h3.2M15 13.2h2.2" />
    </>
  ),
};

export function Icon({ name, size = 20, className }: Props) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.1}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {P[name] ?? null}
    </svg>
  );
}

export function Flame({ size = 19, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2.5c0 0 6 4.6 6 9.6a6 6 0 1 1-12 0c0-5 6-9.6 6-9.6Z" fill="#FF7A3D" />
      <path d="M12 11c0 0 2.6 2.2 2.6 4.4a2.6 2.6 0 1 1-5.2 0C9.4 13.2 12 11 12 11Z" fill="#FFD166" />
    </svg>
  );
}

export function Cards({ size = 19 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="6" width="12" height="14" rx="2.4" fill="#FFD98A" />
      <rect x="8" y="4" width="12" height="14" rx="2.4" fill="#FFB524" />
    </svg>
  );
}

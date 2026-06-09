// ui/src/components/db/Icon.tsx
//
// Single-path SVG icon set lifted from the Claude Design shell. Each entry
// in PATHS is the `d` attribute for a 24x24 viewBox. Callers pass `name` and
// optional size/color/stroke. Names are exported as a TS type for autocomplete.
import type { CSSProperties } from "react";

export const PATHS = {
  today: "M3 10.5 12 3l9 7.5M5 9v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9",
  sales: "M3 3v18h18M7 14l3-3 3 3 5-6",
  labor:
    "M16 18v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 8.5a3 3 0 1 0 0-.01M18 7v5M21 9.5h-6",
  inventory: "M3 7 12 3l9 4-9 4-9-4ZM3 7v8l9 4 9-4V7M12 11v8",
  equipment:
    "M14.5 6.5a3.5 3.5 0 0 0-4.6 4.6l-6 6a2 2 0 1 0 2.8 2.8l6-6a3.5 3.5 0 0 0 4.6-4.6l-2.2 2.2-2-2 2.2-2.2Z",
  members: "M19 14c1.5-1.5 2-3 2-5a5 5 0 0 0-9-3 5 5 0 0 0-9 3c0 2 .5 3.5 2 5l7 7 7-7Z",
  feedback: "M21 12a8 8 0 0 1-11.5 7.2L3 21l1.8-6.5A8 8 0 1 1 21 12Z",
  reports: "M3 3v18h18M8 17V9M13 17V5M18 17v-6",
  settings:
    "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM19.4 13a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 13H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.7 7L4.6 7a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4.7V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.2A1.7 1.7 0 0 0 21 11.9h.1a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 1.1Z",
  spark: "M12 3l1.8 5.6L19 10l-5.2 1.4L12 17l-1.8-5.6L5 10l5.2-1.4L12 3Z",
  bell: "M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9ZM10 21a2 2 0 0 0 4 0",
  search: "M21 21l-4.5-4.5M3 11a8 8 0 1 0 16 0 8 8 0 0 0-16 0Z",
  arrow: "M5 12h14M13 6l6 6-6 6",
  chev: "M9 6l6 6-6 6",
  chevd: "M6 9l6 6 6-6",
  chevl: "M15 6l-6 6 6 6",
  check: "M5 13l4 4 10-10",
  clock: "M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z",
  alert:
    "M12 9v4M12 17h.01M10.3 4 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4a2 2 0 0 0-3.4 0Z",
  truck:
    "M3 6h11v9H3zM14 9h4l3 3v3h-7M6.5 18.5a1.5 1.5 0 1 0 0-.01M17.5 18.5a1.5 1.5 0 1 0 0-.01",
  star: "M12 3l2.7 6.2 6.7.6-5 4.5 1.5 6.6L12 17.9 6.1 21.4l1.5-6.6-5-4.5 6.7-.6Z",
  thermo: "M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0Z",
  arrowup: "M12 19V5M6 11l6-6 6 6",
  arrowdn: "M12 5v14M6 13l6 6 6-6",
  x: "M6 6l12 12M18 6 6 18",
  send: "M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z",
  edit:
    "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z",
  calendar:
    "M3 9h18M7 3v4M17 3v4M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z",
  dollar:
    "M12 2v20M17 6.5C17 4.6 14.8 3 12 3S7 4.6 7 6.5 9.2 10 12 10s5 1.6 5 3.5S14.8 17 12 17s-5-1.6-5-3.5",
  filter: "M3 5h18l-7 8v6l-4-2v-4L3 5Z",
  dots: "M5 12h.01M12 12h.01M19 12h.01",
  reply: "M9 14 4 9l5-5M4 9h11a5 5 0 0 1 5 5v6",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  flame:
    "M12 3c3 4 6 6 6 10a6 6 0 0 1-12 0c0-1.6.6-2.8 1.5-4 .4 1 1 1.7 2 2-.3-3 1-5.4 2.5-8Z",
  box: "M3 7 12 3l9 4-9 4-9-4ZM3 7v8l9 4 9-4V7",
  snow: "M12 2v20M4 7l16 10M20 7 4 17M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3",
  user:
    "M16 18v-1a4 4 0 0 0-4-4 4 4 0 0 0-4 4v1M12 11a3.5 3.5 0 1 0 0-.01",
  phone:
    "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z",
  mail:
    "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1ZM3.5 6.5 12 12l8.5-5.5",
  gift:
    "M20 12v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8M2 7h20v5H2zM12 22V7M12 7H8a2 2 0 1 1 0-4c3 0 4 4 4 4ZM12 7h4a2 2 0 1 0 0-4c-3 0-4 4-4 4Z",
  wrench:
    "M14.5 6.5a3.5 3.5 0 0 0-4.6 4.6l-6 6a2 2 0 1 0 2.8 2.8l6-6a3.5 3.5 0 0 0 4.6-4.6l-2.2 2.2-2-2 2.2-2.2Z",
  pin:
    "M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11ZM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  refresh: "M21 12a9 9 0 1 1-3-6.7M21 4v5h-5",
  sunrise: "M3 18h18M5 18a7 7 0 0 1 14 0M12 2v4M5 9l2 2M19 9l-2 2M2 14h2M20 14h2",
  sun:
    "M12 2v3M12 19v3M5 12H2M22 12h-3M5.6 5.6L4 4M20 20l-1.6-1.6M5.6 18.4L4 20M20 4l-1.6 1.6M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z",
  sunset: "M3 18h18M5 18a7 7 0 0 1 14 0M12 14V2M8 6l4-4 4 4M2 22h20",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
  cash: "M2 7h20v10H2zM12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 9v6M18 9v6",
  history: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2",
  info: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 8h.01M11 12h1v4h1",
  book:
    "M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5a2.5 2.5 0 1 0 0 5H20M4 4.5V22",
  screen:
    "M3 4h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1ZM8 22h8M12 18v4",
  diagram:
    "M5 4h4v4H5zM15 4h4v4h-4zM10 16h4v4h-4zM7 8v3a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V8M12 13v3",
  doc:
    "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6ZM14 2v6h6M8 13h8M8 17h8M8 9h2",
  eye:
    "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  plane:
    "M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2A1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5L21 16Z",
  grid:
    "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
} as const;

export type IconName = keyof typeof PATHS;

type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
  stroke?: number;
  style?: CSSProperties;
};

export default function Icon({
  name,
  size = 18,
  color = "currentColor",
  stroke = 1.6,
  style,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }}
    >
      <path d={PATHS[name] || PATHS.today} />
    </svg>
  );
}

// ui/src/components/db/Pill.tsx
//
// Tiny status chip. Five levels: danger / warn / info / ok / neutral.
// Optional left dot. Exports the LEVEL palette for reuse elsewhere.
import type { CSSProperties, ReactNode } from "react";

export type PillLevel = "danger" | "warn" | "info" | "ok" | "neutral";

export const LEVEL: Record<PillLevel, { fg: string; bg: string; dot: string }> = {
  danger: { fg: "var(--db-lava-700)", bg: "var(--db-lava-300)", dot: "var(--db-lava-600)" },
  warn: { fg: "var(--db-yellow-800)", bg: "var(--db-yellow-300)", dot: "var(--db-yellow-600)" },
  info: { fg: "var(--db-blue-700)", bg: "var(--db-blue-300)", dot: "var(--db-blue-600)" },
  ok: { fg: "var(--db-green-800)", bg: "var(--db-green-300)", dot: "var(--db-green-600)" },
  neutral: {
    fg: "var(--db-navy-700)",
    bg: "var(--db-oat-medium)",
    dot: "var(--db-navy-400)",
  },
};

type PillProps = {
  level?: PillLevel;
  children: ReactNode;
  dot?: boolean;
  style?: CSSProperties;
};

export default function Pill({ level = "neutral", children, dot, style }: PillProps) {
  const l = LEVEL[level];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11.5,
        fontWeight: 500,
        padding: "3px 10px",
        borderRadius: 999,
        color: l.fg,
        background: l.bg,
        ...style,
      }}
    >
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: l.dot,
          }}
        />
      )}
      {children}
    </span>
  );
}

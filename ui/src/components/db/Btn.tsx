// ui/src/components/db/Btn.tsx
//
// Five-variant button (primary / dark / ghost / subtle / quiet) at three
// sizes (sm / md / lg). Optional left/right icons. Hover styles live in
// styles.css under `.hb-btn-*` rules.
import type { CSSProperties, ReactNode } from "react";

import Icon, { type IconName } from "./Icon";

export type BtnVariant = "primary" | "dark" | "ghost" | "subtle" | "quiet";
export type BtnSize = "sm" | "md" | "lg";

type BtnProps = {
  variant?: BtnVariant;
  size?: BtnSize;
  children?: ReactNode;
  icon?: IconName;
  iconRight?: IconName;
  full?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
  type?: "button" | "submit" | "reset";
  title?: string;
};

const VARIANT_STYLE: Record<BtnVariant, CSSProperties> = {
  primary: { background: "var(--db-lava-600)", color: "#fff" },
  dark: { background: "var(--db-navy-800)", color: "#fff" },
  ghost: {
    background: "#fff",
    color: "var(--db-navy-800)",
    border: "1px solid var(--db-gray-lines)",
  },
  subtle: { background: "var(--db-oat-medium)", color: "var(--db-navy-800)" },
  quiet: { background: "transparent", color: "var(--db-gray-text)" },
};

export default function Btn({
  variant = "primary",
  size = "md",
  children,
  icon,
  iconRight,
  full,
  disabled,
  onClick,
  style,
  type = "button",
  title,
}: BtnProps) {
  const pad = size === "sm" ? "7px 12px" : size === "lg" ? "12px 20px" : "9px 15px";
  const fs = size === "sm" ? 12.5 : size === "lg" ? 15 : 13.5;
  const base: CSSProperties = {
    border: 0,
    padding: pad,
    borderRadius: 8,
    font: `500 ${fs}px/1 var(--font-sans)`,
    cursor: disabled ? "default" : "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    transition: "all var(--dur-base) var(--ease-out)",
    width: full ? "100%" : "auto",
    opacity: disabled ? 0.45 : 1,
    whiteSpace: "nowrap",
  };
  return (
    <button
      type={type}
      title={title}
      className={`hb-btn hb-btn-${variant}`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{ ...base, ...VARIANT_STYLE[variant], ...style }}
    >
      {icon && <Icon name={icon} size={fs + 1} color="currentColor" />}
      {children}
      {iconRight && <Icon name={iconRight} size={fs + 1} color="currentColor" />}
    </button>
  );
}

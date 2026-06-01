// ui/src/components/db/Eyebrow.tsx
//
// Small uppercase tracked-out label.
import type { CSSProperties, ReactNode } from "react";

type EyebrowProps = {
  children: ReactNode;
  color?: string;
  style?: CSSProperties;
};

export default function Eyebrow({
  children,
  color = "var(--db-gray-text)",
  style,
}: EyebrowProps) {
  return (
    <div
      style={{
        fontSize: 11.5,
        fontWeight: 500,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

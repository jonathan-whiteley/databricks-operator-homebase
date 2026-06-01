// ui/src/components/db/Card.tsx
//
// White surface with 12px radius and hairline border. Optional hover lift
// (handled by .hb-card-hover in styles.css).
import type { CSSProperties, ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  pad?: number | string;
  hover?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
};

export default function Card({ children, pad = 0, hover, onClick, style }: CardProps) {
  return (
    <div
      className={hover ? "hb-card hb-card-hover" : "hb-card"}
      onClick={onClick}
      style={{
        background: "#fff",
        border: "1px solid var(--db-gray-lines)",
        borderRadius: 12,
        padding: pad,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

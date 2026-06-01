// ui/src/components/db/Delta.tsx
//
// Up/down delta chip — green when up, lava when down, with arrow icon.
import type { ReactNode } from "react";

import Icon from "./Icon";

type DeltaProps = {
  up: boolean;
  children: ReactNode;
  size?: number;
};

export default function Delta({ up, children, size = 12 }: DeltaProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        fontSize: size,
        fontWeight: 500,
        color: up ? "var(--db-green-700)" : "var(--db-lava-700)",
      }}
    >
      <Icon name={up ? "arrowup" : "arrowdn"} size={size} stroke={2} /> {children}
    </span>
  );
}

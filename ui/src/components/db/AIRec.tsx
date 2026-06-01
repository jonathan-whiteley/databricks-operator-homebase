// ui/src/components/db/AIRec.tsx
//
// Inline "Genie says…" recommendation card. Two tones:
//   - navy: dark hero variant
//   - oat:  subtle inline variant
import type { ReactNode } from "react";

import Btn from "./Btn";
import Icon from "./Icon";

type AIRecProps = {
  children: ReactNode;
  action?: ReactNode;
  onAction?: () => void;
  tone?: "navy" | "oat";
};

export default function AIRec({ children, action, onAction, tone = "navy" }: AIRecProps) {
  const dark = tone === "navy";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 13,
        padding: "14px 16px",
        borderRadius: 12,
        background: dark ? "var(--db-navy-800)" : "var(--db-oat-medium)",
        border: dark ? 0 : "1px solid var(--db-gray-lines)",
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 7,
          background: "var(--db-lava-600)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        <Icon name="spark" size={16} color="#fff" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: dark ? "var(--db-lava-400)" : "var(--db-lava-700)",
            marginBottom: 4,
          }}
        >
          Genie
        </div>
        <div
          style={{
            fontSize: 13.5,
            lineHeight: 1.5,
            color: dark ? "#fff" : "var(--db-navy-800)",
          }}
        >
          {children}
        </div>
      </div>
      {action && (
        <Btn
          size="sm"
          variant={dark ? "primary" : "dark"}
          onClick={onAction}
          style={{ flexShrink: 0 }}
        >
          {action}
        </Btn>
      )}
    </div>
  );
}

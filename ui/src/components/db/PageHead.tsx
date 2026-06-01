// ui/src/components/db/PageHead.tsx
//
// Page header: icon + h1 + optional subtitle on the left, optional actions slot.
import type { ReactNode } from "react";

import Icon, { type IconName } from "./Icon";

type PageHeadProps = {
  icon?: IconName;
  title: ReactNode;
  sub?: ReactNode;
  children?: ReactNode;
};

export default function PageHead({ icon, title, sub, children }: PageHeadProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 16,
        marginBottom: 22,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {icon && <Icon name={icon} size={22} color="var(--db-navy-800)" />}
          <h1
            style={{
              fontSize: 26,
              fontWeight: 500,
              color: "var(--db-navy-800)",
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            {title}
          </h1>
        </div>
        {sub && (
          <p
            style={{
              fontSize: 14,
              color: "var(--db-gray-text)",
              margin: "8px 0 0",
              maxWidth: 640,
            }}
          >
            {sub}
          </p>
        )}
      </div>
      {children && (
        <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>{children}</div>
      )}
    </div>
  );
}

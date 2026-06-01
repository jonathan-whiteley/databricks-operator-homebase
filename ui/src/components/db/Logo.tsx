// ui/src/components/db/Logo.tsx
//
// Lava square with house icon + "Lakehouse Market" wordmark. Used in the
// Sidebar header.
import Icon from "./Icon";

type LogoProps = {
  size?: number;
};

export default function Logo({ size = 26 }: LogoProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 7,
          background: "var(--db-lava-600)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon name="today" size={size * 0.6} color="#fff" stroke={2.4} />
      </div>
      <span
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: "#fff",
          letterSpacing: "-0.01em",
        }}
      >
        Lakehouse Market
      </span>
    </div>
  );
}

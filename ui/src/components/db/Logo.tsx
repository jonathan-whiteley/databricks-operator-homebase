// ui/src/components/db/Logo.tsx
//
// Databricks symbol (light) + "Lakehouse Market" wordmark. The SVG is
// served from /databricks-symbol-light.svg (ui/public/).

type LogoProps = {
  size?: number;
};

export default function Logo({ size = 26 }: LogoProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <img
        src="/databricks-symbol-light.svg"
        alt="Databricks"
        style={{
          height: size,
          width: "auto",
          display: "block",
          flexShrink: 0,
        }}
      />
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

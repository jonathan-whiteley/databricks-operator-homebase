// ui/src/components/db/Spark.tsx
//
// Inline sparkline. Mirrors the design's `Spark` (shell.jsx:67-79).
// Draws an SVG line + optional fill area + endpoint dot.

type SparkProps = {
  pts: number[];
  w?: number;
  h?: number;
  color?: string;
  fill?: boolean;
  sw?: number;
};

export default function Spark({
  pts,
  w = 96,
  h = 30,
  color = "var(--db-lava-600)",
  fill = true,
  sw = 2,
}: SparkProps) {
  if (pts.length < 2) {
    return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} />;
  }
  const max = Math.max(...pts);
  const min = Math.min(...pts);
  const rng = max - min || 1;
  const step = w / (pts.length - 1);
  const xy = pts.map((p, i) => [i * step, h - ((p - min) / rng) * (h - 4) - 2] as const);
  const line = xy
    .map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
    .join(" ");
  const last = xy[xy.length - 1];
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ display: "block", overflow: "visible" }}
    >
      {fill && <path d={`${line} L${w} ${h} L0 ${h} Z`} fill={color} opacity="0.1" />}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r="2.6" fill={color} />
    </svg>
  );
}

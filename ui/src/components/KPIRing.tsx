// ui/src/components/KPIRing.tsx
export function KPIRing({
  value, max = 100, size = 56, label,
}: {
  value: number;
  max?: number;
  size?: number;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(1, value / max));
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct);
  const color =
    value >= max * 0.7
      ? "var(--color-success)"
      : value >= max * 0.4
        ? "var(--color-warning)"
        : "var(--color-lava)";
  return (
    <div className="inline-flex flex-col items-center">
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-hairline)" strokeWidth={4} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={4}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={off}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="54%" textAnchor="middle" className="fill-[color:var(--color-ink)] font-mono text-sm font-semibold">
          {Math.round(value)}
        </text>
      </svg>
      {label && <div className="mt-1 text-[10px] text-[color:var(--color-ink-soft)]">{label}</div>}
    </div>
  );
}

// ui/src/components/LaborPctRing.tsx
//
// Labor % ring: cost / revenue, three zones tuned to fast-casual fast food
// targets — green when <28%, amber when 28-32%, lava red when >32%. This is
// the lakehouse-market take on labor-iq's LaborPctRing, using our theme
// tokens instead of Panda reds.
import { cn } from "@/lib/util";

type Zone = "good" | "warn" | "bad";

function zoneFor(pct: number): Zone {
  if (!isFinite(pct) || pct <= 0) return "good";
  if (pct > 0.32) return "bad";
  if (pct >= 0.28) return "warn";
  return "good";
}

const ZONE_COLOR: Record<Zone, string> = {
  good: "var(--color-success)",
  warn: "var(--color-warning)",
  bad: "var(--color-lava)",
};

const ZONE_LABEL: Record<Zone, string> = {
  good: "On target",
  warn: "Watch",
  bad: "Over",
};

export function LaborPctRing({
  pct,
  size = 64,
  stroke = 6,
  caption = "Labor % of sales",
  compact = false,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  caption?: string;
  compact?: boolean;
}) {
  const safe = isFinite(pct) ? Math.max(0, pct) : 0;
  const display = safe * 100;
  const visible = Math.min(1, safe);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * visible;
  const zone = zoneFor(safe);
  const color = ZONE_COLOR[zone];
  const verdict = ZONE_LABEL[zone];

  return (
    <div className={cn("flex items-center gap-3", compact && "gap-2")}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--color-hairline)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
        <div
          className="absolute inset-0 flex items-center justify-center font-mono text-xs font-semibold text-[color:var(--color-ink)]"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {display >= 1000 ? "999+%" : `${display.toFixed(display >= 100 ? 0 : 1)}%`}
        </div>
      </div>
      {!compact && (
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[color:var(--color-ink-soft)]">
            {caption}
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[11px] font-medium" style={{ color }}>
            <span aria-hidden>●</span>
            <span>{verdict}</span>
          </div>
        </div>
      )}
    </div>
  );
}

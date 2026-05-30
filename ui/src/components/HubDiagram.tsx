// ui/src/components/HubDiagram.tsx
import { useNavigate } from "react-router-dom";

const NODES = [
  { id: "labor", label: "01 · Labor", to: "/labor" },
  { id: "loyalty", label: "02 · Loyalty", to: "/loyalty" },
  { id: "supply", label: "03 · Supply Chain", to: "/supply" },
  { id: "sentiment", label: "04 · Sentiment", to: "/sentiment" },
  { id: "maintenance", label: "05 · Maintenance", to: "/maintenance" },
];

export function HubDiagram({ badges }: { badges?: Record<string, number> }) {
  const nav = useNavigate();
  const cx = 260, cy = 220, r = 160;
  return (
    <svg viewBox="0 0 520 440" className="w-full max-w-[640px]">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-hairline)" strokeDasharray="4 6" />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" className="fill-[color:var(--color-ink)] text-lg font-semibold">Today at your store</text>
      {NODES.map((n, i) => {
        const angle = (-Math.PI / 2) + (i * 2 * Math.PI) / NODES.length;
        const x = cx + r * Math.cos(angle), y = cy + r * Math.sin(angle);
        const badge = badges?.[n.id];
        return (
          <g key={n.id} onClick={() => nav(n.to)} style={{ cursor: "pointer" }}>
            <circle cx={x} cy={y} r={38} fill="white" stroke="var(--color-hairline)" />
            <text x={x} y={y - 4} textAnchor="middle" className="fill-[color:var(--color-ink)] text-xs font-semibold">{n.label}</text>
            {badge !== undefined && (
              <>
                <circle cx={x + 26} cy={y - 26} r={11} fill="var(--color-lava)" />
                <text x={x + 26} y={y - 22} textAnchor="middle" className="fill-white text-[10px] font-bold">{badge}</text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

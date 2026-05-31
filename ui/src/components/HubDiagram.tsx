// ui/src/components/HubDiagram.tsx
import { useNavigate } from "react-router-dom";
import { Users, Heart, Boxes, MessageCircle, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NodeDef = {
  id: string;
  label: string;
  short: string;
  to: string;
  Icon: LucideIcon;
};

const NODES: NodeDef[] = [
  { id: "labor",       label: "01 Labor",       short: "Labor",       to: "/labor",       Icon: Users },
  { id: "loyalty",     label: "02 Loyalty",     short: "Loyalty",     to: "/loyalty",     Icon: Heart },
  { id: "supply",      label: "03 Supply",      short: "Supply",      to: "/supply",      Icon: Boxes },
  { id: "sentiment",   label: "04 Sentiment",   short: "Sentiment",   to: "/sentiment",   Icon: MessageCircle },
  { id: "maintenance", label: "05 Maintenance", short: "Maint.",      to: "/maintenance", Icon: Wrench },
];

export function HubDiagram({ badges }: { badges?: Record<string, number> }) {
  const nav = useNavigate();
  // Use a square-ish viewBox so the ring is balanced; nodes get more room.
  const W = 560, H = 480;
  const cx = W / 2, cy = H / 2 - 8;
  const r = 180;
  const nodeR = 54;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {/* Soft inner halo */}
        <defs>
          <radialGradient id="hub-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="var(--color-lava)" stopOpacity="0.07" />
            <stop offset="60%"  stopColor="var(--color-lava)" stopOpacity="0.02" />
            <stop offset="100%" stopColor="var(--color-lava)" stopOpacity="0" />
          </radialGradient>
          <filter id="node-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#0B2026" floodOpacity="0.08" />
          </filter>
        </defs>

        <circle cx={cx} cy={cy} r={r + 20} fill="url(#hub-halo)" />
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="var(--color-hairline)"
          strokeDasharray="4 6"
        />

        {/* Center cluster */}
        <g>
          <circle cx={cx} cy={cy} r={64} fill="white" stroke="var(--color-hairline)" />
          <circle cx={cx} cy={cy} r={64} fill="none" stroke="var(--color-lava)" strokeOpacity="0.18" strokeWidth="1.5" />
          <text
            x={cx} y={cy - 10}
            textAnchor="middle"
            className="fill-[color:var(--color-ink-soft)]"
            style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase" }}
          >
            Today
          </text>
          <text
            x={cx} y={cy + 10}
            textAnchor="middle"
            className="fill-[color:var(--color-ink)]"
            style={{ fontSize: 14, fontWeight: 700 }}
          >
            Your store
          </text>
          <text
            x={cx} y={cy + 26}
            textAnchor="middle"
            className="fill-[color:var(--color-ink-soft)]"
            style={{ fontSize: 10 }}
          >
            5 domains live
          </text>
        </g>

        {NODES.map((n, i) => {
          const angle = (-Math.PI / 2) + (i * 2 * Math.PI) / NODES.length;
          const x = cx + r * Math.cos(angle);
          const y = cy + r * Math.sin(angle);
          const badge = badges?.[n.id] ?? 0;
          const showBadge = badge > 0;

          return (
            <g
              key={n.id}
              onClick={() => nav(n.to)}
              style={{ cursor: "pointer" }}
              className="hub-node"
            >
              {/* connector line */}
              <line
                x1={cx} y1={cy} x2={x} y2={y}
                stroke="var(--color-hairline)"
                strokeWidth="1"
                strokeDasharray="2 4"
              />

              {/* node disc */}
              <circle
                cx={x} cy={y} r={nodeR}
                fill="white"
                stroke="var(--color-hairline)"
                filter="url(#node-shadow)"
                className="hub-node-disc"
              />

              {/* icon (foreignObject to use lucide) */}
              <foreignObject x={x - 14} y={y - nodeR + 12} width={28} height={28}>
                <div
                  style={{
                    width: 28, height: 28,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "var(--color-lava)",
                  }}
                >
                  <n.Icon size={20} strokeWidth={2} />
                </div>
              </foreignObject>

              <text
                x={x} y={y + 6}
                textAnchor="middle"
                className="fill-[color:var(--color-ink)]"
                style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.02em" }}
              >
                {n.short}
              </text>
              <text
                x={x} y={y + 22}
                textAnchor="middle"
                className="fill-[color:var(--color-ink-soft)]"
                style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase" }}
              >
                {n.label.slice(0, 2)}
              </text>

              {showBadge && (
                <>
                  <circle
                    cx={x + nodeR - 10} cy={y - nodeR + 10} r={12}
                    fill="var(--color-lava)"
                    stroke="white"
                    strokeWidth="2"
                  />
                  <text
                    x={x + nodeR - 10} y={y - nodeR + 14}
                    textAnchor="middle"
                    className="fill-white"
                    style={{ fontSize: 11, fontWeight: 700 }}
                  >
                    {badge > 9 ? "9+" : badge}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>

      <style>{`
        .hub-node { transition: transform 180ms cubic-bezier(0.2, 0.7, 0.2, 1); transform-box: fill-box; transform-origin: center; }
        .hub-node:hover { transform: translateY(-2px); }
        .hub-node .hub-node-disc { transition: stroke 180ms ease; }
        .hub-node:hover .hub-node-disc { stroke: var(--color-lava); }
      `}</style>
    </div>
  );
}

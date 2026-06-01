// ui/src/pages/TodayView.tsx
//
// Today view. Two sections:
//   1. AI hero (Genie · your daily brief) — unchanged navy-900 card with
//      spotlight prose, action chips, and an "Ask anything" bar.
//   2. Radial module hub — Genie at the center, 5 module nodes on spokes
//      arranged around a dashed circle. Mirrors the latest design template
//      (lakehouse-market-homebase-app/project/app/home.jsx).
//
// The KPI strip from the previous iteration is intentionally removed —
// the design dropped it in favor of the radial hub as the primary visual.
import { useNavigate } from "react-router-dom";

import { Btn, Icon, LEVEL, PATHS } from "@/components/db";
import type { IconName, PillLevel } from "@/components/db";
import { useApi } from "@/lib/api";
import { useGeniePanel } from "@/state/genie-panel";

type Module = "labor" | "inventory" | "equipment" | "members" | "feedback";

type Outstanding = Record<Module, number>;

type FirstAction = {
  module: string;
  label: string;
};

export type TodayBrief = {
  yesterday_revenue: number;
  yesterday_delta_pct: number;
  today_forecast: number;
  // kpis ship from the backend but the design dropped the strip — keep the
  // type field so the API contract stays stable.
  kpis: unknown[];
  outstanding: Outstanding;
  first_action: FirstAction;
};

const CHIP_LABEL: Record<Module, (n: number) => string | null> = {
  equipment: (n) => (n ? "Schedule cooler service" : null),
  labor: (n) => (n ? `Approve ${n} day-part schedule${n > 1 ? "s" : ""}` : null),
  inventory: (n) => (n ? `Release ${n} reorder${n > 1 ? "s" : ""}` : null),
  members: (n) => (n ? `Send win-back to ${n} members` : null),
  feedback: (n) => (n ? `Reply to ${n} review${n > 1 ? "s" : ""}` : null),
};

const CHIP_ORDER: Module[] = ["equipment", "labor", "inventory", "members", "feedback"];

type ModuleEntry = {
  id: Module;
  icon: IconName;
  name: string;
  signal: (n: number) => string;
  level: PillLevel;
};

const MODULES: ModuleEntry[] = [
  {
    id: "labor",
    icon: "labor",
    name: "Labor",
    signal: (n) => (n ? `${n} schedules to approve` : "All approved"),
    level: "warn",
  },
  {
    id: "inventory",
    icon: "inventory",
    name: "Reorders",
    signal: (n) => (n ? `${n} POs ready` : "Nothing to release"),
    level: "info",
  },
  {
    id: "equipment",
    icon: "equipment",
    name: "Equipment",
    signal: (n) => (n ? "Cooler #2 trending warm" : "Service booked"),
    level: "danger",
  },
  {
    id: "members",
    icon: "members",
    name: "Loyalty",
    signal: (n) => (n ? `${n} members lapsing` : "Campaign sent"),
    level: "info",
  },
  {
    id: "feedback",
    icon: "feedback",
    name: "Guest Feedback",
    signal: (n) => (n ? `${n} need a reply` : "All replied"),
    level: "warn",
  },
];

const MODULE_ROUTE: Record<Module, string> = {
  labor: "/labor",
  inventory: "/inventory",
  equipment: "/equipment",
  members: "/members",
  feedback: "/feedback",
};

const STORE_MANAGER = "Maya";

function formatAnchorDate(): string {
  const d = new Date(2025, 9, 30); // demo data window ends 2025-10-30
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function pctStr(p: number): string {
  return `${(p * 100 >= 0 ? "+" : "") + (p * 100).toFixed(1)}%`;
}

function fmtMoney(n: number): string {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function TodaySkeleton() {
  return (
    <div style={{ maxWidth: 1120, margin: "0 auto" }}>
      <div
        style={{
          height: 240,
          borderRadius: 18,
          background: "var(--db-navy-900)",
          opacity: 0.55,
          marginBottom: 28,
        }}
      />
      <div
        style={{
          height: 600,
          borderRadius: 18,
          background: "var(--db-oat-medium)",
          border: "1px solid var(--db-gray-lines)",
        }}
      />
    </div>
  );
}

// ===== Radial hub =====
// Geometry from the design template: 600px square, center at (300,300),
// radius 212px to the centers of the module nodes; each node is a 150px
// white circle. Spokes are dashed lines on the ring + solid lines from
// center to each node.
const HUB_SIZE = 600;
const HUB_CENTER = HUB_SIZE / 2;
const HUB_RADIUS = 212;
const NODE_SIZE = 150;
const CENTER_SIZE = 150;

type HubNode = {
  m: ModuleEntry;
  count: number;
  done: boolean;
  lv: (typeof LEVEL)[PillLevel];
  x: number;
  y: number;
};

function buildHubNodes(outstanding: Outstanding): HubNode[] {
  return MODULES.map((m, i) => {
    const count = outstanding[m.id] ?? 0;
    const done = count === 0;
    const lv = done ? LEVEL.ok : LEVEL[m.level];
    const angle = (-90 + i * (360 / MODULES.length)) * (Math.PI / 180);
    return {
      m,
      count,
      done,
      lv,
      x: HUB_CENTER + HUB_RADIUS * Math.cos(angle),
      y: HUB_CENTER + HUB_RADIUS * Math.sin(angle),
    };
  });
}

function RadialHub({
  outstanding,
  totalOpen,
  onOpenGenie,
}: {
  outstanding: Outstanding;
  totalOpen: number;
  onOpenGenie: () => void;
}) {
  const navigate = useNavigate();
  const nodes = buildHubNodes(outstanding);
  return (
    <div
      style={{
        position: "relative",
        width: HUB_SIZE,
        height: HUB_SIZE,
        margin: "8px auto 0",
      }}
    >
      <svg
        width={HUB_SIZE}
        height={HUB_SIZE}
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
        <circle
          cx={HUB_CENTER}
          cy={HUB_CENTER}
          r={HUB_RADIUS}
          fill="none"
          stroke="var(--db-gray-lines)"
          strokeWidth="1.5"
          strokeDasharray="3 7"
          opacity="0.8"
        />
        {nodes.map((n, i) => (
          <line
            key={i}
            x1={HUB_CENTER}
            y1={HUB_CENTER}
            x2={n.x}
            y2={n.y}
            stroke="var(--db-gray-lines)"
            strokeWidth="1.5"
          />
        ))}
      </svg>

      {/* Center — Ask Genie */}
      <button
        type="button"
        onClick={onOpenGenie}
        className="hb-hub"
        style={{
          position: "absolute",
          left: HUB_CENTER,
          top: HUB_CENTER,
          transform: "translate(-50%, -50%)",
          width: CENTER_SIZE,
          height: CENTER_SIZE,
          borderRadius: 999,
          background: "var(--db-navy-900)",
          border: "5px solid var(--db-oat-light)",
          boxShadow: "var(--shadow-lg)",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 7,
          color: "#fff",
          textAlign: "center",
          padding: 10,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 11,
            background: "var(--db-lava-600)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="spark" size={22} color="#fff" />
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}>
          Ask Genie
        </div>
        <div style={{ fontSize: 10.5, color: "var(--db-navy-400)", lineHeight: 1.3 }}>
          {totalOpen > 0
            ? `${totalOpen} ${totalOpen === 1 ? "item needs" : "items need"} you`
            : "All caught up"}
        </div>
      </button>

      {/* Module nodes */}
      {nodes.map(({ m, count, done, lv, x, y }) => (
        <button
          key={m.id}
          type="button"
          onClick={() => navigate(MODULE_ROUTE[m.id])}
          className="hb-node"
          style={{
            position: "absolute",
            left: x,
            top: y,
            transform: "translate(-50%, -50%)",
            width: NODE_SIZE,
            height: NODE_SIZE,
            borderRadius: 999,
            background: "#fff",
            border: done
              ? "1px solid var(--db-gray-lines)"
              : `2px solid ${lv.dot}`,
            boxShadow: "var(--shadow-sm)",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            padding: 14,
            textAlign: "center",
          }}
        >
          {done ? (
            <span style={{ position: "absolute", top: 16, right: 20, display: "flex" }}>
              <Icon name="check" size={15} color="var(--db-green-600)" stroke={2.4} />
            </span>
          ) : (
            <span
              style={{
                position: "absolute",
                top: 14,
                right: 18,
                minWidth: 22,
                height: 22,
                padding: "0 6px",
                borderRadius: 999,
                background: lv.bg,
                color: lv.fg,
                fontSize: 11,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {count > 99 ? "99+" : count}
            </span>
          )}
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: lv.bg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name={m.icon} size={22} color={lv.fg} />
          </div>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              color: "var(--db-navy-800)",
              letterSpacing: "-0.01em",
              lineHeight: 1.1,
            }}
          >
            {m.name}
          </div>
          <div
            style={{
              fontSize: 10.5,
              color: "var(--db-gray-text)",
              lineHeight: 1.25,
              maxWidth: 118,
            }}
          >
            {m.signal(count)}
          </div>
        </button>
      ))}
    </div>
  );
}

export default function TodayView() {
  const navigate = useNavigate();
  const { openPanel } = useGeniePanel();
  const { data, isLoading } = useApi<TodayBrief>(["today-brief"], "/today/brief");

  if (isLoading || !data) {
    return <TodaySkeleton />;
  }

  const { outstanding, first_action, yesterday_revenue, today_forecast } = data;
  const yesterdayUp = data.yesterday_delta_pct >= 0;
  const chips = CHIP_ORDER.map((id) => ({
    id,
    label: CHIP_LABEL[id](outstanding[id]),
  })).filter((c): c is { id: Module; label: string } => c.label !== null);
  const totalOpen = chips.length;
  const dateLabel = formatAnchorDate();

  return (
    <div style={{ maxWidth: 1120, margin: "0 auto" }}>
      {/* ===== AI hero (Genie · your daily brief) ===== */}
      <div
        style={{
          background: "var(--db-navy-900)",
          borderRadius: 18,
          padding: "30px 34px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width="340"
          height="340"
          fill="none"
          stroke="var(--db-navy-700)"
          strokeWidth="0.45"
          style={{ position: "absolute", right: -50, top: -70, opacity: 0.55 }}
        >
          <path d={PATHS.spark} />
        </svg>

        <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: "var(--db-lava-600)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="spark" size={17} color="#fff" />
          </div>
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 500,
              color: "var(--db-lava-400)",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            Genie · your daily brief
          </span>
          <span
            style={{
              marginLeft: "auto",
              fontSize: 12,
              color: "var(--db-navy-400)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {dateLabel}
          </span>
        </div>

        <p
          style={{
            fontSize: 22.5,
            lineHeight: 1.5,
            color: "#fff",
            fontWeight: 400,
            margin: "16px 0 0",
            maxWidth: 760,
            letterSpacing: "-0.01em",
            position: "relative",
          }}
        >
          {totalOpen > 0 ? (
            <>
              Morning, {STORE_MANAGER}. Yesterday closed at{" "}
              <strong style={{ fontWeight: 600 }}>{fmtMoney(yesterday_revenue)}</strong>,{" "}
              <span
                style={{
                  color: yesterdayUp ? "var(--db-green-400)" : "var(--db-lava-400)",
                  fontWeight: 600,
                }}
              >
                {yesterdayUp ? "up" : "down"} {pctStr(Math.abs(data.yesterday_delta_pct))}
              </span>
              . Today's forecast is{" "}
              <strong style={{ fontWeight: 600 }}>{fmtMoney(today_forecast)}</strong>. The
              one to handle first:{" "}
              <span style={{ color: "var(--db-lava-400)", fontWeight: 600 }}>
                {first_action.label}
              </span>
              . You've got <strong style={{ fontWeight: 600 }}>{totalOpen}</strong>{" "}
              {totalOpen === 1 ? "thing" : "things"} waiting below.
            </>
          ) : (
            <>
              Nice work, {STORE_MANAGER}:{" "}
              <span style={{ color: "var(--db-green-400)", fontWeight: 600 }}>
                you're all caught up
              </span>
              . Forecast still says{" "}
              <strong style={{ fontWeight: 600 }}>{fmtMoney(today_forecast)}</strong> today.
              Go run the floor.
            </>
          )}
        </p>

        {totalOpen > 0 && (
          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 24,
              flexWrap: "wrap",
              position: "relative",
            }}
          >
            {chips.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => navigate(MODULE_ROUTE[c.id])}
                className="hb-chip-action"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  color: "#fff",
                  border: "1px solid var(--db-navy-700)",
                  padding: "9px 15px",
                  borderRadius: 999,
                  font: "500 13px/1 var(--font-sans)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {c.id === "equipment" && (
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 999,
                      background: "var(--db-lava-500)",
                    }}
                  />
                )}
                {c.label}
                <Icon name="arrow" size={13} color="var(--db-navy-300)" />
              </button>
            ))}
          </div>
        )}

        <div
          onClick={openPanel}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openPanel();
            }
          }}
          style={{
            marginTop: 22,
            background: "var(--db-navy-800)",
            border: "1px solid var(--db-navy-700)",
            borderRadius: 12,
            padding: "6px 6px 6px 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            position: "relative",
            maxWidth: 760,
            cursor: "pointer",
          }}
        >
          <Icon name="spark" size={16} color="var(--db-navy-400)" />
          <span style={{ flex: 1, fontSize: 14, color: "var(--db-navy-400)" }}>
            Ask anything about your store…
          </span>
          <Btn variant="primary" size="sm" onClick={openPanel} style={{ padding: "8px 11px" }}>
            <Icon name="arrow" size={15} color="#fff" />
          </Btn>
        </div>
      </div>

      {/* ===== Radial module hub ===== */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginTop: 30,
        }}
      >
        <h2
          style={{
            fontSize: 16,
            fontWeight: 500,
            color: "var(--db-navy-800)",
            margin: "0 0 4px",
          }}
        >
          Jump into a module
        </h2>
        <p style={{ fontSize: 13, color: "var(--db-gray-text)", margin: 0 }}>
          Five spokes, one console — Genie sits at the center.
        </p>
      </div>
      <RadialHub
        outstanding={outstanding}
        totalOpen={totalOpen}
        onOpenGenie={openPanel}
      />
    </div>
  );
}

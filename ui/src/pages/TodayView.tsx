// ui/src/pages/TodayView.tsx
//
// Phase 5 Today view: Genie-first home that mirrors the design's
// `home.jsx` spotlight variant. Renders a 5-card KPI strip, a navy hero
// card with the daily brief + action chips + Ask bar, and a 5-card
// "Jump into a module" rail. Data comes from /api/today/brief, which the
// Sidebar also consumes for nav badges.
import { useNavigate } from "react-router-dom";

import { Card, Delta, Icon, LEVEL, PATHS, Spark } from "@/components/db";
import type { IconName, PillLevel } from "@/components/db";
import { useApi } from "@/lib/api";
import { useGeniePanel } from "@/state/genie-panel";

type KPI = {
  label: string;
  value: string;
  delta?: string | null;
  sub?: string | null;
  up?: boolean | null;
  spark: number[];
  color: string;
};

type Outstanding = {
  labor: number;
  inventory: number;
  equipment: number;
  members: number;
  feedback: number;
};

type FirstAction = {
  module: string;
  label: string;
};

export type TodayBrief = {
  yesterday_revenue: number;
  yesterday_delta_pct: number;
  today_forecast: number;
  kpis: KPI[];
  outstanding: Outstanding;
  first_action: FirstAction;
};

const KPI_COLORS: Record<string, string> = {
  lava: "var(--db-lava-600)",
  blue: "var(--db-blue-600)",
  green: "var(--db-green-600)",
  yellow: "var(--db-yellow-600)",
  navy: "var(--db-navy-600)",
};

type Module = "labor" | "inventory" | "equipment" | "members" | "feedback";

const CHIP_LABEL: Record<Module, (n: number) => string | null> = {
  equipment: (n) => (n ? "Schedule cooler service" : null),
  labor: (n) => (n ? `Approve ${n} timecard${n > 1 ? "s" : ""}` : null),
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
    signal: (n) => (n ? `${n} timecards to approve` : "All approved"),
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
  // The aggregator anchors on demo_anchor_date (2025-10-30 today). Keeping
  // the display in sync with the back-end window matters more than the wall
  // clock for the spotlight prose.
  const d = new Date(2025, 9, 30); // Oct 30 2025
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function pctStr(p: number): string {
  return `${(p * 100 >= 0 ? "+" : "") + (p * 100).toFixed(1)}%`;
}

function TodaySkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 96,
              borderRadius: 12,
              background: "var(--db-oat-medium)",
              border: "1px solid var(--db-gray-lines)",
            }}
          />
        ))}
      </div>
      <div
        style={{
          height: 240,
          borderRadius: 18,
          background: "var(--db-navy-900)",
          opacity: 0.55,
        }}
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 120,
              borderRadius: 12,
              background: "var(--db-oat-medium)",
              border: "1px solid var(--db-gray-lines)",
            }}
          />
        ))}
      </div>
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

  const { kpis, outstanding, first_action, yesterday_revenue, today_forecast } = data;
  const yesterdayUp = data.yesterday_delta_pct >= 0;
  const chips = CHIP_ORDER.map((id) => ({
    id,
    label: CHIP_LABEL[id](outstanding[id]),
  })).filter((c): c is { id: Module; label: string } => c.label !== null);
  const totalOpen = chips.length;
  const dateLabel = formatAnchorDate();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {/* ===== KPI strip ===== */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
        {kpis.map((k) => {
          const color = KPI_COLORS[k.color] ?? "var(--db-lava-600)";
          return (
            <Card key={k.label} pad="14px 16px">
              <div
                style={{
                  fontSize: 11,
                  color: "var(--db-gray-text)",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {k.label}
              </div>
              <div
                style={{
                  fontSize: 25,
                  fontWeight: 600,
                  color: "var(--db-navy-800)",
                  letterSpacing: "-0.02em",
                  margin: "5px 0 4px",
                }}
              >
                {k.value}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  gap: 6,
                }}
              >
                {k.delta ? (
                  <Delta up={Boolean(k.up)} size={11.5}>
                    {k.delta}
                  </Delta>
                ) : (
                  <span style={{ fontSize: 11.5, color: "var(--db-gray-text)" }}>
                    {k.sub ?? ""}
                  </span>
                )}
                <Spark pts={k.spark} color={color} w={62} h={24} />
              </div>
            </Card>
          );
        })}
      </div>

      {/* ===== Genie hero ===== */}
      <div
        style={{
          background: "var(--db-navy-900)",
          borderRadius: 18,
          padding: "30px 34px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative spark SVG; matches the design's hero motif */}
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
        {/* Lava accent stripe down the left edge */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 24,
            bottom: 24,
            width: 3,
            background: "var(--db-lava-600)",
            borderRadius: 3,
          }}
        />
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
              <strong style={{ fontWeight: 600 }}>
                ${yesterday_revenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </strong>
              ,{" "}
              <span style={{ color: yesterdayUp ? "var(--db-green-400)" : "var(--db-lava-400)", fontWeight: 600 }}>
                {yesterdayUp ? "up" : "down"} {pctStr(Math.abs(data.yesterday_delta_pct))}
              </span>
              . Today's forecast is{" "}
              <strong style={{ fontWeight: 600 }}>
                ${today_forecast.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </strong>
              . The one to handle first:{" "}
              <span style={{ color: "var(--db-lava-400)", fontWeight: 600 }}>
                {first_action.label}
              </span>
              . You've got{" "}
              <strong style={{ fontWeight: 600 }}>{totalOpen}</strong>{" "}
              {totalOpen === 1 ? "thing" : "things"} waiting below.
            </>
          ) : (
            <>
              Nice work, {STORE_MANAGER}:{" "}
              <span style={{ color: "var(--db-green-400)", fontWeight: 600 }}>
                you're all caught up
              </span>
              . Forecast says{" "}
              <strong style={{ fontWeight: 600 }}>
                ${today_forecast.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </strong>{" "}
              today. Go run the floor.
            </>
          )}
        </p>

        {/* Action chips for each open module */}
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

        {/* Ask bar — opens the global Genie slide-over */}
        <button
          type="button"
          onClick={openPanel}
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
            width: "100%",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <Icon name="spark" size={16} color="var(--db-navy-400)" />
          <span style={{ flex: 1, fontSize: 14, color: "var(--db-navy-400)" }}>
            Ask anything about your store…
          </span>
          <span
            style={{
              background: "var(--db-lava-600)",
              padding: "8px 11px",
              borderRadius: 8,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="arrow" size={15} color="#fff" />
          </span>
        </button>
      </div>

      {/* ===== Module rail ===== */}
      <div>
        <h2
          style={{
            fontSize: 16,
            fontWeight: 500,
            color: "var(--db-navy-800)",
            margin: "6px 0 14px",
          }}
        >
          Jump into a module
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
          {MODULES.map((m) => {
            const n = outstanding[m.id];
            const done = !n;
            const lv = done ? LEVEL.ok : LEVEL[m.level];
            return (
              <Card
                key={m.id}
                hover
                pad={16}
                onClick={() => navigate(MODULE_ROUTE[m.id])}
                style={{
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 9,
                      background: lv.bg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name={m.icon} size={18} color={lv.fg} />
                  </div>
                  {done ? (
                    <Icon name="check" size={16} color="var(--db-green-600)" stroke={2.2} />
                  ) : (
                    <span
                      style={{
                        minWidth: 22,
                        height: 22,
                        padding: "0 7px",
                        borderRadius: 999,
                        background: lv.dot,
                        color: "#fff",
                        fontSize: 11,
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {n > 99 ? "99+" : n}
                    </span>
                  )}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 13.5,
                      fontWeight: 500,
                      color: "var(--db-navy-800)",
                    }}
                  >
                    {m.name}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--db-gray-text)",
                      marginTop: 3,
                      lineHeight: 1.4,
                    }}
                  >
                    {m.signal(n)}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

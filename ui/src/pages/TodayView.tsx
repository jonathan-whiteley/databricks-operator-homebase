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

import { Btn, Card, Icon, LEVEL, PATHS } from "@/components/db";
import type { IconName, PillLevel } from "@/components/db";
import { useApi } from "@/lib/api";
import { useGeniePanel } from "@/state/genie-panel";
import { useStoreId } from "@/state/store";

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

function ModuleRow({ outstanding }: { outstanding: Outstanding }) {
  const navigate = useNavigate();
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        gap: 12,
        marginTop: 14,
      }}
    >
      {MODULES.map((m) => {
        const count = outstanding[m.id] ?? 0;
        const done = count === 0;
        const lv = done ? LEVEL.ok : LEVEL[m.level];
        return (
          <Card
            key={m.id}
            hover
            pad={16}
            onClick={() => navigate(MODULE_ROUTE[m.id])}
            style={{ cursor: "pointer", display: "flex", flexDirection: "column", gap: 10 }}
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
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: lv.dot,
                  }}
                />
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
                {m.signal(count)}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}


export default function TodayView() {
  const navigate = useNavigate();
  const { openPanel } = useGeniePanel();
  const [storeId] = useStoreId();
  const { data, isLoading } = useApi<TodayBrief>(
    ["today-brief", storeId],
    "/today/brief",
    { store_id: storeId },
  );

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

      {/* ===== Module row ===== */}
      <div style={{ display: "flex", alignItems: "center", marginTop: 28 }}>
        <h2
          style={{
            fontSize: 16,
            fontWeight: 500,
            color: "var(--db-navy-800)",
            margin: 0,
          }}
        >
          Jump into a module
        </h2>
      </div>
      <ModuleRow outstanding={outstanding} />
    </div>
  );
}

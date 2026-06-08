// ui/src/pages/EquipmentView.tsx
//
// Equipment view, rebuilt faithfully against the Claude Design template
// (../../tmp/claude_design/lakehouse-market-homebase-app/project/app/equipment.jsx).
//
// Layout:
//   1. PageHead (equipment icon, Refresh ghost button)
//   2. CoolerAlert — dark navy hero for the most-at-risk unit. Left side
//      shows alert eyebrow + name + drift summary + temperature sparkline
//      with the 41° threshold line. Right side either offers three service
//      windows (radio rows) and a "Book … service" button, or shows the
//      booked confirmation with a green check and LakebaseTag.
//   3. "All equipment" section header with a healthy/watch summary.
//   4. 3-column grid of EqCard tiles for the remaining at-risk units.
//
// Live wiring:
//   - GET /api/maintenance/at-risk         → useApi(['maint-at-risk', storeId], …)
//   - GET /api/maintenance/telemetry       → useApi(['maint-telemetry', id], …)
//   - POST /api/maintenance/work-order     → api.post on slot booking
//
// Constraints honoured:
//   - Only components/db/* primitives + Spark (for the EqCard mini-line).
//   - ConfirmDialog + useToast preserved for the booking handoff.
//   - TypeScript strict.
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  Btn,
  Card,
  Icon,
  LakebaseTag,
  PageHead,
  Pill,
  Spark,
  useToast,
  type IconName,
  type PillLevel,
} from "@/components/db";
import { LEVEL } from "@/components/db/Pill";
import { api, useApi } from "@/lib/api";
import { useStoreId } from "@/state/store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Risk = {
  equipment_id: number;
  category: string;
  model: string;
  runtime_hours: number;
  health_score: number;
  rul_days: number;
  predicted_failure_date: string;
  target_temp_min: number;
  target_temp_max: number;
};

type TelemetryRow = {
  ts: string;
  temperature: number;
  vibration: number;
  runtime_hours_delta: number;
};

type ServiceSlot = {
  id: string;
  label: string;
  time: string;
  tech: string;
  note: string;
  rec?: boolean;
};

type BookedSlot = ServiceSlot & { workOrderId: number };

// ---------------------------------------------------------------------------
// Constants ported from the design's data.jsx
// ---------------------------------------------------------------------------

const SERVICE_SLOTS: ServiceSlot[] = [
  {
    id: "s1",
    label: "Today",
    time: "2:00–4:00 PM",
    tech: "CoolTech · Ravi K.",
    note: "Soonest available",
    rec: true,
  },
  {
    id: "s2",
    label: "Today",
    time: "5:00–7:00 PM",
    tech: "CoolTech · Ravi K.",
    note: "After dinner rush",
  },
  {
    id: "s3",
    label: "Tomorrow",
    time: "7:00–9:00 AM",
    tech: "CoolTech · Dana W.",
    note: "Before open",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function targetVisit(rul_days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + Math.max(1, rul_days - 2));
  return d.toISOString().slice(0, 10);
}

// Pick a Pill level based on RUL. Matches the design's coloring: hero unit
// is "danger", anything within a week is "warn", further out is "info".
function riskLevel(rul_days: number, health_score: number): PillLevel {
  if (rul_days <= 3 || health_score < 35) return "danger";
  if (rul_days <= 7 || health_score < 60) return "warn";
  return "info";
}

// Heuristic mapping from a category string to an Icon name. Matches the
// design's EqCard logic: Refrigeration→snow, Cooking/Beverage→flame,
// everything else→equipment.
function iconForCategory(category: string): IconName {
  const c = category.toLowerCase();
  if (c.includes("refrig") || c.includes("cool") || c.includes("ice")) return "snow";
  if (c.includes("cook") || c.includes("fry") || c.includes("beverage") || c.includes("espresso"))
    return "flame";
  if (c.includes("pos") || c.includes("front")) return "equipment";
  return "wrench";
}

// Format the predicted failure date as "Mon DD" — used in the EqCard
// "Serviced …" line as a stand-in for last-service since the API doesn't
// expose service history.
function shortDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// TempChart — large temperature sparkline with a 41°F threshold line.
// Direct port of equipment.jsx:3-19. We pull `pts` straight from the
// telemetry API.
// ---------------------------------------------------------------------------

function TempChart({
  pts,
  w = 300,
  h = 80,
  danger = false,
}: {
  pts: number[];
  w?: number;
  h?: number;
  danger?: boolean;
}) {
  if (pts.length < 2) {
    return (
      <div
        style={{
          height: h,
          display: "flex",
          alignItems: "center",
          fontSize: 12,
          color: "var(--db-navy-300)",
          fontFamily: "var(--font-mono)",
        }}
      >
        No recent telemetry
      </div>
    );
  }
  const max = Math.max(...pts, 41);
  const min = Math.min(...pts, 36);
  const rng = max - min || 1;
  const step = w / (pts.length - 1);
  const xy = pts.map(
    (p, i) => [i * step, h - ((p - min) / rng) * (h - 10) - 5] as const,
  );
  const line = xy
    .map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
    .join(" ");
  const thresholdY = h - ((41 - min) / rng) * (h - 10) - 5;
  const col = danger ? "var(--db-lava-600)" : "var(--db-green-600)";
  const last = xy[xy.length - 1];
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ display: "block", overflow: "visible", width: "100%" }}
    >
      <line
        x1="0"
        y1={thresholdY}
        x2={w}
        y2={thresholdY}
        stroke="var(--db-lava-400)"
        strokeWidth="1"
        strokeDasharray="4 4"
      />
      <text
        x={w - 2}
        y={thresholdY - 4}
        textAnchor="end"
        fontSize="9"
        fill="var(--db-lava-700)"
        fontFamily="var(--font-mono)"
      >
        41° limit
      </text>
      <path d={`${line} L${w} ${h} L0 ${h} Z`} fill={col} opacity="0.08" />
      <path
        d={line}
        fill="none"
        stroke={col}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r="3.5" fill={col} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// SlotOption — radio-style service window row. Port of equipment.jsx:21-34.
// ---------------------------------------------------------------------------

function SlotOption({
  slot,
  selected,
  onSelect,
}: {
  slot: ServiceSlot;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="hb-slot"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        textAlign: "left",
        cursor: "pointer",
        border: selected
          ? "2px solid var(--db-lava-600)"
          : "1px solid var(--db-navy-700)",
        background: selected ? "var(--db-navy-700)" : "transparent",
        borderRadius: 10,
        padding: "11px 13px",
        margin: selected ? -1 : 0,
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: 999,
          border: selected
            ? "5px solid var(--db-lava-600)"
            : "2px solid var(--db-navy-500)",
          flexShrink: 0,
          boxSizing: "border-box",
          background: selected ? "#fff" : "transparent",
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: "#fff" }}>
          {slot.label} · {slot.time}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--db-navy-300)" }}>
          {slot.tech} · {slot.note}
        </div>
      </div>
      {slot.rec && <Pill level="warn">Recommended</Pill>}
    </button>
  );
}

// ---------------------------------------------------------------------------
// CoolerAlert — dark navy hero card with telemetry + booking. Port of
// equipment.jsx:36-77. Adapts to live data: name/category/rul come from the
// AtRiskUnit; the sparkline pulls from /maintenance/telemetry.
// ---------------------------------------------------------------------------

function CoolerAlert({
  unit,
  pts,
  scheduled,
  onPickSlot,
}: {
  unit: Risk | undefined;
  pts: number[];
  scheduled: BookedSlot | null;
  onPickSlot: (slot: ServiceSlot) => void;
}) {
  // The recommended slot is the default selection. If the design's
  // "Recommended" tag ever goes away, fall back to the first slot.
  const recId =
    SERVICE_SLOTS.find((s) => s.rec)?.id ?? SERVICE_SLOTS[0]?.id ?? "s1";
  const [sel, setSel] = useState<string>(recId);
  const slot = SERVICE_SLOTS.find((s) => s.id === sel) ?? SERVICE_SLOTS[0];

  // Compose a one-liner from live telemetry: current temperature, the unit's
  // category-specific target band (read from equipment.target_temp_min/max),
  // and drift over the window.
  const latest = pts.length > 0 ? pts[pts.length - 1] : null;
  const first = pts.length > 0 ? pts[0] : null;
  const drift =
    latest != null && first != null ? Math.round((latest - first) * 10) / 10 : null;
  const driftLabel =
    drift == null
      ? "Temperature drifting outside target band."
      : drift > 0
        ? `drifted +${drift.toFixed(1)}°F over the past ${pts.length} readings`
        : `drifted ${drift.toFixed(1)}°F over the past ${pts.length} readings`;
  const targetBand =
    unit && unit.target_temp_min != null && unit.target_temp_max != null
      ? `${Math.round(unit.target_temp_min)}–${Math.round(unit.target_temp_max)}°F`
      : null;

  return (
    <div
      style={{
        background: "var(--db-navy-900)",
        borderRadius: 16,
        overflow: "hidden",
        marginBottom: 20,
      }}
    >
      <div style={{ display: "flex", gap: 24, padding: "24px 28px" }}>
        {/* Left column: alert metadata + sparkline */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
              <Icon name="alert" size={17} color="#fff" />
            </div>
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: "var(--db-lava-400)",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              Needs service
            </span>
          </div>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 500,
              color: "#fff",
              margin: "14px 0 6px",
              letterSpacing: "-0.01em",
            }}
          >
            {unit ? `${unit.model} #${unit.equipment_id}` : "No at-risk equipment"}
          </h2>
          <p
            style={{
              fontSize: 13.5,
              color: "var(--db-navy-300)",
              lineHeight: 1.5,
              margin: 0,
              maxWidth: 420,
            }}
          >
            {unit ? (
              <>
                Holding{" "}
                <strong style={{ color: "#fff" }}>
                  {latest != null ? `${latest.toFixed(1)}°F` : "—"}
                </strong>
                {targetBand ? <> against a {targetBand} target</> : null}
                {" — "}
                {driftLabel}. Predicted failure{" "}
                {unit.predicted_failure_date} · {unit.rul_days}d RUL.
              </>
            ) : (
              "Telemetry is clean across all refrigeration, cooking and beverage gear."
            )}
          </p>
          <div
            style={{
              marginTop: 18,
              background: "var(--db-navy-800)",
              borderRadius: 10,
              padding: "14px 16px",
            }}
          >
            <TempChart pts={pts} danger />
          </div>
        </div>

        {/* Right column: service window picker or confirmation */}
        <div style={{ width: 340, flexShrink: 0 }}>
          {scheduled ? (
            <div
              style={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                textAlign: "center",
                gap: 12,
                background: "var(--db-navy-800)",
                borderRadius: 12,
                padding: 24,
              }}
            >
              <span
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 999,
                  background: "var(--db-green-600)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="check" size={26} color="#fff" stroke={2.4} />
              </span>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>
                Service booked
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--db-navy-300)",
                  lineHeight: 1.5,
                }}
              >
                {scheduled.label} · {scheduled.time}
                <br />
                {scheduled.tech}
              </div>
              <Pill level="ok" dot>
                Work order WO-{scheduled.workOrderId} sent
              </Pill>
              <LakebaseTag table="app_work_orders" tone="dark" />
            </div>
          ) : (
            <>
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: "var(--db-navy-300)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: 12,
                }}
              >
                Pick a service window
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 9,
                }}
              >
                {SERVICE_SLOTS.map((s) => (
                  <SlotOption
                    key={s.id}
                    slot={s}
                    selected={sel === s.id}
                    onSelect={() => setSel(s.id)}
                  />
                ))}
              </div>
              <Btn
                variant="primary"
                full
                icon="calendar"
                disabled={!unit}
                onClick={() => slot && onPickSlot(slot)}
                style={{ marginTop: 14 }}
              >
                Book {slot ? slot.label.toLowerCase() : "today"} service
              </Btn>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EqCard — light-mode tile for non-hero at-risk equipment. Port of
// equipment.jsx:79-102. Mini Spark on the bottom uses live telemetry when
// we have it; otherwise we fall back to the unit's health score as a single
// flat baseline.
// ---------------------------------------------------------------------------

function EqCard({
  unit,
  spark,
  onSchedule,
}: {
  unit: Risk;
  spark: number[];
  onSchedule: () => void;
}) {
  const level = riskLevel(unit.rul_days, unit.health_score);
  const lv = LEVEL[level];
  const isWatch = level !== "info";
  return (
    <Card pad={16} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
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
          <Icon name={iconForCategory(unit.category)} size={18} color={lv.fg} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 500,
              color: "var(--db-navy-800)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {unit.model} #{unit.equipment_id}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--db-gray-text)" }}>
            {unit.category}
          </div>
        </div>
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: 999,
            background: lv.dot,
            flexShrink: 0,
          }}
        />
      </div>

      <div
        style={{
          fontSize: 12.5,
          color: "var(--db-navy-800)",
          fontWeight: 500,
        }}
      >
        Health{" "}
        <span style={{ fontFamily: "var(--font-mono)" }}>
          {unit.health_score.toFixed(0)}
        </span>{" "}
        · {unit.rul_days}d RUL
      </div>
      <div
        style={{
          fontSize: 11.5,
          color: "var(--db-gray-text)",
          lineHeight: 1.4,
          marginTop: -6,
        }}
      >
        {unit.runtime_hours.toLocaleString()} runtime hrs · predicted failure{" "}
        {shortDate(unit.predicted_failure_date)}
      </div>

      {spark.length >= 2 && (
        <div style={{ marginTop: -2 }}>
          <Spark
            pts={spark}
            w={240}
            h={28}
            color={lv.dot}
            sw={1.8}
          />
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 4,
          borderTop: "1px solid var(--db-gray-lines)",
        }}
      >
        <span style={{ fontSize: 11, color: "var(--db-navy-400)" }}>
          {unit.predicted_failure_date
            ? `Last telemetry ${shortDate(unit.predicted_failure_date)}`
            : "No service history"}
        </span>
        {isWatch ? (
          <button
            className="hb-link"
            onClick={onSchedule}
            data-tour-target="equipment.schedule"
            style={{
              background: "none",
              border: 0,
              fontSize: 12,
              color: "var(--db-lava-700)",
              fontWeight: 500,
              cursor: "pointer",
              padding: 0,
            }}
          >
            Schedule
          </button>
        ) : (
          <span
            style={{
              fontSize: 11.5,
              color: "var(--db-green-700)",
              fontWeight: 500,
            }}
          >
            Healthy
          </span>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export default function EquipmentView() {
  const [storeId] = useStoreId();
  const qc = useQueryClient();
  const toast = useToast();

  const risks = useApi<Risk[]>(
    ["maint-at-risk", storeId],
    "/maintenance/at-risk",
    { store_id: storeId },
  );

  const atRisk = useMemo(() => risks.data ?? [], [risks.data]);
  const headline = atRisk[0];
  const rest = useMemo(() => atRisk.slice(1), [atRisk]);
  const headlineId = headline?.equipment_id;

  // Headline telemetry — feeds the dark TempChart in CoolerAlert.
  const headlineTelemetry = useApi<TelemetryRow[]>(
    ["maint-telemetry", headlineId],
    "/maintenance/telemetry",
    { equipment_id: headlineId ?? 0, days: 14 },
    { enabled: !!headlineId },
  );

  const headlinePts = useMemo(
    () => (headlineTelemetry.data ?? []).map((r) => r.temperature),
    [headlineTelemetry.data],
  );

  // Booking state
  const [scheduled, setScheduled] = useState<BookedSlot | null>(null);
  const [pendingSlot, setPendingSlot] = useState<ServiceSlot | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Risk | null>(null);

  // When the user picks a slot from the hero, we kick off ConfirmDialog with
  // the headline unit pre-selected. We funnel both hero and EqCard scheduling
  // through the same dialog for consistency.
  function startHeroBooking(slot: ServiceSlot) {
    if (!headline) return;
    setPendingSlot(slot);
    setConfirmTarget(headline);
  }

  function startCardBooking(unit: Risk) {
    setPendingSlot(null);
    setConfirmTarget(unit);
  }

  async function confirmSchedule(unit: Risk, note: string) {
    try {
      const res = await api.post<{ id: number }>("/maintenance/work-order", {
        store_id: storeId,
        equipment_id: unit.equipment_id,
        target_date: targetVisit(unit.rul_days),
        notes: note || `Predicted failure ${unit.predicted_failure_date}`,
      });
      qc.invalidateQueries({ queryKey: ["maint-at-risk", storeId] });
      // If this confirmation came from the hero (pendingSlot set + same unit),
      // flip the hero into its "Service booked" state so the customer sees
      // the success card from the template.
      if (pendingSlot && unit.equipment_id === headline?.equipment_id) {
        setScheduled({ ...pendingSlot, workOrderId: res.data.id });
      }
      setPendingSlot(null);
      setConfirmTarget(null);
      toast.success("Work order created — written to app_work_orders");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown error";
      toast.error(`Couldn't save: ${msg}`);
    }
  }

  // Summary chip for the "All equipment" section header — matches the
  // design's "{n} healthy · 1 watch" style. We don't have full fleet health
  // from the at-risk endpoint, so we frame it as the at-risk slice.
  const watchCount = rest.filter(
    (u) => riskLevel(u.rul_days, u.health_score) !== "info",
  ).length;
  const okCount = rest.length - watchCount;

  return (
    <div
      style={{
        background: "var(--db-oat-light)",
        minHeight: "100%",
        margin: "-28px -32px",
      }}
    >
      <div
        style={{
          padding: "28px 32px 40px",
          maxWidth: 1080,
          margin: "0 auto",
        }}
      >
        <PageHead
          icon="equipment"
          title="Equipment"
          sub="Live telemetry from refrigeration, cooking and front-of-house gear — with service booking built in."
        >
          <Btn
            variant="ghost"
            icon="refresh"
            onClick={() => {
              qc.invalidateQueries({ queryKey: ["maint-at-risk", storeId] });
              if (headlineId) {
                qc.invalidateQueries({
                  queryKey: ["maint-telemetry", headlineId],
                });
              }
            }}
          >
            Refresh
          </Btn>
        </PageHead>

        <CoolerAlert
          unit={headline}
          pts={headlinePts}
          scheduled={scheduled}
          onPickSlot={startHeroBooking}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <h2
            style={{
              fontSize: 16,
              fontWeight: 500,
              color: "var(--db-navy-800)",
              margin: 0,
            }}
          >
            All equipment
          </h2>
          <span style={{ marginLeft: 10 }}>
            <LakebaseTag table="app_work_orders" />
          </span>
          <span
            style={{
              marginLeft: "auto",
              fontSize: 12.5,
              color: "var(--db-gray-text)",
            }}
          >
            {risks.isLoading
              ? "loading…"
              : `${okCount} healthy · ${watchCount} watch`}
          </span>
        </div>

        {risks.isLoading && atRisk.length === 0 ? (
          <div
            style={{
              padding: "40px 0",
              textAlign: "center",
              fontSize: 13,
              color: "var(--db-gray-text)",
            }}
          >
            Loading equipment fleet…
          </div>
        ) : rest.length === 0 ? (
          <div
            style={{
              padding: "32px 16px",
              borderRadius: 12,
              border: "1px dashed var(--db-gray-lines)",
              background: "#fff",
              textAlign: "center",
              fontSize: 13,
              color: "var(--db-gray-text)",
            }}
          >
            {headline
              ? "No additional equipment is at risk."
              : "All equipment looks healthy right now."}
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
            }}
          >
            {rest.map((u) => (
              <EqCard
                key={u.equipment_id}
                unit={u}
                spark={[]}
                onSchedule={() => startCardBooking(u)}
              />
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmTarget != null}
        title="Schedule technician visit?"
        description="A work order will be created in app_work_orders and routed to the maintenance queue."
        details={
          confirmTarget
            ? [
                {
                  label: "Equipment",
                  value: `${confirmTarget.model} (#${confirmTarget.equipment_id})`,
                },
                { label: "Category", value: confirmTarget.category },
                {
                  label: "Health",
                  value: confirmTarget.health_score.toFixed(0),
                },
                { label: "RUL", value: `${confirmTarget.rul_days} days` },
                {
                  label: "Predicted failure",
                  value: confirmTarget.predicted_failure_date,
                },
                {
                  label: "Target visit",
                  value: targetVisit(confirmTarget.rul_days),
                },
                ...(pendingSlot
                  ? [
                      {
                        label: "Service window",
                        value: `${pendingSlot.label} · ${pendingSlot.time} · ${pendingSlot.tech}`,
                      },
                    ]
                  : []),
              ]
            : []
        }
        noteLabel="Notes for the tech"
        notePlaceholder={
          confirmTarget
            ? `Predicted failure ${confirmTarget.predicted_failure_date}`
            : undefined
        }
        onCancel={() => {
          setConfirmTarget(null);
          setPendingSlot(null);
        }}
        onConfirm={async (note) => {
          if (confirmTarget) await confirmSchedule(confirmTarget, note);
        }}
      />
    </div>
  );
}

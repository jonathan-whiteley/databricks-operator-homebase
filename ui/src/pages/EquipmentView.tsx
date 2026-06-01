// ui/src/pages/EquipmentView.tsx
//
// Phase 8 of the Claude Design Homebase re-skin. Replaces MaintenancePage at
// the /equipment route. Built only from the `db/*` primitives plus the
// existing `ConfirmDialog`, `useToast`, and `useApi` plumbing.
//
// Layout: single column, max-width 1120px. Three sections:
//   1. AIRec callout for the headline at-risk unit (POSTs work-order)
//   2. At-risk equipment card — vertical rich rows, not a table
//   3. Telemetry detail card (collapsible; shown when a row is selected)
//   4. Work order kanban (3 columns, empty-state for the demo)
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  AIRec,
  Btn,
  Card,
  Eyebrow,
  Icon,
  LakebaseTag,
  PageHead,
  Pill,
  Spark,
  useToast,
  type PillLevel,
} from "@/components/db";
import { api, useApi } from "@/lib/api";
import { useStoreId } from "@/state/store";

// ---------------------------------------------------------------------------
// Types & helpers
// ---------------------------------------------------------------------------

type Risk = {
  equipment_id: number;
  category: string;
  model: string;
  runtime_hours: number;
  health_score: number;
  rul_days: number;
  predicted_failure_date: string;
};

type TelemetryRow = {
  ts: string;
  temperature: number;
  vibration: number;
  runtime_hours_delta: number;
};

function targetVisit(rul_days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + Math.max(1, rul_days - 2));
  return d.toISOString().slice(0, 10);
}

function rulLevel(rul_days: number): PillLevel {
  if (rul_days <= 3) return "danger";
  if (rul_days <= 7) return "warn";
  return "info";
}

function lastTelemetryLabel(predicted: string): string {
  // The predicted failure date is the only timestamp on the row; surface
  // something readable as the "last telemetry" hint.
  try {
    const d = new Date(predicted);
    if (!Number.isFinite(d.getTime())) return predicted;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return predicted;
  }
}

// ---------------------------------------------------------------------------
// At-risk row
// ---------------------------------------------------------------------------

function AtRiskRow({
  unit,
  selected,
  onSelect,
  onSchedule,
}: {
  unit: Risk;
  selected: boolean;
  onSelect: () => void;
  onSchedule: () => void;
}) {
  const level = rulLevel(unit.rul_days);
  return (
    <div
      onClick={onSelect}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 16px",
        borderRadius: 10,
        border: selected
          ? "1px solid var(--db-lava-600)"
          : "1px solid var(--db-gray-lines)",
        background: selected ? "var(--db-oat-light)" : "#fff",
        cursor: "pointer",
        transition: "all var(--dur-base) var(--ease-out)",
      }}
    >
      {/* Icon tile */}
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 9,
          background: "var(--db-oat-medium)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon name="wrench" size={19} color="var(--db-navy-700)" />
      </div>

      {/* Name + category + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 3,
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "var(--db-navy-800)",
            }}
          >
            {unit.model} #{unit.equipment_id}
          </span>
          <Pill level="neutral">{unit.category}</Pill>
        </div>
        <div style={{ fontSize: 12, color: "var(--db-gray-text)" }}>
          {unit.runtime_hours.toLocaleString()} runtime hrs · last telemetry{" "}
          {lastTelemetryLabel(unit.predicted_failure_date)}
        </div>
      </div>

      {/* Health score */}
      <div
        style={{
          textAlign: "right",
          minWidth: 70,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 22,
            fontWeight: 500,
            color: "var(--db-navy-800)",
            lineHeight: 1,
          }}
        >
          {unit.health_score.toFixed(0)}
        </div>
        <div
          style={{
            fontSize: 10.5,
            color: "var(--db-gray-text)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginTop: 4,
          }}
        >
          health
        </div>
      </div>

      {/* RUL pill */}
      <div style={{ minWidth: 84, flexShrink: 0, textAlign: "center" }}>
        <Pill level={level} dot>
          {unit.rul_days}d RUL
        </Pill>
      </div>

      {/* Action */}
      <Btn
        variant="primary"
        size="sm"
        onClick={() => {
          // Don't bubble the click into the row's onSelect — picking a service
          // window is its own intent.
          onSchedule();
        }}
        style={{ flexShrink: 0 }}
      >
        Schedule service
      </Btn>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Telemetry detail card
// ---------------------------------------------------------------------------

function TelemetryDetail({
  unit,
  data,
  loading,
  onClose,
}: {
  unit: Risk;
  data: TelemetryRow[] | undefined;
  loading: boolean;
  onClose: () => void;
}) {
  const temperaturePts = (data ?? []).map((r) => r.temperature);
  const vibrationPts = (data ?? []).map((r) => r.vibration);
  const runtimePts = (data ?? []).map((r) => r.runtime_hours_delta);
  const empty = !loading && temperaturePts.length < 2;
  return (
    <Card pad={20} style={{ marginBottom: 20 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          marginBottom: 16,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <Eyebrow>Telemetry · last 14 days</Eyebrow>
          <h3
            style={{
              fontSize: 16,
              fontWeight: 500,
              color: "var(--db-navy-800)",
              margin: "6px 0 0",
            }}
          >
            {unit.model} #{unit.equipment_id}
          </h3>
        </div>
        <Btn variant="quiet" size="sm" icon="x" onClick={onClose}>
          Close
        </Btn>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
        }}
      >
        <SparkTile
          label="Temperature"
          pts={temperaturePts}
          color="var(--db-lava-600)"
          loading={loading}
          empty={empty}
          unit="°F"
        />
        <SparkTile
          label="Vibration"
          pts={vibrationPts}
          color="var(--db-yellow-600)"
          loading={loading}
          empty={empty}
          unit="g"
        />
        <SparkTile
          label="Runtime hrs"
          pts={runtimePts}
          color="var(--db-blue-600)"
          loading={loading}
          empty={empty}
          unit="hrs"
        />
      </div>
    </Card>
  );
}

function SparkTile({
  label,
  pts,
  color,
  loading,
  empty,
  unit,
}: {
  label: string;
  pts: number[];
  color: string;
  loading: boolean;
  empty: boolean;
  unit: string;
}) {
  const latest = pts.length > 0 ? pts[pts.length - 1] : undefined;
  return (
    <div
      style={{
        background: "var(--db-oat-light)",
        borderRadius: 10,
        padding: "14px 16px",
      }}
    >
      <Eyebrow>{label}</Eyebrow>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 18,
          fontWeight: 500,
          color: "var(--db-navy-800)",
          margin: "6px 0 8px",
        }}
      >
        {latest != null ? `${latest.toFixed(1)} ${unit}` : "—"}
      </div>
      <div style={{ height: 44 }}>
        {loading ? (
          <div
            style={{
              fontSize: 11.5,
              color: "var(--db-gray-text)",
              paddingTop: 12,
            }}
          >
            Loading…
          </div>
        ) : empty ? (
          <div
            style={{
              fontSize: 11.5,
              color: "var(--db-gray-text)",
              paddingTop: 12,
            }}
          >
            No recent telemetry
          </div>
        ) : (
          <Spark pts={pts} w={240} h={44} color={color} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Work order kanban (empty-state placeholder for the demo)
// ---------------------------------------------------------------------------

const KANBAN_COLUMNS: { key: string; title: string; level: PillLevel }[] = [
  { key: "open", title: "Open", level: "info" },
  { key: "in_progress", title: "In progress", level: "warn" },
  { key: "done", title: "Done", level: "ok" },
];

function WorkOrderKanban() {
  return (
    <section>
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
          Work orders today
        </h2>
        <span
          style={{
            marginLeft: 10,
            fontSize: 12.5,
            color: "var(--db-gray-text)",
          }}
        >
          new orders appear in <em>Open</em> as you schedule service
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
        }}
      >
        {KANBAN_COLUMNS.map((col) => (
          <Card key={col.key} pad={16}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 12,
              }}
            >
              <Pill level={col.level} dot>
                {col.title}
              </Pill>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--db-gray-text)",
                }}
              >
                0
              </span>
            </div>
            <div
              style={{
                border: "1px dashed var(--db-gray-lines)",
                borderRadius: 9,
                padding: "22px 14px",
                textAlign: "center",
                fontSize: 12.5,
                color: "var(--db-gray-text)",
                lineHeight: 1.5,
              }}
            >
              No {col.title.toLowerCase()} orders.
            </div>
          </Card>
        ))}
      </div>
    </section>
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

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<Risk | null>(null);

  const telemetry = useApi<TelemetryRow[]>(
    ["maint-telemetry", selectedId],
    "/maintenance/telemetry",
    { equipment_id: selectedId ?? 0, days: 14 },
    { enabled: selectedId != null },
  );

  const atRisk = risks.data ?? [];
  const headline = atRisk[0];
  const selectedUnit = useMemo(
    () => atRisk.find((r) => r.equipment_id === selectedId) ?? null,
    [atRisk, selectedId],
  );

  async function confirmSchedule(unit: Risk, note: string) {
    try {
      await api.post("/maintenance/work-order", {
        store_id: storeId,
        equipment_id: unit.equipment_id,
        target_date: targetVisit(unit.rul_days),
        notes: note || `Predicted failure ${unit.predicted_failure_date}`,
      });
      qc.invalidateQueries({ queryKey: ["maint-at-risk", storeId] });
      setConfirming(null);
      toast.success("Work order created — written to app_work_orders");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown error";
      toast.error(`Couldn't save: ${msg}`);
    }
  }

  return (
    <div
      style={{
        flex: 1,
        background: "var(--db-oat-light)",
        margin: "-28px -32px",
      }}
    >
      <div
        style={{
          padding: "28px 32px 40px",
          maxWidth: 1120,
          margin: "0 auto",
        }}
      >
        <PageHead
          icon="equipment"
          title="Equipment"
          sub="At-risk units, telemetry, and service scheduling."
        />

        {/* AI recommendation banner */}
        <div style={{ marginBottom: 20 }}>
          <AIRec
            tone="navy"
            action="Schedule cooler service"
            onAction={() => {
              if (headline) setConfirming(headline);
            }}
          >
            Cooler #2 is drifting warm (+4°F since Monday). Book service before
            the weekend to avoid spoilage.
          </AIRec>
        </div>

        {/* At-risk equipment list */}
        <Card pad={20} style={{ marginBottom: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 500,
                  color: "var(--db-navy-800)",
                  margin: 0,
                }}
              >
                At-risk this week
              </h2>
              <div style={{ marginTop: 4 }}>
                <LakebaseTag table="app_work_orders" />
              </div>
            </div>
            <span
              style={{
                marginLeft: "auto",
                fontSize: 12.5,
                color: "var(--db-gray-text)",
              }}
            >
              {risks.isLoading
                ? "loading…"
                : `${atRisk.length} unit${atRisk.length === 1 ? "" : "s"}`}
            </span>
          </div>

          {risks.isLoading && atRisk.length === 0 ? (
            <div
              style={{
                padding: "32px 0",
                textAlign: "center",
                fontSize: 13,
                color: "var(--db-gray-text)",
              }}
            >
              Loading at-risk units…
            </div>
          ) : atRisk.length === 0 ? (
            <div
              style={{
                padding: "32px 0",
                textAlign: "center",
                fontSize: 13,
                color: "var(--db-gray-text)",
              }}
            >
              No equipment is at risk right now.
            </div>
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", gap: 10 }}
            >
              {atRisk.map((unit) => (
                <AtRiskRow
                  key={unit.equipment_id}
                  unit={unit}
                  selected={selectedId === unit.equipment_id}
                  onSelect={() =>
                    setSelectedId((prev) =>
                      prev === unit.equipment_id ? null : unit.equipment_id,
                    )
                  }
                  onSchedule={() => setConfirming(unit)}
                />
              ))}
            </div>
          )}
        </Card>

        {/* Telemetry detail — only when a row is selected */}
        {selectedUnit && (
          <TelemetryDetail
            unit={selectedUnit}
            data={telemetry.data}
            loading={telemetry.isLoading}
            onClose={() => setSelectedId(null)}
          />
        )}

        {/* Work order kanban */}
        <WorkOrderKanban />
      </div>

      <ConfirmDialog
        open={confirming != null}
        title="Schedule technician visit?"
        description="A work order will be created in app_work_orders and routed to the maintenance queue."
        details={
          confirming
            ? [
                {
                  label: "Equipment",
                  value: `${confirming.model} (#${confirming.equipment_id})`,
                },
                { label: "Category", value: confirming.category },
                { label: "Health", value: confirming.health_score.toFixed(0) },
                { label: "RUL", value: `${confirming.rul_days} days` },
                {
                  label: "Predicted failure",
                  value: confirming.predicted_failure_date,
                },
                {
                  label: "Target visit",
                  value: targetVisit(confirming.rul_days),
                },
              ]
            : []
        }
        noteLabel="Notes for the tech"
        notePlaceholder={
          confirming
            ? `Predicted failure ${confirming.predicted_failure_date}`
            : undefined
        }
        onCancel={() => setConfirming(null)}
        onConfirm={async (note) => {
          if (confirming) await confirmSchedule(confirming, note);
        }}
      />
    </div>
  );
}

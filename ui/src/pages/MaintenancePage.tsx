// ui/src/pages/MaintenancePage.tsx
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataTable } from "@/components/DataTable";
import { GenieChat } from "@/components/GenieChat";
import { KPIRing } from "@/components/KPIRing";
import { MetricCard } from "@/components/MetricCard";
import { Sparkline } from "@/components/Sparkline";
import { useToast } from "@/components/Toast";
import { api, useApi } from "@/lib/api";
import { useStoreId } from "@/state/store";

function targetVisit(rul_days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + Math.max(1, rul_days - 2));
  return d.toISOString().slice(0, 10);
}

type Risk = {
  equipment_id: number;
  category: string;
  model: string;
  runtime_hours: number;
  health_score: number;
  rul_days: number;
  predicted_failure_date: string;
};

export default function MaintenancePage() {
  const [storeId] = useStoreId();
  const qc = useQueryClient();
  const toast = useToast();
  const risks = useApi<Risk[]>(["maint-at-risk", storeId], "/maintenance/at-risk", { store_id: storeId });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<Risk | null>(null);
  const telemetry = useApi<
    { ts: string; temperature: number; vibration: number; runtime_hours_delta: number }[]
  >(
    ["maint-telemetry", selectedId],
    "/maintenance/telemetry",
    { equipment_id: selectedId ?? 0, days: 14 },
    { enabled: selectedId != null },
  );

  async function confirmSchedule(e: Risk, note: string) {
    try {
      await api.post("/maintenance/work-order", {
        store_id: storeId,
        equipment_id: e.equipment_id,
        target_date: targetVisit(e.rul_days),
        notes: note || `Predicted failure ${e.predicted_failure_date}`,
      });
      qc.invalidateQueries({ queryKey: ["maint-at-risk", storeId] });
      setConfirming(null);
      toast.success("Work order created — written to app_work_orders");
    } catch (err: any) {
      toast.error(`Couldn't save: ${err?.message ?? "unknown error"}`);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-[color:var(--color-ink)]">Predictive Maintenance</h1>
        <div className="grid grid-cols-4 gap-3">
          <MetricCard label="Equipment online %" value="98%" accent="success" />
          <MetricCard label="Predicted failures 7d" value={risks.data?.filter((r) => r.rul_days <= 7).length ?? "—"} accent="lava" />
          <MetricCard label="Open work orders" value={0} accent="navy" />
          <MetricCard label="MTBF trend" value="↑ 3%" accent="warning" />
        </div>
        <DataTable
          rows={risks.data ?? []}
          columns={[
            { key: "equipment_id", header: "Unit", render: (r) => <span className="font-mono">#{r.equipment_id}</span> },
            { key: "category", header: "Type" },
            { key: "model", header: "Model" },
            { key: "runtime_hours", header: "Runtime hrs", align: "right" },
            { key: "health_score", header: "Health", align: "right", render: (r) => <KPIRing value={r.health_score} /> },
            { key: "rul_days", header: "RUL days", align: "right" },
            { key: "predicted_failure_date", header: "Predicted failure" },
            {
              key: "_pick",
              header: "",
              align: "right",
              render: (r) => (
                <button
                  onClick={() => setSelectedId(r.equipment_id)}
                  className="rounded-md border border-[color:var(--color-hairline)] px-2 py-1 text-xs"
                >
                  Inspect
                </button>
              ),
            },
            {
              key: "_act",
              header: "",
              align: "right",
              render: (r) => (
                <button
                  onClick={() => setConfirming(r)}
                  className="rounded-md bg-[color:var(--color-lava)] px-2 py-1 text-xs font-semibold text-white"
                >
                  Schedule tech
                </button>
              ),
            },
          ]}
        />
        {selectedId != null && (
          <section className="rounded-lg border border-[color:var(--color-hairline)] bg-white p-4">
            <h3 className="mb-2 text-sm font-semibold text-[color:var(--color-ink)]">Telemetry · Unit #{selectedId}</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-xs text-[color:var(--color-ink-soft)]">Temperature</div>
                <Sparkline
                  data={(telemetry.data ?? []).map((t) => ({ ...t, value: t.temperature }))}
                  color="#FF3621"
                />
              </div>
              <div>
                <div className="text-xs text-[color:var(--color-ink-soft)]">Vibration</div>
                <Sparkline
                  data={(telemetry.data ?? []).map((t) => ({ ...t, value: t.vibration }))}
                  color="#FBB300"
                />
              </div>
              <div>
                <div className="text-xs text-[color:var(--color-ink-soft)]">Runtime hrs</div>
                <Sparkline
                  data={(telemetry.data ?? []).map((t) => ({ ...t, value: t.runtime_hours_delta }))}
                  color="#4462C9"
                />
              </div>
            </div>
          </section>
        )}
      </div>
      <GenieChat
        tabId="maintenance"
        chips={[
          "Which equipment is most likely to fail this week?",
          "What's the average time-to-repair for fryers?",
          "Show me work orders open more than 7 days",
        ]}
      />
      <ConfirmDialog
        open={confirming != null}
        title="Schedule technician visit?"
        description="A work order will be created in app_work_orders and routed to the maintenance queue."
        details={
          confirming
            ? [
                { label: "Equipment", value: `${confirming.model} (#${confirming.equipment_id})` },
                { label: "Health", value: confirming.health_score.toFixed(0) },
                { label: "RUL", value: `${confirming.rul_days} days` },
                { label: "Predicted failure", value: confirming.predicted_failure_date },
                { label: "Target visit", value: targetVisit(confirming.rul_days) },
              ]
            : []
        }
        noteLabel="Notes for the tech"
        notePlaceholder={
          confirming ? `Predicted failure ${confirming.predicted_failure_date}` : undefined
        }
        onCancel={() => setConfirming(null)}
        onConfirm={async (note) => {
          if (confirming) await confirmSchedule(confirming, note);
        }}
      />
    </div>
  );
}

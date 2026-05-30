// ui/src/pages/MaintenancePage.tsx
import { useQueryClient } from "@tanstack/react-query";

import { DataTable } from "@/components/DataTable";
import { GenieChat } from "@/components/GenieChat";
import { KPIRing } from "@/components/KPIRing";
import { MetricCard } from "@/components/MetricCard";
import { api, useApi } from "@/lib/api";
import { useStoreId } from "@/state/store";

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
  const risks = useApi<Risk[]>(["maint-at-risk", storeId], "/maintenance/at-risk", { store_id: storeId });

  async function schedule(e: Risk) {
    const target = new Date();
    target.setDate(target.getDate() + Math.max(1, e.rul_days - 2));
    await api.post("/maintenance/work-order", {
      store_id: storeId,
      equipment_id: e.equipment_id,
      target_date: target.toISOString().slice(0, 10),
      notes: `Predicted failure ${e.predicted_failure_date}`,
    });
    qc.invalidateQueries({ queryKey: ["maint-at-risk", storeId] });
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
              key: "_act",
              header: "",
              align: "right",
              render: (r) => (
                <button
                  onClick={() => schedule(r)}
                  className="rounded-md bg-[color:var(--color-lava)] px-2 py-1 text-xs font-semibold text-white"
                >
                  Schedule tech
                </button>
              ),
            },
          ]}
        />
      </div>
      <GenieChat
        tabId="maintenance"
        chips={[
          "Which equipment is most likely to fail this week?",
          "What's the average time-to-repair for fryers?",
          "Show me work orders open more than 7 days",
        ]}
      />
    </div>
  );
}

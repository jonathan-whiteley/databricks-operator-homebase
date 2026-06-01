// ui/src/pages/SupplyPage.tsx
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataTable } from "@/components/DataTable";
import { GenieChat } from "@/components/GenieChat";
import { MetricCard } from "@/components/MetricCard";
import { useToast } from "@/components/Toast";
import { api, useApi } from "@/lib/api";
import { useStoreId } from "@/state/store";
import { Bar, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Reorder = {
  sku_id: number;
  sku_name: string;
  on_hand: number;
  reorder_point: number;
  days_of_cover: number;
  supplier_id: number;
  supplier_name: string;
  supplier_on_time_pct: number;
};

type Delivery = {
  po_id: number;
  sku_id: number;
  supplier_name: string;
  ordered_qty: number;
  expected_date: string;
};

function addDays(iso: string, n: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function SupplyPage() {
  const [storeId] = useStoreId();
  const today = new Date().toISOString().slice(0, 10);
  const qc = useQueryClient();
  const toast = useToast();
  const [confirming, setConfirming] = useState<Reorder | null>(null);
  const reorders = useApi<Reorder[]>(["supply-reorders", storeId], "/supply/reorder-queue", { store_id: storeId });
  const deliveries = useApi<Delivery[]>(
    ["supply-deliveries", storeId, today],
    "/supply/tomorrow-deliveries",
    { store_id: storeId, date: today },
  );

  async function confirmReleasePO(r: Reorder, note: string) {
    try {
      await api.post("/supply/release-po", {
        store_id: storeId,
        sku_id: r.sku_id,
        supplier_id: r.supplier_id,
        quantity: Math.max(r.reorder_point * 2, 20),
        target_date: addDays(today, 3),
        note: note || null,
      });
      qc.invalidateQueries({ queryKey: ["supply-reorders", storeId] });
      setConfirming(null);
      toast.success("PO released — written to app_purchase_orders");
    } catch (err: any) {
      toast.error(`Couldn't save: ${err?.message ?? "unknown error"}`);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-[color:var(--color-ink)]">Supply Chain</h1>
        <div className="grid grid-cols-4 gap-3">
          <MetricCard label="Below reorder point" value={reorders.data?.length ?? "—"} accent="lava" />
          <MetricCard label="Open POs in flight" value={deliveries.data?.length ?? "—"} accent="navy" />
          <MetricCard label="Tomorrow deliveries" value={deliveries.data?.length ?? "—"} />
          <MetricCard label="Supplier on-time" value="92%" accent="success" />
        </div>
        <section className="rounded-lg border border-[color:var(--color-hairline)] bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-[color:var(--color-ink)]">Forecast demand vs on-hand (top reorder SKU)</h3>
          <div className="h-56">
            <ResponsiveContainer>
              <ComposedChart
                data={[
                  { week: "W1", demand: 40, onhand: 32 },
                  { week: "W2", demand: 42, onhand: 18 },
                  { week: "W3", demand: 38, onhand: 9 },
                  { week: "W4", demand: 45, onhand: 0 },
                ]}
              >
                <XAxis dataKey="week" stroke="#4A5963" fontSize={12} />
                <YAxis stroke="#4A5963" fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar dataKey="onhand" name="On hand" fill="#1B5162" radius={[4, 4, 0, 0]} />
                <Line dataKey="demand" name="Forecast demand" stroke="#FF3621" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[color:var(--color-ink-soft)]">Reorder queue</h2>
          <DataTable
            rows={reorders.data ?? []}
            columns={[
              { key: "sku_name", header: "SKU", render: (r) => <span className="font-mono">{r.sku_name}</span> },
              { key: "on_hand", header: "On hand", align: "right" },
              { key: "reorder_point", header: "Reorder pt", align: "right" },
              { key: "days_of_cover", header: "Days cover", align: "right", render: (r) => r.days_of_cover.toFixed(1) },
              { key: "supplier_name", header: "Supplier" },
              {
                key: "_act",
                header: "",
                align: "right",
                render: (r) => (
                  <button
                    onClick={() => setConfirming(r)}
                    className="rounded-md bg-[color:var(--color-lava)] px-2 py-1 text-xs font-semibold text-white"
                  >
                    Release PO
                  </button>
                ),
              },
            ]}
          />
        </section>
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[color:var(--color-ink-soft)]">Tomorrow's deliveries</h2>
          <DataTable
            rows={deliveries.data ?? []}
            columns={[
              { key: "po_id", header: "PO", render: (r) => <span className="font-mono">#{r.po_id}</span> },
              { key: "supplier_name", header: "Supplier" },
              { key: "ordered_qty", header: "Qty", align: "right" },
              { key: "expected_date", header: "Expected" },
            ]}
          />
        </section>
      </div>
      <GenieChat
        tabId="supply"
        chips={[
          "What am I likely to run out of this week?",
          "Which supplier has missed delivery windows recently?",
          "Show inbound POs for tomorrow",
        ]}
      />
      <ConfirmDialog
        open={confirming != null}
        title="Release purchase order?"
        description="The PO will be written to app_purchase_orders in Lakebase and dispatched to the supplier."
        details={
          confirming
            ? [
                { label: "SKU", value: `${confirming.sku_name} (#${confirming.sku_id})` },
                { label: "Supplier", value: confirming.supplier_name },
                { label: "On hand", value: String(confirming.on_hand) },
                {
                  label: "Reorder qty",
                  value: String(Math.max(confirming.reorder_point * 2, 20)),
                },
                { label: "Target delivery", value: addDays(today, 3) },
              ]
            : []
        }
        noteLabel="PO note (optional)"
        onCancel={() => setConfirming(null)}
        onConfirm={async (note) => {
          if (confirming) await confirmReleasePO(confirming, note);
        }}
      />
    </div>
  );
}

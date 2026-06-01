// ui/src/pages/InventoryView.tsx
//
// Phase 7: Inventory view re-skinned with the db/* primitives. Single
// column, max-width 1120px on the oat-light background. No right-rail —
// Genie lives in the global slide-over now.
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Bar,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { AIRec, Btn, Card, LakebaseTag, PageHead, useToast } from "@/components/db";
import { api, useApi } from "@/lib/api";
import { useStoreId } from "@/state/store";

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

function reorderQty(r: Reorder): number {
  return Math.max(r.reorder_point * 2, 20);
}

// Local tokens for the hand-rolled tables. Kept inline so we don't pollute
// styles.css with one-off classes — every value references an existing token.
const TH: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 14px",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--db-gray-text)",
  background: "var(--db-oat-light)",
  borderBottom: "1px solid var(--db-gray-lines)",
  whiteSpace: "nowrap",
};

const TD: React.CSSProperties = {
  padding: "12px 14px",
  fontSize: 13.5,
  color: "var(--db-navy-800)",
  borderBottom: "1px solid var(--db-gray-lines)",
  verticalAlign: "middle",
};

const MONO: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 12.5,
};

const FORECAST_DATA = [
  { week: "W1", demand: 40, onhand: 32 },
  { week: "W2", demand: 42, onhand: 18 },
  { week: "W3", demand: 38, onhand: 9 },
  { week: "W4", demand: 45, onhand: 0 },
];

export default function InventoryView() {
  const [storeId] = useStoreId();
  const today = new Date().toISOString().slice(0, 10);
  const qc = useQueryClient();
  const toast = useToast();

  // Per-row confirm dialog (Release PO button on a single row).
  const [confirming, setConfirming] = useState<Reorder | null>(null);
  // Bulk confirm dialog (AIRec "Release all" CTA).
  const [bulkConfirm, setBulkConfirm] = useState(false);

  const reorders = useApi<Reorder[]>(
    ["supply-reorders", storeId],
    "/supply/reorder-queue",
    { store_id: storeId },
  );
  const deliveries = useApi<Delivery[]>(
    ["supply-deliveries", storeId, today],
    "/supply/tomorrow-deliveries",
    { store_id: storeId, date: today },
  );

  const rows = reorders.data ?? [];
  const deliveryRows = deliveries.data ?? [];

  async function postRelease(r: Reorder, note: string | null) {
    await api.post("/supply/release-po", {
      store_id: storeId,
      sku_id: r.sku_id,
      supplier_id: r.supplier_id,
      quantity: reorderQty(r),
      target_date: addDays(today, 3),
      note: note || null,
    });
  }

  async function confirmReleasePO(r: Reorder, note: string) {
    try {
      await postRelease(r, note);
      qc.invalidateQueries({ queryKey: ["supply-reorders", storeId] });
      setConfirming(null);
      toast.success("PO released — written to app_purchase_orders");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "unknown error";
      toast.error(`Couldn't save: ${msg}`);
    }
  }

  async function confirmReleaseAll(note: string) {
    if (rows.length === 0) {
      setBulkConfirm(false);
      return;
    }
    try {
      for (const r of rows) {
        await postRelease(r, note);
      }
      qc.invalidateQueries({ queryKey: ["supply-reorders", storeId] });
      setBulkConfirm(false);
      toast.success(
        `${rows.length} PO${rows.length === 1 ? "" : "s"} released — written to app_purchase_orders`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "unknown error";
      toast.error(`Couldn't save: ${msg}`);
    }
  }

  return (
    <div style={{ flex: 1, background: "var(--db-oat-light)" }}>
      <div style={{ padding: "28px 32px 40px", maxWidth: 1120, margin: "0 auto" }}>
        <PageHead
          icon="inventory"
          title="Inventory"
          sub="Release POs before close. Tomorrow's deliveries land here too."
        />

        <div style={{ marginBottom: 18 }}>
          <AIRec
            tone="navy"
            action="Release all"
            onAction={() => setBulkConfirm(true)}
          >
            <strong>3 SKUs</strong> likely to stock out before Tuesday. Releasing the top
            reorder will cover Lunch through the weekend.
          </AIRec>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Reorder queue card */}
          <Card style={{ overflow: "hidden" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 18px",
                borderBottom: "1px solid var(--db-gray-lines)",
                background: "var(--db-oat-light)",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: "var(--db-navy-800)",
                  }}
                >
                  Reorder queue
                </div>
                <div style={{ fontSize: 11.5, color: "var(--db-gray-text)" }}>
                  {rows.length} SKU{rows.length === 1 ? "" : "s"} below reorder point
                </div>
              </div>
              <LakebaseTag table="app_purchase_orders" />
            </div>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontFamily: "var(--font-sans)",
                }}
              >
                <thead>
                  <tr>
                    <th style={TH}>SKU</th>
                    <th style={{ ...TH, textAlign: "right" }}>On hand</th>
                    <th style={{ ...TH, textAlign: "right" }}>Reorder pt</th>
                    <th style={{ ...TH, textAlign: "right" }}>Days cover</th>
                    <th style={TH}>Supplier</th>
                    <th style={{ ...TH, textAlign: "right" }} aria-label="actions" />
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        style={{
                          ...TD,
                          textAlign: "center",
                          color: "var(--db-gray-text)",
                          borderBottom: 0,
                          padding: "22px 14px",
                        }}
                      >
                        {reorders.isLoading
                          ? "Loading reorder queue…"
                          : "Nothing below reorder point. Nice."}
                      </td>
                    </tr>
                  )}
                  {rows.map((r, i) => {
                    const last = i === rows.length - 1;
                    const cellStyle = last ? { ...TD, borderBottom: 0 } : TD;
                    return (
                      <tr key={r.sku_id}>
                        <td style={cellStyle}>
                          <span style={MONO}>{r.sku_name}</span>
                        </td>
                        <td style={{ ...cellStyle, textAlign: "right", ...MONO }}>
                          {r.on_hand}
                        </td>
                        <td style={{ ...cellStyle, textAlign: "right", ...MONO }}>
                          {r.reorder_point}
                        </td>
                        <td style={{ ...cellStyle, textAlign: "right", ...MONO }}>
                          {r.days_of_cover.toFixed(1)}
                        </td>
                        <td style={cellStyle}>{r.supplier_name}</td>
                        <td style={{ ...cellStyle, textAlign: "right" }}>
                          <Btn
                            variant="primary"
                            size="sm"
                            icon="truck"
                            onClick={() => setConfirming(r)}
                          >
                            Release PO
                          </Btn>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Tomorrow's deliveries card */}
          <Card style={{ overflow: "hidden" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 18px",
                borderBottom: "1px solid var(--db-gray-lines)",
                background: "var(--db-oat-light)",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: "var(--db-navy-800)",
                  }}
                >
                  Tomorrow's deliveries
                </div>
                <div style={{ fontSize: 11.5, color: "var(--db-gray-text)" }}>
                  {deliveryRows.length} inbound PO
                  {deliveryRows.length === 1 ? "" : "s"} expected
                </div>
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontFamily: "var(--font-sans)",
                }}
              >
                <thead>
                  <tr>
                    <th style={TH}>PO</th>
                    <th style={TH}>Supplier</th>
                    <th style={{ ...TH, textAlign: "right" }}>Qty</th>
                    <th style={TH}>Expected</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveryRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        style={{
                          ...TD,
                          textAlign: "center",
                          color: "var(--db-gray-text)",
                          borderBottom: 0,
                          padding: "22px 14px",
                        }}
                      >
                        {deliveries.isLoading
                          ? "Loading deliveries…"
                          : "No inbound deliveries scheduled."}
                      </td>
                    </tr>
                  )}
                  {deliveryRows.map((d, i) => {
                    const last = i === deliveryRows.length - 1;
                    const cellStyle = last ? { ...TD, borderBottom: 0 } : TD;
                    return (
                      <tr key={d.po_id}>
                        <td style={cellStyle}>
                          <span style={MONO}>#{d.po_id}</span>
                        </td>
                        <td style={cellStyle}>{d.supplier_name}</td>
                        <td style={{ ...cellStyle, textAlign: "right", ...MONO }}>
                          {d.ordered_qty}
                        </td>
                        <td style={cellStyle}>
                          <span style={MONO}>{d.expected_date}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Demand vs on-hand chart card */}
          <Card style={{ padding: "16px 18px" }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: "var(--db-navy-800)",
                marginBottom: 4,
              }}
            >
              Forecast demand vs on-hand
            </div>
            <div
              style={{
                fontSize: 11.5,
                color: "var(--db-gray-text)",
                marginBottom: 12,
              }}
            >
              Top reorder SKU
            </div>
            <div style={{ height: 220 }}>
              <ResponsiveContainer>
                <ComposedChart data={FORECAST_DATA}>
                  <XAxis
                    dataKey="week"
                    stroke="var(--db-gray-text)"
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxis stroke="var(--db-gray-text)" fontSize={12} tickLine={false} />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="onhand"
                    name="On hand"
                    fill="var(--db-navy-600)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    dataKey="demand"
                    name="Forecast demand"
                    stroke="var(--db-lava-600)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>

      {/* Per-row confirm */}
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
                { label: "Reorder qty", value: String(reorderQty(confirming)) },
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

      {/* Bulk "Release all" confirm */}
      <ConfirmDialog
        open={bulkConfirm}
        title={`Release ${rows.length} purchase order${rows.length === 1 ? "" : "s"}?`}
        description="Each PO will be written to app_purchase_orders in Lakebase and dispatched to the supplier."
        details={rows.map((r) => ({
          label: r.sku_name,
          value: `${r.supplier_name} · qty ${reorderQty(r)} · ETA ${addDays(today, 3)}`,
        }))}
        noteLabel="Batch note (optional)"
        confirmLabel="Release all"
        onCancel={() => setBulkConfirm(false)}
        onConfirm={confirmReleaseAll}
      />
    </div>
  );
}

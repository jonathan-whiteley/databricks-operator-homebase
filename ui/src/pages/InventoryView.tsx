// ui/src/pages/InventoryView.tsx
//
// Inventory / Reorders view. Faithfully ports the design template
// `/tmp/claude_design/lakehouse-market-homebase-app/project/app/inventory.jsx`
// onto the live `/api/supply` endpoints:
//
//   PageHead  +  LaborStat row  +  AIRec  +  one POCard per vendor.
//
// The POCard groups reorder-queue rows by supplier, renders each item with a
// par-bar + quantity stepper, and exposes a "Release order" CTA that fires a
// per-row POST to `/supply/release-po` for every item in the card. Wrapped in
// the shared ConfirmDialog + useToast.
import { useQueryClient } from "@tanstack/react-query";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  AIRec,
  Btn,
  Card,
  Icon,
  LakebaseTag,
  PageHead,
  Pill,
  useToast,
} from "@/components/db";
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

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function addDays(iso: string, n: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function suggestedQty(r: Reorder): number {
  // Order back up to ~2x reorder point, never less than 20 units.
  return Math.max(r.reorder_point * 2, 20);
}

// Deterministic per-SKU unit cost so the staged spend total is stable across
// renders. The supply API doesn't return unit cost today; this is a demo-time
// stand-in that varies by sku_id without ever returning $0.
function unitCost(skuId: number): number {
  return 3 + ((skuId * 7) % 18);
}

function trendLabel(r: Reorder): string {
  // Translate days_of_cover into a directional usage trend, mirroring the
  // "+18% w/w" copy from the design template.
  if (r.days_of_cover < 2) return "+18% w/w";
  if (r.days_of_cover < 4) return "+9% w/w";
  if (r.days_of_cover < 6) return "+3% w/w";
  return "flat w/w";
}

function shortEta(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// ──────────────────────────────────────────────────────────────────────────
// Bits lifted verbatim from the design template
// ──────────────────────────────────────────────────────────────────────────

function ParBar({ onHand, par }: { onHand: number; par: number }) {
  const pct = Math.min(100, par > 0 ? (onHand / par) * 100 : 0);
  const low = par > 0 ? onHand / par < 0.4 : true;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          width: 70,
          height: 6,
          background: "var(--db-oat-medium)",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: low ? "var(--db-lava-600)" : "var(--db-green-600)",
            borderRadius: 3,
          }}
        />
      </div>
      <span
        style={{
          fontSize: 11.5,
          fontFamily: "var(--font-mono)",
          color: low ? "var(--db-lava-700)" : "var(--db-gray-text)",
        }}
      >
        {onHand}/{par}
      </span>
    </div>
  );
}

function Stepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const btn: CSSProperties = {
    border: 0,
    background: "transparent",
    padding: "6px 8px",
    cursor: "pointer",
    display: "flex",
    color: "var(--db-gray-text)",
  };
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0,
        border: "1px solid var(--db-gray-lines)",
        borderRadius: 7,
        overflow: "hidden",
        background: "#fff",
      }}
    >
      <button
        type="button"
        aria-label="Decrease"
        onClick={() => onChange(Math.max(0, value - 1))}
        style={btn}
      >
        <Icon name="minus" size={13} />
      </button>
      <span
        style={{
          minWidth: 26,
          textAlign: "center",
          fontSize: 13,
          fontFamily: "var(--font-mono)",
          color: "var(--db-navy-800)",
        }}
      >
        {value}
      </span>
      <button type="button" aria-label="Increase" onClick={() => onChange(value + 1)} style={btn}>
        <Icon name="plus" size={13} />
      </button>
    </div>
  );
}

function LaborStat({
  label,
  value,
  foot,
}: {
  label: string;
  value: string;
  foot?: string;
}) {
  return (
    <Card pad="14px 16px" style={{ flex: 1 }}>
      <div
        style={{
          fontSize: 11,
          color: "var(--db-gray-text)",
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 24,
          fontWeight: 600,
          color: "var(--db-navy-800)",
          letterSpacing: "-0.02em",
          margin: "5px 0 3px",
        }}
      >
        {value}
      </div>
      {foot && <div style={{ fontSize: 12, color: "var(--db-gray-text)" }}>{foot}</div>}
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// POCard — vendor-grouped order card mirroring inventory.jsx POCard
// ──────────────────────────────────────────────────────────────────────────

type POItem = Reorder & { unit: string; cost: number; trend: string };

type PO = {
  id: string;
  vendor: string;
  eta: string;
  items: POItem[];
};

function POCard({
  po,
  released,
  onRelease,
}: {
  po: PO;
  released: boolean;
  onRelease: (total: number, qtys: Record<number, number>) => void;
}) {
  const [qtys, setQtys] = useState<Record<number, number>>(
    Object.fromEntries(po.items.map((i) => [i.sku_id, suggestedQty(i)])),
  );
  const total = po.items.reduce((s, i) => s + (qtys[i.sku_id] ?? 0) * i.cost, 0);
  const lineCount = po.items.filter((i) => (qtys[i.sku_id] ?? 0) > 0).length;
  return (
    <Card style={{ overflow: "hidden" }}>
      {/* Header */}
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
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            background: "var(--db-oat-medium)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="truck" size={18} color="var(--db-navy-800)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--db-navy-800)" }}>
            {po.vendor}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--db-gray-text)" }}>
            {po.items.length} item{po.items.length === 1 ? "" : "s"} below par · delivers {po.eta}
          </div>
        </div>
        {released ? (
          <Pill level="ok" dot>
            Released · arriving {po.eta}
          </Pill>
        ) : (
          <Pill level="info" dot>
            Ready to release
          </Pill>
        )}
      </div>

      {/* Items */}
      <div>
        {po.items.map((it, idx) => {
          const last = idx === po.items.length - 1;
          return (
            <div
              key={it.sku_id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "12px 18px",
                borderBottom: last ? 0 : "1px solid var(--db-gray-lines)",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--db-navy-800)" }}>
                  {it.sku_name}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    color: "var(--db-navy-400)",
                  }}
                >
                  SKU-{it.sku_id} · {it.trend}
                </div>
              </div>
              <ParBar onHand={it.on_hand} par={it.reorder_point} />
              <div style={{ width: 110, textAlign: "right", flexShrink: 0 }}>
                {released ? (
                  <span
                    style={{
                      fontSize: 13,
                      fontFamily: "var(--font-mono)",
                      color: "var(--db-navy-800)",
                    }}
                  >
                    {qtys[it.sku_id]} {it.unit}
                  </span>
                ) : (
                  <Stepper
                    value={qtys[it.sku_id] ?? 0}
                    onChange={(v) => setQtys((q) => ({ ...q, [it.sku_id]: v }))}
                  />
                )}
              </div>
              <div
                style={{
                  width: 70,
                  textAlign: "right",
                  fontSize: 13,
                  fontFamily: "var(--font-mono)",
                  color: "var(--db-navy-800)",
                  flexShrink: 0,
                }}
              >
                ${((qtys[it.sku_id] ?? 0) * it.cost).toFixed(0)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "14px 18px",
          background: "var(--db-oat-light)",
        }}
      >
        <span style={{ fontSize: 12.5, color: "var(--db-gray-text)" }}>
          {released ? (
            <LakebaseTag table="app_purchase_orders" />
          ) : (
            `${lineCount} line item${lineCount === 1 ? "" : "s"} · suggested by usage model`
          )}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--db-gray-text)" }}>
          PO total
        </span>
        <span
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: "var(--db-navy-800)",
            fontFamily: "var(--font-mono)",
          }}
        >
          ${total.toFixed(2)}
        </span>
        {released ? (
          <Btn variant="subtle" icon="check" disabled style={{ marginLeft: 8 }}>
            Released
          </Btn>
        ) : (
          <Btn
            variant="primary"
            icon="truck"
            onClick={() => onRelease(total, qtys)}
            style={{ marginLeft: 8 }}
          >
            Release order
          </Btn>
        )}
      </div>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// View
// ──────────────────────────────────────────────────────────────────────────

export default function InventoryView() {
  const [storeId] = useStoreId();
  const today = new Date().toISOString().slice(0, 10);
  const qc = useQueryClient();
  const toast = useToast();

  const [confirming, setConfirming] = useState<{
    po: PO;
    total: number;
    qtys: Record<number, number>;
  } | null>(null);
  const [released, setReleased] = useState<Set<string>>(new Set());

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

  // Group reorder rows by supplier into one PO per vendor. ETA defaults to
  // today + 3d (matches the release-po target_date convention).
  const purchaseOrders: PO[] = useMemo(() => {
    const byVendor = new Map<string, Reorder[]>();
    for (const r of rows) {
      const key = r.supplier_name || `Supplier ${r.supplier_id}`;
      const list = byVendor.get(key) ?? [];
      list.push(r);
      byVendor.set(key, list);
    }
    const eta = shortEta(addDays(today, 3));
    return Array.from(byVendor.entries()).map(([vendor, items]) => ({
      id: `${vendor}-${items[0]?.supplier_id ?? 0}`,
      vendor,
      eta,
      items: items.map<POItem>((it) => ({
        ...it,
        unit: "cases",
        cost: unitCost(it.sku_id),
        trend: trendLabel(it),
      })),
    }));
  }, [rows, today]);

  const belowPar = rows.length;
  const openCount = purchaseOrders.filter((p) => !released.has(p.id)).length;
  const stagedSpend = purchaseOrders
    .filter((p) => !released.has(p.id))
    .reduce(
      (s, p) => s + p.items.reduce((ss, it) => ss + suggestedQty(it) * it.cost, 0),
      0,
    );
  const vendorCount = new Set(rows.map((r) => r.supplier_name)).size;
  const firstDelivery = deliveryRows[0];
  const nextDeliveryVendor = firstDelivery?.supplier_name ?? "—";

  async function postRelease(it: POItem, qty: number, note: string | null) {
    await api.post("/supply/release-po", {
      store_id: storeId,
      sku_id: it.sku_id,
      supplier_id: it.supplier_id,
      quantity: qty,
      target_date: addDays(today, 3),
      note: note || null,
    });
  }

  async function confirmReleasePO(
    po: PO,
    qtys: Record<number, number>,
    note: string,
  ) {
    try {
      for (const it of po.items) {
        const qty = qtys[it.sku_id] ?? 0;
        if (qty > 0) await postRelease(it, qty, note);
      }
      setReleased((s) => {
        const next = new Set(s);
        next.add(po.id);
        return next;
      });
      qc.invalidateQueries({ queryKey: ["supply-reorders", storeId] });
      setConfirming(null);
      toast.success(
        `${po.vendor} PO released — written to app_purchase_orders`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "unknown error";
      toast.error(`Couldn't save: ${msg}`);
    }
  }

  // ────────── render ──────────
  return (
    <div style={{ flex: 1, background: "var(--db-oat-light)" }}>
      <div style={{ padding: "28px 32px 40px", maxWidth: 1000, margin: "0 auto" }}>
        <PageHead
          icon="inventory"
          title="Reorders"
          sub="Purchase orders the usage model has staged for items below par. Adjust and release."
        >
          <Btn variant="ghost" icon="search">
            Browse inventory
          </Btn>
        </PageHead>

        {/* Stat row */}
        <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
          <LaborStat
            label="Items below par"
            value={String(belowPar)}
            foot={
              vendorCount > 0
                ? `across ${vendorCount} vendor${vendorCount === 1 ? "" : "s"}`
                : reorders.isLoading
                  ? "loading…"
                  : "all healthy"
            }
          />
          <LaborStat
            label="POs ready"
            value={String(openCount)}
            foot={openCount ? "awaiting release" : "all released"}
          />
          <LaborStat
            label="Staged spend"
            value={`$${stagedSpend.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
            foot="this order cycle"
          />
          <LaborStat
            label="Next delivery"
            value={firstDelivery ? "Tomorrow" : "—"}
            foot={
              firstDelivery
                ? `${nextDeliveryVendor} · ${firstDelivery.expected_date}`
                : deliveries.isLoading
                  ? "loading…"
                  : "none scheduled"
            }
          />
        </div>

        {/* Genie rec */}
        <div style={{ marginBottom: 18 }}>
          <AIRec tone="navy">
            <strong>{rows[0]?.sku_name ?? "Top SKU"}</strong> is your tightest item —{" "}
            {rows[0]?.on_hand ?? 0} on hand against a reorder point of {rows[0]?.reorder_point ?? 0}
            , with{" "}
            {rows[0] ? Math.max(0, Math.round((1 - rows[0].days_of_cover / 7) * 100)) : 0}% less
            cover than the weekly forecast. I bumped the suggested order to{" "}
            {rows[0] ? suggestedQty(rows[0]) : 0} units so you don't run dry this weekend.
            {rows.length > 1 && (
              <>
                {" "}
                <strong>{rows[1]?.sku_name}</strong>
                {rows.length > 2 && (
                  <>
                    {" "}and <strong>{rows[2]?.sku_name}</strong>
                  </>
                )}{" "}
                are also below par.
              </>
            )}
          </AIRec>
        </div>

        {/* PO cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {purchaseOrders.length === 0 && (
            <Card style={{ padding: "22px 18px", textAlign: "center" }}>
              <div style={{ fontSize: 13.5, color: "var(--db-gray-text)" }}>
                {reorders.isLoading
                  ? "Loading reorder queue…"
                  : "Nothing below reorder point. Nice."}
              </div>
            </Card>
          )}
          {purchaseOrders.map((po) => (
            <POCard
              key={po.id}
              po={po}
              released={released.has(po.id)}
              onRelease={(total, qtys) => setConfirming({ po, total, qtys })}
            />
          ))}
        </div>

        {/* Tomorrow's deliveries — compact panel matching the card chrome */}
        <div style={{ marginTop: 24 }}>
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
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: "var(--db-oat-medium)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="calendar" size={18} color="var(--db-navy-800)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{ fontSize: 14, fontWeight: 500, color: "var(--db-navy-800)" }}
                >
                  Tomorrow's deliveries
                </div>
                <div style={{ fontSize: 11.5, color: "var(--db-gray-text)" }}>
                  {deliveryRows.length} inbound PO
                  {deliveryRows.length === 1 ? "" : "s"} expected
                </div>
              </div>
              <LakebaseTag table="app_purchase_orders" />
            </div>
            <div>
              {deliveryRows.length === 0 && (
                <div
                  style={{
                    padding: "22px 18px",
                    fontSize: 13,
                    color: "var(--db-gray-text)",
                    textAlign: "center",
                  }}
                >
                  {deliveries.isLoading
                    ? "Loading deliveries…"
                    : "No inbound deliveries scheduled."}
                </div>
              )}
              {deliveryRows.map((d, idx) => {
                const last = idx === deliveryRows.length - 1;
                return (
                  <div
                    key={d.po_id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "12px 18px",
                      borderBottom: last ? 0 : "1px solid var(--db-gray-lines)",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: 500,
                          color: "var(--db-navy-800)",
                        }}
                      >
                        {d.supplier_name}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          fontFamily: "var(--font-mono)",
                          color: "var(--db-navy-400)",
                        }}
                      >
                        PO #{d.po_id} · SKU-{d.sku_id}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        fontFamily: "var(--font-mono)",
                        color: "var(--db-navy-800)",
                        minWidth: 90,
                        textAlign: "right",
                      }}
                    >
                      {d.ordered_qty} units
                    </div>
                    <div
                      style={{
                        fontSize: 12.5,
                        color: "var(--db-gray-text)",
                        fontFamily: "var(--font-mono)",
                        minWidth: 110,
                        textAlign: "right",
                      }}
                    >
                      {d.expected_date}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirming != null}
        title={`Release ${confirming?.po.vendor ?? ""} purchase order?`}
        description="The PO will be written to app_purchase_orders in Lakebase and dispatched to the supplier."
        details={
          confirming
            ? [
                { label: "Vendor", value: confirming.po.vendor },
                {
                  label: "Items",
                  value: `${confirming.po.items.length} SKU${
                    confirming.po.items.length === 1 ? "" : "s"
                  }`,
                },
                {
                  label: "Total",
                  value: `$${confirming.total.toFixed(2)}`,
                },
                { label: "Target delivery", value: addDays(today, 3) },
              ]
            : []
        }
        noteLabel="PO note (optional)"
        confirmLabel="Release order"
        onCancel={() => setConfirming(null)}
        onConfirm={async (note) => {
          if (confirming) await confirmReleasePO(confirming.po, confirming.qtys, note);
        }}
      />
    </div>
  );
}

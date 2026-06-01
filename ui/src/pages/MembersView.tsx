// ui/src/pages/MembersView.tsx
//
// Phase 9 redesign: Loyalty / Members view.
//
// Single-column, max-width 1120px. Chrome comes entirely from the
// `components/db/*` primitives (PageHead / AIRec / Card / Btn / Pill /
// LakebaseTag). The hero action is a bulk win-back campaign that fires
// /api/loyalty/win-back; the at-risk list below is a preview-only rich
// row layout (no per-member push button) because the bulk action above
// already covers them.
import { useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StoreMap, type MapPoint } from "@/components/StoreMap";
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

// ── Types ────────────────────────────────────────────────────────────────────

type Member = {
  member_id: number;
  preferred_store_id: number;
  lifetime_spend: number;
  churn_probability: number;
  predicted_clv: number;
  segment: string;
  lat: number;
  lon: number;
};

type Store = { store_id: number; lat: number; lon: number };

// ── Constants ────────────────────────────────────────────────────────────────

// Offer is hardcoded for the bulk win-back; in production this would
// come from the offer catalog or the recommendation model.
const WIN_BACK_OFFER_ID = 1;
const WIN_BACK_OFFER_NAME = "Lapsed-member 25% off bundle";
const ELIGIBLE_THRESHOLD = 0.7;

const TIER_LEGEND: { tier: MapPoint["tier"]; label: string; color: string }[] = [
  { tier: "active", label: "Active", color: "#00A972" },
  { tier: "lapsed", label: "Lapsed", color: "#9CA3AF" },
  { tier: "at_risk", label: "At-risk", color: "#FF3621" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

const money = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

const pct = (n: number, d = 0) => `${(n * 100).toFixed(d)}%`;

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MembersView() {
  const [storeId] = useStoreId();
  const toast = useToast();

  const stores = useApi<Store[]>(["stores"], "/stores");
  // Pull a wide slice so we can both display the preview and count eligible.
  const atRisk = useApi<Member[]>(
    ["loyalty-at-risk-bulk", storeId],
    "/loyalty/at-risk",
    { store_id: storeId, limit: 500 },
  );
  const points = useApi<MapPoint[]>(
    ["loyalty-map", storeId],
    "/loyalty/map",
    { store_id: storeId },
  );

  const center = stores.data?.find((s) => s.store_id === storeId);

  const eligible = useMemo(
    () =>
      (atRisk.data ?? []).filter((m) => m.churn_probability > ELIGIBLE_THRESHOLD),
    [atRisk.data],
  );
  const eligibleCount = eligible.length;
  const topAtRisk = (atRisk.data ?? []).slice(0, 8);

  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [activated, setActivated] = useState<{ count: number } | null>(null);

  async function confirmSend(_note: string) {
    setSending(true);
    try {
      const r = await api.post<{ count: number }>("/loyalty/win-back", {
        store_id: storeId,
        segment: "lapsed",
        offer_id: WIN_BACK_OFFER_ID,
      });
      setActivated({ count: r.data.count });
      setConfirming(false);
      toast.success(`Win-back sent to ${r.data.count} members`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown error";
      toast.error(`Couldn't send win-back: ${msg}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ maxWidth: 1120, margin: "0 auto" }}>
      <PageHead
        icon="members"
        title="Loyalty"
        sub="Members in your store's catchment. Lapsing high-value first."
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <AIRec
          tone="navy"
          action="Send win-back"
          onAction={() => {
            if (!activated && eligibleCount > 0) setConfirming(true);
          }}
        >
          <strong>184 high-value members</strong> haven&rsquo;t returned in 30
          days. A <strong>25% off win-back</strong> has worked in similar
          stores.
        </AIRec>

        {/* Bulk win-back action card */}
        <BulkWinBackCard
          eligibleCount={eligibleCount}
          loading={atRisk.isLoading}
          activated={activated}
          onSend={() => setConfirming(true)}
        />

        {/* Trade-area map */}
        <Card pad={0} style={{ overflow: "hidden" }}>
          <header
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              padding: "14px 18px",
              borderBottom: "1px solid var(--db-gray-lines)",
              background: "var(--db-oat-light)",
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--db-navy-800)",
                  margin: 0,
                }}
              >
                Trade area
              </h2>
              <p
                style={{
                  fontSize: 11.5,
                  color: "var(--db-gray-text)",
                  margin: "2px 0 0",
                }}
              >
                Member density within ~8km of store #{storeId}. Color shows
                engagement tier.
              </p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {TIER_LEGEND.map((t) => (
                <span
                  key={t.tier}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "3px 10px",
                    borderRadius: 999,
                    border: "1px solid var(--db-gray-lines)",
                    background: "#fff",
                    fontSize: 11,
                    color: "var(--db-navy-800)",
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: t.color,
                    }}
                    aria-hidden
                  />
                  {t.label}
                </span>
              ))}
            </div>
          </header>
          {center ? (
            <StoreMap
              center={{ lat: center.lat, lon: center.lon }}
              points={points.data ?? []}
            />
          ) : (
            <div
              style={{
                height: 420,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                color: "var(--db-gray-text)",
              }}
            >
              Loading store location…
            </div>
          )}
        </Card>

        {/* At-risk preview list */}
        <section>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: 6,
            }}
          >
            <h2
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--db-navy-800)",
                margin: 0,
              }}
            >
              At-risk members in your catchment
            </h2>
            <span style={{ fontSize: 11.5, color: "var(--db-gray-text)" }}>
              Top {topAtRisk.length} by predicted CLV
            </span>
          </div>
          <p
            style={{
              fontSize: 12,
              color: "var(--db-gray-text)",
              margin: "0 0 10px",
            }}
          >
            These members are eligible for the win-back above.
          </p>
          <Card pad={0}>
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
              }}
            >
              {topAtRisk.length === 0 && !atRisk.isLoading && (
                <li
                  style={{
                    padding: "16px 18px",
                    fontSize: 13,
                    color: "var(--db-gray-text)",
                  }}
                >
                  No at-risk members for this store right now.
                </li>
              )}
              {topAtRisk.map((m, i) => (
                <li
                  key={m.member_id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto auto auto",
                    alignItems: "center",
                    gap: 16,
                    padding: "12px 18px",
                    borderTop:
                      i === 0 ? "none" : "1px solid var(--db-gray-lines)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 13,
                      color: "var(--db-navy-800)",
                    }}
                  >
                    #{m.member_id}
                  </span>
                  <Pill level="neutral">{m.segment ?? "—"}</Pill>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 13,
                      color: "var(--db-navy-800)",
                      minWidth: 80,
                      textAlign: "right",
                    }}
                  >
                    {money(m.lifetime_spend)}
                  </span>
                  <Pill
                    level={
                      m.churn_probability > ELIGIBLE_THRESHOLD
                        ? "danger"
                        : "warn"
                    }
                    dot
                  >
                    {pct(m.churn_probability)}
                  </Pill>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      </div>

      <ConfirmDialog
        open={confirming}
        title={`Send win-back to ${eligibleCount} members?`}
        description="They'll receive a push within 24 hours."
        details={[
          { label: "Offer", value: WIN_BACK_OFFER_NAME },
          { label: "Audience", value: `${eligibleCount} lapsing high-value` },
          { label: "Scope", value: "Bulk member push" },
          { label: "Store", value: `#${storeId}` },
        ]}
        noteLabel="Manager note (optional)"
        confirmLabel={sending ? "Sending…" : "Send win-back"}
        onCancel={() => {
          if (!sending) setConfirming(false);
        }}
        onConfirm={confirmSend}
      />
    </div>
  );
}

// ── Bulk action card ─────────────────────────────────────────────────────────

function BulkWinBackCard({
  eligibleCount,
  loading,
  activated,
  onSend,
}: {
  eligibleCount: number;
  loading: boolean;
  activated: { count: number } | null;
  onSend: () => void;
}) {
  const isActivated = activated != null;
  return (
    <Card
      pad={20}
      style={{
        position: "relative",
        border: isActivated
          ? "2px solid var(--db-green-600)"
          : "1px solid var(--db-gray-lines)",
        boxShadow: isActivated
          ? "0 8px 24px rgba(0, 169, 114, 0.16)"
          : "var(--shadow-sm)",
        transition: "all var(--dur-base) var(--ease-out)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 12,
          right: 16,
        }}
      >
        <LakebaseTag table="app_offer_pushes" />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          alignItems: "center",
          gap: 24,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 6,
            }}
          >
            <h2
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "var(--db-navy-800)",
                margin: 0,
              }}
            >
              {isActivated ? "Activated" : "Send win-back campaign"}
            </h2>
            {isActivated && (
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  background: "var(--db-green-600)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                aria-label="activated"
              >
                <Icon name="check" size={13} color="#fff" stroke={2.4} />
              </span>
            )}
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 22,
              marginTop: 4,
            }}
          >
            <Stat
              label="Eligible members"
              value={
                loading && !isActivated
                  ? "…"
                  : isActivated
                    ? activated.count.toLocaleString("en-US")
                    : eligibleCount.toLocaleString("en-US")
              }
            />
            <Stat label="Offer" value={WIN_BACK_OFFER_NAME} mono={false} />
            <Stat
              label="Expected reach"
              value={
                isActivated
                  ? "Sent · push within 24h"
                  : eligibleCount > 0
                    ? `${eligibleCount.toLocaleString("en-US")} push notifications`
                    : "—"
              }
              mono={false}
            />
          </div>
        </div>

        <div style={{ flexShrink: 0 }}>
          {isActivated ? (
            <Btn variant="ghost" size="lg" icon="check" disabled>
              Sent to {activated.count} members
            </Btn>
          ) : (
            <Btn
              variant="primary"
              size="lg"
              icon="send"
              onClick={onSend}
              disabled={loading || eligibleCount === 0}
            >
              Send to {eligibleCount} members
            </Btn>
          )}
        </div>
      </div>
    </Card>
  );
}

function Stat({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--db-gray-text)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 3,
          fontSize: 15,
          fontWeight: 600,
          color: "var(--db-navy-800)",
          fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
          letterSpacing: mono ? "-0.01em" : 0,
        }}
      >
        {value}
      </div>
    </div>
  );
}

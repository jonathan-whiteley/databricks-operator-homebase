// ui/src/pages/MembersView.tsx
//
// Loyalty / Members view — rebuilt faithful to the design template at
// `app/members.jsx` in the Claude Design shell. The hero is a guided
// **win-back composer** with a sticky preview rail: pick a segment, pick
// an offer, toggle channels, then fire `POST /api/loyalty/win-back` once.
// After the campaign sends, the composer collapses into a dark "Campaign
// live" hero card (matches the design's `membersSent` branch).
//
// All chrome (PageHead, AIRec, Card, Btn, Pill, LakebaseTag, Spark, Delta,
// Eyebrow, Icon) comes from `components/db/*`. The trade-area map below
// reuses the existing `StoreMap` component. The at-risk preview list is
// read-only — the win-back hero is the only write affordance, per the
// "no per-member push buttons" constraint.
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StoreMap, type MapPoint } from "@/components/StoreMap";
import {
  AIRec,
  Btn,
  Card,
  Delta,
  Icon,
  type IconName,
  LakebaseTag,
  PageHead,
  Pill,
  Spark,
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

type KPI = {
  active_members: number;
  spend_30d: number;
  at_risk_count: number;
  redemption_pct: number;
};

// ── Static catalog (mirrors data.jsx MEMBER_SEGMENTS / OFFERS / MEMBER_TREND) ─

type Segment = {
  id: string;
  name: string;
  desc: string;
  size: number;
  rec?: boolean;
};

type Offer = {
  id: string;
  // Numeric id we actually POST to /loyalty/win-back. The catalog UI uses
  // string ids ("o1"/"o2"/"o3") to match the design, but the API takes an
  // integer offer_id, so we keep both.
  apiId: number;
  label: string;
  lift: string;
  proj: string;
  projected: number;
  rec?: boolean;
};

const SEGMENTS: Segment[] = [
  {
    id: "m1",
    name: "Lapsing regulars",
    desc: "Visited 4+×/mo, none in last 21 days",
    size: 184,
    rec: true,
  },
  {
    id: "m2",
    name: "New & cooling",
    desc: "Joined <60d, 1 visit only",
    size: 96,
  },
  {
    id: "m3",
    name: "Birthday this week",
    desc: "Reward-eligible",
    size: 23,
  },
];

const OFFERS: Offer[] = [
  {
    id: "o1",
    apiId: 1,
    label: "$5 off your next $15",
    lift: "Best recovery",
    proj: "~46 visits",
    projected: 46,
    rec: true,
  },
  {
    id: "o2",
    apiId: 2,
    label: "Free side with entrée",
    lift: "Highest margin",
    proj: "~38 visits",
    projected: 38,
  },
  {
    id: "o3",
    apiId: 3,
    label: "Double points weekend",
    lift: "Lowest cost",
    proj: "~29 visits",
    projected: 29,
  },
];

const MEMBER_TREND = [
  620, 640, 660, 690, 710, 742, 760, 800, 830, 860, 900, 930,
];

// ── Helpers ──────────────────────────────────────────────────────────────────

const money = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

const pct = (n: number, d = 0) => `${(n * 100).toFixed(d)}%`;

const fmtCount = (n: number) => n.toLocaleString("en-US");

const TIER_LEGEND: { tier: MapPoint["tier"]; label: string; color: string }[] = [
  { tier: "active", label: "Active", color: "#00A972" },
  { tier: "lapsed", label: "Lapsed", color: "#9CA3AF" },
  { tier: "at_risk", label: "At-risk", color: "#FF3621" },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MembersView() {
  const [storeId] = useStoreId();
  const toast = useToast();

  // Live API wiring — same hooks as the previous implementation.
  const stores = useApi<Store[]>(["stores"], "/stores");
  const kpis = useApi<KPI>(["loyalty-kpis", storeId], "/loyalty/kpis", {
    store_id: storeId,
  });
  const atRisk = useApi<Member[]>(
    ["loyalty-at-risk", storeId],
    "/loyalty/at-risk",
    { store_id: storeId, limit: 500 },
  );
  const points = useApi<MapPoint[]>(
    ["loyalty-map", storeId],
    "/loyalty/map",
    { store_id: storeId },
  );

  const center = stores.data?.find((s) => s.store_id === storeId);

  // Composer state — mirrors `useState` calls in the design template.
  const [seg, setSeg] = useState<string>("m1");
  const [offerId, setOfferId] = useState<string>("o1");
  const [chans, setChans] = useState({ push: true, email: true, sms: false });

  const segment = SEGMENTS.find((s) => s.id === seg) ?? SEGMENTS[0];
  const offer = OFFERS.find((o) => o.id === offerId) ?? OFFERS[0];
  const projected = offer.projected;

  // Audience numbers — real eligibility comes from /loyalty/at-risk, but
  // the segment cards show the design's hand-picked sizes (184 / 96 / 23).
  // We surface the live eligible count in the success card and the confirm
  // dialog so the manager sees what's actually being written.
  const eligibleLive = useMemo(
    () => (atRisk.data ?? []).filter((m) => m.churn_probability > 0.7).length,
    [atRisk.data],
  );

  // Send flow.
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [membersSent, setMembersSent] = useState<{ count: number } | null>(
    null,
  );

  async function confirmSend(_note: string) {
    setSending(true);
    try {
      const r = await api.post<{ count: number }>("/loyalty/win-back", {
        store_id: storeId,
        segment: "lapsed",
        offer_id: offer.apiId,
      });
      setMembersSent({ count: r.data.count });
      setConfirming(false);
      toast.success(`Win-back sent to ${r.data.count} members`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown error";
      toast.error(`Couldn't send win-back: ${msg}`);
    } finally {
      setSending(false);
    }
  }

  // Channel summary for the confirm dialog + projection.
  const activeChannels = (
    [
      ["push", "Push"],
      ["email", "Email"],
      ["sms", "SMS"],
    ] as const
  )
    .filter(([k]) => chans[k])
    .map(([, label]) => label);

  // Pretty stats for the LaborStat strip.
  const activeMembers = kpis.data?.active_members ?? null;
  const atRiskCount = kpis.data?.at_risk_count ?? null;
  const memberSpend30d = kpis.data?.spend_30d ?? null;

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
          maxWidth: 1120,
          margin: "0 auto",
          padding: "28px 32px 40px",
        }}
      >
        <PageHead
          icon="members"
          title="Loyalty"
          sub="Spot members slipping away and launch a win-back in a couple of clicks."
        >
          <Btn variant="ghost" icon="members">
            View all{activeMembers != null ? ` ${fmtCount(activeMembers)}` : ""}
          </Btn>
        </PageHead>

        {/* Stat strip — design's 4-card LaborStat row. */}
        <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
          <LaborStat
            label="Active members"
            value={activeMembers != null ? fmtCount(activeMembers) : "—"}
            foot={
              <Delta up size={11.5}>
                +5.2% MoM
              </Delta>
            }
          />
          <LaborStat
            label="Lapsing now"
            value={atRiskCount != null ? fmtCount(atRiskCount) : "—"}
            foot="regulars, 21d quiet"
          />
          <LaborStat
            label="Redemption rate"
            value="31%"
            foot="last campaign"
          />
          <LaborStat
            label="Member spend 30d"
            value={memberSpend30d != null ? money(memberSpend30d) : "—"}
            foot="across loyalty members"
          />
        </div>

        {membersSent ? (
          <ActivatedHero
            count={membersSent.count}
            offerLabel={offer.label}
            channels={activeChannels}
            projected={projected}
          />
        ) : (
          <div
            className="hb-members-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 380px",
              gap: 20,
            }}
          >
            {/* Composer */}
            <div
              style={{ display: "flex", flexDirection: "column", gap: 20 }}
            >
              <AIRec>
                <strong>
                  {atRiskCount != null ? fmtCount(atRiskCount) : "184"} regulars
                </strong>{" "}
                who came 4+ times a month have gone quiet for 21 days — that's{" "}
                <strong>$2,100/mo</strong> at risk. A{" "}
                <strong>$5-off-$15</strong> push is the model's best recovery
                play for this group.
              </AIRec>

              <Step label="1 · Who to reach">
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 9,
                  }}
                >
                  {SEGMENTS.map((s) => (
                    <SelectCard
                      key={s.id}
                      active={seg === s.id}
                      onClick={() => setSeg(s.id)}
                      title={s.name}
                      sub={s.desc}
                      right={fmtCount(s.size)}
                      rec={s.rec}
                    />
                  ))}
                </div>
              </Step>

              <Step label="2 · The offer">
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 9,
                  }}
                >
                  {OFFERS.map((o) => (
                    <SelectCard
                      key={o.id}
                      active={offerId === o.id}
                      onClick={() => setOfferId(o.id)}
                      title={o.label}
                      sub={`${o.lift} · projected ${o.proj}`}
                      rec={o.rec}
                    />
                  ))}
                </div>
              </Step>

              <Step label="3 · Channels">
                <div style={{ display: "flex", gap: 9 }}>
                  <ChannelToggle
                    icon="bell"
                    label="Push"
                    on={chans.push}
                    onToggle={() =>
                      setChans((c) => ({ ...c, push: !c.push }))
                    }
                  />
                  <ChannelToggle
                    icon="mail"
                    label="Email"
                    on={chans.email}
                    onToggle={() =>
                      setChans((c) => ({ ...c, email: !c.email }))
                    }
                  />
                  <ChannelToggle
                    icon="phone"
                    label="SMS"
                    on={chans.sms}
                    onToggle={() => setChans((c) => ({ ...c, sms: !c.sms }))}
                  />
                </div>
              </Step>
            </div>

            {/* Preview rail */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
                position: "sticky",
                top: 20,
                alignSelf: "start",
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--db-navy-800)",
                }}
              >
                Preview
              </div>

              {/* Push preview */}
              <Card pad={16} style={{ background: "var(--db-oat-medium)" }}>
                <div
                  style={{
                    background: "#fff",
                    borderRadius: 10,
                    padding: "12px 14px",
                    boxShadow: "var(--shadow-sm)",
                    display: "flex",
                    gap: 11,
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 8,
                      background: "var(--db-lava-600)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon
                      name="today"
                      size={18}
                      color="#fff"
                      stroke={2.2}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: "var(--db-navy-800)",
                      }}
                    >
                      Lakehouse Market
                    </div>
                    <div
                      style={{
                        fontSize: 12.5,
                        color: "var(--db-navy-800)",
                        marginTop: 2,
                        lineHeight: 1.45,
                      }}
                    >
                      We miss you, {"{first_name}"}! Here's{" "}
                      <strong>{offer.label.toLowerCase()}</strong> — good
                      through Sunday. Swing by Fillmore.
                    </div>
                    <div
                      style={{
                        fontSize: 10.5,
                        color: "var(--db-navy-400)",
                        marginTop: 5,
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      now
                    </div>
                  </div>
                </div>
              </Card>

              {/* Projection */}
              <Card pad={16}>
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 500,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "var(--db-gray-text)",
                    marginBottom: 10,
                  }}
                >
                  Projected impact
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 30,
                      fontWeight: 600,
                      color: "var(--db-navy-800)",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    ~{projected}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      color: "var(--db-gray-text)",
                    }}
                  >
                    recovered visits
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    color: "var(--db-green-700)",
                    fontWeight: 500,
                    marginTop: 2,
                  }}
                >
                  ≈ ${(projected * 11.4).toFixed(0)} in 14 days
                </div>
                <div
                  style={{
                    marginTop: 14,
                    paddingTop: 14,
                    borderTop: "1px solid var(--db-gray-lines)",
                  }}
                >
                  <Spark
                    pts={MEMBER_TREND}
                    w={336}
                    h={40}
                    color="var(--db-lava-600)"
                  />
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--db-navy-400)",
                      marginTop: 4,
                    }}
                  >
                    Active members, trailing 12 weeks
                  </div>
                </div>
              </Card>

              <Btn
                variant="primary"
                full
                size="lg"
                icon="send"
                onClick={() => {
                  if (activeChannels.length === 0) {
                    toast.error("Pick at least one channel.");
                    return;
                  }
                  setConfirming(true);
                }}
                disabled={atRisk.isLoading}
                dataTourTarget="members.send"
              >
                Send to {fmtCount(segment.size)} members
              </Btn>

              <div style={{ alignSelf: "flex-end" }}>
                <LakebaseTag table="app_offer_pushes" />
              </div>
            </div>
          </div>
        )}

        {/* Trade-area map */}
        <Card pad={0} style={{ overflow: "hidden", marginTop: 22 }}>
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

        {/* At-risk preview list — read-only, no per-member action. */}
        <section style={{ marginTop: 22 }}>
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
            <span
              style={{ fontSize: 11.5, color: "var(--db-gray-text)" }}
            >
              Top {Math.min(8, (atRisk.data ?? []).length)} by predicted CLV
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
              {(atRisk.data ?? []).slice(0, 8).length === 0 &&
                !atRisk.isLoading && (
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
              {(atRisk.data ?? []).slice(0, 8).map((m, i) => (
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
                    level={m.churn_probability > 0.7 ? "danger" : "warn"}
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
        title={`Send win-back to ${fmtCount(segment.size)} members?`}
        description="They'll receive the push within 24 hours."
        details={[
          { label: "Segment", value: segment.name },
          { label: "Offer", value: offer.label },
          {
            label: "Channels",
            value:
              activeChannels.length > 0 ? activeChannels.join(", ") : "—",
          },
          {
            label: "Live eligible",
            value: `${fmtCount(eligibleLive)} (churn > 70%)`,
          },
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

// ── Sub-components (mirror members.jsx) ──────────────────────────────────────

function Step({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--db-navy-800)",
          marginBottom: 10,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function SelectCard({
  active,
  onClick,
  title,
  sub,
  right,
  rec,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  sub: string;
  right?: string;
  rec?: boolean;
}) {
  const style: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
    textAlign: "left",
    cursor: "pointer",
    border: active
      ? "2px solid var(--db-lava-600)"
      : "1px solid var(--db-gray-lines)",
    background: "#fff",
    borderRadius: 11,
    padding: "13px 15px",
    margin: active ? -1 : 0,
    boxShadow: active ? "var(--shadow-sm)" : "none",
    transition: "all var(--dur-fast) var(--ease-out)",
    font: "inherit",
    color: "inherit",
  };
  return (
    <button type="button" onClick={onClick} style={style}>
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: 999,
          border: active
            ? "5px solid var(--db-lava-600)"
            : "2px solid var(--db-navy-300)",
          flexShrink: 0,
          boxSizing: "border-box",
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 13.5,
              fontWeight: 500,
              color: "var(--db-navy-800)",
            }}
          >
            {title}
          </span>
          {rec && <Pill level="info">AI pick</Pill>}
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: "var(--db-gray-text)",
            marginTop: 2,
          }}
        >
          {sub}
        </div>
      </div>
      {right && (
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--db-navy-800)",
            fontFamily: "var(--font-mono)",
            flexShrink: 0,
          }}
        >
          {right}
        </span>
      )}
    </button>
  );
}

function ChannelToggle({
  icon,
  label,
  on,
  onToggle,
}: {
  icon: IconName;
  label: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 13px",
        borderRadius: 9,
        cursor: "pointer",
        border: on
          ? "1px solid var(--db-navy-800)"
          : "1px solid var(--db-gray-lines)",
        background: on ? "var(--db-navy-800)" : "#fff",
        color: on ? "#fff" : "var(--db-gray-text)",
        flex: 1,
        justifyContent: "center",
        font: "inherit",
      }}
    >
      <Icon name={icon} size={15} color="currentColor" />
      <span style={{ fontSize: 12.5, fontWeight: 500 }}>{label}</span>
      {on && <Icon name="check" size={13} color="currentColor" stroke={2.4} />}
    </button>
  );
}

function LaborStat({
  label,
  value,
  foot,
}: {
  label: string;
  value: string;
  foot?: ReactNode;
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
      {foot &&
        (typeof foot === "string" ? (
          <div style={{ fontSize: 12, color: "var(--db-gray-text)" }}>
            {foot}
          </div>
        ) : (
          foot
        ))}
    </Card>
  );
}

function ActivatedHero({
  count,
  offerLabel,
  channels,
  projected,
}: {
  count: number;
  offerLabel: string;
  channels: string[];
  projected: number;
}) {
  const channelText =
    channels.length === 0
      ? "the selected channels"
      : channels.length === 1
        ? channels[0].toLowerCase()
        : channels.length === 2
          ? `${channels[0].toLowerCase()} and ${channels[1].toLowerCase()}`
          : channels
              .map((c, i) =>
                i === channels.length - 1
                  ? `and ${c.toLowerCase()}`
                  : c.toLowerCase(),
              )
              .join(", ");
  return (
    <Card pad={0} style={{ overflow: "hidden" }}>
      <div
        style={{
          background: "var(--db-navy-900)",
          padding: "36px 32px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: 14,
        }}
      >
        <span
          style={{
            width: 54,
            height: 54,
            borderRadius: 999,
            background: "var(--db-green-600)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="check" size={30} color="#fff" stroke={2.4} />
        </span>
        <h2
          style={{
            fontSize: 22,
            fontWeight: 500,
            color: "#fff",
            margin: 0,
          }}
        >
          Win-back sent to {fmtCount(count)} members
        </h2>
        <p
          style={{
            fontSize: 14,
            color: "var(--db-navy-300)",
            margin: 0,
            maxWidth: 460,
            lineHeight: 1.5,
          }}
        >
          &ldquo;{offerLabel}&rdquo; went out via {channelText}. Genie projects{" "}
          <strong style={{ color: "var(--db-green-400)" }}>
            ~{projected} recovered visits
          </strong>{" "}
          over the next two weeks.
        </p>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginTop: 4,
            alignItems: "center",
          }}
        >
          <Pill level="ok" dot>
            Campaign WB-0530 live
          </Pill>
          <LakebaseTag table="app_offer_pushes" tone="dark" />
        </div>
      </div>
    </Card>
  );
}

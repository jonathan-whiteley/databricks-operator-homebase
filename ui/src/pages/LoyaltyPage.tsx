// ui/src/pages/LoyaltyPage.tsx
import { Check, Coffee, Crown, Sparkles } from "lucide-react";
import { useState, type ComponentType } from "react";

import { DataTable } from "@/components/DataTable";
import { GenieChat } from "@/components/GenieChat";
import { MetricCard } from "@/components/MetricCard";
import { Sparkline } from "@/components/Sparkline";
import { StoreMap, type MapPoint } from "@/components/StoreMap";
import { api, useApi } from "@/lib/api";
import { cn, money, pct } from "@/lib/util";
import { useStoreId } from "@/state/store";

type KPI = {
  active_members: number;
  spend_30d: number;
  at_risk_count: number;
  redemption_pct: number;
};
type Member = {
  member_id: number;
  lifetime_spend: number;
  churn_probability: number;
  predicted_clv: number;
  segment: string;
};
type Store = { store_id: number; lat: number; lon: number };

type Suggestion = {
  offer_id: number;
  name: string;
  audience: string;
  lift: string;
  reach: string;
  icon: ComponentType<{ className?: string }>;
  accent: string;
};

// Hard-coded counter-prompt suggestions for now. When /api/loyalty/offers
// ships, swap this list for the API response. Audience sizes are illustrative
// — real lift values would come from the model that recommends offers.
const SUGGESTIONS: Suggestion[] = [
  {
    offer_id: 1,
    name: "Breakfast Bundle · 20% Off",
    audience: "Lapsed members in catchment",
    lift: "+18% redemption",
    reach: "1,420 members",
    icon: Coffee,
    accent: "var(--color-lava)",
  },
  {
    offer_id: 2,
    name: "Free Drink with Combo",
    audience: "Active members, weekday lunch",
    lift: "+12% basket size",
    reach: "2,860 members",
    icon: Sparkles,
    accent: "var(--color-info)",
  },
  {
    offer_id: 3,
    name: "VIP Bonus · 3x Points",
    audience: "Whales (top-decile LTV)",
    lift: "+24% repeat visits",
    reach: "320 members",
    icon: Crown,
    accent: "var(--color-success)",
  },
];

const TIER_LEGEND: { tier: MapPoint["tier"]; label: string; color: string }[] = [
  { tier: "active", label: "Active", color: "#00A972" },
  { tier: "lapsed", label: "Lapsed", color: "#9CA3AF" },
  { tier: "at_risk", label: "At-risk", color: "#FF3621" },
];

export default function LoyaltyPage() {
  const [storeId] = useStoreId();
  const stores = useApi<Store[]>(["stores"], "/stores");
  const kpis = useApi<KPI>(["loyalty-kpis", storeId], "/loyalty/kpis", { store_id: storeId });
  const atRisk = useApi<Member[]>(["loyalty-at-risk", storeId], "/loyalty/at-risk", { store_id: storeId });
  const points = useApi<MapPoint[]>(["loyalty-map", storeId], "/loyalty/map", { store_id: storeId });

  const center = stores.data?.find((s) => s.store_id === storeId);
  const [activated, setActivated] = useState<Record<number, boolean>>({});
  const [pending, setPending] = useState<Record<number, boolean>>({});

  async function activateOffer(offer_id: number) {
    if (activated[offer_id]) return;
    setPending((p) => ({ ...p, [offer_id]: true }));
    try {
      await api.post("/loyalty/offer-push", {
        store_id: storeId,
        offer_id,
        scope: "counter_prompt",
      });
      setActivated((a) => ({ ...a, [offer_id]: true }));
    } finally {
      setPending((p) => ({ ...p, [offer_id]: false }));
    }
  }

  const topAtRisk = (atRisk.data ?? []).slice(0, 8);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-bold text-[color:var(--color-ink)]">Loyalty</h1>
          <p className="text-xs text-[color:var(--color-ink-soft)]">
            Member density in your trade area, then the counter-prompt to activate.
          </p>
        </div>

        <section className="overflow-hidden rounded-lg border border-[color:var(--color-hairline)] bg-white">
          <header className="flex items-center justify-between gap-4 border-b border-[color:var(--color-hairline)] bg-[color:var(--color-cream)] px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-[color:var(--color-ink)]">
                Trade area · Store #{storeId}
              </h2>
              <p className="text-[11px] text-[color:var(--color-ink-soft)]">
                Loyalty members within ~8km. Color shows engagement tier.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {TIER_LEGEND.map((t) => (
                <span
                  key={t.tier}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-hairline)] bg-white px-2 py-0.5 text-[11px] text-[color:var(--color-ink)]"
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ background: t.color }}
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
            <div className="flex h-[420px] items-center justify-center text-sm text-[color:var(--color-ink-soft)]">
              Loading store location…
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-[color:var(--color-ink)]">
                Counter prompt for tomorrow
              </h2>
              <p className="mt-0.5 text-xs text-[color:var(--color-ink-soft)]">
                Ranked by predicted lift for this store. Activate the one that fits today's traffic.
              </p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {SUGGESTIONS.map((s) => {
              const isOn = activated[s.offer_id];
              const isBusy = pending[s.offer_id];
              const Icon = s.icon;
              return (
                <article
                  key={s.offer_id}
                  className={cn(
                    "group relative overflow-hidden rounded-xl border bg-white p-4 shadow-sm transition-all duration-200",
                    "hover:-translate-y-0.5 hover:shadow-md",
                    isOn
                      ? "border-2 border-[color:var(--color-success)] shadow-[0_8px_24px_rgba(0,169,114,0.18)]"
                      : "border-[color:var(--color-hairline)]",
                  )}
                >
                  <header className="flex items-start gap-3">
                    <div
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white"
                      style={{ background: s.accent }}
                    >
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold leading-tight text-[color:var(--color-ink)]">
                        {s.name}
                      </h3>
                      <div className="text-[11px] text-[color:var(--color-ink-soft)]">{s.audience}</div>
                    </div>
                  </header>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[color:var(--color-ink-soft)]">
                        Predicted lift
                      </div>
                      <div className="mt-0.5 font-mono text-sm font-semibold text-[color:var(--color-success)]">
                        {s.lift}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[color:var(--color-ink-soft)]">
                        Audience
                      </div>
                      <div className="mt-0.5 font-mono text-sm font-semibold text-[color:var(--color-ink)]">
                        {s.reach}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => activateOffer(s.offer_id)}
                    disabled={isOn || isBusy}
                    className={cn(
                      "mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-white transition-colors",
                      isOn
                        ? "bg-[color:var(--color-success)]"
                        : "bg-[color:var(--color-lava)] hover:opacity-90",
                      isBusy && "opacity-70",
                    )}
                  >
                    {isOn ? (
                      <>
                        <Check className="size-3.5" strokeWidth={3} />
                        Activated
                      </>
                    ) : isBusy ? (
                      "Activating…"
                    ) : (
                      "Activate today"
                    )}
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        <div className="grid grid-cols-4 gap-3">
          <MetricCard label="Active members 30d" value={kpis.data?.active_members ?? "—"} accent="success" />
          <MetricCard label="30d spend" value={money(kpis.data?.spend_30d ?? 0)} accent="lava" />
          <MetricCard label="At-risk in area" value={kpis.data?.at_risk_count ?? "—"} accent="warning" />
          <MetricCard label="Redemption rate" value={pct(kpis.data?.redemption_pct ?? 0)} accent="navy" />
        </div>

        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-[color:var(--color-ink)]">
              At-risk members in your catchment
            </h2>
            <span className="text-[11px] text-[color:var(--color-ink-soft)]">
              Top {topAtRisk.length} by predicted CLV
            </span>
          </div>
          <p className="mb-2 text-xs text-[color:var(--color-ink-soft)]">
            These members are visible to the counter when they pay. Use the activated counter-prompt above to nudge them.
          </p>
          <DataTable
            rows={topAtRisk}
            columns={[
              { key: "member_id", header: "Member", render: (r) => <span className="font-mono">#{r.member_id}</span> },
              { key: "segment", header: "Segment" },
              { key: "lifetime_spend", header: "LTV", align: "right", render: (r) => money(r.lifetime_spend) },
              { key: "predicted_clv", header: "Pred CLV", align: "right", render: (r) => money(r.predicted_clv) },
              { key: "churn_probability", header: "Churn risk", align: "right", render: (r) => pct(r.churn_probability) },
            ]}
          />
        </section>

        <section className="rounded-lg border border-[color:var(--color-hairline)] bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-[color:var(--color-ink)]">
            Offer redemption · last 8 weeks
          </h3>
          <Sparkline
            height={88}
            data={[
              { week: 1, value: 0.12 }, { week: 2, value: 0.14 }, { week: 3, value: 0.18 }, { week: 4, value: 0.16 },
              { week: 5, value: 0.21 }, { week: 6, value: 0.19 }, { week: 7, value: 0.23 }, { week: 8, value: 0.24 },
            ]}
          />
        </section>
      </div>
      <GenieChat
        tabId="loyalty"
        chips={[
          "Who hasn't visited in 30 days but spent $500+ last quarter?",
          "Which offer worked best at my store last month?",
          "Show me my top 10 loyalty members this week",
        ]}
      />
    </div>
  );
}

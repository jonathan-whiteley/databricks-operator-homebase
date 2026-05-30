// ui/src/pages/LoyaltyPage.tsx
import { DataTable } from "@/components/DataTable";
import { GenieChat } from "@/components/GenieChat";
import { MetricCard } from "@/components/MetricCard";
import { StoreMap, type MapPoint } from "@/components/StoreMap";
import { api, useApi } from "@/lib/api";
import { money, pct } from "@/lib/util";
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

export default function LoyaltyPage() {
  const [storeId] = useStoreId();
  const stores = useApi<Store[]>(["stores"], "/stores");
  const kpis = useApi<KPI>(["loyalty-kpis", storeId], "/loyalty/kpis", { store_id: storeId });
  const atRisk = useApi<Member[]>(["loyalty-at-risk", storeId], "/loyalty/at-risk", { store_id: storeId });
  const points = useApi<MapPoint[]>(["loyalty-map", storeId], "/loyalty/map", { store_id: storeId });

  const center = stores.data?.find((s) => s.store_id === storeId);

  async function pushOffer(memberId: number) {
    await api.post("/loyalty/offer-push", {
      store_id: storeId,
      member_id: memberId,
      offer_id: 1,
      scope: "member",
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-[color:var(--color-ink)]">Loyalty</h1>
        <div className="grid grid-cols-4 gap-3">
          <MetricCard label="Active members 30d" value={kpis.data?.active_members ?? "—"} accent="success" />
          <MetricCard label="30d spend" value={money(kpis.data?.spend_30d ?? 0)} accent="lava" />
          <MetricCard label="At-risk in area" value={kpis.data?.at_risk_count ?? "—"} accent="warning" />
          <MetricCard label="Redemption rate" value={pct(kpis.data?.redemption_pct ?? 0)} accent="navy" />
        </div>
        <DataTable
          rows={atRisk.data ?? []}
          columns={[
            { key: "member_id", header: "Member", render: (r) => <span className="font-mono">#{r.member_id}</span> },
            { key: "segment", header: "Segment" },
            { key: "lifetime_spend", header: "LTV", align: "right", render: (r) => money(r.lifetime_spend) },
            { key: "predicted_clv", header: "Pred CLV", align: "right", render: (r) => money(r.predicted_clv) },
            { key: "churn_probability", header: "Churn risk", align: "right", render: (r) => pct(r.churn_probability) },
            {
              key: "_act",
              header: "",
              align: "right",
              render: (r) => (
                <button
                  onClick={() => pushOffer(r.member_id)}
                  className="rounded-md bg-[color:var(--color-lava)] px-2 py-1 text-xs font-semibold text-white"
                >
                  Push offer
                </button>
              ),
            },
          ]}
        />
        {center && <StoreMap center={{ lat: center.lat, lon: center.lon }} points={points.data ?? []} />}
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

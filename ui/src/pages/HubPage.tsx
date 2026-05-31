// ui/src/pages/HubPage.tsx
import { useApi } from "@/lib/api";
import { money } from "@/lib/util";
import { useStoreId } from "@/state/store";
import { GreetingChip } from "@/components/GreetingChip";
import { HubActionQueue } from "@/components/HubActionQueue";
import { HubDiagram } from "@/components/HubDiagram";
import { MetricCard } from "@/components/MetricCard";
import {
  DollarSign,
  ClipboardCheck,
  Heart,
  Wrench,
  Database,
  Sparkles,
  Cpu,
  Layers,
} from "lucide-react";

type Reorder = { sku_id: number; sku_name: string; days_of_cover: number };
type Risk = { equipment_id: number; category: string; rul_days: number };
type Inbox = { review_id: number; snippet: string; sentiment: string };
type Today = {
  dayparts: { daypart: string; forecast_revenue: number; forecast_transactions: number }[];
};
type LoyaltyKPI = {
  active_members: number;
  spend_30d: number;
  at_risk_count: number;
  redemption_pct: number;
};
type Store = { store_id: number; store_name: string; city: string; state: string };

// TODO: Pull manager_name from /api/stores when the backend exposes it on the Store model.
const MANAGER_NAME = "Marcus Chen";
const WEATHER_PLACEHOLDER = "68°F · clear";

export default function HubPage() {
  const [storeId] = useStoreId();
  const today = new Date().toISOString().slice(0, 10);

  const stores   = useApi<Store[]>(["stores"], "/stores");
  const reorders = useApi<Reorder[]>(["hub-reorders", storeId], "/supply/reorder-queue", { store_id: storeId });
  const risks    = useApi<Risk[]>(["hub-risks", storeId], "/maintenance/at-risk", { store_id: storeId });
  const inbox    = useApi<Inbox[]>(["hub-inbox", storeId], "/sentiment/inbox", { store_id: storeId, since: today });
  const labor    = useApi<Today>(["hub-labor-today", storeId, today], "/labor/today", { store_id: storeId, date: today });
  const loyalty  = useApi<LoyaltyKPI>(["hub-loyalty", storeId], "/loyalty/kpis", { store_id: storeId });

  const store = stores.data?.find((s) => s.store_id === storeId);

  // ---- Action queue items ----
  const items: { tab: string; tabLabel: string; title: string; subtitle: string; to: string }[] = [];
  reorders.data?.slice(0, 2).forEach((r) => items.push({
    tab: "supply", tabLabel: "03 Supply",
    title: `Release PO: ${r.sku_name}`,
    subtitle: `${r.days_of_cover.toFixed(1)} days of cover left`,
    to: "/supply",
  }));
  risks.data?.slice(0, 2).forEach((r) => items.push({
    tab: "maintenance", tabLabel: "05 Maint",
    title: `Schedule tech: ${r.category}`,
    subtitle: `Predicted failure in ${r.rul_days} days`,
    to: "/maintenance",
  }));
  inbox.data?.slice(0, 2).forEach((rv) => items.push({
    tab: "sentiment", tabLabel: "04 Sentiment",
    title: `New ${rv.sentiment} review`,
    subtitle: rv.snippet,
    to: "/sentiment",
  }));

  // ---- KPI computations ----
  const dayparts = labor.data?.dayparts ?? [];
  const forecastTotal = dayparts.reduce((a, d) => a + d.forecast_revenue, 0);
  // Placeholder: in the real flow, this counts day-parts not yet approved.
  const tasksToLock = dayparts.length > 0 ? dayparts.length : 4;
  const activeMembers = loyalty.data?.active_members ?? null;
  const equipmentAtRisk = (risks.data ?? []).filter((r) => r.rul_days < 7).length;

  // ---- Badge counts on diagram nodes ----
  const badges = {
    labor: tasksToLock,
    loyalty: loyalty.data?.at_risk_count ?? 0,
    supply: reorders.data?.length ?? 0,
    sentiment: inbox.data?.length ?? 0,
    maintenance: risks.data?.length ?? 0,
  };

  return (
    <div className="space-y-6">
      {/* Row 1: Greeting banner */}
      <GreetingChip
        managerName={MANAGER_NAME}
        storeName={store?.store_name}
        storeLocation={store ? `${store.city}, ${store.state}` : undefined}
        weather={WEATHER_PLACEHOLDER}
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard
          label="Forecast today"
          value={money(forecastTotal)}
          sub={dayparts.length > 0 ? `${dayparts.length} day-parts` : "loading…"}
          accent="lava"
          icon={<DollarSign className="size-4" />}
        />
        <MetricCard
          label="Tasks to lock"
          value={tasksToLock}
          sub="day-parts pending approval"
          accent="navy"
          icon={<ClipboardCheck className="size-4" />}
        />
        <MetricCard
          label="Active members"
          value={activeMembers ?? "—"}
          sub="last 30 days"
          accent="success"
          icon={<Heart className="size-4" />}
        />
        <MetricCard
          label="Equipment at risk"
          value={equipmentAtRisk}
          sub="failure in < 7 days"
          accent={equipmentAtRisk > 0 ? "warning" : "navy"}
          icon={<Wrench className="size-4" />}
        />
      </div>

      {/* Row 2: Diagram + Action queue */}
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <section className="rounded-xl border border-[color:var(--color-hairline)] bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-[color:var(--color-ink)]">
                Your day at a glance
              </h2>
              <p className="text-xs text-[color:var(--color-ink-soft)]">
                Five domains, one console. Tap a node to dive in.
              </p>
            </div>
            <span className="rounded-full bg-[color:var(--color-cream)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[color:var(--color-ink-soft)]">
              Live
            </span>
          </div>
          <HubDiagram badges={badges} />
        </section>

        <HubActionQueue items={items} />
      </div>

      {/* Row 3: Platform story callout */}
      <section className="rounded-xl border border-[color:var(--color-hairline)] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-7 items-center justify-center rounded-md bg-[color:var(--color-lava-soft)] text-[color:var(--color-lava)]">
              <Sparkles className="size-4" />
            </span>
            <div className="leading-tight">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--color-ink-soft)]">
                Powered by Databricks
              </div>
              <div className="text-sm font-semibold text-[color:var(--color-ink)]">
                One platform, five workflows
              </div>
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <PlatformChip icon={<Layers className="size-3.5" />} label="21 UC tables" />
            <PlatformChip icon={<Database className="size-3.5" />} label="1 Lakebase instance" />
            <PlatformChip icon={<Sparkles className="size-3.5" />} label="Genie" />
            <PlatformChip icon={<Cpu className="size-3.5" />} label="Model Serving" />
          </div>
        </div>
      </section>
    </div>
  );
}

function PlatformChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-hairline)] bg-[color:var(--color-cream)] px-2.5 py-1 text-xs font-medium text-[color:var(--color-ink)]">
      <span className="text-[color:var(--color-lava)]">{icon}</span>
      {label}
    </span>
  );
}

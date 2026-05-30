// ui/src/pages/HubPage.tsx
import { useApi } from "@/lib/api";
import { useStoreId } from "@/state/store";
import { HubActionQueue } from "@/components/HubActionQueue";
import { HubDiagram } from "@/components/HubDiagram";

type Reorder = { sku_id: number; sku_name: string; days_of_cover: number };
type Risk = { equipment_id: number; category: string; rul_days: number };
type Inbox = { review_id: number; snippet: string; sentiment: string };

export default function HubPage() {
  const [storeId] = useStoreId();
  const today = new Date().toISOString().slice(0, 10);

  const reorders = useApi<Reorder[]>(["hub-reorders", storeId], "/supply/reorder-queue", { store_id: storeId });
  const risks = useApi<Risk[]>(["hub-risks", storeId], "/maintenance/at-risk", { store_id: storeId });
  const inbox = useApi<Inbox[]>(["hub-inbox", storeId], "/sentiment/inbox", { store_id: storeId, since: today });

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

  const badges = {
    labor: 4,
    loyalty: 3,
    supply: reorders.data?.length ?? 0,
    sentiment: inbox.data?.length ?? 0,
    maintenance: risks.data?.length ?? 0,
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
      <div>
        <h1 className="mb-1 text-2xl font-bold text-[color:var(--color-ink)]">Good morning.</h1>
        <p className="mb-6 text-[color:var(--color-ink-soft)]">Your day at a glance.</p>
        <HubDiagram badges={badges} />
      </div>
      <div>
        <h2 className="mb-3 text-lg font-semibold text-[color:var(--color-ink)]">Today at your store</h2>
        <HubActionQueue items={items} />
      </div>
    </div>
  );
}

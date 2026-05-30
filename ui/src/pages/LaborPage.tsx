// ui/src/pages/LaborPage.tsx
import { DayPartCard } from "@/components/DayPartCard";
import { GenieChat } from "@/components/GenieChat";
import { MetricCard } from "@/components/MetricCard";
import { useApi } from "@/lib/api";
import { money, pct } from "@/lib/util";
import { useStoreId } from "@/state/store";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Today = {
  dayparts: { daypart: string; forecast_revenue: number; forecast_transactions: number }[];
};

export default function LaborPage() {
  const [storeId] = useStoreId();
  const today = new Date().toISOString().slice(0, 10);
  const { data, isLoading } = useApi<Today>(
    ["labor-today", storeId, today],
    "/labor/today",
    { store_id: storeId, date: today },
  );
  const total = (data?.dayparts ?? []).reduce((a, d) => a + d.forecast_revenue, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-[color:var(--color-ink)]">Labor</h1>
        <div className="grid grid-cols-4 gap-3">
          <MetricCard label="Forecast Today" value={money(total)} sub="across day-parts" accent="lava" />
          <MetricCard label="Day-parts to lock" value={data?.dayparts.length ?? 0} accent="navy" />
          <MetricCard label="Projected labor %" value={pct(0.282)} sub="vs target 28%" accent="success" />
          <MetricCard label="Vs last week" value="+4.1%" accent="warning" />
        </div>
        <section className="rounded-lg border border-[color:var(--color-hairline)] bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-[color:var(--color-ink)]">Forecast revenue by day-part</h3>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={data?.dayparts ?? []}>
                <XAxis dataKey="daypart" stroke="#4A5963" fontSize={12} />
                <YAxis stroke="#4A5963" fontSize={12} />
                <Tooltip />
                <Bar dataKey="forecast_revenue" fill="#FF3621" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {(data?.dayparts ?? []).map((d) => (
            <DayPartCard
              key={d.daypart}
              daypart={d.daypart}
              forecast={d.forecast_revenue}
              transactions={d.forecast_transactions}
              date={today}
            />
          ))}
        </div>
        {isLoading && <div className="text-sm text-[color:var(--color-ink-soft)]">Loading forecast…</div>}
      </div>
      <GenieChat
        tabId="labor"
        chips={[
          "Why is lunch headcount higher than last Tuesday?",
          "What was my labor % last Friday vs forecast?",
          "How does my labor % compare to nearby stores?",
        ]}
      />
    </div>
  );
}

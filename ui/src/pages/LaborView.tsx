// ui/src/pages/LaborView.tsx
//
// Phase 6 of the Claude Design Homebase redesign. This is the re-skinned
// Labor view, built entirely on the new `components/db/*` primitives. It
// replaces the right-rail Genie chat with the global slide-over and lives
// as a single-column page on the oat-light surface.
//
// Functionally identical to LaborPage:
//   - GET  /api/labor/today         → 4 day-part cards
//   - POST /api/labor/recommend     → headcount recompute (inside DayPartCard)
//   - POST /api/labor/override      → per-card Lock + "Approve all" sweep
//
// The "Approve all" affordance opens the existing ConfirmDialog and, on
// confirm, fans out one POST per unlocked day-part using the default
// headcount that the card would have computed.
import { useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DayPartCard } from "@/components/DayPartCard";
import {
  AIRec,
  Btn,
  Card,
  LakebaseTag,
  PageHead,
  useToast,
} from "@/components/db";
import { api, useApi } from "@/lib/api";
import { money } from "@/lib/util";
import { useStoreId } from "@/state/store";

type Today = {
  store_id: number;
  date: string;
  dayparts: {
    daypart: string;
    forecast_revenue: number;
    forecast_transactions: number;
  }[];
};

// Mirrors the synthetic headcount defaults inside DayPartCard so that the
// "Approve all" sweep submits the same headcount the user would see on each
// card before any manual recompute.
const DAYPART_BIAS: Record<string, number> = {
  Breakfast: 1,
  Lunch: 3,
  Dinner: 2,
  Late: 0,
};

function defaultHeadcount(forecast: number, daypart: string): number {
  const bias = DAYPART_BIAS[daypart] ?? 1;
  return Math.max(2, Math.round(forecast / 350 + bias));
}

export default function LaborView() {
  const [storeId] = useStoreId();
  const toast = useToast();
  const today = new Date().toISOString().slice(0, 10);

  const { data, isLoading } = useApi<Today>(
    ["labor-today", storeId, today],
    "/labor/today",
    { store_id: storeId, date: today },
  );
  const dayparts = useMemo(() => data?.dayparts ?? [], [data]);
  const date = data?.date ?? today;
  const totalForecast = dayparts.reduce((a, d) => a + d.forecast_revenue, 0);

  // "Approve all" — opens a single confirm, then loops one /labor/override
  // POST per day-part using the default headcount formula.
  const [approveAllOpen, setApproveAllOpen] = useState(false);

  async function handleApproveAll(note: string) {
    if (dayparts.length === 0) return;
    let ok = 0;
    let failed = 0;
    for (const dp of dayparts) {
      const headcount = defaultHeadcount(dp.forecast_revenue, dp.daypart);
      try {
        await api.post("/labor/override", {
          store_id: storeId,
          date,
          daypart: dp.daypart,
          headcount,
          note: note || "Approve all (one-tap)",
        });
        ok += 1;
      } catch {
        failed += 1;
      }
    }
    setApproveAllOpen(false);
    if (failed === 0) {
      toast.success(`Approved ${ok} day-part schedule${ok === 1 ? "" : "s"}.`);
    } else if (ok > 0) {
      toast.error(`Saved ${ok}, ${failed} failed. Try again.`);
    } else {
      toast.error(`Couldn't save schedules. Try again.`);
    }
  }

  const approveAllDetails = [
    { label: "Date", value: date },
    { label: "Day-parts", value: String(dayparts.length) },
    { label: "Forecast total", value: money(totalForecast) },
  ];

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
          display: "flex",
          flexDirection: "column",
          gap: 22,
        }}
      >
        <PageHead
          icon="labor"
          title="Labor"
          sub="Approve today's schedule and review yesterday's actuals."
        >
          <Btn
            variant="dark"
            icon="check"
            onClick={() => setApproveAllOpen(true)}
            disabled={dayparts.length === 0}
          >
            Approve all
          </Btn>
        </PageHead>

        <AIRec
          tone="navy"
          action="See breakdown"
          onAction={() => {
            // No-op for now — Phase 6 stub. Future: open the Genie slide-over
            // with a pre-seeded prompt or scroll to the lunch card.
          }}
        >
          Lunch crew looks 2 short vs forecast — consider bumping by 1 cashier.
        </AIRec>

        <section>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              marginBottom: 14,
              gap: 14,
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 500,
                  color: "var(--db-navy-800)",
                  letterSpacing: "-0.01em",
                }}
              >
                By day-part
              </h2>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 13,
                  color: "var(--db-gray-text)",
                }}
              >
                Tap any card to override the forecast. Crew, cost and labor %
                update live.
              </p>
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 14,
            }}
          >
            {dayparts.map((d) => (
              <DayPartCard
                key={d.daypart}
                daypart={d.daypart}
                forecast={d.forecast_revenue}
                transactions={d.forecast_transactions}
                date={date}
              />
            ))}
            {isLoading &&
              dayparts.length === 0 &&
              Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    height: 240,
                    borderRadius: 12,
                    background: "#fff",
                    border: "1px solid var(--db-gray-lines)",
                    opacity: 0.5,
                  }}
                />
              ))}
          </div>
        </section>

        <Card>
          <div
            style={{
              padding: "16px 18px",
              borderBottom: "1px solid var(--db-gray-lines)",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <h2
              style={{
                fontSize: 15,
                fontWeight: 500,
                color: "var(--db-navy-800)",
                margin: 0,
                letterSpacing: "-0.01em",
              }}
            >
              Recent approvals
            </h2>
            <span style={{ marginLeft: "auto" }}>
              <LakebaseTag table="app_labor_overrides" />
            </span>
          </div>
          <div
            style={{
              padding: "28px 18px",
              textAlign: "center",
              fontSize: 13,
              color: "var(--db-gray-text)",
            }}
          >
            Locked schedules will appear here.
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={approveAllOpen}
        title="Approve all day-part schedules?"
        description={`This writes ${dayparts.length} row${
          dayparts.length === 1 ? "" : "s"
        } to app_labor_overrides in Lakebase — one per day-part.`}
        details={approveAllDetails}
        noteLabel="Manager note (applied to all)"
        notePlaceholder="e.g. Standard Saturday schedule"
        confirmLabel="Approve all"
        onCancel={() => setApproveAllOpen(false)}
        onConfirm={handleApproveAll}
      />
    </div>
  );
}
